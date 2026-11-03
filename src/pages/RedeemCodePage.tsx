/**
 * RedeemCodePage
 *
 * Public page for redeeming lifetime access codes.
 * Handles both new user signup and existing user login flows.
 *
 * URL: /redeem?code=XXXXX
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config/api';
import styles from './RedeemCodePage.module.css';

interface CodeInfo {
  name: string;
  products: Array<{
    name: string;
    slug: string;
  }>;
  expiresAt: string | null;
}

type Step = 'loading' | 'invalid' | 'choice' | 'signup' | 'login' | 'success';

export default function RedeemCodePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code') || '';

  const [step, setStep] = useState<Step>('loading');
  const [codeInfo, setCodeInfo] = useState<CodeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Signup form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Success state
  const [requiresWorksheet, setRequiresWorksheet] = useState(false);

  // Validate code on mount
  const validateCode = useCallback(async () => {
    if (!code) {
      setStep('invalid');
      setError('No redemption code provided');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/redeem/${code}/info`);
      const data = await response.json();

      if (!response.ok) {
        setStep('invalid');
        setError(data.error?.message || 'Invalid or expired code');
        return;
      }

      setCodeInfo(data.data);
      setStep('choice');
    } catch (err) {
      setStep('invalid');
      setError('Unable to validate code. Please try again.');
    }
  }, [code]);

  useEffect(() => {
    validateCode();
  }, [validateCode]);

  // Handle signup form submission
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email || !password || !firstName || !lastName) {
      setError('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/redeem/${code}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          companyName: companyName || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Failed to create account');
        setIsSubmitting(false);
        return;
      }

      // Store auth token
      if (data.data.token) {
        localStorage.setItem('graceful_books_token', data.data.token);
        localStorage.setItem('graceful_books_user', JSON.stringify(data.data.user));
      }

      setRequiresWorksheet(data.data.requiresWorksheet || false);
      setStep('success');
    } catch (err) {
      setError('Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle login form submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }

    setIsSubmitting(true);

    try {
      // First login
      const loginResponse = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        setError(loginData.error?.message || 'Invalid email or password');
        setIsSubmitting(false);
        return;
      }

      const token = loginData.data.token;

      // Then claim the code
      const claimResponse = await fetch(`${API_URL}/api/redeem/${code}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const claimData = await claimResponse.json();

      if (!claimResponse.ok) {
        setError(claimData.error?.message || 'Failed to redeem code');
        setIsSubmitting(false);
        return;
      }

      // Store auth token
      localStorage.setItem('graceful_books_token', token);
      localStorage.setItem('graceful_books_user', JSON.stringify(loginData.data.user));

      setRequiresWorksheet(claimData.data.requiresWorksheet || false);
      setStep('success');
    } catch (err) {
      setError('Failed to login. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle continue after success
  const handleContinue = () => {
    if (requiresWorksheet) {
      navigate('/workshops/worksheet');
    } else {
      // Navigate based on first product
      const firstProduct = codeInfo?.products[0];
      if (firstProduct?.slug === 'cpu-cpg-calculator') {
        navigate('/cpg');
      } else {
        navigate('/dashboard');
      }
    }
  };

  // Render loading state
  if (step === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Validating your access code...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render invalid code state
  if (step === 'invalid') {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={styles.errorState}>
              <h1 className={styles.errorTitle}>Invalid Code</h1>
              <p className={styles.errorMessage}>
                {error || 'This code is invalid, expired, or has reached its maximum number of redemptions.'}
              </p>
              <p className={styles.errorHint}>
                If you believe this is an error, please contact support.
              </p>
              <Link to="/login" className={styles.linkButton}>
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render success state
  if (step === 'success') {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={styles.successState}>
              <div className={styles.successIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h1 className={styles.successTitle}>Access Granted!</h1>
              <p className={styles.successMessage}>
                You now have lifetime access to:
              </p>
              <ul className={styles.productList}>
                {codeInfo?.products.map((product) => (
                  <li key={product.slug}>{product.name}</li>
                ))}
              </ul>
              {requiresWorksheet && (
                <p className={styles.worksheetNote}>
                  To get started, you'll need to complete a quick setup worksheet.
                </p>
              )}
              <button
                type="button"
                className={styles.continueButton}
                onClick={handleContinue}
              >
                {requiresWorksheet ? 'Continue to Worksheet' : 'Go to Dashboard'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render choice or form
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.card}>
          {/* Header */}
          <div className={styles.header}>
            <h1 className={styles.title}>Redeem Access Code</h1>
            {codeInfo && (
              <div className={styles.codeInfo}>
                <p className={styles.codeName}>{codeInfo.name}</p>
                <p className={styles.accessTo}>Grants lifetime access to:</p>
                <ul className={styles.productBadges}>
                  {codeInfo.products.map((product) => (
                    <li key={product.slug} className={styles.productBadge}>
                      {product.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {/* Choice step */}
          {step === 'choice' && (
            <div className={styles.choiceContainer}>
              <p className={styles.choiceText}>
                Do you have an existing account?
              </p>
              <div className={styles.choiceButtons}>
                <button
                  type="button"
                  className={styles.choiceButton}
                  onClick={() => setStep('signup')}
                >
                  <span className={styles.choiceButtonTitle}>I'm New</span>
                  <span className={styles.choiceButtonDesc}>Create an account</span>
                </button>
                <button
                  type="button"
                  className={styles.choiceButton}
                  onClick={() => setStep('login')}
                >
                  <span className={styles.choiceButtonTitle}>I Have an Account</span>
                  <span className={styles.choiceButtonDesc}>Login to claim</span>
                </button>
              </div>
            </div>
          )}

          {/* Signup form */}
          {step === 'signup' && (
            <form onSubmit={handleSignup} className={styles.form}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    First Name <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={styles.input}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Last Name <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={styles.input}
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Email <span className={styles.required}>*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Password <span className={styles.required}>*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                  minLength={8}
                  required
                />
                <p className={styles.hint}>At least 8 characters</p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Confirm Password <span className={styles.required}>*</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.backButton}
                  onClick={() => setStep('choice')}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          )}

          {/* Login form */}
          {step === 'login' && (
            <form onSubmit={handleLogin} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Email <span className={styles.required}>*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Password <span className={styles.required}>*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.backButton}
                  onClick={() => setStep('choice')}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Redeeming...' : 'Login & Redeem'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
