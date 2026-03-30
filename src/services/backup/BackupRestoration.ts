/**
 * Backup Restoration Service
 *
 * Implements Task 2.6 of the Backup & Sync Architecture Roadmap.
 * Provides complete restoration flow from local backup files.
 *
 * Key Features:
 * - Auto-detect backups on app startup (if database empty)
 * - File reading from File System Access API or manual upload
 * - Password prompt for decryption
 * - Progress indicator during restoration
 * - Success celebration animation
 * - Comprehensive error handling
 *
 * Security Features:
 * - HMAC integrity verification before restoration
 * - Password-based decryption using Argon2id
 * - Validation of backup structure
 * - Safe handling of corrupted backups
 *
 * Requirements:
 * - ROADMAP_BACKUP_AND_SYNC.md Task 2.6
 * - Uses BackupEncryption.restoreBackupBundle() from Phase 1
 * - Uses IntegrityVerification from Phase 1
 * - Steadiness communication style
 *
 * @module services/backup/BackupRestoration
 */

import { restoreBackupBundle, validateBackupBundleStructure } from './BackupEncryption';
import type { SecureBackupBundle, BackupData, RestoreBundleResult } from './BackupEncryption';
import { verifyBackupIntegrity } from './IntegrityVerification';
import { logger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/errors';

const restorationLogger = logger.child('BackupRestoration');

/**
 * Restoration progress stages
 */
export enum RestorationStage {
  READING_FILE = 'READING_FILE',
  VALIDATING_STRUCTURE = 'VALIDATING_STRUCTURE',
  VERIFYING_INTEGRITY = 'VERIFYING_INTEGRITY',
  DECRYPTING_DATA = 'DECRYPTING_DATA',
  RESTORING_DATABASE = 'RESTORING_DATABASE',
  COMPLETED = 'COMPLETED',
}

/**
 * Restoration progress information
 */
export interface RestorationProgress {
  stage: RestorationStage;
  percentage: number;
  message: string;
  details?: string;
}

/**
 * Restoration options
 */
export interface RestoreFromBackupOptions {
  /** Backup file (from File System Access API or manual upload) */
  file?: File;
  /** Or backup bundle directly (if already parsed) */
  bundle?: SecureBackupBundle;
  /** User's password for decryption */
  password: string;
  /** Progress callback */
  onProgress?: (progress: RestorationProgress) => void;
  /** Validation callback - allows caller to confirm restoration before applying */
  onValidate?: (metadata: SecureBackupBundle['metadata'], data: BackupData) => Promise<boolean>;
}

/**
 * Restoration result
 */
export interface RestorationResult {
  success: boolean;
  data?: BackupData;
  metadata?: SecureBackupBundle['metadata'];
  error?: string;
  errorCode?: ErrorCode;
  /** Detailed error for debugging */
  details?: unknown;
}

/**
 * Auto-detection result
 */
export interface BackupDetectionResult {
  found: boolean;
  backups?: BackupInfo[];
  error?: string;
}

/**
 * Information about a detected backup
 */
export interface BackupInfo {
  filename: string;
  timestamp: number;
  size: number;
  lastModified: Date;
  fileHandle?: FileSystemFileHandle;
}

/**
 * Database emptiness check result
 */
export interface DatabaseEmptyCheckResult {
  isEmpty: boolean;
  transactionCount?: number;
  accountCount?: number;
  error?: string;
}

/**
 * Read and parse backup file
 *
 * Reads the file content and parses it as JSON to extract the SecureBackupBundle.
 *
 * @param file - Backup file to read
 * @returns Promise resolving to parsed backup bundle
 * @throws AppError if file cannot be read or parsed
 *
 * @example
 * ```typescript
 * const bundle = await readBackupFile(file);
 * ```
 */
export async function readBackupFile(file: File): Promise<SecureBackupBundle> {
  try {
    restorationLogger.info('Reading backup file', {
      filename: file.name,
      size: file.size,
      type: file.type,
    });

    // Read file as text
    const text = await file.text();

    if (!text || text.trim().length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'The backup file appears to be empty. Please choose a valid backup file.'
      );
    }

    // Parse JSON
    let bundle: unknown;
    try {
      bundle = JSON.parse(text);
    } catch (parseError) {
      restorationLogger.error('Failed to parse backup file JSON', { parseError });
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'This doesn\'t look like a valid backup file. The file format is incorrect.'
      );
    }

    restorationLogger.info('Backup file read successfully', {
      filename: file.name,
      dataLength: text.length,
    });

    return bundle as SecureBackupBundle;
  } catch (error) {
    restorationLogger.error('Failed to read backup file', { error });
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'We couldn\'t read that backup file. Please make sure it\'s not corrupted and try again.'
    );
  }
}

/**
 * Validate backup bundle structure
 *
 * Checks that the bundle has all required fields and correct structure.
 * This is a preliminary check before attempting decryption.
 *
 * @param bundle - Bundle to validate
 * @throws AppError if bundle structure is invalid
 *
 * @example
 * ```typescript
 * await validateBundleStructure(bundle);
 * // Throws if invalid, returns void if valid
 * ```
 */
export async function validateBundleStructure(bundle: SecureBackupBundle): Promise<void> {
  try {
    restorationLogger.info('Validating backup bundle structure');

    const validation = validateBackupBundleStructure(bundle);

    if (!validation.valid) {
      restorationLogger.warn('Backup bundle structure validation failed', {
        error: validation.error,
      });
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `This backup file doesn't have the right structure. ${validation.error || 'Please check that it\'s a valid backup file.'}`
      );
    }

    restorationLogger.info('Backup bundle structure validated successfully');
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    restorationLogger.error('Failed to validate bundle structure', { error });
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'We couldn\'t validate this backup file. It may be corrupted or from an incompatible version.'
    );
  }
}

/**
 * Restore from local backup file
 *
 * This is the main restoration function that orchestrates the complete flow:
 * 1. Read and parse backup file (if provided)
 * 2. Validate bundle structure
 * 3. Verify HMAC integrity
 * 4. Decrypt data sections
 * 5. Validate restored data (optional callback)
 * 6. Return decrypted data for database restoration
 *
 * Progress callbacks are invoked at each stage to update UI.
 *
 * Security Notes:
 * - HMAC verification happens before decryption (detects tampering)
 * - Password verification happens through decryption success
 * - Wrong password results in user-friendly error message
 *
 * @param options - Restoration options
 * @returns Promise resolving to restoration result
 *
 * @example
 * ```typescript
 * const result = await restoreFromLocalBackup({
 *   file: selectedFile,
 *   password: userPassword,
 *   onProgress: (progress) => {
 *     console.log(`${progress.stage}: ${progress.percentage}%`);
 *   },
 *   onValidate: async (metadata, data) => {
 *     // Show confirmation modal to user
 *     return confirm('Restore this backup?');
 *   }
 * });
 *
 * if (result.success && result.data) {
 *   // Apply data to database
 *   await applyBackupToDatabase(result.data);
 * }
 * ```
 */
export async function restoreFromLocalBackup(
  options: RestoreFromBackupOptions
): Promise<RestorationResult> {
  const { file, bundle: providedBundle, password, onProgress, onValidate } = options;

  try {
    restorationLogger.info('Starting backup restoration', {
      hasFile: !!file,
      hasBundle: !!providedBundle,
      hasPassword: !!password,
    });

    // Validate inputs
    if (!file && !providedBundle) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Please provide either a backup file or bundle to restore.'
      );
    }

    if (!password || password.trim().length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'We need your password to decrypt the backup. Please enter your password.'
      );
    }

    let bundle: SecureBackupBundle;

    // Stage 1: Read file (if provided)
    if (file) {
      onProgress?.({
        stage: RestorationStage.READING_FILE,
        percentage: 10,
        message: 'Reading your backup file...',
        details: `File: ${file.name}`,
      });

      bundle = await readBackupFile(file);
    } else {
      bundle = providedBundle!;
    }

    // Stage 2: Validate structure
    onProgress?.({
      stage: RestorationStage.VALIDATING_STRUCTURE,
      percentage: 25,
      message: 'Checking backup file structure...',
      details: 'Making sure everything looks right',
    });

    await validateBundleStructure(bundle);

    // Stage 3: Verify integrity (HMAC)
    onProgress?.({
      stage: RestorationStage.VERIFYING_INTEGRITY,
      percentage: 40,
      message: 'Verifying backup integrity...',
      details: 'Checking for tampering',
    });

    const integrityResult = await verifyBackupIntegrity(bundle, password);

    if (!integrityResult.success) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        integrityResult.error || 'Backup integrity verification failed.'
      );
    }

    if (!integrityResult.valid) {
      restorationLogger.warn('Backup integrity verification failed - tampered or wrong password');
      throw new AppError(
        ErrorCode.DECRYPTION_FAILED,
        'That password didn\'t work, or the backup file may have been tampered with. Please double-check your password and try again.'
      );
    }

    restorationLogger.info('Backup integrity verified successfully');

    // Stage 4: Decrypt data
    onProgress?.({
      stage: RestorationStage.DECRYPTING_DATA,
      percentage: 60,
      message: 'Decrypting your data...',
      details: 'This may take a moment',
    });

    const restoreResult: RestoreBundleResult = await restoreBackupBundle(bundle, password);

    if (!restoreResult.success || !restoreResult.data) {
      restorationLogger.error('Failed to restore backup bundle', {
        error: restoreResult.error,
        errorCode: restoreResult.errorCode,
      });
      throw new AppError(
        restoreResult.errorCode || ErrorCode.DECRYPTION_FAILED,
        restoreResult.error || 'We couldn\'t decrypt the backup. Please check your password and try again.'
      );
    }

    restorationLogger.info('Backup decrypted successfully', {
      companyId: restoreResult.metadata?.companyId,
      userId: restoreResult.metadata?.userId,
      timestamp: restoreResult.metadata?.timestamp,
    });

    // Stage 5: Validate with caller (optional)
    if (onValidate) {
      onProgress?.({
        stage: RestorationStage.RESTORING_DATABASE,
        percentage: 80,
        message: 'Preparing to restore...',
        details: 'Confirming restoration',
      });

      const shouldRestore = await onValidate(restoreResult.metadata!, restoreResult.data);

      if (!shouldRestore) {
        restorationLogger.info('Restoration cancelled by user');
        return {
          success: false,
          error: 'Restoration was cancelled.',
          errorCode: ErrorCode.VALIDATION_ERROR,
        };
      }
    }

    // Stage 6: Complete
    onProgress?.({
      stage: RestorationStage.COMPLETED,
      percentage: 100,
      message: 'Restoration complete!',
      details: 'Welcome back! Your data is safe and sound.',
    });

    restorationLogger.info('Backup restoration completed successfully', {
      companyId: restoreResult.metadata?.companyId,
      transactionCount: Array.isArray(restoreResult.data.transactions)
        ? restoreResult.data.transactions.length
        : 0,
      accountCount: Array.isArray(restoreResult.data.accounts)
        ? restoreResult.data.accounts.length
        : 0,
    });

    return {
      success: true,
      data: restoreResult.data,
      metadata: restoreResult.metadata,
    };
  } catch (error) {
    restorationLogger.error('Backup restoration failed', { error });

    if (error instanceof AppError) {
      return {
        success: false,
        error: error.message,
        errorCode: error.code,
        details: error.details,
      };
    }

    return {
      success: false,
      error: 'Something unexpected happened during restoration. Please try again.',
      errorCode: ErrorCode.UNKNOWN_ERROR,
      details: error,
    };
  }
}

/**
 * Check if database is empty
 *
 * Determines if the database has any meaningful data by checking
 * key tables (transactions, accounts). Used to decide whether to
 * show restoration prompt on app startup.
 *
 * Note: This function is intentionally database-agnostic and expects
 * the caller to provide table access or implement this check in their
 * database layer.
 *
 * @param db - Database instance with tables property
 * @returns Promise resolving to emptiness check result
 *
 * @example
 * ```typescript
 * import { db } from '../../db';
 * const check = await isDatabaseEmpty(db);
 * if (check.isEmpty) {
 *   // Show restoration prompt
 * }
 * ```
 */
export async function isDatabaseEmpty(db: {
  transactions: { count: () => Promise<number> };
  accounts: { count: () => Promise<number> };
}): Promise<DatabaseEmptyCheckResult> {
  try {
    restorationLogger.info('Checking if database is empty');

    const [transactionCount, accountCount] = await Promise.all([
      db.transactions.count(),
      db.accounts.count(),
    ]);

    const isEmpty = transactionCount === 0 && accountCount === 0;

    restorationLogger.info('Database emptiness check completed', {
      isEmpty,
      transactionCount,
      accountCount,
    });

    return {
      isEmpty,
      transactionCount,
      accountCount,
    };
  } catch (error) {
    restorationLogger.error('Failed to check database emptiness', { error });
    return {
      isEmpty: false,
      error: 'Failed to check database status',
    };
  }
}

/**
 * Auto-detect backups in File System Access API folder
 *
 * Scans the backup folder (if permission granted) for backup files.
 * Returns list of available backups sorted by timestamp (newest first).
 *
 * Browser Support:
 * - Chrome 86+, Edge 86+: Full support
 * - Firefox, Safari: Not supported (will return empty list)
 *
 * @param folderHandle - FileSystemDirectoryHandle for backup folder (optional)
 * @returns Promise resolving to backup detection result
 *
 * @example
 * ```typescript
 * // Get folder handle from IndexedDB (stored during onboarding)
 * const folderHandle = await getStoredFolderHandle();
 * const detection = await autoDetectBackups(folderHandle);
 *
 * if (detection.found && detection.backups) {
 *   // Show restoration modal with backup list
 * }
 * ```
 */
export async function autoDetectBackups(
  folderHandle?: FileSystemDirectoryHandle
): Promise<BackupDetectionResult> {
  try {
    // Check for File System Access API support
    if (!('showDirectoryPicker' in window)) {
      restorationLogger.info('File System Access API not supported');
      return {
        found: false,
        backups: [],
      };
    }

    if (!folderHandle) {
      restorationLogger.info('No folder handle provided for backup detection');
      return {
        found: false,
        backups: [],
      };
    }

    restorationLogger.info('Auto-detecting backups in folder');

    const backups: BackupInfo[] = [];

    // Iterate through directory entries
    for await (const entry of folderHandle.values()) {
      if (entry.kind === 'file') {
        // Check if filename matches backup pattern
        if (entry.name.match(/^audacious-backup-.*\.encrypted$/)) {
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();

          // Extract timestamp from filename (format: audacious-backup-YYYY-MM-DD-HHmmss.encrypted)
          const timestampMatch = entry.name.match(
            /audacious-backup-(\d{4})-(\d{2})-(\d{2})-(\d{6})\.encrypted/
          );
          let timestamp = file.lastModified;
          if (timestampMatch) {
            const [, year, month, day, time] = timestampMatch;
            const hours = time.substring(0, 2);
            const minutes = time.substring(2, 4);
            const seconds = time.substring(4, 6);
            const dateStr = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
            timestamp = new Date(dateStr).getTime();
          }

          backups.push({
            filename: entry.name,
            timestamp,
            size: file.size,
            lastModified: new Date(file.lastModified),
            fileHandle,
          });
        }
      }
    }

    // Sort by timestamp (newest first)
    backups.sort((a, b) => b.timestamp - a.timestamp);

    restorationLogger.info('Backup auto-detection completed', {
      backupsFound: backups.length,
    });

    return {
      found: backups.length > 0,
      backups,
    };
  } catch (error) {
    restorationLogger.error('Failed to auto-detect backups', { error });
    return {
      found: false,
      backups: [],
      error: error instanceof Error ? error.message : 'Failed to detect backups',
    };
  }
}

/**
 * Get user-friendly error message for restoration errors
 *
 * Provides Steadiness communication style messages for common restoration errors.
 *
 * @param errorCode - Error code from restoration attempt
 * @param defaultMessage - Default message if no specific message exists
 * @returns User-friendly error message
 *
 * @example
 * ```typescript
 * const message = getRestorationErrorMessage(ErrorCode.DECRYPTION_FAILED);
 * // "That password didn't work. Want to try again?"
 * ```
 */
export function getRestorationErrorMessage(
  errorCode: ErrorCode,
  defaultMessage?: string
): string {
  const messages: Partial<Record<ErrorCode, string>> = {
    [ErrorCode.DECRYPTION_FAILED]:
      'That password didn\'t work. Want to try again? (Or the backup file may have been tampered with.)',
    [ErrorCode.VALIDATION_ERROR]:
      'This backup file doesn\'t look quite right. Please make sure it\'s a valid backup file and try again.',
    [ErrorCode.ENCRYPTION_ERROR]:
      'We had trouble reading the encrypted data. The backup file may be corrupted.',
    [ErrorCode.NOT_FOUND]:
      'We couldn\'t find that backup file. Please choose a file and try again.',
    [ErrorCode.UNKNOWN_ERROR]:
      'Something unexpected happened. Please try again, or contact support if the problem continues.',
  };

  return messages[errorCode] || defaultMessage || 'Restoration failed. Please try again.';
}

/**
 * Format backup info for display
 *
 * Creates a user-friendly description of a backup file for UI display.
 *
 * @param backup - Backup info to format
 * @returns Formatted string for display
 *
 * @example
 * ```typescript
 * const display = formatBackupInfo(backup);
 * // "2024-01-15 at 3:30 PM (2.5 MB)"
 * ```
 */
export function formatBackupInfo(backup: BackupInfo): string {
  const date = new Date(backup.timestamp);
  const dateStr = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const sizeStr = formatFileSize(backup.size);

  return `${dateStr} at ${timeStr} (${sizeStr})`;
}

/**
 * Format file size for display
 *
 * @param bytes - File size in bytes
 * @returns Formatted size string
 *
 * @example
 * ```typescript
 * formatFileSize(2500000); // "2.5 MB"
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Check if restoration is supported in current browser
 *
 * @returns True if File System Access API is supported
 *
 * @example
 * ```typescript
 * if (isRestorationSupported()) {
 *   // Show automatic backup detection
 * } else {
 *   // Show manual file upload only
 * }
 * ```
 */
export function isRestorationSupported(): boolean {
  return 'showDirectoryPicker' in window && 'FileSystemFileHandle' in window;
}
