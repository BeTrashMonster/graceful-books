/**
 * Welcome Step Component
 *
 * First step of the Chart of Accounts wizard.
 * Sets an encouraging, judgment-free tone using Steadiness communication style.
 */

import { type FC } from 'react'
import { Button } from '../../core/Button'
import styles from './WelcomeStep.module.css'

export interface WelcomeStepProps {
  onNext: () => void
}

/**
 * Welcome Step Component
 */
export const WelcomeStep: FC<WelcomeStepProps> = ({ onNext }) => {
  return (
    <div className={styles.welcomeStep}>
      <div className={styles.content}>
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>What is a chart of accounts?</h4>
          <p className={styles.sectionText}>
            Think of it as the organizing system for your business money. It's like having labeled folders for different types of income and expenses.
            This helps you see where money comes from and where it goes.
          </p>
        </div>

        <div className={styles.reassurance}>
          <p>
            <strong>Don't worry about getting it perfect.</strong> You can add, edit, or remove accounts whenever you need to.
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        <Button
          variant="primary"
          size="lg"
          onClick={onNext}
          fullWidth
        >
          Let's get started
        </Button>
      </div>
    </div>
  )
}
