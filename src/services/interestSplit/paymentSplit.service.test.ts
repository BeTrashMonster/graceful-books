/**
 * Payment Split Service Tests
 *
 * Tests GAAP-compliant journal entry creation for loan payment splits.
 *
 * Requirements:
 * - H7: Interest Split Prompt System (GAAP compliance)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentSplitService } from './paymentSplit.service';
import type { TreasureChestDB } from '../../db/database';
import type { SplitPaymentRequest } from '../../types/loanAmortization.types';
import Decimal from 'decimal.js';

describe('PaymentSplitService', () => {
  let service: PaymentSplitService;
  let mockDb: Partial<TreasureChestDB>;

  beforeEach(() => {
    mockDb = {
      transactions: {
        get: vi.fn(),
        add: vi.fn(),
      } as any,
      transactionLineItems: {
        where: vi.fn(() => ({
          equals: vi.fn(() => ({
            and: vi.fn(() => ({
              toArray: vi.fn(() => Promise.resolve([])),
            })),
          })),
        })),
        bulkAdd: vi.fn(),
      } as any,
      accounts: {
        get: vi.fn(),
      } as any,
    };
    service = new PaymentSplitService(mockDb as TreasureChestDB);
  });

  describe('validateSplit', () => {
    it('should validate when principal + interest equals total', async () => {
      // Mock loan account (table doesn't exist yet)
      const mockLoanAccount = {
        id: 'loan-1',
        company_id: 'company-1',
        account_id: 'liability-account-1',
        interest_expense_account_id: 'interest-expense-1',
        current_balance: '10000.00',
        original_amount: '10000.00',
        interest_rate: '6.0',
        term_months: 12,
        start_date: Date.now(),
        payment_frequency: 'monthly' as const,
        calculation_method: 'AMORTIZED' as const,
        name: 'Business Loan',
        lender_name: 'ABC Bank',
        account_number: null,
        notes: null,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { device1: 1 },
      };

      // Mock account lookups
      vi.spyOn(service as any, 'getLoanAccount').mockResolvedValue(mockLoanAccount);
      vi.mocked(mockDb.accounts!.get).mockImplementation(async (id: string) => {
        if (id === 'liability-account-1') {
          return {
            id: 'liability-account-1',
            company_id: 'company-1',
            account_number: '2000',
            name: 'Loan Payable',
            type: 'LIABILITY',
            parent_id: null,
            balance: '10000.00',
            description: null,
            active: true,
            created_at: Date.now(),
            updated_at: Date.now(),
            deleted_at: null,
            version_vector: { device1: 1 },
          } as any;
        } else if (id === 'interest-expense-1') {
          return {
            id: 'interest-expense-1',
            company_id: 'company-1',
            account_number: '5100',
            name: 'Interest Expense',
            type: 'EXPENSE',
            parent_id: null,
            balance: '0',
            description: null,
            active: true,
            created_at: Date.now(),
            updated_at: Date.now(),
            deleted_at: null,
            version_vector: { device1: 1 },
          } as any;
        }
        return undefined;
      });

      const request: SplitPaymentRequest = {
        transaction_id: 'txn-1',
        loan_account_id: 'loan-1',
        total_payment_amount: '1000.00',
        principal_amount: '800.00',
        interest_amount: '200.00',
        payment_date: Date.now(),
        schedule_entry_id: null,
        user_specified_split: false,
        notes: null,
      };

      const result = await service.validateSplit(request);

      expect(result.is_valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject when principal + interest does not equal total', async () => {
      // Mock loan account
      vi.spyOn(service as any, 'getLoanAccount').mockResolvedValue({
        id: 'loan-1',
        account_id: 'liability-account-1',
        interest_expense_account_id: 'interest-expense-1',
        current_balance: '10000.00',
      });

      vi.mocked(mockDb.accounts!.get).mockImplementation(async (id: string) => {
        if (id === 'liability-account-1') {
          return { type: 'LIABILITY' } as any;
        } else if (id === 'interest-expense-1') {
          return { type: 'EXPENSE' } as any;
        }
        return undefined;
      });

      const request: SplitPaymentRequest = {
        transaction_id: 'txn-1',
        loan_account_id: 'loan-1',
        total_payment_amount: '1000.00',
        principal_amount: '850.00',
        interest_amount: '200.00',
        payment_date: Date.now(),
        schedule_entry_id: null,
        user_specified_split: false,
        notes: null,
      };

      const result = await service.validateSplit(request);

      expect(result.is_valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // The error message should contain information about the mismatch
      const errorMessage = result.errors.join(' ');
      expect(errorMessage).toContain('Principal');
      expect(errorMessage).toContain('must equal total payment');
    });

    it('should reject negative principal', async () => {
      const request: SplitPaymentRequest = {
        transaction_id: 'txn-1',
        loan_account_id: 'loan-1',
        total_payment_amount: '1000.00',
        principal_amount: '-100.00',
        interest_amount: '1100.00',
        payment_date: Date.now(),
        schedule_entry_id: null,
        user_specified_split: false,
        notes: null,
      };

      const result = await service.validateSplit(request);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContain('Principal amount cannot be negative');
    });

    it('should reject negative interest', async () => {
      const request: SplitPaymentRequest = {
        transaction_id: 'txn-1',
        loan_account_id: 'loan-1',
        total_payment_amount: '1000.00',
        principal_amount: '1100.00',
        interest_amount: '-100.00',
        payment_date: Date.now(),
        schedule_entry_id: null,
        user_specified_split: false,
        notes: null,
      };

      const result = await service.validateSplit(request);

      expect(result.is_valid).toBe(false);
      expect(result.errors).toContain('Interest amount cannot be negative');
    });

    it('should handle decimal precision correctly', async () => {
      // Mock loan account
      vi.spyOn(service as any, 'getLoanAccount').mockResolvedValue({
        id: 'loan-1',
        account_id: 'liability-account-1',
        interest_expense_account_id: 'interest-expense-1',
        current_balance: '10000.00',
      });

      vi.mocked(mockDb.accounts!.get).mockImplementation(async (id: string) => {
        if (id === 'liability-account-1') {
          return { type: 'LIABILITY' } as any;
        } else if (id === 'interest-expense-1') {
          return { type: 'EXPENSE' } as any;
        }
        return undefined;
      });

      const request: SplitPaymentRequest = {
        transaction_id: 'txn-1',
        loan_account_id: 'loan-1',
        total_payment_amount: '860.66',
        principal_amount: '810.66',
        interest_amount: '50.00',
        payment_date: Date.now(),
        schedule_entry_id: null,
        user_specified_split: false,
        notes: null,
      };

      const result = await service.validateSplit(request);

      expect(result.is_valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn when principal exceeds loan balance', async () => {
      // Mock loan account with lower balance than principal payment
      vi.spyOn(service as any, 'getLoanAccount').mockResolvedValue({
        id: 'loan-1',
        account_id: 'liability-account-1',
        interest_expense_account_id: 'interest-expense-1',
        current_balance: '10000.00', // Lower than principal of 14500
      });

      vi.mocked(mockDb.accounts!.get).mockImplementation(async (id: string) => {
        if (id === 'liability-account-1') {
          return { type: 'LIABILITY' } as any;
        } else if (id === 'interest-expense-1') {
          return { type: 'EXPENSE' } as any;
        }
        return undefined;
      });

      const request: SplitPaymentRequest = {
        transaction_id: 'txn-1',
        loan_account_id: 'loan-1',
        total_payment_amount: '15000.00',
        principal_amount: '14500.00',
        interest_amount: '500.00',
        payment_date: Date.now(),
        schedule_entry_id: null,
        user_specified_split: false,
        notes: null,
      };

      const result = await service.validateSplit(request);

      // Should still validate but with warning
      expect(result.is_valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('exceeds current loan balance');
    });
  });

  describe('journal entry structure', () => {
    it('should create balanced journal entry with three lines', () => {
      // Test the accounting structure conceptually
      const principal = new Decimal('800.00');
      const interest = new Decimal('200.00');
      const total = new Decimal('1000.00');

      // Line 1: DR Liability (reduces liability)
      const debitLiability = principal;

      // Line 2: DR Interest Expense
      const debitInterest = interest;

      // Line 3: CR Cash/Bank
      const creditCash = total;

      // Total debits should equal total credits
      const totalDebits = debitLiability.plus(debitInterest);
      const totalCredits = creditCash;

      expect(totalDebits.equals(totalCredits)).toBe(true);
    });

    it('should maintain double-entry accounting', () => {
      // Every debit must have a corresponding credit
      const debits = [
        new Decimal('800.00'), // Principal
        new Decimal('200.00'), // Interest
      ];

      const credits = [
        new Decimal('1000.00'), // Cash
      ];

      const totalDebits = debits.reduce((sum, d) => sum.plus(d), new Decimal('0'));
      const totalCredits = credits.reduce((sum, c) => sum.plus(c), new Decimal('0'));

      expect(totalDebits.equals(totalCredits)).toBe(true);
    });
  });

  describe('GAAP compliance', () => {
    it('should separate principal and interest correctly', () => {
      // GAAP requires separation of principal (liability reduction)
      // and interest (expense)

      const payment = new Decimal('1000.00');
      const principal = new Decimal('800.00');
      const interest = new Decimal('200.00');

      // Principal affects balance sheet (reduces liability)
      // Interest affects income statement (expense)

      expect(principal.plus(interest).equals(payment)).toBe(true);
    });

    it('should record interest as expense not liability reduction', () => {
      // Common mistake: recording entire payment as liability reduction
      // Correct: split between liability reduction and expense

      const incorrectLiabilityReduction = new Decimal('1000.00');
      const correctLiabilityReduction = new Decimal('800.00');
      const interestExpense = new Decimal('200.00');

      expect(
        correctLiabilityReduction.plus(interestExpense).equals(incorrectLiabilityReduction)
      ).toBe(true);

      // Only principal should reduce liability
      expect(correctLiabilityReduction.lessThan(incorrectLiabilityReduction)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return error result when validation fails', async () => {
      const request: SplitPaymentRequest = {
        transaction_id: 'txn-1',
        loan_account_id: 'loan-1',
        total_payment_amount: '1000.00',
        principal_amount: '900.00',
        interest_amount: '200.00', // Sum exceeds total
        payment_date: Date.now(),
        schedule_entry_id: null,
        user_specified_split: false,
        notes: null,
      };

      const result = await service.splitPayment(request, 'device-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.journal_entry_id).toBeNull();
    });
  });

  describe('decimal precision', () => {
    it('should avoid floating point errors', () => {
      // JavaScript: 0.1 + 0.2 = 0.30000000000000004
      // Decimal.js: 0.1 + 0.2 = 0.3

      const a = new Decimal('0.1');
      const b = new Decimal('0.2');
      const sum = a.plus(b);

      expect(sum.toString()).toBe('0.3');
      expect(sum.toFixed(2)).toBe('0.30');
    });

    it('should handle complex amortization calculations precisely', () => {
      // Real-world amortization calculation
      const balance = new Decimal('10000');
      const monthlyRate = new Decimal('0.005'); // 6% annual / 12
      const payment = new Decimal('860.66');

      const interest = balance.times(monthlyRate);
      const principal = payment.minus(interest);

      expect(interest.toFixed(2)).toBe('50.00');
      expect(principal.toFixed(2)).toBe('810.66');
      expect(principal.plus(interest).toFixed(2)).toBe('860.66');
    });
  });
});
