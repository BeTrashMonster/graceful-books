/**
 * Transactions Schema Definition
 *
 * Defines the structure for transactions (journal entries) and line items
 * for double-entry accounting. Enforces the fundamental accounting equation:
 * Debits = Credits for each transaction.
 *
 * Requirements:
 * - ACCT-005: Transaction Schema
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type {
  Transaction,
  TransactionLineItem,
  TransactionStatus,
  TransactionType,
} from '../../types/database.types';

/**
 * Dexie.js schema definition for Transactions table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying transactions by company
 * - type: For querying by transaction type
 * - status: For querying by status
 * - [company_id+status]: Compound index for filtered queries
 * - [company_id+type]: Compound index for type-filtered queries
 * - transaction_date: For date-range queries
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const transactionsSchema = 'id, company_id, type, status, [company_id+status], [company_id+type], transaction_date, updated_at, deleted_at';

/**
 * Dexie.js schema definition for TransactionLineItems table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - transaction_id: For querying line items by transaction
 * - account_id: For querying transactions affecting an account
 * - contact_id: For querying transactions by customer/vendor
 * - product_id: For querying transactions by product
 * - updated_at: For CRDT conflict resolution
 */
export const transactionLineItemsSchema = 'id, transaction_id, account_id, contact_id, product_id, updated_at, deleted_at';

/**
 * Table name constants
 */
export const TRANSACTIONS_TABLE = 'transactions';
export const TRANSACTION_LINE_ITEMS_TABLE = 'transaction_line_items';

/**
 * Default values for new Transaction
 */
export const createDefaultTransaction = (
  companyId: string,
  transactionNumber: string,
  type: TransactionType,
  deviceId: string
): Partial<Transaction> => {
  const now = Date.now();

  return {
    company_id: companyId,
    transaction_number: transactionNumber,
    transaction_date: now,
    type,
    status: 'DRAFT' as TransactionStatus,
    description: null,
    reference: null,
    memo: null,
    attachments: [],
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Default values for new TransactionLineItem
 */
export const createDefaultTransactionLineItem = (
  transactionId: string,
  accountId: string,
  deviceId: string
): Partial<TransactionLineItem> => {
  const now = Date.now();

  return {
    transaction_id: transactionId,
    account_id: accountId,
    debit: '0.00',
    credit: '0.00',
    description: null,
    contact_id: null,
    product_id: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Validation: Ensure transaction is balanced (debits = credits)
 */
export const validateTransactionBalance = (lineItems: TransactionLineItem[]): {
  isBalanced: boolean;
  totalDebits: string;
  totalCredits: string;
  difference: string;
} => {
  let totalDebits = 0;
  let totalCredits = 0;

  for (const item of lineItems) {
    if (item.deleted_at === null) {
      // Only count non-deleted items
      totalDebits += parseFloat(item.debit || '0');
      totalCredits += parseFloat(item.credit || '0');
    }
  }

  const difference = Math.abs(totalDebits - totalCredits);
  const isBalanced = difference < 0.01; // Allow for small floating point errors

  return {
    isBalanced,
    totalDebits: totalDebits.toFixed(2),
    totalCredits: totalCredits.toFixed(2),
    difference: difference.toFixed(2),
  };
};

/**
 * Validation: Ensure transaction has valid fields
 */
export const validateTransaction = (transaction: Partial<Transaction>): string[] => {
  const errors: string[] = [];

  if (!transaction.company_id) {
    errors.push('company_id is required');
  }

  if (!transaction.transaction_number || transaction.transaction_number.trim() === '') {
    errors.push('transaction_number is required');
  }

  if (!transaction.transaction_date) {
    errors.push('transaction_date is required');
  }

  if (!transaction.type) {
    errors.push('type is required');
  }

  if (!transaction.status) {
    errors.push('status is required');
  }

  return errors;
};

/**
 * Validation: Ensure line item has valid fields
 */
export const validateTransactionLineItem = (lineItem: Partial<TransactionLineItem>): string[] => {
  const errors: string[] = [];

  if (!lineItem.transaction_id) {
    errors.push('transaction_id is required');
  }

  if (!lineItem.account_id) {
    errors.push('account_id is required');
  }

  // Ensure either debit or credit is non-zero, but not both
  const debit = parseFloat(lineItem.debit || '0');
  const credit = parseFloat(lineItem.credit || '0');

  if (debit === 0 && credit === 0) {
    errors.push('Either debit or credit must be non-zero');
  }

  if (debit > 0 && credit > 0) {
    errors.push('Cannot have both debit and credit on the same line');
  }

  if (debit < 0 || credit < 0) {
    errors.push('Debit and credit must be non-negative');
  }

  return errors;
};

/**
 * Helper: Calculate net amount of a line item
 * Debits are positive, credits are negative
 */
export const getLineItemNetAmount = (lineItem: TransactionLineItem): number => {
  const debit = parseFloat(lineItem.debit || '0');
  const credit = parseFloat(lineItem.credit || '0');
  return debit - credit;
};

/**
 * Query helper: Get all transactions for a company
 */
export interface GetTransactionsQuery {
  company_id: string;
  type?: TransactionType;
  status?: TransactionStatus;
  account_id?: string;
  contact_id?: string;
  product_id?: string;
  date_from?: number;
  date_to?: number;
}

/**
 * Transaction summary for reporting
 */
export interface TransactionSummary {
  transaction: Transaction;
  line_items: TransactionLineItem[];
  total_debits: string;
  total_credits: string;
  is_balanced: boolean;
}

/**
 * Standard journal entry templates
 */
export interface JournalEntryTemplate {
  name: string;
  description: string;
  type: TransactionType;
  line_items: Array<{
    description: string;
    is_debit: boolean;
    account_type_hint: string; // Hint for which account type to use
  }>;
}

export const STANDARD_JOURNAL_ENTRY_TEMPLATES: JournalEntryTemplate[] = [
  {
    name: 'Cash Sale',
    description: 'Record a cash sale',
    type: 'INVOICE' as TransactionType,
    line_items: [
      {
        description: 'Cash received',
        is_debit: true,
        account_type_hint: 'ASSET (Cash)',
      },
      {
        description: 'Revenue earned',
        is_debit: false,
        account_type_hint: 'INCOME',
      },
    ],
  },
  {
    name: 'Cash Expense',
    description: 'Record a cash expense',
    type: 'EXPENSE' as TransactionType,
    line_items: [
      {
        description: 'Expense incurred',
        is_debit: true,
        account_type_hint: 'EXPENSE',
      },
      {
        description: 'Cash paid',
        is_debit: false,
        account_type_hint: 'ASSET (Cash)',
      },
    ],
  },
  {
    name: 'Owner Investment',
    description: 'Record owner cash investment',
    type: 'JOURNAL_ENTRY' as TransactionType,
    line_items: [
      {
        description: 'Cash received',
        is_debit: true,
        account_type_hint: 'ASSET (Cash)',
      },
      {
        description: 'Owner equity increased',
        is_debit: false,
        account_type_hint: 'EQUITY',
      },
    ],
  },
  {
    name: 'Credit Purchase',
    description: 'Record a purchase on credit',
    type: 'BILL' as TransactionType,
    line_items: [
      {
        description: 'Expense or asset acquired',
        is_debit: true,
        account_type_hint: 'EXPENSE or ASSET',
      },
      {
        description: 'Accounts payable increased',
        is_debit: false,
        account_type_hint: 'LIABILITY (Accounts Payable)',
      },
    ],
  },
  {
    name: 'Pay Bill',
    description: 'Record payment of accounts payable',
    type: 'PAYMENT' as TransactionType,
    line_items: [
      {
        description: 'Accounts payable decreased',
        is_debit: true,
        account_type_hint: 'LIABILITY (Accounts Payable)',
      },
      {
        description: 'Cash paid',
        is_debit: false,
        account_type_hint: 'ASSET (Cash)',
      },
    ],
  },
  {
    name: 'Receive Payment',
    description: 'Record receipt of accounts receivable',
    type: 'PAYMENT' as TransactionType,
    line_items: [
      {
        description: 'Cash received',
        is_debit: true,
        account_type_hint: 'ASSET (Cash)',
      },
      {
        description: 'Accounts receivable decreased',
        is_debit: false,
        account_type_hint: 'ASSET (Accounts Receivable)',
      },
    ],
  },
];

/**
 * Helper: Generate next transaction number
 * Format: PREFIX-YYYY-NNNN (e.g., "JE-2026-0001")
 */
export const generateTransactionNumber = (
  type: TransactionType,
  year: number,
  sequence: number
): string => {
  const prefix = getTransactionTypePrefix(type);
  const paddedSequence = sequence.toString().padStart(4, '0');
  return `${prefix}-${year}-${paddedSequence}`;
};

/**
 * Helper: Get transaction type prefix
 */
export const getTransactionTypePrefix = (type: TransactionType): string => {
  const prefixes: Record<TransactionType, string> = {
    JOURNAL_ENTRY: 'JE',
    INVOICE: 'INV',
    PAYMENT: 'PMT',
    EXPENSE: 'EXP',
    BILL: 'BILL',
    CREDIT_NOTE: 'CN',
    ADJUSTMENT: 'ADJ',
    BARTER: 'BRT', // I5: Barter/Trade Transactions
  };

  return prefixes[type] || 'TXN';
};
