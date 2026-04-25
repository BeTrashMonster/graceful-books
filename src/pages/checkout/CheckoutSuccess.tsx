/**
 * Checkout Success Page
 *
 * Displayed after successful payment via Stripe
 * Includes post-payment onboarding: charity selection and CPG worksheet
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CharitySelector } from '../../components/charity';
import { QuickProductSetup } from '../../components/onboarding/QuickProductSetup';
import type { Charity } from '../../types/database.types';
import { selectCharity } from '../../services/charities.api';
import styles from './CheckoutSuccess.module.css';

type OnboardingStep = 'processing' | 'success' | 'charity' | 'worksheet' | 'complete';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<OnboardingStep>('processing');
  const [selectedCharityId, setSelectedCharityId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      console.error('No session_id in URL');
      setStep('success');
      return;
    }

    // Give the webhook a moment to process
    setTimeout(() => {
      setStep('success');
    }, 2000);
  }, [searchParams]);

  const handleStartOnboarding = () => {
    setStep('charity');
  };

  const handleCharitySelect = (charity: Charity) => {
    setSelectedCharityId(charity.id);
  };

  const handleCharitySubmit = async () => {
    if (!selectedCharityId) {
      setError('Please select a charity to continue');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await selectCharity(selectedCharityId);
      setStep('worksheet');
    } catch (err) {
      console.error('Failed to save charity selection:', err);
      setError(err instanceof Error ? err.message : 'Failed to save charity selection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipCharity = async () => {
    setStep('worksheet');
  };

  const handleWorksheetComplete = () => {
    // This checkout flow is specifically for CPG Costing Tool signup
    // Always navigate to CPG dashboard
    navigate('/cpg/dashboard');
  };

  const handleSkipWorksheet = () => {
    // Mark worksheet as skipped
    localStorage.setItem('cpg_worksheet_status', 'skipped');
    handleWorksheetComplete();
  };

  const handleProductsSubmit = async (products: any[]) => {
    try {
      // TODO: Add API call to save products
      // For now, store in localStorage
      localStorage.setItem('cpg_initial_products', JSON.stringify(products));
      localStorage.setItem('cpg_worksheet_status', 'completed');

      handleWorksheetComplete();
    } catch (error) {
      console.error('Failed to save products:', error);
      setError(error instanceof Error ? error.message : 'Failed to save products');
    }
  };

  return (
    <div className={styles.container}>
      {step === 'processing' && (
        <div className={styles.card}>
          <div className={styles.icon}>⏳</div>
          <h1 className={styles.title}>Processing Your Payment</h1>
          <p className={styles.description}>
            Please wait while we confirm your payment and activate your subscription...
          </p>
        </div>
      )}

      {step === 'success' && (
        <div className={styles.card}>
          <div className={styles.icon}>🎉</div>
          <h1 className={styles.title}>Payment Successful!</h1>
          <p className={styles.description}>
            Thank you for your purchase! Your subscription is now active.
            Let's complete a few quick steps to get you started.
          </p>
          <button onClick={handleStartOnboarding} className={styles.primaryButton}>
            Get Started
          </button>
        </div>
      )}

      {step === 'charity' && (
        <div className={styles.wideCard}>
          <CharitySelector
            selectedCharityId={selectedCharityId}
            onSelect={handleCharitySelect}
            showSearch={false}
            showFilters={false}
          />

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actionButtons}>
            <button
              onClick={handleSkipCharity}
              className={styles.secondaryButton}
              disabled={isSubmitting}
            >
              Skip for Now
            </button>
            <button
              onClick={handleCharitySubmit}
              className={styles.primaryButton}
              disabled={!selectedCharityId || isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Continue'}
            </button>
          </div>
        </div>
      )}

      {step === 'worksheet' && (
        <div className={styles.wideCard}>
          <QuickProductSetup
            onComplete={handleProductsSubmit}
            onSkip={handleSkipWorksheet}
          />
        </div>
      )}
    </div>
  );
}
