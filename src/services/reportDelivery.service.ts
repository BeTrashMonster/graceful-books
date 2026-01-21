/**
 * Report Delivery Service
 *
 * Per I6: Scheduled Report Delivery
 * Handles email delivery of scheduled reports with retry logic and tracking.
 *
 * Integrates with existing email infrastructure (D3).
 */

import { db } from '../db/database';
import { nanoid } from 'nanoid';
import { logger } from '../utils/logger';
import { AppError, ErrorCode } from '../utils/errors';
import type {
  ReportSchedule,
  ScheduledReportDelivery,
  ScheduledReportEmail,
  EmailAttachment,
  ScheduleResult,
} from '../types/scheduledReports.types';
import type { ScheduledReportDeliveryEntity , ReportScheduleEntity } from '../db/schema/scheduledReports.schema';
import { createDeliveryRecord } from '../db/schema/scheduledReports.schema';
import { exportReport, exportResultToBuffer, getExportMimeType } from './reports/reportExport.service';
import { format } from 'date-fns';

const deliveryLogger = logger.child('ReportDelivery');

// =============================================================================
// Delivery Execution
// =============================================================================

/**
 * Process pending scheduled report deliveries
 * This should be called by a background job/cron
 */
export async function processPendingDeliveries(
  companyId?: string
): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  try {
    const now = new Date();

    // Find all enabled schedules where next_run_at is in the past
    let query = db.reportSchedules
      .where('enabled')
      .equals(1)
      .and((schedule) => !schedule.deleted_at && schedule.next_run_at !== null && schedule.next_run_at <= now);

    if (companyId) {
      query = query.and((schedule) => schedule.company_id === companyId);
    }

    const dueSchedules = await query.toArray();

    deliveryLogger.info('Processing pending deliveries', { count: dueSchedules.length });

    let sent = 0;
    let failed = 0;

    for (const schedule of dueSchedules) {
      try {
        await executeScheduledDelivery(schedule);
        sent++;
      } catch (error) {
        deliveryLogger.error('Failed to execute scheduled delivery', { error, scheduleId: schedule.id });
        failed++;
      }
    }

    return {
      processed: dueSchedules.length,
      sent,
      failed,
    };
  } catch (error) {
    deliveryLogger.error('Failed to process pending deliveries', { error });
    return {
      processed: 0,
      sent: 0,
      failed: 0,
    };
  }
}

/**
 * Execute a scheduled report delivery
 */
async function executeScheduledDelivery(schedule: ReportScheduleEntity): Promise<void> {
  const deviceId = 'scheduler-service';

  try {
    deliveryLogger.info('Executing scheduled delivery', {
      scheduleId: schedule.id,
      reportType: schedule.report_type,
    });

    // 1. Generate the report data
    // For MVP, this is mocked - in production, this would call the appropriate report service
    const reportData = await generateReportData(schedule);

    // 2. Export to requested format
    const exportResult = await exportReport(
      schedule.report_type,
      reportData,
      schedule.format === 'json' ? 'csv' : schedule.format, // Convert json to csv for MVP
      {
        includeComparison: schedule.include_comparison,
        includeEducationalContent: schedule.include_educational_content,
      }
    );

    if (!exportResult.success || !exportResult.blob) {
      throw new AppError(
        ErrorCode.UNKNOWN_ERROR,
        'Report export failed',
        { scheduleId: schedule.id }
      );
    }

    // 3. Convert to email attachment
    const buffer = await exportResultToBuffer(exportResult);
    const attachment: EmailAttachment = {
      filename: exportResult.filename || `report.${schedule.format}`,
      content: buffer,
      contentType: getExportMimeType(schedule.format === 'json' ? 'csv' : schedule.format),
      size: buffer.length,
    };

    // 4. Generate email content
    const emailContent = generateReportEmail(schedule, attachment);

    // 5. Create delivery record
    const deliveryEntity = createDeliveryRecord(
      schedule.id,
      schedule.company_id,
      schedule.user_id,
      schedule.report_type,
      schedule.report_name,
      schedule.recipients,
      schedule.format,
      new Date(),
      emailContent.subject,
      emailContent.htmlBody,
      deviceId
    );

    const deliveryId = nanoid();
    await db.scheduledReportDeliveries.add({
      ...deliveryEntity,
      id: deliveryId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // 6. Send email (mocked for MVP)
    const sendResult = await mockSendEmail(emailContent);

    // 7. Update delivery record
    if (sendResult.success) {
      await db.scheduledReportDeliveries.update(deliveryId, {
        status: 'sent',
        sent_at: new Date(),
        delivered_at: new Date(),
        attachment_size: attachment.size,
        updated_at: new Date(),
      });

      // 8. Update schedule record
      const nextRun = calculateNextRun(schedule);
      await db.reportSchedules.update(schedule.id, {
        last_run_at: new Date(),
        last_success_at: new Date(),
        next_run_at: nextRun,
        run_count: schedule.run_count + 1,
        failure_count: 0, // Reset failure count on success
        updated_at: new Date(),
      });

      deliveryLogger.info('Scheduled delivery completed successfully', {
        scheduleId: schedule.id,
        deliveryId,
      });
    } else {
      throw new Error(sendResult.error || 'Email send failed');
    }
  } catch (error) {
    deliveryLogger.error('Scheduled delivery failed', { error, scheduleId: schedule.id });

    // Update schedule with failure
    await db.reportSchedules.update(schedule.id, {
      last_run_at: new Date(),
      last_failure_at: new Date(),
      failure_count: schedule.failure_count + 1,
      updated_at: new Date(),
    });

    throw error;
  }
}

/**
 * Send a test email for a schedule (preview)
 */
export async function sendTestEmail(
  schedule: ReportSchedule,
  testRecipient: string
): Promise<ScheduleResult<string>> {
  try {
    deliveryLogger.info('Sending test email', { scheduleId: schedule.id, testRecipient });

    // Generate mock report data
    const reportData = await generateReportData({
      report_type: schedule.reportType,
      report_name: schedule.reportName,
      format: schedule.format,
      include_comparison: schedule.includeComparison,
      include_educational_content: schedule.includeEducationalContent,
      report_parameters: schedule.reportParameters,
    } as any);

    // Export report
    const exportResult = await exportReport(
      schedule.reportType,
      reportData,
      schedule.format === 'json' ? 'csv' : schedule.format,
      {
        includeComparison: schedule.includeComparison,
        includeEducationalContent: schedule.includeEducationalContent,
      }
    );

    if (!exportResult.success || !exportResult.blob) {
      return {
        success: false,
        error: {
          code: 'REPORT_GENERATION_FAILED',
          message: 'Failed to generate report for test email',
        },
      };
    }

    // Create attachment
    const buffer = await exportResultToBuffer(exportResult);
    const attachment: EmailAttachment = {
      filename: exportResult.filename || `test-report.${schedule.format}`,
      content: buffer,
      contentType: getExportMimeType(schedule.format === 'json' ? 'csv' : schedule.format),
      size: buffer.length,
    };

    // Generate email
    const emailContent = generateReportEmail(
      {
        ...schedule,
        report_name: `[TEST] ${schedule.reportName}`,
        recipients: [testRecipient],
      } as any,
      attachment
    );

    // Send (mocked)
    const result = await mockSendEmail(emailContent);

    if (result.success) {
      return {
        success: true,
        data: 'Test email sent successfully',
      };
    } else {
      return {
        success: false,
        error: {
          code: 'DELIVERY_FAILED',
          message: result.error || 'Failed to send test email',
        },
      };
    }
  } catch (error) {
    deliveryLogger.error('Failed to send test email', { error, scheduleId: schedule.id });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to send test email',
      },
    };
  }
}

// =============================================================================
// Delivery History
// =============================================================================

/**
 * Get delivery history for a schedule
 */
export async function getDeliveryHistory(
  scheduleId: string,
  limit: number = 50
): Promise<ScheduledReportDelivery[]> {
  try {
    const entities = await db.scheduledReportDeliveries
      .where('schedule_id')
      .equals(scheduleId)
      .and((delivery) => !delivery.deleted_at)
      .reverse()
      .limit(limit)
      .toArray();

    return entities.map(entityToDelivery);
  } catch (error) {
    deliveryLogger.error('Failed to get delivery history', { error, scheduleId });
    return [];
  }
}

/**
 * Get recent deliveries across all schedules for a company
 */
export async function getRecentDeliveries(
  companyId: string,
  limit: number = 20
): Promise<ScheduledReportDelivery[]> {
  try {
    const entities = await db.scheduledReportDeliveries
      .where('company_id')
      .equals(companyId)
      .and((delivery) => !delivery.deleted_at)
      .reverse()
      .limit(limit)
      .toArray();

    return entities.map(entityToDelivery);
  } catch (error) {
    deliveryLogger.error('Failed to get recent deliveries', { error, companyId });
    return [];
  }
}

/**
 * Retry a failed delivery
 */
export async function retryDelivery(deliveryId: string): Promise<ScheduleResult<ScheduledReportDelivery>> {
  try {
    const delivery = await db.scheduledReportDeliveries.get(deliveryId);

    if (!delivery) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Delivery record not found',
        },
      };
    }

    if (delivery.retry_count >= delivery.max_retries) {
      return {
        success: false,
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'Maximum retries exceeded',
        },
      };
    }

    // Get the schedule
    const schedule = await db.reportSchedules.get(delivery.schedule_id);
    if (!schedule) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        },
      };
    }

    // Update delivery status to retrying
    await db.scheduledReportDeliveries.update(deliveryId, {
      status: 'retrying',
      retry_count: delivery.retry_count + 1,
      last_retry_at: new Date(),
      updated_at: new Date(),
    });

    // Re-execute delivery
    await executeScheduledDelivery(schedule);

    const updated = await db.scheduledReportDeliveries.get(deliveryId);
    if (!updated) {
      throw new Error('Failed to retrieve updated delivery');
    }

    return {
      success: true,
      data: entityToDelivery(updated),
    };
  } catch (error) {
    deliveryLogger.error('Failed to retry delivery', { error, deliveryId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Retry failed',
      },
    };
  }
}

// =============================================================================
// Email Generation
// =============================================================================

/**
 * Generate email content for scheduled report
 */
function generateReportEmail(
  schedule: Partial<ReportScheduleEntity> & { report_name: string; recipients: string[] },
  attachment: EmailAttachment
): ScheduledReportEmail {
  const reportName = schedule.report_name;
  const dateStr = format(new Date(), 'MMMM d, yyyy');

  const subject = `Your ${reportName} Report - ${dateStr}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4f46e5; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
    .attachment-info { background-color: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0;">${reportName}</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your scheduled report is ready</p>
  </div>

  <div class="content">
    <p>We've prepared your ${reportName} report for ${dateStr}.</p>

    <div class="attachment-info">
      <strong>📎 Attachment:</strong> ${attachment.filename}<br>
      <strong>📊 Format:</strong> ${schedule.format?.toUpperCase()}<br>
      <strong>📏 Size:</strong> ${formatBytes(attachment.size)}
    </div>

    <p>The report is attached to this email. Simply open the attachment to view your financial data.</p>

    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      This is an automated report from your Graceful Books account. If you'd like to adjust the schedule or stop receiving these reports, you can manage your preferences in your account settings.
    </p>
  </div>

  <div class="footer">
    <p>Sent with care by Graceful Books</p>
    <p>
      <a href="#" style="color: #4f46e5; text-decoration: none;">Manage Preferences</a> |
      <a href="#" style="color: #4f46e5; text-decoration: none;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>
  `.trim();

  const textBody = `
${reportName}
${'='.repeat(reportName.length)}

Your scheduled report is ready for ${dateStr}.

Attachment: ${attachment.filename}
Format: ${schedule.format?.toUpperCase()}
Size: ${formatBytes(attachment.size)}

The report is attached to this email.

---
This is an automated report from your Graceful Books account.
  `.trim();

  return {
    to: schedule.recipients,
    subject,
    htmlBody,
    textBody,
    attachments: [attachment],
    replyTo: 'support@gracefulbooks.com',
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate mock report data for a schedule
 * In production, this would call the appropriate report service
 */
async function generateReportData(schedule: Partial<ReportScheduleEntity>): Promise<unknown> {
  // For MVP, return mock data structure
  // In production, this would:
  // 1. Call the appropriate report service based on report_type
  // 2. Pass report_parameters to configure the report
  // 3. Return the actual report data

  return {
    reportType: schedule.report_type,
    generatedAt: new Date(),
    // Mock data structure
  };
}

/**
 * Calculate next run time for a schedule
 * Uses the same logic as reportScheduler.service.ts
 */
function calculateNextRun(schedule: ReportScheduleEntity): Date {
  // For MVP, simple calculation - add 1 week for weekly, 1 month for monthly, etc.
  const now = new Date();
  const nextRun = new Date(now);

  switch (schedule.frequency) {
    case 'daily':
      nextRun.setDate(nextRun.getDate() + 1);
      break;
    case 'weekly':
      nextRun.setDate(nextRun.getDate() + 7);
      break;
    case 'monthly':
      nextRun.setMonth(nextRun.getMonth() + 1);
      break;
    case 'quarterly':
      nextRun.setMonth(nextRun.getMonth() + 3);
      break;
    case 'yearly':
      nextRun.setFullYear(nextRun.getFullYear() + 1);
      break;
    default:
      nextRun.setDate(nextRun.getDate() + 7);
  }

  // Set time from schedule
  const [hours, minutes] = schedule.time_of_day.split(':').map(Number);
  nextRun.setHours(hours!, minutes!, 0, 0);

  return nextRun;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Mock email send function
 * In production, this would integrate with nodemailer or email service
 */
async function mockSendEmail(
  email: ScheduledReportEmail
): Promise<{ success: boolean; error?: string }> {
  deliveryLogger.debug('MOCKED: Sending email', {
    to: email.to,
    subject: email.subject,
    attachmentCount: email.attachments.length,
  });

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // In production:
  // - Use nodemailer to send via SMTP
  // - Or integrate with email service (SendGrid, AWS SES, etc.)
  // - Handle authentication, rate limits, bounce handling
  // - Return actual message ID for tracking

  return {
    success: true,
  };
}

/**
 * Convert entity to domain model
 */
function entityToDelivery(entity: ScheduledReportDeliveryEntity): ScheduledReportDelivery {
  return {
    id: entity.id,
    scheduleId: entity.schedule_id,
    companyId: entity.company_id,
    userId: entity.user_id,
    reportType: entity.report_type,
    reportName: entity.report_name,
    generatedAt: entity.generated_at,
    recipients: entity.recipients,
    format: entity.format,
    status: entity.status,
    scheduledAt: entity.scheduled_at,
    sentAt: entity.sent_at,
    deliveredAt: entity.delivered_at,
    failureReason: entity.failure_reason,
    retryCount: entity.retry_count,
    maxRetries: entity.max_retries,
    lastRetryAt: entity.last_retry_at,
    attachmentSize: entity.attachment_size,
    attachmentUrl: entity.attachment_url,
    emailSubject: entity.email_subject,
    emailBody: entity.email_body,
    createdAt: entity.created_at,
    updatedAt: entity.updated_at,
  };
}
