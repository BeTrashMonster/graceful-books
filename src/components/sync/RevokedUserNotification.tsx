/**
 * Revoked User Notification Component
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 6, Task 6.4:
 * Shows clear, respectful notification to revoked users.
 *
 * UX Principles:
 * - Never blame the user
 * - Clear explanation of what happened
 * - What they can still do
 * - What they cannot do
 * - Clear next steps
 *
 * Joy Engineering: "Dignity in every interaction 🤝"
 */

import { useState } from 'react'
import type { RevocationStatus } from '../../services/sync/RevocationHandler'
import {
  formatRevocationMessage,
  formatShortRevocationNotice,
  getSuggestedActions,
  getRevokedUserCapabilities,
} from '../../services/sync/RevocationHandler'
import styles from './RevokedUserNotification.module.css'

/**
 * Revoked User Notification Props
 */
export interface RevokedUserNotificationProps {
  /**
   * Revocation status
   */
  status: RevocationStatus

  /**
   * Admin contact email (optional)
   */
  adminEmail?: string

  /**
   * Display mode (banner for persistent top bar, modal for full explanation)
   */
  mode?: 'banner' | 'modal'

  /**
   * Called when user dismisses the notification
   */
  onDismiss?: () => void

  /**
   * Called when user wants to export data
   */
  onExportData?: () => void

  /**
   * Called when user wants to view local data
   */
  onViewLocalData?: () => void
}

/**
 * Revoked User Notification Component
 *
 * Shows a clear, supportive message to users whose access has been revoked.
 * Provides information about what they can still do and next steps.
 *
 * @example
 * ```tsx
 * // Banner mode (persistent top bar)
 * <RevokedUserNotification
 *   status={revocationStatus}
 *   adminEmail="admin@company.com"
 *   mode="banner"
 *   onExportData={handleExport}
 * />
 *
 * // Modal mode (full explanation)
 * <RevokedUserNotification
 *   status={revocationStatus}
 *   adminEmail="admin@company.com"
 *   mode="modal"
 *   onDismiss={handleDismiss}
 * />
 * ```
 */
export function RevokedUserNotification({
  status,
  adminEmail,
  mode = 'modal',
  onDismiss,
  onExportData,
  onViewLocalData,
}: RevokedUserNotificationProps) {
  const [showDetails, setShowDetails] = useState(false)
  const capabilities = getRevokedUserCapabilities()
  const suggestedActions = getSuggestedActions(adminEmail)

  // Don't show if not revoked
  if (!status.isRevoked) {
    return null
  }

  // Banner mode - persistent top bar
  if (mode === 'banner') {
    return (
      <div className={styles.banner} role="alert" aria-live="polite">
        <div className={styles.bannerContent}>
          <span className={styles.bannerIcon} aria-hidden="true">
            ⚠️
          </span>
          <span className={styles.bannerText}>
            {formatShortRevocationNotice(adminEmail)}
          </span>
          <div className={styles.bannerActions}>
            {onViewLocalData && (
              <button
                type="button"
                onClick={onViewLocalData}
                className={styles.bannerButton}
              >
                View Local Data
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className={styles.bannerButtonSecondary}
            >
              Learn More
            </button>
          </div>
        </div>

        {/* Details modal (shown when Learn More clicked) */}
        {showDetails && (
          <div className={styles.modalOverlay} onClick={() => setShowDetails(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>Access Revoked</h2>
                <button
                  type="button"
                  onClick={() => setShowDetails(false)}
                  className={styles.modalClose}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className={styles.modalBody}>
                <p className={styles.modalMessage}>
                  {formatRevocationMessage(status, adminEmail)}
                </p>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setShowDetails(false)}
                  className={styles.modalButton}
                >
                  I Understand
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Modal mode - full explanation
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="revocation-title">
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 id="revocation-title" className={styles.modalTitle}>
            Access Revoked
          </h2>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className={styles.modalClose}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* Main message */}
          <div className={styles.messageSection}>
            <span className={styles.messageIcon} aria-hidden="true">
              🔐
            </span>
            <p className={styles.messagePrimary}>
              Your access to this company account has been revoked.
            </p>
          </div>

          {/* What this means */}
          <div className={styles.infoSection}>
            <h3 className={styles.infoTitle}>What this means:</h3>
            <ul className={styles.infoList}>
              <li className={styles.infoItem}>
                <span className={styles.infoIcon} aria-hidden="true">✗</span>
                You can no longer sync data with the company
              </li>
              <li className={styles.infoItem}>
                <span className={styles.infoIcon} aria-hidden="true">✗</span>
                You cannot create or modify transactions
              </li>
              <li className={styles.infoItem}>
                <span className={styles.infoIconPositive} aria-hidden="true">✓</span>
                Your local data remains accessible (read-only)
              </li>
            </ul>
          </div>

          {/* What you can do */}
          <div className={styles.infoSection}>
            <h3 className={styles.infoTitle}>What you can do:</h3>
            <ul className={styles.infoList}>
              {capabilities.canViewLocalData && (
                <li className={styles.infoItem}>
                  <span className={styles.infoIconPositive} aria-hidden="true">✓</span>
                  View all your local data
                </li>
              )}
              {capabilities.canExport && (
                <li className={styles.infoItem}>
                  <span className={styles.infoIconPositive} aria-hidden="true">✓</span>
                  Export your local data for your records
                </li>
              )}
              {capabilities.canAccessHistoricalBackups && (
                <li className={styles.infoItem}>
                  <span className={styles.infoIconPositive} aria-hidden="true">✓</span>
                  Access any historical backups you received
                </li>
              )}
            </ul>
          </div>

          {/* Next steps */}
          <div className={styles.infoSection}>
            <h3 className={styles.infoTitle}>Next steps:</h3>
            <ul className={styles.infoList}>
              {suggestedActions.map((action, index) => (
                <li key={index} className={styles.infoItem}>
                  <span className={styles.infoIconNeutral} aria-hidden="true">→</span>
                  {action}
                </li>
              ))}
            </ul>
          </div>

          {/* Technical details (collapsible) */}
          <details className={styles.technicalDetails}>
            <summary className={styles.technicalSummary}>
              Technical Details
            </summary>
            <div className={styles.technicalContent}>
              <p>
                <strong>Current Epoch:</strong> {status.currentEpoch}
              </p>
              <p>
                <strong>Your Epoch:</strong> {status.clientEpoch}
              </p>
              <p>
                <strong>Difference:</strong> {status.epochDifference} rotation{status.epochDifference === 1 ? '' : 's'}
              </p>
              <p>
                <strong>Detected:</strong> {status.detectedAt.toLocaleString()}
              </p>
            </div>
          </details>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          {onViewLocalData && (
            <button
              type="button"
              onClick={onViewLocalData}
              className={styles.modalButtonSecondary}
            >
              View Local Data
            </button>
          )}
          {onExportData && (
            <button
              type="button"
              onClick={onExportData}
              className={styles.modalButtonSecondary}
            >
              Export Data
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className={styles.modalButton}
            >
              I Understand
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
