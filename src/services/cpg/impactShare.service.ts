/**
 * Impact Share Service
 *
 * Manages mission-driven pricing scenarios for CPG businesses.
 * Helps entrepreneurs understand the financial impact of adding
 * social/environmental impact costs to their products.
 *
 * Supports 4 calculation methods:
 * - Fixed Amount: Add $ per unit
 * - % of Retail: Add % of retail price
 * - % of Base CPU: Add % of base cost
 * - % of Gross Profit: Add % of (retail - base CPU)
 *
 * Key Features:
 * - Multiple scenarios can be active (one per product)
 * - Saved scenarios for future comparison
 * - Inactive scenarios remain in database
 * - Real-time impact calculations
 * - Side-by-side scenario comparison
 */

import Decimal from 'decimal.js';
import { nanoid } from 'nanoid';
import type { TreasureChestDB } from '../../db/database';
import { db } from '../../db/database';
import type { CPGImpactScenario, CPGFinishedProduct } from '../../db/schema/cpg.schema';
import {
  createDefaultCPGImpactScenario,
  validateCPGImpactScenario,
} from '../../db/schema/cpg.schema';
import { cpuCalculatorService } from './cpuCalculator.service';
import { logger } from '../../utils/logger';

const serviceLogger = logger.child('ImpactShareService');

// Configure Decimal.js for currency precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ============================================================================
// Types
// ============================================================================

export interface CreateScenarioParams {
  companyId: string;
  scenarioName: string;
  methodType: 'fixed_amount' | 'percent_retail' | 'percent_cpu' | 'percent_profit';
  amount?: string;
  percentage?: string;
  selectedProductIds: string[];
}

export interface ImpactCalculationResult {
  impactAmount: string;
  method: string;
  baseValue: string; // What the percentage was calculated from
  productName: string;
  retailPrice: string;
  baseCPU: string;
  totalCPUWithImpact: string;
  marginWithImpact: string;
  marginPercentWithImpact: string;
}

export interface ComparisonProductResult {
  productId: string;
  productName: string;
  retailPrice: string;
  baseCPU: string;
  scenarios: {
    [scenarioId: string]: {
      scenarioName: string;
      method: string;
      impactAmount: string;
      totalCPU: string;
      margin: string;
      marginPercent: string;
    };
  };
}

export interface ComparisonResult {
  scenarios: Array<{
    id: string;
    name: string;
    method: string;
  }>;
  products: ComparisonProductResult[];
}

// ============================================================================
// Service Class
// ============================================================================

export class ImpactShareService {
  constructor(private db: TreasureChestDB) {}

  /**
   * Create new Impact Share scenario
   */
  async createScenario(params: CreateScenarioParams, deviceId: string): Promise<CPGImpactScenario> {
    serviceLogger.info('Creating Impact Share scenario', { scenarioName: params.scenarioName });

    // Create scenario record
    const scenarioRecord: CPGImpactScenario = {
      id: nanoid(),
      ...createDefaultCPGImpactScenario(params.companyId, params.scenarioName, deviceId),
      scenario_name: params.scenarioName,
      method_type: params.methodType,
      amount: params.amount || '0',
      percentage: params.percentage || '0',
      selected_product_ids: params.selectedProductIds,
      status: 'saved', // Default to saved, user activates explicitly
    } as CPGImpactScenario;

    // Validate
    const errors = validateCPGImpactScenario(scenarioRecord);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Save to database
    await this.db.cpgImpactScenarios.add(scenarioRecord);

    serviceLogger.info('Impact Share scenario created', { scenarioId: scenarioRecord.id });
    return scenarioRecord;
  }

  /**
   * Update existing scenario
   */
  async updateScenario(
    scenarioId: string,
    updates: Partial<CPGImpactScenario>,
    deviceId: string
  ): Promise<void> {
    serviceLogger.info('Updating Impact Share scenario', { scenarioId });

    // Get current scenario to validate updates
    const current = await this.db.cpgImpactScenarios.get(scenarioId);
    if (!current) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    // Merge updates with current data for validation
    const merged = { ...current, ...updates };
    const errors = validateCPGImpactScenario(merged);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    await this.db.cpgImpactScenarios.update(scenarioId, {
      ...updates,
      updated_at: Date.now(),
    });

    serviceLogger.info('Impact Share scenario updated', { scenarioId });
  }

  /**
   * Activate scenario
   * Note: Multiple scenarios can be active, but only one per product
   */
  async activateScenario(scenarioId: string, deviceId: string): Promise<void> {
    serviceLogger.info('Activating Impact Share scenario', { scenarioId });

    const scenario = await this.db.cpgImpactScenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    // Get all currently active scenarios for this company
    const activeScenarios = await this.db.cpgImpactScenarios
      .where('[company_id+status]')
      .equals([scenario.company_id, 'active'])
      .toArray();

    // Find conflicts: products that are in both this scenario and active scenarios
    const conflictingScenarios: Array<{ scenarioId: string; scenarioName: string; productIds: string[] }> = [];

    for (const activeScenario of activeScenarios) {
      const overlappingProducts = scenario.selected_product_ids.filter((productId) =>
        activeScenario.selected_product_ids.includes(productId)
      );

      if (overlappingProducts.length > 0) {
        conflictingScenarios.push({
          scenarioId: activeScenario.id,
          scenarioName: activeScenario.scenario_name,
          productIds: overlappingProducts,
        });
      }
    }

    // If there are conflicts, deactivate conflicting scenarios
    if (conflictingScenarios.length > 0) {
      serviceLogger.info('Deactivating conflicting scenarios', {
        conflicts: conflictingScenarios.map((c) => c.scenarioName),
      });

      for (const conflict of conflictingScenarios) {
        await this.db.cpgImpactScenarios.update(conflict.scenarioId, {
          status: 'saved',
          updated_at: Date.now(),
        });
      }
    }

    // Activate this scenario
    await this.db.cpgImpactScenarios.update(scenarioId, {
      status: 'active',
      updated_at: Date.now(),
    });

    serviceLogger.info('Impact Share scenario activated', { scenarioId });
  }

  /**
   * Deactivate scenario (set to inactive)
   */
  async deactivateScenario(scenarioId: string, deviceId: string): Promise<void> {
    serviceLogger.info('Deactivating Impact Share scenario', { scenarioId });

    await this.db.cpgImpactScenarios.update(scenarioId, {
      status: 'inactive',
      updated_at: Date.now(),
    });

    serviceLogger.info('Impact Share scenario deactivated', { scenarioId });
  }

  /**
   * Mark scenario as saved (from active)
   */
  async saveScenario(scenarioId: string, deviceId: string): Promise<void> {
    serviceLogger.info('Saving Impact Share scenario', { scenarioId });

    await this.db.cpgImpactScenarios.update(scenarioId, {
      status: 'saved',
      updated_at: Date.now(),
    });

    serviceLogger.info('Impact Share scenario saved', { scenarioId });
  }

  /**
   * Hard delete scenario (permanent removal)
   */
  async deleteScenario(scenarioId: string): Promise<void> {
    serviceLogger.info('Deleting Impact Share scenario', { scenarioId });

    await this.db.cpgImpactScenarios.delete(scenarioId);

    serviceLogger.info('Impact Share scenario deleted', { scenarioId });
  }

  /**
   * Calculate impact amount for a specific product
   */
  async calculateImpactForProduct(
    scenarioId: string,
    productId: string
  ): Promise<ImpactCalculationResult> {
    const scenario = await this.db.cpgImpactScenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    const product = await this.db.cpgFinishedProducts.get(productId);
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    // Get base CPU
    const cpuBreakdown = await cpuCalculatorService.getFinishedProductCPUBreakdown(
      productId,
      product.company_id
    );
    const baseCPU = new Decimal(cpuBreakdown.cpu);
    const retailPrice = new Decimal(product.msrp || '0');

    let impactAmount: Decimal;
    let baseValue: string;
    let method: string;

    switch (scenario.method_type) {
      case 'fixed_amount':
        impactAmount = new Decimal(scenario.amount);
        baseValue = scenario.amount;
        method = `$${scenario.amount} per unit`;
        break;

      case 'percent_retail':
        impactAmount = retailPrice.times(new Decimal(scenario.percentage).div(100));
        baseValue = `${scenario.percentage}% of $${retailPrice.toFixed(6)}`;
        method = `${scenario.percentage}% of retail price`;
        break;

      case 'percent_cpu':
        impactAmount = baseCPU.times(new Decimal(scenario.percentage).div(100));
        baseValue = `${scenario.percentage}% of $${baseCPU.toFixed(6)}`;
        method = `${scenario.percentage}% of base CPU`;
        break;

      case 'percent_profit':
        const grossProfit = retailPrice.minus(baseCPU);
        impactAmount = grossProfit.times(new Decimal(scenario.percentage).div(100));
        baseValue = `${scenario.percentage}% of $${grossProfit.toFixed(6)}`;
        method = `${scenario.percentage}% of gross profit`;
        break;

      default:
        throw new Error(`Unknown method type: ${scenario.method_type}`);
    }

    // Calculate totals
    const totalCPUWithImpact = baseCPU.plus(impactAmount);
    const marginWithImpact = retailPrice.minus(totalCPUWithImpact);
    const marginPercentWithImpact = retailPrice.isZero()
      ? new Decimal(0)
      : marginWithImpact.div(retailPrice).times(100);

    return {
      impactAmount: impactAmount.toFixed(6),
      method,
      baseValue,
      productName: product.name,
      retailPrice: retailPrice.toFixed(6),
      baseCPU: baseCPU.toFixed(6),
      totalCPUWithImpact: totalCPUWithImpact.toFixed(6),
      marginWithImpact: marginWithImpact.toFixed(6),
      marginPercentWithImpact: marginPercentWithImpact.toFixed(6),
    };
  }

  /**
   * Get active scenarios for company
   * Returns all active scenarios (multiple can be active for different products)
   */
  async getActiveScenarios(companyId: string): Promise<CPGImpactScenario[]> {
    return await this.db.cpgImpactScenarios
      .where('[company_id+status]')
      .equals([companyId, 'active'])
      .toArray();
  }

  /**
   * Get active scenario for a specific product
   * Returns the active scenario that includes this product, or null
   */
  async getActiveScenarioForProduct(
    companyId: string,
    productId: string
  ): Promise<CPGImpactScenario | null> {
    const activeScenarios = await this.getActiveScenarios(companyId);

    for (const scenario of activeScenarios) {
      if (scenario.selected_product_ids.includes(productId)) {
        return scenario;
      }
    }

    return null;
  }

  /**
   * Get all scenarios for company (excluding deleted)
   */
  async getAllScenarios(companyId: string, includeInactive: boolean): Promise<CPGImpactScenario[]> {
    let scenarios = await this.db.cpgImpactScenarios
      .where('company_id')
      .equals(companyId)
      .and((s) => !s.deleted_at)
      .sortBy('created_at');

    if (!includeInactive) {
      scenarios = scenarios.filter((s) => s.status !== 'inactive');
    }

    return scenarios;
  }

  /**
   * Compare multiple scenarios side-by-side
   */
  async compareScenarios(scenarioIds: string[]): Promise<ComparisonResult> {
    serviceLogger.info('Comparing scenarios', { scenarioIds });

    // Load all scenarios
    const scenarios = await Promise.all(
      scenarioIds.map((id) => this.db.cpgImpactScenarios.get(id))
    );

    // Filter out any missing scenarios
    const validScenarios = scenarios.filter((s): s is CPGImpactScenario => s !== undefined);

    if (validScenarios.length === 0) {
      throw new Error('No valid scenarios to compare');
    }

    // Get all unique product IDs across scenarios
    const allProductIds = new Set<string>();
    validScenarios.forEach((scenario) => {
      scenario.selected_product_ids.forEach((productId) => allProductIds.add(productId));
    });

    // Build comparison results
    const products: ComparisonProductResult[] = [];

    for (const productId of allProductIds) {
      const product = await this.db.cpgFinishedProducts.get(productId);
      if (!product) continue;

      const cpuBreakdown = await cpuCalculatorService.getFinishedProductCPUBreakdown(
        productId,
        product.company_id
      );
      const baseCPU = new Decimal(cpuBreakdown.cpu);
      const retailPrice = new Decimal(product.msrp || '0');

      const scenarioResults: ComparisonProductResult['scenarios'] = {};

      for (const scenario of validScenarios) {
        // Only calculate if this scenario includes this product
        if (!scenario.selected_product_ids.includes(productId)) {
          continue;
        }

        const calculation = await this.calculateImpactForProduct(scenario.id, productId);

        scenarioResults[scenario.id] = {
          scenarioName: scenario.scenario_name,
          method: calculation.method,
          impactAmount: calculation.impactAmount,
          totalCPU: calculation.totalCPUWithImpact,
          margin: calculation.marginWithImpact,
          marginPercent: calculation.marginPercentWithImpact,
        };
      }

      products.push({
        productId,
        productName: product.name,
        retailPrice: retailPrice.toFixed(6),
        baseCPU: baseCPU.toFixed(6),
        scenarios: scenarioResults,
      });
    }

    return {
      scenarios: validScenarios.map((s) => ({
        id: s.id,
        name: s.scenario_name,
        method: this.formatMethodType(s),
      })),
      products,
    };
  }

  /**
   * Format method type for display
   */
  private formatMethodType(scenario: CPGImpactScenario): string {
    switch (scenario.method_type) {
      case 'fixed_amount':
        return `$${scenario.amount}/unit`;
      case 'percent_retail':
        return `${scenario.percentage}% of retail`;
      case 'percent_cpu':
        return `${scenario.percentage}% of CPU`;
      case 'percent_profit':
        return `${scenario.percentage}% of profit`;
      default:
        return 'Unknown';
    }
  }

  /**
   * Calculate average impact CPU across selected products
   */
  async calculateAverageImpactCPU(scenarioId: string): Promise<string> {
    const scenario = await this.db.cpgImpactScenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    const impacts = await Promise.all(
      scenario.selected_product_ids.map((productId) =>
        this.calculateImpactForProduct(scenarioId, productId).catch(() => null)
      )
    );

    const validImpacts = impacts.filter((i): i is ImpactCalculationResult => i !== null);

    if (validImpacts.length === 0) {
      return '$0.00/unit';
    }

    const amounts = validImpacts.map((i) => parseFloat(i.impactAmount));
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);

    if (min === max) {
      return `$${min.toFixed(6)}/unit`;
    }

    return `$${min.toFixed(6)}-$${max.toFixed(6)}/unit`;
  }
}

/**
 * Create a new Impact Share service instance
 */
export function createImpactShareService(db: TreasureChestDB): ImpactShareService {
  return new ImpactShareService(db);
}

// Export singleton instance
export const impactShareService = new ImpactShareService(db);
