# Security Training Program

**Version:** 1.0
**Created:** 2026-02-23
**Status:** Active
**Audience:** All developers, security reviewers, and technical contributors

---

## Table of Contents

1. [Program Overview](#program-overview)
2. [Training Schedule](#training-schedule)
3. [Module 1: OWASP Top 10 Overview](#module-1-owasp-top-10-overview)
4. [Module 2: Secure Coding Practices](#module-2-secure-coding-practices)
5. [Module 3: Common Vulnerability Patterns](#module-3-common-vulnerability-patterns)
6. [Module 4: Using Security Utilities in This Codebase](#module-4-using-security-utilities-in-this-codebase)
7. [Hands-On Exercises](#hands-on-exercises)
8. [Knowledge Verification Quiz](#knowledge-verification-quiz)
9. [Resource Library](#resource-library)
10. [New Developer Onboarding Checklist](#new-developer-onboarding-checklist)
11. [Conducting Your First Training Session](#conducting-your-first-training-session)
12. [Continuous Improvement](#continuous-improvement)

---

## Program Overview

### Why Security Training Matters

Graceful Books is a zero-knowledge accounting platform where users trust us with their most sensitive financial data. Our security training program ensures that every developer understands:

- **The stakes:** User financial data must be protected at all costs
- **The tools:** How to use our security utilities correctly
- **The patterns:** Common vulnerabilities and how to prevent them
- **The mindset:** Security is everyone's responsibility, not just the security team's

### Training Philosophy

Our training follows the Graceful Books Steadiness communication style:

- **Patient and supportive:** Security can be complex, but we'll guide you through it step by step
- **Practical and hands-on:** Learn by doing with real codebase examples
- **Clear and approachable:** No intimidating jargon - everything explained in plain language
- **Continuous improvement:** Regular training sessions keep security top of mind

### Learning Objectives

After completing this training program, you will be able to:

1. Identify and prevent OWASP Top 10 vulnerabilities in your code
2. Use Graceful Books security utilities correctly (authorization, sanitization, validation)
3. Write secure code that follows our security guidelines
4. Recognize vulnerability patterns before they make it to code review
5. Contribute to our culture of security-first development

---

## Training Schedule

### Quarterly Training Sessions

Security training happens **every quarter** to keep skills fresh and address new threats.

**Schedule:**
- **Q1 (January):** OWASP Top 10 + New Year Security Review
- **Q2 (April):** Secure Coding Practices + Codebase Utilities Deep Dive
- **Q3 (July):** Common Vulnerability Patterns + Recent Security Incidents
- **Q4 (October):** Year-End Review + Security Roadmap Planning

**Duration:** 2 hours per session (1.5 hours training + 30 minutes Q&A)

**Format:**
- Live presentation with slides
- Hands-on coding exercises
- Group discussions
- Quiz at the end

### Ad-Hoc Training

Additional training sessions may be scheduled when:
- A new security vulnerability is discovered in the wild
- We implement new security features
- Security audit findings require team awareness
- New team members join (onboarding training)

---

## Module 1: OWASP Top 10 Overview

### Learning Objectives

Understand the OWASP Top 10 (2021) vulnerabilities and how they apply to Graceful Books.

### 1.1 What is OWASP?

**OWASP** (Open Web Application Security Project) is a nonprofit foundation that works to improve software security. The OWASP Top 10 is a standard awareness document representing a broad consensus about the most critical security risks to web applications.

**Why it matters:** These 10 vulnerabilities account for the majority of security breaches. Understanding them helps you write more secure code.

### 1.2 OWASP Top 10 (2021)

#### A01:2021 - Broken Access Control

**What it is:** Users can access data or perform actions they shouldn't be allowed to.

**Example in accounting software:**
```typescript
// ❌ VULNERABLE: No authorization check
async function getAccount(accountId: string) {
  return await db.accounts.get(accountId);
  // Any user can access any account!
}

// ✅ SECURE: Requires company ownership
async function getAccount(accountId: string, companyId: string) {
  const account = await db.accounts.get(accountId);
  const authCheck = requireCompanyOwnership(account, companyId);
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error };
  }
  return { success: true, data: authCheck.resource };
}
```

**Graceful Books protection:**
- `requireCompanyOwnership()` helper in `src/utils/authorization.ts`
- All data access requires `companyId` parameter
- RBAC permissions for role-based operations
- 333 automated tests prevent regressions

**Severity:** CRITICAL - Can lead to complete data breach

---

#### A02:2021 - Cryptographic Failures

**What it is:** Sensitive data transmitted or stored without proper encryption.

**Example in accounting software:**
```typescript
// ❌ VULNERABLE: Storing sensitive data in plaintext
localStorage.setItem('bankAccount', '1234-5678-9012');

// ✅ SECURE: Encrypt before storing
const encryptedAccount = await encryptionService.encrypt(bankAccount);
await db.secrets.put({ id: 'bank', encrypted: encryptedAccount });
```

**Graceful Books protection:**
- Zero-knowledge encryption architecture
- All financial data encrypted client-side
- Argon2id for passphrase-based key derivation
- AES-256-GCM for data encryption
- TLS 1.3+ for data in transit

**Severity:** CRITICAL - Can expose all user financial data

---

#### A03:2021 - Injection

**What it is:** Untrusted data sent to an interpreter as part of a command or query.

**Common types:**
- **SQL Injection:** Malicious SQL in database queries
- **NoSQL Injection:** Malicious queries in NoSQL databases
- **Command Injection:** OS commands executed via user input

**Example:**
```typescript
// ❌ VULNERABLE: String concatenation in query
const query = `SELECT * FROM users WHERE email = '${userInput}'`;
// If userInput is: ' OR '1'='1
// Query becomes: SELECT * FROM users WHERE email = '' OR '1'='1'
// Returns ALL users!

// ✅ SECURE: Parameterized query (Dexie handles this)
const user = await db.users.where('email').equals(userInput).first();
```

**Graceful Books protection:**
- Dexie.js ORM prevents SQL injection
- Input validation with Zod schemas
- No direct SQL queries

**Severity:** HIGH - Can lead to data breach or data loss

---

#### A04:2021 - Insecure Design

**What it is:** Missing or ineffective security controls in the design phase.

**Examples:**
- No rate limiting on login attempts
- Missing audit logging for sensitive operations
- No session timeout mechanisms

**Graceful Books protection:**
- Defense-in-depth architecture (multiple security layers)
- Rate limiting on all authentication endpoints
- Comprehensive audit logging (7-year retention)
- Session security with fingerprinting
- Security requirements in all feature specifications

**Severity:** HIGH - Systemic security weaknesses

---

#### A05:2021 - Security Misconfiguration

**What it is:** Missing security hardening, unnecessary features enabled, default credentials.

**Examples:**
- Using default passwords
- Verbose error messages exposing system details
- Missing security headers

**Graceful Books protection:**
- Security headers configured (CSP, HSTS, X-Frame-Options, etc.)
- No default credentials
- User-friendly error messages (no stack traces to users)
- Regular dependency updates and vulnerability scanning

**Severity:** MEDIUM - Can enable other attacks

---

#### A06:2021 - Vulnerable and Outdated Components

**What it is:** Using components with known vulnerabilities.

**Example:**
```bash
# Check for vulnerabilities
npm audit

# Found: lodash@4.17.15 (Prototype Pollution - High severity)
```

**Graceful Books protection:**
- `npm audit` before every `npm install` (see `NPM_INSTALL_CHECKLIST.md`)
- Regular dependency updates
- Snyk scanning in CI/CD pipeline
- Currently: **0 vulnerabilities** (100% reduction from 18)

**Severity:** VARIES - Depends on the specific vulnerability

---

#### A07:2021 - Identification and Authentication Failures

**What it is:** Weak authentication, session management issues, credential stuffing.

**Examples:**
- Weak password requirements
- Session tokens that don't expire
- No rate limiting on login attempts

**Graceful Books protection:**
- Strong passphrase requirements (12+ characters)
- Session timeout (24 hours max, 30 min idle)
- Rate limiting (5 failed login attempts per 15 minutes)
- Device fingerprinting for session validation
- No "forgot password" (zero-knowledge architecture)

**Severity:** CRITICAL - Can lead to account takeover

---

#### A08:2021 - Software and Data Integrity Failures

**What it is:** Code/infrastructure that doesn't protect against integrity violations.

**Examples:**
- Auto-updates without signature verification
- Insecure CI/CD pipelines
- Untrusted deserialization

**Graceful Books protection:**
- Immutable audit log (all financial changes tracked)
- Version vectors for CRDT conflict resolution
- Soft deletes (never lose data)
- No auto-updates without user consent

**Severity:** HIGH - Can lead to malicious code execution

---

#### A09:2021 - Security Logging and Monitoring Failures

**What it is:** Insufficient logging, monitoring, or incident response.

**Examples:**
- Login failures not logged
- No alerting on suspicious activity
- Logs not retained for forensic analysis

**Graceful Books protection:**
- Security event logging (authentication, authorization, RBAC)
- Structured logging with Winston
- 7-year audit log retention (accounting compliance)
- Activity feed shows all user actions
- Incident response plan documented

**Severity:** MEDIUM - Delays breach detection and response

---

#### A10:2021 - Server-Side Request Forgery (SSRF)

**What it is:** Web app fetches remote resources without validating user-supplied URLs.

**Example:**
```typescript
// ❌ VULNERABLE: Fetching arbitrary URLs
const response = await fetch(userProvidedUrl);

// ✅ SECURE: Validate and whitelist URLs
if (!isAllowedDomain(userProvidedUrl)) {
  throw new Error('URL not allowed');
}
const response = await fetch(userProvidedUrl);
```

**Graceful Books protection:**
- Local-first architecture (minimal external requests)
- URL validation for external integrations
- No user-controlled URLs in fetch operations

**Severity:** MEDIUM - Can expose internal resources

---

### 1.3 OWASP Top 10 Quick Reference

| Rank | Vulnerability | Graceful Books Status | Primary Defense |
|------|---------------|----------------------|-----------------|
| A01 | Broken Access Control | ✅ Protected | `requireCompanyOwnership()` |
| A02 | Cryptographic Failures | ✅ Protected | Zero-knowledge encryption |
| A03 | Injection | ✅ Protected | Dexie ORM + Zod validation |
| A04 | Insecure Design | ✅ Protected | Defense-in-depth architecture |
| A05 | Security Misconfiguration | ✅ Protected | Security headers + hardening |
| A06 | Vulnerable Components | ✅ Protected | npm audit + Snyk scanning |
| A07 | Auth Failures | ✅ Protected | Rate limiting + session security |
| A08 | Data Integrity Failures | ✅ Protected | Immutable audit log |
| A09 | Logging Failures | ✅ Protected | Security event logging |
| A10 | SSRF | ✅ Protected | Local-first architecture |

**Current Status:** 100% OWASP Top 10 compliance

---

## Module 2: Secure Coding Practices

### Learning Objectives

Learn the secure coding patterns used in Graceful Books and how to apply them correctly.

### 2.1 Security Principles

#### Defense in Depth

**Concept:** Use multiple layers of security so if one fails, others still protect data.

**Layers in Graceful Books:**
1. **Authorization:** Verify company ownership
2. **RBAC:** Check role-based permissions
3. **Validation:** Validate all inputs with Zod
4. **Sanitization:** Sanitize all outputs with DOMPurify
5. **Rate Limiting:** Prevent abuse and DoS attacks
6. **Logging:** Track all security events

**Example:**
```typescript
// Layer 1: Authorization
const authCheck = requireCompanyOwnership(transaction, companyId);
if (!authCheck.authorized) {
  return { success: false, error: authCheck.error };
}

// Layer 2: RBAC
const permission = await checkPermission(userId, companyId, 'transaction:update');
if (!permission.granted) {
  return { success: false, error: permission.error };
}

// Layer 3: Validation
const validationResult = updateTransactionSchema.safeParse(updates);
if (!validationResult.success) {
  return { success: false, error: validationResult.error };
}

// Layer 4: Business logic
const result = await updateTransaction(transaction, validationResult.data);

// Layer 5: Logging
await logSecurityEvent({
  type: 'TRANSACTION_UPDATE',
  userId,
  companyId,
  entityId: transaction.id,
});
```

---

#### Fail Secure

**Concept:** When something goes wrong, default to denying access rather than granting it.

**Examples:**
```typescript
// ❌ WRONG: Fails open (grants access on error)
function checkAccess(user, resource) {
  try {
    return hasPermission(user, resource);
  } catch (error) {
    return true; // Grants access on error!
  }
}

// ✅ RIGHT: Fails closed (denies access on error)
function checkAccess(user, resource) {
  try {
    return hasPermission(user, resource);
  } catch (error) {
    logger.error('Permission check failed', { error });
    return false; // Denies access on error
  }
}
```

---

#### Least Privilege

**Concept:** Users should only have access to what they need, nothing more.

**RBAC Roles in Graceful Books:**
- **OWNER:** Full access (manage users, delete company)
- **ADMIN:** Manage settings, view everything
- **ACCOUNTANT:** Create/edit transactions, run reports
- **BOOKKEEPER:** Data entry only
- **VIEWER:** Read-only access

**Example:**
```typescript
// Check both company ownership AND role permission
const authCheck = requireCompanyOwnership(account, companyId);
if (!authCheck.authorized) {
  return { success: false, error: authCheck.error };
}

const permission = await checkPermission(userId, companyId, 'account:delete');
if (!permission.granted) {
  return {
    success: false,
    error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
  };
}
```

---

### 2.2 Input Validation

**Golden Rule:** Never trust user input. Always validate.

#### Using Zod Schemas

Graceful Books uses Zod for runtime type validation. All user input must pass through Zod schemas before being processed.

**Example:**
```typescript
import { accountSchema } from '@/utils/validation';

// Validate user input
const result = accountSchema.safeParse(userInput);

if (!result.success) {
  // Validation failed - return friendly error
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Please check your input and try again',
      details: result.error.flatten(),
    },
  };
}

// Safe to use validated data
const validatedAccount = result.data;
```

#### Common Validation Patterns

**Money validation:**
```typescript
import { moneySchema } from '@/utils/validation';

// Validates format and prevents overflow
const result = moneySchema.safeParse(userAmount);
```

**Email validation:**
```typescript
import { emailSchema } from '@/utils/validation';

const result = emailSchema.safeParse(userEmail);
```

**Text length validation (DoS prevention):**
```typescript
import { shortTextSchema, mediumTextSchema } from '@/utils/validation';

// Short text: max 100 characters
const nameResult = shortTextSchema.safeParse(userName);

// Medium text: max 500 characters
const descResult = mediumTextSchema.safeParse(description);
```

---

### 2.3 Output Sanitization

**Golden Rule:** Never render user content without sanitization.

#### Using DOMPurify

**When to sanitize:**
- User-generated HTML (rich text editors)
- Displaying user input that may contain HTML
- Email content
- Any content from external sources

**Example:**
```typescript
import { sanitizeHtml } from '@/utils/sanitize';

// Safe rendering with React
function TransactionMemo({ memo }: { memo: string }) {
  return (
    <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(memo) }} />
  );
}
```

**Sanitization functions:**
```typescript
import {
  sanitizeHtml,        // Default: allows safe HTML tags
  sanitizeHtmlStrict,  // Removes ALL HTML
  sanitizeUrl,         // Prevents javascript: URLs
  sanitizeEmailHtml,   // Allows email formatting
} from '@/utils/sanitize';

// XSS payloads are neutralized
sanitizeHtml('<script>alert("xss")</script>');
// Returns: ""

sanitizeHtml('<strong>Safe</strong>');
// Returns: "<strong>Safe</strong>"

sanitizeUrl('javascript:alert(1)');
// Returns: "about:blank"
```

---

### 2.4 Authorization Checks

**Golden Rule:** All data access must verify company ownership.

#### Using Authorization Helpers

**Single resource:**
```typescript
import { requireCompanyOwnership } from '@/utils/authorization';

async function getAccount(accountId: string, companyId: string) {
  const account = await db.accounts.get(accountId);

  const authCheck = requireCompanyOwnership(account, companyId);
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error };
  }

  // Safe to use authCheck.resource
  return { success: true, data: authCheck.resource };
}
```

**Batch operations:**
```typescript
import { requireBatchCompanyOwnership } from '@/utils/authorization';

async function getTransactions(ids: string[], companyId: string) {
  const transactions = await db.transactions.bulkGet(ids);

  const authCheck = requireBatchCompanyOwnership(
    transactions.filter(Boolean),
    companyId
  );

  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error };
  }

  return { success: true, data: authCheck.resource };
}
```

**Query filtering:**
```typescript
// ❌ WRONG: Query without companyId filter
const accounts = await db.accounts.toArray();

// ✅ RIGHT: Always filter by companyId
const accounts = await db.accounts
  .where('companyId')
  .equals(companyId)
  .and((a) => !a.deletedAt) // Exclude soft-deleted
  .toArray();
```

---

### 2.5 Error Handling

**Golden Rule:** User-friendly messages, detailed logs.

#### Good Error Messages

Follow the Steadiness communication style:

```typescript
// ❌ WRONG: Technical and blaming
error: 'Invalid input: amount must be numeric'

// ✅ RIGHT: Friendly and helpful
error: "That amount doesn't look quite right. Please enter a number like 10.50"

// ❌ WRONG: Vague and unhelpful
error: 'Operation failed'

// ✅ RIGHT: Clear and reassuring
error: "We couldn't save those changes. Please check your entry and try again."

// ❌ WRONG: Exposes system details
error: 'Database connection failed: ECONNREFUSED 127.0.0.1:5432'

// ✅ RIGHT: User-friendly, log details
error: "Something unexpected happened. We're looking into it."
// Log: logger.error('DB connection failed', { error, details })
```

#### Error Codes

Use specific error codes for debugging:

```typescript
import { ErrorCode } from '@/utils/errors';

// Available error codes:
ErrorCode.VALIDATION_ERROR    // Input validation failed
ErrorCode.NOT_FOUND          // Entity doesn't exist
ErrorCode.AUTHORIZATION_FAILED // No permission
ErrorCode.CONSTRAINT_VIOLATION // Business rule violated
ErrorCode.ENCRYPTION_ERROR   // Crypto operation failed
ErrorCode.RATE_LIMITED       // Too many requests
```

---

### 2.6 Security Headers

**Already configured** in Graceful Books. Know what they do:

```typescript
// Content Security Policy - Prevents XSS
"Content-Security-Policy": "default-src 'self'; script-src 'self'; ..."

// Prevents clickjacking
"X-Frame-Options": "DENY"

// Forces HTTPS
"Strict-Transport-Security": "max-age=31536000; includeSubDomains"

// Prevents MIME sniffing
"X-Content-Type-Options": "nosniff"

// Referrer policy
"Referrer-Policy": "strict-origin-when-cross-origin"

// Permissions policy
"Permissions-Policy": "geolocation=(), microphone=(), camera=()"
```

**See:** `docs/SECURITY_HEADERS_CONFIGURATION.md` for details

---

## Module 3: Common Vulnerability Patterns

### Learning Objectives

Recognize and prevent common security vulnerabilities before they make it to code review.

### 3.1 IDOR (Insecure Direct Object Reference)

**What it is:** Accessing resources using user-supplied IDs without authorization.

#### Vulnerable Pattern

```typescript
// ❌ VULNERABLE: No authorization check
async function deleteAccount(accountId: string) {
  return await db.accounts.delete(accountId);
  // Any user can delete any account!
}

// ❌ VULNERABLE: Uses accountId from URL without validation
router.get('/api/accounts/:id', async (req, res) => {
  const account = await db.accounts.get(req.params.id);
  res.json(account);
  // Attacker can iterate through IDs and steal data!
});
```

#### Secure Pattern

```typescript
// ✅ SECURE: Requires company ownership
async function deleteAccount(accountId: string, companyId: string) {
  const account = await db.accounts.get(accountId);

  const authCheck = requireCompanyOwnership(account, companyId);
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error };
  }

  await db.accounts.update(accountId, { deletedAt: new Date() });
  return { success: true };
}
```

#### Red Flags to Watch For

- Database queries without `companyId` filter
- Functions that don't accept `companyId` parameter
- Direct access to entities without authorization check
- URL parameters used directly in queries

---

### 3.2 XSS (Cross-Site Scripting)

**What it is:** Injecting malicious scripts into web pages viewed by other users.

#### Vulnerable Pattern

```typescript
// ❌ VULNERABLE: Rendering unsanitized user content
function TransactionMemo({ memo }: { memo: string }) {
  return <div dangerouslySetInnerHTML={{ __html: memo }} />;
  // If memo contains <script>alert('xss')</script>, it executes!
}

// ❌ VULNERABLE: Setting innerHTML directly
element.innerHTML = userInput;
```

#### Secure Pattern

```typescript
// ✅ SECURE: Sanitize before rendering
import { sanitizeHtml } from '@/utils/sanitize';

function TransactionMemo({ memo }: { memo: string }) {
  return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(memo) }} />;
}

// ✅ SECURE: React escapes by default
function TransactionMemo({ memo }: { memo: string }) {
  return <div>{memo}</div>;
  // React automatically escapes, safe for plain text
}
```

#### Red Flags to Watch For

- `dangerouslySetInnerHTML` without sanitization
- Direct DOM manipulation with `innerHTML`
- User input in `href` attributes without validation
- User input in `src` attributes without validation

---

### 3.3 Injection Attacks

**What it is:** Malicious data sent to interpreters as commands or queries.

#### Vulnerable Pattern

```typescript
// ❌ VULNERABLE: String concatenation in queries
const query = `SELECT * FROM accounts WHERE name = '${userName}'`;
// If userName is: ' OR '1'='1
// Returns all accounts!

// ❌ VULNERABLE: Executing user input as code
eval(userInput); // NEVER do this!
new Function(userInput)(); // Also dangerous!
```

#### Secure Pattern

```typescript
// ✅ SECURE: Dexie ORM prevents injection
const accounts = await db.accounts
  .where('name')
  .equals(userName)
  .toArray();

// ✅ SECURE: Validate input with Zod
const result = accountSchema.safeParse(userInput);
if (!result.success) {
  throw new Error('Invalid input');
}
```

#### Red Flags to Watch For

- String concatenation in queries
- `eval()` or `new Function()`
- Executing shell commands with user input
- Direct use of user input in queries

---

### 3.4 Authentication Bypass

**What it is:** Circumventing authentication mechanisms to gain unauthorized access.

#### Vulnerable Pattern

```typescript
// ❌ VULNERABLE: Weak password requirements
function validatePassword(password: string): boolean {
  return password.length >= 6; // Too short!
}

// ❌ VULNERABLE: No rate limiting
async function login(email: string, password: string) {
  const user = await db.users.where('email').equals(email).first();
  if (user && user.password === password) {
    return { success: true };
  }
  // Attacker can brute force with unlimited attempts!
}

// ❌ VULNERABLE: Sessions never expire
const session = { userId, createdAt: Date.now() };
// Sessions last forever!
```

#### Secure Pattern

```typescript
// ✅ SECURE: Strong passphrase requirements
function validatePassphrase(passphrase: string): ValidationResult {
  if (passphrase.length < 12) {
    return { valid: false, error: 'Passphrase must be at least 12 characters' };
  }
  // Additional checks for complexity
  return { valid: true };
}

// ✅ SECURE: Rate limiting
const loginAttempts = await rateLimiter.consume('login', email);
if (loginAttempts.remainingPoints === 0) {
  return { success: false, error: 'Too many attempts. Try again in 15 minutes.' };
}

// ✅ SECURE: Sessions expire
const session = {
  userId,
  expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  idleTimeout: 30 * 60 * 1000, // 30 minutes
};
```

#### Red Flags to Watch For

- Weak password requirements
- No rate limiting on login attempts
- Sessions that don't expire
- Storing passwords in plaintext
- No session timeout mechanisms

---

### 3.5 Privilege Escalation

**What it is:** Users gaining higher privileges than they should have.

#### Vulnerable Pattern

```typescript
// ❌ VULNERABLE: No role check
async function deleteCompany(companyId: string, userId: string) {
  await db.companies.delete(companyId);
  // Any user can delete the company!
}

// ❌ VULNERABLE: Client-side role check only
function AdminButton({ userRole }: { userRole: string }) {
  if (userRole === 'OWNER') {
    return <button onClick={deleteCompany}>Delete</button>;
  }
  // User can modify userRole in browser DevTools!
}
```

#### Secure Pattern

```typescript
// ✅ SECURE: Server-side role check
async function deleteCompany(companyId: string, userId: string) {
  const permission = await checkPermission(userId, companyId, 'company:delete');
  if (!permission.granted) {
    return { success: false, error: 'Insufficient permissions' };
  }

  await db.companies.update(companyId, { deletedAt: new Date() });
  return { success: true };
}
```

#### Red Flags to Watch For

- Operations without role checks
- Client-side only permission checks
- Hard-coded role assumptions
- No permission matrix for operations

---

### 3.6 Information Disclosure

**What it is:** Exposing sensitive information through error messages, URLs, or responses.

#### Vulnerable Pattern

```typescript
// ❌ VULNERABLE: Reveals if resource exists
async function getAccount(accountId: string, companyId: string) {
  const account = await db.accounts.get(accountId);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }
  if (account.companyId !== companyId) {
    return { success: false, error: 'Access denied' };
  }
  // Different errors reveal whether account exists!
}

// ❌ VULNERABLE: Stack traces to users
try {
  await riskyOperation();
} catch (error) {
  return { success: false, error: error.stack };
  // Exposes file paths, function names, etc.!
}
```

#### Secure Pattern

```typescript
// ✅ SECURE: Same error for not found and unauthorized
async function getAccount(accountId: string, companyId: string) {
  const account = await db.accounts.get(accountId);

  const authCheck = requireCompanyOwnership(account, companyId);
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error };
    // Always returns 'NOT_FOUND' regardless of reason
  }

  return { success: true, data: authCheck.resource };
}

// ✅ SECURE: User-friendly errors, log details
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', { error, stack: error.stack });
  return {
    success: false,
    error: "Something unexpected happened. We're looking into it."
  };
}
```

#### Red Flags to Watch For

- Different error messages for "not found" vs "unauthorized"
- Stack traces in user-facing errors
- Detailed system information in errors
- Verbose logging to users

---

## Module 4: Using Security Utilities in This Codebase

### Learning Objectives

Master the security helper functions in Graceful Books and use them correctly.

### 4.1 Authorization Utilities

**Location:** `src/utils/authorization.ts`

#### requireCompanyOwnership()

**Purpose:** Verify that a resource belongs to the requesting company.

**Signature:**
```typescript
function requireCompanyOwnership<T extends { companyId: string }>(
  resource: T | null | undefined,
  requestingCompanyId: string
): AuthorizationResult<T>
```

**Returns:**
```typescript
type AuthorizationResult<T> =
  | { authorized: true; resource: T }
  | { authorized: false; error: DatabaseError }
```

**Usage:**
```typescript
import { requireCompanyOwnership } from '@/utils/authorization';

async function getAccount(accountId: string, companyId: string) {
  // 1. Fetch the resource
  const account = await db.accounts.get(accountId);

  // 2. Check authorization
  const authCheck = requireCompanyOwnership(account, companyId);

  // 3. Handle unauthorized
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error };
  }

  // 4. Use authorized resource
  return { success: true, data: authCheck.resource };
}
```

**When to use:**
- Getting a single entity by ID
- Updating an entity
- Deleting an entity
- Any operation on a specific resource

---

#### requireBatchCompanyOwnership()

**Purpose:** Verify that all resources in an array belong to the requesting company.

**Signature:**
```typescript
function requireBatchCompanyOwnership<T extends { companyId: string }>(
  resources: T[],
  requestingCompanyId: string
): AuthorizationResult<T[]>
```

**Usage:**
```typescript
import { requireBatchCompanyOwnership } from '@/utils/authorization';

async function deleteTransactions(ids: string[], companyId: string) {
  // 1. Fetch all resources
  const transactions = await db.transactions.bulkGet(ids);

  // 2. Filter out nulls
  const existing = transactions.filter(Boolean) as Transaction[];

  // 3. Check authorization for all
  const authCheck = requireBatchCompanyOwnership(existing, companyId);

  // 4. Handle unauthorized
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error };
  }

  // 5. Process all authorized resources
  await db.transactions.bulkUpdate(
    ids.map(id => ({ key: id, changes: { deletedAt: new Date() } }))
  );

  return { success: true };
}
```

**When to use:**
- Batch operations (bulk get, bulk update, bulk delete)
- Processing multiple entities at once

---

#### validateCompanyId()

**Purpose:** Validate that a companyId parameter is valid before using it in queries.

**Signature:**
```typescript
function validateCompanyId(companyId: string): DatabaseError | undefined
```

**Returns:** `undefined` if valid, `DatabaseError` if invalid

**Usage:**
```typescript
import { validateCompanyId } from '@/utils/authorization';

async function listAccounts(companyId: string) {
  // 1. Validate companyId parameter
  const validationError = validateCompanyId(companyId);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // 2. Safe to use in query
  const accounts = await db.accounts
    .where('companyId')
    .equals(companyId)
    .toArray();

  return { success: true, data: accounts };
}
```

**When to use:**
- Before any database query that uses companyId
- Validating function parameters
- Preventing empty/null companyId queries

---

### 4.2 Sanitization Utilities

**Location:** `src/utils/sanitize.ts`

#### sanitizeHtml()

**Purpose:** Remove dangerous HTML while preserving safe formatting.

**Signature:**
```typescript
function sanitizeHtml(dirty: string): string
```

**Allows:** `<p>`, `<strong>`, `<em>`, `<ul>`, `<ol>`, `<li>`, etc.
**Removes:** `<script>`, `<iframe>`, event handlers, `javascript:` URLs

**Usage:**
```typescript
import { sanitizeHtml } from '@/utils/sanitize';

function TransactionMemo({ memo }: { memo: string }) {
  // Sanitize user-generated HTML before rendering
  return (
    <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(memo) }} />
  );
}
```

**Examples:**
```typescript
sanitizeHtml('<script>alert("xss")</script>')
// Returns: ""

sanitizeHtml('<strong>Important</strong> note')
// Returns: "<strong>Important</strong> note"

sanitizeHtml('<img src=x onerror=alert(1)>')
// Returns: "<img src="x">"
```

---

#### sanitizeHtmlStrict()

**Purpose:** Remove ALL HTML tags, leaving only plain text.

**Signature:**
```typescript
function sanitizeHtmlStrict(dirty: string): string
```

**Usage:**
```typescript
import { sanitizeHtmlStrict } from '@/utils/sanitize';

// Use for text-only fields
const plainText = sanitizeHtmlStrict(userInput);
```

**Example:**
```typescript
sanitizeHtmlStrict('<strong>Bold</strong> and <script>alert(1)</script>')
// Returns: "Bold and "
```

---

#### sanitizeUrl()

**Purpose:** Prevent `javascript:`, `data:`, and `vbscript:` URLs.

**Signature:**
```typescript
function sanitizeUrl(url: string): string
```

**Usage:**
```typescript
import { sanitizeUrl } from '@/utils/sanitize';

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={sanitizeUrl(href)}>{children}</a>;
}
```

**Examples:**
```typescript
sanitizeUrl('javascript:alert(1)')
// Returns: "about:blank"

sanitizeUrl('https://example.com')
// Returns: "https://example.com"

sanitizeUrl('data:text/html,<script>alert(1)</script>')
// Returns: "about:blank"
```

---

#### sanitizeEmailHtml()

**Purpose:** Sanitize email HTML (more permissive, allows tables, headings).

**Signature:**
```typescript
function sanitizeEmailHtml(dirty: string): string
```

**Allows:** Tables, headings, lists, links, images (with safe attributes)
**Removes:** Scripts, iframes, forms, event handlers

**Usage:**
```typescript
import { sanitizeEmailHtml } from '@/utils/sanitize';

// Rendering email content
const cleanEmail = sanitizeEmailHtml(emailBody);
```

---

### 4.3 Validation Utilities

**Location:** `src/utils/validation.ts`

#### Common Schemas

**Import validation schemas:**
```typescript
import {
  accountSchema,
  transactionSchema,
  contactSchema,
  // ... more schemas
} from '@/utils/validation';
```

**Usage:**
```typescript
// Validate user input
const result = accountSchema.safeParse(userInput);

if (!result.success) {
  // Validation failed
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Please check your input',
      details: result.error.flatten(),
    },
  };
}

// Safe to use validated data
const validatedAccount = result.data;
await db.accounts.add(validatedAccount);
```

#### Field-Level Schemas

**Money validation:**
```typescript
import { moneySchema } from '@/utils/validation';

const result = moneySchema.safeParse('10.50'); // Valid
const result2 = moneySchema.safeParse('999999999999.99'); // Invalid (exceeds max)
```

**Email validation:**
```typescript
import { emailSchema } from '@/utils/validation';

const result = emailSchema.safeParse('user@example.com'); // Valid
const result2 = emailSchema.safeParse('not-an-email'); // Invalid
```

**Text length validation (DoS prevention):**
```typescript
import { shortTextSchema, mediumTextSchema } from '@/utils/validation';

// Short text: max 100 chars
const nameResult = shortTextSchema.safeParse(userName);

// Medium text: max 500 chars
const descResult = mediumTextSchema.safeParse(description);
```

---

### 4.4 RBAC Utilities

**Location:** `src/services/rbac.ts`

#### checkPermission()

**Purpose:** Check if user has permission for an operation.

**Usage:**
```typescript
import { checkPermission } from '@/services/rbac';

async function deleteAccount(accountId: string, companyId: string, userId: string) {
  // 1. Check permission
  const permission = await checkPermission(userId, companyId, 'account:delete');

  if (!permission.granted) {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to delete accounts',
      },
    };
  }

  // 2. Proceed with operation
  const account = await db.accounts.get(accountId);
  const authCheck = requireCompanyOwnership(account, companyId);

  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error };
  }

  await db.accounts.update(accountId, { deletedAt: new Date() });
  return { success: true };
}
```

**Permission format:** `resource:operation`

**Examples:**
- `account:create`
- `account:read`
- `account:update`
- `account:delete`
- `transaction:create`
- `report:view`
- `user:manage`

---

### 4.5 Rate Limiting Utilities

**Location:** `src/services/rateLimiter.ts`

#### consume()

**Purpose:** Track and limit request rates to prevent abuse.

**Usage:**
```typescript
import { rateLimiter } from '@/services/rateLimiter';

async function login(email: string, password: string) {
  // 1. Check rate limit
  try {
    await rateLimiter.consume('login', email);
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many login attempts. Please try again in 15 minutes.',
      },
    };
  }

  // 2. Proceed with login
  // ...
}
```

**Rate limit categories:**
- `login` - 5 attempts per 15 minutes
- `api` - 100 requests per minute
- `export` - 10 exports per hour

---

### 4.6 Security Logging

**Location:** `src/services/securityLogger.ts`

#### logSecurityEvent()

**Purpose:** Log security-relevant events for audit and forensics.

**Usage:**
```typescript
import { logSecurityEvent } from '@/services/securityLogger';

// Log authentication event
await logSecurityEvent({
  type: 'AUTH_LOGIN_SUCCESS',
  userId,
  metadata: { deviceId, ipAddress },
});

// Log authorization failure
await logSecurityEvent({
  type: 'AUTHORIZATION_FAILED',
  userId,
  companyId,
  entityType: 'account',
  entityId: accountId,
  action: 'delete',
});

// Log RBAC permission check
await logSecurityEvent({
  type: 'RBAC_PERMISSION_DENIED',
  userId,
  companyId,
  permission: 'account:delete',
});
```

**Event types:**
- `AUTH_*` - Authentication events
- `AUTHORIZATION_*` - Authorization checks
- `RBAC_*` - Role-based access control
- `RATE_LIMIT_*` - Rate limiting events
- `DATA_*` - Data access and modification

---

## Module 5: Hands-On Exercises

### Exercise 1: Fix IDOR Vulnerability

**Scenario:** You've been asked to review this code. It has an IDOR vulnerability.

**Vulnerable Code:**
```typescript
async function updateAccountName(accountId: string, newName: string) {
  await db.accounts.update(accountId, { name: newName });
  return { success: true };
}
```

**Your Task:**
1. Identify the vulnerability
2. Add proper authorization checks
3. Add input validation
4. Add security logging

**Solution:**
```typescript
import { requireCompanyOwnership, validateCompanyId } from '@/utils/authorization';
import { shortTextSchema } from '@/utils/validation';
import { logSecurityEvent } from '@/services/securityLogger';

async function updateAccountName(
  accountId: string,
  newName: string,
  companyId: string,
  userId: string
) {
  // 1. Validate companyId
  const companyError = validateCompanyId(companyId);
  if (companyError) {
    return { success: false, error: companyError };
  }

  // 2. Validate input
  const nameResult = shortTextSchema.safeParse(newName);
  if (!nameResult.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Account name is too long. Please use 100 characters or less.',
      },
    };
  }

  // 3. Check authorization
  const account = await db.accounts.get(accountId);
  const authCheck = requireCompanyOwnership(account, companyId);

  if (!authCheck.authorized) {
    await logSecurityEvent({
      type: 'AUTHORIZATION_FAILED',
      userId,
      companyId,
      entityType: 'account',
      entityId: accountId,
      action: 'update',
    });
    return { success: false, error: authCheck.error };
  }

  // 4. Update account
  await db.accounts.update(accountId, { name: nameResult.data });

  // 5. Log success
  await logSecurityEvent({
    type: 'ACCOUNT_UPDATED',
    userId,
    companyId,
    entityId: accountId,
  });

  return { success: true };
}
```

---

### Exercise 2: Prevent XSS Attack

**Scenario:** A user reports that they can inject HTML into transaction memos.

**Vulnerable Code:**
```typescript
function TransactionDetail({ transaction }: { transaction: Transaction }) {
  return (
    <div>
      <h2>{transaction.description}</h2>
      <div dangerouslySetInnerHTML={{ __html: transaction.memo }} />
    </div>
  );
}
```

**Your Task:**
1. Identify the XSS vulnerability
2. Fix it using sanitization
3. Write a test to verify the fix

**Solution:**
```typescript
import { sanitizeHtml } from '@/utils/sanitize';

function TransactionDetail({ transaction }: { transaction: Transaction }) {
  return (
    <div>
      <h2>{transaction.description}</h2>
      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(transaction.memo) }} />
    </div>
  );
}
```

**Test:**
```typescript
import { render } from '@testing-library/react';
import { sanitizeHtml } from '@/utils/sanitize';

test('transaction memo prevents XSS', () => {
  const xssPayload = '<script>alert("xss")</script><strong>Normal text</strong>';
  const sanitized = sanitizeHtml(xssPayload);

  // Script removed
  expect(sanitized).not.toContain('<script>');
  expect(sanitized).not.toContain('alert');

  // Safe HTML preserved
  expect(sanitized).toContain('<strong>Normal text</strong>');
});
```

---

### Exercise 3: Implement RBAC Check

**Scenario:** Only OWNER and ADMIN users should be able to delete accounts.

**Code to Complete:**
```typescript
async function deleteAccount(
  accountId: string,
  companyId: string,
  userId: string
) {
  // TODO: Add RBAC check
  // TODO: Add authorization check
  // TODO: Perform soft delete
  // TODO: Add security logging
}
```

**Solution:**
```typescript
import { requireCompanyOwnership } from '@/utils/authorization';
import { checkPermission } from '@/services/rbac';
import { logSecurityEvent } from '@/services/securityLogger';

async function deleteAccount(
  accountId: string,
  companyId: string,
  userId: string
) {
  // 1. Check RBAC permission
  const permission = await checkPermission(userId, companyId, 'account:delete');

  if (!permission.granted) {
    await logSecurityEvent({
      type: 'RBAC_PERMISSION_DENIED',
      userId,
      companyId,
      permission: 'account:delete',
    });

    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to delete accounts',
      },
    };
  }

  // 2. Check company ownership
  const account = await db.accounts.get(accountId);
  const authCheck = requireCompanyOwnership(account, companyId);

  if (!authCheck.authorized) {
    await logSecurityEvent({
      type: 'AUTHORIZATION_FAILED',
      userId,
      companyId,
      entityType: 'account',
      entityId: accountId,
      action: 'delete',
    });
    return { success: false, error: authCheck.error };
  }

  // 3. Soft delete
  await db.accounts.update(accountId, { deletedAt: new Date() });

  // 4. Log success
  await logSecurityEvent({
    type: 'ACCOUNT_DELETED',
    userId,
    companyId,
    entityId: accountId,
  });

  return { success: true };
}
```

---

### Exercise 4: Validate User Input

**Scenario:** Create a function to update transaction amount with proper validation.

**Requirements:**
- Amount must be a valid money format
- Amount must not exceed $999,999,999.99
- User must own the transaction
- Log security events

**Solution:**
```typescript
import { requireCompanyOwnership } from '@/utils/authorization';
import { moneySchema } from '@/utils/validation';
import { logSecurityEvent } from '@/services/securityLogger';

async function updateTransactionAmount(
  transactionId: string,
  amount: string,
  companyId: string,
  userId: string
) {
  // 1. Validate amount
  const amountResult = moneySchema.safeParse(amount);
  if (!amountResult.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please enter a valid amount (e.g., 10.50)',
        details: amountResult.error.flatten(),
      },
    };
  }

  // 2. Check authorization
  const transaction = await db.transactions.get(transactionId);
  const authCheck = requireCompanyOwnership(transaction, companyId);

  if (!authCheck.authorized) {
    await logSecurityEvent({
      type: 'AUTHORIZATION_FAILED',
      userId,
      companyId,
      entityType: 'transaction',
      entityId: transactionId,
      action: 'update',
    });
    return { success: false, error: authCheck.error };
  }

  // 3. Update transaction
  await db.transactions.update(transactionId, {
    amount: amountResult.data,
    updatedAt: new Date(),
  });

  // 4. Log success
  await logSecurityEvent({
    type: 'TRANSACTION_UPDATED',
    userId,
    companyId,
    entityId: transactionId,
  });

  return { success: true };
}
```

---

## Knowledge Verification Quiz

### Instructions

This quiz verifies your understanding of security concepts. Answer all questions, then check your answers against the answer key.

**Passing Score:** 80% (16 out of 20 correct)

---

### Questions

#### 1. What is the OWASP Top 1 vulnerability?
a) XSS (Cross-Site Scripting)
b) Broken Access Control
c) Injection
d) Cryptographic Failures

#### 2. What does IDOR stand for?
a) Insecure Direct Object Reference
b) Internal Database Object Retrieval
c) Incorrect Data Output Response
d) Integrated Development Object Repository

#### 3. Which authorization helper should you use for batch operations?
a) `requireCompanyOwnership()`
b) `requireBatchCompanyOwnership()`
c) `validateCompanyId()`
d) `checkPermission()`

#### 4. What should you return when a user tries to access a resource they don't own?
a) `FORBIDDEN` error with details about the resource
b) `UNAUTHORIZED` error
c) `NOT_FOUND` error
d) `SUCCESS` with empty data

#### 5. Which function sanitizes HTML while preserving safe formatting?
a) `sanitizeHtmlStrict()`
b) `sanitizeUrl()`
c) `sanitizeHtml()`
d) `DOMPurify.clean()`

#### 6. What is the minimum passphrase length in Graceful Books?
a) 6 characters
b) 8 characters
c) 10 characters
d) 12 characters

#### 7. What is the rate limit for login attempts?
a) 3 attempts per 5 minutes
b) 5 attempts per 15 minutes
c) 10 attempts per 30 minutes
d) No limit

#### 8. Which Zod schema validates monetary amounts?
a) `amountSchema`
b) `currencySchema`
c) `moneySchema`
d) `decimalSchema`

#### 9. What is the proper way to delete a record in Graceful Books?
a) Hard delete with `db.table.delete(id)`
b) Soft delete by setting `deletedAt`
c) Mark as inactive
d) Move to archive table

#### 10. What does CSP stand for?
a) Client Security Protocol
b) Content Security Policy
c) Cross-Site Protection
d) Certificate Security Provider

#### 11. Which error code should you use for input validation failures?
a) `INVALID_INPUT`
b) `VALIDATION_ERROR`
c) `BAD_REQUEST`
d) `CONSTRAINT_VIOLATION`

#### 12. What principle states that if something fails, it should default to denying access?
a) Least Privilege
b) Defense in Depth
c) Fail Secure
d) Zero Trust

#### 13. Which RBAC role has read-only access?
a) BOOKKEEPER
b) ACCOUNTANT
c) VIEWER
d) ADMIN

#### 14. What should you do before rendering user-generated HTML?
a) Validate it with Zod
b) Sanitize it with DOMPurify
c) Encrypt it
d) Encode it to Base64

#### 15. Which security header prevents clickjacking?
a) `X-Content-Type-Options`
b) `X-Frame-Options`
c) `X-XSS-Protection`
d) `Referrer-Policy`

#### 16. What is the maximum amount allowed by the money schema?
a) $999,999.99
b) $9,999,999.99
c) $99,999,999.99
d) $999,999,999.99

#### 17. Which function validates that a companyId parameter is valid?
a) `requireCompanyOwnership()`
b) `validateCompanyId()`
c) `checkCompanyId()`
d) `verifyCompanyId()`

#### 18. What is the audit log retention period in Graceful Books?
a) 1 year
b) 3 years
c) 5 years
d) 7 years

#### 19. Which of these is NOT a layer in defense-in-depth?
a) Authorization
b) Validation
c) Obfuscation
d) Rate Limiting

#### 20. What should you do with error details when showing errors to users?
a) Show full stack traces for debugging
b) Show user-friendly messages, log details
c) Show error codes only
d) Show nothing, fail silently

---

### Answer Key

1. **b) Broken Access Control** - OWASP A01:2021

2. **a) Insecure Direct Object Reference** - Accessing resources without authorization

3. **b) `requireBatchCompanyOwnership()`** - For validating multiple resources

4. **c) `NOT_FOUND` error** - Never reveal if resource exists for unauthorized users

5. **c) `sanitizeHtml()`** - Removes dangerous HTML, keeps safe formatting

6. **d) 12 characters** - Strong passphrase requirement

7. **b) 5 attempts per 15 minutes** - Prevents brute force attacks

8. **c) `moneySchema`** - Validates money format and max value

9. **b) Soft delete by setting `deletedAt`** - Never hard delete (CRDT requirement)

10. **b) Content Security Policy** - Prevents XSS attacks

11. **b) `VALIDATION_ERROR`** - Standard error code for validation failures

12. **c) Fail Secure** - Default to denying access on error

13. **c) VIEWER** - Read-only role

14. **b) Sanitize it with DOMPurify** - Prevents XSS attacks

15. **b) `X-Frame-Options`** - Set to `DENY` to prevent clickjacking

16. **d) $999,999,999.99** - Maximum to prevent overflow

17. **b) `validateCompanyId()`** - Returns error if invalid

18. **d) 7 years** - Accounting compliance requirement

19. **c) Obfuscation** - Not a defense layer (authorization, validation, rate limiting are)

20. **b) Show user-friendly messages, log details** - Steadiness style + security

---

### Scoring

- **18-20 correct (90-100%):** Excellent! You have a strong understanding of security.
- **16-17 correct (80-85%):** Good! You pass, but review missed questions.
- **14-15 correct (70-75%):** Close! Review the material and retake the quiz.
- **< 14 correct (< 70%):** Please review the training modules and retake the quiz.

---

## Resource Library

### Official OWASP Resources

#### OWASP Top 10
- **OWASP Top 10 (2021):** https://owasp.org/Top10/
- **Interactive learning:** https://application.security/free/owasp-top-10
- **OWASP Cheat Sheet Series:** https://cheatsheetseries.owasp.org/

#### Specific Vulnerability Resources
- **Broken Access Control:** https://owasp.org/Top10/A01_2021-Broken_Access_Control/
- **Cryptographic Failures:** https://owasp.org/Top10/A02_2021-Cryptographic_Failures/
- **Injection:** https://owasp.org/Top10/A03_2021-Injection/
- **XSS Prevention:** https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- **Authentication:** https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

---

### Video Tutorials

#### OWASP Top 10 Explained
- **OWASP Top 10 2021 (Full Course):** https://www.youtube.com/watch?v=XDmKuYRW1f8 (F5 DevCentral)
- **OWASP Top 10 in 10 Minutes:** https://www.youtube.com/watch?v=avpJILFPDPc (Fireship)
- **OWASP Top 10 for Beginners:** https://www.youtube.com/watch?v=MPg1rGJjqGw (The Cyber Mentor)

#### Specific Topics
- **What is XSS?** https://www.youtube.com/watch?v=EoaDgUgS6QA (PwnFunction)
- **SQL Injection Explained:** https://www.youtube.com/watch?v=ciNHn38EyRc (Computerphile)
- **CSRF Attacks:** https://www.youtube.com/watch?v=vRBihr41JTo (PwnFunction)

---

### Security Blogs and Articles

#### General Security
- **Krebs on Security:** https://krebsonsecurity.com/
- **Troy Hunt's Blog:** https://www.troyhunt.com/
- **Schneier on Security:** https://www.schneier.com/

#### Web Application Security
- **PortSwigger Blog:** https://portswigger.net/blog
- **OWASP Blog:** https://owasp.org/blog/
- **Google Security Blog:** https://security.googleblog.com/

#### Specific Articles
- **IDOR Explained:** https://portswigger.net/web-security/access-control/idor
- **XSS Cheat Sheet:** https://portswigger.net/web-security/cross-site-scripting/cheat-sheet
- **Content Security Policy Guide:** https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP

---

### Interactive Learning Platforms

#### Free Resources
- **HackerOne CTF:** https://www.hackerone.com/hackers/hacker101 (Free capture-the-flag challenges)
- **OWASP WebGoat:** https://owasp.org/www-project-webgoat/ (Vulnerable app for learning)
- **Google XSS Game:** https://xss-game.appspot.com/ (Learn XSS prevention)
- **PentesterLab (Free Tier):** https://pentesterlab.com/exercises (Hands-on exercises)

#### Paid Platforms (Optional)
- **PortSwigger Web Security Academy:** https://portswigger.net/web-security (Free tier available!)
- **Hack The Box:** https://www.hackthebox.com/
- **TryHackMe:** https://tryhackme.com/

---

### Books

#### Beginner-Friendly
- **"The Web Application Hacker's Handbook" by Dafydd Stuttard & Marcus Pinto**
  - Comprehensive guide to web app security
  - Practical examples and testing methodologies

- **"Web Application Security: A Beginner's Guide" by Bryan Sullivan**
  - Great introduction for developers new to security

#### Advanced
- **"The Tangled Web" by Michal Zalewski**
  - Deep dive into browser security
  - Understanding the web security model

- **"Cryptography Engineering" by Niels Ferguson, Bruce Schneier, Tadayoshi Kohno**
  - For understanding encryption implementation
  - Relevant to Graceful Books' zero-knowledge architecture

---

### Tools and Utilities

#### Security Testing
- **Burp Suite Community Edition:** https://portswigger.net/burp/communitydownload
- **OWASP ZAP:** https://www.zaproxy.org/ (Free alternative to Burp)
- **Nikto:** https://github.com/sullo/nikto (Web server scanner)

#### Dependency Scanning
- **npm audit:** Built into npm (always use before `npm install`)
- **Snyk:** https://snyk.io/ (Free for open source)
- **Dependabot:** https://github.com/dependabot (GitHub native)

#### Browser Extensions
- **OWASP ZAP HUD:** Browser-based security testing
- **Wappalyzer:** Identify technologies on websites
- **React Developer Tools:** Inspect React components

---

### Graceful Books Internal Documentation

#### Must-Read Security Docs
- **`docs/SECURITY_ARCHITECTURE.md`** - Complete security architecture
- **`docs/SECURITY_GUIDELINES.md`** - Developer security guidelines (this is your bible!)
- **`Roadmaps/AGENT_REVIEW_CHECKLIST.md`** - Pre-commit security checklist
- **`docs/INTERNAL_PENTEST_REPORT.md`** - Latest penetration test findings
- **`docs/EXTERNAL_PENTEST_PREPARATION.md`** - External pen test preparation guide

#### Security Implementation Guides
- **`docs/SECURITY_HEADERS_CONFIGURATION.md`** - Security headers setup
- **`docs/SECURITY_EVENT_LOGGING.md`** - Security logging guide
- **`docs/RATE_LIMITING_USAGE.md`** - Rate limiting implementation
- **`docs/SESSION_SECURITY_IMPLEMENTATION.md`** - Session security guide
- **`docs/RBAC_PERMISSION_MATRIX.md`** - RBAC permissions reference

#### Testing Guides
- **`src/__tests__/security/`** - Security test examples
- **`docs/PENETRATION_TEST_GUIDE.md`** - How to conduct pen tests

---

## New Developer Onboarding Checklist

### Security Training for New Team Members

Welcome to Graceful Books! Security is a core part of our culture. Here's your onboarding checklist:

#### Week 1: Reading and Setup

- [ ] **Read security documentation**
  - [ ] `docs/SECURITY_ARCHITECTURE.md` (understand the architecture)
  - [ ] `docs/SECURITY_GUIDELINES.md` (your security bible)
  - [ ] `Roadmaps/AGENT_REVIEW_CHECKLIST.md` (use before every commit)
  - [ ] `docs/SECURITY_TRAINING_PROGRAM.md` (this document)

- [ ] **Set up security tools**
  - [ ] Install Burp Suite Community or OWASP ZAP
  - [ ] Configure npm audit to run automatically
  - [ ] Install ESLint and enable security rules
  - [ ] Set up pre-commit hooks (if available)

- [ ] **Review recent security work**
  - [ ] Read `docs/INTERNAL_PENTEST_REPORT.md`
  - [ ] Review closed security issues in GitHub
  - [ ] Review security test files in `src/__tests__/security/`

#### Week 2: Hands-On Learning

- [ ] **Complete hands-on exercises**
  - [ ] Exercise 1: Fix IDOR Vulnerability
  - [ ] Exercise 2: Prevent XSS Attack
  - [ ] Exercise 3: Implement RBAC Check
  - [ ] Exercise 4: Validate User Input

- [ ] **Review security utilities**
  - [ ] Read `src/utils/authorization.ts`
  - [ ] Read `src/utils/sanitize.ts`
  - [ ] Read `src/utils/validation.ts`
  - [ ] Try using each function in a test file

- [ ] **Watch OWASP videos**
  - [ ] OWASP Top 10 overview video
  - [ ] XSS prevention video
  - [ ] SQL injection explained video

#### Week 3: Practice and Testing

- [ ] **Write security tests**
  - [ ] Write an IDOR test for a feature you're working on
  - [ ] Write an XSS test for user input handling
  - [ ] Write a validation test using Zod schemas

- [ ] **Code review practice**
  - [ ] Review 3 pull requests with security lens
  - [ ] Use the agent review checklist
  - [ ] Look for common vulnerability patterns

- [ ] **Take the knowledge quiz**
  - [ ] Complete the quiz in this document
  - [ ] Achieve 80% or higher (retake if needed)
  - [ ] Review any questions you missed

#### Week 4: Integration

- [ ] **Pair with senior developer**
  - [ ] Pair on implementing a secure feature
  - [ ] Review authorization patterns together
  - [ ] Discuss past security incidents and lessons learned

- [ ] **Attend security training session**
  - [ ] Attend quarterly security training (or watch recording)
  - [ ] Ask questions about anything unclear
  - [ ] Share your learning experience

- [ ] **Complete onboarding**
  - [ ] Submit a PR with security best practices
  - [ ] Get approval from security champion
  - [ ] Join the #security Slack channel
  - [ ] You're ready to build secure features!

---

### Onboarding Verification

**New Developer Name:** ___________________________
**Start Date:** ___________________________
**Security Champion:** ___________________________

**Checklist Completion:**
- [ ] All reading materials completed
- [ ] All hands-on exercises completed
- [ ] Knowledge quiz passed (score: ___%)
- [ ] Security tests written and reviewed
- [ ] Pairing session completed
- [ ] First security-focused PR submitted and approved

**Security Champion Sign-off:**

Signature: ___________________________ Date: _______________

---

## Conducting Your First Training Session

### Preparation (1 Week Before)

#### Step 1: Review Materials
- [ ] Read through this training program document
- [ ] Review recent security incidents or findings
- [ ] Update examples with relevant codebase changes
- [ ] Prepare any additional slides or materials

#### Step 2: Set Up Logistics
- [ ] Schedule 2-hour session (all developers invited)
- [ ] Book conference room or set up video call
- [ ] Send calendar invite with agenda
- [ ] Prepare hands-on environment (laptops, Wi-Fi, projector)

#### Step 3: Prepare Exercises
- [ ] Clone Graceful Books repo to demo machine
- [ ] Prepare vulnerable code examples
- [ ] Test that all exercises work as expected
- [ ] Prepare answer keys

---

### Session Agenda (2 Hours)

#### Introduction (10 minutes)
- Welcome and introductions
- Why security training matters
- Learning objectives
- Agenda overview

#### Module 1: OWASP Top 10 (30 minutes)
- Quick overview of each vulnerability
- Real-world examples and impact
- How Graceful Books protects against each
- Q&A

#### Break (5 minutes)

#### Module 2: Secure Coding Practices (25 minutes)
- Security principles (defense-in-depth, fail secure, least privilege)
- Input validation with Zod
- Output sanitization with DOMPurify
- Authorization patterns
- Q&A

#### Module 3: Hands-On Exercise (30 minutes)
- Choose one exercise (e.g., Fix IDOR Vulnerability)
- Participants work individually or in pairs
- Review solution together
- Discuss lessons learned

#### Break (5 minutes)

#### Module 4: Security Utilities (15 minutes)
- Demo authorization helpers
- Demo sanitization functions
- Demo validation schemas
- Show where to find documentation

#### Quiz and Wrap-Up (10 minutes)
- Participants take quiz (online form or paper)
- Review challenging questions together
- Recap key takeaways
- Share resources for continued learning

---

### Delivery Tips

#### Make It Engaging
- **Use real examples:** Show actual security incidents (anonymized)
- **Live coding:** Demonstrate vulnerabilities and fixes in real-time
- **Interactive:** Ask questions, encourage discussion
- **Patient tone:** Security can be intimidating - be supportive

#### Keep It Practical
- **Focus on daily tasks:** How to use utilities in their work
- **Show, don't just tell:** Demo every concept
- **Relate to codebase:** Use Graceful Books examples throughout
- **Actionable takeaways:** Clear next steps for participants

#### Follow Steadiness Style
- **Patient and supportive:** "Let's walk through this together"
- **Step-by-step:** Break complex topics into small pieces
- **Reassuring:** "Security might seem complex, but we'll make it manageable"
- **Encouraging:** "Great question! Let's explore that..."

---

### Post-Session Follow-Up

#### Immediately After
- [ ] Collect feedback forms from participants
- [ ] Share slides and materials via email/Slack
- [ ] Post quiz results (anonymous summary)
- [ ] Answer any outstanding questions

#### Within 1 Week
- [ ] Review feedback and identify improvement areas
- [ ] Update training materials based on feedback
- [ ] Schedule 1-on-1s with anyone who needs extra help
- [ ] Share resources and additional reading

#### Within 1 Month
- [ ] Follow up on quiz results - offer retakes if needed
- [ ] Monitor code reviews for improved security practices
- [ ] Recognize developers who demonstrate security excellence
- [ ] Plan next quarter's training session

---

## Continuous Improvement

### Feedback Collection

#### After Every Training Session

**Collect feedback on:**
- Content clarity and relevance
- Pace and delivery
- Hands-on exercises (too easy/hard?)
- Materials and resources
- Suggestions for improvement

**Feedback Form Questions:**
1. What was the most valuable part of this training? (1-10 scale)
2. What topics need more coverage?
3. Were the hands-on exercises helpful?
4. What security topics are you still unsure about?
5. How can we improve this training?

---

### Updating Training Materials

#### Quarterly Reviews

- [ ] Review OWASP Top 10 for updates (annual release)
- [ ] Add new vulnerability patterns discovered in code reviews
- [ ] Update examples with recent security incidents
- [ ] Refresh resource links (check for broken links)
- [ ] Add new codebase examples as features are added

#### Annual Overhaul

- [ ] Comprehensive review of all modules
- [ ] Update statistics and metrics
- [ ] Refresh all video links and resources
- [ ] Review quiz questions for relevance
- [ ] Update onboarding checklist

---

### Tracking Effectiveness

#### Metrics to Monitor

**Knowledge Metrics:**
- Quiz scores (average, distribution)
- Retake rates
- Knowledge retention (re-quiz after 3 months)

**Behavioral Metrics:**
- Security issues found in code review
- Security test coverage (trending up/down?)
- Security bugs reported in production
- Time to fix security issues

**Cultural Metrics:**
- Developer confidence in security (surveys)
- Security questions asked in code reviews
- Proactive security improvements suggested
- Participation in security discussions

#### Success Criteria

**Training is effective if:**
- ✅ Average quiz score ≥ 85%
- ✅ Security issues in code review decreasing
- ✅ Security test coverage increasing
- ✅ Positive feedback scores (≥ 4/5)
- ✅ Developers report feeling confident about security

---

### Evolving the Program

#### Add New Modules As Needed

**Potential future modules:**
- **Secure CI/CD:** Securing the build pipeline
- **Mobile App Security:** If mobile app is developed
- **API Security:** When public API is released
- **Threat Modeling:** Proactive security design
- **Incident Response:** Handling security breaches

#### Advanced Training (Optional)

**For developers who want to go deeper:**
- **Security champions program:** Train team leads as security experts
- **Bug bounty preparation:** How to think like an attacker
- **Security certifications:** Support for OSCP, CEH, etc.
- **Conference attendance:** Send developers to security conferences

---

## Conclusion

### You're Ready to Build Securely!

Congratulations on completing the Graceful Books security training program! You now have the knowledge and tools to write secure code that protects our users' financial data.

### Remember the Key Principles

1. **Always validate input** - Never trust user data
2. **Always sanitize output** - Prevent XSS attacks
3. **Always check authorization** - Verify company ownership
4. **Always check permissions** - Use RBAC for sensitive operations
5. **Always log security events** - Enable forensics and monitoring
6. **Always fail secure** - Default to denying access
7. **Always follow the checklist** - Use the agent review checklist before every commit

### Get Help When You Need It

Security can be complex. Don't hesitate to:
- Ask questions in code reviews
- Reach out to security champions
- Consult the security documentation
- Request pairing sessions
- Attend office hours or Q&A sessions

### Security is Everyone's Responsibility

Every developer at Graceful Books is a security guardian. Your vigilance and care protect thousands of entrepreneurs and their financial data. Thank you for taking security seriously!

---

**Questions or Feedback?**

Contact the security team:
- **Slack:** #security
- **Email:** security@gracefulbooks.com
- **Office Hours:** Fridays 2-3 PM

**Training Program Maintainer:** Security Team
**Last Updated:** 2026-02-23
**Next Review:** 2026-05-23 (Quarterly)

---

*This training program follows the Graceful Books Steadiness communication style: patient, supportive, and step-by-step. We believe that security doesn't have to be intimidating - it's a skill you can master with practice and guidance.*
