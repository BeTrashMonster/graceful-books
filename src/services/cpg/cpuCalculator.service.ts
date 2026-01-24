/**
 * CPU Calculator Service
 *
 * Implements Group B1: CPU Calculator Service for CPG Module
 *
 * Features:
 * - Create/update/delete CPG invoices with flexible cost attribution
 * - Calculate CPU (Cost Per Unit) with support for any number of user-defined variants
 * - Handle reconciliation (units purchased vs. units received)
 * - Allocate additional costs (shipping, printing, embossing, foil) per user instructions
 * - Track historical CPU changes over time
 * - Use Decimal.js for all financial calculations (prevent rounding errors)
 *
 * Formula:
 * True Unit Cost = (Cost for Category + User-Allocated Additional Costs) / Units Received
 *
 * Requirements:
 * - CPG_MODULE_ROADMAP.md Group B1
 * - AGENT_REVIEW_PROD_CHECKLIST.md
 * - Flexible variants (not hardcoded Small/Large)
 * - Line-by-line invoice entry with cost attribution
 * - User-controlled cost allocation during entry
 */

import Decimal from 'decimal.js';
import { nanoid } from 'nanoid';
import Database from '../../db/database';
import type {
  CPGInvoice,
} from '../../db/schema/cpg.schema';
import {
  validateCPGInvoice,
} from '../../db/schema/cpg.schema';
import { logger } from '../../utils/logger';

// Configure Decimal.js for currency precision (2 decimal places for currency)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const serviceLogger = logger.child('CPUCalculatorService');

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Parameters for creating a new CPG invoice
 */
export interface CreateInvoiceParams {
  company_id: string;
  invoice_number?: string;
  invoice_date: number;
  vendor_name?: string;
  notes?: string;
  cost_attribution: Record<
    string,
    {
      category_id: string;
      variant: string | null;
      units_purchased: string;
      unit_price: string;
      units_received?: string; // Optional - defaults to units_purchased
    }
  >;
  additional_costs?: Record<string, string>; // e.g., { "Shipping": "50.00", "Screen Printing": "75.00" }
  device_id: string;
}

/**
 * Parameters for updating an existing CPG invoice
 */
export interface UpdateInvoiceParams {
  invoice_id: string;
  company_id: string;
  invoice_number?: string;
  invoice_date?: number;
  vendor_name?: string;
  notes?: string;
  cost_attribution?: Record<
    string,
    {
      category_id: string;
      variant: string | null;
      units_purchased: string;
      unit_price: string;
      units_received?: string;
    }
  >;
  additional_costs?: Record<string, string>;
  device_id: string;
}

/**
 * Result of CPU calculation for a single invoice
 */
export interface CPUCalculationResult {
  invoice_id: string;
  invoice_date: number;
  vendor_name: string | null;
  categories: {
    category_id: string;
    category_name: string;
    variant: string | null;
    units_purchased: string;
    units_received: string;
    unit_price: string;
    direct_cost: string; // units_purchased × unit_price
    allocated_additional_costs: string; // Share of additional costs
    total_cost: string; // direct_cost + allocated_additional_costs
    cpu: string; // total_cost / units_received
  }[];
  total_paid: string;
  additional_costs: Record<string, string> | null;
  calculated_cpus: Record<string, string>; // variant → CPU
}

/**
 * Historical CPU data point
 */
export interface CPUHistoryEntry {
  invoice_id: string;
  invoice_date: number;
  invoice_number: string | null;
  vendor_name: string | null;
  variant: string | null;
  cpu: string;
  units_received: string;
}

/**
 * CPU trend over time for a specific variant
 */
export interface CPUTrend {
  variant: string | null;
  category_id?: string;
  start_date: number;
  end_date: number;
  data_points: {
    date: number;
    cpu: string;
    invoice_id: string;
  }[];
  average_cpu: string;
  min_cpu: string;
  max_cpu: string;
  trend_direction: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Snapshot of all CPUs at a point in time
 */
export interface CPUHistorySnapshot {
  company_id: string;
  snapshot_date: number;
  cpus_by_variant: Record<string, string>; // variant → CPU
  total_invoices_processed: number;
}

// ============================================================================
// CPU Calculator Service
// ============================================================================

export class CPUCalculatorService {
  private db: typeof Database;

  constructor(database?: typeof Database) {
    this.db = database || Database;
  }

  /**
   * Create a new CPG invoice with cost attribution and calculate CPU
   *
   * Formula: CPU = (Direct Cost + Allocated Additional Costs) / Units Received
   *
   * @param params Invoice creation parameters
   * @returns Created invoice with calculated CPUs
   * @example
   * const invoice = await service.createInvoice({
   *   company_id: 'comp-123',
   *   invoice_date: Date.now(),
   *   vendor_name: 'Olive Oil Supplier',
   *   cost_attribution: {
   *     'Oil_8oz': {
   *       category_id: 'cat-oil',
   *       variant: '8oz',
   *       units_purchased: '100',
   *       unit_price: '2.50',
   *       units_received: '98' // 2 units damaged
   *     }
   *   },
   *   additional_costs: { 'Shipping': '50.00' },
   *   device_id: 'device-1'
   * });
   */
  async createInvoice(params: CreateInvoiceParams): Promise<CPGInvoice> {
    try {
      serviceLogger.info('Creating CPG invoice', { company_id: params.company_id });

      // Validate required fields
      if (!params.company_id) {
        throw new Error('company_id is required');
      }
      if (!params.invoice_date) {
        throw new Error('invoice_date is required');
      }
      if (!params.device_id) {
        throw new Error('device_id is required');
      }
      if (!params.cost_attribution || Object.keys(params.cost_attribution).length === 0) {
        throw new Error('cost_attribution is required and must have at least one entry');
      }

      // Normalize cost attribution (set units_received = units_purchased if not provided)
      const normalizedAttribution: CPGInvoice['cost_attribution'] = {};
      for (const [key, attr] of Object.entries(params.cost_attribution)) {
        normalizedAttribution[key] = {
          category_id: attr.category_id,
          variant: attr.variant,
          units_purchased: attr.units_purchased,
          unit_price: attr.unit_price,
          units_received: attr.units_received || attr.units_purchased,
        };
      }

      // Calculate total paid and CPUs
      const { totalPaid, calculatedCPUs } = this.calculateInvoiceCPUs(
        normalizedAttribution,
        params.additional_costs || null
      );

      // Create invoice entity
      const invoiceId = nanoid();
      const now = Date.now();

      const invoice: CPGInvoice = {
        id: invoiceId,
        company_id: params.company_id,
        invoice_number: params.invoice_number || null,
        invoice_date: params.invoice_date,
        vendor_name: params.vendor_name || null,
        notes: params.notes || null,
        cost_attribution: normalizedAttribution,
        additional_costs: params.additional_costs || null,
        total_paid: totalPaid,
        calculated_cpus: calculatedCPUs,
        active: true,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version_vector: { [params.device_id]: 1 },
      };

      // Validate invoice
      const validationErrors = validateCPGInvoice(invoice);
      if (validationErrors.length > 0) {
        throw new Error(`Invoice validation failed: ${validationErrors.join(', ')}`);
      }

      // Save to database
      await this.db.cpgInvoices.add(invoice);

      serviceLogger.info('CPG invoice created successfully', {
        invoice_id: invoiceId,
        total_paid: totalPaid,
        variants: Object.keys(calculatedCPUs),
      });

      return invoice;
    } catch (error) {
      serviceLogger.error('Failed to create CPG invoice', { error });
      throw error;
    }
  }

  /**
   * Update an existing CPG invoice and recalculate CPUs
   *
   * @param params Update parameters
   * @returns Updated invoice with recalculated CPUs
   */
  async updateInvoice(params: UpdateInvoiceParams): Promise<CPGInvoice> {
    try {
      serviceLogger.info('Updating CPG invoice', { invoice_id: params.invoice_id });

      // Fetch existing invoice
      const existing = await this.db.cpgInvoices.get(params.invoice_id);
      if (!existing) {
        throw new Error(`Invoice not found: ${params.invoice_id}`);
      }

      // Verify company ownership
      if (existing.company_id !== params.company_id) {
        throw new Error('Invoice does not belong to this company');
      }

      // Check if deleted
      if (existing.deleted_at !== null) {
        throw new Error('Cannot update deleted invoice');
      }

      // Build updated invoice
      const costAttribution = params.cost_attribution
        ? this.normalizeCostAttribution(params.cost_attribution)
        : existing.cost_attribution;

      const additionalCosts = params.additional_costs !== undefined
        ? params.additional_costs
        : existing.additional_costs;

      // Recalculate totals
      const { totalPaid, calculatedCPUs } = this.calculateInvoiceCPUs(
        costAttribution,
        additionalCosts
      );

      // Update version vector
      const newVersionVector = { ...existing.version_vector };
      newVersionVector[params.device_id] = (newVersionVector[params.device_id] || 0) + 1;

      // Apply updates
      const updates: Partial<CPGInvoice> = {
        invoice_number: params.invoice_number !== undefined
          ? params.invoice_number
          : existing.invoice_number,
        invoice_date: params.invoice_date || existing.invoice_date,
        vendor_name: params.vendor_name !== undefined
          ? params.vendor_name
          : existing.vendor_name,
        notes: params.notes !== undefined ? params.notes : existing.notes,
        cost_attribution: costAttribution,
        additional_costs: additionalCosts,
        total_paid: totalPaid,
        calculated_cpus: calculatedCPUs,
        updated_at: Date.now(),
        version_vector: newVersionVector,
      };

      await this.db.cpgInvoices.update(params.invoice_id, updates);

      const updatedInvoice = await this.db.cpgInvoices.get(params.invoice_id);
      if (!updatedInvoice) {
        throw new Error('Failed to retrieve updated invoice');
      }

      serviceLogger.info('CPG invoice updated successfully', {
        invoice_id: params.invoice_id,
        total_paid: totalPaid,
      });

      return updatedInvoice;
    } catch (error) {
      serviceLogger.error('Failed to update CPG invoice', { error });
      throw error;
    }
  }

  /**
   * Delete (soft delete) a CPG invoice
   *
   * @param invoice_id Invoice ID to delete
   * @param company_id Company ID for ownership verification
   * @param device_id Device ID for version tracking
   */
  async deleteInvoice(
    invoice_id: string,
    company_id: string,
    device_id: string
  ): Promise<void> {
    try {
      serviceLogger.info('Deleting CPG invoice', { invoice_id });

      const invoice = await this.db.cpgInvoices.get(invoice_id);
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoice_id}`);
      }

      if (invoice.company_id !== company_id) {
        throw new Error('Invoice does not belong to this company');
      }

      if (invoice.deleted_at !== null) {
        throw new Error('Invoice already deleted');
      }

      // Update version vector
      const newVersionVector = { ...invoice.version_vector };
      newVersionVector[device_id] = (newVersionVector[device_id] || 0) + 1;

      // Soft delete
      await this.db.cpgInvoices.update(invoice_id, {
        deleted_at: Date.now(),
        active: false,
        updated_at: Date.now(),
        version_vector: newVersionVector,
      });

      serviceLogger.info('CPG invoice deleted successfully', { invoice_id });
    } catch (error) {
      serviceLogger.error('Failed to delete CPG invoice', { error });
      throw error;
    }
  }

  /**
   * Calculate CPU for a specific invoice
   *
   * @param invoice_id Invoice ID
   * @returns CPU calculation result with breakdown
   */
  async calculateCPU(invoice_id: string): Promise<CPUCalculationResult> {
    try {
      const invoice = await this.db.cpgInvoices.get(invoice_id);
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoice_id}`);
      }

      if (invoice.deleted_at !== null) {
        throw new Error('Cannot calculate CPU for deleted invoice');
      }

      // Fetch category names
      const categoryIds = new Set(
        Object.values(invoice.cost_attribution).map((attr) => attr.category_id)
      );
      const categoryIdsArray = Array.from(categoryIds);
      const categories = await this.db.cpgCategories
        .where('id')
        .anyOf(categoryIdsArray)
        .toArray();

      const categoryMap = new Map(categories.map((cat) => [cat.id, cat.name]));

      // Build detailed result
      const categoryBreakdown = await this.buildCategoryBreakdown(
        invoice.cost_attribution,
        invoice.additional_costs,
        categoryMap
      );

      const result: CPUCalculationResult = {
        invoice_id: invoice.id,
        invoice_date: invoice.invoice_date,
        vendor_name: invoice.vendor_name,
        categories: categoryBreakdown,
        total_paid: invoice.total_paid,
        additional_costs: invoice.additional_costs,
        calculated_cpus: invoice.calculated_cpus || {},
      };

      return result;
    } catch (error) {
      serviceLogger.error('Failed to calculate CPU', { error });
      throw error;
    }
  }

  /**
   * Recalculate all CPUs for a company (useful after data migration or corrections)
   *
   * @param company_id Company ID
   * @returns Snapshot of all current CPUs
   */
  async recalculateAllCPUs(company_id: string): Promise<CPUHistorySnapshot> {
    try {
      serviceLogger.info('Recalculating all CPUs', { company_id });

      const invoices = await this.db.cpgInvoices
        .where('company_id')
        .equals(company_id)
        .and((inv) => inv.active && inv.deleted_at === null)
        .toArray();

      let totalInvoices = 0;
      const latestCPUs: Record<string, string> = {};

      // Sort by date (latest first)
      invoices.sort((a, b) => b.invoice_date - a.invoice_date);

      // Process each invoice
      for (const invoice of invoices) {
        if (invoice.calculated_cpus) {
          for (const [variant, cpu] of Object.entries(invoice.calculated_cpus)) {
            // Only update if not already set (since we sorted by latest first)
            if (!latestCPUs[variant]) {
              latestCPUs[variant] = cpu;
            }
          }
        }
        totalInvoices++;
      }

      const snapshot: CPUHistorySnapshot = {
        company_id,
        snapshot_date: Date.now(),
        cpus_by_variant: latestCPUs,
        total_invoices_processed: totalInvoices,
      };

      serviceLogger.info('All CPUs recalculated', {
        company_id,
        total_invoices: totalInvoices,
        variants: Object.keys(latestCPUs).length,
      });

      return snapshot;
    } catch (error) {
      serviceLogger.error('Failed to recalculate all CPUs', { error });
      throw error;
    }
  }

  /**
   * Get CPU history for a company (optionally filtered by category)
   *
   * @param company_id Company ID
   * @param category_id Optional category ID to filter
   * @returns Array of historical CPU entries
   */
  async getCPUHistory(
    company_id: string,
    category_id?: string
  ): Promise<CPUHistoryEntry[]> {
    try {
      let invoices = await this.db.cpgInvoices
        .where('[company_id+invoice_date]')
        .between([company_id, 0], [company_id, Date.now() + 1])
        .and((inv) => inv.deleted_at === null && inv.active)
        .reverse()
        .toArray();

      // Filter by category if specified
      if (category_id) {
        invoices = invoices.filter((inv) =>
          Object.values(inv.cost_attribution).some((attr) => attr.category_id === category_id)
        );
      }

      const history: CPUHistoryEntry[] = [];

      for (const invoice of invoices) {
        if (!invoice.calculated_cpus) continue;

        for (const [variant, cpu] of Object.entries(invoice.calculated_cpus)) {
          // Find units received for this variant
          const attribution = Object.values(invoice.cost_attribution).find(
            (attr) => (attr.variant || 'none') === (variant || 'none')
          );

          history.push({
            invoice_id: invoice.id,
            invoice_date: invoice.invoice_date,
            invoice_number: invoice.invoice_number,
            vendor_name: invoice.vendor_name,
            variant: variant === 'none' ? null : variant,
            cpu,
            units_received: attribution?.units_received || '0',
          });
        }
      }

      return history;
    } catch (error) {
      serviceLogger.error('Failed to get CPU history', { error });
      throw error;
    }
  }

  /**
   * Get CPU trend over a date range
   *
   * @param company_id Company ID
   * @param start_date Start date (timestamp)
   * @param end_date End date (timestamp)
   * @param variant Optional variant to filter (null for no variant)
   * @returns CPU trend analysis
   */
  async getCPUTrend(
    company_id: string,
    start_date: number,
    end_date: number,
    variant?: string | null
  ): Promise<CPUTrend> {
    try {
      const invoices = await this.db.cpgInvoices
        .where('[company_id+invoice_date]')
        .between([company_id, start_date], [company_id, end_date + 1], false)
        .and((inv) => inv.deleted_at === null && inv.active)
        .sortBy('invoice_date');

      const dataPoints: { date: number; cpu: string; invoice_id: string }[] = [];

      for (const invoice of invoices) {
        if (!invoice.calculated_cpus) continue;

        const variantKey = variant || 'none';
        const cpu = invoice.calculated_cpus[variantKey];

        if (cpu) {
          dataPoints.push({
            date: invoice.invoice_date,
            cpu,
            invoice_id: invoice.id,
          });
        }
      }

      // Calculate statistics
      const cpuValues = dataPoints.map((dp) => new Decimal(dp.cpu));
      const avgCPU = cpuValues.length > 0
        ? cpuValues.reduce((sum, val) => sum.plus(val), new Decimal(0))
            .dividedBy(cpuValues.length)
            .toFixed(2)
        : '0.00';

      const minCPU = cpuValues.length > 0
        ? Decimal.min(...cpuValues).toFixed(2)
        : '0.00';

      const maxCPU = cpuValues.length > 0
        ? Decimal.max(...cpuValues).toFixed(2)
        : '0.00';

      // Determine trend direction (compare first half to second half)
      let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (dataPoints.length >= 2) {
        const midPoint = Math.floor(dataPoints.length / 2);
        const firstHalf = dataPoints.slice(0, midPoint);
        const secondHalf = dataPoints.slice(midPoint);

        const firstAvg = firstHalf
          .reduce((sum, dp) => sum.plus(new Decimal(dp.cpu)), new Decimal(0))
          .dividedBy(firstHalf.length);

        const secondAvg = secondHalf
          .reduce((sum, dp) => sum.plus(new Decimal(dp.cpu)), new Decimal(0))
          .dividedBy(secondHalf.length);

        const change = secondAvg.minus(firstAvg);
        // Use smaller threshold for trend detection (0.01 instead of 0.05)
        if (change.greaterThan(0.01)) {
          trendDirection = 'increasing';
        } else if (change.lessThan(-0.01)) {
          trendDirection = 'decreasing';
        }
      }

      return {
        variant: variant === undefined || variant === 'none' ? null : variant,
        start_date,
        end_date,
        data_points: dataPoints,
        average_cpu: avgCPU,
        min_cpu: minCPU,
        max_cpu: maxCPU,
        trend_direction: trendDirection,
      };
    } catch (error) {
      serviceLogger.error('Failed to get CPU trend', { error });
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Normalize cost attribution to ensure units_received is always set
   */
  private normalizeCostAttribution(
    attribution: Record<
      string,
      {
        category_id: string;
        variant: string | null;
        units_purchased: string;
        unit_price: string;
        units_received?: string;
      }
    >
  ): CPGInvoice['cost_attribution'] {
    const normalized: CPGInvoice['cost_attribution'] = {};
    for (const [key, attr] of Object.entries(attribution)) {
      normalized[key] = {
        category_id: attr.category_id,
        variant: attr.variant,
        units_purchased: attr.units_purchased,
        unit_price: attr.unit_price,
        units_received: attr.units_received || attr.units_purchased,
      };
    }
    return normalized;
  }

  /**
   * Calculate total paid and CPUs for an invoice
   *
   * Formula: CPU = (Direct Cost + Allocated Additional Costs) / Units Received
   *
   * Additional costs are allocated proportionally based on direct costs
   */
  private calculateInvoiceCPUs(
    costAttribution: CPGInvoice['cost_attribution'],
    additionalCosts: Record<string, string> | null
  ): { totalPaid: string; calculatedCPUs: Record<string, string> } {
    // Calculate direct costs per variant
    const variantCosts = new Map<string, Decimal>();
    const variantUnitsReceived = new Map<string, Decimal>();

    for (const [_key, attr] of Object.entries(costAttribution)) {
      const directCost = new Decimal(attr.units_purchased).times(new Decimal(attr.unit_price));
      const variantKey = attr.variant || 'none';

      variantCosts.set(variantKey, (variantCosts.get(variantKey) || new Decimal(0)).plus(directCost));
      variantUnitsReceived.set(
        variantKey,
        (variantUnitsReceived.get(variantKey) || new Decimal(0)).plus(
          new Decimal(attr.units_received || attr.units_purchased)
        )
      );
    }

    // Calculate total direct costs
    let totalDirectCosts = new Decimal(0);
    const variantCostsValuesArray = Array.from(variantCosts.values());
    for (const cost of variantCostsValuesArray) {
      totalDirectCosts = totalDirectCosts.plus(cost);
    }

    // Calculate total additional costs
    let totalAdditionalCosts = new Decimal(0);
    if (additionalCosts) {
      for (const cost of Object.values(additionalCosts)) {
        totalAdditionalCosts = totalAdditionalCosts.plus(new Decimal(cost));
      }
    }

    // Total paid = direct costs + additional costs
    const totalPaid = totalDirectCosts.plus(totalAdditionalCosts).toFixed(2);

    // Allocate additional costs proportionally to each variant
    const calculatedCPUs: Record<string, string> = {};

    const variantCostsEntriesArray = Array.from(variantCosts.entries());
    for (const [variant, directCost] of variantCostsEntriesArray) {
      const unitsReceived = variantUnitsReceived.get(variant) || new Decimal(1);

      // Proportional share of additional costs
      let allocatedAdditionalCost = new Decimal(0);
      if (totalDirectCosts.greaterThan(0)) {
        allocatedAdditionalCost = totalAdditionalCosts
          .times(directCost)
          .dividedBy(totalDirectCosts);
      }

      // Total cost for this variant
      const totalCost = directCost.plus(allocatedAdditionalCost);

      // CPU = total cost / units received
      const cpu = totalCost.dividedBy(unitsReceived);

      calculatedCPUs[variant] = cpu.toFixed(2);
    }

    return { totalPaid, calculatedCPUs };
  }

  /**
   * Build detailed category breakdown for CPU calculation result
   */
  private async buildCategoryBreakdown(
    costAttribution: CPGInvoice['cost_attribution'],
    additionalCosts: Record<string, string> | null,
    categoryMap: Map<string, string>
  ): Promise<CPUCalculationResult['categories']> {
    const breakdown: CPUCalculationResult['categories'] = [];

    // Calculate total direct costs for proportional allocation
    let totalDirectCosts = new Decimal(0);
    for (const attr of Object.values(costAttribution)) {
      const directCost = new Decimal(attr.units_purchased).times(new Decimal(attr.unit_price));
      totalDirectCosts = totalDirectCosts.plus(directCost);
    }

    // Calculate total additional costs
    let totalAdditionalCosts = new Decimal(0);
    if (additionalCosts) {
      for (const cost of Object.values(additionalCosts)) {
        totalAdditionalCosts = totalAdditionalCosts.plus(new Decimal(cost));
      }
    }

    // Build breakdown for each attribution
    for (const [_key, attr] of Object.entries(costAttribution)) {
      const directCost = new Decimal(attr.units_purchased).times(new Decimal(attr.unit_price));

      // Proportional share of additional costs
      let allocatedAdditionalCost = new Decimal(0);
      if (totalDirectCosts.greaterThan(0)) {
        allocatedAdditionalCost = totalAdditionalCosts.times(directCost).dividedBy(totalDirectCosts);
      }

      const totalCost = directCost.plus(allocatedAdditionalCost);
      const unitsReceived = new Decimal(attr.units_received || attr.units_purchased);
      const cpu = totalCost.dividedBy(unitsReceived);

      breakdown.push({
        category_id: attr.category_id,
        category_name: categoryMap.get(attr.category_id) || 'Unknown',
        variant: attr.variant,
        units_purchased: attr.units_purchased,
        units_received: attr.units_received || attr.units_purchased,
        unit_price: attr.unit_price,
        direct_cost: directCost.toFixed(2),
        allocated_additional_costs: allocatedAdditionalCost.toFixed(2),
        total_cost: totalCost.toFixed(2),
        cpu: cpu.toFixed(2),
      });
    }

    return breakdown;
  }
}

// Export singleton instance
export const cpuCalculatorService = new CPUCalculatorService();
