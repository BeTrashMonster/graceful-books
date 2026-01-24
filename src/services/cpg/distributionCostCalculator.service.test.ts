/**
 * Distribution Cost Calculator Service Tests
 *
 * Tests for distribution cost analysis service including:
 * - Multi-layered fee calculations
 * - Checkbox-based fee selection
 * - Pallet multiplier calculations
 * - Zone-based pricing
 * - Custom fees
 * - Floor space calculations (full/half day, multiple days)
 * - Margin quality assignment
 * - MSRP calculation
 * - Scenario saving
 *
 * Coverage target: >= 80%
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import { TreasureChestDB } from '../../db/database';
import {
  DistributionCostCalculatorService,
  DEFAULT_MARGIN_THRESHOLDS,
  type DistributionCalcParams,
  type MarginThresholds,
} from './distributionCostCalculator.service';
import type { CPGDistributor } from '../../db/schema/cpg.schema';

describe('DistributionCostCalculatorService', () => {
  let db: TreasureChestDB;
  let service: DistributionCostCalculatorService;
  let companyId: string;
  let deviceId: string;
  let distributorId: string;

  beforeEach(async () => {
    // Create in-memory database
    db = new TreasureChestDB('test-distribution-calculator-db');
    service = new DistributionCostCalculatorService(db);

    companyId = 'test-company-123';
    deviceId = 'test-device-123';

    // Create a test distributor with comprehensive fee structure
    const distributor = await service.createDistributor(
      companyId,
      'Test Distributor',
      'A test distributor for unit tests',
      'contact@distributor.com',
      {
        pallet_cost: '81.00',
        warehouse_services: '25.00',
        pallet_build: '25.00',
        floor_space_full_day: '100.00',
        floor_space_half_day: '50.00',
        truck_transfer_zone1: '100.00',
        truck_transfer_zone2: '160.00',
        custom_fees: {
          'Insurance': '30.00',
          'Handling': '15.00',
        },
      },
      deviceId
    );

    distributorId = distributor.id;
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('Distributor Management', () => {
    it('should create a distributor with fee structure', async () => {
      const distributor = await service.createDistributor(
        companyId,
        'New Distributor',
        'Another distributor',
        'info@newdist.com',
        {
          pallet_cost: '75.00',
          warehouse_services: '20.00',
          pallet_build: '20.00',
          floor_space_full_day: '90.00',
          floor_space_half_day: '45.00',
          truck_transfer_zone1: '80.00',
          truck_transfer_zone2: '140.00',
          custom_fees: null,
        },
        deviceId
      );

      expect(distributor.id).toBeDefined();
      expect(distributor.company_id).toBe(companyId);
      expect(distributor.name).toBe('New Distributor');
      expect(distributor.fee_structure.pallet_cost).toBe('75.00');
      expect(distributor.active).toBe(true);
    });

    it('should update distributor profile', async () => {
      const updated = await service.updateDistributor(
        distributorId,
        {
          name: 'Updated Distributor',
          fee_structure: {
            pallet_cost: '85.00',
            warehouse_services: '30.00',
            pallet_build: '30.00',
            floor_space_full_day: '110.00',
            floor_space_half_day: '55.00',
            truck_transfer_zone1: '110.00',
            truck_transfer_zone2: '170.00',
            custom_fees: null,
          },
        },
        deviceId
      );

      expect(updated.name).toBe('Updated Distributor');
      expect(updated.fee_structure.pallet_cost).toBe('85.00');
      expect(updated.version_vector[deviceId]).toBe(2);
    });

    it('should throw error when updating non-existent distributor', async () => {
      await expect(
        service.updateDistributor('non-existent-id', { name: 'Test' }, deviceId)
      ).rejects.toThrow('Distributor not found');
    });
  });

  describe('Fee Calculations', () => {
    it('should calculate with all fees unchecked (should = 0)', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      expect(result.totalDistributionCost).toBe('0.00');
      expect(result.distributionCostPerUnit).toBe('0.00');
      expect(result.feeBreakdown).toHaveLength(0);
      expect(result.variantResults['8oz'].total_cpu).toBe('2.15');
    });

    it('should calculate with single fee checked', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: true,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      expect(result.totalDistributionCost).toBe('81.00');
      expect(result.distributionCostPerUnit).toBe('0.81');
      expect(result.feeBreakdown).toHaveLength(1);
      expect(result.feeBreakdown[0].feeName).toBe('Pallet Cost');
      expect(result.feeBreakdown[0].feeAmount).toBe('81.00');

      // Total CPU = Base CPU + Distribution cost per unit
      const expectedTotalCPU = new Decimal('2.15').plus('0.81').toFixed(2);
      expect(result.variantResults['8oz'].total_cpu).toBe(expectedTotalCPU);
    });

    it('should calculate with multiple fees checked', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: true,
          warehouse_services: true,
          pallet_build: true,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      // Total fees = 81 + 25 + 25 = 131
      expect(result.totalDistributionCost).toBe('131.00');
      expect(result.distributionCostPerUnit).toBe('1.31');
      expect(result.feeBreakdown).toHaveLength(3);
    });
  });

  describe('Floor Space Calculations', () => {
    it('should calculate floor space - full day', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'full_day',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      expect(result.totalDistributionCost).toBe('100.00');
      expect(result.feeBreakdown).toHaveLength(1);
      expect(result.feeBreakdown[0].feeName).toBe('Floor Space - Full Day');
      expect(result.feeBreakdown[0].feeAmount).toBe('100.00');
    });

    it('should calculate floor space - half day', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'half_day',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      expect(result.totalDistributionCost).toBe('50.00');
      expect(result.feeBreakdown[0].feeName).toBe('Floor Space - Half Day');
    });

    it('should calculate floor space - multiple days (full)', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'full_day',
          floor_space_days: '3',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      // 100 per day × 3 days = 300
      expect(result.totalDistributionCost).toBe('300.00');
      expect(result.feeBreakdown[0].feeName).toBe('Floor Space - Full Day (3 days)');
    });

    it('should calculate floor space - multiple days (half)', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'half_day',
          floor_space_days: '2',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      // 50 per half day × 2 days = 100
      expect(result.totalDistributionCost).toBe('100.00');
      expect(result.feeBreakdown[0].feeName).toBe('Floor Space - Half Day (2 days)');
    });
  });

  describe('Zone-Based Pricing', () => {
    it('should calculate truck transfer - zone 1', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'zone1',
        },
      };

      const result = await service.calculateDistributionCost(params);

      expect(result.totalDistributionCost).toBe('100.00');
      expect(result.feeBreakdown[0].feeName).toBe('Truck Transfer - Zone 1');
    });

    it('should calculate truck transfer - zone 2', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'zone2',
        },
      };

      const result = await service.calculateDistributionCost(params);

      expect(result.totalDistributionCost).toBe('160.00');
      expect(result.feeBreakdown[0].feeName).toBe('Truck Transfer - Zone 2');
    });
  });

  describe('Custom Fees', () => {
    it('should calculate with single custom fee', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
          custom_fees: ['Insurance'],
        },
      };

      const result = await service.calculateDistributionCost(params);

      expect(result.totalDistributionCost).toBe('30.00');
      expect(result.feeBreakdown[0].feeName).toBe('Insurance');
      expect(result.feeBreakdown[0].feeAmount).toBe('30.00');
    });

    it('should calculate with multiple custom fees', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
          custom_fees: ['Insurance', 'Handling'],
        },
      };

      const result = await service.calculateDistributionCost(params);

      // Insurance 30 + Handling 15 = 45
      expect(result.totalDistributionCost).toBe('45.00');
      expect(result.feeBreakdown).toHaveLength(2);
    });
  });

  describe('Pallet Multiplier', () => {
    it('should calculate with 0.5 pallets', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '0.5',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: true,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      // 81 × 0.5 = 40.50
      expect(result.totalDistributionCost).toBe('40.50');
      // 40.50 / (0.5 × 100) = 40.50 / 50 = 0.81
      expect(result.distributionCostPerUnit).toBe('0.81');
    });

    it('should calculate with 1 pallet', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: true,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      expect(result.totalDistributionCost).toBe('81.00');
      expect(result.distributionCostPerUnit).toBe('0.81');
    });

    it('should calculate with 10 pallets', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '10',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: true,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      // 81 × 10 = 810
      expect(result.totalDistributionCost).toBe('810.00');
      // 810 / (10 × 100) = 810 / 1000 = 0.81
      expect(result.distributionCostPerUnit).toBe('0.81');
    });
  });

  describe('Margin Quality Assignment', () => {
    it('should assign "poor" quality for margin < 50%', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.00', base_cpu: '2.00' },
        },
        appliedFees: {
          pallet_cost: true, // Adds 0.81 per unit
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      // Total CPU = 2.00 + 0.81 = 2.81
      // Margin = ((3.00 - 2.81) / 3.00) × 100 = 6.33%
      expect(result.variantResults['8oz'].margin_quality).toBe('poor');
    });

    it('should assign "good" quality for margin 50-60%', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.00', base_cpu: '1.00' },
        },
        appliedFees: {
          pallet_cost: true, // Adds 0.81 per unit
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      // Total CPU = 1.00 + 0.81 = 1.81
      // Margin = ((3.00 - 1.81) / 3.00) × 100 = 39.67% ... hmm, that's poor
      // Let me recalculate for a better scenario

      const params2: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '1000',
        variantData: {
          '8oz': { price_per_unit: '3.00', base_cpu: '1.30' },
        },
        appliedFees: {
          pallet_cost: true, // Adds 0.081 per unit
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const result2 = await service.calculateDistributionCost(params2);

      // Total CPU = 1.30 + 0.081 = 1.381
      // Margin = ((3.00 - 1.381) / 3.00) × 100 = 53.97%
      expect(result2.variantResults['8oz'].margin_quality).toBe('good');
    });

    it('should assign "better" quality for margin 60-70%', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '1000',
        variantData: {
          '8oz': { price_per_unit: '3.00', base_cpu: '1.10' },
        },
        appliedFees: {
          pallet_cost: true, // Adds 0.081 per unit
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      // Total CPU = 1.10 + 0.081 = 1.181
      // Margin = ((3.00 - 1.181) / 3.00) × 100 = 60.63%
      expect(result.variantResults['8oz'].margin_quality).toBe('better');
    });

    it('should assign "best" quality for margin >= 70%', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '1000',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '0.90' },
        },
        appliedFees: {
          pallet_cost: true, // Adds 0.081 per unit
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      // Total CPU = 0.90 + 0.081 = 0.981
      // Margin = ((3.38 - 0.981) / 3.38) × 100 = 70.98%
      expect(result.variantResults['8oz'].margin_quality).toBe('best');
    });

    it('should use custom thresholds for margin quality', async () => {
      const customThresholds: MarginThresholds = {
        poor: 40,
        good: 40,
        better: 50,
        best: 60,
      };

      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.00', base_cpu: '1.30' },
        },
        appliedFees: {
          pallet_cost: true, // Adds 0.81 per unit
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params, customThresholds);

      // Total CPU = 1.30 + 0.81 = 2.11
      // Margin = ((3.00 - 2.11) / 3.00) × 100 = 29.67%
      // With custom thresholds: < 40 = poor
      expect(result.variantResults['8oz'].margin_quality).toBe('poor');
    });
  });

  describe('MSRP Calculation', () => {
    it('should calculate MSRP with markup percentage', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
        msrpMarkupPercentage: '50', // 50% markup
      };

      const result = await service.calculateDistributionCost(params);

      // MSRP = 3.38 × (1 + 50/100) = 3.38 × 1.5 = 5.07
      expect(result.variantResults['8oz'].msrp).toBe('5.07');
    });

    it('should calculate MSRP with 100% markup', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.00', base_cpu: '2.00' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
        msrpMarkupPercentage: '100', // 100% markup (double)
      };

      const result = await service.calculateDistributionCost(params);

      // MSRP = 3.00 × (1 + 100/100) = 3.00 × 2 = 6.00
      expect(result.variantResults['8oz'].msrp).toBe('6.00');
    });

    it('should return null MSRP when markup not provided', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      expect(result.variantResults['8oz'].msrp).toBeNull();
    });
  });

  describe('Multiple Variants', () => {
    it('should calculate for multiple variants (2 variants)', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          'Small': { price_per_unit: '3.38', base_cpu: '2.15' },
          'Large': { price_per_unit: '5.50', base_cpu: '3.20' },
        },
        appliedFees: {
          pallet_cost: true,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      // Distribution cost per unit = 81 / 100 = 0.81
      expect(result.distributionCostPerUnit).toBe('0.81');

      // Small: Total CPU = 2.15 + 0.81 = 2.96
      expect(result.variantResults['Small'].total_cpu).toBe('2.96');
      // Small: Margin = ((3.38 - 2.96) / 3.38) × 100 = 12.43%
      expect(result.variantResults['Small'].net_profit_margin).toBe('12.43');
      expect(result.variantResults['Small'].margin_quality).toBe('poor');

      // Large: Total CPU = 3.20 + 0.81 = 4.01
      expect(result.variantResults['Large'].total_cpu).toBe('4.01');
      // Large: Margin = ((5.50 - 4.01) / 5.50) × 100 = 27.09%
      expect(result.variantResults['Large'].net_profit_margin).toBe('27.09');
      expect(result.variantResults['Large'].margin_quality).toBe('poor');
    });

    it('should calculate for multiple variants with custom names', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.00', base_cpu: '1.50' },
          '16oz': { price_per_unit: '5.00', base_cpu: '2.50' },
          '32oz': { price_per_unit: '8.00', base_cpu: '4.00' },
        },
        appliedFees: {
          pallet_cost: true,
          warehouse_services: true,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      // Distribution cost per unit = (81 + 25) / 100 = 1.06
      expect(result.distributionCostPerUnit).toBe('1.06');

      expect(result.variantResults['8oz'].total_cpu).toBe('2.56');
      expect(result.variantResults['16oz'].total_cpu).toBe('3.56');
      expect(result.variantResults['32oz'].total_cpu).toBe('5.06');
    });
  });

  describe('Scenario Saving', () => {
    it('should save calculation as scenario', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: true,
          warehouse_services: true,
          pallet_build: true,
          floor_space: 'full_day',
          truck_transfer_zone: 'zone1',
        },
      };

      const result = await service.calculateDistributionCost(params);

      const saved = await service.saveCalculation(
        result,
        params,
        companyId,
        'Test Scenario',
        deviceId,
        'Notes about this scenario'
      );

      expect(saved.id).toBeDefined();
      expect(saved.company_id).toBe(companyId);
      expect(saved.distributor_id).toBe(distributorId);
      expect(saved.calculation_name).toBe('Test Scenario');
      expect(saved.total_distribution_cost).toBe(result.totalDistributionCost);
      expect(saved.notes).toBe('Notes about this scenario');
    });

    it('should retrieve saved calculations', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: true,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const result = await service.calculateDistributionCost(params);

      await service.saveCalculation(result, params, companyId, 'Scenario 1', deviceId);
      await service.saveCalculation(result, params, companyId, 'Scenario 2', deviceId);

      const saved = await service.getSavedCalculations(companyId);

      expect(saved).toHaveLength(2);
      expect(saved[0].calculation_name).toBe('Scenario 2'); // Most recent first
      expect(saved[1].calculation_name).toBe('Scenario 1');
    });

    it('should filter saved calculations by distributor', async () => {
      // Create second distributor
      const distributor2 = await service.createDistributor(
        companyId,
        'Distributor 2',
        null,
        null,
        {
          pallet_cost: '80.00',
          warehouse_services: null,
          pallet_build: null,
          floor_space_full_day: null,
          floor_space_half_day: null,
          truck_transfer_zone1: null,
          truck_transfer_zone2: null,
          custom_fees: null,
        },
        deviceId
      );

      const params1: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: true,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      const params2: DistributionCalcParams = {
        ...params1,
        distributorId: distributor2.id,
      };

      const result1 = await service.calculateDistributionCost(params1);
      const result2 = await service.calculateDistributionCost(params2);

      await service.saveCalculation(result1, params1, companyId, 'Dist 1 Scenario', deviceId);
      await service.saveCalculation(result2, params2, companyId, 'Dist 2 Scenario', deviceId);

      const dist1Calculations = await service.getSavedCalculations(companyId, distributorId);
      const dist2Calculations = await service.getSavedCalculations(
        companyId,
        distributor2.id
      );

      expect(dist1Calculations).toHaveLength(1);
      expect(dist2Calculations).toHaveLength(1);
      expect(dist1Calculations[0].calculation_name).toBe('Dist 1 Scenario');
      expect(dist2Calculations[0].calculation_name).toBe('Dist 2 Scenario');
    });
  });

  describe('Validation', () => {
    it('should validate distributor ID', async () => {
      const params: DistributionCalcParams = {
        distributorId: '',
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      await expect(service.calculateDistributionCost(params)).rejects.toThrow(
        'Distributor ID is required'
      );
    });

    it('should validate num pallets > 0', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '0',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      await expect(service.calculateDistributionCost(params)).rejects.toThrow(
        'Number of pallets must be greater than 0'
      );
    });

    it('should validate units per pallet > 0', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '0',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      await expect(service.calculateDistributionCost(params)).rejects.toThrow(
        'Units per pallet must be greater than 0'
      );
    });

    it('should validate variant data exists', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {},
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      await expect(service.calculateDistributionCost(params)).rejects.toThrow(
        'At least one variant with pricing data is required'
      );
    });

    it('should validate negative price', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '-3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      await expect(service.calculateDistributionCost(params)).rejects.toThrow(
        'Price per unit cannot be negative for variant: 8oz'
      );
    });

    it('should validate negative base CPU', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '-2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
      };

      await expect(service.calculateDistributionCost(params)).rejects.toThrow(
        'Base CPU cannot be negative for variant: 8oz'
      );
    });

    it('should validate floor space days > 0', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'full_day',
          floor_space_days: '0',
          truck_transfer_zone: 'none',
        },
      };

      await expect(service.calculateDistributionCost(params)).rejects.toThrow(
        'Floor space days must be greater than 0'
      );
    });

    it('should validate negative MSRP markup', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: false,
          warehouse_services: false,
          pallet_build: false,
          floor_space: 'none',
          truck_transfer_zone: 'none',
        },
        msrpMarkupPercentage: '-50',
      };

      await expect(service.calculateDistributionCost(params)).rejects.toThrow(
        'MSRP markup percentage cannot be negative'
      );
    });
  });

  describe('Complex Scenarios', () => {
    it('should calculate realistic scenario with all fees', async () => {
      const params: DistributionCalcParams = {
        distributorId,
        numPallets: '1',
        unitsPerPallet: '100',
        variantData: {
          '8oz': { price_per_unit: '3.38', base_cpu: '2.15' },
        },
        appliedFees: {
          pallet_cost: true, // 81
          warehouse_services: true, // 25
          pallet_build: true, // 25
          floor_space: 'full_day', // 100
          truck_transfer_zone: 'zone1', // 100
          custom_fees: ['Insurance'], // 30
        },
      };

      const result = await service.calculateDistributionCost(params);

      // Total fees = 81 + 25 + 25 + 100 + 100 + 30 = 361
      expect(result.totalDistributionCost).toBe('361.00');
      // Distribution cost per unit = 361 / 100 = 3.61
      expect(result.distributionCostPerUnit).toBe('3.61');
      // Total CPU = 2.15 + 3.61 = 5.76
      expect(result.variantResults['8oz'].total_cpu).toBe('5.76');
      // Margin = ((3.38 - 5.76) / 3.38) × 100 = -70.41% (negative margin!)
      expect(result.variantResults['8oz'].margin_quality).toBe('poor');
      expect(result.feeBreakdown).toHaveLength(6);
    });
  });
});
