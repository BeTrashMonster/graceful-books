/**
 * Sync Queue Manager
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 4, Task 4.4 (Chunk 4D):
 * Manages offline message queue with persistence and retry logic.
 *
 * Features:
 * - Persistent queue storage (IndexedDB)
 * - Priority-based message ordering
 * - Retry logic with exponential backoff
 * - Automatic queue processing when online
 * - Failed message tracking and cleanup
 *
 * Architecture:
 * - Survives page refresh via IndexedDB
 * - Priority: HANDSHAKE > SYNC_REQUEST > CHANGE > HEARTBEAT
 * - Automatic retry with backoff (1s → 60s max)
 * - Max 10 retry attempts before giving up
 *
 * Security:
 * - All queued data is already encrypted
 * - Queue stored locally only
 * - No sensitive data in queue metadata
 */

import {
  type SyncPayload,
  SyncPayloadType,
  SyncErrorCode,
  type SyncError,
} from '../../config/syncConfig'

/**
 * Message priority levels
 * Lower number = higher priority
 */
const MESSAGE_PRIORITY: Record<SyncPayloadType, number> = {
  [SyncPayloadType.HANDSHAKE]: 1,
  [SyncPayloadType.SYNC_REQUEST]: 2,
  [SyncPayloadType.SYNC_RESPONSE]: 3,
  [SyncPayloadType.CHANGE]: 4,
  [SyncPayloadType.BATCH]: 5,
  [SyncPayloadType.HEARTBEAT]: 6,
  [SyncPayloadType.ACK]: 7,
  [SyncPayloadType.ERROR]: 8,
}

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  MAX_ATTEMPTS: 10,
  BASE_DELAY_MS: 1000, // 1 second
  MAX_DELAY_MS: 60000, // 60 seconds
  BACKOFF_MULTIPLIER: 2,
}

/**
 * Queued message with metadata
 */
export interface QueuedMessage {
  /** Unique queue entry ID */
  id: string
  /** Sync payload */
  payload: SyncPayload
  /** When message was queued */
  queuedAt: number
  /** Number of send attempts */
  attempts: number
  /** Last attempt timestamp */
  lastAttemptAt?: number
  /** Next retry timestamp (null if ready now) */
  nextRetryAt: number | null
  /** Message priority (lower = higher priority) */
  priority: number
}

/**
 * Queue statistics
 */
export interface QueueStatistics {
  /** Total messages in queue */
  totalMessages: number
  /** Messages ready to send */
  readyMessages: number
  /** Messages waiting for retry */
  waitingMessages: number
  /** Messages by type */
  messagesByType: Record<SyncPayloadType, number>
  /** Oldest message timestamp */
  oldestMessageAt?: number
}

/**
 * Sync Queue Manager
 *
 * Manages persistent queue of sync messages with priority
 * and retry logic.
 */
export class SyncQueue {
  private db: IDBDatabase | null = null
  private dbName = 'GracefulBooks-SyncQueue'
  private storeName = 'messages'
  private dbVersion = 1

  constructor() {
    // Database initialized on-demand
  }

  /**
   * Initialize queue database
   *
   * Opens IndexedDB connection and creates schema if needed.
   */
  async initialize(): Promise<void> {
    if (this.db) {
      return // Already initialized
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => {
        reject(this.createError(SyncErrorCode.UNKNOWN_ERROR, 'Failed to open queue database'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create messages store
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' })

          // Indexes for efficient querying
          store.createIndex('priority', 'priority', { unique: false })
          store.createIndex('nextRetryAt', 'nextRetryAt', { unique: false })
          store.createIndex('queuedAt', 'queuedAt', { unique: false })
        }
      }
    })
  }

  /**
   * Add message to queue
   *
   * @param payload - Sync payload to queue
   * @returns Queue entry ID
   */
  async enqueue(payload: SyncPayload): Promise<string> {
    await this.ensureInitialized()

    const id = this.generateId()
    const priority = MESSAGE_PRIORITY[payload.type] || 99

    const queuedMessage: QueuedMessage = {
      id,
      payload,
      queuedAt: Date.now(),
      attempts: 0,
      lastAttemptAt: undefined,
      nextRetryAt: null, // Ready immediately
      priority,
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.add(queuedMessage)

      request.onsuccess = () => resolve(id)
      request.onerror = () =>
        reject(this.createError(SyncErrorCode.UNKNOWN_ERROR, 'Failed to enqueue message'))
    })
  }

  /**
   * Get next batch of messages ready to send
   *
   * Returns messages sorted by priority, filtered by retry time.
   *
   * @param limit - Maximum messages to return
   * @returns Array of queued messages
   */
  async getReady(limit: number = 10): Promise<QueuedMessage[]> {
    await this.ensureInitialized()

    const now = Date.now()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        const allMessages = request.result as QueuedMessage[]

        // Filter messages ready to send (retry time passed)
        const readyMessages = allMessages.filter((msg) => {
          return msg.nextRetryAt === null || msg.nextRetryAt <= now
        })

        // Sort by priority (lower = higher priority), then by queued time
        readyMessages.sort((a, b) => {
          if (a.priority !== b.priority) {
            return a.priority - b.priority
          }
          return a.queuedAt - b.queuedAt
        })

        // Return limited batch
        resolve(readyMessages.slice(0, limit))
      }

      request.onerror = () =>
        reject(this.createError(SyncErrorCode.UNKNOWN_ERROR, 'Failed to get ready messages'))
    })
  }

  /**
   * Mark message as successfully sent
   *
   * Removes message from queue.
   *
   * @param id - Queue entry ID
   */
  async markSent(id: string): Promise<void> {
    await this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () =>
        reject(this.createError(SyncErrorCode.UNKNOWN_ERROR, 'Failed to mark message as sent'))
    })
  }

  /**
   * Mark message as failed
   *
   * Increments attempt counter and schedules retry with exponential backoff.
   * If max attempts exceeded, removes message from queue.
   *
   * @param id - Queue entry ID
   * @returns True if message will be retried, false if discarded
   */
  async markFailed(id: string): Promise<boolean> {
    await this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const message = getRequest.result as QueuedMessage | undefined

        if (!message) {
          resolve(false)
          return
        }

        message.attempts++
        message.lastAttemptAt = Date.now()

        // Check if max attempts exceeded
        if (message.attempts >= RETRY_CONFIG.MAX_ATTEMPTS) {
          // Give up - remove from queue
          const deleteRequest = store.delete(id)
          deleteRequest.onsuccess = () => resolve(false)
          deleteRequest.onerror = () =>
            reject(this.createError(SyncErrorCode.UNKNOWN_ERROR, 'Failed to remove failed message'))
          return
        }

        // Calculate retry delay with exponential backoff
        const baseDelay = RETRY_CONFIG.BASE_DELAY_MS
        const multiplier = Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, message.attempts - 1)
        const delay = Math.min(baseDelay * multiplier, RETRY_CONFIG.MAX_DELAY_MS)

        message.nextRetryAt = Date.now() + delay

        // Update message
        const putRequest = store.put(message)
        putRequest.onsuccess = () => resolve(true)
        putRequest.onerror = () =>
          reject(this.createError(SyncErrorCode.UNKNOWN_ERROR, 'Failed to update failed message'))
      }

      getRequest.onerror = () =>
        reject(this.createError(SyncErrorCode.UNKNOWN_ERROR, 'Failed to get message for failure'))
    })
  }

  /**
   * Get queue statistics
   *
   * @returns Queue statistics
   */
  async getStatistics(): Promise<QueueStatistics> {
    await this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        const messages = request.result as QueuedMessage[]
        const now = Date.now()

        const stats: QueueStatistics = {
          totalMessages: messages.length,
          readyMessages: 0,
          waitingMessages: 0,
          messagesByType: {} as Record<SyncPayloadType, number>,
          oldestMessageAt: undefined,
        }

        // Initialize messagesByType
        for (const type of Object.values(SyncPayloadType)) {
          stats.messagesByType[type] = 0
        }

        // Count messages
        for (const msg of messages) {
          // Count by type
          stats.messagesByType[msg.payload.type] =
            (stats.messagesByType[msg.payload.type] || 0) + 1

          // Count ready vs waiting
          if (msg.nextRetryAt === null || msg.nextRetryAt <= now) {
            stats.readyMessages++
          } else {
            stats.waitingMessages++
          }

          // Track oldest
          if (!stats.oldestMessageAt || msg.queuedAt < stats.oldestMessageAt) {
            stats.oldestMessageAt = msg.queuedAt
          }
        }

        resolve(stats)
      }

      request.onerror = () =>
        reject(this.createError(SyncErrorCode.UNKNOWN_ERROR, 'Failed to get statistics'))
    })
  }

  /**
   * Clear all messages from queue
   *
   * Use with caution - removes all pending messages.
   */
  async clear(): Promise<void> {
    await this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () =>
        reject(this.createError(SyncErrorCode.UNKNOWN_ERROR, 'Failed to clear queue'))
    })
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  /**
   * Ensure database is initialized
   *
   * @private
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }
  }

  /**
   * Generate unique ID for queue entry
   *
   * @private
   */
  private generateId(): string {
    return `queue-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Create sync error
   *
   * @private
   */
  private createError(code: SyncErrorCode, message: string): SyncError {
    return {
      code,
      message,
      timestamp: Date.now(),
      recoverable: false,
    }
  }
}

/**
 * Create sync queue instance
 *
 * @returns Sync queue manager
 */
export function createSyncQueue(): SyncQueue {
  return new SyncQueue()
}
