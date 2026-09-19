/**
 * BackupHistoryService Tests
 *
 * Tests for backup history filtering - ensures corrupted and invalid
 * entries don't appear in user-facing history.
 *
 * Real case: User's backup folder contained 98-byte .json files from
 * old SmartAutoBackupService bugs that wrote error objects as "backups".
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  saveBackupToHistory,
  loadBackupHistory,
  clearBackupHistory,
  type BackupHistoryEntry,
} from './BackupHistoryService';

describe('BackupHistoryService', () => {
  beforeEach(async () => {
    // Clear history before each test
    await clearBackupHistory();
  });

  afterEach(async () => {
    // Clean up after each test
    await clearBackupHistory();
  });

  describe('loadBackupHistory filtering', () => {
    it('filters out .json files (only .gbbackup allowed)', async () => {
      // Save entries with different extensions
      const validEntry: BackupHistoryEntry = {
        id: 'valid-1',
        filename: 'audacious-backup-2024-01-15.gbbackup',
        timestamp: new Date('2024-01-15'),
        size: 50000, // 50KB - valid size
        status: 'success',
      };

      const jsonEntry: BackupHistoryEntry = {
        id: 'invalid-json',
        filename: 'backup-2024-01-10.json', // Wrong extension
        timestamp: new Date('2024-01-10'),
        size: 50000, // Valid size, but wrong extension
        status: 'success',
      };

      await saveBackupToHistory(validEntry);
      await saveBackupToHistory(jsonEntry);

      const history = await loadBackupHistory();

      // Only .gbbackup file should appear
      expect(history).toHaveLength(1);
      expect(history[0].filename).toBe('audacious-backup-2024-01-15.gbbackup');
    });

    it('filters out files smaller than 1KB (corrupted error-JSON)', async () => {
      // Save entries with different sizes
      const validEntry: BackupHistoryEntry = {
        id: 'valid-large',
        filename: 'audacious-backup-2024-01-20.gbbackup',
        timestamp: new Date('2024-01-20'),
        size: 5000, // 5KB - valid
        status: 'success',
      };

      const tinyEntry: BackupHistoryEntry = {
        id: 'invalid-tiny',
        filename: 'audacious-backup-2024-01-18.gbbackup',
        timestamp: new Date('2024-01-18'),
        size: 98, // 98 bytes - the real corrupted file size
        status: 'success',
      };

      const borderlineEntry: BackupHistoryEntry = {
        id: 'invalid-borderline',
        filename: 'audacious-backup-2024-01-17.gbbackup',
        timestamp: new Date('2024-01-17'),
        size: 1023, // Just under 1KB threshold
        status: 'success',
      };

      const exactThresholdEntry: BackupHistoryEntry = {
        id: 'valid-threshold',
        filename: 'audacious-backup-2024-01-16.gbbackup',
        timestamp: new Date('2024-01-16'),
        size: 1024, // Exactly 1KB - should pass
        status: 'success',
      };

      await saveBackupToHistory(validEntry);
      await saveBackupToHistory(tinyEntry);
      await saveBackupToHistory(borderlineEntry);
      await saveBackupToHistory(exactThresholdEntry);

      const history = await loadBackupHistory();

      // Only files >= 1KB should appear
      expect(history).toHaveLength(2);
      const filenames = history.map(h => h.filename);
      expect(filenames).toContain('audacious-backup-2024-01-20.gbbackup');
      expect(filenames).toContain('audacious-backup-2024-01-16.gbbackup');
      expect(filenames).not.toContain('audacious-backup-2024-01-18.gbbackup');
      expect(filenames).not.toContain('audacious-backup-2024-01-17.gbbackup');
    });

    it('filters out entries failing BOTH checks (wrong extension AND too small)', async () => {
      const doubleInvalidEntry: BackupHistoryEntry = {
        id: 'double-invalid',
        filename: 'error-output.json', // Wrong extension
        timestamp: new Date('2024-01-05'),
        size: 98, // Too small
        status: 'success',
      };

      await saveBackupToHistory(doubleInvalidEntry);

      const history = await loadBackupHistory();

      expect(history).toHaveLength(0);
    });

    it('returns valid entries sorted by timestamp (newest first)', async () => {
      const entries: BackupHistoryEntry[] = [
        {
          id: 'oldest',
          filename: 'audacious-backup-2024-01-01.gbbackup',
          timestamp: new Date('2024-01-01'),
          size: 10000,
          status: 'success',
        },
        {
          id: 'newest',
          filename: 'audacious-backup-2024-01-30.gbbackup',
          timestamp: new Date('2024-01-30'),
          size: 10000,
          status: 'success',
        },
        {
          id: 'middle',
          filename: 'audacious-backup-2024-01-15.gbbackup',
          timestamp: new Date('2024-01-15'),
          size: 10000,
          status: 'success',
        },
      ];

      for (const entry of entries) {
        await saveBackupToHistory(entry);
      }

      const history = await loadBackupHistory();

      expect(history).toHaveLength(3);
      expect(history[0].id).toBe('newest');
      expect(history[1].id).toBe('middle');
      expect(history[2].id).toBe('oldest');
    });

    it('respects limit parameter after filtering', async () => {
      // Add 5 valid entries
      for (let i = 0; i < 5; i++) {
        await saveBackupToHistory({
          id: `valid-${i}`,
          filename: `audacious-backup-2024-01-${10 + i}.gbbackup`,
          timestamp: new Date(`2024-01-${10 + i}`),
          size: 10000,
          status: 'success',
        });
      }

      // Add 2 invalid entries (should be filtered, not count toward limit)
      await saveBackupToHistory({
        id: 'invalid-1',
        filename: 'bad.json',
        timestamp: new Date('2024-01-20'),
        size: 50000,
        status: 'success',
      });
      await saveBackupToHistory({
        id: 'invalid-2',
        filename: 'tiny.gbbackup',
        timestamp: new Date('2024-01-21'),
        size: 50,
        status: 'success',
      });

      // Request limit of 3
      const history = await loadBackupHistory(undefined, 3);

      // Should get exactly 3, all valid
      expect(history).toHaveLength(3);
      expect(history.every(h => h.filename.endsWith('.gbbackup'))).toBe(true);
      expect(history.every(h => h.size >= 1024)).toBe(true);
    });

    it('filters by companyId when provided', async () => {
      await saveBackupToHistory({
        id: 'company-a-1',
        filename: 'audacious-backup-a-1.gbbackup',
        timestamp: new Date('2024-01-15'),
        size: 10000,
        status: 'success',
        companyId: 'company-a',
      });
      await saveBackupToHistory({
        id: 'company-b-1',
        filename: 'audacious-backup-b-1.gbbackup',
        timestamp: new Date('2024-01-16'),
        size: 10000,
        status: 'success',
        companyId: 'company-b',
      });

      const historyA = await loadBackupHistory('company-a');
      const historyB = await loadBackupHistory('company-b');

      expect(historyA).toHaveLength(1);
      expect(historyA[0].companyId).toBe('company-a');
      expect(historyB).toHaveLength(1);
      expect(historyB[0].companyId).toBe('company-b');
    });
  });
});
