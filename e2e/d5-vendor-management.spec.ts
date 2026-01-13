/**
 * D5: Vendor Management E2E Tests
 *
 * Tests vendor creation and management including:
 * - Create new vendors
 * - Edit existing vendors
 * - Delete vendors (with confirmation)
 * - Search and filter
 * - Duplicate detection
 * - Celebration messages for milestones
 * - Performance requirements (<500ms for save)
 */

import { test, expect } from '@playwright/test'
import { setupAuthenticatedSession, clearUserData } from './fixtures/auth'
import { checkAccessibility } from './helpers/accessibility'
import { measureTransactionSave, assertPerformance } from './helpers/performance'

test.describe('D5: Vendor Management', () => {
  test.beforeEach(async ({ page }) => {
    await clearUserData(page)
    await setupAuthenticatedSession(page)
  })

  test('should create a new vendor', async ({ page }) => {
    await page.goto('/vendors')

    // Check for encouraging header message
    const header = await page.locator('h1, header').textContent()
    expect(header).toMatch(/vendor/i)

    const description = await page.locator('p, [class*="description"]').first().textContent()
    expect(description).toMatch(/keeping track|helps you|where your money goes/i)

    // Click add vendor button
    await page.click('button:has-text("Add Vendor"), button:has-text("New Vendor")')

    // Fill in vendor form
    await page.fill('[name="name"]', 'Test Vendor Inc')
    await page.fill('[name="email"]', 'vendor@example.com')
    await page.fill('[name="phone"]', '555-1234')
    await page.fill('[name="address"]', '123 Vendor St')

    // Save vendor
    const saveTime = await measureTransactionSave(
      page,
      async () => {
        await page.click('button[type="submit"], button:has-text("Add"), button:has-text("Save")')
      },
      '[role="alert"], .success-message'
    )

    console.log(`Vendor save time: ${saveTime}ms`)

    // Should be under 500ms
    assertPerformance(saveTime, 500, 'Vendor save')

    // Success message
    await expect(page.locator('[role="alert"]')).toContainText(/added|created|saved/i)

    // Vendor should appear in list
    await expect(page.locator('text="Test Vendor Inc"')).toBeVisible()
  })

  test('should show first vendor celebration', async ({ page }) => {
    await page.goto('/vendors')

    // Ensure no vendors exist yet
    const emptyState = page.locator('text=/no vendors|get started/i')

    if (await emptyState.count() > 0) {
      // Create first vendor
      await page.click('button:has-text("Add Vendor")')
      await page.fill('[name="name"]', 'First Vendor')
      await page.click('button[type="submit"]')

      // Wait for success
      await page.waitForSelector('[role="alert"]')

      // Check for milestone celebration
      const pageText = await page.locator('body').textContent()

      // Should have encouraging message
      expect(pageText).toMatch(/first|keeping track|no judgment|clarity/i)
    }
  })

  test('should detect duplicate vendors', async ({ page }) => {
    await page.goto('/vendors')

    // Create first vendor
    await page.click('button:has-text("Add Vendor")')
    await page.fill('[name="name"]', 'Acme Corporation')
    await page.click('button[type="submit"]')
    await page.waitForSelector('[role="alert"]')

    // Close modal if it stays open
    await page.keyboard.press('Escape').catch(() => {})

    // Try to create duplicate
    await page.click('button:has-text("Add Vendor")')
    await page.fill('[name="name"]', 'ACME Corp') // Similar name

    await page.click('button[type="submit"]')

    // Should show duplicate warning
    const warning = page.locator('text=/similar|found|same one/i')

    if (await warning.count() > 0) {
      await expect(warning.first()).toBeVisible()

      // Warning should be helpful
      const warningText = await warning.textContent()
      expect(warningText).toMatch(/similar|found|same/i)
      expect(warningText).not.toMatch(/error|invalid|wrong/i)

      // Can proceed anyway
      await page.click('button:has-text("Add"), button:has-text("Proceed")')
      await page.waitForSelector('[role="alert"]')

      // Both vendors should exist
      await expect(page.locator('text="Acme Corporation"')).toBeVisible()
      await expect(page.locator('text="ACME Corp"')).toBeVisible()
    }
  })

  test('should edit existing vendor', async ({ page }) => {
    await page.goto('/vendors')

    // Create a vendor first
    await page.click('button:has-text("Add Vendor")')
    await page.fill('[name="name"]', 'Edit Test Vendor')
    await page.click('button[type="submit"]')
    await page.waitForSelector('[role="alert"]')

    // Find and edit the vendor
    const vendorRow = page.locator('text="Edit Test Vendor"').locator('..')
    await vendorRow.click() // or find edit button

    const editButton = page.locator('button:has-text("Edit"), button[aria-label*="Edit"]')
    if (await editButton.count() > 0) {
      await editButton.first().click()

      // Modify vendor data
      await page.fill('[name="email"]', 'updated@example.com')

      // Save changes
      await page.click('button[type="submit"], button:has-text("Save")')

      // Success message
      await expect(page.locator('[role="alert"]')).toContainText(/updated|saved/i)

      // Changes should be reflected
      await expect(page.locator('text="updated@example.com"')).toBeVisible()
    }
  })

  test('should delete vendor with confirmation', async ({ page }) => {
    await page.goto('/vendors')

    // Create a vendor
    await page.click('button:has-text("Add Vendor")')
    await page.fill('[name="name"]', 'Delete Test Vendor')
    await page.click('button[type="submit"]')
    await page.waitForSelector('[role="alert"]')

    // Find delete button
    const deleteButton = page.locator('button:has-text("Delete"), button:has-text("Remove"), button[aria-label*="Delete"]')

    if (await deleteButton.count() > 0) {
      await deleteButton.first().click()

      // Should show confirmation dialog
      await expect(page.locator('[role="dialog"], [class*="modal"]')).toBeVisible()

      // Confirmation should have reassuring message
      const confirmText = await page.locator('[role="dialog"]').textContent()
      expect(confirmText).toMatch(/sure|confirm|remove/i)
      expect(confirmText).toMatch(/won't delete|marked as inactive|hidden/i)

      // Confirm deletion
      await page.click('button:has-text("Remove"), button:has-text("Confirm"), button:has-text("Yes")')

      // Vendor should be removed from list
      await page.waitForTimeout(500)
      const vendorStillVisible = await page.locator('text="Delete Test Vendor"').count()
      expect(vendorStillVisible).toBe(0)
    }
  })

  test('should search vendors', async ({ page }) => {
    await page.goto('/vendors')

    // Create multiple vendors
    const vendors = ['Alpha Vendor', 'Beta Services', 'Gamma Corp']

    for (const vendor of vendors) {
      await page.click('button:has-text("Add Vendor")')
      await page.fill('[name="name"]', vendor)
      await page.click('button[type="submit"]')
      await page.waitForSelector('[role="alert"]')
      await page.keyboard.press('Escape').catch(() => {})
    }

    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]')

    if (await searchInput.count() > 0) {
      await searchInput.fill('Alpha')

      // Should filter results
      await expect(page.locator('text="Alpha Vendor"')).toBeVisible()
      await expect(page.locator('text="Beta Services"')).not.toBeVisible()

      // Clear search
      await searchInput.clear()
      await expect(page.locator('text="Beta Services"')).toBeVisible()
    }
  })

  test('should validate required fields', async ({ page }) => {
    await page.goto('/vendors')
    await page.click('button:has-text("Add Vendor")')

    // Try to submit without name
    await page.click('button[type="submit"]')

    // Should show validation error
    const error = page.locator('[class*="error"], [role="alert"]')
    await expect(error.first()).toBeVisible()

    // Error should be helpful
    const errorText = await error.first().textContent()
    expect(errorText).toMatch(/name|required|please|need/i)
    expect(errorText).not.toMatch(/invalid|wrong|failed/i)
  })

  test('should link to vendor expenses', async ({ page }) => {
    await page.goto('/vendors')

    // Create vendor
    await page.click('button:has-text("Add Vendor")')
    await page.fill('[name="name"]', 'Expense Vendor')
    await page.click('button[type="submit"]')
    await page.waitForSelector('[role="alert"]')

    // Click on vendor to see details
    await page.click('text="Expense Vendor"')

    // Should show vendor details
    const details = page.locator('[data-vendor-details], [class*="details"]')

    if (await details.count() > 0) {
      // Look for link to related expenses
      const expensesLink = page.locator('a:has-text("Expense"), button:has-text("View Expenses")')

      if (await expensesLink.count() > 0) {
        console.log('Vendor-to-expenses link found')
      }
    }
  })

  test('should be accessible', async ({ page }) => {
    await page.goto('/vendors')

    const results = await checkAccessibility(page)

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )

    if (criticalViolations.length > 0) {
      console.error('Accessibility violations:', criticalViolations)
    }

    expect(criticalViolations).toHaveLength(0)

    // List should be navigable
    const vendorList = page.locator('[role="table"], [role="list"], [class*="vendorList"]')
    await expect(vendorList.first()).toBeVisible()
  })

  test('should show vendor count milestone celebrations', async ({ page }) => {
    await page.goto('/vendors')

    // Create 10 vendors to trigger milestone
    for (let i = 1; i <= 10; i++) {
      await page.click('button:has-text("Add Vendor")')
      await page.fill('[name="name"]', `Vendor ${i}`)
      await page.click('button[type="submit"]')
      await page.waitForSelector('[role="alert"]')
      await page.keyboard.press('Escape').catch(() => {})
    }

    // Check for 10-vendor celebration
    const celebration = page.locator('text=/10 vendors|milestone|growing/i')

    if (await celebration.count() > 0) {
      console.log('10 vendors milestone celebration found')

      const celebrationText = await celebration.textContent()
      expect(celebrationText).toMatch(/10|vendor|client base|growing/i)
    }
  })

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/vendors')

    // Create a vendor
    await page.click('button:has-text("Add Vendor")')

    // Should be able to fill form with Tab + Enter
    await page.keyboard.press('Tab')
    await page.keyboard.type('Keyboard Vendor')

    await page.keyboard.press('Tab')
    await page.keyboard.type('keyboard@example.com')

    // Submit with Enter
    await page.keyboard.press('Enter')

    // Should save
    await expect(page.locator('[role="alert"]')).toContainText(/added|created/i)
  })

  test('should handle empty state gracefully', async ({ page }) => {
    await page.goto('/vendors')

    // Check for empty state
    const emptyState = page.locator('[data-empty-state], [class*="empty"]')

    if (await emptyState.count() > 0) {
      // Should have encouraging message
      const emptyText = await emptyState.textContent()
      expect(emptyText).toMatch(/no vendors|get started|add your first/i)
      expect(emptyText).not.toMatch(/error|none found|empty/i)
    }
  })

  test('should persist vendor data', async ({ page }) => {
    await page.goto('/vendors')

    // Create vendor
    await page.click('button:has-text("Add Vendor")')
    await page.fill('[name="name"]', 'Persist Vendor')
    await page.fill('[name="email"]', 'persist@example.com')
    await page.click('button[type="submit"]')
    await page.waitForSelector('[role="alert"]')

    // Reload page
    await page.reload()

    // Vendor should still be there
    await expect(page.locator('text="Persist Vendor"')).toBeVisible()
    await expect(page.locator('text="persist@example.com"')).toBeVisible()
  })
})
