/**
 * Frozen State Middleware
 *
 * Checks if a user's account is in a "frozen" state and restricts write operations.
 * Frozen states occur when:
 * - Trial has expired without conversion
 * - Subscription was cancelled
 * - Payment failed repeatedly
 *
 * When frozen:
 * - Users can VIEW their data (GET requests)
 * - Users can REACTIVATE their account
 * - Users can UPDATE payment methods
 * - Users can DELETE their account
 * - Users CANNOT perform other write operations
 *
 * This middleware runs AFTER requireAuth, so userId is available in context.
 */

import { Context, Next } from 'hono';
import { toZonedTime } from 'date-fns-tz';
import { forbidden, ErrorCodes } from '../utils/responses.js';

/**
 * Default timezone - PST (Pacific Standard Time)
 */
const DEFAULT_TIMEZONE = 'America/Los_Angeles';

/**
 * Subscription statuses that indicate a frozen account
 */
const FROZEN_STATUSES = [
  'cancelled',
  'expired',
  'past_due',
  'payment_failed',
  'trialing_expired', // Trial ended without payment
];

/**
 * Routes that are ALWAYS allowed, even when frozen
 * These enable users to view data, reactivate, or manage their account
 */
const ALLOWED_ROUTES: Array<{ method: string; pattern: RegExp }> = [
  // All GET requests (viewing data is always allowed)
  { method: 'GET', pattern: /.*/ },

  // Reactivation flow
  { method: 'GET', pattern: /\/me\/reactivate/ },
  { method: 'POST', pattern: /\/me\/reactivate/ },

  // Payment method management (needed for reactivation)
  { method: 'POST', pattern: /\/me\/setup-intent/ },
  { method: 'PUT', pattern: /\/me\/payment-method/ },

  // Subscription resume (unfreezing)
  { method: 'POST', pattern: /\/me\/subscription\/resume/ },

  // Account deletion (users always have this right)
  { method: 'DELETE', pattern: /\/me$/ },
];

/**
 * Check if a route is allowed when account is frozen
 */
function isRouteAllowed(method: string, path: string): boolean {
  return ALLOWED_ROUTES.some(
    (route) => route.method === method && route.pattern.test(path)
  );
}

/**
 * Middleware to block write operations when account is frozen
 *
 * @example
 * // Apply to all user routes after auth
 * users.use('*', requireAuth);
 * users.use('*', requireNotFrozen);
 */
export async function requireNotFrozen(
  c: Context,
  next: Next
): Promise<Response | void> {
  const userId = c.get('userId');
  const db = c.get('db');
  const method = c.req.method;
  const path = c.req.path;

  // If route is always allowed, proceed
  if (isRouteAllowed(method, path)) {
    return next();
  }

  // Check user's subscription status
  try {
    const result = await db.query(
      `SELECT up.status, up.current_period_end, up.trial_ends_at
       FROM user_products up
       WHERE up.user_id = $1
       ORDER BY up.created_at DESC
       LIMIT 1`,
      [userId]
    );

    // If no subscription found, allow (new users)
    if (result.rows.length === 0) {
      return next();
    }

    const subscription = result.rows[0];
    const status = subscription.status;

    // Check if status indicates frozen state
    const isFrozen = FROZEN_STATUSES.includes(status);

    // Check if trial has expired
    // - current_period_end: Set by Stripe webhooks for paid subscriptions
    // - trial_ends_at: Set during workshop signup for workshop trials
    // We check BOTH because workshop trials use trial_ends_at, not current_period_end
    const now = new Date();
    const periodEnd = subscription.current_period_end;
    const trialEndsAt = subscription.trial_ends_at;

    const isPeriodExpired = periodEnd && new Date(periodEnd) < now;
    const isTrialDateExpired = trialEndsAt && new Date(trialEndsAt) < now;
    const isExpired = isPeriodExpired || isTrialDateExpired;
    const isTrialExpired = status === 'trialing' && isExpired;

    if (isFrozen || isTrialExpired) {
      // Log times in PST for clarity
      const nowPST = toZonedTime(now, DEFAULT_TIMEZONE);
      const expirationSource = isPeriodExpired
        ? `current_period_end: ${toZonedTime(new Date(periodEnd), DEFAULT_TIMEZONE).toISOString()}`
        : isTrialDateExpired
          ? `trial_ends_at: ${toZonedTime(new Date(trialEndsAt), DEFAULT_TIMEZONE).toISOString()}`
          : 'status';
      console.log(
        `[FrozenState] Blocked ${method} ${path} for user ${userId}`,
        `(status: ${status}, now_PST: ${nowPST.toISOString()}, source: ${expirationSource})`
      );

      return forbidden(
        c,
        ErrorCodes.FORBIDDEN,
        'Your account is currently frozen. Please reactivate your subscription to continue.',
        {
          frozen: true,
          reason: isTrialExpired ? 'trial_expired' : status,
          reactivateUrl: '/account/reactivate',
        }
      );
    }

    // Account is active, proceed
    return next();
  } catch (error) {
    console.error('[FrozenState] Error checking subscription status:', error);
    // On error, allow the request (fail open for better UX)
    // Backend validation will still catch unauthorized actions
    return next();
  }
}
