# Security Event Logging Documentation

## Overview

The Security Event Logging system provides comprehensive, immutable logging for all security-related events in Graceful Books. This system is critical for:

- **Threat Detection**: Identifying potential security breaches and attacks
- **Forensic Analysis**: Investigating security incidents after they occur
- **Compliance**: Meeting audit and regulatory requirements
- **User Protection**: Detecting account takeover attempts and unauthorized access

## Implementation Details

### Task: S5-2 - Security Event Logging [HIGH]
**Completion Date:** 2026-02-23
**Status:** ✅ COMPLETED

### Files Created/Modified

1. **`src/utils/securityLogger.ts`** - Main implementation (456 lines)
   - Core security event logging functionality
   - Event type definitions and interfaces
   - Helper functions for each event type
   - Query and statistics functions
   - Automatic sensitive data sanitization

2. **`src/utils/securityLogger.test.ts`** - Test suite (688 lines)
   - 29 comprehensive tests covering all functionality
   - 100% test coverage for security logging
   - Tests for immutability and data sanitization

3. **`src/types/database.types.ts`** - Type definitions (updated)
   - Added 5 new security event types to `AuditAction` enum
   - Added `SECURITY` to `AuditEntityType` enum

4. **`src/db/schema/audit.schema.ts`** - Schema helpers (updated)
   - Added display names for new security event types

## Security Event Types

The system logs the following security event types:

### 1. FAILED_LOGIN
Logs failed authentication attempts.

```typescript
interface FailedLoginDetails {
  username?: string
  email?: string
  reason: 'invalid_credentials' | 'account_locked' | 'account_not_found' | 'other'
  attemptCount?: number
}
```

**Use Cases:**
- Detect brute force attacks
- Identify credential stuffing attempts
- Track repeated failed login patterns

**Example:**
```typescript
await logFailedLogin({
  email: 'user@example.com',
  reason: 'invalid_credentials',
  attemptCount: 3
}, db)
```

### 2. AUTHORIZATION_FAILURE
Logs unauthorized access attempts (potential IDOR attacks).

```typescript
interface AuthorizationFailureDetails {
  resourceType: string
  resourceId: string
  requestedAction: string
  reason: 'not_found' | 'forbidden' | 'invalid_company_id'
  companyIdMismatch?: {
    requested: string
    actual: string
  }
}
```

**Use Cases:**
- Detect IDOR (Insecure Direct Object Reference) attacks
- Identify users trying to access resources they don't own
- Track potential privilege escalation attempts

**Example:**
```typescript
await logAuthorizationFailure(
  'user-123',
  'company-abc',
  {
    resourceType: 'account',
    resourceId: 'account-xyz',
    requestedAction: 'update',
    reason: 'forbidden',
    companyIdMismatch: {
      requested: 'company-abc',
      actual: 'company-def'
    }
  },
  db
)
```

### 3. RATE_LIMIT_EXCEEDED
Logs when rate limits are exceeded.

```typescript
interface RateLimitExceededDetails {
  endpoint?: string
  limit: number
  windowSeconds: number
  attemptCount: number
}
```

**Use Cases:**
- Prevent API abuse
- Detect automated scraping attempts
- Identify denial-of-service patterns

**Example:**
```typescript
await logRateLimitExceeded({
  endpoint: '/api/accounts',
  limit: 100,
  windowSeconds: 60,
  attemptCount: 250
}, db)
```

### 4. SUSPICIOUS_ACTIVITY
Logs detected suspicious behavior patterns.

```typescript
interface SuspiciousActivityDetails {
  activityType: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  indicators: string[]
}
```

**Use Cases:**
- Detect unusual access patterns
- Identify potential data exfiltration attempts
- Track anomalous user behavior

**Example:**
```typescript
await logSuspiciousActivity(
  'user-suspect',
  'company-123',
  {
    activityType: 'rapid_resource_enumeration',
    description: 'User accessing many sequential account IDs',
    severity: 'high',
    indicators: ['high_request_rate', 'sequential_ids', 'many_404s']
  },
  db
)
```

### 5. ACCOUNT_LOCKOUT
Logs account lockout events.

```typescript
interface AccountLockoutDetails {
  userId: string
  reason: 'max_failed_attempts' | 'suspicious_activity' | 'manual_lock'
  duration?: number // Duration in seconds
  unlockAt?: number // Unix timestamp
}
```

**Use Cases:**
- Track automated account security measures
- Log manual administrator actions
- Document account security status changes

**Example:**
```typescript
await logAccountLockout({
  userId: 'user-locked',
  reason: 'max_failed_attempts',
  duration: 3600, // 1 hour
  unlockAt: Date.now() + 3600000
}, db)
```

## Core Functions

### logSecurityEvent()

The main function that logs security events to the immutable audit log.

```typescript
async function logSecurityEvent(
  event: SecurityEvent,
  db: SecurityLogDatabase
): Promise<string | null>
```

**Features:**
- Integrates with existing audit log infrastructure
- Automatically captures context (userId, companyId) when available
- Sanitizes sensitive data before logging
- Returns log entry ID or null on failure
- Never throws errors (won't break main application flow)

**Parameters:**
- `event`: Security event to log
  - `type`: Event type (enum value)
  - `userId`: Optional user ID (uses audit context if not provided)
  - `companyId`: Optional company ID (uses audit context if not provided)
  - `details`: Event-specific details
  - `ipAddress`: Optional IP address
  - `userAgent`: Optional user agent string
  - `metadata`: Optional additional metadata
- `db`: Database instance with `audit_logs` table

### Helper Functions

Each event type has a dedicated helper function for convenience:

```typescript
// Failed login
logFailedLogin(details: FailedLoginDetails, db): Promise<string | null>

// Authorization failure (IDOR)
logAuthorizationFailure(userId, companyId, details: AuthorizationFailureDetails, db): Promise<string | null>

// Rate limit exceeded
logRateLimitExceeded(details: RateLimitExceededDetails, db): Promise<string | null>

// Suspicious activity
logSuspiciousActivity(userId, companyId, details: SuspiciousActivityDetails, db): Promise<string | null>

// Account lockout
logAccountLockout(details: AccountLockoutDetails, db): Promise<string | null>
```

### Query Functions

#### querySecurityEvents()

Query security events from the audit log.

```typescript
async function querySecurityEvents(
  companyId: string,
  db: { auditLogs: DexieTable },
  filters?: {
    eventType?: SecurityEventType
    userId?: string
    dateFrom?: number
    dateTo?: number
    limit?: number
  }
): Promise<AuditLog[]>
```

**Example:**
```typescript
// Get all authorization failures in the last 24 hours
const events = await querySecurityEvents('company-123', db, {
  eventType: SecurityEventType.AUTHORIZATION_FAILURE,
  dateFrom: Date.now() - (24 * 60 * 60 * 1000),
  limit: 100
})
```

#### getSecurityEventStats()

Get statistics for security events.

```typescript
async function getSecurityEventStats(
  companyId: string,
  db: { auditLogs: DexieTable },
  timeRangeMs?: number // Default: 24 hours
): Promise<{
  totalEvents: number
  failedLogins: number
  authorizationFailures: number
  rateLimitExceeded: number
  suspiciousActivity: number
  accountLockouts: number
}>
```

**Example:**
```typescript
// Get security stats for the last 7 days
const stats = await getSecurityEventStats(
  'company-123',
  db,
  7 * 24 * 60 * 60 * 1000
)

console.log(`Total security events: ${stats.totalEvents}`)
console.log(`Failed logins: ${stats.failedLogins}`)
console.log(`Authorization failures: ${stats.authorizationFailures}`)
```

## Security Features

### Sensitive Data Sanitization

The security logger automatically sanitizes sensitive data before logging. The following field types are redacted:

- `password`
- `passphrase`
- `key`
- `secret`
- `token`
- `privateKey`
- `encryptionKey`
- `masterKey`
- `salt`

Any field name containing these keywords (case-insensitive) will have its value replaced with `[REDACTED]`.

**Example:**
```typescript
// Input
{
  username: 'user@example.com',
  password: 'secret123',
  masterKey: 'key-data'
}

// Logged as
{
  username: 'user@example.com',
  password: '[REDACTED]',
  masterKey: '[REDACTED]'
}
```

### Immutability

Security events are stored in the audit log, which is:

1. **Append-only**: New events can be added, but existing events cannot be modified
2. **Never deleted**: Events are retained for compliance (7-year retention for financial records)
3. **Timestamped**: Every event has a precise timestamp for chronological analysis
4. **Versioned**: No version vectors (unlike regular entities) - security logs don't sync

### Context Awareness

The security logger integrates with the audit context system:

```typescript
// Set audit context (done at login)
setAuditContext({
  userId: 'user-123',
  companyId: 'company-abc'
})

// Context automatically used when logging
await logSecurityEvent({ type: FAILED_LOGIN, details }, db)
// userId and companyId automatically captured from context
```

If no context is set, the system uses:
- Event-provided userId/companyId (if available)
- Falls back to 'SYSTEM' for system-level events

## Integration Points

### Authorization System

The security logger integrates with the authorization utilities:

```typescript
import { requireCompanyOwnership } from '../utils/authorization'
import { logAuthorizationFailure } from '../utils/securityLogger'

async function getAccount(accountId: string, companyId: string) {
  const account = await db.accounts.get(accountId)
  const authResult = requireCompanyOwnership(account, companyId)

  if (!authResult.authorized) {
    // Log the authorization failure
    await logAuthorizationFailure(
      userId,
      companyId,
      {
        resourceType: 'account',
        resourceId: accountId,
        requestedAction: 'read',
        reason: authResult.error.code === 'NOT_FOUND' ? 'not_found' : 'forbidden'
      },
      db
    )

    return { success: false, error: authResult.error }
  }

  return { success: true, data: authResult.resource }
}
```

### Authentication System

Failed login attempts should be logged:

```typescript
async function login(email: string, password: string) {
  const user = await findUserByEmail(email)

  if (!user) {
    await logFailedLogin({
      email,
      reason: 'account_not_found',
      attemptCount: 1
    }, db)
    return { success: false, error: 'Invalid credentials' }
  }

  const isValid = await verifyPassword(password, user.passwordHash)

  if (!isValid) {
    const attemptCount = await incrementFailedAttempts(user.id)

    await logFailedLogin({
      email,
      reason: 'invalid_credentials',
      attemptCount
    }, db)

    if (attemptCount >= 5) {
      await lockAccount(user.id)
      await logAccountLockout({
        userId: user.id,
        reason: 'max_failed_attempts',
        duration: 3600,
        unlockAt: Date.now() + 3600000
      }, db)
    }

    return { success: false, error: 'Invalid credentials' }
  }

  // Login successful - clear failed attempts
  await clearFailedAttempts(user.id)
  return { success: true, token: generateToken(user) }
}
```

### Rate Limiting

Rate limit violations should be logged:

```typescript
import { logRateLimitExceeded } from '../utils/securityLogger'

async function checkRateLimit(userId: string, endpoint: string) {
  const count = await getRequestCount(userId, endpoint, 60) // last 60 seconds

  if (count > RATE_LIMITS[endpoint]) {
    await logRateLimitExceeded({
      endpoint,
      limit: RATE_LIMITS[endpoint],
      windowSeconds: 60,
      attemptCount: count
    }, db)

    return false
  }

  return true
}
```

## Monitoring and Alerting

### Dashboard Integration

Security event statistics can be displayed in an admin dashboard:

```typescript
async function getSecurityDashboard(companyId: string) {
  // Get stats for different time periods
  const last24Hours = await getSecurityEventStats(companyId, db, 24 * 60 * 60 * 1000)
  const last7Days = await getSecurityEventStats(companyId, db, 7 * 24 * 60 * 60 * 1000)
  const last30Days = await getSecurityEventStats(companyId, db, 30 * 24 * 60 * 60 * 1000)

  // Get recent critical events
  const recentCritical = await querySecurityEvents(companyId, db, {
    dateFrom: Date.now() - (24 * 60 * 60 * 1000),
    limit: 10
  })

  return {
    stats: {
      last24Hours,
      last7Days,
      last30Days
    },
    recentEvents: recentCritical
  }
}
```

### Alert Thresholds

Recommended thresholds for automated alerts:

- **Failed Logins**: > 10 in 1 hour → Alert for potential brute force
- **Authorization Failures**: > 5 in 1 hour → Alert for potential IDOR attack
- **Rate Limit Exceeded**: Any occurrence → Alert for API abuse
- **Suspicious Activity**: Any 'high' or 'critical' severity → Immediate alert
- **Account Lockouts**: Any occurrence → Notify security team

## Testing

The security logger includes comprehensive tests covering:

1. **Basic Functionality**
   - Event logging to audit store
   - Context handling (user/company ID)
   - Error handling without throwing

2. **Event Type Helpers**
   - Failed login logging
   - Authorization failure logging
   - Rate limit exceeded logging
   - Suspicious activity logging
   - Account lockout logging

3. **Security Features**
   - Sensitive data sanitization
   - Immutability verification
   - Log integrity

4. **Query Functions**
   - Event querying with filters
   - Statistics calculation
   - Time range filtering

**Test Results:** ✅ All 29 tests passing

Run tests:
```bash
npm test -- securityLogger.test.ts
```

## Best Practices

### When to Log

**Always log:**
- Failed authentication attempts
- Authorization failures (potential IDOR attacks)
- Rate limit violations
- Account lockouts
- Privilege escalation attempts
- Unusual access patterns

**Don't log:**
- Successful operations (use regular audit log)
- Legitimate user actions
- System health checks
- Internal service calls

### What to Include

**Do include:**
- Event type and timestamp
- User and company IDs
- Resource type and ID (for authorization failures)
- IP address (if available)
- User agent (if available)
- Relevant context and indicators

**Don't include:**
- Passwords or passphrases
- Encryption keys
- Session tokens
- Personal sensitive data beyond identification

### Performance Considerations

- Security logging is non-blocking (returns null on error, doesn't throw)
- Uses existing audit log infrastructure (optimized indexes)
- Batch queries available for statistics
- Logs are indexed by company_id and timestamp for fast queries

## Compliance

The security event logging system supports compliance with:

- **SOC 2 Type II**: Comprehensive security monitoring and incident detection
- **GDPR**: Audit trail for data access attempts
- **HIPAA**: Security event logging for protected health information systems
- **PCI DSS**: Logging and monitoring of access to cardholder data
- **General Audit Requirements**: 7-year retention of financial system security events

## Future Enhancements

Potential improvements for future implementation:

1. **Real-time Alerting**: Integrate with notification system for critical events
2. **Machine Learning**: Anomaly detection for suspicious patterns
3. **Geographic Analysis**: Track login locations and flag unusual access
4. **Session Analysis**: Correlate events across user sessions
5. **Export Functionality**: Generate security reports for auditors
6. **Dashboard Visualization**: Real-time security event dashboard
7. **Automated Response**: Trigger security actions based on event patterns

## Related Documentation

- **Authorization System**: `src/utils/authorization.ts`
- **Audit Log Infrastructure**: `src/services/audit.ts`
- **Database Schema**: `src/db/schema/audit.schema.ts`
- **Security Hardening Roadmap**: `Roadmaps/SECURITY_HARDENING_ROADMAP.md`

## Support

For questions or issues related to security event logging:

1. Review this documentation
2. Check the test suite for usage examples
3. Consult the security hardening roadmap
4. Review the agent review checklist for security standards

---

**Implementation Completed:** 2026-02-23
**Task:** S5-2 - Security Event Logging [HIGH]
**Status:** ✅ COMPLETED
