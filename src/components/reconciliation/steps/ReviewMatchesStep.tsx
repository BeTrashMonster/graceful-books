/**
 * Review Matches Step
 *
 * Review auto-matched transactions and manually match remaining items.
 */

import { useMemo } from 'react';
import { Button } from '../../core/Button';
import { Card } from '../../ui/Card';
import type {
  ParsedStatement,
  TransactionMatch,
  StatementTransaction,
} from '../../../types/reconciliation.types';
import { getConfidenceDescription } from '../../../utils/parsers/matchingAlgorithm';
import { fromCents } from '../../../utils/money';

interface ReviewMatchesStepProps {
  statement: ParsedStatement;
  matches: TransactionMatch[];
  confirmedMatches: Set<string>;
  rejectedMatches: Set<string>;
  manualMatches: Map<string, string>;
  onMatchConfirmed: (matchId: string) => void;
  onMatchRejected: (matchId: string) => void;
  onManualMatch: (statementTxId: string, systemTxId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ReviewMatchesStep({
  statement,
  matches,
  confirmedMatches,
  rejectedMatches,
  onMatchConfirmed,
  onMatchRejected,
  onNext,
  onBack,
}: ReviewMatchesStepProps) {
  // Calculate statistics
  const stats = useMemo(() => {
    const totalTransactions = statement.transactions.length;
    const autoMatched = matches.filter(m =>
      m.confidence === 'EXACT' || m.confidence === 'HIGH'
    ).length;
    const needsReview = matches.filter(m =>
      m.confidence === 'MEDIUM' || m.confidence === 'LOW'
    ).length;
    const unmatched = totalTransactions - matches.length;

    return { totalTransactions, autoMatched, needsReview, unmatched };
  }, [statement, matches]);

  const canProceed = useMemo(() => {
    // User can proceed if they've reviewed all matches or accepted the auto-matches
    return true; // Simplified for MVP
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Card className="p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Review Matches
        </h1>
        <p className="text-gray-600 mb-6">
          We've matched {stats.autoMatched} of {stats.totalTransactions} transactions automatically.
          {stats.needsReview > 0 && ` Please review ${stats.needsReview} uncertain matches.`}
        </p>

        {/* Progress Summary */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-700">
              {stats.autoMatched}
            </div>
            <div className="text-sm text-green-600">Auto-matched</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-700">
              {stats.needsReview}
            </div>
            <div className="text-sm text-yellow-600">Needs review</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-700">
              {stats.unmatched}
            </div>
            <div className="text-sm text-blue-600">Unmatched</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-700">
              {Math.round((stats.autoMatched / stats.totalTransactions) * 100)}%
            </div>
            <div className="text-sm text-gray-600">Match rate</div>
          </div>
        </div>

        {/* Matches List */}
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Auto-matched Transactions
          </h2>

          {matches.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No automatic matches found. You can add transactions manually on the next step.
            </p>
          ) : (
            <div className="space-y-3">
              {matches.slice(0, 10).map(match => {
                const stmtTx = statement.transactions.find(
                  t => t.id === match.statementTransactionId
                );

                if (!stmtTx) return null;

                const isConfirmed = confirmedMatches.has(match.statementTransactionId);
                const isRejected = rejectedMatches.has(match.statementTransactionId);

                return (
                  <MatchItem
                    key={match.statementTransactionId}
                    match={match}
                    transaction={stmtTx}
                    isConfirmed={isConfirmed}
                    isRejected={isRejected}
                    onConfirm={() => onMatchConfirmed(match.statementTransactionId)}
                    onReject={() => onMatchRejected(match.statementTransactionId)}
                  />
                );
              })}
              {matches.length > 10 && (
                <p className="text-sm text-gray-500 text-center">
                  ...and {matches.length - 10} more matches
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <div className="text-sm text-gray-600">
            You've matched {stats.autoMatched + confirmedMatches.size} of {stats.totalTransactions} transactions. You're doing great!
          </div>
          <Button variant="primary" onClick={onNext} disabled={!canProceed}>
            Continue to Summary
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Match Item Component
function MatchItem({
  match,
  transaction,
  isConfirmed,
  isRejected,
  onConfirm,
  onReject,
}: {
  match: TransactionMatch;
  transaction: StatementTransaction;
  isConfirmed: boolean;
  isRejected: boolean;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const confidenceColor =
    match.confidence === 'EXACT' || match.confidence === 'HIGH'
      ? 'green'
      : match.confidence === 'MEDIUM'
      ? 'yellow'
      : 'red';

  return (
    <div
      className={`
        p-4 rounded-lg border-2
        ${isConfirmed ? 'border-green-500 bg-green-50' : ''}
        ${isRejected ? 'border-red-500 bg-red-50' : ''}
        ${!isConfirmed && !isRejected ? 'border-gray-200' : ''}
      `}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900">
              {new Date(transaction.date).toLocaleDateString()}
            </span>
            <span
              className={`
                text-xs px-2 py-0.5 rounded
                ${confidenceColor === 'green' ? 'bg-green-100 text-green-700' : ''}
                ${confidenceColor === 'yellow' ? 'bg-yellow-100 text-yellow-700' : ''}
                ${confidenceColor === 'red' ? 'bg-red-100 text-red-700' : ''}
              `}
            >
              {match.confidence.toLowerCase()}
            </span>
          </div>
          <p className="text-gray-700">{transaction.description}</p>
          <p className="text-sm text-gray-500 mt-1">
            {getConfidenceDescription(match.confidence)}
          </p>
        </div>
        <div className="text-right ml-4">
          <div className="font-semibold text-gray-900">
            {fromCents(transaction.amount)}
          </div>
          {!isConfirmed && !isRejected && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={onReject}>
                ✗
              </Button>
              <Button size="sm" variant="primary" onClick={onConfirm}>
                ✓
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
