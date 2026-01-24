/**
 * Sales Promo Analyzer Service Tests
 *
 * Comprehensive test coverage for sales promo analysis including:
 * - Promo creation and updates
 * - Sales promo cost calculations
 * - CPU with promo calculations
 * - Margin comparisons (with vs. without promo)
 * - Recommendation logic (participate/decline/neutral)
 * - Total promo cost calculations
 * - Edge cases (0% payback, 100% payback, various percentages)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { SalesPromoAnalyzerService } from './salesPromoAnalyzer.service';
import type { TreasureChestDB } from '../../db/database';
import type { CPGSalesPromo } from '../../db/schema/cpg.schema';

// Mock database
const createMockDB = (): TreasureChestDB => {
  const promos = new Map<string, CPGSalesPromo>();

  return {
    cpgSalesPromos: {
      add: async (promo: CPGSalesPromo) => {
        promos.set(promo.id, promo);
        return promo.id;
      },
      get: async (id: string) => {
        return promos.get(id);
      },
      put: async (promo: CPGSalesPromo) => {
        promos.set(promo.id, promo);
        return promo.id;
      },
      where: (key: string) => ({
        equals: (value: string) => ({
          toArray: async () => {
            return Array.from(promos.values()).filter((p) => (p as any)[key] === value);
          },
        }),
      }),
      toArray: async () => Array.from(promos.values()),
      clear: async () => promos.clear(),
    },
  } as any;
};

describe('SalesPromoAnalyzerService', () => {
  let service: SalesPromoAnalyzerService;
  let db: TreasureChestDB;
  const deviceId = 'test-device';
  const companyId = 'test-company';

  beforeEach(() => {
    db = createMockDB();
    service = new SalesPromoAnalyzerService(db);
  });

  describe('createPromo', () => {
    it('should create a sales promo with required fields', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Summer Sale 2026',
          retailerName: 'Whole Foods',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      expect(promo).toBeDefined();
      expect(promo.id).toBeDefined();
      expect(promo.company_id).toBe(companyId);
      expect(promo.promo_name).toBe('Summer Sale 2026');
      expect(promo.retailer_name).toBe('Whole Foods');
      expect(promo.store_sale_percentage).toBe('20');
      expect(promo.producer_payback_percentage).toBe('10');
      expect(promo.status).toBe('draft');
      expect(promo.active).toBe(true);
    });

    it('should create a promo with optional dates', async () => {
      const startDate = Date.now();
      const endDate = startDate + 7 * 24 * 60 * 60 * 1000; // 7 days later

      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Flash Sale',
          storeSalePercentage: '30',
          producerPaybackPercentage: '15',
          promoStartDate: startDate,
          promoEndDate: endDate,
        },
        deviceId
      );

      expect(promo.promo_start_date).toBe(startDate);
      expect(promo.promo_end_date).toBe(endDate);
    });

    it('should create a promo with notes', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Holiday Promo',
          storeSalePercentage: '25',
          producerPaybackPercentage: '12',
          notes: 'Limited to holiday season only',
        },
        deviceId
      );

      expect(promo.notes).toBe('Limited to holiday season only');
    });

    it('should throw error if promo name is missing', async () => {
      await expect(
        service.createPromo(
          {
            companyId,
            promoName: '',
            storeSalePercentage: '20',
            producerPaybackPercentage: '10',
          },
          deviceId
        )
      ).rejects.toThrow('promo_name is required');
    });

    it('should throw error if company ID is missing', async () => {
      await expect(
        service.createPromo(
          {
            companyId: '',
            promoName: 'Test Promo',
            storeSalePercentage: '20',
            producerPaybackPercentage: '10',
          },
          deviceId
        )
      ).rejects.toThrow('company_id is required');
    });
  });

  describe('updatePromo', () => {
    it('should update promo fields', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Original Name',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      const updated = await service.updatePromo(
        promo.id,
        {
          promo_name: 'Updated Name',
          retailer_name: 'Target',
          store_sale_percentage: '25',
        },
        deviceId
      );

      expect(updated.promo_name).toBe('Updated Name');
      expect(updated.retailer_name).toBe('Target');
      expect(updated.store_sale_percentage).toBe('25');
      expect(updated.producer_payback_percentage).toBe('10'); // Unchanged
    });

    it('should increment version vector on update', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Test Promo',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      const initialVersion = promo.version_vector[deviceId];

      const updated = await service.updatePromo(
        promo.id,
        { store_sale_percentage: '30' },
        deviceId
      );

      expect(updated.version_vector[deviceId]).toBe(initialVersion + 1);
    });

    it('should throw error if promo not found', async () => {
      await expect(
        service.updatePromo('non-existent-id', { promo_name: 'Test' }, deviceId)
      ).rejects.toThrow('Sales promo not found');
    });
  });

  describe('deletePromo', () => {
    it('should soft delete a promo', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'To Delete',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      await service.deletePromo(promo.id, deviceId);

      const deleted = await service.getPromoById(promo.id);
      expect(deleted).toBeDefined();
      expect(deleted!.deleted_at).toBeDefined();
      expect(deleted!.active).toBe(false);
    });

    it('should throw error if promo not found', async () => {
      await expect(service.deletePromo('non-existent-id', deviceId)).rejects.toThrow(
        'Sales promo not found'
      );
    });
  });

  describe('analyzePromo - Basic Calculations', () => {
    it('should calculate sales promo cost per unit correctly', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Test Promo',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10', // 10% of retail price
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00', // $10.00 retail
              unitsAvailable: '100',
              baseCPU: '3.00',
            },
          },
        },
        deviceId
      );

      // Sales promo cost = $10.00 × 10% = $1.00
      expect(result.variantResults['8oz'].salesPromoCostPerUnit).toBe('1.00');
    });

    it('should calculate CPU with promo correctly', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Test Promo',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '3.00', // Base CPU: $3.00
            },
          },
        },
        deviceId
      );

      // CPU with promo = $3.00 + $1.00 = $4.00
      expect(result.variantResults['8oz'].cpuWithPromo).toBe('4.00');
    });

    it('should calculate profit margins correctly', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Test Promo',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '3.00',
            },
          },
        },
        deviceId
      );

      // Margin without promo = (($10.00 - $3.00) / $10.00) × 100 = 70%
      expect(result.variantResults['8oz'].netProfitMarginWithoutPromo).toBe('70.00');

      // Margin with promo = (($10.00 - $4.00) / $10.00) × 100 = 60%
      expect(result.variantResults['8oz'].netProfitMarginWithPromo).toBe('60.00');

      // Margin difference = 60% - 70% = -10%
      expect(result.variantResults['8oz'].marginDifference).toBe('-10.00');
    });

    it('should calculate total promo cost across all variants', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Multi-Variant Promo',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100', // $1.00 × 100 = $100.00
              baseCPU: '3.00',
            },
            '16oz': {
              retailPrice: '18.00',
              unitsAvailable: '50', // $1.80 × 50 = $90.00
              baseCPU: '5.00',
            },
          },
        },
        deviceId
      );

      // Total promo cost = $100.00 + $90.00 = $190.00
      expect(result.totalPromoCost).toBe('190.00');
    });
  });

  describe('analyzePromo - Edge Cases', () => {
    it('should handle 0% producer payback (no promo cost)', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'No Payback Promo',
          storeSalePercentage: '20',
          producerPaybackPercentage: '0', // 0% payback
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '3.00',
            },
          },
        },
        deviceId
      );

      // Sales promo cost = $10.00 × 0% = $0.00
      expect(result.variantResults['8oz'].salesPromoCostPerUnit).toBe('0.00');

      // CPU with promo should equal base CPU
      expect(result.variantResults['8oz'].cpuWithPromo).toBe('3.00');

      // Margins should be identical
      expect(result.variantResults['8oz'].netProfitMarginWithPromo).toBe('70.00');
      expect(result.variantResults['8oz'].netProfitMarginWithoutPromo).toBe('70.00');
      expect(result.variantResults['8oz'].marginDifference).toBe('0.00');
    });

    it('should handle 100% producer payback (full discount)', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Full Payback Promo',
          storeSalePercentage: '50',
          producerPaybackPercentage: '100', // 100% payback
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '3.00',
            },
          },
        },
        deviceId
      );

      // Sales promo cost = $10.00 × 100% = $10.00
      expect(result.variantResults['8oz'].salesPromoCostPerUnit).toBe('10.00');

      // CPU with promo = $3.00 + $10.00 = $13.00
      expect(result.variantResults['8oz'].cpuWithPromo).toBe('13.00');

      // Margin with promo = (($10.00 - $13.00) / $10.00) × 100 = -30% (negative!)
      expect(result.variantResults['8oz'].netProfitMarginWithPromo).toBe('-30.00');
    });

    it('should handle various producer payback percentages', async () => {
      const testCases = [
        { payback: '5', expected: '0.50' },
        { payback: '10', expected: '1.00' },
        { payback: '25', expected: '2.50' },
        { payback: '50', expected: '5.00' },
      ];

      for (const { payback, expected } of testCases) {
        const promo = await service.createPromo(
          {
            companyId,
            promoName: `${payback}% Payback Promo`,
            storeSalePercentage: '20',
            producerPaybackPercentage: payback,
          },
          deviceId
        );

        const result = await service.analyzePromo(
          {
            promoId: promo.id,
            variantPromoData: {
              '8oz': {
                retailPrice: '10.00',
                unitsAvailable: '100',
                baseCPU: '3.00',
              },
            },
          },
          deviceId
        );

        expect(result.variantResults['8oz'].salesPromoCostPerUnit).toBe(expected);
      }
    });

    it('should handle various store sale percentages', async () => {
      const testCases = [
        { sale: '10' },
        { sale: '20' },
        { sale: '30' },
        { sale: '50' },
      ];

      for (const { sale } of testCases) {
        const promo = await service.createPromo(
          {
            companyId,
            promoName: `${sale}% Sale Promo`,
            storeSalePercentage: sale,
            producerPaybackPercentage: '10',
          },
          deviceId
        );

        const result = await service.analyzePromo(
          {
            promoId: promo.id,
            variantPromoData: {
              '8oz': {
                retailPrice: '10.00',
                unitsAvailable: '100',
                baseCPU: '3.00',
              },
            },
          },
          deviceId
        );

        // Sale percentage doesn't affect producer payback calculation
        // (it's for the customer, not the producer)
        expect(result.variantResults['8oz'].salesPromoCostPerUnit).toBe('1.00');
      }
    });

    it('should handle fractional retail prices', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Fractional Price Promo',
          storeSalePercentage: '20',
          producerPaybackPercentage: '15',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '9.99',
              unitsAvailable: '100',
              baseCPU: '2.85',
            },
          },
        },
        deviceId
      );

      // Sales promo cost = $9.99 × 15% = $1.4985 ≈ $1.50
      expect(result.variantResults['8oz'].salesPromoCostPerUnit).toBe('1.50');
    });

    it('should handle zero retail price gracefully', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Zero Price Promo',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '0.00',
              unitsAvailable: '100',
              baseCPU: '3.00',
            },
          },
        },
        deviceId
      );

      // Sales promo cost = $0.00 × 10% = $0.00
      expect(result.variantResults['8oz'].salesPromoCostPerUnit).toBe('0.00');

      // Margin should be 0% (avoid division by zero)
      expect(result.variantResults['8oz'].netProfitMarginWithPromo).toBe('0.00');
      expect(result.variantResults['8oz'].netProfitMarginWithoutPromo).toBe('0.00');
    });
  });

  describe('analyzePromo - Recommendation Logic', () => {
    it('should recommend PARTICIPATE when margin >= 50%', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Good Margin Promo',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '3.00', // Margin with promo = 60%
            },
          },
        },
        deviceId
      );

      expect(result.recommendation).toBe('participate');
      expect(result.recommendationReason).toContain('above 50%');
      expect(result.recommendationReason).toContain('healthy profitability');
    });

    it('should recommend DECLINE when margin < 40%', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Poor Margin Promo',
          storeSalePercentage: '30',
          producerPaybackPercentage: '50', // High payback
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '4.00', // CPU with promo = $9.00, margin = 10%
            },
          },
        },
        deviceId
      );

      expect(result.recommendation).toBe('decline');
      expect(result.recommendationReason).toContain('below the 40% threshold');
      expect(result.recommendationReason).toContain('hurt your profitability');
    });

    it('should recommend NEUTRAL when margin is 40-50%', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Borderline Promo',
          storeSalePercentage: '20',
          producerPaybackPercentage: '15',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '4.00', // CPU with promo = $5.50, margin = 45%
            },
          },
        },
        deviceId
      );

      expect(result.recommendation).toBe('neutral');
      expect(result.recommendationReason).toContain('borderline');
      expect(result.recommendationReason).toContain('Review carefully');
    });

    it('should recommend DECLINE if ANY variant has margin < 40%', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Mixed Margin Promo',
          storeSalePercentage: '25',
          producerPaybackPercentage: '20',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '2.00', // Good margin (80% - 20% = 60%)
            },
            '16oz': {
              retailPrice: '15.00',
              unitsAvailable: '50',
              baseCPU: '12.00', // Poor margin (20% - 20% = 0%)
            },
          },
        },
        deviceId
      );

      expect(result.recommendation).toBe('decline');
      expect(result.recommendationReason).toContain('below the 40% threshold');
    });

    it('should recommend PARTICIPATE if ALL variants have margin >= 50%', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'All Good Promo',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '3.00', // Margin = 60%
            },
            '16oz': {
              retailPrice: '18.00',
              unitsAvailable: '50',
              baseCPU: '5.00', // Margin = 62.22%
            },
          },
        },
        deviceId
      );

      expect(result.recommendation).toBe('participate');
      expect(result.recommendationReason).toContain('above 50%');
    });
  });

  describe('analyzePromo - Margin Quality', () => {
    it('should assign margin quality: poor (< 50%)', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Poor Quality Promo',
          storeSalePercentage: '30',
          producerPaybackPercentage: '40',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '3.00', // CPU with promo = $7.00, margin = 30%
            },
          },
        },
        deviceId
      );

      expect(result.variantResults['8oz'].marginQualityWithPromo).toBe('poor');
    });

    it('should assign margin quality: good (50-60%)', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Good Quality Promo',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '3.50', // CPU with promo = $4.50, margin = 55%
            },
          },
        },
        deviceId
      );

      expect(result.variantResults['8oz'].marginQualityWithPromo).toBe('good');
    });

    it('should assign margin quality: better (60-70%)', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Better Quality Promo',
          storeSalePercentage: '15',
          producerPaybackPercentage: '8',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '2.70', // CPU with promo = $3.50, margin = 65%
            },
          },
        },
        deviceId
      );

      expect(result.variantResults['8oz'].marginQualityWithPromo).toBe('better');
    });

    it('should assign margin quality: best (>= 70%)', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Best Quality Promo',
          storeSalePercentage: '10',
          producerPaybackPercentage: '5',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '2.00', // CPU with promo = $2.50, margin = 75%
            },
          },
        },
        deviceId
      );

      expect(result.variantResults['8oz'].marginQualityWithPromo).toBe('best');
    });
  });

  describe('comparePromoVsNoPromo', () => {
    it('should compare with/without promo scenarios', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Comparison Promo',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      // Analyze first
      await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '3.00',
            },
          },
        },
        deviceId
      );

      // Now compare
      const comparison = await service.comparePromoVsNoPromo(promo.id);

      expect(comparison).toBeDefined();
      expect(comparison.promoId).toBe(promo.id);
      expect(comparison.promoName).toBe('Comparison Promo');
      expect(comparison.withPromo.averageMargin).toBe('60.00');
      expect(comparison.withoutPromo.averageMargin).toBe('70.00');
      expect(comparison.marginDifference).toBe('-10.00');
    });

    it('should calculate min/max margins correctly', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Multi-Variant Comparison',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '2.00', // Margin with promo = 70%
            },
            '16oz': {
              retailPrice: '18.00',
              unitsAvailable: '50',
              baseCPU: '6.00', // Promo cost = $1.80, CPU with promo = $7.80, Margin = 56.67%
            },
            '32oz': {
              retailPrice: '30.00',
              unitsAvailable: '25',
              baseCPU: '10.00', // Promo cost = $3.00, CPU with promo = $13.00, Margin = 56.67%
            },
          },
        },
        deviceId
      );

      const comparison = await service.comparePromoVsNoPromo(promo.id);

      expect(comparison.withPromo.lowestMargin).toBe('56.67');
      expect(comparison.withPromo.highestMargin).toBe('70.00');
    });

    it('should throw error if promo not analyzed', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Not Analyzed',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      await expect(service.comparePromoVsNoPromo(promo.id)).rejects.toThrow(
        'Promo must be analyzed before comparison'
      );
    });

    it('should throw error if promo not found', async () => {
      await expect(service.comparePromoVsNoPromo('non-existent-id')).rejects.toThrow(
        'Sales promo not found'
      );
    });
  });

  describe('getRecommendation', () => {
    it('should return recommendation for analyzed promo', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Recommendation Test',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '3.00', // Margin = 60% → participate
            },
          },
        },
        deviceId
      );

      const recommendation = await service.getRecommendation(promo.id);
      expect(recommendation).toBe('participate');
    });

    it('should throw error if promo not analyzed', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Not Analyzed',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      await expect(service.getRecommendation(promo.id)).rejects.toThrow(
        'Promo must be analyzed before getting recommendation'
      );
    });

    it('should throw error if promo not found', async () => {
      await expect(service.getRecommendation('non-existent-id')).rejects.toThrow(
        'Sales promo not found'
      );
    });
  });

  describe('getPromosByCompany', () => {
    it('should return all promos for a company', async () => {
      await service.createPromo(
        {
          companyId,
          promoName: 'Promo 1',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      await service.createPromo(
        {
          companyId,
          promoName: 'Promo 2',
          storeSalePercentage: '25',
          producerPaybackPercentage: '12',
        },
        deviceId
      );

      const promos = await service.getPromosByCompany(companyId);
      expect(promos).toHaveLength(2);
      expect(promos[0].promo_name).toBe('Promo 1');
      expect(promos[1].promo_name).toBe('Promo 2');
    });

    it('should exclude deleted promos when activeOnly=true', async () => {
      const promo1 = await service.createPromo(
        {
          companyId,
          promoName: 'Active Promo',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      const promo2 = await service.createPromo(
        {
          companyId,
          promoName: 'Deleted Promo',
          storeSalePercentage: '25',
          producerPaybackPercentage: '12',
        },
        deviceId
      );

      await service.deletePromo(promo2.id, deviceId);

      const activePromos = await service.getPromosByCompany(companyId, true);
      expect(activePromos).toHaveLength(1);
      expect(activePromos[0].promo_name).toBe('Active Promo');
    });

    it('should include deleted promos when activeOnly=false', async () => {
      const promo1 = await service.createPromo(
        {
          companyId,
          promoName: 'Active Promo',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      const promo2 = await service.createPromo(
        {
          companyId,
          promoName: 'Deleted Promo',
          storeSalePercentage: '25',
          producerPaybackPercentage: '12',
        },
        deviceId
      );

      await service.deletePromo(promo2.id, deviceId);

      const allPromos = await service.getPromosByCompany(companyId, false);
      expect(allPromos).toHaveLength(2);
    });
  });

  describe('getPromoById', () => {
    it('should return promo by ID', async () => {
      const created = await service.createPromo(
        {
          companyId,
          promoName: 'Test Promo',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      const retrieved = await service.getPromoById(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.promo_name).toBe('Test Promo');
    });

    it('should return undefined for non-existent promo', async () => {
      const retrieved = await service.getPromoById('non-existent-id');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('analyzePromo - Variant Flexibility', () => {
    it('should support user-defined variant names', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Flexible Variants',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            'Tiny': {
              retailPrice: '5.00',
              unitsAvailable: '200',
              baseCPU: '1.50',
            },
            'Humongous': {
              retailPrice: '50.00',
              unitsAvailable: '10',
              baseCPU: '15.00',
            },
          },
        },
        deviceId
      );

      expect(result.variantResults['Tiny']).toBeDefined();
      expect(result.variantResults['Humongous']).toBeDefined();
      expect(result.variantResults['Tiny'].salesPromoCostPerUnit).toBe('0.50');
      expect(result.variantResults['Humongous'].salesPromoCostPerUnit).toBe('5.00');
    });

    it('should support numeric variant names', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Numeric Variants',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '8oz': {
              retailPrice: '10.00',
              unitsAvailable: '100',
              baseCPU: '3.00',
            },
            '16oz': {
              retailPrice: '18.00',
              unitsAvailable: '50',
              baseCPU: '5.00',
            },
            '32oz': {
              retailPrice: '30.00',
              unitsAvailable: '25',
              baseCPU: '8.00',
            },
          },
        },
        deviceId
      );

      expect(result.variantResults['8oz']).toBeDefined();
      expect(result.variantResults['16oz']).toBeDefined();
      expect(result.variantResults['32oz']).toBeDefined();
    });

    it('should support special characters in variant names', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Special Char Variants',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '1/2 gallon': {
              retailPrice: '25.00',
              unitsAvailable: '50',
              baseCPU: '8.00',
            },
            'Size-M': {
              retailPrice: '15.00',
              unitsAvailable: '75',
              baseCPU: '5.00',
            },
          },
        },
        deviceId
      );

      expect(result.variantResults['1/2 gallon']).toBeDefined();
      expect(result.variantResults['Size-M']).toBeDefined();
    });

    it('should support 5+ variants', async () => {
      const promo = await service.createPromo(
        {
          companyId,
          promoName: 'Many Variants',
          storeSalePercentage: '20',
          producerPaybackPercentage: '10',
        },
        deviceId
      );

      const result = await service.analyzePromo(
        {
          promoId: promo.id,
          variantPromoData: {
            '4oz': { retailPrice: '6.00', unitsAvailable: '100', baseCPU: '2.00' },
            '8oz': { retailPrice: '10.00', unitsAvailable: '100', baseCPU: '3.00' },
            '16oz': { retailPrice: '18.00', unitsAvailable: '50', baseCPU: '5.00' },
            '32oz': { retailPrice: '30.00', unitsAvailable: '25', baseCPU: '8.00' },
            '64oz': { retailPrice: '50.00', unitsAvailable: '10', baseCPU: '12.00' },
          },
        },
        deviceId
      );

      expect(Object.keys(result.variantResults)).toHaveLength(5);
      expect(result.variantResults['4oz']).toBeDefined();
      expect(result.variantResults['64oz']).toBeDefined();
    });
  });
});
