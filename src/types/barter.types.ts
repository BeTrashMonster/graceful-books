/**
 * Barter Transaction Type Definitions
 *
 * Per I5: Barter/Trade Transactions (Nice)
 * Supports proper accounting for barter exchanges with tax compliance guidance.
 *
 * Requirements:
 * - I5: Barter/Trade Transactions
 * - GAAP compliance for barter accounting
 * - IRS tax compliance (barter income is taxable)
 * - 1099-B reporting guidance
 */

import type {
  Transaction,
  TransactionLineItem,
  TransactionStatus,
  VersionVector,
} from './database.types';

// =============================================================================
// Barter Transaction Core Types
// =============================================================================

/**
 * Barter Transaction (extends Transaction with barter-specific fields)
 *
 * Barter transactions are exchanges of goods or services without cash.
 * Both sides must be recorded at fair market value (FMV) for proper accounting.
 */
export interface BarterTransaction extends Transaction {
  // Barter-specific flags
  is_barter: true; // Flag to identify barter transactions

  // Fair market value details
  goods_received_description: string; // ENCRYPTED - Description of goods/services received
  goods_received_fmv: string; // ENCRYPTED - Fair market value received (DECIMAL)
  goods_provided_description: string; // ENCRYPTED - Description of goods/services provided
  goods_provided_fmv: string; // ENCRYPTED - Fair market value provided (DECIMAL)

  // Valuation documentation
  fmv_basis: string | null; // ENCRYPTED - How FMV was determined
  fmv_documentation: string[]; // ENCRYPTED - Array of attachment IDs for FMV support

  // Tax tracking
  is_1099_reportable: boolean; // Whether this requires 1099-B reporting
  tax_year: number; // Tax year for reporting
  counterparty_contact_id: string | null; // Contact ID for 1099-B reporting

  // Offsetting entry tracking
  income_entry_id: string | null; // ID of the income journal entry
  expense_entry_id: string | null; // ID of the expense journal entry
}

/**
 * Barter Transaction with all related data
 */
export interface BarterTransactionWithDetails {
  barter: BarterTransaction;
  income_entry: Transaction | null;
  expense_entry: Transaction | null;
  income_line_items: TransactionLineItem[];
  expense_line_items: TransactionLineItem[];
}

// =============================================================================
// Request/Response Types
// =============================================================================

/**
 * Request to create a barter transaction
 */
export interface CreateBarterTransactionRequest {
  company_id: string;
  transaction_date: number; // Unix timestamp

  // Goods/services received (income side)
  goods_received_description: string;
  goods_received_fmv: string; // DECIMAL
  income_account_id: string; // Account to credit for income

  // Goods/services provided (expense side)
  goods_provided_description: string;
  goods_provided_fmv: string; // DECIMAL
  expense_account_id: string; // Account to debit for expense

  // Valuation support
  fmv_basis: string | null; // How FMV was determined
  fmv_documentation: string[]; // Attachment IDs

  // Tax reporting
  counterparty_contact_id: string | null; // For 1099-B reporting

  // Optional fields
  reference: string | null;
  memo: string | null;
  attachments: string[];
}

/**
 * Request to update a barter transaction
 */
export interface UpdateBarterTransactionRequest {
  barter_id: string;
  transaction_date?: number;
  goods_received_description?: string;
  goods_received_fmv?: string;
  income_account_id?: string;
  goods_provided_description?: string;
  goods_provided_fmv?: string;
  expense_account_id?: string;
  fmv_basis?: string | null;
  fmv_documentation?: string[];
  counterparty_contact_id?: string | null;
  reference?: string | null;
  memo?: string | null;
  attachments?: string[];
}

// =============================================================================
// Query Types
// =============================================================================

/**
 * Filters for querying barter transactions
 */
export interface BarterTransactionQueryFilters {
  company_id: string;
  status?: TransactionStatus[];
  date_from?: number; // Unix timestamp
  date_to?: number; // Unix timestamp
  tax_year?: number;
  is_1099_reportable?: boolean;
  counterparty_contact_id?: string;
  min_fmv?: string; // DECIMAL
  max_fmv?: string; // DECIMAL
  search?: string; // Search in descriptions
  limit?: number;
  offset?: number;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Validation result for barter transaction
 */
export interface BarterTransactionValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  fmv_received: string; // DECIMAL
  fmv_provided: string; // DECIMAL
  fmv_difference: string; // DECIMAL - Difference between received and provided
  fmv_difference_percentage: string; // DECIMAL - Percentage difference
}

/**
 * Fair Market Value (FMV) determination methods
 */
export enum FMVBasis {
  MARKET_PRICE = 'MARKET_PRICE', // Current market price for similar items
  COMPARABLE_SALES = 'COMPARABLE_SALES', // Recent sales of comparable items
  PROFESSIONAL_APPRAISAL = 'PROFESSIONAL_APPRAISAL', // Professional appraisal
  REPLACEMENT_COST = 'REPLACEMENT_COST', // Cost to replace the item
  SELLER_ASKING_PRICE = 'SELLER_ASKING_PRICE', // Seller's asking price
  AGREED_VALUE = 'AGREED_VALUE', // Mutually agreed value
  OTHER = 'OTHER', // Other method (requires explanation)
}

// =============================================================================
// Statistics Types
// =============================================================================

/**
 * Barter transaction statistics
 */
export interface BarterTransactionStatistics {
  company_id: string;
  tax_year: number;
  total_transactions: number;
  total_income_fmv: string; // DECIMAL - Total FMV of goods/services received
  total_expense_fmv: string; // DECIMAL - Total FMV of goods/services provided
  reportable_1099_count: number;
  by_status: Record<TransactionStatus, number>;
  by_month: Record<string, number>; // Format: "YYYY-MM"
}

// =============================================================================
// 1099-B Reporting Types
// =============================================================================

/**
 * Data needed for 1099-B reporting
 */
export interface Barter1099Data {
  company_id: string;
  tax_year: number;
  counterparty_contact_id: string;
  counterparty_name: string; // ENCRYPTED
  counterparty_tax_id: string | null; // ENCRYPTED
  counterparty_address: string | null; // ENCRYPTED
  total_fmv: string; // DECIMAL - Total FMV received from this counterparty
  transaction_count: number;
  transactions: BarterTransaction[];
}

/**
 * Summary of all 1099-B reportable barter for a tax year
 */
export interface Barter1099Summary {
  company_id: string;
  tax_year: number;
  total_reportable_income: string; // DECIMAL
  counterparty_count: number;
  counterparties: Barter1099Data[];
}

// =============================================================================
// Educational Content Types
// =============================================================================

/**
 * Educational content topic for barter transactions
 */
export enum BarterEducationTopic {
  WHAT_IS_BARTER = 'WHAT_IS_BARTER',
  TAX_IMPLICATIONS = 'TAX_IMPLICATIONS',
  FMV_DETERMINATION = 'FMV_DETERMINATION',
  FORM_1099_B = 'FORM_1099_B',
  RECORD_KEEPING = 'RECORD_KEEPING',
  IRS_GUIDANCE = 'IRS_GUIDANCE',
}

/**
 * Educational content structure
 */
export interface BarterEducationalContent {
  topic: BarterEducationTopic;
  title: string;
  summary: string;
  content: string; // Markdown content
  examples: BarterExample[];
  irs_references: string[]; // URLs to IRS publications
  disc_variants: {
    D: string; // Dominance style
    I: string; // Influence style
    S: string; // Steadiness style
    C: string; // Conscientiousness style
  };
}

/**
 * Example barter transaction for educational purposes
 */
export interface BarterExample {
  title: string;
  scenario: string;
  goods_received: string;
  goods_received_fmv: string;
  goods_provided: string;
  goods_provided_fmv: string;
  fmv_basis: string;
  tax_treatment: string;
  journal_entries: string; // Explanation of accounting entries
}
