/**
 * Email Follow-Up Templates Service Tests
 *
 * Tests for DISC-adapted email templates for invoice follow-ups.
 */

import { describe, it, expect } from 'vitest'
import {
  getFollowUpTemplate,
  getTemplatePreview,
  getAllTemplatesForProfile,
  formatTemplateVariables,
  type DISCProfile,
  type TemplateVariables,
  type FollowUpTemplateType,
} from './followUpTemplates.service'

describe('Email Follow-Up Templates Service', () => {
  const mockVariables: TemplateVariables = {
    customerName: 'Acme Corporation',
    invoiceNumber: 'INV-2026-0042',
    invoiceDate: '12/15/2025',
    dueDate: '01/14/2026',
    amountDue: '$1,250.00',
    daysOverdue: 3,
    companyName: 'Graceful Books Test',
    contactEmail: 'billing@gracefulbooks.test',
    contactPhone: '(555) 123-4567',
    paymentLink: 'https://pay.gracefulbooks.test/inv-2026-0042',
  }

  describe('getFollowUpTemplate', () => {
    describe('Polite Reminder Templates', () => {
      it('should generate D profile polite reminder with direct, results-oriented tone', () => {
        const template = getFollowUpTemplate('polite-reminder', 'D', mockVariables)

        expect(template.subject).toContain(mockVariables.invoiceNumber)
        expect(template.body).toContain(mockVariables.customerName)
        expect(template.body).toContain(mockVariables.amountDue)
        expect(template.body).not.toContain('{{')
        expect(template.subject).not.toContain('{{')

        // D profile should be direct
        expect(template.subject).toMatch(/Payment Due/i)
      })

      it('should generate I profile polite reminder with warm, collaborative tone', () => {
        const template = getFollowUpTemplate('polite-reminder', 'I', mockVariables)

        expect(template.body).toContain(mockVariables.customerName)
        // I profile should be warm and friendly
        expect(template.body).toMatch(/hope|friendly|reach out|help/i)
        expect(template.subject).toMatch(/friendly/i)
      })

      it('should generate S profile polite reminder with patient, supportive tone', () => {
        const template = getFollowUpTemplate('polite-reminder', 'S', mockVariables)

        expect(template.body).toContain(mockVariables.customerName)
        // S profile should be gentle and supportive
        expect(template.body).toMatch(/gentle|support|understand/i)
        expect(template.subject).toMatch(/gentle/i)
      })

      it('should generate C profile polite reminder with analytical, precise tone', () => {
        const template = getFollowUpTemplate('polite-reminder', 'C', mockVariables)

        expect(template.body).toContain(mockVariables.customerName)
        // C profile should include detailed invoice information
        expect(template.body).toContain(mockVariables.invoiceNumber)
        expect(template.body).toContain(mockVariables.invoiceDate)
        expect(template.body).toContain(mockVariables.dueDate)
        expect(template.body).toContain(mockVariables.amountDue)
        expect(template.body).toMatch(/Details|Invoice Number|Due Date/i)
      })
    })

    describe('Formal Notice Templates', () => {
      it('should generate D profile formal notice with action-oriented language', () => {
        const template = getFollowUpTemplate('formal-notice', 'D', mockVariables)

        expect(template.subject).toMatch(/PAST DUE|Action Required/i)
        expect(template.body).toContain(mockVariables.amountDue)
        expect(template.body).toMatch(/action required|immediately/i)
      })

      it('should generate I profile formal notice maintaining relationship focus', () => {
        const template = getFollowUpTemplate('formal-notice', 'I', mockVariables)

        expect(template.body).toMatch(/relationship|work together|solution/i)
        expect(template.subject).toMatch(/Important/i)
      })

      it('should generate S profile formal notice with caring but firm tone', () => {
        const template = getFollowUpTemplate('formal-notice', 'S', mockVariables)

        expect(template.body).toMatch(/understand|partnership|together|address/i)
      })

      it('should generate C profile formal notice with formal, detailed language', () => {
        const template = getFollowUpTemplate('formal-notice', 'C', mockVariables)

        expect(template.body).toMatch(/Account Status|formal notice/i)
        expect(template.body).toContain(mockVariables.daysOverdue.toString())
      })
    })

    describe('Urgent Follow-Up Templates', () => {
      it('should generate D profile urgent follow-up with clear consequences', () => {
        const template = getFollowUpTemplate('urgent-follow-up', 'D', mockVariables)

        expect(template.subject).toMatch(/URGENT|FINAL/i)
        expect(template.body).toMatch(/final notice|suspension|collections|legal/i)
      })

      it('should generate I profile urgent follow-up maintaining relationship language', () => {
        const template = getFollowUpTemplate('urgent-follow-up', 'I', mockVariables)

        expect(template.body).toMatch(/immediate attention|work with me|escalate/i)
        expect(template.subject).toMatch(/Urgent/i)
      })

      it('should generate S profile urgent follow-up with regretful but firm tone', () => {
        const template = getFollowUpTemplate('urgent-follow-up', 'S', mockVariables)

        expect(template.body).toMatch(/concern|value our relationship|required to escalate/i)
      })

      it('should generate C profile urgent follow-up with legal, formal language', () => {
        const template = getFollowUpTemplate('urgent-follow-up', 'C', mockVariables)

        expect(template.body).toMatch(/FINAL NOTICE|consequences|collections|legal action/i)
        expect(template.body).toContain('SEVERELY DELINQUENT')
      })
    })

    describe('Variable Substitution', () => {
      it('should substitute all provided variables correctly', () => {
        const template = getFollowUpTemplate('polite-reminder', 'C', mockVariables)

        Object.entries(mockVariables).forEach(([key, value]) => {
          if (value && key !== 'paymentLink') {
            // paymentLink is optional
            expect(template.body).toContain(String(value))
          }
        })
      })

      it('should not leave any placeholder variables in output', () => {
        const template = getFollowUpTemplate('formal-notice', 'I', mockVariables)

        expect(template.subject).not.toMatch(/\{\{.*\}\}/)
        expect(template.body).not.toMatch(/\{\{.*\}\}/)
      })

      it('should handle missing payment link gracefully', () => {
        const variablesWithoutLink = { ...mockVariables }
        delete variablesWithoutLink.paymentLink

        const template = getFollowUpTemplate('polite-reminder', 'D', variablesWithoutLink)

        expect(template.body).not.toContain('{{paymentLink}}')
        expect(template.body).not.toMatch(/undefined/)
      })

      it('should include payment link when provided', () => {
        const template = getFollowUpTemplate('polite-reminder', 'S', mockVariables)

        expect(template.body).toContain(mockVariables.paymentLink!)
      })
    })

    describe('Template Metadata', () => {
      it('should return correct template ID in result', () => {
        const template = getFollowUpTemplate('polite-reminder', 'D', mockVariables)

        expect(template.templateId).toBe('polite-reminder')
      })

      it('should include all variables in result', () => {
        const template = getFollowUpTemplate('formal-notice', 'I', mockVariables)

        expect(template.variables).toEqual(mockVariables)
      })
    })
  })

  describe('getTemplatePreview', () => {
    it('should return template with placeholder variables', () => {
      const preview = getTemplatePreview('polite-reminder', 'D')

      expect(preview.subject).toContain('{{invoiceNumber}}')
      expect(preview.body).toContain('{{customerName}}')
      expect(preview.body).toContain('{{amountDue}}')
    })

    it('should return different previews for different DISC profiles', () => {
      const previewD = getTemplatePreview('polite-reminder', 'D')
      const previewI = getTemplatePreview('polite-reminder', 'I')

      expect(previewD.body).not.toBe(previewI.body)
    })

    it('should return different previews for different template types', () => {
      const polite = getTemplatePreview('polite-reminder', 'D')
      const formal = getTemplatePreview('formal-notice', 'D')
      const urgent = getTemplatePreview('urgent-follow-up', 'D')

      expect(polite.subject).not.toBe(formal.subject)
      expect(formal.subject).not.toBe(urgent.subject)
    })
  })

  describe('getAllTemplatesForProfile', () => {
    it('should return all three template types for D profile', () => {
      const templates = getAllTemplatesForProfile('D')

      expect(templates).toHaveLength(3)
      expect(templates.map((t) => t.templateType)).toEqual([
        'polite-reminder',
        'formal-notice',
        'urgent-follow-up',
      ])
    })

    it('should return templates with different subjects for each type', () => {
      const templates = getAllTemplatesForProfile('I')

      const subjects = templates.map((t) => t.subject)
      expect(new Set(subjects).size).toBe(3) // All different
    })

    it('should return templates for each DISC profile', () => {
      const profiles: DISCProfile[] = ['D', 'I', 'S', 'C']

      profiles.forEach((profile) => {
        const templates = getAllTemplatesForProfile(profile)
        expect(templates).toHaveLength(3)
      })
    })
  })

  describe('formatTemplateVariables', () => {
    it('should format invoice data into template variables', () => {
      const invoice = {
        invoice_number: 'INV-2026-0042',
        invoice_date: new Date('2025-12-15').getTime(),
        due_date: new Date('2026-01-14').getTime(),
        total: '1250.00',
      }

      const customer = {
        name: 'Acme Corporation',
        email: 'billing@acme.com',
      }

      const company = {
        name: 'Graceful Books Test',
        email: 'support@gracefulbooks.test',
        phone: '(555) 123-4567',
      }

      const asOfDate = new Date('2026-01-17')

      const variables = formatTemplateVariables(invoice, customer, company, asOfDate)

      expect(variables.customerName).toBe('Acme Corporation')
      expect(variables.invoiceNumber).toBe('INV-2026-0042')
      expect(variables.amountDue).toBe('$1250.00')
      expect(variables.companyName).toBe('Graceful Books Test')
      expect(variables.contactEmail).toBe('support@gracefulbooks.test')
      expect(variables.contactPhone).toBe('(555) 123-4567')
    })

    it('should calculate days overdue correctly', () => {
      const invoice = {
        invoice_number: 'INV-001',
        invoice_date: new Date('2025-12-01').getTime(),
        due_date: new Date('2025-12-31').getTime(),
        total: '1000.00',
      }

      const customer = { name: 'Test Customer' }
      const company = { name: 'Test Company' }
      const asOfDate = new Date('2026-01-17') // 17 days after due date

      const variables = formatTemplateVariables(invoice, customer, company, asOfDate)

      expect(variables.daysOverdue).toBe(17)
    })

    it('should not show negative days overdue for current invoices', () => {
      const invoice = {
        invoice_number: 'INV-001',
        invoice_date: new Date('2026-01-01').getTime(),
        due_date: new Date('2026-02-01').getTime(), // Future due date
        total: '500.00',
      }

      const customer = { name: 'Test Customer' }
      const company = { name: 'Test Company' }
      const asOfDate = new Date('2026-01-17') // Before due date

      const variables = formatTemplateVariables(invoice, customer, company, asOfDate)

      expect(variables.daysOverdue).toBe(0)
    })

    it('should format monetary amounts with currency symbol', () => {
      const invoice = {
        invoice_number: 'INV-001',
        invoice_date: Date.now(),
        due_date: Date.now(),
        total: '1234.56',
      }

      const variables = formatTemplateVariables(
        invoice,
        { name: 'Test' },
        { name: 'Test Co' }
      )

      expect(variables.amountDue).toBe('$1234.56')
    })

    it('should format dates in readable format', () => {
      const invoice = {
        invoice_number: 'INV-001',
        invoice_date: new Date('2026-01-15').getTime(),
        due_date: new Date('2026-02-14').getTime(),
        total: '100.00',
      }

      const variables = formatTemplateVariables(
        invoice,
        { name: 'Test' },
        { name: 'Test Co' }
      )

      expect(variables.invoiceDate).toMatch(/1\/15\/2026/)
      expect(variables.dueDate).toMatch(/2\/14\/2026/)
    })
  })

  describe('DISC Personality Adaptation', () => {
    it('should maintain consistent personality across all template types for D profile', () => {
      const polite = getFollowUpTemplate('polite-reminder', 'D', mockVariables)
      const formal = getFollowUpTemplate('formal-notice', 'D', mockVariables)
      const urgent = getFollowUpTemplate('urgent-follow-up', 'D', mockVariables)

      // D profile should be consistently direct and action-oriented
      expect(polite.body.length).toBeLessThan(formal.body.length)
      expect(urgent.subject).toMatch(/URGENT|FINAL/i)
    })

    it('should maintain consistent personality across all template types for I profile', () => {
      const polite = getFollowUpTemplate('polite-reminder', 'I', mockVariables)
      const formal = getFollowUpTemplate('formal-notice', 'I', mockVariables)
      const urgent = getFollowUpTemplate('urgent-follow-up', 'I', mockVariables)

      // I profile should maintain warmth even in urgent templates
      expect(polite.body).toMatch(/hope|friendly/i)
      expect(formal.body).toMatch(/relationship|together/i)
      expect(urgent.body).toMatch(/work with me|rather/i)
    })

    it('should maintain consistent personality across all template types for S profile', () => {
      const polite = getFollowUpTemplate('polite-reminder', 'S', mockVariables)
      const formal = getFollowUpTemplate('formal-notice', 'S', mockVariables)
      const urgent = getFollowUpTemplate('urgent-follow-up', 'S', mockVariables)

      // S profile should be consistently supportive and patient
      expect(polite.body).toMatch(/gentle|support/i)
      expect(formal.body).toMatch(/understand|partnership/i)
      expect(urgent.body).toMatch(/concern|value/i)
    })

    it('should maintain consistent personality across all template types for C profile', () => {
      const polite = getFollowUpTemplate('polite-reminder', 'C', mockVariables)
      const formal = getFollowUpTemplate('formal-notice', 'C', mockVariables)
      const urgent = getFollowUpTemplate('urgent-follow-up', 'C', mockVariables)

      // C profile should be consistently detailed and precise
      expect(polite.body).toContain('Invoice Details')
      expect(formal.body).toContain('Account Status')
      expect(urgent.body).toContain('Outstanding Balance Summary')
    })
  })
})
