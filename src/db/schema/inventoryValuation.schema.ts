/**
 * Inventory Valuation Schema Definition
 *
 * Supports FIFO, LIFO, and Weighted Average inventory valuation methods.
 * Provides automatic COGS calculation, stock take workflows, and method change auditing.
 *
 * Requirements:
 * - H6: Advanced Inventory Valuation
 * - ARCH-004: CRDT-Compatible Schema Design
 * - Zero rounding errors via Decimal.js
 */

import type { BaseEntity, VersionVector } from '../../types/database.types';

// ============================================================================
// Enums
// ============================================================================

/**
 * Inventory valuation methods
 */
export enum ValuationMethod {
  FIFO = 'FIFO', // First In, First Out
  LIFO = 'LIFO', // Last In, First Out
  WEIGHTED_AVERAGE = 'WEIGHTED_AVERAGE', // Weighted Average Cost
}

/**
 * Inventory transaction types
 */
export enum InventoryTransactionType {
  PURCHASE = 'PURCHASE', // Inventory purchase
  SALE = 'SALE', // Inventory sale
  ADJUSTMENT = 'ADJUSTMENT', // Manual adjustment
  STOCK_TAKE = 'STOCK_TAKE', // Stock take adjustment
  TRANSFER = 'TRANSFER', // Transfer between locations
  RETURN = 'RETURN', // Customer return
  DAMAGED = 'DAMAGED', // Damaged goods write-off
}

/**
 * Stock take status
 */
export enum StockTakeStatus {
  DRAFT = 'DRAFT', // In progress
  SUBMITTED = 'SUBMITTED', // Submitted for review
  APPROVED = 'APPROVED', // Approved and applied
  REJECTED = 'REJECTED', // Rejected
}

// ============================================================================
// Table 1: Inventory Items
// ============================================================================

/**
 * Inventory Item
 * Links products to inventory tracking with valuation settings
 */
export interface InventoryItem extends BaseEntity {
  company_id: string; // UUID - links to Company
  product_id: string; // UUID - links to Product
  valuation_method: ValuationMethod; // Method for this specific item
  quantity_on_hand: string; // ENCRYPTED - Current quantity (DECIMAL(15,4))
  unit_cost: string; // ENCRYPTED - Current unit cost (DECIMAL(15,2))
  total_value: string; // ENCRYPTED - Total inventory value (DECIMAL(15,2))
  reorder_point: string | null; // ENCRYPTED - Reorder threshold (DECIMAL(15,4))
  reorder_quantity: string | null; // ENCRYPTED - Reorder amount (DECIMAL(15,4))
  location: string | null; // ENCRYPTED - Storage location
  active: boolean; // Whether item is actively tracked
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Dexie.js schema for inventory_items table
 */
export const inventoryItemsSchema =
  'id, company_id, product_id, valuation_method, [company_id+product_id], [company_id+active], updated_at, deleted_at';

export const INVENTORY_ITEMS_TABLE = 'inventory_items';

// ============================================================================
// Table 2: Inventory Layers (for FIFO/LIFO)
// ============================================================================

/**
 * Inventory Layer
 * Tracks individual purchase batches for FIFO/LIFO costing
 * Each purchase creates a new layer, sales deplete layers per method
 */
export interface InventoryLayer extends BaseEntity {
  company_id: string; // UUID - links to Company
  inventory_item_id: string; // UUID - links to InventoryItem
  transaction_id: string; // UUID - links to Transaction that created this layer
  purchase_date: number; // Unix timestamp - Date of purchase
  quantity_purchased: string; // ENCRYPTED - Original quantity (DECIMAL(15,4))
  quantity_remaining: string; // ENCRYPTED - Remaining quantity (DECIMAL(15,4))
  unit_cost: string; // ENCRYPTED - Cost per unit (DECIMAL(15,2))
  total_cost: string; // ENCRYPTED - Total layer cost (DECIMAL(15,2))
  fully_depleted: boolean; // True when quantity_remaining = 0
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Dexie.js schema for inventory_layers table
 */
export const inventoryLayersSchema =
  'id, company_id, inventory_item_id, transaction_id, purchase_date, fully_depleted, [company_id+inventory_item_id], [inventory_item_id+fully_depleted], updated_at, deleted_at';

export const INVENTORY_LAYERS_TABLE = 'inventory_layers';

// ============================================================================
// Table 3: Inventory Transactions
// ============================================================================

/**
 * Inventory Transaction
 * Records all inventory movements with COGS calculation
 */
export interface InventoryTransaction extends BaseEntity {
  company_id: string; // UUID - links to Company
  inventory_item_id: string; // UUID - links to InventoryItem
  transaction_id: string; // UUID - links to general ledger Transaction
  transaction_type: InventoryTransactionType; // Type of inventory movement
  transaction_date: number; // Unix timestamp - Date of transaction
  quantity: string; // ENCRYPTED - Quantity moved (positive or negative) (DECIMAL(15,4))
  unit_cost: string; // ENCRYPTED - Cost per unit (DECIMAL(15,2))
  total_cost: string; // ENCRYPTED - Total cost (DECIMAL(15,2))
  cogs_amount: string | null; // ENCRYPTED - COGS for sales (DECIMAL(15,2))
  reference: string | null; // ENCRYPTED - External reference
  notes: string | null; // ENCRYPTED - Transaction notes
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Dexie.js schema for inventory_transactions table
 */
export const inventoryTransactionsSchema =
  'id, company_id, inventory_item_id, transaction_id, transaction_type, transaction_date, [company_id+inventory_item_id], [company_id+transaction_type], [company_id+transaction_date], updated_at, deleted_at';

export const INVENTORY_TRANSACTIONS_TABLE = 'inventory_transactions';

// ============================================================================
// Table 4: Stock Takes
// ============================================================================

/**
 * Stock Take
 * Physical inventory count sessions
 */
export interface StockTake extends BaseEntity {
  company_id: string; // UUID - links to Company
  stock_take_number: string; // ENCRYPTED - Sequential number (e.g., "ST-0001")
  stock_take_date: number; // Unix timestamp - Date of stock take
  status: StockTakeStatus; // Current status
  counted_by: string | null; // UUID - User who performed count
  approved_by: string | null; // UUID - User who approved
  notes: string | null; // ENCRYPTED - Stock take notes
  total_variance_value: string; // ENCRYPTED - Total value of variances (DECIMAL(15,2))
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Dexie.js schema for stock_takes table
 */
export const stockTakesSchema =
  'id, company_id, stock_take_number, stock_take_date, status, [company_id+status], [company_id+stock_take_date], updated_at, deleted_at';

export const STOCK_TAKES_TABLE = 'stock_takes';

// ============================================================================
// Table 5: Stock Take Items
// ============================================================================

/**
 * Stock Take Item
 * Individual item counts within a stock take
 */
export interface StockTakeItem extends BaseEntity {
  stock_take_id: string; // UUID - links to StockTake
  inventory_item_id: string; // UUID - links to InventoryItem
  system_quantity: string; // ENCRYPTED - System-recorded quantity (DECIMAL(15,4))
  counted_quantity: string; // ENCRYPTED - Physically counted quantity (DECIMAL(15,4))
  variance_quantity: string; // ENCRYPTED - Difference (counted - system) (DECIMAL(15,4))
  unit_cost: string; // ENCRYPTED - Cost per unit at time of count (DECIMAL(15,2))
  variance_value: string; // ENCRYPTED - Value of variance (DECIMAL(15,2))
  notes: string | null; // ENCRYPTED - Item-specific notes
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Dexie.js schema for stock_take_items table
 */
export const stockTakeItemsSchema =
  'id, stock_take_id, inventory_item_id, [stock_take_id+inventory_item_id], updated_at, deleted_at';

export const STOCK_TAKE_ITEMS_TABLE = 'stock_take_items';

// ============================================================================
// Table 6: Valuation Method Changes
// ============================================================================

/**
 * Valuation Method Change
 * Audit trail for inventory valuation method changes
 */
export interface ValuationMethodChange extends BaseEntity {
  company_id: string; // UUID - links to Company
  inventory_item_id: string; // UUID - links to InventoryItem
  old_method: ValuationMethod; // Previous valuation method
  new_method: ValuationMethod; // New valuation method
  change_date: number; // Unix timestamp - Date of change
  changed_by: string; // UUID - User who made the change
  old_unit_cost: string; // ENCRYPTED - Unit cost before change (DECIMAL(15,2))
  new_unit_cost: string; // ENCRYPTED - Unit cost after change (DECIMAL(15,2))
  old_total_value: string; // ENCRYPTED - Total value before change (DECIMAL(15,2))
  new_total_value: string; // ENCRYPTED - Total value after change (DECIMAL(15,2))
  impact_description: string | null; // ENCRYPTED - Description of financial impact
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Dexie.js schema for valuation_method_changes table
 */
export const valuationMethodChangesSchema =
  'id, company_id, inventory_item_id, change_date, [company_id+inventory_item_id], [company_id+change_date], updated_at, deleted_at';

export const VALUATION_METHOD_CHANGES_TABLE = 'valuation_method_changes';

// ============================================================================
// Default Values and Helpers
// ============================================================================

/**
 * Create default InventoryItem
 */
export const createDefaultInventoryItem = (
  companyId: string,
  productId: string,
  valuationMethod: ValuationMethod,
  deviceId: string
): Partial<InventoryItem> => {
  const now = Date.now();

  return {
    company_id: companyId,
    product_id: productId,
    valuation_method: valuationMethod,
    quantity_on_hand: '0.0000',
    unit_cost: '0.00',
    total_value: '0.00',
    reorder_point: null,
    reorder_quantity: null,
    location: null,
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Create default InventoryLayer
 */
export const createDefaultInventoryLayer = (
  companyId: string,
  inventoryItemId: string,
  transactionId: string,
  purchaseDate: number,
  quantity: string,
  unitCost: string,
  deviceId: string
): Partial<InventoryLayer> => {
  const now = Date.now();

  return {
    company_id: companyId,
    inventory_item_id: inventoryItemId,
    transaction_id: transactionId,
    purchase_date: purchaseDate,
    quantity_purchased: quantity,
    quantity_remaining: quantity,
    unit_cost: unitCost,
    total_cost: '0.00', // Calculated by service
    fully_depleted: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Create default InventoryTransaction
 */
export const createDefaultInventoryTransaction = (
  companyId: string,
  inventoryItemId: string,
  transactionId: string,
  transactionType: InventoryTransactionType,
  transactionDate: number,
  deviceId: string
): Partial<InventoryTransaction> => {
  const now = Date.now();

  return {
    company_id: companyId,
    inventory_item_id: inventoryItemId,
    transaction_id: transactionId,
    transaction_type: transactionType,
    transaction_date: transactionDate,
    quantity: '0.0000',
    unit_cost: '0.00',
    total_cost: '0.00',
    cogs_amount: null,
    reference: null,
    notes: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Create default StockTake
 */
export const createDefaultStockTake = (
  companyId: string,
  stockTakeNumber: string,
  stockTakeDate: number,
  deviceId: string
): Partial<StockTake> => {
  const now = Date.now();

  return {
    company_id: companyId,
    stock_take_number: stockTakeNumber,
    stock_take_date: stockTakeDate,
    status: StockTakeStatus.DRAFT,
    counted_by: null,
    approved_by: null,
    notes: null,
    total_variance_value: '0.00',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Create default StockTakeItem
 */
export const createDefaultStockTakeItem = (
  stockTakeId: string,
  inventoryItemId: string,
  systemQuantity: string,
  unitCost: string,
  deviceId: string
): Partial<StockTakeItem> => {
  const now = Date.now();

  return {
    stock_take_id: stockTakeId,
    inventory_item_id: inventoryItemId,
    system_quantity: systemQuantity,
    counted_quantity: '0.0000',
    variance_quantity: '0.0000',
    unit_cost: unitCost,
    variance_value: '0.00',
    notes: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Create default ValuationMethodChange
 */
export const createDefaultValuationMethodChange = (
  companyId: string,
  inventoryItemId: string,
  oldMethod: ValuationMethod,
  newMethod: ValuationMethod,
  changedBy: string,
  deviceId: string
): Partial<ValuationMethodChange> => {
  const now = Date.now();

  return {
    company_id: companyId,
    inventory_item_id: inventoryItemId,
    old_method: oldMethod,
    new_method: newMethod,
    change_date: now,
    changed_by: changedBy,
    old_unit_cost: '0.00',
    new_unit_cost: '0.00',
    old_total_value: '0.00',
    new_total_value: '0.00',
    impact_description: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate InventoryItem
 */
export const validateInventoryItem = (item: Partial<InventoryItem>): string[] => {
  const errors: string[] = [];

  if (!item.company_id) {
    errors.push('company_id is required');
  }

  if (!item.product_id) {
    errors.push('product_id is required');
  }

  if (!item.valuation_method) {
    errors.push('valuation_method is required');
  }

  if (item.quantity_on_hand !== undefined) {
    const qty = parseFloat(item.quantity_on_hand);
    if (isNaN(qty) || qty < 0) {
      errors.push('quantity_on_hand must be non-negative');
    }
  }

  if (item.unit_cost !== undefined) {
    const cost = parseFloat(item.unit_cost);
    if (isNaN(cost) || cost < 0) {
      errors.push('unit_cost must be non-negative');
    }
  }

  if (item.reorder_point !== null && item.reorder_point !== undefined) {
    const reorder = parseFloat(item.reorder_point);
    if (isNaN(reorder) || reorder < 0) {
      errors.push('reorder_point must be non-negative');
    }
  }

  return errors;
};

/**
 * Validate InventoryLayer
 */
export const validateInventoryLayer = (layer: Partial<InventoryLayer>): string[] => {
  const errors: string[] = [];

  if (!layer.company_id) {
    errors.push('company_id is required');
  }

  if (!layer.inventory_item_id) {
    errors.push('inventory_item_id is required');
  }

  if (!layer.transaction_id) {
    errors.push('transaction_id is required');
  }

  if (layer.quantity_purchased !== undefined) {
    const qty = parseFloat(layer.quantity_purchased);
    if (isNaN(qty) || qty <= 0) {
      errors.push('quantity_purchased must be positive');
    }
  }

  if (layer.quantity_remaining !== undefined) {
    const qty = parseFloat(layer.quantity_remaining);
    if (isNaN(qty) || qty < 0) {
      errors.push('quantity_remaining must be non-negative');
    }
  }

  if (layer.unit_cost !== undefined) {
    const cost = parseFloat(layer.unit_cost);
    if (isNaN(cost) || cost < 0) {
      errors.push('unit_cost must be non-negative');
    }
  }

  // Validate remaining <= purchased
  if (
    layer.quantity_remaining !== undefined &&
    layer.quantity_purchased !== undefined
  ) {
    const remaining = parseFloat(layer.quantity_remaining);
    const purchased = parseFloat(layer.quantity_purchased);
    if (remaining > purchased) {
      errors.push('quantity_remaining cannot exceed quantity_purchased');
    }
  }

  return errors;
};

/**
 * Validate StockTake
 */
export const validateStockTake = (stockTake: Partial<StockTake>): string[] => {
  const errors: string[] = [];

  if (!stockTake.company_id) {
    errors.push('company_id is required');
  }

  if (!stockTake.stock_take_number) {
    errors.push('stock_take_number is required');
  }

  if (!stockTake.status) {
    errors.push('status is required');
  }

  return errors;
};

/**
 * Validate StockTakeItem
 */
export const validateStockTakeItem = (item: Partial<StockTakeItem>): string[] => {
  const errors: string[] = [];

  if (!item.stock_take_id) {
    errors.push('stock_take_id is required');
  }

  if (!item.inventory_item_id) {
    errors.push('inventory_item_id is required');
  }

  if (item.system_quantity !== undefined) {
    const qty = parseFloat(item.system_quantity);
    if (isNaN(qty)) {
      errors.push('system_quantity must be a valid number');
    }
  }

  if (item.counted_quantity !== undefined) {
    const qty = parseFloat(item.counted_quantity);
    if (isNaN(qty) || qty < 0) {
      errors.push('counted_quantity must be non-negative');
    }
  }

  return errors;
};

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Query parameters for inventory items
 */
export interface GetInventoryItemsQuery {
  company_id: string;
  product_id?: string;
  valuation_method?: ValuationMethod;
  active?: boolean;
  low_stock?: boolean; // Items below reorder point
}

/**
 * Query parameters for inventory layers
 */
export interface GetInventoryLayersQuery {
  company_id: string;
  inventory_item_id?: string;
  fully_depleted?: boolean;
  from_date?: number;
  to_date?: number;
}

/**
 * Query parameters for inventory transactions
 */
export interface GetInventoryTransactionsQuery {
  company_id: string;
  inventory_item_id?: string;
  transaction_type?: InventoryTransactionType;
  from_date?: number;
  to_date?: number;
}

/**
 * Query parameters for stock takes
 */
export interface GetStockTakesQuery {
  company_id: string;
  status?: StockTakeStatus;
  from_date?: number;
  to_date?: number;
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Get display name for valuation method
 */
export const getValuationMethodDisplay = (method: ValuationMethod): string => {
  const displays: Record<ValuationMethod, string> = {
    FIFO: 'First In, First Out (FIFO)',
    LIFO: 'Last In, First Out (LIFO)',
    WEIGHTED_AVERAGE: 'Weighted Average Cost',
  };
  return displays[method];
};

/**
 * Get short display name for valuation method
 */
export const getValuationMethodShortDisplay = (method: ValuationMethod): string => {
  const displays: Record<ValuationMethod, string> = {
    FIFO: 'FIFO',
    LIFO: 'LIFO',
    WEIGHTED_AVERAGE: 'Weighted Avg',
  };
  return displays[method];
};

/**
 * Get display name for inventory transaction type
 */
export const getInventoryTransactionTypeDisplay = (
  type: InventoryTransactionType
): string => {
  const displays: Record<InventoryTransactionType, string> = {
    PURCHASE: 'Purchase',
    SALE: 'Sale',
    ADJUSTMENT: 'Adjustment',
    STOCK_TAKE: 'Stock Take',
    TRANSFER: 'Transfer',
    RETURN: 'Return',
    DAMAGED: 'Damaged',
  };
  return displays[type];
};

/**
 * Get display name for stock take status
 */
export const getStockTakeStatusDisplay = (status: StockTakeStatus): string => {
  const displays: Record<StockTakeStatus, string> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
  };
  return displays[status];
};

/**
 * Format quantity for display
 */
export const formatQuantity = (quantity: string, decimals: number = 2): string => {
  const qty = parseFloat(quantity);
  if (isNaN(qty)) return '0.00';
  return qty.toFixed(decimals);
};

/**
 * Check if inventory item is below reorder point
 */
export const isLowStock = (item: InventoryItem): boolean => {
  if (!item.reorder_point) return false;

  const qtyOnHand = parseFloat(item.quantity_on_hand);
  const reorderPoint = parseFloat(item.reorder_point);

  return qtyOnHand <= reorderPoint;
};

/**
 * Calculate stock days remaining (simple estimation)
 */
export const calculateStockDays = (
  currentQuantity: string,
  dailyUsage: string
): number | null => {
  const qty = parseFloat(currentQuantity);
  const usage = parseFloat(dailyUsage);

  if (isNaN(qty) || isNaN(usage) || usage <= 0) return null;

  return Math.floor(qty / usage);
};
