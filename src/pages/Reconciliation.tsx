/**
 * Reconciliation Page
 *
 * Main page for bank reconciliation featuring the guided wizard.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ReconciliationWizard } from '../components/reconciliation';
import { Loading } from '../components/feedback/Loading';
import { ErrorMessage } from '../components/feedback/ErrorMessage';
import { Button } from '../components/core/Button';
import { Card } from '../components/ui/Card';
import { getAccount, hasCompletedReconciliation } from '../store';

export default function Reconciliation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get('accountId');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountName, setAccountName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [isFirstReconciliation, setIsFirstReconciliation] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!accountId) {
        setError('No account selected. Please select an account to reconcile.');
        setIsLoading(false);
        return;
      }

      try {
        // Load account details
        const accountResult = await getAccount(accountId);

        if (!accountResult.success) {
          setError('We could not find that account. Please try again.');
          setIsLoading(false);
          return;
        }

        const account = accountResult.data;
        setAccountName(account.name || 'Unknown Account');
        setCompanyId(account.companyId);

        // Check if this is the first reconciliation
        const hasCompleted = await hasCompletedReconciliation(account.companyId);
        setIsFirstReconciliation(!hasCompleted);

        setIsLoading(false);
      } catch (err) {
        setError('Something went wrong loading the reconciliation page.');
        setIsLoading(false);
      }
    };

    loadData();
  }, [accountId]);

  const handleStartReconciliation = () => {
    setShowWizard(true);
  };

  const handleComplete = () => {
    navigate('/transactions?message=Reconciliation completed successfully!');
  };

  const handleCancel = () => {
    navigate('/transactions');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <ErrorMessage message={error} />
        <Button onClick={() => navigate('/transactions')} className="mt-4">
          Back to Transactions
        </Button>
      </div>
    );
  }

  if (!showWizard) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card className="p-8 text-center">
          <h1 className="text-3xl font-semibold text-gray-900 mb-4">
            Reconcile {accountName}
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Ready to reconcile your account? We'll guide you through the process step by
            step.
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleStartReconciliation}>
              Start Reconciliation
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <ReconciliationWizard
        accountId={accountId!}
        accountName={accountName}
        companyId={companyId}
        isFirstReconciliation={isFirstReconciliation}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </div>
  );
}
