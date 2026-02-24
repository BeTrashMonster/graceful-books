# Runtime Validation Examples

This document provides examples of using the Zod validation schemas for input validation and XSS prevention.

## Table of Contents

1. [Account Validation](#account-validation)
2. [Transaction Validation](#transaction-validation)
3. [Contact Validation](#contact-validation)
4. [Product Validation](#product-validation)
5. [Invoice Validation](#invoice-validation)
6. [CPG Entity Validation](#cpg-entity-validation)
7. [XSS Detection](#xss-detection)
8. [Error Handling](#error-handling)

---

## Account Validation

### Valid Account Input

```typescript
import { validateAccountInput } from './utils/validation';

const accountData = {
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Cash',
  type: 'ASSET',
  parent_id: null,
  account_number: '1000',
  balance: '0.00',
  description: 'Main cash account',
  active: true,
};

const result = validateAccountInput(accountData);
if (result.success) {
  console.log('Valid account:', result.data);
  // Proceed with creating/updating account
} else {
  console.error('Validation failed:', result.error);
}
```

### Invalid Examples (Rejected)

```typescript
// Missing company_id
validateAccountInput({
  name: 'Cash',
  type: 'ASSET',
  balance: '0.00',
}); // FAILS

// Name exceeds 100 characters
validateAccountInput({
  company_id: 'valid-uuid',
  name: 'A'.repeat(101),
  type: 'ASSET',
  balance: '0.00',
}); // FAILS

// Invalid balance format
validateAccountInput({
  company_id: 'valid-uuid',
  name: 'Cash',
  type: 'ASSET',
  balance: 'not-a-number',
}); // FAILS

// Balance exceeds max value
validateAccountInput({
  company_id: 'valid-uuid',
  name: 'Cash',
  type: 'ASSET',
  balance: '9999999999.99',
}); // FAILS (max is 999,999,999.99)
```

---

## Transaction Validation

### Valid Transaction with Line Items

```typescript
import {
  validateCompleteTransaction,
  validateTransactionInput,
  validateTransactionLineItemInput,
} from './utils/validation';

const transaction = {
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  transaction_number: 'JE-2026-0001',
  transaction_date: Date.now(),
  type: 'JOURNAL_ENTRY',
  status: 'DRAFT',
  description: 'Cash sale',
  reference: null,
  memo: null,
  attachments: [],
};

const lineItems = [
  {
    account_id: '123e4567-e89b-12d3-a456-426614174000',
    debit: '100.00',
    credit: '0.00',
    description: 'Cash received',
    contact_id: null,
    product_id: null,
  },
  {
    account_id: '123e4567-e89b-12d3-a456-426614174002',
    debit: '0.00',
    credit: '100.00',
    description: 'Revenue earned',
    contact_id: null,
    product_id: null,
  },
];

const result = validateCompleteTransaction(transaction, lineItems);
if (result.success) {
  console.log('Balanced transaction:', result.data);
} else {
  console.error('Transaction validation failed:', result.error);
}
```

### Invalid Examples (Rejected)

```typescript
// Line item with both debit and credit
validateTransactionLineItemInput({
  account_id: 'valid-uuid',
  debit: '100.00',
  credit: '100.00', // Cannot have both
  description: 'Invalid',
}); // FAILS

// Unbalanced transaction
validateCompleteTransaction(
  transaction,
  [
    { account_id: 'uuid', debit: '100.00', credit: '0.00' },
    { account_id: 'uuid', debit: '0.00', credit: '50.00' }, // Not balanced!
  ]
); // FAILS

// Too many attachments
validateTransactionInput({
  ...transaction,
  attachments: Array(51).fill('attachment'),
}); // FAILS (max 50)
```

---

## Contact Validation

### Valid Contact Input

```typescript
import { validateContactInput } from './utils/validation';

const contactData = {
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  type: 'CUSTOMER',
  name: 'Acme Corp',
  email: 'contact@acme.com',
  phone: '+1-555-1234',
  address: '123 Main St, New York, NY 10001',
  tax_id: '12-3456789',
  notes: 'Important customer',
  active: true,
  balance: '0.00',
  parent_id: null,
  account_type: 'STANDALONE',
  hierarchy_level: 0,
};

const result = validateContactInput(contactData);
if (result.success) {
  console.log('Valid contact:', result.data);
}
```

### Invalid Examples (Rejected)

```typescript
// Invalid email format
validateContactInput({
  ...contactData,
  email: 'not-an-email',
}); // FAILS

// Phone with invalid characters
validateContactInput({
  ...contactData,
  phone: 'ABC-DEF-GHIJ',
}); // FAILS

// Email too long (max 254 chars)
validateContactInput({
  ...contactData,
  email: 'a'.repeat(255) + '@example.com',
}); // FAILS
```

---

## Product Validation

### Valid Product Input

```typescript
import { validateProductInput } from './utils/validation';

const productData = {
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  type: 'PRODUCT',
  sku: 'WIDGET-001',
  name: 'Standard Widget',
  description: 'High-quality widget for general use',
  unit_price: '29.99',
  cost: '15.00',
  income_account_id: '123e4567-e89b-12d3-a456-426614174010',
  expense_account_id: '123e4567-e89b-12d3-a456-426614174011',
  taxable: true,
  active: true,
};

const result = validateProductInput(productData);
if (result.success) {
  console.log('Valid product:', result.data);
}
```

### Invalid Examples (Rejected)

```typescript
// Negative price
validateProductInput({
  ...productData,
  unit_price: '-10.00',
}); // FAILS

// Invalid money format
validateProductInput({
  ...productData,
  unit_price: '29.999', // Too many decimal places
}); // FAILS
```

---

## Invoice Validation

### Valid Invoice Input

```typescript
import { validateInvoiceInput } from './utils/validation';

const now = Date.now();
const invoiceData = {
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  customer_id: '123e4567-e89b-12d3-a456-426614174020',
  invoice_number: 'INV-2026-0001',
  invoice_date: now,
  due_date: now + 30 * 24 * 60 * 60 * 1000, // 30 days from now
  status: 'DRAFT',
  subtotal: '100.00',
  tax: '10.00',
  total: '110.00',
  notes: 'Thank you for your business!',
  internal_memo: 'Rush order - expedite shipping',
  template_id: 'classic',
  line_items: [
    {
      id: '123e4567-e89b-12d3-a456-426614174030',
      description: 'Consulting Services - January 2026',
      quantity: 10,
      unitPrice: '10.00',
      accountId: '123e4567-e89b-12d3-a456-426614174040',
      total: '100.00',
    },
  ],
  transaction_id: null,
};

const result = validateInvoiceInput(invoiceData);
if (result.success) {
  console.log('Valid invoice:', result.data);
}
```

### Invalid Examples (Rejected)

```typescript
// Due date before invoice date
validateInvoiceInput({
  ...invoiceData,
  due_date: invoiceData.invoice_date - 1000,
}); // FAILS

// No line items
validateInvoiceInput({
  ...invoiceData,
  line_items: [],
}); // FAILS (min 1 line item)

// Too many line items
validateInvoiceInput({
  ...invoiceData,
  line_items: Array(101).fill({
    id: 'uuid',
    description: 'Item',
    quantity: 1,
    unitPrice: '1.00',
    accountId: 'uuid',
    total: '1.00',
  }),
}); // FAILS (max 100 line items)
```

---

## CPG Entity Validation

### CPG Category

```typescript
import { validateCPGCategoryInput } from './utils/validation';

const categoryData = {
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'Essential Oil',
  description: 'Various essential oil sizes',
  variants: ['1oz', '2oz', '4oz', '8oz'],
  unit_of_measure: 'oz',
  sort_order: 1,
  active: true,
};

const result = validateCPGCategoryInput(categoryData);
if (result.success) {
  console.log('Valid CPG category:', result.data);
}
```

### CPG Distributor

```typescript
import { validateCPGDistributorInput } from './utils/validation';

const distributorData = {
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  name: 'UNFI',
  description: 'United Natural Foods Inc - National distributor',
  contact_info: 'contact@unfi.com',
  linked_contact_id: null,
  fee_structure: [
    {
      id: '123e4567-e89b-12d3-a456-426614174050',
      description: 'Pallet handling fee',
      amount: '45.00',
      unit: 'per_pallet',
    },
    {
      id: '123e4567-e89b-12d3-a456-426614174051',
      description: 'Warehouse storage',
      amount: '25.00',
      unit: 'per_day_full',
    },
  ],
  last_fee_update_date: Date.now(),
  typical_update_frequency: 'quarterly',
  active: true,
};

const result = validateCPGDistributorInput(distributorData);
if (result.success) {
  console.log('Valid CPG distributor:', result.data);
}
```

### CPG Finished Product

```typescript
import { validateCPGFinishedProductInput } from './utils/validation';

const productData = {
  company_id: '123e4567-e89b-12d3-a456-426614174001',
  name: '1oz Lavender Body Oil',
  description: 'Premium lavender essential oil blend',
  sku: 'BO-LAV-1OZ',
  msrp: '12.00',
  unit_of_measure: 'each',
  pieces_per_unit: 1,
  active: true,
};

const result = validateCPGFinishedProductInput(productData);
if (result.success) {
  console.log('Valid CPG finished product:', result.data);
}
```

---

## XSS Detection

### Common XSS Payloads (All Rejected)

```typescript
import { detectXSSAttempt, validateNoXSS } from './utils/validation';

// Script tag
detectXSSAttempt('<script>alert("xss")</script>'); // Returns true

// JavaScript protocol
detectXSSAttempt('javascript:alert("xss")'); // Returns true

// Onerror attribute
detectXSSAttempt('<img src=x onerror=alert("xss")>'); // Returns true

// Onload attribute
detectXSSAttempt('<body onload=alert("xss")>'); // Returns true

// Iframe tag
detectXSSAttempt('<iframe src="evil.com"></iframe>'); // Returns true

// Eval function
detectXSSAttempt('eval(maliciousCode)'); // Returns true

// Event handlers
detectXSSAttempt('<div onclick=alert(1)>Click</div>'); // Returns true
detectXSSAttempt('<div onmouseover=alert(1)>Hover</div>'); // Returns true
```

### Safe Content (All Accepted)

```typescript
// Normal text
detectXSSAttempt('This is normal text'); // Returns false

// HTML entities (encoded)
detectXSSAttempt('&lt;script&gt;'); // Returns false

// Regular HTML-like text
detectXSSAttempt('Use <placeholder> for templates'); // Returns false
```

### Validating Complex Objects

```typescript
import { validateNoXSS } from './utils/validation';

// Clean object - passes
const cleanData = {
  user: {
    name: 'John Doe',
    bio: 'Software developer with 10 years experience',
    skills: ['JavaScript', 'TypeScript', 'React'],
  },
};
validateNoXSS(cleanData); // { success: true }

// Object with XSS - fails
const maliciousData = {
  user: {
    name: 'John Doe',
    bio: 'Software developer <script>alert(1)</script>',
  },
};
validateNoXSS(maliciousData); // { success: false, error: '...' }

// Array with XSS - fails
const maliciousArray = [
  'item1',
  '<img src=x onerror=alert(1)>',
  'item3',
];
validateNoXSS(maliciousArray); // { success: false, error: '...' }
```

---

## Error Handling

### Formatted Error Messages

```typescript
import { formatValidationError, wrapValidationResult } from './utils/validation';

const invalidData = {
  company_id: 'invalid',
  name: '', // Too short
  type: 'INVALID_TYPE',
  balance: 'not-a-number',
};

const result = validateAccountInput(invalidData);
if (!result.success) {
  const errorMessage = formatValidationError(result.error);
  console.error('Validation errors:', errorMessage);
  // Output: "company_id: Invalid company ID format; name: String must contain at least 1 character(s); type: Invalid enum value; balance: Invalid money format"
}
```

### Wrapped Validation Results

```typescript
import { wrapValidationResult, validateAccountInput } from './utils/validation';

const data = { /* ... */ };
const result = wrapValidationResult(validateAccountInput(data));

if (result.success) {
  // TypeScript knows result.data is defined and typed
  const account = result.data;
  console.log('Account name:', account.name);
} else {
  // TypeScript knows result.error is defined
  console.error('Error:', result.error);
}
```

---

## Security Best Practices

### 1. Always Validate User Input

```typescript
// BAD - No validation
function createAccount(data: any) {
  return db.accounts.add(data);
}

// GOOD - Validate first
function createAccount(data: unknown) {
  const result = validateAccountInput(data);
  if (!result.success) {
    throw new Error(`Invalid account data: ${formatValidationError(result.error)}`);
  }
  return db.accounts.add(result.data);
}
```

### 2. Check for XSS Before Storing

```typescript
// Check all text fields for XSS
function saveUserProfile(profile: unknown) {
  const xssCheck = validateNoXSS(profile);
  if (!xssCheck.success) {
    throw new Error('Input contains potentially malicious content');
  }

  const validation = validateProfileInput(profile);
  if (!validation.success) {
    throw new Error(formatValidationError(validation.error));
  }

  return db.profiles.add(validation.data);
}
```

### 3. Validate on Both Client and Server

```typescript
// Client-side validation (UX)
const handleSubmit = (data: unknown) => {
  const result = validateAccountInput(data);
  if (!result.success) {
    showErrorMessage(formatValidationError(result.error));
    return;
  }

  // Send to server
  submitToAPI(result.data);
};

// Server-side validation (Security)
const apiHandler = (req, res) => {
  const result = validateAccountInput(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: formatValidationError(result.error),
    });
  }

  // Process validated data
  processAccount(result.data);
};
```

### 4. Use Specific Error Messages

```typescript
function processInvoice(data: unknown) {
  const result = validateInvoiceInput(data);

  if (!result.success) {
    // Provide specific, user-friendly error
    const errors = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return {
      success: false,
      errors: errors,
    };
  }

  return {
    success: true,
    invoice: result.data,
  };
}
```

---

## Testing Examples

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { validateAccountInput } from './validation';

describe('Account Validation', () => {
  it('should accept valid account data', () => {
    const validAccount = {
      company_id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Cash',
      type: 'ASSET',
      balance: '0.00',
      active: true,
    };

    const result = validateAccountInput(validAccount);
    expect(result.success).toBe(true);
  });

  it('should reject XSS in account name', () => {
    const malicious = {
      company_id: '123e4567-e89b-12d3-a456-426614174001',
      name: '<script>alert("xss")</script>',
      type: 'ASSET',
      balance: '0.00',
      active: true,
    };

    // XSS detection is separate from schema validation
    const xssCheck = validateNoXSS(malicious);
    expect(xssCheck.success).toBe(false);
  });
});
```

---

## Summary

This validation system provides:

1. **Type Safety**: All inputs validated at runtime with TypeScript types
2. **DoS Prevention**: String length limits prevent memory exhaustion
3. **XSS Protection**: Detects common XSS patterns in user input
4. **Clear Errors**: Formatted error messages for debugging
5. **Comprehensive Coverage**: Schemas for all major entities
6. **Testing Support**: Easy to test with Vitest/Jest

Always validate user input before:
- Storing in database
- Displaying in UI
- Sending to API
- Processing in services
