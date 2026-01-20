/**
 * Financial Metrics Type Definitions
 *
 * Type definitions for J4: Key Financial Metrics Reports
 * Supports 7 categories of professional financial ratios and metrics.
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Period comparison options for metrics
 */
export type MetricPeriod = 'month' | 'quarter' | 'year' | 'custom';

/**
 * Trend direction indicator
 */
export type TrendDirection = 'improving' | 'stable' | 'declining';

/**
 * Date range for metric calculations
 */
export interface DateRange {
  start_date: number; // Unix timestamp
  end_date: number; // Unix timestamp
}

/**
 * Barter revenue options (I5 integration)
 */
export interface BarterRevenueOptions {
  include_barter: boolean; // Default: true
  has_barter_transactions: boolean; // Whether any barter transactions exist
}

/**
 * Base metric interface
 */
export interface Metric {
  value: string; // Decimal value as string
  formatted_value: string; // Formatted for display (e.g., "1.5", "45.2%")
  plain_english_explanation: string;
  trend_direction?: TrendDirection;
  trend_percentage?: string; // Change from previous period
  industry_benchmark?: string; // Optional industry average
}

/**
 * Historical data point for trend charts
 */
export interface MetricDataPoint {
  date: number; // Unix timestamp (typically month-end)
  value: string; // Decimal value as string
  label: string; // Formatted label (e.g., "Jan 2025")
}

// ============================================================================
// 1. Liquidity Metrics
// ============================================================================

export interface LiquidityMetrics {
  current_ratio: Metric;
  quick_ratio: Metric;
  cash_ratio: Metric;
  working_capital: Metric;
  cash_runway_months: Metric;
  date_range: DateRange;
  history: {
    current_ratio: MetricDataPoint[];
    quick_ratio: MetricDataPoint[];
    cash_ratio: MetricDataPoint[];
    working_capital: MetricDataPoint[];
  };
}

export interface LiquidityMetricsRequest {
  company_id: string;
  as_of_date: number; // Unix timestamp
  include_history?: boolean; // Default: true (12 months)
}

// ============================================================================
// 2. Profitability Metrics
// ============================================================================

export interface ProfitabilityMetrics {
  gross_profit_margin: Metric;
  net_profit_margin: Metric;
  operating_margin: Metric;
  return_on_equity: Metric;
  return_on_assets: Metric;
  revenue_per_employee?: Metric; // Optional if payroll data available
  date_range: DateRange;
  barter_options: BarterRevenueOptions;
  revenue_breakdown?: {
    cash_revenue: string;
    accrual_revenue: string;
    barter_revenue: string;
    total_revenue: string;
  };
  history: {
    gross_profit_margin: MetricDataPoint[];
    net_profit_margin: MetricDataPoint[];
    operating_margin: MetricDataPoint[];
    return_on_equity: MetricDataPoint[];
    return_on_assets: MetricDataPoint[];
  };
}

export interface ProfitabilityMetricsRequest {
  company_id: string;
  date_range: DateRange;
  include_barter: boolean; // Default: true
  include_history?: boolean; // Default: true (12 months)
}

// ============================================================================
// 3. Efficiency Metrics
// ============================================================================

export interface EfficiencyMetrics {
  ar_turnover: Metric;
  days_sales_outstanding: Metric;
  ap_turnover: Metric;
  days_payable_outstanding: Metric;
  inventory_turnover?: Metric; // Optional if inventory tracking active
  inventory_days?: Metric; // Optional if inventory tracking active
  date_range: DateRange;
  history: {
    ar_turnover: MetricDataPoint[];
    days_sales_outstanding: MetricDataPoint[];
    ap_turnover: MetricDataPoint[];
    inventory_turnover: MetricDataPoint[];
  };
}

export interface EfficiencyMetricsRequest {
  company_id: string;
  date_range: DateRange;
  include_history?: boolean; // Default: true (12 months)
}

// ============================================================================
// 4. Leverage Metrics
// ============================================================================

export interface LeverageMetrics {
  debt_to_equity: Metric;
  debt_to_assets: Metric;
  interest_coverage: Metric;
  equity_multiplier: Metric;
  date_range: DateRange;
  history: {
    debt_to_equity: MetricDataPoint[];
    debt_to_assets: MetricDataPoint[];
    interest_coverage: MetricDataPoint[];
  };
}

export interface LeverageMetricsRequest {
  company_id: string;
  as_of_date: number; // Unix timestamp
  include_history?: boolean; // Default: true (12 months)
}

// ============================================================================
// 5. Cash Flow Metrics
// ============================================================================

export interface CashFlowMetrics {
  operating_cash_flow: Metric;
  free_cash_flow: Metric;
  cash_conversion_cycle: Metric;
  operating_cash_flow_ratio: Metric;
  date_range: DateRange;
  history: {
    operating_cash_flow: MetricDataPoint[];
    free_cash_flow: MetricDataPoint[];
    cash_conversion_cycle: MetricDataPoint[];
  };
}

export interface CashFlowMetricsRequest {
  company_id: string;
  date_range: DateRange;
  include_history?: boolean; // Default: true (12 months)
}

// ============================================================================
// 6. Growth Metrics
// ============================================================================

export interface GrowthMetrics {
  revenue_growth_rate: Metric;
  profit_growth_rate: Metric;
  customer_growth_rate?: Metric; // Optional if customer tracking available
  asset_growth_rate: Metric;
  date_range: DateRange;
  comparison_period: DateRange; // Previous period for comparison
  history: {
    revenue_growth_rate: MetricDataPoint[];
    profit_growth_rate: MetricDataPoint[];
    customer_growth_rate: MetricDataPoint[];
  };
}

export interface GrowthMetricsRequest {
  company_id: string;
  date_range: DateRange;
  comparison_period: DateRange; // Previous period to compare against
  include_barter: boolean; // Default: true
  include_history?: boolean; // Default: true (12 months)
}

// ============================================================================
// 7. Valuation Multiples
// ============================================================================

export interface ValuationMetrics {
  price_to_earnings?: Metric; // Optional if equity value provided
  enterprise_value_to_ebitda?: Metric; // Optional if enterprise value provided
  revenue_multiple?: Metric; // Optional if business value provided
  price_to_book?: Metric; // Optional if market value provided
  date_range: DateRange;
  valuation_inputs?: {
    market_value?: string;
    enterprise_value?: string;
  };
  history: {
    revenue_multiple: MetricDataPoint[];
  };
}

export interface ValuationMetricsRequest {
  company_id: string;
  date_range: DateRange;
  market_value?: string; // Optional: Current market value of business
  enterprise_value?: string; // Optional: Enterprise value
  include_history?: boolean; // Default: true (12 months)
}

// ============================================================================
// Summary Dashboard
// ============================================================================

/**
 * Traffic light indicator for quick scanning
 */
export type MetricStatus = 'good' | 'warning' | 'concern';

/**
 * Key metric summary for dashboard
 */
export interface MetricSummary {
  name: string;
  value: string;
  formatted_value: string;
  status: MetricStatus;
  trend_direction: TrendDirection;
  short_explanation: string; // One sentence
}

/**
 * All metrics summary dashboard
 */
export interface MetricsDashboard {
  company_id: string;
  as_of_date: number;
  date_range: DateRange;

  key_metrics: {
    liquidity: MetricSummary[];
    profitability: MetricSummary[];
    efficiency: MetricSummary[];
    leverage: MetricSummary[];
    cash_flow: MetricSummary[];
    growth: MetricSummary[];
  };

  overall_health_notes?: string[]; // Optional insights
  barter_options: BarterRevenueOptions;
}

export interface MetricsDashboardRequest {
  company_id: string;
  as_of_date: number;
  date_range: DateRange;
  include_barter: boolean; // Default: true
}

// ============================================================================
// Sharing & Export
// ============================================================================

/**
 * Accountant notes for client sharing
 */
export interface MetricsReportNotes {
  report_id: string;
  company_id: string;
  accountant_notes: string; // Plain text notes
  selected_metrics: string[]; // Metric IDs to include in shared report
  include_industry_benchmarks: boolean;
  created_at: number;
  created_by_user_id: string;
}

/**
 * Export format options
 */
export type ExportFormat = 'pdf' | 'excel' | 'csv';

/**
 * Export request
 */
export interface MetricsExportRequest {
  company_id: string;
  date_range: DateRange;
  format: ExportFormat;
  include_charts: boolean; // For PDF export
  include_explanations: boolean;
  include_benchmarks: boolean;
  accountant_notes?: string;
  selected_categories: MetricCategory[];
}

/**
 * Metric categories
 */
export type MetricCategory =
  | 'liquidity'
  | 'profitability'
  | 'efficiency'
  | 'leverage'
  | 'cash_flow'
  | 'growth'
  | 'valuation';

// ============================================================================
// Industry Benchmarks
// ============================================================================

/**
 * Industry benchmark data
 */
export interface IndustryBenchmark {
  industry: string; // e.g., "Retail", "Professional Services"
  metric_name: string;
  median: string;
  lower_quartile: string;
  upper_quartile: string;
  source: string; // Data source
  as_of_year: number;
}

/**
 * Industry benchmark request
 */
export interface IndustryBenchmarkRequest {
  industry: string;
  metric_names: string[];
}

// ============================================================================
// Drill-Down
// ============================================================================

/**
 * Drill-down to underlying transactions
 */
export interface MetricDrillDownRequest {
  company_id: string;
  metric_name: string;
  date_range: DateRange;
}

/**
 * Transaction summary for drill-down
 */
export interface MetricTransactionSummary {
  transaction_id: string;
  transaction_date: number;
  description: string;
  amount: string;
  account_name: string;
  type: string;
}

/**
 * Drill-down response
 */
export interface MetricDrillDownResponse {
  metric_name: string;
  metric_value: string;
  calculation_details: string; // Explanation of how metric was calculated
  underlying_transactions: MetricTransactionSummary[];
  total_transaction_count: number;
}
