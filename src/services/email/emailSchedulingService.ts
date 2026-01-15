/**
 * Email Scheduling Service
 *
 * Per D3: Weekly Email Summary Setup
 * Handles scheduling and sending of weekly email summaries.
 *
 * NOTE: This is a mocked implementation for MVP.
 * In production, this would integrate with a backend service (AWS SES, SendGrid, etc.)
 */

import type { EmailGenerationContext, EmailPreview } from '../../types/email.types';
import { generateEmailPreview } from './emailPreviewService';
import { recordEmailDelivery, updateEmailDeliveryStatus } from '../../store/emailPreferences';
import { logger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/errors';

const scheduleLogger = logger.child('EmailScheduling');

/**
 * Schedule email for delivery
 * Returns a promise that resolves when the email is scheduled (not sent)
 */
export async function scheduleEmail(
  context: EmailGenerationContext
): Promise<{ scheduled: boolean; scheduledAt: Date; message: string }> {
  try {
    const { user, company, preferences } = context;

    // Validate preferences
    if (!preferences.enabled) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Email preferences must be enabled to schedule emails',
        { userId: user.id }
      );
    }

    // Calculate next send time
    const scheduledAt = calculateNextSendTime(
      preferences.dayOfWeek,
      preferences.timeOfDay
    );

    // Generate preview to validate content
    const preview = await generateEmailPreview(context);

    // Calculate content hash for deduplication
    const contentHash = await hashContent(preview.htmlContent);

    // Record delivery intent in database
    await recordEmailDelivery(
      user.id,
      company.id,
      user.email,
      preview.subject,
      scheduledAt,
      contentHash
    );

    scheduleLogger.info('Email scheduled', {
      userId: user.id,
      scheduledAt,
      subject: preview.subject,
    });

    // MOCKED: In production, this would register with email service
    mockScheduleWithService(user.email, preview, scheduledAt);

    return {
      scheduled: true,
      scheduledAt,
      message: `Your email will be sent on ${scheduledAt.toLocaleDateString()} at ${scheduledAt.toLocaleTimeString()}.`,
    };
  } catch (error) {
    scheduleLogger.error('Failed to schedule email', { error, context });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      ErrorCode.UNKNOWN_ERROR,
      'We couldn\'t schedule your email. Please try again.',
      { context }
    );
  }
}

/**
 * Send email immediately (for testing/preview)
 * MOCKED: In production, this would call the email service API
 */
export async function sendEmailNow(
  context: EmailGenerationContext
): Promise<{ sent: boolean; message: string }> {
  try {
    const { user } = context;

    // Generate preview
    const preview = await generateEmailPreview(context);

    scheduleLogger.info('Sending email immediately', {
      userId: user.id,
      subject: preview.subject,
    });

    // MOCKED: In production, this would send via email service
    const mockResult = await mockSendEmail(user.email, preview);

    if (!mockResult.success) {
      throw new AppError(
        ErrorCode.UNKNOWN_ERROR,
        'Failed to send email',
        { userId: user.id }
      );
    }

    return {
      sent: true,
      message: 'Test email sent successfully! Check your inbox.',
    };
  } catch (error) {
    scheduleLogger.error('Failed to send email', { error, context });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      ErrorCode.UNKNOWN_ERROR,
      'We couldn\'t send your test email. Please try again.',
      { context }
    );
  }
}

/**
 * Cancel scheduled email
 * MOCKED: In production, this would cancel with email service
 */
export async function cancelScheduledEmail(
  userId: string,
  deliveryId: string
): Promise<{ cancelled: boolean; message: string }> {
  try {
    scheduleLogger.info('Cancelling scheduled email', { userId, deliveryId });

    // Update delivery record to mark as cancelled
    await updateEmailDeliveryStatus(deliveryId, 'failed', 'Cancelled by user');

    return {
      cancelled: true,
      message: 'Scheduled email has been cancelled.',
    };
  } catch (error) {
    scheduleLogger.error('Failed to cancel email', { error, userId, deliveryId });

    throw new AppError(
      ErrorCode.UNKNOWN_ERROR,
      'We couldn\'t cancel that email. Please try again.',
      { userId, deliveryId }
    );
  }
}

/**
 * Process pending email queue
 * This would be called by a cron job in production
 * MOCKED: For MVP, this is a placeholder
 */
export async function processPendingEmails(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  scheduleLogger.info('Processing pending email queue (MOCKED)');

  // In production:
  // 1. Query emailDelivery table for status='pending' and scheduled_at <= now
  // 2. For each pending email:
  //    - Generate content
  //    - Send via email service
  //    - Update status to 'sent' or 'failed'
  //    - Handle retries for failures
  // 3. Return statistics

  return {
    processed: 0,
    sent: 0,
    failed: 0,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate next send time based on day of week and time of day
 */
function calculateNextSendTime(dayOfWeek: string, timeOfDay: string): Date {
  const now = new Date();

  // Map day of week to date-fns day index
  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const targetDay = dayMap[dayOfWeek.toLowerCase()] || 1;

  // Parse time
  const [hours, minutes] = timeOfDay.split(':').map(Number);

  // Find next occurrence of target day
  const targetDate = new Date(now);
  while (targetDate.getDay() !== targetDay) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  // Set time
  targetDate.setHours(hours || 8, minutes || 0, 0, 0);

  // If the target time has passed today, move to next week
  if (targetDate <= now) {
    targetDate.setDate(targetDate.getDate() + 7);
  }

  return targetDate;
}

/**
 * Hash content for deduplication
 */
async function hashContent(content: string): Promise<string> {
  // Simple hash for now - in production, use crypto.subtle.digest
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// ============================================================================
// MOCKED Email Service Functions
// ============================================================================

/**
 * MOCKED: Schedule email with external service
 * In production, this would call SendGrid, AWS SES, etc.
 */
function mockScheduleWithService(
  recipientEmail: string,
  preview: EmailPreview,
  scheduledAt: Date
): void {
  scheduleLogger.debug('MOCKED: Scheduling with email service', {
    recipientEmail,
    subject: preview.subject,
    scheduledAt,
  });

  // In production:
  // - Call email service API to schedule send
  // - Store job ID for later cancellation
  // - Handle API errors and retries
}

/**
 * MOCKED: Send email via external service
 * In production, this would call SendGrid, AWS SES, etc.
 */
async function mockSendEmail(
  recipientEmail: string,
  preview: EmailPreview
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  scheduleLogger.debug('MOCKED: Sending email via service', {
    recipientEmail,
    subject: preview.subject,
  });

  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // In production:
  // - Call email service API (e.g., SendGrid's POST /mail/send)
  // - Handle authentication, rate limits, errors
  // - Return message ID for tracking
  // - Update delivery record with result

  // For MVP, always succeed
  return {
    success: true,
    messageId: `mock-${Date.now()}`,
  };
}

/**
 * Validate email address format
 */
export function validateEmailAddress(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if email service is configured
 * MOCKED: Always returns true for MVP
 */
export function isEmailServiceConfigured(): boolean {
  scheduleLogger.debug('MOCKED: Checking email service configuration');

  // In production, check for:
  // - API keys are set
  // - Service is reachable
  // - Sender domain is verified
  // - SPF/DKIM/DMARC are configured

  return true; // Always configured in MVP
}
