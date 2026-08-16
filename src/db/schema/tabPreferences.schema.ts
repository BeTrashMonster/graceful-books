/**
 * Tab Preferences Schema
 *
 * Stores user preferences for which tab should open by default on each page.
 * Allows users to "pin" their preferred tab so it opens automatically.
 */

import type { BaseEntity } from '../../types/database.types';

/**
 * Tab Preference - User's pinned tab for a specific page
 */
export interface TabPreference extends BaseEntity {
  id: string;
  user_id: string;
  page_id: string; // e.g., "cpu-tracker", "distribution-center", "cost-intelligence"
  pinned_tab_id: string; // e.g., "invoices", "cpu-trends", "labor-roles"
}

/**
 * Database schema for tab preferences
 * Indexes: user_id, [user_id+page_id] for fast lookups
 */
export const tabPreferencesSchema =
  'id, user_id, page_id, [user_id+page_id], created_at, updated_at, deleted_at';

/**
 * Page IDs for tab pinning
 */
export const PAGE_IDS = {
  CPU_TRACKER: 'cpu-tracker',
  COST_INTELLIGENCE: 'cost-intelligence',
  LABOR_ROLES: 'labor-roles',
  DISTRIBUTION_CENTER: 'distribution-center',
  PROMO_ANALYSIS: 'promo-analysis',
  EVENTS_ANALYSIS: 'events-analysis',
  FINANCIAL_ENTRY: 'financial-entry',
  STRATEGY_PLANNING: 'strategy-planning',
  VENDORS: 'vendors',
  CUSTOMERS: 'customers',
} as const;

/**
 * Tab IDs for each page
 * These match the actual tab values used in the codebase
 */
export const TAB_IDS = {
  // CPU Tracker tabs
  CPU_PRODUCTS: 'products',
  CPU_RAW_MATERIALS: 'raw-materials',
  CPU_COMPARISON: 'comparison',

  // Cost Intelligence subtabs
  COST_SCENARIO_BUILDER: 'scenario-builder',
  COST_CPU_TRENDS: 'cpu-trends',
  COST_VENDOR_INTEL: 'vendor-intel',
  COST_SMART_ALERTS: 'smart-alerts',

  // Labor + Roles tabs
  LABOR_SCENARIOS: 'scenarios',
  LABOR_ROLES: 'roles',
  LABOR_REPORTS: 'reports',

  // Distribution Center tabs
  DIST_MANAGE: 'manage',
  DIST_COSTS: 'costs',
  DIST_CALCULATIONS: 'calculations',
  DIST_SCENARIOS: 'scenarios',

  // Promo Analysis tabs
  PROMO_DECISION: 'decision-tool',
  PROMO_TRACKER: 'promo-tracker',

  // Events Analysis tabs
  EVENT_DECISION: 'decision',
  EVENT_TRACKER: 'tracker',

  // Financial Entry tabs
  FINANCIAL_PL: 'pl',
  FINANCIAL_BS: 'bs',

  // Strategy Planning tabs
  STRATEGY_WHAT_IF: 'what-if',
  STRATEGY_COMPARE: 'compare',
  STRATEGY_COST_IDEA: 'cost-idea',

  // Vendors tabs
  VENDORS_CENTER: 'vendor-center',
  VENDORS_BILLS: 'bills',
  VENDORS_RECEIPTS: 'receipts',
  VENDORS_INSIGHTS: 'insights',

  // Customers tabs
  CUSTOMERS_CENTER: 'customer-center',
  CUSTOMERS_INVOICES: 'invoices',
} as const;

/**
 * Default tabs for each page (system defaults)
 */
export const DEFAULT_TABS = {
  [PAGE_IDS.CPU_TRACKER]: TAB_IDS.CPU_PRODUCTS,
  [PAGE_IDS.COST_INTELLIGENCE]: TAB_IDS.COST_SCENARIO_BUILDER,
  [PAGE_IDS.LABOR_ROLES]: TAB_IDS.LABOR_SCENARIOS,
  [PAGE_IDS.DISTRIBUTION_CENTER]: TAB_IDS.DIST_MANAGE,
  [PAGE_IDS.PROMO_ANALYSIS]: TAB_IDS.PROMO_DECISION,
  [PAGE_IDS.EVENTS_ANALYSIS]: TAB_IDS.EVENT_DECISION,
  [PAGE_IDS.FINANCIAL_ENTRY]: TAB_IDS.FINANCIAL_PL,
  [PAGE_IDS.STRATEGY_PLANNING]: TAB_IDS.STRATEGY_WHAT_IF,
  [PAGE_IDS.VENDORS]: TAB_IDS.VENDORS_CENTER,
  [PAGE_IDS.CUSTOMERS]: TAB_IDS.CUSTOMERS_CENTER,
} as const;
