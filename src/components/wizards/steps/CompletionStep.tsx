/**
 * Completion Step Component
 *
 * Final step celebrating successful wizard completion.
 * Uses encouraging, judgment-free language per DISC Steadiness style.
 */

import { type FC, useEffect } from 'react'
import { Button } from '../../core/Button'
import { triggerConfetti } from '../../../utils/confetti'
import styles from './CompletionStep.module.css'

export interface CompletionStepProps {
  accountCount: number
  onComplete: () => void
}

/**
 * Completion Step Component
 */
export const CompletionStep: FC<CompletionStepProps> = ({
  accountCount,
  onComplete,
}) => {
  // Trigger celebration animation on mount
  useEffect(() => {
    // Small delay to let the step render first
    const timer = setTimeout(() => {
      triggerConfetti()
    }, 300)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={styles.completionStep}>
      <div className={styles.celebration}>
        <div className={styles.icon} role="img" aria-label="Success">
          ✓
        </div>
        <h3 className={styles.headline}>
          Your chart of accounts is ready!
        </h3>
        <p className={styles.subheadline}>
          That was easier than expected, right?
        </p>
      </div>

      <div className={styles.summary}>
        <p className={styles.summaryText}>
          We've created <strong>{accountCount} accounts</strong> to help you organize your business finances.
          You can start recording transactions right away.
        </p>
      </div>

      <div className={styles.nextSteps}>
        <h4 className={styles.nextStepsTitle}>What's next?</h4>
        <ul className={styles.stepsList}>
          <li>
            <strong>Record your first transaction</strong> - Start tracking income and expenses
          </li>
          <li>
            <strong>Add more accounts if needed</strong> - You can customize anytime
          </li>
          <li>
            <strong>Explore reports</strong> - See your financial picture at a glance
          </li>
        </ul>
      </div>

      <div className={styles.encouragement}>
        <p>
          You're building something great. We're here to support you every step of the way.
        </p>
      </div>

      <div className={styles.actions}>
        <Button
          variant="primary"
          size="lg"
          onClick={onComplete}
          fullWidth
        >
          Go to Chart of Accounts
        </Button>
      </div>
    </div>
  )
}
