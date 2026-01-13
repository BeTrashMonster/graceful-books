/**
 * Balance Sheet Report Component Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BalanceSheetReport } from './BalanceSheetReport'
import type { BalanceSheetData } from '../../types/reports.types'

describe('BalanceSheetReport', () => {
  const mockBalanceSheetData: BalanceSheetData = {
    companyId: 'test-company',
    asOfDate: new Date('2024-12-31'),
    generatedAt: new Date('2025-01-10'),
    assets: {
      title: 'Assets',
      plainEnglishTitle: 'What You Own',
      description: 'Resources owned by your business.',
      lines: [
        {
          accountId: '1',
          accountName: 'Cash',
          accountNumber: '1000',
          balance: 10000,
          isSubAccount: false,
          level: 0,
        },
        {
          accountId: '2',
          accountName: 'Accounts Receivable',
          accountNumber: '1200',
          balance: 5000,
          isSubAccount: false,
          level: 0,
        },
      ],
      total: 15000,
    },
    liabilities: {
      title: 'Liabilities',
      plainEnglishTitle: 'What You Owe',
      description: 'Obligations your business owes to others.',
      lines: [
        {
          accountId: '3',
          accountName: 'Accounts Payable',
          accountNumber: '2000',
          balance: 3000,
          isSubAccount: false,
          level: 0,
        },
      ],
      total: 3000,
    },
    equity: {
      title: 'Equity',
      plainEnglishTitle: "What's Left Over",
      description: "The owner's stake in the business.",
      lines: [
        {
          accountId: '4',
          accountName: "Owner's Equity",
          accountNumber: '3000',
          balance: 12000,
          isSubAccount: false,
          level: 0,
        },
      ],
      total: 12000,
    },
    totalAssets: 15000,
    totalLiabilitiesAndEquity: 15000,
    isBalanced: true,
    balanceDifference: 0,
  }

  it('should render balance sheet with all sections', () => {
    render(<BalanceSheetReport data={mockBalanceSheetData} />)

    expect(screen.getByText('Balance Sheet')).toBeInTheDocument()
    expect(screen.getByText('Assets')).toBeInTheDocument()
    expect(screen.getByText('Liabilities')).toBeInTheDocument()
    expect(screen.getByText('Equity')).toBeInTheDocument()
  })

  it('should display account lines with balances', () => {
    render(<BalanceSheetReport data={mockBalanceSheetData} />)

    expect(screen.getByText(/Cash/)).toBeInTheDocument()
    expect(screen.getByText(/\$100\.00/)).toBeInTheDocument() // $10,000 in cents
    expect(screen.getByText(/Accounts Receivable/)).toBeInTheDocument()
  })

  it('should display section totals', () => {
    render(<BalanceSheetReport data={mockBalanceSheetData} />)

    expect(screen.getByText('Total Assets')).toBeInTheDocument()
    expect(screen.getByText('Total Liabilities')).toBeInTheDocument()
    expect(screen.getByText('Total Equity')).toBeInTheDocument()
  })

  it('should display grand total', () => {
    render(<BalanceSheetReport data={mockBalanceSheetData} />)

    expect(screen.getByText('Total Liabilities and Equity')).toBeInTheDocument()
  })

  it('should show balanced indicator when balanced', () => {
    render(<BalanceSheetReport data={mockBalanceSheetData} />)

    expect(screen.getByText(/Balance Sheet is balanced/)).toBeInTheDocument()
  })

  it('should show unbalanced indicator when not balanced', () => {
    const unbalancedData: BalanceSheetData = {
      ...mockBalanceSheetData,
      isBalanced: false,
      balanceDifference: 100,
    }

    render(<BalanceSheetReport data={unbalancedData} />)

    expect(screen.getByText(/Difference:/)).toBeInTheDocument()
  })

  it('should toggle explanations when button clicked', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()

    render(
      <BalanceSheetReport
        data={mockBalanceSheetData}
        showExplanations={false}
        onToggleExplanations={onToggle}
      />
    )

    const toggleButton = screen.getByRole('button', { name: /What does this mean/i })
    await user.click(toggleButton)

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('should show plain English titles when explanations are enabled', () => {
    render(<BalanceSheetReport data={mockBalanceSheetData} showExplanations={true} />)

    expect(screen.getByText('What You Own')).toBeInTheDocument()
    expect(screen.getByText('What You Owe')).toBeInTheDocument()
    expect(screen.getByText("What's Left Over")).toBeInTheDocument()
  })

  it('should show section descriptions when explanations are enabled', () => {
    render(<BalanceSheetReport data={mockBalanceSheetData} showExplanations={true} />)

    expect(screen.getByText(/Resources owned by your business/)).toBeInTheDocument()
    expect(screen.getByText(/Obligations your business owes/)).toBeInTheDocument()
    expect(screen.getByText(/owner's stake/)).toBeInTheDocument()
  })

  it('should show balance equation explanation when explanations are enabled', () => {
    render(<BalanceSheetReport data={mockBalanceSheetData} showExplanations={true} />)

    expect(screen.getByText('The Balance Sheet Equation')).toBeInTheDocument()
    expect(screen.getByText(/fundamental equation/)).toBeInTheDocument()
  })

  it('should render empty state when no lines exist', () => {
    const emptyData: BalanceSheetData = {
      ...mockBalanceSheetData,
      assets: {
        ...mockBalanceSheetData.assets,
        lines: [],
        total: 0,
      },
    }

    render(<BalanceSheetReport data={emptyData} />)

    expect(screen.getByText('No accounts in this section')).toBeInTheDocument()
  })

  it('should indent sub-accounts', () => {
    const dataWithSubAccounts: BalanceSheetData = {
      ...mockBalanceSheetData,
      assets: {
        ...mockBalanceSheetData.assets,
        lines: [
          {
            accountId: '1',
            accountName: 'Bank Accounts',
            balance: 15000,
            isSubAccount: false,
            level: 0,
          },
          {
            accountId: '2',
            accountName: 'Checking',
            balance: 10000,
            isSubAccount: true,
            parentAccountId: '1',
            level: 1,
          },
          {
            accountId: '3',
            accountName: 'Savings',
            balance: 5000,
            isSubAccount: true,
            parentAccountId: '1',
            level: 1,
          },
        ],
      },
    }

    const { container } = render(<BalanceSheetReport data={dataWithSubAccounts} />)

    const subAccountLines = container.querySelectorAll('.sub-account')
    expect(subAccountLines.length).toBe(2)

    const level1Lines = container.querySelectorAll('.level-1')
    expect(level1Lines.length).toBe(2)
  })

  it('should display account numbers when present', () => {
    render(<BalanceSheetReport data={mockBalanceSheetData} />)

    expect(screen.getByText(/1000 -/)).toBeInTheDocument()
    expect(screen.getByText(/1200 -/)).toBeInTheDocument()
  })

  it('should format currency correctly', () => {
    render(<BalanceSheetReport data={mockBalanceSheetData} />)

    // Check for dollar sign and decimal formatting
    const amounts = screen.getAllByText(/\$\d+\.\d{2}/)
    expect(amounts.length).toBeGreaterThan(0)
  })

  it('should show as-of date in header', () => {
    render(<BalanceSheetReport data={mockBalanceSheetData} />)

    expect(screen.getByText(/December 31, 2024/)).toBeInTheDocument()
  })
})
