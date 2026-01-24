/**
 * Scenario Planning Service Tests
 *
 * Comprehensive test suite for scenario planning functionality:
 * - Distributor comparison
 * - What-if pricing calculator
 * - Break-even analysis
 * - SKU rationalization
 *
 * Coverage target: 80%+
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import { ScenarioPlanningService } from './scenarioPlanning.service';
import type { TreasureChestDB } from '../../db/database';
import type {
  CPGDistributor,
  CPGDistributionCalculation,
} from '../../db/schema/cpg.schema';

// Mock database
const createMockDB = () => {
  const mockDistributors: CPGDistributor[] = [];
  const mockCalculations: CPGDistributionCalculation[] = [];

  return {
    cpgDistributors: {
      where: vi.fn((field: string) => ({
        anyOf: vi.fn((ids: string[]) => ({
          and: vi.fn(() => ({
            toArray: vi.fn(async () =>
              mockDistributors.filter((d) => ids.includes(d.id))
            ),
          })),
        })),
      })),
      get: vi.fn(async (id: string) =>
        mockDistributors.find((d) => d.id === id)
      ),
    },
    cpgDistributionCalculations: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn(async () => mockCalculations),
          })),
        })),
      })),
    },
    _mockData: {
      distributors: mockDistributors,
      calculations: mockCalculations,
    },
  } as unknown as TreasureChestDB;
};

describe('ScenarioPlanningService', () => {
  let service: ScenarioPlanningService;
  let mockDB: ReturnType<typeof createMockDB>;

  beforeEach(() => {
    mockDB = createMockDB();
    service = new ScenarioPlanningService(mockDB as unknown as TreasureChestDB);
  });

  describe('compareDistributors', () => {
    it('should compare 2 distributors side-by-side', async () => {
      // Setup mock distributors
      const distributor1: CPGDistributor = {
        id: 'dist-1',
        company_id: 'company-1',
        name: 'Distributor A',
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
      };

      const distributor2: CPGDistributor = {
        ...distributor1,
        id: 'dist-2',
        name: 'Distributor B',
        fee_structure: {
          ...distributor1.fee_structure,
          pallet_cost: '75.00', // Lower pallet cost
          truck_transfer_zone1: '90.00', // Lower truck transfer
        },
      };

      mockDB._mockData.distributors.push(distributor1, distributor2);

      const params = {
        companyId: 'company-1',
        distributorIds: ['dist-1', 'dist-2'],
        numPallets: '1.00',
        unitsPerPallet: '100',
        variantData: {
          '8oz': {
            price_per_unit: '10.00',
            base_cpu: '3.00',
          },
          '16oz': {
            price_per_unit: '15.00',
            base_cpu: '4.50',
          },
        },
        appliedFees: {
          pallet_cost: true,
          warehouse_services: true,
          pallet_build: true,
          floor_space: 'full_day' as const,
          floor_space_days: '1',
          truck_transfer_zone: 'zone1' as const,
          custom_fees: null,
        },
      };

      const result = await service.compareDistributors(params);

      expect(result.companyId).toBe('company-1');
      expect(result.distributors).toHaveLength(2);
      expect(result.distributors[0].distributorName).toBeTruthy();
      expect(result.distributors[0].averageMargin).toBeTruthy();
      expect(result.distributors[0].recommendationScore).toBeGreaterThanOrEqual(0);
      expect(result.distributors[0].recommendationScore).toBeLessThanOrEqual(100);
      expect(result.bestDistributor).toBeTruthy();
      expect(result.bestDistributor.reason).toBeTruthy();
      expect(result.variantNames).toEqual(['8oz', '16oz']);
    });

    it('should throw error if less than 2 distributors', async () => {
      const params = {
        companyId: 'company-1',
        distributorIds: ['dist-1'],
        numPallets: '1.00',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '10.00', base_cpu: '3.00' },
        },
        appliedFees: {
          pallet_cost: true,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none' as const,
          truck_transfer_zone: 'none' as const,
          custom_fees: null,
        },
      };

      await expect(service.compareDistributors(params)).rejects.toThrow(
        'At least 2 distributors required'
      );
    });

    it('should throw error if more than 4 distributors', async () => {
      const params = {
        companyId: 'company-1',
        distributorIds: ['dist-1', 'dist-2', 'dist-3', 'dist-4', 'dist-5'],
        numPallets: '1.00',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '10.00', base_cpu: '3.00' },
        },
        appliedFees: {
          pallet_cost: true,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none' as const,
          truck_transfer_zone: 'none' as const,
          custom_fees: null,
        },
      };

      await expect(service.compareDistributors(params)).rejects.toThrow(
        'Maximum 4 distributors'
      );
    });

    it('should rank distributors by recommendation score', async () => {
      // Setup 3 distributors with different fee structures
      const baseDistributor: CPGDistributor = {
        id: 'dist-1',
        company_id: 'company-1',
        name: 'Expensive Distributor',
        description: null,
        contact_info: null,
        fee_structure: {
          pallet_cost: '100.00',
          warehouse_services: '50.00',
          pallet_build: '50.00',
          floor_space_full_day: '200.00',
          floor_space_half_day: '100.00',
          truck_transfer_zone1: '150.00',
          truck_transfer_zone2: '200.00',
          custom_fees: null,
        },
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      };

      const cheapDistributor: CPGDistributor = {
        ...baseDistributor,
        id: 'dist-2',
        name: 'Cheap Distributor',
        fee_structure: {
          pallet_cost: '50.00',
          warehouse_services: '20.00',
          pallet_build: '20.00',
          floor_space_full_day: '80.00',
          floor_space_half_day: '40.00',
          truck_transfer_zone1: '70.00',
          truck_transfer_zone2: '100.00',
          custom_fees: null,
        },
      };

      const midDistributor: CPGDistributor = {
        ...baseDistributor,
        id: 'dist-3',
        name: 'Mid-range Distributor',
        fee_structure: {
          pallet_cost: '75.00',
          warehouse_services: '30.00',
          pallet_build: '30.00',
          floor_space_full_day: '120.00',
          floor_space_half_day: '60.00',
          truck_transfer_zone1: '100.00',
          truck_transfer_zone2: '140.00',
          custom_fees: null,
        },
      };

      mockDB._mockData.distributors.push(
        baseDistributor,
        cheapDistributor,
        midDistributor
      );

      const params = {
        companyId: 'company-1',
        distributorIds: ['dist-1', 'dist-2', 'dist-3'],
        numPallets: '1.00',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '10.00', base_cpu: '3.00' },
        },
        appliedFees: {
          pallet_cost: true,
          warehouse_services: true,
          pallet_build: true,
          floor_space: 'full_day' as const,
          floor_space_days: '1',
          truck_transfer_zone: 'zone1' as const,
          custom_fees: null,
        },
      };

      const result = await service.compareDistributors(params);

      // Cheap distributor should be ranked first (best)
      expect(result.distributors[0].distributorName).toBe('Cheap Distributor');
      expect(result.distributors[0].recommendationScore).toBeGreaterThan(
        result.distributors[1].recommendationScore
      );
      expect(result.distributors[1].recommendationScore).toBeGreaterThan(
        result.distributors[2].recommendationScore
      );
      expect(result.bestDistributor.distributorName).toBe('Cheap Distributor');
    });
  });

  describe('calculateWhatIfPricing', () => {
    it('should calculate margin impact of price changes', async () => {
      const distributor: CPGDistributor = {
        id: 'dist-1',
        company_id: 'company-1',
        name: 'Test Distributor',
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
      };

      mockDB._mockData.distributors.push(distributor);

      const params = {
        companyId: 'company-1',
        distributorId: 'dist-1',
        numPallets: '1.00',
        unitsPerPallet: '100',
        appliedFees: {
          pallet_cost: true,
          warehouse_services: true,
          pallet_build: true,
          floor_space: 'full_day' as const,
          floor_space_days: '1',
          truck_transfer_zone: 'zone1' as const,
          custom_fees: null,
        },
        currentPricing: {
          '8oz': { price_per_unit: '10.00', base_cpu: '3.00' },
          '16oz': { price_per_unit: '15.00', base_cpu: '4.50' },
        },
        newPricing: {
          '8oz': '12.00', // 20% increase
          '16oz': '15.00', // No change
        },
      };

      const result = await service.calculateWhatIfPricing(params);

      expect(result.distributorName).toBe('Test Distributor');
      expect(result.variantComparisons['8oz']).toBeTruthy();
      expect(result.variantComparisons['8oz'].currentPrice).toBe('10.00');
      expect(result.variantComparisons['8oz'].newPrice).toBe('12.00');
      expect(parseFloat(result.variantComparisons['8oz'].priceChange)).toBeCloseTo(
        20,
        1
      );
      expect(result.variantComparisons['8oz'].marginImpact).toBeTruthy();
      expect(result.variantComparisons['16oz'].priceChange).toBe('0.00');
      expect(result.overallImpact.averageMarginBefore).toBeTruthy();
      expect(result.overallImpact.averageMarginAfter).toBeTruthy();
      expect(result.overallImpact.totalMarginImpact).toBeTruthy();
    });

    it('should show positive margin impact when price increases', async () => {
      const distributor: CPGDistributor = {
        id: 'dist-1',
        company_id: 'company-1',
        name: 'Test Distributor',
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
      };

      mockDB._mockData.distributors.push(distributor);

      const params = {
        companyId: 'company-1',
        distributorId: 'dist-1',
        numPallets: '1.00',
        unitsPerPallet: '100',
        appliedFees: {
          pallet_cost: true,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none' as const,
          truck_transfer_zone: 'none' as const,
          custom_fees: null,
        },
        currentPricing: {
          '8oz': { price_per_unit: '10.00', base_cpu: '5.00' }, // 50% margin
        },
        newPricing: {
          '8oz': '12.00', // Should improve margin
        },
      };

      const result = await service.calculateWhatIfPricing(params);

      expect(parseFloat(result.variantComparisons['8oz'].marginImpact)).toBeGreaterThan(
        0
      );
      expect(
        parseFloat(result.variantComparisons['8oz'].newMargin)
      ).toBeGreaterThan(
        parseFloat(result.variantComparisons['8oz'].currentMargin)
      );
    });

    it('should throw error if distributor not found', async () => {
      const params = {
        companyId: 'company-1',
        distributorId: 'nonexistent',
        numPallets: '1.00',
        unitsPerPallet: '100',
        appliedFees: {
          pallet_cost: true,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none' as const,
          truck_transfer_zone: 'none' as const,
          custom_fees: null,
        },
        currentPricing: {
          '8oz': { price_per_unit: '10.00', base_cpu: '3.00' },
        },
        newPricing: {
          '8oz': '12.00',
        },
      };

      await expect(service.calculateWhatIfPricing(params)).rejects.toThrow(
        'Distributor not found'
      );
    });
  });

  describe('calculateBreakEven', () => {
    it('should calculate break-even units correctly', async () => {
      const distributor: CPGDistributor = {
        id: 'dist-1',
        company_id: 'company-1',
        name: 'Test Distributor',
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
      };

      mockDB._mockData.distributors.push(distributor);

      const params = {
        companyId: 'company-1',
        distributorId: 'dist-1',
        variantName: '8oz',
        fixedCosts: '10000.00', // $10,000 in fixed costs
        pricePerUnit: '10.00',
        baseCPU: '3.00',
        numPallets: '1.00',
        unitsPerPallet: '100',
        appliedFees: {
          pallet_cost: true,
          warehouse_services: true,
          pallet_build: true,
          floor_space: 'full_day' as const,
          floor_space_days: '1',
          truck_transfer_zone: 'zone1' as const,
          custom_fees: null,
        },
      };

      const result = await service.calculateBreakEven(params);

      expect(result.variantName).toBe('8oz');
      expect(result.fixedCosts).toBe('10000.00');
      expect(result.pricePerUnit).toBe('10.00');
      expect(parseFloat(result.variableCostPerUnit)).toBeGreaterThan(0);
      expect(parseFloat(result.contributionMargin)).toBeGreaterThan(0);
      expect(parseFloat(result.contributionMarginPercentage)).toBeGreaterThan(0);
      expect(parseFloat(result.breakEvenUnits)).toBeGreaterThan(0);
      expect(parseFloat(result.breakEvenRevenue)).toBeGreaterThan(0);
      expect(parseFloat(result.breakEvenPallets)).toBeGreaterThan(0);
      expect(result.recommendation).toBeTruthy();
    });

    it('should calculate break-even correctly with simple example', async () => {
      const distributor: CPGDistributor = {
        id: 'dist-1',
        company_id: 'company-1',
        name: 'Test Distributor',
        description: null,
        contact_info: null,
        fee_structure: {
          pallet_cost: '0.00',
          warehouse_services: '0.00',
          pallet_build: '0.00',
          floor_space_full_day: '0.00',
          floor_space_half_day: '0.00',
          truck_transfer_zone1: '0.00',
          truck_transfer_zone2: '0.00',
          custom_fees: null,
        },
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      };

      mockDB._mockData.distributors.push(distributor);

      const params = {
        companyId: 'company-1',
        distributorId: 'dist-1',
        variantName: 'test',
        fixedCosts: '1000.00', // $1,000 fixed costs
        pricePerUnit: '10.00', // $10 price
        baseCPU: '6.00', // $6 variable cost
        numPallets: '1.00',
        unitsPerPallet: '100',
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none' as const,
          truck_transfer_zone: 'none' as const,
          custom_fees: null,
        },
      };

      const result = await service.calculateBreakEven(params);

      // With $10 price and $6 cost, contribution margin is $4
      // Break-even = $1,000 / $4 = 250 units
      expect(result.contributionMargin).toBe('4.00');
      expect(result.breakEvenUnits).toBe('250');
      expect(result.breakEvenRevenue).toBe('2500.00'); // 250 × $10
      expect(result.contributionMarginPercentage).toBe('40.00'); // (4/10) × 100
    });

    it('should throw error for negative fixed costs', async () => {
      const distributor: CPGDistributor = {
        id: 'dist-1',
        company_id: 'company-1',
        name: 'Test Distributor',
        description: null,
        contact_info: null,
        fee_structure: {
          pallet_cost: '0.00',
          warehouse_services: '0.00',
          pallet_build: '0.00',
          floor_space_full_day: '0.00',
          floor_space_half_day: '0.00',
          truck_transfer_zone1: '0.00',
          truck_transfer_zone2: '0.00',
          custom_fees: null,
        },
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      };

      mockDB._mockData.distributors.push(distributor);

      const params = {
        companyId: 'company-1',
        distributorId: 'dist-1',
        variantName: 'test',
        fixedCosts: '-1000.00',
        pricePerUnit: '10.00',
        baseCPU: '6.00',
        numPallets: '1.00',
        unitsPerPallet: '100',
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none' as const,
          truck_transfer_zone: 'none' as const,
          custom_fees: null,
        },
      };

      await expect(service.calculateBreakEven(params)).rejects.toThrow(
        'Fixed costs must be a non-negative number'
      );
    });

    it('should throw error for zero or negative price', async () => {
      const distributor: CPGDistributor = {
        id: 'dist-1',
        company_id: 'company-1',
        name: 'Test Distributor',
        description: null,
        contact_info: null,
        fee_structure: {
          pallet_cost: '0.00',
          warehouse_services: '0.00',
          pallet_build: '0.00',
          floor_space_full_day: '0.00',
          floor_space_half_day: '0.00',
          truck_transfer_zone1: '0.00',
          truck_transfer_zone2: '0.00',
          custom_fees: null,
        },
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      };

      mockDB._mockData.distributors.push(distributor);

      const params = {
        companyId: 'company-1',
        distributorId: 'dist-1',
        variantName: 'test',
        fixedCosts: '1000.00',
        pricePerUnit: '0.00',
        baseCPU: '6.00',
        numPallets: '1.00',
        unitsPerPallet: '100',
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none' as const,
          truck_transfer_zone: 'none' as const,
          custom_fees: null,
        },
      };

      await expect(service.calculateBreakEven(params)).rejects.toThrow(
        'Price per unit must be greater than 0'
      );
    });
  });

  describe('analyzeSKURationalization', () => {
    it('should recommend keeping high-margin SKUs', async () => {
      const distributor: CPGDistributor = {
        id: 'dist-1',
        company_id: 'company-1',
        name: 'Test Distributor',
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
      };

      const calculation: CPGDistributionCalculation = {
        id: 'calc-1',
        company_id: 'company-1',
        distributor_id: 'dist-1',
        calculation_name: 'Test Calculation',
        calculation_date: Date.now(),
        num_pallets: '1.00',
        units_per_pallet: '100',
        variant_data: {
          '8oz': { price_per_unit: '10.00', base_cpu: '2.00' },
          '16oz': { price_per_unit: '15.00', base_cpu: '3.00' },
        },
        applied_fees: {
          pallet_cost: true,
          warehouse_services: true,
          pallet_build: true,
          floor_space: 'full_day' as const,
          floor_space_days: '1',
          truck_transfer_zone: 'zone1' as const,
          custom_fees: null,
        },
        total_distribution_cost: '331.00',
        distribution_cost_per_unit: '3.31',
        variant_results: {
          '8oz': {
            total_cpu: '5.31',
            net_profit_margin: '46.90', // High margin - should keep
            margin_quality: 'good' as const,
            msrp: null,
          },
          '16oz': {
            total_cpu: '6.31',
            net_profit_margin: '57.93', // High margin - should keep
            margin_quality: 'good' as const,
            msrp: null,
          },
        },
        msrp_markup_percentage: null,
        notes: null,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      };

      mockDB._mockData.distributors.push(distributor);
      mockDB._mockData.calculations.push(calculation);

      const params = {
        companyId: 'company-1',
        distributorId: 'dist-1',
        marginThreshold: '50', // 50% minimum
      };

      const result = await service.analyzeSKURationalization(params);

      expect(result.distributorName).toBe('Test Distributor');
      expect(result.totalSKUs).toBe(2);
      expect(result.recommendations).toHaveLength(2);
      expect(result.summary.keepCount).toBeGreaterThan(0);
      expect(result.summary.reviewCount).toBeGreaterThanOrEqual(0);
      expect(result.summary.discontinueCount).toBeGreaterThanOrEqual(0);
    });

    it('should recommend discontinuing low-margin SKUs (<40%)', async () => {
      const distributor: CPGDistributor = {
        id: 'dist-1',
        company_id: 'company-1',
        name: 'Test Distributor',
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
      };

      const calculation: CPGDistributionCalculation = {
        id: 'calc-1',
        company_id: 'company-1',
        distributor_id: 'dist-1',
        calculation_name: 'Test Calculation',
        calculation_date: Date.now(),
        num_pallets: '1.00',
        units_per_pallet: '100',
        variant_data: {
          'Low-Margin': { price_per_unit: '10.00', base_cpu: '8.00' },
          'High-Margin': { price_per_unit: '20.00', base_cpu: '5.00' },
        },
        applied_fees: {
          pallet_cost: true,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none' as const,
          truck_transfer_zone: 'none' as const,
          custom_fees: null,
        },
        total_distribution_cost: '81.00',
        distribution_cost_per_unit: '0.81',
        variant_results: {
          'Low-Margin': {
            total_cpu: '8.81',
            net_profit_margin: '11.90', // <40% - should discontinue
            margin_quality: 'poor' as const,
            msrp: null,
          },
          'High-Margin': {
            total_cpu: '5.81',
            net_profit_margin: '70.95', // >40% - should keep
            margin_quality: 'best' as const,
            msrp: null,
          },
        },
        msrp_markup_percentage: null,
        notes: null,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      };

      mockDB._mockData.distributors.push(distributor);
      mockDB._mockData.calculations.push(calculation);

      const params = {
        companyId: 'company-1',
        distributorId: 'dist-1',
        marginThreshold: '50',
      };

      const result = await service.analyzeSKURationalization(params);

      const lowMarginRec = result.recommendations.find(
        (r) => r.variantName === 'Low-Margin'
      );
      const highMarginRec = result.recommendations.find(
        (r) => r.variantName === 'High-Margin'
      );

      expect(lowMarginRec?.recommendation).toBe('discontinue');
      expect(lowMarginRec?.reason).toContain('40%');
      expect(lowMarginRec?.actionSteps.length).toBeGreaterThan(0);

      expect(highMarginRec?.recommendation).toBe('keep');
      expect(result.summary.discontinueCount).toBe(1);
      expect(result.summary.keepCount).toBe(1);
    });

    it('should recommend review for SKUs between 40-50% margin', async () => {
      const distributor: CPGDistributor = {
        id: 'dist-1',
        company_id: 'company-1',
        name: 'Test Distributor',
        description: null,
        contact_info: null,
        fee_structure: {
          pallet_cost: '0.00',
          warehouse_services: '0.00',
          pallet_build: '0.00',
          floor_space_full_day: '0.00',
          floor_space_half_day: '0.00',
          truck_transfer_zone1: '0.00',
          truck_transfer_zone2: '0.00',
          custom_fees: null,
        },
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      };

      const calculation: CPGDistributionCalculation = {
        id: 'calc-1',
        company_id: 'company-1',
        distributor_id: 'dist-1',
        calculation_name: 'Test Calculation',
        calculation_date: Date.now(),
        num_pallets: '1.00',
        units_per_pallet: '100',
        variant_data: {
          'Mid-Margin': { price_per_unit: '10.00', base_cpu: '5.50' },
        },
        applied_fees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none' as const,
          truck_transfer_zone: 'none' as const,
          custom_fees: null,
        },
        total_distribution_cost: '0.00',
        distribution_cost_per_unit: '0.00',
        variant_results: {
          'Mid-Margin': {
            total_cpu: '5.50',
            net_profit_margin: '45.00', // Between 40-50% - should review
            margin_quality: 'good' as const,
            msrp: null,
          },
        },
        msrp_markup_percentage: null,
        notes: null,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      };

      mockDB._mockData.distributors.push(distributor);
      mockDB._mockData.calculations.push(calculation);

      const params = {
        companyId: 'company-1',
        distributorId: 'dist-1',
        marginThreshold: '50',
      };

      const result = await service.analyzeSKURationalization(params);

      const midMarginRec = result.recommendations.find(
        (r) => r.variantName === 'Mid-Margin'
      );

      expect(midMarginRec?.recommendation).toBe('review');
      expect(midMarginRec?.reason).toContain('below your 50% target');
      expect(midMarginRec?.actionSteps).toContain('Analyze if price increase is possible');
      expect(result.summary.reviewCount).toBe(1);
    });

    it('should throw error for invalid margin threshold', async () => {
      const params = {
        companyId: 'company-1',
        distributorId: 'dist-1',
        marginThreshold: '150', // Invalid: >100%
      };

      await expect(service.analyzeSKURationalization(params)).rejects.toThrow(
        'Margin threshold must be between 0 and 100'
      );
    });

    it('should throw error if no calculations found', async () => {
      const distributor: CPGDistributor = {
        id: 'dist-1',
        company_id: 'company-1',
        name: 'Test Distributor',
        description: null,
        contact_info: null,
        fee_structure: {
          pallet_cost: '0.00',
          warehouse_services: '0.00',
          pallet_build: '0.00',
          floor_space_full_day: '0.00',
          floor_space_half_day: '0.00',
          truck_transfer_zone1: '0.00',
          truck_transfer_zone2: '0.00',
          custom_fees: null,
        },
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: { 'device-1': 1 },
      };

      mockDB._mockData.distributors.push(distributor);
      // No calculations added

      const params = {
        companyId: 'company-1',
        distributorId: 'dist-1',
        marginThreshold: '50',
      };

      await expect(service.analyzeSKURationalization(params)).rejects.toThrow(
        'No distribution calculations found'
      );
    });
  });
});
