/**
 * Categorization Service Tests
 *
 * Comprehensive tests for AI-powered expense categorization including:
 * - Suggestion algorithm accuracy
 * - Learning from corrections
 * - Rule-based fallback
 * - Model persistence and encryption
 * - Accuracy tracking over time
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CategorizationService, createCategorizationService } from './categorization.service'
import { db } from '../db/database'
import { initializeDatabase, deleteDatabase } from '../db/database'
import { createDefaultCategory, CategoryType } from '../db/schema/categories.schema'
import { createCategorizationRule } from '../db/schema/categorization.schema'
import type { Category } from '../db/schema/categories.schema'
import type { CategorizationRule, LearningFeedback } from '../types/categorization.types'

describe('CategorizationService', () => {
  let service: CategorizationService
  const companyId = 'test-company-123'
  const deviceId = 'test-device-123'

  const categories: Category[] = []

  beforeEach(async () => {
    await deleteDatabase()
    await initializeDatabase()

    // Create test categories
    const categoryNames = [
      { name: 'Office Supplies', type: CategoryType.EXPENSE },
      { name: 'Utilities', type: CategoryType.EXPENSE },
      { name: 'Marketing', type: CategoryType.EXPENSE },
      { name: 'Software & Subscriptions', type: CategoryType.EXPENSE },
      { name: 'Meals & Entertainment', type: CategoryType.EXPENSE },
      { name: 'Travel', type: CategoryType.EXPENSE },
      { name: 'Rent', type: CategoryType.EXPENSE },
    ]

    for (const { name, type } of categoryNames) {
      const category = createDefaultCategory(companyId, name, type, deviceId)
      const id = crypto.randomUUID()
      const cat: Category = { ...category, id } as Category
      await db.categories.add(cat)
      categories.push(cat)
    }

    // Initialize service
    service = createCategorizationService(companyId)
    await service.initialize()
  })

  afterEach(async () => {
    await deleteDatabase()
  })

  describe('Rule-Based Suggestions', () => {
    it('should suggest category based on vendor name pattern', async () => {
      // Create a rule for office supplies
      const officeCategory = categories.find((c) => c.name === 'Office Supplies')!
      const rule = createCategorizationRule(
        companyId,
        'staples',
        'contains',
        'vendor',
        officeCategory.id,
        100,
        false
      )

      await db.categorizationRules.add({ ...rule, id: crypto.randomUUID() } as CategorizationRule)
      await service.initialize() // Reload rules

      const suggestion = await service.getSuggestion({
        vendorName: 'Staples Office Supply',
        description: 'Paper and pens',
        amount: 45.99,
      })

      expect(suggestion).not.toBeNull()
      expect(suggestion?.categoryName).toBe('Office Supplies')
      expect(suggestion?.source).toBe('rules')
      expect(suggestion?.confidence).toBeGreaterThan(0.5)
    })

    it('should suggest category based on description pattern', async () => {
      const utilitiesCategory = categories.find((c) => c.name === 'Utilities')!
      const rule = createCategorizationRule(
        companyId,
        'electricity',
        'contains',
        'description',
        utilitiesCategory.id,
        100,
        false
      )

      await db.categorizationRules.add({ ...rule, id: crypto.randomUUID() } as CategorizationRule)
      await service.initialize()

      const suggestion = await service.getSuggestion({
        vendorName: 'City Power Company',
        description: 'Monthly electricity bill',
        amount: 150.0,
      })

      expect(suggestion).not.toBeNull()
      expect(suggestion?.categoryName).toBe('Utilities')
      expect(suggestion?.source).toBe('rules')
    })

    it('should prioritize user rules over system rules', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!
      const softwareCategory = categories.find((c) => c.name === 'Software & Subscriptions')!

      // System rule (lower priority)
      const systemRule = createCategorizationRule(
        companyId,
        'software',
        'contains',
        'both',
        softwareCategory.id,
        50,
        true
      )

      // User rule (higher priority)
      const userRule = createCategorizationRule(
        companyId,
        'mailchimp',
        'contains',
        'vendor',
        marketingCategory.id,
        100,
        false
      )

      await db.categorizationRules.add({ ...systemRule, id: crypto.randomUUID() } as CategorizationRule)
      await db.categorizationRules.add({ ...userRule, id: crypto.randomUUID() } as CategorizationRule)
      await service.initialize()

      const suggestion = await service.getSuggestion({
        vendorName: 'Mailchimp Software',
        description: 'Email marketing software',
        amount: 29.99,
      })

      expect(suggestion?.categoryName).toBe('Marketing')
      expect(suggestion?.source).toBe('rules')
    })

    it('should handle regex patterns correctly', async () => {
      const travelCategory = categories.find((c) => c.name === 'Travel')!
      const rule = createCategorizationRule(
        companyId,
        '^(airline|flight|hotel)',
        'regex',
        'description',
        travelCategory.id,
        100,
        false
      )

      await db.categorizationRules.add({ ...rule, id: crypto.randomUUID() } as CategorizationRule)
      await service.initialize()

      const suggestion1 = await service.getSuggestion({
        vendorName: 'Delta',
        description: 'Airline ticket to NYC',
        amount: 450.0,
      })

      const suggestion2 = await service.getSuggestion({
        vendorName: 'Hilton',
        description: 'Hotel booking',
        amount: 200.0,
      })

      expect(suggestion1?.categoryName).toBe('Travel')
      expect(suggestion2?.categoryName).toBe('Travel')
    })
  })

  describe('Learning Mechanism', () => {
    it('should record feedback and create training data', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!
      const softwareCategory = categories.find((c) => c.name === 'Software & Subscriptions')!

      const feedback: LearningFeedback = {
        transactionId: 'txn-123',
        suggestedCategoryId: softwareCategory.id,
        actualCategoryId: marketingCategory.id,
        vendorName: 'Facebook Ads',
        description: 'Ad campaign',
        amount: 500.0,
        transactionDate: Date.now(),
        confidence: 0.7,
        source: 'rules',
      }

      await service.recordFeedback(feedback)

      // Check training data was created
      const trainingData = await db.trainingData.where('company_id').equals(companyId).toArray()

      expect(trainingData).toHaveLength(1)
      expect(trainingData[0].vendorName).toBe('Facebook Ads')
      expect(trainingData[0].categoryId).toBe(marketingCategory.id)
      expect(trainingData[0].wasCorrection).toBe(true)
    })

    it('should update accuracy metrics when feedback is recorded', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!

      // Record accepted suggestion
      const acceptedFeedback: LearningFeedback = {
        transactionId: 'txn-1',
        suggestedCategoryId: marketingCategory.id,
        actualCategoryId: marketingCategory.id,
        vendorName: 'Google Ads',
        description: 'Ad campaign',
        amount: 300.0,
        transactionDate: Date.now(),
        confidence: 0.8,
        source: 'rules',
      }

      await service.recordFeedback(acceptedFeedback)

      const metrics = await service.getAccuracyMetrics()

      expect(metrics).not.toBeNull()
      expect(metrics?.totalSuggestions).toBe(1)
      expect(metrics?.acceptedSuggestions).toBe(1)
      expect(metrics?.accuracy).toBe(100)
    })

    it('should track confidence-level breakdown in accuracy metrics', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!
      const softwareCategory = categories.find((c) => c.name === 'Software & Subscriptions')!

      // High confidence accepted
      await service.recordFeedback({
        transactionId: 'txn-1',
        suggestedCategoryId: marketingCategory.id,
        actualCategoryId: marketingCategory.id,
        vendorName: 'Google Ads',
        description: 'Ad campaign',
        amount: 300.0,
        transactionDate: Date.now(),
        confidence: 0.9,
        source: 'rules',
      })

      // Medium confidence rejected
      await service.recordFeedback({
        transactionId: 'txn-2',
        suggestedCategoryId: softwareCategory.id,
        actualCategoryId: marketingCategory.id,
        vendorName: 'Facebook',
        description: 'Social media ads',
        amount: 200.0,
        transactionDate: Date.now(),
        confidence: 0.6,
        source: 'rules',
      })

      const metrics = await service.getAccuracyMetrics()

      expect(metrics?.confidenceBreakdown.high.total).toBe(1)
      expect(metrics?.confidenceBreakdown.high.accepted).toBe(1)
      expect(metrics?.confidenceBreakdown.medium.total).toBe(1)
      expect(metrics?.confidenceBreakdown.medium.accepted).toBe(0)
    })
  })

  describe('ML Model Training', () => {
    it('should not train with insufficient data', async () => {
      // Create only a few training examples (less than MIN_TRAINING_EXAMPLES)
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!

      for (let i = 0; i < 5; i++) {
        await service.recordFeedback({
          transactionId: `txn-${i}`,
          suggestedCategoryId: marketingCategory.id,
          actualCategoryId: marketingCategory.id,
          vendorName: 'Google Ads',
          description: `Ad campaign ${i}`,
          amount: 100.0,
          transactionDate: Date.now(),
          confidence: 0.8,
          source: 'rules',
        })
      }

      // Model should not be trained yet
      const model = await db.categorizationModels.where('company_id').equals(companyId).first()

      expect(model?.training_count).toBeLessThan(10)
    })

    it('should train model with sufficient data', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!
      const softwareCategory = categories.find((c) => c.name === 'Software & Subscriptions')!

      // Create enough training examples
      const trainingExamples = [
        {
          vendor: 'Google Ads',
          description: 'Online advertising',
          categoryId: marketingCategory.id,
          categoryName: marketingCategory.name,
        },
        {
          vendor: 'Facebook Ads',
          description: 'Social media marketing',
          categoryId: marketingCategory.id,
          categoryName: marketingCategory.name,
        },
        {
          vendor: 'LinkedIn',
          description: 'Professional networking ads',
          categoryId: marketingCategory.id,
          categoryName: marketingCategory.name,
        },
        {
          vendor: 'Adobe Creative Cloud',
          description: 'Design software subscription',
          categoryId: softwareCategory.id,
          categoryName: softwareCategory.name,
        },
        {
          vendor: 'Microsoft Office',
          description: 'Office productivity software',
          categoryId: softwareCategory.id,
          categoryName: softwareCategory.name,
        },
        {
          vendor: 'Zoom',
          description: 'Video conferencing software',
          categoryId: softwareCategory.id,
          categoryName: softwareCategory.name,
        },
        {
          vendor: 'Slack',
          description: 'Team collaboration software',
          categoryId: softwareCategory.id,
          categoryName: softwareCategory.name,
        },
        {
          vendor: 'Twitter Ads',
          description: 'Social media advertising',
          categoryId: marketingCategory.id,
          categoryName: marketingCategory.name,
        },
        {
          vendor: 'Instagram Ads',
          description: 'Social media promotion',
          categoryId: marketingCategory.id,
          categoryName: marketingCategory.name,
        },
        {
          vendor: 'MailChimp',
          description: 'Email marketing platform',
          categoryId: marketingCategory.id,
          categoryName: marketingCategory.name,
        },
      ]

      for (let i = 0; i < trainingExamples.length; i++) {
        const example = trainingExamples[i]
        await db.trainingData.add({
          id: crypto.randomUUID(),
          vendorName: example.vendor,
          description: example.description,
          amount: 100.0,
          categoryId: example.categoryId,
          categoryName: example.categoryName,
          transactionDate: Date.now(),
          wasCorrection: false,
          created_at: Date.now(),
        })
      }

      // Train the model
      await service.trainModel({ epochs: 100 }) // Use fewer epochs for testing

      const model = await db.categorizationModels.where('company_id').equals(companyId).first()

      expect(model).not.toBeNull()
      expect(model?.training_count).toBe(trainingExamples.length)
      expect(model?.model_data).not.toBe('')
    })
  })

  describe('Accuracy Tracking', () => {
    it('should calculate overall accuracy correctly', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!
      const softwareCategory = categories.find((c) => c.name === 'Software & Subscriptions')!

      // 3 accepted suggestions
      for (let i = 0; i < 3; i++) {
        await service.recordFeedback({
          transactionId: `txn-accepted-${i}`,
          suggestedCategoryId: marketingCategory.id,
          actualCategoryId: marketingCategory.id,
          vendorName: 'Google Ads',
          description: 'Ad campaign',
          amount: 100.0,
          transactionDate: Date.now(),
          confidence: 0.8,
          source: 'rules',
        })
      }

      // 2 corrected suggestions
      for (let i = 0; i < 2; i++) {
        await service.recordFeedback({
          transactionId: `txn-corrected-${i}`,
          suggestedCategoryId: softwareCategory.id,
          actualCategoryId: marketingCategory.id,
          vendorName: 'Facebook',
          description: 'Social ads',
          amount: 100.0,
          transactionDate: Date.now(),
          confidence: 0.7,
          source: 'rules',
        })
      }

      const metrics = await service.getAccuracyMetrics()

      expect(metrics?.totalSuggestions).toBe(5)
      expect(metrics?.acceptedSuggestions).toBe(3)
      expect(metrics?.correctedSuggestions).toBe(2)
      expect(metrics?.accuracy).toBe(60) // 3/5 = 60%
    })

    it('should track suggestion quality improvement over time', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!

      // Early suggestions (lower confidence, more corrections)
      for (let i = 0; i < 5; i++) {
        await service.recordFeedback({
          transactionId: `txn-early-${i}`,
          suggestedCategoryId: marketingCategory.id,
          actualCategoryId: i < 2 ? marketingCategory.id : categories[0].id, // 40% accuracy
          vendorName: 'Google Ads',
          description: 'Ad campaign',
          amount: 100.0,
          transactionDate: Date.now() - 86400000 * 30, // 30 days ago
          confidence: 0.5,
          source: 'rules',
        })
      }

      const earlyMetrics = await service.getAccuracyMetrics()
      const earlyAccuracy = earlyMetrics?.accuracy || 0

      // Later suggestions (higher confidence, fewer corrections)
      for (let i = 0; i < 5; i++) {
        await service.recordFeedback({
          transactionId: `txn-later-${i}`,
          suggestedCategoryId: marketingCategory.id,
          actualCategoryId: marketingCategory.id, // 100% accuracy
          vendorName: 'Google Ads',
          description: 'Ad campaign',
          amount: 100.0,
          transactionDate: Date.now(),
          confidence: 0.9,
          source: 'ml',
        })
      }

      const laterMetrics = await service.getAccuracyMetrics()
      const laterAccuracy = laterMetrics?.accuracy || 0

      // Overall accuracy should improve
      expect(laterAccuracy).toBeGreaterThan(earlyAccuracy)
    })
  })

  describe('Bulk Categorization', () => {
    it('should bulk categorize multiple transactions', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!

      const result = await service.bulkCategorize({
        transactionIds: ['txn-1', 'txn-2', 'txn-3'],
        categoryId: marketingCategory.id,
      })

      expect(result.successCount).toBe(3)
      expect(result.failureCount).toBe(0)
      expect(result.results).toHaveLength(3)
      expect(result.results.every((r) => r.success)).toBe(true)
    })
  })

  describe('Hybrid Approach', () => {
    it('should boost ML confidence when rules agree', async () => {
      const marketingCategory = categories.find((c) => c.name === 'Marketing')!

      // Create a rule
      const rule = createCategorizationRule(
        companyId,
        'google ads',
        'contains',
        'vendor',
        marketingCategory.id,
        100,
        false
      )

      await db.categorizationRules.add({ ...rule, id: crypto.randomUUID() } as CategorizationRule)

      // Create training data for ML
      for (let i = 0; i < 15; i++) {
        await db.trainingData.add({
          id: crypto.randomUUID(),
          vendorName: 'Google Ads',
          description: `Marketing campaign ${i}`,
          amount: 100.0 + i * 10,
          categoryId: marketingCategory.id,
          categoryName: marketingCategory.name,
          transactionDate: Date.now(),
          wasCorrection: false,
          created_at: Date.now(),
        })
      }

      await service.initialize()
      await service.trainModel({ epochs: 100 })

      const suggestion = await service.getSuggestion({
        vendorName: 'Google Ads',
        description: 'New marketing campaign',
        amount: 250.0,
      })

      expect(suggestion).not.toBeNull()
      // Hybrid approach should have high confidence due to both ML and rules agreeing
      expect(suggestion?.source).toBe('hybrid')
      expect(suggestion?.confidence).toBeGreaterThan(0.8)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing vendor name gracefully', async () => {
      const suggestion = await service.getSuggestion({
        description: 'Office supplies purchase',
        amount: 50.0,
      })

      // Should still attempt to categorize based on description
      expect(suggestion).toBeDefined()
    })

    it('should return null when no suggestion is available', async () => {
      const suggestion = await service.getSuggestion({
        vendorName: 'Unknown Vendor XYZ',
        description: 'Unknown transaction type',
        amount: 99.99,
      })

      // With no training data or matching rules, should return null
      expect(suggestion).toBeNull()
    })
  })
})
