/**
 * Backup Fallback Strategy for Unsupported Browsers
 *
 * Implements Task 2.8 of the Backup & Sync Architecture Roadmap.
 * Provides graceful degradation for browsers that don't support
 * the File System Access API (Safari, Firefox).
 *
 * Features:
 * - Browser capability detection
 * - Manual download/upload as fallback
 * - User-friendly guidance to supported browsers
 * - Steadiness communication style (patient, supportive)
 *
 * Browser Support:
 * - Chrome 86+: File System Access API ✅
 * - Edge 86+: File System Access API ✅
 * - Safari: Manual fallback only ⚠️
 * - Firefox: Manual fallback only ⚠️
 *
 * Requirements:
 * - Phase 2, Task 2.8: Fallback for Unsupported Browsers
 * - Graceful degradation (never block users)
 * - Alternative backup methods
 * - Clear user guidance
 *
 * @module BackupFallback
 */

import { logger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/errors';
import type { BackupResult, RestoreResult, EncryptedBackup } from './backupService';
import { BackupService } from './backupService';

const fallbackLogger = logger.child('BackupFallback');

/**
 * Browser capabilities for backup operations
 */
export interface BrowserCapabilities {
  /** Whether File System Access API is supported */
  supportsFileSystemAccess: boolean;
  /** Whether IndexedDB is supported */
  supportsIndexedDB: boolean;
  /** Whether Web Crypto API is supported */
  supportsWebCrypto: boolean;
  /** Browser name (detected) */
  browserName: string;
  /** Browser version (detected) */
  browserVersion: string;
}

/**
 * Backup method types
 */
export type BackupMethod = 'file-system-access' | 'manual-download' | 'unsupported';

/**
 * Backup capability result
 */
export interface BackupCapabilityResult {
  /** Capabilities detected */
  capabilities: BrowserCapabilities;
  /** Recommended backup method */
  recommendedMethod: BackupMethod;
  /** Whether automatic backups are possible */
  canAutoBackup: boolean;
  /** User-friendly message about capabilities */
  message: string;
  /** Whether user should consider switching browsers */
  shouldSuggestBrowserChange: boolean;
  /** List of supported browsers */
  supportedBrowsers: string[];
}

/**
 * Manual download options
 */
export interface ManualDownloadOptions {
  /** Passphrase for encryption */
  passphrase: string;
  /** Whether to include audit logs */
  includeAuditLogs?: boolean;
  /** Custom filename (optional) */
  filename?: string;
}

/**
 * Manual upload options
 */
export interface ManualUploadOptions {
  /** File to upload */
  file: File;
  /** Passphrase for decryption */
  passphrase: string;
  /** Whether to clear existing data */
  clearExisting?: boolean;
}

/**
 * Notification options for unsupported browsers
 */
export interface UnsupportedBrowserNotification {
  /** Title of notification */
  title: string;
  /** Main message */
  message: string;
  /** Type of notification */
  type: 'info' | 'warning';
  /** Whether to show "Learn More" link */
  showLearnMore: boolean;
  /** URL for "Learn More" link */
  learnMoreUrl?: string;
  /** List of actions available */
  actions: {
    label: string;
    description: string;
    available: boolean;
  }[];
}

/**
 * Detect browser capabilities for backup operations
 *
 * Checks for:
 * - File System Access API
 * - IndexedDB
 * - Web Crypto API
 * - Browser name and version
 *
 * @returns Promise resolving to BackupCapabilityResult
 *
 * @example
 * ```typescript
 * const result = await detectBackupCapabilities();
 * if (!result.canAutoBackup) {
 *   // Show manual backup instructions
 *   console.log(result.message);
 * }
 * ```
 */
export async function detectBackupCapabilities(): Promise<BackupCapabilityResult> {
  try {
    fallbackLogger.debug('Detecting browser capabilities');

    // Detect File System Access API support
    const supportsFileSystemAccess = 'showDirectoryPicker' in window;

    // Detect IndexedDB support
    const supportsIndexedDB = 'indexedDB' in window;

    // Detect Web Crypto API support
    const supportsWebCrypto = 'crypto' in window && 'subtle' in window.crypto;

    // Detect browser name and version
    const { browserName, browserVersion } = detectBrowser();

    const capabilities: BrowserCapabilities = {
      supportsFileSystemAccess,
      supportsIndexedDB,
      supportsWebCrypto,
      browserName,
      browserVersion,
    };

    // Determine recommended method
    let recommendedMethod: BackupMethod;
    let canAutoBackup: boolean;
    let message: string;
    let shouldSuggestBrowserChange: boolean;

    if (supportsFileSystemAccess && supportsIndexedDB && supportsWebCrypto) {
      // Full support - Chrome, Edge
      recommendedMethod = 'file-system-access';
      canAutoBackup = true;
      message = 'Your browser supports automatic backups. We\'ll save your data safely in a location you choose.';
      shouldSuggestBrowserChange = false;
    } else if (!supportsFileSystemAccess && supportsIndexedDB && supportsWebCrypto) {
      // Partial support - Safari, Firefox
      recommendedMethod = 'manual-download';
      canAutoBackup = false;
      message = 'Your browser doesn\'t support automatic backups, but you can manually download and save backup files whenever you like.';
      shouldSuggestBrowserChange = true;
    } else {
      // Minimal or no support
      recommendedMethod = 'unsupported';
      canAutoBackup = false;
      message = 'Your browser has limited support for secure backups. For the best experience, please use Chrome or Edge.';
      shouldSuggestBrowserChange = true;
    }

    const supportedBrowsers = [
      'Chrome 86 or later',
      'Microsoft Edge 86 or later',
    ];

    fallbackLogger.info('Browser capabilities detected', {
      browserName,
      browserVersion,
      recommendedMethod,
      canAutoBackup,
    });

    return {
      capabilities,
      recommendedMethod,
      canAutoBackup,
      message,
      shouldSuggestBrowserChange,
      supportedBrowsers,
    };
  } catch (error) {
    fallbackLogger.error('Failed to detect browser capabilities', error);

    // Safe fallback - assume manual method
    return {
      capabilities: {
        supportsFileSystemAccess: false,
        supportsIndexedDB: true,
        supportsWebCrypto: true,
        browserName: 'Unknown',
        browserVersion: 'Unknown',
      },
      recommendedMethod: 'manual-download',
      canAutoBackup: false,
      message: 'We couldn\'t detect your browser\'s capabilities. You can still use manual backup downloads.',
      shouldSuggestBrowserChange: true,
      supportedBrowsers: ['Chrome 86 or later', 'Microsoft Edge 86 or later'],
    };
  }
}

/**
 * Detect browser name and version
 *
 * Uses user agent parsing to identify the browser.
 * This is a basic implementation - for production, consider using
 * a library like `ua-parser-js` for more accurate detection.
 *
 * @returns Browser name and version
 */
function detectBrowser(): { browserName: string; browserVersion: string } {
  try {
    const ua = navigator.userAgent;

  // Chrome
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    const match = ua.match(/Chrome\/(\d+)/);
    return {
      browserName: 'Chrome',
      browserVersion: match ? match[1] : 'Unknown',
    };
  }

  // Edge (Chromium-based)
  if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/(\d+)/);
    return {
      browserName: 'Edge',
      browserVersion: match ? match[1] : 'Unknown',
    };
  }

  // Safari
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    const match = ua.match(/Version\/(\d+)/);
    return {
      browserName: 'Safari',
      browserVersion: match ? match[1] : 'Unknown',
    };
  }

  // Firefox
  if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/(\d+)/);
    return {
      browserName: 'Firefox',
      browserVersion: match ? match[1] : 'Unknown',
    };
  }

  // Unknown
  return {
    browserName: 'Unknown',
    browserVersion: 'Unknown',
  };
  } catch (error) {
    // If userAgent access fails (e.g., in tests), return Unknown
    return {
      browserName: 'Unknown',
      browserVersion: 'Unknown',
    };
  }
}

/**
 * Create a manual backup download
 *
 * This is the fallback method for browsers that don't support
 * the File System Access API. It creates an encrypted backup
 * and triggers a browser download.
 *
 * @param options - Manual download options
 * @returns Promise resolving to BackupResult
 *
 * @example
 * ```typescript
 * const result = await createManualBackupDownload({
 *   passphrase: 'user-passphrase',
 *   includeAuditLogs: true,
 * });
 *
 * if (result.success) {
 *   // Download triggered automatically
 *   console.log('Backup downloaded:', result.filename);
 * }
 * ```
 */
export async function createManualBackupDownload(
  options: ManualDownloadOptions
): Promise<BackupResult> {
  try {
    fallbackLogger.info('Creating manual backup download');

    // Validate passphrase
    if (!options.passphrase || options.passphrase.trim().length === 0) {
      return {
        success: false,
        error: 'A passphrase is required to create a backup. Please enter your passphrase and try again.',
      };
    }

    // Create encrypted backup using existing BackupService
    const result = await BackupService.createBackup(
      options.passphrase,
      options.includeAuditLogs ?? true
    );

    if (!result.success || !result.blob || !result.filename) {
      return result;
    }

    // Trigger download
    const filename = options.filename || result.filename;
    BackupService.downloadBackup(result.blob, filename);

    fallbackLogger.info('Manual backup download completed', { filename });

    return {
      success: true,
      backup: result.backup,
      blob: result.blob,
      filename,
    };
  } catch (error) {
    fallbackLogger.error('Failed to create manual backup download', error);
    return {
      success: false,
      error: error instanceof Error
        ? `Something went wrong while creating the backup: ${error.message}`
        : 'An unexpected error occurred while creating the backup.',
    };
  }
}

/**
 * Restore from a manual backup upload
 *
 * This is the fallback method for restoring backups when
 * the File System Access API is not available.
 *
 * @param options - Manual upload options
 * @returns Promise resolving to RestoreResult
 *
 * @example
 * ```typescript
 * const fileInput = document.getElementById('backup-file') as HTMLInputElement;
 * const file = fileInput.files?.[0];
 *
 * if (file) {
 *   const result = await restoreFromManualUpload({
 *     file,
 *     passphrase: 'user-passphrase',
 *     clearExisting: true,
 *   });
 *
 *   if (result.success) {
 *     console.log('Restored', result.recordsRestored, 'records');
 *   }
 * }
 * ```
 */
export async function restoreFromManualUpload(
  options: ManualUploadOptions
): Promise<RestoreResult> {
  try {
    // Validate file first (before logging)
    if (!options.file) {
      return {
        success: false,
        error: 'Please select a backup file to restore.',
      };
    }

    fallbackLogger.info('Restoring from manual upload', {
      filename: options.file.name,
      size: options.file.size,
    });

    // Validate passphrase
    if (!options.passphrase || options.passphrase.trim().length === 0) {
      return {
        success: false,
        error: 'A passphrase is required to restore from a backup. Please enter your passphrase and try again.',
      };
    }

    // Validate file extension (optional but helpful)
    if (!options.file.name.endsWith('.gbbackup')) {
      fallbackLogger.warn('File does not have .gbbackup extension', {
        filename: options.file.name,
      });
      // Don't fail - user might have renamed the file
    }

    // Restore using existing BackupService
    const result = await BackupService.restoreBackup(
      options.file,
      options.passphrase,
      options.clearExisting ?? true
    );

    if (result.success) {
      fallbackLogger.info('Manual restore completed successfully', {
        recordsRestored: result.recordsRestored,
      });
    }

    return result;
  } catch (error) {
    fallbackLogger.error('Failed to restore from manual upload', error);
    return {
      success: false,
      error: error instanceof Error
        ? `Something went wrong while restoring the backup: ${error.message}`
        : 'An unexpected error occurred while restoring the backup.',
    };
  }
}

/**
 * Get notification for unsupported browser
 *
 * Creates a user-friendly notification with guidance
 * for browsers that don't support automatic backups.
 *
 * Uses Steadiness communication style:
 * - Patient and supportive
 * - Clear next steps
 * - No blame or judgment
 * - Emphasizes what IS possible
 *
 * @returns Notification configuration
 *
 * @example
 * ```typescript
 * const notification = getUnsupportedBrowserNotification();
 *
 * // Show to user in UI
 * showNotification({
 *   title: notification.title,
 *   message: notification.message,
 *   type: notification.type,
 * });
 * ```
 */
export function getUnsupportedBrowserNotification(): UnsupportedBrowserNotification {
  return {
    title: 'Manual Backups Available',
    message: 'Your browser doesn\'t support automatic backups, but don\'t worry - you can still protect your data! You can manually download backup files whenever you like and upload them to restore your data. For automatic backups, consider using Chrome or Edge.',
    type: 'info',
    showLearnMore: true,
    learnMoreUrl: 'https://docs.gracefulbooks.com/backup-support',
    actions: [
      {
        label: 'Download Backup Now',
        description: 'Save an encrypted backup file to your computer',
        available: true,
      },
      {
        label: 'Upload Backup File',
        description: 'Restore your data from a backup file',
        available: true,
      },
      {
        label: 'Automatic Backups',
        description: 'Set up automatic backups (requires Chrome or Edge)',
        available: false,
      },
    ],
  };
}

/**
 * Get browser recommendation message
 *
 * Creates a helpful message guiding users to supported browsers.
 * Uses Steadiness communication style - supportive, not pushy.
 *
 * @param currentBrowser - Current browser name
 * @returns User-friendly recommendation message
 *
 * @example
 * ```typescript
 * const message = getBrowserRecommendationMessage('Safari');
 * console.log(message);
 * // "For automatic backups, we recommend using Chrome or Edge..."
 * ```
 */
export function getBrowserRecommendationMessage(currentBrowser: string): string {
  const messages: Record<string, string> = {
    Safari: 'For automatic backups, we recommend using Chrome or Edge. Safari works great for manual backups, though! You can download backup files anytime you need them.',
    Firefox: 'For automatic backups, we recommend using Chrome or Edge. Firefox works great for manual backups, though! You can download backup files anytime you need them.',
    Unknown: 'For the best backup experience, we recommend using Chrome (version 86 or later) or Microsoft Edge (version 86 or later). These browsers support automatic backups. Your current browser will work fine with manual backup downloads.',
  };

  return messages[currentBrowser] || messages.Unknown;
}

/**
 * Check if browser is supported for automatic backups
 *
 * Simple boolean check for UI conditional rendering.
 *
 * @returns Promise resolving to true if automatic backups are supported
 *
 * @example
 * ```typescript
 * const isSupported = await isAutomaticBackupSupported();
 * if (isSupported) {
 *   // Show automatic backup UI
 * } else {
 *   // Show manual backup UI
 * }
 * ```
 */
export async function isAutomaticBackupSupported(): Promise<boolean> {
  const capabilities = await detectBackupCapabilities();
  return capabilities.canAutoBackup;
}

/**
 * Validate file is a valid backup file
 *
 * Checks file extension and basic structure without decrypting.
 * Useful for providing immediate feedback before attempting restore.
 *
 * @param file - File to validate
 * @returns Promise resolving to validation result
 *
 * @example
 * ```typescript
 * const result = await validateBackupFile(file);
 * if (!result.valid) {
 *   alert(result.error);
 * }
 * ```
 */
export async function validateBackupFile(file: File): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    // Check if file is provided
    if (!file) {
      return {
        valid: false,
        error: 'Please select a file to validate.',
      };
    }

    // Check file size (basic sanity check)
    if (file.size === 0) {
      return {
        valid: false,
        error: 'This file appears to be empty. Please check that you selected the correct backup file.',
      };
    }

    if (file.size > 100 * 1024 * 1024) {
      // 100MB limit
      return {
        valid: false,
        error: 'This file is unusually large for a backup. Please verify you selected the correct file.',
      };
    }

    // Check file extension (optional but helpful)
    const hasCorrectExtension = file.name.endsWith('.gbbackup');
    if (!hasCorrectExtension) {
      fallbackLogger.warn('File does not have .gbbackup extension', {
        filename: file.name,
      });
      // Don't fail - proceed to content validation
    }

    // Try to read and parse as JSON
    try {
      const content = await file.text();
      const parsed = JSON.parse(content);

      // Basic structure validation
      if (!parsed.version || !parsed.createdAt || !parsed.encryptedData) {
        return {
          valid: false,
          error: 'This doesn\'t appear to be a valid backup file. It\'s missing required information.',
        };
      }

      return { valid: true };
    } catch (parseError) {
      return {
        valid: false,
        error: 'This file doesn\'t appear to be a valid backup. Please check that you selected the correct file.',
      };
    }
  } catch (error) {
    fallbackLogger.error('Failed to validate backup file', error);
    return {
      valid: false,
      error: 'We couldn\'t read this file. Please try again or select a different file.',
    };
  }
}

/**
 * Get user-friendly error message for backup failures
 *
 * Translates technical errors into supportive, actionable messages.
 * Uses Steadiness communication style.
 *
 * @param error - Error that occurred
 * @returns User-friendly error message
 */
export function getFriendlyBackupErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    switch (error.code) {
      case ErrorCode.ENCRYPTION_ERROR:
        return 'Something went wrong while securing your backup. Please try again. If the problem continues, let us know and we\'ll help.';
      case ErrorCode.DECRYPTION_FAILED:
        return 'That passphrase didn\'t work. Want to try again? Make sure you\'re using the same passphrase you used when creating the backup.';
      case ErrorCode.INVALID_PASSPHRASE:
        return 'That passphrase doesn\'t match. Please double-check your passphrase and try again.';
      case ErrorCode.VALIDATION_ERROR:
        return 'This backup file doesn\'t look quite right. Please verify you selected the correct file.';
      default:
        return error.message || 'Something unexpected happened. Please try again.';
    }
  }

  if (error instanceof Error) {
    return `Oops! ${error.message}`;
  }

  return 'Something unexpected happened while working with your backup. Please try again.';
}

/**
 * Export all functions for easy testing
 */
export const BackupFallback = {
  detectBackupCapabilities,
  createManualBackupDownload,
  restoreFromManualUpload,
  getUnsupportedBrowserNotification,
  getBrowserRecommendationMessage,
  isAutomaticBackupSupported,
  validateBackupFile,
  getFriendlyBackupErrorMessage,
};
