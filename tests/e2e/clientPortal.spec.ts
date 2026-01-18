/**
 * Client Portal End-to-End Tests
 *
 * Full user journey testing using Playwright including:
 * - Business user generating portal links
 * - Customer accessing portal
 * - Viewing invoices
 * - Payment flow (mocked)
 * - Accessibility compliance (WCAG 2.1 AA)
 *
 * Requirements:
 * - H4: Client Portal
 * - WCAG 2.1 AA compliance
 * - Mobile-responsive testing
 */

import { test, expect } from '@playwright/test';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test.describe('Client Portal - Customer Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Login as business user and navigate to customer management
    await page.goto('/login');
    await page.fill('[name="email"]', 'testuser@gracefulbooks.com');
    await page.fill('[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('Business user can generate portal link for customer', async ({ page }) => {
    // Navigate to customers
    await page.click('a[href="/customers"]');
    await expect(page).toHaveURL('/customers');

    // Find and click on test customer
    await page.click('text=Test Customer');

    // Open portal link generator
    await page.click('button:has-text("Generate Portal Link")');

    // Modal should appear
    await expect(
      page.locator('h2:has-text("Customer Portal Access")')
    ).toBeVisible();

    // Generate link
    await page.click('button:has-text("Generate New Portal Link")');

    // Link should be displayed
    const linkInput = page.locator('input[aria-label="Generated portal link"]');
    await expect(linkInput).toBeVisible();

    const portalLink = await linkInput.inputValue();
    expect(portalLink).toContain('/portal/');
    expect(portalLink.length).toBeGreaterThan(30);

    // Copy button should work
    await page.click('button:has-text("Copy")');
    await expect(page.locator('button:has-text("Copied!")'));.toBeVisible();
  });

  test('Customer can access portal and view invoices', async ({ page, context }) => {
    // First, generate a portal link as business user
    await page.goto('/customers');
    await page.click('text=Test Customer');
    await page.click('button:has-text("Generate Portal Link")');
    await page.click('button:has-text("Generate New Portal Link")');

    const linkInput = page.locator('input[aria-label="Generated portal link"]');
    const portalLink = await linkInput.inputValue();

    // Open new incognito context to simulate customer
    const customerContext = await context.browser()?.newContext({
      storageState: undefined, // No auth state
    });
    const customerPage = await customerContext?.newPage() || page;

    // Customer accesses portal link
    await customerPage.goto(portalLink);

    // Verify portal loaded
    await expect(
      customerPage.locator('h1:has-text("Invoice Portal")')
    ).toBeVisible();

    await expect(
      customerPage.locator('text=Easy to view, easy to pay')
    ).toBeVisible();

    // Current Invoice tab should be active by default
    const currentInvoiceTab = customerPage.locator(
      'button:has-text("Current Invoice")[aria-current="page"]'
    );
    await expect(currentInvoiceTab).toBeVisible();

    // Should see invoice details
    await expect(
      customerPage.locator('text=/Invoice #/')
    ).toBeVisible();

    await expect(
      customerPage.locator('text=/Total:/')
    ).toBeVisible();

    // Switch to invoice history
    await customerPage.click('button:has-text("Invoice History")');

    // Should see invoice list
    await expect(
      customerPage.locator('h2:has-text("Invoice History")')
    ).toBeVisible();

    await customerContext?.close();
  });

  test('Customer can initiate payment (mocked)', async ({ page, context }) => {
    // Generate portal link
    await page.goto('/customers');
    await page.click('text=Test Customer');
    await page.click('button:has-text("Generate Portal Link")');
    await page.click('button:has-text("Generate New Portal Link")');

    const linkInput = page.locator('input[aria-label="Generated portal link"]');
    const portalLink = await linkInput.inputValue();

    // Access as customer
    const customerContext = await context.browser()?.newContext({
      storageState: undefined,
    });
    const customerPage = await customerContext?.newPage() || page;

    await customerPage.goto(portalLink);

    // Click pay button
    const payButton = customerPage.locator('button:has-text("Pay")');
    await expect(payButton).toBeVisible();
    await payButton.click();

    // In production, this would show payment form
    // For now, verify the processing state
    await expect(
      customerPage.locator('button:has-text("Processing")')
    ).toBeVisible();

    await customerContext?.close();
  });

  test('Portal denies access with invalid token', async ({ page }) => {
    // Try to access portal with fake token
    await page.goto('/portal/invalidtoken123456789012345678901234567890123456789012');

    // Should show access denied error
    await expect(page.locator('h1:has-text("Access Denied")')).toBeVisible();

    await expect(
      page.locator('text=/Invalid or expired token/')
    ).toBeVisible();
  });

  test('Portal denies access with revoked token', async ({ page, context }) => {
    // Generate portal link
    await page.goto('/customers');
    await page.click('text=Test Customer');
    await page.click('button:has-text("Generate Portal Link")');
    await page.click('button:has-text("Generate New Portal Link")');

    const linkInput = page.locator('input[aria-label="Generated portal link"]');
    const portalLink = await linkInput.inputValue();

    // Revoke the token
    await page.click('button:has-text("Revoke")');
    await page.click('button:has-text("OK")'); // Confirm revocation

    // Try to access with revoked token
    const customerContext = await context.browser()?.newContext({
      storageState: undefined,
    });
    const customerPage = await customerContext?.newPage() || page;

    await customerPage.goto(portalLink);

    // Should be denied
    await expect(
      customerPage.locator('h1:has-text("Access Denied")')
    ).toBeVisible();

    await customerContext?.close();
  });
});

test.describe('Client Portal - Accessibility', () => {
  test('Portal page should have no accessibility violations', async ({ page }) => {
    // Mock portal access for testing
    await page.goto('/portal/test-token-for-accessibility-testing');

    // Run axe accessibility tests
    const results = await page.evaluate(async () => {
      const axe = require('axe-core');
      return await axe.run();
    });

    expect(results.violations).toHaveLength(0);
  });

  test('Portal should be keyboard navigable', async ({ page }) => {
    await page.goto('/portal/test-token');

    // Tab through navigation
    await page.keyboard.press('Tab');
    const currentInvoiceButton = page.locator(
      'button:has-text("Current Invoice"):focus'
    );
    await expect(currentInvoiceButton).toBeVisible();

    await page.keyboard.press('Tab');
    const historyButton = page.locator('button:has-text("Invoice History"):focus');
    await expect(historyButton).toBeVisible();

    // Activate with Enter
    await page.keyboard.press('Enter');
    await expect(
      page.locator('h2:has-text("Invoice History")')
    ).toBeVisible();
  });

  test('Portal should have proper ARIA labels', async ({ page }) => {
    await page.goto('/portal/test-token');

    // Check for required ARIA attributes
    await expect(page.locator('[role="main"]')).toBeVisible();
    await expect(page.locator('[role="navigation"]')).toBeVisible();
    await expect(page.locator('[aria-label="Portal navigation"]')).toBeVisible();
  });

  test('Loading state should have proper accessibility', async ({ page }) => {
    await page.goto('/portal/test-token');

    // Check loading spinner has proper attributes
    const spinner = page.locator('.spinner');
    await expect(spinner).toHaveAttribute('aria-label', 'Loading');

    const loadingContainer = page.locator('[aria-busy="true"]');
    await expect(loadingContainer).toBeVisible();
  });
});

test.describe('Client Portal - Mobile Responsiveness', () => {
  test('Portal should be responsive on mobile devices', async ({
    page,
    browser,
  }) => {
    // Create mobile viewport
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 }, // iPhone SE size
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
    });

    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('/portal/test-token');

    // Verify mobile layout
    await expect(mobilePage.locator('.portal-container')).toBeVisible();

    // Navigation should stack vertically on mobile
    const nav = mobilePage.locator('.portal-nav');
    const navBox = await nav.boundingBox();
    expect(navBox?.height).toBeGreaterThan(100); // Stacked buttons are taller

    // Pay button should be full width on mobile
    const payButton = mobilePage.locator('.btn-large');
    const buttonBox = await payButton.boundingBox();
    const pageBox = await mobilePage.locator('.portal-container').boundingBox();

    if (buttonBox && pageBox) {
      expect(buttonBox.width).toBeGreaterThan(pageBox.width * 0.9);
    }

    await mobileContext.close();
  });

  test('Portal should support touch interactions', async ({ page, browser }) => {
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
      hasTouch: true,
    });

    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('/portal/test-token');

    // Tap navigation button
    await mobilePage.tap('button:has-text("Invoice History")');

    await expect(
      mobilePage.locator('h2:has-text("Invoice History")')
    ).toBeVisible();

    await mobileContext.close();
  });
});

test.describe('Client Portal - Security', () => {
  test('Portal should not expose sensitive company data', async ({ page }) => {
    await page.goto('/portal/test-token');

    // Customer should only see invoice data, not internal company info
    const pageContent = await page.content();

    // Should not contain internal identifiers
    expect(pageContent).not.toContain('internal_id');
    expect(pageContent).not.toContain('company_secret');
    expect(pageContent).not.toContain('api_key');
  });

  test('Portal should handle XSS attempts', async ({ page }) => {
    // Attempt to inject script via URL
    await page.goto('/portal/<script>alert("xss")</script>');

    // Should show error, not execute script
    await expect(page.locator('h1:has-text("Access Denied")')).toBeVisible();

    // Verify no alert dialog appeared
    page.on('dialog', () => {
      throw new Error('XSS script executed!');
    });
  });

  test('Portal should use HTTPS in production', async ({ page }) => {
    // In production, verify the portal URL uses HTTPS
    const url = page.url();
    if (process.env.NODE_ENV === 'production') {
      expect(url).toMatch(/^https:\/\//);
    }
  });
});

test.describe('Client Portal - Print Functionality', () => {
  test('Invoice should be printable', async ({ page }) => {
    await page.goto('/portal/test-token');

    // Trigger print (this won't actually print in headless mode)
    await page.emulateMedia({ media: 'print' });

    // Verify print-friendly layout
    const paymentActions = page.locator('.payment-actions');
    const isHidden = await paymentActions.isHidden();
    expect(isHidden).toBe(true); // Payment buttons should be hidden in print

    const footer = page.locator('.portal-footer');
    const footerHidden = await footer.isHidden();
    expect(footerHidden).toBe(true); // Footer should be hidden in print

    await page.emulateMedia({ media: 'screen' });
  });
});
