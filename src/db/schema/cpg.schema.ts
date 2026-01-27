/**
 * CPG (Consumer Packaged Goods) Schema Definitions
 *
 * Implements cost tracking, distribution analysis, and sales promo calculations
 * for CPG businesses. Supports flexible cost attribution, multi-layered distributor fees,
 * and trade spend analysis.
 *
 * Requirements:
 * - CPU (Cost Per Unit) tracking with historical changes
 * - Flexible cost category attribution (Oil, Bottle, Box, Impact, etc.)
 * - Multi-layered distributor fee structures
 * - Sales promo / trade spend analysis
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { BaseEntity } from '../../types/database.types';

// ============================================================================
// CPG Category - User-defined cost categories (Oil, Bottle, Box, etc.)
// ============================================================================

export interface CPGCategory extends BaseEntity {
  id: string;
  company_id: string;
  name: string; // e.g., "Oil", "Bottle", "Box", "Impact"
  description: string | null;
  variants: string[] | null; // User-defined variants (e.g., ["Small", "Large"] or ["8oz", "16oz", "32oz"] or null for no variants)
  unit_of_measure: string; // e.g., "oz", "ml", "each", "lb", "g"
  sort_order: number; // Display order
  active: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}

export const cpgCategoriesSchema =
  'id, company_id, active, [company_id+active], sort_order, updated_at, deleted_at';

export const createDefaultCPGCategory = (
  companyId: string,
  name: string,
  deviceId: string,
  variants?: string[],
  unitOfMeasure: string = 'each'
): Partial<CPGCategory> => {
  const now = Date.now();
  return {
    company_id: companyId,
    name,
    description: null,
    variants: variants || null, // User provides variants, or null for no variants
    unit_of_measure: unitOfMeasure,
    sort_order: 999,
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: { [deviceId]: 1 },
  };
};

export const validateCPGCategory = (category: Partial<CPGCategory>): string[] => {
  const errors: string[] = [];
  if (!category.company_id) errors.push('company_id is required');
  if (!category.name || category.name.trim() === '') errors.push('name is required');
  return errors;
};

// ============================================================================
// CPG Invoice - Flexible invoice entries with cost attribution
// ============================================================================

export interface CPGInvoice extends BaseEntity {
  id: string;
  company_id: string;
  invoice_number: string | null; // Optional user-provided reference
  invoice_date: number;
  vendor_name: string | null;
  notes: string | null;

  // Attribution tracking - flexible JSON for different category allocations
  // Example: { "Oil_8oz": { unitsPurchased: 100, unitPrice: 5.00 }, ... }
  // Key format: "categoryId_variant" or just "categoryId" if no variant
  cost_attribution: Record<
    string,
    {
      category_id: string;
      variant: string | null; // User-defined variant name (e.g., "8oz", "Small", etc.) or null for no variant
      description?: string; // Optional description of the line item
      units_purchased: string; // Decimal as string for precision
      unit_price: string;
      units_received: string | null; // For reconciliation
    }
  >;

  // Additional costs (shipping, printing, embossing, foil, etc.)
  // Example: { "Shipping": 50.00, "Screen Printing": 75.00 }
  additional_costs: Record<string, string> | null;

  // Calculated fields
  total_paid: string; // Sum of all costs
  // Calculated CPUs stored per variant: { "8oz": "5.23", "16oz": "4.15", ... }
  calculated_cpus: Record<string, string> | null; // variant name → CPU value

  active: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}

export const cpgInvoicesSchema =
  'id, company_id, invoice_date, [company_id+invoice_date], active, updated_at, deleted_at';

export const createDefaultCPGInvoice = (
  companyId: string,
  invoiceDate: number,
  deviceId: string
): Partial<CPGInvoice> => {
  const now = Date.now();
  return {
    company_id: companyId,
    invoice_number: null,
    invoice_date: invoiceDate,
    vendor_name: null,
    notes: null,
    cost_attribution: {},
    additional_costs: null,
    total_paid: '0.00',
    calculated_cpus: null, // Will be calculated after attribution
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: { [deviceId]: 1 },
  };
};

export const validateCPGInvoice = (invoice: Partial<CPGInvoice>): string[] => {
  const errors: string[] = [];
  if (!invoice.company_id) errors.push('company_id is required');
  if (!invoice.invoice_date) errors.push('invoice_date is required');
  return errors;
};

// ============================================================================
// CPG Distributor - Distributor profiles with fee structures
// ============================================================================

export interface CPGDistributor extends BaseEntity {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  contact_info: string | null;

  // Fee structure - flexible to support different fee types
  fee_structure: {
    pallet_cost: string | null; // e.g., "$81.00"
    warehouse_services: string | null; // e.g., "$25.00"
    pallet_build: string | null; // e.g., "$25.00"
    floor_space_full_day: string | null; // e.g., "$100.00"
    floor_space_half_day: string | null; // e.g., "$50.00"
    truck_transfer_zone1: string | null; // e.g., "$100.00"
    truck_transfer_zone2: string | null; // e.g., "$160.00"
    custom_fees: Record<string, string> | null; // For additional user-defined fees
  };

  active: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}

export const cpgDistributorsSchema =
  'id, company_id, name, active, [company_id+active], updated_at, deleted_at';

export const createDefaultCPGDistributor = (
  companyId: string,
  name: string,
  deviceId: string
): Partial<CPGDistributor> => {
  const now = Date.now();
  return {
    company_id: companyId,
    name,
    description: null,
    contact_info: null,
    fee_structure: {
      pallet_cost: null,
      warehouse_services: null,
      pallet_build: null,
      floor_space_full_day: null,
      floor_space_half_day: null,
      truck_transfer_zone1: null,
      truck_transfer_zone2: null,
      custom_fees: null,
    },
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: { [deviceId]: 1 },
  };
};

export const validateCPGDistributor = (distributor: Partial<CPGDistributor>): string[] => {
  const errors: string[] = [];
  if (!distributor.company_id) errors.push('company_id is required');
  if (!distributor.name || distributor.name.trim() === '') errors.push('name is required');
  return errors;
};

// ============================================================================
// CPG Distribution Calculation - Saved distribution cost scenarios
// ============================================================================

export interface CPGDistributionCalculation extends BaseEntity {
  id: string;
  company_id: string;
  distributor_id: string;
  calculation_name: string | null; // User-provided name for saved scenario
  calculation_date: number;

  // Input parameters
  num_pallets: string; // e.g., "1.00"
  units_per_pallet: string; // e.g., "100"

  // Pricing and costs per variant (flexible to support any number of variants)
  // Example: { "8oz": { price: "3.38", baseCPU: "2.15" }, "16oz": { price: "5.50", baseCPU: "3.20" } }
  variant_data: Record<
    string,
    {
      price_per_unit: string;
      base_cpu: string; // From CPG Invoice calculations
    }
  >;

  // Fee selections (which fees apply to this calculation)
  applied_fees: {
    pallet_cost: boolean;
    warehouse_services: boolean;
    pallet_build: boolean;
    floor_space: 'none' | 'full_day' | 'half_day';
    floor_space_days: string | null; // Number of days
    truck_transfer_zone: 'none' | 'zone1' | 'zone2';
    custom_fees: string[] | null; // Array of custom fee names that apply
  };

  // Calculated results
  total_distribution_cost: string;
  distribution_cost_per_unit: string;

  // Results per variant
  // Example: { "8oz": { totalCPU: "2.50", margin: "67.76", msrp: "10.00" }, ... }
  variant_results: Record<
    string,
    {
      total_cpu: string; // Base CPU + Distribution cost per unit
      net_profit_margin: string; // (Price - Total CPU) / Price * 100
      margin_quality: 'poor' | 'good' | 'better' | 'best'; // Color coding
      msrp: string | null; // If MSRP markup applied
    }
  >;
  msrp_markup_percentage: string | null; // e.g., "50" for 50%

  notes: string | null;
  active: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}

export const cpgDistributionCalculationsSchema =
  'id, company_id, distributor_id, [company_id+distributor_id], calculation_date, active, updated_at, deleted_at';

export const createDefaultCPGDistributionCalculation = (
  companyId: string,
  distributorId: string,
  deviceId: string
): Partial<CPGDistributionCalculation> => {
  const now = Date.now();
  return {
    company_id: companyId,
    distributor_id: distributorId,
    calculation_name: null,
    calculation_date: now,
    num_pallets: '1.00',
    units_per_pallet: '0',
    variant_data: {}, // Will be populated by user
    applied_fees: {
      pallet_cost: false,
      warehouse_services: false,
      pallet_build: false,
      floor_space: 'none',
      floor_space_days: null,
      truck_transfer_zone: 'none',
      custom_fees: null,
    },
    total_distribution_cost: '0.00',
    distribution_cost_per_unit: '0.00',
    variant_results: {}, // Calculated results per variant
    msrp_markup_percentage: null,
    notes: null,
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: { [deviceId]: 1 },
  };
};

export const validateCPGDistributionCalculation = (
  calc: Partial<CPGDistributionCalculation>
): string[] => {
  const errors: string[] = [];
  if (!calc.company_id) errors.push('company_id is required');
  if (!calc.distributor_id) errors.push('distributor_id is required');
  return errors;
};

// ============================================================================
// CPG Sales Promo - Trade spend / retailer promotion analysis
// ============================================================================

export interface CPGSalesPromo extends BaseEntity {
  id: string;
  company_id: string;
  promo_name: string;
  retailer_name: string | null;
  promo_start_date: number | null;
  promo_end_date: number | null;

  // Promo parameters
  store_sale_percentage: string; // e.g., "20" for 20% off
  producer_payback_percentage: string; // e.g., "10" for 10% cost-share

  // Variant-specific promo data
  // Example: { "8oz": { retailPrice: "10.00", unitsAvailable: "100", baseCPU: "2.15" }, ... }
  variant_promo_data: Record<
    string,
    {
      retail_price: string;
      units_available: string;
      base_cpu: string; // From CPU calculations
    }
  >;

  // Calculated results per variant
  // Example: { "8oz": { promoCost: "1.00", cpuWithPromo: "3.15", marginWith: "68.5", marginWithout: "78.5" }, ... }
  variant_promo_results: Record<
    string,
    {
      sales_promo_cost_per_unit: string; // Retail price × producer payback %
      cpu_with_promo: string; // Base CPU + Sales promo cost
      net_profit_margin_with_promo: string;
      net_profit_margin_without_promo: string; // For comparison
      margin_quality_with_promo: 'poor' | 'good' | 'better' | 'best';
    }
  >;

  total_promo_cost: string; // Total producer contribution across all variants
  recommendation: 'participate' | 'decline' | 'neutral' | null; // Based on margin thresholds

  notes: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'declined';
  active: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}

export const cpgSalesPromosSchema =
  'id, company_id, retailer_name, promo_start_date, status, active, [company_id+status], updated_at, deleted_at';

export const createDefaultCPGSalesPromo = (
  companyId: string,
  promoName: string,
  deviceId: string
): Partial<CPGSalesPromo> => {
  const now = Date.now();
  return {
    company_id: companyId,
    promo_name: promoName,
    retailer_name: null,
    promo_start_date: null,
    promo_end_date: null,
    store_sale_percentage: '0',
    producer_payback_percentage: '0',
    variant_promo_data: {}, // Will be populated by user
    variant_promo_results: {}, // Calculated results per variant
    total_promo_cost: '0.00',
    recommendation: null,
    notes: null,
    status: 'draft',
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: { [deviceId]: 1 },
  };
};

export const validateCPGSalesPromo = (promo: Partial<CPGSalesPromo>): string[] => {
  const errors: string[] = [];
  if (!promo.company_id) errors.push('company_id is required');
  if (!promo.promo_name || promo.promo_name.trim() === '')
    errors.push('promo_name is required');
  return errors;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate profit margin percentage
 */
export const calculateProfitMargin = (price: string, cost: string): string => {
  const priceNum = parseFloat(price);
  const costNum = parseFloat(cost);
  if (priceNum === 0) return '0.00';
  const margin = ((priceNum - costNum) / priceNum) * 100;
  return margin.toFixed(2);
};

/**
 * Determine profit margin quality (for color coding)
 */
export const getProfitMarginQuality = (
  marginPercentage: string
): 'poor' | 'good' | 'better' | 'best' => {
  const margin = parseFloat(marginPercentage);
  if (margin < 50) return 'poor';
  if (margin < 60) return 'good';
  if (margin < 70) return 'better';
  return 'best';
};

/**
 * Generate CPG category key with variant suffix for cost_attribution tracking
 * Example: generateCategoryKey("Oil", "8oz") => "Oil_8oz"
 * Example: generateCategoryKey("Bottle", null) => "Bottle"
 */
export const generateCategoryKey = (
  categoryName: string,
  variant: string | null
): string => {
  const cleanName = categoryName.replace(/[^a-zA-Z0-9]/g, '');
  if (!variant) return cleanName;
  const cleanVariant = variant.replace(/[^a-zA-Z0-9]/g, '');
  return `${cleanName}_${cleanVariant}`;
};

// ============================================================================
// CPG Finished Product - Products that are manufactured and sold
// ============================================================================

/**
 * CPG Finished Product
 * Represents a product that is manufactured from raw materials and sold to customers.
 */
export interface CPGFinishedProduct extends BaseEntity {
  id: string;
  company_id: string;
  name: string; // e.g., "1oz Body Oil"
  description: string | null;
  sku: string | null; // e.g., "BO-1OZ"
  msrp: string | null; // Manufacturer's Suggested Retail Price (e.g., "10.00")
  unit_of_measure: string; // e.g., "each", "case", "dozen"
  pieces_per_unit: number; // How many individual items in one unit (default: 1)
                           // Example: "case" with pieces_per_unit: 12 = 12 bottles per case
  active: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}

export const cpgFinishedProductsSchema =
  'id, company_id, [company_id+active], sku, active, updated_at, deleted_at';

/**
 * Create a default CPG finished product with all required fields
 */
export const createDefaultCPGFinishedProduct = (
  companyId: string,
  name: string,
  deviceId: string
): Partial<CPGFinishedProduct> => {
  const now = Date.now();
  return {
    company_id: companyId,
    name,
    description: null,
    sku: null,
    msrp: null,
    unit_of_measure: 'each',
    pieces_per_unit: 1,
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: { [deviceId]: 1 },
  };
};

/**
 * Validate a CPG finished product
 * Returns array of error messages (empty if valid)
 */
export const validateCPGFinishedProduct = (
  product: Partial<CPGFinishedProduct>,
  existingProducts?: CPGFinishedProduct[]
): string[] => {
  const errors: string[] = [];

  // company_id required
  if (!product.company_id) {
    errors.push('company_id is required');
  }

  // name required, non-empty
  if (!product.name || product.name.trim() === '') {
    errors.push('name is required');
  }

  // name must be unique within company
  if (product.name && product.company_id && existingProducts) {
    const duplicate = existingProducts.find(
      (p) =>
        p.id !== product.id &&
        p.company_id === product.company_id &&
        p.name.toLowerCase() === product.name!.toLowerCase() &&
        p.deleted_at === null
    );
    if (duplicate) {
      errors.push(`A product named "${product.name}" already exists`);
    }
  }

  // sku optional, but if provided must be unique within company
  if (product.sku && product.company_id && existingProducts) {
    const duplicate = existingProducts.find(
      (p) =>
        p.id !== product.id &&
        p.company_id === product.company_id &&
        p.sku === product.sku &&
        p.deleted_at === null
    );
    if (duplicate) {
      errors.push(`SKU "${product.sku}" is already in use`);
    }
  }

  // msrp optional, but if provided must be valid currency format
  if (product.msrp !== null && product.msrp !== undefined && product.msrp !== '') {
    const msrpNum = parseFloat(product.msrp);
    if (isNaN(msrpNum)) {
      errors.push('MSRP must be a valid number');
    } else if (msrpNum < 0) {
      errors.push('MSRP cannot be negative');
    }
  }

  // unit_of_measure required
  if (!product.unit_of_measure || product.unit_of_measure.trim() === '') {
    errors.push('unit_of_measure is required');
  }

  // pieces_per_unit required, must be integer >= 1
  if (product.pieces_per_unit === null || product.pieces_per_unit === undefined) {
    errors.push('pieces_per_unit is required');
  } else if (
    !Number.isInteger(product.pieces_per_unit) ||
    product.pieces_per_unit < 1
  ) {
    errors.push('pieces_per_unit must be an integer >= 1');
  }

  return errors;
};

// ============================================================================
// CPG Recipe - Bill of Materials for finished products
// ============================================================================

/**
 * CPG Recipe
 * Represents a single line item in a Bill of Materials (BOM).
 * Each recipe line specifies one raw material component needed to make a finished product.
 */
export interface CPGRecipe extends BaseEntity {
  id: string;
  company_id: string;
  finished_product_id: string; // Links to cpg_finished_products

  // Raw material component
  category_id: string; // Links to cpg_categories
  variant: string | null; // Specific variant (e.g., "1oz")

  // Quantity needed
  quantity: string; // e.g., "1.00" for 1oz oil, "1" for 1 bottle

  // Metadata
  notes: string | null;
  active: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}

export const cpgRecipesSchema =
  'id, company_id, finished_product_id, category_id, [company_id+finished_product_id], active, updated_at, deleted_at';

/**
 * Create a default CPG recipe with all required fields
 */
export const createDefaultCPGRecipe = (
  companyId: string,
  finishedProductId: string,
  categoryId: string,
  deviceId: string
): Partial<CPGRecipe> => {
  const now = Date.now();
  return {
    company_id: companyId,
    finished_product_id: finishedProductId,
    category_id: categoryId,
    variant: null,
    quantity: '1.00',
    notes: null,
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: { [deviceId]: 1 },
  };
};

/**
 * Validate a CPG recipe
 * Returns array of error messages (empty if valid)
 */
export const validateCPGRecipe = (
  recipe: Partial<CPGRecipe>,
  existingRecipes?: CPGRecipe[]
): string[] => {
  const errors: string[] = [];

  // company_id required
  if (!recipe.company_id) {
    errors.push('company_id is required');
  }

  // finished_product_id required
  if (!recipe.finished_product_id) {
    errors.push('finished_product_id is required');
  }

  // category_id required
  if (!recipe.category_id) {
    errors.push('category_id is required');
  }

  // quantity must be > 0
  if (!recipe.quantity || recipe.quantity.trim() === '') {
    errors.push('quantity is required');
  } else {
    const quantityNum = parseFloat(recipe.quantity);
    if (isNaN(quantityNum)) {
      errors.push('quantity must be a valid number');
    } else if (quantityNum <= 0) {
      errors.push('quantity must be greater than 0');
    }
  }

  // Cannot have duplicate category_id + variant in same recipe
  if (
    recipe.finished_product_id &&
    recipe.category_id &&
    existingRecipes
  ) {
    const normalizedVariant = normalizeVariant(recipe.variant || null);
    const duplicate = existingRecipes.find(
      (r) =>
        r.id !== recipe.id &&
        r.finished_product_id === recipe.finished_product_id &&
        r.category_id === recipe.category_id &&
        normalizeVariant(r.variant) === normalizedVariant &&
        r.deleted_at === null
    );
    if (duplicate) {
      errors.push(
        'This category and variant combination is already in the recipe'
      );
    }
  }

  return errors;
};

// ============================================================================
// Referential Integrity Helper Functions
// ============================================================================

/**
 * Check if a category is used in any recipes
 * Returns the count of recipes using this category
 */
export const checkCategoryInUse = async (
  categoryId: string
): Promise<number> => {
  const { db } = await import('../database');
  return await db.cpgRecipes
    .where('category_id')
    .equals(categoryId)
    .and((recipe) => recipe.deleted_at === null)
    .count();
};

/**
 * Check if a finished product has any recipes
 * Returns the count of recipes for this product
 */
export const checkFinishedProductHasRecipes = async (
  productId: string
): Promise<number> => {
  const { db } = await import('../database');
  return await db.cpgRecipes
    .where('finished_product_id')
    .equals(productId)
    .and((recipe) => recipe.deleted_at === null)
    .count();
};

// ============================================================================
// Variant Normalization Utility
// ============================================================================

/**
 * Normalize variant strings for consistent matching
 * Converts to lowercase and removes spaces, hyphens, and underscores
 * Example: "1 oz" -> "1oz", "1-oz" -> "1oz", "1_oz" -> "1oz"
 */
export function normalizeVariant(variant: string | null): string | null {
  if (!variant) return null;
  return variant.toLowerCase().replace(/[\s\-_]/g, '');
}
