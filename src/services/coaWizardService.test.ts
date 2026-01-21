/**
 * Chart of Accounts Wizard Service Tests
 *
 * Comprehensive tests for COA wizard service layer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createAccountsFromWizard,
  initializeCustomizationsFromTemplate,
  getAccountCountsByType,
  validateWizardData,
  getWizardSummary,
} from './coaWizardService'
import type { CoaWizardData } from '../types/wizard.types'
import * as accountsStore from '../store/accounts'

// Mock the accounts store
vi.mock('../store/accounts', () => ({
  batchCreateAccounts: vi.fn(),
}))

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('CoaWizardService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initializeCustomizationsFromTemplate', () => {
    it('should create customizations for all template accounts', () => {
      const customizations = initializeCustomizationsFromTemplate('freelancer')

      expect(customizations).toBeDefined()
      expect(customizations.length).toBeGreaterThan(0)

      // Check structure of first customization
      const firstCustomization = customizations[0]
      expect(firstCustomization).toHaveProperty('templateAccountName')
      expect(firstCustomization).toHaveProperty('name')
      expect(firstCustomization).toHaveProperty('isIncluded')
    })

    it('should include default accounts by default', () => {
      const customizations = initializeCustomizationsFromTemplate('freelancer')

      // Default accounts should be included
      const defaultAccounts = customizations.filter((c: any) => c.isIncluded)
      expect(defaultAccounts.length).toBeGreaterThan(0)
    })

    it('should return empty array for invalid template', () => {
      const customizations = initializeCustomizationsFromTemplate('invalid-id')

      expect(customizations).toEqual([])
    })
  })

  describe('getAccountCountsByType', () => {
    it('should count accounts from template correctly', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [],
      }

      const counts = getAccountCountsByType(wizardData)

      // Freelancer template has accounts in multiple types
      expect(counts.asset).toBeGreaterThan(0)
      expect(counts.income).toBeGreaterThan(0)
      expect(counts.expense).toBeGreaterThan(0)
    })

    it('should exclude deselected accounts', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [
          {
            templateAccountName: 'Business Checking',
            name: 'Business Checking',
            isIncluded: false, // Excluded
          },
        ],
        customAccounts: [],
      }

      const counts = getAccountCountsByType(wizardData)

      // Should count fewer assets since one is excluded
      const allCustomizations = initializeCustomizationsFromTemplate('freelancer')
      const allCounts = getAccountCountsByType({
        selectedTemplateId: 'freelancer',
        customizations: allCustomizations,
        customAccounts: [],
      })

      expect(counts.asset).toBeLessThan(allCounts.asset)
    })

    it('should include custom accounts in count', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [
          {
            name: 'Custom Asset Account',
            type: 'asset',
            description: 'A custom account',
          },
        ],
      }

      const counts = getAccountCountsByType(wizardData)

      // Should have at least the custom account
      expect(counts.asset).toBeGreaterThan(0)
    })

    it('should return zero counts for invalid template', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'invalid',
        customizations: [],
        customAccounts: [],
      }

      const counts = getAccountCountsByType(wizardData)

      // All counts should be zero
      expect(Object.values(counts).every((count: any) => count === 0)).toBe(true)
    })
  })

  describe('validateWizardData', () => {
    it('should validate correct wizard data', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [],
      }

      const result = validateWizardData(wizardData)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject missing template', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: undefined,
        customizations: [],
        customAccounts: [],
      }

      const result = validateWizardData(wizardData)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('No template selected')
    })

    it('should reject invalid template ID', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'invalid-template',
        customizations: [],
        customAccounts: [],
      }

      const result = validateWizardData(wizardData)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid template ID')
    })

    it('should reject wizard with no accounts', () => {
      const customizations = initializeCustomizationsFromTemplate('freelancer')
      // Exclude all accounts
      const allExcluded = customizations.map((c: any) => ({
        ...c,
        isIncluded: false,
      }))

      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: allExcluded,
        customAccounts: [],
      }

      const result = validateWizardData(wizardData)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Must include at least one account')
    })

    it('should reject custom account without name', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [
          {
            name: '', // Empty name
            type: 'asset',
          },
        ],
      }

      const result = validateWizardData(wizardData)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Custom account missing name')
    })

    it('should reject custom account without type', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [
          {
            name: 'Custom Account',
            type: undefined as any, // Missing type
          },
        ],
      }

      const result = validateWizardData(wizardData)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Custom account missing type')
    })
  })

  describe('getWizardSummary', () => {
    it('should generate summary for valid wizard data', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [],
      }

      const summary = getWizardSummary(wizardData)

      expect(summary).toHaveProperty('templateName')
      expect(summary).toHaveProperty('totalAccounts')
      expect(summary).toHaveProperty('breakdown')

      expect(summary.templateName).toBe("The Freelancer's Friend")
      expect(summary.totalAccounts).toBeGreaterThan(0)
      expect(summary.breakdown.length).toBeGreaterThan(0)
    })

    it('should include only types with accounts in breakdown', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'general',
        customizations: [],
        customAccounts: [],
      }

      const summary = getWizardSummary(wizardData)

      // General template might not have all account types
      const hasZeroCounts = summary.breakdown.some((item: any) => item.count === 0)
      expect(hasZeroCounts).toBe(false)
    })

    it('should include custom accounts in total', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [
          {
            name: 'Custom Asset',
            type: 'asset',
          },
          {
            name: 'Custom Income',
            type: 'income',
          },
        ],
      }

      const summaryWithoutCustom = getWizardSummary({
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [],
      })

      const summaryWithCustom = getWizardSummary(wizardData)

      expect(summaryWithCustom.totalAccounts).toBe(
        summaryWithoutCustom.totalAccounts + 2
      )
    })
  })

  describe('createAccountsFromWizard', () => {
    it('should create accounts successfully', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [],
      }

      // Mock successful batch creation
      const mockAccounts = [
        { id: '1', name: 'Account 1', companyId: 'company-1' },
        { id: '2', name: 'Account 2', companyId: 'company-1' },
      ]

      vi.mocked(accountsStore.batchCreateAccounts).mockResolvedValue({
        successful: mockAccounts as any,
        failed: [],
      })

      const result = await createAccountsFromWizard('company-1', wizardData)

      expect(result.success).toBe(true)
      expect(result.accountsCreated).toBe(2)
      expect(result.errors).toBeUndefined()
      expect(result.createdAccounts).toEqual(mockAccounts)
    })

    it('should handle partial failures', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [],
      }

      // Mock partial failure
      vi.mocked(accountsStore.batchCreateAccounts).mockResolvedValue({
        successful: [{ id: '1', name: 'Account 1' } as any],
        failed: [
          {
            item: { id: '2', name: 'Account 2' } as any,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Duplicate account name',
            },
          },
        ],
      })

      const result = await createAccountsFromWizard('company-1', wizardData)

      expect(result.success).toBe(true) // Still successful if at least one succeeded
      expect(result.accountsCreated).toBe(1)
      expect(result.errors).toBeDefined()
      expect(result.errors).toContain('Duplicate account name')
    })

    it('should handle invalid template', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'invalid-template',
        customizations: [],
        customAccounts: [],
      }

      const result = await createAccountsFromWizard('company-1', wizardData)

      expect(result.success).toBe(false)
      expect(result.accountsCreated).toBe(0)
      expect(result.errors).toContain('Template not found')
    })

    it('should skip excluded accounts', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [
          {
            templateAccountName: 'Business Checking',
            name: 'Business Checking',
            isIncluded: false, // Excluded
          },
        ],
        customAccounts: [],
      }

      vi.mocked(accountsStore.batchCreateAccounts).mockResolvedValue({
        successful: [],
        failed: [],
      })

      await createAccountsFromWizard('company-1', wizardData)

      // Verify that batchCreateAccounts was called
      expect(accountsStore.batchCreateAccounts).toHaveBeenCalled()

      // Get the accounts that were passed to batchCreateAccounts
      const callArgs! = vi.mocked(accountsStore.batchCreateAccounts).mock.calls[0]
      const accountsToCreate = callArgs![0]

      // Business Checking should not be in the list
      const hasBusinessChecking = accountsToCreate.some(
        account => account.name === 'Business Checking'
      )
      expect(hasBusinessChecking).toBe(false)
    })

    it('should include custom accounts', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [
          {
            name: 'My Custom Account',
            type: 'asset',
            accountNumber: '9999',
            description: 'A custom account',
          },
        ],
      }

      vi.mocked(accountsStore.batchCreateAccounts).mockResolvedValue({
        successful: [],
        failed: [],
      })

      await createAccountsFromWizard('company-1', wizardData)

      // Verify custom account was included
      const callArgs! = vi.mocked(accountsStore.batchCreateAccounts).mock.calls[0]
      const accountsToCreate = callArgs![0]

      const hasCustomAccount = accountsToCreate.some(
        account => account.name === 'My Custom Account'
      )
      expect(hasCustomAccount).toBe(true)
    })

    it('should use customized account names', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [
          {
            templateAccountName: 'Business Checking',
            name: 'Main Operating Account', // Customized name
            isIncluded: true,
          },
        ],
        customAccounts: [],
      }

      vi.mocked(accountsStore.batchCreateAccounts).mockResolvedValue({
        successful: [],
        failed: [],
      })

      await createAccountsFromWizard('company-1', wizardData)

      // Verify customized name was used
      const callArgs! = vi.mocked(accountsStore.batchCreateAccounts).mock.calls[0]
      const accountsToCreate = callArgs![0]

      const customizedAccount = accountsToCreate.find(
        account => account.name === 'Main Operating Account'
      )
      expect(customizedAccount).toBeDefined()
    })

    it('should handle exceptions gracefully', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [],
      }

      // Mock exception
      vi.mocked(accountsStore.batchCreateAccounts).mockRejectedValue(
        new Error('Database error')
      )

      const result = await createAccountsFromWizard('company-1', wizardData)

      expect(result.success).toBe(false)
      expect(result.accountsCreated).toBe(0)
      expect(result.errors).toContain('Database error')
    })
  })
})
