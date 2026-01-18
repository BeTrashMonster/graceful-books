# Runbook: Complete Service Outage

## Alert Details

**Alert Name:** Service Down / Complete Outage
**Severity:** Critical (Severity 1)
**Threshold:** Health check failures > 3 consecutive, or uptime < 50%
**Response Time:** < 5 minutes

---

## ⚠️ CRITICAL INCIDENT - IMMEDIATE ACTION REQUIRED

This runbook is for **complete service outages** where users cannot access Graceful Books at all.

**Every minute counts.** Follow steps in order without deviation unless you're certain of the issue.

---

## Immediate Actions (First 60 Seconds)

### 1. Acknowledge & Communicate (15 seconds)

```
1. Acknowledge PagerDuty alert
2. Post in #incidents Slack:
   "🚨 CRITICAL: Investigating complete service outage. Will update every 5 min."
3. Update status page (if available)
```

### 2. Verify Outage (30 seconds)

Test from multiple locations:

```bash
# Test main site
curl -I https://gracefulbooks.com

# Test sync relay
curl -I https://sync.gracefulbooks.com/health

# Test all regions
curl -I https://sync-us.gracefulbooks.com/health
curl -I https://sync-eu.gracefulbooks.com/health
curl -I https://sync-ap.gracefulbooks.com/health
```

**Determine:**
- Is it completely down or partially down?
- All regions or specific regions?
- Frontend, backend, or both?

### 3. Page Secondary Immediately (15 seconds)

```
For complete outages, page secondary on-call immediately:
- Don't wait the standard 10 minutes
- In Slack: @oncall-secondary
- In PagerDuty: Escalate to secondary
```

---

## Investigation Timeline

### Minute 1-2: Quick Diagnostics

#### Check Infrastructure Status

```bash
# Cloudflare status
open https://www.cloudflarestatus.com

# Turso status
open https://status.turso.tech

# GitHub status
open https://www.githubstatus.com
```

**If external outage detected:**
- Post update in #incidents
- Monitor vendor status page
- Notify leadership
- Wait for vendor resolution (nothing we can do)

#### Check Recent Deployments

```bash
# Last 5 deployments
gh run list --limit 5

# Check if deployment is in progress
gh run list --status in_progress

# Check last deployment time
gh run view --web
```

**If deployment within last 30 minutes:** Likely deployment issue, proceed to rollback.

### Minute 2-5: Determine Root Cause

#### Scenario A: Recent Deployment (Most Common)

**Indicators:**
- Deployment within last 30 minutes
- Outage started right after deployment
- GitHub Actions shows successful deploy

**Action:** Immediately rollback

```bash
cd /path/to/graceful_books

# Quick rollback
./scripts/rollback.sh

# Select component (workers/pages/both)
# Choose previous version
# Confirm immediately

# Update #incidents
"🔄 Rolling back to previous version..."
```

**Skip to Verification section below.**

#### Scenario B: DNS/Cloudflare Issue

**Indicators:**
- DNS resolution fails
- Cloudflare dashboard shows errors
- All regions affected equally

**Action:** Check Cloudflare

```bash
# Check DNS
nslookup gracefulbooks.com
dig gracefulbooks.com

# Check Cloudflare dashboard
open https://dash.cloudflare.com

# Check for:
# - Zone suspended
# - DNS records deleted
# - Workers disabled
# - Pages deployment failed
```

**Fix:**
- If DNS issue: Verify DNS records
- If zone issue: Contact Cloudflare support
- If workers disabled: Re-enable in dashboard

#### Scenario C: Database Complete Failure

**Indicators:**
- Frontend loads but can't fetch data
- "Database connection failed" errors
- All API calls returning 500

**Action:** Check Database

```bash
# Check Turso dashboard
open https://turso.tech/app

# Test connection
turso db shell graceful-books-prod --execute "SELECT 1"

# Check primary region
turso db show graceful-books-prod

# Check replicas
turso db replica list graceful-books-prod
```

**Fix:**
- If database down: Contact Turso support immediately
- If connection issue: Verify secrets are correct
- If replica issue: Switch to primary region only

#### Scenario D: Cloudflare Workers Hit Limit

**Indicators:**
- Workers returning 503
- Cloudflare dashboard shows CPU time exceeded
- "Worker exceeded CPU limit" errors

**Action:** Check Workers

```bash
# Check worker logs
wrangler tail --env production

# Check CPU time
# Should be < 50ms, if hitting 50ms consistently, that's the issue

# Check requests per second
# Workers paid plan: 100,000 req/sec limit
```

**Fix:**
- If CPU limit: Optimize worker code or scale up
- If request limit: Contact Cloudflare to increase limit
- Emergency: Disable expensive features temporarily

#### Scenario E: SSL Certificate Issue

**Indicators:**
- SSL/TLS errors
- Certificate expired or invalid
- Browser shows security warnings

**Action:** Check Certificates

```bash
# Check certificate
echo | openssl s_client -connect gracefulbooks.com:443 -servername gracefulbooks.com 2>/dev/null | openssl x509 -noout -dates

# Check Cloudflare SSL settings
open https://dash.cloudflare.com
# Navigate to SSL/TLS section
```

**Fix:**
- Should auto-renew, but if expired:
- Disable "Always Use HTTPS" temporarily
- Issue new certificate in Cloudflare
- Re-enable "Always Use HTTPS"

---

## Minute 5-10: Resolution

### If Rollback Performed

**Monitor rollback progress:**

```bash
# Watch deployment
gh run watch

# Check health after deploy completes
watch -n 5 'curl -s https://gracefulbooks.com/health'

# Should return healthy within 2-3 minutes
```

**Update #incidents every 2 minutes:**
```
Min 5: "Rollback in progress, deployment running..."
Min 7: "Rollback complete, testing health checks..."
Min 9: "Health checks passing, monitoring for stability..."
```

### If Other Fix Applied

Test and verify:

```bash
# Test frontend
curl -I https://gracefulbooks.com
# Should return 200

# Test API
curl https://sync.gracefulbooks.com/health
# Should return {"status":"healthy"}

# Test all regions
for region in us eu ap; do
  echo "Testing sync-$region..."
  curl https://sync-$region.gracefulbooks.com/health
done

# All should return healthy
```

---

## Minute 10-15: Verification

### Full System Test

```bash
# 1. Frontend loads
open https://gracefulbooks.com

# 2. API responds
curl https://sync.gracefulbooks.com/health

# 3. Database accessible
curl https://sync.gracefulbooks.com/metrics/sla

# 4. All regions healthy
curl https://sync-us.gracefulbooks.com/health
curl https://sync-eu.gracefulbooks.com/health
curl https://sync-ap.gracefulbooks.com/health

# 5. Error rate normal
curl https://sync.gracefulbooks.com/metrics/sla | jq .errorRate
# Should be < 1%
```

### Monitor Metrics

```bash
# Watch for 10 minutes
watch -n 30 'curl -s https://sync.gracefulbooks.com/metrics/sla'

# Look for:
# - Error rate < 1%
# - Response time < 500ms
# - Uptime recovering
```

---

## Resolution Communication

### Update Incident Channel

```
✅ SERVICE RESTORED

Outage Duration: [X] minutes
Root Cause: [Brief description]
Resolution: [What was done]

Current Status:
- All regions: ✅ Healthy
- Error rate: [X%]
- Response time: [X]ms

Monitoring for next 30 minutes for stability.
Post-incident report to follow within 24 hours.
```

### Update Status Page

```
All Systems Operational

We experienced a service outage from [TIME] to [TIME] UTC.
The issue has been resolved and all systems are operating normally.
We apologize for the inconvenience.
```

### Notify Leadership

If outage > 15 minutes:
```
Subject: Service Outage Resolved - [DURATION] minutes

Executive Summary:
- Outage start: [TIME]
- Outage end: [TIME]
- Duration: [X] minutes
- Root cause: [BRIEF]
- User impact: [ESTIMATE]
- Resolution: [BRIEF]

Full incident report will be available within 24 hours.
```

---

## Post-Incident (Within 24 Hours)

### 1. Create Detailed Incident Report

Use template: `docs/templates/incident-report.md`

**Required sections:**
- Timeline (minute-by-minute)
- Root cause analysis (5 whys)
- User impact estimate
- What went well
- What went wrong
- Action items to prevent recurrence

### 2. Schedule Post-Mortem Meeting

**Attendees:**
- On-call engineers (primary + secondary)
- Engineering lead
- Anyone else involved

**Agenda:**
- Walk through timeline
- Discuss root cause
- Brainstorm preventive measures
- Assign action items

**Rules:**
- No blame
- Focus on systems, not people
- What can we improve?

### 3. Implement Preventive Measures

**Common action items:**
- Add monitoring for early detection
- Add automated rollback triggers
- Improve deployment checks
- Add circuit breakers
- Improve runbooks
- Add automated tests

---

## Escalation Rules

### Immediate Escalation (Don't Wait)

**Escalate to Engineering Lead if:**
- Service down > 15 minutes
- You don't know how to fix it
- Database is completely lost
- Security breach suspected

**Escalate to CTO if:**
- Service down > 30 minutes
- Data loss occurred
- Major security incident
- Media attention likely

### How to Escalate

```bash
# Engineering Lead
@engineering-lead in Slack + PagerDuty page

# CTO
@cto in Slack + Phone call (emergency contact list)

# Include in escalation:
- Current status (still down/partially down)
- What you've tried
- Current error rate/metrics
- Estimated user impact
```

---

## Special Scenarios

### Scenario: Disaster Recovery Needed

If infrastructure is completely lost:

```bash
# Follow disaster recovery runbook
./docs/BACKUP_DISASTER_RECOVERY.md

# This includes:
# - Restore from backup
# - Rebuild infrastructure from Terraform
# - Restore database from R2 backup
# - Estimated recovery time: 1-2 hours
```

### Scenario: DDoS Attack

If outage caused by attack:

```bash
# Enable "Under Attack Mode" in Cloudflare
# This adds JavaScript challenge to all visitors

# Or enable stricter WAF rules
# Or contact Cloudflare support for DDoS mitigation

# See: RUNBOOK_DDOS.md
```

### Scenario: Third-Party Outage

If Cloudflare or Turso is down:

```bash
# Not much we can do
# Monitor vendor status page
# Communicate with users
# Prepare statement for social media

# If extended outage:
# - Consider failover to backup provider (if implemented)
# - Keep users updated every 30 minutes
```

---

## Prevention Checklist

After each outage, review:

- [ ] Could we have detected this earlier?
- [ ] Could we have prevented this?
- [ ] Could we have recovered faster?
- [ ] Do we need better monitoring?
- [ ] Do we need better alerts?
- [ ] Do we need better automation?
- [ ] Do we need better documentation?
- [ ] Do we need better testing?

---

## Quick Reference

### Health Check Commands

```bash
# All-in-one health check
curl https://gracefulbooks.com && \
curl https://sync.gracefulbooks.com/health && \
curl https://sync-us.gracefulbooks.com/health && \
curl https://sync-eu.gracefulbooks.com/health && \
curl https://sync-ap.gracefulbooks.com/health

# One-liner for metrics
curl -s https://sync.gracefulbooks.com/metrics/sla | jq
```

### Rollback Command

```bash
./scripts/rollback.sh
```

### Useful Links

- Cloudflare Dashboard: https://dash.cloudflare.com
- Turso Dashboard: https://turso.tech/app
- Sentry: https://sentry.io/graceful-books
- GitHub Actions: https://github.com/graceful-books/graceful-books/actions
- Monitoring Dashboard: https://gracefulbooks.com/monitoring/dashboard

---

**Last Updated:** 2026-01-18
**Owner:** DevOps Team
**Review:** After every outage
**Next Review:** Monthly

---

## Remember

1. **Acknowledge immediately** (< 5 min)
2. **Communicate frequently** (every 5 min)
3. **Page secondary early** (don't wait)
4. **Rollback first, debug later** (when in doubt)
5. **Document everything** (timeline, actions, learnings)
