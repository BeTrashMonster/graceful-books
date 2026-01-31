/**
 * Sales Promo Analyzer Service
 *
 * Analyzes trade spend opportunities (retailer promotions) to help CPG businesses
 * make data-driven decisions about promo participation.
 *
 * Key features:
 * - Calculate sales promo cost per unit
 * - Calculate CPU with promo
 * - Compare margins (with promo vs. without promo)
 * - Calculate total promo cost across all variants
 * - Provide recommendations: participate/decline/neutral
 *
 * Requirements:
 * - CPG Module Roadmap Group B3
 * - Decimal.js for all financial calculations
 * - Support flexible variants (not hardcoded Small/Large)
 * - Side-by-side comparison (with vs. without promo)
 * - Clear recommendations with reasoning
 *
 * Formula:
 * Sales Promo Cost Per Unit = Retail Price × (Producer Payback % / 100)
 * CPU w/ Promo = Base CPU + Sales Promo Cost Per Unit
 * Profit Margin w/ Promo = ((Retail Price - CPU w/ Promo) / Retail Price) × 100
 * Total Promo Cost = Sales Promo Cost Per Unit × Units Available
 *
 * Recommendation Logic:
 * - Participate: Margin with promo >= 50% (still profitable)
 * - Decline: Margin with promo < 40% (too costly)
 * - Neutral: Margin 40-50% (borderline - user decides)
 */

import Decimal from 'decimal.js';
import { nanoid } from 'nanoid';
import type { TreasureChestDB } from '../../db/database';
import type {
  CPGSalesPromo,
} from '../../db/schema/cpg.schema';
import {
  createDefaultCPGSalesPromo,
  validateCPGSalesPromo,
  getProfitMarginQuality,
} from '../../db/schema/cpg.schema';

// ============================================================================
// Types
// ============================================================================

export interface DemoHoursEntry {
  id: string;
  description: string;
  hours: string;
  hourlyRate: string;
  costType: 'actual' | 'opportunity';
}

export interface CreatePromoParams {
  companyId: string;
  promoName: string;
  retailerName?: string;
  promoStartDate?: number;
  promoEndDate?: number;
  storeSalePercentage: string;
  producerPaybackPercentage: string;
  demoHoursEntries?: DemoHoursEntry[];
  notes?: string;
}

export interface PromoAnalysisParams {
  promoId: string;
  variantPromoData: Record<
    string,
    {
      retailPrice: string;
      unitsAvailable: string;
      baseCPU: string;
    }
  >;
}

export interface PromoAnalysisResult {
  promoId: string;
  promoName: string;
  retailerName: string | null;
  storeSalePercentage: string;
  producerPaybackPercentage: string;
  demoHoursEntries: DemoHoursEntry[];
  variantResults: Record<
    string,
    {
      salesPromoCostPerUnit: string;
      cpuWithPromo: string;
      actualLaborCostPerUnit: string | null;
      opportunityCostPerUnit: string | null;
      totalCostWithLabor: string | null;
      netProfitMarginWithPromo: string;
      netProfitMarginWithoutPromo: string;
      netProfitMarginWithLabor: string | null;
      marginQualityWithPromo: 'poor' | 'good' | 'better' | 'best';
      marginDifference: string;
    }
  >;
  totalPromoCost: string;
  totalActualLaborCost: string | null;
  totalOpportunityCost: string | null;
  recommendation: 'participate' | 'decline' | 'neutral';
  recommendationReason: string;
}

export interface PromoComparison {
  promoId: string;
  promoName: string;
  withPromo: {
    averageMargin: string;
    totalCost: string;
    lowestMargin: string;
    highestMargin: string;
  };
  withoutPromo: {
    averageMargin: string;
    totalCost: string;
    lowestMargin: string;
    highestMargin: string;
  };
  marginDifference: string;
  recommendation: 'participate' | 'decline' | 'neutral';
}

// ============================================================================
// Sales Promo Analyzer Service Class
// ============================================================================

export class SalesPromoAnalyzerService {
  private db: TreasureChestDB;

  constructor(db: TreasureChestDB) {
    this.db = db;
  }

  /**
   * Create a new sales promo
   *
   * @param params - Promo creation parameters
   * @param deviceId - Device ID for CRDT
   * @returns Created promo record
   */
  async createPromo(
    params: CreatePromoParams,
    deviceId: string
  ): Promise<CPGSalesPromo> {
    const id = nanoid();
    const defaultPromo = createDefaultCPGSalesPromo(
      params.companyId,
      params.promoName,
      deviceId
    );

    const promo: CPGSalesPromo = {
      ...defaultPromo,
      id,
      retailer_name: params.retailerName || null,
      promo_start_date: params.promoStartDate || null,
      promo_end_date: params.promoEndDate || null,
      store_sale_percentage: params.storeSalePercentage,
      producer_payback_percentage: params.producerPaybackPercentage,
      demo_hours_entries: params.demoHoursEntries && params.demoHoursEntries.length > 0
        ? params.demoHoursEntries.map(e => ({
            id: e.id,
            description: e.description,
            hours: e.hours,
            hourly_rate: e.hourlyRate,
            cost_type: e.costType,
          }))
        : null,
      notes: params.notes || null,
    } as CPGSalesPromo;

    // Validate
    const errors = validateCPGSalesPromo(promo);
    if (errors.length > 0) {
      throw new Error(`Sales promo validation failed: ${errors.join(', ')}`);
    }

    // Save to database
    await this.db.cpgSalesPromos.add(promo);

    return promo;
  }

  /**
   * Update an existing sales promo
   *
   * @param id - Promo ID
   * @param updates - Fields to update
   * @param deviceId - Device ID for CRDT
   * @returns Updated promo record
   */
  async updatePromo(
    id: string,
    updates: Partial<CPGSalesPromo>,
    deviceId: string
  ): Promise<CPGSalesPromo> {
    const existing = await this.db.cpgSalesPromos.get(id);
    if (!existing) {
      throw new Error(`Sales promo not found: ${id}`);
    }

    const now = Date.now();
    const updated: CPGSalesPromo = {
      ...existing,
      ...updates,
      updated_at: now,
      version_vector: {
        ...existing.version_vector,
        [deviceId]: (existing.version_vector[deviceId] || 0) + 1,
      },
    };

    // Validate
    const errors = validateCPGSalesPromo(updated);
    if (errors.length > 0) {
      throw new Error(`Sales promo validation failed: ${errors.join(', ')}`);
    }

    // Save to database
    await this.db.cpgSalesPromos.put(updated);

    return updated;
  }

  /**
   * Delete a sales promo (soft delete)
   *
   * @param id - Promo ID
   * @param deviceId - Device ID for CRDT
   */
  async deletePromo(id: string, deviceId: string): Promise<void> {
    const existing = await this.db.cpgSalesPromos.get(id);
    if (!existing) {
      throw new Error(`Sales promo not found: ${id}`);
    }

    const now = Date.now();
    const deleted: CPGSalesPromo = {
      ...existing,
      deleted_at: now,
      updated_at: now,
      active: false,
      version_vector: {
        ...existing.version_vector,
        [deviceId]: (existing.version_vector[deviceId] || 0) + 1,
      },
    };

    await this.db.cpgSalesPromos.put(deleted);
  }

  /**
   * Analyze a sales promo and calculate all metrics
   *
   * This is the core calculation engine. It:
   * 1. Calculates sales promo cost per unit for each variant
   * 2. Calculates CPU with promo
   * 3. Calculates profit margins (with promo vs. without promo)
   * 4. Calculates total promo cost across all variants
   * 5. Determines recommendation based on margin thresholds
   *
   * @param params - Analysis parameters
   * @param deviceId - Device ID for CRDT
   * @returns Analysis results with recommendation
   */
  async analyzePromo(
    params: PromoAnalysisParams,
    deviceId: string
  ): Promise<PromoAnalysisResult> {
    // Get promo record
    const promo = await this.db.cpgSalesPromos.get(params.promoId);
    if (!promo) {
      throw new Error(`Sales promo not found: ${params.promoId}`);
    }

    // Parse producer payback percentage
    const producerPaybackPct = new Decimal(promo.producer_payback_percentage).div(100);

    // Calculate labor costs per unit if demo entries are provided
    let actualLaborCostPerUnit = new Decimal(0);
    let opportunityCostPerUnit = new Decimal(0);
    let totalActualLaborCost = new Decimal(0);
    let totalOpportunityCost = new Decimal(0);

    if (promo.demo_hours_entries && promo.demo_hours_entries.length > 0) {
      // Calculate total costs for each type
      promo.demo_hours_entries.forEach((entry) => {
        const hours = new Decimal(entry.hours);
        const rate = new Decimal(entry.hourly_rate);
        const cost = hours.mul(rate);

        if (entry.cost_type === 'actual') {
          totalActualLaborCost = totalActualLaborCost.plus(cost);
        } else {
          totalOpportunityCost = totalOpportunityCost.plus(cost);
        }
      });

      // Calculate total units across all variants
      const totalUnits = Object.values(params.variantPromoData).reduce((sum, data) => {
        return sum.plus(new Decimal(data.unitsAvailable));
      }, new Decimal(0));

      // Distribute costs across all units
      if (totalUnits.greaterThan(0)) {
        if (totalActualLaborCost.greaterThan(0)) {
          actualLaborCostPerUnit = totalActualLaborCost.div(totalUnits);
        }
        if (totalOpportunityCost.greaterThan(0)) {
          opportunityCostPerUnit = totalOpportunityCost.div(totalUnits);
        }
      }
    }

    // Calculate results for each variant
    const variantResults: Record<
      string,
      {
        salesPromoCostPerUnit: string;
        cpuWithPromo: string;
        actualLaborCostPerUnit: string | null;
        opportunityCostPerUnit: string | null;
        totalCostWithLabor: string | null;
        netProfitMarginWithPromo: string;
        netProfitMarginWithoutPromo: string;
        netProfitMarginWithLabor: string | null;
        marginQualityWithPromo: 'poor' | 'good' | 'better' | 'best';
        marginDifference: string;
      }
    > = {};

    let totalPromoCost = new Decimal(0);
    const margins: Decimal[] = [];

    // Process each variant
    for (const [variantName, variantData] of Object.entries(params.variantPromoData)) {
      // Parse inputs
      const retailPrice = new Decimal(variantData.retailPrice);
      const unitsAvailable = new Decimal(variantData.unitsAvailable);
      const baseCPU = new Decimal(variantData.baseCPU);

      // Calculate sales promo cost per unit
      // Formula: Retail Price × (Producer Payback % / 100)
      const salesPromoCostPerUnit = retailPrice.mul(producerPaybackPct);

      // Calculate CPU with promo
      // Formula: Base CPU + Sales Promo Cost Per Unit
      const cpuWithPromo = baseCPU.plus(salesPromoCostPerUnit);

      // Calculate profit margin with promo
      // Formula: ((Retail Price - CPU w/ Promo) / Retail Price) × 100
      const netProfitMarginWithPromo = retailPrice.isZero()
        ? new Decimal(0)
        : retailPrice.minus(cpuWithPromo).div(retailPrice).mul(100);

      // Calculate profit margin without promo
      // Formula: ((Retail Price - Base CPU) / Retail Price) × 100
      const netProfitMarginWithoutPromo = retailPrice.isZero()
        ? new Decimal(0)
        : retailPrice.minus(baseCPU).div(retailPrice).mul(100);

      // Calculate margin difference
      const marginDifference = netProfitMarginWithPromo.minus(netProfitMarginWithoutPromo);

      // Calculate total cost with labor (if applicable)
      let totalCostWithLabor: Decimal | null = null;
      let netProfitMarginWithLabor: Decimal | null = null;
      const totalLaborCostPerUnit = actualLaborCostPerUnit.plus(opportunityCostPerUnit);

      if (totalLaborCostPerUnit.greaterThan(0)) {
        totalCostWithLabor = cpuWithPromo.plus(totalLaborCostPerUnit);
        // Calculate profit margin with labor
        // Formula: ((Retail Price - Total Cost with Labor) / Retail Price) × 100
        netProfitMarginWithLabor = retailPrice.isZero()
          ? new Decimal(0)
          : retailPrice.minus(totalCostWithLabor).div(retailPrice).mul(100);
      }

      // Determine margin quality
      const marginQualityWithPromo = getProfitMarginQuality(
        netProfitMarginWithPromo.toFixed(2)
      );

      // Calculate total promo cost for this variant
      const variantPromoCost = salesPromoCostPerUnit.mul(unitsAvailable);
      totalPromoCost = totalPromoCost.plus(variantPromoCost);

      // Store results
      variantResults[variantName] = {
        salesPromoCostPerUnit: salesPromoCostPerUnit.toFixed(2),
        cpuWithPromo: cpuWithPromo.toFixed(2),
        actualLaborCostPerUnit: actualLaborCostPerUnit.greaterThan(0) ? actualLaborCostPerUnit.toFixed(2) : null,
        opportunityCostPerUnit: opportunityCostPerUnit.greaterThan(0) ? opportunityCostPerUnit.toFixed(2) : null,
        totalCostWithLabor: totalCostWithLabor ? totalCostWithLabor.toFixed(2) : null,
        netProfitMarginWithPromo: netProfitMarginWithPromo.toFixed(2),
        netProfitMarginWithoutPromo: netProfitMarginWithoutPromo.toFixed(2),
        netProfitMarginWithLabor: netProfitMarginWithLabor ? netProfitMarginWithLabor.toFixed(2) : null,
        marginQualityWithPromo,
        marginDifference: marginDifference.toFixed(2),
      };

      // Track margins for recommendation logic (use margins with labor if available)
      if (netProfitMarginWithLabor !== null) {
        margins.push(netProfitMarginWithLabor);
      } else {
        margins.push(netProfitMarginWithPromo);
      }
    }

    // Determine recommendation based on margins
    const { recommendation, reason } = this.determineRecommendation(margins);

    // Update promo record with results
    await this.updatePromo(
      params.promoId,
      {
        variant_promo_data: this.convertToSchemaFormat(params.variantPromoData),
        variant_promo_results: this.convertResultsToSchemaFormat(variantResults),
        total_promo_cost: totalPromoCost.toFixed(2),
        total_actual_labor_cost: totalActualLaborCost.greaterThan(0) ? totalActualLaborCost.toFixed(2) : null,
        total_opportunity_cost: totalOpportunityCost.greaterThan(0) ? totalOpportunityCost.toFixed(2) : null,
        recommendation,
      },
      deviceId
    );

    return {
      promoId: promo.id,
      promoName: promo.promo_name,
      retailerName: promo.retailer_name,
      storeSalePercentage: promo.store_sale_percentage,
      producerPaybackPercentage: promo.producer_payback_percentage,
      demoHoursEntries: promo.demo_hours_entries || [],
      variantResults,
      totalPromoCost: totalPromoCost.toFixed(2),
      totalActualLaborCost: totalActualLaborCost.greaterThan(0) ? totalActualLaborCost.toFixed(2) : null,
      totalOpportunityCost: totalOpportunityCost.greaterThan(0) ? totalOpportunityCost.toFixed(2) : null,
      recommendation,
      recommendationReason: reason,
    };
  }

  /**
   * Compare promo scenario (with promo vs. without promo)
   *
   * @param promoId - Promo ID to compare
   * @returns Side-by-side comparison
   */
  async comparePromoVsNoPromo(promoId: string): Promise<PromoComparison> {
    const promo = await this.db.cpgSalesPromos.get(promoId);
    if (!promo) {
      throw new Error(`Sales promo not found: ${promoId}`);
    }

    if (!promo.variant_promo_results || Object.keys(promo.variant_promo_results).length === 0) {
      throw new Error('Promo must be analyzed before comparison');
    }

    // Calculate with promo metrics
    const withPromoMargins: Decimal[] = [];
    const withoutPromoMargins: Decimal[] = [];
    let withPromoTotalCost = new Decimal(0);
    let withoutPromoTotalCost = new Decimal(0);

    for (const [variantName, results] of Object.entries(promo.variant_promo_results)) {
      const withMargin = new Decimal(results.net_profit_margin_with_promo);
      const withoutMargin = new Decimal(results.net_profit_margin_without_promo);
      const cpuWithPromo = new Decimal(results.cpu_with_promo);

      withPromoMargins.push(withMargin);
      withoutPromoMargins.push(withoutMargin);

      // Get variant data to calculate costs
      const variantData = promo.variant_promo_data[variantName];
      if (variantData) {
        const unitsAvailable = new Decimal(variantData.units_available);
        const baseCPU = new Decimal(variantData.base_cpu);

        withPromoTotalCost = withPromoTotalCost.plus(cpuWithPromo.mul(unitsAvailable));
        withoutPromoTotalCost = withoutPromoTotalCost.plus(baseCPU.mul(unitsAvailable));
      }
    }

    // Calculate averages
    const withPromoAvg = this.calculateAverage(withPromoMargins);
    const withoutPromoAvg = this.calculateAverage(withoutPromoMargins);

    // Find min/max margins
    const withPromoMin = Decimal.min(...withPromoMargins);
    const withPromoMax = Decimal.max(...withPromoMargins);
    const withoutPromoMin = Decimal.min(...withoutPromoMargins);
    const withoutPromoMax = Decimal.max(...withoutPromoMargins);

    // Calculate margin difference
    const marginDifference = withPromoAvg.minus(withoutPromoAvg);

    return {
      promoId: promo.id,
      promoName: promo.promo_name,
      withPromo: {
        averageMargin: withPromoAvg.toFixed(2),
        totalCost: withPromoTotalCost.toFixed(2),
        lowestMargin: withPromoMin.toFixed(2),
        highestMargin: withPromoMax.toFixed(2),
      },
      withoutPromo: {
        averageMargin: withoutPromoAvg.toFixed(2),
        totalCost: withoutPromoTotalCost.toFixed(2),
        lowestMargin: withoutPromoMin.toFixed(2),
        highestMargin: withoutPromoMax.toFixed(2),
      },
      marginDifference: marginDifference.toFixed(2),
      recommendation: promo.recommendation || 'neutral',
    };
  }

  /**
   * Get recommendation for a promo (without re-analyzing)
   *
   * @param promoId - Promo ID
   * @returns Recommendation
   */
  async getRecommendation(promoId: string): Promise<'participate' | 'decline' | 'neutral'> {
    const promo = await this.db.cpgSalesPromos.get(promoId);
    if (!promo) {
      throw new Error(`Sales promo not found: ${promoId}`);
    }

    if (!promo.recommendation) {
      throw new Error('Promo must be analyzed before getting recommendation');
    }

    return promo.recommendation;
  }

  /**
   * Get all promos for a company
   *
   * @param companyId - Company ID
   * @param activeOnly - Only return active promos
   * @returns List of promos
   */
  async getPromosByCompany(
    companyId: string,
    activeOnly: boolean = true
  ): Promise<CPGSalesPromo[]> {
    const promos = await this.db.cpgSalesPromos
      .where('company_id')
      .equals(companyId)
      .toArray();

    return promos.filter((p) => !activeOnly || (p.active && !p.deleted_at));
  }

  /**
   * Get a single promo by ID
   *
   * @param promoId - Promo ID
   * @returns Promo record
   */
  async getPromoById(promoId: string): Promise<CPGSalesPromo | undefined> {
    return await this.db.cpgSalesPromos.get(promoId);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Determine recommendation based on margin thresholds
   *
   * Logic:
   * - Participate: ALL margins >= 50% (still profitable)
   * - Decline: ANY margin < 40% (too costly)
   * - Neutral: Margins between 40-50% (borderline - user decides)
   */
  private determineRecommendation(
    margins: Decimal[]
  ): { recommendation: 'participate' | 'decline' | 'neutral'; reason: string } {
    if (margins.length === 0) {
      return {
        recommendation: 'neutral',
        reason: 'No variant data available for analysis',
      };
    }

    const lowestMargin = Decimal.min(...margins);
    const highestMargin = Decimal.max(...margins);
    const averageMargin = this.calculateAverage(margins);

    // Decline if any margin is below 40%
    if (lowestMargin.lessThan(40)) {
      return {
        recommendation: 'decline',
        reason: `Lowest margin is ${lowestMargin.toFixed(2)}%, which is below the 40% threshold. This promo would hurt your profitability.`,
      };
    }

    // Participate if all margins are >= 50%
    if (lowestMargin.greaterThanOrEqualTo(50)) {
      return {
        recommendation: 'participate',
        reason: `All margins are above 50% (lowest: ${lowestMargin.toFixed(2)}%, average: ${averageMargin.toFixed(2)}%). This promo maintains healthy profitability.`,
      };
    }

    // Neutral for margins between 40-50%
    return {
      recommendation: 'neutral',
      reason: `Margins are borderline (${lowestMargin.toFixed(2)}% to ${highestMargin.toFixed(2)}%, average: ${averageMargin.toFixed(2)}%). Review carefully to decide if this promo aligns with your business goals.`,
    };
  }

  /**
   * Calculate average of an array of Decimals
   */
  private calculateAverage(values: Decimal[]): Decimal {
    if (values.length === 0) return new Decimal(0);
    const sum = values.reduce((acc, val) => acc.plus(val), new Decimal(0));
    return sum.div(values.length);
  }

  /**
   * Convert promo data to schema format
   */
  private convertToSchemaFormat(
    data: Record<string, { retailPrice: string; unitsAvailable: string; baseCPU: string }>
  ): Record<string, { retail_price: string; units_available: string; base_cpu: string }> {
    const result: Record<
      string,
      { retail_price: string; units_available: string; base_cpu: string }
    > = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = {
        retail_price: value.retailPrice,
        units_available: value.unitsAvailable,
        base_cpu: value.baseCPU,
      };
    }
    return result;
  }

  /**
   * Convert results to schema format
   */
  private convertResultsToSchemaFormat(
    results: Record<
      string,
      {
        salesPromoCostPerUnit: string;
        cpuWithPromo: string;
        actualLaborCostPerUnit: string | null;
        opportunityCostPerUnit: string | null;
        totalCostWithLabor: string | null;
        netProfitMarginWithPromo: string;
        netProfitMarginWithoutPromo: string;
        netProfitMarginWithLabor: string | null;
        marginQualityWithPromo: 'poor' | 'good' | 'better' | 'best';
        marginDifference: string;
      }
    >
  ): Record<
    string,
    {
      sales_promo_cost_per_unit: string;
      cpu_with_promo: string;
      demo_hours_cost_per_unit: string | null;
      total_cost_with_demo: string | null;
      net_profit_margin_with_promo: string;
      net_profit_margin_without_promo: string;
      net_profit_margin_with_demo: string | null;
      margin_quality_with_promo: 'poor' | 'good' | 'better' | 'best';
    }
  > {
    const result: Record<
      string,
      {
        sales_promo_cost_per_unit: string;
        cpu_with_promo: string;
        demo_hours_cost_per_unit: string | null;
        total_cost_with_demo: string | null;
        net_profit_margin_with_promo: string;
        net_profit_margin_without_promo: string;
        net_profit_margin_with_demo: string | null;
        margin_quality_with_promo: 'poor' | 'good' | 'better' | 'best';
      }
    > = {};
    for (const [key, value] of Object.entries(results)) {
      // Combine both cost types for backward compatibility
      const totalLaborCost = (value.actualLaborCostPerUnit && value.opportunityCostPerUnit)
        ? (parseFloat(value.actualLaborCostPerUnit) + parseFloat(value.opportunityCostPerUnit)).toFixed(2)
        : (value.actualLaborCostPerUnit || value.opportunityCostPerUnit);

      result[key] = {
        sales_promo_cost_per_unit: value.salesPromoCostPerUnit,
        cpu_with_promo: value.cpuWithPromo,
        demo_hours_cost_per_unit: totalLaborCost,
        total_cost_with_demo: value.totalCostWithLabor,
        net_profit_margin_with_promo: value.netProfitMarginWithPromo,
        net_profit_margin_without_promo: value.netProfitMarginWithoutPromo,
        net_profit_margin_with_demo: value.netProfitMarginWithLabor,
        margin_quality_with_promo: value.marginQualityWithPromo,
      };
    }
    return result;
  }
}
