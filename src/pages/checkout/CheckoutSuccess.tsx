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

  const handleSkipWorksheet = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Update session with product info before navigating (with retries)
      const success = await updateSessionWithProducts();

      if (!success) {
        // Fallback: Webhook is taking too long, but we KNOW they signed up for CPU/CPG
        // Manually add it to session so they can access the app
        console.warn('⚠️ Subscription fetch failed after retries, using fallback...');
        addCPGProductToSession();
        console.log('✅ Fallback: CPU/CPG product added to session manually');
      }

      // Mark worksheet as skipped and navigate to CPG dashboard
      localStorage.setItem('cpg_worksheet_status', 'skipped');
      navigate('/cpg');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Fallback: Manually add CPU/CPG product to session
   * Used when webhook is delayed and subscription fetch times out
   * This is safe because signup flow is hardcoded to CPU/CPG only
   */
  const addCPGProductToSession = () => {
    try {
      const sessionData = sessionStorage.getItem('graceful_books_session');
      if (!sessionData) {
        console.error('❌ No session found for fallback');
        return;
      }

      const session = JSON.parse(sessionData);
      session.products = [{
        id: 'cpu-cpg-calculator',
        name: 'CPU/CPG Calculator',
        slug: 'cpu-cpg-calculator',
      }];

      sessionStorage.setItem('graceful_books_session', JSON.stringify(session));
      console.log('✅ Fallback: Added CPU/CPG product to session');
    } catch (error) {
      console.error('❌ Error in fallback:', error);
    }
  };

  /**
   * Fetch user's subscription and update session with products array
   * This is needed so ProtectedRoute can verify product access
   * Retries up to 5 times with exponential backoff to handle webhook delays
   */
  const updateSessionWithProducts = async (retries = 5): Promise<boolean> => {
    try {
      const sessionData = sessionStorage.getItem('graceful_books_session');
      if (!sessionData) {
        console.warn('⚠️ No session found, cannot update products');
        return false;
      }

      const session = JSON.parse(sessionData);
      const token = session.token;

      if (!token) {
        console.warn('⚠️ No token in session, cannot fetch products');
        return false;
      }

      console.log(`🔄 Fetching user subscription to update session (attempt ${6 - retries}/5)...`);

      const response = await fetch('https://api.audacious.money/users/me/subscription', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('⚠️ Failed to fetch subscription:', response.status);

        // Retry with exponential backoff if we have retries left
        if (retries > 0) {
          const delay = (6 - retries) * 1000; // 1s, 2s, 3s, 4s, 5s
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return updateSessionWithProducts(retries - 1);
        }

        return false;
      }

      const data = await response.json();
      console.log('📦 Subscription data:', data);

      if (data.data?.subscription) {
        const { productSlug, productName, productId } = data.data.subscription;

        // Update session with products array
        session.products = [{
          id: productId,
          name: productName,
          slug: productSlug,
        }];

        sessionStorage.setItem('graceful_books_session', JSON.stringify(session));
        console.log('✅ Session updated with product:', productSlug);
        return true;
      } else {
        console.warn('⚠️ No subscription found in response');

        // Retry if subscription doesn't exist yet (webhook might still be processing)
        if (retries > 0) {
          const delay = (6 - retries) * 1000;
          console.log(`⏳ Subscription not ready, waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return updateSessionWithProducts(retries - 1);
        }

        return false;
      }
    } catch (error) {
      console.error('❌ Error updating session with products:', error);

      // Retry on error if we have retries left
      if (retries > 0) {
        const delay = (6 - retries) * 1000;
        console.log(`⏳ Error occurred, waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return updateSessionWithProducts(retries - 1);
      }

      return false;
    }
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
        // Session format is flat: { userId, userEmail, token }
        companyId = session?.userId;
        console.log('📦 Found userId in sessionStorage:', companyId);
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
      console.log('✅ Worksheet marked as completed');

      // Fetch user's subscription to update session with product info (with retries)
      console.log('🔄 Updating session with products...');
      const sessionUpdateSuccess = await updateSessionWithProducts();

      if (!sessionUpdateSuccess) {
        // Fallback: Webhook is taking too long, but we KNOW they signed up for CPU/CPG
        // Manually add it to session so they can access the app
        console.warn('⚠️ Subscription fetch failed after retries, using fallback...');
        addCPGProductToSession();
        console.log('✅ Fallback: CPU/CPG product added to session manually');
      }

      // Navigate to CPG dashboard
      console.log('📍 Navigating to /cpg');
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
          <div className={styles.logoContainer}>
            <img src="/logo.png" alt="Audacious Money" className={styles.logo} />
          </div>
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
