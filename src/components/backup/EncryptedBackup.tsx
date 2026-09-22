/**
 * Encrypted Backup Component
 *
 * Provides UI for creating and restoring encrypted backups per S7-4.
 * Features user-friendly interface with clear instructions and
 * progress feedback.
 *
 * Requirements:
 * - S7-4: Encrypted Backups
 * - Steadiness communication style
 * - WCAG 2.1 AA compliance
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from '../modals/Modal';
import { Button } from '../core/Button';
import { Input } from '../forms/Input';
import { BackupService } from '../../services/backup/backupService';
import { retrieveDirectoryHandle, cleanOldBackups } from '../../services/backup/FileSystemBackup';
import { saveBackupToHistory } from '../../services/backup/BackupHistoryService';
import {
  computeMissingRecords,
  getTableDisplayName,
  downloadMissingRecordsCSV,
  type MissingRecordsWithData,
} from '../../services/backup/backupDiff';
import { db, type ComprehensiveStatistics } from '../../db';
import type {
  BackupResult,
  RestoreResult,
  BackupValidationResult,
  CompanyMismatchInfo,
  RestoreMode,
  DecryptResult,
} from '../../services/backup/backupService';
import type { DatabaseExport } from '../../db';
import {
  type BackupPreference,
  getKeyFingerprint,
  createPassphraseSentinel,
  verifyPassphraseSentinel,
  hasSentinelConfigured,
} from '../../db/schema/backupPreferences.schema';
import { logger } from '../../utils/logger';
import { nanoid } from 'nanoid';
import styles from './EncryptedBackup.module.css';

const backupLogger = logger.child('EncryptedBackupComponent');

interface EncryptedBackupProps {
  /** Whether component is visible */
  isOpen: boolean;
  /** Callback when component should close */
  onClose: () => void;
  /** Initial mode (backup or restore) */
  initialMode?: 'backup' | 'restore';
  /** Callback after successful backup */
  onBackupComplete?: () => void;
  /** Callback after successful restore */
  onRestoreComplete?: () => void;
  /** Hide mode toggle (when opening directly in a specific mode) */
  hideModeToggle?: boolean;
  /** Company ID for backup history tracking */
  companyId?: string;
}

/**
 * EncryptedBackup component
 *
 * Provides interface for backup and restore operations
 */
export function EncryptedBackup({
  isOpen,
  onClose,
  initialMode = 'backup',
  onBackupComplete,
  onRestoreComplete,
  hideModeToggle = false,
  companyId,
}: EncryptedBackupProps) {
  const [mode, setMode] = useState<'backup' | 'restore'>(initialMode);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [currentDbStats, setCurrentDbStats] = useState<ComprehensiveStatistics | null>(null);
  const [confirmDataLoss, setConfirmDataLoss] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ref to store decryption key for restore operations
  const effectiveDecryptionKeyRef = useRef<string>('');

  // Backup preference state (for sentinel verification)
  const [backupPreference, setBackupPreference] = useState<BackupPreference | null>(null);
  const [loadingPreferences, setLoadingPreferences] = useState(true);

  // UI state for passphrase fields
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showConfirmPassphrase, setShowConfirmPassphrase] = useState(false);
  const [showManualConfirmation, setShowManualConfirmation] = useState(false);
  const [passphraseError, setPassphraseError] = useState<string | null>(null);

  // Mismatch detection state
  const [mismatchInfo, setMismatchInfo] = useState<CompanyMismatchInfo | null>(null);
  const [showMismatchDialog, setShowMismatchDialog] = useState(false);
  const [showMismatchDetails, setShowMismatchDetails] = useState(false);
  const [restoreComplete, setRestoreComplete] = useState(false);
  const [restoredRecordCount, setRestoredRecordCount] = useState(0);

  // Preview state - decrypted data held in memory for restore reuse
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [previewComplete, setPreviewComplete] = useState(false);
  const decryptedDataRef = useRef<DatabaseExport | null>(null);
  const [missingRecords, setMissingRecords] = useState<MissingRecordsWithData | null>(null);

  // Check if we're in dev mode (for handling missing companyId)
  const isDev = typeof window !== 'undefined' &&
    window.location.hostname === 'localhost' &&
    import.meta.env.DEV;

  // Load backup preferences when modal opens
  const loadBackupPreferences = useCallback(async () => {
    try {
      setLoadingPreferences(true);
      await db.open();

      // Get the first backup preference (we only support one per user for now)
      const prefs = await db.backupPreferences.toArray();
      const firstPref = prefs[0];
      if (firstPref !== undefined) {
        setBackupPreference(firstPref);
      }
    } catch (err) {
      backupLogger.error('Failed to load backup preferences', { error: err });
    } finally {
      setLoadingPreferences(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && mode === 'backup') {
      loadBackupPreferences();
    }
  }, [isOpen, mode, loadBackupPreferences]);

  // Fetch comprehensive database statistics when in restore mode
  // IMPORTANT: Uses same companyId filtering as exportAllData() for accurate comparison
  useEffect(() => {
    if (mode === 'restore' && isOpen) {
      backupLogger.debug('Fetching comprehensive database statistics', { companyId: companyId || 'ALL' });
      // Ensure database is open before querying
      db.open()
        .then(() => db.getComprehensiveStatistics(companyId || null))
        .then((stats) => {
          backupLogger.info('Got comprehensive stats', {
            companyId: companyId || 'ALL',
            totalRecords: stats.totalRecords,
            tableCount: stats.tableCount,
            cpgCategories: stats.tableCounts?.cpgCategories,
            cpgVendors: stats.tableCounts?.cpgVendors,
          });
          setCurrentDbStats(stats);
        })
        .catch((err) => {
          backupLogger.error('Failed to get comprehensive statistics', { error: err });
          console.error('[EncryptedBackup] getComprehensiveStatistics failed:', err);
          setCurrentDbStats(null);
        });
    }
  }, [mode, isOpen, companyId]);

  // Check if backup has fewer records than current database
  // User must confirm ANY restore where backup has less data to prevent accidental data loss
  const hasFewerRecords = (): boolean => {
    if (!currentDbStats || !validationResult?.backup?.statistics) return false;
    const backupStats = validationResult.backup.statistics;

    // Use totalRecords from backup if available, otherwise sum known fields
    const backupTotal = backupStats.totalRecords ??
      (backupStats.accounts + backupStats.transactions +
       backupStats.contacts + backupStats.products +
       (backupStats.cpgCategories || 0) + (backupStats.cpgVendors || 0) +
       (backupStats.cpgFinishedProducts || 0));

    // Current total from comprehensive stats
    const currentTotal = currentDbStats.totalRecords;

    // Warn if backup has ANY fewer records than current database AND current has meaningful data
    return currentTotal > 0 && backupTotal < currentTotal;
  };

  /**
   * Reset component state
   */
  const resetState = () => {
    setPassphrase('');
    setConfirmPassphrase('');
    setError(null);
    setSuccess(null);
    setSelectedFile(null);
    setValidationResult(null);
    setIsProcessing(false);
    setConfirmDataLoss(false);
    setShowPassphrase(false);
    setShowConfirmPassphrase(false);
    setShowManualConfirmation(false);
    setPassphraseError(null);
    // Mismatch dialog state
    setMismatchInfo(null);
    setShowMismatchDialog(false);
    setShowMismatchDetails(false);
    setRestoreComplete(false);
    setRestoredRecordCount(0);
    // Preview state - clear decrypted data from memory
    setIsDecrypting(false);
    setPreviewComplete(false);
    decryptedDataRef.current = null;
    setMissingRecords(null);
    // Don't reset passphrase mode selection - keep it for UX consistency
  };

  /**
   * Save passphrase sentinel for verification (NOT the passphrase itself)
   * The sentinel allows us to verify the passphrase without storing it.
   */
  const savePassphraseSentinel = async (passphraseToSave: string): Promise<BackupPreference> => {
    const now = Date.now();

    // Create encrypted sentinel from passphrase
    const sentinel = await createPassphraseSentinel(passphraseToSave);

    const prefData = {
      passphrase_mode: 'manual' as const,
      sentinel_ciphertext: sentinel.ciphertext,
      sentinel_iv: sentinel.iv,
      sentinel_salt: sentinel.salt,
      auto_key: null, // Vestigial field, never written
      passphrase_configured_at: now,
      updated_at: now,
    };

    if (backupPreference) {
      const updated: BackupPreference = {
        ...backupPreference,
        ...prefData,
        passphrase_configured_at: backupPreference.passphrase_configured_at ?? now,
      };
      await db.backupPreferences.put(updated);
      setBackupPreference(updated);
      return updated;
    } else {
      const newPref: BackupPreference = {
        id: nanoid(),
        user_id: 'default',
        company_id: 'default',
        backup_directory_path: null,
        backup_directory_handle_key: null,
        ...prefData,
        auto_backup_enabled: true,
        backup_on_change: true,
        backup_on_idle: true,
        backup_on_close: true,
        daily_backup_enabled: true,
        last_backup_at: null,
        last_backup_size: null,
        backup_count: 0,
        last_backup_error: null,
        show_backup_notifications: true,
        backup_retention_days: 30,
        created_at: now,
      };
      await db.backupPreferences.add(newPref);
      setBackupPreference(newPref);
      return newPref;
    }
  };

  /**
   * Handle mode change
   */
  const handleModeChange = (newMode: 'backup' | 'restore') => {
    setMode(newMode);
    resetState();
  };

  /**
   * Handle close
   */
  const handleClose = (force = false) => {
    // Allow closing if not processing, or if forced (e.g., after error)
    if (!isProcessing || force) {
      setIsProcessing(false); // Ensure processing state is cleared
      resetState();
      onClose();
    }
  };

  /**
   * Handle preview - decrypt backup and compute diff
   */
  const handlePreviewBackup = async () => {
    if (!selectedFile || !passphrase) {
      setError('Please select a backup file and enter your passphrase.');
      return;
    }

    setIsDecrypting(true);
    setError(null);

    try {
      backupLogger.info('Starting backup preview/decryption');

      const result = await BackupService.decryptBackupOnly(selectedFile, passphrase);

      if (!result.success || !result.data) {
        setError(result.error || 'Failed to decrypt the backup. Please check your passphrase.');
        setIsDecrypting(false);
        return;
      }

      // Store decrypted data for reuse during restore
      decryptedDataRef.current = result.data;
      effectiveDecryptionKeyRef.current = passphrase;

      // Compute missing records diff (filter by companyId if set)
      const missing = await computeMissingRecords(result.data, companyId);
      setMissingRecords(missing);

      setPreviewComplete(true);
      setIsDecrypting(false);

      backupLogger.info('Preview complete', {
        totalBackupRecords: result.statistics?.totalRecords,
        totalMissing: missing.totalMissing,
      });
    } catch (err) {
      backupLogger.error('Preview failed', err);
      setError(err instanceof Error ? err.message : 'Failed to preview backup.');
      setIsDecrypting(false);
    }
  };

  /**
   * Create encrypted backup
   */
  const handleCreateBackup = async () => {
    try {
      setError(null);
      setSuccess(null);

      let encryptionKey: string;
      let updatedPref: BackupPreference | null = backupPreference;

      // Passphrase is ALWAYS required
      if (!passphrase || passphrase.trim().length === 0) {
        setPassphraseError('Please enter your passphrase to encrypt your backup.');
        passphraseInputRef.current?.focus();
        passphraseInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // Check if passphrase is already configured (sentinel exists)
      if (hasSentinelConfigured(backupPreference)) {
        // Verify passphrase against stored sentinel
        const isValid = await verifyPassphraseSentinel(
          passphrase,
          backupPreference!.sentinel_ciphertext!,
          backupPreference!.sentinel_iv!,
          backupPreference!.sentinel_salt!
        );
        if (!isValid) {
          setError('Incorrect passphrase. Please enter the same passphrase you used before.');
          return;
        }
        encryptionKey = passphrase;
        backupLogger.info('Passphrase verified against sentinel');
      } else {
        // First-time setup - validate passphrase requirements
        if (passphrase.length < 12) {
          setPassphraseError('For your security, please use a passphrase with at least 12 characters.');
          passphraseInputRef.current?.focus();
          passphraseInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        if (passphrase !== confirmPassphrase) {
          setPassphraseError('The passphrases you entered don\'t match. Please check and try again.');
          confirmInputRef.current?.focus();
          confirmInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        // Show confirmation step before first backup
        if (!showManualConfirmation) {
          setShowManualConfirmation(true);
          return;
        }

        // Create sentinel (NOT storing the passphrase itself)
        updatedPref = await savePassphraseSentinel(passphrase);
        encryptionKey = passphrase;
        backupLogger.info('Created sentinel for passphrase verification');
      }

      setIsProcessing(true);
      backupLogger.info('Creating encrypted backup', { companyId: companyId || 'ALL' });

      const result: BackupResult = await BackupService.createBackup(
        encryptionKey,
        true, // include audit logs
        companyId // filter to current company
      );

      if (!result.success || !result.blob || !result.filename) {
        setError(result.error || 'Something went wrong while creating your backup. Please try again.');
        setIsProcessing(false);
        return;
      }

      // Update last backup timestamp
      if (updatedPref) {
        await db.backupPreferences.update(updatedPref.id, {
          last_backup_at: Date.now(),
          last_backup_size: result.blob.size,
          backup_count: (updatedPref.backup_count || 0) + 1,
          last_backup_error: null,
          updated_at: Date.now(),
        });
      }

      // Try to write to configured folder first, fall back to download
      let savedToFolder = false;
      const dirHandle = await retrieveDirectoryHandle();

      if (dirHandle) {
        try {
          // Write backup file to configured folder
          const fileHandle = await dirHandle.getFileHandle(result.filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(result.blob);
          await writable.close();
          savedToFolder = true;
          backupLogger.info('Backup saved to configured folder', { filename: result.filename });
          console.log(`[Backup] Saved to folder: ${result.filename}`);
        } catch (folderError) {
          backupLogger.warn('Failed to write to folder, falling back to download', { error: folderError });
          console.warn('[Backup] Folder write failed, falling back to Downloads:', folderError);
        }
      }

      // Fall back to download if no folder or folder write failed
      if (!savedToFolder) {
        BackupService.downloadBackup(result.blob, result.filename);
        backupLogger.info('Backup downloaded to Downloads folder (no folder configured or write failed)');
      } else {
        // Clean old backups after successful save to folder
        const cleanupResult = await cleanOldBackups();
        if (cleanupResult.deletedCount > 0) {
          backupLogger.info('Rotated old backups', {
            deleted: cleanupResult.deletedCount,
            kept: cleanupResult.keptCount,
          });
        }
      }

      // Record backup in history
      await saveBackupToHistory({
        id: nanoid(),
        filename: result.filename,
        timestamp: new Date(),
        size: result.blob.size,
        status: 'success',
        companyId: companyId || updatedPref?.company_id || backupPreference?.company_id || 'default',
      });

      // Show success message
      const locationMessage = savedToFolder
        ? 'saved to your backup folder'
        : 'downloaded to your Downloads folder';

      setSuccess(
        `Your encrypted backup has been ${locationMessage}. ` +
        `Remember your passphrase - you'll need it to restore from this backup.`
      );
      setPassphrase('');
      setConfirmPassphrase('');
      setIsProcessing(false);

      backupLogger.info('Backup created and downloaded successfully');

      // Notify parent component of successful backup
      if (onBackupComplete) {
        // Delay callback slightly to allow success message to display
        setTimeout(() => {
          onBackupComplete();
        }, 1500);
      }
    } catch (err) {
      backupLogger.error('Failed to create backup', err);
      const errorMessage = err instanceof Error
        ? err.message
        : 'An unexpected error occurred. Please try again.';
      // Check for CSP/WASM-related errors
      const isCspError = errorMessage.includes('Content Security Policy') ||
        errorMessage.includes('WebAssembly') ||
        errorMessage.includes('wasm');
      setError(
        isCspError
          ? 'Backup encryption failed due to browser security settings. Please try again or contact support.'
          : errorMessage
      );
    } finally {
      // Always reset processing state to keep modal interactive
      setIsProcessing(false);
    }
  };

  /**
   * Handle file selection for restore (from input element)
   */
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await processSelectedFile(file);
  };

  /**
   * Process a selected file (shared by both input and File System Access API)
   */
  const processSelectedFile = async (file: File) => {
    setSelectedFile(file);
    setError(null);
    setSuccess(null);
    setValidationResult(null);

    backupLogger.debug('Validating selected backup file', { filename: file.name });

    // Validate the backup file
    const validation = await BackupService.validateBackup(file);
    setValidationResult(validation);

    if (!validation.valid) {
      setError(validation.error || 'This backup file is not valid.');
    }
  };

  /**
   * Open file picker starting in the backup folder (if configured)
   * Falls back to standard file input if File System Access API unavailable
   */
  const handleChooseFile = async () => {
    // Check if File System Access API is available
    if (!('showOpenFilePicker' in window)) {
      // Fall back to standard file input
      fileInputRef.current?.click();
      return;
    }

    try {
      // Try to get the saved backup directory handle
      const dirHandle = await retrieveDirectoryHandle();

      // Configure file picker options
      const pickerOptions: OpenFilePickerOptions = {
        types: [
          {
            description: 'Backup Files',
            accept: {
              'application/json': ['.json', '.gbbackup'],
            },
          },
        ],
        multiple: false,
      };

      // If we have a saved backup folder, start there
      if (dirHandle) {
        pickerOptions.startIn = dirHandle;
      }

      // Show the file picker
      const fileHandles = await window.showOpenFilePicker(pickerOptions);
      const fileHandle = fileHandles[0];
      if (!fileHandle) {
        throw new Error('No file selected');
      }
      const file = await fileHandle.getFile();

      await processSelectedFile(file);
    } catch (err) {
      // User cancelled or error occurred
      if ((err as Error).name === 'AbortError') {
        // User cancelled - not an error
        return;
      }
      backupLogger.warn('File System Access API failed, falling back to input', { err });
      // Fall back to standard file input
      fileInputRef.current?.click();
    }
  };

  /**
   * Get company name for display (prefer name over ID)
   */
  const getCompanyDisplayName = (id: string, name?: string): string => {
    if (name) return name;
    // Truncate long UUIDs for display
    if (id.length > 20) {
      return `${id.substring(0, 8)}...`;
    }
    return id;
  };

  /**
   * Perform the actual restore with the specified mode
   */
  const performRestore = async (restoreMode: RestoreMode) => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setShowMismatchDialog(false);
    backupLogger.info('Performing restore', { mode: restoreMode });

    try {
      const result = await BackupService.restoreBackupWithMismatchHandling(
        selectedFile,
        effectiveDecryptionKeyRef.current,
        companyId || null,
        undefined, // sessionCompanyName - we don't have it in this context
        restoreMode,
        true // clearExisting
      );

      if (!result.success) {
        setError(result.error || 'Something went wrong while restoring your backup.');
        setIsProcessing(false);
        return;
      }

      // Show persistent success state (no auto-reload)
      setRestoredRecordCount(result.recordsRestored || 0);
      setRestoreComplete(true);
      setPassphrase('');
      setIsProcessing(false);
      setMismatchInfo(null);

      backupLogger.info('Backup restored successfully', {
        recordsRestored: result.recordsRestored,
        mode: restoreMode,
      });
    } catch (err) {
      backupLogger.error('Failed to restore backup', err);
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.'
      );
      setIsProcessing(false);
    }
  };

  /**
   * Restore from encrypted backup - with mismatch detection
   */
  const handleRestoreBackup = async () => {
    try {
      setError(null);
      setSuccess(null);
      setRestoreComplete(false);

      if (!selectedFile) {
        setError('Please select a backup file to restore.');
        return;
      }

      // Passphrase is required for all restores
      if (!passphrase || passphrase.trim().length === 0) {
        setError('Please enter the passphrase you used to create this backup.');
        return;
      }

      backupLogger.info('Using provided passphrase for restore');

      // Store in ref for use by performRestore and subsequent calls
      effectiveDecryptionKeyRef.current = passphrase;

      if (!validationResult?.valid) {
        setError('Please select a valid backup file.');
        return;
      }

      // CRITICAL: Require preview OR explicit confirmation if backup has fewer records
      // If preview is complete, user has seen exactly which records would be lost
      if (hasFewerRecords() && !previewComplete && !confirmDataLoss) {
        setError('This backup contains fewer records than your current database. Please preview the backup to see which records would be lost.');
        return;
      }

      // Check for missing companyId
      if (!companyId) {
        if (isDev) {
          // Dev mode: warn but allow with explicit acknowledgment
          setError(
            'Warning: No session companyId available (dev mode). ' +
            'Restore will proceed, but mismatch detection is disabled. ' +
            'For proper testing, set sessionStorage with a valid companyId.'
          );
          // Still allow restore to proceed after warning
          await performRestore('as-is');
          return;
        } else {
          // Production: block
          setError(
            'You must be logged in to restore a backup. ' +
            'Please log in and try again.'
          );
          return;
        }
      }

      setIsProcessing(true);
      backupLogger.info('Checking for company mismatch before restore');

      // First, detect if there's a mismatch
      const detectResult = await BackupService.restoreBackupWithMismatchHandling(
        selectedFile,
        effectiveDecryptionKeyRef.current,
        companyId,
        undefined,
        'detect', // Just detect, don't import yet
        true
      );

      if (detectResult.success) {
        // No mismatch - proceed with normal restore
        await performRestore('as-is');
        return;
      }

      // Check if this is a mismatch situation vs. an actual error
      if (detectResult.mismatchInfo) {
        setMismatchInfo(detectResult.mismatchInfo);
        setShowMismatchDialog(true);
        setIsProcessing(false);
        return;
      }

      // Actual error (decryption failed, etc.)
      setError(detectResult.error || 'Something went wrong while restoring your backup.');
      setIsProcessing(false);
    } catch (err) {
      backupLogger.error('Failed to restore backup', err);
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.'
      );
      setIsProcessing(false);
    }
  };

  /**
   * Handle user's choice in mismatch dialog
   */
  const handleMismatchChoice = (choice: 'cancel' | 'claim' | 'as-is') => {
    if (choice === 'cancel') {
      setShowMismatchDialog(false);
      setMismatchInfo(null);
      return;
    }
    performRestore(choice);
  };

  /**
   * Handle navigation after successful restore
   */
  const handleNavigateAfterRestore = () => {
    // Let parent know restore is complete
    if (onRestoreComplete) {
      onRestoreComplete();
    }
  };

  /**
   * Render passphrase input fields
   */
  const passphraseInputRef = useRef<HTMLInputElement>(null);
  const confirmInputRef = useRef<HTMLInputElement>(null);

  const renderManualPassphraseInput = () => {
    const hasPassphraseError = passphraseError && passphrase !== confirmPassphrase;

    return (
      <div className={styles.formSection}>
        <div className={styles.inputWithToggle}>
          <Input
            ref={passphraseInputRef}
            type={showPassphrase ? 'text' : 'password'}
            label="Backup Passphrase"
            value={passphrase}
            onChange={(e) => {
              setPassphrase(e.target.value);
              setPassphraseError(null);
            }}
            placeholder="Enter a strong passphrase"
            disabled={isProcessing}
            helperText="Use at least 12 characters. You'll need this to restore your backup."
            required
            error={hasPassphraseError}
          />
          <button
            type="button"
            className={styles.toggleVisibility}
            onClick={() => setShowPassphrase(!showPassphrase)}
            aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
          >
            {showPassphrase ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className={styles.inputWithToggle}>
          <Input
            ref={confirmInputRef}
            type={showConfirmPassphrase ? 'text' : 'password'}
            label="Confirm Passphrase"
            value={confirmPassphrase}
            onChange={(e) => {
              setConfirmPassphrase(e.target.value);
              setPassphraseError(null);
            }}
            placeholder="Enter the same passphrase again"
            disabled={isProcessing}
            required
            error={hasPassphraseError}
          />
          <button
            type="button"
            className={styles.toggleVisibility}
            onClick={() => setShowConfirmPassphrase(!showConfirmPassphrase)}
            aria-label={showConfirmPassphrase ? 'Hide passphrase' : 'Show passphrase'}
          >
            {showConfirmPassphrase ? 'Hide' : 'Show'}
          </button>
        </div>

        {passphraseError && (
          <div className={styles.fieldError}>
            {passphraseError}
          </div>
        )}

        <div className={styles.warningBox}>
          <strong>Important:</strong> Write down your passphrase and keep it safe!
          This passphrase is the only way to restore your data on any device.
          We never receive or store your passphrase - if you lose it, your backups
          cannot be recovered.
        </div>
      </div>
    );
  };

  /**
   * Render backup mode content
   */
  const renderBackupMode = () => {
    if (loadingPreferences) {
      return (
        <div className={styles.content}>
          <div className={styles.loading}>Loading backup settings...</div>
        </div>
      );
    }

    // Check if passphrase is already configured (sentinel exists)
    const isConfigured = hasSentinelConfigured(backupPreference);

    return (
      <div className={styles.content}>
        {/* First-time setup: show passphrase input with confirmation */}
        {!isConfigured && (
          <>
            <div className={styles.infoSection}>
              <h3 className={styles.sectionTitle}>Create Your Backup Passphrase</h3>
              <p className={styles.infoText}>
                Your passphrase encrypts your backups. We never receive or store it.
                You can restore on any device by entering this passphrase.
              </p>
            </div>

            {renderManualPassphraseInput()}

            {/* Confirmation step before first backup */}
            {showManualConfirmation && (
              <div className={styles.confirmationBox}>
                <strong>Before we create your backup...</strong>
                <p>
                  Please confirm that you have written down your passphrase somewhere safe.
                  Without it, your backups cannot be restored.
                </p>
                <div className={styles.confirmationActions}>
                  <Button
                    variant="secondary"
                    onClick={() => setShowManualConfirmation(false)}
                    disabled={isProcessing}
                  >
                    Go Back
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleCreateBackup}
                    disabled={isProcessing}
                    loading={isProcessing}
                  >
                    Yes, I've Written It Down
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Already configured: show passphrase input for verification */}
        {isConfigured && (
          <div className={styles.configuredStatus}>
            <div className={styles.statusBox}>
              <strong>Passphrase configured.</strong> Enter it below to create your backup.
            </div>

            <div className={styles.formSection}>
              <Input
                type="password"
                label="Your Passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter your backup passphrase"
                disabled={isProcessing}
                helperText="This passphrase is needed to restore on any device. We cannot recover it."
                required
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  /**
   * Render mismatch dialog
   */
  const renderMismatchDialog = () => {
    if (!mismatchInfo) return null;

    const hasMultiple = mismatchInfo.hasMultipleCompanies;
    const primaryBackupCompany = mismatchInfo.backupCompanies[0];

    return (
      <div className={styles.mismatchDialog}>
        <div className={styles.mismatchHeader}>
          <h3>{hasMultiple
            ? 'Multiple Account IDs Found'
            : 'This backup belongs to a different account'
          }</h3>
        </div>

        <div className={styles.mismatchContent}>
          {hasMultiple ? (
            <>
              <p className={styles.mismatchWarning}>
                This backup contains records under more than one account ID.
                This can happen with older data or test data created before
                account tracking was consistent.
              </p>
              <div className={styles.mismatchAccounts}>
                <strong>Account IDs in backup:</strong>
                <ul>
                  {mismatchInfo.backupCompanies.map((company) => (
                    <li key={company.id}>
                      {getCompanyDisplayName(company.id, company.name)}
                      <span className={styles.recordCount}>
                        ({company.recordCount} records)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <>
              <div className={styles.mismatchComparison}>
                <div className={styles.mismatchAccount}>
                  <strong>Backup created for:</strong>
                  <span className={styles.accountName}>
                    {getCompanyDisplayName(primaryBackupCompany?.id || '', primaryBackupCompany?.name)}
                  </span>
                </div>
                <div className={styles.mismatchAccount}>
                  <strong>You are logged in as:</strong>
                  <span className={styles.accountName}>
                    {getCompanyDisplayName(companyId || '', mismatchInfo.sessionCompanyName)}
                  </span>
                </div>
              </div>
              <p className={styles.mismatchExplanation}>
                This can happen if your account was recreated with a new ID,
                or if you're restoring someone else's backup.
              </p>
            </>
          )}

          <button
            type="button"
            className={styles.showDetailsToggle}
            onClick={() => setShowMismatchDetails(!showMismatchDetails)}
          >
            {showMismatchDetails ? 'Hide technical details' : 'Show technical details'}
          </button>

          {showMismatchDetails && (
            <div className={styles.mismatchDetails}>
              <p><strong>Backup account ID:</strong> {primaryBackupCompany?.id || 'unknown'}</p>
              <p><strong>Session account ID:</strong> {companyId || 'none'}</p>
              {mismatchInfo.backupCompanies.length > 1 && (
                <p><strong>All IDs in backup:</strong> {mismatchInfo.backupCompanies.map(c => c.id).join(', ')}</p>
              )}
            </div>
          )}
        </div>

        <div className={styles.mismatchActions}>
          <Button
            variant="secondary"
            onClick={() => handleMismatchChoice('cancel')}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => handleMismatchChoice('claim')}
            disabled={isProcessing}
          >
            Restore and claim this data
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleMismatchChoice('as-is')}
            disabled={isProcessing}
          >
            Restore as-is
          </Button>
        </div>

        <div className={styles.mismatchExplainer}>
          <p><strong>Restore and claim:</strong> Updates all records to use your current account ID ({companyId ? getCompanyDisplayName(companyId) : 'your account'}). Use this to consolidate data under one account.</p>
          <p><strong>Restore as-is:</strong> Imports records with their original account IDs. Data with different IDs may not appear in your account views.</p>
        </div>
      </div>
    );
  };

  /**
   * Render restore complete state
   */
  const renderRestoreComplete = () => (
    <div className={styles.restoreComplete}>
      <div className={styles.successIcon}>
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </div>
      <h3>Restore Complete</h3>
      <p className={styles.restoreStats}>
        Successfully restored <strong>{restoredRecordCount}</strong> records.
      </p>
      <p className={styles.restoreInstructions}>
        Your data has been imported. Click below to close this dialog and see your restored data.
      </p>
      <div className={styles.restoreCompleteActions}>
        <Button
          variant="primary"
          onClick={handleNavigateAfterRestore}
        >
          Close and View Data
        </Button>
      </div>
    </div>
  );

  /**
   * Render restore mode content
   */
  const renderRestoreMode = () => {
    // Show restore complete state
    if (restoreComplete) {
      return renderRestoreComplete();
    }

    // Show mismatch dialog
    if (showMismatchDialog && mismatchInfo) {
      return renderMismatchDialog();
    }

    return (
      <div className={styles.content}>
        <div className={styles.infoBox}>
          <p className={styles.infoText}>
            Restore your data from an encrypted backup. You'll need the backup file
            and the passphrase you used when creating it.
          </p>
        </div>

      <div className={styles.warningBox}>
        <strong>Warning:</strong> Restoring will replace all your current data with
        the data from the backup. Make sure you have a recent backup of your current
        data before proceeding.
      </div>

      <div className={styles.formSection}>
        <div className={styles.fileInputContainer}>
          <label className={styles.label}>
            Backup File
            <input
              ref={fileInputRef}
              type="file"
              accept=".gbbackup,.json"
              onChange={handleFileSelect}
              disabled={isProcessing}
              className={styles.fileInput}
            />
          </label>
          <Button
            onClick={handleChooseFile}
            disabled={isProcessing}
            variant="secondary"
          >
            Choose Backup File
          </Button>
          {selectedFile && (
            <div className={styles.selectedFile}>
              Selected: {selectedFile.name}
              {validationResult?.valid && (
                <span className={styles.validBadge}>Valid backup</span>
              )}
            </div>
          )}
        </div>

        {validationResult?.valid && validationResult.backup && (
          <div className={styles.backupInfo}>
            <h4>Backup Information</h4>
            <p>Created: {new Date(validationResult.backup.createdAt).toLocaleString()}</p>

            {/* Comparison table: Backup vs Current Database */}
            <div className={styles.comparisonSection}>
              <h4>Data Comparison</h4>

              {/* Plain-language summary - differs based on preview state */}
              {(() => {
                const backupStats = validationResult.backup.statistics;
                const backupTotal = backupStats.totalRecords ?? 0;
                const dbTotal = currentDbStats?.totalRecords ?? 0;

                // Check if this is SecureBackupBundle (all stats are zeros)
                const isSecureBundle = backupStats.appVersion === 'SecureBackupBundle' ||
                  (backupTotal === 0 && !backupStats.tableCounts);

                if (currentDbStats === null) {
                  return <p className={styles.comparisonSummary}>Loading current database statistics...</p>;
                }

                // AFTER PREVIEW: Show detailed missing records
                if (previewComplete && missingRecords) {
                  if (missingRecords.totalMissing === 0) {
                    return (
                      <p className={styles.comparisonSummaryEqual}>
                        <strong>All your current records are in this backup.</strong>
                        {' '}Restoring is safe.
                      </p>
                    );
                  }

                  return (
                    <div className={styles.comparisonSummaryNegative}>
                      <p>
                        <strong>
                          {missingRecords.totalMissing} record{missingRecords.totalMissing !== 1 ? 's' : ''} on this device {missingRecords.totalMissing !== 1 ? 'are' : 'is'} not in this backup:
                        </strong>
                      </p>

                      {Object.entries(missingRecords.byTable).map(([tableName, { total, shown }]) => (
                        <div key={tableName} className={styles.missingRecordsTable}>
                          <p className={styles.missingTableHeader}>
                            {total} {getTableDisplayName(tableName)}:
                          </p>
                          <ul className={styles.missingRecordsList}>
                            {shown.map(record => (
                              <li key={record.id}>{record.displayText}</li>
                            ))}
                            {total > 5 && (
                              <li className={styles.moreRecords}>(and {total - 5} more)</li>
                            )}
                          </ul>
                        </div>
                      ))}

                      <div className={styles.actionGuidance}>
                        <p>
                          <strong>To keep these records:</strong> Cancel and create a new backup first.
                          Then restore this backup — your current records will be saved in that new backup file.
                        </p>
                      </div>

                      <div className={styles.csvExportSection}>
                        {(() => {
                          const totalShown = Object.values(missingRecords.byTable)
                            .reduce((sum, { shown }) => sum + shown.length, 0);
                          const totalAll = missingRecords.totalMissing;
                          const hasMore = totalAll > totalShown;

                          return (
                            <>
                              {hasMore && (
                                <p className={styles.csvCountNote}>
                                  Showing {totalShown} of {totalAll}. The CSV includes all {totalAll}.
                                </p>
                              )}
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => downloadMissingRecordsCSV(missingRecords.allRecords)}
                              >
                                Download list as CSV
                              </Button>
                              <p className={styles.csvNote}>
                                For manual re-entry if you proceed with restore. This is not an import file.
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  );
                }

                // BEFORE PREVIEW: SecureBackupBundle has no metadata
                if (isSecureBundle) {
                  return (
                    <div className={styles.comparisonSummary}>
                      <p>
                        This backup is encrypted. Enter your passphrase and click <strong>Preview</strong> to
                        see what it contains and compare with your current data.
                      </p>
                    </div>
                  );
                }

                // BEFORE PREVIEW: Legacy format has approximate counts
                const diff = backupTotal - dbTotal;

                if (diff > 0) {
                  return (
                    <div className={styles.comparisonSummaryPositive}>
                      <p>
                        <strong>This backup appears to have {diff} more record{diff !== 1 ? 's' : ''} than your current data.</strong>
                      </p>
                      <p className={styles.tableBreakdown}>
                        Click <strong>Preview</strong> after entering your passphrase to confirm.
                      </p>
                    </div>
                  );
                } else if (diff < 0) {
                  const missing = Math.abs(diff);
                  return (
                    <div className={styles.comparisonSummaryNegative}>
                      <p>
                        <strong>This backup is older than what's on your device.</strong>
                        {' '}Restoring will replace your current data, and {missing} record{missing !== 1 ? 's' : ''} you've added since won't be there.
                      </p>
                      <p className={styles.actionGuidance}>
                        <strong>Recommended:</strong> Cancel and create a new backup first — that saves your current records.
                        Then restore this backup if needed.
                      </p>
                      <p>
                        Or click <strong>Preview</strong> to see exactly which records would be lost.
                      </p>
                    </div>
                  );
                } else {
                  return (
                    <div className={styles.comparisonSummaryEqual}>
                      <p>
                        <strong>Record counts match.</strong>
                        {' '}Click <strong>Preview</strong> to confirm all records are the same.
                      </p>
                    </div>
                  );
                }
              })()}

              <table className={styles.comparisonTable}>
                <thead>
                  <tr>
                    <th>Data Type</th>
                    <th>In Backup</th>
                    <th>Current DB</th>
                    <th>Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Render all tables dynamically from backup's tableCounts or fallback to legacy stats */}
                  {(() => {
                    const backupStats = validationResult.backup.statistics;
                    const dbCounts = currentDbStats?.tableCounts ?? {};

                    // Build unified table list from both sources
                    const allTables = new Set<string>();

                    // Add from backup tableCounts (v3+)
                    if (backupStats.tableCounts) {
                      Object.keys(backupStats.tableCounts).forEach(t => allTables.add(t));
                    } else {
                      // Legacy backup - use hardcoded known fields
                      ['accounts', 'transactions', 'contacts', 'products', 'companies'].forEach(t => allTables.add(t));
                      if (backupStats.cpgCategories !== undefined) allTables.add('cpgCategories');
                      if (backupStats.cpgVendors !== undefined) allTables.add('cpgVendors');
                      if (backupStats.cpgFinishedProducts !== undefined) allTables.add('cpgFinishedProducts');
                      if (backupStats.cpgInvoices !== undefined) allTables.add('cpgInvoices');
                      if (backupStats.cpgRecipes !== undefined) allTables.add('cpgRecipes');
                    }

                    // Add from current database
                    Object.keys(dbCounts).forEach(t => allTables.add(t));

                    // Sort tables: core tables first, then alphabetically
                    const coreTables = ['accounts', 'transactions', 'contacts', 'products', 'companies'];
                    const sortedTables = Array.from(allTables).sort((a, b) => {
                      const aCore = coreTables.indexOf(a);
                      const bCore = coreTables.indexOf(b);
                      if (aCore !== -1 && bCore !== -1) return aCore - bCore;
                      if (aCore !== -1) return -1;
                      if (bCore !== -1) return 1;
                      return a.localeCompare(b);
                    });

                    // Helper to get backup count for a table
                    const getBackupCount = (table: string): number => {
                      if (backupStats.tableCounts?.[table] !== undefined) {
                        return backupStats.tableCounts[table];
                      }
                      // Legacy fallback
                      const legacyMap: Record<string, number | undefined> = {
                        accounts: backupStats.accounts,
                        transactions: backupStats.transactions,
                        contacts: backupStats.contacts,
                        products: backupStats.products,
                        companies: backupStats.companies,
                        cpgCategories: backupStats.cpgCategories,
                        cpgVendors: backupStats.cpgVendors,
                        cpgFinishedProducts: backupStats.cpgFinishedProducts,
                        cpgInvoices: backupStats.cpgInvoices,
                        cpgRecipes: backupStats.cpgRecipes,
                      };
                      return legacyMap[table] ?? 0;
                    };

                    // Format table name for display
                    const formatTableName = (name: string): string => {
                      // Convert camelCase/snake_case to Title Case
                      return name
                        .replace(/([a-z])([A-Z])/g, '$1 $2')
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, c => c.toUpperCase());
                    };

                    return sortedTables
                      .filter(table => {
                        // Only show tables that have data in either backup or current DB
                        const backupCount = getBackupCount(table);
                        const dbCount = dbCounts[table] ?? 0;
                        return backupCount > 0 || dbCount > 0;
                      })
                      .map(table => {
                        const backupCount = getBackupCount(table);
                        const dbCount = dbCounts[table] ?? 0;
                        const diff = backupCount - dbCount;
                        const hasMismatch = diff !== 0;

                        return (
                          <tr key={table} className={hasMismatch ? styles.mismatchRow : undefined}>
                            <td>{formatTableName(table)}</td>
                            <td>{backupCount}</td>
                            <td>{currentDbStats ? dbCount : '...'}</td>
                            <td className={diff > 0 ? styles.diffPositive : diff < 0 ? styles.diffNegative : ''}>
                              {diff > 0 ? `+${diff}` : diff < 0 ? diff : '-'}
                            </td>
                          </tr>
                        );
                      });
                  })()}
                  {/* Total records row - always show with both values */}
                  <tr className={styles.totalRow}>
                    <td><strong>Total Records</strong></td>
                    <td><strong>{validationResult.backup.statistics.totalRecords ?? '?'}</strong></td>
                    <td><strong>{currentDbStats?.totalRecords ?? '...'}</strong></td>
                    <td className={(() => {
                      const backupTotal = validationResult.backup.statistics.totalRecords ?? 0;
                      const dbTotal = currentDbStats?.totalRecords ?? 0;
                      const diff = backupTotal - dbTotal;
                      return diff > 0 ? styles.diffPositive : diff < 0 ? styles.diffNegative : '';
                    })()}>
                      <strong>
                        {(() => {
                          const backupTotal = validationResult.backup.statistics.totalRecords ?? 0;
                          const dbTotal = currentDbStats?.totalRecords ?? 0;
                          const diff = backupTotal - dbTotal;
                          return diff > 0 ? `+${diff}` : diff < 0 ? diff : '-';
                        })()}
                      </strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Fewer records warning - show when backup has fewer records but preview not done */}
            {hasFewerRecords() && !previewComplete && (
              <div className={styles.dataLossWarning}>
                <strong>This backup is older than your current data</strong>
                <p>
                  Restoring will replace your current records. Preview first to see exactly
                  which records would be lost, and download a list for manual re-entry if needed.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Passphrase input for restore */}
        <Input
          type="password"
          label="Backup Passphrase"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Enter your backup passphrase"
          disabled={isProcessing || isDecrypting || !selectedFile}
          helperText="Enter the passphrase you used when creating this backup."
          required
        />

        {/* Preview button - decrypt and show detailed comparison */}
        {selectedFile && validationResult?.valid && !previewComplete && (
          <div className={styles.previewSection}>
            <Button
              variant="primary"
              onClick={handlePreviewBackup}
              disabled={isProcessing || isDecrypting || !passphrase.trim()}
              loading={isDecrypting}
            >
              {isDecrypting ? 'Decrypting backup — this takes a few seconds...' : 'Preview this backup'}
            </Button>
            <p className={styles.previewHint}>
              {!passphrase.trim()
                ? 'Enter your passphrase above to preview.'
                : 'Preview decrypts the backup to show exactly what will be restored.'}
            </p>
          </div>
        )}

        {/* Preview complete indicator */}
        {previewComplete && (
          <div className={styles.previewComplete}>
            <span className={styles.previewCompleteIcon}>✓</span>
            <span>Preview complete — ready to restore</span>
          </div>
        )}
      </div>
    </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Encrypted Backup & Restore"
      size="lg"
      closeOnBackdropClick={!isProcessing}
      closeOnEscape={!isProcessing}
      footer={
        <div className={styles.footer}>
          {!hideModeToggle && (
            <div className={styles.modeToggle}>
              <Button
                variant={mode === 'backup' ? 'primary' : 'secondary'}
                onClick={() => handleModeChange('backup')}
                disabled={isProcessing}
              >
                Create Backup
              </Button>
              <Button
                variant={mode === 'restore' ? 'primary' : 'secondary'}
                onClick={() => handleModeChange('restore')}
                disabled={isProcessing}
              >
                Restore Backup
              </Button>
            </div>
          )}
          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={handleClose}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant={mode === 'restore' && !previewComplete ? 'secondary' : 'primary'}
              onClick={mode === 'backup' ? handleCreateBackup : handleRestoreBackup}
              disabled={
                isProcessing ||
                isDecrypting ||
                // Require preview when restore mode and backup has fewer records
                (mode === 'restore' && hasFewerRecords() && !previewComplete) ||
                // Also disable if restore mode but no passphrase or file
                (mode === 'restore' && (!passphrase.trim() || !selectedFile))
              }
              loading={isProcessing}
            >
              {isProcessing
                ? mode === 'backup'
                  ? 'Creating Backup...'
                  : 'Replacing data...'
                : mode === 'backup'
                ? 'Create Encrypted Backup'
                : previewComplete
                ? 'Replace my data with this backup'
                : 'Restore from Backup'}
            </Button>
          </div>
        </div>
      }
    >
      {error && (
        <div className={styles.errorMessage} role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className={styles.successMessage} role="status">
          {success}
        </div>
      )}

      {mode === 'backup' ? renderBackupMode() : renderRestoreMode()}
    </Modal>
  );
}
