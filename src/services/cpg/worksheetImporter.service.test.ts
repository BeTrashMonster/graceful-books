/**
 * Comprehensive tests for CPG Worksheet Importer Service
 *
 * Tests the complete "seed to sale" data flow:
 * - Categories with variants
 * - Finished products with MSRP/SKU
 * - Recipes linking products to categories
 * - Invoices with line items
 * - Shipping & Handling distribution
 * - Unit conversions (weight ↔ volume)
 * - Personal items exclusion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateWorksheetData,
  reviewWorksheetData,
  importWorksheetData,
  WorksheetData,
} from './worksheetImporter.service';

// Mock the database
vi.mock('../../db/database', () => ({
  db: {
    cpgCategories: {
      add: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn().mockResolvedValue([]),
    },
    cpgFinishedProducts: {
      add: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn().mockResolvedValue([]),
    },
    cpgRecipes: {
      add: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn().mockResolvedValue([]),
    },
    cpgInvoices: {
      add: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn().mockResolvedValue([]),
    },
    cpgUnitConversions: {
      add: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock the CPU Calculator Service
vi.mock('./cpuCalculator.service', () => {
  return {
    CPUCalculatorService: class MockCPUCalculatorService {
      createInvoice = vi.fn().mockResolvedValue({ id: 'mock-invoice-id' });
    },
  };
});

// Mock generateId to return predictable IDs
let idCounter = 0;
vi.mock('../../utils/device', () => ({
  generateId: vi.fn(() => `uuid-${++idCounter}`),
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CPG Worksheet Importer Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idCounter = 0;
  });

  // ============================================================================
  // Test Data Fixtures
  // ============================================================================

  const createValidWorksheetData = (): WorksheetData => ({
    version: '1.0.0',
    created_at: '2024-01-15T10:30:00.000Z',
    categories: [
      {
        id: 'temp-1-abc123',
        name: 'Flour',
        variants: ['All Purpose', 'Whole Wheat'],
        sort_order: 1,
      },
      {
        id: 'temp-2-def456',
        name: 'Sugar',
        variants: ['White', 'Brown'],
        sort_order: 2,
      },
      {
        id: 'temp-3-ghi789',
        name: 'Shipping & Handling',
        variants: [],
        sort_order: 99,
        is_distribution_category: true,
      },
    ],
    finished_products: [
      {
        id: 'temp-10-prod1',
        name: 'Chocolate Chip Cookie',
        msrp: '3.50',
        sku: 'CCC-001',
      },
      {
        id: 'temp-11-prod2',
        name: 'Sugar Cookie',
        msrp: '2.75',
        sku: '',
      },
    ],
    recipes: [
      {
        product_id: 'temp-10-prod1',
        items: [
          {
            category_id: 'temp-1-abc123',
            variant: 'All Purpose',
            quantity: '0.5',
            unit: 'cup',
          },
          {
            category_id: 'temp-2-def456',
            variant: 'White',
            quantity: '0.25',
            unit: 'cup',
          },
        ],
      },
      {
        product_id: 'temp-11-prod2',
        items: [
          {
            category_id: 'temp-1-abc123',
            variant: 'All Purpose',
            quantity: '0.75',
            unit: 'cup',
          },
        ],
      },
    ],
    invoices: [
      {
        id: 'temp-100-inv1',
        vendor_name: 'Costco',
        invoice_date: '2024-01-10',
        invoice_number: 'INV-001',
        invoice_total: '50.00',
        items: [
          {
            category_id: 'temp-1-abc123',
            variant: 'All Purpose',
            quantity: '25',
            unit: 'lb',
            unit_cost: '1.20',
            line_total: '30.00',
          },
          {
            category_id: 'temp-2-def456',
            variant: 'White',
            quantity: '10',
            unit: 'lb',
            unit_cost: '1.50',
            line_total: '15.00',
          },
          {
            category_id: 'temp-3-ghi789',
            quantity: '1',
            unit: 'each',
            unit_cost: '5.00',
            line_total: '5.00',
            distribution_method: 'weighted',
          },
        ],
        notes: 'Monthly bulk order',
      },
    ],
    unit_conversions: [
      {
        category_id: 'temp-1-abc123',
        variant: 'All Purpose',
        from_unit: 'lb',
        to_unit: 'cup',
        conversion_factor: '3.5',
      },
      {
        category_id: 'temp-2-def456',
        variant: 'White',
        from_unit: 'lb',
        to_unit: 'cup',
        conversion_factor: '2.25',
      },
    ],
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('validateWorksheetData', () => {
    it('should pass validation for valid worksheet data', () => {
      const data = createValidWorksheetData();
      const errors = validateWorksheetData(data, 'company-123');
      expect(errors).toHaveLength(0);
    });

    it('should reject missing company ID', () => {
      const data = createValidWorksheetData();
      const errors = validateWorksheetData(data, '');
      expect(errors).toContain('Invalid company ID. User must be logged in.');
    });

    it('should reject invalid version', () => {
      const data = createValidWorksheetData();
      data.version = '2.0.0';
      const errors = validateWorksheetData(data, 'company-123');
      expect(errors).toContain('Unsupported worksheet version. Expected 1.0.0');
    });

    it('should reject invalid temp IDs', () => {
      const data = createValidWorksheetData();
      data.categories[0].id = 'invalid-id';
      const errors = validateWorksheetData(data, 'company-123');
      expect(errors.some(e => e.includes('Invalid category ID'))).toBe(true);
    });

    it('should reject categories without names', () => {
      const data = createValidWorksheetData();
      data.categories[0].name = '';
      const errors = validateWorksheetData(data, 'company-123');
      expect(errors.some(e => e.includes('has no name'))).toBe(true);
    });

    it('should reject products with invalid MSRP', () => {
      const data = createValidWorksheetData();
      data.finished_products[0].msrp = 'invalid';
      const errors = validateWorksheetData(data, 'company-123');
      expect(errors.some(e => e.includes('invalid MSRP'))).toBe(true);
    });

    it('should reject recipes referencing non-existent products', () => {
      const data = createValidWorksheetData();
      data.recipes[0].product_id = 'temp-999-missing';
      const errors = validateWorksheetData(data, 'company-123');
      expect(errors.some(e => e.includes('missing product'))).toBe(true);
    });

    it('should reject recipes referencing non-existent categories', () => {
      const data = createValidWorksheetData();
      data.recipes[0].items[0].category_id = 'temp-999-missing';
      const errors = validateWorksheetData(data, 'company-123');
      expect(errors.some(e => e.includes('missing category'))).toBe(true);
    });

    it('should reject invoices without vendor names', () => {
      const data = createValidWorksheetData();
      data.invoices[0].vendor_name = '';
      const errors = validateWorksheetData(data, 'company-123');
      expect(errors.some(e => e.includes('no vendor name'))).toBe(true);
    });

    it('should reject invoices with invalid dates', () => {
      const data = createValidWorksheetData();
      data.invoices[0].invoice_date = 'not-a-date';
      const errors = validateWorksheetData(data, 'company-123');
      expect(errors.some(e => e.includes('invalid date format'))).toBe(true);
    });

    it('should reject invoice items with invalid quantities', () => {
      const data = createValidWorksheetData();
      data.invoices[0].items[0].quantity = 'abc';
      const errors = validateWorksheetData(data, 'company-123');
      expect(errors.some(e => e.includes('invalid quantity'))).toBe(true);
    });

    it('should allow personal items without category validation', () => {
      const data = createValidWorksheetData();
      data.invoices[0].items.push({
        category_id: '__personal__',
        quantity: '1',
        unit: 'each',
        unit_cost: '10.00',
        line_total: '10.00',
        is_personal: true,
      });
      // Update invoice total to include personal item
      data.invoices[0].invoice_total = '60.00';
      const errors = validateWorksheetData(data, 'company-123');
      // Should not complain about missing category for personal items
      expect(errors.some(e => e.includes('__personal__'))).toBe(false);
    });
  });

  // ============================================================================
  // Review Tests
  // ============================================================================

  describe('reviewWorksheetData', () => {
    it('should report products without recipes', () => {
      const data = createValidWorksheetData();
      data.finished_products.push({
        id: 'temp-12-prod3',
        name: 'Brownie',
        msrp: '4.00',
        sku: 'BRW-001',
      });
      // No recipe for Brownie

      const result = reviewWorksheetData(data);
      expect(result.warnings.some(w =>
        w.title === 'Products without recipes' && w.message.includes('Brownie')
      )).toBe(true);
    });

    it('should report categories without invoices', () => {
      const data = createValidWorksheetData();
      data.categories.push({
        id: 'temp-4-jkl012',
        name: 'Butter',
        variants: [],
        sort_order: 3,
      });
      // No invoice items for Butter

      const result = reviewWorksheetData(data);
      expect(result.warnings.some(w =>
        w.title === 'Categories without invoices' && w.message.includes('Butter')
      )).toBe(true);
    });

    it('should report recipe ingredients without costs', () => {
      const data = createValidWorksheetData();
      // Add a new category used in recipe but not in invoices
      data.categories.push({
        id: 'temp-4-jkl012',
        name: 'Eggs',
        variants: [],
        sort_order: 3,
      });
      data.recipes[0].items.push({
        category_id: 'temp-4-jkl012',
        quantity: '2',
        unit: 'each',
      });

      const result = reviewWorksheetData(data);
      expect(result.warnings.some(w =>
        w.title === 'Recipe ingredients without costs' && w.message.includes('Eggs')
      )).toBe(true);
    });

    it('should give positive feedback when everything is connected', () => {
      const data = createValidWorksheetData();
      const result = reviewWorksheetData(data);

      // Should have the "Looking good!" message
      expect(result.warnings.some(w => w.title === 'Looking good!')).toBe(true);
    });

    it('should provide accurate summary counts', () => {
      const data = createValidWorksheetData();
      const result = reviewWorksheetData(data);

      expect(result.summary.categories).toBe(3);
      expect(result.summary.products).toBe(2);
      expect(result.summary.recipes).toBe(2);
      expect(result.summary.invoices).toBe(1);
    });
  });

  // ============================================================================
  // Import Tests
  // ============================================================================

  describe('importWorksheetData', () => {
    it('should successfully import valid worksheet data', async () => {
      const data = createValidWorksheetData();
      const result = await importWorksheetData(data, 'company-123', 'device-abc');

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.counts.categories).toBe(3);
      expect(result.counts.products).toBe(2);
      expect(result.counts.recipes).toBe(3); // 2 items for first recipe, 1 for second
      expect(result.counts.invoices).toBe(1);
      expect(result.counts.unit_conversions).toBe(2);
    });

    it('should fail import without company ID', async () => {
      const data = createValidWorksheetData();
      const result = await importWorksheetData(data, '', 'device-abc');

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('No company ID'))).toBe(true);
    });

    it('should map temp IDs to real UUIDs', async () => {
      const data = createValidWorksheetData();
      const result = await importWorksheetData(data, 'company-123', 'device-abc');

      expect(result.success).toBe(true);
      expect(result.idMap).toBeDefined();
      expect(result.idMap?.size).toBeGreaterThan(0);

      // Check that temp IDs were mapped
      expect(result.idMap?.has('temp-1-abc123')).toBe(true);
      expect(result.idMap?.get('temp-1-abc123')).toMatch(/^uuid-/);
    });

    it('should preserve S+H distribution category flag', async () => {
      const { db } = await import('../../db/database');
      const data = createValidWorksheetData();
      await importWorksheetData(data, 'company-123', 'device-abc');

      // Check that cpgCategories.add was called with is_distribution_category
      const addCalls = vi.mocked(db.cpgCategories.add).mock.calls;
      const shCategory = addCalls.find(call =>
        (call[0] as any).name === 'Shipping & Handling'
      );
      expect(shCategory).toBeDefined();
      expect((shCategory![0] as any).is_distribution_category).toBe(true);
    });

    it('should preserve category variants', async () => {
      const { db } = await import('../../db/database');
      const data = createValidWorksheetData();
      await importWorksheetData(data, 'company-123', 'device-abc');

      const addCalls = vi.mocked(db.cpgCategories.add).mock.calls;
      const flourCategory = addCalls.find(call =>
        (call[0] as any).name === 'Flour'
      );
      expect(flourCategory).toBeDefined();
      expect((flourCategory![0] as any).variants).toEqual(['All Purpose', 'Whole Wheat']);
    });

    it('should handle empty SKU by converting to null', async () => {
      const { db } = await import('../../db/database');
      const data = createValidWorksheetData();
      await importWorksheetData(data, 'company-123', 'device-abc');

      const addCalls = vi.mocked(db.cpgFinishedProducts.add).mock.calls;
      const sugarCookie = addCalls.find(call =>
        (call[0] as any).name === 'Sugar Cookie'
      );
      expect(sugarCookie).toBeDefined();
      expect((sugarCookie![0] as any).sku).toBeNull();
    });

    it('should import unit conversions with correct mapping', async () => {
      const { db } = await import('../../db/database');
      const data = createValidWorksheetData();
      const result = await importWorksheetData(data, 'company-123', 'device-abc');

      expect(result.counts.unit_conversions).toBe(2);

      const addCalls = vi.mocked(db.cpgUnitConversions.add).mock.calls;
      expect(addCalls).toHaveLength(2);

      // Verify conversion factor is parsed correctly
      const flourConversion = addCalls.find(call =>
        (call[0] as any).conversion_factor === 3.5
      );
      expect(flourConversion).toBeDefined();
      expect((flourConversion![0] as any).from_unit).toBe('lb');
      expect((flourConversion![0] as any).to_unit).toBe('cup');
    });

    it('should reject invoices that do not balance', async () => {
      const data = createValidWorksheetData();
      // Set invoice total that doesn't match line items
      data.invoices[0].invoice_total = '100.00'; // Actual is $50.00

      const result = await importWorksheetData(data, 'company-123', 'device-abc');

      // Should have an error about invoice not balancing
      expect(result.errors.some(e => e.includes("don't match invoice total"))).toBe(true);
      expect(result.counts.invoices).toBe(0);
    });

    it('should include recipe unit of measurement', async () => {
      const { db } = await import('../../db/database');
      const data = createValidWorksheetData();
      await importWorksheetData(data, 'company-123', 'device-abc');

      const addCalls = vi.mocked(db.cpgRecipes.add).mock.calls;
      expect(addCalls.length).toBeGreaterThan(0);

      // All recipes should have unit_of_measurement
      addCalls.forEach(call => {
        expect((call[0] as any).unit_of_measurement).toBeDefined();
        expect((call[0] as any).unit_of_measurement).not.toBe('');
      });
    });

    it('should handle personal items in invoices', async () => {
      const data = createValidWorksheetData();
      data.invoices[0].items.push({
        category_id: '__personal__',
        quantity: '1',
        unit: 'each',
        unit_cost: '10.00',
        line_total: '10.00',
        is_personal: true,
      });
      data.invoices[0].invoice_total = '60.00';

      const result = await importWorksheetData(data, 'company-123', 'device-abc');

      expect(result.success).toBe(true);
      expect(result.counts.invoices).toBe(1);
    });

    it('should handle invoice with S+H distribution method', async () => {
      const data = createValidWorksheetData();
      const result = await importWorksheetData(data, 'company-123', 'device-abc');

      expect(result.success).toBe(true);
      // The S+H item in the invoice has distribution_method: 'weighted'
      // This should be preserved in the cost_attribution
    });

    it('should handle worksheet without unit conversions', async () => {
      const data = createValidWorksheetData();
      delete data.unit_conversions;

      const result = await importWorksheetData(data, 'company-123', 'device-abc');

      expect(result.success).toBe(true);
      expect(result.counts.unit_conversions).toBe(0);
    });

    it('should create proper version vectors', async () => {
      const { db } = await import('../../db/database');
      const data = createValidWorksheetData();
      await importWorksheetData(data, 'company-123', 'device-xyz');

      // Check categories have version vectors
      const catCalls = vi.mocked(db.cpgCategories.add).mock.calls;
      catCalls.forEach(call => {
        expect((call[0] as any).version_vector).toEqual({ 'device-xyz': 1 });
      });
    });
  });

  // ============================================================================
  // Edge Case Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle categories with no variants', async () => {
      const { db } = await import('../../db/database');
      const data = createValidWorksheetData();
      data.categories.push({
        id: 'temp-5-mno345',
        name: 'Salt',
        variants: [],
        sort_order: 4,
      });

      const result = await importWorksheetData(data, 'company-123', 'device-abc');
      expect(result.success).toBe(true);

      const addCalls = vi.mocked(db.cpgCategories.add).mock.calls;
      const saltCategory = addCalls.find(call =>
        (call[0] as any).name === 'Salt'
      );
      expect(saltCategory).toBeDefined();
      expect((saltCategory![0] as any).variants).toBeNull();
    });

    it('should handle recipes with no variant specified', async () => {
      const { db } = await import('../../db/database');
      const data = createValidWorksheetData();
      data.recipes[0].items.push({
        category_id: 'temp-1-abc123',
        // No variant specified
        quantity: '0.1',
        unit: 'cup',
      });

      const result = await importWorksheetData(data, 'company-123', 'device-abc');
      expect(result.success).toBe(true);

      const addCalls = vi.mocked(db.cpgRecipes.add).mock.calls;
      const recipeWithoutVariant = addCalls.find(call =>
        (call[0] as any).variant === null && (call[0] as any).quantity === '0.1'
      );
      expect(recipeWithoutVariant).toBeDefined();
    });

    it('should handle very small quantities', async () => {
      const data = createValidWorksheetData();
      data.recipes[0].items[0].quantity = '0.001';

      const result = await importWorksheetData(data, 'company-123', 'device-abc');
      expect(result.success).toBe(true);
    });

    it('should handle invoice with optional invoice_number missing', async () => {
      const data = createValidWorksheetData();
      delete data.invoices[0].invoice_number;

      const result = await importWorksheetData(data, 'company-123', 'device-abc');
      expect(result.success).toBe(true);
      expect(result.counts.invoices).toBe(1);
    });

    it('should handle invoice without invoice_total (no balance check)', async () => {
      const data = createValidWorksheetData();
      delete data.invoices[0].invoice_total;

      const result = await importWorksheetData(data, 'company-123', 'device-abc');
      expect(result.success).toBe(true);
      expect(result.counts.invoices).toBe(1);
    });
  });

  // ============================================================================
  // Integration-style Tests (Full Flow)
  // ============================================================================

  describe('Full Data Flow (Seed to Sale)', () => {
    it('should import a complete worksheet with all data types', async () => {
      const data: WorksheetData = {
        version: '1.0.0',
        created_at: new Date().toISOString(),
        categories: [
          { id: 'temp-1-cat1', name: 'Ingredient A', variants: ['Small', 'Large'], sort_order: 1 },
          { id: 'temp-2-cat2', name: 'Ingredient B', variants: [], sort_order: 2 },
          { id: 'temp-3-cat3', name: 'Packaging', variants: ['Box', 'Bag'], sort_order: 3 },
          { id: 'temp-4-sh', name: 'Shipping', variants: [], sort_order: 99, is_distribution_category: true },
        ],
        finished_products: [
          { id: 'temp-10-prod1', name: 'Product Alpha', msrp: '10.00', sku: 'ALPHA-1' },
          { id: 'temp-11-prod2', name: 'Product Beta', msrp: '15.00', sku: 'BETA-1' },
        ],
        recipes: [
          {
            product_id: 'temp-10-prod1',
            items: [
              { category_id: 'temp-1-cat1', variant: 'Small', quantity: '2', unit: 'oz' },
              { category_id: 'temp-2-cat2', quantity: '1', unit: 'each' },
              { category_id: 'temp-3-cat3', variant: 'Box', quantity: '1', unit: 'each' },
            ],
          },
          {
            product_id: 'temp-11-prod2',
            items: [
              { category_id: 'temp-1-cat1', variant: 'Large', quantity: '4', unit: 'oz' },
              { category_id: 'temp-3-cat3', variant: 'Bag', quantity: '1', unit: 'each' },
            ],
          },
        ],
        invoices: [
          {
            id: 'temp-100-inv1',
            vendor_name: 'Supplier One',
            invoice_date: '2024-01-15',
            invoice_number: 'SO-001',
            invoice_total: '190.00', // 50 + 75 + 50 + 15 = 190
            items: [
              { category_id: 'temp-1-cat1', variant: 'Small', quantity: '100', unit: 'oz', unit_cost: '0.50', line_total: '50.00' },
              { category_id: 'temp-1-cat1', variant: 'Large', quantity: '100', unit: 'oz', unit_cost: '0.75', line_total: '75.00' },
              { category_id: 'temp-2-cat2', quantity: '50', unit: 'each', unit_cost: '1.00', line_total: '50.00' },
              { category_id: 'temp-4-sh', quantity: '1', unit: 'each', unit_cost: '15.00', line_total: '15.00', distribution_method: 'weighted' },
            ],
            notes: 'First bulk order',
          },
          {
            id: 'temp-101-inv2',
            vendor_name: 'Packaging Co',
            invoice_date: '2024-01-16',
            invoice_total: '30.00',
            items: [
              { category_id: 'temp-3-cat3', variant: 'Box', quantity: '100', unit: 'each', unit_cost: '0.15', line_total: '15.00' },
              { category_id: 'temp-3-cat3', variant: 'Bag', quantity: '100', unit: 'each', unit_cost: '0.10', line_total: '10.00' },
              { category_id: 'temp-4-sh', quantity: '1', unit: 'each', unit_cost: '5.00', line_total: '5.00', distribution_method: 'equal' },
            ],
          },
        ],
        unit_conversions: [
          { category_id: 'temp-1-cat1', variant: 'Small', from_unit: 'lb', to_unit: 'oz', conversion_factor: '16' },
          { category_id: 'temp-1-cat1', variant: 'Large', from_unit: 'lb', to_unit: 'oz', conversion_factor: '16' },
        ],
      };

      const result = await importWorksheetData(data, 'company-full-test', 'device-full');

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Verify all counts
      expect(result.counts.categories).toBe(4);
      expect(result.counts.products).toBe(2);
      expect(result.counts.recipes).toBe(5); // 3 for Alpha, 2 for Beta
      expect(result.counts.invoices).toBe(2);
      expect(result.counts.unit_conversions).toBe(2);

      // Verify ID mapping includes all items
      expect(result.idMap?.size).toBeGreaterThanOrEqual(6); // 4 categories + 2 products
    });

    it('should handle realistic bakery worksheet', async () => {
      const data: WorksheetData = {
        version: '1.0.0',
        created_at: new Date().toISOString(),
        categories: [
          { id: 'temp-1-flour', name: 'Flour', variants: ['AP', 'Bread', 'Cake'], sort_order: 1 },
          { id: 'temp-2-sugar', name: 'Sugar', variants: ['White', 'Brown', 'Powdered'], sort_order: 2 },
          { id: 'temp-3-butter', name: 'Butter', variants: ['Salted', 'Unsalted'], sort_order: 3 },
          { id: 'temp-4-eggs', name: 'Eggs', variants: [], sort_order: 4 },
          { id: 'temp-5-vanilla', name: 'Vanilla Extract', variants: [], sort_order: 5 },
          { id: 'temp-6-chocchip', name: 'Chocolate Chips', variants: ['Semi-Sweet', 'Dark', 'White'], sort_order: 6 },
          { id: 'temp-7-box', name: 'Cookie Box', variants: ['4-pack', '12-pack'], sort_order: 7 },
          { id: 'temp-99-sh', name: 'S+H', variants: [], sort_order: 99, is_distribution_category: true },
        ],
        finished_products: [
          { id: 'temp-101-ccc', name: 'Chocolate Chip Cookie (4-pack)', msrp: '8.00', sku: 'CCC-4' },
          { id: 'temp-102-ccc12', name: 'Chocolate Chip Cookie (12-pack)', msrp: '20.00', sku: 'CCC-12' },
          { id: 'temp-103-sugar', name: 'Sugar Cookie (4-pack)', msrp: '7.00', sku: 'SUG-4' },
        ],
        recipes: [
          {
            product_id: 'temp-101-ccc',
            items: [
              { category_id: 'temp-1-flour', variant: 'AP', quantity: '0.5', unit: 'cup' },
              { category_id: 'temp-2-sugar', variant: 'Brown', quantity: '0.25', unit: 'cup' },
              { category_id: 'temp-3-butter', variant: 'Unsalted', quantity: '0.25', unit: 'cup' },
              { category_id: 'temp-4-eggs', quantity: '0.5', unit: 'each' },
              { category_id: 'temp-5-vanilla', quantity: '0.5', unit: 'tsp' },
              { category_id: 'temp-6-chocchip', variant: 'Semi-Sweet', quantity: '0.5', unit: 'cup' },
              { category_id: 'temp-7-box', variant: '4-pack', quantity: '1', unit: 'each' },
            ],
          },
          {
            product_id: 'temp-102-ccc12',
            items: [
              { category_id: 'temp-1-flour', variant: 'AP', quantity: '1.5', unit: 'cup' },
              { category_id: 'temp-2-sugar', variant: 'Brown', quantity: '0.75', unit: 'cup' },
              { category_id: 'temp-3-butter', variant: 'Unsalted', quantity: '0.75', unit: 'cup' },
              { category_id: 'temp-4-eggs', quantity: '1.5', unit: 'each' },
              { category_id: 'temp-5-vanilla', quantity: '1.5', unit: 'tsp' },
              { category_id: 'temp-6-chocchip', variant: 'Semi-Sweet', quantity: '1.5', unit: 'cup' },
              { category_id: 'temp-7-box', variant: '12-pack', quantity: '1', unit: 'each' },
            ],
          },
        ],
        invoices: [
          {
            id: 'temp-inv1',
            vendor_name: 'Restaurant Depot',
            invoice_date: '2024-01-10',
            invoice_number: 'RD-12345',
            invoice_total: '150.00',
            items: [
              { category_id: 'temp-1-flour', variant: 'AP', quantity: '50', unit: 'lb', unit_cost: '0.80', line_total: '40.00' },
              { category_id: 'temp-2-sugar', variant: 'Brown', quantity: '25', unit: 'lb', unit_cost: '1.20', line_total: '30.00' },
              { category_id: 'temp-3-butter', variant: 'Unsalted', quantity: '20', unit: 'lb', unit_cost: '3.00', line_total: '60.00' },
              { category_id: 'temp-99-sh', quantity: '1', unit: 'each', unit_cost: '20.00', line_total: '20.00', distribution_method: 'weighted' },
            ],
          },
        ],
        unit_conversions: [
          { category_id: 'temp-1-flour', variant: 'AP', from_unit: 'lb', to_unit: 'cup', conversion_factor: '3.5' },
          { category_id: 'temp-2-sugar', variant: 'Brown', from_unit: 'lb', to_unit: 'cup', conversion_factor: '2.25' },
          { category_id: 'temp-3-butter', variant: 'Unsalted', from_unit: 'lb', to_unit: 'cup', conversion_factor: '2' },
        ],
      };

      const result = await importWorksheetData(data, 'bakery-co', 'device-bakery');

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.counts.categories).toBe(8);
      expect(result.counts.products).toBe(3);
      expect(result.counts.recipes).toBe(14); // 7 items for CCC-4 + 7 items for CCC-12 (Sugar Cookie has no recipe)
      expect(result.counts.invoices).toBe(1);
      expect(result.counts.unit_conversions).toBe(3);
    });
  });
});
