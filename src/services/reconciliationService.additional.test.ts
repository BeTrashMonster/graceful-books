/**
 * Additional Comprehensive Tests for Reconciliation Service
 *
 * These tests focus on:
 * - Encryption of sensitive financial data
 * - Edge cases and error scenarios
 * - First reconciliation experience
 * - Data validation and integrity
 * - Complex matching scenarios
 * - DISC-adapted error messaging
 *
 * Part of D8 task for comprehensive unit test coverage
 */

import { describe, it, expect } from 'vitest';
import {
  createReconciliation,
  applyMatches,
  addManualMatch,
  removeMatch,
  calculateDiscrepancy,
  completeReconciliation,
  abandonReconciliation,
  getTransactionsToReconcile,
  getReconciliationSummary,
} from './reconciliationService';
import type {
  ParsedStatement,
  TransactionMatch,
  Reconciliation,
  StatementTransaction,
} from '../types/reconciliation.types';
import type { JournalEntry } from '../types';
import { ReconciliationStatus } from '../types/reconciliation.types';

describe('ReconciliationService - Additional Comprehensive Tests', () => {
  const baseDate = new Date('2024-01-15');
  const accountId = 'test-account-123';
  const companyId = 'test-company-123';

  const createMockStatement = (overrides?: Partial<ParsedStatement>): ParsedStatement => ({
    statementPeriod: {
      startDate: new Date('2024-01-01').getTime(),
      endDate: new Date('2024-01-31').getTime(),
    },
    openingBalance: 100000, // $1000.00
    closingBalance: 105000, // $1050.00
    transactions: [
      {
        id: 'stmt-1',
        date: baseDate.getTime(),
        description: 'Test Transaction',
        amount: 5000, // $50.00
        matched: false,
      },
    ],
    format: 'csv',
    ...overrides,
  });

  const createMockJournalEntry = (
    overrides?: Partial<JournalEntry>
  ): JournalEntry => ({
    id: 'txn-' + Math.random(),
    companyId,
    date: baseDate,
    status: 'posted',
    lines: [
      {
        id: 'line-1',
        accountId,
        debit: 50.0,
        credit: 0,
      },
      {
        id: 'line-2',
        accountId: 'other-account',
        debit: 0,
        credit: 50.0,
      },
    ],
    createdBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('First Reconciliation Experience', () => {
    it('should mark reconciliation as first-time correctly', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: true,
      });

      expect(reconciliation.is_first_reconciliation).toBe(true);
    });

    it('should handle first reconciliation with empty opening balance', () => {
      const statement = createMockStatement({
        openingBalance: undefined,
        closingBalance: 50000,
      });

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: true,
      });

      expect(reconciliation.opening_balance).toBe(0);
      expect(reconciliation.closing_balance).toBe(50000);
    });

    it('should initialize all first-time reconciliation fields properly', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: true,
      });

      expect(reconciliation.status).toBe(ReconciliationStatus.DRAFT);
      expect(reconciliation.completed_at).toBeNull();
      expect(reconciliation.notes).toBeNull();
      expect(reconciliation.discrepancy).toBe(0);
      expect(reconciliation.is_first_reconciliation).toBe(true);
    });
  });

  describe('Encryption of Sensitive Data', () => {
    it('should store statement data as JSON string (ready for encryption)', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      // Verify statement data is stored as string
      expect(typeof reconciliation.statement_data).toBe('string');

      // Verify it can be parsed back
      const parsed = JSON.parse(reconciliation.statement_data);
      expect(parsed).toEqual(statement);
    });

    it('should store matched transactions as JSON string (ready for encryption)', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const matches: TransactionMatch[] = [
        {
          statementTransactionId: 'stmt-1',
          systemTransactionId: 'txn-1',
          confidence: 'EXACT',
          score: 95,
          reasons: ['Exact match'],
        },
      ];

      const updated = applyMatches(reconciliation, matches);

      // Verify matched transactions stored as string
      expect(typeof updated.matched_transactions).toBe('string');

      const parsed = JSON.parse(updated.matched_transactions);
      expect(parsed).toContain('txn-1');
    });

    it('should handle balances as numbers in cents (encrypted when stored)', () => {
      const statement = createMockStatement({
        openingBalance: 123456, // $1234.56
        closingBalance: 654321, // $6543.21
      });

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      // Balances stored as numbers in cents (will be encrypted in actual storage)
      expect(reconciliation.opening_balance).toBe(123456);
      expect(reconciliation.closing_balance).toBe(654321);
      expect(typeof reconciliation.opening_balance).toBe('number');
      expect(typeof reconciliation.closing_balance).toBe('number');
    });

    it('should store notes as string ready for encryption', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const completed = completeReconciliation(
        reconciliation,
        'Reconciled successfully, minor rounding difference accepted'
      );

      expect(typeof completed.notes).toBe('string');
      expect(completed.notes).toBe(
        'Reconciled successfully, minor rounding difference accepted'
      );
    });
  });

  describe('Complex Matching Scenarios', () => {
    it('should handle multiple matches applied in batch', () => {
      const statement = createMockStatement({
        transactions: [
          {
            id: 'stmt-1',
            date: baseDate.getTime(),
            description: 'Transaction 1',
            amount: 1000,
            matched: false,
          },
          {
            id: 'stmt-2',
            date: baseDate.getTime(),
            description: 'Transaction 2',
            amount: 2000,
            matched: false,
          },
          {
            id: 'stmt-3',
            date: baseDate.getTime(),
            description: 'Transaction 3',
            amount: 3000,
            matched: false,
          },
        ],
      });

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      // Apply all matches at once (as applyMatches replaces, not appends)
      const matches: TransactionMatch[] = [
        {
          statementTransactionId: 'stmt-1',
          systemTransactionId: 'txn-1',
          confidence: 'EXACT',
          score: 95,
          reasons: [],
        },
        {
          statementTransactionId: 'stmt-2',
          systemTransactionId: 'txn-2',
          confidence: 'HIGH',
          score: 85,
          reasons: [],
        },
        {
          statementTransactionId: 'stmt-3',
          systemTransactionId: 'txn-3',
          confidence: 'MEDIUM',
          score: 70,
          reasons: [],
        },
      ];

      const updated = applyMatches(reconciliation, matches);

      const matchedIds = JSON.parse(updated.matched_transactions);
      expect(matchedIds).toHaveLength(3);
      expect(matchedIds).toContain('txn-1');
      expect(matchedIds).toContain('txn-2');
      expect(matchedIds).toContain('txn-3');
    });

    it('should handle adding and removing matches', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      // Add a match
      const withMatch = addManualMatch(reconciliation, 'stmt-1', 'txn-1');

      let matchedIds = JSON.parse(withMatch.matched_transactions);
      expect(matchedIds).toContain('txn-1');

      // Remove the match
      const withoutMatch = removeMatch(withMatch, 'stmt-1');

      matchedIds = JSON.parse(withoutMatch.matched_transactions);
      expect(matchedIds).not.toContain('txn-1');
    });

    it('should update statement transaction match status correctly', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const withMatch = addManualMatch(reconciliation, 'stmt-1', 'txn-1');

      const parsedStatement = JSON.parse(withMatch.statement_data);
      const transaction = parsedStatement.transactions.find(
        (t: StatementTransaction) => t.id === 'stmt-1'
      );

      expect(transaction.matched).toBe(true);
      expect(transaction.matchedTransactionId).toBe('txn-1');
    });
  });

  describe('Discrepancy Calculation Edge Cases', () => {
    it('should handle zero discrepancy', () => {
      const statement = createMockStatement({
        openingBalance: 100000,
        closingBalance: 105000,
        transactions: [
          {
            id: 'stmt-1',
            date: baseDate.getTime(),
            description: 'Deposit',
            amount: 5000,
            matched: false,
          },
        ],
      });

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const withMatch = addManualMatch(reconciliation, 'stmt-1', 'txn-1');

      const systemTransactions: JournalEntry[] = [
        createMockJournalEntry({
          id: 'txn-1',
          lines: [
            { id: 'line-1', accountId, debit: 50.0, credit: 0 },
            { id: 'line-2', accountId: 'other', debit: 0, credit: 50.0 },
          ],
        }),
      ];

      const discrepancy = calculateDiscrepancy(
        withMatch,
        systemTransactions,
        accountId
      );

      expect(discrepancy).toBe(0);
    });

    it('should calculate positive discrepancy when statement is higher', () => {
      const statement = createMockStatement({
        openingBalance: 100000,
        closingBalance: 110000, // Higher than expected
        transactions: [
          {
            id: 'stmt-1',
            date: baseDate.getTime(),
            description: 'Deposit',
            amount: 5000, // Only $50 deposited
            matched: false,
          },
        ],
      });

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const withMatch = addManualMatch(reconciliation, 'stmt-1', 'txn-1');

      const systemTransactions: JournalEntry[] = [
        createMockJournalEntry({
          id: 'txn-1',
          lines: [
            { id: 'line-1', accountId, debit: 50.0, credit: 0 },
            { id: 'line-2', accountId: 'other', debit: 0, credit: 50.0 },
          ],
        }),
      ];

      const discrepancy = calculateDiscrepancy(
        withMatch,
        systemTransactions,
        accountId
      );

      expect(discrepancy).toBe(5000); // $50 discrepancy
    });

    it('should handle negative amounts (withdrawals)', () => {
      const statement = createMockStatement({
        openingBalance: 100000,
        closingBalance: 95000, // Withdrawal
        transactions: [
          {
            id: 'stmt-1',
            date: baseDate.getTime(),
            description: 'Withdrawal',
            amount: -5000, // Negative for withdrawal
            matched: false,
          },
        ],
      });

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const withMatch = addManualMatch(reconciliation, 'stmt-1', 'txn-1');

      const systemTransactions: JournalEntry[] = [
        createMockJournalEntry({
          id: 'txn-1',
          lines: [
            { id: 'line-1', accountId, debit: 0, credit: 50.0 }, // Credit decreases bank balance
            { id: 'line-2', accountId: 'other', debit: 50.0, credit: 0 },
          ],
        }),
      ];

      const discrepancy = calculateDiscrepancy(
        withMatch,
        systemTransactions,
        accountId
      );

      expect(discrepancy).toBe(0); // Should balance
    });

    it('should return zero discrepancy when balances are undefined', () => {
      const statement = createMockStatement({
        openingBalance: undefined,
        closingBalance: undefined,
      });

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const systemTransactions: JournalEntry[] = [];

      const discrepancy = calculateDiscrepancy(
        reconciliation,
        systemTransactions,
        accountId
      );

      expect(discrepancy).toBe(0);
    });
  });

  describe('Reconciliation Status Management', () => {
    it('should complete reconciliation successfully', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: true,
      });

      const completed = completeReconciliation(reconciliation, 'All matched!');

      expect(completed.status).toBe(ReconciliationStatus.COMPLETED);
      expect(completed.completed_at).toBeDefined();
      expect(completed.completed_at).toBeGreaterThan(0);
      expect(completed.notes).toBe('All matched!');
    });

    it('should complete reconciliation without notes', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const completed = completeReconciliation(reconciliation);

      expect(completed.status).toBe(ReconciliationStatus.COMPLETED);
      expect(completed.notes).toBeNull();
    });

    it('should abandon reconciliation', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const abandoned = abandonReconciliation(reconciliation);

      expect(abandoned.status).toBe(ReconciliationStatus.ABANDONED);
    });

    it('should prevent completing already completed reconciliation', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const completed = completeReconciliation(reconciliation);

      expect(() => {
        completeReconciliation(completed);
      }).toThrow();
    });

    it('should only return transaction IDs after completion', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const withMatch = addManualMatch(reconciliation, 'stmt-1', 'txn-1');

      // Should throw before completion
      expect(() => {
        getTransactionsToReconcile(withMatch);
      }).toThrow();

      // Should work after completion
      const completed = completeReconciliation(withMatch);
      const transactionIds = getTransactionsToReconcile(completed);

      expect(transactionIds).toContain('txn-1');
    });
  });

  describe('Reconciliation Summary and Statistics', () => {
    it('should calculate match rate correctly', () => {
      const statement = createMockStatement({
        transactions: [
          {
            id: 'stmt-1',
            date: baseDate.getTime(),
            description: 'Tx 1',
            amount: 1000,
            matched: false,
          },
          {
            id: 'stmt-2',
            date: baseDate.getTime(),
            description: 'Tx 2',
            amount: 2000,
            matched: false,
          },
          {
            id: 'stmt-3',
            date: baseDate.getTime(),
            description: 'Tx 3',
            amount: 3000,
            matched: false,
          },
          {
            id: 'stmt-4',
            date: baseDate.getTime(),
            description: 'Tx 4',
            amount: 4000,
            matched: false,
          },
        ],
      });

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      // Match 3 out of 4
      const matches: TransactionMatch[] = [
        {
          statementTransactionId: 'stmt-1',
          systemTransactionId: 'txn-1',
          confidence: 'EXACT',
          score: 95,
          reasons: [],
        },
        {
          statementTransactionId: 'stmt-2',
          systemTransactionId: 'txn-2',
          confidence: 'HIGH',
          score: 85,
          reasons: [],
        },
        {
          statementTransactionId: 'stmt-3',
          systemTransactionId: 'txn-3',
          confidence: 'MEDIUM',
          score: 70,
          reasons: [],
        },
      ];

      const updated = applyMatches(reconciliation, matches);
      const summary = getReconciliationSummary(updated);

      expect(summary.totalStatementTransactions).toBe(4);
      expect(summary.matchedCount).toBe(3);
      expect(summary.unmatchedStatementCount).toBe(1);
      expect(summary.matchRate).toBe(75); // 3/4 * 100 = 75%
    });

    it('should identify balanced reconciliation correctly', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const summary = getReconciliationSummary({
        ...reconciliation,
        discrepancy: 0, // Balanced
      });

      expect(summary.isBalanced).toBe(true);
    });

    it('should accept sub-cent discrepancies as balanced', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      // 0.5 cents - should still be considered balanced
      const summary = getReconciliationSummary({
        ...reconciliation,
        discrepancy: 0.5,
      });

      expect(summary.isBalanced).toBe(true);
    });

    it('should identify unbalanced reconciliation correctly', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const summary = getReconciliationSummary({
        ...reconciliation,
        discrepancy: 100, // $1.00 discrepancy
      });

      expect(summary.isBalanced).toBe(false);
    });

    it('should handle zero transactions gracefully', () => {
      const statement = createMockStatement({
        transactions: [],
      });

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const summary = getReconciliationSummary(reconciliation);

      expect(summary.totalStatementTransactions).toBe(0);
      expect(summary.matchedCount).toBe(0);
      expect(summary.matchRate).toBe(0);
    });
  });

  describe('Version Vector and CRDT Support', () => {
    it('should initialize version vector on creation', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      expect(reconciliation.version_vector).toBeDefined();
      expect(typeof reconciliation.version_vector).toBe('object');
    });

    it('should increment version vector on updates', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const initialVersion = JSON.stringify(reconciliation.version_vector);

      const withMatch = addManualMatch(reconciliation, 'stmt-1', 'txn-1');

      const updatedVersion = JSON.stringify(withMatch.version_vector);

      expect(updatedVersion).not.toBe(initialVersion);
    });

    it('should increment version vector on completion', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const initialVersion = JSON.stringify(reconciliation.version_vector);

      const completed = completeReconciliation(reconciliation);

      const updatedVersion = JSON.stringify(completed.version_vector);

      expect(updatedVersion).not.toBe(initialVersion);
    });
  });

  describe('Timestamp Management', () => {
    it('should set createdAt and updatedAt on creation', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      expect(typeof reconciliation.created_at).toBe('number');
      expect(typeof reconciliation.updated_at).toBe('number');
      expect(reconciliation.created_at).toBeLessThanOrEqual(
        reconciliation.updated_at
      );
    });

    it('should update updatedAt on modifications', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const originalUpdated = reconciliation.updated_at;

      // Wait a tiny bit to ensure timestamp difference
      const withMatch = addManualMatch(reconciliation, 'stmt-1', 'txn-1');

      expect(withMatch.updated_at).toBeGreaterThanOrEqual(originalUpdated);
    });

    it('should set completed_at on completion', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      expect(reconciliation.completed_at).toBeNull();

      const completed = completeReconciliation(reconciliation);

      expect(completed.completed_at).toBeDefined();
      expect(completed.completed_at).toBeGreaterThan(0);
    });
  });

  describe('Error Messages - DISC Steadiness Style', () => {
    it('should provide helpful error for already matched transaction', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      const withMatch = addManualMatch(reconciliation, 'stmt-1', 'txn-1');

      try {
        addManualMatch(withMatch, 'stmt-1', 'txn-2');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Error message should be supportive, not blaming
        expect(error.message).toContain('already matched');
        expect(error.message).not.toContain('error');
        expect(error.message).not.toContain('invalid');
      }
    });

    it('should provide helpful error for non-existent transaction', () => {
      const statement = createMockStatement();

      const reconciliation = createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation: false,
      });

      try {
        addManualMatch(reconciliation, 'non-existent', 'txn-1');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Error message should be supportive
        expect(error.message).toContain("couldn't find");
        expect(error.message).not.toContain('invalid');
      }
    });
  });
});
