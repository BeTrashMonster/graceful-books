# Runbook: High Error Rate

## Alert Details

**Alert Name:** High Error Rate
**Severity:** High (Severity 2)
**Threshold:** Error rate > 5%
**Auto-Resolution:** When error rate < 1% for 5 minutes

---

## Symptoms

- Error rate alert triggered in monitoring
- Sentry showing increased error counts
- Users may report errors or failed operations
- Cloudflare Analytics showing elevated 4xx/5xx responses

---

## Initial Triage (First 5 Minutes)

### 1. Acknowledge Alert
```bash
# Acknowledge in PagerDuty
# Post in #engineering Slack channel
```

### 2. Check Current Error Rate
```bash
# Access metrics dashboard
https://gracefulbooks.com/monitoring/dashboard

# Or check via API
curl https://sync.gracefulbooks.com/metrics/sla
```

**Look for:**
- Current error rate percentage
- Error rate trend (increasing/decreasing)
- Affected endpoints
- Affected regions

### 3. Quick Status Check
```bash
# Check overall system health
curl https://sync.gracefulbooks.com/health

# Expected response:
# {"status":"healthy","database":"connected"}
```

---

## Investigation Steps

### Step 1: Identify Error Type (2-3 minutes)

**Check Sentry Dashboard:**
1. Go to https://sentry.io/graceful-books
2. Filter by last 15 minutes
3. Look for error patterns

**Common Error Types:**
- Database errors (connection, query failures)
- Authentication errors (token expired, invalid)
- Rate limiting errors
- Validation errors
- External service errors

### Step 2: Determine Scope (2-3 minutes)

**Questions to Answer:**
- Is it all endpoints or specific ones?
- Is it all regions or specific regions?
- Is it all users or specific users?
- Did it start at a specific time?

**Check Cloudflare Analytics:**
1. Go to Cloudflare Dashboard > Analytics
2. Filter by time range (last 1 hour)
3. Group by endpoint
4. Group by region
5. Group by status code

### Step 3: Check Recent Changes (2-3 minutes)

**Deployment Timeline:**
```bash
# Check recent deployments
gh run list --limit 10

# Check recent commits
git log --oneline -10
```

**Questions:**
- Was there a deployment in the last hour?
- Were there any infrastructure changes?
- Were there any configuration changes?

### Step 4: Database Health (2-3 minutes)

**Check Database:**
```bash
# Check Turso dashboard
# https://turso.tech/app

# Test database connection
wrangler tail --env production | grep "database"
```

**Look for:**
- Connection errors
- Query timeouts
- High query latency
- Connection pool exhaustion

### Step 5: Check Dependencies (2-3 minutes)

**External Services:**
- Cloudflare Status: https://www.cloudflarestatus.com
- Turso Status: https://status.turso.tech
- GitHub Status: https://www.githubstatus.com

---

## Common Causes & Solutions

### Cause 1: Recent Deployment Bug

**Symptoms:**
- Errors started immediately after deployment
- Error rate spike correlates with deploy time
- Specific endpoint showing errors

**Solution:**
```bash
# Immediate rollback
cd /path/to/graceful_books
./scripts/rollback.sh

# Select "Workers" or "Pages" depending on affected component
# Choose previous version
# Confirm rollback

# Verify error rate decreases
curl https://sync.gracefulbooks.com/metrics/sla
```

**Follow-up:**
- Create incident report
- Fix bug in code
- Add tests to prevent regression
- Re-deploy with fix

### Cause 2: Database Connection Pool Exhausted

**Symptoms:**
- "Too many connections" errors in Sentry
- Database connection errors
- Errors across all endpoints
- Slow response times

**Solution:**
```bash
# Check current connections (Turso dashboard)
# If at limit, temporarily increase limit:

# Option 1: Increase connection pool size
# Edit wrangler.toml
# [env.production]
# vars = { DB_MAX_CONNECTIONS = "200" }

# Option 2: Kill long-running queries (if any)
# Check Turso dashboard for slow queries

# Option 3: Restart workers to reset connections
wrangler deploy --env production
```

**Follow-up:**
- Investigate connection leaks
- Add connection pool monitoring
- Review query performance
- Add query timeouts

### Cause 3: Rate Limiting Triggered

**Symptoms:**
- 429 errors in logs
- Errors from specific IPs or users
- Spike in traffic volume

**Solution:**
```bash
# Check rate limit logs
wrangler tail --env production | grep "rate_limit"

# If legitimate traffic:
# 1. Temporarily increase limits in Cloudflare

# If attack:
# 1. Identify malicious IPs
# 2. Block in Cloudflare WAF
# 3. Enable stricter rate limits
```

**Follow-up:**
- Review rate limit thresholds
- Implement IP reputation system
- Add CAPTCHA for suspicious traffic

### Cause 4: External Service Outage

**Symptoms:**
- Errors from specific integration
- External API timeout errors
- Third-party status page shows outage

**Solution:**
```bash
# Check external service status pages

# If outage is confirmed:
# 1. Enable graceful degradation (if implemented)
# 2. Return cached data (if available)
# 3. Queue requests for retry

# Temporary workaround:
# Disable affected feature temporarily
# Update feature flag in Cloudflare KV
```

**Follow-up:**
- Implement circuit breaker pattern
- Add retry logic with backoff
- Cache external data
- Add fallback mechanisms

### Cause 5: Invalid Configuration

**Symptoms:**
- Errors started after config change
- Consistent error pattern
- No code changes

**Solution:**
```bash
# Check recent configuration changes
git log --all --oneline -- "*.env" "wrangler.toml"

# Verify environment variables
wrangler secret list --env production

# Verify secrets are set correctly
wrangler secret put TURSO_DATABASE_URL --env production
wrangler secret put TURSO_AUTH_TOKEN --env production

# Re-deploy if needed
wrangler deploy --env production
```

**Follow-up:**
- Document configuration changes
- Add validation for config values
- Test config changes in staging first

---

## Resolution Verification

### Verify Error Rate Decreased

```bash
# Check current error rate
curl https://sync.gracefulbooks.com/metrics/sla

# Should show error rate < 1%

# Monitor for 10 minutes to ensure stability
watch -n 60 'curl -s https://sync.gracefulbooks.com/metrics/sla | jq .errorRate'
```

### Verify User Impact Resolved

1. Check Sentry for new errors (should be minimal)
2. Check user reports in support channels
3. Test affected functionality manually

### Update Incident Channel

```
Post in #incidents or #engineering:

✅ Error rate resolved
- Root cause: [describe]
- Solution: [describe]
- Error rate now: [X%]
- Monitoring for 30 minutes to ensure stability
- Incident report to follow
```

---

## Post-Incident

### Create Incident Report

```bash
# Use incident report template
cp docs/templates/incident-report.md docs/incidents/YYYY-MM-DD-high-error-rate.md

# Fill in:
# - Timeline of events
# - Root cause analysis
# - Actions taken
# - Lessons learned
# - Preventive measures
```

### Update Runbook

If you discovered new information:
1. Update this runbook
2. Add new troubleshooting steps
3. Document new solutions
4. Share with team

### Preventive Measures

- Add monitoring for root cause
- Add alerts for early warning signs
- Improve error handling
- Add automated recovery
- Update tests to catch issue

---

## Escalation

**Escalate if:**
- Error rate not decreasing after 15 minutes
- You've tried all common solutions
- Database is completely down
- You're unsure about next steps

**How to Escalate:**
1. Page secondary on-call: `@oncall-secondary` in Slack
2. If no response in 10 min, page engineering lead
3. For critical issues, page both immediately

---

## Related Runbooks

- [High Response Time](./RUNBOOK_HIGH_RESPONSE_TIME.md)
- [Database Connection Issues](./RUNBOOK_DATABASE_ISSUES.md)
- [Service Outage](./RUNBOOK_OUTAGE.md)
- [Deployment Rollback](./RUNBOOK_ROLLBACK.md)

---

## Useful Commands

```bash
# Check error rate
curl https://sync.gracefulbooks.com/metrics/sla | jq .errorRate

# View live logs
wrangler tail --env production

# Check recent deployments
gh run list --limit 10

# Rollback deployment
./scripts/rollback.sh

# Check health status
curl https://sync.gracefulbooks.com/health

# View Sentry errors
open https://sentry.io/graceful-books

# View Cloudflare analytics
open https://dash.cloudflare.com
```

---

**Last Updated:** 2026-01-18
**Owner:** DevOps Team
**Review Frequency:** After each high error rate incident
