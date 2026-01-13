/**
 * SyncSettings Component
 *
 * Configure sync options and view sync statistics.
 * Allows users to control sync behavior and troubleshoot sync issues.
 *
 * Requirements:
 * - B6: Sync Relay Client
 */

import { useState } from 'react';
import { useSync } from '../../hooks/useSync';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { ConflictStrategy } from '../../sync/conflictResolution';

/**
 * Sync settings component
 */
export function SyncSettings(): JSX.Element {
  const { state, stats, updateConfig, setOfflineMode, clearCompleted, retryFailed, sync } =
    useSync();
  const { isSyncing, pendingCount } = useSyncStatus();

  // Local state for configuration
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState(30);
  const [batchSize, setBatchSize] = useState(10);
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>(
    ConflictStrategy.AUTO
  );

  // Handle configuration changes
  const handleApplyConfig = (): void => {
    updateConfig({
      auto_sync: autoSync,
      sync_interval_ms: syncInterval * 1000,
      batch_size: batchSize,
      conflict_strategy: conflictStrategy,
    });
  };

  // Handle manual sync
  const handleSync = (): void => {
    sync().catch(error => {
      console.error('Manual sync failed:', error);
    });
  };

  // Handle offline toggle
  const handleOfflineToggle = (offline: boolean): void => {
    setOfflineMode(offline);
  };

  return (
    <div className="sync-settings">
      <h2 className="sync-settings__title">Sync Settings</h2>

      {/* Sync Status Section */}
      <section className="sync-settings__section">
        <h3 className="sync-settings__section-title">Sync Status</h3>

        <div className="sync-settings__status">
          <div className="sync-settings__status-item">
            <span className="sync-settings__label">Current Status:</span>
            <span className="sync-settings__value">{state.status}</span>
          </div>

          <div className="sync-settings__status-item">
            <span className="sync-settings__label">Pending Changes:</span>
            <span className="sync-settings__value">{pendingCount}</span>
          </div>

          <div className="sync-settings__status-item">
            <span className="sync-settings__label">Last Sync:</span>
            <span className="sync-settings__value">
              {state.last_sync_at
                ? new Date(state.last_sync_at).toLocaleString()
                : 'Never'}
            </span>
          </div>

          {state.last_error && (
            <div className="sync-settings__status-item sync-settings__status-item--error">
              <span className="sync-settings__label">Last Error:</span>
              <span className="sync-settings__value">{state.last_error}</span>
            </div>
          )}
        </div>

        <div className="sync-settings__actions">
          <button
            className="sync-settings__button sync-settings__button--primary"
            onClick={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>

          <button
            className="sync-settings__button"
            onClick={() => handleOfflineToggle(!state.status.includes('OFFLINE'))}
          >
            {state.status.includes('OFFLINE') ? 'Go Online' : 'Go Offline'}
          </button>
        </div>
      </section>

      {/* Configuration Section */}
      <section className="sync-settings__section">
        <h3 className="sync-settings__section-title">Configuration</h3>

        <div className="sync-settings__config">
          <div className="sync-settings__config-item">
            <label className="sync-settings__config-label">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={e => setAutoSync(e.target.checked)}
              />
              <span>Enable automatic sync</span>
            </label>
          </div>

          <div className="sync-settings__config-item">
            <label className="sync-settings__config-label">
              <span>Sync interval (seconds):</span>
              <input
                type="number"
                min="10"
                max="300"
                value={syncInterval}
                onChange={e => setSyncInterval(parseInt(e.target.value, 10))}
                className="sync-settings__config-input"
              />
            </label>
          </div>

          <div className="sync-settings__config-item">
            <label className="sync-settings__config-label">
              <span>Batch size:</span>
              <input
                type="number"
                min="1"
                max="100"
                value={batchSize}
                onChange={e => setBatchSize(parseInt(e.target.value, 10))}
                className="sync-settings__config-input"
              />
            </label>
          </div>

          <div className="sync-settings__config-item">
            <label className="sync-settings__config-label">
              <span>Conflict resolution strategy:</span>
              <select
                value={conflictStrategy}
                onChange={e => setConflictStrategy(e.target.value as ConflictStrategy)}
                className="sync-settings__config-select"
              >
                <option value={ConflictStrategy.AUTO}>Automatic (recommended)</option>
                <option value={ConflictStrategy.LOCAL_WINS}>Local always wins</option>
                <option value={ConflictStrategy.REMOTE_WINS}>Remote always wins</option>
                <option value={ConflictStrategy.MANUAL}>Manual resolution</option>
              </select>
            </label>
          </div>

          <button
            className="sync-settings__button sync-settings__button--primary"
            onClick={handleApplyConfig}
          >
            Apply Configuration
          </button>
        </div>
      </section>

      {/* Queue Statistics Section */}
      <section className="sync-settings__section">
        <h3 className="sync-settings__section-title">Queue Statistics</h3>

        <div className="sync-settings__stats">
          <div className="sync-settings__stat">
            <span className="sync-settings__stat-label">Pending:</span>
            <span className="sync-settings__stat-value">{stats.queue.pending}</span>
          </div>

          <div className="sync-settings__stat">
            <span className="sync-settings__stat-label">In Progress:</span>
            <span className="sync-settings__stat-value">{stats.queue.in_progress}</span>
          </div>

          <div className="sync-settings__stat">
            <span className="sync-settings__stat-label">Completed:</span>
            <span className="sync-settings__stat-value">{stats.queue.completed}</span>
          </div>

          <div className="sync-settings__stat">
            <span className="sync-settings__stat-label">Failed:</span>
            <span className="sync-settings__stat-value">{stats.queue.failed}</span>
          </div>

          <div className="sync-settings__stat">
            <span className="sync-settings__stat-label">Total:</span>
            <span className="sync-settings__stat-value">{stats.queue.total}</span>
          </div>
        </div>

        <div className="sync-settings__actions">
          <button
            className="sync-settings__button"
            onClick={clearCompleted}
            disabled={stats.queue.completed === 0}
          >
            Clear Completed
          </button>

          <button
            className="sync-settings__button"
            onClick={retryFailed}
            disabled={stats.queue.failed === 0}
          >
            Retry Failed
          </button>
        </div>
      </section>

      {/* Help Section */}
      <section className="sync-settings__section">
        <h3 className="sync-settings__section-title">About Sync</h3>
        <div className="sync-settings__help">
          <p>
            Your data is automatically synced across all your devices using encrypted relay
            servers. All data is encrypted before leaving your device, so nobody can read
            your information except you.
          </p>
          <p>
            <strong>Offline Mode:</strong> You can work offline, and your changes will be
            synced when you're back online.
          </p>
          <p>
            <strong>Conflict Resolution:</strong> If you edit the same data on multiple
            devices, conflicts are automatically resolved using the configured strategy.
          </p>
        </div>
      </section>
    </div>
  );
}

/**
 * Basic CSS for sync settings
 * (This would normally be in a separate .css file)
 */
export const syncSettingsStyles = `
.sync-settings {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.sync-settings__title {
  font-size: 1.875rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  color: #111827;
}

.sync-settings__section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background-color: #ffffff;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.sync-settings__section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #374151;
}

.sync-settings__status {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.sync-settings__status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background-color: #f9fafb;
  border-radius: 0.375rem;
}

.sync-settings__status-item--error {
  background-color: #fef2f2;
  color: #dc2626;
}

.sync-settings__label {
  font-weight: 500;
  color: #6b7280;
}

.sync-settings__value {
  color: #111827;
}

.sync-settings__actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.sync-settings__button {
  padding: 0.5rem 1rem;
  background-color: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.sync-settings__button:hover:not(:disabled) {
  background-color: #e5e7eb;
}

.sync-settings__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sync-settings__button--primary {
  background-color: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.sync-settings__button--primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.sync-settings__config {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sync-settings__config-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sync-settings__config-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #374151;
  font-size: 0.875rem;
}

.sync-settings__config-input,
.sync-settings__config-select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  max-width: 200px;
}

.sync-settings__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.sync-settings__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background-color: #f9fafb;
  border-radius: 0.375rem;
}

.sync-settings__stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
}

.sync-settings__stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}

.sync-settings__help {
  font-size: 0.875rem;
  line-height: 1.6;
  color: #6b7280;
}

.sync-settings__help p {
  margin-bottom: 0.75rem;
}

.sync-settings__help strong {
  color: #374151;
  font-weight: 600;
}
`;
