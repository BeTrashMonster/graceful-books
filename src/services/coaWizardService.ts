/**
 * Chart of Accounts Wizard Service
 *
 * Service layer for the COA wizard, integrating with the accounts store
 * and handling batch account creation from templates.
 *
 * Per ACCT-001 and D1: Educational wizard with plain English support
 */

import { batchCreateAccounts } from '../store/accounts'
import { getTemplateById } from '../data/industryTemplates'
import type { CoaWizardData, AccountCustomization } from '../types/wizard.types'
import type { Account, AccountType } from '../types'
import type { EncryptionContext } from '../store/types'
import { logger } from '../utils/logger'

export interface CreateAccountsFromWizardResult {
  success: boolean
  accountsCreated: number
  errors?: string[]
  createdAccounts?: Account[]
}

/**
 * Create accounts from wizard data
 *
 * Takes the completed wizard data and creates all selected accounts
 * in the chart of accounts.
 */
export async function createAccountsFromWizard(
  companyId: string,
  wizardData: CoaWizardData,
  context?: EncryptionContext
): Promise<CreateAccountsFromWizardResult> {
  try {
    // Get the selected template
    const template = getTemplateById(wizardData.selectedTemplateId || '')

    if (!template) {
      return {
        success: false,
        accountsCreated: 0,
        errors: ['Template not found'],
      }
    }

    // Determine which accounts to create
    const accountsToCreate: Array<Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'balance'>> = []

    // Create accounts from template
    for (const templateAccount of template.accounts) {
      // Check if this account has customizations
      const customization = wizardData.customizations.find(
        c => c.templateAccountName === templateAccount.name
      )

      // Skip if explicitly excluded
      if (customization && !customization.isIncluded) {
        continue
      }

      // Use customized values if available, otherwise use template defaults
      const accountName = customization?.name || templateAccount.name
      const accountNumber = customization?.accountNumber || templateAccount.accountNumber
      const description = customization?.description || templateAccount.description

      accountsToCreate.push({
        companyId,
        name: accountName,
        accountNumber,
        type: templateAccount.type,
        description,
        isActive: true,
      })
    }

    // Add custom accounts created by user
    for (const customAccount of wizardData.customAccounts) {
      accountsToCreate.push({
        companyId,
        name: customAccount.name,
        accountNumber: customAccount.accountNumber,
        type: customAccount.type,
        description: customAccount.description,
        isActive: true,
      })
    }

    // Batch create all accounts
    logger.info('Creating accounts from wizard', {
      companyId,
      templateId: template.id,
      accountCount: accountsToCreate.length,
    })

    const batchResult = await batchCreateAccounts(accountsToCreate, context)

    // Check results
    if (batchResult.failed.length > 0) {
      logger.warn('Some accounts failed to create', {
        failedCount: batchResult.failed.length,
        errors: batchResult.failed.map(f => f.error.message),
      })
    }

    return {
      success: batchResult.successful.length > 0,
      accountsCreated: batchResult.successful.length,
      errors: batchResult.failed.length > 0 ? batchResult.failed.map(f => f.error.message) : undefined,
      createdAccounts: batchResult.successful,
    }
  } catch (error) {
    logger.error('Failed to create accounts from wizard', { error })
    return {
      success: false,
      accountsCreated: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}

/**
 * Initialize customizations from template
 *
 * Creates default customization entries for all template accounts,
 * making it easy for users to modify them.
 */
export function initializeCustomizationsFromTemplate(
  templateId: string
): AccountCustomization[] {
  const template = getTemplateById(templateId)

  if (!template) {
    return []
  }

  return template.accounts.map(account => ({
    templateAccountName: account.name,
    name: account.name,
    accountNumber: account.accountNumber,
    description: account.description,
    isIncluded: account.isDefault, // Default accounts are included by default
  }))
}

/**
 * Get account count by type from wizard data
 *
 * Helpful for showing summary statistics in the review step
 */
export function getAccountCountsByType(
  wizardData: CoaWizardData
): Record<AccountType, number> {
  const template = getTemplateById(wizardData.selectedTemplateId || '')

  const counts: Record<AccountType, number> = {
    asset: 0,
    liability: 0,
    equity: 0,
    income: 0,
    expense: 0,
    'cost-of-goods-sold': 0,
    'other-income': 0,
    'other-expense': 0,
  }

  if (!template) {
    return counts
  }

  // Count template accounts
  for (const account of template.accounts) {
    const customization = wizardData.customizations.find(
      c => c.templateAccountName === account.name
    )

    // Only count if included (or no customization exists)
    if (!customization || customization.isIncluded) {
      counts[account.type]++
    }
  }

  // Count custom accounts
  for (const account of wizardData.customAccounts) {
    counts[account.type]++
  }

  return counts
}

/**
 * Validate wizard data before creation
 *
 * Ensures all required fields are present and valid
 */
export function validateWizardData(
  wizardData: CoaWizardData
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Must have a template selected
  if (!wizardData.selectedTemplateId) {
    errors.push('No template selected')
  }

  // Validate template exists
  const template = getTemplateById(wizardData.selectedTemplateId || '')
  if (!template) {
    errors.push('Invalid template ID')
  }

  // Check that at least some accounts will be created
  const accountCounts = getAccountCountsByType(wizardData)
  const totalAccounts = Object.values(accountCounts).reduce((sum, count) => sum + count, 0)

  if (totalAccounts === 0) {
    errors.push('Must include at least one account')
  }

  // Validate custom accounts
  for (const customAccount of wizardData.customAccounts) {
    if (!customAccount.name || customAccount.name.trim().length === 0) {
      errors.push('Custom account missing name')
    }
    if (!customAccount.type) {
      errors.push('Custom account missing type')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get plain English summary of what will be created
 *
 * Used in the review step to show user-friendly descriptions
 */
export function getWizardSummary(wizardData: CoaWizardData): {
  templateName: string
  totalAccounts: number
  breakdown: Array<{ type: string; count: number; description: string }>
} {
  const template = getTemplateById(wizardData.selectedTemplateId || '')
  const counts = getAccountCountsByType(wizardData)

  const typeDescriptions: Record<AccountType, string> = {
    asset: 'Things your business owns',
    liability: 'Money your business owes',
    equity: "Your ownership stake",
    income: 'Money coming in',
    expense: 'Operating costs',
    'cost-of-goods-sold': 'Direct costs of sales',
    'other-income': 'Non-operating income',
    'other-expense': 'Non-operating expenses',
  }

  const breakdown = Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => ({
      type,
      count,
      description: typeDescriptions[type as AccountType],
    }))

  return {
    templateName: template?.friendlyName || 'Unknown Template',
    totalAccounts: Object.values(counts).reduce((sum, count) => sum + count, 0),
    breakdown,
  }
}
