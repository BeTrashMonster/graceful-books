/**
 * Checkout Cancel Page
 *
 * Displayed when user cancels the Stripe checkout
 */

import { useNavigate } from 'react-router-dom';

export default function CheckoutCancel() {
  const navigate = useNavigate();

  const handleTryAgain = () => {
    // Get the selected product and navigate back to signup
    const userData = localStorage.getItem('graceful_books_user');

    if (userData) {
      const { selectedProduct } = JSON.parse(userData);
      navigate(`/signup?product=${selectedProduct}`);
    } else {
      navigate('/signup');
    }
  };

  const handleContactSupport = () => {
    // Get support key from localStorage
    const userData = localStorage.getItem('graceful_books_user');

    if (userData) {
      const { supportKey } = JSON.parse(userData);
      alert(
        `Your support key is: ${supportKey}\n\nPlease email support@audacious.money with this key and we'll help you get set up.`
      );
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
        <div
          style={{
            fontSize: '3rem',
            marginBottom: '1rem',
          }}
        >
          😕
        </div>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            marginBottom: '1rem',
            color: 'var(--color-text-primary, #111827)',
          }}
        >
          Checkout Cancelled
        </h1>
        <p
          style={{
            color: 'var(--color-text-secondary, #6b7280)',
            marginBottom: '2rem',
            lineHeight: 1.6,
          }}
        >
          No worries! Your account has been created but your subscription wasn't
          activated. You can try again whenever you're ready.
        </p>
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={handleTryAgain}
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
            Try Again
          </button>
          <button
            onClick={handleContactSupport}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary, #6b7280)',
              border: '1px solid var(--color-border, #e5e7eb)',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}
