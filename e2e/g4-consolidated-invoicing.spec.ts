/**
 * E2E Tests for Consolidated Invoicing
 *
 * G4: Consolidated Invoice Creation
 *
 * Tests the complete user flow for creating consolidated invoices
 * with both itemized and summarized display modes.
 */

import { test, expect } from '@playwright/test';

test.describe('G4: Consolidated Invoicing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app (adjust URL as needed)
    await page.goto('/');

    // Setup: Create test data (parent with children)
    // This would typically be done via API or database seeding
    // For now, we'll simulate the flow
  });

  test('should toggle between individual and consolidated billing types', async ({
    page,
  }) => {
    // Navigate to invoice creation
    await page.goto('/invoices/new');

    // Verify default is individual
    await expect(page.getByText('Individual Invoice')).toHaveClass(/bg-blue-600/);

    // Click consolidated
    await page.getByRole('button', { name: 'Consolidated Invoice' }).click();

    // Verify switched to consolidated
    await expect(page.getByText('Consolidated Invoice')).toHaveClass(/bg-blue-600/);
    await expect(
      page.getByText('One invoice for all your locations. Accounting made simple.')
    ).toBeVisible();

    // Switch back to individual
    await page.getByRole('button', { name: 'Individual Invoice' }).click();

    // Verify switched back
    await expect(page.getByText('Individual Invoice')).toHaveClass(/bg-blue-600/);
  });

  test('should display parent account selector in consolidated mode', async ({
    page,
  }) => {
    await page.goto('/invoices/new');

    // Switch to consolidated mode
    await page.getByRole('button', { name: 'Consolidated Invoice' }).click();

    // Verify parent selector is visible
    await expect(page.getByLabel('Parent Account')).toBeVisible();

    // Verify dropdown has placeholder
    const selector = page.getByLabel('Parent Account');
    await expect(selector).toHaveValue('');

    const placeholder = await selector.evaluate((el) =>
      el.querySelector('option[value=""]')?.textContent
    );
    expect(placeholder).toContain('Select a parent account');
  });

  test('should load sub-accounts when parent is selected', async ({ page }) => {
    await page.goto('/invoices/new');

    // Switch to consolidated mode
    await page.getByRole('button', { name: 'Consolidated Invoice' }).click();

    // Mock parent accounts (in real test, this would come from API)
    // Select a parent account
    await page.getByLabel('Parent Account').selectOption({ index: 1 });

    // Wait for sub-accounts to load
    await expect(page.getByText('Select Locations')).toBeVisible();

    // Verify checkboxes appear
    const checkboxes = page.locator('input[type="checkbox"][id^="child-"]');
    await expect(checkboxes.first()).toBeVisible();
  });

  test('should auto-select all sub-accounts by default', async ({ page }) => {
    await page.goto('/invoices/new');

    await page.getByRole('button', { name: 'Consolidated Invoice' }).click();
    await page.getByLabel('Parent Account').selectOption({ index: 1 });

    // Wait for sub-accounts to load
    await page.waitForSelector('input[type="checkbox"][id^="child-"]');

    // Verify all checkboxes are checked
    const checkboxes = page.locator('input[type="checkbox"][id^="child-"]');
    const count = await checkboxes.count();

    for (let i = 0; i < count; i++) {
      await expect(checkboxes.nth(i)).toBeChecked();
    }

    // Verify selection count
    await expect(page.getByText(/selected/)).toContainText(`${count} of ${count}`);
  });

  test('should allow selecting/deselecting individual sub-accounts', async ({
    page,
  }) => {
    await page.goto('/invoices/new');

    await page.getByRole('button', { name: 'Consolidated Invoice' }).click();
    await page.getByLabel('Parent Account').selectOption({ index: 1 });

    await page.waitForSelector('input[type="checkbox"][id^="child-"]');

    const checkboxes = page.locator('input[type="checkbox"][id^="child-"]');
    const firstCheckbox = checkboxes.first();

    // Uncheck first
    await firstCheckbox.uncheck();
    await expect(firstCheckbox).not.toBeChecked();

    // Check it again
    await firstCheckbox.check();
    await expect(firstCheckbox).toBeChecked();
  });

  test('should support select all and deselect all actions', async ({ page }) => {
    await page.goto('/invoices/new');

    await page.getByRole('button', { name: 'Consolidated Invoice' }).click();
    await page.getByLabel('Parent Account').selectOption({ index: 1 });

    await page.waitForSelector('input[type="checkbox"][id^="child-"]');

    // Click deselect all
    await page.getByRole('button', { name: 'Deselect All' }).click();

    // Verify all unchecked
    const checkboxes = page.locator('input[type="checkbox"][id^="child-"]');
    const count = await checkboxes.count();

    for (let i = 0; i < count; i++) {
      await expect(checkboxes.nth(i)).not.toBeChecked();
    }

    // Verify selection count
    await expect(page.getByText(/selected/)).toContainText(`0 of ${count}`);

    // Click select all
    await page.getByRole('button', { name: 'Select All' }).click();

    // Verify all checked
    for (let i = 0; i < count; i++) {
      await expect(checkboxes.nth(i)).toBeChecked();
    }

    await expect(page.getByText(/selected/)).toContainText(`${count} of ${count}`);
  });

  test('should toggle between itemized and summarized display modes', async ({
    page,
  }) => {
    await page.goto('/invoices/new');

    await page.getByRole('button', { name: 'Consolidated Invoice' }).click();
    await page.getByLabel('Parent Account').selectOption({ index: 1 });

    await page.waitForSelector('input[type="checkbox"][id^="child-"]');

    // Verify itemized is default
    const itemizedButton = page.getByRole('button', { name: 'Itemized' });
    await expect(itemizedButton).toHaveClass(/bg-blue-600/);
    await expect(
      page.getByText('Show each item from each location separately')
    ).toBeVisible();

    // Switch to summarized
    await page.getByRole('button', { name: 'Summarized' }).click();

    // Verify switched
    const summarizedButton = page.getByRole('button', { name: 'Summarized' });
    await expect(summarizedButton).toHaveClass(/bg-blue-600/);
    await expect(page.getByText('Show only totals per location')).toBeVisible();
  });

  test('should generate preview with itemized mode', async ({ page }) => {
    await page.goto('/invoices/new');

    await page.getByRole('button', { name: 'Consolidated Invoice' }).click();
    await page.getByLabel('Parent Account').selectOption({ index: 1 });
    await page.waitForSelector('input[type="checkbox"][id^="child-"]');

    // Fill invoice details
    await page.getByLabel('Invoice Number').fill('CONS-001');
    await page.getByLabel('Tax Rate').fill('8');

    // Select itemized mode
    await page.getByRole('button', { name: 'Itemized' }).click();

    // Generate preview
    await page.getByRole('button', { name: 'Generate Preview' }).click();

    // Wait for preview to appear
    await expect(page.getByText('Invoice Preview')).toBeVisible();

    // Verify preview shows location names in line items
    await expect(page.getByText(/Location.*-/)).toBeVisible();

    // Verify totals are displayed
    await expect(page.getByText('Subtotal:')).toBeVisible();
    await expect(page.getByText('Tax:')).toBeVisible();
    await expect(page.getByText('Total:')).toBeVisible();
  });

  test('should generate preview with summarized mode', async ({ page }) => {
    await page.goto('/invoices/new');

    await page.getByRole('button', { name: 'Consolidated Invoice' }).click();
    await page.getByLabel('Parent Account').selectOption({ index: 1 });
    await page.waitForSelector('input[type="checkbox"][id^="child-"]');

    // Fill invoice details
    await page.getByLabel('Invoice Number').fill('CONS-002');

    // Select summarized mode
    await page.getByRole('button', { name: 'Summarized' }).click();

    // Generate preview
    await page.getByRole('button', { name: 'Generate Preview' }).click();

    // Wait for preview to appear
    await expect(page.getByText('Invoice Preview')).toBeVisible();

    // Verify preview shows totals per location
    await expect(page.getByText(/Location.*- Total/)).toBeVisible();

    // Verify fewer line items than itemized mode
    const lineItems = page.locator('.preview-line-item');
    const count = await lineItems.count();
    expect(count).toBeLessThanOrEqual(10); // Reasonable upper bound
  });

  test('should validate required fields before preview', async ({ page }) => {
    await page.goto('/invoices/new');

    await page.getByRole('button', { name: 'Consolidated Invoice' }).click();

    // Try to generate preview without selecting parent
    await page.getByRole('button', { name: 'Generate Preview' }).click();

    // Should show error
    await expect(page.getByText('Please select a parent account')).toBeVisible();

    // Select parent but don't fill invoice number
    await page.getByLabel('Parent Account').selectOption({ index: 1 });
    await page.waitForSelector('input[type="checkbox"][id^="child-"]');

    // Deselect all children
    await page.getByRole('button', { name: 'Deselect All' }).click();

    // Try to generate preview
    await page.getByRole('button', { name: 'Generate Preview' }).click();

    // Should show error about sub-accounts
    await expect(
      page.getByText('Please select at least one sub-account')
    ).toBeVisible();
  });

  test('should create consolidated invoice after preview', async ({ page }) => {
    await page.goto('/invoices/new');

    await page.getByRole('button', { name: 'Consolidated Invoice' }).click();
    await page.getByLabel('Parent Account').selectOption({ index: 1 });
    await page.waitForSelector('input[type="checkbox"][id^="child-"]');

    // Fill details
    await page.getByLabel('Invoice Number').fill('CONS-003');
    await page.getByLabel('Tax Rate').fill('8');
    await page
      .getByLabel('Notes (visible to customer)')
      .fill('Thank you for your business');

    // Generate preview
    await page.getByRole('button', { name: 'Generate Preview' }).click();
    await expect(page.getByText('Invoice Preview')).toBeVisible();

    // Create invoice
    await page.getByRole('button', { name: 'Create Invoice' }).click();

    // Should redirect or show success message
    await expect(page.getByText(/Invoice created|Success/)).toBeVisible();
  });

  test('should show loading states during async operations', async ({ page }) => {
    await page.goto('/invoices/new');

    await page.getByRole('button', { name: 'Consolidated Invoice' }).click();
    await page.getByLabel('Parent Account').selectOption({ index: 1 });
    await page.waitForSelector('input[type="checkbox"][id^="child-"]');

    await page.getByLabel('Invoice Number').fill('CONS-004');

    // Generate preview
    const previewButton = page.getByRole('button', { name: 'Generate Preview' });
    await previewButton.click();

    // Should show loading text briefly
    await expect(page.getByText('Loading...')).toBeVisible();

    // Wait for preview
    await expect(page.getByText('Invoice Preview')).toBeVisible();

    // Create invoice
    const createButton = page.getByRole('button', { name: 'Create Invoice' });
    await createButton.click();

    // Should show creating state
    await expect(page.getByText('Creating...')).toBeVisible();
  });

  test('should handle errors gracefully', async ({ page }) => {
    await page.goto('/invoices/new');

    await page.getByRole('button', { name: 'Consolidated Invoice' }).click();

    // Mock an error scenario (e.g., network failure)
    // In a real test, this would be set up with request interception
    await page.route('**/api/invoices', (route) => route.abort());

    await page.getByLabel('Parent Account').selectOption({ index: 1 });
    await page.waitForSelector('input[type="checkbox"][id^="child-"]');

    await page.getByLabel('Invoice Number').fill('CONS-005');
    await page.getByRole('button', { name: 'Generate Preview' }).click();

    // Should show error message
    await expect(page.getByText(/error|failed/i)).toBeVisible();
  });

  test('should allow canceling invoice creation', async ({ page }) => {
    await page.goto('/invoices/new');

    await page.getByRole('button', { name: 'Consolidated Invoice' }).click();

    // Click cancel
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Should navigate away or reset form
    // Specific behavior depends on implementation
    await expect(page).toHaveURL(/invoices(?!\/new)/);
  });

  test('should display preview statistics correctly', async ({ page }) => {
    await page.goto('/invoices/new');

    await page.getByRole('button', { name: 'Consolidated Invoice' }).click();
    await page.getByLabel('Parent Account').selectOption({ index: 1 });
    await page.waitForSelector('input[type="checkbox"][id^="child-"]');

    await page.getByLabel('Invoice Number').fill('CONS-006');
    await page.getByRole('button', { name: 'Generate Preview' }).click();

    await expect(page.getByText('Invoice Preview')).toBeVisible();

    // Verify statistics are shown
    await expect(page.getByText(/Locations Included:/)).toBeVisible();
    await expect(page.getByText(/Total Items:/)).toBeVisible();
    await expect(page.getByText(/Display Mode:/)).toBeVisible();
  });

  test('should calculate tax correctly in preview', async ({ page }) => {
    await page.goto('/invoices/new');

    await page.getByRole('button', { name: 'Consolidated Invoice' }).click();
    await page.getByLabel('Parent Account').selectOption({ index: 1 });
    await page.waitForSelector('input[type="checkbox"][id^="child-"]');

    await page.getByLabel('Invoice Number').fill('CONS-007');
    await page.getByLabel('Tax Rate').fill('10'); // 10% tax

    await page.getByRole('button', { name: 'Generate Preview' }).click();
    await expect(page.getByText('Invoice Preview')).toBeVisible();

    // Get subtotal and tax amounts
    const subtotalText = await page.getByText('Subtotal:').locator('..').innerText();
    const taxText = await page.getByText('Tax:').locator('..').innerText();
    const totalText = await page.getByText('Total:').locator('..').innerText();

    // Extract numbers
    const subtotal = parseFloat(subtotalText.match(/\$?([\d.]+)/)?.[1] || '0');
    const tax = parseFloat(taxText.match(/\$?([\d.]+)/)?.[1] || '0');
    const total = parseFloat(totalText.match(/\$?([\d.]+)/)?.[1] || '0');

    // Verify tax calculation
    expect(tax).toBeCloseTo(subtotal * 0.1, 2);
    expect(total).toBeCloseTo(subtotal + tax, 2);
  });
});
