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
      // Check IndexedDB availability
      if (!('indexedDB' in window)) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Your browser doesn\'t support offline storage. Please use a modern browser like Chrome or Edge.',
        }))
        return
      }
      // Show directory picker
      // @ts-expect-error - File System Access API not in TypeScript DOM types yet
      const directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      })

      // Verify we can write to this directory (test for system folders)
      try {
        const testFileName = `.test-${Date.now()}.tmp`
        const testFileHandle = await directoryHandle.getFileHandle(testFileName, { create: true })
        await testFileHandle.remove() // Clean up test file
      } catch (testError) {
        // System folder or insufficient permissions
        setState(prev => ({
          ...prev,
          isLoading: false,
          error:
            "⚠️ Can't use this folder - it contains system files.\n\n" +
            "Please create a NEW FOLDER specifically for backups:\n" +
            "1. Click 'Choose Location' again\n" +
            "2. Right-click → 'New Folder'\n" +
            "3. Name it something like 'Audacious Backups'\n" +
            "4. Select that new folder",
        }))
        return
      }

      // Get the directory name for display
      const directoryPath = directoryHandle.name
      console.log('📁 Selected folder:', directoryPath)

      // Store the handle in IndexedDB using FileSystemBackup service
      console.log('💾 Attempting to store directory handle in IndexedDB...')
      const { storeDirectoryHandle } = await import('../../services/backup/FileSystemBackup')
      const storeResult = await storeDirectoryHandle(directoryHandle)
      console.log('💾 Store result:', storeResult)

      if (!storeResult.success) {
        console.error('❌ Failed to store directory handle:', storeResult.error)
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: `We couldn't save your backup location: ${storeResult.error || 'Unknown error'}`,
        }))
        return
      }

      console.log('✅ Directory handle stored successfully!')

      // Verify it was stored by trying to retrieve it
      const { retrieveDirectoryHandle } = await import('../../services/backup/FileSystemBackup')
      const retrieved = await retrieveDirectoryHandle()
      console.log('🔍 Verification - Retrieved handle:', retrieved)

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
        const errorMessage = (err as Error).message || ''

        // Check for system folder error
        if (errorMessage.includes('system') || errorMessage.includes('permission')) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error:
              "⚠️ Can't use this folder.\n\n" +
              "Please create a NEW FOLDER specifically for backups (see instructions below).",
          }))
        } else {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: "We couldn't access that folder. Please try again or choose a different location.",
          }))
        }
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
                and it gives you peace of mind knowing your data has a safe place to be stored.
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
              Your backup location has been saved. You can create backups from the Settings
              page whenever you need them.
            </p>

            <div className={styles.successBox}>
              <div className={styles.successBoxHeader}>
                <span className={styles.successBoxIcon} aria-hidden="true">
                  📁
                </span>
                <span className={styles.successBoxLabel}>Backups will be saved to:</span>
              </div>
              <div className={styles.pathDisplay} role="status" aria-live="polite">
                <code className={styles.path}>{state.directoryPath}</code>
              </div>
            </div>

            <div className={styles.infoBox}>
              <p className={styles.infoBoxText}>
                You can change this location anytime in Settings.
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
          <h2 className={styles.headerPurple}>
            {isOnboarding ? "Choose where you'd like backups to be saved on your computer" : 'Choose Backup Location'}
          </h2>

          <p className={styles.description}>
            Select a folder on your computer where we'll save your backup files. You can
            change this location anytime in Settings.
          </p>

          <div className={styles.features}>
            <div className={styles.feature}>
              <span className={styles.featureText}>
                Zero-knowledge encryption (we can never see your data)
              </span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureText}>Your data never leaves your computer</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureText}>You're always in control</span>
            </div>
          </div>

          <div className={styles.tipBox}>
            <div className={styles.tipHeader}>
              <strong>Pro Tip:</strong>
            </div>
            <p className={styles.tipText}>
              Create a NEW FOLDER specifically for backups. The folder picker will ask you to
              create one. Name it something like "Audacious Backups" and save it somewhere easy to
              find (like your Documents folder).
            </p>
            <p className={styles.tipWarning}>
              <strong>Avoid:</strong> Desktop, Downloads, or system folders - these can cause
              permission errors.
            </p>
          </div>

          {state.error && (
            <div className={styles.errorBox} role="alert" aria-live="polite">
              <p className={styles.errorText} style={{ whiteSpace: 'pre-line' }}>
                {state.error}
              </p>
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
            style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}
          >
            Choose Backup Location
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}

BackupLocationSetup.displayName = 'BackupLocationSetup'
