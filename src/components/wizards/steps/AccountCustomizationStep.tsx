/**
 * Account Customization Step Component
 *
 * Third step where users customize template accounts.
 * Features:
 * - Toggle accounts on/off
 * - Rename accounts
 * - Edit account numbers
 * - Plain English explanations
 * - Educational tooltips
 * - Add custom accounts
 */

import { type FC, useState, useCallback } from 'react'
import { Button } from '../../core/Button'
import { Input } from '../../forms/Input'
import { Checkbox } from '../../forms/Checkbox'
import type { IndustryTemplate, AccountCustomization } from '../../../types/wizard.types'
import styles from './AccountCustomizationStep.module.css'

export interface AccountCustomizationStepProps {
  template?: IndustryTemplate
  customizations: AccountCustomization[]
  onUpdate: (customizations: AccountCustomization[]) => void
  onNext: () => void
  onBack: () => void
}

/**
 * Account Customization Step Component
 */
export const AccountCustomizationStep: FC<AccountCustomizationStepProps> = ({
  template,
  customizations,
  onUpdate,
  onNext,
  onBack,
}) => {
  const [expandedAccountIndex, setExpandedAccountIndex] = useState<number | null>(null)
  const [showingHelp, setShowingHelp] = useState<Set<number>>(new Set())

  if (!template) {
    return (
      <div className={styles.error}>
        <p>No template selected. Please go back and select a template.</p>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
      </div>
    )
  }

  const handleToggleAccount = useCallback((index: number) => {
    const updated = [...customizations]
    updated[index] = {
      ...updated[index]!,
      isIncluded: !updated[index]!.isIncluded,
    }
    onUpdate(updated)
  }, [customizations, onUpdate])

  const handleUpdateName = useCallback((index: number, name: string) => {
    const updated = [...customizations]
    updated[index] = { ...updated[index]!, name }
    onUpdate(updated)
  }, [customizations, onUpdate])

  const handleUpdateAccountNumber = useCallback((index: number, accountNumber: string) => {
    const updated = [...customizations]
    updated[index] = { ...updated[index]!, accountNumber }
    onUpdate(updated)
  }, [customizations, onUpdate])

  const handleToggleExpanded = useCallback((index: number) => {
    setExpandedAccountIndex((prev) => (prev === index ? null : index))
  }, [])

  const handleToggleHelp = useCallback((index: number) => {
    setShowingHelp((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const includedCount = customizations.filter((c) => c.isIncluded).length

  return (
    <div className={styles.customizationStep}>
      <div className={styles.intro}>
        <p className={styles.introText}>
          Here are the accounts we've suggested for your business. You can include or skip any of them.
        </p>
        <p className={styles.accountCount}>
          <strong>{includedCount} accounts</strong> will be created
        </p>
      </div>

      <div className={styles.tableHeader}>
        <div className={styles.headerAccount}>Account Name</div>
        <div className={styles.headerHelp}>Learn More</div>
        <div className={styles.headerEdit}>Edit</div>
      </div>

      <div className={styles.accountsList}>
        {customizations.map((customization, index) => {
          const templateAccount = template.accounts.find(
            (a) => a.name === customization.templateAccountName
          )
          if (!templateAccount) return null

          const isExpanded = expandedAccountIndex === index
          const isShowingHelp = showingHelp.has(index)
          const isRequired = templateAccount.isRequired

          return (
            <div
              key={index}
              className={`${styles.accountCard} ${
                customization.isIncluded ? styles.included : styles.excluded
              } ${isExpanded ? styles.expanded : ''}`}
            >
              <div className={styles.accountHeader}>
                <Checkbox
                  label={customization.name}
                  checked={customization.isIncluded}
                  onChange={() => handleToggleAccount(index)}
                  disabled={isRequired}
                  helperText={isRequired ? 'Required account' : undefined}
                />
                <button
                  type="button"
                  className={styles.helpButton}
                  onClick={() => handleToggleHelp(index)}
                  aria-label="Learn more about this account"
                  aria-expanded={isShowingHelp}
                >
                  {isShowingHelp ? '✕' : '?'}
                </button>
                {customization.isIncluded && (
                  <button
                    type="button"
                    className={styles.expandButton}
                    onClick={() => handleToggleExpanded(index)}
                    aria-label={isExpanded ? 'Collapse' : 'Expand to edit'}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                )}
              </div>

              {isShowingHelp && (
                <div className={styles.helpText} role="region" aria-label="Account explanation">
                  <p className={styles.explanation}>{templateAccount.explanation}</p>
                  <p className={styles.description}>
                    <em>{templateAccount.description}</em>
                  </p>
                </div>
              )}

              {isExpanded && customization.isIncluded && (
                <div className={styles.accountEdit}>
                  <Input
                    label="Account Name"
                    value={customization.name}
                    onChange={(e) => handleUpdateName(index, e.target.value)}
                    fullWidth
                    helperText="Customize the name if you'd like"
                  />
                  <Input
                    label="Account Number (optional)"
                    value={customization.accountNumber || ''}
                    onChange={(e) => handleUpdateAccountNumber(index, e.target.value)}
                    fullWidth
                    placeholder="e.g., 1000"
                    helperText="For organizing your accounts"
                  />
                </div>
              )}

              <div className={styles.accountMeta}>
                <span className={styles.accountType}>
                  {templateAccount.type.replace(/-/g, ' ')}
                </span>
                {templateAccount.accountNumber && (
                  <span className={styles.accountNumber}>
                    #{templateAccount.accountNumber}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className={styles.infoBox}>
        <h4 className={styles.infoTitle}>Need something else?</h4>
        <p className={styles.infoText}>
          No problem! After this wizard, you can add more accounts anytime from your Chart of Accounts page.
        </p>
      </div>

      <div className={styles.actions}>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={onNext}
          disabled={includedCount === 0}
        >
          Continue to review
        </Button>
      </div>
    </div>
  )
}
