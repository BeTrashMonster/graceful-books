import { Link, useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import styles from './Signup.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function BetaSignup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  // Real-time password validation
  const passwordRequirements = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    };
  }, [password]);

  const passwordsMatch = useMemo(() => {
    if (!confirmPassword) return true; // Don't show error if confirm is empty
    return password === confirmPassword;
  }, [password, confirmPassword]);

  const allRequirementsMet = Object.values(passwordRequirements).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark fields as touched for validation display
    setPasswordTouched(true);
    setConfirmPasswordTouched(true);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please make sure both passwords are identical.');
      return;
    }

    // Validate password requirements
    if (!allRequirementsMet) {
      setError('Password does not meet all requirements. Please check the requirements below.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call beta signup API
      const response = await fetch(`${API_URL}/auth/beta-signup`, {
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
        throw new Error(data.error?.message || 'Signup failed');
      }

      // Store session data in sessionStorage (same format as Login)
      sessionStorage.setItem(
        'graceful_books_session',
        JSON.stringify({
          token: data.data.token,
          user: data.data.user,
          products: [
            {
              id: data.data.cpgProduct.id,
              name: data.data.cpgProduct.name,
              slug: 'cpu-cpg-calculator',
              status: 'active',
            }
          ],
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
      );

      // Store user info
      localStorage.setItem(
        'graceful_books_user',
        JSON.stringify({
          userIdentifier: data.data.user.email,
          supportKey: data.data.user.supportKey,
          isBetaTester: true,
        })
      );

      // Trigger auth context to reload (same as Login)
      window.dispatchEvent(new Event('graceful_books_login'));

      // Redirect to onboarding setup (includes backup location)
      navigate('/onboarding/setup');
    } catch (err: any) {
      console.error('Beta signup error:', err);
      setError(
        err.message || 'Something unexpected happened. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logoContainer}>
          <img
            src="/assets/audacious-logo.png"
            alt="Audacious Money"
            className={styles.logo}
          />
        </div>

        <div className={styles.header}>
          <h1 className={styles.title}>Join the Beta</h1>
          <p className={styles.subtitle}>
            Be among the first to explore as you build your money confidence
          </p>
        </div>

        {error && (
          <div className={styles.errorAlert} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.nameRow}>
            <div className={styles.formGroup}>
              <label htmlFor="firstName" className={styles.label}>
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="lastName" className={styles.label}>
                Last Name
              </label>
              <input
                type="text"
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="companyName" className={styles.label}>
              Company Name
            </label>
            <input
              type="text"
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <div className={styles.passwordGroup}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setPasswordTouched(true)}
                required
                className={styles.passwordInput}
                style={{
                  borderColor: passwordTouched && !allRequirementsMet ? '#dc2626' : undefined,
                  borderWidth: passwordTouched && !allRequirementsMet ? '2px' : undefined,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={styles.togglePassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>

            {/* Password Requirements Checklist */}
            {password && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                backgroundColor: passwordTouched && !allRequirementsMet ? '#fef2f2' : '#f9fafb',
                borderRadius: '6px',
                border: passwordTouched && !allRequirementsMet ? '1px solid #fecaca' : '1px solid #e5e7eb',
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                  Password must have:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                    <span style={{ color: passwordRequirements.minLength ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                      {passwordRequirements.minLength ? '✓' : '✗'}
                    </span>
                    <span style={{ color: passwordRequirements.minLength ? '#16a34a' : '#6b7280' }}>
                      At least 8 characters
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                    <span style={{ color: passwordRequirements.hasUppercase ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                      {passwordRequirements.hasUppercase ? '✓' : '✗'}
                    </span>
                    <span style={{ color: passwordRequirements.hasUppercase ? '#16a34a' : '#6b7280' }}>
                      One uppercase letter (A-Z)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                    <span style={{ color: passwordRequirements.hasLowercase ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                      {passwordRequirements.hasLowercase ? '✓' : '✗'}
                    </span>
                    <span style={{ color: passwordRequirements.hasLowercase ? '#16a34a' : '#6b7280' }}>
                      One lowercase letter (a-z)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                    <span style={{ color: passwordRequirements.hasNumber ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                      {passwordRequirements.hasNumber ? '✓' : '✗'}
                    </span>
                    <span style={{ color: passwordRequirements.hasNumber ? '#16a34a' : '#6b7280' }}>
                      One number (0-9)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                    <span style={{ color: passwordRequirements.hasSpecial ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                      {passwordRequirements.hasSpecial ? '✓' : '✗'}
                    </span>
                    <span style={{ color: passwordRequirements.hasSpecial ? '#16a34a' : '#6b7280' }}>
                      One special character (!@#$%^&*)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Confirm Password
            </label>
            <div className={styles.passwordGroup}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setConfirmPasswordTouched(true)}
                required
                className={styles.passwordInput}
                style={{
                  borderColor: confirmPasswordTouched && !passwordsMatch ? '#dc2626' : undefined,
                  borderWidth: confirmPasswordTouched && !passwordsMatch ? '2px' : undefined,
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className={styles.togglePassword}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>

            {/* Password Mismatch Error */}
            {confirmPasswordTouched && confirmPassword && !passwordsMatch && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.625rem 0.75rem',
                backgroundColor: '#fef2f2',
                borderRadius: '6px',
                border: '1px solid #fecaca',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <span style={{ color: '#dc2626', fontWeight: 'bold', fontSize: '1rem' }}>✗</span>
                <span style={{ color: '#dc2626', fontSize: '0.8125rem', fontWeight: 500 }}>
                  Passwords do not match
                </span>
              </div>
            )}

            {/* Password Match Success */}
            {confirmPasswordTouched && confirmPassword && passwordsMatch && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.625rem 0.75rem',
                backgroundColor: '#f0fdf4',
                borderRadius: '6px',
                border: '1px solid #bbf7d0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '1rem' }}>✓</span>
                <span style={{ color: '#16a34a', fontSize: '0.8125rem', fontWeight: 500 }}>
                  Passwords match
                </span>
              </div>
            )}
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isLoading}
          >
            {isLoading ? 'Creating Your Account...' : 'Get Free Access'}
          </button>
        </form>

        <div className={styles.footer}>
          <span className={styles.footerText}>
            Already have an account?{' '}
          </span>
          <Link to="/login" className={styles.footerLink}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
