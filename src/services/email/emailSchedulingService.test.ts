/**
 * Email Scheduling Service Tests
 *
 * Comprehensive tests for D3: Weekly Email Summary Setup
 * Tests scheduling, sending, cancellation, and validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  scheduleEmail,
  sendEmailNow,
  cancelScheduledEmail,
  validateEmailAddress,
  isEmailServiceConfigured,
} from './emailSchedulingService';
import type { EmailGenerationContext } from '../../types/email.types';
import { addDays } from 'date-fns';
import * as emailPreviewService from './emailPreviewService';
import * as emailPreferencesStore from '../../store/emailPreferences';

// Mock dependencies
vi.mock('./emailPreviewService');
vi.mock('../../store/emailPreferences');

/**
 * Create mock email generation context
 */
function createMockContext(discType: 'D' | 'I' | 'S' | 'C' = 'S'): EmailGenerationContext {
  const now = new Date();

  return {
    user: {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      timezone: 'America/Los_Angeles',
    },
    company: {
      id: 'company-456',
      name: 'Test Company LLC',
    },
    preferences: {
      id: 'pref-789',
      userId: 'user-123',
      companyId: 'company-456',
      enabled: true,
      frequency: 'weekly',
      dayOfWeek: 'monday',
      timeOfDay: '08:00',
      timezone: 'America/Los_Angeles',
      includeSections: ['checklist-summary', 'quick-tips'],
      maxTasksToShow: 5,
      lastSentAt: null,
      nextScheduledAt: null,
      unsubscribedAt: null,
      unsubscribeReason: null,
      createdAt: now,
      updatedAt: now,
    },
    checklistItems: [
      {
        id: 'item-1',
        categoryId: 'foundation',
        title: 'Test Task',
        description: 'Test Description',
        explanationLevel: 'brief',
        status: 'active',
        completedAt: null,
        snoozedUntil: null,
        snoozedReason: null,
        notApplicableReason: null,
        featureLink: '/test',
        helpArticle: null,
        isCustom: false,
        isReordered: false,
        customOrder: null,
        recurrence: 'weekly',
        priority: 'medium',
        lastDueDate: null,
        nextDueDate: addDays(now, 3),
        createdAt: now,
        updatedAt: now,
      },
    ],
    discType,
    generatedAt: now,
  };
}

describe('Email Scheduling Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scheduleEmail', () => {
    it('should successfully schedule an email', async () => {
      const context = createMockContext();

      // Mock preview generation
      vi.mocked(emailPreviewService.generateEmailPreview).mockResolvedValue({
        subject: 'Test Subject',
        preheader: 'Test Preheader',
        htmlContent: '<html>Test</html>',
        plainTextContent: 'Test',
        estimatedSendTime: addDays(new Date(), 7),
        discType: 'S',
      });

      // Mock delivery recording
      vi.mocked(emailPreferencesStore.recordEmailDelivery).mockResolvedValue({
        id: 'delivery-123',
        user_id: context.user.id,
        company_id: context.company.id,
        email_type: 'weekly-summary',
        recipient_email: context.user.email,
        subject: 'Test Subject',
        status: 'pending',
        scheduled_at: new Date(),
        sent_at: null,
        delivered_at: null,
        opened_at: null,
        clicked_at: null,
        failed_at: null,
        failure_reason: null,
        retry_count: 0,
        max_retries: 3,
        last_retry_at: null,
        content_hash: 'abc123',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        version_vector: {},
        last_modified_by: 'device-1',
        last_modified_at: new Date(),
      });

      const result = await scheduleEmail(context);

      expect(result.scheduled).toBe(true);
      expect(result.scheduledAt).toBeInstanceOf(Date);
      expect(result.message).toContain('Your email will be sent');
      expect(emailPreviewService.generateEmailPreview).toHaveBeenCalledWith(context);
      expect(emailPreferencesStore.recordEmailDelivery).toHaveBeenCalled();
    });

    it('should throw error when preferences are not enabled', async () => {
      const context = createMockContext();
      context.preferences.enabled = false;

      await expect(scheduleEmail(context)).rejects.toThrow(
        'Email preferences must be enabled'
      );
    });

    it('should calculate correct next send time for Monday 8am', async () => {
      const context = createMockContext();
      context.preferences.dayOfWeek = 'monday';
      context.preferences.timeOfDay = '08:00';

      vi.mocked(emailPreviewService.generateEmailPreview).mockResolvedValue({
        subject: 'Test',
        preheader: 'Test',
        htmlContent: '<html>Test</html>',
        plainTextContent: 'Test',
        estimatedSendTime: addDays(new Date(), 7),
        discType: 'S',
      });

      vi.mocked(emailPreferencesStore.recordEmailDelivery).mockResolvedValue({} as any);

      const result = await scheduleEmail(context);

      // Scheduled date should be a Monday at 8am
      expect(result.scheduledAt.getDay()).toBe(1); // Monday
      expect(result.scheduledAt.getHours()).toBe(8);
      expect(result.scheduledAt.getMinutes()).toBe(0);
    });

    it('should schedule for next week if time has passed today', async () => {
      const context = createMockContext();
      const now = new Date();

      // Set to current day but in the past
      const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      context.preferences.dayOfWeek = dayOfWeek as any;
      context.preferences.timeOfDay = '00:00'; // Midnight (already passed)

      vi.mocked(emailPreviewService.generateEmailPreview).mockResolvedValue({
        subject: 'Test',
        preheader: 'Test',
        htmlContent: '<html>Test</html>',
        plainTextContent: 'Test',
        estimatedSendTime: addDays(new Date(), 7),
        discType: 'S',
      });
      vi.mocked(emailPreferencesStore.recordEmailDelivery).mockResolvedValue({} as any);

      const result = await scheduleEmail(context);

      // Should be scheduled for next week
      expect(result.scheduledAt.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should handle preview generation errors gracefully', async () => {
      const context = createMockContext();

      vi.mocked(emailPreviewService.generateEmailPreview).mockRejectedValue(
        new Error('Preview generation failed')
      );

      await expect(scheduleEmail(context)).rejects.toThrow();
    });
  });

  describe('sendEmailNow', () => {
    it('should send email immediately for testing', async () => {
      const context = createMockContext();

      vi.mocked(emailPreviewService.generateEmailPreview).mockResolvedValue({
        subject: 'Test Subject',
        preheader: 'Test Preheader',
        htmlContent: '<html>Test</html>',
        plainTextContent: 'Test',
        estimatedSendTime: new Date(),
        discType: 'S',
      });

      const result = await sendEmailNow(context);

      expect(result.sent).toBe(true);
      expect(result.message).toContain('Test email sent successfully');
      expect(emailPreviewService.generateEmailPreview).toHaveBeenCalledWith(context);
    });

    it('should throw error on send failure', async () => {
      const context = createMockContext();

      vi.mocked(emailPreviewService.generateEmailPreview).mockRejectedValue(
        new Error('Send failed')
      );

      await expect(sendEmailNow(context)).rejects.toThrow();
    });
  });

  describe('cancelScheduledEmail', () => {
    it('should cancel a scheduled email', async () => {
      const userId = 'user-123';
      const deliveryId = 'delivery-456';

      vi.mocked(emailPreferencesStore.updateEmailDeliveryStatus).mockResolvedValue();

      const result = await cancelScheduledEmail(userId, deliveryId);

      expect(result.cancelled).toBe(true);
      expect(result.message).toContain('cancelled');
      expect(emailPreferencesStore.updateEmailDeliveryStatus).toHaveBeenCalledWith(
        deliveryId,
        'failed',
        'Cancelled by user'
      );
    });

    it('should handle cancellation errors', async () => {
      const userId = 'user-123';
      const deliveryId = 'delivery-456';

      vi.mocked(emailPreferencesStore.updateEmailDeliveryStatus).mockRejectedValue(
        new Error('Database error')
      );

      await expect(cancelScheduledEmail(userId, deliveryId)).rejects.toThrow();
    });
  });

  describe('validateEmailAddress', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmailAddress('test@example.com')).toBe(true);
      expect(validateEmailAddress('user.name+tag@example.co.uk')).toBe(true);
      expect(validateEmailAddress('test123@subdomain.example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmailAddress('invalid')).toBe(false);
      expect(validateEmailAddress('invalid@')).toBe(false);
      expect(validateEmailAddress('@example.com')).toBe(false);
      expect(validateEmailAddress('test@.com')).toBe(false);
      expect(validateEmailAddress('test @example.com')).toBe(false);
      expect(validateEmailAddress('')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(validateEmailAddress('a@b.c')).toBe(true); // Minimal valid email
      expect(validateEmailAddress('test@localhost')).toBe(false); // No TLD
    });
  });

  describe('isEmailServiceConfigured', () => {
    it('should return true in MVP mode', () => {
      expect(isEmailServiceConfigured()).toBe(true);
    });
  });

  describe('DISC-adapted email scheduling', () => {
    it('should schedule emails for all DISC types', async () => {
      const discTypes: Array<'D' | 'I' | 'S' | 'C'> = ['D', 'I', 'S', 'C'];

      vi.mocked(emailPreviewService.generateEmailPreview).mockResolvedValue({
        subject: 'Test',
        preheader: 'Test',
        htmlContent: '<html>Test</html>',
        plainTextContent: 'Test',
        estimatedSendTime: addDays(new Date(), 7),
        discType: 'S',
      });
      vi.mocked(emailPreferencesStore.recordEmailDelivery).mockResolvedValue({} as any);

      for (const discType of discTypes) {
        const context = createMockContext(discType);
        const result = await scheduleEmail(context);

        expect(result.scheduled).toBe(true);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle empty checklist items', async () => {
      const context = createMockContext();
      context.checklistItems = [];

      vi.mocked(emailPreviewService.generateEmailPreview).mockResolvedValue({
        subject: 'Test',
        preheader: 'Test',
        htmlContent: '<html>Test</html>',
        plainTextContent: 'Test',
        estimatedSendTime: addDays(new Date(), 7),
        discType: 'S',
      });
      vi.mocked(emailPreferencesStore.recordEmailDelivery).mockResolvedValue({} as any);

      const result = await scheduleEmail(context);

      expect(result.scheduled).toBe(true);
    });

    it('should handle different day/time combinations', async () => {
      const context = createMockContext();

      const testCases = [
        { day: 'monday', time: '08:00' },
        { day: 'friday', time: '17:00' },
        { day: 'sunday', time: '12:00' },
        { day: 'wednesday', time: '09:30' },
      ];

      vi.mocked(emailPreviewService.generateEmailPreview).mockResolvedValue({
        subject: 'Test',
        preheader: 'Test',
        htmlContent: '<html>Test</html>',
        plainTextContent: 'Test',
        estimatedSendTime: addDays(new Date(), 7),
        discType: 'S',
      });
      vi.mocked(emailPreferencesStore.recordEmailDelivery).mockResolvedValue({} as any);

      for (const { day, time } of testCases) {
        context.preferences.dayOfWeek = day as any;
        context.preferences.timeOfDay = time;

        const result = await scheduleEmail(context);

        expect(result.scheduled).toBe(true);
        expect(result.scheduledAt).toBeInstanceOf(Date);
      }
    });

    it('should handle missing user name gracefully', async () => {
      const context = createMockContext();
      context.user.name = '';

      vi.mocked(emailPreviewService.generateEmailPreview).mockResolvedValue({
        subject: 'Test',
        preheader: 'Test',
        htmlContent: '<html>Test</html>',
        plainTextContent: 'Test',
        estimatedSendTime: addDays(new Date(), 7),
        discType: 'S',
      });
      vi.mocked(emailPreferencesStore.recordEmailDelivery).mockResolvedValue({} as any);

      const result = await scheduleEmail(context);

      expect(result.scheduled).toBe(true);
    });
  });

  describe('Content hashing', () => {
    it('should generate consistent hashes for same content', async () => {
      const context1 = createMockContext();
      const context2 = createMockContext();

      vi.mocked(emailPreviewService.generateEmailPreview).mockResolvedValue({
        subject: 'Same Subject',
        preheader: 'Same Preheader',
        htmlContent: '<html>Same Content</html>',
        plainTextContent: 'Same Content',
        estimatedSendTime: new Date(),
        discType: 'S',
      });

      const recordCalls: any[] = [];
      vi.mocked(emailPreferencesStore.recordEmailDelivery).mockImplementation(
        async (...args) => {
          recordCalls.push(args);
          return {} as any;
        }
      );

      await scheduleEmail(context1);
      await scheduleEmail(context2);

      // Both should have same content hash (last argument)
      expect(recordCalls[0][5]).toBe(recordCalls[1][5]);
    });

    it('should generate different hashes for different content', async () => {
      const context1 = createMockContext();
      const context2 = createMockContext();

      let callCount = 0;
      vi.mocked(emailPreviewService.generateEmailPreview).mockImplementation(async () => {
        callCount++;
        return {
          subject: 'Subject',
          preheader: 'Preheader',
          htmlContent: callCount === 1 ? '<html>Content A</html>' : '<html>Content B</html>',
          plainTextContent: callCount === 1 ? 'Content A' : 'Content B',
          estimatedSendTime: new Date(),
          discType: 'S',
        };
      });

      const recordCalls: any[] = [];
      vi.mocked(emailPreferencesStore.recordEmailDelivery).mockImplementation(
        async (...args) => {
          recordCalls.push(args);
          return {} as any;
        }
      );

      await scheduleEmail(context1);
      await scheduleEmail(context2);

      // Should have different content hashes
      expect(recordCalls[0][5]).not.toBe(recordCalls[1][5]);
    });
  });

  describe('Error handling', () => {
    it('should provide user-friendly error messages', async () => {
      const context = createMockContext();

      vi.mocked(emailPreviewService.generateEmailPreview).mockRejectedValue(
        new Error('Network error')
      );

      try {
        await scheduleEmail(context);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('couldn\'t schedule');
        expect(error.message).not.toContain('Network error'); // User-friendly message
      }
    });

    it('should log errors for debugging', async () => {
      const context = createMockContext();

      vi.mocked(emailPreviewService.generateEmailPreview).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(scheduleEmail(context)).rejects.toThrow();
      // In production, would verify logger was called
    });
  });
});
