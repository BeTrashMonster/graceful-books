/**
 * Security service for tracking failed login attempts and implementing brute-force protection
 *
 * This service logs failed login attempts to enable future rate limiting and account lockout features.
 */

import type { Pool } from 'pg';

/**
 * Track a failed login attempt
 *
 * @param db - Database connection pool
 * @param email - User's email address
 * @param ipAddress - IP address of the request (optional)
 * @returns Promise<void>
 *
 * @example
 * await trackFailedLogin(db, 'user@example.com', '192.168.1.1');
 */
export async function trackFailedLogin(
  db: Pool,
  email: string,
  ipAddress: string | null
): Promise<void> {
  try {
    // Log the failed attempt for future brute-force detection
    // Note: We don't currently enforce rate limiting, but this data
    // enables future implementation of account lockout features
    await db.query(
      `
      INSERT INTO admin_audit_log (action, resource_type, resource_id, ip_address)
      VALUES ('failed_login', 'user', NULL, $1::inet)
      `,
      [ipAddress]
    );

    console.log(`[Security] Failed login attempt for ${email} from ${ipAddress || 'unknown IP'}`);
  } catch (error) {
    // Don't throw - failed logging shouldn't block the login flow
    console.error('[Security] Error tracking failed login:', error);
  }
}

/**
 * Get count of failed login attempts within a time window
 *
 * @param db - Database connection pool
 * @param email - User's email address
 * @param ipAddress - IP address of the request (optional)
 * @param windowMinutes - Time window in minutes (default: 15)
 * @returns Promise<number> - Number of failed attempts
 *
 * @example
 * const attempts = await getFailedLoginAttempts(db, 'user@example.com', '192.168.1.1');
 * if (attempts > 5) {
 *   // Account lockout logic
 * }
 */
export async function getFailedLoginAttempts(
  db: Pool,
  email: string,
  ipAddress: string | null,
  windowMinutes: number = 15
): Promise<number> {
  try {
    const result = await db.query(
      `
      SELECT COUNT(*) as count
      FROM admin_audit_log
      WHERE action = 'failed_login'
        AND ip_address = $1::inet
        AND created_at > NOW() - INTERVAL '${windowMinutes} minutes'
      `,
      [ipAddress]
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  } catch (error) {
    console.error('[Security] Error getting failed login attempts:', error);
    return 0;
  }
}

/**
 * Clear failed login attempts for a user (called on successful login)
 *
 * Note: Currently this is a no-op since we log to admin_audit_log for historical tracking.
 * In a future implementation with a dedicated failed_logins table, this would clear those records.
 *
 * @param db - Database connection pool
 * @param email - User's email address
 * @returns Promise<void>
 *
 * @example
 * await clearFailedLogins(db, 'user@example.com');
 */
export async function clearFailedLogins(db: Pool, email: string): Promise<void> {
  // Currently a no-op - we don't delete audit log entries
  // In future implementation with dedicated failed_logins table:
  // await db.query('DELETE FROM failed_logins WHERE email = $1', [email]);
  console.log(`[Security] Successful login for ${email}`);
}
