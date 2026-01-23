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
