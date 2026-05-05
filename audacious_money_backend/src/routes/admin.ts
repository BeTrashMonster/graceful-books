/**
 * Admin routes
 *
 * Handles admin authentication and admin-only endpoints
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../types/hono.js';
import { validate } from '../utils/validation.js';
import { loginSchema } from '../utils/validation.js';
import { timingSafeVerify } from '../utils/password.js';
import { generateAdminToken } from '../utils/jwt.js';
import { requireAdmin } from '../middleware/auth.js';
import {
  success,
  badRequest,
  unauthorized,
  notFound,
  ErrorCodes,
  ErrorMessages,
} from '../utils/responses.js';
import { hashPassword } from '../utils/password.js';
import { z } from 'zod';
import { stripe } from '../services/stripe.service.js';

const admin = new Hono<HonoEnv>();

/**
 * POST /admin/login
 *
 * Admin login endpoint
 */
admin.post('/login', validate(loginSchema), async (c) => {
  const { email, password } = c.get('validatedData') as {
    email: string;
    password: string;
  };
  const db = c.get('db');

  try {
    // Look up admin user
    const result = await db.query(
      `SELECT id, email, password_hash, first_name, last_name, role, active
       FROM admin_users
       WHERE email = $1`,
      [email]
    );

    // User not found or inactive
    if (result.rowCount === 0) {
      return unauthorized(c, ErrorCodes.INVALID_CREDENTIALS, ErrorMessages.INVALID_CREDENTIALS);
    }

    const adminUser = result.rows[0];

    // Check if account is active
    if (!adminUser.active) {
      return unauthorized(c, ErrorCodes.ACCOUNT_INACTIVE, 'Your account has been deactivated');
    }

    // Verify password using timing-safe comparison
    const isValidPassword = await timingSafeVerify(password, adminUser.password_hash);

    if (!isValidPassword) {
      return unauthorized(c, ErrorCodes.INVALID_CREDENTIALS, ErrorMessages.INVALID_CREDENTIALS);
    }

    // Generate admin JWT token with all permissions for super_admin
    const permissions = adminUser.role === 'super_admin' ? ['*'] : [];
    const token = await generateAdminToken(
      adminUser.id,
      adminUser.email,
      adminUser.role,
      permissions
    );

    // Update last login timestamp
    await db.query('UPDATE admin_users SET last_login_at = NOW() WHERE id = $1', [
      adminUser.id,
    ]);

    return success(c, {
      token,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.first_name,
        lastName: adminUser.last_name,
        role: adminUser.role,
      },
    });
  } catch (error) {
    console.error('[Admin] Login error:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred');
  }
});

/**
 * GET /admin/users
 *
 * List all users (admin only)
 */
admin.get('/users', requireAdmin, async (c) => {
  const db = c.get('db');

  try {
    const result = await db.query(
      `SELECT id, email, first_name, last_name, company_name, support_key,
              account_status, email_verified, created_at, last_login_at
       FROM users
       ORDER BY created_at DESC`
    );

    return success(c, {
      users: result.rows.map((row) => ({
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        companyName: row.company_name,
        supportKey: row.support_key,
        accountStatus: row.account_status,
        emailVerified: row.email_verified,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
      })),
    });
  } catch (error) {
    console.error('[Admin] Error fetching users:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch users');
  }
});

/**
 * PATCH /admin/me/password
 *
 * Change admin password
 */
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

admin.patch('/me/password', requireAdmin, validate(changePasswordSchema), async (c) => {
  const adminId = c.get('adminId');
  const { currentPassword, newPassword } = c.get('validatedData') as {
    currentPassword: string;
    newPassword: string;
  };
  const db = c.get('db');

  try {
    // Get current password hash
    const result = await db.query(
      'SELECT password_hash FROM admin_users WHERE id = $1',
      [adminId]
    );

    if (result.rowCount === 0) {
      return unauthorized(c, ErrorCodes.INVALID_CREDENTIALS, 'Admin user not found');
    }

    const { password_hash } = result.rows[0];

    // Verify current password
    const isValidPassword = await timingSafeVerify(currentPassword, password_hash);

    if (!isValidPassword) {
      return unauthorized(c, ErrorCodes.INVALID_CREDENTIALS, 'Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await db.query(
      'UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, adminId]
    );

    return success(c, { message: 'Password updated successfully' });
  } catch (error) {
    console.error('[Admin] Error changing password:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to change password');
  }
});

/**
 * DELETE /admin/users/:userId
 *
 * Delete a user (admin only)
 */
admin.delete('/users/:userId', requireAdmin, async (c) => {
  const { userId } = c.req.param();
  const db = c.get('db');

  try {
    // Check if user exists
    const userResult = await db.query('SELECT id, email FROM users WHERE id = $1', [userId]);

    if (userResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'User not found');
    }

    const user = userResult.rows[0];

    // CRITICAL: Cancel all active Stripe subscriptions before deleting user
    console.log(`[Admin] Checking for Stripe subscriptions for user ${userId}`);
    const subscriptionsResult = await db.query(
      `SELECT stripe_subscription_id
       FROM user_products
       WHERE user_id = $1
       AND stripe_subscription_id IS NOT NULL`,
      [userId]
    );

    const cancelledSubscriptions: string[] = [];
    const failedCancellations: { subscriptionId: string; error: string }[] = [];

    for (const row of subscriptionsResult.rows) {
      const subscriptionId = row.stripe_subscription_id;
      try {
        console.log(`[Admin] Cancelling Stripe subscription: ${subscriptionId}`);
        await stripe.subscriptions.cancel(subscriptionId);
        cancelledSubscriptions.push(subscriptionId);
        console.log(`[Admin] ✅ Successfully cancelled subscription: ${subscriptionId}`);
      } catch (stripeError: any) {
        console.error(`[Admin] ❌ Failed to cancel subscription ${subscriptionId}:`, stripeError);
        failedCancellations.push({
          subscriptionId,
          error: stripeError.message || 'Unknown error',
        });
      }
    }

    // Log subscription cancellation results
    if (cancelledSubscriptions.length > 0) {
      console.log(`[Admin] Cancelled ${cancelledSubscriptions.length} subscription(s)`);
    }
    if (failedCancellations.length > 0) {
      console.warn(
        `[Admin] ⚠️ Failed to cancel ${failedCancellations.length} subscription(s):`,
        failedCancellations
      );
    }

    // Delete user (cascade will handle related records)
    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    // Log the action
    const adminId = c.get('adminId');
    const ipAddress =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip') ||
      '';

    await db.query(
      `INSERT INTO admin_audit_log (action, resource_type, resource_id, admin_user_id, ip_address, old_values)
       VALUES ('user_deleted', 'user', $1, $2, $3, $4)`,
      [
        userId,
        adminId,
        ipAddress,
        JSON.stringify({
          email: user.email,
          cancelledSubscriptions,
          failedCancellations,
        }),
      ]
    );

    return success(c, {
      message: 'User deleted successfully',
      cancelledSubscriptions: cancelledSubscriptions.length,
      failedCancellations: failedCancellations.length,
      details:
        failedCancellations.length > 0
          ? {
              warning:
                'Some Stripe subscriptions could not be cancelled. They may need manual cancellation in Stripe Dashboard.',
              failed: failedCancellations,
            }
          : undefined,
    });
  } catch (error) {
    console.error('[Admin] Error deleting user:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to delete user');
  }
});

/**
 * GET /admin/users/:userId/products
 *
 * Get all products for a user (admin only)
 */
admin.get('/users/:userId/products', requireAdmin, async (c) => {
  const { userId } = c.req.param();
  const db = c.get('db');

  try {
    // Check if user exists
    const userResult = await db.query('SELECT id FROM users WHERE id = $1', [userId]);

    if (userResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'User not found');
    }

    // Get user's products
    const result = await db.query(
      `SELECT up.id, up.product_id, up.status, up.activated_at, up.expires_at,
              p.name, p.slug, p.description, p.price_monthly
       FROM user_products up
       JOIN products p ON up.product_id = p.id
       WHERE up.user_id = $1
       ORDER BY up.activated_at DESC`,
      [userId]
    );

    return success(c, {
      products: result.rows.map((row) => ({
        id: row.id,
        productId: row.product_id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        priceMonthly: row.price_monthly,
        status: row.status,
        activatedAt: row.activated_at,
        expiresAt: row.expires_at,
      })),
    });
  } catch (error) {
    console.error('[Admin] Error fetching user products:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch user products');
  }
});

/**
 * POST /admin/users/:userId/products
 *
 * Add a product to a user (admin only)
 */
const addProductSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  status: z.enum(['trial', 'active', 'paused', 'cancelled', 'expired']).default('active'),
});

admin.post('/users/:userId/products', requireAdmin, validate(addProductSchema), async (c) => {
  const { userId } = c.req.param();
  const { productId, status } = c.get('validatedData') as {
    productId: string;
    status: string;
  };
  const db = c.get('db');

  try {
    // Check if user exists
    const userResult = await db.query('SELECT id, email FROM users WHERE id = $1', [userId]);

    if (userResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'User not found');
    }

    // Check if product exists
    const productResult = await db.query(
      'SELECT id, name, slug FROM products WHERE id = $1',
      [productId]
    );

    if (productResult.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Product not found');
    }

    const product = productResult.rows[0];

    // Check if user already has this product
    const existingResult = await db.query(
      'SELECT id FROM user_products WHERE user_id = $1 AND product_id = $2',
      [userId, productId]
    );

    if (existingResult.rowCount > 0) {
      return badRequest(
        c,
        ErrorCodes.VALIDATION_ERROR,
        'User already has this product assigned'
      );
    }

    // Add product to user
    const insertResult = await db.query(
      `INSERT INTO user_products (user_id, product_id, status, activated_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, user_id, product_id, status, activated_at`,
      [userId, productId, status]
    );

    const userProduct = insertResult.rows[0];

    // Log the action
    const adminId = c.get('adminId');
    const ipAddress =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip') ||
      '';

    await db.query(
      `INSERT INTO admin_audit_log (action, resource_type, resource_id, admin_user_id, ip_address, new_values)
       VALUES ('product_assigned', 'user', $1, $2, $3, $4)`,
      [
        userId,
        adminId,
        ipAddress,
        JSON.stringify({ productId, productName: product.name, status }),
      ]
    );

    return success(c, {
      message: 'Product assigned successfully',
      userProduct: {
        id: userProduct.id,
        userId: userProduct.user_id,
        productId: userProduct.product_id,
        status: userProduct.status,
        activatedAt: userProduct.activated_at,
      },
    });
  } catch (error) {
    console.error('[Admin] Error adding product to user:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to add product to user');
  }
});

/**
 * DELETE /admin/users/:userId/products/:productId
 *
 * Remove a product from a user (admin only)
 */
admin.delete('/users/:userId/products/:productId', requireAdmin, async (c) => {
  const { userId, productId } = c.req.param();
  const db = c.get('db');

  try {
    // Check if user product assignment exists
    const result = await db.query(
      `SELECT up.id, p.name, p.slug
       FROM user_products up
       JOIN products p ON up.product_id = p.id
       WHERE up.user_id = $1 AND up.product_id = $2`,
      [userId, productId]
    );

    if (result.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'User product assignment not found');
    }

    const product = result.rows[0];

    // Delete the user product assignment
    await db.query('DELETE FROM user_products WHERE user_id = $1 AND product_id = $2', [
      userId,
      productId,
    ]);

    // Log the action
    const adminId = c.get('adminId');
    const ipAddress =
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip') ||
      '';

    await db.query(
      `INSERT INTO admin_audit_log (action, resource_type, resource_id, admin_user_id, ip_address, old_values)
       VALUES ('product_removed', 'user', $1, $2, $3, $4)`,
      [userId, adminId, ipAddress, JSON.stringify({ productId, productName: product.name })]
    );

    return success(c, { message: 'Product removed successfully' });
  } catch (error) {
    console.error('[Admin] Error removing product from user:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to remove product from user');
  }
});

/**
 * GET /admin/cpg-launch-signups
 *
 * Get all CPG Product Costing Tool launch signups (admin only)
 */
admin.get('/cpg-launch-signups', requireAdmin, async (c) => {
  const db = c.get('db');

  try {
    const result = await db.query(
      `SELECT
        id,
        email,
        first_name,
        last_name,
        business_name,
        created_at,
        notified_at,
        converted_to_user_id,
        unsubscribed_at
       FROM cpg_launch_signups
       ORDER BY created_at DESC`
    );

    return success(c, { signups: result.rows });
  } catch (error) {
    console.error('[Admin] Error fetching CPG launch signups:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch launch signups');
  }
});

/**
 * GET /admin/home-email-signups
 *
 * Get all home page email waitlist signups (admin only)
 */
admin.get('/home-email-signups', requireAdmin, async (c) => {
  const db = c.get('db');

  try {
    const result = await db.query(
      `SELECT
        id,
        email,
        first_name,
        last_name,
        created_at,
        unsubscribed_at
       FROM home_email_signups
       ORDER BY created_at DESC`
    );

    return success(c, { signups: result.rows });
  } catch (error) {
    console.error('[Admin] Error fetching home email signups:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch home email signups');
  }
});

/**
 * GET /admin/bookkeeping-signups
 *
 * Get all bookkeeping suite waitlist signups (admin only)
 */
admin.get('/bookkeeping-signups', requireAdmin, async (c) => {
  const db = c.get('db');

  try {
    const result = await db.query(
      `SELECT
        id,
        email,
        first_name,
        last_name,
        created_at,
        unsubscribed_at
       FROM bookkeeping_signups
       ORDER BY created_at DESC`
    );

    return success(c, { signups: result.rows });
  } catch (error) {
    console.error('[Admin] Error fetching bookkeeping signups:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch bookkeeping signups');
  }
});

/**
 * PATCH /admin/signups/:tag/:id/unsubscribe
 *
 * Toggle unsubscribe status for a signup (admin only)
 */
admin.patch('/signups/:tag/:id/unsubscribe', requireAdmin, async (c) => {
  const db = c.get('db');
  const tag = c.req.param('tag');
  const id = c.req.param('id');

  if (!['cpg', 'home', 'bookkeeping'].includes(tag)) {
    return badRequest(c, ErrorCodes.VALIDATION_ERROR, 'Invalid tag');
  }

  const tableName = tag === 'cpg' ? 'cpg_launch_signups' : tag === 'home' ? 'home_email_signups' : 'bookkeeping_signups';

  try {
    // Check current status
    const current = await db.query(
      `SELECT id, unsubscribed_at FROM ${tableName} WHERE id = $1`,
      [id]
    );

    if (current.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Signup not found');
    }

    const isCurrentlyUnsubscribed = current.rows[0].unsubscribed_at !== null;

    // Toggle status
    if (isCurrentlyUnsubscribed) {
      // Resubscribe
      await db.query(
        `UPDATE ${tableName} SET unsubscribed_at = NULL WHERE id = $1`,
        [id]
      );
    } else {
      // Unsubscribe
      await db.query(
        `UPDATE ${tableName} SET unsubscribed_at = NOW() WHERE id = $1`,
        [id]
      );
    }

    return success(c, { message: isCurrentlyUnsubscribed ? 'Resubscribed successfully' : 'Unsubscribed successfully' });
  } catch (error) {
    console.error('[Admin] Error toggling unsubscribe:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to update subscription status');
  }
});

/**
 * DELETE /admin/signups/:tag/:id
 *
 * Delete a signup permanently (admin only)
 */
admin.delete('/signups/:tag/:id', requireAdmin, async (c) => {
  const db = c.get('db');
  const tag = c.req.param('tag');
  const id = c.req.param('id');

  if (!['cpg', 'home', 'bookkeeping'].includes(tag)) {
    return badRequest(c, ErrorCodes.VALIDATION_ERROR, 'Invalid tag');
  }

  const tableName = tag === 'cpg' ? 'cpg_launch_signups' : tag === 'home' ? 'home_email_signups' : 'bookkeeping_signups';

  try {
    const result = await db.query(
      `DELETE FROM ${tableName} WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Signup not found');
    }

    return success(c, { message: 'Signup deleted successfully' });
  } catch (error) {
    console.error('[Admin] Error deleting signup:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to delete signup');
  }
});

/**
 * PATCH /admin/signups/:tag/:id
 *
 * Update signup details (admin only)
 */
admin.patch('/signups/:tag/:id', requireAdmin, async (c) => {
  const db = c.get('db');
  const tag = c.req.param('tag');
  const id = c.req.param('id');

  if (!['cpg', 'home', 'bookkeeping'].includes(tag)) {
    return badRequest(c, ErrorCodes.VALIDATION_ERROR, 'Invalid tag');
  }

  const tableName = tag === 'cpg' ? 'cpg_launch_signups' : tag === 'home' ? 'home_email_signups' : 'bookkeeping_signups';

  try {
    const body = await c.req.json();
    const { firstName, lastName, businessName } = body;

    let query: string;
    let params: any[];

    if (tag === 'cpg') {
      query = `UPDATE ${tableName} SET first_name = $1, last_name = $2, business_name = $3 WHERE id = $4 RETURNING id`;
      params = [firstName, lastName, businessName || null, id];
    } else {
      query = `UPDATE ${tableName} SET first_name = $1, last_name = $2 WHERE id = $3 RETURNING id`;
      params = [firstName, lastName, id];
    }

    const result = await db.query(query, params);

    if (result.rowCount === 0) {
      return notFound(c, ErrorCodes.NOT_FOUND, 'Signup not found');
    }

    return success(c, { message: 'Signup updated successfully' });
  } catch (error) {
    console.error('[Admin] Error updating signup:', error);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to update signup');
  }
});

/**
 * GET /admin/all-signups
 *
 * Get ALL email signups from all lists with tag filtering (admin only)
 *
 * Query params:
 * - tag: Filter by specific tag (cpg, home, bookkeeping)
 */
admin.get('/all-signups', requireAdmin, async (c) => {
  const db = c.get('db');
  const tagFilter = c.req.query('tag');

  try {
    let query = `
      SELECT
        id,
        email,
        first_name,
        last_name,
        business_name,
        'cpg' as tag,
        created_at,
        unsubscribed_at,
        notified_at,
        converted_to_user_id
      FROM cpg_launch_signups

      UNION ALL

      SELECT
        id,
        email,
        first_name,
        last_name,
        NULL as business_name,
        'home' as tag,
        created_at,
        unsubscribed_at,
        NULL as notified_at,
        NULL as converted_to_user_id
      FROM home_email_signups

      UNION ALL

      SELECT
        id,
        email,
        first_name,
        last_name,
        NULL as business_name,
        'bookkeeping' as tag,
        created_at,
        unsubscribed_at,
        NULL as notified_at,
        NULL as converted_to_user_id
      FROM bookkeeping_signups
    `;

    // Add WHERE clause for tag filtering
    if (tagFilter && ['cpg', 'home', 'bookkeeping'].includes(tagFilter)) {
      query = `SELECT * FROM (${query}) AS all_signups WHERE tag = $1 ORDER BY created_at DESC`;
      const result = await db.query(query, [tagFilter]);
      console.log('[Admin] All signups (filtered):', { tag: tagFilter, count: result.rowCount, rows: result.rows });
      return success(c, { signups: result.rows });
    } else {
      query += ' ORDER BY created_at DESC';
      const result = await db.query(query);
      console.log('[Admin] All signups (unfiltered):', { count: result.rowCount, rows: result.rows });
      return success(c, { signups: result.rows });
    }
  } catch (error) {
    console.error('[Admin] Error fetching all signups:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Admin] Detailed error:', errorMessage);
    return badRequest(c, ErrorCodes.INTERNAL_ERROR, `Failed to fetch signups: ${errorMessage}`);
  }
});

/**
 * GET /admin/charities
 *
 * List all charities with analytics (admin only)
 */
admin.get('/charities', requireAdmin, async (c) => {
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
        shortDescription: row.short_description,
        longDescription: row.long_description,
        website: row.website,
        category: row.category,
        logo: row.logo,
        paymentAddress: row.payment_address,
        status: row.status,
        active: row.active,
        displayOrder: row.display_order,
        verificationNotes: row.verification_notes,
        rejectionReason: row.rejection_reason,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
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
admin.get('/charities/:id', requireAdmin, async (c) => {
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
        brandColorBackground: row.brandColorBackground,
        brandColorTitle: row.brandColorTitle,
        brandColorDescription: row.brandColorDescription,
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
  brandColorBackground: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  brandColorTitle: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  brandColorDescription: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
});

admin.post('/charities', requireAdmin, validate(createCharitySchema), async (c) => {
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
         category, logo, payment_address, status, active, display_order, created_by,
         "brandColorBackground", "brandColorTitle", "brandColorDescription"
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', false, $9, $10, $11, $12, $13)
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
        data.brandColorBackground || null,
        data.brandColorTitle || null,
        data.brandColorDescription || null,
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
const updateCharitySchema = createCharitySchema.partial();

admin.patch('/charities/:id', requireAdmin, validate(updateCharitySchema), async (c) => {
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
    if (data.brandColorBackground !== undefined) {
      updates.push(`"brandColorBackground" = $${paramCount++}`);
      values.push(data.brandColorBackground);
    }
    if (data.brandColorTitle !== undefined) {
      updates.push(`"brandColorTitle" = $${paramCount++}`);
      values.push(data.brandColorTitle);
    }
    if (data.brandColorDescription !== undefined) {
      updates.push(`"brandColorDescription" = $${paramCount++}`);
      values.push(data.brandColorDescription);
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
admin.delete('/charities/:id', requireAdmin, async (c) => {
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
const verifyCharitySchema = z.object({
  verificationNotes: z.string().optional(),
});

admin.post('/charities/:id/verify', requireAdmin, validate(verifyCharitySchema), async (c) => {
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
const rejectCharitySchema = z.object({
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
});

admin.post('/charities/:id/reject', requireAdmin, validate(rejectCharitySchema), async (c) => {
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
admin.get('/charity-transitions', requireAdmin, async (c) => {
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
const createPhaseTransitionSchema = z.object({
  charityId: z.string().uuid('Invalid charity ID'),
  replacementCharityId: z.string().uuid('Invalid replacement charity ID').optional(),
  phaseOutDate: z.string().datetime('Invalid phase out date'),
  phaseInDate: z.string().datetime('Invalid phase in date').optional(),
  reason: z.string().min(1, 'Reason is required'),
  adminNotes: z.string().optional(),
});

admin.post(
  '/charity-transitions',
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
const updatePhaseTransitionSchema = z.object({
  status: z.enum(['scheduled', 'notified', 'in_progress', 'completed', 'cancelled']).optional(),
  reason: z.string().optional(),
  adminNotes: z.string().optional(),
});

admin.patch(
  '/charity-transitions/:id',
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
admin.post('/charity-transitions/:id/notify', requireAdmin, async (c) => {
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
admin.get('/charity-distributions', requireAdmin, async (c) => {
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
const markDistributionPaidSchema = z.object({
  paymentMethod: z.enum(['ach', 'check', 'wire', 'other']),
  paymentReference: z.string().max(255).optional(),
  notes: z.string().optional(),
});

admin.post(
  '/charity-distributions/:id/mark-paid',
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
admin.get('/charity-analytics', requireAdmin, async (c) => {
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

/**
 * POST /admin/stripe/update-product-id
 *
 * Update Stripe product and price IDs for a product (admin only)
 */
const updateStripeProductIdSchema = z.object({
  productSlug: z.string().min(1, 'Product slug is required'),
  stripePriceId: z.string().min(1, 'Stripe price ID is required'),
});

admin.post(
  '/stripe/update-product-id',
  requireAdmin,
  validate(updateStripeProductIdSchema),
  async (c) => {
    const adminId = c.get('adminId');
    const { productSlug, stripePriceId } = c.get('validatedData') as z.infer<
      typeof updateStripeProductIdSchema
    >;
    const db = c.get('db');

    try {
      // Check if product exists
      const productResult = await db.query(
        'SELECT id, name, slug, stripe_price_id FROM products WHERE slug = $1',
        [productSlug]
      );

      if (productResult.rowCount === 0) {
        return notFound(c, ErrorCodes.NOT_FOUND, `Product with slug "${productSlug}" not found`);
      }

      const product = productResult.rows[0];
      const oldStripePriceId = product.stripe_price_id;

      // Update the Stripe price ID
      const updateResult = await db.query(
        `UPDATE products
         SET stripe_price_id = $1, updated_at = NOW()
         WHERE slug = $2
         RETURNING id, name, slug, stripe_price_id`,
        [stripePriceId, productSlug]
      );

      const updatedProduct = updateResult.rows[0];

      // Log action
      const ipAddress =
        c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
        c.req.header('x-real-ip') ||
        c.req.header('cf-connecting-ip') ||
        '';

      await db.query(
        `INSERT INTO admin_audit_log (action, resource_type, resource_id, admin_user_id, ip_address, old_values, new_values)
         VALUES ('product_stripe_id_updated', 'product', $1, $2, $3, $4, $5)`,
        [
          updatedProduct.id,
          adminId,
          ipAddress,
          JSON.stringify({ stripePriceId: oldStripePriceId }),
          JSON.stringify({ stripePriceId }),
        ]
      );

      return success(c, {
        message: 'Stripe product ID updated successfully',
        product: {
          id: updatedProduct.id,
          name: updatedProduct.name,
          slug: updatedProduct.slug,
          stripePriceId: updatedProduct.stripe_price_id,
        },
      });
    } catch (error) {
      console.error('[Admin] Error updating Stripe product ID:', error);
      return badRequest(c, ErrorCodes.INTERNAL_ERROR, 'Failed to update Stripe product ID');
    }
  }
);

export default admin;
