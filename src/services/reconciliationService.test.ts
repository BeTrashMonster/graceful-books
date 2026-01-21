/**
 * Reconciliation Service Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createReconciliation,
  applyMatches,
  addManualMatch,
  removeMatch,
  calculateDiscrepancy,
  completeReconciliation,
  getReconciliationSummary,
} from './reconciliationService';
import { MatchConfidence } from '../types/reconciliation.types';
import type { ParsedStatement, TransactionMatch } from '../types/reconciliation.types';
import type { JournalEntry } from '../types';

describe('reconciliationService', () => {
  const mockStatement: ParsedStatement = {
    statementPeriod: {
      startDate: new Date('2024-01-01').getTime(),
      endDate: new Date('2024-01-31').getTime(),
    },
    openingBalance: 100000, // $1000.00
    closingBalance: 105000, // $1050.00
    transactions: [
      {
        id: 'stmt-1',
        date: new Date('2024-01-15').getTime(),
        description: 'Payment',
        amount: 5000,
        matched: false,
      },
    ],
    format: 'csv',
  };

  describe('createReconciliation', () => {
    it('should create a new reconciliation record', () => {
      const reconciliation = createReconciliation({
        companyId: 'company-123',
        accountId: 'account-123',
        statement: mockStatement,
        isFirstReconciliation: true,
      });

      expect(reconciliation.id).toBeDefined();
      expect(reconciliation.company_id).toBe('company-123');
      expect(reconciliation.account_id).toBe('account-123');
      expect(reconciliation.status).toBe('DRAFT');
      expect(reconciliation.is_first_reconciliation).toBe(true);
      expect(reconciliation.opening_balance).toBe(100000);
      expect(reconciliation.closing_balance).toBe(105000);
    });

    it('should initialize with empty matches', () => {
      const reconciliation = createReconciliation({
        companyId: 'company-123',
        accountId: 'account-123',
        statement: mockStatement,
        isFirstReconciliation: false,
      });

      const matchedIds = JSON.parse(reconciliation.matched_transactions);
      const unmatchedStmt = JSON.parse(reconciliation.unmatched_statement_items);

      expect(matchedIds).toEqual([]);
      expect(unmatchedStmt).toHaveLength(1);
      expect(unmatchedStmt[0]).toBe('stmt-1');
    });
  });

  describe('applyMatches', () => {
    it('should apply matches to reconciliation', () => {
      const reconciliation = createReconciliation({
        companyId: 'company-123',
        accountId: 'account-123',
        statement: mockStatement,
        isFirstReconciliation: false,
      });

      const matches: TransactionMatch[] = [
        {
          statementTransactionId: 'stmt-1',
          systemTransactionId: 'txn-1',
          confidence: MatchConfidence.EXACT,
          score: 95,
          reasons: ['Exact match'],
        },
      ];

      const updated = applyMatches(reconciliation, matches);

      const matchedIds = JSON.parse(updated.matched_transactions);
      const unmatchedStmt = JSON.parse(updated.unmatched_statement_items);

      expect(matchedIds).toContain('txn-1');
      expect(unmatchedStmt).not.toContain('stmt-1');

      // Check statement transaction is marked as matched
      const statement = JSON.parse(updated.statement_data);
      const tx = statement.transactions.find((t: any) => t.id === 'stmt-1');
      expect(tx.matched).toBe(true);
      expect(tx.matchedTransactionId).toBe('txn-1');
    });

    it('should handle multiple matches', () => {
      const statementWith3Txns: ParsedStatement = {
        ...mockStatement,
        transactions: [
          { id: 'stmt-1', date: Date.now(), description: 'A', amount: 1000, matched: false },
          { id: 'stmt-2', date: Date.now(), description: 'B', amount: 2000, matched: false },
          { id: 'stmt-3', date: Date.now(), description: 'C', amount: 3000, matched: false },
        ],
      };

      const reconciliation = createReconciliation({
        companyId: 'company-123',
        accountId: 'account-123',
        statement: statementWith3Txns,
        isFirstReconciliation: false,
      });

      const matches: TransactionMatch[] = [
        {
          statementTransactionId: 'stmt-1',
          systemTransactionId: 'txn-1',
          confidence: MatchConfidence.EXACT,
          score: 95,
          reasons: [],
        },
        {
          statementTransactionId: 'stmt-2',
          systemTransactionId: 'txn-2',
          confidence: MatchConfidence.HIGH,
          score: 85,
          reasons: [],
        },
      ];

      const updated = applyMatches(reconciliation, matches);

      const matchedIds = JSON.parse(updated.matched_transactions);
      const unmatchedStmt = JSON.parse(updated.unmatched_statement_items);

      expect(matchedIds).toHaveLength(2);
      expect(unmatchedStmt).toHaveLength(1);
      expect(unmatchedStmt).toContain('stmt-3');
    });
  });

  describe('addManualMatch', () => {
    it('should add a manual match', () => {
      const reconciliation = createReconciliation({
        companyId: 'company-123',
        accountId: 'account-123',
        statement: mockStatement,
        isFirstReconciliation: false,
      });

      const updated = addManualMatch(reconciliation, 'stmt-1', 'txn-manual');

      const matchedIds = JSON.parse(updated.matched_transactions);
      const statement = JSON.parse(updated.statement_data);
      const tx = statement.transactions.find((t: any) => t.id === 'stmt-1');

      expect(matchedIds).toContain('txn-manual');
      expect(tx.matched).toBe(true);
      expect(tx.matchedTransactionId).toBe('txn-manual');
    });

    it('should throw error for already matched transaction', () => {
      const reconciliation = createReconciliation({
        companyId: 'company-123',
        accountId: 'account-123',
        statement: mockStatement,
        isFirstReconciliation: false,
      });

      const withMatch = addManualMatch(reconciliation, 'stmt-1', 'txn-1');

      expect(() => {
        addManualMatch(withMatch, 'stmt-1', 'txn-2');
      }).toThrow();
    });

    it('should throw error for non-existent statement transaction', () => {
      const reconciliation = createReconciliation({
        companyId: 'company-123',
        accountId: 'account-123',
        statement: mockStatement,
        isFirstReconciliation: false,
      });

      expect(() => {
        addManualMatch(reconciliation, 'non-existent', 'txn-1');
      }).toThrow();
    });
  });

  describe('removeMatch', () => {
    it('should remove a match', () => {
      const reconciliation = createReconciliation({
        companyId: 'company-123',
        accountId: 'account-123',
        statement: mockStatement,
        isFirstReconciliation: false,
      });

      const withMatch = addManualMatch(reconciliation, 'stmt-1', 'txn-1');
      const removed = removeMatch(withMatch, 'stmt-1');

      const matchedIds = JSON.parse(removed.matched_transactions);
      const unmatchedStmt = JSON.parse(removed.unmatched_statement_items);
      const statement = JSON.parse(removed.statement_data);
      const tx = statement.transactions.find((t: any) => t.id === 'stmt-1');

      expect(matchedIds).not.toContain('txn-1');
      expect(unmatchedStmt).toContain('stmt-1');
      expect(tx.matched).toBe(false);
    });

    it('should throw error when removing non-existent match', () => {
      const reconciliation = createReconciliation({
        companyId: 'company-123',
        accountId: 'account-123',
        statement: mockStatement,
        isFirstReconciliation: false,
      });

      expect(() => {
        removeMatch(reconciliation, 'stmt-1');
      }).toThrow();
    });
  });

  describe('calculateDiscrepancy', () => {
    it('should calculate zero discrepancy for balanced reconciliation', () => {
      const reconciliation = createReconciliation({
        companyId: 'company-123',
        accountId: 'account-123',
        statement: mockStatement,
        isFirstReconciliation: false,
      });

      const withMatch = addManualMatch(reconciliation, 'stmt-1', 'txn-1');

      const systemTransactions: JournalEntry[] = [
        {
          id: 'txn-1',
          companyId: 'company-123',
          date: new Date('2024-01-15'),
          status: 'posted',
          lines: [
            {
              id: 'line-1',
              accountId: 'account-123',
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
        },
      ];

      const discrepancy = calculateDiscrepancy(
        withMatch,
        systemTransactions,
        'account-123'
      );

      expect(discrepancy).toBe(0);
    });
  });

  describe('completeReconciliation', () => {
    it('should mark reconciliation as completed', () => {
      const reconciliation = createReconciliation({
        companyId: 'company-123',
        accountId: 'account-123',
        statement: mockStatement,
        isFirstReconciliation: true,
      });

      const completed = completeReconciliation(reconciliation, 'All matched!');

      expect(completed.status).toBe('COMPLETED');
      expect(completed.completed_at).toBeDefined();
      expect(completed.notes).toBe('All matched!');
    });

    it('should throw error when completing already completed reconciliation', () => {
      const reconciliation = createReconciliation({
        companyId: 'company-123',
        accountId: 'account-123',
        statement: mockStatement,
        isFirstReconciliation: false,
      });

      const completed = completeReconciliation(reconciliation);

      expect(() => {
        completeReconciliation(completed);
      }).toThrow();
    });
  });

  describe('getReconciliationSummary', () => {
    it('should calculate summary statistics', () => {
      const statementWith3Txns: ParsedStatement = {
        ...mockStatement,
        transactions: [
          { id: 'stmt-1', date: Date.now(), description: 'A', amount: 1000, matched: false },
          { id: 'stmt-2', date: Date.now(), description: 'B', amount: 2000, matched: false },
          { id: 'stmt-3', date: Date.now(), description: 'C', amount: 3000, matched: false },
        ],
      };

      const reconciliation = createReconciliation({
        companyId: 'company-123',
        accountId: 'account-123',
        statement: statementWith3Txns,
        isFirstReconciliation: false,
      });

      const matches: TransactionMatch[] = [
        {
          statementTransactionId: 'stmt-1',
          systemTransactionId: 'txn-1',
          confidence: MatchConfidence.EXACT,
          score: 95,
          reasons: [],
        },
        {
          statementTransactionId: 'stmt-2',
          systemTransactionId: 'txn-2',
          confidence: MatchConfidence.HIGH,
          score: 85,
          reasons: [],
        },
      ];

      const withMatches = applyMatches(reconciliation, matches);
      const summary = getReconciliationSummary(withMatches);

      expect(summary.totalStatementTransactions).toBe(3);
      expect(summary.matchedCount).toBe(2);
      expect(summary.unmatchedStatementCount).toBe(1);
      expect(summary.matchRate).toBe(67); // 2/3 * 100 = 66.67, rounded to 67
    });

    it('should identify balanced reconciliation', () => {
      const reconciliation = createReconciliation({
        companyId: 'company-123',
        accountId: 'account-123',
        statement: mockStatement,
        isFirstReconciliation: false,
      });

      const summary = getReconciliationSummary({
        ...reconciliation,
        discrepancy: 0,
      });

      expect(summary.isBalanced).toBe(true);
    });

    it('should identify unbalanced reconciliation', () => {
      const reconciliation = createReconciliation({
        companyId: 'company-123',
        accountId: 'account-123',
        statement: mockStatement,
        isFirstReconciliation: false,
      });

      const summary = getReconciliationSummary({
        ...reconciliation,
        discrepancy: 100, // $1.00 discrepancy
      });

      expect(summary.isBalanced).toBe(false);
    });
  });
});
