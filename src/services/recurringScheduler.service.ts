/**
 * Recurring Transaction Scheduler Service
 *
 * Service for automatically creating transactions from recurring transaction rules.
 * Handles both auto-creation and draft-for-approval modes.
 *
 * Requirements:
 * - E2: Recurring Transactions [MVP]
 * - Generate transactions reliably at scheduled times
 * - Support both auto-create and draft modes
 */

import { nanoid } from 'nanoid';
import { db } from '../db/database';
import {
  getDueRecurringTransactions,
  updateOccurrenceTimes,
  recordGeneratedTransaction,
  type EncryptionContext,
} from '../store/recurringTransactions';
import { calculateNextOccurrence, getDueOccurrences } from './recurrence.service';
import type {
  RecurringTransactionSummary,
  TransactionTemplate,
} from '../types/recurring.types';
import type { Transaction, TransactionLineItem, TransactionStatus } from '../types/database.types';

/**
 * Result of processing recurring transactions
 */
export interface ProcessResult {
  processed: number;
  created: number;
  errors: Array<{
    recurringTransactionId: string;
    recurringTransactionName: string;
    error: string;
  }>;
}

/**
 * Get device ID from localStorage
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = nanoid();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

/**
 * Generate transaction number
 * Format: PREFIX-YYYY-NNNN
 */
async function generateTransactionNumber(
  companyId: string,
  type: string,
  date: number
): Promise<string> {
  const year = new Date(date).getFullYear();
  const prefix = getTransactionTypePrefix(type);

  // Count existing transactions for this company, type, and year
  const existingCount = await db.transactions
    .where('company_id')
    .equals(companyId)
    .and((txn) => {
      if (txn.type !== type) return false;
      const txnYear = new Date(txn.transaction_date).getFullYear();
      return txnYear === year;
    })
    .count();

  const sequence = existingCount + 1;
  const paddedSequence = sequence.toString().padStart(4, '0');

  return `${prefix}-${year}-${paddedSequence}`;
}

/**
 * Get transaction type prefix
 */
function getTransactionTypePrefix(type: string): string {
  const prefixes: Record<string, string> = {
    JOURNAL_ENTRY: 'JE',
    INVOICE: 'INV',
    PAYMENT: 'PMT',
    EXPENSE: 'EXP',
    BILL: 'BILL',
    CREDIT_NOTE: 'CN',
    ADJUSTMENT: 'ADJ',
  };

  return prefixes[type] || 'TXN';
}

/**
 * Create a transaction from a template
 */
async function createTransactionFromTemplate(
  companyId: string,
  template: TransactionTemplate,
  transactionDate: number,
  autoCreationMode: 'AUTO' | 'DRAFT',
  userId: string,
  context?: EncryptionContext
): Promise<string> {
  const now = Date.now();
  const deviceId = getDeviceId();

  // Generate transaction number
  const transactionNumber = await generateTransactionNumber(
    companyId,
    template.type,
    transactionDate
  );

  // Determine status based on auto-creation mode
  const status: TransactionStatus = autoCreationMode === 'AUTO' ? 'POSTED' : 'DRAFT';

  // Create transaction
  const transactionId = nanoid();
  const transaction: Transaction = {
    id: transactionId,
    company_id: companyId,
    transaction_number: transactionNumber,
    transaction_date: transactionDate,
    type: template.type,
    status,
    description: template.description,
    reference: template.reference,
    memo: template.memo,
    attachments: template.attachments || [],
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };

  // Encrypt sensitive fields if encryption service provided
  if (context?.encryptionService) {
    if (transaction.description) {
      transaction.description = await context.encryptionService.encrypt(transaction.description);
    }
    if (transaction.reference) {
      transaction.reference = await context.encryptionService.encrypt(transaction.reference);
    }
    if (transaction.memo) {
      transaction.memo = await context.encryptionService.encrypt(transaction.memo);
    }
  }

  await db.transactions.add(transaction);

  // Create line items
  for (const lineTemplate of template.lineItems) {
    const lineItemId = nanoid();
    const lineItem: TransactionLineItem = {
      id: lineItemId,
      transaction_id: transactionId,
      account_id: lineTemplate.accountId,
      debit: lineTemplate.debit,
      credit: lineTemplate.credit,
      description: lineTemplate.description,
      contact_id: lineTemplate.contactId || null,
      product_id: lineTemplate.productId || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: {
        [deviceId]: 1,
      },
    };

    // Encrypt sensitive fields
    if (context?.encryptionService && lineItem.description) {
      lineItem.description = await context.encryptionService.encrypt(lineItem.description);
    }

    // Encrypt amounts
    if (context?.encryptionService) {
      lineItem.debit = await context.encryptionService.encrypt(lineItem.debit);
      lineItem.credit = await context.encryptionService.encrypt(lineItem.credit);
    }

    await db.transactionLineItems.add(lineItem);
  }

  return transactionId;
}

/**
 * Process a single recurring transaction
 */
async function processRecurringTransaction(
  recurringTransaction: RecurringTransactionSummary,
  currentTime: number,
  userId: string,
  context?: EncryptionContext
): Promise<number> {
  let createdCount = 0;

  try {
    // Get due occurrences
    const dueOccurrences = getDueOccurrences(
      recurringTransaction.recurrence_rule,
      recurringTransaction.last_created,
      currentTime
    );

    // Process each due occurrence
    for (const occurrence of dueOccurrences) {
      const occurrenceTime = occurrence.getTime();

      // Create transaction from template
      const transactionId = await createTransactionFromTemplate(
        recurringTransaction.company_id,
        recurringTransaction.transaction_template,
        occurrenceTime,
        recurringTransaction.auto_creation_mode,
        userId,
        context
      );

      // Record the generated transaction
      await recordGeneratedTransaction(
        recurringTransaction.id,
        transactionId,
        occurrenceTime,
        recurringTransaction.created_count + createdCount + 1
      );

      createdCount++;
    }

    // Calculate next occurrence
    const nextOccurrence = calculateNextOccurrence(
      recurringTransaction.recurrence_rule,
      currentTime
    );

    // Update recurring transaction with new times
    await updateOccurrenceTimes(recurringTransaction.id, currentTime, nextOccurrence);

    return createdCount;
  } catch (error) {
    console.error(
      `Error processing recurring transaction ${recurringTransaction.id}:`,
      error
    );
    throw error;
  }
}

/**
 * Process all due recurring transactions for a company
 */
export async function processRecurringTransactionsForCompany(
  companyId: string,
  userId: string,
  currentTime: number = Date.now(),
  context?: EncryptionContext
): Promise<ProcessResult> {
  const result: ProcessResult = {
    processed: 0,
    created: 0,
    errors: [],
  };

  try {
    // Get all due recurring transactions
    const dueTransactions = await getDueRecurringTransactions(companyId, currentTime, context);

    console.log(`Processing ${dueTransactions.length} due recurring transactions for company ${companyId}`);

    // Process each recurring transaction
    for (const recurringTxn of dueTransactions) {
      try {
        const created = await processRecurringTransaction(
          recurringTxn,
          currentTime,
          userId,
          context
        );

        result.processed++;
        result.created += created;

        console.log(
          `Processed recurring transaction ${recurringTxn.id} (${recurringTxn.name}): created ${created} transactions`
        );
      } catch (error) {
        result.errors.push({
          recurringTransactionId: recurringTxn.id,
          recurringTransactionName: recurringTxn.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        console.error(
          `Failed to process recurring transaction ${recurringTxn.id}:`,
          error
        );
      }
    }

    console.log(
      `Recurring transaction processing complete: ${result.processed} processed, ${result.created} transactions created, ${result.errors.length} errors`
    );

    return result;
  } catch (error) {
    console.error('Error processing recurring transactions:', error);
    throw error;
  }
}

/**
 * Start the recurring transaction scheduler
 * Checks for due recurring transactions periodically
 */
export class RecurringTransactionScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs: number;
  private readonly companyId: string;
  private readonly userId: string;
  private readonly context?: EncryptionContext;

  constructor(
    companyId: string,
    userId: string,
    checkIntervalMs: number = 60000, // Default: check every minute
    context?: EncryptionContext
  ) {
    this.companyId = companyId;
    this.userId = userId;
    this.checkIntervalMs = checkIntervalMs;
    this.context = context;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.intervalId !== null) {
      console.warn('Scheduler is already running');
      return;
    }

    console.log(`Starting recurring transaction scheduler (interval: ${this.checkIntervalMs}ms)`);

    // Run immediately
    this.checkAndProcess();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.checkAndProcess();
    }, this.checkIntervalMs);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Stopped recurring transaction scheduler');
    }
  }

  /**
   * Check for due recurring transactions and process them
   */
  private async checkAndProcess(): Promise<void> {
    try {
      const result = await processRecurringTransactionsForCompany(
        this.companyId,
        this.userId,
        Date.now(),
        this.context
      );

      if (result.created > 0) {
        console.log(`Created ${result.created} transactions from recurring rules`);
      }

      if (result.errors.length > 0) {
        console.error(`Encountered ${result.errors.length} errors while processing recurring transactions`);
      }
    } catch (error) {
      console.error('Error in recurring transaction scheduler:', error);
    }
  }

  /**
   * Get scheduler status
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }
}
