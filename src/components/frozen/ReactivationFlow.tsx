/**
 * ReactivationFlow Component
 *
 * PURPOSE:
 * Orchestrates the complete reactivation process:
 * 1. Charity confirmation (CharityConfirmation component)
 * 2. Redirect to Stripe Checkout for payment
 *
 * FLOW:
 * FrozenStateBanner/Modal → ReactivationFlow opens → User confirms charity →
 * Redirect to Stripe → Stripe redirects back on success/cancel
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
import { CharityConfirmation } from './CharityConfirmation';
import styles from './ReactivationFlow.module.css';

// =============================================================================
// TYPES
// =============================================================================

type FlowStep = 'charity' | 'processing' | 'error';

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
   * Handle charity confirmation and proceed to payment
   */
  const handleCharityConfirmed = useCallback(async (charityId: string) => {
    setIsProcessing(true);
    setError(null);
    setStep('processing');

    try {
      // Dynamically import to avoid circular dependencies
      const { createReactivationCheckout } = await import('../../services/reactivation.api');

      // Create checkout session
      const result = await createReactivationCheckout({
        charityId,
        workshopId: workshopEnrollment?.workshopId,
      });

      // Redirect to Stripe Checkout
      window.location.href = result.url;
    } catch (err: any) {
      console.error('[ReactivationFlow] Error creating checkout:', err);

      // Check if we're in debug mode - provide helpful message
      const isDebugMode = window.location.search.includes('debug_frozen');
      if (isDebugMode) {
        setError(
          'Debug Mode: The payment endpoint (/subscriptions/reactivate) is not implemented yet. ' +
          'In production, this will redirect to Stripe Checkout. ' +
          'The charity selection flow is working correctly!'
        );
      } else {
        setError(err.message || 'Unable to process your request. Please try again.');
      }
      setStep('error');
      setIsProcessing(false);
    }
  }, [workshopEnrollment]);

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

  // Purple header style for charity selection step
  const charityHeaderStyle = step === 'charity' ? {
    background: 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)',
    color: '#ffffff',
    textAlign: 'center' as const,
    padding: '1.5rem 2rem',
    borderBottom: 'none',
  } : undefined;

  // Title changes based on step - two lines, centered
  const modalTitle = step === 'charity'
    ? "They said it would trickle down.\nIt didn't."
    : undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      title={modalTitle}
      headerStyle={charityHeaderStyle}
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

      {/* Step 2: Processing / Redirecting */}
      {step === 'processing' && (
        <div className={styles.processingContainer}>
          <div className={styles.spinner} aria-hidden="true" />
          <h2 className={styles.processingTitle}>Setting Up Your Subscription</h2>
          <p className={styles.processingMessage}>
            Redirecting you to our secure payment page...
          </p>
        </div>
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
