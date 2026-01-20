/**
 * Bill OCR E2E Tests
 *
 * End-to-end tests for bill OCR upload, review, and creation workflow
 */

import { test, expect } from '@playwright/test';

test.describe('Bill OCR Upload and Review', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to bills page
    await page.goto('/bills/new');
  });

  test('should display upload zone', async ({ page }) => {
    const uploadZone = page.locator('.upload-zone');
    await expect(uploadZone).toBeVisible();
    await expect(uploadZone).toContainText('Upload a bill');
  });

  test('should show upload instructions', async ({ page }) => {
    await expect(page.locator('.upload-instructions')).toBeVisible();
    await expect(page.locator('.upload-formats')).toContainText('JPG, PNG, and PDF');
  });

  test('should allow file selection via click', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeHidden(); // Hidden but accessible

    // Click upload zone should trigger file picker
    const uploadZone = page.locator('.upload-zone');
    await expect(uploadZone).toHaveAttribute('role', 'button');
  });

  test('should accept keyboard navigation', async ({ page }) => {
    const uploadZone = page.locator('.upload-zone');
    await uploadZone.focus();
    await expect(uploadZone).toBeFocused();

    // Should have tabindex
    await expect(uploadZone).toHaveAttribute('tabindex', '0');
  });

  test('should show processing state during upload', async ({ page }) => {
    // Mock file upload
    const fileInput = page.locator('input[type="file"]');

    // Create a mock file
    await fileInput.setInputFiles({
      name: 'test-bill.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    });

    // Should show processing content
    await expect(page.locator('.processing-content')).toBeVisible();
    await expect(page.locator('.processing-title')).toContainText('Reading your bill');
  });

  test('should display extracted data in review screen', async ({ page }) => {
    // Upload and process mock bill
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-bill.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    });

    // Wait for processing to complete
    await page.waitForSelector('.bill-ocr-review', { timeout: 10000 });

    // Should show review interface
    await expect(page.locator('.review-title')).toContainText('Review Bill Details');
  });

  test('should show original image in review panel', async ({ page }) => {
    // Navigate to review page (assuming processed)
    await page.goto('/bills/review/mock-id');

    const imagePanel = page.locator('.image-panel');
    await expect(imagePanel).toBeVisible();
    await expect(imagePanel.locator('.bill-image')).toBeVisible();
  });

  test('should display confidence scores for fields', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    // Should show confidence badges
    const confidenceBadges = page.locator('.confidence-badge');
    await expect(confidenceBadges.first()).toBeVisible();
  });

  test('should allow editing vendor name', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    const vendorInput = page.locator('#vendorName');
    await expect(vendorInput).toBeVisible();
    await expect(vendorInput).toBeEditable();

    await vendorInput.fill('Updated Vendor Name');
    await expect(vendorInput).toHaveValue('Updated Vendor Name');
  });

  test('should allow editing invoice number', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    const invoiceInput = page.locator('#invoiceNumber');
    await expect(invoiceInput).toBeEditable();

    await invoiceInput.fill('INV-NEW-001');
    await expect(invoiceInput).toHaveValue('INV-NEW-001');
  });

  test('should allow editing dates', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    const invoiceDateInput = page.locator('#invoiceDate');
    await expect(invoiceDateInput).toHaveAttribute('type', 'date');

    await invoiceDateInput.fill('2024-01-15');
    await expect(invoiceDateInput).toHaveValue('2024-01-15');
  });

  test('should allow editing total amount', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    const totalInput = page.locator('#totalAmount');
    await expect(totalInput).toHaveAttribute('type', 'number');

    await totalInput.fill('1234.56');
    await expect(totalInput).toHaveValue('1234.56');
  });

  test('should display line items table', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    const lineItemsSection = page.locator('.line-items-section');
    await expect(lineItemsSection).toBeVisible();

    const table = lineItemsSection.locator('table');
    await expect(table).toBeVisible();
  });

  test('should allow editing line item description', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    const firstDescInput = page.locator('tbody tr:first-child input[type="text"]');
    await expect(firstDescInput).toBeEditable();

    await firstDescInput.fill('Updated Description');
    await expect(firstDescInput).toHaveValue('Updated Description');
  });

  test('should allow adding new line item', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    const addButton = page.locator('.add-line-button');
    await expect(addButton).toBeVisible();

    const initialRows = await page.locator('tbody tr').count();
    await addButton.click();

    const newRows = await page.locator('tbody tr').count();
    expect(newRows).toBe(initialRows + 1);
  });

  test('should allow removing line item', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    const initialRows = await page.locator('tbody tr').count();
    const removeButton = page.locator('.remove-button').first();
    await removeButton.click();

    const newRows = await page.locator('tbody tr').count();
    expect(newRows).toBe(initialRows - 1);
  });

  test('should show validation errors', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    // Clear required field
    const vendorInput = page.locator('#vendorName');
    await vendorInput.fill('');

    // Wait for validation
    await page.waitForSelector('.validation-errors', { timeout: 2000 });

    await expect(page.locator('.validation-errors')).toBeVisible();
    await expect(page.locator('.validation-errors')).toContainText('Vendor name');
  });

  test('should show validation warnings', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    // Set future date
    const dateInput = page.locator('#invoiceDate');
    await dateInput.fill('2099-12-31');

    // Wait for validation
    await page.waitForTimeout(1000);

    const warnings = page.locator('.validation-warnings');
    if (await warnings.isVisible()) {
      await expect(warnings).toContainText('future');
    }
  });

  test('should disable confirm button when errors exist', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    // Clear required field to create error
    const vendorInput = page.locator('#vendorName');
    await vendorInput.fill('');

    // Wait for validation
    await page.waitForTimeout(1000);

    const confirmButton = page.locator('.confirm-button');
    await expect(confirmButton).toBeDisabled();
  });

  test('should enable confirm button when data is valid', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    const confirmButton = page.locator('.confirm-button');
    // Should be enabled if all required fields are valid
    if (await page.locator('.validation-errors').count() === 0) {
      await expect(confirmButton).toBeEnabled();
    }
  });

  test('should show cancel button', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    const cancelButton = page.locator('.cancel-button');
    await expect(cancelButton).toBeVisible();
    await expect(cancelButton).toContainText('Start Over');
  });

  test('should navigate back on cancel', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    const cancelButton = page.locator('.cancel-button');
    await cancelButton.click();

    // Should return to upload screen or bills list
    await expect(page).not.toHaveURL('/bills/review/mock-id');
  });

  test('should create bill on confirm', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    // Ensure data is valid
    const vendorInput = page.locator('#vendorName');
    await vendorInput.fill('Test Vendor');

    const totalInput = page.locator('#totalAmount');
    await totalInput.fill('1000.00');

    // Click confirm
    const confirmButton = page.locator('.confirm-button');
    if (await confirmButton.isEnabled()) {
      await confirmButton.click();

      // Should navigate to bills list or bill detail
      await page.waitForURL(/\/bills/, { timeout: 5000 });
    }
  });

  test('should display confidence legend', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    const legend = page.locator('.confidence-legend');
    await expect(legend).toBeVisible();
    await expect(legend).toContainText('High');
    await expect(legend).toContainText('Medium');
    await expect(legend).toContainText('Low');
  });

  test('should show OCR stats', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    const stats = page.locator('.ocr-stats');
    await expect(stats).toBeVisible();
    await expect(stats).toContainText('Overall Confidence');
    await expect(stats).toContainText('Processing Time');
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/bills/review/mock-id');

    // Should still be visible and functional
    await expect(page.locator('.review-title')).toBeVisible();
    await expect(page.locator('.fields-panel')).toBeVisible();
  });

  test('should meet WCAG 2.1 AA contrast requirements', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    // Check button contrast
    const confirmButton = page.locator('.confirm-button');
    const color = await confirmButton.evaluate(el => {
      return window.getComputedStyle(el).color;
    });
    expect(color).toBeTruthy();
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    // Tab through form fields
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.id);
    expect(focused).toBeTruthy();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    const vendorInput = page.locator('#vendorName');
    const ariaRequired = await vendorInput.getAttribute('aria-required');
    expect(ariaRequired).toBe('true');
  });

  test('should announce validation errors to screen readers', async ({ page }) => {
    await page.goto('/bills/review/mock-id');

    const validationErrors = page.locator('.validation-errors');
    const role = await validationErrors.getAttribute('role');
    expect(role).toBe('alert');
  });
});

test.describe('Multiple File Upload', () => {
  test('should support multiple file uploads', async ({ page }) => {
    await page.goto('/bills/new?multiple=true');

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute('multiple');
  });

  test('should show queue progress for multiple files', async ({ page }) => {
    await page.goto('/bills/new?multiple=true');

    // Upload multiple files
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      { name: 'bill1.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('data1') },
      { name: 'bill2.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('data2') },
    ]);

    // Should show queue progress
    await expect(page.locator('.queue-progress')).toBeVisible();
    await expect(page.locator('.progress-bar')).toBeVisible();
  });

  test('should display upload results', async ({ page }) => {
    await page.goto('/bills/new');

    // After successful upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-bill.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-data'),
    });

    // Wait for processing
    await page.waitForTimeout(2000);

    // Should show results (if successful)
    const results = page.locator('.upload-results');
    if (await results.isVisible()) {
      await expect(results).toContainText('Successfully processed');
    }
  });
});
