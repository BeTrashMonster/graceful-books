/**
 * Account Customization Step Component (Refactored)
 *
 * User-driven account creation with helpful guidance.
 * Users type in their actual accounts rather than checking boxes.
 */

import { type FC, useState, useEffect, useRef } from 'react'
import { Button } from '../../core/Button'
import { Input } from '../../forms/Input'
import { Checkbox } from '../../forms/Checkbox'
import type { IndustryTemplate, AccountCustomization } from '../../../types/wizard.types'
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
 * Validate that a date string is a valid date in YYYY-MM-DD format
 */
const isValidDate = (dateStr: string): boolean => {
  if (!dateStr) return false

  // Must be in YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false

  const [year, month, day] = dateStr.split('-').map(Number)

  // Check year is reasonable (1900-2100)
  if (year < 1900 || year > 2100) return false

  // Check month is valid
  if (month < 1 || month > 12) return false

  // Check day is valid for the month
  const daysInMonth = new Date(year, month, 0).getDate()
  if (day < 1 || day > daysInMonth) return false

  return true
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

// Error tracking for field-level validation
interface FieldError {
  id: string
  field: 'name' | 'value' | 'date' | 'balance'
  message: string
}

export const AccountCustomizationStep: FC<AccountCustomizationStepProps> = ({
  template,
  customizations: _initialCustomizations,
  onUpdate,
  onNext,
  onBack,
  savedFormData,
}) => {
  const [currentPart, setCurrentPart] = useState(1)
  const [initialized, setInitialized] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([])
  const isGeneratingCustomizationsRef = useRef(false)

  // Helper to check if a specific field has an error
  const hasFieldError = (id: string, field: string) => {
    return fieldErrors.some(e => e.id === id && e.field === field)
  }

  // Helper to get error message for a field
  const getFieldErrorMessage = (id: string, field: string) => {
    const error = fieldErrors.find(e => e.id === id && e.field === field)
    return error?.message
  }

  // Part 1: Bank Accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccountEntry[]>([
    { id: crypto.randomUUID(), name: '' }
  ])
  const [includeCash, setIncludeCash] = useState(false)
  const [cashAccounts, setCashAccounts] = useState<BankAccountEntry[]>([
    { id: crypto.randomUUID(), name: 'Cash on Hand' }
  ])

  // Part 2: Other Assets
  const [includeEquipment, setIncludeEquipment] = useState(false)
  const [equipmentItems, setEquipmentItems] = useState<EquipmentEntry[]>([
    { id: crypto.randomUUID(), name: '', value: '', date: '' }
  ])
  const [includeVehicles, setIncludeVehicles] = useState(false)
  const [vehicleItems, setVehicleItems] = useState<EquipmentEntry[]>([
    { id: crypto.randomUUID(), name: '', value: '', date: '' }
  ])
  const [includeProperty, setIncludeProperty] = useState(false)
  const [propertyItems, setPropertyItems] = useState<EquipmentEntry[]>([
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
    taxesPaid: false,
    travel: false,
    utilities: false,
  })
  const [customExpenses, setCustomExpenses] = useState<ExpenseEntry[]>([
    { id: crypto.randomUUID(), name: '' }
  ])

  // Part 6: Cost of Goods Sold
  const [commonCogs, setCommonCogs] = useState({
    directLabor: false,
    packagingLabeling: false,
    postageShipping: false,
    productPurchases: false,
    rawIngredients: false,
    smallToolsEquipment: false,
    subcontractors: false,
    suppliesMaterials: false,
  })
  const [customCogs, setCustomCogs] = useState<IncomeEntry[]>([
    { id: crypto.randomUUID(), name: '' }
  ])

  // Initialize from saved form data if available
  useEffect(() => {
    if (!initialized) {
      if (savedFormData) {
        setCurrentPart(savedFormData.currentPart || 1)
        if (savedFormData.bankAccounts) setBankAccounts(savedFormData.bankAccounts)
        if (savedFormData.includeCash !== undefined) setIncludeCash(savedFormData.includeCash)
        if (savedFormData.cashAccounts) setCashAccounts(savedFormData.cashAccounts)
        if (savedFormData.includeEquipment !== undefined) setIncludeEquipment(savedFormData.includeEquipment)
        if (savedFormData.equipmentItems) setEquipmentItems(savedFormData.equipmentItems)
        if (savedFormData.includeVehicles !== undefined) setIncludeVehicles(savedFormData.includeVehicles)
        if (savedFormData.vehicleItems) setVehicleItems(savedFormData.vehicleItems)
        if (savedFormData.includeProperty !== undefined) setIncludeProperty(savedFormData.includeProperty)
        if (savedFormData.propertyItems) setPropertyItems(savedFormData.propertyItems)
        if (savedFormData.includeInventory !== undefined) setIncludeInventory(savedFormData.includeInventory)
        if (savedFormData.inventoryName) setInventoryName(savedFormData.inventoryName)
        if (savedFormData.creditCards) setCreditCards(savedFormData.creditCards)
        if (savedFormData.loans) setLoans(savedFormData.loans)
        if (savedFormData.incomeSources) setIncomeSources(savedFormData.incomeSources)
        if (savedFormData.commonExpenses) setCommonExpenses({...commonExpenses, ...savedFormData.commonExpenses})
        if (savedFormData.customExpenses) setCustomExpenses(savedFormData.customExpenses)
        if (savedFormData.commonCogs) setCommonCogs({...commonCogs, ...savedFormData.commonCogs})
        if (savedFormData.customCogs) setCustomCogs(savedFormData.customCogs)
      }
      setInitialized(true)
    }
  }, [initialized, savedFormData])

  // Save form data continuously to support "Save and finish later"
  // BUT don't run when generating final customizations (checked via ref for synchronous access)
  useEffect(() => {
    if (initialized && !isGeneratingCustomizationsRef.current) {
      const formData = {
        currentPart,
        bankAccounts,
        includeCash,
        cashAccounts,
        includeEquipment,
        equipmentItems,
        includeVehicles,
        vehicleItems,
        includeProperty,
        propertyItems,
        includeInventory,
        inventoryName,
        creditCards,
        loans,
        incomeSources,
        commonCogs,
        customCogs,
        commonExpenses,
        customExpenses,
      }

      // During parts 1-7, save form data with empty customizations
      // Customizations will be generated when user clicks "Continue to review" from part 6
      console.log('=== useEffect saving form data, part', currentPart)
      onUpdate([], formData)
    }
  }, [
    initialized,
    currentPart,
    bankAccounts,
    includeCash,
    cashAccounts,
    includeEquipment,
    equipmentItems,
    includeVehicles,
    vehicleItems,
    includeProperty,
    propertyItems,
    includeInventory,
    inventoryName,
    creditCards,
    loans,
    incomeSources,
    commonCogs,
    customCogs,
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
    // Validate Part 2 (Other Assets) before proceeding
    if (currentPart === 2) {
      const errors: FieldError[] = []

      // Validate equipment
      if (includeEquipment) {
        equipmentItems.forEach(item => {
          const hasAnyData = item.name.trim() || item.value.trim() || item.date.trim()
          if (hasAnyData) {
            if (!item.name.trim()) {
              errors.push({ id: item.id, field: 'name', message: 'Name is required' })
            }
            if (!item.value.trim()) {
              errors.push({ id: item.id, field: 'value', message: 'Value is required' })
            }
            if (!item.date.trim()) {
              errors.push({ id: item.id, field: 'date', message: 'Date is required' })
            } else if (!isValidDate(item.date)) {
              errors.push({ id: item.id, field: 'date', message: 'Invalid date (use MM/DD/YY)' })
            }
          }
        })
      }

      // Validate vehicles
      if (includeVehicles) {
        vehicleItems.forEach(item => {
          const hasAnyData = item.name.trim() || item.value.trim() || item.date.trim()
          if (hasAnyData) {
            if (!item.name.trim()) {
              errors.push({ id: item.id, field: 'name', message: 'Name is required' })
            }
            if (!item.value.trim()) {
              errors.push({ id: item.id, field: 'value', message: 'Value is required' })
            }
            if (!item.date.trim()) {
              errors.push({ id: item.id, field: 'date', message: 'Date is required' })
            } else if (!isValidDate(item.date)) {
              errors.push({ id: item.id, field: 'date', message: 'Invalid date (use MM/DD/YY)' })
            }
          }
        })
      }

      // Validate property
      if (includeProperty) {
        propertyItems.forEach(item => {
          const hasAnyData = item.name.trim() || item.value.trim() || item.date.trim()
          if (hasAnyData) {
            if (!item.name.trim()) {
              errors.push({ id: item.id, field: 'name', message: 'Name is required' })
            }
            if (!item.value.trim()) {
              errors.push({ id: item.id, field: 'value', message: 'Value is required' })
            }
            if (!item.date.trim()) {
              errors.push({ id: item.id, field: 'date', message: 'Date is required' })
            } else if (!isValidDate(item.date)) {
              errors.push({ id: item.id, field: 'date', message: 'Invalid date (use MM/DD/YY)' })
            }
          }
        })
      }

      if (errors.length > 0) {
        setFieldErrors(errors)
        // Scroll to first error after state updates
        setTimeout(() => {
          const firstErrorElement = document.querySelector('[aria-invalid="true"]')
          if (firstErrorElement) {
            firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
            ;(firstErrorElement as HTMLElement).focus()
          }
        }, 50)
        return
      }

      setFieldErrors([])
    }

    // Validate Part 4 (Loans) before proceeding
    if (currentPart === 4) {
      const errors: FieldError[] = []

      loans.forEach(loan => {
        const hasAnyData = loan.name.trim() || loan.balance.trim() || loan.date.trim()
        if (hasAnyData) {
          if (!loan.name.trim()) {
            errors.push({ id: loan.id, field: 'name', message: 'Name is required' })
          }
          if (!loan.balance.trim()) {
            errors.push({ id: loan.id, field: 'balance', message: 'Balance is required' })
          }
          if (!loan.date.trim()) {
            errors.push({ id: loan.id, field: 'date', message: 'Date is required' })
          } else if (!isValidDate(loan.date)) {
            errors.push({ id: loan.id, field: 'date', message: 'Invalid date (use MM/DD/YY)' })
          }
        }
      })

      if (errors.length > 0) {
        setFieldErrors(errors)
        // Scroll to first error after state updates
        setTimeout(() => {
          const firstErrorElement = document.querySelector('[aria-invalid="true"]')
          if (firstErrorElement) {
            firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
            ;(firstErrorElement as HTMLElement).focus()
          }
        }, 50)
        return
      }

      setFieldErrors([])
    }

    if (currentPart < 7) {
      setCurrentPart(currentPart + 1)
    } else {
      // Generate customizations and call onNext
      // Set ref flag to prevent continuous-save useEffect from overwriting (using ref for synchronous access)
      isGeneratingCustomizationsRef.current = true
      console.log('=== About to call generateCustomizations, flag set to true')
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
    console.log('=== generateCustomizations START ===')

    // Step 1: Collect accounts by type and sub-category (without account numbers yet)
    const bankAccounts_sorted: Omit<AccountCustomization, 'accountNumber'>[] = []
    const equipmentAccounts: Omit<AccountCustomization, 'accountNumber'>[] = []
    const liabilityAccounts: Omit<AccountCustomization, 'accountNumber'>[] = []
    const incomeAccounts: Omit<AccountCustomization, 'accountNumber'>[] = []
    const cogsAccounts: Omit<AccountCustomization, 'accountNumber'>[] = []
    const expenseAccounts: Omit<AccountCustomization, 'accountNumber'>[] = []

    console.log('Step 1: Arrays initialized')

    // ASSETS - Sub-categorized for specific ordering
    // Bank/Cash accounts (will be sorted alphabetically)
    bankAccounts.forEach((account) => {
      if (account.name.trim()) {
        bankAccounts_sorted.push({
          templateAccountName: 'Business Checking',
          name: account.name.trim(),
          isIncluded: true,
          type: 'asset',
        })
      }
    })

    // Cash accounts
    if (includeCash) {
      cashAccounts.forEach((account) => {
        if (account.name.trim()) {
          bankAccounts_sorted.push({
            templateAccountName: 'Cash on Hand',
            name: account.name.trim(),
            isIncluded: true,
            type: 'asset',
          })
        }
      })
    }

    // Equipment (will be sorted alphabetically separately)
    if (includeEquipment) {
      equipmentItems.forEach((item) => {
        if (item.name.trim()) {
          equipmentAccounts.push({
            templateAccountName: 'Equipment',
            name: item.name.trim(),
            isIncluded: true,
            type: 'asset',
          })
        }
      })
    }

    // Vehicles
    if (includeVehicles) {
      vehicleItems.forEach((item) => {
        if (item.name.trim()) {
          equipmentAccounts.push({
            templateAccountName: 'Vehicle',
            name: item.name.trim(),
            isIncluded: true,
            type: 'asset',
          })
        }
      })
    }

    // Property
    if (includeProperty) {
      propertyItems.forEach((item) => {
        if (item.name.trim()) {
          equipmentAccounts.push({
            templateAccountName: 'Property',
            name: item.name.trim(),
            isIncluded: true,
            type: 'asset',
          })
        }
      })
    }

    // LIABILITIES
    // Accounts Payable
    liabilityAccounts.push({
      templateAccountName: 'Accounts Payable',
      name: 'Accounts Payable',
      isIncluded: true,
      type: 'liability',
    })

    // Credit Cards
    creditCards.forEach((card) => {
      if (card.name.trim()) {
        liabilityAccounts.push({
          templateAccountName: 'Credit Card',
          name: card.name.trim(),
          isIncluded: true,
          type: 'liability',
        })
      }
    })

    // Loans
    loans.forEach((loan) => {
      if (loan.name.trim()) {
        liabilityAccounts.push({
          templateAccountName: 'Loan',
          name: loan.name.trim(),
          description: loan.balance ? `Current balance: $${loan.balance}` : undefined,
          isIncluded: true,
          type: 'liability',
        })
      }
    })

    // INCOME
    incomeSources.forEach((income) => {
      if (income.name.trim()) {
        incomeAccounts.push({
          templateAccountName: 'Income',
          name: income.name.trim(),
          isIncluded: true,
          type: 'income',
        })
      }
    })

    // COST OF GOODS SOLD
    // Common COGS
    if (commonCogs.directLabor) {
      cogsAccounts.push({
        templateAccountName: 'Cost of Goods Sold',
        name: 'COGS - Direct Labor',
        isIncluded: true,
        type: 'cost-of-goods-sold',
      })
    }
    if (commonCogs.packagingLabeling) {
      cogsAccounts.push({
        templateAccountName: 'Cost of Goods Sold',
        name: 'COGS - Packaging + Labeling',
        isIncluded: true,
        type: 'cost-of-goods-sold',
      })
    }
    if (commonCogs.postageShipping) {
      cogsAccounts.push({
        templateAccountName: 'Cost of Goods Sold',
        name: 'COGS - Postage + Shipping',
        isIncluded: true,
        type: 'cost-of-goods-sold',
      })
    }
    if (commonCogs.productPurchases) {
      cogsAccounts.push({
        templateAccountName: 'Cost of Goods Sold',
        name: 'COGS - Product Purchases',
        isIncluded: true,
        type: 'cost-of-goods-sold',
      })
    }
    if (commonCogs.rawIngredients) {
      cogsAccounts.push({
        templateAccountName: 'Cost of Goods Sold',
        name: 'COGS - Raw Ingredients',
        isIncluded: true,
        type: 'cost-of-goods-sold',
      })
    }
    if (commonCogs.smallToolsEquipment) {
      cogsAccounts.push({
        templateAccountName: 'Cost of Goods Sold',
        name: 'COGS - Small Tools + Equipment',
        isIncluded: true,
        type: 'cost-of-goods-sold',
      })
    }
    if (commonCogs.subcontractors) {
      cogsAccounts.push({
        templateAccountName: 'Cost of Goods Sold',
        name: 'COGS - Subcontractors',
        isIncluded: true,
        type: 'cost-of-goods-sold',
      })
    }
    if (commonCogs.suppliesMaterials) {
      cogsAccounts.push({
        templateAccountName: 'Cost of Goods Sold',
        name: 'COGS - Supplies + Materials',
        isIncluded: true,
        type: 'cost-of-goods-sold',
      })
    }

    // Custom COGS
    customCogs.forEach((item) => {
      if (item.name.trim()) {
        cogsAccounts.push({
          templateAccountName: 'Cost of Goods Sold',
          name: item.name.trim(),
          isIncluded: true,
          type: 'cost-of-goods-sold',
        })
      }
    })

    // EXPENSES
    // Common expenses
    if (commonExpenses.bankFees) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Bank Fees',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.businessLicense) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Business License + Permits',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.continuingEducation) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Continuing Education',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.contractLabor) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Contract Labor',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.insurance) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Insurance',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.marketing) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Marketing + Advertising',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.merchantFees) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Merchant Fees',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.officeSupplies) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Office Supplies',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.phoneInternet) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Phone + Internet',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.postageDelivery) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Postage + Delivery',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.professionalFees) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Professional Fees',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.rent) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Rent',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.repairsMaintenance) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Repairs + Maintenance',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.software) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Software + Subscriptions',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.suppliesMaterials) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Supplies + Materials',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.taxesPaid) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Taxes Paid',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.travel) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Travel',
        isIncluded: true,
        type: 'expense',
      })
    }
    if (commonExpenses.utilities) {
      expenseAccounts.push({
        templateAccountName: 'Expense',
        name: 'Utilities',
        isIncluded: true,
        type: 'expense',
      })
    }

    // Custom expenses
    customExpenses.forEach((expense) => {
      if (expense.name.trim()) {
        expenseAccounts.push({
          templateAccountName: 'Expense',
          name: expense.name.trim(),
          isIncluded: true,
          type: 'expense',
        })
      }
    })

    // Step 2: Sort sub-categories alphabetically
    bankAccounts_sorted.sort((a, b) => a.name.localeCompare(b.name))
    equipmentAccounts.sort((a, b) => a.name.localeCompare(b.name))
    liabilityAccounts.sort((a, b) => a.name.localeCompare(b.name))
    incomeAccounts.sort((a, b) => a.name.localeCompare(b.name))
    cogsAccounts.sort((a, b) => a.name.localeCompare(b.name))
    expenseAccounts.sort((a, b) => a.name.localeCompare(b.name))

    // Step 3: Assign account numbers in specific order
    const customizationsList: AccountCustomization[] = []

    // ASSETS in specific order:
    // 1. Bank/Cash accounts (alphabetically)
    // 2. Accounts Receivable
    // 3. Equipment (alphabetically)
    // 4. Inventory
    let accountNumber = 1000

    // 1. Bank/Cash accounts
    bankAccounts_sorted.forEach(account => {
      customizationsList.push({ ...account, accountNumber: String(accountNumber) })
      accountNumber += 10
    })

    // 2. Accounts Receivable
    if (includeAR) {
      customizationsList.push({
        templateAccountName: 'Accounts Receivable',
        name: 'Accounts Receivable',
        isIncluded: true,
        type: 'asset',
        accountNumber: String(accountNumber),
      })
      accountNumber += 10
    }

    // 3. Equipment
    equipmentAccounts.forEach(account => {
      customizationsList.push({ ...account, accountNumber: String(accountNumber) })
      accountNumber += 10
    })

    // 4. Inventory
    if (includeInventory && inventoryName.trim()) {
      customizationsList.push({
        templateAccountName: 'Inventory',
        name: inventoryName.trim(),
        isIncluded: true,
        type: 'asset',
        accountNumber: String(accountNumber),
      })
      accountNumber += 10
    }

    // LIABILITIES (alphabetically)
    accountNumber = 2000
    liabilityAccounts.forEach(account => {
      customizationsList.push({ ...account, accountNumber: String(accountNumber) })
      accountNumber += 10
    })

    // NOTE: Equity accounts (Member Capital, Distributions, Retained Earnings)
    // are auto-generated by the wizard based on entity type.
    // See ChartOfAccountsWizard.tsx handleCreateAccounts() -> generateEquityAccounts()

    // INCOME (alphabetically)
    accountNumber = 4000
    incomeAccounts.forEach(account => {
      customizationsList.push({ ...account, accountNumber: String(accountNumber) })
      accountNumber += 100
    })

    // COST OF GOODS SOLD (alphabetically)
    accountNumber = 5000
    cogsAccounts.forEach(account => {
      customizationsList.push({ ...account, accountNumber: String(accountNumber) })
      accountNumber += 100
    })

    // EXPENSES (alphabetically - includes both common checkboxes and custom entries)
    accountNumber = 6000
    expenseAccounts.forEach(account => {
      customizationsList.push({ ...account, accountNumber: String(accountNumber) })
      accountNumber += 100
    })

    console.log('=== generateCustomizations COMPLETE ===')
    console.log('Total accounts generated:', customizationsList.length)
    console.log('Customizations:', customizationsList)

    // Pass the formData along with customizations to preserve equipment/loan opening balances
    const formData = {
      currentPart,
      bankAccounts,
      includeCash,
      cashAccounts,
      includeEquipment,
      equipmentItems,
      includeVehicles,
      vehicleItems,
      includeProperty,
      propertyItems,
      includeInventory,
      inventoryName,
      creditCards,
      loans,
      incomeSources,
      commonCogs,
      customCogs,
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
        <h3 className={styles.partTitle}>Part 1 of 7: Your Bank Accounts</h3>
        <p className={styles.partDescription}>
          List your business checking and savings accounts.
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

      <div className={styles.cashSection}>
        <div className={styles.cashCheckboxRow}>
          <Checkbox
            label="I handle physical cash"
            checked={includeCash}
            onChange={() => {
              if (!includeCash) {
                // Add first cash account with prefilled name
                setCashAccounts([{ id: crypto.randomUUID(), name: 'Cash on Hand' }])
              }
              setIncludeCash(!includeCash)
            }}
          />
          {includeCash && (
            <div className={styles.cashInputInline}>
              <Input
                value={cashAccounts[0]?.name || ''}
                onChange={(e) => {
                  const updated = [...cashAccounts]
                  if (updated[0]) {
                    updated[0] = { ...updated[0], name: e.target.value }
                  }
                  setCashAccounts(updated)
                }}
                placeholder="Cash on Hand"
              />
            </div>
          )}
        </div>
        {includeCash && cashAccounts.length > 0 && (
          <div className={styles.additionalCashAccounts}>
            {cashAccounts.slice(1).map((account, index) => (
              <div key={account.id} className={styles.inputRow}>
                <Input
                  value={account.name}
                  onChange={(e) => {
                    const updated = [...cashAccounts]
                    updated[index + 1] = { ...account, name: e.target.value }
                    setCashAccounts(updated)
                  }}
                  placeholder="e.g., Back Office Safe"
                  fullWidth
                />
                <button
                  type="button"
                  onClick={() => {
                    setCashAccounts(cashAccounts.filter((_, i) => i !== index + 1))
                  }}
                  className={styles.removeButton}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCashAccounts([...cashAccounts, { id: crypto.randomUUID(), name: '' }])
              }}
            >
              + Add another cash account
            </Button>
          </div>
        )}
      </div>
    </>
  )

  const renderPart2 = () => (
    <>
      <div className={styles.partHeader}>
        <h3 className={styles.partTitle}>Part 2 of 7: Other Assets</h3>
        <p className={styles.partDescription}>
          What other assets does your business have?
        </p>
      </div>

      <div className={styles.optionalSection}>
        <Checkbox
          label="Money owed to me (Accounts Receivable)"
          checked={true}
          onChange={() => {}}
          disabled
          helperText="Track invoices you've sent that haven't been paid yet. This is included automatically."
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
            <p className={styles.equipmentInstructions}>
              Enter each piece of equipment with its purchase date, name, and value.
            </p>
            {equipmentItems.map((item, index) => (
              <div key={item.id} className={styles.equipmentRow}>
                <Input
                  value={item.date}
                  onChange={(e) => {
                    const updated = [...equipmentItems]
                    updated[index] = { ...item, date: e.target.value }
                    setEquipmentItems(updated)
                    setFieldErrors(prev => prev.filter(err => !(err.id === item.id && err.field === 'date')))
                  }}
                  onBlur={(e) => {
                    const parsed = parseSmartDate(e.target.value)
                    if (parsed !== e.target.value) {
                      const updated = [...equipmentItems]
                      updated[index] = { ...item, date: parsed }
                      setEquipmentItems(updated)
                    }
                  }}
                  placeholder="MM/DD/YY"
                  type="text"
                  hasError={hasFieldError(item.id, 'date')}
                  error={getFieldErrorMessage(item.id, 'date')}
                />
                <Input
                  value={item.name}
                  onChange={(e) => {
                    const updated = [...equipmentItems]
                    updated[index] = { ...item, name: e.target.value }
                    setEquipmentItems(updated)
                    setFieldErrors(prev => prev.filter(err => !(err.id === item.id && err.field === 'name')))
                  }}
                  placeholder="Professional Camera"
                  hasError={hasFieldError(item.id, 'name')}
                  error={getFieldErrorMessage(item.id, 'name')}
                />
                <Input
                  value={item.value}
                  onChange={(e) => {
                    const updated = [...equipmentItems]
                    updated[index] = { ...item, value: e.target.value }
                    setEquipmentItems(updated)
                    setFieldErrors(prev => prev.filter(err => !(err.id === item.id && err.field === 'value')))
                  }}
                  placeholder="$3,500.00"
                  type="text"
                  hasError={hasFieldError(item.id, 'value')}
                  error={getFieldErrorMessage(item.id, 'value')}
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
          label="Vehicles"
          checked={includeVehicles}
          onChange={() => setIncludeVehicles(!includeVehicles)}
          helperText="Cars, trucks, vans used for business"
        />
        {includeVehicles && (
          <div className={styles.indentedInput}>
            {vehicleItems.map((item, index) => (
              <div key={item.id} className={styles.equipmentRow}>
                <Input
                  value={item.date}
                  onChange={(e) => {
                    const updated = [...vehicleItems]
                    updated[index] = { ...item, date: e.target.value }
                    setVehicleItems(updated)
                    setFieldErrors(prev => prev.filter(err => !(err.id === item.id && err.field === 'date')))
                  }}
                  onBlur={(e) => {
                    const parsed = parseSmartDate(e.target.value)
                    if (parsed !== e.target.value) {
                      const updated = [...vehicleItems]
                      updated[index] = { ...item, date: parsed }
                      setVehicleItems(updated)
                    }
                  }}
                  placeholder="MM/DD/YY"
                  type="text"
                  hasError={hasFieldError(item.id, 'date')}
                  error={getFieldErrorMessage(item.id, 'date')}
                />
                <Input
                  value={item.name}
                  onChange={(e) => {
                    const updated = [...vehicleItems]
                    updated[index] = { ...item, name: e.target.value }
                    setVehicleItems(updated)
                    setFieldErrors(prev => prev.filter(err => !(err.id === item.id && err.field === 'name')))
                  }}
                  placeholder="2020 Toyota Tacoma"
                  hasError={hasFieldError(item.id, 'name')}
                  error={getFieldErrorMessage(item.id, 'name')}
                />
                <Input
                  value={item.value}
                  onChange={(e) => {
                    const updated = [...vehicleItems]
                    updated[index] = { ...item, value: e.target.value }
                    setVehicleItems(updated)
                    setFieldErrors(prev => prev.filter(err => !(err.id === item.id && err.field === 'value')))
                  }}
                  placeholder="$25,000.00"
                  type="text"
                  hasError={hasFieldError(item.id, 'value')}
                  error={getFieldErrorMessage(item.id, 'value')}
                />
                {vehicleItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setVehicleItems(vehicleItems.filter((_, i) => i !== index))
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
                setVehicleItems([...vehicleItems, { id: crypto.randomUUID(), name: '', value: '', date: '' }])
              }}
            >
              + Add more vehicles
            </Button>
          </div>
        )}
      </div>

      <div className={styles.optionalSection}>
        <Checkbox
          label="Property"
          checked={includeProperty}
          onChange={() => setIncludeProperty(!includeProperty)}
          helperText="Buildings, land, or other real estate"
        />
        {includeProperty && (
          <div className={styles.indentedInput}>
            {propertyItems.map((item, index) => (
              <div key={item.id} className={styles.equipmentRow}>
                <Input
                  value={item.date}
                  onChange={(e) => {
                    const updated = [...propertyItems]
                    updated[index] = { ...item, date: e.target.value }
                    setPropertyItems(updated)
                    setFieldErrors(prev => prev.filter(err => !(err.id === item.id && err.field === 'date')))
                  }}
                  onBlur={(e) => {
                    const parsed = parseSmartDate(e.target.value)
                    if (parsed !== e.target.value) {
                      const updated = [...propertyItems]
                      updated[index] = { ...item, date: parsed }
                      setPropertyItems(updated)
                    }
                  }}
                  placeholder="MM/DD/YY"
                  type="text"
                  hasError={hasFieldError(item.id, 'date')}
                  error={getFieldErrorMessage(item.id, 'date')}
                />
                <Input
                  value={item.name}
                  onChange={(e) => {
                    const updated = [...propertyItems]
                    updated[index] = { ...item, name: e.target.value }
                    setPropertyItems(updated)
                    setFieldErrors(prev => prev.filter(err => !(err.id === item.id && err.field === 'name')))
                  }}
                  placeholder="Office Building"
                  hasError={hasFieldError(item.id, 'name')}
                  error={getFieldErrorMessage(item.id, 'name')}
                />
                <Input
                  value={item.value}
                  onChange={(e) => {
                    const updated = [...propertyItems]
                    updated[index] = { ...item, value: e.target.value }
                    setPropertyItems(updated)
                    setFieldErrors(prev => prev.filter(err => !(err.id === item.id && err.field === 'value')))
                  }}
                  placeholder="$150,000.00"
                  type="text"
                  hasError={hasFieldError(item.id, 'value')}
                  error={getFieldErrorMessage(item.id, 'value')}
                />
                {propertyItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPropertyItems(propertyItems.filter((_, i) => i !== index))
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
                setPropertyItems([...propertyItems, { id: crypto.randomUUID(), name: '', value: '', date: '' }])
              }}
            >
              + Add more property
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
        {includeInventory && (
          <>
            <p className={styles.inventoryNote}>
              <strong>Note:</strong> Whether to track inventory on your books depends on many factors. Consider consulting with a bookkeeper or accountant familiar with your situation.
            </p>
            <div className={styles.indentedInput}>
              <Input
                value={inventoryName}
                onChange={(e) => setInventoryName(e.target.value)}
                placeholder="Product Inventory"
                fullWidth
              />
            </div>
          </>
        )}
      </div>
    </>
  )

  const renderPart3 = () => (
    <>
      <div className={styles.partHeader}>
        <h3 className={styles.partTitle}>Part 3 of 7: Bills & Credit Cards</h3>
        <p className={styles.partDescription}>
          Track what your business owes to vendors and credit card companies.
        </p>
      </div>

      <div className={styles.optionalSection}>
        <Checkbox
          label="Bills I owe (Accounts Payable)"
          checked={true}
          onChange={() => {}}
          disabled
          helperText="Track invoices from vendors that you haven't paid yet. This is included automatically."
        />
      </div>

      <div className={styles.inputSection}>
        <p className={styles.inputSectionLabel}>Credit Cards</p>
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

    </>
  )

  const renderPart4 = () => {
    const currentYear = new Date().getFullYear()
    const lastYear = currentYear - 1

    return (
    <>
      <div className={styles.partHeader}>
        <h3 className={styles.partTitle}>Part 4 of 7: Loans</h3>
        <p className={styles.partDescription}>
          Enter the loan balance from when you want to start tracking. For example, if you want to enter transactions from the beginning of {currentYear}, use the loan balance on 12/31/{lastYear}.
        </p>
      </div>

      <div className={styles.inputSection}>
        {loans.map((loan, index) => (
          <div key={loan.id} className={styles.equipmentRow}>
            <Input
              value={loan.date}
              onChange={(e) => {
                const updated = [...loans]
                updated[index] = { ...loan, date: e.target.value }
                setLoans(updated)
                setFieldErrors(prev => prev.filter(err => !(err.id === loan.id && err.field === 'date')))
              }}
              onBlur={(e) => {
                const parsed = parseSmartDate(e.target.value)
                if (parsed !== e.target.value) {
                  const updated = [...loans]
                  updated[index] = { ...loan, date: parsed }
                  setLoans(updated)
                }
              }}
              placeholder="MM/DD/YY"
              type="text"
              hasError={hasFieldError(loan.id, 'date')}
              error={getFieldErrorMessage(loan.id, 'date')}
            />
            <Input
              value={loan.name}
              onChange={(e) => {
                const updated = [...loans]
                updated[index] = { ...loan, name: e.target.value }
                setLoans(updated)
                setFieldErrors(prev => prev.filter(err => !(err.id === loan.id && err.field === 'name')))
              }}
              placeholder="SBA Loan"
              hasError={hasFieldError(loan.id, 'name')}
              error={getFieldErrorMessage(loan.id, 'name')}
            />
            <Input
              value={loan.balance}
              onChange={(e) => {
                const updated = [...loans]
                updated[index] = { ...loan, balance: e.target.value }
                setLoans(updated)
                setFieldErrors(prev => prev.filter(err => !(err.id === loan.id && err.field === 'balance')))
              }}
              placeholder="$0.00"
              type="text"
              hasError={hasFieldError(loan.id, 'balance')}
              error={getFieldErrorMessage(loan.id, 'balance')}
            />
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
        <p>💡 No loans? Leave the fields empty and continue.</p>
      </div>
    </>
  )
  }

  const renderPart5 = () => (
    <>
      <div className={styles.partHeader}>
        <h3 className={styles.partTitle}>Part 5 of 7: Income</h3>
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
    // Create sorted COGS options for proper column display
    const cogsOptions = [
      { key: 'directLabor', label: 'COGS - Direct Labor' },
      { key: 'packagingLabeling', label: 'COGS - Packaging + Labeling' },
      { key: 'postageShipping', label: 'COGS - Postage + Shipping' },
      { key: 'productPurchases', label: 'COGS - Product Purchases' },
      { key: 'rawIngredients', label: 'COGS - Raw Ingredients' },
      { key: 'smallToolsEquipment', label: 'COGS - Small Tools + Equipment' },
      { key: 'subcontractors', label: 'COGS - Subcontractors' },
      { key: 'suppliesMaterials', label: 'COGS - Supplies + Materials' },
    ]

    // Sort alphabetically - CSS grid-auto-flow: column handles column-wise layout
    cogsOptions.sort((a, b) => a.label.localeCompare(b.label))

    return (
    <>
      <div className={styles.partHeader}>
        <h3 className={styles.partTitle}>Part 6 of 7: Cost of Goods Sold</h3>
        <p className={styles.partDescription}>
          Check what applies to your business, and add any custom categories below.
        </p>
      </div>

      <div className={styles.checkboxGridSmall}>
        {cogsOptions.map(option => (
          <Checkbox
            key={option.key}
            label={option.label}
            checked={commonCogs[option.key as keyof typeof commonCogs]}
            onChange={() => setCommonCogs({
              ...commonCogs,
              [option.key]: !commonCogs[option.key as keyof typeof commonCogs]
            })}
          />
        ))}
      </div>

      <div className={styles.customExpensesSection}>
        <h4 className={styles.sectionSubtitle}>Custom COGS</h4>
        {customCogs.map((item, index) => (
          <div key={item.id} className={styles.inputRow}>
            <Input
              value={item.name}
              onChange={(e) => {
                const updated = [...customCogs]
                updated[index] = { ...item, name: e.target.value }
                setCustomCogs(updated)
              }}
              placeholder="e.g., COGS - Research + Development, COGS - Food, COGS - Beverage"
              fullWidth
            />
            {customCogs.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setCustomCogs(customCogs.filter((_, i) => i !== index))
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
            setCustomCogs([...customCogs, { id: crypto.randomUUID(), name: '' }])
          }}
        >
          + Add custom COGS
        </Button>
      </div>

      <div className={styles.helpNote}>
        <p>💡 Not sure what counts as COGS? These are costs that only happen when you make a sale - like ingredients for a baker, fabric for a seamstress, or parts for a repair shop.</p>
      </div>
    </>
  )
  }

  const renderPart7 = () => {
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
      { key: 'taxesPaid', label: 'Taxes Paid' },
      { key: 'travel', label: 'Travel' },
      { key: 'utilities', label: 'Utilities' },
    ]

    // Sort alphabetically
    expenseOptions.sort((a, b) => a.label.localeCompare(b.label))

    return (
    <>
      <div className={styles.partHeader}>
        <h3 className={styles.partTitle}>Part 7 of 7: Expenses</h3>
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
      case 7:
        return renderPart7()
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
      {renderCurrentPart()}

      <div className={styles.actions}>
        <Button variant="outline" onClick={handlePartBack}>
          {currentPart === 1 ? 'Back to template' : 'Previous'}
        </Button>
        <Button
          variant="primary"
          onClick={handlePartNext}
          disabled={!canProceed()}
        >
          {currentPart === 7 ? 'Continue to review' : 'Next'}
        </Button>
      </div>
    </div>
  )
}
