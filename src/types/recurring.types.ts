/**
 * Recurring Transaction Type Definitions
 *
 * Types for recurring transactions that generate transactions automatically
 * or create drafts for approval based on a recurrence schedule.
 *
 * Requirements:
 * - E2: Recurring Transactions [MVP]
 * - All recurrence rules are stored encrypted
 */

import type { TransactionType, VersionVector } from './database.types';

/**
 * Recurrence frequency options
 */
export enum RecurrenceFrequency {
  WEEKLY = 'WEEKLY',
  BI_WEEKLY = 'BI_WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY',
}

/**
 * Recurrence end condition type
 */
export enum RecurrenceEndType {
  NEVER = 'NEVER', // Never ends
  ON_DATE = 'ON_DATE', // Ends on a specific date
  AFTER_COUNT = 'AFTER_COUNT', // Ends after N occurrences
}

/**
 * Auto-creation mode
 */
export enum AutoCreationMode {
  AUTO = 'AUTO', // Automatically post transactions
  DRAFT = 'DRAFT', // Create drafts for approval
}

/**
 * Recurrence rule (encrypted)
 * This contains all the scheduling information for the recurring transaction
 */
export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number; // e.g., every 2 weeks (interval=2 for BI_WEEKLY)
  startDate: number; // Unix timestamp - when the recurrence starts
  endType: RecurrenceEndType;
  endDate?: number; // Unix timestamp - if endType is ON_DATE
  occurrenceCount?: number; // Number of occurrences - if endType is AFTER_COUNT
  dayOfWeek?: number; // 0-6 (Sun-Sat) - for weekly recurrence
  dayOfMonth?: number; // 1-31 - for monthly/quarterly/annually
  monthOfYear?: number; // 1-12 - for annually
}

/**
 * Transaction template for recurring transactions
 * Contains the transaction details that will be used to create each occurrence
 */
export interface TransactionTemplate {
  type: TransactionType;
  description: string | null;
  reference: string | null;
  memo: string | null;
  lineItems: Array<{
    accountId: string;
    debit: string; // Decimal string
    credit: string; // Decimal string
    description: string | null;
    contactId?: string | null;
    productId?: string | null;
  }>;
  attachments?: string[];
}

/**
 * Recurring Transaction entity
 * Base entity for all entities with CRDT support
 */
export interface RecurringTransaction {
  id: string; // UUID
  company_id: string; // UUID - links to Company
  name: string; // ENCRYPTED - User-friendly name for this recurring transaction
  recurrence_rule: string; // ENCRYPTED - Serialized RecurrenceRule as JSON
  transaction_template: string; // ENCRYPTED - Serialized TransactionTemplate as JSON
  auto_creation_mode: AutoCreationMode; // Plaintext for querying
  active: boolean; // Whether the recurring transaction is active
  next_occurrence: number | null; // Unix timestamp - next scheduled occurrence
  last_created: number | null; // Unix timestamp - when last transaction was created
  created_count: number; // How many transactions have been created from this recurrence
  created_at: number; // Unix timestamp in milliseconds
  updated_at: number; // Unix timestamp in milliseconds
  deleted_at: number | null; // Tombstone marker for soft deletes
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Generated transaction record
 * Tracks which transactions were generated from which recurring transaction
 */
export interface GeneratedTransaction {
  id: string; // UUID
  recurring_transaction_id: string; // UUID - links to RecurringTransaction
  transaction_id: string; // UUID - links to Transaction
  scheduled_date: number; // Unix timestamp - when it was scheduled to be created
  created_date: number; // Unix timestamp - when it was actually created
  occurrence_number: number; // Which occurrence this was (1st, 2nd, etc.)
  created_at: number; // Unix timestamp in milliseconds
  updated_at: number; // Unix timestamp in milliseconds
  deleted_at: number | null; // Tombstone marker
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Recurring transaction summary with decrypted fields
 * Used for display purposes
 */
export interface RecurringTransactionSummary {
  id: string;
  company_id: string;
  name: string;
  recurrence_rule: RecurrenceRule;
  transaction_template: TransactionTemplate;
  auto_creation_mode: AutoCreationMode;
  active: boolean;
  next_occurrence: number | null;
  last_created: number | null;
  created_count: number;
  created_at: number;
  updated_at: number;
}

/**
 * Time savings metrics
 */
export interface TimeSavingsMetrics {
  total_recurring_transactions: number;
  total_auto_created_transactions: number;
  estimated_time_saved_minutes: number; // Assumes 5 minutes per transaction
  next_scheduled_occurrences: Array<{
    recurring_transaction_id: string;
    recurring_transaction_name: string;
    next_occurrence: number;
  }>;
}

/**
 * Recurrence schedule preview
 * Shows upcoming occurrences for a given recurrence rule
 */
export interface RecurrencePreview {
  dates: number[]; // Array of Unix timestamps
  count: number; // How many occurrences shown
  hasMore: boolean; // Whether there are more occurrences beyond the preview
}

/**
 * Edit scope for recurring transactions
 */
export enum EditScope {
  THIS_ONLY = 'THIS_ONLY', // Edit only this instance
  THIS_AND_FUTURE = 'THIS_AND_FUTURE', // Edit this and all future instances
  ALL = 'ALL', // Edit all instances (past and future)
}
