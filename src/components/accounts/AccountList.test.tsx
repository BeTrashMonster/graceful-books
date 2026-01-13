/**
 * Tests for AccountList Component
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { AccountList } from './AccountList'
import type { Account } from '../../types'

expect.extend(toHaveNoViolations)

describe('AccountList Component', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      companyId: 'company-123',
      name: 'Cash',
      accountNumber: '1000',
      type: 'asset',
      isActive: true,
      balance: 10000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'acc-2',
      companyId: 'company-123',
      name: 'Accounts Receivable',
      accountNumber: '1200',
      type: 'asset',
      isActive: true,
      balance: 5000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'acc-3',
      companyId: 'company-123',
      name: 'Inactive Account',
      accountNumber: '9999',
      type: 'expense',
      isActive: false,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  it('should render accounts', () => {
    render(<AccountList accounts={mockAccounts} />)

    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.getByText('Accounts Receivable')).toBeInTheDocument()
  })

  it('should filter by search term', async () => {
    const user = userEvent.setup()
    render(<AccountList accounts={mockAccounts} />)

    const searchInput = screen.getByPlaceholderText(/search accounts/i)
    await user.type(searchInput, 'Cash')

    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.queryByText('Accounts Receivable')).not.toBeInTheDocument()
  })

  it('should filter by type', async () => {
    const user = userEvent.setup()
    render(<AccountList accounts={mockAccounts} />)

    // First set status to 'all' to see inactive accounts too
    const statusFilter = screen.getByLabelText(/filter by status/i)
    await user.selectOptions(statusFilter, 'all')

    const typeFilter = screen.getByLabelText(/filter by type/i)
    await user.selectOptions(typeFilter, 'expense')

    expect(screen.getByText('Inactive Account')).toBeInTheDocument()
    expect(screen.queryByText('Cash')).not.toBeInTheDocument()
  })

  it('should filter by status', async () => {
    const user = userEvent.setup()
    render(<AccountList accounts={mockAccounts} />)

    const statusFilter = screen.getByLabelText(/filter by status/i)
    await user.selectOptions(statusFilter, 'inactive')

    expect(screen.getByText('Inactive Account')).toBeInTheDocument()
    expect(screen.queryByText('Cash')).not.toBeInTheDocument()
  })

  it('should toggle between card and tree views', async () => {
    const user = userEvent.setup()
    render(<AccountList accounts={mockAccounts} treeNodes={[]} />)

    const treeButton = screen.getByRole('button', { name: /tree view/i })
    await user.click(treeButton)

    expect(treeButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('should call onCreate when create button is clicked', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()

    render(<AccountList accounts={mockAccounts} onCreate={onCreate} />)

    const createButton = screen.getByRole('button', { name: /create account/i })
    await user.click(createButton)

    expect(onCreate).toHaveBeenCalled()
  })

  it('should show empty state when no accounts match filters', async () => {
    const user = userEvent.setup()
    render(<AccountList accounts={mockAccounts} />)

    const searchInput = screen.getByPlaceholderText(/search accounts/i)
    await user.type(searchInput, 'nonexistent')

    expect(screen.getByText('No accounts found')).toBeInTheDocument()
  })

  it('should have no accessibility violations', async () => {
    const { container } = render(<AccountList accounts={mockAccounts} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
