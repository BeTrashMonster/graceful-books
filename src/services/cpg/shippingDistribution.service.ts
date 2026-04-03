/**
 * Shipping + Handling Distribution Service
 *
 * Calculates how S+H costs should be distributed across invoice line items
 * based on the selected distribution method (equal or weighted).
 */

import type { CPGInvoice } from '../../db/schema/cpg.schema';
import Decimal from 'decimal.js';

export type DistributionMethod = 'equal' | 'weighted';

export interface DistributionResult {
  /** Map of line item key to distributed amount */
  distribution: Record<string, string>;
  /** Total amount distributed (should match S+H total) */
  totalDistributed: string;
}

export class ShippingDistributionService {
  /**
   * Distributes S+H costs across invoice line items
   *
   * @param invoice - The invoice with line items
   * @param shLineKey - The key of the S+H line item to distribute
   * @param distributionMethod - How to distribute (equal or weighted)
   * @returns Distribution breakdown showing how much each line gets
   */
  static distributeShippingCost(
    invoice: CPGInvoice,
    shLineKey: string,
    distributionMethod: DistributionMethod
  ): DistributionResult {
    const costAttribution = invoice.cost_attribution;
    const shLine = costAttribution[shLineKey];

    if (!shLine) {
      throw new Error(`S+H line ${shLineKey} not found in invoice`);
    }

    // Calculate total S+H cost for this line
    const shTotal = new Decimal(shLine.units_purchased).times(shLine.unit_price);

    // Get all non-S+H line items (the lines that will receive distribution)
    const materialLines = Object.entries(costAttribution).filter(
      ([key, line]) => !line.distribution_method && key !== shLineKey
    );

    if (materialLines.length === 0) {
      // No material lines to distribute to
      return {
        distribution: {},
        totalDistributed: '0',
      };
    }

    const distribution: Record<string, string> = {};

    if (distributionMethod === 'equal') {
      // Equal split: divide evenly among line items
      const amountPerLine = shTotal.dividedBy(materialLines.length);

      materialLines.forEach(([key]) => {
        distribution[key] = amountPerLine.toFixed(6);
      });
    } else {
      // Weighted split: distribute based on line item value
      // First, calculate total value of all material lines
      let totalValue = new Decimal(0);

      materialLines.forEach(([, line]) => {
        const lineTotal = line.manual_line_total
          ? new Decimal(line.manual_line_total)
          : new Decimal(line.units_purchased).times(line.unit_price);
        totalValue = totalValue.plus(lineTotal);
      });

      if (totalValue.isZero()) {
        // All lines are $0, fall back to equal split
        const amountPerLine = shTotal.dividedBy(materialLines.length);
        materialLines.forEach(([key]) => {
          distribution[key] = amountPerLine.toFixed(6);
        });
      } else {
        // Distribute proportionally
        materialLines.forEach(([key, line]) => {
          const lineTotal = line.manual_line_total
            ? new Decimal(line.manual_line_total)
            : new Decimal(line.units_purchased).times(line.unit_price);
          const proportion = lineTotal.dividedBy(totalValue);
          const distributedAmount = shTotal.times(proportion);
          distribution[key] = distributedAmount.toFixed(6);
        });
      }
    }

    // Calculate total distributed (for verification)
    const totalDistributed = Object.values(distribution).reduce(
      (sum, amount) => sum.plus(amount),
      new Decimal(0)
    );

    return {
      distribution,
      totalDistributed: totalDistributed.toFixed(6),
    };
  }

  /**
   * Calculates the landed cost (material cost + distributed S+H) for a line item
   *
   * @param invoice - The invoice
   * @param lineKey - The line item key
   * @returns Object with original cost, distributed S+H, and total landed cost
   */
  static calculateLandedCost(
    invoice: CPGInvoice,
    lineKey: string
  ): {
    originalCost: string;
    distributedShipping: string;
    landedCost: string;
    landedCostPerUnit: string;
  } {
    const line = invoice.cost_attribution[lineKey];

    if (!line) {
      throw new Error(`Line ${lineKey} not found in invoice`);
    }

    // Calculate original line total (use manual override if present)
    const originalCost = line.manual_line_total
      ? new Decimal(line.manual_line_total)
      : new Decimal(line.units_purchased).times(line.unit_price);

    // Calculate total distributed S+H for this line
    let totalDistributedSH = new Decimal(0);

    // Find all S+H lines and calculate this line's share
    Object.entries(invoice.cost_attribution).forEach(([shLineKey, shLine]) => {
      if (shLine.distribution_method) {
        // This is an S+H line - calculate distribution
        const result = this.distributeShippingCost(
          invoice,
          shLineKey,
          shLine.distribution_method
        );

        if (result.distribution[lineKey]) {
          totalDistributedSH = totalDistributedSH.plus(result.distribution[lineKey]);
        }
      }
    });

    // Calculate landed cost
    const landedCost = originalCost.plus(totalDistributedSH);
    const landedCostPerUnit = landedCost.dividedBy(line.units_purchased);

    return {
      originalCost: originalCost.toFixed(6),
      distributedShipping: totalDistributedSH.toFixed(6),
      landedCost: landedCost.toFixed(6),
      landedCostPerUnit: landedCostPerUnit.toFixed(4),
    };
  }

  /**
   * Gets a summary of all S+H distributions on an invoice
   *
   * @param invoice - The invoice
   * @param categories - Optional array of categories to get names from
   * @returns Array of S+H line distributions
   */
  static getInvoiceShippingBreakdown(
    invoice: CPGInvoice,
    categories?: Array<{ id: string; name: string }>
  ): Array<{
    lineKey: string;
    lineName: string;
    shTotal: string;
    distributionMethod: DistributionMethod;
    breakdown: DistributionResult;
  }> {
    const breakdown: Array<{
      lineKey: string;
      lineName: string;
      shTotal: string;
      distributionMethod: DistributionMethod;
      breakdown: DistributionResult;
    }> = [];

    Object.entries(invoice.cost_attribution).forEach(([lineKey, line]) => {
      if (line.distribution_method) {
        // This is an S+H line
        const shTotal = new Decimal(line.units_purchased).times(line.unit_price);
        const distribution = this.distributeShippingCost(
          invoice,
          lineKey,
          line.distribution_method
        );

        // Use category name if available, otherwise use description or default
        let lineName = 'Shipping + Handling';
        if (categories) {
          const category = categories.find((c) => c.id === line.category_id);
          if (category) {
            lineName = category.name;
          }
        }
        if (line.description) {
          lineName = `${lineName} (${line.description})`;
        }

        breakdown.push({
          lineKey,
          lineName,
          shTotal: shTotal.toFixed(6),
          distributionMethod: line.distribution_method,
          breakdown: distribution,
        });
      }
    });

    return breakdown;
  }
}
