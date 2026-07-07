/**
 * Financial Web Data Service
 *
 * Aggregates CPG financial data for the force-directed graph visualization.
 * Shows where money flows through categories, distribution, and promos.
 */

import Decimal from 'decimal.js';
import type { TreasureChestDB } from '../../db/database';
import type { CPGCategory, CPGInvoice, CPGRecipe, CPGFinishedProduct } from '../../db/schema/cpg.schema';

// Configure Decimal.js for currency precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface CategoryNode {
  id: string;
  name: string;
  totalSpent: string; // Total $ spent on this category
  invoiceCount: number;
  type: 'category';
  isActive: boolean; // Always true for categories
  // For "Other Materials" node, contains breakdown of grouped categories
  groupedCategories?: Array<{
    id: string;
    name: string;
    totalSpent: string;
    invoiceCount: number;
  }>;
}

export interface OperationalNode {
  id: string;
  name: string;
  totalSpent: string;
  type: 'distribution' | 'promo' | 'events';
  isActive: boolean; // Based on whether feature is activated
  details?: {
    // Events breakdown
    eventCosts?: string;
    travelingCosts?: string;
    // Promos breakdown
    actualPayback?: string;
    // Shared fields
    paidLabor?: string;
    sweatEquity?: string;
  };
}

export type GraphNode = CategoryNode | OperationalNode;

export interface GraphConnection {
  source: string; // category ID
  target: string; // category ID
  productCount: number; // How many products use this combination
  products: Array<{
    id: string;
    name: string;
  }>;
}

export interface FinancialWebData {
  nodes: GraphNode[];
  connections: GraphConnection[];
  dateRange: {
    start: number;
    end: number;
  };
}

export class FinancialWebDataService {
  private userFeaturePrefs: Record<string, boolean> = {
    events: false,
    distribution: false,
    promos: false,
  };

  constructor(private db: TreasureChestDB) {}

  /**
   * Set user feature preferences for this service instance
   */
  setUserFeaturePrefs(prefs: Record<string, boolean>): void {
    console.log('🎯 Service receiving user feature prefs:', prefs);
    this.userFeaturePrefs = prefs;
  }

  /**
   * Get financial web data for the force-directed graph
   * @param maxCategories - Maximum number of category nodes to show (default 10, excludes S+H)
   */
  async getFinancialWebData(
    companyId: string,
    startDate: number,
    endDate: number,
    selectedProductIds?: string[],
    maxCategories: number = 10
  ): Promise<FinancialWebData> {
    // Get all active categories
    const categories = await this.db.cpgCategories
      .where('company_id')
      .equals(companyId)
      .and((cat) => cat.active && !cat.deleted_at)
      .toArray();

    // Get invoices in date range
    const invoices = await this.db.cpgInvoices
      .where('company_id')
      .equals(companyId)
      .and((inv) =>
        !inv.deleted_at &&
        inv.active &&
        inv.invoice_date >= startDate &&
        inv.invoice_date <= endDate
      )
      .toArray();

    console.log('📝 Invoices found in range:', {
      count: invoices.length,
      dateRange: {
        start: new Date(startDate).toLocaleDateString(),
        end: new Date(endDate).toLocaleDateString(),
      },
      invoices: invoices.map(inv => ({
        date: new Date(inv.invoice_date).toLocaleDateString(),
        vendor: inv.vendor_name,
        total: inv.total_paid,
        categories: Object.keys(inv.cost_attribution || {})
      }))
    });

    // Calculate category spending
    const categorySpending = this.calculateCategorySpending(categories, invoices);

    // Get top N categories (excludes S+H, creates "Other Materials" for remainder)
    const topCategories = this.getTopCategories(categorySpending, categories, maxCategories);

    // Build category nodes
    const categoryNodes: CategoryNode[] = topCategories.map(({ category, total, count, groupedCategories }) => ({
      id: category.id,
      name: category.name,
      totalSpent: total.toFixed(6),
      invoiceCount: count,
      type: 'category',
      isActive: true,
      // Include grouped categories for "Other Materials" tooltip
      ...(groupedCategories && { groupedCategories }),
    }));

    // Get distribution, promo, and events totals
    const distributionTotal = await this.getDistributionTotal(companyId, startDate, endDate);
    const promoTotal = await this.getPromoTotal(companyId, startDate, endDate);
    const eventsData = await this.getEventsTotal(companyId, startDate, endDate);

    console.log('💰 Operational totals calculated:', {
      distribution: distributionTotal.toFixed(6),
      promos: promoTotal.total.toFixed(6),
      promosDetails: {
        actualPayback: promoTotal.actualPayback.toFixed(6),
        paidLabor: promoTotal.paidLabor.toFixed(6),
        sweatEquity: promoTotal.sweatEquity.toFixed(6),
      },
      events: eventsData.total.toFixed(6),
      eventDetails: {
        eventCosts: eventsData.eventCosts.toFixed(6),
        traveling: eventsData.travelingCosts.toFixed(6),
        paidLabor: eventsData.paidLabor.toFixed(6),
        sweatEquity: eventsData.sweatEquity.toFixed(6),
      }
    });

    // Build operational nodes - ALWAYS create all three for progressive disclosure
    const operationalNodes: OperationalNode[] = [];

    // Distribution node - always present
    operationalNodes.push({
      id: 'distribution',
      name: 'Distribution',
      totalSpent: distributionTotal.toFixed(6),
      type: 'distribution',
      isActive: this.isFeatureActive('distribution'),
    });

    // Promos node - always present
    operationalNodes.push({
      id: 'promo',
      name: 'Promos',
      totalSpent: promoTotal.total.toFixed(6),
      type: 'promo',
      isActive: this.isFeatureActive('promo'),
      details: {
        actualPayback: promoTotal.actualPayback.toFixed(6),
        paidLabor: promoTotal.paidLabor.toFixed(6),
        sweatEquity: promoTotal.sweatEquity.toFixed(6),
      },
    });

    // Events node - always present
    operationalNodes.push({
      id: 'events',
      name: 'Events',
      totalSpent: eventsData.total.toFixed(6),
      type: 'events',
      isActive: this.isFeatureActive('events'),
      details: {
        eventCosts: eventsData.eventCosts.toFixed(6),
        travelingCosts: eventsData.travelingCosts.toFixed(6),
        paidLabor: eventsData.paidLabor.toFixed(6),
        sweatEquity: eventsData.sweatEquity.toFixed(6),
      },
    });

    // Get recipe connections
    const connections = await this.getRecipeConnections(
      companyId,
      topCategories.map(t => t.category.id),
      selectedProductIds
    );

    return {
      nodes: [...categoryNodes, ...operationalNodes],
      connections,
      dateRange: { start: startDate, end: endDate },
    };
  }

  /**
   * Calculate total spending per category from invoices
   */
  private calculateCategorySpending(
    categories: CPGCategory[],
    invoices: CPGInvoice[]
  ): Map<string, { total: Decimal; count: number }> {
    const spending = new Map<string, { total: Decimal; count: number }>();

    // Initialize all categories
    categories.forEach(cat => {
      spending.set(cat.id, { total: new Decimal(0), count: 0 });
    });

    // Sum up spending from invoices
    invoices.forEach(invoice => {
      if (!invoice.cost_attribution) return;

      Object.values(invoice.cost_attribution).forEach(attr => {
        const existing = spending.get(attr.category_id);
        if (existing) {
          const lineTotal = new Decimal(attr.units_purchased).times(attr.unit_price);
          existing.total = existing.total.plus(lineTotal);
          existing.count++;
        }
      });
    });

    return spending;
  }

  /**
   * Get top N categories by spending
   * - Excludes S+H categories from the count (they get their own node always)
   * - Creates "Other Materials" for categories beyond maxCategories
   * - Tracks which categories are grouped for hover tooltip display
   */
  private getTopCategories(
    spending: Map<string, { total: Decimal; count: number }>,
    categories: CPGCategory[],
    maxCategories: number = 10
  ): Array<{ category: CPGCategory; total: Decimal; count: number; groupedCategories?: Array<{ id: string; name: string; totalSpent: string; invoiceCount: number }> }> {
    // Separate S+H categories from regular categories
    const shCategories = categories.filter(cat => cat.is_distribution_category);
    const regularCategories = categories.filter(cat => !cat.is_distribution_category);

    // Build spending data for both groups
    const shWithSpending = shCategories.map(cat => ({
      category: cat,
      total: spending.get(cat.id)?.total || new Decimal(0),
      count: spending.get(cat.id)?.count || 0,
    }));

    const regularWithSpending = regularCategories
      .map(cat => ({
        category: cat,
        total: spending.get(cat.id)?.total || new Decimal(0),
        count: spending.get(cat.id)?.count || 0,
      }))
      .sort((a, b) => b.total.comparedTo(a.total)); // Descending by total

    // S+H always gets its own node(s)
    const result: Array<{ category: CPGCategory; total: Decimal; count: number; groupedCategories?: Array<{ id: string; name: string; totalSpent: string; invoiceCount: number }> }> = [];

    // Add all S+H categories first (they don't count toward maxCategories)
    shWithSpending.forEach(item => {
      if (item.total.greaterThan(0)) {
        result.push(item);
      }
    });

    // If maxCategories is 0 or negative, show all regular categories
    if (maxCategories <= 0) {
      result.push(...regularWithSpending);
      return result;
    }

    // If regular categories fit within limit, return all
    if (regularWithSpending.length <= maxCategories) {
      result.push(...regularWithSpending);
      return result;
    }

    // Take top (maxCategories - 1) to leave room for "Other Materials"
    const topN = regularWithSpending.slice(0, maxCategories - 1);
    result.push(...topN);

    // Sum the rest into "Other Materials"
    const others = regularWithSpending.slice(maxCategories - 1);
    const otherTotal = others.reduce(
      (sum, item) => sum.plus(item.total),
      new Decimal(0)
    );
    const otherCount = others.reduce((sum, item) => sum + item.count, 0);

    // Only create "Other Materials" if there's actually something in it
    if (others.length > 0 && otherTotal.greaterThan(0)) {
      // Create synthetic "Other" category with grouped categories info
      const otherCategory: CPGCategory = {
        id: '_other',
        company_id: categories[0]?.company_id || '',
        name: 'Other Materials',
        description: 'Accumulated smaller categories',
        variants: null,
        unit_of_measure: 'various',
        sort_order: 999,
        is_distribution_category: false,
        active: true,
        created_at: Date.now(),
        updated_at: Date.now(),
        deleted_at: null,
        version_vector: {},
      };

      // Track which categories are grouped for tooltip display
      const groupedCategories = others.map(item => ({
        id: item.category.id,
        name: item.category.name,
        totalSpent: item.total.toFixed(2),
        invoiceCount: item.count,
      }));

      result.push({
        category: otherCategory,
        total: otherTotal,
        count: otherCount,
        groupedCategories,
      });
    }

    return result;
  }

  /**
   * Get total distribution costs in date range
   */
  private async getDistributionTotal(
    companyId: string,
    startDate: number,
    endDate: number
  ): Promise<Decimal> {
    const calcs = await this.db.cpgDistributionCalculations
      .where('company_id')
      .equals(companyId)
      .and((calc) =>
        !calc.deleted_at &&
        calc.calculation_date >= startDate &&
        calc.calculation_date <= endDate
      )
      .toArray();

    return calcs.reduce(
      (sum, calc) => sum.plus(calc.total_distribution_cost || '0'),
      new Decimal(0)
    );
  }

  /**
   * Get total promo spend in date range
   * Only counts COMPLETED promos AFTER their end date (when costs are actually paid)
   * Returns breakdown of actual payback, paid labor, and sweat equity
   */
  private async getPromoTotal(
    companyId: string,
    startDate: number,
    endDate: number
  ): Promise<{
    total: Decimal;
    actualPayback: Decimal;
    paidLabor: Decimal;
    sweatEquity: Decimal;
  }> {
    const now = Date.now();
    const promos = await this.db.cpgSalesPromos
      .where('company_id')
      .equals(companyId)
      .and((promo) =>
        !promo.deleted_at &&
        promo.status === 'completed' &&  // Only completed promos
        promo.promo_end_date &&  // Must have end date
        promo.promo_end_date <= now &&  // End date must have passed
        promo.promo_end_date >= startDate &&  // End date in range
        promo.promo_end_date <= endDate
      )
      .toArray();

    let actualPayback = new Decimal(0);
    let paidLabor = new Decimal(0);
    let sweatEquity = new Decimal(0);

    promos.forEach((promo) => {
      // Use actual costs (not projected)
      actualPayback = actualPayback.plus(promo.actual_payback || '0');
      paidLabor = paidLabor.plus(promo.total_actual_labor_cost || '0');
      sweatEquity = sweatEquity.plus(promo.total_opportunity_cost || '0');
    });

    // Total = actual payback + paid labor (NOT sweat equity)
    const total = actualPayback.plus(paidLabor);

    return {
      total,
      actualPayback,
      paidLabor,
      sweatEquity,
    };
  }

  /**
   * Get total events costs in date range
   * Returns breakdown of event costs, traveling, paid labor, and sweat equity
   */
  private async getEventsTotal(
    companyId: string,
    startDate: number,
    endDate: number
  ): Promise<{
    total: Decimal;
    eventCosts: Decimal;
    travelingCosts: Decimal;
    paidLabor: Decimal;
    sweatEquity: Decimal;
  }> {
    const events = await this.db.cpgEvents
      .where('company_id')
      .equals(companyId)
      .and((event) =>
        !event.deleted_at &&
        // Include events that OVERLAP with the date range (not just fully contained)
        event.event_start_date <= endDate &&
        event.event_end_date >= startDate
      )
      .toArray();

    console.log('📅 Events found in date range:', {
      count: events.length,
      dateRange: {
        start: new Date(startDate).toLocaleDateString(),
        end: new Date(endDate).toLocaleDateString(),
      },
      events: events.map(e => ({
        name: e.event_name,
        start: new Date(e.event_start_date).toLocaleDateString(),
        end: new Date(e.event_end_date).toLocaleDateString(),
        eventCost: e.event_cost,
        traveling: e.traveling_fees,
        labor: e.total_actual_labor_cost,
      }))
    });

    let eventCosts = new Decimal(0);
    let travelingCosts = new Decimal(0);
    let paidLabor = new Decimal(0);
    let sweatEquity = new Decimal(0);

    events.forEach((event) => {
      // Add event costs
      eventCosts = eventCosts.plus(event.event_cost || '0');

      // Add traveling costs
      if (event.traveling_fees) {
        travelingCosts = travelingCosts.plus(event.traveling_fees);
      }

      // Add paid labor (actual) and sweat equity (opportunity cost)
      if (event.total_actual_labor_cost) {
        paidLabor = paidLabor.plus(event.total_actual_labor_cost);
      }
      if (event.total_opportunity_cost) {
        sweatEquity = sweatEquity.plus(event.total_opportunity_cost);
      }
    });

    // Total = event costs + traveling + paid labor (NOT sweat equity)
    const total = eventCosts.plus(travelingCosts).plus(paidLabor);

    return {
      total,
      eventCosts,
      travelingCosts,
      paidLabor,
      sweatEquity,
    };
  }

  /**
   * Get recipe connections between categories
   * Shows which categories appear together in product recipes
   */
  private async getRecipeConnections(
    companyId: string,
    categoryIds: string[],
    selectedProductIds?: string[]
  ): Promise<GraphConnection[]> {
    // Get all active products (or filtered to selected products)
    let products: CPGFinishedProduct[];
    if (selectedProductIds && selectedProductIds.length > 0) {
      // Get specific selected products
      const productPromises = selectedProductIds.map(id =>
        this.db.cpgFinishedProducts.get(id)
      );
      const fetchedProducts = await Promise.all(productPromises);
      products = fetchedProducts.filter((p): p is CPGFinishedProduct => p !== undefined);
    } else {
      // Get all active products
      products = await this.db.cpgFinishedProducts
        .where('company_id')
        .equals(companyId)
        .and((p) => p.active && !p.deleted_at && !p.is_bundle) // Exclude bundles
        .toArray();
    }

    // Get all recipes for these products
    const recipePromises = products.map(product =>
      this.db.cpgRecipes
        .where('[company_id+finished_product_id]')
        .equals([companyId, product.id])
        .and((r) => !r.deleted_at && r.active)
        .toArray()
    );

    const allRecipes = await Promise.all(recipePromises);

    // Build connections
    const connectionMap = new Map<string, GraphConnection>();

    products.forEach((product, index) => {
      const recipes = allRecipes[index] || [];
      const productCategories = recipes
        .map(r => r.category_id)
        .filter(catId => categoryIds.includes(catId));

      // Create connections between all pairs of categories in this product
      for (let i = 0; i < productCategories.length; i++) {
        for (let j = i + 1; j < productCategories.length; j++) {
          const cat1 = productCategories[i];
          const cat2 = productCategories[j];

          // Create consistent connection key (alphabetical order)
          const connectionKey = [cat1, cat2].sort().join('→');

          if (!connectionMap.has(connectionKey)) {
            connectionMap.set(connectionKey, {
              source: cat1!,
              target: cat2!,
              productCount: 0,
              products: [],
            });
          }

          const connection = connectionMap.get(connectionKey)!;
          connection.productCount++;
          connection.products.push({
            id: product.id,
            name: product.name,
          });
        }
      }
    });

    return Array.from(connectionMap.values());
  }

  /**
   * Check if a feature is activated based on user preferences
   */
  private isFeatureActive(feature: 'distribution' | 'promo' | 'events'): boolean {
    // Map 'promo' to 'promos' for preference lookup
    const featureName = feature === 'promo' ? 'promos' : feature;
    const isActive = this.userFeaturePrefs[featureName] ?? false;
    console.log(`🔍 Checking if ${feature} is active: ${isActive} (prefs:`, this.userFeaturePrefs, ')');
    return isActive;
  }
}

/**
 * Create a new financial web data service instance
 */
export function createFinancialWebDataService(db: TreasureChestDB): FinancialWebDataService {
  return new FinancialWebDataService(db);
}
