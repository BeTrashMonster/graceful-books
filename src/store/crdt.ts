/**
 * CRDT Operations and Conflict Resolution
 *
 * Implements Conflict-free Replicated Data Types for offline-first sync:
 * - Version vector comparison
 * - Last-write-wins (LWW) merge strategy
 * - Tombstone handling for deletions
 * - Conflict detection and resolution
 */

import type {
  CRDTEntity,
  VersionVector,
  ConflictStrategy,
  MergeResult,
  ConflictInfo,
} from './types'

/**
 * Compare two version vectors
 * Returns:
 * - 'greater': local is newer (has changes remote doesn't have)
 * - 'less': remote is newer (has changes local doesn't have)
 * - 'equal': both are equal (no changes)
 * - 'concurrent': both have independent changes (conflict)
 */
export function compareVersionVectors(
  local: VersionVector,
  remote: VersionVector
): 'greater' | 'less' | 'equal' | 'concurrent' {
  const localDevices = new Set(Object.keys(local))
  const remoteDevices = new Set(Object.keys(remote))
  const allDevices = new Set([...localDevices, ...remoteDevices])

  let localGreater = false
  let remoteGreater = false

  for (const deviceId of allDevices) {
    const localVersion = local[deviceId] || 0
    const remoteVersion = remote[deviceId] || 0

    if (localVersion > remoteVersion) {
      localGreater = true
    } else if (remoteVersion > localVersion) {
      remoteGreater = true
    }
  }

  if (!localGreater && !remoteGreater) {
    return 'equal'
  } else if (localGreater && !remoteGreater) {
    return 'greater'
  } else if (!localGreater && remoteGreater) {
    return 'less'
  } else {
    return 'concurrent'
  }
}

/**
 * Merge two version vectors (takes the maximum version for each device)
 */
export function mergeVersionVectors(
  local: VersionVector,
  remote: VersionVector
): VersionVector {
  const merged: VersionVector = { ...local }

  for (const [deviceId, version] of Object.entries(remote)) {
    merged[deviceId] = Math.max(merged[deviceId] || 0, version)
  }

  return merged
}

/**
 * Detect conflicts between two entities
 * Returns array of fields that have conflicts
 */
export function detectConflicts<T extends CRDTEntity>(
  local: T,
  remote: T
): string[] {
  const conflicts: string[] = []

  // Compare version vectors
  const comparison = compareVersionVectors(local.versionVector, remote.versionVector)

  // Only concurrent changes can have conflicts
  if (comparison !== 'concurrent') {
    return []
  }

  // Check each field for differences
  for (const key of Object.keys(local) as Array<keyof T>) {
    // Skip CRDT metadata fields
    if (
      key === 'versionVector' ||
      key === 'lastModifiedBy' ||
      key === 'lastModifiedAt' ||
      key === 'deletedAt' ||
      key === '_encrypted'
    ) {
      continue
    }

    // Deep comparison for objects
    if (JSON.stringify(local[key]) !== JSON.stringify(remote[key])) {
      conflicts.push(key as string)
    }
  }

  return conflicts
}

/**
 * Resolve conflict using Last-Write-Wins (LWW) strategy
 * The entity with the later timestamp wins
 */
export function resolveLastWriteWins<T extends CRDTEntity>(
  local: T,
  remote: T
): T {
  // Compare timestamps
  const localTime = local.lastModifiedAt.getTime()
  const remoteTime = remote.lastModifiedAt.getTime()

  if (remoteTime > localTime) {
    // Remote wins - return remote with merged version vector
    return {
      ...remote,
      versionVector: mergeVersionVectors(local.versionVector, remote.versionVector),
    }
  } else if (localTime > remoteTime) {
    // Local wins - return local with merged version vector
    return {
      ...local,
      versionVector: mergeVersionVectors(local.versionVector, remote.versionVector),
    }
  } else {
    // Same timestamp - use device ID as tiebreaker (lexicographic order)
    const winner = local.lastModifiedBy > remote.lastModifiedBy ? local : remote
    return {
      ...winner,
      versionVector: mergeVersionVectors(local.versionVector, remote.versionVector),
    }
  }
}

/**
 * Merge two entities with conflict detection
 * Returns the merged entity and list of conflicts (if any)
 */
export function mergeEntities<T extends CRDTEntity>(
  local: T,
  remote: T,
  strategy: ConflictStrategy = 'last-write-wins'
): MergeResult<T> {
  const conflicts: ConflictInfo[] = []

  // Check for deletions (tombstones)
  if (remote.deletedAt && !local.deletedAt) {
    // Remote was deleted - apply tombstone
    return {
      merged: {
        ...local,
        deletedAt: remote.deletedAt,
        versionVector: mergeVersionVectors(local.versionVector, remote.versionVector),
        lastModifiedAt: remote.lastModifiedAt,
        lastModifiedBy: remote.lastModifiedBy,
      },
      conflicts: [],
    }
  }

  if (local.deletedAt && !remote.deletedAt) {
    // Local was deleted - keep tombstone
    return {
      merged: {
        ...remote,
        deletedAt: local.deletedAt,
        versionVector: mergeVersionVectors(local.versionVector, remote.versionVector),
        lastModifiedAt: local.lastModifiedAt,
        lastModifiedBy: local.lastModifiedBy,
      },
      conflicts: [],
    }
  }

  if (local.deletedAt && remote.deletedAt) {
    // Both deleted - use the earlier deletion time
    const earlierDeletion = local.deletedAt < remote.deletedAt ? local.deletedAt : remote.deletedAt
    return {
      merged: {
        ...local,
        deletedAt: earlierDeletion,
        versionVector: mergeVersionVectors(local.versionVector, remote.versionVector),
      },
      conflicts: [],
    }
  }

  // Compare version vectors
  const comparison = compareVersionVectors(local.versionVector, remote.versionVector)

  // No conflict - one is clearly newer
  if (comparison === 'equal') {
    return { merged: local, conflicts: [] }
  }

  if (comparison === 'greater') {
    // Local is newer - keep local
    return {
      merged: {
        ...local,
        versionVector: mergeVersionVectors(local.versionVector, remote.versionVector),
      },
      conflicts: [],
    }
  }

  if (comparison === 'less') {
    // Remote is newer - use remote
    return {
      merged: {
        ...remote,
        versionVector: mergeVersionVectors(local.versionVector, remote.versionVector),
      },
      conflicts: [],
    }
  }

  // Concurrent changes - need conflict resolution
  const conflictFields = detectConflicts(local, remote)

  if (strategy === 'last-write-wins') {
    const merged = resolveLastWriteWins(local, remote)

    // Record conflicts for audit
    for (const field of conflictFields) {
      conflicts.push({
        field,
        localValue: local[field as keyof T],
        remoteValue: remote[field as keyof T],
        resolvedValue: merged[field as keyof T],
        strategy: 'last-write-wins',
      })
    }

    return { merged, conflicts }
  }

  if (strategy === 'manual') {
    // For manual resolution, return local with conflict info
    for (const field of conflictFields) {
      conflicts.push({
        field,
        localValue: local[field as keyof T],
        remoteValue: remote[field as keyof T],
        resolvedValue: local[field as keyof T],
        strategy: 'manual',
      })
    }

    return {
      merged: {
        ...local,
        versionVector: mergeVersionVectors(local.versionVector, remote.versionVector),
      },
      conflicts,
    }
  }

  // Default: use last-write-wins
  return {
    merged: resolveLastWriteWins(local, remote),
    conflicts,
  }
}

/**
 * Batch merge multiple entities
 * Useful for syncing a collection of entities
 */
export function batchMergeEntities<T extends CRDTEntity & { id: string }>(
  local: T[],
  remote: T[],
  strategy: ConflictStrategy = 'last-write-wins'
): {
  merged: T[]
  conflicts: Array<{ entityId: string; conflicts: ConflictInfo[] }>
} {
  const localMap = new Map(local.map((entity) => [entity.id, entity]))
  const remoteMap = new Map(remote.map((entity) => [entity.id, entity]))
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])

  const merged: T[] = []
  const allConflicts: Array<{ entityId: string; conflicts: ConflictInfo[] }> = []

  for (const id of allIds) {
    const localEntity = localMap.get(id)
    const remoteEntity = remoteMap.get(id)

    if (!localEntity && remoteEntity) {
      // New remote entity
      merged.push(remoteEntity)
    } else if (localEntity && !remoteEntity) {
      // New local entity
      merged.push(localEntity)
    } else if (localEntity && remoteEntity) {
      // Merge both
      const result = mergeEntities(localEntity, remoteEntity, strategy)
      merged.push(result.merged)

      if (result.conflicts.length > 0) {
        allConflicts.push({
          entityId: id,
          conflicts: result.conflicts,
        })
      }
    }
  }

  return { merged, conflicts: allConflicts }
}

/**
 * Check if an entity should be synced (has local changes)
 */
export function hasLocalChanges(entity: CRDTEntity, deviceId: string): boolean {
  return entity.lastModifiedBy === deviceId
}

/**
 * Get the latest version number for a device from version vector
 */
export function getDeviceVersion(versionVector: VersionVector, deviceId: string): number {
  return versionVector[deviceId] || 0
}

/**
 * Create a version vector for initial sync
 */
export function createInitialVersionVector(deviceId: string): VersionVector {
  return { [deviceId]: 1 }
}

/**
 * Check if entity is tombstoned (soft deleted)
 */
export function isTombstoned(entity: CRDTEntity): boolean {
  return entity.deletedAt !== undefined
}

/**
 * Filter out tombstoned entities older than a threshold
 * Useful for garbage collection
 */
export function filterOldTombstones<T extends CRDTEntity>(
  entities: T[],
  thresholdDays: number = 90
): T[] {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - thresholdDays)

  return entities.filter((entity) => {
    if (!entity.deletedAt) {
      return true // Not deleted
    }
    return entity.deletedAt > threshold // Keep recent tombstones
  })
}

/**
 * Merge field-level conflicts using different strategies
 */
export function mergeField<T>(
  _field: string,
  localValue: T,
  remoteValue: T,
  localTime: Date,
  remoteTime: Date,
  strategy: ConflictStrategy
): { value: T; conflict: boolean } {
  // If values are the same, no conflict
  if (JSON.stringify(localValue) === JSON.stringify(remoteValue)) {
    return { value: localValue, conflict: false }
  }

  if (strategy === 'last-write-wins') {
    // Use timestamp to determine winner
    if (remoteTime > localTime) {
      return { value: remoteValue, conflict: true }
    } else {
      return { value: localValue, conflict: true }
    }
  }

  if (strategy === 'manual') {
    // Keep local value but mark as conflict
    return { value: localValue, conflict: true }
  }

  // Default: last-write-wins
  return {
    value: remoteTime > localTime ? remoteValue : localValue,
    conflict: true,
  }
}

/**
 * Calculate sync priority for entities
 * Higher priority = sync first
 */
export function calculateSyncPriority(entity: CRDTEntity): number {
  let priority = 0

  // Recent changes get higher priority
  const ageInHours = (Date.now() - entity.lastModifiedAt.getTime()) / (1000 * 60 * 60)
  priority += Math.max(0, 100 - ageInHours)

  // Deletions get higher priority (to propagate tombstones)
  if (entity.deletedAt) {
    priority += 50
  }

  return priority
}

/**
 * Sort entities by sync priority
 */
export function sortBySyncPriority<T extends CRDTEntity>(entities: T[]): T[] {
  return [...entities].sort((a, b) => {
    return calculateSyncPriority(b) - calculateSyncPriority(a)
  })
}
