/**
 * BackupScheduler Tests
 *
 * Comprehensive tests for Task 2.3 of the Backup & Sync Architecture Roadmap.
 * Tests all trigger types and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BackupScheduler,
  BackupTriggerType,
  createBackupScheduler,
  getTimeUntilNextDailyBackup,
  formatTimeDuration,
  type BackupSchedulerConfig,
} from './BackupScheduler';

describe('BackupScheduler', () => {
  let mockOnBackup: ReturnType<typeof vi.fn>;
  let scheduler: BackupScheduler;

  beforeEach(() => {
    // Mock the onBackup callback
    mockOnBackup = vi.fn().mockResolvedValue(undefined);

    // Use fake timers for predictable testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Stop scheduler and cleanup
    if (scheduler) {
      scheduler.stop();
    }

    // Restore timers
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Constructor and Initialization', () => {
    it('should create instance with default configuration', () => {
      scheduler = new BackupScheduler({ onBackup: mockOnBackup });

      expect(scheduler).toBeInstanceOf(BackupScheduler);
      expect(scheduler.isBackingUp()).toBe(false);
      expect(scheduler.getLastBackupTimestamp()).toBe(0);
    });

    it('should create instance with custom configuration', () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        debounceMs: 5000,
        idleTimeoutMs: 60000,
        dailyBackupHour: 12,
        enableBeforeUnloadBackup: false,
        enableIdleBackup: false,
        enableDailyBackup: false,
        enableDataChangeBackup: true,
      });

      expect(scheduler).toBeInstanceOf(BackupScheduler);
    });

    it('should create instance using helper function', () => {
      scheduler = createBackupScheduler(mockOnBackup);

      expect(scheduler).toBeInstanceOf(BackupScheduler);
    });
  });

  describe('Start and Stop', () => {
    it('should start scheduler successfully', () => {
      scheduler = new BackupScheduler({ onBackup: mockOnBackup });
      scheduler.start();

      // Verify scheduler is running by checking that it can be stopped
      expect(() => scheduler.stop()).not.toThrow();
    });

    it('should not start twice', () => {
      scheduler = new BackupScheduler({ onBackup: mockOnBackup });
      scheduler.start();
      scheduler.start(); // Second start should be ignored

      // Should still work normally
      expect(() => scheduler.stop()).not.toThrow();
    });

    it('should stop scheduler successfully', () => {
      scheduler = new BackupScheduler({ onBackup: mockOnBackup });
      scheduler.start();
      scheduler.stop();

      // Verify scheduler is stopped by checking it doesn't respond to notifications
      scheduler.notifyDataChange();
      vi.advanceTimersByTime(15000);
      expect(mockOnBackup).not.toHaveBeenCalled();
    });

    it('should not stop when not running', () => {
      scheduler = new BackupScheduler({ onBackup: mockOnBackup });

      // Stop without starting should not throw
      expect(() => scheduler.stop()).not.toThrow();
    });

    it('should cleanup timers on stop', () => {
      scheduler = new BackupScheduler({ onBackup: mockOnBackup });
      scheduler.start();

      // Trigger some timers
      scheduler.notifyDataChange();

      scheduler.stop();

      // Advance time - should not trigger backup since stopped
      vi.advanceTimersByTime(15000);
      expect(mockOnBackup).not.toHaveBeenCalled();
    });
  });

  describe('Data Change Trigger (Debounced)', () => {
    it('should trigger backup after debounce period', async () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        debounceMs: 10000,
      });
      scheduler.start();

      scheduler.notifyDataChange();

      // Backup should not trigger immediately
      expect(mockOnBackup).not.toHaveBeenCalled();

      // Advance time past debounce period
      await vi.advanceTimersByTimeAsync(10000);

      // Backup should have triggered
      expect(mockOnBackup).toHaveBeenCalledTimes(1);
    });

    it('should reset debounce timer on multiple changes', async () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        debounceMs: 10000,
      });
      scheduler.start();

      // First change
      scheduler.notifyDataChange();
      await vi.advanceTimersByTimeAsync(5000);

      // Second change (resets timer)
      scheduler.notifyDataChange();
      await vi.advanceTimersByTimeAsync(5000);

      // Should not have triggered yet (only 5s since last change)
      expect(mockOnBackup).not.toHaveBeenCalled();

      // Advance another 5s (10s since last change)
      await vi.advanceTimersByTimeAsync(5000);

      // Now should have triggered
      expect(mockOnBackup).toHaveBeenCalledTimes(1);
    });

    it('should not trigger when data change backup disabled', async () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        debounceMs: 10000,
        enableDataChangeBackup: false,
      });
      scheduler.start();

      scheduler.notifyDataChange();
      await vi.advanceTimersByTimeAsync(15000);

      expect(mockOnBackup).not.toHaveBeenCalled();
    });

    it('should not trigger when scheduler not running', async () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        debounceMs: 10000,
      });

      // Don't start scheduler
      scheduler.notifyDataChange();
      await vi.advanceTimersByTimeAsync(15000);

      expect(mockOnBackup).not.toHaveBeenCalled();
    });

    it('should use custom debounce time', async () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        debounceMs: 5000,
      });
      scheduler.start();

      scheduler.notifyDataChange();
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockOnBackup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Manual Backup', () => {
    it('should trigger backup immediately', async () => {
      scheduler = new BackupScheduler({ onBackup: mockOnBackup });
      scheduler.start();

      const result = await scheduler.backupNow();

      expect(mockOnBackup).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.triggerType).toBe(BackupTriggerType.MANUAL);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should work when scheduler not started', async () => {
      scheduler = new BackupScheduler({ onBackup: mockOnBackup });

      // Don't start scheduler, but manual backup should still work
      const result = await scheduler.backupNow();

      expect(mockOnBackup).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });

    it('should update last backup timestamp', async () => {
      scheduler = new BackupScheduler({ onBackup: mockOnBackup });

      const beforeTimestamp = scheduler.getLastBackupTimestamp();
      expect(beforeTimestamp).toBe(0);

      await scheduler.backupNow();

      const afterTimestamp = scheduler.getLastBackupTimestamp();
      expect(afterTimestamp).toBeGreaterThan(beforeTimestamp);
    });

    it('should handle backup errors', async () => {
      const errorMessage = 'Backup failed';
      mockOnBackup = vi.fn().mockRejectedValue(new Error(errorMessage));

      scheduler = new BackupScheduler({ onBackup: mockOnBackup });

      const result = await scheduler.backupNow();

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
      expect(result.triggerType).toBe(BackupTriggerType.MANUAL);
    });

    it('should not allow concurrent backups', async () => {
      // Create a slow backup that takes some time
      let resolveBackup: (() => void) | null = null;
      mockOnBackup = vi.fn().mockImplementation(
        () => new Promise<void>((resolve) => {
          resolveBackup = resolve;
        })
      );

      scheduler = new BackupScheduler({ onBackup: mockOnBackup });

      // Trigger first backup (will not complete until we resolve it)
      const promise1 = scheduler.backupNow();

      // Wait a bit to ensure first backup has started
      await Promise.resolve();

      // Trigger second backup (should be skipped)
      const promise2 = scheduler.backupNow();

      // Now resolve the first backup
      if (resolveBackup) {
        resolveBackup();
      }

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // First should succeed
      expect(result1.success).toBe(true);

      // Second should be skipped
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Backup already in progress');

      // Only one actual backup call
      expect(mockOnBackup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Idle Backup', () => {
    it('should trigger backup after idle timeout', async () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        idleTimeoutMs: 120000, // 2 minutes
        enableIdleBackup: true,
        enableDataChangeBackup: false,
        enableDailyBackup: false,
        enableBeforeUnloadBackup: false,
      });
      scheduler.start();

      // No activity for 2 minutes
      await vi.advanceTimersByTimeAsync(120000);

      expect(mockOnBackup).toHaveBeenCalledTimes(1);
    });

    it('should reset idle timer on user activity', async () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        idleTimeoutMs: 120000,
        enableIdleBackup: true,
        enableDataChangeBackup: false,
        enableDailyBackup: false,
        enableBeforeUnloadBackup: false,
      });
      scheduler.start();

      // Wait 1 minute
      await vi.advanceTimersByTimeAsync(60000);

      // Simulate user activity (mousedown)
      const mouseEvent = new MouseEvent('mousedown');
      window.dispatchEvent(mouseEvent);

      // Wait another minute (should not trigger yet, only 1 min since activity)
      await vi.advanceTimersByTimeAsync(60000);
      expect(mockOnBackup).not.toHaveBeenCalled();

      // Wait another minute (now 2 min since activity)
      await vi.advanceTimersByTimeAsync(60000);
      expect(mockOnBackup).toHaveBeenCalledTimes(1);
    });

    it('should not trigger when idle backup disabled', async () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        idleTimeoutMs: 120000,
        enableIdleBackup: false,
      });
      scheduler.start();

      await vi.advanceTimersByTimeAsync(150000);

      expect(mockOnBackup).not.toHaveBeenCalled();
    });

    it('should use custom idle timeout', async () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        idleTimeoutMs: 60000, // 1 minute
        enableIdleBackup: true,
        enableDataChangeBackup: false,
        enableDailyBackup: false,
        enableBeforeUnloadBackup: false,
      });
      scheduler.start();

      await vi.advanceTimersByTimeAsync(60000);

      expect(mockOnBackup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Daily Backup', () => {
    it('should schedule backup at specified hour', async () => {
      // Set current time to 10:00 AM
      const now = new Date('2024-01-01T10:00:00');
      vi.setSystemTime(now);

      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        dailyBackupHour: 12, // Noon
        enableDailyBackup: true,
        enableIdleBackup: false,
        enableDataChangeBackup: false,
        enableBeforeUnloadBackup: false,
      });
      scheduler.start();

      // Should not trigger immediately
      expect(mockOnBackup).not.toHaveBeenCalled();

      // Advance 2 hours to noon
      await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);

      expect(mockOnBackup).toHaveBeenCalledTimes(1);
    });

    it('should schedule for next day if hour has passed', async () => {
      // Set current time to 2:00 PM
      const now = new Date('2024-01-01T14:00:00');
      vi.setSystemTime(now);

      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        dailyBackupHour: 12, // Noon (already passed)
        enableDailyBackup: true,
        enableIdleBackup: false,
        enableDataChangeBackup: false,
        enableBeforeUnloadBackup: false,
      });
      scheduler.start();

      // Should not trigger immediately
      expect(mockOnBackup).not.toHaveBeenCalled();

      // Advance 22 hours (to tomorrow at noon)
      await vi.advanceTimersByTimeAsync(22 * 60 * 60 * 1000);

      expect(mockOnBackup).toHaveBeenCalledTimes(1);
    });

    it('should not trigger when daily backup disabled', async () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        dailyBackupHour: 12,
        enableDailyBackup: false,
        enableIdleBackup: false, // Disable idle backup too
        enableDataChangeBackup: false,
        enableBeforeUnloadBackup: false,
      });
      scheduler.start();

      // Advance 24 hours
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

      expect(mockOnBackup).not.toHaveBeenCalled();
    });

    it('should reschedule after successful backup', async () => {
      const now = new Date('2024-01-01T12:00:00');
      vi.setSystemTime(now);

      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        dailyBackupHour: 12,
        enableDailyBackup: true,
        enableIdleBackup: false,
        enableDataChangeBackup: false,
        enableBeforeUnloadBackup: false,
      });
      scheduler.start();

      // First daily backup should trigger at next noon (tomorrow)
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(mockOnBackup).toHaveBeenCalledTimes(1);

      // Second daily backup should trigger 24 hours later
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(mockOnBackup).toHaveBeenCalledTimes(2);
    });

    it('should reschedule after failed backup', async () => {
      mockOnBackup = vi.fn().mockRejectedValue(new Error('Backup failed'));

      const now = new Date('2024-01-01T12:00:00');
      vi.setSystemTime(now);

      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        dailyBackupHour: 12,
        enableDailyBackup: true,
        enableIdleBackup: false,
        enableDataChangeBackup: false,
        enableBeforeUnloadBackup: false,
      });
      scheduler.start();

      // First daily backup should trigger and fail
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(mockOnBackup).toHaveBeenCalledTimes(1);

      // Second daily backup should still be scheduled
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(mockOnBackup).toHaveBeenCalledTimes(2);
    });

    it('should use custom daily backup hour', async () => {
      const now = new Date('2024-01-01T20:00:00');
      vi.setSystemTime(now);

      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        dailyBackupHour: 22, // 10 PM
        enableDailyBackup: true,
        enableIdleBackup: false,
        enableDataChangeBackup: false,
        enableBeforeUnloadBackup: false,
      });
      scheduler.start();

      // Advance 2 hours to 10 PM
      await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);

      expect(mockOnBackup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Before Unload Backup', () => {
    it('should trigger backup on beforeunload event', () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        enableBeforeUnloadBackup: true,
        enableIdleBackup: false,
        enableDataChangeBackup: false,
        enableDailyBackup: false,
      });
      scheduler.start();

      // Simulate beforeunload event
      const event = new Event('beforeunload') as BeforeUnloadEvent;
      window.dispatchEvent(event);

      // Backup should be triggered (async, so may not complete immediately)
      expect(mockOnBackup).toHaveBeenCalledTimes(1);
    });

    it('should not trigger when beforeunload backup disabled', () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        enableBeforeUnloadBackup: false,
      });
      scheduler.start();

      // Simulate beforeunload event
      const event = new Event('beforeunload') as BeforeUnloadEvent;
      window.dispatchEvent(event);

      expect(mockOnBackup).not.toHaveBeenCalled();
    });

    it('should remove listener on stop', () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        enableBeforeUnloadBackup: true,
      });
      scheduler.start();
      scheduler.stop();

      // Simulate beforeunload event after stop
      const event = new Event('beforeunload') as BeforeUnloadEvent;
      window.dispatchEvent(event);

      expect(mockOnBackup).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration and restart', async () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        debounceMs: 10000,
      });
      scheduler.start();

      // Update configuration
      scheduler.updateConfig({ debounceMs: 5000 });

      // Test new configuration
      scheduler.notifyDataChange();
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockOnBackup).toHaveBeenCalledTimes(1);
    });

    it('should preserve running state after update', async () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        debounceMs: 10000,
      });
      scheduler.start();

      scheduler.updateConfig({ debounceMs: 5000 });

      // Should still be running
      scheduler.notifyDataChange();
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockOnBackup).toHaveBeenCalledTimes(1);
    });

    it('should not start if was not running', () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        debounceMs: 10000,
      });

      // Don't start
      scheduler.updateConfig({ debounceMs: 5000 });

      // Should still not be running
      scheduler.notifyDataChange();
      vi.advanceTimersByTime(5000);

      expect(mockOnBackup).not.toHaveBeenCalled();
    });

    it('should update onBackup callback', async () => {
      const newOnBackup = vi.fn().mockResolvedValue(undefined);

      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
      });

      scheduler.updateConfig({ onBackup: newOnBackup });

      await scheduler.backupNow();

      expect(newOnBackup).toHaveBeenCalledTimes(1);
      expect(mockOnBackup).not.toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    describe('getTimeUntilNextDailyBackup', () => {
      it('should calculate time until next backup (same day)', () => {
        const now = new Date('2024-01-01T10:00:00');
        vi.setSystemTime(now);

        const ms = getTimeUntilNextDailyBackup(12); // Noon

        // Should be 2 hours
        expect(ms).toBe(2 * 60 * 60 * 1000);
      });

      it('should calculate time until next backup (next day)', () => {
        const now = new Date('2024-01-01T14:00:00');
        vi.setSystemTime(now);

        const ms = getTimeUntilNextDailyBackup(12); // Noon (already passed)

        // Should be 22 hours
        expect(ms).toBe(22 * 60 * 60 * 1000);
      });

      it('should handle midnight backup', () => {
        const now = new Date('2024-01-01T10:00:00');
        vi.setSystemTime(now);

        const ms = getTimeUntilNextDailyBackup(0); // Midnight

        // Should be 14 hours
        expect(ms).toBe(14 * 60 * 60 * 1000);
      });
    });

    describe('formatTimeDuration', () => {
      it('should format seconds', () => {
        expect(formatTimeDuration(5000)).toBe('5 seconds');
        expect(formatTimeDuration(1000)).toBe('1 second');
      });

      it('should format minutes', () => {
        expect(formatTimeDuration(120000)).toBe('2 minutes');
        expect(formatTimeDuration(60000)).toBe('1 minute');
      });

      it('should format hours', () => {
        expect(formatTimeDuration(7200000)).toBe('2 hours');
        expect(formatTimeDuration(3600000)).toBe('1 hour');
      });

      it('should format days', () => {
        expect(formatTimeDuration(172800000)).toBe('2 days');
        expect(formatTimeDuration(86400000)).toBe('1 day');
      });

      it('should prefer larger units', () => {
        expect(formatTimeDuration(86400000 + 3600000)).toBe('1 day'); // 1 day 1 hour -> "1 day"
        expect(formatTimeDuration(3600000 + 60000)).toBe('1 hour'); // 1 hour 1 min -> "1 hour"
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing onBackup callback gracefully', () => {
      // TypeScript would prevent this, but test runtime behavior
      expect(() => {
        // @ts-expect-error Testing invalid configuration
        scheduler = new BackupScheduler({});
      }).not.toThrow();
    });

    it('should handle backup in progress state correctly', async () => {
      // Create a slow backup
      mockOnBackup = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      scheduler = new BackupScheduler({ onBackup: mockOnBackup });

      expect(scheduler.isBackingUp()).toBe(false);

      const promise = scheduler.backupNow();

      // Should be in progress immediately
      expect(scheduler.isBackingUp()).toBe(true);

      await promise;

      // Should be done after completion
      expect(scheduler.isBackingUp()).toBe(false);
    });

    it('should handle backup errors without crashing', async () => {
      mockOnBackup = vi.fn().mockRejectedValue(new Error('Test error'));

      scheduler = new BackupScheduler({ onBackup: mockOnBackup });
      scheduler.start();

      // Should not throw
      await expect(scheduler.backupNow()).resolves.toBeDefined();

      // Should be able to trigger again
      await expect(scheduler.backupNow()).resolves.toBeDefined();
    });

    it('should handle rapid data change notifications', async () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        debounceMs: 10000,
      });
      scheduler.start();

      // Rapid notifications
      for (let i = 0; i < 100; i++) {
        scheduler.notifyDataChange();
        await vi.advanceTimersByTimeAsync(100);
      }

      // Should still only trigger once after debounce
      await vi.advanceTimersByTimeAsync(10000);

      expect(mockOnBackup).toHaveBeenCalledTimes(1);
    });

    it('should cleanup properly after multiple start/stop cycles', async () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        debounceMs: 10000,
      });

      // Start and stop multiple times
      for (let i = 0; i < 5; i++) {
        scheduler.start();
        scheduler.notifyDataChange();
        scheduler.stop();
      }

      // Should not trigger after being stopped
      await vi.advanceTimersByTimeAsync(15000);
      expect(mockOnBackup).not.toHaveBeenCalled();
    });

    it('should handle zero debounce time', async () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        debounceMs: 0,
      });
      scheduler.start();

      scheduler.notifyDataChange();

      // Should trigger immediately (or very quickly)
      await vi.advanceTimersByTimeAsync(10);

      expect(mockOnBackup).toHaveBeenCalledTimes(1);
    });

    it('should handle large debounce time', async () => {
      scheduler = new BackupScheduler({
        onBackup: mockOnBackup,
        debounceMs: 3600000, // 1 hour
      });
      scheduler.start();

      scheduler.notifyDataChange();

      // Should not trigger after 30 minutes
      await vi.advanceTimersByTimeAsync(1800000);
      expect(mockOnBackup).not.toHaveBeenCalled();

      // Should trigger after 1 hour
      await vi.advanceTimersByTimeAsync(1800000);
      expect(mockOnBackup).toHaveBeenCalledTimes(1);
    });
  });
});
