/**
 * Anonymization Service
 *
 * Handles user account deletion via soft delete with anonymization.
 * This is the SINGLE entry point for all user deletions (user-initiated and admin-initiated).
 *
 * Key principles:
 * - PII is removed or nulled (DELETE bucket)
 * - Records are retained for accounting (ANONYMIZE bucket)
 * - Compliance records are untouched (RETAIN_AS_IS bucket)
 * - Stripe subscriptions are cancelled before anonymization
 * - Email is captured before transaction, sent after commit
 * - Idempotent: deleting already-deleted user returns success
 *
 * Related: USER_DATA_LIFECYCLE_REFACTOR.md roadmap
 * Config: src/config/dataClassification.ts
 */

import { Pool, PoolClient } from 'pg';
import { randomBytes, createHash } from 'crypto';
import { hashPassword } from '../utils/password.js';
import { cancelAllUserSubscriptions } from './stripe.service.js';
import { sendAccountDeletedEmail } from './email.service.js';
import {
  dataClassificationMap,
  getDeleteFields,
  isRetainedTable,
} from '../config/dataClassification.js';

// =============================================================================
// TYPES
// =============================================================================

export interface DeletionOptions {
  /** Who requested the deletion: 'user' or 'admin' */
  requestedBy: 'user' | 'admin';
  /** Admin user ID (required if requestedBy is 'admin') */
  adminId?: string;
  /** Reason for deletion (optional) */
  reason?: string;
  /** IP address of the request (for audit and email) */
  ipAddress?: string;
}

export interface DeletionResult {
  /** Status of the deletion */
  status: 'deleted' | 'already_deleted' | 'blocked';
  /** The GracefulExit ID assigned to the user */
  gracefulExitId: string | null;
  /** Error message if blocked */
  message?: string;
}

export interface UserRecord {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  accountStatus: string;
  gracefulExitId: string | null;
  stripeCustomerId: string | null;
}

// =============================================================================
// FEATURE FLAG
// =============================================================================

export type DeletionMode = 'soft_delete' | 'block_deletions';

/**
 * Get the current deletion mode from environment/config
 * Never returns 'cascade_delete' - that option does not exist
 */
export function getDeletionMode(): DeletionMode {
  const mode = process.env.DELETION_MODE as DeletionMode | undefined;

  // Default to soft_delete, but allow blocking for emergencies
  if (mode === 'block_deletions') {
    return 'block_deletions';
  }

  return 'soft_delete';
}

// =============================================================================
// RATE LIMITING (In-Memory - Replace with Redis in production)
// =============================================================================

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore: Map<string, RateLimitEntry> = new Map();

export const RATE_LIMITS = {
  user: { max: 1, windowMs: 60000 },      // 1 per minute per user
  admin: { max: 10, windowMs: 60000 },    // 10 per minute per admin
  global: { max: 100, windowMs: 60000 },  // 100 per minute total
};

/**
 * Reset the rate limit store - FOR TESTING ONLY
 */
export function _resetRateLimitStore(): void {
  rateLimitStore.clear();
}

/**
 * Get the current rate limit store state - FOR TESTING ONLY
 */
export function _getRateLimitStore(): Map<string, RateLimitEntry> {
  return rateLimitStore;
}

function checkRateLimit(key: string, limit: { max: number; windowMs: number }): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart > limit.windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= limit.max) {
    return false;
  }

  entry.count++;
  return true;
}

function isRateLimited(userId: string, requestedBy: 'user' | 'admin', adminId?: string): boolean {
  // Check user-specific limit
  if (!checkRateLimit(`user:${userId}`, RATE_LIMITS.user)) {
    return true;
  }

  // Check admin-specific limit if admin request
  if (requestedBy === 'admin' && adminId) {
    if (!checkRateLimit(`admin:${adminId}`, RATE_LIMITS.admin)) {
      return true;
    }
  }

  // Check global limit
  if (!checkRateLimit('global', RATE_LIMITS.global)) {
    return true;
  }

  return false;
}

// =============================================================================
// METRICS (Placeholder - Replace with actual metrics library)
// =============================================================================

interface Metrics {
  increment(name: string, tags?: Record<string, string>): void;
  histogram(name: string, value: number, tags?: Record<string, string>): void;
}

const metrics: Metrics = {
  increment(name: string, tags?: Record<string, string>): void {
    // TODO: Replace with actual metrics implementation (e.g., StatsD, Prometheus)
    console.log(`[Metrics] ${name}`, tags || {});
  },
  histogram(name: string, value: number, tags?: Record<string, string>): void {
    // TODO: Replace with actual metrics implementation
    console.log(`[Metrics] ${name}: ${value}ms`, tags || {});
  },
};

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Generate a GracefulExit ID for anonymized users
 * Format: GracefulExit-xxxxxxxx (8 hex characters)
 */
export function generateGracefulExitId(): string {
  const uniquePart = randomBytes(4).toString('hex');
  return `GracefulExit-${uniquePart}`;
}

/**
 * Generate a one-way SHA-256 hash of an email address
 * Used for fraud detection - cannot be reversed to recover email
 */
export function hashEmail(email: string): string {
  const normalized = email.toLowerCase().trim();
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Generate an unusable password hash
 * Creates a valid Argon2id hash that will never match any password input
 */
export async function generateUnusablePasswordHash(): Promise<string> {
  // Generate a random 64-character password that will never be guessed
  const randomPassword = randomBytes(32).toString('hex');
  return await hashPassword(randomPassword);
}

/**
 * Get user record for deletion
 */
async function getUser(db: Pool, userId: string): Promise<UserRecord | null> {
  const result = await db.query(
    `SELECT id, email, first_name, last_name, account_status,
            graceful_exit_id, stripe_customer_id
     FROM users
     WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    accountStatus: row.account_status,
    gracefulExitId: row.graceful_exit_id,
    stripeCustomerId: row.stripe_customer_id,
  };
}

/**
 * Get all active Stripe subscription IDs for a user
 */
async function getActiveSubscriptionIds(db: Pool, userId: string): Promise<string[]> {
  const result = await db.query(
    `SELECT stripe_subscription_id
     FROM user_products
     WHERE user_id = $1
       AND stripe_subscription_id IS NOT NULL
       AND status IN ('trialing', 'active', 'past_due')`,
    [userId]
  );

  return result.rows
    .map(row => row.stripe_subscription_id)
    .filter((id): id is string => id !== null);
}

/**
 * Process the DELETE bucket - null out PII fields
 */
async function processDeleteBucket(
  trx: PoolClient,
  userId: string,
  unusablePasswordHash: string
): Promise<void> {
  // Hard delete password_reset_tokens (entire rows)
  await trx.query(
    'DELETE FROM password_reset_tokens WHERE user_id = $1',
    [userId]
  );

  // Null PII in email_tracking_events
  await trx.query(
    'UPDATE email_tracking_events SET recipient_email = NULL WHERE user_id = $1',
    [userId]
  );

  // Null PII in email_suppressions
  await trx.query(
    'UPDATE email_suppressions SET email = NULL WHERE user_id = $1',
    [userId]
  );

  // Null PII in user_activity_log
  await trx.query(
    'UPDATE user_activity_log SET ip_address = NULL, user_agent = NULL WHERE user_id = $1',
    [userId]
  );

  // Null PII in lifetime_code_redemptions
  await trx.query(
    'UPDATE lifetime_code_redemptions SET ip_address = NULL, user_agent = NULL WHERE user_id = $1',
    [userId]
  );

  // Note: users table PII is handled in processAnonymizeBucket
}

/**
 * Process the ANONYMIZE bucket - update users table with anonymous data
 */
async function processAnonymizeBucket(
  trx: PoolClient,
  userId: string,
  gracefulExitId: string,
  emailHash: string,
  unusablePasswordHash: string,
  options: DeletionOptions
): Promise<void> {
  await trx.query(
    `UPDATE users SET
      email = NULL,
      password_hash = $2,
      first_name = NULL,
      last_name = NULL,
      company_name = NULL,
      support_key = $3,
      account_status = 'deleted',
      deleted_at = NOW(),
      deletion_reason = $4,
      deletion_requested_by = $5,
      deletion_admin_id = $6,
      graceful_exit_id = $3,
      email_hash = $7,
      needs_attention = false,
      needs_attention_reason = NULL,
      updated_at = NOW()
    WHERE id = $1`,
    [
      userId,
      unusablePasswordHash,
      gracefulExitId,
      options.reason || null,
      options.requestedBy,
      options.adminId || null,
      emailHash,
    ]
  );

  // Update user_products to cancelled status
  await trx.query(
    `UPDATE user_products
     SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
     WHERE user_id = $1 AND status IN ('trialing', 'active', 'paused')`,
    [userId]
  );
}

/**
 * Create compliance audit log entry
 * PII is allowed in admin_audit_log for compliance purposes
 */
async function createAuditLogEntry(
  trx: PoolClient,
  userId: string,
  userEmail: string,
  gracefulExitId: string,
  options: DeletionOptions
): Promise<void> {
  await trx.query(
    `INSERT INTO admin_audit_log
      (admin_user_id, action, resource_type, resource_id, old_values, new_values, ip_address)
     VALUES ($1, 'user_anonymized', 'user', $2, $3, $4, $5)`,
    [
      options.adminId || null,
      userId,
      JSON.stringify({
        email: userEmail, // PII retained for compliance
        fieldsNulled: ['email', 'password_hash', 'first_name', 'last_name', 'company_name'],
        requestedBy: options.requestedBy,
      }),
      JSON.stringify({
        gracefulExitId,
        deletedAt: new Date().toISOString(),
      }),
      options.ipAddress || null,
    ]
  );
}

/**
 * Send deletion confirmation email (fire-and-forget)
 * Called AFTER transaction commits, using captured email
 */
async function sendDeletionEmail(
  userEmail: string,
  userName: string | null,
  gracefulExitId: string,
  ipAddress?: string
): Promise<void> {
  try {
    await sendAccountDeletedEmail(userEmail, userName || undefined);
    metrics.increment('deletion_email_sent');
    console.log(`[Anonymization] Deletion email sent to ${gracefulExitId}`);
  } catch (error) {
    // Log error but don't fail - deletion already complete
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Anonymization] Failed to send deletion email:`, errorMessage);
    metrics.increment('deletion_email_failed', { reason: errorMessage });
  }
}

// =============================================================================
// MAIN DELETION FUNCTION
// =============================================================================

/**
 * Process user deletion via soft delete with anonymization
 *
 * This is the SINGLE entry point for all user deletions.
 * Both user-initiated and admin-initiated deletions call this function.
 *
 * @param db - Database pool
 * @param userId - User ID to delete
 * @param options - Deletion options
 * @returns DeletionResult
 */
export async function processUserDeletion(
  db: Pool,
  userId: string,
  options: DeletionOptions
): Promise<DeletionResult> {
  const startTime = Date.now();
  metrics.increment('user_deletion_started', { requestedBy: options.requestedBy });

  try {
    // 1. Check feature flag
    const deletionMode = getDeletionMode();
    if (deletionMode === 'block_deletions') {
      metrics.increment('user_deletion_blocked', { reason: 'feature_flag' });
      return {
        status: 'blocked',
        gracefulExitId: null,
        message: 'Account deletions are temporarily disabled. Please try again later.',
      };
    }

    // 2. Get user and check if already deleted (idempotency)
    const user = await getUser(db, userId);
    if (!user) {
      metrics.increment('user_deletion_failed', { reason: 'user_not_found' });
      return {
        status: 'blocked',
        gracefulExitId: null,
        message: 'User not found.',
      };
    }

    if (user.accountStatus === 'deleted') {
      // Idempotent: already deleted, return success
      metrics.increment('user_deletion_idempotent');
      return {
        status: 'already_deleted',
        gracefulExitId: user.gracefulExitId,
      };
    }

    // 3. Rate limiting check (only for new deletions, not idempotent retries)
    if (isRateLimited(userId, options.requestedBy, options.adminId)) {
      metrics.increment('user_deletion_rate_limited');
      return {
        status: 'blocked',
        gracefulExitId: null,
        message: 'Too many deletion requests. Please try again later.',
      };
    }

    // 4. CAPTURE EMAIL BEFORE TRANSACTION (needed for email after commit)
    const userEmail = user.email;
    const userName = user.firstName;

    if (!userEmail) {
      metrics.increment('user_deletion_failed', { reason: 'no_email' });
      return {
        status: 'blocked',
        gracefulExitId: null,
        message: 'User has no email address.',
      };
    }

    const emailHash = hashEmail(userEmail);

    // 5. Cancel Stripe subscriptions BEFORE transaction (external, not transactional)
    const subscriptionIds = await getActiveSubscriptionIds(db, userId);
    if (subscriptionIds.length > 0) {
      console.log(`[Anonymization] Cancelling ${subscriptionIds.length} Stripe subscriptions for user ${userId}`);
      const stripeStartTime = Date.now();

      const { cancelled, errors } = await cancelAllUserSubscriptions(subscriptionIds);

      metrics.histogram('stripe_cancellation_duration_ms', Date.now() - stripeStartTime);
      metrics.increment('stripe_subscriptions_cancelled', { count: String(cancelled) });

      if (errors.length > 0) {
        console.error('[Anonymization] Stripe cancellation errors:', errors);
        metrics.increment('stripe_cancellation_errors', { count: String(errors.length) });
        // Continue with deletion even if some subscriptions failed to cancel
        // Manual cleanup may be needed
      }

      console.log(`[Anonymization] Cancelled ${cancelled}/${subscriptionIds.length} subscriptions`);
    }

    // 6. Generate GracefulExit ID
    const gracefulExitId = generateGracefulExitId();

    // 7. Generate unusable password hash
    const unusablePasswordHash = await generateUnusablePasswordHash();

    // 8. BEGIN DATABASE TRANSACTION
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // 9. Process DELETE bucket
      await processDeleteBucket(client, userId, unusablePasswordHash);

      // 10. Process ANONYMIZE bucket
      await processAnonymizeBucket(
        client,
        userId,
        gracefulExitId,
        emailHash,
        unusablePasswordHash,
        options
      );

      // 11. Create compliance audit log entry (PII allowed here)
      await createAuditLogEntry(client, userId, userEmail, gracefulExitId, options);

      // 12. COMMIT TRANSACTION
      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // 13. Send deletion confirmation email AFTER commit (using captured email)
    // Fire-and-forget with async handling, does not block or fail deletion
    sendDeletionEmail(userEmail, userName, gracefulExitId, options.ipAddress);

    // 14. Emit success metrics
    const duration = Date.now() - startTime;
    metrics.histogram('user_deletion_duration_ms', duration);
    metrics.increment('user_deletion_completed', { requestedBy: options.requestedBy });

    console.log(`[Anonymization] User ${userId} deleted successfully as ${gracefulExitId} in ${duration}ms`);

    return {
      status: 'deleted',
      gracefulExitId,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Anonymization] Error processing deletion for user ${userId}:`, error);
    metrics.increment('user_deletion_failed', { reason: errorMessage });

    throw error;
  }
}

// =============================================================================
// ADMIN UTILITIES
// =============================================================================

/**
 * Check if an email hash matches any deleted user (for fraud detection)
 * Admin-only function
 */
export async function checkEmailHashMatch(
  db: Pool,
  email: string
): Promise<{ matched: boolean; gracefulExitId: string | null; deletedAt: Date | null }> {
  const emailHash = hashEmail(email);

  const result = await db.query(
    `SELECT graceful_exit_id, deleted_at
     FROM users
     WHERE email_hash = $1 AND account_status = 'deleted'
     ORDER BY deleted_at DESC
     LIMIT 1`,
    [emailHash]
  );

  if (result.rows.length === 0) {
    return { matched: false, gracefulExitId: null, deletedAt: null };
  }

  return {
    matched: true,
    gracefulExitId: result.rows[0].graceful_exit_id,
    deletedAt: result.rows[0].deleted_at,
  };
}

/**
 * Get deletion statistics for monitoring
 */
export async function getDeletionStats(
  db: Pool,
  since?: Date
): Promise<{
  totalDeleted: number;
  byRequestor: { user: number; admin: number };
  recentDeletions: Array<{ gracefulExitId: string; deletedAt: Date; requestedBy: string }>;
}> {
  const sinceDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days

  const totalResult = await db.query(
    `SELECT COUNT(*) as count FROM users WHERE account_status = 'deleted' AND deleted_at >= $1`,
    [sinceDate]
  );

  const byRequestorResult = await db.query(
    `SELECT deletion_requested_by, COUNT(*) as count
     FROM users
     WHERE account_status = 'deleted' AND deleted_at >= $1
     GROUP BY deletion_requested_by`,
    [sinceDate]
  );

  const recentResult = await db.query(
    `SELECT graceful_exit_id, deleted_at, deletion_requested_by
     FROM users
     WHERE account_status = 'deleted' AND deleted_at >= $1
     ORDER BY deleted_at DESC
     LIMIT 10`,
    [sinceDate]
  );

  const byRequestor = { user: 0, admin: 0 };
  for (const row of byRequestorResult.rows) {
    if (row.deletion_requested_by === 'user') {
      byRequestor.user = parseInt(row.count);
    } else if (row.deletion_requested_by === 'admin') {
      byRequestor.admin = parseInt(row.count);
    }
  }

  return {
    totalDeleted: parseInt(totalResult.rows[0]?.count || '0'),
    byRequestor,
    recentDeletions: recentResult.rows.map(row => ({
      gracefulExitId: row.graceful_exit_id,
      deletedAt: row.deleted_at,
      requestedBy: row.deletion_requested_by,
    })),
  };
}
