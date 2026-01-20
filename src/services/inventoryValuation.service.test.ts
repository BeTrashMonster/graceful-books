/**
 * Inventory Valuation Service Tests
 *
 * Tests for FIFO, LIFO, and Weighted Average inventory valuation methods.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import {
  createInventoryItem,
  processPurchase,
  processSale,
  processAdjustment,
  createStockTake,
  addStockTakeItem,
  submitStockTake,
  approveStockTake,
  previewMethodChange,
  changeValuationMethod,
  getInventoryValuation,
} from './inventoryValuation.service';
import { ValuationMethod, InventoryTransactionType, StockTakeStatus } from '../db/schema/inventoryValuation.schema';
import { db } from '../db/database';

// Mock dependencies
vi.mock('../utils/device', () => ({
  getDeviceId: () => 'test-device-123',
}));

vi.mock('../utils/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

describe('InventoryValuationService', () => {
  const companyId = 'test-company-123';
  const productId = 'test-product-123';

  beforeEach(async () => {
    // Clear all inventory-related tables before each test
    await db.inventoryItems.clear();
    await db.inventoryLayers.clear();
    await db.inventoryTransactions.clear();
    await db.stockTakes.clear();
    await db.stockTakeItems.clear();
    await db.valuationMethodChanges.clear();
  });

  describe('createInventoryItem', () => {
    it('should create a new inventory item with FIFO method', async () => {
      const item = await createInventoryItem(
        companyId,
        productId,
        ValuationMethod.FIFO,
        {
          reorderPoint: '10.0000',
          reorderQuantity: '50.0000',
          location: 'Warehouse A',
        }
      );

      expect(item).toBeDefined();
      expect(item.company_id).toBe(companyId);
      expect(item.product_id).toBe(productId);
      expect(item.valuation_method).toBe(ValuationMethod.FIFO);
      expect(item.quantity_on_hand).toBe('0.0000');
      expect(item.unit_cost).toBe('0.00');
      expect(item.total_value).toBe('0.00');
      expect(item.reorder_point).toBe('10.0000');
      expect(item.reorder_quantity).toBe('50.0000');
      expect(item.location).toBe('Warehouse A');
      expect(item.active).toBe(true);
    });

    it('should prevent duplicate inventory items for same product', async () => {
      await createInventoryItem(companyId, productId, ValuationMethod.FIFO);

      await expect(
        createInventoryItem(companyId, productId, ValuationMethod.LIFO)
      ).rejects.toThrow('Inventory tracking already enabled for this product');
    });
  });

  describe('processPurchase', () => {
    it('should process purchase and create inventory layer for FIFO', async () => {
      const item = await createInventoryItem(companyId, productId, ValuationMethod.FIFO);

      const result = await processPurchase(
        companyId,
        item.id,
        'txn-001',
        Date.now(),
        '100.0000',
        '10.00'
      );

      expect(result.inventoryTransaction).toBeDefined();
      expect(result.inventoryTransaction.quantity).toBe('100.0000');
      expect(result.inventoryTransaction.unit_cost).toBe('10.00');
      expect(result.inventoryTransaction.total_cost).toBe('1000.00');

      expect(result.layer).toBeDefined();
      expect(result.layer?.quantity_purchased).toBe('100.0000');
      expect(result.layer?.quantity_remaining).toBe('100.0000');
      expect(result.layer?.unit_cost).toBe('10.00');

      // Check inventory item updated
      const updated = await db.inventoryItems.get(item.id);
      expect(updated).toBeDefined();
      expect(updated!.quantity_on_hand).toBe('100.0000');
      expect(updated!.unit_cost).toBe('10.00');
      expect(updated!.total_value).toBe('1000.00');
    });

    it('should process purchase without layer for Weighted Average', async () => {
      const item = await createInventoryItem(
        companyId,
        productId,
        ValuationMethod.WEIGHTED_AVERAGE
      );

      const result = await processPurchase(
        companyId,
        item.id,
        'txn-001',
        Date.now(),
        '100.0000',
        '10.00'
      );

      expect(result.inventoryTransaction).toBeDefined();
      expect(result.layer).toBeNull(); // No layer for weighted average
    });

    it('should update weighted average cost on second purchase', async () => {
      const item = await createInventoryItem(
        companyId,
        productId,
        ValuationMethod.WEIGHTED_AVERAGE
      );

      // First purchase: 100 units @ $10 = $1000
      await processPurchase(companyId, item.id, 'txn-001', Date.now(), '100.0000', '10.00');

      // Second purchase: 50 units @ $20 = $1000
      await processPurchase(companyId, item.id, 'txn-002', Date.now(), '50.0000', '20.00');

      // New weighted average: ($1000 + $1000) / (100 + 50) = $2000 / 150 = $13.33
      const updated = await db.inventoryItems.get(item.id);
      expect(updated).toBeDefined();
      expect(updated!.quantity_on_hand).toBe('150.0000');
      expect(updated!.total_value).toBe('2000.00');

      const expectedAvg = new Decimal('2000').dividedBy('150');
      expect(updated!.unit_cost).toBe(expectedAvg.toFixed(2));
    });
  });

  describe('processSale - FIFO', () => {
    it('should calculate COGS using FIFO method (oldest first)', async () => {
      const item = await createInventoryItem(companyId, productId, ValuationMethod.FIFO);

      // Purchase 1: 100 units @ $10 = $1000 (oldest)
      await processPurchase(companyId, item.id, 'txn-001', Date.now() - 2000, '100.0000', '10.00');

      // Purchase 2: 50 units @ $20 = $1000 (newest)
      await processPurchase(companyId, item.id, 'txn-002', Date.now(), '50.0000', '20.00');

      // Sell 120 units - should use 100 @ $10 and 20 @ $20
      const result = await processSale(companyId, item.id, 'txn-003', Date.now(), '120.0000');

      // COGS = (100 * $10) + (20 * $20) = $1000 + $400 = $1400
      expect(result.cogsCalculation.cogsAmount).toBe('1400.00');
      expect(result.cogsCalculation.layersUsed).toBeDefined();
      expect(result.cogsCalculation.layersUsed).toHaveLength(2);
      const layers = result.cogsCalculation.layersUsed!;
      expect(layers[0].quantityUsed).toBe('100.0000');
      expect(layers[1].quantityUsed).toBe('20.0000');

      // Remaining inventory: 30 units @ $20 = $600
      expect(result.cogsCalculation.newQuantity).toBe('30.0000');
      expect(result.cogsCalculation.newTotalValue).toBe('600.00');
    });

    it('should throw error if insufficient inventory for FIFO sale', async () => {
      const item = await createInventoryItem(companyId, productId, ValuationMethod.FIFO);

      await processPurchase(companyId, item.id, 'txn-001', Date.now(), '50.0000', '10.00');

      await expect(
        processSale(companyId, item.id, 'txn-002', Date.now(), '100.0000')
      ).rejects.toThrow('Insufficient inventory');
    });
  });

  describe('processSale - LIFO', () => {
    it('should calculate COGS using LIFO method (newest first)', async () => {
      const item = await createInventoryItem(companyId, productId, ValuationMethod.LIFO);

      // Purchase 1: 100 units @ $10 = $1000 (oldest)
      await processPurchase(companyId, item.id, 'txn-001', Date.now() - 2000, '100.0000', '10.00');

      // Purchase 2: 50 units @ $20 = $1000 (newest)
      await processPurchase(companyId, item.id, 'txn-002', Date.now(), '50.0000', '20.00');

      // Sell 120 units - should use 50 @ $20 and 70 @ $10 (LIFO)
      const result = await processSale(companyId, item.id, 'txn-003', Date.now(), '120.0000');

      // COGS = (50 * $20) + (70 * $10) = $1000 + $700 = $1700
      expect(result.cogsCalculation.cogsAmount).toBe('1700.00');
      expect(result.cogsCalculation.layersUsed).toBeDefined();
      expect(result.cogsCalculation.layersUsed).toHaveLength(2);
      const layers = result.cogsCalculation.layersUsed!;
      expect(layers[0].quantityUsed).toBe('50.0000');
      expect(layers[1].quantityUsed).toBe('70.0000');

      // Remaining inventory: 30 units @ $10 = $300
      expect(result.cogsCalculation.newQuantity).toBe('30.0000');
      expect(result.cogsCalculation.newTotalValue).toBe('300.00');
    });
  });

  describe('processSale - Weighted Average', () => {
    it('should calculate COGS using weighted average cost', async () => {
      const item = await createInventoryItem(
        companyId,
        productId,
        ValuationMethod.WEIGHTED_AVERAGE
      );

      // Purchase 1: 100 units @ $10 = $1000
      await processPurchase(companyId, item.id, 'txn-001', Date.now(), '100.0000', '10.00');

      // Purchase 2: 50 units @ $20 = $1000
      await processPurchase(companyId, item.id, 'txn-002', Date.now(), '50.0000', '20.00');

      // Weighted average: $2000 / 150 = $13.33
      // Sell 100 units
      const result = await processSale(companyId, item.id, 'txn-003', Date.now(), '100.0000');

      // COGS = 100 * $13.33 = $1333.33
      const expectedCOGS = new Decimal('2000').dividedBy('150').times('100');
      expect(result.cogsCalculation.cogsAmount).toBe(expectedCOGS.toFixed(2));

      // Remaining: 50 units @ $13.33 = $666.67
      expect(result.cogsCalculation.newQuantity).toBe('50.0000');
      const expectedRemaining = new Decimal('2000').minus(expectedCOGS);
      expect(result.cogsCalculation.newTotalValue).toBe(expectedRemaining.toFixed(2));
    });
  });

  describe('processAdjustment', () => {
    it('should process positive inventory adjustment', async () => {
      const item = await createInventoryItem(
        companyId,
        productId,
        ValuationMethod.WEIGHTED_AVERAGE
      );

      await processPurchase(companyId, item.id, 'txn-001', Date.now(), '100.0000', '10.00');

      // Adjust up by 10 units
      const adjustment = await processAdjustment(
        companyId,
        item.id,
        'txn-adj',
        Date.now(),
        '10.0000',
        'Found extra units in storage'
      );

      expect(adjustment.quantity).toBe('10.0000');
      expect(adjustment.transaction_type).toBe(InventoryTransactionType.ADJUSTMENT);

      const updated = await db.inventoryItems.get(item.id);
      expect(updated).toBeDefined();
      expect(updated!.quantity_on_hand).toBe('110.0000');
    });

    it('should process negative inventory adjustment', async () => {
      const item = await createInventoryItem(
        companyId,
        productId,
        ValuationMethod.WEIGHTED_AVERAGE
      );

      await processPurchase(companyId, item.id, 'txn-001', Date.now(), '100.0000', '10.00');

      // Adjust down by 5 units (damaged goods)
      const adjustment = await processAdjustment(
        companyId,
        item.id,
        'txn-adj',
        Date.now(),
        '-5.0000',
        'Damaged units removed'
      );

      expect(adjustment.quantity).toBe('-5.0000');

      const updated = await db.inventoryItems.get(item.id);
      expect(updated).toBeDefined();
      expect(updated!.quantity_on_hand).toBe('95.0000');
    });

    it('should prevent adjustment that results in negative inventory', async () => {
      const item = await createInventoryItem(
        companyId,
        productId,
        ValuationMethod.WEIGHTED_AVERAGE
      );

      await processPurchase(companyId, item.id, 'txn-001', Date.now(), '10.0000', '10.00');

      await expect(
        processAdjustment(companyId, item.id, 'txn-adj', Date.now(), '-20.0000', 'Test')
      ).rejects.toThrow('negative inventory');
    });
  });

  describe('Stock Take Workflow', () => {
    it('should complete full stock take workflow', async () => {
      // Setup inventory items
      const item1 = await createInventoryItem(companyId, productId + '-1', ValuationMethod.FIFO);
      const item2 = await createInventoryItem(companyId, productId + '-2', ValuationMethod.FIFO);

      await processPurchase(companyId, item1.id, 'txn-001', Date.now(), '100.0000', '10.00');
      await processPurchase(companyId, item2.id, 'txn-002', Date.now(), '50.0000', '20.00');

      // Create stock take
      const stockTake = await createStockTake(
        companyId,
        'ST-001',
        Date.now(),
        'Annual stock take'
      );

      expect(stockTake.status).toBe(StockTakeStatus.DRAFT);

      // Add items with variances
      // Item 1: System = 100, Counted = 95 (5 missing)
      const stItem1 = await addStockTakeItem(stockTake.id, item1.id, '95.0000', 'Some missing');

      expect(stItem1.system_quantity).toBe('100.0000');
      expect(stItem1.counted_quantity).toBe('95.0000');
      expect(stItem1.variance_quantity).toBe('-5.0000');
      expect(stItem1.variance_value).toBe('-50.00'); // -5 * $10

      // Item 2: System = 50, Counted = 52 (2 extra)
      const stItem2 = await addStockTakeItem(stockTake.id, item2.id, '52.0000', 'Found extra');

      expect(stItem2.variance_quantity).toBe('2.0000');
      expect(stItem2.variance_value).toBe('40.00'); // 2 * $20

      // Check total variance updated
      const updated = await db.stockTakes.get(stockTake.id);
      expect(updated?.total_variance_value).toBe('-10.00'); // -$50 + $40

      // Submit stock take
      const submitted = await submitStockTake(stockTake.id, 'user-001');
      expect(submitted.status).toBe(StockTakeStatus.SUBMITTED);
      expect(submitted.counted_by).toBe('user-001');

      // Approve and apply
      const approved = await approveStockTake(stockTake.id, 'user-002', 'txn-st-apply');
      expect(approved.status).toBe(StockTakeStatus.APPROVED);
      expect(approved.approved_by).toBe('user-002');

      // Verify adjustments applied
      const item1Updated = await db.inventoryItems.get(item1.id);
      expect(item1Updated?.quantity_on_hand).toBe('95.0000'); // Adjusted down

      const item2Updated = await db.inventoryItems.get(item2.id);
      expect(item2Updated?.quantity_on_hand).toBe('52.0000'); // Adjusted up
    });
  });

  describe('Valuation Method Change', () => {
    it('should preview method change impact', async () => {
      const item = await createInventoryItem(companyId, productId, ValuationMethod.FIFO);

      // Create multiple layers
      await processPurchase(companyId, item.id, 'txn-001', Date.now() - 2000, '100.0000', '10.00');
      await processPurchase(companyId, item.id, 'txn-002', Date.now(), '50.0000', '20.00');

      // Current: 150 units, total value $2000, avg $13.33
      const preview = await previewMethodChange(item.id, ValuationMethod.WEIGHTED_AVERAGE);

      expect(preview.currentMethod).toBe(ValuationMethod.FIFO);
      expect(preview.newMethod).toBe(ValuationMethod.WEIGHTED_AVERAGE);
      expect(preview.currentUnitCost).toBe('13.33');
      expect(preview.newUnitCost).toBe('13.33'); // Same for weighted avg
    });

    it('should change valuation method with audit trail', async () => {
      const item = await createInventoryItem(companyId, productId, ValuationMethod.FIFO);

      await processPurchase(companyId, item.id, 'txn-001', Date.now(), '100.0000', '10.00');

      const change = await changeValuationMethod(item.id, ValuationMethod.LIFO, 'user-001');

      expect(change.old_method).toBe(ValuationMethod.FIFO);
      expect(change.new_method).toBe(ValuationMethod.LIFO);
      expect(change.changed_by).toBe('user-001');
      expect(change.impact_description).toBeDefined();

      // Verify item updated
      const updated = await db.inventoryItems.get(item.id);
      expect(updated?.valuation_method).toBe(ValuationMethod.LIFO);

      // Verify audit record created
      const auditRecords = await db.valuationMethodChanges
        .where('inventory_item_id')
        .equals(item.id)
        .toArray();
      expect(auditRecords).toHaveLength(1);
    });

    it('should prevent changing to same method', async () => {
      const item = await createInventoryItem(companyId, productId, ValuationMethod.FIFO);

      await expect(
        changeValuationMethod(item.id, ValuationMethod.FIFO, 'user-001')
      ).rejects.toThrow('same as current method');
    });
  });

  describe('Inventory Valuation Summary', () => {
    it('should generate inventory valuation summary by method', async () => {
      // Create items with different methods
      const item1 = await createInventoryItem(companyId, productId + '-1', ValuationMethod.FIFO);
      const item2 = await createInventoryItem(companyId, productId + '-2', ValuationMethod.LIFO);
      const item3 = await createInventoryItem(
        companyId,
        productId + '-3',
        ValuationMethod.WEIGHTED_AVERAGE
      );

      await processPurchase(companyId, item1.id, 'txn-001', Date.now(), '100.0000', '10.00');
      await processPurchase(companyId, item2.id, 'txn-002', Date.now(), '50.0000', '20.00');
      await processPurchase(companyId, item3.id, 'txn-003', Date.now(), '75.0000', '15.00');

      const summary = await getInventoryValuation(companyId);

      expect(summary.totalItems).toBe(3);
      expect(summary.totalQuantity).toBe('225.0000');
      expect(summary.totalValue).toBe('3125.00'); // $1000 + $1000 + $1125

      expect(summary.byMethod[ValuationMethod.FIFO].items).toBe(1);
      expect(summary.byMethod[ValuationMethod.FIFO].value).toBe('1000.00');

      expect(summary.byMethod[ValuationMethod.LIFO].items).toBe(1);
      expect(summary.byMethod[ValuationMethod.LIFO].value).toBe('1000.00');

      expect(summary.byMethod[ValuationMethod.WEIGHTED_AVERAGE].items).toBe(1);
      expect(summary.byMethod[ValuationMethod.WEIGHTED_AVERAGE].value).toBe('1125.00');
    });
  });

  describe('Zero Rounding Errors with Decimal.js', () => {
    it('should maintain precision with complex calculations', async () => {
      const item = await createInventoryItem(
        companyId,
        productId,
        ValuationMethod.WEIGHTED_AVERAGE
      );

      // Purchase with non-terminating decimal unit cost
      await processPurchase(companyId, item.id, 'txn-001', Date.now(), '3.0000', '10.00');
      await processPurchase(companyId, item.id, 'txn-002', Date.now(), '7.0000', '15.00');

      // Weighted average: (3*10 + 7*15) / 10 = 135 / 10 = $13.50
      const updated = await db.inventoryItems.get(item.id);
      expect(updated?.unit_cost).toBe('13.50');
      expect(updated?.total_value).toBe('135.00');

      // Sell fraction
      await processSale(companyId, item.id, 'txn-003', Date.now(), '3.3333');

      const afterSale = await db.inventoryItems.get(item.id);

      // Remaining: 10 - 3.3333 = 6.6667
      expect(afterSale?.quantity_on_hand).toBe('6.6667');

      // Should maintain precision without floating point errors
      const remainingValue = new Decimal(afterSale?.total_value || '0');
      const expectedValue = new Decimal('13.50').times('6.6667');

      // Values should match within acceptable precision
      expect(remainingValue.toFixed(2)).toBe(expectedValue.toFixed(2));
    });
  });
});
