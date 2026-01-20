# Test Failures Analysis

Based on partial test run output (before performance tests timed out):

## Critical Failures (Blocking CI)

### 1. auditLogExtended.test.ts - 32 FAILED tests
**Error:** `KeyPath company_id on object store auditLogs is not indexed`
**Error:** `KeyPath [company_id+timestamp] on object store auditLogs is not indexed`

**Root Cause:** Database schema missing compound indexes for audit logs
- Missing index: `company_id`
- Missing compound index: `[company_id+timestamp]`

**Impact:** All audit log extended features failing (search, timeline, export, statistics)

**Files to fix:**
- `src/store/database.ts` (add missing indexes to auditLogs table)

---

### 2. emailRenderer.test.ts - 4 FAILED tests
**Error:** `expected '<!DOCTYPE html>...' to contain 'Hi Test User, here\'s what\'s on deck...'`

**Root Cause:** Email greeting not being rendered

**Failed tests:**
- should render greeting
- should handle empty sections array
- should use underlines for section headers (plain text)
- should include complete email HTML (preview)

**Files to fix:**
- `src/services/email/emailRenderer.ts` (greeting rendering logic)

---

### 3. emailPreferences.test.ts - 8 FAILED tests
**Errors:**
- `expected false to be true`
- `expected 'monday' to be 'friday'`
- `promise resolved instead of rejecting`
- `expected null not to be null`

**Failed tests:**
- getOrCreateEmailPreferences - should create default preferences
- updateEmailPreferences - should update successfully
- updateEmailPreferences - should validate before update
- unsubscribeFromEmails - 3 tests failing
- isUserUnsubscribed - 2 tests failing

**Root Cause:** Email preferences store logic issues

**Files to fix:**
- `src/store/emailPreferences.ts` (update/unsubscribe logic)

---

### 4. categorization.test.ts - 5 FAILED tests
**Errors:**
- `expected 0 to be greater than 0`
- `KeyPath name on object store categories is not indexed`
- `expected [] to have a length of 2 but got +0`
- `expected +0 to be 5`

**Failed tests:**
- System Rules Initialization - should map system rules to correct categories
- System Rules Initialization - should handle missing category names gracefully
- Training Data Management - 3 tests failing

**Root Cause:**
1. Missing index on categories table (`name` field)
2. Training data not being persisted

**Files to fix:**
- `src/store/database.ts` (add index to categories table)
- `src/store/categorization.ts` (training data logic)

---

### 5. VendorForm.test.tsx - 1 FAILED test
**Error:** `expected "spy" to be called at least once`

**Failed test:**
- Edit Mode - should update vendor data on submit

**Root Cause:** onSubmit callback not being called (form validation blocking?)

**Files to fix:**
- `src/components/vendors/VendorForm.tsx` (submit handling)

---

### 6. invoiceTemplates.test.ts - 2 FAILED tests
**Errors:**
- `expected [ { …(25) }, { …(25) } ] to have a length of 1 but got 2`
- `expected 'Classic Professional' to be 'Default Template'`

**Failed tests:**
- getCompanyTemplates - should filter out inactive templates by default
- getDefaultTemplate - should retrieve default template

**Root Cause:** Template filtering and default template selection logic

**Files to fix:**
- `src/store/invoiceTemplates.ts` (filtering and default selection)

---

### 7. VendorCard.test.tsx - 2 FAILED tests
**Error:** `Expected the element to have class: "inactive" / Received: "_vendorCard_39a0c1 _inactive_39a0c1"`

**Failed tests:**
- Visual Variants - should apply inactive class for inactive vendors
- Visual Variants - should apply clickable class when onClick is provided

**Root Cause:** Test expecting global class names but component uses CSS modules (scoped names)

**Files to fix:**
- `src/components/vendors/VendorCard.test.tsx` (update class name assertions to handle CSS modules)

---

## Summary Statistics (Partial - Performance tests excluded)

- **Total Failed:** ~57 tests
- **Critical Blocking:** IndexedDB schema (33 failures across audit + categorization)
- **Business Logic:** ~24 failures (email, preferences, templates, forms)

## Priority Order for Fixes

1. **Database schema indexes** (fixes 33 tests immediately)
   - Add `company_id` index to auditLogs
   - Add `[company_id+timestamp]` compound index to auditLogs
   - Add `name` index to categories

2. **Email renderer greeting** (fixes 4 tests)

3. **Email preferences logic** (fixes 8 tests)

4. **Categorization training data** (fixes 3 tests)

5. **Invoice templates filtering** (fixes 2 tests)

6. **Vendor form submit** (fixes 1 test)

7. **Vendor card CSS module tests** (fixes 2 tests)
