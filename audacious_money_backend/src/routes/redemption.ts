/**
 * Redemption Routes
 *
 * Public and authenticated endpoints for redeeming lifetime access codes.
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../types/hono.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimit.js';
import {
  success,
  badRequest,
  notFound,
  ErrorCodes,
} from '../utils/responses.js';
import {
  validateCode,
  redeemCodeForNewUser,
  redeemCodeForExistingUser,
} from '../services/lifetimeCodes.service.js';

const redemption = new Hono<HonoEnv>();

/**
 * GET /api/redeem/:code/info
 *
 * Get code info for display on redemption page (public)
 * Rate limited to prevent code enumeration
 */
redemption.get('/:code/info', rateLimiter({ max: 30, window: 3600 }), async (c) => {
  const code = c.req.param('code');
  const db = c.get('db');

  try {
    const validation = await validateCode(db, code);

    if (!validation.valid || !validation.code) {
      return badRequest(c, ErrorCodes.INVALID_INPUT, validation.error || 'Invalid code');
    }

    // Return limited info - don't expose internal details
    return success(c, {
      name: validation.code.name,
      products: validation.code.products?.map((p) => ({
        name: p.name,
        slug: p.slug,
      })),
      expiresAt: validation.code.expiresAt,
      // Don't expose: max redemptions, redemptions used, notes, admin ID
    });
  } catch (error) {
    console.error('[Redemption] Error validating code:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to validate code');
  }
});

/**
 * POST /api/redeem/:code/signup
 *
 * New user signup with code redemption (public)
 * Creates account and grants product access
 */
redemption.post('/:code/signup', rateLimiter({ max: 10, window: 3600 }), async (c) => {
  const code = c.req.param('code');
  const db = c.get('db');

  try {
    const body = await c.req.json();
    const { email, password, firstName, lastName, companyName } = body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'Email, password, first name, and last name are required');
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'Invalid email format');
    }

    // Validate password strength
    if (password.length < 8) {
      return badRequest(c, ErrorCodes.INVALID_INPUT, 'Password must be at least 8 characters');
    }

    // Get request metadata
    const ipAddress = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
                      c.req.header('x-real-ip') ||
                      'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';

    const result = await redeemCodeForNewUser(
      db,
      code,
      {
        email: email.toLowerCase().trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        companyName: companyName?.trim(),
      },
      {
        ipAddress,
        userAgent,
      }
    );

    if (!result.success) {
      return badRequest(c, ErrorCodes.INVALID_INPUT, result.message);
    }

    return success(c, {
      message: result.message,
      user: result.user,
      token: result.token,
      products: result.products,
      requiresWorksheet: result.requiresWorksheet,
    }, 201);
  } catch (error) {
    console.error('[Redemption] Error in signup redemption:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to complete signup');
  }
});

/**
 * POST /api/redeem/:code/claim
 *
 * Existing user claims code (authenticated)
 */
redemption.post('/:code/claim', requireAuth, async (c) => {
  const code = c.req.param('code');
  const db = c.get('db');
  const userId = c.get('userId');

  try {
    // Get request metadata
    const ipAddress = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
                      c.req.header('x-real-ip') ||
                      'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';

    const result = await redeemCodeForExistingUser(
      db,
      code,
      userId,
      {
        ipAddress,
        userAgent,
      }
    );

    if (!result.success) {
      return badRequest(c, ErrorCodes.INVALID_INPUT, result.message);
    }

    return success(c, {
      message: result.message,
      products: result.products,
      requiresWorksheet: result.requiresWorksheet,
    });
  } catch (error) {
    console.error('[Redemption] Error in claim redemption:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to redeem code');
  }
});

export default redemption;
