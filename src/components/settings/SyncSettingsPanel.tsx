/**
 * Sync Settings Panel
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 4, Task 4.5 (Chunk 4E):
 * UI for configuring encrypted sync relay settings.
 *
 * Features:
 * - Enable/disable sync
 * - Choose Audacious-hosted or self-hosted relay
 * - Configure relay URL for self-hosted
 * - View sync status and statistics
 * - Clear queue if needed
 *
 * Communication:
 * - Steadiness style: Patient, clear, reassuring
 * - Plain explanations of technical concepts
 * - Never blame the user
 */

import React, { useState, useEffect } from 'react'
import {
  type SyncConfig,
  DEFAULT_SYNC_CONFIG,
  SELF_HOSTED_SYNC_CONFIG,
  validateSyncConfig,
  SyncConnectionStatus,
  type SyncStatistics,
} from '../../config/syncConfig'
import styles from './SyncSettingsPanel.module.css'

export interface SyncSettingsPanelProps {
  /** Current user ID */
  userId: string
  /** Current sync configuration */
  initialConfig?: Partial<SyncConfig>
  /** Current sync statistics */
  statistics?: SyncStatistics
  /** Callback when settings are saved */
  onSave?: (config: Partial<SyncConfig>) => void
  /** Callback to clear sync queue */
  onClearQueue?: () => void
}

/**
 * Sync Settings Panel Component
 */
export function SyncSettingsPanel({
  userId,
  initialConfig = {},
  statistics,
  onSave,
  onClearQueue,
}: SyncSettingsPanelProps) {
  const [enabled, setEnabled] = useState(initialConfig.enabled ?? false)
  const [selfHosted, setSelfHosted] = useState(initialConfig.selfHosted ?? false)
  const [relayUrl, setRelayUrl] = useState(
    initialConfig.relayUrl ??
      (initialConfig.selfHosted ? '' : DEFAULT_SYNC_CONFIG.relayUrl)
  )
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Track changes
  useEffect(() => {
    const currentConfig = {
      enabled,
      selfHosted,
      relayUrl,
    }

    const initial = {
      enabled: initialConfig.enabled ?? false,
      selfHosted: initialConfig.selfHosted ?? false,
      relayUrl:
        initialConfig.relayUrl ??
        (initialConfig.selfHosted ? '' : DEFAULT_SYNC_CONFIG.relayUrl),
    }

    const changed =
      currentConfig.enabled !== initial.enabled ||
      currentConfig.selfHosted !== initial.selfHosted ||
      currentConfig.relayUrl !== initial.relayUrl

    setHasChanges(changed)
  }, [enabled, selfHosted, relayUrl, initialConfig])

  const handleEnabledToggle = () => {
    setEnabled(!enabled)
    setSaveSuccess(false)
  }

  const handleRelayTypeChange = (isSelfHosted: boolean) => {
    setSelfHosted(isSelfHosted)
    if (!isSelfHosted) {
      // Reset to default Audacious URL
      setRelayUrl(DEFAULT_SYNC_CONFIG.relayUrl)
    } else {
      // Clear URL for self-hosted
      setRelayUrl('')
    }
    setSaveSuccess(false)
  }

  const handleRelayUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRelayUrl(e.target.value.trim())
    setSaveSuccess(false)
  }

  const handleSave = async () => {
    // Validate configuration
    const config: Partial<SyncConfig> = {
      enabled,
      selfHosted,
      relayUrl,
    }

    const validation = validateSyncConfig(config)
    if (!validation.valid) {
      setValidationErrors(validation.errors)
      return
    }

    setValidationErrors([])
    setIsSaving(true)

    // Simulate save delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    if (onSave) {
      onSave(config)
    }

    setHasChanges(false)
    setSaveSuccess(true)
    setIsSaving(false)

    // Hide success message after 3 seconds
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  const handleClearQueue = () => {
    if (onClearQueue) {
      onClearQueue()
    }
  }

  const getStatusColor = (status?: SyncConnectionStatus): string => {
    if (!status) return styles.statusDisconnected
    switch (status) {
      case SyncConnectionStatus.CONNECTED:
        return styles.statusConnected
      case SyncConnectionStatus.CONNECTING:
      case SyncConnectionStatus.RECONNECTING:
        return styles.statusConnecting
      case SyncConnectionStatus.ERROR:
        return styles.statusError
      default:
        return styles.statusDisconnected
    }
  }

  const getStatusText = (status?: SyncConnectionStatus): string => {
    if (!enabled) return 'Disabled'
    if (!status) return 'Not connected'
    switch (status) {
      case SyncConnectionStatus.CONNECTED:
        return 'Connected'
      case SyncConnectionStatus.CONNECTING:
        return 'Connecting...'
      case SyncConnectionStatus.RECONNECTING:
        return 'Reconnecting...'
      case SyncConnectionStatus.ERROR:
        return 'Connection error'
      case SyncConnectionStatus.DISCONNECTED:
        return 'Disconnected'
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Real-Time Sync</h2>
        <p className={styles.subtitle}>
          Keep your data in sync across all your devices in real-time. All data is encrypted
          before syncing—we can't see any of it.
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className={styles.section}>
        <div className={styles.toggleRow}>
          <div className={styles.toggleLabel}>
            <strong>Enable Real-Time Sync</strong>
            <p className={styles.help}>
              Automatically sync changes across your devices as you work
            </p>
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={handleEnabledToggle}
              aria-label="Enable sync"
            />
            <span className={styles.toggleSlider}></span>
          </label>
        </div>
      </div>

      {/* Relay Configuration */}
      {enabled && (
        <>
          <div className={styles.section}>
            <label className={styles.label}>
              Sync Relay
              <span className={styles.help}>Choose where your encrypted data is relayed</span>
            </label>

            <div className={styles.radioGroup}>
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="relayType"
                  checked={!selfHosted}
                  onChange={() => handleRelayTypeChange(false)}
                />
                <div className={styles.radioContent}>
                  <strong>Audacious-Hosted (Recommended)</strong>
                  <p className={styles.radioHelp}>
                    We handle the infrastructure. Your data stays encrypted—we can't read it.
                  </p>
                </div>
              </label>

              <label className={styles.radio}>
                <input
                  type="radio"
                  name="relayType"
                  checked={selfHosted}
                  onChange={() => handleRelayTypeChange(true)}
                />
                <div className={styles.radioContent}>
                  <strong>Self-Hosted</strong>
                  <p className={styles.radioHelp}>
                    Run your own sync relay server. Requires technical setup.
                  </p>
                </div>
              </label>
            </div>

            {selfHosted && (
              <div className={styles.inputGroup}>
                <label htmlFor="relayUrl" className={styles.inputLabel}>
                  Relay URL
                </label>
                <input
                  id="relayUrl"
                  type="text"
                  className={styles.input}
                  value={relayUrl}
                  onChange={handleRelayUrlChange}
                  placeholder="wss://your-relay.example.com"
                  aria-describedby="relay-url-help"
                />
                <p id="relay-url-help" className={styles.inputHelp}>
                  Must start with wss:// (secure WebSocket)
                </p>
              </div>
            )}
          </div>

          {/* Sync Status */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Sync Status</h3>

            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Connection:</span>
              <span className={`${styles.statusBadge} ${getStatusColor(statistics?.status)}`}>
                {getStatusText(statistics?.status)}
              </span>
            </div>

            {statistics && (
              <>
                <div className={styles.statsGrid}>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{statistics.messagesSent}</span>
                    <span className={styles.statLabel}>Messages Sent</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{statistics.messagesReceived}</span>
                    <span className={styles.statLabel}>Messages Received</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{statistics.pendingMessages}</span>
                    <span className={styles.statLabel}>Pending</span>
                  </div>
                </div>

                {statistics.lastSyncAt && (
                  <p className={styles.lastSync}>
                    Last synced: {new Date(statistics.lastSyncAt).toLocaleString()}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Advanced Settings */}
          <div className={styles.section}>
            <button
              type="button"
              className={styles.advancedToggle}
              onClick={() => setShowAdvanced(!showAdvanced)}
              aria-expanded={showAdvanced}
            >
              {showAdvanced ? '▼' : '▶'} Advanced Settings
            </button>

            {showAdvanced && (
              <div className={styles.advanced}>
                <p className={styles.advancedHelp}>
                  These actions are permanent and cannot be undone.
                </p>

                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={handleClearQueue}
                  disabled={!statistics || statistics.pendingMessages === 0}
                >
                  Clear Pending Queue
                </button>
                <p className={styles.dangerHelp}>
                  Removes all pending messages. Use if messages are stuck.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className={styles.errors} role="alert">
          <strong>Please check the following:</strong>
          <ul>
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Save Button */}
      {hasChanges && (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.saveButton}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Success Message */}
      {saveSuccess && (
        <div className={styles.successBanner} role="status">
          <span>✓ Sync settings saved successfully!</span>
        </div>
      )}
    </div>
  )
}
