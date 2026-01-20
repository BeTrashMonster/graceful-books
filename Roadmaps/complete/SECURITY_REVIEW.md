# Graceful Books Security Review
**Review Date:** January 18, 2026
**Reviewer:** Security Audit
**Application:** Graceful Books - Local-First Zero-Knowledge Accounting Platform
**Version:** 0.1.0 (Pre-production)

---

## Executive Summary

This comprehensive security review examines the Graceful Books application, a local-first accounting platform implementing zero-knowledge encryption architecture. The application demonstrates **strong security fundamentals** with well-designed encryption and authentication systems. However, several areas require attention before production deployment.

### Overall Security Posture: **GOOD** (7.5/10)

**Key Strengths:**
- Robust zero-knowledge encryption architecture using AES-256-GCM
- Proper use of Argon2id for key derivation (with PBKDF2 fallback)
- No server-side access to user data (true zero-knowledge)
- Comprehensive input validation on sync protocol
- Proper session management with timeout and renewal
- Audit logging infrastructure in place

**Critical Areas Requiring Attention:**
- High and moderate severity npm vulnerabilities in dependencies
- Sensitive data stored unencrypted in localStorage
- Missing Content Security Policy (CSP) implementation
- Limited XSS prevention in user-facing components
- No rate limiting on client-side encryption operations
- Missing integrity checks on uploaded files

---

## Findings by Severity

### CRITICAL SEVERITY

**None identified** - No critical vulnerabilities that pose immediate risk to user data or system integrity.

---

### HIGH SEVERITY

#### H-1: Unencrypted Sensitive Data in localStorage
**File(s):** `src/auth/login.ts`, `src/auth/sessionStorage.ts`
**Lines:** 359-380 (login.ts), 75-96 (sessionStorage.ts)

**Issue:**
Passphrase test data and device tokens are stored in localStorage without encryption:

```typescript
// src/auth/login.ts:359
async function loadPassphraseTestData(companyId: string): Promise<PassphraseTestData | null> {
  const stored = localStorage.getItem(`passphrase-test-${companyId}`);
  if (!stored) return null;
  return JSON.parse(stored);
}

// src/auth/sessionStorage.ts:95
export async function storeDeviceToken(deviceToken: DeviceToken): Promise<void> {
  const key = `${DEVICE_TOKEN_KEY_PREFIX}-${deviceToken.companyId}`;
  localStorage.setItem(key, JSON.stringify(deviceToken)); // UNENCRYPTED
}
```

**Impact:**
- Browser extensions or malicious scripts could access passphrase test data
- Device tokens could be stolen for unauthorized device access
- XSS attacks could exfiltrate authentication material

**Recommendation:**
1. Encrypt all authentication-related data before storing in localStorage
2. Use the Web Crypto API with a device-specific key derived from browser fingerprint
3. Consider using IndexedDB with encryption instead of localStorage
4. Implement additional integrity checks (HMAC) on stored data

**Remediation Priority:** Immediate

---

#### H-2: Dependency Vulnerabilities
**File:** `package.json`
**npm audit results:**

**High Severity:**
- `html-minifier` - REDoS vulnerability (GHSA-pfq8-rq6v-vf5m)
  - Used by `mjml` package
  - CVE Score: 7.5 (High)
  - No fix available

**Moderate Severity:**
- `esbuild` - Development server request forgery (GHSA-67mh-4wv8-2f99)
  - CVE Score: 5.3 (Moderate)
  - Fix available via Vite upgrade

- `@vitest/ui` - Multiple vulnerabilities
  - Fix available (upgrade to 4.0.17)

**Impact:**
- ReDoS could cause denial of service during email template processing
- Development server vulnerability could expose source code
- Testing library vulnerabilities could affect build pipeline security

**Recommendation:**
1. **Immediate:**
   - Replace `mjml` with a safer email template library or implement custom email rendering
   - Upgrade Vite to version 7.3.1+
   - Upgrade @vitest/ui to 4.0.17+

2. **Short-term:**
   - Implement dependency scanning in CI/CD pipeline
   - Set up automated dependency update PRs (Dependabot/Renovate)
   - Regular monthly security audits of dependencies

**Remediation Priority:** Within 1 week

---

#### H-3: Missing Content Security Policy (CSP)
**File(s):** `index.html`, Vite configuration

**Issue:**
No Content Security Policy headers are configured, leaving the application vulnerable to XSS attacks.

**Impact:**
- Malicious scripts could be injected and executed
- Data exfiltration through unauthorized network requests
- Clickjacking attacks possible

**Recommendation:**
Implement strict CSP headers:

```html
<!-- In index.html or via server headers -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
">
```

**Additional hardening:**
- Add `X-Frame-Options: DENY`
- Add `X-Content-Type-Options: nosniff`
- Add `Referrer-Policy: no-referrer`
- Add `Permissions-Policy` to restrict APIs

**Remediation Priority:** Within 2 weeks

---

### MEDIUM SEVERITY

#### M-1: Insufficient File Upload Validation
**File:** `src/components/reconciliation/steps/UploadStatementStep.tsx`
**Lines:** 41-67

**Issue:**
File upload validation only checks MIME type and extension, which can be spoofed:

```typescript
if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
  statement = await parsePDFStatement(file);
} else if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
  statement = await parseCSVStatement(file);
}
```

**Missing validations:**
- File size limits
- Magic number verification (file signature)
- Content validation before parsing
- Virus scanning
- Rate limiting on uploads

**Recommendation:**
```typescript
// Add comprehensive validation
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function validateFile(file: File): Promise<void> {
  // Size check
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large. Maximum size is 10MB.');
  }

  // Magic number verification
  const buffer = await file.slice(0, 4).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const isPDF = bytes[0] === 0x25 && bytes[1] === 0x50 &&
                bytes[2] === 0x44 && bytes[3] === 0x46;
  // Add CSV validation...

  if (!isPDF && !isCSV) {
    throw new Error('Invalid file format');
  }
}
```

**Remediation Priority:** Before production launch

---

#### M-2: Timing Attack Vulnerability in String Comparison
**File:** `src/crypto/keyDerivation.ts`
**Lines:** 337-348

**Issue:**
The constant-time comparison implementation is correct, but it's not consistently used throughout the codebase.

**Current implementation (GOOD):**
```typescript
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false; // POTENTIAL TIMING LEAK
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
```

**Issues:**
1. Early return on length mismatch leaks information
2. Not used consistently across all security-sensitive comparisons

**Recommendation:**
```typescript
function constantTimeEqual(a: string, b: string): boolean {
  // Pad to same length to prevent length-based timing
  const maxLength = Math.max(a.length, b.length);
  const paddedA = a.padEnd(maxLength, '\0');
  const paddedB = b.padEnd(maxLength, '\0');

  let result = 0;
  for (let i = 0; i < maxLength; i++) {
    result |= paddedA.charCodeAt(i) ^ paddedB.charCodeAt(i);
  }

  // Also compare lengths in constant time
  result |= a.length ^ b.length;

  return result === 0;
}
```

**Remediation Priority:** Before production launch

---

#### M-3: Weak Device Fingerprinting
**File:** `src/auth/sessionStorage.ts`
**Lines:** 30-64

**Issue:**
Device fingerprinting can be easily bypassed:

```typescript
export async function generateDeviceFingerprint(): Promise<string> {
  const components: string[] = [];
  components.push(navigator.userAgent); // Easily spoofed
  components.push(navigator.language);
  components.push(String(screen.width));
  // ... etc
}
```

**Impact:**
- Attackers could clone device fingerprints
- "Remember this device" feature provides false security
- Device tokens could be used on different devices

**Recommendation:**
1. Add disclaimer that device fingerprinting is convenience, not security
2. Implement additional checks:
   - IP address monitoring (if backend exists)
   - Behavior analysis (typing patterns, usage times)
   - Multi-factor authentication for sensitive operations
3. Consider using more robust fingerprinting libraries
4. Implement anomaly detection for device token usage

**Remediation Priority:** Before production launch

---

#### M-4: Missing Rate Limiting on Encryption Operations
**File:** `src/crypto/encryption.ts`, `src/crypto/keyDerivation.ts`

**Issue:**
No rate limiting on computationally expensive operations like:
- Key derivation (Argon2id/PBKDF2)
- Batch encryption/decryption
- File encryption

**Impact:**
- Client-side DoS attacks possible
- Battery drain on mobile devices
- Resource exhaustion in browser

**Recommendation:**
```typescript
class RateLimiter {
  private operations: Map<string, number[]> = new Map();

  async checkLimit(operation: string, maxOps: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const ops = this.operations.get(operation) || [];

    // Clean old operations
    const recentOps = ops.filter(time => now - time < windowMs);

    if (recentOps.length >= maxOps) {
      return false; // Rate limited
    }

    recentOps.push(now);
    this.operations.set(operation, recentOps);
    return true;
  }
}

// Usage in encryption module
const rateLimiter = new RateLimiter();

export async function batchEncrypt(...) {
  const allowed = await rateLimiter.checkLimit('batch-encrypt', 10, 60000);
  if (!allowed) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  // ... proceed with encryption
}
```

**Remediation Priority:** Before production launch

---

#### M-5: Insecure Random Number Generation Fallback
**File:** Multiple files using `Math.random()`
**Locations:** `src/api/syncApi.ts` lines 64, 77

**Issue:**
Using `Math.random()` for simulation is fine for testing, but ensure it's never used for security-critical operations:

```typescript
// src/api/syncApi.ts:64
if (Math.random() < 0.05) {
  throw new Error('Mock network error');
}
```

**Recommendation:**
1. Add code comments clearly marking test/simulation code
2. Implement linting rule to prevent `Math.random()` in production code
3. Use `crypto.getRandomValues()` for all random number generation
4. Add ESLint rule:

```json
{
  "rules": {
    "no-restricted-globals": ["error", {
      "name": "Math.random",
      "message": "Use crypto.getRandomValues() instead of Math.random() for security"
    }]
  }
}
```

**Remediation Priority:** Before production launch

---

### LOW SEVERITY

#### L-1: Verbose Error Messages in Production
**File:** `src/auth/login.ts`, `src/crypto/encryption.ts`
**Lines:** Various

**Issue:**
Error messages expose internal implementation details:

```typescript
// src/auth/login.ts:120
error: "That passphrase doesn't seem to match. Let's try again."
// vs more detailed errors in catch blocks
```

**Recommendation:**
- Implement error sanitization for production
- Log detailed errors server-side (if applicable) or to secure logging
- Return generic errors to users
- Add error codes for debugging without exposing details

**Remediation Priority:** Before production launch

---

#### L-2: localStorage Size Limits Not Handled
**File:** Multiple files using localStorage

**Issue:**
No handling for localStorage quota exceeded errors:

```typescript
localStorage.setItem(key, value); // Could fail if quota exceeded
```

**Recommendation:**
```typescript
function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      // Handle quota exceeded
      console.warn('localStorage quota exceeded');
      // Implement cleanup strategy
      cleanOldestEntries();
      return false;
    }
    throw e;
  }
}
```

**Remediation Priority:** Nice to have

---

#### L-3: No Subresource Integrity (SRI) for External Resources
**File:** `index.html`

**Issue:**
If any external resources are loaded (CDNs, fonts, etc.), they lack SRI hashes.

**Recommendation:**
```html
<link rel="stylesheet" href="https://example.com/style.css"
      integrity="sha384-..."
      crossorigin="anonymous">
```

**Remediation Priority:** Before using any external resources

---

#### L-4: Missing Security Headers Documentation
**Documentation gap**

**Issue:**
No documentation on required security headers for deployment.

**Recommendation:**
Create `DEPLOYMENT_SECURITY.md` with:
- Required HTTP security headers
- HTTPS enforcement procedures
- CSP configuration
- CORS policy
- Logging and monitoring setup

**Remediation Priority:** Before production launch

---

## Positive Security Practices Observed

### Excellent Implementation ✅

1. **Zero-Knowledge Architecture** (src/crypto/)
   - Proper AES-256-GCM implementation
   - Correct IV generation (96-bit random)
   - Authentication tags properly verified
   - No plaintext data ever transmitted

2. **Key Derivation** (src/crypto/keyDerivation.ts)
   - Argon2id with proper parameters (64MB memory, 3 iterations)
   - PBKDF2 fallback with scaled iterations
   - Salt generation using crypto.getRandomValues()
   - Secure key clearing (zeroing memory)

3. **Session Management** (src/auth/session.ts)
   - Automatic session renewal
   - Idle timeout implementation
   - Session token HMAC signing
   - Proper session cleanup on logout
   - Event-driven architecture for monitoring

4. **Authentication** (src/auth/login.ts)
   - Rate limiting on failed attempts
   - Account lockout after max attempts
   - Constant-time delay to prevent timing attacks
   - Test data for passphrase validation (zero-knowledge proof)
   - Passphrase strength validation

5. **Encryption Context Management** (src/crypto/types.ts)
   - Well-defined type system
   - Clear separation of master and derived keys
   - Key expiration support
   - Permission-based key hierarchy

6. **Database Design** (src/db/database.ts)
   - Soft delete implementation
   - Audit logging hooks
   - CRDT-compatible schema
   - Version vector tracking
   - Pagination limits enforced (max 500 items)

7. **Sync Protocol** (src/sync/syncProtocol.ts)
   - Comprehensive input validation
   - Protocol version checking
   - Payload size limits
   - Batch processing with size constraints
   - Conflict detection with version vectors

8. **Input Validation** (src/sync/syncProtocol.ts)
   - Type guards for all protocol messages
   - Validation before processing
   - Payload size checking
   - Version compatibility verification

---

## Security Architecture Analysis

### Threat Model Coverage

**Threats Mitigated:**
- ✅ Server-side data breach (zero-knowledge architecture)
- ✅ Man-in-the-middle attacks (encrypted payloads)
- ✅ Replay attacks (version vectors, timestamps)
- ✅ Brute force attacks (Argon2id, rate limiting)
- ✅ Timing attacks (constant-time comparisons)
- ✅ Session hijacking (session timeout, renewal)
- ✅ CSRF (local-first architecture reduces attack surface)

**Threats Requiring Additional Mitigation:**
- ⚠️ XSS attacks (need CSP, input sanitization)
- ⚠️ Client-side code injection (need CSP)
- ⚠️ Dependency vulnerabilities (need scanning)
- ⚠️ Physical device access (need encryption at rest)
- ⚠️ Browser extension attacks (need localStorage encryption)
- ⚠️ Social engineering (need user education)

---

## Compliance Considerations

### Data Protection
- ✅ GDPR-compliant (user controls data, can export/delete)
- ✅ CCPA-compliant (no data selling, user access rights)
- ✅ Zero-knowledge means minimal data processor liability

### Accounting Standards
- ✅ Audit trail for all financial transactions
- ✅ 7-year retention supported
- ✅ Immutable audit logs
- ⚠️ Need encryption of audit logs at rest

### Accessibility
- ✅ WCAG 2.1 AA compliance mentioned in docs
- ⚠️ Security features should maintain accessibility

---

## Recommended Security Roadmap

### Phase 1: Pre-Production 
1. **Week 1:**
   - Fix H-1: Encrypt localStorage data
   - Fix H-2: Update dependencies
   - Fix H-3: Implement CSP
   - Fix M-1: File upload validation

2. **Week 2:**
   - Fix M-2: Improve constant-time comparison
   - Fix M-3: Document device fingerprinting limitations
   - Fix M-4: Implement rate limiting
   - Fix M-5: Add linting rules for crypto operations

### Phase 2: Production Hardening 
1. Implement comprehensive logging and monitoring
2. Add security event alerting
3. Create incident response procedures
4. Pen testing with external security firm
5. Bug bounty program consideration

### Phase 3: Ongoing (Monthly)
1. Dependency security audits
2. Code security reviews
3. User security awareness updates
4. Threat model updates
5. Security metrics tracking

---

## Testing Recommendations

### Security Testing Checklist

**Automated Testing:**
- [ ] SAST (Static Application Security Testing) integration
- [ ] Dependency scanning in CI/CD
- [ ] Unit tests for all crypto operations
- [ ] Integration tests for authentication flows
- [ ] Fuzzing tests for input validation

**Manual Testing:**
- [ ] Penetration testing (black box)
- [ ] Code review (white box)
- [ ] Threat modeling workshop
- [ ] Security architecture review
- [ ] Incident response simulation

**Continuous Monitoring:**
- [ ] CSP violation reporting
- [ ] Failed authentication monitoring
- [ ] Unusual encryption operation patterns
- [ ] localStorage/sessionStorage access monitoring
- [ ] Performance metrics (DoS detection)

---

## Security Metrics Tracking

**Recommended KPIs:**
1. Time to patch critical vulnerabilities (Target: <24hrs)
2. Dependency vulnerability count (Target: 0 high/critical)
3. Failed authentication rate (Monitor for attacks)
4. Session timeout rate (Validate timeout settings)
5. CSP violation rate (Monitor for XSS attempts)
6. Encryption operation success rate (>99.9%)

---

## Additional Resources

### Security Documentation Needed
1. **SECURITY.md** - Responsible disclosure policy
2. **DEPLOYMENT_SECURITY.md** - Production deployment guide
3. **INCIDENT_RESPONSE.md** - Security incident procedures
4. **USER_SECURITY_GUIDE.md** - End-user security best practices

### Recommended Tools
1. **npm audit** - Dependency scanning
2. **ESLint security plugins** - Static analysis
3. **OWASP ZAP** - Dynamic security testing
4. **Lighthouse** - Security best practices audit
5. **Snyk** - Dependency vulnerability monitoring

---

## Conclusion

Graceful Books demonstrates a **strong security foundation** with excellent cryptographic implementations and zero-knowledge architecture. The identified vulnerabilities are primarily in supporting infrastructure (dependencies, CSP) and edge cases (localStorage encryption, file validation) rather than fundamental design flaws.

**Primary Recommendations:**
1. Address high-severity findings within 1-2 weeks
2. Complete medium-severity fixes before production launch
3. Establish continuous security monitoring
4. Conduct external penetration testing
5. Implement automated security scanning in CI/CD

**Security Score: 7.5/10**
- Excellent cryptographic implementation: 9/10
- Good authentication and session management: 8/10
- Needs improvement in dependency management: 5/10
- Needs improvement in defense-in-depth (CSP, headers): 6/10
- Good overall architecture: 8/10

With the recommended fixes implemented, the security posture would improve to **9/10**, making Graceful Books one of the most secure accounting applications available.

---

**Review Conducted By:** Security Audit Team
**Review Date:** January 18, 2026
**Next Review Scheduled:** Before production deployment

**Approved for continued development with recommended security improvements.**
