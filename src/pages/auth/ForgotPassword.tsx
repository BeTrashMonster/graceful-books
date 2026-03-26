/**
 * Forgot Password Page
 *
 * Request password reset link via email.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = 'https://api.audacious.money';

export default function ForgotPassword() {
  // Form state
  const [email, setEmail] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Request failed');
      }

      setSuccess(true);
    } catch (err: any) {
      setError("We couldn't send the reset link right now. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #4b006e 0%, #6d28d9 100%)',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: '#ffffff',
          padding: '2rem',
          borderRadius: '0.5rem',
          boxShadow: '0 8px 24px rgba(75, 0, 110, 0.3)',
          border: '2px solid #D4AF37',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src="/assets/audacious-logo.png"
            alt="Audacious Money"
            style={{
              width: '180px',
              height: 'auto',
              marginBottom: '1.5rem',
            }}
          />
          <h1
            style={{
              fontSize: '1.875rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #4b006e 0%, #6d28d9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '0.5rem',
            }}
          >
            Forgot Your Password?
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            No worries! Enter your email and we'll send you a reset link.
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '0.75rem',
              marginBottom: '1rem',
              backgroundColor: '#fee2e2',
              border: '2px solid #dc2626',
              borderRadius: '0.375rem',
              color: '#dc2626',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {success ? (
          <div>
            <div
              style={{
                padding: '1rem',
                marginBottom: '1.5rem',
                backgroundColor: '#d1fae5',
                border: '2px solid #10b981',
                borderRadius: '0.375rem',
                color: '#065f46',
                fontSize: '0.875rem',
              }}
            >
              <strong>Check your email!</strong>
              <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                If that email address is in our system, we sent you a link to reset your password.
                Please check your inbox (and spam folder, just in case).
              </p>
            </div>
            <Link
              to="/login"
              style={{
                display: 'block',
                width: '100%',
                padding: '0.75rem',
                background: 'linear-gradient(135deg, #E8D4A0 0%, #D4AF37 50%, #B8860B 100%)',
                color: '#2d1b00',
                border: '1px solid #B8860B',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                textAlign: 'center',
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(184, 134, 11, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
              }}
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#4b006e',
                }}
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '2px solid #D4AF37',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: isLoading ? '#9ca3af' : 'linear-gradient(135deg, #E8D4A0 0%, #D4AF37 50%, #B8860B 100%)',
                color: isLoading ? '#ffffff' : '#2d1b00',
                border: isLoading ? 'none' : '1px solid #B8860B',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: isLoading ? 'none' : '0 2px 8px rgba(184, 134, 11, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
              }}
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div
          style={{
            marginTop: '1.5rem',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: '#4b5563',
          }}
        >
          <span>Remember your password? </span>
          <Link
            to="/login"
            style={{
              color: '#4b006e',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
}
