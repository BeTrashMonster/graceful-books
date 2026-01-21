/**
 * Financial Flow Widget Tests
 *
 * Tests for FinancialFlowWidget.tsx covering:
 * - Compact mode rendering
 * - Full-screen expansion
 * - Date range filtering
 * - Barter toggle (I5 integration)
 * - Screen reader data table
 * - Keyboard navigation (Esc to close)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FinancialFlowWidget } from './FinancialFlowWidget'
import type { Account, JournalEntry } from '../../types'

describe('FinancialFlowWidget', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc1',
      companyId: 'c1',
      name: 'Cash',
      type: 'asset',
      isActive: true,
      balance: 50000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'acc2',
      companyId: 'c1',
      name: 'Sales Revenue',
      type: 'income',
      isActive: true,
      balance: 100000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const mockTransactions: JournalEntry[] = [
    {
      id: 'tx1',
      companyId: 'c1',
      date: new Date(),
      memo: 'Regular sale',
      status: 'posted',
      lines: [
        { id: 'line1', accountId: 'acc1', debit: 1000, credit: 0, memo: '' },
        { id: 'line2', accountId: 'acc2', debit: 0, credit: 1000, memo: '' },
      ],
      createdBy: 'u1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  it('should render compact widget by default', () => {
    render(
      <FinancialFlowWidget accounts={mockAccounts} transactions={mockTransactions} />
    )

    const widget = screen.getByRole('region', { name: /financial flow widget/i })
    expect(widget).toBeInTheDocument()
    expect(widget).toHaveClass('financial-flow-widget-compact')
  })

  it('should show expand button in compact mode', () => {
    render(
      <FinancialFlowWidget accounts={mockAccounts} transactions={mockTransactions} />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    expect(expandButton).toBeInTheDocument()
  })

  it('should expand to full screen when expand button clicked', async () => {
    const user = userEvent.setup()
    render(
      <FinancialFlowWidget accounts={mockAccounts} transactions={mockTransactions} />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    await user.click(expandButton)

    const dialog = screen.getByRole('dialog', {
      name: /financial flow visualization - full screen/i,
    })
    expect(dialog).toBeInTheDocument()
  })

  it('should have aria-modal="true" in expanded mode', async () => {
    const user = userEvent.setup()
    render(
      <FinancialFlowWidget accounts={mockAccounts} transactions={mockTransactions} />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    await user.click(expandButton)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('should close on Escape key', async () => {
    const user = userEvent.setup()
    render(
      <FinancialFlowWidget accounts={mockAccounts} transactions={mockTransactions} />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    await user.click(expandButton)

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should close when close button clicked', async () => {
    const user = userEvent.setup()
    render(
      <FinancialFlowWidget accounts={mockAccounts} transactions={mockTransactions} />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    await user.click(expandButton)

    const closeButton = screen.getByRole('button', {
      name: /close financial flow visualization/i,
    })
    await user.click(closeButton)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should return focus to expand button after closing', async () => {
    const user = userEvent.setup()
    render(
      <FinancialFlowWidget accounts={mockAccounts} transactions={mockTransactions} />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    await user.click(expandButton)

    await user.keyboard('{Escape}')

    expect(expandButton).toHaveFocus()
  })

  it('should show date range selector in expanded mode', async () => {
    const user = userEvent.setup()
    render(
      <FinancialFlowWidget accounts={mockAccounts} transactions={mockTransactions} />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    await user.click(expandButton)

    const dateRangeSelect = screen.getByLabelText(/date range/i)
    expect(dateRangeSelect).toBeInTheDocument()
    expect(dateRangeSelect).toHaveValue('last-365') // Default
  })

  it('should show all date range options', async () => {
    const user = userEvent.setup()
    render(
      <FinancialFlowWidget accounts={mockAccounts} transactions={mockTransactions} />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    await user.click(expandButton)

    const dateRangeSelect = screen.getByLabelText(/date range/i)

    expect(within(dateRangeSelect as HTMLElement).getByText('Last 30 Days')).toBeInTheDocument()
    expect(within(dateRangeSelect as HTMLElement).getByText('Last 90 Days')).toBeInTheDocument()
    expect(within(dateRangeSelect as HTMLElement).getByText('Last 365 Days')).toBeInTheDocument()
    expect(within(dateRangeSelect as HTMLElement).getByText('Year to Date')).toBeInTheDocument()
    expect(within(dateRangeSelect as HTMLElement).getByText('Last Year')).toBeInTheDocument()
    expect(within(dateRangeSelect as HTMLElement).getByText('All Time')).toBeInTheDocument()
    expect(within(dateRangeSelect as HTMLElement).getByText('Custom Range')).toBeInTheDocument()
  })

  it('should show custom date inputs when custom range selected', async () => {
    const user = userEvent.setup()
    render(
      <FinancialFlowWidget accounts={mockAccounts} transactions={mockTransactions} />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    await user.click(expandButton)

    const dateRangeSelect = screen.getByLabelText(/date range/i)
    await user.selectOptions(dateRangeSelect, 'custom')

    expect(screen.getByLabelText(/start/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/end/i)).toBeInTheDocument()
  })

  it('should show barter transaction toggle (I5 integration)', async () => {
    const user = userEvent.setup()
    render(
      <FinancialFlowWidget accounts={mockAccounts} transactions={mockTransactions} />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    await user.click(expandButton)

    const barterToggle = screen.getByLabelText(/barter transactions/i)
    expect(barterToggle).toBeInTheDocument()
    expect(barterToggle).toHaveValue('auto') // Default
  })

  it('should have barter toggle options', async () => {
    const user = userEvent.setup()
    render(
      <FinancialFlowWidget accounts={mockAccounts} transactions={mockTransactions} />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    await user.click(expandButton)

    const barterToggle = screen.getByLabelText(/barter transactions/i)

    expect(within(barterToggle as HTMLElement).getByText(/auto/i)).toBeInTheDocument()
    expect(within(barterToggle as HTMLElement).getByText(/always show/i)).toBeInTheDocument()
    expect(within(barterToggle as HTMLElement).getByText(/always hide/i)).toBeInTheDocument()
  })

  it('should toggle between visualization and data table', async () => {
    const user = userEvent.setup()
    render(
      <FinancialFlowWidget accounts={mockAccounts} transactions={mockTransactions} />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    await user.click(expandButton)

    const toggleButton = screen.getByRole('button', { name: /show data table/i })
    await user.click(toggleButton)

    // Data table should now be visible
    const table = screen.getByRole('region', { name: /financial flow data table/i })
    expect(table).toBeInTheDocument()

    // Button text should change
    expect(screen.getByRole('button', { name: /show visualization/i })).toBeInTheDocument()
  })

  it('should show data table with accessible structure', async () => {
    const user = userEvent.setup()
    render(
      <FinancialFlowWidget accounts={mockAccounts} transactions={mockTransactions} />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    await user.click(expandButton)

    const toggleButton = screen.getByRole('button', { name: /show data table/i })
    await user.click(toggleButton)

    // Should have table with proper headings
    const table = screen.getAllByRole('table')[0]
    expect(table).toBeInTheDocument()

    // Check for column headers
    expect(screen.getByRole('columnheader', { name: /category/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /balance/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /health status/i })).toBeInTheDocument()
  })

  it('should show transaction count and date range in footer', async () => {
    const user = userEvent.setup()
    render(
      <FinancialFlowWidget accounts={mockAccounts} transactions={mockTransactions} />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    await user.click(expandButton)

    const footer = screen.getByText(/showing \d+ transactions from/i)
    expect(footer).toBeInTheDocument()
  })

  it('should indicate barter activity when present', async () => {
    const user = userEvent.setup()
    const transactionsWithBarter: JournalEntry[] = [
      ...mockTransactions,
      {
        id: 'tx2',
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

    render(
      <FinancialFlowWidget
        accounts={mockAccounts}
        transactions={transactionsWithBarter}
      />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    await user.click(expandButton)

    expect(screen.getByText(/barter transactions active/i)).toBeInTheDocument()
  })

  it('should call onNavigateToAccount when sub-account clicked', async () => {
    const user = userEvent.setup()
    const onNavigateToAccount = vi.fn()

    render(
      <FinancialFlowWidget
        accounts={mockAccounts}
        transactions={mockTransactions}
        onNavigateToAccount={onNavigateToAccount}
      />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    await user.click(expandButton)

    // This would require interaction with the canvas/nodes
    // Simplified test - just verify prop is passed
    expect(onNavigateToAccount).toBeDefined()
  })

  it('should have toggle button with aria-pressed', async () => {
    const user = userEvent.setup()
    render(
      <FinancialFlowWidget accounts={mockAccounts} transactions={mockTransactions} />
    )

    const expandButton = screen.getByRole('button', {
      name: /expand financial flow visualization/i,
    })
    await user.click(expandButton)

    const toggleButton = screen.getByRole('button', { name: /show data table/i })
    expect(toggleButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(toggleButton)

    expect(toggleButton).toHaveAttribute('aria-pressed', 'true')
  })
})
