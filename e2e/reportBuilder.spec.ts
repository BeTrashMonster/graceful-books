/**
 * Report Builder E2E Tests
 *
 * End-to-end tests for the custom report builder using Playwright.
 * Tests the complete user workflow from UI interactions.
 *
 * @module reportBuilder.spec
 */

import { test, expect } from '@playwright/test';

test.describe('Custom Report Builder', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to report builder
    await page.goto('/reports/builder');
  });

  test('should complete full report creation wizard', async ({ page }) => {
    // Step 1: Enter report name and choose icon
    await expect(page.getByRole('heading', { name: /Name Your Report/i })).toBeVisible();

    await page.fill('input[id="report-name"]', 'My Custom Report');
    await page.fill('textarea[id="report-description"]', 'This is a test report');

    // Choose icon
    await page.click('button.icon-picker-button');
    await expect(page.locator('.icon-picker-modal')).toBeVisible();
    await page.click('.icon-option:nth-child(5)'); // Select 5th icon

    // Go to next step
    await page.click('button:has-text("Next: Select Columns")');

    // Step 2: Select columns
    await expect(page.getByRole('heading', { name: /Select Columns/i })).toBeVisible();

    // Expand a category
    await page.click('.category-header:has-text("Transaction Details")');

    // Select some columns
    await page.click('.available-column:has-text("Date")');
    await page.click('.available-column:has-text("Amount")');
    await page.click('.available-column:has-text("Description")');

    // Verify columns are selected
    await expect(page.locator('.selected-columns-list .selected-column')).toHaveCount(3);

    await page.click('button:has-text("Next: Add Filters")');

    // Step 3: Add filters (optional, can skip)
    await expect(page.getByRole('heading', { name: /Add Filters/i })).toBeVisible();

    // Add a filter
    await page.click('button:has-text("Add Filter")');
    await page.selectOption('.filter-field-select', { label: 'Amount' });
    await page.selectOption('.filter-operator-select', { label: 'is greater than' });
    await page.fill('.filter-value-input', '100');
    await page.click('button:has-text("Add Filter"):not(.btn-add-filter)');

    // Verify filter was added
    await expect(page.locator('.filter-item')).toHaveCount(1);

    await page.click('button:has-text("Next: Choose Date Range")');

    // Step 4: Choose date range
    await expect(page.getByRole('heading', { name: /Choose Date Range/i })).toBeVisible();

    await page.selectOption('select[id="date-range-template"]', { label: 'This Month' });

    await page.click('button:has-text("Next: Preview & Save")');

    // Step 5: Preview and save
    await expect(page.getByRole('heading', { name: /Preview & Save/i })).toBeVisible();

    // Verify summary
    await expect(page.locator('.report-summary')).toBeVisible();
    await expect(page.locator('.summary-value:has-text("My Custom Report")')).toBeVisible();
    await expect(page.locator('.summary-value:has-text("3 selected")')).toBeVisible();

    // Preview report
    await page.click('button:has-text("Preview Report")');

    // Wait for preview to load
    await expect(page.locator('.report-preview')).toBeVisible({ timeout: 10000 });

    // Save report
    await page.click('button:has-text("Save Report")');

    // Should show success message or navigate away
    await expect(page.locator('text=/Report saved|Success/i')).toBeVisible({ timeout: 5000 });
  });

  test('should allow editing existing report', async ({ page }) => {
    // Assume report exists, navigate to edit
    await page.goto('/reports/builder?id=test-report-id&mode=edit');

    // Should load existing report data
    await expect(page.locator('input[id="report-name"]')).not.toHaveValue('');

    // Change name
    await page.fill('input[id="report-name"]', 'Updated Report Name');

    // Navigate through wizard
    await page.click('button:has-text("Next: Select Columns")');
    await page.click('button:has-text("Next: Add Filters")');
    await page.click('button:has-text("Next: Choose Date Range")');
    await page.click('button:has-text("Next: Preview & Save")');

    // Update report
    await page.click('button:has-text("Update Report")');

    await expect(page.locator('text=/updated|success/i')).toBeVisible({ timeout: 5000 });
  });

  test('should validate required fields', async ({ page }) => {
    // Try to proceed without entering name
    await expect(page.locator('button:has-text("Next: Select Columns")')).toBeDisabled();

    // Enter name
    await page.fill('input[id="report-name"]', 'Test Report');

    // Next button should be enabled
    await expect(page.locator('button:has-text("Next: Select Columns")')).toBeEnabled();
    await page.click('button:has-text("Next: Select Columns")');

    // Try to proceed without selecting columns
    await expect(page.locator('button:has-text("Next: Add Filters")')).toBeDisabled();

    // Select a column
    await page.click('.category-header:first-child');
    await page.click('.available-column:first-child');

    // Next button should be enabled
    await expect(page.locator('button:has-text("Next: Add Filters")')).toBeEnabled();
  });

  test('should support drag and drop column reordering', async ({ page }) => {
    // Navigate to column selection step
    await page.fill('input[id="report-name"]', 'Drag Test');
    await page.click('button:has-text("Next: Select Columns")');

    // Select multiple columns
    await page.click('.category-header:first-child');
    await page.click('.available-column:nth-child(1)');
    await page.click('.available-column:nth-child(2)');
    await page.click('.available-column:nth-child(3)');

    // Get initial order
    const firstColumn = page.locator('.selected-column:first-child .column-name');
    const firstColumnText = await firstColumn.textContent();

    // Drag and drop (simplified - actual implementation may vary)
    const source = page.locator('.selected-column:first-child .drag-handle');
    const target = page.locator('.selected-column:last-child');

    await source.dragTo(target);

    // Verify order changed
    const newFirstColumn = page.locator('.selected-column:first-child .column-name');
    const newFirstColumnText = await newFirstColumn.textContent();

    expect(newFirstColumnText).not.toBe(firstColumnText);
  });

  test('should handle filter builder AND/OR logic', async ({ page }) => {
    // Navigate to filter step
    await page.fill('input[id="report-name"]', 'Filter Test');
    await page.click('button:has-text("Next: Select Columns")');
    await page.click('.available-column:first-child');
    await page.click('button:has-text("Next: Add Filters")');

    // Add first filter
    await page.click('button:has-text("Add Filter")');
    await page.selectOption('.filter-field-select:visible', { index: 1 });
    await page.selectOption('.filter-operator-select:visible', { index: 0 });
    await page.fill('.filter-value-input:visible', 'test1');
    await page.click('.filter-form-actions button:has-text("Add Filter")');

    // Add second filter
    await page.click('button:has-text("Add Filter")');
    await page.selectOption('.filter-field-select:visible', { index: 2 });
    await page.selectOption('.filter-operator-select:visible', { index: 0 });
    await page.fill('.filter-value-input:visible', 'test2');
    await page.click('.filter-form-actions button:has-text("Add Filter")');

    // Verify filters exist
    await expect(page.locator('.filter-item')).toHaveCount(2);

    // Toggle operator from AND to OR
    await page.click('.operator-toggle');
    await expect(page.locator('.operator-toggle')).toHaveText('OR');

    // Toggle back
    await page.click('.operator-toggle');
    await expect(page.locator('.operator-toggle')).toHaveText('AND');
  });

  test('should support custom date range', async ({ page }) => {
    // Navigate to date range step
    await page.fill('input[id="report-name"]', 'Date Test');
    await page.click('button:has-text("Next: Select Columns")');
    await page.click('.available-column:first-child');
    await page.click('button:has-text("Next: Add Filters")');
    await page.click('button:has-text("Next: Choose Date Range")');

    // Select custom date range
    await page.selectOption('select[id="date-range-template"]', { label: 'Custom Range' });

    // Custom date inputs should appear
    await expect(page.locator('input[id="start-date"]')).toBeVisible();
    await expect(page.locator('input[id="end-date"]')).toBeVisible();

    // Fill in dates
    await page.fill('input[id="start-date"]', '2024-01-01');
    await page.fill('input[id="end-date"]', '2024-01-31');

    // Proceed to next step
    await page.click('button:has-text("Next: Preview & Save")');

    // Verify custom date range in summary
    await expect(page.locator('.summary-value:has-text("Custom Range")')).toBeVisible();
  });

  test('should export report to CSV', async ({ page }) => {
    // Assume we're on a saved report edit page
    await page.goto('/reports/builder?id=existing-report&mode=edit');

    // Navigate to preview/save step
    await page.click('.step:has-text("Preview & Save")');

    // Click CSV export button
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export as CSV")');

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('should export report to PDF', async ({ page }) => {
    // Assume we're on a saved report edit page
    await page.goto('/reports/builder?id=existing-report&mode=edit');

    // Navigate to preview/save step
    await page.click('.step:has-text("Preview & Save")');

    // Click PDF export button
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export as PDF")');

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('should remove filters', async ({ page }) => {
    // Navigate to filter step
    await page.fill('input[id="report-name"]', 'Remove Filter Test');
    await page.click('button:has-text("Next: Select Columns")');
    await page.click('.available-column:first-child');
    await page.click('button:has-text("Next: Add Filters")');

    // Add a filter
    await page.click('button:has-text("Add Filter")');
    await page.selectOption('.filter-field-select:visible', { index: 1 });
    await page.selectOption('.filter-operator-select:visible', { index: 0 });
    await page.fill('.filter-value-input:visible', 'test');
    await page.click('.filter-form-actions button:has-text("Add Filter")');

    await expect(page.locator('.filter-item')).toHaveCount(1);

    // Remove the filter
    await page.click('.remove-filter');

    await expect(page.locator('.filter-item')).toHaveCount(0);
    await expect(page.locator('.empty-state')).toBeVisible();
  });

  test('should search for columns', async ({ page }) => {
    // Navigate to column selection
    await page.fill('input[id="report-name"]', 'Search Test');
    await page.click('button:has-text("Next: Select Columns")');

    // Type in search box
    await page.fill('.column-search-input', 'amount');

    // Should filter columns
    const visibleColumns = page.locator('.available-column:visible');
    const count = await visibleColumns.count();

    // At least one column should match
    expect(count).toBeGreaterThan(0);

    // All visible columns should contain "amount" in name or description
    for (let i = 0; i < count; i++) {
      const text = await visibleColumns.nth(i).textContent();
      expect(text?.toLowerCase()).toContain('amount');
    }
  });

  test('should navigate wizard steps', async ({ page }) => {
    await page.fill('input[id="report-name"]', 'Navigation Test');

    // Click on step indicator to jump to step 3
    await page.click('.step:has-text("Add Filters")');

    // Should not allow jumping ahead without completing previous steps
    // Implementation may vary - this tests navigation control

    // Complete steps in order
    await page.click('.step:nth-child(1)');
    await page.click('button:has-text("Next: Select Columns")');
    await page.click('.available-column:first-child');
    await page.click('button:has-text("Next: Add Filters")');
    await page.click('button:has-text("Next: Choose Date Range")');

    // Now can click back to previous steps
    await page.click('.step:has-text("Add Filters")');
    await expect(page.getByRole('heading', { name: /Add Filters/i })).toBeVisible();
  });

  test('should show aggregation options for numeric columns', async ({ page }) => {
    // Navigate to column selection
    await page.fill('input[id="report-name"]', 'Aggregation Test');
    await page.click('button:has-text("Next: Select Columns")');

    // Select a numeric column (e.g., Amount)
    await page.click('.category-header:first-child');
    await page.click('.available-column:has-text("Amount")');

    // Should show aggregation dropdown for numeric column
    await expect(page.locator('.aggregation-select')).toBeVisible();

    // Change aggregation
    await page.selectOption('.aggregation-select', { label: 'Sum' });

    // Verify selection
    const selectedValue = await page.locator('.aggregation-select').inputValue();
    expect(selectedValue).toBe('sum');
  });

  test('should show encouraging message based on DISC profile', async ({ page }) => {
    // Different DISC profiles should show different messages
    // This would need to be implemented with proper auth/profile context

    await expect(page.locator('.encouraging-message')).toBeVisible();
    const message = await page.locator('.encouraging-message').textContent();

    // Message should exist and be encouraging
    expect(message).toBeTruthy();
    expect(message?.length).toBeGreaterThan(10);
  });

  test('should handle validation errors gracefully', async ({ page }) => {
    // Navigate through without completing required fields
    await page.fill('input[id="report-name"]', 'Validation Test');
    await page.click('button:has-text("Next: Select Columns")');
    await page.click('.available-column:first-child');
    await page.click('button:has-text("Next: Add Filters")');
    await page.click('button:has-text("Next: Choose Date Range")');

    // Choose custom date range but don't fill dates
    await page.selectOption('select[id="date-range-template"]', { label: 'Custom Range' });
    await page.click('button:has-text("Next: Preview & Save")');

    // Try to save
    await page.click('button:has-text("Save Report")');

    // Should show validation errors
    await expect(page.locator('.validation-errors')).toBeVisible();
    await expect(page.locator('.error-message:has-text("date")')).toBeVisible();
  });
});

test.describe('Report Builder Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/reports/builder');

    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.locator('input[id="report-name"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('textarea[id="report-description"]')).toBeFocused();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/reports/builder');

    // Check for proper labels
    await expect(page.locator('label[for="report-name"]')).toBeVisible();
    await expect(page.locator('label[for="report-description"]')).toBeVisible();

    // Buttons should have accessible text
    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');

      expect(text || ariaLabel).toBeTruthy();
    }
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/reports/builder');

    // Playwright can't directly test color contrast, but we can verify
    // that elements are visible which is a good proxy
    await expect(page.locator('.report-builder-header h1')).toBeVisible();
    await expect(page.locator('.encouraging-message')).toBeVisible();
    await expect(page.locator('label')).toBeVisible();
  });
});
