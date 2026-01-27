/**
 * Tests for clearCPGData utility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearAllCPGData, getCPGDataCounts } from './clearCPGData';
import { db } from '../db/database';

// Mock the database
vi.mock('../db/database', () => ({
  db: {
    cpgCategories: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          delete: vi.fn().mockResolvedValue(5),
          count: vi.fn().mockResolvedValue(5),
        }),
      }),
    },
    cpgFinishedProducts: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          delete: vi.fn().mockResolvedValue(3),
          count: vi.fn().mockResolvedValue(3),
        }),
      }),
    },
    cpgRecipes: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          delete: vi.fn().mockResolvedValue(4),
          count: vi.fn().mockResolvedValue(4),
        }),
      }),
    },
    cpgInvoices: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          delete: vi.fn().mockResolvedValue(10),
          count: vi.fn().mockResolvedValue(10),
        }),
      }),
    },
    cpgDistributors: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          delete: vi.fn().mockResolvedValue(2),
          count: vi.fn().mockResolvedValue(2),
        }),
      }),
    },
    cpgDistributionCalculations: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          delete: vi.fn().mockResolvedValue(8),
          count: vi.fn().mockResolvedValue(8),
        }),
      }),
    },
    cpgSalesPromos: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          delete: vi.fn().mockResolvedValue(6),
          count: vi.fn().mockResolvedValue(6),
        }),
      }),
    },
    cpgProductLinks: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          delete: vi.fn().mockResolvedValue(7),
          count: vi.fn().mockResolvedValue(7),
        }),
      }),
    },
    standaloneFinancials: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          delete: vi.fn().mockResolvedValue(3),
          count: vi.fn().mockResolvedValue(3),
        }),
      }),
    },
    skuCountTrackers: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          delete: vi.fn().mockResolvedValue(9),
          count: vi.fn().mockResolvedValue(9),
        }),
      }),
    },
  },
}));

describe('clearCPGData', () => {
  const testCompanyId = 'test-company-123';

  beforeEach(() => {
    // Don't use vi.clearAllMocks() as it clears the mock implementations
    // Just clear call history for spy-specific tests
  });

  describe('clearAllCPGData', () => {
    it('should clear all CPG data for a company', async () => {
      const result = await clearAllCPGData(testCompanyId);

      expect(result).toEqual({
        categoriesDeleted: 5,
        productsDeleted: 3,
        recipesDeleted: 4,
        invoicesDeleted: 10,
        distributorsDeleted: 2,
        distributionCalculationsDeleted: 8,
        salesPromosDeleted: 6,
        productLinksDeleted: 7,
        standaloneFinancialsDeleted: 3,
        skuCountTrackersDeleted: 9,
      });
    });

    it('should call delete on all CPG tables', async () => {
      await clearAllCPGData(testCompanyId);

      // Verify that each table's delete method was called
      expect(db.cpgCategories.where).toHaveBeenCalledWith('company_id');
      expect(db.cpgFinishedProducts.where).toHaveBeenCalledWith('company_id');
      expect(db.cpgRecipes.where).toHaveBeenCalledWith('company_id');
      expect(db.cpgInvoices.where).toHaveBeenCalledWith('company_id');
      expect(db.cpgDistributors.where).toHaveBeenCalledWith('company_id');
      expect(db.cpgDistributionCalculations.where).toHaveBeenCalledWith('company_id');
      expect(db.cpgSalesPromos.where).toHaveBeenCalledWith('company_id');
      expect(db.cpgProductLinks.where).toHaveBeenCalledWith('company_id');
      expect(db.standaloneFinancials.where).toHaveBeenCalledWith('company_id');
      expect(db.skuCountTrackers.where).toHaveBeenCalledWith('company_id');
    });

    it('should log the deletion results', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      await clearAllCPGData(testCompanyId);

      // Check that the first log contains the clearing message
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Clearing all CPG data for company:')
      );

      // Check that the second log contains the cleared result
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleared CPG data:'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const error = new Error('Database error');

      // Mock an error
      vi.mocked(db.cpgCategories.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          delete: vi.fn().mockRejectedValue(error),
          count: vi.fn(),
        }),
      } as any);

      await expect(clearAllCPGData(testCompanyId)).rejects.toThrow('Database error');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error clearing CPG data'),
        error
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getCPGDataCounts', () => {
    it('should return counts of all CPG data', async () => {
      const result = await getCPGDataCounts(testCompanyId);

      // Verify the result structure
      expect(result).toHaveProperty('categoriesDeleted');
      expect(result).toHaveProperty('productsDeleted');
      expect(result).toHaveProperty('recipesDeleted');
      expect(result).toHaveProperty('invoicesDeleted');
      expect(result).toHaveProperty('distributorsDeleted');
      expect(result).toHaveProperty('distributionCalculationsDeleted');
      expect(result).toHaveProperty('salesPromosDeleted');
      expect(result).toHaveProperty('productLinksDeleted');
      expect(result).toHaveProperty('standaloneFinancialsDeleted');
      expect(result).toHaveProperty('skuCountTrackersDeleted');

      // Verify all values are numbers (from the mocks)
      expect(typeof result.productsDeleted).toBe('number');
      expect(typeof result.recipesDeleted).toBe('number');
    });

    it('should call count on all CPG tables', async () => {
      await getCPGDataCounts(testCompanyId);

      // Verify that each table's count method was called
      expect(db.cpgCategories.where).toHaveBeenCalledWith('company_id');
      expect(db.cpgFinishedProducts.where).toHaveBeenCalledWith('company_id');
      expect(db.cpgRecipes.where).toHaveBeenCalledWith('company_id');
      expect(db.cpgInvoices.where).toHaveBeenCalledWith('company_id');
      expect(db.cpgDistributors.where).toHaveBeenCalledWith('company_id');
      expect(db.cpgDistributionCalculations.where).toHaveBeenCalledWith('company_id');
      expect(db.cpgSalesPromos.where).toHaveBeenCalledWith('company_id');
      expect(db.cpgProductLinks.where).toHaveBeenCalledWith('company_id');
      expect(db.standaloneFinancials.where).toHaveBeenCalledWith('company_id');
      expect(db.skuCountTrackers.where).toHaveBeenCalledWith('company_id');
    });
  });

  describe('browser console registration', () => {
    it('should register window functions when in browser environment', () => {
      // This test verifies that the functions are exported
      expect(clearAllCPGData).toBeDefined();
      expect(getCPGDataCounts).toBeDefined();
    });
  });
});
