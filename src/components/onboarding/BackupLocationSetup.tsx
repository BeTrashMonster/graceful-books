/**
 * Backup Location Setup Component (Onboarding Step)
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 2, Task 2.2:
 * - Create onboarding step: "Choose Backup Location"
 * - Show folder picker on first launch
 * - Display chosen path in UI
 * - "I'll do this later" option with warning
 * - Visual confirmation
 * - Follow Audacious Design System styling
 * - Steadiness communication style
 *
 * Features:
 * - File System Access API integration
 * - Browser support detection
 * - Patient, step-by-step guidance
 * - WCAG 2.1 AA compliance
 * - Clear visual feedback
 * - Graceful degradation for unsupported browsers
 */

import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { Button } from '../core/Button'
import { Card, CardBody, CardFooter } from '../ui/Card'
import styles from './BackupLocationSetup.module.css'

export interface BackupLocationSetupProps {
  /**
   * Callback when backup location is successfully configured
   * @param directoryPath - The chosen directory path
   */
  onComplete?: (directoryPath: string) => void

  /**
   * Callback when user chooses to skip this step
   */
  onSkip?: () => void

  /**
   * Whether to show this as part of onboarding flow
   * If false, shows as standalone settings component
   */
  isOnboarding?: boolean

  /**
   * Optional initial path to display
   */
  initialPath?: string

  /**
   * Additional class name
   */
  className?: string
}

export interface BackupLocationState {
  directoryPath: string | null
  hasPermission: boolean
  isSupported: boolean
  error: string | null
  isLoading: boolean
}

/**
 * Check if File System Access API is supported
 * Supported in Chrome 86+, Edge 86+
 * Not supported in Firefox, Safari
 */
function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window
}

/**
 * Backup Location Setup Component
 *
 * Provides a patient, step-by-step interface for choosing where to save
 * automatic backups. Emphasizes user control and data sovereignty.
 *
 * @example
 * ```tsx
 * <BackupLocationSetup
 *   isOnboarding={true}
 *   onComplete={(path) => console.log('Backups saving to:', path)}
 *   onSkip={() => console.log('User skipped backup setup')}
 * />
 * ```
 */
export const BackupLocationSetup: React.FC<BackupLocationSetupProps> = ({
  onComplete,
  onSkip,
  isOnboarding = true,
  initialPath,
  className,
}) => {
  const [state, setState] = useState<BackupLocationState>({
    directoryPath: initialPath || null,
    hasPermission: false,
    isSupported: isFileSystemAccessSupported(),
    error: null,
    isLoading: false,
  })

  const [showSkipWarning, setShowSkipWarning] = useState(false)

  // Check for existing permission on mount
  useEffect(() => {
    if (initialPath) {
      setState(prev => ({ ...prev, directoryPath: initialPath, hasPermission: true }))
    }
  }, [initialPath])

  /**
   * Handle folder picker interaction
   * Uses File System Access API to let user choose backup location
   */
  const handleChooseFolder = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Show directory picker
      // @ts-expect-error - File System Access API not in TypeScript DOM types yet
      const directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      })

      // Get the directory path (best effort - may not be full path for security)
      const directoryPath = directoryHandle.name || 'Selected folder'

      // Store the handle in IndexedDB for later use
      // Note: This is handled by the FileSystemBackup service in Phase 2, Task 2.1
      // We'll just track the path for display purposes here

      setState(prev => ({
        ...prev,
        directoryPath,
        hasPermission: true,
        isLoading: false,
        error: null,
      }))

      // Call completion callback
      onComplete?.(directoryPath)
    } catch (err) {
      // User cancelled or permission denied
      if ((err as Error).name === 'AbortError') {
        // User cancelled - not an error, just return to normal state
        setState(prev => ({ ...prev, isLoading: false }))
      } else {
        // Actual error
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: "We couldn't access that folder. Please try again or choose a different location.",
        }))
      }
    }
  }

  /**
   * Handle skip button click
   * Shows warning first, then allows skip
   */
  const handleSkip = () => {
    if (!showSkipWarning) {
      setShowSkipWarning(true)
    } else {
      onSkip?.()
    }
  }

  /**
   * Handle cancel skip (user changes mind)
   */
  const handleCancelSkip = () => {
    setShowSkipWarning(false)
  }

  // Render unsupported browser message
  if (!state.isSupported) {
    return (
      <Card className={clsx(styles.container, className)} variant="bordered">
        <CardBody>
          <div className={styles.content}>
            <div className={styles.icon} aria-hidden="true">
              ℹ️
            </div>

            <h2 className={styles.title}>Automatic Backups Not Available</h2>

            <p className={styles.description}>
              Your browser doesn't support automatic local backups yet. To get this feature,
              we recommend using{' '}
              <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.
            </p>

            <div className={styles.infoBox}>
              <h3 className={styles.infoBoxTitle}>Don't worry - your data is still safe!</h3>
              <p className={styles.infoBoxText}>
                You can still manually download backups from Settings whenever you need them.
                Your data stays on your device and works completely offline.
              </p>
            </div>
          </div>
        </CardBody>

        <CardFooter>
          <div className={styles.actions}>
            <Button variant="primary" onClick={() => onSkip?.()}>
              Continue Setup
            </Button>
          </div>
        </CardFooter>
      </Card>
    )
  }

  // Render skip warning
  if (showSkipWarning) {
    return (
      <Card className={clsx(styles.container, className)} variant="bordered">
        <CardBody>
          <div className={styles.content}>
            <div className={styles.icon} aria-hidden="true">
              ⚠️
            </div>

            <h2 className={styles.title}>Are you sure?</h2>

            <p className={styles.description}>
              Without automatic backups, you could lose your financial data if your browser
              clears its storage or something unexpected happens.
            </p>

            <div className={styles.warningBox}>
              <p className={styles.warningText}>
                <strong>We really recommend setting this up.</strong> It only takes a moment,
                and it gives you peace of mind knowing your data is safe. Plus, it happens
                automatically in the background - you won't have to think about it again.
              </p>
            </div>
          </div>
        </CardBody>

        <CardFooter>
          <div className={styles.actions}>
            <Button variant="outline" onClick={handleCancelSkip}>
              Go Back
            </Button>
            <Button variant="secondary" onClick={() => onSkip?.()}>
              Skip Anyway
            </Button>
          </div>
        </CardFooter>
      </Card>
    )
  }

  // Render success state
  if (state.hasPermission && state.directoryPath) {
    return (
      <Card className={clsx(styles.container, className)} variant="bordered">
        <CardBody>
          <div className={styles.content}>
            <div className={styles.successIcon} aria-hidden="true">
              ✓
            </div>

            <h2 className={styles.title}>All Set!</h2>

            <p className={styles.description}>
              Your backups will save automatically in the background. You won't have to think
              about it again.
            </p>

            <div className={styles.successBox}>
              <div className={styles.successBoxHeader}>
                <span className={styles.successBoxIcon} aria-hidden="true">
                  📁
                </span>
                <span className={styles.successBoxLabel}>Backups saving to:</span>
              </div>
              <div className={styles.pathDisplay} role="status" aria-live="polite">
                <code className={styles.path}>{state.directoryPath}</code>
              </div>
            </div>

            <div className={styles.infoBox}>
              <p className={styles.infoBoxText}>
                Backups happen automatically when you make changes, and we keep them tidy by
                managing old versions for you. You can always change this location later in
                Settings.
              </p>
            </div>
          </div>
        </CardBody>

        {isOnboarding && (
          <CardFooter>
            <div className={styles.actions}>
              <Button variant="primary" onClick={() => onComplete?.(state.directoryPath!)}>
                Continue
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    )
  }

  // Render main selection state
  return (
    <Card className={clsx(styles.container, className)} variant="bordered">
      <CardBody>
        <div className={styles.content}>
          <div className={styles.icon} aria-hidden="true">
            🔐
          </div>

          <h2 className={styles.title}>
            {isOnboarding ? "Let's Keep Your Data Safe" : 'Choose Backup Location'}
          </h2>

          <p className={styles.description}>
            Choose where you'd like us to save automatic backups on your computer. This
            happens behind the scenes - you won't have to think about it again.
          </p>

          <div className={styles.infoBox}>
            <h3 className={styles.infoBoxTitle}>Why do I need this?</h3>
            <p className={styles.infoBoxText}>
              Browsers sometimes clear their storage unexpectedly. Automatic backups mean your
              financial data is always safe, even if that happens. Plus, you can see the
              backup files right on your computer - your data, your control.
            </p>
          </div>

          <div className={styles.features}>
            <div className={styles.feature}>
              <span className={styles.featureIcon} aria-hidden="true">
                🔒
              </span>
              <span className={styles.featureText}>Bank-level encryption</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon} aria-hidden="true">
                ⚡
              </span>
              <span className={styles.featureText}>Automatic and invisible</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureIcon} aria-hidden="true">
                👀
              </span>
              <span className={styles.featureText}>You're always in control</span>
            </div>
          </div>

          {state.error && (
            <div className={styles.errorBox} role="alert" aria-live="polite">
              <p className={styles.errorText}>{state.error}</p>
            </div>
          )}
        </div>
      </CardBody>

      <CardFooter>
        <div className={styles.actions}>
          {isOnboarding && (
            <Button
              variant="ghost"
              onClick={handleSkip}
              disabled={state.isLoading}
            >
              I'll do this later
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleChooseFolder}
            loading={state.isLoading}
            disabled={state.isLoading}
          >
            Choose Backup Location
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

BackupLocationSetup.displayName = 'BackupLocationSetup'
