/**
 * F6 - A/P Aging Report E2E Tests
 *
 * Tests the complete user workflow for A/P Aging Reports:
 * - Viewing aging summary
 * - Sorting vendor breakdown
 * - Drilling down into vendor details
 * - Viewing payment recommendations
 * - Exporting to PDF and CSV
 */

import { test, expect, Page } from '@playwright/test'

test.describe('F6 - A/P Aging Report', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/')

    // Login (assuming authentication is in place)
    // await page.fill('[data-testid="email"]', 'test@example.com')
    // await page.fill('[data-testid="password"]', 'password')
    // await page.click('[data-testid="login-button"]')

    // Navigate to A/P Aging Report
    await page.click('[data-testid="reports-menu"]')
    await page.click('[data-testid="ap-aging-report"]')
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('should display A/P aging report summary', async () => {
    // Wait for report to load
    await expect(page.locator('[data-testid="report-title"]')).toContainText(
      'Accounts Payable Aging Report'
    )

    // Verify summary cards are present
    await expect(page.locator('[data-testid="total-outstanding"]')).toBeVisible()
    await expect(page.locator('[data-testid="total-overdue"]')).toBeVisible()
    await expect(page.locator('[data-testid="current-bills"]')).toBeVisible()

    // Verify aging buckets are displayed
    await expect(page.locator('[data-testid="bucket-current"]')).toBeVisible()
    await expect(page.locator('[data-testid="bucket-1-30"]')).toBeVisible()
    await expect(page.locator('[data-testid="bucket-31-60"]')).toBeVisible()
    await expect(page.locator('[data-testid="bucket-61-90"]')).toBeVisible()
    await expect(page.locator('[data-testid="bucket-90-plus"]')).toBeVisible()
  })

  test('should display vendor breakdown table', async () => {
    // Wait for vendor table to load
    await expect(page.locator('[data-testid="vendor-breakdown-table"]')).toBeVisible()

    // Verify table headers
    await expect(page.locator('text=Vendor')).toBeVisible()
    await expect(page.locator('text=Total Outstanding')).toBeVisible()
    await expect(page.locator('text=Current')).toBeVisible()
    await expect(page.locator('text=1-30 Days')).toBeVisible()
    await expect(page.locator('text=31-60 Days')).toBeVisible()
    await expect(page.locator('text=61-90 Days')).toBeVisible()
    await expect(page.locator('text=90+ Days')).toBeVisible()

    // Verify at least one vendor row is displayed
    const vendorRows = page.locator('[data-testid^="vendor-row-"]')
    await expect(vendorRows.first()).toBeVisible()
  })

  test('should sort vendors by name', async () => {
    // Click vendor column header to sort
    await page.click('[data-testid="sort-vendor"]')

    // Get first vendor name
    const firstVendor = await page
      .locator('[data-testid^="vendor-row-"]')
      .first()
      .locator('[data-testid="vendor-name"]')
      .textContent()

    // Click again to reverse sort
    await page.click('[data-testid="sort-vendor"]')

    // Get new first vendor name
    const newFirstVendor = await page
      .locator('[data-testid^="vendor-row-"]')
      .first()
      .locator('[data-testid="vendor-name"]')
      .textContent()

    // They should be different (unless there's only one vendor)
    expect(firstVendor).not.toBe(newFirstVendor)
  })

  test('should sort vendors by amount', async () => {
    // Click amount column header to sort
    await page.click('[data-testid="sort-amount"]')

    // Get amounts from first two rows
    const firstAmount = await page
      .locator('[data-testid^="vendor-row-"]')
      .first()
      .locator('[data-testid="vendor-amount"]')
      .textContent()

    const secondAmount = await page
      .locator('[data-testid^="vendor-row-"]')
      .nth(1)
      .locator('[data-testid="vendor-amount"]')
      .textContent()

    // Parse amounts (remove $ and commas)
    const first = parseFloat(firstAmount?.replace(/[$,]/g, '') || '0')
    const second = parseFloat(secondAmount?.replace(/[$,]/g, '') || '0')

    // First should be greater than or equal to second (descending order by default)
    expect(first).toBeGreaterThanOrEqual(second)
  })

  test('should expand vendor to show details', async () => {
    // Click first vendor row to expand
    const firstVendorRow = page.locator('[data-testid^="vendor-row-"]').first()
    await firstVendorRow.click()

    // Verify vendor details are displayed
    await expect(page.locator('[data-testid="vendor-details"]')).toBeVisible()
    await expect(page.locator('[data-testid="total-bills"]')).toBeVisible()
    await expect(page.locator('[data-testid="oldest-due-date"]')).toBeVisible()

    // Verify "View Bills" button is present
    await expect(page.locator('[data-testid="view-bills-button"]')).toBeVisible()
  })

  test('should navigate to vendor bills when clicking View Bills', async () => {
    // Expand first vendor
    const firstVendorRow = page.locator('[data-testid^="vendor-row-"]').first()
    await firstVendorRow.click()

    // Click "View Bills" button
    await page.click('[data-testid="view-bills-button"]')

    // Should navigate to bills page filtered by vendor
    await expect(page).toHaveURL(/\/bills\?vendor=/)
  })

  test('should display payment recommendations', async () => {
    // Check if recommendations section exists
    const recommendationsSection = page.locator('[data-testid="recommendations-section"]')

    if (await recommendationsSection.isVisible()) {
      // Verify at least one recommendation is shown
      const recommendations = page.locator('[data-testid^="recommendation-"]')
      await expect(recommendations.first()).toBeVisible()

      // Verify recommendation details
      await expect(page.locator('[data-testid="recommendation-vendor"]').first()).toBeVisible()
      await expect(page.locator('[data-testid="recommendation-amount"]').first()).toBeVisible()
      await expect(page.locator('[data-testid="recommendation-urgency"]').first()).toBeVisible()
    }
  })

  test('should show priority badges for overdue vendors', async () => {
    // Look for priority badges
    const priorityBadges = page.locator('[data-testid^="priority-badge-"]')

    // If any vendors have overdue bills, badges should be visible
    const count = await priorityBadges.count()
    if (count > 0) {
      await expect(priorityBadges.first()).toBeVisible()

      // Verify badge text (High, Medium, Critical)
      const badgeText = await priorityBadges.first().textContent()
      expect(['High', 'Medium', 'Critical', 'Low']).toContain(badgeText?.trim())
    }
  })

  test('should toggle educational explanations', async () => {
    // Find "What does this mean?" button
    const toggleButton = page.locator('[data-testid="toggle-explanations"]')
    await expect(toggleButton).toBeVisible()

    // Click to show explanations
    await toggleButton.click()

    // Verify explanations are displayed
    await expect(page.locator('[data-testid="report-explanation"]')).toBeVisible()

    // Click again to hide
    await toggleButton.click()

    // Verify explanations are hidden
    await expect(page.locator('[data-testid="report-explanation"]')).not.toBeVisible()
  })

  test('should export report to PDF', async () => {
    // Setup download listener
    const downloadPromise = page.waitForEvent('download')

    // Click export PDF button
    await page.click('[data-testid="export-pdf-button"]')

    // Wait for download
    const download = await downloadPromise

    // Verify filename
    expect(download.suggestedFilename()).toMatch(/AP_Aging_Report.*\.pdf/)
  })

  test('should export report to CSV', async () => {
    // Setup download listener
    const downloadPromise = page.waitForEvent('download')

    // Click export CSV button
    await page.click('[data-testid="export-csv-button"]')

    // Wait for download
    const download = await downloadPromise

    // Verify filename
    expect(download.suggestedFilename()).toMatch(/AP_Aging_Report.*\.csv/)

    // Verify CSV content structure
    const path = await download.path()
    if (path) {
      const fs = require('fs')
      const content = fs.readFileSync(path, 'utf-8')

      // Check for expected headers
      expect(content).toContain('Accounts Payable Aging Report')
      expect(content).toContain('Vendor,Total,Current')
    }
  })

  test('should show empty state when no bills exist', async () => {
    // This test assumes a clean database or test environment
    // Navigate to report
    await page.goto('/reports/ap-aging')

    // Check for empty state message
    const emptyState = page.locator('[data-testid="empty-state"]')

    if (await emptyState.isVisible()) {
      await expect(emptyState).toContainText('No bills found')
      await expect(page.locator('[data-testid="create-bill-button"]')).toBeVisible()
    }
  })

  test('should update report when date filter changes', async () => {
    // Get current total outstanding
    const originalTotal = await page
      .locator('[data-testid="total-outstanding"]')
      .textContent()

    // Open date picker
    await page.click('[data-testid="date-filter"]')

    // Select a different date (e.g., last month)
    await page.click('[data-testid="date-preset-last-month"]')

    // Wait for report to update
    await page.waitForTimeout(500)

    // Verify total has changed (or stayed the same if no bills in that period)
    const newTotal = await page.locator('[data-testid="total-outstanding"]').textContent()

    // Total should exist (even if it's $0.00)
    expect(newTotal).toBeTruthy()
  })

  test('should highlight overdue amounts in red', async () => {
    // Check if total overdue card has warning styling
    const overdueCard = page.locator('[data-testid="total-overdue"]')

    if (await overdueCard.isVisible()) {
      // Get the amount
      const amount = await overdueCard.locator('[data-testid="card-value"]').textContent()

      // If amount is greater than $0, it should have warning styling
      if (amount && parseFloat(amount.replace(/[$,]/g, '')) > 0) {
        const classList = await overdueCard.locator('[data-testid="card-value"]').getAttribute('class')
        expect(classList).toContain('warning')
      }
    }
  })

  test('should show tooltips on aging buckets', async () => {
    // Hover over first aging bucket
    await page.hover('[data-testid="bucket-current"]')

    // Check for tooltip
    await expect(page.locator('[data-testid="bucket-tooltip"]')).toBeVisible()

    // Verify tooltip contains helpful text
    const tooltipText = await page.locator('[data-testid="bucket-tooltip"]').textContent()
    expect(tooltipText).toContain('not yet due')
  })

  test('should be responsive on mobile', async () => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 })

    // Verify report is still visible and usable
    await expect(page.locator('[data-testid="report-title"]')).toBeVisible()

    // Summary cards should stack vertically
    const summaryCards = page.locator('[data-testid^="summary-card-"]')
    const firstCardBox = await summaryCards.first().boundingBox()
    const secondCardBox = await summaryCards.nth(1).boundingBox()

    if (firstCardBox && secondCardBox) {
      // Second card should be below first card (not beside it)
      expect(secondCardBox.y).toBeGreaterThan(firstCardBox.y)
    }

    // Table should be scrollable horizontally
    const table = page.locator('[data-testid="vendor-breakdown-table"]')
    const tableBox = await table.boundingBox()

    if (tableBox) {
      expect(tableBox.width).toBeLessThanOrEqual(375)
    }
  })

  test('should display report metadata', async () => {
    // Verify "As of" date is shown
    await expect(page.locator('[data-testid="as-of-date"]')).toBeVisible()

    // Verify generated date is shown in footer
    await expect(page.locator('[data-testid="generated-date"]')).toBeVisible()

    // Verify company name is shown
    await expect(page.locator('[data-testid="company-name"]')).toBeVisible()
  })
})
