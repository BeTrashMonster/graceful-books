/**
 * Security Logger Usage Examples
 *
 * This file demonstrates how to use the security event logging system.
 * These are code examples, not executable tests.
 */

import {
  logFailedLogin,
  logAuthorizationFailure,
  logRateLimitExceeded,
  logSuspiciousActivity,
  logAccountLockout,
  querySecurityEvents,
  getSecurityEventStats,
  SecurityEventType,
} from './securityLogger'
import type { TreasureChestDB } from '../db/database'

/**
 * Example 1: Log a failed login attempt
 */
export async function exampleFailedLogin(db: TreasureChestDB) {
  await logFailedLogin(
    {
      email: 'user@example.com',
      reason: 'invalid_credentials',
      attemptCount: 3,
    },
    db
  )
}

/**
 * Example 2: Log an authorization failure (IDOR attempt)
 * This should be called when a user tries to access a resource they don't own
 */
export async function exampleAuthorizationFailure(
  userId: string,
  companyId: string,
  resourceId: string,
  db: TreasureChestDB
) {
  await logAuthorizationFailure(
    userId,
    companyId,
    {
      resourceType: 'account',
      resourceId,
      requestedAction: 'read',
      reason: 'forbidden',
      companyIdMismatch: {
        requested: companyId,
        actual: 'different-company-id',
      },
    },
    db
  )
}

/**
 * Example 3: Log rate limit exceeded
 */
export async function exampleRateLimitExceeded(db: TreasureChestDB) {
  await logRateLimitExceeded(
    {
      endpoint: '/api/accounts',
      limit: 100,
      windowSeconds: 60,
      attemptCount: 150,
    },
    db
  )
}

/**
 * Example 4: Log suspicious activity
 */
export async function exampleSuspiciousActivity(
  userId: string,
  companyId: string,
  db: TreasureChestDB
) {
  await logSuspiciousActivity(
    userId,
    companyId,
    {
      activityType: 'rapid_resource_enumeration',
      description: 'User accessing many sequential account IDs rapidly',
      severity: 'high',
      indicators: [
        'high_request_rate',
        'sequential_ids',
        'many_404s',
        'automated_pattern',
      ],
    },
    db
  )
}

/**
 * Example 5: Log account lockout
 */
export async function exampleAccountLockout(userId: string, db: TreasureChestDB) {
  const lockoutDuration = 3600 // 1 hour in seconds
  const unlockAt = Date.now() + lockoutDuration * 1000

  await logAccountLockout(
    {
      userId,
      reason: 'max_failed_attempts',
      duration: lockoutDuration,
      unlockAt,
    },
    db
  )
}

/**
 * Example 6: Query security events
 */
export async function exampleQuerySecurityEvents(
  companyId: string,
  db: TreasureChestDB
) {
  // Get all failed login attempts in the last 24 hours
  const failedLogins = await querySecurityEvents(companyId, db, {
    eventType: SecurityEventType.FAILED_LOGIN,
    dateFrom: Date.now() - 24 * 60 * 60 * 1000,
    limit: 100,
  })

  // Get all authorization failures for a specific user
  const authFailures = await querySecurityEvents(companyId, db, {
    eventType: SecurityEventType.AUTHORIZATION_FAILURE,
    userId: 'specific-user-id',
    dateFrom: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
  })

  return { failedLogins, authFailures }
}

/**
 * Example 7: Get security statistics
 */
export async function exampleGetSecurityStats(
  companyId: string,
  db: TreasureChestDB
) {
  // Get stats for the last 24 hours
  const dailyStats = await getSecurityEventStats(
    companyId,
    db,
    24 * 60 * 60 * 1000
  )

  // Get stats for the last 7 days
  const weeklyStats = await getSecurityEventStats(
    companyId,
    db,
    7 * 24 * 60 * 60 * 1000
  )

  // Check for concerning patterns
  if (dailyStats.authorizationFailures > 10) {
    console.warn('High number of authorization failures detected!')
  }

  if (dailyStats.failedLogins > 20) {
    console.warn('Potential brute force attack detected!')
  }

  return { dailyStats, weeklyStats }
}

/**
 * Example 8: Integration with authentication flow
 */
export async function exampleLoginWithSecurityLogging(
  email: string,
  _password: string,
  db: TreasureChestDB
) {
  // Simulated authentication logic
  const user = { id: 'user-123', email, passwordHash: 'hash' }
  const isValidPassword = false // Simulated failed check

  if (!isValidPassword) {
    // Log failed login
    await logFailedLogin(
      {
        email,
        reason: 'invalid_credentials',
        attemptCount: 3,
      },
      db
    )

    // Check if we should lock the account
    const failedAttempts = 5 // Get from database
    if (failedAttempts >= 5) {
      await logAccountLockout(
        {
          userId: user.id,
          reason: 'max_failed_attempts',
          duration: 3600,
          unlockAt: Date.now() + 3600000,
        },
        db
      )
    }

    return { success: false, error: 'Invalid credentials' }
  }

  return { success: true, user }
}

/**
 * Example 9: Integration with authorization checks
 */
export async function exampleResourceAccessWithLogging(
  userId: string,
  companyId: string,
  accountId: string,
  db: TreasureChestDB
) {
  // Get the account
  const account = await db.accounts.get(accountId)

  if (!account) {
    // Log authorization failure - resource not found
    await logAuthorizationFailure(
      userId,
      companyId,
      {
        resourceType: 'account',
        resourceId: accountId,
        requestedAction: 'read',
        reason: 'not_found',
      },
      db
    )

    return { success: false, error: 'Account not found' }
  }

  // Check if account belongs to the user's company
  if (account.companyId !== companyId) {
    // Log authorization failure - IDOR attempt
    await logAuthorizationFailure(
      userId,
      companyId,
      {
        resourceType: 'account',
        resourceId: accountId,
        requestedAction: 'read',
        reason: 'forbidden',
        companyIdMismatch: {
          requested: companyId,
          actual: account.companyId,
        },
      },
      db
    )

    // Return NOT_FOUND to avoid information leakage
    return { success: false, error: 'Account not found' }
  }

  return { success: true, account }
}

/**
 * Example 10: Security dashboard data
 */
export async function exampleSecurityDashboard(
  companyId: string,
  db: TreasureChestDB
) {
  // Get statistics for different time periods
  const last24Hours = await getSecurityEventStats(
    companyId,
    db,
    24 * 60 * 60 * 1000
  )

  const last7Days = await getSecurityEventStats(
    companyId,
    db,
    7 * 24 * 60 * 60 * 1000
  )

  // Get recent critical events
  const recentCritical = await querySecurityEvents(companyId, db, {
    dateFrom: Date.now() - 24 * 60 * 60 * 1000,
    limit: 10,
  })

  // Build dashboard data
  return {
    summary: {
      last24Hours: {
        total: last24Hours.totalEvents,
        failedLogins: last24Hours.failedLogins,
        authFailures: last24Hours.authorizationFailures,
        rateLimits: last24Hours.rateLimitExceeded,
        suspicious: last24Hours.suspiciousActivity,
        lockouts: last24Hours.accountLockouts,
      },
      last7Days: {
        total: last7Days.totalEvents,
        failedLogins: last7Days.failedLogins,
        authFailures: last7Days.authorizationFailures,
        rateLimits: last7Days.rateLimitExceeded,
        suspicious: last7Days.suspiciousActivity,
        lockouts: last7Days.accountLockouts,
      },
    },
    recentEvents: recentCritical,
    alerts: generateAlerts(last24Hours),
  }
}

/**
 * Helper: Generate alerts based on security stats
 */
function generateAlerts(stats: {
  failedLogins: number
  authorizationFailures: number
  rateLimitExceeded: number
  suspiciousActivity: number
  accountLockouts: number
}) {
  const alerts: Array<{ severity: string; message: string }> = []

  if (stats.failedLogins > 20) {
    alerts.push({
      severity: 'high',
      message: `High number of failed login attempts detected (${stats.failedLogins})`,
    })
  }

  if (stats.authorizationFailures > 10) {
    alerts.push({
      severity: 'high',
      message: `Potential IDOR attack detected (${stats.authorizationFailures} failures)`,
    })
  }

  if (stats.rateLimitExceeded > 0) {
    alerts.push({
      severity: 'medium',
      message: `Rate limit exceeded ${stats.rateLimitExceeded} times`,
    })
  }

  if (stats.suspiciousActivity > 0) {
    alerts.push({
      severity: 'critical',
      message: `${stats.suspiciousActivity} suspicious activity event(s) detected`,
    })
  }

  if (stats.accountLockouts > 5) {
    alerts.push({
      severity: 'medium',
      message: `${stats.accountLockouts} accounts have been locked out`,
    })
  }

  return alerts
}
