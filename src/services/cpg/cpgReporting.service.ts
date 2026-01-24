/**
 * CPG Reporting Service
 *
 * Provides CPG-specific reports including:
 * - CPG-Enhanced P&L Report
 * - Gross Margin by Product Report
 * - Distribution Cost Analysis Report
 * - Trade Spend Summary Report
 *
 * Per Group D3: CPG-Specific Reporting
 */

import Decimal from 'decimal.js';
import { db } from '../../db';
import { logger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/errors';
import type {
  CPGCategory,
} from '../../db/schema/cpg.schema';
import type { DateRange } from '../../types/reports.types';

// Configure Decimal.js for currency (2 decimal places)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const reportLogger = logger.child('CPGReporting');

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Margin quality filters
 */
export type MarginQuality = 'poor' | 'good' | 'better' | 'best';

/**
 * Margin filters for gross margin report
 */
export interface MarginFilters {
  categoryId?: string;
  variant?: string;
  marginQuality?: MarginQuality;
  minMargin?: number;
  maxMargin?: number;
}

/**
 * Gross margin data per product/variant
 */
export interface GrossMarginData {
  categoryId: string;
  categoryName: string;
  variant: string | null;
  revenue: number;
  cpu: number;
  grossMargin: number;
  grossMarginPercentage: number;
  marginQuality: MarginQuality;
  unitsSold?: number;
}

/**
 * Distributor comparison data
 */
export interface DistributorComparison {
  distributors: {
    distributorId: string;
    distributorName: string;
    totalCost: number;
    costPerUnit: number;
    marginImpact: number;
    feeBreakdown: {
      feeName: string;
      feeAmount: number;
    }[];
  }[];
  mostCostEffective: string; // distributor ID
  leastCostEffective: string; // distributor ID
}

/**
 * Trade spend summary
 */
export interface TradeSpendSummary {
  totalTradeSpend: number;
  promoCount: number;
  approvedCount: number;
  declinedCount: number;
  participateRecommendations: number;
  declineRecommendations: number;
  neutralRecommendations: number;
  promos: {
    promoId: string;
    promoName: string;
    retailerName: string | null;
    startDate: number | null;
    endDate: number | null;
    totalCost: number;
    recommendation: 'participate' | 'decline' | 'neutral' | null;
    status: 'draft' | 'submitted' | 'approved' | 'declined';
    marginImpact: number;
  }[];
}

/**
 * CPG-Enhanced P&L Report
 */
export interface CPGProfitLossReport {
  companyId: string;
  dateRange: DateRange;
  generatedAt: Date;

  // Standard P&L sections
  revenue: number;
  cogs: number;
  operatingExpenses: number;
  netIncome: number;

  // CPG-specific breakdowns
  cpuBreakdown: {
    categoryName: string;
    variant: string | null;
    cpu: number;
    totalCost: number;
  }[];

  distributionCosts: {
    distributorName: string;
    totalCost: number;
    costPerUnit: number;
  }[];

  tradeSpend: {
    totalSpend: number;
    promoCount: number;
    avgMarginImpact: number;
  };

  grossMarginByProduct: {
    categoryName: string;
    variant: string | null;
    margin: number;
    marginPercentage: number;
  }[];
}

// =============================================================================
// CPG-Enhanced P&L Report
// =============================================================================

/**
 * Generate CPG-Enhanced Profit & Loss Report
 *
 * Standard P&L enhanced with CPG data including:
 * - CPU breakdown by category/variant
 * - Distribution costs by distributor
 * - Trade spend (sales promos)
 * - Gross margin % by product line
 *
 * @param companyId - Company ID
 * @param startDate - Report start date (timestamp)
 * @param endDate - Report end date (timestamp)
 * @returns CPG-Enhanced P&L report
 */
export async function generateCPGProfitLoss(
  companyId: string,
  startDate: number,
  endDate: number
): Promise<CPGProfitLossReport> {
  try {
    reportLogger.info('Generating CPG P&L report', { companyId, startDate, endDate });

    // Fetch CPG invoices for the period
    const invoices = await db.cpgInvoices
      .where('company_id')
      .equals(companyId)
      .and((inv) => inv.invoice_date >= startDate && inv.invoice_date <= endDate && !inv.deleted_at)
      .toArray();

    // Fetch distribution calculations for the period
    const distCalcs = await db.cpgDistributionCalculations
      .where('company_id')
      .equals(companyId)
      .and(
        (calc) =>
          calc.calculation_date >= startDate && calc.calculation_date <= endDate && !calc.deleted_at
      )
      .toArray();

    // Fetch sales promos for the period
    const promos = await db.cpgSalesPromos
      .where('company_id')
      .equals(companyId)
      .and(
        (promo) =>
          (!promo.promo_start_date || promo.promo_start_date <= endDate) &&
          (!promo.promo_end_date || promo.promo_end_date >= startDate) &&
          !promo.deleted_at
      )
      .toArray();

    // Fetch categories for names
    const categories = await db.cpgCategories.where('company_id').equals(companyId).toArray();
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    // Calculate revenue (simplified - would integrate with accounting in integrated mode)
    const revenue = new Decimal(0); // TODO: Integrate with accounting revenue

    // Calculate COGS from invoices
    let cogs = new Decimal(0);
    const cpuBreakdown: { categoryName: string; variant: string | null; cpu: number; totalCost: number }[] = [];

    for (const invoice of invoices) {
      const totalPaid = new Decimal(invoice.total_paid);
      cogs = cogs.plus(totalPaid);

      // Build CPU breakdown
      if (invoice.calculated_cpus) {
        for (const [variant, cpu] of Object.entries(invoice.calculated_cpus)) {
          const existingEntry = cpuBreakdown.find((e) => e.variant === (variant || null));
          if (existingEntry) {
            existingEntry.totalCost += totalPaid.toNumber();
          } else {
            // Find category name from cost_attribution
            let categoryName = 'Unknown';
            for (const attr of Object.values(invoice.cost_attribution)) {
              if (attr.variant === variant || (!variant && !attr.variant)) {
                const category = categoryMap.get(attr.category_id);
                categoryName = category?.name || 'Unknown';
                break;
              }
            }

            cpuBreakdown.push({
              categoryName,
              variant: variant || null,
              cpu: parseFloat(cpu),
              totalCost: totalPaid.toNumber(),
            });
          }
        }
      }
    }

    // Calculate distribution costs
    const distributionCosts: { distributorName: string; totalCost: number; costPerUnit: number }[] = [];
    const distributorMap = new Map<string, { totalCost: Decimal; costPerUnit: Decimal; count: number }>();

    for (const calc of distCalcs) {
      const distributor = await db.cpgDistributors.get(calc.distributor_id);
      if (!distributor) continue;

      const totalCost = new Decimal(calc.total_distribution_cost);
      const costPerUnit = new Decimal(calc.distribution_cost_per_unit);

      const existing = distributorMap.get(distributor.id);
      if (existing) {
        existing.totalCost = existing.totalCost.plus(totalCost);
        existing.costPerUnit = existing.costPerUnit.plus(costPerUnit);
        existing.count++;
      } else {
        distributorMap.set(distributor.id, {
          totalCost,
          costPerUnit,
          count: 1,
        });
      }
    }

    for (const [distId, data] of distributorMap.entries()) {
      const distributor = await db.cpgDistributors.get(distId);
      if (distributor) {
        distributionCosts.push({
          distributorName: distributor.name,
          totalCost: data.totalCost.toNumber(),
          costPerUnit: data.costPerUnit.dividedBy(data.count).toNumber(),
        });
      }
    }

    // Calculate trade spend
    let totalTradeSpend = new Decimal(0);
    let totalMarginImpact = new Decimal(0);
    let promoCount = 0;

    for (const promo of promos) {
      const promoCost = new Decimal(promo.total_promo_cost);
      totalTradeSpend = totalTradeSpend.plus(promoCost);
      promoCount++;

      // Calculate margin impact (simplified)
      for (const result of Object.values(promo.variant_promo_results)) {
        const marginWith = new Decimal(result.net_profit_margin_with_promo);
        const marginWithout = new Decimal(result.net_profit_margin_without_promo);
        totalMarginImpact = totalMarginImpact.plus(marginWith.minus(marginWithout));
      }
    }

    const avgMarginImpact = promoCount > 0 ? totalMarginImpact.dividedBy(promoCount).toNumber() : 0;

    // Calculate gross margin by product (simplified)
    const grossMarginByProduct = cpuBreakdown.map((item) => {
      // Simplified margin calculation - would use actual prices in integrated mode
      const estimatedPrice = new Decimal(item.cpu).times(3); // Assume 3x markup
      const margin = estimatedPrice.minus(item.cpu);
      const marginPercentage = estimatedPrice.isZero()
        ? new Decimal(0)
        : margin.dividedBy(estimatedPrice).times(100);

      return {
        categoryName: item.categoryName,
        variant: item.variant,
        margin: margin.toNumber(),
        marginPercentage: marginPercentage.toNumber(),
      };
    });

    return {
      companyId,
      dateRange: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
      generatedAt: new Date(),
      revenue: revenue.toNumber(),
      cogs: cogs.toNumber(),
      operatingExpenses: 0, // TODO: Integrate with accounting
      netIncome: revenue.minus(cogs).toNumber(),
      cpuBreakdown,
      distributionCosts,
      tradeSpend: {
        totalSpend: totalTradeSpend.toNumber(),
        promoCount,
        avgMarginImpact,
      },
      grossMarginByProduct,
    };
  } catch (error) {
    reportLogger.error('Failed to generate CPG P&L report', { error, companyId });
    throw new AppError(
      ErrorCode.UNKNOWN_ERROR,
      'Failed to generate CPG P&L report',
      { companyId, error }
    );
  }
}

// =============================================================================
// Gross Margin by Product Report
// =============================================================================

/**
 * Get gross margin data by product
 *
 * Returns table view of products with:
 * - Product | Variant | Revenue | CPU | Gross Margin % | Margin Quality
 *
 * @param companyId - Company ID
 * @param filters - Optional filters
 * @returns Array of gross margin data
 */
export async function getGrossMarginByProduct(
  companyId: string,
  filters?: MarginFilters
): Promise<GrossMarginData[]> {
  try {
    reportLogger.info('Getting gross margin by product', { companyId, filters });

    // Fetch all invoices with calculated CPUs
    const invoices = await db.cpgInvoices
      .where('company_id')
      .equals(companyId)
      .and((inv) => !inv.deleted_at && inv.calculated_cpus !== null)
      .toArray();

    // Fetch categories
    const categories = await db.cpgCategories.where('company_id').equals(companyId).toArray();
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const marginData: GrossMarginData[] = [];

    for (const invoice of invoices) {
      if (!invoice.calculated_cpus) continue;

      for (const [variant, cpuStr] of Object.entries(invoice.calculated_cpus)) {
        const cpu = new Decimal(cpuStr);

        // Find category from cost_attribution
        let category: CPGCategory | undefined;
        for (const attr of Object.values(invoice.cost_attribution)) {
          if (attr.variant === variant || (!variant && !attr.variant)) {
            category = categoryMap.get(attr.category_id);
            break;
          }
        }

        if (!category) continue;

        // Apply category filter
        if (filters?.categoryId && category.id !== filters.categoryId) continue;

        // Apply variant filter
        if (filters?.variant && variant !== filters.variant) continue;

        // Estimate revenue (3x CPU - simplified)
        const estimatedPrice = cpu.times(3);
        const grossMargin = estimatedPrice.minus(cpu);
        const grossMarginPercentage = estimatedPrice.isZero()
          ? new Decimal(0)
          : grossMargin.dividedBy(estimatedPrice).times(100);

        // Determine margin quality
        const marginQuality = getMarginQuality(grossMarginPercentage.toNumber());

        // Apply margin quality filter
        if (filters?.marginQuality && marginQuality !== filters.marginQuality) continue;

        // Apply margin range filters
        if (filters?.minMargin && grossMarginPercentage.toNumber() < filters.minMargin) continue;
        if (filters?.maxMargin && grossMarginPercentage.toNumber() > filters.maxMargin) continue;

        marginData.push({
          categoryId: category.id,
          categoryName: category.name,
          variant: variant || null,
          revenue: estimatedPrice.toNumber(),
          cpu: cpu.toNumber(),
          grossMargin: grossMargin.toNumber(),
          grossMarginPercentage: grossMarginPercentage.toNumber(),
          marginQuality,
        });
      }
    }

    // Sort by margin percentage (highest first)
    marginData.sort((a, b) => b.grossMarginPercentage - a.grossMarginPercentage);

    return marginData;
  } catch (error) {
    reportLogger.error('Failed to get gross margin by product', { error, companyId });
    throw new AppError(
      ErrorCode.UNKNOWN_ERROR,
      'Failed to get gross margin by product',
      { companyId, error }
    );
  }
}

// =============================================================================
// Distribution Cost Comparison
// =============================================================================

/**
 * Compare distributors side-by-side
 *
 * Shows:
 * - Total costs, cost per unit, margin impact
 * - Identifies most cost-effective distributor
 * - Fee breakdown by distributor
 *
 * @param companyId - Company ID
 * @param distributorIds - Array of distributor IDs to compare
 * @returns Distributor comparison data
 */
export async function compareDistributors(
  companyId: string,
  distributorIds: string[]
): Promise<DistributorComparison> {
  try {
    reportLogger.info('Comparing distributors', { companyId, distributorIds });

    const distributors: DistributorComparison['distributors'] = [];

    for (const distId of distributorIds) {
      const distributor = await db.cpgDistributors.get(distId);
      if (!distributor || distributor.company_id !== companyId) continue;

      // Fetch all calculations for this distributor
      const calcs = await db.cpgDistributionCalculations
        .where('distributor_id')
        .equals(distId)
        .and((calc) => !calc.deleted_at)
        .toArray();

      if (calcs.length === 0) {
        distributors.push({
          distributorId: distId,
          distributorName: distributor.name,
          totalCost: 0,
          costPerUnit: 0,
          marginImpact: 0,
          feeBreakdown: [],
        });
        continue;
      }

      // Calculate averages
      let totalCost = new Decimal(0);
      let totalCostPerUnit = new Decimal(0);
      let totalMarginImpact = new Decimal(0);

      for (const calc of calcs) {
        totalCost = totalCost.plus(calc.total_distribution_cost);
        totalCostPerUnit = totalCostPerUnit.plus(calc.distribution_cost_per_unit);

        // Calculate margin impact (difference from base margin)
        for (const result of Object.values(calc.variant_results)) {
          const baseCPU = new Decimal(result.total_cpu).minus(calc.distribution_cost_per_unit);
          const baseMargin = baseCPU.isZero()
            ? new Decimal(0)
            : new Decimal(100).minus(baseCPU.dividedBy(result.total_cpu).times(100));
          const actualMargin = new Decimal(result.net_profit_margin);
          totalMarginImpact = totalMarginImpact.plus(actualMargin.minus(baseMargin));
        }
      }

      const avgTotalCost = totalCost.dividedBy(calcs.length);
      const avgCostPerUnit = totalCostPerUnit.dividedBy(calcs.length);
      const avgMarginImpact = totalMarginImpact.dividedBy(calcs.length);

      // Build fee breakdown from fee structure
      const feeBreakdown: { feeName: string; feeAmount: number }[] = [];
      const fees = distributor.fee_structure;

      if (fees.pallet_cost) {
        feeBreakdown.push({ feeName: 'Pallet Cost', feeAmount: parseFloat(fees.pallet_cost) });
      }
      if (fees.warehouse_services) {
        feeBreakdown.push({
          feeName: 'Warehouse Services',
          feeAmount: parseFloat(fees.warehouse_services),
        });
      }
      if (fees.pallet_build) {
        feeBreakdown.push({ feeName: 'Pallet Build', feeAmount: parseFloat(fees.pallet_build) });
      }
      if (fees.floor_space_full_day) {
        feeBreakdown.push({
          feeName: 'Floor Space (Full Day)',
          feeAmount: parseFloat(fees.floor_space_full_day),
        });
      }
      if (fees.floor_space_half_day) {
        feeBreakdown.push({
          feeName: 'Floor Space (Half Day)',
          feeAmount: parseFloat(fees.floor_space_half_day),
        });
      }
      if (fees.truck_transfer_zone1) {
        feeBreakdown.push({
          feeName: 'Truck Transfer Zone 1',
          feeAmount: parseFloat(fees.truck_transfer_zone1),
        });
      }
      if (fees.truck_transfer_zone2) {
        feeBreakdown.push({
          feeName: 'Truck Transfer Zone 2',
          feeAmount: parseFloat(fees.truck_transfer_zone2),
        });
      }
      if (fees.custom_fees) {
        for (const [name, amount] of Object.entries(fees.custom_fees)) {
          feeBreakdown.push({ feeName: name, feeAmount: parseFloat(amount) });
        }
      }

      distributors.push({
        distributorId: distId,
        distributorName: distributor.name,
        totalCost: avgTotalCost.toNumber(),
        costPerUnit: avgCostPerUnit.toNumber(),
        marginImpact: avgMarginImpact.toNumber(),
        feeBreakdown,
      });
    }

    // Identify most and least cost-effective
    const sortedByCost = [...distributors].sort((a, b) => a.costPerUnit - b.costPerUnit);
    const mostCostEffective = sortedByCost[0]?.distributorId || '';
    const leastCostEffective = sortedByCost[sortedByCost.length - 1]?.distributorId || '';

    return {
      distributors,
      mostCostEffective,
      leastCostEffective,
    };
  } catch (error) {
    reportLogger.error('Failed to compare distributors', { error, companyId });
    throw new AppError(
      ErrorCode.UNKNOWN_ERROR,
      'Failed to compare distributors',
      { companyId, error }
    );
  }
}

// =============================================================================
// Trade Spend Summary
// =============================================================================

/**
 * Get trade spend summary
 *
 * Lists all sales promos with:
 * - Total trade spend by period
 * - Recommendation summary
 * - Margin impact
 *
 * @param companyId - Company ID
 * @param startDate - Start date (timestamp)
 * @param endDate - End date (timestamp)
 * @returns Trade spend summary
 */
export async function getTradeSpendSummary(
  companyId: string,
  startDate: number,
  endDate: number
): Promise<TradeSpendSummary> {
  try {
    reportLogger.info('Getting trade spend summary', { companyId, startDate, endDate });

    // Fetch promos for the period
    const promos = await db.cpgSalesPromos
      .where('company_id')
      .equals(companyId)
      .and(
        (promo) =>
          (!promo.promo_start_date || promo.promo_start_date <= endDate) &&
          (!promo.promo_end_date || promo.promo_end_date >= startDate) &&
          !promo.deleted_at
      )
      .toArray();

    let totalTradeSpend = new Decimal(0);
    let approvedCount = 0;
    let declinedCount = 0;
    let participateRecommendations = 0;
    let declineRecommendations = 0;
    let neutralRecommendations = 0;

    const promoData = promos.map((promo) => {
      const totalCost = new Decimal(promo.total_promo_cost);
      totalTradeSpend = totalTradeSpend.plus(totalCost);

      // Count status
      if (promo.status === 'approved') approvedCount++;
      if (promo.status === 'declined') declinedCount++;

      // Count recommendations
      if (promo.recommendation === 'participate') participateRecommendations++;
      if (promo.recommendation === 'decline') declineRecommendations++;
      if (promo.recommendation === 'neutral') neutralRecommendations++;

      // Calculate average margin impact
      let totalMarginImpact = new Decimal(0);
      let variantCount = 0;
      for (const result of Object.values(promo.variant_promo_results)) {
        const marginWith = new Decimal(result.net_profit_margin_with_promo);
        const marginWithout = new Decimal(result.net_profit_margin_without_promo);
        totalMarginImpact = totalMarginImpact.plus(marginWith.minus(marginWithout));
        variantCount++;
      }
      const avgMarginImpact = variantCount > 0 ? totalMarginImpact.dividedBy(variantCount).toNumber() : 0;

      return {
        promoId: promo.id,
        promoName: promo.promo_name,
        retailerName: promo.retailer_name,
        startDate: promo.promo_start_date,
        endDate: promo.promo_end_date,
        totalCost: totalCost.toNumber(),
        recommendation: promo.recommendation,
        status: promo.status,
        marginImpact: avgMarginImpact,
      };
    });

    return {
      totalTradeSpend: totalTradeSpend.toNumber(),
      promoCount: promos.length,
      approvedCount,
      declinedCount,
      participateRecommendations,
      declineRecommendations,
      neutralRecommendations,
      promos: promoData,
    };
  } catch (error) {
    reportLogger.error('Failed to get trade spend summary', { error, companyId });
    throw new AppError(
      ErrorCode.UNKNOWN_ERROR,
      'Failed to get trade spend summary',
      { companyId, error }
    );
  }
}

// =============================================================================
// Export to CSV
// =============================================================================

/**
 * Export report data to CSV format
 *
 * @param reportData - Array of report data objects
 * @param reportType - Type of report (for filename)
 * @returns CSV string
 */
export async function exportToCSV(reportData: any[], reportType: string): Promise<string> {
  try {
    if (reportData.length === 0) {
      return '';
    }

    // Get headers from first row
    const headers = Object.keys(reportData[0]);

    // Build CSV
    const csvRows: string[] = [];

    // Add header row
    csvRows.push(headers.join(','));

    // Add data rows
    for (const row of reportData) {
      const values = headers.map((header) => {
        const value = row[header];
        // Escape commas and quotes
        if (value === null || value === undefined) return '';
        const strValue = String(value);
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  } catch (error) {
    reportLogger.error('Failed to export to CSV', { error, reportType });
    throw new AppError(
      ErrorCode.UNKNOWN_ERROR,
      'Failed to export to CSV',
      { reportType, error }
    );
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determine margin quality based on percentage
 *
 * Default thresholds (user-configurable):
 * - Poor (Red): < 50%
 * - Good (Yellow): 50-60%
 * - Better (Light Green): 60-70%
 * - Best (Dark Green): 70%+
 */
function getMarginQuality(marginPercentage: number): MarginQuality {
  if (marginPercentage < 50) return 'poor';
  if (marginPercentage < 60) return 'good';
  if (marginPercentage < 70) return 'better';
  return 'best';
}
