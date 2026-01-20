/**
 * Scenario Types
 *
 * Type definitions for J3: Building the Dream Scenarios
 * Professional scenario modeling for accountants
 */

import type { Account, JournalEntry } from './database.types';
import type { BalanceSheetReport, ProfitLossReport } from './reports.types';

/**
 * Scenario status
 */
export type ScenarioStatus =
  | 'draft' // Being created/edited
  | 'ready' // Ready to share
  | 'shared' // Shared with client
  | 'implemented' // Client decided to implement
  | 'archived'; // No longer relevant

/**
 * Adjustment type
 */
export type AdjustmentType =
  | 'template' // Template-based adjustment
  | 'freeform'; // Manual freeform adjustment

/**
 * Scenario template keys (10+ templates at launch)
 */
export type ScenarioTemplateKey =
  | 'reclassify-employee-to-owner'
  | 'add-new-employee'
  | 'remove-employee'
  | 'change-compensation'
  | 'add-recurring-expense'
  | 'remove-recurring-expense'
  | 'change-pricing'
  | 'take-on-debt'
  | 'pay-off-debt'
  | 'major-equipment-purchase'
  | 'lease-vs-buy'
  | 'add-revenue-stream';

/**
 * Template category for UI filtering
 */
export type TemplateCategory =
  | 'payroll'
  | 'expenses'
  | 'revenue'
  | 'financing'
  | 'capital';

/**
 * Client response to shared scenario
 */
export type ScenarioShareStatus =
  | 'pending' // Not yet viewed
  | 'viewed' // Client opened it
  | 'commented' // Client left comments
  | 'accepted' // Client wants to implement
  | 'declined'; // Client declined

/**
 * Financial baseline snapshot
 */
export interface ScenarioBaseline {
  id: string;
  scenario_id: string;
  snapshot_date: number; // Timestamp when baseline was captured

  // Financial statements
  profit_loss: ProfitLossReport;
  balance_sheet: BalanceSheetReport;

  // Cash position
  cash_balance: number;

  // Operational data (for smart calculations)
  payroll_data: {
    employees: Array<{
      id: string;
      name: string;
      role: string;
      annual_salary: number;
      employer_taxes: number; // FICA, unemployment, etc.
      benefits_cost: number;
    }>;
    total_monthly_payroll: number;
    total_monthly_employer_taxes: number;
  };

  invoicing_data: {
    monthly_recurring_revenue: number;
    average_invoice_amount: number;
    accounts_receivable_aging: {
      current: number;
      days_30: number;
      days_60: number;
      days_90_plus: number;
    };
  };

  products_services_data: {
    top_products: Array<{
      id: string;
      name: string;
      monthly_revenue: number;
      percentage_of_total: number;
    }>;
  };

  vendors_data: {
    monthly_recurring_expenses: number;
    top_vendors: Array<{
      id: string;
      name: string;
      monthly_spend: number;
    }>;
  };

  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/**
 * Scenario definition
 */
export interface Scenario {
  id: string;
  company_id: string;
  created_by_id: string; // Advisor who created it
  client_id: string | null; // If shared with specific client

  name: string; // "Sarah's Ownership Transition", "2025 Expansion Plan"
  description: string;

  status: ScenarioStatus;

  // Baseline reference
  baseline_id: string | null;

  // When baseline was last refreshed
  baseline_refreshed_at: number | null;

  created_at: number;
  updated_at: number;
  deleted_at: number | null;

  // CRDT metadata
  version_vector: Record<string, number>;
}

/**
 * Scenario adjustment (template or freeform)
 */
export interface ScenarioAdjustment {
  id: string;
  scenario_id: string;
  adjustment_type: AdjustmentType;
  order_index: number; // For maintaining order of adjustments

  // Template-based adjustment
  template_key?: ScenarioTemplateKey;
  template_params?: Record<string, unknown>; // Template-specific parameters

  // Freeform adjustment
  account_id?: string; // Account being adjusted
  adjustment_amount?: number; // Amount of adjustment (+ or -)
  adjustment_description?: string;
  formula?: string; // Formula referencing other accounts/cells

  // Calculated impact (cached for performance)
  impact_summary?: {
    revenue_change: number;
    expense_change: number;
    profit_change: number;
    cash_flow_change: number;
    tax_liability_change: number;
  };

  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/**
 * Accountant note on scenario or line item
 */
export interface ScenarioNote {
  id: string;
  scenario_id: string;
  line_item_id: string | null; // Null if note is for entire scenario
  created_by_id: string; // Advisor

  note_text: string;

  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/**
 * Client comment on shared scenario
 */
export interface ScenarioComment {
  id: string;
  scenario_id: string;
  created_by_id: string; // Client or advisor
  parent_comment_id: string | null; // For threaded comments

  comment_text: string;

  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/**
 * Scenario share record (J7 integration)
 */
export interface ScenarioShare {
  id: string;
  scenario_id: string;
  shared_with_user_id: string; // Client
  shared_by_user_id: string; // Advisor

  status: ScenarioShareStatus;

  // Custom email message from advisor
  email_message: string;

  // Permissions
  allow_client_edit: boolean; // Can client modify adjustments?

  shared_at: number;
  viewed_at: number | null;
  responded_at: number | null;

  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/**
 * Scenario template definition
 */
export interface ScenarioTemplate {
  id: string;
  template_key: ScenarioTemplateKey;
  category: TemplateCategory;
  active: boolean;

  // Template metadata
  name: string;
  description: string;
  icon: string; // Icon name for UI

  // Template parameter schema (defines inputs)
  param_schema: {
    fields: Array<{
      key: string;
      label: string;
      type: 'text' | 'number' | 'select' | 'currency' | 'percentage';
      required: boolean;
      options?: Array<{ value: string; label: string }>; // For select fields
      default_value?: unknown;
      help_text?: string;
    }>;
  };

  // Calculation logic reference (implemented in service)
  calculation_function: string; // Function name in scenarioCalculator.service.ts

  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

/**
 * Projected financial result after adjustments
 */
export interface ScenarioProjection {
  // Original baseline values
  baseline: {
    revenue: number;
    expenses: number;
    profit: number;
    cash_balance: number;
    tax_liability_estimate: number;
  };

  // Adjustments applied
  adjustments: {
    revenue_change: number;
    expense_change: number;
    one_time_costs: number;
  };

  // Projected values
  projected: {
    revenue: number;
    expenses: number;
    profit: number;
    cash_balance: number;
    tax_liability_estimate: number;
  };

  // Delta summary
  delta: {
    revenue: number; // Projected - Baseline
    expenses: number;
    profit: number;
    cash_balance: number;
    tax_liability: number;
  };

  // Key metrics
  metrics: {
    profit_margin_baseline: number; // %
    profit_margin_projected: number; // %
    revenue_growth: number; // %
    expense_ratio: number; // % of revenue
    runway_months_baseline: number | null; // null if cash flow positive
    runway_months_projected: number | null;
  };

  // Detailed line-item breakdown
  line_items: Array<{
    account_id: string;
    account_name: string;
    account_type: Account['type'];
    baseline_amount: number;
    adjustment_amount: number;
    projected_amount: number;
    notes: string | null;
  }>;
}

/**
 * Scenario worksheet row (for Excel-like UI)
 */
export interface ScenarioWorksheetRow {
  row_id: string;
  row_type: 'account' | 'subtotal' | 'total' | 'header';

  // Account reference (if row_type === 'account')
  account_id?: string;
  account_name?: string;
  account_type?: Account['type'];

  // Values
  current_value: number;
  adjustment_value: number;
  projected_value: number;

  // Formula (if freeform adjustment with formula)
  formula?: string;

  // Notes
  notes?: string;

  // UI metadata
  indent_level: number; // For hierarchical display
  expandable: boolean;
  expanded: boolean;
}

/**
 * Template calculation result
 * Returned by template calculation functions
 */
export interface TemplateCalculationResult {
  // Adjustments to apply
  adjustments: Array<{
    account_id: string;
    account_name: string;
    adjustment_amount: number;
    description: string;
  }>;

  // Summary of impact
  impact: {
    revenue_change: number;
    expense_change: number;
    profit_change: number;
    cash_flow_change: number;
    tax_liability_change: number;
  };

  // Explanation for client
  explanation: string;
}

/**
 * Scenario comparison view data
 * For side-by-side Current | Adjustment | Projected table
 */
export interface ScenarioComparisonData {
  scenario_name: string;
  baseline_date: number;

  sections: Array<{
    section_name: string; // "Revenue", "Expenses", "Assets", etc.
    section_type: 'revenue' | 'expense' | 'asset' | 'liability' | 'equity';

    rows: ScenarioWorksheetRow[];

    section_total: {
      current: number;
      adjustment: number;
      projected: number;
    };
  }>;

  grand_totals: {
    revenue: { current: number; adjustment: number; projected: number };
    expenses: { current: number; adjustment: number; projected: number };
    profit: { current: number; adjustment: number; projected: number };
  };
}

/**
 * Client view of scenario (simplified for non-accountants)
 */
export interface ScenarioClientView {
  scenario_name: string;
  description: string;
  advisor_name: string;
  advisor_note: string;

  // Summary cards
  summary: {
    current_profit: number;
    projected_profit: number;
    profit_change: number;
    profit_change_percentage: number;

    current_revenue: number;
    projected_revenue: number;

    current_expenses: number;
    projected_expenses: number;

    one_time_costs: number;
    runway_impact: string; // Human-readable: "+3 months", "No change", etc.
  };

  // Key changes explained in plain English
  key_changes: Array<{
    title: string;
    description: string;
    impact: string;
    amount: number;
    is_positive: boolean;
  }>;

  // Advisor's notes
  notes: ScenarioNote[];

  // Comments (from both advisor and client)
  comments: ScenarioComment[];

  // Actions available to client
  can_comment: boolean;
  can_accept: boolean;
  can_decline: boolean;
  can_edit: boolean;

  shared_at: number;
  viewed_at: number | null;
}

/**
 * Formula parsing result
 * For freeform adjustments with formulas
 */
export interface FormulaParseResult {
  is_valid: boolean;
  error_message?: string;

  // Referenced accounts/cells
  references: Array<{
    type: 'account' | 'cell';
    id: string;
    name: string;
  }>;

  // Calculated value
  calculated_value?: number;
}
