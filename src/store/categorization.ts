/**
 * Categorization Store
 *
 * Store module for managing expense categorization suggestions,
 * training data, and rules.
 *
 * Requirements:
 * - E5: Expense Categorization with Suggestions
 */

import { db } from '../db/database'
import {
  createCategorizationRule,
  createSuggestionHistory,
  validateCategorizationRule,
  SYSTEM_CATEGORIZATION_RULES,
} from '../db/schema/categorization.schema'
import type {
  CategorizationRule,
  SuggestionHistory,
  TrainingDataPoint,
  CategorySuggestion,
} from '../types/categorization.types'
import { logger } from '../utils/logger'
import type { Result } from '../types/index'

/**
 * Database operation result type
 */
type DatabaseResult<T> = Result<T, string>

const storeLogger = logger.child('CategorizationStore')

/**
 * Initialize system categorization rules for a company
 */
export async function initializeSystemRules(
  companyId: string
): Promise<DatabaseResult<number>> {
  try {
    // Get existing categories to map system rules
    const categories = await db.categories
      .where('company_id')
      .equals(companyId)
      .and((cat) => cat.deleted_at === null)
      .toArray()

    const categoryNameMap = new Map<string, string>()
    for (const category of categories) {
      categoryNameMap.set(category.name.toLowerCase(), category.id)
    }

    let createdCount = 0

    // Create system rules
    for (const systemRule of SYSTEM_CATEGORIZATION_RULES) {
      const categoryId = categoryNameMap.get(systemRule.categoryName.toLowerCase())

      if (categoryId) {
        const rule = createCategorizationRule(
          companyId,
          systemRule.pattern,
          systemRule.patternType,
          systemRule.field,
          categoryId,
          systemRule.priority,
          true // is_system
        )

        const id = crypto.randomUUID()
        await db.categorizationRules.add({ ...rule, id } as CategorizationRule)
        createdCount++
      }
    }

    storeLogger.info('Initialized system categorization rules', {
      companyId,
      count: createdCount,
    })

    return { success: true, data: createdCount }
  } catch (error) {
    storeLogger.error('Failed to initialize system rules', { error, companyId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize system rules',
    }
  }
}

/**
 * Create a custom categorization rule
 */
export async function createCustomRule(
  rule: Omit<CategorizationRule, 'id' | 'created_at' | 'updated_at'>
): Promise<DatabaseResult<CategorizationRule>> {
  try {
    // Validate rule
    const errors = validateCategorizationRule(rule)
    if (errors.length > 0) {
      return {
        success: false,
        error: `Validation failed: ${errors.join(', ')}`,
      }
    }

    const id = crypto.randomUUID()
    const now = Date.now()

    const newRule: CategorizationRule = {
      ...rule,
      id,
      created_at: now,
      updated_at: now,
    }

    await db.categorizationRules.add(newRule)

    storeLogger.info('Created custom categorization rule', { ruleId: id })

    return { success: true, data: newRule }
  } catch (error) {
    storeLogger.error('Failed to create custom rule', { error })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create custom rule',
    }
  }
}

/**
 * Update a categorization rule
 */
export async function updateRule(
  ruleId: string,
  updates: Partial<Omit<CategorizationRule, 'id' | 'created_at'>>
): Promise<DatabaseResult<CategorizationRule>> {
  try {
    const rule = await db.categorizationRules.get(ruleId)

    if (!rule) {
      return {
        success: false,
        error: 'Rule not found',
      }
    }

    // Can't modify system rules
    if (rule.is_system) {
      return {
        success: false,
        error: 'Cannot modify system-defined rules',
      }
    }

    const updatedRule = {
      ...updates,
      updated_at: Date.now(),
    }

    // Validate if pattern or pattern_type changed
    if (updates.pattern || updates.pattern_type) {
      const errors = validateCategorizationRule({ ...rule, ...updatedRule })
      if (errors.length > 0) {
        return {
          success: false,
          error: `Validation failed: ${errors.join(', ')}`,
        }
      }
    }

    await db.categorizationRules.update(ruleId, updatedRule)

    const updated = await db.categorizationRules.get(ruleId)

    storeLogger.info('Updated categorization rule', { ruleId })

    return { success: true, data: updated! }
  } catch (error) {
    storeLogger.error('Failed to update rule', { error, ruleId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update rule',
    }
  }
}

/**
 * Delete a categorization rule
 */
export async function deleteRule(ruleId: string): Promise<DatabaseResult<void>> {
  try {
    const rule = await db.categorizationRules.get(ruleId)

    if (!rule) {
      return {
        success: false,
        error: 'Rule not found',
      }
    }

    // Can't delete system rules
    if (rule.is_system) {
      return {
        success: false,
        error: 'Cannot delete system-defined rules',
      }
    }

    await db.categorizationRules.delete(ruleId)

    storeLogger.info('Deleted categorization rule', { ruleId })

    return { success: true, data: undefined }
  } catch (error) {
    storeLogger.error('Failed to delete rule', { error, ruleId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete rule',
    }
  }
}

/**
 * Get all rules for a company
 */
export async function getRulesByCompany(
  companyId: string,
  includeInactive: boolean = false
): Promise<DatabaseResult<CategorizationRule[]>> {
  try {
    let query = db.categorizationRules.where('company_id').equals(companyId)

    if (!includeInactive) {
      query = query.and((rule) => rule.active)
    }

    const rules = await query.sortBy('priority')

    // Return in descending priority order (highest first)
    return { success: true, data: rules.reverse() }
  } catch (error) {
    storeLogger.error('Failed to get rules', { error, companyId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get rules',
    }
  }
}

/**
 * Record a suggestion in history
 */
export async function recordSuggestion(
  companyId: string,
  transactionId: string,
  suggestion: CategorySuggestion
): Promise<DatabaseResult<SuggestionHistory>> {
  try {
    const history = createSuggestionHistory(
      companyId,
      transactionId,
      suggestion.categoryId,
      suggestion.confidence,
      suggestion.source
    )

    const id = crypto.randomUUID()
    const newHistory: SuggestionHistory = {
      ...history,
      id,
      company_id: companyId,
      transaction_id: transactionId,
      suggested_category_id: suggestion.categoryId,
      actual_category_id: null,
      confidence: suggestion.confidence,
      source: suggestion.source,
      was_accepted: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    }

    await db.suggestionHistory.add(newHistory)

    storeLogger.info('Recorded suggestion history', { transactionId, suggestionId: id })

    return { success: true, data: newHistory }
  } catch (error) {
    storeLogger.error('Failed to record suggestion', { error, transactionId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record suggestion',
    }
  }
}

/**
 * Get suggestion history for a transaction
 */
export async function getSuggestionHistory(
  transactionId: string
): Promise<DatabaseResult<SuggestionHistory | null>> {
  try {
    const history = await db.suggestionHistory
      .where('transaction_id')
      .equals(transactionId)
      .first()

    return { success: true, data: history || null }
  } catch (error) {
    storeLogger.error('Failed to get suggestion history', { error, transactionId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get suggestion history',
    }
  }
}

/**
 * Get all training data for a company
 */
export async function getTrainingData(
  companyId: string
): Promise<DatabaseResult<TrainingDataPoint[]>> {
  try {
    const data = await db.trainingData
      .where('company_id')
      .equals(companyId)
      .sortBy('created_at')

    return { success: true, data: data.reverse() }
  } catch (error) {
    storeLogger.error('Failed to get training data', { error, companyId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get training data',
    }
  }
}

/**
 * Get training data count by category
 */
export async function getTrainingDataStats(companyId: string): Promise<
  DatabaseResult<
    Array<{
      categoryId: string
      categoryName: string
      count: number
      correctionCount: number
    }>
  >
> {
  try {
    const data = await db.trainingData.where('company_id').equals(companyId).toArray()

    const stats = new Map<
      string,
      { categoryId: string; categoryName: string; count: number; correctionCount: number }
    >()

    for (const point of data) {
      const existing = stats.get(point.categoryId) || {
        categoryId: point.categoryId,
        categoryName: point.categoryName,
        count: 0,
        correctionCount: 0,
      }

      existing.count++
      if (point.wasCorrection) {
        existing.correctionCount++
      }

      stats.set(point.categoryId, existing)
    }

    return { success: true, data: Array.from(stats.values()) }
  } catch (error) {
    storeLogger.error('Failed to get training data stats', { error, companyId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get training data stats',
    }
  }
}

/**
 * Clear training data (for testing or reset)
 */
export async function clearTrainingData(companyId: string): Promise<DatabaseResult<number>> {
  try {
    const count = await db.trainingData.where('company_id').equals(companyId).delete()

    storeLogger.info('Cleared training data', { companyId, count })

    return { success: true, data: count }
  } catch (error) {
    storeLogger.error('Failed to clear training data', { error, companyId })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear training data',
    }
  }
}
