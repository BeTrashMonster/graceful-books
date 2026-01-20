/**
 * Smart Automation Assistant Types
 *
 * Types for J2: Rule-based automation that suggests transaction categorizations
 * based on historical patterns and learns from user corrections.
 *
 * Requirements:
 * - J2: Smart Automation Assistant (ROADMAP.md lines 2191-2370)
 * - Rule-based system (NOT chatbot-style AI)
 * - Three automation types: Auto-Categorization, Recurring Detection, Anomaly Detection
 */

/**
 * Confidence level for automation suggestions
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low'

/**
 * Source of suggestion
 */
export type SuggestionSource = 'pattern' | 'frequency' | 'rule' | 'hybrid'

/**
 * Automation type
 */
export type AutomationType = 'categorization' | 'recurring' | 'anomaly'

/**
 * Auto-categorization suggestion for a transaction
 */
export interface CategorizationSuggestion {
  transactionId: string
  suggestedCategoryId: string
  suggestedCategoryName: string
  suggestedAccountId?: string
  suggestedAccountName?: string
  confidence: number // 0-1
  confidenceLevel: ConfidenceLevel
  source: SuggestionSource
  reasoning: string
  matchCount: number // How many historical transactions matched this pattern
  lastMatchDate?: number
  createdAt: number
}

/**
 * Recurring transaction detection
 */
export interface RecurringTransactionMatch {
  transactionId: string
  vendorName: string
  description: string
  amount: string
  frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly'
  averageAmount: string
  amountVariance: number // Percentage variance
  dayOfMonth?: number // For monthly
  dayOfWeek?: number // For weekly/bi-weekly
  previousDates: number[] // Last 5 occurrence dates
  nextExpectedDate?: number
  confidence: number
  confidenceLevel: ConfidenceLevel
  matchCount: number
  createdAt: number
}

/**
 * Anomaly detection result
 */
export interface TransactionAnomaly {
  transactionId: string
  anomalyType:
    | 'unusual_amount'
    | 'new_vendor'
    | 'duplicate_possible'
    | 'unusual_timing'
    | 'unusual_category'
  description: string
  severity: 'high' | 'medium' | 'low'
  confidence: number
  confidenceLevel: ConfidenceLevel
  explanation: string
  expectedValue?: string // What was expected
  actualValue: string // What was observed
  suggestedAction?: string
  dismissed: boolean
  dismissedAt?: number
  dismissedBy?: string
  createdAt: number
}

/**
 * Automation suggestion (union type)
 */
export type AutomationSuggestion =
  | { type: 'categorization'; data: CategorizationSuggestion }
  | { type: 'recurring'; data: RecurringTransactionMatch }
  | { type: 'anomaly'; data: TransactionAnomaly }

/**
 * User response to a suggestion
 */
export interface SuggestionResponse {
  suggestionId: string
  suggestionType: AutomationType
  accepted: boolean
  correctedCategoryId?: string // If user corrected the suggestion
  dismissed: boolean
  dismissReason?: string
  respondedAt: number
  respondedBy: string
}

/**
 * Pattern learned from historical transactions
 */
export interface LearnedPattern {
  id: string
  companyId: string
  vendorName: string
  descriptionPattern?: string
  amountRange?: {
    min: number
    max: number
  }
  categoryId: string
  categoryName: string
  accountId?: string
  accountName?: string
  matchCount: number
  acceptanceRate: number // Percentage of times user accepted this pattern
  lastUsed: number
  createdAt: number
  updatedAt: number
}

/**
 * Automation settings (per company)
 */
export interface AutomationSettings {
  id: string
  companyId: string
  // Auto-categorization settings
  categorizationEnabled: boolean
  categorizationMinConfidence: number // 0-1, only show suggestions above this
  categorizationAutoApply: boolean // Auto-apply high-confidence suggestions
  // Recurring detection settings
  recurringDetectionEnabled: boolean
  recurringMinOccurrences: number // Minimum occurrences to consider recurring
  recurringAutoCreate: boolean // Auto-create recurring templates
  // Anomaly detection settings
  anomalyDetectionEnabled: boolean
  anomalyMinSeverity: 'low' | 'medium' | 'high' // Only show anomalies above this severity
  anomalyDuplicateThreshold: number // Days to check for duplicates
  // Learning settings
  learningEnabled: boolean // Learn from user corrections
  learningMinMatches: number // Minimum matches before creating pattern
  createdAt: number
  updatedAt: number
}

/**
 * Automation accuracy metrics (for tracking improvement)
 */
export interface AutomationAccuracyMetrics {
  id: string
  companyId: string
  automationType: AutomationType
  totalSuggestions: number
  acceptedSuggestions: number
  rejectedSuggestions: number
  correctedSuggestions: number
  accuracyRate: number // acceptedSuggestions / totalSuggestions
  // Confidence breakdown
  highConfidenceAccuracyRate: number
  mediumConfidenceAccuracyRate: number
  lowConfidenceAccuracyRate: number
  // Time tracking
  periodStart: number
  periodEnd: number
  updatedAt: number
}

/**
 * Automation history entry (for user review)
 */
export interface AutomationHistoryEntry {
  id: string
  companyId: string
  transactionId: string
  transactionDescription: string
  transactionAmount: string
  transactionDate: number
  automationType: AutomationType
  suggestionData: CategorizationSuggestion | RecurringTransactionMatch | TransactionAnomaly
  userResponse?: SuggestionResponse
  createdAt: number
}

/**
 * Input for categorization suggestion
 */
export interface CategorizationInput {
  transactionId: string
  vendorName?: string
  description: string
  amount: string
  transactionDate: number
  existingCategoryId?: string
}

/**
 * Input for recurring detection
 */
export interface RecurringDetectionInput {
  transactionId: string
  vendorName: string
  description: string
  amount: string
  transactionDate: number
}

/**
 * Input for anomaly detection
 */
export interface AnomalyDetectionInput {
  transactionId: string
  vendorName?: string
  description: string
  amount: string
  transactionDate: number
  categoryId?: string
  accountId?: string
}

/**
 * Vendor statistics for pattern learning
 */
export interface VendorStatistics {
  vendorName: string
  totalTransactions: number
  commonCategories: Array<{
    categoryId: string
    categoryName: string
    count: number
    percentage: number
  }>
  averageAmount: number
  amountStdDev: number
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'irregular'
  lastTransactionDate: number
  firstTransactionDate: number
}

/**
 * Default automation settings
 */
export const DEFAULT_AUTOMATION_SETTINGS: Omit<
  AutomationSettings,
  'id' | 'companyId' | 'createdAt' | 'updatedAt'
> = {
  categorizationEnabled: true,
  categorizationMinConfidence: 0.7, // Only show medium+ confidence
  categorizationAutoApply: false, // Don't auto-apply by default
  recurringDetectionEnabled: true,
  recurringMinOccurrences: 3, // Need 3+ occurrences to detect pattern
  recurringAutoCreate: false,
  anomalyDetectionEnabled: true,
  anomalyMinSeverity: 'medium', // Only show medium+ severity
  anomalyDuplicateThreshold: 30, // Check 30 days back for duplicates
  learningEnabled: true,
  learningMinMatches: 5, // Need 5+ matches to create learned pattern
}
