/**
 * Smart Auto-Backup Service
 *
 * ============================================================================
 * WARNING: THIS SERVICE IS NOT WIRED UP
 * ============================================================================
 *
 * This service was designed to provide automatic/scheduled backups, but it
 * CANNOT function without a way to encrypt backups. The auto-mode encryption
 * (random key stored in folder) was removed because the key file was never
 * reliably written, making backups unrecoverable.
 *
 * To make this service work, you would need ONE of:
 *
 * 1. Secure passphrase caching: Store the user's passphrase in memory for the
 *    session, prompting once at login. Risk: passphrase in memory could be
 *    extracted by malicious code.
 *
 * 2. WebAuthn PRF extension: Use hardware-backed key derivation where the
 *    authenticator derives a key from a PRF seed. Requires biometric/PIN
 *    each backup, or trust the device for a session.
 *
 * 3. Device-bound encryption: Encrypt the passphrase with a key stored in
 *    the browser's credential storage (if available). Risk: ties backups
 *    to the device.
 *
 * Until one of these is implemented, users must use manual backup with
 * passphrase entry each time.
 *
 * ============================================================================
 *
 * Original design (for reference):
 * - Change detection (only backup when data actually changed)
 * - Smart timing (after X changes or Y minutes)
 * - File rotation (keep recent frequent, old infrequent)
 * - Before-unload safety (backup before closing browser)
 *
 * Storage Strategy:
 * - Last 12 backups (1 hour of 5-min intervals)
 * - One per hour for last 24 hours
 * - One per day for last 7 days
 * - One per week for last 4 weeks
 * Total: ~47 files instead of thousands
 *
 * @module services/backup/SmartAutoBackupService
 */

import {
  writeBackupToFile,
  retrieveDirectoryHandle,
  getBackupDirectoryStatus,
} from './FileSystemBackup';
import { generateBackupBundle } from './BackupEncryption';
import type { BackupData } from './BackupEncryption';
import { db } from '../../db';
import { logger } from '../../utils/logger';

const backupLogger = logger.child('SmartAutoBackup');

export interface BackupStats {
  totalBackups: number;
  lastBackupTime: number | null;
  changesSinceBackup: number;
  autoBackupEnabled: boolean;
}

export type BackupFrequency = 'aggressive' | 'normal' | 'conservative';

export interface BackupSettings {
  enabled: boolean;
  frequency: BackupFrequency;
}

class SmartAutoBackupService {
  private changesSinceBackup = 0;
  private lastBackupTime = 0;
  private lastBackupHash = '';
  private checkInterval: number | null = null;
  private settings: BackupSettings = {
    enabled: true,
    frequency: 'normal',
  };
  private unsubscribeDbChanges: (() => void) | null = null;

  /**
   * Start the smart auto-backup system
   */
  async start(settings?: Partial<BackupSettings>): Promise<{ started: boolean; reason?: string }> {
    if (settings) {
      this.settings = { ...this.settings, ...settings };
    }

    if (!this.settings.enabled) {
      backupLogger.info('Auto-backup disabled by user settings');
      return { started: false, reason: 'Disabled in settings' };
    }

    // Check if folder is configured
    const status = await getBackupDirectoryStatus();
    if (!status.configured || !status.permissionGranted) {
      backupLogger.info('Auto-backup not started: folder not configured');
      return { started: false, reason: 'Folder not configured' };
    }

    backupLogger.info('Starting smart auto-backup', { settings: this.settings });

    // Setup change tracking
    this.setupChangeTracking();

    // Setup before-unload backup
    this.setupBeforeUnloadBackup();

    // Get check interval based on frequency
    const intervalMs = this.getCheckIntervalMs();

    // Periodic check (only backs up if changes detected)
    this.checkInterval = window.setInterval(
      () => this.checkAndBackup(),
      intervalMs
    );

    // Do initial backup (if needed)
    await this.checkAndBackup();

    backupLogger.info('Smart auto-backup started successfully');
    return { started: true };
  }

  /**
   * Stop auto-backup
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.unsubscribeDbChanges) {
      this.unsubscribeDbChanges();
      this.unsubscribeDbChanges = null;
    }

    backupLogger.info('Auto-backup stopped');
  }

  /**
   * Get check interval based on frequency setting
   */
  private getCheckIntervalMs(): number {
    switch (this.settings.frequency) {
      case 'aggressive':
        return 1 * 60 * 1000; // 1 minute
      case 'normal':
        return 5 * 60 * 1000; // 5 minutes
      case 'conservative':
        return 15 * 60 * 1000; // 15 minutes
    }
  }

  /**
   * Get change threshold based on frequency setting
   */
  private getChangeThreshold(): number {
    switch (this.settings.frequency) {
      case 'aggressive':
        return 5; // Backup after 5 changes
      case 'normal':
        return 10; // Backup after 10 changes
      case 'conservative':
        return 25; // Backup after 25 changes
    }
  }

  /**
   * Track database changes
   */
  private setupChangeTracking(): void {
    // Subscribe to database changes
    // Use Dexie's table hooks instead of global changes event
    const dbChangesHandler = () => {
      this.changesSinceBackup++;
      backupLogger.debug('Data change detected', {
        changesSinceBackup: this.changesSinceBackup
      });

      // Auto-backup if threshold reached
      const threshold = this.getChangeThreshold();
      if (this.changesSinceBackup >= threshold) {
        backupLogger.info('Change threshold reached, triggering backup', {
          changes: this.changesSinceBackup,
          threshold
        });
        this.checkAndBackup();
      }
    };

    // Hook into Dexie table hooks for change detection
    // Track changes on critical CPG tables in TreasureChest
    // Note: When bookkeeping ships, it will need its own auto-backup for GracefulBooksDB
    const tables = [db.cpgInvoices, db.cpgCategories, db.cpgProductLinks, db.cpgVendors];

    tables.forEach(table => {
      if (table) {
        // Hook into creating, updating, and deleting hooks
        table.hook('creating', dbChangesHandler);
        table.hook('updating', dbChangesHandler);
        table.hook('deleting', dbChangesHandler);
      }
    });

    backupLogger.info('Change tracking setup complete');
  }

  /**
   * Backup before user closes browser tab
   */
  private setupBeforeUnloadBackup(): void {
    window.addEventListener('beforeunload', async () => {
      if (this.changesSinceBackup > 0) {
        backupLogger.info('Browser closing with unsaved changes, backing up');
        // Note: beforeunload has limited time, this may not always complete
        // but we try our best
        await this.performBackup();
      }
    });
  }

  /**
   * Check if backup is needed and perform it
   */
  private async checkAndBackup(): Promise<void> {
    // Skip if no changes
    if (this.changesSinceBackup === 0) {
      backupLogger.debug('No changes since last backup, skipping');
      return;
    }

    try {
      // Get company ID from session for filtering
      // IMPORTANT: Match AuthContext resolution - companyId is derived from userId
      const sessionData = sessionStorage.getItem('graceful_books_session');
      if (!sessionData) {
        backupLogger.warn('No session found - cannot determine companyId for backup');
        return; // Fail safe: don't backup without knowing which company
      }

      const session = JSON.parse(sessionData);
      // Resolve companyId same way AuthContext does (see AuthContext.tsx line 60)
      const companyId = session.companyId || session.company_id ||
                        session.userId || session.user?.id;

      if (!companyId) {
        backupLogger.error('Cannot determine companyId from session - backup aborted to prevent data leakage');
        throw new Error('No companyId available - cannot create filtered backup');
      }

      // Export data and calculate hash
      // Use TreasureChest (CPG database) for backups - this is where user data lives
      // Pass companyId to filter records to current company only
      const allData = await db.exportAllData(companyId);
      const dataString = JSON.stringify(allData);
      const dataHash = await this.calculateHash(dataString);

      // Skip if data unchanged (hash matches)
      if (dataHash === this.lastBackupHash) {
        backupLogger.debug('Data unchanged (hash match), skipping backup');
        this.changesSinceBackup = 0; // Reset counter
        return;
      }

      // Perform backup
      await this.performBackup(allData, dataHash);
    } catch (error) {
      backupLogger.error('Failed to check and backup', { error });
    }
  }

  /**
   * Perform the actual backup
   */
  private async performBackup(allData?: any, dataHash?: string): Promise<void> {
    try {
      backupLogger.info('Starting backup', {
        changesSinceBackup: this.changesSinceBackup
      });

      // Get user session data for backup metadata
      // IMPORTANT: Match AuthContext resolution - companyId is derived from userId
      const sessionData = sessionStorage.getItem('graceful_books_session');
      if (!sessionData) {
        backupLogger.error('No session found - cannot create backup without session');
        throw new Error('No session available - cannot create backup');
      }

      const session = JSON.parse(sessionData);
      const userId = session.userId || session.user?.id;
      // Resolve companyId same way AuthContext does (see AuthContext.tsx line 60)
      const companyId = session.companyId || session.company_id || userId;

      if (!companyId) {
        backupLogger.error('Cannot determine companyId from session - backup aborted');
        throw new Error('No companyId available - cannot create filtered backup');
      }

      // Get data if not provided
      // Use TreasureChest (CPG database) for backups
      // Pass companyId to filter records to current company only
      if (!allData) {
        allData = await db.exportAllData(companyId);
      }

      // Calculate hash if not provided
      if (!dataHash) {
        dataHash = await this.calculateHash(JSON.stringify(allData));
      }

      // Get encryption password
      const password = await this.getEncryptionPassword();

      // Format data for backup
      const backupData: BackupData = {
        transactions: (allData as any).transactions || [],
        accounts: (allData as any).accounts || [],
        reports: (allData as any).reports || [],
        preferences: (allData as any).preferences || {},
      };

      // Create encrypted bundle
      const bundleResult = await generateBackupBundle({
        companyId,
        userId,
        userRole: 'Admin', // Default role for auto-backup
        keyRotationEpoch: 0, // Default epoch
        password,
        data: backupData,
      });

      if (!bundleResult.success || !bundleResult.bundle) {
        throw new Error(bundleResult.error || 'Failed to create backup bundle');
      }

      const bundle = bundleResult.bundle;

      // Generate filename with timestamp
      // Format: audacious-backup-2026-09-09T19-30-00.gbbackup
      const timestamp = new Date().toISOString()
        .replace(/:/g, '-')
        .replace(/\..+/, '');
      const fileName = `audacious-backup-${timestamp}.gbbackup`;

      // Write to filesystem
      const result = await writeBackupToFile({
        bundle,
        fileName,
        onProgress: (progress) => {
          backupLogger.debug('Backup progress', {
            phase: progress.phase,
            percent: progress.percent
          });
        },
      });

      if (result.success) {
        this.lastBackupTime = Date.now();
        this.lastBackupHash = dataHash;
        this.changesSinceBackup = 0;

        backupLogger.info('Backup completed successfully', {
          fileName,
          fileSize: result.fileSize
        });

        // Clean old backups
        await this.cleanOldBackups();

        // Notify user
        this.notifyBackupComplete(fileName, result.fileSize || 0);
      } else {
        backupLogger.error('Backup failed', { error: result.error });
        this.notifyBackupFailed(result.error || 'Unknown error');
      }
    } catch (error) {
      backupLogger.error('Unexpected error during backup', { error });
      this.notifyBackupFailed(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Clean old backups using smart rotation strategy
   */
  private async cleanOldBackups(): Promise<void> {
    try {
      const dirHandle = await retrieveDirectoryHandle();
      if (!dirHandle) {
        backupLogger.warn('No directory handle for cleanup');
        return;
      }

      const backupFiles: Array<{
        name: string;
        time: Date;
      }> = [];

      // List all backup files
      // New format: audacious-backup-2026-09-09T19-30-00.gbbackup
      // Old format: graceful-books-backup-2026-09-09T19-30-00.gbbackup (also cleaned for migration)
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' &&
            (entry.name.startsWith('audacious-backup-') || entry.name.startsWith('graceful-books-backup-'))) {
          const time = this.extractTimestamp(entry.name);
          if (time) {
            backupFiles.push({ name: entry.name, time });
          }
        }
      }

      // Sort newest first
      backupFiles.sort((a, b) => b.time.getTime() - a.time.getTime());

      const toKeep = new Set<string>();
      const now = Date.now();

      // Keep last 12 backups (1 hour of 5-min backups)
      backupFiles.slice(0, 12).forEach(f => toKeep.add(f.name));

      // Keep one per hour for last 24 hours
      this.addIntervalBackups(backupFiles, toKeep, now, 60 * 60 * 1000, 24);

      // Keep one per day for last 7 days
      this.addIntervalBackups(backupFiles, toKeep, now, 24 * 60 * 60 * 1000, 7);

      // Keep one per week for last 4 weeks
      this.addIntervalBackups(backupFiles, toKeep, now, 7 * 24 * 60 * 60 * 1000, 4);

      // Delete old backups
      let deletedCount = 0;
      for (const file of backupFiles) {
        if (!toKeep.has(file.name)) {
          try {
            await dirHandle.removeEntry(file.name);
            deletedCount++;
            backupLogger.debug('Deleted old backup', { fileName: file.name });
          } catch (error) {
            backupLogger.error('Failed to delete backup file', {
              fileName: file.name,
              error
            });
          }
        }
      }

      backupLogger.info('Backup cleanup complete', {
        total: backupFiles.length,
        kept: toKeep.size,
        deleted: deletedCount,
      });
    } catch (error) {
      backupLogger.error('Failed to clean old backups', { error });
    }
  }

  /**
   * Add interval-based backups to keep set
   */
  private addIntervalBackups(
    files: Array<{ name: string; time: Date }>,
    toKeep: Set<string>,
    now: number,
    intervalMs: number,
    count: number
  ): void {
    let lastKept = now;
    let kept = 0;

    for (const file of files) {
      const fileTime = file.time.getTime();

      // Only consider files within the retention period
      if (now - fileTime < intervalMs * count) {
        // Keep if enough time has passed since last kept backup
        if (lastKept - fileTime >= intervalMs) {
          toKeep.add(file.name);
          lastKept = fileTime;
          kept++;
          if (kept >= count) break;
        }
      }
    }
  }

  /**
   * Extract timestamp from backup filename
   */
  private extractTimestamp(fileName: string): Date | null {
    // New format: audacious-backup-2026-09-09T19-30-00.gbbackup
    // Old format: graceful-books-backup-2026-09-09T19-30-00.gbbackup
    // (ISO timestamp with colons replaced by hyphens)
    const match = fileName.match(/(?:audacious|graceful-books)-backup-(.+)\.gbbackup/);
    if (!match) return null;

    try {
      // Replace hyphens in time portion back to colons: T19-30-00 -> T19:30:00
      const timestamp = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
      const date = new Date(timestamp);

      // Validate date
      if (isNaN(date.getTime())) return null;

      return date;
    } catch {
      return null;
    }
  }

  /**
   * Calculate SHA-256 hash of data
   */
  private async calculateHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get encryption password for auto-backup.
   *
   * THIS METHOD CANNOT WORK - it always throws an error.
   *
   * Auto-mode encryption was removed because the auto-key file was never
   * reliably written to the backup folder, making backups unrecoverable
   * on other devices.
   *
   * To make automatic backups work, you would need to implement one of:
   * 1. Secure passphrase caching (store passphrase in memory for session)
   * 2. WebAuthn PRF extension (hardware-backed key derivation)
   * 3. Device-bound encryption (encrypt passphrase with browser credentials)
   *
   * Until then, users must use manual backup with passphrase entry.
   */
  private async getEncryptionPassword(): Promise<string> {
    // This service is not wired up (see App.tsx) and cannot function.
    // Throwing an error here ensures that if someone accidentally wires it up,
    // they'll get a clear error message instead of silent failures.
    throw new Error(
      'SmartAutoBackupService cannot encrypt backups: ' +
      'auto-mode encryption was removed because it created unrecoverable backups. ' +
      'This service requires a passphrase caching mechanism that does not exist yet. ' +
      'See the warning comment at the top of SmartAutoBackupService.ts for details.'
    );
  }

  /**
   * Notify user of successful backup
   */
  private notifyBackupComplete(fileName: string, fileSize: number): void {
    window.dispatchEvent(
      new CustomEvent('backup-complete', {
        detail: {
          fileName,
          fileSize,
          timestamp: Date.now(),
        },
      })
    );
  }

  /**
   * Notify user of failed backup
   */
  private notifyBackupFailed(error: string): void {
    window.dispatchEvent(
      new CustomEvent('backup-failed', {
        detail: {
          error,
          timestamp: Date.now(),
        },
      })
    );
  }

  /**
   * Manually trigger a backup now
   */
  async backupNow(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.performBackup();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get backup statistics
   */
  async getStats(): Promise<BackupStats> {
    try {
      const dirHandle = await retrieveDirectoryHandle();
      let totalBackups = 0;

      if (dirHandle) {
        for await (const entry of dirHandle.values()) {
          // Count both old (audacious-) and new (graceful-books-) backup formats
          if (entry.kind === 'file' &&
              (entry.name.startsWith('graceful-books-backup-') || entry.name.startsWith('audacious-backup-'))) {
            totalBackups++;
          }
        }
      }

      return {
        totalBackups,
        lastBackupTime: this.lastBackupTime || null,
        changesSinceBackup: this.changesSinceBackup,
        autoBackupEnabled: this.settings.enabled,
      };
    } catch (error) {
      backupLogger.error('Failed to get backup stats', { error });
      return {
        totalBackups: 0,
        lastBackupTime: null,
        changesSinceBackup: this.changesSinceBackup,
        autoBackupEnabled: this.settings.enabled,
      };
    }
  }

  /**
   * Update backup settings
   */
  updateSettings(settings: Partial<BackupSettings>): void {
    this.settings = { ...this.settings, ...settings };

    // Restart with new settings
    this.stop();
    if (this.settings.enabled) {
      this.start();
    }

    backupLogger.info('Backup settings updated', { settings: this.settings });
  }

  /**
   * Get current settings
   */
  getSettings(): BackupSettings {
    return { ...this.settings };
  }

  /**
   * Exposed for testing only - triggers backup cleanup
   * @internal
   */
  async _testCleanOldBackups(): Promise<void> {
    return this.cleanOldBackups();
  }
}

// Singleton instance
export const smartAutoBackup = new SmartAutoBackupService();

// Alias for testing
export const smartAutoBackupService = smartAutoBackup;
