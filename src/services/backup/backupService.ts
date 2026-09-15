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
import {
  restoreBackupBundle,
  validateBackupBundleStructure,
  type SecureBackupBundle,
} from './BackupEncryption';

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
    /** CPG-specific statistics (added in backup version 2) */
    cpgCategories?: number;
    cpgInvoices?: number;
    cpgVendors?: number;
    cpgFinishedProducts?: number;
    cpgRecipes?: number;
    /** Total records across all tables */
    totalRecords?: number;
    /** Per-table record counts for complete comparison (added in backup version 3) */
    tableCounts?: Record<string, number>;
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
 * Company info extracted from backup
 */
export interface BackupCompanyInfo {
  /** Company ID found in records */
  id: string;
  /** Company name if available (from companies table or cpgSettings) */
  name?: string;
  /** Number of records with this company_id */
  recordCount: number;
}

/**
 * Mismatch detection result
 */
export interface CompanyMismatchInfo {
  /** Company IDs found in the backup (may be multiple if corrupted/merged) */
  backupCompanies: BackupCompanyInfo[];
  /** Current session's company ID */
  sessionCompanyId: string;
  /** Current session's company name */
  sessionCompanyName?: string;
  /** Whether there's a mismatch */
  hasMismatch: boolean;
  /** Whether backup has multiple company IDs (corruption indicator) */
  hasMultipleCompanies: boolean;
}

/**
 * Restore mode for handling company_id mismatch
 */
export type RestoreMode = 'claim' | 'as-is';

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
  /** Mismatch info if company_id differs from session */
  mismatchInfo?: CompanyMismatchInfo;
  /** The decrypted data (for retry with different mode) */
  decryptedData?: DatabaseExport;
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
   * @param companyId - Optional company ID to filter records (for single-company backups)
   * @returns Promise resolving to backup result with blob and filename
   *
   * @example
   * ```typescript
   * const result = await BackupService.createBackup('user-passphrase', true, 'company-uuid');
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
    includeAuditLogs: boolean = true,
    companyId?: string
  ): Promise<BackupResult> {
    try {
      backupLogger.info('Starting encrypted backup creation', { companyId: companyId || 'ALL' });

      // Validate passphrase
      if (!passphrase || passphrase.trim().length === 0) {
        return {
          success: false,
          error: 'A passphrase is required to create an encrypted backup.',
        };
      }

      // Export all data from database
      // When companyId is provided, only records for that company are exported
      backupLogger.debug('Exporting database data', { companyId: companyId || 'ALL' });
      const dbExport = await this.exportAllData(includeAuditLogs, companyId);

      // Get database statistics for comparison
      const stats = await db.getStatistics();

      // Count records in the export
      const exportRecordCount = this.countExportRecords(dbExport);

      // CRITICAL GUARD: Fail if backup would capture almost nothing
      // This prevents silent data loss from bugs in the export logic
      const dbRecordCount = stats.accounts + stats.transactions + stats.contacts + stats.products;

      if (dbRecordCount > 0 && exportRecordCount === 0) {
        backupLogger.error('CRITICAL: Backup would be empty despite database having data', {
          dbRecordCount,
          exportRecordCount,
        });
        return {
          success: false,
          error: 'Backup failed: The export captured no data, but your database contains records. This is likely a bug - please contact support.',
        };
      }

      // Warn if backup has significantly less data than expected
      // Allow some variance for ephemeral tables not being exported
      if (dbRecordCount > 10 && exportRecordCount < dbRecordCount * 0.5) {
        backupLogger.warn('WARNING: Backup contains significantly less data than database', {
          dbRecordCount,
          exportRecordCount,
          ratio: exportRecordCount / dbRecordCount,
        });
        // Don't fail, but log prominently - some tables may legitimately not be exported
      }

      // Log CPG records from v3 format
      const cpgRecords = dbExport.tables
        ? (dbExport.tables.cpgCategories?.length || 0) +
          (dbExport.tables.cpgInvoices?.length || 0) +
          (dbExport.tables.cpgVendors?.length || 0) +
          (dbExport.tables.cpgFinishedProducts?.length || 0)
        : 0;

      backupLogger.info('Export record count validated', {
        dbRecordCount,
        exportRecordCount,
        cpgRecords,
        totalRecords: dbExport.totalRecords,
      });

      // Generate salt for key derivation
      const salt = new Uint8Array(32);
      crypto.getRandomValues(salt);

      // Derive master key from passphrase
      // CRITICAL: New backups MUST use Argon2id - no PBKDF2 fallback
      backupLogger.debug('Deriving encryption key from passphrase (Argon2id required)');
      const keyResult = await deriveMasterKey(passphrase, salt, {
        memoryCost: 65536, // 64 MB
        timeCost: 3,
        parallelism: 4,
        keyLength: 32,
      }, { requireArgon2: true });

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

      // Calculate table counts from v3 format
      const totalExportedTables = dbExport.tables
        ? Object.keys(dbExport.tables).length
        : 0;
      const tablesWithData = dbExport.tables
        ? Object.keys(dbExport.tables).filter(k => dbExport.tables![k]?.length > 0).length
        : 0;

      // Create encrypted backup envelope
      const encryptedBackup: EncryptedBackup = {
        version: 3, // Version 3: Dynamic table export
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
          totalTables: tablesWithData, // Note: this counts only non-empty tables for backwards compat
          // CPG statistics from v3 tables format
          cpgCategories: (dbExport.tables?.cpgCategories as unknown[])?.length || 0,
          cpgInvoices: (dbExport.tables?.cpgInvoices as unknown[])?.length || 0,
          cpgVendors: (dbExport.tables?.cpgVendors as unknown[])?.length || 0,
          cpgFinishedProducts: (dbExport.tables?.cpgFinishedProducts as unknown[])?.length || 0,
          cpgRecipes: (dbExport.tables?.cpgRecipes as unknown[])?.length || 0,
          totalRecords: exportRecordCount,
          // Complete per-table counts for detailed comparison (v3+)
          tableCounts: dbExport.tables
            ? Object.fromEntries(
                Object.entries(dbExport.tables).map(([name, data]) => [
                  name,
                  Array.isArray(data) ? data.length : 0,
                ])
              )
            : undefined,
        },
        appVersion: this.getAppVersion(),
      };

      // Convert to JSON and create Blob
      const jsonString = JSON.stringify(encryptedBackup, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `audacious-backup-${timestamp}.gbbackup`;

      backupLogger.info('Encrypted backup created successfully', {
        size: blob.size,
        filename,
        tablesWithData: `${tablesWithData} of ${totalExportedTables} exported`,
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
  /**
   * Detect if a parsed object is a SecureBackupBundle (from generateBackupBundle)
   */
  private static isSecureBackupBundle(obj: unknown): obj is SecureBackupBundle {
    if (!obj || typeof obj !== 'object') return false;
    const bundle = obj as Partial<SecureBackupBundle>;
    return (
      typeof bundle.version === 'string' &&
      bundle.metadata !== undefined &&
      bundle.encryptedKeys !== undefined &&
      bundle.integrity !== undefined
    );
  }

  static async validateBackup(
    file: File,
    passphrase?: string
  ): Promise<BackupValidationResult> {
    try {
      backupLogger.debug('Validating backup file', { filename: file.name });

      // Read file content
      const content = await file.text();

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (error) {
        return {
          valid: false,
          error: "This doesn't appear to be a valid backup file. The file format is not recognized.",
        };
      }

      // Detect format: SecureBackupBundle (from DataSafetyPanel) vs EncryptedBackup (legacy)
      if (this.isSecureBackupBundle(parsed)) {
        // Validate SecureBackupBundle structure
        const structureValidation = validateBackupBundleStructure(parsed);
        if (!structureValidation.valid) {
          return {
            valid: false,
            error: structureValidation.error || 'This backup file has an invalid structure.',
          };
        }

        backupLogger.info('Backup validation completed (SecureBackupBundle format)', {
          valid: true,
          timestamp: new Date(parsed.metadata.timestamp).toISOString(),
        });

        // Return with a synthetic EncryptedBackup-like structure for compatibility
        // The actual restore will detect the format again
        return {
          valid: true,
          backup: {
            version: 1,
            createdAt: parsed.metadata.timestamp,
            encryptedData: '__SECURE_BUNDLE__', // Marker for restore to re-read file
            keyDerivationParams: {
              salt: parsed.encryptedKeys.salt,
              memoryCost: parsed.encryptedKeys.memoryCost,
              timeCost: parsed.encryptedKeys.iterations,
              parallelism: parsed.encryptedKeys.parallelism,
            },
            statistics: {
              accounts: 0, // Unknown until decrypted
              transactions: 0,
              contacts: 0,
              products: 0,
              companies: 0,
              totalTables: 4,
            },
            appVersion: 'SecureBackupBundle',
          },
          canDecrypt: undefined, // Will test during restore
        };
      }

      // Legacy EncryptedBackup format
      const backup = parsed as EncryptedBackup;

      // Validate structure
      if (!backup.version || !backup.createdAt || !backup.encryptedData) {
        return {
          valid: false,
          error: 'This backup file is missing required information and cannot be restored.',
        };
      }

      // Check version compatibility - we support v1, v2, and v3
      const supportedVersions = [1, 2, 3];
      if (!supportedVersions.includes(backup.version)) {
        if (backup.version > 3) {
          return {
            valid: false,
            error: `This backup was created with a newer version (v${backup.version}). Please update to the latest version to restore this backup.`,
          };
        }
        return {
          valid: false,
          error: `This backup was created with an unsupported version (${backup.version}).`,
        };
      }

      // If passphrase provided, test decryption
      let canDecrypt = false;
      if (passphrase) {
        backupLogger.debug('Testing decryption with provided passphrase');
        canDecrypt = await this.testDecryption(backup, passphrase);
      }

      backupLogger.info('Backup validation completed (EncryptedBackup format)', {
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
   * Restore from an encrypted backup WITHOUT mismatch detection.
   *
   * @deprecated Use restoreBackupWithMismatchHandling() instead.
   * This method does NOT check for company_id mismatch and may silently
   * import records from a different account. Production code should always
   * use restoreBackupWithMismatchHandling() with a sessionCompanyId.
   *
   * Kept for backward compatibility with existing tests.
   */
  static async restoreBackup(
    file: File,
    passphrase: string,
    clearExisting: boolean = true
  ): Promise<RestoreResult> {
    try {
      // SECURITY WARNING: This method bypasses company_id mismatch detection.
      // Use restoreBackupWithMismatchHandling() for production restore operations.
      backupLogger.warn('restoreBackup() called without mismatch detection - use restoreBackupWithMismatchHandling() instead', {
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

      // Read and parse file to detect format
      const content = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (error) {
        return {
          success: false,
          error: "This doesn't appear to be a valid backup file.",
        };
      }

      // Handle SecureBackupBundle format (from DataSafetyPanel)
      if (this.isSecureBackupBundle(parsed)) {
        backupLogger.info('Restoring SecureBackupBundle format');

        const restoreResult = await restoreBackupBundle(parsed, passphrase);

        if (!restoreResult.success || !restoreResult.data) {
          return {
            success: false,
            error: restoreResult.error || 'Failed to decrypt the backup. Please check your passphrase.',
          };
        }

        // Clear existing data if requested
        if (clearExisting) {
          backupLogger.debug('Clearing existing data');
          await db.transactions?.clear();
          await db.accounts?.clear();
          await db.contacts?.clear();
          await db.products?.clear();
        }

        // Import the decrypted data
        const data = restoreResult.data;
        let recordsRestored = 0;

        if (data.transactions && Array.isArray(data.transactions)) {
          await db.transactions?.bulkAdd(data.transactions as any[]);
          recordsRestored += data.transactions.length;
        }
        if (data.accounts && Array.isArray(data.accounts)) {
          await db.accounts?.bulkAdd(data.accounts as any[]);
          recordsRestored += data.accounts.length;
        }
        if (data.reports && Array.isArray(data.reports)) {
          await db.reports?.bulkAdd(data.reports as any[]);
          recordsRestored += data.reports.length;
        }

        backupLogger.info('SecureBackupBundle restore completed', { recordsRestored });

        return {
          success: true,
          recordsRestored,
          details: {
            accounts: data.accounts?.length || 0,
            transactions: data.transactions?.length || 0,
            contacts: 0,
            products: 0,
            companies: 0,
          },
        };
      }

      // Legacy EncryptedBackup format
      const backup = parsed as EncryptedBackup;

      // Validate structure
      if (!backup.version || !backup.createdAt || !backup.encryptedData) {
        return {
          success: false,
          error: 'This backup file is missing required information.',
        };
      }

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

      // Validate decrypted data structure - v1/v2 use data, v3+ use tables
      const hasV1Data = dbExport.data !== undefined;
      const hasV3Tables = dbExport.tables !== undefined;

      if (!dbExport.version || (!hasV1Data && !hasV3Tables)) {
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

      // Build details from v3 tables or v1/v2 data
      const getCount = (tableName: string): number => {
        if (hasV3Tables && dbExport.tables) {
          const table = dbExport.tables[tableName];
          return Array.isArray(table) ? table.length : 0;
        }
        if (hasV1Data && dbExport.data) {
          const table = (dbExport.data as Record<string, unknown[]>)[tableName];
          return Array.isArray(table) ? table.length : 0;
        }
        return 0;
      };

      return {
        success: true,
        recordsRestored,
        details: {
          accounts: getCount('accounts'),
          transactions: getCount('transactions'),
          contacts: getCount('contacts'),
          products: getCount('products'),
          companies: getCount('companies'),
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
   * @param companyId - Company ID to filter records (REQUIRED for production backups)
   * @returns Promise resolving to database export
   */
  private static async exportAllData(
    _includeAuditLogs: boolean = true,
    companyId: string | null = null
  ): Promise<DatabaseExport> {
    // Use the database's built-in export function
    // Pass companyId for filtering (prevents cross-company data contamination)
    // Pass null explicitly only for tests that need unfiltered exports
    const baseExport = await db.exportAllData(companyId);

    return baseExport;
  }

  /**
   * Count total records in a database export (v1/v2 data structure only)
   * For full counting including v3 format, use countExportRecords
   *
   * @param dbExport - Database export to count
   * @returns Total number of records
   */
  private static countRecords(dbExport: DatabaseExport): number {
    // For v3 format, delegate to countExportRecords
    if (dbExport.version >= 3 && dbExport.tables) {
      return this.countExportRecords(dbExport);
    }

    // v1/v2 format
    if (!dbExport.data) {
      return 0;
    }

    let count = 0;
    const data = dbExport.data;

    count += data.accounts?.length || 0;
    count += data.transactions?.length || 0;
    count += data.transactionLineItems?.length || 0;
    count += data.contacts?.length || 0;
    count += data.products?.length || 0;
    count += data.users?.length || 0;
    count += data.companies?.length || 0;
    count += data.companyUsers?.length || 0;
    count += data.auditLogs?.length || 0;
    count += data.sessions?.length || 0;
    count += data.devices?.length || 0;

    return count;
  }

  /**
   * Count ALL records in a database export
   * Supports v1, v2, and v3 formats for backward compatibility
   */
  private static countExportRecords(dbExport: DatabaseExport): number {
    // Version 3+: Use totalRecords if available, or sum all tables
    if (dbExport.version >= 3 && dbExport.tables) {
      // If totalRecords was already calculated, use it
      if (dbExport.totalRecords !== undefined) {
        return dbExport.totalRecords;
      }
      // Otherwise sum all table arrays
      let count = 0;
      for (const tableName of Object.keys(dbExport.tables)) {
        const tableData = dbExport.tables[tableName];
        if (Array.isArray(tableData)) {
          count += tableData.length;
        }
      }
      return count;
    }

    // Version 1/2: Count from fixed data structure + extendedData
    let count = 0;

    // Count from v1 data structure
    if (dbExport.data) {
      count += dbExport.data.accounts?.length || 0;
      count += dbExport.data.transactions?.length || 0;
      count += dbExport.data.transactionLineItems?.length || 0;
      count += dbExport.data.contacts?.length || 0;
      count += dbExport.data.products?.length || 0;
      count += dbExport.data.users?.length || 0;
      count += dbExport.data.companies?.length || 0;
      count += dbExport.data.companyUsers?.length || 0;
      count += dbExport.data.auditLogs?.length || 0;
      count += dbExport.data.sessions?.length || 0;
      count += dbExport.data.devices?.length || 0;
    }

    // Count from v2 extendedData
    if (dbExport.extendedData) {
      for (const tableName of Object.keys(dbExport.extendedData)) {
        const tableData = dbExport.extendedData[tableName];
        if (Array.isArray(tableData)) {
          count += tableData.length;
        }
      }
    }

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

  /**
   * Extract all company information from a decrypted backup.
   * Scans ALL tables for company_id/companyId fields and collects distinct values.
   * Also extracts company names from companies table and cpgSettings.
   *
   * @param dbExport - Decrypted database export
   * @returns Array of company info found in backup
   */
  static extractCompanyInfo(dbExport: DatabaseExport): BackupCompanyInfo[] {
    const companyMap = new Map<string, { name?: string; count: number }>();

    // Helper to add a company_id to the map
    const addCompanyId = (id: string | undefined | null, name?: string) => {
      if (!id) return;
      const existing = companyMap.get(id);
      if (existing) {
        existing.count++;
        // Prefer names from companies/cpgSettings tables
        if (name && !existing.name) {
          existing.name = name;
        }
      } else {
        companyMap.set(id, { name, count: 1 });
      }
    };

    // Helper to scan an array of records for company_id or companyId fields
    const scanTable = (records: unknown[], tableName: string) => {
      if (!Array.isArray(records)) return;

      for (const record of records) {
        if (!record || typeof record !== 'object') continue;
        const rec = record as Record<string, unknown>;

        // Check for company_id (snake_case - CPG tables)
        if ('company_id' in rec && typeof rec.company_id === 'string') {
          // Special case: cpgSettings has company_name
          const name = tableName === 'cpgSettings' && 'company_name' in rec
            ? String(rec.company_name)
            : undefined;
          addCompanyId(rec.company_id, name);
        }

        // Check for companyId (camelCase - bookkeeping tables)
        if ('companyId' in rec && typeof rec.companyId === 'string') {
          addCompanyId(rec.companyId);
        }

        // Special case: companies table has id as the company_id
        if (tableName === 'companies' && 'id' in rec && typeof rec.id === 'string') {
          const name = 'name' in rec ? String(rec.name) : undefined;
          addCompanyId(rec.id, name);
        }
      }
    };

    // Scan v3 format tables
    if (dbExport.tables) {
      for (const [tableName, records] of Object.entries(dbExport.tables)) {
        scanTable(records as unknown[], tableName);
      }
    }

    // Scan v1/v2 format data
    if (dbExport.data) {
      const data = dbExport.data as Record<string, unknown[]>;
      for (const [tableName, records] of Object.entries(data)) {
        if (Array.isArray(records)) {
          scanTable(records, tableName);
        }
      }
    }

    // Scan v2 extendedData
    if (dbExport.extendedData) {
      for (const [tableName, records] of Object.entries(dbExport.extendedData)) {
        if (Array.isArray(records)) {
          scanTable(records as unknown[], tableName);
        }
      }
    }

    // Convert map to array
    const result: BackupCompanyInfo[] = [];
    for (const [id, info] of companyMap.entries()) {
      result.push({
        id,
        name: info.name,
        recordCount: info.count,
      });
    }

    // Sort by record count descending (primary company likely has most records)
    result.sort((a, b) => b.recordCount - a.recordCount);

    backupLogger.debug('Extracted company info from backup', {
      companiesFound: result.length,
      companies: result.map(c => ({ id: c.id, name: c.name, records: c.recordCount })),
    });

    return result;
  }

  /**
   * Rewrite all company_id/companyId fields in a backup to a new value.
   * Used for "claim this data" restore mode.
   *
   * @param dbExport - Database export to modify (mutates in place)
   * @param newCompanyId - New company ID to set on all records
   * @returns Number of records modified
   */
  static rewriteCompanyIds(dbExport: DatabaseExport, newCompanyId: string): number {
    let modifiedCount = 0;

    // Helper to rewrite company_id in an array of records
    const rewriteTable = (records: unknown[], tableName: string) => {
      if (!Array.isArray(records)) return;

      for (const record of records) {
        if (!record || typeof record !== 'object') continue;
        const rec = record as Record<string, unknown>;

        // Rewrite company_id (snake_case)
        if ('company_id' in rec && typeof rec.company_id === 'string') {
          rec.company_id = newCompanyId;
          modifiedCount++;
        }

        // Rewrite companyId (camelCase)
        if ('companyId' in rec && typeof rec.companyId === 'string') {
          rec.companyId = newCompanyId;
          modifiedCount++;
        }

        // Special case: companies table - rewrite id
        if (tableName === 'companies' && 'id' in rec && typeof rec.id === 'string') {
          rec.id = newCompanyId;
          modifiedCount++;
        }
      }
    };

    // Rewrite v3 format tables
    if (dbExport.tables) {
      for (const [tableName, records] of Object.entries(dbExport.tables)) {
        rewriteTable(records as unknown[], tableName);
      }
    }

    // Rewrite v1/v2 format data
    if (dbExport.data) {
      const data = dbExport.data as Record<string, unknown[]>;
      for (const [tableName, records] of Object.entries(data)) {
        if (Array.isArray(records)) {
          rewriteTable(records, tableName);
        }
      }
    }

    // Rewrite v2 extendedData
    if (dbExport.extendedData) {
      for (const [tableName, records] of Object.entries(dbExport.extendedData)) {
        if (Array.isArray(records)) {
          rewriteTable(records as unknown[], tableName);
        }
      }
    }

    backupLogger.info('Rewrote company IDs in backup', {
      newCompanyId,
      modifiedRecords: modifiedCount,
    });

    return modifiedCount;
  }

  /**
   * Restore a backup with explicit handling of company_id mismatch.
   * This is the preferred entry point that supports all restore modes.
   *
   * @param file - Backup file
   * @param passphrase - Decryption passphrase
   * @param sessionCompanyId - Current session's company ID (for mismatch detection)
   * @param sessionCompanyName - Current session's company name (for display)
   * @param mode - How to handle restore: 'detect' (check only), 'claim' (rewrite IDs), 'as-is' (import as-is)
   * @param clearExisting - Whether to clear existing data before import
   */
  static async restoreBackupWithMismatchHandling(
    file: File,
    passphrase: string,
    sessionCompanyId: string | null,
    sessionCompanyName: string | undefined,
    mode: 'detect' | 'claim' | 'as-is' = 'detect',
    clearExisting: boolean = true
  ): Promise<RestoreResult> {
    try {
      backupLogger.info('Starting backup restoration with mismatch handling', {
        filename: file.name,
        mode,
        sessionCompanyId,
        clearExisting,
      });

      // Validate passphrase
      if (!passphrase || passphrase.trim().length === 0) {
        return {
          success: false,
          error: 'A passphrase is required to restore from an encrypted backup.',
        };
      }

      // Read and parse file
      const content = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        return {
          success: false,
          error: "This doesn't appear to be a valid backup file.",
        };
      }

      // Handle SecureBackupBundle format
      if (this.isSecureBackupBundle(parsed)) {
        const bundle = parsed as SecureBackupBundle;
        const backupCompanyId = bundle.metadata.companyId;

        // Detect mismatch using plaintext metadata (no decryption needed)
        const hasMismatch = sessionCompanyId
          ? backupCompanyId !== sessionCompanyId
          : false;

        const mismatchInfo: CompanyMismatchInfo = {
          backupCompanies: [{ id: backupCompanyId, name: undefined, recordCount: 0 }],
          sessionCompanyId: sessionCompanyId || '',
          sessionCompanyName,
          hasMismatch,
          hasMultipleCompanies: false, // SecureBackupBundle is single-company
        };

        // If mode is 'detect', return mismatch info without importing
        if (mode === 'detect' && hasMismatch) {
          backupLogger.info('Company mismatch detected in SecureBackupBundle', {
            backupCompanyId,
            sessionCompanyId,
          });
          return {
            success: false,
            mismatchInfo,
            error: 'This backup belongs to a different account.',
          };
        }

        // Decrypt the bundle
        const restoreResult = await restoreBackupBundle(bundle, passphrase);

        if (!restoreResult.success || !restoreResult.data) {
          return {
            success: false,
            error: restoreResult.error || 'Failed to decrypt the backup. Please check your passphrase.',
          };
        }

        const data = restoreResult.data;

        // If mode is 'claim', rewrite company IDs in the decrypted data
        if (mode === 'claim' && sessionCompanyId) {
          let modifiedCount = 0;
          const rewriteArray = (arr: unknown[]) => {
            for (const record of arr) {
              if (record && typeof record === 'object') {
                const rec = record as Record<string, unknown>;
                if (rec.company_id !== undefined) {
                  rec.company_id = sessionCompanyId;
                  modifiedCount++;
                }
                if (rec.companyId !== undefined) {
                  rec.companyId = sessionCompanyId;
                  modifiedCount++;
                }
              }
            }
          };

          if (Array.isArray(data.transactions)) rewriteArray(data.transactions);
          if (Array.isArray(data.accounts)) rewriteArray(data.accounts);
          if (Array.isArray(data.reports)) rewriteArray(data.reports);

          backupLogger.info('Claimed SecureBackupBundle data', { modifiedRecords: modifiedCount });
        }

        // Clear existing data if requested
        if (clearExisting) {
          backupLogger.debug('Clearing existing data');
          await db.transactions?.clear();
          await db.accounts?.clear();
          await db.contacts?.clear();
          await db.products?.clear();
        }

        // Import the decrypted data
        let recordsRestored = 0;

        if (data.transactions && Array.isArray(data.transactions)) {
          await db.transactions?.bulkAdd(data.transactions as any[]);
          recordsRestored += data.transactions.length;
        }
        if (data.accounts && Array.isArray(data.accounts)) {
          await db.accounts?.bulkAdd(data.accounts as any[]);
          recordsRestored += data.accounts.length;
        }
        if (data.reports && Array.isArray(data.reports)) {
          await db.reports?.bulkAdd(data.reports as any[]);
          recordsRestored += data.reports.length;
        }

        backupLogger.info('SecureBackupBundle restore completed with mismatch handling', {
          recordsRestored,
          mode,
          hasMismatch,
        });

        return {
          success: true,
          recordsRestored,
          mismatchInfo,
          details: {
            accounts: data.accounts?.length || 0,
            transactions: data.transactions?.length || 0,
            contacts: 0,
            products: 0,
            companies: 0,
          },
        };
      }

      // EncryptedBackup format (v2+)
      const backup = parsed as EncryptedBackup;

      if (!backup.version || !backup.createdAt || !backup.encryptedData) {
        return {
          success: false,
          error: 'This backup file is missing required information.',
        };
      }

      // Derive key and decrypt
      const salt = this.base64ToArrayBuffer(backup.keyDerivationParams.salt);
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

      const encryptionService = createEncryptionService(keyResult.data);

      let dbExport: DatabaseExport;
      try {
        dbExport = await encryptionService.decryptObject<DatabaseExport>(backup.encryptedData);
      } catch {
        return {
          success: false,
          error: "Failed to decrypt the backup. Please verify your passphrase is correct.",
        };
      }

      // Validate decrypted data
      const hasV1Data = dbExport.data !== undefined;
      const hasV3Tables = dbExport.tables !== undefined;

      if (!dbExport.version || (!hasV1Data && !hasV3Tables)) {
        return {
          success: false,
          error: 'The decrypted backup data is not in the expected format.',
        };
      }

      // Extract company info from backup
      const backupCompanies = this.extractCompanyInfo(dbExport);

      // Detect mismatch
      const hasMismatch = sessionCompanyId
        ? backupCompanies.length > 0 && !backupCompanies.some(c => c.id === sessionCompanyId)
        : false;
      const hasMultipleCompanies = backupCompanies.length > 1;

      const mismatchInfo: CompanyMismatchInfo = {
        backupCompanies,
        sessionCompanyId: sessionCompanyId || '',
        sessionCompanyName,
        hasMismatch,
        hasMultipleCompanies,
      };

      // If mode is 'detect', return mismatch info without importing
      if (mode === 'detect') {
        if (hasMismatch || hasMultipleCompanies) {
          return {
            success: false,
            mismatchInfo,
            decryptedData: dbExport,
            error: hasMultipleCompanies
              ? 'This backup contains data from multiple accounts, which may indicate a corrupted or merged backup.'
              : 'This backup belongs to a different account.',
          };
        }
        // No mismatch - proceed with import
      }

      // If mode is 'claim', rewrite company IDs
      if (mode === 'claim' && sessionCompanyId) {
        const modified = this.rewriteCompanyIds(dbExport, sessionCompanyId);
        backupLogger.info('Claimed backup data', { modifiedRecords: modified });
      }

      // Import data
      backupLogger.debug('Importing data into database');
      await db.importAllData(dbExport);

      // Count records
      const recordsRestored = this.countRecords(dbExport);

      // Build details
      const getCount = (tableName: string): number => {
        if (hasV3Tables && dbExport.tables) {
          const table = dbExport.tables[tableName];
          return Array.isArray(table) ? table.length : 0;
        }
        if (hasV1Data && dbExport.data) {
          const table = (dbExport.data as Record<string, unknown[]>)[tableName];
          return Array.isArray(table) ? table.length : 0;
        }
        return 0;
      };

      backupLogger.info('Backup restoration completed successfully', {
        recordsRestored,
        mode,
      });

      return {
        success: true,
        recordsRestored,
        mismatchInfo,
        details: {
          accounts: getCount('accounts'),
          transactions: getCount('transactions'),
          contacts: getCount('contacts'),
          products: getCount('products'),
          companies: getCount('companies'),
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
}
