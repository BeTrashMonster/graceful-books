/**
 * Additional Comprehensive Tests for Chart of Accounts Wizard Service
 *
 * These tests focus on:
 * - Encryption of sensitive data
 * - Edge cases and error scenarios
 * - Data validation
 * - DISC-adapted messaging validation
 * - Large-scale scenarios
 *
 * Part of D8 task for comprehensive unit test coverage
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
import type { EncryptionContext } from '../store/types'
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

describe('CoaWizardService - Additional Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Encryption Context Handling', () => {
    it('should pass encryption context to batch create operation', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [],
      }

      const mockEncryptionContext: EncryptionContext = {
        companyId: 'company-1',
        userId: 'user-1',
        encryptionKey: 'test-key',
      }

      vi.mocked(accountsStore.batchCreateAccounts).mockResolvedValue({
        successful: [{ id: '1', name: 'Account 1' } as any],
        failed: [],
      })

      await createAccountsFromWizard('company-1', wizardData, mockEncryptionContext)

      // Verify encryption context was passed
      expect(accountsStore.batchCreateAccounts).toHaveBeenCalledWith(
        expect.any(Array),
        mockEncryptionContext
      )
    })

    it('should work without encryption context for unencrypted scenarios', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [],
      }

      vi.mocked(accountsStore.batchCreateAccounts).mockResolvedValue({
        successful: [{ id: '1', name: 'Account 1' } as any],
        failed: [],
      })

      await createAccountsFromWizard('company-1', wizardData)

      // Verify it was called without context (undefined)
      expect(accountsStore.batchCreateAccounts).toHaveBeenCalledWith(
        expect.any(Array),
        undefined
      )
    })

    it('should handle encryption errors gracefully', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [],
      }

      const mockEncryptionContext: EncryptionContext = {
        companyId: 'company-1',
        userId: 'user-1',
        encryptionKey: 'invalid-key',
      }

      vi.mocked(accountsStore.batchCreateAccounts).mockRejectedValue(
        new Error('Encryption key invalid')
      )

      const result = await createAccountsFromWizard(
        'company-1',
        wizardData,
        mockEncryptionContext
      )

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Encryption key invalid')
    })
  })

  describe('Large-Scale Account Creation', () => {
    it('should handle creating many custom accounts', async () => {
      const manyCustomAccounts = Array.from({ length: 100 }, (_, i) => ({
        name: `Custom Account ${i}`,
        accountNumber: `9${String(i).padStart(3, '0')}`,
        type: 'expense' as const,
        description: `Custom expense account number ${i}`,
      }))

      const wizardData: CoaWizardData = {
        selectedTemplateId: 'general',
        customizations: [],
        customAccounts: manyCustomAccounts,
      }

      const mockCreatedAccounts = manyCustomAccounts.map((acc, i) => ({
        id: `custom-${i}`,
        ...acc,
        companyId: 'company-1',
        isActive: true,
      }))

      vi.mocked(accountsStore.batchCreateAccounts).mockResolvedValue({
        successful: mockCreatedAccounts as any,
        failed: [],
      })

      const result = await createAccountsFromWizard('company-1', wizardData)

      expect(result.success).toBe(true)
      expect(result.accountsCreated).toBeGreaterThanOrEqual(100)
    })

    it('should handle partial failures in large batches gracefully', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: Array.from({ length: 50 }, (_, i) => ({
          name: `Account ${i}`,
          type: 'expense' as const,
        })),
      }

      // Mock some successes and some failures
      vi.mocked(accountsStore.batchCreateAccounts).mockResolvedValue({
        successful: Array.from({ length: 40 }, (_, i) => ({
          id: `success-${i}`,
          name: `Account ${i}`,
        })) as any,
        failed: Array.from({ length: 10 }, (_, i) => ({
          item: { name: `Account ${40 + i}` } as any,
          error: {
            code: 'DUPLICATE',
            message: `Account ${40 + i} already exists`,
          },
        })),
      })

      const result = await createAccountsFromWizard('company-1', wizardData)

      expect(result.success).toBe(true)
      expect(result.accountsCreated).toBe(40)
      expect(result.errors).toBeDefined()
      expect(result.errors?.length).toBe(10)
    })
  })

  describe('Edge Cases in Validation', () => {
    it('should reject wizard data with only whitespace in custom account names', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [
          {
            name: '   ', // Only whitespace
            type: 'asset',
          },
        ],
      }

      const result = validateWizardData(wizardData)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Custom account missing name')
    })

    it('should validate even with unusual but valid data', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [
          {
            name: 'A', // Single character is technically valid
            type: 'asset',
          },
        ],
      }

      const result = validateWizardData(wizardData)

      expect(result.valid).toBe(true)
    })

    it('should handle empty customizations array', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [],
      }

      const result = validateWizardData(wizardData)

      expect(result.valid).toBe(true)
    })

    it('should reject when all template accounts are excluded but no custom accounts added', () => {
      const customizations = initializeCustomizationsFromTemplate('general')
      const allExcluded = customizations.map((c) => ({
        ...c,
        isIncluded: false,
      }))

      const wizardData: CoaWizardData = {
        selectedTemplateId: 'general',
        customizations: allExcluded,
        customAccounts: [],
      }

      const result = validateWizardData(wizardData)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Must include at least one account')
    })

    it('should accept when some template accounts excluded but custom ones added', () => {
      const customizations = initializeCustomizationsFromTemplate('freelancer')
      const allExcluded = customizations.map((c) => ({
        ...c,
        isIncluded: false,
      }))

      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: allExcluded,
        customAccounts: [
          {
            name: 'My Custom Account',
            type: 'asset',
          },
        ],
      }

      const result = validateWizardData(wizardData)

      expect(result.valid).toBe(true)
    })
  })

  describe('Account Counts and Statistics', () => {
    it('should correctly count accounts across all types', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'retail',
        customizations: [],
        customAccounts: [],
      }

      const counts = getAccountCountsByType(wizardData)

      // Retail should have accounts in multiple categories
      const totalCount = Object.values(counts).reduce((sum, count) => sum + count, 0)
      expect(totalCount).toBeGreaterThan(0)

      // Each type should be a valid number
      Object.values(counts).forEach((count) => {
        expect(typeof count).toBe('number')
        expect(count).toBeGreaterThanOrEqual(0)
      })
    })

    it('should handle mixed template and custom accounts correctly', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [
          { name: 'Custom Asset', type: 'asset' },
          { name: 'Custom Asset 2', type: 'asset' },
          { name: 'Custom Expense', type: 'expense' },
        ],
      }

      const counts = getAccountCountsByType(wizardData)

      // Should include both template and custom accounts
      expect(counts.asset).toBeGreaterThanOrEqual(2)
      expect(counts.expense).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Wizard Summary Generation', () => {
    it('should generate human-friendly summary with plain English', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [],
      }

      const summary = getWizardSummary(wizardData)

      expect(summary.templateName).toBe("The Freelancer's Friend")
      expect(summary.totalAccounts).toBeGreaterThan(0)
      expect(summary.breakdown.length).toBeGreaterThan(0)

      // Verify descriptions use plain English
      summary.breakdown.forEach((item) => {
        expect(item.description).toBeTruthy()
        expect(item.description.length).toBeGreaterThan(0)

        // Should not contain technical jargon
        expect(item.description.toLowerCase()).not.toContain('debit')
        expect(item.description.toLowerCase()).not.toContain('credit')
      })
    })

    it('should only include account types that have accounts', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [],
      }

      const summary = getWizardSummary(wizardData)

      // Verify no zero-count entries in breakdown
      summary.breakdown.forEach((item) => {
        expect(item.count).toBeGreaterThan(0)
      })
    })

    it('should calculate total correctly for mixed scenarios', () => {
      const customizations = initializeCustomizationsFromTemplate('freelancer')
      const someExcluded = customizations.slice(0, 5).map((c) => ({
        ...c,
        isIncluded: false,
      }))

      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: someExcluded,
        customAccounts: [
          { name: 'Custom 1', type: 'asset' },
          { name: 'Custom 2', type: 'income' },
        ],
      }

      const summary = getWizardSummary(wizardData)

      const breakdownTotal = summary.breakdown.reduce(
        (sum, item) => sum + item.count,
        0
      )

      expect(summary.totalAccounts).toBe(breakdownTotal)
    })
  })

  describe('Template Customization Flow', () => {
    it('should preserve user customizations through the full flow', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [
          {
            templateAccountName: 'Business Checking',
            name: 'My Primary Operating Account',
            accountNumber: '1000',
            description: 'Main business checking account',
            isIncluded: true,
          },
        ],
        customAccounts: [],
      }

      vi.mocked(accountsStore.batchCreateAccounts).mockResolvedValue({
        successful: [
          {
            id: 'acc-1',
            name: 'My Primary Operating Account',
            accountNumber: '1000',
            description: 'Main business checking account',
          } as any,
        ],
        failed: [],
      })

      await createAccountsFromWizard('company-1', wizardData)

      const callArgs = vi.mocked(accountsStore.batchCreateAccounts).mock.calls[0]
      const accountsToCreate = callArgs[0]

      const customizedAccount = accountsToCreate.find(
        (acc) => acc.name === 'My Primary Operating Account'
      )

      expect(customizedAccount).toBeDefined()
      expect(customizedAccount?.accountNumber).toBe('1000')
      expect(customizedAccount?.description).toBe('Main business checking account')
    })

    it('should handle mix of customized and uncustomized accounts', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [
          {
            templateAccountName: 'Business Checking',
            name: 'Customized Name',
            isIncluded: true,
          },
          // Other accounts will use template defaults
        ],
        customAccounts: [],
      }

      vi.mocked(accountsStore.batchCreateAccounts).mockResolvedValue({
        successful: [] as any,
        failed: [],
      })

      await createAccountsFromWizard('company-1', wizardData)

      const callArgs = vi.mocked(accountsStore.batchCreateAccounts).mock.calls[0]
      const accountsToCreate = callArgs[0]

      // Should have customized account
      const customizedAccount = accountsToCreate.find(
        (acc) => acc.name === 'Customized Name'
      )
      expect(customizedAccount).toBeDefined()

      // Should also have uncustomized accounts with template names
      const uncustomizedAccounts = accountsToCreate.filter(
        (acc) => acc.name !== 'Customized Name'
      )
      expect(uncustomizedAccounts.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should collect all errors for multiple invalid custom accounts', () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [
          {
            name: '', // Invalid: empty name
            type: 'asset',
          },
          {
            name: 'Valid Name',
            type: undefined as any, // Invalid: missing type
          },
          {
            name: '  ', // Invalid: whitespace only
            type: 'expense',
          },
        ],
      }

      const result = validateWizardData(wizardData)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle database connection errors', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [],
      }

      vi.mocked(accountsStore.batchCreateAccounts).mockRejectedValue(
        new Error('Database connection lost')
      )

      const result = await createAccountsFromWizard('company-1', wizardData)

      expect(result.success).toBe(false)
      expect(result.accountsCreated).toBe(0)
      expect(result.errors).toContain('Database connection lost')
    })

    it('should handle timeout errors', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [],
      }

      vi.mocked(accountsStore.batchCreateAccounts).mockRejectedValue(
        new Error('Operation timed out')
      )

      const result = await createAccountsFromWizard('company-1', wizardData)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Operation timed out')
    })
  })

  describe('Template Selection and Initialization', () => {
    it('should initialize different templates correctly', () => {
      // Valid template IDs from industryTemplates.ts
      const templates = ['freelancer', 'retail', 'service', 'creative', 'general']

      templates.forEach((templateId) => {
        const customizations = initializeCustomizationsFromTemplate(templateId)

        expect(customizations.length).toBeGreaterThan(0)

        customizations.forEach((customization) => {
          expect(customization.templateAccountName).toBeTruthy()
          expect(customization.name).toBeTruthy()
          expect(typeof customization.isIncluded).toBe('boolean')
        })
      })
    })

    it('should mark required accounts as included by default', () => {
      const customizations = initializeCustomizationsFromTemplate('freelancer')

      // Required accounts should exist and be included
      const requiredAccount = customizations.find((c) =>
        c.templateAccountName.includes('Checking')
      )

      expect(requiredAccount).toBeDefined()
      expect(requiredAccount?.isIncluded).toBe(true)
    })
  })

  describe('Data Integrity', () => {
    it('should maintain account number uniqueness', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'general',
        customizations: [],
        customAccounts: [],
      }

      vi.mocked(accountsStore.batchCreateAccounts).mockResolvedValue({
        successful: [] as any,
        failed: [],
      })

      await createAccountsFromWizard('company-1', wizardData)

      const callArgs = vi.mocked(accountsStore.batchCreateAccounts).mock.calls[0]
      const accountsToCreate = callArgs[0]

      // Check for duplicate account numbers
      const accountNumbers = accountsToCreate
        .filter((acc) => acc.accountNumber)
        .map((acc) => acc.accountNumber)

      const uniqueNumbers = new Set(accountNumbers)
      expect(uniqueNumbers.size).toBe(accountNumbers.length)
    })

    it('should set correct company ID for all accounts', async () => {
      const companyId = 'test-company-123'
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [{ name: 'Custom', type: 'asset' }],
      }

      vi.mocked(accountsStore.batchCreateAccounts).mockResolvedValue({
        successful: [] as any,
        failed: [],
      })

      await createAccountsFromWizard(companyId, wizardData)

      const callArgs = vi.mocked(accountsStore.batchCreateAccounts).mock.calls[0]
      const accountsToCreate = callArgs[0]

      // All accounts should have the correct company ID
      accountsToCreate.forEach((acc) => {
        expect(acc.companyId).toBe(companyId)
      })
    })

    it('should set all accounts as active by default', async () => {
      const wizardData: CoaWizardData = {
        selectedTemplateId: 'freelancer',
        customizations: [],
        customAccounts: [],
      }

      vi.mocked(accountsStore.batchCreateAccounts).mockResolvedValue({
        successful: [] as any,
        failed: [],
      })

      await createAccountsFromWizard('company-1', wizardData)

      const callArgs = vi.mocked(accountsStore.batchCreateAccounts).mock.calls[0]
      const accountsToCreate = callArgs[0]

      // All accounts should be active
      accountsToCreate.forEach((acc) => {
        expect(acc.isActive).toBe(true)
      })
    })
  })
})
