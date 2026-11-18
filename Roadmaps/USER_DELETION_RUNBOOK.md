# User Deletion Failure Mode Runbook

**Document Version:** 1.0
**Created:** 2026-11-17
**Status:** Active
**Related:** USER_DATA_LIFECYCLE_REFACTOR.md

---

## Overview

This runbook documents failure modes for the user deletion (anonymization) system and recovery procedures.

---

## Failure Modes & Recovery

### 1. Database Connection Lost Mid-Transaction

**Detection:**
- Error in logs: `Connection terminated`, `ECONNRESET`, or similar
- `user_deletion_failed` metric with reason `db_error`

**Impact:**
- Transaction is automatically rolled back by PostgreSQL
- No data was changed
- User sees error message

**Recovery:**
1. No data recovery needed (transaction rolled back)
2. User can retry deletion
3. If persistent, check database connectivity

**Verification:**
```sql
-- Verify user is still active
SELECT account_status, graceful_exit_id FROM users WHERE id = '<user_id>';
-- Should return 'active' and NULL
```

---

### 2. Stripe API Error Before Transaction

**Detection:**
- Error in logs: `Stripe cancellation failed`
- `stripe_cancellation_failed` metric
- Deletion returns `blocked` status

**Impact:**
- User deletion is blocked
- No data was changed
- Subscriptions remain active

**Recovery:**
1. Check Stripe API status: https://status.stripe.com
2. If Stripe is down, wait and retry
3. If persistent, manually cancel in Stripe dashboard and retry deletion

**Verification:**
```bash
# Check Stripe subscription status
stripe subscriptions retrieve <subscription_id>
```

---

### 3. Stripe API Error After Transaction (Inconsistent State)

**Detection:**
- User `account_status = 'deleted'` but Stripe subscription active
- Alert: Mismatch between database and Stripe

**Impact:**
- User is deleted in database
- Billing may continue in Stripe
- User cannot access account to cancel

**Recovery:**
1. Identify affected users:
```sql
SELECT u.graceful_exit_id, up.stripe_subscription_id, up.status
FROM users u
JOIN user_products up ON up.user_id = u.id
WHERE u.account_status = 'deleted'
  AND up.stripe_subscription_id IS NOT NULL
  AND up.status IN ('active', 'trialing', 'past_due');
```

2. For each subscription, cancel in Stripe:
```bash
stripe subscriptions cancel <subscription_id>
```

3. Update local record:
```sql
UPDATE user_products
SET status = 'cancelled', cancelled_at = NOW()
WHERE stripe_subscription_id = '<subscription_id>';
```

4. Document in incident log

---

### 4. Email Service Down

**Detection:**
- Error in logs: `Failed to send deletion email`
- `deletion_email_failed` metric

**Impact:**
- User deletion completed successfully
- User not notified via email
- User may not realize account was deleted

**Recovery:**
1. Deletion is complete - no rollback needed
2. Query recent deletions without email confirmation:
```sql
SELECT graceful_exit_id, deleted_at
FROM users
WHERE account_status = 'deleted'
  AND deleted_at > NOW() - INTERVAL '1 hour';
```

3. Manual notification may be needed (but email is gone - check admin_audit_log for original email)

**Note:** This is low-severity since deletion was successful.

---

### 5. GracefulExit ID Collision

**Detection:**
- Error: `duplicate key value violates unique constraint "users_graceful_exit_id_unique"`
- Transaction fails

**Impact:**
- User deletion fails
- No data was changed

**Recovery:**
1. This is extremely rare (8 hex chars = 4 billion possibilities)
2. Automatic retry with new ID should succeed
3. If persistent:
```sql
-- Check for existing ID
SELECT graceful_exit_id FROM users WHERE graceful_exit_id = 'GracefulExit-xxxxxxxx';
```

4. Manually trigger deletion again - new ID will be generated

---

### 6. Rate Limit Exceeded

**Detection:**
- Deletion returns `blocked` status with rate limit message
- `user_deletion_rate_limited` metric

**Impact:**
- User cannot delete account temporarily
- No data was changed

**Recovery:**
1. Wait for rate limit window to expire (1 minute for user, varies for admin)
2. If legitimate batch deletion needed, adjust rate limits temporarily:
   - Edit `DELETION_RATE_LIMITS` in `anonymization.service.ts`

---

### 7. Feature Flag Set to block_deletions

**Detection:**
- All deletions returning `blocked` status
- `DELETION_MODE` environment variable is `block_deletions`

**Impact:**
- No users can delete accounts
- Used during maintenance or incidents

**Recovery:**
1. Verify this is intentional (check with team)
2. If ready to resume:
```bash
# In production environment
export DELETION_MODE=soft_delete
# Restart application
```

3. If this was set due to an incident, resolve underlying issue first

---

## Monitoring & Alerting

### Key Metrics

| Metric | Warning Threshold | Critical Threshold |
|--------|-------------------|-------------------|
| `user_deletion_failed` rate | > 5% for 5 min | > 10% for 5 min |
| `stripe_cancellation_failed` | > 5 in 1 hour | > 20 in 1 hour |
| `deletion_email_failed` | > 10 in 1 hour | > 50 in 1 hour |
| `user_deletion_duration_ms` P99 | > 10s | > 30s |
| `user_deletion_rate_limited` | > 50 in 5 min | > 100 in 5 min |

### Dashboard Queries

```sql
-- Deletions per hour (last 24h)
SELECT
  date_trunc('hour', deleted_at) as hour,
  COUNT(*) as deletions,
  deletion_requested_by
FROM users
WHERE deleted_at > NOW() - INTERVAL '24 hours'
GROUP BY hour, deletion_requested_by
ORDER BY hour;

-- Failed deletion attempts (from logs/metrics)
-- Check application logs for user_deletion_failed events
```

---

## Prevention Checklist

Before deploying deletion-related changes:

- [ ] Run full test suite including anonymization tests
- [ ] Test on staging with real Stripe test data
- [ ] Verify feature flag is set correctly
- [ ] Check rate limit configuration
- [ ] Ensure monitoring alerts are configured
- [ ] Review this runbook with on-call team

---

## Contacts

- **Primary:** Engineering On-Call
- **Stripe Issues:** Check status.stripe.com, then contact Stripe support
- **Database Issues:** Database Admin / Cloud Provider support

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-17 | Claude | Initial version |
