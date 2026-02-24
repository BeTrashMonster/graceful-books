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

import { useState, useRef } from 'react';
import { Modal } from '../modals/Modal';
import { Button } from '../core/Button';
import { Input } from '../forms/Input';
import { BackupService } from '../../services/backup/backupService';
import type {
  BackupResult,
  RestoreResult,
  BackupValidationResult,
} from '../../services/backup/backupService';
import { logger } from '../../utils/logger';
import styles from './EncryptedBackup.module.css';

const backupLogger = logger.child('EncryptedBackupComponent');

interface EncryptedBackupProps {
  /** Whether component is visible */
  isOpen: boolean;
  /** Callback when component should close */
  onClose: () => void;
  /** Initial mode (backup or restore) */
  initialMode?: 'backup' | 'restore';
  /** Callback after successful restore */
  onRestoreComplete?: () => void;
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
  onRestoreComplete,
}: EncryptedBackupProps) {
  const [mode, setMode] = useState<'backup' | 'restore'>(initialMode);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Validate passphrase
      if (!passphrase || passphrase.trim().length === 0) {
        setError('Please enter a passphrase to encrypt your backup.');
        return;
      }

      if (passphrase.length < 12) {
        setError('For your security, please use a passphrase with at least 12 characters.');
        return;
      }

      if (mode === 'backup' && passphrase !== confirmPassphrase) {
        setError('The passphrases you entered don\'t match. Please try again.');
        return;
      }

      setIsProcessing(true);
      backupLogger.info('Creating encrypted backup');

      const result: BackupResult = await BackupService.createBackup(
        passphrase,
        true // include audit logs
      );

      if (!result.success || !result.blob || !result.filename) {
        setError(result.error || 'Something went wrong while creating your backup. Please try again.');
        setIsProcessing(false);
        return;
      }

      // Trigger download
      BackupService.downloadBackup(result.blob, result.filename);

      setSuccess(
        `Your encrypted backup has been created and downloaded! Please store it in a safe place and remember your passphrase. You'll need both to restore your data.`
      );
      setPassphrase('');
      setConfirmPassphrase('');
      setIsProcessing(false);

      backupLogger.info('Backup created and downloaded successfully');
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
   * Handle file selection for restore
   */
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

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
   * Restore from encrypted backup
   */
  const handleRestoreBackup = async () => {
    try {
      setError(null);
      setSuccess(null);

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

      setIsProcessing(true);
      backupLogger.info('Restoring from encrypted backup');

      const result: RestoreResult = await BackupService.restoreBackup(
        selectedFile,
        passphrase,
        true // clear existing data
      );

      if (!result.success) {
        setError(result.error || 'Something went wrong while restoring your backup. Please check your passphrase and try again.');
        setIsProcessing(false);
        return;
      }

      setSuccess(
        `Your data has been restored successfully! ${result.recordsRestored} records were imported. Please refresh the page to see your restored data.`
      );
      setPassphrase('');
      setIsProcessing(false);

      backupLogger.info('Backup restored successfully', {
        recordsRestored: result.recordsRestored,
      });

      // Notify parent component
      if (onRestoreComplete) {
        setTimeout(() => {
          onRestoreComplete();
        }, 2000);
      }
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
   * Render backup mode content
   */
  const renderBackupMode = () => (
    <div className={styles.content}>
      <div className={styles.infoBox}>
        <p className={styles.infoText}>
          Create an encrypted backup of all your company data. Your backup will be
          protected with a passphrase that only you know. Store both the backup file
          and passphrase in a safe place.
        </p>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>What's included in your backup?</h3>
        <ul className={styles.list}>
          <li>All accounts and chart of accounts</li>
          <li>All transactions and journal entries</li>
          <li>Contacts (customers and vendors)</li>
          <li>Products and services</li>
          <li>Company settings and preferences</li>
          <li>CPG tool data and calculations</li>
        </ul>
      </div>

      <div className={styles.formSection}>
        <Input
          type="password"
          label="Backup Passphrase"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Enter a strong passphrase"
          disabled={isProcessing}
          helperText="Use at least 12 characters. You'll need this to restore your backup."
          required
        />

        <Input
          type="password"
          label="Confirm Passphrase"
          value={confirmPassphrase}
          onChange={(e) => setConfirmPassphrase(e.target.value)}
          placeholder="Enter the same passphrase again"
          disabled={isProcessing}
          required
        />
      </div>

      <div className={styles.warningBox}>
        <strong>Important:</strong> Write down your passphrase and keep it safe!
        Without it, you won't be able to restore your backup. We can't recover
        your passphrase if you lose it.
      </div>
    </div>
  );

  /**
   * Render restore mode content
   */
  const renderRestoreMode = () => (
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
            onClick={() => fileInputRef.current?.click()}
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
            <p>Contains:</p>
            <ul className={styles.compactList}>
              <li>{validationResult.backup.statistics.accounts} accounts</li>
              <li>{validationResult.backup.statistics.transactions} transactions</li>
              <li>{validationResult.backup.statistics.contacts} contacts</li>
              <li>{validationResult.backup.statistics.products} products</li>
            </ul>
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
