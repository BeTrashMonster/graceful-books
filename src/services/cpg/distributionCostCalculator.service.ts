/**
 * Distribution Cost Calculator Service
 *
 * Provides distribution cost analysis for CPG businesses with multi-layered fee structures.
 * Calculates total CPU (base CPU + distribution cost per unit), profit margins, and MSRP.
 *
 * Key features:
 * - Multi-layered fee structures (pallet cost, warehouse services, floor space, etc.)
 * - Flexible variant support (not hardcoded Small/Large)
 * - Checkbox-based fee selection
 * - Color-coded margin quality (poor/good/better/best)
 * - MSRP calculation with markup percentage
 * - Scenario saving for comparison
 *
 * Requirements:
 * - Group B2: Distribution Cost Calculator Service
 * - Use Decimal.js for all financial calculations
 * - Support user-defined variants
 * - Calculate distribution cost per unit = Total fees / (Pallets × Units per pallet)
 * - Calculate total CPU = Base CPU + Distribution cost per unit
 * - Calculate profit margin = ((Price - Total CPU) / Price) × 100
 *
 * Formulas:
 * Distribution Cost Per Unit = Total Distribution Fees / (Num Pallets × Units Per Pallet)
 * Total CPU = Base CPU + Distribution Cost Per Unit
 * Net Profit Margin = ((Price - Total CPU) / Price) × 100
 *
 * Color Coding (user-configurable defaults):
 * - Poor (Red): < 50%
 * - Good (Yellow): 50-60%
 * - Better (Light Green): 60-70%
 * - Best (Dark Green): >= 70%
 */

import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import type { TreasureChestDB } from '../../db/database';
import type {
  CPGDistributor,
  CPGDistributionCalculation,
} from '../../db/schema/cpg.schema';

/**
 * Distribution calculation input parameters
 */
export interface DistributionCalcParams {
  distributorId: string;
  numPallets: string; // Decimal as string for precision
  unitsPerPallet: string;

  // Variant-specific pricing and costs
  // Example: { "8oz": { price_per_unit: "3.38", base_cpu: "2.15" }, "16oz": { ... } }
  variantData: Record<
    string,
    {
      price_per_unit: string;
      base_cpu: string; // From CPG Invoice calculations
    }
  >;

  // Fee selections (checkboxes)
  appliedFees: {
    pallet_cost: boolean;
    warehouse_services: boolean;
    pallet_build: boolean;
    floor_space: 'none' | 'full_day' | 'half_day';
    floor_space_days?: string; // Number of days
    truck_transfer_zone: 'none' | 'zone1' | 'zone2';
    custom_fees?: string[]; // Array of custom fee names that apply
  };

  // Optional MSRP calculation
  msrpMarkupPercentage?: string; // e.g., "50" for 50%
}

/**
 * Distribution calculation result
 */
export interface DistributionCostResult {
  distributorId: string;
  totalDistributionCost: string;
  distributionCostPerUnit: string;

  // Results per variant
  // Example: { "8oz": { total_cpu: "2.50", net_profit_margin: "67.76", ... }, ... }
  variantResults: Record<
    string,
    {
      total_cpu: string; // Base CPU + Distribution cost per unit
      net_profit_margin: string; // (Price - Total CPU) / Price * 100
      margin_quality: 'poor' | 'good' | 'better' | 'best';
      msrp: string | null; // If MSRP markup applied
    }
  >;

  // Fee breakdown for transparency
  feeBreakdown: {
    feeName: string;
    feeAmount: string;
  }[];
}

/**
 * Margin quality thresholds (user-configurable)
 */
export interface MarginThresholds {
  poor: number; // < 50
  good: number; // 50
  better: number; // 60
  best: number; // 70
}

/**
 * Default margin thresholds
 */
export const DEFAULT_MARGIN_THRESHOLDS: MarginThresholds = {
  poor: 50,
  good: 50,
  better: 60,
  best: 70,
};

/**
 * Distribution Cost Calculator Service
 */
export class DistributionCostCalculatorService {
  private db: TreasureChestDB;

  constructor(db: TreasureChestDB) {
    this.db = db;
  }

  /**
   * Create a new distributor profile
   *
   * @param companyId - Company ID
   * @param name - Distributor name
   * @param description - Optional description
   * @param contactInfo - Optional contact information
   * @param feeStructure - Multi-layered fee structure
   * @param deviceId - Device ID for CRDT
   * @returns Created distributor
   */
  async createDistributor(
    companyId: string,
    name: string,
    description: string | null,
    contactInfo: string | null,
    feeStructure: CPGDistributor['fee_structure'],
    deviceId: string
  ): Promise<CPGDistributor> {
    const now = Date.now();

    const distributor: CPGDistributor = {
      id: nanoid(),
      company_id: companyId,
      name,
      description,
      contact_info: contactInfo,
      fee_structure: feeStructure,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    await this.db.cpgDistributors.add(distributor);
    return distributor;
  }

  /**
   * Update distributor profile
   *
   * @param distributorId - Distributor ID
   * @param updates - Partial distributor updates
   * @param deviceId - Device ID for CRDT
   * @returns Updated distributor
   */
  async updateDistributor(
    distributorId: string,
    updates: Partial<
      Pick<CPGDistributor, 'name' | 'description' | 'contact_info' | 'fee_structure' | 'active'>
    >,
    deviceId: string
  ): Promise<CPGDistributor> {
    const distributor = await this.db.cpgDistributors.get(distributorId);
    if (!distributor) {
      throw new Error(`Distributor not found: ${distributorId}`);
    }

    const now = Date.now();
    const currentVersion = distributor.version_vector[deviceId] || 0;

    await this.db.cpgDistributors.update(distributorId, {
      ...updates,
      updated_at: now,
      version_vector: {
        ...distributor.version_vector,
        [deviceId]: currentVersion + 1,
      },
    });

    const updated = await this.db.cpgDistributors.get(distributorId);
    if (!updated) {
      throw new Error('Failed to retrieve updated distributor');
    }

    return updated;
  }

  /**
   * Calculate distribution cost with checkbox-based fee selection
   *
   * Formula:
   * Distribution Cost Per Unit = Total Distribution Fees / (Num Pallets × Units Per Pallet)
   * Total CPU = Base CPU + Distribution Cost Per Unit
   * Net Profit Margin = ((Price - Total CPU) / Price) × 100
   *
   * @param params - Distribution calculation parameters
   * @param thresholds - Margin quality thresholds (optional, uses defaults)
   * @returns Distribution cost result
   */
  async calculateDistributionCost(
    params: DistributionCalcParams,
    thresholds: MarginThresholds = DEFAULT_MARGIN_THRESHOLDS
  ): Promise<DistributionCostResult> {
    // Validate parameters
    this.validateDistributionParams(params);

    // Get distributor
    const distributor = await this.db.cpgDistributors.get(params.distributorId);
    if (!distributor) {
      throw new Error(`Distributor not found: ${params.distributorId}`);
    }

    // Calculate total distribution fees
    const { totalFees, feeBreakdown } = this.calculateTotalFees(
      distributor.fee_structure,
      params.appliedFees,
      params.numPallets
    );

    // Calculate distribution cost per unit
    const numPallets = new Decimal(params.numPallets);
    const unitsPerPallet = new Decimal(params.unitsPerPallet);
    const totalUnits = numPallets.times(unitsPerPallet);

    let distributionCostPerUnit = new Decimal(0);
    if (totalUnits.greaterThan(0)) {
      distributionCostPerUnit = totalFees.dividedBy(totalUnits);
    }

    // Calculate results per variant
    const variantResults: DistributionCostResult['variantResults'] = {};

    for (const [variantName, variantData] of Object.entries(params.variantData)) {
      const baseCPU = new Decimal(variantData.base_cpu);
      const pricePerUnit = new Decimal(variantData.price_per_unit);

      // Total CPU = Base CPU + Distribution cost per unit
      const totalCPU = baseCPU.plus(distributionCostPerUnit);

      // Net Profit Margin = ((Price - Total CPU) / Price) × 100
      let netProfitMargin = new Decimal(0);
      if (pricePerUnit.greaterThan(0)) {
        netProfitMargin = pricePerUnit
          .minus(totalCPU)
          .dividedBy(pricePerUnit)
          .times(100);
      }

      // Determine margin quality based on thresholds
      const marginQuality = this.determineMarginQuality(
        netProfitMargin.toNumber(),
        thresholds
      );

      // Calculate MSRP if markup percentage provided
      let msrp: string | null = null;
      if (params.msrpMarkupPercentage) {
        const markupPercentage = new Decimal(params.msrpMarkupPercentage);
        msrp = pricePerUnit
          .times(new Decimal(1).plus(markupPercentage.dividedBy(100)))
          .toFixed(2);
      }

      variantResults[variantName] = {
        total_cpu: totalCPU.toFixed(2),
        net_profit_margin: netProfitMargin.toFixed(2),
        margin_quality: marginQuality,
        msrp,
      };
    }

    return {
      distributorId: params.distributorId,
      totalDistributionCost: totalFees.toFixed(2),
      distributionCostPerUnit: distributionCostPerUnit.toFixed(2),
      variantResults,
      feeBreakdown,
    };
  }

  /**
   * Save distribution calculation as a scenario
   *
   * @param result - Distribution cost result
   * @param params - Calculation parameters
   * @param companyId - Company ID
   * @param calculationName - Optional name for the scenario
   * @param deviceId - Device ID for CRDT
   * @param notes - Optional notes
   * @returns Saved calculation
   */
  async saveCalculation(
    result: DistributionCostResult,
    params: DistributionCalcParams,
    companyId: string,
    calculationName: string | null,
    deviceId: string,
    notes: string | null = null
  ): Promise<CPGDistributionCalculation> {
    const now = Date.now();

    const calculation: CPGDistributionCalculation = {
      id: nanoid(),
      company_id: companyId,
      distributor_id: params.distributorId,
      calculation_name: calculationName,
      calculation_date: now,
      num_pallets: params.numPallets,
      units_per_pallet: params.unitsPerPallet,
      variant_data: params.variantData,
      applied_fees: {
        ...params.appliedFees,
        floor_space_days: params.appliedFees.floor_space_days || null,
        custom_fees: params.appliedFees.custom_fees || null,
      },
      total_distribution_cost: result.totalDistributionCost,
      distribution_cost_per_unit: result.distributionCostPerUnit,
      variant_results: result.variantResults,
      msrp_markup_percentage: params.msrpMarkupPercentage || null,
      notes,
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    await this.db.cpgDistributionCalculations.add(calculation);
    return calculation;
  }

  /**
   * Get saved calculations for a distributor
   *
   * @param companyId - Company ID
   * @param distributorId - Optional distributor ID to filter
   * @returns Array of saved calculations
   */
  async getSavedCalculations(
    companyId: string,
    distributorId?: string
  ): Promise<CPGDistributionCalculation[]> {
    let query = this.db.cpgDistributionCalculations
      .where('company_id')
      .equals(companyId)
      .and((calc) => calc.active === true && calc.deleted_at === null);

    if (distributorId) {
      query = query.and((calc) => calc.distributor_id === distributorId);
    }

    const calculations = await query.toArray();
    return calculations.sort((a, b) => b.calculation_date - a.calculation_date);
  }

  /**
   * Calculate total fees based on selected checkboxes
   *
   * @param feeStructure - Distributor's fee structure
   * @param appliedFees - Selected fees
   * @param numPallets - Number of pallets
   * @returns Total fees and breakdown
   */
  private calculateTotalFees(
    feeStructure: CPGDistributor['fee_structure'],
    appliedFees: DistributionCalcParams['appliedFees'],
    numPallets: string
  ): {
    totalFees: Decimal;
    feeBreakdown: { feeName: string; feeAmount: string }[];
  } {
    let totalFees = new Decimal(0);
    const feeBreakdown: { feeName: string; feeAmount: string }[] = [];
    const pallets = new Decimal(numPallets);

    // Pallet cost (per pallet)
    if (appliedFees.pallet_cost && feeStructure.pallet_cost) {
      const palletCost = new Decimal(feeStructure.pallet_cost);
      const totalPalletCost = palletCost.times(pallets);
      totalFees = totalFees.plus(totalPalletCost);
      feeBreakdown.push({
        feeName: 'Pallet Cost',
        feeAmount: totalPalletCost.toFixed(2),
      });
    }

    // Warehouse services (per pallet)
    if (appliedFees.warehouse_services && feeStructure.warehouse_services) {
      const warehouseServices = new Decimal(feeStructure.warehouse_services);
      const totalWarehouseServices = warehouseServices.times(pallets);
      totalFees = totalFees.plus(totalWarehouseServices);
      feeBreakdown.push({
        feeName: 'Warehouse Services',
        feeAmount: totalWarehouseServices.toFixed(2),
      });
    }

    // Pallet build (per pallet)
    if (appliedFees.pallet_build && feeStructure.pallet_build) {
      const palletBuild = new Decimal(feeStructure.pallet_build);
      const totalPalletBuild = palletBuild.times(pallets);
      totalFees = totalFees.plus(totalPalletBuild);
      feeBreakdown.push({
        feeName: 'Pallet Build',
        feeAmount: totalPalletBuild.toFixed(2),
      });
    }

    // Floor space (full day or half day, times number of days)
    if (appliedFees.floor_space !== 'none') {
      let floorSpaceFee: Decimal | null = null;
      let feeName = '';

      if (
        appliedFees.floor_space === 'full_day' &&
        feeStructure.floor_space_full_day
      ) {
        floorSpaceFee = new Decimal(feeStructure.floor_space_full_day);
        feeName = 'Floor Space - Full Day';
      } else if (
        appliedFees.floor_space === 'half_day' &&
        feeStructure.floor_space_half_day
      ) {
        floorSpaceFee = new Decimal(feeStructure.floor_space_half_day);
        feeName = 'Floor Space - Half Day';
      }

      if (floorSpaceFee) {
        const days = appliedFees.floor_space_days
          ? new Decimal(appliedFees.floor_space_days)
          : new Decimal(1);
        const totalFloorSpace = floorSpaceFee.times(days);
        totalFees = totalFees.plus(totalFloorSpace);
        feeBreakdown.push({
          feeName: `${feeName}${days.greaterThan(1) ? ` (${days} days)` : ''}`,
          feeAmount: totalFloorSpace.toFixed(2),
        });
      }
    }

    // Truck transfer (zone-based pricing)
    if (appliedFees.truck_transfer_zone !== 'none') {
      let truckTransferFee: Decimal | null = null;
      let feeName = '';

      if (
        appliedFees.truck_transfer_zone === 'zone1' &&
        feeStructure.truck_transfer_zone1
      ) {
        truckTransferFee = new Decimal(feeStructure.truck_transfer_zone1);
        feeName = 'Truck Transfer - Zone 1';
      } else if (
        appliedFees.truck_transfer_zone === 'zone2' &&
        feeStructure.truck_transfer_zone2
      ) {
        truckTransferFee = new Decimal(feeStructure.truck_transfer_zone2);
        feeName = 'Truck Transfer - Zone 2';
      }

      if (truckTransferFee) {
        totalFees = totalFees.plus(truckTransferFee);
        feeBreakdown.push({
          feeName,
          feeAmount: truckTransferFee.toFixed(2),
        });
      }
    }

    // Custom fees
    if (appliedFees.custom_fees && feeStructure.custom_fees) {
      for (const customFeeName of appliedFees.custom_fees) {
        const customFeeAmount = feeStructure.custom_fees[customFeeName];
        if (customFeeAmount) {
          const customFee = new Decimal(customFeeAmount);
          totalFees = totalFees.plus(customFee);
          feeBreakdown.push({
            feeName: customFeeName,
            feeAmount: customFee.toFixed(2),
          });
        }
      }
    }

    return { totalFees, feeBreakdown };
  }

  /**
   * Determine margin quality based on thresholds
   *
   * Default thresholds:
   * - Poor (Red): < 50%
   * - Good (Yellow): 50-60%
   * - Better (Light Green): 60-70%
   * - Best (Dark Green): >= 70%
   *
   * @param marginPercentage - Net profit margin percentage
   * @param thresholds - Margin quality thresholds
   * @returns Margin quality
   */
  private determineMarginQuality(
    marginPercentage: number,
    thresholds: MarginThresholds
  ): 'poor' | 'good' | 'better' | 'best' {
    if (marginPercentage < thresholds.poor) return 'poor';
    if (marginPercentage < thresholds.better) return 'good';
    if (marginPercentage < thresholds.best) return 'better';
    return 'best';
  }

  /**
   * Validate distribution calculation parameters
   *
   * @param params - Distribution calculation parameters
   * @throws Error if validation fails
   */
  private validateDistributionParams(params: DistributionCalcParams): void {
    const errors: string[] = [];

    // Validate distributor ID
    if (!params.distributorId) {
      errors.push('Distributor ID is required');
    }

    // Validate num pallets
    if (!params.numPallets) {
      errors.push('Number of pallets is required');
    } else {
      const numPallets = new Decimal(params.numPallets);
      if (numPallets.lessThanOrEqualTo(0)) {
        errors.push('Number of pallets must be greater than 0');
      }
    }

    // Validate units per pallet
    if (!params.unitsPerPallet) {
      errors.push('Units per pallet is required');
    } else {
      const unitsPerPallet = new Decimal(params.unitsPerPallet);
      if (unitsPerPallet.lessThanOrEqualTo(0)) {
        errors.push('Units per pallet must be greater than 0');
      }
    }

    // Validate variant data
    if (!params.variantData || Object.keys(params.variantData).length === 0) {
      errors.push('At least one variant with pricing data is required');
    } else {
      for (const [variantName, variantData] of Object.entries(params.variantData)) {
        if (!variantData.price_per_unit) {
          errors.push(`Price per unit is required for variant: ${variantName}`);
        } else {
          const price = new Decimal(variantData.price_per_unit);
          if (price.lessThan(0)) {
            errors.push(`Price per unit cannot be negative for variant: ${variantName}`);
          }
        }

        if (!variantData.base_cpu) {
          errors.push(`Base CPU is required for variant: ${variantName}`);
        } else {
          const baseCPU = new Decimal(variantData.base_cpu);
          if (baseCPU.lessThan(0)) {
            errors.push(`Base CPU cannot be negative for variant: ${variantName}`);
          }
        }
      }
    }

    // Validate floor space days if applicable
    if (params.appliedFees.floor_space !== 'none' && params.appliedFees.floor_space_days) {
      const days = new Decimal(params.appliedFees.floor_space_days);
      if (days.lessThanOrEqualTo(0)) {
        errors.push('Floor space days must be greater than 0');
      }
    }

    // Validate MSRP markup percentage if provided
    if (params.msrpMarkupPercentage) {
      const markup = new Decimal(params.msrpMarkupPercentage);
      if (markup.lessThan(0)) {
        errors.push('MSRP markup percentage cannot be negative');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }
}
