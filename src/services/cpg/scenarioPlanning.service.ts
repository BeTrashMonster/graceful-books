/**
 * Scenario Planning Service
 *
 * Provides advanced analytics for CPG businesses including:
 * - Side-by-side distributor comparison
 * - "What-if" pricing calculator
 * - Break-even analysis for new SKUs
 * - SKU rationalization recommendations
 *
 * Requirements:
 * - Group E1: Scenario Planning
 * - Compare 2-4 distributors simultaneously
 * - Interactive what-if calculator with instant margin impact
 * - Break-even calculator: Fixed Costs / (Price - Variable Cost)
 * - SKU rationalization: Flag SKUs with margins <40% for review
 *
 * Formulas:
 * Break-even Units = Fixed Costs / (Price - Variable Cost)
 * Margin Impact = ((New Price - Total CPU) / New Price) × 100
 * Rationalization Score = Based on margin quality and volume
 *
 * Business Logic:
 * - Uses DistributionCostCalculatorService for calculations
 * - Compares total CPU, net margins, and MSRP across distributors
 * - Recommends SKUs for discontinuation based on <40% margin threshold
 */

import Decimal from 'decimal.js';
import type { TreasureChestDB } from '../../db/database';
import {
  DistributionCostCalculatorService,
  type DistributionCalcParams,
} from './distributionCostCalculator.service';

// Configure Decimal.js for currency precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Distributor comparison parameters
 */
export interface DistributorComparisonParams {
  companyId: string;
  distributorIds: string[]; // 2-4 distributor IDs to compare
  numPallets: string;
  unitsPerPallet: string;
  variantData: Record<
    string,
    {
      price_per_unit: string;
      base_cpu: string;
    }
  >;
  // Common fees applied to all distributors for fair comparison
  appliedFees: DistributionCalcParams['appliedFees'];
}

/**
 * Comparison result for a single distributor
 */
export interface DistributorComparisonResult {
  distributorId: string;
  distributorName: string;
  totalDistributionCost: string;
  distributionCostPerUnit: string;
  variantResults: Record<
    string,
    {
      total_cpu: string;
      net_profit_margin: string;
      margin_quality: 'poor' | 'good' | 'better' | 'best';
      msrp: string | null;
    }
  >;
  averageMargin: string; // Average across all variants
  recommendationScore: number; // 0-100, higher is better
}

/**
 * Side-by-side comparison of multiple distributors
 */
export interface DistributorComparisonReport {
  companyId: string;
  comparisonDate: number;
  numPallets: string;
  unitsPerPallet: string;
  distributors: DistributorComparisonResult[];
  bestDistributor: {
    distributorId: string;
    distributorName: string;
    reason: string; // e.g., "Lowest total CPU and highest average margin"
  };
  variantNames: string[];
}

/**
 * What-if pricing calculator parameters
 */
export interface WhatIfPricingParams {
  companyId: string;
  distributorId: string;
  numPallets: string;
  unitsPerPallet: string;
  appliedFees: DistributionCalcParams['appliedFees'];
  // Current pricing
  currentPricing: Record<
    string,
    {
      price_per_unit: string;
      base_cpu: string;
    }
  >;
  // What-if scenario: new pricing
  newPricing: Record<string, string>; // variant → new price
}

/**
 * What-if pricing result showing before/after comparison
 */
export interface WhatIfPricingResult {
  distributorId: string;
  distributorName: string;
  variantComparisons: Record<
    string,
    {
      currentPrice: string;
      newPrice: string;
      priceChange: string; // Percentage change
      currentMargin: string;
      newMargin: string;
      marginImpact: string; // Percentage point change
      marginQualityBefore: 'poor' | 'good' | 'better' | 'best';
      marginQualityAfter: 'poor' | 'good' | 'better' | 'best';
      recommendation: 'increase' | 'decrease' | 'maintain'; // Based on margin quality
    }
  >;
  overallImpact: {
    averageMarginBefore: string;
    averageMarginAfter: string;
    totalMarginImpact: string;
  };
}

/**
 * Break-even analysis parameters
 */
export interface BreakEvenAnalysisParams {
  companyId: string;
  distributorId: string;
  variantName: string;
  fixedCosts: string; // Total fixed costs to recover (e.g., equipment, setup)
  pricePerUnit: string; // Planned selling price
  baseCPU: string; // Base CPU from invoice calculations
  numPallets: string;
  unitsPerPallet: string;
  appliedFees: DistributionCalcParams['appliedFees'];
}

/**
 * Break-even analysis result
 */
export interface BreakEvenAnalysisResult {
  variantName: string;
  fixedCosts: string;
  pricePerUnit: string;
  variableCostPerUnit: string; // Total CPU (base CPU + distribution cost)
  contributionMargin: string; // Price - Variable Cost
  contributionMarginPercentage: string; // (Contribution Margin / Price) × 100
  breakEvenUnits: string; // Fixed Costs / Contribution Margin
  breakEvenRevenue: string; // Break-even Units × Price
  breakEvenPallets: string; // Break-even Units / Units per Pallet
  marginAtBreakEven: string; // Net profit margin at break-even volume
  recommendation: string; // Plain English guidance
}

/**
 * SKU rationalization parameters
 */
export interface SKURationalizationParams {
  companyId: string;
  distributorId: string;
  marginThreshold: string; // e.g., "40" for 40% minimum acceptable margin
  volumeThreshold?: string; // Optional: minimum volume to keep SKU
}

/**
 * SKU recommendation for rationalization
 */
export interface SKURationalizationRecommendation {
  variantName: string;
  currentMargin: string;
  marginQuality: 'poor' | 'good' | 'better' | 'best';
  totalCPU: string;
  pricePerUnit: string;
  volumeSold?: string; // Optional: if volume data available
  recommendation: 'keep' | 'review' | 'discontinue';
  reason: string; // Plain English explanation
  actionSteps: string[]; // Concrete next steps
}

/**
 * SKU rationalization report
 */
export interface SKURationalizationReport {
  companyId: string;
  distributorId: string;
  distributorName: string;
  analysisDate: number;
  marginThreshold: string;
  totalSKUs: number;
  recommendations: SKURationalizationRecommendation[];
  summary: {
    keepCount: number;
    reviewCount: number;
    discontinueCount: number;
    potentialSavings: string; // Estimated savings from discontinuing low-margin SKUs
  };
}

// ============================================================================
// Scenario Planning Service
// ============================================================================

export class ScenarioPlanningService {
  private db: TreasureChestDB;
  private distributionService: DistributionCostCalculatorService;

  constructor(db: TreasureChestDB) {
    this.db = db;
    this.distributionService = new DistributionCostCalculatorService(db);
  }

  /**
   * Compare multiple distributors side-by-side
   *
   * Calculates distribution costs and margins for 2-4 distributors using
   * identical parameters for fair comparison.
   *
   * @param params - Comparison parameters
   * @returns Comparison report with recommendation
   */
  async compareDistributors(
    params: DistributorComparisonParams
  ): Promise<DistributorComparisonReport> {
    // Validate parameters
    if (params.distributorIds.length < 2) {
      throw new Error('At least 2 distributors required for comparison');
    }
    if (params.distributorIds.length > 4) {
      throw new Error('Maximum 4 distributors can be compared at once');
    }

    // Fetch distributors
    const distributors = await this.db.cpgDistributors
      .where('id')
      .anyOf(params.distributorIds)
      .and((d) => d.company_id === params.companyId && d.active && d.deleted_at === null)
      .toArray();

    if (distributors.length !== params.distributorIds.length) {
      throw new Error('One or more distributors not found');
    }

    // Calculate for each distributor
    const results: DistributorComparisonResult[] = [];

    for (const distributor of distributors) {
      const calcParams: DistributionCalcParams = {
        distributorId: distributor.id,
        numPallets: params.numPallets,
        unitsPerPallet: params.unitsPerPallet,
        variantData: params.variantData,
        appliedFees: params.appliedFees,
      };

      const calcResult = await this.distributionService.calculateDistributionCost(
        calcParams
      );

      // Calculate average margin across all variants
      const margins = Object.values(calcResult.variantResults).map((v) =>
        new Decimal(v.net_profit_margin)
      );
      const avgMargin =
        margins.length > 0
          ? margins.reduce((sum, m) => sum.plus(m), new Decimal(0))
              .dividedBy(margins.length)
              .toFixed(2)
          : '0.00';

      // Calculate recommendation score (0-100)
      // Higher average margin + lower distribution cost = higher score
      const avgMarginNum = new Decimal(avgMargin);
      const distributionCost = new Decimal(calcResult.totalDistributionCost);
      const recommendationScore = this.calculateRecommendationScore(
        avgMarginNum,
        distributionCost
      );

      results.push({
        distributorId: distributor.id,
        distributorName: distributor.name,
        totalDistributionCost: calcResult.totalDistributionCost,
        distributionCostPerUnit: calcResult.distributionCostPerUnit,
        variantResults: calcResult.variantResults,
        averageMargin: avgMargin,
        recommendationScore,
      });
    }

    // Sort by recommendation score (highest first)
    results.sort((a, b) => b.recommendationScore - a.recommendationScore);

    // Determine best distributor
    const best = results[0]!;
    const reason = this.generateBestDistributorReason(best, results);

    // Extract variant names
    const variantNames = Object.keys(params.variantData);

    return {
      companyId: params.companyId,
      comparisonDate: Date.now(),
      numPallets: params.numPallets,
      unitsPerPallet: params.unitsPerPallet,
      distributors: results,
      bestDistributor: {
        distributorId: best.distributorId,
        distributorName: best.distributorName,
        reason,
      },
      variantNames,
    };
  }

  /**
   * What-if pricing calculator
   *
   * Shows instant margin impact of pricing changes without permanently
   * changing data.
   *
   * @param params - What-if pricing parameters
   * @returns Before/after comparison
   */
  async calculateWhatIfPricing(
    params: WhatIfPricingParams
  ): Promise<WhatIfPricingResult> {
    // Validate parameters
    if (!params.distributorId) {
      throw new Error('Distributor ID is required');
    }

    // Fetch distributor
    const distributor = await this.db.cpgDistributors.get(params.distributorId);
    if (!distributor) {
      throw new Error(`Distributor not found: ${params.distributorId}`);
    }

    // Calculate current scenario
    const currentCalcParams: DistributionCalcParams = {
      distributorId: params.distributorId,
      numPallets: params.numPallets,
      unitsPerPallet: params.unitsPerPallet,
      variantData: params.currentPricing,
      appliedFees: params.appliedFees,
    };

    const currentResult = await this.distributionService.calculateDistributionCost(
      currentCalcParams
    );

    // Calculate new scenario with updated pricing
    const newPricingData: Record<string, { price_per_unit: string; base_cpu: string }> = {};
    for (const [variant, currentData] of Object.entries(params.currentPricing)) {
      newPricingData[variant] = {
        price_per_unit: params.newPricing[variant] || currentData.price_per_unit,
        base_cpu: currentData.base_cpu, // CPU doesn't change with price
      };
    }

    const newCalcParams: DistributionCalcParams = {
      ...currentCalcParams,
      variantData: newPricingData,
    };

    const newResult = await this.distributionService.calculateDistributionCost(
      newCalcParams
    );

    // Build comparison for each variant
    const variantComparisons: WhatIfPricingResult['variantComparisons'] = {};

    for (const variant of Object.keys(params.currentPricing)) {
      const currentPrice = new Decimal(params.currentPricing[variant]!.price_per_unit);
      const newPrice = new Decimal(params.newPricing[variant] || currentPrice.toString());
      const currentVariantResult = currentResult.variantResults[variant]!;
      const newVariantResult = newResult.variantResults[variant]!;

      // Calculate price change percentage
      const priceChange = currentPrice.greaterThan(0)
        ? newPrice.minus(currentPrice).dividedBy(currentPrice).times(100)
        : new Decimal(0);

      // Calculate margin impact (percentage point change)
      const marginImpact = new Decimal(newVariantResult.net_profit_margin).minus(
        new Decimal(currentVariantResult.net_profit_margin)
      );

      // Determine recommendation
      let recommendation: 'increase' | 'decrease' | 'maintain' = 'maintain';
      if (newVariantResult.margin_quality === 'poor' && marginImpact.greaterThan(0)) {
        recommendation = 'increase'; // Price increase improves poor margin
      } else if (
        currentVariantResult.margin_quality === 'best' &&
        newVariantResult.margin_quality !== 'best'
      ) {
        recommendation = 'decrease'; // Price increase hurts best margin
      }

      variantComparisons[variant] = {
        currentPrice: currentPrice.toFixed(2),
        newPrice: newPrice.toFixed(2),
        priceChange: priceChange.toFixed(2),
        currentMargin: currentVariantResult.net_profit_margin,
        newMargin: newVariantResult.net_profit_margin,
        marginImpact: marginImpact.toFixed(2),
        marginQualityBefore: currentVariantResult.margin_quality,
        marginQualityAfter: newVariantResult.margin_quality,
        recommendation,
      };
    }

    // Calculate overall impact
    const currentMargins = Object.values(currentResult.variantResults).map((v) =>
      new Decimal(v.net_profit_margin)
    );
    const newMargins = Object.values(newResult.variantResults).map((v) =>
      new Decimal(v.net_profit_margin)
    );

    const avgMarginBefore =
      currentMargins.length > 0
        ? currentMargins
            .reduce((sum, m) => sum.plus(m), new Decimal(0))
            .dividedBy(currentMargins.length)
            .toFixed(2)
        : '0.00';

    const avgMarginAfter =
      newMargins.length > 0
        ? newMargins
            .reduce((sum, m) => sum.plus(m), new Decimal(0))
            .dividedBy(newMargins.length)
            .toFixed(2)
        : '0.00';

    const totalMarginImpact = new Decimal(avgMarginAfter)
      .minus(new Decimal(avgMarginBefore))
      .toFixed(2);

    return {
      distributorId: params.distributorId,
      distributorName: distributor.name,
      variantComparisons,
      overallImpact: {
        averageMarginBefore: avgMarginBefore,
        averageMarginAfter: avgMarginAfter,
        totalMarginImpact,
      },
    };
  }

  /**
   * Break-even analysis for new SKUs
   *
   * Formula: Break-even Units = Fixed Costs / (Price - Variable Cost)
   *
   * @param params - Break-even analysis parameters
   * @returns Break-even calculation result
   */
  async calculateBreakEven(
    params: BreakEvenAnalysisParams
  ): Promise<BreakEvenAnalysisResult> {
    // Validate parameters
    if (!params.fixedCosts || new Decimal(params.fixedCosts).lessThan(0)) {
      throw new Error('Fixed costs must be a non-negative number');
    }
    if (!params.pricePerUnit || new Decimal(params.pricePerUnit).lessThanOrEqualTo(0)) {
      throw new Error('Price per unit must be greater than 0');
    }

    // Fetch distributor for fee calculation
    const distributor = await this.db.cpgDistributors.get(params.distributorId);
    if (!distributor) {
      throw new Error(`Distributor not found: ${params.distributorId}`);
    }

    // Calculate total CPU (variable cost per unit)
    const calcParams: DistributionCalcParams = {
      distributorId: params.distributorId,
      numPallets: params.numPallets,
      unitsPerPallet: params.unitsPerPallet,
      variantData: {
        [params.variantName]: {
          price_per_unit: params.pricePerUnit,
          base_cpu: params.baseCPU,
        },
      },
      appliedFees: params.appliedFees,
    };

    const calcResult = await this.distributionService.calculateDistributionCost(
      calcParams
    );

    const variantResult = calcResult.variantResults[params.variantName]!;
    const variableCostPerUnit = new Decimal(variantResult.total_cpu);
    const pricePerUnit = new Decimal(params.pricePerUnit);
    const fixedCosts = new Decimal(params.fixedCosts);

    // Calculate contribution margin
    const contributionMargin = pricePerUnit.minus(variableCostPerUnit);
    const contributionMarginPercentage = pricePerUnit.greaterThan(0)
      ? contributionMargin.dividedBy(pricePerUnit).times(100)
      : new Decimal(0);

    // Calculate break-even units
    let breakEvenUnits = new Decimal(0);
    if (contributionMargin.greaterThan(0)) {
      breakEvenUnits = fixedCosts.dividedBy(contributionMargin);
    }

    // Calculate break-even revenue
    const breakEvenRevenue = breakEvenUnits.times(pricePerUnit);

    // Calculate break-even pallets
    const unitsPerPallet = new Decimal(params.unitsPerPallet);
    const breakEvenPallets = unitsPerPallet.greaterThan(0)
      ? breakEvenUnits.dividedBy(unitsPerPallet)
      : new Decimal(0);

    // Generate recommendation
    const recommendation = this.generateBreakEvenRecommendation(
      breakEvenUnits,
      contributionMarginPercentage,
      variantResult.margin_quality
    );

    return {
      variantName: params.variantName,
      fixedCosts: fixedCosts.toFixed(2),
      pricePerUnit: pricePerUnit.toFixed(2),
      variableCostPerUnit: variableCostPerUnit.toFixed(2),
      contributionMargin: contributionMargin.toFixed(2),
      contributionMarginPercentage: contributionMarginPercentage.toFixed(2),
      breakEvenUnits: breakEvenUnits.toFixed(0),
      breakEvenRevenue: breakEvenRevenue.toFixed(2),
      breakEvenPallets: breakEvenPallets.toFixed(2),
      marginAtBreakEven: variantResult.net_profit_margin,
      recommendation,
    };
  }

  /**
   * SKU rationalization recommendations
   *
   * Analyzes all SKUs and recommends which to keep, review, or discontinue
   * based on margin quality and volume thresholds.
   *
   * @param params - Rationalization parameters
   * @returns Rationalization report with recommendations
   */
  async analyzeSKURationalization(
    params: SKURationalizationParams
  ): Promise<SKURationalizationReport> {
    // Validate parameters
    const marginThreshold = new Decimal(params.marginThreshold);
    if (marginThreshold.lessThan(0) || marginThreshold.greaterThan(100)) {
      throw new Error('Margin threshold must be between 0 and 100');
    }

    // Fetch distributor
    const distributor = await this.db.cpgDistributors.get(params.distributorId);
    if (!distributor) {
      throw new Error(`Distributor not found: ${params.distributorId}`);
    }

    // Fetch all distribution calculations for this distributor
    const calculations = await this.db.cpgDistributionCalculations
      .where('[company_id+distributor_id]')
      .equals([params.companyId, params.distributorId])
      .and((calc) => calc.active && calc.deleted_at === null)
      .toArray();

    if (calculations.length === 0) {
      throw new Error('No distribution calculations found for this distributor');
    }

    // Use the most recent calculation
    calculations.sort((a, b) => b.calculation_date - a.calculation_date);
    const latestCalc = calculations[0]!;

    // Analyze each variant
    const recommendations: SKURationalizationRecommendation[] = [];

    for (const [variantName, variantResult] of Object.entries(
      latestCalc.variant_results
    )) {
      const margin = new Decimal(variantResult.net_profit_margin);
      const totalCPU = variantResult.total_cpu;
      const pricePerUnit = latestCalc.variant_data[variantName]?.price_per_unit || '0.00';

      // Determine recommendation
      let recommendation: 'keep' | 'review' | 'discontinue' = 'keep';
      let reason = '';
      const actionSteps: string[] = [];

      if (margin.lessThan(40)) {
        recommendation = 'discontinue';
        reason = `Margin of ${margin.toFixed(1)}% is below the 40% minimum threshold for profitability.`;
        actionSteps.push('Phase out this SKU over next 2-3 months');
        actionSteps.push('Notify customers of discontinuation');
        actionSteps.push('Clear remaining inventory');
        actionSteps.push('Allocate resources to higher-margin SKUs');
      } else if (margin.lessThan(marginThreshold)) {
        recommendation = 'review';
        reason = `Margin of ${margin.toFixed(1)}% is below your ${params.marginThreshold}% target.`;
        actionSteps.push('Analyze if price increase is possible');
        actionSteps.push('Negotiate better rates with suppliers');
        actionSteps.push('Review distribution costs for optimization');
        actionSteps.push('Monitor closely for next 90 days');
      } else {
        recommendation = 'keep';
        reason = `Margin of ${margin.toFixed(1)}% meets or exceeds your ${params.marginThreshold}% target.`;
        actionSteps.push('Continue monitoring performance');
        actionSteps.push('Look for opportunities to improve margins further');
      }

      recommendations.push({
        variantName,
        currentMargin: variantResult.net_profit_margin,
        marginQuality: variantResult.margin_quality,
        totalCPU,
        pricePerUnit,
        recommendation,
        reason,
        actionSteps,
      });
    }

    // Calculate summary
    const keepCount = recommendations.filter((r) => r.recommendation === 'keep').length;
    const reviewCount = recommendations.filter((r) => r.recommendation === 'review').length;
    const discontinueCount = recommendations.filter(
      (r) => r.recommendation === 'discontinue'
    ).length;

    // Estimate potential savings (simplified: assume discontinuing saves 10% of CPU costs)
    const discontinueSKUs = recommendations.filter(
      (r) => r.recommendation === 'discontinue'
    );
    const potentialSavings = discontinueSKUs
      .reduce((sum, sku) => sum.plus(new Decimal(sku.totalCPU)), new Decimal(0))
      .times(0.1) // 10% estimated savings
      .toFixed(2);

    return {
      companyId: params.companyId,
      distributorId: params.distributorId,
      distributorName: distributor.name,
      analysisDate: Date.now(),
      marginThreshold: params.marginThreshold,
      totalSKUs: recommendations.length,
      recommendations,
      summary: {
        keepCount,
        reviewCount,
        discontinueCount,
        potentialSavings,
      },
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Calculate recommendation score for distributor comparison
   *
   * Score formula: (Average Margin × 0.7) + ((1000 - Distribution Cost) / 1000 × 30)
   * This weights average margin more heavily (70%) than distribution cost (30%)
   *
   * @param avgMargin - Average margin across all variants
   * @param distributionCost - Total distribution cost
   * @returns Score from 0-100
   */
  private calculateRecommendationScore(
    avgMargin: Decimal,
    distributionCost: Decimal
  ): number {
    // Margin component (0-70 points)
    const marginScore = avgMargin.times(0.7);

    // Cost component (0-30 points, inversely proportional to cost)
    // Assumes typical distribution cost is around $1000
    const costScore = new Decimal(1000)
      .minus(distributionCost)
      .dividedBy(1000)
      .times(30);

    const totalScore = marginScore.plus(costScore);

    // Clamp to 0-100
    if (totalScore.lessThan(0)) return 0;
    if (totalScore.greaterThan(100)) return 100;

    return totalScore.toNumber();
  }

  /**
   * Generate reason for best distributor recommendation
   *
   * @param best - Best distributor result
   * @param all - All distributor results
   * @returns Plain English reason
   */
  private generateBestDistributorReason(
    best: DistributorComparisonResult,
    all: DistributorComparisonResult[]
  ): string {
    const reasons: string[] = [];

    // Check if highest average margin
    const maxMargin = Math.max(...all.map((d) => parseFloat(d.averageMargin)));
    if (parseFloat(best.averageMargin) === maxMargin) {
      reasons.push('highest average margin');
    }

    // Check if lowest distribution cost
    const minCost = Math.min(...all.map((d) => parseFloat(d.totalDistributionCost)));
    if (parseFloat(best.totalDistributionCost) === minCost) {
      reasons.push('lowest distribution cost');
    }

    // Check if lowest cost per unit
    const minCostPerUnit = Math.min(
      ...all.map((d) => parseFloat(d.distributionCostPerUnit))
    );
    if (parseFloat(best.distributionCostPerUnit) === minCostPerUnit) {
      reasons.push('lowest cost per unit');
    }

    if (reasons.length === 0) {
      return 'best overall balance of cost and margin';
    }

    if (reasons.length === 1) {
      return reasons[0]!;
    }

    return reasons.slice(0, -1).join(', ') + ' and ' + reasons[reasons.length - 1];
  }

  /**
   * Generate break-even recommendation
   *
   * @param breakEvenUnits - Break-even units
   * @param contributionMarginPct - Contribution margin percentage
   * @param marginQuality - Margin quality
   * @returns Plain English recommendation
   */
  private generateBreakEvenRecommendation(
    breakEvenUnits: Decimal,
    contributionMarginPct: Decimal,
    marginQuality: 'poor' | 'good' | 'better' | 'best'
  ): string {
    const units = breakEvenUnits.toFixed(0);

    if (marginQuality === 'poor') {
      return `You need to sell ${units} units to break even, but the margin quality is poor. Consider increasing your price or reducing costs before launching this SKU.`;
    }

    if (marginQuality === 'good') {
      return `You need to sell ${units} units to break even. The margin is acceptable, but there's room for improvement. Monitor closely in the first few months.`;
    }

    if (contributionMarginPct.greaterThan(60)) {
      return `You need to sell ${units} units to break even. With a strong ${contributionMarginPct.toFixed(1)}% contribution margin, this looks like a solid opportunity!`;
    }

    return `You need to sell ${units} units to break even. The margin quality is ${marginQuality}, which is a healthy foundation for this new SKU.`;
  }
}
