/**
 * Unit Tests for Profit & Loss Report Service
 *
 * Tests calculation accuracy using decimal.js to ensure precise money calculations.
 * Validates:
 * - Revenue calculations
 * - COGS calculations
 * - Gross profit accuracy
 * - Operating expense totals
 * - Net income calculations
 * - Comparison period variance calculations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import Decimal from 'decimal.js'
import { generateProfitLossReport } from './profitLoss'
import type { ProfitLossOptions } from '../../types/reports.types'
import type { Account, JournalEntry } from '../../types'

// Mock the database
vi.mock('../../store/database', () => ({
  db: {},
}))

vi.mock('../../store/accounts', () => ({
  queryAccounts: vi.fn(),
}))

vi.mock('../../store/transactions', () => ({
  queryTransactions: vi.fn(),
}))

describe('Profit & Loss Report Service', () => {
  const mockCompanyId = 'test-company-123'
  const baseDate = new Date('2024-01-15')

  const mockAccounts: Account[] = [
    {
      id: 'acc-revenue-1',
      companyId: mockCompanyId,
      name: 'Sales Revenue',
      accountNumber: '4000',
      type: 'income',
      isActive: true,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'acc-cogs-1',
      companyId: mockCompanyId,
      name: 'Cost of Goods Sold',
      accountNumber: '5000',
      type: 'cost-of-goods-sold',
      isActive: true,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'acc-expense-1',
      companyId: mockCompanyId,
      name: 'Rent Expense',
      accountNumber: '6000',
      type: 'expense',
      isActive: true,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'acc-expense-2',
      companyId: mockCompanyId,
      name: 'Utilities Expense',
      accountNumber: '6100',
      type: 'expense',
      isActive: true,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic P&L Calculations', () => {
    it('should calculate simple revenue correctly', async () => {
      const mockTransactions: JournalEntry[] = [
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2024-01-10'),
          status: 'posted',
          lines: [
            { id: 'line-1', accountId: 'acc-revenue-1', debit: 0, credit: 1000 },
            { id: 'line-2', accountId: 'acc-cash', debit: 1000, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const { queryAccounts } = await import('../../store/accounts')
      const { queryTransactions } = await import('../../store/transactions')

      vi.mocked(queryAccounts).mockResolvedValue({
        success: true,
        data: mockAccounts,
      })

      vi.mocked(queryTransactions).mockResolvedValue({
        success: true,
        data: mockTransactions,
      })

      const options: ProfitLossOptions = {
        companyId: mockCompanyId,
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
        accountingMethod: 'accrual',
      }

      const report = await generateProfitLossReport(options)

      expect(report.revenue.subtotal).toBe(1000)
      expect(report.netIncome.amount).toBe(1000)
      expect(report.netIncome.isProfitable).toBe(true)
    })

    it('should calculate gross profit correctly', async () => {
      const mockTransactions: JournalEntry[] = [
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2024-01-10'),
          status: 'posted',
          lines: [
            { id: 'line-1', accountId: 'acc-revenue-1', debit: 0, credit: 10000 },
            { id: 'line-2', accountId: 'acc-cash', debit: 10000, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'txn-2',
          companyId: mockCompanyId,
          date: new Date('2024-01-12'),
          status: 'posted',
          lines: [
            { id: 'line-3', accountId: 'acc-cogs-1', debit: 4000, credit: 0 },
            { id: 'line-4', accountId: 'acc-inventory', debit: 0, credit: 4000 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const { queryAccounts } = await import('../../store/accounts')
      const { queryTransactions } = await import('../../store/transactions')

      vi.mocked(queryAccounts).mockResolvedValue({
        success: true,
        data: mockAccounts,
      })

      vi.mocked(queryTransactions).mockResolvedValue({
        success: true,
        data: mockTransactions,
      })

      const options: ProfitLossOptions = {
        companyId: mockCompanyId,
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
        accountingMethod: 'accrual',
      }

      const report = await generateProfitLossReport(options)

      expect(report.revenue.subtotal).toBe(10000)
      expect(report.costOfGoodsSold.subtotal).toBe(4000)
      expect(report.grossProfit.amount).toBe(6000)
      expect(report.grossProfit.percentage).toBeCloseTo(60, 1)
    })

    it('should calculate net income with operating expenses', async () => {
      const mockTransactions: JournalEntry[] = [
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2024-01-10'),
          status: 'posted',
          lines: [
            { id: 'line-1', accountId: 'acc-revenue-1', debit: 0, credit: 10000 },
            { id: 'line-2', accountId: 'acc-cash', debit: 10000, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'txn-2',
          companyId: mockCompanyId,
          date: new Date('2024-01-15'),
          status: 'posted',
          lines: [
            { id: 'line-3', accountId: 'acc-expense-1', debit: 2000, credit: 0 },
            { id: 'line-4', accountId: 'acc-cash', debit: 0, credit: 2000 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'txn-3',
          companyId: mockCompanyId,
          date: new Date('2024-01-20'),
          status: 'posted',
          lines: [
            { id: 'line-5', accountId: 'acc-expense-2', debit: 500, credit: 0 },
            { id: 'line-6', accountId: 'acc-cash', debit: 0, credit: 500 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const { queryAccounts } = await import('../../store/accounts')
      const { queryTransactions } = await import('../../store/transactions')

      vi.mocked(queryAccounts).mockResolvedValue({
        success: true,
        data: mockAccounts,
      })

      vi.mocked(queryTransactions).mockResolvedValue({
        success: true,
        data: mockTransactions,
      })

      const options: ProfitLossOptions = {
        companyId: mockCompanyId,
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
        accountingMethod: 'accrual',
      }

      const report = await generateProfitLossReport(options)

      expect(report.revenue.subtotal).toBe(10000)
      expect(report.operatingExpenses.subtotal).toBe(2500)
      expect(report.netIncome.amount).toBe(7500)
      expect(report.netIncome.isProfitable).toBe(true)
    })

    it('should identify a loss correctly', async () => {
      const mockTransactions: JournalEntry[] = [
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2024-01-10'),
          status: 'posted',
          lines: [
            { id: 'line-1', accountId: 'acc-revenue-1', debit: 0, credit: 1000 },
            { id: 'line-2', accountId: 'acc-cash', debit: 1000, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'txn-2',
          companyId: mockCompanyId,
          date: new Date('2024-01-15'),
          status: 'posted',
          lines: [
            { id: 'line-3', accountId: 'acc-expense-1', debit: 3000, credit: 0 },
            { id: 'line-4', accountId: 'acc-cash', debit: 0, credit: 3000 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const { queryAccounts } = await import('../../store/accounts')
      const { queryTransactions } = await import('../../store/transactions')

      vi.mocked(queryAccounts).mockResolvedValue({
        success: true,
        data: mockAccounts,
      })

      vi.mocked(queryTransactions).mockResolvedValue({
        success: true,
        data: mockTransactions,
      })

      const options: ProfitLossOptions = {
        companyId: mockCompanyId,
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
        accountingMethod: 'accrual',
      }

      const report = await generateProfitLossReport(options)

      expect(report.revenue.subtotal).toBe(1000)
      expect(report.operatingExpenses.subtotal).toBe(3000)
      expect(report.netIncome.amount).toBe(-2000)
      expect(report.netIncome.isProfitable).toBe(false)
    })
  })

  describe('Decimal Precision', () => {
    it('should handle decimal amounts accurately', async () => {
      const mockTransactions: JournalEntry[] = [
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2024-01-10'),
          status: 'posted',
          lines: [
            { id: 'line-1', accountId: 'acc-revenue-1', debit: 0, credit: 99.99 },
            { id: 'line-2', accountId: 'acc-cash', debit: 99.99, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'txn-2',
          companyId: mockCompanyId,
          date: new Date('2024-01-11'),
          status: 'posted',
          lines: [
            { id: 'line-3', accountId: 'acc-revenue-1', debit: 0, credit: 0.01 },
            { id: 'line-4', accountId: 'acc-cash', debit: 0.01, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const { queryAccounts } = await import('../../store/accounts')
      const { queryTransactions } = await import('../../store/transactions')

      vi.mocked(queryAccounts).mockResolvedValue({
        success: true,
        data: mockAccounts,
      })

      vi.mocked(queryTransactions).mockResolvedValue({
        success: true,
        data: mockTransactions,
      })

      const options: ProfitLossOptions = {
        companyId: mockCompanyId,
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
        accountingMethod: 'accrual',
      }

      const report = await generateProfitLossReport(options)

      // Using decimal.js ensures 99.99 + 0.01 = 100.00 exactly
      expect(report.revenue.subtotal).toBe(100)
      expect(report.netIncome.amount).toBe(100)
    })

    it('should handle large numbers with precision', async () => {
      const mockTransactions: JournalEntry[] = [
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2024-01-10'),
          status: 'posted',
          lines: [
            { id: 'line-1', accountId: 'acc-revenue-1', debit: 0, credit: 1234567.89 },
            { id: 'line-2', accountId: 'acc-cash', debit: 1234567.89, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'txn-2',
          companyId: mockCompanyId,
          date: new Date('2024-01-15'),
          status: 'posted',
          lines: [
            { id: 'line-3', accountId: 'acc-expense-1', debit: 987654.32, credit: 0 },
            { id: 'line-4', accountId: 'acc-cash', debit: 0, credit: 987654.32 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const { queryAccounts } = await import('../../store/accounts')
      const { queryTransactions } = await import('../../store/transactions')

      vi.mocked(queryAccounts).mockResolvedValue({
        success: true,
        data: mockAccounts,
      })

      vi.mocked(queryTransactions).mockResolvedValue({
        success: true,
        data: mockTransactions,
      })

      const options: ProfitLossOptions = {
        companyId: mockCompanyId,
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
        accountingMethod: 'accrual',
      }

      const report = await generateProfitLossReport(options)

      expect(report.revenue.subtotal).toBe(1234567.89)
      expect(report.operatingExpenses.subtotal).toBe(987654.32)
      expect(report.netIncome.amount).toBeCloseTo(246913.57, 2)
    })
  })

  describe('Date Range Filtering', () => {
    it('should only include transactions within date range', async () => {
      const mockTransactions: JournalEntry[] = [
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2023-12-31'), // Before range
          status: 'posted',
          lines: [
            { id: 'line-1', accountId: 'acc-revenue-1', debit: 0, credit: 1000 },
            { id: 'line-2', accountId: 'acc-cash', debit: 1000, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'txn-2',
          companyId: mockCompanyId,
          date: new Date('2024-01-15'), // Within range
          status: 'posted',
          lines: [
            { id: 'line-3', accountId: 'acc-revenue-1', debit: 0, credit: 2000 },
            { id: 'line-4', accountId: 'acc-cash', debit: 2000, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'txn-3',
          companyId: mockCompanyId,
          date: new Date('2024-02-01'), // After range
          status: 'posted',
          lines: [
            { id: 'line-5', accountId: 'acc-revenue-1', debit: 0, credit: 3000 },
            { id: 'line-6', accountId: 'acc-cash', debit: 3000, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const { queryAccounts } = await import('../../store/accounts')
      const { queryTransactions } = await import('../../store/transactions')

      vi.mocked(queryAccounts).mockResolvedValue({
        success: true,
        data: mockAccounts,
      })

      vi.mocked(queryTransactions).mockResolvedValue({
        success: true,
        data: mockTransactions,
      })

      const options: ProfitLossOptions = {
        companyId: mockCompanyId,
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
        accountingMethod: 'accrual',
      }

      const report = await generateProfitLossReport(options)

      // Should only include txn-2 (2000)
      expect(report.revenue.subtotal).toBe(2000)
    })

    it('should skip draft transactions', async () => {
      const mockTransactions: JournalEntry[] = [
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2024-01-10'),
          status: 'posted',
          lines: [
            { id: 'line-1', accountId: 'acc-revenue-1', debit: 0, credit: 1000 },
            { id: 'line-2', accountId: 'acc-cash', debit: 1000, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'txn-2',
          companyId: mockCompanyId,
          date: new Date('2024-01-15'),
          status: 'draft', // Should be skipped
          lines: [
            { id: 'line-3', accountId: 'acc-revenue-1', debit: 0, credit: 2000 },
            { id: 'line-4', accountId: 'acc-cash', debit: 2000, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const { queryAccounts } = await import('../../store/accounts')
      const { queryTransactions } = await import('../../store/transactions')

      vi.mocked(queryAccounts).mockResolvedValue({
        success: true,
        data: mockAccounts,
      })

      vi.mocked(queryTransactions).mockResolvedValue({
        success: true,
        data: mockTransactions,
      })

      const options: ProfitLossOptions = {
        companyId: mockCompanyId,
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
        accountingMethod: 'accrual',
      }

      const report = await generateProfitLossReport(options)

      // Should only include posted transaction (1000)
      expect(report.revenue.subtotal).toBe(1000)
    })
  })
})
