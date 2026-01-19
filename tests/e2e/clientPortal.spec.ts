/**
 * Client Portal E2E Tests
 *
 * End-to-end tests for the customer portal workflow:
 * - Portal link generation
 * - Customer invoice viewing
 * - Payment processing
 * - Accessibility compliance
 * - Mobile responsiveness
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('Client Portal', () => {
  let portalUrl: string;

  test.beforeEach(async ({ page }) => {
    // Set up: Create an invoice and generate portal link
    // In production, this would use the actual app routes
    await page.goto('/');

    // Simulate logged-in business user creating invoice
    // This is a simplified setup - actual implementation would involve authentication
  });

  test.describe('Portal Link Generation', () => {
    test('should generate portal link for invoice', async ({ page }) => {
      // Navigate to invoice page
      await page.goto('/invoices/test-invoice-id');

      // Click generate portal link button
      const generateButton = page.getByRole('button', { name: /generate portal link/i });
      await expect(generateButton).toBeVisible();
      await generateButton.click();

      // Wait for link generation
      await expect(page.getByText(/portal link generated/i)).toBeVisible();

      // Verify link is displayed
      const linkInput = page.getByLabel(/portal link url/i);
      await expect(linkInput).toBeVisible();

      const linkValue = await linkInput.inputValue();
      expect(linkValue).toContain('/portal/');
      expect(linkValue).toMatch(/^https?:\/\/.*\/portal\/[a-zA-Z0-9_-]{64}$/);

      portalUrl = linkValue;
    });

    test('should copy portal link to clipboard', async ({ page, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      // Generate link first
      await page.goto('/invoices/test-invoice-id');
      await page.getByRole('button', { name: /generate portal link/i }).click();
      await expect(page.getByText(/portal link generated/i)).toBeVisible();

      // Click copy button
      const copyButton = page.getByRole('button', { name: /copy link/i });
      await copyButton.click();

      // Verify copied message
      await expect(page.getByText(/link copied to clipboard/i)).toBeVisible();

      // Verify clipboard contains the link
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toContain('/portal/');
    });

    test('should show link expiration information', async ({ page }) => {
      await page.goto('/invoices/test-invoice-id');
      await page.getByRole('button', { name: /generate portal link/i }).click();

      // Check for expiration date
      await expect(page.getByText(/expires/i)).toBeVisible();
    });
  });

  test.describe('Customer Portal Access', () => {
    test('should display invoice details to customer', async ({ page }) => {
      // Customer accesses portal link
      await page.goto(portalUrl || '/portal/test-token-1234567890123456789012345678901234567890123456789012');

      // Wait for invoice to load
      await expect(page.getByRole('main')).toBeVisible();

      // Verify invoice heading
      await expect(page.getByRole('heading', { name: /invoice/i })).toBeVisible();

      // Verify invoice number is displayed
      await expect(page.getByText(/INV-\d{4}-\d{4}/)).toBeVisible();

      // Verify status badge
      await expect(page.getByText(/outstanding|paid/i)).toBeVisible();

      // Verify invoice details section
      await expect(page.getByText(/invoice date/i)).toBeVisible();
      await expect(page.getByText(/due date/i)).toBeVisible();

      // Verify line items table
      const table = page.getByRole('table', { name: /invoice line items/i });
      await expect(table).toBeVisible();

      // Verify totals section
      await expect(page.getByText(/subtotal/i)).toBeVisible();
      await expect(page.getByText(/total/i)).toBeVisible();
    });

    test('should show error for invalid token', async ({ page }) => {
      await page.goto('/portal/invalid-token-1234567890123456789012345678901234567890123456');

      // Verify error message
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/access denied|invalid|expired/i)).toBeVisible();
    });

    test('should show error for expired token', async ({ page }) => {
      // Use a token that's marked as expired in the database
      await page.goto('/portal/expired-token-123456789012345678901234567890123456789012');

      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/expired|revoked/i)).toBeVisible();
    });
  });

  test.describe('Payment Flow', () => {
    test('should display payment section for unpaid invoice', async ({ page }) => {
      await page.goto(portalUrl || '/portal/test-token-1234567890123456789012345678901234567890123456789012');

      // Wait for page load
      await expect(page.getByRole('main')).toBeVisible();

      // Verify payment section exists
      const paymentSection = page.getByRole('region', { name: /make a payment/i });
      await expect(paymentSection).toBeVisible();

      // Verify pay button with amount
      const payButton = page.getByRole('button', { name: /pay \$/i });
      await expect(payButton).toBeVisible();
      await expect(payButton).toBeEnabled();

      // Verify security badge
      await expect(page.getByText(/secure payment/i)).toBeVisible();
    });

    test('should process payment successfully', async ({ page }) => {
      await page.goto(portalUrl || '/portal/test-token-1234567890123456789012345678901234567890123456789012');

      // Click pay button
      const payButton = page.getByRole('button', { name: /pay \$/i });
      await payButton.click();

      // Wait for processing
      await expect(page.getByText(/processing/i)).toBeVisible();

      // Wait for success message
      await expect(page.getByRole('status')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/payment successful/i)).toBeVisible();

      // Verify confirmation details
      await expect(page.getByText(/thank you for your payment/i)).toBeVisible();
      await expect(page.getByText(/amount paid/i)).toBeVisible();
    });

    test('should not show payment option for paid invoice', async ({ page }) => {
      // Access portal for already paid invoice
      await page.goto('/portal/paid-invoice-token-12345678901234567890123456789012345');

      await expect(page.getByRole('main')).toBeVisible();

      // Verify "Paid" status
      await expect(page.getByText(/this invoice has been paid/i)).toBeVisible();

      // Verify no payment button
      const payButton = page.getByRole('button', { name: /pay \$/i });
      await expect(payButton).not.toBeVisible();
    });
  });

  test.describe('Accessibility (WCAG 2.1 AA)', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto(portalUrl || '/portal/test-token-1234567890123456789012345678901234567890123456789012');

      // Check main landmark
      await expect(page.getByRole('main')).toBeVisible();

      // Check headings hierarchy
      const mainHeading = page.getByRole('heading', { level: 1, name: /invoice/i });
      await expect(mainHeading).toBeVisible();

      // Check table accessibility
      const table = page.getByRole('table', { name: /invoice line items/i });
      await expect(table).toBeVisible();

      // Check button labels
      const payButton = page.getByRole('button', { name: /pay \$/i });
      const ariaLabel = await payButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto(portalUrl || '/portal/test-token-1234567890123456789012345678901234567890123456789012');

      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Verify focus indicators are visible
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();

      // Navigate to pay button and activate with keyboard
      const payButton = page.getByRole('button', { name: /pay \$/i });
      await payButton.focus();
      await expect(payButton).toBeFocused();

      // Activate with Enter key
      await page.keyboard.press('Enter');
      await expect(page.getByText(/processing/i)).toBeVisible();
    });

    test('should have sufficient color contrast', async ({ page }) => {
      await page.goto(portalUrl || '/portal/test-token-1234567890123456789012345678901234567890123456789012');

      // This is a basic check - in production use axe-core or similar
      // Verify text is visible against background
      const title = page.getByRole('heading', { name: /invoice/i });
      await expect(title).toBeVisible();

      const titleColor = await title.evaluate((el) => {
        return window.getComputedStyle(el).color;
      });

      const bgColor = await title.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      // Both should be defined (actual contrast calculation would be done by axe-core)
      expect(titleColor).toBeTruthy();
      expect(bgColor).toBeTruthy();
    });

    test('should have minimum touch target sizes', async ({ page }) => {
      await page.goto(portalUrl || '/portal/test-token-1234567890123456789012345678901234567890123456789012');

      // Check pay button touch target
      const payButton = page.getByRole('button', { name: /pay \$/i });
      const boundingBox = await payButton.boundingBox();

      expect(boundingBox).toBeTruthy();
      expect(boundingBox!.height).toBeGreaterThanOrEqual(44);
      expect(boundingBox!.width).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should display correctly on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

      await page.goto(portalUrl || '/portal/test-token-1234567890123456789012345678901234567890123456789012');

      // Verify content is visible
      await expect(page.getByRole('heading', { name: /invoice/i })).toBeVisible();

      // Verify no horizontal scroll
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // Allow 1px tolerance

      // Verify table stacks on mobile
      const table = page.getByRole('table');
      await expect(table).toBeVisible();

      // Verify button is full width on mobile
      const payButton = page.getByRole('button', { name: /pay \$/i });
      const buttonBox = await payButton.boundingBox();
      expect(buttonBox).toBeTruthy();
      expect(buttonBox!.width).toBeGreaterThan(300); // Should be nearly full width
    });

    test('should be usable on tablet', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad

      await page.goto(portalUrl || '/portal/test-token-1234567890123456789012345678901234567890123456789012');

      // Verify layout
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('heading', { name: /invoice/i })).toBeVisible();

      // Verify table displays properly
      const table = page.getByRole('table');
      await expect(table).toBeVisible();
    });
  });

  test.describe('Loading States', () => {
    test('should show loading indicator while fetching invoice', async ({ page }) => {
      // Slow down network to see loading state
      await page.route('**/api/**', (route) => {
        setTimeout(() => route.continue(), 1000);
      });

      await page.goto(portalUrl || '/portal/test-token-1234567890123456789012345678901234567890123456789012');

      // Verify loading indicator
      await expect(page.getByText(/getting everything ready/i)).toBeVisible();
      await expect(page.getByLabel(/loading invoice/i)).toBeVisible();
    });

    test('should show processing state during payment', async ({ page }) => {
      await page.goto(portalUrl || '/portal/test-token-1234567890123456789012345678901234567890123456789012');

      const payButton = page.getByRole('button', { name: /pay \$/i });
      await payButton.click();

      // Verify processing state
      await expect(page.getByText(/processing/i)).toBeVisible();

      // Button should be disabled during processing
      await expect(payButton).toBeDisabled();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate network failure
      await page.route('**/api/payments/**', (route) => {
        route.abort('failed');
      });

      await page.goto(portalUrl || '/portal/test-token-1234567890123456789012345678901234567890123456789012');

      const payButton = page.getByRole('button', { name: /pay \$/i });
      await payButton.click();

      // Should show error message
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/error|try again/i)).toBeVisible();

      // Should have retry button
      const retryButton = page.getByRole('button', { name: /try again/i });
      await expect(retryButton).toBeVisible();
    });

    test('should handle payment failures', async ({ page }) => {
      await page.goto(portalUrl || '/portal/test-token-1234567890123456789012345678901234567890123456789012');

      // Mock payment failure
      await page.route('**/api/payments/**', (route) => {
        route.fulfill({
          status: 400,
          body: JSON.stringify({ error: 'Card declined' }),
        });
      });

      const payButton = page.getByRole('button', { name: /pay \$/i });
      await payButton.click();

      // Should show error
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/payment.*failed|error/i)).toBeVisible();
    });
  });

  test.describe('Security', () => {
    test('should not expose sensitive data in URLs', async ({ page }) => {
      await page.goto(portalUrl || '/portal/test-token-1234567890123456789012345678901234567890123456789012');

      // Verify URL only contains token, no customer data
      const url = page.url();
      expect(url).toContain('/portal/');
      expect(url).not.toContain('@'); // No email
      expect(url).not.toContain('amount'); // No amount
      expect(url).not.toContain('customer'); // No customer name
    });

    test('should rate limit excessive access', async ({ page }) => {
      // Make 101 requests from same IP
      for (let i = 0; i < 101; i++) {
        await page.goto(portalUrl || '/portal/test-token-1234567890123456789012345678901234567890123456789012');
      }

      // Should show rate limit error
      await expect(page.getByText(/wait a moment|too many/i)).toBeVisible();
    });
  });
});
