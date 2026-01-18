# Monitoring & Alerting - Graceful Books

## Overview

Comprehensive monitoring and alerting infrastructure for Graceful Books, providing real-time visibility into system health, performance, and user experience.

**Philosophy:** Know about problems before your users do. Monitoring is your early warning system.

---

## Quick Links

- **Health Dashboard:** [monitoring/dashboards/health-dashboard.html](./dashboards/health-dashboard.html)
- **On-Call Schedule:** [ON_CALL_SCHEDULE.md](./ON_CALL_SCHEDULE.md)
- **Alert Thresholds:** [alerts/thresholds.yml](./alerts/thresholds.yml)
- **Runbooks:** [runbooks/](./runbooks/)

### External Services

- **Sentry (Error Tracking):** https://sentry.io/graceful-books
- **UptimeRobot:** https://uptimerobot.com (configure with [config/uptime-monitoring.yml](./config/uptime-monitoring.yml))
- **Cloudflare Analytics:** https://dash.cloudflare.com
- **PagerDuty:** https://graceful-books.pagerduty.com

---

## Monitoring Stack

### 1. Application Performance Monitoring (APM)

**Cloudflare Workers Analytics**
- Built into Workers platform
- Tracks request volume, latency, errors
- Real-time metrics with < 1 minute delay
- No additional cost

**Implementation:** [config/analytics.ts](./config/analytics.ts)

**Metrics Tracked:**
- Response time (p50, p95, p99)
- Error rate (by endpoint, region, status code)
- Throughput (requests/min)
- Sync operation performance
- Database query performance
- Cache hit rate

### 2. Error Tracking

**Sentry**
- Captures all JavaScript and API errors
- Source maps for debugging
- User context (privacy-safe, ID only)
- Session replay for critical errors
- Performance monitoring

**Implementation:** [config/sentry.ts](./config/sentry.ts)

**Features:**
- Automatic error capture
- PII/sensitive data filtering
- Breadcrumb trail for debugging
- Release tracking
- Error grouping and deduplication

### 3. Uptime Monitoring

**External Monitoring (UptimeRobot recommended)**
- Checks from multiple global locations
- SSL certificate monitoring
- DNS resolution monitoring
- Transaction monitoring (user flows)

**Configuration:** [config/uptime-monitoring.yml](./config/uptime-monitoring.yml)

**Monitors:**
- Frontend application
- Sync relay (US, EU, AP regions)
- API health endpoints
- SSL certificates
- DNS resolution

### 4. Alert Routing

**Multi-Channel Alerting**
- PagerDuty for critical alerts
- Slack for engineering team
- Email for low-priority
- Custom webhooks for integrations

**Implementation:** [alerts/alert-routing.ts](./alerts/alert-routing.ts)

**Features:**
- Severity-based routing
- Intelligent deduplication
- Throttling to prevent alert fatigue
- Escalation paths
- Aggregation windows

---

## Key Metrics

### SLA Metrics

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Uptime (30d) | 99.9% | < 99.5% | < 99.0% |
| Response Time (p95) | < 1000ms | > 2000ms | > 3000ms |
| Error Rate | < 0.1% | > 1% | > 5% |
| Database Query (p95) | < 100ms | > 300ms | > 500ms |

### Performance Metrics

**Response Time:**
- Frontend page load: < 2s (target), < 3s (acceptable)
- API response: < 500ms (target), < 1s (acceptable)
- Sync operation: < 1s (target), < 2s (acceptable)

**Throughput:**
- Expected: 100-1000 requests/minute
- Alert if: < 10 rpm (possible outage)
- Alert if: > 5000 rpm (possible attack)

**Error Rate:**
- Target: < 0.1%
- Warning: > 1%
- Critical: > 5%

---

## Alert Severity Levels

### Critical (Severity 1)

**Definition:** Complete service outage or data loss

**Response Time:** < 5 minutes, 24/7

**Examples:**
- All regions down
- Database completely unavailable
- Data loss detected
- Security breach

**Routing:** PagerDuty + Slack (immediate)

### High (Severity 2)

**Definition:** Significant degradation affecting users

**Response Time:** < 15 minutes, extended hours

**Examples:**
- One region down
- Error rate > 5%
- Database degraded
- Sync failures

**Routing:** Slack + Email

### Medium (Severity 3)

**Definition:** Minor degradation, potential future issue

**Response Time:** < 4 hours, business hours

**Examples:**
- Slow response time
- Cache hit rate low
- Queue backing up
- SSL expiring soon

**Routing:** Slack only

### Low (Severity 4)

**Definition:** Informational, no immediate action

**Response Time:** < 24 hours, business hours

**Examples:**
- Performance slightly degraded
- Non-critical service warning

**Routing:** Email only

---

## Getting Started

### For Developers

1. **Install Sentry SDK:**
   ```bash
   npm install @sentry/browser
   ```

2. **Initialize in your app:**
   ```typescript
   import { initializeSentry } from '@/monitoring/config/sentry';

   initializeSentry({
     dsn: import.meta.env.VITE_SENTRY_DSN,
     environment: import.meta.env.MODE,
     release: __APP_VERSION__,
   });
   ```

3. **Capture errors:**
   ```typescript
   import { captureError } from '@/monitoring/config/sentry';

   try {
     await riskyOperation();
   } catch (error) {
     captureError(error, {
       tags: { operation: 'sync' },
       level: 'error',
     });
   }
   ```

### For DevOps

1. **Set up external monitoring:**
   - Create UptimeRobot account
   - Import monitors from [config/uptime-monitoring.yml](./config/uptime-monitoring.yml)
   - Configure alert contacts

2. **Set up PagerDuty:**
   - Create service integration
   - Configure escalation policy
   - Add to alert routing

3. **Set up Slack integration:**
   - Create webhook URL
   - Add to environment variables
   - Test alert delivery

4. **Deploy monitoring:**
   ```bash
   # Analytics deployed with Workers
   cd relay
   wrangler deploy --env production

   # Sentry configured in frontend
   # Set VITE_SENTRY_DSN in environment
   ```

### For On-Call Engineers

1. **Review documentation:**
   - Read [ON_CALL_SCHEDULE.md](./ON_CALL_SCHEDULE.md)
   - Review runbooks in [runbooks/](./runbooks/)
   - Test PagerDuty notifications

2. **Access checklist:**
   - [ ] PagerDuty app installed
   - [ ] Slack notifications enabled
   - [ ] Can access Cloudflare dashboard
   - [ ] Can access Turso dashboard
   - [ ] Can access Sentry
   - [ ] Can run rollback script
   - [ ] Emergency contacts saved

3. **Test response:**
   - Trigger test alert
   - Verify PagerDuty notification
   - Verify Slack notification
   - Practice using runbooks

---

## Dashboards

### System Health Dashboard

**Location:** [dashboards/health-dashboard.html](./dashboards/health-dashboard.html)

**Metrics Displayed:**
- Overall system status
- Uptime percentage
- Error rate
- Response time (avg, p95, p99)
- Throughput
- Database health
- Regional status
- Recent alerts
- SLA compliance

**Auto-refresh:** Every 60 seconds

### Cloudflare Analytics

**Location:** https://dash.cloudflare.com

**Metrics Available:**
- Request volume
- Bandwidth usage
- Status codes
- Top endpoints
- Geographic distribution
- Cache hit rate
- Security events

### Sentry Dashboard

**Location:** https://sentry.io/graceful-books

**Views:**
- Error frequency
- Error distribution
- Affected users
- Performance issues
- Release health
- Session replays

---

## Runbooks

Critical incident runbooks:

1. **[Service Outage](./runbooks/RUNBOOK_SERVICE_OUTAGE.md)** - Complete outage response
2. **[High Error Rate](./runbooks/RUNBOOK_HIGH_ERROR_RATE.md)** - Error rate troubleshooting
3. **High Response Time** - Performance degradation (TBD)
4. **Database Issues** - Database connectivity and performance (TBD)
5. **Deployment Rollback** - How to rollback safely (TBD)
6. **DDoS Attack** - Attack mitigation (TBD)

**All runbooks include:**
- Quick triage steps
- Investigation procedures
- Common causes and solutions
- Escalation paths
- Post-incident checklist

---

## Alert Thresholds

See [alerts/thresholds.yml](./alerts/thresholds.yml) for complete configuration.

**Threshold Tuning:**
- Review alert frequency weekly
- Adjust thresholds monthly based on historical data
- Aim for < 5 alerts per week during normal operation
- Each alert should be actionable

**Alert Fatigue Prevention:**
- Intelligent deduplication (5 min window)
- Aggregation of similar alerts
- Throttling (max alerts per hour)
- Maintenance window suppression

---

## Metrics Collection

### Response Time Tracking

```typescript
import { MetricsManager } from '@/monitoring/config/metrics-collector';

const metrics = new MetricsManager();

// Track request
const timer = metrics.responseTime.startRequest();
await handleRequest(request);
const duration = timer.end('/api/sync', {
  method: 'POST',
  status: 200,
  region: 'us-east',
});
```

### Error Rate Tracking

```typescript
// Record request outcome
metrics.errorRate.recordRequest('/api/sync', isError);

// Get current error rate
const errorRate = metrics.errorRate.getErrorRate('/api/sync');
```

### Business Metrics

```typescript
// Track sync operation
metrics.business.recordSyncOperation(
  duration,
  itemCount,
  success
);

// Track database query
metrics.business.recordDatabaseQuery(
  'select',
  duration,
  rowCount
);
```

---

## Sync Relay Monitoring

Specialized monitoring for sync relay operations:

**Implementation:** [relay/src/monitoring/sync-relay-monitor.ts](../relay/src/monitoring/sync-relay-monitor.ts)

**Metrics:**
- Active connections
- Sync operations per minute
- Average sync duration
- Data synced (MB)
- Queue depth
- Error count

**Health Checks:**
- Database connectivity
- Queue health
- Error rate
- Performance

**Alerts:**
- Slow sync operations (> 5s)
- Sync failures
- High queue depth (> 100)
- Low active connections (< 5)

---

## Integration Guide

### Adding New Metrics

1. **Define metric:**
   ```typescript
   import { MetricsCollector } from '@/monitoring/config/metrics-collector';

   const collector = new MetricsCollector();
   collector.record('custom_metric', value, { tag: 'value' });
   ```

2. **Add to dashboard:**
   - Update [dashboards/health-dashboard.html](./dashboards/health-dashboard.html)
   - Fetch from metrics endpoint
   - Display in appropriate widget

3. **Configure alerts:**
   - Add threshold to [alerts/thresholds.yml](./alerts/thresholds.yml)
   - Add routing rule to [alerts/alert-routing.ts](./alerts/alert-routing.ts)

### Adding New Alerts

1. **Create alert:**
   ```typescript
   import { createAlert } from '@/monitoring/alerts/alert-routing';

   const alert = createAlert(
     'Alert Title',
     'Alert description',
     'critical',
     'source-name',
     { metadata: 'value' }
   );
   ```

2. **Route alert:**
   ```typescript
   import { AlertRouter, defaultAlertRoutes } from '@/monitoring/alerts/alert-routing';

   const router = new AlertRouter(defaultAlertRoutes);
   await router.route(alert);
   ```

3. **Configure routing:**
   - Edit routing rules in [alerts/alert-routing.ts](./alerts/alert-routing.ts)
   - Test alert delivery
   - Document in runbook

---

## Testing Monitoring

### Test Alert Routing

```bash
# Test Slack webhook
curl -X POST $SLACK_WEBHOOK_ENGINEERING \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test alert from monitoring system"}'

# Test PagerDuty integration
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-Type: application/json' \
  -d '{
    "routing_key": "YOUR_INTEGRATION_KEY",
    "event_action": "trigger",
    "payload": {
      "summary": "Test alert",
      "source": "monitoring-test",
      "severity": "info"
    }
  }'
```

### Test Error Tracking

```typescript
// Trigger test error in Sentry
import * as Sentry from '@sentry/browser';

Sentry.captureMessage('Test error from monitoring', 'info');
```

### Test Uptime Monitoring

1. Go to UptimeRobot dashboard
2. Click "Test" on each monitor
3. Verify notifications received

---

## Troubleshooting

### Alerts Not Firing

**Check:**
1. Alert routing configuration
2. Threshold values
3. Metrics being collected
4. Integration credentials (Slack webhook, PagerDuty key)

**Debug:**
```typescript
// Check metrics collection
const summary = metrics.getSummary();
console.log(summary);

// Check alert routing
await router.route(testAlert);
// Check logs for routing errors
```

### Too Many Alerts

**Actions:**
1. Review alert frequency in past week
2. Identify most common alerts
3. Adjust thresholds in [alerts/thresholds.yml](./alerts/thresholds.yml)
4. Add deduplication or aggregation
5. Suppress during known maintenance

### Missing Metrics

**Check:**
1. Analytics integration configured
2. Metrics collector initialized
3. Metrics being recorded
4. Data retention settings

---

## Maintenance

### Weekly Tasks

- [ ] Review alert frequency
- [ ] Check for false positives
- [ ] Verify uptime percentage
- [ ] Review error trends

### Monthly Tasks

- [ ] Adjust alert thresholds based on data
- [ ] Review runbooks for accuracy
- [ ] Test disaster recovery procedures
- [ ] Update on-call schedule

### Quarterly Tasks

- [ ] Major threshold review
- [ ] Team training on runbooks
- [ ] Monitoring infrastructure audit
- [ ] Cost optimization review

---

## Cost

### Included (No Additional Cost)

- Cloudflare Workers Analytics (built-in)
- Cloudflare Dashboard metrics
- Health check endpoints

### Paid Services

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Sentry | Team Plan | $26 (estimated) |
| UptimeRobot | Pro Plan | $7 (50 monitors) |
| PagerDuty | Professional | $21/user |
| **Total** | | **~$54 + $21/user** |

**Budget-Friendly Alternatives:**
- Better Stack (free tier: 10 monitors)
- Uptime Kuma (self-hosted, free)
- Sentry (free tier: 5K errors/month)

---

## Support

**Questions?**
- Check runbooks first
- Ask in #devops Slack channel
- Review this README
- Check external service documentation

**Issues?**
- Create GitHub issue
- Tag with `monitoring` label
- Include logs and metrics

**Emergencies?**
- Follow on-call procedures
- Use PagerDuty escalation
- Don't hesitate to escalate

---

## Related Documentation

- [Infrastructure Documentation](../docs/INFRASTRUCTURE.md)
- [Deployment Runbook](../docs/DEPLOYMENT_RUNBOOK.md)
- [Disaster Recovery](../Roadmaps/BACKUP_DISASTER_RECOVERY.md)
- [On-Call Schedule](./ON_CALL_SCHEDULE.md)

---

**Last Updated:** 2026-01-18
**Owner:** DevOps Team
**Next Review:** 2026-02-18
