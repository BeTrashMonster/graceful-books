/**
 * Data Recovery Hook
 *
 * Detects if user's database is empty (likely cleared browser data)
 * and automatically shows recovery modal to restore from backup.
 *
 * Also handles the restore process with proper error handling.
 *
 * @module hooks/useDataRecovery
 */

import { useState, useEffect } from 'react';
import { db } from '../store/database';
import { logger } from '../utils/logger';
import { restoreBackupBundle } from '../services/backup/BackupEncryption';
import { getBackupDirectoryStatus } from '../services/backup/FileSystemBackup';
import type { SecureBackupBundle } from '../services/backup/BackupEncryption';

const recoveryLogger = logger.child('DataRecovery');

export interface DataRecoveryState {
  needsRecovery: boolean;
  checking: boolean;
  error: string | null;
}

export interface UseDataRecoveryOptions {
  /** Only check for recovery when user is authenticated */
  isAuthenticated?: boolean;
}

export function useDataRecovery(options: UseDataRecoveryOptions = {}) {
  const [state, setState] = useState<DataRecoveryState>({
    needsRecovery: false,
    checking: true,
    error: null,
  });

  useEffect(() => {
    // Only check if user is authenticated (has session data needed for restore)
    if (options.isAuthenticated) {
      checkIfRecoveryNeeded();
    } else {
      setState({
        needsRecovery: false,
        checking: false,
        error: null,
      });
    }
  }, [options.isAuthenticated]);

  async function checkIfRecoveryNeeded() {
    try {
      recoveryLogger.info('Checking if data recovery needed');

      // Check if user explicitly chose to start fresh (dismiss recovery)
      const choseFreshStart = localStorage.getItem('audacious_backup_fresh_start');
      if (choseFreshStart === 'true') {
        recoveryLogger.info('User previously chose fresh start, skipping recovery check');
        setState({
          needsRecovery: false,
          checking: false,
          error: null,
        });
        return;
      }

      // Check if database has any data
      const isEmpty = await isDatabaseEmpty();

      // Check if backup folder is configured
      const folderStatus = await getBackupDirectoryStatus();

      // Only show recovery if:
      // 1. Database is empty AND
      // 2. Backup folder is configured (meaning they had data before)
      // This prevents false positives for brand new users
      if (isEmpty && folderStatus.configured) {
        recoveryLogger.warn('Database is empty but backups exist, recovery needed');
        setState({
          needsRecovery: true,
          checking: false,
          error: null,
        });
      } else {
        if (isEmpty && !folderStatus.configured) {
          recoveryLogger.info('Database empty but no backup folder (new user)');
        } else {
          recoveryLogger.info('Database has data, no recovery needed');
        }
        setState({
          needsRecovery: false,
          checking: false,
          error: null,
        });
      }
    } catch (error) {
      recoveryLogger.error('Failed to check recovery status', { error });
      setState({
        needsRecovery: false,
        checking: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async function isDatabaseEmpty(): Promise<boolean> {
    try {
      // Check critical tables for any data
      const stats = await db.getStatistics();

      // If we have any transactions, accounts, or companies, we're not empty
      if (stats && typeof stats === 'object') {
        const hasTransactions = (stats as any).transactions > 0;
        const hasAccounts = (stats as any).accounts > 0;
        const hasCompanies = (stats as any).companies > 0;

        return !(hasTransactions || hasAccounts || hasCompanies);
      }

      // Fallback: check tables directly
      const transactionCount = await db.transactions?.count() || 0;
      const accountCount = await db.accounts?.count() || 0;
      const companyCount = await db.companies?.count() || 0;

      return transactionCount === 0 && accountCount === 0 && companyCount === 0;
    } catch (error) {
      recoveryLogger.error('Failed to check if database is empty', { error });
      // On error, assume not empty to avoid false recovery prompts
      return false;
    }
  }

  async function restoreFromBackup(fileHandle: FileSystemFileHandle): Promise<void> {
    try {
      recoveryLogger.info('Starting restore from backup');

      // Read the backup file
      const file = await fileHandle.getFile();
      const fileText = await file.text();

      // Parse the backup bundle
      const bundle: SecureBackupBundle = JSON.parse(fileText);

      // Get the backup password (same one used for auto-backup)
      const backupPassword = await getBackupPassword();

      // Decrypt the bundle
      const restoreResult = await restoreBackupBundle(bundle, backupPassword);

      if (!restoreResult.success || !restoreResult.data) {
        throw new Error(restoreResult.error || 'Failed to decrypt backup');
      }

      // Import decrypted data into database
      const restoredData = restoreResult.data;

      // Import all the data back into Dexie
      await db.transaction('rw', [
        db.transactions,
        db.accounts,
        db.reports,
        // Add other tables as needed
      ], async () => {
        // Clear existing data first (optional - depends on your requirements)
        // await db.transactions.clear();
        // await db.accounts.clear();

        // Import restored data
        if (restoredData.transactions && Array.isArray(restoredData.transactions)) {
          await db.transactions?.bulkAdd(restoredData.transactions);
        }
        if (restoredData.accounts && Array.isArray(restoredData.accounts)) {
          await db.accounts?.bulkAdd(restoredData.accounts);
        }
        if (restoredData.reports && Array.isArray(restoredData.reports)) {
          await db.reports?.bulkAdd(restoredData.reports);
        }
      });

      recoveryLogger.info('Restore completed successfully', {
        transactions: restoredData.transactions?.length || 0,
        accounts: restoredData.accounts?.length || 0,
      });

      // Clear fresh start flag (they restored data, not starting fresh)
      localStorage.removeItem('audacious_backup_fresh_start');

      // Update state
      setState({
        needsRecovery: false,
        checking: false,
        error: null,
      });
    } catch (error) {
      recoveryLogger.error('Restore failed', { error });
      throw error; // Re-throw so modal can show error
    }
  }

  /**
   * Get the backup password (same one used for auto-backup)
   *
   * CRITICAL: Uses ONLY userId (not session token) so the password
   * stays consistent across sessions. This allows restoring backups
   * created in previous sessions.
   */
  async function getBackupPassword(): Promise<string> {
    // Get session data
    const sessionData = sessionStorage.getItem('graceful_books_session');
    if (!sessionData) {
      throw new Error('No active session found');
    }

    const session = JSON.parse(sessionData);
    const userId = session.userId || session.user?.id;

    if (!userId) {
      throw new Error('User ID not found in session');
    }

    // CRITICAL: Derive backup password using ONLY userId (stable across sessions)
    // Same logic as SmartAutoBackupService.deriveBackupPassword()
    const encoder = new TextEncoder();
    const data = encoder.encode(`audacious-money-backup:${userId}:stable-v1`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  }

  function dismissRecovery() {
    recoveryLogger.info('User dismissed recovery, starting fresh');

    // Persist choice so modal doesn't reappear on reload
    localStorage.setItem('audacious_backup_fresh_start', 'true');

    setState({
      needsRecovery: false,
      checking: false,
      error: null,
    });
  }

  return {
    ...state,
    restoreFromBackup,
    dismissRecovery,
  };
}
