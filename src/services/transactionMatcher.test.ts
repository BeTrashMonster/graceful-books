/**
 * Transaction Matcher Tests
 *
 * Tests for the auto-matching algorithm
 * Target: >85% auto-match accuracy
 */

import { describe, it, expect } from 'vitest';
import { matchTransactions, getMatchStatistics } from './transactionMatcher';
import type { StatementTransaction } from '../types/reconciliation.types';
import type { JournalEntry } from '../types';

describe('transactionMatcher', () => {
  const accountId = 'test-account-123';

  const createStatementTransaction = (
    overrides: Partial<StatementTransaction>
  ): StatementTransaction => ({
    id: 'stmt-' + Math.random(),
    date: Date.now(),
    description: 'Test Transaction',
    amount: 1000,
    matched: false,
    ...overrides,
  });

  const createJournalEntry = (
    overrides: Partial<JournalEntry>
  ): JournalEntry => ({
    id: 'txn-' + Math.random(),
    companyId: 'company-123',
    date: new Date(),
    status: 'posted',
    lines: [
      {
        id: 'line-1',
        accountId,
        debit: 10.0,
        credit: 0,
      },
      {
        id: 'line-2',
        accountId: 'other-account',
        debit: 0,
        credit: 10.0,
      },
    ],
    createdBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('exact matches', () => {
    it('should match transactions with exact date and amount', () => {
      const date = new Date('2024-01-15');

      const statementTxns = [
        createStatementTransaction({
          date: date.getTime(),
          description: 'Coffee Shop',
          amount: 1000, // $10.00 in cents
        }),
      ];

      const systemTxns = [
        createJournalEntry({
          date,
          memo: 'Coffee Shop',
          lines: [
            {
              id: 'line-1',
              accountId,
              debit: 10.0,
              credit: 0,
            },
            {
              id: 'line-2',
              accountId: 'other-account',
              debit: 0,
              credit: 10.0,
            },
          ],
        }),
      ];

      const matches = matchTransactions(statementTxns, systemTxns, accountId);

      expect(matches).toHaveLength(1);
      expect(matches[0]?.confidence).toBe('EXACT');
      expect(matches[0]?.score).toBeGreaterThan(90);
    });

    it('should match even with slightly different descriptions', () => {
      const date = new Date('2024-01-15');

      const statementTxns = [
        createStatementTransaction({
          date: date.getTime(),
          description: 'STARBUCKS #12345 NEW YORK NY',
          amount: 550,
        }),
      ];

      const systemTxns = [
        createJournalEntry({
          date,
          memo: 'Starbucks coffee',
          lines: [
            {
              id: 'line-1',
              accountId,
              debit: 5.5,
              credit: 0,
            },
            {
              id: 'line-2',
              accountId: 'other-account',
              debit: 0,
              credit: 5.5,
            },
          ],
        }),
      ];

      const matches = matchTransactions(statementTxns, systemTxns, accountId);

      expect(matches).toHaveLength(1);
      expect(matches[0]?.confidence).toMatch(/EXACT|HIGH/);
    });
  });

  describe('date tolerance', () => {
    it('should match transactions within date tolerance', () => {
      const baseDate = new Date('2024-01-15');
      const nextDay = new Date('2024-01-16');

      const statementTxns = [
        createStatementTransaction({
          date: baseDate.getTime(),
          description: 'Payment',
          amount: 10000,
        }),
      ];

      const systemTxns = [
        createJournalEntry({
          date: nextDay,
          memo: 'Payment',
          lines: [
            {
              id: 'line-1',
              accountId,
              debit: 100.0,
              credit: 0,
            },
            {
              id: 'line-2',
              accountId: 'other-account',
              debit: 0,
              credit: 100.0,
            },
          ],
        }),
      ];

      const matches = matchTransactions(statementTxns, systemTxns, accountId, {
        dateTolerance: 3,
        amountTolerance: 0.5,
        descriptionSimilarityThreshold: 60,
        minConfidenceScore: 50,
      });

      expect(matches).toHaveLength(1);
      expect(matches[0]?.score).toBeGreaterThan(50);
    });

    it('should not match transactions outside date tolerance', () => {
      const baseDate = new Date('2024-01-15');
      const farDate = new Date('2024-01-25'); // 10 days apart

      const statementTxns = [
        createStatementTransaction({
          date: baseDate.getTime(),
          description: 'Payment',
          amount: 10000,
        }),
      ];

      const systemTxns = [
        createJournalEntry({
          date: farDate,
          memo: 'Payment',
          lines: [
            {
              id: 'line-1',
              accountId,
              debit: 100.0,
              credit: 0,
            },
            {
              id: 'line-2',
              accountId: 'other-account',
              debit: 0,
              credit: 100.0,
            },
          ],
        }),
      ];

      const matches = matchTransactions(statementTxns, systemTxns, accountId, {
        dateTolerance: 3,
        amountTolerance: 0.5,
        descriptionSimilarityThreshold: 60,
        minConfidenceScore: 50,
      });

      expect(matches).toHaveLength(0);
    });
  });

  describe('amount matching', () => {
    it('should match with exact amounts', () => {
      const date = new Date('2024-01-15');

      const statementTxns = [
        createStatementTransaction({
          date: date.getTime(),
          amount: 12345, // $123.45
        }),
      ];

      const systemTxns = [
        createJournalEntry({
          date,
          lines: [
            {
              id: 'line-1',
              accountId,
              debit: 123.45,
              credit: 0,
            },
            {
              id: 'line-2',
              accountId: 'other-account',
              debit: 0,
              credit: 123.45,
            },
          ],
        }),
      ];

      const matches = matchTransactions(statementTxns, systemTxns, accountId);

      expect(matches).toHaveLength(1);
      expect(matches[0]?.confidence).toMatch(/EXACT|HIGH/);
    });

    it('should not match with significantly different amounts', () => {
      const date = new Date('2024-01-15');

      const statementTxns = [
        createStatementTransaction({
          date: date.getTime(),
          amount: 10000, // $100.00
        }),
      ];

      const systemTxns = [
        createJournalEntry({
          date,
          lines: [
            {
              id: 'line-1',
              accountId,
              debit: 50.0, // $50.00 - too different
              credit: 0,
            },
            {
              id: 'line-2',
              accountId: 'other-account',
              debit: 0,
              credit: 50.0,
            },
          ],
        }),
      ];

      const matches = matchTransactions(statementTxns, systemTxns, accountId);

      expect(matches).toHaveLength(0);
    });
  });

  describe('reference number matching', () => {
    it('should boost match score for matching reference numbers', () => {
      const date = new Date('2024-01-15');

      const statementTxns = [
        createStatementTransaction({
          date: date.getTime(),
          amount: 10000,
          reference: 'CHK1234',
        }),
      ];

      const systemTxns = [
        createJournalEntry({
          date,
          reference: 'CHK1234',
          lines: [
            {
              id: 'line-1',
              accountId,
              debit: 100.0,
              credit: 0,
            },
            {
              id: 'line-2',
              accountId: 'other-account',
              debit: 0,
              credit: 100.0,
            },
          ],
        }),
      ];

      const matches = matchTransactions(statementTxns, systemTxns, accountId);

      expect(matches).toHaveLength(1);
      expect(matches[0]?.reasons.some((r) => r.includes('Reference'))).toBe(true);
    });
  });

  describe('multiple transactions', () => {
    it('should match multiple transactions correctly', () => {
      const date = new Date('2024-01-15');

      const statementTxns = [
        createStatementTransaction({
          id: 'stmt-1',
          date: date.getTime(),
          description: 'Coffee Shop',
          amount: 500,
        }),
        createStatementTransaction({
          id: 'stmt-2',
          date: date.getTime(),
          description: 'Gas Station',
          amount: 4500,
        }),
        createStatementTransaction({
          id: 'stmt-3',
          date: date.getTime(),
          description: 'Grocery Store',
          amount: 12000,
        }),
      ];

      const systemTxns = [
        createJournalEntry({
          id: 'txn-1',
          date,
          memo: 'Coffee',
          lines: [
            { id: 'l1', accountId, debit: 5.0, credit: 0 },
            { id: 'l2', accountId: 'other', debit: 0, credit: 5.0 },
          ],
        }),
        createJournalEntry({
          id: 'txn-2',
          date,
          memo: 'Gas',
          lines: [
            { id: 'l1', accountId, debit: 45.0, credit: 0 },
            { id: 'l2', accountId: 'other', debit: 0, credit: 45.0 },
          ],
        }),
        createJournalEntry({
          id: 'txn-3',
          date,
          memo: 'Groceries',
          lines: [
            { id: 'l1', accountId, debit: 120.0, credit: 0 },
            { id: 'l2', accountId: 'other', debit: 0, credit: 120.0 },
          ],
        }),
      ];

      const matches = matchTransactions(statementTxns, systemTxns, accountId);

      expect(matches).toHaveLength(3);
    });

    it('should not match the same system transaction twice', () => {
      const date = new Date('2024-01-15');

      const statementTxns = [
        createStatementTransaction({
          id: 'stmt-1',
          date: date.getTime(),
          amount: 10000,
        }),
        createStatementTransaction({
          id: 'stmt-2',
          date: date.getTime(),
          amount: 10000,
        }),
      ];

      const systemTxns = [
        createJournalEntry({
          id: 'txn-1',
          date,
          lines: [
            { id: 'l1', accountId, debit: 100.0, credit: 0 },
            { id: 'l2', accountId: 'other', debit: 0, credit: 100.0 },
          ],
        }),
      ];

      const matches = matchTransactions(statementTxns, systemTxns, accountId);

      // Should only match one of the statement transactions
      expect(matches).toHaveLength(1);
    });
  });

  describe('getMatchStatistics', () => {
    it('should calculate match statistics correctly', () => {
      const matches = [
        {
          statementTransactionId: '1',
          systemTransactionId: 'a',
          confidence: 'EXACT' as const,
          score: 95,
          reasons: [],
        },
        {
          statementTransactionId: '2',
          systemTransactionId: 'b',
          confidence: 'HIGH' as const,
          score: 85,
          reasons: [],
        },
        {
          statementTransactionId: '3',
          systemTransactionId: 'c',
          confidence: 'MEDIUM' as const,
          score: 70,
          reasons: [],
        },
        {
          statementTransactionId: '4',
          systemTransactionId: 'd',
          confidence: 'LOW' as const,
          score: 55,
          reasons: [],
        },
      ];

      const stats = getMatchStatistics(matches as any);

      expect(stats.total).toBe(4);
      expect(stats.exact).toBe(1);
      expect(stats.high).toBe(1);
      expect(stats.medium).toBe(1);
      expect(stats.low).toBe(1);
      expect(stats.manual).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty statement transactions', () => {
      const systemTxns = [createJournalEntry({})];

      const matches = matchTransactions([], systemTxns, accountId);

      expect(matches).toHaveLength(0);
    });

    it('should handle empty system transactions', () => {
      const statementTxns = [createStatementTransaction({})];

      const matches = matchTransactions(statementTxns, [], accountId);

      expect(matches).toHaveLength(0);
    });

    it('should skip already matched statement transactions', () => {
      const date = new Date('2024-01-15');

      const statementTxns = [
        createStatementTransaction({
          date: date.getTime(),
          amount: 1000,
          matched: true,
        }),
      ];

      const systemTxns = [
        createJournalEntry({
          date,
          lines: [
            { id: 'l1', accountId, debit: 10.0, credit: 0 },
            { id: 'l2', accountId: 'other', debit: 0, credit: 10.0 },
          ],
        }),
      ];

      const matches = matchTransactions(statementTxns, systemTxns, accountId);

      expect(matches).toHaveLength(0);
    });

    it('should skip reconciled system transactions', () => {
      const date = new Date('2024-01-15');

      const statementTxns = [
        createStatementTransaction({
          date: date.getTime(),
          amount: 1000,
        }),
      ];

      const systemTxns = [
        createJournalEntry({
          date,
          status: 'reconciled',
          lines: [
            { id: 'l1', accountId, debit: 10.0, credit: 0 },
            { id: 'l2', accountId: 'other', debit: 0, credit: 10.0 },
          ],
        }),
      ];

      const matches = matchTransactions(statementTxns, systemTxns, accountId);

      expect(matches).toHaveLength(0);
    });
  });
});
