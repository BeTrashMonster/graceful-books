/**
 * Categorization Store Tests
 *
 * Integration tests for categorization store including:
 * - Rule management (CRUD)
 * - Suggestion history tracking
 * - Training data management
 * - System rules initialization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db, initializeDatabase, deleteDatabase } from '../db/database'
import {
  initializeSystemRules,
  createCustomRule,
  updateRule,
  deleteRule,
  getRulesByCompany,
  recordSuggestion,
  getSuggestionHistory,
  getTrainingData,
  getTrainingDataStats,
  clearTrainingData,
} from './categorization'
import { createDefaultCategory, CategoryType } from '../db/schema/categories.schema'
import type { Category } from '../db/schema/categories.schema'
import type { CategorySuggestion } from '../types/categorization.types'

describe('Categorization Store', () => {
  const companyId = 'test-company-123'
  const deviceId = 'test-device-123'
  const categories: Category[] = []

  beforeEach(async () => {
    await deleteDatabase()
    await initializeDatabase()

    // Clear categories array from previous test runs
    categories.length = 0

    // Create test categories matching system rule category names
    const categoryNames = [
      'Utilities',
      'Office Supplies',
      'Rent',
      'Insurance',
      'Marketing',
      'Software & Subscriptions',
      'Travel',
      'Meals & Entertainment',
      'Professional Fees',
      'Banking Fees',
      'Payroll',
      'Taxes',
    ]

    for (const name of categoryNames) {
      const category = createDefaultCategory(companyId, name, CategoryType.EXPENSE, deviceId)
      const id = crypto.randomUUID()
      const cat: Category = { ...category, id } as Category
      await db.categories.add(cat)
      categories.push(cat)
    }
  })

  afterEach(async () => {
    await deleteDatabase()
  })

  describe('System Rules Initialization', () => {
    it('should initialize system categorization rules', async () => {
      const result = await initializeSystemRules(companyId)

      expect(result.success).toBe(true)
      expect(result.data).toBeGreaterThan(0)

      // Verify rules were created
      const rules = await db.categorizationRules
        .where('company_id')
        .equals(companyId)
        .toArray()

      expect(rules.length).toBeGreaterThan(0)
      expect(rules.every((r) => r.is_system)).toBe(true)
      expect(rules.every((r) => r.active)).toBe(true)
    })

    it('should map system rules to correct categories', async () => {
      await initializeSystemRules(companyId)

      const utilitiesCategory = categories.find((c) => c.name === 'Utilities')!
      const utilitiesRules = await db.categorizationRules
        .where('category_id')
        .equals(utilitiesCategory.id)
        .toArray()

      expect(utilitiesRules.length).toBeGreaterThan(0)

      // Check that utilities rules have correct patterns
      const patterns = utilitiesRules.map((r) => r.pattern)
      expect(patterns.some((p) => p.includes('electric'))).toBe(true)
    })

    it('should handle missing category names gracefully', async () => {
      // Delete one category by ID
      const utilitiesCategory = categories.find((c) => c.name === 'Utilities')!
      await db.categories.delete(utilitiesCategory.id)

      const result = await initializeSystemRules(companyId)

      // Should still succeed but create fewer rules
      expect(result.success).toBe(true)
    })
  })

  describe('Custom Rule Management', () => {
    it('should create a custom categorization rule', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!

      const result = await createCustomRule({
        company_id: companyId,
        pattern: 'facebook',
        pattern_type: 'contains',
        field: 'vendor',
        category_id: marketingCategory.id,
        priority: 100,
        is_system: false,
        active: true,
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.pattern).toBe('facebook')
      expect(result.data?.is_system).toBe(false)
    })

    it('should validate custom rule before creation', async () => {
      const result = await createCustomRule({
        company_id: companyId,
        pattern: '', // Invalid: empty pattern
        pattern_type: 'contains',
        field: 'vendor',
        category_id: 'invalid-id',
        priority: -1, // Invalid: negative priority
        is_system: false,
        active: true,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Validation failed')
    })

    it('should validate regex patterns', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!

      const result = await createCustomRule({
        company_id: companyId,
        pattern: '(invalid[regex', // Invalid regex
        pattern_type: 'regex',
        field: 'vendor',
        category_id: marketingCategory.id,
        priority: 100,
        is_system: false,
        active: true,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('valid regular expression')
    })

    it('should update a custom rule', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!

      const created = await createCustomRule({
        company_id: companyId,
        pattern: 'facebook',
        pattern_type: 'contains',
        field: 'vendor',
        category_id: marketingCategory.id,
        priority: 100,
        is_system: false,
        active: true,
      })

      expect(created.success).toBe(true)

      const result = await updateRule(created.data!.id, {
        pattern: 'facebook ads',
        priority: 150,
      })

      expect(result.success).toBe(true)
      expect(result.data?.pattern).toBe('facebook ads')
      expect(result.data?.priority).toBe(150)
    })

    it('should not allow updating system rules', async () => {
      await initializeSystemRules(companyId)

      const systemRule = await db.categorizationRules
        .where('company_id')
        .equals(companyId)
        .and((r) => r.is_system)
        .first()

      expect(systemRule).toBeDefined()

      const result = await updateRule(systemRule!.id, {
        pattern: 'modified pattern',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot modify system-defined rules')
    })

    it('should delete a custom rule', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!

      const created = await createCustomRule({
        company_id: companyId,
        pattern: 'facebook',
        pattern_type: 'contains',
        field: 'vendor',
        category_id: marketingCategory.id,
        priority: 100,
        is_system: false,
        active: true,
      })

      expect(created.success).toBe(true)

      const result = await deleteRule(created.data!.id)

      expect(result.success).toBe(true)

      // Verify deletion
      const deleted = await db.categorizationRules.get(created.data!.id)
      expect(deleted).toBeUndefined()
    })

    it('should not allow deleting system rules', async () => {
      await initializeSystemRules(companyId)

      const systemRule = await db.categorizationRules
        .where('company_id')
        .equals(companyId)
        .and((r) => r.is_system)
        .first()

      expect(systemRule).toBeDefined()

      const result = await deleteRule(systemRule!.id)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot delete system-defined rules')
    })

    it('should get rules sorted by priority', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!

      // Create rules with different priorities
      await createCustomRule({
        company_id: companyId,
        pattern: 'low-priority',
        pattern_type: 'contains',
        field: 'vendor',
        category_id: marketingCategory.id,
        priority: 10,
        is_system: false,
        active: true,
      })

      await createCustomRule({
        company_id: companyId,
        pattern: 'high-priority',
        pattern_type: 'contains',
        field: 'vendor',
        category_id: marketingCategory.id,
        priority: 100,
        is_system: false,
        active: true,
      })

      const result = await getRulesByCompany(companyId)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)

      // Should be sorted by priority descending
      expect(result.data![0].priority).toBeGreaterThan(result.data![1].priority)
    })

    it('should filter inactive rules by default', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!

      await createCustomRule({
        company_id: companyId,
        pattern: 'active-rule',
        pattern_type: 'contains',
        field: 'vendor',
        category_id: marketingCategory.id,
        priority: 100,
        is_system: false,
        active: true,
      })

      await createCustomRule({
        company_id: companyId,
        pattern: 'inactive-rule',
        pattern_type: 'contains',
        field: 'vendor',
        category_id: marketingCategory.id,
        priority: 100,
        is_system: false,
        active: false,
      })

      const activeOnly = await getRulesByCompany(companyId, false)
      const all = await getRulesByCompany(companyId, true)

      expect(activeOnly.data).toHaveLength(1)
      expect(all.data).toHaveLength(2)
    })
  })

  describe('Suggestion History', () => {
    it('should record a suggestion', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!

      const suggestion: CategorySuggestion = {
        categoryId: marketingCategory.id,
        categoryName: marketingCategory.name,
        confidence: 0.85,
        confidenceLevel: 'high',
        source: 'ml',
      }

      const result = await recordSuggestion(companyId, 'txn-123', suggestion)

      expect(result.success).toBe(true)
      expect(result.data?.transaction_id).toBe('txn-123')
      expect(result.data?.suggested_category_id).toBe(marketingCategory.id)
      expect(result.data?.confidence).toBe(0.85)
      expect(result.data?.source).toBe('ml')
      expect(result.data?.was_accepted).toBeNull()
    })

    it('should retrieve suggestion history for a transaction', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!

      const suggestion: CategorySuggestion = {
        categoryId: marketingCategory.id,
        categoryName: marketingCategory.name,
        confidence: 0.85,
        confidenceLevel: 'high',
        source: 'ml',
      }

      await recordSuggestion(companyId, 'txn-123', suggestion)

      const result = await getSuggestionHistory('txn-123')

      expect(result.success).toBe(true)
      expect(result.data).not.toBeNull()
      expect(result.data?.transaction_id).toBe('txn-123')
    })

    it('should return null for transaction with no history', async () => {
      const result = await getSuggestionHistory('non-existent-txn')

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
    })
  })

  describe('Training Data Management', () => {
    it('should retrieve training data for a company', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!

      // Add training data directly
      await db.trainingData.add({
        id: crypto.randomUUID(),
        company_id: companyId,
        vendorName: 'Google Ads',
        description: 'Marketing campaign',
        amount: 500.0,
        categoryId: marketingCategory.id,
        categoryName: marketingCategory.name,
        transactionDate: Date.now(),
        wasCorrection: false,
        created_at: Date.now(),
      })

      await db.trainingData.add({
        id: crypto.randomUUID(),
        company_id: companyId,
        vendorName: 'Facebook Ads',
        description: 'Social media marketing',
        amount: 300.0,
        categoryId: marketingCategory.id,
        categoryName: marketingCategory.name,
        transactionDate: Date.now(),
        wasCorrection: true,
        created_at: Date.now(),
      })

      const result = await getTrainingData(companyId)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
    })

    it('should get training data statistics by category', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!
      const softwareCategory = categories.find((c) => c.name === 'Software & Subscriptions')!

      // Add training data for different categories
      for (let i = 0; i < 5; i++) {
        await db.trainingData.add({
          id: crypto.randomUUID(),
          company_id: companyId,
          vendorName: 'Google Ads',
          description: `Campaign ${i}`,
          amount: 100.0,
          categoryId: marketingCategory.id,
          categoryName: marketingCategory.name,
          transactionDate: Date.now(),
          wasCorrection: i < 2, // 2 corrections, 3 normal
          created_at: Date.now(),
        })
      }

      for (let i = 0; i < 3; i++) {
        await db.trainingData.add({
          id: crypto.randomUUID(),
          company_id: companyId,
          vendorName: 'Adobe',
          description: `Software ${i}`,
          amount: 50.0,
          categoryId: softwareCategory.id,
          categoryName: softwareCategory.name,
          transactionDate: Date.now(),
          wasCorrection: i === 0, // 1 correction, 2 normal
          created_at: Date.now(),
        })
      }

      const result = await getTrainingDataStats(companyId)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)

      const marketingStats = result.data!.find((s) => s.categoryId === marketingCategory.id)
      const softwareStats = result.data!.find((s) => s.categoryId === softwareCategory.id)

      expect(marketingStats?.count).toBe(5)
      expect(marketingStats?.correctionCount).toBe(2)

      expect(softwareStats?.count).toBe(3)
      expect(softwareStats?.correctionCount).toBe(1)
    })

    it('should clear training data for a company', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!

      // Add some training data
      for (let i = 0; i < 5; i++) {
        await db.trainingData.add({
          id: crypto.randomUUID(),
          company_id: companyId,
          vendorName: 'Test Vendor',
          description: 'Test',
          amount: 100.0,
          categoryId: marketingCategory.id,
          categoryName: marketingCategory.name,
          transactionDate: Date.now(),
          wasCorrection: false,
          created_at: Date.now(),
        })
      }

      const result = await clearTrainingData(companyId)

      expect(result.success).toBe(true)
      expect(result.data).toBe(5)

      // Verify data was cleared
      const remaining = await db.trainingData.where('company_id').equals(companyId).toArray()
      expect(remaining).toHaveLength(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Try to create a rule with missing required fields
      const result = await createCustomRule({
        company_id: companyId,
        pattern: 'test',
        pattern_type: 'contains',
        field: 'vendor',
        category_id: '', // Empty category ID
        priority: 100,
        is_system: false,
        active: true,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle non-existent rule updates', async () => {
      const result = await updateRule('non-existent-id', {
        pattern: 'new pattern',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Rule not found')
    })

    it('should handle non-existent rule deletions', async () => {
      const result = await deleteRule('non-existent-id')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Rule not found')
    })
  })
})
