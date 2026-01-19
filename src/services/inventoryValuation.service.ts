/**
 * Inventory Valuation Service
 *
 * Implements FIFO, LIFO, and Weighted Average inventory valuation methods.
 * Provides automatic COGS calculation, stock take processing, and method change workflows.
 *
 * Requirements:
 * - H6: Advanced Inventory Valuation
 * - Zero rounding errors via Decimal.js
 * - Automatic COGS calculation
 * - Stock take variance reporting
 * - Method change audit trail
 */

import Decimal from 'decimal.js';
import { nanoid } from 'nanoid';
import { db } from '../db/database';
import type {
  InventoryItem,
  InventoryLayer,
  InventoryTransaction,
  StockTake,
  StockTakeItem,
  ValuationMethodChange,
} from '../db/schema/inventoryValuation.schema';
import {
  ValuationMethod,
  InventoryTransactionType,
  StockTakeStatus,
  validateInventoryItem,
  validateInventoryLayer,
  validateStockTake,
  validateStockTakeItem,
  createDefaultInventoryItem,
  createDefaultInventoryLayer,
  createDefaultInventoryTransaction,
  createDefaultStockTake,
  createDefaultStockTakeItem,
  createDefaultValuationMethodChange,
} from '../db/schema/inventoryValuation.schema';
import { logger } from '../utils/logger';
import { AppError, ErrorCode } from '../utils/errors';
import { getDeviceId } from '../utils/device';

// Configure Decimal.js for financial precision
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

const serviceLogger = logger.child('InventoryValuationService');

// ============================================================================
// Inventory Item Management
// ============================================================================

/**
 * Create a new inventory item
 */
export async function createInventoryItem(
  companyId: string,
  productId: string,
  valuationMethod: ValuationMethod,
  options?: {
    reorderPoint?: string;
    reorderQuantity?: string;
    location?: string;
  }
): Promise<InventoryItem> {
  const deviceId = getDeviceId();

  // Check if inventory item already exists for this product
  const existing = await db.inventoryItems
    .where('[company_id+product_id]')
    .equals([companyId, productId])
    .and((item) => item.deleted_at === null)
    .first();

  if (existing) {
    throw new AppError(
      ErrorCode.CONSTRAINT_VIOLATION,
      'Inventory tracking already enabled for this product'
    );
  }

  const inventoryItem: InventoryItem = {
    id: nanoid(),
    ...createDefaultInventoryItem(companyId, productId, valuationMethod, deviceId),
    reorder_point: options?.reorderPoint || null,
    reorder_quantity: options?.reorderQuantity || null,
    location: options?.location || null,
  } as InventoryItem;

  // Validate
  const errors = validateInventoryItem(inventoryItem);
  if (errors.length > 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, errors.join(', '));
  }

  await db.inventoryItems.add(inventoryItem);

  serviceLogger.info('Created inventory item', {
    id: inventoryItem.id,
    productId,
    method: valuationMethod,
  });

  return inventoryItem;
}

/**
 * Update inventory item settings
 */
export async function updateInventoryItem(
  itemId: string,
  updates: {
    reorderPoint?: string;
    reorderQuantity?: string;
    location?: string;
    active?: boolean;
  }
): Promise<InventoryItem> {
  const item = await db.inventoryItems.get(itemId);
  if (!item || item.deleted_at !== null) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Inventory item not found');
  }

  await db.inventoryItems.update(itemId, {
    reorder_point: updates.reorderPoint ?? item.reorder_point,
    reorder_quantity: updates.reorderQuantity ?? item.reorder_quantity,
    location: updates.location ?? item.location,
    active: updates.active ?? item.active,
  });

  const updated = await db.inventoryItems.get(itemId);
  if (!updated) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Failed to retrieve updated item');
  }

  return updated;
}

/**
 * Get inventory item by product ID
 */
export async function getInventoryItemByProduct(
  companyId: string,
  productId: string
): Promise<InventoryItem | null> {
  const item = await db.inventoryItems
    .where('[company_id+product_id]')
    .equals([companyId, productId])
    .and((item) => item.deleted_at === null)
    .first();

  return item || null;
}

/**
 * Get all inventory items for a company
 */
export async function getInventoryItems(
  companyId: string,
  options?: {
    activeOnly?: boolean;
    lowStockOnly?: boolean;
  }
): Promise<InventoryItem[]> {
  let collection = db.inventoryItems
    .where('company_id')
    .equals(companyId)
    .and((item) => item.deleted_at === null);

  if (options?.activeOnly) {
    collection = collection.and((item) => item.active === true);
  }

  const items = await collection.toArray();

  // Filter low stock items if requested
  if (options?.lowStockOnly) {
    return items.filter((item) => {
      if (!item.reorder_point) return false;
      const qtyOnHand = new Decimal(item.quantity_on_hand);
      const reorderPoint = new Decimal(item.reorder_point);
      return qtyOnHand.lessThanOrEqualTo(reorderPoint);
    });
  }

  return items;
}

// ============================================================================
// Purchase Processing
// ============================================================================

/**
 * Process inventory purchase
 * Creates inventory transaction and layer (for FIFO/LIFO)
 */
export async function processPurchase(
  companyId: string,
  inventoryItemId: string,
  transactionId: string,
  purchaseDate: number,
  quantity: string,
  unitCost: string,
  options?: {
    reference?: string;
    notes?: string;
  }
): Promise<{
  inventoryTransaction: InventoryTransaction;
  layer: InventoryLayer | null;
}> {
  const deviceId = getDeviceId();

  // Get inventory item
  const item = await db.inventoryItems.get(inventoryItemId);
  if (!item || item.deleted_at !== null) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Inventory item not found');
  }

  if (item.company_id !== companyId) {
    throw new AppError(ErrorCode.CONSTRAINT_VIOLATION, 'Company ID mismatch');
  }

  const qtyDecimal = new Decimal(quantity);
  const costDecimal = new Decimal(unitCost);

  if (qtyDecimal.lessThanOrEqualTo(0)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Purchase quantity must be positive');
  }

  if (costDecimal.lessThan(0)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Unit cost must be non-negative');
  }

  const totalCost = qtyDecimal.times(costDecimal);

  // Create inventory transaction
  const invTransaction: InventoryTransaction = {
    id: nanoid(),
    ...createDefaultInventoryTransaction(
      companyId,
      inventoryItemId,
      transactionId,
      InventoryTransactionType.PURCHASE,
      purchaseDate,
      deviceId
    ),
    quantity,
    unit_cost: unitCost,
    total_cost: totalCost.toFixed(2),
    reference: options?.reference || null,
    notes: options?.notes || null,
  } as InventoryTransaction;

  // Create inventory layer for FIFO/LIFO methods
  let layer: InventoryLayer | null = null;
  if (
    item.valuation_method === ValuationMethod.FIFO ||
    item.valuation_method === ValuationMethod.LIFO
  ) {
    layer = {
      id: nanoid(),
      ...createDefaultInventoryLayer(
        companyId,
        inventoryItemId,
        transactionId,
        purchaseDate,
        quantity,
        unitCost,
        deviceId
      ),
      total_cost: totalCost.toFixed(2),
    } as InventoryLayer;

    const layerErrors = validateInventoryLayer(layer);
    if (layerErrors.length > 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, layerErrors.join(', '));
    }
  }

  // Update inventory item
  const newQuantity = new Decimal(item.quantity_on_hand).plus(qtyDecimal);
  const newTotalValue = new Decimal(item.total_value).plus(totalCost);
  const newUnitCost = newQuantity.greaterThan(0)
    ? newTotalValue.dividedBy(newQuantity)
    : new Decimal(0);

  await db.transaction('rw', [db.inventoryItems, db.inventoryTransactions, db.inventoryLayers], async () => {
    // Add transaction
    await db.inventoryTransactions.add(invTransaction);

    // Add layer if applicable
    if (layer) {
      await db.inventoryLayers.add(layer);
    }

    // Update inventory item
    await db.inventoryItems.update(inventoryItemId, {
      quantity_on_hand: newQuantity.toFixed(4),
      unit_cost: newUnitCost.toFixed(2),
      total_value: newTotalValue.toFixed(2),
    });
  });

  serviceLogger.info('Processed inventory purchase', {
    inventoryItemId,
    quantity,
    unitCost,
    method: item.valuation_method,
  });

  return {
    inventoryTransaction: invTransaction,
    layer,
  };
}

// ============================================================================
// Sale Processing with COGS Calculation
// ============================================================================

/**
 * Calculate COGS result
 */
export interface COGSCalculation {
  cogsAmount: string;
  newQuantity: string;
  newUnitCost: string;
  newTotalValue: string;
  layersUsed?: Array<{
    layerId: string;
    quantityUsed: string;
    costPerUnit: string;
    totalCost: string;
  }>;
}

/**
 * Calculate COGS using FIFO method
 */
async function calculateFIFOCOGS(
  inventoryItemId: string,
  quantitySold: Decimal
): Promise<COGSCalculation> {
  // Get all non-depleted layers, ordered by purchase date (oldest first)
  const layers = await db.inventoryLayers
    .where('inventory_item_id')
    .equals(inventoryItemId)
    .and((layer) => layer.deleted_at === null && !layer.fully_depleted)
    .sortBy('purchase_date');

  let remainingToSell = quantitySold;
  let totalCOGS = new Decimal(0);
  const layersUsed: COGSCalculation['layersUsed'] = [];

  for (const layer of layers) {
    if (remainingToSell.lessThanOrEqualTo(0)) break;

    const layerRemaining = new Decimal(layer.quantity_remaining);
    const layerCost = new Decimal(layer.unit_cost);

    const quantityFromLayer = Decimal.min(remainingToSell, layerRemaining);
    const costFromLayer = quantityFromLayer.times(layerCost);

    totalCOGS = totalCOGS.plus(costFromLayer);
    remainingToSell = remainingToSell.minus(quantityFromLayer);

    layersUsed.push({
      layerId: layer.id,
      quantityUsed: quantityFromLayer.toFixed(4),
      costPerUnit: layerCost.toFixed(2),
      totalCost: costFromLayer.toFixed(2),
    });

    // Update layer
    const newRemaining = layerRemaining.minus(quantityFromLayer);
    await db.inventoryLayers.update(layer.id, {
      quantity_remaining: newRemaining.toFixed(4),
      fully_depleted: newRemaining.lessThanOrEqualTo(0),
    });
  }

  if (remainingToSell.greaterThan(0)) {
    throw new AppError(
      ErrorCode.CONSTRAINT_VIOLATION,
      `Insufficient inventory. Need ${quantitySold.toFixed(4)}, available layers only cover ${quantitySold.minus(remainingToSell).toFixed(4)}`
    );
  }

  // Get updated item to calculate new values
  const item = await db.inventoryItems.get(inventoryItemId);
  if (!item) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Inventory item not found');
  }

  const currentQty = new Decimal(item.quantity_on_hand);
  const currentValue = new Decimal(item.total_value);

  const newQuantity = currentQty.minus(quantitySold);
  const newTotalValue = currentValue.minus(totalCOGS);
  const newUnitCost = newQuantity.greaterThan(0)
    ? newTotalValue.dividedBy(newQuantity)
    : new Decimal(0);

  return {
    cogsAmount: totalCOGS.toFixed(2),
    newQuantity: newQuantity.toFixed(4),
    newUnitCost: newUnitCost.toFixed(2),
    newTotalValue: newTotalValue.toFixed(2),
    layersUsed,
  };
}

/**
 * Calculate COGS using LIFO method
 */
async function calculateLIFOCOGS(
  inventoryItemId: string,
  quantitySold: Decimal
): Promise<COGSCalculation> {
  // Get all non-depleted layers, ordered by purchase date (newest first)
  const allLayers = await db.inventoryLayers
    .where('inventory_item_id')
    .equals(inventoryItemId)
    .and((layer) => layer.deleted_at === null && !layer.fully_depleted)
    .toArray();

  // Sort by purchase_date descending (newest first)
  const layers = allLayers.sort((a, b) => b.purchase_date - a.purchase_date);

  let remainingToSell = quantitySold;
  let totalCOGS = new Decimal(0);
  const layersUsed: COGSCalculation['layersUsed'] = [];

  for (const layer of layers) {
    if (remainingToSell.lessThanOrEqualTo(0)) break;

    const layerRemaining = new Decimal(layer.quantity_remaining);
    const layerCost = new Decimal(layer.unit_cost);

    const quantityFromLayer = Decimal.min(remainingToSell, layerRemaining);
    const costFromLayer = quantityFromLayer.times(layerCost);

    totalCOGS = totalCOGS.plus(costFromLayer);
    remainingToSell = remainingToSell.minus(quantityFromLayer);

    layersUsed.push({
      layerId: layer.id,
      quantityUsed: quantityFromLayer.toFixed(4),
      costPerUnit: layerCost.toFixed(2),
      totalCost: costFromLayer.toFixed(2),
    });

    // Update layer
    const newRemaining = layerRemaining.minus(quantityFromLayer);
    await db.inventoryLayers.update(layer.id, {
      quantity_remaining: newRemaining.toFixed(4),
      fully_depleted: newRemaining.lessThanOrEqualTo(0),
    });
  }

  if (remainingToSell.greaterThan(0)) {
    throw new AppError(
      ErrorCode.CONSTRAINT_VIOLATION,
      `Insufficient inventory. Need ${quantitySold.toFixed(4)}, available layers only cover ${quantitySold.minus(remainingToSell).toFixed(4)}`
    );
  }

  // Get updated item to calculate new values
  const item = await db.inventoryItems.get(inventoryItemId);
  if (!item) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Inventory item not found');
  }

  const currentQty = new Decimal(item.quantity_on_hand);
  const currentValue = new Decimal(item.total_value);

  const newQuantity = currentQty.minus(quantitySold);
  const newTotalValue = currentValue.minus(totalCOGS);
  const newUnitCost = newQuantity.greaterThan(0)
    ? newTotalValue.dividedBy(newQuantity)
    : new Decimal(0);

  return {
    cogsAmount: totalCOGS.toFixed(2),
    newQuantity: newQuantity.toFixed(4),
    newUnitCost: newUnitCost.toFixed(2),
    newTotalValue: newTotalValue.toFixed(2),
    layersUsed,
  };
}

/**
 * Calculate COGS using Weighted Average method
 */
async function calculateWeightedAverageCOGS(
  inventoryItemId: string,
  quantitySold: Decimal
): Promise<COGSCalculation> {
  const item = await db.inventoryItems.get(inventoryItemId);
  if (!item) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Inventory item not found');
  }

  const currentQty = new Decimal(item.quantity_on_hand);
  const currentValue = new Decimal(item.total_value);

  if (quantitySold.greaterThan(currentQty)) {
    throw new AppError(
      ErrorCode.CONSTRAINT_VIOLATION,
      `Insufficient inventory. Need ${quantitySold.toFixed(4)}, have ${currentQty.toFixed(4)}`
    );
  }

  // Calculate weighted average unit cost with full precision
  // Use total_value / quantity instead of stored unit_cost to avoid rounding errors
  const currentUnitCost = currentQty.greaterThan(0)
    ? currentValue.dividedBy(currentQty)
    : new Decimal(0);

  // COGS = quantity sold × weighted average unit cost
  const totalCOGS = quantitySold.times(currentUnitCost);

  const newQuantity = currentQty.minus(quantitySold);
  const newTotalValue = currentValue.minus(totalCOGS);

  // Unit cost remains the same for weighted average
  const newUnitCost = currentUnitCost;

  return {
    cogsAmount: totalCOGS.toFixed(2),
    newQuantity: newQuantity.toFixed(4),
    newUnitCost: newUnitCost.toFixed(2),
    newTotalValue: newTotalValue.toFixed(2),
  };
}

/**
 * Process inventory sale with automatic COGS calculation
 */
export async function processSale(
  companyId: string,
  inventoryItemId: string,
  transactionId: string,
  saleDate: number,
  quantitySold: string,
  options?: {
    reference?: string;
    notes?: string;
  }
): Promise<{
  inventoryTransaction: InventoryTransaction;
  cogsCalculation: COGSCalculation;
}> {
  const deviceId = getDeviceId();

  // Get inventory item
  const item = await db.inventoryItems.get(inventoryItemId);
  if (!item || item.deleted_at !== null) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Inventory item not found');
  }

  if (item.company_id !== companyId) {
    throw new AppError(ErrorCode.CONSTRAINT_VIOLATION, 'Company ID mismatch');
  }

  const qtyDecimal = new Decimal(quantitySold);

  if (qtyDecimal.lessThanOrEqualTo(0)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Sale quantity must be positive');
  }

  // Calculate COGS based on valuation method
  let cogsCalculation: COGSCalculation | undefined;

  await db.transaction('rw', [db.inventoryItems, db.inventoryTransactions, db.inventoryLayers], async () => {
    switch (item.valuation_method) {
      case ValuationMethod.FIFO:
        cogsCalculation = await calculateFIFOCOGS(inventoryItemId, qtyDecimal);
        break;
      case ValuationMethod.LIFO:
        cogsCalculation = await calculateLIFOCOGS(inventoryItemId, qtyDecimal);
        break;
      case ValuationMethod.WEIGHTED_AVERAGE:
        cogsCalculation = await calculateWeightedAverageCOGS(inventoryItemId, qtyDecimal);
        break;
      default:
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Unknown valuation method: ${item.valuation_method}`
        );
    }

    // Create inventory transaction
    const invTransaction: InventoryTransaction = {
      id: nanoid(),
      ...createDefaultInventoryTransaction(
        companyId,
        inventoryItemId,
        transactionId,
        InventoryTransactionType.SALE,
        saleDate,
        deviceId
      ),
      quantity: `-${quantitySold}`, // Negative for sale
      unit_cost: item.unit_cost,
      total_cost: `-${cogsCalculation.cogsAmount}`, // Negative for reduction
      cogs_amount: cogsCalculation.cogsAmount,
      reference: options?.reference || null,
      notes: options?.notes || null,
    } as InventoryTransaction;

    await db.inventoryTransactions.add(invTransaction);

    // Update inventory item
    await db.inventoryItems.update(inventoryItemId, {
      quantity_on_hand: cogsCalculation.newQuantity,
      unit_cost: cogsCalculation.newUnitCost,
      total_value: cogsCalculation.newTotalValue,
    });
  });

  if (!cogsCalculation) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'COGS calculation failed');
  }

  serviceLogger.info('Processed inventory sale', {
    inventoryItemId,
    quantitySold,
    cogs: cogsCalculation.cogsAmount,
    method: item.valuation_method,
  });

  const invTransaction = await db.inventoryTransactions
    .where('transaction_id')
    .equals(transactionId)
    .and((t) => t.transaction_type === InventoryTransactionType.SALE)
    .first();

  if (!invTransaction) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Failed to retrieve created transaction');
  }

  return {
    inventoryTransaction: invTransaction,
    cogsCalculation,
  };
}

// ============================================================================
// Inventory Adjustment
// ============================================================================

/**
 * Process inventory adjustment (manual quantity change)
 */
export async function processAdjustment(
  companyId: string,
  inventoryItemId: string,
  transactionId: string,
  adjustmentDate: number,
  quantityChange: string,
  reason: string,
  options?: {
    reference?: string;
  }
): Promise<InventoryTransaction> {
  const deviceId = getDeviceId();

  const item = await db.inventoryItems.get(inventoryItemId);
  if (!item || item.deleted_at !== null) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Inventory item not found');
  }

  if (item.company_id !== companyId) {
    throw new AppError(ErrorCode.CONSTRAINT_VIOLATION, 'Company ID mismatch');
  }

  const qtyChangeDecimal = new Decimal(quantityChange);
  const currentQty = new Decimal(item.quantity_on_hand);
  const newQty = currentQty.plus(qtyChangeDecimal);

  if (newQty.lessThan(0)) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Adjustment would result in negative inventory'
    );
  }

  const unitCost = new Decimal(item.unit_cost);
  const costChange = qtyChangeDecimal.times(unitCost);

  const invTransaction: InventoryTransaction = {
    id: nanoid(),
    ...createDefaultInventoryTransaction(
      companyId,
      inventoryItemId,
      transactionId,
      InventoryTransactionType.ADJUSTMENT,
      adjustmentDate,
      deviceId
    ),
    quantity: quantityChange,
    unit_cost: item.unit_cost,
    total_cost: costChange.toFixed(2),
    reference: options?.reference || null,
    notes: reason,
  } as InventoryTransaction;

  await db.transaction('rw', [db.inventoryItems, db.inventoryTransactions], async () => {
    await db.inventoryTransactions.add(invTransaction);

    const currentValue = new Decimal(item.total_value);
    const newValue = currentValue.plus(costChange);
    const newUnitCost = newQty.greaterThan(0) ? newValue.dividedBy(newQty) : new Decimal(0);

    await db.inventoryItems.update(inventoryItemId, {
      quantity_on_hand: newQty.toFixed(4),
      unit_cost: newUnitCost.toFixed(2),
      total_value: newValue.toFixed(2),
    });
  });

  serviceLogger.info('Processed inventory adjustment', {
    inventoryItemId,
    quantityChange,
    reason,
  });

  return invTransaction;
}

// ============================================================================
// Stock Take Workflow
// ============================================================================

/**
 * Create new stock take
 */
export async function createStockTake(
  companyId: string,
  stockTakeNumber: string,
  stockTakeDate: number,
  notes?: string
): Promise<StockTake> {
  const deviceId = getDeviceId();

  const stockTake: StockTake = {
    id: nanoid(),
    ...createDefaultStockTake(companyId, stockTakeNumber, stockTakeDate, deviceId),
    notes: notes || null,
  } as StockTake;

  const errors = validateStockTake(stockTake);
  if (errors.length > 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, errors.join(', '));
  }

  await db.stockTakes.add(stockTake);

  serviceLogger.info('Created stock take', { id: stockTake.id, stockTakeNumber });

  return stockTake;
}

/**
 * Add item to stock take
 */
export async function addStockTakeItem(
  stockTakeId: string,
  inventoryItemId: string,
  countedQuantity: string,
  notes?: string
): Promise<StockTakeItem> {
  const deviceId = getDeviceId();

  const stockTake = await db.stockTakes.get(stockTakeId);
  if (!stockTake || stockTake.deleted_at !== null) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Stock take not found');
  }

  if (stockTake.status !== StockTakeStatus.DRAFT) {
    throw new AppError(
      ErrorCode.CONSTRAINT_VIOLATION,
      'Can only add items to draft stock takes'
    );
  }

  const item = await db.inventoryItems.get(inventoryItemId);
  if (!item || item.deleted_at !== null) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Inventory item not found');
  }

  const systemQty = new Decimal(item.quantity_on_hand);
  const countedQty = new Decimal(countedQuantity);
  const variance = countedQty.minus(systemQty);
  const unitCost = new Decimal(item.unit_cost);
  const varianceValue = variance.times(unitCost);

  const stockTakeItem: StockTakeItem = {
    id: nanoid(),
    ...createDefaultStockTakeItem(
      stockTakeId,
      inventoryItemId,
      item.quantity_on_hand,
      item.unit_cost,
      deviceId
    ),
    counted_quantity: countedQuantity,
    variance_quantity: variance.toFixed(4),
    variance_value: varianceValue.toFixed(2),
    notes: notes || null,
  } as StockTakeItem;

  const validationErrors = validateStockTakeItem(stockTakeItem);
  if (validationErrors.length > 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, validationErrors.join(', '));
  }

  await db.stockTakeItems.add(stockTakeItem);

  // Update stock take total variance
  const allItems = await db.stockTakeItems
    .where('stock_take_id')
    .equals(stockTakeId)
    .and((i) => i.deleted_at === null)
    .toArray();

  const totalVariance = allItems.reduce(
    (sum, i) => sum.plus(new Decimal(i.variance_value)),
    new Decimal(0)
  );

  await db.stockTakes.update(stockTakeId, {
    total_variance_value: totalVariance.toFixed(2),
  });

  return stockTakeItem;
}

/**
 * Submit stock take for approval
 */
export async function submitStockTake(
  stockTakeId: string,
  countedBy: string
): Promise<StockTake> {
  const stockTake = await db.stockTakes.get(stockTakeId);
  if (!stockTake || stockTake.deleted_at !== null) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Stock take not found');
  }

  if (stockTake.status !== StockTakeStatus.DRAFT) {
    throw new AppError(
      ErrorCode.CONSTRAINT_VIOLATION,
      'Only draft stock takes can be submitted'
    );
  }

  await db.stockTakes.update(stockTakeId, {
    status: StockTakeStatus.SUBMITTED,
    counted_by: countedBy,
  });

  const updated = await db.stockTakes.get(stockTakeId);
  if (!updated) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Failed to retrieve updated stock take');
  }

  serviceLogger.info('Stock take submitted', { id: stockTakeId, countedBy });

  return updated;
}

/**
 * Approve stock take and apply adjustments
 */
export async function approveStockTake(
  stockTakeId: string,
  approvedBy: string,
  createTransactionId: string
): Promise<StockTake> {
  const stockTake = await db.stockTakes.get(stockTakeId);
  if (!stockTake || stockTake.deleted_at !== null) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Stock take not found');
  }

  if (stockTake.status !== StockTakeStatus.SUBMITTED) {
    throw new AppError(
      ErrorCode.CONSTRAINT_VIOLATION,
      'Only submitted stock takes can be approved'
    );
  }

  // Get all stock take items
  const items = await db.stockTakeItems
    .where('stock_take_id')
    .equals(stockTakeId)
    .and((i) => i.deleted_at === null)
    .toArray();

  await db.transaction(
    'rw',
    [db.stockTakes, db.inventoryItems, db.inventoryTransactions],
    async () => {
      // Apply adjustments for each item with variance
      for (const item of items) {
        const variance = new Decimal(item.variance_quantity);
        if (!variance.equals(0)) {
          await processAdjustment(
            stockTake.company_id,
            item.inventory_item_id,
            `${createTransactionId}-${item.id}`,
            stockTake.stock_take_date,
            variance.toFixed(4),
            `Stock take adjustment: ${stockTake.stock_take_number}`,
            { reference: stockTake.stock_take_number }
          );
        }
      }

      // Update stock take status
      await db.stockTakes.update(stockTakeId, {
        status: StockTakeStatus.APPROVED,
        approved_by: approvedBy,
      });
    }
  );

  const updated = await db.stockTakes.get(stockTakeId);
  if (!updated) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Failed to retrieve updated stock take');
  }

  serviceLogger.info('Stock take approved and applied', { id: stockTakeId, approvedBy });

  return updated;
}

/**
 * Reject stock take
 */
export async function rejectStockTake(
  stockTakeId: string,
  reason: string
): Promise<StockTake> {
  const stockTake = await db.stockTakes.get(stockTakeId);
  if (!stockTake || stockTake.deleted_at !== null) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Stock take not found');
  }

  if (stockTake.status !== StockTakeStatus.SUBMITTED) {
    throw new AppError(
      ErrorCode.CONSTRAINT_VIOLATION,
      'Only submitted stock takes can be rejected'
    );
  }

  await db.stockTakes.update(stockTakeId, {
    status: StockTakeStatus.REJECTED,
    notes: stockTake.notes ? `${stockTake.notes}\n\nRejected: ${reason}` : `Rejected: ${reason}`,
  });

  const updated = await db.stockTakes.get(stockTakeId);
  if (!updated) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Failed to retrieve updated stock take');
  }

  serviceLogger.info('Stock take rejected', { id: stockTakeId, reason });

  return updated;
}

// ============================================================================
// Valuation Method Change
// ============================================================================

/**
 * Calculate impact of changing valuation method
 */
export async function previewMethodChange(
  inventoryItemId: string,
  newMethod: ValuationMethod
): Promise<{
  currentMethod: ValuationMethod;
  newMethod: ValuationMethod;
  currentUnitCost: string;
  newUnitCost: string;
  currentTotalValue: string;
  newTotalValue: string;
  valueDifference: string;
  impactDescription: string;
}> {
  const item = await db.inventoryItems.get(inventoryItemId);
  if (!item || item.deleted_at !== null) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Inventory item not found');
  }

  if (item.valuation_method === newMethod) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'New method is the same as current method'
    );
  }

  const currentUnitCost = new Decimal(item.unit_cost);
  const currentTotalValue = new Decimal(item.total_value);
  const currentQty = new Decimal(item.quantity_on_hand);

  // Calculate new cost based on method
  let newUnitCost: Decimal;
  let impactDescription: string;

  if (newMethod === ValuationMethod.WEIGHTED_AVERAGE) {
    // Converting to weighted average uses current average
    newUnitCost = currentUnitCost;
    impactDescription =
      'Weighted average will use the current average cost going forward. Future purchases will adjust the average.';
  } else {
    // Converting to FIFO/LIFO requires recalculating from layers
    const layers = await db.inventoryLayers
      .where('inventory_item_id')
      .equals(inventoryItemId)
      .and((l) => l.deleted_at === null && !l.fully_depleted)
      .toArray();

    if (layers.length === 0) {
      newUnitCost = currentUnitCost;
      impactDescription = 'No inventory layers available. Current cost will be maintained.';
    } else {
      // Use actual layer costs
      const totalLayerQty = layers.reduce(
        (sum, l) => sum.plus(new Decimal(l.quantity_remaining)),
        new Decimal(0)
      );
      const totalLayerValue = layers.reduce(
        (sum, l) => sum.plus(new Decimal(l.total_cost)),
        new Decimal(0)
      );

      newUnitCost = totalLayerQty.greaterThan(0)
        ? totalLayerValue.dividedBy(totalLayerQty)
        : currentUnitCost;

      impactDescription =
        newMethod === ValuationMethod.FIFO
          ? 'FIFO will use oldest costs first when calculating COGS for sales.'
          : 'LIFO will use newest costs first when calculating COGS for sales.';
    }
  }

  const newTotalValue = currentQty.times(newUnitCost);
  const valueDifference = newTotalValue.minus(currentTotalValue);

  return {
    currentMethod: item.valuation_method,
    newMethod,
    currentUnitCost: currentUnitCost.toFixed(2),
    newUnitCost: newUnitCost.toFixed(2),
    currentTotalValue: currentTotalValue.toFixed(2),
    newTotalValue: newTotalValue.toFixed(2),
    valueDifference: valueDifference.toFixed(2),
    impactDescription,
  };
}

/**
 * Change inventory valuation method
 */
export async function changeValuationMethod(
  inventoryItemId: string,
  newMethod: ValuationMethod,
  changedBy: string
): Promise<ValuationMethodChange> {
  const deviceId = getDeviceId();

  const item = await db.inventoryItems.get(inventoryItemId);
  if (!item || item.deleted_at !== null) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Inventory item not found');
  }

  if (item.valuation_method === newMethod) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'New method is the same as current method'
    );
  }

  // Get preview of impact
  const preview = await previewMethodChange(inventoryItemId, newMethod);

  // Create audit record
  const methodChange: ValuationMethodChange = {
    id: nanoid(),
    ...createDefaultValuationMethodChange(
      item.company_id,
      inventoryItemId,
      item.valuation_method,
      newMethod,
      changedBy,
      deviceId
    ),
    old_unit_cost: preview.currentUnitCost,
    new_unit_cost: preview.newUnitCost,
    old_total_value: preview.currentTotalValue,
    new_total_value: preview.newTotalValue,
    impact_description: preview.impactDescription,
  } as ValuationMethodChange;

  await db.transaction('rw', [db.inventoryItems, db.valuationMethodChanges], async () => {
    await db.valuationMethodChanges.add(methodChange);

    await db.inventoryItems.update(inventoryItemId, {
      valuation_method: newMethod,
      unit_cost: preview.newUnitCost,
      total_value: preview.newTotalValue,
    });
  });

  serviceLogger.info('Changed valuation method', {
    inventoryItemId,
    oldMethod: item.valuation_method,
    newMethod,
    changedBy,
  });

  return methodChange;
}

// ============================================================================
// Reporting and Analytics
// ============================================================================

/**
 * Get inventory valuation summary
 */
export async function getInventoryValuation(companyId: string): Promise<{
  totalItems: number;
  totalQuantity: string;
  totalValue: string;
  byMethod: Record<
    ValuationMethod,
    { items: number; quantity: string; value: string }
  >;
}> {
  const items = await db.inventoryItems
    .where('company_id')
    .equals(companyId)
    .and((i) => i.deleted_at === null && i.active)
    .toArray();

  let totalQty = new Decimal(0);
  let totalValue = new Decimal(0);

  const byMethod: Record<ValuationMethod, { items: number; quantity: string; value: string }> = {
    [ValuationMethod.FIFO]: { items: 0, quantity: '0.0000', value: '0.00' },
    [ValuationMethod.LIFO]: { items: 0, quantity: '0.0000', value: '0.00' },
    [ValuationMethod.WEIGHTED_AVERAGE]: { items: 0, quantity: '0.0000', value: '0.00' },
  };

  for (const item of items) {
    const qty = new Decimal(item.quantity_on_hand);
    const value = new Decimal(item.total_value);

    totalQty = totalQty.plus(qty);
    totalValue = totalValue.plus(value);

    const method = item.valuation_method;
    byMethod[method].items++;
    byMethod[method].quantity = new Decimal(byMethod[method].quantity).plus(qty).toFixed(4);
    byMethod[method].value = new Decimal(byMethod[method].value).plus(value).toFixed(2);
  }

  return {
    totalItems: items.length,
    totalQuantity: totalQty.toFixed(4),
    totalValue: totalValue.toFixed(2),
    byMethod,
  };
}

/**
 * Get inventory transaction history
 */
export async function getInventoryTransactionHistory(
  companyId: string,
  inventoryItemId: string,
  fromDate?: number,
  toDate?: number
): Promise<InventoryTransaction[]> {
  let collection = db.inventoryTransactions
    .where('[company_id+inventory_item_id]')
    .equals([companyId, inventoryItemId])
    .and((t) => t.deleted_at === null);

  const transactions = await collection.toArray();

  // Filter by date range if provided
  return transactions.filter((t) => {
    if (fromDate && t.transaction_date < fromDate) return false;
    if (toDate && t.transaction_date > toDate) return false;
    return true;
  });
}
