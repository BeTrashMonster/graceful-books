/**
 * CRDT Conflict Resolution Tests
 *
 * Comprehensive tests for conflict detection and resolution.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  SyncCRDT,
  createSyncCRDT,
  ConflictStatus,
  type VersionVector,
  type VersionedRecord,
  type ChangeMetadata,
} from './SyncCRDT'

// Helper to create test version vector
function createVersionVector(versions: Record<string, number>): VersionVector {
  return versions
}

// Helper to create test metadata
function createMetadata(
  deviceId: string,
  timestamp: number,
  versionVector: VersionVector,
  userId: string = 'user-123'
): ChangeMetadata {
  return {
    deviceId,
    timestamp,
    versionVector,
    userId,
  }
}

// Helper to create test record
function createRecord<T>(
  id: string,
  data: T,
  metadata: ChangeMetadata
): VersionedRecord<T> {
  return {
    id,
    data,
    metadata,
  }
}

describe('SyncCRDT', () => {
  let crdt: SyncCRDT

  beforeEach(() => {
    crdt = new SyncCRDT()
  })

  describe('compareVersionVectors', () => {
    it('should return 0 for identical vectors', () => {
      const v1 = createVersionVector({ 'device-a': 5, 'device-b': 3 })
      const v2 = createVersionVector({ 'device-a': 5, 'device-b': 3 })

      const result = crdt.compareVersionVectors(v1, v2)
      expect(result).toBe(0)
    })

    it('should return 1 when v1 > v2', () => {
      const v1 = createVersionVector({ 'device-a': 5, 'device-b': 3 })
      const v2 = createVersionVector({ 'device-a': 4, 'device-b': 3 })

      const result = crdt.compareVersionVectors(v1, v2)
      expect(result).toBe(1)
    })

    it('should return -1 when v1 < v2', () => {
      const v1 = createVersionVector({ 'device-a': 3, 'device-b': 2 })
      const v2 = createVersionVector({ 'device-a': 3, 'device-b': 5 })

      const result = crdt.compareVersionVectors(v1, v2)
      expect(result).toBe(-1)
    })

    it('should return null for concurrent vectors', () => {
      const v1 = createVersionVector({ 'device-a': 5, 'device-b': 2 })
      const v2 = createVersionVector({ 'device-a': 3, 'device-b': 6 })

      const result = crdt.compareVersionVectors(v1, v2)
      expect(result).toBeNull()
    })

    it('should handle missing devices as version 0', () => {
      const v1 = createVersionVector({ 'device-a': 5 })
      const v2 = createVersionVector({ 'device-a': 3, 'device-b': 2 })

      const result = crdt.compareVersionVectors(v1, v2)
      expect(result).toBeNull() // device-a: 5 > 3, but device-b: 0 < 2
    })

    it('should handle empty vectors', () => {
      const v1 = createVersionVector({})
      const v2 = createVersionVector({})

      const result = crdt.compareVersionVectors(v1, v2)
      expect(result).toBe(0)
    })

    it('should handle one empty vector', () => {
      const v1 = createVersionVector({ 'device-a': 5 })
      const v2 = createVersionVector({})

      const result = crdt.compareVersionVectors(v1, v2)
      expect(result).toBe(1)
    })

    it('should be transitive', () => {
      const v1 = createVersionVector({ 'device-a': 3, 'device-b': 2 })
      const v2 = createVersionVector({ 'device-a': 5, 'device-b': 4 })
      const v3 = createVersionVector({ 'device-a': 7, 'device-b': 6 })

      expect(crdt.compareVersionVectors(v1, v2)).toBe(-1)
      expect(crdt.compareVersionVectors(v2, v3)).toBe(-1)
      expect(crdt.compareVersionVectors(v1, v3)).toBe(-1)
    })
  })

  describe('detectConflict', () => {
    it('should detect IDENTICAL status for same version and data', () => {
      const data = { name: 'Test', value: 123 }
      const versionVector = createVersionVector({ 'device-a': 5 })
      const metadata = createMetadata('device-a', 1000, versionVector)

      const local = createRecord('record-1', data, metadata)
      const remote = createRecord('record-1', data, metadata)

      const status = crdt.detectConflict(local, remote)
      expect(status).toBe(ConflictStatus.IDENTICAL)
    })

    it('should detect LOCAL_WINS when local is newer', () => {
      const vLocal = createVersionVector({ 'device-a': 5, 'device-b': 3 })
      const vRemote = createVersionVector({ 'device-a': 4, 'device-b': 3 })

      const local = createRecord(
        'record-1',
        { name: 'Local' },
        createMetadata('device-a', 2000, vLocal)
      )
      const remote = createRecord(
        'record-1',
        { name: 'Remote' },
        createMetadata('device-b', 1000, vRemote)
      )

      const status = crdt.detectConflict(local, remote)
      expect(status).toBe(ConflictStatus.LOCAL_WINS)
    })

    it('should detect REMOTE_WINS when remote is newer', () => {
      const vLocal = createVersionVector({ 'device-a': 3, 'device-b': 2 })
      const vRemote = createVersionVector({ 'device-a': 3, 'device-b': 5 })

      const local = createRecord(
        'record-1',
        { name: 'Local' },
        createMetadata('device-a', 1000, vLocal)
      )
      const remote = createRecord(
        'record-1',
        { name: 'Remote' },
        createMetadata('device-b', 2000, vRemote)
      )

      const status = crdt.detectConflict(local, remote)
      expect(status).toBe(ConflictStatus.REMOTE_WINS)
    })

    it('should detect CONFLICT for concurrent modifications', () => {
      const vLocal = createVersionVector({ 'device-a': 5, 'device-b': 2 })
      const vRemote = createVersionVector({ 'device-a': 3, 'device-b': 6 })

      const local = createRecord(
        'record-1',
        { name: 'Local' },
        createMetadata('device-a', 2000, vLocal)
      )
      const remote = createRecord(
        'record-1',
        { name: 'Remote' },
        createMetadata('device-b', 2000, vRemote)
      )

      const status = crdt.detectConflict(local, remote)
      expect(status).toBe(ConflictStatus.CONFLICT)
    })

    it('should detect CONFLICT when same version but different data', () => {
      const versionVector = createVersionVector({ 'device-a': 5 })

      const local = createRecord(
        'record-1',
        { name: 'Local' },
        createMetadata('device-a', 1000, versionVector)
      )
      const remote = createRecord(
        'record-1',
        { name: 'Remote' },
        createMetadata('device-a', 1000, versionVector)
      )

      const status = crdt.detectConflict(local, remote)
      expect(status).toBe(ConflictStatus.CONFLICT)
    })
  })

  describe('resolveLastWriteWins', () => {
    it('should pick record with later timestamp', () => {
      const versionVector = createVersionVector({ 'device-a': 5 })

      const local = createRecord(
        'record-1',
        { name: 'Local' },
        createMetadata('device-a', 1000, versionVector)
      )
      const remote = createRecord(
        'record-1',
        { name: 'Remote' },
        createMetadata('device-b', 2000, versionVector)
      )

      const winner = crdt.resolveLastWriteWins(local, remote)
      expect(winner).toBe(remote)
      expect(winner.data.name).toBe('Remote')
    })

    it('should tie-break by deviceId when timestamps are equal', () => {
      const versionVector = createVersionVector({ 'device-a': 5 })

      const local = createRecord(
        'record-1',
        { name: 'Local' },
        createMetadata('device-b', 2000, versionVector)
      )
      const remote = createRecord(
        'record-1',
        { name: 'Remote' },
        createMetadata('device-a', 2000, versionVector)
      )

      const winner = crdt.resolveLastWriteWins(local, remote)
      // device-b > device-a lexicographically
      expect(winner).toBe(local)
      expect(winner.data.name).toBe('Local')
    })

    it('should be deterministic for same inputs', () => {
      const versionVector = createVersionVector({ 'device-a': 5 })

      const local = createRecord(
        'record-1',
        { name: 'Local' },
        createMetadata('device-a', 2000, versionVector)
      )
      const remote = createRecord(
        'record-1',
        { name: 'Remote' },
        createMetadata('device-b', 2000, versionVector)
      )

      const winner1 = crdt.resolveLastWriteWins(local, remote)
      const winner2 = crdt.resolveLastWriteWins(local, remote)
      expect(winner1).toBe(winner2)
    })

    it('should be commutative (order independent)', () => {
      const versionVector = createVersionVector({ 'device-a': 5 })

      const local = createRecord(
        'record-1',
        { name: 'Local' },
        createMetadata('device-a', 2000, versionVector)
      )
      const remote = createRecord(
        'record-1',
        { name: 'Remote' },
        createMetadata('device-b', 2000, versionVector)
      )

      const winner1 = crdt.resolveLastWriteWins(local, remote)
      const winner2 = crdt.resolveLastWriteWins(remote, local)
      expect(winner1.metadata.deviceId).toBe(winner2.metadata.deviceId)
    })
  })

  describe('mergeVersionVectors', () => {
    it('should take maximum version for each device', () => {
      const v1 = createVersionVector({ 'device-a': 5, 'device-b': 2 })
      const v2 = createVersionVector({ 'device-a': 3, 'device-b': 6 })

      const merged = crdt.mergeVersionVectors(v1, v2)

      expect(merged['device-a']).toBe(5)
      expect(merged['device-b']).toBe(6)
    })

    it('should include devices from both vectors', () => {
      const v1 = createVersionVector({ 'device-a': 5 })
      const v2 = createVersionVector({ 'device-b': 3 })

      const merged = crdt.mergeVersionVectors(v1, v2)

      expect(merged['device-a']).toBe(5)
      expect(merged['device-b']).toBe(3)
    })

    it('should handle empty vectors', () => {
      const v1 = createVersionVector({ 'device-a': 5 })
      const v2 = createVersionVector({})

      const merged = crdt.mergeVersionVectors(v1, v2)

      expect(merged['device-a']).toBe(5)
    })

    it('should be commutative', () => {
      const v1 = createVersionVector({ 'device-a': 5, 'device-b': 2 })
      const v2 = createVersionVector({ 'device-a': 3, 'device-b': 6 })

      const merged1 = crdt.mergeVersionVectors(v1, v2)
      const merged2 = crdt.mergeVersionVectors(v2, v1)

      expect(merged1).toEqual(merged2)
    })

    it('should be idempotent', () => {
      const v1 = createVersionVector({ 'device-a': 5, 'device-b': 3 })

      const merged = crdt.mergeVersionVectors(v1, v1)

      expect(merged).toEqual(v1)
    })
  })

  describe('mergeFields', () => {
    it('should use LWW winner data', () => {
      const vLocal = createVersionVector({ 'device-a': 5 })
      const vRemote = createVersionVector({ 'device-b': 3 })

      const local = createRecord(
        'record-1',
        { name: 'Local', value: 100 },
        createMetadata('device-a', 2000, vLocal)
      )
      const remote = createRecord(
        'record-1',
        { name: 'Remote', value: 200 },
        createMetadata('device-b', 1000, vRemote)
      )

      const merged = crdt.mergeFields(local, remote)

      expect(merged.data.name).toBe('Local') // Local won (newer timestamp)
      expect(merged.data.value).toBe(100)
    })

    it('should merge version vectors', () => {
      const vLocal = createVersionVector({ 'device-a': 5, 'device-b': 2 })
      const vRemote = createVersionVector({ 'device-a': 3, 'device-b': 6 })

      const local = createRecord(
        'record-1',
        { name: 'Local' },
        createMetadata('device-a', 2000, vLocal)
      )
      const remote = createRecord(
        'record-1',
        { name: 'Remote' },
        createMetadata('device-b', 1000, vRemote)
      )

      const merged = crdt.mergeFields(local, remote)

      expect(merged.metadata.versionVector['device-a']).toBe(5)
      expect(merged.metadata.versionVector['device-b']).toBe(6)
    })

    it('should preserve winner metadata except version vector', () => {
      const vLocal = createVersionVector({ 'device-a': 5 })
      const vRemote = createVersionVector({ 'device-b': 3 })

      const local = createRecord(
        'record-1',
        { name: 'Local' },
        createMetadata('device-a', 2000, vLocal, 'user-123')
      )
      const remote = createRecord(
        'record-1',
        { name: 'Remote' },
        createMetadata('device-b', 1000, vRemote, 'user-456')
      )

      const merged = crdt.mergeFields(local, remote)

      expect(merged.metadata.deviceId).toBe('device-a') // Local won
      expect(merged.metadata.userId).toBe('user-123')
      expect(merged.metadata.timestamp).toBe(2000)
    })
  })

  describe('resolve', () => {
    it('should return IDENTICAL for same version and data', () => {
      const data = { name: 'Test' }
      const versionVector = createVersionVector({ 'device-a': 5 })
      const metadata = createMetadata('device-a', 1000, versionVector)

      const local = createRecord('record-1', data, metadata)
      const remote = createRecord('record-1', data, metadata)

      const result = crdt.resolve(local, remote)

      expect(result.status).toBe(ConflictStatus.IDENTICAL)
      expect(result.merged).toBe(local)
    })

    it('should return LOCAL_WINS when local is newer', () => {
      const vLocal = createVersionVector({ 'device-a': 5 })
      const vRemote = createVersionVector({ 'device-a': 3 })

      const local = createRecord(
        'record-1',
        { name: 'Local' },
        createMetadata('device-a', 2000, vLocal)
      )
      const remote = createRecord(
        'record-1',
        { name: 'Remote' },
        createMetadata('device-b', 1000, vRemote)
      )

      const result = crdt.resolve(local, remote)

      expect(result.status).toBe(ConflictStatus.LOCAL_WINS)
      expect(result.merged).toBe(local)
    })

    it('should return REMOTE_WINS when remote is newer', () => {
      const vLocal = createVersionVector({ 'device-a': 3 })
      const vRemote = createVersionVector({ 'device-a': 5 })

      const local = createRecord(
        'record-1',
        { name: 'Local' },
        createMetadata('device-a', 1000, vLocal)
      )
      const remote = createRecord(
        'record-1',
        { name: 'Remote' },
        createMetadata('device-b', 2000, vRemote)
      )

      const result = crdt.resolve(local, remote)

      expect(result.status).toBe(ConflictStatus.REMOTE_WINS)
      expect(result.merged).toBe(remote)
    })

    it('should resolve conflict with last-write-wins strategy', () => {
      const vLocal = createVersionVector({ 'device-a': 5, 'device-b': 2 })
      const vRemote = createVersionVector({ 'device-a': 3, 'device-b': 6 })

      const local = createRecord(
        'record-1',
        { name: 'Local' },
        createMetadata('device-a', 2000, vLocal)
      )
      const remote = createRecord(
        'record-1',
        { name: 'Remote' },
        createMetadata('device-b', 1000, vRemote)
      )

      const result = crdt.resolve(local, remote, 'last-write-wins')

      expect(result.status).toBe(ConflictStatus.CONFLICT)
      expect(result.merged).toBeDefined()
      expect(result.merged!.data.name).toBe('Local') // Newer timestamp
      expect(result.merged!.metadata.versionVector['device-a']).toBe(5)
      expect(result.merged!.metadata.versionVector['device-b']).toBe(6)
    })

    it('should resolve conflict with field-merge strategy', () => {
      const vLocal = createVersionVector({ 'device-a': 5, 'device-b': 2 })
      const vRemote = createVersionVector({ 'device-a': 3, 'device-b': 6 })

      const local = createRecord(
        'record-1',
        { name: 'Local', value: 100 },
        createMetadata('device-a', 2000, vLocal)
      )
      const remote = createRecord(
        'record-1',
        { name: 'Remote', value: 200 },
        createMetadata('device-b', 1000, vRemote)
      )

      const result = crdt.resolve(local, remote, 'field-merge')

      expect(result.status).toBe(ConflictStatus.CONFLICT)
      expect(result.merged).toBeDefined()
      expect(result.merged!.metadata.versionVector['device-a']).toBe(5)
      expect(result.merged!.metadata.versionVector['device-b']).toBe(6)
    })

    it('should return conflict for manual strategy', () => {
      const vLocal = createVersionVector({ 'device-a': 5, 'device-b': 2 })
      const vRemote = createVersionVector({ 'device-a': 3, 'device-b': 6 })

      const local = createRecord(
        'record-1',
        { name: 'Local' },
        createMetadata('device-a', 2000, vLocal)
      )
      const remote = createRecord(
        'record-1',
        { name: 'Remote' },
        createMetadata('device-b', 1000, vRemote)
      )

      const result = crdt.resolve(local, remote, 'manual')

      expect(result.status).toBe(ConflictStatus.CONFLICT)
      expect(result.merged).toBeUndefined()
      expect(result.conflict).toBeDefined()
      expect(result.conflict!.local).toBe(local)
      expect(result.conflict!.remote).toBe(remote)
    })

    it('should throw error for mismatched record IDs', () => {
      const versionVector = createVersionVector({ 'device-a': 5 })

      const local = createRecord(
        'record-1',
        { name: 'Local' },
        createMetadata('device-a', 1000, versionVector)
      )
      const remote = createRecord(
        'record-2',
        { name: 'Remote' },
        createMetadata('device-b', 1000, versionVector)
      )

      expect(() => crdt.resolve(local, remote)).toThrow(/different IDs/)
    })
  })

  describe('incrementVersion', () => {
    it('should increment existing device version', () => {
      const vector = createVersionVector({ 'device-a': 5, 'device-b': 3 })

      const incremented = crdt.incrementVersion(vector, 'device-a')

      expect(incremented['device-a']).toBe(6)
      expect(incremented['device-b']).toBe(3)
    })

    it('should initialize new device to 1', () => {
      const vector = createVersionVector({ 'device-a': 5 })

      const incremented = crdt.incrementVersion(vector, 'device-b')

      expect(incremented['device-a']).toBe(5)
      expect(incremented['device-b']).toBe(1)
    })

    it('should not mutate original vector', () => {
      const vector = createVersionVector({ 'device-a': 5 })

      const incremented = crdt.incrementVersion(vector, 'device-a')

      expect(vector['device-a']).toBe(5)
      expect(incremented['device-a']).toBe(6)
    })
  })

  describe('createVersionVector', () => {
    it('should create vector with version 1 for device', () => {
      const vector = crdt.createVersionVector('device-a')

      expect(vector['device-a']).toBe(1)
      expect(Object.keys(vector).length).toBe(1)
    })
  })

  describe('createVersionedRecord', () => {
    it('should create record with provided version vector', () => {
      const versionVector = createVersionVector({ 'device-a': 5 })
      const data = { name: 'Test', value: 123 }

      const record = crdt.createVersionedRecord(
        'record-1',
        data,
        'device-a',
        'user-123',
        versionVector
      )

      expect(record.id).toBe('record-1')
      expect(record.data).toEqual(data)
      expect(record.metadata.deviceId).toBe('device-a')
      expect(record.metadata.userId).toBe('user-123')
      expect(record.metadata.versionVector).toEqual(versionVector)
      expect(record.metadata.timestamp).toBeGreaterThan(0)
    })

    it('should create new version vector if not provided', () => {
      const data = { name: 'Test' }

      const record = crdt.createVersionedRecord('record-1', data, 'device-a', 'user-123')

      expect(record.metadata.versionVector['device-a']).toBe(1)
      expect(Object.keys(record.metadata.versionVector).length).toBe(1)
    })

    it('should set current timestamp', () => {
      const before = Date.now()
      const data = { name: 'Test' }

      const record = crdt.createVersionedRecord('record-1', data, 'device-a', 'user-123')

      const after = Date.now()
      expect(record.metadata.timestamp).toBeGreaterThanOrEqual(before)
      expect(record.metadata.timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('createSyncCRDT factory', () => {
    it('should create CRDT instance', () => {
      const instance = createSyncCRDT()
      expect(instance).toBeInstanceOf(SyncCRDT)
    })
  })

  describe('integration scenarios', () => {
    it('should handle multi-device sequential edits', () => {
      // Device A makes first edit
      const v1 = crdt.createVersionVector('device-a')
      const r1 = crdt.createVersionedRecord('doc-1', { title: 'V1' }, 'device-a', 'user-1', v1)

      // Device A makes second edit
      const v2 = crdt.incrementVersion(v1, 'device-a')
      const r2 = crdt.createVersionedRecord('doc-1', { title: 'V2' }, 'device-a', 'user-1', v2)

      // r2 should win (newer)
      const status = crdt.detectConflict(r1, r2)
      expect(status).toBe(ConflictStatus.REMOTE_WINS)
    })

    it('should handle offline concurrent edits', () => {
      // Both devices start with same state
      const v0 = createVersionVector({ 'device-a': 5, 'device-b': 5 })

      // Device A edits offline
      const vA = crdt.incrementVersion(v0, 'device-a')
      const rA = createRecord(
        'doc-1',
        { title: 'Device A Edit' },
        createMetadata('device-a', 2000, vA)
      )

      // Device B edits offline
      const vB = crdt.incrementVersion(v0, 'device-b')
      const rB = createRecord(
        'doc-1',
        { title: 'Device B Edit' },
        createMetadata('device-b', 2001, vB)
      )

      // Conflict should be detected
      const status = crdt.detectConflict(rA, rB)
      expect(status).toBe(ConflictStatus.CONFLICT)

      // Resolve with LWW
      const result = crdt.resolve(rA, rB, 'last-write-wins')
      expect(result.merged!.data.title).toBe('Device B Edit') // Newer timestamp
      expect(result.merged!.metadata.versionVector['device-a']).toBe(6)
      expect(result.merged!.metadata.versionVector['device-b']).toBe(6)
    })

    it('should handle three-way merge', () => {
      // Initial state from Device A
      const vA1 = createVersionVector({ 'device-a': 1 })
      const rA = createRecord('doc-1', { title: 'A' }, createMetadata('device-a', 1000, vA1))

      // Device B edits
      const vB = crdt.incrementVersion(vA1, 'device-b')
      const rB = createRecord('doc-1', { title: 'B' }, createMetadata('device-b', 2000, vB))

      // Device C edits from A's state (concurrent with B)
      const vC = crdt.incrementVersion(vA1, 'device-c')
      const rC = createRecord('doc-1', { title: 'C' }, createMetadata('device-c', 1500, vC))

      // B vs C = conflict (concurrent)
      const bcStatus = crdt.detectConflict(rB, rC)
      expect(bcStatus).toBe(ConflictStatus.CONFLICT)

      // Merge B and C
      const bcResult = crdt.resolve(rB, rC, 'last-write-wins')
      expect(bcResult.merged!.data.title).toBe('B') // B has later timestamp

      // Merged result should dominate original A
      const mergedVsA = crdt.detectConflict(bcResult.merged!, rA)
      expect(mergedVsA).toBe(ConflictStatus.LOCAL_WINS)
    })
  })
})
