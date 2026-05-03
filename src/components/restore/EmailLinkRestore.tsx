/**
 * Email Link Restoration Component
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 5, Task 5.3:
 * Handles restoration from email backup links.
 *
 * User Flow:
 * 1. User pastes restoration link from email
 * 2. Validate URL format and extract tokens
 * 3. Prompt for password
 * 4. Fetch encrypted backup from server
 * 5. Decrypt and restore data
 * 6. Show success celebration
 */

import { useState, FormEvent, ChangeEvent } from 'react'
import { Button } from '../core/Button'
import { Card, CardHeader, CardBody, CardFooter } from '../ui/Card'
import styles from './EmailLinkRestore.module.css'

/**
 * Email Link Restore Props
 */
export interface EmailLinkRestoreProps {
  /**
   * Called when restoration is successful
   */
  onSuccess: () => void

  /**
   * Called when user wants to go back
   */
  onBack: () => void

  /**
   * Optional restoration service (for testing)
   */
  restorationService?: {
    validateRestorationLink: (link: string) => Promise<{ valid: boolean; error?: string }>
    restoreFromEmailLink: (link: string, password: string) => Promise<void>
  }
}

/**
 * Restoration flow step
 */
type RestoreStep = 'input-link' | 'input-password' | 'restoring' | 'success' | 'error'

/**
 * Email Link Restoration Component
 *
 * Joy Engineering: Clear guidance, encouraging messaging, celebration on success.
 *
 * @example
 * ```tsx
 * <EmailLinkRestore
 *   onSuccess={() => navigate('/dashboard')}
 *   onBack={() => navigate('/restore')}
 * />
 * ```
 */
export function EmailLinkRestore({
  onSuccess,
  onBack,
  restorationService,
}: EmailLinkRestoreProps) {
  const [step, setStep] = useState<RestoreStep>('input-link')
  const [restorationLink, setRestorationLink] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  /**
   * Validates restoration link format
   */
  const validateLinkFormat = (link: string): boolean => {
    try {
      const url = new URL(link)

      // Check if URL has required query parameters
      const hasToken = url.searchParams.has('token')
      const hasBackup = url.searchParams.has('backup')

      // Check if URL is from expected domain (localhost or production)
      const isValidDomain =
        url.hostname === 'localhost' ||
        url.hostname.includes('gracefulbooks.com') ||
        url.hostname.includes('audaciousmoney.com')

      return hasToken && hasBackup && isValidDomain
    } catch {
      return false
    }
  }

  /**
   * Handles link input submission
   */
  const handleLinkSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate link format
    if (!validateLinkFormat(restorationLink)) {
      setError('Invalid restoration link. Please check the link and try again.')
      return
    }

    setIsValidating(true)

    try {
      // Validate with server (if service provided)
      if (restorationService) {
        const result = await restorationService.validateRestorationLink(restorationLink)

        if (!result.valid) {
          setError(result.error || 'This restoration link is no longer valid.')
          setIsValidating(false)
          return
        }
      }

      // Move to password step
      setStep('input-password')
    } catch (err) {
      setError('Unable to validate restoration link. Please check your connection and try again.')
    } finally {
      setIsValidating(false)
    }
  }

  /**
   * Handles password submission and restoration
   */
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!password) {
      setError('Please enter your password')
      return
    }

    setIsRestoring(true)
    setStep('restoring')

    try {
      if (restorationService) {
        await restorationService.restoreFromEmailLink(restorationLink, password)
      } else {
        // Mock restoration for development
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      setStep('success')

      // Auto-navigate after celebration
      setTimeout(() => {
        onSuccess()
      }, 3000)
    } catch (err) {
      setStep('error')
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to restore your data. The password may be incorrect or the backup may be corrupted.'
      )
    } finally {
      setIsRestoring(false)
    }
  }

  /**
   * Handles retry after error
   */
  const handleRetry = () => {
    setError('')
    setStep('input-password')
  }

  /**
   * Render link input step
   */
  if (step === 'input-link') {
    return (
      <div className={styles.container}>
        <Card variant="elevated" padding="lg" className={styles.card}>
          <CardHeader>
            <h2 className={styles.title}>Paste Your Restoration Link 📧</h2>
            <p className={styles.subtitle}>
              Find the restoration link in your weekly backup email and paste it below.
            </p>
          </CardHeader>

          <CardBody>
            <form onSubmit={handleLinkSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="restoration-link" className={styles.label}>
                  Restoration Link
                </label>
                <input
                  id="restoration-link"
                  type="url"
                  value={restorationLink}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setRestorationLink(e.target.value)}
                  placeholder="https://app.gracefulbooks.com/restore?token=..."
                  className={styles.input}
                  required
                  autoFocus
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? 'link-error' : undefined}
                />
                {error && (
                  <p id="link-error" className={styles.error} role="alert">
                    {error}
                  </p>
                )}
                <p className={styles.hint}>
                  The link starts with https:// and includes a unique token
                </p>
              </div>

              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onBack}
                  disabled={isValidating}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={isValidating}
                  disabled={!restorationLink}
                >
                  {isValidating ? 'Validating...' : 'Continue'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    )
  }

  /**
   * Render password input step
   */
  if (step === 'input-password') {
    return (
      <div className={styles.container}>
        <Card variant="elevated" padding="lg" className={styles.card}>
          <CardHeader>
            <h2 className={styles.title}>Enter Your Password 🔑</h2>
            <p className={styles.subtitle}>
              Your data is encrypted. Enter your password to decrypt and restore it.
            </p>
          </CardHeader>

          <CardBody>
            <form onSubmit={handlePasswordSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="password" className={styles.label}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={styles.input}
                  required
                  autoFocus
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? 'password-error' : undefined}
                />
                {error && (
                  <p id="password-error" className={styles.error} role="alert">
                    {error}
                  </p>
                )}
                <p className={styles.hint}>
                  This is the password you use to log into Graceful Books
                </p>
              </div>

              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep('input-link')}
                  disabled={isRestoring}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={isRestoring}
                  disabled={!password}
                >
                  Restore My Data
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    )
  }

  /**
   * Render restoring step
   */
  if (step === 'restoring') {
    return (
      <div className={styles.container}>
        <Card variant="elevated" padding="lg" className={styles.card}>
          <CardBody>
            <div className={styles.loading}>
              <div className={styles.spinner} aria-hidden="true" />
              <h2 className={styles.loadingTitle}>Restoring Your Data...</h2>
              <p className={styles.loadingMessage}>
                Decrypting and importing your financial records. This may take a moment.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  /**
   * Render success step
   */
  if (step === 'success') {
    return (
      <div className={styles.container}>
        <Card variant="elevated" padding="lg" className={styles.card}>
          <CardBody>
            <div className={styles.success}>
              <div className={styles.celebration} aria-hidden="true">
                🎉
              </div>
              <h2 className={styles.successTitle}>Welcome Back!</h2>
              <p className={styles.successMessage}>
                Your data has been restored successfully. You're all set on your new device! 🎉
              </p>
              <Button variant="primary" onClick={onSuccess} className={styles.successButton}>
                Go to Dashboard
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  /**
   * Render error step
   */
  if (step === 'error') {
    return (
      <div className={styles.container}>
        <Card variant="elevated" padding="lg" className={styles.card}>
          <CardBody>
            <div className={styles.errorState}>
              <div className={styles.errorIcon} aria-hidden="true">
                ⚠️
              </div>
              <h2 className={styles.errorTitle}>Restoration Failed</h2>
              <p className={styles.errorMessage}>{error}</p>
              <div className={styles.actions}>
                <Button variant="ghost" onClick={onBack}>
                  Try Another Method
                </Button>
                <Button variant="primary" onClick={handleRetry}>
                  Try Again
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  return null
}
