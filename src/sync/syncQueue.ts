/**
 * Sync Queue
 *
 * Manages a queue of local changes that need to be synced to remote.
 * Tracks pending, in-progress, and failed sync operations.
 *
 * Requirements:
 * - ARCH-003: Sync infrastructure
 * - B6: Sync Relay Client
 */

import { getDeviceId } from '../db/crdt';

/**
 * Sync operation types
 */
export enum SyncOperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

/**
 * Entity types that can be synced
 */
export enum SyncEntityType {
  ACCOUNT = 'ACCOUNT',
  TRANSACTION = 'TRANSACTION',
  TRANSACTION_LINE_ITEM = 'TRANSACTION_LINE_ITEM',
  CONTACT = 'CONTACT',
  PRODUCT = 'PRODUCT',
  USER = 'USER',
  COMPANY = 'COMPANY',
}

/**
 * Sync queue item status
 */
export enum SyncQueueStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * A single item in the sync queue
 */
export interface SyncQueueItem {
  id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  operation: SyncOperationType;
  payload: any; // The encrypted entity data
  device_id: string;
  created_at: number;
  updated_at: number;
  status: SyncQueueStatus;
  retry_count: number;
  last_error: string | null;
  completed_at: number | null;
}

/**
 * Sync queue statistics
 */
export interface SyncQueueStats {
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  total: number;
  oldest_pending: number | null;
}

/**
 * Sync Queue Manager
 *
 * Manages the queue of changes to sync with the remote server.
 * Stores queue in localStorage for persistence across sessions.
 */
export class SyncQueue {
  private readonly STORAGE_KEY = 'graceful_books_sync_queue';
  private readonly MAX_RETRY_COUNT = 5;
  private queue: SyncQueueItem[] = [];
  private deviceId: string;

  constructor() {
    this.deviceId = getDeviceId();
    this.loadQueue();
  }

  /**
   * Load queue from localStorage
   */
  private loadQueue(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      this.queue = [];
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveQueue(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  /**
   * Generate a unique ID for queue items
   *
   * Note: Uses Math.random() intentionally for local queue item identification only.
   * These IDs are NOT used for security purposes - they're combined with timestamps
   * to create locally unique identifiers for queue management. For cryptographic
   * operations, the encryption layer uses crypto.getRandomValues().
   */
  private generateId(): string {
    // See function doc for security justification of Math.random() usage
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Add an item to the sync queue
   */
  enqueue(
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperationType,
    payload: any
  ): SyncQueueItem {
    const item: SyncQueueItem = {
      id: this.generateId(),
      entity_type: entityType,
      entity_id: entityId,
      operation,
      payload,
      device_id: this.deviceId,
      created_at: Date.now(),
      updated_at: Date.now(),
      status: SyncQueueStatus.PENDING,
      retry_count: 0,
      last_error: null,
      completed_at: null,
    };

    this.queue.push(item);
    this.saveQueue();
    return item;
  }

  /**
   * Get all pending items
   */
  getPending(): SyncQueueItem[] {
    return this.queue.filter(item => item.status === SyncQueueStatus.PENDING);
  }

  /**
   * Get items that are in progress
   */
  getInProgress(): SyncQueueItem[] {
    return this.queue.filter(item => item.status === SyncQueueStatus.IN_PROGRESS);
  }

  /**
   * Get failed items
   */
  getFailed(): SyncQueueItem[] {
    return this.queue.filter(item => item.status === SyncQueueStatus.FAILED);
  }

  /**
   * Get next batch of items to sync
   */
  getNextBatch(batchSize: number = 10): SyncQueueItem[] {
    const pending = this.getPending();
    return pending.slice(0, batchSize);
  }

  /**
   * Mark an item as in progress
   */
  markInProgress(itemId: string): void {
    const item = this.queue.find(i => i.id === itemId);
    if (item) {
      item.status = SyncQueueStatus.IN_PROGRESS;
      item.updated_at = Date.now();
      this.saveQueue();
    }
  }

  /**
   * Mark an item as completed
   */
  markCompleted(itemId: string): void {
    const item = this.queue.find(i => i.id === itemId);
    if (item) {
      item.status = SyncQueueStatus.COMPLETED;
      item.completed_at = Date.now();
      item.updated_at = Date.now();
      this.saveQueue();
    }
  }

  /**
   * Mark an item as failed
   */
  markFailed(itemId: string, error: string): void {
    const item = this.queue.find(i => i.id === itemId);
    if (item) {
      item.retry_count += 1;
      item.last_error = error;
      item.updated_at = Date.now();

      // If max retries exceeded, mark as failed permanently
      if (item.retry_count >= this.MAX_RETRY_COUNT) {
        item.status = SyncQueueStatus.FAILED;
      } else {
        // Otherwise, reset to pending for retry
        item.status = SyncQueueStatus.PENDING;
      }

      this.saveQueue();
    }
  }

  /**
   * Retry a failed item
   */
  retry(itemId: string): void {
    const item = this.queue.find(i => i.id === itemId);
    if (item && item.status === SyncQueueStatus.FAILED) {
      item.status = SyncQueueStatus.PENDING;
      item.retry_count = 0;
      item.last_error = null;
      item.updated_at = Date.now();
      this.saveQueue();
    }
  }

  /**
   * Retry all failed items
   */
  retryAll(): void {
    this.queue.forEach(item => {
      if (item.status === SyncQueueStatus.FAILED) {
        item.status = SyncQueueStatus.PENDING;
        item.retry_count = 0;
        item.last_error = null;
        item.updated_at = Date.now();
      }
    });
    this.saveQueue();
  }

  /**
   * Remove an item from the queue
   */
  remove(itemId: string): void {
    this.queue = this.queue.filter(i => i.id !== itemId);
    this.saveQueue();
  }

  /**
   * Clear completed items from queue
   */
  clearCompleted(): void {
    this.queue = this.queue.filter(i => i.status !== SyncQueueStatus.COMPLETED);
    this.saveQueue();
  }

  /**
   * Clear all items from queue
   */
  clear(): void {
    this.queue = [];
    this.saveQueue();
  }

  /**
   * Get queue statistics
   */
  getStats(): SyncQueueStats {
    const pending = this.queue.filter(i => i.status === SyncQueueStatus.PENDING);
    const inProgress = this.queue.filter(i => i.status === SyncQueueStatus.IN_PROGRESS);
    const completed = this.queue.filter(i => i.status === SyncQueueStatus.COMPLETED);
    const failed = this.queue.filter(i => i.status === SyncQueueStatus.FAILED);

    const oldestPending = pending.length > 0
      ? Math.min(...pending.map(i => i.created_at))
      : null;

    return {
      pending: pending.length,
      in_progress: inProgress.length,
      completed: completed.length,
      failed: failed.length,
      total: this.queue.length,
      oldest_pending: oldestPending,
    };
  }

  /**
   * Get all items in the queue
   */
  getAll(): SyncQueueItem[] {
    return [...this.queue];
  }

  /**
   * Check if queue has pending items
   */
  hasPending(): boolean {
    return this.queue.some(i => i.status === SyncQueueStatus.PENDING);
  }

  /**
   * Check if queue has failed items
   */
  hasFailed(): boolean {
    return this.queue.some(i => i.status === SyncQueueStatus.FAILED);
  }

  /**
   * Get item by ID
   */
  getItem(itemId: string): SyncQueueItem | undefined {
    return this.queue.find(i => i.id === itemId);
  }

  /**
   * Get items for a specific entity
   */
  getItemsForEntity(entityType: SyncEntityType, entityId: string): SyncQueueItem[] {
    return this.queue.filter(
      i => i.entity_type === entityType && i.entity_id === entityId
    );
  }
}

/**
 * Singleton instance of sync queue
 */
export const syncQueue = new SyncQueue();
