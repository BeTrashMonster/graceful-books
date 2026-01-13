/**
 * Reporting Utilities
 *
 * Utility functions for financial report generation including:
 * - Date range calculations
 * - Comparison period logic
 * - Educational content mapping
 * - Report formatting helpers
 */

import {
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subMonths,
  subQuarters,
  subYears,
  differenceInDays,
} from 'date-fns'
import type { DateRange, DateRangePreset, ComparisonPeriod } from '../types/reports.types'

/**
 * Get date range from preset
 *
 * @param preset - Predefined date range option
 * @param referenceDate - Reference date (default: today)
 * @returns Date range with start and end dates
 */
export function getDateRangeFromPreset(
  preset: DateRangePreset,
  referenceDate: Date = new Date()
): DateRange {
  const today = referenceDate

  switch (preset) {
    case 'this-month':
      return {
        startDate: startOfMonth(today),
        endDate: endOfMonth(today),
        preset,
        label: 'This Month',
      }

    case 'last-month': {
      const lastMonth = subMonths(today, 1)
      return {
        startDate: startOfMonth(lastMonth),
        endDate: endOfMonth(lastMonth),
        preset,
        label: 'Last Month',
      }
    }

    case 'this-quarter':
      return {
        startDate: startOfQuarter(today),
        endDate: endOfQuarter(today),
        preset,
        label: 'This Quarter',
      }

    case 'last-quarter': {
      const lastQuarter = subQuarters(today, 1)
      return {
        startDate: startOfQuarter(lastQuarter),
        endDate: endOfQuarter(lastQuarter),
        preset,
        label: 'Last Quarter',
      }
    }

    case 'this-year':
      return {
        startDate: startOfYear(today),
        endDate: endOfYear(today),
        preset,
        label: 'This Year',
      }

    case 'last-year': {
      const lastYear = subYears(today, 1)
      return {
        startDate: startOfYear(lastYear),
        endDate: endOfYear(lastYear),
        preset,
        label: 'Last Year',
      }
    }

    case 'year-to-date':
      return {
        startDate: startOfYear(today),
        endDate: today,
        preset,
        label: 'Year to Date',
      }

    case 'custom':
    default:
      return {
        startDate: startOfMonth(today),
        endDate: endOfMonth(today),
        preset: 'custom',
        label: 'Custom Range',
      }
  }
}

/**
 * Get comparison period for a date range
 *
 * @param dateRange - Primary date range
 * @param type - Comparison type
 * @returns Comparison period configuration
 */
export function getComparisonPeriod(
  dateRange: DateRange,
  type: ComparisonPeriod['type']
): ComparisonPeriod {
  const { startDate, endDate } = dateRange
  const periodLength = differenceInDays(endDate, startDate) + 1

  if (type === 'previous-period') {
    // Same length period immediately before
    const comparisonEndDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000) // 1 day before start
    const comparisonStartDate = new Date(comparisonEndDate.getTime() - (periodLength - 1) * 24 * 60 * 60 * 1000)

    return {
      enabled: true,
      type: 'previous-period',
      startDate: comparisonStartDate,
      endDate: comparisonEndDate,
      label: 'Previous Period',
    }
  }

  if (type === 'previous-year') {
    // Same period one year ago
    return {
      enabled: true,
      type: 'previous-year',
      startDate: subYears(startDate, 1),
      endDate: subYears(endDate, 1),
      label: 'Previous Year',
    }
  }

  // Custom - return disabled by default
  return {
    enabled: false,
    type: 'custom',
    label: 'Custom Comparison',
  }
}

/**
 * Calculate variance between two amounts
 *
 * @param current - Current period amount
 * @param comparison - Comparison period amount
 * @returns Variance amount (current - comparison)
 */
export function calculateVariance(current: number, comparison: number): number {
  return current - comparison
}

/**
 * Calculate variance percentage
 *
 * @param current - Current period amount
 * @param comparison - Comparison period amount
 * @returns Variance as percentage, or null if comparison is zero
 */
export function calculateVariancePercentage(
  current: number,
  comparison: number
): number | null {
  if (comparison === 0) {
    // Can't calculate percentage change from zero
    return current === 0 ? 0 : null
  }

  return ((current - comparison) / Math.abs(comparison)) * 100
}

/**
 * Format variance for display
 *
 * @param variance - Variance amount
 * @param isPercentage - Whether to format as percentage
 * @returns Formatted string with sign indicator
 */
export function formatVariance(variance: number, isPercentage: boolean = false): string {
  const sign = variance > 0 ? '+' : ''
  const value = isPercentage ? `${variance.toFixed(1)}%` : variance.toFixed(2)
  return `${sign}${value}`
}

/**
 * Get educational content for P&L sections
 *
 * Returns plain English explanations for report sections following
 * the Steadiness communication style.
 */
export const educationalContent = {
  revenue: {
    title: 'Revenue (Income)',
    description: 'All money you earn from selling products or services',
    plainEnglish:
      'This is the money coming in from your customers. Every time you make a sale, it shows up here.',
    whyItMatters:
      "Revenue is the lifeblood of your business. It's where everything starts. The higher your revenue, the more money you have to work with.",
  },

  costOfGoodsSold: {
    title: 'Cost of Goods Sold (COGS)',
    description: 'Direct costs to create the products or services you sold',
    plainEnglish:
      'These are the costs directly tied to making your product or delivering your service. For example, if you sell handmade candles, this includes the wax, wicks, and containers.',
    whyItMatters:
      'Understanding your COGS helps you know if your pricing is working. If COGS is too high compared to revenue, you might need to adjust your prices or find cheaper suppliers.',
  },

  grossProfit: {
    title: 'Gross Profit',
    description: 'Revenue minus Cost of Goods Sold',
    plainEnglish:
      "This is what's left after you subtract the direct costs of making your product or service from your revenue. It's your profit before operating expenses.",
    whyItMatters:
      'Gross profit shows if your core business model is profitable. This should be positive for a healthy business.',
  },

  operatingExpenses: {
    title: 'Operating Expenses',
    description: 'Costs to run your business day-to-day',
    plainEnglish:
      'These are all the other costs of running your business: rent, utilities, marketing, software subscriptions, and salaries. Everything except the direct costs of making your product.',
    whyItMatters:
      'Keeping operating expenses under control is crucial. These costs can add up quickly and eat into your profits.',
  },

  operatingIncome: {
    title: 'Operating Income',
    description: 'Gross profit minus operating expenses',
    plainEnglish:
      "This is your profit from your main business activities. It's what's left after all your regular business expenses.",
    whyItMatters:
      "This tells you if your business is fundamentally profitable. It's a key number investors and lenders look at.",
  },

  netIncome: {
    title: 'Net Income (Bottom Line)',
    description: 'Your total profit or loss for the period',
    plainEnglish:
      "This is the bottom line. After all revenue comes in and all expenses go out, this is what's left. If it's positive, you made a profit. If it's negative, you had a loss.",
    whyItMatters:
      "Net income determines if you're making money or losing money. It's the most important number on your P&L.",
  },

  profitable: {
    title: 'You Made Money!',
    description: 'Your business generated a profit this period',
    plainEnglish:
      'Great work! Your revenue was higher than your expenses this period. This means your business is generating profit.',
    whyItMatters:
      "Consistent profitability is the goal. Keep doing what's working, and look for ways to grow your revenue or reduce expenses even further.",
  },

  loss: {
    title: 'This Period Showed a Loss',
    description: 'Your expenses were higher than revenue',
    plainEnglish:
      "This period showed a loss, which means your expenses were higher than your revenue. This is common when you're just starting out or investing heavily in growth.",
    whyItMatters:
      "Let's look at where we can improve. Are there expenses you can reduce? Can you increase your sales? Understanding the numbers helps you make better decisions moving forward.",
  },
}

/**
 * Get "What does this mean?" content
 *
 * Returns simple explanations for key P&L concepts
 */
export const whatDoesThisMean = {
  revenue:
    'Revenue is all the money you earn from your customers. Every time someone pays you for your product or service, it counts as revenue.',

  costOfGoodsSold:
    'These are the direct costs of making what you sell. If you sell physical products, this includes materials and manufacturing. If you sell services, it might include contractor costs.',

  grossProfit:
    'Gross Profit = Revenue minus Cost of Goods Sold. It shows how much money you keep after paying for the direct costs of your product or service.',

  operatingExpenses:
    'These are all the other costs of running your business: rent, utilities, marketing, software, salaries, insurance, and more. Everything except the direct costs of making your product.',

  operatingIncome:
    'Operating Income = Gross Profit minus Operating Expenses. It shows whether your core business is profitable, before accounting for taxes and other items.',

  netIncome:
    'Net Income is your bottom line. Revenue minus all expenses equals your profit (or loss). This is the most important number showing whether your business made money this period.',

  profitable:
    "You're profitable when your total revenue exceeds your total expenses. This means your business generated more money than it spent.",

  loss:
    "A loss occurs when your total expenses exceed your revenue. While losses aren't ideal, they're sometimes necessary during growth periods or startup phases. The key is understanding why and having a plan to return to profitability.",
}

/**
 * Format date range for display
 *
 * @param dateRange - Date range to format
 * @returns Formatted string
 */
export function formatDateRange(dateRange: DateRange): string {
  if (dateRange.label) {
    return dateRange.label
  }

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }

  const start = dateRange.startDate.toLocaleDateString('en-US', options)
  const end = dateRange.endDate.toLocaleDateString('en-US', options)

  return `${start} - ${end}`
}

/**
 * Determine if a date falls within a date range
 *
 * @param date - Date to check
 * @param range - Date range
 * @returns True if date is within range (inclusive)
 */
export function isDateInRange(date: Date, range: DateRange): boolean {
  const dateTime = date.getTime()
  const startTime = range.startDate.getTime()
  const endTime = range.endDate.getTime()

  return dateTime >= startTime && dateTime <= endTime
}
