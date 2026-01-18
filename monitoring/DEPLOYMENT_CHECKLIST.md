# Monitoring & Alerting - Deployment Checklist

## Pre-Deployment Setup

### 1. External Services Setup

#### Sentry (Error Tracking)

- [ ] Create Sentry account at https://sentry.io
- [ ] Create new project: "Graceful Books"
- [ ] Select platform: "Browser (JavaScript)"
- [ ] Copy DSN (Data Source Name)
- [ ] Add DSN to environment variables:
  ```bash
  # .env.production
  VITE_SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[project]
  ```
- [ ] Configure project settings:
  - [ ] Enable source maps
  - [ ] Configure release tracking
  - [ ] Set up team notifications
- [ ] Invite team members
- [ ] Estimated cost: Free tier (5K errors/month) or $26/month (Team plan)

#### UptimeRobot or Better Stack (Uptime Monitoring)

**Option A: UptimeRobot (Recommended)**
- [ ] Create account at https://uptimerobot.com
- [ ] Import monitors from `monitoring/config/uptime-monitoring.yml`
- [ ] Configure monitors:
  - [ ] Frontend (https://gracefulbooks.com)
  - [ ] Sync Relay US (https://sync-us.gracefulbooks.com/health)
  - [ ] Sync Relay EU (https://sync-eu.gracefulbooks.com/health)
  - [ ] Sync Relay AP (https://sync-ap.gracefulbooks.com/health)
  - [ ] Sync Relay Global (https://sync.gracefulbooks.com/health)
  - [ ] SSL Certificate (gracefulbooks.com)
  - [ ] DNS Resolution (gracefulbooks.com)
- [ ] Configure alert contacts:
  - [ ] Email
  - [ ] Slack webhook
  - [ ] PagerDuty integration
- [ ] Estimated cost: Free tier (50 monitors) or $7/month (Pro plan)

**Option B: Better Stack**
- [ ] Create account at https://betterstack.com
- [ ] Similar setup as UptimeRobot
- [ ] Estimated cost: Free tier (10 monitors)

#### PagerDuty (Incident Management)

- [ ] Create PagerDuty account at https://www.pagerduty.com
- [ ] Create service: "Graceful Books - Production"
- [ ] Configure escalation policy:
  - [ ] Level 1: Primary on-call (5 min)
  - [ ] Level 2: Secondary on-call (10 min)
  - [ ] Level 3: Engineering lead (30 min)
- [ ] Create integration:
  - [ ] Copy integration key
  - [ ] Add to GitHub secrets: `PAGERDUTY_INTEGRATION_KEY`
- [ ] Install mobile app
- [ ] Test notification delivery
- [ ] Estimated cost: $21/user/month (Professional plan)

#### Slack Integration

- [ ] Create Slack workspace (or use existing)
- [ ] Create channels:
  - [ ] #incidents (for critical alerts)
  - [ ] #engineering (for all alerts)
  - [ ] #devops (for infrastructure)
- [ ] Create incoming webhook:
  - [ ] Go to https://api.slack.com/apps
  - [ ] Create new app
  - [ ] Enable Incoming Webhooks
  - [ ] Add webhook to workspace
  - [ ] Select #engineering channel
  - [ ] Copy webhook URL
  - [ ] Add to GitHub secrets: `SLACK_WEBHOOK_ENGINEERING`
- [ ] Test webhook:
  ```bash
  curl -X POST $SLACK_WEBHOOK_ENGINEERING \
    -H 'Content-Type: application/json' \
    -d '{"text":"Monitoring system test"}'
  ```
- [ ] Estimated cost: Free

### 2. Environment Variables

#### Frontend (.env.production)

```bash
# Sentry
VITE_SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[project]

# Environment
VITE_ENVIRONMENT=production
VITE_APP_VERSION=1.0.0
```

#### Worker (wrangler.toml or secrets)

```bash
# Set via wrangler secret
wrangler secret put SENTRY_DSN --env production
# Enter: https://[key]@[org].ingest.sentry.io/[project]

wrangler secret put SLA_ALERT_WEBHOOK --env production
# Enter: [Slack webhook URL or custom endpoint]
```

#### GitHub Secrets

```bash
# In GitHub repository settings > Secrets and variables > Actions

# Required:
PAGERDUTY_INTEGRATION_KEY=your_integration_key
SLACK_WEBHOOK_ENGINEERING=https://hooks.slack.com/services/...

# Optional:
SENTRY_AUTH_TOKEN=your_auth_token  # For release tracking
UPTIMEROBOT_API_KEY=your_api_key   # For API access
```

### 3. DNS and Certificates

- [ ] Verify DNS records exist:
  ```bash
  nslookup gracefulbooks.com
  nslookup sync.gracefulbooks.com
  nslookup sync-us.gracefulbooks.com
  nslookup sync-eu.gracefulbooks.com
  nslookup sync-ap.gracefulbooks.com
  ```
- [ ] Verify SSL certificates:
  ```bash
  echo | openssl s_client -connect gracefulbooks.com:443 -servername gracefulbooks.com 2>/dev/null | openssl x509 -noout -dates
  ```
- [ ] All should show valid, unexpired certificates

---

## Deployment Steps

### 1. Deploy Analytics with Workers

```bash
cd relay

# Deploy to production
wrangler deploy --env production

# Verify analytics endpoint
curl https://sync.gracefulbooks.com/metrics/sla

# Expected response:
# {
#   "uptime": 100,
#   "errorRate": 0,
#   "averageResponseTime": 150,
#   "totalRequests": 0
# }
```

### 2. Deploy Frontend with Sentry

```bash
cd /path/to/graceful_books

# Build with Sentry
npm run build

# Deploy to Cloudflare Pages
wrangler pages publish dist --project-name=graceful-books

# Verify Sentry is initialized
# Open browser console on https://gracefulbooks.com
# Should see: "[Sentry] SDK initialized"
```

### 3. Deploy Health Dashboard

```bash
# Copy dashboard to public directory
cp monitoring/dashboards/health-dashboard.html public/monitoring/

# Rebuild and deploy
npm run build
wrangler pages publish dist --project-name=graceful-books

# Verify dashboard
open https://gracefulbooks.com/monitoring/health-dashboard.html
```

### 4. Configure Uptime Monitoring

#### Manual Setup (UptimeRobot)

1. Log into UptimeRobot dashboard
2. Add monitors manually or import from YAML
3. Test each monitor (click "Test" button)
4. Verify alert contacts receive test notification

#### API Setup (Optional)

```bash
# Use UptimeRobot API to create monitors
# See: https://uptimerobot.com/api/

curl -X POST https://api.uptimerobot.com/v2/newMonitor \
  -H 'Content-Type: application/json' \
  -d '{
    "api_key": "YOUR_API_KEY",
    "format": "json",
    "type": 1,
    "url": "https://gracefulbooks.com",
    "friendly_name": "Graceful Books - Frontend"
  }'
```

### 5. Test Alert Routing

#### Test Slack Integration

```bash
# Send test alert to Slack
curl -X POST $SLACK_WEBHOOK_ENGINEERING \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "🧪 Test Alert: Monitoring system deployment",
    "attachments": [{
      "color": "#36a64f",
      "fields": [
        {"title": "Severity", "value": "Info", "short": true},
        {"title": "Source", "value": "Deployment", "short": true}
      ]
    }]
  }'
```

**Expected:** Message appears in #engineering Slack channel

#### Test PagerDuty Integration

```bash
# Send test incident to PagerDuty
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-Type: application/json' \
  -d '{
    "routing_key": "PAGERDUTY_INTEGRATION_KEY",
    "event_action": "trigger",
    "dedup_key": "monitoring-test-'$(date +%s)'",
    "payload": {
      "summary": "Test Alert: Monitoring Deployment",
      "source": "monitoring-deployment",
      "severity": "info"
    }
  }'
```

**Expected:** PagerDuty notification (email/SMS/app)

**Important:** Resolve test incident after testing:
```bash
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-Type: application/json' \
  -d '{
    "routing_key": "PAGERDUTY_INTEGRATION_KEY",
    "event_action": "resolve",
    "dedup_key": "monitoring-test-[timestamp]"
  }'
```

#### Test Sentry Error Tracking

```typescript
// In browser console on https://gracefulbooks.com
Sentry.captureMessage('Test error from monitoring deployment', 'info');
```

**Expected:** Error appears in Sentry dashboard

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# Frontend
curl -I https://gracefulbooks.com
# Expected: 200 OK

# Sync Relay (all regions)
for region in "" "-us" "-eu" "-ap"; do
  echo "Testing sync${region}.gracefulbooks.com..."
  curl https://sync${region}.gracefulbooks.com/health
done
# Expected: {"status":"healthy","database":"connected"}

# SLA Metrics
curl https://sync.gracefulbooks.com/metrics/sla
# Expected: Valid JSON with uptime, errorRate, averageResponseTime
```

### 2. Verify Monitoring Dashboard

```bash
# Open dashboard
open https://gracefulbooks.com/monitoring/health-dashboard.html

# Should display:
# - Overall system status
# - Performance metrics
# - Regional status
# - Auto-refresh every 60s
```

### 3. Verify Uptime Monitors

- [ ] Check UptimeRobot dashboard
- [ ] All monitors should be "Up" (green)
- [ ] Response times should be reasonable (< 1s)
- [ ] No alerts triggered

### 4. Verify Alert Routing

- [ ] Check #engineering Slack channel for test message
- [ ] Check PagerDuty for test incident (and resolve it)
- [ ] Check Sentry dashboard for test error

### 5. Verify Analytics Collection

```bash
# Generate some traffic
for i in {1..10}; do
  curl https://sync.gracefulbooks.com/health > /dev/null 2>&1
done

# Wait 2 minutes

# Check SLA metrics again
curl https://sync.gracefulbooks.com/metrics/sla

# Should show:
# - totalRequests > 0
# - uptime close to 100%
# - errorRate = 0
# - averageResponseTime populated
```

---

## Trigger Test Incident

### Simulate High Error Rate

**Purpose:** Test end-to-end alerting for error rate threshold

**Steps:**

1. **Generate errors** (in staging first!)
   ```bash
   # Trigger intentional errors
   for i in {1..50}; do
     curl https://sync-staging.gracefulbooks.com/nonexistent-endpoint
   done
   ```

2. **Wait 1-2 minutes** for metrics to aggregate

3. **Check dashboard:**
   ```bash
   curl https://sync-staging.gracefulbooks.com/metrics/sla
   # Should show elevated error rate
   ```

4. **Verify alert triggered:**
   - [ ] Check Slack #engineering channel
   - [ ] Should see alert: "High Error Rate"
   - [ ] Severity: High or Medium

5. **Resolve:**
   - Stop generating errors
   - Wait for error rate to normalize
   - Verify resolution notification (if configured)

### Simulate Slow Response Time

**Purpose:** Test performance degradation alerting

**Steps:**

1. **Simulate slow endpoint** (requires code change in staging)
   ```typescript
   // Add delay to staging worker
   await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
   ```

2. **Generate traffic:**
   ```bash
   for i in {1..20}; do
     curl https://sync-staging.gracefulbooks.com/health
   done
   ```

3. **Check metrics:**
   - Dashboard should show elevated response time
   - Alert should trigger if > threshold

4. **Resolve:**
   - Remove delay
   - Redeploy
   - Verify metrics return to normal

---

## Team Onboarding

### On-Call Engineers

- [ ] Add to PagerDuty escalation policy
- [ ] Add to #engineering and #incidents Slack channels
- [ ] Grant access to:
  - [ ] Cloudflare dashboard
  - [ ] Turso dashboard
  - [ ] Sentry dashboard
  - [ ] UptimeRobot dashboard
  - [ ] GitHub repository
- [ ] Share emergency contact information
- [ ] Schedule training session:
  - [ ] Review ON_CALL_SCHEDULE.md
  - [ ] Walk through runbooks
  - [ ] Practice with rollback script
  - [ ] Simulate incident response

### Developers

- [ ] Share Sentry documentation
- [ ] Demonstrate error capture
- [ ] Show how to add custom metrics
- [ ] Review privacy requirements (PII filtering)

### DevOps Team

- [ ] Grant admin access to all monitoring services
- [ ] Share alert threshold configuration
- [ ] Review weekly/monthly maintenance tasks
- [ ] Establish review schedule

---

## Monitoring Maintenance Schedule

### Daily (Automated)

- [ ] Metrics collected continuously
- [ ] Health checks every 60 seconds
- [ ] Alerts evaluated in real-time
- [ ] Dashboard auto-refreshes

### Weekly (Manual)

- [ ] Review alert frequency (Monday)
- [ ] Check for false positives
- [ ] Verify uptime percentage > 99.9%
- [ ] On-call handoff meeting

### Monthly (Manual)

- [ ] Adjust alert thresholds based on data
- [ ] Review error trends in Sentry
- [ ] Update runbooks if needed
- [ ] Test disaster recovery procedures
- [ ] Cost optimization review

### Quarterly (Manual)

- [ ] Major threshold review
- [ ] Team training on runbooks
- [ ] Monitoring infrastructure audit
- [ ] Architecture review
- [ ] Update on-call rotation

---

## Troubleshooting

### Alerts Not Firing

**Issue:** Expected alert not received

**Checks:**
1. Verify threshold values in `monitoring/alerts/thresholds.yml`
2. Check metric is being collected:
   ```bash
   curl https://sync.gracefulbooks.com/metrics/sla
   ```
3. Verify alert routing configuration
4. Test Slack webhook manually
5. Test PagerDuty integration manually
6. Check for deduplication/throttling

**Debug:**
```typescript
// Check metrics in browser console
const metrics = await fetch('https://sync.gracefulbooks.com/metrics/sla')
  .then(r => r.json());
console.log(metrics);
```

### Dashboard Not Loading

**Issue:** Health dashboard shows errors or doesn't load

**Checks:**
1. Verify dashboard deployed:
   ```bash
   curl https://gracefulbooks.com/monitoring/health-dashboard.html
   ```
2. Check browser console for errors
3. Verify metrics endpoint working:
   ```bash
   curl https://sync.gracefulbooks.com/metrics/sla
   ```
4. Check CORS configuration

**Fix:**
- Redeploy dashboard
- Verify metrics endpoint CORS allows frontend origin
- Clear browser cache

### Metrics Not Updating

**Issue:** Dashboard shows stale data

**Checks:**
1. Verify analytics middleware deployed with Worker
2. Check Worker logs:
   ```bash
   wrangler tail --env production
   ```
3. Verify Analytics Engine dataset exists
4. Check for Worker errors in Sentry

**Fix:**
- Redeploy Worker with analytics middleware
- Verify Analytics Engine binding in wrangler.toml
- Check Worker CPU time (may be hitting limits)

### Too Many Alerts

**Issue:** Alert fatigue from excessive notifications

**Actions:**
1. Review alert frequency:
   - Count alerts in past 7 days
   - Identify most common alerts
2. Adjust thresholds in `monitoring/alerts/thresholds.yml`
3. Increase deduplication windows
4. Add throttling limits
5. Review for false positives
6. Suppress during maintenance windows

**Example Adjustment:**
```yaml
# Before
error_rate:
  warning: 1%
  critical: 5%

# After (less sensitive)
error_rate:
  warning: 2%
  critical: 10%
```

---

## Rollback Procedures

### Rollback Analytics Changes

```bash
# Rollback Worker (includes analytics)
cd relay
./scripts/rollback.sh

# Select "Workers"
# Choose previous version
# Confirm
```

### Rollback Dashboard Changes

```bash
# Revert dashboard file
git checkout HEAD~1 monitoring/dashboards/health-dashboard.html

# Rebuild and deploy
npm run build
wrangler pages publish dist
```

### Disable Monitoring (Emergency)

**If monitoring itself is causing issues:**

```bash
# Remove analytics middleware from Worker
# Edit relay/src/index.ts
# Comment out withAnalytics() wrapper

# Redeploy
cd relay
wrangler deploy --env production

# Pause uptime monitors in UptimeRobot
# (prevents false alerts during incident)
```

---

## Success Criteria

After deployment, verify:

- [ ] **Health checks passing:** All regions returning "healthy"
- [ ] **Metrics collecting:** Dashboard shows live data
- [ ] **Alerts routing:** Test alerts delivered to all channels
- [ ] **Uptime monitors working:** All monitors green in UptimeRobot
- [ ] **Errors tracked:** Test errors appear in Sentry
- [ ] **Dashboard accessible:** Health dashboard loads and auto-refreshes
- [ ] **Team trained:** On-call engineers reviewed runbooks
- [ ] **Documentation complete:** All docs reviewed and accessible
- [ ] **No production alerts:** Clean deployment, no false positives

---

## Next Steps

After successful deployment:

1. **Week 1: Monitor Closely**
   - Check dashboard daily
   - Review all alerts
   - Adjust thresholds as needed
   - Gather feedback from team

2. **Week 2-4: Optimize**
   - Fine-tune alert thresholds
   - Reduce false positives
   - Add missing monitors
   - Update runbooks with real experiences

3. **Month 2: Enhance**
   - Add custom dashboards
   - Implement additional runbooks
   - Add user experience monitoring
   - Expand metrics collection

4. **Ongoing:**
   - Weekly alert reviews
   - Monthly threshold adjustments
   - Quarterly team training
   - Continuous improvement

---

## Support

**Questions during deployment?**
- Review this checklist
- Check [monitoring/README.md](./README.md)
- Ask in #devops Slack channel

**Issues found?**
- Create GitHub issue with `monitoring` label
- Include error logs and screenshots
- Tag DevOps team

**Emergency?**
- Follow on-call procedures
- Escalate via PagerDuty
- Don't hesitate to ask for help

---

**Checklist Version:** 1.0
**Last Updated:** 2026-01-18
**Next Review:** After first production deployment
