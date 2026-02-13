/**
 * Cleanup utility to delete existing distributors
 * Used when migrating to new flexible fee structure
 */

import { db } from '../../db/database';

export async function cleanupDistributors(companyId: string): Promise<void> {
  try {
    console.log('🗑️ Cleaning up existing distributors...');

    // Get all distributors for this company
    const distributors = await db.cpgDistributors
      .where('company_id')
      .equals(companyId)
      .toArray();

    console.log(`Found ${distributors.length} distributors to delete`);

    // Delete all distributors
    const distributorIds = distributors.map(d => d.id);
    await db.cpgDistributors.bulkDelete(distributorIds);

    console.log('✅ Distributors cleaned up successfully');

    // Also clean up any related calculations
    const calculations = await db.cpgDistributionCalculations
      .where('company_id')
      .equals(companyId)
      .toArray();

    if (calculations.length > 0) {
      console.log(`🗑️ Cleaning up ${calculations.length} related calculations...`);
      const calcIds = calculations.map(c => c.id);
      await db.cpgDistributionCalculations.bulkDelete(calcIds);
      console.log('✅ Calculations cleaned up successfully');
    }

    // Dispatch event to refresh UI
    window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'distributor' } }));

  } catch (error) {
    console.error('Error cleaning up distributors:', error);
    throw error;
  }
}
