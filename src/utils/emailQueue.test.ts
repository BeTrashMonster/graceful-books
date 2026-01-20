/**
 * Tests for Email Queue Processor
 *
 * Verifies queue processing, retry logic, and exponential backoff
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailQueueProcessor } from './emailQueue';
import { EmailDeliveryStatus, EmailPriority } from '../types/ic4-email.types';

// Mock database
const mockQueue = new Map();

vi.mock('../store/database', () => ({
  db: {
    emailQueue: {
      where: vi.fn((field) => ({
        anyOf: vi.fn((values) => ({
          filter: vi.fn((fn) => ({
            sortBy: vi.fn(async () => {
              const items = Array.from(mockQueue.values()).filter((item) =>
                values.includes(item.status)
              );
              return items.filter(fn);
            }),
          })),
        })),
        equals: vi.fn((value) => ({
          toArray: vi.fn(async () => {
            return Array.from(mockQueue.values()).filter(
              (item) => item[field] === value
            );
          }),
          filter: vi.fn((fn) => ({
            toArray: vi.fn(async () => {
              return Array.from(mockQueue.values())
                .filter((item) => item[field] === value)
                .filter(fn);
            }),
          })),
        })),
      })),
      toArray: vi.fn(async () => Array.from(mockQueue.values())),
      update: vi.fn(async (id, updates) => {
        const item = mockQueue.get(id);
        if (item) {
          mockQueue.set(id, { ...item, ...updates });
        }
      }),
      delete: vi.fn(async (id) => {
        mockQueue.delete(id);
      }),
    },
  },
}));

// Mock email service
vi.mock('../services/email/email.service', () => ({
  emailService: {
    sendEmail: vi.fn(async () => ({
      success: true,
      messageId: 'test-message-id',
    })),
  },
}));

describe('EmailQueueProcessor', () => {
  let processor: EmailQueueProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueue.clear();
    processor = new EmailQueueProcessor();
  });

  describe('Queue Processing', () => {
    it('should process queued emails', async () => {
      mockQueue.set('email-1', {
        id: 'email-1',
        status: EmailDeliveryStatus.QUEUED,
        scheduledAt: Date.now() - 1000,
        priority: EmailPriority.NORMAL,
        retryCount: 0,
        maxRetries: 3,
        variables: JSON.stringify({
          firstName: 'Test',
          dashboardUrl: 'https://app.gracefulbooks.com',
          charityName: 'Red Cross',
        }),
      });

      await processor['processQueue']();

      const email = mockQueue.get('email-1');
      expect(email.status).toBe(EmailDeliveryStatus.SENT);
      expect(email.sentAt).toBeTruthy();
    });

    it('should skip emails scheduled for future', async () => {
      mockQueue.set('email-1', {
        id: 'email-1',
        status: EmailDeliveryStatus.QUEUED,
        scheduledAt: Date.now() + 3600000, // 1 hour from now
        priority: EmailPriority.NORMAL,
        retryCount: 0,
      });

      await processor['processQueue']();

      const email = mockQueue.get('email-1');
      expect(email.status).toBe(EmailDeliveryStatus.QUEUED); // Should not have changed
    });
  });

  describe('Priority Handling', () => {
    it('should process urgent emails first', () => {
      const emails = [
        { id: '1', priority: EmailPriority.LOW },
        { id: '2', priority: EmailPriority.URGENT },
        { id: '3', priority: EmailPriority.NORMAL },
        { id: '4', priority: EmailPriority.HIGH },
      ];

      const sorted = processor['sortByPriority'](emails as any);

      expect(sorted[0].id).toBe('2'); // URGENT
      expect(sorted[1].id).toBe('4'); // HIGH
      expect(sorted[2].id).toBe('3'); // NORMAL
      expect(sorted[3].id).toBe('1'); // LOW
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed emails with exponential backoff', () => {
      const retry1 = processor['calculateNextRetry'](1);
      const retry2 = processor['calculateNextRetry'](2);
      const retry3 = processor['calculateNextRetry'](3);

      const now = Date.now();

      // First retry: 1 minute
      expect(retry1).toBeGreaterThan(now);
      expect(retry1).toBeLessThan(now + 90000); // Less than 1.5 minutes

      // Second retry: 5 minutes
      expect(retry2).toBeGreaterThan(now + 4 * 60 * 1000);
      expect(retry2).toBeLessThan(now + 6 * 60 * 1000);

      // Third retry: 15 minutes
      expect(retry3).toBeGreaterThan(now + 14 * 60 * 1000);
      expect(retry3).toBeLessThan(now + 16 * 60 * 1000);
    });

    it('should not exceed max retries', async () => {
      const { emailService } = await import('../services/email/email.service');
      (emailService.sendEmail as any).mockResolvedValue({
        success: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: 'Provider error',
          retryable: true,
        },
      });

      mockQueue.set('email-1', {
        id: 'email-1',
        status: EmailDeliveryStatus.FAILED,
        scheduledAt: Date.now(),
        nextRetryAt: Date.now() - 1000,
        priority: EmailPriority.NORMAL,
        retryCount: 3,
        maxRetries: 3,
        variables: JSON.stringify({
          firstName: 'Test',
        }),
      });

      await processor['processQueue']();

      const email = mockQueue.get('email-1');
      expect(email.status).toBe(EmailDeliveryStatus.FAILED);
      expect(email.failedAt).toBeTruthy();
    });
  });

  describe('Queue Status', () => {
    it('should return accurate queue status', async () => {
      mockQueue.set('email-1', { status: EmailDeliveryStatus.QUEUED });
      mockQueue.set('email-2', { status: EmailDeliveryStatus.QUEUED });
      mockQueue.set('email-3', { status: EmailDeliveryStatus.SENDING });
      mockQueue.set('email-4', { status: EmailDeliveryStatus.FAILED });

      const status = await processor.getQueueStatus();

      expect(status.queued).toBe(2);
      expect(status.sending).toBe(1);
      expect(status.failed).toBe(1);
      expect(status.total).toBe(4);
    });
  });

  describe('Retry Failed Emails', () => {
    it('should reset nextRetryAt for failed emails', async () => {
      const now = Date.now();
      mockQueue.set('email-1', {
        id: 'email-1',
        status: EmailDeliveryStatus.FAILED,
        nextRetryAt: now + 3600000,
      });

      const count = await processor.retryFailedEmails();

      expect(count).toBe(1);
      const email = mockQueue.get('email-1');
      expect(email.nextRetryAt).toBeLessThanOrEqual(now + 1000);
    });
  });

  describe('Clear Old Emails', () => {
    it('should delete emails older than 30 days', async () => {
      const thirtyDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;

      mockQueue.set('email-1', {
        id: 'email-1',
        status: EmailDeliveryStatus.SENT,
        sentAt: thirtyDaysAgo,
      });
      mockQueue.set('email-2', {
        id: 'email-2',
        status: EmailDeliveryStatus.SENT,
        sentAt: Date.now(),
      });

      const count = await processor.clearOldEmails();

      expect(count).toBe(1);
      expect(mockQueue.has('email-1')).toBe(false);
      expect(mockQueue.has('email-2')).toBe(true);
    });

    it('should not delete failed or queued emails', async () => {
      const thirtyDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;

      mockQueue.set('email-1', {
        id: 'email-1',
        status: EmailDeliveryStatus.FAILED,
        createdAt: thirtyDaysAgo,
      });
      mockQueue.set('email-2', {
        id: 'email-2',
        status: EmailDeliveryStatus.QUEUED,
        createdAt: thirtyDaysAgo,
      });

      const count = await processor.clearOldEmails();

      expect(count).toBe(0);
      expect(mockQueue.size).toBe(2);
    });
  });

  describe('Start/Stop', () => {
    it('should start processing', () => {
      processor.start();
      expect(processor['isRunning']).toBe(true);
    });

    it('should stop processing', () => {
      processor.start();
      processor.stop();
      expect(processor['isRunning']).toBe(false);
    });

    it('should not start twice', () => {
      processor.start();
      const intervalId1 = processor['intervalId'];
      processor.start();
      const intervalId2 = processor['intervalId'];
      expect(intervalId1).toBe(intervalId2);
      processor.stop();
    });
  });
});
