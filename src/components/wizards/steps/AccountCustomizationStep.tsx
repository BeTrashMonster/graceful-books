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
  customizations: initialCustomizations,
  onUpdate,
  onNext,
  onBack,
  savedFormData,
}) => {
  const [currentPart, setCurrentPart] = useState(1)
  const [initialized, setInitialized] = useState(false)

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
  const [creditCards, setCreditCards] = useState<BalanceAccountEntry[]>([
    { id: crypto.randomUUID(), name: '', balance: '', date: '' }
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
          description: card.balance ? `Current balance: $${card.balance}` : undefined,
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

    // Generate equity accounts based on entity type
    // TODO: Get companyId from props when auth is implemented
    const entityConfig = getEntityConfig('demo-company')
    let equityAccountNumber = 3000

    if (entityConfig.entityType === 'multi-member-llc' || entityConfig.entityType === 'partnership') {
      // Create individual capital accounts for each member/partner
      const capitalLabel = entityConfig.entityType === 'multi-member-llc' ? 'Member Capital' : 'Partner Capital'
      const distributionLabel = entityConfig.entityType === 'multi-member-llc' ? 'Member Distributions' : 'Partner Distributions'

      entityConfig.owners.forEach((owner) => {
        customizationsList.push({
          templateAccountName: 'Member Capital',
          name: `${owner.name} - ${capitalLabel}`,
          accountNumber: String(equityAccountNumber),
          description: `${capitalLabel} account for ${owner.name} (${owner.ownershipPercentage}% ownership)`,
          isIncluded: true,
          type: 'equity',
        })
        equityAccountNumber += 10
      })

      // Add distribution accounts
      equityAccountNumber = 3100
      entityConfig.owners.forEach((owner) => {
        customizationsList.push({
          templateAccountName: 'Member Distributions',
          name: `${owner.name} - ${distributionLabel}`,
          accountNumber: String(equityAccountNumber),
          description: `Distributions to ${owner.name}`,
          isIncluded: true,
          type: 'equity',
        })
        equityAccountNumber += 10
      })
    } else if (entityConfig.entityType === 'sole-proprietorship') {
      customizationsList.push({
        templateAccountName: 'Owner Investment',
        name: "Owner's Capital",
        accountNumber: '3000',
        isIncluded: true,
        type: 'equity',
      })
      customizationsList.push({
        templateAccountName: 'Owner Draw',
        name: "Owner's Draw",
        accountNumber: '3100',
        isIncluded: true,
        type: 'equity',
      })
    } else if (entityConfig.entityType === 'single-member-llc') {
      customizationsList.push({
        templateAccountName: 'Owner Investment',
        name: "Member's Capital",
        accountNumber: '3000',
        isIncluded: true,
        type: 'equity',
      })
      customizationsList.push({
        templateAccountName: 'Owner Draw',
        name: "Member's Draw",
        accountNumber: '3100',
        isIncluded: true,
        type: 'equity',
      })
    }

    // All entity types get Retained Earnings
    customizationsList.push({
      templateAccountName: 'Retained Earnings',
      name: 'Retained Earnings',
      accountNumber: '3900',
      isIncluded: true,
      type: 'equity',
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
            {equipmentItems.map((item, index) => (
              <div key={item.id} className={styles.balanceRow}>
                <div className={styles.balanceInputs}>
                  <Input
                    value={item.name}
                    onChange={(e) => {
                      const updated = [...equipmentItems]
                      updated[index] = { ...item, name: e.target.value }
                      setEquipmentItems(updated)
                    }}
                    placeholder="Professional Camera"
                    fullWidth
                  />
                  <Input
                    value={item.value}
                    onChange={(e) => {
                      const updated = [...equipmentItems]
                      updated[index] = { ...item, value: e.target.value }
                      setEquipmentItems(updated)
                    }}
                    placeholder="$3,500.00"
                    type="text"
                  />
                  <Input
                    value={item.date}
                    onChange={(e) => {
                      const updated = [...equipmentItems]
                      updated[index] = { ...item, date: e.target.value }
                      setEquipmentItems(updated)
                    }}
                    placeholder="Purchase date"
                    type="date"
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
            ))}
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
      <p className={styles.partNote}>List your business credit cards and their current balances.</p>

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
                placeholder="Credit Union Credit Card - 0614"
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
              <Input
                value={card.date}
                onChange={(e) => {
                  const updated = [...creditCards]
                  updated[index] = { ...card, date: e.target.value }
                  setCreditCards(updated)
                }}
                placeholder="Balance date"
                type="date"
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
            setCreditCards([...creditCards, { id: crypto.randomUUID(), name: '', balance: '', date: '' }])
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
              <Input
                value={loan.date}
                onChange={(e) => {
                  const updated = [...loans]
                  updated[index] = { ...loan, date: e.target.value }
                  setLoans(updated)
                }}
                placeholder="Balance date"
                type="date"
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

  const renderPart6 = () => (
    <>
      <div className={styles.partHeader}>
        <h3 className={styles.partTitle}>Part 6: Expenses</h3>
        <p className={styles.partDescription}>
          Check what applies to your business, and add any custom categories below.
        </p>
      </div>

      <div className={styles.checkboxGrid}>
        <Checkbox
          label="Bank Fees"
          checked={commonExpenses.bankFees}
          onChange={() => setCommonExpenses({...commonExpenses, bankFees: !commonExpenses.bankFees})}
        />
        <Checkbox
          label="Business License + Permits"
          checked={commonExpenses.businessLicense}
          onChange={() => setCommonExpenses({...commonExpenses, businessLicense: !commonExpenses.businessLicense})}
        />
        <Checkbox
          label="Continuing Education"
          checked={commonExpenses.continuingEducation}
          onChange={() => setCommonExpenses({...commonExpenses, continuingEducation: !commonExpenses.continuingEducation})}
        />
        <Checkbox
          label="Contract Labor"
          checked={commonExpenses.contractLabor}
          onChange={() => setCommonExpenses({...commonExpenses, contractLabor: !commonExpenses.contractLabor})}
        />
        <Checkbox
          label="Insurance"
          checked={commonExpenses.insurance}
          onChange={() => setCommonExpenses({...commonExpenses, insurance: !commonExpenses.insurance})}
        />
        <Checkbox
          label="Marketing + Advertising"
          checked={commonExpenses.marketing}
          onChange={() => setCommonExpenses({...commonExpenses, marketing: !commonExpenses.marketing})}
        />
        <Checkbox
          label="Merchant Fees"
          checked={commonExpenses.merchantFees}
          onChange={() => setCommonExpenses({...commonExpenses, merchantFees: !commonExpenses.merchantFees})}
        />
        <Checkbox
          label="Office Supplies"
          checked={commonExpenses.officeSupplies}
          onChange={() => setCommonExpenses({...commonExpenses, officeSupplies: !commonExpenses.officeSupplies})}
        />
        <Checkbox
          label="Phone + Internet"
          checked={commonExpenses.phoneInternet}
          onChange={() => setCommonExpenses({...commonExpenses, phoneInternet: !commonExpenses.phoneInternet})}
        />
        <Checkbox
          label="Postage + Delivery"
          checked={commonExpenses.postageDelivery}
          onChange={() => setCommonExpenses({...commonExpenses, postageDelivery: !commonExpenses.postageDelivery})}
        />
        <Checkbox
          label="Professional Fees"
          checked={commonExpenses.professionalFees}
          onChange={() => setCommonExpenses({...commonExpenses, professionalFees: !commonExpenses.professionalFees})}
        />
        <Checkbox
          label="Rent"
          checked={commonExpenses.rent}
          onChange={() => setCommonExpenses({...commonExpenses, rent: !commonExpenses.rent})}
        />
        <Checkbox
          label="Repairs + Maintenance"
          checked={commonExpenses.repairsMaintenance}
          onChange={() => setCommonExpenses({...commonExpenses, repairsMaintenance: !commonExpenses.repairsMaintenance})}
        />
        <Checkbox
          label="Software + Subscriptions"
          checked={commonExpenses.software}
          onChange={() => setCommonExpenses({...commonExpenses, software: !commonExpenses.software})}
        />
        <Checkbox
          label="Supplies + Materials"
          checked={commonExpenses.suppliesMaterials}
          onChange={() => setCommonExpenses({...commonExpenses, suppliesMaterials: !commonExpenses.suppliesMaterials})}
        />
        <Checkbox
          label="Travel"
          checked={commonExpenses.travel}
          onChange={() => setCommonExpenses({...commonExpenses, travel: !commonExpenses.travel})}
        />
        <Checkbox
          label="Utilities"
          checked={commonExpenses.utilities}
          onChange={() => setCommonExpenses({...commonExpenses, utilities: !commonExpenses.utilities})}
        />
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
