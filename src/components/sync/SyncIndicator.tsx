/**
 * SyncIndicator Component
 *
 * Shows sync status icon with tooltip.
 * Displays current sync state and provides quick access to sync actions.
 *
 * Requirements:
 * - B6: Sync Relay Client
 */

import { useSyncStatus, formatSyncTimestamp } from '../../hooks/useSyncStatus';

export interface SyncIndicatorProps {
  showText?: boolean;
  showPending?: boolean;
  className?: string;
}

/**
 * Sync status indicator component
 */
export function SyncIndicator({
  showText = false,
  showPending = true,
  className = '',
}: SyncIndicatorProps): JSX.Element {
  const {
    statusText,
    statusColor,
    isSyncing,
    lastSyncText,
    pendingText,
    hasPendingChanges,
    errorMessage,
    sync,
  } = useSyncStatus();

  // Determine indicator style
  const getIndicatorClass = (): string => {
    const baseClass = 'sync-indicator';
    const colorClass = {
      green: 'sync-indicator--success',
      yellow: 'sync-indicator--warning',
      red: 'sync-indicator--error',
      gray: 'sync-indicator--offline',
    }[statusColor];

    return `${baseClass} ${colorClass}`;
  };

  // Handle click to trigger sync
  const handleClick = (): void => {
    if (!isSyncing) {
      sync().catch(error => {
        console.error('Manual sync failed:', error);
      });
    }
  };

  return (
    <div
      className={`sync-indicator-container ${className}`}
      onClick={handleClick}
      title={
        errorMessage ||
        `${statusText}${lastSyncText ? ` - Last sync: ${lastSyncText}` : ''}`
      }
    >
      {/* Indicator dot */}
      <div className={getIndicatorClass()}>
        {isSyncing && <span className="sync-indicator__spinner" />}
      </div>

      {/* Status text */}
      {showText && <span className="sync-indicator__text">{statusText}</span>}

      {/* Pending count */}
      {showPending && hasPendingChanges && (
        <span className="sync-indicator__pending">{pendingText}</span>
      )}
    </div>
  );
}

/**
 * Detailed sync status component with more information
 */
export function SyncIndicatorDetailed(): JSX.Element {
  const {
    statusText,
    statusColor,
    isSyncing,
    isOffline,
    hasError,
    lastSyncText,
    lastSyncTimestamp,
    pendingText,
    hasPendingChanges,
    errorMessage,
    sync,
    retryFailed,
  } = useSyncStatus();

  const handleSync = (): void => {
    sync().catch(error => {
      console.error('Manual sync failed:', error);
    });
  };

  const handleRetry = (): void => {
    retryFailed();
    handleSync();
  };

  return (
    <div className="sync-indicator-detailed">
      <div className="sync-indicator-detailed__header">
        <div className="sync-indicator-detailed__status">
          <div
            className={`sync-indicator sync-indicator--${statusColor}`}
            aria-label={statusText}
          >
            {isSyncing && <span className="sync-indicator__spinner" />}
          </div>
          <span className="sync-indicator-detailed__status-text">{statusText}</span>
        </div>

        {!isSyncing && !isOffline && (
          <button
            className="sync-indicator-detailed__sync-button"
            onClick={handleSync}
            aria-label="Sync now"
          >
            Sync Now
          </button>
        )}
      </div>

      <div className="sync-indicator-detailed__info">
        {/* Last sync time */}
        {lastSyncText && (
          <div className="sync-indicator-detailed__last-sync">
            <span className="sync-indicator-detailed__label">Last synced:</span>
            <span className="sync-indicator-detailed__value">
              {lastSyncText}
              {lastSyncTimestamp && (
                <span className="sync-indicator-detailed__timestamp">
                  {' '}
                  ({formatSyncTimestamp(lastSyncTimestamp)})
                </span>
              )}
            </span>
          </div>
        )}

        {/* Pending changes */}
        {hasPendingChanges && (
          <div className="sync-indicator-detailed__pending">
            <span className="sync-indicator-detailed__label">Pending:</span>
            <span className="sync-indicator-detailed__value">{pendingText}</span>
          </div>
        )}

        {/* Error message */}
        {hasError && errorMessage && (
          <div className="sync-indicator-detailed__error">
            <span className="sync-indicator-detailed__label">Error:</span>
            <span className="sync-indicator-detailed__value">{errorMessage}</span>
            <button
              className="sync-indicator-detailed__retry-button"
              onClick={handleRetry}
            >
              Retry
            </button>
          </div>
        )}

        {/* Offline message */}
        {isOffline && (
          <div className="sync-indicator-detailed__offline">
            <span className="sync-indicator-detailed__value">
              You are working offline. Changes will sync when you're back online.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Basic CSS for sync indicator
 * (This would normally be in a separate .css file)
 */
export const syncIndicatorStyles = `
.sync-indicator-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.sync-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  position: relative;
  display: inline-block;
}

.sync-indicator--success {
  background-color: #22c55e;
}

.sync-indicator--warning {
  background-color: #f59e0b;
}

.sync-indicator--error {
  background-color: #ef4444;
}

.sync-indicator--offline {
  background-color: #9ca3af;
}

.sync-indicator__spinner {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: sync-spin 1s linear infinite;
}

@keyframes sync-spin {
  to { transform: rotate(360deg); }
}

.sync-indicator__text {
  font-size: 0.875rem;
  color: #6b7280;
}

.sync-indicator__pending {
  font-size: 0.75rem;
  color: #9ca3af;
}

.sync-indicator-detailed {
  padding: 1rem;
  background-color: #f9fafb;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.sync-indicator-detailed__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.sync-indicator-detailed__status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sync-indicator-detailed__status-text {
  font-weight: 500;
  color: #111827;
}

.sync-indicator-detailed__sync-button,
.sync-indicator-detailed__retry-button {
  padding: 0.25rem 0.75rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.sync-indicator-detailed__sync-button:hover,
.sync-indicator-detailed__retry-button:hover {
  background-color: #2563eb;
}

.sync-indicator-detailed__info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.sync-indicator-detailed__label {
  color: #6b7280;
  margin-right: 0.5rem;
}

.sync-indicator-detailed__value {
  color: #111827;
}

.sync-indicator-detailed__timestamp {
  color: #9ca3af;
  font-size: 0.75rem;
}

.sync-indicator-detailed__error {
  color: #dc2626;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sync-indicator-detailed__offline {
  color: #6b7280;
  font-style: italic;
}
`;
