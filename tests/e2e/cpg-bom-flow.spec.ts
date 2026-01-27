/**
 * CPG BOM System E2E Tests
 *
 * End-to-end tests for the Bill of Materials (BOM) system workflow:
 * - Fresh user onboarding with Getting Started card
 * - Complete BOM flow (categories → products → recipes → invoices → CPU)
 * - Validation scenarios (duplicates, negative values, required fields)
 * - Missing data handling
 * - Edit/Delete operations
 * - Accessibility compliance
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('CPG BOM System', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/');

    // For demo/testing purposes, assume authentication handled or mock login
    // In production, this would involve actual authentication flow
  });

  test.describe('Scenario 1: Fresh User Onboarding', () => {
    test('should guide user through complete setup flow', async ({ page }) => {
      // Navigate to CPG dashboard
      await page.goto('/cpg');

      // Verify Getting Started card is visible
      const gettingStartedCard = page.getByRole('region', { name: /getting started/i });
      await expect(gettingStartedCard).toBeVisible();

      // Step 1: Add First Category
      await expect(page.getByText(/add first category/i)).toBeVisible();
      const addCategoryButton = page.getByRole('button', { name: /add first category/i });
      await addCategoryButton.click();

      // Fill out category form
      await page.getByLabel(/category name/i).fill('Oil');
      await page.getByLabel(/unit of measure/i).selectOption('oz');
      await page.getByRole('button', { name: /save/i }).click();

      // Verify step 1 is checked
      await expect(page.getByText(/add first category/i).locator('..')).toHaveAttribute(
        'data-complete',
        'true'
      );

      // Step 2: Add First Product
      await expect(page.getByText(/add first product/i)).toBeVisible();
      const addProductButton = page.getByRole('button', { name: /add first product/i });
      await addProductButton.click();

      // Fill out product form
      await page.getByLabel(/product name/i).fill('1oz Body Oil');
      await page.getByLabel(/sku/i).fill('BO-1OZ');
      await page.getByLabel(/msrp/i).fill('10.00');
      await page.getByRole('button', { name: /save/i }).click();

      // Verify step 2 is checked
      await expect(page.getByText(/add first product/i).locator('..')).toHaveAttribute(
        'data-complete',
        'true'
      );

      // Step 3: Create First Recipe
      await expect(page.getByText(/create first recipe/i)).toBeVisible();
      const createRecipeButton = page.getByRole('button', { name: /create first recipe/i });
      await createRecipeButton.click();

      // Add component to recipe
      await page.getByRole('button', { name: /add component/i }).click();
      await page.getByLabel(/category/i).selectOption('Oil');
      await page.getByLabel(/quantity/i).fill('1.00');
      await page.getByRole('button', { name: /save component/i }).click();

      // Save recipe
      await page.getByRole('button', { name: /save recipe/i }).click();

      // Verify step 3 is checked
      await expect(page.getByText(/create first recipe/i).locator('..')).toHaveAttribute(
        'data-complete',
        'true'
      );

      // Step 4: Add First Invoice
      await expect(page.getByText(/add first invoice/i)).toBeVisible();
      const addInvoiceButton = page.getByRole('button', { name: /add first invoice/i });
      await addInvoiceButton.click();

      // Fill out invoice form
      await page.getByLabel(/invoice date/i).fill(new Date().toISOString().split('T')[0]);
      await page.getByLabel(/vendor name/i).fill('ABC Oils');
      await page.getByLabel(/total invoice amount/i).fill('504.00');

      // Add line item
      await page.getByLabel(/category/i).selectOption('Oil');
      await page.getByLabel(/units purchased/i).fill('1200');
      await page.getByLabel(/unit price/i).fill('0.42');

      // Save invoice
      await page.getByRole('button', { name: /save/i }).click();

      // Verify CPU calculation works
      await expect(page.getByText(/\$0\.42/i)).toBeVisible();
    });
  });

  test.describe('Scenario 2: Complete BOM Flow', () => {
    test('should create all demo data and verify CPU calculations', async ({ page }) => {
      // Navigate to CPG dashboard
      await page.goto('/cpg');

      // Create categories
      await createCategory(page, 'Oil - bulk', 'oz');
      await createCategory(page, 'Bottle', 'each', ['1oz', '5oz']);
      await createCategory(page, 'Box', 'each', ['1oz', '5oz']);
      await createCategory(page, 'Label', 'each');

      // Create finished products
      await createProduct(page, {
        name: '1oz Body Oil',
        sku: 'BO-1OZ',
        msrp: '10.00',
      });

      await createProduct(page, {
        name: '5oz Body Oil',
        sku: 'BO-5OZ',
        msrp: '25.00',
      });

      // Create recipes
      await page.goto('/cpg/products');
      await page.getByText(/1oz body oil/i).click();
      await page.getByRole('button', { name: /edit recipe/i }).click();

      // Add components for 1oz Body Oil
      await addRecipeComponent(page, 'Oil - bulk', null, '1.00');
      await addRecipeComponent(page, 'Bottle', '1oz', '1');
      await addRecipeComponent(page, 'Box', '1oz', '1');
      await addRecipeComponent(page, 'Label', null, '1');

      await page.getByRole('button', { name: /save recipe/i }).click();

      // Enter invoices
      await createInvoice(page, {
        invoiceNumber: 'INV-001',
        vendor: 'ABC Oils',
        total: '504.00',
        lineItems: [
          { category: 'Oil - bulk', variant: null, units: '1200', price: '0.42' },
        ],
      });

      await createInvoice(page, {
        invoiceNumber: 'INV-002',
        vendor: 'XYZ Packaging',
        total: '50.00',
        lineItems: [
          { category: 'Bottle', variant: '1oz', units: '100', price: '0.50' },
        ],
      });

      await createInvoice(page, {
        invoiceNumber: 'INV-003',
        vendor: 'XYZ Packaging',
        total: '30.00',
        lineItems: [
          { category: 'Bottle', variant: '5oz', units: '50', price: '0.60' },
        ],
      });

      await createInvoice(page, {
        invoiceNumber: 'INV-004',
        vendor: 'BoxCo',
        total: '43.00',
        lineItems: [
          { category: 'Box', variant: '1oz', units: '100', price: '0.25' },
          { category: 'Box', variant: '5oz', units: '50', price: '0.36' },
        ],
      });

      await createInvoice(page, {
        invoiceNumber: 'INV-005',
        vendor: 'PrintPro',
        total: '50.00',
        lineItems: [
          { category: 'Label', variant: null, units: '500', price: '0.10' },
        ],
      });

      // Navigate to CPU Tracker
      await page.goto('/cpg/cpu-tracker');

      // Verify finished product CPUs
      await expect(page.getByText(/1oz body oil/i)).toBeVisible();
      await expect(page.getByText(/\$1\.27/i)).toBeVisible(); // Expected CPU

      await expect(page.getByText(/5oz body oil/i)).toBeVisible();
      await expect(page.getByText(/\$3\.16/i)).toBeVisible(); // Expected CPU

      // Verify breakdown
      await page.getByRole('button', { name: /show breakdown/i }).first().click();
      await expect(page.getByText(/oil.*\$0\.42/i)).toBeVisible();
      await expect(page.getByText(/bottle.*\$0\.50/i)).toBeVisible();
      await expect(page.getByText(/box.*\$0\.25/i)).toBeVisible();
      await expect(page.getByText(/label.*\$0\.10/i)).toBeVisible();
    });
  });

  test.describe('Scenario 3: Validation Tests', () => {
    test('should prevent duplicate category names', async ({ page }) => {
      await page.goto('/cpg/categories');

      // Create first category
      await createCategory(page, 'Oil', 'oz');

      // Try to create duplicate
      await page.getByRole('button', { name: /add category/i }).click();
      await page.getByLabel(/category name/i).fill('Oil');
      await page.getByLabel(/unit of measure/i).selectOption('oz');
      await page.getByRole('button', { name: /save/i }).click();

      // Verify error message
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/category.*already exists/i)).toBeVisible();
    });

    test('should prevent duplicate SKUs', async ({ page }) => {
      await page.goto('/cpg/products');

      // Create first product
      await createProduct(page, {
        name: 'Product 1',
        sku: 'PROD-001',
        msrp: '10.00',
      });

      // Try to create duplicate SKU
      await page.getByRole('button', { name: /add product/i }).click();
      await page.getByLabel(/product name/i).fill('Product 2');
      await page.getByLabel(/sku/i).fill('PROD-001'); // Duplicate SKU
      await page.getByLabel(/msrp/i).fill('15.00');
      await page.getByRole('button', { name: /save/i }).click();

      // Verify error message
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/sku.*already in use/i)).toBeVisible();
    });

    test('should prevent negative quantities in recipes', async ({ page }) => {
      await page.goto('/cpg/products');
      await page.getByText(/1oz body oil/i).click();
      await page.getByRole('button', { name: /edit recipe/i }).click();

      // Try to add component with negative quantity
      await page.getByRole('button', { name: /add component/i }).click();
      await page.getByLabel(/category/i).selectOption('Oil');
      await page.getByLabel(/quantity/i).fill('-1.00');
      await page.getByRole('button', { name: /save component/i }).click();

      // Verify error message
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/quantity must be greater than 0/i)).toBeVisible();
    });

    test('should prevent duplicate components in recipe', async ({ page }) => {
      await page.goto('/cpg/products');
      await page.getByText(/1oz body oil/i).click();
      await page.getByRole('button', { name: /edit recipe/i }).click();

      // Add first component
      await addRecipeComponent(page, 'Oil', null, '1.00');

      // Try to add same component again
      await page.getByRole('button', { name: /add component/i }).click();
      await page.getByLabel(/category/i).selectOption('Oil');
      await page.getByLabel(/quantity/i).fill('2.00');
      await page.getByRole('button', { name: /save component/i }).click();

      // Verify error message
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/already in the recipe/i)).toBeVisible();
    });

    test('should prevent deleting category used in recipe', async ({ page }) => {
      // Create category and use it in a recipe
      await createCategory(page, 'Test Oil', 'oz');
      await createProduct(page, { name: 'Test Product', sku: 'TEST-001', msrp: '10.00' });

      await page.goto('/cpg/products');
      await page.getByText(/test product/i).click();
      await page.getByRole('button', { name: /edit recipe/i }).click();
      await addRecipeComponent(page, 'Test Oil', null, '1.00');
      await page.getByRole('button', { name: /save recipe/i }).click();

      // Try to delete category
      await page.goto('/cpg/categories');
      await page.getByText(/test oil/i).locator('..').getByRole('button', { name: /delete/i }).click();

      // Verify error message
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/used in.*recipe/i)).toBeVisible();
    });

    test('should validate invoice line items balance to total', async ({ page }) => {
      await page.goto('/cpg/invoices');
      await page.getByRole('button', { name: /add invoice/i }).click();

      // Set total
      await page.getByLabel(/total invoice amount/i).fill('500.00');

      // Add line items that don't match
      await page.getByLabel(/category/i).selectOption('Oil');
      await page.getByLabel(/units purchased/i).fill('1000');
      await page.getByLabel(/unit price/i).fill('0.42'); // Total: $420.00

      // Try to save
      await page.getByRole('button', { name: /save/i }).click();

      // Verify error message
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/don't match invoice total/i)).toBeVisible();
      await expect(page.getByText(/remaining.*\$80\.00/i)).toBeVisible();
    });
  });

  test.describe('Scenario 4: Missing Data Handling', () => {
    test('should show incomplete status when component has no invoice', async ({ page }) => {
      // Create category
      await createCategory(page, 'Missing Oil', 'oz');

      // Create product with recipe using this category
      await createProduct(page, {
        name: 'Incomplete Product',
        sku: 'INCOMPLETE-001',
        msrp: '10.00',
      });

      await page.goto('/cpg/products');
      await page.getByText(/incomplete product/i).click();
      await page.getByRole('button', { name: /edit recipe/i }).click();
      await addRecipeComponent(page, 'Missing Oil', null, '1.00');
      await page.getByRole('button', { name: /save recipe/i }).click();

      // Navigate to CPU tracker
      await page.goto('/cpg/cpu-tracker');

      // Verify incomplete status
      await expect(page.getByText(/incomplete product/i)).toBeVisible();
      await expect(page.getByText(/incomplete/i)).toBeVisible();
      await expect(page.getByRole('img', { name: /warning/i })).toBeVisible();

      // View breakdown
      await page.getByRole('button', { name: /show breakdown/i }).click();
      await expect(page.getByText(/awaiting cost data/i)).toBeVisible();
      await expect(page.getByText(/missing oil/i)).toBeVisible();

      // Add invoice for missing component
      await createInvoice(page, {
        invoiceNumber: 'INV-FIX',
        vendor: 'New Vendor',
        total: '100.00',
        lineItems: [
          { category: 'Missing Oil', variant: null, units: '100', price: '1.00' },
        ],
      });

      // Navigate back to CPU tracker
      await page.goto('/cpg/cpu-tracker');

      // Verify CPU is now complete
      await expect(page.getByText(/incomplete product/i)).toBeVisible();
      await expect(page.getByText(/\$1\.00/i)).toBeVisible(); // CPU should show
      await expect(page.getByText(/incomplete/i)).not.toBeVisible();
    });
  });

  test.describe('Scenario 5: Edit/Delete Flow', () => {
    test('should allow editing category name without breaking recipes', async ({ page }) => {
      // Create category and recipe
      await createCategory(page, 'Original Name', 'oz');
      await createProduct(page, { name: 'Test Product', sku: 'TEST-002', msrp: '10.00' });

      await page.goto('/cpg/products');
      await page.getByText(/test product/i).click();
      await page.getByRole('button', { name: /edit recipe/i }).click();
      await addRecipeComponent(page, 'Original Name', null, '1.00');
      await page.getByRole('button', { name: /save recipe/i }).click();

      // Edit category name
      await page.goto('/cpg/categories');
      await page.getByText(/original name/i).locator('..').getByRole('button', { name: /edit/i }).click();
      await page.getByLabel(/category name/i).fill('Updated Name');
      await page.getByRole('button', { name: /save/i }).click();

      // Verify recipe still works
      await page.goto('/cpg/products');
      await page.getByText(/test product/i).click();
      await page.getByRole('button', { name: /edit recipe/i }).click();
      await expect(page.getByText(/updated name/i)).toBeVisible();
    });

    test('should allow deleting product without recipes', async ({ page }) => {
      // Create product without recipe
      await createProduct(page, {
        name: 'Empty Product',
        sku: 'EMPTY-001',
        msrp: '10.00',
      });

      // Delete product
      await page.goto('/cpg/products');
      await page.getByText(/empty product/i).locator('..').getByRole('button', { name: /delete/i }).click();

      // Confirm deletion
      await page.getByRole('button', { name: /confirm/i }).click();

      // Verify product is gone
      await expect(page.getByText(/empty product/i)).not.toBeVisible();
    });

    test('should recalculate CPU when recipe quantity changes', async ({ page }) => {
      // Create full setup
      await createCategory(page, 'Variable Oil', 'oz');
      await createInvoice(page, {
        invoiceNumber: 'INV-VAR',
        vendor: 'Vendor',
        total: '100.00',
        lineItems: [
          { category: 'Variable Oil', variant: null, units: '100', price: '1.00' },
        ],
      });

      await createProduct(page, {
        name: 'Variable Product',
        sku: 'VAR-001',
        msrp: '10.00',
      });

      await page.goto('/cpg/products');
      await page.getByText(/variable product/i).click();
      await page.getByRole('button', { name: /edit recipe/i }).click();
      await addRecipeComponent(page, 'Variable Oil', null, '1.00');
      await page.getByRole('button', { name: /save recipe/i }).click();

      // Check initial CPU
      await page.goto('/cpg/cpu-tracker');
      await expect(page.getByText(/\$1\.00/i)).toBeVisible();

      // Edit recipe to change quantity
      await page.goto('/cpg/products');
      await page.getByText(/variable product/i).click();
      await page.getByRole('button', { name: /edit recipe/i }).click();
      await page.getByLabel(/quantity/i).fill('2.00');
      await page.getByRole('button', { name: /save/i }).click();

      // Verify CPU updated
      await page.goto('/cpg/cpu-tracker');
      await expect(page.getByText(/\$2\.00/i)).toBeVisible(); // 2 oz × $1.00/oz
    });
  });

  test.describe('Accessibility (WCAG 2.1 AA)', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/cpg');

      // Check main landmarks
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('navigation')).toBeVisible();

      // Check headings hierarchy
      const mainHeading = page.getByRole('heading', { level: 1 });
      await expect(mainHeading).toBeVisible();
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/cpg');

      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Verify focus indicators are visible
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();

      // Navigate to button and activate with keyboard
      const addButton = page.getByRole('button', { name: /add category/i });
      await addButton.focus();
      await expect(addButton).toBeFocused();

      // Activate with Enter key
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

async function createCategory(
  page: Page,
  name: string,
  unit: string,
  variants?: string[]
): Promise<void> {
  await page.goto('/cpg/categories');
  await page.getByRole('button', { name: /add category/i }).click();
  await page.getByLabel(/category name/i).fill(name);
  await page.getByLabel(/unit of measure/i).selectOption(unit);

  if (variants) {
    for (const variant of variants) {
      await page.getByRole('button', { name: /add variant/i }).click();
      await page.getByLabel(/variant name/i).last().fill(variant);
    }
  }

  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText(name)).toBeVisible();
}

async function createProduct(
  page: Page,
  product: { name: string; sku: string; msrp: string }
): Promise<void> {
  await page.goto('/cpg/products');
  await page.getByRole('button', { name: /add product/i }).click();
  await page.getByLabel(/product name/i).fill(product.name);
  await page.getByLabel(/sku/i).fill(product.sku);
  await page.getByLabel(/msrp/i).fill(product.msrp);
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText(product.name)).toBeVisible();
}

async function addRecipeComponent(
  page: Page,
  category: string,
  variant: string | null,
  quantity: string
): Promise<void> {
  await page.getByRole('button', { name: /add component/i }).click();
  await page.getByLabel(/category/i).selectOption(category);

  if (variant) {
    await page.getByLabel(/variant/i).selectOption(variant);
  }

  await page.getByLabel(/quantity/i).fill(quantity);
  await page.getByRole('button', { name: /save component/i }).click();
}

async function createInvoice(
  page: Page,
  invoice: {
    invoiceNumber: string;
    vendor: string;
    total: string;
    lineItems: Array<{
      category: string;
      variant: string | null;
      units: string;
      price: string;
    }>;
  }
): Promise<void> {
  await page.goto('/cpg/invoices');
  await page.getByRole('button', { name: /add invoice/i }).click();

  await page.getByLabel(/invoice number/i).fill(invoice.invoiceNumber);
  await page.getByLabel(/vendor name/i).fill(invoice.vendor);
  await page.getByLabel(/total invoice amount/i).fill(invoice.total);

  for (const [index, item] of invoice.lineItems.entries()) {
    if (index > 0) {
      await page.getByRole('button', { name: /add line item/i }).click();
    }

    const lineItemSection = page.locator('.line-item').nth(index);
    await lineItemSection.getByLabel(/category/i).selectOption(item.category);

    if (item.variant) {
      await lineItemSection.getByLabel(/variant/i).selectOption(item.variant);
    }

    await lineItemSection.getByLabel(/units purchased/i).fill(item.units);
    await lineItemSection.getByLabel(/unit price/i).fill(item.price);
  }

  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText(invoice.invoiceNumber)).toBeVisible();
}
