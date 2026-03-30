/**
 * Sync Services Performance Benchmarks
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 4, Task 4.10 (Chunk 4J):
 * Performance benchmarks to validate sync system meets requirements.
 *
 * Target Performance:
 * - Message queueing: <1ms per operation
 * - CRDT resolution: <5ms per conflict
 * - Rate limit check: <1ms per check
 * - Queue throughput: >10,000 messages/sec
 */

import { bench, describe } from 'vitest'
import {
  createSyncQueue,
  createSyncCRDT,
  createSyncRateLimiter,
  createSyncBackupCoordinator,
  createSyncSignature,
} from './index'

describe('Sync Performance Benchmarks', () => {
  describe('Queue Performance', () => {
    bench('enqueue single message', () => {
      const queue = createSyncQueue()
      queue.enqueue({
        id: 'msg-1',
        type: 'sync',
        payload: JSON.stringify({ test: 'data' }),
        priority: 1,
        timestamp: Date.now(),
      })
    })

    bench('dequeue single message', () => {
      const queue = createSyncQueue()
      // Pre-fill
      queue.enqueue({
        id: 'msg-1',
        type: 'sync',
        payload: JSON.stringify({ test: 'data' }),
        priority: 1,
        timestamp: Date.now(),
      })

      queue.dequeue()
    })

    bench('enqueue 1000 messages', () => {
      const queue = createSyncQueue({ maxSize: 10000 })

      for (let i = 0; i < 1000; i++) {
        queue.enqueue({
          id: `msg-${i}`,
          type: 'sync',
          payload: JSON.stringify({ index: i }),
          priority: 1,
          timestamp: Date.now(),
        })
      }
    })

    bench('priority queue ordering (mixed priorities)', () => {
      const queue = createSyncQueue({ maxSize: 10000 })

      // Enqueue with mixed priorities
      for (let i = 0; i < 100; i++) {
        queue.enqueue({
          id: `low-${i}`,
          type: 'sync',
          payload: '{}',
          priority: 3,
          timestamp: Date.now(),
        })

        queue.enqueue({
          id: `high-${i}`,
          type: 'sync',
          payload: '{}',
          priority: 1,
          timestamp: Date.now(),
        })
      }

      // Dequeue all (high priority should come first)
      while (queue.size() > 0) {
        queue.dequeue()
      }
    })

    bench('queue with retries', () => {
      const queue = createSyncQueue()

      const message = {
        id: 'msg-retry',
        type: 'sync' as const,
        payload: '{}',
        priority: 1,
        timestamp: Date.now(),
      }

      queue.enqueue(message)
      queue.dequeue()
      queue.retry(message.id, 1000)
    })
  })

  describe('CRDT Performance', () => {
    bench('create versioned record', () => {
      const crdt = createSyncCRDT()

      crdt.createVersionedRecord(
        'record-1',
        { description: 'Test', amount: '100.00' },
        'device-1',
        'user-1'
      )
    })

    bench('compare version vectors', () => {
      const crdt = createSyncCRDT()

      const v1 = { 'device-1': 5, 'device-2': 3 }
      const v2 = { 'device-1': 4, 'device-2': 4 }

      crdt.compareVersionVectors(v1, v2)
    })

    bench('detect conflict', () => {
      const crdt = createSyncCRDT()

      const local = crdt.createVersionedRecord(
        'txn-1',
        { amount: '50.00' },
        'device-1',
        'user-1'
      )

      const remote = crdt.createVersionedRecord(
        'txn-1',
        { amount: '55.00' },
        'device-2',
        'user-1'
      )

      crdt.detectConflict(local, remote)
    })

    bench('resolve conflict (LWW)', () => {
      const crdt = createSyncCRDT()

      const local = crdt.createVersionedRecord(
        'txn-1',
        { amount: '50.00' },
        'device-1',
        'user-1'
      )

      const remote = crdt.createVersionedRecord(
        'txn-1',
        { amount: '55.00' },
        'device-2',
        'user-1'
      )

      crdt.resolve(local, remote, 'last-write-wins')
    })

    bench('merge version vectors', () => {
      const crdt = createSyncCRDT()

      const v1 = {
        'device-1': 10,
        'device-2': 5,
        'device-3': 8,
      }

      const v2 = {
        'device-1': 9,
        'device-2': 6,
        'device-4': 3,
      }

      crdt.mergeVersionVectors(v1, v2)
    })

    bench('increment version vector', () => {
      const crdt = createSyncCRDT()

      const vector = {
        'device-1': 5,
        'device-2': 3,
      }

      crdt.incrementVersion(vector, 'device-1')
    })

    bench('resolve 100 conflicts', () => {
      const crdt = createSyncCRDT()

      for (let i = 0; i < 100; i++) {
        const local = crdt.createVersionedRecord(
          `txn-${i}`,
          { amount: `${i}.00` },
          'device-1',
          'user-1'
        )

        const remote = crdt.createVersionedRecord(
          `txn-${i}`,
          { amount: `${i + 1}.00` },
          'device-2',
          'user-1'
        )

        crdt.resolve(local, remote)
      }
    })
  })

  describe('Rate Limiter Performance', () => {
    bench('check rate limit (single user)', () => {
      const rateLimiter = createSyncRateLimiter()

      rateLimiter.checkRateLimit('user-1', 'device-1', 'sync')

      rateLimiter.stop()
    })

    bench('check rate limit (100 different users)', () => {
      const rateLimiter = createSyncRateLimiter()

      for (let i = 0; i < 100; i++) {
        rateLimiter.checkRateLimit(`user-${i}`, `device-${i}`, 'sync')
      }

      rateLimiter.stop()
    })

    bench('check connection limit', () => {
      const rateLimiter = createSyncRateLimiter()

      rateLimiter.checkConnectionLimit('user-1', 'device-1', 'conn-1')

      rateLimiter.stop()
    })

    bench('register connection', () => {
      const rateLimiter = createSyncRateLimiter()

      rateLimiter.registerConnection('user-1', 'device-1', 'conn-1')

      rateLimiter.stop()
    })

    bench('get statistics', () => {
      const rateLimiter = createSyncRateLimiter()

      // Pre-populate with some data
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkRateLimit(`user-${i}`, `device-${i}`, 'sync')
        rateLimiter.registerConnection(`user-${i}`, `device-${i}`, `conn-${i}`)
      }

      rateLimiter.getStatistics()

      rateLimiter.stop()
    })

    bench('check rate limit with refill', () => {
      const rateLimiter = createSyncRateLimiter({
        sync: {
          maxRequests: 100,
          windowMs: 60000,
          maxBurst: 10,
          refillRate: 10, // Fast refill
        },
      })

      // Make some requests to consume tokens
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkRateLimit('user-1', 'device-1', 'sync')
      }

      // This should trigger refill calculation
      rateLimiter.checkRateLimit('user-1', 'device-1', 'sync')

      rateLimiter.stop()
    })

    bench('cleanup expired data', () => {
      const rateLimiter = createSyncRateLimiter()

      // Create some tracking data
      for (let i = 0; i < 50; i++) {
        rateLimiter.checkRateLimit(`user-${i}`, `device-${i}`, 'sync')
      }

      rateLimiter.cleanup()
      rateLimiter.stop()
    })
  })

  describe('Coordinator Performance', () => {
    bench('request sync operation', () => {
      const coordinator = createSyncBackupCoordinator()

      coordinator.requestSync()
    })

    bench('request backup operation', () => {
      const coordinator = createSyncBackupCoordinator()

      coordinator.requestBackup()
    })

    bench('start operation', () => {
      const coordinator = createSyncBackupCoordinator()

      const opId = coordinator.requestSync()
      if (opId) {
        coordinator.startOperation(opId)
      }
    })

    bench('complete operation', () => {
      const coordinator = createSyncBackupCoordinator()

      const opId = coordinator.requestSync()
      if (opId) {
        coordinator.startOperation(opId)
        coordinator.completeOperation(opId)
      }
    })

    bench('get statistics', () => {
      const coordinator = createSyncBackupCoordinator()

      // Create some operations
      for (let i = 0; i < 10; i++) {
        const syncOp = coordinator.requestSync()
        if (syncOp) {
          coordinator.startOperation(syncOp)
          coordinator.completeOperation(syncOp)
        }
      }

      coordinator.getStatistics()
    })

    bench('check if backup can start', () => {
      const coordinator = createSyncBackupCoordinator()

      coordinator.canStartBackup()
    })

    bench('cleanup completed operations', () => {
      const coordinator = createSyncBackupCoordinator()

      // Create and complete operations
      for (let i = 0; i < 20; i++) {
        const opId = coordinator.requestSync()
        if (opId) {
          coordinator.startOperation(opId)
          coordinator.completeOperation(opId)
        }
      }

      coordinator.cleanup()
    })

    bench('concurrent operation management', () => {
      const coordinator = createSyncBackupCoordinator()

      // Request multiple operations
      const sync1 = coordinator.requestSync()
      const sync2 = coordinator.requestSync()
      const backup1 = coordinator.requestBackup()

      // Start operations
      if (sync1) coordinator.startOperation(sync1)
      if (sync2) coordinator.startOperation(sync2)
      if (backup1) coordinator.startOperation(backup1)

      // Complete operations
      if (sync1) coordinator.completeOperation(sync1)
      if (sync2) coordinator.completeOperation(sync2)
      if (backup1) coordinator.completeOperation(backup1)
    })
  })

  describe('Message Signing Performance', () => {
    bench('sign message', () => {
      const signature = createSyncSignature()
      const key = new Uint8Array(32).fill(1) // Mock key

      signature.sign({ test: 'data' }, key, 'device-1', Date.now())
    })

    bench('verify signature', () => {
      const signature = createSyncSignature()
      const key = new Uint8Array(32).fill(1)

      const signed = signature.sign({ test: 'data' }, key, 'device-1', Date.now())
      signature.verify(signed, key)
    })

    bench('sign 100 messages', () => {
      const signature = createSyncSignature()
      const key = new Uint8Array(32).fill(1)

      for (let i = 0; i < 100; i++) {
        signature.sign({ index: i }, key, 'device-1', Date.now())
      }
    })

    bench('verify 100 signatures', () => {
      const signature = createSyncSignature()
      const key = new Uint8Array(32).fill(1)

      // Pre-sign messages
      const signed = []
      for (let i = 0; i < 100; i++) {
        signed.push(signature.sign({ index: i }, key, 'device-1', Date.now()))
      }

      // Verify all
      for (const sig of signed) {
        signature.verify(sig, key)
      }
    })
  })

  describe('End-to-End Performance', () => {
    bench('complete sync flow (queue + CRDT + rate limit)', () => {
      const queue = createSyncQueue()
      const crdt = createSyncCRDT()
      const rateLimiter = createSyncRateLimiter()

      // Create record
      const record = crdt.createVersionedRecord(
        'txn-1',
        { amount: '100.00' },
        'device-1',
        'user-1'
      )

      // Check rate limit
      rateLimiter.checkRateLimit('user-1', 'device-1', 'sync')

      // Queue message
      queue.enqueue({
        id: 'msg-1',
        type: 'sync',
        payload: JSON.stringify(record),
        priority: 1,
        timestamp: Date.now(),
      })

      // Dequeue
      queue.dequeue()

      rateLimiter.stop()
    })

    bench('multi-device sync with conflict resolution', () => {
      const crdt1 = createSyncCRDT()
      const crdt2 = createSyncCRDT()
      const queue1 = createSyncQueue()
      const queue2 = createSyncQueue()

      // Device 1 creates record
      const record1 = crdt1.createVersionedRecord(
        'txn-shared',
        { amount: '50.00' },
        'device-1',
        'user-1'
      )

      // Device 2 creates conflicting record
      const record2 = crdt2.createVersionedRecord(
        'txn-shared',
        { amount: '55.00' },
        'device-2',
        'user-1'
      )

      // Queue messages
      queue1.enqueue({
        id: 'msg-1',
        type: 'sync',
        payload: JSON.stringify(record1),
        priority: 1,
        timestamp: Date.now(),
      })

      queue2.enqueue({
        id: 'msg-2',
        type: 'sync',
        payload: JSON.stringify(record2),
        priority: 1,
        timestamp: Date.now(),
      })

      // Resolve conflict
      crdt1.resolve(record1, record2)
    })

    bench('sync with backup coordination', () => {
      const coordinator = createSyncBackupCoordinator()
      const queue = createSyncQueue()
      const crdt = createSyncCRDT()

      // Request sync
      const syncOp = coordinator.requestSync()

      // Create and queue change
      if (syncOp) {
        coordinator.startOperation(syncOp)

        const record = crdt.createVersionedRecord(
          'txn-1',
          { amount: '75.00' },
          'device-1',
          'user-1'
        )

        queue.enqueue({
          id: 'msg-1',
          type: 'sync',
          payload: JSON.stringify(record),
          priority: 1,
          timestamp: Date.now(),
        })

        queue.dequeue()
        coordinator.completeOperation(syncOp)
      }
    })
  })

  describe('Memory & Scalability', () => {
    bench('create 1000 versioned records', () => {
      const crdt = createSyncCRDT()

      for (let i = 0; i < 1000; i++) {
        crdt.createVersionedRecord(
          `record-${i}`,
          { index: i },
          'device-1',
          'user-1'
        )
      }
    })

    bench('track 1000 users with rate limiter', () => {
      const rateLimiter = createSyncRateLimiter()

      for (let i = 0; i < 1000; i++) {
        rateLimiter.checkRateLimit(`user-${i}`, `device-${i}`, 'sync')
      }

      rateLimiter.stop()
    })

    bench('queue 10000 messages', () => {
      const queue = createSyncQueue({ maxSize: 50000 })

      for (let i = 0; i < 10000; i++) {
        queue.enqueue({
          id: `msg-${i}`,
          type: 'sync',
          payload: `{"index":${i}}`,
          priority: i % 3 + 1,
          timestamp: Date.now(),
        })
      }
    })
  })
})
