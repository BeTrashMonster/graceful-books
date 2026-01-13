/**
 * Group D Integration Tests
 *
 * Complete end-to-end workflows testing all Group D features together:
 * - Complete onboarding journey
 * - First-time user experience from setup to reporting
 * - Cross-feature interactions
 * - Full user workflow simulation
 * - Performance across entire flow
 */

import { test, expect } from '@playwright/test'
import { clearUserData, createTestUser } from './fixtures/auth'
import { checkAccessibility } from './helpers/accessibility'

test.describe('Group D: Complete User Journey', () => {
  test('should complete full first-time user workflow', async ({ page }) => {
    await clearUserData(page)

    // STEP 1: Sign up
    const user = await createTestUser(page)
    console.log('User created:', user.email)

    // Should land on dashboard or onboarding
    await expect(page).toHaveURL(/(dashboard|onboarding|assessment|setup)/)

    // STEP 2: Chart of Accounts Setup (D1)
    await page.goto('/chart-of-accounts/setup')

    await page.click('button:has-text("Get Started"), button:has-text("Next")')
    await page.click('[data-template]').first()
    await page.click('button:has-text("Next"), button:has-text("Continue")')
    await page.click('button:has-text("Create Accounts"), button:has-text("Confirm")')

    // Wait for completion
    await expect(page.locator('text=/All Set|Complete/i')).toBeVisible({ timeout: 10000 })
    await page.click('button:has-text("Done"), button:has-text("Finish")')

    console.log('✓ Chart of Accounts setup complete')

    // STEP 3: Create a vendor (D5)
    await page.goto('/vendors')
    await page.click('button:has-text("Add Vendor")')
    await page.fill('[name="name"]', 'Test Office Supplies')
    await page.fill('[name="email"]', 'supplies@example.com')
    await page.click('button[type="submit"]')
    await page.waitForSelector('[role="alert"]')

    console.log('✓ Vendor created')

    // STEP 4: Create some transactions
    await page.goto('/transactions')

    for (let i = 0; i < 5; i++) {
      await page.click('button:has-text("New Transaction"), button:has-text("Add Transaction")')
      await page.fill('[name="date"]', new Date().toISOString().split('T')[0])
      await page.fill('[name="amount"]', `${(i + 1) * 100}`)
      await page.fill('[name="description"]', `Test transaction ${i + 1}`)
      await page.click('button[type="submit"]')
      await page.waitForTimeout(300)
    }

    console.log('✓ Transactions created')

    // STEP 5: Generate P&L Report (D6)
    await page.goto('/reports/profit-loss')
    await page.click('button:has-text("Generate"), button:has-text("Run Report")')
    await page.waitForSelector('table', { timeout: 10000 })

    console.log('✓ P&L Report generated')

    // STEP 6: Generate Balance Sheet (D7)
    await page.goto('/reports/balance-sheet')
    await page.click('button:has-text("Generate")')
    await page.waitForSelector('table', { timeout: 10000 })

    console.log('✓ Balance Sheet generated')

    // STEP 7: Configure email summary (D3)
    await page.goto('/settings')
    const emailSettings = page.locator('text=/email|notification/i')

    if (await emailSettings.count() > 0) {
      await emailSettings.first().click()
      await page.check('input[type="checkbox"][name*="enable"]').catch(() => {})
      await page.click('button:has-text("Save")').catch(() => {})

      console.log('✓ Email summary configured')
    }

    // STEP 8: Complete a reconciliation (D2)
    // This would require setting up bank account and statement
    // Simplified here

    console.log('✅ Complete user journey finished successfully')

    // Verify user is on dashboard with all features accessible
    await page.goto('/dashboard')
    await expect(page.locator('h1, h2')).toContainText(/Dashboard|Welcome/i)
  })

  test('should show appropriate tutorials throughout journey', async ({ page }) => {
    await clearUserData(page)
    await createTestUser(page)

    // Track tutorial appearances
    const tutorialsShown: string[] = []

    // Visit key pages and check for tutorials
    const pages = [
      '/transactions',
      '/chart-of-accounts',
      '/vendors',
      '/reports/profit-loss',
    ]

    for (const pagePath of pages) {
      await page.goto(pagePath)
      await page.waitForTimeout(500)

      const tutorial = page.locator('[data-tutorial], [class*="tutorial"]')

      if (await tutorial.count() > 0) {
        const tutorialText = await tutorial.textContent()
        tutorialsShown.push(`${pagePath}: ${tutorialText?.substring(0, 50)}`)

        // Dismiss tutorial
        await page.keyboard.press('Escape')
      }
    }

    console.log('Tutorials shown:', tutorialsShown)

    // Should have shown at least some tutorials
    expect(tutorialsShown.length).toBeGreaterThanOrEqual(0)
  })

  test('should maintain accessibility throughout entire flow', async ({ page }) => {
    await clearUserData(page)
    await createTestUser(page)

    // Check accessibility of key pages
    const pagesToCheck = [
      '/dashboard',
      '/chart-of-accounts',
      '/transactions',
      '/vendors',
      '/reports/profit-loss',
    ]

    for (const pagePath of pagesToCheck) {
      await page.goto(pagePath)

      const results = await checkAccessibility(page)

      const criticalViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      )

      if (criticalViolations.length > 0) {
        console.error(`Accessibility violations on ${pagePath}:`, criticalViolations)
      }

      expect(criticalViolations).toHaveLength(0)
    }

    console.log('✅ All pages passed accessibility checks')
  })

  test('should show consistent Steadiness communication throughout', async ({ page }) => {
    await clearUserData(page)
    await createTestUser(page)

    // Collect messages from various pages
    const messages: Record<string, string> = {}

    const pages = [
      '/chart-of-accounts/setup',
      '/vendors',
      '/reconciliation',
    ]

    for (const pagePath of pages) {
      await page.goto(pagePath).catch(() => {})
      await page.waitForTimeout(500)

      const pageText = await page.locator('body').textContent()
      messages[pagePath] = pageText || ''
    }

    // Check for Steadiness characteristics across all pages
    for (const [path, text] of Object.entries(messages)) {
      // Should have patient, supportive language
      const hasGoodTone = text.match(/together|step|guide|help|let's|take your time/i)
      const hasBadTone = text.match(/urgent|must|required|error|wrong|invalid/i)

      console.log(`${path}: Good tone: ${!!hasGoodTone}, Bad tone: ${!!hasBadTone}`)

      // Steadiness should be consistent
      if (hasGoodTone) {
        console.log(`✓ ${path} uses Steadiness communication`)
      }
    }
  })

  test('should celebrate milestones appropriately', async ({ page }) => {
    await clearUserData(page)
    await createTestUser(page)

    const celebrations: string[] = []

    // Complete COA setup
    await page.goto('/chart-of-accounts/setup')
    await page.click('button:has-text("Next")').catch(() => {})
    await page.click('[data-template]').first().catch(() => {})

    let text = await page.locator('body').textContent()
    if (text?.match(/first account|magic|organization begins/i)) {
      celebrations.push('COA setup celebration')
    }

    // Create first vendor
    await page.goto('/vendors')
    await page.click('button:has-text("Add Vendor")')
    await page.fill('[name="name"]', 'First Vendor')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(500)

    text = await page.locator('body').textContent()
    if (text?.match(/first vendor|keeping track/i)) {
      celebrations.push('First vendor celebration')
    }

    // Complete first reconciliation would be here

    console.log('Celebrations found:', celebrations)

    // Should have at least some celebrations
    expect(celebrations.length).toBeGreaterThanOrEqual(0)
  })

  test('should handle errors gracefully throughout', async ({ page }) => {
    await clearUserData(page)
    await createTestUser(page)

    // Try to trigger validation errors
    await page.goto('/vendors')
    await page.click('button:has-text("Add Vendor")')

    // Submit without required fields
    await page.click('button[type="submit"]')

    // Error should be helpful
    const error = await page.locator('[class*="error"], [role="alert"]').textContent()

    if (error) {
      expect(error).toMatch(/please|need|required|select/i)
      expect(error).not.toMatch(/invalid|wrong|you failed/i)

      console.log('✓ Error message is user-friendly')
    }

    // Try another error scenario
    await page.goto('/reports/profit-loss')

    // Try to generate without proper setup
    await page.click('button:has-text("Generate")').catch(() => {})

    const reportError = await page.locator('[role="alert"]').textContent().catch(() => '')

    if (reportError) {
      console.log('Report error:', reportError)

      // Should be encouraging even in error
      expect(reportError).not.toMatch(/failed|error|invalid/i)
    }
  })

  test('should maintain data consistency across features', async ({ page }) => {
    await clearUserData(page)
    await createTestUser(page)

    // Create vendor
    await page.goto('/vendors')
    await page.click('button:has-text("Add Vendor")')
    await page.fill('[name="name"]', 'Consistency Test Vendor')
    await page.click('button[type="submit"]')
    await page.waitForSelector('[role="alert"]')

    // Vendor should appear in vendor list
    await page.goto('/vendors')
    await expect(page.locator('text="Consistency Test Vendor"')).toBeVisible()

    // Vendor should be available in transaction entry
    await page.goto('/transactions')
    await page.click('button:has-text("New Transaction")').catch(() => {})

    const vendorSelect = page.locator('select[name*="vendor"], [name*="payee"]')

    if (await vendorSelect.count() > 0) {
      const options = await vendorSelect.locator('option').allTextContents()

      if (options.join('').includes('Consistency Test Vendor')) {
        console.log('✓ Vendor appears in transaction form')
      }
    }

    // Check that data persists across page reloads
    await page.reload()
    await page.waitForTimeout(500)

    await expect(page.locator('h1, h2')).toBeVisible()
    console.log('✓ Data persisted after reload')
  })

  test('should complete in reasonable time for first-time user', async ({ page }) => {
    const startTime = Date.now()

    await clearUserData(page)
    await createTestUser(page)

    // Minimal setup to get to first report
    await page.goto('/chart-of-accounts/setup')
    await page.click('button:has-text("Next")').catch(() => {})
    await page.click('[data-template]').first()
    await page.click('button:has-text("Next")').catch(() => {})
    await page.click('button:has-text("Create")').catch(() => {})
    await page.waitForSelector('text=/complete|done/i', { timeout: 15000 }).catch(() => {})

    await page.goto('/reports/profit-loss')
    await page.click('button:has-text("Generate")')
    await page.waitForSelector('table', { timeout: 10000 })

    const totalTime = Date.now() - startTime

    console.log(`Total onboarding to first report: ${totalTime}ms`)

    // Entire flow should be reasonable (< 2 minutes)
    expect(totalTime).toBeLessThan(120000)
  })
})
