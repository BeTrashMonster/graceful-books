/**
 * Trial Manager Service
 *
 * Background service that checks for expired trials and updates enrollment status.
 * Runs periodically (e.g., via cron job) to:
 * - Query enrollments where trial_expires_at < NOW()
 * - Update enrollment status from trial_active to trial_expired
 * - Send trial expiration notification emails
 * - Execute post-trial actions based on workshop configuration
 * - Log all trial status changes
 */

import { getDbConnection } from '../../db/connection.js';
import { sendTrialExpirationEmail } from '../email/workshopEmails.js';
import type { WorkshopEnrollmentRow, WorkshopRow } from '../../types/workshop.types.js';

/**
 * Trial expiration summary statistics
 */
export interface TrialExpirationSummary {
  totalChecked: number;
  totalExpired: number;
  emailsSent: number;
  emailsFailed: number;
  errors: string[];
}

/**
 * Post-trial action types
 */
export type PostTrialAction = 'upgrade_prompt' | 'auto_convert' | 'freeze_access';

/**
 * Check for expired trials and process them
 *
 * This function should be called periodically (e.g., daily via cron job)
 * to process expired trials and execute appropriate actions.
 */
export async function checkAndProcessExpiredTrials(): Promise<TrialExpirationSummary> {
  const db = getDbConnection();
  const summary: TrialExpirationSummary = {
    totalChecked: 0,
    totalExpired: 0,
    emailsSent: 0,
    emailsFailed: 0,
    errors: [],
  };

  try {
    console.log('[TrialManager] Starting expired trials check...');

    // Query for enrollments where:
    // 1. trial_expires_at is in the past
    // 2. status is still 'active' (not already processed as expired)
    const expiredEnrollmentsResult = await db.query<WorkshopEnrollmentRow>(
      `SELECT we.*
       FROM workshop_enrollments we
       WHERE we.trial_expires_at < NOW()
         AND we.status = 'active'
       ORDER BY we.trial_expires_at ASC`,
      []
    );

    const expiredEnrollments = expiredEnrollmentsResult.rows;
    summary.totalChecked = expiredEnrollments.length;

    console.log(`[TrialManager] Found ${expiredEnrollments.length} expired trials to process`);

    // Process each expired enrollment
    for (const enrollment of expiredEnrollments) {
      try {
        await processExpiredEnrollment(enrollment, summary);
        summary.totalExpired++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        summary.errors.push(`Failed to process enrollment ${enrollment.id}: ${errorMessage}`);
        console.error(`[TrialManager] Error processing enrollment ${enrollment.id}:`, error);
      }
    }

    console.log('[TrialManager] Expired trials check complete:', summary);
    return summary;
  } catch (error) {
    console.error('[TrialManager] Fatal error during trial expiration check:', error);
    throw error;
  }
}

/**
 * Process a single expired enrollment
 */
async function processExpiredEnrollment(
  enrollment: WorkshopEnrollmentRow,
  summary: TrialExpirationSummary
): Promise<void> {
  const db = getDbConnection();

  console.log(`[TrialManager] Processing expired enrollment ${enrollment.id}`);

  // Get the workshop to determine post-trial action
  const workshopResult = await db.query<WorkshopRow>(
    `SELECT * FROM workshops WHERE id = $1`,
    [enrollment.workshop_id]
  );

  if (workshopResult.rows.length === 0) {
    throw new Error(`Workshop ${enrollment.workshop_id} not found`);
  }

  const workshop = workshopResult.rows[0];
  const postTrialAction = workshop.post_trial_action as PostTrialAction;

  // Update enrollment status to trial_expired
  await db.query(
    `UPDATE workshop_enrollments
     SET status = 'trial_expired',
         updated_at = NOW()
     WHERE id = $1`,
    [enrollment.id]
  );

  console.log(`[TrialManager] Updated enrollment ${enrollment.id} status to trial_expired`);

  // Execute post-trial action
  await executePostTrialAction(enrollment, workshop, postTrialAction);

  // Send trial expiration notification email
  try {
    await sendTrialExpirationEmail(enrollment, workshop);
    summary.emailsSent++;
    console.log(`[TrialManager] Sent expiration email for enrollment ${enrollment.id}`);
  } catch (error) {
    summary.emailsFailed++;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    summary.errors.push(`Failed to send email for enrollment ${enrollment.id}: ${errorMessage}`);
    console.error(`[TrialManager] Failed to send expiration email:`, error);
  }

  // Log the trial status change
  await logTrialStatusChange(enrollment.id, 'active', 'trial_expired', postTrialAction);
}

/**
 * Execute the appropriate post-trial action
 */
async function executePostTrialAction(
  enrollment: WorkshopEnrollmentRow,
  workshop: WorkshopRow,
  action: PostTrialAction
): Promise<void> {
  console.log(`[TrialManager] Executing post-trial action "${action}" for enrollment ${enrollment.id}`);

  switch (action) {
    case 'upgrade_prompt':
      // Show upgrade prompt, but maintain access
      // The frontend will display the upgrade modal when user logs in
      // No additional backend action needed
      console.log(`[TrialManager] Will show upgrade prompt on next login`);
      break;

    case 'auto_convert':
      // Automatically create subscription (requires Stripe integration)
      // This would require payment method on file
      await attemptAutoConversion(enrollment, workshop);
      break;

    case 'freeze_access':
      // Maintain access but show upgrade banner
      // The frontend will check enrollment status and show restricted UI
      console.log(`[TrialManager] Access frozen, upgrade banner will be shown`);
      break;

    default:
      console.warn(`[TrialManager] Unknown post-trial action: ${action}`);
  }
}

/**
 * Attempt automatic conversion to paid subscription
 *
 * Note: This requires integration with Stripe subscription creation
 * and the user having a payment method on file.
 */
async function attemptAutoConversion(
  enrollment: WorkshopEnrollmentRow,
  workshop: WorkshopRow
): Promise<void> {
  const db = getDbConnection();

  console.log(`[TrialManager] Attempting auto-conversion for enrollment ${enrollment.id}`);

  // Get user information
  const userResult = await db.query(
    `SELECT * FROM users WHERE id = $1`,
    [enrollment.user_id]
  );

  if (userResult.rows.length === 0) {
    throw new Error(`User ${enrollment.user_id} not found`);
  }

  const user = userResult.rows[0];

  // Check if user has a payment method
  // This would typically check Stripe for a default payment method
  // For now, we'll log that this would attempt to create a subscription

  console.log(`[TrialManager] Auto-conversion would create subscription for user ${user.email}`);

  // TODO: When Stripe integration is ready, uncomment and implement:
  // try {
  //   const subscription = await createWorkshopSubscription(user, workshop);
  //   await db.query(
  //     `UPDATE workshop_enrollments
  //      SET status = 'converted',
  //          converted_to_paid_at = NOW(),
  //          updated_at = NOW()
  //      WHERE id = $1`,
  //     [enrollment.id]
  //   );
  //   console.log(`[TrialManager] Successfully auto-converted enrollment ${enrollment.id}`);
  // } catch (error) {
  //   console.error(`[TrialManager] Auto-conversion failed:`, error);
  //   // Fall back to upgrade_prompt behavior if auto-conversion fails
  // }
}

/**
 * Log trial status change to database
 */
async function logTrialStatusChange(
  enrollmentId: string,
  previousStatus: string,
  newStatus: string,
  postTrialAction: PostTrialAction
): Promise<void> {
  const db = getDbConnection();

  // Log to a trial_status_log table (if it exists) or just to console
  // This provides audit trail for all trial status changes

  console.log(`[TrialManager] Trial status change logged:`, {
    enrollmentId,
    previousStatus,
    newStatus,
    postTrialAction,
    timestamp: new Date().toISOString(),
  });

  // If you have a separate logging table, insert here:
  // await db.query(
  //   `INSERT INTO trial_status_logs (enrollment_id, previous_status, new_status, post_trial_action, logged_at)
  //    VALUES ($1, $2, $3, $4, NOW())`,
  //   [enrollmentId, previousStatus, newStatus, postTrialAction]
  // );
}

/**
 * Get summary statistics for trials
 *
 * Returns counts of trials in various states for reporting/monitoring
 */
export async function getTrialStatistics(): Promise<{
  activeTrials: number;
  expiredTrials: number;
  convertedTrials: number;
  expiringIn24Hours: number;
  expiringIn7Days: number;
}> {
  const db = getDbConnection();

  const [active, expired, converted, in24h, in7d] = await Promise.all([
    // Active trials
    db.query(
      `SELECT COUNT(*) FROM workshop_enrollments
       WHERE status = 'active' AND trial_expires_at > NOW()`,
      []
    ),
    // Expired trials
    db.query(
      `SELECT COUNT(*) FROM workshop_enrollments
       WHERE status = 'trial_expired'`,
      []
    ),
    // Converted trials
    db.query(
      `SELECT COUNT(*) FROM workshop_enrollments
       WHERE status = 'converted'`,
      []
    ),
    // Expiring in next 24 hours
    db.query(
      `SELECT COUNT(*) FROM workshop_enrollments
       WHERE status = 'active'
         AND trial_expires_at > NOW()
         AND trial_expires_at < NOW() + INTERVAL '24 hours'`,
      []
    ),
    // Expiring in next 7 days
    db.query(
      `SELECT COUNT(*) FROM workshop_enrollments
       WHERE status = 'active'
         AND trial_expires_at > NOW()
         AND trial_expires_at < NOW() + INTERVAL '7 days'`,
      []
    ),
  ]);

  return {
    activeTrials: parseInt(active.rows[0].count, 10),
    expiredTrials: parseInt(expired.rows[0].count, 10),
    convertedTrials: parseInt(converted.rows[0].count, 10),
    expiringIn24Hours: parseInt(in24h.rows[0].count, 10),
    expiringIn7Days: parseInt(in7d.rows[0].count, 10),
  };
}

/**
 * Manually expire a trial (for testing or admin override)
 */
export async function manuallyExpireTrial(enrollmentId: string): Promise<void> {
  const db = getDbConnection();

  const enrollmentResult = await db.query<WorkshopEnrollmentRow>(
    `SELECT * FROM workshop_enrollments WHERE id = $1`,
    [enrollmentId]
  );

  if (enrollmentResult.rows.length === 0) {
    throw new Error(`Enrollment ${enrollmentId} not found`);
  }

  const enrollment = enrollmentResult.rows[0];

  if (enrollment.status !== 'active') {
    throw new Error(`Enrollment ${enrollmentId} is not active (current status: ${enrollment.status})`);
  }

  const summary: TrialExpirationSummary = {
    totalChecked: 1,
    totalExpired: 0,
    emailsSent: 0,
    emailsFailed: 0,
    errors: [],
  };

  await processExpiredEnrollment(enrollment, summary);

  console.log('[TrialManager] Manually expired trial:', enrollmentId, summary);
}
