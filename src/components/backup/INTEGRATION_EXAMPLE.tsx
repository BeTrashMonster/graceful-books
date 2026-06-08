/**
 * Integration Example
 *
 * This file shows how to integrate the smart backup system into your app.
 * Copy the relevant parts into your App.tsx or main layout component.
 *
 * @module components/backup/INTEGRATION_EXAMPLE
 */

import React, { useEffect } from 'react';
import { smartAutoBackup } from '../../services/backup/SmartAutoBackupService';
import { useDataRecovery } from '../../hooks/useDataRecovery';
import { DataRecoveryModal } from './DataRecoveryModal';
import { BackupStatusIndicator } from './BackupStatusIndicator';

/**
 * STEP 1: Add to your main App component or layout
 */
export function AppWithBackup() {
  // Data recovery hook (detects if DB is empty)
  const recovery = useDataRecovery();

  // Start auto-backup on app mount
  useEffect(() => {
    // Start smart auto-backup with default settings
    smartAutoBackup.start({
      enabled: true,
      frequency: 'normal', // 'aggressive' | 'normal' | 'conservative'
    });

    // Cleanup on unmount
    return () => {
      smartAutoBackup.stop();
    };
  }, []);

  return (
    <>
      {/* Your app content */}
      <div className="app-content">
        {/* ... your routes, pages, etc ... */}
      </div>

      {/* Backup status indicator (shows after backups) */}
      <BackupStatusIndicator />

      {/* Data recovery modal (only shows if DB is empty) */}
      {recovery.needsRecovery && (
        <DataRecoveryModal
          onRestore={async (fileHandle) => {
            await recovery.restoreFromBackup(fileHandle);
            // Optionally reload the app after restore
            window.location.reload();
          }}
          onDismiss={recovery.dismissRecovery}
        />
      )}
    </>
  );
}

/**
 * STEP 2: (Optional) Add backup settings to user settings page
 */
export function BackupSettingsExample() {
  const [settings, setSettings] = React.useState(smartAutoBackup.getSettings());

  const handleToggle = () => {
    const newSettings = {
      ...settings,
      enabled: !settings.enabled,
    };
    setSettings(newSettings);
    smartAutoBackup.updateSettings(newSettings);
  };

  const handleFrequencyChange = (frequency: 'aggressive' | 'normal' | 'conservative') => {
    const newSettings = {
      ...settings,
      frequency,
    };
    setSettings(newSettings);
    smartAutoBackup.updateSettings(newSettings);
  };

  return (
    <div className="backup-settings">
      <h3>Automatic Backup</h3>

      {/* Enable/Disable */}
      <label>
        <input type="checkbox" checked={settings.enabled} onChange={handleToggle} />
        Enable automatic backups
      </label>

      {/* Frequency Selection */}
      {settings.enabled && (
        <div>
          <label>Backup Frequency:</label>
          <select
            value={settings.frequency}
            onChange={(e) => handleFrequencyChange(e.target.value as any)}
          >
            <option value="aggressive">Aggressive (every 5 changes or 1 min)</option>
            <option value="normal">Normal (every 10 changes or 5 min)</option>
            <option value="conservative">Conservative (every 25 changes or 15 min)</option>
          </select>
        </div>
      )}

      {/* Manual Backup Button */}
      <button
        onClick={async () => {
          const result = await smartAutoBackup.backupNow();
          if (result.success) {
            alert('Backup completed successfully!');
          } else {
            alert('Backup failed: ' + result.error);
          }
        }}
      >
        Backup Now
      </button>

      {/* Backup Stats */}
      <BackupStatsDisplay />
    </div>
  );
}

/**
 * Display backup statistics
 */
function BackupStatsDisplay() {
  const [stats, setStats] = React.useState<any>(null);

  React.useEffect(() => {
    loadStats();
    // Refresh stats every 10 seconds
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadStats() {
    const backupStats = await smartAutoBackup.getStats();
    setStats(backupStats);
  }

  if (!stats) return <div>Loading stats...</div>;

  return (
    <div className="backup-stats">
      <p>Total Backups: {stats.totalBackups}</p>
      <p>
        Last Backup:{' '}
        {stats.lastBackupTime ? new Date(stats.lastBackupTime).toLocaleString() : 'Never'}
      </p>
      <p>Changes Since Backup: {stats.changesSinceBackup}</p>
    </div>
  );
}

/**
 * STEP 3: Add to your existing backup folder selection UI
 */
export function BackupFolderSetupExample() {
  const { requestFolderPermission, storeDirectoryHandle } = require('../../services/backup/FileSystemBackup');

  const handleSetupBackupFolder = async () => {
    // Request folder permission
    const result = await requestFolderPermission();

    if (result.success && result.handle) {
      // Store the handle
      await storeDirectoryHandle(result.handle);

      // Start auto-backup now that folder is set
      await smartAutoBackup.start();

      alert('Backup folder configured! Automatic backups enabled.');
    } else {
      alert('Failed to set backup folder: ' + result.error);
    }
  };

  return (
    <div>
      <h3>Set Up Automatic Backups</h3>
      <p>Choose a folder where your data will be automatically backed up.</p>
      <button onClick={handleSetupBackupFolder}>Choose Backup Folder</button>
    </div>
  );
}

/**
 * QUICK START GUIDE
 *
 * 1. In your App.tsx, add:
 *    - Import useDataRecovery hook
 *    - Import DataRecoveryModal and BackupStatusIndicator components
 *    - Call smartAutoBackup.start() in useEffect
 *    - Render BackupStatusIndicator
 *    - Conditionally render DataRecoveryModal if recovery.needsRecovery
 *
 * 2. In your settings page, add:
 *    - Backup folder selection UI
 *    - Enable/disable toggle
 *    - Frequency selection
 *    - Manual backup button
 *
 * 3. That's it! The system will:
 *    - Auto-backup when data changes
 *    - Rotate old backups to save space
 *    - Show recovery modal if browser data cleared
 *    - Display subtle notifications on backup
 */
