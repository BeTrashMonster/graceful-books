/**
 * Group E End-to-End Tests
 *
 * Tests complete user workflows for all Group E features:
 * - E1: Bank Reconciliation workflow
 * - E2: Setting up recurring transactions
 * - E3: Creating and using invoice templates
 * - E4: Setting up recurring invoices
 * - E5: Categorizing expenses
 * - E6: Managing bills
 * - E7: Viewing audit history
 */

import { test, expect } from '@playwright/test';

test.describe('Group E E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:3000');

    // Login (assuming test user exists)
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');

    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard"]');
  });

  test('E1: Complete bank reconciliation workflow', async ({ page }) => {
    // Navigate to reconciliation page
    await page.click('[data-testid="nav-reconciliation"]');
    await page.waitForSelector('[data-testid="reconciliation-page"]');

    // Select account to reconcile
    await page.click('[data-testid="select-account-button"]');
    await page.click('[data-testid="account-option-checking"]');

    // Upload bank statement (if supported) or manually enter
    await page.click('[data-testid="manual-entry-button"]');

    // Enter statement entry
    await page.fill('[data-testid="statement-description"]', 'Coffee Shop');
    await page.fill('[data-testid="statement-amount"]', '4.50');
    await page.fill('[data-testid="statement-date"]', '2026-01-14');
    await page.click('[data-testid="add-statement-entry"]');

    // Match with transaction
    await page.click('[data-testid="match-transaction-button"]');
    await page.click('[data-testid="transaction-option-0"]');
    await page.click('[data-testid="confirm-match"]');

    // Verify pattern was learned
    const successMessage = await page.locator('[data-testid="success-message"]');
    await expect(successMessage).toContainText('Pattern learned successfully');

    // Verify reconciliation streak updated
    const streakIndicator = await page.locator('[data-testid="reconciliation-streak"]');
    await expect(streakIndicator).toBeVisible();
  });

  test('E2: Set up recurring transaction', async ({ page }) => {
    // Navigate to recurring transactions
    await page.click('[data-testid="nav-recurring"]');
    await page.waitForSelector('[data-testid="recurring-page"]');

    // Create new recurring transaction
    await page.click('[data-testid="new-recurring-transaction"]');

    // Fill in details
    await page.fill('[data-testid="recurring-name"]', 'Monthly Subscription');
    await page.selectOption('[data-testid="frequency-select"]', 'monthly');
    await page.fill('[data-testid="interval"]', '1');
    await page.fill('[data-testid="start-date"]', '2026-01-01');
    await page.fill('[data-testid="transaction-description"]', 'Netflix subscription');
    await page.fill('[data-testid="transaction-amount"]', '15.99');
    await page.selectOption('[data-testid="account-select"]', 'checking');

    // Save recurring transaction
    await page.click('[data-testid="save-recurring"]');

    // Verify success
    const successMessage = await page.locator('[data-testid="success-message"]');
    await expect(successMessage).toContainText('Recurring transaction created');

    // Verify it appears in list
    const recurringList = await page.locator('[data-testid="recurring-list"]');
    await expect(recurringList).toContainText('Monthly Subscription');

    // View upcoming instances
    await page.click('[data-testid="view-upcoming"]');
    const upcomingList = await page.locator('[data-testid="upcoming-list"]');
    await expect(upcomingList).toBeVisible();
  });

  test('E3: Create and use invoice template', async ({ page }) => {
    // Navigate to invoice templates
    await page.click('[data-testid="nav-invoices"]');
    await page.click('[data-testid="nav-templates"]');
    await page.waitForSelector('[data-testid="templates-page"]');

    // Create new template
    await page.click('[data-testid="new-template"]');

    // Fill template details
    await page.fill('[data-testid="template-name"]', 'Consulting Services');

    // Add line item
    await page.click('[data-testid="add-line-item"]');
    await page.fill('[data-testid="item-description-0"]', 'Hourly consulting');
    await page.fill('[data-testid="item-quantity-0"]', '10');
    await page.fill('[data-testid="item-rate-0"]', '150');

    // Save template
    await page.click('[data-testid="save-template"]');

    // Verify success
    const successMessage = await page.locator('[data-testid="success-message"]');
    await expect(successMessage).toContainText('Template created');

    // Use template to create invoice
    await page.click('[data-testid="template-actions"]');
    await page.click('[data-testid="create-invoice-from-template"]');

    // Select customer
    await page.click('[data-testid="customer-select"]');
    await page.click('[data-testid="customer-option-0"]');

    // Verify template fields are populated
    const lineItemDescription = await page.locator('[data-testid="item-description-0"]');
    await expect(lineItemDescription).toHaveValue('Hourly consulting');

    const total = await page.locator('[data-testid="invoice-total"]');
    await expect(total).toContainText('$1,500.00');
  });

  test('E4: Set up recurring invoice', async ({ page }) => {
    // Navigate to recurring invoices
    await page.click('[data-testid="nav-invoices"]');
    await page.click('[data-testid="nav-recurring-invoices"]');
    await page.waitForSelector('[data-testid="recurring-invoices-page"]');

    // Create new recurring invoice
    await page.click('[data-testid="new-recurring-invoice"]');

    // Select template
    await page.selectOption('[data-testid="template-select"]', '0');

    // Select customer
    await page.selectOption('[data-testid="customer-select"]', '0');

    // Set frequency
    await page.selectOption('[data-testid="frequency-select"]', 'monthly');
    await page.fill('[data-testid="interval"]', '1');
    await page.fill('[data-testid="start-date"]', '2026-01-01');

    // Configure options
    await page.check('[data-testid="auto-send-checkbox"]');

    // Save
    await page.click('[data-testid="save-recurring-invoice"]');

    // Verify success
    const successMessage = await page.locator('[data-testid="success-message"]');
    await expect(successMessage).toContainText('Recurring invoice created');

    // Verify it appears in list
    const recurringList = await page.locator('[data-testid="recurring-invoices-list"]');
    await expect(recurringList).toBeVisible();
  });

  test('E5: Categorize expense transaction', async ({ page }) => {
    // Navigate to transactions
    await page.click('[data-testid="nav-transactions"]');
    await page.waitForSelector('[data-testid="transactions-page"]');

    // Click on uncategorized transaction
    await page.click('[data-testid="transaction-row-uncategorized"]');

    // Open category selector
    await page.click('[data-testid="select-category"]');

    // Choose category
    await page.click('[data-testid="category-option-office-supplies"]');

    // Verify category applied
    const categoryBadge = await page.locator('[data-testid="transaction-category"]');
    await expect(categoryBadge).toContainText('Office Supplies');

    // Verify category suggestions appear for similar transactions
    await page.click('[data-testid="transaction-row-similar"]');
    const suggestionBadge = await page.locator('[data-testid="category-suggestion"]');
    await expect(suggestionBadge).toContainText('Office Supplies');
  });

  test('E6: Create and manage bill', async ({ page }) => {
    // Navigate to bills
    await page.click('[data-testid="nav-bills"]');
    await page.waitForSelector('[data-testid="bills-page"]');

    // Create new bill
    await page.click('[data-testid="new-bill"]');

    // Select vendor
    await page.click('[data-testid="vendor-select"]');
    await page.click('[data-testid="vendor-option-0"]');

    // Fill bill details
    await page.fill('[data-testid="bill-number"]', 'BILL-001');
    await page.fill('[data-testid="bill-date"]', '2026-01-14');
    await page.fill('[data-testid="due-date"]', '2026-02-14');

    // Add line item
    await page.click('[data-testid="add-line-item"]');
    await page.fill('[data-testid="item-description-0"]', 'Office supplies');
    await page.fill('[data-testid="item-quantity-0"]', '1');
    await page.fill('[data-testid="item-rate-0"]', '200');

    // Select category
    await page.selectOption('[data-testid="item-category-0"]', 'office-supplies');

    // Save bill
    await page.click('[data-testid="save-bill"]');

    // Verify success
    const successMessage = await page.locator('[data-testid="success-message"]');
    await expect(successMessage).toContainText('Bill created');

    // Mark bill as paid
    await page.click('[data-testid="bill-actions"]');
    await page.click('[data-testid="mark-as-paid"]');

    // Verify status updated
    const statusBadge = await page.locator('[data-testid="bill-status"]');
    await expect(statusBadge).toContainText('Paid');
  });

  test('E7: View audit history', async ({ page }) => {
    // Navigate to audit log
    await page.click('[data-testid="nav-audit"]');
    await page.waitForSelector('[data-testid="audit-page"]');

    // Verify audit entries are visible
    const auditList = await page.locator('[data-testid="audit-list"]');
    await expect(auditList).toBeVisible();

    // Filter by entity type
    await page.selectOption('[data-testid="filter-entity-type"]', 'transaction');

    // Verify filtered results
    const filteredList = await page.locator('[data-testid="audit-list-item"]');
    await expect(filteredList.first()).toBeVisible();

    // View audit entry details
    await page.click('[data-testid="audit-list-item"]');

    // Verify details modal shows
    const detailsModal = await page.locator('[data-testid="audit-details-modal"]');
    await expect(detailsModal).toBeVisible();

    // Verify before/after values are shown
    const beforeValues = await page.locator('[data-testid="before-values"]');
    await expect(beforeValues).toBeVisible();

    const afterValues = await page.locator('[data-testid="after-values"]');
    await expect(afterValues).toBeVisible();

    // Verify user and timestamp are shown
    const userInfo = await page.locator('[data-testid="audit-user"]');
    await expect(userInfo).toBeVisible();

    const timestamp = await page.locator('[data-testid="audit-timestamp"]');
    await expect(timestamp).toBeVisible();
  });

  test('Full Group E workflow: From recurring setup to reconciliation', async ({ page }) => {
    // 1. Set up recurring invoice (E4)
    await page.click('[data-testid="nav-invoices"]');
    await page.click('[data-testid="nav-recurring-invoices"]');
    await page.click('[data-testid="new-recurring-invoice"]');
    await page.selectOption('[data-testid="template-select"]', '0');
    await page.selectOption('[data-testid="customer-select"]', '0');
    await page.selectOption('[data-testid="frequency-select"]', 'monthly');
    await page.click('[data-testid="save-recurring-invoice"]');

    await expect(page.locator('[data-testid="success-message"]')).toContainText('created');

    // 2. Generate invoice from recurring (E3 + E4)
    await page.click('[data-testid="recurring-invoice-actions"]');
    await page.click('[data-testid="generate-now"]');

    await expect(page.locator('[data-testid="success-message"]')).toContainText('Invoice generated');

    // 3. Create bill from vendor (E6)
    await page.click('[data-testid="nav-bills"]');
    await page.click('[data-testid="new-bill"]');
    await page.selectOption('[data-testid="vendor-select"]', '0');
    await page.fill('[data-testid="bill-number"]', 'BILL-TEST');
    await page.fill('[data-testid="bill-date"]', '2026-01-14');
    await page.fill('[data-testid="item-description-0"]', 'Rent');
    await page.fill('[data-testid="item-rate-0"]', '2000');
    await page.selectOption('[data-testid="item-category-0"]', 'rent');
    await page.click('[data-testid="save-bill"]');

    await expect(page.locator('[data-testid="success-message"]')).toContainText('Bill created');

    // 4. Categorize transaction (E5)
    await page.click('[data-testid="nav-transactions"]');
    await page.click('[data-testid="transaction-row-0"]');
    await page.click('[data-testid="select-category"]');
    await page.click('[data-testid="category-option-rent"]');

    await expect(page.locator('[data-testid="transaction-category"]')).toContainText('Rent');

    // 5. Reconcile bank account (E1)
    await page.click('[data-testid="nav-reconciliation"]');
    await page.selectOption('[data-testid="account-select"]', 'checking');
    await page.click('[data-testid="manual-entry-button"]');
    await page.fill('[data-testid="statement-description"]', 'RENT PAYMENT');
    await page.fill('[data-testid="statement-amount"]', '2000');
    await page.fill('[data-testid="statement-date"]', '2026-01-14');
    await page.click('[data-testid="add-statement-entry"]');
    await page.click('[data-testid="match-transaction-button"]');
    await page.click('[data-testid="confirm-match"]');

    await expect(page.locator('[data-testid="success-message"]')).toContainText('Matched successfully');

    // 6. View audit trail (E7)
    await page.click('[data-testid="nav-audit"]');

    // Verify we can see all the actions we just performed
    const auditList = await page.locator('[data-testid="audit-list"]');
    await expect(auditList).toContainText('Recurring invoice');
    await expect(auditList).toContainText('Bill');
    await expect(auditList).toContainText('Transaction');
    await expect(auditList).toContainText('Reconciliation');
  });
});
