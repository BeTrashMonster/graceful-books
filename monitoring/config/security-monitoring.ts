/**
 * Security Event Monitoring Integration
 *
 * Bridges security event logging (S5-2) with production monitoring infrastructure.
 * Provides real-time alerting for security events like failed logins, authorization
 * failures, and rate limit violations.
 *
 * Requirements:
 * - S5-2: Security Event Logging (completed)
 * - S5-8: Production Monitoring Setup
 *
 * @module monitoring/security
 */

import { createAlert, AlertRouter, defaultAlertRoutes } from '../alerts/alert-routing'
import type { AlertSeverity } from '../alerts/alert-routing'
import {
  SecurityEventType,
  getSecurityEventStats,
  querySecurityEvents,
  type SecurityEvent,
  type FailedLoginDetails,
  type AuthorizationFailureDetails,
  type RateLimitExceededDetails,
} from '../../src/utils/securityLogger'

/**
 * Security monitoring configuration
 */
export interface SecurityMonitoringConfig {
  // Alert thresholds
  thresholds: {
    // Failed login attempts per minute
    failedLoginsPerMinute: {
      warning: number
      critical: number
    }
    // Authorization failures per minute
    authFailuresPerMinute: {
      warning: number
      critical: number
    }
    // Rate limit violations per minute
    rateLimitViolationsPerMinute: {
      warning: number
      critical: number
    }
    // Consecutive failed logins from same IP
    consecutiveFailedLoginsPerIp: {
      warning: number
      critical: number
    }
    // Suspicious activity threshold
    suspiciousActivityScore: {
      warning: number
      critical: number
    }
  }

  // Monitoring intervals
  intervals: {
    // How often to check for security events (ms)
    checkInterval: number
    // Time window for counting events (ms)
    countWindow: number
  }

  // Alert routing
  routing: {
    // Slack webhook for security alerts
    slackWebhook?: string
    // PagerDuty for critical security events
    pagerDutyKey?: string
    // Email for security reports
    securityEmail?: string
  }
}

/**
 * Default security monitoring configuration
 */
export const defaultSecurityMonitoringConfig: SecurityMonitoringConfig = {
  thresholds: {
    failedLoginsPerMinute: {
      warning: 10, // 10 failed logins/minute = possible attack
      critical: 50, // 50 failed logins/minute = likely attack
    },
    authFailuresPerMinute: {
      warning: 20, // 20 auth failures/minute = possible enumeration
      critical: 100, // 100 auth failures/minute = active attack
    },
    rateLimitViolationsPerMinute: {
      warning: 10, // 10 rate limit hits/minute
      critical: 50, // 50 rate limit hits/minute
    },
    consecutiveFailedLoginsPerIp: {
      warning: 5, // 5 consecutive failures from same IP
      critical: 10, // 10 consecutive failures = brute force
    },
    suspiciousActivityScore: {
      warning: 50, // Medium suspicion level
      critical: 80, // High suspicion level
    },
  },
  intervals: {
    checkInterval: 60000, // Check every 60 seconds
    countWindow: 60000, // Count events in last 60 seconds
  },
  routing: {
    slackWebhook: process.env.SLACK_WEBHOOK_SECURITY,
    pagerDutyKey: process.env.PAGERDUTY_INTEGRATION_KEY,
    securityEmail: process.env.SECURITY_EMAIL || 'security@gracefulbooks.com',
  },
}

/**
 * Security Event Monitor
 *
 * Continuously monitors security events and triggers alerts when thresholds are exceeded.
 */
export class SecurityEventMonitor {
  private config: SecurityMonitoringConfig
  private router: AlertRouter
  private intervalId?: NodeJS.Timeout
  private lastEventCounts: Map<SecurityEventType, number>

  constructor(config: SecurityMonitoringConfig = defaultSecurityMonitoringConfig) {
    this.config = config
    this.router = new AlertRouter([
      ...defaultAlertRoutes,
      // Add security-specific routes
      {
        name: 'security-critical-alerts',
        channels: ['pagerduty', 'slack'],
        conditions: [
          { field: 'severity', operator: 'equals', value: 'critical' },
          { field: 'source', operator: 'contains', value: 'security' },
        ],
      },
      {
        name: 'security-high-alerts',
        channels: ['slack', 'email'],
        conditions: [
          { field: 'severity', operator: 'equals', value: 'high' },
          { field: 'source', operator: 'contains', value: 'security' },
        ],
      },
    ])
    this.lastEventCounts = new Map()
  }

  /**
   * Start monitoring security events
   */
  start(): void {
    if (this.intervalId) {
      console.warn('Security monitor already running')
      return
    }

    console.log('Starting security event monitor...')
    this.intervalId = setInterval(
      () => this.checkSecurityEvents(),
      this.config.intervals.checkInterval
    )

    // Run initial check
    this.checkSecurityEvents()
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
      console.log('Security event monitor stopped')
    }
  }

  /**
   * Check for security events and trigger alerts
   */
  private async checkSecurityEvents(): Promise<void> {
    try {
      // Note: This requires a database connection
      // In production, this would be called from a Worker or backend service
      // that has access to the audit log database

      // For now, this is a placeholder showing the structure
      console.log('Checking security events...')

      // In production, you would:
      // 1. Query security events from the last minute
      // 2. Calculate rates for each event type
      // 3. Compare against thresholds
      // 4. Trigger alerts if thresholds exceeded

      // Example:
      // const stats = await getSecurityEventStats(companyId, db, this.config.intervals.countWindow)
      // await this.checkFailedLoginThreshold(stats.failedLogins)
      // await this.checkAuthFailureThreshold(stats.authorizationFailures)
      // await this.checkRateLimitThreshold(stats.rateLimitExceeded)
    } catch (error) {
      console.error('Error checking security events:', error)
    }
  }

  /**
   * Check failed login threshold and alert if exceeded
   */
  private async checkFailedLoginThreshold(count: number): Promise<void> {
    const { warning, critical } = this.config.thresholds.failedLoginsPerMinute

    if (count >= critical) {
      await this.sendAlert(
        'Critical: High Failed Login Rate',
        `${count} failed login attempts in the last minute. Possible brute force attack.`,
        'critical',
        'security-failed-logins',
        { count, threshold: critical, eventType: 'FAILED_LOGIN' }
      )
    } else if (count >= warning) {
      await this.sendAlert(
        'Warning: Elevated Failed Login Rate',
        `${count} failed login attempts in the last minute.`,
        'high',
        'security-failed-logins',
        { count, threshold: warning, eventType: 'FAILED_LOGIN' }
      )
    }
  }

  /**
   * Check authorization failure threshold and alert if exceeded
   */
  private async checkAuthFailureThreshold(count: number): Promise<void> {
    const { warning, critical } = this.config.thresholds.authFailuresPerMinute

    if (count >= critical) {
      await this.sendAlert(
        'Critical: High Authorization Failure Rate',
        `${count} authorization failures in the last minute. Possible IDOR attack or enumeration attempt.`,
        'critical',
        'security-auth-failures',
        { count, threshold: critical, eventType: 'AUTHORIZATION_FAILURE' }
      )
    } else if (count >= warning) {
      await this.sendAlert(
        'Warning: Elevated Authorization Failure Rate',
        `${count} authorization failures in the last minute.`,
        'high',
        'security-auth-failures',
        { count, threshold: warning, eventType: 'AUTHORIZATION_FAILURE' }
      )
    }
  }

  /**
   * Check rate limit threshold and alert if exceeded
   */
  private async checkRateLimitThreshold(count: number): Promise<void> {
    const { warning, critical } = this.config.thresholds.rateLimitViolationsPerMinute

    if (count >= critical) {
      await this.sendAlert(
        'Critical: High Rate Limit Violation Rate',
        `${count} rate limit violations in the last minute. Possible DoS attack or scraping attempt.`,
        'critical',
        'security-rate-limits',
        { count, threshold: critical, eventType: 'RATE_LIMIT_EXCEEDED' }
      )
    } else if (count >= warning) {
      await this.sendAlert(
        'Warning: Elevated Rate Limit Violations',
        `${count} rate limit violations in the last minute.`,
        'medium',
        'security-rate-limits',
        { count, threshold: warning, eventType: 'RATE_LIMIT_EXCEEDED' }
      )
    }
  }

  /**
   * Send alert through routing system
   */
  private async sendAlert(
    title: string,
    message: string,
    severity: AlertSeverity,
    source: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const alert = createAlert(title, message, severity, source, metadata)
    await this.router.route(alert)
  }
}

/**
 * Security Metrics Collector
 *
 * Collects and aggregates security metrics for dashboard display
 */
export class SecurityMetricsCollector {
  /**
   * Get security metrics for the specified time range
   */
  async getMetrics(
    companyId: string,
    db: any,
    timeRangeMs: number = 24 * 60 * 60 * 1000 // 24 hours
  ): Promise<SecurityMetrics> {
    const stats = await getSecurityEventStats(companyId, db, timeRangeMs)

    return {
      timeRange: timeRangeMs,
      timestamp: Date.now(),
      events: {
        total: stats.totalEvents,
        failedLogins: stats.failedLogins,
        authorizationFailures: stats.authorizationFailures,
        rateLimitExceeded: stats.rateLimitExceeded,
        suspiciousActivity: stats.suspiciousActivity,
        accountLockouts: stats.accountLockouts,
      },
      trends: await this.calculateTrends(companyId, db, timeRangeMs),
    }
  }

  /**
   * Calculate trends (percentage change from previous period)
   */
  private async calculateTrends(
    companyId: string,
    db: any,
    timeRangeMs: number
  ): Promise<SecurityTrends> {
    const now = Date.now()
    const currentPeriodStart = now - timeRangeMs
    const previousPeriodStart = currentPeriodStart - timeRangeMs

    // Get stats for current and previous periods
    const currentStats = await getSecurityEventStats(companyId, db, timeRangeMs)

    // For previous period, need to query with custom date range
    const previousEvents = await querySecurityEvents(companyId, db, {
      dateFrom: previousPeriodStart,
      dateTo: currentPeriodStart,
    })

    const previousStats = {
      failedLogins: previousEvents.filter(e => e.action === SecurityEventType.FAILED_LOGIN).length,
      authorizationFailures: previousEvents.filter(
        e => e.action === SecurityEventType.AUTHORIZATION_FAILURE
      ).length,
      rateLimitExceeded: previousEvents.filter(
        e => e.action === SecurityEventType.RATE_LIMIT_EXCEEDED
      ).length,
    }

    return {
      failedLogins: this.calculatePercentageChange(
        previousStats.failedLogins,
        currentStats.failedLogins
      ),
      authorizationFailures: this.calculatePercentageChange(
        previousStats.authorizationFailures,
        currentStats.authorizationFailures
      ),
      rateLimitExceeded: this.calculatePercentageChange(
        previousStats.rateLimitExceeded,
        currentStats.rateLimitExceeded
      ),
    }
  }

  /**
   * Calculate percentage change
   */
  private calculatePercentageChange(previous: number, current: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }
}

/**
 * Security metrics interface
 */
export interface SecurityMetrics {
  timeRange: number
  timestamp: number
  events: {
    total: number
    failedLogins: number
    authorizationFailures: number
    rateLimitExceeded: number
    suspiciousActivity: number
    accountLockouts: number
  }
  trends: SecurityTrends
}

/**
 * Security trends interface
 */
export interface SecurityTrends {
  failedLogins: number // Percentage change
  authorizationFailures: number // Percentage change
  rateLimitExceeded: number // Percentage change
}

/**
 * Initialize security monitoring for production
 *
 * Call this function in your application startup to begin monitoring
 * security events and triggering alerts.
 *
 * @example
 * ```typescript
 * // In your main application or Worker
 * import { initializeSecurityMonitoring } from '@/monitoring/config/security-monitoring';
 *
 * // Start monitoring
 * const monitor = initializeSecurityMonitoring({
 *   thresholds: {
 *     failedLoginsPerMinute: { warning: 10, critical: 50 },
 *     authFailuresPerMinute: { warning: 20, critical: 100 },
 *     rateLimitViolationsPerMinute: { warning: 10, critical: 50 },
 *     consecutiveFailedLoginsPerIp: { warning: 5, critical: 10 },
 *     suspiciousActivityScore: { warning: 50, critical: 80 },
 *   },
 * });
 *
 * // In cleanup/shutdown
 * monitor.stop();
 * ```
 */
export function initializeSecurityMonitoring(
  config?: Partial<SecurityMonitoringConfig>
): SecurityEventMonitor {
  const fullConfig = {
    ...defaultSecurityMonitoringConfig,
    ...config,
  }

  const monitor = new SecurityEventMonitor(fullConfig)
  monitor.start()

  return monitor
}

/**
 * Create security metrics endpoint for dashboard
 *
 * This function can be used in a Worker or API endpoint to expose
 * security metrics for the dashboard.
 *
 * @example
 * ```typescript
 * // In Cloudflare Worker or API endpoint
 * import { createSecurityMetricsEndpoint } from '@/monitoring/config/security-monitoring';
 *
 * export default {
 *   async fetch(request: Request, env: Env, ctx: ExecutionContext) {
 *     const url = new URL(request.url);
 *
 *     if (url.pathname === '/metrics/security') {
 *       return createSecurityMetricsEndpoint(request, env.DB);
 *     }
 *
 *     // ... other routes
 *   }
 * }
 * ```
 */
export async function createSecurityMetricsEndpoint(
  request: Request,
  db: any
): Promise<Response> {
  try {
    // Get companyId from request (e.g., from auth header)
    const companyId = request.headers.get('X-Company-Id')
    if (!companyId) {
      return new Response(JSON.stringify({ error: 'Missing company ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get time range from query params (default 24 hours)
    const url = new URL(request.url)
    const hours = parseInt(url.searchParams.get('hours') || '24', 10)
    const timeRangeMs = hours * 60 * 60 * 1000

    // Collect metrics
    const collector = new SecurityMetricsCollector()
    const metrics = await collector.getMetrics(companyId, db, timeRangeMs)

    return new Response(JSON.stringify(metrics), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
      },
    })
  } catch (error) {
    console.error('Error generating security metrics:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
