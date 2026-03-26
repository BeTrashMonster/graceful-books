/**
 * Reset Password Page
 *
 * Set a new password using the token from the email link.
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

const API_URL = 'https://api.audacious.money';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // If no token, redirect to forgot password page
    if (!token) {
      navigate('/forgot-password');
    }
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords don't match. Please try again.");
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Password reset failed');
      }

      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      if (err.message.includes('expired') || err.message.includes('invalid')) {
        setError(err.message);
      } else {
        setError("We couldn't reset your password right now. Please try again or request a new reset link.");
      }
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
            Set New Password
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Choose a strong password for your account.
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
              <strong>Password reset successful!</strong>
              <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                Your password has been updated. Redirecting you to login...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#4b006e',
                }}
              >
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    paddingRight: '2.5rem',
                    border: '2px solid #D4AF37',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    fontSize: '1.25rem',
                  }}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="confirmPassword"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#4b006e',
                }}
              >
                Confirm New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Re-enter your password"
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
              {isLoading ? 'Resetting...' : 'Reset Password'}
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
          <Link
            to="/login"
            style={{
              color: '#4b006e',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
