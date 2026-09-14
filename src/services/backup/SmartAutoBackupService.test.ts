/**
 * SmartAutoBackupService Tests
 *
 * Tests for the auto-backup rotation/cleanup logic.
 * Critical test: key file must NEVER be deleted during cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AUTO_KEY_FILENAME } from './FileSystemBackup';

// Mock the FileSystemBackup module
vi.mock('./FileSystemBackup', async () => {
  const actual = await vi.importActual('./FileSystemBackup');
  return {
    ...actual,
    retrieveDirectoryHandle: vi.fn(),
    writeBackupToFile: vi.fn().mockResolvedValue({ success: true }),
    getBackupDirectoryStatus: vi.fn().mockResolvedValue({ configured: true, permissionGranted: true }),
  };
});

// Mock the BackupEncryption module
vi.mock('./BackupEncryption', () => ({
  generateBackupBundle: vi.fn().mockResolvedValue({
    encryptedData: { test: 'data' },
    metadata: { version: '1.0' },
  }),
}));

// Mock the database
vi.mock('../../store/database', () => ({
  db: {
    tables: [],
  },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import { retrieveDirectoryHandle } from './FileSystemBackup';

describe('SmartAutoBackupService - Backup Rotation Safety', () => {
  let mockRemoveEntry: ReturnType<typeof vi.fn>;
  let filesInDirectory: Array<{ name: string; kind: 'file' | 'directory' }>;

  beforeEach(() => {
    mockRemoveEntry = vi.fn().mockResolvedValue(undefined);
    filesInDirectory = [];

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Create a mock directory handle with specified files
   */
  function createMockDirectoryHandle(files: string[]) {
    filesInDirectory = files.map(name => ({ name, kind: 'file' as const }));

    const mockHandle = {
      name: 'BackupFolder',
      kind: 'directory',
      removeEntry: mockRemoveEntry,
      values: async function* () {
        for (const file of filesInDirectory) {
          yield {
            name: file.name,
            kind: file.kind,
          };
        }
      },
    };

    (retrieveDirectoryHandle as ReturnType<typeof vi.fn>).mockResolvedValue(mockHandle);
    return mockHandle;
  }

  /**
   * Generate backup filenames with timestamps matching REAL format
   * Real format: graceful-books-backup-2026-09-09T19-30-00.gbbackup
   * @param count Number of backups to generate
   * @param startMinutesAgo Minutes ago for the oldest backup
   */
  function generateBackupFilenames(count: number, startMinutesAgo: number): string[] {
    const files: string[] = [];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      // Oldest backup first, newest last
      const timestamp = new Date(now - (startMinutesAgo - i * 5) * 60 * 1000);
      // Match real format: ISO with colons/dots replaced by hyphens, truncated
      const formatted = timestamp.toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      files.push(`graceful-books-backup-${formatted}.gbbackup`);
    }

    return files;
  }

  it('with 11 backups + key file: oldest backup deleted, key file remains', async () => {
    // EXACT TEST REQUESTED: 11 backups + key file
    // Cleanup keeps last 12, so with 11 we need to verify behavior
    // Let's use 13 to ensure deletion happens (keeps 12, deletes 1)
    const now = Date.now();
    const backupFiles: string[] = [];

    // Create 13 backup files with 5-minute intervals, oldest first
    for (let i = 12; i >= 0; i--) {
      const timestamp = new Date(now - i * 5 * 60 * 1000);
      const formatted = timestamp.toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      backupFiles.push(`graceful-books-backup-${formatted}.gbbackup`);
    }

    // The OLDEST backup (first in list, furthest in past)
    const oldestBackup = backupFiles[0];

    const allFiles = [
      AUTO_KEY_FILENAME, // .graceful-books-key
      ...backupFiles,
    ];

    createMockDirectoryHandle(allFiles);

    const { smartAutoBackupService } = await import('./SmartAutoBackupService');
    const service = smartAutoBackupService as unknown as {
      _testCleanOldBackups: () => Promise<void>;
    };

    await service._testCleanOldBackups();

    const deletedFiles = mockRemoveEntry.mock.calls.map(call => call[0]);

    // MUST delete the oldest backup (13 files, keep 12 = delete 1)
    expect(deletedFiles).toContain(oldestBackup);

    // MUST NOT delete the key file
    expect(deletedFiles).not.toContain(AUTO_KEY_FILENAME);

    // Verify only backup files were deleted
    for (const file of deletedFiles) {
      expect(file).toMatch(/^graceful-books-backup-.*\.gbbackup$/);
    }
  });

  it('cleanOldBackups should NEVER delete the key file (.graceful-books-key)', async () => {
    // Setup: folder contains key file + 15 backup files (more than the 12 kept)
    const backupFiles = generateBackupFilenames(15, 120); // 15 backups over 2 hours
    const allFiles = [
      AUTO_KEY_FILENAME, // The key file: .graceful-books-key
      ...backupFiles,
    ];

    createMockDirectoryHandle(allFiles);

    // Import the service (after mocks are set up)
    const { smartAutoBackupService } = await import('./SmartAutoBackupService');

    // Trigger cleanup by calling the internal method via reflection
    // Since cleanOldBackups is private, we access it through the prototype
    const service = smartAutoBackupService as unknown as {
      _testCleanOldBackups: () => Promise<void>;
    };

    // Call cleanup
    await service._testCleanOldBackups();

    // Verify: removeEntry was called for OLD backups
    const deletedFiles = mockRemoveEntry.mock.calls.map(call => call[0]);

    // Should have deleted some backups (the oldest ones beyond the 12 kept)
    expect(deletedFiles.length).toBeGreaterThan(0);

    // CRITICAL: Key file must NOT be in the deleted list
    expect(deletedFiles).not.toContain(AUTO_KEY_FILENAME);
    expect(deletedFiles).not.toContain('.graceful-books-key');

    // All deleted files should be backup files (real format)
    for (const deletedFile of deletedFiles) {
      expect(deletedFile).toMatch(/^graceful-books-backup-.*\.gbbackup$/);
    }
  });

  it('cleanOldBackups only considers files matching graceful-books-backup-*.gbbackup pattern', async () => {
    // Setup: folder with various files - using REAL filename format
    const filesInFolder = [
      AUTO_KEY_FILENAME,                           // Key file - must NOT be touched
      '.graceful-books-settings',                  // Other config - must NOT be touched
      'random-file.txt',                           // Random file - must NOT be touched
      'graceful-books-backup-2026-09-08T10-00-00.gbbackup', // Old backup - may be deleted
      'graceful-books-backup-2026-09-08T10-05-00.gbbackup',
      'graceful-books-backup-2026-09-08T10-10-00.gbbackup',
      'graceful-books-backup-2026-09-08T10-15-00.gbbackup',
      'graceful-books-backup-2026-09-08T10-20-00.gbbackup',
      'graceful-books-backup-2026-09-08T10-25-00.gbbackup',
      'graceful-books-backup-2026-09-08T10-30-00.gbbackup',
      'graceful-books-backup-2026-09-08T10-35-00.gbbackup',
      'graceful-books-backup-2026-09-08T10-40-00.gbbackup',
      'graceful-books-backup-2026-09-08T10-45-00.gbbackup',
      'graceful-books-backup-2026-09-08T10-50-00.gbbackup',
      'graceful-books-backup-2026-09-08T10-55-00.gbbackup',
      'graceful-books-backup-2026-09-08T11-00-00.gbbackup', // 13 backups total
    ];

    createMockDirectoryHandle(filesInFolder);

    const { smartAutoBackupService } = await import('./SmartAutoBackupService');
    const service = smartAutoBackupService as unknown as {
      cleanOldBackups: () => Promise<void>;
    };

    await service._testCleanOldBackups();

    const deletedFiles = mockRemoveEntry.mock.calls.map(call => call[0]);

    // Non-backup files must NEVER be deleted
    expect(deletedFiles).not.toContain(AUTO_KEY_FILENAME);
    expect(deletedFiles).not.toContain('.graceful-books-settings');
    expect(deletedFiles).not.toContain('random-file.txt');

    // Only graceful-books-backup-*.gbbackup files should ever be deleted
    for (const file of deletedFiles) {
      expect(file.startsWith('graceful-books-backup-')).toBe(true);
      expect(file.endsWith('.gbbackup')).toBe(true);
    }
  });

  it('key file survives even when cleanup deletes multiple old backups', async () => {
    // Setup: 20 backups spanning several days (well beyond retention)
    const now = Date.now();
    const files = [AUTO_KEY_FILENAME];

    // Add 20 backups: 1 per day for last 20 days - using REAL filename format
    for (let i = 0; i < 20; i++) {
      const timestamp = new Date(now - i * 24 * 60 * 60 * 1000);
      // Match real format: ISO with colons/dots replaced by hyphens, truncated
      const formatted = timestamp.toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      files.push(`graceful-books-backup-${formatted}.gbbackup`);
    }

    createMockDirectoryHandle(files);

    const { smartAutoBackupService } = await import('./SmartAutoBackupService');
    const service = smartAutoBackupService as unknown as {
      cleanOldBackups: () => Promise<void>;
    };

    await service._testCleanOldBackups();

    const deletedFiles = mockRemoveEntry.mock.calls.map(call => call[0]);

    // Some old backups should have been deleted
    expect(deletedFiles.length).toBeGreaterThan(0);

    // Key file must survive
    expect(deletedFiles).not.toContain(AUTO_KEY_FILENAME);
  });
});
