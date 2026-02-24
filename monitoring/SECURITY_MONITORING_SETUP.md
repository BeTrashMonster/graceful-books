# Security Monitoring Setup Guide

Complete guide for configuring production monitoring and alerting for security events in Graceful Books.

**Task:** S5-8: Production Monitoring Setup
**Dependencies:** S5-2 (Security Event Logging), S5-7 (Admin Audit Log Viewer)
**Status:** COMPLETED

---

## Overview

Security monitoring provides real-time detection and alerting for:

- **Failed login attempts** (brute force detection)
- **Authorization failures** (IDOR attack detection)
- **Rate limit violations** (DoS/scraping detection)
- **Suspicious activity** (anomaly detection)
- **Account lockouts** (mass attack detection)
- **Session anomalies** (hijacking detection)

All security events are logged via the `securityLogger` (S5-2) and monitored by the production monitoring infrastructure.

---

## Architecture

```
┌─────────────────┐
│  Application    │
│  (Frontend/API) │
└────────┬────────┘
         │ Security Events
         ▼
┌─────────────────┐
│ Security Logger │  (S5-2: src/utils/securityLogger.ts)
│  - Log to DB    │
│  - Sanitize PII │
└────────┬────────┘
         │ Audit Log
         ▼
┌─────────────────┐
│   Audit Log DB  │
│   (Immutable)   │
└────────┬────────┘
         │ Query
         ▼
┌─────────────────┐
│ Security        │  (S5-8: monitoring/config/security-monitoring.ts)
│ Event Monitor   │
│  - Count events │
│  - Check thresh │
└────────┬────────┘
         │ Alerts
         ▼
┌─────────────────┐
│  Alert Router   │  (monitoring/alerts/alert-routing.ts)
│  - Route alerts │
│  - Deduplicate  │
└────────┬────────┘
         │
         ├──────────► PagerDuty (Critical)
         ├──────────► Slack (All)
         └──────────► Email (Low Priority)
```

---

## Quick Start

### 1. Environment Variables

Add these to your production environment:

```bash
# Required for security alerts
SLACK_WEBHOOK_SECURITY=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
PAGERDUTY_INTEGRATION_KEY=your_pagerduty_integration_key
SECURITY_EMAIL=security@gracefulbooks.com

# For Sentry error tracking
VITE_SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[project]

# For uptime monitoring (UptimeRobot API)
UPTIMEROBOT_API_KEY=your_api_key
```

### 2. Initialize Security Monitoring

In your application startup or Worker:

```typescript
import { initializeSecurityMonitoring } from '@/monitoring/config/security-monitoring'

// Start monitoring with default configuration
const monitor = initializeSecurityMonitoring()

// Or customize thresholds
const monitor = initializeSecurityMonitoring({
  thresholds: {
    failedLoginsPerMinute: { warning: 10, critical: 50 },
    authFailuresPerMinute: { warning: 20, critical: 100 },
    rateLimitViolationsPerMinute: { warning: 10, critical: 50 },
    consecutiveFailedLoginsPerIp: { warning: 5, critical: 10 },
    suspiciousActivityScore: { warning: 50, critical: 80 },
  },
  intervals: {
    checkInterval: 60000, // Check every 60 seconds
    countWindow: 60000, // Count events in last 60 seconds
  },
})

// In cleanup/shutdown
process.on('SIGTERM', () => {
  monitor.stop()
})
```

### 3. Expose Security Metrics Endpoint

In your API or Worker:

```typescript
import { createSecurityMetricsEndpoint } from '@/monitoring/config/security-monitoring'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url)

    // Security metrics endpoint
    if (url.pathname === '/metrics/security') {
      return createSecurityMetricsEndpoint(request, env.DB)
    }

    // ... other routes
  },
}
```

### 4. Deploy Security Dashboard

```bash
# Copy dashboard to public directory
cp monitoring/dashboards/security-dashboard.html public/monitoring/

# Rebuild and deploy
npm run build
wrangler pages publish dist --project-name=graceful-books

# Access dashboard
open https://gracefulbooks.com/monitoring/security-dashboard.html
```

---

## Configuration

### Alert Thresholds

Thresholds are defined in `monitoring/alerts/thresholds.yml`:

```yaml
security:
  failed_logins:
    per_minute:
      warning: 10   # Possible brute force
      critical: 50  # Active brute force attack

  authorization_failures:
    per_minute:
      warning: 20   # Possible enumeration
      critical: 100 # Active IDOR attack

  rate_limit_violations:
    per_minute:
      warning: 10   # Aggressive client
      critical: 50  # Possible DoS/scraping

  suspicious_activity:
    score_threshold:
      warning: 50   # Moderate suspicion
      critical: 80  # High suspicion
```

**Tuning Thresholds:**

- Start with defaults
- Monitor for 1-2 weeks
- Adjust based on false positive rate
- Lower thresholds = more sensitive (more alerts)
- Higher thresholds = less sensitive (fewer alerts)

### Alert Routing

Security alerts are routed based on severity:

| Severity | Channels | Response Time |
|----------|----------|---------------|
| **Critical** | PagerDuty + Slack | < 5 minutes |
| **High** | Slack + Email | < 15 minutes |
| **Medium** | Slack only | < 4 hours |
| **Low** | Email only | < 24 hours |

### Deduplication

Prevents alert fatigue:

- **Critical:** Can re-alert every 5 minutes
- **High:** Can re-alert every 15 minutes
- **Medium:** Can re-alert every 30 minutes
- **Low:** Can re-alert every 1 hour

---

## Monitoring Services

### 1. Sentry (Error Tracking)

**Purpose:** Capture application errors and performance issues

**Setup:**
```bash
# 1. Create Sentry account at https://sentry.io
# 2. Create project: "Graceful Books"
# 3. Copy DSN
# 4. Add to environment variables
VITE_SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[project]

# 5. Initialize in your app
import { initializeSentry } from '@/monitoring/config/sentry'
initializeSentry({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: __APP_VERSION__,
})
```

**Cost:** Free tier (5K errors/month) or $26/month (Team plan)

**Documentation:** [monitoring/config/sentry.ts](./config/sentry.ts)

### 2. UptimeRobot (Uptime Monitoring)

**Purpose:** External monitoring for uptime and SSL certificates

**Setup:**
```bash
# 1. Create account at https://uptimerobot.com
# 2. Import monitors from monitoring/config/uptime-monitoring.yml
# 3. Configure alert contacts:
#    - Slack webhook
#    - PagerDuty integration
#    - Email
# 4. Test each monitor
```

**Monitors:**
- Frontend: https://gracefulbooks.com
- Sync Relay: https://sync.gracefulbooks.com/health
- Regional relays (US, EU, AP)
- SSL certificate expiry
- DNS resolution

**Cost:** Free tier (50 monitors) or $7/month (Pro plan)

**Configuration:** [monitoring/config/uptime-monitoring.yml](./config/uptime-monitoring.yml)

### 3. PagerDuty (Incident Management)

**Purpose:** Critical alert delivery and escalation

**Setup:**
```bash
# 1. Create account at https://www.pagerduty.com
# 2. Create service: "Graceful Books - Production"
# 3. Configure escalation policy:
#    - Level 1: Primary on-call (5 min)
#    - Level 2: Secondary on-call (10 min)
#    - Level 3: Engineering lead (30 min)
# 4. Copy integration key
# 5. Add to environment variables
PAGERDUTY_INTEGRATION_KEY=your_integration_key

# 6. Install mobile app
# 7. Test notification delivery
```

**Cost:** $21/user/month (Professional plan)

### 4. Slack Integration

**Purpose:** Team notifications for all alerts

**Setup:**
```bash
# 1. Create channels:
#    - #security (security alerts)
#    - #engineering (all alerts)
#    - #incidents (critical only)

# 2. Create incoming webhook:
#    - Go to https://api.slack.com/apps
#    - Create new app
#    - Enable Incoming Webhooks
#    - Add webhook to workspace
#    - Select #security channel
#    - Copy webhook URL

# 3. Add to environment variables
SLACK_WEBHOOK_SECURITY=https://hooks.slack.com/services/...

# 4. Test webhook
curl -X POST $SLACK_WEBHOOK_SECURITY \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test security alert"}'
```

**Cost:** Free

---

## Testing Alerts

### Test Failed Login Alert

```bash
# Trigger multiple failed logins (in staging!)
for i in {1..15}; do
  curl -X POST https://staging.gracefulbooks.com/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{
      "email": "test@example.com",
      "password": "wrong-password"
    }'
done

# Expected: Medium alert triggered after 10 attempts
# Check: Slack #security channel for alert
```

### Test Authorization Failure Alert

```typescript
// In your test suite
import { logAuthorizationFailure } from '@/utils/securityLogger'

// Generate 25 authorization failures
for (let i = 0; i < 25; i++) {
  await logAuthorizationFailure(
    'test-user-id',
    'test-company-id',
    {
      resourceType: 'account',
      resourceId: `account-${i}`,
      requestedAction: 'read',
      reason: 'forbidden',
    },
    db
  )
}

// Expected: Medium alert triggered after 20 failures
// Check: Slack #security channel for alert
```

### Test Rate Limit Alert

```bash
# Trigger rate limits (in staging!)
for i in {1..60}; do
  curl https://staging.gracefulbooks.com/api/some-endpoint &
done

# Expected: Medium alert triggered after 10 violations
# Check: Slack #security channel for alert
```

### Test PagerDuty Integration

```bash
# Send test incident
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-Type: application/json' \
  -d '{
    "routing_key": "YOUR_INTEGRATION_KEY",
    "event_action": "trigger",
    "dedup_key": "security-monitoring-test",
    "payload": {
      "summary": "Test: Security Monitoring Alert",
      "source": "security-monitoring-test",
      "severity": "critical",
      "custom_details": {
        "event_type": "test",
        "count": 999
      }
    }
  }'

# Expected: PagerDuty notification (email/SMS/app)

# Resolve test incident
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-Type: application/json' \
  -d '{
    "routing_key": "YOUR_INTEGRATION_KEY",
    "event_action": "resolve",
    "dedup_key": "security-monitoring-test"
  }'
```

---

## Security Dashboard

### Access

**URL:** `https://gracefulbooks.com/monitoring/security-dashboard.html`

**Features:**
- Real-time security event counts
- 24-hour trends
- Event distribution chart
- Status indicators
- Auto-refresh every 60 seconds

### Metrics Displayed

| Metric | Description | Warning Threshold | Critical Threshold |
|--------|-------------|-------------------|-------------------|
| **Total Events** | All security events | 100/day | 500/day |
| **Failed Logins** | Failed login attempts | 50/day | 200/day |
| **Auth Failures** | Authorization failures | 100/day | 400/day |
| **Rate Limits** | Rate limit violations | 50/day | 200/day |
| **Suspicious** | Suspicious activity | 10/day | 50/day |
| **Lockouts** | Account lockouts | 5/day | 20/day |

### Status Indicators

- 🟢 **Green:** Normal - Within acceptable limits
- 🟡 **Yellow:** Warning - Approaching threshold
- 🔴 **Red:** Critical - Threshold exceeded

---

## Runbooks

### High Failed Login Rate

**Alert:** "Critical: High Failed Login Rate"

**Symptoms:**
- 50+ failed logins per minute
- Possible brute force attack

**Investigation:**
1. Check dashboard for affected users/IPs
2. Query audit log for patterns:
   ```sql
   SELECT ip_address, COUNT(*)
   FROM audit_logs
   WHERE action = 'FAILED_LOGIN'
   AND timestamp > NOW() - INTERVAL '1 hour'
   GROUP BY ip_address
   ORDER BY COUNT(*) DESC
   LIMIT 10;
   ```
3. Identify attack type:
   - Single IP = targeted brute force
   - Multiple IPs = distributed attack
   - Single user = credential stuffing

**Mitigation:**
1. **Immediate:** Enable temporary IP blocking in Cloudflare
2. **Short-term:** Increase rate limits temporarily
3. **Long-term:** Review and adjust rate limiting rules

**Prevention:**
- Enable CAPTCHA after N failed attempts
- Implement account lockout after M attempts
- Use Cloudflare Bot Management

### High Authorization Failure Rate

**Alert:** "Critical: High Authorization Failure Rate"

**Symptoms:**
- 100+ authorization failures per minute
- Possible IDOR attack or enumeration

**Investigation:**
1. Check which resources are being accessed
2. Identify user pattern:
   ```sql
   SELECT user_id, entity_type, COUNT(*)
   FROM audit_logs
   WHERE action = 'AUTHORIZATION_FAILURE'
   AND timestamp > NOW() - INTERVAL '1 hour'
   GROUP BY user_id, entity_type
   ORDER BY COUNT(*) DESC;
   ```
3. Check for sequential ID enumeration

**Mitigation:**
1. **Immediate:** Temporarily suspend user account
2. **Short-term:** Review access logs for data breach
3. **Long-term:** Implement UUIDs for all IDs (already done)

**Prevention:**
- Use UUIDs instead of sequential IDs ✓
- Implement proper authorization checks ✓
- Rate limit per-user API calls

### High Rate Limit Violations

**Alert:** "Critical: High Rate Limit Violation Rate"

**Symptoms:**
- 50+ rate limit violations per minute
- Possible DoS or scraping attempt

**Investigation:**
1. Check IP addresses and user agents
2. Identify pattern:
   - Single IP = single attacker
   - Multiple IPs = distributed attack
   - Specific endpoint = targeted scraping

**Mitigation:**
1. **Immediate:** Block IPs in Cloudflare WAF
2. **Short-term:** Enable "Under Attack" mode
3. **Long-term:** Review rate limit configuration

**Prevention:**
- Use Cloudflare Rate Limiting
- Implement adaptive rate limiting
- Use Bot Management for automation detection

---

## Maintenance

### Daily

- ✓ Auto-collected (no manual action)
- Security dashboard auto-refreshes
- Alerts evaluated in real-time

### Weekly

- [ ] Review alert frequency (Monday)
- [ ] Check for false positives
- [ ] Verify no critical security events
- [ ] Review suspicious activity log

### Monthly

- [ ] Adjust alert thresholds based on data
- [ ] Review security trends
- [ ] Update runbooks if needed
- [ ] Test alert delivery

### Quarterly

- [ ] Major security review
- [ ] Team training on runbooks
- [ ] Penetration testing
- [ ] Update security documentation

---

## Troubleshooting

### Alerts Not Firing

**Problem:** Expected security alert not received

**Checks:**
1. Verify thresholds in `monitoring/alerts/thresholds.yml`
2. Check security monitor is running:
   ```typescript
   // In your logs
   console.log('Starting security event monitor...')
   console.log('Checking security events...')
   ```
3. Verify Slack webhook works:
   ```bash
   curl -X POST $SLACK_WEBHOOK_SECURITY \
     -H 'Content-Type: application/json' \
     -d '{"text":"Test alert"}'
   ```
4. Check PagerDuty integration:
   ```bash
   # Send test event (see Testing Alerts section)
   ```
5. Review deduplication settings (may be throttled)

**Fix:**
- Lower thresholds if too high
- Verify environment variables set
- Check alert routing configuration
- Review logs for errors

### Dashboard Not Loading

**Problem:** Security dashboard shows errors or blank

**Checks:**
1. Verify dashboard deployed:
   ```bash
   curl https://gracefulbooks.com/monitoring/security-dashboard.html
   ```
2. Check metrics endpoint:
   ```bash
   curl https://gracefulbooks.com/metrics/security?hours=24
   ```
3. Check browser console for errors
4. Verify CORS configuration

**Fix:**
- Redeploy dashboard
- Verify metrics endpoint CORS allows origin
- Check API authentication
- Clear browser cache

### Metrics Not Updating

**Problem:** Dashboard shows stale data

**Checks:**
1. Verify security events being logged
2. Check database connectivity
3. Verify metrics collector running
4. Check for errors in logs

**Fix:**
- Verify `securityLogger` is being called
- Check database queries
- Restart monitoring service
- Review error logs

---

## Cost Summary

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Sentry | Free/Team | $0 - $26 |
| UptimeRobot | Free/Pro | $0 - $7 |
| PagerDuty | Professional | $21/user |
| Slack | Free | $0 |
| **Total** | | **$21/user** |

**Budget-Friendly Alternatives:**
- **Better Stack:** Free tier (10 monitors)
- **Uptime Kuma:** Self-hosted (free)
- **Alertmanager:** Self-hosted (free)

---

## Related Documentation

- [Main Monitoring README](./README.md)
- [Alert Thresholds Configuration](./alerts/thresholds.yml)
- [Alert Routing](./alerts/alert-routing.ts)
- [Security Event Logging](../src/utils/securityLogger.ts)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- [Runbooks](./runbooks/)

---

## Support

**Questions?**
- Check this guide first
- Review [monitoring/README.md](./README.md)
- Ask in #security Slack channel

**Security Incident?**
- Follow runbooks in [monitoring/runbooks/](./runbooks/)
- Escalate via PagerDuty
- Contact security@gracefulbooks.com

**Improvements?**
- Create GitHub issue with `security` label
- Propose threshold adjustments
- Share lessons learned

---

**Version:** 1.0
**Last Updated:** 2026-02-23
**Owner:** Security & DevOps Teams
**Next Review:** 2026-03-23
