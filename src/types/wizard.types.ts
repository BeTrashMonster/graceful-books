/**
 * Wizard Type Definitions
 *
 * Types for guided setup wizards including the Chart of Accounts wizard.
 */

import type { AccountType } from './index'

/**
 * Wizard step status
 */
export type WizardStepStatus = 'pending' | 'active' | 'completed' | 'skipped'

/**
 * Base wizard step interface
 */
export interface WizardStep {
  id: string
  title: string
  description: string
  status: WizardStepStatus
  isOptional?: boolean
}

/**
 * Wizard state for persistence
 */
export interface WizardState {
  wizardId: string
  currentStepId: string
  steps: WizardStep[]
  data: Record<string, any>
  startedAt: Date
  lastModifiedAt: Date
  completedAt?: Date
}

/**
 * Industry template for chart of accounts
 */
export interface IndustryTemplate {
  id: string
  name: string
  friendlyName: string
  description: string
  category: IndustryCategory
  icon?: string
  accounts: TemplateAccount[]
}

/**
 * Industry categories
 */
export type IndustryCategory =
  | 'service'
  | 'product'
  | 'creative'
  | 'consulting'
  | 'retail'
  | 'general'

/**
 * Template account definition
 */
export interface TemplateAccount {
  name: string
  accountNumber?: string
  type: AccountType
  description: string
  explanation: string
  isRequired: boolean
  isDefault: boolean
  parentAccountName?: string
}

/**
 * Account customization data
 */
export interface AccountCustomization {
  templateAccountName: string
  name: string
  accountNumber?: string
  description?: string
  isIncluded: boolean
  type?: AccountType
  /**
   * Parent account name if this is a sub-account
   * References the name of another customization
   */
  parentAccountName?: string
  /**
   * Sub-account names for linear wizard entry
   */
  subAccounts?: string[]
}

/**
 * Chart of Accounts wizard data
 */
export interface CoaWizardData {
  selectedTemplateId?: string
  customizations: AccountCustomization[]
  customAccounts: Array<{
    name: string
    accountNumber?: string
    type: AccountType
    description?: string
  }>
  /**
   * Form state for the customization step (Parts 1-6)
   * Saved continuously to support "Save and finish later"
   */
  customizationFormData?: {
    currentPart: number
    bankAccounts: Array<{ id: string; name: string }>
    includeCash: boolean
    cashName: string
    includeEquipment: boolean
    equipmentItems: Array<{ id: string; name: string; value: string; date: string }>
    includeInventory: boolean
    inventoryName: string
    creditCards: Array<{ id: string; name: string; balance: string; date: string }>
    loans: Array<{ id: string; name: string; balance: string; date: string }>
    incomeSources: Array<{ id: string; name: string }>
    commonExpenses: {
      rent: boolean
      insurance: boolean
      software: boolean
      marketing: boolean
      merchantFees: boolean
      phoneInternet: boolean
      officeSupplies: boolean
      bankFees: boolean
      suppliesMaterials: boolean
      utilities: boolean
      contractLabor: boolean
      professionalFees: boolean
      businessLicense: boolean
      continuingEducation: boolean
      travel: boolean
      postageDelivery: boolean
      repairsMaintenance: boolean
    }
    customExpenses: Array<{ id: string; name: string }>
  }
  /**
   * Opening balance journal entry data
   * Generated from equipment, credit card, and loan balances
   */
  openingBalances?: Array<{
    accountName: string
    accountId?: string
    amount: number
    date: Date
    type: 'equipment' | 'credit-card' | 'loan'
  }>
}

/**
 * Wizard progress for persistence
 */
export interface WizardProgress {
  wizardId: string
  companyId: string
  currentStep: string
  data: Record<string, any>
  isComplete: boolean
  lastUpdated: Date
  createdAt: Date
}
