/**
 * Runway Calculator Types
 *
 * Types for J6: Emergency Fund & Runway Calculator
 * Tracks business survival time at current burn rate with scenario modeling
 */

/**
 * Calculation method for runway and burn rate
 */
export type RunwayCalculationMethod = 'simple' | 'trend-adjusted' | 'seasonal'

/**
 * Business type for runway recommendations
 */
export type BusinessType =
  | 'service-recurring'
  | 'service-project'
  | 'product'
  | 'seasonal'
  | 'high-growth-startup'
  | 'bootstrapped-solopreneur'
  | 'other'

/**
 * Date range preset for runway analysis
 */
export type RunwayDateRangePreset =
  | 'last-30-days'
  | 'last-90-days'
  | 'last-365-days'
  | 'year-to-date'
  | 'last-year'
  | 'all-time'
  | 'custom'

/**
 * Cash flow direction indicator
 */
export type CashFlowDirection = 'positive' | 'negative' | 'neutral'

/**
 * Runway health status based on user's target
 */
export type RunwayHealthStatus = 'healthy' | 'warning' | 'critical'

/**
 * Date range for runway calculations
 */
export interface RunwayDateRange {
  preset: RunwayDateRangePreset
  startDate: Date
  endDate: Date
  label: string
}

/**
 * Cash flow picture showing revenue vs expenses
 */
export interface CashFlowPicture {
  dateRange: RunwayDateRange
  monthlyRevenue: number
  monthlyExpenses: number
  netBurn: number
  direction: CashFlowDirection
  revenueVolatility: number // 0-1, higher = more volatile
  expenseVolatility: number // 0-1, higher = more volatile
  hasSeasonalPattern: boolean
}

/**
 * Runway calculation result
 */
export interface RunwayCalculation {
  method: RunwayCalculationMethod
  currentCash: number
  monthlyBurnRate: number
  runwayMonths: number | null // null = infinite (positive cash flow)
  projectedDepletionDate: Date | null
  confidenceRange: {
    min: number | null
    max: number | null
  }
  healthStatus: RunwayHealthStatus
  cashFlowPicture: CashFlowPicture
  calculatedAt: Date
}

/**
 * Revenue source contribution analysis
 */
export interface RevenueSource {
  id: string
  name: string
  type: 'client' | 'product' | 'service' | 'other'
  monthlyAmount: number
  percentage: number
  trend: 'growing' | 'stable' | 'declining'
  trendPercentage: number
  isRecurring: boolean
}

/**
 * Concentration risk warning
 */
export interface ConcentrationRisk {
  hasRisk: boolean
  type?: 'client' | 'product'
  name?: string
  percentage?: number
  threshold: number
  message?: string
}

/**
 * Revenue breakdown analysis
 */
export interface RevenueBreakdown {
  totalMonthlyRevenue: number
  topClients: RevenueSource[]
  topProducts: RevenueSource[]
  concentrationRisk: ConcentrationRisk
  recurringPercentage: number
  projectPercentage: number
}

/**
 * Expense category for burn rate analysis
 */
export interface ExpenseCategory {
  id: string
  name: string
  monthlyAmount: number
  percentage: number
  type: 'fixed' | 'variable' | 'semi-variable'
  trend: 'increasing' | 'stable' | 'decreasing'
  trendPercentage: number
}

/**
 * Burn rate analysis result
 */
export interface BurnRateAnalysis {
  averageBurnRate: number
  trendDirection: 'increasing' | 'stable' | 'decreasing'
  trendPercentage: number
  topExpenseCategories: ExpenseCategory[]
  fixedCostsTotal: number
  variableCostsTotal: number
  fixedPercentage: number
  variablePercentage: number
}

/**
 * Scenario type for what-if analysis
 */
export type ScenarioType =
  | 'revenue-increase'
  | 'revenue-decrease'
  | 'expense-increase'
  | 'expense-decrease'
  | 'client-loss'
  | 'product-discontinue'
  | 'new-hire'
  | 'price-increase'
  | 'combined'
  | 'custom'

/**
 * Revenue change scenario
 */
export interface RevenueScenario {
  type: 'increase' | 'decrease' | 'client-loss' | 'new-contract' | 'price-change'
  amount: number
  description: string
  clientId?: string
  clientName?: string
}

/**
 * Expense change scenario
 */
export interface ExpenseScenario {
  type: 'increase' | 'decrease' | 'new-hire' | 'cut-expense' | 'delay-purchase'
  amount: number
  description: string
  categoryId?: string
  categoryName?: string
}

/**
 * What-if scenario for runway modeling
 */
export interface RunwayScenario {
  id: string
  name: string
  scenarioType: ScenarioType
  revenueChange?: RevenueScenario
  expenseChange?: ExpenseScenario
  currentNetBurn: number
  newNetBurn: number
  currentRunway: number | null
  newRunway: number | null
  impact: 'positive' | 'negative' | 'neutral'
  impactDescription: string
  createdAt: Date
  saved?: boolean
}

/**
 * Smart scenario suggestion based on book data
 */
export interface SmartScenarioSuggestion {
  id: string
  title: string
  description: string
  scenarioType: ScenarioType
  priority: 'high' | 'medium' | 'low'
  reason: string
  revenueChange?: RevenueScenario
  expenseChange?: ExpenseScenario
}

/**
 * Emergency fund recommendation
 */
export interface EmergencyFundRecommendation {
  businessType: BusinessType
  recommendedMonths: {
    min: number
    max: number
  }
  currentMonths: number | null
  targetMonths: number
  isHealthy: boolean
  actionPlan: {
    approach: 'reduce-burn' | 'increase-cash' | 'both'
    monthlyBurnReduction?: number
    cashReserveIncrease?: number
    timeToTarget?: number // months
    description: string
  }
  rationale: string
}

/**
 * Runway alert threshold configuration
 */
export interface RunwayAlertThreshold {
  enabled: boolean
  thresholdMonths: number
  notificationMethod: 'email' | 'in-app' | 'both'
  hasBeenTriggered: boolean
  triggeredAt?: Date
}

/**
 * Runway dashboard options
 */
export interface RunwayDashboardOptions {
  companyId: string
  calculationMethod: RunwayCalculationMethod
  dateRange: RunwayDateRange
  businessType: BusinessType
  targetRunwayMonths: number
  alertThreshold?: RunwayAlertThreshold
  includeBarterTransactions?: boolean
  excludeOneTimeRevenue?: boolean
}

/**
 * Runway trend data point
 */
export interface RunwayTrendDataPoint {
  date: Date
  runwayMonths: number | null
  cash: number
  burnRate: number
}

/**
 * Complete runway dashboard data
 */
export interface RunwayDashboardData {
  companyId: string
  calculation: RunwayCalculation
  revenueBreakdown: RevenueBreakdown
  burnRateAnalysis: BurnRateAnalysis
  recommendation: EmergencyFundRecommendation
  trendHistory: RunwayTrendDataPoint[]
  smartSuggestions: SmartScenarioSuggestion[]
  alertStatus?: {
    isActive: boolean
    message: string
  }
  generatedAt: Date
}

/**
 * Runway export options
 */
export interface RunwayExportOptions {
  format: 'pdf' | 'csv' | 'json'
  includeCharts: boolean
  includeScenarios: boolean
  includeRecommendations: boolean
}
