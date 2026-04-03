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
import {
  validateDistributionCalcParams,
  detectSuspiciousCalculation,
  formatValidationError,
} from '../../utils/validation';
import { logger } from '../../utils/logger';

const serviceLogger = logger.child('DistributionCostCalculatorService');

/**
 * Distribution calculation input parameters
 */
export interface DistributionCalcParams {
  distributorId: string;
  numPallets: string; // Decimal as string for precision
  unitsPerPallet: string; // DEPRECATED: Use pallet_data instead

  // Actual pallet structure - stores exact configuration of each pallet
  pallet_data: Array<{
    pallet_number: number;
    units_per_pallet: number;
    products: Array<{
      product_name: string;
      quantity: number;
      price_per_unit: string;
      base_cpu: string; // Material cost per unit
      production_cpu?: string; // Production labor cost per unit
    }>;
  }>;

  // Variant-specific pricing and costs
  // Example: { "8oz": { price_per_unit: "3.38", base_cpu: "2.15", production_cpu: "0.50", quantity: 100 }, "16oz": { ... } }
  // NOTE: This is aggregated data - use pallet_data for accurate per-pallet breakdown
  variantData: Record<
    string,
    {
      price_per_unit: string;
      base_cpu: string; // Material cost from CPG Invoice calculations
      production_cpu?: string; // Production labor cost per unit
      quantity: number; // Total quantity of this product across all pallets
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
    // S6-4: Validate parameters with Zod schema
    const validation = validateDistributionCalcParams(params);
    if (!validation.success) {
      const errorMessage = formatValidationError(validation.error);
      serviceLogger.error('Distribution calculation validation failed', {
        errors: errorMessage,
        params,
      });
      throw new Error(`Validation failed: ${errorMessage}`);
    }

    // Legacy validation for backwards compatibility
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
    // Use pallet_data for accurate total units (handles different units per pallet)
    let totalUnits = new Decimal(0);

    if (params.pallet_data && params.pallet_data.length > 0) {
      // Calculate from actual pallet data
      console.log('Calculating total units from pallet_data:');
      params.pallet_data.forEach(pallet => {
        let palletUnits = 0;
        pallet.products.forEach(product => {
          palletUnits += product.quantity;
          totalUnits = totalUnits.plus(new Decimal(product.quantity));
        });
        console.log(`  Pallet ${pallet.pallet_number}: ${palletUnits} units`);
      });
      console.log(`Total units (from pallet_data): ${totalUnits.toFixed(0)}`);
    } else {
      // Fallback to old calculation for backwards compatibility
      const numPallets = new Decimal(params.numPallets);
      const unitsPerPallet = new Decimal(params.unitsPerPallet);
      totalUnits = numPallets.times(unitsPerPallet);
      console.log(`Total units (fallback): ${params.numPallets} pallets × ${params.unitsPerPallet} units = ${totalUnits.toFixed(0)}`);
    }

    let distributionCostPerUnit = new Decimal(0);
    if (totalUnits.greaterThan(0)) {
      distributionCostPerUnit = totalFees.dividedBy(totalUnits);
      console.log(`Distribution cost per unit: $${totalFees.toFixed(6)} ÷ ${totalUnits.toFixed(0)} units = $${distributionCostPerUnit.toFixed(6)}/unit`);
    }

    // Calculate results per variant
    const variantResults: DistributionCostResult['variantResults'] = {};

    for (const [variantName, variantData] of Object.entries(params.variantData)) {
      const baseCPU = new Decimal(variantData.base_cpu); // Material cost
      const productionCPU = variantData.production_cpu ? new Decimal(variantData.production_cpu) : new Decimal(0); // Production labor cost
      const pricePerUnit = new Decimal(variantData.price_per_unit);

      // Total CPU = Base CPU (materials) + Production CPU (labor) + Distribution cost per unit
      const totalCPU = baseCPU.plus(productionCPU).plus(distributionCostPerUnit);

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
          .toFixed(6);
      }

      variantResults[variantName] = {
        total_cpu: totalCPU.toFixed(6),
        net_profit_margin: netProfitMargin.toFixed(6),
        margin_quality: marginQuality,
        msrp,
      };
    }

    // S6-4: Check for suspicious calculation patterns
    for (const [variantName, variantData] of Object.entries(params.variantData)) {
      const result = variantResults[variantName];
      const suspicious = detectSuspiciousCalculation({
        type: 'distribution',
        values: {
          numPallets: parseFloat(params.numPallets),
          unitsPerPallet: parseFloat(params.unitsPerPallet),
          totalCPU: parseFloat(result.total_cpu),
          price: parseFloat(variantData.price_per_unit),
          baseCPU: parseFloat(variantData.base_cpu),
          distributionCost: totalFees.toNumber(),
        },
      });

      if (suspicious.suspicious) {
        serviceLogger.warn('Suspicious distribution calculation detected', {
          distributorId: params.distributorId,
          variantName,
          reasons: suspicious.reasons,
          params: {
            numPallets: params.numPallets,
            totalFees: totalFees.toFixed(6),
            pricePerUnit: variantData.price_per_unit,
            baseCPU: variantData.base_cpu,
            totalCPU: result.total_cpu,
          },
        });
      }
    }

    return {
      distributorId: params.distributorId,
      totalDistributionCost: totalFees.toFixed(6),
      distributionCostPerUnit: distributionCostPerUnit.toFixed(6),
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
    notes: string | null = null,
    calculationTimestamp: number | null = null,
    invoiceData?: {
      invoice_number: string;
      invoice_total_amount: string;
      invoice_due_date: number | null;
      payment_status: 'unpaid' | 'partially_paid' | 'paid';
      amount_paid: string | null;
      payment_date: number | null;
      payment_method: string | null;
      payment_account_id: string | null;
      check_number: string | null;
    },
    isDraft: boolean = false
  ): Promise<CPGDistributionCalculation> {
    const now = Date.now();
    const calcDate = calculationTimestamp || now;

    // Generate per-pallet product breakdown for reporting
    const palletBreakdown = this.generatePalletBreakdown(
      params.numPallets,
      params.unitsPerPallet,
      params.variantData
    );

    console.log('Saving calculation with pallet_data:', params.pallet_data);

    const calculation: CPGDistributionCalculation = {
      id: nanoid(),
      company_id: companyId,
      distributor_id: params.distributorId,
      calculation_name: calculationName,
      calculation_date: calcDate,
      num_pallets: params.numPallets,
      units_per_pallet: params.unitsPerPallet,
      pallet_data: params.pallet_data || [], // Store actual pallet structure
      variant_data: params.variantData,
      selected_fees: params.selectedFees,
      fee_breakdown: result.feeBreakdown,
      total_distribution_cost: result.totalDistributionCost,
      distribution_cost_per_unit: result.distributionCostPerUnit,
      variant_results: result.variantResults,
      msrp_markup_percentage: params.msrpMarkupPercentage || null,
      pallet_breakdown: palletBreakdown,
      notes,
      is_draft: isDraft,
      // Invoice & payment data
      invoice_number: invoiceData?.invoice_number || null,
      invoice_total_amount: invoiceData?.invoice_total_amount || null,
      invoice_due_date: invoiceData?.invoice_due_date || null,
      payment_status: invoiceData?.payment_status || null,
      amount_paid: invoiceData?.amount_paid || null,
      payment_date: invoiceData?.payment_date || null,
      payment_method: invoiceData?.payment_method || null,
      payment_account_id: invoiceData?.payment_account_id || null,
      check_number: invoiceData?.check_number || null,
      linked_journal_entry_id: null, // Will be set when we create the GL entry
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    await this.db.cpgDistributionCalculations.add(calculation);

    // Create journal entry if this is an invoice (not a draft)
    if (!isDraft && invoiceData) {
      try {
        const journalEntryId = await this.createJournalEntryForInvoice(
          calculation,
          companyId,
          deviceId
        );

        // Update calculation with linked journal entry ID
        if (journalEntryId) {
          await this.db.cpgDistributionCalculations.update(calculation.id, {
            linked_journal_entry_id: journalEntryId,
            updated_at: Date.now(),
          });
          calculation.linked_journal_entry_id = journalEntryId;
        }
      } catch (journalError) {
        console.warn('Failed to create journal entry, but calculation was saved:', journalError);
        // Don't fail the whole save if journal entry fails
      }
    }

    return calculation;
  }

  /**
   * Update existing distribution calculation
   */
  async updateCalculation(
    calculationId: string,
    result: DistributionCostResult,
    params: DistributionCalcParams,
    companyId: string,
    calculationName: string | null,
    deviceId: string,
    notes: string | null = null,
    calculationTimestamp: number | null = null,
    invoiceData?: {
      invoice_number: string;
      invoice_total_amount: string;
      invoice_due_date: number | null;
      payment_status: 'unpaid' | 'partially_paid' | 'paid';
      amount_paid: string | null;
      payment_date: number | null;
      payment_method: string | null;
      payment_account_id: string | null;
      check_number: string | null;
    },
    isDraft: boolean = false
  ): Promise<CPGDistributionCalculation> {
    const now = Date.now();
    const calcDate = calculationTimestamp || now;

    // Get existing calculation
    const existing = await this.db.cpgDistributionCalculations.get(calculationId);
    if (!existing) {
      throw new Error(`Calculation not found: ${calculationId}`);
    }

    // Generate per-pallet product breakdown for reporting
    const palletBreakdown = this.generatePalletBreakdown(
      params.numPallets,
      params.unitsPerPallet,
      params.variantData
    );

    // Increment version vector
    const currentVersion = existing.version_vector[deviceId] || 0;

    // Update the calculation
    await this.db.cpgDistributionCalculations.update(calculationId, {
      distributor_id: params.distributorId,
      calculation_name: calculationName,
      calculation_date: calcDate,
      num_pallets: params.numPallets,
      units_per_pallet: params.unitsPerPallet,
      pallet_data: params.pallet_data, // Store actual pallet structure
      variant_data: params.variantData,
      selected_fees: params.selectedFees,
      fee_breakdown: result.feeBreakdown,
      total_distribution_cost: result.totalDistributionCost,
      distribution_cost_per_unit: result.distributionCostPerUnit,
      variant_results: result.variantResults,
      msrp_markup_percentage: params.msrpMarkupPercentage || null,
      pallet_breakdown: palletBreakdown,
      notes,
      is_draft: isDraft,
      // Invoice & payment data
      invoice_number: invoiceData?.invoice_number || null,
      invoice_total_amount: invoiceData?.invoice_total_amount || null,
      invoice_due_date: invoiceData?.invoice_due_date || null,
      payment_status: invoiceData?.payment_status || null,
      amount_paid: invoiceData?.amount_paid || null,
      payment_date: invoiceData?.payment_date || null,
      payment_method: invoiceData?.payment_method || null,
      payment_account_id: invoiceData?.payment_account_id || null,
      check_number: invoiceData?.check_number || null,
      updated_at: now,
      version_vector: {
        ...existing.version_vector,
        [deviceId]: currentVersion + 1,
      },
    });

    // Get updated record
    const updated = await this.db.cpgDistributionCalculations.get(calculationId);
    if (!updated) {
      throw new Error('Failed to retrieve updated calculation');
    }

    // Create journal entry if this is an invoice (not a draft) and doesn't have one yet
    if (!isDraft && invoiceData && !updated.linked_journal_entry_id) {
      try {
        const journalEntryId = await this.createJournalEntryForInvoice(
          updated,
          companyId,
          deviceId
        );

        // Update calculation with linked journal entry ID
        if (journalEntryId) {
          await this.db.cpgDistributionCalculations.update(calculationId, {
            linked_journal_entry_id: journalEntryId,
            updated_at: Date.now(),
          });
          updated.linked_journal_entry_id = journalEntryId;
        }
      } catch (journalError) {
        console.warn('Failed to create journal entry, but calculation was saved:', journalError);
        // Don't fail the whole save if journal entry fails
      }
    }

    return updated;
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

    // Calculate total product value for percentage fees (weighted by unit count)
    let totalProductValue = new Decimal(0);
    for (const [productName, variant] of Object.entries(variantData)) {
      const price = new Decimal(variant.price_per_unit);
      const quantity = new Decimal(variant.quantity || 0);
      const productValue = price.times(quantity);
      console.log(`Product "${productName}": ${quantity} units × $${price} = $${productValue.toFixed(2)} total value`);
      totalProductValue = totalProductValue.plus(productValue);
    }
    console.log(`Total product value (unit-weighted): $${totalProductValue.toFixed(2)}`);

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
        feeAmount: totalFeeAmount.toFixed(6),
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
        feeAmount: totalFeeAmount.toFixed(6),
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
   * Generate per-pallet product breakdown for reporting
   * Distributes units evenly across products, handling remainders
   *
   * @param numPallets - Number of pallets
   * @param unitsPerPallet - Units per pallet
   * @param variantData - Variant data with product names
   * @returns Array of pallet breakdown
   */
  private generatePalletBreakdown(
    numPallets: string,
    unitsPerPallet: string,
    variantData: DistributionCalcParams['variantData']
  ): Array<{ pallet_number: number; products: Record<string, number> }> {
    const pallets = parseInt(numPallets, 10);
    const unitsPerPalletNum = parseInt(unitsPerPallet, 10);
    const productNames = Object.keys(variantData);
    const numProducts = productNames.length;

    if (numProducts === 0 || pallets === 0 || unitsPerPalletNum === 0) {
      return [];
    }

    const breakdown: Array<{ pallet_number: number; products: Record<string, number> }> = [];

    // Calculate base units per product and remainder
    const baseUnitsPerProduct = Math.floor(unitsPerPalletNum / numProducts);
    const remainder = unitsPerPalletNum % numProducts;

    // For each pallet, distribute units across products
    for (let palletNum = 1; palletNum <= pallets; palletNum++) {
      const palletProducts: Record<string, number> = {};

      productNames.forEach((productName, index) => {
        // First 'remainder' products get one extra unit
        const units = baseUnitsPerProduct + (index < remainder ? 1 : 0);
        palletProducts[productName] = units;
      });

      breakdown.push({
        pallet_number: palletNum,
        products: palletProducts,
      });
    }

    return breakdown;
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

  /**
   * Create journal entry for distribution invoice
   *
   * Creates accounting entries when saving as invoice:
   * 1. Debit COGS - Distribution Costs
   * 2. Credit Accounts Payable
   * 3. If paid/partially paid, also create payment transaction
   *
   * SECURITY: Accepts companyId parameter and ensures all accounts belong to company
   *
   * @param calculation - The saved distribution calculation
   * @param companyId - Company ID
   * @param deviceId - Device ID for version vector
   * @returns Transaction ID of created journal entry
   */
  async createJournalEntryForInvoice(
    calculation: CPGDistributionCalculation,
    companyId: string,
    deviceId: string
  ): Promise<string | null> {
    // Only create journal entry if this is an invoice (not a draft)
    if (calculation.is_draft) {
      return null;
    }

    try {
      // SECURITY: Both helper methods filter by companyId
      // Find or create Distribution Costs account
      const distributionCostsAccount = await this.findOrCreateDistributionCostsAccount(companyId, deviceId);

      // Find Accounts Payable account
      const accountsPayableAccount = await this.findAccountsPayableAccount(companyId);

      if (!distributionCostsAccount || !accountsPayableAccount) {
        console.error('Could not find required accounts for journal entry');
        return null;
      }

      const amount = calculation.invoice_total_amount || calculation.total_distribution_cost;

      // Generate transaction number
      const year = new Date(calculation.calculation_date).getFullYear();
      const sequence = await this.getNextTransactionSequence(companyId, year, 'JOURNAL_ENTRY');
      const transactionNumber = `JE-${year}-${sequence.toString().padStart(4, '0')}`;

      const now = Date.now();
      const transactionId = nanoid();

      // Create journal entry transaction
      const journalEntry = {
        id: transactionId,
        company_id: companyId,
        transaction_number: transactionNumber,
        transaction_date: calculation.calculation_date,
        type: 'JOURNAL_ENTRY' as const,
        status: 'POSTED' as const,
        description: `Distribution costs - ${calculation.calculation_name || 'Invoice'}`,
        reference: calculation.invoice_number || null,
        memo: `Distributor invoice for ${calculation.num_pallets} pallets`,
        attachments: [],
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version_vector: { [deviceId]: 1 },
      };

      // Create line items
      const lineItems = [
        {
          id: nanoid(),
          transaction_id: transactionId,
          account_id: distributionCostsAccount.id,
          debit: amount,
          credit: '0.00',
          description: 'Distribution costs',
          contact_id: null,
          product_id: null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          version_vector: { [deviceId]: 1 },
        },
        {
          id: nanoid(),
          transaction_id: transactionId,
          account_id: accountsPayableAccount.id,
          debit: '0.00',
          credit: amount,
          description: 'Accounts payable - Distributor',
          contact_id: null,
          product_id: null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          version_vector: { [deviceId]: 1 },
        },
      ];

      // Save to database
      await this.db.transactions.add(journalEntry);
      await this.db.transactionLineItems.bulkAdd(lineItems);

      // If paid or partially paid, create payment transaction
      if (calculation.payment_status === 'paid' || calculation.payment_status === 'partially_paid') {
        await this.createPaymentTransaction(
          calculation,
          companyId,
          deviceId,
          accountsPayableAccount.id
        );
      }

      return transactionId;
    } catch (error) {
      console.error('Error creating journal entry for distribution invoice:', error);
      return null;
    }
  }

  /**
   * Create payment transaction when invoice is paid
   */
  private async createPaymentTransaction(
    calculation: CPGDistributionCalculation,
    companyId: string,
    deviceId: string,
    accountsPayableId: string
  ): Promise<void> {
    if (!calculation.amount_paid || !calculation.payment_account_id) {
      return;
    }

    const year = new Date(calculation.payment_date || calculation.calculation_date).getFullYear();
    const sequence = await this.getNextTransactionSequence(companyId, year, 'PAYMENT');
    const transactionNumber = `PMT-${year}-${sequence.toString().padStart(4, '0')}`;

    const now = Date.now();
    const transactionId = nanoid();

    const paymentTransaction = {
      id: transactionId,
      company_id: companyId,
      transaction_number: transactionNumber,
      transaction_date: calculation.payment_date || calculation.calculation_date,
      type: 'PAYMENT' as const,
      status: 'POSTED' as const,
      description: `Payment for distribution invoice${calculation.check_number ? ` - Check #${calculation.check_number}` : ''}`,
      reference: calculation.invoice_number || null,
      memo: calculation.check_number ? `Check #${calculation.check_number}` : null,
      attachments: [],
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    const lineItems = [
      {
        id: nanoid(),
        transaction_id: transactionId,
        account_id: accountsPayableId,
        debit: calculation.amount_paid,
        credit: '0.00',
        description: 'Payment to distributor',
        contact_id: null,
        product_id: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version_vector: { [deviceId]: 1 },
      },
      {
        id: nanoid(),
        transaction_id: transactionId,
        account_id: calculation.payment_account_id,
        debit: '0.00',
        credit: calculation.amount_paid,
        description: 'Payment from account',
        contact_id: null,
        product_id: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version_vector: { [deviceId]: 1 },
      },
    ];

    await this.db.transactions.add(paymentTransaction);
    await this.db.transactionLineItems.bulkAdd(lineItems);
  }

  /**
   * Find or create COGS - Distribution Costs account
   *
   * SECURITY: Filters by companyId to ensure account belongs to company
   */
  private async findOrCreateDistributionCostsAccount(
    companyId: string,
    deviceId: string
  ) {
    // SECURITY: Use compound index to filter by companyId first
    // Try to find existing Distribution Costs account
    const existing = await this.db.accounts
      .where('[company_id+type]')
      .equals([companyId, 'COGS'])
      .and((acc) => acc.active && !acc.deleted_at && acc.name.toLowerCase().includes('distribution'))
      .first();

    if (existing) {
      return existing;
    }

    // Create standalone COGS - Distribution Costs account (NOT a sub-account)
    const now = Date.now();
    const newAccount = {
      id: nanoid(),
      company_id: companyId,
      account_number: '5100',
      name: 'COGS - Distribution Costs',
      type: 'COGS' as const,
      subType: null,
      parent_id: null, // Standalone account, not a sub-account
      description: 'Costs associated with product distribution',
      balance: '0.00',
      active: true,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version_vector: { [deviceId]: 1 },
    };

    await this.db.accounts.add(newAccount);
    return newAccount;
  }

  /**
   * Find Accounts Payable account
   *
   * SECURITY: Filters by companyId to ensure account belongs to company
   */
  private async findAccountsPayableAccount(companyId: string) {
    // SECURITY: Use compound index to filter by companyId first
    return await this.db.accounts
      .where('[company_id+type]')
      .equals([companyId, 'LIABILITY'])
      .and((acc) =>
        acc.active &&
        !acc.deleted_at &&
        (acc.name.toLowerCase().includes('accounts payable') || acc.account_number === '2000')
      )
      .first();
  }

  /**
   * Get next transaction sequence number
   */
  private async getNextTransactionSequence(
    companyId: string,
    year: number,
    type: 'JOURNAL_ENTRY' | 'PAYMENT'
  ): Promise<number> {
    const startOfYear = new Date(year, 0, 1).getTime();
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999).getTime();

    const count = await this.db.transactions
      .where('[company_id+type]')
      .equals([companyId, type])
      .and((t) => t.transaction_date >= startOfYear && t.transaction_date <= endOfYear)
      .count();

    return count + 1;
  }
}
