/**
 * Sync Client
 *
 * Main sync client for encrypted relay sync using CRDT infrastructure.
 * Handles push/pull operations, conflict resolution, and sync state management.
 *
 * Requirements:
 * - ARCH-003: Sync infrastructure
 * - ARCH-004: CRDT conflict resolution
 * - B6: Sync Relay Client
 */

import { getDeviceId } from '../db/crdt';
import type { VersionVector } from '../types/database.types';
import { syncQueue, SyncEntityType, SyncOperationType } from './syncQueue';
import {
  createPushRequest,
  createPullRequest,
  validatePushResponse,
  validatePullResponse,
  batchChanges,
} from './syncProtocol';
import type { SyncChange } from './syncProtocol';
import { ConflictStrategy } from './conflictResolution';
import { syncApi } from '../api/syncApi';

/**
 * Sync status
 */
export enum SyncStatus {
  IDLE = 'IDLE',
  SYNCING = 'SYNCING',
  OFFLINE = 'OFFLINE',
  ERROR = 'ERROR',
}

/**
 * Sync state
 */
export interface SyncState {
  status: SyncStatus;
  last_sync_at: number | null;
  last_error: string | null;
  pending_changes: number;
  in_progress: boolean;
  sync_vector: VersionVector;
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  conflicts_resolved: number;
  errors: string[];
  duration_ms: number;
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  auto_sync: boolean;
  sync_interval_ms: number;
  batch_size: number;
  max_retries: number;
  conflict_strategy: ConflictStrategy;
  offline_mode: boolean;
}

/**
 * Default sync configuration
 */
const DEFAULT_CONFIG: SyncConfig = {
  auto_sync: true,
  sync_interval_ms: 30000, // 30 seconds
  batch_size: 10,
  max_retries: 3,
  conflict_strategy: ConflictStrategy.AUTO,
  offline_mode: false,
};

/**
 * Sync Client
 *
 * Manages synchronization of encrypted data with remote relay server.
 */
export class SyncClient {
  private deviceId: string;
  private config: SyncConfig;
  private state: SyncState;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(state: SyncState) => void> = new Set();

  constructor(config: Partial<SyncConfig> = {}) {
    this.deviceId = getDeviceId();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      status: SyncStatus.IDLE,
      last_sync_at: this.getLastSyncTimestamp(),
      last_error: null,
      pending_changes: 0,
      in_progress: false,
      sync_vector: this.loadSyncVector(),
    };

    // Start auto-sync if enabled
    if (this.config.auto_sync && !this.config.offline_mode) {
      this.startAutoSync();
    }
  }

  /**
   * Get current sync state
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * Add state change listener
   */
  addListener(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners of state change
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }

  /**
   * Update sync state
   */
  private updateState(updates: Partial<SyncState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  /**
   * Load sync vector from storage
   */
  private loadSyncVector(): VersionVector {
    try {
      const stored = localStorage.getItem('graceful_books_sync_vector');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load sync vector:', error);
    }
    return {};
  }

  /**
   * Save sync vector to storage
   * Intentionally unused - kept for future implementation
   */
  // @ts-ignore - Intentionally unused private method
  private _saveSyncVector(_vector: VersionVector): void {
    // Currently not used, but kept for future implementation
    // try {
    //   localStorage.setItem('graceful_books_sync_vector', JSON.stringify(vector));
    // } catch (error) {
    //   console.error('Failed to save sync vector:', error);
    // }
  }

  /**
   * Get last sync timestamp
   */
  private getLastSyncTimestamp(): number | null {
    try {
      const stored = localStorage.getItem('graceful_books_last_sync');
      if (stored) {
        return parseInt(stored, 10);
      }
    } catch (error) {
      console.error('Failed to load last sync timestamp:', error);
    }
    return null;
  }

  /**
   * Save last sync timestamp
   */
  private saveLastSyncTimestamp(timestamp: number): void {
    try {
      localStorage.setItem('graceful_books_last_sync', timestamp.toString());
    } catch (error) {
      console.error('Failed to save last sync timestamp:', error);
    }
  }

  /**
   * Queue a change for sync
   */
  queueChange(
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperationType,
    payload: any
  ): void {
    syncQueue.enqueue(entityType, entityId, operation, payload);
    this.updateState({
      pending_changes: syncQueue.getStats().pending,
    });
  }

  /**
   * Perform full sync (push and pull)
   */
  async sync(): Promise<SyncResult> {
    if (this.config.offline_mode) {
      return {
        success: false,
        pushed: 0,
        pulled: 0,
        conflicts_resolved: 0,
        errors: ['Offline mode enabled'],
        duration_ms: 0,
      };
    }

    if (this.state.in_progress) {
      return {
        success: false,
        pushed: 0,
        pulled: 0,
        conflicts_resolved: 0,
        errors: ['Sync already in progress'],
        duration_ms: 0,
      };
    }

    const startTime = Date.now();
    const errors: string[] = [];

    this.updateState({
      status: SyncStatus.SYNCING,
      in_progress: true,
      last_error: null,
    });

    try {
      // Push local changes
      const pushResult = await this.push();
      if (!pushResult.success) {
        errors.push(...pushResult.errors);
      }

      // Pull remote changes
      const pullResult = await this.pull();
      if (!pullResult.success) {
        errors.push(...pullResult.errors);
      }

      const success = errors.length === 0;
      const timestamp = Date.now();

      if (success) {
        this.saveLastSyncTimestamp(timestamp);
      }

      this.updateState({
        status: success ? SyncStatus.IDLE : SyncStatus.ERROR,
        in_progress: false,
        last_sync_at: success ? timestamp : this.state.last_sync_at,
        last_error: errors.length > 0 ? errors[0] : null,
        pending_changes: syncQueue.getStats().pending,
      });

      return {
        success,
        pushed: pushResult.pushed,
        pulled: pullResult.pulled,
        conflicts_resolved: pullResult.conflicts_resolved,
        errors,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      this.updateState({
        status: SyncStatus.ERROR,
        in_progress: false,
        last_error: errorMessage,
      });

      return {
        success: false,
        pushed: 0,
        pulled: 0,
        conflicts_resolved: 0,
        errors,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Push local changes to remote
   */
  private async push(): Promise<{
    success: boolean;
    pushed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let totalPushed = 0;

    try {
      // Get pending items
      const pending = syncQueue.getNextBatch(this.config.batch_size);

      if (pending.length === 0) {
        return { success: true, pushed: 0, errors: [] };
      }

      // Convert queue items to sync changes
      const changes: SyncChange[] = pending.map(item => ({
        id: item.id,
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        operation: item.operation,
        encrypted_payload: JSON.stringify(item.payload),
        version_vector: item.payload.version_vector || {},
        timestamp: item.created_at,
      }));

      // Batch changes if needed
      const batches = batchChanges(changes, this.config.batch_size);

      // Push each batch
      for (const batch of batches) {
        try {
          const request = createPushRequest(this.deviceId, batch);
          const response = await syncApi.push(request);

          if (!validatePushResponse(response)) {
            errors.push('Invalid push response from server');
            continue;
          }

          // Mark accepted changes as completed
          for (const id of response.accepted) {
            syncQueue.markCompleted(id);
            totalPushed++;
          }

          // Mark rejected changes as failed
          for (const rejected of response.rejected) {
            syncQueue.markFailed(rejected.id, rejected.reason);
            errors.push(`Failed to sync ${rejected.id}: ${rejected.reason}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Batch push failed: ${errorMessage}`);

          // Mark all items in batch as failed
          for (const change of batch) {
            syncQueue.markFailed(change.id, errorMessage);
          }
        }
      }

      return {
        success: errors.length === 0,
        pushed: totalPushed,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        pushed: totalPushed,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Pull remote changes
   */
  private async pull(): Promise<{
    success: boolean;
    pulled: number;
    conflicts_resolved: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let totalPulled = 0;
    const conflictsResolved = 0;

    try {
      const sinceTimestamp = this.state.last_sync_at || 0;
      const request = createPullRequest(
        this.deviceId,
        sinceTimestamp,
        this.state.sync_vector
      );

      const response = await syncApi.pull(request);

      if (!validatePullResponse(response)) {
        return {
          success: false,
          pulled: 0,
          conflicts_resolved: 0,
          errors: ['Invalid pull response from server'],
        };
      }

      // Process pulled changes
      // Note: In a real implementation, this would update the local database
      // For now, we just count the changes
      totalPulled = response.changes.length;

      // TODO: Apply changes to local database with conflict resolution
      // This would involve:
      // 1. Decrypt the encrypted payloads
      // 2. Apply changes to the appropriate database tables
      // 3. Use conflict resolution for concurrent modifications
      // 4. Update sync vector

      return {
        success: true,
        pulled: totalPulled,
        conflicts_resolved: conflictsResolved,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        pulled: totalPulled,
        conflicts_resolved: conflictsResolved,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Start automatic sync
   */
  startAutoSync(): void {
    if (this.syncTimer) {
      return; // Already started
    }

    this.syncTimer = setInterval(() => {
      if (!this.config.offline_mode && !this.state.in_progress) {
        this.sync().catch(error => {
          console.error('Auto-sync failed:', error);
        });
      }
    }, this.config.sync_interval_ms);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Enable offline mode
   */
  setOfflineMode(offline: boolean): void {
    this.config.offline_mode = offline;
    this.updateState({
      status: offline ? SyncStatus.OFFLINE : SyncStatus.IDLE,
    });

    if (offline) {
      this.stopAutoSync();
    } else if (this.config.auto_sync) {
      this.startAutoSync();
    }
  }

  /**
   * Update sync configuration
   */
  updateConfig(updates: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...updates };

    // Restart auto-sync if interval changed
    if (updates.sync_interval_ms !== undefined && this.syncTimer) {
      this.stopAutoSync();
      this.startAutoSync();
    }
  }

  /**
   * Get sync statistics
   */
  getStats(): {
    queue: ReturnType<typeof syncQueue.getStats>;
    state: SyncState;
  } {
    return {
      queue: syncQueue.getStats(),
      state: this.getState(),
    };
  }

  /**
   * Clear completed sync items
   */
  clearCompleted(): void {
    syncQueue.clearCompleted();
    this.updateState({
      pending_changes: syncQueue.getStats().pending,
    });
  }

  /**
   * Retry failed sync items
   */
  retryFailed(): void {
    syncQueue.retryAll();
    this.updateState({
      pending_changes: syncQueue.getStats().pending,
    });
  }

  /**
   * Destroy sync client
   */
  destroy(): void {
    this.stopAutoSync();
    this.listeners.clear();
  }
}

/**
 * Create singleton sync client instance
 */
export function createSyncClient(config?: Partial<SyncConfig>): SyncClient {
  return new SyncClient(config);
}
