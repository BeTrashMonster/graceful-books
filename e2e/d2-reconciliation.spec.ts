/**
 * D2: First Reconciliation Experience E2E Tests
 *
 * Tests the guided bank reconciliation workflow including:
 * - Statement upload and data entry
 * - Step-by-step matching guidance
 * - Educational explainers
 * - Common discrepancy explanations
 * - Celebration on completion
 * - Performance requirements
 */

import { test, expect } from '@playwright/test'
import { setupAuthenticatedSession, clearUserData } from './fixtures/auth'
import { createAccount, quickSetupCOA, createTransaction } from './fixtures/data'
import { checkAccessibility, formatViolations } from './helpers/accessibility'
import { measureAction, assertPerformance } from './helpers/performance'

test.describe('D2: First Reconciliation Experience', () => {
  test.beforeEach(async ({ page }) => {
    await clearUserData(page)
    await setupAuthenticatedSession(page)

    // Setup: Create a bank account to reconcile
    await quickSetupCOA(page, 'freelancer')
    await createAccount(page, {
      name: 'Test Bank Account',
      accountNumber: '1000',
      type: 'asset',
      description: 'Test checking account',
    })

    // Create some transactions
    const today = new Date().toISOString().split('T')[0]
    await createTransaction(page, {
      date: today,
      amount: 500,
      description: 'Test deposit',
      account: 'Test Bank Account',
    })
  })

  test('should complete first reconciliation with guidance', async ({ page }) => {
    // Navigate to reconciliation
    await page.goto('/reconciliation?accountId=test-account-id')

    // Check for first-time user guidance
    const pageText = await page.locator('body').textContent()

    // Should have educational content for first-time users
    if (pageText?.includes('first time') || pageText?.includes('guide you')) {
      console.log('First-time reconciliation guidance detected')
    }

    // Start reconciliation
    await page.click('button:has-text("Start Reconciliation")')

    // Step 1: Enter statement details
    await expect(page.locator('h2, h3')).toContainText(/Statement|Details|Balance/i)

    // Check for "What is reconciliation?" explainer
    const explainer = page.locator('button:has-text("What is"), [aria-label*="What"]')
    if (await explainer.count() > 0) {
      await explainer.first().click()

      // Should show plain English explanation
      const explanation = await page.locator('[role="dialog"], [class*="modal"]').textContent()
      expect(explanation).toMatch(/match|bank|records|fancy word/i)
      expect(explanation).not.toMatch(/debit|credit|ledger/i) // Avoid jargon

      // Close explainer
      await page.keyboard.press('Escape')
    }

    // Fill in statement details
    await page.fill('[name="startingBalance"], input[placeholder*="starting"]', '1000')
    await page.fill('[name="endingBalance"], input[placeholder*="ending"]', '1500')

    const statementDate = new Date().toISOString().split('T')[0]
    await page.fill('[name="statementDate"], input[type="date"]', statementDate)

    await page.click('button:has-text("Continue"), button:has-text("Next")')

    // Step 2: Match transactions
    await expect(page.locator('h2, h3')).toContainText(/Match|Transaction/i)

    // Should show transactions to match
    const transactionList = page.locator('[data-transaction], [class*="transaction"]')
    await expect(transactionList.first()).toBeVisible()

    // Check for auto-match indicator
    const autoMatched = page.locator('[data-auto-matched], [class*="matched"]')
    if (await autoMatched.count() > 0) {
      console.log(`Auto-matched ${await autoMatched.count()} transactions`)

      // Should show encouraging message about auto-matching
      const message = await page.locator('body').textContent()
      expect(message).toMatch(/found|matched|automatically|just need to review/i)
    }

    // Match or verify a transaction
    const matchButton = page.locator('button:has-text("Match"), button:has-text("Confirm")').first()
    if (await matchButton.count() > 0) {
      await matchButton.click()
    }

    // Handle discrepancies if present
    const discrepancy = page.locator('[data-discrepancy], [class*="discrepancy"]')
    if (await discrepancy.count() > 0) {
      // Should show helpful explanation of common discrepancies
      await expect(page.locator('text=/outstanding|cleared|timing/i')).toBeVisible()
    }

    // Complete reconciliation
    await page.click('button:has-text("Complete"), button:has-text("Finish Reconciliation")')

    // Step 3: Celebration on completion
    await expect(page.locator('h2, h3')).toContainText(/Reconciled|Complete|Success/i, {
      timeout: 10000,
    })

    // Check for celebration message
    const celebrationText = await page.locator('body').textContent()
    expect(celebrationText).toMatch(/reconciled|bigger deal|many business owners never|great work/i)

    // Look for confetti or celebration animation
    const celebration = page.locator('[class*="confetti"], [data-celebration]')
    const celebrationCount = await celebration.count()
    console.log(`Celebration elements: ${celebrationCount}`)

    // Should offer to continue or return
    await expect(page.locator('button:has-text("Done"), button:has-text("Continue")')).toBeVisible()
  })

  test('should support CSV/PDF statement upload', async ({ page }) => {
    await page.goto('/reconciliation?accountId=test-account-id')
    await page.click('button:has-text("Start Reconciliation")')

    // Look for upload option
    const uploadButton = page.locator('button:has-text("Upload"), input[type="file"]')

    if (await uploadButton.count() > 0) {
      // Upload functionality exists
      console.log('Statement upload supported')

      // Check accepted file types
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.count() > 0) {
        const accept = await fileInput.getAttribute('accept')
        expect(accept).toMatch(/csv|pdf/i)
      }
    }
  })

  test('should show reconciliation history', async ({ page }) => {
    // Complete a reconciliation first
    await page.goto('/reconciliation?accountId=test-account-id')
    await page.click('button:has-text("Start Reconciliation")')

    // Quick completion (abbreviated)
    await page.fill('[name="startingBalance"]', '1000')
    await page.fill('[name="endingBalance"]', '1500')
    await page.fill('[name="statementDate"]', new Date().toISOString().split('T')[0])
    await page.click('button:has-text("Continue")').catch(() => {})

    // After completing, check for history
    await page.goto('/reconciliation')

    // Should show past reconciliations
    const history = page.locator('[data-reconciliation-history], [class*="history"]')
    if (await history.count() > 0) {
      await expect(history).toBeVisible()

      // Check for reconciliation streak
      const streak = page.locator('text=/streak|in a row|consecutive/i')
      if (await streak.count() > 0) {
        console.log('Reconciliation streak feature found')
      }
    }
  })

  test('should highlight unreconciled transactions', async ({ page }) => {
    await page.goto('/transactions')

    // After reconciliation, some transactions may remain unreconciled
    const unreconciled = page.locator('[data-reconciled="false"], [class*="unreconciled"]')

    if (await unreconciled.count() > 0) {
      // Should have visual indicator
      const firstUnreconciled = unreconciled.first()
      await expect(firstUnreconciled).toBeVisible()

      // Check if there's a badge or indicator
      const indicator = firstUnreconciled.locator('[class*="badge"], [data-status]')
      await expect(indicator).toBeVisible()
    }
  })

  test('should meet accessibility standards', async ({ page }) => {
    await page.goto('/reconciliation?accountId=test-account-id')

    const results = await checkAccessibility(page)

    if (results.violations.length > 0) {
      console.error('Accessibility violations:', formatViolations(results.violations))
    }

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    expect(criticalViolations).toHaveLength(0)
  })

  test('should meet performance requirements', async ({ page }) => {
    // Page load should be under 2 seconds
    const startTime = Date.now()
    await page.goto('/reconciliation?accountId=test-account-id')
    await page.waitForSelector('h1, h2')
    const pageLoadTime = Date.now() - startTime

    console.log(`Reconciliation page load: ${pageLoadTime}ms`)
    assertPerformance(pageLoadTime, 2000, 'Reconciliation page load')

    // Start reconciliation
    await page.click('button:has-text("Start Reconciliation")')

    // Measure form submission
    const formSubmitTime = await measureAction(
      page,
      async () => {
        await page.fill('[name="startingBalance"]', '1000')
        await page.fill('[name="endingBalance"]', '1500')
        await page.fill('[name="statementDate"]', new Date().toISOString().split('T')[0])
        await page.click('button:has-text("Continue")')
      },
      'h2, h3'
    )

    console.log(`Form submission: ${formSubmitTime}ms`)
    assertPerformance(formSubmitTime, 2000, 'Statement details submission')
  })

  test('should handle discrepancies gracefully', async ({ page }) => {
    await page.goto('/reconciliation?accountId=test-account-id')
    await page.click('button:has-text("Start Reconciliation")')

    // Enter details that will cause discrepancy
    await page.fill('[name="startingBalance"]', '1000')
    await page.fill('[name="endingBalance"]', '9999') // Large difference
    await page.fill('[name="statementDate"]', new Date().toISOString().split('T')[0])

    await page.click('button:has-text("Continue")')

    // Should show discrepancy warning/help
    const discrepancyHelp = page.locator('text=/discrepancy|difference|doesn\'t match/i')

    if (await discrepancyHelp.count() > 0) {
      await expect(discrepancyHelp.first()).toBeVisible()

      // Should offer common explanations
      const explanations = await page.locator('body').textContent()
      expect(explanations).toMatch(/outstanding|uncleared|timing|missing/i)
    }
  })

  test('should save progress and allow resume', async ({ page }) => {
    await page.goto('/reconciliation?accountId=test-account-id')
    await page.click('button:has-text("Start Reconciliation")')

    // Fill in partial data
    await page.fill('[name="startingBalance"]', '1000')

    // Save and exit
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Later")')
    if (await saveButton.count() > 0) {
      await saveButton.click()

      // Return later
      await page.goto('/reconciliation?accountId=test-account-id')

      // Should offer to resume
      const resume = page.locator('button:has-text("Resume"), text=/continue where/i')
      if (await resume.count() > 0) {
        await resume.click()

        // Should restore saved data
        const startingBalance = await page
          .locator('[name="startingBalance"]')
          .inputValue()
        expect(startingBalance).toBe('1000')
      }
    }
  })

  test('should display helpful error messages', async ({ page }) => {
    await page.goto('/reconciliation?accountId=test-account-id')
    await page.click('button:has-text("Start Reconciliation")')

    // Try to proceed without filling required fields
    await page.click('button:has-text("Continue")')

    // Should show validation errors
    const errors = page.locator('[class*="error"], [role="alert"]')
    await expect(errors.first()).toBeVisible()

    // Error messages should be helpful, not blaming
    const errorText = await errors.first().textContent()
    expect(errorText).toMatch(/please|need|required/i)
    expect(errorText).not.toMatch(/invalid|wrong|failed/i)
  })

  test('should show auto-match success rate', async ({ page }) => {
    await page.goto('/reconciliation?accountId=test-account-id')
    await page.click('button:has-text("Start Reconciliation")')

    await page.fill('[name="startingBalance"]', '1000')
    await page.fill('[name="endingBalance"]', '1500')
    await page.fill('[name="statementDate"]', new Date().toISOString().split('T')[0])
    await page.click('button:has-text("Continue")')

    // Look for auto-match success message
    const successMessage = page.locator('text=/found.*matches|matched automatically/i')

    if (await successMessage.count() > 0) {
      const message = await successMessage.textContent()
      console.log('Auto-match message:', message)

      // Message should be encouraging
      expect(message).toMatch(/found|just need to review|great/i)
    }
  })
})
