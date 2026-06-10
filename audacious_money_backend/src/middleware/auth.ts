/**
 * JWT Authentication Middleware
 *
 * Provides authentication middleware for protecting routes and verifying user identity.
 * Implements IDOR prevention by setting user context and PostgreSQL session variables.
 *
 * CRITICAL SECURITY PATTERNS:
 * - Every authenticated request sets userId in context
 * - PostgreSQL session variable set for Row-Level Security (RLS)
 * - All database queries MUST filter by user_id for user-owned resources
 *
 * Usage:
 *   app.get('/protected', requireAuth, async (c) => {
 *     const userId = c.get('userId');
 *     // Use userId in all queries
 *   });
 */

import { Context, Next } from 'hono';
import { verifyToken, isUserToken, isAdminToken } from '../utils/jwt.js';
import { unauthorized, forbidden, ErrorCodes, ErrorMessages } from '../utils/responses.js';
import { hasPermission, type Permission } from '../config/permissions.js';
import type { Pool } from 'pg';

/**
 * Extract token from Authorization header
 */
function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Set PostgreSQL session variable for Row-Level Security (RLS)
 *
 * This enables database-level IDOR prevention using RLS policies
 */
async function setPostgresSessionVariable(
  db: Pool,
  userId: string
): Promise<void> {
  try {
    // SET command doesn't support parameterized queries
    // Validate UUID format first to prevent SQL injection
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      throw new Error('Invalid userId format');
    }
    await db.query(`SET app.user_id = '${userId}'`);
  } catch (error) {
    console.error('[Auth] Failed to set PostgreSQL session variable:', error);
    // Don't throw - this is a defense-in-depth measure
    // Primary IDOR prevention is still application-level filtering
  }
}

/**
 * Require authentication middleware
 *
 * Validates JWT token and sets user context.
 * CRITICAL: Sets userId in context for IDOR prevention.
 *
 * @example
 * app.get('/api/products', requireAuth, async (c) => {
 *   const userId = c.get('userId'); // Always use this in queries
 *   const products = await db.query(
 *     'SELECT * FROM user_products WHERE user_id = $1',
 *     [userId]
 *   );
 * });
 */
export async function requireAuth(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader);

  if (!token) {
    return unauthorized(c, ErrorCodes.TOKEN_REQUIRED, ErrorMessages.TOKEN_REQUIRED);
  }

  try {
    // Verify and decode token
    const payload = await verifyToken(token);

    // Ensure it's a user token (not admin)
    if (!isUserToken(payload)) {
      return unauthorized(c, ErrorCodes.INVALID_TOKEN, 'Invalid token type');
    }

    // CRITICAL: Set user context for IDOR prevention
    c.set('userId', payload.userId);
    c.set('userEmail', payload.email);
    c.set('userRole', payload.role);

    // Set PostgreSQL session variable for RLS (defense in depth)
    const db = c.get('db') as Pool;
    if (db) {
      await setPostgresSessionVariable(db, payload.userId);
    }

    await next();
  } catch (error) {
    return unauthorized(
      c,
      ErrorCodes.INVALID_TOKEN,
      ErrorMessages.INVALID_TOKEN
    );
  }
}

/**
 * Require specific role middleware
 *
 * Use this to restrict endpoints to specific user roles.
 *
 * @param allowedRole - Required role ('user' for now, expandable)
 *
 * @example
 * app.get('/premium', requireAuth, requireRole('user'), async (c) => {
 *   // Only users with 'user' role can access
 * });
 */
export function requireRole(allowedRole: string) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const userRole = c.get('userRole') as string | undefined;

    if (!userRole) {
      return unauthorized(c, ErrorCodes.UNAUTHORIZED, 'Authentication required');
    }

    if (userRole !== allowedRole) {
      return forbidden(
        c,
        ErrorCodes.FORBIDDEN,
        `Role '${allowedRole}' required`
      );
    }

    await next();
  };
}

/**
 * Require admin authentication middleware
 *
 * Validates JWT token for admin users and sets admin context.
 *
 * @example
 * app.get('/admin/users', requireAdmin, async (c) => {
 *   const adminId = c.get('adminId');
 *   // Admin-only logic
 * });
 */
export async function requireAdmin(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader);

  if (!token) {
    return unauthorized(c, ErrorCodes.TOKEN_REQUIRED, ErrorMessages.TOKEN_REQUIRED);
  }

  try {
    const payload = await verifyToken(token);

    // Ensure it's an admin token
    if (!isAdminToken(payload)) {
      return forbidden(c, ErrorCodes.FORBIDDEN, ErrorMessages.ADMIN_REQUIRED);
    }

    // Set admin context
    c.set('adminId', payload.adminId);
    c.set('adminEmail', payload.email);
    c.set('adminRole', payload.role);
    c.set('adminPermissions', payload.permissions);

    await next();
  } catch (error) {
    return unauthorized(
      c,
      ErrorCodes.INVALID_TOKEN,
      ErrorMessages.INVALID_TOKEN
    );
  }
}

/**
 * Require specific admin permission middleware
 *
 * Use this to restrict admin endpoints to specific permissions.
 *
 * @param requiredPermissions - Array of required permissions
 *
 * @example
 * app.get('/admin/users', requireAdmin, requirePermission(['view_users']), async (c) => {
 *   // Only admins with 'view_users' permission can access
 * });
 */
export function requirePermission(requiredPermissions: Permission[]) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const adminPermissions = c.get('adminPermissions') as Permission[] | ['*'] | undefined;

    if (!adminPermissions) {
      return unauthorized(
        c,
        ErrorCodes.UNAUTHORIZED,
        'Admin authentication required'
      );
    }

    // Check if admin has required permissions
    const hasRequiredPermissions = requiredPermissions.every((perm) =>
      hasPermission(adminPermissions, perm)
    );

    if (!hasRequiredPermissions) {
      return forbidden(
        c,
        ErrorCodes.INSUFFICIENT_PERMISSIONS,
        ErrorMessages.INSUFFICIENT_PERMISSIONS
      );
    }

    await next();
  };
}

/**
 * IDOR PREVENTION PATTERN DOCUMENTATION
 *
 * ❌ WRONG (vulnerable to IDOR):
 * ```typescript
 * const product = await db.query(
 *   'SELECT * FROM user_products WHERE id = $1',
 *   [productId]
 * );
 * ```
 *
 * ✅ RIGHT (prevents IDOR):
 * ```typescript
 * const userId = c.get('userId'); // From requireAuth middleware
 * const product = await db.query(
 *   'SELECT * FROM user_products WHERE id = $1 AND user_id = $2',
 *   [productId, userId]
 * );
 *
 * // Return NOT_FOUND if user doesn't own resource (don't reveal it exists)
 * if (!product.rows[0]) {
 *   return notFound(c, ErrorCodes.NOT_FOUND, ErrorMessages.PRODUCT_NOT_FOUND);
 * }
 * ```
 *
 * CRITICAL RULES:
 * 1. ALWAYS get userId from context: `c.get('userId')`
 * 2. ALWAYS include `AND user_id = $userId` in WHERE clause
 * 3. NEVER reveal whether a resource exists if user doesn't own it
 * 4. Return NOT_FOUND (404) for unauthorized access, not FORBIDDEN (403)
 */
