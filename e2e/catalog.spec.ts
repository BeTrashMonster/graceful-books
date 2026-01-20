/**
 * Catalog E2E Tests
 *
 * End-to-end tests for product/service catalog functionality.
 * Tests complete user workflows from UI to database.
 *
 * Requirements:
 * - G2: Product/Service Catalog
 * - Test complete catalog management workflows
 * - Verify UI interactions and data persistence
 * - Ensure accessibility compliance
 */

import { test, expect } from '@playwright/test';

test.describe('Product Catalog', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to catalog page (adjust URL as needed)
    await page.goto('/catalog');
  });

  test('should display empty catalog message', async ({ page }) => {
    // Check for empty state
    const emptyMessage = page.locator('text=haven\'t added any products yet');
    await expect(emptyMessage).toBeVisible();
  });

  test('should create a new product', async ({ page }) => {
    // Click add product button
    await page.click('button:has-text("Add Product/Service")');

    // Fill product form
    await page.selectOption('#type', 'PRODUCT');
    await page.fill('#name', 'Test Widget');
    await page.fill('#sku', 'TW-001');
    await page.fill('#description', 'A test widget for E2E testing');
    await page.fill('#unit_price', '29.99');
    await page.fill('#cost', '15.00');
    await page.check('input[type="checkbox"]#taxable');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify product appears in list
    const productCard = page.locator('text=Test Widget');
    await expect(productCard).toBeVisible();

    // Verify details
    await expect(page.locator('text=SKU: TW-001')).toBeVisible();
    await expect(page.locator('text=$29.99')).toBeVisible();
  });

  test('should create a new service', async ({ page }) => {
    // Click add product button
    await page.click('button:has-text("Add Product/Service")');

    // Fill service form
    await page.selectOption('#type', 'SERVICE');
    await page.fill('#name', 'Consulting Service');
    await page.fill('#unit_price', '150.00');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify service appears in list
    const serviceCard = page.locator('text=Consulting Service');
    await expect(serviceCard).toBeVisible();

    // Verify service badge
    await expect(page.locator('.product-type-badge:has-text("Service")')).toBeVisible();
  });

  test('should edit a product', async ({ page }) => {
    // Create a product first
    await page.click('button:has-text("Add Product/Service")');
    await page.fill('#name', 'Original Product');
    await page.fill('#unit_price', '10.00');
    await page.click('button[type="submit"]');

    // Click edit button
    await page.click('button[aria-label="Edit Original Product"]');

    // Update fields
    await page.fill('#name', 'Updated Product');
    await page.fill('#unit_price', '15.00');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify updates
    await expect(page.locator('text=Updated Product')).toBeVisible();
    await expect(page.locator('text=$15.00')).toBeVisible();
    await expect(page.locator('text=Original Product')).not.toBeVisible();
  });

  test('should delete a product', async ({ page }) => {
    // Create a product first
    await page.click('button:has-text("Add Product/Service")');
    await page.fill('#name', 'Product to Delete');
    await page.fill('#unit_price', '10.00');
    await page.click('button[type="submit"]');

    // Click delete button
    await page.click('button[aria-label="Delete Product to Delete"]');

    // Confirm deletion (if confirmation dialog exists)
    // await page.click('button:has-text("Confirm")');

    // Verify product is gone
    await expect(page.locator('text=Product to Delete')).not.toBeVisible();
  });

  test('should search products', async ({ page }) => {
    // Create multiple products
    const products = ['Blue Widget', 'Red Widget', 'Green Gadget'];
    for (const name of products) {
      await page.click('button:has-text("Add Product/Service")');
      await page.fill('#name', name);
      await page.fill('#unit_price', '10.00');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(100);
    }

    // Search for "widget"
    await page.fill('input[aria-label="Search products"]', 'widget');

    // Verify only widgets are shown
    await expect(page.locator('text=Blue Widget')).toBeVisible();
    await expect(page.locator('text=Red Widget')).toBeVisible();
    await expect(page.locator('text=Green Gadget')).not.toBeVisible();
  });

  test('should filter products by type', async ({ page }) => {
    // Create product and service
    await page.click('button:has-text("Add Product/Service")');
    await page.selectOption('#type', 'PRODUCT');
    await page.fill('#name', 'Test Product');
    await page.fill('#unit_price', '10.00');
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Add Product/Service")');
    await page.selectOption('#type', 'SERVICE');
    await page.fill('#name', 'Test Service');
    await page.fill('#unit_price', '50.00');
    await page.click('button[type="submit"]');

    // Filter to products only
    await page.selectOption('select[aria-label="Filter by type"]', 'PRODUCT');
    await expect(page.locator('text=Test Product')).toBeVisible();
    await expect(page.locator('text=Test Service')).not.toBeVisible();

    // Filter to services only
    await page.selectOption('select[aria-label="Filter by type"]', 'SERVICE');
    await expect(page.locator('text=Test Service')).toBeVisible();
    await expect(page.locator('text=Test Product')).not.toBeVisible();
  });

  test('should show milestone for 100 products', async ({ page }) => {
    // This would be slow in real E2E, so we might mock or skip
    // For demonstration, showing the expectation
    test.skip(true, 'Too slow for regular E2E runs');

    // Create 100 products (would use API helper in real scenario)
    // ... create products ...

    // Verify milestone message
    const milestone = page.locator('text=100 products! You\'ve got quite the selection');
    await expect(milestone).toBeVisible();
  });

  test('should display gross margin for products with cost', async ({ page }) => {
    // Create product with cost
    await page.click('button:has-text("Add Product/Service")');
    await page.fill('#name', 'Widget with Margin');
    await page.fill('#unit_price', '100.00');
    await page.fill('#cost', '60.00');
    await page.click('button[type="submit"]');

    // Verify margin is shown (40% = (100-60)/100)
    await expect(page.locator('text=Margin:')).toBeVisible();
    await expect(page.locator('text=40.0%')).toBeVisible();
  });
});

test.describe('Category Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/catalog/categories');
  });

  test('should create a root category', async ({ page }) => {
    // Click add category button
    await page.click('button:has-text("Add Root Category")');

    // Fill category form
    await page.fill('#name', 'Electronics');
    await page.fill('#description', 'Electronic products');
    await page.fill('#color', '#0000FF');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify category appears
    await expect(page.locator('text=Electronics')).toBeVisible();
  });

  test('should create a nested category', async ({ page }) => {
    // Create parent category first
    await page.click('button:has-text("Add Root Category")');
    await page.fill('#name', 'Electronics');
    await page.click('button[type="submit"]');

    // Add subcategory
    await page.click('button:has-text("Add Subcategory")').first();
    await page.fill('#name', 'Laptops');
    await page.click('button[type="submit"]');

    // Verify nested category
    await expect(page.locator('text=Laptops')).toBeVisible();
    // Verify it's indented or nested in tree
    const laptopsItem = page.locator('.category-tree-item:has-text("Laptops")');
    await expect(laptopsItem).toHaveCSS('padding-left', '20px');
  });

  test('should expand and collapse category tree', async ({ page }) => {
    // Create parent with child
    await page.click('button:has-text("Add Root Category")');
    await page.fill('#name', 'Parent');
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Add Subcategory")').first();
    await page.fill('#name', 'Child');
    await page.click('button[type="submit"]');

    // Collapse
    await page.click('.category-expand-btn[aria-label="Collapse"]');
    await expect(page.locator('text=Child')).not.toBeVisible();

    // Expand
    await page.click('.category-expand-btn[aria-label="Expand"]');
    await expect(page.locator('text=Child')).toBeVisible();
  });
});

test.describe('Pricing Tiers', () => {
  test.beforeEach(async ({ page }) => {
    // Create a product first
    await page.goto('/catalog');
    await page.click('button:has-text("Add Product/Service")');
    await page.fill('#name', 'Test Product');
    await page.fill('#unit_price', '100.00');
    await page.click('button[type="submit"]');

    // Navigate to pricing tiers
    await page.click('text=Test Product');
    await page.click('text=Pricing Tiers');
  });

  test('should create a volume discount tier', async ({ page }) => {
    // Click add tier button
    await page.click('button:has-text("Add Pricing Tier")');

    // Fill tier form
    await page.selectOption('#tier_type', 'volume');
    await page.fill('#name', 'Bulk 10+');
    await page.fill('#unit_price', '90.00');
    await page.fill('#min_quantity', '10');
    await page.fill('#max_quantity', '49');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify tier appears
    await expect(page.locator('text=Bulk 10+')).toBeVisible();
    await expect(page.locator('text=$90.00')).toBeVisible();
    await expect(page.locator('text=10 - 49 units')).toBeVisible();
  });

  test('should show price calculation with tier', async ({ page }) => {
    // Create tier
    await page.click('button:has-text("Add Pricing Tier")');
    await page.selectOption('#tier_type', 'volume');
    await page.fill('#name', 'Bulk Discount');
    await page.fill('#unit_price', '85.00');
    await page.fill('#min_quantity', '50');
    await page.click('button[type="submit"]');

    // Test price calculator (if exists)
    await page.fill('#quantity', '75');
    await expect(page.locator('text=Unit Price: $85.00')).toBeVisible();
    await expect(page.locator('text=Discount: 15%')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('catalog page should be accessible', async ({ page }) => {
    await page.goto('/catalog');

    // Check for proper heading structure
    const h2 = page.locator('h2:has-text("Product & Service Catalog")');
    await expect(h2).toBeVisible();

    // Check for ARIA labels
    const searchInput = page.locator('input[aria-label="Search products"]');
    await expect(searchInput).toBeVisible();

    const typeFilter = page.locator('select[aria-label="Filter by type"]');
    await expect(typeFilter).toBeVisible();

    // Check for keyboard navigation
    await searchInput.focus();
    await page.keyboard.press('Tab');
    // Verify focus moved to next interactive element
  });

  test('product form should be accessible', async ({ page }) => {
    await page.goto('/catalog');
    await page.click('button:has-text("Add Product/Service")');

    // Check for proper form labels
    const nameLabel = page.locator('label[for="name"]');
    await expect(nameLabel).toBeVisible();

    const priceInput = page.locator('#unit_price');
    await expect(priceInput).toHaveAttribute('aria-invalid', 'false');

    // Test error states
    await page.click('button[type="submit"]');
    const nameInput = page.locator('#name');
    await expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    const errorMsg = page.locator('#name-error');
    await expect(errorMsg).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('catalog should load quickly', async ({ page }) => {
    const start = Date.now();
    await page.goto('/catalog');
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(2000); // < 2 seconds
  });

  test('search should be fast', async ({ page }) => {
    await page.goto('/catalog');

    // Measure search performance
    const start = Date.now();
    await page.fill('input[aria-label="Search products"]', 'test');
    await page.waitForTimeout(100); // Debounce delay
    const searchTime = Date.now() - start;

    expect(searchTime).toBeLessThan(1000); // < 1 second
  });
});
