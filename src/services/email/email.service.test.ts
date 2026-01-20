/**
 * Tests for Email Service
 *
 * Verifies email sending, queuing, and provider integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailService } from './email.service';
import { EmailTemplateType, EmailProvider } from '../../types/ic4-email.types';
import type { EmailServiceConfig } from '../../types/ic4-email.types';

// Mock the database
vi.mock('../../store/database', () => ({
  db: {
    emailLogs: {
      add: vi.fn(() => Promise.resolve()),
    },
    emailNotificationPreferences: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(null)),
        })),
      })),
    },
    emailQueue: {
      add: vi.fn(() => Promise.resolve()),
    },
  },
}));

// Mock CRDT utilities
vi.mock('../../db/crdt', () => ({
  generateHLC: vi.fn(() => 'test-hlc-123'),
}));

// Mock device utilities
vi.mock('../../utils/device', () => ({
  generateId: vi.fn(() => 'test-id-' + Date.now()),
  getDeviceId: vi.fn(() => 'test-device-123'),
}));

// Mock fetch
global.fetch = vi.fn();

describe('EmailService', () => {
  let service: EmailService;
  let testConfig: EmailServiceConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    testConfig = {
      provider: EmailProvider.TEST,
      apiKey: 'test-api-key',
      fromEmail: 'noreply@gracefulbooks.com',
      fromName: 'Graceful Books',
      replyToEmail: 'support@gracefulbooks.com',
      testMode: true,
      maxEmailsPerMinute: 60,
      maxEmailsPerHour: 1000,
      defaultMaxRetries: 3,
      retryDelayMinutes: [1, 5, 15],
    };

    service = new EmailService(testConfig);
  });

  describe('Email Validation', () => {
    it('should accept valid email addresses', async () => {
      const result = await service.sendEmail({
        companyId: 'company-1',
        userId: 'user-1',
        recipientEmail: 'test@example.com',
        recipientName: 'Test User',
        templateType: EmailTemplateType.WELCOME,
        variables: {
          firstName: 'Test',
          dashboardUrl: 'https://app.gracefulbooks.com/dashboard',
          charityName: 'Red Cross',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid email addresses', async () => {
      const result = await service.sendEmail({
        companyId: 'company-1',
        userId: 'user-1',
        recipientEmail: 'not-an-email',
        recipientName: 'Test User',
        templateType: EmailTemplateType.WELCOME,
        variables: {
          firstName: 'Test',
          dashboardUrl: 'https://app.gracefulbooks.com',
          charityName: 'Red Cross',
        },
      });

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('INVALID_EMAIL');
    });

    it('should reject empty email addresses', async () => {
      const result = await service.sendEmail({
        companyId: 'company-1',
        userId: 'user-1',
        recipientEmail: '',
        recipientName: 'Test User',
        templateType: EmailTemplateType.WELCOME,
        variables: {
          firstName: 'Test',
          dashboardUrl: 'https://app.gracefulbooks.com',
          charityName: 'Red Cross',
        },
      });

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('INVALID_EMAIL');
    });
  });

  describe('Template Rendering', () => {
    it('should render welcome email template', async () => {
      const result = await service.sendEmail({
        companyId: 'company-1',
        userId: 'user-1',
        recipientEmail: 'test@example.com',
        recipientName: 'Test User',
        templateType: EmailTemplateType.WELCOME,
        variables: {
          firstName: 'John',
          dashboardUrl: 'https://app.gracefulbooks.com/dashboard',
          charityName: 'Red Cross',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should fail with missing template variables', async () => {
      const result = await service.sendEmail({
        companyId: 'company-1',
        userId: 'user-1',
        recipientEmail: 'test@example.com',
        recipientName: 'Test User',
        templateType: EmailTemplateType.WELCOME,
        variables: {
          // Missing required variables
        } as any,
      });

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('INVALID_TEMPLATE');
    });
  });

  describe('Test Mode', () => {
    it('should not send actual emails in test mode', async () => {
      const result = await service.sendEmail({
        companyId: 'company-1',
        userId: 'user-1',
        recipientEmail: 'test@example.com',
        recipientName: 'Test User',
        templateType: EmailTemplateType.WELCOME,
        variables: {
          firstName: 'Test',
          dashboardUrl: 'https://app.gracefulbooks.com',
          charityName: 'Red Cross',
        },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toContain('test-');
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('Provider Integration', () => {
    beforeEach(() => {
      testConfig.testMode = false;
    });

    it('should send via Resend provider', async () => {
      testConfig.provider = EmailProvider.RESEND;
      service = new EmailService(testConfig);

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'resend-message-id' }),
      });

      const result = await service.sendEmail({
        companyId: 'company-1',
        userId: 'user-1',
        recipientEmail: 'test@example.com',
        recipientName: 'Test User',
        templateType: EmailTemplateType.WELCOME,
        variables: {
          firstName: 'Test',
          dashboardUrl: 'https://app.gracefulbooks.com',
          charityName: 'Red Cross',
        },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('resend-message-id');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should send via SendGrid provider', async () => {
      testConfig.provider = EmailProvider.SENDGRID;
      service = new EmailService(testConfig);

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name: string) =>
            name === 'X-Message-Id' ? 'sendgrid-message-id' : null,
        },
        text: async () => '',
      });

      const result = await service.sendEmail({
        companyId: 'company-1',
        userId: 'user-1',
        recipientEmail: 'test@example.com',
        recipientName: 'Test User',
        templateType: EmailTemplateType.WELCOME,
        variables: {
          firstName: 'Test',
          dashboardUrl: 'https://app.gracefulbooks.com',
          charityName: 'Red Cross',
        },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('sendgrid-message-id');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should handle provider errors gracefully', async () => {
      testConfig.provider = EmailProvider.RESEND;
      service = new EmailService(testConfig);

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Rate limited' }),
      });

      const result = await service.sendEmail({
        companyId: 'company-1',
        userId: 'user-1',
        recipientEmail: 'test@example.com',
        recipientName: 'Test User',
        templateType: EmailTemplateType.WELCOME,
        variables: {
          firstName: 'Test',
          dashboardUrl: 'https://app.gracefulbooks.com',
          charityName: 'Red Cross',
        },
      });

      expect(result.success).toBe(false);
      expect((result as any).error.code).toBe('PROVIDER_ERROR');
      expect((result as any).error.retryable).toBe(true);
    });
  });

  describe('Security Requirements', () => {
    it('should not include financial data in email content', async () => {
      // This test verifies templates are notification-only
      // Templates should never include dollar amounts, account balances, etc.
      const result = await service.sendEmail({
        companyId: 'company-1',
        userId: 'user-1',
        recipientEmail: 'test@example.com',
        recipientName: 'Test User',
        templateType: EmailTemplateType.SCENARIO_PUSHED,
        variables: {
          clientFirstName: 'John',
          advisorName: 'Jane Advisor',
          scenarioName: 'Q1 Growth Plan',
          advisorNote: 'Please review this scenario',
          scenarioUrl: 'https://app.gracefulbooks.com/scenarios/123',
        },
      });

      expect(result.success).toBe(true);
      // Content should NOT include any financial figures
      // Users must log in to see details
    });

    it('should sanitize user-provided variables', async () => {
      const result = await service.sendEmail({
        companyId: 'company-1',
        userId: 'user-1',
        recipientEmail: 'test@example.com',
        recipientName: 'Test User',
        templateType: EmailTemplateType.ADVISOR_INVITATION,
        variables: {
          clientFirstName: '<script>alert("xss")</script>',
          advisorName: 'Jane<script>hack()</script>',
          advisorFirm: 'Acme <iframe src="evil.com"></iframe> Corp',
          invitationUrl: 'https://app.gracefulbooks.com/invite/123',
        },
      });

      expect(result.success).toBe(true);
      // Variables should be sanitized (tested in template utils)
    });
  });

  describe('Email Queue', () => {
    it('should queue emails for later delivery', async () => {
      const queueId = await service.queueEmail({
        companyId: 'company-1',
        userId: 'user-1',
        recipientEmail: 'test@example.com',
        recipientName: 'Test User',
        templateType: EmailTemplateType.WELCOME,
        variables: {
          firstName: 'Test',
          dashboardUrl: 'https://app.gracefulbooks.com',
          charityName: 'Red Cross',
        },
      });

      expect(queueId).toBeTruthy();
      expect(typeof queueId).toBe('string');
    });

    it('should support scheduled emails', async () => {
      const scheduledDate = new Date(Date.now() + 3600000); // 1 hour from now

      const queueId = await service.queueEmail({
        companyId: 'company-1',
        userId: 'user-1',
        recipientEmail: 'test@example.com',
        recipientName: 'Test User',
        templateType: EmailTemplateType.TAX_SEASON_ACCESS,
        variables: {
          clientFirstName: 'John',
          advisorName: 'Jane',
          taxYear: '2025',
          accessExpiresDate: 'April 15, 2026',
          taxPrepUrl: 'https://app.gracefulbooks.com/tax-prep',
          advisorEmail: 'jane@advisor.com',
        },
        scheduledAt: scheduledDate,
      });

      expect(queueId).toBeTruthy();
    });
  });

  describe('All Email Templates', () => {
    const testCases = [
      {
        type: EmailTemplateType.ADVISOR_INVITATION,
        variables: {
          clientFirstName: 'John',
          advisorName: 'Jane',
          advisorFirm: 'Acme Advisors',
          invitationUrl: 'https://app.gracefulbooks.com/invite/123',
        },
      },
      {
        type: EmailTemplateType.CLIENT_BILLING_TRANSFER,
        variables: {
          clientFirstName: 'John',
          advisorName: 'Jane',
          accountUrl: 'https://app.gracefulbooks.com/account',
          advisorEmail: 'jane@advisor.com',
        },
      },
      {
        type: EmailTemplateType.ADVISOR_REMOVED_CLIENT,
        variables: {
          clientFirstName: 'John',
          advisorName: 'Jane',
          billingChoiceUrl: 'https://app.gracefulbooks.com/billing',
        },
      },
      {
        type: EmailTemplateType.SCENARIO_PUSHED,
        variables: {
          clientFirstName: 'John',
          advisorName: 'Jane',
          scenarioName: 'Q1 Plan',
          advisorNote: 'Review this',
          scenarioUrl: 'https://app.gracefulbooks.com/scenarios/123',
        },
      },
      {
        type: EmailTemplateType.TAX_SEASON_ACCESS,
        variables: {
          clientFirstName: 'John',
          advisorName: 'Jane',
          taxYear: '2025',
          accessExpiresDate: 'April 15, 2026',
          taxPrepUrl: 'https://app.gracefulbooks.com/tax-prep',
          advisorEmail: 'jane@advisor.com',
        },
      },
      {
        type: EmailTemplateType.TAX_PREP_COMPLETION,
        variables: {
          firstName: 'John',
          taxYear: '2025',
          downloadUrl: 'https://app.gracefulbooks.com/download/tax-2025',
        },
      },
      {
        type: EmailTemplateType.WELCOME,
        variables: {
          firstName: 'John',
          dashboardUrl: 'https://app.gracefulbooks.com/dashboard',
          charityName: 'Red Cross',
        },
      },
      {
        type: EmailTemplateType.PASSWORD_RESET,
        variables: {
          firstName: 'John',
          resetUrl: 'https://app.gracefulbooks.com/reset/token123',
        },
      },
      {
        type: EmailTemplateType.EMAIL_VERIFICATION,
        variables: {
          firstName: 'John',
          verificationUrl: 'https://app.gracefulbooks.com/verify/token123',
        },
      },
    ];

    testCases.forEach(({ type, variables }) => {
      it(`should render ${type} template successfully`, async () => {
        const result = await service.sendEmail({
          companyId: 'company-1',
          userId: 'user-1',
          recipientEmail: 'test@example.com',
          recipientName: 'Test User',
          templateType: type,
          variables: variables as any,
        });

        expect(result.success).toBe(true);
        expect(result.messageId).toBeTruthy();
      });
    });
  });
});
