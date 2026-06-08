/**
 * Workshop routes
 *
 * Handles workshop CRUD operations and enrollment management
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../types/hono.js';
import { validate } from '../utils/validation.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  success,
  badRequest,
  unauthorized,
  notFound,
  ErrorCodes,
  ErrorMessages,
} from '../utils/responses.js';
import {
  createWorkshopSchema,
  updateWorkshopSchema,
  enrollInWorkshopSchema,
} from '../utils/validation-workshops.js';
import {
  canUserEnrollInWorkshop,
  isWorkshopAcceptingEnrollments,
  calculateTrialExpiration,
} from '../utils/workshopAccess.js';
import type { WorkshopRow, WorkshopEnrollmentRow } from '../types/workshop.types.js';

const workshops = new Hono<HonoEnv>();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert database row to Workshop object (camelCase)
 */
function mapWorkshopRow(row: any) {
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
 * Convert database row to WorkshopEnrollment object (camelCase)
 */
function mapEnrollmentRow(row: any) {
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

// =============================================================================
// ADMIN ENDPOINTS (Workshop CRUD)
// =============================================================================

/**
 * POST /api/workshops
 *
 * Create a new workshop (admin only)
 */
workshops.post('/', requireAdmin, validate(createWorkshopSchema), async (c) => {
  const adminId = c.get('adminId');
  const data = c.get('validatedData') as any;
  const db = c.get('db');

  try {
    // Check if slug already exists
    const slugCheck = await db.query('SELECT id FROM workshops WHERE slug = $1', [data.slug]);

    if (slugCheck.rowCount > 0) {
      return badRequest(c, ErrorCodes.ALREADY_EXISTS, 'A workshop with this slug already exists');
    }

    // Insert workshop
    const result = await db.query(
      `INSERT INTO workshops (
        cohort_name, slug, description,
        workshop_type, location,
        primary_timezone, secondary_timezone,
        access_grant_datetime, trial_start_datetime, trial_duration_days,
        workshop_start_datetime, workshop_end_datetime,
        registration_deadline, max_enrollment,
        welcome_message, custom_email_templates, custom_email_schedule, post_workshop_resources,
        post_trial_action, send_reminder, reminder_hours_before,
        status, created_by
      ) VALUES (
        $1, $2, $3,
        $4, $5,
        $6, $7,
        $8, $9, $10,
        $11, $12,
        $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21,
        $22, $23
      ) RETURNING *`,
      [
        data.cohortName,
        data.slug,
        data.description || null,
        data.workshopType,
        data.location || null,
        data.primaryTimezone || 'America/Los_Angeles',
        data.secondaryTimezone || null,
        data.accessGrantDatetime,
        data.trialStartDatetime,
        data.trialDurationDays || 30,
        data.workshopStartDatetime,
        data.workshopEndDatetime,
        data.registrationDeadline || null,
        data.maxEnrollment || null,
        data.welcomeMessage || null,
        data.customEmailTemplates ? JSON.stringify(data.customEmailTemplates) : null,
        data.customEmailSchedule ? JSON.stringify(data.customEmailSchedule) : null,
        data.postWorkshopResources ? JSON.stringify(data.postWorkshopResources) : null,
        data.postTrialAction || 'upgrade_prompt',
        data.sendReminder !== undefined ? data.sendReminder : true,
        data.reminderHoursBefore || 24,
        data.status || 'draft',
        adminId,
      ]
    );

    const workshop = mapWorkshopRow(result.rows[0]);

    console.log('[Workshops] Created workshop:', workshop.id, workshop.cohortName);

    return success(c, { workshop }, 201);
  } catch (error) {
    console.error('[Workshops] Error creating workshop:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to create workshop');
  }
});

/**
 * GET /api/workshops
 *
 * List all workshops (admin only)
 */
workshops.get('/', requireAdmin, async (c) => {
  const db = c.get('db');

  try {
    const result = await db.query(
      `SELECT w.*,
        (SELECT COUNT(*) FROM workshop_enrollments WHERE workshop_id = w.id) as enrollment_count
       FROM workshops w
       ORDER BY w.created_at DESC`
    );

    const workshopsWithStats = result.rows.map((row) => {
      const workshop = mapWorkshopRow(row);
      return {
        ...workshop,
        enrollmentCount: parseInt(row.enrollment_count) || 0,
      };
    });

    return success(c, { workshops: workshopsWithStats });
  } catch (error) {
    console.error('[Workshops] Error fetching workshops:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch workshops');
  }
});

/**
 * GET /api/workshops/:id
 *
 * Get a single workshop by ID (admin only)
 */
workshops.get('/:id', requireAdmin, async (c) => {
  const workshopId = c.req.param('id');
  const db = c.get('db');

  try {
    const result = await db.query(
      `SELECT w.*,
        (SELECT COUNT(*) FROM workshop_enrollments WHERE workshop_id = w.id) as enrollment_count
       FROM workshops w
       WHERE w.id = $1`,
      [workshopId]
    );

    if (result.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Workshop not found');
    }

    const workshop = mapWorkshopRow(result.rows[0]);

    return success(c, {
      workshop: {
        ...workshop,
        enrollmentCount: parseInt(result.rows[0].enrollment_count) || 0,
      },
    });
  } catch (error) {
    console.error('[Workshops] Error fetching workshop:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch workshop');
  }
});

/**
 * PUT /api/workshops/:id
 *
 * Update a workshop (admin only)
 */
workshops.put('/:id', requireAdmin, validate(updateWorkshopSchema), async (c) => {
  const workshopId = c.req.param('id');
  const data = c.get('validatedData') as any;
  const db = c.get('db');

  try {
    // Check if workshop exists
    const checkResult = await db.query('SELECT id FROM workshops WHERE id = $1', [workshopId]);

    if (checkResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Workshop not found');
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.cohortName !== undefined) {
      updates.push(`cohort_name = $${paramCount++}`);
      values.push(data.cohortName);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(data.description);
    }
    if (data.workshopType !== undefined) {
      updates.push(`workshop_type = $${paramCount++}`);
      values.push(data.workshopType);
    }
    if (data.location !== undefined) {
      updates.push(`location = $${paramCount++}`);
      values.push(data.location);
    }
    if (data.primaryTimezone !== undefined) {
      updates.push(`primary_timezone = $${paramCount++}`);
      values.push(data.primaryTimezone);
    }
    if (data.secondaryTimezone !== undefined) {
      updates.push(`secondary_timezone = $${paramCount++}`);
      values.push(data.secondaryTimezone);
    }
    if (data.accessGrantDatetime !== undefined) {
      updates.push(`access_grant_datetime = $${paramCount++}`);
      values.push(data.accessGrantDatetime);
    }
    if (data.trialStartDatetime !== undefined) {
      updates.push(`trial_start_datetime = $${paramCount++}`);
      values.push(data.trialStartDatetime);
    }
    if (data.trialDurationDays !== undefined) {
      updates.push(`trial_duration_days = $${paramCount++}`);
      values.push(data.trialDurationDays);
    }
    if (data.workshopStartDatetime !== undefined) {
      updates.push(`workshop_start_datetime = $${paramCount++}`);
      values.push(data.workshopStartDatetime);
    }
    if (data.workshopEndDatetime !== undefined) {
      updates.push(`workshop_end_datetime = $${paramCount++}`);
      values.push(data.workshopEndDatetime);
    }
    if (data.registrationDeadline !== undefined) {
      updates.push(`registration_deadline = $${paramCount++}`);
      values.push(data.registrationDeadline);
    }
    if (data.maxEnrollment !== undefined) {
      updates.push(`max_enrollment = $${paramCount++}`);
      values.push(data.maxEnrollment);
    }
    if (data.welcomeMessage !== undefined) {
      updates.push(`welcome_message = $${paramCount++}`);
      values.push(data.welcomeMessage);
    }
    if (data.customEmailTemplates !== undefined) {
      updates.push(`custom_email_templates = $${paramCount++}`);
      values.push(data.customEmailTemplates ? JSON.stringify(data.customEmailTemplates) : null);
    }
    if (data.customEmailSchedule !== undefined) {
      updates.push(`custom_email_schedule = $${paramCount++}`);
      values.push(data.customEmailSchedule ? JSON.stringify(data.customEmailSchedule) : null);
    }
    if (data.postWorkshopResources !== undefined) {
      updates.push(`post_workshop_resources = $${paramCount++}`);
      values.push(data.postWorkshopResources ? JSON.stringify(data.postWorkshopResources) : null);
    }
    if (data.postTrialAction !== undefined) {
      updates.push(`post_trial_action = $${paramCount++}`);
      values.push(data.postTrialAction);
    }
    if (data.sendReminder !== undefined) {
      updates.push(`send_reminder = $${paramCount++}`);
      values.push(data.sendReminder);
    }
    if (data.reminderHoursBefore !== undefined) {
      updates.push(`reminder_hours_before = $${paramCount++}`);
      values.push(data.reminderHoursBefore);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(data.status);
    }

    if (updates.length === 0) {
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'No fields to update');
    }

    // Always update updated_at
    updates.push(`updated_at = NOW()`);
    values.push(workshopId);

    const result = await db.query(
      `UPDATE workshops
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    const workshop = mapWorkshopRow(result.rows[0]);

    console.log('[Workshops] Updated workshop:', workshop.id, workshop.cohortName);

    return success(c, { workshop });
  } catch (error) {
    console.error('[Workshops] Error updating workshop:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to update workshop');
  }
});

/**
 * DELETE /api/workshops/:id
 *
 * Soft delete a workshop (admin only)
 */
workshops.delete('/:id', requireAdmin, async (c) => {
  const workshopId = c.req.param('id');
  const db = c.get('db');

  try {
    // Check if workshop exists
    const checkResult = await db.query('SELECT id, status FROM workshops WHERE id = $1', [
      workshopId,
    ]);

    if (checkResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Workshop not found');
    }

    // Soft delete by archiving
    const result = await db.query(
      `UPDATE workshops
       SET status = 'archived', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [workshopId]
    );

    const workshop = mapWorkshopRow(result.rows[0]);

    console.log('[Workshops] Archived workshop:', workshop.id, workshop.cohortName);

    return success(c, { workshop });
  } catch (error) {
    console.error('[Workshops] Error deleting workshop:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to delete workshop');
  }
});

/**
 * GET /api/workshops/slug/:slug
 *
 * Get workshop by slug (public for signup page)
 */
workshops.get('/slug/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = c.get('db');

  try {
    const result = await db.query(
      `SELECT w.*,
        (SELECT COUNT(*) FROM workshop_enrollments WHERE workshop_id = w.id) as enrollment_count
       FROM workshops w
       WHERE w.slug = $1`,
      [slug]
    );

    if (result.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Workshop not found');
    }

    const workshop = mapWorkshopRow(result.rows[0]);
    const enrollmentCount = parseInt(result.rows[0].enrollment_count) || 0;

    // Public view should not expose all fields
    return success(c, {
      workshop: {
        id: workshop.id,
        cohortName: workshop.cohortName,
        slug: workshop.slug,
        description: workshop.description,
        workshopType: workshop.workshopType,
        location: workshop.location,
        primaryTimezone: workshop.primaryTimezone,
        secondaryTimezone: workshop.secondaryTimezone,
        workshopStartDatetime: workshop.workshopStartDatetime,
        workshopEndDatetime: workshop.workshopEndDatetime,
        registrationDeadline: workshop.registrationDeadline,
        status: workshop.status,
        enrollmentCount,
        isFull: workshop.maxEnrollment ? enrollmentCount >= workshop.maxEnrollment : false,
        spotsRemaining: workshop.maxEnrollment
          ? Math.max(0, workshop.maxEnrollment - enrollmentCount)
          : null,
      },
    });
  } catch (error) {
    console.error('[Workshops] Error fetching workshop by slug:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch workshop');
  }
});

// =============================================================================
// ENROLLMENT ENDPOINTS
// =============================================================================

/**
 * POST /api/workshops/:id/enroll
 *
 * Enroll in a workshop (authenticated users)
 */
workshops.post('/:id/enroll', requireAuth, async (c) => {
  const workshopId = c.req.param('id');
  const userId = c.get('userId');
  const db = c.get('db');

  try {
    // Get workshop details
    const workshopResult = await db.query('SELECT * FROM workshops WHERE id = $1', [workshopId]);

    if (workshopResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Workshop not found');
    }

    const workshopRow = workshopResult.rows[0];
    const workshop = mapWorkshopRow(workshopRow);

    // Check if already enrolled
    const enrollmentCheck = await db.query(
      'SELECT id FROM workshop_enrollments WHERE user_id = $1 AND workshop_id = $2',
      [userId, workshopId]
    );

    const isAlreadyEnrolled = enrollmentCheck.rowCount > 0;

    // Get current enrollment count
    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM workshop_enrollments WHERE workshop_id = $1',
      [workshopId]
    );
    const currentEnrollmentCount = parseInt(countResult.rows[0].count) || 0;

    // Check if user can enroll
    const eligibility = canUserEnrollInWorkshop(workshop, currentEnrollmentCount, isAlreadyEnrolled);

    if (!eligibility.canEnroll) {
      return badRequest(c, ErrorCodes.INVALID_INPUT, eligibility.reason || 'Cannot enroll');
    }

    // Create enrollment
    const enrollmentResult = await db.query(
      `INSERT INTO workshop_enrollments (
        user_id, workshop_id, status
      ) VALUES ($1, $2, 'enrolled')
      RETURNING *`,
      [userId, workshopId]
    );

    const enrollment = mapEnrollmentRow(enrollmentResult.rows[0]);

    // Update user's current workshop enrollment
    await db.query('UPDATE users SET current_workshop_enrollment_id = $1 WHERE id = $2', [
      enrollment.id,
      userId,
    ]);

    console.log('[Workshops] User enrolled:', userId, 'in workshop:', workshopId);

    return success(c, { enrollment }, 201);
  } catch (error) {
    console.error('[Workshops] Error enrolling user:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to enroll in workshop');
  }
});

/**
 * GET /api/workshops/:id/enrollments
 *
 * List enrollments for a workshop (admin only)
 */
workshops.get('/:id/enrollments', requireAdmin, async (c) => {
  const workshopId = c.req.param('id');
  const db = c.get('db');

  try {
    const result = await db.query(
      `SELECT we.*,
        u.email, u.first_name, u.last_name, u.company_name
       FROM workshop_enrollments we
       JOIN users u ON we.user_id = u.id
       WHERE we.workshop_id = $1
       ORDER BY we.enrolled_at DESC`,
      [workshopId]
    );

    const enrollments = result.rows.map((row) => {
      const enrollment = mapEnrollmentRow(row);
      return {
        ...enrollment,
        user: {
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          companyName: row.company_name,
        },
      };
    });

    return success(c, { enrollments });
  } catch (error) {
    console.error('[Workshops] Error fetching enrollments:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch enrollments');
  }
});

/**
 * PUT /api/enrollments/:id/grant-access
 *
 * Grant platform access to enrolled user (admin only)
 */
workshops.put('/enrollments/:id/grant-access', requireAdmin, async (c) => {
  const enrollmentId = c.req.param('id');
  const db = c.get('db');

  try {
    // Check if enrollment exists
    const checkResult = await db.query(
      'SELECT id, status FROM workshop_enrollments WHERE id = $1',
      [enrollmentId]
    );

    if (checkResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Enrollment not found');
    }

    // Update enrollment status to active
    const result = await db.query(
      `UPDATE workshop_enrollments
       SET status = 'active', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [enrollmentId]
    );

    const enrollment = mapEnrollmentRow(result.rows[0]);

    console.log('[Workshops] Granted access to enrollment:', enrollmentId);

    return success(c, { enrollment });
  } catch (error) {
    console.error('[Workshops] Error granting access:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to grant access');
  }
});

/**
 * PUT /api/enrollments/:id/start-trial
 *
 * Start trial period for enrolled user (admin only)
 */
workshops.put('/enrollments/:id/start-trial', requireAdmin, async (c) => {
  const enrollmentId = c.req.param('id');
  const db = c.get('db');

  try {
    // Get enrollment and workshop details
    const enrollmentResult = await db.query(
      `SELECT we.*, w.trial_duration_days
       FROM workshop_enrollments we
       JOIN workshops w ON we.workshop_id = w.id
       WHERE we.id = $1`,
      [enrollmentId]
    );

    if (enrollmentResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Enrollment not found');
    }

    const row = enrollmentResult.rows[0];

    // Calculate trial expiration
    const now = new Date();
    const trialExpiresAt = new Date(now);
    trialExpiresAt.setDate(trialExpiresAt.getDate() + row.trial_duration_days);

    // Update enrollment with trial dates
    const result = await db.query(
      `UPDATE workshop_enrollments
       SET trial_started_at = NOW(),
           trial_expires_at = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [trialExpiresAt, enrollmentId]
    );

    const enrollment = mapEnrollmentRow(result.rows[0]);

    console.log('[Workshops] Started trial for enrollment:', enrollmentId);

    return success(c, { enrollment });
  } catch (error) {
    console.error('[Workshops] Error starting trial:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to start trial');
  }
});

export default workshops;
