/**
 * Restoration Progress Indicator Component
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 5, Task 5.6:
 * Visual stepper showing restoration progress.
 *
 * Steps: Connecting → Downloading → Decrypting → Restoring → Done
 *
 * Joy Engineering: "Watch your data come home 🏠"
 */

import { useEffect, useState } from 'react'
import styles from './RestorationProgress.module.css'

/**
 * Restoration step configuration
 */
export interface RestorationStep {
  id: string
  label: string
  icon: string
  description?: string
}

/**
 * Restoration Progress Props
 */
export interface RestorationProgressProps {
  /**
   * Current step index (0-based)
   */
  currentStep: number

  /**
   * Array of steps to display
   */
  steps: RestorationStep[]

  /**
   * Overall progress percentage (0-100)
   */
  progressPercent?: number

  /**
   * Estimated time remaining (in milliseconds)
   */
  estimatedTimeRemaining?: number

  /**
   * Whether restoration is complete
   */
  isComplete?: boolean

  /**
   * Whether an error occurred
   */
  hasError?: boolean

  /**
   * Error message to display
   */
  errorMessage?: string

  /**
   * Called when user clicks cancel button
   */
  onCancel?: () => void

  /**
   * Whether cancel is allowed
   */
  allowCancel?: boolean
}

/**
 * Formats milliseconds to human-readable time
 */
function formatTimeRemaining(ms: number): string {
  if (ms < 1000) {
    return 'Just a moment...'
  }

  const seconds = Math.ceil(ms / 1000)

  if (seconds < 60) {
    return `About ${seconds} second${seconds === 1 ? '' : 's'} remaining`
  }

  const minutes = Math.ceil(seconds / 60)
  return `About ${minutes} minute${minutes === 1 ? '' : 's'} remaining`
}

/**
 * Restoration Progress Indicator Component
 *
 * Shows multi-step progress with visual feedback.
 *
 * @example
 * ```tsx
 * const steps = [
 *   { id: 'connect', label: 'Connecting', icon: '🔗' },
 *   { id: 'download', label: 'Downloading', icon: '⬇️' },
 *   { id: 'decrypt', label: 'Decrypting', icon: '🔓' },
 *   { id: 'restore', label: 'Restoring', icon: '📥' },
 *   { id: 'done', label: 'Done', icon: '✅' },
 * ]
 *
 * <RestorationProgress
 *   currentStep={2}
 *   steps={steps}
 *   progressPercent={60}
 *   estimatedTimeRemaining={30000}
 * />
 * ```
 */
export function RestorationProgress({
  currentStep,
  steps,
  progressPercent,
  estimatedTimeRemaining,
  isComplete = false,
  hasError = false,
  errorMessage,
  onCancel,
  allowCancel = false,
}: RestorationProgressProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0)

  // Animate progress bar
  useEffect(() => {
    if (progressPercent !== undefined) {
      const timer = setTimeout(() => {
        setAnimatedProgress(progressPercent)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [progressPercent])

  return (
    <div
      className={styles.container}
      role="progressbar"
      aria-valuenow={progressPercent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Restoration progress"
    >
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>
          {hasError
            ? 'Restoration Failed'
            : isComplete
            ? 'Restoration Complete!'
            : 'Restoring Your Data'}
        </h2>
        {!hasError && !isComplete && estimatedTimeRemaining !== undefined && (
          <p className={styles.timeRemaining} role="status" aria-live="polite">
            {formatTimeRemaining(estimatedTimeRemaining)}
          </p>
        )}
      </div>

      {/* Progress Bar */}
      {progressPercent !== undefined && !hasError && (
        <div className={styles.progressBarContainer}>
          <div
            className={styles.progressBar}
            style={{ width: `${animatedProgress}%` }}
            role="presentation"
          />
          <span className={styles.progressLabel} aria-live="polite">
            {Math.round(progressPercent)}%
          </span>
        </div>
      )}

      {/* Steps */}
      <div className={styles.steps} role="list">
        {steps.map((step, index) => {
          const isActive = index === currentStep
          const isCompleted = index < currentStep || isComplete
          const isFailed = hasError && isActive

          return (
            <div
              key={step.id}
              className={`${styles.step} ${
                isActive ? styles.stepActive : ''
              } ${isCompleted ? styles.stepCompleted : ''} ${
                isFailed ? styles.stepFailed : ''
              }`}
              role="listitem"
              aria-current={isActive ? 'step' : undefined}
            >
              {/* Step Icon */}
              <div className={styles.stepIcon} aria-hidden="true">
                {isFailed ? '❌' : isCompleted ? '✅' : step.icon}
              </div>

              {/* Step Content */}
              <div className={styles.stepContent}>
                <div className={styles.stepLabel}>{step.label}</div>
                {step.description && isActive && (
                  <div className={styles.stepDescription}>{step.description}</div>
                )}
              </div>

              {/* Step Connector */}
              {index < steps.length - 1 && (
                <div className={styles.stepConnector} aria-hidden="true">
                  <div
                    className={`${styles.stepConnectorLine} ${
                      isCompleted ? styles.stepConnectorLineCompleted : ''
                    }`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Error Message */}
      {hasError && errorMessage && (
        <div className={styles.errorMessage} role="alert">
          <span className={styles.errorIcon} aria-hidden="true">
            ⚠️
          </span>
          {errorMessage}
        </div>
      )}

      {/* Cancel Button */}
      {allowCancel && !isComplete && !hasError && onCancel && (
        <div className={styles.actions}>
          <button
            type="button"
            onClick={onCancel}
            className={styles.cancelButton}
            aria-label="Cancel restoration"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Joy Message */}
      {isComplete && (
        <div className={styles.joyMessage} role="status">
          <span aria-hidden="true">🏠</span> Watch your data come home!
        </div>
      )}
    </div>
  )
}

/**
 * Default restoration steps for common flows
 */
export const DEFAULT_RESTORATION_STEPS: RestorationStep[] = [
  {
    id: 'connect',
    label: 'Connecting',
    icon: '🔗',
    description: 'Establishing secure connection...',
  },
  {
    id: 'download',
    label: 'Downloading',
    icon: '⬇️',
    description: 'Fetching your encrypted data...',
  },
  {
    id: 'decrypt',
    label: 'Decrypting',
    icon: '🔓',
    description: 'Unlocking your data...',
  },
  {
    id: 'restore',
    label: 'Restoring',
    icon: '📥',
    description: 'Importing your financial records...',
  },
  {
    id: 'done',
    label: 'Done',
    icon: '✅',
    description: 'All set!',
  },
]
