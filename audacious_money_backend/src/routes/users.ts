/**
 * User routes
 *
 * Protected endpoints for user account management
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoEnv } from '../types/hono.js';
import { requireAuth } from '../middleware/auth.js';
import {
  success,
  badRequest,
  notFound,
  unauthorized,
  ErrorCodes,
  ErrorMessages,
} from '../utils/responses.js';
import { createCheckoutSession } from '../services/stripe.service.js';
import { hashPassword, timingSafeVerify } from '../utils/password.js';

const users = new Hono<HonoEnv>();

// All routes require authentication
users.use('*', requireAuth);

/**
 * POST /users/me/products
 *
 * Create a Stripe checkout session for a product subscription
 */
const createCheckoutSchema = z.object({
  productId: z.string().uuid(),
});

users.post('/me/products', async (c) => {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const db = c.get('db');

  // Validate request body
  const parseResult = createCheckoutSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return badRequest(
      c,
      ErrorCodes.VALIDATION_ERROR,
      'Invalid request data',
      parseResult.error.errors
    );
  }

  const { productId } = parseResult.data;

  try {
    // Get product details including Stripe price ID
    const productResult = await db.query(
      `SELECT id, name, slug, stripe_price_id, price_monthly
       FROM products
       WHERE id = $1 AND active = true`,
      [productId]
    );

    if (productResult.rows.length === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, ErrorMessages.PRODUCT_NOT_FOUND);
    }

    const product = productResult.rows[0];

    if (!product.stripe_price_id) {
      console.error(
        `[Checkout] Product ${product.slug} has no Stripe price ID`
      );
      return badRequest(
        c,
        ErrorCodes.VALIDATION_ERROR,
        'Product is not available for purchase at this time'
      );
    }

    // Check if user already has an active subscription for this product
    const existingSubscription = await db.query(
      `SELECT id FROM user_products
       WHERE user_id = $1 AND product_id = $2 AND status = 'active'`,
      [userId, productId]
    );

    if (existingSubscription.rows.length > 0) {
      return badRequest(
        c,
        ErrorCodes.VALIDATION_ERROR,
        'You already have an active subscription for this product'
      );
    }

    // Construct success and cancel URLs
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3006';
    const successUrl = `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontendUrl}/checkout/cancel`;

    // Create Stripe checkout session
    const session = await createCheckoutSession({
      priceId: product.stripe_price_id,
      userId,
      userEmail,
      successUrl,
      cancelUrl,
      metadata: {
        productId: productId, // Already a string (UUID)
        productSlug: product.slug,
      },
    });

    return success(c, {
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('[Checkout] Error creating checkout session:', error);
    throw error;
  }
});

/**
 * PUT /users/me/password
 *
 * Change user password
 */
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

users.put('/me/password', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  // Validate request body
  const parseResult = changePasswordSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return badRequest(
      c,
      ErrorCodes.VALIDATION_ERROR,
      'Invalid request data',
      parseResult.error.errors
    );
  }

  const { currentPassword, newPassword } = parseResult.data;

  try {
    // Get current password hash
    const userResult = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'User not found');
    }

    const user = userResult.rows[0];

    // Verify current password
    const isValid = await timingSafeVerify(currentPassword, user.password_hash);
    if (!isValid) {
      return unauthorized(c, ErrorCodes.INVALID_CREDENTIALS, 'Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );

    // Create audit log entry
    const ipAddressRaw =
      c.req.header('x-forwarded-for') ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip') ||
      '';
    const ipAddress = ipAddressRaw.split(',')[0].trim() || null;

    await db.query(
      `INSERT INTO admin_audit_log (action, resource_type, resource_id, ip_address)
       VALUES ('password_changed', 'user', $1, $2)`,
      [userId, ipAddress]
    );

    return success(c, { message: 'Password changed successfully' });
  } catch (error) {
    console.error('[Users] Change password error:', error);
    throw error;
  }
});

export default users;
