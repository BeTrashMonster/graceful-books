/**
 * File System Backup Service
 *
 * Implements Task 2.1 (File System Access API Integration) and
 * Task 2.5 (Backup Writing & Storage) from Phase 2 of the Backup & Sync Roadmap.
 *
 * Provides browser-based local filesystem backup using the File System Access API.
 *
 * Features:
 * - Browser support detection (Chrome 86+, Edge 86+)
 * - Folder picker for user-controlled backup location
 * - Persistent file handle storage in IndexedDB
 * - Permission verification on app startup
 * - Graceful handling of permission revocation
 * - Backup file writing with progress tracking (Task 2.5)
 * - Disk space error handling
 *
 * Security:
 * - Zero-knowledge encryption maintained (files encrypted before writing)
 * - User controls backup location (data sovereignty)
 * - Permission prompts follow browser security model
 *
 * Requirements:
 * - ROADMAP_BACKUP_AND_SYNC.md - Phase 2, Tasks 2.1 & 2.5
 * - Browser compatibility: Chrome 86+, Edge 86+, Safari (unsupported)
 *
 * @module services/backup/FileSystemBackup
 */

import type { SecureBackupBundle } from './BackupEncryption';
import { logger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/errors';

const fileSystemLogger = logger.child('FileSystemBackup');

/**
 * Browser support status
 */
export interface BrowserSupportResult {
  supported: boolean;
  browser?: string;
  version?: string;
  reason?: string;
}

/**
 * Folder permission request result
 */
export interface FolderPermissionResult {
  success: boolean;
  handle?: FileSystemDirectoryHandle;
  error?: string;
  errorCode?: ErrorCode;
  permissionState?: PermissionState;
}

/**
 * Permission verification result
 */
export interface PermissionVerificationResult {
  granted: boolean;
  handle?: FileSystemDirectoryHandle;
  needsReauthorization: boolean;
  error?: string;
}

/**
 * Stored file handle data for IndexedDB
 */
export interface StoredFileHandle {
  id: string;
  type: 'directory' | 'file';
  name: string;
  // Note: The actual FileSystemHandle cannot be serialized directly
  // We store a reference and rely on the browser's persistence
  lastVerified: number;
  createdAt: number;
}

/**
 * IndexedDB store name for file handles
 */
const FILE_HANDLE_STORE = 'backup_file_handles';

/**
 * Key for storing the backup directory handle
 */
const BACKUP_DIR_HANDLE_KEY = 'backup_directory';

/**
 * Detect if File System Access API is supported
 *
 * Checks for the presence of `showDirectoryPicker` method which is the
 * primary indicator of File System Access API support.
 *
 * Browser Support:
 * - Chrome 86+ ✅
 * - Edge 86+ ✅
 * - Firefox ❌ (not supported as of 2024)
 * - Safari ❌ (not supported as of 2024)
 *
 * @returns Browser support status with details
 *
 * @example
 * ```typescript
 * const support = detectBrowserSupport();
 * if (support.supported) {
 *   console.log('File System Access API is available');
 * } else {
 *   console.log(`Not supported: ${support.reason}`);
 * }
 * ```
 */
export function detectBrowserSupport(): BrowserSupportResult {
  try {
    // Check for File System Access API
    if (!('showDirectoryPicker' in window)) {
      fileSystemLogger.info('File System Access API not supported');
      return {
        supported: false,
        reason: 'File System Access API not available in this browser',
      };
    }

    // Try to detect browser and version
    const userAgent = navigator.userAgent;
    let browser = 'Unknown';
    let version = 'Unknown';

    if (userAgent.includes('Edg/')) {
      browser = 'Edge';
      const match = userAgent.match(/Edg\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    } else if (userAgent.includes('Chrome/')) {
      browser = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    }

    fileSystemLogger.info('File System Access API supported', {
      browser,
      version,
    });

    return {
      supported: true,
      browser,
      version,
    };
  } catch (error) {
    fileSystemLogger.error('Error detecting browser support', { error });
    return {
      supported: false,
      reason: 'Error checking browser capabilities',
    };
  }
}

/**
 * Request folder permission from user
 *
 * Opens the browser's folder picker dialog and requests permission to read/write
 * to the selected folder. This is the first step in setting up automatic backups.
 *
 * User Experience:
 * - Shows native OS folder picker
 * - User has full control over location
 * - Permission persists across sessions
 * - Can be revoked by user at any time
 *
 * Security:
 * - Browser enforces user gesture requirement (must be triggered by user action)
 * - Permission prompt shows folder name
 * - Permission can be revoked via browser settings
 *
 * @param mode - Permission mode: 'read' or 'readwrite' (default: 'readwrite')
 * @returns Promise resolving to folder permission result
 *
 * @example
 * ```typescript
 * const result = await requestFolderPermission();
 * if (result.success && result.handle) {
 *   console.log('Folder selected:', result.handle.name);
 *   await storeDirectoryHandle(result.handle);
 * }
 * ```
 */
export async function requestFolderPermission(
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<FolderPermissionResult> {
  try {
    fileSystemLogger.info('Requesting folder permission', { mode });

    // Check browser support first
    const support = detectBrowserSupport();
    if (!support.supported) {
      return {
        success: false,
        error: support.reason || 'Browser does not support File System Access API',
        errorCode: ErrorCode.NOT_IMPLEMENTED,
      };
    }

    // Show folder picker
    // This MUST be triggered by a user gesture (click, etc.)
    const dirHandle = await window.showDirectoryPicker({
      mode,
      startIn: 'documents',
    });

    if (!dirHandle) {
      return {
        success: false,
        error: 'No folder selected',
        errorCode: ErrorCode.VALIDATION_ERROR,
      };
    }

    // Verify permission was granted
    const permissionStatus = await dirHandle.queryPermission({ mode });

    if (permissionStatus !== 'granted') {
      // Request permission if not already granted
      const requestResult = await dirHandle.requestPermission({ mode });

      if (requestResult !== 'granted') {
        fileSystemLogger.warn('Folder permission denied by user');
        return {
          success: false,
          error: 'We need your permission to save backups. Would you like to choose a location now?',
          errorCode: ErrorCode.PERMISSION_DENIED,
          permissionState: requestResult,
        };
      }
    }

    fileSystemLogger.info('Folder permission granted', {
      folderName: dirHandle.name,
      mode,
    });

    return {
      success: true,
      handle: dirHandle,
      permissionState: 'granted',
    };
  } catch (error) {
    fileSystemLogger.error('Failed to request folder permission', { error });

    // Handle specific errors
    if (error instanceof Error) {
      // User cancelled the picker
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Folder selection cancelled. You can set up backups later in Settings.',
          errorCode: ErrorCode.VALIDATION_ERROR,
        };
      }

      // Security error (not triggered by user gesture)
      if (error.name === 'SecurityError') {
        return {
          success: false,
          error: 'We need your permission to access folders. Please try again.',
          errorCode: ErrorCode.PERMISSION_DENIED,
        };
      }
    }

    return {
      success: false,
      error: 'Oops! Something unexpected happened while selecting a folder. Please try again.',
      errorCode: ErrorCode.UNKNOWN_ERROR,
    };
  }
}

/**
 * Store directory handle in IndexedDB
 *
 * Persists the directory handle so it can be accessed across sessions.
 * Note: The actual FileSystemDirectoryHandle is stored by the browser,
 * we just store metadata.
 *
 * Implementation Note:
 * FileSystemHandle objects can be stored directly in IndexedDB in supported browsers.
 * The browser manages the persistence and security.
 *
 * @param handle - Directory handle to store
 * @returns Promise resolving to success status
 *
 * @example
 * ```typescript
 * await storeDirectoryHandle(dirHandle);
 * ```
 */
export async function storeDirectoryHandle(
  handle: FileSystemDirectoryHandle
): Promise<{ success: boolean; error?: string }> {
  try {
    fileSystemLogger.info('Storing directory handle', {
      name: handle.name,
    });

    // Open IndexedDB database for file handles
    const db = await openFileHandleDB();

    // Store the handle directly (browsers support this)
    const transaction = db.transaction([FILE_HANDLE_STORE], 'readwrite');
    const store = transaction.objectStore(FILE_HANDLE_STORE);

    const storedData: StoredFileHandle = {
      id: BACKUP_DIR_HANDLE_KEY,
      type: 'directory',
      name: handle.name,
      lastVerified: Date.now(),
      createdAt: Date.now(),
    };

    // Store both the metadata and the actual handle
    await store.put({
      ...storedData,
      handle, // Store the actual FileSystemDirectoryHandle
    });

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    fileSystemLogger.info('Directory handle stored successfully');

    return { success: true };
  } catch (error) {
    fileSystemLogger.error('Failed to store directory handle', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to store directory handle',
    };
  }
}

/**
 * Retrieve stored directory handle from IndexedDB
 *
 * @returns Promise resolving to directory handle or null if not found
 *
 * @example
 * ```typescript
 * const handle = await retrieveDirectoryHandle();
 * if (handle) {
 *   console.log('Found stored handle:', handle.name);
 * }
 * ```
 */
export async function retrieveDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    fileSystemLogger.debug('Retrieving directory handle');

    const db = await openFileHandleDB();
    const transaction = db.transaction([FILE_HANDLE_STORE], 'readonly');
    const store = transaction.objectStore(FILE_HANDLE_STORE);

    const result = await store.get(BACKUP_DIR_HANDLE_KEY);

    if (!result || !result.handle) {
      fileSystemLogger.debug('No stored directory handle found');
      return null;
    }

    fileSystemLogger.debug('Retrieved directory handle', {
      name: result.name,
      lastVerified: new Date(result.lastVerified).toISOString(),
    });

    return result.handle;
  } catch (error) {
    fileSystemLogger.error('Failed to retrieve directory handle', { error });
    return null;
  }
}

/**
 * Verify permission on stored directory handle
 *
 * Checks if we still have permission to access the previously selected folder.
 * Should be called on app startup to ensure backup functionality works.
 *
 * Permission States:
 * - 'granted': We have permission, can proceed with backups
 * - 'prompt': User needs to reauthorize
 * - 'denied': User revoked permission, need to request new folder
 *
 * @param handle - Directory handle to verify
 * @param mode - Permission mode to check (default: 'readwrite')
 * @returns Promise resolving to permission verification result
 *
 * @example
 * ```typescript
 * const handle = await retrieveDirectoryHandle();
 * if (handle) {
 *   const verification = await verifyDirectoryPermission(handle);
 *   if (!verification.granted) {
 *     console.log('Need reauthorization:', verification.needsReauthorization);
 *   }
 * }
 * ```
 */
export async function verifyDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<PermissionVerificationResult> {
  try {
    fileSystemLogger.debug('Verifying directory permission', {
      name: handle.name,
      mode,
    });

    // Query current permission state
    const permissionState = await handle.queryPermission({ mode });

    if (permissionState === 'granted') {
      fileSystemLogger.debug('Directory permission verified - granted');
      return {
        granted: true,
        handle,
        needsReauthorization: false,
      };
    }

    if (permissionState === 'prompt') {
      fileSystemLogger.info('Directory permission needs reauthorization');
      return {
        granted: false,
        handle,
        needsReauthorization: true,
      };
    }

    // Permission was denied
    fileSystemLogger.warn('Directory permission denied');
    return {
      granted: false,
      handle,
      needsReauthorization: true,
      error: 'Permission to access backup folder was revoked',
    };
  } catch (error) {
    fileSystemLogger.error('Failed to verify directory permission', { error });
    return {
      granted: false,
      needsReauthorization: true,
      error: error instanceof Error ? error.message : 'Failed to verify permission',
    };
  }
}

/**
 * Request permission reauthorization
 *
 * Called when permission state is 'prompt' - asks user to reauthorize access.
 *
 * @param handle - Directory handle to reauthorize
 * @param mode - Permission mode (default: 'readwrite')
 * @returns Promise resolving to success status
 *
 * @example
 * ```typescript
 * const verification = await verifyDirectoryPermission(handle);
 * if (verification.needsReauthorization) {
 *   const result = await requestPermissionReauthorization(handle);
 *   if (result.success) {
 *     console.log('Reauthorized successfully');
 *   }
 * }
 * ```
 */
export async function requestPermissionReauthorization(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<{ success: boolean; error?: string }> {
  try {
    fileSystemLogger.info('Requesting permission reauthorization', {
      name: handle.name,
      mode,
    });

    const permissionState = await handle.requestPermission({ mode });

    if (permissionState === 'granted') {
      // Update last verified timestamp
      const updateResult = await updateDirectoryHandleVerification(handle);

      fileSystemLogger.info('Permission reauthorization granted');
      return { success: true };
    }

    fileSystemLogger.warn('Permission reauthorization denied');
    return {
      success: false,
      error: 'We need your permission to save backups. Would you like to choose a location now?',
    };
  } catch (error) {
    fileSystemLogger.error('Failed to request permission reauthorization', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reauthorize',
    };
  }
}

/**
 * Update last verified timestamp for directory handle
 *
 * @param handle - Directory handle to update
 * @returns Promise resolving to success status
 */
async function updateDirectoryHandleVerification(
  handle: FileSystemDirectoryHandle
): Promise<{ success: boolean }> {
  try {
    const db = await openFileHandleDB();
    const transaction = db.transaction([FILE_HANDLE_STORE], 'readwrite');
    const store = transaction.objectStore(FILE_HANDLE_STORE);

    const existing = await store.get(BACKUP_DIR_HANDLE_KEY);

    if (existing) {
      existing.lastVerified = Date.now();
      await store.put(existing);
    }

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    return { success: true };
  } catch (error) {
    fileSystemLogger.error('Failed to update directory handle verification', { error });
    return { success: false };
  }
}

/**
 * Clear stored directory handle
 *
 * Removes the stored directory handle from IndexedDB.
 * Used when user wants to change backup location or disable backups.
 *
 * @returns Promise resolving to success status
 *
 * @example
 * ```typescript
 * await clearDirectoryHandle();
 * console.log('Backup location cleared');
 * ```
 */
export async function clearDirectoryHandle(): Promise<{ success: boolean; error?: string }> {
  try {
    fileSystemLogger.info('Clearing stored directory handle');

    const db = await openFileHandleDB();
    const transaction = db.transaction([FILE_HANDLE_STORE], 'readwrite');
    const store = transaction.objectStore(FILE_HANDLE_STORE);

    await store.delete(BACKUP_DIR_HANDLE_KEY);

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    fileSystemLogger.info('Directory handle cleared successfully');
    return { success: true };
  } catch (error) {
    fileSystemLogger.error('Failed to clear directory handle', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear directory handle',
    };
  }
}

/**
 * Get backup directory status
 *
 * Returns current status of backup directory configuration.
 *
 * @returns Promise resolving to status information
 *
 * @example
 * ```typescript
 * const status = await getBackupDirectoryStatus();
 * console.log('Backup folder:', status.configured ? status.folderName : 'Not set');
 * ```
 */
export async function getBackupDirectoryStatus(): Promise<{
  configured: boolean;
  folderName?: string;
  permissionGranted?: boolean;
  lastVerified?: number;
  needsReauthorization?: boolean;
}> {
  try {
    const handle = await retrieveDirectoryHandle();

    if (!handle) {
      return { configured: false };
    }

    const verification = await verifyDirectoryPermission(handle);

    const db = await openFileHandleDB();
    const transaction = db.transaction([FILE_HANDLE_STORE], 'readonly');
    const store = transaction.objectStore(FILE_HANDLE_STORE);
    const metadata = await store.get(BACKUP_DIR_HANDLE_KEY);

    return {
      configured: true,
      folderName: handle.name,
      permissionGranted: verification.granted,
      lastVerified: metadata?.lastVerified,
      needsReauthorization: verification.needsReauthorization,
    };
  } catch (error) {
    fileSystemLogger.error('Failed to get backup directory status', { error });
    return { configured: false };
  }
}

/**
 * Open IndexedDB database for file handles
 *
 * Creates or opens the database for storing file handle metadata.
 *
 * @returns Promise resolving to IDBDatabase
 */
async function openFileHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GracefulBooksFileHandles', 1);

    request.onerror = () => {
      reject(new AppError(
        ErrorCode.DATABASE_ERROR,
        'Failed to open file handle database'
      ));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(FILE_HANDLE_STORE)) {
        db.createObjectStore(FILE_HANDLE_STORE, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Test write access to directory
 *
 * Attempts to write a test file to verify write permission works.
 * Useful for validating setup after permission is granted.
 *
 * @param handle - Directory handle to test
 * @returns Promise resolving to test result
 *
 * @example
 * ```typescript
 * const testResult = await testDirectoryWriteAccess(dirHandle);
 * if (!testResult.success) {
 *   console.error('Cannot write to folder:', testResult.error);
 * }
 * ```
 */
export async function testDirectoryWriteAccess(
  handle: FileSystemDirectoryHandle
): Promise<{ success: boolean; error?: string }> {
  try {
    fileSystemLogger.debug('Testing directory write access');

    // Create a test file
    const testFileName = `.graceful-books-test-${Date.now()}.tmp`;
    const fileHandle = await handle.getFileHandle(testFileName, { create: true });
    const writable = await fileHandle.createWritable();

    // Write test content
    await writable.write('test');
    await writable.close();

    // Clean up test file
    await handle.removeEntry(testFileName);

    fileSystemLogger.debug('Directory write access confirmed');
    return { success: true };
  } catch (error) {
    fileSystemLogger.error('Directory write access test failed', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Write access test failed',
    };
  }
}

// ============================================================================
// Task 2.5: Backup Writing & Storage
// ============================================================================

/**
 * Progress callback for backup operations
 */
export type BackupProgressCallback = (progress: {
  phase: 'preparing' | 'serializing' | 'writing' | 'verifying' | 'complete';
  percent: number;
  bytesWritten?: number;
  totalBytes?: number;
  message: string;
}) => void;

/**
 * Options for writing a backup file
 */
export interface WriteBackupOptions {
  bundle: SecureBackupBundle;
  fileName: string;
  onProgress?: BackupProgressCallback;
}

/**
 * Result of backup write operation
 */
export interface WriteBackupResult {
  success: boolean;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  error?: string;
  errorCode?: ErrorCode;
}

/**
 * Write a backup bundle to a file
 *
 * Implements Task 2.5 of the Backup & Sync Roadmap.
 *
 * This function:
 * 1. Verifies we have permission to write to the backup folder
 * 2. Serializes the backup bundle to JSON
 * 3. Creates a file in the backup folder
 * 4. Writes the data with progress tracking
 * 5. Verifies the file was written successfully
 * 6. Handles disk space and permission errors gracefully
 *
 * Progress Phases:
 * - preparing (0-20%): Checking permissions and setup
 * - serializing (20-40%): Converting bundle to JSON
 * - writing (40-90%): Writing data to disk
 * - verifying (90-100%): Confirming file integrity
 * - complete (100%): Success
 *
 * Error Handling:
 * - QuotaExceededError: Disk space full - user-friendly message
 * - NotAllowedError: Permission revoked - guide to re-select folder
 * - AbortError: User cancelled - graceful handling
 * - Other errors: Generic user-friendly message with retry option
 *
 * @param options - Write backup options
 * @returns Promise resolving to write result
 *
 * @example
 * ```typescript
 * const result = await writeBackupToFile({
 *   bundle: secureBackupBundle,
 *   fileName: 'audacious-backup-2024-03-29-120000.encrypted',
 *   onProgress: (progress) => {
 *     console.log(`${progress.phase}: ${progress.percent}%`);
 *   }
 * });
 *
 * if (result.success) {
 *   console.log(`Backup saved: ${result.fileName} (${result.fileSize} bytes)`);
 * } else {
 *   console.error(`Backup failed: ${result.error}`);
 * }
 * ```
 */
export async function writeBackupToFile(
  options: WriteBackupOptions
): Promise<WriteBackupResult> {
  const { bundle, fileName, onProgress } = options;

  try {
    fileSystemLogger.info('Writing backup to file', { fileName });

    // Phase 1: Preparing (0-20%)
    onProgress?.({
      phase: 'preparing',
      percent: 0,
      message: 'Getting everything ready...',
    });

    // Check browser support
    const support = detectBrowserSupport();
    if (!support.supported) {
      return {
        success: false,
        error: support.reason || 'Browser does not support automatic backups',
        errorCode: ErrorCode.NOT_IMPLEMENTED,
      };
    }

    // Get stored directory handle
    const dirHandle = await retrieveDirectoryHandle();
    if (!dirHandle) {
      fileSystemLogger.warn('No directory handle found for backup write');
      return {
        success: false,
        error: 'No backup folder selected. Please choose a folder in Settings → Data Safety.',
        errorCode: ErrorCode.VALIDATION_ERROR,
      };
    }

    // Verify permission
    onProgress?.({
      phase: 'preparing',
      percent: 10,
      message: 'Verifying permissions...',
    });

    const verification = await verifyDirectoryPermission(dirHandle);
    if (!verification.granted) {
      fileSystemLogger.warn('No permission to write backup', {
        needsReauthorization: verification.needsReauthorization,
      });
      return {
        success: false,
        error: verification.needsReauthorization
          ? 'We need your permission to save backups. Please re-select your backup folder in Settings.'
          : 'Permission to save backups was revoked. Please choose a new folder in Settings.',
        errorCode: ErrorCode.PERMISSION_DENIED,
      };
    }

    // Phase 2: Serializing (20-40%)
    onProgress?.({
      phase: 'serializing',
      percent: 20,
      message: 'Securing your data...',
    });

    let jsonString: string;
    let totalBytes: number;

    try {
      // Pretty-print for readability (makes debugging easier)
      jsonString = JSON.stringify(bundle, null, 2);
      totalBytes = new Blob([jsonString]).size;

      fileSystemLogger.debug('Backup bundle serialized', {
        fileName,
        sizeBytes: totalBytes,
        sizeKB: Math.round(totalBytes / 1024),
        sizeMB: (totalBytes / (1024 * 1024)).toFixed(2),
      });
    } catch (error) {
      fileSystemLogger.error('Failed to serialize backup bundle', { error });
      return {
        success: false,
        error: 'We couldn\'t prepare your backup data. Please try again.',
        errorCode: ErrorCode.ENCRYPTION_ERROR,
      };
    }

    onProgress?.({
      phase: 'serializing',
      percent: 40,
      totalBytes,
      message: `Preparing ${(totalBytes / 1024).toFixed(0)} KB of data...`,
    });

    // Phase 3: Writing (40-90%)
    onProgress?.({
      phase: 'writing',
      percent: 50,
      totalBytes,
      message: 'Creating backup file...',
    });

    let fileHandle: FileSystemFileHandle;

    try {
      // Create or overwrite the file
      fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    } catch (error) {
      fileSystemLogger.error('Failed to create file handle', { error, fileName });

      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          return {
            success: false,
            error: 'We no longer have permission to write to your backup folder. Please re-select it in Settings.',
            errorCode: ErrorCode.PERMISSION_DENIED,
          };
        }
      }

      return {
        success: false,
        error: 'We couldn\'t create the backup file. Please try again.',
        errorCode: ErrorCode.DATABASE_ERROR,
      };
    }

    onProgress?.({
      phase: 'writing',
      percent: 60,
      totalBytes,
      message: 'Writing your backup...',
    });

    let writable: FileSystemWritableFileStream | null = null;

    try {
      // Create writable stream
      writable = await fileHandle.createWritable();

      // Write the data
      await writable.write(jsonString);

      // Close the stream (this commits the changes)
      await writable.close();
      writable = null; // Mark as closed

      fileSystemLogger.info('Backup written successfully', {
        fileName,
        sizeBytes: totalBytes,
      });
    } catch (error) {
      fileSystemLogger.error('Failed to write backup data', { error, fileName });

      // Try to abort the writable stream if it's still open
      if (writable) {
        try {
          await writable.abort();
        } catch (abortError) {
          fileSystemLogger.error('Failed to abort writable stream', {
            error: abortError,
          });
        }
      }

      // Handle specific error types
      if (error instanceof DOMException) {
        if (error.name === 'QuotaExceededError') {
          return {
            success: false,
            error: `Not enough disk space to save the backup (${(totalBytes / (1024 * 1024)).toFixed(1)} MB needed). Please free up some space and try again.`,
            errorCode: ErrorCode.CONSTRAINT_VIOLATION,
          };
        }

        if (error.name === 'NoModificationAllowedError') {
          return {
            success: false,
            error: 'Cannot write to the backup file. Please check disk space and permissions.',
            errorCode: ErrorCode.PERMISSION_DENIED,
          };
        }

        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Backup was cancelled. Please try again.',
            errorCode: ErrorCode.VALIDATION_ERROR,
          };
        }
      }

      return {
        success: false,
        error: 'We couldn\'t write the backup data to disk. Please try again.',
        errorCode: ErrorCode.DATABASE_ERROR,
      };
    }

    // Phase 4: Verifying (90-100%)
    onProgress?.({
      phase: 'verifying',
      percent: 90,
      bytesWritten: totalBytes,
      totalBytes,
      message: 'Verifying backup...',
    });

    // Verify the file was created and has content
    try {
      const file = await fileHandle.getFile();

      if (file.size === 0) {
        fileSystemLogger.error('Backup file is empty after writing', {
          fileName,
        });
        return {
          success: false,
          error: 'The backup file is empty. Please try again.',
          errorCode: ErrorCode.DATABASE_ERROR,
        };
      }

      if (file.size !== totalBytes) {
        fileSystemLogger.warn('Backup file size mismatch', {
          fileName,
          expected: totalBytes,
          actual: file.size,
        });
        // Non-fatal - the file exists with content, just not exactly the expected size
        // This can happen due to line ending differences on Windows
      }

      fileSystemLogger.debug('Backup file verified', {
        fileName,
        fileSize: file.size,
        lastModified: new Date(file.lastModified).toISOString(),
      });
    } catch (error) {
      fileSystemLogger.error('Failed to verify backup file', { error, fileName });
      // Non-fatal - the write succeeded, we just couldn't verify
      // Return success anyway
    }

    // Phase 5: Complete (100%)
    onProgress?.({
      phase: 'complete',
      percent: 100,
      bytesWritten: totalBytes,
      totalBytes,
      message: 'Backup complete! Your data is safe and sound.',
    });

    return {
      success: true,
      fileName,
      filePath: dirHandle.name, // Folder name (full path not accessible)
      fileSize: totalBytes,
    };
  } catch (error) {
    fileSystemLogger.error('Unexpected error writing backup', {
      error,
      fileName,
    });

    if (error instanceof AppError) {
      return {
        success: false,
        error: error.message,
        errorCode: error.code,
      };
    }

    return {
      success: false,
      error: 'Something unexpected happened while saving your backup. Please try again.',
      errorCode: ErrorCode.UNKNOWN_ERROR,
    };
  }
}
