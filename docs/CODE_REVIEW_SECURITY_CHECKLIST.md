# Code Review Security Checklist

**Version:** 1.0
**Created:** 2026-02-23
**Purpose:** Mandatory security checklist for code reviews
**Status:** Active

---

## Table of Contents

1. [When to Use This Checklist](#when-to-use-this-checklist)
2. [How to Use This Checklist](#how-to-use-this-checklist)
3. [Security Review Checklist](#security-review-checklist)
4. [Severity Definitions](#severity-definitions)
5. [Example Code Review Scenarios](#example-code-review-scenarios)
6. [Quick Reference](#quick-reference)
7. [Resources](#resources)

---

## When to Use This Checklist

**Mandatory security review is required for ALL pull requests that modify:**

### Critical Security Areas (Requires Senior Security Review)
- ✅ **Data access functions** - Any changes to `src/store/*.ts` files
- ✅ **Authorization logic** - Changes to `src/utils/authorization.ts`
- ✅ **Authentication** - Changes to `src/auth/*.ts` files
- ✅ **Encryption/decryption** - Changes to `src/crypto/*.ts` files
- ✅ **API endpoints** - New or modified endpoints (sync relay, etc.)
- ✅ **User input handling** - Forms, validation, sanitization
- ✅ **RBAC permissions** - Changes to role-based access control
- ✅ **Session management** - Login, logout, session tokens
- ✅ **Rate limiting** - Changes to rate limit configuration

### Important Security Areas (Requires Security-Aware Review)
- ⚠️ **Database schema changes** - New tables, fields, indexes
- ⚠️ **UI components accepting user input** - Forms, editors, file uploads
- ⚠️ **Third-party integrations** - External APIs, libraries
- ⚠️ **Export/import functionality** - Data export, CSV import, backups
- ⚠️ **Logging changes** - Security event logging, audit trail
- ⚠️ **Configuration changes** - Environment variables, security headers
- ⚠️ **CPG tool changes** - Distribution calculator, saved scenarios

### All Other Changes
- 📝 **Standard code review** - Use relevant sections of this checklist

---

## How to Use This Checklist

### For Pull Request Authors

1. **Before submitting PR:**
   - Run through the checklist yourself
   - Mark completed items in PR description
   - Note any items that need special attention
   - Add security testing evidence (screenshots, test results)

2. **In PR description:**
   - Indicate which security areas are affected
   - Link to relevant security documentation
   - Explain security implications of changes
   - Note if you need senior security reviewer

3. **Example PR description:**
   ```markdown
   ## Security Review

   **Security Areas Modified:**
   - [x] Data access functions (src/store/accounts.ts)
   - [ ] Authorization logic
   - [ ] User input handling

   **Security Testing:**
   - ✅ IDOR tests passing (see test output below)
   - ✅ Input validation tests added
   - ✅ Manual security testing completed

   **Security Reviewer Needed:** Yes - modified data access layer

   [Screenshot of test results]
   ```

### For Code Reviewers

1. **Determine review depth:**
   - Critical areas: Use full checklist + senior review required
   - Important areas: Use relevant sections thoroughly
   - Other changes: Focus on applicable items

2. **Mark findings:**
   - 🔴 **BLOCKER:** Must fix before merge
   - 🟡 **WARNING:** Should fix before merge
   - 🔵 **SUGGESTION:** Consider for improvement
   - ✅ **VERIFIED:** Security check passed

3. **Document review:**
   - Add review comments for each finding
   - Approve only when all blockers resolved
   - Request changes if warnings or blockers exist

---

## Security Review Checklist

### 1. Authorization and Access Control (IDOR Prevention)

**Required for:** All data access function changes

#### 1.1 CompanyId Parameter
- [ ] **All data access functions accept `companyId` parameter**
  - Function signature includes: `companyId: string`
  - CompanyId is NOT optional (no `?` in type)
  - CompanyId is first parameter (after ID if applicable)

  ```typescript
  // ✅ GOOD
  async function getAccount(accountId: string, companyId: string, context: EncryptionContext)

  // ❌ BAD - no companyId parameter
  async function getAccount(accountId: string, context: EncryptionContext)

  // ❌ BAD - companyId is optional
  async function getAccount(accountId: string, companyId?: string, context: EncryptionContext)
  ```

#### 1.2 CompanyId Validation
- [ ] **CompanyId is validated using `validateCompanyId()`**
  - Called at the start of function
  - Returns error if validation fails
  - No code executes before validation

  ```typescript
  // ✅ GOOD
  const validationError = validateCompanyId(companyId);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // ❌ BAD - no validation
  const account = await db.accounts.get(accountId);
  ```

#### 1.3 Ownership Verification (Single Entity)
- [ ] **Uses `requireCompanyOwnership()` for single entity access**
  - Called after fetching entity from database
  - Returns NOT_FOUND (not FORBIDDEN) if unauthorized
  - Uses `authCheck.resource` for subsequent operations

  ```typescript
  // ✅ GOOD
  const entity = await db.accounts.get(accountId);
  const authCheck = requireCompanyOwnership(entity, companyId);
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error }; // Returns NOT_FOUND
  }
  const account = fromAccountEntity(authCheck.resource);

  // ❌ BAD - no ownership check
  const entity = await db.accounts.get(accountId);
  const account = fromAccountEntity(entity);

  // ❌ BAD - checking companyId directly (use helper instead)
  if (entity.companyId !== companyId) {
    return { success: false, error: ... };
  }
  ```

#### 1.4 Batch Ownership Verification
- [ ] **Uses `requireBatchCompanyOwnership()` for batch operations**
  - Called after fetching multiple entities
  - Verifies ALL entities belong to requesting company
  - Returns NOT_FOUND if any entity unauthorized

  ```typescript
  // ✅ GOOD
  const entities = await db.accounts.bulkGet(accountIds);
  const authCheck = requireBatchCompanyOwnership(entities, companyId);
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error };
  }
  const accounts = authCheck.resource.map(fromAccountEntity);

  // ❌ BAD - no batch ownership check
  const entities = await db.accounts.bulkGet(accountIds);
  const accounts = entities.map(fromAccountEntity);
  ```

#### 1.5 Query Functions
- [ ] **Query functions have companyId as required first parameter**
  - CompanyId NOT in optional filter object
  - Query starts with `.where('companyId').equals(companyId)`
  - Cannot be bypassed by omitting filter

  ```typescript
  // ✅ GOOD - companyId required
  async function queryAccounts(
    companyId: string,
    filter?: Omit<AccountFilter, 'companyId'>
  ) {
    const validationError = validateCompanyId(companyId);
    if (validationError) return { success: false, error: validationError };

    let query = db.accounts.where('companyId').equals(companyId);
    // Add other filters...
  }

  // ❌ BAD - companyId in optional filter
  async function queryAccounts(filter?: AccountFilter) {
    let query = db.accounts.toCollection();
    if (filter?.companyId) { // ❌ Optional!
      query = query.filter(a => a.companyId === filter.companyId);
    }
  }
  ```

#### 1.6 Direct Database Access
- [ ] **No direct database queries without companyId filter**
  - No `.toArray()` without `.where('companyId')`
  - No `.get()` without ownership verification
  - No bulk operations without batch ownership check

**🔴 BLOCKER SEVERITY:** Any IDOR vulnerability MUST be fixed before merge.

**Reference:** `docs/SECURITY_GUIDELINES.md` - Authorization section

---

### 2. Input Validation

**Required for:** User input handling changes, new forms, API endpoints

#### 2.1 Schema Validation
- [ ] **All user input validated with Zod schemas**
  - Input validated before use
  - Validation errors returned to user with helpful messages
  - No unvalidated input reaches database or business logic

  ```typescript
  // ✅ GOOD
  import { z } from 'zod';

  const AccountSchema = z.object({
    name: z.string().min(1).max(100),
    accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
    balance: z.number().int().finite()
  });

  const result = AccountSchema.safeParse(input);
  if (!result.success) {
    return { success: false, error: { code: 'VALIDATION_ERROR', message: result.error } };
  }
  const validatedData = result.data;

  // ❌ BAD - no validation
  const account = await createAccount(input);
  ```

#### 2.2 Type Coercion
- [ ] **No unsafe type coercion**
  - Use explicit parsing (parseInt, parseFloat)
  - Check for NaN after parsing numbers
  - Validate types match expected schema

  ```typescript
  // ✅ GOOD
  const amount = parseFloat(input.amount);
  if (isNaN(amount) || !isFinite(amount)) {
    return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Amount must be a valid number' }};
  }

  // ❌ BAD - implicit coercion
  const amount = +input.amount; // Could be NaN
  const total = amount + 100; // Could be NaN + 100
  ```

#### 2.3 String Validation
- [ ] **String inputs have length limits**
  - Maximum length enforced (prevent DoS)
  - Minimum length enforced if required
  - Empty strings handled appropriately

  ```typescript
  // ✅ GOOD
  const nameSchema = z.string().min(1, 'Name is required').max(100, 'Name too long');

  // ❌ BAD - no length limit
  const nameSchema = z.string(); // Could be megabytes long
  ```

#### 2.4 Array/Object Validation
- [ ] **Arrays have maximum size limits**
  - Prevent memory exhaustion attacks
  - Validate each array element
  - Check for duplicate values if required

  ```typescript
  // ✅ GOOD
  const BatchUpdateSchema = z.object({
    accountIds: z.array(z.string()).min(1).max(100) // Limit to 100 items
  });

  // ❌ BAD - no size limit
  const BatchUpdateSchema = z.object({
    accountIds: z.array(z.string()) // Could be millions of items
  });
  ```

#### 2.5 File Upload Validation
- [ ] **File uploads validated for type and size**
  - Whitelist allowed file types (not blacklist)
  - Maximum file size enforced
  - File content validated (not just extension)
  - Scanned for malware if possible

  ```typescript
  // ✅ GOOD
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: 'File too large' };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: 'File type not allowed' };
  }

  // ❌ BAD - no validation
  const data = await file.text(); // Could be gigabytes
  ```

**🟡 WARNING SEVERITY:** Missing input validation should be fixed before merge.

**Reference:** `docs/SECURITY_GUIDELINES.md` - Input Validation section

---

### 3. XSS Prevention

**Required for:** UI components, user-generated content display, HTML rendering

#### 3.1 React JSX Escaping
- [ ] **Use React's automatic JSX escaping**
  - Display user content in JSX (not dangerouslySetInnerHTML)
  - React escapes automatically
  - No manual HTML construction

  ```typescript
  // ✅ GOOD - React escapes automatically
  <div>{userInput}</div>
  <div>{account.name}</div>

  // ❌ BAD - manual HTML construction
  element.innerHTML = `<div>${userInput}</div>`;
  ```

#### 3.2 DangerouslySetInnerHTML
- [ ] **DangerouslySetInnerHTML uses DOMPurify sanitization**
  - Only use when absolutely necessary (rich text, etc.)
  - Always sanitize with DOMPurify.sanitize()
  - Configure DOMPurify with strict settings
  - Document why dangerouslySetInnerHTML is needed

  ```typescript
  // ✅ GOOD - sanitized with DOMPurify
  import DOMPurify from 'dompurify';

  const sanitized = DOMPurify.sanitize(userHtml, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: []
  });
  <div dangerouslySetInnerHTML={{ __html: sanitized }} />

  // ❌ BAD - no sanitization
  <div dangerouslySetInnerHTML={{ __html: userHtml }} />
  ```

#### 3.3 URL Sanitization
- [ ] **URLs sanitized before use in href or src**
  - Validate URL scheme (http/https only, no javascript:)
  - Use `sanitizeUrl()` utility
  - Be especially careful with user-provided URLs

  ```typescript
  // ✅ GOOD
  import { sanitizeUrl } from '../utils/sanitize';

  const safe = sanitizeUrl(userUrl);
  <a href={safe}>Link</a>

  // ❌ BAD - unsanitized URL
  <a href={userUrl}>Link</a> // Could be javascript:alert(1)
  ```

#### 3.4 Event Handlers
- [ ] **No inline event handlers from user content**
  - Use React event handlers (onClick={handler})
  - Never construct event handlers from strings
  - No eval() or Function() with user input

  ```typescript
  // ✅ GOOD
  <button onClick={handleClick}>Click</button>

  // ❌ BAD - inline event handler from user input
  <button onClick={`userFunction(${userInput})`}>Click</button>
  ```

#### 3.5 Third-Party Content
- [ ] **Third-party content rendered in sandboxed iframe**
  - Use sandbox attribute
  - Restrict permissions
  - Use CSP headers

  ```typescript
  // ✅ GOOD
  <iframe
    sandbox="allow-scripts"
    src={sanitizedUrl}
    title="External content"
  />

  // ❌ BAD - no sandbox
  <iframe src={url} />
  ```

**🔴 BLOCKER SEVERITY:** XSS vulnerabilities MUST be fixed before merge.

**Reference:** `docs/SECURITY_GUIDELINES.md` - XSS Prevention section

---

### 4. Role-Based Access Control (RBAC)

**Required for:** Changes to permission-gated features, role checks

#### 4.1 Permission Checks
- [ ] **Features check RBAC permissions**
  - Use `hasPermission()` from RBAC service
  - Check at start of function (fail fast)
  - Return FORBIDDEN if permission denied

  ```typescript
  // ✅ GOOD
  const canDelete = await rbacService.hasPermission(userId, companyId, 'DELETE_ACCOUNTS');
  if (!canDelete) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No permission' }};
  }

  // ❌ BAD - no permission check
  await deleteAccount(accountId);
  ```

#### 4.2 UI Permission Gating
- [ ] **UI elements hidden based on permissions**
  - Check permissions before rendering sensitive UI
  - Disable buttons/links user can't use
  - Show helpful message if feature locked

  ```typescript
  // ✅ GOOD
  const canEdit = hasPermission(user, 'EDIT_ACCOUNTS');

  return (
    <>
      {canEdit ? (
        <button onClick={handleEdit}>Edit</button>
      ) : (
        <Tooltip content="You don't have permission to edit accounts">
          <button disabled>Edit</button>
        </Tooltip>
      )}
    </>
  );

  // ❌ BAD - no permission check
  <button onClick={handleEdit}>Edit</button>
  ```

#### 4.3 Combined Authorization
- [ ] **Both companyId AND permissions checked**
  - First: Check company ownership (IDOR prevention)
  - Second: Check role permission (RBAC)
  - Both must pass to allow access

  ```typescript
  // ✅ GOOD - layered security
  // Layer 1: Company ownership (IDOR prevention)
  const authCheck = requireCompanyOwnership(entity, companyId);
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error };
  }

  // Layer 2: Role permission (RBAC)
  const canDelete = await rbacService.hasPermission(userId, companyId, 'DELETE_ACCOUNTS');
  if (!canDelete) {
    return { success: false, error: { code: 'FORBIDDEN', message: 'No permission' }};
  }

  // Both checks passed - safe to proceed
  await deleteAccount(authCheck.resource);

  // ❌ BAD - only checks permission, not ownership
  if (await hasPermission(userId, companyId, 'DELETE_ACCOUNTS')) {
    await deleteAccount(accountId); // IDOR vulnerability!
  }
  ```

**🟡 WARNING SEVERITY:** Missing RBAC checks should be fixed before merge.

**Reference:** `docs/RBAC_PERMISSION_MATRIX.md`

---

### 5. Cryptography and Encryption

**Required for:** Changes to encryption, key handling, crypto operations

#### 5.1 Use Encryption Service
- [ ] **Uses `IEncryptionService` (not custom crypto)**
  - All encryption via encryption service
  - No direct calls to Web Crypto API
  - No custom encryption implementations

  ```typescript
  // ✅ GOOD
  const encrypted = await context.encrypt(sensitiveData);
  const decrypted = await context.decrypt(encrypted);

  // ❌ BAD - custom crypto implementation
  const encrypted = await crypto.subtle.encrypt(...); // Don't do this
  ```

#### 5.2 Sensitive Data Never Logged
- [ ] **No sensitive data in console.log or logger**
  - No passphrases, passwords, keys in logs
  - No financial data in logs (amounts, balances)
  - No PII in logs (names, emails) unless necessary
  - Redact sensitive fields before logging

  ```typescript
  // ✅ GOOD - redacted logging
  logger.info('Account created', {
    accountId: account.id,
    accountType: account.type,
    // Balance NOT logged (sensitive)
  });

  // ❌ BAD - logs sensitive data
  console.log('Account:', account); // Includes balance, memos, etc.
  logger.debug('Passphrase:', passphrase); // NEVER log this!
  ```

#### 5.3 Keys in Memory Only
- [ ] **Encryption keys never persisted unencrypted**
  - Keys only in memory (variables)
  - Never in localStorage, sessionStorage, or IndexedDB
  - Cleared when no longer needed

  ```typescript
  // ✅ GOOD - key in memory only
  const key = await deriveKey(passphrase);
  // Use key...
  // Key is garbage collected when out of scope

  // ❌ BAD - key persisted
  localStorage.setItem('encryptionKey', key); // NEVER do this!
  ```

#### 5.4 Secure Random Values
- [ ] **Uses crypto.getRandomValues() for randomness**
  - No Math.random() for security-sensitive values
  - Use crypto.getRandomValues() or crypto.randomUUID()
  - Sufficient entropy for IDs, nonces, salts

  ```typescript
  // ✅ GOOD
  const id = crypto.randomUUID();
  const nonce = crypto.getRandomValues(new Uint8Array(16));

  // ❌ BAD - weak randomness
  const id = Math.random().toString(36); // Predictable!
  ```

**🔴 BLOCKER SEVERITY:** Crypto vulnerabilities MUST be fixed before merge.

**Reference:** `docs/SECURITY_ARCHITECTURE.md` - Cryptography section

---

### 6. Rate Limiting

**Required for:** Authentication endpoints, expensive operations, external APIs

#### 6.1 Rate Limit Application
- [ ] **Rate limiting applied to sensitive operations**
  - Login attempts
  - Password reset requests
  - Account creation
  - Expensive computations
  - External API calls

  ```typescript
  // ✅ GOOD
  import { checkRateLimit } from '../utils/rateLimit';

  async function login(email: string, password: string) {
    const rateLimitCheck = await checkRateLimit('login', email);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Please try again later.'
        }
      };
    }
    // Proceed with login...
  }

  // ❌ BAD - no rate limiting
  async function login(email: string, password: string) {
    // Attacker can try millions of passwords
  }
  ```

#### 6.2 Rate Limit Configuration
- [ ] **Rate limits are reasonable**
  - Not too strict (false positives)
  - Not too lenient (ineffective)
  - Consider legitimate use cases
  - Document limits in code comments

  ```typescript
  // ✅ GOOD - documented, reasonable limits
  const RATE_LIMITS = {
    login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 min
    resetPassword: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  };

  // ❌ BAD - too strict
  const RATE_LIMITS = {
    login: { maxAttempts: 1, windowMs: 60 * 60 * 1000 }, // Only 1 per hour?!
  };
  ```

**🟡 WARNING SEVERITY:** Missing rate limiting on sensitive operations should be added.

**Reference:** `docs/RATE_LIMITING_USAGE.md`

---

### 7. Security Logging and Audit Trail

**Required for:** Security events, data modifications, access control changes

#### 7.1 Security Event Logging
- [ ] **Security events logged**
  - Failed login attempts
  - Authorization failures
  - Encryption errors
  - Rate limit violations
  - Suspicious activity

  ```typescript
  // ✅ GOOD
  import { logSecurityEvent } from '../utils/securityLogger';

  const authCheck = requireCompanyOwnership(entity, companyId);
  if (!authCheck.authorized) {
    await logSecurityEvent({
      type: 'AUTHORIZATION_FAILED',
      userId,
      companyId,
      resourceType: 'account',
      resourceId: entity?.id,
      timestamp: new Date()
    });
    return { success: false, error: authCheck.error };
  }

  // ❌ BAD - no security logging
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error };
  }
  ```

#### 7.2 Audit Trail
- [ ] **Data modifications logged to audit trail**
  - All creates, updates, deletes
  - Who made the change (userId)
  - When (timestamp)
  - What changed (before/after values)
  - Why (if available - user notes)

  ```typescript
  // ✅ GOOD
  import { logCreate, logUpdate } from '../services/audit';

  const account = await createAccount(data);
  await logCreate('account', account.id, account, userId, companyId);

  // ❌ BAD - no audit logging
  const account = await createAccount(data);
  // No record of who created this or when
  ```

#### 7.3 No Sensitive Data in Logs
- [ ] **Audit logs don't contain sensitive data**
  - Don't log encrypted data (large blobs)
  - Don't log passphrases or keys
  - Redact sensitive fields if needed
  - Log metadata, not content

  ```typescript
  // ✅ GOOD - metadata only
  await logUpdate('transaction', transaction.id, {
    amount: 'REDACTED', // Don't log actual amount
    memo: 'REDACTED',   // Don't log memo
    status: newStatus   // OK to log status change
  }, userId, companyId);

  // ❌ BAD - logs sensitive data
  await logUpdate('transaction', transaction.id, transaction, userId, companyId);
  ```

**🟡 WARNING SEVERITY:** Missing audit logging should be added before merge.

**Reference:** `docs/SECURITY_EVENT_LOGGING.md`, `docs/USER_ACTIVITY_LOGGING_GUIDE.md`

---

### 8. Session and Authentication

**Required for:** Login/logout changes, session handling, token management

#### 8.1 Session Validation
- [ ] **All protected operations validate session**
  - Check session exists and is valid
  - Check session not expired
  - Check session belongs to requesting user

  ```typescript
  // ✅ GOOD
  const session = await validateSession(sessionToken);
  if (!session || session.expiresAt < new Date()) {
    return { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid session' }};
  }

  // ❌ BAD - no session validation
  const userId = request.headers.get('X-User-Id'); // Anyone can set this!
  ```

#### 8.2 Session Expiration
- [ ] **Sessions have reasonable expiration times**
  - Not too short (annoying for users)
  - Not too long (security risk)
  - Refresh mechanism for active users

  ```typescript
  // ✅ GOOD
  const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours
  const REFRESH_WINDOW = 30 * 60 * 1000; // Refresh if < 30 min remaining

  // ❌ BAD - session never expires
  const session = { userId, expiresAt: null }; // Lasts forever!
  ```

#### 8.3 Secure Session Storage
- [ ] **Session tokens stored securely**
  - HttpOnly cookies (if using cookies)
  - Secure flag set (HTTPS only)
  - SameSite attribute set
  - Not in localStorage (XSS risk)

  ```typescript
  // ✅ GOOD - secure cookie
  response.cookie('sessionToken', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: SESSION_DURATION
  });

  // ❌ BAD - localStorage
  localStorage.setItem('sessionToken', token); // Vulnerable to XSS
  ```

**🔴 BLOCKER SEVERITY:** Session security issues MUST be fixed before merge.

**Reference:** `docs/SESSION_SECURITY_IMPLEMENTATION.md`

---

### 9. Third-Party Dependencies

**Required for:** Adding or updating npm packages

#### 9.1 Dependency Security Audit
- [ ] **`npm audit` run before adding dependencies**
  - No high or critical vulnerabilities
  - Review moderate/low vulnerabilities
  - Document accepted risks

  ```bash
  # ✅ GOOD - audit before install
  npm audit
  npm install package-name
  npm audit

  # ❌ BAD - install without audit
  npm install package-name
  ```

#### 9.2 Dependency Vetting
- [ ] **New dependencies vetted for security**
  - Check package reputation (downloads, maintainers)
  - Review package source code if possible
  - Check for known vulnerabilities
  - Consider if really needed (avoid dependency bloat)

  ```typescript
  // ✅ GOOD - well-established packages
  import DOMPurify from 'dompurify'; // 50M+ downloads, maintained
  import { z } from 'zod'; // 20M+ downloads, maintained

  // ❌ BAD - unknown package
  import sanitize from 'unknown-sanitizer-lib'; // 10 downloads, last updated 2018
  ```

#### 9.3 License Compliance
- [ ] **Dependency licenses compatible**
  - Check license compatibility with project
  - No GPL/AGPL for proprietary code
  - Document license if unusual

  ```bash
  # Check licenses
  npx license-checker --summary
  ```

**🟡 WARNING SEVERITY:** Dependency issues should be resolved before merge.

**Reference:** `docs/LICENSE_COMPLIANCE_REPORT.md`, `docs/DEPENDENCY_MANAGEMENT.md`

---

### 10. Configuration and Secrets

**Required for:** Environment variables, API keys, configuration changes

#### 10.1 No Hardcoded Secrets
- [ ] **No secrets in source code**
  - No API keys, passwords, tokens
  - Use environment variables
  - Use secrets management service (production)
  - Example secrets in .env.example only

  ```typescript
  // ✅ GOOD - from environment
  const apiKey = process.env.VITE_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_API_KEY not configured');
  }

  // ❌ BAD - hardcoded secret
  const apiKey = 'sk_live_abc123...'; // NEVER do this!
  ```

#### 10.2 Environment Variable Validation
- [ ] **Required environment variables validated at startup**
  - Fail fast if critical config missing
  - Provide helpful error messages
  - Document all env vars

  ```typescript
  // ✅ GOOD - validate at startup
  const requiredEnvVars = ['VITE_API_URL', 'VITE_ENCRYPTION_VERSION'];
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }

  // ❌ BAD - no validation, fails later
  const apiUrl = process.env.VITE_API_URL; // Could be undefined
  fetch(apiUrl + '/data'); // Runtime error
  ```

#### 10.3 Secure Defaults
- [ ] **Security settings default to most secure option**
  - Opt-in for less secure options
  - Never default to development mode in production
  - Warn if insecure configuration detected

  ```typescript
  // ✅ GOOD - secure by default
  const config = {
    encryption: process.env.ENCRYPTION_ENABLED !== 'false', // Default true
    httpsOnly: process.env.HTTPS_ONLY !== 'false', // Default true
  };

  // ❌ BAD - insecure by default
  const config = {
    encryption: process.env.ENCRYPTION_ENABLED === 'true', // Default false!
  };
  ```

**🔴 BLOCKER SEVERITY:** Exposed secrets MUST be fixed and rotated before merge.

**Reference:** `docs/SECURITY_ARCHITECTURE.md` - Configuration section

---

### 11. Error Handling

**Required for:** All code changes (general best practice)

#### 11.1 User-Friendly Error Messages
- [ ] **Error messages don't leak sensitive information**
  - Don't expose internal paths, stack traces
  - Don't reveal whether resource exists (if unauthorized)
  - Use generic messages for security errors
  - Follow Steadiness communication style

  ```typescript
  // ✅ GOOD - generic, friendly message
  return {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: "We couldn't find that. It may have been deleted or you may not have access to it."
    }
  };

  // ❌ BAD - reveals internal details
  return {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Account ${accountId} not found in company ${companyId}` // Leaks IDs!
    }
  };

  // ❌ BAD - reveals existence
  if (!entity) {
    return { error: 'Not found' };
  }
  if (entity.companyId !== companyId) {
    return { error: 'Access denied' }; // Confirms it exists!
  }
  ```

#### 11.2 Fail Secure
- [ ] **Errors default to denying access**
  - On error, deny access (don't grant)
  - Log error for debugging
  - Return safe default value

  ```typescript
  // ✅ GOOD - fails secure
  function hasPermission(user, permission) {
    try {
      return checkPermission(user, permission);
    } catch (error) {
      logger.error('Permission check failed', { error });
      return false; // Deny access on error
    }
  }

  // ❌ BAD - fails open
  function hasPermission(user, permission) {
    try {
      return checkPermission(user, permission);
    } catch (error) {
      return true; // Grants access on error!
    }
  }
  ```

#### 11.3 Error Logging
- [ ] **Errors logged with context**
  - Log error details for debugging
  - Include relevant context (userId, operation)
  - Don't log sensitive data
  - Use structured logging

  ```typescript
  // ✅ GOOD - structured error logging
  try {
    await deleteAccount(accountId, companyId);
  } catch (error) {
    logger.error('Failed to delete account', {
      error: error.message,
      accountId,
      companyId,
      userId,
      // Don't log account details (sensitive)
    });
    throw error;
  }

  // ❌ BAD - no error logging
  try {
    await deleteAccount(accountId, companyId);
  } catch (error) {
    // Silent failure - no way to debug
  }
  ```

**🟡 WARNING SEVERITY:** Poor error handling should be improved before merge.

**Reference:** `docs/SECURITY_GUIDELINES.md` - Error Handling section

---

### 12. Testing

**Required for:** All security-sensitive changes

#### 12.1 Security Tests Included
- [ ] **Security tests added for changes**
  - IDOR tests for data access changes
  - Input validation tests for new inputs
  - XSS tests for UI changes
  - Permission tests for RBAC changes

  ```typescript
  // ✅ GOOD - comprehensive security tests
  describe('getAccount - IDOR Prevention', () => {
    it('should prevent cross-company access', async () => {
      const result = await getAccount(
        accountBelongingToCompanyA,
        companyB, // Different company!
        context
      );
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  // ❌ BAD - no security tests
  describe('getAccount', () => {
    it('should return account', async () => {
      const result = await getAccount(accountId, companyId, context);
      expect(result.success).toBe(true);
    });
    // Missing: What if companyId is wrong?
  });
  ```

#### 12.2 Edge Cases Tested
- [ ] **Security edge cases covered**
  - Null/undefined inputs
  - Empty strings
  - Very long strings (DoS)
  - Negative numbers
  - Special characters
  - SQL/XSS injection attempts

  ```typescript
  // ✅ GOOD - edge cases tested
  describe('Input Validation', () => {
    it('should reject null companyId', async () => {
      const result = await getAccount(accountId, null as any, context);
      expect(result.success).toBe(false);
    });

    it('should reject XSS attempt in name', async () => {
      const result = await createAccount({
        name: '<script>alert(1)</script>',
        // ...
      });
      expect(result.success).toBe(false);
    });
  });
  ```

#### 12.3 Test Coverage
- [ ] **Security code paths have test coverage**
  - Authorization checks tested
  - Error paths tested
  - Edge cases tested
  - Use code coverage report to verify

**🟡 WARNING SEVERITY:** Missing security tests should be added before merge.

**Reference:** `docs/SECURITY_GUIDELINES.md` - Testing section

---

## Severity Definitions

### 🔴 BLOCKER (Must Fix Before Merge)
- IDOR vulnerabilities (cross-company data access)
- XSS vulnerabilities
- Exposed secrets (API keys, passwords)
- Broken authentication/authorization
- SQL/NoSI injection vulnerabilities
- Cryptography errors

**Action:** Request changes, do not approve PR until fixed.

### 🟡 WARNING (Should Fix Before Merge)
- Missing input validation
- Missing rate limiting on sensitive operations
- Missing RBAC permission checks
- Missing security logging
- Missing audit trail
- Weak error messages (information leakage)
- Missing security tests

**Action:** Request changes, approve only if fix is planned immediately after merge.

### 🔵 SUGGESTION (Consider for Improvement)
- Performance optimizations
- Code style improvements
- Additional test coverage
- Better documentation
- Refactoring opportunities

**Action:** Add comment for author consideration, can approve PR.

### ✅ VERIFIED (Security Check Passed)
- Authorization properly implemented
- Input validation comprehensive
- Tests cover security scenarios
- No security issues found

**Action:** Add review comment confirming verification, approve PR.

---

## Example Code Review Scenarios

### Scenario 1: Data Access Function Addition

**PR Changes:**
- Adds new `getDistributor()` function to `src/store/cpg/distributors.ts`
- Function accepts `distributorId` parameter

**Review Checklist:**
1. ✅ Check function signature includes `companyId` parameter
2. ✅ Verify `validateCompanyId()` called first
3. ✅ Verify `requireCompanyOwnership()` used
4. ✅ Check returns NOT_FOUND if unauthorized
5. ✅ Verify tests include IDOR test
6. ✅ Check audit logging included

**Example Review Comment:**
```markdown
## Security Review - Data Access Function

✅ **VERIFIED:** Authorization properly implemented
- CompanyId parameter: ✅ Present
- CompanyId validation: ✅ Uses validateCompanyId()
- Ownership check: ✅ Uses requireCompanyOwnership()
- Returns NOT_FOUND: ✅ Correct
- IDOR test: ✅ Included
- Audit logging: ✅ Included

No security issues found. Approved.
```

### Scenario 2: User Input Form

**PR Changes:**
- Adds new form for creating distribution scenarios
- Accepts user input: name, margin, fees

**Review Checklist:**
1. ✅ Check Zod schema validation
2. ✅ Verify string length limits
3. ✅ Verify number validation (no NaN)
4. ✅ Check XSS prevention (React escaping)
5. ✅ Verify error messages user-friendly
6. ✅ Check validation tests included

**Example Review Comment:**
```markdown
## Security Review - User Input Handling

🟡 **WARNING:** Missing string length limit

Issues found:
1. 🟡 Scenario name has no max length - could cause DoS
   - Add: `.max(100, 'Name too long')`
2. ✅ Number validation looks good (checks for NaN)
3. ✅ XSS prevention: React escaping used correctly
4. ✅ Validation tests included

Please add string length limit before merge.
```

### Scenario 3: Authentication Change

**PR Changes:**
- Modifies login function to add rate limiting
- Changes session expiration time

**Review Checklist:**
1. ✅ Check rate limiting properly implemented
2. ✅ Verify rate limit configuration reasonable
3. ✅ Check session expiration reasonable
4. ✅ Verify security logging included
5. ✅ Check tests cover rate limiting
6. ✅ Check tests cover session expiration

**Example Review Comment:**
```markdown
## Security Review - Authentication

✅ **VERIFIED:** Security improvements implemented correctly

Changes reviewed:
- Rate limiting: ✅ 5 attempts per 15 min (reasonable)
- Session expiration: ✅ 8 hours (good balance)
- Security logging: ✅ Failed attempts logged
- Tests: ✅ Rate limiting tested
- Tests: ✅ Session expiration tested

Great security improvements! Approved.
```

### Scenario 4: RBAC Permission Addition

**PR Changes:**
- Adds `DELETE_DISTRIBUTORS` permission
- Gates delete button based on permission

**Review Checklist:**
1. ✅ Check permission added to RBAC matrix
2. ✅ Verify backend checks permission
3. ✅ Verify UI checks permission before showing button
4. ✅ Check combined with companyId check (IDOR prevention)
5. ✅ Verify tests cover permission check
6. ✅ Check tests cover unauthorized access

**Example Review Comment:**
```markdown
## Security Review - RBAC

🔴 **BLOCKER:** Backend doesn't check permission

Issues found:
1. 🔴 `deleteDistributor()` doesn't check RBAC permission
   - Only checks companyId (IDOR prevention)
   - Missing: `hasPermission(userId, companyId, 'DELETE_DISTRIBUTORS')`
2. ✅ UI correctly hides button for unauthorized users
3. ✅ Permission added to RBAC matrix

CRITICAL: Must add backend permission check. UI-only security is insufficient (can be bypassed).
```

---

## Quick Reference

### Data Access Function Checklist
```typescript
async function getData(id: string, companyId: string, context: EncryptionContext) {
  // 1. ✅ Validate companyId
  const validationError = validateCompanyId(companyId);
  if (validationError) return { success: false, error: validationError };

  // 2. ✅ Fetch entity
  const entity = await db.table.get(id);

  // 3. ✅ Verify ownership
  const authCheck = requireCompanyOwnership(entity, companyId);
  if (!authCheck.authorized) return { success: false, error: authCheck.error };

  // 4. ✅ Use authorized entity
  const data = fromEntity(authCheck.resource);

  // 5. ✅ Decrypt and return
  const decrypted = await context.decrypt(data);
  return { success: true, data: decrypted };
}
```

### Input Validation Checklist
```typescript
import { z } from 'zod';

const Schema = z.object({
  name: z.string().min(1).max(100),          // ✅ Length limits
  email: z.string().email(),                 // ✅ Format validation
  amount: z.number().int().finite().min(0),  // ✅ Type + range validation
  type: z.enum(['A', 'B', 'C']),            // ✅ Allowed values
});

const result = Schema.safeParse(input);
if (!result.success) {
  return { success: false, error: { code: 'VALIDATION_ERROR', message: result.error }};
}
const validData = result.data; // ✅ Type-safe validated data
```

### XSS Prevention Checklist
```typescript
// ✅ React automatic escaping
<div>{userInput}</div>

// ✅ DOMPurify for rich text
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userHtml, { ALLOWED_TAGS: ['b', 'i'] });
<div dangerouslySetInnerHTML={{ __html: clean }} />

// ✅ URL sanitization
import { sanitizeUrl } from '../utils/sanitize';
<a href={sanitizeUrl(userUrl)}>Link</a>
```

### RBAC Permission Checklist
```typescript
// ✅ Backend permission check
const canDelete = await rbacService.hasPermission(userId, companyId, 'DELETE_RESOURCE');
if (!canDelete) {
  return { success: false, error: { code: 'FORBIDDEN', message: 'No permission' }};
}

// ✅ UI permission gating
const canEdit = hasPermission(user, 'EDIT_RESOURCE');
{canEdit && <button onClick={handleEdit}>Edit</button>}
```

---

## Resources

### Internal Documentation
- **Security Architecture:** `docs/SECURITY_ARCHITECTURE.md`
- **Security Guidelines:** `docs/SECURITY_GUIDELINES.md`
- **RBAC Matrix:** `docs/RBAC_PERMISSION_MATRIX.md`
- **Penetration Test Report:** `docs/INTERNAL_PENTEST_REPORT.md`
- **Agent Review Checklist:** `Roadmaps/AGENT_REVIEW_CHECKLIST.md`

### External Resources
- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **OWASP Cheat Sheets:** https://cheatsheetseries.owasp.org/
- **Web Security Academy:** https://portswigger.net/web-security
- **CWE Top 25:** https://cwe.mitre.org/top25/

### Code References
- **Authorization Helpers:** `src/utils/authorization.ts`
- **Input Validation:** `src/utils/validation.ts`
- **Sanitization:** `src/utils/sanitize.ts`
- **RBAC Service:** `src/services/rbac.ts`
- **Security Logging:** `src/utils/securityLogger.ts`
- **Audit Service:** `src/services/audit.ts`

---

## Appendix: PR Security Comment Template

Copy this template into PR description:

```markdown
## Security Review

**Security Areas Modified:**
- [ ] Data access functions
- [ ] Authorization logic
- [ ] Authentication
- [ ] Encryption/decryption
- [ ] User input handling
- [ ] RBAC permissions
- [ ] API endpoints
- [ ] Other: _______________

**Security Testing:**
- [ ] IDOR tests added/passing
- [ ] Input validation tests added/passing
- [ ] XSS prevention verified
- [ ] Permission tests added/passing
- [ ] Manual security testing completed

**Security Checklist:**
- [ ] All data access functions have companyId parameter
- [ ] All user input validated with Zod schemas
- [ ] No dangerouslySetInnerHTML without DOMPurify
- [ ] No secrets hardcoded
- [ ] No sensitive data in logs
- [ ] Error messages don't leak information
- [ ] Tests cover security scenarios

**Security Reviewer Needed:** Yes/No

**Additional Notes:**
[Explain security implications, design decisions, etc.]
```

---

## Document History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-23 | Initial creation | Security Team |

---

**Remember:** Security is everyone's responsibility! When in doubt, ask for help or request a senior security review. It's always better to be safe than sorry.

Thank you for keeping Graceful Books secure! 🔒
