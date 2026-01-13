/**
 * Recurring Transactions Schema Definition
 *
 * Defines the structure for recurring transactions that automatically
 * generate new transactions based on a recurrence schedule.
 *
 * Requirements:
 * - E2: Recurring Transactions [MVP]
 * - ARCH-004: CRDT-Compatible Schema Design
 * - All recurrence rules and templates are stored encrypted
 */

import { nanoid } from 'nanoid';
import type {
  RecurringTransaction,
  GeneratedTransaction,
  RecurrenceRule,
  TransactionTemplate,
  AutoCreationMode,
} from '../../types/recurring.types';

/**
 * Dexie.js schema definition for RecurringTransactions table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying recurring transactions by company
 * - auto_creation_mode: For querying by creation mode
 * - [company_id+active]: Compound index for active recurring transactions
 * - next_occurrence: For finding transactions that need to be processed
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const recurringTransactionsSchema =
  'id, company_id, auto_creation_mode, [company_id+active], next_occurrence, updated_at, deleted_at';

/**
 * Dexie.js schema definition for GeneratedTransactions table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - recurring_transaction_id: For querying generated transactions by recurring transaction
 * - transaction_id: For finding which recurring transaction generated a transaction
 * - [recurring_transaction_id+scheduled_date]: For ordering generated transactions
 * - updated_at: For CRDT conflict resolution
 */
export const generatedTransactionsSchema =
  'id, recurring_transaction_id, transaction_id, [recurring_transaction_id+scheduled_date], updated_at, deleted_at';

/**
 * Table name constants
 */
export const RECURRING_TRANSACTIONS_TABLE = 'recurring_transactions';
export const GENERATED_TRANSACTIONS_TABLE = 'generated_transactions';

/**
 * Default values for new RecurringTransaction
 */
export const createDefaultRecurringTransaction = (
  companyId: string,
  name: string,
  recurrenceRule: RecurrenceRule,
  transactionTemplate: TransactionTemplate,
  autoCreationMode: AutoCreationMode,
  deviceId: string
): RecurringTransaction => {
  const now = Date.now();

  return {
    id: nanoid(),
    company_id: companyId,
    name, // Will be encrypted by store layer
    recurrence_rule: JSON.stringify(recurrenceRule), // Will be encrypted by store layer
    transaction_template: JSON.stringify(transactionTemplate), // Will be encrypted by store layer
    auto_creation_mode: autoCreationMode,
    active: true,
    next_occurrence: recurrenceRule.startDate,
    last_created: null,
    created_count: 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Default values for new GeneratedTransaction
 */
export const createDefaultGeneratedTransaction = (
  recurringTransactionId: string,
  transactionId: string,
  scheduledDate: number,
  occurrenceNumber: number,
  deviceId: string
): GeneratedTransaction => {
  const now = Date.now();

  return {
    id: nanoid(),
    recurring_transaction_id: recurringTransactionId,
    transaction_id: transactionId,
    scheduled_date: scheduledDate,
    created_date: now,
    occurrence_number: occurrenceNumber,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Validation: Ensure recurrence rule is valid
 */
export const validateRecurrenceRule = (rule: RecurrenceRule): string[] => {
  const errors: string[] = [];

  if (!rule.frequency) {
    errors.push('frequency is required');
  }

  if (!rule.interval || rule.interval < 1) {
    errors.push('interval must be at least 1');
  }

  if (!rule.startDate || rule.startDate < 0) {
    errors.push('startDate is required and must be valid');
  }

  if (!rule.endType) {
    errors.push('endType is required');
  }

  if (rule.endType === 'ON_DATE') {
    if (!rule.endDate) {
      errors.push('endDate is required when endType is ON_DATE');
    } else if (rule.endDate <= rule.startDate) {
      errors.push('endDate must be after startDate');
    }
  }

  if (rule.endType === 'AFTER_COUNT') {
    if (!rule.occurrenceCount || rule.occurrenceCount < 1) {
      errors.push('occurrenceCount must be at least 1 when endType is AFTER_COUNT');
    }
  }

  // Validate day of month for monthly/quarterly/annually
  if (
    (rule.frequency === 'MONTHLY' ||
      rule.frequency === 'QUARTERLY' ||
      rule.frequency === 'ANNUALLY') &&
    rule.dayOfMonth !== undefined
  ) {
    if (rule.dayOfMonth < 1 || rule.dayOfMonth > 31) {
      errors.push('dayOfMonth must be between 1 and 31');
    }
  }

  // Validate month for annually
  if (rule.frequency === 'ANNUALLY' && rule.monthOfYear !== undefined) {
    if (rule.monthOfYear < 1 || rule.monthOfYear > 12) {
      errors.push('monthOfYear must be between 1 and 12');
    }
  }

  return errors;
};

/**
 * Validation: Ensure transaction template is valid
 */
export const validateTransactionTemplate = (template: TransactionTemplate): string[] => {
  const errors: string[] = [];

  if (!template.type) {
    errors.push('type is required');
  }

  if (!template.lineItems || template.lineItems.length < 2) {
    errors.push('transaction must have at least 2 line items');
  }

  // Validate balance
  if (template.lineItems) {
    let totalDebits = 0;
    let totalCredits = 0;

    for (const item of template.lineItems) {
      if (!item.accountId) {
        errors.push('all line items must have an accountId');
      }

      const debit = parseFloat(item.debit || '0');
      const credit = parseFloat(item.credit || '0');

      if (debit < 0 || credit < 0) {
        errors.push('debit and credit amounts must be non-negative');
      }

      if (debit > 0 && credit > 0) {
        errors.push('line items cannot have both debit and credit amounts');
      }

      if (debit === 0 && credit === 0) {
        errors.push('line items must have either a debit or credit amount');
      }

      totalDebits += debit;
      totalCredits += credit;
    }

    const difference = Math.abs(totalDebits - totalCredits);
    if (difference >= 0.01) {
      errors.push(`transaction template is not balanced (difference: ${difference.toFixed(2)})`);
    }
  }

  return errors;
};

/**
 * Validation: Ensure recurring transaction has valid fields
 */
export const validateRecurringTransaction = (
  recurringTransaction: Partial<RecurringTransaction>
): string[] => {
  const errors: string[] = [];

  if (!recurringTransaction.company_id) {
    errors.push('company_id is required');
  }

  if (!recurringTransaction.name || recurringTransaction.name.trim() === '') {
    errors.push('name is required');
  }

  if (!recurringTransaction.auto_creation_mode) {
    errors.push('auto_creation_mode is required');
  }

  // Validate recurrence rule if present
  if (recurringTransaction.recurrence_rule) {
    try {
      const rule = JSON.parse(recurringTransaction.recurrence_rule) as RecurrenceRule;
      const ruleErrors = validateRecurrenceRule(rule);
      errors.push(...ruleErrors);
    } catch (e) {
      errors.push('recurrence_rule must be valid JSON');
    }
  }

  // Validate transaction template if present
  if (recurringTransaction.transaction_template) {
    try {
      const template = JSON.parse(
        recurringTransaction.transaction_template
      ) as TransactionTemplate;
      const templateErrors = validateTransactionTemplate(template);
      errors.push(...templateErrors);
    } catch (e) {
      errors.push('transaction_template must be valid JSON');
    }
  }

  return errors;
};

/**
 * Helper: Parse encrypted recurrence rule
 */
export const parseRecurrenceRule = (encryptedRule: string): RecurrenceRule => {
  return JSON.parse(encryptedRule) as RecurrenceRule;
};

/**
 * Helper: Parse encrypted transaction template
 */
export const parseTransactionTemplate = (encryptedTemplate: string): TransactionTemplate => {
  return JSON.parse(encryptedTemplate) as TransactionTemplate;
};

/**
 * Helper: Check if a recurring transaction should generate a new occurrence
 */
export const shouldGenerateOccurrence = (
  recurringTransaction: RecurringTransaction,
  currentTime: number
): boolean => {
  if (!recurringTransaction.active) {
    return false;
  }

  if (recurringTransaction.deleted_at !== null) {
    return false;
  }

  if (
    recurringTransaction.next_occurrence === null ||
    recurringTransaction.next_occurrence > currentTime
  ) {
    return false;
  }

  return true;
};

/**
 * Helper: Calculate time savings from recurring transactions
 * Assumes each manually entered transaction takes 5 minutes
 */
export const calculateTimeSavings = (generatedCount: number): number => {
  const MINUTES_PER_TRANSACTION = 5;
  return generatedCount * MINUTES_PER_TRANSACTION;
};
