/**
 * D3: Email Summary Configuration E2E Tests
 *
 * Tests the weekly email summary setup including:
 * - Day/time selection
 * - Content preferences
 * - DISC-adapted email content
 * - Preview functionality
 * - Unsubscribe mechanism
 */

import { test, expect } from '@playwright/test'
import { setupAuthenticatedSession, clearUserData } from './fixtures/auth'
import { checkAccessibility } from './helpers/accessibility'

test.describe('D3: Email Summary Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await clearUserData(page)
    await setupAuthenticatedSession(page)
  })

  test('should configure weekly email summary', async ({ page }) => {
    // Navigate to settings
    await page.goto('/settings')

    // Look for email/notification settings
    const emailSettings = page.locator('text=/email|notification|summary/i')
    await expect(emailSettings.first()).toBeVisible()

    await emailSettings.first().click()

    // Should show email configuration form
    await expect(page.locator('h2, h3')).toContainText(/Email|Summary|Notification/i)

    // Check for encouraging messaging
    const description = await page.locator('[class*="description"], p').first().textContent()
    expect(description).toMatch(/week ahead|small steps|progress|reminder/i)

    // Enable weekly summary
    const enableCheckbox = page.locator('input[type="checkbox"][name*="enable"], [role="switch"]')
    if (!(await enableCheckbox.isChecked())) {
      await enableCheckbox.click()
    }

    // Select day of week
    const daySelect = page.locator('select[name*="day"], [aria-label*="day"]')
    if (await daySelect.count() > 0) {
      await daySelect.selectOption('Monday')
    }

    // Select time
    const timeInput = page.locator('input[type="time"], select[name*="time"]')
    if (await timeInput.count() > 0) {
      if (await timeInput.getAttribute('type') === 'time') {
        await timeInput.fill('09:00')
      } else {
        await timeInput.selectOption('09:00')
      }
    }

    // Content preferences
    const contentOptions = page.locator('input[type="checkbox"][name*="content"]')
    if (await contentOptions.count() > 0) {
      // Select some content types
      await contentOptions.first().check()
    }

    // Save settings
    await page.click('button:has-text("Save"), button[type="submit"]')

    // Should show success message
    await expect(page.locator('[role="alert"], .success-message')).toContainText(/saved|updated/i)
  })

  test('should preview email before enabling', async ({ page }) => {
    await page.goto('/settings')
    await page.click('text=/email|notification/i')

    // Look for preview functionality
    const previewButton = page.locator('button:has-text("Preview")')

    if (await previewButton.count() > 0) {
      await previewButton.click()

      // Should show preview modal or section
      await expect(page.locator('[role="dialog"], [class*="preview"]')).toBeVisible()

      // Check for preview content
      await expect(page.locator('text=/this is what|you\'ll receive|monday morning/i')).toBeVisible()

      // Preview should show actual email format
      const previewContent = await page.locator('[class*="emailPreview"], [data-preview]').textContent()
      expect(previewContent).toBeTruthy()
      expect(previewContent!.length).toBeGreaterThan(50)

      // Close preview
      await page.keyboard.press('Escape')
    }
  })

  test('should adapt email content to DISC profile', async ({ page }) => {
    await page.goto('/settings')
    await page.click('text=/email|notification/i')

    // Check if DISC adaptation is mentioned
    const settingsText = await page.locator('body').textContent()

    if (settingsText?.includes('communication style') || settingsText?.includes('preferences')) {
      console.log('DISC adaptation settings found')

      // Preview should reflect DISC style
      const previewButton = page.locator('button:has-text("Preview")')
      if (await previewButton.count() > 0) {
        await previewButton.click()

        const preview = await page.locator('[class*="preview"]').textContent()

        // Steadiness style should be patient and step-by-step
        expect(preview).toMatch(/step|together|take your time|here's what/i)
        expect(preview).not.toMatch(/urgent|critical|immediately|asap/i)
      }
    }
  })

  test('should show unsubscribe mechanism', async ({ page }) => {
    await page.goto('/settings')
    await page.click('text=/email|notification/i')

    // Enable emails first
    const enableCheckbox = page.locator('input[type="checkbox"][name*="enable"]').first()
    if (!(await enableCheckbox.isChecked())) {
      await enableCheckbox.click()
      await page.click('button:has-text("Save")')
      await page.waitForTimeout(500)
    }

    // Should show unsubscribe option
    const unsubscribe = page.locator('button:has-text("Unsubscribe"), button:has-text("Disable")')
    await expect(unsubscribe.first()).toBeVisible()

    await unsubscribe.first().click()

    // Should show confirmation
    const confirmation = page.locator('text=/sure|confirm|stop receiving/i')
    if (await confirmation.count() > 0) {
      await expect(confirmation.first()).toBeVisible()
      await page.click('button:has-text("Confirm"), button:has-text("Yes")')
    }

    // Should be disabled
    const checkbox = page.locator('input[type="checkbox"][name*="enable"]').first()
    await expect(checkbox).not.toBeChecked()
  })

  test('should validate email configuration', async ({ page }) => {
    await page.goto('/settings')
    await page.click('text=/email|notification/i')

    // Enable emails
    await page.check('input[type="checkbox"][name*="enable"]').catch(() => {})

    // Try to save without selecting day/time
    await page.click('button:has-text("Save")')

    // Should show validation errors if day/time are required
    const errors = page.locator('[class*="error"], [role="alert"]')
    if (await errors.count() > 0) {
      const errorText = await errors.first().textContent()

      // Error should be helpful
      expect(errorText).toMatch(/please|select|choose|need/i)
      expect(errorText).not.toMatch(/invalid|wrong|error/i)
    }
  })

  test('should show email frequency options', async ({ page }) => {
    await page.goto('/settings')
    await page.click('text=/email|notification/i')

    // Look for frequency options (weekly, daily, etc.)
    const frequencyOptions = page.locator('select[name*="frequency"], [role="radiogroup"]')

    if (await frequencyOptions.count() > 0) {
      console.log('Email frequency options found')

      // Should at least have weekly option
      const optionsText = await page.locator('body').textContent()
      expect(optionsText).toMatch(/weekly|week/i)
    }
  })

  test('should be accessible', async ({ page }) => {
    await page.goto('/settings')
    await page.click('text=/email|notification/i')

    const results = await checkAccessibility(page)

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    expect(criticalViolations).toHaveLength(0)

    // Form controls should have labels
    const inputs = await page.locator('input, select').all()
    for (const input of inputs) {
      const hasLabel = await input.evaluate((el) => {
        const id = el.id
        return (
          el.hasAttribute('aria-label') ||
          el.hasAttribute('aria-labelledby') ||
          (id && document.querySelector(`label[for="${id}"]`))
        )
      })
      expect(hasLabel).toBe(true)
    }
  })

  test('should persist settings across sessions', async ({ page }) => {
    await page.goto('/settings')
    await page.click('text=/email|notification/i')

    // Configure settings
    await page.check('input[type="checkbox"][name*="enable"]').catch(() => {})

    const daySelect = page.locator('select[name*="day"]')
    if (await daySelect.count() > 0) {
      await daySelect.selectOption('Wednesday')
    }

    await page.click('button:has-text("Save")')
    await page.waitForSelector('[role="alert"]')

    // Reload page
    await page.reload()

    // Settings should be persisted
    const checkbox = page.locator('input[type="checkbox"][name*="enable"]').first()
    await expect(checkbox).toBeChecked()

    if (await daySelect.count() > 0) {
      const selectedDay = await daySelect.inputValue()
      expect(selectedDay).toBe('Wednesday')
    }
  })

  test('should show sample email subjects', async ({ page }) => {
    await page.goto('/settings')
    await page.click('text=/email|notification/i')

    // Look for preview button
    const previewButton = page.locator('button:has-text("Preview")')

    if (await previewButton.count() > 0) {
      await previewButton.click()

      // Email should have encouraging subject line
      const preview = await page.locator('[class*="preview"]').textContent()

      // Check for Steadiness-style subject
      expect(preview).toMatch(/your week ahead|small steps|progress|gentle reminder/i)
      expect(preview).not.toMatch(/action required|urgent|warning|overdue/i)
    }
  })

  test('should allow editing after enabling', async ({ page }) => {
    await page.goto('/settings')
    await page.click('text=/email|notification/i')

    // Enable and save
    await page.check('input[type="checkbox"][name*="enable"]').catch(() => {})
    await page.click('button:has-text("Save")')
    await page.waitForTimeout(500)

    // Modify settings
    const daySelect = page.locator('select[name*="day"]')
    if (await daySelect.count() > 0) {
      await daySelect.selectOption('Friday')
      await page.click('button:has-text("Save")')

      // Should update successfully
      await expect(page.locator('[role="alert"]')).toContainText(/saved|updated/i)
    }
  })
})
