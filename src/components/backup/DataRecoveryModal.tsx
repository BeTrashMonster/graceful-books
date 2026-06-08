/**
 * Data Recovery Modal
 *
 * Beautiful, branded UI for restoring data from backups when user's
 * browser data has been cleared.
 *
 * Features:
 * - Royal purple and gold branding
 * - Elegant animations
 * - Clear, reassuring messaging
 * - Easy backup selection
 * - Professional design
 *
 * @module components/backup/DataRecoveryModal
 */

import React, { useState, useEffect } from 'react';
import { retrieveDirectoryHandle, storeDirectoryHandle } from '../../services/backup/FileSystemBackup';
import styles from './DataRecoveryModal.module.css';

interface BackupFile {
  name: string;
  handle: FileSystemFileHandle;
  timestamp: Date;
  size: number;
  displayTime: string;
}

export interface DataRecoveryModalProps {
  onRestore: (file: FileSystemFileHandle) => Promise<void>;
  onDismiss: () => void;
}

export function DataRecoveryModal({ onRestore, onDismiss }: DataRecoveryModalProps) {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<BackupFile | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsFolderSelection, setNeedsFolderSelection] = useState(false);

  useEffect(() => {
    loadAvailableBackups();
  }, []);

  async function loadAvailableBackups(dirHandle?: FileSystemDirectoryHandle) {
    try {
      // Try to get directory handle from storage or use provided one
      let handle = dirHandle || await retrieveDirectoryHandle();

      if (!handle) {
        // No stored handle (browser data was cleared)
        // Ask user to select their backup folder
        setNeedsFolderSelection(true);
        setLoading(false);
        return;
      }

      const foundBackups: BackupFile[] = [];

      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && entry.name.startsWith('audacious-backup-')) {
          try {
            const file = await entry.getFile();
            const timestamp = extractTimestamp(entry.name);

            if (timestamp) {
              foundBackups.push({
                name: entry.name,
                handle: entry as FileSystemFileHandle,
                timestamp,
                size: file.size,
                displayTime: formatDisplayTime(timestamp),
              });
            }
          } catch (err) {
            console.error(`Failed to process backup file ${entry.name}:`, err);
          }
        }
      }

      // Sort by newest first
      foundBackups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setBackups(foundBackups);
      if (foundBackups.length > 0) {
        setSelectedBackup(foundBackups[0]); // Auto-select latest
      }
      setNeedsFolderSelection(false);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load backups:', error);
      setError('Could not access backup folder');
      setLoading(false);
    }
  }

  async function handleSelectFolder() {
    try {
      setLoading(true);
      setError(null);

      // Show folder picker
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read',
        startIn: 'documents',
      });

      // Store the handle for future use
      await storeDirectoryHandle(dirHandle);

      // Load backups from selected folder
      await loadAvailableBackups(dirHandle);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled
        setLoading(false);
        return;
      }
      console.error('Failed to select folder:', error);
      setError('Could not access selected folder');
      setLoading(false);
    }
  }

  function extractTimestamp(fileName: string): Date | null {
    // Format: audacious-backup-2024-03-29T14-30-00.encrypted
    const match = fileName.match(/audacious-backup-(.+)\.encrypted/);
    if (!match) return null;

    try {
      // Replace hyphens in time portion back to colons
      const timestamp = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
      const date = new Date(timestamp);

      // Validate date
      if (isNaN(date.getTime())) return null;

      return date;
    } catch {
      return null;
    }
  }

  function formatDisplayTime(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const fileDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (fileDate.getTime() === today.getTime()) {
      return `Today at ${timeStr}`;
    } else if (fileDate.getTime() === yesterday.getTime()) {
      return `Yesterday at ${timeStr}`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
  }

  async function handleRestore() {
    if (!selectedBackup) return;

    setRestoring(true);
    setError(null);

    try {
      await onRestore(selectedBackup.handle);
      // Success - modal will be closed by parent
    } catch (error) {
      console.error('Restore failed:', error);
      setError(error instanceof Error ? error.message : 'Restore failed');
      setRestoring(false);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none">
              <path
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className={styles.title}>Well, That's Not Ideal...</h2>
          <p className={styles.subtitle}>
            Looks like your browser data got cleared (happens to the best of us!). Good news: We've got your backups right here. Pick one below to get your books back.
          </p>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Looking for your backups...</p>
            </div>
          ) : needsFolderSelection ? (
            <div className={styles.noBackups}>
              <p>
                Please select the folder where your backups are stored.
                <br />
                (This is the folder you chose for automatic backups in Settings)
              </p>
              <button className={styles.primaryButton} onClick={handleSelectFolder} style={{ marginTop: '1rem' }}>
                <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Select Backup Folder
              </button>
              <button className={styles.secondaryButton} onClick={onDismiss} style={{ marginTop: '0.75rem' }}>
                Start Fresh Instead
              </button>
            </div>
          ) : error ? (
            <div className={styles.error}>
              <p>{error}</p>
              <button className={styles.secondaryButton} onClick={onDismiss}>
                Start Fresh
              </button>
            </div>
          ) : backups.length === 0 ? (
            <div className={styles.noBackups}>
              <p>No backups found in your selected folder.</p>
              <button className={styles.secondaryButton} onClick={onDismiss}>
                Start Fresh
              </button>
            </div>
          ) : (
            <>
              <div className={styles.backupList}>
                {backups.slice(0, 8).map((backup) => (
                  <button
                    key={backup.name}
                    className={`${styles.backupItem} ${
                      selectedBackup?.name === backup.name ? styles.selected : ''
                    }`}
                    onClick={() => setSelectedBackup(backup)}
                    disabled={restoring}
                  >
                    <div className={styles.backupInfo}>
                      <div className={styles.backupTime}>{backup.displayTime}</div>
                      <div className={styles.backupSize}>{formatFileSize(backup.size)}</div>
                    </div>
                  </button>
                ))}
              </div>

              {backups.length > 8 && (
                <p className={styles.moreBackups}>
                  + {backups.length - 8} more backup{backups.length - 8 !== 1 ? 's' : ''} available
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && backups.length > 0 && (
          <div className={styles.footer}>
            <button className={styles.secondaryButton} onClick={onDismiss} disabled={restoring}>
              Start Fresh Instead
            </button>
            <button
              className={styles.primaryButton}
              onClick={handleRestore}
              disabled={!selectedBackup || restoring}
            >
              {restoring ? (
                <>
                  <div className={styles.buttonSpinner}></div>
                  Restoring Your Data...
                </>
              ) : (
                <>
                  <svg className={styles.buttonIcon} viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Restore My Books
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
