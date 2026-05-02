/**
 * Restoration Options Screen
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 5, Task 5.2:
 * Presents user with three restoration methods when setting up a new device.
 *
 * User Experience:
 * - Clear, friendly messaging ("Choose your path - we've got you covered!")
 * - Three distinct options with icons and descriptions
 * - Follows Audacious Design System styling
 * - WCAG 2.1 AA compliant
 */

import { useState } from 'react'
import { Button } from '../core/Button'
import { Card } from '../ui/Card'
import styles from './RestorationOptionsScreen.module.css'

/**
 * Restoration method type
 */
export type RestorationMethod = 'email' | 'file' | 'sync' | null

/**
 * Restoration Options Screen Props
 */
export interface RestorationOptionsScreenProps {
  /**
   * Called when user selects a restoration method
   */
  onSelectMethod: (method: RestorationMethod) => void

  /**
   * Called when user chooses to skip restoration and start fresh
   */
  onSkipRestoration: () => void

  /**
   * Whether email restoration is available
   * (User needs to have received an email backup link)
   */
  emailAvailable?: boolean

  /**
   * Whether file restoration is available
   * (Browser supports File System Access API)
   */
  fileAvailable?: boolean

  /**
   * Whether sync relay restoration is available
   * (User has sync relay credentials)
   */
  syncAvailable?: boolean

  /**
   * Loading state
   */
  loading?: boolean
}

/**
 * Individual restoration option card
 */
interface OptionCardProps {
  icon: string
  title: string
  description: string
  available: boolean
  recommended?: boolean
  onSelect: () => void
  disabled?: boolean
}

function OptionCard({
  icon,
  title,
  description,
  available,
  recommended,
  onSelect,
  disabled,
}: OptionCardProps) {
  return (
    <Card
      variant="bordered"
      padding="lg"
      hoverable={available && !disabled}
      className={styles.optionCard}
      role="button"
      tabIndex={available && !disabled ? 0 : -1}
      onClick={available && !disabled ? onSelect : undefined}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && available && !disabled) {
          e.preventDefault()
          onSelect()
        }
      }}
      aria-label={`${title} - ${description}`}
      aria-disabled={!available || disabled}
    >
      {recommended && (
        <div className={styles.recommendedBadge} aria-label="Recommended option">
          ⭐ Recommended
        </div>
      )}

      <div className={styles.optionIcon} aria-hidden="true">
        {icon}
      </div>

      <h3 className={styles.optionTitle}>{title}</h3>

      <p className={styles.optionDescription}>{description}</p>

      {!available && (
        <p className={styles.unavailableMessage} role="status">
          Not available on this device
        </p>
      )}

      <Button
        variant={recommended ? 'primary' : 'secondary'}
        fullWidth
        disabled={!available || disabled}
        onClick={onSelect}
        aria-label={`Select ${title}`}
      >
        {available ? 'Select this option' : 'Unavailable'}
      </Button>
    </Card>
  )
}

/**
 * Restoration Options Screen Component
 *
 * Presents three restoration methods:
 * 1. Email link restoration
 * 2. File upload restoration
 * 3. Sync relay restoration
 *
 * Joy Engineering: Friendly, supportive messaging that emphasizes user control and choice.
 *
 * @example
 * ```tsx
 * <RestorationOptionsScreen
 *   onSelectMethod={(method) => {
 *     if (method === 'email') {
 *       // Show email link input
 *     } else if (method === 'file') {
 *       // Show file picker
 *     } else if (method === 'sync') {
 *       // Show sync relay connection
 *     }
 *   }}
 *   onSkipRestoration={() => {
 *     // Start fresh with onboarding
 *   }}
 *   emailAvailable={true}
 *   fileAvailable={true}
 *   syncAvailable={true}
 * />
 * ```
 */
export function RestorationOptionsScreen({
  onSelectMethod,
  onSkipRestoration,
  emailAvailable = true,
  fileAvailable = true,
  syncAvailable = true,
  loading = false,
}: RestorationOptionsScreenProps) {
  const [_selectedMethod, setSelectedMethod] = useState<RestorationMethod>(null)

  const handleSelectMethod = (method: RestorationMethod) => {
    if (loading) return
    setSelectedMethod(method)
    onSelectMethod(method)
  }

  return (
    <div className={styles.container} role="main" aria-labelledby="restoration-title">
      <div className={styles.header}>
        <h1 id="restoration-title" className={styles.title}>
          Welcome back! 👋
        </h1>
        <p className={styles.subtitle}>
          Choose your path - we've got you covered! 🎯
        </p>
        <p className={styles.description}>
          Select the method that works best for you to restore your financial data.
          Your data is always encrypted and secure.
        </p>
      </div>

      <div className={styles.optionsGrid} role="group" aria-label="Restoration methods">
        <OptionCard
          icon="📧"
          title="Email Backup Link"
          description="Paste a restoration link from your weekly backup email. Quick and easy if you have the email handy."
          available={emailAvailable}
          recommended={emailAvailable}
          onSelect={() => handleSelectMethod('email')}
          disabled={loading}
        />

        <OptionCard
          icon="📁"
          title="Upload Backup File"
          description="Choose a backup file from your computer. Perfect if you have local backups saved."
          available={fileAvailable}
          onSelect={() => handleSelectMethod('file')}
          disabled={loading}
        />

        <OptionCard
          icon="🔄"
          title="Connect to Sync Relay"
          description="Sync from your encrypted cloud storage. Great for multi-device users."
          available={syncAvailable}
          onSelect={() => handleSelectMethod('sync')}
          disabled={loading}
        />
      </div>

      <div className={styles.footer}>
        <p className={styles.skipMessage}>
          Don't have a backup or starting fresh?
        </p>
        <Button
          variant="ghost"
          onClick={onSkipRestoration}
          disabled={loading}
          aria-label="Skip restoration and start fresh"
        >
          Start from scratch
        </Button>
      </div>

      {loading && (
        <div className={styles.loadingOverlay} role="status" aria-live="polite">
          <div className={styles.loadingSpinner} aria-hidden="true" />
          <p>Loading restoration...</p>
        </div>
      )}
    </div>
  )
}
