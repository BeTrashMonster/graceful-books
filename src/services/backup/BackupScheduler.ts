/**
 * Backup Scheduler Service
 *
 * Implements Task 2.3 of the Backup & Sync Architecture Roadmap.
 * Provides automatic backup scheduling with multiple triggers:
 * - Debounced backup on data changes (max 1 per 10 seconds)
 * - Backup on app close (beforeunload event)
 * - Backup on idle (inactive for 2 minutes)
 * - Daily scheduled backup (midnight local time)
 * - Manual "Backup Now" button integration
 *
 * Usage:
 * ```typescript
 * const scheduler = new BackupScheduler({
 *   onBackup: async () => {
 *     // Perform backup using FileSystemBackup service
 *     await backupService.createBackup();
 *   },
 *   debounceMs: 10000,
 *   idleTimeoutMs: 120000,
 * });
 *
 * scheduler.start();
 *
 * // Trigger backup on data change
 * scheduler.notifyDataChange();
 *
 * // Manual backup
 * await scheduler.backupNow();
 *
 * // Stop scheduler
 * scheduler.stop();
 * ```
 *
 * @module BackupScheduler
 */

import { logger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/errors';

const backupSchedulerLogger = logger.child('BackupScheduler');

/**
 * Configuration options for BackupScheduler
 */
export interface BackupSchedulerConfig {
  /**
   * Callback function to execute when a backup should be triggered.
   * This should integrate with FileSystemBackup service (Task 2.1) and
   * BackupEncryption service (Phase 1).
   */
  onBackup: () => Promise<void>;

  /**
   * Debounce time in milliseconds for data change triggers.
   * Default: 10000 (10 seconds)
   */
  debounceMs?: number;

  /**
   * Idle timeout in milliseconds before triggering backup.
   * Default: 120000 (2 minutes)
   */
  idleTimeoutMs?: number;

  /**
   * Hour of day (0-23) to perform daily scheduled backup.
   * Default: 0 (midnight local time)
   */
  dailyBackupHour?: number;

  /**
   * Enable automatic backup on beforeunload event.
   * Default: true
   */
  enableBeforeUnloadBackup?: boolean;

  /**
   * Enable automatic backup on idle.
   * Default: true
   */
  enableIdleBackup?: boolean;

  /**
   * Enable daily scheduled backup.
   * Default: true
   */
  enableDailyBackup?: boolean;

  /**
   * Enable debounced backup on data changes.
   * Default: true
   */
  enableDataChangeBackup?: boolean;
}

/**
 * Backup trigger types for logging and analytics
 */
export enum BackupTriggerType {
  DATA_CHANGE = 'DATA_CHANGE',
  BEFORE_UNLOAD = 'BEFORE_UNLOAD',
  IDLE = 'IDLE',
  DAILY = 'DAILY',
  MANUAL = 'MANUAL',
}

/**
 * Result of a backup operation
 */
export interface BackupResult {
  success: boolean;
  triggerType: BackupTriggerType;
  timestamp: number;
  error?: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<BackupSchedulerConfig, 'onBackup'>> = {
  debounceMs: 10000, // 10 seconds
  idleTimeoutMs: 120000, // 2 minutes
  dailyBackupHour: 0, // midnight
  enableBeforeUnloadBackup: true,
  enableIdleBackup: true,
  enableDailyBackup: true,
  enableDataChangeBackup: true,
};

/**
 * BackupScheduler class
 *
 * Manages automatic backup triggers and scheduling.
 * Integrates with FileSystemBackup (Task 2.1) and BackupEncryption (Phase 1).
 */
export class BackupScheduler {
  private config: Required<BackupSchedulerConfig>;
  private isRunning = false;
  private isBackupInProgress = false;

  // Timer IDs
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private dailyTimer: ReturnType<typeof setTimeout> | null = null;

  // Event listeners
  private beforeUnloadListener: ((event: BeforeUnloadEvent) => void) | null = null;
  private activityListeners: Map<string, EventListener> = new Map();

  // Last backup timestamp
  private lastBackupTimestamp = 0;

  // Activity tracking
  private lastActivityTimestamp = Date.now();

  /**
   * Create a new BackupScheduler instance
   *
   * @param config - Configuration options
   */
  constructor(config: BackupSchedulerConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    backupSchedulerLogger.info('BackupScheduler initialized', {
      debounceMs: this.config.debounceMs,
      idleTimeoutMs: this.config.idleTimeoutMs,
      dailyBackupHour: this.config.dailyBackupHour,
    });
  }

  /**
   * Start the backup scheduler
   *
   * Sets up all enabled triggers and starts monitoring.
   */
  start(): void {
    if (this.isRunning) {
      backupSchedulerLogger.warn('BackupScheduler already running');
      return;
    }

    backupSchedulerLogger.info('Starting BackupScheduler');
    this.isRunning = true;

    // Set up beforeunload backup
    if (this.config.enableBeforeUnloadBackup) {
      this.setupBeforeUnloadBackup();
    }

    // Set up idle backup
    if (this.config.enableIdleBackup) {
      this.setupIdleBackup();
    }

    // Set up daily backup
    if (this.config.enableDailyBackup) {
      this.setupDailyBackup();
    }

    backupSchedulerLogger.info('BackupScheduler started');
  }

  /**
   * Stop the backup scheduler
   *
   * Clears all timers and removes event listeners.
   */
  stop(): void {
    if (!this.isRunning) {
      backupSchedulerLogger.warn('BackupScheduler not running');
      return;
    }

    backupSchedulerLogger.info('Stopping BackupScheduler');
    this.isRunning = false;

    // Clear all timers
    this.clearDebounceTimer();
    this.clearIdleTimer();
    this.clearDailyTimer();

    // Remove beforeunload listener
    if (this.beforeUnloadListener) {
      window.removeEventListener('beforeunload', this.beforeUnloadListener);
      this.beforeUnloadListener = null;
    }

    // Remove activity listeners
    this.activityListeners.forEach((listener, eventType) => {
      window.removeEventListener(eventType, listener);
    });
    this.activityListeners.clear();

    backupSchedulerLogger.info('BackupScheduler stopped');
  }

  /**
   * Notify scheduler of data change
   *
   * Triggers debounced backup if enabled.
   * This should be called whenever user data changes (transactions, accounts, etc.).
   */
  notifyDataChange(): void {
    if (!this.isRunning || !this.config.enableDataChangeBackup) {
      return;
    }

    backupSchedulerLogger.debug('Data change notification received');

    // Clear existing debounce timer
    this.clearDebounceTimer();

    // Set new debounce timer
    this.debounceTimer = setTimeout(() => {
      this.executeBackup(BackupTriggerType.DATA_CHANGE).catch((error) => {
        backupSchedulerLogger.error('Data change backup failed', { error });
      });
    }, this.config.debounceMs);

    backupSchedulerLogger.debug('Debounce timer set', {
      debounceMs: this.config.debounceMs,
    });
  }

  /**
   * Trigger manual backup immediately
   *
   * This should be used for the "Backup Now" button in Settings.
   *
   * @returns Promise resolving to backup result
   */
  async backupNow(): Promise<BackupResult> {
    backupSchedulerLogger.info('Manual backup requested');
    return this.executeBackup(BackupTriggerType.MANUAL);
  }

  /**
   * Get last backup timestamp
   *
   * @returns Unix timestamp of last successful backup, or 0 if never backed up
   */
  getLastBackupTimestamp(): number {
    return this.lastBackupTimestamp;
  }

  /**
   * Check if backup is currently in progress
   *
   * @returns true if backup is in progress
   */
  isBackingUp(): boolean {
    return this.isBackupInProgress;
  }

  /**
   * Update scheduler configuration
   *
   * Restarts scheduler with new configuration.
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<BackupSchedulerConfig>): void {
    backupSchedulerLogger.info('Updating scheduler configuration', config);

    const wasRunning = this.isRunning;

    if (wasRunning) {
      this.stop();
    }

    this.config = {
      ...this.config,
      ...config,
    };

    if (wasRunning) {
      this.start();
    }

    backupSchedulerLogger.info('Scheduler configuration updated');
  }

  /**
   * Execute backup with specified trigger type
   *
   * @param triggerType - Type of trigger that initiated backup
   * @returns Promise resolving to backup result
   */
  private async executeBackup(triggerType: BackupTriggerType): Promise<BackupResult> {
    // Check if backup already in progress
    if (this.isBackupInProgress) {
      backupSchedulerLogger.debug('Backup already in progress, skipping', {
        triggerType,
      });
      return {
        success: false,
        triggerType,
        timestamp: Date.now(),
        error: 'Backup already in progress',
      };
    }

    this.isBackupInProgress = true;

    try {
      backupSchedulerLogger.info('Executing backup', { triggerType });

      const startTime = Date.now();
      await this.config.onBackup();
      const duration = Date.now() - startTime;

      this.lastBackupTimestamp = Date.now();

      backupSchedulerLogger.info('Backup completed successfully', {
        triggerType,
        duration,
      });

      return {
        success: true,
        triggerType,
        timestamp: this.lastBackupTimestamp,
      };
    } catch (error) {
      backupSchedulerLogger.error('Backup failed', {
        triggerType,
        error,
      });

      return {
        success: false,
        triggerType,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.isBackupInProgress = false;
    }
  }

  /**
   * Set up beforeunload backup
   *
   * Triggers backup when user closes the app/tab.
   * Uses synchronous backup approach for beforeunload compatibility.
   */
  private setupBeforeUnloadBackup(): void {
    this.beforeUnloadListener = (event: BeforeUnloadEvent) => {
      backupSchedulerLogger.info('beforeunload event detected');

      // Trigger backup (non-blocking)
      // Note: beforeunload has limited execution time, so we can't wait for async operations
      // We'll attempt the backup but can't guarantee completion
      this.executeBackup(BackupTriggerType.BEFORE_UNLOAD).catch((error) => {
        backupSchedulerLogger.error('beforeunload backup failed', { error });
      });

      // Don't prevent unload - let user close the app
      // The backup will be attempted in the background
    };

    window.addEventListener('beforeunload', this.beforeUnloadListener);
    backupSchedulerLogger.debug('beforeunload backup listener registered');
  }

  /**
   * Set up idle backup
   *
   * Triggers backup when user is inactive for specified duration.
   * Monitors user activity via mouse, keyboard, and touch events.
   */
  private setupIdleBackup(): void {
    // Activity event types to monitor
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    // Activity handler
    const handleActivity = () => {
      this.lastActivityTimestamp = Date.now();
      this.resetIdleTimer();
    };

    // Register activity listeners
    activityEvents.forEach((eventType) => {
      const listener = handleActivity as EventListener;
      window.addEventListener(eventType, listener, { passive: true });
      this.activityListeners.set(eventType, listener);
    });

    // Start idle timer
    this.resetIdleTimer();

    backupSchedulerLogger.debug('Idle backup monitoring started', {
      idleTimeoutMs: this.config.idleTimeoutMs,
    });
  }

  /**
   * Reset idle timer
   *
   * Called on user activity to restart the idle countdown.
   */
  private resetIdleTimer(): void {
    this.clearIdleTimer();

    this.idleTimer = setTimeout(() => {
      const timeSinceActivity = Date.now() - this.lastActivityTimestamp;

      // Double-check that user is still idle
      if (timeSinceActivity >= this.config.idleTimeoutMs) {
        backupSchedulerLogger.info('User idle detected, triggering backup');
        this.executeBackup(BackupTriggerType.IDLE).catch((error) => {
          backupSchedulerLogger.error('Idle backup failed', { error });
        });
      } else {
        // User became active, reset timer
        this.resetIdleTimer();
      }
    }, this.config.idleTimeoutMs);
  }

  /**
   * Set up daily backup
   *
   * Schedules backup at specified hour each day (local time).
   */
  private setupDailyBackup(): void {
    const scheduleNextBackup = () => {
      const now = new Date();
      const targetTime = new Date();
      targetTime.setHours(this.config.dailyBackupHour, 0, 0, 0);

      // If target time has passed today, schedule for tomorrow
      if (targetTime <= now) {
        targetTime.setDate(targetTime.getDate() + 1);
      }

      const msUntilBackup = targetTime.getTime() - now.getTime();

      backupSchedulerLogger.debug('Daily backup scheduled', {
        targetTime: targetTime.toISOString(),
        msUntilBackup,
      });

      this.dailyTimer = setTimeout(() => {
        backupSchedulerLogger.info('Daily backup triggered');
        this.executeBackup(BackupTriggerType.DAILY)
          .then(() => {
            // Schedule next day's backup
            scheduleNextBackup();
          })
          .catch((error) => {
            backupSchedulerLogger.error('Daily backup failed', { error });
            // Still schedule next day's backup
            scheduleNextBackup();
          });
      }, msUntilBackup);
    };

    scheduleNextBackup();
    backupSchedulerLogger.debug('Daily backup monitoring started', {
      dailyBackupHour: this.config.dailyBackupHour,
    });
  }

  /**
   * Clear debounce timer
   */
  private clearDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Clear idle timer
   */
  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Clear daily timer
   */
  private clearDailyTimer(): void {
    if (this.dailyTimer) {
      clearTimeout(this.dailyTimer);
      this.dailyTimer = null;
    }
  }
}

/**
 * Create a BackupScheduler instance with default configuration
 *
 * Helper function for common use case.
 *
 * @param onBackup - Callback function to execute when backup should be triggered
 * @returns BackupScheduler instance
 *
 * @example
 * ```typescript
 * const scheduler = createBackupScheduler(async () => {
 *   await fileSystemBackup.createBackup();
 * });
 * scheduler.start();
 * ```
 */
export function createBackupScheduler(
  onBackup: () => Promise<void>
): BackupScheduler {
  return new BackupScheduler({ onBackup });
}

/**
 * Get time until next daily backup
 *
 * Utility function to calculate time remaining until next daily backup.
 *
 * @param dailyBackupHour - Hour of day (0-23) for daily backup
 * @returns Milliseconds until next daily backup
 */
export function getTimeUntilNextDailyBackup(dailyBackupHour: number): number {
  const now = new Date();
  const targetTime = new Date();
  targetTime.setHours(dailyBackupHour, 0, 0, 0);

  // If target time has passed today, schedule for tomorrow
  if (targetTime <= now) {
    targetTime.setDate(targetTime.getDate() + 1);
  }

  return targetTime.getTime() - now.getTime();
}

/**
 * Format time duration for display
 *
 * Utility function to format milliseconds into human-readable duration.
 *
 * @param ms - Milliseconds
 * @returns Formatted duration string (e.g., "2 hours", "30 minutes")
 */
export function formatTimeDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  }
}
