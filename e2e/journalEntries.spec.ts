/**
 * Journal Entries E2E Tests
 *
 * End-to-end tests for the complete journal entry workflow in the browser.
 * Tests user interactions with journal entry forms, approval workflows, and templates.
 *
 * Requirements:
 * - F7: Journal Entries (Full) - E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('Journal Entries', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to journal entries
    await page.goto('/');
    // TODO: Add authentication flow when available
  });

  test('should create a balanced journal entry', async ({ page }) => {
    // Navigate to journal entries page
    await page.goto('/journal-entries/new');

    // Fill in entry details
    await page.fill('[name="description"]', 'Test journal entry');
    await page.fill('[name="reference"]', 'TEST-001');

    // Add first line item (debit)
    await page.selectOption('[data-testid="line-1-account"]', 'expense-account');
    await page.fill('[data-testid="line-1-debit"]', '100.00');

    // Add second line item (credit)
    await page.selectOption('[data-testid="line-2-account"]', 'cash-account');
    await page.fill('[data-testid="line-2-credit"]', '100.00');

    // Verify entry is balanced
    await expect(page.locator('[data-testid="entry-balanced"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-debits"]')).toHaveText('$100.00');
    await expect(page.locator('[data-testid="total-credits"]')).toHaveText('$100.00');

    // Submit entry
    await page.click('[data-testid="submit-entry"]');

    // Verify success
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('should prevent saving unbalanced entry', async ({ page }) => {
    await page.goto('/journal-entries/new');

    await page.fill('[name="description"]', 'Unbalanced entry');

    // Add unbalanced line items
    await page.selectOption('[data-testid="line-1-account"]', 'expense-account');
    await page.fill('[data-testid="line-1-debit"]', '100.00');

    await page.selectOption('[data-testid="line-2-account"]', 'cash-account');
    await page.fill('[data-testid="line-2-credit"]', '50.00'); // Unbalanced!

    // Verify error is shown
    await expect(page.locator('[data-testid="balance-error"]')).toBeVisible();

    // Submit button should be disabled
    await expect(page.locator('[data-testid="submit-entry"]')).toBeDisabled();
  });

  test('should create entry from template', async ({ page }) => {
    await page.goto('/journal-entries/new');

    // Open template selector
    await page.click('[data-testid="use-template"]');

    // Select depreciation template
    await page.click('[data-testid="template-depreciation-monthly"]');

    // Fill in template amounts
    await page.fill('[data-testid="template-amount-1"]', '500.00');

    // Select accounts
    await page.selectOption('[data-testid="template-account-1"]', 'depreciation-expense');
    await page.selectOption('[data-testid="template-account-2"]', 'accumulated-depreciation');

    // Apply template
    await page.click('[data-testid="apply-template"]');

    // Verify entry is pre-filled and balanced
    await expect(page.locator('[data-testid="entry-balanced"]')).toBeVisible();
    await expect(page.locator('[name="description"]')).toHaveValue(/depreciation/i);

    // Submit entry
    await page.click('[data-testid="submit-entry"]');
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('should complete approval workflow', async ({ page }) => {
    // Create entry with approval
    await page.goto('/journal-entries/new');
    await page.fill('[name="description"]', 'Entry for approval');
    await page.selectOption('[data-testid="line-1-account"]', 'expense-account');
    await page.fill('[data-testid="line-1-debit"]', '200.00');
    await page.selectOption('[data-testid="line-2-account"]', 'cash-account');
    await page.fill('[data-testid="line-2-credit"]', '200.00');

    // Submit for approval
    await page.check('[data-testid="submit-for-approval"]');
    await page.click('[data-testid="submit-entry"]');

    // Navigate to pending approvals
    await page.goto('/journal-entries/pending');

    // Find the entry
    await expect(page.locator('[data-testid="entry-status"]')).toContainText('PENDING');

    // Approve entry (as approver)
    await page.click('[data-testid="approve-entry"]');
    await page.click('[data-testid="confirm-approve"]');

    // Verify approval
    await expect(page.locator('[data-testid="entry-status"]')).toContainText('APPROVED');
  });

  test('should create reversing entry', async ({ page }) => {
    // First create an approved entry
    await page.goto('/journal-entries/new');
    await page.fill('[name="description"]', 'Entry to reverse');
    await page.selectOption('[data-testid="line-1-account"]', 'expense-account');
    await page.fill('[data-testid="line-1-debit"]', '300.00');
    await page.selectOption('[data-testid="line-2-account"]', 'cash-account');
    await page.fill('[data-testid="line-2-credit"]', '300.00');
    await page.click('[data-testid="submit-entry"]');

    // Navigate to entry list
    await page.goto('/journal-entries');

    // Find and open the entry
    await page.click('[data-testid="entry-row"]:first-child');

    // Create reversing entry
    await page.click('[data-testid="create-reversing"]');
    await page.click('[data-testid="confirm-reverse"]');

    // Verify reversing entry is created
    await expect(page.locator('[data-testid="reversing-badge"]')).toBeVisible();

    // Check that debits and credits are swapped
    const firstLineCredit = await page.locator('[data-testid="line-1-credit"]').textContent();
    expect(firstLineCredit).toBe('$300.00'); // Was debit in original
  });

  test('should toggle plain English mode', async ({ page }) => {
    await page.goto('/journal-entries/new');

    // Enable plain English mode
    await page.check('[data-testid="plain-english-toggle"]');

    // Verify plain English explanations are visible
    await expect(page.locator('[data-testid="plain-english-explanation"]')).toBeVisible();
    await expect(page.locator('[data-testid="debit-credit-explanation"]')).toBeVisible();

    // Disable plain English mode
    await page.uncheck('[data-testid="plain-english-toggle"]');

    // Verify explanations are hidden
    await expect(page.locator('[data-testid="plain-english-explanation"]')).not.toBeVisible();
  });

  test('should add and remove line items dynamically', async ({ page }) => {
    await page.goto('/journal-entries/new');

    // Should start with 2 lines
    const initialLines = await page.locator('[data-testid^="line-"]').count();
    expect(initialLines).toBeGreaterThanOrEqual(2);

    // Add a line
    await page.click('[data-testid="add-line"]');

    const afterAddLines = await page.locator('[data-testid^="line-"]').count();
    expect(afterAddLines).toBe(initialLines + 1);

    // Remove a line (if more than 2)
    if (afterAddLines > 2) {
      await page.click('[data-testid="remove-line-3"]');
      const afterRemoveLines = await page.locator('[data-testid^="line-"]').count();
      expect(afterRemoveLines).toBe(afterAddLines - 1);
    }
  });

  test('should show real-time balance calculation', async ({ page }) => {
    await page.goto('/journal-entries/new');

    // Initially should show 0.00
    await expect(page.locator('[data-testid="total-debits"]')).toHaveText('$0.00');
    await expect(page.locator('[data-testid="total-credits"]')).toHaveText('$0.00');

    // Enter debit amount
    await page.fill('[data-testid="line-1-debit"]', '150.00');

    // Total debits should update
    await expect(page.locator('[data-testid="total-debits"]')).toHaveText('$150.00');

    // Enter credit amount
    await page.fill('[data-testid="line-2-credit"]', '150.00');

    // Total credits should update
    await expect(page.locator('[data-testid="total-credits"]')).toHaveText('$150.00');

    // Difference should be 0 and show balanced
    await expect(page.locator('[data-testid="difference"]')).toHaveText('$0.00');
    await expect(page.locator('[data-testid="entry-balanced"]')).toBeVisible();
  });
});

test.describe('Journal Entries Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/journal-entries/new');

    // Tab through form fields
    await page.keyboard.press('Tab'); // Description
    await page.keyboard.press('Tab'); // Date
    await page.keyboard.press('Tab'); // Reference

    // Should be able to fill form with keyboard only
    await page.keyboard.type('Keyboard entry');
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/journal-entries/new');

    // Check for ARIA labels
    await expect(page.locator('[aria-label="Description"]')).toBeVisible();
    await expect(page.locator('[aria-label="Transaction date"]')).toBeVisible();
  });
});
