/**
 * Sync Relay Restoration Component
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 5, Task 5.5:
 * Handles restoration from encrypted sync relay.
 *
 * User Flow:
 * 1. User enters sync relay URL (or uses default)
 * 2. User enters login credentials
 * 3. Connect to relay and authenticate
 * 4. Fetch encrypted data from relay
 * 5. Decrypt and restore data
 * 6. Show success celebration
 *
 * Joy Engineering: "All your devices, always in sync ⚡"
 */

import { useState, ChangeEvent, FormEvent } from 'react'
import { Button } from '../core/Button'
import { Card, CardHeader, CardBody } from '../ui/Card'
import styles from './SyncRelayRestore.module.css'

/**
 * Sync Relay Restore Props
 */
export interface SyncRelayRestoreProps {
  /**
   * Called when restoration is successful
   */
  onSuccess: () => void

  /**
   * Called when user wants to go back
   */
  onBack: () => void

  /**
   * Default relay URL (optional)
   */
  defaultRelayUrl?: string

  /**
   * Optional restoration service (for testing)
   */
  restorationService?: {
    connectToRelay: (url: string, email: string, password: string) => Promise<void>
    fetchAndRestoreData: (password: string) => Promise<void>
  }
}

/**
 * Restoration flow step
 */
type RestoreStep = 'input-credentials' | 'connecting' | 'restoring' | 'success' | 'error'

/**
 * Sync Relay Restoration Component
 *
 * @example
 * ```tsx
 * <SyncRelayRestore
 *   onSuccess={() => navigate('/dashboard')}
 *   onBack={() => navigate('/restore')}
 *   defaultRelayUrl="wss://sync.gracefulbooks.com"
 * />
 * ```
 */
export function SyncRelayRestore({
  onSuccess,
  onBack,
  defaultRelayUrl = 'wss://sync.gracefulbooks.com',
  restorationService,
}: SyncRelayRestoreProps) {
  const [step, setStep] = useState<RestoreStep>('input-credentials')
  const [relayUrl, setRelayUrl] = useState(defaultRelayUrl)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [useCustomRelay, setUseCustomRelay] = useState(false)
  const [error, setError] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [_isRestoring, setIsRestoring] = useState(false)

  /**
   * Validates relay URL format
   */
  const validateRelayUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'wss:' || parsed.protocol === 'ws:'
    } catch {
      return false
    }
  }

  /**
   * Handles credentials submission
   */
  const handleCredentialsSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate inputs
    if (!email || !password) {
      setError('Please enter your email and password')
      return
    }

    if (useCustomRelay && !validateRelayUrl(relayUrl)) {
      setError('Invalid relay URL. Must start with wss:// or ws://')
      return
    }

    setIsConnecting(true)
    setStep('connecting')

    try {
      // Connect to relay
      if (restorationService) {
        await restorationService.connectToRelay(relayUrl, email, password)
      } else {
        // Mock connection for development
        await new Promise(resolve => setTimeout(resolve, 1500))
      }

      // Move to restoring step
      setIsRestoring(true)
      setStep('restoring')

      // Fetch and restore data
      if (restorationService) {
        await restorationService.fetchAndRestoreData(password)
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
          : 'Unable to connect to sync relay. Please check your credentials and try again.'
      )
    } finally {
      setIsConnecting(false)
      setIsRestoring(false)
    }
  }

  /**
   * Handles retry after error
   */
  const handleRetry = () => {
    setError('')
    setStep('input-credentials')
  }

  /**
   * Render credentials input step
   */
  if (step === 'input-credentials') {
    return (
      <div className={styles.container}>
        <Card variant="elevated" padding="lg" className={styles.card}>
          <CardHeader>
            <h2 className={styles.title}>Connect to Sync Relay 🔄</h2>
            <p className={styles.subtitle}>
              Enter your credentials to sync from your encrypted cloud storage.
            </p>
          </CardHeader>

          <CardBody>
            <form onSubmit={handleCredentialsSubmit}>
              {/* Relay URL Selection */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Sync Relay</label>
                <div className={styles.relaySelection}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      checked={!useCustomRelay}
                      onChange={() => {
                        setUseCustomRelay(false)
                        setRelayUrl(defaultRelayUrl)
                      }}
                      className={styles.radio}
                    />
                    <span>Graceful Books (Official) - Recommended</span>
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      checked={useCustomRelay}
                      onChange={() => setUseCustomRelay(true)}
                      className={styles.radio}
                    />
                    <span>Self-Hosted Relay</span>
                  </label>
                </div>

                {useCustomRelay && (
                  <input
                    type="url"
                    value={relayUrl}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setRelayUrl(e.target.value)}
                    placeholder="wss://your-relay.example.com"
                    className={styles.input}
                    required
                    aria-label="Custom relay URL"
                  />
                )}
              </div>

              {/* Email Input */}
              <div className={styles.formGroup}>
                <label htmlFor="email" className={styles.label}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className={styles.input}
                  required
                  autoFocus
                  aria-invalid={error ? 'true' : 'false'}
                />
              </div>

              {/* Password Input */}
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
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? 'credentials-error' : undefined}
                />
                {error && (
                  <p id="credentials-error" className={styles.error} role="alert">
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
                  onClick={onBack}
                  disabled={isConnecting}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={isConnecting}
                  disabled={!email || !password}
                >
                  Connect & Restore
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    )
  }

  /**
   * Render connecting step
   */
  if (step === 'connecting') {
    return (
      <div className={styles.container}>
        <Card variant="elevated" padding="lg" className={styles.card}>
          <CardBody>
            <div className={styles.loading}>
              <div className={styles.spinner} aria-hidden="true" />
              <h2 className={styles.loadingTitle}>Connecting to Sync Relay...</h2>
              <p className={styles.loadingMessage}>
                Establishing secure connection to {useCustomRelay ? 'your relay' : 'Graceful Books sync server'}.
              </p>
            </div>
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
              <h2 className={styles.loadingTitle}>Syncing Your Data...</h2>
              <p className={styles.loadingMessage}>
                Downloading and decrypting your financial records from the relay. This may take a moment.
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
                ⚡
              </div>
              <h2 className={styles.successTitle}>All Synced Up!</h2>
              <p className={styles.successMessage}>
                Your data has been synced successfully. All your devices, always in sync ⚡
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
              <h2 className={styles.errorTitle}>Connection Failed</h2>
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
