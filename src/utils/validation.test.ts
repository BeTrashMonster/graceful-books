/**
 * Validation Schema Tests
 *
 * Tests for runtime type validation with Zod
 * Ensures proper validation, XSS detection, and DoS prevention
 */

/* eslint-disable no-script-url */
// Disable no-script-url rule for this test file - we're intentionally testing
// javascript: protocol detection to verify XSS prevention works correctly

import { describe, it, expect } from 'vitest';
import {
  validateAccountInput,
  validateTransactionInput,
  validateTransactionLineItemInput,
  validateCompleteTransaction,
  validateContactInput,
  validateProductInput,
  validateInvoiceInput,
  validateCPGCategoryInput,
  validateCPGDistributorInput,
  validateCPGFinishedProductInput,
  validateCPGRecipeInput,
  detectXSSAttempt,
  validateNoXSS,
  formatValidationError,
} from './validation';

// ============================================================================
// Test Helpers
// ============================================================================

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_COMPANY_ID = '123e4567-e89b-12d3-a456-426614174001';

// ============================================================================
// Account Input Validation Tests
// ============================================================================

describe('AccountInputSchema', () => {
  it('should validate valid account input', () => {
    const validAccount = {
      company_id: VALID_COMPANY_ID,
      name: 'Cash',
      type: 'ASSET',
      parent_id: null,
      account_number: '1000',
      balance: '0.00',
      description: 'Main cash account',
      active: true,
    };

    const result = validateAccountInput(validAccount);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Cash');
    }
  });

  it('should reject account with missing company_id', () => {
    const invalidAccount = {
      name: 'Cash',
      type: 'ASSET',
      balance: '0.00',
      active: true,
    };

    const result = validateAccountInput(invalidAccount);
    expect(result.success).toBe(false);
  });

  it('should reject account with invalid type', () => {
    const invalidAccount = {
      company_id: VALID_COMPANY_ID,
      name: 'Cash',
      type: 'INVALID_TYPE',
      balance: '0.00',
      active: true,
    };

    const result = validateAccountInput(invalidAccount);
    expect(result.success).toBe(false);
  });

  it('should reject account with name exceeding max length', () => {
    const invalidAccount = {
      company_id: VALID_COMPANY_ID,
      name: 'A'.repeat(101), // Exceeds 100 char limit
      type: 'ASSET',
      balance: '0.00',
      active: true,
    };

    const result = validateAccountInput(invalidAccount);
    expect(result.success).toBe(false);
  });

  it('should reject account with invalid balance format', () => {
    const invalidAccount = {
      company_id: VALID_COMPANY_ID,
      name: 'Cash',
      type: 'ASSET',
      balance: 'invalid',
      active: true,
    };

    const result = validateAccountInput(invalidAccount);
    expect(result.success).toBe(false);
  });

  it('should reject account with balance exceeding max value', () => {
    const invalidAccount = {
      company_id: VALID_COMPANY_ID,
      name: 'Cash',
      type: 'ASSET',
      balance: '9999999999.99', // Exceeds max
      active: true,
    };

    const result = validateAccountInput(invalidAccount);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Transaction Input Validation Tests
// ============================================================================

describe('TransactionInputSchema', () => {
  it('should validate valid transaction input', () => {
    const validTransaction = {
      company_id: VALID_COMPANY_ID,
      transaction_number: 'JE-2026-0001',
      transaction_date: Date.now(),
      type: 'JOURNAL_ENTRY',
      status: 'DRAFT',
      description: 'Test transaction',
      reference: 'REF-001',
      memo: 'Test memo',
      attachments: [],
    };

    const result = validateTransactionInput(validTransaction);
    expect(result.success).toBe(true);
  });

  it('should reject transaction with missing required fields', () => {
    const invalidTransaction = {
      company_id: VALID_COMPANY_ID,
      type: 'JOURNAL_ENTRY',
    };

    const result = validateTransactionInput(invalidTransaction);
    expect(result.success).toBe(false);
  });

  it('should reject transaction with too many attachments', () => {
    const invalidTransaction = {
      company_id: VALID_COMPANY_ID,
      transaction_number: 'JE-2026-0001',
      transaction_date: Date.now(),
      type: 'JOURNAL_ENTRY',
      status: 'DRAFT',
      attachments: Array(51).fill('attachment'), // Exceeds max of 50
    };

    const result = validateTransactionInput(invalidTransaction);
    expect(result.success).toBe(false);
  });
});

describe('TransactionLineItemInputSchema', () => {
  it('should validate valid line item with debit', () => {
    const validLineItem = {
      account_id: VALID_UUID,
      debit: '100.00',
      credit: '0.00',
      description: 'Cash received',
      contact_id: null,
      product_id: null,
    };

    const result = validateTransactionLineItemInput(validLineItem);
    expect(result.success).toBe(true);
  });

  it('should validate valid line item with credit', () => {
    const validLineItem = {
      account_id: VALID_UUID,
      debit: '0.00',
      credit: '100.00',
      description: 'Revenue earned',
      contact_id: null,
      product_id: null,
    };

    const result = validateTransactionLineItemInput(validLineItem);
    expect(result.success).toBe(true);
  });

  it('should reject line item with both debit and credit', () => {
    const invalidLineItem = {
      account_id: VALID_UUID,
      debit: '100.00',
      credit: '100.00',
      description: 'Invalid',
      contact_id: null,
      product_id: null,
    };

    const result = validateTransactionLineItemInput(invalidLineItem);
    expect(result.success).toBe(false);
  });

  it('should reject line item with neither debit nor credit', () => {
    const invalidLineItem = {
      account_id: VALID_UUID,
      debit: '0.00',
      credit: '0.00',
      description: 'Invalid',
      contact_id: null,
      product_id: null,
    };

    const result = validateTransactionLineItemInput(invalidLineItem);
    expect(result.success).toBe(false);
  });
});

describe('validateCompleteTransaction', () => {
  it('should validate balanced transaction', () => {
    const transaction = {
      company_id: VALID_COMPANY_ID,
      transaction_number: 'JE-2026-0001',
      transaction_date: Date.now(),
      type: 'JOURNAL_ENTRY',
      status: 'DRAFT',
      description: 'Test',
      reference: null,
      memo: null,
      attachments: [],
    };

    const lineItems = [
      {
        account_id: VALID_UUID,
        debit: '100.00',
        credit: '0.00',
        description: 'Cash',
        contact_id: null,
        product_id: null,
      },
      {
        account_id: VALID_UUID,
        debit: '0.00',
        credit: '100.00',
        description: 'Revenue',
        contact_id: null,
        product_id: null,
      },
    ];

    const result = validateCompleteTransaction(transaction, lineItems);
    expect(result.success).toBe(true);
  });

  it('should reject unbalanced transaction', () => {
    const transaction = {
      company_id: VALID_COMPANY_ID,
      transaction_number: 'JE-2026-0001',
      transaction_date: Date.now(),
      type: 'JOURNAL_ENTRY',
      status: 'DRAFT',
      description: 'Test',
      reference: null,
      memo: null,
      attachments: [],
    };

    const lineItems = [
      {
        account_id: VALID_UUID,
        debit: '100.00',
        credit: '0.00',
        description: 'Cash',
        contact_id: null,
        product_id: null,
      },
      {
        account_id: VALID_UUID,
        debit: '0.00',
        credit: '50.00', // Not balanced!
        description: 'Revenue',
        contact_id: null,
        product_id: null,
      },
    ];

    const result = validateCompleteTransaction(transaction, lineItems);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Contact Input Validation Tests
// ============================================================================

describe('ContactInputSchema', () => {
  it('should validate valid contact input', () => {
    const validContact = {
      company_id: VALID_COMPANY_ID,
      type: 'CUSTOMER',
      name: 'Acme Corp',
      email: 'contact@acme.com',
      phone: '+1-555-1234',
      address: '123 Main St',
      tax_id: '12-3456789',
      notes: 'Important customer',
      active: true,
      balance: '0.00',
      parent_id: null,
      account_type: 'STANDALONE',
      hierarchy_level: 0,
    };

    const result = validateContactInput(validContact);
    expect(result.success).toBe(true);
  });

  it('should reject contact with invalid email', () => {
    const invalidContact = {
      company_id: VALID_COMPANY_ID,
      type: 'CUSTOMER',
      name: 'Acme Corp',
      email: 'not-an-email',
      phone: null,
      address: null,
      tax_id: null,
      notes: null,
      active: true,
      balance: '0.00',
      parent_id: null,
      account_type: 'STANDALONE',
      hierarchy_level: 0,
    };

    const result = validateContactInput(invalidContact);
    expect(result.success).toBe(false);
  });

  it('should reject contact with invalid phone format', () => {
    const invalidContact = {
      company_id: VALID_COMPANY_ID,
      type: 'CUSTOMER',
      name: 'Acme Corp',
      email: null,
      phone: 'ABC-DEF-GHIJ', // Invalid characters
      address: null,
      tax_id: null,
      notes: null,
      active: true,
      balance: '0.00',
      parent_id: null,
      account_type: 'STANDALONE',
      hierarchy_level: 0,
    };

    const result = validateContactInput(invalidContact);
    expect(result.success).toBe(false);
  });

  it('should accept null email and phone', () => {
    const validContact = {
      company_id: VALID_COMPANY_ID,
      type: 'VENDOR',
      name: 'Vendor Inc',
      email: null,
      phone: null,
      address: null,
      tax_id: null,
      notes: null,
      active: true,
      balance: '0.00',
      parent_id: null,
      account_type: 'STANDALONE',
      hierarchy_level: 0,
    };

    const result = validateContactInput(validContact);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Product Input Validation Tests
// ============================================================================

describe('ProductInputSchema', () => {
  it('should validate valid product input', () => {
    const validProduct = {
      company_id: VALID_COMPANY_ID,
      type: 'PRODUCT',
      sku: 'PROD-001',
      name: 'Widget',
      description: 'Standard widget',
      unit_price: '10.00',
      cost: '5.00',
      income_account_id: VALID_UUID,
      expense_account_id: VALID_UUID,
      taxable: true,
      active: true,
    };

    const result = validateProductInput(validProduct);
    expect(result.success).toBe(true);
  });

  it('should validate service with null cost', () => {
    const validService = {
      company_id: VALID_COMPANY_ID,
      type: 'SERVICE',
      sku: null,
      name: 'Consulting',
      description: 'Hourly consulting',
      unit_price: '100.00',
      cost: null, // Services may not have cost
      income_account_id: VALID_UUID,
      expense_account_id: null,
      taxable: true,
      active: true,
    };

    const result = validateProductInput(validService);
    expect(result.success).toBe(true);
  });

  it('should reject product with negative price', () => {
    const invalidProduct = {
      company_id: VALID_COMPANY_ID,
      type: 'PRODUCT',
      sku: 'PROD-001',
      name: 'Widget',
      description: null,
      unit_price: '-10.00',
      cost: null,
      income_account_id: null,
      expense_account_id: null,
      taxable: true,
      active: true,
    };

    const result = validateProductInput(invalidProduct);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Invoice Input Validation Tests
// ============================================================================

describe('InvoiceInputSchema', () => {
  it('should validate valid invoice input', () => {
    const now = Date.now();
    const validInvoice = {
      company_id: VALID_COMPANY_ID,
      customer_id: VALID_UUID,
      invoice_number: 'INV-2026-0001',
      invoice_date: now,
      due_date: now + 30 * 24 * 60 * 60 * 1000,
      status: 'DRAFT',
      subtotal: '100.00',
      tax: '10.00',
      total: '110.00',
      notes: 'Thank you for your business',
      internal_memo: 'Rush order',
      template_id: 'classic',
      line_items: [
        {
          id: VALID_UUID,
          description: 'Consulting Services',
          quantity: 2,
          unitPrice: '50.00',
          accountId: VALID_UUID,
          total: '100.00',
        },
      ],
      transaction_id: null,
    };

    const result = validateInvoiceInput(validInvoice);
    expect(result.success).toBe(true);
  });

  it('should reject invoice with due_date before invoice_date', () => {
    const now = Date.now();
    const invalidInvoice = {
      company_id: VALID_COMPANY_ID,
      customer_id: VALID_UUID,
      invoice_number: 'INV-2026-0001',
      invoice_date: now,
      due_date: now - 1000, // Before invoice date
      status: 'DRAFT',
      subtotal: '100.00',
      tax: '0.00',
      total: '100.00',
      notes: null,
      internal_memo: null,
      template_id: 'classic',
      line_items: [
        {
          id: VALID_UUID,
          description: 'Test',
          quantity: 1,
          unitPrice: '100.00',
          accountId: VALID_UUID,
          total: '100.00',
        },
      ],
      transaction_id: null,
    };

    const result = validateInvoiceInput(invalidInvoice);
    expect(result.success).toBe(false);
  });

  it('should reject invoice with no line items', () => {
    const now = Date.now();
    const invalidInvoice = {
      company_id: VALID_COMPANY_ID,
      customer_id: VALID_UUID,
      invoice_number: 'INV-2026-0001',
      invoice_date: now,
      due_date: now + 30 * 24 * 60 * 60 * 1000,
      status: 'DRAFT',
      subtotal: '0.00',
      tax: '0.00',
      total: '0.00',
      notes: null,
      internal_memo: null,
      template_id: 'classic',
      line_items: [], // No line items
      transaction_id: null,
    };

    const result = validateInvoiceInput(invalidInvoice);
    expect(result.success).toBe(false);
  });

  it('should reject invoice with too many line items', () => {
    const now = Date.now();
    const invalidInvoice = {
      company_id: VALID_COMPANY_ID,
      customer_id: VALID_UUID,
      invoice_number: 'INV-2026-0001',
      invoice_date: now,
      due_date: now + 30 * 24 * 60 * 60 * 1000,
      status: 'DRAFT',
      subtotal: '100.00',
      tax: '0.00',
      total: '100.00',
      notes: null,
      internal_memo: null,
      template_id: 'classic',
      line_items: Array(101).fill({
        id: VALID_UUID,
        description: 'Item',
        quantity: 1,
        unitPrice: '1.00',
        accountId: VALID_UUID,
        total: '1.00',
      }), // Exceeds max of 100
      transaction_id: null,
    };

    const result = validateInvoiceInput(invalidInvoice);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// CPG Entity Validation Tests
// ============================================================================

describe('CPGCategoryInputSchema', () => {
  it('should validate valid CPG category', () => {
    const validCategory = {
      company_id: VALID_COMPANY_ID,
      name: 'Oil',
      description: 'Essential oils',
      variants: ['1oz', '2oz', '4oz'],
      unit_of_measure: 'oz',
      sort_order: 1,
      active: true,
    };

    const result = validateCPGCategoryInput(validCategory);
    expect(result.success).toBe(true);
  });

  it('should accept null variants', () => {
    const validCategory = {
      company_id: VALID_COMPANY_ID,
      name: 'Box',
      description: null,
      variants: null, // No variants
      unit_of_measure: 'each',
      sort_order: 2,
      active: true,
    };

    const result = validateCPGCategoryInput(validCategory);
    expect(result.success).toBe(true);
  });
});

describe('CPGDistributorInputSchema', () => {
  it('should validate valid CPG distributor', () => {
    const validDistributor = {
      company_id: VALID_COMPANY_ID,
      name: 'UNFI',
      description: 'National distributor',
      contact_info: 'contact@unfi.com',
      linked_contact_id: null,
      fee_structure: [
        {
          id: VALID_UUID,
          description: 'Pallet fee',
          amount: '45.00',
          unit: 'per_pallet',
        },
      ],
      last_fee_update_date: Date.now(),
      typical_update_frequency: 'quarterly',
      active: true,
    };

    const result = validateCPGDistributorInput(validDistributor);
    expect(result.success).toBe(true);
  });
});

describe('CPGFinishedProductInputSchema', () => {
  it('should validate valid CPG finished product', () => {
    const validProduct = {
      company_id: VALID_COMPANY_ID,
      name: '1oz Body Oil',
      description: 'Lavender body oil',
      sku: 'BO-1OZ',
      msrp: '12.00',
      unit_of_measure: 'each',
      pieces_per_unit: 1,
      active: true,
    };

    const result = validateCPGFinishedProductInput(validProduct);
    expect(result.success).toBe(true);
  });

  it('should reject product with zero pieces_per_unit', () => {
    const invalidProduct = {
      company_id: VALID_COMPANY_ID,
      name: 'Product',
      description: null,
      sku: null,
      msrp: null,
      unit_of_measure: 'each',
      pieces_per_unit: 0, // Invalid
      active: true,
    };

    const result = validateCPGFinishedProductInput(invalidProduct);
    expect(result.success).toBe(false);
  });
});

describe('CPGRecipeInputSchema', () => {
  it('should validate valid CPG recipe', () => {
    const validRecipe = {
      company_id: VALID_COMPANY_ID,
      finished_product_id: VALID_UUID,
      category_id: VALID_UUID,
      variant: '1oz',
      quantity: '1.00',
      notes: 'Use premium oil',
      active: true,
    };

    const result = validateCPGRecipeInput(validRecipe);
    expect(result.success).toBe(true);
  });

  it('should reject recipe with zero quantity', () => {
    const invalidRecipe = {
      company_id: VALID_COMPANY_ID,
      finished_product_id: VALID_UUID,
      category_id: VALID_UUID,
      variant: null,
      quantity: '0', // Invalid
      notes: null,
      active: true,
    };

    const result = validateCPGRecipeInput(invalidRecipe);
    expect(result.success).toBe(false);
  });

  it('should reject recipe with negative quantity', () => {
    const invalidRecipe = {
      company_id: VALID_COMPANY_ID,
      finished_product_id: VALID_UUID,
      category_id: VALID_UUID,
      variant: null,
      quantity: '-1.00', // Invalid
      notes: null,
      active: true,
    };

    const result = validateCPGRecipeInput(invalidRecipe);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// XSS Detection Tests
// ============================================================================

describe('detectXSSAttempt', () => {
  it('should detect script tag', () => {
    expect(detectXSSAttempt('<script>alert("xss")</script>')).toBe(true);
  });

  it('should detect javascript protocol', () => {
    expect(detectXSSAttempt('javascript:alert("xss")')).toBe(true);
  });

  it('should detect onerror attribute', () => {
    expect(detectXSSAttempt('<img src=x onerror=alert("xss")>')).toBe(true);
  });

  it('should detect onload attribute', () => {
    expect(detectXSSAttempt('<body onload=alert("xss")>')).toBe(true);
  });

  it('should detect iframe tag', () => {
    expect(detectXSSAttempt('<iframe src="evil.com"></iframe>')).toBe(true);
  });

  it('should detect eval function', () => {
    expect(detectXSSAttempt('eval(maliciousCode)')).toBe(true);
  });

  it('should not detect normal text', () => {
    expect(detectXSSAttempt('This is normal text')).toBe(false);
  });

  it('should not detect HTML entities', () => {
    expect(detectXSSAttempt('&lt;script&gt;')).toBe(false);
  });
});

describe('validateNoXSS', () => {
  it('should validate clean string', () => {
    const result = validateNoXSS('Hello World');
    expect(result.success).toBe(true);
  });

  it('should detect XSS in string', () => {
    const result = validateNoXSS('<script>alert("xss")</script>');
    expect(result.success).toBe(false);
  });

  it('should validate clean object', () => {
    const result = validateNoXSS({
      name: 'John Doe',
      email: 'john@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('should detect XSS in object property', () => {
    const result = validateNoXSS({
      name: 'John Doe',
      bio: '<script>alert("xss")</script>',
    });
    expect(result.success).toBe(false);
  });

  it('should validate clean array', () => {
    const result = validateNoXSS(['item1', 'item2', 'item3']);
    expect(result.success).toBe(true);
  });

  it('should detect XSS in array item', () => {
    const result = validateNoXSS([
      'item1',
      '<img src=x onerror=alert(1)>',
      'item3',
    ]);
    expect(result.success).toBe(false);
  });

  it('should validate nested object', () => {
    const result = validateNoXSS({
      user: {
        name: 'John',
        profile: {
          bio: 'Software developer',
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('should detect XSS in nested object', () => {
    const result = validateNoXSS({
      user: {
        name: 'John',
        profile: {
          bio: 'Software developer <script>alert(1)</script>',
        },
      },
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Error Formatting Tests
// ============================================================================

describe('formatValidationError', () => {
  it('should format validation errors', () => {
    const invalidData = {
      name: '', // Too short
      email: 'not-an-email',
    };

    const result = validateContactInput({
      ...invalidData,
      company_id: VALID_COMPANY_ID,
      type: 'CUSTOMER',
      phone: null,
      address: null,
      tax_id: null,
      notes: null,
      active: true,
      balance: '0.00',
      parent_id: null,
      account_type: 'STANDALONE',
      hierarchy_level: 0,
    });

    if (!result.success) {
      const errorMessage = formatValidationError(result.error);
      expect(errorMessage).toBeTruthy();
      expect(typeof errorMessage).toBe('string');
    }
  });
});
