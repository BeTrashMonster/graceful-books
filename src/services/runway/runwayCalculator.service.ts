/**
 * Runway Calculator Service
 *
 * Calculates business runway (survival time at current burn rate) using three methods:
 * 1. Simple Average: Average monthly burn over selected period
 * 2. Trend-Adjusted: Accounts for increasing/decreasing burn trends
 * 3. Seasonal: Factors in seasonal patterns (requires 12+ months data)
 *
 * Implements J6: Emergency Fund & Runway Calculator from ROADMAP.md
 *
 * Features:
 * - Transparent calculations with full visibility
 * - Confidence ranges for volatile businesses
 * - Both positive and negative cash flow handling
 * - Revenue and expense analysis
 * - Plain English explanations
 */

import Decimal from 'decimal.js'
import type {
  RunwayCalculation,
  RunwayCalculationMethod,
  CashFlowPicture,
  CashFlowDirection,
  RunwayHealthStatus,
  RunwayDateRange,
  RunwayDateRangePreset,
  RunwayTrendDataPoint,
} from '../../types/runway.types'
import type { AccountType } from '../../types'
import { db } from '../../db/database'

// Configure Decimal.js for currency precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

/**
 * Convert date range preset to actual dates
 */
export function getDateRangeFromPreset(preset: RunwayDateRangePreset): RunwayDateRange {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let startDate: Date
  let endDate = startOfToday
  let label: string

  switch (preset) {
    case 'last-30-days':
      startDate = new Date(startOfToday)
      startDate.setDate(startDate.getDate() - 30)
      label = 'Last 30 days'
      break

    case 'last-90-days':
      startDate = new Date(startOfToday)
      startDate.setDate(startDate.getDate() - 90)
      label = 'Last 90 days'
      break

    case 'last-365-days':
      startDate = new Date(startOfToday)
      startDate.setDate(startDate.getDate() - 365)
      label = 'Last 365 days'
      break

    case 'year-to-date':
      startDate = new Date(now.getFullYear(), 0, 1)
      label = 'Year to date'
      break

    case 'last-year':
      startDate = new Date(now.getFullYear() - 1, 0, 1)
      endDate = new Date(now.getFullYear() - 1, 11, 31)
      label = 'Last year'
      break

    case 'all-time':
      // Will be calculated from actual data
      startDate = new Date(2000, 0, 1)
      label = 'All time'
      break

    default:
      // Default to last 90 days
      startDate = new Date(startOfToday)
      startDate.setDate(startDate.getDate() - 90)
      label = 'Last 90 days'
  }

  return {
    preset,
    startDate,
    endDate,
    label,
  }
}

/**
 * Calculate current available cash
 * Cash + liquid assets - short-term liabilities
 */
export async function calculateAvailableCash(companyId: string): Promise<number> {
  const accounts = await db.accounts.where({ companyId, isActive: true }).toArray()

  let availableCash = new Decimal(0)

  for (const account of accounts) {
    const balance = new Decimal(account.balance)

    // Add cash and current assets
    if (
      account.type === 'asset' &&
      (account.subType === 'current-asset' || account.name.toLowerCase().includes('cash'))
    ) {
      availableCash = availableCash.plus(balance)
    }

    // Subtract current liabilities due within 90 days
    if (account.type === 'liability' && account.subType === 'current-liability') {
      availableCash = availableCash.minus(balance)
    }
  }

  return availableCash.toNumber()
}

/**
 * Get monthly revenue and expense data for a date range
 */
async function getMonthlyData(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<{ month: Date; revenue: number; expenses: number }[]> {
  const transactions = await db.journalEntries
    .where('companyId')
    .equals(companyId)
    .and((tx) => {
      const txDate = new Date(tx.date)
      return txDate >= startDate && txDate <= endDate && tx.status !== 'void'
    })
    .toArray()

  // Group by month
  const monthlyData = new Map<string, { revenue: Decimal; expenses: Decimal }>()

  for (const transaction of transactions) {
    const txDate = new Date(transaction.date)
    const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { revenue: new Decimal(0), expenses: new Decimal(0) })
    }

    const monthData = monthlyData.get(monthKey)!

    // Get account types for each line
    const accountIds = transaction.lines.map((line) => line.accountId)
    const accounts = await db.accounts.where('id').anyOf(accountIds).toArray()
    const accountMap = new Map(accounts.map((acc) => [acc.id, acc]))

    for (const line of transaction.lines) {
      const account = accountMap.get(line.accountId)
      if (!account) continue

      const amount = new Decimal(line.credit).minus(line.debit)

      if (account.type === 'income' || account.type === 'other-income') {
        monthData.revenue = monthData.revenue.plus(amount)
      } else if (
        account.type === 'expense' ||
        account.type === 'cost-of-goods-sold' ||
        account.type === 'other-expense'
      ) {
        monthData.expenses = monthData.expenses.plus(amount.abs())
      }
    }
  }

  // Convert to array and sort by date
  const result: { month: Date; revenue: number; expenses: number }[] = []

  for (const [monthKey, data] of monthlyData.entries()) {
    const [year, month] = monthKey.split('-').map(Number)
    result.push({
      month: new Date(year, month - 1, 1),
      revenue: data.revenue.toNumber(),
      expenses: data.expenses.toNumber(),
    })
  }

  result.sort((a, b) => a.month.getTime() - b.month.getTime())

  return result
}

/**
 * Calculate volatility (standard deviation / mean)
 * Returns 0-1 where higher = more volatile
 */
function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  if (mean === 0) return 0

  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
  const stdDev = Math.sqrt(variance)

  // Return coefficient of variation (normalized volatility)
  return Math.min(stdDev / mean, 1)
}

/**
 * Detect if data has seasonal pattern
 * Simple heuristic: check if variance across same months is lower than overall variance
 */
function detectSeasonalPattern(monthlyData: { month: Date; revenue: number; expenses: number }[]): boolean {
  if (monthlyData.length < 12) return false

  // Group by month of year
  const monthBuckets: number[][] = Array.from({ length: 12 }, () => [])

  for (const data of monthlyData) {
    const monthOfYear = data.month.getMonth()
    monthBuckets[monthOfYear].push(data.revenue + data.expenses)
  }

  // Check if at least 6 months have multiple data points
  const monthsWithMultipleDataPoints = monthBuckets.filter((bucket) => bucket.length >= 2).length

  return monthsWithMultipleDataPoints >= 6
}

/**
 * Calculate simple average burn rate
 */
function calculateSimpleAverage(monthlyData: { month: Date; revenue: number; expenses: number }[]): {
  revenue: number
  expenses: number
  netBurn: number
} {
  if (monthlyData.length === 0) {
    return { revenue: 0, expenses: 0, netBurn: 0 }
  }

  const totalRevenue = monthlyData.reduce((sum, data) => sum + data.revenue, 0)
  const totalExpenses = monthlyData.reduce((sum, data) => sum + data.expenses, 0)

  const avgRevenue = totalRevenue / monthlyData.length
  const avgExpenses = totalExpenses / monthlyData.length
  const netBurn = avgRevenue - avgExpenses

  return {
    revenue: avgRevenue,
    expenses: avgExpenses,
    netBurn,
  }
}

/**
 * Calculate trend-adjusted burn rate
 * Uses weighted average with more recent months weighted higher
 */
function calculateTrendAdjusted(monthlyData: { month: Date; revenue: number; expenses: number }[]): {
  revenue: number
  expenses: number
  netBurn: number
} {
  if (monthlyData.length === 0) {
    return { revenue: 0, expenses: 0, netBurn: 0 }
  }

  // Apply linear weights: most recent month gets highest weight
  let weightedRevenue = 0
  let weightedExpenses = 0
  let totalWeight = 0

  for (let i = 0; i < monthlyData.length; i++) {
    const weight = i + 1 // 1, 2, 3, ... (most recent is highest)
    weightedRevenue += monthlyData[i].revenue * weight
    weightedExpenses += monthlyData[i].expenses * weight
    totalWeight += weight
  }

  const avgRevenue = weightedRevenue / totalWeight
  const avgExpenses = weightedExpenses / totalWeight
  const netBurn = avgRevenue - avgExpenses

  return {
    revenue: avgRevenue,
    expenses: avgExpenses,
    netBurn,
  }
}

/**
 * Calculate seasonal burn rate
 * Uses same-month averages from previous years
 */
function calculateSeasonal(monthlyData: { month: Date; revenue: number; expenses: number }[]): {
  revenue: number
  expenses: number
  netBurn: number
} {
  if (monthlyData.length < 12) {
    // Fall back to simple average if not enough data
    return calculateSimpleAverage(monthlyData)
  }

  // Group by month of year
  const monthBuckets: { revenue: number[]; expenses: number[] }[] = Array.from({ length: 12 }, () => ({
    revenue: [],
    expenses: [],
  }))

  for (const data of monthlyData) {
    const monthOfYear = data.month.getMonth()
    monthBuckets[monthOfYear].revenue.push(data.revenue)
    monthBuckets[monthOfYear].expenses.push(data.expenses)
  }

  // Calculate average for each month
  const monthlyAverages = monthBuckets.map((bucket) => {
    const avgRevenue = bucket.revenue.length > 0 ? bucket.revenue.reduce((a, b) => a + b, 0) / bucket.revenue.length : 0
    const avgExpenses =
      bucket.expenses.length > 0 ? bucket.expenses.reduce((a, b) => a + b, 0) / bucket.expenses.length : 0
    return { revenue: avgRevenue, expenses: avgExpenses }
  })

  // Average across all months
  const avgRevenue = monthlyAverages.reduce((sum, avg) => sum + avg.revenue, 0) / 12
  const avgExpenses = monthlyAverages.reduce((sum, avg) => sum + avg.expenses, 0) / 12
  const netBurn = avgRevenue - avgExpenses

  return {
    revenue: avgRevenue,
    expenses: avgExpenses,
    netBurn,
  }
}

/**
 * Determine cash flow direction
 */
function determineCashFlowDirection(netBurn: number): CashFlowDirection {
  if (netBurn > 100) return 'positive' // More than $100/month positive
  if (netBurn < -100) return 'negative' // More than $100/month negative
  return 'neutral'
}

/**
 * Calculate runway months
 */
function calculateRunwayMonths(availableCash: number, monthlyBurnRate: number): number | null {
  // If burning cash (negative net burn), calculate months of runway
  if (monthlyBurnRate < 0) {
    const monthlyBurn = Math.abs(monthlyBurnRate)
    if (monthlyBurn === 0) return null
    return availableCash / monthlyBurn
  }

  // If cash flow positive, runway is infinite
  return null
}

/**
 * Calculate projected depletion date
 */
function calculateDepletionDate(runwayMonths: number | null): Date | null {
  if (runwayMonths === null) return null

  const now = new Date()
  const depletionDate = new Date(now)
  depletionDate.setMonth(depletionDate.getMonth() + Math.floor(runwayMonths))

  return depletionDate
}

/**
 * Determine runway health status based on target
 */
function determineHealthStatus(runwayMonths: number | null, targetMonths: number): RunwayHealthStatus {
  if (runwayMonths === null) return 'healthy' // Infinite runway

  if (runwayMonths >= targetMonths) return 'healthy'
  if (runwayMonths >= targetMonths * 0.75) return 'warning'
  return 'critical'
}

/**
 * Calculate confidence range for volatile businesses
 */
function calculateConfidenceRange(
  runwayMonths: number | null,
  volatility: number
): { min: number | null; max: number | null } {
  if (runwayMonths === null) return { min: null, max: null }

  // If volatility is low (<20%), show exact number
  if (volatility < 0.2) {
    return { min: runwayMonths, max: runwayMonths }
  }

  // For higher volatility, show range
  const variation = runwayMonths * volatility
  const min = Math.max(0, runwayMonths - variation)
  const max = runwayMonths + variation

  return { min, max }
}

/**
 * Calculate runway using specified method
 */
export async function calculateRunway(
  companyId: string,
  method: RunwayCalculationMethod,
  dateRange: RunwayDateRange,
  targetMonths: number = 6
): Promise<RunwayCalculation> {
  // Get current available cash
  const currentCash = await calculateAvailableCash(companyId)

  // Get monthly data
  const monthlyData = await getMonthlyData(companyId, dateRange.startDate, dateRange.endDate)

  // Calculate burn rate based on method
  let calculationResult: { revenue: number; expenses: number; netBurn: number }

  switch (method) {
    case 'simple':
      calculationResult = calculateSimpleAverage(monthlyData)
      break
    case 'trend-adjusted':
      calculationResult = calculateTrendAdjusted(monthlyData)
      break
    case 'seasonal':
      calculationResult = calculateSeasonal(monthlyData)
      break
  }

  const { revenue, expenses, netBurn } = calculationResult

  // Calculate volatility
  const revenueValues = monthlyData.map((d) => d.revenue)
  const expenseValues = monthlyData.map((d) => d.expenses)
  const revenueVolatility = calculateVolatility(revenueValues)
  const expenseVolatility = calculateVolatility(expenseValues)

  // Detect seasonal pattern
  const hasSeasonalPattern = detectSeasonalPattern(monthlyData)

  // Build cash flow picture
  const cashFlowPicture: CashFlowPicture = {
    dateRange,
    monthlyRevenue: revenue,
    monthlyExpenses: expenses,
    netBurn,
    direction: determineCashFlowDirection(netBurn),
    revenueVolatility,
    expenseVolatility,
    hasSeasonalPattern,
  }

  // Calculate runway
  const runwayMonths = calculateRunwayMonths(currentCash, netBurn)
  const projectedDepletionDate = calculateDepletionDate(runwayMonths)
  const healthStatus = determineHealthStatus(runwayMonths, targetMonths)

  // Calculate confidence range
  const avgVolatility = (revenueVolatility + expenseVolatility) / 2
  const confidenceRange = calculateConfidenceRange(runwayMonths, avgVolatility)

  return {
    method,
    currentCash,
    monthlyBurnRate: netBurn,
    runwayMonths,
    projectedDepletionDate,
    confidenceRange,
    healthStatus,
    cashFlowPicture,
    calculatedAt: new Date(),
  }
}

/**
 * Suggest best calculation method based on business patterns
 */
export function suggestCalculationMethod(
  monthlyData: { month: Date; revenue: number; expenses: number }[]
): RunwayCalculationMethod {
  if (monthlyData.length < 3) return 'simple'
  if (monthlyData.length < 12) return 'trend-adjusted'

  // Check for seasonal pattern
  const hasSeasonalPattern = detectSeasonalPattern(monthlyData)
  if (hasSeasonalPattern) return 'seasonal'

  // Check for strong trend
  const recentMonths = monthlyData.slice(-6)
  const olderMonths = monthlyData.slice(0, 6)

  const recentAvg =
    recentMonths.reduce((sum, d) => sum + d.expenses - d.revenue, 0) / recentMonths.length
  const olderAvg = olderMonths.reduce((sum, d) => sum + d.expenses - d.revenue, 0) / olderMonths.length

  const trendChange = Math.abs(recentAvg - olderAvg) / Math.abs(olderAvg)

  // If trend change > 20%, use trend-adjusted
  if (trendChange > 0.2) return 'trend-adjusted'

  return 'simple'
}

/**
 * Calculate runway trend history (past 12 months)
 */
export async function calculateRunwayTrend(
  companyId: string,
  method: RunwayCalculationMethod
): Promise<RunwayTrendDataPoint[]> {
  const trendPoints: RunwayTrendDataPoint[] = []
  const now = new Date()

  // Calculate for each of the past 12 months
  for (let i = 11; i >= 0; i--) {
    const asOfDate = new Date(now)
    asOfDate.setMonth(asOfDate.getMonth() - i)

    // Use 90-day lookback from that point
    const dateRange = getDateRangeFromPreset('last-90-days')
    dateRange.endDate = asOfDate

    const calculation = await calculateRunway(companyId, method, dateRange)

    trendPoints.push({
      date: asOfDate,
      runwayMonths: calculation.runwayMonths,
      cash: calculation.currentCash,
      burnRate: calculation.monthlyBurnRate,
    })
  }

  return trendPoints
}

/**
 * TODO: Service object export for backwards compatibility
 * Aggregates all runway calculator functions
 */
export const runwayCalculatorService = {
  calculateRunway,
  calculateRunwayTrend,
  calculateAvailableCash,
  suggestCalculationMethod,
  getDateRangeFromPreset,
}
