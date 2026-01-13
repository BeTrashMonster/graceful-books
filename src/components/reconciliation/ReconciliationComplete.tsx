/**
 * Reconciliation Completion Component
 *
 * Celebration screen shown when reconciliation is successfully completed.
 * Includes confetti animation and encouraging messaging.
 *
 * Per ACCT-004: Celebration on completion
 * Per ROADMAP: "You reconciled! This is a bigger deal than it sounds."
 */

import React, { useEffect } from 'react';
import { Button } from '../core/Button';
import { Card } from '../ui/Card';
import { triggerCelebration } from '../../utils/confetti';
import { formatMoney } from '../../utils/money';

interface ReconciliationCompleteProps {
  isFirstReconciliation: boolean;
  matchedCount: number;
  totalTransactions: number;
  discrepancy: number;
  accountName?: string;
  onClose: () => void;
  onViewDetails?: () => void;
}

export const ReconciliationComplete: React.FC<ReconciliationCompleteProps> = ({
  isFirstReconciliation,
  matchedCount,
  totalTransactions,
  discrepancy,
  accountName,
  onClose,
  onViewDetails,
}) => {
  const matchRate = totalTransactions > 0
    ? Math.round((matchedCount / totalTransactions) * 100)
    : 0;
  const isBalanced = Math.abs(discrepancy) < 1; // Less than 1 cent

  // Trigger confetti on mount
  useEffect(() => {
    triggerCelebration();
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Hero section */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-success-100 rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-success-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-4xl font-bold text-gray-900">
          {isFirstReconciliation ? "You Did It!" : "Reconciliation Complete!"}
        </h1>

        <p className="text-xl text-gray-600">
          {isFirstReconciliation ? (
            <>
              <strong>Your first reconciliation is done.</strong> This is a bigger deal than
              it sounds. Seriously, many business owners never do this.
            </>
          ) : (
            <>Your books are now in sync with your bank. Great work!</>
          )}
        </p>
      </div>

      {/* Stats card */}
      <Card className="p-6">
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl font-bold text-success-600">{matchedCount}</div>
              <div className="text-sm text-gray-600 mt-1">Transactions Matched</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-600">{matchRate}%</div>
              <div className="text-sm text-gray-600 mt-1">Match Rate</div>
            </div>
            <div>
              <div className={`text-3xl font-bold ${isBalanced ? 'text-success-600' : 'text-warning-600'}`}>
                {isBalanced ? '✓' : formatMoney(Math.abs(discrepancy))}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {isBalanced ? 'Perfectly Balanced' : 'Discrepancy'}
              </div>
            </div>
          </div>

          {!isBalanced && (
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
              <p className="text-warning-900">
                <strong>Small difference detected:</strong> There's a {formatMoney(Math.abs(discrepancy))}
                discrepancy. This could be due to timing differences, fees, or unrecorded
                transactions. Review your unmatched items to investigate.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* What this means */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">What This Means</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-success-500 text-xl">✓</span>
            <div>
              <p className="font-medium text-gray-900">Your records are accurate</p>
              <p className="text-sm text-gray-600">
                The transactions in your books match your bank statement
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-success-500 text-xl">✓</span>
            <div>
              <p className="font-medium text-gray-900">You can trust your reports</p>
              <p className="text-sm text-gray-600">
                Your financial reports are based on verified, reconciled data
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-success-500 text-xl">✓</span>
            <div>
              <p className="font-medium text-gray-900">You're catching errors early</p>
              <p className="text-sm text-gray-600">
                Any discrepancies or mistakes are identified before they become problems
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Next steps */}
      {isFirstReconciliation && (
        <Card className="p-6 bg-primary-50 border-primary-200">
          <h2 className="text-xl font-semibold text-primary-900 mb-3">
            What's Next?
          </h2>
          <div className="space-y-2 text-primary-900">
            <p>
              <strong>Make it a habit:</strong> Reconcile monthly (or weekly if you have a lot
              of transactions). The more often you do it, the faster it gets.
            </p>
            <p>
              <strong>Set a reminder:</strong> Add reconciliation to your monthly checklist
              so you don't forget.
            </p>
            <p>
              <strong>Keep it up:</strong> You just proved you can do this. Next time will
              be even easier!
            </p>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-center gap-4 pt-4">
        {onViewDetails && (
          <Button variant="outline" onClick={onViewDetails}>
            View Details
          </Button>
        )}
        <Button onClick={onClose} className="px-8">
          {isFirstReconciliation ? 'Finish' : 'Done'}
        </Button>
      </div>

      {/* Optional: Badge/achievement */}
      {isFirstReconciliation && (
        <div className="text-center text-sm text-gray-500">
          <p>You've earned a badge: First Reconciliation 🏆</p>
        </div>
      )}
    </div>
  );
};
