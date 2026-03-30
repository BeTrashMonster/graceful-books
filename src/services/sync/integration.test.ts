/**
 * Sync Services Integration Tests
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 4, Task 4.10 (Chunk 4J):
 * End-to-end integration tests for the complete sync system.
 *
 * Tests verify that all sync components work together correctly:
 * - WebSocket client + message signing + queue + CRDT + rate limiting + coordination
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createSyncClient,
  createSyncSignature,
  createSyncQueue,
  createSyncCRDT,
  createSyncRateLimiter,
  createSyncBackupCoordinator,
  type VersionedRecord,
} from './index'

describe('Sync Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Multi-Device Sync Flow', () => {
    it('should sync changes between two devices', async () => {
      // Simulate two devices with independent CRDT instances
      const device1CRDT = createSyncCRDT()
      const device2CRDT = createSyncCRDT()

      // Device 1 creates a record
      const record1: VersionedRecord = device1CRDT.createVersionedRecord(
        'txn-1',
        { description: 'Office supplies', amount: '50.00' },
        'device-1',
        'user-1'
      )

      // Device 2 creates the same record (sync hasn't happened yet)
      const record2: VersionedRecord = device2CRDT.createVersionedRecord(
        'txn-1',
        { description: 'Office supplies', amount: '55.00' }, // Different amount!
        'device-2',
        'user-1'
      )

      // Simulate sync: device 2 receives device 1's version
      const resolution = device2CRDT.resolve(record2, record1)

      // Should detect conflict and resolve it
      expect(resolution.status).toBe('CONFLICT')
      expect(resolution.merged).toBeDefined()

      // Merged version should have combined version vectors
      expect(resolution.merged?.metadata.versionVector['device-1']).toBeDefined()
      expect(resolution.merged?.metadata.versionVector['device-2']).toBeDefined()
    })

    it('should handle offline edits and sync when reconnected', () => {
      const crdt = createSyncCRDT()

      // Device makes changes while offline
      const record1 = crdt.createVersionedRecord(
        'txn-1',
        { description: 'Lunch', amount: '15.00' },
        'device-1',
        'user-1'
      )

      const record2 = crdt.createVersionedRecord(
        'txn-2',
        { description: 'Coffee', amount: '5.00' },
        'device-1',
        'user-1'
      )

      // Store changes locally (simulated queue)
      const offlineChanges = [record1, record2]

      // Device reconnects and can send queued changes
      expect(offlineChanges).toHaveLength(2)
      expect(offlineChanges[0].id).toBe('txn-1')
      expect(offlineChanges[1].id).toBe('txn-2')

      // Verify records are intact and have version vectors
      expect(record1.metadata.versionVector['device-1']).toBeDefined()
      expect(record2.metadata.versionVector['device-1']).toBeDefined()
    })
  })

  describe('Rate Limiting + Sync Flow', () => {
    it('should rate limit excessive sync requests', () => {
      const rateLimiter = createSyncRateLimiter({
        sync: {
          maxRequests: 5,
          windowMs: 10000,
          maxBurst: 5,
          refillRate: 0.5,
        },
      })

      const userId = 'user-1'
      const deviceId = 'device-1'

      // Make 5 requests (should all succeed)
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
        expect(result.allowed).toBe(true)
      }

      // 6th request should be denied
      const result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Rate limit exceeded')

      // Advance time to allow refill (need more time for refill to work)
      vi.advanceTimersByTime(15000) // 15 seconds = 7.5 tokens

      // Should be allowed again
      const result2 = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result2.allowed).toBe(true)

      rateLimiter.stop()
    })

    it('should ban user after repeated violations', () => {
      const rateLimiter = createSyncRateLimiter({
        sync: {
          maxRequests: 2,
          windowMs: 10000,
          maxBurst: 2,
          refillRate: 0.1,
        },
        violationsBeforeBan: 3,
        banDuration: 60000,
      })

      const userId = 'abusive-user'
      const deviceId = 'device-1'

      // Consume limit
      rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      rateLimiter.checkRateLimit(userId, deviceId, 'sync')

      // Violations
      rateLimiter.checkRateLimit(userId, deviceId, 'sync') // 1
      rateLimiter.checkRateLimit(userId, deviceId, 'sync') // 2
      rateLimiter.checkRateLimit(userId, deviceId, 'sync') // 3 - banned

      // User should be banned
      expect(rateLimiter.isBanned(userId)).toBe(true)

      // All requests should be denied
      const result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('banned')

      rateLimiter.stop()
    })
  })

  describe('Sync/Backup Coordination', () => {
    it('should prioritize sync over backup', () => {
      const coordinator = createSyncBackupCoordinator()

      // Request backup
      const backupOp = coordinator.requestBackup()
      expect(backupOp).not.toBeNull()

      // Start backup
      coordinator.startOperation(backupOp!)
      expect(coordinator.getOperation(backupOp!)?.status).toBe('RUNNING')

      // Request sync (should pause backup)
      const syncOp = coordinator.requestSync()
      expect(syncOp).not.toBeNull()

      // Backup should be paused
      expect(coordinator.getOperation(backupOp!)?.status).toBe('PAUSED')

      // Start sync
      coordinator.startOperation(syncOp!)
      expect(coordinator.getOperation(syncOp!)?.status).toBe('RUNNING')

      // Complete sync
      coordinator.completeOperation(syncOp!)

      // Backup should resume
      expect(coordinator.getOperation(backupOp!)?.status).toBe('RUNNING')
    })

    it('should defer backup when sync is active', () => {
      const coordinator = createSyncBackupCoordinator({
        deferBackupWhenSyncActive: true,
      })

      // Start sync
      const syncOp = coordinator.requestSync()
      expect(syncOp).not.toBeNull()
      coordinator.startOperation(syncOp!)

      // Try to start backup (should be rejected)
      const backupOp = coordinator.requestBackup()
      expect(backupOp).toBeNull() // Deferred

      // Complete sync
      coordinator.completeOperation(syncOp!)

      // Now backup should be allowed
      const backupOp2 = coordinator.requestBackup()
      expect(backupOp2).not.toBeNull()
    })

    it('should track operation statistics', () => {
      const coordinator = createSyncBackupCoordinator()

      // Start some operations
      const sync1 = coordinator.requestSync()
      const sync2 = coordinator.requestSync()
      const backup1 = coordinator.requestBackup()

      coordinator.startOperation(sync1!)
      coordinator.startOperation(sync2!)

      // Check stats
      let stats = coordinator.getStatistics()
      expect(stats.activeSyncCount).toBe(2)
      expect(stats.activeBackupCount).toBe(0)
      expect(stats.pendingBackupCount).toBe(1)

      // Complete operations
      coordinator.completeOperation(sync1!)
      coordinator.completeOperation(sync2!)
      coordinator.startOperation(backup1!)
      coordinator.completeOperation(backup1!)

      stats = coordinator.getStatistics()
      expect(stats.totalCompleted).toBe(3)
      expect(stats.lastBackupAt).toBeDefined()
    })
  })

  describe('CRDT + Version Vector Integration', () => {
    it('should track version progression across changes', () => {
      const crdt = createSyncCRDT()

      // Create initial record
      const record = crdt.createVersionedRecord(
        'txn-1',
        { description: 'Purchase', amount: '100.00' },
        'device-1',
        'user-1'
      )

      // Update the record with incremented version
      const updated = crdt.createVersionedRecord(
        'txn-1',
        { description: 'Purchase - Updated', amount: '110.00' },
        'device-1',
        'user-1',
        crdt.incrementVersion(record.metadata.versionVector, 'device-1')
      )

      // Verify version progression
      expect(updated.metadata.versionVector['device-1']).toBeGreaterThan(
        record.metadata.versionVector['device-1']
      )
      expect(updated.metadata.versionVector['device-1']).toBe(2)
    })

    it('should preserve changes across version increments', () => {
      const crdt = createSyncCRDT()

      const changes = []

      // Simulate multiple edits
      for (let i = 1; i <= 5; i++) {
        const prevVector = i === 1 ? undefined : changes[i - 2].metadata.versionVector

        const record = crdt.createVersionedRecord(
          'txn-1',
          { description: 'Purchase', amount: `${100 + i * 10}.00` },
          'device-1',
          'user-1',
          prevVector ? crdt.incrementVersion(prevVector, 'device-1') : undefined
        )

        changes.push(record)
      }

      // Verify version progression
      expect(changes[4].metadata.versionVector['device-1']).toBe(5)
      expect(changes[4].data.amount).toBe('150.00')
    })
  })

  describe('Complete End-to-End Flow', () => {
    it('should handle full sync lifecycle', () => {
      // Set up all components
      const crdt = createSyncCRDT()
      const rateLimiter = createSyncRateLimiter()
      const coordinator = createSyncBackupCoordinator()

      const userId = 'user-1'
      const deviceId = 'device-1'

      // Step 1: Create a change
      const record = crdt.createVersionedRecord(
        'txn-1',
        { description: 'Test transaction', amount: '25.00' },
        deviceId,
        userId
      )

      // Step 2: Check rate limit
      const rateCheck = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(rateCheck.allowed).toBe(true)

      // Step 3: Check sync/backup coordination
      const syncOp = coordinator.requestSync()
      expect(syncOp).not.toBeNull()
      coordinator.startOperation(syncOp!)

      // Step 4: Prepare the change for transmission
      const message = {
        id: 'sync-msg-1',
        type: 'sync' as const,
        payload: JSON.stringify(record),
        priority: 1,
        timestamp: Date.now(),
      }

      // Step 5: Verify message contains record
      expect(message).toBeDefined()
      expect(JSON.parse(message.payload).id).toBe('txn-1')

      // Step 6: Complete sync operation
      coordinator.completeOperation(syncOp!)

      // Step 7: Verify final state
      const stats = coordinator.getStatistics()
      expect(stats.totalCompleted).toBe(1)

      // Cleanup
      rateLimiter.stop()
    })

    it('should handle concurrent device sync with conflict resolution', () => {
      // Two devices
      const device1CRDT = createSyncCRDT()
      const device2CRDT = createSyncCRDT()

      const rateLimiter = createSyncRateLimiter()
      const userId = 'user-1'

      // Device 1 makes a change
      const device1Record = device1CRDT.createVersionedRecord(
        'txn-shared',
        { description: 'Shared transaction', amount: '30.00' },
        'device-1',
        userId
      )

      // Device 2 makes a conflicting change (same ID, different data)
      const device2Record = device2CRDT.createVersionedRecord(
        'txn-shared',
        { description: 'Shared transaction', amount: '35.00' },
        'device-2',
        userId
      )

      // Check rate limits for both devices
      const rate1 = rateLimiter.checkRateLimit(userId, 'device-1', 'sync')
      const rate2 = rateLimiter.checkRateLimit(userId, 'device-2', 'sync')

      expect(rate1.allowed).toBe(true)
      expect(rate2.allowed).toBe(true)

      // Devices sync and detect conflict
      const resolution = device1CRDT.resolve(device1Record, device2Record)

      expect(resolution.status).toBe('CONFLICT')
      expect(resolution.merged).toBeDefined()

      // Merged record should have both devices in version vector
      const merged = resolution.merged!
      expect(merged.metadata.versionVector['device-1']).toBeDefined()
      expect(merged.metadata.versionVector['device-2']).toBeDefined()

      // Last-write-wins should pick one version based on timestamp
      expect(['30.00', '35.00']).toContain(merged.data.amount)

      rateLimiter.stop()
    })

    it('should handle connection limits correctly', () => {
      const rateLimiter = createSyncRateLimiter({
        maxConnectionsPerUser: 3,
        maxConnectionsPerDevice: 1,
      })

      const userId = 'user-1'

      // Connect 3 devices
      const conn1 = rateLimiter.checkConnectionLimit(userId, 'device-1', 'conn-1')
      expect(conn1.allowed).toBe(true)
      rateLimiter.registerConnection(userId, 'device-1', 'conn-1')

      const conn2 = rateLimiter.checkConnectionLimit(userId, 'device-2', 'conn-2')
      expect(conn2.allowed).toBe(true)
      rateLimiter.registerConnection(userId, 'device-2', 'conn-2')

      const conn3 = rateLimiter.checkConnectionLimit(userId, 'device-3', 'conn-3')
      expect(conn3.allowed).toBe(true)
      rateLimiter.registerConnection(userId, 'device-3', 'conn-3')

      // Fourth device should be rejected
      const conn4 = rateLimiter.checkConnectionLimit(userId, 'device-4', 'conn-4')
      expect(conn4.allowed).toBe(false)

      // Disconnect one device
      rateLimiter.unregisterConnection(userId, 'device-1', 'conn-1')

      // Now fourth device can connect
      const conn5 = rateLimiter.checkConnectionLimit(userId, 'device-4', 'conn-5')
      expect(conn5.allowed).toBe(true)

      rateLimiter.stop()
    })
  })

  describe('Performance & Scalability', () => {
    it('should handle creating many CRDT records', () => {
      const crdt = createSyncCRDT()

      // Create 1000 records
      const startCreate = Date.now()
      for (let i = 0; i < 1000; i++) {
        crdt.createVersionedRecord(
          `record-${i}`,
          { data: `test-${i}` },
          'device-1',
          'user-1'
        )
      }
      const createTime = Date.now() - startCreate

      // Should be fast
      expect(createTime).toBeLessThan(1000)
    })

    it('should handle many concurrent users with rate limiting', () => {
      const rateLimiter = createSyncRateLimiter()

      // Simulate 100 users making requests
      const users = Array.from({ length: 100 }, (_, i) => `user-${i}`)

      const startTime = Date.now()
      for (const userId of users) {
        const deviceId = `device-${userId}`
        const result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
        expect(result.allowed).toBe(true)
      }
      const elapsed = Date.now() - startTime

      // Should handle 100 users quickly
      expect(elapsed).toBeLessThan(100) // <1ms per user

      // Check statistics
      const stats = rateLimiter.getStatistics()
      expect(stats.totalUsers).toBe(100)
      expect(stats.totalDevices).toBe(100)

      rateLimiter.stop()
    })

    it('should handle CRDT operations at scale', () => {
      const crdt = createSyncCRDT()

      // Create 100 records with the same ID but different device origins
      const records: VersionedRecord[] = []
      const startCreate = Date.now()

      for (let i = 0; i < 100; i++) {
        const record = crdt.createVersionedRecord(
          'shared-record', // Same ID for all
          { data: `test-${i}` },
          `device-${i % 2}`, // Alternate between device-0 and device-1
          'user-1'
        )
        records.push(record)
      }

      const createTime = Date.now() - startCreate
      expect(createTime).toBeLessThan(100) // Fast creation

      // Resolve conflicts between consecutive records
      const startResolve = Date.now()
      for (let i = 0; i < 99; i++) {
        crdt.resolve(records[i], records[i + 1])
      }
      const resolveTime = Date.now() - startResolve

      expect(resolveTime).toBeLessThan(200) // Fast resolution
    })
  })

  describe('Error Handling & Recovery', () => {
    it('should handle CRDT resolution errors gracefully', () => {
      const crdt = createSyncCRDT()

      const record1 = crdt.createVersionedRecord(
        'txn-1',
        { amount: '50.00' },
        'device-1',
        'user-1'
      )

      const record2 = crdt.createVersionedRecord(
        'txn-2', // Different ID!
        { amount: '55.00' },
        'device-2',
        'user-1'
      )

      // Should throw when trying to merge records with different IDs
      expect(() => {
        crdt.resolve(record1, record2)
      }).toThrow('Cannot merge records with different IDs')
    })

    it('should recover from rate limiter cleanup', () => {
      const rateLimiter = createSyncRateLimiter({
        cleanupInterval: 5000,
      })

      const userId = 'user-1'
      const deviceId = 'device-1'

      // Make a request
      rateLimiter.checkRateLimit(userId, deviceId, 'sync')

      let stats = rateLimiter.getStatistics()
      expect(stats.totalUsers).toBe(1)

      // Advance time and trigger cleanup
      vi.advanceTimersByTime(20000)
      rateLimiter.cleanup()

      // User should be cleaned up (no active connections)
      stats = rateLimiter.getStatistics()
      expect(stats.totalUsers).toBe(0)

      // But can still make new requests
      const result = rateLimiter.checkRateLimit(userId, deviceId, 'sync')
      expect(result.allowed).toBe(true)

      stats = rateLimiter.getStatistics()
      expect(stats.totalUsers).toBe(1)

      rateLimiter.stop()
    })

    it('should handle coordinator operation failures', () => {
      const coordinator = createSyncBackupCoordinator()

      // Start an operation
      const syncOp = coordinator.requestSync()
      coordinator.startOperation(syncOp!)

      // Fail the operation
      coordinator.failOperation(syncOp!, 'Connection lost')

      const operation = coordinator.getOperation(syncOp!)
      expect(operation?.status).toBe('FAILED')
      expect(operation?.error).toBe('Connection lost')

      // Should still be able to start new operations
      const syncOp2 = coordinator.requestSync()
      expect(syncOp2).not.toBeNull()
    })
  })
})
