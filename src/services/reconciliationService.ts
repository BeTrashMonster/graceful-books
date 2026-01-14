/**
 * Reconciliation Service
 *
 * Manages reconciliation sessions including:
 * - Creating and updating reconciliation records
 * - Matching transactions
 * - Calculating discrepancies
 * - Marking transactions as reconciled
 *
 * Per ACCT-004: Bank reconciliation workflow
 */

import { nanoid } from 'nanoid';
import {
  ReconciliationStatus,
  type Reconciliation,
  type ParsedStatement,
  type TransactionMatch,
} from '../types/reconciliation.types';
import type { JournalEntry } from '../types';
import { AppError, ErrorCode } from '../utils/errors';
import { getDeviceId } from '../utils/device';
import { initVersionVector, incrementVersionVector } from '../utils/versionVector';

// =============================================================================
// Reconciliation Creation
// =============================================================================

/**
 * Create a new reconciliation session
 */
export function createReconciliation(params: {
  companyId: string;
  accountId: string;
  statement: ParsedStatement;
  isFirstReconciliation: boolean;
}): Reconciliation {
  const { companyId, accountId, statement, isFirstReconciliation } = params;

  const now = Date.now();
  const deviceId = getDeviceId();

  const reconciliation: Reconciliation = {
    id: nanoid(),
    company_id: companyId,
    account_id: accountId,
    statement_period_start: statement.statementPeriod.startDate,
    statement_period_end: statement.statementPeriod.endDate,
    opening_balance: statement.openingBalance ?? 0,
    closing_balance: statement.closingBalance ?? 0,
    status: ReconciliationStatus.DRAFT,
    statement_data: JSON.stringify(statement),
    matched_transactions: JSON.stringify([]),
    unmatched_statement_items: JSON.stringify(statement.transactions.map((t) => t.id)),
    unmatched_system_items: JSON.stringify([]),
    discrepancy: 0,
    is_first_reconciliation: isFirstReconciliation,
    completed_at: null,
    notes: null,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    deletedAt: undefined,
    version_vector: initVersionVector(),
  };

  return reconciliation;
}

// =============================================================================
// Match Management
// =============================================================================

/**
 * Apply matches to reconciliation
 */
export function applyMatches(
  reconciliation: Reconciliation,
  matches: TransactionMatch[]
): Reconciliation {
  const statement: ParsedStatement = JSON.parse(reconciliation.statement_data);
  const matchedTransactionIds: string[] = [];
  const unmatchedStatementIds: string[] = [];

  // Update statement transactions with match info
  for (const txn of statement.transactions) {
    const match = matches.find((m) => m.statementTransactionId === txn.id);

    if (match) {
      txn.matched = true;
      txn.matchedTransactionId = match.systemTransactionId;
      matchedTransactionIds.push(match.systemTransactionId);
    } else {
      unmatchedStatementIds.push(txn.id);
    }
  }

  const now = Date.now();

  return {
    ...reconciliation,
    statement_data: JSON.stringify(statement),
    matched_transactions: JSON.stringify(matchedTransactionIds),
    unmatched_statement_items: JSON.stringify(unmatchedStatementIds),
    updatedAt: new Date(now),
    version_vector: incrementVersionVector(reconciliation.version_vector),
  };
}

/**
 * Add manual match
 */
export function addManualMatch(
  reconciliation: Reconciliation,
  statementTransactionId: string,
  systemTransactionId: string
): Reconciliation {
  const statement: ParsedStatement = JSON.parse(reconciliation.statement_data);
  const matchedIds: string[] = JSON.parse(reconciliation.matched_transactions);
  const unmatchedStatementIds: string[] = JSON.parse(
    reconciliation.unmatched_statement_items
  );

  // Find and update statement transaction
  const statementTxn = statement.transactions.find((t) => t.id === statementTransactionId);
  if (!statementTxn) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "We couldn't find that statement transaction."
    );
  }

  if (statementTxn.matched) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'This statement transaction is already matched.'
    );
  }

  // Update match info
  statementTxn.matched = true;
  statementTxn.matchedTransactionId = systemTransactionId;

  // Update tracking arrays
  matchedIds.push(systemTransactionId);
  const updatedUnmatchedStatement = unmatchedStatementIds.filter(
    (id) => id !== statementTransactionId
  );

  const now = Date.now();

  return {
    ...reconciliation,
    statement_data: JSON.stringify(statement),
    matched_transactions: JSON.stringify(matchedIds),
    unmatched_statement_items: JSON.stringify(updatedUnmatchedStatement),
    updatedAt: new Date(now),
    version_vector: incrementVersionVector(reconciliation.version_vector),
  };
}

/**
 * Remove match
 */
export function removeMatch(
  reconciliation: Reconciliation,
  statementTransactionId: string
): Reconciliation {
  const statement: ParsedStatement = JSON.parse(reconciliation.statement_data);
  const matchedIds: string[] = JSON.parse(reconciliation.matched_transactions);
  const unmatchedStatementIds: string[] = JSON.parse(
    reconciliation.unmatched_statement_items
  );

  // Find statement transaction
  const statementTxn = statement.transactions.find((t) => t.id === statementTransactionId);
  if (!statementTxn) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "We couldn't find that statement transaction."
    );
  }

  if (!statementTxn.matched) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'This statement transaction is not matched.'
    );
  }

  const systemTransactionId = statementTxn.matchedTransactionId;

  // Update match info
  statementTxn.matched = false;
  statementTxn.matchedTransactionId = undefined;

  // Update tracking arrays
  const updatedMatchedIds = matchedIds.filter((id) => id !== systemTransactionId);
  unmatchedStatementIds.push(statementTransactionId);

  const now = Date.now();

  return {
    ...reconciliation,
    statement_data: JSON.stringify(statement),
    matched_transactions: JSON.stringify(updatedMatchedIds),
    unmatched_statement_items: JSON.stringify(unmatchedStatementIds),
    updatedAt: new Date(now),
    version_vector: incrementVersionVector(reconciliation.version_vector),
  };
}

// =============================================================================
// Discrepancy Calculation
// =============================================================================

/**
 * Calculate reconciliation discrepancy
 *
 * Discrepancy = (Closing Balance from Statement) - (Opening Balance + Net Matched Transactions)
 */
export function calculateDiscrepancy(
  reconciliation: Reconciliation,
  systemTransactions: JournalEntry[],
  accountId: string
): number {
  const statement: ParsedStatement = JSON.parse(reconciliation.statement_data);
  const matchedIds: string[] = JSON.parse(reconciliation.matched_transactions);

  // If we don't have balances from statement, can't calculate discrepancy
  if (
    reconciliation.closing_balance === undefined ||
    reconciliation.opening_balance === undefined
  ) {
    return 0;
  }

  // Sum matched transactions from our system
  let netMatchedAmount = 0;
  for (const systemTxn of systemTransactions) {
    if (matchedIds.includes(systemTxn.id)) {
      // Find the line for this account
      const line = systemTxn.lines.find((l) => l.accountId === accountId);
      if (line) {
        // Debit increases bank balance, credit decreases it
        netMatchedAmount += Math.round((line.debit - line.credit) * 100);
      }
    }
  }

  const expectedBalance =
    reconciliation.opening_balance + netMatchedAmount;
  const discrepancy = reconciliation.closing_balance - expectedBalance;

  return discrepancy;
}

// =============================================================================
// Completion
// =============================================================================

/**
 * Complete reconciliation
 */
export function completeReconciliation(
  reconciliation: Reconciliation,
  notes?: string
): Reconciliation {
  if (reconciliation.status === ReconciliationStatus.COMPLETED) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'This reconciliation is already completed.'
    );
  }

  const now = Date.now();

  return {
    ...reconciliation,
    status: ReconciliationStatus.COMPLETED,
    completed_at: now,
    notes: notes || null,
    updatedAt: new Date(now),
    version_vector: incrementVersionVector(reconciliation.version_vector),
  };
}

/**
 * Abandon reconciliation
 */
export function abandonReconciliation(reconciliation: Reconciliation): Reconciliation {
  const now = Date.now();

  return {
    ...reconciliation,
    status: ReconciliationStatus.ABANDONED,
    updatedAt: new Date(now),
    version_vector: incrementVersionVector(reconciliation.version_vector),
  };
}

// =============================================================================
// Transaction Status Updates
// =============================================================================

/**
 * Mark transactions as reconciled
 *
 * This should be called after completing a reconciliation to update
 * the transaction status in the main transaction store.
 */
export function getTransactionsToReconcile(
  reconciliation: Reconciliation
): string[] {
  if (reconciliation.status !== ReconciliationStatus.COMPLETED) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Can only mark transactions as reconciled after completion.'
    );
  }

  const matchedIds: string[] = JSON.parse(reconciliation.matched_transactions);
  return matchedIds;
}

// =============================================================================
// Reporting
// =============================================================================

/**
 * Get reconciliation summary
 */
export function getReconciliationSummary(reconciliation: Reconciliation): {
  totalStatementTransactions: number;
  matchedCount: number;
  unmatchedStatementCount: number;
  unmatchedSystemCount: number;
  matchRate: number;
  discrepancy: number;
  isBalanced: boolean;
} {
  const statement: ParsedStatement = JSON.parse(reconciliation.statement_data);
  const matchedIds: string[] = JSON.parse(reconciliation.matched_transactions);
  const unmatchedStatement: string[] = JSON.parse(
    reconciliation.unmatched_statement_items
  );
  const unmatchedSystem: string[] = JSON.parse(
    reconciliation.unmatched_system_items
  );

  const totalStatementTransactions = statement.transactions.length;
  const matchedCount = matchedIds.length;
  const matchRate =
    totalStatementTransactions > 0
      ? Math.round((matchedCount / totalStatementTransactions) * 100)
      : 0;

  return {
    totalStatementTransactions,
    matchedCount,
    unmatchedStatementCount: unmatchedStatement.length,
    unmatchedSystemCount: unmatchedSystem.length,
    matchRate,
    discrepancy: reconciliation.discrepancy,
    isBalanced: Math.abs(reconciliation.discrepancy) < 1, // Less than 1 cent
  };
}
