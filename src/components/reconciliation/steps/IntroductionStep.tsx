/**
 * Introduction Step
 *
 * Educational introduction to reconciliation for first-time users.
 */

import { Button } from '../../core/Button';
import { Card } from '../../ui/Card';

interface IntroductionStepProps {
  isFirstReconciliation: boolean;
  accountName: string;
  onNext: () => void;
  onCancel: () => void;
}

export function IntroductionStep({
  isFirstReconciliation,
  accountName,
  onNext,
  onCancel,
}: IntroductionStepProps) {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card className="p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">
            {isFirstReconciliation
              ? 'Your First Reconciliation!'
              : `Reconcile ${accountName}`}
          </h1>
          <p className="text-lg text-gray-600">
            {isFirstReconciliation
              ? 'This is how you make sure everything matches.'
              : 'Let\'s make sure your records match your bank statement.'}
          </p>
        </div>

        <div className="space-y-6 mb-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              What is reconciliation?
            </h2>
            <p className="text-gray-700 leading-relaxed">
              Reconciliation is like balancing your checkbook. You're comparing your bank's
              record of transactions with your own records to make sure they match. This
              helps you catch errors, detect fraud, and keep your books accurate.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              What you'll need
            </h2>
            <ul className="space-y-2">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span className="text-gray-700">
                  A bank statement for <strong>{accountName}</strong> (PDF or CSV format)
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span className="text-gray-700">
                  About 10-15 minutes (we'll guide you through each step)
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              How it works
            </h2>
            <ol className="space-y-2">
              <li className="flex items-start">
                <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  1
                </span>
                <span className="text-gray-700">
                  Upload your bank statement
                </span>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  2
                </span>
                <span className="text-gray-700">
                  We'll automatically match most transactions for you
                </span>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  3
                </span>
                <span className="text-gray-700">
                  Review the matches and handle any differences
                </span>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                  4
                </span>
                <span className="text-gray-700">
                  Celebrate when you're balanced!
                </span>
              </li>
            </ol>
          </div>
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={onCancel}
          >
            Maybe Later
          </Button>
          <Button
            variant="primary"
            onClick={onNext}
          >
            Let's Get Started
          </Button>
        </div>
      </Card>
    </div>
  );
}
