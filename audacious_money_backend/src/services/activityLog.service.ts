/**
 * Activity Log Service
 *
 * Tracks user activities for admin diagnostics and support.
 * Activities are categorized by type and include metadata for context.
 */

import { Pool } from 'pg';

// =============================================================================
// TYPES
// =============================================================================

export type ActivityType = 'login' | 'page_view' | 'action' | 'system' | 'email' | 'payment' | 'charity';

export interface LogActivityOptions {
  userId: string;
  activityType: ActivityType;
  activityName: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ActivityLogEntry {
  id: string;
  userId: string;
  activityType: ActivityType;
  activityName: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface ActivityHistoryOptions {
  page?: number;
  pageSize?: number;
  activityType?: ActivityType;
  startDate?: string;
  endDate?: string;
}

export interface ActivityHistoryResponse {
  activities: ActivityLogEntry[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// =============================================================================
// ACTIVITY LOGGING
// =============================================================================

/**
 * Log a user activity
 */
export async function logActivity(
  db: Pool,
  options: LogActivityOptions
): Promise<string | null> {
  try {
    const result = await db.query(`
      INSERT INTO user_activity_log (
        user_id, activity_type, activity_name, metadata, ip_address, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      options.userId,
      options.activityType,
      options.activityName,
      JSON.stringify(options.metadata || {}),
      options.ipAddress || null,
      options.userAgent || null,
    ]);

    return result.rows[0]?.id || null;
  } catch (error) {
    console.error('[ActivityLog] Error logging activity:', error);
    return null;
  }
}

/**
 * Log a login activity
 */
export async function logLogin(
  db: Pool,
  userId: string,
  ipAddress?: string,
  userAgent?: string,
  method?: string
): Promise<string | null> {
  return logActivity(db, {
    userId,
    activityType: 'login',
    activityName: 'Logged in',
    metadata: { method: method || 'password' },
    ipAddress,
    userAgent,
  });
}

/**
 * Log a logout activity
 */
export async function logLogout(
  db: Pool,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string | null> {
  return logActivity(db, {
    userId,
    activityType: 'login',
    activityName: 'Logged out',
    ipAddress,
    userAgent,
  });
}

/**
 * Log a page view activity
 */
export async function logPageView(
  db: Pool,
  userId: string,
  pageName: string,
  pageUrl?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string | null> {
  return logActivity(db, {
    userId,
    activityType: 'page_view',
    activityName: `Viewed ${pageName}`,
    metadata: { pageUrl },
    ipAddress,
    userAgent,
  });
}

/**
 * Log a user action (worksheet completion, data export, etc.)
 */
export async function logUserAction(
  db: Pool,
  userId: string,
  actionName: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<string | null> {
  return logActivity(db, {
    userId,
    activityType: 'action',
    activityName: actionName,
    metadata,
    ipAddress,
    userAgent,
  });
}

/**
 * Log a system event (trial started, account status change, etc.)
 */
export async function logSystemEvent(
  db: Pool,
  userId: string,
  eventName: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  return logActivity(db, {
    userId,
    activityType: 'system',
    activityName: eventName,
    metadata,
  });
}

/**
 * Log an email event (sent, opened, clicked, etc.)
 */
export async function logEmailEvent(
  db: Pool,
  userId: string,
  emailType: string,
  eventType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced',
  metadata?: Record<string, unknown>
): Promise<string | null> {
  const eventNames: Record<string, string> = {
    sent: `${emailType} email sent`,
    delivered: `${emailType} email delivered`,
    opened: `${emailType} email opened`,
    clicked: `${emailType} email clicked`,
    bounced: `${emailType} email bounced`,
  };

  return logActivity(db, {
    userId,
    activityType: 'email',
    activityName: eventNames[eventType] || `${emailType} email ${eventType}`,
    metadata: { emailType, eventType, ...metadata },
  });
}

/**
 * Log a payment event
 */
export async function logPaymentEvent(
  db: Pool,
  userId: string,
  eventType: 'success' | 'failed' | 'refunded',
  amount?: number,
  productName?: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  const eventNames: Record<string, string> = {
    success: 'Payment processed',
    failed: 'Payment failed',
    refunded: 'Payment refunded',
  };

  return logActivity(db, {
    userId,
    activityType: 'payment',
    activityName: eventNames[eventType],
    metadata: { eventType, amount, productName, ...metadata },
  });
}

// =============================================================================
// ACTIVITY RETRIEVAL
// =============================================================================

/**
 * Get activity history for a user
 */
export async function getUserActivityHistory(
  db: Pool,
  userId: string,
  options: ActivityHistoryOptions = {}
): Promise<ActivityHistoryResponse> {
  const page = options.page || 1;
  const pageSize = options.pageSize || 50;
  const offset = (page - 1) * pageSize;

  // Collect all activities from multiple sources
  const allActivities: ActivityLogEntry[] = [];

  // 1. Try to get activities from user_activity_log table (may not exist or be empty)
  try {
    // Build WHERE clause
    let whereClause = 'WHERE user_id = $1';
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (options.activityType && options.activityType !== 'system' && options.activityType !== 'email') {
      whereClause += ` AND activity_type = $${paramIndex}`;
      params.push(options.activityType);
      paramIndex++;
    }

    if (options.startDate) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }

    if (options.endDate) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    const activitiesResult = await db.query(`
      SELECT
        id, user_id, activity_type, activity_name,
        metadata, ip_address, user_agent, created_at
      FROM user_activity_log
      ${whereClause}
      ORDER BY created_at DESC
    `, params);

    allActivities.push(...activitiesResult.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      activityType: row.activity_type as ActivityType,
      activityName: row.activity_name,
      metadata: row.metadata || {},
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    })));
  } catch (err) {
    // Table might not exist - continue with other sources
    console.warn('[ActivityLog] user_activity_log query failed, continuing with other sources:', err);
  }

  // 2. Get user signup and last login from users table (system events)
  if (!options.activityType || options.activityType === 'system' || options.activityType === 'login') {
    try {
      const userResult = await db.query(`
        SELECT id, created_at, last_login_at
        FROM users
        WHERE id = $1
      `, [userId]);

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];

        // Add signup event (system type)
        if (!options.activityType || options.activityType === 'system') {
          allActivities.push({
            id: `signup-${user.id}`,
            userId: user.id,
            activityType: 'system',
            activityName: 'Account created',
            metadata: {},
            ipAddress: null,
            userAgent: null,
            createdAt: user.created_at,
          });
        }

        // Add last login event (if exists and different from signup)
        if (user.last_login_at && (!options.activityType || options.activityType === 'login')) {
          const loginTime = new Date(user.last_login_at).getTime();
          const signupTime = new Date(user.created_at).getTime();
          if (loginTime !== signupTime) {
            allActivities.push({
              id: `login-${user.id}-${loginTime}`,
              userId: user.id,
              activityType: 'login',
              activityName: 'Last login',
              metadata: { note: 'Most recent login on record' },
              ipAddress: null,
              userAgent: null,
              createdAt: user.last_login_at,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[ActivityLog] users query failed:', err);
    }
  }

  // 3. Get email events from sent_emails and scheduled_emails
  if (!options.activityType || options.activityType === 'email') {
    try {
      const emailResult = await db.query(`
        SELECT
          id, email_type, subject, sent_at, delivery_status
        FROM sent_emails
        WHERE user_id = $1 AND sent_at IS NOT NULL
        ORDER BY sent_at DESC
        LIMIT 20
      `, [userId]);

      allActivities.push(...emailResult.rows.map(row => ({
        id: `email-${row.id}`,
        userId: userId,
        activityType: 'email' as ActivityType,
        activityName: `Email sent: ${row.subject || row.email_type}`,
        metadata: {
          emailType: row.email_type,
          deliveryStatus: row.delivery_status,
        },
        ipAddress: null,
        userAgent: null,
        createdAt: row.sent_at,
      })));

      // Also get scheduled emails that were sent
      const scheduledResult = await db.query(`
        SELECT
          id, email_type, custom_subject, sent_at
        FROM scheduled_emails
        WHERE user_id = $1 AND status = 'sent' AND sent_at IS NOT NULL
        ORDER BY sent_at DESC
        LIMIT 20
      `, [userId]);

      allActivities.push(...scheduledResult.rows.map(row => ({
        id: `scheduled-email-${row.id}`,
        userId: userId,
        activityType: 'email' as ActivityType,
        activityName: `Workshop email: ${row.custom_subject || row.email_type}`,
        metadata: { emailType: row.email_type },
        ipAddress: null,
        userAgent: null,
        createdAt: row.sent_at,
      })));
    } catch (err) {
      console.warn('[ActivityLog] email query failed:', err);
    }
  }

  // 4. Get payment events from payments/subscriptions (if not filtered to other types)
  if (!options.activityType || options.activityType === 'payment') {
    try {
      // Get subscription with charity info
      const paymentResult = await db.query(`
        SELECT
          up.id, up.status, up.activated_at, up.trial_ends_at, up.trial_converted,
          up.current_period_end, up.stripe_subscription_id,
          p.name as product_name, p.slug as product_slug, p.price_monthly,
          c.name as charity_name
        FROM user_products up
        LEFT JOIN products p ON up.product_id = p.id
        LEFT JOIN user_charity_selections ucs ON ucs.user_id = up.user_id
          AND ucs.effective_until IS NULL
        LEFT JOIN charities c ON ucs.charity_id = c.id
        WHERE up.user_id = $1 AND up.activated_at IS NOT NULL
        ORDER BY up.activated_at DESC
      `, [userId]);

      allActivities.push(...paymentResult.rows.map(row => ({
        id: `subscription-${row.id}`,
        userId: userId,
        activityType: 'payment' as ActivityType,
        activityName: `Subscription activated: ${row.product_name || row.product_slug || 'Unknown product'}`,
        metadata: {
          status: row.status,
          trialEndsAt: row.trial_ends_at,
          trialConverted: row.trial_converted,
          currentPeriodEnd: row.current_period_end,
          priceMonthly: row.price_monthly,
          hasStripeSubscription: !!row.stripe_subscription_id,
          charityName: row.charity_name,
        },
        ipAddress: null,
        userAgent: null,
        createdAt: row.activated_at,
      })));
    } catch (err) {
      console.warn('[ActivityLog] payment query failed:', err);
    }
  }

  // 5. Get charity selection events
  if (!options.activityType || options.activityType === 'charity') {
    try {
      const charityResult = await db.query(`
        SELECT
          ucs.id, ucs.selected_at, ucs.effective_from, ucs.effective_until,
          c.name as charity_name, c.category
        FROM user_charity_selections ucs
        JOIN charities c ON ucs.charity_id = c.id
        WHERE ucs.user_id = $1
        ORDER BY ucs.selected_at DESC
      `, [userId]);

      allActivities.push(...charityResult.rows.map((row, index) => ({
        id: `charity-${row.id}`,
        userId: userId,
        activityType: 'charity' as ActivityType,
        activityName: index === 0 && !row.effective_until
          ? `Current charity: ${row.charity_name}`
          : row.effective_until
            ? `Changed from ${row.charity_name}`
            : `Selected ${row.charity_name}`,
        metadata: {
          charityName: row.charity_name,
          category: row.category,
          effectiveFrom: row.effective_from,
          effectiveUntil: row.effective_until,
          isCurrent: !row.effective_until,
        },
        ipAddress: null,
        userAgent: null,
        createdAt: row.selected_at,
      })));
    } catch (err) {
      console.warn('[ActivityLog] charity query failed:', err);
    }
  }

  // Deduplicate by id and sort by date (newest first)
  const seenIds = new Set<string>();
  const uniqueActivities = allActivities.filter(a => {
    if (seenIds.has(a.id)) return false;
    seenIds.add(a.id);
    return true;
  }).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Apply date filters if specified
  let filteredActivities = uniqueActivities;
  if (options.startDate) {
    const startTime = new Date(options.startDate).getTime();
    filteredActivities = filteredActivities.filter(a =>
      new Date(a.createdAt).getTime() >= startTime
    );
  }
  if (options.endDate) {
    const endTime = new Date(options.endDate).getTime();
    filteredActivities = filteredActivities.filter(a =>
      new Date(a.createdAt).getTime() <= endTime
    );
  }

  // Apply pagination
  const total = filteredActivities.length;
  const paginatedActivities = filteredActivities.slice(offset, offset + pageSize);

  return {
    activities: paginatedActivities,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Get recent activity summary for a user (for overview display)
 */
export async function getRecentActivitySummary(
  db: Pool,
  userId: string,
  limit: number = 10
): Promise<ActivityLogEntry[]> {
  const result = await db.query(`
    SELECT
      id, user_id, activity_type, activity_name,
      metadata, ip_address, user_agent, created_at
    FROM user_activity_log
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [userId, limit]);

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    activityType: row.activity_type,
    activityName: row.activity_name,
    metadata: row.metadata || {},
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  }));
}

/**
 * Get activity statistics for a user
 */
export async function getActivityStats(
  db: Pool,
  userId: string
): Promise<{
  totalActivities: number;
  lastActivityAt: string | null;
  loginCount: number;
  lastLoginAt: string | null;
  activityByType: Record<string, number>;
}> {
  const activityByType: Record<string, number> = {
    login: 0,
    system: 0,
    email: 0,
    payment: 0,
    charity: 0,
  };
  let totalActivities = 0;
  let lastActivityAt: string | null = null;
  let loginCount = 0;
  let lastLoginAt: string | null = null;

  // Try to get stats from user_activity_log (may not exist)
  try {
    const [totalResult, lastActivityResult, loginResult, byTypeResult] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM user_activity_log WHERE user_id = $1`, [userId]),
      db.query(`
        SELECT created_at FROM user_activity_log
        WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
      `, [userId]),
      db.query(`
        SELECT COUNT(*) as count, MAX(created_at) as last_login
        FROM user_activity_log
        WHERE user_id = $1 AND activity_type = 'login'
      `, [userId]),
      db.query(`
        SELECT activity_type, COUNT(*) as count
        FROM user_activity_log
        WHERE user_id = $1
        GROUP BY activity_type
      `, [userId]),
    ]);

    totalActivities = parseInt(totalResult.rows[0]?.count || '0');
    lastActivityAt = lastActivityResult.rows[0]?.created_at || null;
    loginCount = parseInt(loginResult.rows[0]?.count || '0');
    lastLoginAt = loginResult.rows[0]?.last_login || null;

    byTypeResult.rows.forEach(row => {
      activityByType[row.activity_type] = parseInt(row.count);
    });
  } catch (err) {
    console.warn('[ActivityLog] user_activity_log stats query failed, using fallback:', err);
  }

  // Always get additional stats from other tables
  try {
    // Get user signup and last login from users table
    const userResult = await db.query(`
      SELECT created_at, last_login_at FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];

      // Add 1 for the account creation (system event)
      activityByType.system = (activityByType.system || 0) + 1;
      totalActivities += 1;

      // Update last activity if user created_at is more recent
      if (!lastActivityAt || new Date(user.created_at) > new Date(lastActivityAt)) {
        lastActivityAt = user.created_at;
      }

      // If we have a last_login_at that's not tracked in activity log
      if (user.last_login_at && loginCount === 0) {
        loginCount = 1;
        lastLoginAt = user.last_login_at;
        activityByType.login = 1;
        totalActivities += 1;

        // Update last activity if login is more recent
        if (new Date(user.last_login_at) > new Date(lastActivityAt)) {
          lastActivityAt = user.last_login_at;
        }
      }
    }

    // Get email count
    const emailCountResult = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM sent_emails WHERE user_id = $1 AND sent_at IS NOT NULL) +
        (SELECT COUNT(*) FROM scheduled_emails WHERE user_id = $1 AND status = 'sent') as total
    `, [userId]);
    const emailCount = parseInt(emailCountResult.rows[0]?.total || '0');
    activityByType.email = (activityByType.email || 0) + emailCount;
    totalActivities += emailCount;

    // Get subscription count
    const subCountResult = await db.query(`
      SELECT COUNT(*) FROM user_products
      WHERE user_id = $1 AND activated_at IS NOT NULL
    `, [userId]);
    const subCount = parseInt(subCountResult.rows[0]?.count || '0');
    activityByType.payment = (activityByType.payment || 0) + subCount;
    totalActivities += subCount;

    // Get charity selection count
    const charityCountResult = await db.query(`
      SELECT COUNT(*) FROM user_charity_selections
      WHERE user_id = $1
    `, [userId]);
    const charityCount = parseInt(charityCountResult.rows[0]?.count || '0');
    activityByType.charity = (activityByType.charity || 0) + charityCount;
    totalActivities += charityCount;
  } catch (err) {
    console.warn('[ActivityLog] fallback stats query failed:', err);
  }

  return {
    totalActivities,
    lastActivityAt,
    loginCount,
    lastLoginAt,
    activityByType,
  };
}
