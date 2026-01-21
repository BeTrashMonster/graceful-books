/**
 * Journal Entry Type Definitions
 *
 * Per F7: Journal Entries (Full)
 * Supports specialized journal entry operations on top of the core transaction system.
 *
 * Requirements:
 * - F7: Journal Entries (Full)
 * - ACCT-005: Journal Entry Features
 */

import type {
  Transaction,
  TransactionLineItem,
  TransactionStatus,
  VersionVector,
} from './database.types';

// =============================================================================
// Journal Entry Approval Types
// =============================================================================

/**
 * Approval status for journal entries
 */
export type JournalEntryApprovalStatus =
  | 'DRAFT' // Not yet submitted for approval
  | 'PENDING' // Submitted, awaiting approval
  | 'APPROVED' // Approved and posted
  | 'REJECTED'; // Rejected, needs revision

// =============================================================================
// Journal Entry Core Types
// =============================================================================

/**
 * Journal Entry (extends Transaction with approval workflow)
 */
export interface JournalEntry extends Transaction {
  // Approval workflow fields
  approval_status: JournalEntryApprovalStatus;
  submitted_at: number | null; // Unix timestamp
  submitted_by: string | null; // User ID
  approved_at: number | null; // Unix timestamp
  approved_by: string | null; // User ID
  rejected_at: number | null; // Unix timestamp
  rejected_by: string | null; // User ID
  rejection_reason: string | null; // ENCRYPTED

  // Reversing entry fields
  is_reversing: boolean; // True if this entry reverses another
  reverses_entry_id: string | null; // ID of entry being reversed
  reversed_by_entry_id: string | null; // ID of entry that reversed this one
  auto_reverse_date: number | null; // Unix timestamp - Auto-reverse on this date

  // Template fields
  template_id: string | null; // Template used to create this entry
  template_name: string | null; // ENCRYPTED - Snapshot of template name
}

/**
 * Journal Entry Line Item (extends TransactionLineItem)
 */
export interface JournalEntryLineItem extends TransactionLineItem {
  line_number: number; // Sequential line number
  is_auto_balanced: boolean; // True if this line was auto-generated to balance
}

/**
 * Journal Entry with all line items
 */
export interface JournalEntryWithLineItems {
  entry: JournalEntry;
  line_items: JournalEntryLineItem[];
  // Computed properties
  is_balanced: boolean;
  total_debits: string; // DECIMAL
  total_credits: string; // DECIMAL
  can_edit: boolean;
  can_approve: boolean;
  can_void: boolean;
}

// =============================================================================
// Journal Entry Template Types
// =============================================================================

/**
 * Template for recurring journal entries
 */
export interface JournalEntryTemplate {
  id: string;
  company_id: string;
  name: string; // ENCRYPTED
  description: string | null; // ENCRYPTED
  is_active: boolean;

  // Template line items
  line_items: JournalEntryTemplateLineItem[];

  // Auto-reverse settings
  auto_reverse?: boolean;
  reverse_days?: number;

  // Metadata
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
  deleted_at: number | null;
  version_vector: VersionVector;
}

/**
 * Line item in a journal entry template
 */
export interface JournalEntryTemplateLineItem {
  id: string;
  template_id: string;
  line_number: number;
  account_id: string;
  debit: string | null; // ENCRYPTED - Null if variable (DECIMAL)
  credit: string | null; // ENCRYPTED - Null if variable (DECIMAL)
  is_debit?: boolean; // Alternative way to specify debit/credit
  description: string | null; // ENCRYPTED
  is_variable_amount: boolean; // True if amount should be entered when using template
}

// =============================================================================
// Request/Response Types
// =============================================================================

/**
 * Request to create a journal entry
 */
export interface CreateJournalEntryRequest {
  company_id: string;
  transaction_date: number; // Unix timestamp
  description: string | null;
  reference: string | null;
  memo: string | null;
  attachments: string[];
  line_items: CreateJournalEntryLineItemRequest[];

  // Optional approval workflow
  submit_for_approval: boolean;

  // Optional reversing entry
  is_reversing: boolean;
  reverses_entry_id: string | null;
  auto_reverse_date: number | null;

  // Optional template
  template_id: string | null;
}

/**
 * Line item for journal entry creation
 */
export interface CreateJournalEntryLineItemRequest {
  account_id: string;
  debit: string; // DECIMAL
  credit: string; // DECIMAL
  description: string | null;
  contact_id: string | null;
  product_id: string | null;
}

/**
 * Request to update a journal entry
 */
export interface UpdateJournalEntryRequest {
  entry_id: string;
  transaction_date?: number; // Unix timestamp
  description?: string | null;
  reference?: string | null;
  memo?: string | null;
  attachments?: string[];
  line_items?: UpdateJournalEntryLineItemRequest[];
}

/**
 * Line item for journal entry update
 */
export interface UpdateJournalEntryLineItemRequest {
  id?: string; // If present, update existing; if absent, create new
  account_id: string;
  debit: string; // DECIMAL
  credit: string; // DECIMAL
  description: string | null;
  contact_id: string | null;
  product_id: string | null;
  _deleted?: boolean; // If true, mark for deletion
}

/**
 * Request to approve a journal entry
 */
export interface ApproveJournalEntryRequest {
  entry_id: string;
  approved_by: string; // User ID
  post_immediately: boolean; // If true, change status to POSTED
}

/**
 * Request to reject a journal entry
 */
export interface RejectJournalEntryRequest {
  entry_id: string;
  rejected_by: string; // User ID
  rejection_reason?: string;
  reason?: string; // Alternative name
}

/**
 * Request to void a journal entry
 */
export interface VoidJournalEntryRequest {
  entry_id: string;
  void_reason: string;
  create_reversing_entry: boolean; // If true, create reversing entry
}

// =============================================================================
// Query Types
// =============================================================================

/**
 * Filters for querying journal entries
 */
export interface JournalEntryQueryFilters {
  company_id: string;
  status?: TransactionStatus[];
  approval_status?: JournalEntryApprovalStatus[];
  date_from?: number; // Unix timestamp
  date_to?: number; // Unix timestamp
  account_id?: string;
  submitted_by?: string;
  approved_by?: string;
  is_reversing?: boolean;
  template_id?: string;
  search?: string; // Search in description, reference, memo
  limit?: number;
  offset?: number;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Validation result for journal entry
 */
export interface JournalEntryValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  total_debits: string; // DECIMAL
  total_credits: string; // DECIMAL
  balance_difference: string; // DECIMAL
}

// =============================================================================
// Reversing Entry Types
// =============================================================================

/**
 * Options for creating a reversing entry
 */
export interface CreateReversingEntryOptions {
  original_entry_id: string;
  reversal_date: number; // Unix timestamp
  reversal_description?: string; // Override description
  description?: string; // Alternative name
  submit_for_approval: boolean;
}

// =============================================================================
// Statistics Types
// =============================================================================

/**
 * Journal entry statistics
 */
export interface JournalEntryStatistics {
  company_id: string;
  total_entries: number;
  by_status: Record<TransactionStatus, number>;
  by_approval_status: Record<JournalEntryApprovalStatus, number>;
  pending_approval_count: number;
  pending_approval?: number; // Alternative name
  draft_count: number;
  posted_count: number;
  voided_count: number;
  approved_this_month?: number;
  total_reversing_entries: number;
  entries_from_templates: number;
}

/**
 * TODO: Integration test stub - add standard journal entry templates
 * Extended set of standard journal entry templates
 */
export const STANDARD_JOURNAL_ENTRY_TEMPLATES_EXTENDED: JournalEntryTemplate[] = []

