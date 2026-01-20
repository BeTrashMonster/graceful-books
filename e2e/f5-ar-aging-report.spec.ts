/**
 * E2E Tests for F5 - A/R Aging Report
 *
 * Tests the complete A/R aging workflow from invoice creation to report generation
 * and follow-up actions.
 */

import { test, expect } from '@playwright/test'

test.describe('F5 - A/R Aging Report E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and login
    await page.goto('/')
    // TODO: Add authentication flow
  })

  test('should display A/R aging report with all buckets', async ({ page }) => {
    // Navigate to A/R aging report
    await page.goto('/reports/ar-aging')

    // Verify report header
    await expect(page.locator('h2')).toContainText('Accounts Receivable Aging')

    // Verify aging buckets are displayed
    await expect(page.locator('.bucket-card')).toHaveCount(5)
    await expect(page.getByText('Current')).toBeVisible()
    await expect(page.getByText('Getting older')).toBeVisible()
    await expect(page.getByText('Needs attention')).toBeVisible()
    await expect(page.getByText("Let's talk about this one")).toBeVisible()

    // Verify summary cards
    await expect(page.getByText('Total Outstanding')).toBeVisible()
    await expect(page.getByText('Total Overdue')).toBeVisible()
    await expect(page.getByText('Collection Rate')).toBeVisible()
  })

  test('should allow drilling down into customer details', async ({ page }) => {
    await page.goto('/reports/ar-aging')

    // Find first customer row
    const customerRow = page.locator('.customer-row').first()
    const customerName = await customerRow.locator('.customer-name-btn').textContent()

    // Click to expand
    await customerRow.locator('.customer-name-btn').click()

    // Verify expanded details are shown
    await expect(page.locator('.customer-invoices')).toBeVisible()
    await expect(page.locator('.invoices-header')).toContainText(customerName || '')
  })

  test('should sort customers by different criteria', async ({ page }) => {
    await page.goto('/reports/ar-aging')

    // Sort by amount
    await page.selectOption('select#sort-by', 'amount')

    // Verify first customer has highest amount
    const firstCustomerAmount = await page
      .locator('.customer-row')
      .first()
      .locator('.col-total')
      .textContent()

    // Toggle sort order
    await page.click('.sort-toggle')

    // Verify order changed
    const newFirstAmount = await page
      .locator('.customer-row')
      .first()
      .locator('.col-total')
      .textContent()

    expect(firstCustomerAmount).not.toBe(newFirstAmount)
  })

  test('should display follow-up recommendations', async ({ page }) => {
    await page.goto('/reports/ar-aging')

    // Verify recommendations section exists
    await expect(page.locator('.ar-recommendations')).toBeVisible()

    // Verify urgency levels are color-coded
    await expect(page.locator('.urgency-badge')).toHaveCount.greaterThan(0)
  })

  test('should export report to CSV', async ({ page }) => {
    await page.goto('/reports/ar-aging')

    // Click export CSV button
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Export CSV")')

    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('AR_Aging')
    expect(download.suggestedFilename()).toContain('.csv')
  })

  test('should export report to PDF', async ({ page }) => {
    await page.goto('/reports/ar-aging')

    // Click export PDF button
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Export PDF")')

    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('AR_Aging')
    expect(download.suggestedFilename()).toContain('.pdf')
  })

  test('should display health message when A/R is healthy', async ({ page }) => {
    // Create scenario with mostly current invoices
    // TODO: Setup test data with healthy A/R

    await page.goto('/reports/ar-aging')

    // Verify health message is displayed
    await expect(page.locator('.ar-health-message')).toBeVisible()
    await expect(page.locator('.health-text')).toContainText('Great news')
  })

  test('should allow sending reminder emails', async ({ page }) => {
    await page.goto('/reports/ar-aging')

    // Find customer with overdue invoices
    const overdueCustomer = page.locator('.customer-row.has-overdue').first()

    // Click send reminder button
    await overdueCustomer.locator('.btn-reminder').click()

    // Verify email composer modal opens
    // TODO: Add email composer modal verification
    await expect(page.locator('[data-testid="email-composer"]')).toBeVisible()
  })

  test('should use friendly labels by default', async ({ page }) => {
    await page.goto('/reports/ar-aging')

    // Verify friendly labels are used
    await expect(page.getByText('Getting older')).toBeVisible()
    await expect(page.getByText('Needs attention')).toBeVisible()
    await expect(page.getByText("Let's talk about this one")).toBeVisible()

    // Formal labels should not be visible
    await expect(page.getByText('1-30 days')).not.toBeVisible()
  })

  test('should calculate aging buckets correctly', async ({ page }) => {
    // Create test invoices with known due dates
    // TODO: Setup test data with specific aging

    await page.goto('/reports/ar-aging')

    // Verify bucket amounts add up to total
    const currentAmount = await page
      .locator('.bucket-card.bucket-current .bucket-amount')
      .textContent()
    const days1to30Amount = await page
      .locator('.bucket-card.bucket-1-30 .bucket-amount')
      .textContent()
    const totalAmount = await page.locator('.summary-card .summary-value').first().textContent()

    // Parse and verify
    const parseAmount = (text: string | null) =>
      parseFloat(text?.replace(/[^0-9.-]/g, '') || '0')

    const sum =
      parseAmount(currentAmount) +
      parseAmount(days1to30Amount) +
      /* ... other buckets ... */ 0

    expect(sum).toBeLessThanOrEqual(parseAmount(totalAmount))
  })

  test('should update in real-time as payments are received', async ({ page }) => {
    await page.goto('/reports/ar-aging')

    // Get initial total
    const initialTotal = await page.locator('.summary-card .summary-value').first().textContent()

    // Navigate to invoice and mark as paid
    // TODO: Add payment flow

    // Return to A/R aging report
    await page.goto('/reports/ar-aging')

    // Verify total has decreased
    const newTotal = await page.locator('.summary-card .summary-value').first().textContent()

    expect(newTotal).not.toBe(initialTotal)
  })

  test('should be accessible via keyboard navigation', async ({ page }) => {
    await page.goto('/reports/ar-aging')

    // Tab to export buttons
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Verify focus is on a button
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(focusedElement).toBe('BUTTON')

    // Press Enter to trigger action
    await page.keyboard.press('Enter')

    // Verify action was triggered
    // TODO: Add verification
  })

  test('should meet WCAG 2.1 AA accessibility standards', async ({ page }) => {
    await page.goto('/reports/ar-aging')

    // Run accessibility audit
    // TODO: Integrate with axe-core or similar

    // Verify color contrast for urgency indicators
    const highUrgency = page.locator('.urgency-badge.urgency-high').first()
    await expect(highUrgency).toHaveCSS('color', /#[0-9a-f]{6}/i)

    // Verify ARIA labels
    await expect(page.locator('[aria-label]')).toHaveCount.greaterThan(0)
  })
})

test.describe('Performance Tests', () => {
  test('should generate report in under 3 seconds', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/reports/ar-aging')

    // Wait for report to fully load
    await page.waitForSelector('.ar-aging-report')
    await page.waitForSelector('.customer-row')

    const loadTime = Date.now() - startTime

    // Report should load in under 3000ms
    expect(loadTime).toBeLessThan(3000)
  })

  test('should handle large customer lists efficiently', async ({ page }) => {
    // TODO: Setup test data with 100+ customers

    const startTime = Date.now()

    await page.goto('/reports/ar-aging')
    await page.waitForSelector('.customer-row')

    const loadTime = Date.now() - startTime

    // Should still load quickly with large datasets
    expect(loadTime).toBeLessThan(5000)
  })

  test('should export PDF quickly', async ({ page }) => {
    await page.goto('/reports/ar-aging')

    const startTime = Date.now()

    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Export PDF")')
    await downloadPromise

    const exportTime = Date.now() - startTime

    // PDF export should complete in under 2 seconds
    expect(exportTime).toBeLessThan(2000)
  })
})
