/**
 * Review Step Component
 *
 * Fourth step where users review their selections before creation.
 * Shows a summary of all accounts to be created.
 */

import { type FC, useMemo } from 'react'
import { Button } from '../../core/Button'
import type { IndustryTemplate, AccountCustomization } from '../../../types/wizard.types'
import type { AccountType } from '../../../types'
import styles from './ReviewStep.module.css'

export interface ReviewStepProps {
  template?: IndustryTemplate
  customizations: AccountCustomization[]
  customAccounts: Array<{
    name: string
    accountNumber?: string
    type: AccountType
    description?: string
  }>
  onConfirm: () => void
  onBack: () => void
  isSubmitting: boolean
}

/**
 * Review Step Component
 */
export const ReviewStep: FC<ReviewStepProps> = ({
  template,
  customizations,
  customAccounts,
  onConfirm,
  onBack,
  isSubmitting,
}) => {
  const accountsByType = useMemo(() => {
    const grouped: Record<string, AccountCustomization[]> = {}

    customizations
      .filter((c) => c.isIncluded)
      .forEach((customization) => {
        const templateAccount = template?.accounts.find(
          (a) => a.name === customization.templateAccountName
        )
        if (!templateAccount) return

        const type = templateAccount.type
        if (!grouped[type]) {
          grouped[type] = []
        }
        grouped[type].push(customization)
      })

    return grouped
  }, [customizations, template])

  const totalAccounts = customizations.filter((c) => c.isIncluded).length + customAccounts.length

  const typeOrder: AccountType[] = [
    'asset',
    'liability',
    'equity',
    'income',
    'expense',
    'cost-of-goods-sold',
    'other-income',
    'other-expense',
  ]

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'asset': 'Assets',
      'liability': 'Liabilities',
      'equity': 'Equity',
      'income': 'Income',
      'expense': 'Expenses',
      'cost-of-goods-sold': 'Cost of Goods Sold',
      'other-income': 'Other Income',
      'other-expense': 'Other Expenses',
    }
    return labels[type] || type
  }

  const getTypeDescription = (type: string): string => {
    const descriptions: Record<string, string> = {
      'asset': 'Things your business owns',
      'liability': 'Money you owe',
      'equity': 'Your ownership stake',
      'income': 'Money coming in',
      'expense': 'Money going out',
      'cost-of-goods-sold': 'Direct costs of products sold',
      'other-income': 'Income from non-primary sources',
      'other-expense': 'Non-operating expenses',
    }
    return descriptions[type] || ''
  }

  return (
    <div className={styles.reviewStep}>
      <div className={styles.intro}>
        <p className={styles.introText}>
          Here's what we're about to create. Take a moment to make sure everything looks good.
        </p>
        <p className={styles.totalAccounts}>
          We'll create <strong>{totalAccounts} accounts</strong> for you
        </p>
      </div>

      <div className={styles.summary}>
        {typeOrder.map((type) => {
          const accounts = accountsByType[type]
          if (!accounts || accounts.length === 0) return null

          return (
            <div key={type} className={styles.typeSection}>
              <div className={styles.typeHeader}>
                <h4 className={styles.typeName}>{getTypeLabel(type)}</h4>
                <p className={styles.typeDescription}>{getTypeDescription(type)}</p>
              </div>

              <ul className={styles.accountList}>
                {accounts.map((account, index) => (
                  <li key={index} className={styles.accountItem}>
                    <span className={styles.accountName}>
                      {account.accountNumber && (
                        <span className={styles.accountNumber}>
                          {account.accountNumber}
                        </span>
                      )}
                      {account.name}
                    </span>
                    {account.description && (
                      <span className={styles.accountDescription}>
                        {account.description}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <div className={styles.reassurance}>
        <p>
          <strong>Remember:</strong> You can add, edit, or remove accounts anytime after setup.
          Nothing here is permanent - we can always adjust things as your business grows.
        </p>
      </div>

      <div className={styles.actions}>
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          Back to make changes
        </Button>
        <Button
          variant="primary"
          onClick={onConfirm}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating accounts...' : 'Create my accounts'}
        </Button>
      </div>
    </div>
  )
}
