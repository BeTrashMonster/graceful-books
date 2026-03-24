import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { CharitySelector } from '../../components/charity';
import type { Charity } from '../../types/database.types';
import { signup } from '../../services/auth.api';

type SignupStep = 'credentials' | 'charity';

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<SignupStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [selectedCharity, setSelectedCharity] = useState<Charity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    // Move to charity selection step
    setStep('charity');
  };

  const handleCharitySelect = (charity: Charity) => {
    setSelectedCharity(charity);
  };

  const handleCompleteSignup = async () => {
    if (!selectedCharity) {
      alert('Please select a charity to support');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call backend API to create account
      const response = await signup({
        email,
        password,
        firstName,
        lastName,
        companyName: companyName || undefined,
        charityId: selectedCharity.id,
      });

      // Store session data
      sessionStorage.setItem(
        'graceful_books_session',
        JSON.stringify({
          token: response.token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          userEmail: response.user.email,
          userId: response.user.id,
        })
      );

      // Store user info for protected routes
      localStorage.setItem(
        'graceful_books_user',
        JSON.stringify({
          userIdentifier: response.user.email,
          supportKey: response.user.supportKey,
          charityId: selectedCharity.id,
          charityName: selectedCharity.name,
        })
      );

      // Redirect to onboarding
      navigate('/onboarding');
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(
        err.message || 'Something unexpected happened. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep('credentials');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-background, #f9fafb)',
        padding: '1rem',
      }}
    >
      {step === 'credentials' ? (
        <div
          style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: 'var(--color-surface, #ffffff)',
            padding: '2rem',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                marginBottom: '0.5rem',
              }}
            >
              Create Your Account
            </h1>
            <p
              style={{
                color: 'var(--color-text-secondary, #6b7280)',
                fontSize: '0.875rem',
              }}
            >
              Start your journey with Graceful Books
            </p>
          </div>

          {error && (
            <div
              style={{
                backgroundColor: 'var(--color-error-light, #fef2f2)',
                border: '1px solid var(--color-error, #dc2626)',
                color: 'var(--color-error-dark, #991b1b)',
                padding: '0.75rem 1rem',
                borderRadius: '0.375rem',
                marginBottom: '1.5rem',
                fontSize: '0.875rem',
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleCredentialsSubmit}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="firstName"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--color-border, #e5e7eb)',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="lastName"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--color-border, #e5e7eb)',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
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
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--color-border, #e5e7eb)',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="companyName"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Company Name (Optional)
              </label>
              <input
                type="text"
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--color-border, #e5e7eb)',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--color-border, #e5e7eb)',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="confirmPassword"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--color-border, #e5e7eb)',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'var(--color-primary, #3b82f6)',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Continue
            </button>
          </form>

          <div
            style={{
              marginTop: '1.5rem',
              textAlign: 'center',
              fontSize: '0.875rem',
            }}
          >
            <span style={{ color: 'var(--color-text-secondary, #6b7280)' }}>
              Already have an account?{' '}
            </span>
            <Link
              to="/login"
              style={{
                color: 'var(--color-primary, #3b82f6)',
                textDecoration: 'none',
              }}
            >
              Sign in
            </Link>
          </div>
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            maxWidth: '1200px',
            backgroundColor: 'var(--color-surface, #ffffff)',
            padding: '2rem',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          }}
        >
          <CharitySelector
            selectedCharityId={selectedCharity?.id}
            onSelect={handleCharitySelect}
            showSearch
            showFilters
          />

          <div
            style={{
              display: 'flex',
              gap: '1rem',
              marginTop: '2rem',
              justifyContent: 'space-between',
            }}
          >
            <button
              onClick={handleBack}
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
              Back
            </button>
            <button
              onClick={handleCompleteSignup}
              disabled={!selectedCharity || isLoading}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor:
                  selectedCharity && !isLoading
                    ? 'var(--color-primary, #3b82f6)'
                    : 'var(--color-border, #e5e7eb)',
                color:
                  selectedCharity && !isLoading
                    ? 'white'
                    : 'var(--color-text-secondary, #6b7280)',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor:
                  selectedCharity && !isLoading ? 'pointer' : 'not-allowed',
              }}
            >
              {isLoading ? 'Creating Your Account...' : 'Create Account'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
