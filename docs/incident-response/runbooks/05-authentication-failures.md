# Runbook: Authentication Failures

**Severity:** P0-P1
**Estimated Time:** 10-45 minutes
**Skills Required:** DevOps, Security

## Symptoms

- Users cannot log in (100% failure = P0, >10% = P1)
- "Invalid credentials" errors for valid credentials
- Session management issues
- Token validation failures
- Auth-related errors in logs

## Impact

- **P0:** No users can access application
- **P1:** Some users cannot access application
- **Business:** Service disruption, user frustration

## Quick Checks

```bash
# Test auth endpoint
curl -X POST https://sync.gracefulbooks.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Check Worker logs for auth errors
cd C:/Users/Admin/graceful_books/relay
wrangler tail --env production | grep -i "auth"

# Check error rate
curl -s https://sync.gracefulbooks.com/metrics/sla | jq '.error_rate'
```

## Common Causes & Fixes

### 1. Recent Deployment Broke Auth

```bash
# Immediate rollback
cd C:/Users/Admin/graceful_books
./scripts/rollback.sh workers production

# Verify auth working
curl -X POST https://sync.gracefulbooks.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

### 2. Session Secret Rotated/Missing

```bash
# Check if SESSION_SECRET exists
cd C:/Users/Admin/graceful_books/relay
wrangler secret list --env production

# If missing, regenerate and set
# (Will invalidate all existing sessions)
SESSION_SECRET=$(openssl rand -base64 32)
echo "$SESSION_SECRET" | wrangler secret put SESSION_SECRET --env production

# Redeploy
wrangler deploy --env production
```

### 3. Database Connection Issue

```bash
# Test database
turso db shell graceful-books-sync --execute "SELECT COUNT(*) FROM users"

# If database down, see Database Issues runbook
```

### 4. Rate Limiting Triggered

```bash
# Check if rate limits activated
# Look for "rate limit exceeded" in logs
wrangler tail --env production | grep -i "rate"

# Temporarily increase limits or clear rate limit store
# Via Cloudflare Dashboard > Workers > KV namespaces
# Find rate-limit KV and clear if needed
```

### 5. Third-Party Auth Provider Issue

```bash
# If using OAuth (Google, etc.)
# Check provider status pages
# Add to status message if third-party issue
```

## Verification

```bash
# Test login with known good credentials
# Success should return JWT token

# Test multiple times
for i in {1..10}; do
  echo "Test $i:"
  curl -s -X POST https://sync.gracefulbooks.com/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test"}' | jq '.success'
done

# All should return true
```

## Communication

**P0 (All users affected):**
```
Status Page: Major Outage - Authentication system down. Investigating.
Slack: 🚨 P0: No users can log in
Update frequency: Every 15 minutes
```

**P1 (Some users affected):**
```
Status Page: Partial Outage - Some users experiencing login issues.
Slack: ⚠️ P1: Intermittent auth failures
Update frequency: Every 30 minutes
```

## Prevention

- [ ] Add auth-specific health checks
- [ ] Monitor auth success rate
- [ ] Alert on >5% auth failure rate
- [ ] Test auth in staging before production
- [ ] Document session management
- [ ] Add auth metrics to dashboard

## Escalation

**Escalate immediately if:**
- Suspect security breach
- Database corruption
- Can't identify cause in 15 minutes

**Contact:** Security team (Slack: @security-team)

---

**Last Updated:** 2026-01-18
