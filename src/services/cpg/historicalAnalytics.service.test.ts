/**
 * Historical Analytics Service Tests
 *
 * Tests for Group E2: Historical Analytics
 *
 * Coverage areas:
 * - CPU trend analysis (3mo, 6mo, 1yr, all-time)
 * - Seasonal pattern detection
 * - Distributor cost comparison
 * - Trade spend ROI analysis
 * - Edge cases: no data, single data point, gaps in timeline
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import { HistoricalAnalyticsService } from './historicalAnalytics.service';
import type { TreasureChestDB } from '../../db/database';
import type {
  CPGInvoice,
  CPGDistributionCalculation,
  CPGSalesPromo,
  CPGDistributor,
} from '../../db/schema/cpg.schema';

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

// Helper to create mock invoice
const createMockInvoice = (
  id: string,
  companyId: string,
  date: number,
  calculatedCPUs: Record<string, string>
): CPGInvoice => ({
  id,
  company_id: companyId,
  invoice_number: `INV-${id}`,
  invoice_date: date,
  vendor_name: 'Test Vendor',
  notes: null,
  cost_attribution: {},
  additional_costs: null,
  total_paid: '100.00',
  calculated_cpus: calculatedCPUs,
  active: true,
  created_at: date,
  updated_at: date,
  deleted_at: null,
  version_vector: { 'device-1': 1 },
});

// Helper to create mock distributor
const createMockDistributor = (id: string, companyId: string, name: string): CPGDistributor => ({
  id,
  company_id: companyId,
  name,
  description: null,
  contact_info: null,
  fee_structure: {
    pallet_cost: '81.00',
    warehouse_services: '25.00',
    pallet_build: '25.00',
    floor_space_full_day: '100.00',
    floor_space_half_day: '50.00',
    truck_transfer_zone1: '100.00',
    truck_transfer_zone2: '160.00',
    custom_fees: null,
  },
  active: true,
  created_at: Date.now(),
  updated_at: Date.now(),
  deleted_at: null,
  version_vector: { 'device-1': 1 },
});

// Helper to create mock distribution calculation
const createMockCalculation = (
  id: string,
  companyId: string,
  distributorId: string,
  date: number,
  totalCost: string,
  costPerUnit: string
): CPGDistributionCalculation => ({
  id,
  company_id: companyId,
  distributor_id: distributorId,
  calculation_name: `Calc ${id}`,
  calculation_date: date,
  num_pallets: '1.00',
  units_per_pallet: '100',
  variant_data: {},
  applied_fees: {
    pallet_cost: true,
    warehouse_services: true,
    pallet_build: false,
    floor_space: 'none',
    floor_space_days: null,
    truck_transfer_zone: 'none',
    custom_fees: null,
  },
  total_distribution_cost: totalCost,
  distribution_cost_per_unit: costPerUnit,
  variant_results: {},
  msrp_markup_percentage: null,
  notes: null,
  active: true,
  created_at: date,
  updated_at: date,
  deleted_at: null,
  version_vector: { 'device-1': 1 },
});

// Helper to create mock sales promo
const createMockPromo = (
  id: string,
  companyId: string,
  name: string,
  totalCost: string,
  status: 'draft' | 'submitted' | 'approved' | 'declined'
): CPGSalesPromo => ({
  id,
  company_id: companyId,
  promo_name: name,
  retailer_name: 'Test Retailer',
  promo_start_date: Date.now(),
  promo_end_date: null,
  store_sale_percentage: '20',
  producer_payback_percentage: '10',
  variant_promo_data: {},
  variant_promo_results: {
    '8oz': {
      sales_promo_cost_per_unit: '0.50',
      cpu_with_promo: '2.65',
      net_profit_margin_with_promo: '68.50',
      net_profit_margin_without_promo: '78.50',
      margin_quality_with_promo: 'better',
    },
  },
  total_promo_cost: totalCost,
  recommendation: 'participate',
  notes: null,
  status,
  active: true,
  created_at: Date.now(),
  updated_at: Date.now(),
  deleted_at: null,
  version_vector: { 'device-1': 1 },
});

describe('HistoricalAnalyticsService', () => {
  let service: HistoricalAnalyticsService;
  let mockDb: TreasureChestDB;

  beforeEach(() => {
    // Create mock database
    mockDb = {
      cpgInvoices: {
        where: vi.fn().mockReturnThis(),
        between: vi.fn().mockReturnThis(),
        and: vi.fn().mockReturnThis(),
        sortBy: vi.fn().mockResolvedValue([]),
        toArray: vi.fn().mockResolvedValue([]),
      },
      cpgDistributors: {
        get: vi.fn().mockResolvedValue(null),
      },
      cpgDistributionCalculations: {
        where: vi.fn().mockReturnThis(),
        equals: vi.fn().mockReturnThis(),
        and: vi.fn().mockReturnThis(),
        sortBy: vi.fn().mockResolvedValue([]),
      },
      cpgSalesPromos: {
        where: vi.fn().mockReturnThis(),
        equals: vi.fn().mockReturnThis(),
        and: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      },
    } as any;

    service = new HistoricalAnalyticsService(mockDb);
  });

  describe('getCPUTrend', () => {
    it('should calculate CPU trend with statistics for 1 year', async () => {
      const companyId = 'company-1';
      const now = Date.now();
      const oneYearAgo = now - 365.25 * 24 * 60 * 60 * 1000;

      const mockInvoices = [
        createMockInvoice('inv-1', companyId, oneYearAgo + 1000, { '8oz': '2.00' }),
        createMockInvoice('inv-2', companyId, oneYearAgo + 2000, { '8oz': '2.10' }),
        createMockInvoice('inv-3', companyId, oneYearAgo + 3000, { '8oz': '2.20' }),
        createMockInvoice('inv-4', companyId, now - 1000, { '8oz': '2.30' }),
      ];

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue(mockInvoices);

      const result = await service.getCPUTrend(companyId, '8oz', undefined, '1yr');

      expect(result.variant).toBe('8oz');
      expect(result.data_points).toHaveLength(4);
      expect(result.statistics.average_cpu).toBe('2.15');
      expect(result.statistics.min_cpu).toBe('2.00');
      expect(result.statistics.max_cpu).toBe('2.30');
      expect(result.statistics.trend_direction).toBe('increasing');
      expect(parseFloat(result.statistics.change_percentage)).toBeGreaterThan(0);
    });

    it('should handle no variant (variant = null)', async () => {
      const companyId = 'company-1';
      const now = Date.now();

      const mockInvoices = [
        createMockInvoice('inv-1', companyId, now - 1000, { none: '5.00' }),
        createMockInvoice('inv-2', companyId, now - 500, { none: '5.50' }),
      ];

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue(mockInvoices);

      const result = await service.getCPUTrend(companyId, null, undefined, '3mo');

      expect(result.variant).toBe(null);
      expect(result.data_points).toHaveLength(2);
      expect(result.statistics.average_cpu).toBe('5.25');
    });

    it('should calculate rolling averages (3-month and 6-month)', async () => {
      const companyId = 'company-1';
      const now = Date.now();
      const threeMonthsAgo = now - 3 * 30.44 * 24 * 60 * 60 * 1000;

      const mockInvoices = [
        createMockInvoice('inv-1', companyId, threeMonthsAgo + 1000, { '8oz': '2.00' }),
        createMockInvoice('inv-2', companyId, threeMonthsAgo + 2000, { '8oz': '2.10' }),
        createMockInvoice('inv-3', companyId, now - 1000, { '8oz': '2.20' }),
      ];

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue(mockInvoices);

      const result = await service.getCPUTrend(companyId, '8oz', undefined, '6mo');

      expect(result.statistics.rolling_average_3mo).not.toBe(null);
      expect(result.statistics.rolling_average_6mo).not.toBe(null);
    });

    it('should handle decreasing trend', async () => {
      const companyId = 'company-1';
      const now = Date.now();

      const mockInvoices = [
        createMockInvoice('inv-1', companyId, now - 3000, { '8oz': '3.00' }),
        createMockInvoice('inv-2', companyId, now - 2000, { '8oz': '2.50' }),
        createMockInvoice('inv-3', companyId, now - 1000, { '8oz': '2.00' }),
      ];

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue(mockInvoices);

      const result = await service.getCPUTrend(companyId, '8oz', undefined, '1yr');

      expect(result.statistics.trend_direction).toBe('decreasing');
      expect(parseFloat(result.statistics.change_percentage)).toBeLessThan(0);
    });

    it('should handle stable trend', async () => {
      const companyId = 'company-1';
      const now = Date.now();

      const mockInvoices = [
        createMockInvoice('inv-1', companyId, now - 3000, { '8oz': '2.50' }),
        createMockInvoice('inv-2', companyId, now - 2000, { '8oz': '2.52' }),
        createMockInvoice('inv-3', companyId, now - 1000, { '8oz': '2.51' }),
      ];

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue(mockInvoices);

      const result = await service.getCPUTrend(companyId, '8oz', undefined, '1yr');

      expect(result.statistics.trend_direction).toBe('stable');
    });

    it('should handle empty data', async () => {
      const companyId = 'company-1';

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue([]);

      const result = await service.getCPUTrend(companyId, '8oz', undefined, '1yr');

      expect(result.data_points).toHaveLength(0);
      expect(result.statistics.average_cpu).toBe('0.00');
      expect(result.statistics.min_cpu).toBe('0.00');
      expect(result.statistics.max_cpu).toBe('0.00');
      expect(result.statistics.trend_direction).toBe('stable');
    });

    it('should handle single data point', async () => {
      const companyId = 'company-1';
      const now = Date.now();

      const mockInvoices = [createMockInvoice('inv-1', companyId, now - 1000, { '8oz': '2.50' })];

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue(mockInvoices);

      const result = await service.getCPUTrend(companyId, '8oz', undefined, '1yr');

      expect(result.data_points).toHaveLength(1);
      expect(result.statistics.average_cpu).toBe('2.50');
      expect(result.statistics.min_cpu).toBe('2.50');
      expect(result.statistics.max_cpu).toBe('2.50');
      expect(result.statistics.trend_direction).toBe('stable');
      expect(result.statistics.change_percentage).toBe('0.00');
    });

    it('should filter by category if provided', async () => {
      const companyId = 'company-1';
      const now = Date.now();

      const mockInvoices = [
        {
          ...createMockInvoice('inv-1', companyId, now - 1000, { '8oz': '2.50' }),
          cost_attribution: {
            Oil_8oz: {
              category_id: 'cat-oil',
              variant: '8oz',
              units_purchased: '100',
              unit_price: '2.00',
              units_received: '100',
            },
          },
        },
        {
          ...createMockInvoice('inv-2', companyId, now - 500, { '8oz': '3.00' }),
          cost_attribution: {
            Bottle_8oz: {
              category_id: 'cat-bottle',
              variant: '8oz',
              units_purchased: '100',
              unit_price: '2.50',
              units_received: '100',
            },
          },
        },
      ];

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue(mockInvoices);

      const result = await service.getCPUTrend(companyId, '8oz', 'cat-oil', '1yr');

      // Should only include invoice with cat-oil
      expect(result.data_points).toHaveLength(1);
      expect(result.data_points[0].invoice_id).toBe('inv-1');
    });
  });

  describe('detectSeasonalPatterns', () => {
    it('should detect seasonal patterns with 2+ years of data', async () => {
      const companyId = 'company-1';
      const now = Date.now();
      const twoYearsAgo = now - 2.5 * 365.25 * 24 * 60 * 60 * 1000; // 2.5 years to ensure we have enough data

      // Create monthly data with higher costs in summer (June, July, August)
      const mockInvoices = [];
      for (let month = 0; month < 30; month++) { // 30 months of data
        const date = twoYearsAgo + month * 30.44 * 24 * 60 * 60 * 1000;
        const monthOfYear = new Date(date).getMonth(); // 0-11

        // Summer months (5, 6, 7 = June, July, August) have higher costs
        const cpu = [5, 6, 7].includes(monthOfYear) ? '3.00' : '2.00';

        mockInvoices.push(createMockInvoice(`inv-${month}`, companyId, date, { '8oz': cpu }));
      }

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue(mockInvoices);

      const result = await service.detectSeasonalPatterns(companyId, '8oz');

      expect(result.variant).toBe('8oz');
      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.overall_average).not.toBe('0.00');
      expect(result.insight).toContain('increase');
    });

    it('should throw error if insufficient data (< 2 years)', async () => {
      const companyId = 'company-1';
      const now = Date.now();
      const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

      const mockInvoices = [createMockInvoice('inv-1', companyId, oneMonthAgo, { '8oz': '2.00' })];

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue(mockInvoices);

      await expect(service.detectSeasonalPatterns(companyId, '8oz')).rejects.toThrow(
        'Insufficient data for seasonal analysis'
      );
    });

    it('should throw error if no data available', async () => {
      const companyId = 'company-1';

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue([]);

      await expect(service.detectSeasonalPatterns(companyId, '8oz')).rejects.toThrow(
        'No data available for seasonal analysis'
      );
    });

    it('should identify high cost months correctly', async () => {
      const companyId = 'company-1';
      const now = Date.now();
      const twoYearsAgo = now - 2.5 * 365.25 * 24 * 60 * 60 * 1000;

      const mockInvoices = [];
      for (let month = 0; month < 30; month++) { // 30 months of data
        const date = twoYearsAgo + month * 30.44 * 24 * 60 * 60 * 1000;
        const monthOfYear = new Date(date).getMonth();

        // December (11) has significantly higher costs
        const cpu = monthOfYear === 11 ? '5.00' : '2.00';
        mockInvoices.push(createMockInvoice(`inv-${month}`, companyId, date, { '8oz': cpu }));
      }

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue(mockInvoices);

      const result = await service.detectSeasonalPatterns(companyId, '8oz');

      expect(result.highest_cost_month).toBe('December');
    });

    it('should identify low cost months correctly', async () => {
      const companyId = 'company-1';
      const now = Date.now();
      const twoYearsAgo = now - 2.5 * 365.25 * 24 * 60 * 60 * 1000;

      const mockInvoices = [];
      for (let month = 0; month < 30; month++) { // 30 months of data
        const date = twoYearsAgo + month * 30.44 * 24 * 60 * 60 * 1000;
        const monthOfYear = new Date(date).getMonth();

        // January (0) has significantly lower costs
        const cpu = monthOfYear === 0 ? '1.00' : '3.00';
        mockInvoices.push(createMockInvoice(`inv-${month}`, companyId, date, { '8oz': cpu }));
      }

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue(mockInvoices);

      const result = await service.detectSeasonalPatterns(companyId, '8oz');

      expect(result.lowest_cost_month).toBe('January');
    });

    it('should handle no significant seasonal patterns', async () => {
      const companyId = 'company-1';
      const now = Date.now();
      const twoYearsAgo = now - 2.5 * 365.25 * 24 * 60 * 60 * 1000;

      const mockInvoices = [];
      for (let month = 0; month < 30; month++) { // 30 months of data
        const date = twoYearsAgo + month * 30.44 * 24 * 60 * 60 * 1000;
        // Very stable costs - no seasonal variation
        mockInvoices.push(createMockInvoice(`inv-${month}`, companyId, date, { '8oz': '2.50' }));
      }

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue(mockInvoices);

      const result = await service.detectSeasonalPatterns(companyId, '8oz');

      expect(result.insight).toContain('No significant seasonal patterns');
    });
  });

  describe('getDistributorCostTrend', () => {
    it('should calculate distributor cost trend', async () => {
      const companyId = 'company-1';
      const distributorId = 'dist-1';
      const now = Date.now();

      const mockDistributor = createMockDistributor(distributorId, companyId, 'Test Distributor');
      const mockCalculations = [
        createMockCalculation('calc-1', companyId, distributorId, now - 3000, '106.00', '1.06'),
        createMockCalculation('calc-2', companyId, distributorId, now - 2000, '110.00', '1.10'),
        createMockCalculation('calc-3', companyId, distributorId, now - 1000, '115.00', '1.15'),
      ];

      vi.mocked(mockDb.cpgDistributors.get).mockResolvedValue(mockDistributor);
      vi.mocked(mockDb.cpgDistributionCalculations.sortBy).mockResolvedValue(mockCalculations);

      const result = await service.getDistributorCostTrend(companyId, distributorId, '1yr');

      expect(result.distributor_id).toBe(distributorId);
      expect(result.distributor_name).toBe('Test Distributor');
      expect(result.data_points).toHaveLength(3);
      expect(result.statistics.average_total_cost).toBe('110.33');
      expect(result.statistics.min_cost).toBe('106.00');
      expect(result.statistics.max_cost).toBe('115.00');
      expect(result.statistics.trend_direction).toBe('increasing');
    });

    it('should handle distributor not found', async () => {
      const companyId = 'company-1';
      const distributorId = 'dist-nonexistent';

      vi.mocked(mockDb.cpgDistributors.get).mockResolvedValue(null);

      await expect(
        service.getDistributorCostTrend(companyId, distributorId, '1yr')
      ).rejects.toThrow('Distributor not found');
    });

    it('should handle no calculations', async () => {
      const companyId = 'company-1';
      const distributorId = 'dist-1';

      const mockDistributor = createMockDistributor(distributorId, companyId, 'Test Distributor');

      vi.mocked(mockDb.cpgDistributors.get).mockResolvedValue(mockDistributor);
      vi.mocked(mockDb.cpgDistributionCalculations.sortBy).mockResolvedValue([]);

      const result = await service.getDistributorCostTrend(companyId, distributorId, '1yr');

      expect(result.data_points).toHaveLength(0);
      expect(result.statistics.average_total_cost).toBe('0.00');
      expect(result.statistics.trend_direction).toBe('stable');
    });

    it('should detect decreasing cost trend', async () => {
      const companyId = 'company-1';
      const distributorId = 'dist-1';
      const now = Date.now();

      const mockDistributor = createMockDistributor(distributorId, companyId, 'Test Distributor');
      const mockCalculations = [
        createMockCalculation('calc-1', companyId, distributorId, now - 3000, '120.00', '1.20'),
        createMockCalculation('calc-2', companyId, distributorId, now - 2000, '110.00', '1.10'),
        createMockCalculation('calc-3', companyId, distributorId, now - 1000, '100.00', '1.00'),
      ];

      vi.mocked(mockDb.cpgDistributors.get).mockResolvedValue(mockDistributor);
      vi.mocked(mockDb.cpgDistributionCalculations.sortBy).mockResolvedValue(mockCalculations);

      const result = await service.getDistributorCostTrend(companyId, distributorId, '1yr');

      expect(result.statistics.trend_direction).toBe('decreasing');
      expect(parseFloat(result.statistics.change_percentage)).toBeLessThan(0);
    });
  });

  describe('analyzeTradeSpendROI', () => {
    it('should analyze trade spend ROI', async () => {
      const companyId = 'company-1';
      const now = Date.now();

      const mockPromos = [
        createMockPromo('promo-1', companyId, 'Summer Sale', '500.00', 'approved'),
        createMockPromo('promo-2', companyId, 'Winter Sale', '300.00', 'declined'),
        createMockPromo('promo-3', companyId, 'Spring Sale', '200.00', 'draft'),
      ];

      vi.mocked(mockDb.cpgSalesPromos.toArray).mockResolvedValue(mockPromos);

      const result = await service.analyzeTradeSpendROI(companyId, '1yr');

      expect(result.total_promos_analyzed).toBe(3);
      expect(result.total_promo_cost).toBe('1000.00');
      expect(result.participated_count).toBe(1);
      expect(result.declined_count).toBe(1);
      expect(result.promos).toHaveLength(3);
    });

    it('should calculate margin impact correctly', async () => {
      const companyId = 'company-1';

      const mockPromos = [createMockPromo('promo-1', companyId, 'Test Sale', '100.00', 'approved')];

      vi.mocked(mockDb.cpgSalesPromos.toArray).mockResolvedValue(mockPromos);

      const result = await service.analyzeTradeSpendROI(companyId, '1yr');

      expect(result.promos[0].margin_impact).toBe('-10.00'); // 68.50 - 78.50
      expect(result.average_margin_impact).toBe('-10.00');
    });

    it('should handle no promos', async () => {
      const companyId = 'company-1';

      vi.mocked(mockDb.cpgSalesPromos.toArray).mockResolvedValue([]);

      const result = await service.analyzeTradeSpendROI(companyId, '1yr');

      expect(result.total_promos_analyzed).toBe(0);
      expect(result.total_promo_cost).toBe('0.00');
      expect(result.participated_count).toBe(0);
      expect(result.declined_count).toBe(0);
      expect(result.promos).toHaveLength(0);
    });

    it('should handle custom date range', async () => {
      const companyId = 'company-1';
      const customStart = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;
      const customEnd = Date.now();

      const mockPromos = [createMockPromo('promo-1', companyId, 'Test Sale', '100.00', 'approved')];

      vi.mocked(mockDb.cpgSalesPromos.toArray).mockResolvedValue(mockPromos);

      const result = await service.analyzeTradeSpendROI(companyId, {
        start: customStart,
        end: customEnd,
      });

      expect(result.total_promos_analyzed).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle gaps in timeline', async () => {
      const companyId = 'company-1';
      const now = Date.now();
      const oneYearAgo = now - 365.25 * 24 * 60 * 60 * 1000;

      // Large gap between data points
      const mockInvoices = [
        createMockInvoice('inv-1', companyId, oneYearAgo + 1000, { '8oz': '2.00' }),
        createMockInvoice('inv-2', companyId, now - 1000, { '8oz': '2.50' }),
      ];

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue(mockInvoices);

      const result = await service.getCPUTrend(companyId, '8oz', undefined, '1yr');

      expect(result.data_points).toHaveLength(2);
      expect(result.statistics.average_cpu).toBe('2.25');
    });

    it('should handle very large CPU values', async () => {
      const companyId = 'company-1';
      const now = Date.now();

      const mockInvoices = [
        createMockInvoice('inv-1', companyId, now - 1000, { '8oz': '999999.99' }),
      ];

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue(mockInvoices);

      const result = await service.getCPUTrend(companyId, '8oz', undefined, '1yr');

      expect(result.statistics.average_cpu).toBe('999999.99');
    });

    it('should handle very small CPU values', async () => {
      const companyId = 'company-1';
      const now = Date.now();

      const mockInvoices = [createMockInvoice('inv-1', companyId, now - 1000, { '8oz': '0.01' })];

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue(mockInvoices);

      const result = await service.getCPUTrend(companyId, '8oz', undefined, '1yr');

      expect(result.statistics.average_cpu).toBe('0.01');
    });

    it('should handle multiple variants in same invoice', async () => {
      const companyId = 'company-1';
      const now = Date.now();

      const mockInvoices = [
        createMockInvoice('inv-1', companyId, now - 1000, {
          '8oz': '2.00',
          '16oz': '3.50',
          '32oz': '6.00',
        }),
      ];

      vi.mocked(mockDb.cpgInvoices.sortBy).mockResolvedValue(mockInvoices);

      const result8oz = await service.getCPUTrend(companyId, '8oz', undefined, '1yr');
      const result16oz = await service.getCPUTrend(companyId, '16oz', undefined, '1yr');

      expect(result8oz.data_points[0].cpu).toBe('2.00');
      expect(result16oz.data_points[0].cpu).toBe('3.50');
    });
  });
});
