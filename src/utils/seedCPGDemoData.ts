/**
 * CPG BOM Demo Data Seeding Script
 *
 * Creates realistic demo data for Thursday BOM system demo:
 * - Categories (raw materials: Oil, Bottles, Boxes, Labels)
 * - Finished Products (1oz Body Oil, 5oz Body Oil)
 * - Recipes (BOMs for each product)
 * - Sample Invoices (with realistic pricing)
 *
 * Expected CPU calculations:
 * - Oil (bulk): $0.42/oz
 * - Bottle (1oz): $0.50/each
 * - Bottle (5oz): $0.60/each
 * - Box (1oz): $0.25/each
 * - Box (5oz): $0.36/each
 * - Label: $0.10/each
 *
 * Expected Finished Product CPUs:
 * - 1oz Body Oil: $1.27 (0.42 + 0.50 + 0.25 + 0.10)
 * - 5oz Body Oil: $3.16 (2.10 + 0.60 + 0.36 + 0.10)
 */

import { nanoid } from 'nanoid';
import Database from '../db/database';
import type { CPGCategory, CPGFinishedProduct, CPGRecipe, CPGInvoice } from '../db/schema/cpg.schema';

interface DemoDataResult {
  categories: CPGCategory[];
  finishedProducts: CPGFinishedProduct[];
  recipes: CPGRecipe[];
  invoices: CPGInvoice[];
  success: boolean;
  message: string;
}

/**
 * Seed CPG demo data for body oil business
 *
 * @param companyId Company ID to seed data for
 * @param deviceId Device ID for version vectors
 * @param clearExisting If true, clear existing CPG data before seeding
 * @returns Result object with created entities
 */
export async function seedCPGDemoData(
  companyId: string,
  deviceId: string,
  clearExisting: boolean = false
): Promise<DemoDataResult> {
  try {
    console.log('Starting CPG demo data seeding...');

    // Clear existing data if requested
    if (clearExisting) {
      console.log('Clearing existing CPG data...');
      await Database.cpgRecipes.where('company_id').equals(companyId).delete();
      await Database.cpgFinishedProducts.where('company_id').equals(companyId).delete();
      await Database.cpgInvoices.where('company_id').equals(companyId).delete();
      await Database.cpgCategories.where('company_id').equals(companyId).delete();
      console.log('Existing data cleared.');
    }

    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const twentyFiveDaysAgo = now - (25 * 24 * 60 * 60 * 1000);
    const twentyDaysAgo = now - (20 * 24 * 60 * 60 * 1000);
    const fifteenDaysAgo = now - (15 * 24 * 60 * 60 * 1000);

    // ============================================================================
    // STEP 1: Create Categories (Raw Materials)
    // ============================================================================

    console.log('Creating categories...');

    const oilCategory: CPGCategory = {
      id: nanoid(),
      company_id: companyId,
      name: 'Oil - bulk',
      description: 'Essential oil bulk purchases',
      variants: null, // No variants - just bulk oil
      unit_of_measure: 'oz',
      sort_order: 1,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    const bottleCategory: CPGCategory = {
      id: nanoid(),
      company_id: companyId,
      name: 'Bottle',
      description: 'Glass bottles for packaging',
      variants: ['1oz', '5oz'], // Two size variants
      unit_of_measure: 'each',
      sort_order: 2,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    const boxCategory: CPGCategory = {
      id: nanoid(),
      company_id: companyId,
      name: 'Box',
      description: 'Packaging boxes',
      variants: ['1oz', '5oz'], // Two size variants
      unit_of_measure: 'each',
      sort_order: 3,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    const labelCategory: CPGCategory = {
      id: nanoid(),
      company_id: companyId,
      name: 'Label',
      description: 'Product labels',
      variants: null, // No variants - one size fits all
      unit_of_measure: 'each',
      sort_order: 4,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    await Database.cpgCategories.bulkAdd([
      oilCategory,
      bottleCategory,
      boxCategory,
      labelCategory,
    ]);

    console.log('Categories created:', {
      oil: oilCategory.id,
      bottle: bottleCategory.id,
      box: boxCategory.id,
      label: labelCategory.id,
    });

    // ============================================================================
    // STEP 2: Create Finished Products
    // ============================================================================

    console.log('Creating finished products...');

    const product1oz: CPGFinishedProduct = {
      id: nanoid(),
      company_id: companyId,
      name: '1oz Body Oil',
      description: 'Luxury body oil in 1oz bottle',
      sku: 'BO-1OZ',
      msrp: '10.00',
      unit_of_measure: 'each',
      pieces_per_unit: 1,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    const product5oz: CPGFinishedProduct = {
      id: nanoid(),
      company_id: companyId,
      name: '5oz Body Oil',
      description: 'Luxury body oil in 5oz bottle',
      sku: 'BO-5OZ',
      msrp: '25.00',
      unit_of_measure: 'each',
      pieces_per_unit: 1,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    await Database.cpgFinishedProducts.bulkAdd([product1oz, product5oz]);

    console.log('Finished products created:', {
      '1oz': product1oz.id,
      '5oz': product5oz.id,
    });

    // ============================================================================
    // STEP 3: Create Recipes (BOMs)
    // ============================================================================

    console.log('Creating recipes...');

    // Recipe for 1oz Body Oil
    const recipe1ozOil: CPGRecipe = {
      id: nanoid(),
      company_id: companyId,
      finished_product_id: product1oz.id,
      category_id: oilCategory.id,
      variant: null, // bulk oil has no variant
      quantity: '1.00', // 1 oz of oil
      notes: null,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    const recipe1ozBottle: CPGRecipe = {
      id: nanoid(),
      company_id: companyId,
      finished_product_id: product1oz.id,
      category_id: bottleCategory.id,
      variant: '1oz',
      quantity: '1', // 1 bottle
      notes: null,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    const recipe1ozBox: CPGRecipe = {
      id: nanoid(),
      company_id: companyId,
      finished_product_id: product1oz.id,
      category_id: boxCategory.id,
      variant: '1oz',
      quantity: '1', // 1 box
      notes: null,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    const recipe1ozLabel: CPGRecipe = {
      id: nanoid(),
      company_id: companyId,
      finished_product_id: product1oz.id,
      category_id: labelCategory.id,
      variant: null,
      quantity: '1', // 1 label
      notes: null,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    // Recipe for 5oz Body Oil
    const recipe5ozOil: CPGRecipe = {
      id: nanoid(),
      company_id: companyId,
      finished_product_id: product5oz.id,
      category_id: oilCategory.id,
      variant: null,
      quantity: '5.00', // 5 oz of oil
      notes: null,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    const recipe5ozBottle: CPGRecipe = {
      id: nanoid(),
      company_id: companyId,
      finished_product_id: product5oz.id,
      category_id: bottleCategory.id,
      variant: '5oz',
      quantity: '1', // 1 bottle
      notes: null,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    const recipe5ozBox: CPGRecipe = {
      id: nanoid(),
      company_id: companyId,
      finished_product_id: product5oz.id,
      category_id: boxCategory.id,
      variant: '5oz',
      quantity: '1', // 1 box
      notes: null,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    const recipe5ozLabel: CPGRecipe = {
      id: nanoid(),
      company_id: companyId,
      finished_product_id: product5oz.id,
      category_id: labelCategory.id,
      variant: null,
      quantity: '1', // 1 label
      notes: null,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    await Database.cpgRecipes.bulkAdd([
      recipe1ozOil,
      recipe1ozBottle,
      recipe1ozBox,
      recipe1ozLabel,
      recipe5ozOil,
      recipe5ozBottle,
      recipe5ozBox,
      recipe5ozLabel,
    ]);

    console.log('Recipes created: 8 recipe lines for 2 products');

    // ============================================================================
    // STEP 4: Create Sample Invoices
    // ============================================================================

    console.log('Creating invoices...');

    // Invoice #001 - Bulk Oil
    const invoice001: CPGInvoice = {
      id: nanoid(),
      company_id: companyId,
      invoice_number: 'INV-001',
      invoice_date: thirtyDaysAgo,
      vendor_name: 'ABC Oils',
      notes: 'Bulk lavender oil purchase',
      cost_attribution: {
        oil_bulk: {
          category_id: oilCategory.id,
          variant: null,
          description: 'Bulk lavender essential oil',
          units_purchased: '1200',
          unit_price: '0.42',
          units_received: '1200',
        },
      },
      additional_costs: null,
      total_paid: '504.00', // 1200 × 0.42
      calculated_cpus: {
        none: '0.42', // $0.42/oz for bulk oil (variant = null stored as "none")
      },
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    // Invoice #002 - Bottles (1oz)
    const invoice002: CPGInvoice = {
      id: nanoid(),
      company_id: companyId,
      invoice_number: 'INV-002',
      invoice_date: twentyFiveDaysAgo,
      vendor_name: 'XYZ Packaging',
      notes: 'Small bottles order',
      cost_attribution: {
        bottle_1oz: {
          category_id: bottleCategory.id,
          variant: '1oz',
          description: '1oz glass bottles',
          units_purchased: '100',
          unit_price: '0.50',
          units_received: '100',
        },
      },
      additional_costs: null,
      total_paid: '50.00', // 100 × 0.50
      calculated_cpus: {
        '1oz': '0.50', // $0.50/each for 1oz bottles
      },
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    // Invoice #003 - Bottles (5oz)
    const invoice003: CPGInvoice = {
      id: nanoid(),
      company_id: companyId,
      invoice_number: 'INV-003',
      invoice_date: twentyFiveDaysAgo,
      vendor_name: 'XYZ Packaging',
      notes: 'Large bottles order',
      cost_attribution: {
        bottle_5oz: {
          category_id: bottleCategory.id,
          variant: '5oz',
          description: '5oz glass bottles',
          units_purchased: '50',
          unit_price: '0.60',
          units_received: '50',
        },
      },
      additional_costs: null,
      total_paid: '30.00', // 50 × 0.60
      calculated_cpus: {
        '5oz': '0.60', // $0.60/each for 5oz bottles
      },
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    // Invoice #004 - Boxes (both sizes)
    const invoice004: CPGInvoice = {
      id: nanoid(),
      company_id: companyId,
      invoice_number: 'INV-004',
      invoice_date: twentyDaysAgo,
      vendor_name: 'BoxCo',
      notes: 'Packaging boxes',
      cost_attribution: {
        box_1oz: {
          category_id: boxCategory.id,
          variant: '1oz',
          description: 'Small packaging boxes',
          units_purchased: '100',
          unit_price: '0.25',
          units_received: '100',
        },
        box_5oz: {
          category_id: boxCategory.id,
          variant: '5oz',
          description: 'Large packaging boxes',
          units_purchased: '50',
          unit_price: '0.36',
          units_received: '50',
        },
      },
      additional_costs: null,
      total_paid: '43.00', // (100 × 0.25) + (50 × 0.36)
      calculated_cpus: {
        '1oz': '0.25', // $0.25/each for 1oz boxes
        '5oz': '0.36', // $0.36/each for 5oz boxes
      },
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    // Invoice #005 - Labels
    const invoice005: CPGInvoice = {
      id: nanoid(),
      company_id: companyId,
      invoice_number: 'INV-005',
      invoice_date: fifteenDaysAgo,
      vendor_name: 'PrintPro',
      notes: 'Product labels',
      cost_attribution: {
        label: {
          category_id: labelCategory.id,
          variant: null,
          description: 'Custom printed labels',
          units_purchased: '500',
          unit_price: '0.10',
          units_received: '500',
        },
      },
      additional_costs: null,
      total_paid: '50.00', // 500 × 0.10
      calculated_cpus: {
        none: '0.10', // $0.10/each for labels (variant = null stored as "none")
      },
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    await Database.cpgInvoices.bulkAdd([
      invoice001,
      invoice002,
      invoice003,
      invoice004,
      invoice005,
    ]);

    console.log('Invoices created: 5 invoices');

    // ============================================================================
    // Verification
    // ============================================================================

    console.log('\nDemo data created successfully!');
    console.log('\nExpected CPU Calculations:');
    console.log('- Oil (bulk): $0.42/oz');
    console.log('- Bottle (1oz): $0.50/each');
    console.log('- Bottle (5oz): $0.60/each');
    console.log('- Box (1oz): $0.25/each');
    console.log('- Box (5oz): $0.36/each');
    console.log('- Label: $0.10/each');
    console.log('\nExpected Finished Product CPUs:');
    console.log('- 1oz Body Oil: $1.27 (0.42 + 0.50 + 0.25 + 0.10)');
    console.log('- 5oz Body Oil: $3.16 (2.10 + 0.60 + 0.36 + 0.10)');

    return {
      categories: [oilCategory, bottleCategory, boxCategory, labelCategory],
      finishedProducts: [product1oz, product5oz],
      recipes: [
        recipe1ozOil,
        recipe1ozBottle,
        recipe1ozBox,
        recipe1ozLabel,
        recipe5ozOil,
        recipe5ozBottle,
        recipe5ozBox,
        recipe5ozLabel,
      ],
      invoices: [invoice001, invoice002, invoice003, invoice004, invoice005],
      success: true,
      message: 'Demo data created successfully',
    };
  } catch (error) {
    console.error('Error seeding demo data:', error);
    return {
      categories: [],
      finishedProducts: [],
      recipes: [],
      invoices: [],
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Clear all CPG demo data for a company
 *
 * @param companyId Company ID to clear data for
 */
export async function clearCPGDemoData(companyId: string): Promise<void> {
  console.log('Clearing CPG demo data...');

  await Database.cpgRecipes.where('company_id').equals(companyId).delete();
  await Database.cpgFinishedProducts.where('company_id').equals(companyId).delete();
  await Database.cpgInvoices.where('company_id').equals(companyId).delete();
  await Database.cpgCategories.where('company_id').equals(companyId).delete();

  console.log('CPG demo data cleared.');
}

/**
 * Verify demo data integrity
 *
 * @param companyId Company ID to verify
 * @returns Verification results
 */
export async function verifyDemoData(companyId: string): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check categories exist
    const categories = await Database.cpgCategories
      .where('company_id')
      .equals(companyId)
      .toArray();

    if (categories.length === 0) {
      errors.push('No categories found');
      return { valid: false, errors, warnings };
    }

    // Check finished products exist
    const products = await Database.cpgFinishedProducts
      .where('company_id')
      .equals(companyId)
      .toArray();

    if (products.length === 0) {
      errors.push('No finished products found');
    }

    // Check recipes exist
    const recipes = await Database.cpgRecipes
      .where('company_id')
      .equals(companyId)
      .toArray();

    if (recipes.length === 0) {
      errors.push('No recipes found');
    }

    // Check invoices exist
    const invoices = await Database.cpgInvoices
      .where('company_id')
      .equals(companyId)
      .toArray();

    if (invoices.length === 0) {
      errors.push('No invoices found');
    }

    // Verify referential integrity
    for (const recipe of recipes) {
      const productExists = products.some(p => p.id === recipe.finished_product_id);
      const categoryExists = categories.some(c => c.id === recipe.category_id);

      if (!productExists) {
        errors.push(`Recipe ${recipe.id} references non-existent product ${recipe.finished_product_id}`);
      }
      if (!categoryExists) {
        errors.push(`Recipe ${recipe.id} references non-existent category ${recipe.category_id}`);
      }
    }

    // Verify invoices reference valid categories
    for (const invoice of invoices) {
      for (const attr of Object.values(invoice.cost_attribution)) {
        const categoryExists = categories.some(c => c.id === attr.category_id);
        if (!categoryExists) {
          errors.push(`Invoice ${invoice.id} references non-existent category ${attr.category_id}`);
        }
      }
    }

    console.log('Verification complete:', {
      categories: categories.length,
      products: products.length,
      recipes: recipes.length,
      invoices: invoices.length,
      errors: errors.length,
      warnings: warnings.length,
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
    return { valid: false, errors, warnings };
  }
}
