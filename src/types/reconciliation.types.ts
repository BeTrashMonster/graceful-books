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
