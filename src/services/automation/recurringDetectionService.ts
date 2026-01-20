/**
 * Recurring Detection Service
 *
 * Detects recurring transactions (monthly rent, subscriptions, etc.) by analyzing
 * patterns in vendor, amount, and timing.
 *
 * Requirements:
 * - J2: Smart Automation Assistant (ROADMAP.md lines 2211-2213)
 * - Identify same vendor, similar amount, regular intervals
 * - Flag for user with option to create recurring template
 * - Weekly, monthly, quarterly, yearly patterns
 */

import { differenceInDays, format } from 'date-fns'
import { db } from '../../db/database'
import type {
  RecurringTransactionMatch,
  RecurringDetectionInput,
  AutomationSettings,
  ConfidenceLevel,
} from '../../types/automation.types'
import { logger } from '../../utils/logger'

const serviceLogger = logger.child('RecurringDetectionService')

/**
 * Historical transaction for pattern analysis
 */
interface HistoricalTransaction {
  id: string
  vendorName: string
  description: string
  amount: string
  date: number
}

/**
 * Recurring Detection Service Class
 */
export class RecurringDetectionService {
  private companyId: string
  private settings: AutomationSettings | null = null

  // Frequency detection thresholds (days)
  private readonly WEEKLY_RANGE = { min: 5, max: 9 } // 7 days ± 2
  private readonly BI_WEEKLY_RANGE = { min: 12, max: 16 } // 14 days ± 2
  private readonly MONTHLY_RANGE = { min: 26, max: 35 } // ~30 days ± 4
  private readonly QUARTERLY_RANGE = { min: 85, max: 95 } // ~90 days ± 5
  private readonly YEARLY_RANGE = { min: 350, max: 380 } // ~365 days ± 15

  // Amount variance tolerance (percentage)
  private readonly AMOUNT_VARIANCE_TOLERANCE = 0.1 // 10%

  constructor(companyId: string) {
    this.companyId = companyId
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    try {
      serviceLogger.info('Initializing recurring detection service', { companyId: this.companyId })

      // Load settings
      await this.loadSettings()

      serviceLogger.info('Recurring detection service initialized', {
        enabled: this.settings?.recurringDetectionEnabled,
      })
    } catch (error) {
      serviceLogger.error('Failed to initialize recurring detection service', { error })
      throw error
    }
  }

  /**
   * Check if transaction is potentially recurring
   */
  async detectRecurring(input: RecurringDetectionInput): Promise<RecurringTransactionMatch | null> {
    try {
      // Check if recurring detection is enabled
      if (!this.settings?.recurringDetectionEnabled) {
        return null
      }

      // Get historical transactions for this vendor
      const historical = await this.getHistoricalTransactions(input.vendorName, input.transactionDate)

      // Need minimum occurrences to detect pattern
      const minOccurrences = this.settings.recurringMinOccurrences || 3
      if (historical.length < minOccurrences - 1) {
        // -1 because current transaction would be the Nth occurrence
        return null
      }

      // Analyze transaction intervals
      const intervals = this.calculateIntervals([...historical, input])
      if (intervals.length < minOccurrences - 1) {
        return null
      }

      // Detect frequency pattern
      const frequency = this.detectFrequency(intervals)
      if (!frequency) {
        return null
      }

      // Calculate amount statistics
      const amounts = [...historical.map((t) => parseFloat(t.amount)), parseFloat(input.amount)]
      const { average, variance } = this.calculateAmountStats(amounts)

      // Check if amounts are consistent (within tolerance)
      if (variance > this.AMOUNT_VARIANCE_TOLERANCE) {
        return null // Amount varies too much
      }

      // Calculate confidence
      const confidence = this.calculateRecurringConfidence(
        historical.length + 1,
        variance,
        intervals
      )

      // Extract timing information
      const dates = [...historical.map((t) => t.date), input.transactionDate]
      const dayOfMonth = frequency === 'monthly' ? this.getMostCommonDayOfMonth(dates) : undefined
      const dayOfWeek =
        frequency === 'weekly' || frequency === 'bi-weekly'
          ? this.getMostCommonDayOfWeek(dates)
          : undefined

      // Calculate next expected date
      const nextExpectedDate = this.calculateNextExpectedDate(
        input.transactionDate,
        frequency,
        dayOfMonth,
        dayOfWeek
      )

      return {
        transactionId: input.transactionId,
        vendorName: input.vendorName,
        description: input.description,
        amount: input.amount,
        frequency,
        averageAmount: average.toFixed(2),
        amountVariance: variance,
        dayOfMonth,
        dayOfWeek,
        previousDates: dates.slice(-5), // Last 5 occurrences
        nextExpectedDate,
        confidence,
        confidenceLevel: this.getConfidenceLevel(confidence),
        matchCount: historical.length + 1,
        createdAt: Date.now(),
      }
    } catch (error) {
      serviceLogger.error('Failed to detect recurring transaction', { error, input })
      return null
    }
  }

  /**
   * Get historical transactions for vendor
   */
  private async getHistoricalTransactions(
    vendorName: string,
    beforeDate: number
  ): Promise<HistoricalTransaction[]> {
    try {
      // Placeholder - would query transactions table
      // Filter by vendor name and date before current transaction
      serviceLogger.debug('Getting historical transactions', { vendorName, beforeDate })
      return []
    } catch (error) {
      serviceLogger.error('Failed to get historical transactions', { error, vendorName })
      return []
    }
  }

  /**
   * Calculate intervals between transactions (in days)
   */
  private calculateIntervals(transactions: Array<{ date: number }>): number[] {
    if (transactions.length < 2) {
      return []
    }

    // Sort by date
    const sorted = [...transactions].sort((a, b) => a.date - b.date)

    const intervals: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      const interval = differenceInDays(new Date(sorted[i].date), new Date(sorted[i - 1].date))
      intervals.push(interval)
    }

    return intervals
  }

  /**
   * Detect frequency pattern from intervals
   */
  private detectFrequency(
    intervals: number[]
  ): 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly' | null {
    if (intervals.length === 0) {
      return null
    }

    // Calculate average interval
    const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length

    // Check if intervals are consistent (coefficient of variation < 0.15)
    const stdDev = Math.sqrt(
      intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length
    )
    const coefficientOfVariation = stdDev / avgInterval

    if (coefficientOfVariation > 0.15) {
      return null // Too much variation in intervals
    }

    // Match to frequency ranges
    if (avgInterval >= this.WEEKLY_RANGE.min && avgInterval <= this.WEEKLY_RANGE.max) {
      return 'weekly'
    }
    if (avgInterval >= this.BI_WEEKLY_RANGE.min && avgInterval <= this.BI_WEEKLY_RANGE.max) {
      return 'bi-weekly'
    }
    if (avgInterval >= this.MONTHLY_RANGE.min && avgInterval <= this.MONTHLY_RANGE.max) {
      return 'monthly'
    }
    if (avgInterval >= this.QUARTERLY_RANGE.min && avgInterval <= this.QUARTERLY_RANGE.max) {
      return 'quarterly'
    }
    if (avgInterval >= this.YEARLY_RANGE.min && avgInterval <= this.YEARLY_RANGE.max) {
      return 'yearly'
    }

    return null
  }

  /**
   * Calculate amount statistics
   */
  private calculateAmountStats(amounts: number[]): { average: number; variance: number } {
    if (amounts.length === 0) {
      return { average: 0, variance: 0 }
    }

    const average = amounts.reduce((sum, a) => sum + a, 0) / amounts.length
    const variance =
      amounts.reduce((sum, a) => sum + Math.abs(a - average), 0) / amounts.length / average

    return { average, variance }
  }

  /**
   * Calculate confidence for recurring pattern
   */
  private calculateRecurringConfidence(
    matchCount: number,
    amountVariance: number,
    intervals: number[]
  ): number {
    let confidence = 0.5 // Base confidence

    // More matches = higher confidence
    if (matchCount >= 5) confidence += 0.2
    if (matchCount >= 10) confidence += 0.1

    // Low amount variance = higher confidence
    if (amountVariance < 0.05) confidence += 0.2
    else if (amountVariance < 0.1) confidence += 0.1

    // Consistent intervals = higher confidence
    const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length
    const maxDeviation = Math.max(...intervals.map((i) => Math.abs(i - avgInterval)))
    if (maxDeviation <= 2) confidence += 0.1 // Within 2 days
    else if (maxDeviation <= 5) confidence += 0.05 // Within 5 days

    return Math.min(1.0, confidence)
  }

  /**
   * Get most common day of month
   */
  private getMostCommonDayOfMonth(dates: number[]): number {
    const days = dates.map((d) => new Date(d).getDate())
    const frequency = new Map<number, number>()

    for (const day of days) {
      frequency.set(day, (frequency.get(day) || 0) + 1)
    }

    let maxCount = 0
    let mostCommonDay = 1

    for (const [day, count] of frequency.entries()) {
      if (count > maxCount) {
        maxCount = count
        mostCommonDay = day
      }
    }

    return mostCommonDay
  }

  /**
   * Get most common day of week (0 = Sunday, 6 = Saturday)
   */
  private getMostCommonDayOfWeek(dates: number[]): number {
    const days = dates.map((d) => new Date(d).getDay())
    const frequency = new Map<number, number>()

    for (const day of days) {
      frequency.set(day, (frequency.get(day) || 0) + 1)
    }

    let maxCount = 0
    let mostCommonDay = 0

    for (const [day, count] of frequency.entries()) {
      if (count > maxCount) {
        maxCount = count
        mostCommonDay = day
      }
    }

    return mostCommonDay
  }

  /**
   * Calculate next expected date for recurring transaction
   */
  private calculateNextExpectedDate(
    lastDate: number,
    frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly',
    dayOfMonth?: number,
    dayOfWeek?: number
  ): number {
    const date = new Date(lastDate)

    switch (frequency) {
      case 'weekly':
        date.setDate(date.getDate() + 7)
        break
      case 'bi-weekly':
        date.setDate(date.getDate() + 14)
        break
      case 'monthly':
        date.setMonth(date.getMonth() + 1)
        if (dayOfMonth) {
          date.setDate(dayOfMonth)
        }
        break
      case 'quarterly':
        date.setMonth(date.getMonth() + 3)
        if (dayOfMonth) {
          date.setDate(dayOfMonth)
        }
        break
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1)
        if (dayOfMonth) {
          date.setDate(dayOfMonth)
        }
        break
    }

    return date.getTime()
  }

  /**
   * Get confidence level from numeric confidence
   */
  private getConfidenceLevel(confidence: number): ConfidenceLevel {
    if (confidence >= 0.8) return 'high'
    if (confidence >= 0.6) return 'medium'
    return 'low'
  }

  /**
   * Format frequency for display
   */
  formatFrequency(frequency: RecurringTransactionMatch['frequency']): string {
    const labels = {
      weekly: 'Weekly',
      'bi-weekly': 'Every 2 weeks',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      yearly: 'Yearly',
    }
    return labels[frequency]
  }

  /**
   * Format recurring message for display
   */
  formatRecurringMessage(match: RecurringTransactionMatch): string {
    const freqLabel = this.formatFrequency(match.frequency)
    const nextDate = match.nextExpectedDate
      ? format(new Date(match.nextExpectedDate), 'MMM d, yyyy')
      : 'unknown'

    return `This looks like a ${freqLabel.toLowerCase()} recurring transaction. Detected ${match.matchCount} occurrences. Next expected: ${nextDate}.`
  }

  /**
   * Load automation settings from database
   */
  private async loadSettings(): Promise<void> {
    try {
      // Placeholder - would load from automation_settings table
      this.settings = {
        id: crypto.randomUUID(),
        companyId: this.companyId,
        categorizationEnabled: true,
        categorizationMinConfidence: 0.7,
        categorizationAutoApply: false,
        recurringDetectionEnabled: true,
        recurringMinOccurrences: 3,
        recurringAutoCreate: false,
        anomalyDetectionEnabled: true,
        anomalyMinSeverity: 'medium',
        anomalyDuplicateThreshold: 30,
        learningEnabled: true,
        learningMinMatches: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      serviceLogger.debug('Loaded automation settings', { settings: this.settings })
    } catch (error) {
      serviceLogger.error('Failed to load settings', { error })
      throw error
    }
  }
}

/**
 * Create recurring detection service instance
 */
export function createRecurringDetectionService(companyId: string): RecurringDetectionService {
  return new RecurringDetectionService(companyId)
}
