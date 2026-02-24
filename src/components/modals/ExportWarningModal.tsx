/**
 * Export Warning Modal Component
 *
 * S7-3: Secure Data Export - Warning modal for data exports
 *
 * Displays security warnings to users before they export data,
 * ensuring they understand that exported data is not encrypted
 * and should be handled securely.
 *
 * Features:
 * - Clear security warning message
 * - Checkbox to acknowledge warning
 * - Export button disabled until acknowledged
 * - Rate limit information display
 * - Steadiness communication style (patient, supportive)
 */

import { useState } from 'react'
import { Modal } from './Modal'
import { Button } from '../core/Button'
import styles from './ExportWarningModal.module.css'

export interface ExportWarningModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean

  /**
   * Callback when user confirms export
   * Called only if user has acknowledged the warning
   */
  onConfirm: () => void

  /**
   * Callback when user cancels export
   */
  onCancel: () => void

  /**
   * Type of data being exported (for context)
   */
  entityType: string

  /**
   * Number of records being exported
   */
  recordCount?: number

  /**
   * Rate limit information (optional)
   */
  rateLimit?: {
    remaining: number
    resetsAt: number
  }

  /**
   * Whether export is currently in progress
   */
  isExporting?: boolean
}

/**
 * Format entity type for display
 */
function formatEntityType(entityType: string): string {
  const typeMap: Record<string, string> = {
    transactions: 'Transactions',
    invoices: 'Invoices',
    bills: 'Bills',
    contacts: 'Contacts',
    products: 'Products & Services',
    accounts: 'Accounts',
  }
  return typeMap[entityType] || entityType
}

/**
 * Format reset time for display
 */
function formatResetTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffMinutes = Math.ceil(diffMs / (60 * 1000))

  if (diffMinutes < 60) {
    return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`
  }

  const diffHours = Math.ceil(diffMinutes / 60)
  return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`
}

/**
 * Export Warning Modal
 *
 * Shows security warnings before data export and requires user acknowledgment.
 * Follows Steadiness communication style with patient, supportive messaging.
 *
 * @example
 * ```tsx
 * const [showWarning, setShowWarning] = useState(false)
 * const [isExporting, setIsExporting] = useState(false)
 *
 * const handleExport = async () => {
 *   setIsExporting(true)
 *   try {
 *     await performExport()
 *     setShowWarning(false)
 *   } finally {
 *     setIsExporting(false)
 *   }
 * }
 *
 * <ExportWarningModal
 *   isOpen={showWarning}
 *   onConfirm={handleExport}
 *   onCancel={() => setShowWarning(false)}
 *   entityType="transactions"
 *   recordCount={150}
 *   isExporting={isExporting}
 * />
 * ```
 */
export const ExportWarningModal = ({
  isOpen,
  onConfirm,
  onCancel,
  entityType,
  recordCount,
  rateLimit,
  isExporting = false,
}: ExportWarningModalProps) => {
  const [acknowledged, setAcknowledged] = useState(false)

  // Reset acknowledgment when modal closes
  const handleClose = () => {
    setAcknowledged(false)
    onCancel()
  }

  const handleConfirm = () => {
    if (acknowledged && !isExporting) {
      onConfirm()
    }
  }

  const displayEntityType = formatEntityType(entityType)

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Export Data - Security Notice"
      size="md"
      closeOnBackdropClick={!isExporting}
      closeOnEscape={!isExporting}
      footer={
        <div className={styles.footer}>
          <Button
            onClick={handleClose}
            variant="secondary"
            disabled={isExporting}
            aria-label="Cancel export"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            variant="primary"
            disabled={!acknowledged || isExporting}
            aria-label={acknowledged ? 'Proceed with export' : 'Acknowledge warning to enable export'}
          >
            {isExporting ? 'Exporting...' : 'Export Data'}
          </Button>
        </div>
      }
    >
      <div className={styles.content}>
        {/* Export summary */}
        <div className={styles.summary}>
          <p className={styles.summaryText}>
            You're about to export <strong>{displayEntityType}</strong>
            {recordCount !== undefined && (
              <>
                {' '}
                ({recordCount} record{recordCount !== 1 ? 's' : ''})
              </>
            )}
            .
          </p>
        </div>

        {/* Security warning box */}
        <div className={styles.warningBox} role="alert" aria-live="polite">
          <div className={styles.warningIcon} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className={styles.warningContent}>
            <h3 className={styles.warningTitle}>Important: Exported data is not encrypted</h3>
            <p className={styles.warningText}>
              Once you download this file, it will contain your financial data in plain text.
              For your security, please:
            </p>
            <ul className={styles.warningList}>
              <li>Store the file in a secure location on your device</li>
              <li>Delete the file when you no longer need it</li>
              <li>Never share the file over unsecured channels (email, messaging apps)</li>
              <li>Consider encrypting the file yourself if storing long-term</li>
            </ul>
          </div>
        </div>

        {/* Rate limit information (if provided) */}
        {rateLimit && (
          <div className={styles.rateLimitInfo}>
            <p className={styles.rateLimitText}>
              You have <strong>{rateLimit.remaining}</strong> export
              {rateLimit.remaining !== 1 ? 's' : ''} remaining.
              {rateLimit.remaining === 0 && (
                <>
                  {' '}
                  Your export quota will reset {formatResetTime(rateLimit.resetsAt)}.
                </>
              )}
            </p>
          </div>
        )}

        {/* Acknowledgment checkbox */}
        <div className={styles.acknowledgment}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={isExporting}
              className={styles.checkbox}
              aria-describedby="export-warning-description"
            />
            <span className={styles.checkboxText}>
              I understand that the exported file is not encrypted and I will handle it securely
            </span>
          </label>
        </div>

        {/* Hidden description for screen readers */}
        <div id="export-warning-description" className={styles.srOnly}>
          Check this box to confirm you understand the security implications of exporting
          unencrypted data and agree to handle the file securely.
        </div>
      </div>
    </Modal>
  )
}
