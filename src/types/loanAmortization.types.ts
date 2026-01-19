/**
 * Loan Amortization and Interest Split Type Definitions
 *
 * Per H7: Interest Split Prompt System
 * Supports automatic detection and splitting of loan payments into principal and interest.
 *
 * Requirements:
 * - H7: Interest Split Prompt System
 * - ACCT-009: Loan Payment Detection and Interest Split
 */

import type { BaseEntity, VersionVector } from './database.types';

// =============================================================================
// Loan Account Types
// =============================================================================

/**
 * Loan payment frequency
 */
export type LoanPaymentFrequency =
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUAL'
  | 'ANNUAL'
  | 'BI_WEEKLY'
  | 'WEEKLY';

/**
 * Interest calculation method
 */
export type InterestCalculationMethod =
  | 'SIMPLE' // Simple interest
  | 'COMPOUND' // Compound interest (standard for most loans)
  | 'AMORTIZED'; // Fully amortized (fixed payments)

/**
 * Loan type for categorization
 */
export type LoanType =
  | 'BUSINESS_LOAN'
  | 'LINE_OF_CREDIT'
  | 'EQUIPMENT_LOAN'
  | 'VEHICLE_LOAN'
  | 'MORTGAGE'
  | 'SBA_LOAN'
  | 'CREDIT_CARD'
  | 'OTHER';

/**
 * Loan account status
 */
export type LoanStatus =
  | 'ACTIVE' // Currently being paid
  | 'PAID_OFF' // Fully paid
  | 'DEFAULTED' // In default
  | 'DEFERRED' // Payments deferred
  | 'INACTIVE'; // No longer active

/**
 * Loan account entity
 * Represents a liability account with amortization schedule
 */
export interface LoanAccount extends BaseEntity {
  company_id: string;
  account_id: string; // Links to Account entity (LIABILITY type)
  loan_type: LoanType;
  lender_name: string; // ENCRYPTED
  loan_number: string | null; // ENCRYPTED - Loan account number

  // Loan terms
  principal_amount: string; // ENCRYPTED - Original loan amount (DECIMAL)
  interest_rate: string; // Annual percentage rate (DECIMAL, e.g., "5.25")
  term_months: number; // Total loan term in months
  payment_frequency: LoanPaymentFrequency;
  calculation_method: InterestCalculationMethod;

  // Dates
  origination_date: number; // Unix timestamp
  first_payment_date: number; // Unix timestamp
  maturity_date: number; // Unix timestamp

  // Current status
  status: LoanStatus;
  current_balance: string; // ENCRYPTED - Current principal balance (DECIMAL)
  total_paid_principal: string; // ENCRYPTED - Total principal paid to date (DECIMAL)
  total_paid_interest: string; // ENCRYPTED - Total interest paid to date (DECIMAL)

  // Payment details
  scheduled_payment_amount: string; // ENCRYPTED - Regular payment amount (DECIMAL)
  interest_expense_account_id: string; // Account to use for interest expense

  // Metadata
  notes: string | null; // ENCRYPTED - Additional notes
  version_vector: VersionVector;
}

// =============================================================================
// Amortization Schedule Types
// =============================================================================

/**
 * Single payment in amortization schedule
 */
export interface AmortizationScheduleEntry extends BaseEntity {
  company_id: string;
  loan_account_id: string;
  payment_number: number; // Sequential payment number (1, 2, 3...)
  payment_date: number; // Unix timestamp - Scheduled payment date

  // Payment breakdown
  scheduled_payment: string; // ENCRYPTED - Total payment amount (DECIMAL)
  principal_amount: string; // ENCRYPTED - Principal portion (DECIMAL)
  interest_amount: string; // ENCRYPTED - Interest portion (DECIMAL)
  remaining_balance: string; // ENCRYPTED - Balance after this payment (DECIMAL)

  // Tracking
  is_paid: boolean; // Whether this payment has been made
  actual_payment_date: number | null; // Unix timestamp - When payment was actually made
  actual_payment_amount: string | null; // ENCRYPTED - Actual amount paid (DECIMAL)
  transaction_id: string | null; // Links to Transaction if payment recorded

  version_vector: VersionVector;
}

/**
 * Full amortization schedule for a loan
 */
export interface AmortizationSchedule {
  loan_account_id: string;
  entries: AmortizationScheduleEntry[];
  total_interest: string; // Total interest over life of loan (DECIMAL)
  total_payments: string; // Total of all payments (DECIMAL)
  generated_at: number; // Unix timestamp - When schedule was generated
}

// =============================================================================
// Liability Payment Detection Types
// =============================================================================

/**
 * Detection confidence level
 */
export type DetectionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Factors that contributed to detection
 */
export interface DetectionFactors {
  account_is_liability: boolean; // Account type is LIABILITY
  regular_payment_pattern: boolean; // Payment matches historical pattern
  amount_matches_schedule: boolean; // Amount matches amortization schedule
  memo_contains_loan_keywords: boolean; // Memo has "loan", "payment", etc.
  payee_matches_lender: boolean; // Payee matches lender name
  date_matches_schedule: boolean; // Date is close to scheduled payment date
}

/**
 * Result of liability payment detection
 */
export interface LiabilityPaymentDetection {
  transaction_id: string;
  is_likely_loan_payment: boolean;
  confidence: DetectionConfidence;
  confidence_score: number; // 0-100
  factors: DetectionFactors;
  suggested_loan_account_id: string | null;
  suggested_principal: string | null; // DECIMAL
  suggested_interest: string | null; // DECIMAL
  detection_timestamp: number; // Unix timestamp
}

// =============================================================================
// Interest Split Types
// =============================================================================

/**
 * User decision on interest split prompt
 */
export type InterestSplitDecision =
  | 'SPLIT_NOW' // Split the payment immediately
  | 'DEFER_TO_CHECKLIST' // Add to checklist to handle later
  | 'SKIP' // Not a loan payment, don't ask again for this transaction
  | 'NEVER_FOR_ACCOUNT'; // Never prompt for this account

/**
 * Interest split prompt state
 */
export interface InterestSplitPrompt {
  id: string;
  transaction_id: string;
  detection: LiabilityPaymentDetection;
  shown_at: number; // Unix timestamp - When prompt was shown
  decision: InterestSplitDecision | null;
  decided_at: number | null; // Unix timestamp - When user made decision
  deferred_to_checklist: boolean;
  checklist_item_id: string | null; // If deferred, links to checklist item
}

/**
 * Request to split a payment into principal and interest
 */
export interface SplitPaymentRequest {
  transaction_id: string;
  loan_account_id: string;
  total_payment_amount: string; // DECIMAL - Total payment amount
  principal_amount: string; // DECIMAL - Principal portion
  interest_amount: string; // DECIMAL - Interest portion
  payment_date: number; // Unix timestamp

  // Optional - link to schedule entry if matching
  schedule_entry_id: string | null;

  // User override
  user_specified_split: boolean; // True if user manually entered amounts
  notes: string | null;
}

/**
 * Result of splitting a payment
 */
export interface SplitPaymentResult {
  success: boolean;
  original_transaction_id: string;
  journal_entry_id: string | null; // New journal entry created for the split
  errors: string[];

  // Created journal entry details
  principal_line_id: string | null;
  interest_line_id: string | null;
  payment_line_id: string | null;
}

// =============================================================================
// Interest Split Service Request/Response Types
// =============================================================================

/**
 * Request to detect loan payments in a batch of transactions
 */
export interface BatchDetectionRequest {
  company_id: string;
  transaction_ids: string[];
  confidence_threshold: number; // Minimum confidence to report (0-100)
}

/**
 * Response with detection results
 */
export interface BatchDetectionResponse {
  detections: LiabilityPaymentDetection[];
  total_checked: number;
  total_detected: number;
  high_confidence_count: number;
  medium_confidence_count: number;
  low_confidence_count: number;
}

/**
 * Request to generate amortization schedule
 */
export interface GenerateScheduleRequest {
  loan_account_id: string;
  principal_amount: string; // DECIMAL
  interest_rate: string; // Annual percentage rate (DECIMAL)
  term_months: number;
  payment_frequency: LoanPaymentFrequency;
  first_payment_date: number; // Unix timestamp
  calculation_method: InterestCalculationMethod;
}

/**
 * Request to update loan balance after payment
 */
export interface UpdateLoanBalanceRequest {
  loan_account_id: string;
  payment_amount: string; // DECIMAL - Total payment
  principal_amount: string; // DECIMAL - Principal portion
  interest_amount: string; // DECIMAL - Interest portion
  payment_date: number; // Unix timestamp
  schedule_entry_id: string | null;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Validation result for loan payment split
 */
export interface SplitValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validation rules for interest split
 */
export interface SplitValidationRules {
  principal_plus_interest_equals_payment: boolean;
  principal_not_negative: boolean;
  interest_not_negative: boolean;
  principal_not_exceeds_balance: boolean;
  accounts_exist: boolean;
  accounts_correct_type: boolean;
}

// =============================================================================
// Statistics and Reporting Types
// =============================================================================

/**
 * Loan payment statistics
 */
export interface LoanPaymentStatistics {
  loan_account_id: string;
  total_payments_made: number;
  total_amount_paid: string; // DECIMAL
  total_principal_paid: string; // DECIMAL
  total_interest_paid: string; // DECIMAL
  current_balance: string; // DECIMAL
  percent_paid_off: string; // DECIMAL (0-100)
  next_payment_date: number | null; // Unix timestamp
  next_payment_amount: string | null; // DECIMAL
  payments_remaining: number;
  estimated_payoff_date: number | null; // Unix timestamp
}

/**
 * Interest expense summary for tax reporting
 */
export interface InterestExpenseSummary {
  company_id: string;
  year: number;
  total_interest_paid: string; // DECIMAL
  by_loan_type: Record<LoanType, string>; // DECIMAL amounts by loan type
  by_lender: Record<string, string>; // DECIMAL amounts by lender name
  deductible_interest: string; // DECIMAL - Interest eligible for tax deduction
  non_deductible_interest: string; // DECIMAL
}

// =============================================================================
// User Preference Types
// =============================================================================

/**
 * User preferences for interest split prompts
 */
export interface InterestSplitPreferences {
  company_id: string;
  user_id: string;

  // Auto-detection settings
  enable_auto_detection: boolean;
  confidence_threshold: number; // Minimum confidence to show prompt (0-100)

  // Prompt behavior
  show_prompts: boolean; // If false, never show prompts
  defer_by_default: boolean; // If true, defer to checklist without prompting

  // Account-specific overrides
  never_prompt_accounts: string[]; // Account IDs to never prompt for
  always_auto_split_accounts: string[]; // Account IDs to auto-split without prompting

  // Notification preferences
  notify_on_detection: boolean;
  notification_methods: ('in_app' | 'email')[];

  updated_at: number; // Unix timestamp
}

// =============================================================================
// DISC-Adapted Messaging Types
// =============================================================================

/**
 * DISC personality type for message adaptation
 */
export type DISCType = 'D' | 'I' | 'S' | 'C';

/**
 * Interest split prompt messages adapted for DISC types
 */
export interface InterestSplitMessages {
  prompt_title: Record<DISCType, string>;
  prompt_message: Record<DISCType, string>;
  tax_benefit_note: Record<DISCType, string>;
  split_now_button: Record<DISCType, string>;
  defer_button: Record<DISCType, string>;
  skip_button: Record<DISCType, string>;
  success_message: Record<DISCType, string>;
  error_message: Record<DISCType, string>;
}

// =============================================================================
// Checklist Integration Types
// =============================================================================

/**
 * Checklist item for deferred interest splits
 */
export interface DeferredInterestSplitItem {
  id: string;
  company_id: string;
  transaction_id: string;
  detection: LiabilityPaymentDetection;
  created_at: number; // Unix timestamp
  due_date: number | null; // Unix timestamp
  completed: boolean;
  completed_at: number | null; // Unix timestamp
  snoozed_until: number | null; // Unix timestamp
}

