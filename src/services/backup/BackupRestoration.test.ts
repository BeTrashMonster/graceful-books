/**
 * Backup Restoration Service Tests
 *
 * Tests for Task 2.6 restoration functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  restoreFromLocalBackup,
  readBackupFile,
  validateBundleStructure,
  isDatabaseEmpty,
  autoDetectBackups,
  getRestorationErrorMessage,
  formatBackupInfo,
  formatFileSize,
  isRestorationSupported,
  RestorationStage,
} from './BackupRestoration';
import type {
  RestorationProgress,
  RestoreFromBackupOptions,
  BackupInfo,
} from './BackupRestoration';
import type { SecureBackupBundle } from './BackupEncryption';
import { ErrorCode } from '../../utils/errors';

// Mock dependencies
vi.mock('./BackupEncryption', () => ({
  restoreBackupBundle: vi.fn(),
  validateBackupBundleStructure: vi.fn(),
}));

vi.mock('./IntegrityVerification', () => ({
  verifyBackupIntegrity: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// Import mocked functions
import { restoreBackupBundle, validateBackupBundleStructure } from './BackupEncryption';
import { verifyBackupIntegrity } from './IntegrityVerification';

describe('BackupRestoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readBackupFile', () => {
    it('should read and parse valid backup file', async () => {
      const mockBundle: SecureBackupBundle = {
        version: '1.0',
        metadata: {
          companyId: 'company-123',
          userId: 'user-456',
          userRole: 'Admin',
          timestamp: Date.now(),
          keyRotationEpoch: 1,
        },
        encryptedData: {
          transactions: 'encrypted-transactions',
          accounts: 'encrypted-accounts',
          reports: 'encrypted-reports',
          preferences: 'encrypted-preferences',
        },
        encryptedKeys: {
          derivedKey: 'derived-key',
          keyId: 'key-123',
          salt: 'salt-base64',
          iterations: 3,
          memoryCost: 65536,
          parallelism: 4,
        },
        integrity: {
          hmac: 'hmac-base64',
          hmacSalt: 'hmac-salt-base64',
        },
      };

      const fileContent = JSON.stringify(mockBundle);
      const mockFile = {
        text: vi.fn().mockResolvedValue(fileContent),
        name: 'backup.encrypted',
        size: fileContent.length,
        type: 'application/json',
      } as unknown as File;

      const result = await readBackupFile(mockFile);

      expect(result).toEqual(mockBundle);
      expect(result.version).toBe('1.0');
      expect(result.metadata.companyId).toBe('company-123');
    });

    it('should throw error for empty file', async () => {
      const mockFile = {
        text: vi.fn().mockResolvedValue(''),
        name: 'backup.encrypted',
        size: 0,
        type: 'application/json',
      } as unknown as File;

      await expect(readBackupFile(mockFile)).rejects.toThrow(
        'empty'
      );
    });

    it('should throw error for invalid JSON', async () => {
      const mockFile = {
        text: vi.fn().mockResolvedValue('invalid json {{{'),
        name: 'backup.encrypted',
        size: 16,
        type: 'application/json',
      } as unknown as File;

      await expect(readBackupFile(mockFile)).rejects.toThrow();
    });
  });

  describe('validateBundleStructure', () => {
    it('should validate valid bundle structure', async () => {
      const mockBundle: SecureBackupBundle = {
        version: '1.0',
        metadata: {
          companyId: 'company-123',
          userId: 'user-456',
          userRole: 'Admin',
          timestamp: Date.now(),
          keyRotationEpoch: 1,
        },
        encryptedData: {
          transactions: 'encrypted-transactions',
          accounts: 'encrypted-accounts',
          reports: 'encrypted-reports',
          preferences: 'encrypted-preferences',
        },
        encryptedKeys: {
          derivedKey: 'derived-key',
          keyId: 'key-123',
          salt: 'salt-base64',
          iterations: 3,
          memoryCost: 65536,
          parallelism: 4,
        },
        integrity: {
          hmac: 'hmac-base64',
          hmacSalt: 'hmac-salt-base64',
        },
      };

      vi.mocked(validateBackupBundleStructure).mockReturnValue({
        valid: true,
      });

      await expect(validateBundleStructure(mockBundle)).resolves.not.toThrow();
      expect(validateBackupBundleStructure).toHaveBeenCalledWith(mockBundle);
    });

    it('should throw error for invalid bundle structure', async () => {
      const mockBundle = {
        version: '1.0',
        // Missing required fields
      } as unknown as SecureBackupBundle;

      vi.mocked(validateBackupBundleStructure).mockReturnValue({
        valid: false,
        error: 'Missing metadata',
      });

      await expect(validateBundleStructure(mockBundle)).rejects.toThrow(
        'right structure'
      );
    });
  });

  describe('restoreFromLocalBackup', () => {
    const mockBundle: SecureBackupBundle = {
      version: '1.0',
      metadata: {
        companyId: 'company-123',
        userId: 'user-456',
        userRole: 'Admin',
        timestamp: Date.now(),
        keyRotationEpoch: 1,
      },
      encryptedData: {
        transactions: 'encrypted-transactions',
        accounts: 'encrypted-accounts',
        reports: 'encrypted-reports',
        preferences: 'encrypted-preferences',
      },
      encryptedKeys: {
        derivedKey: 'derived-key',
        keyId: 'key-123',
        salt: 'salt-base64',
        iterations: 3,
        memoryCost: 65536,
        parallelism: 4,
      },
      integrity: {
        hmac: 'hmac-base64',
        hmacSalt: 'hmac-salt-base64',
      },
    };

    const mockRestoredData = {
      transactions: [{ id: 'txn-1' }],
      accounts: [{ id: 'acc-1' }],
      reports: [],
      preferences: { theme: 'light' },
    };

    beforeEach(() => {
      // Set up successful mocks
      vi.mocked(validateBackupBundleStructure).mockReturnValue({
        valid: true,
      });

      vi.mocked(verifyBackupIntegrity).mockResolvedValue({
        success: true,
        valid: true,
      });

      vi.mocked(restoreBackupBundle).mockResolvedValue({
        success: true,
        data: mockRestoredData,
        metadata: mockBundle.metadata,
      });
    });

    it('should successfully restore from bundle', async () => {
      const progressCallback = vi.fn();

      const options: RestoreFromBackupOptions = {
        bundle: mockBundle,
        password: 'test-password',
        onProgress: progressCallback,
      };

      const result = await restoreFromLocalBackup(options);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRestoredData);
      expect(result.metadata).toEqual(mockBundle.metadata);

      // Verify progress callbacks
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: RestorationStage.VALIDATING_STRUCTURE,
          percentage: 25,
        })
      );
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: RestorationStage.VERIFYING_INTEGRITY,
          percentage: 40,
        })
      );
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: RestorationStage.DECRYPTING_DATA,
          percentage: 60,
        })
      );
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: RestorationStage.COMPLETED,
          percentage: 100,
        })
      );
    });

    it('should successfully restore from file', async () => {
      const mockFile = {
        text: vi.fn().mockResolvedValue(JSON.stringify(mockBundle)),
        name: 'backup.encrypted',
        size: JSON.stringify(mockBundle).length,
        type: 'application/json',
      } as unknown as File;

      const progressCallback = vi.fn();

      const options: RestoreFromBackupOptions = {
        file: mockFile,
        password: 'test-password',
        onProgress: progressCallback,
      };

      const result = await restoreFromLocalBackup(options);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRestoredData);

      // Verify file reading stage
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: RestorationStage.READING_FILE,
          percentage: 10,
        })
      );
    });

    it('should fail when no file or bundle provided', async () => {
      const options: RestoreFromBackupOptions = {
        password: 'test-password',
      };

      const result = await restoreFromLocalBackup(options);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should fail when password is empty', async () => {
      const options: RestoreFromBackupOptions = {
        bundle: mockBundle,
        password: '',
      };

      const result = await restoreFromLocalBackup(options);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
      expect(result.error).toContain('password');
    });

    it('should fail when integrity verification fails', async () => {
      vi.mocked(verifyBackupIntegrity).mockResolvedValue({
        success: true,
        valid: false,
      });

      const options: RestoreFromBackupOptions = {
        bundle: mockBundle,
        password: 'test-password',
      };

      const result = await restoreFromLocalBackup(options);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ErrorCode.DECRYPTION_FAILED);
      expect(result.error).toContain('password');
    });

    it('should fail when decryption fails', async () => {
      vi.mocked(restoreBackupBundle).mockResolvedValue({
        success: false,
        error: 'Decryption failed',
        errorCode: ErrorCode.DECRYPTION_FAILED,
      });

      const options: RestoreFromBackupOptions = {
        bundle: mockBundle,
        password: 'wrong-password',
      };

      const result = await restoreFromLocalBackup(options);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ErrorCode.DECRYPTION_FAILED);
    });

    it('should call validation callback and cancel if rejected', async () => {
      const validateCallback = vi.fn().mockResolvedValue(false);

      const options: RestoreFromBackupOptions = {
        bundle: mockBundle,
        password: 'test-password',
        onValidate: validateCallback,
      };

      const result = await restoreFromLocalBackup(options);

      expect(validateCallback).toHaveBeenCalledWith(
        mockBundle.metadata,
        mockRestoredData
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });

    it('should proceed when validation callback approves', async () => {
      const validateCallback = vi.fn().mockResolvedValue(true);

      const options: RestoreFromBackupOptions = {
        bundle: mockBundle,
        password: 'test-password',
        onValidate: validateCallback,
      };

      const result = await restoreFromLocalBackup(options);

      expect(validateCallback).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRestoredData);
    });
  });

  describe('isDatabaseEmpty', () => {
    it('should return true when database is empty', async () => {
      const mockDb = {
        transactions: {
          count: vi.fn().mockResolvedValue(0),
        },
        accounts: {
          count: vi.fn().mockResolvedValue(0),
        },
      };

      const result = await isDatabaseEmpty(mockDb);

      expect(result.isEmpty).toBe(true);
      expect(result.transactionCount).toBe(0);
      expect(result.accountCount).toBe(0);
    });

    it('should return false when database has transactions', async () => {
      const mockDb = {
        transactions: {
          count: vi.fn().mockResolvedValue(5),
        },
        accounts: {
          count: vi.fn().mockResolvedValue(0),
        },
      };

      const result = await isDatabaseEmpty(mockDb);

      expect(result.isEmpty).toBe(false);
      expect(result.transactionCount).toBe(5);
    });

    it('should return false when database has accounts', async () => {
      const mockDb = {
        transactions: {
          count: vi.fn().mockResolvedValue(0),
        },
        accounts: {
          count: vi.fn().mockResolvedValue(3),
        },
      };

      const result = await isDatabaseEmpty(mockDb);

      expect(result.isEmpty).toBe(false);
      expect(result.accountCount).toBe(3);
    });

    it('should handle errors gracefully', async () => {
      const mockDb = {
        transactions: {
          count: vi.fn().mockRejectedValue(new Error('Database error')),
        },
        accounts: {
          count: vi.fn().mockResolvedValue(0),
        },
      };

      const result = await isDatabaseEmpty(mockDb);

      expect(result.isEmpty).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('autoDetectBackups', () => {
    it('should return empty when File System Access API not supported', async () => {
      // Mock window without showDirectoryPicker
      const originalShowDirectoryPicker = (window as any).showDirectoryPicker;
      delete (window as any).showDirectoryPicker;

      const result = await autoDetectBackups();

      expect(result.found).toBe(false);
      expect(result.backups).toEqual([]);

      // Restore
      if (originalShowDirectoryPicker) {
        (window as any).showDirectoryPicker = originalShowDirectoryPicker;
      }
    });

    it('should return empty when no folder handle provided', async () => {
      const result = await autoDetectBackups(undefined);

      expect(result.found).toBe(false);
      expect(result.backups).toEqual([]);
    });

    it('should detect backup files in folder (requires browser support)', async () => {
      // Mock showDirectoryPicker to indicate support
      if (!('showDirectoryPicker' in window)) {
        (window as any).showDirectoryPicker = vi.fn();
      }

      const mockFileHandle = {
        name: 'audacious-backup-2024-01-15-143000.encrypted',
        kind: 'file',
        getFile: vi.fn().mockResolvedValue({
          size: 1024000,
          lastModified: Date.now(),
        }),
      };

      const mockFolderHandle = {
        async *values() {
          yield mockFileHandle;
        },
      } as unknown as FileSystemDirectoryHandle;

      const result = await autoDetectBackups(mockFolderHandle);

      expect(result.found).toBe(true);
      expect(result.backups).toHaveLength(1);
      expect(result.backups![0].filename).toBe(mockFileHandle.name);
      expect(result.backups![0].size).toBe(1024000);
    });

    it('should filter out non-backup files (requires browser support)', async () => {
      // Mock showDirectoryPicker to indicate support
      if (!('showDirectoryPicker' in window)) {
        (window as any).showDirectoryPicker = vi.fn();
      }

      const mockBackupFile = {
        name: 'audacious-backup-2024-01-15-143000.encrypted',
        kind: 'file',
        getFile: vi.fn().mockResolvedValue({
          size: 1024000,
          lastModified: Date.now(),
        }),
      };

      const mockOtherFile = {
        name: 'other-file.txt',
        kind: 'file',
        getFile: vi.fn().mockResolvedValue({
          size: 100,
          lastModified: Date.now(),
        }),
      };

      const mockFolderHandle = {
        async *values() {
          yield mockBackupFile;
          yield mockOtherFile;
        },
      } as unknown as FileSystemDirectoryHandle;

      const result = await autoDetectBackups(mockFolderHandle);

      expect(result.found).toBe(true);
      expect(result.backups).toHaveLength(1);
      expect(result.backups![0].filename).toBe(mockBackupFile.name);
    });

    it('should sort backups by timestamp (newest first, requires browser support)', async () => {
      // Mock showDirectoryPicker to indicate support
      if (!('showDirectoryPicker' in window)) {
        (window as any).showDirectoryPicker = vi.fn();
      }

      const mockOldBackup = {
        name: 'audacious-backup-2024-01-10-120000.encrypted',
        kind: 'file',
        getFile: vi.fn().mockResolvedValue({
          size: 1024000,
          lastModified: new Date('2024-01-10T12:00:00').getTime(),
        }),
      };

      const mockNewBackup = {
        name: 'audacious-backup-2024-01-15-143000.encrypted',
        kind: 'file',
        getFile: vi.fn().mockResolvedValue({
          size: 1024000,
          lastModified: new Date('2024-01-15T14:30:00').getTime(),
        }),
      };

      const mockFolderHandle = {
        async *values() {
          yield mockOldBackup;
          yield mockNewBackup;
        },
      } as unknown as FileSystemDirectoryHandle;

      const result = await autoDetectBackups(mockFolderHandle);

      expect(result.found).toBe(true);
      expect(result.backups).toHaveLength(2);
      // Newest should be first
      expect(result.backups![0].filename).toBe(mockNewBackup.name);
      expect(result.backups![1].filename).toBe(mockOldBackup.name);
    });
  });

  describe('getRestorationErrorMessage', () => {
    it('should return message for known error codes', () => {
      const message = getRestorationErrorMessage(ErrorCode.DECRYPTION_FAILED);
      expect(message).toContain('password');
    });

    it('should return default message for unknown error codes', () => {
      const defaultMsg = 'Custom default message';
      const message = getRestorationErrorMessage(
        'UNKNOWN_CODE' as ErrorCode,
        defaultMsg
      );
      expect(message).toBe(defaultMsg);
    });

    it('should return fallback for unknown error codes without default', () => {
      const message = getRestorationErrorMessage('UNKNOWN_CODE' as ErrorCode);
      expect(message).toContain('failed');
    });
  });

  describe('formatBackupInfo', () => {
    it('should format backup info for display', () => {
      const backup: BackupInfo = {
        filename: 'audacious-backup-2024-01-15-143000.encrypted',
        timestamp: new Date('2024-01-15T14:30:00').getTime(),
        size: 2500000,
        lastModified: new Date('2024-01-15T14:30:00'),
      };

      const formatted = formatBackupInfo(backup);

      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2024');
      expect(formatted).toContain('2.4 MB'); // File size formatting rounds to 2.4 MB
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(2500000)).toBe('2.4 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });
  });

  describe('isRestorationSupported', () => {
    it('should return true when File System Access API is supported', () => {
      // Mock window with necessary APIs
      (window as any).showDirectoryPicker = vi.fn();
      (window as any).FileSystemFileHandle = class {};

      const supported = isRestorationSupported();
      expect(supported).toBe(true);
    });

    it('should return false when File System Access API is not supported', () => {
      // Remove APIs from window
      const originalShowDirectoryPicker = (window as any).showDirectoryPicker;
      const originalFileSystemFileHandle = (window as any).FileSystemFileHandle;

      delete (window as any).showDirectoryPicker;
      delete (window as any).FileSystemFileHandle;

      const supported = isRestorationSupported();
      expect(supported).toBe(false);

      // Restore
      if (originalShowDirectoryPicker) {
        (window as any).showDirectoryPicker = originalShowDirectoryPicker;
      }
      if (originalFileSystemFileHandle) {
        (window as any).FileSystemFileHandle = originalFileSystemFileHandle;
      }
    });
  });
});
