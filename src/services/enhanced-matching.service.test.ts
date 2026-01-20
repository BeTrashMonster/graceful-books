/**
 * Enhanced Matching Service Tests
 *
 * Tests for the E1 enhanced auto-matching algorithm
 */

import { describe, it, expect } from 'vitest';
import { enhancedMatchTransactions } from './enhanced-matching.service';
import { MatchConfidence } from '../types/reconciliation.types';
import type {
  StatementTransaction,
  ReconciliationPattern,
} from '../types/reconciliation.types';
import type { JournalEntry } from '../types';

describe('Enhanced Matching Service', () => {
  describe('enhancedMatchTransactions', () => {
    it('should match transactions with exact date, amount, and description', async () => {
      const statementTxs: StatementTransaction[] = [
        {
          id: 'stmt-1',
          date: new Date('2026-01-10').getTime(),
          description: 'Amazon Purchase',
          amount: -5000, // -$50.00 in cents
          matched: false,
        },
      ];

      const systemTxs: JournalEntry[] = [
        {
          id: 'sys-1',
          date: new Date('2026-01-10').getTime(),
          memo: 'Amazon Purchase',
          reference: 'AMZ-123',
          status: 'POSTED',
          lines: [
            { id: 'line-1', accountId: 'acc-1', debit: 5000, credit: 0 },
            { id: 'line-2', accountId: 'acc-2', debit: 0, credit: 5000 },
          ],
        } as JournalEntry,
      ];

      const result = await enhancedMatchTransactions(statementTxs, systemTxs, {
        usePatternLearning: false,
        enableMultiTransactionMatching: false,
      });

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].confidence).toBe(MatchConfidence.EXACT);
      expect(result.matches[0].statementTransactionId).toBe('stmt-1');
      expect(result.matches[0].systemTransactionId).toBe('sys-1');
      expect(result.accuracy).toBeGreaterThan(99);
    });

    it('should match transactions with fuzzy description matching', async () => {
      const statementTxs: StatementTransaction[] = [
        {
          id: 'stmt-1',
          date: new Date('2026-01-10').getTime(),
          description: 'AMZN MKTPLACE',
          amount: -3500, // -$35.00
          matched: false,
        },
      ];

      const systemTxs: JournalEntry[] = [
        {
          id: 'sys-1',
          date: new Date('2026-01-10').getTime(),
          memo: 'Amazon Marketplace Purchase',
          reference: null,
          status: 'POSTED',
          lines: [
            { id: 'line-1', accountId: 'acc-1', debit: 3500, credit: 0 },
            { id: 'line-2', accountId: 'acc-2', debit: 0, credit: 3500 },
          ],
        } as JournalEntry,
      ];

      const result = await enhancedMatchTransactions(statementTxs, systemTxs);

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].confidence).toBeOneOf([
        MatchConfidence.EXACT,
        MatchConfidence.HIGH,
      ]);
    });

    it('should match transactions with date tolerance', async () => {
      const statementTxs: StatementTransaction[] = [
        {
          id: 'stmt-1',
          date: new Date('2026-01-10').getTime(),
          description: 'Office Supplies',
          amount: -2500, // -$25.00
          matched: false,
        },
      ];

      const systemTxs: JournalEntry[] = [
        {
          id: 'sys-1',
          date: new Date('2026-01-12').getTime(), // 2 days later
          memo: 'Office Supplies',
          reference: null,
          status: 'POSTED',
          lines: [
            { id: 'line-1', accountId: 'acc-1', debit: 2500, credit: 0 },
            { id: 'line-2', accountId: 'acc-2', debit: 0, credit: 2500 },
          ],
        } as JournalEntry,
      ];

      const result = await enhancedMatchTransactions(statementTxs, systemTxs, {
        dateTolerance: 3,
      });

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].confidence).toBeOneOf([
        MatchConfidence.HIGH,
        MatchConfidence.MEDIUM,
      ]);
    });

    it('should not match if amount is different', async () => {
      const statementTxs: StatementTransaction[] = [
        {
          id: 'stmt-1',
          date: new Date('2026-01-10').getTime(),
          description: 'Purchase',
          amount: -5000,
          matched: false,
        },
      ];

      const systemTxs: JournalEntry[] = [
        {
          id: 'sys-1',
          date: new Date('2026-01-10').getTime(),
          memo: 'Purchase',
          reference: null,
          status: 'POSTED',
          lines: [
            { id: 'line-1', accountId: 'acc-1', debit: 7500, credit: 0 }, // Different amount
            { id: 'line-2', accountId: 'acc-2', debit: 0, credit: 7500 },
          ],
        } as JournalEntry,
      ];

      const result = await enhancedMatchTransactions(statementTxs, systemTxs);

      expect(result.matches).toHaveLength(0);
    });

    it('should skip already reconciled transactions', async () => {
      const statementTxs: StatementTransaction[] = [
        {
          id: 'stmt-1',
          date: new Date('2026-01-10').getTime(),
          description: 'Purchase',
          amount: -5000,
          matched: false,
        },
      ];

      const systemTxs: JournalEntry[] = [
        {
          id: 'sys-1',
          date: new Date('2026-01-10').getTime(),
          memo: 'Purchase',
          reference: null,
          status: 'RECONCILED' as any,
          lines: [
            { id: 'line-1', accountId: 'acc-1', debit: 5000, credit: 0 },
            { id: 'line-2', accountId: 'acc-2', debit: 0, credit: 5000 },
          ],
        } as JournalEntry,
      ];

      const result = await enhancedMatchTransactions(statementTxs, systemTxs);

      expect(result.matches).toHaveLength(0);
    });

    it('should apply pattern learning when enabled', async () => {
      const patterns: ReconciliationPattern[] = [
        {
          id: 'pattern-1',
          company_id: 'company-1',
          vendor_name: 'amazon',
          description_patterns: ['amazon', 'amzn'],
          typical_amount_range: { min: 2000, max: 10000 },
          typical_day_of_month: null,
          confidence: 85,
          last_matched_at: Date.now(),
          match_count: 10,
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      ];

      const statementTxs: StatementTransaction[] = [
        {
          id: 'stmt-1',
          date: new Date('2026-01-10').getTime(),
          description: 'AMZN MKTPLACE',
          amount: -5000,
          matched: false,
        },
      ];

      const systemTxs: JournalEntry[] = [
        {
          id: 'sys-1',
          date: new Date('2026-01-11').getTime(),
          memo: 'Amazon online order',
          reference: null,
          status: 'POSTED',
          lines: [
            { id: 'line-1', accountId: 'acc-1', debit: 5000, credit: 0 },
            { id: 'line-2', accountId: 'acc-2', debit: 0, credit: 5000 },
          ],
        } as JournalEntry,
      ];

      const result = await enhancedMatchTransactions(statementTxs, systemTxs, {
        usePatternLearning: true,
        patterns,
      });

      expect(result.matches).toHaveLength(1);
      // Pattern learning should boost confidence (at least MEDIUM or better)
      expect(result.matches[0].confidence).toBeOneOf([
        MatchConfidence.EXACT,
        MatchConfidence.HIGH,
        MatchConfidence.MEDIUM,
      ]);
    });

    it('should calculate accuracy percentage', async () => {
      const statementTxs: StatementTransaction[] = [
        {
          id: 'stmt-1',
          date: new Date('2026-01-10').getTime(),
          description: 'Purchase 1',
          amount: -5000,
          matched: false,
        },
        {
          id: 'stmt-2',
          date: new Date('2026-01-11').getTime(),
          description: 'Purchase 2',
          amount: -3000,
          matched: false,
        },
        {
          id: 'stmt-3',
          date: new Date('2026-01-12').getTime(),
          description: 'Purchase 3',
          amount: -2000,
          matched: false,
        },
      ];

      const systemTxs: JournalEntry[] = [
        {
          id: 'sys-1',
          date: new Date('2026-01-10').getTime(),
          memo: 'Purchase 1',
          reference: null,
          status: 'POSTED',
          lines: [
            { id: 'line-1', accountId: 'acc-1', debit: 5000, credit: 0 },
            { id: 'line-2', accountId: 'acc-2', debit: 0, credit: 5000 },
          ],
        } as JournalEntry,
        {
          id: 'sys-2',
          date: new Date('2026-01-11').getTime(),
          memo: 'Purchase 2',
          reference: null,
          status: 'POSTED',
          lines: [
            { id: 'line-1', accountId: 'acc-1', debit: 3000, credit: 0 },
            { id: 'line-2', accountId: 'acc-2', debit: 0, credit: 3000 },
          ],
        } as JournalEntry,
        // Third transaction not in system - should lower accuracy
      ];

      const result = await enhancedMatchTransactions(statementTxs, systemTxs);

      expect(result.matches).toHaveLength(2);
      // 2 matched out of 3 = 66.67% accuracy
      expect(result.accuracy).toBeCloseTo(66.67, 1);
    });
  });
});

// Helper matcher for vitest
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be one of ${expected.join(', ')}`
          : `expected ${received} to be one of ${expected.join(', ')}`,
    };
  },
});
