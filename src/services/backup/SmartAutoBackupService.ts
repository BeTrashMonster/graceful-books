/**
 * Smart Auto-Backup Service
 *
 * Automatically backs up user data to their chosen folder with intelligent:
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

import { writeBackupToFile, retrieveDirectoryHandle, getBackupDirectoryStatus } from './FileSystemBackup';
import { generateBackupBundle } from './BackupEncryption';
import type { BackupData } from './BackupEncryption';
import { db } from '../../store/database';
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
    // Dexie emits 'changes' event when data is modified
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

    // Hook into Dexie's on.changes event
    if (db.on) {
      this.unsubscribeDbChanges = db.on('changes', dbChangesHandler);
    }
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
      // Export data and calculate hash
      const allData = await db.exportAllData();
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

      // Get data if not provided
      if (!allData) {
        allData = await db.exportAllData();
      }

      // Calculate hash if not provided
      if (!dataHash) {
        dataHash = await this.calculateHash(JSON.stringify(allData));
      }

      // Get user session data for backup metadata
      const sessionData = sessionStorage.getItem('graceful_books_session');
      const session = sessionData ? JSON.parse(sessionData) : {};
      const userId = session.userId || session.user?.id || 'unknown';
      const companyId = session.companyId || userId; // Use userId as companyId for now

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
      const timestamp = new Date().toISOString()
        .replace(/:/g, '-')
        .replace(/\..+/, '');
      const fileName = `audacious-backup-${timestamp}.encrypted`;

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
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.startsWith('audacious-backup-')) {
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
   * Get encryption password from user's session
   *
   * CRITICAL: Uses ONLY userId (not session token) so password stays
   * consistent across sessions. This allows users to restore backups
   * even after logging out and back in.
   */
  private async getEncryptionPassword(): Promise<string> {
    try {
      // Get user session data
      const sessionData = sessionStorage.getItem('graceful_books_session');
      if (!sessionData) {
        throw new Error('No active session found');
      }

      const session = JSON.parse(sessionData);
      const userId = session.userId || session.user?.id;

      if (!userId) {
        throw new Error('User ID not found in session');
      }

      // CRITICAL: Derive password from userId ONLY (not session token)
      // This ensures the same password works across all sessions for this user
      const backupKey = await this.deriveBackupPassword(userId);

      return backupKey;
    } catch (error) {
      backupLogger.error('Failed to get encryption password', { error });
      throw new Error('Cannot encrypt backup: no encryption password available');
    }
  }

  /**
   * Derive a backup-specific password from userId
   *
   * CRITICAL: Uses ONLY userId (stable) not session token (changes)
   * This ensures backups can be restored across sessions
   */
  private async deriveBackupPassword(userId: string): Promise<string> {
    // Create a deterministic password that's consistent across sessions
    // Uses Web Crypto API to hash userId + stable salt
    const encoder = new TextEncoder();
    const data = encoder.encode(`audacious-money-backup:${userId}:stable-v1`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
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
          if (entry.kind === 'file' && entry.name.startsWith('audacious-backup-')) {
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
}

// Singleton instance
export const smartAutoBackup = new SmartAutoBackupService();
