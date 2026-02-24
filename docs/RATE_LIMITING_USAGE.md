# Rate Limiting Usage Guide

This guide explains how to use the enhanced rate limiting functionality implemented in S5-3.

## Overview

The rate limiter prevents abuse through:
- **Brute force attacks** on login (5 attempts per minute per user)
- **Data scraping** (100 data access operations per minute per user)
- **Batch query abuse** (10 batch queries per minute per user)
- **CPG calculation abuse** (50 calculations per hour per user)

## Basic Usage

### Import the Rate Limiter

```typescript
import { rateLimiter, SECURITY_RATE_LIMITS } from '@/utils/rateLimiter';
```

### Check Rate Limit (Returns Result)

```typescript
// Check rate limit for a user-specific operation
const result = await rateLimiter.check(
  'login',
  SECURITY_RATE_LIMITS.login,
  userId // optional user ID
);

if (!result.allowed) {
  return {
    error: `Too many attempts. Please wait ${formatWaitTime(result.waitTimeMs)}.`,
    retryAfter: result.resetsAt
  };
}

// Proceed with operation
await performLogin(credentials);
```

### Check Rate Limit (Throws Error)

```typescript
try {
  await rateLimiter.checkOrThrow(
    'login',
    SECURITY_RATE_LIMITS.login,
    userId
  );

  // Proceed with operation
  await performLogin(credentials);
} catch (error) {
  if (error instanceof RateLimitError) {
    return {
      error: error.message, // User-friendly message
      waitTimeMs: error.waitTimeMs
    };
  }
  throw error;
}
```

## Security Logging Integration

### Check with Automatic Logging

```typescript
import { logRateLimitExceeded } from '@/utils/securityLogger';
import { db } from '@/db';

// Rate limit with automatic security logging
const result = await rateLimiter.checkWithLogging(
  'login',
  SECURITY_RATE_LIMITS.login,
  {
    userId: email,
    db: db,
    logRateLimitExceeded: logRateLimitExceeded,
    endpoint: '/api/auth/login'
  }
);

if (!result.allowed) {
  // Rate limit violation has already been logged to security audit log
  return { error: 'Too many login attempts. Please wait before trying again.' };
}
```

### Check with Logging (Throws Error)

```typescript
try {
  await rateLimiter.checkWithLoggingOrThrow(
    'login',
    SECURITY_RATE_LIMITS.login,
    {
      userId: email,
      db: db,
      logRateLimitExceeded: logRateLimitExceeded,
      endpoint: '/api/auth/login'
    }
  );

  // Proceed with login
  const session = await createSession(email);
  return { success: true, session };
} catch (error) {
  if (error instanceof RateLimitError) {
    // Already logged to security audit log
    return { error: 'Too many attempts. Please wait.' };
  }
  throw error;
}
```

## Available Rate Limit Configurations

### Security Rate Limits

```typescript
SECURITY_RATE_LIMITS.login
// 5 attempts per minute per user
// Use for: Login attempts, password resets

SECURITY_RATE_LIMITS.dataAccess
// 100 operations per minute per user
// Use for: API requests, database queries, data exports

SECURITY_RATE_LIMITS.batchQuery
// 10 operations per minute per user
// Use for: Batch data fetches, bulk exports, report generation

SECURITY_RATE_LIMITS.cpgCalculation
// 50 operations per hour per user
// Use for: CPG/CPU calculations, complex computations
```

### Crypto Rate Limits

```typescript
CRYPTO_RATE_LIMITS.keyDerivation
// 5 operations per minute
// Use for: Passphrase-based key derivation (Argon2id)

CRYPTO_RATE_LIMITS.batchEncrypt
// 10 operations per minute
// Use for: Batch encryption operations

CRYPTO_RATE_LIMITS.fileEncrypt
// 20 operations per minute
// Use for: File encryption operations

CRYPTO_RATE_LIMITS.reencrypt
// 5 operations per minute
// Use for: Key rotation, re-encryption operations
```

## Checking Quota Status

Display remaining quota to users without consuming a request:

```typescript
const status = rateLimiter.getQuotaStatus(
  'dataAccess',
  SECURITY_RATE_LIMITS.dataAccess,
  userId
);

console.log(`${status.remaining} of ${status.maxOperations} requests remaining`);
console.log(`Quota resets at: ${new Date(status.resetsAt)}`);
```

## Custom Rate Limits

Create custom rate limits for specific operations:

```typescript
import type { RateLimitConfig } from '@/utils/rateLimiter';

const customLimit: RateLimitConfig = {
  maxOperations: 10,
  windowMs: 5 * 60 * 1000, // 5 minutes
};

const result = await rateLimiter.check('customOperation', customLimit, userId);
```

## Best Practices

### 1. Use User-Specific Rate Limiting

Always provide a userId for operations that should be rate-limited per user:

```typescript
// ✅ Good - rate limits per user
await rateLimiter.check('login', SECURITY_RATE_LIMITS.login, userId);

// ❌ Bad - rate limits globally (all users share the limit)
await rateLimiter.check('login', SECURITY_RATE_LIMITS.login);
```

### 2. Log Security-Critical Rate Limits

Use `checkWithLogging()` for security-critical operations:

```typescript
// ✅ Good - logs rate limit violations to security audit log
await rateLimiter.checkWithLogging('login', SECURITY_RATE_LIMITS.login, {
  userId,
  db,
  logRateLimitExceeded,
  endpoint: '/api/auth/login'
});

// ⚠️ Acceptable for non-security operations
await rateLimiter.check('dataAccess', SECURITY_RATE_LIMITS.dataAccess, userId);
```

### 3. Provide User-Friendly Error Messages

Follow the Steadiness communication style:

```typescript
if (!result.allowed) {
  // ✅ Good - patient, supportive, clear
  return {
    error: "We're seeing a lot of activity from your account. Please take a moment and try again in a few seconds.",
    retryAfter: result.resetsAt
  };

  // ❌ Bad - blaming, technical
  return {
    error: "Rate limit exceeded. Too many requests.",
    code: 429
  };
}
```

### 4. Handle Rate Limit Errors Gracefully

```typescript
try {
  await rateLimiter.checkOrThrow('login', SECURITY_RATE_LIMITS.login, userId);
  await performLogin();
} catch (error) {
  if (error instanceof RateLimitError) {
    // Show user-friendly message with retry information
    showNotification({
      type: 'warning',
      message: `Please wait ${formatWaitTime(error.waitTimeMs)} before trying again.`
    });
    return;
  }
  // Handle other errors
  throw error;
}
```

## Testing

The rate limiter can be disabled for testing:

```typescript
import { rateLimiter } from '@/utils/rateLimiter';

beforeEach(() => {
  rateLimiter.setEnabled(false); // Disable for tests
});

afterEach(() => {
  rateLimiter.setEnabled(true); // Re-enable
  rateLimiter.clear(); // Clear all recorded operations
});
```

## Implementation Details

- **Algorithm**: Sliding window (more accurate than fixed window)
- **Storage**: In-memory (resets on page reload)
- **Cleanup**: Automatic cleanup every 5 minutes to prevent memory leaks
- **User Tracking**: Composite keys (`operationKey:userId`)
- **Logging**: Async (non-blocking) integration with S5-2 security event logging

## Error Codes

When rate limits are exceeded, you can return standardized error codes:

```typescript
if (!result.allowed) {
  return {
    error: 'RATE_LIMITED',
    message: 'Too many requests. Please wait before trying again.',
    retryAfter: result.resetsAt,
    waitTimeMs: result.waitTimeMs
  };
}
```

## See Also

- `src/utils/rateLimiter.ts` - Implementation
- `src/__tests__/utils/rateLimiter.test.ts` - Test examples
- `src/utils/securityLogger.ts` - Security event logging (S5-2)
- `Roadmaps/SECURITY_HARDENING_ROADMAP.md` - Full security roadmap
