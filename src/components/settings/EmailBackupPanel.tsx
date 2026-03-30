/**
 * Email Backup Panel Component
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 3, Task 3.5 (Chunk 3G):
 * Settings UI for managing email backup permissions and scheduling.
 *
 * Features:
 * - Enable/disable email backups
 * - Configure email schedule (day/time/timezone)
 * - Email address management
 * - Visual schedule preview
 * - Permission toggle with explanations
 * - Steadiness communication style
 *
 * Security:
 * - User must grant explicit permission
 * - Clear explanation of what data is shared
 * - Easy revocation of permission
 * - No emails sent without consent
 */

import { useState, useEffect } from 'react'
import styles from './EmailBackupPanel.module.css'
import {
  EmailSchedulingService,
  formatScheduleDescription,
  DEFAULT_EMAIL_SCHEDULE,
  type EmailScheduleConfig,
} from '../../services/backup/EmailSchedulingService'

/**
 * Email backup panel props
 */
export interface EmailBackupPanelProps {
  userId: string
  userEmail: string
  onSave?: (config: EmailScheduleConfig) => void
}

/**
 * Days of week for schedule selection
 */
const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const

/**
 * Common timezones for selection
 */
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
] as const

/**
 * Email Backup Panel Component
 *
 * Allows users to configure automated email backups with restoration links.
 */
export function EmailBackupPanel({ userId, userEmail, onSave }: EmailBackupPanelProps) {
  const [config, setConfig] = useState<EmailScheduleConfig>(DEFAULT_EMAIL_SCHEDULE)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Load saved config on mount
  useEffect(() => {
    const loadConfig = async () => {
      // In real implementation, would load from database
      // For now, use default
      setConfig(DEFAULT_EMAIL_SCHEDULE)
    }

    loadConfig()
  }, [userId])

  /**
   * Handle config changes
   */
  const handleChange = (updates: Partial<EmailScheduleConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }))
    setHasChanges(true)
    setSaveSuccess(false)
  }

  /**
   * Save configuration
   */
  const handleSave = async () => {
    setIsSaving(true)

    try {
      // In real implementation, would save to database
      await new Promise((resolve) => setTimeout(resolve, 500))

      if (onSave) {
        onSave(config)
      }

      setHasChanges(false)
      setSaveSuccess(true)

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save email backup config:', error)
      alert('Oops! We had trouble saving your settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Generate preview of next scheduled email
   */
  const getNextSchedulePreview = (): string => {
    if (!config.enabled) {
      return 'Email backups are disabled'
    }

    const service = new EmailSchedulingService(config)
    const nextTime = service.getNextScheduledTime()
    service.stop()

    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })

    return `Next email: ${formatter.format(nextTime)}`
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>📧 Email Backup Links</h2>
        <p className={styles.subtitle}>
          Get a secure link to restore your backup emailed to you automatically
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className={styles.section}>
        <div className={styles.toggleContainer}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => handleChange({ enabled: e.target.checked })}
              className={styles.toggleInput}
            />
            <span className={styles.toggleSlider} />
            <span className={styles.toggleLabel}>
              {config.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        {/* Explanation */}
        <div className={styles.explanation}>
          <p>
            When enabled, we'll email you a secure restoration link each week. This link
            lets you restore your backup to a new device whenever you need it.
          </p>
          <p className={styles.steady}>
            Take your time with this—you can always change these settings later.
          </p>
        </div>
      </div>

      {/* Configuration (only show when enabled) */}
      {config.enabled && (
        <>
          {/* Email Address */}
          <div className={styles.section}>
            <label className={styles.label}>
              Email Address
              <span className={styles.required}>*</span>
            </label>
            <div className={styles.emailDisplay}>
              <span className={styles.emailIcon}>✉️</span>
              <span className={styles.emailText}>{userEmail}</span>
            </div>
            <p className={styles.hint}>
              Backup links will be sent to this address. To change your email, update your
              account settings.
            </p>
          </div>

          {/* Schedule Configuration */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Schedule</h3>

            {/* Day of Week */}
            <div className={styles.field}>
              <label htmlFor="dayOfWeek" className={styles.label}>
                Day of Week
              </label>
              <select
                id="dayOfWeek"
                value={config.dayOfWeek}
                onChange={(e) =>
                  handleChange({
                    dayOfWeek: parseInt(e.target.value) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
                  })
                }
                className={styles.select}
              >
                {DAYS_OF_WEEK.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Time */}
            <div className={styles.timeFields}>
              <div className={styles.field}>
                <label htmlFor="hour" className={styles.label}>
                  Hour
                </label>
                <select
                  id="hour"
                  value={config.hour}
                  onChange={(e) => handleChange({ hour: parseInt(e.target.value) })}
                  className={styles.select}
                >
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour12 = i % 12 || 12
                    const ampm = i < 12 ? 'AM' : 'PM'
                    return (
                      <option key={i} value={i}>
                        {hour12}:00 {ampm}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="minute" className={styles.label}>
                  Minute
                </label>
                <select
                  id="minute"
                  value={config.minute}
                  onChange={(e) => handleChange({ minute: parseInt(e.target.value) })}
                  className={styles.select}
                >
                  <option value={0}>:00</option>
                  <option value={15}>:15</option>
                  <option value={30}>:30</option>
                  <option value={45}>:45</option>
                </select>
              </div>
            </div>

            {/* Timezone */}
            <div className={styles.field}>
              <label htmlFor="timezone" className={styles.label}>
                Timezone
              </label>
              <select
                id="timezone"
                value={config.timezone}
                onChange={(e) => handleChange({ timezone: e.target.value })}
                className={styles.select}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Schedule Preview */}
            <div className={styles.preview}>
              <div className={styles.previewIcon}>📅</div>
              <div className={styles.previewContent}>
                <div className={styles.previewTitle}>
                  {formatScheduleDescription(config)}
                </div>
                <div className={styles.previewSubtitle}>{getNextSchedulePreview()}</div>
              </div>
            </div>
          </div>

          {/* Security Information */}
          <div className={styles.infoBox}>
            <h4 className={styles.infoTitle}>🔒 Security & Privacy</h4>
            <ul className={styles.infoList}>
              <li>Your backup is encrypted before being stored</li>
              <li>Restoration links expire after 7 days</li>
              <li>Each link can only be used once</li>
              <li>We never have access to your unencrypted data</li>
              <li>You can disable email backups anytime</li>
            </ul>
          </div>
        </>
      )}

      {/* Save Button - only show when changes made */}
      {hasChanges && (
        <div className={styles.footer}>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={styles.saveButton}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Success Message - show independently of hasChanges */}
      {saveSuccess && (
        <div className={styles.successBanner}>
          <span className={styles.successMessage}>✓ Settings saved successfully!</span>
        </div>
      )}
    </div>
  )
}
