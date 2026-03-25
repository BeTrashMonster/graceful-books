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

export default admin;
