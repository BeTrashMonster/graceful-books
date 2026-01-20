/**
 * Automation Settings Component
 *
 * Allows users to enable/disable automation features and adjust settings.
 *
 * Requirements:
 * - J2: User can enable/disable automation
 * - Granular control over each automation type
 * - Settings: confidence thresholds, auto-apply, learning
 * - WCAG 2.1 AA compliance
 */

import { useState } from 'react'
import { Card, CardHeader, CardBody } from '../ui/Card'
import { Button } from '../core/Button'
import { Checkbox } from '../forms/Checkbox'
import type { AutomationSettings as AutomationSettingsType } from '../../types/automation.types'
import styles from './AutomationSettings.module.css'

export interface AutomationSettingsProps {
  settings: AutomationSettingsType
  onSave: (settings: AutomationSettingsType) => Promise<void>
  loading?: boolean
}

/**
 * Automation Settings Component
 *
 * Provides user control over automation features with detailed configuration options.
 *
 * WCAG Compliance:
 * - Form labels visible (not just placeholders)
 * - Keyboard navigation works throughout
 * - Toggle switches have clear on/off states
 * - Help text explains each option
 * - Save button provides feedback
 *
 * @example
 * ```tsx
 * <AutomationSettings
 *   settings={currentSettings}
 *   onSave={handleSaveSettings}
 * />
 * ```
 */
export function AutomationSettings({
  settings: initialSettings,
  onSave,
  loading = false,
}: AutomationSettingsProps) {
  const [settings, setSettings] = useState<AutomationSettingsType>(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setSaveMessage(null)

    try {
      await onSave(settings)
      setSaveMessage({
        type: 'success',
        text: 'Your automation settings have been saved successfully.',
      })
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: 'Oops! Something unexpected happened while saving your settings. Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = <K extends keyof AutomationSettingsType>(
    key: K,
    value: AutomationSettingsType[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
      updatedAt: Date.now(),
    }))
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Automation Settings</h2>
        <p className={styles.subtitle}>
          Take your time configuring these options. You can change them anytime.
        </p>
      </div>

      {/* Auto-Categorization */}
      <Card variant="bordered" padding="lg" className={styles.section}>
        <CardHeader>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon} aria-hidden="true">
              🏷️
            </span>
            <h3 className={styles.sectionTitle}>Smart Categorization</h3>
          </div>
          <p className={styles.sectionDescription}>
            Automatically suggest categories for transactions based on your history.
          </p>
        </CardHeader>
        <CardBody>
          <div className={styles.settingGroup}>
            <Checkbox
              id="categorization-enabled"
              checked={settings.categorizationEnabled}
              onChange={(e) => updateSetting('categorizationEnabled', e.target.checked)}
              label="Enable smart categorization"
            />
            <p className={styles.helpText}>
              When enabled, we'll suggest categories for new transactions based on patterns
              from your previous entries.
            </p>
          </div>

          {settings.categorizationEnabled && (
            <>
              <div className={styles.settingGroup}>
                <label htmlFor="categorization-confidence" className={styles.label}>
                  Minimum confidence level
                </label>
                <select
                  id="categorization-confidence"
                  className={styles.select}
                  value={settings.categorizationMinConfidence}
                  onChange={(e) =>
                    updateSetting('categorizationMinConfidence', parseFloat(e.target.value))
                  }
                >
                  <option value="0.9">High (90%+)</option>
                  <option value="0.7">Medium (70%+)</option>
                  <option value="0.5">Low (50%+)</option>
                </select>
                <p className={styles.helpText}>
                  Only show suggestions when we're at least this confident.
                </p>
              </div>

              <div className={styles.settingGroup}>
                <Checkbox
                  id="categorization-auto-apply"
                  checked={settings.categorizationAutoApply}
                  onChange={(e) => updateSetting('categorizationAutoApply', e.target.checked)}
                  label="Auto-apply high confidence suggestions"
                />
                <p className={styles.helpText}>
                  Automatically categorize transactions when confidence is 90% or higher. You
                  can always change them later.
                </p>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* Recurring Detection */}
      <Card variant="bordered" padding="lg" className={styles.section}>
        <CardHeader>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon} aria-hidden="true">
              🔄
            </span>
            <h3 className={styles.sectionTitle}>Recurring Transaction Detection</h3>
          </div>
          <p className={styles.sectionDescription}>
            Identify recurring transactions like subscriptions and monthly bills.
          </p>
        </CardHeader>
        <CardBody>
          <div className={styles.settingGroup}>
            <Checkbox
              id="recurring-enabled"
              checked={settings.recurringDetectionEnabled}
              onChange={(e) => updateSetting('recurringDetectionEnabled', e.target.checked)}
              label="Enable recurring detection"
            />
            <p className={styles.helpText}>
              When enabled, we'll flag transactions that appear to be recurring (like monthly
              rent or subscriptions).
            </p>
          </div>

          {settings.recurringDetectionEnabled && (
            <>
              <div className={styles.settingGroup}>
                <label htmlFor="recurring-min-occurrences" className={styles.label}>
                  Minimum occurrences to detect
                </label>
                <select
                  id="recurring-min-occurrences"
                  className={styles.select}
                  value={settings.recurringMinOccurrences}
                  onChange={(e) =>
                    updateSetting('recurringMinOccurrences', parseInt(e.target.value))
                  }
                >
                  <option value="2">2 occurrences</option>
                  <option value="3">3 occurrences</option>
                  <option value="4">4 occurrences</option>
                  <option value="5">5 occurrences</option>
                </select>
                <p className={styles.helpText}>
                  How many similar transactions needed before we suggest it's recurring.
                </p>
              </div>

              <div className={styles.settingGroup}>
                <Checkbox
                  id="recurring-auto-create"
                  checked={settings.recurringAutoCreate}
                  onChange={(e) => updateSetting('recurringAutoCreate', e.target.checked)}
                  label="Auto-create recurring templates"
                />
                <p className={styles.helpText}>
                  Automatically create recurring transaction templates when patterns are
                  detected.
                </p>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* Anomaly Detection */}
      <Card variant="bordered" padding="lg" className={styles.section}>
        <CardHeader>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon} aria-hidden="true">
              ⚠️
            </span>
            <h3 className={styles.sectionTitle}>Anomaly Detection</h3>
          </div>
          <p className={styles.sectionDescription}>
            Flag unusual transactions that don't fit your typical patterns.
          </p>
        </CardHeader>
        <CardBody>
          <div className={styles.settingGroup}>
            <Checkbox
              id="anomaly-enabled"
              checked={settings.anomalyDetectionEnabled}
              onChange={(e) => updateSetting('anomalyDetectionEnabled', e.target.checked)}
              label="Enable anomaly detection"
            />
            <p className={styles.helpText}>
              When enabled, we'll flag transactions that seem unusual (like duplicate payments
              or unexpected amounts).
            </p>
          </div>

          {settings.anomalyDetectionEnabled && (
            <>
              <div className={styles.settingGroup}>
                <label htmlFor="anomaly-min-severity" className={styles.label}>
                  Minimum severity to show
                </label>
                <select
                  id="anomaly-min-severity"
                  className={styles.select}
                  value={settings.anomalyMinSeverity}
                  onChange={(e) =>
                    updateSetting(
                      'anomalyMinSeverity',
                      e.target.value as 'low' | 'medium' | 'high'
                    )
                  }
                >
                  <option value="low">All anomalies</option>
                  <option value="medium">Medium and high only</option>
                  <option value="high">High severity only</option>
                </select>
                <p className={styles.helpText}>
                  Control how sensitive the anomaly detection is.
                </p>
              </div>

              <div className={styles.settingGroup}>
                <label htmlFor="anomaly-duplicate-threshold" className={styles.label}>
                  Duplicate detection window
                </label>
                <select
                  id="anomaly-duplicate-threshold"
                  className={styles.select}
                  value={settings.anomalyDuplicateThreshold}
                  onChange={(e) =>
                    updateSetting('anomalyDuplicateThreshold', parseInt(e.target.value))
                  }
                >
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                </select>
                <p className={styles.helpText}>
                  How far back to check for possible duplicate transactions.
                </p>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* Learning */}
      <Card variant="bordered" padding="lg" className={styles.section}>
        <CardHeader>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon} aria-hidden="true">
              📚
            </span>
            <h3 className={styles.sectionTitle}>Learning from Your Input</h3>
          </div>
          <p className={styles.sectionDescription}>
            The system improves over time by learning from your corrections.
          </p>
        </CardHeader>
        <CardBody>
          <div className={styles.settingGroup}>
            <Checkbox
              id="learning-enabled"
              checked={settings.learningEnabled}
              onChange={(e) => updateSetting('learningEnabled', e.target.checked)}
              label="Enable learning"
            />
            <p className={styles.helpText}>
              When enabled, the system learns from your categorization choices and corrections
              to improve future suggestions.
            </p>
          </div>

          {settings.learningEnabled && (
            <div className={styles.settingGroup}>
              <label htmlFor="learning-min-matches" className={styles.label}>
                Minimum matches to create pattern
              </label>
              <select
                id="learning-min-matches"
                className={styles.select}
                value={settings.learningMinMatches}
                onChange={(e) =>
                  updateSetting('learningMinMatches', parseInt(e.target.value))
                }
              >
                <option value="3">3 matches</option>
                <option value="5">5 matches</option>
                <option value="10">10 matches</option>
              </select>
              <p className={styles.helpText}>
                How many similar choices before we save it as a learned pattern.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Save Actions */}
      <div className={styles.footer}>
        {saveMessage && (
          <div
            className={styles.message}
            role="alert"
            aria-live="polite"
          >
            <span
              className={
                saveMessage.type === 'success'
                  ? styles.messageSuccess
                  : styles.messageError
              }
            >
              {saveMessage.text}
            </span>
          </div>
        )}
        <Button
          variant="primary"
          size="lg"
          onClick={handleSave}
          loading={saving}
          disabled={loading || saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}
