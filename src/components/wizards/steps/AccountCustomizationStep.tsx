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
import { getEntityConfig } from '../../../data/demoEntityConfig'
import styles from './AccountCustomizationStep.module.css'

export interface AccountCustomizationStepProps {
  template?: IndustryTemplate
  customizations: AccountCustomization[]
  onUpdate: (customizations: AccountCustomization[], formData?: any) => void
  onNext: () => void
  onBack: () => void
  savedFormData?: any
}

interface BankAccountEntry {
  id: string
  name: string
}

interface EquipmentEntry {
  id: string
  name: string
  value: string
  date: string
}

interface BalanceAccountEntry {
  id: string
  name: string
  balance: string
  date: string
}

interface CreditCardEntry {
  id: string
  name: string
}

interface IncomeEntry {
  id: string
  name: string
}

interface ExpenseEntry {
  id: string
  name: string
}

/**
 * Parse date input and handle 2-digit years intelligently
 * Examples:
 *   123120 -> 2020-12-31 (assumes current century)
 *   12/31/20 -> 2020-12-31
 *   123199 -> 1999-12-31 (past date, assumes 19xx)
 */
const parseSmartDate = (input: string): string => {
  if (!input) return input

  // If it's already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input
  }

  // Remove all non-digit characters
  const digitsOnly = input.replace(/\D/g, '')

  if (digitsOnly.length === 6) {
    // MMDDYY format - need to infer century
    const month = digitsOnly.substring(0, 2)
    const day = digitsOnly.substring(2, 4)
    const yearTwoDigit = parseInt(digitsOnly.substring(4, 6), 10)

    // If year is > current year's last 2 digits, assume previous century
    // Otherwise assume current century
    const currentYear = new Date().getFullYear()
    const currentCentury = Math.floor(currentYear / 100) * 100
    const currentYearTwoDigit = currentYear % 100

    const year = yearTwoDigit > currentYearTwoDigit
      ? currentCentury - 100 + yearTwoDigit
      : currentCentury + yearTwoDigit

    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  } else if (digitsOnly.length === 8) {
    // MMDDYYYY format
    const month = digitsOnly.substring(0, 2)
    const day = digitsOnly.substring(2, 4)
    const year = digitsOnly.substring(4, 8)
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return input
}

export const AccountCustomizationStep: FC<AccountCustomizationStepProps> = ({
  template,
  customizations: initialCustomizations,
  onUpdate,
  onNext,
  onBack,
  savedFormData,
}) => {
  const [currentPart, setCurrentPart] = useState(1)
  const [initialized, setInitialized] = useState(false)
  const [equipmentErrors, setEquipmentErrors] = useState<Set<string>>(new Set())

  // Part 1: Bank Accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccountEntry[]>([
    { id: crypto.randomUUID(), name: '' }
  ])
  const [includeCash, setIncludeCash] = useState(false)
  const [cashName, setCashName] = useState('')

  // Part 2: Other Assets
  const [includeEquipment, setIncludeEquipment] = useState(false)
  const [equipmentItems, setEquipmentItems] = useState<EquipmentEntry[]>([
    { id: crypto.randomUUID(), name: '', value: '', date: '' }
  ])
  const [includeInventory, setIncludeInventory] = useState(false)
  const [inventoryName, setInventoryName] = useState('')
  const includeAR = true // Always required

  // Part 3: Credit Cards
  const [creditCards, setCreditCards] = useState<CreditCardEntry[]>([
    { id: crypto.randomUUID(), name: '' }
  ])

  // Part 4: Loans
  const [loans, setLoans] = useState<BalanceAccountEntry[]>([
    { id: crypto.randomUUID(), name: '', balance: '', date: '' }
  ])

  // Part 5: Income
  const [incomeSources, setIncomeSources] = useState<IncomeEntry[]>([
    { id: crypto.randomUUID(), name: '' }
  ])

  // Part 6: Expenses
  const [commonExpenses, setCommonExpenses] = useState({
    bankFees: false,
    businessLicense: false,
    continuingEducation: false,
    contractLabor: false,
    insurance: false,
    marketing: false,
    merchantFees: false,
    officeSupplies: false,
    phoneInternet: false,
    postageDelivery: false,
    professionalFees: false,
    rent: false,
    repairsMaintenance: false,
    software: false,
    suppliesMaterials: false,
    travel: false,
    utilities: false,
  })
  const [customExpenses, setCustomExpenses] = useState<ExpenseEntry[]>([
    { id: crypto.randomUUID(), name: '' }
  ])

  // Initialize from saved form data if available
  useEffect(() => {
    if (!initialized) {
      if (savedFormData) {
        setCurrentPart(savedFormData.currentPart || 1)
        if (savedFormData.bankAccounts) setBankAccounts(savedFormData.bankAccounts)
        if (savedFormData.includeCash !== undefined) setIncludeCash(savedFormData.includeCash)
        if (savedFormData.cashName) setCashName(savedFormData.cashName)
        if (savedFormData.includeEquipment !== undefined) setIncludeEquipment(savedFormData.includeEquipment)
        if (savedFormData.equipmentItems) setEquipmentItems(savedFormData.equipmentItems)
        if (savedFormData.includeInventory !== undefined) setIncludeInventory(savedFormData.includeInventory)
        if (savedFormData.inventoryName) setInventoryName(savedFormData.inventoryName)
        if (savedFormData.creditCards) setCreditCards(savedFormData.creditCards)
        if (savedFormData.loans) setLoans(savedFormData.loans)
        if (savedFormData.incomeSources) setIncomeSources(savedFormData.incomeSources)
        if (savedFormData.commonExpenses) setCommonExpenses({...commonExpenses, ...savedFormData.commonExpenses})
        if (savedFormData.customExpenses) setCustomExpenses(savedFormData.customExpenses)
      }
      setInitialized(true)
    }
  }, [initialized, savedFormData])

  // Save form data continuously to support "Save and finish later"
  useEffect(() => {
    if (initialized) {
      const formData = {
        currentPart,
        bankAccounts,
        includeCash,
        cashName,
        includeEquipment,
        equipmentItems,
        includeInventory,
        inventoryName,
        creditCards,
        loans,
        incomeSources,
        commonExpenses,
        customExpenses,
      }
      // Update the wizard data immediately with current form state
      onUpdate([], formData)
    }
  }, [
    initialized,
    currentPart,
    bankAccounts,
    includeCash,
    cashName,
    includeEquipment,
    equipmentItems,
    includeInventory,
    inventoryName,
    creditCards,
    loans,
    incomeSources,
    commonExpenses,
    customExpenses,
    onUpdate,
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
    // Validate Part 2 (Equipment) before proceeding
    if (currentPart === 2 && includeEquipment) {
      const invalidItems = new Set<string>()

      equipmentItems.forEach(item => {
        // If they started filling out an item, they must complete it
        const hasAnyData = item.name.trim() || item.value.trim() || item.date.trim()
        if (hasAnyData) {
          if (!item.name.trim() || !item.value.trim() || !item.date.trim()) {
            invalidItems.add(item.id)
          }
        }
      })

      if (invalidItems.size > 0) {
        setEquipmentErrors(invalidItems)
        alert('Please complete all equipment fields (name, value, and purchase date) or remove empty items before continuing.')
        return
      }

      setEquipmentErrors(new Set())
    }

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
          type: 'asset',
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
        type: 'asset',
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
        type: 'asset',
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
            type: 'asset',
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
        type: 'asset',
      })
    }

    // Accounts Payable (required)
    customizationsList.push({
      templateAccountName: 'Accounts Payable',
      name: 'Accounts Payable',
      accountNumber: '2000',
      isIncluded: true,
      type: 'liability',
    })

    // Credit Cards
    accountNumber = 2100
    creditCards.forEach((card) => {
      if (card.name.trim()) {
        customizationsList.push({
          templateAccountName: 'Credit Card',
          name: card.name.trim(),
          accountNumber: String(accountNumber),
          isIncluded: true,
          type: 'liability',
        })
        accountNumber += 10
      }
    })

    // Loans
    accountNumber = 2600
    loans.forEach((loan) => {
      if (loan.name.trim()) {
        customizationsList.push({
          templateAccountName: 'Loan',
          name: loan.name.trim(),
          accountNumber: String(accountNumber),
          description: loan.balance ? `Current balance: $${loan.balance}` : undefined,
          isIncluded: true,
          type: 'liability',
        })
        accountNumber += 10
      }
    })

    // NOTE: Equity accounts (Member Capital, Distributions, Retained Earnings)
    // are auto-generated by the wizard based on entity type.
    // See ChartOfAccountsWizard.tsx handleCreateAccounts() -> generateEquityAccounts()

    // Income
    accountNumber = 4000
    incomeSources.forEach((income) => {
      if (income.name.trim()) {
        customizationsList.push({
          templateAccountName: 'Income',
          name: income.name.trim(),
          accountNumber: String(accountNumber),
          isIncluded: true,
          type: 'income',
        })
        accountNumber += 100
      }
    })

    // Expenses - Common checkboxes (in alphabetical order)
    accountNumber = 6000
    if (commonExpenses.bankFees) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Bank Fees',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }
    if (commonExpenses.businessLicense) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Business License + Permits',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }
    if (commonExpenses.continuingEducation) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Continuing Education',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }
    if (commonExpenses.contractLabor) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Contract Labor',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }
    if (commonExpenses.insurance) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Insurance',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }
    if (commonExpenses.marketing) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Marketing + Advertising',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }
    if (commonExpenses.merchantFees) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Merchant Fees',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }
    if (commonExpenses.officeSupplies) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Office Supplies',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }
    if (commonExpenses.phoneInternet) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Phone + Internet',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }
    if (commonExpenses.postageDelivery) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Postage + Delivery',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }
    if (commonExpenses.professionalFees) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Professional Fees',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }
    if (commonExpenses.rent) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Rent',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }
    if (commonExpenses.repairsMaintenance) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Repairs + Maintenance',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }
    if (commonExpenses.software) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Software + Subscriptions',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }
    if (commonExpenses.suppliesMaterials) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Supplies + Materials',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }
    if (commonExpenses.travel) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Travel',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }
    if (commonExpenses.utilities) {
      customizationsList.push({
        templateAccountName: 'Expense',
        name: 'Utilities',
        accountNumber: String(accountNumber),
        isIncluded: true,
        type: 'expense',
      })
      accountNumber += 100
    }

    // Custom expenses
    customExpenses.forEach((expense) => {
      if (expense.name.trim()) {
        customizationsList.push({
          templateAccountName: 'Expense',
          name: expense.name.trim(),
          accountNumber: String(accountNumber),
          isIncluded: true,
          type: 'expense',
        })
        accountNumber += 100
      }
    })

    // Pass the formData along with customizations to preserve equipment/loan opening balances
    const formData = {
      currentPart,
      bankAccounts,
      includeCash,
      cashName,
      includeEquipment,
      equipmentItems,
      includeInventory,
      inventoryName,
      creditCards,
      loans,
      incomeSources,
      commonExpenses,
      customExpenses,
    }

    onUpdate(customizationsList, formData)
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
              placeholder="Credit Union Checking - 4567"
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

      <div className={styles.requiredSection}>
        <p className={styles.requiredLabel}>
          <strong>✓ Money owed to me (Accounts Receivable)</strong>
        </p>
        <p className={styles.requiredHelper}>
          Track invoices you've sent that haven't been paid yet. This is required for proper bookkeeping.
        </p>
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
            <p className={styles.equipmentInstructions}>
              Enter each piece of equipment with its <strong>value when purchased</strong> and the <strong>date you bought it</strong>. This helps track depreciation properly.
            </p>
            {equipmentItems.map((item, index) => {
              const hasError = equipmentErrors.has(item.id)
              const hasAnyData = item.name.trim() || item.value.trim() || item.date.trim()

              return (
              <div key={item.id} className={styles.balanceRow}>
                <div className={styles.balanceInputs}>
                  <Input
                    value={item.name}
                    onChange={(e) => {
                      const updated = [...equipmentItems]
                      updated[index] = { ...item, name: e.target.value }
                      setEquipmentItems(updated)
                      setEquipmentErrors(new Set()) // Clear errors on change
                    }}
                    placeholder="Professional Camera"
                    fullWidth
                    hasError={hasError && hasAnyData && !item.name.trim()}
                  />
                  <Input
                    value={item.value}
                    onChange={(e) => {
                      const updated = [...equipmentItems]
                      updated[index] = { ...item, value: e.target.value }
                      setEquipmentItems(updated)
                      setEquipmentErrors(new Set())
                    }}
                    placeholder="$3,500.00"
                    type="text"
                    hasError={hasError && hasAnyData && !item.value.trim()}
                  />
                  <Input
                    value={item.date}
                    onChange={(e) => {
                      const parsed = parseSmartDate(e.target.value)
                      const updated = [...equipmentItems]
                      updated[index] = { ...item, date: parsed }
                      setEquipmentItems(updated)
                      setEquipmentErrors(new Set())
                    }}
                    placeholder="MM/DD/YY or MM/DD/YYYY"
                    type="text"
                    hasError={hasError && hasAnyData && !item.date.trim()}
                  />
                </div>
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
              )
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEquipmentItems([...equipmentItems, { id: crypto.randomUUID(), name: '', value: '', date: '' }])
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
        />
        <p className={styles.inventoryNote}>
          <strong>Note:</strong> Whether to track inventory on your books depends on many factors (cash vs. accrual basis, business size, inventory value, etc.). Consider consulting with a bookkeeper or accountant familiar with your situation before enabling this.
        </p>
        {includeInventory && (
          <div className={styles.indentedInput}>
            <Input
              value={inventoryName}
              onChange={(e) => setInventoryName(e.target.value)}
              placeholder="Product Inventory"
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
        <h3 className={styles.partTitle}>Part 3: Liabilities</h3>
        <p className={styles.partDescription}>
          Track what your business owes - bills to vendors, credit cards, and loans.
        </p>
      </div>

      <div className={styles.requiredSection}>
        <p className={styles.requiredLabel}>
          <strong>✓ Bills I owe (Accounts Payable)</strong>
        </p>
        <p className={styles.requiredHelper}>
          Track invoices from vendors that you haven't paid yet. This is required for proper bookkeeping.
        </p>
      </div>

      <h4 className={styles.sectionSubtitle}>Credit Cards</h4>
      <p className={styles.partNote}>
        List your business credit cards. You'll set up balances and transactions later when you reconcile.
      </p>

      <div className={styles.inputSection}>
        {creditCards.map((card, index) => (
          <div key={card.id} className={styles.inputRow}>
            <Input
              value={card.name}
              onChange={(e) => {
                const updated = [...creditCards]
                updated[index] = { ...card, name: e.target.value }
                setCreditCards(updated)
              }}
              placeholder="Credit Union Credit Card - 0614"
              fullWidth
            />
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
            setCreditCards([...creditCards, { id: crypto.randomUUID(), name: '' }])
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

  const renderPart4 = () => {
    const currentYear = new Date().getFullYear()
    const lastYear = currentYear - 1

    return (
    <>
      <div className={styles.partHeader}>
        <h3 className={styles.partTitle}>Part 4: Loans</h3>
        <p className={styles.partDescription}>
          Enter the loan balance from when you want to start tracking. For example, if you want to enter transactions from the beginning of {currentYear}, use the loan balance on 12/31/{lastYear}.
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
              <Input
                value={loan.date}
                onChange={(e) => {
                  const parsed = parseSmartDate(e.target.value)
                  const updated = [...loans]
                  updated[index] = { ...loan, date: parsed }
                  setLoans(updated)
                }}
                placeholder="MM/DD/YY or MM/DD/YYYY"
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
            setLoans([...loans, { id: crypto.randomUUID(), name: '', balance: '', date: '' }])
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
  }

  const renderPart5 = () => (
    <>
      <div className={styles.partHeader}>
        <h3 className={styles.partTitle}>Part 5: Income</h3>
        <p className={styles.partDescription}>
          List your revenue streams.
        </p>
        <p className={styles.partNote}>
          Individual products/services can be tracked through your POS system or other features in this software.
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

  const renderPart6 = () => {
    // Create sorted expense options for proper column display
    const expenseOptions = [
      { key: 'bankFees', label: 'Bank Fees' },
      { key: 'businessLicense', label: 'Business License + Permits' },
      { key: 'continuingEducation', label: 'Continuing Education' },
      { key: 'contractLabor', label: 'Contract Labor' },
      { key: 'insurance', label: 'Insurance' },
      { key: 'marketing', label: 'Marketing + Advertising' },
      { key: 'merchantFees', label: 'Merchant Fees' },
      { key: 'officeSupplies', label: 'Office Supplies' },
      { key: 'phoneInternet', label: 'Phone + Internet' },
      { key: 'postageDelivery', label: 'Postage + Delivery' },
      { key: 'professionalFees', label: 'Professional Fees' },
      { key: 'rent', label: 'Rent' },
      { key: 'repairsMaintenance', label: 'Repairs + Maintenance' },
      { key: 'software', label: 'Software + Subscriptions' },
      { key: 'suppliesMaterials', label: 'Supplies + Materials' },
      { key: 'travel', label: 'Travel' },
      { key: 'utilities', label: 'Utilities' },
    ]

    // Sort alphabetically
    expenseOptions.sort((a, b) => a.label.localeCompare(b.label))

    return (
    <>
      <div className={styles.partHeader}>
        <h3 className={styles.partTitle}>Part 6: Expenses</h3>
        <p className={styles.partDescription}>
          Check what applies to your business, and add any custom categories below.
        </p>
      </div>

      <div className={styles.checkboxGrid}>
        {expenseOptions.map(option => (
          <Checkbox
            key={option.key}
            label={option.label}
            checked={commonExpenses[option.key as keyof typeof commonExpenses]}
            onChange={() => setCommonExpenses({
              ...commonExpenses,
              [option.key]: !commonExpenses[option.key as keyof typeof commonExpenses]
            })}
          />
        ))}
      </div>

      <div className={styles.customExpensesSection}>
        <h4 className={styles.sectionSubtitle}>Custom Expenses</h4>
        {customExpenses.map((expense, index) => (
          <div key={expense.id} className={styles.inputRow}>
            <Input
              value={expense.name}
              onChange={(e) => {
                const updated = [...customExpenses]
                updated[index] = { ...expense, name: e.target.value }
                setCustomExpenses(updated)
              }}
              placeholder="e.g., Equipment Repairs, Uniforms"
              fullWidth
            />
            {customExpenses.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setCustomExpenses(customExpenses.filter((_, i) => i !== index))
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
            setCustomExpenses([...customExpenses, { id: crypto.randomUUID(), name: '' }])
          }}
        >
          + Add custom expense
        </Button>
      </div>

      <div className={styles.helpNote}>
        <p>💡 Start with your biggest expenses. You can always add more detailed categories later!</p>
      </div>
    </>
  )
  }

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
    const hasCommonExpense = Object.values(commonExpenses).some(v => v)
    const hasCustomExpense = customExpenses.some(e => e.name.trim())
    return hasBankAccount || hasIncome || hasCommonExpense || hasCustomExpense
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
