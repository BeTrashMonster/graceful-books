/**
 * Match Review Component
 *
 * Displays auto-matched transactions for user review and confirmation.
 * Shows match confidence and allows users to accept or reject matches.
 *
 * Per ACCT-004: Step-by-step matching guidance
 */

import React, { useState } from 'react';
import { Button } from '../core/Button';
import { Card } from '../ui/Card';
import { Checkbox } from '../forms/Checkbox';
import type {
  TransactionMatch,
  StatementTransaction,
  MatchConfidence,
} from '../../../types/reconciliation.types';
import type { JournalEntry } from '../../types';
import { formatMoney } from '../../utils/money';

interface MatchReviewProps {
  matches: TransactionMatch[];
  statementTransactions: StatementTransaction[];
  systemTransactions: JournalEntry[];
  onConfirm: (confirmedMatches: Set<string>, rejectedMatches: Set<string>) => void;
  onBack: () => void;
}

const confidenceColors: Record<MatchConfidence, { bg: string; text: string; badge: string }> = {
  EXACT: { bg: 'bg-success-50', text: 'text-success-900', badge: 'bg-success-100 text-success-800' },
  HIGH: { bg: 'bg-info-50', text: 'text-info-900', badge: 'bg-info-100 text-info-800' },
  MEDIUM: { bg: 'bg-warning-50', text: 'text-warning-900', badge: 'bg-warning-100 text-warning-800' },
  LOW: { bg: 'bg-gray-50', text: 'text-gray-900', badge: 'bg-gray-100 text-gray-800' },
  MANUAL: { bg: 'bg-primary-50', text: 'text-primary-900', badge: 'bg-primary-100 text-primary-800' },
};

const confidenceLabels: Record<MatchConfidence, string> = {
  EXACT: 'Exact Match',
  HIGH: 'High Confidence',
  MEDIUM: 'Medium Confidence',
  LOW: 'Low Confidence',
  MANUAL: 'Manual Match',
};

export const MatchReview: React.FC<MatchReviewProps> = ({
  matches,
  statementTransactions,
  systemTransactions,
  onConfirm,
  onBack,
}) => {
  const [confirmedMatches, setConfirmedMatches] = useState<Set<string>>(
    new Set(matches.filter((m) => m.confidence === 'EXACT' || m.confidence === 'HIGH').map((m) => m.statementTransactionId))
  );
  const [rejectedMatches, setRejectedMatches] = useState<Set<string>>(new Set());

  const handleToggleMatch = (statementTxnId: string) => {
    setConfirmedMatches((prev) => {
      const next = new Set(prev);
      if (next.has(statementTxnId)) {
        next.delete(statementTxnId);
        // Add to rejected
        setRejectedMatches((r) => new Set(r).add(statementTxnId));
      } else {
        next.add(statementTxnId);
        // Remove from rejected
        setRejectedMatches((r) => {
          const nextR = new Set(r);
          nextR.delete(statementTxnId);
          return nextR;
        });
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setConfirmedMatches(new Set(matches.map((m) => m.statementTransactionId)));
    setRejectedMatches(new Set());
  };

  const handleDeselectAll = () => {
    setConfirmedMatches(new Set());
    setRejectedMatches(new Set(matches.map((m) => m.statementTransactionId)));
  };

  const handleContinue = () => {
    onConfirm(confirmedMatches, rejectedMatches);
  };

  const getStatementTransaction = (id: string) => {
    return statementTransactions.find((t) => t.id === id);
  };

  const getSystemTransaction = (id: string) => {
    return systemTransactions.find((t) => t.id === id);
  };

  const matchStats = {
    total: matches.length,
    confirmed: confirmedMatches.size,
    rejected: rejectedMatches.size,
    pending: matches.length - confirmedMatches.size - rejectedMatches.size,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Review Matches</h1>
        <p className="text-lg text-gray-600">
          We found {matches.length} possible {matches.length === 1 ? 'match' : 'matches'}. Let's
          review them together.
        </p>
      </div>

      {/* Stats card */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-6">
            <div>
              <span className="text-2xl font-bold text-gray-900">{matchStats.confirmed}</span>
              <span className="text-gray-600 ml-2">confirmed</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-gray-500">{matchStats.pending}</span>
              <span className="text-gray-600 ml-2">to review</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-warning-600">{matchStats.rejected}</span>
              <span className="text-gray-600 ml-2">rejected</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleSelectAll}>
              Accept All
            </Button>
            <Button size="sm" variant="outline" onClick={handleDeselectAll}>
              Reject All
            </Button>
          </div>
        </div>
      </Card>

      {/* Matches list */}
      <div className="space-y-3">
        {matches.map((match) => {
          const statementTxn = getStatementTransaction(match.statementTransactionId);
          const systemTxn = getSystemTransaction(match.systemTransactionId);
          const isConfirmed = confirmedMatches.has(match.statementTransactionId);
          const isRejected = rejectedMatches.has(match.statementTransactionId);
          const colors = confidenceColors[match.confidence]!;

          if (!statementTxn || !systemTxn) return null;

          return (
            <Card
              key={match.statementTransactionId}
              className={`p-4 transition-colors ${
                isConfirmed
                  ? 'border-success-300 bg-success-50'
                  : isRejected
                  ? 'border-gray-300 bg-gray-50 opacity-60'
                  : colors.bg
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="pt-1">
                  <Checkbox
                    id={`match-${match.statementTransactionId}`}
                    checked={isConfirmed}
                    onChange={() => handleToggleMatch(match.statementTransactionId)}
                  />
                </div>

                <div className="flex-1 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${colors.badge}`}>
                      {confidenceLabels[match.confidence]} ({match.score}%)
                    </span>
                    <span className="text-lg font-semibold text-gray-900">
                      {formatMoney(statementTxn.amount)}
                    </span>
                  </div>

                  {/* Statement transaction */}
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 text-sm font-medium min-w-[100px]">
                      Bank:
                    </span>
                    <div className="flex-1">
                      <p className="text-gray-900">{statementTxn.description}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(statementTxn.date).toLocaleDateString()}
                        {statementTxn.reference && ` • Ref: ${statementTxn.reference}`}
                      </p>
                    </div>
                  </div>

                  {/* System transaction */}
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 text-sm font-medium min-w-[100px]">
                      Your Books:
                    </span>
                    <div className="flex-1">
                      <p className="text-gray-900">
                        {systemTxn.memo || systemTxn.reference || 'No description'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {systemTxn.date.toLocaleDateString()}
                        {systemTxn.reference && ` • Ref: ${systemTxn.reference}`}
                      </p>
                    </div>
                  </div>

                  {/* Match reasons */}
                  {match.reasons.length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                        Why we matched these
                      </summary>
                      <ul className="mt-2 ml-4 space-y-1 text-gray-600">
                        {match.reasons.map((reason: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-success-500 mt-1">✓</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Help text */}
      {matchStats.pending > 0 && (
        <div className="bg-info-50 border border-info-200 rounded-lg p-4">
          <p className="text-info-900">
            <strong>Tip:</strong> Check each match carefully. If something doesn't look right,
            uncheck it and we'll help you match it manually in the next step.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={matchStats.confirmed === 0}>
          Continue ({matchStats.confirmed} matched)
        </Button>
      </div>
    </div>
  );
};
