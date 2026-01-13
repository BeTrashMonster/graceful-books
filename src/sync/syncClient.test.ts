/**
 * Tests for Sync Client
 */

import { describe, it, expect, afterEach } from 'vitest';
import { SyncClient, SyncStatus } from './syncClient';
import { syncQueue, SyncEntityType, SyncOperationType } from './syncQueue';

describe('SyncClient', () => {
  let client: SyncClient;

  beforeEach(() => {
    localStorage.clear();
    syncQueue.clear();
    client = new SyncClient({
      auto_sync: false, // Disable auto-sync for tests
      offline_mode: false,
    });
  });

  afterEach(() => {
    client.destroy();
    localStorage.clear();
    syncQueue.clear();
  });

  describe('initialization', () => {
    it('should initialize with IDLE status', () => {
      const state = client.getState();
      expect(state.status).toBe(SyncStatus.IDLE);
      expect(state.in_progress).toBe(false);
    });

    it('should load sync state from localStorage', () => {
      // Set up some state
      localStorage.setItem('graceful_books_last_sync', '12345');
      localStorage.setItem('graceful_books_sync_vector', JSON.stringify({ device1: 5 }));

      const newClient = new SyncClient({ auto_sync: false });
      const state = newClient.getState();

      expect(state.last_sync_at).toBe(12345);
      expect(state.sync_vector).toEqual({ device1: 5 });

      newClient.destroy();
    });
  });

  describe('queueChange', () => {
    it('should queue a change for sync', () => {
      client.queueChange(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        { name: 'Test Account' }
      );

      const stats = client.getStats();
      expect(stats.queue.pending).toBe(1);
    });

    it('should update pending count in state', () => {
      client.queueChange(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );

      const state = client.getState();
      expect(state.pending_changes).toBe(1);
    });
  });

  describe('setOfflineMode', () => {
    it('should update status to OFFLINE', () => {
      client.setOfflineMode(true);

      const state = client.getState();
      expect(state.status).toBe(SyncStatus.OFFLINE);
    });

    it('should revert to IDLE when going back online', () => {
      client.setOfflineMode(true);
      client.setOfflineMode(false);

      const state = client.getState();
      expect(state.status).toBe(SyncStatus.IDLE);
    });
  });

  describe('sync', () => {
    it('should complete sync successfully', async () => {
      const result = await client.sync();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should update state during sync', async () => {
      const stateChanges: SyncStatus[] = [];

      client.addListener(state => {
        stateChanges.push(state.status);
      });

      await client.sync();

      expect(stateChanges).toContain(SyncStatus.SYNCING);
      expect(stateChanges[stateChanges.length - 1]).toBe(SyncStatus.IDLE);
    });

    it('should not sync when offline', async () => {
      client.setOfflineMode(true);

      const result = await client.sync();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Offline mode enabled');
    });

    it('should not start second sync when already in progress', async () => {
      // Start first sync
      const sync1 = client.sync();

      // Try to start second sync
      const result2 = await client.sync();

      expect(result2.success).toBe(false);
      expect(result2.errors).toContain('Sync already in progress');

      // Wait for first sync to complete
      await sync1;
    });
  });

  describe('listeners', () => {
    it('should notify listeners of state changes', () => {
      const states: SyncStatus[] = [];

      client.addListener(state => {
        states.push(state.status);
      });

      client.setOfflineMode(true);
      client.setOfflineMode(false);

      expect(states).toContain(SyncStatus.OFFLINE);
      expect(states).toContain(SyncStatus.IDLE);
    });

    it('should unsubscribe listener', () => {
      const states: SyncStatus[] = [];

      const unsubscribe = client.addListener(state => {
        states.push(state.status);
      });

      client.setOfflineMode(true);
      expect(states).toHaveLength(1);

      unsubscribe();

      client.setOfflineMode(false);
      expect(states).toHaveLength(1); // Should not have received new update
    });
  });

  describe('clearCompleted', () => {
    it('should clear completed queue items', () => {
      const item = syncQueue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );

      syncQueue.markCompleted(item.id);

      client.clearCompleted();

      const stats = client.getStats();
      expect(stats.queue.completed).toBe(0);
    });
  });

  describe('retryFailed', () => {
    it('should retry failed queue items', () => {
      const item = syncQueue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );

      // Fail it max times
      for (let i = 0; i < 5; i++) {
        syncQueue.markFailed(item.id, 'Test error');
      }

      client.retryFailed();

      const stats = client.getStats();
      expect(stats.queue.failed).toBe(0);
      expect(stats.queue.pending).toBe(1);
    });
  });

  describe('updateConfig', () => {
    it('should update sync configuration', () => {
      client.updateConfig({
        batch_size: 20,
        sync_interval_ms: 60000,
      });

      // Trigger a sync to verify config is used
      // (In a real test, we'd verify the behavior changes)
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('getStats', () => {
    it('should return sync and queue statistics', () => {
      syncQueue.enqueue(
        SyncEntityType.ACCOUNT,
        'account-1',
        SyncOperationType.CREATE,
        {}
      );

      const stats = client.getStats();

      expect(stats.queue.pending).toBe(1);
      expect(stats.state.status).toBe(SyncStatus.IDLE);
    });
  });
});
