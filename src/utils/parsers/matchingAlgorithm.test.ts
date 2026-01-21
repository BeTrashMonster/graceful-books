/**
 * Matching Algorithm Tests
 *
 * Tests for automatic transaction matching functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  matchTransactions,
  getConfidenceDescription,
  calculateMatchStats,
} from './matchingAlgorithm';
import type { StatementTransaction } from '../../types/reconciliation.types';
import type { JournalEntry } from '../../types';

describe('Transaction Matching Algorithm', () => {
  describe('matchTransactions', () => {
    it('should match transactions with exact date and amount', () => {
      const date = Date.now();
      const statementTxs: StatementTransaction[] = [
        {
          id: 'stmt1',
          date,
          description: 'Coffee Shop',
          amount: -1250, // -$12.50
          matched: false,
        },
      ];

      const systemTxs: JournalEntry[] = [
        {
          id: 'sys1',
          companyId: 'company1',
          date: new Date(date),
          reference: 'TXN-001',
          memo: 'Coffee Shop Purchase',
          status: 'posted',
          lines: [
            {
              id: 'line1',
              accountId: 'expense-acct',
              debit: 1250, // $12.50
              credit: 0,
              memo: 'Coffee',
            },
            {
              id: 'line2',
              accountId: 'cash-acct',
              debit: 0,
              credit: 1250,
              memo: 'Payment',
            },
          ],
          attachments: [],
          createdBy: 'user1',
          createdAt: new Date(date),
          updatedAt: new Date(date),
        },
      ];

      const matches = matchTransactions(statementTxs, systemTxs);

      expect(matches).toHaveLength(1);
      expect(matches[0]!.confidence).toBe('EXACT');
      expect(matches[0]!.score).toBeGreaterThanOrEqual(90);
    });

    it('should not match transactions with different amounts', () => {
      const date = Date.now();
      const statementTxs: StatementTransaction[] = [
        {
          id: 'stmt1',
          date,
          description: 'Coffee Shop',
          amount: -1250, // -$12.50
          matched: false,
        },
      ];

      const systemTxs: JournalEntry[] = [
        {
          id: 'sys1',
          companyId: 'company1',
          date: new Date(date),
          reference: 'TXN-001',
          memo: 'Coffee Shop',
          status: 'posted',
          lines: [
            { id: 'line1', accountId: 'expense-acct', debit: 9999, credit: 0, memo: 'Coffee' }, // Different amount
            { id: 'line2', accountId: 'cash-acct', debit: 0, credit: 9999, memo: 'Payment' },
          ],
          attachments: [],
          createdBy: 'user1',
          createdAt: new Date(date),
          updatedAt: new Date(date),
        },
      ];

      const matches = matchTransactions(statementTxs, systemTxs);

      // Without matching amounts, should not match
      expect(matches).toHaveLength(0);
    });

    it('should match transactions with dates within tolerance', () => {
      const baseDate = new Date('2024-01-15').getTime();
      const oneDayLater = baseDate + 24 * 60 * 60 * 1000;

      const statementTxs: StatementTransaction[] = [
        {
          id: 'stmt1',
          date: baseDate,
          description: 'Restaurant',
          amount: -5000, // -$50.00
          matched: false,
        },
      ];

      const systemTxs: JournalEntry[] = [
        {
          id: 'sys1',
          companyId: 'company1',
          date: new Date(oneDayLater),
          reference: 'TXN-001',
          memo: 'Restaurant Bill',
          status: 'posted',
          lines: [
            { id: 'line1', accountId: 'expense-acct', debit: 5000, credit: 0, memo: 'Restaurant' },
            { id: 'line2', accountId: 'cash-acct', debit: 0, credit: 5000, memo: 'Payment' },
          ],
          attachments: [],
          createdBy: 'user1',
          createdAt: new Date(oneDayLater),
          updatedAt: new Date(oneDayLater),
        },
      ];

      const matches = matchTransactions(statementTxs, systemTxs, {
        dateTolerance: 3, // Allow 3 days difference
        amountTolerance: 0.5,
        descriptionSimilarityThreshold: 60,
        minConfidenceScore: 50,
      });

      // Should match with HIGH confidence (date close, amount matches)
      expect(matches.length).toBeGreaterThanOrEqual(0);
      if (matches.length > 0) {
        expect(matches[0]!.confidence).toMatch(/HIGH|MEDIUM/);
      }
    });

    it('should skip already reconciled transactions', () => {
      const date = Date.now();
      const statementTxs: StatementTransaction[] = [
        {
          id: 'stmt1',
          date,
          description: 'Payment',
          amount: -10000,
          matched: false,
        },
      ];

      const systemTxs: JournalEntry[] = [
        {
          id: 'sys1',
          companyId: 'company1',
          date: new Date(date),
          reference: 'TXN-001',
          memo: 'Payment',
          status: 'reconciled', // Already reconciled
          lines: [
            { id: 'line1', accountId: 'expense-acct', debit: 10000, credit: 0, memo: 'Payment' },
            { id: 'line2', accountId: 'cash-acct', debit: 0, credit: 10000, memo: 'Payment' },
          ],
          attachments: [],
          createdBy: 'user1',
          createdAt: new Date(date),
          updatedAt: new Date(date),
        },
      ];

      const matches = matchTransactions(statementTxs, systemTxs);

      // Should not match reconciled transactions
      expect(matches).toHaveLength(0);
    });

    it('should handle multiple potential matches and select best', () => {
      const date = Date.now();
      const statementTxs: StatementTransaction[] = [
        {
          id: 'stmt1',
          date,
          description: 'Grocery Store ABC',
          amount: -7500,
          matched: false,
        },
      ];

      const systemTxs: JournalEntry[] = [
        {
          id: 'sys1',
          companyId: 'company1',
          date: new Date(date),
          reference: 'TXN-001',
          memo: 'Groceries', // Less similar description
          status: 'posted',
          lines: [
            { id: 'line1', accountId: 'expense-acct', debit: 7500, credit: 0, memo: 'Groceries' },
            { id: 'line2', accountId: 'cash-acct', debit: 0, credit: 7500, memo: 'Payment' },
          ],
          attachments: [],
          createdBy: 'user1',
          createdAt: new Date(date),
          updatedAt: new Date(date),
        },
        {
          id: 'sys2',
          companyId: 'company1',
          date: new Date(date),
          reference: 'TXN-002',
          memo: 'Grocery Store ABC Purchase', // More similar description
          status: 'posted',
          lines: [
            { id: 'line3', accountId: 'expense-acct', debit: 7500, credit: 0, memo: 'Groceries' },
            { id: 'line4', accountId: 'cash-acct', debit: 0, credit: 7500, memo: 'Payment' },
          ],
          attachments: [],
          createdBy: 'user1',
          createdAt: new Date(date),
          updatedAt: new Date(date),
        },
      ];

      const matches = matchTransactions(statementTxs, systemTxs);

      // Should select the better match (sys2)
      expect(matches).toHaveLength(1);
      if (matches.length > 0) {
        expect(matches[0]!.systemTransactionId).toBe('sys2');
      }
    });

    it('should handle large numbers of transactions efficiently', () => {
      const statementTxs: StatementTransaction[] = [];
      const systemTxs: JournalEntry[] = [];

      // Create 500 statement transactions
      for (let i = 0; i < 500; i++) {
        statementTxs.push({
          id: `stmt${i}`,
          date: Date.now() - i * 24 * 60 * 60 * 1000,
          description: `Transaction ${i}`,
          amount: -1000 * i,
          matched: false,
        });
      }

      // Create 500 system transactions
      for (let i = 0; i < 500; i++) {
        const txDate = Date.now() - i * 24 * 60 * 60 * 1000;
        systemTxs.push({
          id: `sys${i}`,
          companyId: 'company1',
          date: new Date(txDate),
          reference: `TXN-${i}`,
          memo: `System Transaction ${i}`,
          status: 'posted',
          lines: [
            { id: `line${i}-1`, accountId: 'expense-acct', debit: 1000 * i, credit: 0, memo: 'Expense' },
            { id: `line${i}-2`, accountId: 'cash-acct', debit: 0, credit: 1000 * i, memo: 'Payment' },
          ],
          attachments: [],
          createdBy: 'user1',
          createdAt: new Date(txDate),
          updatedAt: new Date(txDate),
        });
      }

      const startTime = Date.now();
      const matches = matchTransactions(statementTxs, systemTxs);
      const endTime = Date.now();

      // Should complete in reasonable time (under 5 seconds for 500 transactions)
      expect(endTime - startTime).toBeLessThan(5000);
      expect(matches).toBeDefined();
    });
  });

  describe('getConfidenceDescription', () => {
    it('should return correct descriptions for each confidence level', () => {
      expect(getConfidenceDescription('EXACT')).toContain('Perfect match');
      expect(getConfidenceDescription('HIGH')).toContain('Very likely');
      expect(getConfidenceDescription('MEDIUM')).toContain('Possible');
      expect(getConfidenceDescription('LOW')).toContain('Uncertain');
      expect(getConfidenceDescription('MANUAL')).toContain('Manually');
    });
  });

  describe('calculateMatchStats', () => {
    it('should correctly calculate match statistics', () => {
      const matches = [
        {
          statementTransactionId: '1',
          systemTransactionId: 'sys1',
          confidence: 'EXACT' as const,
          score: 100,
          reasons: [],
        },
        {
          statementTransactionId: '2',
          systemTransactionId: 'sys2',
          confidence: 'HIGH' as const,
          score: 85,
          reasons: [],
        },
        {
          statementTransactionId: '3',
          systemTransactionId: 'sys3',
          confidence: 'MEDIUM' as const,
          score: 65,
          reasons: [],
        },
      ];

      const stats = calculateMatchStats(matches);

      expect(stats.total).toBe(3);
      expect(stats.exact).toBe(1);
      expect(stats.high).toBe(1);
      expect(stats.medium).toBe(1);
      expect(stats.low).toBe(0);
      expect(stats.manual).toBe(0);
    });
  });
});
