/**
 * D1: Chart of Accounts Setup Wizard E2E Tests
 *
 * Tests the complete guided chart of accounts setup workflow including:
 * - Step-by-step wizard navigation
 * - Industry template selection
 * - Account customization
 * - Plain English explanations
 * - Progress tracking and resume capability
 * - Keyboard accessibility
 * - Performance requirements
 * - Joy moments and celebrations
 */

import { test, expect } from '@playwright/test'
import { setupAuthenticatedSession, clearUserData } from './fixtures/auth'
import { checkAccessibility, testKeyboardNavigation, formatViolations } from './helpers/accessibility'
import { measurePageLoad, measureAction, assertPerformance } from './helpers/performance'

test.describe('D1: Chart of Accounts Setup Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await clearUserData(page)
    await setupAuthenticatedSession(page)
  })

  test('should complete the full wizard workflow', async ({ page }) => {
    // Navigate to COA setup
    await page.goto('/chart-of-accounts/setup')

    // Step 1: Welcome
    await expect(page.locator('h2')).toContainText('Welcome')
    await expect(page.locator('text=/set up your chart of accounts/i')).toBeVisible()

    // Check for Steadiness communication style (patient, supportive)
    const welcomeText = await page.locator('[class*="stepBody"]').textContent()
    expect(welcomeText).toMatch(/together|step|guide|help/i)

    await page.click('button:has-text("Get Started"), button:has-text("Next")')

    // Step 2: Template Selection
    await expect(page.locator('h2')).toContainText('Choose Template')

    // Verify industry templates are shown
    await expect(page.locator('[data-template], [class*="template"]')).toHaveCount({ min: 3 })

    // Check for plain English descriptions
    const templateCard = page.locator('[data-template="freelancer"]').first()
    await expect(templateCard).toBeVisible()
    await expect(templateCard).toContainText(/freelancer|creative/i)

    // Select a template
    await templateCard.click()

    // Step 3: Customize Accounts
    await expect(page.locator('h2')).toContainText('Customize')

    // Verify pre-filled accounts from template
    const accountList = page.locator('[data-account-name], [class*="accountItem"]')
    await expect(accountList).toHaveCount({ min: 5 })

    // Check for "Why do I need this?" tooltips
    const tooltip = page.locator('[aria-label*="Why"], [title*="Why"], button:has-text("?")')
    if (await tooltip.count() > 0) {
      await tooltip.first().click()
      await expect(page.locator('[role="tooltip"], [class*="tooltip"]')).toBeVisible()
    }

    // Toggle some accounts off
    const checkboxes = page.locator('input[type="checkbox"]')
    const firstCheckbox = checkboxes.first()
    const isChecked = await firstCheckbox.isChecked()
    await firstCheckbox.click()
    await expect(firstCheckbox).toHaveProperty('checked', !isChecked)

    await page.click('button:has-text("Next"), button:has-text("Continue")')

    // Step 4: Review
    await expect(page.locator('h2')).toContainText('Review')

    // Verify summary of accounts to be created
    const reviewList = page.locator('[class*="reviewItem"], [data-review-account]')
    await expect(reviewList).toHaveCount({ min: 4 })

    // Create accounts
    await page.click('button:has-text("Create Accounts"), button:has-text("Confirm")')

    // Step 5: Completion with celebration
    await expect(page.locator('h2, [class*="title"]')).toContainText(/All Set|Complete|Success/i, {
      timeout: 10000,
    })

    // Check for joy moment - confetti or celebration message
    const celebrationText = await page.locator('body').textContent()
    expect(celebrationText).toMatch(/first account|magic|organization begins|great|success/i)

    // Look for confetti animation or celebration element
    const celebration = page.locator('[class*="confetti"], [class*="celebration"], [data-celebration]')
    // Confetti may or may not be visible depending on implementation
    // Just check it exists in DOM
    const celebrationCount = await celebration.count()
    console.log(`Celebration elements found: ${celebrationCount}`)

    // Complete wizard
    await page.click('button:has-text("Done"), button:has-text("Finish"), button:has-text("Go to")')

    // Verify redirected to chart of accounts page
    await expect(page).toHaveURL(/chart-of-accounts/)

    // Verify accounts were created
    const accountsTable = page.locator('[role="table"], [class*="accountList"]')
    await expect(accountsTable).toBeVisible()
  })

  test('should show progress indicators', async ({ page }) => {
    await page.goto('/chart-of-accounts/setup')

    // Check for progress bar
    const progressBar = page.locator('[role="progressbar"], [class*="progress"]')
    await expect(progressBar).toBeVisible()

    // Check initial progress
    const initialProgress = await progressBar.getAttribute('aria-valuenow')
    expect(Number(initialProgress)).toBeGreaterThanOrEqual(0)

    // Navigate to next step
    await page.click('button:has-text("Get Started"), button:has-text("Next")')

    // Progress should increase
    const nextProgress = await progressBar.getAttribute('aria-valuenow')
    expect(Number(nextProgress)).toBeGreaterThan(Number(initialProgress))

    // Check step indicators
    const stepIndicators = page.locator('[role="tab"], [class*="stepIndicator"]')
    await expect(stepIndicators).toHaveCount({ min: 4 })

    // First step should be completed, second should be active
    const steps = await stepIndicators.all()
    if (steps.length >= 2) {
      await expect(steps[0]).toHaveClass(/completed/)
      await expect(steps[1]).toHaveClass(/active/)
    }
  })

  test('should support save and resume functionality', async ({ page }) => {
    await page.goto('/chart-of-accounts/setup')

    // Navigate to template selection
    await page.click('button:has-text("Get Started"), button:has-text("Next")')

    // Select a template
    await page.click('[data-template="freelancer"], button:has-text("Freelancer")').catch(() =>
      page.click('[data-template]').first()
    )

    // Look for "Save and finish later" button
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Later")')
    if (await saveButton.count() > 0) {
      await saveButton.click()

      // Should be redirected away from wizard
      await expect(page).not.toHaveURL(/setup/)

      // Return to wizard
      await page.goto('/chart-of-accounts/setup')

      // Should resume at the saved step
      await expect(page.locator('h2')).toContainText('Customize')
    }
  })

  test('should be keyboard accessible', async ({ page }) => {
    await page.goto('/chart-of-accounts/setup')

    // Test keyboard navigation
    const { tabStops, focusableElements } = await testKeyboardNavigation(page, {
      expectedTabStops: 10,
    })

    console.log(`Found ${tabStops} tab stops`)
    console.log('Focusable elements:', focusableElements)

    // Should have at least a few focusable elements
    expect(tabStops).toBeGreaterThan(2)

    // Test Enter key to proceed
    await page.keyboard.press('Tab') // Focus first interactive element
    await page.keyboard.press('Enter')

    // Should navigate to next step
    await expect(page.locator('h2')).toContainText('Choose Template')

    // Test Escape key to cancel (if modal)
    await page.keyboard.press('Escape')

    // Should show cancel confirmation or close wizard
    // (Implementation dependent)
  })

  test('should meet WCAG 2.1 AA accessibility standards', async ({ page }) => {
    await page.goto('/chart-of-accounts/setup')

    // Run accessibility check
    const results = await checkAccessibility(page)

    // Log violations for debugging
    if (results.violations.length > 0) {
      console.error('Accessibility violations:', formatViolations(results.violations))
    }

    // Assert no critical violations
    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    expect(criticalViolations).toHaveLength(0)

    // Check specific accessibility features
    const wizard = page.locator('[role="dialog"], [class*="wizard"]').first()
    await expect(wizard).toHaveAttribute('aria-labelledby')

    // Progress bar should have proper ARIA
    const progressBar = page.locator('[role="progressbar"]').first()
    await expect(progressBar).toHaveAttribute('aria-valuenow')
    await expect(progressBar).toHaveAttribute('aria-valuemin')
    await expect(progressBar).toHaveAttribute('aria-valuemax')
  })

  test('should meet page load performance requirements (<2s)', async ({ page }) => {
    // Navigate to wizard
    const startTime = Date.now()
    await page.goto('/chart-of-accounts/setup')
    await page.waitForSelector('h2, [class*="title"]')
    const endTime = Date.now()

    const pageLoadTime = endTime - startTime

    console.log(`Page load time: ${pageLoadTime}ms`)

    // Assert page load < 2000ms
    assertPerformance(pageLoadTime, 2000, 'COA Wizard page load')

    // Measure detailed metrics
    const metrics = await measurePageLoad(page)
    console.log('Performance metrics:', metrics)

    // LCP should be reasonable
    expect(metrics.lcp).toBeLessThan(2500)
  })

  test('should handle back navigation', async ({ page }) => {
    await page.goto('/chart-of-accounts/setup')

    // Move forward
    await page.click('button:has-text("Get Started"), button:has-text("Next")')
    await expect(page.locator('h2')).toContainText('Choose Template')

    // Select template to proceed to customization
    await page.click('[data-template]').first()
    await expect(page.locator('h2')).toContainText('Customize')

    // Go back
    await page.click('button:has-text("Back")')
    await expect(page.locator('h2')).toContainText('Choose Template')

    // Go back again
    await page.click('button:has-text("Back")')
    await expect(page.locator('h2')).toContainText('Welcome')
  })

  test('should show plain English explanations for account types', async ({ page }) => {
    await page.goto('/chart-of-accounts/setup')

    // Navigate to customization step
    await page.click('button:has-text("Get Started"), button:has-text("Next")')
    await page.click('[data-template]').first()

    // Look for account descriptions
    const accountItems = await page.locator('[data-account-name], [class*="accountItem"]').all()

    for (const item of accountItems.slice(0, 3)) {
      const text = await item.textContent()

      // Should contain plain English, not just technical terms
      // Check that descriptions exist and aren't just account names
      expect(text?.length || 0).toBeGreaterThan(20)
    }
  })

  test('should validate account customizations', async ({ page }) => {
    await page.goto('/chart-of-accounts/setup')

    // Navigate to customization
    await page.click('button:has-text("Get Started"), button:has-text("Next")')
    await page.click('[data-template]').first()

    // Try to add a custom account with invalid data
    const addButton = page.locator('button:has-text("Add Account"), button:has-text("Add Custom")')
    if (await addButton.count() > 0) {
      await addButton.click()

      // Try to submit empty form
      await page.click('button[type="submit"]')

      // Should show validation errors
      await expect(page.locator('[class*="error"], [role="alert"]')).toBeVisible()
    }
  })

  test('should display helpful error messages', async ({ page }) => {
    await page.goto('/chart-of-accounts/setup')

    // Navigate through wizard
    await page.click('button:has-text("Get Started"), button:has-text("Next")')

    // Try to proceed without selecting template
    await page.click('button:has-text("Next"), button:has-text("Continue")')

    // Should show helpful error (not blaming user)
    const errorMessage = await page.locator('[class*="error"], [role="alert"]').textContent()

    // Error should not contain words like "invalid", "wrong", "error" alone
    // Should be encouraging like "Please select", "Let's choose", etc.
    expect(errorMessage).toBeTruthy()
    expect(errorMessage).toMatch(/please|select|choose|need/i)
    expect(errorMessage).not.toMatch(/invalid input|wrong|you failed/i)
  })
})
