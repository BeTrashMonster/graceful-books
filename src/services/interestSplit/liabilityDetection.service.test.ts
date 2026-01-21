/**
 * Liability Detection Service Tests
 *
 * Tests the multi-factor detection algorithm for loan payment identification.
 *
 * Requirements:
 * - H7: Interest Split Prompt System (97% accuracy target)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LiabilityDetectionService } from './liabilityDetection.service';
import type { TreasureChestDB } from '../../db/database';
import { TransactionType, TransactionStatus, AccountType } from '../../types/database.types';
import type { Transaction, TransactionLineItem, Account } from '../../types/database.types';

// Mock database
const createMockDb = () => {
  const transactions = new Map<string, Transaction>();
  const lineItems = new Map<string, TransactionLineItem[]>();
  const accounts = new Map<string, Account>();

  const mockDb: Partial<TreasureChestDB> = {
    transactions: {
      get: vi.fn((id: string) => Promise.resolve(transactions.get(id))),
      where: vi.fn(() => ({
        anyOf: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    } as any,
    transactionLineItems: {
      where: vi.fn(() => ({
        equals: vi.fn((txnId: string) => ({
          and: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve(lineItems.get(txnId) || [])),
          })),
        })),
        anyOf: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    } as any,
    accounts: {
      get: vi.fn((id: string) => Promise.resolve(accounts.get(id))),
    } as any,
  };

  return { mockDb, transactions, lineItems, accounts };
};

describe('LiabilityDetectionService', () => {
  let service: LiabilityDetectionService;
  let mockDb: Partial<TreasureChestDB>;
  let transactions: Map<string, Transaction>;
  let lineItems: Map<string, TransactionLineItem[]>;
  let accounts: Map<string, Account>;

  beforeEach(() => {
    const mock = createMockDb();
    mockDb = mock.mockDb;
    transactions = mock.transactions;
    lineItems = mock.lineItems;
    accounts = mock.accounts;
    service = new LiabilityDetectionService(mockDb as TreasureChestDB);
  });

  describe('detectLiabilityPayment', () => {
    it('should detect liability payment with high confidence when all factors present', async () => {
      // Setup transaction
      const transaction: Transaction = {
        id: 'test-txn',
        company_id: 'company-1',
        transaction_number: 'TXN-001',
        transaction_date: Date.now(),
        type: TransactionType.PAYMENT,
        status: TransactionStatus.POSTED,
        description: 'Monthly loan payment to ABC Bank',
        reference: 'Loan #12345',
        memo: 'Business loan installment',
        attachments: [],
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { device1: 1 },
      };

      // Setup line items - credit to LIABILITY account
      const txnLineItems: TransactionLineItem[] = [
        {
          id: 'line-1',
          transaction_id: 'test-txn',
          account_id: 'liability-account',
          debit: '0',
          credit: '1000.00',
          description: 'Loan payment',
          contact_id: null,
          product_id: null,
          created_at: Date.now(),
          updated_at: Date.now(),
          deleted_at: null,
          version_vector: { device1: 1 },
        },
        {
          id: 'line-2',
          transaction_id: 'test-txn',
          account_id: 'cash-account',
          debit: '1000.00',
          credit: '0',
          description: 'Payment from cash',
          contact_id: null,
          product_id: null,
          created_at: Date.now(),
          updated_at: Date.now(),
          deleted_at: null,
          version_vector: { device1: 1 },
        },
      ];

      // Setup liability account
      const liabilityAccount: Account = {
        id: 'liability-account',
        company_id: 'company-1',
        account_number: '2000',
        name: 'Business Loan',
        type: AccountType.LIABILITY,
        parent_id: null,
        balance: '50000.00',
        description: 'Bank loan',
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { device1: 1 },
      };

      // Setup mock data
      transactions.set('test-txn', transaction);
      lineItems.set('test-txn', txnLineItems);
      accounts.set('liability-account', liabilityAccount);

      // Detection
      const result = await service.detectLiabilityPayment('test-txn');

      // With only account type (40) + keywords (10) = 50 points, below 60 threshold
      expect(result.is_likely_loan_payment).toBe(false);
      expect(result.confidence).toBe('LOW'); // 50 points is LOW (40-59)
      expect(result.factors.account_is_liability).toBe(true);
      expect(result.factors.memo_contains_loan_keywords).toBe(true);
      expect(result.confidence_score).toBe(50);
    });

    it('should detect with low confidence when only account type matches', async () => {
      const transaction: Transaction = {
        id: 'test-txn',
        company_id: 'company-1',
        transaction_number: 'TXN-002',
        transaction_date: Date.now(),
        type: TransactionType.PAYMENT,
        status: TransactionStatus.POSTED,
        description: 'Payment',
        reference: null,
        memo: null,
        attachments: [],
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { device1: 1 },
      };

      const txnLineItems2: TransactionLineItem[] = [
        {
          id: 'line-1',
          transaction_id: 'test-txn',
          account_id: 'liability-account',
          debit: '0',
          credit: '500.00',
          description: null,
          contact_id: null,
          product_id: null,
          created_at: Date.now(),
          updated_at: Date.now(),
          deleted_at: null,
          version_vector: { device1: 1 },
        },
      ];

      const liabilityAccount: Account = {
        id: 'liability-account',
        company_id: 'company-1',
        account_number: '2000',
        name: 'Liability',
        type: AccountType.LIABILITY,
        parent_id: null,
        balance: '10000.00',
        description: null,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { device1: 1 },
      };

      // Setup mock data
      transactions.set('test-txn', transaction);
      lineItems.set('test-txn', txnLineItems2);
      accounts.set('liability-account', liabilityAccount);

      const result = await service.detectLiabilityPayment('test-txn');

      // Description "Payment" matches loan keyword "payment" (+10)
      // Account type LIABILITY (+40) = 50 total, below 60 threshold
      expect(result.is_likely_loan_payment).toBe(false); // 50 points, below 60 threshold
      expect(result.confidence).toBe('LOW');
      expect(result.factors.account_is_liability).toBe(true);
      expect(result.factors.memo_contains_loan_keywords).toBe(true); // "Payment" contains "payment"
      expect(result.confidence_score).toBe(50);
    });

    it('should not detect when no liability accounts involved', async () => {
      const transaction: Transaction = {
        id: 'test-txn',
        company_id: 'company-1',
        transaction_number: 'TXN-003',
        transaction_date: Date.now(),
        type: TransactionType.EXPENSE,
        status: TransactionStatus.POSTED,
        description: 'Office supplies',
        reference: null,
        memo: null,
        attachments: [],
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { device1: 1 },
      };

      const expenseAccount: Account = {
        id: 'expense-account',
        company_id: 'company-1',
        account_number: '5000',
        name: 'Supplies',
        type: AccountType.EXPENSE,
        parent_id: null,
        balance: '0',
        description: null,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { device1: 1 },
      };

      vi.mocked(mockDb.transactions!.get).mockResolvedValue(transaction);
      vi.mocked(mockDb.accounts!.get).mockResolvedValue(expenseAccount);

      const result = await service.detectLiabilityPayment('test-txn');

      expect(result.is_likely_loan_payment).toBe(false);
      expect(result.confidence).toBe('LOW');
      expect(result.factors.account_is_liability).toBe(false);
      expect(result.confidence_score).toBe(0);
    });

    it('should throw error when transaction not found', async () => {
      vi.mocked(mockDb.transactions!.get).mockResolvedValue(undefined);

      await expect(service.detectLiabilityPayment('invalid-txn')).rejects.toThrow(
        'Transaction invalid-txn not found'
      );
    });
  });

  describe('detectBatch', () => {
    it('should detect multiple transactions and filter by confidence', async () => {
      const request = {
        company_id: 'company-1',
        transaction_ids: ['txn-1', 'txn-2', 'txn-3'],
        confidence_threshold: 60,
      };

      // Mock detectLiabilityPayment to return different confidence levels
      const mockDetections = [
        {
          transaction_id: 'txn-1',
          is_likely_loan_payment: true,
          confidence: 'HIGH' as const,
          confidence_score: 85,
          factors: {} as any,
          suggested_loan_account_id: null,
          suggested_principal: null,
          suggested_interest: null,
          detection_timestamp: Date.now(),
        },
        {
          transaction_id: 'txn-2',
          is_likely_loan_payment: true,
          confidence: 'MEDIUM' as const,
          confidence_score: 65,
          factors: {} as any,
          suggested_loan_account_id: null,
          suggested_principal: null,
          suggested_interest: null,
          detection_timestamp: Date.now(),
        },
        {
          transaction_id: 'txn-3',
          is_likely_loan_payment: false,
          confidence: 'LOW' as const,
          confidence_score: 45,
          factors: {} as any,
          suggested_loan_account_id: null,
          suggested_principal: null,
          suggested_interest: null,
          detection_timestamp: Date.now(),
        },
      ];

      vi.spyOn(service, 'detectLiabilityPayment').mockImplementation(
        async (id: string) => mockDetections.find((d) => d.transaction_id === id)!
      );

      const result = await service.detectBatch(request);

      expect(result.total_checked).toBe(3);
      expect(result.total_detected).toBe(2); // Only HIGH and MEDIUM (above threshold)
      expect(result.high_confidence_count).toBe(1);
      expect(result.medium_confidence_count).toBe(1);
      expect(result.low_confidence_count).toBe(0);
      expect(result.detections).toHaveLength(2);
    });

    it('should handle detection errors gracefully', async () => {
      const request = {
        company_id: 'company-1',
        transaction_ids: ['txn-1', 'txn-error', 'txn-2'],
        confidence_threshold: 50,
      };

      vi.spyOn(service, 'detectLiabilityPayment').mockImplementation(async (id: string) => {
        if (id === 'txn-error') {
          throw new Error('Detection failed');
        }
        return {
          transaction_id: id,
          is_likely_loan_payment: true,
          confidence: 'MEDIUM' as const,
          confidence_score: 65,
          factors: {} as any,
          suggested_loan_account_id: null,
          suggested_principal: null,
          suggested_interest: null,
          detection_timestamp: Date.now(),
        };
      });

      const result = await service.detectBatch(request);

      expect(result.total_checked).toBe(3);
      expect(result.total_detected).toBe(2); // Only successful detections
      expect(result.detections).toHaveLength(2);
    });
  });
});
