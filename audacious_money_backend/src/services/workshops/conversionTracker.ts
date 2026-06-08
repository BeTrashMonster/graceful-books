/**
 * Conversion Tracker Service
 *
 * Service for tracking workshop participant conversions from trial to paid.
 * Provides analytics and reporting for conversion metrics.
 */

import { getDbConnection } from '../../db/connection.js';
import type { WorkshopEnrollmentRow, WorkshopRow } from '../../types/workshop.types.js';

/**
 * Conversion metrics for a single enrollment
 */
export interface ConversionMetrics {
  enrollmentId: string;
  userId: string;
  workshopId: string;
  enrolledAt: Date;
  trialStartedAt: Date | null;
  convertedAt: Date | null;
  timeToConversion: number | null; // In hours
  timeFromTrialStart: number | null; // In hours
  conversionSource: 'during_trial' | 'post_trial' | 'manual' | null;
}

/**
 * Workshop conversion report
 */
export interface WorkshopConversionReport {
  workshopId: string;
  workshopName: string;
  totalEnrollments: number;
  activeTrials: number;
  expiredTrials: number;
  conversions: number;
  conversionRate: number; // Percentage
  averageTimeToConversion: number | null; // In hours
  revenueAttribution: number; // Total revenue from conversions
  conversionsBySource: {
    during_trial: number;
    post_trial: number;
    manual: number;
  };
}

/**
 * Record a conversion when a workshop participant upgrades to paid
 */
export async function recordConversion(
  enrollmentId: string,
  conversionSource: 'during_trial' | 'post_trial' | 'manual' = 'during_trial'
): Promise<ConversionMetrics> {
  const db = getDbConnection();

  console.log(`[ConversionTracker] Recording conversion for enrollment ${enrollmentId}`);

  // Get the enrollment
  const enrollmentResult = await db.query<WorkshopEnrollmentRow>(
    `SELECT * FROM workshop_enrollments WHERE id = $1`,
    [enrollmentId]
  );

  if (enrollmentResult.rows.length === 0) {
    throw new Error(`Enrollment ${enrollmentId} not found`);
  }

  const enrollment = enrollmentResult.rows[0];

  // Prevent duplicate conversions
  if (enrollment.status === 'converted') {
    console.warn(`[ConversionTracker] Enrollment ${enrollmentId} already converted`);
    return buildConversionMetrics(enrollment, conversionSource);
  }

  // Update enrollment status to 'converted'
  await db.query(
    `UPDATE workshop_enrollments
     SET status = 'converted',
         converted_to_paid_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [enrollmentId]
  );

  console.log(`[ConversionTracker] Updated enrollment ${enrollmentId} to converted status`);

  // Optionally remove workshop_enrollment_id from user (graduate to regular user)
  await db.query(
    `UPDATE users
     SET current_workshop_enrollment_id = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [enrollment.user_id]
  );

  console.log(`[ConversionTracker] Graduated user ${enrollment.user_id} to regular user status`);

  // Get updated enrollment with converted_to_paid_at
  const updatedResult = await db.query<WorkshopEnrollmentRow>(
    `SELECT * FROM workshop_enrollments WHERE id = $1`,
    [enrollmentId]
  );

  const updatedEnrollment = updatedResult.rows[0];

  return buildConversionMetrics(updatedEnrollment, conversionSource);
}

/**
 * Build conversion metrics from enrollment data
 */
function buildConversionMetrics(
  enrollment: WorkshopEnrollmentRow,
  conversionSource: 'during_trial' | 'post_trial' | 'manual'
): ConversionMetrics {
  const enrolledAt = new Date(enrollment.enrolled_at);
  const trialStartedAt = enrollment.trial_started_at ? new Date(enrollment.trial_started_at) : null;
  const convertedAt = enrollment.converted_to_paid_at ? new Date(enrollment.converted_to_paid_at) : null;

  let timeToConversion: number | null = null;
  let timeFromTrialStart: number | null = null;

  if (convertedAt) {
    // Time from enrollment to conversion (in hours)
    timeToConversion = (convertedAt.getTime() - enrolledAt.getTime()) / (1000 * 60 * 60);

    // Time from trial start to conversion (in hours)
    if (trialStartedAt) {
      timeFromTrialStart = (convertedAt.getTime() - trialStartedAt.getTime()) / (1000 * 60 * 60);
    }
  }

  return {
    enrollmentId: enrollment.id,
    userId: enrollment.user_id,
    workshopId: enrollment.workshop_id,
    enrolledAt,
    trialStartedAt,
    convertedAt,
    timeToConversion,
    timeFromTrialStart,
    conversionSource,
  };
}

/**
 * Get conversion report for a specific workshop
 */
export async function getWorkshopConversionReport(
  workshopId: string
): Promise<WorkshopConversionReport> {
  const db = getDbConnection();

  console.log(`[ConversionTracker] Generating conversion report for workshop ${workshopId}`);

  // Get workshop info
  const workshopResult = await db.query<WorkshopRow>(
    `SELECT * FROM workshops WHERE id = $1`,
    [workshopId]
  );

  if (workshopResult.rows.length === 0) {
    throw new Error(`Workshop ${workshopId} not found`);
  }

  const workshop = workshopResult.rows[0];

  // Get enrollment statistics
  const statsResult = await db.query(
    `SELECT
       COUNT(*) as total_enrollments,
       COUNT(*) FILTER (WHERE status = 'active') as active_trials,
       COUNT(*) FILTER (WHERE status = 'trial_expired') as expired_trials,
       COUNT(*) FILTER (WHERE status = 'converted') as conversions
     FROM workshop_enrollments
     WHERE workshop_id = $1`,
    [workshopId]
  );

  const stats = statsResult.rows[0];

  // Calculate conversion rate
  const totalEnrollments = parseInt(stats.total_enrollments, 10);
  const conversions = parseInt(stats.conversions, 10);
  const conversionRate = totalEnrollments > 0 ? (conversions / totalEnrollments) * 100 : 0;

  // Calculate average time to conversion
  const avgTimeResult = await db.query(
    `SELECT AVG(EXTRACT(EPOCH FROM (converted_to_paid_at - enrolled_at)) / 3600) as avg_hours
     FROM workshop_enrollments
     WHERE workshop_id = $1 AND status = 'converted'`,
    [workshopId]
  );

  const averageTimeToConversion = avgTimeResult.rows[0].avg_hours
    ? parseFloat(avgTimeResult.rows[0].avg_hours)
    : null;

  // Get conversions by source
  // Note: This would require storing conversion_source in the database
  // For now, we'll estimate based on timing
  const conversionsBySource = await estimateConversionsBySource(workshopId);

  // Calculate revenue attribution
  // This would integrate with Stripe to get actual subscription revenue
  // For now, we'll estimate based on number of conversions
  const revenueAttribution = calculateRevenueAttribution(conversions);

  return {
    workshopId,
    workshopName: workshop.cohort_name,
    totalEnrollments,
    activeTrials: parseInt(stats.active_trials, 10),
    expiredTrials: parseInt(stats.expired_trials, 10),
    conversions,
    conversionRate: Math.round(conversionRate * 100) / 100, // Round to 2 decimals
    averageTimeToConversion,
    revenueAttribution,
    conversionsBySource,
  };
}

/**
 * Estimate conversions by source based on timing
 */
async function estimateConversionsBySource(workshopId: string): Promise<{
  during_trial: number;
  post_trial: number;
  manual: number;
}> {
  const db = getDbConnection();

  // Conversions during trial: converted before trial expiration
  const duringTrialResult = await db.query(
    `SELECT COUNT(*) FROM workshop_enrollments
     WHERE workshop_id = $1
       AND status = 'converted'
       AND converted_to_paid_at <= trial_expires_at`,
    [workshopId]
  );

  // Conversions post-trial: converted after trial expiration
  const postTrialResult = await db.query(
    `SELECT COUNT(*) FROM workshop_enrollments
     WHERE workshop_id = $1
       AND status = 'converted'
       AND converted_to_paid_at > trial_expires_at`,
    [workshopId]
  );

  const duringTrial = parseInt(duringTrialResult.rows[0].count, 10);
  const postTrial = parseInt(postTrialResult.rows[0].count, 10);

  // Manual conversions (assume remainder are manual or unknown)
  // In practice, you'd store this explicitly
  const manual = 0;

  return {
    during_trial: duringTrial,
    post_trial: postTrial,
    manual,
  };
}

/**
 * Calculate revenue attribution for conversions
 *
 * Note: This is a placeholder. In production, you would:
 * 1. Get subscription data from Stripe
 * 2. Calculate actual MRR/ARR
 * 3. Apply any workshop-specific pricing
 */
function calculateRevenueAttribution(conversions: number): number {
  // Placeholder calculation
  // Assuming $99/month subscription
  const monthlyPrice = 99;
  return conversions * monthlyPrice;
}

/**
 * Get all conversion metrics for a workshop
 */
export async function getWorkshopConversionMetrics(
  workshopId: string
): Promise<ConversionMetrics[]> {
  const db = getDbConnection();

  const result = await db.query<WorkshopEnrollmentRow>(
    `SELECT * FROM workshop_enrollments
     WHERE workshop_id = $1 AND status = 'converted'
     ORDER BY converted_to_paid_at DESC`,
    [workshopId]
  );

  return result.rows.map((enrollment) => {
    // Determine conversion source based on timing
    let conversionSource: 'during_trial' | 'post_trial' | 'manual' = 'manual';

    if (enrollment.converted_to_paid_at && enrollment.trial_expires_at) {
      const convertedAt = new Date(enrollment.converted_to_paid_at);
      const expiresAt = new Date(enrollment.trial_expires_at);

      if (convertedAt <= expiresAt) {
        conversionSource = 'during_trial';
      } else {
        conversionSource = 'post_trial';
      }
    }

    return buildConversionMetrics(enrollment, conversionSource);
  });
}

/**
 * Export conversion data for analytics
 *
 * Returns conversion data in a format suitable for CSV export or analytics tools
 */
export async function exportConversionData(workshopId: string): Promise<Array<{
  enrollmentId: string;
  userId: string;
  userEmail: string;
  enrolledAt: string;
  trialStartedAt: string | null;
  convertedAt: string | null;
  hoursToConversion: number | null;
  conversionSource: string | null;
  workshopName: string;
}>> {
  const db = getDbConnection();

  const result = await db.query(
    `SELECT
       we.id as enrollment_id,
       we.user_id,
       u.email as user_email,
       we.enrolled_at,
       we.trial_started_at,
       we.converted_to_paid_at,
       EXTRACT(EPOCH FROM (we.converted_to_paid_at - we.enrolled_at)) / 3600 as hours_to_conversion,
       we.trial_expires_at,
       w.cohort_name as workshop_name
     FROM workshop_enrollments we
     JOIN users u ON we.user_id = u.id
     JOIN workshops w ON we.workshop_id = w.id
     WHERE we.workshop_id = $1 AND we.status = 'converted'
     ORDER BY we.converted_to_paid_at DESC`,
    [workshopId]
  );

  return result.rows.map((row) => {
    let conversionSource: string | null = null;

    if (row.converted_to_paid_at && row.trial_expires_at) {
      const convertedAt = new Date(row.converted_to_paid_at);
      const expiresAt = new Date(row.trial_expires_at);

      conversionSource = convertedAt <= expiresAt ? 'during_trial' : 'post_trial';
    }

    return {
      enrollmentId: row.enrollment_id,
      userId: row.user_id,
      userEmail: row.user_email,
      enrolledAt: row.enrolled_at.toISOString(),
      trialStartedAt: row.trial_started_at ? row.trial_started_at.toISOString() : null,
      convertedAt: row.converted_to_paid_at ? row.converted_to_paid_at.toISOString() : null,
      hoursToConversion: row.hours_to_conversion ? parseFloat(row.hours_to_conversion) : null,
      conversionSource,
      workshopName: row.workshop_name,
    };
  });
}

/**
 * Get overall conversion statistics across all workshops
 */
export async function getOverallConversionStatistics(): Promise<{
  totalWorkshops: number;
  totalEnrollments: number;
  totalConversions: number;
  overallConversionRate: number;
  totalRevenue: number;
  topPerformingWorkshops: Array<{
    workshopId: string;
    workshopName: string;
    conversionRate: number;
    conversions: number;
  }>;
}> {
  const db = getDbConnection();

  // Get overall statistics
  const overallResult = await db.query(
    `SELECT
       COUNT(DISTINCT w.id) as total_workshops,
       COUNT(DISTINCT we.id) as total_enrollments,
       COUNT(DISTINCT we.id) FILTER (WHERE we.status = 'converted') as total_conversions
     FROM workshops w
     LEFT JOIN workshop_enrollments we ON w.id = we.workshop_id`,
    []
  );

  const overall = overallResult.rows[0];
  const totalEnrollments = parseInt(overall.total_enrollments, 10);
  const totalConversions = parseInt(overall.total_conversions, 10);
  const overallConversionRate =
    totalEnrollments > 0 ? (totalConversions / totalEnrollments) * 100 : 0;

  // Get top performing workshops
  const topPerformingResult = await db.query(
    `SELECT
       w.id as workshop_id,
       w.cohort_name as workshop_name,
       COUNT(*) as total_enrollments,
       COUNT(*) FILTER (WHERE we.status = 'converted') as conversions,
       CASE
         WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE we.status = 'converted')::float / COUNT(*)::float) * 100
         ELSE 0
       END as conversion_rate
     FROM workshops w
     LEFT JOIN workshop_enrollments we ON w.id = we.workshop_id
     GROUP BY w.id, w.cohort_name
     HAVING COUNT(*) > 0
     ORDER BY conversion_rate DESC
     LIMIT 5`,
    []
  );

  const topPerformingWorkshops = topPerformingResult.rows.map((row) => ({
    workshopId: row.workshop_id,
    workshopName: row.workshop_name,
    conversionRate: parseFloat(row.conversion_rate),
    conversions: parseInt(row.conversions, 10),
  }));

  return {
    totalWorkshops: parseInt(overall.total_workshops, 10),
    totalEnrollments,
    totalConversions,
    overallConversionRate: Math.round(overallConversionRate * 100) / 100,
    totalRevenue: calculateRevenueAttribution(totalConversions),
    topPerformingWorkshops,
  };
}
