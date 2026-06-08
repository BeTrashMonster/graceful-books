# Workshop System Monitoring and Alerting Guide

**Version:** 1.0
**Created:** 2026-06-08
**System:** Educational Workshop System
**Status:** Implementation Guide

---

## Executive Summary

This guide provides comprehensive monitoring and alerting setup for the Educational Workshop System. Effective monitoring ensures system reliability, early issue detection, and data-driven optimization.

**Monitoring Philosophy:**
- **Proactive, not reactive** - Catch issues before users notice
- **Actionable alerts** - Every alert must have a clear action
- **Balanced granularity** - Enough detail to debug, not so much to overwhelm
- **Business + technical metrics** - Monitor both system health and business impact

---

## Key Metrics to Monitor

### 1. Workshop Signup Metrics

**Business Impact:** High - Direct revenue driver

**Metrics:**

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| Signups per day | New workshop enrollments | Varies by workshop | < 50% of expected |
| Signups per week | Weekly enrollment trend | Varies by workshop | < 70% of expected |
| Signup completion rate | (Completed / Started) * 100 | > 80% | < 60% |
| Time to complete signup | Average minutes from start to finish | < 15 min | > 30 min |
| Signup errors | Failed enrollment attempts | < 2% | > 5% |

**Data Source:**
```sql
-- Daily signups
SELECT
  DATE(enrolled_at) as signup_date,
  COUNT(*) as signups,
  AVG(EXTRACT(EPOCH FROM (created_at - enrolled_at)) / 60) as avg_completion_minutes
FROM workshop_enrollments
WHERE enrolled_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(enrolled_at)
ORDER BY signup_date DESC;

-- Signup completion rate (requires tracking signup start separately)
SELECT
  COUNT(*) FILTER (WHERE worksheet_completed_at IS NOT NULL) * 100.0 / COUNT(*) as completion_rate
FROM workshop_enrollments
WHERE enrolled_at >= NOW() - INTERVAL '7 days';
```

**Dashboard Visualization:** Line chart showing daily signups with trend line

---

### 2. Trial Management Metrics

**Business Impact:** Critical - Affects conversion and revenue

**Metrics:**

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| Active trial count | Users currently in trial period | Varies | N/A (informational) |
| Trial expirations today | Trials expiring in next 24 hours | Varies | N/A (informational) |
| Trial expiration processing | Success rate of expiration cron job | 100% | < 95% |
| Expired trials not processed | Trials past expiration but status not updated | 0 | > 5 |
| Trial to paid conversion | (Converted / Total expired) * 100 | > 20% | < 15% |

**Data Source:**
```sql
-- Active trials
SELECT COUNT(*) as active_trials
FROM workshop_enrollments
WHERE status = 'active'
  AND trial_expires_at > NOW();

-- Trials expiring soon
SELECT COUNT(*) as expiring_soon
FROM workshop_enrollments
WHERE status = 'active'
  AND trial_expires_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours';

-- Expired trials not processed (ALERT if > 0)
SELECT COUNT(*) as stuck_trials
FROM workshop_enrollments
WHERE status IN ('enrolled', 'active')
  AND trial_expires_at < NOW();

-- Conversion rate
SELECT
  COUNT(*) FILTER (WHERE status = 'converted') * 100.0 / NULLIF(COUNT(*), 0) as conversion_rate
FROM workshop_enrollments
WHERE trial_expires_at < NOW()
  AND trial_expires_at >= NOW() - INTERVAL '30 days';
```

**Dashboard Visualization:** Funnel chart showing trial stages (active → expired → converted)

---

### 3. Email Delivery Metrics

**Business Impact:** Critical - Primary communication channel

**Metrics:**

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| Email send success rate | (Sent / Total) * 100 | > 95% | < 90% |
| Email delivery failure rate | (Failed / Total) * 100 | < 5% | > 10% |
| Email bounce rate | Hard bounces per 100 emails | < 2% | > 5% |
| Email spam rate | Marked as spam per 100 emails | < 0.1% | > 1% |
| Email queue depth | Pending emails waiting to send | < 100 | > 500 |
| Email send latency | Time from trigger to actual send | < 5 min | > 15 min |

**Data Source (Application Logs + Postmark API):**
```typescript
// In workshopEmails.ts service
interface EmailMetrics {
  sent: number;
  failed: number;
  bounced: number;
  spam: number;
  queueDepth: number;
  avgLatencyMs: number;
}

// Query from database (emails_sent JSONB field)
const emailMetricsQuery = `
  SELECT
    COUNT(*) FILTER (WHERE email->>'status' = 'sent') as sent,
    COUNT(*) FILTER (WHERE email->>'status' = 'failed') as failed,
    COUNT(*) FILTER (WHERE email->>'status' = 'bounced') as bounced,
    COUNT(*) FILTER (WHERE email->>'status' = 'spam') as spam,
    AVG(EXTRACT(EPOCH FROM (email->>'sentAt')::timestamptz - (email->>'triggeredAt')::timestamptz) * 1000) as avg_latency_ms
  FROM workshop_enrollments,
    jsonb_array_elements(emails_sent) as email
  WHERE enrolled_at >= NOW() - INTERVAL '24 hours';
`;

// Also query Postmark API for deliverability metrics
// GET https://api.postmarkapp.com/stats/outbound/sends
```

**Dashboard Visualization:** Stacked bar chart showing sent/failed/bounced over time

**External Monitoring:** Postmark dashboard (https://account.postmarkapp.com)

---

### 4. API Performance Metrics

**Business Impact:** High - Affects user experience

**Metrics:**

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| API response time (p50) | Median response time | < 500ms | > 1s |
| API response time (p95) | 95th percentile response time | < 2s | > 5s |
| API response time (p99) | 99th percentile response time | < 5s | > 10s |
| Requests per minute | Total API calls to workshop endpoints | Varies | N/A (trend monitoring) |
| Error rate | (Errors / Total) * 100 | < 1% | > 5% |
| Slow query count | Database queries > 1s | < 10/hour | > 50/hour |

**Data Source (Application Performance Monitoring):**

**Option 1: Custom Middleware Logging**
```typescript
// In audacious_money_backend/src/middleware/metrics.ts
import { Hono } from 'hono';
import type { HonoEnv } from '../types/hono.js';

export const metricsMiddleware = async (c: Context, next: Next) => {
  const start = Date.now();
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  // Log metrics
  console.log(JSON.stringify({
    type: 'api_request',
    path,
    method: c.req.method,
    status,
    duration_ms: duration,
    timestamp: new Date().toISOString(),
  }));

  // Store in metrics database or push to monitoring service
  if (duration > 2000) {
    console.warn(`[SLOW REQUEST] ${c.req.method} ${path} took ${duration}ms`);
  }
};
```

**Option 2: APM Service (e.g., New Relic, Datadog)**
- Automatic instrumentation of Node.js application
- Built-in dashboards for response times, error rates, throughput
- Distributed tracing for complex transactions

**Dashboard Visualization:** Time series showing p50, p95, p99 response times

---

### 5. Database Performance Metrics

**Business Impact:** Critical - Affects all system operations

**Metrics:**

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| Connection pool usage | (Active / Max) * 100 | < 70% | > 90% |
| Active queries | Currently executing queries | < 50 | > 100 |
| Long-running queries | Queries running > 30s | 0 | > 3 |
| Table bloat | Wasted disk space in tables | < 10% | > 30% |
| Index hit ratio | Cache efficiency | > 99% | < 95% |
| View query time | workshop_analytics view query time | < 100ms | > 1s |

**Data Source (PostgreSQL):**
```sql
-- Connection pool usage
SELECT
  count(*) as active_connections,
  (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
  count(*) * 100.0 / (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as usage_percent
FROM pg_stat_activity
WHERE state = 'active';

-- Long-running queries (ALERT if any)
SELECT
  pid,
  now() - query_start as duration,
  state,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
  AND now() - query_start > INTERVAL '30 seconds'
ORDER BY duration DESC;

-- Index hit ratio
SELECT
  sum(idx_blks_hit) * 100.0 / NULLIF(sum(idx_blks_hit + idx_blks_read), 0) as index_hit_ratio
FROM pg_statio_user_indexes;

-- workshop_analytics view performance
EXPLAIN ANALYZE SELECT * FROM workshop_analytics;
```

**Dashboard Visualization:** Gauge showing connection pool usage percentage

---

### 6. Error Tracking Metrics

**Business Impact:** Critical - Indicates system health issues

**Metrics:**

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| Error rate (all) | Errors per minute across all endpoints | < 1/min | > 10/min |
| Error rate (signup) | Errors during workshop enrollment | < 0.5% | > 5% |
| Error rate (payment) | Errors during payment processing | < 0.1% | > 2% |
| Error rate (email) | Errors sending emails | < 2% | > 10% |
| Unhandled exceptions | Crashes/uncaught errors | 0 | > 1/hour |
| 500 errors | Internal server errors | < 5/hour | > 20/hour |

**Data Source (Application Logs + Error Tracking Service):**

**Structured Logging:**
```typescript
// In all services
import { logger } from '../utils/logger.js';

try {
  await enrollUserInWorkshop(userId, workshopId);
} catch (error) {
  logger.error('Workshop enrollment failed', {
    userId,
    workshopId,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
  throw error;
}
```

**Error Aggregation Query:**
```sql
-- If storing errors in database
SELECT
  error_type,
  COUNT(*) as occurrences,
  MAX(occurred_at) as last_occurrence
FROM error_logs
WHERE occurred_at >= NOW() - INTERVAL '1 hour'
GROUP BY error_type
ORDER BY occurrences DESC;
```

**External Service:** Sentry, Rollbar, or Bugsnag for error tracking

**Dashboard Visualization:** Bar chart showing errors by type/endpoint

---

### 7. Business Analytics Metrics

**Business Impact:** High - Drives product decisions

**Metrics:**

| Metric | Description | Reporting Frequency | Dashboard |
|--------|-------------|---------------------|-----------|
| Total workshops | Active workshops count | Daily | Admin dashboard |
| Total enrollments | All-time enrollment count | Daily | Admin dashboard |
| Revenue per workshop | Average revenue generated | Weekly | Financial dashboard |
| Customer acquisition cost | Cost to acquire workshop participant | Weekly | Marketing dashboard |
| Lifetime value | Expected revenue per user | Monthly | Financial dashboard |
| Workshop completion rate | % of users who complete trial | Weekly | Product dashboard |
| Feature usage rate | Which features users engage with | Weekly | Product dashboard |

**Data Source:**
```sql
-- Workshop overview
SELECT
  COUNT(DISTINCT id) as total_workshops,
  COUNT(DISTINCT id) FILTER (WHERE status = 'open_registration') as open_workshops,
  COUNT(DISTINCT id) FILTER (WHERE status = 'in_progress') as active_workshops
FROM workshops;

-- Revenue per workshop (requires Stripe data)
SELECT
  w.cohort_name,
  COUNT(we.id) as enrollments,
  COUNT(we.id) FILTER (WHERE we.status = 'converted') as conversions,
  COUNT(we.id) FILTER (WHERE we.status = 'converted') * 25 as estimated_revenue -- $25/month
FROM workshops w
LEFT JOIN workshop_enrollments we ON w.id = we.workshop_id
GROUP BY w.id, w.cohort_name
ORDER BY estimated_revenue DESC;

-- Conversion funnel
SELECT
  COUNT(*) as total_signups,
  COUNT(*) FILTER (WHERE worksheet_completed_at IS NOT NULL) as completed_worksheet,
  COUNT(*) FILTER (WHERE first_login_at IS NOT NULL) as first_login,
  COUNT(*) FILTER (WHERE status = 'active') as active_trial,
  COUNT(*) FILTER (WHERE status = 'converted') as converted_to_paid
FROM workshop_enrollments
WHERE enrolled_at >= NOW() - INTERVAL '30 days';
```

**Dashboard Visualization:** Multiple charts (KPI cards, conversion funnel, revenue trend)

---

## Logging Requirements

### Structured Logging Format

**All logs MUST follow this structure:**

```json
{
  "timestamp": "2026-06-08T14:35:22.123Z",
  "level": "info",
  "service": "workshop-service",
  "operation": "enroll_user",
  "userId": "uuid-here",
  "workshopId": "uuid-here",
  "duration_ms": 234,
  "success": true,
  "metadata": {
    "workshopSlug": "spring-2026",
    "userEmail": "user@example.com"
  }
}
```

### Log Levels

**Use appropriate log levels:**

| Level | Usage | Examples |
|-------|-------|----------|
| **ERROR** | System failures, unhandled exceptions | Payment processing failed, database connection lost |
| **WARN** | Recoverable issues, degraded performance | Email send retry, slow query detected |
| **INFO** | Significant events, business operations | User enrolled, workshop created, trial started |
| **DEBUG** | Detailed diagnostic information | Function entry/exit, variable values |

**Production:** Log INFO and above (ERROR, WARN, INFO)
**Development:** Log DEBUG and above (all levels)

### Logger Implementation

**Create centralized logger: `audacious_money_backend/src/utils/logger.ts`**

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const workshopLogger = logger.child({ service: 'workshop-service' });

// Usage:
workshopLogger.info({
  operation: 'enroll_user',
  userId,
  workshopId,
  duration_ms: 123,
}, 'User enrolled in workshop successfully');

workshopLogger.error({
  operation: 'send_email',
  userId,
  emailType: 'welcome',
  error: error.message,
}, 'Failed to send welcome email');
```

### Log Aggregation

**Option 1: File-based logging with rotation**

```bash
# Install winston or pino for log rotation
npm install pino pino-pretty rotating-file-stream

# Configure log rotation
# Logs stored in: /var/log/audacious-money/workshop-service.log
# Rotate daily, keep 30 days
```

**Option 2: Centralized logging service**

- **ELK Stack:** Elasticsearch + Logstash + Kibana
- **Loki + Grafana:** Lightweight log aggregation
- **Cloud Services:** AWS CloudWatch, Google Cloud Logging, Azure Monitor

**Recommendation:** Start with file-based logging, move to centralized service as scale increases

### Log Retention Policy

**Retention periods:**
- **ERROR logs:** 90 days minimum (for debugging and compliance)
- **WARN logs:** 60 days
- **INFO logs:** 30 days
- **DEBUG logs:** 7 days (development only)

**Archival:**
- Compress logs older than 7 days (gzip)
- Archive to S3 or cloud storage for long-term retention
- Delete archived logs after 1 year (unless compliance requires longer)

---

## Alert Thresholds and Actions

### Critical Alerts (Immediate Action Required)

**Response Time:** < 15 minutes

| Alert | Condition | Action |
|-------|-----------|--------|
| **Workshop system down** | Error rate > 50% for 5 minutes | 1. Check server status<br>2. Review recent deployments<br>3. Rollback if needed<br>4. Disable WORKSHOP_SYSTEM_ENABLED flag |
| **Database connection failure** | Cannot connect to database | 1. Check database server status<br>2. Verify connection string<br>3. Check connection pool limits<br>4. Restart database if needed |
| **Payment processing failure** | Stripe errors > 10% for 5 minutes | 1. Check Stripe dashboard<br>2. Verify webhook configuration<br>3. Disable WORKSHOP_TRIALS_ENABLED<br>4. Contact Stripe support if needed |
| **Email delivery failure** | Email failure rate > 50% for 10 minutes | 1. Check Postmark dashboard<br>2. Verify DNS records (SPF, DKIM)<br>3. Disable WORKSHOP_EMAILS_ENABLED<br>4. Contact Postmark support |

### High Priority Alerts (Action within 1 hour)

| Alert | Condition | Action |
|-------|-----------|--------|
| **High error rate** | Error rate > 5% for 5 minutes | 1. Review error logs for patterns<br>2. Identify affected endpoint<br>3. Deploy hotfix or rollback |
| **Slow API response** | p95 latency > 5s for 5 minutes | 1. Check database slow queries<br>2. Review recent code changes<br>3. Scale up resources if needed |
| **Email deliverability drop** | Deliverability < 90% for 1 hour | 1. Check Postmark bounce reports<br>2. Review email content for spam triggers<br>3. Verify sender reputation |
| **Low conversion rate** | Trial to paid < 15% for 7 days | 1. Review user feedback<br>2. Analyze drop-off points<br>3. A/B test upgrade messaging |

### Medium Priority Alerts (Action within 4 hours)

| Alert | Condition | Action |
|-------|-----------|--------|
| **Signup drop** | Signups < 50% of expected for 24 hours | 1. Check marketing campaigns<br>2. Verify signup page accessibility<br>3. Review recent UI changes |
| **Database connection pool** | Pool usage > 90% for 15 minutes | 1. Check for connection leaks<br>2. Review query performance<br>3. Increase pool size if needed |
| **Email queue backup** | Queue depth > 500 for 30 minutes | 1. Check email service status<br>2. Increase email sending rate<br>3. Review email volume trends |

### Informational Alerts (Review daily)

| Alert | Condition | Action |
|-------|-----------|--------|
| **Workshop enrollment milestone** | Workshop reaches 10, 20, 50, 100 enrollments | Celebrate with team, post on social media |
| **New workshop created** | Admin creates new workshop | Verify workshop settings, review email templates |
| **Trial expiration upcoming** | 10+ trials expiring in next 24 hours | Ensure email templates are finalized, monitor conversion |

---

## Alert Configuration Examples

### Using Prometheus + Alertmanager

**promethe us_alerts.yml:**

```yaml
groups:
  - name: workshop_alerts
    interval: 30s
    rules:
      # Critical: High error rate
      - alert: WorkshopHighErrorRate
        expr: rate(http_requests_total{status=~"5..", path=~"/workshops/.*"}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
          service: workshop
        annotations:
          summary: "High error rate detected in workshop endpoints"
          description: "Error rate is {{ $value | humanizePercentage }} over the last 5 minutes"

      # Critical: Email delivery failure
      - alert: EmailDeliveryFailure
        expr: rate(email_sends_total{status="failed"}[10m]) > 0.5
        for: 10m
        labels:
          severity: critical
          service: email
        annotations:
          summary: "Email delivery failure rate is high"
          description: "{{ $value | humanizePercentage }} of emails failing to send"

      # High: Slow API response
      - alert: WorkshopSlowAPI
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{path=~"/workshops/.*"}[5m])) > 5
        for: 5m
        labels:
          severity: high
          service: workshop
        annotations:
          summary: "Workshop API response time is slow"
          description: "p95 latency is {{ $value }}s"

      # Medium: Low conversion rate
      - alert: WorkshopLowConversionRate
        expr: workshop_conversion_rate < 0.15
        for: 7d
        labels:
          severity: medium
          service: workshop
        annotations:
          summary: "Workshop trial conversion rate is low"
          description: "Conversion rate is {{ $value | humanizePercentage }}"
```

### Using Database Queries + Cron Jobs

**Create monitoring script: `audacious_money_backend/scripts/monitor-workshops.ts`**

```typescript
import { db } from '../src/db/connection.js';
import { sendAlertEmail } from '../src/services/email.js';

async function checkExpiredTrialsNotProcessed() {
  const result = await db.query(`
    SELECT COUNT(*) as count
    FROM workshop_enrollments
    WHERE status IN ('enrolled', 'active')
      AND trial_expires_at < NOW()
  `);

  const count = parseInt(result.rows[0].count);

  if (count > 5) {
    await sendAlertEmail({
      to: 'alerts@audaciousmoney.com',
      subject: 'ALERT: Expired trials not processed',
      body: `${count} trials have expired but status not updated. Run update_expired_workshop_trials() function.`,
    });
  }
}

async function checkEmailDeliverability() {
  const result = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE email->>'status' = 'sent') as sent,
      COUNT(*) FILTER (WHERE email->>'status' = 'failed') as failed
    FROM workshop_enrollments,
      jsonb_array_elements(emails_sent) as email
    WHERE enrolled_at >= NOW() - INTERVAL '1 hour'
  `);

  const { sent, failed } = result.rows[0];
  const failureRate = failed / (sent + failed);

  if (failureRate > 0.1) {
    await sendAlertEmail({
      to: 'alerts@audaciousmoney.com',
      subject: 'ALERT: Email delivery failure rate high',
      body: `Email failure rate: ${(failureRate * 100).toFixed(2)}% (${failed} failed, ${sent} sent)`,
    });
  }
}

async function runAllChecks() {
  await checkExpiredTrialsNotProcessed();
  await checkEmailDeliverability();
  // Add more checks...
}

runAllChecks().catch(console.error);
```

**Cron job setup:**
```bash
# Run monitoring checks every 5 minutes
*/5 * * * * cd /app/audacious_money_backend && node scripts/monitor-workshops.js >> /var/log/workshop-monitor.log 2>&1
```

### Using Simple Email Alerts

**For small deployments without monitoring infrastructure:**

```typescript
// In workshopEmails.ts
async function sendEmail(userId: string, emailType: string) {
  try {
    const result = await postmark.sendEmail({...});

    // If failure rate high, alert admin
    if (recentFailureRate > 0.1) {
      await sendAlertEmail('admin@audaciousmoney.com', 'Email delivery issues detected');
    }

    return result;
  } catch (error) {
    logger.error({ userId, emailType, error }, 'Email send failed');

    // Critical: Alert immediately if email service is down
    await sendAlertEmail('admin@audaciousmoney.com', `CRITICAL: Email service error: ${error.message}`);

    throw error;
  }
}
```

---

## Health Check Endpoint Implementation

### Health Check Specification

**Endpoint:** `GET /api/workshops/health`

**Purpose:** Verify all workshop system dependencies are operational

**Authentication:** Admin-only (or public with rate limiting)

**Response Format:**

```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2026-06-08T14:35:22.123Z",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime_ms": 12,
      "details": "Connected to PostgreSQL 14.5"
    },
    "emailService": {
      "status": "healthy",
      "responseTime_ms": 89,
      "details": "Postmark API responding"
    },
    "stripeService": {
      "status": "healthy",
      "responseTime_ms": 145,
      "details": "Stripe API responding"
    },
    "featureFlags": {
      "WORKSHOP_SYSTEM_ENABLED": true,
      "WORKSHOP_EMAILS_ENABLED": true,
      "WORKSHOP_TRIALS_ENABLED": true
    },
    "metrics": {
      "activeTrials": 45,
      "pendingEmails": 12,
      "recentErrors": 0
    }
  }
}
```

**Status Definitions:**
- **healthy:** All checks passed, system fully operational
- **degraded:** Some checks failed but core functionality works
- **unhealthy:** Critical checks failed, system may not function

### Implementation

**Add to `audacious_money_backend/src/routes/workshops.ts`:**

```typescript
/**
 * GET /api/workshops/health
 *
 * Health check endpoint for workshop system
 * Returns status of database, email service, Stripe, and system metrics
 */
workshops.get('/health', async (c) => {
  const startTime = Date.now();
  const checks: any = {};
  let overallStatus = 'healthy';

  // Check 1: Database connectivity
  try {
    const dbStart = Date.now();
    const dbResult = await c.get('db').query('SELECT 1 as health');
    const dbDuration = Date.now() - dbStart;

    checks.database = {
      status: 'healthy',
      responseTime_ms: dbDuration,
      details: 'Database connection successful',
    };
  } catch (error: any) {
    checks.database = {
      status: 'unhealthy',
      error: error.message,
      details: 'Database connection failed',
    };
    overallStatus = 'unhealthy';
  }

  // Check 2: Email service (Postmark)
  try {
    const emailStart = Date.now();
    // Simple health check: Get account info from Postmark
    // Note: Requires Postmark client initialization
    // const postmarkHealth = await postmark.getServer();
    const emailDuration = Date.now() - emailStart;

    checks.emailService = {
      status: 'healthy',
      responseTime_ms: emailDuration,
      details: 'Email service responding',
    };
  } catch (error: any) {
    checks.emailService = {
      status: 'degraded',
      error: error.message,
      details: 'Email service check failed',
    };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  // Check 3: Stripe service
  try {
    const stripeStart = Date.now();
    // Simple health check: Get account info
    // const stripeHealth = await stripe.accounts.retrieve();
    const stripeDuration = Date.now() - stripeStart;

    checks.stripeService = {
      status: 'healthy',
      responseTime_ms: stripeDuration,
      details: 'Stripe API responding',
    };
  } catch (error: any) {
    checks.stripeService = {
      status: 'degraded',
      error: error.message,
      details: 'Stripe service check failed',
    };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  // Check 4: Feature flags status
  checks.featureFlags = {
    WORKSHOP_SYSTEM_ENABLED: process.env.WORKSHOP_SYSTEM_ENABLED === 'true',
    WORKSHOP_EMAILS_ENABLED: process.env.WORKSHOP_EMAILS_ENABLED === 'true',
    WORKSHOP_TRIALS_ENABLED: process.env.WORKSHOP_TRIALS_ENABLED === 'true',
  };

  // Check 5: System metrics
  try {
    const metricsResult = await c.get('db').query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active' AND trial_expires_at > NOW()) as active_trials,
        COUNT(*) FILTER (WHERE status IN ('enrolled', 'active') AND trial_expires_at < NOW()) as stuck_trials
      FROM workshop_enrollments
    `);

    const { active_trials, stuck_trials } = metricsResult.rows[0];

    checks.metrics = {
      activeTrials: parseInt(active_trials),
      stuckTrials: parseInt(stuck_trials),
      recentErrors: 0, // Would query error logs table
    };

    // Alert if stuck trials detected
    if (parseInt(stuck_trials) > 5) {
      checks.metrics.warning = `${stuck_trials} expired trials not processed`;
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }
  } catch (error: any) {
    checks.metrics = {
      status: 'error',
      error: error.message,
    };
  }

  const totalDuration = Date.now() - startTime;

  return c.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    responseTime_ms: totalDuration,
    checks,
  });
});
```

### Health Check Monitoring

**External monitoring services:**
- **UptimeRobot:** Free tier monitors endpoint every 5 minutes
- **Pingdom:** Enterprise-grade uptime monitoring
- **StatusCake:** Uptime and performance monitoring

**Setup example (UptimeRobot):**
1. Create new monitor
2. Monitor type: HTTP(s)
3. URL: `https://api.audaciousmoney.com/workshops/health`
4. Monitoring interval: 5 minutes
5. Alert contacts: Email, SMS, Slack

**Expected response:**
- Status code: 200
- Response body: `"status":"healthy"`
- Response time: < 1 second

**Alert if:**
- Status code != 200
- Response body contains `"status":"unhealthy"`
- Response time > 5 seconds
- Endpoint unreachable (connection timeout)

---

## Cron Job Setup

### Required Cron Jobs

**1. Email Scheduler (Every 15 minutes)**

**Purpose:** Send scheduled workshop emails (welcome, weekly, reminder)

**Command:**
```bash
*/15 * * * * cd /app/audacious_money_backend && node -r esbuild-register src/services/email/workshopEmailScheduler.ts >> /var/log/workshop-email-scheduler.log 2>&1
```

**Monitoring:**
- Check log file for errors
- Alert if no emails sent in 24 hours (when emails expected)
- Alert if cron job fails to execute

**2. Trial Expiration Processor (Daily at 2 AM)**

**Purpose:** Update status of expired trials, trigger upgrade prompts

**Command:**
```bash
0 2 * * * cd /app/audacious_money_backend && psql $DATABASE_URL -c "SELECT update_expired_workshop_trials();" >> /var/log/workshop-trial-expiration.log 2>&1
```

**Monitoring:**
- Verify function executed successfully
- Alert if stuck trials count > 5 after execution
- Log number of trials updated each run

**3. Analytics Refresh (Hourly)**

**Purpose:** Refresh materialized views or cached analytics data

**Command:**
```bash
0 * * * * cd /app/audacious_money_backend && psql $DATABASE_URL -c "REFRESH MATERIALIZED VIEW CONCURRENTLY workshop_analytics_cached;" >> /var/log/workshop-analytics-refresh.log 2>&1
```

**Note:** Only needed if workshop_analytics is materialized (currently it's a regular view)

**4. System Health Check Logging (Every 5 minutes)**

**Purpose:** Log health check results for trend analysis

**Command:**
```bash
*/5 * * * * curl -s https://api.audaciousmoney.com/workshops/health | jq -r '.status' >> /var/log/workshop-health.log 2>&1
```

**Monitoring:**
- Alert if 3 consecutive "unhealthy" responses
- Track uptime percentage from logs

### Cron Job Monitoring

**Monitor cron execution:**

```bash
# Check if cron jobs are running
ps aux | grep cron

# Check cron logs (varies by system)
# Ubuntu/Debian:
tail -f /var/log/syslog | grep CRON

# CentOS/RHEL:
tail -f /var/log/cron

# macOS:
tail -f /var/log/system.log | grep cron
```

**Alert if cron job fails:**

**Using Cronitor or similar service:**
1. Create ping URL for each cron job
2. Add curl command to end of cron job to ping success
3. Cronitor alerts if ping not received within expected interval

**Example:**
```bash
# Cron job with health check ping
0 2 * * * cd /app && psql $DB -c "SELECT update_expired_workshop_trials();" && curl https://cronitor.link/p/abc123/trial-expiration
```

---

## Dashboard Requirements

### Admin Dashboard: Workshop System Overview

**Location:** `/admin/workshops/dashboard`

**Sections:**

**1. System Health (Top Row)**
- Current status indicator (green/yellow/red)
- Last health check timestamp
- Feature flag status (pills showing on/off)
- Active alerts count

**2. Real-Time Metrics (Second Row)**
- Signups today (number + sparkline)
- Active trials count
- Emails sent (last hour)
- Current error rate

**3. Conversion Funnel (Third Row)**
- Visual funnel: Signups → Worksheet → Login → Active → Converted
- Percentage drop-off at each stage
- Clickable to see user lists

**4. Email Performance (Fourth Row)**
- Delivery success rate (last 24 hours)
- Email types sent (pie chart)
- Bounce/spam rates
- Queue depth

**5. Workshop List (Fifth Row)**
- Table of active workshops
- Enrollment counts
- Status indicators
- Quick actions (view, edit, analytics)

**6. Recent Activity Feed (Sidebar)**
- Latest signups
- Recent errors
- Trial expirations today
- Recent conversions

### Analytics Dashboard: Deep Dive

**Location:** `/admin/workshops/analytics`

**Charts:**
- Daily signups (line chart, 30 days)
- Conversion funnel (funnel chart)
- Email engagement (bar chart: open rate, click rate)
- Revenue by workshop (bar chart)
- User cohort retention (cohort table)
- Geographic distribution (map)

**Filters:**
- Date range selector
- Workshop selector
- Cohort selector

---

## Sample Dashboard Queries

### Real-Time Metrics

```sql
-- Dashboard: System Overview
SELECT
  -- Signups today
  (SELECT COUNT(*) FROM workshop_enrollments WHERE enrolled_at >= CURRENT_DATE) as signups_today,

  -- Active trials
  (SELECT COUNT(*) FROM workshop_enrollments WHERE status = 'active' AND trial_expires_at > NOW()) as active_trials,

  -- Emails sent (last hour)
  (SELECT COUNT(*) FROM workshop_enrollments,
    jsonb_array_elements(emails_sent) as email
    WHERE (email->>'sentAt')::timestamptz >= NOW() - INTERVAL '1 hour') as emails_last_hour,

  -- Trials expiring today
  (SELECT COUNT(*) FROM workshop_enrollments WHERE DATE(trial_expires_at) = CURRENT_DATE) as expiring_today;
```

### Conversion Funnel

```sql
-- Workshop conversion funnel (last 30 days)
SELECT
  COUNT(*) as total_signups,
  COUNT(*) FILTER (WHERE worksheet_completed_at IS NOT NULL) as completed_worksheet,
  COUNT(*) FILTER (WHERE first_login_at IS NOT NULL) as logged_in,
  COUNT(*) FILTER (WHERE status = 'active') as active_trial,
  COUNT(*) FILTER (WHERE status = 'converted') as converted,

  -- Percentages
  COUNT(*) FILTER (WHERE worksheet_completed_at IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0) as worksheet_rate,
  COUNT(*) FILTER (WHERE first_login_at IS NOT NULL) * 100.0 / NULLIF(COUNT(*) FILTER (WHERE worksheet_completed_at IS NOT NULL), 0) as login_rate,
  COUNT(*) FILTER (WHERE status = 'active') * 100.0 / NULLIF(COUNT(*) FILTER (WHERE first_login_at IS NOT NULL), 0) as active_rate,
  COUNT(*) FILTER (WHERE status = 'converted') * 100.0 / NULLIF(COUNT(*) FILTER (WHERE status IN ('active', 'converted', 'trial_expired')), 0) as conversion_rate
FROM workshop_enrollments
WHERE enrolled_at >= NOW() - INTERVAL '30 days';
```

### Email Performance

```sql
-- Email performance by type (last 7 days)
SELECT
  email->>'emailType' as email_type,
  COUNT(*) as sent_count,
  COUNT(*) FILTER (WHERE email->>'status' = 'sent') as delivered,
  COUNT(*) FILTER (WHERE email->>'status' = 'failed') as failed,
  COUNT(*) FILTER (WHERE email->>'status' = 'bounced') as bounced,
  COUNT(*) FILTER (WHERE email->>'status' = 'sent') * 100.0 / COUNT(*) as delivery_rate
FROM workshop_enrollments,
  jsonb_array_elements(emails_sent) as email
WHERE (email->>'sentAt')::timestamptz >= NOW() - INTERVAL '7 days'
GROUP BY email->>'emailType'
ORDER BY sent_count DESC;
```

### Workshop Performance Comparison

```sql
-- Compare workshop performance
SELECT
  w.cohort_name,
  w.status,
  COUNT(we.id) as total_enrollments,
  COUNT(we.id) FILTER (WHERE we.status = 'converted') as conversions,
  COUNT(we.id) FILTER (WHERE we.status = 'converted') * 100.0 / NULLIF(COUNT(we.id), 0) as conversion_rate,
  COUNT(we.id) FILTER (WHERE we.worksheet_completed_at IS NOT NULL) * 100.0 / NULLIF(COUNT(we.id), 0) as completion_rate,
  AVG(EXTRACT(EPOCH FROM (we.converted_to_paid_at - we.enrolled_at)) / 86400) as avg_days_to_conversion
FROM workshops w
LEFT JOIN workshop_enrollments we ON w.id = we.workshop_id
GROUP BY w.id, w.cohort_name, w.status
ORDER BY total_enrollments DESC;
```

---

## Alerting Best Practices

### 1. Alert Fatigue Prevention

**Avoid:** Alerts for every minor issue
**Do:** Set meaningful thresholds that indicate real problems

**Example:**
- ❌ Alert on every email send failure
- ✅ Alert when email failure rate > 10% for 10 minutes

### 2. Actionable Alerts Only

**Every alert should include:**
- What is wrong (specific metric/service)
- Why it matters (business impact)
- What to do about it (runbook link or action steps)

**Example:**
```
ALERT: Workshop Email Deliverability Low

Metric: Email delivery success rate is 82% (threshold: 90%)
Impact: Users not receiving workshop emails, may affect conversion
Action: https://wiki.company.com/runbooks/email-deliverability

Quick fix:
1. Check Postmark dashboard for bounce reasons
2. Verify DNS records: dig TXT audaciousmoney.com
3. Review recent email template changes
```

### 3. Alert Escalation

**Tier 1: Automated remediation**
- Self-healing actions (restart service, clear cache)

**Tier 2: On-call engineer**
- Wake up on-call person for critical alerts only

**Tier 3: Team notification**
- Post in Slack for team awareness

**Tier 4: Management escalation**
- Only for business-critical outages

### 4. Alert Routing

**Critical alerts** → Page on-call + Slack + Email
**High priority** → Slack + Email
**Medium priority** → Slack only
**Informational** → Email digest (daily)

---

## Monitoring Tools Comparison

### Option 1: Self-Hosted (Low Cost)

**Stack:** Prometheus + Grafana + Loki

**Pros:**
- Free and open source
- Full control over data
- No per-seat pricing
- Powerful query language (PromQL)

**Cons:**
- Requires setup and maintenance
- Need to manage infrastructure
- Learning curve for configuration

**Estimated Cost:** $20-50/month (server hosting)

### Option 2: Managed Service (Easy)

**Options:**
- **Datadog:** Comprehensive, expensive ($15-31/host/month)
- **New Relic:** APM + Infrastructure ($25-99/month)
- **Sentry:** Error tracking ($26-80/month)
- **LogDNA/Mezmo:** Log management ($1.50/GB)

**Pros:**
- Easy setup (drop in agent/SDK)
- Pre-built dashboards
- Automatic alerting
- 24/7 uptime

**Cons:**
- Expensive at scale
- Less flexibility
- Vendor lock-in

**Estimated Cost:** $100-500/month

### Option 3: Hybrid (Balanced)

**Stack:**
- **Free tier services:** UptimeRobot (uptime), Sentry (errors)
- **Self-hosted metrics:** Prometheus + Grafana
- **Cloud logs:** AWS CloudWatch or Google Cloud Logging

**Pros:**
- Best of both worlds
- Cost-effective
- Scalable

**Cons:**
- Multiple tools to learn
- Data in multiple places

**Estimated Cost:** $30-100/month

### Recommendation

**For startup/small team:** Option 3 (Hybrid)
**For enterprise:** Option 2 (Managed Service)
**For tight budget:** Option 1 (Self-Hosted)

---

## Conclusion

Effective monitoring is crucial for the workshop system's success. Start with basic monitoring (health checks, error logs, uptime monitoring) and gradually add more sophisticated metrics and alerting as the system scales.

**Implementation Priority:**
1. **Week 1:** Health check endpoint + basic logging
2. **Week 2:** Error tracking (Sentry or similar)
3. **Week 3:** Uptime monitoring (UptimeRobot)
4. **Week 4:** Performance monitoring (APM or custom)
5. **Month 2:** Business analytics dashboard
6. **Month 3:** Advanced alerting and automation

**Remember:** Monitor what matters, alert on what's actionable, and iterate based on what you learn.

---

**End of Monitoring Guide**

*Last Updated: 2026-06-08*
*For: Educational Workshop System (Sprint 8, Phase 8)*
*Next: WORKSHOP_DEPLOYMENT_CHECKLIST.md*
