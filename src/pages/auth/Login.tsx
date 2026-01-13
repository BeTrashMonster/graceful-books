/**
 * Login Page
 *
 * Passphrase-based authentication using zero-knowledge architecture.
 * Uses the auth module for secure login and the component library for accessibility.
 */

import { useState, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Input } from '../../components/forms/Input'
import { Button } from '../../components/core/Button'
import { login, storePassphraseTestData, createPassphraseTestData } from '../../auth/login'
import type { LoginResponse } from '../../auth/types'
import { logger } from '../../utils/logger'

const authLogger = logger.child('Auth')

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()

  // Form state
  const [companyId, setCompanyId] = useState('')
  const [userIdentifier, setUserIdentifier] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [rememberDevice, setRememberDevice] = useState(false)

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // For demo: Create test data if none exists
  const ensureTestData = useCallback(async () => {
    const testDataKey = `passphrase-test-${companyId}`
    if (!localStorage.getItem(testDataKey) && companyId) {
      // For demo purposes, create test data with the entered passphrase
      // In production, this would be created during signup
      const testData = await createPassphraseTestData(passphrase, companyId)
      await storePassphraseTestData(testData)
      authLogger.debug('Created test passphrase data for demo')
    }
  }, [companyId, passphrase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Ensure test data exists (demo only - remove in production)
      await ensureTestData()

      // Generate a basic device fingerprint
      const deviceFingerprint = `${navigator.userAgent}-${screen.width}x${screen.height}`

      // Attempt login using the auth module
      const response: LoginResponse = await login({
        passphrase,
        companyId,
        userIdentifier,
        rememberDevice,
        deviceFingerprint,
      })

      if (response.success) {
        // Store session data
        sessionStorage.setItem('graceful_books_session', JSON.stringify({
          token: response.token,
          expiresAt: response.expiresAt,
          userIdentifier,
          companyId,
        }))

        // Store device token if requested
        if (response.deviceToken) {
          localStorage.setItem('graceful_books_device_token', response.deviceToken)
        }

        // Store user info for protected routes
        localStorage.setItem('graceful_books_user', JSON.stringify({
          userIdentifier,
          companyId,
        }))

        authLogger.info('Login successful', { userIdentifier, companyId })

        // Redirect to the page they were trying to access, or dashboard
        const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'
        navigate(from, { replace: true })
      } else {
        // Show user-friendly error message
        setError(getUserFriendlyError(response.errorCode, response.error))
        authLogger.warn('Login failed', { errorCode: response.errorCode })
      }
    } catch (err) {
      authLogger.error('Login error', err)
      setError("We couldn't sign you in right now. Please try again in a moment.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>Welcome to Graceful Books</h1>
          <p>Sign in to your account. Take your time - we'll guide you through.</p>
        </div>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <Input
            label="Company ID"
            type="text"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            required
            fullWidth
            helperText="The unique identifier for your company"
            autoComplete="organization"
          />

          <Input
            label="Email"
            type="email"
            value={userIdentifier}
            onChange={(e) => setUserIdentifier(e.target.value)}
            required
            fullWidth
            autoComplete="email"
          />

          <Input
            label="Passphrase"
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            required
            fullWidth
            helperText="Your secret passphrase - never share this with anyone"
            autoComplete="current-password"
          />

          <div className="auth-checkbox">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
              />
              <span>Remember this device for 30 days</span>
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={isLoading}
            disabled={isLoading}
          >
            {isLoading ? 'Signing you in...' : 'Sign In'}
          </Button>
        </form>

        <div className="auth-footer">
          <span>Don't have an account? </span>
          <Link to="/signup">Create one here</Link>
        </div>
      </div>

      <style>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--color-background, #f9fafb);
          padding: 1rem;
        }

        .auth-container {
          width: 100%;
          max-width: 420px;
          background-color: var(--color-surface, #ffffff);
          padding: 2rem;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .auth-header h1 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: var(--color-text-primary, #111827);
        }

        .auth-header p {
          color: var(--color-text-secondary, #6b7280);
          font-size: 0.875rem;
        }

        .auth-error {
          background-color: var(--color-error-light, #fef2f2);
          border: 1px solid var(--color-error, #dc2626);
          color: var(--color-error-dark, #991b1b);
          padding: 0.75rem 1rem;
          border-radius: 0.375rem;
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .auth-checkbox {
          display: flex;
          align-items: center;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--color-text-secondary, #6b7280);
        }

        .checkbox-label input[type="checkbox"] {
          width: 1rem;
          height: 1rem;
          cursor: pointer;
        }

        .auth-footer {
          margin-top: 1.5rem;
          text-align: center;
          font-size: 0.875rem;
          color: var(--color-text-secondary, #6b7280);
        }

        .auth-footer a {
          color: var(--color-primary, #3b82f6);
          text-decoration: none;
        }

        .auth-footer a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}

/**
 * Convert error codes to user-friendly messages (Steadiness style)
 */
function getUserFriendlyError(
  errorCode?: string,
  defaultMessage?: string
): string {
  switch (errorCode) {
    case 'INVALID_PASSPHRASE':
      return "That passphrase doesn't seem to match what we have on file. Please double-check and try again. No worries - take your time."

    case 'RATE_LIMITED':
      return "We've noticed a few unsuccessful attempts. For your security, please wait a few minutes before trying again. Your account is safe."

    case 'ACCOUNT_LOCKED':
      return "Your account has been temporarily locked for security. Please contact support or wait 15 minutes to try again."

    default:
      return defaultMessage || "Something unexpected happened. Please try again, and if this continues, let us know."
  }
}
