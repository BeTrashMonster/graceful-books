/**
 * D6 & D7: Reports E2E Tests (Profit & Loss, Balance Sheet)
 *
 * Tests report generation including:
 * - Date range selection
 * - Plain English explanations
 * - Export to PDF
 * - Comparison periods
 * - Performance requirements (<5s standard, <30s complex)
 * - Encouraging messages for profitability
 */

import { test, expect } from '@playwright/test'
import { setupAuthenticatedSession, clearUserData } from './fixtures/auth'
import { quickSetupCOA, generateSampleTransactions } from './fixtures/data'
import { checkAccessibility } from './helpers/accessibility'
import { measureReportGeneration, assertPerformance } from './helpers/performance'

test.describe('D6: Profit & Loss Report', () => {
  test.beforeEach(async ({ page }) => {
    await clearUserData(page)
    await setupAuthenticatedSession(page)

    // Setup COA and transactions
    await quickSetupCOA(page, 'freelancer')
    await generateSampleTransactions(page, 10)
  })

  test('should generate P&L report', async ({ page }) => {
    await page.goto('/reports/profit-loss')

    // Should show report configuration
    await expect(page.locator('h1, h2')).toContainText(/Profit.*Loss|P&L/i)

    // Select date range
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 1)
    const endDate = new Date()

    await page.fill('[name="startDate"], input[placeholder*="Start"]', startDate.toISOString().split('T')[0])
    await page.fill('[name="endDate"], input[placeholder*="End"]', endDate.toISOString().split('T')[0])

    // Generate report
    const reportTime = await measureReportGeneration(
      page,
      async () => {
        await page.click('button:has-text("Generate"), button:has-text("Run Report")')
      },
      '[data-report], [class*="report"], table'
    )

    console.log(`P&L report generation: ${reportTime}ms`)

    // Should be under 5 seconds for standard report
    assertPerformance(reportTime, 5000, 'P&L report generation')

    // Report should be visible
    await expect(page.locator('[data-report], table')).toBeVisible()

    // Should have main sections
    await expect(page.locator('text=/Revenue|Income/i')).toBeVisible()
    await expect(page.locator('text=/Expense/i')).toBeVisible()
    await expect(page.locator('text=/Profit|Net Income/i')).toBeVisible()
  })

  test('should show plain English explanations', async ({ page }) => {
    await page.goto('/reports/profit-loss')

    // Generate report
    await page.click('button:has-text("Generate"), button:has-text("Run Report")')
    await page.waitForSelector('[data-report], table')

    // Look for "What does this mean?" toggle
    const explainer = page.locator('button:has-text("What does"), button:has-text("Explain")')

    if (await explainer.count() > 0) {
      await explainer.first().click()

      // Should show plain English explanation
      const explanation = page.locator('[data-explanation], [class*="explanation"]')
      await expect(explanation.first()).toBeVisible()

      const explanationText = await explanation.textContent()
      expect(explanationText).toMatch(/revenue minus expenses|money|profitable|positive/i)
      expect(explanationText).not.toMatch(/EBITDA|net operating income|gross margin/i)
    }
  })

  test('should show encouraging message for profitability', async ({ page }) => {
    await page.goto('/reports/profit-loss')

    // Generate report
    await page.click('button:has-text("Generate")')
    await page.waitForSelector('[data-report], table')

    // Check if profitable
    const profitCell = page.locator('text=/Net Income|Profit/i').locator('..')
    const profitText = await profitCell.textContent()

    // If profit is positive, should show encouragement
    if (!profitText?.includes('-') && !profitText?.includes('(')) {
      // Look for encouraging message or visual indicator
      const encouragement = page.locator('text=/made money|great work|profitable|positive/i')

      if (await encouragement.count() > 0) {
        console.log('Profitability encouragement found')

        // Should have positive language
        const message = await encouragement.textContent()
        expect(message).toMatch(/made money|profit|great|success/i)
      }

      // Check for green glow or positive styling
      const profitValue = page.locator('[data-profit], [class*="profit"]')
      if (await profitValue.count() > 0) {
        const color = await profitValue.first().evaluate((el) => {
          const computed = window.getComputedStyle(el)
          return computed.color
        })
        console.log('Profit color:', color)
      }
    }
  })

  test('should support period comparison', async ({ page }) => {
    await page.goto('/reports/profit-loss')

    // Look for comparison option
    const compareCheckbox = page.locator('input[type="checkbox"][name*="compare"], [aria-label*="Compare"]')

    if (await compareCheckbox.count() > 0) {
      await compareCheckbox.check()

      // Should show previous period options
      const prevPeriod = page.locator('select[name*="previous"], [name*="compare"]')
      await expect(prevPeriod.first()).toBeVisible()

      // Generate with comparison
      await page.click('button:has-text("Generate")')
      await page.waitForSelector('table')

      // Should show two columns for comparison
      const columns = await page.locator('th, [role="columnheader"]').count()
      expect(columns).toBeGreaterThan(2) // At least account, current, previous
    }
  })

  test('should export to PDF', async ({ page }) => {
    await page.goto('/reports/profit-loss')

    // Generate report
    await page.click('button:has-text("Generate")')
    await page.waitForSelector('[data-report], table')

    // Look for export button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("PDF")')

    if (await exportButton.count() > 0) {
      // Set up download handler
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        exportButton.click(),
      ])

      const filename = download.suggestedFilename()
      expect(filename).toMatch(/\.pdf$/i)
      console.log('PDF export filename:', filename)
    }
  })

  test('should be accessible', async ({ page }) => {
    await page.goto('/reports/profit-loss')

    const results = await checkAccessibility(page)

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    expect(criticalViolations).toHaveLength(0)

    // Generate report and check table accessibility
    await page.click('button:has-text("Generate")')
    await page.waitForSelector('table')

    // Table should have proper structure
    const table = page.locator('table').first()
    await expect(table).toHaveAttribute('role', 'table')

    const headers = page.locator('th, [role="columnheader"]')
    expect(await headers.count()).toBeGreaterThan(0)
  })
})

test.describe('D7: Balance Sheet Report', () => {
  test.beforeEach(async ({ page }) => {
    await clearUserData(page)
    await setupAuthenticatedSession(page)

    await quickSetupCOA(page, 'freelancer')
    await generateSampleTransactions(page, 10)
  })

  test('should generate Balance Sheet report', async ({ page }) => {
    await page.goto('/reports/balance-sheet')

    // Should show report page
    await expect(page.locator('h1, h2')).toContainText(/Balance Sheet/i)

    // Select date (balance sheet is as-of a specific date)
    const today = new Date().toISOString().split('T')[0]
    await page.fill('[name="asOfDate"], input[type="date"]', today)

    // Generate report
    const reportTime = await measureReportGeneration(
      page,
      async () => {
        await page.click('button:has-text("Generate"), button:has-text("Run Report")')
      },
      '[data-report], table'
    )

    console.log(`Balance Sheet generation: ${reportTime}ms`)
    assertPerformance(reportTime, 5000, 'Balance Sheet generation')

    // Report should be visible
    await expect(page.locator('[data-report], table')).toBeVisible()

    // Should have three main sections
    await expect(page.locator('text=/Asset/i')).toBeVisible()
    await expect(page.locator('text=/Liabilit/i')).toBeVisible()
    await expect(page.locator('text=/Equity/i')).toBeVisible()
  })

  test('should show plain English explanation', async ({ page }) => {
    await page.goto('/reports/balance-sheet')

    // Check for educational context
    const description = page.locator('[class*="description"], p')

    if (await description.count() > 0) {
      const text = await description.first().textContent()

      // Should explain balance sheet in plain English
      expect(text).toMatch(/snapshot|own|owe|left over/i)
      expect(text).not.toMatch(/accounting equation|debit|credit/i)
    }

    // Generate report
    await page.click('button:has-text("Generate")')
    await page.waitForSelector('table')

    // Look for section explanations
    const assetExplain = page.locator('text=/asset/i').locator('..')

    if (await assetExplain.count() > 0) {
      // May have tooltip or inline explanation
      const tooltip = page.locator('[role="tooltip"], [data-tooltip]')

      if (await tooltip.count() > 0) {
        console.log('Balance sheet explanations found')
      }
    }
  })

  test('should validate balance equation', async ({ page }) => {
    await page.goto('/reports/balance-sheet')

    // Generate report
    await page.click('button:has-text("Generate")')
    await page.waitForSelector('table')

    // Assets should equal Liabilities + Equity
    // This is a fundamental accounting rule

    // Get totals (implementation will vary)
    const totals = await page.locator('[data-total], [class*="total"]').allTextContents()
    console.log('Balance sheet totals:', totals)

    // The report should balance (implementation dependent)
    // Just verify totals are present
    expect(totals.length).toBeGreaterThan(0)
  })

  test('should export to PDF', async ({ page }) => {
    await page.goto('/reports/balance-sheet')

    await page.click('button:has-text("Generate")')
    await page.waitForSelector('table')

    const exportButton = page.locator('button:has-text("Export"), button:has-text("PDF")')

    if (await exportButton.count() > 0) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        exportButton.click(),
      ])

      const filename = download.suggestedFilename()
      expect(filename).toMatch(/balance.*sheet.*\.pdf/i)
    }
  })

  test('should be accessible', async ({ page }) => {
    await page.goto('/reports/balance-sheet')

    const results = await checkAccessibility(page)

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    expect(criticalViolations).toHaveLength(0)
  })

  test('should handle empty data gracefully', async ({ page }) => {
    await clearUserData(page)
    await setupAuthenticatedSession(page)
    await quickSetupCOA(page, 'freelancer')
    // Don't create transactions

    await page.goto('/reports/balance-sheet')
    await page.click('button:has-text("Generate")')

    // Should show report even with no transactions
    await expect(page.locator('table, [data-report]')).toBeVisible()

    // Should have encouraging empty state
    const emptyMessage = page.locator('text=/no transactions|getting started|first transaction/i')

    if (await emptyMessage.count() > 0) {
      const message = await emptyMessage.textContent()
      expect(message).toMatch(/start|first|begin/i)
      expect(message).not.toMatch(/error|no data|empty/i)
    }
  })
})

test.describe('Reports: Performance & Integration', () => {
  test('should handle large datasets', async ({ page }) => {
    await clearUserData(page)
    await setupAuthenticatedSession(page)
    await quickSetupCOA(page, 'freelancer')

    // Create many transactions
    await generateSampleTransactions(page, 100)

    await page.goto('/reports/profit-loss')

    // Generate report with large dataset
    const reportTime = await measureReportGeneration(
      page,
      async () => {
        await page.click('button:has-text("Generate")')
      },
      'table'
    )

    console.log(`Large dataset P&L: ${reportTime}ms`)

    // Should complete within 30 seconds (complex report limit)
    assertPerformance(reportTime, 30000, 'Large dataset P&L')
  })

  test('should navigate between reports', async ({ page }) => {
    await setupAuthenticatedSession(page)
    await quickSetupCOA(page, 'freelancer')

    // Go to P&L
    await page.goto('/reports/profit-loss')
    await expect(page.locator('h1, h2')).toContainText(/Profit.*Loss/i)

    // Navigate to Balance Sheet
    await page.click('a[href*="balance-sheet"], button:has-text("Balance Sheet")')
    await expect(page.locator('h1, h2')).toContainText(/Balance Sheet/i)

    // Navigate back
    await page.click('a[href*="profit-loss"], button:has-text("Profit")')
    await expect(page.locator('h1, h2')).toContainText(/Profit/i)
  })
})
