/**
 * Expense Categorization Types
 *
 * Types for AI-powered expense categorization with learning capabilities.
 * Per E5: Expense Categorization with Suggestions (Nice)
 *
 * Requirements:
 * - E5: Category suggestions based on vendor and description
 * - E5: Learning from user corrections over time
 * - E5: Suggestion accuracy tracking
 * - E5: Hybrid approach with rule-based fallback
 */

/**
 * Confidence level for category suggestions
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none'

/**
 * Category suggestion from the ML model or rule-based system
 */
export interface CategorySuggestion {
  categoryId: string
  categoryName: string
  confidence: number // 0.0 to 1.0
  confidenceLevel: ConfidenceLevel
  source: 'ml' | 'rules' | 'hybrid'
  reasoning?: string // Human-readable explanation
}

/**
 * Input data for categorization
 */
export interface CategorizationInput {
  vendorName?: string
  vendorId?: string
  description: string
  amount?: number
  transactionDate?: number
}

/**
 * Training data point for the ML model
 */
export interface TrainingDataPoint {
  id: string
  vendorName: string
  description: string
  amount: number
  categoryId: string
  categoryName: string
  transactionDate: number
  wasCorrection: boolean // Whether this was a user correction
  created_at: number
}

/**
 * Encrypted ML model storage
 */
export interface CategorizationModel {
  id: string
  company_id: string
  model_data: string // ENCRYPTED - Serialized neural network weights
  training_count: number // Number of training examples
  last_trained_at: number
  accuracy_metrics: AccuracyMetrics
  version: string // Model version for migration compatibility
  created_at: number
  updated_at: number
}

/**
 * Accuracy tracking metrics
 */
export interface AccuracyMetrics {
  totalSuggestions: number
  acceptedSuggestions: number
  correctedSuggestions: number
  accuracy: number // Percentage 0-100
  confidenceBreakdown: {
    high: { total: number; accepted: number }
    medium: { total: number; accepted: number }
    low: { total: number; accepted: number }
  }
  lastUpdated: number
}

/**
 * Suggestion history for tracking
 */
export interface SuggestionHistory {
  id: string
  company_id: string
  transaction_id: string
  suggested_category_id: string
  actual_category_id: string | null // null if not yet accepted/corrected
  confidence: number
  source: 'ml' | 'rules' | 'hybrid'
  was_accepted: boolean | null // null if not yet decided
  created_at: number
  updated_at: number
}

/**
 * Rule-based categorization pattern
 */
export interface CategorizationRule {
  id: string
  company_id: string
  pattern: string // Regex or simple string match
  pattern_type: 'exact' | 'contains' | 'regex' | 'starts_with' | 'ends_with'
  field: 'vendor' | 'description' | 'both'
  category_id: string
  priority: number // Higher priority rules are checked first
  is_system: boolean // System rules vs user-created
  active: boolean
  created_at: number
  updated_at: number
}

/**
 * Bulk categorization request
 */
export interface BulkCategorizationRequest {
  transactionIds: string[]
  categoryId: string
  applyToSimilar?: {
    vendorId?: string
    descriptionPattern?: string
    amountRange?: { min: number; max: number }
  }
}

/**
 * Bulk categorization result
 */
export interface BulkCategorizationResult {
  successCount: number
  failureCount: number
  results: Array<{
    transactionId: string
    success: boolean
    error?: string
  }>
}

/**
 * ML model training options
 */
export interface TrainingOptions {
  epochs?: number
  learningRate?: number
  minTrainingExamples?: number
  validationSplit?: number
}

/**
 * Feature vector for ML model input
 */
export interface FeatureVector {
  // Vendor features
  vendorNameHash: number
  vendorFrequency: number

  // Description features
  descriptionLength: number
  descriptionWordCount: number
  descriptionKeywords: number[] // TF-IDF or similar

  // Amount features
  amountNormalized: number
  amountBucket: number // Categorical: small/medium/large

  // Temporal features
  dayOfWeek: number
  dayOfMonth: number
  monthOfYear: number

  // Historical features
  previousCategoryForVendor?: number
  categoryFrequency?: number
}

/**
 * Categorization service state
 */
export interface CategorizationState {
  modelLoaded: boolean
  isTraining: boolean
  lastTrainedAt: number | null
  trainingCount: number
  accuracyMetrics: AccuracyMetrics | null
}

/**
 * Learning feedback from user
 */
export interface LearningFeedback {
  transactionId: string
  suggestedCategoryId: string
  actualCategoryId: string
  vendorName: string
  description: string
  amount: number
  transactionDate: number
  confidence: number
  source: 'ml' | 'rules' | 'hybrid'
}

/**
 * Similar transaction search criteria
 */
export interface SimilarTransactionCriteria {
  vendorId?: string
  vendorName?: string
  descriptionPattern?: string
  amountRange?: { min: number; max: number }
  dateRange?: { start: number; end: number }
  categoryId?: string
  excludeTransactionIds?: string[]
}

/**
 * Similar transaction result
 */
export interface SimilarTransaction {
  transactionId: string
  vendorName: string
  description: string
  amount: number
  currentCategoryId: string | null
  currentCategoryName: string | null
  similarityScore: number // 0.0 to 1.0
  matchedFields: string[] // Which fields matched the criteria
}
