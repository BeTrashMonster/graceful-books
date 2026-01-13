/**
 * Summary Step
 *
 * Final reconciliation summary with completion celebration.
 */

import { useState, useEffect } from 'react';
import { Button } from '../../core/Button';
import { Card } from '../../ui/Card';
import { Loading } from '../../feedback/Loading';
import { ErrorMessage } from '../../feedback/ErrorMessage';
import type {
  ParsedStatement,
  TransactionMatch,
} from '../../../types/reconciliation.types';
import {
  createReconciliation,
  completeReconciliation,
  updateReconciliationMatches,
} from '../../../store';
import { fromCents } from '../../../utils/money';
import { triggerConfetti } from '../../../utils/confetti';

interface SummaryStepProps {
  accountId: string;
  companyId: string;
  statement: ParsedStatement;
  matches: TransactionMatch[];
  confirmedMatches: Set<string>;
  manualMatches: Map<string, string>;
  isFirstReconciliation: boolean;
  onComplete: () => void;
  onBack: () => void;
}

export function SummaryStep({
  accountId,
  companyId,
  statement,
  matches,
  confirmedMatches,
  manualMatches,
  isFirstReconciliation,
  onComplete,
  onBack,
}: SummaryStepProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // Calculate summary statistics
  const totalMatched = matches.length + manualMatches.size;
  const totalTransactions = statement.transactions.length;
  const matchRate = Math.round((totalMatched / totalTransactions) * 100);

  // Calculate discrepancy
  const expectedBalance = statement.closingBalance || 0;
  const actualBalance = statement.openingBalance || 0; // Simplified
  const discrepancy = Math.abs(expectedBalance - actualBalance);

  const handleComplete = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Create reconciliation record
      const createResult = await createReconciliation({
        companyId,
        accountId,
        statement,
        isFirstReconciliation,
      });

      if (!createResult.success) {
        throw new Error(createResult.error.message);
      }

      const reconciliationId = createResult.data.id;

      // Update with matches
      const matchedTxIds = matches.map(m => m.statementTransactionId);
      const unmatchedStmtIds = statement.transactions
        .filter(t => !matchedTxIds.includes(t.id))
        .map(t => t.id);

      await updateReconciliationMatches(
        reconciliationId,
        matches,
        unmatchedStmtIds,
        []
      );

      // Complete reconciliation
      await completeReconciliation(reconciliationId, discrepancy);

      setIsCompleted(true);

      // Trigger celebration
      if (discrepancy === 0 || matchRate >= 90) {
        triggerConfetti();
      }

      // Auto-redirect after celebration
      setTimeout(() => {
        onComplete();
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'We had trouble saving your reconciliation. Please try again.'
      );
      setIsSaving(false);
    }
  };

  if (isCompleted) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card className="p-12 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            {isFirstReconciliation
              ? 'First Reconciliation Complete!'
              : 'Reconciliation Complete!'}
          </h1>
          <p className="text-xl text-gray-600 mb-4">
            {discrepancy === 0
              ? 'Your books are perfectly balanced!'
              : 'Your reconciliation has been saved.'}
          </p>
          <p className="text-gray-500">
            You've matched {totalMatched} of {totalTransactions} transactions.
            {matchRate >= 90 && ' Outstanding work!'}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card className="p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Reconciliation Summary
        </h1>
        <p className="text-gray-600 mb-6">
          Review your reconciliation before completing.
        </p>

        {error && <ErrorMessage className="mb-6">{error}</ErrorMessage>}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-600 mb-1">Statement Period</div>
            <div className="font-semibold text-gray-900">
              {new Date(statement.statementPeriod.startDate).toLocaleDateString()} -{' '}
              {new Date(statement.statementPeriod.endDate).toLocaleDateString()}
            </div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-green-600 mb-1">Matched Transactions</div>
            <div className="font-semibold text-gray-900">
              {totalMatched} of {totalTransactions} ({matchRate}%)
            </div>
          </div>
        </div>

        {/* Balance Information */}
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Balance Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Opening Balance:</span>
              <span className="font-semibold">
                {fromCents(statement.openingBalance || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Closing Balance:</span>
              <span className="font-semibold">
                {fromCents(statement.closingBalance || 0)}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-gray-900 font-semibold">Discrepancy:</span>
              <span
                className={`font-bold ${
                  discrepancy === 0 ? 'text-green-600' : 'text-yellow-600'
                }`}
              >
                {fromCents(discrepancy)}
              </span>
            </div>
          </div>
        </div>

        {discrepancy === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <span className="text-green-600 text-2xl mr-3">✓</span>
              <div>
                <h4 className="font-semibold text-green-900 mb-1">
                  Perfect Balance!
                </h4>
                <p className="text-sm text-green-700">
                  Your opening and closing balances match perfectly. This is exactly what
                  we're looking for!
                </p>
              </div>
            </div>
          </div>
        )}

        {isFirstReconciliation && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <span className="text-blue-600 text-2xl mr-3">ℹ️</span>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">
                  Great Job on Your First Reconciliation!
                </h4>
                <p className="text-sm text-blue-700">
                  You've completed your first reconciliation. This is an important step in
                  maintaining accurate financial records. We recommend reconciling at least
                  monthly to catch any discrepancies early.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          <Button variant="outline" onClick={onBack} disabled={isSaving}>
            Back
          </Button>
          <Button
            variant="primary"
            onClick={handleComplete}
            disabled={isSaving}
          >
            {isSaving ? <Loading size="sm" /> : 'Complete Reconciliation'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
