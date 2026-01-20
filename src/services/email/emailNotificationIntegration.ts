/**
 * IC4: Email Notification Integration
 *
 * Integrates email service with multi-user notification system
 * Sends emails when certain in-app notifications are triggered
 */

import { logger } from '../../utils/logger';
import { emailService } from './email.service';
import { EmailTemplateType, EmailPriority } from '../../types/ic4-email.types';
import type { NotificationType } from '../multiUser/notification.service';

const log = logger.child('EmailNotificationIntegration');

/**
 * Map notification types to email templates
 */
const NOTIFICATION_TO_EMAIL_MAP: Partial<
  Record<NotificationType, EmailTemplateType>
> = {
  // These notification types don't have email templates yet
  // They would be added as new features are built
};

/**
 * Send email notification for a given notification type
 */
export async function sendEmailNotification(params: {
  companyId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  notificationType: NotificationType;
  variables: Record<string, string>;
}): Promise<void> {
  try {
    const emailTemplate = NOTIFICATION_TO_EMAIL_MAP[params.notificationType];

    if (!emailTemplate) {
      // Not all notifications trigger emails
      log.debug('No email template for notification type', {
        notificationType: params.notificationType,
      });
      return;
    }

    // Queue email for delivery
    await emailService.queueEmail({
      companyId: params.companyId,
      userId: params.userId,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      templateType: emailTemplate,
      variables: params.variables as any,
      priority: EmailPriority.NORMAL,
    });

    log.info('Email notification queued', {
      notificationType: params.notificationType,
      emailTemplate,
      recipientEmail: params.recipientEmail,
    });
  } catch (error) {
    log.error('Failed to queue email notification', {
      error,
      notificationType: params.notificationType,
    });
  }
}

/**
 * Send advisor invitation email (J7)
 */
export async function sendAdvisorInvitationEmail(params: {
  companyId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  clientFirstName: string;
  advisorName: string;
  advisorFirm: string;
  invitationUrl: string;
}): Promise<void> {
  try {
    await emailService.queueEmail({
      companyId: params.companyId,
      userId: params.userId,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      templateType: EmailTemplateType.ADVISOR_INVITATION,
      variables: {
        clientFirstName: params.clientFirstName,
        advisorName: params.advisorName,
        advisorFirm: params.advisorFirm,
        invitationUrl: params.invitationUrl,
      },
      priority: EmailPriority.HIGH,
    });

    log.info('Advisor invitation email queued', {
      recipientEmail: params.recipientEmail,
      advisorName: params.advisorName,
    });
  } catch (error) {
    log.error('Failed to send advisor invitation email', { error, params });
  }
}

/**
 * Send client billing transfer notification (J7)
 */
export async function sendClientBillingTransferEmail(params: {
  companyId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  clientFirstName: string;
  advisorName: string;
  accountUrl: string;
  advisorEmail: string;
}): Promise<void> {
  try {
    await emailService.queueEmail({
      companyId: params.companyId,
      userId: params.userId,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      templateType: EmailTemplateType.CLIENT_BILLING_TRANSFER,
      variables: {
        clientFirstName: params.clientFirstName,
        advisorName: params.advisorName,
        accountUrl: params.accountUrl,
        advisorEmail: params.advisorEmail,
      },
      priority: EmailPriority.NORMAL,
    });

    log.info('Client billing transfer email queued', {
      recipientEmail: params.recipientEmail,
    });
  } catch (error) {
    log.error('Failed to send billing transfer email', { error, params });
  }
}

/**
 * Send advisor removed client notification (J7)
 */
export async function sendAdvisorRemovedClientEmail(params: {
  companyId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  clientFirstName: string;
  advisorName: string;
  billingChoiceUrl: string;
}): Promise<void> {
  try {
    await emailService.queueEmail({
      companyId: params.companyId,
      userId: params.userId,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      templateType: EmailTemplateType.ADVISOR_REMOVED_CLIENT,
      variables: {
        clientFirstName: params.clientFirstName,
        advisorName: params.advisorName,
        billingChoiceUrl: params.billingChoiceUrl,
      },
      priority: EmailPriority.HIGH,
    });

    log.info('Advisor removed client email queued', {
      recipientEmail: params.recipientEmail,
    });
  } catch (error) {
    log.error('Failed to send advisor removed email', { error, params });
  }
}

/**
 * Send scenario pushed notification (J3 + J7)
 */
export async function sendScenarioPushedEmail(params: {
  companyId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  clientFirstName: string;
  advisorName: string;
  scenarioName: string;
  advisorNote: string;
  scenarioUrl: string;
}): Promise<void> {
  try {
    await emailService.queueEmail({
      companyId: params.companyId,
      userId: params.userId,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      templateType: EmailTemplateType.SCENARIO_PUSHED,
      variables: {
        clientFirstName: params.clientFirstName,
        advisorName: params.advisorName,
        scenarioName: params.scenarioName,
        advisorNote: params.advisorNote,
        scenarioUrl: params.scenarioUrl,
      },
      priority: EmailPriority.NORMAL,
    });

    log.info('Scenario pushed email queued', {
      recipientEmail: params.recipientEmail,
      scenarioName: params.scenarioName,
    });
  } catch (error) {
    log.error('Failed to send scenario pushed email', { error, params });
  }
}

/**
 * Send tax season access granted notification (J8)
 */
export async function sendTaxSeasonAccessEmail(params: {
  companyId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  clientFirstName: string;
  advisorName: string;
  taxYear: string;
  accessExpiresDate: string;
  taxPrepUrl: string;
  advisorEmail: string;
}): Promise<void> {
  try {
    await emailService.queueEmail({
      companyId: params.companyId,
      userId: params.userId,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      templateType: EmailTemplateType.TAX_SEASON_ACCESS,
      variables: {
        clientFirstName: params.clientFirstName,
        advisorName: params.advisorName,
        taxYear: params.taxYear,
        accessExpiresDate: params.accessExpiresDate,
        taxPrepUrl: params.taxPrepUrl,
        advisorEmail: params.advisorEmail,
      },
      priority: EmailPriority.HIGH,
    });

    log.info('Tax season access email queued', {
      recipientEmail: params.recipientEmail,
      taxYear: params.taxYear,
    });
  } catch (error) {
    log.error('Failed to send tax season access email', { error, params });
  }
}

/**
 * Send tax prep completion notification (J8)
 */
export async function sendTaxPrepCompletionEmail(params: {
  companyId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  firstName: string;
  taxYear: string;
  downloadUrl: string;
}): Promise<void> {
  try {
    await emailService.queueEmail({
      companyId: params.companyId,
      userId: params.userId,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      templateType: EmailTemplateType.TAX_PREP_COMPLETION,
      variables: {
        firstName: params.firstName,
        taxYear: params.taxYear,
        downloadUrl: params.downloadUrl,
      },
      priority: EmailPriority.NORMAL,
    });

    log.info('Tax prep completion email queued', {
      recipientEmail: params.recipientEmail,
      taxYear: params.taxYear,
    });
  } catch (error) {
    log.error('Failed to send tax prep completion email', { error, params });
  }
}

/**
 * Send welcome email (onboarding)
 */
export async function sendWelcomeEmail(params: {
  companyId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  firstName: string;
  dashboardUrl: string;
  charityName: string;
}): Promise<void> {
  try {
    await emailService.queueEmail({
      companyId: params.companyId,
      userId: params.userId,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      templateType: EmailTemplateType.WELCOME,
      variables: {
        firstName: params.firstName,
        dashboardUrl: params.dashboardUrl,
        charityName: params.charityName,
      },
      priority: EmailPriority.HIGH,
    });

    log.info('Welcome email queued', {
      recipientEmail: params.recipientEmail,
    });
  } catch (error) {
    log.error('Failed to send welcome email', { error, params });
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(params: {
  companyId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  firstName: string;
  resetUrl: string;
}): Promise<void> {
  try {
    await emailService.queueEmail({
      companyId: params.companyId,
      userId: params.userId,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      templateType: EmailTemplateType.PASSWORD_RESET,
      variables: {
        firstName: params.firstName,
        resetUrl: params.resetUrl,
      },
      priority: EmailPriority.URGENT,
    });

    log.info('Password reset email queued', {
      recipientEmail: params.recipientEmail,
    });
  } catch (error) {
    log.error('Failed to send password reset email', { error, params });
  }
}

/**
 * Send email verification
 */
export async function sendEmailVerification(params: {
  companyId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  firstName: string;
  verificationUrl: string;
}): Promise<void> {
  try {
    await emailService.queueEmail({
      companyId: params.companyId,
      userId: params.userId,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      templateType: EmailTemplateType.EMAIL_VERIFICATION,
      variables: {
        firstName: params.firstName,
        verificationUrl: params.verificationUrl,
      },
      priority: EmailPriority.URGENT,
    });

    log.info('Email verification queued', {
      recipientEmail: params.recipientEmail,
    });
  } catch (error) {
    log.error('Failed to send email verification', { error, params });
  }
}
