/**
 * Email Queue Service
 *
 * Simple wrapper around EmailService for backward compatibility.
 * Provides a standalone queueEmail function for services that don't have
 * direct access to EmailService instance.
 */

import { EmailService } from './email.service';
import type { EmailProvider, EmailServiceConfig } from '../../types/ic4-email.types';

// Default email service configuration
// In production, this would be loaded from environment or user settings
const defaultConfig: EmailServiceConfig = {
  provider: 'resend' as EmailProvider,
  apiKey: process.env.VITE_EMAIL_API_KEY || '',
  fromEmail: process.env.VITE_EMAIL_FROM || 'noreply@gracefulbooks.com',
  fromName: 'Graceful Books',
  testMode: true,
  maxEmailsPerMinute: 10,
  maxEmailsPerHour: 100,
  defaultMaxRetries: 3,
  retryDelayMinutes: [1, 5, 15],
};

// Singleton instance
let emailServiceInstance: EmailService | null = null;

function _getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService(defaultConfig);
  }
  return emailServiceInstance;
}

/**
 * Queue an email for sending
 * Simplified interface for backward compatibility
 */
export async function queueEmail(params: {
  to: string;
  subject: string;
  html: string;
  plainText: string;
  template: string;
  variables: any;
}): Promise<void> {
  // TODO: In production, this should properly extract companyId and userId
  // from the context or session. For now, using placeholder values.
  // const emailService = getEmailService(); // Will be used when implementing actual email sending

  // For now, just log the email (since we don't have proper context)
  console.log('Email queued:', {
    to: params.to,
    subject: params.subject,
    template: params.template,
  });

  // In a real implementation, this would call:
  // await emailService.queueEmail({
  //   companyId: 'current-company-id',
  //   userId: 'current-user-id',
  //   recipientEmail: params.to,
  //   recipientName: params.to.split('@')[0],
  //   templateType: params.template as EmailTemplateType,
  //   variables: params.variables,
  // });
}
