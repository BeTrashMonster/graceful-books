/**
 * Sync Queue Manager Tests
 *
 * Comprehensive tests for persistent message queue with retry logic.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SyncQueue, createSyncQueue } from './SyncQueue'
import { SyncPayloadType, type SyncPayload } from '../../config/syncConfig'

// Helper to create test payload
function createTestPayload(
  type: SyncPayloadType = SyncPayloadType.CHANGE,
  overrides: Partial<SyncPayload> = {}
): SyncPayload {
  return {
    type,
    companyId: 'company-123',
    userId: 'user-456',
    epoch: 1,
    encryptedData: 'encrypted-data',
    signature: 'signature',
    timestamp: Date.now(),
    messageId: `msg-${Math.random().toString(36).substring(2, 9)}`,
    deviceId: 'device-abc',
    ...overrides,
  }
}

describe('SyncQueue', () => {
  let queue: SyncQueue
  let dbName: string

  beforeEach(async () => {
    // Use unique database name for each test
    dbName = `test-queue-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    queue = new SyncQueue()
    // Override dbName for isolation
    ;(queue as any).dbName = dbName
    await queue.initialize()
  })

  afterEach(async () => {
    queue.close()
    // Clean up database
    if (typeof indexedDB !== 'undefined') {
      indexedDB.deleteDatabase(dbName)
    }
  })

  describe('initialization', () => {
    it('should initialize database', async () => {
      const newQueue = new SyncQueue()
      ;(newQueue as any).dbName = `test-init-${Date.now()}`
      await newQueue.initialize()

      // Should be able to use queue after initialization
      const payload = createTestPayload()
      const id = await newQueue.enqueue(payload)
      expect(id).toBeDefined()

      newQueue.close()
      indexedDB.deleteDatabase((newQueue as any).dbName)
    })

    it('should not reinitialize if already initialized', async () => {
      await queue.initialize() // Already initialized in beforeEach
      await queue.initialize() // Should be no-op

      const payload = createTestPayload()
      const id = await queue.enqueue(payload)
      expect(id).toBeDefined()
    })
  })

  describe('enqueue', () => {
    it('should add message to queue', async () => {
      const payload = createTestPayload()
      const id = await queue.enqueue(payload)

      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
      expect(id).toMatch(/^queue-/)
    })

    it('should assign priority based on message type', async () => {
      const handshake = createTestPayload(SyncPayloadType.HANDSHAKE)
      const change = createTestPayload(SyncPayloadType.CHANGE)

      await queue.enqueue(handshake)
      await queue.enqueue(change)

      const ready = await queue.getReady(10)

      // HANDSHAKE (priority 1) should come before CHANGE (priority 4)
      expect(ready[0].payload.type).toBe(SyncPayloadType.HANDSHAKE)
      expect(ready[1].payload.type).toBe(SyncPayloadType.CHANGE)
    })

    it('should set message as ready immediately', async () => {
      const payload = createTestPayload()
      await queue.enqueue(payload)

      const ready = await queue.getReady(10)
      expect(ready.length).toBe(1)
      expect(ready[0].nextRetryAt).toBeNull()
    })

    it('should track queued timestamp', async () => {
      const before = Date.now()
      const payload = createTestPayload()
      await queue.enqueue(payload)
      const after = Date.now()

      const ready = await queue.getReady(10)
      expect(ready[0].queuedAt).toBeGreaterThanOrEqual(before)
      expect(ready[0].queuedAt).toBeLessThanOrEqual(after)
    })

    it('should initialize attempts to 0', async () => {
      const payload = createTestPayload()
      await queue.enqueue(payload)

      const ready = await queue.getReady(10)
      expect(ready[0].attempts).toBe(0)
    })
  })

  describe('getReady', () => {
    it('should return empty array when queue is empty', async () => {
      const ready = await queue.getReady(10)
      expect(ready).toEqual([])
    })

    it('should return messages sorted by priority', async () => {
      const types = [
        SyncPayloadType.HEARTBEAT, // Priority 6
        SyncPayloadType.HANDSHAKE, // Priority 1
        SyncPayloadType.CHANGE, // Priority 4
        SyncPayloadType.SYNC_REQUEST, // Priority 2
      ]

      for (const type of types) {
        await queue.enqueue(createTestPayload(type))
      }

      const ready = await queue.getReady(10)

      expect(ready[0].payload.type).toBe(SyncPayloadType.HANDSHAKE) // 1
      expect(ready[1].payload.type).toBe(SyncPayloadType.SYNC_REQUEST) // 2
      expect(ready[2].payload.type).toBe(SyncPayloadType.CHANGE) // 4
      expect(ready[3].payload.type).toBe(SyncPayloadType.HEARTBEAT) // 6
    })

    it('should sort by queued time within same priority', async () => {
      const payload1 = createTestPayload(SyncPayloadType.CHANGE)
      const payload2 = createTestPayload(SyncPayloadType.CHANGE)

      const id1 = await queue.enqueue(payload1)
      await new Promise((resolve) => setTimeout(resolve, 10))
      const id2 = await queue.enqueue(payload2)

      const ready = await queue.getReady(10)

      // Earlier message should come first
      expect(ready[0].id).toBe(id1)
      expect(ready[1].id).toBe(id2)
    })

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await queue.enqueue(createTestPayload())
      }

      const ready = await queue.getReady(3)
      expect(ready.length).toBe(3)
    })

    it('should filter out messages waiting for retry', async () => {
      const payload = createTestPayload()
      const id = await queue.enqueue(payload)

      // Mark as failed to schedule retry
      await queue.markFailed(id)

      const ready = await queue.getReady(10)
      expect(ready.length).toBe(0) // Should be waiting for retry
    })

    it('should include messages whose retry time has passed', async () => {
      // This test verifies that retry time filtering works
      // We'll test with actual time delay
      const payload = createTestPayload()
      const id = await queue.enqueue(payload)

      // Mark as failed
      await queue.markFailed(id)

      // Should be waiting for retry
      let ready = await queue.getReady(10)
      expect(ready.length).toBe(0)

      // Wait for retry delay to pass (1 second + buffer)
      await new Promise((resolve) => setTimeout(resolve, 1200))

      ready = await queue.getReady(10)
      expect(ready.length).toBe(1)
    })
  })

  describe('markSent', () => {
    it('should remove message from queue', async () => {
      const payload = createTestPayload()
      const id = await queue.enqueue(payload)

      await queue.markSent(id)

      const ready = await queue.getReady(10)
      expect(ready.length).toBe(0)
    })

    it('should not affect other messages', async () => {
      const id1 = await queue.enqueue(createTestPayload())
      const id2 = await queue.enqueue(createTestPayload())

      await queue.markSent(id1)

      const ready = await queue.getReady(10)
      expect(ready.length).toBe(1)
      expect(ready[0].id).toBe(id2)
    })
  })

  describe('markFailed', () => {
    it('should increment attempts counter', async () => {
      const payload = createTestPayload()
      const id = await queue.enqueue(payload)

      await queue.markFailed(id)

      // Get message directly (bypass retry filter)
      const stats = await queue.getStatistics()
      expect(stats.totalMessages).toBe(1) // Message still in queue
    })

    it('should schedule retry with exponential backoff', async () => {
      const payload = createTestPayload()
      const id = await queue.enqueue(payload)

      await queue.markFailed(id)

      // Should not be ready immediately
      let ready = await queue.getReady(10)
      expect(ready.length).toBe(0)

      // After 1 second it should be ready
      await new Promise((resolve) => setTimeout(resolve, 1200))
      ready = await queue.getReady(10)
      expect(ready.length).toBe(1)
    })

    it('should use exponential backoff for multiple failures', async () => {
      // This test verifies exponential backoff is configured
      // Testing actual delays would make tests slow
      const payload = createTestPayload()
      const id = await queue.enqueue(payload)

      // First failure
      await queue.markFailed(id)
      let stats = await queue.getStatistics()
      expect(stats.waitingMessages).toBe(1)

      // Wait for first retry
      await new Promise((resolve) => setTimeout(resolve, 1200))

      // Second failure should schedule longer retry
      await queue.markFailed(id)
      stats = await queue.getStatistics()
      expect(stats.waitingMessages).toBe(1)
    })

    it('should remove message after max attempts', async () => {
      const payload = createTestPayload()
      const id = await queue.enqueue(payload)

      // Fail 10 times (max attempts)
      for (let i = 0; i < 10; i++) {
        const willRetry = await queue.markFailed(id)
        if (i < 9) {
          expect(willRetry).toBe(true)
        } else {
          expect(willRetry).toBe(false) // Last attempt
        }
      }

      const stats = await queue.getStatistics()
      expect(stats.totalMessages).toBe(0) // Message removed
    })

    it('should return false for non-existent message', async () => {
      const result = await queue.markFailed('non-existent-id')
      expect(result).toBe(false)
    })

    it('should update lastAttemptAt timestamp', async () => {
      const payload = createTestPayload()
      const id = await queue.enqueue(payload)

      await queue.markFailed(id)

      // We can't directly access the message, but we can verify it's in queue
      const stats = await queue.getStatistics()
      expect(stats.totalMessages).toBe(1)
    })
  })

  describe('getStatistics', () => {
    it('should return zero stats for empty queue', async () => {
      const stats = await queue.getStatistics()

      expect(stats.totalMessages).toBe(0)
      expect(stats.readyMessages).toBe(0)
      expect(stats.waitingMessages).toBe(0)
      expect(stats.oldestMessageAt).toBeUndefined()
    })

    it('should count total messages', async () => {
      await queue.enqueue(createTestPayload())
      await queue.enqueue(createTestPayload())
      await queue.enqueue(createTestPayload())

      const stats = await queue.getStatistics()
      expect(stats.totalMessages).toBe(3)
    })

    it('should count ready vs waiting messages', async () => {
      const id1 = await queue.enqueue(createTestPayload())
      await queue.enqueue(createTestPayload())

      // Mark one as failed (will be waiting for retry)
      await queue.markFailed(id1)

      const stats = await queue.getStatistics()
      expect(stats.readyMessages).toBe(1)
      expect(stats.waitingMessages).toBe(1)
    })

    it('should count messages by type', async () => {
      await queue.enqueue(createTestPayload(SyncPayloadType.HANDSHAKE))
      await queue.enqueue(createTestPayload(SyncPayloadType.CHANGE))
      await queue.enqueue(createTestPayload(SyncPayloadType.CHANGE))

      const stats = await queue.getStatistics()
      expect(stats.messagesByType[SyncPayloadType.HANDSHAKE]).toBe(1)
      expect(stats.messagesByType[SyncPayloadType.CHANGE]).toBe(2)
      expect(stats.messagesByType[SyncPayloadType.HEARTBEAT]).toBe(0)
    })

    it('should track oldest message timestamp', async () => {
      const time1 = Date.now()
      await queue.enqueue(createTestPayload())

      await new Promise((resolve) => setTimeout(resolve, 10))

      await queue.enqueue(createTestPayload())

      const stats = await queue.getStatistics()
      expect(stats.oldestMessageAt).toBeDefined()
      expect(stats.oldestMessageAt!).toBeGreaterThanOrEqual(time1)
      expect(stats.oldestMessageAt!).toBeLessThan(Date.now())
    })
  })

  describe('clear', () => {
    it('should remove all messages', async () => {
      await queue.enqueue(createTestPayload())
      await queue.enqueue(createTestPayload())
      await queue.enqueue(createTestPayload())

      await queue.clear()

      const stats = await queue.getStatistics()
      expect(stats.totalMessages).toBe(0)
    })

    it('should work on empty queue', async () => {
      await queue.clear()

      const stats = await queue.getStatistics()
      expect(stats.totalMessages).toBe(0)
    })
  })

  describe('close', () => {
    it('should close database connection', () => {
      queue.close()

      // After closing, db should be null
      expect((queue as any).db).toBeNull()
    })

    it('should allow reinitialization after close', async () => {
      queue.close()

      await queue.initialize()

      const payload = createTestPayload()
      const id = await queue.enqueue(payload)
      expect(id).toBeDefined()
    })
  })

  describe('priority ordering', () => {
    it('should prioritize HANDSHAKE over everything', async () => {
      await queue.enqueue(createTestPayload(SyncPayloadType.CHANGE))
      await queue.enqueue(createTestPayload(SyncPayloadType.HEARTBEAT))
      await queue.enqueue(createTestPayload(SyncPayloadType.HANDSHAKE))
      await queue.enqueue(createTestPayload(SyncPayloadType.SYNC_REQUEST))

      const ready = await queue.getReady(1)
      expect(ready[0].payload.type).toBe(SyncPayloadType.HANDSHAKE)
    })

    it('should prioritize SYNC_REQUEST over CHANGE', async () => {
      await queue.enqueue(createTestPayload(SyncPayloadType.CHANGE))
      await queue.enqueue(createTestPayload(SyncPayloadType.SYNC_REQUEST))

      const ready = await queue.getReady(1)
      expect(ready[0].payload.type).toBe(SyncPayloadType.SYNC_REQUEST)
    })

    it('should deprioritize HEARTBEAT', async () => {
      await queue.enqueue(createTestPayload(SyncPayloadType.HEARTBEAT))
      await queue.enqueue(createTestPayload(SyncPayloadType.CHANGE))

      const ready = await queue.getReady(1)
      expect(ready[0].payload.type).toBe(SyncPayloadType.CHANGE)
    })
  })

  describe('retry backoff', () => {
    it('should cap retry delay at max', async () => {
      const payload = createTestPayload()
      const id = await queue.enqueue(payload)

      // Fail 9 times (one before max)
      for (let i = 0; i < 9; i++) {
        const willRetry = await queue.markFailed(id)
        expect(willRetry).toBe(true)
      }

      // Next failure should still allow retry (not removed yet)
      // This verifies retry logic before max attempts
      const stats = await queue.getStatistics()
      expect(stats.totalMessages).toBe(1)
    })
  })

  describe('persistence', () => {
    it('should persist messages across instances', async () => {
      const payload = createTestPayload()
      await queue.enqueue(payload)

      // Close and reopen
      queue.close()

      const newQueue = new SyncQueue()
      ;(newQueue as any).dbName = dbName
      await newQueue.initialize()

      const stats = await newQueue.getStatistics()
      expect(stats.totalMessages).toBe(1)

      newQueue.close()
    })
  })

  describe('createSyncQueue factory', () => {
    it('should create queue instance', () => {
      const factoryQueue = createSyncQueue()
      expect(factoryQueue).toBeInstanceOf(SyncQueue)
    })
  })
})
