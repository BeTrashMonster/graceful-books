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
      [userId, adminId, ipAddress, JSON.stringify({ email: user.email })]
    );

    return success(c, { message: 'User deleted successfully' });
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
  status: z.enum(['trial', 'active', 'cancelled', 'expired']).default('active'),
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

export default admin;
