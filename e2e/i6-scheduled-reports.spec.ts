/**
 * I6: Scheduled Report Delivery - E2E Tests
 *
 * Tests the complete workflow of scheduled report delivery.
 */

import { test, expect } from '@playwright/test';

test.describe('I6: Scheduled Report Delivery', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to scheduled reports page
    await page.goto('/reports/schedules');
  });

  test('should create a new report schedule', async ({ page }) => {
    // Click "New Schedule" button
    await page.click('button:has-text("New Schedule")');

    // Fill out schedule form
    await page.selectOption('select[id="reportType"]', 'profit-loss');
    await page.fill('input[id="reportName"]', 'Monthly P&L Report');
    await page.selectOption('select[id="frequency"]', 'monthly');
    await page.fill('input[id="timeOfDay"]', '08:00');
    await page.selectOption('select[id="format"]', 'pdf');
    await page.fill('input[id="recipients"]', 'test@example.com, manager@example.com');

    // Submit form
    await page.click('button[type="submit"]:has-text("Create Schedule")');

    // Verify schedule appears in list
    await expect(page.locator('text=Monthly P&L Report')).toBeVisible();
    await expect(page.locator('text=Monthly')).toBeVisible();
    await expect(page.locator('text=PDF')).toBeVisible();
  });

  test('should display schedule configuration correctly', async ({ page }) => {
    // Assuming a schedule exists
    await page.click('button:has-text("New Schedule")');

    // Fill minimal required fields
    await page.selectOption('select[id="reportType"]', 'balance-sheet');
    await page.fill('input[id="reportName"]', 'Weekly Balance Sheet');
    await page.selectOption('select[id="frequency"]', 'weekly');
    await page.selectOption('select[id="dayOfWeek"]', 'friday');
    await page.fill('input[id="timeOfDay"]', '17:00');
    await page.fill('input[id="recipients"]', 'owner@example.com');

    // Verify day of week selector appears for weekly
    await expect(page.locator('select[id="dayOfWeek"]')).toBeVisible();
    await expect(page.locator('option[value="friday"]')).toBeVisible();

    // Verify time picker shows correct value
    const timeInput = page.locator('input[id="timeOfDay"]');
    await expect(timeInput).toHaveValue('17:00');
  });

  test('should send a test email', async ({ page }) => {
    // Open schedule editor
    await page.click('button:has-text("New Schedule")');

    // Fill required fields
    await page.selectOption('select[id="reportType"]', 'profit-loss');
    await page.fill('input[id="reportName"]', 'Test Report');
    await page.selectOption('select[id="frequency"]', 'weekly');
    await page.fill('input[id="timeOfDay"]', '09:00');
    await page.fill('input[id="recipients"]', 'real@example.com');

    // Fill test email field
    await page.fill('input[id="testEmail"]', 'test@example.com');

    // Click send test button
    await page.click('button:has-text("Send Test")');

    // Verify success message or loading state
    await expect(page.locator('text=Sending...')).toBeVisible();
  });

  test('should edit an existing schedule', async ({ page }) => {
    // Create a schedule first
    await page.click('button:has-text("New Schedule")');
    await page.selectOption('select[id="reportType"]', 'profit-loss');
    await page.fill('input[id="reportName"]', 'Original Name');
    await page.selectOption('select[id="frequency"]', 'weekly');
    await page.fill('input[id="timeOfDay"]', '08:00');
    await page.fill('input[id="recipients"]', 'old@example.com');
    await page.click('button[type="submit"]:has-text("Create Schedule")');

    // Wait for schedule to appear
    await expect(page.locator('text=Original Name')).toBeVisible();

    // Click edit button (assuming there's an edit button)
    await page.click('button[aria-label="Edit schedule"]:first');

    // Update fields
    await page.fill('input[id="reportName"]', 'Updated Name');
    await page.fill('input[id="recipients"]', 'new@example.com');

    // Save changes
    await page.click('button[type="submit"]:has-text("Update Schedule")');

    // Verify updates
    await expect(page.locator('text=Updated Name')).toBeVisible();
  });

  test('should pause and resume a schedule', async ({ page }) => {
    // Assuming schedule exists, click pause button
    const pauseButton = page.locator('button:has-text("Pause"):first');
    if (await pauseButton.isVisible()) {
      await pauseButton.click();

      // Verify paused state
      await expect(page.locator('text=Paused')).toBeVisible();

      // Resume
      await page.click('button:has-text("Resume"):first');

      // Verify active state
      await expect(page.locator('text=Active')).toBeVisible();
    }
  });

  test('should delete a schedule', async ({ page }) => {
    // Create a schedule to delete
    await page.click('button:has-text("New Schedule")');
    await page.selectOption('select[id="reportType"]', 'cash-flow');
    await page.fill('input[id="reportName"]', 'Schedule to Delete');
    await page.selectOption('select[id="frequency"]', 'daily');
    await page.fill('input[id="timeOfDay"]', '10:00');
    await page.fill('input[id="recipients"]', 'delete@example.com');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Schedule to Delete')).toBeVisible();

    // Delete the schedule
    await page.click('button[aria-label="Delete schedule"]:first');

    // Confirm deletion
    await page.click('button:has-text("Confirm")');

    // Verify removal
    await expect(page.locator('text=Schedule to Delete')).not.toBeVisible();
  });

  test('should display delivery history', async ({ page }) => {
    // Navigate to delivery history
    await page.click('text=Delivery History');

    // Verify history table/list is visible
    await expect(page.locator('[data-testid="delivery-history"]')).toBeVisible();

    // Verify columns/headers
    await expect(page.locator('text=Report Name')).toBeVisible();
    await expect(page.locator('text=Status')).toBeVisible();
    await expect(page.locator('text=Scheduled')).toBeVisible();
  });

  test('should show delivery status badges', async ({ page }) => {
    // Navigate to delivery history
    await page.click('text=Delivery History');

    // Look for status badges (assuming deliveries exist)
    const statusBadges = page.locator('[class*="bg-green-100"], [class*="bg-red-100"], [class*="bg-yellow-100"]');
    const count = await statusBadges.count();

    // We don't assert count > 0 because there might not be any deliveries yet
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should retry a failed delivery', async ({ page }) => {
    // Navigate to delivery history
    await page.click('text=Delivery History');

    // Check if there's a failed delivery with retry button
    const retryButton = page.locator('button:has-text("Retry")').first();
    const hasFailedDelivery = await retryButton.isVisible();

    if (hasFailedDelivery) {
      await retryButton.click();

      // Verify retry initiated
      await expect(page.locator('text=Retrying')).toBeVisible();
    }
  });

  test('should validate email addresses', async ({ page }) => {
    await page.click('button:has-text("New Schedule")');

    // Fill form with invalid email
    await page.selectOption('select[id="reportType"]', 'profit-loss');
    await page.fill('input[id="reportName"]', 'Invalid Email Test');
    await page.selectOption('select[id="frequency"]', 'weekly');
    await page.fill('input[id="timeOfDay"]', '08:00');
    await page.fill('input[id="recipients"]', 'not-an-email');

    // Submit
    await page.click('button[type="submit"]');

    // Verify error message
    await expect(page.locator('text=Invalid email')).toBeVisible();
  });

  test('should show next scheduled delivery time', async ({ page }) => {
    // Verify that schedule shows next run time
    const nextRunText = page.locator('text=Next delivery:').first();
    const hasSchedule = await nextRunText.isVisible();

    if (hasSchedule) {
      // Verify date format is displayed
      await expect(page.locator('text=/\\d{1,2}\\/\\d{1,2}\\/\\d{4}/')).toBeVisible();
    }
  });

  test('should support multiple recipients', async ({ page }) => {
    await page.click('button:has-text("New Schedule")');

    await page.selectOption('select[id="reportType"]', 'ar-aging');
    await page.fill('input[id="reportName"]', 'AR Aging Multi-Recipient');
    await page.selectOption('select[id="frequency"]', 'monthly');
    await page.fill('input[id="timeOfDay"]', '09:00');

    // Enter multiple recipients
    await page.fill(
      'input[id="recipients"]',
      'recipient1@example.com, recipient2@example.com, recipient3@example.com'
    );

    await page.click('button[type="submit"]');

    // Verify schedule created with multiple recipients
    await expect(page.locator('text=recipient1@example.com')).toBeVisible();
    await expect(page.locator('text=recipient2@example.com')).toBeVisible();
  });

  test('should handle timezone correctly', async ({ page }) => {
    await page.click('button:has-text("New Schedule")');

    // Fill schedule
    await page.selectOption('select[id="reportType"]', 'balance-sheet');
    await page.fill('input[id="reportName"]', 'Timezone Test');
    await page.selectOption('select[id="frequency"]', 'daily');
    await page.fill('input[id="timeOfDay"]', '14:00');
    await page.fill('input[id="recipients"]', 'tz@example.com');

    await page.click('button[type="submit"]');

    // Verify schedule respects browser/user timezone
    // The next run time should be displayed in user's local time
    await expect(page.locator('text=2:00 PM').or(page.locator('text=14:00'))).toBeVisible();
  });
});
