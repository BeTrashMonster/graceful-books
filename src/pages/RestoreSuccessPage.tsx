/**
 * Restore Success Page
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 3, Task 3.6 (Chunk 3I):
 * Celebration page shown after successful backup restoration.
 *
 * Features:
 * - Success celebration with animated checkmark
 * - Summary of what was restored
 * - Next steps guidance with Steadiness communication
 * - Link to dashboard to continue working
 * - Security notice about one-time link deactivation
 *
 * Communication Style:
 * - Steadiness (S): Patient, reassuring, supportive
 * - "Welcome back!" tone
 * - Clear next steps without pressure
 * - Emphasis on safety and security
 */

import { useNavigate } from 'react-router-dom'
import styles from './RestoreSuccessPage.module.css'

/**
 * Restore Success Page Component
 */
export function RestoreSuccessPage() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.successCard}>
          {/* Celebration Section */}
          <div className={styles.celebration}>
            <div className={styles.checkmark}>✓</div>
            <h1 className={styles.title}>Welcome Back!</h1>
            <p className={styles.subtitle}>
              Your backup has been restored successfully. Everything is right where you left it.
            </p>
          </div>

          {/* What We Restored */}
          <div className={styles.summary}>
            <h2 className={styles.summaryTitle}>What We Restored</h2>
            <ul className={styles.restoredList}>
              <li>Your chart of accounts</li>
              <li>All transactions and journal entries</li>
              <li>Customer and vendor contacts</li>
              <li>Invoices and bills</li>
              <li>All settings and preferences</li>
            </ul>
          </div>

          {/* Next Steps */}
          <div className={styles.nextSteps}>
            <h2 className={styles.nextStepsTitle}>What's Next?</h2>
            <p className={styles.nextStepsText}>
              Take your time getting reacquainted with your data. Everything is safe and secure,
              and you can pick up right where you left off.
            </p>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className={styles.primaryButton}
            >
              Go to Dashboard
            </button>
          </div>

          {/* Security Notice */}
          <div className={styles.securityNote}>
            <p className={styles.securityText}>
              🔒 For your security, the restoration link has been deactivated and cannot be used
              again.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
