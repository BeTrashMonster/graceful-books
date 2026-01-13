/**
 * Component Tests for Profit & Loss Report Page
 *
 * Tests UI rendering and user interactions for P&L reports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import ProfitLoss from './ProfitLoss'
import type { ProfitLossReport } from '../../types/reports.types'

// Mock the services
vi.mock('../../services/reports/profitLoss', () => ({
  generateProfitLossReport: vi.fn(),
}))

vi.mock('../../services/reports/pdfExport', () => ({
  exportProfitLossPDF: vi.fn(),
}))

const mockReport: ProfitLossReport = {
  companyId: 'test-company',
  companyName: 'Test Company LLC',
  dateRange: {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    label: 'January 2024',
  },
  accountingMethod: 'accrual',
  generatedAt: new Date('2024-02-01'),
  revenue: {
    type: 'revenue',
    title: 'Revenue',
    description: 'All money you earn from selling products or services',
    educationalContent: 'What does this mean? Revenue is all the money coming into your business from sales.',
    lineItems: [
      {
        accountId: 'acc-1',
        accountNumber: '4000',
        accountName: 'Sales Revenue',
        amount: 10000,
      },
    ],
    subtotal: 10000,
  },
  costOfGoodsSold: {
    type: 'cogs',
    title: 'Cost of Goods Sold',
    description: 'Direct costs to create the products or services you sold',
    lineItems: [],
    subtotal: 0,
  },
  grossProfit: {
    amount: 10000,
    percentage: 100,
  },
  operatingExpenses: {
    type: 'expenses',
    title: 'Operating Expenses',
    description: 'Costs to run your business day-to-day',
    lineItems: [
      {
        accountId: 'acc-2',
        accountNumber: '6000',
        accountName: 'Rent Expense',
        amount: 2000,
      },
    ],
    subtotal: 2000,
  },
  operatingIncome: {
    amount: 8000,
    percentage: 80,
  },
  netIncome: {
    amount: 8000,
    percentage: 80,
    isProfitable: true,
  },
}

function renderWithRouter(component: React.ReactElement) {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('Profit & Loss Report Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render page header', async () => {
      const { generateProfitLossReport } = await import('../../services/reports/profitLoss')
      vi.mocked(generateProfitLossReport).mockResolvedValue(mockReport)

      renderWithRouter(<ProfitLoss />)

      expect(screen.getByText('Profit & Loss')).toBeInTheDocument()
      expect(screen.getByText(/View your revenue, expenses, and profitability over time/i)).toBeInTheDocument()
    })

    it('should render date range selector', async () => {
      const { generateProfitLossReport } = await import('../../services/reports/profitLoss')
      vi.mocked(generateProfitLossReport).mockResolvedValue(mockReport)

      renderWithRouter(<ProfitLoss />)

      expect(screen.getByLabelText(/Date Range/i)).toBeInTheDocument()
    })

    it('should render comparison selector', async () => {
      const { generateProfitLossReport } = await import('../../services/reports/profitLoss')
      vi.mocked(generateProfitLossReport).mockResolvedValue(mockReport)

      renderWithRouter(<ProfitLoss />)

      expect(screen.getByLabelText(/Comparison/i)).toBeInTheDocument()
    })

    it('should render educational content toggle', async () => {
      const { generateProfitLossReport } = await import('../../services/reports/profitLoss')
      vi.mocked(generateProfitLossReport).mockResolvedValue(mockReport)

      renderWithRouter(<ProfitLoss />)

      expect(screen.getByText(/Show "What does this mean\?" explanations/i)).toBeInTheDocument()
    })

    it('should render export button', async () => {
      const { generateProfitLossReport } = await import('../../services/reports/profitLoss')
      vi.mocked(generateProfitLossReport).mockResolvedValue(mockReport)

      renderWithRouter(<ProfitLoss />)

      expect(screen.getByRole('button', { name: /Export to PDF/i })).toBeInTheDocument()
    })
  })

  describe('Report Display', () => {
    it('should display loading state', async () => {
      const { generateProfitLossReport } = await import('../../services/reports/profitLoss')
      vi.mocked(generateProfitLossReport).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      renderWithRouter(<ProfitLoss />)

      expect(screen.getByText(/Generating your report.../i)).toBeInTheDocument()
    })

    it('should display profitable result with positive styling', async () => {
      const { generateProfitLossReport } = await import('../../services/reports/profitLoss')
      vi.mocked(generateProfitLossReport).mockResolvedValue(mockReport)

      renderWithRouter(<ProfitLoss />)

      await waitFor(() => {
        expect(screen.getByText('Test Company LLC')).toBeInTheDocument()
      })

      expect(screen.getByText(/You made money this period! Great work./i)).toBeInTheDocument()
    })

    it('should display loss with supportive messaging', async () => {
      const lossReport: ProfitLossReport = {
        ...mockReport,
        netIncome: {
          amount: -2000,
          percentage: -20,
          isProfitable: false,
        },
      }

      const { generateProfitLossReport } = await import('../../services/reports/profitLoss')
      vi.mocked(generateProfitLossReport).mockResolvedValue(lossReport)

      renderWithRouter(<ProfitLoss />)

      await waitFor(() => {
        expect(screen.getByText(/This period showed a loss/i)).toBeInTheDocument()
      })
    })

    it('should display revenue section', async () => {
      const { generateProfitLossReport } = await import('../../services/reports/profitLoss')
      vi.mocked(generateProfitLossReport).mockResolvedValue(mockReport)

      renderWithRouter(<ProfitLoss />)

      await waitFor(() => {
        expect(screen.getByText('Revenue')).toBeInTheDocument()
        expect(screen.getByText('4000 - Sales Revenue')).toBeInTheDocument()
      })
    })

    it('should display net income prominently', async () => {
      const { generateProfitLossReport } = await import('../../services/reports/profitLoss')
      vi.mocked(generateProfitLossReport).mockResolvedValue(mockReport)

      renderWithRouter(<ProfitLoss />)

      await waitFor(() => {
        expect(screen.getByText('Net Income')).toBeInTheDocument()
      })
    })
  })

  describe('Educational Content', () => {
    it('should not show educational content by default', async () => {
      const { generateProfitLossReport } = await import('../../services/reports/profitLoss')
      vi.mocked(generateProfitLossReport).mockResolvedValue(mockReport)

      renderWithRouter(<ProfitLoss />)

      await waitFor(() => {
        expect(screen.getByText('Test Company LLC')).toBeInTheDocument()
      })

      expect(screen.queryByText(/Revenue is all the money coming into your business/i)).not.toBeInTheDocument()
    })

    it('should show educational content when toggled', async () => {
      const { generateProfitLossReport } = await import('../../services/reports/profitLoss')
      vi.mocked(generateProfitLossReport).mockResolvedValue(mockReport)

      const user = userEvent.setup()
      renderWithRouter(<ProfitLoss />)

      await waitFor(() => {
        expect(screen.getByText('Test Company LLC')).toBeInTheDocument()
      })

      const checkbox = screen.getByRole('checkbox', {
        name: /Show "What does this mean\?" explanations/i,
      })
      await user.click(checkbox)

      await waitFor(() => {
        expect(screen.getByText(/Revenue is all the money coming into your business/i)).toBeInTheDocument()
      })
    })
  })

  describe('PDF Export', () => {
    it('should call export function when export button clicked', async () => {
      const { generateProfitLossReport } = await import('../../services/reports/profitLoss')
      const { exportProfitLossPDF } = await import('../../services/reports/pdfExport')

      vi.mocked(generateProfitLossReport).mockResolvedValue(mockReport)
      vi.mocked(exportProfitLossPDF).mockResolvedValue()

      const user = userEvent.setup()
      renderWithRouter(<ProfitLoss />)

      await waitFor(() => {
        expect(screen.getByText('Test Company LLC')).toBeInTheDocument()
      })

      const exportButton = screen.getByRole('button', { name: /Export to PDF/i })
      await user.click(exportButton)

      await waitFor(() => {
        expect(exportProfitLossPDF).toHaveBeenCalledWith(
          mockReport,
          expect.objectContaining({
            includeEducationalContent: false,
            includeComparison: false,
          })
        )
      })
    })

    it('should disable export button while exporting', async () => {
      const { generateProfitLossReport } = await import('../../services/reports/profitLoss')
      const { exportProfitLossPDF } = await import('../../services/reports/pdfExport')

      vi.mocked(generateProfitLossReport).mockResolvedValue(mockReport)
      vi.mocked(exportProfitLossPDF).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      )

      const user = userEvent.setup()
      renderWithRouter(<ProfitLoss />)

      await waitFor(() => {
        expect(screen.getByText('Test Company LLC')).toBeInTheDocument()
      })

      const exportButton = screen.getByRole('button', { name: /Export to PDF/i })
      await user.click(exportButton)

      // Button should show "Exporting..." and be disabled
      expect(screen.getByRole('button', { name: /Exporting.../i })).toBeDisabled()
    })
  })

  describe('Date Range Selection', () => {
    it('should regenerate report when date range changes', async () => {
      const { generateProfitLossReport } = await import('../../services/reports/profitLoss')
      vi.mocked(generateProfitLossReport).mockResolvedValue(mockReport)

      const user = userEvent.setup()
      renderWithRouter(<ProfitLoss />)

      await waitFor(() => {
        expect(screen.getByText('Test Company LLC')).toBeInTheDocument()
      })

      const select = screen.getByLabelText(/Date Range/i)
      await user.selectOptions(select, 'last-month')

      await waitFor(() => {
        // Should be called twice: once on mount, once on change
        expect(generateProfitLossReport).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error message when report generation fails', async () => {
      const { generateProfitLossReport } = await import('../../services/reports/profitLoss')
      vi.mocked(generateProfitLossReport).mockRejectedValue(
        new Error('Failed to fetch transactions')
      )

      renderWithRouter(<ProfitLoss />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch transactions/i)).toBeInTheDocument()
      })
    })
  })
})
