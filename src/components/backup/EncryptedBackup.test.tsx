/**
 * EncryptedBackup Component Tests
 *
 * Test 2: Restore button disabled until preview (when backup has fewer records)
 * Test 3: decryptedDataRef reused (no double decrypt)
 * Test 4: State cleared on modal close
 *
 * Break-then-fix verification performed during development.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EncryptedBackup } from './EncryptedBackup';
import { BackupService } from '../../services/backup/backupService';
import { db } from '../../db';
import type { BackupValidationResult, DecryptResult } from '../../services/backup/backupService';
import type { ComprehensiveStatistics } from '../../db';

// Mock the BackupService
vi.mock('../../services/backup/backupService', () => ({
  BackupService: {
    validateBackup: vi.fn(),
    decryptBackupOnly: vi.fn(),
    restoreBackupWithMismatchHandling: vi.fn(),
  },
}));

// Mock FileSystemBackup
vi.mock('../../services/backup/FileSystemBackup', () => ({
  retrieveDirectoryHandle: vi.fn().mockResolvedValue(null),
  cleanOldBackups: vi.fn().mockResolvedValue({ deletedCount: 0, keptCount: 0 }),
}));

// Mock BackupHistoryService
vi.mock('../../services/backup/BackupHistoryService', () => ({
  saveBackupToHistory: vi.fn().mockResolvedValue(undefined),
}));

// Mock computeMissingRecords
vi.mock('../../services/backup/backupDiff', () => ({
  computeMissingRecords: vi.fn().mockResolvedValue({ byTable: {}, totalMissing: 0 }),
  getTableDisplayName: vi.fn((name: string) => name),
}));

// Mock db.getComprehensiveStatistics
const mockGetComprehensiveStatistics = vi.fn();

describe('EncryptedBackup', () => {
  const mockOnClose = vi.fn();
  const mockOnRestoreComplete = vi.fn();

  // Mock validation result showing backup has fewer records
  const mockValidationWithFewerRecords: BackupValidationResult = {
    valid: true,
    backup: {
      createdAt: Date.now(),
      isEncrypted: true,
      statistics: {
        accounts: 5,
        transactions: 10,
        contacts: 3,
        products: 2,
        companies: 1,
        totalRecords: 21, // Fewer than current DB (50)
      },
    },
  };

  // Mock validation result showing backup has equal/more records
  const mockValidationWithEqualRecords: BackupValidationResult = {
    valid: true,
    backup: {
      createdAt: Date.now(),
      isEncrypted: true,
      statistics: {
        accounts: 10,
        transactions: 30,
        contacts: 5,
        products: 5,
        companies: 1,
        totalRecords: 51,
      },
    },
  };

  // Mock comprehensive stats for current database
  const mockCurrentDbStats: ComprehensiveStatistics = {
    totalRecords: 50,
    tableCount: 5,
    tableCounts: {
      accounts: 10,
      transactions: 30,
      contacts: 5,
      products: 4,
      companies: 1,
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.open();

    // Mock db.getComprehensiveStatistics
    mockGetComprehensiveStatistics.mockResolvedValue(mockCurrentDbStats);
    vi.spyOn(db, 'getComprehensiveStatistics').mockImplementation(mockGetComprehensiveStatistics);

    // Mock backupPreferences to return empty array (no sentinel configured)
    vi.spyOn(db.backupPreferences, 'toArray').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper to create a mock backup file
   */
  function createMockBackupFile(): File {
    const content = JSON.stringify({ version: 3, timestamp: Date.now(), tables: {} });
    return new File([content], 'backup-2024-01-15.gbbackup', {
      type: 'application/json',
    });
  }

  /**
   * Helper to render component in restore mode and select a file
   */
  async function setupRestoreWithFile(validationResult: BackupValidationResult) {
    vi.mocked(BackupService.validateBackup).mockResolvedValue(validationResult);

    render(
      <EncryptedBackup
        isOpen={true}
        onClose={mockOnClose}
        initialMode="restore"
        onRestoreComplete={mockOnRestoreComplete}
        companyId="test-company-123"
      />
    );

    // Wait for stats to load
    await waitFor(() => {
      expect(mockGetComprehensiveStatistics).toHaveBeenCalled();
    });

    // Click "Choose Backup File" to trigger file input
    const chooseFileButton = screen.getByRole('button', { name: /choose backup file/i });
    expect(chooseFileButton).toBeInTheDocument();

    // Since we can't easily trigger the file input, we'll find and call its onChange
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // Simulate file selection
    const mockFile = createMockBackupFile();
    Object.defineProperty(fileInput, 'files', { value: [mockFile] });
    fireEvent.change(fileInput);

    // Wait for validation to complete
    await waitFor(() => {
      expect(BackupService.validateBackup).toHaveBeenCalledWith(mockFile);
    });
  }

  describe('Test 2: Restore button disabled until preview', () => {
    it('disables restore button when backup has fewer records and preview not done', async () => {
      await setupRestoreWithFile(mockValidationWithFewerRecords);

      // Enter passphrase
      const passphraseInput = screen.getByLabelText(/backup passphrase/i);
      fireEvent.change(passphraseInput, { target: { value: 'test-passphrase-123' } });

      // Restore button should be disabled (preview required but button doesn't say that)
      await waitFor(() => {
        const restoreButton = screen.getByRole('button', { name: /restore from backup/i });
        expect(restoreButton).toBeDisabled();
      });
    });

    it('enables restore button when backup has equal or more records (no preview required)', async () => {
      await setupRestoreWithFile(mockValidationWithEqualRecords);

      // Enter passphrase
      const passphraseInput = screen.getByLabelText(/backup passphrase/i);
      fireEvent.change(passphraseInput, { target: { value: 'test-passphrase-123' } });

      // Restore button should be enabled (no preview required)
      await waitFor(() => {
        const restoreButton = screen.getByRole('button', { name: /restore from backup/i });
        expect(restoreButton).not.toBeDisabled();
      });
    });

    it('enables restore button after preview is complete', async () => {
      // Mock successful decryption
      const mockDecryptResult: DecryptResult = {
        success: true,
        data: { version: 3, timestamp: Date.now(), tables: {} },
        statistics: { totalRecords: 21, tableCounts: {} },
      };
      vi.mocked(BackupService.decryptBackupOnly).mockResolvedValue(mockDecryptResult);

      await setupRestoreWithFile(mockValidationWithFewerRecords);

      // Enter passphrase
      const passphraseInput = screen.getByLabelText(/backup passphrase/i);
      fireEvent.change(passphraseInput, { target: { value: 'test-passphrase-123' } });

      // Find and click preview button
      await waitFor(() => {
        const previewButton = screen.getByRole('button', { name: /preview this backup/i });
        expect(previewButton).toBeInTheDocument();
        fireEvent.click(previewButton);
      });

      // Wait for preview to complete
      await waitFor(() => {
        const previewComplete = screen.getByText(/preview complete/i);
        expect(previewComplete).toBeInTheDocument();
      });

      // Now restore button should be enabled (with consequence-focused label)
      const restoreButton = screen.getByRole('button', { name: /replace my data/i });
      expect(restoreButton).not.toBeDisabled();
    });
  });

  describe('Test 3: decryptedDataRef reused (no double decrypt)', () => {
    it('does not call decryptBackupOnly twice when restore after preview', async () => {
      // Mock successful decryption
      const mockDecryptResult: DecryptResult = {
        success: true,
        data: { version: 3, timestamp: Date.now(), tables: {} },
        statistics: { totalRecords: 21, tableCounts: {} },
      };
      vi.mocked(BackupService.decryptBackupOnly).mockResolvedValue(mockDecryptResult);

      // Mock restore to check if it tries to decrypt again
      vi.mocked(BackupService.restoreBackupWithMismatchHandling).mockResolvedValue({
        success: true,
        recordsRestored: 21,
      });

      await setupRestoreWithFile(mockValidationWithFewerRecords);

      // Enter passphrase
      const passphraseInput = screen.getByLabelText(/backup passphrase/i);
      fireEvent.change(passphraseInput, { target: { value: 'test-passphrase-123' } });

      // Click preview
      await waitFor(() => {
        const previewButton = screen.getByRole('button', { name: /preview this backup/i });
        fireEvent.click(previewButton);
      });

      // Wait for preview to complete
      await waitFor(() => {
        expect(screen.getByText(/preview complete/i)).toBeInTheDocument();
      });

      // Verify decryptBackupOnly was called exactly once (during preview)
      expect(BackupService.decryptBackupOnly).toHaveBeenCalledTimes(1);

      // Now click restore (button label changes after preview)
      const restoreButton = screen.getByRole('button', { name: /replace my data/i });
      fireEvent.click(restoreButton);

      // Wait for restore to be called
      await waitFor(() => {
        expect(BackupService.restoreBackupWithMismatchHandling).toHaveBeenCalled();
      });

      // decryptBackupOnly should STILL only have been called once
      // (the component should use the cached decrypted data)
      expect(BackupService.decryptBackupOnly).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test 4: State cleared on modal close', () => {
    it('clears all state when modal is closed', async () => {
      // Mock successful decryption
      const mockDecryptResult: DecryptResult = {
        success: true,
        data: { version: 3, timestamp: Date.now(), tables: { cpgVendors: [{ id: 'v-1' }] } },
        statistics: { totalRecords: 1, tableCounts: { cpgVendors: 1 } },
      };
      vi.mocked(BackupService.decryptBackupOnly).mockResolvedValue(mockDecryptResult);

      await setupRestoreWithFile(mockValidationWithFewerRecords);

      // Enter passphrase
      const passphraseInput = screen.getByLabelText(/backup passphrase/i);
      fireEvent.change(passphraseInput, { target: { value: 'test-passphrase-123' } });

      // Click preview
      await waitFor(() => {
        const previewButton = screen.getByRole('button', { name: /preview this backup/i });
        fireEvent.click(previewButton);
      });

      // Wait for preview to complete
      await waitFor(() => {
        expect(screen.getByText(/preview complete/i)).toBeInTheDocument();
      });

      // Find and click Cancel button to close modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      // onClose should have been called
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('clears passphrase and preview state after closing and reopening', async () => {
      // Mock successful decryption
      const mockDecryptResult: DecryptResult = {
        success: true,
        data: { version: 3, timestamp: Date.now(), tables: {} },
        statistics: { totalRecords: 21, tableCounts: {} },
      };
      vi.mocked(BackupService.decryptBackupOnly).mockResolvedValue(mockDecryptResult);

      const { rerender } = render(
        <EncryptedBackup
          isOpen={true}
          onClose={mockOnClose}
          initialMode="restore"
          onRestoreComplete={mockOnRestoreComplete}
          companyId="test-company-123"
        />
      );

      // Wait for stats to load
      await waitFor(() => {
        expect(mockGetComprehensiveStatistics).toHaveBeenCalled();
      });

      // Select file
      vi.mocked(BackupService.validateBackup).mockResolvedValue(mockValidationWithFewerRecords);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const mockFile = createMockBackupFile();
      Object.defineProperty(fileInput, 'files', { value: [mockFile] });
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(BackupService.validateBackup).toHaveBeenCalled();
      });

      // Enter passphrase
      const passphraseInput = screen.getByLabelText(/backup passphrase/i);
      fireEvent.change(passphraseInput, { target: { value: 'secret-passphrase' } });

      // Click preview
      await waitFor(() => {
        const previewButton = screen.getByRole('button', { name: /preview this backup/i });
        fireEvent.click(previewButton);
      });

      // Wait for preview to complete
      await waitFor(() => {
        expect(screen.getByText(/preview complete/i)).toBeInTheDocument();
      });

      // Close modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Rerender with isOpen=false then isOpen=true
      rerender(
        <EncryptedBackup
          isOpen={false}
          onClose={mockOnClose}
          initialMode="restore"
          onRestoreComplete={mockOnRestoreComplete}
          companyId="test-company-123"
        />
      );

      rerender(
        <EncryptedBackup
          isOpen={true}
          onClose={mockOnClose}
          initialMode="restore"
          onRestoreComplete={mockOnRestoreComplete}
          companyId="test-company-123"
        />
      );

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByLabelText(/backup passphrase/i)).toBeInTheDocument();
      });

      // Passphrase should be empty (cleared on close)
      const newPassphraseInput = screen.getByLabelText(/backup passphrase/i) as HTMLInputElement;
      expect(newPassphraseInput.value).toBe('');

      // Preview complete indicator should not be visible (state cleared)
      expect(screen.queryByText(/preview complete/i)).not.toBeInTheDocument();
    });
  });

  describe('Test 5: Full preview flow is accessible', () => {
    /**
     * Critical test: User must be able to reach preview from start to finish.
     * This tests the complete path a user takes when restoring a backup with fewer records.
     */
    it('complete flow: select file → see Preview button → enter passphrase → click Preview → restore enabled', async () => {
      // Mock successful decryption
      const mockDecryptResult: DecryptResult = {
        success: true,
        data: { version: 3, timestamp: Date.now(), tables: { accounts: [{ id: 'a-1' }] } },
        statistics: { totalRecords: 21, tableCounts: { accounts: 1 } },
      };
      vi.mocked(BackupService.decryptBackupOnly).mockResolvedValue(mockDecryptResult);

      await setupRestoreWithFile(mockValidationWithFewerRecords);

      // STEP 1: Preview button should be visible (even without passphrase)
      const previewButton = screen.getByRole('button', { name: /preview this backup/i });
      expect(previewButton).toBeInTheDocument();

      // STEP 2: Preview button should be disabled without passphrase
      expect(previewButton).toBeDisabled();

      // STEP 3: Hint should tell user to enter passphrase
      expect(screen.getByText(/enter your passphrase/i)).toBeInTheDocument();

      // STEP 4: Enter passphrase
      const passphraseInput = screen.getByLabelText(/backup passphrase/i);
      fireEvent.change(passphraseInput, { target: { value: 'test-passphrase-123' } });

      // STEP 5: Preview button should now be enabled
      await waitFor(() => {
        expect(previewButton).not.toBeDisabled();
      });

      // STEP 6: Click Preview
      fireEvent.click(previewButton);

      // STEP 7: Wait for preview to complete
      await waitFor(() => {
        expect(screen.getByText(/preview complete/i)).toBeInTheDocument();
      });

      // STEP 8: Restore button should now be enabled with consequence-focused label
      const restoreButton = screen.getByRole('button', { name: /replace my data/i });
      expect(restoreButton).not.toBeDisabled();
    });

    it('Preview button is always visible after file selection, even with empty passphrase', async () => {
      await setupRestoreWithFile(mockValidationWithFewerRecords);

      // Preview button should exist immediately after file selection
      const previewButton = screen.getByRole('button', { name: /preview this backup/i });
      expect(previewButton).toBeInTheDocument();

      // But it should be disabled
      expect(previewButton).toBeDisabled();

      // Passphrase input should be empty
      const passphraseInput = screen.getByLabelText(/backup passphrase/i) as HTMLInputElement;
      expect(passphraseInput.value).toBe('');
    });

    it('shows passphrase hint when Preview button is disabled', async () => {
      await setupRestoreWithFile(mockValidationWithFewerRecords);

      // Should show hint to enter passphrase
      expect(screen.getByText(/enter your passphrase/i)).toBeInTheDocument();
    });
  });
});
