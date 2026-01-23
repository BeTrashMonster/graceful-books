/**
 * Account Customization Step Component
 *
 * Third step where users customize template accounts.
 * Reorganized into 6 numbered, hand-holdy parts:
 * Part 1: Bank accounts (checking/savings)
 * Part 2: Other assets (equipment, inventory, etc.)
 * Part 3: Credit cards
 * Part 4: Loans
 * Part 5: Income accounts
 * Part 6: Expense accounts
 */

import { type FC, useState, useCallback, useMemo, useEffect } from 'react'
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
  const [currentPart, setCurrentPart] = useState(1)
  const [expandedAccountIndex, setExpandedAccountIndex] = useState<number | null>(null)
  const [showingHelp, setShowingHelp] = useState<Set<number>>(new Set())

  // Scroll to top when part changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentPart])

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

  // Group accounts by part
  const accountsByPart = useMemo(() => {
    if (!template) return { part1: [], part2: [], part3: [], part4: [], part5: [], part6: [] }

    const part1: Array<{ customization: AccountCustomization; index: number }> = []
    const part2: Array<{ customization: AccountCustomization; index: number }> = []
    const part3: Array<{ customization: AccountCustomization; index: number }> = []
    const part4: Array<{ customization: AccountCustomization; index: number }> = []
    const part5: Array<{ customization: AccountCustomization; index: number }> = []
    const part6: Array<{ customization: AccountCustomization; index: number }> = []

    customizations.forEach((customization, index) => {
      const templateAccount = template.accounts.find(
        (a) => a.name === customization.templateAccountName
      )
      if (!templateAccount) return

      // Part 1: Bank accounts (checking/savings/cash)
      if (templateAccount.type === 'asset' &&
          (templateAccount.name.toLowerCase().includes('checking') ||
           templateAccount.name.toLowerCase().includes('savings') ||
           templateAccount.name.toLowerCase().includes('cash'))) {
        part1.push({ customization, index })
      }
      // Part 2: Other assets
      else if (templateAccount.type === 'asset') {
        part2.push({ customization, index })
      }
      // Part 3: Credit cards
      else if (templateAccount.type === 'liability' &&
               templateAccount.name.toLowerCase().includes('credit')) {
        part3.push({ customization, index })
      }
      // Part 4: Loans
      else if (templateAccount.type === 'liability') {
        part4.push({ customization, index })
      }
      // Part 5: Income
      else if (templateAccount.type === 'income' || templateAccount.type === 'other-income') {
        part5.push({ customization, index })
      }
      // Part 6: Expenses
      else if (templateAccount.type === 'expense' ||
               templateAccount.type === 'cost-of-goods-sold' ||
               templateAccount.type === 'other-expense') {
        part6.push({ customization, index })
      }
    })

    return { part1, part2, part3, part4, part5, part6 }
  }, [template, customizations])

  const includedCount = customizations.filter((c) => c.isIncluded).length

  const handlePartNext = () => {
    if (currentPart < 6) {
      setCurrentPart(currentPart + 1)
    } else {
      onNext()
    }
  }

  const handlePartBack = () => {
    if (currentPart > 1) {
      setCurrentPart(currentPart - 1)
    } else {
      onBack()
    }
  }

  const renderAccountCard = (customization: AccountCustomization, index: number) => {
    const templateAccount = template!.accounts.find(
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
  }

  const renderPart = () => {
    switch (currentPart) {
      case 1:
        return (
          <>
            <div className={styles.partHeader}>
              <h3 className={styles.partTitle}>Part 1: Your Bank Accounts</h3>
              <p className={styles.partDescription}>
                Let's start with your checking and savings accounts. These are the foundation of your bookkeeping.
              </p>
            </div>
            <div className={styles.tableHeader}>
              <div className={styles.headerAccount}>Account Name</div>
              <div className={styles.headerHelp}>Learn More</div>
              <div className={styles.headerEdit}>Edit</div>
            </div>
            <div className={styles.accountsList}>
              {accountsByPart.part1.length > 0 ? (
                accountsByPart.part1.map(({ customization, index }) =>
                  renderAccountCard(customization, index)
                )
              ) : (
                <p className={styles.emptyMessage}>No bank accounts in this template.</p>
              )}
            </div>
          </>
        )

      case 2:
        return (
          <>
            <div className={styles.partHeader}>
              <h3 className={styles.partTitle}>Part 2: Other Assets</h3>
              <p className={styles.partDescription}>
                Do you need to track big purchases like equipment, inventory, or money owed to you? Select what applies.
              </p>
            </div>
            <div className={styles.tableHeader}>
              <div className={styles.headerAccount}>Account Name</div>
              <div className={styles.headerHelp}>Learn More</div>
              <div className={styles.headerEdit}>Edit</div>
            </div>
            <div className={styles.accountsList}>
              {accountsByPart.part2.length > 0 ? (
                accountsByPart.part2.map(({ customization, index }) =>
                  renderAccountCard(customization, index)
                )
              ) : (
                <p className={styles.emptyMessage}>No other assets in this template. You can skip this step!</p>
              )}
            </div>
          </>
        )

      case 3:
        return (
          <>
            <div className={styles.partHeader}>
              <h3 className={styles.partTitle}>Part 3: Credit Cards</h3>
              <p className={styles.partDescription}>
                List your business credit cards here. We'll help you track what you owe on each.
              </p>
            </div>
            <div className={styles.tableHeader}>
              <div className={styles.headerAccount}>Account Name</div>
              <div className={styles.headerHelp}>Learn More</div>
              <div className={styles.headerEdit}>Edit</div>
            </div>
            <div className={styles.accountsList}>
              {accountsByPart.part3.length > 0 ? (
                accountsByPart.part3.map(({ customization, index }) =>
                  renderAccountCard(customization, index)
                )
              ) : (
                <p className={styles.emptyMessage}>No credit card accounts in this template. You can skip this step!</p>
              )}
            </div>
          </>
        )

      case 4:
        return (
          <>
            <div className={styles.partHeader}>
              <h3 className={styles.partTitle}>Part 4: Loans</h3>
              <p className={styles.partDescription}>
                Do you have any business loans? Track them here to see what you owe and when.
              </p>
            </div>
            <div className={styles.tableHeader}>
              <div className={styles.headerAccount}>Account Name</div>
              <div className={styles.headerHelp}>Learn More</div>
              <div className={styles.headerEdit}>Edit</div>
            </div>
            <div className={styles.accountsList}>
              {accountsByPart.part4.length > 0 ? (
                accountsByPart.part4.map(({ customization, index }) =>
                  renderAccountCard(customization, index)
                )
              ) : (
                <p className={styles.emptyMessage}>No loan accounts in this template. You can skip this step!</p>
              )}
            </div>
          </>
        )

      case 5:
        return (
          <>
            <div className={styles.partHeader}>
              <h3 className={styles.partTitle}>Part 5: Income</h3>
              <p className={styles.partDescription}>
                What do you call the money coming into your business? You can customize these names to match how you think about your revenue.
              </p>
            </div>
            <div className={styles.tableHeader}>
              <div className={styles.headerAccount}>Account Name</div>
              <div className={styles.headerHelp}>Learn More</div>
              <div className={styles.headerEdit}>Edit</div>
            </div>
            <div className={styles.accountsList}>
              {accountsByPart.part5.length > 0 ? (
                accountsByPart.part5.map(({ customization, index }) =>
                  renderAccountCard(customization, index)
                )
              ) : (
                <p className={styles.emptyMessage}>No income accounts in this template.</p>
              )}
            </div>
          </>
        )

      case 6:
        return (
          <>
            <div className={styles.partHeader}>
              <h3 className={styles.partTitle}>Part 6: Expenses</h3>
              <p className={styles.partDescription}>
                Finally, select the expense categories that apply to your business. Don't worry about getting everything perfect - you can always add more later!
              </p>
            </div>
            <div className={styles.tableHeader}>
              <div className={styles.headerAccount}>Account Name</div>
              <div className={styles.headerHelp}>Learn More</div>
              <div className={styles.headerEdit}>Edit</div>
            </div>
            <div className={styles.accountsList}>
              {accountsByPart.part6.length > 0 ? (
                accountsByPart.part6.map(({ customization, index }) =>
                  renderAccountCard(customization, index)
                )
              ) : (
                <p className={styles.emptyMessage}>No expense accounts in this template.</p>
              )}
            </div>
          </>
        )

      default:
        return null
    }
  }

  return (
    <div className={styles.customizationStep}>
      <div className={styles.intro}>
        <p className={styles.accountCount}>
          <strong>{includedCount} accounts</strong> will be created
        </p>
        <div className={styles.partProgress}>
          Part {currentPart} of 6
        </div>
      </div>

      {renderPart()}

      <div className={styles.infoBox}>
        <h4 className={styles.infoTitle}>Need something else?</h4>
        <p className={styles.infoText}>
          No problem! After this wizard, you can add more accounts anytime from your Chart of Accounts page.
        </p>
      </div>

      <div className={styles.actions}>
        <Button variant="outline" onClick={handlePartBack}>
          {currentPart === 1 ? 'Back to template' : 'Previous'}
        </Button>
        <Button
          variant="primary"
          onClick={handlePartNext}
          disabled={includedCount === 0}
        >
          {currentPart === 6 ? 'Continue to review' : 'Next'}
        </Button>
      </div>
    </div>
  )
}
