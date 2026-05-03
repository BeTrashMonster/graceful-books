/**
 * Checkout Success Page
 *
 * Displayed after successful payment via Stripe
 * Includes post-payment onboarding: charity selection and CPG worksheet
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CharitySelector } from '../../components/charity';
import { BackupLocationSetup } from '../../components/onboarding/BackupLocationSetup';
import { ComprehensiveWorksheet } from '../../components/onboarding/ComprehensiveWorksheet';
import type { Charity } from '../../types/database.types';
import { selectCharity } from '../../services/charities.api';
import { importWorksheetData } from '../../services/cpg/worksheetImporter.service';
import { useAuth } from '../../hooks/useAuth';
import { getDeviceId } from '../../utils/device';
import styles from './CheckoutSuccess.module.css';

type OnboardingStep = 'processing' | 'success' | 'charity' | 'backup' | 'worksheet' | 'complete';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
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
      setStep('backup');
    } catch (err) {
      console.error('Failed to save charity selection:', err);
      setError(err instanceof Error ? err.message : 'Failed to save charity selection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipCharity = async () => {
    setStep('backup');
  };

  const handleBackupComplete = (directoryPath: string) => {
    console.log('Backup location selected:', directoryPath);
    setStep('worksheet');
  };

  const handleSkipBackup = () => {
    console.log('Backup location setup skipped');
    setStep('worksheet');
  };

  const handleSkipWorksheet = () => {
    // Mark worksheet as skipped and navigate to CPG dashboard
    localStorage.setItem('cpg_worksheet_status', 'skipped');
    navigate('/cpg');
  };

  const handleWorksheetComplete = async (worksheetData: any) => {
    if (!user?.company_id) {
      setError('User not found. Please log in again.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const deviceId = getDeviceId();

      // Import worksheet data into database
      const result = await importWorksheetData(
        worksheetData,
        user.company_id,
        deviceId
      );

      if (!result.success) {
        setError(`Failed to import data: ${result.errors.join(', ')}`);
        return;
      }

      // Mark worksheet as completed
      localStorage.setItem('cpg_worksheet_status', 'completed');

      // Navigate to CPG dashboard
      navigate('/cpg');
    } catch (error) {
      console.error('Failed to import worksheet data:', error);
      setError(error instanceof Error ? error.message : 'Failed to save worksheet data');
    } finally {
      setIsSubmitting(false);
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

      {step === 'backup' && (
        <div className={styles.wideCard}>
          <BackupLocationSetup
            onComplete={handleBackupComplete}
            onSkip={handleSkipBackup}
            isOnboarding={true}
          />
        </div>
      )}

      {step === 'worksheet' && (
        <div className={styles.wideCard}>
          <ComprehensiveWorksheet
            onComplete={handleWorksheetComplete}
            onSkip={handleSkipWorksheet}
          />
        </div>
      )}
    </div>
  );
}
