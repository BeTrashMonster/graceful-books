/**
 * Journal Entries Service
 *
 * Provides specialized journal entry operations on top of the core transaction system.
 * Implements:
 * - Journal entry CRUD with approval workflow
 * - Multi-line entry management with balance validation
 * - Template application
 * - Reversing entry creation
 * - Plain English mode support
 *
 * Requirements:
 * - F7: Journal Entries (Full)
 * - ACCT-005: Journal Entry Features
 */

import { v4 as uuidv4 } from 'uuid';
import type { Database } from '../db/database';
import type {
  Transaction,
  TransactionLineItem,
  TransactionStatus,
} from '../types/database.types';
import { TransactionType } from '../types/database.types';
import type {
  JournalEntry,
  JournalEntryLineItem,
  JournalEntryTemplate,
  CreateJournalEntryRequest,
  UpdateJournalEntryRequest,
  ApproveJournalEntryRequest,
  RejectJournalEntryRequest,
  VoidJournalEntryRequest,
  JournalEntryQueryFilters,
  JournalEntryWithLineItems,
  CreateReversingEntryOptions,
  JournalEntryValidationResult,
  JournalEntryStatistics,
} from '../types/journalEntry.types';
import {
  validateTransactionBalance,
  generateTransactionNumber,
} from '../db/schema/transactions.schema';

/**
 * Journal Entries Service Class
 */
export class JournalEntriesService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Create a new journal entry
   */
  async createJournalEntry(
    request: CreateJournalEntryRequest,
    deviceId: string,
    userId: string
  ): Promise<JournalEntryWithLineItems> {
    // Validate line items balance
    const validation = this.validateJournalEntry(request);
    if (!validation.is_valid) {
      throw new Error(`Journal entry validation failed: ${validation.errors.join(', ')}`);
    }

    // Generate transaction number
    const year = new Date(request.transaction_date).getFullYear();
    const sequence = await this.getNextJournalEntrySequence(request.company_id, year);
    const transactionNumber = generateTransactionNumber(TransactionType.JOURNAL_ENTRY, year, sequence);

    const now = Date.now();
    const entryId = uuidv4();

    // Create the transaction (journal entry header)
    const entry: JournalEntry = {
      id: entryId,
      company_id: request.company_id,
      transaction_number: transactionNumber,
      transaction_date: request.transaction_date,
      type: 'JOURNAL_ENTRY' as TransactionType,
      status: 'DRAFT' as TransactionStatus,
      description: request.description,
      reference: request.reference || null,
      memo: request.memo || null,
      attachments: request.attachments || [],
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: {
        [deviceId]: 1,
      },
      // Journal entry specific fields
      approval_status: request.submit_for_approval ? 'PENDING' : 'DRAFT',
      submitted_at: request.submit_for_approval ? now : null,
      submitted_by: request.submit_for_approval ? userId : null,
      approved_at: null,
      approved_by: null,
      rejected_at: null,
      rejected_by: null,
      rejection_reason: null,
      is_reversing: request.is_reversing || false,
      reverses_entry_id: request.reverses_entry_id || null,
      reversed_by_entry_id: null,
      auto_reverse_date: request.auto_reverse_date || null,
      template_id: request.template_id || null,
      template_name: null, // Will be populated from template if used
    };

    // Create line items
    const lineItems: JournalEntryLineItem[] = request.line_items.map((item, index) => ({
      id: uuidv4(),
      transaction_id: entryId,
      account_id: item.account_id,
      debit: item.debit,
      credit: item.credit,
      description: item.description || null,
      contact_id: item.contact_id || null,
      product_id: item.product_id || null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: {
        [deviceId]: 1,
      },
      line_number: index + 1,
      is_auto_balanced: false,
    }));

    // Save to database
    await this.db.transactions.add(entry);
    await this.db.transaction_line_items.bulkAdd(lineItems);

    // If this is a reversing entry, update the original entry
    if (request.reverses_entry_id) {
      await this.markEntryAsReversed(request.reverses_entry_id, entryId, deviceId);
    }

    return this.getJournalEntryWithLineItems(entryId);
  }

  /**
   * Get journal entry with line items
   */
  async getJournalEntryWithLineItems(entryId: string): Promise<JournalEntryWithLineItems> {
    const entry = await this.db.transactions.get(entryId);
    if (!entry) {
      throw new Error(`Journal entry not found: ${entryId}`);
    }

    const lineItems = await this.db.transaction_line_items
      .where('transaction_id')
      .equals(entryId)
      .and((item: TransactionLineItem) => item.deleted_at === null)
      .toArray();

    const balanceResult = validateTransactionBalance(lineItems);

    return {
      entry: entry as JournalEntry,
      line_items: lineItems as JournalEntryLineItem[],
      total_debits: balanceResult.totalDebits,
      total_credits: balanceResult.totalCredits,
      is_balanced: balanceResult.isBalanced,
      can_edit: this.canEditEntry(entry as JournalEntry),
      can_approve: this.canApproveEntry(entry as JournalEntry),
      can_void: this.canVoidEntry(entry as JournalEntry),
    };
  }

  /**
   * Get all journal entries for a company with filters
   */
  async getJournalEntries(filters: JournalEntryQueryFilters): Promise<JournalEntryWithLineItems[]> {
    let query = this.db.transactions
      .where('company_id')
      .equals(filters.company_id)
      .and((entry: Transaction) => entry.type === 'JOURNAL_ENTRY' && entry.deleted_at === null);

    const entries = await query.toArray();

    // Apply filters
    let filteredEntries = entries;

    if (filters.approval_status && filters.approval_status.length > 0) {
      filteredEntries = filteredEntries.filter(
        (e: Transaction) => filters.approval_status!.includes((e as JournalEntry).approval_status)
      );
    }

    if (filters.date_from) {
      filteredEntries = filteredEntries.filter((e: Transaction) => e.transaction_date >= filters.date_from!);
    }

    if (filters.date_to) {
      filteredEntries = filteredEntries.filter((e: Transaction) => e.transaction_date <= filters.date_to!);
    }

    if (filters.is_reversing !== undefined) {
      filteredEntries = filteredEntries.filter(
        (e: Transaction) => (e as JournalEntry).is_reversing === filters.is_reversing
      );
    }

    if (filters.template_id) {
      filteredEntries = filteredEntries.filter(
        (e: Transaction) => (e as JournalEntry).template_id === filters.template_id
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredEntries = filteredEntries.filter(
        (e: Transaction) =>
          e.description?.toLowerCase().includes(searchLower) ||
          e.reference?.toLowerCase().includes(searchLower) ||
          e.transaction_number.toLowerCase().includes(searchLower)
      );
    }

    // Get with line items
    const results: JournalEntryWithLineItems[] = [];
    for (const entry of filteredEntries) {
      results.push(await this.getJournalEntryWithLineItems(entry.id));
    }

    return results;
  }

  /**
   * Update a journal entry (only if in DRAFT status)
   */
  async updateJournalEntry(
    entryId: string,
    request: Omit<UpdateJournalEntryRequest, 'entry_id'>,
    deviceId: string
  ): Promise<JournalEntryWithLineItems> {
    const entry = await this.db.transactions.get(entryId);
    if (!entry) {
      throw new Error(`Journal entry not found: ${entryId}`);
    }

    const journalEntry = entry as JournalEntry;
    if (!this.canEditEntry(journalEntry)) {
      throw new Error(`Cannot edit journal entry in ${journalEntry.approval_status} status`);
    }

    // Update entry fields
    const now = Date.now();
    const updates: Partial<JournalEntry> = {
      updated_at: now,
      version_vector: {
        ...entry.version_vector,
        [deviceId]: (entry.version_vector[deviceId] || 0) + 1,
      },
    };

    // Reset status to DRAFT if updating a rejected entry
    if (journalEntry.approval_status === 'REJECTED') {
      updates.approval_status = 'DRAFT';
      updates.rejected_by = null;
      updates.rejection_reason = null;
    }

    if (request.transaction_date !== undefined) updates.transaction_date = request.transaction_date;
    if (request.description !== undefined) updates.description = request.description;
    if (request.reference !== undefined) updates.reference = request.reference;
    if (request.memo !== undefined) updates.memo = request.memo;
    if (request.attachments !== undefined) updates.attachments = request.attachments;

    await this.db.transactions.update(entryId, updates);

    // Update line items if provided
    if (request.line_items) {
      // Validate new line items
      const validation = this.validateJournalEntry({
        company_id: entry.company_id,
        transaction_date: request.transaction_date || entry.transaction_date,
        description: request.description || entry.description,
        line_items: request.line_items,
      } as CreateJournalEntryRequest);

      if (!validation.is_valid) {
        throw new Error(`Journal entry validation failed: ${validation.errors.join(', ')}`);
      }

      // Soft delete existing line items
      const existingItems = await this.db.transaction_line_items
        .where('transaction_id')
        .equals(entryId)
        .toArray();

      for (const item of existingItems) {
        await this.db.transaction_line_items.update(item.id, { deleted_at: now });
      }

      // Create new line items
      const newLineItems: JournalEntryLineItem[] = request.line_items.map((item, index) => ({
        id: uuidv4(),
        transaction_id: entryId,
        account_id: item.account_id,
        debit: item.debit,
        credit: item.credit,
        description: item.description || null,
        contact_id: item.contact_id || null,
        product_id: item.product_id || null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version_vector: {
          [deviceId]: 1,
        },
        line_number: index + 1,
        is_auto_balanced: false,
      }));

      await this.db.transaction_line_items.bulkAdd(newLineItems);
    }

    return this.getJournalEntryWithLineItems(entryId);
  }

  /**
   * Submit journal entry for approval
   */
  async submitForApproval(entryId: string, userId: string, deviceId: string): Promise<void> {
    const entry = await this.db.transactions.get(entryId);
    if (!entry) {
      throw new Error(`Journal entry not found: ${entryId}`);
    }

    const journalEntry = entry as JournalEntry;
    if (journalEntry.approval_status !== 'DRAFT') {
      throw new Error(`Can only submit DRAFT entries for approval`);
    }

    const now = Date.now();
    await this.db.transactions.update(entryId, {
      approval_status: 'pending',
      submitted_at: now,
      submitted_by: userId,
      updated_at: now,
      version_vector: {
        ...entry.version_vector,
        [deviceId]: (entry.version_vector[deviceId] || 0) + 1,
      },
    });
  }

  /**
   * Approve a journal entry
   */
  async approveJournalEntry(
    request: ApproveJournalEntryRequest,
    deviceId: string
  ): Promise<void> {
    const entry = await this.db.transactions.get(request.entry_id);
    if (!entry) {
      throw new Error(`Journal entry not found: ${request.entry_id}`);
    }

    const journalEntry = entry as JournalEntry;
    if (journalEntry.approval_status !== 'PENDING') {
      throw new Error(`Can only approve PENDING entries`);
    }

    const now = Date.now();
    await this.db.transactions.update(request.entry_id, {
      approval_status: 'APPROVED',
      status: 'POSTED', // Also update transaction status
      approved_at: now,
      approved_by: request.approved_by,
      updated_at: now,
      version_vector: {
        ...entry.version_vector,
        [deviceId]: (entry.version_vector[deviceId] || 0) + 1,
      },
    });
  }

  /**
   * Reject a journal entry
   */
  async rejectJournalEntry(request: RejectJournalEntryRequest, deviceId: string): Promise<void> {
    const entry = await this.db.transactions.get(request.entry_id);
    if (!entry) {
      throw new Error(`Journal entry not found: ${request.entry_id}`);
    }

    const journalEntry = entry as JournalEntry;
    if (journalEntry.approval_status !== 'PENDING') {
      throw new Error(`Can only reject PENDING entries`);
    }

    const now = Date.now();
    await this.db.transactions.update(request.entry_id, {
      approval_status: 'REJECTED',
      status: 'DRAFT', // Back to draft for editing
      rejected_at: now,
      rejected_by: request.rejected_by,
      rejection_reason: request.reason,
      updated_at: now,
      version_vector: {
        ...entry.version_vector,
        [deviceId]: (entry.version_vector[deviceId] || 0) + 1,
      },
    });
  }

  /**
   * Void a journal entry (creates reversing entry)
   */
  async voidJournalEntry(request: VoidJournalEntryRequest, deviceId: string, userId: string): Promise<string | null> {
    const entry = await this.db.transactions.get(request.entry_id);
    if (!entry) {
      throw new Error(`Journal entry not found: ${request.entry_id}`);
    }

    const journalEntry = entry as JournalEntry;
    if (!this.canVoidEntry(journalEntry)) {
      throw new Error(`Cannot void journal entry in ${journalEntry.approval_status} status`);
    }

    const now = Date.now();

    // Update entry to VOID status
    await this.db.transactions.update(request.entry_id, {
      status: 'VOID',
      approval_status: 'VOID',
      updated_at: now,
      version_vector: {
        ...entry.version_vector,
        [deviceId]: (entry.version_vector[deviceId] || 0) + 1,
      },
    });

    // Create reversing entry if requested
    if (request.create_reversing_entry) {
      const reversingEntryId = await this.createReversingEntry(
        {
          original_entry_id: request.entry_id,
          reverse_date: now,
          description: `Void: ${entry.description || ''}`,
          auto_created: true,
        },
        deviceId,
        userId
      );

      // Update original entry with reversing entry ID
      await this.db.transactions.update(request.entry_id, {
        reversed_by_entry_id: reversingEntryId,
      });

      return reversingEntryId;
    }

    return null;
  }

  /**
   * Create a reversing entry for an existing journal entry
   */
  async createReversingEntry(
    options: CreateReversingEntryOptions,
    deviceId: string,
    userId: string
  ): Promise<string> {
    const originalEntry = await this.getJournalEntryWithLineItems(options.original_entry_id);

    // Create line items with reversed debits/credits
    const reversedLineItems = originalEntry.line_items.map((item) => ({
      account_id: item.account_id,
      debit: item.credit, // Swap debit and credit
      credit: item.debit,
      description: `Reversal: ${item.description || ''}`,
      contact_id: item.contact_id,
      product_id: item.product_id,
    }));

    // Create the reversing entry
    const reversingEntry = await this.createJournalEntry(
      {
        company_id: originalEntry.entry.company_id,
        transaction_date: options.reversal_date,
        description: options.description || `Reversing entry for ${originalEntry.entry.transaction_number}`,
        reference: originalEntry.entry.reference,
        memo: `Reverses ${originalEntry.entry.transaction_number}`,
        attachments: [],
        line_items: reversedLineItems,
        submit_for_approval: false,
        is_reversing: true,
        reverses_entry_id: options.original_entry_id,
        auto_reverse_date: null,
        template_id: null,
      },
      deviceId,
      userId
    );

    return reversingEntry.entry.id;
  }

  /**
   * Create journal entry from template
   */
  async createFromTemplate(
    template: JournalEntryTemplate,
    companyId: string,
    transactionDate: number,
    amounts: Record<number, string>, // Map of line_number to amount
    accountIds: Record<number, string>, // Map of line_number to account_id
    deviceId: string,
    userId: string
  ): Promise<JournalEntryWithLineItems> {
    // Build line items from template
    const lineItems = template.line_items.map((templateItem) => {
      const amount = amounts[templateItem.line_number];
      if (!amount) {
        throw new Error(`Amount required for line ${templateItem.line_number}`);
      }

      const accountId = accountIds[templateItem.line_number];
      if (!accountId) {
        throw new Error(`Account required for line ${templateItem.line_number}`);
      }

      return {
        account_id: accountId,
        debit: templateItem.is_debit ? amount : '0.00',
        credit: templateItem.is_debit ? '0.00' : amount,
        description: templateItem.description,
        contact_id: null,
        product_id: null,
      };
    });

    // Create the entry
    return this.createJournalEntry(
      {
        company_id: companyId,
        transaction_date: transactionDate,
        description: template.description,
        line_items: lineItems,
        template_id: template.id,
        auto_reverse_date: template.auto_reverse
          ? transactionDate + (template.reverse_days || 30) * 24 * 60 * 60 * 1000
          : null,
      },
      deviceId,
      userId
    );
  }

  /**
   * Get journal entry statistics
   */
  async getStatistics(companyId: string): Promise<JournalEntryStatistics> {
    const entries = await this.db.transactions
      .where('company_id')
      .equals(companyId)
      .and((e: Transaction) => e.type === 'JOURNAL_ENTRY' && e.deleted_at === null)
      .toArray();

    const journalEntries = entries as JournalEntry[];

    const now = Date.now();
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    return {
      company_id: companyId,
      total_entries: journalEntries.length,
      by_status: {} as Record<TransactionStatus, number>,
      by_approval_status: {} as Record<JournalEntryApprovalStatus, number>,
      pending_approval_count: journalEntries.filter((e) => e.approval_status === 'PENDING').length,
      draft_count: journalEntries.filter((e) => e.status === 'DRAFT').length,
      posted_count: journalEntries.filter((e) => e.status === 'POSTED').length,
      voided_count: journalEntries.filter((e) => e.status === 'VOID').length,
      approved_this_month: journalEntries.filter(
        (e) => e.approval_status === 'APPROVED' && e.approved_at && e.approved_at >= monthAgo
      ).length,
      total_reversing_entries: journalEntries.filter((e) => e.is_reversing_entry).length,
      entries_from_templates: journalEntries.filter((e) => e.template_id).length,
    };
  }

  /**
   * Validate a journal entry
   */
  private validateJournalEntry(request: CreateJournalEntryRequest): JournalEntryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate basic fields
    if (!request.company_id) errors.push('Company ID is required');
    if (!request.transaction_date) errors.push('Transaction date is required');
    if (!request.line_items || request.line_items.length === 0) {
      errors.push('At least one line item is required');
    }

    // Validate each line item
    if (request.line_items) {
      request.line_items.forEach((item, index) => {
        if (!item.account_id) errors.push(`Line ${index + 1}: Account is required`);

        const debit = parseFloat(item.debit || '0');
        const credit = parseFloat(item.credit || '0');

        if (debit === 0 && credit === 0) {
          errors.push(`Line ${index + 1}: Either debit or credit must be non-zero`);
        }

        if (debit > 0 && credit > 0) {
          errors.push(`Line ${index + 1}: Cannot have both debit and credit`);
        }

        if (debit < 0 || credit < 0) {
          errors.push(`Line ${index + 1}: Debit and credit must be non-negative`);
        }
      });

      // Check if balanced
      const lineItemsForValidation = request.line_items.map(
        (item) =>
          ({
            debit: item.debit,
            credit: item.credit,
            deleted_at: null,
          } as TransactionLineItem)
      );

      const balanceCheck = validateTransactionBalance(lineItemsForValidation);

      if (!balanceCheck.isBalanced) {
        errors.push(
          `Journal entry is not balanced. Debits: ${balanceCheck.totalDebits}, Credits: ${balanceCheck.totalCredits}, Difference: ${balanceCheck.difference}`
        );
      }

      return {
        is_valid: errors.length === 0,
        errors,
        warnings,
        total_debits: balanceCheck.totalDebits,
        total_credits: balanceCheck.totalCredits,
        balance_difference: balanceCheck.difference,
      };
    }

    return {
      is_valid: false,
      errors,
      warnings,
      total_debits: '0.00',
      total_credits: '0.00',
      balance_difference: '0.00',
    };
  }

  /**
   * Check if an entry can be edited
   */
  private canEditEntry(entry: JournalEntry): boolean {
    return entry.approval_status === 'DRAFT' || entry.approval_status === 'REJECTED';
  }

  /**
   * Check if an entry can be approved
   */
  private canApproveEntry(entry: JournalEntry): boolean {
    return entry.approval_status === 'PENDING';
  }

  /**
   * Check if an entry can be voided
   */
  private canVoidEntry(entry: JournalEntry): boolean {
    return entry.approval_status === 'APPROVED' || entry.status === 'POSTED';
  }

  /**
   * Get next journal entry sequence number for the year
   */
  private async getNextJournalEntrySequence(companyId: string, year: number): Promise<number> {
    const startOfYear = new Date(year, 0, 1).getTime();
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999).getTime();

    const count = await this.db.transactions
      .where('company_id')
      .equals(companyId)
      .and(
        (e: Transaction) =>
          e.type === 'JOURNAL_ENTRY' &&
          e.transaction_date >= startOfYear &&
          e.transaction_date <= endOfYear
      )
      .count();

    return count + 1;
  }

  /**
   * Mark an entry as reversed
   */
  private async markEntryAsReversed(
    entryId: string,
    reversingEntryId: string,
    deviceId: string
  ): Promise<void> {
    const entry = await this.db.transactions.get(entryId);
    if (!entry) return;

    await this.db.transactions.update(entryId, {
      reversed_by_entry_id: reversingEntryId,
      updated_at: Date.now(),
      version_vector: {
        ...entry.version_vector,
        [deviceId]: (entry.version_vector[deviceId] || 0) + 1,
      },
    });
  }
}

/**
 * Create journal entries service instance
 */
export const createJournalEntriesService = (db: Database): JournalEntriesService => {
  return new JournalEntriesService(db);
};
