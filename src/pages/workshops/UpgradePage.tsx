/**
 * Upgrade Page
 *
 * Subscription upgrade page for workshop participants.
 * Integrates with Stripe for payment processing.
 *
 * Features:
 * - Trial summary (what they accomplished)
 * - Subscription options
 * - Stripe payment integration
 * - Success confirmation
 * - Responsive design
 * - WCAG 2.1 AA compliance
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import styles from './UpgradePage.module.css';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface WorkshopEnrollment {
  id: string;
  workshopId: string;
  workshopName: string;
  enrolledAt: string;
  trialStartedAt: string;
  trialExpiresAt: string;
  charityName?: string;
}

function UpgradeForm() {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();

  const [enrollment, setEnrollment] = useState<WorkshopEnrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
      console.error('[UpgradePage] Error loading enrollment:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !enrollment) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Get the CardElement
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Create payment method
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (stripeError) {
        throw new Error(stripeError.message || 'Payment method creation failed');
      }

      // Process upgrade via API
      const response = await fetch(`/api/workshops/enrollments/${enrollment.id}/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Upgrade failed');
      }

      const result = await response.json();

      console.log('[UpgradePage] Upgrade successful:', result);
      setSuccess(true);

      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      console.error('[UpgradePage] Error processing upgrade:', err);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <p>Loading your upgrade options...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className={styles.successState}>
        <div className={styles.successIcon}>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1>Welcome to Audacious Money!</h1>
        <p>Your subscription is now active. Redirecting you to the dashboard...</p>
      </div>
    );
  }

  return (
    <div className={styles.formContainer}>
      {/* Trial Summary */}
      <div className={styles.summary}>
        <h2>Your Journey So Far</h2>
        <div className={styles.summaryCard}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Workshop Completed</span>
            <span className={styles.summaryValue}>{enrollment?.workshopName}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Started</span>
            <span className={styles.summaryValue}>
              {enrollment?.enrolledAt ? new Date(enrollment.enrolledAt).toLocaleDateString() : 'N/A'}
            </span>
          </div>
          {enrollment?.charityName && (
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Supporting</span>
              <span className={styles.summaryValue}>{enrollment.charityName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Subscription Plan */}
      <div className={styles.planSection}>
        <h2>Continue Your Journey</h2>
        <div className={styles.planCard}>
          <div className={styles.planHeader}>
            <h3>Audacious Money</h3>
            <div className={styles.planPrice}>
              <span className={styles.currency}>$</span>
              <span className={styles.amount}>99</span>
              <span className={styles.period}>/month</span>
            </div>
          </div>
          <ul className={styles.planFeatures}>
            <li>Full platform access</li>
            <li>Complete accounting tools</li>
            <li>Product cost calculator</li>
            <li>Beautiful financial reports</li>
            <li>$5/month to your chosen charity</li>
          </ul>
        </div>
      </div>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className={styles.paymentForm}>
        <h2>Payment Information</h2>

        <div className={styles.cardElementWrapper}>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#1f2937',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  '::placeholder': {
                    color: '#9ca3af',
                  },
                },
                invalid: {
                  color: '#ef4444',
                },
              },
            }}
          />
        </div>

        {error && (
          <div className={styles.errorMessage} role="alert">
            {error}
          </div>
        )}

        <button type="submit" disabled={!stripe || processing} className={styles.submitButton}>
          {processing ? 'Processing...' : 'Start Subscription'}
        </button>

        <p className={styles.secureNote}>
          🔒 Your payment information is encrypted and secure. We use Stripe for processing.
        </p>
      </form>

      {/* What Happens Next */}
      <div className={styles.timeline}>
        <h2>What Happens Next</h2>
        <ol className={styles.timelineList}>
          <li>
            <strong>Instant Access:</strong> Your subscription starts immediately
          </li>
          <li>
            <strong>Full Features:</strong> All tools and reports become available
          </li>
          <li>
            <strong>Charity Support:</strong> $5 of your payment goes to {enrollment?.charityName || 'your chosen charity'} each month
          </li>
          <li>
            <strong>Cancel Anytime:</strong> You're in control – no long-term commitment required
          </li>
        </ol>
      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <h1>Upgrade Your Account</h1>
          <p>Continue building your financial confidence with full platform access</p>
        </div>

        <Elements stripe={stripePromise}>
          <UpgradeForm />
        </Elements>
      </div>
    </div>
  );
}
