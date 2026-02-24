# Developer Security Guidelines

**Version:** 1.0
**Created:** 2026-02-23
**Purpose:** Comprehensive security guidelines for Graceful Books developers
**Status:** Active

---

## Table of Contents

1. [Introduction](#introduction)
2. [Security Principles](#security-principles)
3. [Authorization and Access Control](#authorization-and-access-control)
4. [Input Validation](#input-validation)
5. [XSS Prevention](#xss-prevention)
6. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
7. [Rate Limiting](#rate-limiting)
8. [Security Logging](#security-logging)
9. [Common Vulnerability Patterns to Avoid](#common-vulnerability-patterns-to-avoid)
10. [Code Review Security Checklist](#code-review-security-checklist)
11. [Testing Security Features](#testing-security-features)
12. [Additional Resources](#additional-resources)

---

## Introduction

Welcome to the Graceful Books security guidelines! This document is your friendly companion for building secure features that keep our users' financial data safe. We've designed these guidelines to be easy to follow, with plenty of examples to help you along the way.

### Why Security Matters

Graceful Books is a zero-knowledge accounting platform. Our users trust us with their most sensitive financial data. We take that trust seriously by ensuring that:

- **User data is protected:** All financial data is encrypted and access-controlled
- **Privacy is paramount:** Users have complete sovereignty over their data
- **Access is controlled:** Only authorized users can access their company's data
- **Actions are audited:** All security-relevant events are logged immutably

### How to Use This Guide

This guide provides:
- **Clear explanations** of security concepts
- **Copy-paste templates** for common security patterns
- **Real examples** from our codebase
- **Good vs bad code** comparisons
- **Step-by-step instructions** for implementing security features

Don't worry if you're new to security - we'll guide you through everything you need to know!

---

## Security Principles

### 1. Defense in Depth

We use multiple layers of security, so if one layer fails, others still protect user data.

**Layers:**
1. **Authorization checks** - Verify company ownership
2. **RBAC permissions** - Check role-based permissions
3. **Input validation** - Validate and sanitize all inputs
4. **Rate limiting** - Prevent abuse and DoS attacks
5. **Security logging** - Track security events for forensics

### 2. Fail Secure

When something goes wrong, we default to denying access rather than granting it.

**Example:**
```typescript
// WRONG - Fails open (grants access on error)
function checkPermission(user, resource) {
  try {
    return hasAccess(user, resource);
  } catch (error) {
    return true; // ❌ Grants access on error
  }
}

// RIGHT - Fails closed (denies access on error)
function checkPermission(user, resource) {
  try {
    return hasAccess(user, resource);
  } catch (error) {
    logger.error('Permission check failed', { error });
    return false; // ✅ Denies access on error
  }
}
```

### 3. Least Privilege

Users should only have access to what they need, nothing more.

**Implementation:**
- Use RBAC roles (OWNER, ADMIN, ACCOUNTANT, BOOKKEEPER, VIEWER)
- Check both company ownership AND role permissions
- Never bypass authorization checks "just to make it work"

### 4. Zero Trust

Never trust input from users or external sources. Always validate, sanitize, and verify.

**Golden Rule:** Treat all user input as potentially malicious.

---

## Authorization and Access Control

### The IDOR Problem

**IDOR (Insecure Direct Object Reference)** is when a user can access another company's data by changing an ID in a request.

**Example of IDOR vulnerability:**
```typescript
// ❌ WRONG - IDOR vulnerability
async function getAccount(accountId: string) {
  // No authorization check - any user can access any account!
  return await db.accounts.get(accountId);
}

// User A can access User B's data by guessing/discovering the ID
const account = await getAccount('account-belonging-to-company-B');
```

**Fixed version:**
```typescript
// ✅ RIGHT - IDOR prevented
async function getAccount(
  accountId: string,
  companyId: string,
  context: EncryptionContext
): Promise<DatabaseResult<Account>> {
  // Step 1: Validate companyId parameter
  const validationError = validateCompanyId(companyId);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Step 2: Fetch the account
  const entity = await db.accounts.get(accountId);

  // Step 3: Verify ownership
  const authCheck = requireCompanyOwnership(entity, companyId);
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error };
  }

  // Step 4: Use the authorized entity for all subsequent operations
  const account = fromAccountEntity(authCheck.resource);

  // Step 5: Decrypt and return
  const decrypted = await context.decrypt(account);
  return { success: true, data: decrypted };
}
```

### Authorization Helpers

We provide three helper functions in `src/utils/authorization.ts`:

#### 1. validateCompanyId()

**Use when:** Starting any function that accepts a companyId parameter.

**Purpose:** Ensures the companyId is not null, undefined, or empty.

```typescript
import { validateCompanyId } from '../utils/authorization';

async function myFunction(companyId: string) {
  // Always validate companyId first
  const validationError = validateCompanyId(companyId);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Now safe to use companyId
  // ...
}
```

#### 2. requireCompanyOwnership()

**Use when:** Verifying a single entity belongs to the requesting company.

**Purpose:** Prevents IDOR attacks by ensuring the resource's companyId matches the requester's companyId.

**Returns NOT_FOUND** instead of FORBIDDEN to prevent information leakage about other companies' data.

```typescript
import { requireCompanyOwnership } from '../utils/authorization';

async function getTransaction(
  transactionId: string,
  companyId: string,
  context: EncryptionContext
): Promise<DatabaseResult<Transaction>> {
  // Step 1: Validate companyId
  const validationError = validateCompanyId(companyId);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Step 2: Fetch entity
  const entity = await db.transactions.get(transactionId);

  // Step 3: Verify ownership
  const authCheck = requireCompanyOwnership(entity, companyId);
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error };
  }

  // Step 4: Use authCheck.resource (ownership verified)
  const transaction = fromTransactionEntity(authCheck.resource);

  // Continue with business logic...
  return { success: true, data: transaction };
}
```

#### 3. requireBatchCompanyOwnership()

**Use when:** Verifying multiple entities all belong to the requesting company.

**Purpose:** Prevents IDOR in batch operations.

```typescript
import { requireBatchCompanyOwnership } from '../utils/authorization';

async function batchUpdateAccounts(
  accountIds: string[],
  companyId: string,
  updates: Partial<Account>
): Promise<DatabaseResult<Account[]>> {
  // Step 1: Validate companyId
  const validationError = validateCompanyId(companyId);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Step 2: Fetch all entities
  const entities = await db.accounts.bulkGet(accountIds);

  // Step 3: Verify ALL belong to requesting company
  const authCheck = requireBatchCompanyOwnership(entities, companyId);
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error };
  }

  // Step 4: All entities authorized - safe to proceed
  const accounts = authCheck.resource.map(fromAccountEntity);

  // Apply updates...
  // ...
}
```

### Authorization Pattern - Step by Step

Follow this pattern for **ALL** data access functions:

```typescript
async function dataAccessFunction(
  resourceId: string,
  companyId: string,
  context: EncryptionContext
): Promise<DatabaseResult<Resource>> {
  // ═══════════════════════════════════════════════════════════
  // STEP 1: Validate companyId parameter
  // ═══════════════════════════════════════════════════════════
  const validationError = validateCompanyId(companyId);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Fetch the entity from database
  // ═══════════════════════════════════════════════════════════
  const entity = await db.resources.get(resourceId);

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Verify company ownership
  // ═══════════════════════════════════════════════════════════
  const authCheck = requireCompanyOwnership(entity, companyId);
  if (!authCheck.authorized) {
    // Returns NOT_FOUND to prevent information leakage
    return { success: false, error: authCheck.error };
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 4: Use authCheck.resource for all operations
  // ═══════════════════════════════════════════════════════════
  const resource = fromResourceEntity(authCheck.resource);

  // ═══════════════════════════════════════════════════════════
  // STEP 5: Decrypt if needed and return
  // ═══════════════════════════════════════════════════════════
  const decrypted = await context.decrypt(resource);
  return { success: true, data: decrypted };
}
```

### Query Functions Pattern

For query functions that return multiple results, **ALWAYS** filter by companyId as a required parameter (not optional):

```typescript
// ❌ WRONG - companyId is optional in filter
async function queryAccounts(filter?: AccountFilter) {
  let query = db.accounts.where('isActive').equals(true);

  if (filter?.companyId) {
    query = query.and(a => a.companyId === filter.companyId);
  }

  return await query.toArray(); // ❌ Can return all companies' data!
}

// ✅ RIGHT - companyId is required parameter
async function queryAccounts(
  companyId: string,
  filter?: Omit<AccountFilter, 'companyId'>
): Promise<DatabaseResult<Account[]>> {
  // Step 1: Validate companyId
  const validationError = validateCompanyId(companyId);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Step 2: Start query with companyId filter (REQUIRED)
  let query = db.accounts
    .where('companyId')
    .equals(companyId);

  // Step 3: Add additional filters
  if (filter?.isActive !== undefined) {
    query = query.and(a => a.isActive === filter.isActive);
  }

  // Step 4: Execute query (already filtered by companyId)
  const entities = await query.toArray();

  // Step 5: Convert and return
  const accounts = entities.map(fromAccountEntity);
  return { success: true, data: accounts };
}
```

### Real-World Example

Here's a complete example from `src/store/accounts.ts`:

```typescript
/**
 * Get an account by ID with authorization check
 *
 * File: src/store/accounts.ts (lines 120-155)
 */
export async function getAccount(
  id: string,
  companyId: string,
  context: EncryptionContext
): Promise<DatabaseResult<Account>> {
  try {
    // Authorization check - prevents IDOR
    const validationError = validateCompanyId(companyId);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const entity = await db.accounts.get(id);

    // Verify entity belongs to requesting company
    const authCheck = requireCompanyOwnership(entity, companyId);
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

    const account = fromAccountEntity(authCheck.resource);

    // Decrypt sensitive fields
    if (context.decryptionService) {
      const decryptedName = await context.decryptionService.decrypt(account.name);
      const decryptedBalance = await context.decryptionService.decrypt(
        account.balance.toString()
      );
      const decryptedDescription = account.description
        ? await context.decryptionService.decrypt(account.description)
        : null;

      return {
        success: true,
        data: {
          ...account,
          name: decryptedName,
          balance: parseFloat(decryptedBalance),
          description: decryptedDescription,
        },
      };
    }

    return { success: true, data: account };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve account',
        details: error,
      },
    };
  }
}
```

---

## Input Validation

### Why Validate Input?

User input can contain:
- **XSS payloads** (`<script>alert('xss')</script>`)
- **SQL injection** attempts (though IndexedDB prevents this)
- **Extremely large values** causing DoS
- **Invalid data types** causing crashes
- **Special characters** breaking business logic

### Validation with Zod

We use [Zod](https://zod.dev/) for runtime type validation. Zod provides:
- **Type-safe validation** - Errors caught at compile time
- **Clear error messages** - Easy to debug
- **Schema reuse** - DRY principle
- **DoS protection** - String length limits prevent abuse

All validation schemas are in `src/utils/validation.ts`.

### Validation Pattern

```typescript
import { validateAccountInput, type AccountInput } from '../utils/validation';

async function createAccount(data: unknown, companyId: string) {
  // ═══════════════════════════════════════════════════════════
  // STEP 1: Validate input with Zod
  // ═══════════════════════════════════════════════════════════
  const validationResult = validateAccountInput(data);

  if (!validationResult.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid account data',
        details: validationResult.error.errors,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Use validated data (type-safe)
  // ═══════════════════════════════════════════════════════════
  const accountData: AccountInput = validationResult.data;

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Additional business logic validation
  // ═══════════════════════════════════════════════════════════
  if (accountData.balance < 0 && accountData.type === 'ASSET') {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Asset accounts cannot have negative balances',
      },
    };
  }

  // Proceed with creating account...
}
```

### Common Validation Schemas

#### Account Input
```typescript
import { validateAccountInput } from '../utils/validation';

const result = validateAccountInput({
  company_id: 'abc-123-def-456',
  name: 'Operating Account',
  type: 'ASSET',
  parent_id: null,
  account_number: '1000',
  balance: '5000.00',
  description: 'Main operating account',
  active: true,
});

if (result.success) {
  // result.data is type-safe AccountInput
  console.log(result.data.name); // Type: string
}
```

#### Transaction Input
```typescript
import { validateTransactionInput, validateCompleteTransaction } from '../utils/validation';

// Validate transaction header
const txnResult = validateTransactionInput(transactionData);

// Validate complete transaction with line items (checks balance)
const completeResult = validateCompleteTransaction(
  transactionData,
  lineItemsData
);

if (!completeResult.success) {
  // completeResult.error contains validation errors
  console.error(completeResult.error);
}
```

#### Contact Input
```typescript
import { validateContactInput } from '../utils/validation';

const result = validateContactInput({
  company_id: 'abc-123',
  type: 'CUSTOMER',
  name: 'Acme Corp',
  email: 'contact@acme.com',
  phone: '+1-555-0100',
  address: '123 Main St',
  tax_id: '12-3456789',
  notes: 'Important customer',
  active: true,
  balance: '0.00',
  parent_id: null,
  account_type: 'STANDALONE',
  hierarchy_level: 0,
});
```

### Creating Custom Validation Schemas

When you need to validate new data types, add them to `src/utils/validation.ts`:

```typescript
import { z } from 'zod';

/**
 * Custom validation schema example
 */
export const MyEntityInputSchema = z.object({
  company_id: z.string().length(36, 'Invalid company ID format'),
  name: z.string().min(1).max(100, 'Name exceeds maximum length'),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid money format')
    .refine((val) => parseFloat(val) <= 999999999.99, {
      message: 'Amount exceeds maximum allowed value',
    }),
  created_date: z.number().int().positive(),
  active: z.boolean(),
});

export type MyEntityInput = z.infer<typeof MyEntityInputSchema>;

export function validateMyEntityInput(data: unknown) {
  return MyEntityInputSchema.safeParse(data);
}
```

### Validation Best Practices

✅ **DO:**
- Validate ALL user input before processing
- Use Zod schemas for type safety
- Set maximum string lengths to prevent DoS
- Validate data types (string, number, boolean)
- Check ranges for numeric values
- Use regex for format validation (email, phone, money)

❌ **DON'T:**
- Trust any user input without validation
- Use `any` type for validated data
- Allow unbounded string lengths
- Skip validation "because the UI validates it"
- Validate on client only - always validate server-side too

---

## XSS Prevention

### What is XSS?

**Cross-Site Scripting (XSS)** is when an attacker injects malicious JavaScript into your application, which then executes in other users' browsers.

**Example attack:**
```typescript
// User enters this as their company name:
const companyName = '<script>alert("XSS")</script>';

// If rendered without sanitization:
<div>{companyName}</div> // ❌ Script executes!
```

### XSS Protection Layers

We use **three layers** of XSS protection:

1. **React's built-in escaping** (automatic)
2. **DOMPurify sanitization** (for HTML content)
3. **Zod validation** (rejects XSS payloads)

### Layer 1: React's Built-In Escaping

React automatically escapes all content in JSX, which prevents most XSS attacks.

```tsx
// ✅ SAFE - React escapes automatically
function CompanyName({ name }: { name: string }) {
  return <h1>{name}</h1>;
  // Even if name = '<script>alert("xss")</script>'
  // React renders it as text, not executable code
}
```

### Layer 2: DOMPurify Sanitization

**Use when:** Rendering user-generated HTML content (notes, descriptions with formatting).

We provide sanitization helpers in `src/utils/sanitize.ts`:

#### sanitizeHtml()

Removes dangerous elements while preserving safe formatting:

```typescript
import { sanitizeHtml } from '../utils/sanitize';

function UserNote({ note }: { note: string }) {
  // User input might contain HTML formatting
  const safeHtml = sanitizeHtml(note);

  return (
    <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
  );
}

// Example inputs and outputs:
sanitizeHtml('<strong>Bold text</strong>')
// ✅ Returns: '<strong>Bold text</strong>'

sanitizeHtml('<script>alert("xss")</script>')
// ✅ Returns: '' (script removed)

sanitizeHtml('<img src=x onerror=alert(1)>')
// ✅ Returns: '<img src="x">' (onerror removed)
```

#### sanitizeHtmlStrict()

Removes **ALL** HTML tags, leaving only plain text:

```typescript
import { sanitizeHtmlStrict } from '../utils/sanitize';

const plainText = sanitizeHtmlStrict('<strong>Bold</strong> and <script>alert(1)</script>');
// Returns: 'Bold and ' (all tags removed)
```

#### sanitizeUrl()

Prevents `javascript:` and `data:` URL attacks:

```typescript
import { sanitizeUrl } from '../utils/sanitize';

const safeUrl = sanitizeUrl(userProvidedUrl);

// Safe URLs pass through:
sanitizeUrl('https://example.com') // ✅ 'https://example.com'
sanitizeUrl('/relative/path') // ✅ '/relative/path'

// Dangerous URLs blocked:
sanitizeUrl('javascript:alert(1)') // ✅ 'about:blank'
sanitizeUrl('data:text/html,<script>alert(1)</script>') // ✅ 'about:blank'
```

#### sanitizeEmailHtml()

For email content with tables, lists, and formatting:

```typescript
import { sanitizeEmailHtml } from '../utils/sanitize';

const safeEmailContent = sanitizeEmailHtml(userEmailTemplate);
// Allows: p, strong, em, h1-h6, ul, ol, li, a, img, table, etc.
// Removes: script, iframe, form, event handlers
```

### Layer 3: Zod Validation

Our Zod schemas detect and reject common XSS payloads:

```typescript
import { detectXSSAttempt, validateNoXSS } from '../utils/validation';

// Detect XSS in a string
if (detectXSSAttempt(userInput)) {
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Input contains potentially malicious content',
    },
  };
}

// Validate entire object for XSS
const result = validateNoXSS(userData);
if (!result.success) {
  console.error(result.error); // 'Input contains potentially malicious content'
}
```

### XSS Prevention Pattern

```typescript
import { sanitizeHtml } from '../utils/sanitize';
import { validateAccountInput } from '../utils/validation';

async function createAccount(data: unknown) {
  // ═══════════════════════════════════════════════════════════
  // STEP 1: Validate with Zod (detects XSS)
  // ═══════════════════════════════════════════════════════════
  const validation = validateAccountInput(data);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Sanitize HTML fields (if any)
  // ═══════════════════════════════════════════════════════════
  const sanitizedData = {
    ...validation.data,
    description: validation.data.description
      ? sanitizeHtml(validation.data.description)
      : null,
  };

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Store sanitized data
  // ═══════════════════════════════════════════════════════════
  await db.accounts.add(sanitizedData);

  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// STEP 4: Render safely in React
// ═══════════════════════════════════════════════════════════
function AccountDetails({ account }: { account: Account }) {
  return (
    <div>
      <h2>{account.name}</h2> {/* ✅ React auto-escapes */}
      {account.description && (
        <div dangerouslySetInnerHTML={{
          __html: sanitizeHtml(account.description)
        }} />
      )}
    </div>
  );
}
```

### When to Use Each Method

| Scenario | Method | Example |
|----------|--------|---------|
| Plain text display | React JSX | `<div>{userName}</div>` |
| Formatted notes/descriptions | `sanitizeHtml()` | Rich text editor content |
| Plain text only (no formatting) | `sanitizeHtmlStrict()` | Search queries, tags |
| URLs from users | `sanitizeUrl()` | Link inputs, image sources |
| Email templates | `sanitizeEmailHtml()` | Invoice emails, notifications |

### XSS Protection Checklist

✅ **DO:**
- Use React's JSX for all text content (automatic escaping)
- Sanitize HTML before using `dangerouslySetInnerHTML`
- Validate all user input with Zod schemas
- Sanitize URLs before using in `href` or `src` attributes
- Use Content Security Policy (CSP) headers

❌ **DON'T:**
- Use `dangerouslySetInnerHTML` without sanitization
- Trust any user input without validation
- Disable React's escaping
- Accept `javascript:` URLs
- Use `eval()` or `Function()` with user input

---

## Role-Based Access Control (RBAC)

### RBAC Roles

Graceful Books supports five roles with different permission levels:

| Role | Database Enum | Description | Hierarchy Level |
|------|--------------|-------------|-----------------|
| Admin | `OWNER` | Full access, can delete company | 5 (highest) |
| Admin | `ADMIN` | Full access except company deletion | 4 |
| Manager | `ACCOUNTANT` | Cannot delete/modify posted transactions | 3 |
| Bookkeeper | `BOOKKEEPER` | Cannot access settings/users | 2 |
| View-Only | `VIEWER` | Read-only access to all data | 1 (lowest) |

### RBAC Pattern

RBAC is the **second layer** of authorization (after company ownership):

```typescript
import { checkPermission } from '../utils/rbac';
import { requireCompanyOwnership } from '../utils/authorization';

async function deleteTransaction(
  transactionId: string,
  companyId: string,
  companyUser: CompanyUser
): Promise<DatabaseResult<void>> {
  // ═══════════════════════════════════════════════════════════
  // LAYER 1: Check company ownership (IDOR prevention)
  // ═══════════════════════════════════════════════════════════
  const validationError = validateCompanyId(companyId);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const entity = await db.transactions.get(transactionId);
  const authCheck = requireCompanyOwnership(entity, companyId);
  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error };
  }

  // ═══════════════════════════════════════════════════════════
  // LAYER 2: Check RBAC permissions
  // ═══════════════════════════════════════════════════════════
  const hasPermission = checkPermission(
    companyUser,
    'delete',
    'transaction',
    { transactionStatus: authCheck.resource.status }
  );

  if (!hasPermission) {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to delete this transaction',
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // LAYER 3: Perform the action
  // ═══════════════════════════════════════════════════════════
  await db.transactions.delete(transactionId);
  return { success: true };
}
```

### Permission Check Functions

#### checkPermission()

Check if user has permission for a specific action:

```typescript
import { checkPermission } from '../utils/rbac';

// Basic permission check
const canDelete = checkPermission(
  companyUser,
  'delete',
  'account'
);

// With context (for posted transactions)
const canModify = checkPermission(
  companyUser,
  'update',
  'transaction',
  { transactionStatus: 'POSTED' }
);

if (!canModify) {
  // User cannot modify posted transactions
}
```

#### hasAnyPermission()

Check if user has ANY of multiple permissions:

```typescript
import { hasAnyPermission } from '../utils/rbac';

const canModifyAccounts = hasAnyPermission(
  companyUser,
  [
    ['update', 'account'],
    ['delete', 'account'],
  ]
);
```

#### hasAllPermissions()

Check if user has ALL of multiple permissions:

```typescript
import { hasAllPermissions } from '../utils/rbac';

const canManageUsers = hasAllPermissions(
  companyUser,
  [
    ['create', 'user'],
    ['update', 'user'],
    ['delete', 'user'],
  ]
);
```

### Role Permission Matrix

**OWNER & ADMIN:**
- Full access to all resources
- Can manage users and settings
- Can delete and modify posted transactions
- OWNER can delete company (ADMIN cannot)

**ACCOUNTANT (Manager):**
- Full read access
- Can create and edit draft transactions
- **CANNOT** delete or modify posted transactions
- Can view settings but not modify
- Can generate and export reports

**BOOKKEEPER:**
- Can create and edit draft transactions
- Can manage contacts and products
- **CANNOT** access settings or users
- **CANNOT** post, void, or delete transactions
- Can view reports but limited export

**VIEWER (View-Only):**
- **Read-only** access to all financial data
- Can view reports
- **CANNOT** create, update, or delete anything
- **CANNOT** export data

### Special RBAC Rules

#### Rule: ACCOUNTANT Cannot Modify Posted Transactions

```typescript
const canUpdate = checkPermission(
  { role: 'ACCOUNTANT' },
  'update',
  'transaction',
  { transactionStatus: 'POSTED' } // Context is critical!
);

// Returns false - ACCOUNTANT cannot modify posted transactions
```

#### Rule: BOOKKEEPER Can Only Modify Draft Transactions

```typescript
const canUpdate = checkPermission(
  { role: 'BOOKKEEPER' },
  'update',
  'transaction',
  { transactionStatus: 'DRAFT' } // OK
);
// Returns true

const canUpdatePosted = checkPermission(
  { role: 'BOOKKEEPER' },
  'update',
  'transaction',
  { transactionStatus: 'POSTED' } // NOT OK
);
// Returns false
```

### RBAC Helper Functions

```typescript
import {
  canAccessSettings,
  canManageUsers,
  canModifyPostedTransactions,
  canExportData,
  getRoleDescription,
  hasMinimumRole,
} from '../utils/rbac';

// Check specific capabilities
if (canAccessSettings(companyUser.role)) {
  // Show settings menu
}

if (canManageUsers(companyUser.role)) {
  // Show user management UI
}

if (canExportData(companyUser.role)) {
  // Show export button
}

// Check minimum role level
if (hasMinimumRole(companyUser.role, 'ACCOUNTANT')) {
  // User has at least Manager privileges
}

// Get user-friendly description
const description = getRoleDescription(companyUser.role);
// "Full access to all features including company deletion and billing..."
```

### RBAC in React Components

```tsx
import { checkPermission } from '../utils/rbac';
import { useCompanyUser } from '../hooks/useCompanyUser';

function TransactionActions({ transaction }) {
  const companyUser = useCompanyUser();

  const canUpdate = checkPermission(
    companyUser,
    'update',
    'transaction',
    { transactionStatus: transaction.status }
  );

  const canDelete = checkPermission(
    companyUser,
    'delete',
    'transaction',
    { transactionStatus: transaction.status }
  );

  return (
    <div>
      {canUpdate && (
        <button onClick={handleUpdate}>Edit</button>
      )}
      {canDelete && (
        <button onClick={handleDelete}>Delete</button>
      )}
    </div>
  );
}
```

### RBAC Testing

Always test RBAC with different roles:

```typescript
import { checkPermission } from '../utils/rbac';

describe('Transaction permissions', () => {
  it('OWNER can delete posted transactions', () => {
    const result = checkPermission(
      { role: 'OWNER' },
      'delete',
      'transaction',
      { transactionStatus: 'POSTED' }
    );
    expect(result).toBe(true);
  });

  it('ACCOUNTANT cannot delete posted transactions', () => {
    const result = checkPermission(
      { role: 'ACCOUNTANT' },
      'delete',
      'transaction',
      { transactionStatus: 'POSTED' }
    );
    expect(result).toBe(false);
  });

  it('VIEWER cannot update any transactions', () => {
    const result = checkPermission(
      { role: 'VIEWER' },
      'update',
      'transaction',
      { transactionStatus: 'DRAFT' }
    );
    expect(result).toBe(false);
  });
});
```

---

## Rate Limiting

### Why Rate Limiting?

Rate limiting prevents:
- **Brute force attacks** on login
- **DoS attacks** through expensive operations
- **Data scraping** through excessive queries
- **Resource exhaustion** from batch operations

### Rate Limiting Pattern

```typescript
import { rateLimiter, SECURITY_RATE_LIMITS, RateLimitError } from '../utils/rateLimiter';

async function login(email: string, password: string) {
  try {
    // ═══════════════════════════════════════════════════════════
    // STEP 1: Check rate limit
    // ═══════════════════════════════════════════════════════════
    await rateLimiter.checkOrThrow(
      'login',
      SECURITY_RATE_LIMITS.login,
      email // User-specific rate limiting
    );

    // ═══════════════════════════════════════════════════════════
    // STEP 2: Perform the operation
    // ═══════════════════════════════════════════════════════════
    const user = await authenticateUser(email, password);
    return { success: true, user };

  } catch (error) {
    // ═══════════════════════════════════════════════════════════
    // STEP 3: Handle rate limit errors
    // ═══════════════════════════════════════════════════════════
    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Too many login attempts. Please wait ${error.waitTimeMs / 1000} seconds.`,
        },
      };
    }
    throw error;
  }
}
```

### Pre-Configured Rate Limits

We provide pre-configured rate limits in `src/utils/rateLimiter.ts`:

```typescript
// Crypto operations (expensive)
CRYPTO_RATE_LIMITS.keyDerivation    // 5 per minute
CRYPTO_RATE_LIMITS.batchEncrypt     // 10 per minute
CRYPTO_RATE_LIMITS.fileEncrypt      // 20 per minute
CRYPTO_RATE_LIMITS.reencrypt        // 5 per minute

// Security operations
SECURITY_RATE_LIMITS.login          // 5 per minute per user
SECURITY_RATE_LIMITS.dataAccess     // 100 per minute per user
SECURITY_RATE_LIMITS.batchQuery     // 10 per minute per user
SECURITY_RATE_LIMITS.cpgCalculation // 50 per hour per user
SECURITY_RATE_LIMITS.dataExport     // 10 per hour per user
```

### Rate Limiting with Logging

Log rate limit violations to the audit trail:

```typescript
import {
  rateLimiter,
  SECURITY_RATE_LIMITS
} from '../utils/rateLimiter';
import { logRateLimitExceeded } from '../utils/securityLogger';

async function performBatchQuery(userId: string, companyId: string) {
  const result = await rateLimiter.checkWithLogging(
    'batchQuery',
    SECURITY_RATE_LIMITS.batchQuery,
    {
      userId,
      db,
      logRateLimitExceeded,
      endpoint: '/api/batch-query',
    }
  );

  if (!result.allowed) {
    return {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Please wait ${result.waitTimeMs}ms before trying again`,
      },
    };
  }

  // Proceed with query...
}
```

### Custom Rate Limits

Create custom rate limits for new operations:

```typescript
import { RateLimiter } from '../utils/rateLimiter';

const myCustomLimit = {
  maxOperations: 20,
  windowMs: 60 * 1000, // 1 minute
};

async function myExpensiveOperation(userId: string) {
  await rateLimiter.checkOrThrow('myOperation', myCustomLimit, userId);

  // Perform expensive operation...
}
```

### Displaying Rate Limit Status to Users

```typescript
import { rateLimiter, SECURITY_RATE_LIMITS, formatWaitTime } from '../utils/rateLimiter';

function RateLimitStatus({ userId }: { userId: string }) {
  const quota = rateLimiter.getQuotaStatus(
    'login',
    SECURITY_RATE_LIMITS.login,
    userId
  );

  return (
    <div>
      <p>Login attempts remaining: {quota.remaining} / {quota.maxOperations}</p>
      {quota.resetsAt && (
        <p>Resets in: {formatWaitTime(quota.resetsAt - Date.now())}</p>
      )}
    </div>
  );
}
```

### Testing Rate Limiters

```typescript
import { RateLimiter } from '../utils/rateLimiter';

describe('Rate limiting', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  afterEach(() => {
    limiter.destroy();
  });

  it('allows operations within limit', async () => {
    const config = { maxOperations: 3, windowMs: 60000 };

    const result1 = await limiter.check('test', config);
    expect(result1.allowed).toBe(true);

    const result2 = await limiter.check('test', config);
    expect(result2.allowed).toBe(true);

    const result3 = await limiter.check('test', config);
    expect(result3.allowed).toBe(true);
  });

  it('blocks operations over limit', async () => {
    const config = { maxOperations: 2, windowMs: 60000 };

    await limiter.check('test', config); // 1
    await limiter.check('test', config); // 2

    const result = await limiter.check('test', config); // 3 - blocked
    expect(result.allowed).toBe(false);
    expect(result.waitTimeMs).toBeGreaterThan(0);
  });
});
```

---

## Security Logging

### What to Log

Security logging captures:
- **Failed login attempts** (brute force detection)
- **Authorization failures** (potential IDOR attacks)
- **Rate limit violations** (abuse detection)
- **Suspicious activity** (anomaly detection)
- **Data exports** (data exfiltration monitoring)
- **Account lockouts** (account security events)

### Security Event Types

```typescript
export enum SecurityEventType {
  FAILED_LOGIN = 'FAILED_LOGIN',
  AUTHORIZATION_FAILURE = 'AUTHORIZATION_FAILURE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  ACCOUNT_LOCKOUT = 'ACCOUNT_LOCKOUT',
  DATA_EXPORT = 'DATA_EXPORT',
}
```

### Logging Failed Logins

```typescript
import { logFailedLogin } from '../utils/securityLogger';

async function attemptLogin(email: string, password: string) {
  const user = await findUserByEmail(email);

  if (!user) {
    // Log failed login - user not found
    await logFailedLogin(
      {
        email,
        reason: 'account_not_found',
        attemptCount: 1,
      },
      db
    );

    return {
      success: false,
      error: 'Invalid credentials', // Don't reveal whether account exists
    };
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    // Log failed login - invalid password
    await logFailedLogin(
      {
        email,
        reason: 'invalid_credentials',
        attemptCount: user.failedLoginAttempts + 1,
      },
      db
    );

    return {
      success: false,
      error: 'Invalid credentials',
    };
  }

  // Login successful
  return { success: true, user };
}
```

### Logging Authorization Failures

```typescript
import { logAuthorizationFailure } from '../utils/securityLogger';

async function getAccount(
  accountId: string,
  companyId: string,
  userId: string
) {
  const entity = await db.accounts.get(accountId);
  const authCheck = requireCompanyOwnership(entity, companyId);

  if (!authCheck.authorized) {
    // Log potential IDOR attack
    await logAuthorizationFailure(
      userId,
      companyId,
      {
        resourceType: 'account',
        resourceId: accountId,
        requestedAction: 'read',
        reason: 'forbidden',
        companyIdMismatch: entity ? {
          requested: companyId,
          actual: entity.companyId,
        } : undefined,
      },
      db
    );

    return { success: false, error: authCheck.error };
  }

  // Authorized - proceed
  return { success: true, data: authCheck.resource };
}
```

### Logging Data Exports

```typescript
import { logDataExport } from '../utils/securityLogger';

async function exportTransactions(
  userId: string,
  companyId: string,
  params: ExportParams
) {
  // Perform export
  const transactions = await queryTransactions(companyId, params);
  const csvData = convertToCSV(transactions);

  // Log the export for audit trail
  await logDataExport(
    userId,
    companyId,
    {
      entityType: 'transactions',
      exportFormat: 'csv',
      recordCount: transactions.length,
      dateRange: {
        start: params.startDate,
        end: params.endDate,
      },
      exportSize: csvData.length,
      warningAcknowledged: true,
    },
    db
  );

  return csvData;
}
```

### Querying Security Events

```typescript
import { querySecurityEvents, getSecurityEventStats } from '../utils/securityLogger';

// Query all security events for a company
const events = await querySecurityEvents(companyId, db, {
  eventType: 'FAILED_LOGIN',
  dateFrom: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
  limit: 100,
});

// Get statistics
const stats = await getSecurityEventStats(companyId, db);
console.log(`Failed logins in last 24h: ${stats.failedLogins}`);
console.log(`Authorization failures: ${stats.authorizationFailures}`);
console.log(`Rate limits exceeded: ${stats.rateLimitExceeded}`);
```

### Security Logging Best Practices

✅ **DO:**
- Log all authentication failures
- Log all authorization failures
- Log all rate limit violations
- Log all data exports
- Include contextual information (IP, user agent)
- Sanitize logs to prevent leaking sensitive data

❌ **DON'T:**
- Log passwords or passphrases
- Log encryption keys
- Log full credit card numbers
- Log personally identifiable information (PII) unnecessarily
- Skip logging because "it's just a test"

### Sensitive Data Sanitization

Security logging automatically sanitizes sensitive fields:

```typescript
// These fields are automatically redacted:
const SENSITIVE_FIELDS = [
  'password',
  'passphrase',
  'key',
  'secret',
  'token',
  'privateKey',
  'encryptionKey',
  'masterKey',
  'salt',
];

// Example:
await logSecurityEvent({
  type: 'FAILED_LOGIN',
  details: {
    email: 'user@example.com',
    password: 'secret123', // ✅ Automatically redacted to '[REDACTED]'
  },
}, db);
```

---

## Common Vulnerability Patterns to Avoid

### 1. IDOR (Insecure Direct Object Reference)

**WRONG:**
```typescript
// ❌ No authorization check - any user can access any account
async function getAccount(accountId: string) {
  return await db.accounts.get(accountId);
}
```

**RIGHT:**
```typescript
// ✅ Authorization check prevents IDOR
async function getAccount(accountId: string, companyId: string) {
  const validationError = validateCompanyId(companyId);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const entity = await db.accounts.get(accountId);
  const authCheck = requireCompanyOwnership(entity, companyId);

  if (!authCheck.authorized) {
    return { success: false, error: authCheck.error };
  }

  return { success: true, data: authCheck.resource };
}
```

### 2. Mass Assignment

**WRONG:**
```typescript
// ❌ User can set any field, including role or companyId
async function updateUser(userId: string, updates: any) {
  await db.users.update(userId, updates);
  // Attacker could send: { role: 'OWNER', companyId: 'other-company' }
}
```

**RIGHT:**
```typescript
// ✅ Only allow specific fields to be updated
async function updateUser(
  userId: string,
  updates: { name?: string; email?: string }
) {
  // Validate input
  const validation = validateUserUpdateInput(updates);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  // Only update allowed fields
  const allowedUpdates = {
    name: validation.data.name,
    email: validation.data.email,
    // role, companyId, etc. cannot be updated here
  };

  await db.users.update(userId, allowedUpdates);
  return { success: true };
}
```

### 3. Information Leakage

**WRONG:**
```typescript
// ❌ Reveals whether account exists in another company
async function getAccount(accountId: string, companyId: string) {
  const account = await db.accounts.get(accountId);

  if (!account) {
    return { error: 'Account not found' };
  }

  if (account.companyId !== companyId) {
    return { error: 'You do not have permission to access this account' };
    // ❌ Attacker knows account exists but belongs to different company
  }

  return { data: account };
}
```

**RIGHT:**
```typescript
// ✅ Returns same error for both cases (NOT_FOUND)
async function getAccount(accountId: string, companyId: string) {
  const account = await db.accounts.get(accountId);
  const authCheck = requireCompanyOwnership(account, companyId);

  if (!authCheck.authorized) {
    // Returns NOT_FOUND for both:
    // 1. Account doesn't exist
    // 2. Account belongs to different company
    return { success: false, error: authCheck.error };
  }

  return { success: true, data: authCheck.resource };
}
```

### 4. XSS Through User Content

**WRONG:**
```tsx
// ❌ Directly rendering user input as HTML
function UserNote({ note }: { note: string }) {
  return <div dangerouslySetInnerHTML={{ __html: note }} />;
  // If note = '<script>alert("xss")</script>', it executes!
}
```

**RIGHT:**
```tsx
// ✅ Sanitize before rendering
import { sanitizeHtml } from '../utils/sanitize';

function UserNote({ note }: { note: string }) {
  const safeHtml = sanitizeHtml(note);
  return <div dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}
```

### 5. Unbounded Queries

**WRONG:**
```typescript
// ❌ Can return millions of records, causing DoS
async function getAllTransactions(companyId: string) {
  return await db.transactions
    .where('companyId')
    .equals(companyId)
    .toArray(); // ❌ No limit!
}
```

**RIGHT:**
```typescript
// ✅ Pagination limits results
async function getTransactions(
  companyId: string,
  limit: number = 50,
  offset: number = 0
) {
  // Validate limit
  const maxLimit = 100;
  const safeLimit = Math.min(limit, maxLimit);

  const results = await db.transactions
    .where('companyId')
    .equals(companyId)
    .offset(offset)
    .limit(safeLimit)
    .toArray();

  return {
    data: results,
    hasMore: results.length === safeLimit,
  };
}
```

### 6. Missing Input Validation

**WRONG:**
```typescript
// ❌ No validation - can crash or create invalid data
async function createAccount(data: any) {
  await db.accounts.add(data);
  // What if data.balance = "not a number"?
  // What if data.name = '<script>alert("xss")</script>'?
}
```

**RIGHT:**
```typescript
// ✅ Validate all inputs with Zod
import { validateAccountInput } from '../utils/validation';

async function createAccount(data: unknown) {
  const validation = validateAccountInput(data);

  if (!validation.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid account data',
        details: validation.error.errors,
      },
    };
  }

  await db.accounts.add(validation.data);
  return { success: true };
}
```

### 7. Logging Sensitive Data

**WRONG:**
```typescript
// ❌ Logs password in plaintext
async function login(email: string, password: string) {
  console.log('Login attempt:', { email, password }); // ❌ Never log passwords!

  const user = await authenticateUser(email, password);
  return user;
}
```

**RIGHT:**
```typescript
// ✅ Never log sensitive data
async function login(email: string, password: string) {
  logger.info('Login attempt', { email }); // ✅ Only log email

  const user = await authenticateUser(email, password);
  return user;
}
```

### 8. Weak Rate Limiting

**WRONG:**
```typescript
// ❌ No rate limiting on expensive operation
async function deriveEncryptionKey(passphrase: string) {
  // This is computationally expensive - attacker can DoS the client
  return await argon2.hash(passphrase);
}
```

**RIGHT:**
```typescript
// ✅ Rate limit expensive operations
import { rateLimiter, CRYPTO_RATE_LIMITS } from '../utils/rateLimiter';

async function deriveEncryptionKey(passphrase: string, userId: string) {
  await rateLimiter.checkOrThrow(
    'keyDerivation',
    CRYPTO_RATE_LIMITS.keyDerivation,
    userId
  );

  return await argon2.hash(passphrase);
}
```

---

## Code Review Security Checklist

Use this checklist when reviewing code changes:

### Authorization Checks

- [ ] All data access functions accept `companyId` parameter
- [ ] `validateCompanyId()` called at function start
- [ ] `requireCompanyOwnership()` used for single entity access
- [ ] `requireBatchCompanyOwnership()` used for batch operations
- [ ] Query functions require `companyId` as mandatory parameter (not optional in filter)
- [ ] Returns `NOT_FOUND` for unauthorized access (not `FORBIDDEN`)
- [ ] No direct database access without authorization checks

### RBAC Checks

- [ ] RBAC permission check after company ownership check
- [ ] `checkPermission()` called with correct resource and action
- [ ] Context provided for posted transaction checks
- [ ] Permission errors are user-friendly
- [ ] UI elements conditional on permissions

### Input Validation

- [ ] All user input validated with Zod schemas
- [ ] Validation errors returned with clear messages
- [ ] String length limits prevent DoS
- [ ] Numeric ranges validated
- [ ] Email/phone format validation used
- [ ] No `any` types for validated data

### XSS Prevention

- [ ] React JSX used for text content (automatic escaping)
- [ ] `dangerouslySetInnerHTML` only used with `sanitizeHtml()`
- [ ] URLs sanitized with `sanitizeUrl()`
- [ ] Zod validation detects XSS payloads
- [ ] No `eval()` or `Function()` with user input

### Rate Limiting

- [ ] Expensive operations rate-limited
- [ ] Login attempts rate-limited
- [ ] Batch operations rate-limited
- [ ] Rate limit errors handled gracefully
- [ ] User-friendly error messages

### Security Logging

- [ ] Failed logins logged
- [ ] Authorization failures logged
- [ ] Data exports logged
- [ ] No sensitive data in logs (passwords, keys)
- [ ] Contextual information included (IP, user agent)

### General Security

- [ ] No console.log of sensitive data
- [ ] Error messages don't reveal system internals
- [ ] Pagination used for large queries
- [ ] No hardcoded secrets or credentials
- [ ] Encryption used for sensitive fields

---

## Testing Security Features

### Testing Authorization

```typescript
import { requireCompanyOwnership, validateCompanyId } from '../utils/authorization';

describe('Authorization', () => {
  it('rejects null companyId', () => {
    const error = validateCompanyId(null);
    expect(error).toBeDefined();
    expect(error?.code).toBe('VALIDATION_ERROR');
  });

  it('rejects empty companyId', () => {
    const error = validateCompanyId('');
    expect(error).toBeDefined();
  });

  it('allows valid companyId', () => {
    const error = validateCompanyId('valid-company-id');
    expect(error).toBeUndefined();
  });

  it('allows access when companyIds match', () => {
    const resource = { id: '1', companyId: 'company-A' };
    const result = requireCompanyOwnership(resource, 'company-A');

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.resource).toBe(resource);
    }
  });

  it('denies access when companyIds differ', () => {
    const resource = { id: '1', companyId: 'company-A' };
    const result = requireCompanyOwnership(resource, 'company-B');

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('denies access when resource is null', () => {
    const result = requireCompanyOwnership(null, 'company-A');

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });
});
```

### Testing RBAC Permissions

```typescript
import { checkPermission } from '../utils/rbac';

describe('RBAC Permissions', () => {
  describe('Transaction permissions', () => {
    it('OWNER can delete posted transactions', () => {
      expect(
        checkPermission(
          { role: 'OWNER' },
          'delete',
          'transaction',
          { transactionStatus: 'POSTED' }
        )
      ).toBe(true);
    });

    it('ACCOUNTANT cannot delete posted transactions', () => {
      expect(
        checkPermission(
          { role: 'ACCOUNTANT' },
          'delete',
          'transaction',
          { transactionStatus: 'POSTED' }
        )
      ).toBe(false);
    });

    it('ACCOUNTANT can update draft transactions', () => {
      expect(
        checkPermission(
          { role: 'ACCOUNTANT' },
          'update',
          'transaction',
          { transactionStatus: 'DRAFT' }
        )
      ).toBe(true);
    });

    it('VIEWER cannot update any transactions', () => {
      expect(
        checkPermission(
          { role: 'VIEWER' },
          'update',
          'transaction'
        )
      ).toBe(false);
    });
  });

  describe('Settings permissions', () => {
    it('BOOKKEEPER cannot access settings', () => {
      expect(
        checkPermission(
          { role: 'BOOKKEEPER' },
          'read',
          'settings'
        )
      ).toBe(false);
    });

    it('ADMIN can access settings', () => {
      expect(
        checkPermission(
          { role: 'ADMIN' },
          'read',
          'settings'
        )
      ).toBe(true);
    });
  });
});
```

### Testing Input Validation

```typescript
import { validateAccountInput } from '../utils/validation';

describe('Input Validation', () => {
  it('accepts valid account data', () => {
    const data = {
      company_id: 'a'.repeat(36),
      name: 'Operating Account',
      type: 'ASSET',
      parent_id: null,
      account_number: '1000',
      balance: '5000.00',
      description: 'Main account',
      active: true,
    };

    const result = validateAccountInput(data);
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const data = {
      name: 'Account',
      // Missing company_id, type, etc.
    };

    const result = validateAccountInput(data);
    expect(result.success).toBe(false);
  });

  it('rejects invalid money format', () => {
    const data = {
      company_id: 'a'.repeat(36),
      name: 'Account',
      type: 'ASSET',
      balance: 'not-a-number', // Invalid
      active: true,
    };

    const result = validateAccountInput(data);
    expect(result.success).toBe(false);
  });

  it('rejects XSS payloads', () => {
    const data = {
      company_id: 'a'.repeat(36),
      name: '<script>alert("xss")</script>',
      type: 'ASSET',
      balance: '0.00',
      active: true,
    };

    const result = validateAccountInput(data);
    expect(result.success).toBe(false);
  });

  it('rejects strings exceeding max length', () => {
    const data = {
      company_id: 'a'.repeat(36),
      name: 'a'.repeat(101), // Max is 100
      type: 'ASSET',
      balance: '0.00',
      active: true,
    };

    const result = validateAccountInput(data);
    expect(result.success).toBe(false);
  });
});
```

### Testing XSS Prevention

```typescript
import { sanitizeHtml, sanitizeUrl } from '../utils/sanitize';
import { detectXSSAttempt } from '../utils/validation';

describe('XSS Prevention', () => {
  describe('sanitizeHtml', () => {
    it('removes script tags', () => {
      const input = '<script>alert("xss")</script>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('<script');
      expect(output).not.toContain('alert');
    });

    it('removes event handlers', () => {
      const input = '<img src=x onerror=alert(1)>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('onerror');
    });

    it('preserves safe HTML', () => {
      const input = '<strong>Bold</strong> and <em>italic</em>';
      const output = sanitizeHtml(input);
      expect(output).toContain('<strong>Bold</strong>');
      expect(output).toContain('<em>italic</em>');
    });
  });

  describe('sanitizeUrl', () => {
    it('blocks javascript: URLs', () => {
      const input = 'javascript:alert(1)';
      const output = sanitizeUrl(input);
      expect(output).toBe('about:blank');
    });

    it('blocks data: URLs', () => {
      const input = 'data:text/html,<script>alert(1)</script>';
      const output = sanitizeUrl(input);
      expect(output).toBe('about:blank');
    });

    it('allows https: URLs', () => {
      const input = 'https://example.com';
      const output = sanitizeUrl(input);
      expect(output).toBe('https://example.com');
    });
  });

  describe('detectXSSAttempt', () => {
    it('detects script tags', () => {
      expect(detectXSSAttempt('<script>alert(1)</script>')).toBe(true);
    });

    it('detects event handlers', () => {
      expect(detectXSSAttempt('onerror=alert(1)')).toBe(true);
      expect(detectXSSAttempt('onclick=alert(1)')).toBe(true);
    });

    it('allows safe content', () => {
      expect(detectXSSAttempt('Hello world')).toBe(false);
      expect(detectXSSAttempt('Account #1234')).toBe(false);
    });
  });
});
```

### Testing Rate Limiting

```typescript
import { RateLimiter } from '../utils/rateLimiter';

describe('Rate Limiting', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  afterEach(() => {
    limiter.destroy();
  });

  it('allows operations within limit', async () => {
    const config = { maxOperations: 3, windowMs: 60000 };

    for (let i = 0; i < 3; i++) {
      const result = await limiter.check('test', config);
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks operations over limit', async () => {
    const config = { maxOperations: 2, windowMs: 60000 };

    await limiter.check('test', config);
    await limiter.check('test', config);

    const result = await limiter.check('test', config);
    expect(result.allowed).toBe(false);
    expect(result.waitTimeMs).toBeGreaterThan(0);
  });

  it('user-specific rate limiting', async () => {
    const config = { maxOperations: 1, windowMs: 60000 };

    // User A can make 1 request
    const resultA1 = await limiter.check('test', config, 'user-A');
    expect(resultA1.allowed).toBe(true);

    // User A blocked on 2nd request
    const resultA2 = await limiter.check('test', config, 'user-A');
    expect(resultA2.allowed).toBe(false);

    // User B can still make request (separate quota)
    const resultB1 = await limiter.check('test', config, 'user-B');
    expect(resultB1.allowed).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('Data access with authorization', () => {
  let companyA: string;
  let companyB: string;
  let accountA: string;
  let accountB: string;

  beforeEach(async () => {
    // Create two companies
    companyA = await createCompany({ name: 'Company A' });
    companyB = await createCompany({ name: 'Company B' });

    // Create accounts for each company
    accountA = await createAccount({
      companyId: companyA,
      name: 'Account A',
      type: 'ASSET',
    });

    accountB = await createAccount({
      companyId: companyB,
      name: 'Account B',
      type: 'ASSET',
    });
  });

  it('allows access to own company account', async () => {
    const result = await getAccount(accountA, companyA, context);
    expect(result.success).toBe(true);
  });

  it('denies access to other company account', async () => {
    // Company A trying to access Company B's account
    const result = await getAccount(accountB, companyA, context);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('denies batch access if any account unauthorized', async () => {
    // Try to access both accounts from Company A
    const result = await batchGetAccounts(
      [accountA, accountB],
      companyA,
      context
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });
});
```

---

## Additional Resources

### OWASP Top 10 (2021)

Our security implementation addresses all OWASP Top 10 vulnerabilities:

1. **A01:2021 - Broken Access Control**
   - ✅ Fixed with authorization helpers and RBAC
   - See: [Authorization and Access Control](#authorization-and-access-control)

2. **A02:2021 - Cryptographic Failures**
   - ✅ Zero-knowledge encryption architecture
   - See: `src/crypto/` and `CLAUDE.md`

3. **A03:2021 - Injection**
   - ✅ Zod validation and sanitization
   - See: [Input Validation](#input-validation) and [XSS Prevention](#xss-prevention)

4. **A04:2021 - Insecure Design**
   - ✅ Security-first architecture
   - See: `docs/EXTERNAL_PENTEST_PREPARATION.md`

5. **A05:2021 - Security Misconfiguration**
   - ✅ Security headers and CSP
   - See: `docs/SECURITY_HEADERS_CONFIGURATION.md`

6. **A06:2021 - Vulnerable and Outdated Components**
   - ✅ npm audit and dependency scanning
   - See: `Roadmaps/SECURITY_HARDENING_ROADMAP.md`

7. **A07:2021 - Identification and Authentication Failures**
   - ✅ Rate limiting and secure session management
   - See: [Rate Limiting](#rate-limiting)

8. **A08:2021 - Software and Data Integrity Failures**
   - ✅ Immutable audit logs
   - See: [Security Logging](#security-logging)

9. **A09:2021 - Security Logging and Monitoring Failures**
   - ✅ Comprehensive security event logging
   - See: `src/utils/securityLogger.ts`

10. **A10:2021 - Server-Side Request Forgery (SSRF)**
    - ✅ Input validation and URL sanitization
    - See: [XSS Prevention](#xss-prevention)

### External Resources

- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **OWASP Cheat Sheets:** https://cheatsheetseries.owasp.org/
- **Zod Documentation:** https://zod.dev/
- **DOMPurify Documentation:** https://github.com/cure53/DOMPurify
- **Web Security Best Practices:** https://web.dev/security/

### Internal Documentation

- **Agent Review Checklist:** `Roadmaps/AGENT_REVIEW_CHECKLIST.md`
- **Security Hardening Roadmap:** `Roadmaps/SECURITY_HARDENING_ROADMAP.md`
- **Penetration Test Guide:** `docs/PENETRATION_TEST_GUIDE.md`
- **Internal Pentest Report:** `docs/INTERNAL_PENTEST_REPORT.md`
- **External Pentest Prep:** `docs/EXTERNAL_PENTEST_PREPARATION.md`
- **Security Headers Config:** `docs/SECURITY_HEADERS_CONFIGURATION.md`
- **Incident Response:** `docs/INCIDENT_RESPONSE.md`

### Code Examples

All security helpers are located in `src/utils/`:

- **Authorization:** `src/utils/authorization.ts`
- **Validation:** `src/utils/validation.ts`
- **Sanitization:** `src/utils/sanitize.ts`
- **RBAC:** `src/utils/rbac.ts`
- **Rate Limiting:** `src/utils/rateLimiter.ts`
- **Security Logging:** `src/utils/securityLogger.ts`

Example implementations in `src/store/`:

- **Accounts:** `src/store/accounts.ts` (lines 120-155)
- **Transactions:** `src/store/transactions.ts`
- **Contacts:** `src/store/contacts.ts`
- **Products:** `src/store/products.ts`

---

## Summary

You've now learned how to build secure features for Graceful Books! Remember:

1. **Always validate** user input with Zod schemas
2. **Always authorize** data access with company ownership checks
3. **Always sanitize** HTML content before rendering
4. **Always check** RBAC permissions after authorization
5. **Always rate limit** expensive operations
6. **Always log** security-relevant events

When in doubt, refer to this guide or ask a team member. Security is everyone's responsibility!

**Happy coding! 🔒**
