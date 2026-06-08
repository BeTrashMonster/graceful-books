/**
 * Backup Status Indicator
 *
 * Subtle, non-intrusive notification that shows when backups complete.
 * Appears briefly in bottom-right corner with royal purple branding.
 *
 * @module components/backup/BackupStatusIndicator
 */

import React, { useState, useEffect } from 'react';
import styles from './BackupStatusIndicator.module.css';

interface BackupEvent {
  fileName?: string;
  fileSize?: number;
  error?: string;
  timestamp: number;
}

export function BackupStatusIndicator() {
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const handleBackupComplete = (event: Event) => {
      const customEvent = event as CustomEvent<BackupEvent>;
      setLastBackup(new Date(customEvent.detail.timestamp));
      setError(false);
      setVisible(true);

      // Auto-hide after 5 seconds
      setTimeout(() => setVisible(false), 5000);
    };

    const handleBackupFailed = (event: Event) => {
      const customEvent = event as CustomEvent<BackupEvent>;
      setError(true);
      setVisible(true);

      // Auto-hide after 8 seconds (longer for errors)
      setTimeout(() => setVisible(false), 8000);
    };

    window.addEventListener('backup-complete', handleBackupComplete);
    window.addEventListener('backup-failed', handleBackupFailed);

    return () => {
      window.removeEventListener('backup-complete', handleBackupComplete);
      window.removeEventListener('backup-failed', handleBackupFailed);
    };
  }, []);

  if (!visible || !lastBackup) return null;

  return (
    <div className={`${styles.indicator} ${error ? styles.error : styles.success}`}>
      <div className={styles.icon}>
        {error ? (
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
      <div className={styles.content}>
        <div className={styles.title}>{error ? 'Backup Issue' : 'Data Backed Up'}</div>
        <div className={styles.time}>
          {error ? 'Check your backup settings' : lastBackup.toLocaleTimeString()}
        </div>
      </div>
      <button className={styles.closeButton} onClick={() => setVisible(false)} aria-label="Dismiss">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
