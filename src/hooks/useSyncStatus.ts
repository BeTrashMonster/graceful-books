/**
 * useSyncStatus Hook
 *
 * Lightweight hook for displaying sync status in UI components.
 * Provides formatted sync state for display purposes.
 *
 * Requirements:
 * - B6: Sync Relay Client
 */

import { useMemo } from 'react';
import { useSync } from './useSync';
import type { UseSyncReturn } from './useSync';
import { SyncStatus } from '../sync/syncClient';

/**
 * Sync status display information
 */
export interface SyncStatusDisplay {
  // Status
  status: SyncStatus;
  statusText: string;
  statusColor: 'green' | 'yellow' | 'red' | 'gray';
  isSyncing: boolean;
  isOffline: boolean;
  hasError: boolean;

  // Last sync
  lastSyncText: string | null;
  lastSyncTimestamp: number | null;

  // Pending changes
  pendingCount: number;
  hasPendingChanges: boolean;
  pendingText: string;

  // Error
  errorMessage: string | null;

  // Actions
  sync: UseSyncReturn['sync'];
  retryFailed: UseSyncReturn['retryFailed'];
}

/**
 * Hook for sync status display
 */
export function useSyncStatus(): SyncStatusDisplay {
  const { state, isSyncing, isOffline, hasError, hasPendingChanges, sync, retryFailed } =
    useSync();

  // Format status text
  const statusText = useMemo(() => {
    switch (state.status) {
      case SyncStatus.SYNCING:
        return 'Syncing...';
      case SyncStatus.OFFLINE:
        return 'Offline';
      case SyncStatus.ERROR:
        return 'Sync Error';
      case SyncStatus.IDLE:
      default:
        if (state.last_sync_at) {
          return 'Synced';
        }
        return 'Not synced';
    }
  }, [state.status, state.last_sync_at]);

  // Determine status color
  const statusColor = useMemo((): 'green' | 'yellow' | 'red' | 'gray' => {
    switch (state.status) {
      case SyncStatus.SYNCING:
        return 'yellow';
      case SyncStatus.ERROR:
        return 'red';
      case SyncStatus.OFFLINE:
        return 'gray';
      case SyncStatus.IDLE:
      default:
        if (hasPendingChanges) {
          return 'yellow';
        }
        return 'green';
    }
  }, [state.status, hasPendingChanges]);

  // Format last sync time
  const lastSyncText = useMemo(() => {
    if (!state.last_sync_at) {
      return null;
    }

    const now = Date.now();
    const diff = now - state.last_sync_at;

    // Less than a minute
    if (diff < 60 * 1000) {
      return 'Just now';
    }

    // Less than an hour
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }

    // Less than a day
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }

    // Days ago
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (days === 1) {
      return 'Yesterday';
    }
    return `${days} days ago`;
  }, [state.last_sync_at]);

  // Format pending count
  const pendingText = useMemo(() => {
    const count = state.pending_changes;
    if (count === 0) {
      return 'No pending changes';
    }
    if (count === 1) {
      return '1 change pending';
    }
    return `${count} changes pending`;
  }, [state.pending_changes]);

  return {
    // Status
    status: state.status,
    statusText,
    statusColor,
    isSyncing,
    isOffline,
    hasError,

    // Last sync
    lastSyncText,
    lastSyncTimestamp: state.last_sync_at,

    // Pending changes
    pendingCount: state.pending_changes,
    hasPendingChanges,
    pendingText,

    // Error
    errorMessage: state.last_error,

    // Actions
    sync,
    retryFailed,
  };
}

/**
 * Format timestamp for display
 */
export function formatSyncTimestamp(timestamp: number | null): string {
  if (!timestamp) {
    return 'Never';
  }

  const date = new Date(timestamp);
  const now = new Date();

  // If today, show time
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  // If this year, show month and day
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  // Otherwise, show full date
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get sync status icon
 */
export function getSyncStatusIcon(status: SyncStatus): string {
  switch (status) {
    case SyncStatus.SYNCING:
      return '🔄';
    case SyncStatus.OFFLINE:
      return '📴';
    case SyncStatus.ERROR:
      return '⚠️';
    case SyncStatus.IDLE:
    default:
      return '✓';
  }
}
