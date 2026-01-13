/**
 * Conflict Resolution
 *
 * Handles conflict resolution for sync operations using CRDT merge logic.
 * Leverages the CRDT infrastructure from A3 for automatic conflict resolution.
 *
 * Requirements:
 * - ARCH-004: CRDT conflict resolution
 * - B6: Sync Relay Client
 */

import {
  resolveConflict,
  mergeEntities,
  resolveAllConflicts,
  detectConflicts,
  compareVersionVectors,
} from '../db/crdt';
import type { CRDTEntity } from '../db/crdt';
import type { SyncConflict } from './syncProtocol';

/**
 * Conflict resolution strategy
 */
export enum ConflictStrategy {
  AUTO = 'AUTO', // Automatic resolution using CRDT rules
  MANUAL = 'MANUAL', // Require manual resolution
  LOCAL_WINS = 'LOCAL_WINS', // Always prefer local changes
  REMOTE_WINS = 'REMOTE_WINS', // Always prefer remote changes
}

/**
 * Conflict resolution result
 */
export interface ConflictResolutionResult<T extends CRDTEntity = CRDTEntity> {
  resolved: T;
  winner: 'local' | 'remote' | 'merged';
  strategy_used: ConflictStrategy;
  conflict_detected: boolean;
}

/**
 * Merge result for multiple entities
 */
export interface MergeResult<T extends CRDTEntity = CRDTEntity> {
  merged: T[];
  conflicts_detected: number;
  conflicts_resolved: number;
  local_wins: number;
  remote_wins: number;
  auto_merged: number;
}

/**
 * Resolve a conflict between local and remote entities
 */
export function resolveEntityConflict<T extends CRDTEntity>(
  local: T,
  remote: T,
  strategy: ConflictStrategy = ConflictStrategy.AUTO
): ConflictResolutionResult<T> {
  // Check if there's actually a conflict
  const comparison = compareVersionVectors(
    local.version_vector,
    remote.version_vector
  );

  // No conflict - versions are causally ordered
  if (comparison === 'before') {
    return {
      resolved: remote,
      winner: 'remote',
      strategy_used: strategy,
      conflict_detected: false,
    };
  }

  if (comparison === 'after') {
    return {
      resolved: local,
      winner: 'local',
      strategy_used: strategy,
      conflict_detected: false,
    };
  }

  if (comparison === 'equal') {
    return {
      resolved: local,
      winner: 'local',
      strategy_used: strategy,
      conflict_detected: false,
    };
  }

  // Concurrent modification detected
  const conflictDetected = true;

  switch (strategy) {
    case ConflictStrategy.AUTO: {
      // Use CRDT LWW resolution
      const winner = resolveConflict(local, remote);
      const loser = winner === local ? remote : local;
      const merged = mergeEntities(winner, loser);

      return {
        resolved: merged,
        winner: winner === local ? 'local' : 'remote',
        strategy_used: ConflictStrategy.AUTO,
        conflict_detected: conflictDetected,
      };
    }

    case ConflictStrategy.LOCAL_WINS: {
      const merged = mergeEntities(local, remote);
      return {
        resolved: merged,
        winner: 'local',
        strategy_used: ConflictStrategy.LOCAL_WINS,
        conflict_detected: conflictDetected,
      };
    }

    case ConflictStrategy.REMOTE_WINS: {
      const merged = mergeEntities(remote, local);
      return {
        resolved: merged,
        winner: 'remote',
        strategy_used: ConflictStrategy.REMOTE_WINS,
        conflict_detected: conflictDetected,
      };
    }

    case ConflictStrategy.MANUAL: {
      // For manual resolution, return local and mark for manual review
      // The caller should handle manual resolution UI
      return {
        resolved: local,
        winner: 'local',
        strategy_used: ConflictStrategy.MANUAL,
        conflict_detected: conflictDetected,
      };
    }

    default:
      throw new Error(`Unknown conflict strategy: ${strategy}`);
  }
}

/**
 * Merge multiple local and remote entities
 */
export function mergeEntities_Batch<T extends CRDTEntity>(
  localEntities: T[],
  remoteEntities: T[],
  _strategy: ConflictStrategy = ConflictStrategy.AUTO
): MergeResult<T> {
  // Detect conflicts first
  const conflicts = detectConflicts([...localEntities, ...remoteEntities]);

  // Use CRDT resolution for all entities
  const merged = resolveAllConflicts([...localEntities, ...remoteEntities]);

  // Track statistics
  let localWins = 0;
  let remoteWins = 0;
  let autoMerged = 0;

  // Analyze results
  const localIds = new Set(localEntities.map(e => e.id));
  const remoteIds = new Set(remoteEntities.map(e => e.id));

  for (const entity of merged) {
    const inLocal = localIds.has(entity.id);
    const inRemote = remoteIds.has(entity.id);

    if (inLocal && inRemote) {
      // Was in both, so a merge occurred
      autoMerged++;
    } else if (inLocal) {
      localWins++;
    } else if (inRemote) {
      remoteWins++;
    }
  }

  return {
    merged: merged as T[],
    conflicts_detected: conflicts.length,
    conflicts_resolved: conflicts.length,
    local_wins: localWins,
    remote_wins: remoteWins,
    auto_merged: autoMerged,
  };
}

/**
 * Apply remote changes to local entities
 */
export function applyRemoteChanges<T extends CRDTEntity>(
  local: Map<string, T>,
  remote: T[],
  strategy: ConflictStrategy = ConflictStrategy.AUTO
): {
  updated: T[];
  created: T[];
  conflicts: ConflictResolutionResult<T>[];
} {
  const updated: T[] = [];
  const created: T[] = [];
  const conflicts: ConflictResolutionResult<T>[] = [];

  for (const remoteEntity of remote) {
    const localEntity = local.get(remoteEntity.id);

    if (!localEntity) {
      // New entity from remote
      created.push(remoteEntity);
    } else {
      // Existing entity - resolve conflict
      const result = resolveEntityConflict(localEntity, remoteEntity, strategy);
      updated.push(result.resolved);

      if (result.conflict_detected) {
        conflicts.push(result);
      }
    }
  }

  return { updated, created, conflicts };
}

/**
 * Prepare local changes for sync
 */
export function prepareLocalChangesForSync<T extends CRDTEntity>(
  entities: T[]
): T[] {
  // Filter out any entities that shouldn't be synced
  // For now, just return all entities
  return entities.filter(entity => {
    // Don't sync deleted entities that were deleted long ago
    // (keep recent deletions to propagate tombstones)
    if (entity.deleted_at !== null) {
      const daysSinceDeleted = (Date.now() - entity.deleted_at) / (1000 * 60 * 60 * 24);
      return daysSinceDeleted < 30; // Keep tombstones for 30 days
    }
    return true;
  });
}

/**
 * Check if entity needs sync
 */
export function needsSync<T extends CRDTEntity>(
  entity: T,
  lastSyncTimestamp: number
): boolean {
  // Entity needs sync if it was updated after last sync
  return entity.updated_at > lastSyncTimestamp;
}

/**
 * Get entities that need sync
 */
export function getEntitiesToSync<T extends CRDTEntity>(
  entities: T[],
  lastSyncTimestamp: number
): T[] {
  return entities.filter(entity => needsSync(entity, lastSyncTimestamp));
}

/**
 * Validate conflict resolution result
 */
export function validateResolution<T extends CRDTEntity>(
  result: ConflictResolutionResult<T>
): boolean {
  // Ensure the resolved entity is valid
  if (!result.resolved) return false;
  if (!result.resolved.id) return false;
  if (!result.resolved.version_vector) return false;
  if (typeof result.resolved.updated_at !== 'number') return false;

  return true;
}

/**
 * Get conflict summary
 */
export function getConflictSummary(
  conflicts: SyncConflict[]
): {
  total: number;
  by_type: Record<string, number>;
  by_entity: Record<string, number>;
} {
  const byType: Record<string, number> = {};
  const byEntity: Record<string, number> = {};

  for (const conflict of conflicts) {
    // Count by conflict type
    byType[conflict.conflict_type] = (byType[conflict.conflict_type] || 0) + 1;

    // Count by entity type
    byEntity[conflict.entity_type] = (byEntity[conflict.entity_type] || 0) + 1;
  }

  return {
    total: conflicts.length,
    by_type: byType,
    by_entity: byEntity,
  };
}

/**
 * Create conflict report
 */
export function createConflictReport(
  conflicts: ConflictResolutionResult[]
): string {
  if (conflicts.length === 0) {
    return 'No conflicts detected';
  }

  const lines: string[] = [
    `Conflict Resolution Report`,
    `Total conflicts: ${conflicts.length}`,
    ``,
  ];

  const byWinner = conflicts.reduce((acc, c) => {
    acc[c.winner] = (acc[c.winner] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  lines.push('Resolution by winner:');
  for (const [winner, count] of Object.entries(byWinner)) {
    lines.push(`  ${winner}: ${count}`);
  }

  return lines.join('\n');
}
