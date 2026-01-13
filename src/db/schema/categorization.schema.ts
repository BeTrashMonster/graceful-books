/**
 * Categorization Schema Definition
 *
 * Defines the structure for storing ML models, training data, and suggestion history
 * for AI-powered expense categorization.
 *
 * Requirements:
 * - E5: Expense Categorization with Suggestions
 * - ARCH-002: Zero-Knowledge Encryption (model data is encrypted)
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { BaseEntity, VersionVector } from '../../types/database.types'
import type {
  CategorizationModel,
  TrainingDataPoint,
  SuggestionHistory,
  CategorizationRule,
  AccuracyMetrics,
} from '../../types/categorization.types'

/**
 * Dexie.js schema definition for CategorizationModels table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying models by company (one model per company)
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const categorizationModelsSchema = 'id, company_id, updated_at'

/**
 * Dexie.js schema definition for TrainingData table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying training data by company
 * - category_id: For querying by category
 * - [company_id+category_id]: Compound index for category-filtered queries
 * - vendor_name: For querying by vendor
 * - created_at: For chronological ordering
 */
export const trainingDataSchema =
  'id, company_id, category_id, [company_id+category_id], vendor_name, created_at'

/**
 * Dexie.js schema definition for SuggestionHistory table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying history by company
 * - transaction_id: For querying by transaction
 * - suggested_category_id: For querying by suggested category
 * - created_at: For chronological ordering
 * - updated_at: For tracking corrections
 */
export const suggestionHistorySchema =
  'id, company_id, transaction_id, suggested_category_id, created_at, updated_at'

/**
 * Dexie.js schema definition for CategorizationRules table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying rules by company
 * - category_id: For querying by category
 * - [company_id+active]: Compound index for active rules
 * - priority: For ordering rule application
 * - updated_at: For CRDT conflict resolution
 */
export const categorizationRulesSchema =
  'id, company_id, category_id, [company_id+active], priority, updated_at'

/**
 * Table name constants
 */
export const CATEGORIZATION_MODELS_TABLE = 'categorization_models'
export const TRAINING_DATA_TABLE = 'training_data'
export const SUGGESTION_HISTORY_TABLE = 'suggestion_history'
export const CATEGORIZATION_RULES_TABLE = 'categorization_rules'

/**
 * Default values for new CategorizationModel
 */
export const createDefaultCategorizationModel = (
  companyId: string,
  deviceId: string
): Partial<CategorizationModel> => {
  const now = Date.now()

  return {
    company_id: companyId,
    model_data: '', // Will be populated during training
    training_count: 0,
    last_trained_at: now,
    accuracy_metrics: createDefaultAccuracyMetrics(),
    version: '1.0.0',
    created_at: now,
    updated_at: now,
  }
}

/**
 * Default accuracy metrics
 */
export const createDefaultAccuracyMetrics = (): AccuracyMetrics => {
  return {
    totalSuggestions: 0,
    acceptedSuggestions: 0,
    correctedSuggestions: 0,
    accuracy: 0,
    confidenceBreakdown: {
      high: { total: 0, accepted: 0 },
      medium: { total: 0, accepted: 0 },
      low: { total: 0, accepted: 0 },
    },
    lastUpdated: Date.now(),
  }
}

/**
 * Default values for new TrainingDataPoint
 */
export const createTrainingDataPoint = (
  companyId: string,
  vendorName: string,
  description: string,
  amount: number,
  categoryId: string,
  categoryName: string,
  transactionDate: number,
  wasCorrection: boolean
): Partial<TrainingDataPoint> => {
  const now = Date.now()

  return {
    id: crypto.randomUUID(),
    vendorName,
    description,
    amount,
    categoryId,
    categoryName,
    transactionDate,
    wasCorrection,
    created_at: now,
  }
}

/**
 * Default values for new SuggestionHistory
 */
export const createSuggestionHistory = (
  companyId: string,
  transactionId: string,
  suggestedCategoryId: string,
  confidence: number,
  source: 'ml' | 'rules' | 'hybrid'
): Partial<SuggestionHistory> => {
  const now = Date.now()

  return {
    company_id: companyId,
    transaction_id: transactionId,
    suggested_category_id: suggestedCategoryId,
    actual_category_id: null,
    confidence,
    source,
    was_accepted: null,
    created_at: now,
    updated_at: now,
  }
}

/**
 * Default values for new CategorizationRule
 */
export const createCategorizationRule = (
  companyId: string,
  pattern: string,
  patternType: 'exact' | 'contains' | 'regex' | 'starts_with' | 'ends_with',
  field: 'vendor' | 'description' | 'both',
  categoryId: string,
  priority: number,
  isSystem: boolean = false
): Partial<CategorizationRule> => {
  const now = Date.now()

  return {
    company_id: companyId,
    pattern,
    pattern_type: patternType,
    field,
    category_id: categoryId,
    priority,
    is_system: isSystem,
    active: true,
    created_at: now,
    updated_at: now,
  }
}

/**
 * System-defined categorization rules
 * These provide fallback categorization when ML confidence is low
 */
export const SYSTEM_CATEGORIZATION_RULES: Array<{
  pattern: string
  patternType: 'contains' | 'regex' | 'starts_with'
  field: 'vendor' | 'description' | 'both'
  categoryName: string // Will be mapped to actual category ID
  priority: number
}> = [
  // Utilities
  {
    pattern: 'electric|electricity|power|utility',
    patternType: 'contains',
    field: 'both',
    categoryName: 'Utilities',
    priority: 100,
  },
  {
    pattern: 'water|sewage|sewer',
    patternType: 'contains',
    field: 'both',
    categoryName: 'Utilities',
    priority: 100,
  },
  {
    pattern: 'gas|propane',
    patternType: 'contains',
    field: 'both',
    categoryName: 'Utilities',
    priority: 100,
  },
  {
    pattern: 'internet|wifi|broadband|phone|cellular',
    patternType: 'contains',
    field: 'both',
    categoryName: 'Utilities',
    priority: 100,
  },

  // Office Supplies
  {
    pattern: 'office|supplies|staples|paper|printer',
    patternType: 'contains',
    field: 'both',
    categoryName: 'Office Supplies',
    priority: 90,
  },

  // Rent & Lease
  {
    pattern: 'rent|lease|landlord',
    patternType: 'contains',
    field: 'both',
    categoryName: 'Rent',
    priority: 95,
  },

  // Insurance
  {
    pattern: 'insurance|premium',
    patternType: 'contains',
    field: 'both',
    categoryName: 'Insurance',
    priority: 95,
  },

  // Marketing & Advertising
  {
    pattern: 'marketing|advertising|facebook ads|google ads|seo|social media',
    patternType: 'contains',
    field: 'both',
    categoryName: 'Marketing',
    priority: 90,
  },

  // Software & Subscriptions
  {
    pattern: 'software|saas|subscription|adobe|microsoft|zoom|slack',
    patternType: 'contains',
    field: 'both',
    categoryName: 'Software & Subscriptions',
    priority: 90,
  },

  // Travel
  {
    pattern: 'airline|hotel|airbnb|uber|lyft|rental car|mileage',
    patternType: 'contains',
    field: 'both',
    categoryName: 'Travel',
    priority: 90,
  },

  // Meals & Entertainment
  {
    pattern: 'restaurant|coffee|lunch|dinner|meal|catering',
    patternType: 'contains',
    field: 'both',
    categoryName: 'Meals & Entertainment',
    priority: 85,
  },

  // Professional Fees
  {
    pattern: 'lawyer|attorney|accountant|consultant|professional fees',
    patternType: 'contains',
    field: 'both',
    categoryName: 'Professional Fees',
    priority: 90,
  },

  // Banking Fees
  {
    pattern: 'bank fee|transaction fee|monthly fee|service charge',
    patternType: 'contains',
    field: 'both',
    categoryName: 'Banking Fees',
    priority: 95,
  },

  // Payroll
  {
    pattern: 'payroll|salary|wages|compensation',
    patternType: 'contains',
    field: 'both',
    categoryName: 'Payroll',
    priority: 95,
  },

  // Taxes
  {
    pattern: 'tax|irs|state tax|sales tax|payroll tax',
    patternType: 'contains',
    field: 'both',
    categoryName: 'Taxes',
    priority: 95,
  },
]

/**
 * Validation: Ensure training data point has valid fields
 */
export const validateTrainingDataPoint = (
  dataPoint: Partial<TrainingDataPoint>
): string[] => {
  const errors: string[] = []

  if (!dataPoint.vendorName || dataPoint.vendorName.trim() === '') {
    errors.push('vendorName is required')
  }

  if (!dataPoint.description || dataPoint.description.trim() === '') {
    errors.push('description is required')
  }

  if (dataPoint.amount === undefined || dataPoint.amount < 0) {
    errors.push('amount must be a non-negative number')
  }

  if (!dataPoint.categoryId) {
    errors.push('categoryId is required')
  }

  if (!dataPoint.categoryName) {
    errors.push('categoryName is required')
  }

  if (!dataPoint.transactionDate) {
    errors.push('transactionDate is required')
  }

  return errors
}

/**
 * Validation: Ensure categorization rule has valid fields
 */
export const validateCategorizationRule = (rule: Partial<CategorizationRule>): string[] => {
  const errors: string[] = []

  if (!rule.pattern || rule.pattern.trim() === '') {
    errors.push('pattern is required')
  }

  if (!rule.pattern_type) {
    errors.push('pattern_type is required')
  }

  if (!rule.field) {
    errors.push('field is required')
  }

  if (!rule.category_id) {
    errors.push('category_id is required')
  }

  if (rule.priority === undefined || rule.priority < 0) {
    errors.push('priority must be a non-negative number')
  }

  // Validate regex pattern if type is regex
  if (rule.pattern_type === 'regex') {
    try {
      new RegExp(rule.pattern)
    } catch (e) {
      errors.push('pattern must be a valid regular expression')
    }
  }

  return errors
}

/**
 * Helper: Update accuracy metrics with new suggestion result
 */
export const updateAccuracyMetrics = (
  metrics: AccuracyMetrics,
  confidence: number,
  wasAccepted: boolean
): AccuracyMetrics => {
  const confidenceLevel = getConfidenceLevel(confidence)

  const updated: AccuracyMetrics = {
    ...metrics,
    totalSuggestions: metrics.totalSuggestions + 1,
    acceptedSuggestions: wasAccepted
      ? metrics.acceptedSuggestions + 1
      : metrics.acceptedSuggestions,
    correctedSuggestions: !wasAccepted
      ? metrics.correctedSuggestions + 1
      : metrics.correctedSuggestions,
    confidenceBreakdown: { ...metrics.confidenceBreakdown },
    lastUpdated: Date.now(),
  }

  // Update confidence breakdown
  updated.confidenceBreakdown[confidenceLevel] = {
    total: updated.confidenceBreakdown[confidenceLevel].total + 1,
    accepted: wasAccepted
      ? updated.confidenceBreakdown[confidenceLevel].accepted + 1
      : updated.confidenceBreakdown[confidenceLevel].accepted,
  }

  // Recalculate overall accuracy
  updated.accuracy =
    updated.totalSuggestions > 0
      ? (updated.acceptedSuggestions / updated.totalSuggestions) * 100
      : 0

  return updated
}

/**
 * Helper: Get confidence level from confidence score
 */
export const getConfidenceLevel = (
  confidence: number
): 'high' | 'medium' | 'low' => {
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.5) return 'medium'
  return 'low'
}

/**
 * Helper: Calculate accuracy for a specific confidence level
 */
export const getConfidenceLevelAccuracy = (
  metrics: AccuracyMetrics,
  level: 'high' | 'medium' | 'low'
): number => {
  const breakdown = metrics.confidenceBreakdown[level]
  if (breakdown.total === 0) return 0
  return (breakdown.accepted / breakdown.total) * 100
}
