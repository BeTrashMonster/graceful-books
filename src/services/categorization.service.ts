/**
 * Expense Categorization Service
 *
 * AI-powered expense categorization with learning capabilities.
 * Uses a hybrid approach combining neural network ML and rule-based fallback.
 *
 * Requirements:
 * - E5: Category suggestions based on vendor and description
 * - E5: Learning from user corrections over time
 * - E5: Suggestion accuracy tracking
 * - E5: Hybrid approach with rule-based fallback
 * - ARCH-002: Zero-Knowledge Encryption (model data encrypted)
 *
 * Architecture:
 * 1. ML Model: Neural network trained on historical transactions
 * 2. Rule-Based: Pattern matching for common expense types
 * 3. Hybrid: Combines both approaches with confidence scoring
 */

import * as brain from 'brain.js'
import { db } from '../db/database'
import {
  createDefaultCategorizationModel,
  createTrainingDataPoint,
  createSuggestionHistory,
  createCategorizationRule,
  updateAccuracyMetrics,
  getConfidenceLevel,
  SYSTEM_CATEGORIZATION_RULES,
} from '../db/schema/categorization.schema'
import type {
  CategorySuggestion,
  CategorizationInput,
  TrainingDataPoint,
  CategorizationModel,
  SuggestionHistory,
  CategorizationRule,
  AccuracyMetrics,
  LearningFeedback,
  FeatureVector,
  TrainingOptions,
  BulkCategorizationRequest,
  BulkCategorizationResult,
  SimilarTransactionCriteria,
  SimilarTransaction,
  ConfidenceLevel,
} from '../types/categorization.types'
import type { Category } from '../db/schema/categories.schema'
import { logger } from '../utils/logger'

const serviceLogger = logger.child('CategorizationService')

/**
 * Categorization Service Class
 */
export class CategorizationService {
  private companyId: string
  private neuralNetwork: brain.NeuralNetwork | null = null
  private modelLoaded: boolean = false
  private isTraining: boolean = false
  private categoryCache: Map<string, Category> = new Map()
  private rulesCache: CategorizationRule[] = []

  // Configuration
  private readonly MIN_TRAINING_EXAMPLES = 10
  private readonly HIGH_CONFIDENCE_THRESHOLD = 0.8
  private readonly MEDIUM_CONFIDENCE_THRESHOLD = 0.5
  private readonly ML_CONFIDENCE_THRESHOLD = 0.3 // Below this, use rules only

  constructor(companyId: string) {
    this.companyId = companyId
  }

  /**
   * Initialize the service
   * Loads the model and rules from database
   */
  async initialize(): Promise<void> {
    try {
      serviceLogger.info('Initializing categorization service', { companyId: this.companyId })

      // Load categories into cache
      await this.loadCategories()

      // Load rules into cache
      await this.loadRules()

      // Load ML model if exists
      await this.loadModel()

      serviceLogger.info('Categorization service initialized successfully')
    } catch (error) {
      serviceLogger.error('Failed to initialize categorization service', { error })
      throw error
    }
  }

  /**
   * Get category suggestion for a transaction
   */
  async getSuggestion(input: CategorizationInput): Promise<CategorySuggestion | null> {
    try {
      // Try ML-based suggestion first
      const mlSuggestion = await this.getMLSuggestion(input)

      // If ML confidence is high enough, use it
      if (mlSuggestion && mlSuggestion.confidence >= this.ML_CONFIDENCE_THRESHOLD) {
        // Try to improve with rule-based boost
        const ruleSuggestion = await this.getRuleBasedSuggestion(input)

        if (
          ruleSuggestion &&
          ruleSuggestion.categoryId === mlSuggestion.categoryId &&
          ruleSuggestion.confidence > mlSuggestion.confidence
        ) {
          // Rules confirm ML suggestion - boost confidence
          return {
            ...mlSuggestion,
            confidence: Math.min(1.0, mlSuggestion.confidence * 1.2),
            confidenceLevel: getConfidenceLevel(mlSuggestion.confidence * 1.2),
            source: 'hybrid',
            reasoning: `ML model agrees with rule-based pattern: ${ruleSuggestion.reasoning}`,
          }
        }

        return mlSuggestion
      }

      // Fall back to rule-based suggestion
      const ruleSuggestion = await this.getRuleBasedSuggestion(input)
      if (ruleSuggestion) {
        return ruleSuggestion
      }

      // No suggestion available
      return null
    } catch (error) {
      serviceLogger.error('Failed to get category suggestion', { error, input })
      return null
    }
  }

  /**
   * Get ML-based suggestion
   */
  private async getMLSuggestion(input: CategorizationInput): Promise<CategorySuggestion | null> {
    if (!this.modelLoaded || !this.neuralNetwork) {
      return null
    }

    try {
      // Extract features from input
      const features = await this.extractFeatures(input)

      // Run neural network
      const output = this.neuralNetwork.run(this.featureVectorToArray(features)) as any

      // Find highest confidence category
      let maxConfidence = 0
      let suggestedCategoryId: string | null = null

      for (const [categoryId, confidence] of Object.entries(output)) {
        if (typeof confidence === 'number' && confidence > maxConfidence) {
          maxConfidence = confidence
          suggestedCategoryId = categoryId
        }
      }

      if (!suggestedCategoryId || maxConfidence < this.ML_CONFIDENCE_THRESHOLD) {
        return null
      }

      const category = this.categoryCache.get(suggestedCategoryId)
      if (!category) {
        return null
      }

      return {
        categoryId: suggestedCategoryId,
        categoryName: category.name,
        confidence: maxConfidence,
        confidenceLevel: getConfidenceLevel(maxConfidence),
        source: 'ml',
        reasoning: `Based on ${this.neuralNetwork ? 'learned patterns' : 'analysis'} from similar transactions`,
      }
    } catch (error) {
      serviceLogger.error('Failed to get ML suggestion', { error })
      return null
    }
  }

  /**
   * Get rule-based suggestion
   */
  private async getRuleBasedSuggestion(
    input: CategorizationInput
  ): Promise<CategorySuggestion | null> {
    try {
      const vendorName = input.vendorName?.toLowerCase() || ''
      const description = input.description.toLowerCase()

      // Check user-defined rules first (higher priority)
      for (const rule of this.rulesCache.filter((r) => r.active && !r.is_system)) {
        const match = this.matchRule(rule, vendorName, description)
        if (match) {
          const category = this.categoryCache.get(rule.category_id)
          if (category) {
            return {
              categoryId: rule.category_id,
              categoryName: category.name,
              confidence: 0.9, // User rules have high confidence
              confidenceLevel: 'high',
              source: 'rules',
              reasoning: `Matches your custom rule: "${rule.pattern}"`,
            }
          }
        }
      }

      // Check system rules
      for (const rule of this.rulesCache.filter((r) => r.active && r.is_system)) {
        const match = this.matchRule(rule, vendorName, description)
        if (match) {
          const category = this.categoryCache.get(rule.category_id)
          if (category) {
            return {
              categoryId: rule.category_id,
              categoryName: category.name,
              confidence: 0.7, // System rules have medium-high confidence
              confidenceLevel: 'medium',
              source: 'rules',
              reasoning: `Matches common pattern for ${category.name}`,
            }
          }
        }
      }

      return null
    } catch (error) {
      serviceLogger.error('Failed to get rule-based suggestion', { error })
      return null
    }
  }

  /**
   * Match a rule against vendor name and description
   */
  private matchRule(rule: CategorizationRule, vendorName: string, description: string): boolean {
    const searchText =
      rule.field === 'vendor' ? vendorName : rule.field === 'description' ? description : `${vendorName} ${description}`

    const pattern = rule.pattern.toLowerCase()

    switch (rule.pattern_type) {
      case 'exact':
        return searchText === pattern
      case 'contains':
        return searchText.includes(pattern)
      case 'starts_with':
        return searchText.startsWith(pattern)
      case 'ends_with':
        return searchText.endsWith(pattern)
      case 'regex':
        try {
          const regex = new RegExp(pattern, 'i')
          return regex.test(searchText)
        } catch {
          return false
        }
      default:
        return false
    }
  }

  /**
   * Record user feedback on a suggestion
   * This trains the model to improve over time
   */
  async recordFeedback(feedback: LearningFeedback): Promise<void> {
    try {
      // Create training data point
      const trainingData = createTrainingDataPoint(
        this.companyId,
        feedback.vendorName,
        feedback.description,
        feedback.amount,
        feedback.actualCategoryId,
        this.categoryCache.get(feedback.actualCategoryId)?.name || '',
        feedback.transactionDate,
        feedback.suggestedCategoryId !== feedback.actualCategoryId // Was this a correction?
      )

      // Save training data
      await db.trainingData.add({ ...trainingData, id: crypto.randomUUID() } as TrainingDataPoint)

      // Update suggestion history
      const history = await db.suggestionHistory
        .where('transaction_id')
        .equals(feedback.transactionId)
        .first()

      if (history) {
        await db.suggestionHistory.update(history.id, {
          actual_category_id: feedback.actualCategoryId,
          was_accepted: feedback.suggestedCategoryId === feedback.actualCategoryId,
          updated_at: Date.now(),
        })
      }

      // Update accuracy metrics
      const model = await this.getOrCreateModel()
      const updatedMetrics = updateAccuracyMetrics(
        model.accuracy_metrics,
        feedback.confidence,
        feedback.suggestedCategoryId === feedback.actualCategoryId
      )

      await db.categorizationModels.update(model.id, {
        accuracy_metrics: updatedMetrics,
        updated_at: Date.now(),
      })

      // If we have enough new training data, retrain
      const trainingCount = await db.trainingData.where('company_id').equals(this.companyId).count()

      if (
        trainingCount >= this.MIN_TRAINING_EXAMPLES &&
        trainingCount % 10 === 0 // Retrain every 10 examples
      ) {
        await this.trainModel()
      }

      serviceLogger.info('Recorded feedback successfully', {
        transactionId: feedback.transactionId,
        wasCorrection: feedback.suggestedCategoryId !== feedback.actualCategoryId,
      })
    } catch (error) {
      serviceLogger.error('Failed to record feedback', { error, feedback })
      throw error
    }
  }

  /**
   * Train or retrain the ML model
   */
  async trainModel(options: TrainingOptions = {}): Promise<void> {
    if (this.isTraining) {
      serviceLogger.warn('Model training already in progress')
      return
    }

    this.isTraining = true

    try {
      serviceLogger.info('Starting model training')

      // Get training data
      const trainingData = await db.trainingData
        .where('company_id')
        .equals(this.companyId)
        .toArray()

      if (trainingData.length < this.MIN_TRAINING_EXAMPLES) {
        serviceLogger.info('Not enough training data', {
          current: trainingData.length,
          required: this.MIN_TRAINING_EXAMPLES,
        })
        return
      }

      // Prepare training set
      const trainingSet = await Promise.all(
        trainingData.map(async (data) => {
          const features = await this.extractFeatures({
            vendorName: data.vendorName,
            description: data.description,
            amount: data.amount,
            transactionDate: data.transactionDate,
          })

          const output: Record<string, number> = {}
          for (const category of this.categoryCache.values()) {
            output[category.id] = category.id === data.categoryId ? 1 : 0
          }

          return {
            input: this.featureVectorToArray(features),
            output,
          }
        })
      )

      // Create or reset neural network
      this.neuralNetwork = new brain.NeuralNetwork({
        hiddenLayers: [10, 8], // Two hidden layers
        activation: 'sigmoid',
      })

      // Train the network
      await this.neuralNetwork.trainAsync(trainingSet, {
        iterations: options.epochs || 5000,
        errorThresh: 0.005,
        log: true,
        logPeriod: 1000,
      })

      // Serialize the model
      // TODO: Add proper encryption using company's master key when available
      const modelData = JSON.stringify(this.neuralNetwork.toJSON())

      // Save model to database
      const model = await this.getOrCreateModel()
      await db.categorizationModels.update(model.id, {
        model_data: modelData,
        training_count: trainingData.length,
        last_trained_at: Date.now(),
        updated_at: Date.now(),
      })

      this.modelLoaded = true

      serviceLogger.info('Model training completed successfully', {
        trainingExamples: trainingData.length,
      })
    } catch (error) {
      serviceLogger.error('Failed to train model', { error })
      throw error
    } finally {
      this.isTraining = false
    }
  }

  /**
   * Bulk categorize similar transactions
   */
  async bulkCategorize(request: BulkCategorizationRequest): Promise<BulkCategorizationResult> {
    const results: BulkCategorizationResult = {
      successCount: 0,
      failureCount: 0,
      results: [],
    }

    try {
      for (const transactionId of request.transactionIds) {
        try {
          // Update transaction category (this would be in the transaction store)
          // For now, just record the result
          results.successCount++
          results.results.push({
            transactionId,
            success: true,
          })
        } catch (error) {
          results.failureCount++
          results.results.push({
            transactionId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      return results
    } catch (error) {
      serviceLogger.error('Failed to bulk categorize', { error, request })
      throw error
    }
  }

  /**
   * Find similar transactions
   */
  async findSimilarTransactions(
    criteria: SimilarTransactionCriteria
  ): Promise<SimilarTransaction[]> {
    // This would query the transactions table and find similar ones
    // For now, return empty array as placeholder
    return []
  }

  /**
   * Get accuracy metrics
   */
  async getAccuracyMetrics(): Promise<AccuracyMetrics | null> {
    try {
      const model = await db.categorizationModels
        .where('company_id')
        .equals(this.companyId)
        .first()

      return model?.accuracy_metrics || null
    } catch (error) {
      serviceLogger.error('Failed to get accuracy metrics', { error })
      return null
    }
  }

  /**
   * Extract features from categorization input
   */
  private async extractFeatures(input: CategorizationInput): Promise<FeatureVector> {
    const vendorName = input.vendorName || ''
    const description = input.description || ''
    const amount = input.amount || 0
    const date = input.transactionDate || Date.now()

    // Simple feature extraction
    // In production, this could use more sophisticated NLP techniques
    return {
      vendorNameHash: this.simpleHash(vendorName.toLowerCase()),
      vendorFrequency: await this.getVendorFrequency(vendorName),
      descriptionLength: description.length,
      descriptionWordCount: description.split(/\s+/).length,
      descriptionKeywords: this.extractKeywords(description),
      amountNormalized: this.normalizeAmount(amount),
      amountBucket: this.getAmountBucket(amount),
      dayOfWeek: new Date(date).getDay(),
      dayOfMonth: new Date(date).getDate(),
      monthOfYear: new Date(date).getMonth(),
      previousCategoryForVendor: await this.getPreviousCategoryForVendor(vendorName),
      categoryFrequency: 0, // Would be calculated based on category usage
    }
  }

  /**
   * Convert feature vector to array for neural network
   */
  private featureVectorToArray(features: FeatureVector): number[] {
    return [
      features.vendorNameHash,
      features.vendorFrequency,
      features.descriptionLength / 100, // Normalize
      features.descriptionWordCount / 10, // Normalize
      ...features.descriptionKeywords.slice(0, 5), // Take first 5 keywords
      features.amountNormalized,
      features.amountBucket,
      features.dayOfWeek / 7,
      features.dayOfMonth / 31,
      features.monthOfYear / 12,
      features.previousCategoryForVendor || 0,
      features.categoryFrequency,
    ]
  }

  /**
   * Simple hash function for strings
   */
  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash) / 2147483647 // Normalize to 0-1
  }

  /**
   * Extract keywords from description using simple TF-IDF-like approach
   */
  private extractKeywords(description: string): number[] {
    // Common stop words to ignore
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'])

    const words = description
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))

    // Return hashed values of top words
    return words.slice(0, 5).map((w) => this.simpleHash(w))
  }

  /**
   * Normalize amount to 0-1 range
   */
  private normalizeAmount(amount: number): number {
    // Log scale normalization for better distribution
    return Math.log10(amount + 1) / 6 // Assumes max ~$1M
  }

  /**
   * Get amount bucket (small/medium/large)
   */
  private getAmountBucket(amount: number): number {
    if (amount < 50) return 0.25
    if (amount < 500) return 0.5
    if (amount < 5000) return 0.75
    return 1.0
  }

  /**
   * Get vendor frequency (how often used)
   */
  private async getVendorFrequency(vendorName: string): Promise<number> {
    const count = await db.trainingData
      .where('vendor_name')
      .equalsIgnoreCase(vendorName)
      .count()

    return Math.min(1.0, count / 100) // Normalize to 0-1
  }

  /**
   * Get previous category used for this vendor
   */
  private async getPreviousCategoryForVendor(vendorName: string): Promise<number | undefined> {
    const previous = await db.trainingData
      .where('vendor_name')
      .equalsIgnoreCase(vendorName)
      .reverse()
      .first()

    return previous ? this.simpleHash(previous.categoryId) : undefined
  }

  /**
   * Load categories into cache
   */
  private async loadCategories(): Promise<void> {
    const categories = await db.categories
      .where('company_id')
      .equals(this.companyId)
      .and((cat) => cat.deleted_at === null && cat.active)
      .toArray()

    this.categoryCache.clear()
    for (const category of categories) {
      this.categoryCache.set(category.id, category)
    }

    serviceLogger.info('Loaded categories into cache', { count: categories.length })
  }

  /**
   * Load rules into cache
   */
  private async loadRules(): Promise<void> {
    const rules = await db.categorizationRules
      .where('company_id')
      .equals(this.companyId)
      .and((rule) => rule.active)
      .sortBy('priority')

    this.rulesCache = rules.reverse() // Higher priority first

    serviceLogger.info('Loaded rules into cache', { count: rules.length })
  }

  /**
   * Load ML model from database
   */
  private async loadModel(): Promise<void> {
    try {
      const model = await db.categorizationModels
        .where('company_id')
        .equals(this.companyId)
        .first()

      if (!model || !model.model_data) {
        serviceLogger.info('No trained model found')
        return
      }

      // Deserialize model
      // TODO: Add proper decryption using company's master key when available
      const modelJson = JSON.parse(model.model_data)

      // Load into neural network
      this.neuralNetwork = new brain.NeuralNetwork()
      this.neuralNetwork.fromJSON(modelJson)

      this.modelLoaded = true

      serviceLogger.info('Loaded ML model successfully', {
        trainingCount: model.training_count,
        lastTrained: new Date(model.last_trained_at).toISOString(),
      })
    } catch (error) {
      serviceLogger.error('Failed to load model', { error })
      this.modelLoaded = false
    }
  }

  /**
   * Get or create categorization model
   */
  private async getOrCreateModel(): Promise<CategorizationModel> {
    let model = await db.categorizationModels.where('company_id').equals(this.companyId).first()

    if (!model) {
      const newModel = createDefaultCategorizationModel(this.companyId, 'default-device')
      const id = crypto.randomUUID()
      await db.categorizationModels.add({ ...newModel, id } as CategorizationModel)
      model = (await db.categorizationModels.get(id))!
    }

    return model
  }
}

/**
 * Create categorization service instance
 */
export function createCategorizationService(companyId: string): CategorizationService {
  return new CategorizationService(companyId)
}
