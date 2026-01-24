/**
 * Historical Analytics Service for CPG Module
 *
 * Implements Group E2: Historical Analytics
 *
 * Features:
 * - CPU trend analysis over time (3mo, 6mo, 1yr, all-time)
 * - Seasonal cost pattern detection (identify high/low cost periods)
 * - Distributor cost comparison over time (month-over-month trends)
 * - Trade spend ROI analysis (participation vs. margins)
 *
 * Requirements:
 * - CPG_MODULE_ROADMAP.md Group E2
 * - AGENT_REVIEW_PROD_CHECKLIST.md
 * - Date range queries across cpgInvoices, cpgDistributionCalculations, cpgSalesPromos
 * - Rolling averages (3-month, 6-month)
 * - Seasonal index calculation
 * - ROI formula: ((Revenue After - Revenue Before) - Promo Cost) / Promo Cost × 100
 *
 * Formulas:
 * CPU Trend = calculated_cpus[variant] over time
 * Seasonal Index = (Period Average / Overall Average) × 100
 * Distributor Cost Trend = total_distribution_cost over time
 * Trade Spend ROI = ((Revenue After - Revenue Before) - total_promo_cost) / total_promo_cost × 100
 */

import Decimal from 'decimal.js';
import type { TreasureChestDB } from '../../db/database';
import { logger } from '../../utils/logger';

const serviceLogger = logger.child('HistoricalAnalyticsService');

// Configure Decimal.js for currency precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Date range presets
 */
export type DateRangePreset = '3mo' | '6mo' | '1yr' | 'all';

/**
 * CPU trend data point
 */
export interface CPUTrendDataPoint {
  date: number;
  cpu: string;
  invoice_id: string;
  invoice_number: string | null;
  vendor_name: string | null;
}

/**
 * CPU trend analysis result
 */
export interface CPUTrendAnalysis {
  variant: string | null;
  category_id?: string;
  start_date: number;
  end_date: number;
  data_points: CPUTrendDataPoint[];
  statistics: {
    average_cpu: string;
    min_cpu: string;
    max_cpu: string;
    trend_direction: 'increasing' | 'decreasing' | 'stable';
    change_percentage: string; // % change from first to last
    rolling_average_3mo: string | null; // 3-month rolling average
    rolling_average_6mo: string | null; // 6-month rolling average
  };
}

/**
 * Seasonal pattern detection result
 */
export interface SeasonalPattern {
  variant: string | null;
  category_id?: string;
  patterns: {
    month: number; // 1-12
    month_name: string;
    average_cpu: string;
    seasonal_index: string; // (Period Average / Overall Average) × 100
    observation: 'high' | 'normal' | 'low'; // Based on seasonal index
    sample_size: number; // Number of data points for this month
  }[];
  overall_average: string;
  highest_cost_month: string;
  lowest_cost_month: string;
  insight: string; // e.g., "Oil costs increase 15% in summer"
}

/**
 * Distributor cost comparison data point
 */
export interface DistributorCostDataPoint {
  date: number;
  calculation_id: string;
  calculation_name: string | null;
  total_distribution_cost: string;
  distribution_cost_per_unit: string;
  num_pallets: string;
  units_per_pallet: string;
}

/**
 * Distributor cost trend analysis
 */
export interface DistributorCostTrend {
  distributor_id: string;
  distributor_name: string;
  start_date: number;
  end_date: number;
  data_points: DistributorCostDataPoint[];
  statistics: {
    average_total_cost: string;
    average_cost_per_unit: string;
    min_cost: string;
    max_cost: string;
    trend_direction: 'increasing' | 'decreasing' | 'stable';
    change_percentage: string;
  };
}

/**
 * Trade spend ROI data
 */
export interface TradeSpendROIData {
  promo_id: string;
  promo_name: string;
  retailer_name: string | null;
  promo_start_date: number | null;
  promo_end_date: number | null;
  total_promo_cost: string;
  revenue_before: string | null; // Optional - user provides
  revenue_after: string | null; // Optional - user provides
  roi_percentage: string | null; // Calculated if revenue data provided
  participation_status: 'approved' | 'declined' | 'draft' | 'submitted';
  average_margin_with_promo: string;
  average_margin_without_promo: string;
  margin_impact: string; // Difference in margin %
}

/**
 * Trade spend ROI summary
 */
export interface TradeSpendROISummary {
  total_promos_analyzed: number;
  total_promo_cost: string;
  total_roi: string | null; // Aggregate ROI if revenue data available
  participated_count: number;
  declined_count: number;
  average_margin_impact: string;
  promos: TradeSpendROIData[];
}

// ============================================================================
// Historical Analytics Service
// ============================================================================

export class HistoricalAnalyticsService {
  private db: TreasureChestDB;

  constructor(db: TreasureChestDB) {
    this.db = db;
  }

  /**
   * Get CPU trend analysis over a date range
   *
   * @param companyId - Company ID
   * @param variant - Variant name (or null for no variant)
   * @param categoryId - Optional category ID to filter
   * @param dateRange - Date range preset or custom range
   * @returns CPU trend analysis with statistics and rolling averages
   */
  async getCPUTrend(
    companyId: string,
    variant: string | null,
    categoryId?: string,
    dateRange: DateRangePreset | { start: number; end: number } = '1yr'
  ): Promise<CPUTrendAnalysis> {
    try {
      serviceLogger.info('Getting CPU trend', { companyId, variant, categoryId, dateRange });

      // Calculate date range
      const { startDate, endDate } = this.calculateDateRange(dateRange);

      // Fetch invoices in date range
      let invoices = await this.db.cpgInvoices
        .where('[company_id+invoice_date]')
        .between([companyId, startDate], [companyId, endDate + 1], false, true)
        .and((inv) => inv.deleted_at === null && inv.active)
        .sortBy('invoice_date');

      // Filter by category if specified
      if (categoryId) {
        invoices = invoices.filter((inv) =>
          Object.values(inv.cost_attribution).some((attr) => attr.category_id === categoryId)
        );
      }

      // Extract data points for the specified variant
      const dataPoints: CPUTrendDataPoint[] = [];
      const variantKey = variant || 'none';

      for (const invoice of invoices) {
        if (!invoice.calculated_cpus) continue;

        const cpu = invoice.calculated_cpus[variantKey];
        if (cpu) {
          dataPoints.push({
            date: invoice.invoice_date,
            cpu,
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            vendor_name: invoice.vendor_name,
          });
        }
      }

      // Calculate statistics
      const statistics = this.calculateTrendStatistics(dataPoints);

      // Calculate rolling averages
      const rollingAvg3Mo = this.calculateRollingAverage(dataPoints, 3);
      const rollingAvg6Mo = this.calculateRollingAverage(dataPoints, 6);

      return {
        variant,
        category_id: categoryId,
        start_date: startDate,
        end_date: endDate,
        data_points: dataPoints,
        statistics: {
          ...statistics,
          rolling_average_3mo: rollingAvg3Mo,
          rolling_average_6mo: rollingAvg6Mo,
        },
      };
    } catch (error) {
      serviceLogger.error('Failed to get CPU trend', { error });
      throw error;
    }
  }

  /**
   * Detect seasonal cost patterns
   *
   * Analyzes CPU data to identify seasonal patterns (e.g., "Oil costs increase 15% in summer")
   *
   * @param companyId - Company ID
   * @param variant - Variant name (or null for no variant)
   * @param categoryId - Optional category ID to filter
   * @param minYears - Minimum years of data to detect patterns (default: 2)
   * @returns Seasonal pattern analysis with monthly breakdown
   */
  async detectSeasonalPatterns(
    companyId: string,
    variant: string | null,
    categoryId?: string,
    minYears: number = 2
  ): Promise<SeasonalPattern> {
    try {
      serviceLogger.info('Detecting seasonal patterns', { companyId, variant, categoryId });

      // Get all-time data
      const allTimeData = await this.getCPUTrend(companyId, variant, categoryId, 'all');

      // Check if we have enough data (at least minYears of data)
      if (allTimeData.data_points.length === 0) {
        throw new Error('No data available for seasonal analysis');
      }

      const earliestDate = allTimeData.data_points[0]!.date;
      const latestDate = allTimeData.data_points[allTimeData.data_points.length - 1]!.date;
      const yearsOfData = (latestDate - earliestDate) / (365.25 * 24 * 60 * 60 * 1000);

      if (yearsOfData < minYears) {
        throw new Error(
          `Insufficient data for seasonal analysis. Need at least ${minYears} years of data.`
        );
      }

      // Group data by month
      const monthlyData: Map<number, Decimal[]> = new Map();
      for (let i = 1; i <= 12; i++) {
        monthlyData.set(i, []);
      }

      for (const point of allTimeData.data_points) {
        const date = new Date(point.date);
        const month = date.getMonth() + 1; // 1-12
        const cpuValue = new Decimal(point.cpu);
        monthlyData.get(month)!.push(cpuValue);
      }

      // Calculate overall average
      const allCPUs = allTimeData.data_points.map((p) => new Decimal(p.cpu));
      const overallAverage = allCPUs
        .reduce((sum, val) => sum.plus(val), new Decimal(0))
        .dividedBy(allCPUs.length);

      // Calculate monthly averages and seasonal indices
      const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];

      const patterns = [];
      let highestIndex = new Decimal(0);
      let lowestIndex = new Decimal(999999);
      let highestMonth = '';
      let lowestMonth = '';

      for (let month = 1; month <= 12; month++) {
        const cpuValues = monthlyData.get(month)!;

        if (cpuValues.length === 0) {
          // Skip months with no data
          continue;
        }

        const monthAverage = cpuValues
          .reduce((sum, val) => sum.plus(val), new Decimal(0))
          .dividedBy(cpuValues.length);

        // Seasonal Index = (Period Average / Overall Average) × 100
        const seasonalIndex = monthAverage.dividedBy(overallAverage).times(100);

        // Determine observation based on seasonal index
        let observation: 'high' | 'normal' | 'low';
        if (seasonalIndex.greaterThan(110)) {
          observation = 'high';
        } else if (seasonalIndex.lessThan(90)) {
          observation = 'low';
        } else {
          observation = 'normal';
        }

        // Track highest and lowest
        if (seasonalIndex.greaterThan(highestIndex)) {
          highestIndex = seasonalIndex;
          highestMonth = monthNames[month - 1]!;
        }
        if (seasonalIndex.lessThan(lowestIndex)) {
          lowestIndex = seasonalIndex;
          lowestMonth = monthNames[month - 1]!;
        }

        patterns.push({
          month,
          month_name: monthNames[month - 1]!,
          average_cpu: monthAverage.toFixed(2),
          seasonal_index: seasonalIndex.toFixed(2),
          observation,
          sample_size: cpuValues.length,
        });
      }

      // Generate insight
      const highestDiff = highestIndex.minus(100).abs();
      const lowestDiff = new Decimal(100).minus(lowestIndex).abs();
      let insight = '';

      if (highestDiff.greaterThan(10)) {
        const percentage = highestDiff.toFixed(0);
        insight = `Costs increase ${percentage}% in ${highestMonth}`;
      } else if (lowestDiff.greaterThan(10)) {
        const percentage = lowestDiff.toFixed(0);
        insight = `Costs decrease ${percentage}% in ${lowestMonth}`;
      } else {
        insight = 'No significant seasonal patterns detected';
      }

      return {
        variant,
        category_id: categoryId,
        patterns,
        overall_average: overallAverage.toFixed(2),
        highest_cost_month: highestMonth,
        lowest_cost_month: lowestMonth,
        insight,
      };
    } catch (error) {
      serviceLogger.error('Failed to detect seasonal patterns', { error });
      throw error;
    }
  }

  /**
   * Get distributor cost trend over time
   *
   * Analyzes distribution cost changes month-over-month for a specific distributor
   *
   * @param companyId - Company ID
   * @param distributorId - Distributor ID
   * @param dateRange - Date range preset or custom range
   * @returns Distributor cost trend analysis
   */
  async getDistributorCostTrend(
    companyId: string,
    distributorId: string,
    dateRange: DateRangePreset | { start: number; end: number } = '1yr'
  ): Promise<DistributorCostTrend> {
    try {
      serviceLogger.info('Getting distributor cost trend', { companyId, distributorId });

      // Calculate date range
      const { startDate, endDate } = this.calculateDateRange(dateRange);

      // Fetch distributor
      const distributor = await this.db.cpgDistributors.get(distributorId);
      if (!distributor) {
        throw new Error(`Distributor not found: ${distributorId}`);
      }

      // Fetch distribution calculations in date range
      const calculations = await this.db.cpgDistributionCalculations
        .where('[company_id+distributor_id]')
        .equals([companyId, distributorId])
        .and(
          (calc) =>
            calc.deleted_at === null &&
            calc.active &&
            calc.calculation_date >= startDate &&
            calc.calculation_date <= endDate
        )
        .sortBy('calculation_date');

      // Extract data points
      const dataPoints: DistributorCostDataPoint[] = calculations.map((calc) => ({
        date: calc.calculation_date,
        calculation_id: calc.id,
        calculation_name: calc.calculation_name,
        total_distribution_cost: calc.total_distribution_cost,
        distribution_cost_per_unit: calc.distribution_cost_per_unit,
        num_pallets: calc.num_pallets,
        units_per_pallet: calc.units_per_pallet,
      }));

      // Calculate statistics
      if (dataPoints.length === 0) {
        return {
          distributor_id: distributorId,
          distributor_name: distributor.name,
          start_date: startDate,
          end_date: endDate,
          data_points: [],
          statistics: {
            average_total_cost: '0.00',
            average_cost_per_unit: '0.00',
            min_cost: '0.00',
            max_cost: '0.00',
            trend_direction: 'stable',
            change_percentage: '0.00',
          },
        };
      }

      const totalCosts = dataPoints.map((p) => new Decimal(p.total_distribution_cost));
      const costsPerUnit = dataPoints.map((p) => new Decimal(p.distribution_cost_per_unit));

      const avgTotalCost = totalCosts
        .reduce((sum, val) => sum.plus(val), new Decimal(0))
        .dividedBy(totalCosts.length);

      const avgCostPerUnit = costsPerUnit
        .reduce((sum, val) => sum.plus(val), new Decimal(0))
        .dividedBy(costsPerUnit.length);

      const minCost = Decimal.min(...totalCosts);
      const maxCost = Decimal.max(...totalCosts);

      // Determine trend direction
      let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
      let changePercentage = new Decimal(0);

      if (dataPoints.length >= 2) {
        const firstCost = new Decimal(dataPoints[0]!.total_distribution_cost);
        const lastCost = new Decimal(dataPoints[dataPoints.length - 1]!.total_distribution_cost);

        if (firstCost.greaterThan(0)) {
          changePercentage = lastCost.minus(firstCost).dividedBy(firstCost).times(100);

          if (changePercentage.greaterThan(5)) {
            trendDirection = 'increasing';
          } else if (changePercentage.lessThan(-5)) {
            trendDirection = 'decreasing';
          }
        }
      }

      return {
        distributor_id: distributorId,
        distributor_name: distributor.name,
        start_date: startDate,
        end_date: endDate,
        data_points: dataPoints,
        statistics: {
          average_total_cost: avgTotalCost.toFixed(2),
          average_cost_per_unit: avgCostPerUnit.toFixed(2),
          min_cost: minCost.toFixed(2),
          max_cost: maxCost.toFixed(2),
          trend_direction: trendDirection,
          change_percentage: changePercentage.toFixed(2),
        },
      };
    } catch (error) {
      serviceLogger.error('Failed to get distributor cost trend', { error });
      throw error;
    }
  }

  /**
   * Analyze trade spend ROI
   *
   * Calculates ROI for trade spend promotions
   * Formula: ((Revenue After - Revenue Before) - Promo Cost) / Promo Cost × 100
   *
   * @param companyId - Company ID
   * @param dateRange - Date range preset or custom range
   * @returns Trade spend ROI summary
   */
  async analyzeTradeSpendROI(
    companyId: string,
    dateRange: DateRangePreset | { start: number; end: number } = '1yr'
  ): Promise<TradeSpendROISummary> {
    try {
      serviceLogger.info('Analyzing trade spend ROI', { companyId });

      // Calculate date range
      const { startDate, endDate } = this.calculateDateRange(dateRange);

      // Fetch promos in date range
      const promos = await this.db.cpgSalesPromos
        .where('company_id')
        .equals(companyId)
        .and(
          (promo) =>
            promo.deleted_at === null &&
            promo.active &&
            ((promo.promo_start_date !== null &&
              promo.promo_start_date >= startDate &&
              promo.promo_start_date <= endDate) ||
              promo.created_at >= startDate)
        )
        .toArray();

      // Calculate ROI for each promo
      const promoData: TradeSpendROIData[] = [];
      let totalPromoCost = new Decimal(0);
      let participatedCount = 0;
      let declinedCount = 0;
      const marginImpacts: Decimal[] = [];

      for (const promo of promos) {
        const promoCost = new Decimal(promo.total_promo_cost);
        totalPromoCost = totalPromoCost.plus(promoCost);

        // Calculate average margins
        let avgMarginWith = new Decimal(0);
        let avgMarginWithout = new Decimal(0);
        let variantCount = 0;

        for (const [_variant, result] of Object.entries(promo.variant_promo_results)) {
          avgMarginWith = avgMarginWith.plus(new Decimal(result.net_profit_margin_with_promo));
          avgMarginWithout = avgMarginWithout.plus(
            new Decimal(result.net_profit_margin_without_promo)
          );
          variantCount++;
        }

        if (variantCount > 0) {
          avgMarginWith = avgMarginWith.dividedBy(variantCount);
          avgMarginWithout = avgMarginWithout.dividedBy(variantCount);
        }

        const marginImpact = avgMarginWith.minus(avgMarginWithout);
        marginImpacts.push(marginImpact);

        // Determine participation status
        const status = promo.status;
        if (status === 'approved') participatedCount++;
        if (status === 'declined') declinedCount++;

        // ROI calculation requires revenue data (not always available)
        // For now, we'll leave it as null unless user provides revenue data
        let roiPercentage: string | null = null;

        // Note: Revenue tracking would need to be added to the schema
        // This is a placeholder for future enhancement
        const revenueBefore: string | null = null;
        const revenueAfter: string | null = null;

        if (revenueBefore !== null && revenueAfter !== null) {
          const revBeforeDecimal = new Decimal(revenueBefore);
          const revAfterDecimal = new Decimal(revenueAfter);
          const revenueIncrease = revAfterDecimal.minus(revBeforeDecimal);
          const netGain = revenueIncrease.minus(promoCost);

          if (promoCost.greaterThan(0)) {
            const roi = netGain.dividedBy(promoCost).times(100);
            roiPercentage = roi.toFixed(2);
          }
        }

        promoData.push({
          promo_id: promo.id,
          promo_name: promo.promo_name,
          retailer_name: promo.retailer_name,
          promo_start_date: promo.promo_start_date,
          promo_end_date: promo.promo_end_date,
          total_promo_cost: promo.total_promo_cost,
          revenue_before: revenueBefore,
          revenue_after: revenueAfter,
          roi_percentage: roiPercentage,
          participation_status: status,
          average_margin_with_promo: avgMarginWith.toFixed(2),
          average_margin_without_promo: avgMarginWithout.toFixed(2),
          margin_impact: marginImpact.toFixed(2),
        });
      }

      // Calculate aggregate metrics
      const avgMarginImpact =
        marginImpacts.length > 0
          ? marginImpacts
              .reduce((sum, val) => sum.plus(val), new Decimal(0))
              .dividedBy(marginImpacts.length)
          : new Decimal(0);

      return {
        total_promos_analyzed: promos.length,
        total_promo_cost: totalPromoCost.toFixed(2),
        total_roi: null, // Would need aggregate revenue data
        participated_count: participatedCount,
        declined_count: declinedCount,
        average_margin_impact: avgMarginImpact.toFixed(2),
        promos: promoData,
      };
    } catch (error) {
      serviceLogger.error('Failed to analyze trade spend ROI', { error });
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Calculate date range based on preset or custom range
   */
  private calculateDateRange(
    dateRange: DateRangePreset | { start: number; end: number }
  ): { startDate: number; endDate: number } {
    const now = Date.now();

    if (typeof dateRange === 'object' && 'start' in dateRange) {
      return { startDate: dateRange.start, endDate: dateRange.end };
    }

    const preset = dateRange as DateRangePreset;
    let startDate: number;

    switch (preset) {
      case '3mo':
        startDate = now - 3 * 30.44 * 24 * 60 * 60 * 1000; // ~3 months
        break;
      case '6mo':
        startDate = now - 6 * 30.44 * 24 * 60 * 60 * 1000; // ~6 months
        break;
      case '1yr':
        startDate = now - 365.25 * 24 * 60 * 60 * 1000; // 1 year
        break;
      case 'all':
        startDate = 0; // All time
        break;
      default:
        startDate = now - 365.25 * 24 * 60 * 60 * 1000; // Default to 1 year
    }

    return { startDate, endDate: now };
  }

  /**
   * Calculate trend statistics from data points
   */
  private calculateTrendStatistics(dataPoints: CPUTrendDataPoint[]): {
    average_cpu: string;
    min_cpu: string;
    max_cpu: string;
    trend_direction: 'increasing' | 'decreasing' | 'stable';
    change_percentage: string;
  } {
    if (dataPoints.length === 0) {
      return {
        average_cpu: '0.00',
        min_cpu: '0.00',
        max_cpu: '0.00',
        trend_direction: 'stable',
        change_percentage: '0.00',
      };
    }

    const cpuValues = dataPoints.map((p) => new Decimal(p.cpu));

    const avgCPU = cpuValues
      .reduce((sum, val) => sum.plus(val), new Decimal(0))
      .dividedBy(cpuValues.length);

    const minCPU = Decimal.min(...cpuValues);
    const maxCPU = Decimal.max(...cpuValues);

    // Determine trend direction
    let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
    let changePercentage = new Decimal(0);

    if (dataPoints.length >= 2) {
      const firstCPU = new Decimal(dataPoints[0]!.cpu);
      const lastCPU = new Decimal(dataPoints[dataPoints.length - 1]!.cpu);

      if (firstCPU.greaterThan(0)) {
        changePercentage = lastCPU.minus(firstCPU).dividedBy(firstCPU).times(100);

        if (changePercentage.greaterThan(2)) {
          trendDirection = 'increasing';
        } else if (changePercentage.lessThan(-2)) {
          trendDirection = 'decreasing';
        }
      }
    }

    return {
      average_cpu: avgCPU.toFixed(2),
      min_cpu: minCPU.toFixed(2),
      max_cpu: maxCPU.toFixed(2),
      trend_direction: trendDirection,
      change_percentage: changePercentage.toFixed(2),
    };
  }

  /**
   * Calculate rolling average for CPU trend
   *
   * @param dataPoints - CPU trend data points
   * @param months - Number of months for rolling average
   * @returns Rolling average or null if insufficient data
   */
  private calculateRollingAverage(
    dataPoints: CPUTrendDataPoint[],
    months: number
  ): string | null {
    if (dataPoints.length === 0) return null;

    // Calculate milliseconds for the rolling window
    const windowMs = months * 30.44 * 24 * 60 * 60 * 1000;

    // Use data points from the last N months
    const now = Date.now();
    const cutoffDate = now - windowMs;

    const recentPoints = dataPoints.filter((p) => p.date >= cutoffDate);

    if (recentPoints.length === 0) return null;

    const cpuValues = recentPoints.map((p) => new Decimal(p.cpu));
    const avg = cpuValues
      .reduce((sum, val) => sum.plus(val), new Decimal(0))
      .dividedBy(cpuValues.length);

    return avg.toFixed(2);
  }
}

// Export singleton instance
// Note: Requires database instance to be injected
export const createHistoricalAnalyticsService = (db: TreasureChestDB) =>
  new HistoricalAnalyticsService(db);
