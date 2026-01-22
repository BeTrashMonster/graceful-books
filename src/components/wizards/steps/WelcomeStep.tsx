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

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>What we'll do:</h4>
          <ul className={styles.stepList}>
            <li>
              <strong>Pick a starting point</strong> - We'll suggest accounts based on your type of business
            </li>
            <li>
              <strong>Customize it</strong> - Add, remove, or rename accounts to fit your needs
            </li>
            <li>
              <strong>Review together</strong> - Make sure everything looks right before we're done
            </li>
          </ul>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>How long will this take?</h4>
          <p className={styles.sectionText}>
            Most people finish in about 5-10 minutes. You can save your progress and come back anytime - there's no rush.
          </p>
        </div>

        <div className={styles.reassurance}>
          <p>
            <strong>Don't worry about getting it perfect.</strong> You can add, edit, or remove accounts whenever you need to.
            This is just a starting point to help you get organized.
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
