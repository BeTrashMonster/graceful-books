/**
 * Trial Expired Page
 *
 * Shown to workshop participants when their trial period has ended
 * and the post_trial_action is 'upgrade_prompt'.
 *
 * Features:
 * - Clear messaging about trial expiration
 * - Benefits of upgrading
 * - Pricing information
 * - Upgrade button (links to UpgradePage)
 * - Contact support option
 * - Celebratory messaging about workshop completion
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './TrialExpiredPage.module.css';

interface WorkshopEnrollment {
  id: string;
  workshopId: string;
  workshopName: string;
  enrolledAt: string;
  trialStartedAt: string;
  trialExpiresAt: string;
  status: string;
}

export default function TrialExpiredPage() {
  const navigate = useNavigate();
  const [enrollment, setEnrollment] = useState<WorkshopEnrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEnrollmentData();
  }, []);

  const loadEnrollmentData = async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('/api/workshops/my-enrollment', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load enrollment data');
      }

      const data = await response.json();
      setEnrollment(data.enrollment);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load enrollment data';
      setError(message);
      console.error('[TrialExpiredPage] Error loading enrollment:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeClick = () => {
    navigate('/workshops/upgrade');
  };

  const handleContactSupport = () => {
    window.location.href = 'mailto:support@audaciousmoney.com?subject=Workshop Trial Expired';
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <h1>Oops! Something unexpected happened</h1>
          <p>{error}</p>
          <button onClick={() => navigate('/dashboard')} className={styles.secondaryButton}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Header Section */}
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <svg
              className={styles.clockIcon}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className={styles.title}>Your Free Trial Has Ended</h1>
          <p className={styles.subtitle}>
            But your journey with Audacious Money is just beginning!
          </p>
        </div>

        {/* Celebration Section */}
        <div className={styles.celebration}>
          <h2>Look at what you've accomplished! ✨</h2>
          <p>
            You completed the <strong>{enrollment?.workshopName || 'workshop'}</strong> and took
            the first steps toward understanding your business finances. That's something to
            celebrate!
          </p>
        </div>

        {/* Benefits Section */}
        <div className={styles.benefits}>
          <h2>Continue Your Journey</h2>
          <p className={styles.benefitsIntro}>
            Upgrading to a paid subscription gives you continued access to:
          </p>

          <ul className={styles.benefitsList}>
            <li>
              <svg
                className={styles.checkIcon}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>All your financial data, safely encrypted and accessible anytime</span>
            </li>
            <li>
              <svg className={styles.checkIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Complete accounting features to track income, expenses, and profits</span>
            </li>
            <li>
              <svg className={styles.checkIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Beautiful reports that help you make confident business decisions</span>
            </li>
            <li>
              <svg className={styles.checkIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Tools to calculate what your products really cost to make</span>
            </li>
            <li>
              <svg className={styles.checkIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>$5/month automatically goes to the charity you selected</span>
            </li>
          </ul>
        </div>

        {/* Pricing Section */}
        <div className={styles.pricing}>
          <h2>Simple, Transparent Pricing</h2>
          <div className={styles.priceCard}>
            <div className={styles.priceAmount}>
              <span className={styles.currency}>$</span>
              <span className={styles.amount}>99</span>
              <span className={styles.period}>/month</span>
            </div>
            <p className={styles.priceDescription}>
              Full access to all features. Cancel anytime. $5 of your subscription goes to your
              chosen charity each month.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className={styles.actions}>
          <button onClick={handleUpgradeClick} className={styles.upgradeButton}>
            Upgrade Now
          </button>
          <button onClick={handleContactSupport} className={styles.secondaryButton}>
            Contact Support
          </button>
        </div>

        {/* Reassurance Section */}
        <div className={styles.reassurance}>
          <p>
            Take your time with this decision. We're here to support you every step of the way.
            If you have any questions or need help deciding, our team is happy to chat.
          </p>
        </div>
      </div>
    </div>
  );
}
