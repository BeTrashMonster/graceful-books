/**
 * Encrypted Backup Service
 *
 * Implements secure backup and restore functionality per S7-4.
 * All backups are encrypted using AES-256-GCM with the user's master
 * passphrase or a separate backup key.
 *
 * Features:
 * - Full database backup with encryption
 * - Restore from encrypted backup
 * - Validation of backup integrity
 * - User-friendly error messages
 *
 * Requirements:
 * - S7-4: Encrypted Backups
 * - ARCH-001: Zero-knowledge encryption
 */

import { db, type DatabaseExport } from '../../db';
import { createEncryptionService } from '../../crypto/service';
import { deriveMasterKey } from '../../crypto/keyDerivation';
import { logger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/errors';

const backupLogger = logger.child('BackupService');

/**
 * Encrypted backup envelope
 * Contains encrypted database export with metadata
 */
export interface EncryptedBackup {
  /** Version of backup format */
  version: number;
  /** When backup was created (timestamp) */
  createdAt: number;
  /** Encrypted database export (serialized EncryptedData) */
  encryptedData: string;
  /** Key derivation parameters (salt, etc.) for backup key */
  keyDerivationParams: {
    salt: string; // base64
    memoryCost: number;
    timeCost: number;
    parallelism: number;
  };
  /** Database statistics at backup time */
  statistics: {
    accounts: number;
    transactions: number;
    contacts: number;
    products: number;
    companies: number;
    totalTables: number;
  };
  /** Application version at backup time */
  appVersion: string;
}

/**
 * Backup creation result
 */
export interface BackupResult {
  success: boolean;
  backup?: EncryptedBackup;
  blob?: Blob;
  filename?: string;
  error?: string;
}

/**
 * Backup restore result
 */
export interface RestoreResult {
  success: boolean;
  recordsRestored?: number;
  error?: string;
  details?: {
    accounts: number;
    transactions: number;
    contacts: number;
    products: number;
    companies: number;
  };
}

/**
 * Backup validation result
 */
export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  backup?: EncryptedBackup;
  canDecrypt?: boolean;
}

/**
 * BackupService class
 *
 * Handles all backup and restore operations with encryption
 */
export class BackupService {
  /**
   * Create an encrypted backup of all user data
   *
   * @param passphrase - User's passphrase for encryption
   * @param includeAuditLogs - Whether to include audit logs (default: true)
   * @returns Promise resolving to backup result with blob and filename
   *
   * @example
   * ```typescript
   * const result = await BackupService.createBackup('user-passphrase');
   * if (result.success && result.blob) {
   *   // Trigger download
   *   const url = URL.createObjectURL(result.blob);
   *   const a = document.createElement('a');
   *   a.href = url;
   *   a.download = result.filename;
   *   a.click();
   * }
   * ```
   */
  static async createBackup(
    passphrase: string,
    includeAuditLogs: boolean = true
  ): Promise<BackupResult> {
    try {
      backupLogger.info('Starting encrypted backup creation');

      // Validate passphrase
      if (!passphrase || passphrase.trim().length === 0) {
        return {
          success: false,
          error: 'A passphrase is required to create an encrypted backup.',
        };
      }

      // Export all data from database
      backupLogger.debug('Exporting database data');
      const dbExport = await this.exportAllData(includeAuditLogs);

      // Get database statistics
      const stats = await db.getStatistics();

      // Generate salt for key derivation
      const salt = new Uint8Array(32);
      crypto.getRandomValues(salt);

      // Derive master key from passphrase
      backupLogger.debug('Deriving encryption key from passphrase');
      const keyResult = await deriveMasterKey(passphrase, salt, {
        memoryCost: 65536, // 64 MB
        timeCost: 3,
        parallelism: 4,
        keyLength: 32,
      });

      if (!keyResult.success || !keyResult.data) {
        return {
          success: false,
          error: keyResult.error || 'Failed to derive encryption key.',
        };
      }

      const masterKey = keyResult.data;

      // Create encryption service
      const encryptionService = createEncryptionService(masterKey);

      // Encrypt the database export
      backupLogger.debug('Encrypting database export');
      const encryptedData = await encryptionService.encryptObject(dbExport);

      // Create encrypted backup envelope
      const encryptedBackup: EncryptedBackup = {
        version: 1,
        createdAt: Date.now(),
        encryptedData,
        keyDerivationParams: {
          salt: this.arrayBufferToBase64(salt),
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
        },
        statistics: {
          accounts: stats.accounts,
          transactions: stats.transactions,
          contacts: stats.contacts,
          products: stats.products,
          companies: stats.companies,
          totalTables: Object.keys(dbExport.data).length,
        },
        appVersion: this.getAppVersion(),
      };

      // Convert to JSON and create Blob
      const jsonString = JSON.stringify(encryptedBackup, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `graceful-books-backup-${timestamp}.gbbackup`;

      backupLogger.info('Encrypted backup created successfully', {
        size: blob.size,
        filename,
        tables: encryptedBackup.statistics.totalTables,
      });

      return {
        success: true,
        backup: encryptedBackup,
        blob,
        filename,
      };
    } catch (error) {
      backupLogger.error('Failed to create encrypted backup', error);
      return {
        success: false,
        error: error instanceof Error
          ? `Something went wrong while creating the backup: ${error.message}`
          : 'An unexpected error occurred while creating the backup.',
      };
    }
  }

  /**
   * Validate an encrypted backup file
   *
   * @param file - Backup file to validate
   * @param passphrase - Optional passphrase to test decryption
   * @returns Promise resolving to validation result
   */
  static async validateBackup(
    file: File,
    passphrase?: string
  ): Promise<BackupValidationResult> {
    try {
      backupLogger.debug('Validating backup file', { filename: file.name });

      // Read file content
      const content = await file.text();

      // Parse JSON
      let backup: EncryptedBackup;
      try {
        backup = JSON.parse(content);
      } catch (error) {
        return {
          valid: false,
          error: "This doesn't appear to be a valid backup file. The file format is not recognized.",
        };
      }

      // Validate structure
      if (!backup.version || !backup.createdAt || !backup.encryptedData) {
        return {
          valid: false,
          error: 'This backup file is missing required information and cannot be restored.',
        };
      }

      // Check version compatibility
      if (backup.version !== 1) {
        return {
          valid: false,
          error: `This backup was created with a different version (${backup.version}) and may not be compatible with the current version.`,
        };
      }

      // If passphrase provided, test decryption
      let canDecrypt = false;
      if (passphrase) {
        backupLogger.debug('Testing decryption with provided passphrase');
        canDecrypt = await this.testDecryption(backup, passphrase);
      }

      backupLogger.info('Backup validation completed', {
        valid: true,
        canDecrypt,
        createdAt: new Date(backup.createdAt).toISOString(),
      });

      return {
        valid: true,
        backup,
        canDecrypt,
      };
    } catch (error) {
      backupLogger.error('Backup validation failed', error);
      return {
        valid: false,
        error: error instanceof Error
          ? `Unable to validate backup: ${error.message}`
          : 'An unexpected error occurred while validating the backup.',
      };
    }
  }

  /**
   * Restore from an encrypted backup
   *
   * @param file - Backup file to restore from
   * @param passphrase - Passphrase to decrypt backup
   * @param clearExisting - Whether to clear existing data (default: true)
   * @returns Promise resolving to restore result
   *
   * @example
   * ```typescript
   * const result = await BackupService.restoreBackup(file, 'user-passphrase');
   * if (result.success) {
   *   console.log(`Restored ${result.recordsRestored} records`);
   * }
   * ```
   */
  static async restoreBackup(
    file: File,
    passphrase: string,
    clearExisting: boolean = true
  ): Promise<RestoreResult> {
    try {
      backupLogger.info('Starting backup restoration', {
        filename: file.name,
        clearExisting,
      });

      // Validate passphrase
      if (!passphrase || passphrase.trim().length === 0) {
        return {
          success: false,
          error: 'A passphrase is required to restore from an encrypted backup.',
        };
      }

      // Validate backup file
      const validation = await this.validateBackup(file, passphrase);
      if (!validation.valid || !validation.backup) {
        return {
          success: false,
          error: validation.error || 'The backup file is not valid.',
        };
      }

      if (validation.canDecrypt === false) {
        return {
          success: false,
          error: "The passphrase you entered doesn't match this backup. Please check your passphrase and try again.",
        };
      }

      const backup = validation.backup;

      // Reconstruct salt from backup
      const salt = this.base64ToArrayBuffer(backup.keyDerivationParams.salt);

      // Derive master key from passphrase
      backupLogger.debug('Deriving decryption key from passphrase');
      const keyResult = await deriveMasterKey(passphrase, salt, {
        memoryCost: backup.keyDerivationParams.memoryCost,
        timeCost: backup.keyDerivationParams.timeCost,
        parallelism: backup.keyDerivationParams.parallelism,
        keyLength: 32,
      });

      if (!keyResult.success || !keyResult.data) {
        return {
          success: false,
          error: keyResult.error || 'Failed to derive decryption key.',
        };
      }

      const masterKey = keyResult.data;

      // Create encryption service
      const encryptionService = createEncryptionService(masterKey);

      // Decrypt the database export
      backupLogger.debug('Decrypting database export');
      let dbExport: DatabaseExport;
      try {
        dbExport = await encryptionService.decryptObject<DatabaseExport>(
          backup.encryptedData
        );
      } catch (error) {
        backupLogger.error('Decryption failed', error);
        return {
          success: false,
          error: "Failed to decrypt the backup. Please verify your passphrase is correct.",
        };
      }

      // Validate decrypted data structure
      if (!dbExport.data || !dbExport.version) {
        return {
          success: false,
          error: 'The decrypted backup data is not in the expected format.',
        };
      }

      // Import data into database
      backupLogger.debug('Importing data into database');
      await db.importAllData(dbExport);

      // Count restored records
      const recordsRestored = this.countRecords(dbExport);

      backupLogger.info('Backup restoration completed successfully', {
        recordsRestored,
      });

      return {
        success: true,
        recordsRestored,
        details: {
          accounts: dbExport.data.accounts.length,
          transactions: dbExport.data.transactions.length,
          contacts: dbExport.data.contacts.length,
          products: dbExport.data.products.length,
          companies: dbExport.data.companies.length,
        },
      };
    } catch (error) {
      backupLogger.error('Backup restoration failed', error);
      return {
        success: false,
        error: error instanceof Error
          ? `Something went wrong while restoring the backup: ${error.message}`
          : 'An unexpected error occurred while restoring the backup.',
      };
    }
  }

  /**
   * Test if a backup can be decrypted with the given passphrase
   *
   * @param backup - Encrypted backup to test
   * @param passphrase - Passphrase to test
   * @returns Promise resolving to true if decryption succeeds
   */
  private static async testDecryption(
    backup: EncryptedBackup,
    passphrase: string
  ): Promise<boolean> {
    try {
      // Reconstruct salt
      const salt = this.base64ToArrayBuffer(backup.keyDerivationParams.salt);

      // Derive key
      const keyResult = await deriveMasterKey(passphrase, salt, {
        memoryCost: backup.keyDerivationParams.memoryCost,
        timeCost: backup.keyDerivationParams.timeCost,
        parallelism: backup.keyDerivationParams.parallelism,
        keyLength: 32,
      });

      if (!keyResult.success || !keyResult.data) {
        return false;
      }

      // Try to decrypt
      const encryptionService = createEncryptionService(keyResult.data);
      await encryptionService.decryptObject(backup.encryptedData);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Export all data from database
   * Enhanced version of db.exportAllData() that includes all tables
   *
   * @param _includeAuditLogs - Whether to include audit logs (currently unused)
   * @returns Promise resolving to database export
   */
  private static async exportAllData(
    _includeAuditLogs: boolean = true
  ): Promise<DatabaseExport> {
    // Use the database's built-in export function
    // This already exports the core tables
    const baseExport = await db.exportAllData();

    // TODO: If needed, extend to include additional tables like:
    // - receipts, categories, invoices, etc.
    // - CPG data (cpgDistributors, cpgInvoices, etc.)
    // For now, the base export covers the essential data

    return baseExport;
  }

  /**
   * Count total records in a database export
   *
   * @param dbExport - Database export to count
   * @returns Total number of records
   */
  private static countRecords(dbExport: DatabaseExport): number {
    let count = 0;
    const data = dbExport.data;

    count += data.accounts.length;
    count += data.transactions.length;
    count += data.transactionLineItems.length;
    count += data.contacts.length;
    count += data.products.length;
    count += data.users.length;
    count += data.companies.length;
    count += data.companyUsers.length;
    count += data.auditLogs.length;
    count += data.sessions.length;
    count += data.devices.length;

    return count;
  }

  /**
   * Convert Uint8Array to base64 string
   */
  private static arrayBufferToBase64(buffer: Uint8Array): string {
    const binaryString = Array.from(buffer)
      .map((byte) => String.fromCharCode(byte))
      .join('');
    return btoa(binaryString);
  }

  /**
   * Convert base64 string to Uint8Array
   */
  private static base64ToArrayBuffer(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Get current application version
   */
  private static getAppVersion(): string {
    // In a real app, this would come from package.json or build process
    return '1.0.0';
  }

  /**
   * Download a backup blob to user's device
   *
   * @param blob - Backup blob to download
   * @param filename - Filename for download
   */
  static downloadBackup(blob: Blob, filename: string): void {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      backupLogger.info('Backup download triggered', { filename });
    } catch (error) {
      backupLogger.error('Failed to trigger backup download', error);
      throw new AppError(
        ErrorCode.UNKNOWN_ERROR,
        'Failed to download backup file. Please try again.'
      );
    }
  }
}
