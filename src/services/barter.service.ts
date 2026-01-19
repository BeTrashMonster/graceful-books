/**
 * Barter Transaction Service
 *
 * Provides specialized barter transaction operations with proper accounting
 * for exchanges of goods/services without cash.
 *
 * Key features:
 * - Creates offsetting income and expense journal entries
 * - Validates fair market value (FMV)
 * - Tracks 1099-B reportable transactions
 * - Provides tax compliance guidance
 *
 * Requirements:
 * - I5: Barter/Trade Transactions (Nice)
 * - GAAP compliance for barter accounting
 * - IRS tax compliance
 */

// @ts-ignore - uuid module has type issues
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import type { TreasureChestDB } from '../db/database';
import type {
  Transaction,
  TransactionLineItem,
  // TransactionStatus moved to regular import below
  TransactionType,
} from '../types/database.types';
import { AccountType, TransactionStatus } from '../types/database.types';
import type {
  BarterTransaction,
  BarterTransactionWithDetails,
  CreateBarterTransactionRequest,
  UpdateBarterTransactionRequest,
  BarterTransactionQueryFilters,
  BarterTransactionValidationResult,
  BarterTransactionStatistics,
  Barter1099Summary,
  Barter1099Data,
} from '../types/barter.types';
import {
  generateTransactionNumber,
} from '../db/schema/transactions.schema';

/**
 * Barter Transaction Service Class
 */
export class BarterService {
  private db: TreasureChestDB;

  constructor(db: TreasureChestDB) {
    this.db = db;
  }

  /**
   * Create a new barter transaction
   *
   * This creates three transactions:
   * 1. Main barter transaction (header)
   * 2. Income journal entry (credit income, debit barter clearing)
   * 3. Expense journal entry (debit expense, credit barter clearing)
   */
  async createBarterTransaction(
    request: CreateBarterTransactionRequest,
    deviceId: string,
    _userId: string
  ): Promise<BarterTransactionWithDetails> {
    // Validate the barter transaction
    const validation = this.validateBarterTransaction(request);
    if (!validation.is_valid) {
      throw new Error(`Barter transaction validation failed: ${validation.errors.join(', ')}`);
    }

    // Warn about FMV differences
    if (validation.warnings.length > 0) {
      console.warn('Barter transaction warnings:', validation.warnings);
    }

    const now = Date.now();
    const year = new Date(request.transaction_date).getFullYear();

    // Generate transaction numbers
    const barterSequence = await this.getNextBarterSequence(request.company_id, year);
    const barterNumber = generateTransactionNumber('BARTER' as TransactionType, year, barterSequence);

    const incomeSequence = await this.getNextJournalEntrySequence(request.company_id, year);
    const incomeNumber = generateTransactionNumber('JOURNAL_ENTRY' as TransactionType, year, incomeSequence);

    const expenseSequence = await this.getNextJournalEntrySequence(request.company_id, year);
    const expenseNumber = generateTransactionNumber('JOURNAL_ENTRY' as TransactionType, year, expenseSequence);

    // Create IDs
    const barterId = uuidv4();
    const incomeEntryId = uuidv4();
    const expenseEntryId = uuidv4();

    // Create the main barter transaction (header)
    const barterTransaction: BarterTransaction = {
      id: barterId,
      company_id: request.company_id,
      transaction_number: barterNumber,
      transaction_date: request.transaction_date,
      type: 'BARTER' as TransactionType,
      status: 'DRAFT' as TransactionStatus,
      description: `Barter: ${request.goods_received_description} for ${request.goods_provided_description}`,
      reference: request.reference || null,
      memo: request.memo || null,
      attachments: request.attachments || [],
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: {
        [deviceId]: 1,
      },
      // Barter-specific fields
      is_barter: true,
      goods_received_description: request.goods_received_description,
      goods_received_fmv: request.goods_received_fmv,
      goods_provided_description: request.goods_provided_description,
      goods_provided_fmv: request.goods_provided_fmv,
      fmv_basis: request.fmv_basis || null,
      fmv_documentation: request.fmv_documentation || [],
      is_1099_reportable: this.is1099Reportable(request.goods_received_fmv),
      tax_year: year,
      counterparty_contact_id: request.counterparty_contact_id || null,
      income_entry_id: incomeEntryId,
      expense_entry_id: expenseEntryId,
    };

    // Create income journal entry (goods/services received = income)
    // Debit: Barter Clearing Account (or A/R if contact specified)
    // Credit: Income Account
    const incomeEntry: Transaction = {
      id: incomeEntryId,
      company_id: request.company_id,
      transaction_number: incomeNumber,
      transaction_date: request.transaction_date,
      type: 'JOURNAL_ENTRY' as TransactionType,
      status: 'DRAFT' as TransactionStatus,
      description: `Barter Income: ${request.goods_received_description}`,
      reference: `BARTER-${barterNumber}`,
      memo: `Barter transaction - income side`,
      attachments: request.attachments || [],
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: {
        [deviceId]: 1,
      },
    };

    const incomeLineItems: TransactionLineItem[] = [
      // Debit barter clearing (or A/R)
      {
        id: uuidv4(),
        transaction_id: incomeEntryId,
        account_id: await this.getBarterClearingAccountId(request.company_id),
        debit: request.goods_received_fmv,
        credit: '0.00',
        description: `Barter: ${request.goods_received_description}`,
        contact_id: request.counterparty_contact_id || null,
        product_id: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version_vector: {
          [deviceId]: 1,
        },
      },
      // Credit income
      {
        id: uuidv4(),
        transaction_id: incomeEntryId,
        account_id: request.income_account_id,
        debit: '0.00',
        credit: request.goods_received_fmv,
        description: `Barter income: ${request.goods_received_description}`,
        contact_id: request.counterparty_contact_id || null,
        product_id: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version_vector: {
          [deviceId]: 1,
        },
      },
    ];

    // Create expense journal entry (goods/services provided = expense)
    // Debit: Expense Account
    // Credit: Barter Clearing Account (or A/P if contact specified)
    const expenseEntry: Transaction = {
      id: expenseEntryId,
      company_id: request.company_id,
      transaction_number: expenseNumber,
      transaction_date: request.transaction_date,
      type: 'JOURNAL_ENTRY' as TransactionType,
      status: 'DRAFT' as TransactionStatus,
      description: `Barter Expense: ${request.goods_provided_description}`,
      reference: `BARTER-${barterNumber}`,
      memo: `Barter transaction - expense side`,
      attachments: request.attachments || [],
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: {
        [deviceId]: 1,
      },
    };

    const expenseLineItems: TransactionLineItem[] = [
      // Debit expense
      {
        id: uuidv4(),
        transaction_id: expenseEntryId,
        account_id: request.expense_account_id,
        debit: request.goods_provided_fmv,
        credit: '0.00',
        description: `Barter expense: ${request.goods_provided_description}`,
        contact_id: request.counterparty_contact_id || null,
        product_id: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version_vector: {
          [deviceId]: 1,
        },
      },
      // Credit barter clearing (or A/P)
      {
        id: uuidv4(),
        transaction_id: expenseEntryId,
        account_id: await this.getBarterClearingAccountId(request.company_id),
        debit: '0.00',
        credit: request.goods_provided_fmv,
        description: `Barter: ${request.goods_provided_description}`,
        contact_id: request.counterparty_contact_id || null,
        product_id: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version_vector: {
          [deviceId]: 1,
        },
      },
    ];

    // Save to database in a transaction-like manner
    await this.db.transactions.add(barterTransaction);
    await this.db.transactions.add(incomeEntry);
    await this.db.transactions.add(expenseEntry);
    await this.db.transactionLineItems.bulkAdd([...incomeLineItems, ...expenseLineItems]);

    return this.getBarterTransactionWithDetails(barterId);
  }

  /**
   * Get barter transaction with all details
   */
  async getBarterTransactionWithDetails(barterId: string): Promise<BarterTransactionWithDetails> {
    const barter = await this.db.transactions.get(barterId);
    if (!barter || barter.type !== 'BARTER') {
      throw new Error(`Barter transaction not found: ${barterId}`);
    }

    const barterTxn = barter as BarterTransaction;

    // Get income entry and line items
    const incomeEntry = barterTxn.income_entry_id
      ? await this.db.transactions.get(barterTxn.income_entry_id)
      : null;
    const incomeLineItems = barterTxn.income_entry_id
      ? await this.db.transactionLineItems
          .where('transaction_id')
          .equals(barterTxn.income_entry_id)
          .and((item: TransactionLineItem) => item.deleted_at === null)
          .toArray()
      : [];

    // Get expense entry and line items
    const expenseEntry = barterTxn.expense_entry_id
      ? await this.db.transactions.get(barterTxn.expense_entry_id)
      : null;
    const expenseLineItems = barterTxn.expense_entry_id
      ? await this.db.transactionLineItems
          .where('transaction_id')
          .equals(barterTxn.expense_entry_id)
          .and((item: TransactionLineItem) => item.deleted_at === null)
          .toArray()
      : [];

    return {
      barter: barterTxn,
      income_entry: incomeEntry || null,
      expense_entry: expenseEntry || null,
      income_line_items: incomeLineItems,
      expense_line_items: expenseLineItems,
    };
  }

  /**
   * Validate barter transaction
   */
  validateBarterTransaction(
    request: CreateBarterTransactionRequest | UpdateBarterTransactionRequest
  ): BarterTransactionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract FMV values (handle both create and update requests)
    const receivedFMV = (request as CreateBarterTransactionRequest).goods_received_fmv || '0.00';
    const providedFMV = (request as CreateBarterTransactionRequest).goods_provided_fmv || '0.00';

    // Validate FMV amounts
    let fmvReceived: Decimal;
    let fmvProvided: Decimal;

    try {
      fmvReceived = new Decimal(receivedFMV);
      fmvProvided = new Decimal(providedFMV);
    } catch (e) {
      errors.push('Invalid fair market value format');
      return {
        is_valid: false,
        errors,
        warnings,
        fmv_received: '0.00',
        fmv_provided: '0.00',
        fmv_difference: '0.00',
        fmv_difference_percentage: '0.00',
      };
    }

    // Validate positive amounts
    if (fmvReceived.lte(0)) {
      errors.push('Fair market value of goods received must be greater than zero');
    }

    if (fmvProvided.lte(0)) {
      errors.push('Fair market value of goods provided must be greater than zero');
    }

    // Validate descriptions (only for create requests)
    const createRequest = request as CreateBarterTransactionRequest;
    const receivedDesc = createRequest.goods_received_description;
    const providedDesc = createRequest.goods_provided_description;

    if (createRequest.goods_received_description !== undefined) {
      if (!receivedDesc || !receivedDesc.trim()) {
        errors.push('Description of goods/services received is required');
      }
    }

    if (createRequest.goods_provided_description !== undefined) {
      if (!providedDesc || !providedDesc.trim()) {
        errors.push('Description of goods/services provided is required');
      }
    }

    // Calculate FMV difference
    const fmvDifference = fmvReceived.minus(fmvProvided).abs();
    const fmvDifferencePercentage = fmvReceived.gt(0)
      ? fmvDifference.div(fmvReceived).mul(100)
      : new Decimal(0);

    // Warn about significant FMV differences (>20%)
    if (fmvDifferencePercentage.gt(20)) {
      warnings.push(
        `Fair market values differ by ${fmvDifferencePercentage.toFixed(1)}%. ` +
        'Consider documenting the reason for the difference.'
      );
    }

    // Warn about FMV basis if not provided
    if (!(request as CreateBarterTransactionRequest).fmv_basis && receivedDesc) {
      warnings.push(
        'Consider documenting how fair market value was determined for tax compliance.'
      );
    }

    // Warn about 1099-B reporting if FMV >= $600
    if (fmvReceived.gte(600)) {
      warnings.push(
        'This transaction may require 1099-B reporting. ' +
        'Ensure counterparty information is complete.'
      );
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings,
      fmv_received: fmvReceived.toFixed(2),
      fmv_provided: fmvProvided.toFixed(2),
      fmv_difference: fmvDifference.toFixed(2),
      fmv_difference_percentage: fmvDifferencePercentage.toFixed(2),
    };
  }

  /**
   * Update barter transaction
   */
  async updateBarterTransaction(
    request: UpdateBarterTransactionRequest,
    deviceId: string
  ): Promise<BarterTransactionWithDetails> {
    const barter = await this.db.transactions.get(request.barter_id);
    if (!barter || barter.type !== 'BARTER') {
      throw new Error(`Barter transaction not found: ${request.barter_id}`);
    }

    const barterTxn = barter as BarterTransaction;

    // Can only update draft transactions
    if (barterTxn.status !== 'DRAFT') {
      throw new Error(`Cannot update barter transaction in ${barterTxn.status} status`);
    }

    const now = Date.now();

    // Update barter transaction
    await this.db.transactions.update(request.barter_id, {
      ...request,
      updated_at: now,
      version_vector: {
        ...barterTxn.version_vector,
        [deviceId]: (barterTxn.version_vector[deviceId] || 0) + 1,
      },
    });

    // TODO: Update income and expense entries if FMV changed
    // This would require updating the line item amounts

    return this.getBarterTransactionWithDetails(request.barter_id);
  }

  /**
   * Post barter transaction (change status to POSTED)
   */
  async postBarterTransaction(barterId: string, deviceId: string): Promise<void> {
    const barter = await this.db.transactions.get(barterId);
    if (!barter || barter.type !== 'BARTER') {
      throw new Error(`Barter transaction not found: ${barterId}`);
    }

    const barterTxn = barter as BarterTransaction;

    if (barterTxn.status !== 'DRAFT') {
      throw new Error(`Cannot post barter transaction in ${barterTxn.status} status`);
    }

    const now = Date.now();

    // Update barter transaction status
    await this.db.transactions.update(barterId, {
      status: TransactionStatus.POSTED,
      updated_at: now,
      version_vector: {
        ...barterTxn.version_vector,
        [deviceId]: (barterTxn.version_vector[deviceId] || 0) + 1,
      },
    });

    // Update income entry status
    if (barterTxn.income_entry_id) {
      const incomeEntry = await this.db.transactions.get(barterTxn.income_entry_id);
      if (incomeEntry) {
        await this.db.transactions.update(barterTxn.income_entry_id, {
          status: TransactionStatus.POSTED,
          updated_at: now,
          version_vector: {
            ...incomeEntry.version_vector,
            [deviceId]: (incomeEntry.version_vector[deviceId] || 0) + 1,
          },
        });
      }
    }

    // Update expense entry status
    if (barterTxn.expense_entry_id) {
      const expenseEntry = await this.db.transactions.get(barterTxn.expense_entry_id);
      if (expenseEntry) {
        await this.db.transactions.update(barterTxn.expense_entry_id, {
          status: TransactionStatus.POSTED,
          updated_at: now,
          version_vector: {
            ...expenseEntry.version_vector,
            [deviceId]: (expenseEntry.version_vector[deviceId] || 0) + 1,
          },
        });
      }
    }
  }

  /**
   * Void barter transaction
   */
  async voidBarterTransaction(barterId: string, deviceId: string, reason: string): Promise<void> {
    const barter = await this.db.transactions.get(barterId);
    if (!barter || barter.type !== 'BARTER') {
      throw new Error(`Barter transaction not found: ${barterId}`);
    }

    const barterTxn = barter as BarterTransaction;

    if (barterTxn.status === 'VOID') {
      throw new Error('Barter transaction is already voided');
    }

    const now = Date.now();

    // Update barter transaction status
    await this.db.transactions.update(barterId, {
      status: TransactionStatus.VOID,
      memo: `${barterTxn.memo || ''}\nVOIDED: ${reason}`,
      updated_at: now,
      version_vector: {
        ...barterTxn.version_vector,
        [deviceId]: (barterTxn.version_vector[deviceId] || 0) + 1,
      },
    });

    // Void income entry
    if (barterTxn.income_entry_id) {
      const incomeEntry = await this.db.transactions.get(barterTxn.income_entry_id);
      if (incomeEntry) {
        await this.db.transactions.update(barterTxn.income_entry_id, {
          status: TransactionStatus.VOID,
          updated_at: now,
          version_vector: {
            ...incomeEntry.version_vector,
            [deviceId]: (incomeEntry.version_vector[deviceId] || 0) + 1,
          },
        });
      }
    }

    // Void expense entry
    if (barterTxn.expense_entry_id) {
      const expenseEntry = await this.db.transactions.get(barterTxn.expense_entry_id);
      if (expenseEntry) {
        await this.db.transactions.update(barterTxn.expense_entry_id, {
          status: TransactionStatus.VOID,
          updated_at: now,
          version_vector: {
            ...expenseEntry.version_vector,
            [deviceId]: (expenseEntry.version_vector[deviceId] || 0) + 1,
          },
        });
      }
    }
  }

  /**
   * Query barter transactions
   */
  async queryBarterTransactions(
    filters: BarterTransactionQueryFilters
  ): Promise<BarterTransaction[]> {
    let query = this.db.transactions
      .where('company_id')
      .equals(filters.company_id);

    const results = await query.toArray();

    // Filter for barter transactions
    let barterTransactions = results.filter(
      (txn: Transaction) => txn.type === 'BARTER' && txn.deleted_at === null
    ) as BarterTransaction[];

    // Apply additional filters
    if (filters.status && filters.status.length > 0) {
      barterTransactions = barterTransactions.filter((txn) =>
        filters.status!.includes(txn.status)
      );
    }

    if (filters.date_from) {
      barterTransactions = barterTransactions.filter(
        (txn) => txn.transaction_date >= filters.date_from!
      );
    }

    if (filters.date_to) {
      barterTransactions = barterTransactions.filter(
        (txn) => txn.transaction_date <= filters.date_to!
      );
    }

    if (filters.tax_year) {
      barterTransactions = barterTransactions.filter(
        (txn) => txn.tax_year === filters.tax_year
      );
    }

    if (filters.is_1099_reportable !== undefined) {
      barterTransactions = barterTransactions.filter(
        (txn) => txn.is_1099_reportable === filters.is_1099_reportable
      );
    }

    if (filters.counterparty_contact_id) {
      barterTransactions = barterTransactions.filter(
        (txn) => txn.counterparty_contact_id === filters.counterparty_contact_id
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      barterTransactions = barterTransactions.filter(
        (txn) =>
          txn.goods_received_description.toLowerCase().includes(searchLower) ||
          txn.goods_provided_description.toLowerCase().includes(searchLower) ||
          (txn.description && txn.description.toLowerCase().includes(searchLower))
      );
    }

    // Apply pagination
    if (filters.offset) {
      barterTransactions = barterTransactions.slice(filters.offset);
    }

    if (filters.limit) {
      barterTransactions = barterTransactions.slice(0, filters.limit);
    }

    return barterTransactions;
  }

  /**
   * Get barter transaction statistics
   */
  async getBarterStatistics(
    companyId: string,
    taxYear: number
  ): Promise<BarterTransactionStatistics> {
    const transactions = await this.queryBarterTransactions({
      company_id: companyId,
      tax_year: taxYear,
    });

    const totalIncomeFMV = transactions.reduce((sum, txn) => {
      return sum.plus(new Decimal(txn.goods_received_fmv));
    }, new Decimal(0));

    const totalExpenseFMV = transactions.reduce((sum, txn) => {
      return sum.plus(new Decimal(txn.goods_provided_fmv));
    }, new Decimal(0));

    const byStatus = transactions.reduce((acc, txn) => {
      acc[txn.status] = (acc[txn.status] || 0) + 1;
      return acc;
    }, {} as Record<TransactionStatus, number>);

    const byMonth = transactions.reduce((acc, txn) => {
      const date = new Date(txn.transaction_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      acc[monthKey] = (acc[monthKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      company_id: companyId,
      tax_year: taxYear,
      total_transactions: transactions.length,
      total_income_fmv: totalIncomeFMV.toFixed(2),
      total_expense_fmv: totalExpenseFMV.toFixed(2),
      reportable_1099_count: transactions.filter((txn) => txn.is_1099_reportable).length,
      by_status: byStatus,
      by_month: byMonth,
    };
  }

  /**
   * Get 1099-B summary for tax year
   */
  async get1099BSummary(companyId: string, taxYear: number): Promise<Barter1099Summary> {
    const transactions = await this.queryBarterTransactions({
      company_id: companyId,
      tax_year: taxYear,
      is_1099_reportable: true,
    });

    // Group by counterparty
    const counterpartyMap = new Map<string, BarterTransaction[]>();
    for (const txn of transactions) {
      if (txn.counterparty_contact_id) {
        const key = txn.counterparty_contact_id;
        if (!counterpartyMap.has(key)) {
          counterpartyMap.set(key, []);
        }
        counterpartyMap.get(key)!.push(txn);
      }
    }

    // Build counterparty data
    const counterparties: Barter1099Data[] = [];
    for (const [contactId, txns] of counterpartyMap) {
      const contact = await this.db.contacts?.get(contactId);
      if (!contact) continue;

      const totalFMV = txns.reduce((sum, txn) => {
        return sum.plus(new Decimal(txn.goods_received_fmv));
      }, new Decimal(0));

      counterparties.push({
        company_id: companyId,
        tax_year: taxYear,
        counterparty_contact_id: contactId,
        counterparty_name: contact.name,
        counterparty_tax_id: contact.tax_id || null,
        counterparty_address: contact.address || null,
        total_fmv: totalFMV.toFixed(2),
        transaction_count: txns.length,
        transactions: txns,
      });
    }

    const totalReportableIncome = counterparties.reduce((sum, cp) => {
      return sum.plus(new Decimal(cp.total_fmv));
    }, new Decimal(0));

    return {
      company_id: companyId,
      tax_year: taxYear,
      total_reportable_income: totalReportableIncome.toFixed(2),
      counterparty_count: counterparties.length,
      counterparties,
    };
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  /**
   * Check if barter transaction is 1099-B reportable
   * IRS requires 1099-B if FMV >= $600
   */
  private is1099Reportable(fmv: string): boolean {
    const fmvDecimal = new Decimal(fmv);
    return fmvDecimal.gte(600);
  }

  /**
   * Get next barter transaction sequence number
   */
  private async getNextBarterSequence(companyId: string, year: number): Promise<number> {
    const transactions = await this.db.transactions
      .where('company_id')
      .equals(companyId)
      .and((txn: Transaction) => {
        if (txn.type !== 'BARTER') return false;
        const txnYear = new Date(txn.transaction_date).getFullYear();
        return txnYear === year;
      })
      .count();

    return transactions + 1;
  }

  /**
   * Get next journal entry sequence number
   */
  private async getNextJournalEntrySequence(companyId: string, year: number): Promise<number> {
    const transactions = await this.db.transactions
      .where('company_id')
      .equals(companyId)
      .and((txn: Transaction) => {
        if (txn.type !== 'JOURNAL_ENTRY') return false;
        const txnYear = new Date(txn.transaction_date).getFullYear();
        return txnYear === year;
      })
      .count();

    return transactions + 1;
  }

  /**
   * Get or create barter clearing account
   * This is a temporary account used to balance barter transactions
   */
  private async getBarterClearingAccountId(companyId: string): Promise<string> {
    // Try to find existing barter clearing account
    const accounts = await this.db.accounts
      ?.where('company_id')
      .equals(companyId)
      .and((acc) => acc.name === 'Barter Clearing' && acc.deleted_at === null)
      .toArray();

    if (accounts && accounts.length > 0) {
      return accounts[0]!.id;
    }

    // Create barter clearing account if it doesn't exist
    const accountId = uuidv4();
    const now = Date.now();

    await this.db.accounts?.add({
      id: accountId,
      company_id: companyId,
      account_number: '1299',
      name: 'Barter Clearing',
      type: AccountType.ASSET,
      parent_id: null,
      balance: '0.00',
      description: 'Temporary clearing account for barter transactions',
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: {
        system: 1,
      },
    });

    return accountId;
  }
}
