/**
 * Runtime Type Validation with Zod
 *
 * Provides runtime validation schemas for all major entities to prevent
 * XSS, injection attacks, and data integrity issues.
 *
 * Security Features:
 * - String length limits to prevent DoS attacks
 * - Type coercion disabled to prevent unexpected conversions
 * - Strict validation for all user inputs
 * - Clear error messages for debugging
 *
 * Requirements:
 * - S4-5: Input Validation with Zod
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import { z } from 'zod';

// ============================================================================
// Common Field Schemas
// ============================================================================

/**
 * Company ID validation
 * UUIDs are 36 characters (including hyphens), but also allow demo/test IDs
 */
const companyIdSchema = z.string().min(1, 'Company ID is required').max(100, 'Company ID too long');

/**
 * UUID validation for entity IDs
 * UUIDs are 36 characters, but also allow demo/test IDs and short identifiers
 */
const uuidSchema = z.string().min(1, 'ID is required').max(100, 'ID too long');

/**
 * Decimal string for monetary values
 * Format: digits with optional decimal point and up to 2 decimal places
 * Max value: 999,999,999.99 (prevents overflow)
 */
const moneySchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Invalid money format')
  .refine((val) => parseFloat(val) <= 999999999.99, {
    message: 'Amount exceeds maximum allowed value',
  });

/**
 * Date validation (Unix timestamp in milliseconds)
 */
const timestampSchema = z.number().int().positive();

/**
 * Email validation
 * Max length: 254 characters (RFC 5321)
 */
const emailSchema = z
  .string()
  .max(254, 'Email exceeds maximum length')
  .email('Invalid email format')
  .or(z.null());

/**
 * Phone validation
 * Allows various formats, max 20 characters
 */
const phoneSchema = z
  .string()
  .max(20, 'Phone number exceeds maximum length')
  .regex(/^[\d\s\-()"+.]+$/, 'Phone contains invalid characters')
  .or(z.null());

/**
 * Text field validation with DoS protection
 */
const shortTextSchema = z.string().min(1).max(100, 'Text exceeds maximum length');
const mediumTextSchema = z.string().max(500, 'Text exceeds maximum length');
const _longTextSchema = z.string().max(5000, 'Text exceeds maximum length');

/**
 * Optional text field validation
 */
const _optionalShortTextSchema = z.string().max(100).or(z.null()).optional();
const optionalMediumTextSchema = z.string().max(500).or(z.null()).optional();
const optionalLongTextSchema = z.string().max(5000).or(z.null()).optional();

// ============================================================================
// Account Input Schema
// ============================================================================

/**
 * Account type enum
 */
const AccountTypeSchema = z.enum([
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'INCOME',
  'EXPENSE',
  'COGS',
  'OTHER_INCOME',
  'OTHER_EXPENSE',
]);

/**
 * Account input validation schema
 * Used for creating and updating accounts
 */
export const AccountInputSchema = z.object({
  company_id: companyIdSchema,
  name: shortTextSchema,
  type: AccountTypeSchema,
  parent_id: uuidSchema.or(z.null()),
  account_number: z.string().max(20).or(z.null()),
  balance: moneySchema,
  description: optionalMediumTextSchema,
  active: z.boolean(),
});

export type AccountInput = z.infer<typeof AccountInputSchema>;

/**
 * Validate account input data
 * Returns success/failure with typed data or errors
 */
export function validateAccountInput(data: unknown) {
  return AccountInputSchema.safeParse(data);
}

// ============================================================================
// Transaction Input Schema
// ============================================================================

/**
 * Transaction type enum
 */
const TransactionTypeSchema = z.enum([
  'JOURNAL_ENTRY',
  'INVOICE',
  'PAYMENT',
  'EXPENSE',
  'BILL',
  'CREDIT_NOTE',
  'ADJUSTMENT',
  'BARTER',
]);

/**
 * Transaction status enum
 */
const TransactionStatusSchema = z.enum(['DRAFT', 'POSTED', 'VOID']);

/**
 * Transaction line item validation
 */
export const TransactionLineItemInputSchema = z
  .object({
    account_id: uuidSchema,
    debit: moneySchema,
    credit: moneySchema,
    description: optionalMediumTextSchema,
    contact_id: uuidSchema.or(z.null()),
    product_id: uuidSchema.or(z.null()),
  })
  .refine(
    (data) => {
      const debit = parseFloat(data.debit);
      const credit = parseFloat(data.credit);
      // Either debit or credit must be non-zero, but not both
      return (debit > 0 && credit === 0) || (debit === 0 && credit > 0);
    },
    {
      message: 'Line item must have either debit or credit, but not both',
    }
  );

export type TransactionLineItemInput = z.infer<typeof TransactionLineItemInputSchema>;

/**
 * Transaction input validation schema
 */
export const TransactionInputSchema = z.object({
  company_id: companyIdSchema,
  transaction_number: z.string().min(1).max(50),
  transaction_date: timestampSchema,
  type: TransactionTypeSchema,
  status: TransactionStatusSchema,
  description: optionalMediumTextSchema,
  reference: z.string().max(100).or(z.null()),
  memo: optionalLongTextSchema,
  attachments: z.array(z.string().max(500)).max(50), // Max 50 attachments
});

export type TransactionInput = z.infer<typeof TransactionInputSchema>;

/**
 * Validate transaction input data
 */
export function validateTransactionInput(data: unknown) {
  return TransactionInputSchema.safeParse(data);
}

/**
 * Validate transaction line item data
 */
export function validateTransactionLineItemInput(data: unknown) {
  return TransactionLineItemInputSchema.safeParse(data);
}

/**
 * Validate complete transaction with line items
 * Ensures debits equal credits
 */
export function validateCompleteTransaction(
  transaction: unknown,
  lineItems: unknown[]
) {
  // Validate transaction header
  const txnResult = TransactionInputSchema.safeParse(transaction);
  if (!txnResult.success) {
    return {
      success: false,
      error: txnResult.error,
    };
  }

  // Validate all line items
  const lineItemResults = lineItems.map((item) =>
    TransactionLineItemInputSchema.safeParse(item)
  );
  const failedItems = lineItemResults.filter((r) => !r.success);
  if (failedItems.length > 0) {
    return {
      success: false,
      error: failedItems[0]?.error || 'Validation failed',
    };
  }

  // Validate balance (debits = credits)
  let totalDebits = 0;
  let totalCredits = 0;
  for (const item of lineItems) {
    const parsed = item as TransactionLineItemInput;
    totalDebits += parseFloat(parsed.debit);
    totalCredits += parseFloat(parsed.credit);
  }

  const difference = Math.abs(totalDebits - totalCredits);
  if (difference >= 0.01) {
    return {
      success: false,
      error: new Error(
        `Transaction is not balanced. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}`
      ),
    };
  }

  return {
    success: true,
    data: {
      transaction: txnResult.data,
      lineItems: lineItemResults.map((r) => r.data),
    },
  };
}

// ============================================================================
// Contact Input Schema
// ============================================================================

/**
 * Contact type enum
 */
const ContactTypeSchema = z.enum(['CUSTOMER', 'VENDOR', 'BOTH']);

/**
 * Contact account type enum (for hierarchical contacts)
 */
const ContactAccountTypeSchema = z.enum(['STANDALONE', 'PARENT', 'SUB_ACCOUNT']);

/**
 * Contact input validation schema
 */
export const ContactInputSchema = z.object({
  company_id: companyIdSchema,
  type: ContactTypeSchema,
  name: shortTextSchema,
  email: emailSchema,
  phone: phoneSchema,
  address: optionalLongTextSchema,
  tax_id: z.string().max(50).or(z.null()),
  notes: optionalLongTextSchema,
  active: z.boolean(),
  balance: moneySchema,
  parent_id: uuidSchema.or(z.null()),
  account_type: ContactAccountTypeSchema,
  hierarchy_level: z.number().int().min(0).max(10),
});

export type ContactInput = z.infer<typeof ContactInputSchema>;

/**
 * Validate contact input data
 */
export function validateContactInput(data: unknown) {
  return ContactInputSchema.safeParse(data);
}

// ============================================================================
// Product Input Schema
// ============================================================================

/**
 * Product type enum
 */
const ProductTypeSchema = z.enum(['PRODUCT', 'SERVICE']);

/**
 * Product input validation schema
 */
export const ProductInputSchema = z.object({
  company_id: companyIdSchema,
  type: ProductTypeSchema,
  sku: z.string().max(50).or(z.null()),
  name: shortTextSchema,
  description: optionalMediumTextSchema,
  unit_price: moneySchema,
  cost: moneySchema.or(z.null()),
  income_account_id: uuidSchema.or(z.null()),
  expense_account_id: uuidSchema.or(z.null()),
  taxable: z.boolean(),
  active: z.boolean(),
});

export type ProductInput = z.infer<typeof ProductInputSchema>;

/**
 * Validate product input data
 */
export function validateProductInput(data: unknown) {
  return ProductInputSchema.safeParse(data);
}

// ============================================================================
// Invoice Input Schema
// ============================================================================

/**
 * Invoice status enum
 */
const InvoiceStatusSchema = z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID']);

/**
 * Invoice line item validation
 */
export const InvoiceLineItemInputSchema = z.object({
  id: uuidSchema,
  description: mediumTextSchema,
  quantity: z.number().positive().max(999999),
  unitPrice: moneySchema,
  accountId: uuidSchema,
  total: moneySchema,
});

export type InvoiceLineItemInput = z.infer<typeof InvoiceLineItemInputSchema>;

/**
 * Invoice input validation schema
 */
export const InvoiceInputSchema = z
  .object({
    company_id: companyIdSchema,
    customer_id: uuidSchema,
    invoice_number: z.string().min(1).max(50),
    invoice_date: timestampSchema,
    due_date: timestampSchema,
    status: InvoiceStatusSchema,
    subtotal: moneySchema,
    tax: moneySchema,
    total: moneySchema,
    notes: optionalLongTextSchema,
    internal_memo: optionalLongTextSchema,
    template_id: z.string().min(1).max(50),
    line_items: z.array(InvoiceLineItemInputSchema).min(1).max(100), // Max 100 line items
    transaction_id: uuidSchema.or(z.null()),
  })
  .refine((data) => data.due_date >= data.invoice_date, {
    message: 'Due date must be on or after invoice date',
  });

export type InvoiceInput = z.infer<typeof InvoiceInputSchema>;

/**
 * Validate invoice input data
 */
export function validateInvoiceInput(data: unknown) {
  return InvoiceInputSchema.safeParse(data);
}

/**
 * Validate invoice line item data
 */
export function validateInvoiceLineItemInput(data: unknown) {
  return InvoiceLineItemInputSchema.safeParse(data);
}

// ============================================================================
// CPG Entity Schemas
// ============================================================================

/**
 * CPG Category input validation
 */
export const CPGCategoryInputSchema = z.object({
  company_id: companyIdSchema,
  name: shortTextSchema,
  description: optionalMediumTextSchema,
  variants: z.array(z.string().max(50)).max(50).or(z.null()),
  unit_of_measure: z.string().min(1).max(20),
  sort_order: z.number().int().min(0).max(9999),
  active: z.boolean(),
});

export type CPGCategoryInput = z.infer<typeof CPGCategoryInputSchema>;

export function validateCPGCategoryInput(data: unknown) {
  return CPGCategoryInputSchema.safeParse(data);
}

/**
 * CPG Distributor fee structure validation
 */
const CPGDistributorFeeSchema = z.object({
  id: uuidSchema,
  description: mediumTextSchema,
  amount: moneySchema,
  unit: z.enum([
    'per_pallet',
    'per_case',
    'per_day_full',
    'per_day_half',
    'per_shipment',
    'per_zone',
    'flat_fee',
    'percentage',
  ]),
  percentage_basis: z
    .enum(['product_value', 'distribution_cost', 'discount'])
    .optional(),
});

/**
 * CPG Distributor input validation
 */
export const CPGDistributorInputSchema = z.object({
  company_id: companyIdSchema,
  name: shortTextSchema,
  description: optionalMediumTextSchema,
  contact_info: optionalMediumTextSchema,
  linked_contact_id: uuidSchema.or(z.null()),
  fee_structure: z.array(CPGDistributorFeeSchema).max(50), // Max 50 fees
  last_fee_update_date: timestampSchema.or(z.null()),
  typical_update_frequency: z
    .enum(['weekly', 'monthly', 'quarterly', 'annually'])
    .or(z.null()),
  active: z.boolean(),
});

export type CPGDistributorInput = z.infer<typeof CPGDistributorInputSchema>;

export function validateCPGDistributorInput(data: unknown) {
  return CPGDistributorInputSchema.safeParse(data);
}

/**
 * CPG Finished Product input validation
 */
export const CPGFinishedProductInputSchema = z.object({
  company_id: companyIdSchema,
  name: shortTextSchema,
  description: optionalMediumTextSchema,
  sku: z.string().max(50).or(z.null()),
  msrp: moneySchema.or(z.null()),
  unit_of_measure: z.string().min(1).max(20),
  pieces_per_unit: z.number().int().min(1).max(999999),
  active: z.boolean(),
});

export type CPGFinishedProductInput = z.infer<typeof CPGFinishedProductInputSchema>;

export function validateCPGFinishedProductInput(data: unknown) {
  return CPGFinishedProductInputSchema.safeParse(data);
}

/**
 * CPG Recipe input validation
 */
export const CPGRecipeInputSchema = z.object({
  company_id: companyIdSchema,
  finished_product_id: uuidSchema,
  category_id: uuidSchema,
  variant: z.string().max(50).or(z.null()),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, 'Invalid quantity format')
    .refine((val) => parseFloat(val) > 0, {
      message: 'Quantity must be greater than 0',
    }),
  notes: optionalMediumTextSchema,
  active: z.boolean(),
});

export type CPGRecipeInput = z.infer<typeof CPGRecipeInputSchema>;

export function validateCPGRecipeInput(data: unknown) {
  return CPGRecipeInputSchema.safeParse(data);
}

// ============================================================================
// XSS Prevention Helpers
// ============================================================================

/**
 * Test data against common XSS payloads
 * Returns true if XSS attempt detected
 */
export function detectXSSAttempt(value: string): boolean {
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onload=/i,
    /onclick=/i,
    /onmouseover=/i,
    /<iframe/i,
    /<embed/i,
    /<object/i,
    /eval\(/i,
    /expression\(/i,
  ];

  return xssPatterns.some((pattern) => pattern.test(value));
}

/**
 * Validate string does not contain XSS payloads
 */
export const xssSafeStringSchema = z.string().refine(
  (val) => !detectXSSAttempt(val),
  {
    message: 'Input contains potentially malicious content',
  }
);

/**
 * Sanitize object by checking all string fields for XSS
 */
export function validateNoXSS(data: unknown): {
  success: boolean;
  error?: string;
} {
  if (typeof data === 'string') {
    if (detectXSSAttempt(data)) {
      return {
        success: false,
        error: 'Input contains potentially malicious content',
      };
    }
    return { success: true };
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const result = validateNoXSS(item);
      if (!result.success) {
        return result;
      }
    }
    return { success: true };
  }

  if (typeof data === 'object' && data !== null) {
    for (const value of Object.values(data)) {
      const result = validateNoXSS(value);
      if (!result.success) {
        return result;
      }
    }
    return { success: true };
  }

  return { success: true };
}

// ============================================================================
// CPG Calculation Validation Schemas (S6-4)
// ============================================================================

/**
 * Positive decimal string validation with max bounds
 * Used for quantities, prices, and other positive numeric values
 */
const positiveDecimalSchema = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, 'Must be a positive number with up to 6 decimal places')
  .refine((val) => parseFloat(val) > 0, {
    message: 'Must be greater than 0',
  })
  .refine((val) => parseFloat(val) <= 1000000, {
    message: 'Value exceeds maximum allowed (1,000,000)',
  });

/**
 * Non-negative decimal string validation
 * Used for values that can be zero (like discounts)
 */
const nonNegativeDecimalSchema = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, 'Must be a non-negative number with up to 6 decimal places')
  .refine((val) => parseFloat(val) >= 0, {
    message: 'Cannot be negative',
  })
  .refine((val) => parseFloat(val) <= 1000000, {
    message: 'Value exceeds maximum allowed (1,000,000)',
  });

/**
 * Percentage validation (0-100)
 */
const percentageSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a number with up to 2 decimal places')
  .refine((val) => {
    const num = parseFloat(val);
    return num >= 0 && num <= 100;
  }, {
    message: 'Percentage must be between 0 and 100',
  });

/**
 * Percentage validation (0-10000) for markup percentages
 * Some businesses use very high markups, so we allow up to 10,000%
 */
const markupPercentageSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a number with up to 2 decimal places')
  .refine((val) => {
    const num = parseFloat(val);
    return num >= 0 && num <= 10000;
  }, {
    message: 'Markup percentage must be between 0 and 10,000',
  });

/**
 * CPG Distributor Fee validation
 */
export const CPGDistributorFeeValidationSchema = z.object({
  id: uuidSchema,
  description: mediumTextSchema,
  amount: positiveDecimalSchema,
  unit: z.enum([
    'per_pallet',
    'per_case',
    'per_day_full',
    'per_day_half',
    'per_shipment',
    'per_zone',
    'flat_fee',
    'percentage',
  ]),
  percentage_basis: z
    .enum(['product_value', 'distribution_cost', 'discount'])
    .optional(),
});

/**
 * Distribution calculation input validation
 */
export const DistributionCalcParamsSchema = z
  .object({
    distributorId: uuidSchema,
    numPallets: positiveDecimalSchema,
    unitsPerPallet: positiveDecimalSchema,
    pallet_data: z
      .array(
        z.object({
          pallet_number: z.number().int().positive().max(1000),
          units_per_pallet: z.number().int().positive().max(100000),
          products: z
            .array(
              z.object({
                product_name: shortTextSchema,
                quantity: z.number().int().positive().max(100000),
                price_per_unit: positiveDecimalSchema,
                base_cpu: nonNegativeDecimalSchema,
              })
            )
            .min(1, 'Each pallet must have at least one product')
            .max(100, 'Maximum 100 products per pallet'),
        })
      )
      .max(100, 'Maximum 100 pallets per calculation'),
    variantData: z
      .record(
        z.string().min(1).max(50),
        z.object({
          price_per_unit: positiveDecimalSchema,
          base_cpu: nonNegativeDecimalSchema,
          quantity: z.number().int().nonnegative().max(1000000),
        })
      )
      .refine((data) => Object.keys(data).length > 0, {
        message: 'At least one variant is required',
      }),
    selectedFees: z
      .array(
        z.object({
          feeId: uuidSchema,
          description: mediumTextSchema,
          amount: positiveDecimalSchema,
          unit: z.enum([
            'per_pallet',
            'per_case',
            'per_day_full',
            'per_day_half',
            'per_shipment',
            'per_zone',
            'flat_fee',
            'percentage',
          ]),
          quantity: positiveDecimalSchema.optional(),
          percentage_basis: z
            .enum(['product_value', 'distribution_cost', 'discount'])
            .optional(),
        })
      )
      .max(100, 'Maximum 100 fees per calculation'),
    msrpMarkupPercentage: markupPercentageSchema.nullish(),
  })
  .refine(
    (data) => {
      // Ensure pallet_data matches numPallets
      const numPallets = parseInt(data.numPallets, 10);
      return !data.pallet_data || data.pallet_data.length === 0 || data.pallet_data.length === numPallets;
    },
    {
      message: 'Number of pallets in pallet_data must match numPallets',
    }
  );

export type DistributionCalcParamsInput = z.infer<typeof DistributionCalcParamsSchema>;

/**
 * Sales promo analysis input validation
 */
export const PromoAnalysisParamsSchema = z.object({
  promoId: uuidSchema,
  variantPromoData: z
    .record(
      z.string().min(1).max(50),
      z.object({
        retailPrice: positiveDecimalSchema,
        unitsAvailable: positiveDecimalSchema,
        baseCPU: nonNegativeDecimalSchema,
      })
    )
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one variant is required',
    })
    .refine((data) => Object.keys(data).length <= 100, {
      message: 'Maximum 100 variants per promo',
    }),
});

export type PromoAnalysisParamsInput = z.infer<typeof PromoAnalysisParamsSchema>;

/**
 * Sales promo creation input validation
 */
export const CreatePromoParamsSchema = z.object({
  companyId: companyIdSchema,
  promoName: shortTextSchema,
  retailerName: shortTextSchema.optional(),
  promoStartDate: timestampSchema.optional(),
  promoEndDate: timestampSchema.optional(),
  storeSalePercentage: percentageSchema,
  producerPaybackPercentage: percentageSchema,
  demoHoursEntries: z
    .array(
      z.object({
        id: uuidSchema,
        roleId: z.string().max(100), // Role ID or 'custom'
        roleName: z.string().max(100), // Role name for display
        hours: positiveDecimalSchema.refine((val) => parseFloat(val) <= 1000, {
          message: 'Hours cannot exceed 1,000',
        }),
        hourlyRate: positiveDecimalSchema.refine((val) => parseFloat(val) <= 10000, {
          message: 'Hourly rate cannot exceed $10,000',
        }),
        costType: z.enum(['actual', 'opportunity']),
      })
    )
    .max(50, 'Maximum 50 demo hours entries')
    .optional(),
  notes: optionalLongTextSchema,
});

export type CreatePromoParamsInput = z.infer<typeof CreatePromoParamsSchema>;

/**
 * CPG Invoice creation input validation
 */
export const CPGInvoiceInputSchema = z.object({
  company_id: companyIdSchema,
  invoice_number: z.string().max(50).optional(),
  invoice_date: timestampSchema,
  vendor_name: z.string().max(100).optional(),
  notes: optionalLongTextSchema,
  cost_attribution: z
    .record(
      z.string().min(1).max(100),
      z.object({
        category_id: uuidSchema,
        variant: z.string().max(50).nullable(),
        units_purchased: positiveDecimalSchema,
        unit_price: nonNegativeDecimalSchema,
        units_received: positiveDecimalSchema.optional(),
      })
    )
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one cost attribution entry is required',
    })
    .refine((data) => Object.keys(data).length <= 500, {
      message: 'Maximum 500 line items per invoice',
    }),
  additional_costs: z
    .record(z.string().max(100), nonNegativeDecimalSchema)
    .refine((data) => Object.keys(data).length <= 100, {
      message: 'Maximum 100 additional cost entries',
    })
    .optional(),
  device_id: z.string().min(1),
});

export type CPGInvoiceInput = z.infer<typeof CPGInvoiceInputSchema>;

/**
 * Validate distribution calculation parameters
 */
export function validateDistributionCalcParams(data: unknown) {
  return DistributionCalcParamsSchema.safeParse(data);
}

/**
 * Validate promo analysis parameters
 */
export function validatePromoAnalysisParams(data: unknown) {
  return PromoAnalysisParamsSchema.safeParse(data);
}

/**
 * Validate promo creation parameters
 */
export function validateCreatePromoParams(data: unknown) {
  return CreatePromoParamsSchema.safeParse(data);
}

/**
 * Validate CPG invoice input
 */
export function validateCPGInvoiceInput(data: unknown) {
  return CPGInvoiceInputSchema.safeParse(data);
}

/**
 * Detect suspicious calculation patterns
 * Returns true if values are suspicious (e.g., too large, unusual ratios)
 */
export function detectSuspiciousCalculation(data: {
  type: 'distribution' | 'promo' | 'invoice';
  values: Record<string, number>;
}): { suspicious: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check for extremely large values (> $100,000)
  for (const [key, value] of Object.entries(data.values)) {
    if (value > 100000) {
      reasons.push(`${key} is unusually large: $${value.toLocaleString()}`);
    }
  }

  // Type-specific checks
  if (data.type === 'distribution') {
    // Check for unrealistic pallet counts
    if (data.values.numPallets && data.values.numPallets > 500) {
      reasons.push(`Number of pallets (${data.values.numPallets}) is unusually high`);
    }

    // Check for unrealistic units per pallet
    if (data.values.unitsPerPallet && data.values.unitsPerPallet > 10000) {
      reasons.push(`Units per pallet (${data.values.unitsPerPallet}) is unusually high`);
    }

    // Check for negative margin (CPU > price)
    if (data.values.totalCPU && data.values.price && data.values.totalCPU > data.values.price) {
      reasons.push(`Total CPU ($${data.values.totalCPU.toFixed(2)}) exceeds price ($${data.values.price.toFixed(2)}) - negative margin`);
    }
  }

  if (data.type === 'promo') {
    // Check for unrealistic promo costs
    if (data.values.totalPromoCost && data.values.totalPromoCost > 50000) {
      reasons.push(`Total promo cost ($${data.values.totalPromoCost.toLocaleString()}) is unusually high`);
    }

    // Check for margins below 10% (likely unprofitable)
    if (data.values.margin !== undefined && data.values.margin < 10) {
      reasons.push(`Profit margin (${data.values.margin.toFixed(2)}%) is very low - promo may be unprofitable`);
    }
  }

  if (data.type === 'invoice') {
    // Check for unrealistic invoice totals
    if (data.values.totalPaid && data.values.totalPaid > 100000) {
      reasons.push(`Invoice total ($${data.values.totalPaid.toLocaleString()}) is unusually high`);
    }

    // Check for unit price vs quantity mismatches
    if (data.values.unitPrice && data.values.quantity) {
      const lineTotal = data.values.unitPrice * data.values.quantity;
      if (lineTotal > 50000) {
        reasons.push(`Line total ($${lineTotal.toLocaleString()}) is unusually high`);
      }
    }
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format Zod error for user-friendly display
 */
export function formatValidationError(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });

  return issues.join('; ');
}

/**
 * Create a standardized validation result
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Wrap Zod validation result in standardized format
 */
export function wrapValidationResult<T>(
  result: { success: boolean; data?: T; error?: z.ZodError }
): ValidationResult<T> {
  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    error: formatValidationError(result.error),
  };
}
