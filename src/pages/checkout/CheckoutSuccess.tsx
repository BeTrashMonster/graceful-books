/**
 * Checkout Success Page
 *
 * Displayed after successful payment via Stripe
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    console.log('[CheckoutSuccess] Component mounted');
    console.log('[CheckoutSuccess] Current URL:', window.location.href);
    console.log('[CheckoutSuccess] Search params:', searchParams.toString());

    const sessionId = searchParams.get('session_id');
    console.log('[CheckoutSuccess] session_id from URL:', sessionId);

    if (!sessionId) {
      console.error('[CheckoutSuccess] No session_id in URL');
      setIsProcessing(false);
      return;
    }

    console.log('[CheckoutSuccess] Waiting 2 seconds for webhook processing...');

    // Give the webhook a moment to process
    setTimeout(() => {
      console.log('[CheckoutSuccess] Processing complete, ready to continue');
      setIsProcessing(false);
    }, 2000);
  }, [searchParams]);

  const handleContinue = () => {
    // Navigate to onboarding or dashboard based on product
    const userData = localStorage.getItem('graceful_books_user');

    console.log('[CheckoutSuccess] handleContinue called');
    console.log('[CheckoutSuccess] userData from localStorage:', userData);

    if (userData) {
      const parsed = JSON.parse(userData);
      const { selectedProduct } = parsed;

      console.log('[CheckoutSuccess] Parsed userData:', parsed);
      console.log('[CheckoutSuccess] selectedProduct:', selectedProduct);

      // Route based on selected product slug
      if (selectedProduct === 'cpu-cpg-calculator') {
        console.log('[CheckoutSuccess] Routing CPG user to /cpg/dashboard');
        navigate('/cpg/dashboard');
      } else if (selectedProduct === 'bookkeeping-suite' || selectedProduct === 'fractional-cfo') {
        console.log('[CheckoutSuccess] Routing bookkeeping/CFO user to /onboarding/assessment');
        navigate('/onboarding/assessment');
      } else {
        console.log('[CheckoutSuccess] Routing other product user to /dashboard');
        navigate('/dashboard');
      }
    } else {
      console.log('[CheckoutSuccess] No userData found, routing to /dashboard');
      navigate('/dashboard');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '1rem',
        backgroundColor: 'var(--color-background, #f9fafb)',
      }}
    >
      <div
        style={{
          maxWidth: '32rem',
          width: '100%',
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
        }}
      >
        {isProcessing ? (
          <>
            <div
              style={{
                fontSize: '3rem',
                marginBottom: '1rem',
              }}
            >
              ⏳
            </div>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                marginBottom: '1rem',
                color: 'var(--color-text-primary, #111827)',
              }}
            >
              Processing Your Payment
            </h1>
            <p
              style={{
                color: 'var(--color-text-secondary, #6b7280)',
                marginBottom: '2rem',
                lineHeight: 1.6,
              }}
            >
              Please wait while we confirm your payment and activate your
              subscription...
            </p>
          </>
        ) : (
          <>
            <div
              style={{
                fontSize: '3rem',
                marginBottom: '1rem',
              }}
            >
              🎉
            </div>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                marginBottom: '1rem',
                color: 'var(--color-text-primary, #111827)',
              }}
            >
              Payment Successful!
            </h1>
            <p
              style={{
                color: 'var(--color-text-secondary, #6b7280)',
                marginBottom: '2rem',
                lineHeight: 1.6,
              }}
            >
              Thank you for your purchase! Your subscription is now active and
              you can start using all the features.
            </p>
            <button
              onClick={handleContinue}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'var(--color-primary, #3b82f6)',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Continue to Your Account
            </button>
          </>
        )}
      </div>
    </div>
  );
}
