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

  describe('Accounting Methods - Cash vs Accrual', () => {
    it('should calculate report using accrual method', async () => {
      const mockTransactions: JournalEntry[] = [
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2024-01-10'),
          status: 'posted',
          lines: [
            { id: 'line-1', accountId: 'acc-revenue-1', debit: 0, credit: 5000 },
            { id: 'line-2', accountId: 'acc-cash', debit: 5000, credit: 0 },
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

      expect(report.accountingMethod).toBe('accrual')
      expect(report.revenue.subtotal).toBe(5000)
    })

    it('should calculate report using cash method', async () => {
      const mockTransactions: JournalEntry[] = [
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2024-01-10'),
          status: 'posted',
          lines: [
            { id: 'line-1', accountId: 'acc-revenue-1', debit: 0, credit: 3000 },
            { id: 'line-2', accountId: 'acc-cash', debit: 3000, credit: 0 },
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
        accountingMethod: 'cash',
      }

      const report = await generateProfitLossReport(options)

      expect(report.accountingMethod).toBe('cash')
      expect(report.revenue.subtotal).toBe(3000)
    })

    it('should default to accrual method when not specified', async () => {
      const mockTransactions: JournalEntry[] = []

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
        // accountingMethod not specified
      }

      const report = await generateProfitLossReport(options)

      expect(report.accountingMethod).toBe('accrual')
    })
  })

  describe('Comparison Periods', () => {
    it('should calculate variance between current and comparison periods', async () => {
      const mockTransactions: JournalEntry[] = [
        // Current period - Jan 2024
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2024-01-15'),
          status: 'posted',
          lines: [
            { id: 'line-1', accountId: 'acc-revenue-1', debit: 0, credit: 10000 },
            { id: 'line-2', accountId: 'acc-cash', debit: 10000, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // Comparison period - Dec 2023
        {
          id: 'txn-2',
          companyId: mockCompanyId,
          date: new Date('2023-12-15'),
          status: 'posted',
          lines: [
            { id: 'line-3', accountId: 'acc-revenue-1', debit: 0, credit: 8000 },
            { id: 'line-4', accountId: 'acc-cash', debit: 8000, credit: 0 },
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
        comparisonPeriod: {
          enabled: true,
          type: 'previous-period',
          startDate: new Date('2023-12-01'),
          endDate: new Date('2023-12-31'),
        },
        accountingMethod: 'accrual',
      }

      const report = await generateProfitLossReport(options)

      expect(report.revenue.subtotal).toBe(10000)
      expect(report.revenue.comparisonSubtotal).toBe(8000)
      // Note: Variance is calculated on line items, not section totals
      expect(report.revenue.lineItems[0].variance).toBe(2000)
      expect(report.revenue.lineItems[0].variancePercentage).toBeCloseTo(25, 1) // 25% increase
    })

    it('should calculate variance percentage correctly', async () => {
      const mockTransactions: JournalEntry[] = [
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2024-01-15'),
          status: 'posted',
          lines: [
            { id: 'line-1', accountId: 'acc-revenue-1', debit: 0, credit: 12000 },
            { id: 'line-2', accountId: 'acc-cash', debit: 12000, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'txn-2',
          companyId: mockCompanyId,
          date: new Date('2023-12-15'),
          status: 'posted',
          lines: [
            { id: 'line-3', accountId: 'acc-revenue-1', debit: 0, credit: 10000 },
            { id: 'line-4', accountId: 'acc-cash', debit: 10000, credit: 0 },
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
        comparisonPeriod: {
          enabled: true,
          type: 'previous-period',
          startDate: new Date('2023-12-01'),
          endDate: new Date('2023-12-31'),
        },
        accountingMethod: 'accrual',
      }

      const report = await generateProfitLossReport(options)

      // 12000 vs 10000 = 20% increase
      expect(report.revenue.lineItems[0].variancePercentage).toBeCloseTo(20, 1)
    })

    it('should handle negative variance (decline)', async () => {
      const mockTransactions: JournalEntry[] = [
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2024-01-15'),
          status: 'posted',
          lines: [
            { id: 'line-1', accountId: 'acc-revenue-1', debit: 0, credit: 6000 },
            { id: 'line-2', accountId: 'acc-cash', debit: 6000, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'txn-2',
          companyId: mockCompanyId,
          date: new Date('2023-12-15'),
          status: 'posted',
          lines: [
            { id: 'line-3', accountId: 'acc-revenue-1', debit: 0, credit: 10000 },
            { id: 'line-4', accountId: 'acc-cash', debit: 10000, credit: 0 },
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
        comparisonPeriod: {
          enabled: true,
          type: 'previous-period',
          startDate: new Date('2023-12-01'),
          endDate: new Date('2023-12-31'),
        },
        accountingMethod: 'accrual',
      }

      const report = await generateProfitLossReport(options)

      expect(report.revenue.lineItems[0].variance).toBe(-4000)
      expect(report.revenue.lineItems[0].variancePercentage).toBeCloseTo(-40, 1) // 40% decline
    })

    it('should calculate gross profit variance', async () => {
      const mockTransactions: JournalEntry[] = [
        // Current period
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2024-01-15'),
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
          date: new Date('2024-01-16'),
          status: 'posted',
          lines: [
            { id: 'line-3', accountId: 'acc-cogs-1', debit: 4000, credit: 0 },
            { id: 'line-4', accountId: 'acc-inventory', debit: 0, credit: 4000 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        // Comparison period
        {
          id: 'txn-3',
          companyId: mockCompanyId,
          date: new Date('2023-12-15'),
          status: 'posted',
          lines: [
            { id: 'line-5', accountId: 'acc-revenue-1', debit: 0, credit: 8000 },
            { id: 'line-6', accountId: 'acc-cash', debit: 8000, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'txn-4',
          companyId: mockCompanyId,
          date: new Date('2023-12-16'),
          status: 'posted',
          lines: [
            { id: 'line-7', accountId: 'acc-cogs-1', debit: 3000, credit: 0 },
            { id: 'line-8', accountId: 'acc-inventory', debit: 0, credit: 3000 },
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
        comparisonPeriod: {
          enabled: true,
          type: 'previous-period',
          startDate: new Date('2023-12-01'),
          endDate: new Date('2023-12-31'),
        },
        accountingMethod: 'accrual',
      }

      const report = await generateProfitLossReport(options)

      // Current: 10000 - 4000 = 6000
      // Comparison: 8000 - 3000 = 5000
      expect(report.grossProfit.amount).toBe(6000)
      expect(report.grossProfit.comparisonAmount).toBe(5000)
      expect(report.grossProfit.variance).toBe(1000)
    })

    it('should not include comparison data when disabled', async () => {
      const mockTransactions: JournalEntry[] = [
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2024-01-15'),
          status: 'posted',
          lines: [
            { id: 'line-1', accountId: 'acc-revenue-1', debit: 0, credit: 5000 },
            { id: 'line-2', accountId: 'acc-cash', debit: 5000, credit: 0 },
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
        // No comparison period
        accountingMethod: 'accrual',
      }

      const report = await generateProfitLossReport(options)

      expect(report.comparisonPeriod).toBeUndefined()
      expect(report.revenue.comparisonSubtotal).toBeUndefined()
      expect(report.revenue.variance).toBeUndefined()
    })
  })

  describe('Educational Content', () => {
    it('should include educational content when enabled', async () => {
      const mockTransactions: JournalEntry[] = []

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
        showEducationalContent: true,
      }

      const report = await generateProfitLossReport(options)

      expect(report.revenue.educationalContent).toBeDefined()
      expect(report.operatingExpenses.educationalContent).toBeDefined()
    })

    it('should exclude educational content when disabled', async () => {
      const mockTransactions: JournalEntry[] = []

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
        showEducationalContent: false,
      }

      const report = await generateProfitLossReport(options)

      expect(report.revenue.educationalContent).toBeUndefined()
      expect(report.operatingExpenses.educationalContent).toBeUndefined()
    })
  })

  describe('Error Handling', () => {
    it('should throw error when accounts query fails', async () => {
      const { queryAccounts } = await import('../../store/accounts')
      const { queryTransactions } = await import('../../store/transactions')

      vi.mocked(queryAccounts).mockResolvedValue({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to fetch accounts',
        },
      })

      vi.mocked(queryTransactions).mockResolvedValue({
        success: true,
        data: [],
      })

      const options: ProfitLossOptions = {
        companyId: mockCompanyId,
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
        accountingMethod: 'accrual',
      }

      await expect(generateProfitLossReport(options)).rejects.toThrow('Failed to fetch accounts')
    })

    it('should throw error when transactions query fails', async () => {
      const { queryAccounts } = await import('../../store/accounts')
      const { queryTransactions } = await import('../../store/transactions')

      vi.mocked(queryAccounts).mockResolvedValue({
        success: true,
        data: mockAccounts,
      })

      vi.mocked(queryTransactions).mockResolvedValue({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to fetch transactions',
        },
      })

      const options: ProfitLossOptions = {
        companyId: mockCompanyId,
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-31'),
        },
        accountingMethod: 'accrual',
      }

      await expect(generateProfitLossReport(options)).rejects.toThrow('Failed to fetch transactions')
    })
  })

  describe('Other Income and Expenses', () => {
    it('should include other income section when present', async () => {
      const otherIncomeAccount: Account = {
        id: 'acc-other-income',
        companyId: mockCompanyId,
        name: 'Interest Income',
        accountNumber: '7000',
        type: 'other-income',
        isActive: true,
        balance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockTransactions: JournalEntry[] = [
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2024-01-15'),
          status: 'posted',
          lines: [
            { id: 'line-1', accountId: 'acc-other-income', debit: 0, credit: 500 },
            { id: 'line-2', accountId: 'acc-cash', debit: 500, credit: 0 },
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
        data: [...mockAccounts, otherIncomeAccount],
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

      expect(report.otherIncome).toBeDefined()
      expect(report.otherIncome?.subtotal).toBe(500)
    })

    it('should include other expenses section when present', async () => {
      const otherExpenseAccount: Account = {
        id: 'acc-other-expense',
        companyId: mockCompanyId,
        name: 'Interest Expense',
        accountNumber: '8000',
        type: 'other-expense',
        isActive: true,
        balance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockTransactions: JournalEntry[] = [
        {
          id: 'txn-1',
          companyId: mockCompanyId,
          date: new Date('2024-01-15'),
          status: 'posted',
          lines: [
            { id: 'line-1', accountId: 'acc-other-expense', debit: 300, credit: 0 },
            { id: 'line-2', accountId: 'acc-cash', debit: 0, credit: 300 },
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
        data: [...mockAccounts, otherExpenseAccount],
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

      expect(report.otherExpenses).toBeDefined()
      expect(report.otherExpenses?.subtotal).toBe(300)
    })

    it('should calculate net income including other income and expenses', async () => {
      const otherIncomeAccount: Account = {
        id: 'acc-other-income',
        companyId: mockCompanyId,
        name: 'Interest Income',
        type: 'other-income',
        isActive: true,
        balance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const otherExpenseAccount: Account = {
        id: 'acc-other-expense',
        companyId: mockCompanyId,
        name: 'Interest Expense',
        type: 'other-expense',
        isActive: true,
        balance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

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
            { id: 'line-3', accountId: 'acc-expense-1', debit: 3000, credit: 0 },
            { id: 'line-4', accountId: 'acc-cash', debit: 0, credit: 3000 },
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
            { id: 'line-5', accountId: 'acc-other-income', debit: 0, credit: 500 },
            { id: 'line-6', accountId: 'acc-cash', debit: 500, credit: 0 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'txn-4',
          companyId: mockCompanyId,
          date: new Date('2024-01-25'),
          status: 'posted',
          lines: [
            { id: 'line-7', accountId: 'acc-other-expense', debit: 200, credit: 0 },
            { id: 'line-8', accountId: 'acc-cash', debit: 0, credit: 200 },
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
        data: [...mockAccounts, otherIncomeAccount, otherExpenseAccount],
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

      // Revenue: 10000, Expenses: 3000, Other Income: 500, Other Expenses: 200
      // Net Income = 10000 - 3000 + 500 - 200 = 7300
      expect(report.netIncome.amount).toBe(7300)
      expect(report.netIncome.isProfitable).toBe(true)
    })
  })
})
