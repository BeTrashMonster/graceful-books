/**
 * Industry Templates Tests
 */

import { describe, it, expect } from 'vitest'
import {
  INDUSTRY_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
  getDefaultAccounts,
  getRequiredAccounts,
} from './industryTemplates'

describe('industryTemplates', () => {
  describe('INDUSTRY_TEMPLATES', () => {
    it('should have at least 5 templates', () => {
      expect(INDUSTRY_TEMPLATES.length).toBeGreaterThanOrEqual(5)
    })

    it('should have templates with friendly names', () => {
      INDUSTRY_TEMPLATES.forEach((template) => {
        expect(template.friendlyName).toBeDefined()
        expect(template.friendlyName.length).toBeGreaterThan(0)

        // Should be friendly, not technical
        expect(template.friendlyName).not.toMatch(/Independent Contractor/i)
      })
    })

    it('should have plain English descriptions', () => {
      INDUSTRY_TEMPLATES.forEach((template) => {
        expect(template.description).toBeDefined()
        expect(template.description.length).toBeGreaterThan(0)

        // Should be descriptive
        expect(template.description.split(' ').length).toBeGreaterThan(5)
      })
    })

    it('should have accounts with plain English explanations', () => {
      INDUSTRY_TEMPLATES.forEach((template) => {
        template.accounts.forEach((account) => {
          expect(account.explanation).toBeDefined()
          expect(account.explanation.length).toBeGreaterThan(0)

          // Explanations should be substantial (at least a few words)
          expect(account.explanation.split(' ').length).toBeGreaterThanOrEqual(3)
        })
      })
    })

    it('should have required accounts marked correctly', () => {
      INDUSTRY_TEMPLATES.forEach((template) => {
        const requiredAccounts = template.accounts.filter((a) => a.isRequired)

        // Should have at least some required accounts
        expect(requiredAccounts.length).toBeGreaterThan(0)

        // Common required accounts: checking, equity, income
        const hasChecking = template.accounts.some(
          (a) => a.type === 'asset' && a.name.toLowerCase().includes('checking') && a.isRequired
        )
        const hasEquity = template.accounts.some(
          (a) => a.type === 'equity' && a.isRequired
        )
        const hasIncome = template.accounts.some(
          (a) => a.type === 'income' && a.isRequired
        )

        expect(hasChecking).toBe(true)
        expect(hasEquity).toBe(true)
        expect(hasIncome).toBe(true)
      })
    })

    it('should have default accounts marked', () => {
      INDUSTRY_TEMPLATES.forEach((template) => {
        const defaultAccounts = template.accounts.filter((a) => a.isDefault)

        // Should have default accounts
        expect(defaultAccounts.length).toBeGreaterThan(0)

        // All required accounts should be default
        template.accounts.forEach((account) => {
          if (account.isRequired) {
            expect(account.isDefault).toBe(true)
          }
        })
      })
    })

    it('should have valid account types', () => {
      const validTypes = [
        'asset',
        'liability',
        'equity',
        'income',
        'expense',
        'cost-of-goods-sold',
        'other-income',
        'other-expense',
      ]

      INDUSTRY_TEMPLATES.forEach((template) => {
        template.accounts.forEach((account) => {
          expect(validTypes).toContain(account.type)
        })
      })
    })

    it('should have account numbers in correct format', () => {
      INDUSTRY_TEMPLATES.forEach((template) => {
        template.accounts.forEach((account) => {
          if (account.accountNumber) {
            // Should be numeric
            expect(/^\d+$/.test(account.accountNumber)).toBe(true)
          }
        })
      })
    })
  })

  describe('getTemplateById', () => {
    it('should return template by ID', () => {
      const template = getTemplateById('freelancer')
      expect(template).toBeDefined()
      expect(template?.id).toBe('freelancer')
    })

    it('should return undefined for invalid ID', () => {
      const template = getTemplateById('nonexistent')
      expect(template).toBeUndefined()
    })
  })

  describe('getTemplatesByCategory', () => {
    it('should return templates by category', () => {
      const serviceTemplates = getTemplatesByCategory('service')
      expect(serviceTemplates.length).toBeGreaterThan(0)
      serviceTemplates.forEach((template) => {
        expect(template.category).toBe('service')
      })
    })

    it('should return empty array for category with no templates', () => {
      const templates = getTemplatesByCategory('nonexistent')
      expect(templates).toEqual([])
    })
  })

  describe('getDefaultAccounts', () => {
    it('should return only default accounts', () => {
      const templateId = INDUSTRY_TEMPLATES[0].id
      const defaultAccounts = getDefaultAccounts(templateId)

      expect(defaultAccounts.length).toBeGreaterThan(0)
      defaultAccounts.forEach((account) => {
        expect(account.isDefault).toBe(true)
      })
    })

    it('should return empty array for invalid template ID', () => {
      const defaultAccounts = getDefaultAccounts('invalid')
      expect(defaultAccounts).toEqual([])
    })
  })

  describe('getRequiredAccounts', () => {
    it('should return only required accounts', () => {
      const templateId = INDUSTRY_TEMPLATES[0].id
      const requiredAccounts = getRequiredAccounts(templateId)

      expect(requiredAccounts.length).toBeGreaterThan(0)
      requiredAccounts.forEach((account) => {
        expect(account.isRequired).toBe(true)
      })
    })

    it('should return empty array for invalid template ID', () => {
      const requiredAccounts = getRequiredAccounts('invalid')
      expect(requiredAccounts).toEqual([])
    })
  })

  describe('Template Quality', () => {
    it('freelancer template should have appropriate accounts', () => {
      const template = getTemplateById('freelancer')
      expect(template).toBeDefined()

      const accountNames = template!.accounts.map((a) => a.name.toLowerCase())

      // Should have common freelancer accounts
      expect(accountNames.some((name) => name.includes('checking'))).toBe(true)
      expect(accountNames.some((name) => name.includes('service') || name.includes('revenue'))).toBe(true)
      expect(accountNames.some((name) => name.includes('software') || name.includes('subscription'))).toBe(true)
    })

    it('retail template should have inventory account', () => {
      const template = getTemplateById('retail')
      expect(template).toBeDefined()

      const hasInventory = template!.accounts.some(
        (a) => a.name.toLowerCase().includes('inventory')
      )
      expect(hasInventory).toBe(true)
    })

    it('retail template should have payment processing fees', () => {
      const template = getTemplateById('retail')
      expect(template).toBeDefined()

      const hasProcessingFees = template!.accounts.some(
        (a) => a.name.toLowerCase().includes('payment') || a.name.toLowerCase().includes('processing')
      )
      expect(hasProcessingFees).toBe(true)
    })
  })

  describe('DISC Steadiness Communication Style', () => {
    it('should use judgment-free, encouraging language in explanations', () => {
      const discouragingPhrases = [
        'you must',
        'you should have',
        'it\'s wrong',
        'incorrect',
        'bad',
        'failure',
      ]

      INDUSTRY_TEMPLATES.forEach((template) => {
        template.accounts.forEach((account) => {
          const lowerExplanation = account.explanation.toLowerCase()

          discouragingPhrases.forEach((phrase) => {
            expect(lowerExplanation).not.toContain(phrase)
          })
        })
      })
    })

    it('should use supportive language', () => {
      const supportivePhrases = [
        'helps you',
        'makes it easier',
        'this is where',
        'think of it',
        'like',
      ]

      let foundSupportiveLanguage = false

      INDUSTRY_TEMPLATES.forEach((template) => {
        template.accounts.forEach((account) => {
          const lowerExplanation = account.explanation.toLowerCase()

          if (supportivePhrases.some((phrase) => lowerExplanation.includes(phrase))) {
            foundSupportiveLanguage = true
          }
        })
      })

      expect(foundSupportiveLangua