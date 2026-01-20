/**
 * Cash Flow Report E2E Tests
 *
 * End-to-end tests for complete cash flow report workflow
 */

import { test, expect } from '@playwright/test'

test.describe('Cash Flow Report', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to reports page
    await page.goto('/reports')
  })

  test('should generate cash flow report', async ({ page }) => {
    // Click on Cash Flow Report
    await page.click('text=Cash Flow')

    // Select date range
    await page.selectOption('[name="dateRange"]', 'this-month')

    // Click Generate Report
    await page.click('button:has-text("Generate Report")')

    // Verify report sections are visible
    await expect(page.locator('text=Cash from Operating Activities')).toBeVisible()
    await expect(page.locator('text=Cash from Investing Activities')).toBeVisible()
    await expect(page.locator('text=Cash from Financing Activities')).toBeVisible()
  })

  test('should toggle educational explanations', async ({ page }) => {
    await page.click('text=Cash Flow')
    await page.click('button:has-text("Generate Report")')

    // Initially explanations should be hidden
    await expect(page.locator('.educational-content')).not.toBeVisible()

    // Click to show explanations
    await page.click('button:has-text("What does this mean?")')

    // Explanations should now be visible
    await expect(page.locator('.educational-content')).toBeVisible()
  })

  test('should export to PDF', async ({ page }) => {
    await page.click('text=Cash Flow')
    await page.click('button:has-text("Generate Report")')

    // Set up download listener
    const downloadPromise = page.waitForEvent('download')

    // Click export to PDF
    await page.click('button:has-text("Export to PDF")')

    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('CashFlow')
    expect(download.suggestedFilename()).toContain('.pdf')
  })

  test('should export to CSV', async ({ page }) => {
    await page.click('text=Cash Flow')
    await page.click('button:has-text("Generate Report")')

    // Set up download listener
    const downloadPromise = page.waitForEvent('download')

    // Click export to CSV
    await page.click('button:has-text("Export to CSV")')

    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('CashFlow')
    expect(download.suggestedFilename()).toContain('.csv')
  })

  test('should display cash flow with color coding', async ({ page }) => {
    await page.click('text=Cash Flow')
    await page.click('button:has-text("Generate Report")')

    // Check for positive/negative indicators
    const inflows = page.locator('.line-item.inflow')
    const outflows = page.locator('.line-item.outflow')

    // At least one of these should be visible
    const inflowCount = await inflows.count()
    const outflowCount = await outflows.count()

    expect(inflowCount + outflowCount).toBeGreaterThan(0)
  })

  test('should show summary message', async ({ page }) => {
    await page.click('text=Cash Flow')
    await page.click('button:has-text("Generate Report")')

    // Summary message should be visible
    await expect(page.locator('.summary-message')).toBeVisible()

    // Message should contain helpful information
    const messageText = await page.locator('.summary-message').textContent()
    expect(messageText).toMatch(/(brought in|spent|stayed)/)
  })

  test('should filter by date range', async ({ page }) => {
    await page.click('text=Cash Flow')

    // Select different date ranges
    await page.selectOption('[name="dateRange"]', 'last-month')
    await page.click('button:has-text("Generate Report")')

    // Verify report header shows correct date range
    await expect(page.locator('.report-subtitle')).toContainText('2024')
  })

  test('should show comparison period', async ({ page }) => {
    await page.click('text=Cash Flow')

    // Enable comparison
    await page.check('[name="enableComparison"]')
    await page.selectOption('[name="comparisonType"]', 'previous-period')

    await page.click('button:has-text("Generate Report")')

    // Verify comparison columns are visible
    await expect(page.locator('.comparison-row')).toBeVisible()
  })
})

test.describe('Cash Flow Report Performance', () => {
  test('should generate report in under 5 seconds', async ({ page }) => {
    await page.goto('/reports')
    await page.click('text=Cash Flow')

    const startTime = Date.now()

    await page.click('button:has-text("Generate Report")')

    // Wait for report to be visible
    await expect(page.locator('text=Cash from Operating Activities')).toBeVisible()

    const endTime = Date.now()
    const duration = endTime - startTime

    expect(duration).toBeLessThan(5000) // 5 second requirement
  })
})

test.describe('Cash Flow Report Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/reports/cash-flow')

    // Tab through interactive elements
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Should be able to activate buttons with Enter
    await page.keyboard.press('Enter')

    // Report should be generated
    await expect(page.locator('.cash-flow-report')).toBeVisible()
  })

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/reports/cash-flow')
    await page.click('button:has-text("Generate Report")')

    // Check for flow indicators with aria-label
    const flowIndicators = page.locator('[aria-label="Inflow"], [aria-label="Outflow"]')
    expect(await flowIndicators.count()).toBeGreaterThan(0)
  })
})
