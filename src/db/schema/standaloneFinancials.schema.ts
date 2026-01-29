/**
 * Standalone Financials Schema Definition
 *
 * For CPG standalone users who don't have full Audacious Money accounting software.
 * Allows manual entry of P&L and Balance Sheet data to support CPG analysis.
 *
 * Requirements:
 * - Manual P&L entry (Revenue, COGS, Expenses)
 * - Manual Balance Sheet entry (Assets, Liabilities, Equity)
 * - Period-based tracking (monthly, quarterly, annual)
 * - SKU count tracking for pricing ($5/SKU, max $50/month)
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import { nanoid } from 'nanoid';
import type { BaseEntity } from '../../types/database.types';

// ============================================================================
// Standalone Financial Statement - P&L and Balance Sheet entries
// ============================================================================

export type StatementType = 'profit_loss' | 'balance_sheet';
export type PeriodType = 'monthly' | 'quarterly' | 'annual' | 'custom';

export interface StandaloneLineItem {
  id: string;
  category: string; // Revenue, COGS, Expenses, Assets, Liabilities, Equity
  subcategory: string | null; // Optional grouping
  description: string;
  amount: string; // Decimal as string for precision
  sort_order: number;
}

export interface StandaloneTotals {
  // P&L Totals
  revenue?: string;
  cogs?: string;
  gross_profit?: string;
  expenses?: string;
  net_income?: string;

  // Balance Sheet Totals
  current_assets?: string;
  fixed_assets?: string;
  total_assets?: string;
  current_liabilities?: string;
  long_term_liabilities?: string;
  total_liabilities?: string;
  equity?: string;

  // Validation
  is_balanced?: boolean; // For Balance Sheet: Assets = Liabilities + Equity
}

export interface StandaloneFinancials extends BaseEntity {
  id: string;
  company_id: string;
  statement_type: StatementType;
  period_type: PeriodType;
  period_start: number; // Unix timestamp
  period_end: number; // Unix timestamp
  period_label: string | null; // e.g., "Q1 2026", "January 2026"

  line_items: StandaloneLineItem[];
  totals: StandaloneTotals;

  notes: string | null;
  active: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}

export const standaloneFinancialsSchema =
  'id, company_id, statement_type, period_start, period_end, [company_id+statement_type], [company_id+period_start], active, updated_at, deleted_at';

export const createDefaultStandaloneFinancials = (
  companyId: string,
  statementType: StatementType,
  periodStart: number,
  periodEnd: number,
  deviceId: string
): Partial<StandaloneFinancials> => {
  const now = Date.now();
  return {
    company_id: companyId,
    statement_type: statementType,
    period_type: 'monthly',
    period_start: periodStart,
    period_end: periodEnd,
    period_label: null,
    line_items: [],
    totals: {},
    notes: null,
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: { [deviceId]: 1 },
  };
};

export const validateStandaloneFinancials = (
  financials: Partial<StandaloneFinancials>
): string[] => {
  const errors: string[] = [];

  if (!financials.company_id) errors.push('company_id is required');
  if (!financials.statement_type) errors.push('statement_type is required');
  if (!financials.period_start) errors.push('period_start is required');
  if (!financials.period_end) errors.push('period_end is required');

  if (financials.period_start && financials.period_end) {
    if (financials.period_end <= financials.period_start) {
      errors.push('period_end must be after period_start');
    }
  }

  return errors;
};

// ============================================================================
// SKU Count Tracker - For standalone pricing calculation
// ============================================================================

export interface SKUCountTracker extends BaseEntity {
  id: string;
  company_id: string;
  sku_count: number; // Current number of SKUs
  monthly_cost: string; // Calculated: $5 × SKU count, capped at $50
  last_recalculated: number; // Unix timestamp

  active: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}

export const skuCountTrackersSchema =
  'id, company_id, [company_id+active], active, updated_at, deleted_at';

export const createDefaultSKUCountTracker = (
  companyId: string,
  deviceId: string
): Partial<SKUCountTracker> => {
  const now = Date.now();
  return {
    company_id: companyId,
    sku_count: 0,
    monthly_cost: '0.00',
    last_recalculated: now,
    active: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: { [deviceId]: 1 },
  };
};

export const validateSKUCountTracker = (
  tracker: Partial<SKUCountTracker>
): string[] => {
  const errors: string[] = [];

  if (!tracker.company_id) errors.push('company_id is required');
  if (tracker.sku_count !== undefined && tracker.sku_count < 0) {
    errors.push('sku_count cannot be negative');
  }

  return errors;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate monthly cost based on SKU count
 * Formula: $5 per SKU, capped at $50/month
 */
export const calculateMonthlyCost = (skuCount: number): string => {
  const baseCost = skuCount * 5;
  const cappedCost = Math.min(baseCost, 50);
  return cappedCost.toFixed(2);
};

/**
 * Generate line item ID
 */
export const generateLineItemId = (): string => {
  return nanoid();
};

/**
 * Calculate P&L totals from line items
 */
export const calculatePLTotals = (lineItems: StandaloneLineItem[]): StandaloneTotals => {
  let revenue = 0;
  let cogs = 0;
  let expenses = 0;

  lineItems.forEach(item => {
    const amount = parseFloat(item.amount);
    if (isNaN(amount)) return;

    switch (item.category.toLowerCase()) {
      case 'revenue':
        revenue += amount;
        break;
      case 'cogs':
      case 'cost of goods sold':
        cogs += amount;
        break;
      case 'expenses':
      case 'expense':
        expenses += amount;
        break;
    }
  });

  const grossProfit = revenue - cogs;
  const netIncome = grossProfit - expenses;

  return {
    revenue: revenue.toFixed(2),
    cogs: cogs.toFixed(2),
    gross_profit: grossProfit.toFixed(2),
    expenses: expenses.toFixed(2),
    net_income: netIncome.toFixed(2),
  };
};

/**
 * Calculate Balance Sheet totals from line items
 */
export const calculateBalanceSheetTotals = (
  lineItems: StandaloneLineItem[]
): StandaloneTotals => {
  let currentAssets = 0;
  let fixedAssets = 0;
  let currentLiabilities = 0;
  let longTermLiabilities = 0;
  let equity = 0;

  lineItems.forEach(item => {
    const amount = parseFloat(item.amount);
    if (isNaN(amount)) return;

    const category = item.category.toLowerCase();
    const subcategory = (item.subcategory || '').toLowerCase();

    if (category === 'assets') {
      if (subcategory === 'current' || subcategory === 'current assets') {
        currentAssets += amount;
      } else if (subcategory === 'fixed' || subcategory === 'fixed assets') {
        fixedAssets += amount;
      } else {
        // Default to current if not specified
        currentAssets += amount;
      }
    } else if (category === 'liabilities') {
      if (subcategory === 'current' || subcategory === 'current liabilities') {
        currentLiabilities += amount;
      } else if (subcategory === 'long-term' || subcategory === 'long term liabilities') {
        longTermLiabilities += amount;
      } else {
        // Default to current if not specified
        currentLiabilities += amount;
      }
    } else if (category === 'equity') {
      equity += amount;
    }
  });

  const totalAssets = currentAssets + fixedAssets;
  const totalLiabilities = currentLiabilities + longTermLiabilities;
  const difference = Math.abs(totalAssets - (totalLiabilities + equity));
  const isBalanced = difference < 0.01; // Allow for rounding errors

  return {
    current_assets: currentAssets.toFixed(2),
    fixed_assets: fixedAssets.toFixed(2),
    total_assets: totalAssets.toFixed(2),
    current_liabilities: currentLiabilities.toFixed(2),
    long_term_liabilities: longTermLiabilities.toFixed(2),
    total_liabilities: totalLiabilities.toFixed(2),
    equity: equity.toFixed(2),
    is_balanced: isBalanced,
  };
};

/**
 * Validate that Balance Sheet is balanced
 */
export const validateBalanceSheetBalance = (totals: StandaloneTotals): boolean => {
  const assets = parseFloat(totals.total_assets || '0');
  const liabilities = parseFloat(totals.total_liabilities || '0');
  const equity = parseFloat(totals.equity || '0');

  const difference = Math.abs(assets - (liabilities + equity));
  return difference < 0.01; // Allow for rounding errors
};

/**
 * Generate period label from dates
 */
export const generatePeriodLabel = (
  periodType: PeriodType,
  periodStart: number,
  periodEnd: number
): string => {
  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  switch (periodType) {
    case 'monthly':
      // Use UTC methods to avoid timezone shifting dates to wrong month
      return `${monthNames[startDate.getUTCMonth()]} ${startDate.getUTCFullYear()}`;
    case 'quarterly':
      const quarter = Math.floor(startDate.getUTCMonth() / 3) + 1;
      return `Q${quarter} ${startDate.getUTCFullYear()}`;
    case 'annual':
      return `${startDate.getUTCFullYear()}`;
    case 'custom':
      return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    default:
      return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  }
};
