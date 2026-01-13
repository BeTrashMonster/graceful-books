/**
 * Reconciliation Type Definitions
 *
 * Types for bank reconciliation functionality including statement parsing,
 * transaction matching, and reconciliation state management.
 */

import type { BaseEntity, VersionVector } from './database.types';

// ============================================================================
// Reconciliation Status
// ============================================================================

/**
 * Status of a reconciliation session
 */
export enum ReconciliationStatus {
  DRAFT = 'DRAFT', // In progress
  COMPLETED = 'COMPLETED', // Successfully completed
  ABANDONED = 'ABANDONED', // User abandoned without completing
}

// ============================================================================
// Statement Types
// ============================================================================

/**
 * Bank statement transaction from uploaded statement
 */
export interface StatementTransaction {
  id: string; // Unique ID for this statement transaction
  date: number; // Unix timestamp
  description: string; // Transaction description from bank
  amount: number; // Amount in cents (positive for deposits, negative for withdrawals)
  balance?: number; // Running balance if available in cents
  reference?: string; // Check number or reference ID
  matched: boolean; // Whether this has been matched
  matchedTransactionId?: string; // ID of matched transaction in our system
}

/**
 * Parsed bank statement data
 */
export interface ParsedStatement {
  accountName?: string; // Bank account name if available
  accountNumber?: string; // Last 4 digits or masked account number
  statementPeriod: {
    startDate: number; // Unix timestamp
    endDate: number; // Unix timestamp
  };
  openingBalance?: number; // Opening balance in cents
  closingBalance?: number; // Closing balance in cents
  transactions: StatementTransaction[];
  format: 'csv' | 'pdf'; // Source format
}

// ============================================================================
// Matching Types
// ============================================================================

/**
 * Match confidence level
 */
export enum MatchConfidence {
  EXACT = 'EXACT', // Perfect match (date, amount, and description similar)
  HIGH = 'HIGH', // High confidence (date and amount match, description similar)
  MEDIUM = 'MEDIUM', // Medium confidence (amount matches, date within 3 days)
  LOW = 'LOW', // Low confidence (only amount matches)
  MANUAL = 'MANUAL', // Manually matched by user
}

/**
 * Suggested match between statement transaction and system transaction
 */
export interface TransactionMatch {
  statementTransactionId: string;
  systemTransactionId: string;
  confidence: MatchConfidence;
  score: number; // Matching score 0-100
  reasons: string[]; // Reasons for this match
}

// ============================================================================
// Reconciliation Entity
// ============================================================================

/**
 * Reconciliation session entity
 * Tracks a single reconciliation process
 */
export interface Reconciliation extends BaseEntity {
  company_id: string; // UUID - links to Company
  account_id: string; // UUID - Bank account being reconciled
  statement_period_start: number; // Unix timestamp
  statement_period_end: number; // Unix timestamp
  opening_balance: number; // Opening balance in cents (ENCRYPTED when stored)
  closing_balance: number; // Closing balance in cents (ENCRYPTED when stored)
  status: ReconciliationStatus;
  statement_data: string; // ENCRYPTED - JSON of ParsedStatement
  matched_transactions: string; // ENCRYPTED - JSON array of transaction IDs
  unmatched_statement_items: string; // ENCRYPTED - JSON array of StatementTransaction IDs
  unmatched_system_items: string; // ENCRYPTED - JSON array of system transaction IDs
  discrepancy: number; // Difference between expected and actual (in cents)
  is_first_reconciliation: boolean; // Whether this is user's first reconciliation
  completed_at: number | null; // Unix timestamp when completed
  notes: string | null; // ENCRYPTED - User notes
  version_vector: VersionVector;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Wizard step in reconciliation flow
 */
export enum ReconciliationStep {
  INTRODUCTION = 'INTRODUCTION', // Educational intro
  UPLOAD_STATEMENT = 'UPLOAD_STATEMENT', // Upload bank statement
  STATEMENT_DETAILS = 'STATEMENT_DETAILS', // Enter statement details
  AUTO_MATCHING = 'AUTO_MATCHING', // Automatic matching in progress
  REVIEW_MATCHES = 'REVIEW_MATCHES', // Review and confirm matches
  MANUAL_MATCHING = 'MANUAL_MATCHING', // Manually match remaining items
  RESOLVE_DISCREPANCIES = 'RESOLVE_DISCREPANCIES', // Handle unmatched items
  SUMMARY = 'SUMMARY', // Final summary and completion
}

/**
 * Reconciliation wizard state
 */
export interface ReconciliationWizardState {
  currentStep: ReconciliationStep;
  accountId: string | null;
  statement: ParsedStatement | null;
  matches: TransactionMatch[];
  confirmedMatches: Set<string>; // Set of statementTransactionId that are confirmed
  rejectedMatches: Set<string>; // Set of statementTransactionId where match was rejected
  manualMatches: Map<string, string>; // statementTransactionId -> systemTransactionId
  isFirstReconciliation: boolean;
  canProgress: boolean; // Whether user can proceed to next step
}

// ============================================================================
// CSV Parsing Configuration
// ============================================================================

/**
 * CSV column mapping configuration
 */
export interface CSVColumnMapping {
  dateColumn: number | string; // Column index or name for date
  descriptionColumn: number | string; // Column index or name for description
  amountColumn: number | string; // Column index or name for amount
  balanceColumn?: number | string; // Optional balance column
  debitColumn?: number | string; // Optional separate debit column
  creditColumn?: number | string; // Optional separate credit column
  referenceColumn?: number | string; // Optional reference/check number
}

/**
 * CSV parsing options
 */
export interface CSVParseOptions {
  hasHeader: boolean; // Whether first row is header
  delimiter?: string; // Field delimiter (default: auto-detect)
  dateFormat?: string; // Expected date format
  columnMapping?: CSVColumnMapping; // Manual column mapping
  skipRows?: number; // Number of rows to skip at start
}

// ============================================================================
// PDF Parsing Types
// ============================================================================

/**
 * PDF parsing result
 */
export interface PDFParseResult {
  text: string; // Extracted text content
  pages: number; // Number of pages
  success: boolean;
  error?: string;
}

// ============================================================================
// Matching Algorithm Types
// ============================================================================

/**
 * Matching algorithm options
 */
export interface MatchingOptions {
  dateTolerance: number; // Number of days to allow for date differences
  amountTolerance: number; // Percentage tolerance for amount differences (0-100)
  descriptionSimilarityThreshold: number; // Minimum similarity score for descriptions (0-100)
  minConfidenceScore: number; // Minimum score to suggest a match (0-100)
}

/**
 * Default matching options
 */
export const DEFAULT_MATCHING_OPTIONS: MatchingOptions = {
  dateTolerance: 3, // 3 days
  amountTolerance: 0.5, // 0.5%
  descriptionSimilarityThreshold: 60, // 60% similar
  minConfidenceScore: 50, // 50 minimum score
};

// ============================================================================
// E1: Enhanced Matching Types
// ============================================================================

/**
 * Match candidate with detailed scoring breakdown
 */
export interface MatchCandidate {
  statementLine: StatementTransaction;
  bookTransaction: string; // Transaction ID
  confidence: MatchConfidence;
  matchScore: number; // 0-100
  matchFactors: {
    dateMatch: number; // 0-100
    amountMatch: number; // 0-100
    descriptionMatch: number; // 0-100
    vendorMatch: number; // 0-100
    patternMatch: number; // 0-100
  };
}

/**
 * Vendor pattern learned from reconciliation history
 */
export interface ReconciliationPattern {
  id: string; // UUID
  company_id: string; // UUID
  vendor_name: string; // Normalized vendor name
  description_patterns: string[]; // Common description patterns
  typical_amount_range: {
    min: number; // In cents
    max: number; // In cents
  } | null;
  typical_day_of_month: number | null; // 1-31
  confidence: number; // 0-100, improved with each use
  last_matched_at: number; // Unix timestamp
  match_count: number; // Number of times this pattern has been used
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
}

/**
 * Multi-transaction match (one-to-many or many-to-one)
 */
export interface MultiTransactionMatch {
  statement_transaction_ids: string[]; // Multiple statement transactions
  system_transaction_ids: string[]; // Multiple system transactions
  match_type: 'split_deposit' | 'partial_payments' | 'combined_transactions';
  confidence: MatchConfidence;
  total_statement_amount: number; // In cents
  total_system_amount: number; // In cents
}

// ============================================================================
// E1: Reconciliation History Types
// ============================================================================

/**
 * Complete reconciliation record with history
 */
export interface ReconciliationRecord extends BaseEntity {
  id: string;
  company_id: string;
  account_id: string;
  reconciliation_date: number; // Unix timestamp
  statement_period: {
    start: number; // Unix timestamp
    end: number; // Unix timestamp
  };
  beginning_balance: number; // In cents (ENCRYPTED)
  ending_balance: number; // In cents (ENCRYPTED)
  calculated_balance: number; // In cents (ENCRYPTED)
  discrepancy: number; // In cents (ENCRYPTED)
  status: 'balanced' | 'discrepancy_resolved' | 'discrepancy_noted' | 'reopened';
  matched_transactions: string[]; // Transaction IDs (ENCRYPTED)
  unmatched_statement_lines: StatementTransaction[]; // (ENCRYPTED)
  unmatched_book_transactions: string[]; // Transaction IDs (ENCRYPTED)
  notes: string | null; // (ENCRYPTED)
  time_spent_seconds: number;
  user_id: string;
  reopened_at: number | null; // Unix timestamp
  reopened_by: string | null; // User ID
  reopened_reason: string | null; // (ENCRYPTED)
  version_vector: VersionVector;
}

/**
 * Reconciliation history summary for list view
 */
export interface ReconciliationHistorySummary {
  id: string;
  account_id: string;
  account_name: string; // Decrypted for display
  reconciliation_date: number;
  statement_period: {
    start: number;
    end: number;
  };
  status: 'balanced' | 'discrepancy_resolved' | 'discrepancy_noted' | 'reopened';
  discrepancy: number;
  matched_count: number;
  unmatched_count: number;
  user_name: string; // Who performed reconciliation
}

// ============================================================================
// E1: Unreconciled Transaction Flagging
// ============================================================================

/**
 * Unreconciled transaction flag level
 */
export enum UnreconciledFlag {
  NONE = 'NONE', // Reconciled or too recent
  WARNING = 'WARNING', // 30-60 days old
  ATTENTION = 'ATTENTION', // 61-90 days old
  URGENT = 'URGENT', // >90 days old
}

/**
 * Unreconciled transaction info
 */
export interface UnreconciledTransaction {
  transaction_id: string;
  transaction_date: number;
  age_days: number;
  flag: UnreconciledFlag;
  account_id: string;
  amount: number; // In cents
  description: string;
}

/**
 * Unreconciled transaction dashboard data
 */
export interface UnreconciledDashboard {
  total_count: number;
  by_flag: {
    warning: number;
    attention: number;
    urgent: number;
  };
  by_account: Array<{
    account_id: string;
    account_name: string;
    count: number;
  }>;
  oldest_transaction_age_days: number;
}

// ============================================================================
// E1: Reconciliation Streak Tracking
// ============================================================================

/**
 * Reconciliation streak data
 */
export interface ReconciliationStreak {
  company_id: string;
  account_id: string;
  current_streak: number; // Consecutive months
  best_streak: number; // Best streak ever achieved
  last_reconciliation_date: number; // Unix timestamp
  next_due_date: number; // Unix timestamp
  streak_status: 'active' | 'broken' | 'at_risk';
  milestones_achieved: Array<{
    milestone: 3 | 6 | 12 | 24;
    achieved_at: number; // Unix timestamp
  }>;
}

/**
 * Streak milestone badge
 */
export interface StreakMilestone {
  months: 3 | 6 | 12 | 24;
  badge_name: string;
  description: string;
  icon: string;
}

/**
 * Predefined streak milestones
 */
export const STREAK_MILESTONES: StreakMilestone[] = [
  {
    months: 3,
    badge_name: 'Getting Started',
    description: '3 months of consistent reconciliation',
    icon: '🌱',
  },
  {
    months: 6,
    badge_name: 'Bookkeeping Pro',
    description: '6 months of consistent reconciliation',
    icon: '⭐',
  },
  {
    months: 12,
    badge_name: 'Bookkeeping Champion',
    description: '1 year of consistent reconciliation',
    icon: '🏆',
  },
  {
    months: 24,
    badge_name: 'Master Reconciler',
    description: '2 years of consistent reconciliation',
    icon: '👑',
  },
];

// ============================================================================
// E1: Advanced Discrepancy Resolution
// ============================================================================

/**
 * Discrepancy pattern types
 */
export enum DiscrepancyPattern {
  BANK_FEE = 'BANK_FEE',
  INTEREST = 'INTEREST',
  DUPLICATE = 'DUPLICATE',
  OUTSTANDING_CHECK = 'OUTSTANDING_CHECK',
  DEPOSIT_IN_TRANSIT = 'DEPOSIT_IN_TRANSIT',
  DATA_ENTRY_ERROR = 'DATA_ENTRY_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Suggested discrepancy resolution
 */
export interface DiscrepancySuggestion {
  pattern: DiscrepancyPattern;
  description: string; // User-friendly explanation
  suggested_action: string; // What to do about it
  affected_transactions: string[]; // Transaction IDs
  amount: number; // In cents
  confidence: number; // 0-100
  auto_fixable: boolean; // Can be automatically fixed
  fix_action?: {
    type: 'add_transaction' | 'mark_void' | 'edit_amount' | 'flag_for_review';
    data: unknown; // Action-specific data
  };
}
