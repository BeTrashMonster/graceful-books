/**
 * Account Customization Step Component (Refactored)
 *
 * User-driven account creation with helpful guidance.
 * Users type in their actual accounts rather than checking boxes.
 */

import { type FC, useState, useEffect } from 'react'
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

interface BankAccountEntry {
  id: string
  name: string
}

interface BalanceAccountEntry {
  id: string
  name: string
  balance: string
}

interface IncomeEntry {
  id: string
  name: string
}

interface ExpenseEntry {
  id: string
  name: string
}

export const AccountCustomizationStep: FC<AccountCustomizationStepProps> = ({
  template,
  onUpdate,
  onNext,
  onBack,
}) => {
  const [currentPart, setCurrentPart] = useState(1)

  // Part 1: Bank Accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccountEntry[]>([
    { id: crypto.randomUUID(), name: '' }
  ])
  const [includeCash, setIncludeCash] = useState(false)
  const [cashName, setCashName] = useState('')

  // Part 2: Other Assets
  const [includeEquipment, setIncludeEquipment] = useState(false)
  const [equipmentItems, setEquipmentItems] = useState<BankAccountEntry[]>([
    { id: crypto.randomUUID(), name: '' }
  ])
  const [includeInventory, setIncludeInventory] = useState(false)
  const [inventoryName, setInventoryName] = useState('')
  const [includeAR, setIncludeAR] = useState(true) // Default to true

  // Part 3: Credit Cards
  const [creditCards, setCreditCards] = useState<BalanceAccountEntry[]>([
    { id: crypto.randomUUID(), name: '', balance: '' }
  ])

  // Part 4: Loans
  const [loans, setLoans] = useState<BalanceAccountEntry[]>([
    { id: crypto.randomUUID(), name: '', balance: '' }
  ])

  // Part 5: Income
  const [incomeSources, setIncomeSources] = useState<IncomeEntry[]>([
    { id: crypto.randomUUID(), name: '' }
  ])

  // Part 6: Expenses
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([
    { id: crypto.randomUUID(), name: '' }
  ])

  // Scroll to top when part changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const modalBody = document.querySelector('[class*="modalBody"]')
    if (modalBody) {
      modalBody.scrollTop = 0
    }
  }, [currentPart])

  const handlePartNext = () => {
    if (currentPart < 6) {
      setCurrentPart(currentPart + 1)
    } else {
      // Generate customizations and call onNext
      generateCustomizations()
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

  const generateCustomizations = () => {
    const customizationsList: AccountCustomization[] = []
    let accountNumber = 1000

    // Bank accounts
    bankAccounts.forEach((account) => {
      if (account.name.trim()) {
        customizationsList.push({
          templateAccountName: 'Business Checking',
          name: account.name.trim(),
          accountNumber: String(accountNumber),
          isIncluded: true,
        })
        accountNumber += 10
      }
    })

    // Cash
    if (includeCash && cashName.trim()) {
      customizationsList.push({
        templateAccountName: 'Cash on Hand',
        name: cashName.trim(),
        accountNumber: String(accountNumber),
        isIncluded: true,
      })
      accountNumber += 10
    }

    // Accounts Receivable (if included)
    if (includeAR) {
      customizationsList.push({
        templateAccountName: 'Accounts Receivable',
        name: 'Accounts Receivable',
        accountNumber: '1200',
        isIncluded: true,
      })
    }

    // Equipment
    if (includeEquipment) {
      equipmentItems.forEach((item) => {
        if (item.name.trim()) {
          customizationsList.push({
            templateAccountName: 'Equipment',
            name: item.name.trim(),
            accountNumber: '1500',
            isIncluded: true,
          })
        }
      })
    }

    // Inventory
    if (includeInventory && inventoryName.trim()) {
      customizationsList.push({
        templateAccountName: 'Inventory',
        name: inventoryName.trim(),
        accountNumber: '1400',
        isIncluded: true,
      })
    }

    // Credit Cards
    accountNumber = 2000
    creditCards.forEach((card) => {
      if (card.name.trim()) {
        customizationsList.push({
          templateAccountName: 'Credit Card',
          name: card.name.trim(),
          accountNumber: String(accountNumber),
          description: card.balance ? `Current balance: $${card.balance}` : undefined,
          isIncluded: true,
        })
        accountNumber += 10
      }
    })

    // Loans
    accountNumber = 2500
    loans.forEach((loan) => {
      if (loan.name.trim()) {
        customizationsList.push({
          templateAccountName: 'Loan',
          name: loan.name.trim(),
          accountNumber: String(accountNumber),
          description: loan.balance ? `Current balance: $${loan.balance}` : undefined,
          isIncluded: true,
        })
        accountNumber += 10
      }
    })

    // Required equity accounts
    customizationsList.push({
      templateAccountName: 'Owner Investment',
      name: 'Owner Investment',
      accountNumber: '3000',
      isIncluded: true,
    })
    customizationsList.push({
      templateAccountName: 'Owner Draw',
      name: 'Owner Draw',
      accountNumber: '3100',
      isIncluded: true,
    })
    customizationsList.push({
      templateAccountName: 'Retained Earnings',
      name: 'Retained Earnings',
      accountNumber: '3900',
      isIncluded: true,
    })

    // Income
    accountNumber = 4000
    incomeSources.forEach((income) => {
      if (income.name.trim()) {
        customizationsList.push({
          templateAccountName: 'Income',
          name: income.name.trim(),
          accountNumber: String(accountNumber),
          isIncluded: true,
        })
        accountNumber += 100
      }
    })

    // Expenses
    accountNumber = 6000
    expenses.forEach((expense) => {
      if (expense.name.trim()) {
        customizationsList.push({
          templateAccountName: 'Expense',
          name: expense.name.trim(),
          accountNumber: String(accountNumber),
          isIncluded: true,
        })
        accountNumber += 100
      }
    })

    onUpdate(customizationsList)
  }

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

  const renderPart1 = () => (
    <>
      <div className={styles.partHeader}>
        <h3 className={styles.partTitle}>Part 1: Your Bank Accounts</h3>
        <p className={styles.partDescription}>
          List your business checking and savings accounts. Use the exact name so you recognize them!
        </p>
      </div>

      <div className={styles.inputSection}>
        {bankAccounts.map((account, index) => (
          <div key={account.id} className={styles.inputRow}>
            <Input
              value={account.name}
              onChange={(e) => {
                const updated = [...bankAccounts]
                updated[index] = { ...account, name: e.target.value }
                setBankAccounts(updated)
              }}
              placeholder="e.g., Chase Business -4567"
              fullWidth
            />
            {bankAccounts.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setBankAccounts(bankAccounts.filter((_, i) => i !== index))
                }}
                className={styles.removeButton}
                aria-label="Remove"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() => {
            setBankAccounts([...bankAccounts, { id: crypto.randomUUID(), name: '' }])
          }}
        >
          + Add another bank account
        </Button>
      </div>

      <div className={styles.optionalSection}>
        <Checkbox
          label="I handle physical cash"
          checked={includeCash}
          onChange={() => setIncludeCash(!includeCash)}
        />
        {includeCash && (
          <div className={styles.indentedInput}>
            <Input
              value={cashName}
              onChange={(e) => setCashName(e.target.value)}
              placeholder="e.g., Cash on Hand"
              fullWidth
            />
          </div>
        )}
      </div>
    </>
  )

  const renderPart2 = () => (
    <>
      <div className={styles.partHeader}>
        <h3 className={styles.partTitle}>Part 2: Other Assets</h3>
        <p className={styles.partDescription}>
          Do you need to track equipment, inventory, or money owed to you?
        </p>
      </div>

      <div className={styles.optionalSection}>
        <Checkbox
          label="Money owed to me (Accounts Receivable)"
          checked={includeAR}
          onChange={() => setIncludeAR(!includeAR)}
          helperText="Track invoices you've sent that haven't been paid yet"
        />
      </div>

      <div className={styles.optionalSection}>
        <Checkbox
          label="Equipment"
          checked={includeEquipment}
          onChange={() => setIncludeEquipment(!includeEquipment)}
          helperText="Big purchases like computers, cameras, tools (typically $2,500+)"
        />
        {includeEquipment && (
          <div className={styles.indentedInput}>
            {equipmentItems.map((item, index) => (
              <div key={item.id} className={styles.inputRow}>
                <Input
                  value={item.name}
                  onChange={(e) => {
                    const updated = [...equipmentItems]
                    updated[index] = { ...item, name: e.target.value }
                    setEquipmentItems(updated)
                  }}
                  placeholder="e.g., MacBook Pro 2024"
                  fullWidth
                />
                {equipmentItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setEquipmentItems(equipmentItems.filter((_, i) => i !== index))
                    }}
                    className={styles.removeButton}
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEquipmentItems([...equipmentItems, { id: crypto.randomUUID(), name: '' }])
              }}
            >
              + Add more equipment
            </Button>
          </div>
        )}
      </div>

      <div className={styles.optionalSection}>
        <Checkbox
          label="Inventory"
          checked={includeInventory}
          onChange={() => setIncludeInventory(!includeInventory)}
          helperText="Products you have in stock to sell"
        />
        {includeInventory && (
          <div className={styles.indentedInput}>
            <Input
              value={inventoryName}
              onChange={(e) => setInventoryName(e.target.value)}
              placeholder="e.g., Product Inventory"
              fullWidth
            />
          </div>
        )}
      </div>
    </>
  )

  const renderPart3 = () => (
    <>
      <div className={styles.partHeader}>
        <h3 className={styles.partTitle}>Part 3: Credit Cards</h3>
        <p className={styles.partDescription}>
          List your business credit cards and their current balances.
        </p>
      </div>

      <div className={styles.inputSection}>
        {creditCards.map((card, index) => (
          <div key={card.id} className={styles.balanceRow}>
            <div className={styles.balanceInputs}>
              <Input
                value={card.name}
                onChange={(e) => {
                  const updated = [...creditCards]
                  updated[index] = { ...card, name: e.target.value }
                  setCreditCards(updated)
                }}
                placeholder="e.g., Chase Ink -5678"
                fullWidth
              />
              <Input
                value={card.balance}
                onChange={(e) => {
                  const updated = [...creditCards]
                  updated[index] = { ...card, balance: e.target.value }
                  setCreditCards(updated)
                }}
                placeholder="$0.00"
                type="text"
              />
            </div>
            {creditCards.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setCreditCards(creditCards.filter((_, i) => i !== index))
                }}
                className={styles.removeButton}
                aria-label="Remove"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() => {
            setCreditCards([...creditCards, { id: crypto.randomUUID(), name: '', balance: '' }])
          }}
        >
          + Add another credit card
        </Button>
      </div>

      <div className={styles.helpNote}>
        <p>💡 No business credit cards? You can skip this - just leave the fields empty!</p>
      </div>
    </>
  )

  const renderPart4 = () => (
    <>
      <div className={styles.partHeader}>
        <h3 className={styles.partTitle}>Part 4: Loans</h3>
        <p className={styles.partDescription}>
          Do you have any business loans? List them with their current balances.
        </p>
      </div>

      <div className={styles.inputSection}>
        {loans.map((loan, index) => (
          <div key={loan.id} className={styles.balanceRow}>
            <div className={styles.balanceInputs}>
              <Input
                value={loan.name}
                onChange={(e) => {
                  const updated = [...loans]
                  updated[index] = { ...loan, name: e.target.value }
                  setLoans(updated)
                }}
                placeholder="e.g., SBA Loan"
                fullWidth
              />
              <Input
                value={loan.balance}
                onChange={(e) => {
                  const updated = [...loans]
                  updated[index] = { ...loan, balance: e.target.value }
                  setLoans(updated)
                }}
                placeholder="$0.00"
                type="text"
              />
            </div>
            {loans.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setLoans(loans.filter((_, i) => i !== index))
                }}
                className={styles.removeButton}
                aria-label="Remove"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() => {
            setLoans([...loans, { id: crypto.randomUUID(), name: '', balance: '' }])
          }}
        >
          + Add another loan
        </Button>
      </div>

      <div className={styles.helpNote}>
        <p>💡 No loans? Perfect! Leave the fields empty and continue.</p>
      </div>
    </>
  )

  const renderPart5 = () => (
    <>
      <div className={styles.partHeader}>
        <h3 className={styles.partTitle}>Part 5: Income</h3>
        <p className={styles.partDescription}>
          What do you call the money coming into your business? List your revenue streams.
        </p>
      </div>

      <div className={styles.inputSection}>
        {incomeSources.map((income, index) => (
          <div key={income.id} className={styles.inputRow}>
            <Input
              value={income.name}
              onChange={(e) => {
                const updated = [...incomeSources]
                updated[index] = { ...income, name: e.target.value }
                setIncomeSources(updated)
              }}
              placeholder="e.g., Design Services, Consulting, Product Sales"
              fullWidth
            />
            {incomeSources.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setIncomeSources(incomeSources.filter((_, i) => i !== index))
                }}
                className={styles.removeButton}
                aria-label="Remove"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() => {
            setIncomeSources([...incomeSources, { id: crypto.randomUUID(), name: '' }])
          }}
        >
          + Add another income source
        </Button>
      </div>

      <div className={styles.helpNote}>
        <p>💡 Keep it simple! You can always add more specific categories later.</p>
      </div>
    </>
  )

  const renderPart6 = () => (
    <>
      <div className={styles.partHeader}>
        <h3 className={styles.partTitle}>Part 6: Expenses</h3>
        <p className={styles.partDescription}>
          What are your main business expenses? List the categories you want to track.
        </p>
      </div>

      <div className={styles.inputSection}>
        {expenses.map((expense, index) => (
          <div key={expense.id} className={styles.inputRow}>
            <Input
              value={expense.name}
              onChange={(e) => {
                const updated = [...expenses]
                updated[index] = { ...expense, name: e.target.value }
                setExpenses(updated)
              }}
              placeholder="e.g., Rent, Software, Marketing, Insurance"
              fullWidth
            />
            {expenses.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setExpenses(expenses.filter((_, i) => i !== index))
                }}
                className={styles.removeButton}
                aria-label="Remove"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() => {
            setExpenses([...expenses, { id: crypto.randomUUID(), name: '' }])
          }}
        >
          + Add another expense
        </Button>
      </div>

      <div className={styles.helpNote}>
        <p>💡 Start with your biggest expenses. You can always add more detailed categories later!</p>
      </div>
    </>
  )

  const renderCurrentPart = () => {
    switch (currentPart) {
      case 1:
        return renderPart1()
      case 2:
        return renderPart2()
      case 3:
        return renderPart3()
      case 4:
        return renderPart4()
      case 5:
        return renderPart5()
      case 6:
        return renderPart6()
      default:
        return null
    }
  }

  const canProceed = () => {
    // At least one bank account or one income source or one expense
    const hasBankAccount = bankAccounts.some(a => a.name.trim())
    const hasIncome = incomeSources.some(i => i.name.trim())
    const hasExpense = expenses.some(e => e.name.trim())
    return hasBankAccount || hasIncome || hasExpense
  }

  return (
    <div className={styles.customizationStep}>
      <div className={styles.intro}>
        <div className={styles.partProgress}>
          Part {currentPart} of 6
        </div>
      </div>

      {renderCurrentPart()}

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
          disabled={!canProceed()}
        >
          {currentPart === 6 ? 'Continue to review' : 'Next'}
        </Button>
      </div>
    </div>
  )
}
