/**
 * CRDT (Conflict-free Replicated Data Types) Utilities
 *
 * Implements CRDT-compatible patterns for offline-first multi-device sync
 * with automatic conflict resolution.
 *
 * Requirements:
 * - ARCH-004: CRDT-Compatible Schema Design
 *
 * Strategy:
 * - Last-Write-Wins (LWW) using updated_at timestamps
 * - Version vectors for causality tracking
 * - Tombstone markers for soft deletes
 */

import type { BaseEntity, VersionVector } from '../types/database.types';

/**
 * Entity with version vector for CRDT support
 */
export type CRDTEntity = BaseEntity & { version_vector: VersionVector };

/**
 * Merge two version vectors
 * Takes the maximum value for each device
 */
export function mergeVersionVectors(
  v1: VersionVector,
  v2: VersionVector
): VersionVector {
  const merged: VersionVector = { ...v1 };

  for (const [deviceId, clock] of Object.entries(v2)) {
    merged[deviceId] = Math.max(merged[deviceId] || 0, clock);
  }

  return merged;
}

/**
 * Increment version vector for a device
 */
export function incrementVersionVector(
  versionVector: VersionVector,
  deviceId: string
): VersionVector {
  return {
    ...versionVector,
    [deviceId]: (versionVector[deviceId] || 0) + 1,
  };
}

/**
 * Compare two version vectors to determine causality
 *
 * Returns:
 * - "equal": Vectors are identical
 * - "before": v1 happened before v2
 * - "after": v1 happened after v2
 * - "concurrent": Vectors are concurrent (conflict)
 */
export function compareVersionVectors(
  v1: VersionVector,
  v2: VersionVector
): 'equal' | 'before' | 'after' | 'concurrent' {
  const allDevices = new Set([...Object.keys(v1), ...Object.keys(v2)]);

  let v1Greater = false;
  let v2Greater = false;

  for (const deviceId of allDevices) {
    const clock1 = v1[deviceId] || 0;
    const clock2 = v2[deviceId] || 0;

    if (clock1 > clock2) {
      v1Greater = true;
    } else if (clock2 > clock1) {
      v2Greater = true;
    }
  }

  if (!v1Greater && !v2Greater) {
    return 'equal';
  } else if (v1Greater && !v2Greater) {
    return 'after';
  } else if (v2Greater && !v1Greater) {
    return 'before';
  } else {
    return 'concurrent';
  }
}

/**
 * Resolve conflict between two entities using Last-Write-Wins (LWW)
 *
 * Resolution strategy:
 * 1. If one entity is deleted (tombstone), prefer the non-deleted one unless the deletion is newer
 * 2. If both are deleted, prefer the one with the later deleted_at timestamp
 * 3. If neither is deleted, prefer the one with the later updated_at timestamp
 * 4. If timestamps are equal, use version vector comparison
 * 5. If still equal, use ID comparison (deterministic tie-breaker)
 */
export function resolveConflict<T extends CRDTEntity>(
  local: T,
  remote: T
): T {
  // Check for deletion (tombstone)
  const localDeleted = local.deleted_at !== null;
  const remoteDeleted = remote.deleted_at !== null;

  if (localDeleted && !remoteDeleted) {
    // Local is deleted, remote is not
    // Prefer the deletion if it's newer than the remote update
    if (local.deleted_at! > remote.updated_at) {
      return local;
    } else {
      return remote;
    }
  }

  if (!localDeleted && remoteDeleted) {
    // Remote is deleted, local is not
    // Prefer the deletion if it's newer than the local update
    if (remote.deleted_at! > local.updated_at) {
      return remote;
    } else {
      return local;
    }
  }

  if (localDeleted && remoteDeleted) {
    // Both are deleted, prefer the one with the later deletion
    if (local.deleted_at! > remote.deleted_at!) {
      return local;
    } else if (remote.deleted_at! > local.deleted_at!) {
      return remote;
    }
    // If equal, fall through to version vector comparison
  }

  // Neither is deleted (or both deleted at same time)
  // Use Last-Write-Wins based on updated_at
  if (local.updated_at > remote.updated_at) {
    return local;
  } else if (remote.updated_at > local.updated_at) {
    return remote;
  }

  // Timestamps are equal, use version vector
  const vectorComparison = compareVersionVectors(
    local.version_vector,
    remote.version_vector
  );

  if (vectorComparison === 'after') {
    return local;
  } else if (vectorComparison === 'before') {
    return remote;
  }

  // Version vectors are equal or concurrent, use ID as deterministic tie-breaker
  // This ensures all clients make the same decision
  if (local.id > remote.id) {
    return local;
  } else {
    return remote;
  }
}

/**
 * Merge two entities, combining their version vectors
 * Used after conflict resolution to create a merged entity
 */
export function mergeEntities<T extends CRDTEntity>(
  winner: T,
  loser: T
): T {
  return {
    ...winner,
    version_vector: mergeVersionVectors(
      winner.version_vector,
      loser.version_vector
    ),
  };
}

/**
 * Detect conflicts in a list of entities
 * Returns pairs of conflicting entities
 */
export function detectConflicts<T extends CRDTEntity>(
  entities: T[]
): Array<[T, T]> {
  const conflicts: Array<[T, T]> = [];
  const byId = new Map<string, T[]>();

  // Group entities by ID
  for (const entity of entities) {
    const existing = byId.get(entity.id) || [];
    existing.push(entity);
    byId.set(entity.id, existing);
  }

  // Find conflicts (multiple versions of same ID)
  for (const [_id, versions] of byId.entries()) {
    if (versions.length > 1) {
      // Compare all pairs
      for (let i = 0; i < versions.length; i++) {
        for (let j = i + 1; j < versions.length; j++) {
          const versionI = versions[i];
          const versionJ = versions[j];
          if (versionI && versionJ) {
            const comparison = compareVersionVectors(
              versionI.version_vector,
              versionJ.version_vector
            );
            if (comparison === 'concurrent') {
              conflicts.push([versionI, versionJ]);
            }
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Resolve all conflicts in a list of entities
 * Returns deduplicated list with conflicts resolved
 */
export function resolveAllConflicts<T extends CRDTEntity>(
  entities: T[]
): T[] {
  const byId = new Map<string, T>();

  for (const entity of entities) {
    const existing = byId.get(entity.id);

    if (!existing) {
      byId.set(entity.id, entity);
    } else {
      const winner = resolveConflict(existing, entity);
      const loser = winner === existing ? entity : existing;
      const merged = mergeEntities(winner, loser);
      byId.set(entity.id, merged);
    }
  }

  return Array.from(byId.values());
}

/**
 * Check if an entity should be included in queries
 * (i.e., not deleted or deleted after the query cutoff time)
 */
export function isActive(entity: BaseEntity, queryTime?: number): boolean {
  if (entity.deleted_at === null) {
    return true;
  }

  if (queryTime !== undefined && entity.deleted_at > queryTime) {
    // Entity was deleted after the query time, so it was active at query time
    return true;
  }

  return false;
}

/**
 * Create a tombstone (soft delete) for an entity
 */
export function createTombstone<T extends CRDTEntity>(
  entity: T,
  deviceId: string
): T {
  const now = Date.now();

  return {
    ...entity,
    deleted_at: now,
    updated_at: now,
    version_vector: incrementVersionVector(entity.version_vector, deviceId),
  };
}

/**
 * Restore an entity from tombstone
 */
export function restoreFromTombstone<T extends CRDTEntity>(
  entity: T,
  deviceId: string
): T {
  const now = Date.now();

  return {
    ...entity,
    deleted_at: null,
    updated_at: now,
    version_vector: incrementVersionVector(entity.version_vector, deviceId),
  };
}

/**
 * Update an entity's timestamp and version vector
 * Note: ID should never be changed through updates
 */
export function updateEntity<T extends CRDTEntity>(
  entity: T,
  updates: Partial<T>,
  deviceId: string
): T {
  const now = Date.now();

  // Exclude 'id' from updates to prevent changing entity identity
  const { id: _ignoredId, ...safeUpdates } = updates;

  return {
    ...entity,
    ...safeUpdates,
    id: entity.id, // Always preserve the original ID
    updated_at: now,
    version_vector: incrementVersionVector(entity.version_vector, deviceId),
  };
}

/**
 * Generate a unique device ID for CRDT operations
 * Uses cryptographic randomness and timestamp
 */
export function generateDeviceId(): string {
  // Use cryptographic randomness for better uniqueness
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);

  // Convert random bytes to hex string
  const randomHex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Combine with timestamp for additional uniqueness
  const timestamp = Date.now().toString(36);

  // Create a hash-like ID
  const combined = `${randomHex}-${timestamp}`;
  return btoa(combined).substring(0, 32).replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Get or create device ID from localStorage
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') {
    // Server-side, generate a temporary ID
    return generateDeviceId();
  }

  const storageKey = 'graceful_books_device_id';
  let deviceId = localStorage.getItem(storageKey);

  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem(storageKey, deviceId);
  }

  return deviceId;
}

/**
 * Sync statistics
 */
export interface SyncStatistics {
  total_entities: number;
  conflicts_detected: number;
  conflicts_resolved: number;
  entities_merged: number;
  entities_created: number;
  entities_updated: number;
  entities_deleted: number;
}

/**
 * Analyze sync operation
 */
export function analyzeSyncOperation<T extends CRDTEntity>(
  localEntities: T[],
  remoteEntities: T[]
): SyncStatistics {
  const conflicts = detectConflicts([...localEntities, ...remoteEntities]);
  const merged = resolveAllConflicts([...localEntities, ...remoteEntities]);

  const localIds = new Set(localEntities.map(e => e.id));
  const remoteIds = new Set(remoteEntities.map(e => e.id));

  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const entity of merged) {
    const inLocal = localIds.has(entity.id);
    const inRemote = remoteIds.has(entity.id);

    if (!inLocal && inRemote) {
      created++;
    } else if (inLocal && inRemote) {
      updated++;
    }

    if (entity.deleted_at !== null) {
      deleted++;
    }
  }

  return {
    total_entities: merged.length,
    conflicts_detected: conflicts.length,
    conflicts_resolved: conflicts.length,
    entities_merged: merged.length,
    entities_created: created,
    entities_updated: updated,
    entities_deleted: deleted,
  };
}
