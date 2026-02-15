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

  // Flexible fee selections
  selectedFees: Array<{
    feeId: string;
    description: string;
    amount: string;
    unit: 'per_pallet' | 'per_case' | 'per_day_full' | 'per_day_half' | 'per_shipment' | 'per_zone' | 'flat_fee' | 'percentage';
    quantity?: string; // For per_day fees, etc.
    percentage_basis?: 'product_value' | 'distribution_cost' | 'discount';
  }>;

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
      margin_quality: 'gutCheck' | 'good' | 'better' | 'best';
      msrp: string | null; // If MSRP markup applied
    }
  >;

  // Fee breakdown for transparency
  feeBreakdown: {
    feeId: string;
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
   * @param linkedContactId - Optional link to bookkeeping Contact (vendor)
   * @returns Created distributor
   */
  async createDistributor(
    companyId: string,
    name: string,
    description: string | null,
    contactInfo: string | null,
    feeStructure: CPGDistributor['fee_structure'],
    deviceId: string,
    lastFeeUpdateDate?: number | null,
    typicalUpdateFrequency?: 'weekly' | 'monthly' | 'quarterly' | 'annually' | null,
    linkedContactId?: string | null
  ): Promise<CPGDistributor> {
    const now = Date.now();

    const distributor: CPGDistributor = {
      id: nanoid(),
      company_id: companyId,
      name,
      description,
      contact_info: contactInfo,
      fee_structure: feeStructure,
      last_fee_update_date: lastFeeUpdateDate || null,
      typical_update_frequency: typicalUpdateFrequency || null,
      linked_contact_id: linkedContactId || null,
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
      Pick<CPGDistributor, 'name' | 'description' | 'contact_info' | 'fee_structure' | 'active' | 'last_fee_update_date' | 'typical_update_frequency' | 'linked_contact_id'>
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
      params.selectedFees,
      params.numPallets,
      params.variantData
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
      selected_fees: params.selectedFees,
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
   * Calculate total fees based on selected fees (flexible structure)
   *
   * @param selectedFees - Array of selected fees with their configurations
   * @param numPallets - Number of pallets
   * @returns Total fees and breakdown
   */
  private calculateTotalFees(
    selectedFees: DistributionCalcParams['selectedFees'],
    numPallets: string,
    variantData: DistributionCalcParams['variantData']
  ): {
    totalFees: Decimal;
    feeBreakdown: { feeId: string; feeName: string; feeAmount: string }[];
  } {
    let totalFees = new Decimal(0);
    const feeBreakdown: { feeId: string; feeName: string; feeAmount: string }[] = [];
    const pallets = new Decimal(numPallets);

    // Calculate total product value for percentage fees
    let totalProductValue = new Decimal(0);
    for (const [_, variant] of Object.entries(variantData)) {
      const price = new Decimal(variant.price_per_unit);
      totalProductValue = totalProductValue.plus(price);
    }

    // First pass: calculate all non-percentage fees
    let nonPercentageFees = new Decimal(0);
    const percentageFees: typeof selectedFees = [];

    for (const fee of selectedFees) {
      if (fee.unit === 'percentage') {
        percentageFees.push(fee);
        continue;
      }

      const feeAmount = new Decimal(fee.amount);
      let totalFeeAmount: Decimal;
      let feeName = fee.description;

      switch (fee.unit) {
        case 'per_pallet':
          totalFeeAmount = feeAmount.times(pallets);
          break;

        case 'per_case':
          totalFeeAmount = feeAmount.times(pallets);
          break;

        case 'per_day_full':
        case 'per_day_half':
          const days = fee.quantity ? new Decimal(fee.quantity) : new Decimal(1);
          totalFeeAmount = feeAmount.times(days);
          if (days.greaterThan(1)) {
            feeName = `${feeName} (${days} days)`;
          }
          break;

        case 'per_shipment':
        case 'per_zone':
        case 'flat_fee':
          totalFeeAmount = feeAmount;
          break;

        default:
          totalFeeAmount = feeAmount;
      }

      nonPercentageFees = nonPercentageFees.plus(totalFeeAmount);
      totalFees = totalFees.plus(totalFeeAmount);
      feeBreakdown.push({
        feeId: fee.feeId,
        feeName,
        feeAmount: totalFeeAmount.toFixed(2),
      });
    }

    // Second pass: calculate percentage fees
    for (const fee of percentageFees) {
      const percentage = new Decimal(fee.quantity || fee.amount);
      let totalFeeAmount: Decimal;
      let feeName = fee.description;

      switch (fee.percentage_basis) {
        case 'product_value':
          // Calculate percentage of total product value
          totalFeeAmount = totalProductValue.times(percentage).dividedBy(100);
          feeName = `${feeName} (${percentage}% of product value)`;
          break;

        case 'distribution_cost':
          // Calculate percentage of distribution cost (non-percentage fees)
          totalFeeAmount = nonPercentageFees.times(percentage).dividedBy(100);
          feeName = `${feeName} (${percentage}% of distribution cost)`;
          break;

        case 'discount':
          // Calculate negative percentage of distribution cost
          totalFeeAmount = nonPercentageFees.times(percentage).dividedBy(100).negated();
          feeName = `${feeName} (${percentage}% discount)`;
          break;

        default:
          // Default to product value if not specified
          totalFeeAmount = totalProductValue.times(percentage).dividedBy(100);
          feeName = `${feeName} (${percentage}%)`;
      }

      totalFees = totalFees.plus(totalFeeAmount);
      feeBreakdown.push({
        feeId: fee.feeId,
        feeName,
        feeAmount: totalFeeAmount.toFixed(2),
      });
    }

    return { totalFees, feeBreakdown };
  }

  /**
   * Determine margin quality based on thresholds
   *
   * Default thresholds:
   * - Gut Check (Red): < 50%
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
  ): 'gutCheck' | 'good' | 'better' | 'best' {
    if (marginPercentage < thresholds.poor) return 'gutCheck';
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
