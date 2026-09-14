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
import {
  retrieveDirectoryHandle,
  writeAutoKeyToFolder,
  readAutoKeyFromFolder,
} from '../../services/backup/FileSystemBackup';
import { saveBackupToHistory } from '../../services/backup/BackupHistoryService';
import { db, type ComprehensiveStatistics } from '../../db';
import type {
  BackupResult,
  RestoreResult,
  BackupValidationResult,
  CompanyMismatchInfo,
  RestoreMode,
} from '../../services/backup/backupService';
import {
  type BackupPreference,
  type PassphraseMode,
  generateAutoBackupKey,
  getAutoBackupKey,
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

  // Passphrase mode state
  const [backupPreference, setBackupPreference] = useState<BackupPreference | null>(null);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [selectedPassphraseMode, setSelectedPassphraseMode] = useState<PassphraseMode>('none');
  const [showModeSelection, setShowModeSelection] = useState(false);

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
        setSelectedPassphraseMode(firstPref.passphrase_mode);
        // If passphrase is already configured, we can backup without prompt
        if (firstPref.passphrase_mode !== 'none') {
          setShowModeSelection(false);
        } else {
          setShowModeSelection(true);
        }
      } else {
        // No preferences yet - show mode selection
        setShowModeSelection(true);
        setSelectedPassphraseMode('none');
      }
    } catch (err) {
      backupLogger.error('Failed to load backup preferences', { error: err });
      // On error, default to showing manual passphrase entry
      setShowModeSelection(true);
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
  useEffect(() => {
    if (mode === 'restore' && isOpen) {
      backupLogger.debug('Fetching comprehensive database statistics');
      // Ensure database is open before querying
      db.open()
        .then(() => db.getComprehensiveStatistics())
        .then((stats) => {
          backupLogger.info('Got comprehensive stats', {
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
  }, [mode, isOpen]);

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
    // Don't reset passphrase mode selection - keep it for UX consistency
  };

  /**
   * Save auto-mode preference to database and write key to folder
   * IMPORTANT: Key is written to backup folder as AUTHORITATIVE copy
   */
  const saveAutoModePreference = async (autoKey: string): Promise<BackupPreference> => {
    const now = Date.now();
    const fingerprint = await getKeyFingerprint(autoKey);

    console.log(`[Backup] saveAutoModePreference called, fingerprint: ${fingerprint}`);

    // CRITICAL: Write key to backup folder FIRST
    // If this fails, we must abort - the folder copy is authoritative
    console.log('[Backup] Attempting to write key file to folder...');
    const writeResult = await writeAutoKeyToFolder(autoKey);
    console.log('[Backup] writeAutoKeyToFolder result:', writeResult);

    if (!writeResult.success) {
      console.error('[Backup] Key file write FAILED:', writeResult.error);
      throw new Error(
        writeResult.error ||
          'Failed to write encryption key to backup folder. Cannot proceed with automatic backup setup.'
      );
    }

    console.log('[Backup] Key file written successfully to folder');
    console.log(`[Backup] Storing auto-key in IndexedDB, fingerprint: ${fingerprint}`);

    const prefData = {
      passphrase_mode: 'auto' as PassphraseMode,
      sentinel_ciphertext: null,
      sentinel_iv: null,
      sentinel_salt: null,
      auto_key: autoKey, // Fallback copy in IndexedDB
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
   * Save manual-mode preference with sentinel (NOT the passphrase itself)
   */
  const saveManualModePreference = async (passphrase: string): Promise<BackupPreference> => {
    const now = Date.now();

    // Create encrypted sentinel from passphrase
    const sentinel = await createPassphraseSentinel(passphrase);

    const prefData = {
      passphrase_mode: 'manual' as PassphraseMode,
      sentinel_ciphertext: sentinel.ciphertext,
      sentinel_iv: sentinel.iv,
      sentinel_salt: sentinel.salt,
      auto_key: null,
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
  const handleClose = () => {
    if (!isProcessing) {
      resetState();
      onClose();
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

      // Determine the encryption key based on mode
      if (backupPreference?.passphrase_mode === 'auto') {
        // Auto mode - get key from folder (authoritative) or IndexedDB (fallback)
        let autoKey = await readAutoKeyFromFolder();
        let keySource = 'folder';
        if (!autoKey) {
          // Try IndexedDB fallback
          autoKey = getAutoBackupKey(backupPreference);
          keySource = 'IndexedDB';
        }
        if (!autoKey) {
          setError('Auto-key not found. The key file may have been deleted from your backup folder.');
          return;
        }
        const fingerprint = await getKeyFingerprint(autoKey);
        console.log(`[Backup] Using existing auto-key from ${keySource}, fingerprint: ${fingerprint}`);
        encryptionKey = autoKey;
        backupLogger.info('Using auto-key for backup', { fingerprint, source: keySource });
      } else if (backupPreference?.passphrase_mode === 'manual') {
        // Manual mode - ALWAYS require passphrase entry
        // We verify against the sentinel but never store the passphrase
        if (!passphrase || passphrase.trim().length === 0) {
          setError('Please enter your passphrase to create this backup.');
          return;
        }

        // Verify passphrase against stored sentinel
        if (hasSentinelConfigured(backupPreference)) {
          const isValid = await verifyPassphraseSentinel(
            passphrase,
            backupPreference.sentinel_ciphertext!,
            backupPreference.sentinel_iv!,
            backupPreference.sentinel_salt!
          );
          if (!isValid) {
            setError('Incorrect passphrase. Please enter the same passphrase you used when setting up manual backups.');
            return;
          }
        }

        encryptionKey = passphrase;
        backupLogger.info('Using verified passphrase for backup');
      } else if (selectedPassphraseMode === 'auto') {
        // First time with auto mode - generate key and write to folder
        const autoKey = generateAutoBackupKey();
        const fingerprint = await getKeyFingerprint(autoKey);
        console.log(`[Backup] Generated new auto-key, fingerprint: ${fingerprint}`);
        try {
          updatedPref = await saveAutoModePreference(autoKey);
          encryptionKey = autoKey;
          backupLogger.info('Generated and stored new auto-key for backup', { fingerprint });
        } catch (err) {
          // Folder write failed - this is CRITICAL, abort
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to save encryption key to backup folder. Cannot proceed with automatic backups.'
          );
          return;
        }
      } else {
        // Manual mode first-time setup - validate passphrase and create sentinel
        if (!passphrase || passphrase.trim().length === 0) {
          setPassphraseError('Please enter a passphrase to encrypt your backup.');
          passphraseInputRef.current?.focus();
          passphraseInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

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

        // Show confirmation step before first manual backup
        if (!showManualConfirmation) {
          setShowManualConfirmation(true);
          return;
        }

        // Create sentinel (NOT storing the passphrase itself)
        updatedPref = await saveManualModePreference(passphrase);
        encryptionKey = passphrase;
        backupLogger.info('Created sentinel for manual passphrase verification');
      }

      setIsProcessing(true);
      backupLogger.info('Creating encrypted backup');

      const result: BackupResult = await BackupService.createBackup(
        encryptionKey,
        true // include audit logs
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

      // Show appropriate success message based on mode and save location
      const effectiveMode = updatedPref?.passphrase_mode || selectedPassphraseMode;
      const locationMessage = savedToFolder
        ? 'saved to your backup folder'
        : 'downloaded to your Downloads folder';

      const modeMessage = effectiveMode === 'auto'
        ? `Your encrypted backup has been ${locationMessage}. Since you're using automatic encryption, the key file in your backup folder will decrypt it.`
        : `Your encrypted backup has been ${locationMessage}. Remember your passphrase - you'll need it to restore from this backup.`;

      setSuccess(modeMessage);
      setPassphrase('');
      setConfirmPassphrase('');
      setShowModeSelection(false);
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
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.'
      );
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
        passphrase,
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

      if (!passphrase || passphrase.trim().length === 0) {
        setError('Please enter the passphrase you used to create this backup.');
        return;
      }

      if (!validationResult?.valid) {
        setError('Please select a valid backup file.');
        return;
      }

      // CRITICAL: Require explicit confirmation if backup has fewer records than current database
      if (hasFewerRecords() && !confirmDataLoss) {
        setError('This backup contains fewer records than your current database. Please check the comparison below and confirm you want to proceed.');
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
        passphrase,
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
   * Render passphrase mode selection (first-time backup)
   */
  const renderModeSelection = () => (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>How should we encrypt your backups?</h3>
      <p className={styles.infoText}>
        These two options serve different purposes. Choose based on your recovery needs.
      </p>

      <div className={styles.modeOptions}>
        <label className={`${styles.modeOption} ${selectedPassphraseMode === 'auto' ? styles.modeOptionSelected : ''}`}>
          <input
            type="radio"
            name="passphraseMode"
            value="auto"
            checked={selectedPassphraseMode === 'auto'}
            onChange={() => setSelectedPassphraseMode('auto')}
            disabled={isProcessing}
          />
          <div className={styles.modeOptionContent}>
            <strong>Automatic Encryption</strong>
            <p>
              A random encryption key is generated and stored in your backup folder.
              No passphrase needed. Backups can be restored on this device, or anywhere
              your backup folder is accessible.
            </p>
            <ul className={styles.modeProsCons}>
              <li>No passphrase to remember</li>
              <li>Key file stays with your backups</li>
            </ul>
            <div className={styles.modeWarning}>
              If you lose both this device AND your backup folder, your backups
              cannot be decrypted.
            </div>
          </div>
        </label>

        <label className={`${styles.modeOption} ${selectedPassphraseMode === 'manual' ? styles.modeOptionSelected : ''}`}>
          <input
            type="radio"
            name="passphraseMode"
            value="manual"
            checked={selectedPassphraseMode === 'manual'}
            onChange={() => setSelectedPassphraseMode('manual')}
            disabled={isProcessing}
          />
          <div className={styles.modeOptionContent}>
            <strong>Manual Passphrase</strong>
            <p>
              You create a passphrase that encrypts all your backups. The passphrase
              is never sent to us. You can restore from ANY device by entering
              your passphrase.
            </p>
            <ul className={styles.modeProsCons}>
              <li>Works on any device, anywhere</li>
              <li>True disaster recovery</li>
            </ul>
            <div className={styles.modeWarning}>
              We never receive your passphrase and cannot recover it. If you forget
              it, your backups cannot be decrypted.
            </div>
          </div>
        </label>
      </div>
    </div>
  );

  /**
   * Render manual passphrase input fields
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
          Without it, you won't be able to restore your backup. We can't recover
          your passphrase if you lose it.
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

    // Check if passphrase is already configured
    const isConfigured = backupPreference?.passphrase_mode !== 'none' && backupPreference?.passphrase_mode !== undefined;
    const currentMode = backupPreference?.passphrase_mode;

    return (
      <div className={styles.content}>
        {/* Show mode selection for first-time backup */}
        {showModeSelection && !isConfigured && renderModeSelection()}

        {/* Show passphrase input only for manual mode when not yet configured */}
        {(showModeSelection && selectedPassphraseMode === 'manual' && !isConfigured) && renderManualPassphraseInput()}

        {/* Confirmation step for manual mode first-time setup */}
        {showManualConfirmation && !isConfigured && (
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

        {/* Show status when already configured */}
        {isConfigured && (
          <div className={styles.configuredStatus}>
            <div className={styles.statusBox}>
              <strong>Encryption: </strong>
              {currentMode === 'auto' ? 'Automatic (key stored with your backups)' : 'Manual passphrase'}
            </div>
            <p className={styles.statusNote}>
              {currentMode === 'auto'
                ? 'Click "Create Encrypted Backup" to download your backup. No passphrase needed.'
                : 'Enter your passphrase below, then click "Create Encrypted Backup" to download.'}
            </p>

            {/* Manual mode: ALWAYS require passphrase entry */}
            {currentMode === 'manual' && (
              <div className={styles.formSection}>
                <Input
                  type="password"
                  label="Your Passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter your backup passphrase"
                  disabled={isProcessing}
                  helperText="Enter the passphrase you created when setting up manual backups."
                  required
                />
              </div>
            )}
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
              <table className={styles.comparisonTable}>
                <thead>
                  <tr>
                    <th>Data Type</th>
                    <th>In Backup</th>
                    <th>Current DB</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Accounts</td>
                    <td>{validationResult.backup.statistics.accounts}</td>
                    <td>{currentDbStats?.tableCounts?.accounts ?? '...'}</td>
                  </tr>
                  <tr>
                    <td>Transactions</td>
                    <td>{validationResult.backup.statistics.transactions}</td>
                    <td>{currentDbStats?.tableCounts?.transactions ?? '...'}</td>
                  </tr>
                  <tr>
                    <td>Contacts</td>
                    <td>{validationResult.backup.statistics.contacts}</td>
                    <td>{currentDbStats?.tableCounts?.contacts ?? '...'}</td>
                  </tr>
                  <tr>
                    <td>Products</td>
                    <td>{validationResult.backup.statistics.products}</td>
                    <td>{currentDbStats?.tableCounts?.products ?? '...'}</td>
                  </tr>
                  {/* CPG-specific stats - now showing both sides */}
                  {(validationResult.backup.statistics.cpgCategories !== undefined ||
                    validationResult.backup.statistics.cpgVendors !== undefined ||
                    (currentDbStats?.tableCounts?.cpgCategories ?? 0) > 0 ||
                    (currentDbStats?.tableCounts?.cpgVendors ?? 0) > 0) && (
                    <>
                      <tr>
                        <td>CPG Categories</td>
                        <td>{validationResult.backup.statistics.cpgCategories ?? 0}</td>
                        <td>{currentDbStats?.tableCounts?.cpgCategories ?? '...'}</td>
                      </tr>
                      <tr>
                        <td>CPG Vendors</td>
                        <td>{validationResult.backup.statistics.cpgVendors ?? 0}</td>
                        <td>{currentDbStats?.tableCounts?.cpgVendors ?? '...'}</td>
                      </tr>
                      <tr>
                        <td>CPG Products</td>
                        <td>{validationResult.backup.statistics.cpgFinishedProducts ?? 0}</td>
                        <td>{currentDbStats?.tableCounts?.cpgFinishedProducts ?? '...'}</td>
                      </tr>
                    </>
                  )}
                  {/* Total records row - always show with both values */}
                  <tr className={styles.totalRow}>
                    <td><strong>Total Records</strong></td>
                    <td><strong>{validationResult.backup.statistics.totalRecords ?? '?'}</strong></td>
                    <td><strong>{currentDbStats?.totalRecords ?? '...'}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Warning if backup has fewer records than current database */}
            {hasFewerRecords() && (
              <div className={styles.dataLossWarning}>
                <strong>Warning: This backup contains fewer records than your current database!</strong>
                <p>
                  Restoring this backup will replace your current data. Please verify this is the
                  correct backup file before proceeding.
                </p>
                <label className={styles.confirmCheckbox}>
                  <input
                    type="checkbox"
                    checked={confirmDataLoss}
                    onChange={(e) => setConfirmDataLoss(e.target.checked)}
                    disabled={isProcessing}
                  />
                  <span>I understand that restoring will replace my current data with this backup</span>
                </label>
              </div>
            )}
          </div>
        )}

        <Input
          type="password"
          label="Backup Passphrase"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Enter your backup passphrase"
          disabled={isProcessing || !selectedFile}
          helperText="Enter the passphrase you used when creating this backup."
          required
        />
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
              variant="primary"
              onClick={mode === 'backup' ? handleCreateBackup : handleRestoreBackup}
              disabled={isProcessing}
              loading={isProcessing}
            >
              {isProcessing
                ? mode === 'backup'
                  ? 'Creating Backup...'
                  : 'Restoring...'
                : mode === 'backup'
                ? 'Create Encrypted Backup'
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
