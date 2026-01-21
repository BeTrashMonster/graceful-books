/**
 * Payment Split Service
 *
 * Handles splitting loan payments into principal and interest components,
 * creating GAAP-compliant journal entries.
 *
 * Requirements:
 * - H7: Interest Split Prompt System
 * - ACCT-009: GAAP-Compliant Journal Entries
 */

import Decimal from 'decimal.js';
import { nanoid } from 'nanoid';
import type { TreasureChestDB } from '../../db/database';
import type {
  SplitPaymentRequest,
  SplitPaymentResult,
  SplitValidationResult,
  LoanAccount,
} from '../../types/loanAmortization.types';
import type {
  JournalEntry,
  JournalEntryLineItem,
} from '../../types/journalEntry.types';
import type { Account } from '../../types/database.types';
import { TransactionType, TransactionStatus } from '../../types/database.types';

/**
 * Payment Split Service
 */
export class PaymentSplitService {
  private db: TreasureChestDB;

  constructor(db: TreasureChestDB) {
    this.db = db;
  }

  /**
   * Split a loan payment into principal and interest
   *
   * Creates a journal entry with three line items:
   * 1. Credit to cash/payment account (total payment)
   * 2. Debit to liability account (principal reduction)
   * 3. Debit to interest expense account (interest)
   */
  async splitPayment(
    request: SplitPaymentRequest,
    deviceId: string,
    userId: string
  ): Promise<SplitPaymentResult> {
    const errors: string[] = [];

    try {
      // Validate the split request
      const validation = await this.validateSplit(request);
      if (!validation.is_valid) {
        return {
          success: false,
          original_transaction_id: request.transaction_id,
          journal_entry_id: null,
          errors: validation.errors,
          principal_line_id: null,
          interest_line_id: null,
          payment_line_id: null,
        };
      }

      // Get loan account details
      const loanAccount = await this.getLoanAccount(request.loan_account_id);
      if (!loanAccount) {
        errors.push(`Loan account ${request.loan_account_id} not found`);
        return this.createErrorResult(request.transaction_id, errors);
      }

      // Get the original transaction to find the payment account
      const originalTransaction = await this.db.transactions.get(
        request.transaction_id
      );
      if (!originalTransaction) {
        errors.push(`Transaction ${request.transaction_id} not found`);
        return this.createErrorResult(request.transaction_id, errors);
      }

      // Find the payment account (typically cash or bank account)
      const paymentAccount = await this.findPaymentAccount(request.transaction_id);
      if (!paymentAccount) {
        errors.push('Could not determine payment account');
        return this.createErrorResult(request.transaction_id, errors);
      }

      // Create journal entry for the split
      const journalEntry = await this.createSplitJournalEntry(
        request,
        loanAccount,
        paymentAccount.id,
        originalTransaction.company_id,
        deviceId,
        userId
      );

      return {
        success: true,
        original_transaction_id: request.transaction_id,
        journal_entry_id: journalEntry.entry.id,
        errors: [],
        principal_line_id: journalEntry.line_items[0]?.id || null,
        interest_line_id: journalEntry.line_items[1]?.id || null,
        payment_line_id: journalEntry.line_items[2]?.id || null,
      };
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
      return this.createErrorResult(request.transaction_id, errors);
    }
  }

  /**
   * Validate a payment split request
   */
  async validateSplit(request: SplitPaymentRequest): Promise<SplitValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Convert to Decimal for precise comparison
    const totalPayment = new Decimal(request.total_payment_amount);
    const principal = new Decimal(request.principal_amount);
    const interest = new Decimal(request.interest_amount);

    // Rule 1: Principal + Interest must equal total payment
    const sum = principal.plus(interest);
    if (!sum.equals(totalPayment)) {
      errors.push(
        `Principal ($${principal.toFixed(2)}) + Interest ($${interest.toFixed(2)}) must equal total payment ($${totalPayment.toFixed(2)})`
      );
    }

    // Rule 2: Principal cannot be negative
    if (principal.lessThan(0)) {
      errors.push('Principal amount cannot be negative');
    }

    // Rule 3: Interest cannot be negative
    if (interest.lessThan(0)) {
      errors.push('Interest amount cannot be negative');
    }

    // Rule 4: Check if loan account exists
    const loanAccount = await this.getLoanAccount(request.loan_account_id);
    if (!loanAccount) {
      errors.push(`Loan account ${request.loan_account_id} not found`);
    } else {
      // Rule 5: Principal should not exceed current loan balance
      const currentBalance = new Decimal(loanAccount.current_balance);
      if (principal.greaterThan(currentBalance)) {
        warnings.push(
          `Principal amount ($${principal.toFixed(2)}) exceeds current loan balance ($${currentBalance.toFixed(2)})`
        );
      }

      // Rule 6: Check if accounts are correct type
      const liabilityAccount = await this.db.accounts.get(loanAccount.account_id);
      if (!liabilityAccount) {
        errors.push('Liability account not found');
      } else if (liabilityAccount.type !== 'LIABILITY') {
        errors.push('Loan account must be of type LIABILITY');
      }

      const interestAccount = await this.db.accounts.get(
        loanAccount.interest_expense_account_id
      );
      if (!interestAccount) {
        errors.push('Interest expense account not found');
      } else if (interestAccount.type !== 'EXPENSE') {
        errors.push('Interest expense account must be of type EXPENSE');
      }
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Create a journal entry for the payment split
   *
   * Journal entry structure:
   * DR Liability Account (Principal)
   * DR Interest Expense Account (Interest)
   *   CR Cash/Bank Account (Total Payment)
   */
  private async createSplitJournalEntry(
    request: SplitPaymentRequest,
    loanAccount: LoanAccount,
    paymentAccountId: string,
    companyId: string,
    deviceId: string,
    userId: string
  ): Promise<{ entry: JournalEntry; line_items: JournalEntryLineItem[] }> {
    const now = Date.now();
    const entryId = nanoid();

    // Create line items
    const lineItems: JournalEntryLineItem[] = [];

    // Line 1: Debit to liability account (principal reduction)
    lineItems.push({
      id: nanoid(),
      transaction_id: entryId,
      account_id: loanAccount.account_id,
      debit: request.principal_amount,
      credit: '0',
      description: 'Principal payment',
      contact_id: null,
      product_id: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
      line_number: 1,
      is_auto_balanced: false,
    });

    // Line 2: Debit to interest expense account
    lineItems.push({
      id: nanoid(),
      transaction_id: entryId,
      account_id: loanAccount.interest_expense_account_id,
      debit: request.interest_amount,
      credit: '0',
      description: 'Interest expense',
      contact_id: null,
      product_id: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
      line_number: 2,
      is_auto_balanced: false,
    });

    // Line 3: Credit to payment account (cash/bank)
    lineItems.push({
      id: nanoid(),
      transaction_id: entryId,
      account_id: paymentAccountId,
      debit: '0',
      credit: request.total_payment_amount,
      description: 'Loan payment',
      contact_id: null,
      product_id: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
      line_number: 3,
      is_auto_balanced: false,
    });

    // Create journal entry
    const entry: JournalEntry = {
      id: entryId,
      company_id: companyId,
      transaction_number: `JE-${Date.now()}`, // Temporary, should use sequence
      transaction_date: request.payment_date,
      type: TransactionType.JOURNAL_ENTRY,
      status: TransactionStatus.POSTED,
      description: `Loan payment split - Principal & Interest`,
      reference: request.schedule_entry_id || null,
      memo: request.notes || `Original transaction: ${request.transaction_id}`,
      attachments: [],
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
      approval_status: 'APPROVED',
      submitted_at: now,
      submitted_by: userId,
      approved_at: now,
      approved_by: userId,
      rejected_at: null,
      rejected_by: null,
      rejection_reason: null,
      is_reversing: false,
      reverses_entry_id: null,
      reversed_by_entry_id: null,
      auto_reverse_date: null,
      template_id: null,
      template_name: null,
    };

    // Save to database
    await this.db.transactions.add(entry);
    await this.db.transactionLineItems.bulkAdd(lineItems);

    return { entry, line_items: lineItems };
  }

  /**
   * Find the payment account from the original transaction
   */
  private async findPaymentAccount(
    transactionId: string
  ): Promise<Account | null> {
    // Get line items for the transaction
    const lineItems = await this.db.transactionLineItems
      .where('transaction_id')
      .equals(transactionId)
      .and((item) => !item.deleted_at)
      .toArray();

    // Look for debit to an ASSET account (typically cash/bank)
    for (const item of lineItems) {
      const account = await this.db.accounts.get(item.account_id);
      if (account && account.type === 'ASSET' && item.debit !== '0') {
        return account;
      }
    }

    return null;
  }

  /**
   * Get loan account (placeholder for when table exists)
   */
  private async getLoanAccount(_loanAccountId: string): Promise<LoanAccount | null> {
    // TODO: Implement when loan_accounts table exists
    return null;
  }

  /**
   * Create error result
   */
  private createErrorResult(
    transactionId: string,
    errors: string[]
  ): SplitPaymentResult {
    return {
      success: false,
      original_transaction_id: transactionId,
      journal_entry_id: null,
      errors,
      principal_line_id: null,
      interest_line_id: null,
      payment_line_id: null,
    };
  }
}
