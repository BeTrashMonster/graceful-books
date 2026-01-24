/**
 * CPU Calculator Service Tests
 *
 * Comprehensive test coverage for CPG CPU Calculator Service
 *
 * Test Coverage:
 * - Invoice creation with 0, 1, 2, 5+ variants
 * - CPU calculation accuracy with Decimal.js (no rounding errors)
 * - Cost attribution (direct costs + additional costs)
 * - Reconciliation (units purchased ≠ units received)
 * - Update and delete operations
 * - Historical tracking and trend analysis
 * - Edge cases: zero costs, fractional units, large numbers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import { nanoid } from 'nanoid';
import Database from '../../db/database';
import { CPUCalculatorService } from './cpuCalculator.service';
import type { CPGCategory } from '../../db/schema/cpg.schema';
import { createDefaultCPGCategory } from '../../db/schema/cpg.schema';

describe('CPUCalculatorService', () => {
  let service: CPUCalculatorService;
  let testCompanyId: string;
  let testDeviceId: string;
  let testCategories: CPGCategory[];

  beforeEach(async () => {
    // Initialize service
    service = new CPUCalculatorService();
    testCompanyId = `test-company-${nanoid()}`;
    testDeviceId = `test-device-${nanoid()}`;

    // Create test categories
    const oilCategory: CPGCategory = {
      id: nanoid(),
      ...createDefaultCPGCategory(testCompanyId, 'Oil', testDeviceId, ['8oz', '16oz', '32oz']),
    } as CPGCategory;

    const bottleCategory: CPGCategory = {
      id: nanoid(),
      ...createDefaultCPGCategory(testCompanyId, 'Bottle', testDeviceId, ['8oz', '16oz', '32oz']),
    } as CPGCategory;

    const boxCategory: CPGCategory = {
      id: nanoid(),
      ...createDefaultCPGCategory(testCompanyId, 'Box', testDeviceId, null),
    } as CPGCategory;

    testCategories = [oilCategory, bottleCategory, boxCategory];

    // Add categories to database
    await Database.cpgCategories.bulkAdd(testCategories);
  });

  afterEach(async () => {
    // Clean up test data
    await Database.cpgInvoices
      .where('company_id')
      .equals(testCompanyId)
      .delete();
    await Database.cpgCategories
      .where('company_id')
      .equals(testCompanyId)
      .delete();
  });

  // ============================================================================
  // Invoice Creation Tests
  // ============================================================================

  describe('createInvoice', () => {
    it('should create invoice with single category, no variants', async () => {
      const boxCategory = testCategories.find((c) => c.name === 'Box')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Box Supplier',
        cost_attribution: {
          Box: {
            category_id: boxCategory.id,
            variant: null,
            units_purchased: '100',
            unit_price: '0.50',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      expect(invoice).toBeDefined();
      expect(invoice.id).toBeDefined();
      expect(invoice.company_id).toBe(testCompanyId);
      expect(invoice.total_paid).toBe('50.00'); // 100 × 0.50
      expect(invoice.calculated_cpus).toBeDefined();
      expect(invoice.calculated_cpus!.none).toBe('0.50'); // 50.00 / 100
    });

    it('should create invoice with single category and 2 variants', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Olive Oil Co',
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.50',
            units_received: '100',
          },
          'Oil_16oz': {
            category_id: oilCategory.id,
            variant: '16oz',
            units_purchased: '50',
            unit_price: '4.00',
            units_received: '50',
          },
        },
        device_id: testDeviceId,
      });

      expect(invoice).toBeDefined();
      expect(invoice.total_paid).toBe('450.00'); // (100 × 2.50) + (50 × 4.00) = 250 + 200
      expect(invoice.calculated_cpus!['8oz']).toBe('2.50');
      expect(invoice.calculated_cpus!['16oz']).toBe('4.00');
    });

    it('should create invoice with 5+ variants', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Multi-Size Supplier',
        cost_attribution: {
          'Oil_4oz': {
            category_id: oilCategory.id,
            variant: '4oz',
            units_purchased: '200',
            unit_price: '1.25',
            units_received: '200',
          },
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.50',
            units_received: '100',
          },
          'Oil_16oz': {
            category_id: oilCategory.id,
            variant: '16oz',
            units_purchased: '50',
            unit_price: '4.00',
            units_received: '50',
          },
          'Oil_32oz': {
            category_id: oilCategory.id,
            variant: '32oz',
            units_purchased: '25',
            unit_price: '7.50',
            units_received: '25',
          },
          'Oil_64oz': {
            category_id: oilCategory.id,
            variant: '64oz',
            units_purchased: '10',
            unit_price: '14.00',
            units_received: '10',
          },
        },
        device_id: testDeviceId,
      });

      expect(invoice).toBeDefined();
      expect(Object.keys(invoice.calculated_cpus!).length).toBe(5);
      expect(invoice.calculated_cpus!['4oz']).toBe('1.25');
      expect(invoice.calculated_cpus!['8oz']).toBe('2.50');
      expect(invoice.calculated_cpus!['16oz']).toBe('4.00');
      expect(invoice.calculated_cpus!['32oz']).toBe('7.50');
      expect(invoice.calculated_cpus!['64oz']).toBe('14.00');
    });

    it('should allocate additional costs proportionally', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier',
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.00', // Direct cost: 200
            units_received: '100',
          },
          'Oil_16oz': {
            category_id: oilCategory.id,
            variant: '16oz',
            units_purchased: '100',
            unit_price: '3.00', // Direct cost: 300
            units_received: '100',
          },
        },
        additional_costs: {
          Shipping: '100.00',
        },
        device_id: testDeviceId,
      });

      // Total direct costs: 500
      // Total additional costs: 100
      // 8oz gets 200/500 = 40% of additional costs = 40
      // 16oz gets 300/500 = 60% of additional costs = 60

      // 8oz CPU: (200 + 40) / 100 = 2.40
      // 16oz CPU: (300 + 60) / 100 = 3.60

      expect(invoice.total_paid).toBe('600.00');
      expect(invoice.calculated_cpus!['8oz']).toBe('2.40');
      expect(invoice.calculated_cpus!['16oz']).toBe('3.60');
    });

    it('should handle reconciliation (units purchased ≠ units received)', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier',
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.50',
            units_received: '98', // 2 damaged units
          },
        },
        device_id: testDeviceId,
      });

      // Cost paid: 100 × 2.50 = 250
      // Units received: 98
      // CPU: 250 / 98 = 2.5510... ≈ 2.55

      expect(invoice.total_paid).toBe('250.00');
      expect(invoice.calculated_cpus!['8oz']).toBe('2.55');
    });

    it('should handle multiple additional costs', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier',
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.00',
            units_received: '100',
          },
        },
        additional_costs: {
          Shipping: '50.00',
          'Screen Printing': '30.00',
          Embossing: '20.00',
        },
        device_id: testDeviceId,
      });

      // Direct cost: 200
      // Additional costs: 50 + 30 + 20 = 100
      // Total: 300
      // CPU: 300 / 100 = 3.00

      expect(invoice.total_paid).toBe('300.00');
      expect(invoice.calculated_cpus!['8oz']).toBe('3.00');
    });

    it('should handle zero additional costs', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier',
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.50',
            units_received: '100',
          },
        },
        additional_costs: {},
        device_id: testDeviceId,
      });

      expect(invoice.total_paid).toBe('250.00');
      expect(invoice.calculated_cpus!['8oz']).toBe('2.50');
    });

    it('should handle fractional units', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier',
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100.5',
            unit_price: '2.50',
            units_received: '100.5',
          },
        },
        device_id: testDeviceId,
      });

      // Cost: 100.5 × 2.50 = 251.25
      // CPU: 251.25 / 100.5 = 2.50

      expect(invoice.total_paid).toBe('251.25');
      expect(invoice.calculated_cpus!['8oz']).toBe('2.50');
    });

    it('should handle very large numbers without rounding errors', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier',
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '1000000',
            unit_price: '2.50',
            units_received: '1000000',
          },
        },
        device_id: testDeviceId,
      });

      expect(invoice.total_paid).toBe('2500000.00');
      expect(invoice.calculated_cpus!['8oz']).toBe('2.50');
    });

    it('should handle very small unit costs', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier',
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '0.01',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      expect(invoice.total_paid).toBe('1.00');
      expect(invoice.calculated_cpus!['8oz']).toBe('0.01');
    });

    it('should default units_received to units_purchased if not provided', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier',
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.50',
            // units_received not provided
          },
        },
        device_id: testDeviceId,
      });

      expect(invoice.total_paid).toBe('250.00');
      expect(invoice.calculated_cpus!['8oz']).toBe('2.50');
    });

    it('should throw error if company_id is missing', async () => {
      await expect(
        service.createInvoice({
          company_id: '',
          invoice_date: Date.now(),
          cost_attribution: {},
          device_id: testDeviceId,
        })
      ).rejects.toThrow('company_id is required');
    });

    it('should throw error if invoice_date is missing', async () => {
      await expect(
        service.createInvoice({
          company_id: testCompanyId,
          invoice_date: 0,
          cost_attribution: {},
          device_id: testDeviceId,
        })
      ).rejects.toThrow('invoice_date is required');
    });

    it('should throw error if cost_attribution is empty', async () => {
      await expect(
        service.createInvoice({
          company_id: testCompanyId,
          invoice_date: Date.now(),
          cost_attribution: {},
          device_id: testDeviceId,
        })
      ).rejects.toThrow('cost_attribution is required and must have at least one entry');
    });
  });

  // ============================================================================
  // Invoice Update Tests
  // ============================================================================

  describe('updateInvoice', () => {
    it('should update invoice and recalculate CPUs', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      // Create initial invoice
      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier',
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.50',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      // Update invoice
      const updated = await service.updateInvoice({
        invoice_id: invoice.id,
        company_id: testCompanyId,
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '3.00', // Changed from 2.50
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      expect(updated.total_paid).toBe('300.00');
      expect(updated.calculated_cpus!['8oz']).toBe('3.00');
    });

    it('should update additional costs and recalculate', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier',
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.00',
            units_received: '100',
          },
        },
        additional_costs: {
          Shipping: '50.00',
        },
        device_id: testDeviceId,
      });

      // Update with more additional costs
      const updated = await service.updateInvoice({
        invoice_id: invoice.id,
        company_id: testCompanyId,
        additional_costs: {
          Shipping: '50.00',
          'Screen Printing': '50.00',
        },
        device_id: testDeviceId,
      });

      // Direct: 200, Additional: 100, Total: 300
      // CPU: 300 / 100 = 3.00
      expect(updated.total_paid).toBe('300.00');
      expect(updated.calculated_cpus!['8oz']).toBe('3.00');
    });

    it('should throw error if invoice not found', async () => {
      await expect(
        service.updateInvoice({
          invoice_id: 'non-existent',
          company_id: testCompanyId,
          device_id: testDeviceId,
        })
      ).rejects.toThrow('Invoice not found');
    });

    it('should throw error if company_id mismatch', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.50',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      await expect(
        service.updateInvoice({
          invoice_id: invoice.id,
          company_id: 'different-company',
          device_id: testDeviceId,
        })
      ).rejects.toThrow('Invoice does not belong to this company');
    });
  });

  // ============================================================================
  // Invoice Delete Tests
  // ============================================================================

  describe('deleteInvoice', () => {
    it('should soft delete invoice', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.50',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      await service.deleteInvoice(invoice.id, testCompanyId, testDeviceId);

      const deleted = await Database.cpgInvoices.get(invoice.id);
      expect(deleted).toBeDefined();
      expect(deleted!.deleted_at).not.toBeNull();
      expect(deleted!.active).toBe(false);
    });

    it('should throw error if invoice not found', async () => {
      await expect(
        service.deleteInvoice('non-existent', testCompanyId, testDeviceId)
      ).rejects.toThrow('Invoice not found');
    });

    it('should throw error if already deleted', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.50',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      await service.deleteInvoice(invoice.id, testCompanyId, testDeviceId);

      await expect(
        service.deleteInvoice(invoice.id, testCompanyId, testDeviceId)
      ).rejects.toThrow('Invoice already deleted');
    });
  });

  // ============================================================================
  // CPU Calculation Tests
  // ============================================================================

  describe('calculateCPU', () => {
    it('should return detailed CPU calculation breakdown', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        vendor_name: 'Oil Supplier',
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.00',
            units_received: '100',
          },
        },
        additional_costs: {
          Shipping: '100.00',
        },
        device_id: testDeviceId,
      });

      const result = await service.calculateCPU(invoice.id);

      expect(result.invoice_id).toBe(invoice.id);
      expect(result.total_paid).toBe('300.00');
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].category_name).toBe('Oil');
      expect(result.categories[0].variant).toBe('8oz');
      expect(result.categories[0].direct_cost).toBe('200.00');
      expect(result.categories[0].allocated_additional_costs).toBe('100.00');
      expect(result.categories[0].total_cost).toBe('300.00');
      expect(result.categories[0].cpu).toBe('3.00');
    });

    it('should handle multiple categories with proportional allocation', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;
      const bottleCategory = testCategories.find((c) => c.name === 'Bottle')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.00', // Direct: 200
            units_received: '100',
          },
          'Bottle_8oz': {
            category_id: bottleCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '1.00', // Direct: 100
            units_received: '100',
          },
        },
        additional_costs: {
          Shipping: '90.00',
        },
        device_id: testDeviceId,
      });

      const result = await service.calculateCPU(invoice.id);

      // Total direct: 300
      // Oil gets 200/300 = 66.67% of 90 = 60
      // Bottle gets 100/300 = 33.33% of 90 = 30

      expect(result.categories).toHaveLength(2);

      const oilBreakdown = result.categories.find((c) => c.category_name === 'Oil');
      expect(oilBreakdown?.allocated_additional_costs).toBe('60.00');
      expect(oilBreakdown?.cpu).toBe('2.60'); // (200 + 60) / 100

      const bottleBreakdown = result.categories.find((c) => c.category_name === 'Bottle');
      expect(bottleBreakdown?.allocated_additional_costs).toBe('30.00');
      expect(bottleBreakdown?.cpu).toBe('1.30'); // (100 + 30) / 100
    });
  });

  // ============================================================================
  // Historical Tracking Tests
  // ============================================================================

  describe('getCPUHistory', () => {
    it('should return historical CPU entries', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      // Create multiple invoices over time
      const invoice1 = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now() - 86400000 * 2, // 2 days ago
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.00',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      const invoice2 = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now() - 86400000, // 1 day ago
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.50',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      const history = await service.getCPUHistory(testCompanyId);

      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history.some((h) => h.invoice_id === invoice1.id)).toBe(true);
      expect(history.some((h) => h.invoice_id === invoice2.id)).toBe(true);
    });

    it('should filter history by category', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;
      const bottleCategory = testCategories.find((c) => c.name === 'Bottle')!;

      await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.00',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        cost_attribution: {
          'Bottle_8oz': {
            category_id: bottleCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '1.00',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      const oilHistory = await service.getCPUHistory(testCompanyId, oilCategory.id);

      expect(oilHistory.length).toBeGreaterThanOrEqual(1);
      expect(oilHistory.every((h) => h.variant === '8oz')).toBe(true);
    });
  });

  describe('getCPUTrend', () => {
    it('should calculate CPU trend over time', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;
      const now = Date.now();

      // Create invoices with increasing CPU
      await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: now - 86400000 * 3,
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.00',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: now - 86400000 * 2,
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.50',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: now - 86400000,
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '3.00',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: now,
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '3.50',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      const trend = await service.getCPUTrend(
        testCompanyId,
        now - 86400000 * 4,
        now,
        '8oz'
      );

      expect(trend.data_points.length).toBe(4);
      expect(trend.trend_direction).toBe('increasing');
      expect(parseFloat(trend.min_cpu)).toBe(2.00);
      expect(parseFloat(trend.max_cpu)).toBe(3.50);
    });

    it('should detect decreasing trend', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;
      const now = Date.now();

      // Create invoices with decreasing CPU
      await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: now - 86400000 * 3,
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '4.00',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: now - 86400000 * 2,
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '3.50',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: now - 86400000,
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '3.00',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: now,
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.50',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      const trend = await service.getCPUTrend(
        testCompanyId,
        now - 86400000 * 4,
        now,
        '8oz'
      );

      expect(trend.trend_direction).toBe('decreasing');
    });
  });

  describe('recalculateAllCPUs', () => {
    it('should return snapshot of all current CPUs', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now() - 86400000,
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.00',
            units_received: '100',
          },
          'Oil_16oz': {
            category_id: oilCategory.id,
            variant: '16oz',
            units_purchased: '50',
            unit_price: '4.00',
            units_received: '50',
          },
        },
        device_id: testDeviceId,
      });

      // Newer invoice (should be the current CPU)
      await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '100',
            unit_price: '2.50',
            units_received: '100',
          },
        },
        device_id: testDeviceId,
      });

      const snapshot = await service.recalculateAllCPUs(testCompanyId);

      expect(snapshot.total_invoices_processed).toBe(2);
      expect(snapshot.cpus_by_variant['8oz']).toBe('2.50'); // Latest
      expect(snapshot.cpus_by_variant['16oz']).toBe('4.00');
    });
  });

  // ============================================================================
  // Decimal.js Precision Tests
  // ============================================================================

  describe('Decimal.js precision', () => {
    it('should not have floating-point rounding errors', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      // This would cause rounding errors with native JavaScript floats
      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '3',
            unit_price: '0.1',
            units_received: '3',
          },
        },
        device_id: testDeviceId,
      });

      // Native JS: 0.1 * 3 = 0.30000000000000004
      // Decimal.js: 0.1 * 3 = 0.30
      expect(invoice.total_paid).toBe('0.30');
      expect(invoice.calculated_cpus!['8oz']).toBe('0.10');
    });

    it('should handle complex proportional allocation without errors', async () => {
      const oilCategory = testCategories.find((c) => c.name === 'Oil')!;

      const invoice = await service.createInvoice({
        company_id: testCompanyId,
        invoice_date: Date.now(),
        cost_attribution: {
          'Oil_8oz': {
            category_id: oilCategory.id,
            variant: '8oz',
            units_purchased: '7',
            unit_price: '0.1',
            units_received: '7',
          },
          'Oil_16oz': {
            category_id: oilCategory.id,
            variant: '16oz',
            units_purchased: '3',
            unit_price: '0.2',
            units_received: '3',
          },
        },
        additional_costs: {
          Shipping: '0.1',
        },
        device_id: testDeviceId,
      });

      // All calculations should be precise with Decimal.js
      expect(invoice.total_paid).toBe('1.40'); // 0.7 + 0.6 + 0.1
      expect(invoice.calculated_cpus!['8oz']).toBeDefined();
      expect(invoice.calculated_cpus!['16oz']).toBeDefined();

      // Verify no NaN or Infinity
      expect(isNaN(parseFloat(invoice.calculated_cpus!['8oz']))).toBe(false);
      expect(isFinite(parseFloat(invoice.calculated_cpus!['8oz']))).toBe(true);
    });
  });
});
