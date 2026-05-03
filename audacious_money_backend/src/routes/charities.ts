/**
 * Charity routes
 *
 * Handles charity management, selection, and admin analytics
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../types/hono.js';
import { validate } from '../utils/validation.js';
import { requireAuth } from '../middleware/auth.js';
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

const selectCharitySchema = z.object({
  charityId: z.string().uuid('Invalid charity ID'),
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
              category, logo, display_order, created_at, updated_at,
              "brandColorBackground", "brandColorTitle", "brandColorDescription"
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
        brandColorBackground: row.brandColorBackground,
        brandColorTitle: row.brandColorTitle,
        brandColorDescription: row.brandColorDescription,
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
      `SELECT id, name, short_description, website, ein, category, logo
       FROM charities
       WHERE id = $1 AND status = 'VERIFIED' AND active = true`,
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
        charity: {
          name: charity.name,
          shortDescription: charity.short_description,
          website: charity.website,
          ein: charity.ein,
          category: charity.category,
          logo: charity.logo,
        },
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

export default charities;
