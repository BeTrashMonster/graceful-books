/**
 * Workshop Access Middleware
 *
 * Middleware for controlling platform access based on workshop enrollment status.
 * Handles the hybrid user model where regular users get immediate access while
 * workshop participants follow a structured, time-gated educational journey.
 *
 * USAGE:
 *   app.get('/dashboard', requireAuth, checkWorkshopAccess, async (c) => {
 *     // User has workshop access or is regular user
 *   });
 */

import { Context, Next } from 'hono';
import { Pool } from 'pg';
import {
  hasWorkshopAccess,
  hasTrialStarted,
  calculateTrialExpiration,
} from '../utils/workshopAccess.js';
import {
  unauthorized,
  ErrorCodes,
  ErrorMessages,
} from '../utils/responses.js';
import type { Workshop, WorkshopEnrollment } from '../types/workshop.types.js';
import type { WorkshopRow, WorkshopEnrollmentRow } from '../types/workshop.types.js';

// =============================================================================
// DATABASE HELPER FUNCTIONS
// =============================================================================

/**
 * Convert database row to Workshop type
 */
function mapWorkshopRowToWorkshop(row: WorkshopRow): Workshop {
  return {
    id: row.id,
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
    customEmailTemplates: row.custom_email_templates,
    customEmailSchedule: row.custom_email_schedule,
    postWorkshopResources: row.post_workshop_resources,
    postTrialAction: row.post_trial_action,
    sendReminder: row.send_reminder,
    reminderHoursBefore: row.reminder_hours_before,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert database row to WorkshopEnrollment type
 */
function mapEnrollmentRowToEnrollment(row: WorkshopEnrollmentRow): WorkshopEnrollment {
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
    emailsSent: row.emails_sent || [],
    lastActiveAt: row.last_active_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get workshop enrollment by ID
 */
async function getEnrollment(
  db: Pool,
  enrollmentId: string
): Promise<WorkshopEnrollment | null> {
  const result = await db.query<WorkshopEnrollmentRow>(
    'SELECT * FROM workshop_enrollments WHERE id = $1',
    [enrollmentId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapEnrollmentRowToEnrollment(result.rows[0]);
}

/**
 * Get workshop by ID
 */
async function getWorkshop(db: Pool, workshopId: string): Promise<Workshop | null> {
  const result = await db.query<WorkshopRow>(
    'SELECT * FROM workshops WHERE id = $1',
    [workshopId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapWorkshopRowToWorkshop(result.rows[0]);
}

/**
 * Update enrollment status
 */
async function updateEnrollmentStatus(
  db: Pool,
  enrollmentId: string,
  status: WorkshopEnrollment['status']
): Promise<void> {
  await db.query(
    'UPDATE workshop_enrollments SET status = $1, updated_at = NOW() WHERE id = $2',
    [status, enrollmentId]
  );
}

/**
 * Update enrollment trial dates
 */
async function updateEnrollmentTrialDates(
  db: Pool,
  enrollmentId: string,
  trialStartedAt: Date,
  trialExpiresAt: Date
): Promise<void> {
  await db.query(
    `UPDATE workshop_enrollments
     SET trial_started_at = $1, trial_expires_at = $2, updated_at = NOW()
     WHERE id = $3`,
    [trialStartedAt, trialExpiresAt, enrollmentId]
  );
}

/**
 * Update enrollment first login
 */
async function updateEnrollmentFirstLogin(
  db: Pool,
  enrollmentId: string,
  firstLoginAt: Date
): Promise<void> {
  await db.query(
    `UPDATE workshop_enrollments
     SET first_login_at = $1, updated_at = NOW()
     WHERE id = $2`,
    [firstLoginAt, enrollmentId]
  );
}

/**
 * Get user with workshop enrollment info
 */
async function getUserWithWorkshopEnrollment(
  db: Pool,
  userId: string
): Promise<{ currentWorkshopEnrollmentId: string | null } | null> {
  const result = await db.query(
    'SELECT current_workshop_enrollment_id FROM users WHERE id = $1',
    [userId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return {
    currentWorkshopEnrollmentId: result.rows[0].current_workshop_enrollment_id,
  };
}

// =============================================================================
// MIDDLEWARE FUNCTIONS
// =============================================================================

/**
 * Load workshop enrollment info if user has one
 *
 * This middleware loads the user's workshop enrollment and workshop details
 * and attaches them to the context for use by downstream middleware/handlers.
 *
 * Sets context variables:
 * - workshopEnrollment: WorkshopEnrollment | null
 * - workshop: Workshop | null
 *
 * @example
 * app.get('/api/dashboard', requireAuth, loadWorkshopEnrollment, async (c) => {
 *   const enrollment = c.get('workshopEnrollment');
 *   const workshop = c.get('workshop');
 *   // Use enrollment/workshop data if available
 * });
 */
export async function loadWorkshopEnrollment(c: Context, next: Next): Promise<Response | void> {
  const userId = c.get('userId') as string | undefined;
  const db = c.get('db') as Pool;

  // If no userId, user is not authenticated - skip workshop loading
  if (!userId) {
    c.set('workshopEnrollment', null);
    c.set('workshop', null);
    await next();
    return;
  }

  try {
    // Get user's current workshop enrollment
    const user = await getUserWithWorkshopEnrollment(db, userId);

    if (!user || !user.currentWorkshopEnrollmentId) {
      // User is not in a workshop
      c.set('workshopEnrollment', null);
      c.set('workshop', null);
      await next();
      return;
    }

    // Load enrollment details
    const enrollment = await getEnrollment(db, user.currentWorkshopEnrollmentId);

    if (!enrollment) {
      // Enrollment not found (data inconsistency)
      console.error(
        `[WorkshopAccess] Enrollment ${user.currentWorkshopEnrollmentId} not found for user ${userId}`
      );
      c.set('workshopEnrollment', null);
      c.set('workshop', null);
      await next();
      return;
    }

    // Load workshop details
    const workshop = await getWorkshop(db, enrollment.workshopId);

    if (!workshop) {
      // Workshop not found (data inconsistency)
      console.error(
        `[WorkshopAccess] Workshop ${enrollment.workshopId} not found for enrollment ${enrollment.id}`
      );
      c.set('workshopEnrollment', null);
      c.set('workshop', null);
      await next();
      return;
    }

    // Attach to context
    c.set('workshopEnrollment', enrollment);
    c.set('workshop', workshop);

    await next();
  } catch (error) {
    console.error('[WorkshopAccess] Error loading workshop enrollment:', error);
    // On error, proceed without workshop data
    c.set('workshopEnrollment', null);
    c.set('workshop', null);
    await next();
  }
}

/**
 * Check if user has workshop access
 *
 * Main middleware for controlling platform access based on workshop enrollment.
 * Regular users bypass all checks. Workshop users are blocked until access time.
 *
 * IMPORTANT: Must be used AFTER requireAuth and loadWorkshopEnrollment middleware.
 *
 * @example
 * app.get('/dashboard', requireAuth, loadWorkshopEnrollment, checkWorkshopAccess, async (c) => {
 *   // User has access to platform
 * });
 */
export async function checkWorkshopAccess(c: Context, next: Next): Promise<Response | void> {
  const userId = c.get('userId') as string | undefined;
  const enrollment = c.get('workshopEnrollment') as WorkshopEnrollment | null | undefined;
  const workshop = c.get('workshop') as Workshop | null | undefined;
  const db = c.get('db') as Pool;

  // If no userId, require authentication
  if (!userId) {
    return unauthorized(c, ErrorCodes.UNAUTHORIZED, ErrorMessages.UNAUTHORIZED);
  }

  // If user is not in a workshop, grant access (regular user)
  if (!enrollment || !workshop) {
    await next();
    return;
  }

  // User is in a workshop - check if access time has arrived
  if (hasWorkshopAccess(enrollment, workshop)) {
    // Access granted - update enrollment status if needed
    if (enrollment.status === 'enrolled') {
      await updateEnrollmentStatus(db, enrollment.id, 'active');

      // Start trial if it should start now and hasn't started yet
      if (hasTrialStarted(enrollment, workshop) && !enrollment.trialStartedAt) {
        const trialStartedAt = new Date();
        const trialExpiresAt = calculateTrialExpiration(workshop, trialStartedAt);

        await updateEnrollmentTrialDates(db, enrollment.id, trialStartedAt, trialExpiresAt);
      }

      // Track first login if not already tracked
      if (!enrollment.firstLoginAt) {
        await updateEnrollmentFirstLogin(db, enrollment.id, new Date());
      }
    }

    // Grant access
    await next();
    return;
  }

  // Access not yet granted - show countdown page error
  return c.json(
    {
      error: {
        code: 'WORKSHOP_ACCESS_PENDING',
        message: 'Your workshop access begins soon. We can\'t wait to see you there!',
        details: {
          workshop: {
            cohortName: workshop.cohortName,
            accessGrantDatetime: workshop.accessGrantDatetime,
            workshopStartDatetime: workshop.workshopStartDatetime,
            welcomeMessage: workshop.welcomeMessage,
            primaryTimezone: workshop.primaryTimezone,
            secondaryTimezone: workshop.secondaryTimezone,
          },
        },
      },
    },
    403
  );
}

/**
 * Require workshop completion or trial
 *
 * Ensures user has either completed workshop or has active trial.
 * Use this for features that require workshop participation.
 *
 * IMPORTANT: Must be used AFTER requireAuth and loadWorkshopEnrollment middleware.
 *
 * @example
 * app.get('/advanced-features', requireAuth, loadWorkshopEnrollment, requireWorkshopCompletion, async (c) => {
 *   // User has completed workshop or has active trial
 * });
 */
export async function requireWorkshopCompletion(c: Context, next: Next): Promise<Response | void> {
  const userId = c.get('userId') as string | undefined;
  const enrollment = c.get('workshopEnrollment') as WorkshopEnrollment | null | undefined;
  const workshop = c.get('workshop') as Workshop | null | undefined;

  // If no userId, require authentication
  if (!userId) {
    return unauthorized(c, ErrorCodes.UNAUTHORIZED, ErrorMessages.UNAUTHORIZED);
  }

  // If user is not in a workshop, they need to enroll first
  if (!enrollment || !workshop) {
    return c.json(
      {
        error: {
          code: 'WORKSHOP_REQUIRED',
          message: 'This feature requires workshop participation',
        },
      },
      403
    );
  }

  // Check if user has access to the workshop
  if (!hasWorkshopAccess(enrollment, workshop)) {
    return c.json(
      {
        error: {
          code: 'WORKSHOP_ACCESS_PENDING',
          message: 'This feature will be available when your workshop begins',
          details: {
            workshop: {
              cohortName: workshop.cohortName,
              accessGrantDatetime: workshop.accessGrantDatetime,
              workshopStartDatetime: workshop.workshopStartDatetime,
            },
          },
        },
      },
      403
    );
  }

  // Check enrollment status
  const validStatuses: WorkshopEnrollment['status'][] = ['active', 'converted'];

  if (!validStatuses.includes(enrollment.status)) {
    if (enrollment.status === 'trial_expired') {
      return c.json(
        {
          error: {
            code: 'TRIAL_EXPIRED',
            message: 'Your trial has expired. Please upgrade to continue accessing this feature.',
          },
        },
        403
      );
    }

    return c.json(
      {
        error: {
          code: 'INVALID_ENROLLMENT_STATUS',
          message: 'Your enrollment status does not allow access to this feature',
        },
      },
      403
    );
  }

  // User has valid workshop access
  await next();
}
