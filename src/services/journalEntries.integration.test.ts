/**
 * Journal Entries Integration Tests
 *
 * Tests the complete journal entry workflow including:
 * - Multi-user approval workflow
 * - Integration with transaction system
 * - Reversing entry workflows
 * - Template-based entry creation
 *
 * Requirements:
 * - F7: Journal Entries (Full) - Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JournalEntriesService } from './journalEntries.service';
import type { Database } from '../db/database';
import type {
  CreateJournalEntryRequest,
  JournalEntryApprovalStatus,
} from '../types/journalEntry.types';
import { STANDARD_JOURNAL_ENTRY_TEMPLATES_EXTENDED } from '../types/journalEntry.types';

describe('Journal Entries Integration Tests', () => {
  let service: JournalEntriesService;
  let mockDb: Database;

  const deviceId1 = 'device-user1';
  const deviceId2 = 'device-approver';
  const userId1 = 'user-1';
  const approverId = 'approver-1';
  const companyId = 'company-123';
  const cashAccountId = 'account-cash';
  const expenseAccountId = 'account-expense';

  beforeEach(() => {
    // Create a mock database with in-memory stores
    const transactionsStore: any[] = [];
    const lineItemsStore: any[] = [];

    mockDb = {
      transactions: {
        add: async (txn: any) => {
          transactionsStore.push(txn);
          return txn.id;
        },
        get: async (id: string) => transactionsStore.find((t) => t.id === id),
        where: (field: string) => ({
          equals: (value: string) => ({
            and: (filter: any) => ({
              toArray: async () =>
                transactionsStore.filter((t) => {
                  if (field === 'company_id' && t.company_id !== value) return false;
                  return filter(t);
                }),
              count: async () =>
                transactionsStore.filter((t) => {
                  if (field === 'company_id' && t.company_id !== value) return false;
                  return filter(t);
                }).length,
            }),
          }),
        }),
        update: async (id: string, updates: any) => {
          const index = transactionsStore.findIndex((t) => t.id === id);
          if (index !== -1) {
            transactionsStore[index] = { ...transactionsStore[index], ...updates };
            return 1;
          }
          return 0;
        },
      },
      transaction_line_items: {
        bulkAdd: async (items: any[]) => {
          lineItemsStore.push(...items);
        },
        where: (field: string) => ({
          equals: (value: string) => ({
            // Support direct toArray() call
            toArray: async () =>
              lineItemsStore.filter((item) => {
                if (field === 'transaction_id' && item.transaction_id !== value) return false;
                return true;
              }),
            // Support and() for filtered queries
            and: (filter: any) => ({
              toArray: async () =>
                lineItemsStore.filter((item) => {
                  if (field === 'transaction_id' && item.transaction_id !== value) return false;
                  return filter(item);
                }),
            }),
          }),
        }),
        update: async (id: string, updates: any) => {
          const index = lineItemsStore.findIndex((item) => item.id === id);
          if (index !== -1) {
            lineItemsStore[index] = { ...lineItemsStore[index], ...updates };
            return 1;
          }
          return 0;
        },
      },
    } as any;

    service = new JournalEntriesService(mockDb);
  });

  describe('Complete Approval Workflow', () => {
    it('should complete full approval workflow from creation to approval', async () => {
      // Step 1: User creates a draft entry
      const createRequest: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Monthly office expense',
        reference: 'INV-001',
        line_items: [
          {
            account_id: expenseAccountId,
            debit: '1000.00',
            credit: '0.00',
            description: 'Office supplies',
          },
          {
            account_id: cashAccountId,
            debit: '0.00',
            credit: '1000.00',
            description: 'Cash payment',
          },
        ],
      };

      const draft = await service.createJournalEntry(createRequest, deviceId1, userId1);

      // Verify draft state
      expect(draft.entry.approval_status).toBe('DRAFT');
      expect(draft.can_edit).toBe(true);
      expect(draft.can_approve).toBe(false);
      expect(draft.is_balanced).toBe(true);

      // Step 2: User submits for approval
      await service.submitForApproval(draft.entry.id, userId1, deviceId1);

      const pending = await service.getJournalEntryWithLineItems(draft.entry.id);
      expect(pending.entry.approval_status).toBe('PENDING');
      expect(pending.entry.submitted_by).toBe(userId1);
      expect(pending.can_edit).toBe(false);
      expect(pending.can_approve).toBe(true);

      // Step 3: Approver approves
      await service.approveJournalEntry(
        {
          entry_id: draft.entry.id,
          approved_by: approverId,
          notes: 'Approved',
        },
        deviceId2
      );

      const approved = await service.getJournalEntryWithLineItems(draft.entry.id);
      expect(approved.entry.approval_status).toBe('APPROVED');
      expect(approved.entry.status).toBe('POSTED');
      expect(approved.entry.approved_by).toBe(approverId);
      expect(approved.can_edit).toBe(false);
      expect(approved.can_approve).toBe(false);
      expect(approved.can_void).toBe(true);
    });

    it('should handle rejection workflow', async () => {
      // Create and submit entry
      const request: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Entry to reject',
        line_items: [
          { account_id: expenseAccountId, debit: '500.00', credit: '0.00' },
          { account_id: cashAccountId, debit: '0.00', credit: '500.00' },
        ],
        submit_for_approval: true,
      };

      const entry = await service.createJournalEntry(request, deviceId1, userId1);

      // Reject
      await service.rejectJournalEntry(
        {
          entry_id: entry.entry.id,
          rejected_by: approverId,
          reason: 'Amount is incorrect',
        },
        deviceId2
      );

      const rejected = await service.getJournalEntryWithLineItems(entry.entry.id);
      expect(rejected.entry.approval_status).toBe('REJECTED');
      expect(rejected.entry.rejected_by).toBe(approverId);
      expect(rejected.entry.rejection_reason).toBe('Amount is incorrect');
      expect(rejected.can_edit).toBe(true); // Can edit after rejection

      // User updates and resubmits
      await service.updateJournalEntry(
        entry.entry.id,
        {
          line_items: [
            { account_id: expenseAccountId, debit: '600.00', credit: '0.00' },
            { account_id: cashAccountId, debit: '0.00', credit: '600.00' },
          ],
        },
        deviceId1
      );

      await service.submitForApproval(entry.entry.id, userId1, deviceId1);

      const resubmitted = await service.getJournalEntryWithLineItems(entry.entry.id);
      expect(resubmitted.entry.approval_status).toBe('PENDING');
      expect(resubmitted.total_debits).toBe('600.00');
    });
  });

  describe('Reversing Entry Workflow', () => {
    it('should create and link reversing entries correctly', async () => {
      // Create original entry
      const originalRequest: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        description: 'Accrued expense',
        line_items: [
          {
            account_id: expenseAccountId,
            debit: '750.00',
            credit: '0.00',
            description: 'Utility expense accrued',
          },
          {
            account_id: 'account-accrued-liabilities',
            debit: '0.00',
            credit: '750.00',
            description: 'Accrued liability',
          },
        ],
      };

      const original = await service.createJournalEntry(originalRequest, deviceId1, userId1);

      // Approve original
      await service.submitForApproval(original.entry.id, userId1, deviceId1);
      await service.approveJournalEntry(
        { entry_id: original.entry.id, approved_by: approverId },
        deviceId2
      );

      // Create reversing entry
      const reversingEntryId = await service.createReversingEntry(
        {
          original_entry_id: original.entry.id,
          reverse_date: Date.now(),
          description: 'Reverse accrued expense',
        },
        deviceId1,
        userId1
      );

      const reversing = await service.getJournalEntryWithLineItems(reversingEntryId);

      // Verify reversing entry
      expect(reversing.entry.is_reversing).toBe(true);
      expect(reversing.entry.reverses_entry_id).toBe(original.entry.id);
      expect(reversing.is_balanced).toBe(true);

      // Verify debits and credits are swapped
      expect(reversing.line_items[0]!.credit).toBe('750.00'); // Was debit
      expect(reversing.line_items[0]!.debit).toBe('0.00');
      expect(reversing.line_items[1]!.debit).toBe('750.00'); // Was credit
      expect(reversing.line_items[1]!.credit).toBe('0.00');

      // Original entry should reference reversing entry
      const updatedOriginal = await service.getJournalEntryWithLineItems(original.entry.id);
      expect(updatedOriginal.entry.reversed_by_entry_id).toBe(reversingEntryId);
    });

    it('should void entry with automatic reversing entry creation', async () => {
      // Create and approve an entry
      const request: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Entry to void',
        line_items: [
          { account_id: expenseAccountId, debit: '1000.00', credit: '0.00' },
          { account_id: cashAccountId, debit: '0.00', credit: '1000.00' },
        ],
      };

      const entry = await service.createJournalEntry(request, deviceId1, userId1);
      await service.submitForApproval(entry.entry.id, userId1, deviceId1);
      await service.approveJournalEntry(
        { entry_id: entry.entry.id, approved_by: approverId },
        deviceId2
      );

      // Void with reversing entry
      const reversingId = await service.voidJournalEntry(
        {
          entry_id: entry.entry.id,
          voided_by: userId1,
          reason: 'Duplicate entry',
          create_reversing_entry: true,
        },
        deviceId1,
        userId1
      );

      // Check voided entry
      const voided = await service.getJournalEntryWithLineItems(entry.entry.id);
      expect(voided.entry.status).toBe('VOID');
      expect(voided.entry.approval_status).toBe('VOID');
      expect(voided.entry.reversed_by_entry_id).toBe(reversingId);

      // Check reversing entry exists and balances
      const reversing = await service.getJournalEntryWithLineItems(reversingId!);
      expect(reversing.is_balanced).toBe(true);
      expect(reversing.entry.is_reversing).toBe(true);
    });
  });

  describe('Template-Based Entry Creation', () => {
    it('should create entry from depreciation template', async () => {
      const depreciationTemplate = STANDARD_JOURNAL_ENTRY_TEMPLATES_EXTENDED.find(
        (t) => t.id === 'depreciation-monthly'
      )!;

      const entry = await service.createFromTemplate(
        depreciationTemplate,
        companyId,
        Date.now(),
        {
          1: '833.33', // Depreciation expense
          2: '833.33', // Accumulated depreciation
        },
        {
          1: 'account-depreciation-expense',
          2: 'account-accumulated-depreciation',
        },
        deviceId1,
        userId1
      );

      expect(entry.entry.template_id).toBe('depreciation-monthly');
      expect(entry.entry.description).toBe(depreciationTemplate.description);
      expect(entry.is_balanced).toBe(true);
      expect(entry.line_items).toHaveLength(2);
      expect(entry.line_items[0]!.debit).toBe('833.33');
      expect(entry.line_items[1]!.credit).toBe('833.33');
    });

    it('should create auto-reversing accrual entry from template', async () => {
      const accrualTemplate = STANDARD_JOURNAL_ENTRY_TEMPLATES_EXTENDED.find(
        (t) => t.id === 'accrued-expense'
      )!;

      expect(accrualTemplate.auto_reverse).toBe(true);

      const transactionDate = Date.now();
      const entry = await service.createFromTemplate(
        accrualTemplate,
        companyId,
        transactionDate,
        {
          1: '500.00',
          2: '500.00',
        },
        {
          1: expenseAccountId,
          2: 'account-accrued-liabilities',
        },
        deviceId1,
        userId1
      );

      expect(entry.entry.auto_reverse_date).toBeDefined();
      expect(entry.entry.auto_reverse_date).toBeGreaterThan(transactionDate);
    });
  });

  describe('Query and Filtering', () => {
    it('should filter entries by multiple criteria', async () => {
      const now = Date.now();
      const lastWeek = now - 7 * 24 * 60 * 60 * 1000;

      // Create entries with different statuses and dates
      const entries = await Promise.all([
        service.createJournalEntry(
          {
            company_id: companyId,
            transaction_date: lastWeek,
            description: 'Old draft',
            line_items: [
              { account_id: expenseAccountId, debit: '100.00', credit: '0.00' },
              { account_id: cashAccountId, debit: '0.00', credit: '100.00' },
            ],
          },
          deviceId1,
          userId1
        ),
        service.createJournalEntry(
          {
            company_id: companyId,
            transaction_date: now,
            description: 'Recent pending',
            line_items: [
              { account_id: expenseAccountId, debit: '200.00', credit: '0.00' },
              { account_id: cashAccountId, debit: '0.00', credit: '200.00' },
            ],
            submit_for_approval: true,
          },
          deviceId1,
          userId1
        ),
      ]);

      // Approve one
      await service.approveJournalEntry(
        { entry_id: entries[1].entry.id, approved_by: approverId },
        deviceId2
      );

      // Filter by status
      const pendingEntries = await service.getJournalEntries({
        company_id: companyId,
        approval_status: 'pending' as JournalEntryApprovalStatus,
      });
      expect(pendingEntries).toHaveLength(0); // Was approved

      const approvedEntries = await service.getJournalEntries({
        company_id: companyId,
        approval_status: 'APPROVED' as JournalEntryApprovalStatus,
      });
      expect(approvedEntries).toHaveLength(1);

      // Filter by date
      const recentEntries = await service.getJournalEntries({
        company_id: companyId,
        date_from: now - 1000,
      });
      expect(recentEntries.length).toBeGreaterThan(0);
    });

    it('should search entries by description and reference', async () => {
      await Promise.all([
        service.createJournalEntry(
          {
            company_id: companyId,
            transaction_date: Date.now(),
            description: 'Monthly rent payment',
            reference: 'RENT-2024-01',
            line_items: [
              { account_id: expenseAccountId, debit: '1500.00', credit: '0.00' },
              { account_id: cashAccountId, debit: '0.00', credit: '1500.00' },
            ],
          },
          deviceId1,
          userId1
        ),
        service.createJournalEntry(
          {
            company_id: companyId,
            transaction_date: Date.now(),
            description: 'Office supplies',
            reference: 'SUPPLIES-001',
            line_items: [
              { account_id: expenseAccountId, debit: '250.00', credit: '0.00' },
              { account_id: cashAccountId, debit: '0.00', credit: '250.00' },
            ],
          },
          deviceId1,
          userId1
        ),
      ]);

      const rentEntries = await service.getJournalEntries({
        company_id: companyId,
        search: 'rent',
      });
      expect(rentEntries).toHaveLength(1);
      expect(rentEntries[0]!.entry.description).toContain('rent');

      const suppliesEntries = await service.getJournalEntries({
        company_id: companyId,
        search: 'SUPPLIES',
      });
      expect(suppliesEntries).toHaveLength(1);
    });
  });

  describe('Statistics and Reporting', () => {
    it('should calculate accurate statistics', async () => {
      // Create various entries
      await service.createJournalEntry(
        {
          company_id: companyId,
          transaction_date: Date.now(),
          description: 'Draft entry',
          line_items: [
            { account_id: expenseAccountId, debit: '100.00', credit: '0.00' },
            { account_id: cashAccountId, debit: '0.00', credit: '100.00' },
          ],
        },
        deviceId1,
        userId1
      );

      await service.createJournalEntry(
        {
          company_id: companyId,
          transaction_date: Date.now(),
          description: 'Pending entry',
          line_items: [
            { account_id: expenseAccountId, debit: '200.00', credit: '0.00' },
            { account_id: cashAccountId, debit: '0.00', credit: '200.00' },
          ],
          submit_for_approval: true,
        },
        deviceId1,
        userId1
      );

      const stats = await service.getStatistics(companyId);

      expect(stats.total_entries).toBe(2);
      expect(stats.pending_approval).toBe(1);
      expect(stats.approved_this_month).toBe(0);
    });
  });
});
