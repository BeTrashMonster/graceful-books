/**
 * useSync Hook
 *
 * React hook for managing sync operations and state.
 * Provides methods to trigger sync and access sync state.
 *
 * Requirements:
 * - B6: Sync Relay Client
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createSyncClient, SyncStatus } from '../sync/syncClient';
import type { SyncClient, SyncState, SyncResult, SyncConfig } from '../sync/syncClient';
import { SyncEntityType, SyncOperationType } from '../sync/syncQueue';

/**
 * Sync hook return type
 */
export interface UseSyncReturn {
  // State
  state: SyncState;
  isSyncing: boolean;
  isOffline: boolean;
  hasError: boolean;
  hasPendingChanges: boolean;

  // Actions
  sync: () => Promise<SyncResult>;
  queueChange: (
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperationType,
    payload: any
  ) => void;
  setOfflineMode: (offline: boolean) => void;
  clearCompleted: () => void;
  retryFailed: () => void;
  updateConfig: (config: Partial<SyncConfig>) => void;

  // Stats
  stats: ReturnType<SyncClient['getStats']>;
}

/**
 * Hook for sync functionality
 */
export function useSync(config?: Partial<SyncConfig>): UseSyncReturn {
  const clientRef = useRef<SyncClient | null>(null);
  const [state, setState] = useState<SyncState>({
    status: SyncStatus.IDLE,
    last_sync_at: null,
    last_error: null,
    pending_changes: 0,
    in_progress: false,
    sync_vector: {},
  });
  const [stats, setStats] = useState<ReturnType<SyncClient['getStats']>>(() => ({
    queue: {
      pending: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
      total: 0,
      oldest_pending: null as number | null,
    },
    state: {
      status: SyncStatus.IDLE,
      last_sync_at: null,
      last_error: null,
      pending_changes: 0,
      in_progress: false,
      sync_vector: {},
    },
  }));

  // Initialize sync client
  useEffect(() => {
    const client = createSyncClient(config);
    clientRef.current = client;

    // Set initial state
    setState(client.getState());
    setStats(client.getStats());

    // Listen for state changes
    const unsubscribe = client.addListener(newState => {
      setState(newState);
      setStats(client.getStats());
    });

    return () => {
      unsubscribe();
      client.destroy();
      clientRef.current = null;
    };
  }, []); // Empty deps - only run once

  // Sync action
  const sync = useCallback(async (): Promise<SyncResult> => {
    if (!clientRef.current) {
      throw new Error('Sync client not initialized');
    }
    return clientRef.current.sync();
  }, []);

  // Queue change action
  const queueChange = useCallback(
    (
      entityType: SyncEntityType,
      entityId: string,
      operation: SyncOperationType,
      payload: any
    ) => {
      if (!clientRef.current) {
        throw new Error('Sync client not initialized');
      }
      clientRef.current.queueChange(entityType, entityId, operation, payload);
    },
    []
  );

  // Set offline mode
  const setOfflineMode = useCallback((offline: boolean) => {
    if (!clientRef.current) {
      throw new Error('Sync client not initialized');
    }
    clientRef.current.setOfflineMode(offline);
  }, []);

  // Clear completed
  const clearCompleted = useCallback(() => {
    if (!clientRef.current) {
      throw new Error('Sync client not initialized');
    }
    clientRef.current.clearCompleted();
  }, []);

  // Retry failed
  const retryFailed = useCallback(() => {
    if (!clientRef.current) {
      throw new Error('Sync client not initialized');
    }
    clientRef.current.retryFailed();
  }, []);

  // Update config
  const updateConfig = useCallback((newConfig: Partial<SyncConfig>) => {
    if (!clientRef.current) {
      throw new Error('Sync client not initialized');
    }
    clientRef.current.updateConfig(newConfig);
  }, []);

  return {
    // State
    state,
    isSyncing: state.status === SyncStatus.SYNCING,
    isOffline: state.status === SyncStatus.OFFLINE,
    hasError: state.status === SyncStatus.ERROR,
    hasPendingChanges: state.pending_changes > 0,

    // Actions
    sync,
    queueChange,
    setOfflineMode,
    clearCompleted,
    retryFailed,
    updateConfig,

    // Stats
    stats,
  };
}
