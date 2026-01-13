/**
 * Reconciliation Introduction Component
 *
 * Educational introduction explaining what reconciliation is and why it's important.
 * Designed with Steadiness communication style - patient, supportive, step-by-step.
 *
 * Per ACCT-004: "What is reconciliation?" explainer
 */

import React from 'react';
import { Button } from '../core/Button';
import { Card } from '../ui/Card';
import { HelpTooltip } from '../help/HelpTooltip';

interface ReconciliationIntroProps {
  isFirstReconciliation: boolean;
  onContinue: () => void;
  onCancel: () => void;
}

export const ReconciliationIntro: React.FC<ReconciliationIntroProps> = ({
  isFirstReconciliation,
  onContinue,
  onCancel,
}) => {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {isFirstReconciliation
            ? "Let's Reconcile Your First Bank Statement"
            : 'Bank Reconciliation'}
        </h1>
        <p className="text-lg text-gray-600">
          {isFirstReconciliation
            ? "We'll walk you through this step by step. It's easier than it sounds!"
            : "Let's make sure your records match your bank."}
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-700 font-semibold">?</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
                What is reconciliation?
                <HelpTooltip content="Reconciliation is the process of comparing your records with your bank's records to make sure they match." />
              </h2>
              <p className="text-gray-700">
                Reconciliation is just a fancy word for "making sure your records match the
                bank." Think of it as double-checking your work. You'll compare the
                transactions in Graceful Books with the transactions on your bank statement.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-success-100 rounded-full flex items-center justify-center">
              <span className="text-success-700 font-semibold">✓</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Why do this?</h2>
              <ul className="text-gray-700 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-success-600 mt-1">•</span>
                  <span>
                    <strong>Catch mistakes early:</strong> Find errors before they become
                    problems
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success-600 mt-1">•</span>
                  <span>
                    <strong>Spot missing transactions:</strong> Make sure nothing slipped
                    through the cracks
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success-600 mt-1">•</span>
                  <span>
                    <strong>Detect fraud:</strong> Notice unauthorized charges right away
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success-600 mt-1">•</span>
                  <span>
                    <strong>Trust your numbers:</strong> Know your financial reports are
                    accurate
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-info-100 rounded-full flex items-center justify-center">
              <span className="text-info-700 font-semibold">📋</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">What you'll need</h2>
              <p className="text-gray-700 mb-3">
                Before we start, make sure you have a bank statement ready. This can be:
              </p>
              <ul className="text-gray-700 space-y-1">
                <li className="flex items-center gap-2">
                  <span className="text-info-600">•</span>
                  <span>A CSV file downloaded from your bank (preferred)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-info-600">•</span>
                  <span>A PDF statement (coming soon)</span>
                </li>
              </ul>
            </div>
          </div>

          {isFirstReconciliation && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <p className="text-primary-900">
                <strong>First time?</strong> Don't worry! We'll guide you through every step.
                Most people find their first reconciliation takes about 15-20 minutes. After
                that, it usually takes 5-10 minutes. You've got this!
              </p>
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-between items-center pt-4">
        <Button variant="outline" onClick={onCancel}>
          Not Right Now
        </Button>
        <Button onClick={onContinue} className="px-8">
          Let's Get Started
        </Button>
      </div>
    </div>
  );
};
