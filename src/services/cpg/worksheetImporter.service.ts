/**
 * CPG Worksheet Importer Service
 *
 * Imports data from the CPG Quick Start Worksheet JSON export into the database.
 *
 * Transformations:
 * - Maps temp-* IDs to real UUIDs
 * - Adds required database fields (company_id, timestamps, version_vector, etc.)
 * - Transforms invoice items array → cost_attribution object
 * - Converts date strings → timestamps
 * - Sets defaults for optional fields
 *
 * Import Order:
 * 1. Categories (so recipes can reference them)
 * 2. Finished Products (so recipes can reference them)
 * 3. Recipes (references categories + products)
 * 4. Invoices (references categories)
 */

import { db } from '../../db/database';
import { generateId } from '../../utils/device';
import { logger } from '../../utils/logger';
import { CPUCalculatorService } from './cpuCalculator.service';
import type {
  CPGCategory,
  CPGFinishedProduct,
  CPGRecipe,
  CPGInvoice,
} from '../../db/schema/cpg.schema';

// ============================================================================
// Types matching the worksheet export format
// ============================================================================

interface WorksheetCategory {
  id: string;
  name: string;
  variants: string[];
  sort_order: number;
  is_distribution_category?: boolean; // For Shipping & Handling
}

interface WorksheetFinishedProduct {
  id: string;
  name: string;
  msrp: string;
  sku: string;
}

interface WorksheetRecipeItem {
  category_id: string;
  variant?: string;
  quantity: string;
  unit: string; // unit_of_measurement
}

interface WorksheetRecipe {
  product_id: string;
  items: WorksheetRecipeItem[];
}

interface WorksheetInvoiceItem {
  category_id: string;
  variant?: string;
  quantity: string;
  unit: string; // unit_of_measurement
  unit_cost: string;
  line_total: string; // Calculated line total (to avoid rounding errors)
  is_personal?: boolean; // True if personal item (not business expense)
  distribution_method?: 'equal' | 'weighted'; // For S+H categories
}

interface WorksheetInvoice {
  id: string;
  vendor_name: string;
  invoice_date: string;
  invoice_number?: string;
  invoice_total?: string; // Total invoice amount (user-entered for balance validation)
  items: WorksheetInvoiceItem[];
  notes?: string;
}

export interface WorksheetData {
  version: string;
  created_at: string;
  categories: WorksheetCategory[];
  finished_products: WorksheetFinishedProduct[];
  recipes: WorksheetRecipe[];
  invoices: WorksheetInvoice[];
}

export interface ImportResult {
  success: boolean;
  errors: string[];
  counts: {
    categories: number;
    products: number;
    recipes: number;
    invoices: number;
  };
  idMap?: Map<string, string>; // temp ID → real UUID mapping (for debugging)
}

export interface ImportWarning {
  type: 'info' | 'warning' | 'suggestion';
  title: string;
  message: string;
}

export interface ReviewResult {
  warnings: ImportWarning[];
  summary: {
    categories: number;
    products: number;
    recipes: number;
    invoices: number;
  };
  hasBlockingIssues: boolean;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Review worksheet data and generate helpful warnings about potential gaps
 */
export function reviewWorksheetData(json: WorksheetData): ReviewResult {
  const warnings: ImportWarning[] = [];

  // Check for products without recipes
  const productsWithRecipes = new Set(json.recipes.map(r => r.product_id));
  const productsWithoutRecipes = json.finished_products.filter(
    p => !productsWithRecipes.has(p.id)
  );

  if (productsWithoutRecipes.length > 0) {
    warnings.push({
      type: 'warning',
      title: 'Products without recipes',
      message: `${productsWithoutRecipes.length} product${productsWithoutRecipes.length > 1 ? 's' : ''} (${productsWithoutRecipes.map(p => p.name).join(', ')}) don't have recipes yet. You won't see cost breakdowns for these products until you add their recipes.`,
    });
  }

  // Check for categories without any invoices
  const categoriesInInvoices = new Set(
    json.invoices.flatMap(inv => inv.items.map(item => item.category_id))
  );
  const categoriesWithoutInvoices = json.categories.filter(
    c => !categoriesInInvoices.has(c.id)
  );

  if (categoriesWithoutInvoices.length > 0) {
    warnings.push({
      type: 'suggestion',
      title: 'Categories without invoices',
      message: `${categoriesWithoutInvoices.length} categor${categoriesWithoutInvoices.length > 1 ? 'ies' : 'y'} (${categoriesWithoutInvoices.map(c => c.name).join(', ')}) don't appear on any invoices. You won't see costs for these until you add invoices.`,
    });
  }

  // Check for recipes using categories without invoices
  const categoriesInRecipes = new Set(
    json.recipes.flatMap(r => r.items.map(item => item.category_id))
  );
  const recipesMissingInvoices = Array.from(categoriesInRecipes).filter(
    catId => !categoriesInInvoices.has(catId)
  );

  if (recipesMissingInvoices.length > 0) {
    const categoryNames = recipesMissingInvoices
      .map(id => json.categories.find(c => c.id === id)?.name)
      .filter(Boolean);

    warnings.push({
      type: 'warning',
      title: 'Recipe ingredients without costs',
      message: `Some recipes use ingredients (${categoryNames.join(', ')}) that don't have any invoices yet. You won't see accurate product costs until you add invoices for these ingredients.`,
    });
  }

  // Check for missing vendor names
  const invoicesWithoutVendor = json.invoices.filter(
    inv => !inv.vendor_name || inv.vendor_name.trim() === ''
  );

  if (invoicesWithoutVendor.length > 0) {
    warnings.push({
      type: 'info',
      title: 'Invoices without vendor names',
      message: `${invoicesWithoutVendor.length} invoice${invoicesWithoutVendor.length > 1 ? 's' : ''} missing vendor names. This is okay, but vendor names help you track where materials came from.`,
    });
  }

  // Positive feedback if everything looks good
  if (warnings.length === 0) {
    warnings.push({
      type: 'info',
      title: 'Looking good!',
      message: 'All your products have recipes, all ingredients have invoices, and everything is connected. Nice work! 🎉',
    });
  }

  return {
    warnings,
    summary: {
      categories: json.categories.length,
      products: json.finished_products.length,
      recipes: json.recipes.length,
      invoices: json.invoices.length,
    },
    hasBlockingIssues: false, // We allow import even with warnings
  };
}

/**
 * Validate worksheet data before import
 */
export function validateWorksheetData(
  json: WorksheetData,
  companyId: string
): string[] {
  const errors: string[] = [];

  // Check version
  if (!json.version || json.version !== '1.0.0') {
    errors.push('Unsupported worksheet version. Expected 1.0.0');
  }

  // Check company_id provided
  if (!companyId || typeof companyId !== 'string') {
    errors.push('Invalid company ID. User must be logged in.');
  }

  // Check temp IDs are valid
  const tempIdRegex = /^temp-\d+-[a-z0-9]+$/;

  json.categories?.forEach((c, idx) => {
    if (!tempIdRegex.test(c.id)) {
      errors.push(`Invalid category ID at index ${idx}: ${c.id}`);
    }
    if (!c.name || c.name.trim() === '') {
      errors.push(`Category at index ${idx} has no name`);
    }
  });

  json.finished_products?.forEach((p, idx) => {
    if (!tempIdRegex.test(p.id)) {
      errors.push(`Invalid product ID at index ${idx}: ${p.id}`);
    }
    if (!p.name || p.name.trim() === '') {
      errors.push(`Product at index ${idx} has no name`);
    }
    if (!p.msrp || isNaN(parseFloat(p.msrp))) {
      errors.push(`Product "${p.name}" has invalid MSRP: ${p.msrp}`);
    }
  });

  // Check recipe references exist
  json.recipes?.forEach((r, idx) => {
    const product = json.finished_products?.find(p => p.id === r.product_id);
    if (!product) {
      errors.push(`Recipe at index ${idx} references missing product: ${r.product_id}`);
    }

    r.items?.forEach((item, itemIdx) => {
      const category = json.categories?.find(c => c.id === item.category_id);
      if (!category) {
        errors.push(
          `Recipe at index ${idx}, item ${itemIdx} references missing category: ${item.category_id}`
        );
      }
      if (!item.quantity || isNaN(parseFloat(item.quantity))) {
        errors.push(
          `Recipe at index ${idx}, item ${itemIdx} has invalid quantity: ${item.quantity}`
        );
      }
      if (!item.unit || item.unit.trim() === '') {
        errors.push(
          `Recipe at index ${idx}, item ${itemIdx} has no unit of measurement`
        );
      }
    });
  });

  // Check invoice references exist
  json.invoices?.forEach((inv, idx) => {
    if (!inv.vendor_name || inv.vendor_name.trim() === '') {
      errors.push(`Invoice at index ${idx} has no vendor name`);
    }
    if (!inv.invoice_date) {
      errors.push(`Invoice at index ${idx} has no date`);
    } else {
      // Validate that the date string can be parsed to a valid timestamp
      const parsedDate = new Date(inv.invoice_date).getTime();
      if (isNaN(parsedDate)) {
        errors.push(`Invoice at index ${idx} has invalid date format: ${inv.invoice_date}`);
      }
    }

    inv.items?.forEach((item, itemIdx) => {
      // Skip category validation for Personal Items (they don't have a category)
      const isPersonal = item.is_personal || item.category_id === '__personal__';
      if (!isPersonal) {
        const category = json.categories?.find(c => c.id === item.category_id);
        if (!category) {
          errors.push(
            `Invoice at index ${idx}, item ${itemIdx} references missing category: ${item.category_id}`
          );
        }
      }
      if (!item.quantity || isNaN(parseFloat(item.quantity))) {
        errors.push(
          `Invoice at index ${idx}, item ${itemIdx} has invalid quantity: ${item.quantity}`
        );
      }
      if (!item.unit || item.unit.trim() === '') {
        errors.push(
          `Invoice at index ${idx}, item ${itemIdx} has no unit of measurement`
        );
      }
      if (!item.unit_cost || isNaN(parseFloat(item.unit_cost))) {
        errors.push(
          `Invoice at index ${idx}, item ${itemIdx} has invalid unit cost: ${item.unit_cost}`
        );
      }
      if (!item.line_total || isNaN(parseFloat(item.line_total))) {
        errors.push(
          `Invoice at index ${idx}, item ${itemIdx} has invalid line total: ${item.line_total}`
        );
      }
    });
  });

  return errors;
}

// ============================================================================
// Import Function
// ============================================================================

/**
 * Import worksheet data into the database
 *
 * @param json - Worksheet data from JSON export
 * @param companyId - Company ID from logged-in user
 * @param deviceId - Device ID for version vector
 * @returns Import result with counts and any errors
 */
export async function importWorksheetData(
  json: WorksheetData,
  companyId: string,
  deviceId: string
): Promise<ImportResult> {
  // Log import start with key details
  logger.info('Starting worksheet import', {
    companyId,
    deviceId,
    dataReceived: {
      categories: json.categories?.length ?? 0,
      products: json.finished_products?.length ?? 0,
      recipes: json.recipes?.length ?? 0,
      invoices: json.invoices?.length ?? 0,
    },
  });

  const result: ImportResult = {
    success: false,
    errors: [],
    counts: {
      categories: 0,
      products: 0,
      recipes: 0,
      invoices: 0,
    },
  };

  // Validate companyId is present
  if (!companyId || companyId.trim() === '') {
    logger.error('Import failed: No companyId provided');
    result.errors.push('No company ID provided. Please refresh the page and try again.');
    return result;
  }

  // Validate first
  const validationErrors = validateWorksheetData(json, companyId);
  if (validationErrors.length > 0) {
    result.errors = validationErrors;
    return result;
  }

  const idMap = new Map<string, string>();
  const now = Date.now();
  const cpuService = new CPUCalculatorService();

  try {
    // ========================================================================
    // 1. Import Categories
    // ========================================================================
    logger.info('Importing categories...', { count: json.categories.length });

    for (const cat of json.categories) {
      const realId = generateId();
      idMap.set(cat.id, realId);

      const dbCategory: CPGCategory = {
        id: realId,
        company_id: companyId,
        name: cat.name,
        description: null,
        variants: cat.variants.length > 0 ? cat.variants : null,
        unit_of_measure: 'each', // Default - user can change later
        sort_order: cat.sort_order,
        is_distribution_category: cat.is_distribution_category || false, // Mark S+H categories
        active: true,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version_vector: { [deviceId]: 1 },
      };

      await db.cpgCategories.add(dbCategory);
      result.counts.categories++;
    }

    logger.info('Categories imported', { count: result.counts.categories });

    // ========================================================================
    // 2. Import Finished Products
    // ========================================================================
    logger.info('Importing products...', { count: json.finished_products.length });

    for (const prod of json.finished_products) {
      const realId = generateId();
      idMap.set(prod.id, realId);

      const dbProduct: CPGFinishedProduct = {
        id: realId,
        company_id: companyId,
        name: prod.name,
        description: null,
        sku: prod.sku && prod.sku.trim() !== '' ? prod.sku : null, // FIX: Empty string → null
        msrp: prod.msrp,
        unit_of_measure: 'each', // Default - user can change later
        pieces_per_unit: 1, // Default
        active: true,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version_vector: { [deviceId]: 1 },
      };

      await db.cpgFinishedProducts.add(dbProduct);
      result.counts.products++;
    }

    logger.info('Products imported', { count: result.counts.products });

    // ========================================================================
    // 3. Import Recipes
    // ========================================================================
    logger.info('Importing recipes...', { count: json.recipes.length });

    for (const recipe of json.recipes) {
      const realProductId = idMap.get(recipe.product_id);
      if (!realProductId) {
        result.errors.push(`Recipe references unmapped product: ${recipe.product_id}`);
        continue;
      }

      for (const item of recipe.items) {
        const realCategoryId = idMap.get(item.category_id);
        if (!realCategoryId) {
          result.errors.push(`Recipe item references unmapped category: ${item.category_id}`);
          continue;
        }

        const dbRecipe: CPGRecipe = {
          id: generateId(),
          company_id: companyId,
          finished_product_id: realProductId,
          category_id: realCategoryId,
          variant: item.variant || null,
          quantity: item.quantity,
          unit_of_measurement: item.unit, // FIX: Include unit from worksheet
          notes: null,
          active: true,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          version_vector: { [deviceId]: 1 },
        };

        await db.cpgRecipes.add(dbRecipe);
        result.counts.recipes++;
      }
    }

    logger.info('Recipes imported', { count: result.counts.recipes });

    // ========================================================================
    // 4. Import Invoices (requires transformation)
    // ========================================================================
    logger.info('Importing invoices...', { count: json.invoices.length });

    for (const inv of json.invoices) {
      // Transform items array → cost_attribution object
      const cost_attribution: Record<string, any> = {};

      // Validate invoice balance (if invoice_total provided)
      if (inv.invoice_total) {
        const invoiceTotal = parseFloat(inv.invoice_total);
        const lineItemsTotal = inv.items.reduce((sum, item) => {
          return sum + parseFloat(item.line_total);
        }, 0);

        const diff = Math.abs(invoiceTotal - lineItemsTotal);
        if (diff > 0.01) {
          result.errors.push(
            `Invoice "${inv.vendor_name}" (${inv.invoice_date}): Line items ($${lineItemsTotal.toFixed(2)}) don't match invoice total ($${invoiceTotal.toFixed(2)}). Difference: $${diff.toFixed(2)}`
          );
          continue; // Skip this invoice
        }
      }

      for (const item of inv.items) {
        // Handle Personal Items specially (they don't have a real category)
        const isPersonal = item.is_personal || item.category_id === '__personal__';
        let realCategoryId: string;

        if (isPersonal) {
          realCategoryId = 'personal'; // Use sentinel value for personal items
        } else {
          realCategoryId = idMap.get(item.category_id) || '';
          if (!realCategoryId) {
            result.errors.push(`Invoice item references unmapped category: ${item.category_id}`);
            continue;
          }
        }

        // Generate key: categoryId_variant (or categoryId if no variant)
        const variantSuffix = item.variant ? `_${item.variant.replace(/\s/g, '')}` : '';
        const key = isPersonal ? `personal_${generateId()}` : `${realCategoryId}${variantSuffix}`;

        cost_attribution[key] = {
          category_id: realCategoryId,
          variant: item.variant || null,
          units_purchased: item.quantity, // RENAME: quantity → units_purchased
          unit_of_measurement: item.unit, // FIX: Include unit from worksheet
          unit_price: item.unit_cost, // RENAME: unit_cost → unit_price
          units_received: item.quantity, // Default to units_purchased
          manual_line_total: item.line_total, // FIX: Use exact line total from worksheet (preserves user's rounding decisions)
          ...(isPersonal && { is_personal: true }), // Mark as personal
          ...(item.distribution_method && { distribution_method: item.distribution_method }), // Include distribution method for S+H
        };
      }

      // Use CPUCalculatorService to create invoice with automatic CPU calculation
      await cpuService.createInvoice({
        company_id: companyId,
        invoice_number: inv.invoice_number || undefined,
        invoice_date: new Date(inv.invoice_date).getTime(), // String → timestamp
        vendor_name: inv.vendor_name,
        payment_method: undefined,
        notes: inv.notes || undefined,
        cost_attribution,
        additional_costs: undefined,
        device_id: deviceId,
      });

      result.counts.invoices++;
    }

    logger.info('Invoices imported', { count: result.counts.invoices });

    // ========================================================================
    // Success!
    // ========================================================================
    result.success = true;
    result.idMap = idMap;

    logger.info('Worksheet import completed successfully', {
      counts: result.counts,
      totalItems:
        result.counts.categories +
        result.counts.products +
        result.counts.recipes +
        result.counts.invoices,
    });
  } catch (error) {
    logger.error('Worksheet import failed', { error });
    result.errors.push(
      error instanceof Error ? error.message : 'Unknown error during import'
    );
    result.success = false;
  }

  return result;
}

// ============================================================================
// Helper: Parse JSON file
// ============================================================================

/**
 * Parse worksheet JSON file
 */
export async function parseWorksheetFile(file: File): Promise<WorksheetData | null> {
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    return json as WorksheetData;
  } catch (error) {
    logger.error('Failed to parse worksheet file', { error });
    return null;
  }
}
