/**
 * Journal Entries Service Tests
 *
 * Comprehensive tests for journal entry functionality including:
 * - CRUD operations
 * - Balance validation (critical)
 * - Approval workflow
 * - Reversing entries
 * - Template application
 *
 * Requirements:
 * - F7: Journal Entries (Full)
 * - ACCT-005: Journal Entry Features
 * - Target: >80% coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JournalEntriesService } from './journalEntries.service';
import type { Database } from '../db/database';
import type {
  CreateJournalEntryRequest,
  JournalEntryTemplate,
  JournalEntryTemplateCategory,
} from '../types/journalEntry.types';
import type { Transaction, TransactionLineItem } from '../types/database.types';

// Mock database
const createMockDatabase = (): Database => {
  const transactionsStore: Transaction[] = [];
  const lineItemsStore: TransactionLineItem[] = [];

  return {
    transactions: {
      add: vi.fn(async (txn: Transaction) => {
        transactionsStore.push(txn);
        return txn.id;
      }),
      get: vi.fn(async (id: string) => {
        return transactionsStore.find((t) => t.id === id);
      }),
      where: vi.fn((field: string) => ({
        equals: vi.fn((value: string) => ({
          and: vi.fn((filter: any) => ({
            toArray: vi.fn(async () => {
              return transactionsStore.filter((t) => {
                if (field === 'company_id' && (t as any).company_id !== value) return false;
                return filter(t);
              });
            }),
            count: vi.fn(async () => {
              return transactionsStore.filter((t) => {
                if (field === 'company_id' && (t as any).company_id !== value) return false;
                return filter(t);
              }).length;
            }),
          })),
        })),
      })),
      update: vi.fn(async (id: string, updates: Partial<Transaction>) => {
        const index = transactionsStore.findIndex((t) => t.id === id);
        if (index !== -1) {
          transactionsStore[index] = { ...transactionsStore[index], ...updates };
          return 1;
        }
        return 0;
      }),
    },
    transaction_line_items: {
      bulkAdd: vi.fn(async (items: TransactionLineItem[]) => {
        lineItemsStore.push(...items);
      }),
      where: vi.fn((field: string) => ({
        equals: vi.fn((value: string) => ({
          // Support direct toArray() call
          toArray: vi.fn(async () => {
            return lineItemsStore.filter((item) => {
              if (field === 'transaction_id' && item.transaction_id !== value) return false;
              return true;
            });
          }),
          // Support and() for filtered queries
          and: vi.fn((filter: any) => ({
            toArray: vi.fn(async () => {
              return lineItemsStore.filter((item) => {
                if (field === 'transaction_id' && item.transaction_id !== value) return false;
                return filter(item);
              });
            }),
          })),
        })),
      })),
      update: vi.fn(async (id: string, updates: Partial<TransactionLineItem>) => {
        const index = lineItemsStore.findIndex((item) => item.id === id);
        if (index !== -1) {
          lineItemsStore[index] = { ...lineItemsStore[index], ...updates };
          return 1;
        }
        return 0;
      }),
    },
  } as any;
};

describe('JournalEntriesService', () => {
  let service: JournalEntriesService;
  let mockDb: Database;
  const deviceId = 'test-device-123';
  const userId = 'test-user-123';
  const companyId = 'test-company-123';
  const accountId1 = 'account-1';
  const accountId2 = 'account-2';

  beforeEach(() => {
    mockDb = createMockDatabase();
    service = new JournalEntriesService(mockDb);
  });

  describe('createJournalEntry', () => {
    it('should create a balanced journal entry', async () => {
      const request: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Test journal entry',
        line_items: [
          {
            account_id: accountId1,
            debit: '100.00',
            credit: '0.00',
          },
          {
            account_id: accountId2,
            debit: '0.00',
            credit: '100.00',
          },
        ],
      };

      const result = await service.createJournalEntry(request, deviceId, userId);

      expect(result.entry.company_id).toBe(companyId);
      expect(result.entry.description).toBe('Test journal entry');
      expect(result.entry.type).toBe('JOURNAL_ENTRY');
      expect(result.entry.status).toBe('DRAFT');
      expect(result.line_items).toHaveLength(2);
      expect(result.is_balanced).toBe(true);
      expect(result.total_debits).toBe('100.00');
      expect(result.total_credits).toBe('100.00');
    });

    it('should reject unbalanced journal entry', async () => {
      const request: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Unbalanced entry',
        line_items: [
          {
            account_id: accountId1,
            debit: '100.00',
            credit: '0.00',
          },
          {
            account_id: accountId2,
            debit: '0.00',
            credit: '50.00', // Not balanced!
          },
        ],
      };

      await expect(service.createJournalEntry(request, deviceId, userId)).rejects.toThrow(
        /not balanced/i
      );
    });

    it('should generate sequential transaction numbers', async () => {
      const request: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Entry 1',
        line_items: [
          { account_id: accountId1, debit: '50.00', credit: '0.00' },
          { account_id: accountId2, debit: '0.00', credit: '50.00' },
        ],
      };

      const result1 = await service.createJournalEntry(request, deviceId, userId);
      const result2 = await service.createJournalEntry(request, deviceId, userId);

      expect(result1.entry.transaction_number).toMatch(/^JE-\d{4}-\d{4}$/);
      expect(result2.entry.transaction_number).toMatch(/^JE-\d{4}-\d{4}$/);
      expect(result1.entry.transaction_number).not.toBe(result2.entry.transaction_number);
    });

    it('should create entry with approval workflow', async () => {
      const request: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Entry for approval',
        line_items: [
          { account_id: accountId1, debit: '100.00', credit: '0.00' },
          { account_id: accountId2, debit: '0.00', credit: '100.00' },
        ],
        submit_for_approval: true,
      };

      const result = await service.createJournalEntry(request, deviceId, userId);

      expect(result.entry.approval_status).toBe('PENDING');
      expect(result.entry.submitted_by).toBe(userId);
      expect(result.entry.submitted_at).toBeDefined();
    });

    it('should validate line items have either debit or credit, not both', async () => {
      const request: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Invalid line items',
        line_items: [
          {
            account_id: accountId1,
            debit: '100.00',
            credit: '50.00', // Both debit and credit!
          },
        ],
      };

      await expect(service.createJournalEntry(request, deviceId, userId)).rejects.toThrow();
    });
  });

  describe('getJournalEntries', () => {
    it('should filter journal entries by approval status', async () => {
      // Create entries with different statuses
      const draftRequest: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Draft entry',
        line_items: [
          { account_id: accountId1, debit: '100.00', credit: '0.00' },
          { account_id: accountId2, debit: '0.00', credit: '100.00' },
        ],
      };

      const pendingRequest: CreateJournalEntryRequest = {
        ...draftRequest,
        description: 'Pending entry',
        submit_for_approval: true,
      };

      await service.createJournalEntry(draftRequest, deviceId, userId);
      await service.createJournalEntry(pendingRequest, deviceId, userId);

      const draftEntries = await service.getJournalEntries({
        company_id: companyId,
        approval_status: 'DRAFT',
      });

      const pendingEntries = await service.getJournalEntries({
        company_id: companyId,
        approval_status: 'pending',
      });

      expect(draftEntries).toHaveLength(1);
      expect(draftEntries[0]!.entry.description).toBe('Draft entry');
      expect(pendingEntries).toHaveLength(1);
      expect(pendingEntries[0]!.entry.description).toBe('Pending entry');
    });

    it('should filter journal entries by date range', async () => {
      const pastDate = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago
      const futureDate = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days from now

      const request: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Current entry',
        line_items: [
          { account_id: accountId1, debit: '100.00', credit: '0.00' },
          { account_id: accountId2, debit: '0.00', credit: '100.00' },
        ],
      };

      await service.createJournalEntry(request, deviceId, userId);

      const inRangeEntries = await service.getJournalEntries({
        company_id: companyId,
        date_from: pastDate,
        date_to: futureDate,
      });

      const outOfRangeEntries = await service.getJournalEntries({
        company_id: companyId,
        date_from: futureDate,
        date_to: futureDate + 1000,
      });

      expect(inRangeEntries).toHaveLength(1);
      expect(outOfRangeEntries).toHaveLength(0);
    });
  });

  describe('updateJournalEntry', () => {
    it('should update draft journal entry', async () => {
      const createRequest: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Original description',
        line_items: [
          { account_id: accountId1, debit: '100.00', credit: '0.00' },
          { account_id: accountId2, debit: '0.00', credit: '100.00' },
        ],
      };

      const created = await service.createJournalEntry(createRequest, deviceId, userId);

      const updated = await service.updateJournalEntry(
        created.entry.id,
        {
          entry_id: created.entry.id,
          description: 'Updated description',
          memo: 'Added memo',
        },
        deviceId
      );

      expect(updated.entry.description).toBe('Updated description');
      expect(updated.entry.memo).toBe('Added memo');
    });

    it('should update line items and maintain balance', async () => {
      const createRequest: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Entry to update',
        line_items: [
          { account_id: accountId1, debit: '100.00', credit: '0.00' },
          { account_id: accountId2, debit: '0.00', credit: '100.00' },
        ],
      };

      const created = await service.createJournalEntry(createRequest, deviceId, userId);

      const updated = await service.updateJournalEntry(
        created.entry.id,
        {
          line_items: [
            { account_id: accountId1, debit: '200.00', credit: '0.00' },
            { account_id: accountId2, debit: '0.00', credit: '200.00' },
          ],
        },
        deviceId
      );

      expect(updated.total_debits).toBe('200.00');
      expect(updated.total_credits).toBe('200.00');
      expect(updated.is_balanced).toBe(true);
    });

    it('should reject update with unbalanced line items', async () => {
      const createRequest: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Entry to update',
        line_items: [
          { account_id: accountId1, debit: '100.00', credit: '0.00' },
          { account_id: accountId2, debit: '0.00', credit: '100.00' },
        ],
      };

      const created = await service.createJournalEntry(createRequest, deviceId, userId);

      await expect(
        service.updateJournalEntry(
          created.entry.id,
          {
            line_items: [
              { account_id: accountId1, debit: '200.00', credit: '0.00' },
              { account_id: accountId2, debit: '0.00', credit: '100.00' }, // Unbalanced!
            ],
          },
          deviceId
        )
      ).rejects.toThrow(/not balanced/i);
    });
  });

  describe('Approval Workflow', () => {
    it('should submit draft entry for approval', async () => {
      const request: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Entry to approve',
        line_items: [
          { account_id: accountId1, debit: '100.00', credit: '0.00' },
          { account_id: accountId2, debit: '0.00', credit: '100.00' },
        ],
      };

      const created = await service.createJournalEntry(request, deviceId, userId);
      expect(created.entry.approval_status).toBe('DRAFT');

      await service.submitForApproval(created.entry.id, userId, deviceId);

      const submitted = await service.getJournalEntryWithLineItems(created.entry.id);
      expect(submitted.entry.approval_status).toBe('PENDING');
      expect(submitted.entry.submitted_by).toBe(userId);
    });

    it('should approve pending entry', async () => {
      const request: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Entry to approve',
        line_items: [
          { account_id: accountId1, debit: '100.00', credit: '0.00' },
          { account_id: accountId2, debit: '0.00', credit: '100.00' },
        ],
        submit_for_approval: true,
      };

      const created = await service.createJournalEntry(request, deviceId, userId);

      await service.approveJournalEntry(
        { entry_id: created.entry.id, approved_by: 'approver-123', post_immediately: false },
        deviceId
      );

      const approved = await service.getJournalEntryWithLineItems(created.entry.id);
      expect(approved.entry.approval_status).toBe('APPROVED');
      expect(approved.entry.status).toBe('POSTED');
      expect(approved.entry.approved_by).toBe('approver-123');
      expect(approved.can_edit).toBe(false);
    });

    it('should reject pending entry', async () => {
      const request: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Entry to reject',
        line_items: [
          { account_id: accountId1, debit: '100.00', credit: '0.00' },
          { account_id: accountId2, debit: '0.00', credit: '100.00' },
        ],
        submit_for_approval: true,
      };

      const created = await service.createJournalEntry(request, deviceId, userId);

      await service.rejectJournalEntry(
        {
          entry_id: created.entry.id,
          rejected_by: 'approver-123',
          reason: 'Incorrect amount',
        },
        deviceId
      );

      const rejected = await service.getJournalEntryWithLineItems(created.entry.id);
      expect(rejected.entry.approval_status).toBe('REJECTED');
      expect(rejected.entry.status).toBe('DRAFT'); // Back to draft for editing
      expect(rejected.entry.rejected_by).toBe('approver-123');
      expect(rejected.entry.rejection_reason).toBe('Incorrect amount');
      expect(rejected.can_edit).toBe(true);
    });
  });

  describe('Reversing Entries', () => {
    it('should create a reversing entry', async () => {
      const originalRequest: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Original entry',
        line_items: [
          { account_id: accountId1, debit: '100.00', credit: '0.00', description: 'Debit side' },
          { account_id: accountId2, debit: '0.00', credit: '100.00', description: 'Credit side' },
        ],
      };

      const original = await service.createJournalEntry(originalRequest, deviceId, userId);

      const reversingEntryId = await service.createReversingEntry(
        {
          original_entry_id: original.entry.id,
          reverse_date: Date.now(),
        },
        deviceId,
        userId
      );

      const reversing = await service.getJournalEntryWithLineItems(reversingEntryId);

      // Check that debits and credits are swapped
      expect(reversing.line_items[0]!.credit).toBe('100.00'); // Was debit in original
      expect(reversing.line_items[0]!.debit).toBe('0.00');
      expect(reversing.line_items[1]!.debit).toBe('100.00'); // Was credit in original
      expect(reversing.line_items[1]!.credit).toBe('0.00');

      expect(reversing.entry.is_reversing).toBe(true);
      expect(reversing.entry.reverses_entry_id).toBe(original.entry.id);
      expect(reversing.is_balanced).toBe(true);
    });

    it('should void entry and create reversing entry', async () => {
      const request: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Entry to void',
        line_items: [
          { account_id: accountId1, debit: '100.00', credit: '0.00' },
          { account_id: accountId2, debit: '0.00', credit: '100.00' },
        ],
        submit_for_approval: true,
      };

      const created = await service.createJournalEntry(request, deviceId, userId);

      // Approve it first
      await service.approveJournalEntry(
        { entry_id: created.entry.id, approved_by: 'approver-123', post_immediately: false },
        deviceId
      );

      // Void with reversing entry
      const reversingEntryId = await service.voidJournalEntry(
        {
          entry_id: created.entry.id,
          voided_by: userId,
          reason: 'Entry error',
          create_reversing_entry: true,
        },
        deviceId,
        userId
      );

      const voided = await service.getJournalEntryWithLineItems(created.entry.id);
      expect(voided.entry.status).toBe('VOID');
      expect(voided.entry.approval_status).toBe('VOID');
      expect(voided.entry.reversed_by_entry_id).toBe(reversingEntryId);

      // Check reversing entry exists and is balanced
      const reversing = await service.getJournalEntryWithLineItems(reversingEntryId!);
      expect(reversing.is_balanced).toBe(true);
      expect(reversing.entry.is_reversing).toBe(true);
    });
  });

  describe('Template Application', () => {
    it('should create entry from template', async () => {
      const template: JournalEntryTemplate = {
        id: 'template-1',
        name: 'Monthly Depreciation',
        description: 'Record monthly depreciation',
        category: 'DEPRECIATION' as JournalEntryTemplateCategory,
        is_system: true,
        company_id: null,
        line_items: [
          {
            line_number: 1,
            description: 'Depreciation expense',
            plain_english_description: 'Equipment losing value',
            is_debit: true,
            account_type_hint: 'EXPENSE',
          },
          {
            line_number: 2,
            description: 'Accumulated depreciation',
            plain_english_description: 'Total depreciation so far',
            is_debit: false,
            account_type_hint: 'ASSET (Contra)',
          },
        ],
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      const result = await service.createFromTemplate(
        template,
        companyId,
        Date.now(),
        {
          1: '500.00',
          2: '500.00',
        },
        {
          1: accountId1,
          2: accountId2,
        },
        deviceId,
        userId
      );

      expect(result.entry.description).toBe(template.description);
      expect(result.entry.template_id).toBe(template.id);
      expect(result.is_balanced).toBe(true);
      expect(result.line_items).toHaveLength(2);
      expect(result.line_items[0]!.debit).toBe('500.00');
      expect(result.line_items[1]!.credit).toBe('500.00');
    });
  });

  describe('Statistics', () => {
    it('should calculate journal entry statistics', async () => {
      // Create various entries
      const draftRequest: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Draft',
        line_items: [
          { account_id: accountId1, debit: '100.00', credit: '0.00' },
          { account_id: accountId2, debit: '0.00', credit: '100.00' },
        ],
      };

      const pendingRequest: CreateJournalEntryRequest = {
        ...draftRequest,
        description: 'Pending',
        submit_for_approval: true,
      };

      await service.createJournalEntry(draftRequest, deviceId, userId);
      const pending = await service.createJournalEntry(pendingRequest, deviceId, userId);

      // Approve one
      await service.approveJournalEntry(
        { entry_id: pending.entry.id, approved_by: 'approver', post_immediately: false },
        deviceId
      );

      const stats = await service.getStatistics(companyId);

      expect(stats.total_entries).toBe(2);
      expect(stats.pending_approval).toBe(0); // Was approved
      expect(stats.approved_this_month).toBe(1);
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should reject entry with no line items', async () => {
      const request: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'No lines',
        line_items: [],
      };

      await expect(service.createJournalEntry(request, deviceId, userId)).rejects.toThrow();
    });

    it('should handle decimal precision correctly', async () => {
      const request: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Precision test',
        line_items: [
          { account_id: accountId1, debit: '10.33', credit: '0.00' },
          { account_id: accountId2, debit: '0.00', credit: '10.33' },
        ],
      };

      const result = await service.createJournalEntry(request, deviceId, userId);
      expect(result.is_balanced).toBe(true);
      expect(result.total_debits).toBe('10.33');
      expect(result.total_credits).toBe('10.33');
    });

    it('should allow small rounding differences (<$0.01)', async () => {
      const request: CreateJournalEntryRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        description: 'Rounding test',
        line_items: [
          { account_id: accountId1, debit: '10.005', credit: '0.00' },
          { account_id: accountId2, debit: '0.00', credit: '10.00' },
        ],
      };

      const result = await service.createJournalEntry(request, deviceId, userId);
      // Should be considered balanced due to <$0.01 tolerance
      expect(result.is_balanced).toBe(true);
    });
  });
});
