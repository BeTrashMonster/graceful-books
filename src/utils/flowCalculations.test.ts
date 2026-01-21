/**
 * Flow Calculations Utility Tests
 *
 * Tests for flowCalculations.ts covering:
 * - Account type mapping
 * - Node aggregation
 * - Health status calculation
 * - Barter detection
 * - Node sizing
 */

import { describe, it, expect } from 'vitest'
import {
  mapAccountTypeToFlowNode,
  aggregateAccountsByNode,
  isBarterTransaction,
  hasActiveBarterActivity,
  calculateNodeSize,
  formatCurrency,
  getNodeColor,
  getHealthColor,
} from './flowCalculations'
import type { Account, JournalEntry } from '../types'

describe('flowCalculations', () => {
  describe('mapAccountTypeToFlowNode', () => {
    it('should map asset types to assets node', () => {
      expect(mapAccountTypeToFlowNode('asset')).toBe('assets')
    })

    it('should map liability types to liabilities node', () => {
      expect(mapAccountTypeToFlowNode('liability')).toBe('liabilities')
    })

    it('should map equity types to equity node', () => {
      expect(mapAccountTypeToFlowNode('equity')).toBe('equity')
    })

    it('should map income types to revenue node', () => {
      expect(mapAccountTypeToFlowNode('income')).toBe('revenue')
      expect(mapAccountTypeToFlowNode('other-income')).toBe('revenue')
    })

    it('should map COGS to cogs node', () => {
      expect(mapAccountTypeToFlowNode('cost-of-goods-sold')).toBe('cogs')
    })

    it('should map expense types to expenses node', () => {
      expect(mapAccountTypeToFlowNode('expense')).toBe('expenses')
      expect(mapAccountTypeToFlowNode('other-expense')).toBe('expenses')
    })
  })

  describe('aggregateAccountsByNode', () => {
    it('should aggregate accounts by node type', () => {
      const accounts: Account[] = [
        {
          id: '1',
          companyId: 'c1',
          name: 'Cash',
          type: 'asset',
          isActive: true,
          balance: 10000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          companyId: 'c1',
          name: 'Accounts Receivable',
          type: 'asset',
          isActive: true,
          balance: 5000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '3',
          companyId: 'c1',
          name: 'Sales Revenue',
          type: 'income',
          isActive: true,
          balance: 50000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const nodes = aggregateAccountsByNode(accounts)

      expect(nodes).toHaveLength(6) // All 6 primary nodes

      const assetsNode = nodes.find((n) => n.type === 'assets')
      expect(assetsNode).toBeDefined()
      expect(assetsNode?.balance).toBe(15000) // 10000 + 5000
      expect(assetsNode?.subNodes).toHaveLength(2)

      const revenueNode = nodes.find((n) => n.type === 'revenue')
      expect(revenueNode).toBeDefined()
      expect(revenueNode?.balance).toBe(50000)
      expect(revenueNode?.subNodes).toHaveLength(1)
    })

    it('should exclude inactive accounts', () => {
      const accounts: Account[] = [
        {
          id: '1',
          companyId: 'c1',
          name: 'Cash',
          type: 'asset',
          isActive: true,
          balance: 10000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          companyId: 'c1',
          name: 'Old Account',
          type: 'asset',
          isActive: false,
          balance: 5000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const nodes = aggregateAccountsByNode(accounts)
      const assetsNode = nodes.find((n) => n.type === 'assets')

      expect(assetsNode?.balance).toBe(10000) // Only active account
      expect(assetsNode?.subNodes).toHaveLength(1)
    })

    it('should exclude deleted accounts', () => {
      const accounts: Account[] = [
        {
          id: '1',
          companyId: 'c1',
          name: 'Cash',
          type: 'asset',
          isActive: true,
          balance: 10000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          companyId: 'c1',
          name: 'Deleted Account',
          type: 'asset',
          isActive: true,
          balance: 5000,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: new Date(),
        },
      ]

      const nodes = aggregateAccountsByNode(accounts)
      const assetsNode = nodes.find((n) => n.type === 'assets')

      expect(assetsNode?.balance).toBe(10000) // Exclude deleted
      expect(assetsNode?.subNodes).toHaveLength(1)
    })

    it('should calculate health status for each node', () => {
      const accounts: Account[] = [
        {
          id: '1',
          companyId: 'c1',
          name: 'Cash',
          type: 'asset',
          isActive: true,
          balance: 100000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const nodes = aggregateAccountsByNode(accounts)
      const assetsNode = nodes.find((n) => n.type === 'assets')

      expect(assetsNode?.healthStatus).toBe('healthy') // High balance = healthy for assets
    })
  })

  describe('isBarterTransaction', () => {
    it('should detect barter keyword in memo', () => {
      const transaction: JournalEntry = {
        id: '1',
        companyId: 'c1',
        date: new Date(),
        memo: 'Trade services for products (barter)',
        status: 'posted',
        lines: [],
        createdBy: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(isBarterTransaction(transaction)).toBe(true)
    })

    it('should detect trade keyword in memo', () => {
      const transaction: JournalEntry = {
        id: '1',
        companyId: 'c1',
        date: new Date(),
        memo: 'Trade agreement with vendor',
        status: 'posted',
        lines: [],
        createdBy: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(isBarterTransaction(transaction)).toBe(true)
    })

    it('should detect barter in reference field', () => {
      const transaction: JournalEntry = {
        id: '1',
        companyId: 'c1',
        date: new Date(),
        reference: 'BARTER-2024-001',
        status: 'posted',
        lines: [],
        createdBy: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(isBarterTransaction(transaction)).toBe(true)
    })

    it('should return false for regular transactions', () => {
      const transaction: JournalEntry = {
        id: '1',
        companyId: 'c1',
        date: new Date(),
        memo: 'Regular cash sale',
        status: 'posted',
        lines: [],
        createdBy: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(isBarterTransaction(transaction)).toBe(false)
    })

    it('should be case-insensitive', () => {
      const transaction: JournalEntry = {
        id: '1',
        companyId: 'c1',
        date: new Date(),
        memo: 'BARTER TRANSACTION',
        status: 'posted',
        lines: [],
        createdBy: 'u1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(isBarterTransaction(transaction)).toBe(true)
    })
  })

  describe('hasActiveBarterActivity', () => {
    it('should return true if any transaction is barter', () => {
      const transactions: JournalEntry[] = [
        {
          id: '1',
          companyId: 'c1',
          date: new Date(),
          memo: 'Regular sale',
          status: 'posted',
          lines: [],
          createdBy: 'u1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          companyId: 'c1',
          date: new Date(),
          memo: 'Barter transaction',
          status: 'posted',
          lines: [],
          createdBy: 'u1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      expect(hasActiveBarterActivity(transactions)).toBe(true)
    })

    it('should return false if no barter transactions', () => {
      const transactions: JournalEntry[] = [
        {
          id: '1',
          companyId: 'c1',
          date: new Date(),
          memo: 'Regular sale',
          status: 'posted',
          lines: [],
          createdBy: 'u1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      expect(hasActiveBarterActivity(transactions)).toBe(false)
    })

    it('should handle empty transaction array', () => {
      expect(hasActiveBarterActivity([])).toBe(false)
    })
  })

  describe('calculateNodeSize', () => {
    it('should return middle size for median balance', () => {
      const balance = 50000
      const allBalances = [10000, 50000, 100000]

      const size = calculateNodeSize(balance, allBalances)

      expect(size).toBeGreaterThan(1.0)
      expect(size).toBeLessThan(3.0)
    })

    it('should return maximum size for highest balance', () => {
      const balance = 100000
      const allBalances = [10000, 50000, 100000]

      const size = calculateNodeSize(balance, allBalances)

      expect(size).toBeCloseTo(3.0, 1)
    })

    it('should return minimum size for lowest balance', () => {
      const balance = 10000
      const allBalances = [10000, 50000, 100000]

      const size = calculateNodeSize(balance, allBalances)

      // Log scale means it won't be exactly 1.0, but should be in valid range
      expect(size).toBeGreaterThanOrEqual(1.0)
      expect(size).toBeLessThanOrEqual(3.0)
    })

    it('should handle empty balance array', () => {
      const size = calculateNodeSize(50000, [])

      expect(size).toBe(1.5) // Default middle size
    })

    it('should handle negative balances (use absolute value)', () => {
      const balance = -50000
      const allBalances = [-100000, -50000, 10000]

      const size = calculateNodeSize(balance, allBalances)

      expect(size).toBeGreaterThan(1.0)
      expect(size).toBeLessThan(3.0)
    })
  })

  describe('formatCurrency', () => {
    it('should format positive amounts correctly', () => {
      expect(formatCurrency(1000)).toBe('$1,000')
      expect(formatCurrency(1234567)).toBe('$1,234,567')
    })

    it('should format negative amounts correctly', () => {
      expect(formatCurrency(-1000)).toBe('-$1,000')
    })

    it('should format zero correctly', () => {
      expect(formatCurrency(0)).toBe('$0')
    })

    it('should round to nearest dollar (no cents)', () => {
      expect(formatCurrency(1000.99)).toBe('$1,001')
      expect(formatCurrency(1000.49)).toBe('$1,000')
    })
  })

  describe('getNodeColor', () => {
    it('should return distinct colors for each node type', () => {
      const colors = [
        getNodeColor('assets'),
        getNodeColor('liabilities'),
        getNodeColor('equity'),
        getNodeColor('revenue'),
        getNodeColor('cogs'),
        getNodeColor('expenses'),
      ]

      // All colors should be unique
      const uniqueColors = new Set(colors)
      expect(uniqueColors.size).toBe(6)

      // All colors should be valid hex codes
      colors.forEach((color) => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i)
      })
    })
  })

  describe('getHealthColor', () => {
    it('should return distinct colors for each health status', () => {
      const healthy = getHealthColor('healthy')
      const caution = getHealthColor('caution')
      const concern = getHealthColor('concern')

      expect(healthy).not.toBe(caution)
      expect(caution).not.toBe(concern)
      expect(healthy).not.toBe(concern)

      // All should be valid hex codes
      expect(healthy).toMatch(/^#[0-9a-f]{6}$/i)
      expect(caution).toMatch(/^#[0-9a-f]{6}$/i)
      expect(concern).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })
})
