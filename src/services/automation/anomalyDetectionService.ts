/**
 * Anomaly Detection Service
 *
 * Detects unusual transactions that don't fit established patterns:
 * - Amount spikes (3x average for vendor)
 * - New vendors never seen before
 * - Unusual timing or category for time period
 * - Potential duplicates
 *
 * Requirements:
 * - J2: Smart Automation Assistant (ROADMAP.md lines 2218-2223)
 * - <10% false positive rate after learning period
 * - Subtle visual indicators (not alarming notifications)
 * - User can dismiss flags; system learns from dismissals
 * - No judgment on whether anomalies are "good" or "bad"
 */

import { differenceInDays } from 'date-fns'
import { db } from '../../db/database'
import type {
  TransactionAnomaly,
  AnomalyDetectionInput,
  AutomationSettings,
  ConfidenceLevel,
} from '../../types/automation.types'
import { logger } from '../../utils/logger'

const serviceLogger = logger.child('AnomalyDetectionService')

/**
 * Vendor profile for anomaly detection
 */
interface VendorProfile {
  vendorName: string
  transactionCount: number
  averageAmount: number
  stdDevAmount: number
  minAmount: number
  maxAmount: number
  commonCategories: string[]
  averageInterval: number // Days between transactions
  lastTransactionDate: number
}

/**
 * Anomaly Detection Service Class
 */
export class AnomalyDetectionService {
  private companyId: string
  private settings: AutomationSettings | null = null
  private dismissedAnomalies: Set<string> = new Set() // Cache of dismissed anomaly patterns

  // Thresholds
  private readonly AMOUNT_SPIKE_MULTIPLIER = 3 // 3x average
  private readonly UNUSUAL_TIMING_DAYS = 60 // Days beyond expected interval

  constructor(companyId: string) {
    this.companyId = companyId
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    try {
      serviceLogger.info('Initializing anomaly detection service', { companyId: this.companyId })

      // Load settings
      await this.loadSettings()

      // Load dismissed anomaly patterns
      await this.loadDismissedAnomalies()

      serviceLogger.info('Anomaly detection service initialized', {
        enabled: this.settings?.anomalyDetectionEnabled,
        dismissedCount: this.dismissedAnomalies.size,
      })
    } catch (error) {
      serviceLogger.error('Failed to initialize anomaly detection service', { error })
      throw error
    }
  }

  /**
   * Detect anomalies in a transaction
   */
  async detectAnomalies(input: AnomalyDetectionInput): Promise<TransactionAnomaly[]> {
    try {
      // Check if anomaly detection is enabled
      if (!this.settings?.anomalyDetectionEnabled) {
        return []
      }

      const anomalies: TransactionAnomaly[] = []

      // Check for new vendor
      const newVendorAnomaly = await this.checkNewVendor(input)
      if (newVendorAnomaly && this.meetsMinSeverity(newVendorAnomaly.severity)) {
        anomalies.push(newVendorAnomaly)
      }

      // Check for amount spike (only if not new vendor)
      if (!newVendorAnomaly) {
        const amountAnomaly = await this.checkAmountSpike(input)
        if (amountAnomaly && this.meetsMinSeverity(amountAnomaly.severity)) {
          anomalies.push(amountAnomaly)
        }
      }

      // Check for possible duplicate
      const duplicateAnomaly = await this.checkPossibleDuplicate(input)
      if (duplicateAnomaly && this.meetsMinSeverity(duplicateAnomaly.severity)) {
        anomalies.push(duplicateAnomaly)
      }

      // Check for unusual timing (only if vendor is known)
      if (!newVendorAnomaly) {
        const timingAnomaly = await this.checkUnusualTiming(input)
        if (timingAnomaly && this.meetsMinSeverity(timingAnomaly.severity)) {
          anomalies.push(timingAnomaly)
        }
      }

      // Check for unusual category
      if (input.categoryId) {
        const categoryAnomaly = await this.checkUnusualCategory(input)
        if (categoryAnomaly && this.meetsMinSeverity(categoryAnomaly.severity)) {
          anomalies.push(categoryAnomaly)
        }
      }

      // Filter out dismissed anomaly patterns
      const filtered = anomalies.filter((a) => !this.isAnomalyDismissed(a))

      serviceLogger.info('Anomaly detection completed', {
        transactionId: input.transactionId,
        anomaliesFound: filtered.length,
      })

      return filtered
    } catch (error) {
      serviceLogger.error('Failed to detect anomalies', { error, input })
      return []
    }
  }

  /**
   * Check if vendor is new (never seen before)
   */
  private async checkNewVendor(input: AnomalyDetectionInput): Promise<TransactionAnomaly | null> {
    if (!input.vendorName) {
      return null
    }

    const profile = await this.getVendorProfile(input.vendorName)

    // If no profile exists, this is a new vendor
    if (!profile || profile.transactionCount === 0) {
      return {
        transactionId: input.transactionId,
        anomalyType: 'new_vendor',
        description: 'New vendor',
        severity: 'low', // New vendors are common and not necessarily problematic
        confidence: 1.0, // We're certain this is a new vendor
        confidenceLevel: 'high',
        explanation: `This is the first transaction with ${input.vendorName}.`,
        actualValue: input.vendorName,
        suggestedAction: 'Verify vendor details are correct',
        dismissed: false,
        createdAt: Date.now(),
      }
    }

    return null
  }

  /**
   * Check if amount is significantly higher than usual for this vendor
   */
  private async checkAmountSpike(input: AnomalyDetectionInput): Promise<TransactionAnomaly | null> {
    if (!input.vendorName) {
      return null
    }

    const profile = await this.getVendorProfile(input.vendorName)
    if (!profile || profile.transactionCount < 3) {
      return null // Need at least 3 transactions to establish baseline
    }

    const amount = parseFloat(input.amount)
    const threshold = profile.averageAmount * this.AMOUNT_SPIKE_MULTIPLIER

    if (amount > threshold) {
      // Calculate how many standard deviations above the mean
      const zScore = (amount - profile.averageAmount) / profile.stdDevAmount
      const confidence = Math.min(1.0, zScore / 5) // Cap at 5 std devs

      return {
        transactionId: input.transactionId,
        anomalyType: 'unusual_amount',
        description: 'Amount much higher than usual',
        severity: this.getSeverityFromConfidence(confidence),
        confidence,
        confidenceLevel: this.getConfidenceLevel(confidence),
        explanation: `This amount ($${amount.toFixed(2)}) is ${this.AMOUNT_SPIKE_MULTIPLIER}x higher than the average for ${input.vendorName} ($${profile.averageAmount.toFixed(2)}).`,
        expectedValue: `$${profile.averageAmount.toFixed(2)} (average)`,
        actualValue: `$${amount.toFixed(2)}`,
        suggestedAction: 'Verify the amount is correct',
        dismissed: false,
        createdAt: Date.now(),
      }
    }

    return null
  }

  /**
   * Check for possible duplicate transaction
   */
  private async checkPossibleDuplicate(
    input: AnomalyDetectionInput
  ): Promise<TransactionAnomaly | null> {
    const duplicateThreshold = this.settings?.anomalyDuplicateThreshold || 30 // days

    // Look for similar transactions within threshold
    const similar = await this.findSimilarTransactions(input, duplicateThreshold)

    if (similar.length > 0) {
      const mostSimilar = similar[0]
      const daysBetween = Math.abs(
        differenceInDays(new Date(input.transactionDate), new Date(mostSimilar.date))
      )

      // Calculate confidence based on similarity and recency
      const confidence = mostSimilar.similarity * (1 - daysBetween / duplicateThreshold)

      if (confidence > 0.5) {
        return {
          transactionId: input.transactionId,
          anomalyType: 'duplicate_possible',
          description: 'Possible duplicate transaction',
          severity: this.getSeverityFromConfidence(confidence),
          confidence,
          confidenceLevel: this.getConfidenceLevel(confidence),
          explanation: `This looks similar to a transaction from ${daysBetween} days ago: ${mostSimilar.description} ($${mostSimilar.amount}).`,
          actualValue: input.description,
          suggestedAction: 'Check if this is a duplicate',
          dismissed: false,
          createdAt: Date.now(),
        }
      }
    }

    return null
  }

  /**
   * Check if transaction timing is unusual for this vendor
   */
  private async checkUnusualTiming(
    input: AnomalyDetectionInput
  ): Promise<TransactionAnomaly | null> {
    if (!input.vendorName) {
      return null
    }

    const profile = await this.getVendorProfile(input.vendorName)
    if (!profile || profile.transactionCount < 3) {
      return null
    }

    const daysSinceLastTransaction = differenceInDays(
      new Date(input.transactionDate),
      new Date(profile.lastTransactionDate)
    )

    // If much longer than average interval
    const expectedInterval = profile.averageInterval
    const threshold = expectedInterval + this.UNUSUAL_TIMING_DAYS

    if (daysSinceLastTransaction > threshold && expectedInterval > 0) {
      const confidence = Math.min(
        1.0,
        (daysSinceLastTransaction - expectedInterval) / this.UNUSUAL_TIMING_DAYS
      )

      return {
        transactionId: input.transactionId,
        anomalyType: 'unusual_timing',
        description: 'Longer than usual since last transaction',
        severity: 'low', // Timing anomalies are typically low severity
        confidence,
        confidenceLevel: this.getConfidenceLevel(confidence),
        explanation: `It's been ${daysSinceLastTransaction} days since the last transaction with ${input.vendorName}. Typically it's every ${Math.round(expectedInterval)} days.`,
        expectedValue: `~${Math.round(expectedInterval)} days`,
        actualValue: `${daysSinceLastTransaction} days`,
        dismissed: false,
        createdAt: Date.now(),
      }
    }

    return null
  }

  /**
   * Check if category is unusual for this vendor
   */
  private async checkUnusualCategory(
    input: AnomalyDetectionInput
  ): Promise<TransactionAnomaly | null> {
    if (!input.vendorName || !input.categoryId) {
      return null
    }

    const profile = await this.getVendorProfile(input.vendorName)
    if (!profile || profile.transactionCount < 5) {
      return null // Need more history
    }

    // Check if this category is common for this vendor
    const isCommon = profile.commonCategories.includes(input.categoryId)

    if (!isCommon) {
      // Calculate confidence based on how established the vendor patterns are
      const confidence = Math.min(0.8, profile.transactionCount / 20)

      return {
        transactionId: input.transactionId,
        anomalyType: 'unusual_category',
        description: 'Unusual category for this vendor',
        severity: 'low',
        confidence,
        confidenceLevel: this.getConfidenceLevel(confidence),
        explanation: `This category is different from what you usually use for ${input.vendorName}.`,
        actualValue: input.categoryId,
        dismissed: false,
        createdAt: Date.now(),
      }
    }

    return null
  }

  /**
   * Dismiss an anomaly
   * System learns from dismissals
   */
  async dismissAnomaly(
    anomaly: TransactionAnomaly,
    reason?: string
  ): Promise<void> {
    try {
      // Mark as dismissed
      anomaly.dismissed = true
      anomaly.dismissedAt = Date.now()

      // Add to dismissed patterns cache
      const pattern = this.getAnomalyPattern(anomaly)
      this.dismissedAnomalies.add(pattern)

      // Store in database for persistence
      // Placeholder for database storage

      serviceLogger.info('Anomaly dismissed', {
        transactionId: anomaly.transactionId,
        type: anomaly.anomalyType,
        reason,
      })
    } catch (error) {
      serviceLogger.error('Failed to dismiss anomaly', { error, anomaly })
      throw error
    }
  }

  /**
   * Get vendor profile for anomaly detection
   */
  private async getVendorProfile(vendorName: string): Promise<VendorProfile | null> {
    try {
      // Placeholder - would query transactions and calculate statistics
      serviceLogger.debug('Getting vendor profile', { vendorName })
      return null
    } catch (error) {
      serviceLogger.error('Failed to get vendor profile', { error, vendorName })
      return null
    }
  }

  /**
   * Find similar transactions (for duplicate detection)
   */
  private async findSimilarTransactions(
    input: AnomalyDetectionInput,
    daysBack: number
  ): Promise<Array<{ id: string; description: string; amount: string; date: number; similarity: number }>> {
    try {
      // Placeholder - would use fuzzy matching to find similar transactions
      serviceLogger.debug('Finding similar transactions', { transactionId: input.transactionId })
      return []
    } catch (error) {
      serviceLogger.error('Failed to find similar transactions', { error })
      return []
    }
  }

  /**
   * Check if anomaly meets minimum severity threshold
   */
  private meetsMinSeverity(severity: TransactionAnomaly['severity']): boolean {
    const minSeverity = this.settings?.anomalyMinSeverity || 'medium'

    const severityOrder = { low: 0, medium: 1, high: 2 }
    return severityOrder[severity] >= severityOrder[minSeverity]
  }

  /**
   * Get severity from confidence score
   */
  private getSeverityFromConfidence(confidence: number): TransactionAnomaly['severity'] {
    if (confidence >= 0.8) return 'high'
    if (confidence >= 0.5) return 'medium'
    return 'low'
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
   * Get pattern identifier for anomaly (for dismissal tracking)
   */
  private getAnomalyPattern(anomaly: TransactionAnomaly): string {
    // Create a pattern key based on anomaly type and key attributes
    return `${anomaly.anomalyType}:${anomaly.actualValue}`
  }

  /**
   * Check if anomaly pattern has been dismissed
   */
  private isAnomalyDismissed(anomaly: TransactionAnomaly): boolean {
    const pattern = this.getAnomalyPattern(anomaly)
    return this.dismissedAnomalies.has(pattern)
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

  /**
   * Load dismissed anomaly patterns
   */
  private async loadDismissedAnomalies(): Promise<void> {
    try {
      // Placeholder - would load from database
      this.dismissedAnomalies.clear()

      serviceLogger.debug('Loaded dismissed anomalies', { count: this.dismissedAnomalies.size })
    } catch (error) {
      serviceLogger.error('Failed to load dismissed anomalies', { error })
    }
  }
}

/**
 * Create anomaly detection service instance
 */
export function createAnomalyDetectionService(companyId: string): AnomalyDetectionService {
  return new AnomalyDetectionService(companyId)
}
