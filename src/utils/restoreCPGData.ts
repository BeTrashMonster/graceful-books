/**
 * Restore Deleted CPG Data
 *
 * Utility to restore soft-deleted CPG data by clearing deleted_at timestamps
 */

import { db } from '../db/database';

export async function restoreCPGData(companyId: string) {
  console.log('🔄 Starting CPG data restoration for company:', companyId);

  const results = {
    categoriesRestored: 0,
    invoicesRestored: 0,
    vendorsRestored: 0,
    distributorsRestored: 0,
    productsRestored: 0,
    recipesRestored: 0,
    distributionCalculationsRestored: 0,
    salesPromosRestored: 0,
    eventsRestored: 0,
    productLinksRestored: 0,
    standaloneFinancialsRestored: 0,
    skuCountTrackersRestored: 0,
    laborRolesRestored: 0,
    productLaborsRestored: 0,
  };

  try {
    // Restore categories
    const categories = await db.cpgCategories
      .where('company_id').equals(companyId)
      .and(item => !!item.deleted_at)
      .toArray();

    for (const category of categories) {
      await db.cpgCategories.update(category.id, { deleted_at: null });
      results.categoriesRestored++;
    }

    // Restore invoices
    const invoices = await db.cpgInvoices
      .where('company_id').equals(companyId)
      .and(item => !!item.deleted_at)
      .toArray();

    for (const invoice of invoices) {
      await db.cpgInvoices.update(invoice.id, { deleted_at: null });
      results.invoicesRestored++;
    }

    // Restore vendors
    const vendors = await db.cpgVendors
      .where('company_id').equals(companyId)
      .and(item => !!item.deleted_at)
      .toArray();

    for (const vendor of vendors) {
      await db.cpgVendors.update(vendor.id, { deleted_at: null });
      results.vendorsRestored++;
    }

    // Restore distributors
    const distributors = await db.cpgDistributors
      .where('company_id').equals(companyId)
      .and(item => !!item.deleted_at)
      .toArray();

    for (const distributor of distributors) {
      await db.cpgDistributors.update(distributor.id, { deleted_at: null });
      results.distributorsRestored++;
    }

    // Restore products
    const products = await db.cpgFinishedProducts
      .where('company_id').equals(companyId)
      .and(item => !!item.deleted_at)
      .toArray();

    for (const product of products) {
      await db.cpgFinishedProducts.update(product.id, { deleted_at: null });
      results.productsRestored++;
    }

    // Restore recipes
    const recipes = await db.cpgRecipes
      .where('company_id').equals(companyId)
      .and(item => !!item.deleted_at)
      .toArray();

    for (const recipe of recipes) {
      await db.cpgRecipes.update(recipe.id, { deleted_at: null });
      results.recipesRestored++;
    }

    // Restore distribution calculations
    const distCalcs = await db.cpgDistributionCalculations
      .where('company_id').equals(companyId)
      .and(item => !!item.deleted_at)
      .toArray();

    for (const calc of distCalcs) {
      await db.cpgDistributionCalculations.update(calc.id, { deleted_at: null });
      results.distributionCalculationsRestored++;
    }

    // Restore sales promos
    const promos = await db.cpgSalesPromos
      .where('company_id').equals(companyId)
      .and(item => !!item.deleted_at)
      .toArray();

    for (const promo of promos) {
      await db.cpgSalesPromos.update(promo.id, { deleted_at: null });
      results.salesPromosRestored++;
    }

    // Restore events
    const events = await db.cpgEvents
      .where('company_id').equals(companyId)
      .and(item => !!item.deleted_at)
      .toArray();

    for (const event of events) {
      await db.cpgEvents.update(event.id, { deleted_at: null });
      results.eventsRestored++;
    }

    // Restore product links
    const links = await db.cpgProductLinks
      .where('company_id').equals(companyId)
      .and(item => !!item.deleted_at)
      .toArray();

    for (const link of links) {
      await db.cpgProductLinks.update(link.id, { deleted_at: null });
      results.productLinksRestored++;
    }

    // Restore standalone financials
    const financials = await db.standaloneFinancials
      .where('company_id').equals(companyId)
      .and(item => !!item.deleted_at)
      .toArray();

    for (const financial of financials) {
      await db.standaloneFinancials.update(financial.id, { deleted_at: null });
      results.standaloneFinancialsRestored++;
    }

    // Restore SKU count trackers
    const trackers = await db.skuCountTrackers
      .where('company_id').equals(companyId)
      .and(item => !!item.deleted_at)
      .toArray();

    for (const tracker of trackers) {
      await db.skuCountTrackers.update(tracker.id, { deleted_at: null });
      results.skuCountTrackersRestored++;
    }

    // Restore labor roles
    const laborRoles = await db.cpgLaborRoles
      .where('company_id').equals(companyId)
      .and(item => !!item.deleted_at)
      .toArray();

    for (const role of laborRoles) {
      await db.cpgLaborRoles.update(role.id, { deleted_at: null });
      results.laborRolesRestored++;
    }

    // Restore product labors
    const productLabors = await db.cpgProductLabors
      .where('company_id').equals(companyId)
      .and(item => !!item.deleted_at)
      .toArray();

    for (const labor of productLabors) {
      await db.cpgProductLabors.update(labor.id, { deleted_at: null });
      results.productLaborsRestored++;
    }

    console.log('✅ CPG data restoration complete!');
    console.log('📊 Restoration results:', results);

    const totalRestored = Object.values(results).reduce((sum, count) => sum + count, 0);
    console.log(`🎉 Total items restored: ${totalRestored}`);

    return results;
  } catch (error) {
    console.error('❌ Error restoring CPG data:', error);
    throw error;
  }
}

// Make available globally for console access
if (typeof window !== 'undefined') {
  (window as any).restoreCPGData = restoreCPGData;
  console.log('✅ Data restoration utility loaded. Use: window.restoreCPGData("cpg-demo")');
}
