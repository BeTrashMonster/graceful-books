/**
 * End-to-End Integration Tests for Complete Reconciliation Workflow
 *
 * Comprehensive E2E tests covering:
 * - Complete reconciliation workflow from statement upload to completion
 * - Auto-matching with enhanced-matching service
 * - Manual matching interface workflow
 * - Pattern learning over multiple reconciliations
 * - Streak tracking across multiple months
 * - Unreconciled transaction flagging
 * - Discrepancy resolution workflow
 * - Reconciliation history retrieval
 * - Performance targets: <5 seconds for 500 transactions
 * - Accuracy target: >85% auto-match rate after 3 reconciliations
 *
 * These tests verify the complete user journey through reconciliation features
 * and ensure all components work together correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../store/database';
import { nanoid } from 'nanoid';

// Services
import {
  createReconciliation,
  applyMatches,
  completeReconciliation,
  calculateDiscrepancy,
  getReconciliationSummary,
  addManualMatch,
  removeMatch,
} from '../../services/reconciliationService';
import { parseCSVStatement } from '../../services/statementParser';
import { enhancedMatchTransactions } from '../../services/enhanced-matching.service';
import {
  learnFromMatch,
  saveReconciliationRecord,
  getAccountReconciliationHistory,
  getReconciliationStreak,
  getUnreconciledTransactions,
  getUnreconciledDashboard,
  suggestDiscrepancyResolutions,
  getPatterns,
} from '../../services/reconciliationHistory.service';

// Store functions
import { createAccount } from '../../store/accounts';
import { createTransaction } from '../../store/transactions';

// Types
import type { JournalEntry, Account } from '../../types';

/**
 * Test utilities
 */

const generateTestCompanyId = () => `test-company-${nanoid(10)}`;
const generateTestUserId = () => `test-user-${nanoid(10)}`;

async function clearDatabase() {
  await db.clearAllData();
}

/**
 * Create a test bank account
 */
async function createTestBankAccount(companyId: string): Promise<Account> {
  const result = await createAccount({
    companyId,
    name: 'Business Checking',
    accountNumber: '1000',
    type: 'asset',
    description: 'Main business checking account',
    isActive: true,
  });

  if (!result.success) {
    throw new Error(`Failed to create bank account: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Create test transaction
 */
async function createTestTransaction(
  companyId: string,
  accountId: string,
  amount: number,
  date: Date,
  description: string,
  userId: string = 'test-user'
): Promise<JournalEntry> {
  const transaction: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> = {
    companyId,
    date,
    memo: description,
    status: 'posted',
    createdBy: userId,
    lines: [
      {
        id: nanoid(),
        accountId: accountId,
        debit: amount > 0 ? amount : 0,
        credit: amount < 0 ? Math.abs(amount) : 0,
        memo: '',
      },
      {
        id: nanoid(),
        accountId: accountId, // Simplified - would normally be different account
        debit: amount < 0 ? Math.abs(amount) : 0,
        credit: amount > 0 ? amount : 0,
        memo: '',
      },
    ],
  };

  const result = await createTransaction(transaction);
  if (!result.success) {
    throw new Error(`Failed to create transaction: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Generate realistic bank statement CSV
 */
function generateBankStatementCSV(transactions: Array<{
  date: string;
  description: string;
  amount: number;
}>): string {
  const header = 'Date,Description,Amount';
  const rows = transactions.map(tx =>
    `${tx.date},${tx.description},${tx.amount.toFixed(2)}`
  );
  return [header, ...rows].join('\n');
}

/**
 * Create multiple transactions for a month
 */
async function createMonthOfTransactions(
  companyId: string,
  accountId: string,
  year: number,
  month: number,
  userId: string
): Promise<JournalEntry[]> {
  const transactions: JournalEntry[] = [];

  // Create realistic monthly transactions
  const txnData = [
    { day: 1, amount: 5000, desc: 'Payment from Acme Corp' },
    { day: 3, amount: -150, desc: 'Office Supplies Inc purchase' },
    { day: 5, amount: 3200, desc: 'Widget Co invoice payment' },
    { day: 7, amount: -500, desc: 'Cloud Services monthly fee' },
    { day: 10, amount: 2800, desc: 'Consulting Services LLC' },
    { day: 12, amount: -1200, desc: 'Rent payment' },
    { day: 15, amount: 4500, desc: 'Software license sale' },
    { day: 17, amount: -75, desc: 'Office Supplies Inc purchase' },
    { day: 20, amount: 3100, desc: 'Payment from Beta LLC' },
    { day: 22, amount: -25, desc: 'Bank service fee' },
    { day: 25, amount: 2500, desc: 'Acme Corp monthly retainer' },
    { day: 28, amount: -300, desc: 'Utilities payment' },
  ];

  for (const tx of txnData) {
    const txn = await createTestTransaction(
      companyId,
      accountId,
      tx.amount,
      new Date(year, month - 1, tx.day),
      tx.desc,
      userId
    );
    transactions.push(txn);
  }

  return transactions;
}

/**
 * Generate matching statement transactions from system transactions
 */
function generateMatchingStatement(
  transactions: JournalEntry[],
  accountId: string
): Array<{ date: string; description: string; amount: number }> {
  return transactions.map(tx => {
    const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
    const line = tx.lines.find(l => l.accountId === accountId);
    const amount = line ? (line.debit - line.credit) / 100 : 0; // Convert from cents to dollars

    return {
      date: txDate.toISOString().split('T')[0] ?? '',
      description: tx.memo || 'Transaction',
      amount: amount,
    };
  });
}

/**
 * E2E Test Suite
 */
describe('Reconciliation E2E Integration Tests', () => {
  let testCompanyId: string;
  let testUserId: string;
  let bankAccount: Account;

  beforeEach(async () => {
    await clearDatabase();
    testCompanyId = generateTestCompanyId();
    testUserId = generateTestUserId();

    // Create bank account
    bankAccount = await createTestBankAccount(testCompanyId);

    // Mock navigator.storage
    if (typeof navigator !== 'undefined' && !navigator.storage) {
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: async () => ({ usage: 0, quota: 1000000 }),
        },
        configurable: true,
      });
    }
  });

  afterEach(async () => {
    await clearDatabase();
  });

  /**
   * Test 1: Complete Reconciliation Workflow
   * Tests the entire process from statement upload to completion
   */
  describe('Complete Reconciliation Workflow', () => {
    it('should complete full reconciliation from upload to completion', async () => {
      // STEP 1: Create system transactions
      const transactions = await createMonthOfTransactions(
        testCompanyId,
        bankAccount.id,
        2024,
        1,
        testUserId
      );

      expect(transactions.length).toBe(12);

      // STEP 2: Generate and parse bank statement
      const statementData = generateMatchingStatement(transactions, bankAccount.id);
      const csvContent = generateBankStatementCSV(statementData);

      let statement = await parseCSVStatement(csvContent);

      expect(statement).toBeDefined();
      expect(statement.transactions.length).toBe(12);

      // Set opening/closing balances
      statement = {
        ...statement,
        openingBalance: 0,
        closingBalance: 1967500, // $19,675.00 in cents (sum of all transactions)
      };

      // STEP 3: Create reconciliation session
      const reconciliation = createReconciliation({
        companyId: testCompanyId,
        accountId: bankAccount.id,
        statement,
        isFirstReconciliation: true,
      });

      expect(reconciliation).toBeDefined();
      expect(reconciliation.status).toBe('DRAFT');
      expect(reconciliation.is_first_reconciliation).toBe(true);

      // STEP 4: Auto-match with enhanced matching
      const matchResult = await enhancedMatchTransactions(
        statement.transactions,
        transactions,
        {
          dateTolerance: 3,
          amountTolerance: 0.5,
          descriptionSimilarityThreshold: 60,
          minConfidenceScore: 50,
          usePatternLearning: false, // First reconciliation - no patterns yet
          patterns: [],
          enableMultiTransactionMatching: true,
        }
      );

      expect(matchResult.matches.length).toBeGreaterThan(0);

      // STEP 5: Apply matches
      const reconWithMatches = applyMatches(reconciliation, matchResult.matches);

      expect(reconWithMatches.matched_transactions).toBeDefined();
      const matchedIds = JSON.parse(reconWithMatches.matched_transactions);
      expect(matchedIds.length).toBeGreaterThan(0);

      // STEP 6: Calculate discrepancy
      const discrepancy = calculateDiscrepancy(
        reconWithMatches,
        transactions,
        bankAccount.id
      );

      expect(Math.abs(discrepancy)).toBeLessThan(100); // Should be balanced

      // STEP 7: Get summary
      const summary = getReconciliationSummary(reconWithMatches);

      expect(summary.totalStatementTransactions).toBe(12);
      expect(summary.matchedCount).toBeGreaterThan(0);
      expect(summary.matchRate).toBeGreaterThan(0);

      // STEP 8: Complete reconciliation
      const completed = completeReconciliation(
        reconWithMatches,
        'First reconciliation completed successfully'
      );

      expect(completed.status).toBe('COMPLETED');
      expect(completed.completed_at).toBeDefined();
      expect(completed.notes).toBe('First reconciliation completed successfully');

      // STEP 9: Save to history
      const saveResult = await saveReconciliationRecord(
        {
          company_id: testCompanyId,
          account_id: bankAccount.id,
          reconciliation_date: Date.now(),
          statement_period: {
            start: statement.statementPeriod.startDate,
            end: statement.statementPeriod.endDate,
          },
          beginning_balance: statement.openingBalance || 0,
          ending_balance: statement.closingBalance || 0,
          calculated_balance: statement.closingBalance || 0,
          discrepancy: discrepancy,
          status: 'balanced',
          matched_transactions: matchedIds,
          unmatched_statement_lines: [],
          unmatched_book_transactions: [],
          notes: 'First reconciliation',
          time_spent_seconds: 120,
          user_id: testUserId,
          reopened_at: null,
          reopened_by: null,
          reopened_reason: null,
          deleted_at: null,
        },
        testUserId
      );

      expect(saveResult.success).toBe(true);
    }, 10000); // 10 second timeout

    it('should handle manual matching for unmatched transactions', async () => {
      // Create system transactions
      const transactions = await createMonthOfTransactions(
        testCompanyId,
        bankAccount.id,
        2024,
        1,
        testUserId
      );

      // Generate statement but modify some descriptions to prevent auto-match
      const statementData = generateMatchingStatement(transactions, bankAccount.id);
      if (statementData[0]) {
        statementData[0].description = 'Unknown Vendor XYZ'; // Won't auto-match
      }

      const csvContent = generateBankStatementCSV(statementData);
      let statement = await parseCSVStatement(csvContent);

      statement = {
        ...statement,
        openingBalance: 0,
        closingBalance: 1967500,
      };

      // Create reconciliation
      const reconciliation = createReconciliation({
        companyId: testCompanyId,
        accountId: bankAccount.id,
        statement,
        isFirstReconciliation: true,
      });

      // Auto-match (will miss the modified one)
      const matchResult = await enhancedMatchTransactions(
        statement.transactions,
        transactions,
        { usePatternLearning: false, patterns: [] }
      );

      let reconWithMatches = applyMatches(reconciliation, matchResult.matches);

      // Get unmatched items
      const summaryBefore = getReconciliationSummary(reconWithMatches);
      expect(summaryBefore.unmatchedStatementCount).toBeGreaterThan(0);

      // Manual match the first unmatched statement transaction
      const unmatchedStmtIds = JSON.parse(reconWithMatches.unmatched_statement_items);
      const firstUnmatchedStmt = statement.transactions.find(
        tx => tx.id === unmatchedStmtIds[0]
      );

      expect(firstUnmatchedStmt).toBeDefined();

      // Find corresponding system transaction
      const matchedIds = JSON.parse(reconWithMatches.matched_transactions);
      const unmatchedSysTx = transactions.find(tx => !matchedIds.includes(tx.id));

      expect(unmatchedSysTx).toBeDefined();

      // Add manual match
      reconWithMatches = addManualMatch(
        reconWithMatches,
        firstUnmatchedStmt!.id,
        unmatchedSysTx!.id
      );

      // Verify manual match was applied
      const summaryAfter = getReconciliationSummary(reconWithMatches);
      expect(summaryAfter.unmatchedStatementCount).toBe(summaryBefore.unmatchedStatementCount - 1);
      expect(summaryAfter.matchedCount).toBe(summaryBefore.matchedCount + 1);

      // Complete reconciliation
      const completed = completeReconciliation(reconWithMatches);
      expect(completed.status).toBe('COMPLETED');
    }, 10000);

    it('should allow removing and re-matching transactions', async () => {
      const transactions = await createMonthOfTransactions(
        testCompanyId,
        bankAccount.id,
        2024,
        1,
        testUserId
      );

      const statementData = generateMatchingStatement(transactions, bankAccount.id);
      const csvContent = generateBankStatementCSV(statementData);
      let statement = await parseCSVStatement(csvContent);

      statement = { ...statement, openingBalance: 0, closingBalance: 1967500 };

      const reconciliation = createReconciliation({
        companyId: testCompanyId,
        accountId: bankAccount.id,
        statement,
        isFirstReconciliation: true,
      });

      const matchResult = await enhancedMatchTransactions(
        statement.transactions,
        transactions,
        { usePatternLearning: false, patterns: [] }
      );

      let reconWithMatches = applyMatches(reconciliation, matchResult.matches);
      const initialSummary = getReconciliationSummary(reconWithMatches);

      // Remove first match
      const firstMatchedStmt = statement.transactions.find(tx => tx.matched);
      expect(firstMatchedStmt).toBeDefined();

      reconWithMatches = removeMatch(reconWithMatches, firstMatchedStmt!.id);

      // Verify removal
      const afterRemovalSummary = getReconciliationSummary(reconWithMatches);
      expect(afterRemovalSummary.matchedCount).toBe(initialSummary.matchedCount - 1);
      expect(afterRemovalSummary.unmatchedStatementCount).toBe(
        initialSummary.unmatchedStatementCount + 1
      );

      // Re-match with different transaction
      const unmatchedIds = JSON.parse(reconWithMatches.matched_transactions);
      const differentSysTx = transactions.find(tx => !unmatchedIds.includes(tx.id));

      if (differentSysTx) {
        reconWithMatches = addManualMatch(
          reconWithMatches,
          firstMatchedStmt!.id,
          differentSysTx.id
        );

        const finalSummary = getReconciliationSummary(reconWithMatches);
        expect(finalSummary.matchedCount).toBe(initialSummary.matchedCount);
      }
    });
  });

  /**
   * Test 2: Pattern Learning Over Multiple Reconciliations
   * Tests that accuracy improves with each reconciliation
   */
  describe('Pattern Learning and Accuracy Improvement', () => {
    it('should achieve >85% auto-match rate after 3 reconciliations', async () => {
      const accuracyResults: number[] = [];

      // Perform 3 monthly reconciliations
      for (let month = 1; month <= 3; month++) {
        // Create system transactions for this month
        const transactions = await createMonthOfTransactions(
          testCompanyId,
          bankAccount.id,
          2024,
          month,
          testUserId
        );

        // Generate matching statement
        const statementData = generateMatchingStatement(transactions, bankAccount.id);
        const csvContent = generateBankStatementCSV(statementData);
        let statement = await parseCSVStatement(csvContent);

        statement = { ...statement, openingBalance: 0, closingBalance: 1967500 };

        // Create reconciliation
        const reconciliation = createReconciliation({
          companyId: testCompanyId,
          accountId: bankAccount.id,
          statement,
          isFirstReconciliation: month === 1,
        });

        // Get learned patterns from previous reconciliations
        const patternsResult = await getPatterns(testCompanyId);
        const patterns = patternsResult.success ? patternsResult.data : [];

        // Auto-match with pattern learning
        const matchResult = await enhancedMatchTransactions(
          statement.transactions,
          transactions,
          {
            usePatternLearning: month > 1, // Use patterns from 2nd reconciliation onwards
            patterns: patterns,
            enableMultiTransactionMatching: true,
          }
        );

        accuracyResults.push(matchResult.accuracy);

        // Apply matches
        const reconWithMatches = applyMatches(reconciliation, matchResult.matches);

        // Learn from successful matches for next time
        const matchedIds = JSON.parse(reconWithMatches.matched_transactions);
        for (const match of matchResult.matches) {
          const statementTx = statement.transactions.find(
            tx => tx.id === match.statementTransactionId
          );
          const systemTx = transactions.find(tx => tx.id === match.systemTransactionId);

          if (statementTx && systemTx) {
            await learnFromMatch(
              testCompanyId,
              statementTx,
              systemTx,
              true,
              testUserId
            );
          }
        }

        // Complete and save
        completeReconciliation(reconWithMatches);

        await saveReconciliationRecord(
          {
            company_id: testCompanyId,
            account_id: bankAccount.id,
            reconciliation_date: Date.now(),
            statement_period: {
              start: statement.statementPeriod.startDate,
              end: statement.statementPeriod.endDate,
            },
            beginning_balance: statement.openingBalance || 0,
            ending_balance: statement.closingBalance || 0,
            calculated_balance: statement.closingBalance || 0,
            discrepancy: 0,
            status: 'balanced',
            matched_transactions: matchedIds,
            unmatched_statement_lines: [],
            unmatched_book_transactions: [],
            notes: `Month ${month} reconciliation`,
            time_spent_seconds: 120,
            user_id: testUserId,
            reopened_at: null,
            reopened_by: null,
            reopened_reason: null,
            deleted_at: null,
          },
          testUserId
        );
      }

      // Verify accuracy improvement
      expect(accuracyResults.length).toBe(3);

      // First reconciliation should have reasonable accuracy
      expect(accuracyResults[0]).toBeGreaterThan(70);

      // Accuracy should improve or stay high
      expect(accuracyResults[2]).toBeGreaterThanOrEqual(accuracyResults[0] ?? 0);

      // By 3rd reconciliation, should meet target
      expect(accuracyResults[2]).toBeGreaterThan(85);
    }, 30000); // 30 second timeout for 3 reconciliations
  });

  /**
   * Test 3: Streak Tracking Across Multiple Months
   */
  describe('Reconciliation Streak Tracking', () => {
    it('should track streaks and award milestones', async () => {
      // Perform reconciliations for 4 consecutive months
      for (let month = 1; month <= 4; month++) {
        const transactions = await createMonthOfTransactions(
          testCompanyId,
          bankAccount.id,
          2024,
          month,
          testUserId
        );

        const statementData = generateMatchingStatement(transactions, bankAccount.id);
        const csvContent = generateBankStatementCSV(statementData);
        let statement = await parseCSVStatement(csvContent);

        statement = { ...statement, openingBalance: 0, closingBalance: 1967500 };

        const reconciliation = createReconciliation({
          companyId: testCompanyId,
          accountId: bankAccount.id,
          statement,
          isFirstReconciliation: month === 1,
        });

        const matchResult = await enhancedMatchTransactions(
          statement.transactions,
          transactions,
          { usePatternLearning: false, patterns: [] }
        );

        const reconWithMatches = applyMatches(reconciliation, matchResult.matches);
        completeReconciliation(reconWithMatches);

        await saveReconciliationRecord(
          {
            company_id: testCompanyId,
            account_id: bankAccount.id,
            reconciliation_date: new Date(2024, month - 1, 28).getTime(),
            statement_period: {
              start: new Date(2024, month - 1, 1).getTime(),
              end: new Date(2024, month - 1, 28).getTime(),
            },
            beginning_balance: 0,
            ending_balance: 1967500,
            calculated_balance: 1967500,
            discrepancy: 0,
            status: 'balanced',
            matched_transactions: [],
            unmatched_statement_lines: [],
            unmatched_book_transactions: [],
            notes: `Month ${month}`,
            time_spent_seconds: 120,
            user_id: testUserId,
            reopened_at: null,
            reopened_by: null,
            reopened_reason: null,
            deleted_at: null,
          },
          testUserId
        );
      }

      // Get streak information
      const streakResult = await getReconciliationStreak(testCompanyId, bankAccount.id);

      expect(streakResult.success).toBe(true);

      if (streakResult.success) {
        const streak = streakResult.data;

        // Should have current streak of 4
        expect(streak.current_streak).toBeGreaterThanOrEqual(3);
        expect(streak.best_streak).toBeGreaterThanOrEqual(3);

        // Streak should be active
        expect(streak.streak_status).toBe('active');

        // Should have achieved 3-month milestone
        const threeMonthMilestone = streak.milestones_achieved.find((m: { milestone: number }) => m.milestone === 3);
        expect(threeMonthMilestone).toBeDefined();
      }
    }, 30000);
  });

  /**
   * Test 4: Unreconciled Transaction Flagging
   */
  describe('Unreconciled Transaction Flagging', () => {
    it('should flag old unreconciled transactions', async () => {
      const now = Date.now();
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
      const oneTwentyDaysAgo = new Date(now - 120 * 24 * 60 * 60 * 1000);

      // Create transactions at different ages
      await createTestTransaction(
        testCompanyId,
        bankAccount.id,
        1000,
        thirtyDaysAgo,
        '30 days old - should be NONE',
        testUserId
      );

      await createTestTransaction(
        testCompanyId,
        bankAccount.id,
        1000,
        sixtyDaysAgo,
        '60 days old - should be WARNING',
        testUserId
      );

      await createTestTransaction(
        testCompanyId,
        bankAccount.id,
        1000,
        ninetyDaysAgo,
        '90 days old - should be ATTENTION',
        testUserId
      );

      await createTestTransaction(
        testCompanyId,
        bankAccount.id,
        1000,
        oneTwentyDaysAgo,
        '120 days old - should be URGENT',
        testUserId
      );

      // Get unreconciled transactions
      const unreconciledResult = await getUnreconciledTransactions(
        testCompanyId,
        bankAccount.id
      );

      expect(unreconciledResult.success).toBe(true);

      if (unreconciledResult.success) {
        const unreconciled = unreconciledResult.data;

        // Should have flagged transactions
        expect(unreconciled.length).toBeGreaterThan(0);

        // Check flags by age
        const warningFlags = unreconciled.filter((tx: { flag: string }) => tx.flag === 'WARNING');
        const attentionFlags = unreconciled.filter((tx: { flag: string }) => tx.flag === 'ATTENTION');
        const urgentFlags = unreconciled.filter((tx: { flag: string }) => tx.flag === 'URGENT');

        expect(warningFlags.length).toBeGreaterThan(0);
        expect(attentionFlags.length).toBeGreaterThan(0);
        expect(urgentFlags.length).toBeGreaterThan(0);
      }

      // Get dashboard summary
      const dashboardResult = await getUnreconciledDashboard(testCompanyId);

      expect(dashboardResult.success).toBe(true);

      if (dashboardResult.success) {
        const dashboard = dashboardResult.data;

        expect(dashboard.total_count).toBeGreaterThan(0);
        expect(dashboard.by_flag.warning).toBeGreaterThan(0);
        expect(dashboard.by_flag.attention).toBeGreaterThan(0);
        expect(dashboard.by_flag.urgent).toBeGreaterThan(0);
        expect(dashboard.oldest_transaction_age_days).toBeGreaterThan(90);
      }
    });
  });

  /**
   * Test 5: Discrepancy Resolution Workflow
   */
  describe('Discrepancy Resolution', () => {
    it('should suggest resolutions for common discrepancies', async () => {
      // Create system transactions
      const transactions = await createMonthOfTransactions(
        testCompanyId,
        bankAccount.id,
        2024,
        1,
        testUserId
      );

      // Generate statement with bank fees not in system
      const statementData = generateMatchingStatement(transactions, bankAccount.id);

      // Add bank fee
      statementData.push({
        date: '2024-01-31',
        description: 'Monthly account fee',
        amount: -25.00,
      });

      // Add interest
      statementData.push({
        date: '2024-01-31',
        description: 'Interest earned',
        amount: 5.50,
      });

      const csvContent = generateBankStatementCSV(statementData);
      let statement = await parseCSVStatement(csvContent);

      statement = { ...statement, openingBalance: 0, closingBalance: 1967500 };

      // Create reconciliation
      const reconciliation = createReconciliation({
        companyId: testCompanyId,
        accountId: bankAccount.id,
        statement,
        isFirstReconciliation: true,
      });

      // Auto-match
      const matchResult = await enhancedMatchTransactions(
        statement.transactions,
        transactions,
        { usePatternLearning: false, patterns: [] }
      );

      const reconWithMatches = applyMatches(reconciliation, matchResult.matches);

      // Get unmatched items
      const unmatchedStmtIds = JSON.parse(reconWithMatches.unmatched_statement_items);
      const unmatchedStatement = statement.transactions.filter(
        tx => unmatchedStmtIds.includes(tx.id)
      );

      expect(unmatchedStatement.length).toBeGreaterThan(0);

      // Get discrepancy suggestions
      const suggestionsResult = await suggestDiscrepancyResolutions(
        testCompanyId,
        bankAccount.id,
        unmatchedStatement,
        [],
        -1950 // Discrepancy from bank fee and interest
      );

      expect(suggestionsResult.success).toBe(true);

      if (suggestionsResult.success) {
        const suggestions = suggestionsResult.data;

        // Should have suggestions for bank fee and interest
        expect(suggestions.length).toBeGreaterThan(0);

        const bankFeeSuggestion = suggestions.find((s: { pattern: string }) => s.pattern === 'BANK_FEE');
        const interestSuggestion = suggestions.find((s: { pattern: string }) => s.pattern === 'INTEREST');

        expect(bankFeeSuggestion).toBeDefined();
        expect(interestSuggestion).toBeDefined();

        // Should be auto-fixable
        expect(bankFeeSuggestion?.auto_fixable).toBe(true);
        expect(interestSuggestion?.auto_fixable).toBe(true);

        // Should have fix actions
        expect(bankFeeSuggestion?.fix_action).toBeDefined();
        expect(interestSuggestion?.fix_action).toBeDefined();
      }
    });
  });

  /**
   * Test 6: Reconciliation History Retrieval
   */
  describe('Reconciliation History', () => {
    it('should retrieve and display reconciliation history', async () => {
      // Perform 3 reconciliations
      for (let month = 1; month <= 3; month++) {
        const transactions = await createMonthOfTransactions(
          testCompanyId,
          bankAccount.id,
          2024,
          month,
          testUserId
        );

        const statementData = generateMatchingStatement(transactions, bankAccount.id);
        const csvContent = generateBankStatementCSV(statementData);
        let statement = await parseCSVStatement(csvContent);

        statement = { ...statement, openingBalance: 0, closingBalance: 1967500 };

        const reconciliation = createReconciliation({
          companyId: testCompanyId,
          accountId: bankAccount.id,
          statement,
          isFirstReconciliation: month === 1,
        });

        const matchResult = await enhancedMatchTransactions(
          statement.transactions,
          transactions,
          { usePatternLearning: false, patterns: [] }
        );

        const reconWithMatches = applyMatches(reconciliation, matchResult.matches);
        completeReconciliation(reconWithMatches);

        await saveReconciliationRecord(
          {
            company_id: testCompanyId,
            account_id: bankAccount.id,
            reconciliation_date: new Date(2024, month - 1, 28).getTime(),
            statement_period: {
              start: new Date(2024, month - 1, 1).getTime(),
              end: new Date(2024, month - 1, 28).getTime(),
            },
            beginning_balance: 0,
            ending_balance: 1967500,
            calculated_balance: 1967500,
            discrepancy: 0,
            status: 'balanced',
            matched_transactions: [],
            unmatched_statement_lines: [],
            unmatched_book_transactions: [],
            notes: `Month ${month}`,
            time_spent_seconds: 120,
            user_id: testUserId,
            reopened_at: null,
            reopened_by: null,
            reopened_reason: null,
            deleted_at: null,
          },
          testUserId
        );
      }

      // Retrieve history
      const historyResult = await getAccountReconciliationHistory(
        testCompanyId,
        bankAccount.id
      );

      expect(historyResult.success).toBe(true);

      if (historyResult.success) {
        const history = historyResult.data;

        expect(history.length).toBe(3);

        // Should be sorted by date (most recent first)
        expect(history[0]?.reconciliation_date).toBeGreaterThan(history[1]?.reconciliation_date ?? 0);
        expect(history[1]?.reconciliation_date).toBeGreaterThan(history[2]?.reconciliation_date ?? 0);

        // All should be balanced
        history.forEach((record: { status: string; discrepancy: number }) => {
          expect(record.status).toBe('balanced');
          expect(Math.abs(record.discrepancy)).toBeLessThan(100);
        });
      }
    });
  });

  /**
   * Test 7: Performance Test
   * Verify <5 seconds for 500 transactions
   */
  describe('Performance', () => {
    it('should process 500 transactions in under 5 seconds', async () => {
      // Create 500 transactions
      const transactions: JournalEntry[] = [];
      const batchSize = 50;

      for (let batch = 0; batch < 10; batch++) {
        for (let i = 0; i < batchSize; i++) {
          const tx = await createTestTransaction(
            testCompanyId,
            bankAccount.id,
            Math.random() * 10000 - 5000, // Random amount between -5000 and 5000
            new Date(2024, 0, 1 + (batch * 3) + Math.floor(i / 17)), // Spread across month
            `Transaction ${batch * batchSize + i}`,
            testUserId
          );
          transactions.push(tx);
        }
      }

      expect(transactions.length).toBe(500);

      // Generate matching statement
      const statementData = generateMatchingStatement(transactions, bankAccount.id);
      const csvContent = generateBankStatementCSV(statementData);

      const startTime = Date.now();

      let statement = await parseCSVStatement(csvContent);
      statement = { ...statement, openingBalance: 0, closingBalance: 0 };

      const reconciliation = createReconciliation({
        companyId: testCompanyId,
        accountId: bankAccount.id,
        statement,
        isFirstReconciliation: true,
      });

      // Enhanced matching
      const matchResult = await enhancedMatchTransactions(
        statement.transactions,
        transactions,
        { usePatternLearning: false, patterns: [] }
      );

      const reconWithMatches = applyMatches(reconciliation, matchResult.matches);
      completeReconciliation(reconWithMatches);

      const endTime = Date.now();
      const elapsedSeconds = (endTime - startTime) / 1000;

      expect(elapsedSeconds).toBeLessThan(5);
      expect(matchResult.matches.length).toBeGreaterThan(0);
    }, 10000); // 10 second timeout to allow for some overhead
  });

  /**
   * Test 8: Multi-Transaction Matching
   */
  describe('Multi-Transaction Matching', () => {
    it('should match split deposits correctly', async () => {
      // Create 2 system transactions that together equal 1 statement transaction
      const tx1 = await createTestTransaction(
        testCompanyId,
        bankAccount.id,
        3000,
        new Date(2024, 0, 10),
        'Payment part 1',
        testUserId
      );

      const tx2 = await createTestTransaction(
        testCompanyId,
        bankAccount.id,
        2000,
        new Date(2024, 0, 10),
        'Payment part 2',
        testUserId
      );

      // Statement shows combined deposit
      const csvContent = generateBankStatementCSV([
        {
          date: '2024-01-10',
          description: 'Combined deposit',
          amount: 50.00, // $5000 total
        },
      ]);

      let statement = await parseCSVStatement(csvContent);
      statement = { ...statement, openingBalance: 0, closingBalance: 5000 };

      // Auto-match with multi-transaction enabled
      const matchResult = await enhancedMatchTransactions(
        statement.transactions,
        [tx1, tx2],
        {
          usePatternLearning: false,
          patterns: [],
          enableMultiTransactionMatching: true,
        }
      );

      // Should find multi-transaction match
      expect(matchResult.multiMatches.length).toBeGreaterThan(0);

      const splitMatch = matchResult.multiMatches[0];
      if (splitMatch) {
        expect(splitMatch.match_type).toBe('split_deposit');
        expect(splitMatch.system_transaction_ids.length).toBe(2);
        expect(splitMatch.statement_transaction_ids.length).toBe(1);
      }
    });
  });
});
