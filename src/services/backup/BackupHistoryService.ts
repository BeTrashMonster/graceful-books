/**
 * Backup History Service
 *
 * Provides shared functionality for recording and retrieving backup history.
 * Used by both DataSafetyPanel and EncryptedBackup components.
 *
 * Storage: Uses a separate IndexedDB database (GracefulBooksBackupHistory)
 * to persist backup records independently from the main app database.
 */

import { openDB, type IDBPDatabase } from 'idb';

/**
 * Backup history entry stored in IndexedDB
 */
export interface BackupHistoryEntry {
  id: string;
  filename: string;
  timestamp: Date;
  size: number;
  status: 'success' | 'failed';
  errorMessage?: string;
  companyId?: string;
}

const DB_NAME = 'GracefulBooksBackupHistory';
const DB_VERSION = 2;
const STORE_NAME = 'backups';

/**
 * Open the backup history database with proper schema
 */
async function openBackupHistoryDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      console.log('[BackupHistory] Upgrading database from version', oldVersion);

      // Create store if it doesn't exist (version 1)
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('companyId', 'companyId', { unique: false });
        console.log('[BackupHistory] Object store created');
      } else if (oldVersion < 2) {
        // Add companyId index for existing databases (version 2 upgrade)
        const store = transaction.objectStore(STORE_NAME);
        if (!store.indexNames.contains('companyId')) {
          store.createIndex('companyId', 'companyId', { unique: false });
          console.log('[BackupHistory] Added companyId index');
        }
      }
    },
  });
}

/**
 * Save a backup entry to history
 *
 * @param entry - The backup history entry to save
 */
export async function saveBackupToHistory(entry: BackupHistoryEntry): Promise<void> {
  try {
    console.log('[BackupHistory] Saving backup to history:', entry.filename);
    const db = await openBackupHistoryDB();
    await db.add(STORE_NAME, entry);
    console.log('[BackupHistory] Backup saved successfully');
  } catch (error) {
    console.error('[BackupHistory] Failed to save backup:', error);
    // Don't throw - history recording failure shouldn't break the backup flow
  }
}

// Minimum file size for a valid backup (1KB)
// Files below this are corrupted error-JSON from old bugs
const MIN_VALID_BACKUP_SIZE = 1024;

/**
 * Load backup history entries
 *
 * @param companyId - Optional company ID to filter by
 * @param limit - Maximum number of entries to return (default: 10)
 * @returns Array of backup history entries, newest first
 */
export async function loadBackupHistory(
  companyId?: string,
  limit: number = 10
): Promise<BackupHistoryEntry[]> {
  try {
    console.log('[BackupHistory] Loading history for companyId:', companyId);
    const db = await openBackupHistoryDB();

    let allBackups: BackupHistoryEntry[];

    if (companyId) {
      const index = db.transaction(STORE_NAME).store.index('companyId');
      allBackups = await index.getAll(companyId);
    } else {
      allBackups = await db.getAll(STORE_NAME);
    }

    // Filter out invalid entries:
    // 1. Must have .gbbackup extension (not .json from old bugs)
    // 2. Must be above minimum size (small files are corrupted error-JSON)
    const validBackups = allBackups.filter(entry => {
      const hasValidExtension = entry.filename.endsWith('.gbbackup');
      const hasValidSize = entry.size >= MIN_VALID_BACKUP_SIZE;

      if (!hasValidExtension || !hasValidSize) {
        console.log('[BackupHistory] Filtering out invalid entry:', {
          filename: entry.filename,
          size: entry.size,
          reason: !hasValidExtension ? 'wrong extension' : 'too small'
        });
      }

      return hasValidExtension && hasValidSize;
    });

    const sorted = validBackups
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    console.log(`[BackupHistory] Loaded ${sorted.length} valid entries (filtered ${allBackups.length - validBackups.length} invalid)`);
    return sorted;
  } catch (error) {
    console.error('[BackupHistory] Failed to load history:', error);
    return [];
  }
}

/**
 * Delete a backup history entry
 *
 * @param id - The ID of the entry to delete
 */
export async function deleteBackupFromHistory(id: string): Promise<void> {
  try {
    const db = await openBackupHistoryDB();
    await db.delete(STORE_NAME, id);
    console.log('[BackupHistory] Deleted entry:', id);
  } catch (error) {
    console.error('[BackupHistory] Failed to delete entry:', error);
  }
}

/**
 * Clear all backup history (use with caution)
 */
export async function clearBackupHistory(): Promise<void> {
  try {
    const db = await openBackupHistoryDB();
    await db.clear(STORE_NAME);
    console.log('[BackupHistory] History cleared');
  } catch (error) {
    console.error('[BackupHistory] Failed to clear history:', error);
  }
}
