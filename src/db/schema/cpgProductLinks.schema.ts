/**
 * CPG Product Links Schema Definition
 *
 * Links CPG categories and variants to accounting products/SKUs for integrated mode.
 * Enables seamless invoice entry that creates both CPG cost tracking and accounting transactions.
 *
 * Requirements:
 * - Map CPG categories to accounting products
 * - Map CPG variants to specific SKUs
 * - Associate COGS and Inventory accounts with each link
 * - Support flexible variant mapping (not hardcoded)
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { BaseEntity } from '../../types/database.types';

/**
 * CPG Product Link - Maps CPG categories/variants to accounting products
 *
 * Example Mapping:
 * - CPG Category: "Oil"
 * - CPG Variant: "8oz"
 * - Product ID: "prod_123" (8oz Olive Oil SKU)
 * - COGS Account: "5000" (Cost of Goods Sold)
 * - Inventory Account: "1300" (Inventory - Raw Materials)
 */
export interface CPGProductLink extends BaseEntity {
  id: string;
  company_id: string;

  // CPG side
  cpg_category_id: string; // Links to cpgCategories table
  cpg_variant: string | null; // User-defined variant (e.g., "8oz", "Small", null for no variant)

  // Accounting side
  product_id: string; // Links to products table (accounting SKU)
  account_id_cogs: string; // COGS account for journal entries
  account_id_inventory: string; // Inventory account for journal entries

  // Metadata
  notes: string | null;
  active: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}

/**
 * Dexie.js schema definition for CPG Product Links table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying links by company
 * - cpg_category_id: For querying by category
 * - product_id: For querying by product
 * - [company_id+cpg_category_id]: Compound index for category queries
 * - [company_id+product_id]: Compound index for product queries
 * - [company_id+active]: Compound index for active links
 * - updated_at: For CRDT conflict resolution
 */
export const cpgProductLinksSchema =
  'id, company_id, cpg_category_id, product_id, [company_id+cpg_category_id], [company_id+product_id], [company_id+active], active, updated_at, deleted_at';

/**
 * Table name constant
 */
export const CPG_PRODUCT_LINKS_TABLE = 'cpg_product_links';

/**
 * Default values for new CPG Product Link
 */
export const createDefaultCPGProductLink = (
  companyId: string,
  cpgCategoryId: string,
  productId: string,
  accountIdCOGS: string,
  accountIdInventory: string,
  deviceId: string,
  cpgVariant?: string | null
): Partial<CPGProductLink> => {
  const now = Date.now();

  return {
    company_id: companyId,
    cpg_category_id: cpgCategoryId,
    cpg_variant: cpgVariant || null,
    product_id: productId,
    account_id_cogs: accountIdCOGS,
    account_id_inventory: accountIdInventory,
    notes: null,
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
 * Validation: Ensure link has valid fields
 */
export const validateCPGProductLink = (link: Partial<CPGProductLink>): string[] => {
  const errors: string[] = [];

  if (!link.company_id) {
    errors.push('company_id is required');
  }

  if (!link.cpg_category_id) {
    errors.push('cpg_category_id is required');
  }

  if (!link.product_id) {
    errors.push('product_id is required');
  }

  if (!link.account_id_cogs) {
    errors.push('account_id_cogs is required');
  }

  if (!link.account_id_inventory) {
    errors.push('account_id_inventory is required');
  }

  return errors;
};

/**
 * Query helper: Find link for category and variant
 */
export interface FindCPGProductLinkQuery {
  company_id: string;
  cpg_category_id: string;
  cpg_variant?: string | null;
}

/**
 * Query helper: Get all links for a company
 */
export interface GetCPGProductLinksQuery {
  company_id: string;
  cpg_category_id?: string;
  product_id?: string;
  active?: boolean;
}

/**
 * Product link summary for display
 */
export interface CPGProductLinkSummary extends CPGProductLink {
  category_name?: string;
  product_name?: string;
  product_sku?: string;
  cogs_account_name?: string;
  inventory_account_name?: string;
}

/**
 * Helper: Generate unique key for category + variant combination
 * Matches the pattern used in cost_attribution
 */
export const getCPGProductLinkKey = (
  categoryName: string,
  variant: string | null
): string => {
  const cleanName = categoryName.replace(/[^a-zA-Z0-9]/g, '');
  if (!variant) return cleanName;
  const cleanVariant = variant.replace(/[^a-zA-Z0-9]/g, '');
  return `${cleanName}_${cleanVariant}`;
};

/**
 * Helper: Check if link exists for category + variant
 */
export const hasProductLink = (
  links: CPGProductLink[],
  categoryId: string,
  variant: string | null
): boolean => {
  return links.some(
    (link) =>
      link.cpg_category_id === categoryId &&
      link.cpg_variant === variant &&
      link.active &&
      link.deleted_at === null
  );
};

/**
 * Helper: Get link for category + variant
 */
export const findProductLink = (
  links: CPGProductLink[],
  categoryId: string,
  variant: string | null
): CPGProductLink | null => {
  return (
    links.find(
      (link) =>
        link.cpg_category_id === categoryId &&
        link.cpg_variant === variant &&
        link.active &&
        link.deleted_at === null
    ) || null
  );
};

/**
 * Helper: Validate all links exist for invoice
 * Returns list of missing links
 */
export const validateInvoiceLinks = (
  links: CPGProductLink[],
  costAttribution: Record<string, { category_id: string; variant: string | null }>
): Array<{ categoryId: string; variant: string | null }> => {
  const missing: Array<{ categoryId: string; variant: string | null }> = [];

  for (const attr of Object.values(costAttribution)) {
    const hasLink = hasProductLink(links, attr.category_id, attr.variant);
    if (!hasLink) {
      missing.push({
        categoryId: attr.category_id,
        variant: attr.variant,
      });
    }
  }

  return missing;
};

/**
 * Bulk link creation result
 */
export interface BulkLinkCreationResult {
  created: number;
  skipped: number;
  errors: string[];
}
