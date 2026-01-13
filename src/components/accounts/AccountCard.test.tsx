/**
 * Tests for AccountCard Component
 *
 * Tests rendering, interactions, and accessibility
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { AccountCard } from './AccountCard'
import type { Account } from '../../types'

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations)

describe('AccountCard Component', () => {
  const mockAccount: Account = {
    id: 'acc-1',
    companyId: 'company-123',
    name: 'Cash',
    accountNumber: '1000',
    type: 'asset',
    isActive: true,
    balance: 10000,
    description: 'Primary cash account',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }

  describe('rendering', () => {
    it('should render account name', () => {
      render(<AccountCard account={mockAccount} />)

      expect(screen.getByText('Cash')).toBeInTheDocument()
    })

    it('should render account number', () => {
      render(<AccountCard account={mockAccount} />)

      expect(screen.getByText('1000')).toBeInTheDocument()
    })

    it('should render formatted balance', () => {
      render(<AccountCard account={mockAccount} />)

      expect(screen.getByText('$10,000.00')).toBeInTheDocument()
    })

    it('should render account type badge', () => {
      render(<AccountCard account={mockAccount} />)

      expect(screen.getByText('Asset')).toBeInTheDocument()
    })

    it('should render description in default variant', () => {
      render(<AccountCard account={mockAccount} />)

      expect(screen.getByText('Primary cash account')).toBeInTheDocument()
    })

    it('should hide description in compact variant', () => {
      render(<AccountCard account={mockAccount} variant="compact" />)

      expect(screen.queryByText('Primary cash account')).not.toBeInTheDocument()
    })

    it('should render inactive badge when account is inactive', () => {
      const inactiveAccount = { ...mockAccount, isActive: false }
      render(<AccountCard account={inactiveAccount} />)

      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })

    it('should not render inactive badge when account is active', () => {
      render(<AccountCard account={mockAccount} />)

      expect(screen.queryByText('Inactive')).not.toBeInTheDocument()
    })

    it('should render parent account name when provided', () => {
      render(
        <AccountCard account={mockAccount} parentAccountName="Bank Accounts" />
      )

      expect(screen.getByText(/Sub-account of: Bank Accounts/)).toBeInTheDocument()
    })

    it('should render sub-type when provided', () => {
      const accountWithSubType = {
        ...mockAccount,
        subType: 'current-asset' as const,
      }
      render(<AccountCard account={accountWithSubType} />)

      expect(screen.getByText('current-asset')).toBeInTheDocument()
    })
  })

  describe('actions', () => {
    it('should render action buttons when showActions is true', () => {
      render(<AccountCard account={mockAccount} showActions />)

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
    })

    it('should not render action buttons when showActions is false', () => {
      render(<AccountCard account={mockAccount} showActions={false} />)

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    })

    it('should call onEdit when edit button is clicked', async () => {
      const user = userEvent.setup()
      const onEdit = vi.fn()

      render(<AccountCard account={mockAccount} showActions onEdit={onEdit} />)

      const editButton = screen.getByRole('button', { name: /edit cash/i })
      await user.click(editButton)

      expect(onEdit).toHaveBeenCalledWith(mockAccount)
      expect(onEdit).toHaveBeenCalledTimes(1)
    })

    it('should call onDelete when delete button is clicked', async () => {
      const user = userEvent.setup()
      const onDelete = vi.fn()

      render(<AccountCard account={mockAccount} showActions onDelete={onDelete} />)

      const deleteButton = screen.getByRole('button', { name: /delete cash/i })
      await user.click(deleteButton)

      expect(onDelete).toHaveBeenCalledWith(mockAccount)
      expect(onDelete).toHaveBeenCalledTimes(1)
    })

    it('should call onClick when card is clicked', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(<AccountCard account={mockAccount} onClick={onClick} />)

      const card = screen.getByRole('button', { name: /account: cash/i })
      await user.click(card)

      expect(onClick).toHaveBeenCalledWith(mockAccount)
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('should not call onClick when edit button is clicked', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      const onEdit = vi.fn()

      render(
        <AccountCard
          account={mockAccount}
          showActions
          onClick={onClick}
          onEdit={onEdit}
        />
      )

      const editButton = screen.getByRole('button', { name: /edit cash/i })
      await user.click(editButton)

      expect(onEdit).toHaveBeenCalled()
      expect(onClick).not.toHaveBeenCalled()
    })

    it('should support keyboard activation with Enter', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(<AccountCard account={mockAccount} onClick={onClick} />)

      const card = screen.getByRole('button', { name: /account: cash/i })
      card.focus()
      await user.keyboard('{Enter}')

      expect(onClick).toHaveBeenCalled()
    })

    it('should support keyboard activation with Space', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(<AccountCard account={mockAccount} onClick={onClick} />)

      const card = screen.getByRole('button', { name: /account: cash/i })
      card.focus()
      await user.keyboard(' ')

      expect(onClick).toHaveBeenCalled()
    })
  })

  describe('account types', () => {
    const accountTypes: Array<{ type: Account['type']; label: string }> = [
      { type: 'asset', label: 'Asset' },
      { type: 'liability', label: 'Liability' },
      { type: 'equity', label: 'Equity' },
      { type: 'income', label: 'Income' },
      { type: 'expense', label: 'Expense' },
      { type: 'cost-of-goods-sold', label: 'COGS' },
      { type: 'other-income', label: 'Other Income' },
      { type: 'other-expense', label: 'Other Expense' },
    ]

    accountTypes.forEach(({ type, label }) => {
      it(`should render ${type} type correctly`, () => {
        const account = { ...mockAccount, type }
        render(<AccountCard account={account} />)

        expect(screen.getByText(label)).toBeInTheDocument()
      })
    })
  })

  describe('balance formatting', () => {
    it('should format positive balance', () => {
      render(<AccountCard account={mockAccount} />)

      expect(screen.getByText('$10,000.00')).toBeInTheDocument()
    })

    it('should format negative balance', () => {
      const account = { ...mockAccount, balance: -5000 }
      render(<AccountCard account={account} />)

      expect(screen.getByText('-$5,000.00')).toBeInTheDocument()
    })

    it('should format zero balance', () => {
      const account = { ...mockAccount, balance: 0 }
      render(<AccountCard account={account} />)

      expect(screen.getByText('$0.00')).toBeInTheDocument()
    })

    it('should format decimal balance', () => {
      const account = { ...mockAccount, balance: 1234.56 }
      render(<AccountCard account={account} />)

      expect(screen.getByText('$1,234.56')).toBeInTheDocument()
    })
  })

  describe('custom styling', () => {
    it('should accept custom className', () => {
      const { container } = render(
        <AccountCard account={mockAccount} className="custom-class" />
      )

      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('custom-class')
    })

    it('should apply clickable styles when onClick is provided', () => {
      const { container } = render(
        <AccountCard account={mockAccount} onClick={vi.fn()} />
      )

      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('clickable')
    })

    it('should apply inactive styles when account is inactive', () => {
      const inactiveAccount = { ...mockAccount, isActive: false }
      const { container } = render(<AccountCard account={inactiveAccount} />)

      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('inactive')
    })
  })

  describe('accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<AccountCard account={mockAccount} />)

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations with actions', async () => {
      const { container } = render(
        <AccountCard
          account={mockAccount}
          showActions
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations when clickable', async () => {
      const { container } = render(
        <AccountCard account={mockAccount} onClick={vi.fn()} />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have role="button" when clickable', () => {
      const { container } = render(
        <AccountCard account={mockAccount} onClick={vi.fn()} />
      )

      const card = container.firstChild as HTMLElement
      expect(card).toHaveAttribute('role', 'button')
    })

    it('should not have role="button" when not clickable', () => {
      const { container } = render(<AccountCard account={mockAccount} />)

      const card = container.firstChild as HTMLElement
      expect(card).not.toHaveAttribute('role', 'button')
    })

    it('should be keyboard focusable when clickable', () => {
      const { container } = render(
        <AccountCard account={mockAccount} onClick={vi.fn()} />
      )

      const card = container.firstChild as HTMLElement
      expect(card).toHaveAttribute('tabIndex', '0')
    })

    it('should have aria-label for account', () => {
      const { container } = render(
        <AccountCard account={mockAccount} onClick={vi.fn()} />
      )

      const card = container.firstChild as HTMLElement
      expect(card).toHaveAttribute('aria-label', 'Account: Cash')
    })

    it('should have aria-label for balance', () => {
      render(<AccountCard account={mockAccount} />)

      const balance = screen.getByLabelText('Current balance')
      expect(balance).toBeInTheDocument()
    })

    it('should have aria-label for account number', () => {
      render(<AccountCard account={mockAccount} />)

      const accountNumber = screen.getByLabelText('Account number')
      expect(accountNumber).toBeInTheDocument()
    })

    it('should have aria-label for account type', () => {
      render(<AccountCard account={mockAccount} />)

      const accountType = screen.getByLabelText('Account type')
      expect(accountType).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle account without number', () => {
      const account = { ...mockAccount, accountNumber: undefined }
      render(<AccountCard account={account} />)

      expect(screen.getByText('Cash')).toBeInTheDocument()
      expect(screen.queryByLabelText('Account number')).not.toBeInTheDocument()
    })

    it('should handle account without description', () => {
      const account = { ...mockAccount, description: undefined }
      render(<AccountCard account={account} />)

      expect(screen.getByText('Cash')).toBeInTheDocument()
      expect(screen.queryByText('Primary cash account')).not.toBeInTheDocument()
    })

    it('should handle very long account names', () => {
      const account = {
        ...mockAccount,
        name: 'This is a very long account name that should wrap properly without breaking the layout',
      }
      render(<AccountCard account={account} />)

      expect(screen.getByText(account.name)).toBeInTheDocument()
    })

    it('should handle very large balances', () => {
      const account = { ...mockAccount, balance: 1000000000 }
      render(<AccountCard account={account} />)

      expect(screen.getByText('$1,000,000,000.00')).toBeInTheDocument()
    })
  })
})
