/**
 * Barter Service Tests
 *
 * Comprehensive tests for barter transaction functionality including:
 * - Barter transaction creation
 * - FMV validation
 * - Offsetting entry generation
 * - 1099-B reporting
 * - Tax compliance
 *
 * Requirements:
 * - I5: Barter/Trade Transactions (Nice)
 * - GAAP compliance for barter accounting
 * - Target: 100% coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BarterService } from './barter.service';
import type { TreasureChestDB } from '../db/database';
import type { CreateBarterTransactionRequest } from '../types/barter.types';
import type { Transaction, TransactionLineItem, Account, Contact } from '../types/database.types';

// Mock database
const createMockDatabase = (): TreasureChestDB => {
  const transactionsStore: Transaction[] = [];
  const lineItemsStore: TransactionLineItem[] = [];
  const accountsStore: Account[] = [];
  const contactsStore: Contact[] = [];

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
          toArray: vi.fn(async () => {
            return transactionsStore.filter((t) => {
              if (field === 'company_id' && (t as any).company_id !== value) return false;
              return true;
            });
          }),
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
    transactionLineItems: {
      bulkAdd: vi.fn(async (items: TransactionLineItem[]) => {
        lineItemsStore.push(...items);
      }),
      where: vi.fn((field: string) => ({
        equals: vi.fn((value: string) => ({
          and: vi.fn((filter: any) => ({
            toArray: vi.fn(async () => {
              return lineItemsStore.filter((item) => {
                if (field === 'transaction_id' && item.transaction_id !== value) return false;
                return filter(item);
              });
            }),
          })),
          toArray: vi.fn(async () => {
            return lineItemsStore.filter((item) => {
              if (field === 'transaction_id' && item.transaction_id !== value) return false;
              return true;
            });
          }),
        })),
      })),
    },
    accounts: {
      where: vi.fn((field: string) => ({
        equals: vi.fn((value: string) => ({
          and: vi.fn((filter: any) => ({
            toArray: vi.fn(async () => {
              return accountsStore.filter((acc) => {
                if (field === 'company_id' && acc.company_id !== value) return false;
                return filter(acc);
              });
            }),
          })),
        })),
      })),
      add: vi.fn(async (account: Account) => {
        accountsStore.push(account);
        return account.id;
      }),
    },
    contacts: {
      get: vi.fn(async (id: string) => {
        return contactsStore.find((c) => c.id === id);
      }),
    },
  } as any;
};

describe('BarterService', () => {
  let service: BarterService;
  let mockDb: TreasureChestDB;
  const deviceId = 'test-device-123';
  const userId = 'test-user-123';
  const companyId = 'test-company-123';
  const incomeAccountId = 'income-account-1';
  const expenseAccountId = 'expense-account-1';

  beforeEach(() => {
    mockDb = createMockDatabase();
    service = new BarterService(mockDb);
  });

  describe('createBarterTransaction', () => {
    it('should create a valid barter transaction with offsetting entries', async () => {
      const request: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: 'Web design services',
        goods_received_fmv: '1000.00',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Consulting services',
        goods_provided_fmv: '1000.00',
        expense_account_id: expenseAccountId,
        fmv_basis: 'MARKET_PRICE',
        fmv_documentation: [],
        counterparty_contact_id: null,
        reference: null,
        memo: null,
        attachments: [],
      };

      const result = await service.createBarterTransaction(request, deviceId, userId);

      // Verify barter transaction created
      expect(result.barter).toBeDefined();
      expect(result.barter.type).toBe('BARTER');
      expect(result.barter.is_barter).toBe(true);
      expect(result.barter.goods_received_fmv).toBe('1000.00');
      expect(result.barter.goods_provided_fmv).toBe('1000.00');
      expect(result.barter.is_1099_reportable).toBe(true); // >= $600

      // Verify income entry created
      expect(result.income_entry).toBeDefined();
      expect(result.income_entry?.type).toBe('JOURNAL_ENTRY');
      expect(result.income_line_items).toHaveLength(2); // Debit clearing, Credit income

      // Verify expense entry created
      expect(result.expense_entry).toBeDefined();
      expect(result.expense_entry?.type).toBe('JOURNAL_ENTRY');
      expect(result.expense_line_items).toHaveLength(2); // Debit expense, Credit clearing

      // Verify line items balance
      const incomeDebit = parseFloat(result.income_line_items[0].debit);
      const incomeCredit = parseFloat(result.income_line_items[1].credit);
      expect(incomeDebit).toBe(incomeCredit);

      const expenseDebit = parseFloat(result.expense_line_items[0].debit);
      const expenseCredit = parseFloat(result.expense_line_items[1].credit);
      expect(expenseDebit).toBe(expenseCredit);
    });

    it('should reject barter transaction with zero FMV', async () => {
      const request: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: 'Services',
        goods_received_fmv: '0.00',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Services',
        goods_provided_fmv: '1000.00',
        expense_account_id: expenseAccountId,
        fmv_basis: null,
        fmv_documentation: [],
        counterparty_contact_id: null,
        reference: null,
        memo: null,
        attachments: [],
      };

      await expect(
        service.createBarterTransaction(request, deviceId, userId)
      ).rejects.toThrow('validation failed');
    });

    it('should reject barter transaction with empty descriptions', async () => {
      const request: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: '',
        goods_received_fmv: '1000.00',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Services',
        goods_provided_fmv: '1000.00',
        expense_account_id: expenseAccountId,
        fmv_basis: null,
        fmv_documentation: [],
        counterparty_contact_id: null,
        reference: null,
        memo: null,
        attachments: [],
      };

      await expect(
        service.createBarterTransaction(request, deviceId, userId)
      ).rejects.toThrow('validation failed');
    });

    it('should mark transaction as 1099-reportable when FMV >= $600', async () => {
      const request: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: 'Services',
        goods_received_fmv: '600.00',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Services',
        goods_provided_fmv: '600.00',
        expense_account_id: expenseAccountId,
        fmv_basis: 'AGREED_VALUE',
        fmv_documentation: [],
        counterparty_contact_id: null,
        reference: null,
        memo: null,
        attachments: [],
      };

      const result = await service.createBarterTransaction(request, deviceId, userId);
      expect(result.barter.is_1099_reportable).toBe(true);
    });

    it('should not mark transaction as 1099-reportable when FMV < $600', async () => {
      const request: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: 'Services',
        goods_received_fmv: '599.99',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Services',
        goods_provided_fmv: '599.99',
        expense_account_id: expenseAccountId,
        fmv_basis: 'AGREED_VALUE',
        fmv_documentation: [],
        counterparty_contact_id: null,
        reference: null,
        memo: null,
        attachments: [],
      };

      const result = await service.createBarterTransaction(request, deviceId, userId);
      expect(result.barter.is_1099_reportable).toBe(false);
    });
  });

  describe('validateBarterTransaction', () => {
    it('should validate a correct barter transaction', () => {
      const request: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: 'Services',
        goods_received_fmv: '1000.00',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Services',
        goods_provided_fmv: '1000.00',
        expense_account_id: expenseAccountId,
        fmv_basis: 'MARKET_PRICE',
        fmv_documentation: [],
        counterparty_contact_id: null,
        reference: null,
        memo: null,
        attachments: [],
      };

      const validation = service.validateBarterTransaction(request);

      expect(validation.is_valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.fmv_received).toBe('1000.00');
      expect(validation.fmv_provided).toBe('1000.00');
      expect(validation.fmv_difference).toBe('0.00');
    });

    it('should warn when FMV difference exceeds 20%', () => {
      const request: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: 'Services',
        goods_received_fmv: '1000.00',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Services',
        goods_provided_fmv: '500.00',
        expense_account_id: expenseAccountId,
        fmv_basis: 'MARKET_PRICE',
        fmv_documentation: [],
        counterparty_contact_id: null,
        reference: null,
        memo: null,
        attachments: [],
      };

      const validation = service.validateBarterTransaction(request);

      expect(validation.is_valid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('differ by');
      expect(parseFloat(validation.fmv_difference_percentage)).toBeGreaterThan(20);
    });

    it('should warn when FMV basis is not documented', () => {
      const request: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: 'Services',
        goods_received_fmv: '1000.00',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Services',
        goods_provided_fmv: '1000.00',
        expense_account_id: expenseAccountId,
        fmv_basis: null,
        fmv_documentation: [],
        counterparty_contact_id: null,
        reference: null,
        memo: null,
        attachments: [],
      };

      const validation = service.validateBarterTransaction(request);

      expect(validation.is_valid).toBe(true);
      expect(validation.warnings.some((w: any) => w.includes('documenting'))).toBe(true);
    });

    it('should warn about 1099-B reporting for large transactions', () => {
      const request: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: 'Services',
        goods_received_fmv: '600.00',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Services',
        goods_provided_fmv: '600.00',
        expense_account_id: expenseAccountId,
        fmv_basis: 'MARKET_PRICE',
        fmv_documentation: [],
        counterparty_contact_id: null,
        reference: null,
        memo: null,
        attachments: [],
      };

      const validation = service.validateBarterTransaction(request);

      expect(validation.is_valid).toBe(true);
      expect(validation.warnings.some((w: any) => w.includes('1099-B'))).toBe(true);
    });
  });

  describe('postBarterTransaction', () => {
    it('should post a draft barter transaction', async () => {
      const request: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: 'Services',
        goods_received_fmv: '1000.00',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Services',
        goods_provided_fmv: '1000.00',
        expense_account_id: expenseAccountId,
        fmv_basis: 'MARKET_PRICE',
        fmv_documentation: [],
        counterparty_contact_id: null,
        reference: null,
        memo: null,
        attachments: [],
      };

      const result = await service.createBarterTransaction(request, deviceId, userId);
      expect(result.barter.status).toBe('DRAFT');

      await service.postBarterTransaction(result.barter.id, deviceId);

      const updated = await mockDb.transactions.get(result.barter.id);
      expect(updated?.status).toBe('POSTED');
    });

    it('should reject posting non-draft transaction', async () => {
      const request: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: 'Services',
        goods_received_fmv: '1000.00',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Services',
        goods_provided_fmv: '1000.00',
        expense_account_id: expenseAccountId,
        fmv_basis: 'MARKET_PRICE',
        fmv_documentation: [],
        counterparty_contact_id: null,
        reference: null,
        memo: null,
        attachments: [],
      };

      const result = await service.createBarterTransaction(request, deviceId, userId);
      await service.postBarterTransaction(result.barter.id, deviceId);

      await expect(
        service.postBarterTransaction(result.barter.id, deviceId)
      ).rejects.toThrow('Cannot post');
    });
  });

  describe('voidBarterTransaction', () => {
    it('should void a barter transaction', async () => {
      const request: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: 'Services',
        goods_received_fmv: '1000.00',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Services',
        goods_provided_fmv: '1000.00',
        expense_account_id: expenseAccountId,
        fmv_basis: 'MARKET_PRICE',
        fmv_documentation: [],
        counterparty_contact_id: null,
        reference: null,
        memo: null,
        attachments: [],
      };

      const result = await service.createBarterTransaction(request, deviceId, userId);
      await service.postBarterTransaction(result.barter.id, deviceId);

      await service.voidBarterTransaction(result.barter.id, deviceId, 'Error in entry');

      const updated = await mockDb.transactions.get(result.barter.id);
      expect(updated?.status).toBe('VOID');
      expect(updated?.memo).toContain('VOIDED');
    });

    it('should reject voiding already voided transaction', async () => {
      const request: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: 'Services',
        goods_received_fmv: '1000.00',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Services',
        goods_provided_fmv: '1000.00',
        expense_account_id: expenseAccountId,
        fmv_basis: 'MARKET_PRICE',
        fmv_documentation: [],
        counterparty_contact_id: null,
        reference: null,
        memo: null,
        attachments: [],
      };

      const result = await service.createBarterTransaction(request, deviceId, userId);
      await service.voidBarterTransaction(result.barter.id, deviceId, 'Test');

      await expect(
        service.voidBarterTransaction(result.barter.id, deviceId, 'Test again')
      ).rejects.toThrow('already voided');
    });
  });

  describe('queryBarterTransactions', () => {
    it('should query barter transactions by company', async () => {
      // Create multiple barter transactions
      const request1: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: 'Services 1',
        goods_received_fmv: '1000.00',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Services 1',
        goods_provided_fmv: '1000.00',
        expense_account_id: expenseAccountId,
        fmv_basis: 'MARKET_PRICE',
        fmv_documentation: [],
        counterparty_contact_id: null,
        reference: null,
        memo: null,
        attachments: [],
      };

      const request2: CreateBarterTransactionRequest = {
        ...request1,
        goods_received_description: 'Services 2',
        goods_received_fmv: '500.00',
        goods_provided_fmv: '500.00',
      };

      await service.createBarterTransaction(request1, deviceId, userId);
      await service.createBarterTransaction(request2, deviceId, userId);

      const results = await service.queryBarterTransactions({
        company_id: companyId,
      });

      expect(results.length).toBe(2);
      expect(results.every((txn: any) => txn.type === 'BARTER')).toBe(true);
    });

    it('should filter by 1099-reportable status', async () => {
      const request1: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: 'Large transaction',
        goods_received_fmv: '1000.00',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Services',
        goods_provided_fmv: '1000.00',
        expense_account_id: expenseAccountId,
        fmv_basis: 'MARKET_PRICE',
        fmv_documentation: [],
        counterparty_contact_id: null,
        reference: null,
        memo: null,
        attachments: [],
      };

      const request2: CreateBarterTransactionRequest = {
        ...request1,
        goods_received_description: 'Small transaction',
        goods_received_fmv: '100.00',
        goods_provided_fmv: '100.00',
      };

      await service.createBarterTransaction(request1, deviceId, userId);
      await service.createBarterTransaction(request2, deviceId, userId);

      const reportable = await service.queryBarterTransactions({
        company_id: companyId,
        is_1099_reportable: true,
      });

      expect(reportable.length).toBe(1);
      expect(reportable[0].goods_received_description).toBe('Large transaction');
    });
  });

  describe('getBarterStatistics', () => {
    it('should calculate statistics correctly', async () => {
      const year = new Date().getFullYear();

      const request1: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: 'Transaction 1',
        goods_received_fmv: '1000.00',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Services 1',
        goods_provided_fmv: '900.00',
        expense_account_id: expenseAccountId,
        fmv_basis: 'MARKET_PRICE',
        fmv_documentation: [],
        counterparty_contact_id: null,
        reference: null,
        memo: null,
        attachments: [],
      };

      const request2: CreateBarterTransactionRequest = {
        ...request1,
        goods_received_description: 'Transaction 2',
        goods_received_fmv: '500.00',
        goods_provided_fmv: '500.00',
      };

      await service.createBarterTransaction(request1, deviceId, userId);
      await service.createBarterTransaction(request2, deviceId, userId);

      const stats = await service.getBarterStatistics(companyId, year);

      expect(stats.total_transactions).toBe(2);
      expect(stats.total_income_fmv).toBe('1500.00');
      expect(stats.total_expense_fmv).toBe('1400.00');
      expect(stats.reportable_1099_count).toBe(1); // Only first transaction >= $600
    });
  });

  describe('get1099BSummary', () => {
    it('should generate 1099-B summary grouped by counterparty', async () => {
      const year = new Date().getFullYear();
      const contactId = 'contact-123';

      // Mock contact
      (mockDb.contacts.get as any).mockResolvedValue({
        id: contactId,
        name: 'Test Counterparty',
        tax_id: '12-3456789',
        address: '123 Main St',
      });

      const request1: CreateBarterTransactionRequest = {
        company_id: companyId,
        transaction_date: Date.now(),
        goods_received_description: 'Transaction 1',
        goods_received_fmv: '1000.00',
        income_account_id: incomeAccountId,
        goods_provided_description: 'Services 1',
        goods_provided_fmv: '1000.00',
        expense_account_id: expenseAccountId,
        fmv_basis: 'MARKET_PRICE',
        fmv_documentation: [],
        counterparty_contact_id: contactId,
        reference: null,
        memo: null,
        attachments: [],
      };

      const request2: CreateBarterTransactionRequest = {
        ...request1,
        goods_received_description: 'Transaction 2',
        goods_received_fmv: '800.00',
        goods_provided_fmv: '800.00',
      };

      await service.createBarterTransaction(request1, deviceId, userId);
      await service.createBarterTransaction(request2, deviceId, userId);

      const summary = await service.get1099BSummary(companyId, year);

      expect(summary.counterparty_count).toBe(1);
      expect(summary.total_reportable_income).toBe('1800.00');
      expect(summary.counterparties[0].counterparty_name).toBe('Test Counterparty');
      expect(summary.counterparties[0].transaction_count).toBe(2);
    });
  });
});
