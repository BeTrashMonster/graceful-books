/**
 * Backup File Naming & Versioning System
 *
 * Implements Task 2.4 of the Backup & Sync Architecture Roadmap (Phase 2).
 * Provides intelligent backup file management with rolling windows and daily snapshots.
 *
 * Features:
 * - Consistent filename format: audacious-backup-YYYY-MM-DD-HHmmss.encrypted
 * - Rolling window: Keep last 10 backups (most recent activity)
 * - Daily snapshots: Keep 1 backup per day (midnight) for 30 days
 * - Automatic cleanup: Removes old backups to prevent clutter
 * - File metadata tracking: Size, creation date, type
 * - Pure functions for testability
 *
 * Joy Opportunity: "Smart cleanup - we keep what matters, not clutter"
 *
 * Requirements:
 * - ROADMAP_BACKUP_AND_SYNC.md Phase 2, Task 2.4
 * - agent_review_checklist.md compliance
 * - Zero-knowledge architecture (no sensitive data in filenames)
 *
 * @module BackupVersioning
 */

import { logger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/errors';

const backupVersioningLogger = logger.child('BackupVersioning');

/**
 * Backup file type classification
 */
export enum BackupFileType {
  /** Rolling backup - part of the last 10 backups */
  ROLLING = 'rolling',
  /** Daily snapshot - midnight backup retained for 30 days */
  DAILY_SNAPSHOT = 'daily_snapshot',
  /** Legacy backup - older than retention policy but not yet deleted */
  LEGACY = 'legacy',
}

/**
 * Backup file metadata
 *
 * Tracks information about a backup file without revealing sensitive data.
 * All metadata is derived from filename and file system properties.
 */
export interface BackupFileMetadata {
  /** Full filename (e.g., "audacious-backup-2026-03-29-143045.encrypted") */
  filename: string;
  /** Unix timestamp when backup was created */
  timestamp: number;
  /** File size in bytes */
  size: number;
  /** Creation date as ISO string */
  createdAt: string;
  /** Type of backup (rolling, daily snapshot, or legacy) */
  type: BackupFileType;
  /** Whether this backup should be retained */
  shouldRetain: boolean;
  /** Whether this is a midnight backup (potential daily snapshot) */
  isMidnightBackup: boolean;
}

/**
 * Retention policy configuration
 *
 * Defines rules for keeping and removing backups.
 */
export interface RetentionPolicy {
  /** Number of most recent backups to keep (default: 10) */
  rollingWindowSize: number;
  /** Number of daily snapshots to retain (default: 30) */
  dailySnapshotDays: number;
  /** Hour threshold for midnight backups (0-23, default: 0 = midnight) */
  midnightHourThreshold: number;
  /** Minute range for midnight detection (default: ±30 minutes) */
  midnightMinuteRange: number;
}

/**
 * Result of backup cleanup operation
 */
export interface CleanupResult {
  /** Total backups analyzed */
  totalBackups: number;
  /** Number of backups to retain */
  retainedCount: number;
  /** Number of backups to delete */
  deletedCount: number;
  /** Filenames of backups to delete */
  filesToDelete: string[];
  /** Breakdown by type */
  breakdown: {
    rolling: number;
    dailySnapshots: number;
    legacy: number;
  };
  /** User-friendly message */
  message: string;
}

/**
 * Default retention policy per specification
 */
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  rollingWindowSize: 10,
  dailySnapshotDays: 30,
  midnightHourThreshold: 0,
  midnightMinuteRange: 30,
};

/**
 * Filename format constants
 */
export const BACKUP_FILENAME_PREFIX = 'audacious-backup-';
export const BACKUP_FILENAME_EXTENSION = '.encrypted';
export const BACKUP_FILENAME_REGEX = /^audacious-backup-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})\.encrypted$/;

/**
 * Generate a backup filename with the current timestamp
 *
 * Format: audacious-backup-YYYY-MM-DD-HHmmss.encrypted
 * Example: audacious-backup-2026-03-29-143045.encrypted
 *
 * @param date - Optional date to use (defaults to now)
 * @returns Formatted filename
 *
 * @example
 * ```typescript
 * const filename = generateBackupFilename();
 * // => "audacious-backup-2026-03-29-143045.encrypted"
 *
 * const customFilename = generateBackupFilename(new Date('2026-01-01T12:00:00Z'));
 * // => "audacious-backup-2026-01-01-120000.encrypted"
 * ```
 */
export function generateBackupFilename(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${BACKUP_FILENAME_PREFIX}${year}-${month}-${day}-${hours}${minutes}${seconds}${BACKUP_FILENAME_EXTENSION}`;
}

/**
 * Parse a backup filename to extract the timestamp
 *
 * @param filename - Backup filename to parse
 * @returns Parsed date or null if invalid format
 *
 * @example
 * ```typescript
 * const date = parseBackupFilename('audacious-backup-2026-03-29-143045.encrypted');
 * // => Date(2026-03-29T14:30:45)
 *
 * const invalid = parseBackupFilename('invalid-filename.txt');
 * // => null
 * ```
 */
export function parseBackupFilename(filename: string): Date | null {
  const match = filename.match(BACKUP_FILENAME_REGEX);
  if (!match) {
    return null;
  }

  const [, year, month, day, hours, minutes, seconds] = match;

  // Validate date components
  const yearNum = parseInt(year, 10);
  const monthNum = parseInt(month, 10);
  const dayNum = parseInt(day, 10);
  const hoursNum = parseInt(hours, 10);
  const minutesNum = parseInt(minutes, 10);
  const secondsNum = parseInt(seconds, 10);

  // Basic validation
  if (monthNum < 1 || monthNum > 12) return null;
  if (dayNum < 1 || dayNum > 31) return null;
  if (hoursNum < 0 || hoursNum > 23) return null;
  if (minutesNum < 0 || minutesNum > 59) return null;
  if (secondsNum < 0 || secondsNum > 59) return null;

  const date = new Date(
    yearNum,
    monthNum - 1, // JavaScript months are 0-indexed
    dayNum,
    hoursNum,
    minutesNum,
    secondsNum
  );

  // Check if date is valid (e.g., not Feb 30)
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * Validate a backup filename format
 *
 * @param filename - Filename to validate
 * @returns True if valid backup filename
 *
 * @example
 * ```typescript
 * isValidBackupFilename('audacious-backup-2026-03-29-143045.encrypted'); // => true
 * isValidBackupFilename('invalid-file.txt'); // => false
 * ```
 */
export function isValidBackupFilename(filename: string): boolean {
  return BACKUP_FILENAME_REGEX.test(filename);
}

/**
 * Check if a backup is a midnight backup (within threshold)
 *
 * A midnight backup is one created close to midnight (00:00:00).
 * This is used to identify daily snapshots.
 *
 * @param date - Date to check
 * @param minuteRange - Allowed minute range from midnight (default: 30)
 * @returns True if within midnight threshold
 *
 * @example
 * ```typescript
 * isMidnightBackup(new Date('2026-03-29T00:00:00')); // => true
 * isMidnightBackup(new Date('2026-03-29T00:15:00')); // => true
 * isMidnightBackup(new Date('2026-03-29T00:31:00')); // => false (outside default range)
 * isMidnightBackup(new Date('2026-03-29T12:00:00')); // => false
 * ```
 */
export function isMidnightBackup(
  date: Date,
  minuteRange: number = DEFAULT_RETENTION_POLICY.midnightMinuteRange
): boolean {
  const hours = date.getHours();
  const minutes = date.getMinutes();

  // Check if hour is 0 (midnight) and within minute range
  if (hours === 0 && minutes <= minuteRange) {
    return true;
  }

  // Check if hour is 23 (11 PM) and close to midnight
  if (hours === 23 && minutes >= (60 - minuteRange)) {
    return true;
  }

  return false;
}

/**
 * Get the date key for grouping daily snapshots
 *
 * Returns YYYY-MM-DD string for a given date.
 *
 * @param date - Date to get key for
 * @returns Date key string (e.g., "2026-03-29")
 *
 * @example
 * ```typescript
 * getDateKey(new Date('2026-03-29T14:30:45')); // => "2026-03-29"
 * getDateKey(new Date('2026-01-01T00:00:00')); // => "2026-01-01"
 * ```
 */
export function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Classify backup file type based on retention policy
 *
 * Pure function that determines whether a backup is rolling, daily snapshot, or legacy.
 *
 * @param metadata - Backup file metadata
 * @param allBackups - All backup files (sorted by timestamp descending)
 * @param policy - Retention policy
 * @returns Classified backup type
 */
export function classifyBackupType(
  metadata: BackupFileMetadata,
  allBackups: BackupFileMetadata[],
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY
): BackupFileType {
  // Sort backups by timestamp descending (newest first)
  const sortedBackups = [...allBackups].sort((a, b) => b.timestamp - a.timestamp);

  // Check if in rolling window (last N backups)
  const rollingBackups = sortedBackups.slice(0, policy.rollingWindowSize);
  const isInRolling = rollingBackups.some((b) => b.filename === metadata.filename);

  if (isInRolling) {
    return BackupFileType.ROLLING;
  }

  // Check if eligible for daily snapshot
  if (metadata.isMidnightBackup) {
    const backupDate = new Date(metadata.timestamp);
    const daysSinceBackup = Math.floor(
      (Date.now() - backupDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceBackup <= policy.dailySnapshotDays) {
      return BackupFileType.DAILY_SNAPSHOT;
    }
  }

  // Otherwise, it's legacy
  return BackupFileType.LEGACY;
}

/**
 * Create backup file metadata from filename and file info
 *
 * @param filename - Backup filename
 * @param size - File size in bytes
 * @param policy - Retention policy for classification
 * @returns Backup file metadata or null if invalid filename
 *
 * @example
 * ```typescript
 * const metadata = createBackupMetadata(
 *   'audacious-backup-2026-03-29-143045.encrypted',
 *   1024000
 * );
 * // => { filename, timestamp, size, createdAt, type, shouldRetain, isMidnightBackup }
 * ```
 */
export function createBackupMetadata(
  filename: string,
  size: number,
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY
): BackupFileMetadata | null {
  const date = parseBackupFilename(filename);
  if (!date) {
    return null;
  }

  const timestamp = date.getTime();
  const createdAt = date.toISOString();
  const isMidnight = isMidnightBackup(date, policy.midnightMinuteRange);

  // Initial metadata without type classification
  return {
    filename,
    timestamp,
    size,
    createdAt,
    type: BackupFileType.LEGACY, // Will be reclassified
    shouldRetain: false, // Will be determined during cleanup analysis
    isMidnightBackup: isMidnight,
  };
}

/**
 * Analyze backups and determine which to keep and which to delete
 *
 * Core retention logic implementing the specification:
 * - Keep last 10 backups (rolling window)
 * - Keep 1 daily snapshot (midnight) per day for 30 days
 * - Delete everything else
 *
 * Pure function for testability.
 *
 * @param backups - Array of backup file metadata
 * @param policy - Retention policy
 * @returns Cleanup result with files to delete
 *
 * @example
 * ```typescript
 * const backups = [
 *   { filename: 'audacious-backup-2026-03-29-143045.encrypted', timestamp: 1711728645000, ... },
 *   { filename: 'audacious-backup-2026-03-28-000015.encrypted', timestamp: 1711584015000, ... },
 *   // ... more backups
 * ];
 *
 * const result = analyzeBackupRetention(backups);
 * // => { totalBackups: 15, retainedCount: 12, deletedCount: 3, filesToDelete: [...], ... }
 * ```
 */
export function analyzeBackupRetention(
  backups: BackupFileMetadata[],
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY
): CleanupResult {
  if (backups.length === 0) {
    return {
      totalBackups: 0,
      retainedCount: 0,
      deletedCount: 0,
      filesToDelete: [],
      breakdown: {
        rolling: 0,
        dailySnapshots: 0,
        legacy: 0,
      },
      message: 'No backups to analyze.',
    };
  }

  // Sort by timestamp descending (newest first)
  const sortedBackups = [...backups].sort((a, b) => b.timestamp - a.timestamp);

  // Step 1: Identify rolling window backups (last N)
  const rollingBackups = new Set(
    sortedBackups.slice(0, policy.rollingWindowSize).map((b) => b.filename)
  );

  // Step 2: Identify daily snapshots
  const dailySnapshots = new Map<string, BackupFileMetadata>();
  const cutoffDate = Date.now() - policy.dailySnapshotDays * 24 * 60 * 60 * 1000;

  for (const backup of sortedBackups) {
    if (backup.isMidnightBackup && backup.timestamp >= cutoffDate) {
      const dateKey = getDateKey(new Date(backup.timestamp));

      // Keep only the first (most recent) midnight backup per day
      if (!dailySnapshots.has(dateKey)) {
        dailySnapshots.set(dateKey, backup);
      }
    }
  }

  // Step 3: Classify all backups and determine retention
  const filesToDelete: string[] = [];
  let rollingCount = 0;
  let dailySnapshotCount = 0;
  let legacyCount = 0;

  for (const backup of sortedBackups) {
    const isRolling = rollingBackups.has(backup.filename);
    const isDailySnapshot = Array.from(dailySnapshots.values()).some(
      (ds) => ds.filename === backup.filename
    );

    if (isRolling) {
      backup.type = BackupFileType.ROLLING;
      backup.shouldRetain = true;
      rollingCount++;
    } else if (isDailySnapshot) {
      backup.type = BackupFileType.DAILY_SNAPSHOT;
      backup.shouldRetain = true;
      dailySnapshotCount++;
    } else {
      backup.type = BackupFileType.LEGACY;
      backup.shouldRetain = false;
      legacyCount++;
      filesToDelete.push(backup.filename);
    }
  }

  const retainedCount = rollingCount + dailySnapshotCount;
  const deletedCount = filesToDelete.length;

  // Generate user-friendly message (Joy opportunity)
  let message: string;
  if (deletedCount === 0) {
    message = 'All backups are needed! Nothing to clean up.';
  } else if (deletedCount === 1) {
    message = `Smart cleanup - keeping ${retainedCount} backups, removing 1 old file.`;
  } else {
    message = `Smart cleanup - keeping ${retainedCount} backups, removing ${deletedCount} old files.`;
  }

  backupVersioningLogger.info('Backup retention analysis complete', {
    total: backups.length,
    retained: retainedCount,
    deleted: deletedCount,
  });

  return {
    totalBackups: backups.length,
    retainedCount,
    deletedCount,
    filesToDelete,
    breakdown: {
      rolling: rollingCount,
      dailySnapshots: dailySnapshotCount,
      legacy: legacyCount,
    },
    message,
  };
}

/**
 * Get backup statistics for UI display
 *
 * @param backups - Array of backup file metadata
 * @returns Human-readable statistics
 *
 * @example
 * ```typescript
 * const stats = getBackupStatistics(backups);
 * // => {
 * //   totalCount: 15,
 * //   totalSize: 52428800, // bytes
 * //   totalSizeFormatted: "50.0 MB",
 * //   oldestBackup: "2026-02-15T00:00:15.000Z",
 * //   newestBackup: "2026-03-29T14:30:45.000Z",
 * //   retentionSummary: "Keeping 10 recent + 5 daily snapshots"
 * // }
 * ```
 */
export function getBackupStatistics(
  backups: BackupFileMetadata[]
): {
  totalCount: number;
  totalSize: number;
  totalSizeFormatted: string;
  oldestBackup: string | null;
  newestBackup: string | null;
  retentionSummary: string;
} {
  if (backups.length === 0) {
    return {
      totalCount: 0,
      totalSize: 0,
      totalSizeFormatted: '0 bytes',
      oldestBackup: null,
      newestBackup: null,
      retentionSummary: 'No backups yet',
    };
  }

  const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
  const sorted = [...backups].sort((a, b) => a.timestamp - b.timestamp);
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];

  // Count retained backups by type
  const rollingCount = backups.filter((b) => b.type === BackupFileType.ROLLING).length;
  const dailyCount = backups.filter((b) => b.type === BackupFileType.DAILY_SNAPSHOT).length;

  let retentionSummary: string;
  if (rollingCount > 0 && dailyCount > 0) {
    retentionSummary = `Keeping ${rollingCount} recent + ${dailyCount} daily snapshots`;
  } else if (rollingCount > 0) {
    retentionSummary = `Keeping ${rollingCount} recent backups`;
  } else if (dailyCount > 0) {
    retentionSummary = `Keeping ${dailyCount} daily snapshots`;
  } else {
    retentionSummary = `${backups.length} backups available`;
  }

  return {
    totalCount: backups.length,
    totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    oldestBackup: oldest.createdAt,
    newestBackup: newest.createdAt,
    retentionSummary,
  };
}

/**
 * Format bytes to human-readable string
 *
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 bytes';

  const k = 1024;
  const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Validate retention policy configuration
 *
 * Ensures policy parameters are sensible and won't cause issues.
 *
 * @param policy - Retention policy to validate
 * @throws AppError if policy is invalid
 */
export function validateRetentionPolicy(policy: RetentionPolicy): void {
  if (policy.rollingWindowSize < 1) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Rolling window size must be at least 1'
    );
  }

  if (policy.rollingWindowSize > 100) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Rolling window size cannot exceed 100 (too many files)'
    );
  }

  if (policy.dailySnapshotDays < 0) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Daily snapshot days cannot be negative'
    );
  }

  if (policy.dailySnapshotDays > 365) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Daily snapshot days cannot exceed 365 (one year)'
    );
  }

  if (policy.midnightHourThreshold < 0 || policy.midnightHourThreshold > 23) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Midnight hour threshold must be between 0 and 23'
    );
  }

  if (policy.midnightMinuteRange < 0 || policy.midnightMinuteRange > 59) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Midnight minute range must be between 0 and 59'
    );
  }
}
