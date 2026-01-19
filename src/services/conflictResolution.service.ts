/**
 * Conflict Resolution Service
 *
 * Production-ready CRDT conflict detection and resolution service.
 * Handles automatic conflict resolution, notification generation,
 * and manual resolution workflows.
 *
 * Requirements:
 * - ARCH-004: CRDT conflict resolution
 * - Group I, Item I1: Conflict detection and resolution
 */

import { nanoid } from 'nanoid';
import {
  compareVersionVectors,
  mergeVersionVectors,
  resolveConflict as baseCRDTResolve,
  mergeEntities as baseCRDTMerge,
} from '../db/crdt';
import { mergeWithStrategy, getMergeStrategy } from './crdt/entityMergeStrategies';
import { getDeviceId } from '../utils/device';
import { logger } from '../utils/logger';
import type {
  CRDTEntity,
  DetectedConflict,
  ConflictResolution,
  BatchResolutionResult,
  ConflictType,
  ConflictSeverity,
  ResolutionStrategy,
  FieldConflict,
  ManualResolutionDecision,
  ConflictMetrics,
} from '../types/crdt.types';

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Detect conflict between two entity versions
 */
export function detectConflict<T extends CRDTEntity>(
  local: T,
  remote: T,
  entityType: string
): DetectedConflict<T> | null {
  // Ensure same entity
  if (local.id !== remote.id) {
    throw new Error('Cannot detect conflict between different entities');
  }

  // Compare version vectors
  const comparison = compareVersionVectors(local.version_vector, remote.version_vector);

  // No conflict if versions are causally ordered
  if (comparison !== 'concurrent') {
    return null;
  }

  // Concurrent modification detected
  const conflictingFields = findConflictingFields(local, remote);
  const severity = determineConflictSeverity(conflictingFields, local, remote);
  const conflictType = determineConflictType(local, remote);

  const conflict: DetectedConflict<T> = {
    id: nanoid(),
    entityType,
    entityId: local.id,
    conflictType,
    severity,
    localVersion: local,
    remoteVersion: remote,
    conflictingFields,
    detectedAt: Date.now(),
    deviceId: getDeviceId(),
  };

  logger.info('Conflict detected', {
    conflictId: conflict.id,
    entityType,
    entityId: local.id,
    severity,
    conflictingFields,
  });

  return conflict;
}

/**
 * Detect conflicts in batch of entities
 */
export function detectConflictsBatch<T extends CRDTEntity>(
  localEntities: T[],
  remoteEntities: T[],
  entityType: string
): DetectedConflict<T>[] {
  const conflicts: DetectedConflict<T>[] = [];
  const remoteMap = new Map(remoteEntities.map(e => [e.id, e]));

  for (const local of localEntities) {
    const remote = remoteMap.get(local.id);
    if (remote) {
      const conflict = detectConflict(local, remote, entityType);
      if (conflict) {
        conflicts.push(conflict);
      }
    }
  }

  return conflicts;
}

/**
 * Find fields with conflicting values
 */
function findConflictingFields<T extends CRDTEntity>(local: T, remote: T): string[] {
  const conflicting: string[] = [];

  const allKeys = new Set([
    ...Object.keys(local),
    ...Object.keys(remote),
  ]);

  for (const key of allKeys) {
    // Skip CRDT metadata fields
    if (['id', 'created_at', 'updated_at', 'deleted_at', 'version_vector'].includes(key)) {
      continue;
    }

    const localValue = (local as Record<string, unknown>)[key];
    const remoteValue = (remote as Record<string, unknown>)[key];

    if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
      conflicting.push(key);
    }
  }

  return conflicting;
}

/**
 * Determine conflict type
 */
function determineConflictType<T extends CRDTEntity>(
  local: T,
  remote: T
): ConflictType {
  const localDeleted = local.deleted_at !== null;
  const remoteDeleted = remote.deleted_at !== null;

  if (localDeleted !== remoteDeleted) {
    return 'delete_update' as ConflictType;
  }

  if (localDeleted && remoteDeleted) {
    return 'concurrent_update' as ConflictType;
  }

  // Check for structural conflicts (type changes, etc.)
  const localType = (local as Record<string, unknown>).type;
  const remoteType = (remote as Record<string, unknown>).type;

  if (localType && remoteType && localType !== remoteType) {
    return 'structural_conflict' as ConflictType;
  }

  return 'concurrent_update' as ConflictType;
}

/**
 * Determine conflict severity
 */
function determineConflictSeverity<T extends CRDTEntity>(
  conflictingFields: string[],
  local: T,
  remote: T
): ConflictSeverity {
  // Critical fields that should rarely conflict
  const criticalFields = ['type', 'status', 'transaction_id', 'account_id'];
  const hasCriticalConflict = conflictingFields.some(f => criticalFields.includes(f));

  if (hasCriticalConflict) {
    return 'critical' as ConflictSeverity;
  }

  // Delete conflicts are high severity
  if (local.deleted_at !== remote.deleted_at) {
    return 'high' as ConflictSeverity;
  }

  // Multiple field conflicts are medium severity
  if (conflictingFields.length > 3) {
    return 'medium' as ConflictSeverity;
  }

  return 'low' as ConflictSeverity;
}

// ============================================================================
// Automatic Conflict Resolution
// ============================================================================

/**
 * Automatically resolve conflict using configured strategy
 */
export function resolveConflictAuto<T extends CRDTEntity>(
  conflict: DetectedConflict<T>,
  strategy: ResolutionStrategy = 'auto_merge' as ResolutionStrategy
): ConflictResolution<T> {
  const { localVersion, remoteVersion, entityType } = conflict;

  let resolvedEntity: T;
  let winner: 'local' | 'remote' | 'merged';
  let mergedFields: string[] = [];

  switch (strategy) {
    case 'auto_lww' as ResolutionStrategy: {
      // Use base CRDT LWW resolution
      const lwwWinner = baseCRDTResolve(localVersion, remoteVersion);
      resolvedEntity = baseCRDTMerge(lwwWinner, lwwWinner === localVersion ? remoteVersion : localVersion);
      winner = lwwWinner === localVersion ? 'local' : 'remote';
      break;
    }

    case 'auto_merge' as ResolutionStrategy: {
      // Use entity-specific merge strategy
      resolvedEntity = mergeWithStrategy(localVersion, remoteVersion, entityType);
      mergedFields = conflict.conflictingFields;
      winner = 'merged';
      break;
    }

    case 'local_wins' as ResolutionStrategy: {
      resolvedEntity = baseCRDTMerge(localVersion, remoteVersion);
      winner = 'local';
      break;
    }

    case 'remote_wins' as ResolutionStrategy: {
      resolvedEntity = baseCRDTMerge(remoteVersion, localVersion);
      winner = 'remote';
      break;
    }

    default: {
      // Fallback to LWW
      const lwwWinner = baseCRDTResolve(localVersion, remoteVersion);
      resolvedEntity = baseCRDTMerge(lwwWinner, lwwWinner === localVersion ? remoteVersion : localVersion);
      winner = lwwWinner === localVersion ? 'local' : 'remote';
    }
  }

  // Ensure version vector is merged
  resolvedEntity.version_vector = mergeVersionVectors(
    localVersion.version_vector,
    remoteVersion.version_vector
  );

  const resolution: ConflictResolution<T> = {
    conflictId: conflict.id,
    resolvedEntity,
    strategy,
    winner,
    mergedFields,
    resolvedAt: Date.now(),
  };

  logger.info('Conflict auto-resolved', {
    conflictId: conflict.id,
    strategy,
    winner,
    mergedFields: mergedFields.length,
  });

  return resolution;
}

/**
 * Resolve multiple conflicts in batch
 */
export function resolveConflictsBatch<T extends CRDTEntity>(
  conflicts: DetectedConflict<T>[],
  strategy: ResolutionStrategy = 'auto_merge' as ResolutionStrategy
): BatchResolutionResult<T> {
  const resolved: ConflictResolution<T>[] = [];
  const unresolved: DetectedConflict<T>[] = [];

  const stats = {
    autoResolved: 0,
    manuallyResolved: 0,
    localWins: 0,
    remoteWins: 0,
    merged: 0,
  };

  for (const conflict of conflicts) {
    // Skip critical conflicts that require manual resolution
    if (conflict.severity === ('critical' as ConflictSeverity) && strategy === ('manual' as ResolutionStrategy)) {
      unresolved.push(conflict);
      continue;
    }

    try {
      const resolution = resolveConflictAuto(conflict, strategy);
      resolved.push(resolution);

      stats.autoResolved++;
      if (resolution.winner === 'local') stats.localWins++;
      else if (resolution.winner === 'remote') stats.remoteWins++;
      else if (resolution.winner === 'merged') stats.merged++;
    } catch (error) {
      logger.error('Failed to auto-resolve conflict', {
        conflictId: conflict.id,
        error: error instanceof Error ? error.message : String(error),
      });
      unresolved.push(conflict);
    }
  }

  return {
    totalConflicts: conflicts.length,
    resolved,
    unresolved,
    stats,
  };
}

// ============================================================================
// Manual Conflict Resolution
// ============================================================================

/**
 * Apply manual resolution decision
 */
export function applyManualResolution<T extends CRDTEntity>(
  conflict: DetectedConflict<T>,
  decision: ManualResolutionDecision
): ConflictResolution<T> {
  const { localVersion, remoteVersion } = conflict;
  let resolvedEntity: T;
  let winner: 'local' | 'remote' | 'merged' | 'manual';

  switch (decision.strategy) {
    case 'keep_local':
      resolvedEntity = baseCRDTMerge(localVersion, remoteVersion);
      winner = 'local';
      break;

    case 'keep_remote':
      resolvedEntity = baseCRDTMerge(remoteVersion, localVersion);
      winner = 'remote';
      break;

    case 'custom_merge': {
      // Apply custom field-level merge
      resolvedEntity = { ...localVersion };

      if (decision.customMerge) {
        for (const [fieldName, value] of Object.entries(decision.customMerge)) {
          (resolvedEntity as Record<string, unknown>)[fieldName] = value;
        }
      }

      // Merge version vectors
      resolvedEntity.version_vector = mergeVersionVectors(
        localVersion.version_vector,
        remoteVersion.version_vector
      );

      winner = 'manual';
      break;
    }

    default:
      throw new Error(`Unknown manual resolution strategy: ${decision.strategy}`);
  }

  const resolution: ConflictResolution<T> = {
    conflictId: conflict.id,
    resolvedEntity,
    strategy: 'manual' as ResolutionStrategy,
    winner,
    mergedFields: decision.customMerge ? Object.keys(decision.customMerge) : [],
    resolvedAt: Date.now(),
    resolvedBy: decision.resolvedBy,
    resolutionNotes: decision.notes,
  };

  logger.info('Conflict manually resolved', {
    conflictId: conflict.id,
    resolvedBy: decision.resolvedBy,
    strategy: decision.strategy,
  });

  return resolution;
}

/**
 * Get field-level conflict details for manual resolution UI
 */
export function getFieldConflicts<T extends CRDTEntity>(
  conflict: DetectedConflict<T>
): FieldConflict[] {
  const { localVersion, remoteVersion, conflictingFields, entityType } = conflict;
  const fieldConflicts: FieldConflict[] = [];

  const strategy = getMergeStrategy(entityType);

  for (const fieldName of conflictingFields) {
    const localValue = (localVersion as Record<string, unknown>)[fieldName];
    const remoteValue = (remoteVersion as Record<string, unknown>)[fieldName];

    const fieldStrategy = strategy?.fieldStrategies[fieldName];
    const canAutoResolve = fieldStrategy ? fieldStrategy.strategy !== 'custom' : true;

    // Generate suggested resolution
    let suggestedResolution: unknown = undefined;
    if (canAutoResolve && fieldStrategy) {
      // Suggest based on strategy
      if (fieldStrategy.strategy === 'lww') {
        suggestedResolution =
          localVersion.updated_at >= remoteVersion.updated_at ? localValue : remoteValue;
      } else if (fieldStrategy.strategy === 'union' && Array.isArray(localValue) && Array.isArray(remoteValue)) {
        suggestedResolution = [...new Set([...localValue, ...remoteValue])];
      }
    }

    fieldConflicts.push({
      fieldName,
      localValue,
      remoteValue,
      canAutoResolve,
      suggestedResolution,
    });
  }

  return fieldConflicts;
}

// ============================================================================
// Metrics & Reporting
// ============================================================================

/**
 * Calculate conflict resolution metrics
 */
export function calculateMetrics(
  conflicts: DetectedConflict[],
  resolutions: ConflictResolution[]
): ConflictMetrics {
  const conflictsByType: Record<ConflictType, number> = {
    concurrent_update: 0,
    delete_update: 0,
    field_conflict: 0,
    structural_conflict: 0,
  };

  const conflictsBySeverity: Record<ConflictSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  for (const conflict of conflicts) {
    conflictsByType[conflict.conflictType]++;
    conflictsBySeverity[conflict.severity]++;
  }

  const resolutionTimes = resolutions
    .filter(r => r.resolvedAt && conflicts.find(c => c.id === r.conflictId)?.detectedAt)
    .map(r => {
      const conflict = conflicts.find(c => c.id === r.conflictId);
      return r.resolvedAt - (conflict?.detectedAt || 0);
    });

  const averageResolutionTimeMs =
    resolutionTimes.length > 0
      ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
      : 0;

  const autoResolved = resolutions.filter(
    r => r.strategy !== ('manual' as ResolutionStrategy)
  ).length;
  const manuallyResolved = resolutions.filter(
    r => r.strategy === ('manual' as ResolutionStrategy)
  ).length;

  return {
    totalConflictsDetected: conflicts.length,
    totalConflictsResolved: resolutions.length,
    averageResolutionTimeMs,
    conflictsByType,
    conflictsBySeverity,
    autoResolveSuccessRate: conflicts.length > 0 ? autoResolved / conflicts.length : 0,
    manualResolutionRate: conflicts.length > 0 ? manuallyResolved / conflicts.length : 0,
    dataLossIncidents: 0, // We track this separately
  };
}

/**
 * Validate resolution maintains data integrity
 */
export function validateResolution<T extends CRDTEntity>(
  resolution: ConflictResolution<T>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!resolution.resolvedEntity) {
    errors.push('Resolved entity is missing');
  }

  if (!resolution.resolvedEntity.id) {
    errors.push('Resolved entity missing ID');
  }

  if (!resolution.resolvedEntity.version_vector) {
    errors.push('Resolved entity missing version vector');
  }

  if (typeof resolution.resolvedEntity.updated_at !== 'number') {
    errors.push('Resolved entity missing or invalid updated_at timestamp');
  }

  // Ensure version vector was properly merged
  if (resolution.resolvedEntity.version_vector) {
    const devices = Object.keys(resolution.resolvedEntity.version_vector);
    if (devices.length === 0) {
      errors.push('Resolved entity version vector is empty');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
