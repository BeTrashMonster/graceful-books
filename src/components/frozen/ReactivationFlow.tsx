/**
 * ReactivationFlow Component
 *
 * PURPOSE:
 * Orchestrates the complete reactivation process:
 * 1. Charity confirmation (CharityConfirmation component)
 * 2. Stripe Pricing Table for plan selection and payment
 *
 * FLOW:
 * FrozenStateBanner/Modal → ReactivationFlow opens → User confirms charity →
 * Stripe Pricing Table → User selects plan and pays → Stripe webhook handles subscription
 *
 * HANDLES:
 * - Workshop trial expiration → new subscription
 * - Regular subscription trial expiration → new subscription
 * - Subscription cancelled → resume or new subscription
 *
 * @module components/frozen/ReactivationFlow
 */

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../modals/Modal';
import { useFrozenState } from '../../contexts/FrozenStateContext';
import { useAuth } from '../../contexts/AuthContext';
import { CharityConfirmation } from './CharityConfirmation';
import { StripePricingTable } from './StripePricingTable';
import styles from './ReactivationFlow.module.css';

// =============================================================================
// TYPES
// =============================================================================

type FlowStep = 'charity' | 'processing' | 'pricing' | 'error';

interface ReactivationFlowProps {
  /** Override the open state (by default uses context) */
  isOpen?: boolean;
  /** Override the close handler */
  onClose?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ReactivationFlow({
  isOpen: isOpenProp,
  onClose: onCloseProp
}: ReactivationFlowProps = {}) {
  const {
    isFrozen,
    frozenReason,
    workshopEnrollment,
    isReactivationFlowOpen,
    closeReactivationFlow,
  } = useFrozenState();

  // Note: AuthContext uses companyId for userId and userIdentifier for email
  const { companyId: userId, userIdentifier: userEmail } = useAuth();

  const [step, setStep] = useState<FlowStep>('charity');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use props or context for open state
  const isOpen = isOpenProp ?? isReactivationFlowOpen;
  const handleClose = onCloseProp ?? closeReactivationFlow;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('charity');
      setIsProcessing(false);
      setError(null);
    }
  }, [isOpen]);

  // Listen for start-reactivation-flow event from FrozenStateModal
  useEffect(() => {
    const handleStartFlow = () => {
      setStep('charity');
      setError(null);
    };

    window.addEventListener('start-reactivation-flow', handleStartFlow);
    return () => window.removeEventListener('start-reactivation-flow', handleStartFlow);
  }, []);

  /**
   * Handle charity confirmation and proceed to pricing table
   */
  const handleCharityConfirmed = useCallback(async (charityId: string) => {
    setIsProcessing(true);
    setError(null);
    setStep('processing');

    try {
      // Dynamically import to avoid circular dependencies
      const { saveCharitySelection } = await import('../../services/reactivation.api');

      // Save charity selection
      await saveCharitySelection({ charityId });

      // Show Stripe Pricing Table
      setStep('pricing');
      setIsProcessing(false);
    } catch (err: any) {
      console.error('[ReactivationFlow] Error saving charity:', err);

      // Check if we're in debug mode - provide helpful message
      const isDebugMode = window.location.search.includes('debug_frozen');
      if (isDebugMode) {
        setError(
          'Debug Mode: The charity save endpoint is not available. ' +
          'Proceeding to Pricing Table anyway for testing.'
        );
        // In debug mode, still show pricing table
        setStep('pricing');
        setIsProcessing(false);
      } else {
        setError(err.message || 'Unable to process your request. Please try again.');
        setStep('error');
        setIsProcessing(false);
      }
    }
  }, []);

  /**
   * Go back from pricing table to charity selection
   */
  const handleBackToCharity = useCallback(() => {
    setStep('charity');
  }, []);

  /**
   * Retry after error
   */
  const handleRetry = useCallback(() => {
    setStep('charity');
    setError(null);
  }, []);

  // Don't render if not frozen
  if (!isFrozen || !frozenReason) {
    return null;
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size={step === 'pricing' ? 'xl' : 'lg'}
      showCloseButton={step !== 'processing'}
      closeOnBackdropClick={step !== 'processing'}
      closeOnEscape={step !== 'processing'}
    >
      {/* Step 1: Charity Confirmation */}
      {step === 'charity' && (
        <CharityConfirmation
          onContinue={handleCharityConfirmed}
          onCancel={handleClose}
          isLoading={isProcessing}
        />
      )}

      {/* Step 2: Processing */}
      {step === 'processing' && (
        <div className={styles.processingContainer}>
          <div className={styles.spinner} aria-hidden="true" />
          <h2 className={styles.processingTitle}>Saving Your Selection</h2>
          <p className={styles.processingMessage}>
            Just a moment...
          </p>
        </div>
      )}

      {/* Step 3: Stripe Pricing Table */}
      {step === 'pricing' && (
        <StripePricingTable
          userEmail={userEmail || undefined}
          userId={userId || undefined}
          onBack={handleBackToCharity}
        />
      )}

      {/* Error State */}
      {step === 'error' && (() => {
        const isDebugMode = window.location.search.includes('debug_frozen');
        return (
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {isDebugMode ? (
                <>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </>
              )}
            </svg>
          </div>
          <h2 className={styles.errorTitle}>
            {isDebugMode ? 'Debug Mode Notice' : 'Something Went Wrong'}
          </h2>
          <p className={styles.errorMessage}>{error}</p>
          <div className={styles.errorActions}>
            <button
              type="button"
              className={styles.retryButton}
              onClick={handleRetry}
            >
              Try Again
            </button>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={handleClose}
            >
              Cancel
            </button>
          </div>
        </div>
        );
      })()}
    </Modal>
  );
}
