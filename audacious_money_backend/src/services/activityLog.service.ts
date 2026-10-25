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

export type ActivityType = 'login' | 'page_view' | 'action' | 'system' | 'email' | 'payment';

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

  // Build WHERE clause
  let whereClause = 'WHERE user_id = $1';
  const params: unknown[] = [userId];
  let paramIndex = 2;

  if (options.activityType) {
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

  // Get total count
  const countResult = await db.query(
    `SELECT COUNT(*) FROM user_activity_log ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Get activities with pagination
  const activitiesResult = await db.query(`
    SELECT
      id, user_id, activity_type, activity_name,
      metadata, ip_address, user_agent, created_at
    FROM user_activity_log
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `, [...params, pageSize, offset]);

  return {
    activities: activitiesResult.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      activityType: row.activity_type,
      activityName: row.activity_name,
      metadata: row.metadata || {},
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    })),
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
  const [totalResult, lastActivityResult, loginResult, byTypeResult] = await Promise.all([
    db.query(`SELECT COUNT(*) FROM user_activity_log WHERE user_id = $1`, [userId]),
    db.query(`
      SELECT created_at FROM user_activity_log
      WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
    `, [userId]),
    db.query(`
      SELECT COUNT(*) as count, MAX(created_at) as last_login
      FROM user_activity_log
      WHERE user_id = $1 AND activity_type = 'login' AND activity_name = 'Logged in'
    `, [userId]),
    db.query(`
      SELECT activity_type, COUNT(*) as count
      FROM user_activity_log
      WHERE user_id = $1
      GROUP BY activity_type
    `, [userId]),
  ]);

  const activityByType: Record<string, number> = {};
  byTypeResult.rows.forEach(row => {
    activityByType[row.activity_type] = parseInt(row.count);
  });

  return {
    totalActivities: parseInt(totalResult.rows[0].count),
    lastActivityAt: lastActivityResult.rows[0]?.created_at || null,
    loginCount: parseInt(loginResult.rows[0]?.count || '0'),
    lastLoginAt: loginResult.rows[0]?.last_login || null,
    activityByType,
  };
}
