/**
 * Email Preferences Store Tests
 *
 * Comprehensive tests for D3: Weekly Email Summary Setup
 * Tests CRUD operations, validation, and unsubscribe functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/database';
import {
  getEmailPreferences,
  getOrCreateEmailPreferences,
  updateEmailPreferences,
  enableEmailNotifications,
  disableEmailNotifications,
  unsubscribeFromEmails,
  recordEmailDelivery,
  updateEmailDeliveryStatus,
  getRecentEmailDeliveries,
  isUserUnsubscribed,
  deleteEmailPreferences,
} from './emailPreferences';
import type { EmailPreferencesInput } from '../types/email.types';

const testUserId = 'user-test-123';
const testCompanyId = 'company-test-456';

describe('Email Preferences Store', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.emailPreferences.clear();
    await db.emailDelivery.clear();
  });

  afterEach(async () => {
    // Clean up after each test
    await db.emailPreferences.clear();
    await db.emailDelivery.clear();
  });

  describe('getEmailPreferences', () => {
    it('should return null when no preferences exist', async () => {
      const result = await getEmailPreferences(testUserId);
      expect(result).toBeNull();
    });

    it('should return preferences when they exist', async () => {
      // Create preferences first
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      const result = await getEmailPreferences(testUserId);

      expect(result).not.toBeNull();
      expect(result?.user_id).toBe(testUserId);
      expect(result?.company_id).toBe(testCompanyId);
    });

    it('should not return soft-deleted preferences', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);
      await deleteEmailPreferences(testUserId);

      const result = await getEmailPreferences(testUserId);
      expect(result).toBeNull();
    });
  });

  describe('getOrCreateEmailPreferences', () => {
    it('should create default preferences if none exist', async () => {
      const result = await getOrCreateEmailPreferences(testUserId, testCompanyId);

      expect(result).toBeDefined();
      expect(result.user_id).toBe(testUserId);
      expect(result.company_id).toBe(testCompanyId);
      expect(result.enabled).toBe(true); // Default is enabled
      expect(result.frequency).toBe('weekly');
      expect(result.day_of_week).toBe('monday');
      expect(result.time_of_day).toBe('08:00');
      expect(result.include_sections).toContain('checklist-summary');
      expect(result.max_tasks_to_show).toBe(5);
      expect(result.unsubscribed_at).toBeNull();
    });

    it('should return existing preferences if they exist', async () => {
      const first = await getOrCreateEmailPreferences(testUserId, testCompanyId);
      const second = await getOrCreateEmailPreferences(testUserId, testCompanyId);

      expect(first.id).toBe(second.id);
      expect(first.created_at).toEqual(second.created_at);
    });

    it('should set proper version vector on creation', async () => {
      const result = await getOrCreateEmailPreferences(testUserId, testCompanyId);

      expect(result.version_vector).toBeDefined();
      expect(Object.keys(result.version_vector).length).toBeGreaterThan(0);
    });
  });

  describe('updateEmailPreferences', () => {
    it('should update email preferences successfully', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      const updates: EmailPreferencesInput = {
        frequency: 'bi-weekly',
        dayOfWeek: 'friday',
        timeOfDay: '17:00',
        maxTasksToShow: 10,
      };

      const result = await updateEmailPreferences(testUserId, updates);

      expect(result.frequency).toBe('bi-weekly');
      expect(result.day_of_week).toBe('friday');
      expect(result.time_of_day).toBe('17:00');
      expect(result.max_tasks_to_show).toBe(10);
    });

    it('should throw error when preferences do not exist', async () => {
      const updates: EmailPreferencesInput = {
        enabled: false,
      };

      await expect(updateEmailPreferences(testUserId, updates)).rejects.toThrow(
        'not found'
      );
    });

    it('should update version vector on update', async () => {
      const initial = await getOrCreateEmailPreferences(testUserId, testCompanyId);
      const initialVector = { ...initial.version_vector };

      await updateEmailPreferences(testUserId, { maxTasksToShow: 7 });

      const updated = await getEmailPreferences(testUserId);

      expect(updated?.version_vector).not.toEqual(initialVector);
    });

    it('should update last_modified metadata', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      const beforeUpdate = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay

      await updateEmailPreferences(testUserId, { maxTasksToShow: 8 });

      const updated = await getEmailPreferences(testUserId);

      expect(updated?.last_modified_at.getTime()).toBeGreaterThanOrEqual(beforeUpdate);
    });

    it('should validate email preferences before update', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      const invalidUpdates: any = {
        frequency: 'invalid-frequency',
      };

      await expect(updateEmailPreferences(testUserId, invalidUpdates)).rejects.toThrow();
    });

    it('should allow updating individual fields', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      // Update only one field
      await updateEmailPreferences(testUserId, { enabled: false });

      const result = await getEmailPreferences(testUserId);

      expect(result?.enabled).toBe(false);
      expect(result?.frequency).toBe('weekly'); // Should remain unchanged
    });
  });

  describe('enableEmailNotifications', () => {
    it('should enable email notifications', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);
      await disableEmailNotifications(testUserId);

      const result = await enableEmailNotifications(testUserId, testCompanyId);

      expect(result.enabled).toBe(true);
      expect(result.unsubscribed_at).toBeNull();
    });

    it('should clear unsubscribe data when re-enabling', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);
      await unsubscribeFromEmails(testUserId, 'Test reason');

      const result = await enableEmailNotifications(testUserId, testCompanyId);

      expect(result.enabled).toBe(true);
      expect(result.unsubscribed_at).toBeNull();
      expect(result.unsubscribe_reason).toBeNull();
    });
  });

  describe('disableEmailNotifications', () => {
    it('should disable email notifications', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      const result = await disableEmailNotifications(testUserId);

      expect(result.enabled).toBe(false);
    });

    it('should not affect other preferences', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      const result = await disableEmailNotifications(testUserId);

      expect(result.frequency).toBe('weekly'); // Should remain unchanged
      expect(result.day_of_week).toBe('monday'); // Should remain unchanged
    });
  });

  describe('unsubscribeFromEmails', () => {
    it('should unsubscribe user from emails', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      const result = await unsubscribeFromEmails(testUserId);

      expect(result.enabled).toBe(false);
      expect(result.unsubscribed_at).not.toBeNull();
      expect(result.unsubscribe_reason).toBe('User unsubscribed');
    });

    it('should record unsubscribe reason', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      const reason = 'Too many emails';
      const result = await unsubscribeFromEmails(testUserId, reason);

      expect(result.unsubscribe_reason).toBe(reason);
    });

    it('should use default reason if none provided', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      const result = await unsubscribeFromEmails(testUserId);

      expect(result.unsubscribe_reason).toBe('User unsubscribed');
    });
  });

  describe('recordEmailDelivery', () => {
    it('should create email delivery record', async () => {
      const scheduledAt = new Date(Date.now() + 86400000); // Tomorrow

      const result = await recordEmailDelivery(
        testUserId,
        testCompanyId,
        'test@example.com',
        'Test Subject',
        scheduledAt,
        'hash123'
      );

      expect(result).toBeDefined();
      expect(result.user_id).toBe(testUserId);
      expect(result.company_id).toBe(testCompanyId);
      expect(result.recipient_email).toBe('test@example.com');
      expect(result.subject).toBe('Test Subject');
      expect(result.status).toBe('pending');
      expect(result.content_hash).toBe('hash123');
    });

    it('should set default status to pending', async () => {
      const result = await recordEmailDelivery(
        testUserId,
        testCompanyId,
        'test@example.com',
        'Test Subject',
        new Date(),
        'hash123'
      );

      expect(result.status).toBe('pending');
      expect(result.sent_at).toBeNull();
      expect(result.failed_at).toBeNull();
    });

    it('should initialize retry tracking', async () => {
      const result = await recordEmailDelivery(
        testUserId,
        testCompanyId,
        'test@example.com',
        'Test Subject',
        new Date(),
        'hash123'
      );

      expect(result.retry_count).toBe(0);
      expect(result.max_retries).toBe(3);
      expect(result.last_retry_at).toBeNull();
    });
  });

  describe('updateEmailDeliveryStatus', () => {
    it('should update status to sent', async () => {
      const delivery = await recordEmailDelivery(
        testUserId,
        testCompanyId,
        'test@example.com',
        'Test Subject',
        new Date(),
        'hash123'
      );

      await updateEmailDeliveryStatus(delivery.id, 'sent');

      const updated = await db.emailDelivery.get(delivery.id);

      expect(updated?.status).toBe('sent');
      expect(updated?.sent_at).not.toBeNull();
      expect(updated?.delivered_at).not.toBeNull();
    });

    it('should update status to failed with reason', async () => {
      const delivery = await recordEmailDelivery(
        testUserId,
        testCompanyId,
        'test@example.com',
        'Test Subject',
        new Date(),
        'hash123'
      );

      const failureReason = 'SMTP connection timeout';
      await updateEmailDeliveryStatus(delivery.id, 'failed', failureReason);

      const updated = await db.emailDelivery.get(delivery.id);

      expect(updated?.status).toBe('failed');
      expect(updated?.failed_at).not.toBeNull();
      expect(updated?.failure_reason).toBe(failureReason);
    });

    it('should handle bounced status', async () => {
      const delivery = await recordEmailDelivery(
        testUserId,
        testCompanyId,
        'test@example.com',
        'Test Subject',
        new Date(),
        'hash123'
      );

      await updateEmailDeliveryStatus(delivery.id, 'bounced', 'Mailbox full');

      const updated = await db.emailDelivery.get(delivery.id);

      expect(updated?.status).toBe('bounced');
      expect(updated?.failed_at).not.toBeNull();
      expect(updated?.failure_reason).toBe('Mailbox full');
    });
  });

  describe('getRecentEmailDeliveries', () => {
    it('should return recent deliveries', async () => {
      // Create multiple deliveries
      for (let i = 0; i < 5; i++) {
        await recordEmailDelivery(
          testUserId,
          testCompanyId,
          'test@example.com',
          `Test Subject ${i}`,
          new Date(),
          `hash${i}`
        );
      }

      const deliveries = await getRecentEmailDeliveries(testUserId);

      expect(deliveries).toHaveLength(5);
      expect(deliveries[0].user_id).toBe(testUserId);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 15; i++) {
        await recordEmailDelivery(
          testUserId,
          testCompanyId,
          'test@example.com',
          `Test Subject ${i}`,
          new Date(),
          `hash${i}`
        );
      }

      const deliveries = await getRecentEmailDeliveries(testUserId, 3);

      expect(deliveries).toHaveLength(3);
    });

    it('should not return soft-deleted deliveries', async () => {
      const delivery = await recordEmailDelivery(
        testUserId,
        testCompanyId,
        'test@example.com',
        'Test Subject',
        new Date(),
        'hash123'
      );

      // Soft delete
      await db.emailDelivery.update(delivery.id, { deleted_at: new Date() });

      const deliveries = await getRecentEmailDeliveries(testUserId);

      expect(deliveries).toHaveLength(0);
    });

    it('should return empty array if no deliveries exist', async () => {
      const deliveries = await getRecentEmailDeliveries(testUserId);

      expect(deliveries).toHaveLength(0);
    });
  });

  describe('isUserUnsubscribed', () => {
    it('should return false when user has not unsubscribed', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      const result = await isUserUnsubscribed(testUserId);

      expect(result).toBe(false);
    });

    it('should return true when user has unsubscribed', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);
      await unsubscribeFromEmails(testUserId);

      const result = await isUserUnsubscribed(testUserId);

      expect(result).toBe(true);
    });

    it('should return false when preferences do not exist', async () => {
      const result = await isUserUnsubscribed('nonexistent-user');

      expect(result).toBe(false); // Fail safe
    });
  });

  describe('deleteEmailPreferences', () => {
    it('should soft delete preferences', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      await deleteEmailPreferences(testUserId);

      const result = await getEmailPreferences(testUserId);

      expect(result).toBeNull();
    });

    it('should update metadata on deletion', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      await deleteEmailPreferences(testUserId);

      // Retrieve with raw query to see deleted record
      const deleted = await db.emailPreferences
        .where('user_id')
        .equals(testUserId)
        .first();

      expect(deleted?.deleted_at).not.toBeNull();
      expect(deleted?.last_modified_at).not.toBeNull();
    });

    it('should not throw error if preferences do not exist', async () => {
      await expect(deleteEmailPreferences('nonexistent-user')).resolves.not.toThrow();
    });
  });

  describe('CRDT version vector management', () => {
    it('should increment version vector on each update', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      // Make multiple updates
      for (let i = 0; i < 3; i++) {
        await updateEmailPreferences(testUserId, { maxTasksToShow: i + 5 });
      }

      const final = await getEmailPreferences(testUserId);
      const deviceId = Object.keys(final!.version_vector)[0];

      // Version should have incremented 3 times (plus initial creation)
      expect(final!.version_vector[deviceId]).toBeGreaterThan(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid successive updates', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      // Make rapid updates
      const updates = Array.from({ length: 10 }, (_, i) =>
        updateEmailPreferences(testUserId, { maxTasksToShow: i })
      );

      await Promise.all(updates);

      // Should complete without error
      const result = await getEmailPreferences(testUserId);
      expect(result).toBeDefined();
    });

    it('should handle different timezones', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      const timezones = [
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
      ];

      for (const timezone of timezones) {
        const result = await updateEmailPreferences(testUserId, { timezone });
        expect(result.timezone).toBe(timezone);
      }
    });

    it('should handle special characters in company name', async () => {
      const specialCompanyId = 'company-special-àéîôü-123';

      const result = await getOrCreateEmailPreferences(testUserId, specialCompanyId);

      expect(result.company_id).toBe(specialCompanyId);
    });
  });

  describe('Concurrent access', () => {
    it('should handle concurrent reads', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      const reads = Array.from({ length: 5 }, () => getEmailPreferences(testUserId));

      const results = await Promise.all(reads);

      // All reads should return the same data
      expect(results.every((r) => r?.id === results[0]?.id)).toBe(true);
    });

    it('should handle concurrent updates with CRDT', async () => {
      await getOrCreateEmailPreferences(testUserId, testCompanyId);

      // Simulate concurrent updates from different devices
      const updates = [
        updateEmailPreferences(testUserId, { maxTasksToShow: 5 }),
        updateEmailPreferences(testUserId, { enabled: false }),
        updateEmailPreferences(testUserId, { dayOfWeek: 'friday' }),
      ];

      await Promise.all(updates);

      // Should complete without errors
      const result = await getEmailPreferences(testUserId);
      expect(result).toBeDefined();
      expect(result?.version_vector).toBeDefined();
    });
  });
});
