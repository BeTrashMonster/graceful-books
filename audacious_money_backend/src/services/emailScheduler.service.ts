/**
 * Email Scheduler Service
 *
 * Manages the scheduling, processing, and tracking of workshop emails.
 * Replaces the fragile Postmark SendAt approach with database-backed scheduling.
 *
 * Flow:
 * 1. User signs up → scheduleWorkshopEmails() creates rows in scheduled_emails
 * 2. Cron worker runs → processScheduledEmails() sends pending emails via Postmark
 * 3. Admin can view/cancel/retry via helper functions
 */

import { Pool } from 'pg';
import {
  sendWorkshopWelcomeEmail,
  sendWorkshopReminderEmail,
  sendWorkshopChallengeWeek1Email,
  sendWorkshopChallengeWeek2Email,
  sendWorkshopChallengeWeek3Email,
  sendWorkshopChallengeWeek4Email,
  sendWorkshopWrapUpEmail,
  type CustomEmailTemplates,
} from './email.service.js';

// =============================================================================
// TYPES
// =============================================================================

export type EmailType = 'welcome' | 'reminder' | 'week1' | 'week2' | 'week3' | 'week4' | 'wrapUp' | 'custom';

export type EmailStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface ScheduledEmail {
  id: string;
  enrollmentId: string;
  workshopId: string;
  userId: string;
  emailType: EmailType;
  recipientEmail: string;
  recipientName: string | null;
  scheduledFor: Date;
  status: EmailStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt: Date | null;
  sentAt: Date | null;
  lastError: string | null;
  postmarkMessageId: string | null;
  customSubject: string | null;
  customHtmlBody: string | null;
  customTextBody: string | null;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
  cancelledBy: string | null;
}

export interface EmailScheduleConfig {
  welcome?: { enabled: boolean; when: 'immediate' };
  reminder?: { enabled: boolean; when: { hours_before: number } };
  week1?: { enabled: boolean; when: { days_after_workshop: number } };
  week2?: { enabled: boolean; when: { days_after_workshop: number } };
  week3?: { enabled: boolean; when: { days_after_workshop: number } };
  week4?: { enabled: boolean; when: { days_after_workshop: number } };
  wrapUp?: { enabled: boolean; when: { days_after_workshop: number } };
}

interface Workshop {
  id: string;
  cohortName: string;
  workshopName?: string;
  workshopStartDatetime: string;
  workshopEndDatetime: string;
  location?: string;
  customEmailSchedule?: EmailScheduleConfig;
  customEmailTemplates?: CustomEmailTemplates;
}

interface User {
  id: string;
  email: string;
  firstName: string;
}

interface Enrollment {
  id: string;
  workshopId: string;
  userId: string;
}

// Default email schedule if workshop doesn't specify custom schedule
const DEFAULT_EMAIL_SCHEDULE: EmailScheduleConfig = {
  welcome: { enabled: true, when: 'immediate' },
  reminder: { enabled: true, when: { hours_before: 24 } },
  week1: { enabled: true, when: { days_after_workshop: 7 } },
  week2: { enabled: true, when: { days_after_workshop: 14 } },
  week3: { enabled: true, when: { days_after_workshop: 21 } },
  week4: { enabled: true, when: { days_after_workshop: 28 } },
  wrapUp: { enabled: true, when: { days_after_workshop: 30 } },
};

// =============================================================================
// SCHEDULE EMAILS FOR NEW ENROLLMENT
// =============================================================================

/**
 * Schedule all workshop emails for a new enrollment.
 * Called during signup - creates rows in scheduled_emails table.
 */
export async function scheduleWorkshopEmails(
  db: Pool,
  enrollment: Enrollment,
  workshop: Workshop,
  user: User
): Promise<{ scheduled: number; skipped: number }> {
  const schedule = workshop.customEmailSchedule || DEFAULT_EMAIL_SCHEDULE;
  const now = new Date();
  const workshopStart = new Date(workshop.workshopStartDatetime);
  const workshopEnd = new Date(workshop.workshopEndDatetime);

  let scheduled = 0;
  let skipped = 0;

  const emailsToSchedule: Array<{
    emailType: EmailType;
    scheduledFor: Date;
  }> = [];

  // Welcome - immediate
  if (schedule.welcome?.enabled !== false) {
    emailsToSchedule.push({
      emailType: 'welcome',
      scheduledFor: now,
    });
  }

  // Reminder - X hours before workshop start
  if (schedule.reminder?.enabled !== false) {
    const hoursBefore = schedule.reminder?.when?.hours_before || 24;
    const reminderTime = new Date(workshopStart);
    reminderTime.setHours(reminderTime.getHours() - hoursBefore);

    if (reminderTime > now) {
      emailsToSchedule.push({
        emailType: 'reminder',
        scheduledFor: reminderTime,
      });
    } else {
      skipped++;
      console.log(`[EmailScheduler] Skipping reminder - time already passed`);
    }
  }

  // Week 1-4 and WrapUp - X days after workshop end
  const weeklyEmails: Array<{ type: EmailType; config: typeof schedule.week1 }> = [
    { type: 'week1', config: schedule.week1 },
    { type: 'week2', config: schedule.week2 },
    { type: 'week3', config: schedule.week3 },
    { type: 'week4', config: schedule.week4 },
    { type: 'wrapUp', config: schedule.wrapUp },
  ];

  for (const { type, config } of weeklyEmails) {
    if (config?.enabled !== false) {
      const daysAfter = config?.when?.days_after_workshop || getDefaultDaysAfter(type);
      const sendTime = new Date(workshopEnd);
      sendTime.setDate(sendTime.getDate() + daysAfter);

      if (sendTime > now) {
        emailsToSchedule.push({
          emailType: type,
          scheduledFor: sendTime,
        });
      } else {
        skipped++;
        console.log(`[EmailScheduler] Skipping ${type} - time already passed`);
      }
    }
  }

  // Insert all scheduled emails
  for (const email of emailsToSchedule) {
    try {
      await db.query(
        `INSERT INTO scheduled_emails (
          enrollment_id, workshop_id, user_id,
          email_type, recipient_email, recipient_name,
          scheduled_for, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
        [
          enrollment.id,
          workshop.id,
          user.id,
          email.emailType,
          user.email,
          user.firstName,
          email.scheduledFor,
        ]
      );
      scheduled++;
      console.log(`[EmailScheduler] Scheduled ${email.emailType} for ${email.scheduledFor.toISOString()}`);
    } catch (error: any) {
      // Unique constraint violation means email already scheduled - skip
      if (error.code === '23505') {
        console.log(`[EmailScheduler] ${email.emailType} already scheduled for this enrollment`);
        skipped++;
      } else {
        throw error;
      }
    }
  }

  console.log(`[EmailScheduler] Scheduled ${scheduled} emails, skipped ${skipped} for enrollment ${enrollment.id}`);
  return { scheduled, skipped };
}

function getDefaultDaysAfter(type: EmailType): number {
  switch (type) {
    case 'week1': return 7;
    case 'week2': return 14;
    case 'week3': return 21;
    case 'week4': return 28;
    case 'wrapUp': return 30;
    default: return 7;
  }
}

// =============================================================================
// PROCESS SCHEDULED EMAILS (CRON WORKER)
// =============================================================================

/**
 * Process pending scheduled emails.
 * Called by cron worker - finds emails ready to send and sends them.
 */
export async function processScheduledEmails(db: Pool): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  let processed = 0;
  let sent = 0;
  let failed = 0;

  // Find pending emails ready to send (with row locking to prevent duplicate processing)
  // Skip users who have unsubscribed from workshop emails
  const result = await db.query(`
    SELECT se.*,
           w.cohort_name, w.workshop_name, w.workshop_start_datetime,
           w.workshop_end_datetime, w.location, w.custom_email_templates
    FROM scheduled_emails se
    JOIN workshops w ON se.workshop_id = w.id
    LEFT JOIN workshop_enrollments we ON se.enrollment_id = we.id
    WHERE se.status = 'pending'
      AND se.scheduled_for <= NOW()
      AND se.attempts < se.max_attempts
      AND (we.email_unsubscribed_at IS NULL OR we.id IS NULL)
    ORDER BY se.scheduled_for ASC
    LIMIT 50
    FOR UPDATE OF se SKIP LOCKED
  `);

  console.log(`[EmailScheduler] Found ${result.rowCount} emails ready to send`);

  for (const row of result.rows) {
    processed++;
    const emailId = row.id;

    // Mark as processing
    await db.query(
      `UPDATE scheduled_emails
       SET status = 'processing',
           attempts = attempts + 1,
           last_attempt_at = NOW()
       WHERE id = $1`,
      [emailId]
    );

    try {
      // Send the email
      const messageId = await sendEmailByType(row);

      // Mark as sent
      await db.query(
        `UPDATE scheduled_emails
         SET status = 'sent',
             sent_at = NOW(),
             postmark_message_id = $2
         WHERE id = $1`,
        [emailId, messageId]
      );

      sent++;
      console.log(`[EmailScheduler] ✅ Sent ${row.email_type} to ${row.recipient_email}`);

    } catch (error: any) {
      // Check if max attempts reached
      const newAttempts = row.attempts + 1;
      const newStatus = newAttempts >= row.max_attempts ? 'failed' : 'pending';

      await db.query(
        `UPDATE scheduled_emails
         SET status = $2,
             last_error = $3
         WHERE id = $1`,
        [emailId, newStatus, error.message || 'Unknown error']
      );

      failed++;
      console.error(`[EmailScheduler] ❌ Failed to send ${row.email_type} to ${row.recipient_email}: ${error.message}`);
    }
  }

  console.log(`[EmailScheduler] Processed ${processed} emails: ${sent} sent, ${failed} failed`);
  return { processed, sent, failed };
}

/**
 * Send email based on type, using current templates from workshop config
 */
async function sendEmailByType(row: any): Promise<string | undefined> {
  const customTemplates: CustomEmailTemplates = row.custom_email_templates || {};
  const workshopName = row.workshop_name || row.cohort_name;
  const workshopStart = new Date(row.workshop_start_datetime);
  const workshopDateFormatted = workshopStart.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const workshopLocation = row.location || 'Online';

  // All email functions now send immediately (no sendAt parameter)
  switch (row.email_type) {
    case 'welcome':
      await sendWorkshopWelcomeEmail(
        row.recipient_email,
        row.recipient_name || 'there',
        workshopName,
        workshopDateFormatted,
        workshopLocation,
        row.user_id,
        row.workshop_id,
        row.enrollment_id, // For unsubscribe link
        undefined, // No sendAt - send immediately
        customTemplates.welcome
      );
      break;

    case 'reminder':
      await sendWorkshopReminderEmail(
        row.recipient_email,
        row.recipient_name || 'there',
        row.workshop_start_datetime,
        workshopLocation,
        row.user_id,
        row.workshop_id,
        row.enrollment_id, // For unsubscribe link
        undefined, // No sendAt
        customTemplates.reminder
      );
      break;

    case 'week1':
      await sendWorkshopChallengeWeek1Email(
        row.recipient_email,
        row.recipient_name || 'there',
        workshopName,
        row.user_id,
        row.workshop_id,
        row.enrollment_id, // For unsubscribe link
        undefined, // No sendAt
        customTemplates.week1
      );
      break;

    case 'week2':
      await sendWorkshopChallengeWeek2Email(
        row.recipient_email,
        row.recipient_name || 'there',
        workshopName,
        row.user_id,
        row.workshop_id,
        row.enrollment_id, // For unsubscribe link
        undefined, // No sendAt
        customTemplates.week2
      );
      break;

    case 'week3':
      await sendWorkshopChallengeWeek3Email(
        row.recipient_email,
        row.recipient_name || 'there',
        workshopName,
        row.user_id,
        row.workshop_id,
        row.enrollment_id, // For unsubscribe link
        undefined, // No sendAt
        customTemplates.week3
      );
      break;

    case 'week4':
      await sendWorkshopChallengeWeek4Email(
        row.recipient_email,
        row.recipient_name || 'there',
        workshopName,
        row.user_id,
        row.workshop_id,
        row.enrollment_id, // For unsubscribe link
        undefined, // No sendAt
        customTemplates.week4
      );
      break;

    case 'wrapUp':
      await sendWorkshopWrapUpEmail(
        row.recipient_email,
        row.recipient_name || 'there',
        workshopName,
        row.user_id,
        row.workshop_id,
        row.enrollment_id, // For unsubscribe link
        undefined, // No sendAt
        customTemplates.wrapUp
      );
      break;

    case 'custom':
      // Custom emails have content stored in the scheduled_emails row
      if (!row.custom_subject || !row.custom_html_body) {
        throw new Error('Custom email missing subject or body');
      }
      // Use the sendCustomWorkshopEmail function or similar
      const { sendCustomWorkshopEmail } = await import('./email.service.js');
      await sendCustomWorkshopEmail(
        row.recipient_email,
        row.recipient_name || 'there',
        workshopName,
        workshopDateFormatted,
        workshopLocation,
        row.user_id,
        row.workshop_id,
        'custom',
        {
          subject: row.custom_subject,
          htmlBody: row.custom_html_body,
          plainTextBody: row.custom_text_body,
        }
      );
      break;

    default:
      throw new Error(`Unknown email type: ${row.email_type}`);
  }

  return undefined; // TODO: Return actual message ID from Postmark
}

// =============================================================================
// ADMIN FUNCTIONS
// =============================================================================

/**
 * Get all scheduled emails for a workshop
 */
export async function getScheduledEmailsForWorkshop(
  db: Pool,
  workshopId: string,
  filters?: { status?: EmailStatus }
): Promise<ScheduledEmail[]> {
  let query = `
    SELECT * FROM scheduled_emails
    WHERE workshop_id = $1
  `;
  const params: any[] = [workshopId];

  if (filters?.status) {
    query += ` AND status = $2`;
    params.push(filters.status);
  }

  query += ` ORDER BY scheduled_for ASC`;

  const result = await db.query(query, params);
  return result.rows.map(mapScheduledEmailRow);
}

/**
 * Get all scheduled emails for an enrollment
 */
export async function getScheduledEmailsForEnrollment(
  db: Pool,
  enrollmentId: string
): Promise<ScheduledEmail[]> {
  const result = await db.query(
    `SELECT * FROM scheduled_emails
     WHERE enrollment_id = $1
     ORDER BY scheduled_for ASC`,
    [enrollmentId]
  );
  return result.rows.map(mapScheduledEmailRow);
}

/**
 * Cancel a scheduled email
 */
export async function cancelScheduledEmail(
  db: Pool,
  emailId: string,
  adminId: string
): Promise<ScheduledEmail | null> {
  const result = await db.query(
    `UPDATE scheduled_emails
     SET status = 'cancelled',
         cancelled_at = NOW(),
         cancelled_by = $2
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [emailId, adminId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  console.log(`[EmailScheduler] Admin ${adminId} cancelled email ${emailId}`);
  return mapScheduledEmailRow(result.rows[0]);
}

/**
 * Cancel all pending emails for an enrollment
 */
export async function cancelAllPendingEmails(
  db: Pool,
  enrollmentId: string,
  adminId: string
): Promise<number> {
  const result = await db.query(
    `UPDATE scheduled_emails
     SET status = 'cancelled',
         cancelled_at = NOW(),
         cancelled_by = $2
     WHERE enrollment_id = $1 AND status = 'pending'`,
    [enrollmentId, adminId]
  );

  console.log(`[EmailScheduler] Admin ${adminId} cancelled ${result.rowCount} emails for enrollment ${enrollmentId}`);
  return result.rowCount || 0;
}

/**
 * Retry a failed email
 */
export async function retryFailedEmail(
  db: Pool,
  emailId: string
): Promise<ScheduledEmail | null> {
  const result = await db.query(
    `UPDATE scheduled_emails
     SET status = 'pending',
         attempts = 0,
         last_error = NULL,
         scheduled_for = NOW()
     WHERE id = $1 AND status = 'failed'
     RETURNING *`,
    [emailId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  console.log(`[EmailScheduler] Retrying email ${emailId}`);
  return mapScheduledEmailRow(result.rows[0]);
}

/**
 * Reschedule a pending email
 */
export async function rescheduleEmail(
  db: Pool,
  emailId: string,
  newScheduledFor: Date
): Promise<ScheduledEmail | null> {
  const result = await db.query(
    `UPDATE scheduled_emails
     SET scheduled_for = $2
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [emailId, newScheduledFor]
  );

  if (result.rowCount === 0) {
    return null;
  }

  console.log(`[EmailScheduler] Rescheduled email ${emailId} to ${newScheduledFor.toISOString()}`);
  return mapScheduledEmailRow(result.rows[0]);
}

// =============================================================================
// HELPERS
// =============================================================================

function mapScheduledEmailRow(row: any): ScheduledEmail {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    workshopId: row.workshop_id,
    userId: row.user_id,
    emailType: row.email_type,
    recipientEmail: row.recipient_email,
    recipientName: row.recipient_name,
    scheduledFor: row.scheduled_for,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lastAttemptAt: row.last_attempt_at,
    sentAt: row.sent_at,
    lastError: row.last_error,
    postmarkMessageId: row.postmark_message_id,
    customSubject: row.custom_subject,
    customHtmlBody: row.custom_html_body,
    customTextBody: row.custom_text_body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
  };
}
