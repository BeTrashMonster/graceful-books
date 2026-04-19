/**
 * Charity routes
 *
 * Handles charity management, selection, and admin analytics
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../types/hono.js';
import { validate } from '../utils/validation.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import {
  success,
  badRequest,
  unauthorized,
  notFound,
  ErrorCodes,
  ErrorMessages,
} from '../utils/responses.js';
import { z } from 'zod';

const charities = new Hono<HonoEnv>();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createCharitySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  ein: z.string().regex(/^\d{2}-\d{7}$/, 'EIN must be in format XX-XXXXXXX'),
  shortDescription: z.string().max(500).optional(),
  longDescription: z.string().optional(),
  website: z.string().url('Invalid website URL').max(500),
  category: z.enum([
    'EDUCATION',
    'ENVIRONMENT',
    'HEALTH',
    'POVERTY',
    'ANIMAL_WELFARE',
    'HUMAN_RIGHTS',
    'DISASTER_RELIEF',
    'ARTS_CULTURE',
    'COMMUNITY',
    'OTHER',
  ]),
  logo: z.string().max(500).optional(),
  paymentAddress: z.string().optional(), // Will be encrypted
  displayOrder: z.number().int().optional(),
});

const updateCharitySchema = createCharitySchema.partial();

const verifyCharitySchema = z.object({
  verificationNotes: z.string().optional(),
});

const rejectCharitySchema = z.object({
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
});

const selectCharitySchema = z.object({
  charityId: z.string().uuid('Invalid charity ID'),
});

const createPhaseTransitionSchema = z.object({
  charityId: z.string().uuid('Invalid charity ID'),
  replacementCharityId: z.string().uuid('Invalid replacement charity ID').optional(),
  phaseOutDate: z.string().datetime('Invalid phase out date'),
  phaseInDate: z.string().datetime('Invalid phase in date').optional(),
  reason: z.string().min(1, 'Reason is required'),
  adminNotes: z.string().optional(),
});

const updatePhaseTransitionSchema = z.object({
  status: z.enum(['scheduled', 'notified', 'in_progress', 'completed', 'cancelled']).optional(),
  reason: z.string().optional(),
  adminNotes: z.string().optional(),
});

const markDistributionPaidSchema = z.object({
  paymentMethod: z.enum(['ach', 'check', 'wire', 'other']),
  paymentReference: z.string().max(255).optional(),
  notes: z.string().optional(),
});

// =============================================================================
// PUBLIC ENDPOINTS
// =============================================================================

/**
 * GET /charities
 *
 * List all active/verified charities (public)
 */
charities.get('/', async (c) => {
  const db = c.get('db');

  try {
    const result = await db.query(
      `SELECT id, name, short_description, long_description, website, ein,
              category, logo, display_order, created_at, updated_at
       FROM charities
       WHERE status = 'VERIFIED' AND active = true
       ORDER BY display_order ASC, name ASC`
    );

    return success(c, {
      charities: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        shortDescription: row.short_description,
        longDescription: row.long_description,
        website: row.website,
        ein: row.ein,
        category: row.category,
        logo: row.logo,
        displayOrder: row.display_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    console.error('[Charities] Error fetching charities:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch charities');
  }
});

// =============================================================================
// USER ENDPOINTS (Authenticated)
// =============================================================================

/**
 * GET /charities/my-selection
 *
 * Get current user's charity selection
 */
charities.get('/my-selection', requireAuth, async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  try {
    const result = await db.query(
      `SELECT ucs.id, ucs.charity_id, ucs.selected_at, ucs.effective_from,
              c.name, c.short_description, c.website, c.ein, c.category, c.logo
       FROM user_charity_selections ucs
       JOIN charities c ON ucs.charity_id = c.id
       WHERE ucs.user_id = $1 AND ucs.effective_until IS NULL
       ORDER BY ucs.selected_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return success(c, { selection: null });
    }

    const row = result.rows[0];

    return success(c, {
      selection: {
        id: row.id,
        charityId: row.charity_id,
        selectedAt: row.selected_at,
        effectiveFrom: row.effective_from,
        charity: {
          name: row.name,
          shortDescription: row.short_description,
          website: row.website,
          ein: row.ein,
          category: row.category,
          logo: row.logo,
        },
      },
    });
  } catch (error) {
    console.error('[Charities] Error fetching user charity selection:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch charity selection');
  }
});

/**
 * POST /charities/select
 *
 * Select or change charity
 */
charities.post('/select', requireAuth, validate(selectCharitySchema), async (c) => {
  const userId = c.get('userId');
  const { charityId } = c.get('validatedData') as { charityId: string };
  const db = c.get('db');

  try {
    // Verify charity exists and is active
    const charityResult = await db.query(
      `SELECT id, name FROM charities WHERE id = $1 AND status = 'VERIFIED' AND active = true`,
      [charityId]
    );

    if (charityResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Charity not found or inactive');
    }

    // Close current selection (if any)
    await db.query(
      `UPDATE user_charity_selections
       SET effective_until = NOW()
       WHERE user_id = $1 AND effective_until IS NULL`,
      [userId]
    );

    // Create new selection
    const insertResult = await db.query(
      `INSERT INTO user_charity_selections (user_id, charity_id, selected_at, effective_from)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING id, charity_id, selected_at, effective_from`,
      [userId, charityId]
    );

    const selection = insertResult.rows[0];
    const charity = charityResult.rows[0];

    return success(c, {
      message: `You're now supporting ${charity.name}!`,
      selection: {
        id: selection.id,
        charityId: selection.charity_id,
        selectedAt: selection.selected_at,
        effectiveFrom: selection.effective_from,
      },
    });
  } catch (error) {
    console.error('[Charities] Error selecting charity:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to select charity');
  }
});

/**
 * GET /charities/notifications
 *
 * Get unread charity notifications
 */
charities.get('/notifications', requireAuth, async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  try {
    const result = await db.query(
      `SELECT
         ucn.id,
         ucn.notification_type,
         ucn.sent_at,
         ucn.read_at,
         ucn.acknowledged_at,
         cpt.charity_id,
         cpt.replacement_charity_id,
         cpt.phase_out_date,
         cpt.phase_in_date,
         cpt.reason,
         c_out.name as charity_out_name,
         c_in.name as replacement_charity_name
       FROM user_charity_notifications ucn
       JOIN charity_phase_transitions cpt ON ucn.charity_phase_transition_id = cpt.id
       JOIN charities c_out ON cpt.charity_id = c_out.id
       LEFT JOIN charities c_in ON cpt.replacement_charity_id = c_in.id
       WHERE ucn.user_id = $1 AND ucn.acknowledged_at IS NULL
       ORDER BY ucn.sent_at DESC`,
      [userId]
    );

    return success(c, {
      notifications: result.rows.map((row) => ({
        id: row.id,
        notificationType: row.notification_type,
        sentAt: row.sent_at,
        readAt: row.read_at,
        acknowledgedAt: row.acknowledged_at,
        charityOutId: row.charity_id,
        charityOutName: row.charity_out_name,
        replacementCharityId: row.replacement_charity_id,
        replacementCharityName: row.replacement_charity_name,
        phaseOutDate: row.phase_out_date,
        phaseInDate: row.phase_in_date,
        reason: row.reason,
      })),
    });
  } catch (error) {
    console.error('[Charities] Error fetching notifications:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch notifications');
  }
});

/**
 * PATCH /charities/notifications/:id/acknowledge
 *
 * Acknowledge a charity notification (mark as read and acknowledged)
 */
charities.patch('/notifications/:id/acknowledge', requireAuth, async (c) => {
  const userId = c.get('userId');
  const { id } = c.req.param();
  const db = c.get('db');

  try {
    const result = await db.query(
      `UPDATE user_charity_notifications
       SET read_at = COALESCE(read_at, NOW()), acknowledged_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Notification not found');
    }

    return success(c, { message: 'Notification acknowledged' });
  } catch (error) {
    console.error('[Charities] Error acknowledging notification:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to acknowledge notification');
  }
});

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

/**
 * GET /admin/charities
 *
 * List all charities with analytics (admin only)
 */
charities.get('/admin/charities', requireAdmin, async (c) => {
  const db = c.get('db');
  const status = c.req.query('status'); // Filter by status

  try {
    let query = `
      SELECT * FROM charity_analytics
    `;

    const params: any[] = [];

    if (status && ['PENDING', 'VERIFIED', 'REJECTED', 'INACTIVE'].includes(status)) {
      query += ` WHERE status = $1`;
      params.push(status);
    }

    query += ` ORDER BY name ASC`;

    const result = await db.query(query, params);

    return success(c, {
      charities: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        ein: row.ein,
        category: row.category,
        status: row.status,
        active: row.active,
        currentMonthPayments: parseInt(row.current_month_payments),
        currentMonthTotal: parseFloat(row.current_month_total),
        currentMonthContributors: parseInt(row.current_month_contributors),
        lifetimePayments: parseInt(row.lifetime_payments),
        lifetimeTotal: parseFloat(row.lifetime_total),
        lifetimeContributors: parseInt(row.lifetime_contributors),
        activeUserSelections: parseInt(row.active_user_selections),
        totalHistoricalSelections: parseInt(row.total_historical_selections),
        pendingDistributionAmount: parseFloat(row.pending_distribution_amount),
        lastDistributionDate: row.last_distribution_date,
      })),
    });
  } catch (error) {
    console.error('[Admin] Error fetching charity analytics:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch charity analytics');
  }
});

/**
 * GET /admin/charities/:id
 *
 * Get specific charity details (admin only)
 */
charities.get('/admin/charities/:id', requireAdmin, async (c) => {
  const { id } = c.req.param();
  const db = c.get('db');

  try {
    const result = await db.query(
      `SELECT * FROM charities WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Charity not found');
    }

    const row = result.rows[0];

    return success(c, {
      charity: {
        id: row.id,
        name: row.name,
        ein: row.ein,
        shortDescription: row.short_description,
        longDescription: row.long_description,
        website: row.website,
        category: row.category,
        logo: row.logo,
        paymentAddress: row.payment_address, // Encrypted
        status: row.status,
        active: row.active,
        displayOrder: row.display_order,
        verificationNotes: row.verification_notes,
        rejectionReason: row.rejection_reason,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('[Admin] Error fetching charity:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch charity');
  }
});

/**
 * POST /admin/charities
 *
 * Create a new charity (admin only)
 */
charities.post('/admin/charities', requireAdmin, validate(createCharitySchema), async (c) => {
  const adminId = c.get('adminId');
  const data = c.get('validatedData') as z.infer<typeof createCharitySchema>;
  const db = c.get('db');

  try {
    // Check for duplicate name or EIN
    const duplicateCheck = await db.query(
      `SELECT id FROM charities WHERE name = $1 OR ein = $2`,
      [data.name, data.ein]
    );

    if (duplicateCheck.rowCount > 0) {
      return badRequest(
        c,
        ErrorCodes.VALIDATION_ERROR,
        'A charity with this name or EIN already exists'
      );
    }

    // Insert new charity (defaults to PENDING status)
    const result = await db.query(
      `INSERT INTO charities (
         name, ein, short_description, long_description, website,
         category, logo, payment_address, status, active, display_order, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', false, $9, $10)
       RETURNING id, name, ein, status, created_at`,
      [
        data.name,
        data.ein,
        data.shortDescription || null,
        data.longDescription || null,
        data.website,
        data.category,
        data.logo || null,
        data.paymentAddress || null, // TODO: Encrypt this
        data.displayOrder || 999,
        adminId,
      ]
    );

    const charity = result.rows[0];

    // Log action
    const ipAddress =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip') ||
      '';

    await db.query(
      `INSERT INTO admin_audit_log (action, resource_type, resource_id, admin_user_id, ip_address, new_values)
       VALUES ('charity_created', 'charity', $1, $2, $3, $4)`,
      [charity.id, adminId, ipAddress, JSON.stringify({ name: charity.name, ein: charity.ein })]
    );

    return success(c, {
      message: 'Charity created successfully (pending verification)',
      charity: {
        id: charity.id,
        name: charity.name,
        ein: charity.ein,
        status: charity.status,
        createdAt: charity.created_at,
      },
    });
  } catch (error) {
    console.error('[Admin] Error creating charity:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to create charity');
  }
});

/**
 * PATCH /admin/charities/:id
 *
 * Update a charity (admin only)
 */
charities.patch('/admin/charities/:id', requireAdmin, validate(updateCharitySchema), async (c) => {
  const adminId = c.get('adminId');
  const { id } = c.req.param();
  const data = c.get('validatedData') as z.infer<typeof updateCharitySchema>;
  const db = c.get('db');

  try {
    // Check if charity exists
    const existingResult = await db.query('SELECT * FROM charities WHERE id = $1', [id]);

    if (existingResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Charity not found');
    }

    const oldValues = existingResult.rows[0];

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.ein !== undefined) {
      updates.push(`ein = $${paramCount++}`);
      values.push(data.ein);
    }
    if (data.shortDescription !== undefined) {
      updates.push(`short_description = $${paramCount++}`);
      values.push(data.shortDescription);
    }
    if (data.longDescription !== undefined) {
      updates.push(`long_description = $${paramCount++}`);
      values.push(data.longDescription);
    }
    if (data.website !== undefined) {
      updates.push(`website = $${paramCount++}`);
      values.push(data.website);
    }
    if (data.category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(data.category);
    }
    if (data.logo !== undefined) {
      updates.push(`logo = $${paramCount++}`);
      values.push(data.logo);
    }
    if (data.paymentAddress !== undefined) {
      updates.push(`payment_address = $${paramCount++}`);
      values.push(data.paymentAddress); // TODO: Encrypt
    }
    if (data.displayOrder !== undefined) {
      updates.push(`display_order = $${paramCount++}`);
      values.push(data.displayOrder);
    }

    if (updates.length === 0) {
      return badRequest(c, ErrorCodes.VALIDATION_ERROR, 'No fields to update');
    }

    values.push(id);

    const result = await db.query(
      `UPDATE charities SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING id, name, updated_at`,
      values
    );

    // Log action
    const ipAddress =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip') ||
      '';

    await db.query(
      `INSERT INTO admin_audit_log (action, resource_type, resource_id, admin_user_id, ip_address, old_values, new_values)
       VALUES ('charity_updated', 'charity', $1, $2, $3, $4, $5)`,
      [id, adminId, ipAddress, JSON.stringify(oldValues), JSON.stringify(data)]
    );

    return success(c, {
      message: 'Charity updated successfully',
      charity: result.rows[0],
    });
  } catch (error) {
    console.error('[Admin] Error updating charity:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to update charity');
  }
});

/**
 * DELETE /admin/charities/:id
 *
 * Soft delete (inactivate) a charity (admin only)
 */
charities.delete('/admin/charities/:id', requireAdmin, async (c) => {
  const adminId = c.get('adminId');
  const { id } = c.req.param();
  const db = c.get('db');

  try {
    // Check if charity exists
    const charityResult = await db.query('SELECT id, name, status FROM charities WHERE id = $1', [
      id,
    ]);

    if (charityResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Charity not found');
    }

    const charity = charityResult.rows[0];

    // Check if any users currently have this charity selected
    const userCountResult = await db.query(
      `SELECT COUNT(*) as count FROM user_charity_selections
       WHERE charity_id = $1 AND effective_until IS NULL`,
      [id]
    );

    const activeUserCount = parseInt(userCountResult.rows[0].count);

    if (activeUserCount > 0) {
      return badRequest(
        c,
        ErrorCodes.VALIDATION_ERROR,
        `Cannot inactivate charity: ${activeUserCount} users currently have this charity selected. Please create a phase-out transition first.`
      );
    }

    // Soft delete (mark as INACTIVE)
    await db.query(
      `UPDATE charities SET status = 'INACTIVE', active = false WHERE id = $1`,
      [id]
    );

    // Log action
    const ipAddress =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip') ||
      '';

    await db.query(
      `INSERT INTO admin_audit_log (action, resource_type, resource_id, admin_user_id, ip_address, old_values)
       VALUES ('charity_inactivated', 'charity', $1, $2, $3, $4)`,
      [id, adminId, ipAddress, JSON.stringify({ name: charity.name, status: charity.status })]
    );

    return success(c, { message: 'Charity inactivated successfully' });
  } catch (error) {
    console.error('[Admin] Error inactivating charity:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to inactivate charity');
  }
});

/**
 * POST /admin/charities/:id/verify
 *
 * Verify a charity (admin only)
 */
charities.post('/admin/charities/:id/verify', requireAdmin, validate(verifyCharitySchema), async (c) => {
  const adminId = c.get('adminId');
  const { id } = c.req.param();
  const { verificationNotes } = c.get('validatedData') as z.infer<typeof verifyCharitySchema>;
  const db = c.get('db');

  try {
    const result = await db.query(
      `UPDATE charities
       SET status = 'VERIFIED', active = true, verification_notes = $1
       WHERE id = $2
       RETURNING id, name, status`,
      [verificationNotes || null, id]
    );

    if (result.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Charity not found');
    }

    const charity = result.rows[0];

    // Log action
    const ipAddress =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip') ||
      '';

    await db.query(
      `INSERT INTO admin_audit_log (action, resource_type, resource_id, admin_user_id, ip_address, new_values)
       VALUES ('charity_verified', 'charity', $1, $2, $3, $4)`,
      [id, adminId, ipAddress, JSON.stringify({ verificationNotes })]
    );

    return success(c, {
      message: `${charity.name} has been verified and is now available for selection`,
      charity: {
        id: charity.id,
        name: charity.name,
        status: charity.status,
      },
    });
  } catch (error) {
    console.error('[Admin] Error verifying charity:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to verify charity');
  }
});

/**
 * POST /admin/charities/:id/reject
 *
 * Reject a charity (admin only)
 */
charities.post('/admin/charities/:id/reject', requireAdmin, validate(rejectCharitySchema), async (c) => {
  const adminId = c.get('adminId');
  const { id } = c.req.param();
  const { rejectionReason } = c.get('validatedData') as z.infer<typeof rejectCharitySchema>;
  const db = c.get('db');

  try {
    const result = await db.query(
      `UPDATE charities
       SET status = 'REJECTED', active = false, rejection_reason = $1
       WHERE id = $2
       RETURNING id, name, status`,
      [rejectionReason, id]
    );

    if (result.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Charity not found');
    }

    const charity = result.rows[0];

    // Log action
    const ipAddress =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip') ||
      '';

    await db.query(
      `INSERT INTO admin_audit_log (action, resource_type, resource_id, admin_user_id, ip_address, new_values)
       VALUES ('charity_rejected', 'charity', $1, $2, $3, $4)`,
      [id, adminId, ipAddress, JSON.stringify({ rejectionReason })]
    );

    return success(c, {
      message: `${charity.name} has been rejected`,
      charity: {
        id: charity.id,
        name: charity.name,
        status: charity.status,
      },
    });
  } catch (error) {
    console.error('[Admin] Error rejecting charity:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to reject charity');
  }
});

/**
 * GET /admin/charity-transitions
 *
 * List all phase transitions (admin only)
 */
charities.get('/admin/charity-transitions', requireAdmin, async (c) => {
  const db = c.get('db');
  const status = c.req.query('status');

  try {
    let query = `SELECT * FROM charity_phase_transition_details`;
    const params: any[] = [];

    if (status && ['scheduled', 'notified', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      query += ` WHERE transition_status = $1`;
      params.push(status);
    }

    query += ` ORDER BY phase_out_date DESC`;

    const result = await db.query(query, params);

    return success(c, {
      transitions: result.rows.map((row) => ({
        id: row.id,
        status: row.transition_status,
        phaseOutDate: row.phase_out_date,
        phaseInDate: row.phase_in_date,
        reason: row.reason,
        notificationSentAt: row.notification_sent_at,
        charityOut: {
          id: row.charity_out_id,
          name: row.charity_out_name,
          status: row.charity_out_status,
        },
        replacementCharity: row.replacement_charity_id
          ? {
              id: row.replacement_charity_id,
              name: row.replacement_charity_name,
              status: row.replacement_charity_status,
            }
          : null,
        affectedUsersCount: parseInt(row.affected_users_count),
        usersAcknowledgedCount: parseInt(row.users_acknowledged_count),
        createdBy: {
          email: row.created_by_email,
          name: row.created_by_name,
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    console.error('[Admin] Error fetching phase transitions:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch phase transitions');
  }
});

/**
 * POST /admin/charity-transitions
 *
 * Create a phase transition (admin only)
 */
charities.post(
  '/admin/charity-transitions',
  requireAdmin,
  validate(createPhaseTransitionSchema),
  async (c) => {
    const adminId = c.get('adminId');
    const data = c.get('validatedData') as z.infer<typeof createPhaseTransitionSchema>;
    const db = c.get('db');

    try {
      // Verify charity being phased out exists
      const charityOutResult = await db.query('SELECT id, name FROM charities WHERE id = $1', [
        data.charityId,
      ]);

      if (charityOutResult.rowCount === 0) {
        return notFound(c, ErrorCodes.NOT_FOUND, 'Charity to phase out not found');
      }

      // Verify replacement charity exists (if provided)
      if (data.replacementCharityId) {
        const charityInResult = await db.query(
          'SELECT id, name, status FROM charities WHERE id = $1',
          [data.replacementCharityId]
        );

        if (charityInResult.rowCount === 0) {
          return notFound(c, ErrorCodes.NOT_FOUND, 'Replacement charity not found');
        }

        if (charityInResult.rows[0].status !== 'VERIFIED') {
          return badRequest(
            c,
            ErrorCodes.VALIDATION_ERROR,
            'Replacement charity must be verified'
          );
        }
      }

      // Check for existing active transition
      const existingTransitionResult = await db.query(
        `SELECT id FROM charity_phase_transitions
         WHERE charity_id = $1 AND status IN ('scheduled', 'notified', 'in_progress')`,
        [data.charityId]
      );

      if (existingTransitionResult.rowCount > 0) {
        return badRequest(
          c,
          ErrorCodes.VALIDATION_ERROR,
          'An active phase transition already exists for this charity'
        );
      }

      // Create phase transition
      const result = await db.query(
        `INSERT INTO charity_phase_transitions (
           charity_id, replacement_charity_id, phase_out_date, phase_in_date,
           reason, admin_notes, created_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, status, phase_out_date, created_at`,
        [
          data.charityId,
          data.replacementCharityId || null,
          data.phaseOutDate,
          data.phaseInDate || null,
          data.reason,
          data.adminNotes || null,
          adminId,
        ]
      );

      const transition = result.rows[0];

      // Log action
      const ipAddress =
        c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
        c.req.header('x-real-ip') ||
        c.req.header('cf-connecting-ip') ||
        '';

      await db.query(
        `INSERT INTO admin_audit_log (action, resource_type, resource_id, admin_user_id, ip_address, new_values)
         VALUES ('charity_transition_created', 'charity_phase_transition', $1, $2, $3, $4)`,
        [transition.id, adminId, ipAddress, JSON.stringify(data)]
      );

      return success(c, {
        message: 'Phase transition scheduled successfully',
        transition: {
          id: transition.id,
          status: transition.status,
          phaseOutDate: transition.phase_out_date,
          createdAt: transition.created_at,
        },
      });
    } catch (error) {
      console.error('[Admin] Error creating phase transition:', error);
      return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to create phase transition');
    }
  }
);

/**
 * PATCH /admin/charity-transitions/:id
 *
 * Update a phase transition (admin only)
 */
charities.patch(
  '/admin/charity-transitions/:id',
  requireAdmin,
  validate(updatePhaseTransitionSchema),
  async (c) => {
    const adminId = c.get('adminId');
    const { id } = c.req.param();
    const data = c.get('validatedData') as z.infer<typeof updatePhaseTransitionSchema>;
    const db = c.get('db');

    try {
      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(data.status);
      }
      if (data.reason !== undefined) {
        updates.push(`reason = $${paramCount++}`);
        values.push(data.reason);
      }
      if (data.adminNotes !== undefined) {
        updates.push(`admin_notes = $${paramCount++}`);
        values.push(data.adminNotes);
      }

      if (updates.length === 0) {
        return badRequest(c, ErrorCodes.VALIDATION_ERROR, 'No fields to update');
      }

      values.push(id);

      const result = await db.query(
        `UPDATE charity_phase_transitions
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${paramCount}
         RETURNING id, status, updated_at`,
        values
      );

      if (result.rowCount === 0) {
        return notFound(c, ErrorCodes.NOT_FOUND, 'Phase transition not found');
      }

      // Log action
      const ipAddress =
        c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
        c.req.header('x-real-ip') ||
        c.req.header('cf-connecting-ip') ||
        '';

      await db.query(
        `INSERT INTO admin_audit_log (action, resource_type, resource_id, admin_user_id, ip_address, new_values)
         VALUES ('charity_transition_updated', 'charity_phase_transition', $1, $2, $3, $4)`,
        [id, adminId, ipAddress, JSON.stringify(data)]
      );

      return success(c, {
        message: 'Phase transition updated successfully',
        transition: result.rows[0],
      });
    } catch (error) {
      console.error('[Admin] Error updating phase transition:', error);
      return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to update phase transition');
    }
  }
);

/**
 * POST /admin/charity-transitions/:id/notify
 *
 * Send notifications to affected users (admin only)
 */
charities.post('/admin/charity-transitions/:id/notify', requireAdmin, async (c) => {
  const adminId = c.get('adminId');
  const { id } = c.req.param();
  const db = c.get('db');

  try {
    // Update transition status to 'notified' (trigger will handle notification creation)
    const result = await db.query(
      `UPDATE charity_phase_transitions
       SET status = 'notified'
       WHERE id = $1 AND status = 'scheduled'
       RETURNING id, charity_id`,
      [id]
    );

    if (result.rowCount === 0) {
      return badRequest(
        c,
        ErrorCodes.VALIDATION_ERROR,
        'Phase transition not found or already notified'
      );
    }

    // Get count of affected users
    const countResult = await db.query(
      `SELECT COUNT(DISTINCT user_id) as count
       FROM user_charity_selections
       WHERE charity_id = $1 AND effective_until IS NULL`,
      [result.rows[0].charity_id]
    );

    const affectedUsersCount = parseInt(countResult.rows[0].count);

    // Log action
    const ipAddress =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip') ||
      '';

    await db.query(
      `INSERT INTO admin_audit_log (action, resource_type, resource_id, admin_user_id, ip_address, new_values)
       VALUES ('charity_transition_notified', 'charity_phase_transition', $1, $2, $3, $4)`,
      [id, adminId, ipAddress, JSON.stringify({ affectedUsersCount })]
    );

    return success(c, {
      message: `Notifications sent to ${affectedUsersCount} users`,
      affectedUsersCount,
    });
  } catch (error) {
    console.error('[Admin] Error sending transition notifications:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to send notifications');
  }
});

/**
 * GET /admin/charity-distributions
 *
 * Get charity distribution reports (admin only)
 */
charities.get('/admin/charity-distributions', requireAdmin, async (c) => {
  const db = c.get('db');
  const month = c.req.query('month'); // Format: YYYY-MM
  const status = c.req.query('status');

  try {
    let query = `
      SELECT
        cd.id,
        cd.charity_id,
        cd.month,
        cd.total_amount,
        cd.contributor_count,
        cd.status,
        cd.payment_method,
        cd.payment_reference,
        cd.sent_at,
        cd.confirmed_at,
        cd.notes,
        c.name as charity_name,
        c.ein as charity_ein,
        c.payment_address as charity_payment_address
      FROM charity_distributions cd
      JOIN charities c ON cd.charity_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (month) {
      query += ` AND cd.month = $${paramCount++}`;
      params.push(month);
    }

    if (status && ['pending', 'processing', 'sent', 'confirmed', 'failed'].includes(status)) {
      query += ` AND cd.status = $${paramCount++}`;
      params.push(status);
    }

    query += ` ORDER BY cd.month DESC, c.name ASC`;

    const result = await db.query(query, params);

    return success(c, {
      distributions: result.rows.map((row) => ({
        id: row.id,
        charityId: row.charity_id,
        charityName: row.charity_name,
        charityEin: row.charity_ein,
        charityPaymentAddress: row.charity_payment_address, // Encrypted
        month: row.month,
        totalAmount: parseFloat(row.total_amount),
        contributorCount: row.contributor_count,
        status: row.status,
        paymentMethod: row.payment_method,
        paymentReference: row.payment_reference,
        sentAt: row.sent_at,
        confirmedAt: row.confirmed_at,
        notes: row.notes,
      })),
    });
  } catch (error) {
    console.error('[Admin] Error fetching distributions:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch distributions');
  }
});

/**
 * POST /admin/charity-distributions/:id/mark-paid
 *
 * Mark a distribution as paid (admin only)
 */
charities.post(
  '/admin/charity-distributions/:id/mark-paid',
  requireAdmin,
  validate(markDistributionPaidSchema),
  async (c) => {
    const adminId = c.get('adminId');
    const { id } = c.req.param();
    const data = c.get('validatedData') as z.infer<typeof markDistributionPaidSchema>;
    const db = c.get('db');

    try {
      const result = await db.query(
        `UPDATE charity_distributions
         SET status = 'confirmed',
             payment_method = $1,
             payment_reference = $2,
             notes = $3,
             sent_at = COALESCE(sent_at, NOW()),
             confirmed_at = NOW()
         WHERE id = $4
         RETURNING id, charity_id, month, total_amount`,
        [data.paymentMethod, data.paymentReference || null, data.notes || null, id]
      );

      if (result.rowCount === 0) {
        return notFound(c, ErrorCodes.NOT_FOUND, 'Distribution not found');
      }

      const distribution = result.rows[0];

      // Mark individual payments as paid
      await db.query(
        `UPDATE payments
         SET charity_paid = true
         WHERE charity_id = $1
           AND DATE_TRUNC('month', paid_at) = TO_DATE($2, 'YYYY-MM')
           AND charity_paid = false`,
        [distribution.charity_id, distribution.month]
      );

      // Log action
      const ipAddress =
        c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
        c.req.header('x-real-ip') ||
        c.req.header('cf-connecting-ip') ||
        '';

      await db.query(
        `INSERT INTO admin_audit_log (action, resource_type, resource_id, admin_user_id, ip_address, new_values)
         VALUES ('charity_distribution_paid', 'charity_distribution', $1, $2, $3, $4)`,
        [id, adminId, ipAddress, JSON.stringify(data)]
      );

      return success(c, {
        message: `Distribution marked as paid: $${distribution.total_amount} to charity for ${distribution.month}`,
        distribution: {
          id: distribution.id,
          charityId: distribution.charity_id,
          month: distribution.month,
          totalAmount: parseFloat(distribution.total_amount),
        },
      });
    } catch (error) {
      console.error('[Admin] Error marking distribution as paid:', error);
      return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to mark distribution as paid');
    }
  }
);

/**
 * GET /admin/charity-analytics
 *
 * Get comprehensive charity analytics (admin only)
 */
charities.get('/admin/charity-analytics', requireAdmin, async (c) => {
  const db = c.get('db');

  try {
    // Overview summary
    const summaryResult = await db.query(`
      SELECT
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'VERIFIED' AND c.active = true) as active_charities,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'PENDING') as pending_charities,
        COALESCE(SUM(p.charity_amount), 0) as lifetime_total,
        COALESCE(SUM(p.charity_amount) FILTER (WHERE DATE_TRUNC('month', p.paid_at) = DATE_TRUNC('month', NOW())), 0) as current_month_total,
        COUNT(DISTINCT p.user_id) as total_contributors,
        COALESCE(SUM(p.charity_amount) FILTER (WHERE p.charity_paid = false), 0) as unpaid_amount
      FROM charities c
      LEFT JOIN payments p ON c.id = p.charity_id AND p.status = 'succeeded'
    `);

    const summary = summaryResult.rows[0];

    // Top charities by selections
    const topCharitiesResult = await db.query(`
      SELECT
        c.id,
        c.name,
        COUNT(DISTINCT ucs.user_id) FILTER (WHERE ucs.effective_until IS NULL) as active_selections
      FROM charities c
      LEFT JOIN user_charity_selections ucs ON c.id = ucs.charity_id
      WHERE c.status = 'VERIFIED' AND c.active = true
      GROUP BY c.id, c.name
      ORDER BY active_selections DESC
      LIMIT 10
    `);

    // Monthly trend (last 12 months)
    const trendResult = await db.query(`
      SELECT
        TO_CHAR(paid_at, 'YYYY-MM') as month,
        COALESCE(SUM(charity_amount), 0) as total_amount,
        COUNT(DISTINCT user_id) as contributor_count
      FROM payments
      WHERE status = 'succeeded'
        AND paid_at >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(paid_at, 'YYYY-MM')
      ORDER BY month ASC
    `);

    return success(c, {
      summary: {
        activeCharities: parseInt(summary.active_charities),
        pendingCharities: parseInt(summary.pending_charities),
        lifetimeTotal: parseFloat(summary.lifetime_total),
        currentMonthTotal: parseFloat(summary.current_month_total),
        totalContributors: parseInt(summary.total_contributors),
        unpaidAmount: parseFloat(summary.unpaid_amount),
      },
      topCharities: topCharitiesResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        activeSelections: parseInt(row.active_selections),
      })),
      monthlyTrend: trendResult.rows.map((row) => ({
        month: row.month,
        totalAmount: parseFloat(row.total_amount),
        contributorCount: parseInt(row.contributor_count),
      })),
    });
  } catch (error) {
    console.error('[Admin] Error fetching charity analytics:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch charity analytics');
  }
});

export default charities;
