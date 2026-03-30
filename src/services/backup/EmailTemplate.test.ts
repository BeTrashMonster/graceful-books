/**
 * Email Template Service Tests
 *
 * Tests for email template generation including HTML, plain text,
 * validation, and responsive design.
 */

import { describe, it, expect } from 'vitest'
import {
  generateRestorationEmail,
  validateEmailTemplateOptions,
  previewEmailInBrowser,
  type EmailTemplateOptions,
} from './EmailTemplate'

describe('EmailTemplate', () => {
  const mockOptions: EmailTemplateOptions = {
    recipientEmail: 'user@example.com',
    restorationUrl: 'https://app.gracefulbooks.com/restore?token=abc123',
    companyName: 'Test Company LLC',
    backupDate: new Date('2026-03-23T10:00:00Z'),
    expirationDate: new Date('2026-03-30T10:00:00Z'),
    backupSizeFormatted: '2.5 MB',
  }

  describe('generateRestorationEmail', () => {
    it('should generate complete email template', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toBeDefined()
      expect(result.text).toBeDefined()
      expect(result.subject).toBeDefined()
    })

    it('should include subject line', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.subject).toBe('Your Test Company LLC Backup is Ready')
      expect(result.subject).toContain(mockOptions.companyName)
    })

    it('should include recipient email in HTML', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain(mockOptions.recipientEmail)
    })

    it('should include restoration URL in HTML', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain(mockOptions.restorationUrl)
      // Check for both button href and plain text URL
      expect(result.html).toContain(`href="${mockOptions.restorationUrl}"`)
    })

    it('should include company name in HTML', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain(mockOptions.companyName)
    })

    it('should include backup details in HTML', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain(mockOptions.backupSizeFormatted)
      expect(result.html).toContain('Backup Details')
    })

    it('should include security warnings in HTML', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain('Security Notice')
      expect(result.html).toContain('One-time use')
      expect(result.html).toContain('expires')
      expect(result.html).toContain('Rate limited')
    })

    it('should include zero-knowledge explanation in HTML', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain('Zero-Knowledge')
      expect(result.html).toContain('encrypted')
      expect(result.html).toContain('passphrase')
    })

    it('should include step-by-step instructions in HTML', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain('How to Restore')
      expect(result.html).toContain('Click the restoration link')
      expect(result.html).toContain('Enter your passphrase')
      expect(result.html).toContain('Choose what to restore')
    })

    it('should have responsive CSS in HTML', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain('@media')
      expect(result.html).toContain('max-width: 600px')
    })

    it('should include brand colors in HTML', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain('#2C5F2D') // Primary green
      expect(result.html).toContain('#97BC62') // Secondary green
      expect(result.html).toContain('#FFB81C') // Accent gold
    })

    it('should calculate days until expiration', () => {
      const result = generateRestorationEmail(mockOptions)

      // Should show 7 days (difference between backup and expiration)
      expect(result.html).toContain('7 days')
    })
  })

  describe('plain text template', () => {
    it('should include recipient email in text', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.text).toContain(mockOptions.recipientEmail)
    })

    it('should include restoration URL in text', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.text).toContain(mockOptions.restorationUrl)
    })

    it('should include company name in text', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.text).toContain(mockOptions.companyName)
    })

    it('should include backup details in text', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.text).toContain('BACKUP DETAILS')
      expect(result.text).toContain(mockOptions.backupSizeFormatted)
    })

    it('should include security warnings in text', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.text).toContain('SECURITY NOTICE')
      expect(result.text).toContain('One-time use')
      expect(result.text).toContain('expires')
    })

    it('should include zero-knowledge explanation in text', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.text).toContain('ZERO-KNOWLEDGE')
      expect(result.text).toContain('encrypted')
    })

    it('should include step-by-step instructions in text', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.text).toContain('HOW TO RESTORE')
      expect(result.text).toContain('1.')
      expect(result.text).toContain('2.')
      expect(result.text).toContain('3.')
      expect(result.text).toContain('4.')
    })

    it('should be readable without HTML formatting', () => {
      const result = generateRestorationEmail(mockOptions)

      // Check for proper section headers
      expect(result.text).toMatch(/={10,}/)
      expect(result.text).toMatch(/-{10,}/)

      // Should not contain HTML tags
      expect(result.text).not.toContain('<')
      expect(result.text).not.toContain('>')
    })
  })

  describe('validateEmailTemplateOptions', () => {
    it('should validate complete options', () => {
      const result = validateEmailTemplateOptions(mockOptions)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject missing recipient email', () => {
      const options = { ...mockOptions, recipientEmail: '' }
      const result = validateEmailTemplateOptions(options)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('email is required')
    })

    it('should reject invalid recipient email', () => {
      const options = { ...mockOptions, recipientEmail: 'not-an-email' }
      const result = validateEmailTemplateOptions(options)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('email is invalid')
    })

    it('should reject missing restoration URL', () => {
      const options = { ...mockOptions, restorationUrl: '' }
      const result = validateEmailTemplateOptions(options)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('URL is required')
    })

    it('should reject invalid restoration URL', () => {
      const options = { ...mockOptions, restorationUrl: 'not-a-url' }
      const result = validateEmailTemplateOptions(options)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('URL is invalid')
    })

    it('should reject missing company name', () => {
      const options = { ...mockOptions, companyName: '' }
      const result = validateEmailTemplateOptions(options)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Company name is required')
    })

    it('should reject missing backup date', () => {
      const options = { ...mockOptions, backupDate: null as any }
      const result = validateEmailTemplateOptions(options)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Backup date is required')
    })

    it('should reject missing expiration date', () => {
      const options = { ...mockOptions, expirationDate: null as any }
      const result = validateEmailTemplateOptions(options)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Expiration date is required')
    })

    it('should reject expiration before backup date', () => {
      const options = {
        ...mockOptions,
        expirationDate: new Date('2026-03-20T10:00:00Z'), // Before backup date
      }
      const result = validateEmailTemplateOptions(options)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('after backup date')
    })

    it('should reject missing backup size', () => {
      const options = { ...mockOptions, backupSizeFormatted: '' }
      const result = validateEmailTemplateOptions(options)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Backup size is required')
    })
  })

  describe('email format', () => {
    it('should use proper HTML structure', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain('<!DOCTYPE html>')
      expect(result.html).toContain('<html')
      expect(result.html).toContain('<head>')
      expect(result.html).toContain('<body>')
      expect(result.html).toContain('</html>')
    })

    it('should include viewport meta for mobile', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain('viewport')
      expect(result.html).toContain('width=device-width')
    })

    it('should include charset meta', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain('charset="UTF-8"')
    })

    it('should use inline CSS for email compatibility', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain('<style>')
      expect(result.html).not.toContain('<link')
    })

    it('should have accessible button with proper styling', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain('cta-button')
      expect(result.html).toContain('Access Your Backup')
    })
  })

  describe('content safety', () => {
    it('should not expose sensitive token in subject', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.subject).not.toContain('token')
      expect(result.subject).not.toContain('abc123')
    })

    it('should include security warnings', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain('expires')
      expect(result.html).toContain('Don\'t share this link')
      expect(result.text).toContain('expires')
      expect(result.text).toContain('Don\'t share this link')
    })

    it('should explain zero-knowledge encryption', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain('We never have access to your passphrase')
      expect(result.html).toContain('encrypted on your device')
      expect(result.text).toContain('We never have access to your passphrase')
      expect(result.text).toContain('encrypted on your device')
    })
  })

  describe('user experience', () => {
    it('should use Steadiness communication style', () => {
      const result = generateRestorationEmail(mockOptions)

      // Patient, reassuring tone
      expect(result.html).toContain('ready whenever you need it')
      expect(result.html).toContain('You\'re all set')
      expect(result.html).toContain('Take your time')

      // No blame or negative language
      expect(result.html).not.toContain('must')
      expect(result.html).not.toContain('immediately')
    })

    it('should provide clear next steps', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain('step-number')
      expect(result.html).toContain('step-content')
    })

    it('should include support contact', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain('support@gracefulbooks.com')
      expect(result.text).toContain('support@gracefulbooks.com')
    })

    it('should include privacy and security links', () => {
      const result = generateRestorationEmail(mockOptions)

      expect(result.html).toContain('Privacy Policy')
      expect(result.html).toContain('Security')
      expect(result.text).toContain('Privacy Policy')
      expect(result.text).toContain('Security')
    })
  })

  describe('date formatting', () => {
    it('should format dates in human-readable format', () => {
      const result = generateRestorationEmail(mockOptions)

      // Should include day of week, month name, year
      expect(result.html).toMatch(/Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday/)
      expect(result.html).toMatch(/January|February|March|April|May|June|July|August|September|October|November|December/)
      expect(result.html).toContain('2026')
    })

    it('should show time with timezone', () => {
      const result = generateRestorationEmail(mockOptions)

      // Should include AM/PM and timezone
      expect(result.html).toMatch(/AM|PM/)
    })
  })

  describe('previewEmailInBrowser', () => {
    it('should generate data URL for preview', () => {
      const url = previewEmailInBrowser(mockOptions)

      expect(url).toContain('blob:')
    })

    it('should create valid blob URL', () => {
      const url = previewEmailInBrowser(mockOptions)

      expect(typeof url).toBe('string')
      expect(url.length).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('should handle long company names', () => {
      const options = {
        ...mockOptions,
        companyName: 'Very Long Company Name LLC With Multiple Words And Descriptions',
      }
      const result = generateRestorationEmail(options)

      expect(result.html).toContain(options.companyName)
      expect(result.text).toContain(options.companyName)
    })

    it('should handle special characters in company name', () => {
      const options = {
        ...mockOptions,
        companyName: 'Company & Co. (Est. 2020)',
      }
      const result = generateRestorationEmail(options)

      expect(result.html).toContain('Company &amp; Co.')
      expect(result.text).toContain(options.companyName)
    })

    it('should handle large backup sizes', () => {
      const options = {
        ...mockOptions,
        backupSizeFormatted: '1.2 GB',
      }
      const result = generateRestorationEmail(options)

      expect(result.html).toContain('1.2 GB')
      expect(result.text).toContain('1.2 GB')
    })

    it('should handle expiration on same day', () => {
      const now = new Date()
      const options = {
        ...mockOptions,
        backupDate: now,
        expirationDate: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour later
      }
      const result = generateRestorationEmail(options)

      // Should show 0 days (less than 24 hours)
      expect(result.html).toContain('0 days')
    })
  })
})
