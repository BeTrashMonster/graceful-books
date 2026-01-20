/**
 * IC4: Email Service Integration
 *
 * Core email service for sending notification-only emails
 * Supports Resend and SendGrid providers
 * NO financial data in emails (per security requirements)
 */

import { logger } from '../../utils/logger';
import { db } from '../../store/database';
import { generateId, getDeviceId } from '../../utils/device';
import { generateHLC } from '../../db/crdt';
import type {
  EmailTemplateType,
  EmailDeliveryStatus,
  EmailPriority,
  EmailServiceConfig,
  EmailSendResult,
  EmailProvider,
  EmailErrorCode,
  EmailTemplateVariables,
  EmailContent,
  EmailServiceError,
} from '../../types/ic4-email.types';
import { EmailDeliveryStatus as StatusEnum, EmailErrorCode as ErrorCodeEnum } from '../../types/ic4-email.types';

const log = logger.child('EmailService');

/**
 * Email service class
 */
export class EmailService {
  private config: EmailServiceConfig;

  constructor(config: EmailServiceConfig) {
    this.config = config;
  }

  /**
   * Send an email using the configured provider
   */
  async sendEmail(params: {
    companyId: string;
    userId: string;
    recipientEmail: string;
    recipientName: string;
    templateType: EmailTemplateType;
    variables: EmailTemplateVariables;
    priority?: EmailPriority;
  }): Promise<EmailSendResult> {
    try {
      // Validate email address
      if (!this.isValidEmail(params.recipientEmail)) {
        return {
          success: false,
          error: {
            code: ErrorCodeEnum.INVALID_EMAIL,
            message: `Invalid email address: ${params.recipientEmail}`,
            retryable: false,
          },
        };
      }

      // Check if user has unsubscribed
      const isUnsubscribed = await this.checkUnsubscribed(
        params.userId,
        params.templateType
      );
      if (isUnsubscribed) {
        log.info('User has unsubscribed from this email type', {
          userId: params.userId,
          templateType: params.templateType,
        });
        return {
          success: false,
          error: {
            code: ErrorCodeEnum.UNSUBSCRIBED,
            message: 'User has unsubscribed from this email type',
            retryable: false,
          },
        };
      }

      // Render email content
      const content = await this.renderTemplate(
        params.templateType,
        params.variables
      );

      if (!content) {
        return {
          success: false,
          error: {
            code: ErrorCodeEnum.INVALID_TEMPLATE,
            message: `Template not found: ${params.templateType}`,
            retryable: false,
          },
        };
      }

      // Send via provider
      const result = await this.sendViaProvider({
        recipientEmail: params.recipientEmail,
        recipientName: params.recipientName,
        subject: content.subject,
        htmlBody: content.html,
        plainTextBody: content.plainText,
      });

      // Log the email send
      await this.logEmail({
        companyId: params.companyId,
        userId: params.userId,
        templateType: params.templateType,
        recipientEmail: params.recipientEmail,
        subject: content.subject,
        status: result.success ? StatusEnum.SENT : StatusEnum.FAILED,
        providerMessageId: result.messageId || null,
        errorMessage: result.error?.message || null,
      });

      return result;
    } catch (error) {
      log.error('Failed to send email', { error, params });
      return {
        success: false,
        error: {
          code: ErrorCodeEnum.UNKNOWN_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
        },
      };
    }
  }

  /**
   * Queue an email for delivery (with retry support)
   */
  async queueEmail(params: {
    companyId: string;
    userId: string;
    recipientEmail: string;
    recipientName: string;
    templateType: EmailTemplateType;
    variables: EmailTemplateVariables;
    priority?: EmailPriority;
    scheduledAt?: Date;
  }): Promise<string> {
    const now = Date.now();
    const deviceId = getDeviceId();
    const queueId = generateId();

    await db.emailQueue.add({
      id: queueId,
      companyId: params.companyId,
      userId: params.userId,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      templateType: params.templateType,
      variables: JSON.stringify(params.variables),
      status: StatusEnum.QUEUED,
      priority: params.priority || 'NORMAL',
      scheduledAt: params.scheduledAt ? params.scheduledAt.getTime() : now,
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
      retryCount: 0,
      maxRetries: this.config.defaultMaxRetries,
      lastRetryAt: null,
      nextRetryAt: null,
      errorMessage: null,
      providerMessageId: null,
      createdAt: now,
      updatedAt: now,
      _hlc: generateHLC(),
      _deviceId: deviceId,
      _version: 1,
      _deleted: false,
    });

    log.info('Email queued', {
      queueId,
      templateType: params.templateType,
      recipientEmail: params.recipientEmail,
    });

    return queueId;
  }

  /**
   * Render an email template with variables
   */
  private async renderTemplate(
    templateType: EmailTemplateType,
    variables: EmailTemplateVariables
  ): Promise<EmailContent | null> {
    // Import template renderer
    const { renderTemplate } = await import('./templateRenderer');
    return renderTemplate(templateType, variables);
  }

  /**
   * Send email via provider (Resend or SendGrid)
   */
  private async sendViaProvider(params: {
    recipientEmail: string;
    recipientName: string;
    subject: string;
    htmlBody: string;
    plainTextBody: string;
  }): Promise<EmailSendResult> {
    if (this.config.testMode) {
      // Test mode: Log but don't actually send
      log.info('TEST MODE: Email would be sent', {
        to: params.recipientEmail,
        subject: params.subject,
      });
      return {
        success: true,
        messageId: `test-${Date.now()}`,
      };
    }

    try {
      switch (this.config.provider) {
        case 'RESEND':
          return await this.sendViaResend(params);
        case 'SENDGRID':
          return await this.sendViaSendGrid(params);
        default:
          throw new Error(`Unknown provider: ${this.config.provider}`);
      }
    } catch (error) {
      log.error('Provider send failed', { error, params });
      return {
        success: false,
        error: {
          code: ErrorCodeEnum.PROVIDER_ERROR,
          message: error instanceof Error ? error.message : 'Provider error',
          retryable: true,
        },
      };
    }
  }

  /**
   * Send via Resend
   */
  private async sendViaResend(params: {
    recipientEmail: string;
    recipientName: string;
    subject: string;
    htmlBody: string;
    plainTextBody: string;
  }): Promise<EmailSendResult> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        from: `${this.config.fromName} <${this.config.fromEmail}>`,
        to: [params.recipientEmail],
        subject: params.subject,
        html: params.htmlBody,
        text: params.plainTextBody,
        reply_to: this.config.replyToEmail,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Resend API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.id,
    };
  }

  /**
   * Send via SendGrid
   */
  private async sendViaSendGrid(params: {
    recipientEmail: string;
    recipientName: string;
    subject: string;
    htmlBody: string;
    plainTextBody: string;
  }): Promise<EmailSendResult> {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [
              {
                email: params.recipientEmail,
                name: params.recipientName,
              },
            ],
          },
        ],
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName,
        },
        reply_to: this.config.replyToEmail
          ? {
              email: this.config.replyToEmail,
            }
          : undefined,
        subject: params.subject,
        content: [
          {
            type: 'text/plain',
            value: params.plainTextBody,
          },
          {
            type: 'text/html',
            value: params.htmlBody,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid API error: ${error}`);
    }

    // SendGrid returns message ID in X-Message-Id header
    const messageId = response.headers.get('X-Message-Id') || `sg-${Date.now()}`;

    return {
      success: true,
      messageId,
    };
  }

  /**
   * Check if user has unsubscribed from a template type
   */
  private async checkUnsubscribed(
    userId: string,
    templateType: EmailTemplateType
  ): Promise<boolean> {
    const prefs = await db.emailNotificationPreferences
      .where('userId')
      .equals(userId)
      .first();

    if (!prefs) {
      return false; // No preferences = all emails enabled
    }

    // Check global unsubscribe
    if (prefs.unsubscribedAt) {
      return true;
    }

    // Check per-template preferences
    // Critical emails cannot be unsubscribed
    const criticalTemplates = [
      'WELCOME',
      'PASSWORD_RESET',
      'EMAIL_VERIFICATION',
    ];
    if (criticalTemplates.includes(templateType)) {
      return false;
    }

    // Map template types to preference flags
    const prefMap: Record<string, keyof typeof prefs> = {
      ADVISOR_INVITATION: 'advisorInvitation',
      CLIENT_BILLING_TRANSFER: 'clientBillingTransfer',
      ADVISOR_REMOVED_CLIENT: 'advisorRemovedClient',
      SCENARIO_PUSHED: 'scenarioPushed',
      TAX_SEASON_ACCESS: 'taxSeasonAccess',
      TAX_PREP_COMPLETION: 'taxPrepCompletion',
    };

    const prefKey = prefMap[templateType];
    if (prefKey && prefs[prefKey] === false) {
      return true;
    }

    return false;
  }

  /**
   * Log email send to database
   */
  private async logEmail(params: {
    companyId: string;
    userId: string;
    templateType: EmailTemplateType;
    recipientEmail: string;
    subject: string;
    status: EmailDeliveryStatus;
    providerMessageId: string | null;
    errorMessage: string | null;
  }): Promise<void> {
    const now = Date.now();
    const deviceId = getDeviceId();

    await db.emailLogs.add({
      id: generateId(),
      companyId: params.companyId,
      userId: params.userId,
      templateType: params.templateType,
      recipientEmail: params.recipientEmail,
      subject: params.subject,
      status: params.status,
      sentAt: params.status === StatusEnum.SENT ? now : null,
      deliveredAt: null,
      openedAt: null,
      clickedAt: null,
      bouncedAt: null,
      failedAt: params.status === StatusEnum.FAILED ? now : null,
      providerMessageId: params.providerMessageId,
      providerResponse: null,
      errorMessage: params.errorMessage,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
      _hlc: generateHLC(),
      _deviceId: deviceId,
      _version: 1,
      _deleted: false,
    });
  }

  /**
   * Validate email address
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * Create email service instance from environment variables
 */
export function createEmailService(): EmailService {
  const provider = (import.meta.env.VITE_EMAIL_PROVIDER || 'TEST') as EmailProvider;
  const apiKey = import.meta.env.VITE_EMAIL_API_KEY || '';
  const fromEmail = import.meta.env.VITE_EMAIL_FROM || 'noreply@gracefulbooks.com';
  const fromName = import.meta.env.VITE_EMAIL_FROM_NAME || 'Graceful Books';
  const replyToEmail = import.meta.env.VITE_EMAIL_REPLY_TO || 'support@gracefulbooks.com';
  const testMode = import.meta.env.VITE_EMAIL_TEST_MODE === 'true';

  const config: EmailServiceConfig = {
    provider,
    apiKey,
    fromEmail,
    fromName,
    replyToEmail,
    testMode,
    maxEmailsPerMinute: 60,
    maxEmailsPerHour: 1000,
    defaultMaxRetries: 3,
    retryDelayMinutes: [1, 5, 15],
  };

  return new EmailService(config);
}

// Export singleton instance
export const emailService = createEmailService();
