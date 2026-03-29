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
}

export interface OperationalNode {
  id: string;
  name: string;
  totalSpent: string;
  type: 'distribution' | 'promo' | 'events';
  isActive: boolean; // Based on whether feature is activated
  details?: {
    eventCosts?: string;
    travelingCosts?: string;
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
    this.userFeaturePrefs = prefs;
  }

  /**
   * Get financial web data for the force-directed graph
   */
  async getFinancialWebData(
    companyId: string,
    startDate: number,
    endDate: number,
    selectedProductIds?: string[]
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

    // Get top 9 categories (or all if < 11)
    const topCategories = this.getTopCategories(categorySpending, categories);

    // Build category nodes
    const categoryNodes: CategoryNode[] = topCategories.map(({ category, total, count }) => ({
      id: category.id,
      name: category.name,
      totalSpent: total.toFixed(2),
      invoiceCount: count,
      type: 'category',
      isActive: true,
    }));

    // Get distribution, promo, and events totals
    const distributionTotal = await this.getDistributionTotal(companyId, startDate, endDate);
    const promoTotal = await this.getPromoTotal(companyId, startDate, endDate);
    const eventsData = await this.getEventsTotal(companyId, startDate, endDate);

    // Build operational nodes
    const operationalNodes: OperationalNode[] = [];

    if (distributionTotal.greaterThan(0) || this.isFeatureActive('distribution')) {
      operationalNodes.push({
        id: 'distribution',
        name: 'Distribution',
        totalSpent: distributionTotal.toFixed(2),
        type: 'distribution',
        isActive: this.isFeatureActive('distribution'),
      });
    }

    if (promoTotal.greaterThan(0) || this.isFeatureActive('promo')) {
      operationalNodes.push({
        id: 'promo',
        name: 'Promos',
        totalSpent: promoTotal.toFixed(2),
        type: 'promo',
        isActive: this.isFeatureActive('promo'),
      });
    }

    if (eventsData.total.greaterThan(0) || this.isFeatureActive('events')) {
      operationalNodes.push({
        id: 'events',
        name: 'Events',
        totalSpent: eventsData.total.toFixed(2),
        type: 'events',
        isActive: this.isFeatureActive('events'),
        details: {
          eventCosts: eventsData.eventCosts.toFixed(2),
          travelingCosts: eventsData.travelingCosts.toFixed(2),
          paidLabor: eventsData.paidLabor.toFixed(2),
          sweatEquity: eventsData.sweatEquity.toFixed(2),
        },
      });
    }

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
   * Get top 9 categories by spending (or all if < 11)
   * Creates "Other" category for remainder if needed
   */
  private getTopCategories(
    spending: Map<string, { total: Decimal; count: number }>,
    categories: CPGCategory[]
  ): Array<{ category: CPGCategory; total: Decimal; count: number }> {
    const categoriesWithSpending = categories
      .map(cat => ({
        category: cat,
        total: spending.get(cat.id)?.total || new Decimal(0),
        count: spending.get(cat.id)?.count || 0,
      }))
      .sort((a, b) => b.total.comparedTo(a.total)); // Descending by total

    // If 10 or fewer categories, return all
    if (categoriesWithSpending.length <= 10) {
      return categoriesWithSpending;
    }

    // Take top 9
    const top9 = categoriesWithSpending.slice(0, 9);

    // Sum the rest into "Other"
    const others = categoriesWithSpending.slice(9);
    const otherTotal = others.reduce(
      (sum, item) => sum.plus(item.total),
      new Decimal(0)
    );
    const otherCount = others.reduce((sum, item) => sum + item.count, 0);

    // Create synthetic "Other" category
    const otherCategory: CPGCategory = {
      id: '_other',
      company_id: categories[0]?.company_id || '',
      name: 'Other Materials',
      description: 'Accumulated smaller categories',
      variants: null,
      unit_of_measure: 'various',
      sort_order: 999,
      active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: {},
    };

    return [
      ...top9,
      {
        category: otherCategory,
        total: otherTotal,
        count: otherCount,
      },
    ];
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
   */
  private async getPromoTotal(
    companyId: string,
    startDate: number,
    endDate: number
  ): Promise<Decimal> {
    const promos = await this.db.cpgSalesPromos
      .where('company_id')
      .equals(companyId)
      .and((promo) =>
        !promo.deleted_at &&
        promo.promo_start_date >= startDate &&
        (promo.promo_end_date ? promo.promo_end_date <= endDate : true)
      )
      .toArray();

    return promos.reduce(
      (sum, promo) => sum.plus(promo.total_promo_cost || '0'),
      new Decimal(0)
    );
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
        event.event_start_date >= startDate &&
        event.event_end_date <= endDate
      )
      .toArray();

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
    return this.userFeaturePrefs[featureName] ?? false;
  }
}

/**
 * Create a new financial web data service instance
 */
export function createFinancialWebDataService(db: TreasureChestDB): FinancialWebDataService {
  return new FinancialWebDataService(db);
}
