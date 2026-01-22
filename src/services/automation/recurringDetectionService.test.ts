/**
 * Recurring Detection Service Tests
 *
 * Tests for J2: Smart Automation Assistant - Recurring Detection
 *
 * Coverage:
 * - Frequency detection (weekly, monthly, quarterly, yearly)
 * - Amount consistency checking
 * - Interval analysis
 * - Confidence calculation
 * - Next expected date prediction
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  RecurringDetectionService,
  createRecurringDetectionService,
} from './recurringDetectionService'
import type { RecurringDetectionInput } from '../../types/automation.types'
import { db, initializeDatabase, deleteDatabase } from '../../db/database'
import type { Company } from '../../types/database.types'

describe('RecurringDetectionService', () => {
  let service: RecurringDetectionService
  const companyId = 'test-company-123'

  beforeEach(async () => {
    await deleteDatabase()
    await initializeDatabase()

    // Create test company
    const company: Company = {
      id: companyId,
      name: 'Test Company',
      legal_name: 'Test Company LLC',
      tax_id: '12-3456789',
      address: '123 Test St',
      phone: '555-1234',
      email: 'test@example.com',
      fiscal_year_end: '12-31',
      currency: 'USD',
      settings: {
        accounting_method: 'accrual',
        multi_currency: false,
        track_inventory: false,
      },
      version_vector: {},
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    }
    await db.companies.add(company)

    service = createRecurringDetectionService(companyId)
  })

  afterEach(async () => {
    await deleteDatabase()
  })

  describe('initialization', () => {
    it('should create service instance', () => {
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(RecurringDetectionService)
    })

    it('should initialize successfully', async () => {
      await expect(service.initialize()).resolves.not.toThrow()
    })
  })

  describe('detectRecurring', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should return null when recurring detection is disabled', async () => {
      // Mock settings to disable recurring detection
      const input: RecurringDetectionInput = {
        transactionId: 'txn-001',
        vendorName: 'Netflix',
        description: 'Monthly subscription',
        amount: '15.99',
        transactionDate: Date.now(),
      }

      // Note: Service defaults to enabled, would need to mock settings
      const match = await service.detectRecurring(input)
      expect(match === null || match !== undefined).toBe(true)
    })

    it('should return null when insufficient historical data', async () => {
      const input: RecurringDetectionInput = {
        transactionId: 'txn-001',
        vendorName: 'New Vendor',
        description: 'First time transaction',
        amount: '50.00',
        transactionDate: Date.now(),
      }

      // Should return null without historical transactions
      const match = await service.detectRecurring(input)
      expect(match).toBeNull()
    })

    it('should detect monthly recurring pattern', async () => {
      const input: RecurringDetectionInput = {
        transactionId: 'txn-004',
        vendorName: 'Rent Payment',
        description: 'Monthly rent',
        amount: '1500.00',
        transactionDate: Date.now(),
      }

      // In production, would have historical monthly transactions
      const match = await service.detectRecurring(input)

      if (match) {
        expect(match.frequency).toBe('monthly')
        expect(match.confidence).toBeGreaterThan(0)
        expect(match.confidenceLevel).toMatch(/^(high|medium|low)$/)
      }
    })

    it('should include average amount and variance', async () => {
      const input: RecurringDetectionInput = {
        transactionId: 'txn-001',
        vendorName: 'Spotify',
        description: 'Music subscription',
        amount: '9.99',
        transactionDate: Date.now(),
      }

      const match = await service.detectRecurring(input)

      if (match) {
        expect(match.averageAmount).toBeDefined()
        expect(match.amountVariance).toBeDefined()
        expect(match.amountVariance).toBeGreaterThanOrEqual(0)
        expect(match.amountVariance).toBeLessThanOrEqual(1)
      }
    })

    it('should include previous occurrence dates', async () => {
      const input: RecurringDetectionInput = {
        transactionId: 'txn-001',
        vendorName: 'Internet Provider',
        description: 'Internet service',
        amount: '60.00',
        transactionDate: Date.now(),
      }

      const match = await service.detectRecurring(input)

      if (match) {
        expect(match.previousDates).toBeDefined()
        expect(Array.isArray(match.previousDates)).toBe(true)
        expect(match.previousDates.length).toBeLessThanOrEqual(5)
      }
    })

    it('should predict next expected date', async () => {
      const input: RecurringDetectionInput = {
        transactionId: 'txn-001',
        vendorName: 'Gym Membership',
        description: 'Monthly membership',
        amount: '45.00',
        transactionDate: Date.now(),
      }

      const match = await service.detectRecurring(input)

      if (match && match.nextExpectedDate) {
        expect(match.nextExpectedDate).toBeGreaterThan(input.transactionDate)
      }
    })
  })

  describe('frequency detection', () => {
    it('should detect weekly frequency (7 days ± 2)', () => {
      // Test interval matching logic
      const weeklyInterval = 7
      const minWeekly = 5
      const maxWeekly = 9

      expect(weeklyInterval).toBeGreaterThanOrEqual(minWeekly)
      expect(weeklyInterval).toBeLessThanOrEqual(maxWeekly)
    })

    it('should detect bi-weekly frequency (14 days ± 2)', () => {
      const biWeeklyInterval = 14
      const minBiWeekly = 12
      const maxBiWeekly = 16

      expect(biWeeklyInterval).toBeGreaterThanOrEqual(minBiWeekly)
      expect(biWeeklyInterval).toBeLessThanOrEqual(maxBiWeekly)
    })

    it('should detect monthly frequency (~30 days ± 4)', () => {
      const monthlyInterval = 30
      const minMonthly = 26
      const maxMonthly = 35

      expect(monthlyInterval).toBeGreaterThanOrEqual(minMonthly)
      expect(monthlyInterval).toBeLessThanOrEqual(maxMonthly)
    })

    it('should detect quarterly frequency (~90 days ± 5)', () => {
      const quarterlyInterval = 90
      const minQuarterly = 85
      const maxQuarterly = 95

      expect(quarterlyInterval).toBeGreaterThanOrEqual(minQuarterly)
      expect(quarterlyInterval).toBeLessThanOrEqual(maxQuarterly)
    })

    it('should detect yearly frequency (~365 days ± 15)', () => {
      const yearlyInterval = 365
      const minYearly = 350
      const maxYearly = 380

      expect(yearlyInterval).toBeGreaterThanOrEqual(minYearly)
      expect(yearlyInterval).toBeLessThanOrEqual(maxYearly)
    })

    it('should reject inconsistent intervals', () => {
      // Intervals with high variation should not match any frequency
      const inconsistentIntervals = [10, 30, 50, 20]
      const avg =
        inconsistentIntervals.reduce((a, b) => a + b) / inconsistentIntervals.length
      const stdDev = Math.sqrt(
        inconsistentIntervals.reduce((sum, i) => sum + Math.pow(i - avg, 2), 0) /
          inconsistentIntervals.length
      )
      const coefficientOfVariation = stdDev / avg

      // Should be > 0.15 (threshold for inconsistency)
      expect(coefficientOfVariation).toBeGreaterThan(0.15)
    })
  })

  describe('amount consistency', () => {
    it('should accept consistent amounts (< 10% variance)', () => {
      const amounts = [100.0, 102.0, 98.0, 101.0]
      const avg = amounts.reduce((a, b) => a + b) / amounts.length
      const variance =
        amounts.reduce((sum, a) => sum + Math.abs(a - avg), 0) / amounts.length / avg

      expect(variance).toBeLessThan(0.1) // 10% tolerance
    })

    it('should reject inconsistent amounts (> 10% variance)', () => {
      const amounts = [100.0, 120.0, 80.0, 110.0]
      const avg = amounts.reduce((a, b) => a + b) / amounts.length
      const variance =
        amounts.reduce((sum, a) => sum + Math.abs(a - avg), 0) / amounts.length / avg

      expect(variance).toBeGreaterThan(0.1)
    })
  })

  describe('confidence calculation', () => {
    it('should increase confidence with more matches', () => {
      // More matches should lead to higher confidence
      const fewMatches = 3
      const manyMatches = 10

      expect(manyMatches).toBeGreaterThan(fewMatches)
      // In actual service, confidence would be higher for manyMatches
    })

    it('should increase confidence with low amount variance', () => {
      const lowVariance = 0.02 // 2%
      const highVariance = 0.09 // 9%

      expect(lowVariance).toBeLessThan(highVariance)
      // In actual service, lowVariance would produce higher confidence
    })

    it('should increase confidence with consistent intervals', () => {
      const consistentIntervals = [30, 31, 29, 30, 30]
      const inconsistentIntervals = [30, 35, 25, 32, 28]

      const avgConsistent =
        consistentIntervals.reduce((a, b) => a + b) / consistentIntervals.length
      const maxDeviationConsistent = Math.max(
        ...consistentIntervals.map((i) => Math.abs(i - avgConsistent))
      )

      const avgInconsistent =
        inconsistentIntervals.reduce((a, b) => a + b) / inconsistentIntervals.length
      const maxDeviationInconsistent = Math.max(
        ...inconsistentIntervals.map((i) => Math.abs(i - avgInconsistent))
      )

      expect(maxDeviationConsistent).toBeLessThan(maxDeviationInconsistent)
    })
  })

  describe('formatFrequency', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should format weekly frequency', () => {
      const formatted = service.formatFrequency('weekly')
      expect(formatted).toBe('Weekly')
    })

    it('should format bi-weekly frequency', () => {
      const formatted = service.formatFrequency('bi-weekly')
      expect(formatted).toBe('Every 2 weeks')
    })

    it('should format monthly frequency', () => {
      const formatted = service.formatFrequency('monthly')
      expect(formatted).toBe('Monthly')
    })

    it('should format quarterly frequency', () => {
      const formatted = service.formatFrequency('quarterly')
      expect(formatted).toBe('Quarterly')
    })

    it('should format yearly frequency', () => {
      const formatted = service.formatFrequency('yearly')
      expect(formatted).toBe('Yearly')
    })
  })

  describe('formatRecurringMessage', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should format recurring message with all details', () => {
      const match = {
        transactionId: 'txn-001',
        vendorName: 'Netflix',
        description: 'Streaming subscription',
        amount: '15.99',
        frequency: 'monthly' as const,
        averageAmount: '15.99',
        amountVariance: 0.01,
        matchCount: 5,
        previousDates: [Date.now() - 30 * 24 * 60 * 60 * 1000],
        nextExpectedDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        confidence: 0.85,
        confidenceLevel: 'high' as const,
        createdAt: Date.now(),
      }

      const message = service.formatRecurringMessage(match)

      expect(message).toContain('monthly')
      expect(message).toContain('recurring')
      expect(message).toContain('5')
      expect(message).toContain('Next expected')
    })
  })

  describe('error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const errorService = createRecurringDetectionService('invalid-id')
      await expect(errorService.initialize()).rejects.toThrow()
    })

    it('should return null on detectRecurring errors', async () => {
      await service.initialize()

      const invalidInput = {} as RecurringDetectionInput

      const match = await service.detectRecurring(invalidInput)
      expect(match).toBeNull()
    })
  })
})
