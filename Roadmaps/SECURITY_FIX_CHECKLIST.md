# Security Fix Checklist

**Target:** Improve security score from 7.5/10 to 9-10/10
**Created:** January 18, 2026
**Reference Documents:**
- `SECURITY_REVIEW.md` - Full audit findings
- `SECURITY_FIXES.md` - Implementation guide with code examples

---

## Current Security Score: 8.5/10 (Updated after Phase 1)

| Category | Previous | Current | Target |
|----------|----------|---------|--------|
| Cryptographic Implementation | 9/10 | 9/10 | 9/10 |
| Authentication & Session Management | 8/10 | 9/10 | 9/10 |
| Dependency Management | 5/10 | 9/10 | 9/10 |
| Defense-in-Depth (CSP, Headers) | 6/10 | 8/10 | 9/10 |
| Overall Architecture | 8/10 | 8/10 | 9/10 |

---

## Phase 1: High Severity Fixes (Critical Path) - COMPLETED

### H-1: Encrypt localStorage Data
**Status:** [x] Complete  [x] Verified (25 tests passing)

**Files created:**
- `src/utils/secureStorage.ts` - SecureLocalStorage class with AES-256-GCM encryption
- `src/utils/secureStorage.test.ts` - 25 comprehensive unit tests

**Files modified:**
- `src/auth/login.ts` - Updated to use SecureLocalStorage
- `src/auth/sessionStorage.ts` - Updated to use SecureLocalStorage
- `src/utils/index.ts` - Added exports

**Completed Tasks:**
- [x] Create `SecureLocalStorage` class with encryption wrapper
- [x] Implement device-specific key derivation using PBKDF2 (100,000 iterations)
- [x] Update `loadPassphraseTestData()` to use encrypted storage
- [x] Update `storeDeviceToken()` to use encrypted storage
- [x] Update `getDeviceToken()` to use encrypted storage
- [x] AES-256-GCM provides authenticated encryption (integrity)
- [x] Migrate any existing unencrypted data on first load
- [x] Add unit tests for SecureLocalStorage (25 tests)

**Acceptance Criteria Met:**
- [x] All sensitive localStorage data is encrypted at rest
- [x] Device fingerprint-derived key works across page reloads
- [x] Browser extensions cannot read plaintext auth data
- [x] Migration handles existing unencrypted data gracefully
- [x] Tests pass (25/25 passing)

---

### H-2: Fix Dependency Vulnerabilities
**Status:** [x] Complete  [x] Verified (0 production vulnerabilities)

**Changes Made:**
| Package | Before | After | Result |
|---------|--------|-------|--------|
| mjml | 4.18.0 | REMOVED | Fixed (not used) |
| vite | 5.1.3 | 6.4.1 | Fixed |
| vitest | 1.2.2 | 4.0.17 | Fixed |
| @vitest/ui | 1.2.2 | 4.0.17 | Fixed |
| @lhci/cli | 0.13.0 | 0.15.1 | Fixed |

**Completed Tasks:**
- [x] Upgrade Vite to latest version (6.4.1)
- [x] Upgrade @vitest/ui to 4.0.17
- [x] Evaluated mjml - not used in project, removed
- [x] Run `npm audit --production` - **0 vulnerabilities**
- [ ] Set up Dependabot or Renovate (future task)
- [ ] Add dependency scanning to CI/CD (future task)

**Acceptance Criteria Met:**
- [x] `npm audit --production` shows 0 vulnerabilities
- [ ] Automated dependency scanning configured in CI (pending)

---

### H-3: Implement Content Security Policy
**Status:** [x] Complete  [x] Verified (28 tests passing)

**Files created:**
- `src/config/securityHeaders.ts` - Full CSP and security headers configuration
- `src/config/index.ts` - Config module exports
- `src/__tests__/config/securityHeaders.test.ts` - 28 comprehensive tests

**Files modified:**
- `index.html` - Added CSP meta tag fallback
- `vite.config.ts` - Added security headers middleware for dev server

**Completed Tasks:**
- [x] Create `securityHeaders.ts` configuration file
- [x] Add CSP meta tag to `index.html`
- [x] Configure Vite middleware for development server headers
- [x] Add X-Frame-Options: DENY
- [x] Add X-Content-Type-Options: nosniff
- [x] Add Referrer-Policy: no-referrer
- [x] Add Permissions-Policy to restrict APIs
- [x] Add Strict-Transport-Security header (production only)
- [x] Test that application works with CSP enabled
- [ ] Set up CSP violation reporting (future enhancement)

**CSP Directives Implemented:**
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self';
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none'
```

**Acceptance Criteria Met:**
- [x] All security headers present in responses
- [x] Application functions correctly with CSP
- [x] No CSP violations in console during normal use
- [ ] securityheaders.com gives A+ rating (needs production deployment)
- [ ] CSP violation reporting endpoint configured (future enhancement)

**Reference:** See `SECURITY_FIXES.md` H-3 section for complete implementation

---

## Phase 2: Medium Severity Fixes (Pre-Production Required)

### M-1: File Upload Validation
**Status:** [ ] Not Started  [ ] In Progress  [ ] Complete  [ ] Verified

**Files to modify:**
- `src/components/reconciliation/steps/UploadStatementStep.tsx` (lines 41-67)

**New file to create:**
- `src/utils/fileValidation.ts`

**Tasks:**
- [ ] Create `FileValidator` utility class
- [ ] Implement file size validation (max 10MB)
- [ ] Implement magic number verification for PDF
- [ ] Implement CSV content structure validation
- [ ] Add minimum file size check (prevent empty files)
- [ ] Update UploadStatementStep to use FileValidator
- [ ] Add user-friendly error messages for each validation failure
- [ ] Add rate limiting on upload operations
- [ ] Write unit tests for FileValidator

**Magic Numbers to verify:**
| Type | Magic Number (hex) |
|------|-------------------|
| PDF | 25 50 44 46 (%PDF) |
| PNG | 89 50 4E 47 |
| JPG | FF D8 FF |

**Acceptance Criteria:**
- [ ] Files over 10MB are rejected with clear message
- [ ] Empty files are rejected
- [ ] Non-matching MIME types are rejected
- [ ] Spoofed file extensions are detected via magic number
- [ ] Malformed CSV files are rejected
- [ ] All validation errors show user-friendly messages

**Reference:** See `SECURITY_FIXES.md` M-1 section for complete implementation

---

### M-2: Fix Timing Attack in String Comparison
**Status:** [ ] Not Started  [ ] In Progress  [ ] Complete  [ ] Verified

**Files to modify:**
- `src/crypto/keyDerivation.ts` (lines 337-348)

**New file to create:**
- `src/utils/crypto/constantTime.ts`

**Tasks:**
- [ ] Create improved `constantTimeEqual()` function
- [ ] Create `constantTimeEqualBytes()` for Uint8Array comparison
- [ ] Pad strings to same length before comparison
- [ ] Compare lengths in constant time (not early return)
- [ ] Update `keyDerivation.ts` to use new utility
- [ ] Search codebase for other string comparisons needing update
- [ ] Add unit tests including timing verification

**Current vulnerable code:**
```typescript
// Early return leaks length information
if (a.length !== b.length) {
  return false;
}
```

**Acceptance Criteria:**
- [ ] No early returns on length mismatch
- [ ] Comparison time is independent of input values
- [ ] All security-sensitive comparisons use utility
- [ ] Unit tests verify constant-time behavior

**Reference:** See `SECURITY_FIXES.md` M-2 section for complete implementation

---

### M-3: Document Device Fingerprinting Limitations
**Status:** [ ] Not Started  [ ] In Progress  [ ] Complete  [ ] Verified

**Files to modify:**
- `src/auth/sessionStorage.ts` (lines 30-64)

**Tasks:**
- [ ] Add code comments documenting security limitations
- [ ] Add UI disclaimer that "Remember this device" is convenience feature
- [ ] Consider additional checks (MFA for sensitive operations)
- [ ] Document fingerprinting approach in security docs
- [ ] Add anomaly detection for device token usage patterns

**Acceptance Criteria:**
- [ ] Code comments clearly state fingerprinting limitations
- [ ] User-facing UI explains feature is convenience, not security
- [ ] Documentation updated with security considerations

---

### M-4: Implement Rate Limiting
**Status:** [ ] Not Started  [ ] In Progress  [ ] Complete  [ ] Verified

**Files to modify:**
- `src/crypto/encryption.ts`
- `src/crypto/keyDerivation.ts`

**New file to create:**
- `src/utils/rateLimiter.ts`

**Tasks:**
- [ ] Create `RateLimiter` utility class
- [ ] Add periodic cleanup of old operations
- [ ] Implement rate limiting on key derivation (Argon2id/PBKDF2)
- [ ] Implement rate limiting on batch encryption/decryption
- [ ] Implement rate limiting on file encryption
- [ ] Add user-friendly error messages with wait times
- [ ] Configure reasonable limits:
  - Key derivation: 5 operations/minute
  - Batch encrypt: 10 operations/minute
  - File encrypt: 20 operations/minute
- [ ] Add unit tests for rate limiter

**Acceptance Criteria:**
- [ ] Excessive operations are blocked with clear message
- [ ] Wait time is communicated to user
- [ ] Rate limiting prevents client-side DoS
- [ ] Normal usage patterns are not affected

**Reference:** See `SECURITY_FIXES.md` M-4 section for complete implementation

---

### M-5: Add ESLint Security Rules
**Status:** [ ] Not Started  [ ] In Progress  [ ] Complete  [ ] Verified

**Files to modify:**
- `.eslintrc.cjs`
- `src/api/syncApi.ts` (lines 64, 77 - add comments for Math.random usage)

**New file to create:**
- `.eslintrc.security.js`

**Tasks:**
- [ ] Create security-focused ESLint rules file
- [ ] Add rule: no-restricted-globals for Math.random
- [ ] Add rule: no-eval
- [ ] Add rule: no-implied-eval
- [ ] Add rule: no-new-func
- [ ] Add rule: no-restricted-properties for innerHTML
- [ ] Add rule: no-console (warn except error/warn)
- [ ] Merge security rules into main ESLint config
- [ ] Add comments to legitimate Math.random usage in test/simulation code
- [ ] Fix any violations found by new rules
- [ ] Run full lint check

**Acceptance Criteria:**
- [ ] ESLint catches Math.random usage in production code
- [ ] ESLint catches eval and dangerous HTML methods
- [ ] All current violations fixed or properly annotated
- [ ] CI pipeline fails on security lint violations

**Reference:** See `SECURITY_FIXES.md` ESLint section for complete configuration

---

## Phase 3: Low Severity Fixes (Nice to Have)

### L-1: Sanitize Error Messages
**Status:** [ ] Not Started  [ ] In Progress  [ ] Complete  [ ] Verified

**Files to modify:**
- `src/auth/login.ts`
- `src/crypto/encryption.ts`

**Tasks:**
- [ ] Create error sanitization utility
- [ ] Define public error codes (e.g., ERR_AUTH_001)
- [ ] Map internal errors to generic user-facing messages
- [ ] Log detailed errors to secure logging service
- [ ] Update authentication errors to be generic
- [ ] Update crypto errors to be generic
- [ ] Add production/development flag for error detail level

**Acceptance Criteria:**
- [ ] No internal implementation details in user-facing errors
- [ ] Error codes allow debugging without exposing details
- [ ] Detailed errors logged securely for debugging

---

### L-2: Handle localStorage Quota
**Status:** [ ] Not Started  [ ] In Progress  [ ] Complete  [ ] Verified

**Files to modify:**
- All files using localStorage (via SecureLocalStorage wrapper)

**Tasks:**
- [ ] Add try/catch around all localStorage.setItem calls
- [ ] Detect QuotaExceededError
- [ ] Implement cleanup strategy for old entries
- [ ] Add warning to user when storage is nearly full
- [ ] Add storage usage monitoring utility

**Acceptance Criteria:**
- [ ] Quota exceeded errors handled gracefully
- [ ] User warned before storage full
- [ ] Old/stale entries cleaned up automatically

---

### L-3: Add Subresource Integrity (SRI)
**Status:** [ ] Not Started  [ ] In Progress  [ ] Complete  [ ] Verified

**Files to modify:**
- `index.html`

**Tasks:**
- [ ] Audit all external resources (CDNs, fonts, etc.)
- [ ] Generate SRI hashes for external resources
- [ ] Add integrity and crossorigin attributes
- [ ] Add build step to verify/update SRI hashes
- [ ] Consider self-hosting critical resources

**Acceptance Criteria:**
- [ ] All external resources have SRI hashes
- [ ] Build process validates SRI hashes
- [ ] CDN compromise would be detected

---

### L-4: Create Security Headers Documentation
**Status:** [ ] Not Started  [ ] In Progress  [ ] Complete  [ ] Verified

**New files to create:**
- `DEPLOYMENT_SECURITY.md`

**Tasks:**
- [ ] Document required HTTP security headers
- [ ] Document HTTPS enforcement procedures
- [ ] Document CSP configuration details
- [ ] Document CORS policy
- [ ] Document logging and monitoring setup
- [ ] Add deployment checklist

**Acceptance Criteria:**
- [ ] Complete documentation for production deployment
- [ ] Operations team can configure security correctly
- [ ] Checklist ensures no security settings missed

**Reference:** See `SECURITY_FIXES.md` Deployment Checklist section

---

## Phase 4: Continuous Security Improvements

### Automated Security Testing
**Status:** [ ] Not Started  [ ] In Progress  [ ] Complete  [ ] Verified

**Tasks:**
- [ ] Integrate SAST (Static Application Security Testing) in CI/CD
- [ ] Add dependency scanning to CI/CD (npm audit)
- [ ] Add unit tests for all crypto operations
- [ ] Add integration tests for authentication flows
- [ ] Set up fuzzing tests for input validation
- [ ] Configure CSP violation reporting endpoint
- [ ] Set up failed authentication monitoring

---

### Security Documentation
**Status:** [ ] Not Started  [ ] In Progress  [ ] Complete  [ ] Verified

**Files to create:**
- [ ] `SECURITY.md` - Responsible disclosure policy
- [ ] `DEPLOYMENT_SECURITY.md` - Production deployment guide
- [ ] `INCIDENT_RESPONSE.md` - Security incident procedures
- [ ] `USER_SECURITY_GUIDE.md` - End-user security best practices

---

### External Security Review
**Status:** [ ] Not Started  [ ] In Progress  [ ] Complete  [ ] Verified

**Tasks:**
- [ ] Schedule penetration testing with external firm
- [ ] Conduct black box testing
- [ ] Conduct white box code review
- [ ] Host threat modeling workshop
- [ ] Review security architecture
- [ ] Conduct incident response simulation

---

## Verification Checklist

### After All Fixes Complete:
- [ ] Run full test suite - all tests pass
- [ ] Run `npm audit --production` - 0 high/critical
- [ ] Run ESLint with security rules - 0 violations
- [ ] Test CSP - application works, no console violations
- [ ] Test localStorage encryption - data encrypted at rest
- [ ] Test file uploads - invalid files rejected
- [ ] Test rate limiting - excessive operations blocked
- [ ] Check securityheaders.com - A+ rating
- [ ] Review error messages - no internal details exposed
- [ ] Manual security testing of critical flows

### Security Metrics to Track:
| Metric | Target |
|--------|--------|
| Time to patch critical vulnerabilities | <24 hours |
| Dependency vulnerability count | 0 high/critical |
| Failed authentication rate | Monitor for spikes |
| CSP violation rate | Monitor for XSS attempts |
| Encryption operation success rate | >99.9% |

---

## Score Improvement Tracking

| Phase | Issues Fixed | Score Improvement |
|-------|--------------|-------------------|
| Phase 1 (High) | H-1, H-2, H-3 | 7.5 → 8.5 |
| Phase 2 (Medium) | M-1 through M-5 | 8.5 → 9.0 |
| Phase 3 (Low) | L-1 through L-4 | 9.0 → 9.5 |
| Phase 4 (Continuous) | Testing & Docs | 9.5 → 10.0 |

**Target Final Score: 9-10/10**

---

## Quick Reference Links

- Full Security Review: `../SECURITY_REVIEW.md`
- Implementation Guide: `../SECURITY_FIXES.md`
- Security Testing Roadmap: `SECURITY_TESTING_ROADMAP.md`
- Test Fix Checklist: `TEST_FIX_CHECKLIST.md`

---

**Checklist Version:** 1.0
**Last Updated:** January 18, 2026
**Owner:** Security Team
