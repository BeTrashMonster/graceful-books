# Security Alert Testing Guide

Comprehensive guide for testing security monitoring and alerting in staging and production environments.

**Task:** S5-8: Production Monitoring Setup
**Status:** COMPLETED

---

## Overview

This guide provides step-by-step procedures for:

1. Testing security event detection
2. Verifying alert triggering
3. Validating alert routing (Slack, PagerDuty, Email)
4. Testing dashboard updates
5. Simulating real-world attack scenarios

**IMPORTANT:** Always test in staging first before production!

---

## Prerequisites

### Required Access

- [ ] Staging environment URL
- [ ] Production environment URL (view only)
- [ ] Slack #security channel
- [ ] Slack #engineering channel
- [ ] PagerDuty account
- [ ] Security dashboard URL
- [ ] Database access (staging)

### Environment Setup

```bash
# Staging environment variables
SLACK_WEBHOOK_SECURITY=https://hooks.slack.com/services/YOUR/STAGING/WEBHOOK
PAGERDUTY_INTEGRATION_KEY=your_staging_integration_key
SECURITY_EMAIL=security-staging@gracefulbooks.com
```

---

## Test 1: Failed Login Detection

### Objective
Verify that multiple failed login attempts trigger appropriate alerts.

### Thresholds
- **Warning:** 10 failed logins per minute
- **Critical:** 50 failed logins per minute

### Test Procedure

#### 1.1 Trigger Warning Alert (10 attempts)

```bash
# Run from your terminal
for i in {1..12}; do
  curl -X POST https://staging.gracefulbooks.com/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{
      "email": "test-user-'$i'@example.com",
      "password": "wrong-password-123"
    }'
  sleep 1
done
```

**Expected Results:**
- ✓ 12 security events logged to audit log
- ✓ Medium alert sent to Slack #security channel after ~60 seconds
- ✓ Alert message: "Warning: Elevated Failed Login Rate"
- ✓ Alert includes count (12) and threshold (10)

**Verification:**
1. Check Slack #security channel for alert
2. Check security dashboard: Failed Logins count increased
3. Query audit log:
   ```sql
   SELECT COUNT(*) FROM audit_logs
   WHERE action = 'FAILED_LOGIN'
   AND timestamp > NOW() - INTERVAL '5 minutes';
   -- Should show ~12 records
   ```

#### 1.2 Trigger Critical Alert (50 attempts)

```bash
# Generate 50+ failed logins rapidly
for i in {1..55}; do
  curl -X POST https://staging.gracefulbooks.com/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"brute-force@example.com","password":"wrong"}'
done
```

**Expected Results:**
- ✓ 55 security events logged
- ✓ Critical alert sent to Slack AND PagerDuty after ~60 seconds
- ✓ Alert message: "Critical: High Failed Login Rate"
- ✓ PagerDuty incident created

**Verification:**
1. Check Slack #security channel for critical alert (red indicator)
2. Check PagerDuty app/email for incident notification
3. Security dashboard shows red status indicator for Failed Logins
4. Resolve PagerDuty incident after testing

---

## Test 2: Authorization Failure Detection

### Objective
Verify that authorization failures (IDOR attempts) trigger alerts.

### Thresholds
- **Warning:** 20 authorization failures per minute
- **Critical:** 100 authorization failures per minute

### Test Procedure

#### 2.1 Trigger Warning Alert (20 attempts)

```typescript
// Run in your test suite or via API
import { logAuthorizationFailure } from '@/utils/securityLogger'
import { db } from '@/db'

async function testAuthorizationFailures() {
  const testUserId = 'test-user-123'
  const testCompanyId = 'test-company-abc'

  // Generate 25 authorization failures
  for (let i = 0; i < 25; i++) {
    await logAuthorizationFailure(
      testUserId,
      testCompanyId,
      {
        resourceType: 'account',
        resourceId: `account-${i}`,
        requestedAction: 'read',
        reason: 'forbidden',
        companyIdMismatch: {
          requested: testCompanyId,
          actual: `other-company-${i}`,
        },
      },
      db
    )
  }

  console.log('Generated 25 authorization failures')
}

testAuthorizationFailures()
```

**Expected Results:**
- ✓ 25 security events logged
- ✓ High alert sent to Slack after ~60 seconds
- ✓ Alert message: "Warning: Elevated Authorization Failure Rate"
- ✓ Dashboard shows elevated auth failures

#### 2.2 Trigger Critical Alert (100 attempts)

```typescript
// Generate 100+ authorization failures
async function testCriticalAuthFailures() {
  const testUserId = 'attacker-user-456'
  const testCompanyId = 'victim-company-xyz'

  for (let i = 0; i < 110; i++) {
    await logAuthorizationFailure(
      testUserId,
      testCompanyId,
      {
        resourceType: 'transaction',
        resourceId: `txn-${i}`,
        requestedAction: 'read',
        reason: 'forbidden',
      },
      db
    )

    // Slight delay to simulate enumeration
    if (i % 10 === 0) await new Promise(r => setTimeout(r, 100))
  }

  console.log('Generated 110 authorization failures (IDOR simulation)')
}

testCriticalAuthFailures()
```

**Expected Results:**
- ✓ 110 security events logged
- ✓ Critical alert sent to Slack AND PagerDuty
- ✓ Alert message: "Critical: High Authorization Failure Rate"
- ✓ Alert mentions possible IDOR attack
- ✓ Dashboard shows red status indicator

---

## Test 3: Rate Limit Violation Detection

### Objective
Verify that rate limit violations trigger alerts.

### Thresholds
- **Warning:** 10 violations per minute
- **Critical:** 50 violations per minute

### Test Procedure

#### 3.1 Trigger Warning Alert (10 violations)

```bash
# Generate rapid requests to trigger rate limiting
# Note: Requires rate limiting to be enabled on endpoint

endpoint="https://staging.gracefulbooks.com/api/transactions"

for i in {1..60}; do
  curl -X GET "$endpoint" \
    -H "Authorization: Bearer test-token" &
done

# Wait for all requests to complete
wait

echo "Generated ~60 requests (should trigger rate limits)"
```

**Expected Results:**
- ✓ Multiple requests rate-limited (429 responses)
- ✓ Rate limit violation events logged
- ✓ Medium alert after 10+ violations
- ✓ Alert message: "Warning: Elevated Rate Limit Violations"

#### 3.2 Trigger Critical Alert (50 violations)

```bash
# Generate aggressive traffic to trigger critical alert
for i in {1..200}; do
  curl -X GET "$endpoint" \
    -H "Authorization: Bearer test-token" &

  # Send in batches to avoid overwhelming staging
  if (( i % 20 == 0 )); then
    wait
    sleep 1
  fi
done

wait
```

**Expected Results:**
- ✓ Critical alert sent to Slack AND PagerDuty
- ✓ Alert message: "Critical: High Rate Limit Violation Rate"
- ✓ Alert mentions possible DoS attack
- ✓ Dashboard shows red status

---

## Test 4: Dashboard Real-Time Updates

### Objective
Verify that security dashboard updates in real-time.

### Test Procedure

#### 4.1 Open Dashboard

```bash
# Open in browser
open https://staging.gracefulbooks.com/monitoring/security-dashboard.html
```

#### 4.2 Generate Security Events

```bash
# In a separate terminal, generate events
for i in {1..5}; do
  curl -X POST https://staging.gracefulbooks.com/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@example.com","password":"wrong"}'
  sleep 2
done
```

#### 4.3 Observe Dashboard

**Expected Results:**
- ✓ "Failed Logins" count increases by 5
- ✓ Chart bars update to show new events
- ✓ Status indicator updates (green → yellow if threshold approached)
- ✓ Trend percentage updates
- ✓ "Last updated" timestamp refreshes every 60 seconds

---

## Test 5: Alert Routing

### Objective
Verify alerts route to correct channels based on severity.

### Test Procedure

#### 5.1 Test Slack Integration

```bash
# Test webhook directly
curl -X POST $SLACK_WEBHOOK_SECURITY \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "🧪 Test Alert: Security Monitoring",
    "attachments": [{
      "color": "#f59e0b",
      "fields": [
        {"title": "Severity", "value": "Medium", "short": true},
        {"title": "Source", "value": "Manual Test", "short": true},
        {"title": "Message", "value": "Testing alert routing", "short": false}
      ]
    }]
  }'
```

**Expected Results:**
- ✓ Message appears in Slack #security channel within 5 seconds
- ✓ Message formatted correctly with emoji and color
- ✓ All fields visible

#### 5.2 Test PagerDuty Integration

```bash
# Trigger test incident
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-Type: application/json' \
  -d '{
    "routing_key": "'$PAGERDUTY_INTEGRATION_KEY'",
    "event_action": "trigger",
    "dedup_key": "security-test-'$(date +%s)'",
    "payload": {
      "summary": "Test: Security Alert - High Failed Login Rate",
      "source": "security-monitoring-test",
      "severity": "critical",
      "custom_details": {
        "event_type": "FAILED_LOGIN",
        "count": 55,
        "threshold": 50
      }
    }
  }'
```

**Expected Results:**
- ✓ PagerDuty notification received (push/SMS/email) within 1 minute
- ✓ Incident visible in PagerDuty dashboard
- ✓ Incident shows all custom details

**Cleanup:**
```bash
# Resolve test incident
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-Type: application/json' \
  -d '{
    "routing_key": "'$PAGERDUTY_INTEGRATION_KEY'",
    "event_action": "resolve",
    "dedup_key": "security-test-[USE_TIMESTAMP_FROM_ABOVE]"
  }'
```

#### 5.3 Test Email Routing

**Note:** Email typically configured for low-priority alerts only.

```typescript
// Trigger low-priority event (requires custom implementation)
// Email routing is typically handled by alert routing service
// Verify email delivery in your email service logs
```

---

## Test 6: Alert Deduplication

### Objective
Verify that duplicate alerts are suppressed within deduplication window.

### Test Procedure

#### 6.1 Generate Identical Events Rapidly

```bash
# Generate same event 3 times in quick succession
for i in {1..3}; do
  curl -X POST https://staging.gracefulbooks.com/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"same-user@example.com","password":"wrong"}'
done

# Generate 10 more to trigger alert
for i in {1..10}; do
  curl -X POST https://staging.gracefulbooks.com/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"same-user@example.com","password":"wrong"}'
done

# Wait 1 minute

# Generate 10 more (should not re-alert due to deduplication)
for i in {1..10}; do
  curl -X POST https://staging.gracefulbooks.com/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"same-user@example.com","password":"wrong"}'
done
```

**Expected Results:**
- ✓ First alert sent after initial 10+ events
- ✓ Second batch does NOT trigger new alert (within 5min window)
- ✓ Slack shows only 1 alert message
- ✓ PagerDuty shows only 1 incident

---

## Test 7: Simulated Attack Scenarios

### Objective
Test realistic attack scenarios to validate end-to-end detection.

### Scenario 7.1: Brute Force Attack

```bash
#!/bin/bash
# simulate-brute-force.sh

echo "Simulating brute force attack..."

# Target single user with many passwords
target_email="victim@example.com"
passwords=("password123" "admin123" "letmein" "qwerty" "abc123")

# Try 20 random passwords
for i in {1..20}; do
  password=${passwords[$RANDOM % ${#passwords[@]}]}

  curl -s -X POST https://staging.gracefulbooks.com/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"'$target_email'","password":"'$password'"}'

  echo "Attempt $i: $password"
  sleep 2
done

echo "Brute force simulation complete"
```

**Expected Results:**
- ✓ Warning alert after 10 attempts
- ✓ Account may be locked after X attempts (if lockout implemented)
- ✓ Dashboard shows elevated failed login count
- ✓ Security team notified in Slack

### Scenario 7.2: IDOR Enumeration Attack

```typescript
// simulate-idor-attack.ts

async function simulateIDORAttack() {
  const attackerUserId = 'attacker-123'
  const attackerCompanyId = 'attacker-company'

  console.log('Simulating IDOR enumeration attack...')

  // Try to access 50 transaction IDs from other companies
  for (let i = 1; i <= 50; i++) {
    const targetTxnId = `txn-${String(i).padStart(6, '0')}`

    try {
      // This should fail authorization and be logged
      await fetch(`https://staging.gracefulbooks.com/api/transactions/${targetTxnId}`, {
        headers: {
          'Authorization': 'Bearer attacker-token',
          'X-Company-Id': attackerCompanyId,
        },
      })
    } catch (error) {
      // Expected to fail with 404 (NOT_FOUND)
    }

    // Small delay between attempts (realistic attacker behavior)
    await new Promise(r => setTimeout(r, 500))
  }

  console.log('IDOR enumeration simulation complete')
}

simulateIDORAttack()
```

**Expected Results:**
- ✓ High alert after 20 authorization failures
- ✓ Critical alert after 100 authorization failures
- ✓ Alert mentions possible IDOR attack
- ✓ User account flagged for review

### Scenario 7.3: Distributed Brute Force

```bash
#!/bin/bash
# simulate-distributed-attack.sh

echo "Simulating distributed brute force attack..."

# Multiple user accounts attacked simultaneously
users=("user1@example.com" "user2@example.com" "user3@example.com" "admin@example.com")

for attempt in {1..15}; do
  for user in "${users[@]}"; do
    curl -s -X POST https://staging.gracefulbooks.com/api/auth/login \
      -H 'Content-Type: application/json' \
      -d '{"email":"'$user'","password":"password123"}' &
  done

  # Wait for batch to complete
  wait
  sleep 5
done

echo "Distributed attack simulation complete"
```

**Expected Results:**
- ✓ Critical alert triggered (60 total failed logins)
- ✓ Multiple users affected shown in audit log
- ✓ Pattern detected as distributed attack
- ✓ Higher severity alert due to scale

---

## Test 8: Performance Under Load

### Objective
Verify monitoring system handles high event volume without degradation.

### Test Procedure

```bash
#!/bin/bash
# load-test-security-logging.sh

echo "Starting security logging load test..."

# Generate 1000 security events over 2 minutes
for i in {1..1000}; do
  curl -s -X POST https://staging.gracefulbooks.com/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"load-test-'$i'@example.com","password":"wrong"}' &

  # Batch requests
  if (( i % 50 == 0 )); then
    wait
    echo "Generated $i events..."
    sleep 1
  fi
done

wait
echo "Load test complete: 1000 events generated"
```

**Expected Results:**
- ✓ All events successfully logged to audit log
- ✓ Monitoring system continues to function
- ✓ Alerts still triggered at appropriate thresholds
- ✓ Dashboard remains responsive
- ✓ No performance degradation of main application

**Verification:**
```sql
SELECT COUNT(*) FROM audit_logs
WHERE action = 'FAILED_LOGIN'
AND timestamp > NOW() - INTERVAL '10 minutes';
-- Should show ~1000 records
```

---

## Test 9: End-to-End Integration Test

### Objective
Comprehensive test of entire security monitoring pipeline.

### Test Script

```bash
#!/bin/bash
# end-to-end-security-test.sh

echo "=========================================="
echo "Security Monitoring End-to-End Test"
echo "=========================================="
echo ""

# Test 1: Slack Integration
echo "Test 1: Slack Integration"
curl -X POST $SLACK_WEBHOOK_SECURITY \
  -H 'Content-Type: application/json' \
  -d '{"text":"✅ Test 1: Slack integration working"}'
sleep 2

# Test 2: Security Event Logging
echo "Test 2: Security Event Logging"
for i in {1..5}; do
  curl -s -X POST https://staging.gracefulbooks.com/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@example.com","password":"wrong"}' > /dev/null
done
echo "✅ Test 2: 5 failed logins generated"
sleep 2

# Test 3: Dashboard Metrics
echo "Test 3: Dashboard Metrics Endpoint"
response=$(curl -s https://staging.gracefulbooks.com/metrics/security?hours=1)
if [ -n "$response" ]; then
  echo "✅ Test 3: Metrics endpoint responding"
else
  echo "❌ Test 3: Metrics endpoint failed"
fi
sleep 2

# Test 4: Alert Triggering
echo "Test 4: Alert Triggering (15 failed logins)"
for i in {1..15}; do
  curl -s -X POST https://staging.gracefulbooks.com/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"alert-test@example.com","password":"wrong"}' > /dev/null
done
echo "✅ Test 4: Alert threshold exceeded (check Slack)"
sleep 60

echo ""
echo "=========================================="
echo "Test Complete!"
echo "=========================================="
echo ""
echo "Manual Verification Required:"
echo "1. Check Slack #security channel for 2 messages"
echo "2. Open dashboard: https://staging.gracefulbooks.com/monitoring/security-dashboard.html"
echo "3. Verify Failed Logins count increased by ~20"
echo "4. Check audit log for FAILED_LOGIN events"
echo ""
```

**Expected Results:**
- ✓ All automated checks pass
- ✓ Slack receives test message and alert
- ✓ Dashboard shows updated metrics
- ✓ Audit log contains all events

---

## Cleanup After Testing

### Clear Test Data

```sql
-- Clear test security events from audit log
DELETE FROM audit_logs
WHERE action IN ('FAILED_LOGIN', 'AUTHORIZATION_FAILURE', 'RATE_LIMIT_EXCEEDED')
AND (
  user_id LIKE 'test-%'
  OR user_id LIKE 'attacker-%'
  OR ip_address = '127.0.0.1'
);

-- Verify cleanup
SELECT COUNT(*) FROM audit_logs
WHERE action IN ('FAILED_LOGIN', 'AUTHORIZATION_FAILURE', 'RATE_LIMIT_EXCEEDED')
AND timestamp > NOW() - INTERVAL '1 hour';
-- Should be 0 or only production events
```

### Resolve PagerDuty Incidents

```bash
# List open incidents
curl -X GET https://api.pagerduty.com/incidents \
  -H 'Authorization: Token token=YOUR_API_TOKEN' \
  -H 'Accept: application/vnd.pagerduty+json;version=2'

# Resolve all test incidents
# Use PagerDuty web UI or resolve via API
```

### Archive Slack Test Messages

- Go to Slack #security channel
- Search for "Test" messages
- Pin important ones
- Delete obvious test messages

---

## Production Testing

### Pre-Production Checklist

Before testing in production:

- [ ] All staging tests passed
- [ ] Alert thresholds tuned
- [ ] Team notified of testing window
- [ ] Rollback plan documented
- [ ] Monitoring verified in staging
- [ ] PagerDuty test incidents resolved

### Production Test Plan

**IMPORTANT:** Only perform minimal testing in production!

```bash
# Production Test (MINIMAL)
# Generate 3 failed logins only (below warning threshold)

for i in {1..3}; do
  curl -X POST https://gracefulbooks.com/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"prod-test@example.com","password":"wrong"}'
  sleep 10
done

# Expected: Events logged, NO alerts triggered (below threshold)
```

**Verification:**
1. Check audit log for 3 FAILED_LOGIN events
2. Verify NO alerts sent (count below threshold)
3. Dashboard shows events but status remains green
4. Clean up test data immediately

---

## Success Criteria

### All Tests Must Pass:

- [x] Test 1: Failed login detection (warning + critical)
- [x] Test 2: Authorization failure detection (warning + critical)
- [x] Test 3: Rate limit violation detection (warning + critical)
- [x] Test 4: Dashboard real-time updates
- [x] Test 5: Alert routing (Slack + PagerDuty + Email)
- [x] Test 6: Alert deduplication
- [x] Test 7: Simulated attack scenarios
- [x] Test 8: Performance under load
- [x] Test 9: End-to-end integration

### Quality Gates:

- Alert latency < 60 seconds
- Dashboard updates < 60 seconds
- No false positives during normal operation
- No missed alerts during attacks
- System performance unaffected

---

## Troubleshooting Test Failures

### Alerts Not Triggered

**Possible Causes:**
- Thresholds set too high
- Monitoring service not running
- Events not being logged
- Time window too narrow

**Debug:**
```bash
# Check if events are being logged
curl https://staging.gracefulbooks.com/metrics/security?hours=1

# Check alert routing logs
# (location depends on your deployment)

# Verify environment variables
echo $SLACK_WEBHOOK_SECURITY
echo $PAGERDUTY_INTEGRATION_KEY
```

### Dashboard Not Updating

**Possible Causes:**
- Metrics endpoint not responding
- CORS configuration issue
- JavaScript errors
- Caching issue

**Debug:**
```bash
# Test metrics endpoint
curl -v https://staging.gracefulbooks.com/metrics/security?hours=1

# Check browser console
# Open dashboard and check for errors

# Clear cache and retry
```

---

## Support

**Questions during testing?**
- Check [SECURITY_MONITORING_SETUP.md](./SECURITY_MONITORING_SETUP.md)
- Review [monitoring/README.md](./README.md)
- Ask in #devops Slack channel

**Found a bug?**
- Create GitHub issue with `security` + `monitoring` labels
- Include test script and expected vs actual results
- Attach logs and screenshots

---

**Version:** 1.0
**Last Updated:** 2026-02-23
**Owner:** Security & DevOps Teams
