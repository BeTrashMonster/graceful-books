/**
 * Workshop Email Scheduler Service
 *
 * Background service that runs periodically to check which workshop emails should
 * be sent based on enrollment timing and workshop schedule. Handles email sending,
 * retry logic, duplicate prevention, and logging.
 *
 * Designed to run as a cron job (e.g., every 5-15 minutes).
 */

import * as postmark from 'postmark';
import type { Pool } from 'pg';
import type { Workshop, WorkshopEnrollment, EmailLog } from '../../types/workshop.types.js';
import type { EmailType } from './workshopEmails.js';
import { getEmailSchedule, shouldSendEmail } from '../../utils/workshopAccess.js';
import { renderEmailTemplate, type UserData } from './workshopEmailRenderer.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const MAX_RETRIES = 3;
const POSTMARK_FROM_EMAIL = process.env.POSTMARK_FROM_EMAIL || 'noreply@audacious.money';
const POSTMARK_FROM_NAME = process.env.POSTMARK_FROM_NAME || 'Audrey - Audacious Money';

// Initialize Postmark client
const postmarkClient = new postmark.ServerClient(process.env.POSTMARK_SERVER_TOKEN || '');

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface EnrollmentWithDetails extends WorkshopEnrollment {
  workshop: Workshop;
  user: UserData;
}

interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// =============================================================================
// MAIN SCHEDULER FUNCTION
// =============================================================================

/**
 * Check and send all pending workshop emails
 *
 * This is the main function to be called by a cron job.
 * It queries all enrollments, determines which emails need to be sent,
 * and sends them with retry logic.
 *
 * @param db - PostgreSQL connection pool
 * @returns Summary of emails processed
 */
async function checkAndSendWorkshopEmails(db: Pool): Promise<{
  totalChecked: number;
  emailsSent: number;
  emailsFailed: number;
}> {
  console.log('[Workshop Email Scheduler] Starting email check...');

  let totalChecked = 0;
  let emailsSent = 0;
  let emailsFailed = 0;

  try {
    // Get all enrollments that might need emails
    const enrollments = await getEnrollmentsNeedingEmails(db);
    totalChecked = enrollments.length;

    console.log(`[Workshop Email Scheduler] Found ${totalChecked} enrollments to check`);

    // Process each enrollment
    for (const enrollment of enrollments) {
      try {
        const emailsToSend = determineEmailsToSend(enrollment);

        for (const emailType of emailsToSend) {
          console.log(
            `[Workshop Email Scheduler] Sending ${emailType} email to user ${enrollment.userId} for workshop ${enrollment.workshop.slug}`
          );

          const result = await sendWorkshopEmail(enrollment, emailType);

          if (result.success) {
            await logEmailSent(db, enrollment.id, emailType, result.messageId);
            emailsSent++;
            console.log(`[Workshop Email Scheduler] ✓ ${emailType} email sent successfully`);
          } else {
            await logEmailFailed(db, enrollment.id, emailType, result.error);
            emailsFailed++;
            console.error(`[Workshop Email Scheduler] ✗ ${emailType} email failed: ${result.error}`);
          }
        }
      } catch (error) {
        console.error(
          `[Workshop Email Scheduler] Error processing enrollment ${enrollment.id}:`,
          error instanceof Error ? error.message : String(error)
        );
        emailsFailed++;
      }
    }

    console.log(
      `[Workshop Email Scheduler] Complete. Sent: ${emailsSent}, Failed: ${emailsFailed}, Total checked: ${totalChecked}`
    );

    return { totalChecked, emailsSent, emailsFailed };
  } catch (error) {
    console.error(
      '[Workshop Email Scheduler] Fatal error:',
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

// =============================================================================
// ENROLLMENT QUERIES
// =============================================================================

/**
 * Get all enrollments that might need emails sent
 *
 * @param db - Database connection pool
 * @returns Array of enrollments with workshop and user data
 */
async function getEnrollmentsNeedingEmails(db: Pool): Promise<EnrollmentWithDetails[]> {
  // Query enrollments that:
  // 1. Are in active or enrolled status
  // 2. Have a workshop that is not archived
  // 3. Joined with workshop and user data
  const query = `
    SELECT
      we.id,
      we.user_id,
      we.workshop_id,
      we.enrolled_at,
      we.first_login_at,
      we.trial_started_at,
      we.trial_expires_at,
      we.converted_to_paid_at,
      we.worksheet_completed_at,
      we.emails_sent,
      we.last_active_at,
      we.status,
      we.created_at,
      we.updated_at,
      w.id AS w_id,
      w.cohort_name,
      w.slug,
      w.description,
      w.workshop_type,
      w.location,
      w.primary_timezone,
      w.secondary_timezone,
      w.access_grant_datetime,
      w.trial_start_datetime,
      w.trial_duration_days,
      w.workshop_start_datetime,
      w.workshop_end_datetime,
      w.registration_deadline,
      w.max_enrollment,
      w.welcome_message,
      w.custom_email_templates,
      w.custom_email_schedule,
      w.post_workshop_resources,
      w.post_trial_action,
      w.send_reminder,
      w.reminder_hours_before,
      w.status AS workshop_status,
      w.created_by,
      w.created_at AS workshop_created_at,
      w.updated_at AS workshop_updated_at,
      u.id AS u_id,
      u.email,
      u.first_name,
      u.last_name,
      u.selected_charity_id
    FROM workshop_enrollments we
    INNER JOIN workshops w ON we.workshop_id = w.id
    INNER JOIN users u ON we.user_id = u.id
    WHERE we.status IN ('enrolled', 'active')
      AND w.status NOT IN ('draft', 'archived')
    ORDER BY we.enrolled_at ASC
  `;

  const result = await db.query(query);

  // Map database rows to EnrollmentWithDetails objects
  return result.rows.map((row) => {
    // Parse JSONB fields
    const emailsSent = row.emails_sent ? JSON.parse(JSON.stringify(row.emails_sent)) : [];
    const customEmailTemplates = row.custom_email_templates
      ? JSON.parse(JSON.stringify(row.custom_email_templates))
      : undefined;
    const customEmailSchedule = row.custom_email_schedule
      ? JSON.parse(JSON.stringify(row.custom_email_schedule))
      : undefined;
    const postWorkshopResources = row.post_workshop_resources
      ? JSON.parse(JSON.stringify(row.post_workshop_resources))
      : undefined;

    // TODO: Fetch charity name from charities table if needed
    const selectedCharityName = undefined; // Will be populated when we integrate with charities

    return {
      id: row.id,
      userId: row.user_id,
      workshopId: row.workshop_id,
      enrolledAt: row.enrolled_at,
      firstLoginAt: row.first_login_at,
      trialStartedAt: row.trial_started_at,
      trialExpiresAt: row.trial_expires_at,
      convertedToPaidAt: row.converted_to_paid_at,
      worksheetCompletedAt: row.worksheet_completed_at,
      emailsSent: emailsSent.map((log: any) => ({
        emailType: log.emailType,
        sentAt: new Date(log.sentAt),
        successful: log.successful,
        errorMessage: log.errorMessage,
      })),
      lastActiveAt: row.last_active_at,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      workshop: {
        id: row.w_id,
        cohortName: row.cohort_name,
        slug: row.slug,
        description: row.description,
        workshopType: row.workshop_type,
        location: row.location,
        primaryTimezone: row.primary_timezone,
        secondaryTimezone: row.secondary_timezone,
        accessGrantDatetime: row.access_grant_datetime,
        trialStartDatetime: row.trial_start_datetime,
        trialDurationDays: row.trial_duration_days,
        workshopStartDatetime: row.workshop_start_datetime,
        workshopEndDatetime: row.workshop_end_datetime,
        registrationDeadline: row.registration_deadline,
        maxEnrollment: row.max_enrollment,
        welcomeMessage: row.welcome_message,
        customEmailTemplates: customEmailTemplates,
        customEmailSchedule: customEmailSchedule,
        postWorkshopResources: postWorkshopResources,
        postTrialAction: row.post_trial_action,
        sendReminder: row.send_reminder,
        reminderHoursBefore: row.reminder_hours_before,
        status: row.workshop_status,
        createdBy: row.created_by,
        createdAt: row.workshop_created_at,
        updatedAt: row.workshop_updated_at,
      },
      user: {
        id: row.u_id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        selectedCharityName: selectedCharityName,
      },
    };
  });
}

// =============================================================================
// EMAIL DETERMINATION
// =============================================================================

/**
 * Determine which emails should be sent for an enrollment
 *
 * @param enrollment - Enrollment with workshop and user data
 * @returns Array of email types to send
 */
function determineEmailsToSend(enrollment: EnrollmentWithDetails): EmailType[] {
  const emailsToSend: EmailType[] = [];
  const schedule = getEmailSchedule(enrollment.workshop, enrollment.enrolledAt);

  // Check each email type
  // Note: Welcome email is sent immediately at enrollment, not by this scheduler

  // Reminder email (if enabled and not already sent)
  if (
    enrollment.workshop.sendReminder &&
    shouldSendEmail('reminder', schedule, enrollment.emailsSent)
  ) {
    emailsToSend.push('reminder');
  }

  // Week 1 email
  if (shouldSendEmail('week1', schedule, enrollment.emailsSent)) {
    emailsToSend.push('week1');
  }

  // Week 2 email
  if (shouldSendEmail('week2', schedule, enrollment.emailsSent)) {
    emailsToSend.push('week2');
  }

  // Week 3 email
  if (shouldSendEmail('week3', schedule, enrollment.emailsSent)) {
    emailsToSend.push('week3');
  }

  // Week 4 email
  if (shouldSendEmail('week4', schedule, enrollment.emailsSent)) {
    emailsToSend.push('week4');
  }

  // Wrap-up email
  if (shouldSendEmail('wrap_up', schedule, enrollment.emailsSent)) {
    emailsToSend.push('wrapup');
  }

  return emailsToSend;
}

// =============================================================================
// EMAIL SENDING
// =============================================================================

/**
 * Send a workshop email to a user
 *
 * @param enrollment - Enrollment with workshop and user data
 * @param emailType - Type of email to send
 * @returns Result of email send attempt
 */
async function sendWorkshopEmail(
  enrollment: EnrollmentWithDetails,
  emailType: EmailType
): Promise<EmailSendResult> {
  try {
    // Render email with user data
    const rendered = await renderEmailTemplate(
      enrollment.workshop,
      enrollment,
      enrollment.user,
      emailType
    );

    // Send via Postmark
    const response = await postmarkClient.sendEmail({
      From: `${POSTMARK_FROM_NAME} <${POSTMARK_FROM_EMAIL}>`,
      To: enrollment.user.email,
      Subject: rendered.subject,
      HtmlBody: rendered.html,
      TextBody: rendered.text,
      MessageStream: 'outbound',
      // Add custom headers for tracking
      Headers: [
        { Name: 'X-Workshop-Slug', Value: enrollment.workshop.slug },
        { Name: 'X-Email-Type', Value: emailType },
        { Name: 'X-Enrollment-Id', Value: enrollment.id },
      ],
    });

    return {
      success: true,
      messageId: response.MessageID,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// =============================================================================
// EMAIL LOGGING
// =============================================================================

/**
 * Log successful email send to database
 *
 * @param db - Database connection pool
 * @param enrollmentId - Enrollment ID
 * @param emailType - Type of email sent
 * @param messageId - Postmark message ID
 */
async function logEmailSent(
  db: Pool,
  enrollmentId: string,
  emailType: EmailType,
  messageId?: string
): Promise<void> {
  const emailLog: EmailLog = {
    emailType: emailType === 'wrapup' ? 'wrap_up' : emailType,
    sentAt: new Date(),
    successful: true,
  };

  const query = `
    UPDATE workshop_enrollments
    SET
      emails_sent = emails_sent || $1::jsonb,
      updated_at = NOW()
    WHERE id = $2
  `;

  await db.query(query, [JSON.stringify(emailLog), enrollmentId]);
}

/**
 * Log failed email send to database
 *
 * @param db - Database connection pool
 * @param enrollmentId - Enrollment ID
 * @param emailType - Type of email that failed
 * @param error - Error message
 */
async function logEmailFailed(
  db: Pool,
  enrollmentId: string,
  emailType: EmailType,
  error?: string
): Promise<void> {
  const emailLog: EmailLog = {
    emailType: emailType === 'wrapup' ? 'wrap_up' : emailType,
    sentAt: new Date(),
    successful: false,
    errorMessage: error,
  };

  const query = `
    UPDATE workshop_enrollments
    SET
      emails_sent = emails_sent || $1::jsonb,
      updated_at = NOW()
    WHERE id = $2
  `;

  await db.query(query, [JSON.stringify(emailLog), enrollmentId]);
}

// =============================================================================
// RETRY LOGIC
// =============================================================================

/**
 * Check if email should be retried based on previous attempts
 *
 * @param enrollment - Enrollment record
 * @param emailType - Type of email
 * @returns true if should retry, false otherwise
 */
function shouldRetryEmail(enrollment: WorkshopEnrollment, emailType: EmailType): boolean {
  const failedAttempts = enrollment.emailsSent.filter(
    (log) => log.emailType === emailType && !log.successful
  );

  return failedAttempts.length < MAX_RETRIES;
}

// =============================================================================
// EXPORTS
// =============================================================================

export { checkAndSendWorkshopEmails };
