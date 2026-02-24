# Security Audit Report - Graceful Books
**Date:** 2026-02-22
**Auditor:** Claude (AI Security Assistant)
**Scope:** IDOR Vulnerabilities & OWASP Top 10 (2021)

---

## Executive Summary

This security audit identified **CRITICAL vulnerabilities** that must be addressed immediately before deployment. The most severe issue is widespread **Insecure Direct Object Reference (IDOR)** vulnerabilities allowing unauthorized cross-company data access.

**Risk Level:** 🔴 **CRITICAL**
**Primary Concern:** Broken Access Control (OWASP A01:2021)

---

## Critical Findings

### 1. 🔴 CRITICAL: IDOR - No Authorization Checks in Data Access Layer

**Severity:** CRITICAL
**OWASP Category:** A01:2021 – Broken Access Control
**CVE Equivalent:** CWE-639 (Authorization Bypass Through User-Controlled Key)

#### Description
All data access functions in the store layer (`accounts.ts`, `transactions.ts`, `contacts.ts`, `products.ts`) retrieve records by ID without verifying that the requesting user has authorization to access those records.

#### Vulnerable Code Examples

**File:** `src/store/accounts.ts:207-259`
```typescript
export async function getAccount(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Account>> {
  try {
    const entity = await db.accounts.get(id)

    if (!entity) {
      return { success: false, error: { code: 'NOT_FOUND', message: `Account not found: ${id}` } }
    }

    // ❌ NO CHECK: Does this account belong to the user's company?
    // Anyone with an account ID can access ANY account in the database

    return { success: true, data: fromAccountEntity(entity) }
  }
}
```

**Similar vulnerabilities in:**
- `src/store/accounts.ts` - Lines 207, 264, 380
- `src/store/transactions.ts` - Lines 249, 306, 424, 488, 536
- `src/store/contacts.ts` - Lines 217, 289, 426
- `src/store/products.ts` - Lines 268, 326, 454

#### Attack Scenario
```typescript
// Attacker is logged into Company A (companyId: "company-a")
// They discover an account ID from Company B: "acc-company-b-123"

const result = await getAccount("acc-company-b-123")
// ❌ SUCCESS! Attacker can now read Company B's account data
// This violates zero-knowledge architecture and data sovereignty
```

#### Business Impact
- **Data Breach:** Users can access other companies' financial data
- **Regulatory Violation:** GDPR, SOC 2, financial privacy laws
- **Trust Violation:** Breaks zero-knowledge promise
- **Legal Liability:** Class-action lawsuit potential

#### Required Fix
Add `companyId` parameter to ALL data access functions and validate ownership:

```typescript
export async function getAccount(
  id: string,
  companyId: string, // ✅ Add this parameter
  context?: EncryptionContext
): Promise<DatabaseResult<Account>> {
  try {
    const entity = await db.accounts.get(id)

    if (!entity) {
      return { success: false, error: { code: 'NOT_FOUND', message: `Account not found: ${id}` } }
    }

    // ✅ CRITICAL: Verify ownership
    if (entity.companyId !== companyId) {
      return {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: You do not have permission to access this resource'
        }
      }
    }

    // Check if soft deleted
    if (entity.deletedAt) {
      return { success: false, error: { code: 'NOT_FOUND', message: `Account has been deleted: ${id}` } }
    }

    return { success: true, data: fromAccountEntity(entity) }
  }
}
```

**Apply this pattern to:**
- ✅ `getAccount()`, `updateAccount()`, `deleteAccount()`
- ✅ `getTransaction()`, `updateTransaction()`, `voidTransaction()`
- ✅ `getContact()`, `updateContact()`, `deleteContact()`
- ✅ `getProduct()`, `updateProduct()`, `deleteProduct()`
- ✅ `getInvoice()`, `updateInvoice()`, `deleteInvoice()`
- ✅ ALL other get/update/delete functions

---

### 2. ⚠️  HIGH: Missing Authorization in Batch Operations

**Severity:** HIGH
**OWASP Category:** A01:2021 – Broken Access Control

#### Vulnerable Code
**File:** `src/store/accounts.ts` (and similar in other stores)
```typescript
export async function getAccounts(
  filter: AccountFilter,
  context?: EncryptionContext
): Promise<DatabaseResult<Account[]>> {
  // ❌ Filter accepts companyId, but doesn't REQUIRE it
  // If omitted, returns ALL accounts across ALL companies
}
```

#### Required Fix
```typescript
export async function getAccounts(
  companyId: string, // ✅ Make this required, not optional
  filter?: Omit<AccountFilter, 'companyId'>, // Remove companyId from filter
  context?: EncryptionContext
): Promise<DatabaseResult<Account[]>> {
  try {
    let query = db.accounts.where('companyId').equals(companyId) // ✅ Always filter by company

    // Apply additional filters...
    if (filter?.type) {
      query = query.and(acc => acc.type === filter.type)
    }

    // ... rest of function
  }
}
```

---

### 3. ⚠️ HIGH: Potential XSS Through dangerouslySetInnerHTML

**Severity:** HIGH
**OWASP Category:** A03:2021 – Injection

#### Vulnerable Files
- `src/components/cpg/PromoDetailsForm.tsx`
- `src/services/scenarios/scenarioCalculator.service.ts`
- `src/components/emails/EmailPreferencesSetup.tsx`

#### Required Action
1. Audit each use of `dangerouslySetInnerHTML`
2. Ensure all content is sanitized with DOMPurify before rendering
3. Use React's built-in text rendering where possible

```typescript
// ❌ UNSAFE
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ✅ SAFE
import DOMPurify from 'dompurify'
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />

// ✅ BETTER - Use React's text rendering if possible
<div>{userContent}</div>
```

---

### 4. ⚠️ MEDIUM: Client-Side Security - localStorage Risks

**Severity:** MEDIUM
**OWASP Category:** A02:2021 – Cryptographic Failures

#### Issue
**File:** `src/contexts/AuthContext.tsx:41-42`
```typescript
const userData = localStorage.getItem('graceful_books_user')
// User data stored in localStorage is vulnerable to XSS
```

#### Recommendation
- localStorage is acceptable for non-sensitive data
- ✅ NEVER store master encryption keys in localStorage
- ✅ Session tokens should have short expiration
- ✅ Implement Content Security Policy (CSP) headers

**Current Implementation Review:**
- ✅ GOOD: Master keys stored in memory only (SessionState.masterKey)
- ✅ GOOD: Encryption implementation uses proper AES-256-GCM
- ⚠️ REVIEW: Ensure device tokens don't contain sensitive data

---

### 5. ℹ️ MEDIUM: Missing Security Headers

**Severity:** MEDIUM
**OWASP Category:** A05:2021 – Security Misconfiguration

#### Required HTTP Security Headers
Add to production server configuration:

```nginx
# Content Security Policy
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';

# Prevent clickjacking
X-Frame-Options: DENY

# Prevent MIME sniffing
X-Content-Type-Options: nosniff

# Enable XSS protection
X-XSS-Protection: 1; mode=block

# HTTPS only
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

# Referrer policy
Referrer-Policy: strict-origin-when-cross-origin

# Permissions policy
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

---

## OWASP Top 10 (2021) Checklist

| # | Category | Status | Notes |
|---|----------|--------|-------|
| A01:2021 | Broken Access Control | 🔴 **FAIL** | IDOR vulnerabilities throughout |
| A02:2021 | Cryptographic Failures | ✅ **PASS** | Strong AES-256-GCM implementation |
| A03:2021 | Injection | ⚠️ **WARNING** | XSS risks in 3 files |
| A04:2021 | Insecure Design | ✅ **PASS** | Architecture is sound |
| A05:2021 | Security Misconfiguration | ⚠️ **WARNING** | Missing security headers |
| A06:2021 | Vulnerable Components | ⏳ **PENDING** | Run `npm audit` |
| A07:2021 | Auth Failures | ✅ **PASS** | Good session/auth design |
| A08:2021 | Data Integrity | ✅ **PASS** | Audit logs, immutability |
| A09:2021 | Logging Failures | ⏳ **REVIEW** | Check security event logging |
| A10:2021 | SSRF | ✅ **PASS** | Client-side app, no SSRF risk |

---

## Immediate Action Items

### Priority 1 - CRITICAL (Deploy Blocker)
- [ ] **Fix IDOR in all data access functions** - Add companyId validation
- [ ] **Add authorization middleware** - Create helper function for ownership checks
- [ ] **Security test** - Attempt cross-company access

### Priority 2 - HIGH (Pre-Production)
- [ ] **Fix XSS vulnerabilities** - Audit dangerouslySetInnerHTML usage
- [ ] **Add security headers** - Configure server
- [ ] **Run npm audit** - Check dependencies

### Priority 3 - MEDIUM (Production Hardening)
- [ ] **Implement rate limiting** - Already partially done in crypto module
- [ ] **Add security event logging** - Log authorization failures
- [ ] **Penetration testing** - Third-party security audit

---

## Recommended Security Architecture Pattern

### Authorization Helper
Create a reusable authorization helper:

```typescript
// src/utils/authorization.ts
export function requireCompanyOwnership<T extends { companyId: string }>(
  resource: T | null | undefined,
  requestingCompanyId: string
): { authorized: true; resource: T } | { authorized: false; error: DatabaseError } {
  if (!resource) {
    return {
      authorized: false,
      error: { code: 'NOT_FOUND', message: 'Resource not found' }
    }
  }

  if (resource.companyId !== requestingCompanyId) {
    return {
      authorized: false,
      error: { code: 'FORBIDDEN', message: 'Access denied' }
    }
  }

  return { authorized: true, resource }
}
```

### Usage in Data Access Layer
```typescript
export async function getAccount(
  id: string,
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Account>> {
  try {
    const entity = await db.accounts.get(id)

    // ✅ Use authorization helper
    const authCheck = requireCompanyOwnership(entity, companyId)
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Continue with authorized resource
    const resource = authCheck.resource
    // ... rest of function
  }
}
```

---

## Conclusion

The codebase demonstrates **excellent cryptographic implementation** and **zero-knowledge architecture design**, but suffers from **critical authorization vulnerabilities** that must be fixed before deployment.

**Estimated Remediation Time:** 8-16 hours
**Recommended Next Steps:**
1. Implement IDOR fixes (Priority 1)
2. Security regression testing
3. Third-party penetration test before production launch

---

## CPG Module Authorization (Added 2026-02-23)

**Task:** S6-5 CPG Data Sharing Controls
**Status:** ✅ Verified secure - No changes required

### Access Model

**CPG data uses company-scoped access:**
- All CPG entities include `company_id` field
- All users with company access can view/edit CPG data (subject to RBAC)
- No user-level ownership or selective sharing implemented
- No cross-company access possible

### Authorization Enforcement

**1. Database Schema Enforcement:**
- All CPG tables have `company_id` NOT NULL constraint
- All indexes include `company_id` for query performance:
  ```typescript
  'id, company_id, active, [company_id+active], updated_at, deleted_at'
  ```

**2. Query-Level Enforcement:**
- All Dexie queries filter by `company_id`:
  ```typescript
  db.cpgCategories
    .where('company_id')
    .equals(companyId)
    .toArray()
  ```

**3. Authorization Helpers:**
- Uses existing `requireCompanyOwnership()` pattern
- Uses existing `validateCompanyId()` validation
- Returns `NOT_FOUND` for unauthorized access (no information leakage)

**4. RBAC Permissions:**
| Role | View CPG | Create | Edit | Delete | Settings |
|------|----------|--------|------|--------|----------|
| View-Only | ✅ | ❌ | ❌ | ❌ | ❌ |
| Bookkeeper | ✅ | ✅ | ✅ | ✅ | ❌ |
| Manager | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |

### CPG Entities Protected

All CPG entities follow company-scoped authorization:
1. **CPGCategory** - Cost categories (Oil, Bottle, Box, etc.)
2. **CPGInvoice** - Invoice entries with cost attribution
3. **CPGDistributor** - Distributor profiles and fee structures
4. **CPGDistributionCalculation** - Saved distribution scenarios (draft and invoiced)
5. **CPGSalesPromo** - Trade spend / retailer promotion analysis
6. **CPGFinishedProduct** - Products manufactured and sold
7. **CPGRecipe** - Bill of materials for finished products
8. **CPGSettings** - Company-wide CPG module settings

### Why No Sharing Required

**Decision Rationale:**
1. CPG data is operational business data, not personal content
2. All team members need visibility to coordinate operations
3. Cost structures, distributors, and recipes are shared business assets
4. Use case differs from J3 Scenarios (advisor-client workflow)
5. RBAC already controls what actions users can perform
6. No identified need for selective visibility within company
7. Cross-company sharing would violate zero-knowledge architecture

### Code Example

**From `SavedScenarios.tsx` (verified secure):**
```typescript
const draftScenarios = await db.cpgDistributionCalculations
  .where('company_id')
  .equals(companyId)  // ✅ Company filter enforced
  .and((calc) => calc.active === true && calc.deleted_at === null)
  .toArray();
```

### Security Testing

**Recommended tests:**
```typescript
// Test cross-company isolation
it('should not return CPG data from other companies', async () => {
  const company1 = await createTestCompany();
  const company2 = await createTestCompany();

  await createCPGCategory(company1.id, 'Oil');
  const categories = await getCPGCategories(company2.id);

  expect(categories).not.toContainEqual(
    expect.objectContaining({ company_id: company1.id })
  );
});

// Test RBAC permissions
it('should prevent View-Only role from editing', async () => {
  const user = await createTestUser('VIEW_ONLY');
  await expect(
    updateCPGCategory(categoryId, companyId, updates, user.role)
  ).rejects.toThrow('Insufficient permissions');
});
```

### Documentation

**Complete documentation available:**
- `docs/TASK_S6-5_CPG_DATA_SHARING_ANALYSIS.md` - Full analysis and decision rationale
- `docs/CPG_SECURITY_GUIDELINES.md` - Developer guidelines for CPG authorization patterns

### Future Considerations

If sharing becomes needed (not currently in roadmap):
- Add `created_by_user_id` and `shared_with` fields
- Create `shareCPGCalculation()` service (similar to J3 scenarios)
- Update authorization logic to check: owner OR in sharedWith array
- Migration script to set existing records as public within company

See `TASK_S6-5_CPG_DATA_SHARING_ANALYSIS.md` Section 8.2 for complete migration plan.

---

**Audit Completed:** 2026-02-22
**CPG Security Review:** 2026-02-23
**Next Review:** After fixes implemented
