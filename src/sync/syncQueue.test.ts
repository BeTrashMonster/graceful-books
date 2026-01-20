/**
 * Tests for Sync Queue
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  SyncQueue,
  SyncOperationType,
  SyncEntityType,
  SyncQueueStatus,
} from './syncQueue';

describe('SyncQueue', () => {
  let queue: SyncQueue;

  beforeEach(() => {
    localStorage.clear();
    queue = new SyncQueue();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('enqueue', () => {
    it('should add item to queue', () => {
      const item = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        { name: 'Test Account' }
      );

      expect(item).toBeDefined();
      expect(item.entity_type).toBe(SyncEntityType.ACCOUNT);
      expect(item.entity_id).toBe('account-1');
      expect(item.operation).toBe(SyncOperationType.CREATE);
      expect(item.status).toBe(SyncQueueStatus.PENDING);
    });

    it('should generate unique IDs', () => {
      const item1 = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );
      const item2 = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-2',
        SyncOperationType.CREATE,
        {}
      );

      expect(item1.id).not.toBe(item2.id);
    });

    it('should persist to localStorage', () => {
      queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );

      const newQueue = new SyncQueue();
      expect(newQueue.getAll()).toHaveLength(1);
    });
  });

  describe('getPending', () => {
    it('should return only pending items', () => {
      queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );
      const item2 = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-2',
        SyncOperationType.CREATE,
        {}
      );
      queue.markCompleted(item2.id);

      const pending = queue.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0]?.entity_id).toBe('account-1');
    });
  });

  describe('getNextBatch', () => {
    it('should return limited number of items', () => {
      for (let i = 0; i < 15; i++) {
        queue.enqueue(
          SyncEntityType.ACCOUNT,
          `account-${i}`,
          SyncOperationType.CREATE,
          {}
        );
      }

      const batch = queue.getNextBatch(10);
      expect(batch).toHaveLength(10);
    });

    it('should return all items if less than batch size', () => {
      for (let i = 0; i < 5; i++) {
        queue.enqueue(
          SyncEntityType.ACCOUNT,
          `account-${i}`,
          SyncOperationType.CREATE,
          {}
        );
      }

      const batch = queue.getNextBatch(10);
      expect(batch).toHaveLength(5);
    });
  });

  describe('markInProgress', () => {
    it('should update status to in progress', () => {
      const item = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );

      queue.markInProgress(item.id);

      const inProgress = queue.getInProgress();
      expect(inProgress).toHaveLength(1);
      expect(inProgress[0]?.id).toBe(item.id);
    });
  });

  describe('markCompleted', () => {
    it('should update status to completed', () => {
      const item = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );

      queue.markCompleted(item.id);

      const completed = queue.getAll().filter((i: any) => i.status === SyncQueueStatus.COMPLETED);
      expect(completed).toHaveLength(1);
      expect(completed[0]?.completed_at).toBeGreaterThan(0);
    });
  });

  describe('markFailed', () => {
    it('should increment retry count', () => {
      const item = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );

      queue.markFailed(item.id, 'Test error');

      const updated = queue.getItem(item.id);
      expect(updated?.retry_count).toBe(1);
      expect(updated?.last_error).toBe('Test error');
    });

    it('should set to pending for retry if under max retries', () => {
      const item = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );

      queue.markFailed(item.id, 'Test error');

      const updated = queue.getItem(item.id);
      expect(updated?.status).toBe(SyncQueueStatus.PENDING);
    });

    it('should set to failed after max retries', () => {
      const item = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );

      // Fail 5 times (max retries)
      for (let i = 0; i < 5; i++) {
        queue.markFailed(item.id, 'Test error');
      }

      const updated = queue.getItem(item.id);
      expect(updated?.status).toBe(SyncQueueStatus.FAILED);
      expect(updated?.retry_count).toBe(5);
    });
  });

  describe('retry', () => {
    it('should reset failed item to pending', () => {
      const item = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );

      // Fail it max times
      for (let i = 0; i < 5; i++) {
        queue.markFailed(item.id, 'Test error');
      }

      queue.retry(item.id);

      const updated = queue.getItem(item.id);
      expect(updated?.status).toBe(SyncQueueStatus.PENDING);
      expect(updated?.retry_count).toBe(0);
      expect(updated?.last_error).toBeNull();
    });
  });

  describe('retryAll', () => {
    it('should retry all failed items', () => {
      const item1 = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );
      const item2 = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-2',
        SyncOperationType.CREATE,
        {}
      );

      // Fail both
      for (let i = 0; i < 5; i++) {
        queue.markFailed(item1.id, 'Error 1');
        queue.markFailed(item2.id, 'Error 2');
      }

      queue.retryAll();

      const failed = queue.getFailed();
      expect(failed).toHaveLength(0);

      const pending = queue.getPending();
      expect(pending).toHaveLength(2);
    });
  });

  describe('clearCompleted', () => {
    it('should remove completed items', () => {
      const item1 = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );
      const item2 = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-2',
        SyncOperationType.CREATE,
        {}
      );

      queue.markCompleted(item1.id);

      queue.clearCompleted();

      expect(queue.getAll()).toHaveLength(1);
      expect(queue.getAll()[0]?.id).toBe(item2.id);
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      const item1 = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );
      const item2 = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-2',
        SyncOperationType.CREATE,
        {}
      );
      const item3 = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-3',
        SyncOperationType.CREATE,
        {}
      );

      queue.markInProgress(item1.id);
      queue.markCompleted(item2.id);
      for (let i = 0; i < 5; i++) {
        queue.markFailed(item3.id, 'Error');
      }

      const stats = queue.getStats();

      expect(stats.pending).toBe(0);
      expect(stats.in_progress).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.total).toBe(3);
    });

    it('should track oldest pending timestamp', () => {
      const item1 = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );

      const stats = queue.getStats();
      expect(stats.oldest_pending).toBe(item1.created_at);
    });
  });

  describe('hasPending', () => {
    it('should return true when items are pending', () => {
      queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );

      expect(queue.hasPending()).toBe(true);
    });

    it('should return false when no items are pending', () => {
      const item = queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );
      queue.markCompleted(item.id);

      expect(queue.hasPending()).toBe(false);
    });
  });

  describe('getItemsForEntity', () => {
    it('should return items for specific entity', () => {
      queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );
      queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.UPDATE,
        {}
      );
      queue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-2',
        SyncOperationType.CREATE,
        {}
      );

      const items = queue.getItemsForEntity(SyncEntityType.ACCOUNT, 'account-1');
      expect(items).toHaveLength(2);
    });
  });
});
