/**
 * Version Vector Utilities
 *
 * CRDT version vector operations for conflict detection and resolution.
 * All modules should use these instead of implementing their own.
 */

import { getDeviceId } from './device'

/**
 * Version vector type - maps device IDs to logical clock values
 */
export type VersionVector = Record<string, number>

/**
 * Initialize a new version vector for the current device
 *
 * @returns New version vector with current device at clock 1
 */
export function initVersionVector(): VersionVector {
  const deviceId = getDeviceId()
  return { [deviceId]: 1 }
}

/**
 * Increment version vector for current device
 *
 * @param current - Current version vector
 * @returns New version vector with incremented clock for this device
 */
export function incrementVersionVector(current: VersionVector): VersionVector {
  const deviceId = getDeviceId()
  return {
    ...current,
    [deviceId]: (current[deviceId] || 0) + 1,
  }
}

/**
 * Merge two version vectors
 *
 * Takes the maximum clock value for each device.
 *
 * @param v1 - First version vector
 * @param v2 - Second version vector
 * @returns Merged version vector
 */
export function mergeVersionVectors(
  v1: VersionVector,
  v2: VersionVector
): VersionVector {
  const merged: VersionVector = { ...v1 }

  for (const [deviceId, clock] of Object.entries(v2)) {
    merged[deviceId] = Math.max(merged[deviceId] || 0, clock)
  }

  return merged
}

/**
 * Compare two version vectors to determine causality
 *
 * @param v1 - First version vector
 * @param v2 - Second version vector
 * @returns Comparison result:
 *   - "equal": Vectors are identical
 *   - "before": v1 happened before v2
 *   - "after": v1 happened after v2
 *   - "concurrent": Vectors are concurrent (conflict)
 */
export function compareVersionVectors(
  v1: VersionVector,
  v2: VersionVector
): 'equal' | 'before' | 'after' | 'concurrent' {
  const allDevices = new Set([...Object.keys(v1), ...Object.keys(v2)])

  let v1Greater = false
  let v2Greater = false

  for (const deviceId of allDevices) {
    const clock1 = v1[deviceId] || 0
    const clock2 = v2[deviceId] || 0

    if (clock1 > clock2) {
      v1Greater = true
    } else if (clock2 > clock1) {
      v2Greater = true
    }
  }

  if (!v1Greater && !v2Greater) {
    return 'equal'
  } else if (v1Greater && !v2Greater) {
    return 'after'
  } else if (v2Greater && !v1Greater) {
    return 'before'
  } else {
    return 'concurrent'
  }
}
