/**
 * Reconciliation Wizard Component
 *
 * Guided first-time reconciliation experience with statement upload,
 * step-by-step matching, and educational context.
 */

import { useState, useCallback } from 'react';
import type {
  ParsedStatement,
  ReconciliationStep,
  TransactionMatch,
  ReconciliationWizardState,
} from '../../types/reconciliation.types';
import { IntroductionStep } from './steps/IntroductionStep';
import { UploadStatementStep } from './steps/UploadStatementStep';
import { ReviewMatchesStep } from './steps/ReviewMatchesStep';
import { SummaryStep } from './steps/SummaryStep';
import { logger } from '../../utils/logger';

interface ReconciliationWizardProps {
  accountId: string;
  accountName: string;
  companyId: string;
  isFirstReconciliation: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

export function ReconciliationWizard({
  accountId,
  accountName,
  companyId,
  isFirstReconciliation,
  onComplete,
  onCancel,
}: ReconciliationWizardProps) {
  const [state, setState] = useState<ReconciliationWizardState>({
    currentStep: 'INTRODUCTION',
    accountId,
    statement: null,
    matches: [],
    confirmedMatches: new Set(),
    rejectedMatches: new Set(),
    manualMatches: new Map(),
    isFirstReconciliation,
    canProgress: true,
  });

  // Handle moving to next step
  const handleNext = useCallback(() => {
    const stepOrder: ReconciliationStep[] = [
      'INTRODUCTION',
      'UPLOAD_STATEMENT',
      'REVIEW_MATCHES',
      'SUMMARY',
    ];

    const currentIndex = stepOrder.indexOf(state.currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setState(prev => ({
        ...prev,
        currentStep: stepOrder[currentIndex + 1],
      }));
    }
  }, [state.currentStep]);

  // Handle moving to previous step
  const handleBack = useCallback(() => {
    const stepOrder: ReconciliationStep[] = [
      'INTRODUCTION',
      'UPLOAD_STATEMENT',
      'REVIEW_MATCHES',
      'SUMMARY',
    ];

    const currentIndex = stepOrder.indexOf(state.currentStep);
    if (currentIndex > 0) {
      setState(prev => ({
        ...prev,
        currentStep: stepOrder[currentIndex - 1],
      }));
    }
  }, [state.currentStep]);

  // Handle statement upload and parsing
  const handleStatementParsed = useCallback(
    (statement: ParsedStatement, matches: TransactionMatch[]) => {
      logger.info('Statement parsed and matched', {
        transactionCount: statement.transactions.length,
        matchCount: matches.length,
      });

      setState(prev => ({
        ...prev,
        statement,
        matches,
        unmatchedStatementIds: statement.transactions
          .filter(t => !matches.find(m => m.statementTransactionId === t.id))
          .map(t => t.id),
        unmatchedSystemIds: [],
      }));

      handleNext();
    },
    [handleNext]
  );

  // Handle match confirmation
  const handleMatchConfirmed = useCallback((matchId: string) => {
    setState(prev => {
      const newConfirmed = new Set(prev.confirmedMatches);
      const newRejected = new Set(prev.rejectedMatches);

      newConfirmed.add(matchId);
      newRejected.delete(matchId);

      return {
        ...prev,
        confirmedMatches: newConfirmed,
        rejectedMatches: newRejected,
      };
    });
  }, []);

  // Handle match rejection
  const handleMatchRejected = useCallback((matchId: string) => {
    setState(prev => {
      const newConfirmed = new Set(prev.confirmedMatches);
      const newRejected = new Set(prev.rejectedMatches);

      newRejected.add(matchId);
      newConfirmed.delete(matchId);

      return {
        ...prev,
        confirmedMatches: newConfirmed,
        rejectedMatches: newRejected,
      };
    });
  }, []);

  // Handle manual match
  const handleManualMatch = useCallback(
    (statementTxId: string, systemTxId: string) => {
      setState(prev => {
        const newManualMatches = new Map(prev.manualMatches);
        newManualMatches.set(statementTxId, systemTxId);

        return {
          ...prev,
          manualMatches: newManualMatches,
        };
      });
    },
    []
  );

  // Render current step
  const renderStep = () => {
    switch (state.currentStep) {
      case 'INTRODUCTION':
        return (
          <IntroductionStep
            isFirstReconciliation={isFirstReconciliation}
            accountName={accountName}
            onNext={handleNext}
            onCancel={onCancel}
          />
        );

      case 'UPLOAD_STATEMENT':
        return (
          <UploadStatementStep
            accountId={accountId}
            companyId={companyId}
            onStatementParsed={handleStatementParsed}
            onBack={handleBack}
            onCancel={onCancel}
          />
        );

      case 'REVIEW_MATCHES':
        return (
          <ReviewMatchesStep
            statement={state.statement!}
            matches={state.matches}
            confirmedMatches={state.confirmedMatches}
            rejectedMatches={state.rejectedMatches}
            manualMatches={state.manualMatches}
            onMatchConfirmed={handleMatchConfirmed}
            onMatchRejected={handleMatchRejected}
            onManualMatch={handleManualMatch}
            onNext={handleNext}
            onBack={handleBack}
          />
        );

      case 'SUMMARY':
        return (
          <SummaryStep
            accountId={accountId}
            companyId={companyId}
            statement={state.statement!}
            matches={state.matches}
            confirmedMatches={state.confirmedMatches}
            manualMatches={state.manualMatches}
            isFirstReconciliation={isFirstReconciliation}
            onComplete={onComplete}
            onBack={handleBack}
          />
        );

      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <div className="reconciliation-wizard">
      {renderStep()}
    </div>
  );
}
