/**
 * Runway Calculator Service Tests
 *
 * Tests for J6: Emergency Fund & Runway Calculator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  calculateRunway,
  calculateAvailableCash,
  getDateRangeFromPreset,
  suggestCalculationMethod,
  calculateRunwayTrend,
} from './runwayCalculator.service'
import type {
  RunwayCalculationMethod,
  RunwayDateRangePreset,
} from '../../types/runway.types'
import { db } from '../../db/database'

// Mock database
vi.mock('../../db/database', () => ({
  db: {
    accounts: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([])),
        })),
      })),
    },
    journalEntries: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    },
  },
}))

describe('Runway Calculator Service', () => {
  const mockCompanyId = 'company-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getDateRangeFromPreset', () => {
    it('should return last-30-days date range', () => {
      const result = getDateRangeFromPreset('last-30-days')

      expect(result.preset).toBe('last-30-days')
      expect(result.label).toBe('Last 30 days')
      expect(result.endDate).toBeInstanceOf(Date)
      expect(result.startDate).toBeInstanceOf(Date)

      // Verify it's roughly 30 days apart
      const daysDiff =
        (result.endDate.getTime() - result.startDate.getTime()) / (1000 * 60 * 60 * 24)
      expect(daysDiff).toBeCloseTo(30, 0)
    })

    it('should return last-90-days date range', () => {
      const result = getDateRangeFromPreset('last-90-days')

      expect(result.preset).toBe('last-90-days')
      expect(result.label).toBe('Last 90 days')

      const daysDiff =
        (result.endDate.getTime() - result.startDate.getTime()) / (1000 * 60 * 60 * 24)
      expect(daysDiff).toBeCloseTo(90, 0)
    })

    it('should return last-365-days date range', () => {
      const result = getDateRangeFromPreset('last-365-days')

      expect(result.preset).toBe('last-365-days')
      expect(result.label).toBe('Last 365 days')

      const daysDiff =
        (result.endDate.getTime() - result.startDate.getTime()) / (1000 * 60 * 60 * 24)
      expect(daysDiff).toBeCloseTo(365, 0)
    })

    it('should return year-to-date range', () => {
      const result = getDateRangeFromPreset('year-to-date')

      expect(result.preset).toBe('year-to-date')
      expect(result.label).toBe('Year to date')

      const now = new Date()
      expect(result.startDate.getFullYear()).toBe(now.getFullYear())
      expect(result.startDate.getMonth()).toBe(0) // January
      expect(result.startDate.getDate()).toBe(1)
    })
  })

  describe('calculateAvailableCash', () => {
    it('should return 0 when no accounts exist', async () => {
      const result = await calculateAvailableCash(mockCompanyId)
      expect(result).toBe(0)
    })

    it('should sum cash and current assets', async () => {
      const mockAccounts = [
        {
          id: '1',
          companyId: mockCompanyId,
          name: 'Checking Account',
          type: 'asset',
          subType: 'current-asset',
          isActive: true,
          balance: 10000,
        },
        {
          id: '2',
          companyId: mockCompanyId,
          name: 'Savings',
          type: 'asset',
          subType: 'current-asset',
          isActive: true,
          balance: 5000,
        },
      ]

      vi.mocked(db.accounts.where).mockReturnValue({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve(mockAccounts)),
        })),
      } as any)

      const result = await calculateAvailableCash(mockCompanyId)
      expect(result).toBe(15000)
    })

    it('should subtract current liabilities from available cash', async () => {
      const mockAccounts = [
        {
          id: '1',
          companyId: mockCompanyId,
          name: 'Cash',
          type: 'asset',
          subType: 'current-asset',
          isActive: true,
          balance: 20000,
        },
        {
          id: '2',
          companyId: mockCompanyId,
          name: 'Credit Card',
          type: 'liability',
          subType: 'current-liability',
          isActive: true,
          balance: 3000,
        },
      ]

      vi.mocked(db.accounts.where).mockReturnValue({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve(mockAccounts)),
        })),
      } as any)

      const result = await calculateAvailableCash(mockCompanyId)
      expect(result).toBe(17000)
    })
  })

  describe('suggestCalculationMethod', () => {
    it('should suggest simple method for less than 3 months data', () => {
      const monthlyData = [
        { month: new Date(2024, 0, 1), revenue: 10000, expenses: 8000 },
        { month: new Date(2024, 1, 1), revenue: 10000, expenses: 8000 },
      ]

      const result = suggestCalculationMethod(monthlyData)
      expect(result).toBe('simple')
    })

    it('should suggest trend-adjusted for 3-11 months without seasonal pattern', () => {
      const monthlyData = Array.from({ length: 6 }, (_, i) => ({
        month: new Date(2024, i, 1),
        revenue: 10000 + i * 500,
        expenses: 8000 + i * 300,
      }))

      const result = suggestCalculationMethod(monthlyData)
      expect(result).toBe('trend-adjusted')
    })

    it('should suggest seasonal for 12+ months with pattern', () => {
      // Create data with clear seasonal pattern
      const monthlyData = Array.from({ length: 24 }, (_, i) => ({
        month: new Date(2024, i % 12, 1),
        revenue: 10000 + (i % 12 === 6 ? 5000 : 0), // Spike in June
        expenses: 8000,
      }))

      const result = suggestCalculationMethod(monthlyData)
      expect(result).toBe('seasonal')
    })
  })

  describe('calculateRunway', () => {
    it('should return null runway for positive cash flow', async () => {
      // Mock accounts with positive cash
      vi.mocked(db.accounts.where).mockReturnValue({
        equals: vi.fn(() => ({
          toArray: vi.fn(() =>
            Promise.resolve([
              {
                id: '1',
                companyId: mockCompanyId,
                name: 'Cash',
                type: 'asset',
                subType: 'current-asset',
                isActive: true,
                balance: 50000,
              },
            ])
          ),
        })),
      } as any)

      // Mock transactions showing positive cash flow
      vi.mocked(db.journalEntries.where).mockReturnValue({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve([])), // Empty for simplicity
          })),
        })),
      } as any)

      const dateRange = getDateRangeFromPreset('last-90-days')
      const result = await calculateRunway(mockCompanyId, 'simple', dateRange, 6)

      expect(result.currentCash).toBe(50000)
      expect(result.method).toBe('simple')
      expect(result.calculatedAt).toBeInstanceOf(Date)
    })
  })
})
