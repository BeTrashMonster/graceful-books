/**
 * Workshop routes
 *
 * Handles workshop CRUD operations and enrollment management
 */

import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { HonoEnv } from '../types/hono.js';
import { validate } from '../utils/validation.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimit.js';
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
  workshopSignupSchema,
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
    workshopName: row.workshop_name,
    slug: row.slug,
    description: row.description,
    workshopType: row.workshop_type,
    location: row.location,
    primaryTimezone: row.primary_timezone,
    secondaryTimezone: row.secondary_timezone,
    stripePriceId: row.stripe_price_id,
    trialDurationDays: row.trial_duration_days,
    accessGrantDatetime: row.access_grant_datetime,
    trialStartDatetime: row.trial_start_datetime,
    workshopStartDatetime: row.workshop_start_datetime,
    workshopEndDatetime: row.workshop_end_datetime,
    registrationDeadline: row.registration_deadline,
    maxEnrollment: row.max_enrollment,
    welcomeMessage: row.welcome_message,
    customEmailTemplates: row.custom_email_templates,
    postWorkshopResources: row.post_workshop_resources,
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
    worksheetCompletedAt: row.worksheet_completed_at,
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
        cohort_name, workshop_name, slug, description,
        workshop_type, location,
        primary_timezone, secondary_timezone,
        stripe_price_id, trial_duration_days,
        access_grant_datetime, trial_start_datetime, workshop_start_datetime, workshop_end_datetime,
        registration_deadline, max_enrollment,
        welcome_message, custom_email_templates, post_workshop_resources,
        send_reminder, reminder_hours_before,
        status, created_by
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6,
        $7, $8,
        $9, $10,
        $11, $12, $13, $14,
        $15, $16,
        $17, $18, $19,
        $20, $21,
        $22, $23
      ) RETURNING *`,
      [
        data.cohortName,
        data.workshopName,
        data.slug,
        data.description || null,
        data.workshopType,
        data.location || null,
        data.primaryTimezone || 'America/Los_Angeles',
        data.secondaryTimezone || null,
        data.stripePriceId,
        data.trialDurationDays || 30,
        data.accessGrantDatetime,
        data.workshopStartDatetime, // trial_start_datetime = workshop start (trial begins when workshop begins)
        data.workshopStartDatetime,
        data.workshopEndDatetime,
        data.registrationDeadline || null,
        data.maxEnrollment || null,
        data.welcomeMessage || null,
        data.customEmailTemplates ? JSON.stringify(data.customEmailTemplates) : null,
        data.postWorkshopResources ? JSON.stringify(data.postWorkshopResources) : null,
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
    console.error('[Workshops] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any).code,
      detail: (error as any).detail,
      constraint: (error as any).constraint,
      table: (error as any).table,
      adminId,
    });

    // Return more helpful error message
    let errorMessage = 'Failed to create workshop';
    if ((error as any).constraint === 'workshops_created_by_fkey') {
      errorMessage = 'Admin user not found in database. Please ensure admin_users table is properly set up.';
    } else if ((error as any).code === '23505') {
      errorMessage = 'A workshop with this slug already exists';
    }

    return badRequest(c, ErrorCodes.INTERNAL_ERROR, errorMessage);
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

    // If slug is being updated, check uniqueness
    if (data.slug !== undefined) {
      const slugCheck = await db.query(
        'SELECT id FROM workshops WHERE slug = $1 AND id != $2',
        [data.slug, workshopId]
      );
      if (slugCheck.rowCount > 0) {
        return badRequest(c, ErrorCodes.ALREADY_EXISTS, 'A workshop with this slug already exists');
      }
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.cohortName !== undefined) {
      updates.push(`cohort_name = $${paramCount++}`);
      values.push(data.cohortName);
    }
    if (data.workshopName !== undefined) {
      updates.push(`workshop_name = $${paramCount++}`);
      values.push(data.workshopName);
    }
    if (data.slug !== undefined) {
      updates.push(`slug = $${paramCount++}`);
      values.push(data.slug);
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
    if (data.stripePriceId !== undefined) {
      updates.push(`stripe_price_id = $${paramCount++}`);
      values.push(data.stripePriceId);
    }
    if (data.trialDurationDays !== undefined) {
      updates.push(`trial_duration_days = $${paramCount++}`);
      values.push(data.trialDurationDays);
    }
    if (data.accessGrantDatetime !== undefined) {
      updates.push(`access_grant_datetime = $${paramCount++}`);
      values.push(data.accessGrantDatetime);
    }
    if (data.workshopStartDatetime !== undefined) {
      updates.push(`workshop_start_datetime = $${paramCount++}`);
      values.push(data.workshopStartDatetime);
      // Trial starts when workshop starts
      updates.push(`trial_start_datetime = $${paramCount++}`);
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
    if (data.postWorkshopResources !== undefined) {
      updates.push(`post_workshop_resources = $${paramCount++}`);
      values.push(data.postWorkshopResources ? JSON.stringify(data.postWorkshopResources) : null);
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
 * Rate limited to 100 requests per hour per IP
 */
workshops.get('/slug/:slug', rateLimiter({ max: 100, window: 3600 }), async (c) => {
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
        workshopName: workshop.workshopName,
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
 * POST /api/workshops/:id/signup
 *
 * Public signup endpoint: Creates user account and enrolls in workshop
 * Rate limited to 30 requests per hour per IP to prevent spam signups
 * (Higher limit during testing phase - reduce to 5-10 after launch)
 */
workshops.post('/:id/signup', rateLimiter({ max: 30, window: 3600 }), validate(workshopSignupSchema), async (c) => {
  const workshopId = c.req.param('id');
  const data = c.get('validatedData') as any;
  const db = c.get('db');

  try {
    // Get workshop details
    const workshopResult = await db.query('SELECT * FROM workshops WHERE id = $1', [workshopId]);

    if (workshopResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Workshop not found');
    }

    const workshopRow = workshopResult.rows[0];
    const workshop = mapWorkshopRow(workshopRow);

    // Get current enrollment count
    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM workshop_enrollments WHERE workshop_id = $1',
      [workshopId]
    );
    const currentEnrollmentCount = parseInt(countResult.rows[0].count) || 0;

    // Check if workshop is accepting enrollments
    if (!isWorkshopAcceptingEnrollments(workshop)) {
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'This workshop is not currently accepting enrollments');
    }

    // Check if workshop is full
    if (workshop.maxEnrollment && currentEnrollmentCount >= workshop.maxEnrollment) {
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'This workshop has reached maximum capacity');
    }

    // Check if email already exists
    const emailCheck = await db.query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (emailCheck.rowCount > 0) {
      return badRequest(c, ErrorCodes.ALREADY_EXISTS, 'An account with this email already exists. Please sign in instead.');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user account
    const userResult = await db.query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, company_name,
        chosen_charity_id, account_status, phase
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, email, first_name, last_name`,
      [
        data.email,
        hashedPassword,
        data.firstName,
        data.lastName,
        data.companyName || null,
        data.charityId || null,
        'active',
        'stabilize'
      ]
    );

    const user = userResult.rows[0];

    // Create enrollment
    const enrollmentResult = await db.query(
      `INSERT INTO workshop_enrollments (
        user_id, workshop_id
      ) VALUES ($1, $2)
      RETURNING *`,
      [user.id, workshopId]
    );

    const enrollment = mapEnrollmentRow(enrollmentResult.rows[0]);

    // Update user's current workshop enrollment
    await db.query('UPDATE users SET current_workshop_enrollment_id = $1 WHERE id = $2', [
      enrollment.id,
      user.id,
    ]);

    // Generate auth token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    console.log('[Workshops] New user signup:', user.id, user.email, 'for workshop:', workshopId);

    return success(c, {
      success: true,
      enrollment,
      user: {
        id: user.id,
        email: user.email,
      },
      token,
    }, 201);
  } catch (error) {
    console.error('[Workshops] Error in workshop signup:', error);
    console.error('[Workshops] Error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      code: error?.code,
    });

    // Return more specific error message to help debugging
    const errorMessage = error?.message || 'Failed to complete signup';
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, `Signup failed: ${errorMessage}`);
  }
});

/**
 * POST /api/workshops/:id/enroll
 *
 * Enroll in a workshop (authenticated users)
 * Rate limited to 5 requests per hour to prevent duplicate enrollments
 */
workshops.post('/:id/enroll', requireAuth, rateLimiter({ max: 5, window: 3600 }), async (c) => {
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
        user_id, workshop_id
      ) VALUES ($1, $2)
      RETURNING *`,
      [userId, workshopId]
    );

    const enrollment = mapEnrollmentRow(enrollmentResult.rows[0]);

    // Update user's current workshop enrollment
    await db.query('UPDATE users SET current_workshop_enrollment_id = $1 WHERE id = $2', [
      enrollment.id,
      userId,
    ]);

    // Get user details for Stripe checkout
    const userResult = await db.query(
      'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];

    // Create Stripe checkout session with workshop's custom trial length
    const { createCheckoutSession } = await import('../services/stripe.service.js');

    const session = await createCheckoutSession({
      priceId: workshop.stripePriceId || workshopRow.stripe_price_id,
      userId: user.id,
      userEmail: user.email,
      successUrl: `${process.env.FRONTEND_URL}/workshops/${workshop.slug}/thank-you`,
      cancelUrl: `${process.env.FRONTEND_URL}/workshops/${workshop.slug}`,
      trialDays: workshop.trialDurationDays, // Use workshop's custom trial length (e.g., 30 days)
      metadata: {
        workshopId: workshop.id,
        workshopSlug: workshop.slug,
        enrollmentId: enrollment.id,
      },
    });

    console.log('[Workshops] User enrolled:', userId, 'in workshop:', workshopId);
    console.log('[Workshops] Stripe checkout session created:', session.id);

    return success(c, {
      enrollment,
      checkoutUrl: session.url, // Return Stripe checkout URL for frontend redirect
    }, 201);
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
 * DEPRECATED: Stripe starts trials automatically when checkout completes
 * Trial status is tracked in user_products table via Stripe webhooks
 */
workshops.put('/enrollments/:id/start-trial', requireAdmin, async (c) => {
  return badRequest(c, ErrorCodes.INVALID_INPUT, 'Trials are started automatically by Stripe when checkout completes');
});

// =============================================================================
// EMAIL PREVIEW & TESTING ENDPOINTS
// =============================================================================

/**
 * POST /api/workshops/:id/emails/preview
 *
 * Get rendered email preview with template tags replaced (admin only)
 * Rate limited to 20 requests per hour for admin testing
 */
workshops.post('/:id/emails/preview', requireAdmin, rateLimiter({ max: 20, window: 3600 }), async (c) => {
  const workshopId = c.req.param('id');
  const db = c.get('db');

  try {
    const body = await c.req.json();
    const { emailType, tagValues } = body;

    if (!emailType) {
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'Email type is required');
    }

    // Get workshop with email templates
    const workshopResult = await db.query(
      'SELECT custom_email_templates, cohort_name FROM workshops WHERE id = $1',
      [workshopId]
    );

    if (workshopResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Workshop not found');
    }

    const workshop = workshopResult.rows[0];
    const templates = workshop.custom_email_templates || {};
    const template = templates[emailType];

    if (!template) {
      return notFound(c, ErrorCodes.NOT_FOUND, `Template for ${emailType} not found`);
    }

    // Replace template tags with provided values
    const replaceTagsInText = (text: string, tags: Record<string, string>): string => {
      let result = text;
      Object.entries(tags).forEach(([tag, value]) => {
        const regex = new RegExp(tag.replace(/[{}]/g, '\\$&'), 'g');
        result = result.replace(regex, value);
      });
      return result;
    };

    const renderedSubject = replaceTagsInText(template.subject, tagValues);
    const renderedPreheader = template.preheader
      ? replaceTagsInText(template.preheader, tagValues)
      : '';
    const renderedHtmlBody = replaceTagsInText(template.htmlBody, tagValues);

    // Generate plain text from HTML if not provided
    let renderedPlainText = template.plainTextBody
      ? replaceTagsInText(template.plainTextBody, tagValues)
      : renderedHtmlBody.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

    return success(c, {
      preview: {
        subject: renderedSubject,
        preheader: renderedPreheader,
        htmlBody: renderedHtmlBody,
        plainTextBody: renderedPlainText,
      },
    });
  } catch (error) {
    console.error('[Workshops] Error generating email preview:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to generate email preview');
  }
});

/**
 * POST /api/workshops/:id/emails/test
 *
 * Send test email to specified address (admin only)
 * Rate limited to 10 requests per hour to prevent email spam
 */
workshops.post('/:id/emails/test', requireAdmin, rateLimiter({ max: 10, window: 3600 }), async (c) => {
  const workshopId = c.req.param('id');
  const db = c.get('db');

  try {
    const body = await c.req.json();
    const { emailType, recipientEmail, tagValues } = body;

    if (!emailType || !recipientEmail) {
      return badRequest(
        c,
        ErrorCodes.INVALID_INPUT,
        'Email type and recipient email are required'
      );
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'Invalid email address');
    }

    // Get workshop with email templates
    const workshopResult = await db.query(
      'SELECT custom_email_templates, cohort_name FROM workshops WHERE id = $1',
      [workshopId]
    );

    if (workshopResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Workshop not found');
    }

    const workshop = workshopResult.rows[0];
    const templates = workshop.custom_email_templates || {};
    const template = templates[emailType];

    if (!template) {
      return notFound(c, ErrorCodes.NOT_FOUND, `Template for ${emailType} not found`);
    }

    // Replace template tags with provided values
    const replaceTagsInText = (text: string, tags: Record<string, string>): string => {
      let result = text;
      Object.entries(tags).forEach(([tag, value]) => {
        const regex = new RegExp(tag.replace(/[{}]/g, '\\$&'), 'g');
        result = result.replace(regex, value);
      });
      return result;
    };

    const renderedSubject = replaceTagsInText(template.subject, tagValues);
    const renderedHtmlBody = replaceTagsInText(template.htmlBody, tagValues);
    const renderedPlainText = template.plainTextBody
      ? replaceTagsInText(template.plainTextBody, tagValues)
      : renderedHtmlBody.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

    // Send email via Postmark
    const postmark = await import('postmark');
    const client = new postmark.ServerClient(process.env.POSTMARK_SERVER_TOKEN || '');

    const fromEmail = process.env.POSTMARK_FROM_EMAIL || 'noreply@audacious.money';
    const fromName = template.fromName || 'Audacious Money Workshops';

    await client.sendEmail({
      From: `${fromName} <${fromEmail}>`,
      To: recipientEmail,
      Subject: `[TEST] ${renderedSubject}`,
      HtmlBody: `
        <div style="background-color: #fef3c7; padding: 16px; border-left: 4px solid #f59e0b; margin-bottom: 24px;">
          <p style="margin: 0; font-weight: bold; color: #92400e;">🧪 TEST EMAIL</p>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #92400e;">
            This is a test email from the Workshop Email Preview system.
            Real emails will not include this banner.
          </p>
        </div>
        ${renderedHtmlBody}
        <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
        <p style="font-size: 12px; color: #9ca3af;">
          Audacious Money<br>
          Building financial confidence, one step at a time.
        </p>
      `,
      TextBody: `
[TEST EMAIL - This banner will not appear in real emails]

${renderedPlainText}

---
Audacious Money
Building financial confidence, one step at a time.
      `,
      MessageStream: 'outbound',
    });

    console.log('[Workshops] Test email sent to:', recipientEmail, 'for workshop:', workshopId);

    return success(c, {
      message: 'Test email sent successfully',
      recipientEmail,
    });
  } catch (error) {
    console.error('[Workshops] Error sending test email:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to send test email');
  }
});

// =============================================================================
// TRIAL MANAGEMENT & CONVERSION ENDPOINTS
// =============================================================================

/**
 * GET /api/workshops/enrollments/:id/trial-status
 *
 * Get trial status for a specific enrollment (user or admin)
 */
workshops.get('/enrollments/:id/trial-status', requireAuth, async (c) => {
  const enrollmentId = c.req.param('id');
  const db = c.get('db');
  const userId = c.get('userId');

  try {
    // Get enrollment with workshop info
    const result = await db.query(
      `SELECT we.*, w.cohort_name, w.post_trial_action
       FROM workshop_enrollments we
       JOIN workshops w ON we.workshop_id = w.id
       WHERE we.id = $1`,
      [enrollmentId]
    );

    if (result.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Enrollment not found');
    }

    const enrollment = result.rows[0];

    // Check authorization: user must own the enrollment or be admin
    const isOwner = enrollment.user_id === userId;
    const adminUser = c.get('adminUser');

    if (!isOwner && !adminUser) {
      return unauthorized(c, ErrorCodes.UNAUTHORIZED, 'Not authorized to view this enrollment');
    }

    // Calculate trial status
    const now = new Date();
    const trialExpiresAt = enrollment.trial_expires_at ? new Date(enrollment.trial_expires_at) : null;
    const isExpired = trialExpiresAt ? now > trialExpiresAt : false;
    const daysRemaining = trialExpiresAt
      ? Math.ceil((trialExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return success(c, {
      trialStatus: {
        enrollmentId: enrollment.id,
        status: enrollment.status,
        trialStartedAt: enrollment.trial_started_at,
        trialExpiresAt: enrollment.trial_expires_at,
        isExpired,
        daysRemaining,
        postTrialAction: enrollment.post_trial_action,
        workshopName: enrollment.cohort_name,
      },
    });
  } catch (error) {
    console.error('[Workshops] Error getting trial status:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to get trial status');
  }
});

/**
 * POST /api/workshops/enrollments/:id/upgrade
 *
 * Process upgrade from trial to paid subscription
 */
workshops.post('/enrollments/:id/upgrade', requireAuth, async (c) => {
  const enrollmentId = c.req.param('id');
  const db = c.get('db');
  const userId = c.get('userId');

  try {
    const body = await c.req.json();
    const { paymentMethodId } = body;

    if (!paymentMethodId) {
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'Payment method ID is required');
    }

    // Get enrollment
    const enrollmentResult = await db.query(
      `SELECT we.*, w.cohort_name, w.post_trial_action
       FROM workshop_enrollments we
       JOIN workshops w ON we.workshop_id = w.id
       WHERE we.id = $1`,
      [enrollmentId]
    );

    if (enrollmentResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Enrollment not found');
    }

    const enrollment = enrollmentResult.rows[0];

    // Check authorization
    if (enrollment.user_id !== userId) {
      return unauthorized(c, ErrorCodes.UNAUTHORIZED, 'Not authorized to upgrade this enrollment');
    }

    // Prevent duplicate conversions
    if (enrollment.status === 'converted') {
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'Enrollment already converted to paid subscription');
    }

    // Get user info
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    // TODO: Integrate with Stripe to create subscription
    // This is a placeholder for Stripe subscription creation
    // In production, you would:
    // 1. Create/update Stripe customer
    // 2. Attach payment method
    // 3. Create subscription
    // 4. Handle payment confirmation

    console.log('[Workshops] Processing upgrade for enrollment:', enrollmentId);
    console.log('[Workshops] Payment method:', paymentMethodId);
    console.log('[Workshops] User:', user.email);

    // TODO: Refactor to use Stripe Billing Portal instead of manual upgrade
    // Conversion tracking should query user_products table directly
    console.log('[Workshops] Upgrade initiated for enrollment:', enrollmentId);

    return success(c, {
      message: 'Subscription upgrade successful',
      enrollmentId,
    });
  } catch (error) {
    console.error('[Workshops] Error processing upgrade:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to process upgrade');
  }
});

/**
 * GET /api/admin/workshops/:id/conversions
 *
 * Get conversion data and metrics for a workshop (admin only)
 * TODO: Refactor to query user_products table and workshop_analytics view directly
 */
workshops.get('/admin/:id/conversions', requireAdmin, async (c) => {
  const workshopId = c.req.param('id');
  const db = c.get('db');

  try {
    // Query workshop_analytics view for conversion metrics
    const result = await db.query(
      `SELECT * FROM workshop_analytics WHERE id = $1`,
      [workshopId]
    );

    if (result.rows.length === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Workshop not found');
    }

    const analytics = result.rows[0];

    return success(c, {
      report: {
        workshopId: analytics.id,
        workshopName: analytics.cohort_name,
        totalEnrolled: analytics.total_enrolled,
        trialingCount: analytics.trialing_count,
        activeCount: analytics.active_count,
        convertedCount: analytics.converted_count,
        conversionRate: analytics.conversion_rate_percent,
      },
    });
  } catch (error) {
    console.error('[Workshops] Error getting conversion data:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to get conversion data');
  }
});

/**
 * GET /api/admin/workshops/conversions/stats
 *
 * Get overall conversion statistics across all workshops (admin only)
 * TODO: Refactor to aggregate workshop_analytics view data
 */
workshops.get('/admin/conversions/stats', requireAdmin, async (c) => {
  const db = c.get('db');

  try {
    // Aggregate conversion stats from workshop_analytics view
    const result = await db.query(`
      SELECT
        SUM(total_enrolled) as total_enrolled,
        SUM(trialing_count) as total_trialing,
        SUM(active_count) as total_active,
        SUM(converted_count) as total_converted,
        ROUND(AVG(conversion_rate_percent), 2) as average_conversion_rate
      FROM workshop_analytics
    `);

    const stats = result.rows[0];

    return success(c, {
      stats: {
        totalEnrolled: parseInt(stats.total_enrolled || '0'),
        totalTrialing: parseInt(stats.total_trialing || '0'),
        totalActive: parseInt(stats.total_active || '0'),
        totalConverted: parseInt(stats.total_converted || '0'),
        averageConversionRate: parseFloat(stats.average_conversion_rate || '0'),
      },
    });
  } catch (error) {
    console.error('[Workshops] Error getting conversion statistics:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to get conversion statistics');
  }
});

/**
 * POST /api/admin/workshops/trials/check-expired
 *
 * DEPRECATED: Stripe handles trial expiration via webhooks
 * This endpoint is no longer needed
 */
workshops.post('/admin/trials/check-expired', requireAdmin, rateLimiter({ max: 5, window: 60 }), async (c) => {
  return badRequest(c, ErrorCodes.INVALID_INPUT, 'Trial management is handled by Stripe webhooks');
});

/**
 * GET /api/admin/workshops/trials/stats
 *
 * Get trial statistics (admin only)
 * Refactored to use user_products table (Stripe subscription data)
 */
workshops.get('/admin/trials/stats', requireAdmin, async (c) => {
  const db = c.get('db');

  try {
    // Query user_products for trial statistics
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'trialing') as active_trials,
        COUNT(*) FILTER (WHERE status = 'active') as converted_trials,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_trials
      FROM user_products
      WHERE stripe_subscription_id IS NOT NULL
    `);

    const stats = result.rows[0];

    return success(c, {
      stats: {
        activeTrials: parseInt(stats.active_trials || '0'),
        convertedTrials: parseInt(stats.converted_trials || '0'),
        cancelledTrials: parseInt(stats.cancelled_trials || '0'),
      },
    });
  } catch (error) {
    console.error('[Workshops] Error getting trial statistics:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to get trial statistics');
  }
});

/**
 * POST /api/admin/workshops/enrollments/:id/expire-trial
 *
 * DEPRECATED: Stripe handles trial expiration automatically
 * Use Stripe Dashboard to manage subscriptions instead
 */
workshops.post('/admin/enrollments/:id/expire-trial', requireAdmin, async (c) => {
  return badRequest(c, ErrorCodes.INVALID_INPUT, 'Trial expiration is managed by Stripe. Use Stripe Dashboard to cancel subscriptions.');
});

// =============================================================================
// HEALTH CHECK ENDPOINT
// =============================================================================

/**
 * GET /api/workshops/health
 *
 * Health check endpoint for workshop system
 * Returns status of database, email service, Stripe, and system metrics
 */
workshops.get('/health', async (c) => {
  const startTime = Date.now();
  const checks: any = {};
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Check 1: Database connectivity
  try {
    const dbStart = Date.now();
    const db = c.get('db');
    await db.query('SELECT 1 as health');
    const dbDuration = Date.now() - dbStart;

    checks.database = {
      status: 'healthy',
      responseTime_ms: dbDuration,
      details: 'Database connection successful',
    };
  } catch (error: any) {
    checks.database = {
      status: 'unhealthy',
      error: error.message,
      details: 'Database connection failed',
    };
    overallStatus = 'unhealthy';
  }

  // Check 2: Workshop tables exist
  try {
    const db = c.get('db');
    const tablesResult = await db.query(`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables
      WHERE table_name IN ('workshops', 'workshop_enrollments')
    `);
    const tableCount = parseInt(tablesResult.rows[0].table_count);

    checks.workshopTables = {
      status: tableCount === 2 ? 'healthy' : 'unhealthy',
      details: `${tableCount}/2 workshop tables found`,
    };

    if (tableCount !== 2 && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }
  } catch (error: any) {
    checks.workshopTables = {
      status: 'unhealthy',
      error: error.message,
      details: 'Failed to check workshop tables',
    };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  // Check 3: Email service configuration
  try {
    const postmarkApiKey = process.env.POSTMARK_API_KEY;

    if (postmarkApiKey && postmarkApiKey !== 'your-postmark-api-key-here') {
      checks.emailService = {
        status: 'healthy',
        details: 'Postmark API key configured',
      };
    } else {
      checks.emailService = {
        status: 'degraded',
        details: 'Postmark API key not configured',
      };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }
  } catch (error: any) {
    checks.emailService = {
      status: 'degraded',
      error: error.message,
      details: 'Email service check failed',
    };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  // Check 4: Stripe service configuration
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (stripeSecretKey && stripeSecretKey.startsWith('sk_')) {
      checks.stripeService = {
        status: 'healthy',
        details: 'Stripe API key configured',
      };
    } else {
      checks.stripeService = {
        status: 'degraded',
        details: 'Stripe API key not configured',
      };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }
  } catch (error: any) {
    checks.stripeService = {
      status: 'degraded',
      error: error.message,
      details: 'Stripe service check failed',
    };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  // Check 5: Feature flags status
  checks.featureFlags = {
    WORKSHOP_SYSTEM_ENABLED: process.env.WORKSHOP_SYSTEM_ENABLED === 'true',
    WORKSHOP_EMAILS_ENABLED: process.env.WORKSHOP_EMAILS_ENABLED === 'true',
    WORKSHOP_TRIALS_ENABLED: process.env.WORKSHOP_TRIALS_ENABLED === 'true',
    WORKSHOP_SIGNUP_ENABLED: process.env.WORKSHOP_SIGNUP_ENABLED === 'true',
  };

  // Check 6: System metrics
  try {
    const db = c.get('db');
    const metricsResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active' AND trial_expires_at > NOW()) as active_trials,
        COUNT(*) FILTER (WHERE status IN ('enrolled', 'active') AND trial_expires_at < NOW()) as stuck_trials,
        COUNT(*) FILTER (WHERE enrolled_at >= NOW() - INTERVAL '24 hours') as recent_signups
      FROM workshop_enrollments
    `);

    const { active_trials, stuck_trials, recent_signups } = metricsResult.rows[0];

    checks.metrics = {
      activeTrials: parseInt(active_trials || '0'),
      stuckTrials: parseInt(stuck_trials || '0'),
      recentSignups: parseInt(recent_signups || '0'),
    };

    // Alert if stuck trials detected
    if (parseInt(stuck_trials || '0') > 5) {
      checks.metrics.warning = `${stuck_trials} expired trials not processed`;
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }
  } catch (error: any) {
    checks.metrics = {
      status: 'error',
      error: error.message,
    };
  }

  const totalDuration = Date.now() - startTime;

  return c.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    responseTime_ms: totalDuration,
    checks,
  });
});

export default workshops;
