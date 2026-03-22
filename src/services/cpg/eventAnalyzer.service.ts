/**
 * Event Analyzer Service
 *
 * Analyzes farmers markets and events to help CPG businesses
 * make data-driven decisions about event participation.
 *
 * Key features:
 * - Calculate event cost per unit
 * - Calculate CPU with event costs
 * - Compare margins (with event vs. without event)
 * - Calculate break-even units needed
 * - Provide scenario planning (what-if analysis)
 * - Track actual performance vs. projections
 *
 * Requirements:
 * - Decimal.js for all financial calculations
 * - Support flexible product variants
 * - Side-by-side comparison (with vs. without event)
 * - Clear recommendations with reasoning
 * - Post-event analysis and ROI tracking
 *
 * Formula:
 * Event Cost Per Unit = (Event Cost + Traveling Fees) / Total Units Bringing
 * CPU w/ Event = Base CPU + Event Cost Per Unit
 * Profit Margin w/ Event = ((Retail Price - CPU w/ Event) / Retail Price) × 100
 * Break-Even Units = Total Event Cost / (Retail Price - Base CPU)
 */

import Decimal from 'decimal.js';
import { nanoid } from 'nanoid';
import type { TreasureChestDB } from '../../db/database';
import type {
  CPGEvent,
  CPGSettings,
} from '../../db/schema/cpg.schema';
import {
  createDefaultCPGEvent,
  validateCPGEvent,
  getProfitMarginQuality,
  getProfitMarginQualityWithSettings,
  createDefaultCPGSettings,
} from '../../db/schema/cpg.schema';
import { logger } from '../../utils/logger';

const serviceLogger = logger.child('EventAnalyzerService');

// ============================================================================
// Types
// ============================================================================

export interface LaborEntry {
  id: string;
  description: string;
  hours: string;
  hourlyRate: string;
  costType: 'actual' | 'opportunity';
}

export interface CreateEventParams {
  companyId: string;
  eventName: string;
  location?: string;
  eventStartDate: number;
  eventEndDate: number;
  eventCost: string;
  travelingFees?: string;
  laborEntries?: LaborEntry[];
  notes?: string;
}

export interface EventAnalysisParams {
  eventId: string;
  variantEventData: Record<
    string,
    {
      retailPrice: string;
      unitsBringing: string;
      baseCPU: string;
    }
  >;
}

export interface EventAnalysisResult {
  eventId: string;
  eventName: string;
  location: string;
  eventStartDate: number;
  eventEndDate: number;
  eventCost: string;
  travelingFees: string | null;
  laborEntries: LaborEntry[];
  variantResults: Record<
    string,
    {
      eventCostPerUnit: string;
      cpuWithEvent: string;
      laborCostPerUnit: string | null;
      totalCostWithLabor: string | null;
      netProfitMarginWithEvent: string;
      netProfitMarginWithoutEvent: string;
      netProfitMarginWithLabor: string | null;
      marginQualityWithEvent: 'gutCheck' | 'good' | 'better' | 'best';
      marginDifference: string;
    }
  >;
  totalEventCost: string;
  totalActualLaborCost: string | null;
  totalOpportunityCost: string | null;
  totalUnits: string;
  breakEvenUnits: string;
  recommendation: 'participate' | 'decline' | 'neutral';
  recommendationReason: string;
}

// ============================================================================
// Service Class
// ============================================================================

export class EventAnalyzerService {
  constructor(private db: TreasureChestDB) {}

  /**
   * Create a new event for analysis
   */
  async createEvent(
    params: CreateEventParams,
    deviceId: string
  ): Promise<CPGEvent> {
    serviceLogger.info('Creating new event', { eventName: params.eventName });

    // Create event record
    const eventRecord: CPGEvent = {
      id: nanoid(),
      ...createDefaultCPGEvent(params.companyId, params.eventName, deviceId),
      event_name: params.eventName,
      location: params.location || '',
      event_start_date: params.eventStartDate,
      event_end_date: params.eventEndDate,
      event_cost: params.eventCost,
      traveling_fees: params.travelingFees || null,
      labor_entries: params.laborEntries
        ? params.laborEntries.map(entry => ({
            id: entry.id,
            description: entry.description,
            hours: entry.hours,
            hourly_rate: entry.hourlyRate,
            cost_type: entry.costType,
          }))
        : null,
      notes: params.notes || null,
    } as CPGEvent;

    // Validate
    const errors = validateCPGEvent(eventRecord);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Save to database
    await this.db.cpgEvents.add(eventRecord);

    serviceLogger.info('Event created successfully', { eventId: eventRecord.id });
    return eventRecord;
  }

  /**
   * Update an existing event
   */
  async updateEvent(
    eventId: string,
    updates: Partial<CPGEvent>,
    deviceId: string
  ): Promise<void> {
    serviceLogger.info('Updating event', { eventId });

    await this.db.cpgEvents.update(eventId, {
      ...updates,
      updated_at: Date.now(),
    });

    serviceLogger.info('Event updated successfully', { eventId });
  }

  /**
   * Analyze an event and calculate all financial metrics
   */
  async analyzeEvent(
    params: EventAnalysisParams,
    deviceId: string
  ): Promise<EventAnalysisResult> {
    serviceLogger.info('Analyzing event', { eventId: params.eventId });

    // Get event record
    const event = await this.db.cpgEvents.get(params.eventId);
    if (!event) {
      throw new Error(`Event not found: ${params.eventId}`);
    }

    // Get CPG settings for margin thresholds
    let settings = await this.db.cpgSettings
      .where('company_id')
      .equals(event.company_id)
      .and((s) => s.active && !s.deleted_at)
      .first();

    if (!settings) {
      const defaultSettings = createDefaultCPGSettings(event.company_id, deviceId);
      await this.db.cpgSettings.add(defaultSettings as CPGSettings);
      settings = defaultSettings as CPGSettings;
    }

    // Calculate total event cost (event cost + traveling fees)
    const eventCost = new Decimal(event.event_cost);
    const travelingFees = event.traveling_fees ? new Decimal(event.traveling_fees) : new Decimal(0);
    const totalEventCost = eventCost.plus(travelingFees);

    // Calculate total units bringing
    let totalUnits = new Decimal(0);
    Object.values(params.variantEventData).forEach(variant => {
      totalUnits = totalUnits.plus(new Decimal(variant.unitsBringing));
    });

    if (totalUnits.isZero()) {
      throw new Error('Total units cannot be zero');
    }

    // Calculate event cost per unit
    const eventCostPerUnit = totalEventCost.div(totalUnits);

    // Calculate labor costs
    let totalActualLaborCost: Decimal | null = null;
    let totalOpportunityCost: Decimal | null = null;
    let laborCostPerUnit: Decimal | null = null;

    if (event.labor_entries && event.labor_entries.length > 0) {
      totalActualLaborCost = new Decimal(0);
      totalOpportunityCost = new Decimal(0);

      // Filter out incomplete entries (defensive coding)
      const validEntries = event.labor_entries.filter(entry =>
        entry.hours && entry.hourly_rate &&
        !isNaN(parseFloat(entry.hours)) &&
        !isNaN(parseFloat(entry.hourly_rate))
      );

      validEntries.forEach(entry => {
        const hours = new Decimal(entry.hours);
        const rate = new Decimal(entry.hourly_rate);
        const cost = hours.times(rate);

        if (entry.cost_type === 'actual') {
          totalActualLaborCost = totalActualLaborCost!.plus(cost);
        } else {
          totalOpportunityCost = totalOpportunityCost!.plus(cost);
        }
      });

      const totalLaborCost = totalActualLaborCost.plus(totalOpportunityCost);
      laborCostPerUnit = totalLaborCost.div(totalUnits);
    }

    // Analyze each variant
    const variantResults: EventAnalysisResult['variantResults'] = {};
    let totalMarginDifference = new Decimal(0);
    let variantCount = 0;

    for (const [variantName, variantData] of Object.entries(params.variantEventData)) {
      // Defensive check - ensure values exist and are valid
      if (!variantData.retailPrice || !variantData.baseCPU || !variantData.unitsBringing) {
        serviceLogger.warn('Skipping variant with missing data', { variantName, variantData });
        continue;
      }

      const retailPrice = new Decimal(variantData.retailPrice);
      const baseCPU = new Decimal(variantData.baseCPU);

      // CPU with event = base CPU + event cost per unit
      const cpuWithEvent = baseCPU.plus(eventCostPerUnit);

      // Total cost with labor (if applicable)
      const totalCostWithLabor = laborCostPerUnit
        ? cpuWithEvent.plus(laborCostPerUnit)
        : null;

      // Calculate margins
      const netProfitMarginWithoutEvent = retailPrice.isZero()
        ? new Decimal(0)
        : retailPrice.minus(baseCPU).div(retailPrice).times(100);

      const netProfitMarginWithEvent = retailPrice.isZero()
        ? new Decimal(0)
        : retailPrice.minus(cpuWithEvent).div(retailPrice).times(100);

      const netProfitMarginWithLabor = totalCostWithLabor && !retailPrice.isZero()
        ? retailPrice.minus(totalCostWithLabor).div(retailPrice).times(100)
        : null;

      // Determine margin quality
      const marginToUse = netProfitMarginWithLabor || netProfitMarginWithEvent;
      const marginQuality = getProfitMarginQualityWithSettings(
        marginToUse.toFixed(2),
        settings
      );

      // Calculate margin difference
      const marginDifference = netProfitMarginWithEvent.minus(netProfitMarginWithoutEvent);
      totalMarginDifference = totalMarginDifference.plus(marginDifference);
      variantCount++;

      variantResults[variantName] = {
        eventCostPerUnit: eventCostPerUnit.toFixed(2),
        cpuWithEvent: cpuWithEvent.toFixed(2),
        laborCostPerUnit: laborCostPerUnit ? laborCostPerUnit.toFixed(2) : null,
        totalCostWithLabor: totalCostWithLabor ? totalCostWithLabor.toFixed(2) : null,
        netProfitMarginWithEvent: netProfitMarginWithEvent.toFixed(2),
        netProfitMarginWithoutEvent: netProfitMarginWithoutEvent.toFixed(2),
        netProfitMarginWithLabor: netProfitMarginWithLabor ? netProfitMarginWithLabor.toFixed(2) : null,
        marginQualityWithEvent: marginQuality,
        marginDifference: marginDifference.toFixed(2),
      };
    }

    // Calculate average margin to determine recommendation
    const avgMarginDifference = variantCount > 0
      ? totalMarginDifference.div(variantCount)
      : new Decimal(0);

    // Get average margin with event
    let totalMarginWithEvent = new Decimal(0);
    Object.values(variantResults).forEach(result => {
      const margin = result.netProfitMarginWithLabor || result.netProfitMarginWithEvent;
      totalMarginWithEvent = totalMarginWithEvent.plus(new Decimal(margin));
    });
    const avgMarginWithEvent = variantCount > 0
      ? totalMarginWithEvent.div(variantCount)
      : new Decimal(0);

    // Determine recommendation
    let recommendation: 'participate' | 'decline' | 'neutral' = 'neutral';
    let recommendationReason = '';

    const gutCheckMax = new Decimal(settings.margin_gut_check_max);
    const goodMin = new Decimal(settings.margin_good_min);

    if (avgMarginWithEvent.gte(goodMin)) {
      recommendation = 'participate';
      recommendationReason = `Your margins stay healthy at ${avgMarginWithEvent.toFixed(1)}%. This event looks profitable!`;
    } else if (avgMarginWithEvent.lt(gutCheckMax)) {
      recommendation = 'decline';
      recommendationReason = `Margins drop to ${avgMarginWithEvent.toFixed(1)}%, which may not be sustainable. Consider if the exposure is worth the cost.`;
    } else {
      recommendation = 'neutral';
      recommendationReason = `Margins are ${avgMarginWithEvent.toFixed(1)}% - borderline. Consider the marketing value and customer acquisition potential.`;
    }

    // Calculate break-even units (average across variants)
    let breakEvenUnits = new Decimal(0);
    for (const [variantName, variantData] of Object.entries(params.variantEventData)) {
      const retailPrice = new Decimal(variantData.retailPrice);
      const baseCPU = new Decimal(variantData.baseCPU);
      const grossProfitPerUnit = retailPrice.minus(baseCPU);

      if (grossProfitPerUnit.gt(0)) {
        const variantBreakEven = totalEventCost.div(grossProfitPerUnit);
        breakEvenUnits = breakEvenUnits.plus(variantBreakEven);
      }
    }
    breakEvenUnits = variantCount > 0 ? breakEvenUnits.div(variantCount) : new Decimal(0);

    // Convert labor entries back to camelCase
    const laborEntries: LaborEntry[] = event.labor_entries
      ? event.labor_entries.map(entry => ({
          id: entry.id,
          description: entry.description,
          hours: entry.hours,
          hourlyRate: entry.hourly_rate,
          costType: entry.cost_type,
        }))
      : [];

    // Save results to database
    const variantEventResults: CPGEvent['variant_event_results'] = {};
    for (const [variantName, result] of Object.entries(variantResults)) {
      variantEventResults[variantName] = {
        event_cost_per_unit: result.eventCostPerUnit,
        cpu_with_event: result.cpuWithEvent,
        labor_cost_per_unit: result.laborCostPerUnit,
        total_cost_with_labor: result.totalCostWithLabor,
        net_profit_margin_with_event: result.netProfitMarginWithEvent,
        net_profit_margin_without_event: result.netProfitMarginWithoutEvent,
        net_profit_margin_with_labor: result.netProfitMarginWithLabor,
        margin_quality_with_event: result.marginQualityWithEvent,
      };
    }

    // Convert variant data to snake_case for database
    const variantEventData: CPGEvent['variant_event_data'] = {};
    for (const [variantName, data] of Object.entries(params.variantEventData)) {
      variantEventData[variantName] = {
        retail_price: data.retailPrice,
        units_bringing: data.unitsBringing,
        base_cpu: data.baseCPU,
      };
    }

    await this.updateEvent(
      params.eventId,
      {
        variant_event_data: variantEventData,
        variant_event_results: variantEventResults,
        total_event_cost: totalEventCost.toFixed(2),
        total_actual_labor_cost: totalActualLaborCost ? totalActualLaborCost.toFixed(2) : null,
        total_opportunity_cost: totalOpportunityCost ? totalOpportunityCost.toFixed(2) : null,
        recommendation,
      },
      deviceId
    );

    serviceLogger.info('Event analysis complete', {
      eventId: params.eventId,
      recommendation,
      avgMargin: avgMarginWithEvent.toFixed(2),
    });

    return {
      eventId: params.eventId,
      eventName: event.event_name,
      location: event.location,
      eventStartDate: event.event_start_date,
      eventEndDate: event.event_end_date,
      eventCost: event.event_cost,
      travelingFees: event.traveling_fees,
      laborEntries,
      variantResults,
      totalEventCost: totalEventCost.toFixed(2),
      totalActualLaborCost: totalActualLaborCost ? totalActualLaborCost.toFixed(2) : null,
      totalOpportunityCost: totalOpportunityCost ? totalOpportunityCost.toFixed(2) : null,
      totalUnits: totalUnits.toFixed(0),
      breakEvenUnits: breakEvenUnits.toFixed(0),
      recommendation,
      recommendationReason,
    };
  }

  /**
   * Track actual results after event completes
   */
  async trackActuals(
    eventId: string,
    actuals: {
      variantActualUnitsSold: Record<string, number>;
      variantUnitsDamaged?: Record<string, number>;
      variantUnitsDemo?: Record<string, number>;
      notes?: string;
    },
    deviceId: string
  ): Promise<void> {
    serviceLogger.info('Tracking event actuals', { eventId });

    const event = await this.db.cpgEvents.get(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    // Calculate actual revenue and profit
    let actualRevenue = new Decimal(0);

    for (const [variantName, unitsSold] of Object.entries(actuals.variantActualUnitsSold)) {
      if (event.variant_event_data && event.variant_event_data[variantName]) {
        const retailPrice = new Decimal(event.variant_event_data[variantName].retail_price);
        const revenue = retailPrice.times(unitsSold);
        actualRevenue = actualRevenue.plus(revenue);
      }
    }

    // Calculate total costs
    const totalEventCost = new Decimal(event.total_event_cost);
    const totalLaborCost = event.total_actual_labor_cost
      ? new Decimal(event.total_actual_labor_cost)
      : new Decimal(0);
    const totalCosts = totalEventCost.plus(totalLaborCost);

    // Calculate profit and ROI
    const actualProfit = actualRevenue.minus(totalCosts);
    const actualROI = totalCosts.isZero()
      ? new Decimal(0)
      : actualProfit.div(totalCosts).times(100);

    // Update event with actuals
    await this.updateEvent(
      eventId,
      {
        variant_actual_units_sold: actuals.variantActualUnitsSold,
        variant_units_damaged: actuals.variantUnitsDamaged || null,
        variant_units_demo: actuals.variantUnitsDemo || null,
        actual_total_revenue: actualRevenue.toFixed(2),
        actual_total_profit: actualProfit.toFixed(2),
        actual_roi: actualROI.toFixed(2),
        notes: actuals.notes || event.notes,
        status: 'completed',
      },
      deviceId
    );

    serviceLogger.info('Event actuals tracked successfully', {
      eventId,
      actualRevenue: actualRevenue.toFixed(2),
      actualProfit: actualProfit.toFixed(2),
      actualROI: actualROI.toFixed(2),
    });
  }
}

// Export class for instantiation by consumers
// Usage: const service = new EventAnalyzerService(db);
