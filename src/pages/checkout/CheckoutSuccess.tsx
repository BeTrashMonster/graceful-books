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
import { useAuth } from '../../contexts/AuthContext';
import { getDeviceId } from '../../utils/device';
import styles from './CheckoutSuccess.module.css';

type OnboardingStep = 'processing' | 'success' | 'charity' | 'backup' | 'worksheet' | 'complete';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { companyId: authCompanyId, userIdentifier } = useAuth();
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
    console.log('🎯 CheckoutSuccess handleWorksheetComplete called');
    console.log('📊 Auth companyId:', authCompanyId);
    console.log('📊 Auth userIdentifier:', userIdentifier);
    console.log('📦 Worksheet data received:', worksheetData);

    // Try to get company ID from auth hook, or fall back to session storage
    let companyId = authCompanyId;

    if (!companyId) {
      console.log('⚠️ No companyId from auth hook, checking sessionStorage...');
      const sessionData = sessionStorage.getItem('graceful_books_session');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        // Backend returns user.id which IS the company_id
        companyId = session?.user?.id;
        console.log('📦 Found user.id in sessionStorage:', companyId);
      }
    }

    if (!companyId) {
      console.error('❌ No company_id found anywhere');
      console.log('🔍 Full sessionStorage data:', sessionStorage.getItem('graceful_books_session'));
      setError('User session not found. Please refresh the page and try again.');
      return;
    }

    console.log('✅ Using company_id:', companyId);

    setIsSubmitting(true);
    setError(null);

    try {
      const deviceId = getDeviceId();
      console.log('🔑 Device ID:', deviceId);

      // Import worksheet data into database
      console.log('📥 Calling importWorksheetData...');
      const result = await importWorksheetData(
        worksheetData,
        companyId,
        deviceId
      );

      console.log('📊 Import result:', result);

      if (!result.success) {
        console.error('❌ Import failed:', result.errors);
        setError(`Failed to import data: ${result.errors.join(', ')}`);
        return;
      }

      // Mark worksheet as completed
      localStorage.setItem('cpg_worksheet_status', 'completed');
      console.log('✅ Worksheet marked as completed, navigating to /cpg');

      // Navigate to CPG dashboard
      navigate('/cpg');
    } catch (error) {
      console.error('💥 Exception in handleWorksheetComplete:', error);
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
          {error && <div className={styles.error}>{error}</div>}
          <ComprehensiveWorksheet
            onComplete={handleWorksheetComplete}
            onSkip={handleSkipWorksheet}
          />
        </div>
      )}
    </div>
  );
}
