/**
 * Encrypted Backup Service Tests
 *
 * Tests for backup and restore functionality per S7-4.
 * Verifies encryption, decryption, validation, and error handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BackupService } from './backupService';
import type { EncryptedBackup } from './backupService';
import { db } from '../../db';

// Mock the database
vi.mock('../../db', () => ({
  db: {
    exportAllData: vi.fn(),
    importAllData: vi.fn(),
    getStatistics: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

describe('BackupService', () => {
  // Test passphrase
  const testPassphrase = 'test-passphrase-123456';

  // Mock database export
  const mockDbExport = {
    version: 1,
    exported_at: Date.now(),
    data: {
      accounts: [
        { id: '1', name: 'Cash', type: 'asset', companyId: 'company-1' },
        { id: '2', name: 'Revenue', type: 'income', companyId: 'company-1' },
      ],
      transactions: [
        { id: 't1', date: '2024-01-01', companyId: 'company-1' },
      ],
      transactionLineItems: [
        { id: 'li1', transactionId: 't1', accountId: '1', amount: 10000 },
      ],
      contacts: [
        { id: 'c1', name: 'Customer A', type: 'customer', companyId: 'company-1' },
      ],
      products: [
        { id: 'p1', name: 'Product A', companyId: 'company-1' },
      ],
      users: [
        { id: 'u1', email: 'test@example.com' },
      ],
      companies: [
        { id: 'company-1', name: 'Test Company' },
      ],
      companyUsers: [
        { id: 'cu1', companyId: 'company-1', userId: 'u1', role: 'admin' },
      ],
      auditLogs: [],
      sessions: [],
      devices: [],
    },
  };

  // Mock database statistics
  const mockStats = {
    accounts: 2,
    transactions: 1,
    contacts: 1,
    products: 1,
    companies: 1,
    auditLogs: 0,
    estimatedSizeBytes: 50000,
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.mocked(db.exportAllData).mockResolvedValue(mockDbExport);
    vi.mocked(db.getStatistics).mockResolvedValue(mockStats);
    vi.mocked(db.importAllData).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createBackup', () => {
    it('should create encrypted backup successfully', async () => {
      const result = await BackupService.createBackup(testPassphrase);

      expect(result.success).toBe(true);
      expect(result.blob).toBeDefined();
      expect(result.filename).toBeDefined();
      expect(result.filename).toMatch(/^graceful-books-backup-.*\.gbbackup$/);
      expect(result.backup).toBeDefined();

      // Verify backup structure
      const backup = result.backup!;
      expect(backup.version).toBe(1);
      expect(backup.createdAt).toBeGreaterThan(0);
      expect(backup.encryptedData).toBeDefined();
      expect(backup.keyDerivationParams).toBeDefined();
      expect(backup.keyDerivationParams.salt).toBeDefined();
      expect(backup.statistics).toBeDefined();
    });

    it('should fail with empty passphrase', async () => {
      const result = await BackupService.createBackup('');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('passphrase is required');
    });

    it('should fail with whitespace-only passphrase', async () => {
      const result = await BackupService.createBackup('   ');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should include database statistics in backup', async () => {
      const result = await BackupService.createBackup(testPassphrase);

      expect(result.success).toBe(true);
      expect(result.backup?.statistics).toEqual({
        accounts: 2,
        transactions: 1,
        contacts: 1,
        products: 1,
        companies: 1,
        totalTables: 11, // Based on mock data
      });
    });

    it('should create valid JSON blob', async () => {
      const result = await BackupService.createBackup(testPassphrase);

      expect(result.success).toBe(true);
      expect(result.blob).toBeDefined();

      // Read and parse blob
      const text = await result.blob!.text();
      const parsed = JSON.parse(text);

      expect(parsed.version).toBe(1);
      expect(parsed.encryptedData).toBeDefined();
    });

    it('should handle database export errors gracefully', async () => {
      vi.mocked(db.exportAllData).mockRejectedValue(
        new Error('Database export failed')
      );

      const result = await BackupService.createBackup(testPassphrase);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Database export failed');
    });
  });

  describe('validateBackup', () => {
    let mockBackupFile: File;

    beforeEach(async () => {
      // Create a valid backup for testing
      const backupResult = await BackupService.createBackup(testPassphrase);
      const backupText = await backupResult.blob!.text();
      mockBackupFile = new File([backupText], 'test-backup.gbbackup', {
        type: 'application/json',
      });
    });

    it('should validate correct backup file', async () => {
      const result = await BackupService.validateBackup(mockBackupFile);

      expect(result.valid).toBe(true);
      expect(result.backup).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should validate and test decryption with correct passphrase', async () => {
      const result = await BackupService.validateBackup(
        mockBackupFile,
        testPassphrase
      );

      expect(result.valid).toBe(true);
      expect(result.canDecrypt).toBe(true);
    });

    it('should detect incorrect passphrase', async () => {
      const result = await BackupService.validateBackup(
        mockBackupFile,
        'wrong-passphrase'
      );

      expect(result.valid).toBe(true);
      expect(result.canDecrypt).toBe(false);
    });

    it('should reject invalid JSON', async () => {
      const invalidFile = new File(['not json'], 'invalid.gbbackup', {
        type: 'application/json',
      });

      const result = await BackupService.validateBackup(invalidFile);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not a valid backup file');
    });

    it('should reject backup with missing fields', async () => {
      const incompleteBackup = {
        version: 1,
        // Missing createdAt and encryptedData
      };

      const file = new File([JSON.stringify(incompleteBackup)], 'incomplete.gbbackup', {
        type: 'application/json',
      });

      const result = await BackupService.validateBackup(file);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('missing required information');
    });

    it('should reject unsupported backup version', async () => {
      const futureBackup: EncryptedBackup = {
        version: 999,
        createdAt: Date.now(),
        encryptedData: 'encrypted',
        keyDerivationParams: {
          salt: 'salt',
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 4,
        },
        statistics: {
          accounts: 0,
          transactions: 0,
          contacts: 0,
          products: 0,
          companies: 0,
          totalTables: 0,
        },
        appVersion: '999.0.0',
      };

      const file = new File([JSON.stringify(futureBackup)], 'future.gbbackup', {
        type: 'application/json',
      });

      const result = await BackupService.validateBackup(file);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('different version');
    });
  });

  describe('restoreBackup', () => {
    let mockBackupFile: File;

    beforeEach(async () => {
      // Create a valid backup for testing
      const backupResult = await BackupService.createBackup(testPassphrase);
      const backupText = await backupResult.blob!.text();
      mockBackupFile = new File([backupText], 'test-backup.gbbackup', {
        type: 'application/json',
      });
    });

    it('should restore backup successfully', async () => {
      const result = await BackupService.restoreBackup(
        mockBackupFile,
        testPassphrase
      );

      expect(result.success).toBe(true);
      expect(result.recordsRestored).toBeGreaterThan(0);
      expect(result.details).toBeDefined();
      expect(result.details?.accounts).toBe(2);
      expect(result.details?.transactions).toBe(1);
    });

    it('should fail with empty passphrase', async () => {
      const result = await BackupService.restoreBackup(mockBackupFile, '');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('passphrase is required');
    });

    it('should fail with incorrect passphrase', async () => {
      const result = await BackupService.restoreBackup(
        mockBackupFile,
        'wrong-passphrase'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("doesn't match");
    });

    it('should call database import with correct data', async () => {
      await BackupService.restoreBackup(mockBackupFile, testPassphrase);

      expect(db.importAllData).toHaveBeenCalledTimes(1);
      const importedData = vi.mocked(db.importAllData).mock.calls[0][0];
      expect(importedData.data.accounts).toEqual(mockDbExport.data.accounts);
      expect(importedData.data.transactions).toEqual(mockDbExport.data.transactions);
    });

    it('should handle decryption errors gracefully', async () => {
      // Create a backup with corrupted encrypted data
      const backupResult = await BackupService.createBackup(testPassphrase);
      const backup = backupResult.backup!;
      backup.encryptedData = 'corrupted-data';

      const corruptedFile = new File(
        [JSON.stringify(backup)],
        'corrupted.gbbackup',
        { type: 'application/json' }
      );

      const result = await BackupService.restoreBackup(
        corruptedFile,
        testPassphrase
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle database import errors gracefully', async () => {
      vi.mocked(db.importAllData).mockRejectedValue(
        new Error('Import failed')
      );

      const result = await BackupService.restoreBackup(
        mockBackupFile,
        testPassphrase
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('downloadBackup', () => {
    it('should trigger download', () => {
      const blob = new Blob(['test content'], { type: 'application/json' });
      const filename = 'test-backup.gbbackup';

      // Mock document methods
      const createElementSpy = vi.spyOn(document, 'createElement');
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      // Mock HTMLAnchorElement click
      const mockAnchor = {
        click: vi.fn(),
        style: {},
      } as unknown as HTMLAnchorElement;

      createElementSpy.mockReturnValue(mockAnchor);

      BackupService.downloadBackup(blob, filename);

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(mockAnchor.click).toHaveBeenCalled();

      // Cleanup
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });
  });

  describe('encryption security', () => {
    it('should use different salt for each backup', async () => {
      const result1 = await BackupService.createBackup(testPassphrase);
      const result2 = await BackupService.createBackup(testPassphrase);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      const salt1 = result1.backup!.keyDerivationParams.salt;
      const salt2 = result2.backup!.keyDerivationParams.salt;

      expect(salt1).not.toBe(salt2);
    });

    it('should produce different encrypted data for same input', async () => {
      const result1 = await BackupService.createBackup(testPassphrase);
      const result2 = await BackupService.createBackup(testPassphrase);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      const encrypted1 = result1.backup!.encryptedData;
      const encrypted2 = result2.backup!.encryptedData;

      // Different salts and IVs should produce different ciphertext
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should not decrypt with different passphrase', async () => {
      const backupResult = await BackupService.createBackup(testPassphrase);
      const backupText = await backupResult.blob!.text();
      const backupFile = new File([backupText], 'test.gbbackup', {
        type: 'application/json',
      });

      const restoreResult = await BackupService.restoreBackup(
        backupFile,
        'different-passphrase'
      );

      expect(restoreResult.success).toBe(false);
    });
  });

  describe('data integrity', () => {
    it('should preserve all data through backup and restore cycle', async () => {
      // Create backup
      const backupResult = await BackupService.createBackup(testPassphrase);
      expect(backupResult.success).toBe(true);

      // Create file from backup
      const backupText = await backupResult.blob!.text();
      const backupFile = new File([backupText], 'test.gbbackup', {
        type: 'application/json',
      });

      // Restore backup
      const restoreResult = await BackupService.restoreBackup(
        backupFile,
        testPassphrase
      );

      expect(restoreResult.success).toBe(true);

      // Verify importAllData was called with correct data
      const importedData = vi.mocked(db.importAllData).mock.calls[0][0];
      expect(importedData.data.accounts).toEqual(mockDbExport.data.accounts);
      expect(importedData.data.transactions).toEqual(mockDbExport.data.transactions);
      expect(importedData.data.contacts).toEqual(mockDbExport.data.contacts);
      expect(importedData.data.products).toEqual(mockDbExport.data.products);
    });

    it('should maintain record count accuracy', async () => {
      const backupResult = await BackupService.createBackup(testPassphrase);
      const backupText = await backupResult.blob!.text();
      const backupFile = new File([backupText], 'test.gbbackup', {
        type: 'application/json',
      });

      const restoreResult = await BackupService.restoreBackup(
        backupFile,
        testPassphrase
      );

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.recordsRestored).toBe(11); // Based on mock data
      expect(restoreResult.details?.accounts).toBe(2);
      expect(restoreResult.details?.transactions).toBe(1);
      expect(restoreResult.details?.contacts).toBe(1);
    });
  });
});
