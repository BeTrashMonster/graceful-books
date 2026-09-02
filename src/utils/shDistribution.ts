/**
 * S+H (Shipping & Handling) Distribution Calculator
 *
 * Calculates how S+H costs should be distributed across line items
 * based on the distribution method (weighted/equal) and item filters.
 */

export interface LineItem {
  category_id: string;
  variant?: string;
  line_total?: string;
  unit_cost?: string;
  quantity?: string;
}

export interface Invoice {
  id: string;
  vendor_name?: string;
  items: LineItem[];
}

export interface SHDistributionSettings {
  amount: number;                    // The S+H amount to distribute
  distribution_method: 'weighted' | 'equal';
  items_filter: 'all' | 'categories';
  selected_categories?: string[];    // Category IDs when items_filter is 'categories'
  target_invoices?: string[];        // Invoice IDs to distribute across (empty = current invoice only)
  current_invoice_id: string;        // The invoice where S+H is entered
  excluded_category_ids?: string[];  // Category IDs to exclude (e.g., S+H categories themselves)
}

export interface DistributionResult {
  invoiceId: string;
  itemIndex: number;
  categoryId: string;
  variant?: string;
  itemTotal: number;
  distributedAmount: number;
  percentage: number;
}

export interface DistributionSummary {
  totalAmount: number;
  eligibleItemsCount: number;
  eligibleItemsTotal: number;
  distributions: DistributionResult[];
  method: 'weighted' | 'equal';
}

/**
 * Distribute an amount across items using the largest remainder method
 * This ensures the sum equals exactly the target amount (penny-perfect)
 */
function distributeWithLargestRemainder(
  items: Array<{ weight: number }>,
  totalAmount: number,
  totalWeight: number,
  isEqual: boolean
): number[] {
  if (items.length === 0) return [];

  // Convert to cents for precise integer math
  const totalCents = Math.round(totalAmount * 100);

  // Calculate raw amounts and remainders
  const rawAmounts = items.map((item, index) => {
    if (isEqual) {
      // Equal distribution
      return totalCents / items.length;
    } else {
      // Weighted distribution
      return totalWeight > 0 ? (item.weight / totalWeight) * totalCents : 0;
    }
  });

  // Floor each amount and track remainders
  const flooredAmounts = rawAmounts.map(a => Math.floor(a));
  const remainders = rawAmounts.map((raw, i) => ({
    index: i,
    remainder: raw - flooredAmounts[i]
  }));

  // Calculate how many cents we need to distribute
  const flooredTotal = flooredAmounts.reduce((a, b) => a + b, 0);
  let centsToDistribute = totalCents - flooredTotal;

  // Sort by remainder descending and give 1 cent to each until we've distributed all
  remainders.sort((a, b) => b.remainder - a.remainder);
  for (const item of remainders) {
    if (centsToDistribute <= 0) break;
    flooredAmounts[item.index]++;
    centsToDistribute--;
  }

  // Convert back to dollars
  return flooredAmounts.map(cents => cents / 100);
}

/**
 * Distribute percentages using largest remainder to ensure they sum to exactly 100%
 */
function distributePercentages(
  items: Array<{ weight: number }>,
  totalWeight: number,
  isEqual: boolean
): number[] {
  if (items.length === 0) return [];

  // Use 1000 for one decimal place precision (e.g., 33.3%)
  const totalTenths = 1000; // 100.0%

  // Calculate raw percentages
  const rawPercentages = items.map(item => {
    if (isEqual) {
      return totalTenths / items.length;
    } else {
      return totalWeight > 0 ? (item.weight / totalWeight) * totalTenths : 0;
    }
  });

  // Floor each and track remainders
  const flooredPercentages = rawPercentages.map(p => Math.floor(p));
  const remainders = rawPercentages.map((raw, i) => ({
    index: i,
    remainder: raw - flooredPercentages[i]
  }));

  // Distribute remaining tenths
  const flooredTotal = flooredPercentages.reduce((a, b) => a + b, 0);
  let tenthsToDistribute = totalTenths - flooredTotal;

  remainders.sort((a, b) => b.remainder - a.remainder);
  for (const item of remainders) {
    if (tenthsToDistribute <= 0) break;
    flooredPercentages[item.index]++;
    tenthsToDistribute--;
  }

  // Convert to percentage with 1 decimal
  return flooredPercentages.map(tenths => tenths / 10);
}

/**
 * Calculate how S+H should be distributed across eligible line items
 */
export function calculateSHDistribution(
  settings: SHDistributionSettings,
  allInvoices: Invoice[]
): DistributionSummary {
  const {
    amount,
    distribution_method,
    items_filter,
    selected_categories = [],
    target_invoices = [],
    current_invoice_id,
    excluded_category_ids = []
  } = settings;

  // Determine which invoices to include
  const invoiceIds = target_invoices.length > 0
    ? [current_invoice_id, ...target_invoices]
    : [current_invoice_id];

  // Get all eligible items across target invoices
  const eligibleItems: Array<{
    invoiceId: string;
    itemIndex: number;
    categoryId: string;
    variant?: string;
    itemTotal: number;
  }> = [];

  for (const invoice of allInvoices) {
    if (!invoiceIds.includes(invoice.id)) continue;

    invoice.items.forEach((item, index) => {
      // Skip S+H and personal items (they have special category IDs or flags)
      if (item.category_id === '__shipping__' || item.category_id === '__personal__') {
        return;
      }

      // Skip explicitly excluded categories (e.g., S+H distribution categories)
      if (excluded_category_ids.includes(item.category_id)) {
        return;
      }

      // Check if item matches the filter
      const matchesFilter = items_filter === 'all'
        || (items_filter === 'categories' && selected_categories.includes(item.category_id));

      if (!matchesFilter) return;

      // Calculate item total
      const itemTotal = parseFloat(item.line_total || '0') ||
        (parseFloat(item.quantity || '0') * parseFloat(item.unit_cost || '0'));

      if (itemTotal > 0) {
        eligibleItems.push({
          invoiceId: invoice.id,
          itemIndex: index,
          categoryId: item.category_id,
          variant: item.variant,
          itemTotal
        });
      }
    });
  }

  // Calculate total of all eligible items (for weighted distribution)
  const eligibleItemsTotal = eligibleItems.reduce((sum, item) => sum + item.itemTotal, 0);

  // Use largest remainder method for penny-perfect distribution
  const isEqual = distribution_method === 'equal';
  const itemsWithWeights = eligibleItems.map(item => ({ weight: item.itemTotal }));

  const distributedAmounts = distributeWithLargestRemainder(
    itemsWithWeights,
    amount,
    eligibleItemsTotal,
    isEqual
  );

  const percentages = distributePercentages(
    itemsWithWeights,
    eligibleItemsTotal,
    isEqual
  );

  // Build distribution results
  const distributions: DistributionResult[] = eligibleItems.map((item, index) => ({
    invoiceId: item.invoiceId,
    itemIndex: item.itemIndex,
    categoryId: item.categoryId,
    variant: item.variant,
    itemTotal: item.itemTotal,
    distributedAmount: distributedAmounts[index] || 0,
    percentage: percentages[index] || 0
  }));

  return {
    totalAmount: amount,
    eligibleItemsCount: eligibleItems.length,
    eligibleItemsTotal,
    distributions,
    method: distribution_method
  };
}

/**
 * Format a distribution result for display
 */
export function formatDistributionPreview(
  summary: DistributionSummary,
  getCategoryName: (categoryId: string) => string
): string[] {
  if (summary.eligibleItemsCount === 0) {
    return ['No eligible items to distribute to'];
  }

  return summary.distributions.map(dist => {
    const categoryName = getCategoryName(dist.categoryId) || 'Unknown';
    if (summary.method === 'weighted') {
      return `${categoryName}: $${dist.distributedAmount.toFixed(2)} (${dist.percentage.toFixed(1)}%)`;
    } else {
      return `${categoryName}: $${dist.distributedAmount.toFixed(2)}`;
    }
  });
}
