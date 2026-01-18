# Runbook: Complete Outage

**Severity:** P0 (Critical)
**Estimated Time:** 15-60 minutes
**Skills Required:** DevOps, Infrastructure

## Symptoms

- Application completely unavailable
- All users seeing 500, 502, 503, or timeout errors
- Health checks failing across all regions
- "Site can't be reached" or similar browser errors
- Multiple user reports simultaneously

## Impact

- **Users:** Cannot access application at all
- **Business:** Complete service interruption
- **Data:** No data loss (local-first architecture protects user data)
- **Revenue:** Potential customer churn, negative publicity

## Prerequisites

- Cloudflare Dashboard access
- Wrangler CLI installed and authenticated
- GitHub access
- Turso CLI access
- Slack access for communication

## Initial Response (< 5 minutes)

### 1. Acknowledge Incident

```bash
# Post to Slack immediately
# Channel: #incidents-critical
```

**Message Template:**
```
🚨 P0 INCIDENT: Complete Outage
Status: Investigating
Started: [TIME]
On-call: @[YOUR_NAME]
Updates: Every 15 minutes
```

### 2. Update Status Page

```bash
# Via Cloudflare Dashboard or API
# Set status to "Major Outage"
# Message: "We're experiencing a complete service outage. Investigating now."
```

### 3. Page All Hands

```bash
# Use PagerDuty, Slack, or phone
# Alert: CEO, CTO, Product Owner, All Engineers
```

## Investigation Steps (< 10 minutes)

### 4. Check Cloudflare Status

```bash
# Browser: https://www.cloudflarestatus.com
# Check if Cloudflare itself is down
```

**If Cloudflare is down:**
- This is a third-party outage
- Switch to [Third-Party Outage Runbook](./11-third-party-outage.md)
- Nothing we can do except communicate to users

### 5. Test Health Endpoints

```bash
# Test all sync regions
for region in us eu ap; do
  echo "=== Testing sync-$region ==="
  curl -v https://sync-$region.gracefulbooks.com/health
  echo ""
done

# Test main app
curl -v https://gracefulbooks.com

# Test with detailed timing
curl -w "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" \
  -o /dev/null -s https://sync.gracefulbooks.com/health
```

**Record:**
- Which endpoints are failing?
- What HTTP status codes?
- What error messages?
- DNS resolution working?
- TLS handshake succeeding?

### 6. Check Recent Deployments

```bash
# Check GitHub Actions
gh run list --limit 5

# Check Worker deployments
cd C:/Users/Admin/graceful_books/relay
wrangler deployments list --env production

# Check when last deployment occurred
git log --oneline -5
```

**Key Question:** Was there a deployment in last 2 hours?

### 7. Check Worker Logs

```bash
# Real-time logs
cd C:/Users/Admin/graceful_books/relay
wrangler tail --env production

# Look for:
# - Exception stack traces
# - Database connection errors
# - Uncaught errors
# - Missing environment variables
```

### 8. Check Database

```bash
# Test database connection
turso db shell graceful-books-sync --execute "SELECT 1"

# Check database status
turso db show graceful-books-sync

# Check replica health
turso db replicas list graceful-books-sync
```

## Resolution Steps

### Scenario A: Recent Deployment Broke Production

**If deployment within last 2 hours:**

```bash
# IMMEDIATE ROLLBACK
cd C:/Users/Admin/graceful_books

# Rollback Workers (fastest - do this first)
./scripts/rollback.sh workers production

# Wait 30 seconds, then verify
sleep 30
for region in us eu ap; do
  curl https://sync-$region.gracefulbooks.com/health | jq
done

# If Workers rollback successful, rollback Pages
./scripts/rollback.sh pages production

# Verify full recovery
curl https://gracefulbooks.com
```

**Post-Rollback:**
1. Verify health checks passing
2. Update status page: "Issue identified and rolled back"
3. Update Slack: "Rolled back to previous version"
4. Monitor for 15 minutes
5. Begin root cause analysis

### Scenario B: Database Connection Failure

**If seeing database connection errors in logs:**

```bash
# Check database status
turso db show graceful-books-sync

# Test direct connection
turso db shell graceful-books-sync --execute "SELECT COUNT(*) FROM sync_changes"

# Check if auth token expired
# Symptom: "authentication failed" errors

# If auth token expired, rotate it:
# 1. Create new token
NEW_TOKEN=$(turso db tokens create graceful-books-sync)

# 2. Update Worker secret
cd C:/Users/Admin/graceful_books/relay
echo "$NEW_TOKEN" | wrangler secret put TURSO_AUTH_TOKEN --env production

# 3. Force Worker restart (redeploy)
wrangler deploy --env production

# 4. Verify
curl https://sync.gracefulbooks.com/health | jq
```

### Scenario C: DNS or Certificate Issues

**If DNS not resolving or certificate errors:**

```bash
# Check DNS resolution
nslookup gracefulbooks.com
nslookup sync.gracefulbooks.com

# Check certificate
echo | openssl s_client -servername gracefulbooks.com -connect gracefulbooks.com:443 2>/dev/null | openssl x509 -noout -dates

# If DNS issues:
# 1. Log into Cloudflare Dashboard
# 2. Navigate to DNS settings
# 3. Verify A/AAAA/CNAME records
# 4. Check "Proxied" (orange cloud) is enabled

# If certificate issues:
# See runbook: ./10-certificate-issues.md
```

### Scenario D: Cloudflare Workers Error

**If Workers throwing uncaught exceptions:**

```bash
# Check Worker logs for stack traces
cd C:/Users/Admin/graceful_books/relay
wrangler tail --env production --format=json | jq 'select(.level == "error")'

# Common issues:
# 1. Missing environment variable
# 2. Syntax error in code
# 3. Runtime API change

# Quick fix: Rollback
./scripts/rollback.sh workers production

# If rollback doesn't work:
# Deploy last known good version
git checkout [last-good-commit]
wrangler deploy --env production
git checkout main
```

### Scenario E: Cloudflare Pages Error

**If Pages not serving:**

```bash
# Check Cloudflare Dashboard
# Pages > graceful-books > Deployments
# Look for failed builds or deployment errors

# Rollback Pages
cd C:/Users/Admin/graceful_books
./scripts/rollback.sh pages production

# If rollback doesn't work, manual deploy:
git checkout [last-good-commit]
npm ci
npm run build
npx wrangler pages deploy dist --project-name=graceful-books --branch=main
git checkout main

# Verify
curl https://gracefulbooks.com
```

### Scenario F: Cloudflare Platform Issue

**If Cloudflare itself is having issues:**

```bash
# Check status
# Browser: https://www.cloudflarestatus.com

# If Cloudflare confirms outage:
# 1. Nothing we can do
# 2. Communicate to users
# 3. Monitor Cloudflare status page
# 4. Wait for resolution
# 5. Verify recovery when Cloudflare reports fixed
```

## Verification (< 5 minutes)

### 9. Confirm All Health Checks Passing

```bash
# Test all regions
for region in us eu ap; do
  echo "=== $region ==="
  curl https://sync-$region.gracefulbooks.com/health | jq
  if [ $? -ne 0 ]; then
    echo "❌ $region still failing"
  else
    echo "✅ $region healthy"
  fi
done

# Test main app
curl -I https://gracefulbooks.com | head -1

# Should see: HTTP/2 200
```

### 10. Run Smoke Tests

```bash
# If smoke tests exist
npm run test:smoke:production

# Manual smoke test:
# 1. Open https://gracefulbooks.com in browser
# 2. Try to log in
# 3. Create a transaction
# 4. Verify sync working
```

### 11. Check Error Rate

```bash
# Should be near 0%
curl -s https://sync.gracefulbooks.com/metrics/sla | jq '.error_rate'

# If > 1%, keep investigating
```

### 12. Monitor for 15 Minutes

```bash
# Watch logs
cd C:/Users/Admin/graceful_books/relay
wrangler tail --env production

# Watch health checks
watch -n 10 'curl -s https://sync.gracefulbooks.com/health | jq'

# Watch error rate
watch -n 30 'curl -s https://sync.gracefulbooks.com/metrics/sla | jq'
```

## Communication Updates

### During Investigation (Every 15 minutes)

**Status Page:**
```
Update: Still investigating the outage. We've identified [component] as the issue and are working on a fix.
```

**Slack (#incidents-critical):**
```
⏰ 15-min update:
- Issue identified: [description]
- Current action: [what you're doing]
- ETA: [estimate if known, or "investigating"]
```

### After Resolution

**Status Page:**
```
Resolved: The outage has been resolved. All systems are operational. We're monitoring closely. Full incident report will be shared within 48 hours.
```

**Slack (#incidents-critical):**
```
✅ RESOLVED
Total duration: [X] minutes
Fix: [what was done]
Monitoring: Next 2 hours
Post-mortem: Scheduled for [date/time]
```

**User Email (within 1 hour of resolution):**
```
Subject: Graceful Books Service Restored

We experienced a complete service outage from [START TIME] to [END TIME] ([DURATION]).

What happened:
[Brief, non-technical explanation]

What we did:
[How we fixed it]

What we're doing to prevent this:
[Prevention measures]

We sincerely apologize for the disruption. Your data is safe - our local-first architecture means nothing was lost.

Full incident report: [link] (available within 48 hours)

Questions? Reply to this email.

- The Graceful Books Team
```

## Prevention

### Immediate Actions

- [ ] Schedule post-mortem within 48 hours
- [ ] Disable auto-deploy if deployment caused issue
- [ ] Add monitoring for the specific failure mode
- [ ] Document root cause in incident log

### Long-term Actions

- [ ] Review deployment procedures
- [ ] Add pre-deployment checks for this scenario
- [ ] Improve monitoring/alerting
- [ ] Update runbook with learnings
- [ ] Add automated tests to prevent recurrence
- [ ] Consider circuit breakers or feature flags

## Escalation

**Escalate immediately if:**

- Can't determine cause within 30 minutes
- Rollback doesn't restore service
- Database corruption suspected
- Security breach suspected
- Need specialized expertise (security, database, etc.)

**Who to escalate to:**

1. **First:** Secondary on-call engineer (Slack: @oncall-secondary)
2. **Second:** DevOps Lead (Slack: @devops-lead)
3. **Third:** CTO (Phone: [number])
4. **Cloudflare:** Support ticket (Enterprise plan has priority support)
5. **Turso:** Support ticket or Slack community

## Post-Incident Checklist

- [ ] Service fully restored and verified
- [ ] Status page updated to "Operational"
- [ ] User communication sent
- [ ] Incident documented in incident log
- [ ] Post-mortem scheduled (within 48 hours)
- [ ] Team thanked for response
- [ ] Monitoring active for next 24 hours
- [ ] On-call handoff briefing completed

## Related Runbooks

- [Sync Region Down](./02-sync-region-down.md) - If only some regions affected
- [Deployment Failed](./08-deployment-failed.md) - Deployment-specific issues
- [Database Issues](./03-database-issues.md) - Database-specific problems
- [Third-Party Outage](./11-third-party-outage.md) - External dependency down

## Notes Section

Use this space during incident to track:

```
INCIDENT LOG
============
[TIME] - Incident detected
[TIME] - Action taken
[TIME] - Result observed
[TIME] - Next action
[TIME] - Resolution confirmed
```

---

**Last Updated:** 2026-01-18
**Version:** 1.0.0
**Tested:** Not yet (schedule drill)

**Remember:** Stay calm. Follow the steps. Communicate often. Ask for help when needed.
