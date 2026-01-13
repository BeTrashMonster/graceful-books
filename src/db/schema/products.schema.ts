/**
 * Products Schema Definition
 *
 * Defines the structure for products and services catalog.
 * Supports both physical products and services with pricing and cost tracking.
 *
 * Requirements:
 * - Product/service catalog management
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { Product, ProductType } from '../../types/database.types';

/**
 * Dexie.js schema definition for Products table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying products by company
 * - type: For querying by product type (PRODUCT, SERVICE)
 * - active: For querying only active products
 * - [company_id+type]: Compound index for filtered queries
 * - [company_id+active]: Compound index for active product queries
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const productsSchema = 'id, company_id, type, active, [company_id+type], [company_id+active], updated_at, deleted_at';

/**
 * Table name constant
 */
export const PRODUCTS_TABLE = 'products';

/**
 * Default values for new Product
 */
export const createDefaultProduct = (
  companyId: string,
  name: string,
  type: ProductType,
  deviceId: string
): Partial<Product> => {
  const now = Date.now();

  return {
    company_id: companyId,
    type,
    sku: null,
    name,
    description: null,
    unit_price: '0.00',
    cost: null,
    income_account_id: null,
    expense_account_id: null,
    taxable: true,
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
 * Validation: Ensure product has valid fields
 */
export const validateProduct = (product: Partial<Product>): string[] => {
  const errors: string[] = [];

  if (!product.company_id) {
    errors.push('company_id is required');
  }

  if (!product.name || product.name.trim() === '') {
    errors.push('name is required');
  }

  if (!product.type) {
    errors.push('type is required');
  }

  if (product.unit_price === undefined || product.unit_price === null) {
    errors.push('unit_price is required');
  }

  // Validate price is non-negative
  const price = parseFloat(product.unit_price || '0');
  if (price < 0) {
    errors.push('unit_price must be non-negative');
  }

  // Validate cost is non-negative if provided
  if (product.cost !== null && product.cost !== undefined) {
    const cost = parseFloat(product.cost || '0');
    if (cost < 0) {
      errors.push('cost must be non-negative');
    }
  }

  return errors;
};

/**
 * Query helper: Get all products for a company
 */
export interface GetProductsQuery {
  company_id: string;
  type?: ProductType;
  active?: boolean;
  taxable?: boolean;
  search?: string; // Search by name, SKU, or description
}

/**
 * Product summary for reporting
 */
export interface ProductSummary extends Product {
  quantity_sold?: number;
  total_revenue?: string;
  total_cost?: string;
  gross_profit?: string;
  gross_margin_percentage?: number;
}

/**
 * Product pricing information
 */
export interface ProductPricing {
  product_id: string;
  base_price: string;
  discount_percentage?: number;
  discounted_price?: string;
  tax_rate?: number;
  final_price?: string;
}

/**
 * Helper: Calculate gross margin
 */
export const calculateGrossMargin = (
  unitPrice: string,
  cost: string | null
): {
  grossProfit: string;
  grossMarginPercentage: number;
} => {
  const price = parseFloat(unitPrice || '0');
  const productCost = parseFloat(cost || '0');

  const grossProfit = price - productCost;
  const grossMarginPercentage = price > 0 ? (grossProfit / price) * 100 : 0;

  return {
    grossProfit: grossProfit.toFixed(2),
    grossMarginPercentage: parseFloat(grossMarginPercentage.toFixed(2)),
  };
};

/**
 * Helper: Calculate price with discount
 */
export const calculateDiscountedPrice = (
  unitPrice: string,
  discountPercentage: number
): string => {
  const price = parseFloat(unitPrice || '0');
  const discount = (price * discountPercentage) / 100;
  const discountedPrice = price - discount;
  return discountedPrice.toFixed(2);
};

/**
 * Helper: Calculate price with tax
 */
export const calculatePriceWithTax = (
  unitPrice: string,
  taxRate: number
): {
  priceBeforeTax: string;
  taxAmount: string;
  priceWithTax: string;
} => {
  const price = parseFloat(unitPrice || '0');
  const taxAmount = (price * taxRate) / 100;
  const priceWithTax = price + taxAmount;

  return {
    priceBeforeTax: price.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    priceWithTax: priceWithTax.toFixed(2),
  };
};

/**
 * Helper: Format product name for display
 */
export const formatProductName = (product: Product): string => {
  if (product.sku) {
    return `${product.sku} - ${product.name}`;
  }
  return product.name;
};

/**
 * Helper: Get product type display
 */
export const getProductTypeDisplay = (type: ProductType): string => {
  const displays: Record<ProductType, string> = {
    PRODUCT: 'Product',
    SERVICE: 'Service',
  };
  return displays[type];
};

/**
 * Helper: Determine if product is profitable
 */
export const isProfitable = (product: Product): boolean => {
  if (!product.cost) {
    return true; // No cost data, assume profitable
  }

  const price = parseFloat(product.unit_price || '0');
  const cost = parseFloat(product.cost || '0');
  return price > cost;
};

/**
 * Helper: Search products by multiple fields
 */
export const searchProducts = (
  products: Product[],
  searchTerm: string
): Product[] => {
  const term = searchTerm.toLowerCase().trim();

  if (!term) {
    return products;
  }

  return products.filter((product) => {
    return (
      product.name.toLowerCase().includes(term) ||
      product.sku?.toLowerCase().includes(term) ||
      product.description?.toLowerCase().includes(term)
    );
  });
};

/**
 * Standard product categories (optional, for future categorization)
 */
export enum ProductCategory {
  INVENTORY = 'INVENTORY',
  NON_INVENTORY = 'NON_INVENTORY',
  SERVICE = 'SERVICE',
  BUNDLE = 'BUNDLE',
}

/**
 * Product bundle (for future implementation)
 * Allows combining multiple products into a bundle
 */
export interface ProductBundle {
  id: string;
  name: string;
  description: string | null;
  products: Array<{
    product_id: string;
    quantity: number;
  }>;
  bundle_price: string;
}

/**
 * Price tier (for future implementation)
 * Allows different pricing based on quantity
 */
export interface PriceTier {
  product_id: string;
  min_quantity: number;
  max_quantity: number | null;
  unit_price: string;
}

/**
 * Helper: Generate SKU from product name
 * Simple algorithm for auto-generating SKUs
 */
export const generateSKU = (productName: string, sequence: number): string => {
  // Take first 3 letters of product name (uppercase)
  const prefix = productName
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');

  // Add sequence number padded to 4 digits
  const paddedSequence = sequence.toString().padStart(4, '0');

  return `${prefix}-${paddedSequence}`;
};

/**
 * Helper: Validate SKU uniqueness
 */
export const isUniqueSKU = (sku: string, products: Product[], excludeId?: string): boolean => {
  return !products.some(
    (product) =>
      product.sku?.toLowerCase() === sku.toLowerCase() &&
      product.id !== excludeId &&
      product.deleted_at === null
  );
};
