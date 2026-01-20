/**
 * Auto-Categorization Service
 *
 * Rule-based automation that suggests transaction categorizations based on
 * historical patterns and learns from user corrections.
 *
 * Requirements:
 * - J2: Smart Automation Assistant (ROADMAP.md lines 2205-2209)
 * - 80%+ accuracy after 100 transactions
 * - Learning from user corrections
 * - Local-only processing (no external data transmission)
 * - High/Medium/Low confidence levels
 *
 * Research Basis:
 * - Auto-categorization scores 5.2-5.46/7 in user satisfaction
 * - Rule-based approach preferred over chatbot-style AI
 */

import { db } from '../../db/database'
import type {
  CategorizationSuggestion,
  CategorizationInput,
  LearnedPattern,
  VendorStatistics,
  AutomationSettings,
  ConfidenceLevel,
  SuggestionSource,
} from '../../types/automation.types'
import { logger } from '../../utils/logger'

const serviceLogger = logger.child('AutoCategorizationService')

/**
 * Auto-Categorization Service Class
 */
export class AutoCategorizationService {
  private companyId: string
  private settings: AutomationSettings | null = null
  private patterns: Map<string, LearnedPattern> = new Map()

  constructor(companyId: string) {
    this.companyId = companyId
  }

  /**
   * Initialize the service
   * Load settings and learned patterns
   */
  async initialize(): Promise<void> {
    try {
      serviceLogger.info('Initializing auto-categorization service', { companyId: this.companyId })

      // Load settings
      await this.loadSettings()

      // Load learned patterns
      await this.loadPatterns()

      serviceLogger.info('Auto-categorization service initialized', {
        enabled: this.settings?.categorizationEnabled,
        patternCount: this.patterns.size,
      })
    } catch (error) {
      serviceLogger.error('Failed to initialize auto-categorization service', { error })
      throw error
    }
  }

  /**
   * Get categorization suggestion for a transaction
   */
  async getSuggestion(input: CategorizationInput): Promise<CategorizationSuggestion | null> {
    try {
      // Check if categorization is enabled
      if (!this.settings?.categorizationEnabled) {
        return null
      }

      // Try vendor-specific pattern match first (highest priority)
      const vendorPattern = await this.matchVendorPattern(input)
      if (vendorPattern && vendorPattern.confidence >= (this.settings.categorizationMinConfidence || 0.7)) {
        return vendorPattern
      }

      // Try description-based pattern match
      const descriptionPattern = await this.matchDescriptionPattern(input)
      if (descriptionPattern && descriptionPattern.confidence >= (this.settings.categorizationMinConfidence || 0.7)) {
        return descriptionPattern
      }

      // Try frequency-based suggestion (most common category for this vendor)
      const frequencyBased = await this.getFrequencyBasedSuggestion(input)
      if (frequencyBased && frequencyBased.confidence >= (this.settings.categorizationMinConfidence || 0.7)) {
        return frequencyBased
      }

      // No suggestion meets confidence threshold
      return null
    } catch (error) {
      serviceLogger.error('Failed to get categorization suggestion', { error, input })
      return null
    }
  }

  /**
   * Match vendor-specific pattern
   */
  private async matchVendorPattern(input: CategorizationInput): Promise<CategorizationSuggestion | null> {
    if (!input.vendorName) {
      return null
    }

    const vendorLower = input.vendorName.toLowerCase().trim()

    // Find exact vendor match in learned patterns
    for (const pattern of this.patterns.values()) {
      if (pattern.vendorName.toLowerCase().trim() === vendorLower) {
        // Check if amount is in range (if pattern has amount range)
        if (pattern.amountRange) {
          const amount = parseFloat(input.amount)
          if (amount < pattern.amountRange.min || amount > pattern.amountRange.max) {
            continue // Amount doesn't match, try next pattern
          }
        }

        // Calculate confidence based on acceptance rate and match count
        const confidence = this.calculatePatternConfidence(pattern)

        return {
          transactionId: input.transactionId,
          suggestedCategoryId: pattern.categoryId,
          suggestedCategoryName: pattern.categoryName,
          suggestedAccountId: pattern.accountId,
          suggestedAccountName: pattern.accountName,
          confidence,
          confidenceLevel: this.getConfidenceLevel(confidence),
          source: 'pattern',
          reasoning: `Based on ${pattern.matchCount} previous transactions with ${input.vendorName}`,
          matchCount: pattern.matchCount,
          lastMatchDate: pattern.lastUsed,
          createdAt: Date.now(),
        }
      }
    }

    return null
  }

  /**
   * Match description-based pattern
   */
  private async matchDescriptionPattern(input: CategorizationInput): Promise<CategorizationSuggestion | null> {
    const descriptionLower = input.description.toLowerCase().trim()
    const words = descriptionLower.split(/\s+/)

    // Find patterns where description contains key words
    let bestMatch: { pattern: LearnedPattern; wordMatchCount: number } | null = null

    for (const pattern of this.patterns.values()) {
      if (!pattern.descriptionPattern) {
        continue
      }

      const patternWords = pattern.descriptionPattern.toLowerCase().split(/\s+/)
      const matchingWords = patternWords.filter((word) => descriptionLower.includes(word))

      if (matchingWords.length > 0) {
        if (!bestMatch || matchingWords.length > bestMatch.wordMatchCount) {
          bestMatch = {
            pattern,
            wordMatchCount: matchingWords.length,
          }
        }
      }
    }

    if (bestMatch) {
      const pattern = bestMatch.pattern
      const wordMatchRatio = bestMatch.wordMatchCount / pattern.descriptionPattern!.split(/\s+/).length
      const baseConfidence = this.calculatePatternConfidence(pattern)
      const confidence = baseConfidence * wordMatchRatio

      return {
        transactionId: input.transactionId,
        suggestedCategoryId: pattern.categoryId,
        suggestedCategoryName: pattern.categoryName,
        suggestedAccountId: pattern.accountId,
        suggestedAccountName: pattern.accountName,
        confidence,
        confidenceLevel: this.getConfidenceLevel(confidence),
        source: 'pattern',
        reasoning: `Based on description matching ${bestMatch.wordMatchCount} keywords`,
        matchCount: pattern.matchCount,
        lastMatchDate: pattern.lastUsed,
        createdAt: Date.now(),
      }
    }

    return null
  }

  /**
   * Get frequency-based suggestion (most common category for vendor)
   */
  private async getFrequencyBasedSuggestion(
    input: CategorizationInput
  ): Promise<CategorizationSuggestion | null> {
    if (!input.vendorName) {
      return null
    }

    // Get vendor statistics from historical transactions
    const stats = await this.getVendorStatistics(input.vendorName)
    if (!stats || stats.totalTransactions < 3) {
      // Need at least 3 transactions to suggest
      return null
    }

    const topCategory = stats.commonCategories[0]
    if (!topCategory) {
      return null
    }

    // Confidence based on how dominant this category is
    const confidence = topCategory.percentage / 100

    return {
      transactionId: input.transactionId,
      suggestedCategoryId: topCategory.categoryId,
      suggestedCategoryName: topCategory.categoryName,
      confidence,
      confidenceLevel: this.getConfidenceLevel(confidence),
      source: 'frequency',
      reasoning: `${topCategory.percentage.toFixed(0)}% of transactions with ${input.vendorName} use this category`,
      matchCount: topCategory.count,
      lastMatchDate: stats.lastTransactionDate,
      createdAt: Date.now(),
    }
  }

  /**
   * Record user response to a suggestion
   * Learn from acceptance or correction
   */
  async recordResponse(
    suggestion: CategorizationSuggestion,
    accepted: boolean,
    correctedCategoryId?: string
  ): Promise<void> {
    try {
      const actualCategoryId = accepted ? suggestion.suggestedCategoryId : correctedCategoryId

      if (!actualCategoryId) {
        serviceLogger.warn('No category ID provided for learning')
        return
      }

      // Update or create learned pattern
      await this.updateLearnedPattern({
        transactionId: suggestion.transactionId,
        categoryId: actualCategoryId,
        accepted,
      })

      serviceLogger.info('Recorded categorization response', {
        transactionId: suggestion.transactionId,
        accepted,
        wasCorrection: !accepted && !!correctedCategoryId,
      })
    } catch (error) {
      serviceLogger.error('Failed to record response', { error, suggestion })
      throw error
    }
  }

  /**
   * Update or create learned pattern based on user feedback
   */
  private async updateLearnedPattern(data: {
    transactionId: string
    categoryId: string
    accepted: boolean
  }): Promise<void> {
    // This is a placeholder for pattern learning logic
    // In production, this would:
    // 1. Get transaction details
    // 2. Find existing pattern or create new one
    // 3. Update match count and acceptance rate
    // 4. Store in database

    serviceLogger.info('Pattern learning not yet implemented', data)
  }

  /**
   * Calculate confidence for a learned pattern
   */
  private calculatePatternConfidence(pattern: LearnedPattern): number {
    // Base confidence on acceptance rate
    let confidence = pattern.acceptanceRate

    // Boost confidence for frequently used patterns
    if (pattern.matchCount >= 10) {
      confidence = Math.min(1.0, confidence * 1.1)
    }
    if (pattern.matchCount >= 50) {
      confidence = Math.min(1.0, confidence * 1.2)
    }

    // Reduce confidence for stale patterns (not used in 90+ days)
    const daysSinceLastUse = (Date.now() - pattern.lastUsed) / (1000 * 60 * 60 * 24)
    if (daysSinceLastUse > 90) {
      confidence *= 0.9
    }

    return Math.max(0, Math.min(1, confidence))
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
   * Get vendor statistics from historical transactions
   */
  private async getVendorStatistics(vendorName: string): Promise<VendorStatistics | null> {
    try {
      // This would query transactions table for vendor statistics
      // Placeholder implementation
      serviceLogger.debug('Getting vendor statistics', { vendorName })
      return null
    } catch (error) {
      serviceLogger.error('Failed to get vendor statistics', { error, vendorName })
      return null
    }
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
   * Load learned patterns from database
   */
  private async loadPatterns(): Promise<void> {
    try {
      // Placeholder - would load from learned_patterns table
      this.patterns.clear()

      serviceLogger.debug('Loaded learned patterns', { count: this.patterns.size })
    } catch (error) {
      serviceLogger.error('Failed to load patterns', { error })
      throw error
    }
  }

  /**
   * Get accuracy metrics for this company
   */
  async getAccuracyMetrics(): Promise<{
    totalSuggestions: number
    acceptedSuggestions: number
    accuracyRate: number
  }> {
    try {
      // Placeholder - would query automation_history table
      return {
        totalSuggestions: 0,
        acceptedSuggestions: 0,
        accuracyRate: 0,
      }
    } catch (error) {
      serviceLogger.error('Failed to get accuracy metrics', { error })
      return {
        totalSuggestions: 0,
        acceptedSuggestions: 0,
        accuracyRate: 0,
      }
    }
  }
}

/**
 * Create auto-categorization service instance
 */
export function createAutoCategorizationService(companyId: string): AutoCategorizationService {
  return new AutoCategorizationService(companyId)
}
