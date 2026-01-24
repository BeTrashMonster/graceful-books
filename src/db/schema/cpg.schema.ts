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
  variants?: string[]
): Partial<CPGCategory> => {
  const now = Date.now();
  return {
    company_id: companyId,
    name,
    description: null,
    variants: variants || null, // User provides variants, or null for no variants
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
