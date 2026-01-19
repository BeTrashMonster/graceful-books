# Authentication & Session Management

This module implements the authentication and session management system for Graceful Books, following zero-knowledge encryption principles.

## Overview

The authentication system provides:

- **Passphrase-based authentication** - No plaintext passphrases stored or transmitted
- **Session token management** - Secure token generation, validation, and renewal
- **Remember device functionality** - Optional device token for convenience
- **Secure cleanup** - Proper session clearing on logout, timeout, or tab close

## Architecture

### Zero-Knowledge Authentication

The authentication flow follows zero-knowledge principles:

1. User enters passphrase (never transmitted)
2. Passphrase derives encryption key locally using PBKDF2 (Argon2id in production)
3. Derived key attempts to decrypt test data
4. If successful, user is authenticated and session is created
5. Master key stays in memory only, cleared on logout

### Session Lifecycle

```
Login → Session Created → Token Generated → Auto-Renewal → Logout/Timeout
```

- **Session Duration**: 30 minutes (configurable)
- **Idle Timeout**: 15 minutes (configurable)
- **Auto-Renewal**: 5 minutes before expiration
- **Device Token**: 30 days (configurable)

## Modules

### 1. types.ts

Type definitions for authentication system:
- `SessionTokenPayload` - Token payload structure
- `SessionState` - Active session state in memory
- `DeviceToken` - Remember device token
- `LoginRequest` / `LoginResponse` - Login flow types
- `AuthConfig` - Configuration options

### 2. session.ts

Session token management:
- `generateSessionToken()` - Create secure session token
- `validateSessionToken()` - Verify token validity
- `createSession()` - Initialize session state
- `renewSession()` - Renew token before expiration
- `clearSession()` - Remove session from memory
- `updateSessionActivity()` - Reset idle timeout

### 3. login.ts

Passphrase authentication:
- `login()` - Authenticate with passphrase
- `createPassphraseTestData()` - Create test data for new account
- `validatePassphraseStrength()` - Check passphrase security
- Rate limiting for failed attempts
- Timing attack mitigation

### 4. sessionStorage.ts

Device token and storage:
- `createDeviceToken()` - Generate device token
- `getDeviceToken()` - Retrieve stored token
- `revokeDeviceToken()` - Remove device token
- `generateDeviceFingerprint()` - Create device identifier
- `storeSessionToken()` - Save token to sessionStorage
- `encryptDeviceHint()` - Encrypt hint for faster login

### 5. logout.ts

Secure cleanup:
- `logout()` - Full logout with cleanup
- `emergencyLogout()` - Immediate security logout
- `setupLogoutHandlers()` - Setup auto-logout triggers
- `clearDataOnLogout()` - Targeted data clearing
- `logoutWithConfirmation()` - User-confirmed logout

## Usage Examples

### Basic Login

```typescript
import { login, createPassphraseTestData } from '@/auth';

// First time setup (account creation)
const testData = await createPassphraseTestData('my-secure-passphrase', 'company-123');
await storePassphraseTestData(testData);

// Subsequent logins
const response = await login({
  passphrase: 'my-secure-passphrase',
  companyId: 'company-123',
  userIdentifier: 'user@example.com',
  rememberDevice: true,
  deviceFingerprint: await getDeviceFingerprint(),
});

if (response.success) {
  console.log('Login successful!', response.token);
} else {
  console.error('Login failed:', response.error);
}
```

### Session Management

```typescript
import {
  getActiveSession,
  updateSessionActivity,
  hasActiveSession,
  addSessionEventListener
} from '@/auth';

// Check if user is logged in
if (hasActiveSession()) {
  const session = getActiveSession();
  console.log('User:', session?.userId);
}

// Update activity on user interaction
document.addEventListener('click', () => {
  updateSessionActivity();
});

// Listen to session events
addSessionEventListener((event) => {
  if (event.type === 'timeout') {
    alert('Session expired due to inactivity');
  }
});
```

### Remember Device

```typescript
import {
  isDeviceRemembered,
  getDeviceToken,
  revokeDeviceToken
} from '@/auth';

// Check if device is remembered
const remembered = await isDeviceRemembered('company-123');
if (remembered) {
  console.log('Welcome back! This device is trusted.');
}

// Revoke device (forget this device)
await revokeDeviceToken('company-123');
```

### Logout

```typescript
import { logout, setupLogoutHandlers } from '@/auth';

// Setup automatic logout handlers
setupLogoutHandlers('company-123');

// User-initiated logout
await logout({
  reason: 'user_initiated',
  forgetDevice: false, // Keep device token
});

// Security logout (forget all devices)
await logout({
  reason: 'security',
  forgetDevice: true,
  revokeAllSessions: true,
});
```

## Security Features

### 1. No Passphrase Transmission
- Passphrase never sent to server
- Used only for local key derivation
- Cleared from memory after use

### 2. Timing Attack Mitigation
- Constant-time passphrase validation
- Random delays on failed attempts
- No timing information leakage

### 3. Rate Limiting
- 5 failed attempts maximum (configurable)
- 15-minute lockout after max attempts
- Per-user tracking

### 4. Token Security
- Cryptographically secure random tokens
- HMAC signature verification
- Automatic expiration and renewal
- Rotation on security events

### 5. Memory Safety
- Master key only in memory
- Zero-out key material on logout
- No key persistence to disk

### 6. Device Fingerprinting

Device fingerprinting is used for the "Remember this device" convenience feature.

**Purpose:**
- Reduces login friction for returning users
- Allows skipping full passphrase entry on recognized devices
- Provides a secondary validation layer (not primary security)

**Data collected:**
- User agent string (browser, version, OS)
- Browser language preference
- Screen dimensions (width, height, color depth)
- Timezone offset
- Canvas rendering characteristics

**How it works:**
- Combines multiple browser/system attributes
- Validates on each device token use
- Revoked on fingerprint mismatch

**IMPORTANT: Security Limitations**

Device fingerprinting is a **CONVENIENCE feature, NOT a security feature**:

1. **Fingerprints can be spoofed** - A malicious actor with access to the fingerprint hash can potentially replay it
2. **Not unique** - Many users share identical fingerprints due to common configurations
3. **Changes over time** - Browser updates or OS changes can alter the fingerprint
4. **Privacy tools interfere** - Users with privacy extensions may have blocked fingerprinting
5. **Not tamper-proof** - Client-side fingerprints can be modified

**Recommendations:**
- For high-security scenarios, implement MFA (TOTP, WebAuthn)
- Device tokens should have reasonable expiration (default: 30 days)
- Require re-authentication for sensitive operations (password change, data export)
- Educate users that "Remember this device" is for convenience, not security

**User-facing disclaimer:**

Use `getDeviceFingerprintDisclaimer()` to display appropriate messaging:

```typescript
import { getDeviceFingerprintDisclaimer } from '@/auth';

// Returns: "Device recognition is a convenience feature to reduce login friction.
// It does not replace strong authentication. For sensitive operations,
// additional verification may be required."
```

## Configuration

Default configuration in `DEFAULT_AUTH_CONFIG`:

```typescript
{
  sessionExpirationMs: 30 * 60 * 1000,      // 30 minutes
  idleTimeoutMs: 15 * 60 * 1000,            // 15 minutes
  deviceTokenExpirationMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  renewalThresholdMs: 5 * 60 * 1000,        // 5 minutes
  maxFailedAttempts: 5,
  rateLimitDurationMs: 15 * 60 * 1000,      // 15 minutes
  useHttpOnlyCookies: false,                // Client-side app
  enableDeviceFingerprinting: true,
}
```

Override via `login()` or session functions:

```typescript
const customConfig = {
  ...DEFAULT_AUTH_CONFIG,
  sessionExpirationMs: 60 * 60 * 1000, // 1 hour
};

await login(request, customConfig);
```

## Error Handling

### Login Errors

```typescript
const response = await login(request);

if (!response.success) {
  switch (response.errorCode) {
    case 'INVALID_PASSPHRASE':
      // Wrong passphrase
      break;
    case 'RATE_LIMITED':
      // Too many failed attempts
      break;
    case 'ACCOUNT_LOCKED':
      // Account locked for security
      break;
    case 'UNKNOWN_ERROR':
      // System error
      break;
  }
}
```

### Token Validation Errors

```typescript
const validation = await validateSessionToken(token);

if (!validation.isValid) {
  switch (validation.errorCode) {
    case 'EXPIRED':
      // Token expired, need to login
      break;
    case 'INVALID_SIGNATURE':
      // Token tampered with
      break;
    case 'MALFORMED':
      // Invalid token format
      break;
  }
}
```

## Testing

The module includes comprehensive test coverage:

- Unit tests for all authentication functions
- Integration tests for complete auth flow
- Security tests for timing attacks
- Performance tests for key derivation

## Browser Compatibility

Requires modern browsers with Web Crypto API support:
- Chrome 37+
- Firefox 34+
- Safari 11+
- Edge 79+

## Production Considerations

### 1. Use Argon2id

Replace PBKDF2 with Argon2id for production:

```typescript
// Use argon2-browser or similar WebAssembly library
import argon2 from 'argon2-browser';

const hash = await argon2.hash({
  pass: passphrase,
  salt: saltBytes,
  time: 3,
  mem: 65536,
  hashLen: 32,
  parallelism: 4,
  type: argon2.ArgonType.Argon2id,
});
```

### 2. Server-Side Validation

Add server-side session validation:
- Verify token signatures server-side
- Maintain session registry
- Support token revocation

### 3. IndexedDB Storage

Move from localStorage to IndexedDB:
- Better performance for large data
- Structured storage
- Async operations

### 4. Audit Logging

Implement comprehensive audit trail:
- Login/logout events
- Failed attempts
- Token renewals
- Security events

### 5. Multi-Factor Authentication

Add optional MFA:
- TOTP (Time-based One-Time Password)
- SMS/Email verification
- Hardware keys (WebAuthn)

**Recommended for sensitive operations:**
- Password/passphrase changes
- Data export or backup
- Payment information updates
- User role changes
- Device management (revoking remembered devices)

Note: The "Remember this device" feature should NOT bypass MFA requirements
for sensitive operations. Device recognition is a convenience feature only.

## Dependencies

- **Web Crypto API** - Cryptographic operations
- **Browser Storage** - localStorage, sessionStorage
- **No external libraries** - Pure TypeScript implementation

## Spec Compliance

This implementation satisfies all requirements from:
- `openspec/changes/foundation-infrastructure/specs/authentication/spec.md`

Key requirements implemented:
- ✅ Passphrase-based authentication
- ✅ Session token management
- ✅ Remember device functionality
- ✅ Secure session cleanup
- ✅ Rate limiting
- ✅ Auto-renewal
- ✅ Idle timeout
- ✅ Zero-knowledge architecture
