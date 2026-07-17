/**
 * Date Range Utilities
 *
 * Provides preset date ranges and calculation utilities for the
 * "Display Amounts For" feature in Chart of Accounts.
 */

export type DateRangePeriod =
  | 'this-month'
  | 'last-month'
  | 'this-quarter'
  | 'last-quarter'
  | 'year-to-date'
  | 'last-year'
  | 'all-time'
  | 'custom'

export interface DateRange {
  startDate: Date
  endDate: Date
  label: string
}

/**
 * Get the start of a month
 */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/**
 * Get the end of a month
 */
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

/**
 * Get the start of a quarter
 */
function startOfQuarter(date: Date): Date {
  const quarter = Math.floor(date.getMonth() / 3)
  return new Date(date.getFullYear(), quarter * 3, 1)
}

/**
 * Get the end of a quarter
 */
function endOfQuarter(date: Date): Date {
  const quarter = Math.floor(date.getMonth() / 3)
  return new Date(date.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999)
}

/**
 * Get the start of a year
 */
function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1)
}

/**
 * Get the end of a year
 */
function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999)
}

/**
 * Get date range for a given period preset
 */
export function getDateRangeForPeriod(period: DateRangePeriod, customRange?: { startDate: Date; endDate: Date }): DateRange {
  const now = new Date()

  switch (period) {
    case 'this-month': {
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now),
        label: 'This Month',
      }
    }

    case 'last-month': {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return {
        startDate: startOfMonth(lastMonth),
        endDate: endOfMonth(lastMonth),
        label: 'Last Month',
      }
    }

    case 'this-quarter': {
      return {
        startDate: startOfQuarter(now),
        endDate: endOfQuarter(now),
        label: 'This Quarter',
      }
    }

    case 'last-quarter': {
      const lastQuarter = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      return {
        startDate: startOfQuarter(lastQuarter),
        endDate: endOfQuarter(lastQuarter),
        label: 'Last Quarter',
      }
    }

    case 'year-to-date': {
      return {
        startDate: startOfYear(now),
        endDate: now,
        label: 'Year to Date',
      }
    }

    case 'last-year': {
      const lastYear = new Date(now.getFullYear() - 1, 0, 1)
      return {
        startDate: startOfYear(lastYear),
        endDate: endOfYear(lastYear),
        label: 'Last Year',
      }
    }

    case 'all-time': {
      // Use a very old start date to capture all transactions
      return {
        startDate: new Date(1900, 0, 1),
        endDate: now,
        label: 'All Time',
      }
    }

    case 'custom': {
      if (customRange) {
        return {
          startDate: customRange.startDate,
          endDate: customRange.endDate,
          label: formatCustomDateRange(customRange.startDate, customRange.endDate),
        }
      }
      // Fallback to current month if no custom range provided
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now),
        label: 'Custom',
      }
    }

    default:
      return {
        startDate: startOfYear(now),
        endDate: now,
        label: 'Year to Date',
      }
  }
}

/**
 * Format a custom date range for display
 */
function formatCustomDateRange(startDate: Date, endDate: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`
}

/**
 * Get period options for dropdown
 */
export function getPeriodOptions(): Array<{ value: DateRangePeriod; label: string }> {
  return [
    { value: 'this-month', label: 'This Month' },
    { value: 'last-month', label: 'Last Month' },
    { value: 'this-quarter', label: 'This Quarter' },
    { value: 'last-quarter', label: 'Last Quarter' },
    { value: 'year-to-date', label: 'Year to Date' },
    { value: 'last-year', label: 'Last Year' },
    { value: 'all-time', label: 'All Time' },
    { value: 'custom', label: 'Custom Range...' },
  ]
}
