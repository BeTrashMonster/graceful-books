/**
 * Clear all CPG data for a company
 * Use this to start fresh or reset demo data
 */

import { db } from '../db/database';

export interface ClearCPGDataResult {
  categoriesDeleted: number;
  productsDeleted: number;
  recipesDeleted: number;
  invoicesDeleted: number;
  distributorsDeleted: number;
  distributionCalculationsDeleted: number;
  salesPromosDeleted: number;
  productLinksDeleted: number;
  standaloneFinancialsDeleted: number;
  skuCountTrackersDeleted: number;
}

/**
 * Clear all CPG data for a company
 * @param companyId - The company ID to clear data for
 * @returns Object containing counts of deleted records
 */
export async function clearAllCPGData(companyId: string): Promise<ClearCPGDataResult> {
  console.log(`🗑️ Clearing all CPG data for company: ${companyId}`);

  try {
    // Delete all CPG data for this company
    const categoriesDeleted = await db.cpgCategories
      .where('company_id')
      .equals(companyId)
      .delete();

    const productsDeleted = await db.cpgFinishedProducts
      .where('company_id')
      .equals(companyId)
      .delete();

    const recipesDeleted = await db.cpgRecipes
      .where('company_id')
      .equals(companyId)
      .delete();

    const invoicesDeleted = await db.cpgInvoices
      .where('company_id')
      .equals(companyId)
      .delete();

    const distributorsDeleted = await db.cpgDistributors
      .where('company_id')
      .equals(companyId)
      .delete();

    const distributionCalculationsDeleted = await db.cpgDistributionCalculations
      .where('company_id')
      .equals(companyId)
      .delete();

    const salesPromosDeleted = await db.cpgSalesPromos
      .where('company_id')
      .equals(companyId)
      .delete();

    const productLinksDeleted = await db.cpgProductLinks
      .where('company_id')
      .equals(companyId)
      .delete();

    const standaloneFinancialsDeleted = await db.standaloneFinancials
      .where('company_id')
      .equals(companyId)
      .delete();

    const skuCountTrackersDeleted = await db.skuCountTrackers
      .where('company_id')
      .equals(companyId)
      .delete();

    const result = {
      categoriesDeleted,
      productsDeleted,
      recipesDeleted,
      invoicesDeleted,
      distributorsDeleted,
      distributionCalculationsDeleted,
      salesPromosDeleted,
      productLinksDeleted,
      standaloneFinancialsDeleted,
      skuCountTrackersDeleted,
    };

    console.log(`✅ Cleared CPG data:`, result);

    return result;
  } catch (error) {
    console.error('❌ Error clearing CPG data:', error);
    throw error;
  }
}

/**
 * Get current CPG data counts for a company
 * @param companyId - The company ID to check
 * @returns Object containing counts of records
 */
export async function getCPGDataCounts(companyId: string): Promise<ClearCPGDataResult> {
  const categoriesDeleted = await db.cpgCategories
    .where('company_id')
    .equals(companyId)
    .count();

  const productsDeleted = await db.cpgFinishedProducts
    .where('company_id')
    .equals(companyId)
    .count();

  const recipesDeleted = await db.cpgRecipes
    .where('company_id')
    .equals(companyId)
    .count();

  const invoicesDeleted = await db.cpgInvoices
    .where('company_id')
    .equals(companyId)
    .count();

  const distributorsDeleted = await db.cpgDistributors
    .where('company_id')
    .equals(companyId)
    .count();

  const distributionCalculationsDeleted = await db.cpgDistributionCalculations
    .where('company_id')
    .equals(companyId)
    .count();

  const salesPromosDeleted = await db.cpgSalesPromos
    .where('company_id')
    .equals(companyId)
    .count();

  const productLinksDeleted = await db.cpgProductLinks
    .where('company_id')
    .equals(companyId)
    .count();

  const standaloneFinancialsDeleted = await db.standaloneFinancials
    .where('company_id')
    .equals(companyId)
    .count();

  const skuCountTrackersDeleted = await db.skuCountTrackers
    .where('company_id')
    .equals(companyId)
    .count();

  return {
    categoriesDeleted,
    productsDeleted,
    recipesDeleted,
    invoicesDeleted,
    distributorsDeleted,
    distributionCalculationsDeleted,
    salesPromosDeleted,
    productLinksDeleted,
    standaloneFinancialsDeleted,
    skuCountTrackersDeleted,
  };
}

/**
 * Debug helper to check categories in the database
 */
export async function debugCategories(companyId: string) {
  const all = await db.cpgCategories.where('company_id').equals(companyId).toArray();
  const active = all.filter(c => c.active && !c.deleted_at);
  console.log('📊 All categories for company:', companyId);
  console.log('   Total:', all.length, all);
  console.log('✅ Active categories:', active.length, active);
  return { all, active };
}

// Export for browser console use
if (typeof window !== 'undefined') {
  (window as any).clearCPGData = clearAllCPGData;
  (window as any).getCPGDataCounts = getCPGDataCounts;
  (window as any).debugCategories = debugCategories;

  // Helper to get companyId from localStorage
  (window as any).getCompanyId = () => {
    try {
      const userData = localStorage.getItem('graceful_books_user');
      if (userData) {
        const parsed = JSON.parse(userData);
        return parsed.companyId || null;
      }
      return null;
    } catch (error) {
      console.error('Error reading companyId:', error);
      return null;
    }
  };

  console.log('✅ CPG Data Utilities loaded. Available commands:');
  console.log('  - window.getCompanyId() - Get your current company ID');
  console.log('  - window.getCPGDataCounts(companyId) - Check current data counts');
  console.log('  - window.clearCPGData(companyId) - Clear all CPG data for a company');
  console.log('  - window.debugCategories(companyId) - Debug category loading issues');
}
