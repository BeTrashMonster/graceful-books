# Manual Penetration Testing Guide - Cross-Company Data Isolation

**Version:** 1.0
**Created:** 2026-02-22
**Purpose:** Manual security testing to verify IDOR prevention and company data isolation
**Status:** Ready for execution

---

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Test Environment Setup](#test-environment-setup)
4. [Test Scenarios](#test-scenarios)
   - [Scenario 1: Cross-Company UI Data Access](#scenario-1-cross-company-ui-data-access)
   - [Scenario 2: Browser DevTools API Manipulation](#scenario-2-browser-devtools-api-manipulation)
   - [Scenario 3: Resource ID Guessing/Brute-Force](#scenario-3-resource-id-guessingbrute-force)
   - [Scenario 4: Comprehensive CRUD Operations Test](#scenario-4-comprehensive-crud-operations-test)
   - [Scenario 5: Batch Operations Data Export](#scenario-5-batch-operations-data-export)
5. [Expected Results](#expected-results)
6. [Results Template](#results-template)
7. [Sign-off Section](#sign-off-section)

---

## Introduction

### Purpose

This guide provides step-by-step instructions for manually testing the security isolation between companies in the Graceful Books application. The primary goal is to verify that **Insecure Direct Object Reference (IDOR) vulnerabilities** have been properly mitigated and that users cannot access data belonging to other companies.

### Scope

This penetration test covers:

- **In-scope:**
  - Cross-company data access attempts via UI
  - API request manipulation using browser developer tools
  - Resource ID guessing and brute-force attempts
  - All CRUD operations (Create, Read, Update, Delete) across all entity types
  - Batch query operations and data export functionality
  - CPG (Consumer Packaged Goods) module data isolation

- **Out-of-scope:**
  - Network-level attacks (DDoS, packet sniffing)
  - Server-side infrastructure vulnerabilities
  - Social engineering attacks
  - Password cracking or authentication bypass
  - XSS, CSRF, or injection attacks (covered separately)

### Security Context

The application implements a **zero-knowledge, local-first architecture** where:
- Each company's data is isolated by `companyId` or `company_id` fields
- Authorization checks use `requireCompanyOwnership()` and `validateCompanyId()` utilities
- Unauthorized access returns `NOT_FOUND` errors (not `FORBIDDEN`) to prevent information leakage
- All data access functions require `companyId` as a mandatory parameter

### Risk Assessment

**Risk Level:** CRITICAL
**OWASP Reference:** A01:2021 - Broken Access Control
**Impact if vulnerabilities found:** Complete data breach, competitor access to financial records

---

## Prerequisites

### Technical Requirements

- **Browser:** Chrome, Firefox, or Edge (with developer tools)
- **Access Level:** Two separate user accounts with different companies
- **Environment:** Staging or test environment (NOT production)
- **Tools:**
  - Browser Developer Tools (F12)
  - Text editor for documenting findings
  - Screenshot tool for evidence

### Skills Required

- Basic understanding of HTTP requests/responses
- Familiarity with browser developer tools
- Ability to inspect and modify network requests
- Basic understanding of RESTful APIs and JSON

### Time Estimate

- **Setup:** 30 minutes
- **Test Execution:** 2-3 hours
- **Documentation:** 1 hour
- **Total:** 3.5-4.5 hours

---

## Test Environment Setup

### Step 1: Create Two Test Companies

**Company A (Primary Test Company):**

1. Register a new user account
2. Complete onboarding
3. Create the following test data:
   - **Accounts:** 3 accounts (Asset, Liability, Revenue)
   - **Transactions:** 2 transactions (Draft and Posted)
   - **Contacts:** 2 contacts (1 Customer, 1 Vendor)
   - **Products:** 2 products (1 Product, 1 Service)
   - **Invoices:** 2 invoices (1 Draft, 1 Sent)
   - **CPG Data:**
     - 1 CPG Category (e.g., "Oil")
     - 1 CPG Distributor
     - 1 CPG Invoice
     - 1 CPG Distribution Calculation
     - 1 CPG Sales Promo

4. **Record all entity IDs** in a spreadsheet:
   ```
   Entity Type         | Entity ID              | Name/Description
   -------------------|------------------------|------------------
   Account            | acc_xyz123             | Cash Account
   Transaction        | txn_abc456             | Office Supplies
   Contact (Customer) | cnt_def789             | Acme Corp
   Product            | prd_ghi012             | Widget
   Invoice            | inv_jkl345             | INV-001
   CPG Category       | cpg_cat_mno678         | Oil
   CPG Distributor    | cpg_dist_pqr901        | ABC Distribution
   ...
   ```

**Company B (Unauthorized Access Target):**

1. Register a **different user account** (different email)
2. Complete onboarding
3. Create similar test data (3 accounts, 2 transactions, etc.)
4. **Record all entity IDs** for Company B as well

### Step 2: Identify Company IDs

**For Company A:**

1. Log in as Company A user
2. Open browser DevTools (F12) → Console
3. Execute:
   ```javascript
   // Check localStorage or sessionStorage
   console.log(localStorage)
   console.log(sessionStorage)

   // Or inspect IndexedDB
   // Look for user object with companyId field
   ```
4. Record Company A's `companyId`: `_____________________`

**For Company B:**

1. Repeat above steps logged in as Company B
2. Record Company B's `companyId`: `_____________________`

### Step 3: Verify Network Request Format

1. Log in as Company A
2. Open DevTools → Network tab
3. Perform an action (e.g., view an account)
4. Inspect the network request to understand the API structure:
   - Request method (GET, POST, PUT, DELETE)
   - Request URL format
   - Request headers
   - Request payload structure
   - Response format

**Example Network Request:**
```
Method: GET
URL: /api/accounts/acc_xyz123?companyId=comp_abc123
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json
```

---

## Test Scenarios

### Scenario 1: Cross-Company UI Data Access

**Objective:** Verify that users cannot access other companies' data through normal UI navigation.

**Prerequisites:** Logged in as Company A user.

#### Test 1.1: Direct URL Manipulation - Accounts

1. While logged in as **Company A**, navigate to one of Company A's accounts
2. Note the URL pattern (e.g., `/accounts/acc_xyz123`)
3. **Manually change the URL** to Company B's account ID
   - Example: Change `/accounts/acc_xyz123` to `/accounts/acc_COMPANY_B_ID`
4. Press Enter to load the page

**Expected Result:**
- Page should show "Not Found" or "Account not found" error
- Should NOT display Company B's account details
- Should NOT reveal whether the account exists

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 1.2: Direct URL Manipulation - Transactions

1. Navigate to a Company A transaction
2. Note the URL (e.g., `/transactions/txn_abc456`)
3. Change the transaction ID to a **Company B transaction ID**
4. Attempt to load the page

**Expected Result:**
- "Not Found" error
- No transaction details displayed

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 1.3: Direct URL Manipulation - Contacts

Repeat the above process for:
- Customer contact from Company B
- Vendor contact from Company B

**Expected Result:** NOT_FOUND for both

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 1.4: Direct URL Manipulation - Products

Test with Company B's product ID

**Expected Result:** NOT_FOUND

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 1.5: Direct URL Manipulation - Invoices

Test with Company B's invoice ID

**Expected Result:** NOT_FOUND

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 1.6: Direct URL Manipulation - CPG Data

Test with Company B's CPG entity IDs:
- CPG Category
- CPG Distributor
- CPG Invoice
- CPG Distribution Calculation
- CPG Sales Promo

**Expected Result:** NOT_FOUND for all

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

---

### Scenario 2: Browser DevTools API Manipulation

**Objective:** Verify that direct API calls cannot bypass authorization checks.

**Prerequisites:**
- Logged in as Company A user
- Browser DevTools open (F12)
- Network tab active

#### Test 2.1: Inspect GET Request - Read Operation

1. While logged in as Company A, view one of Company A's accounts
2. In DevTools → Network tab, find the GET request for the account
3. Right-click the request → "Copy as fetch" (or "Copy as cURL")
4. Open DevTools → Console tab
5. Paste the fetch request
6. **Modify the account ID** in the fetch request to a Company B account ID
7. Execute the modified request

**Example Modified Fetch:**
```javascript
fetch('/api/accounts/acc_COMPANY_B_ID?companyId=comp_abc123', {
  headers: {
    'Authorization': 'Bearer <your_token>',
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log(data))
```

**Expected Result:**
- Response: `{ success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } }`
- Should NOT return Company B's account data

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 2.2: Modify companyId Parameter in Request

1. Copy a legitimate GET request for Company A's account
2. In the fetch request, **change the `companyId` parameter** to Company B's ID
3. Keep the account ID as Company B's account
4. Execute the request

**Example:**
```javascript
fetch('/api/accounts/acc_COMPANY_B_ID?companyId=comp_COMPANY_B_ID', {
  headers: {
    'Authorization': 'Bearer <Company_A_token>',
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log(data))
```

**Expected Result:**
- Request should fail with NOT_FOUND or UNAUTHORIZED
- Company A's token should not authorize access to Company B's data

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 2.3: Intercept and Modify PUT Request - Update Operation

1. In Company A account, initiate an update (e.g., change account name)
2. In DevTools → Network tab, find the PUT/PATCH request
3. Right-click → "Copy as fetch"
4. In Console, paste and modify the request:
   - Change the target account ID to Company B's account ID
   - Keep Company A's authentication token
5. Execute the modified request

**Expected Result:**
- Response: `{ success: false, error: { code: 'NOT_FOUND' } }`
- Company B's account should remain unchanged

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 2.4: Intercept and Modify DELETE Request - Delete Operation

1. Attempt to delete a Company A account (or use a test account)
2. Intercept the DELETE request in DevTools
3. Copy as fetch and modify the account ID to Company B's account
4. Execute the modified request

**Expected Result:**
- Response: NOT_FOUND error
- Company B's account should NOT be deleted

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 2.5: Modify POST Request - Create Operation with Wrong companyId

1. Create a new account in Company A
2. Intercept the POST request in DevTools
3. Copy and modify the request payload:
   - Change `companyId` field to Company B's ID
   - Keep Company A's authentication token
4. Execute the modified request

**Expected Result:**
- Request should fail with VALIDATION_ERROR or UNAUTHORIZED
- Account should NOT be created in Company B's data
- If account is created, it should belong to Company A (server-enforced)

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 2.6: API Manipulation for Other Entity Types

Repeat Tests 2.1-2.5 for:
- **Transactions** (GET, PUT, DELETE, POST)
- **Contacts** (GET, PUT, DELETE, POST)
- **Products** (GET, PUT, DELETE, POST)
- **Invoices** (GET, PUT, DELETE, POST)
- **CPG Distributors** (GET, PUT, DELETE, POST)

**Expected Result:** All operations should return NOT_FOUND or fail authorization

**Actual Results:**
- Transactions: ___________________________________________________
- Contacts: _______________________________________________________
- Products: _______________________________________________________
- Invoices: _______________________________________________________
- CPG Distributors: ________________________________________________

**Pass/Fail:** ________

---

### Scenario 3: Resource ID Guessing/Brute-Force

**Objective:** Verify that guessing or brute-forcing resource IDs does not reveal other companies' data.

**Prerequisites:** Logged in as Company A user.

#### Test 3.1: Sequential ID Guessing

1. Identify the ID format used by the application
   - Example: `acc_xyz123` (prefix + random string)
   - Or: `550e8400-e29b-41d4-a716-446655440000` (UUID format)

2. Attempt to access resources with **sequential or predictable IDs**:
   - If using incremental IDs: Try `acc_000001`, `acc_000002`, etc.
   - If using UUIDs: Try common/default UUIDs

3. Create a simple script in DevTools console:
```javascript
// Example brute-force script (use responsibly in test environment only!)
const testIds = [
  'acc_000001',
  'acc_000002',
  'acc_000003',
  'acc_test123',
  'acc_admin',
  // Add Company B's known IDs
];

for (const id of testIds) {
  fetch(`/api/accounts/${id}?companyId=comp_abc123`, {
    headers: {
      'Authorization': 'Bearer <your_token>',
      'Content-Type': 'application/json'
    }
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      console.log(`SECURITY ISSUE: Accessed account ${id}`, data);
    } else {
      console.log(`${id}: ${data.error.code}`);
    }
  });
}
```

**Expected Result:**
- All requests should return NOT_FOUND
- No successful unauthorized access
- Rate limiting may kick in (acceptable)

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 3.2: ID Format Manipulation

1. Take a known Company B account ID (e.g., `acc_company_b_123`)
2. Try variations:
   - Change capitalization: `ACC_company_b_123`
   - Add/remove characters: `acc_company_b_12`, `acc_company_b_1234`
   - URL encoding: `acc_company%5Fb%5F123`
   - SQL injection attempts: `acc_123' OR '1'='1`

**Expected Result:**
- All variations should return NOT_FOUND or VALIDATION_ERROR
- No successful unauthorized access

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 3.3: Null Byte Injection

Attempt to bypass authorization with null bytes:

```javascript
fetch(`/api/accounts/acc_COMPANY_B_ID%00?companyId=comp_abc123`, {
  headers: {
    'Authorization': 'Bearer <your_token>',
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log(data))
```

**Expected Result:** NOT_FOUND or VALIDATION_ERROR

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

---

### Scenario 4: Comprehensive CRUD Operations Test

**Objective:** Test all Create, Read, Update, Delete operations across all entity types to ensure comprehensive authorization.

**Prerequisites:** Logged in as Company A user with Company B's entity IDs recorded.

#### Test 4.1: Accounts - Full CRUD

| Operation | Test Description | Expected Result | Actual Result | Pass/Fail |
|-----------|------------------|-----------------|---------------|-----------|
| **Create** | Create account with Company B's companyId in payload | VALIDATION_ERROR or created under Company A | | |
| **Read** | GET Company B's account | NOT_FOUND | | |
| **Update** | PUT/PATCH Company B's account | NOT_FOUND | | |
| **Delete** | DELETE Company B's account | NOT_FOUND | | |
| **List** | Query accounts with Company B's companyId | Empty array or VALIDATION_ERROR | | |

#### Test 4.2: Transactions - Full CRUD

| Operation | Test Description | Expected Result | Actual Result | Pass/Fail |
|-----------|------------------|-----------------|---------------|-----------|
| **Create** | Create transaction with Company B's companyId | VALIDATION_ERROR or created under Company A | | |
| **Read** | GET Company B's transaction | NOT_FOUND | | |
| **Update** | PUT Company B's transaction | NOT_FOUND | | |
| **Delete** | DELETE Company B's transaction | NOT_FOUND | | |
| **Post** | POST (finalize) Company B's draft transaction | NOT_FOUND | | |
| **Void** | VOID Company B's posted transaction | NOT_FOUND | | |

#### Test 4.3: Contacts - Full CRUD

| Operation | Test Description | Expected Result | Actual Result | Pass/Fail |
|-----------|------------------|-----------------|---------------|-----------|
| **Create** | Create contact with Company B's companyId | VALIDATION_ERROR or created under Company A | | |
| **Read** | GET Company B's customer | NOT_FOUND | | |
| **Read** | GET Company B's vendor | NOT_FOUND | | |
| **Update** | PUT Company B's contact | NOT_FOUND | | |
| **Delete** | DELETE Company B's contact | NOT_FOUND | | |

#### Test 4.4: Products - Full CRUD

| Operation | Test Description | Expected Result | Actual Result | Pass/Fail |
|-----------|------------------|-----------------|---------------|-----------|
| **Create** | Create product with Company B's companyId | VALIDATION_ERROR or created under Company A | | |
| **Read** | GET Company B's product | NOT_FOUND | | |
| **Update** | PUT Company B's product | NOT_FOUND | | |
| **Delete** | DELETE Company B's product | NOT_FOUND | | |

#### Test 4.5: Invoices - Full CRUD + Status Transitions

| Operation | Test Description | Expected Result | Actual Result | Pass/Fail |
|-----------|------------------|-----------------|---------------|-----------|
| **Create** | Create invoice with Company B's companyId | VALIDATION_ERROR or created under Company A | | |
| **Read** | GET Company B's invoice | NOT_FOUND | | |
| **Update** | PUT Company B's invoice | NOT_FOUND | | |
| **Delete** | DELETE Company B's invoice | NOT_FOUND | | |
| **Send** | Send Company B's invoice to customer | NOT_FOUND | | |
| **Mark Paid** | Mark Company B's invoice as paid | NOT_FOUND | | |
| **Void** | Void Company B's invoice | NOT_FOUND | | |
| **Get Line Items** | Get Company B's invoice line items | NOT_FOUND or empty array | | |

#### Test 4.6: CPG Categories - Full CRUD

| Operation | Test Description | Expected Result | Actual Result | Pass/Fail |
|-----------|------------------|-----------------|---------------|-----------|
| **Create** | Create CPG category with Company B's companyId | VALIDATION_ERROR or created under Company A | | |
| **Read** | GET Company B's CPG category | NOT_FOUND | | |
| **Update** | PUT Company B's CPG category | NOT_FOUND | | |
| **Delete** | DELETE Company B's CPG category | NOT_FOUND | | |

#### Test 4.7: CPG Distributors - Full CRUD

| Operation | Test Description | Expected Result | Actual Result | Pass/Fail |
|-----------|------------------|-----------------|---------------|-----------|
| **Create** | Create distributor with Company B's companyId | VALIDATION_ERROR or created under Company A | | |
| **Read** | GET Company B's distributor | NOT_FOUND | | |
| **Update** | PUT Company B's distributor (fee structure) | NOT_FOUND | | |
| **Delete** | DELETE Company B's distributor | NOT_FOUND | | |

#### Test 4.8: CPG Distribution Calculations - Full CRUD

| Operation | Test Description | Expected Result | Actual Result | Pass/Fail |
|-----------|------------------|-----------------|---------------|-----------|
| **Create** | Create calculation with Company B's distributor | VALIDATION_ERROR or NOT_FOUND | | |
| **Read** | GET Company B's distribution calculation | NOT_FOUND | | |
| **Update** | PUT Company B's calculation | NOT_FOUND | | |
| **Delete** | DELETE Company B's calculation | NOT_FOUND | | |

#### Test 4.9: CPG Sales Promos - Full CRUD

| Operation | Test Description | Expected Result | Actual Result | Pass/Fail |
|-----------|------------------|-----------------|---------------|-----------|
| **Create** | Create promo with Company B's companyId | VALIDATION_ERROR or created under Company A | | |
| **Read** | GET Company B's sales promo | NOT_FOUND | | |
| **Update** | PUT Company B's promo (status change) | NOT_FOUND | | |
| **Delete** | DELETE Company B's promo | NOT_FOUND | | |

---

### Scenario 5: Batch Operations Data Export

**Objective:** Verify that batch query operations and data export functionality cannot access other companies' data.

**Prerequisites:** Logged in as Company A user.

#### Test 5.1: Batch Query - Accounts

1. Open DevTools → Console
2. Execute a batch query for accounts with Company B's companyId:

```javascript
fetch('/api/accounts?companyId=comp_COMPANY_B_ID', {
  headers: {
    'Authorization': 'Bearer <Company_A_token>',
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log(data))
```

**Expected Result:**
- Empty array: `{ success: true, data: [] }`
- Or VALIDATION_ERROR if companyId mismatch detected

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 5.2: Batch Query - Transactions

Test the following batch queries with Company B's companyId:
- Get all transactions
- Get transactions for a specific account (Company B's account)
- Get transactions within a date range

**Expected Result:** Empty results or VALIDATION_ERROR for all

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 5.3: Batch Query - Contacts

Test batch queries:
- Get all customers (with Company B's companyId)
- Get all vendors (with Company B's companyId)
- Get 1099 vendors (with Company B's companyId)

**Expected Result:** Empty results for all

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 5.4: Batch Query - Products/Services

Test batch queries:
- Get all products (with Company B's companyId)
- Get all services (with Company B's companyId)
- Query products with filter (with Company B's companyId)

**Expected Result:** Empty results for all

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 5.5: Batch Query - Invoices

Test batch queries:
- Get all invoices (with Company B's companyId)
- Get customer invoices (with Company B's customer ID and companyId)
- Get invoices by status (with Company B's companyId)

**Expected Result:** Empty results for all

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 5.6: Data Export Attempt

1. Navigate to any data export functionality (e.g., "Export to CSV")
2. Open DevTools → Network tab
3. Initiate an export
4. Intercept the export request
5. Copy as fetch and modify the companyId to Company B's ID
6. Execute the modified request

**Expected Result:**
- Export file should be empty or contain only Company A's data
- Should NOT include Company B's data

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 5.7: Batch Query - Account Hierarchy

Test fetching the account hierarchy with Company B's companyId:

```javascript
fetch('/api/accounts/hierarchy?companyId=comp_COMPANY_B_ID', {
  headers: {
    'Authorization': 'Bearer <Company_A_token>',
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log(data))
```

**Expected Result:** Empty hierarchy or VALIDATION_ERROR

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

#### Test 5.8: CPG Batch Queries

Test CPG batch operations:
- Get all CPG categories for Company B
- Get all distributors for Company B
- Get all distribution calculations for Company B
- Get all sales promos for Company B

**Expected Result:** Empty results for all

**Actual Result:** ___________________________________________________

**Pass/Fail:** ________

---

## Expected Results

### Overall Security Posture

If the IDOR fixes have been properly implemented, **ALL tests should result in FAILURES to access unauthorized data**. Specifically:

### Success Criteria (What Should Happen)

1. **NOT_FOUND Errors:**
   - Any attempt to access another company's resource returns: `{ success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } }`
   - This applies to GET, PUT, DELETE operations

2. **VALIDATION_ERROR:**
   - Attempts to create resources with another company's companyId should fail with VALIDATION_ERROR
   - Or resources should be created under the authenticated user's company (server-enforced companyId)

3. **Empty Results:**
   - Batch queries with another company's companyId should return empty arrays: `{ success: true, data: [] }`
   - Or VALIDATION_ERROR if companyId parameter validation is enforced

4. **No Information Leakage:**
   - Error messages should NOT reveal whether a resource exists
   - Always return NOT_FOUND, never "You don't have permission to access this account"
   - This prevents attackers from enumerating valid resource IDs

5. **Consistent Behavior:**
   - All entity types (Accounts, Transactions, Contacts, Products, Invoices, CPG data) should have identical authorization behavior
   - No entity type should have weaker authorization than others

### Failure Criteria (What Should NOT Happen)

1. **Data Leakage:**
   - Company A user should NEVER see Company B's data
   - No partial data exposure (e.g., metadata without content)

2. **Successful Unauthorized Modifications:**
   - Company A user should NEVER be able to update/delete Company B's resources
   - Any successful modification is a CRITICAL security vulnerability

3. **Information Disclosure:**
   - Error messages should NOT differentiate between "resource doesn't exist" and "you don't have access"
   - Different error codes for owned vs. non-owned resources can leak information

4. **Bypass via Parameter Manipulation:**
   - Changing companyId parameters should NOT grant access to other companies' data
   - Server must enforce authorization based on authenticated user, not request parameters

---

## Results Template

### Test Execution Summary

**Test Date:** ___________________
**Tester Name:** ___________________
**Environment:** ☐ Staging ☐ Test ☐ Other: _______________
**Application Version/Commit:** ___________________

### Test Results Overview

| Scenario | Total Tests | Passed | Failed | Critical Issues Found |
|----------|-------------|--------|--------|-----------------------|
| Scenario 1: UI Data Access | 6 | | | |
| Scenario 2: API Manipulation | 6+ | | | |
| Scenario 3: ID Guessing | 3 | | | |
| Scenario 4: CRUD Operations | 50+ | | | |
| Scenario 5: Batch Operations | 8 | | | |
| **TOTAL** | **70+** | | | |

**Overall Status:** ☐ PASS ☐ FAIL

### Critical Findings

If any tests failed (i.e., unauthorized access was successful), document here:

#### Finding #1
- **Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low
- **Test Scenario:** _____________________________________________
- **Entity Type:** _______________________________________________
- **Description:** _______________________________________________
  _____________________________________________________________
- **Steps to Reproduce:**
  1. ___________________________________________________________
  2. ___________________________________________________________
  3. ___________________________________________________________
- **Evidence (Screenshot/Request):** __________________________
- **Impact:** ____________________________________________________
- **Recommendation:** _____________________________________________

#### Finding #2
[Repeat template for each finding]

### Non-Critical Observations

Document any unusual behavior that doesn't constitute a security vulnerability:

1. ________________________________________________________________
2. ________________________________________________________________
3. ________________________________________________________________

### Recommendations

Based on the test results:

1. ☐ **PASS - READY FOR PRODUCTION**
   - All tests passed
   - No unauthorized access detected
   - Authorization checks working as expected

2. ☐ **FAIL - CRITICAL ISSUES FOUND**
   - [ ] Fix all critical findings
   - [ ] Retest after fixes
   - [ ] Block production deployment until resolved

3. ☐ **PASS WITH OBSERVATIONS**
   - All security tests passed
   - Minor improvements recommended (non-blocking)
   - [ ] Address observations in future sprint

---

## Sign-off Section

### Tester Certification

I certify that I have:
- [ ] Executed all test scenarios in this guide
- [ ] Documented all findings accurately
- [ ] Verified expected results against actual results
- [ ] Provided sufficient evidence for any failures
- [ ] Made honest recommendations based on test results

**Tester Name:** _________________________________
**Signature:** ___________________________________
**Date:** ________________________________________

### Security Review

Reviewed by:

**Security Lead Name:** __________________________
**Signature:** ___________________________________
**Date:** ________________________________________

**Decision:**
- ☐ Approved for production deployment
- ☐ Requires fixes before deployment
- ☐ Requires retest after fixes

**Comments:** _________________________________________________________
_____________________________________________________________________
_____________________________________________________________________

### Development Team Acknowledgment

Acknowledged by development team:

**Lead Developer Name:** __________________________
**Signature:** ___________________________________
**Date:** ________________________________________

**Remediation Plan (if applicable):**
- [ ] Issue #_____ created for Finding #1
- [ ] Issue #_____ created for Finding #2
- [ ] Target fix date: ____________
- [ ] Retest scheduled for: ____________

---

## Appendix A: Reference Information

### Authorization Utilities

The application uses the following authorization functions:

```typescript
// Single resource authorization
requireCompanyOwnership<T>(resource, requestingCompanyId): AuthorizationResult<T>

// Batch resource authorization
requireBatchCompanyOwnership<T>(resources, requestingCompanyId): AuthorizationResult<T[]>

// CompanyId validation
validateCompanyId(companyId): DatabaseError | undefined
```

### Error Codes

| Error Code | Meaning | When Used |
|------------|---------|-----------|
| `NOT_FOUND` | Resource not found | Unauthorized access attempts, missing resources |
| `VALIDATION_ERROR` | Input validation failed | Missing/invalid companyId parameter |
| `UNAUTHORIZED` | Authentication failed | Invalid or missing auth token |
| `FORBIDDEN` | **Should NOT be used** | Would leak information about resource existence |

### Entity Types and Fields

All entities use either `companyId` (camelCase) or `company_id` (snake_case):

- **Accounts:** `companyId`
- **Transactions:** `companyId`
- **Contacts:** `companyId`
- **Products:** `companyId`
- **Invoices:** `company_id` (snake_case - special case)
- **CPG Categories:** `company_id`
- **CPG Distributors:** `company_id`
- **CPG Invoices:** `company_id`
- **CPG Distribution Calculations:** `company_id`
- **CPG Sales Promos:** `company_id`

---

## Appendix B: Quick Reference Commands

### DevTools Console - Get Current User's CompanyId

```javascript
// Check localStorage
localStorage.getItem('user')

// Check sessionStorage
sessionStorage.getItem('user')

// Or if stored in a different format
console.log(JSON.parse(localStorage.getItem('user')))
```

### DevTools Console - Test API Endpoint

```javascript
// Replace placeholders with actual values
const entityType = 'accounts' // accounts, transactions, contacts, etc.
const entityId = 'acc_xyz123'
const companyId = 'comp_abc123'
const token = 'your_auth_token_here'

fetch(`/api/${entityType}/${entityId}?companyId=${companyId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err))
```

### DevTools Console - Batch Query Test

```javascript
const entityType = 'accounts'
const companyId = 'comp_COMPANY_B_ID' // Target company
const token = 'your_Company_A_token'

fetch(`/api/${entityType}?companyId=${companyId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log('Results:', data))
```

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-22 | Security Team | Initial version - comprehensive manual pen test guide |

---

**End of Manual Penetration Testing Guide**
