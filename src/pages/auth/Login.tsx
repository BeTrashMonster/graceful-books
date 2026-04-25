/**
 * Login Page
 *
 * User authentication using email and password.
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const API_URL = 'https://api.audacious.money';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Login failed');
      }

      // Store user session
      sessionStorage.setItem(
        'graceful_books_session',
        JSON.stringify({
          token: data.data.token,
          user: data.data.user,
          products: data.data.products || [],
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
      );

      // Trigger auth context to reload
      window.dispatchEvent(new Event('graceful_books_login'));

      // Determine redirect based on user's products
      const products = data.data.products || [];
      const hasBookkeeping = products.some((p: any) => p.slug === 'bookkeeping-suite');
      const hasCPG = products.some((p: any) => p.slug === 'cpu-cpg-calculator');

      // If they were trying to access a specific page, go there
      const requestedPath = (location.state as { from?: { pathname: string } })?.from?.pathname;

      let redirectPath;
      if (requestedPath && requestedPath !== '/') {
        redirectPath = requestedPath;
      } else if (hasCPG && !hasBookkeeping) {
        // Only has CPG access → redirect to CPG dashboard
        redirectPath = '/cpg';
      } else if (hasBookkeeping) {
        // Has bookkeeping access → redirect to bookkeeping dashboard
        redirectPath = '/dashboard';
      } else {
        // No products or unknown products → redirect to dashboard (will show access denied if needed)
        redirectPath = '/dashboard';
      }

      navigate(redirectPath, { replace: true });
    } catch (err: any) {
      setError(getUserFriendlyError(err.message));
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
        background: '#4b006e',
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
            }}
          >
            Hello! Welcome Back!
          </h1>
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

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
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
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '2px solid #D4AF37',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label
                htmlFor="password"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#4b006e',
                }}
              >
                Password
              </label>
              <Link
                to="/forgot-password"
                style={{
                  fontSize: '0.75rem',
                  color: '#4b006e',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                Forgot Password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
                  color: showPassword ? '#a855f7' : '#6b7280',
                  transition: 'color 0.2s',
                }}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
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
            {isLoading ? 'Signing you in...' : "Let's Go!"}
          </button>
        </form>

        <div
          style={{
            marginTop: '1.5rem',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: '#4b5563',
          }}
        >
          <span>Don't have an account? </span>
          <Link
            to="/signup"
            style={{
              color: '#4b006e',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Create one here
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Convert error messages to user-friendly format (Steadiness style)
 */
function getUserFriendlyError(message: string): string {
  if (message.includes('Invalid email or password')) {
    return "That email or password doesn't seem to match what we have on file. Please double-check and try again. No worries - take your time.";
  }

  if (message.includes('not active')) {
    return 'Your account is not active. Please contact support for assistance.';
  }

  return "We couldn't sign you in right now. Please try again in a moment.";
}
