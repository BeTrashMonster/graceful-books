/**
 * Tests for AccountForm Component
 *
 * Tests form validation, submission, and accessibility
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { AccountForm, type AccountFormData } from './AccountForm'
import type { Account } from '../../types'

expect.extend(toHaveNoViolations)

describe('AccountForm Component', () => {
  const mockCompanyId = 'company-123'

  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()

  const mockParentAccounts: Account[] = [
    {
      id: 'acc-1',
      companyId: mockCompanyId,
      name: 'Assets',
      accountNumber: '1000',
      type: 'asset',
      isActive: true,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'acc-2',
      companyId: mockCompanyId,
      name: 'Liabilities',
      accountNumber: '2000',
      type: 'liability',
      isActive: true,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const mockAccount: Account = {
    id: 'acc-3',
    companyId: mockCompanyId,
    name: 'Cash',
    accountNumber: '1010',
    type: 'asset',
    parentAccountId: 'acc-1',
    description: 'Primary cash account',
    isActive: true,
    balance: 10000,
    createdAt: new Date(),
    updatedAt: new Date(),
  }


  describe('rendering', () => {
    it('should render create mode by default', () => {
      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('Create New Account')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    })

    it('should render edit mode when account is provided', () => {
      render(
        <AccountForm
          account={mockAccount}
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('Edit Account')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    })

    it('should render all form fields', () => {
      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByLabelText(/account name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/account number/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/account type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/active/i)).toBeInTheDocument()
    })

    it('should populate fields in edit mode', () => {
      render(
        <AccountForm
          account={mockAccount}
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          parentAccounts={mockParentAccounts}
        />
      )

      expect(screen.getByDisplayValue('Cash')).toBeInTheDocument()
      expect(screen.getByDisplayValue('1010')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Primary cash account')).toBeInTheDocument()
    })

    it('should show parent account selector when parent accounts are available', () => {
      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          parentAccounts={mockParentAccounts}
        />
      )

      expect(screen.getByLabelText(/parent account/i)).toBeInTheDocument()
    })

    it('should not show parent account selector when no parent accounts available', () => {
      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          parentAccounts={[]}
        />
      )

      expect(screen.queryByLabelText(/parent account/i)).not.toBeInTheDocument()
    })
  })

  describe('validation', () => {
    it('should require account name', async () => {
      const user = userEvent.setup()

      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/account name is required/i)).toBeInTheDocument()
      })

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should validate account number format', async () => {
      const user = userEvent.setup()

      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const nameInput = screen.getByLabelText(/account name/i)
      const numberInput = screen.getByLabelText(/account number/i)

      await user.type(nameInput, 'Test Account')
      await user.type(numberInput, 'ABC123')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/can only contain numbers and dashes/i)).toBeInTheDocument()
      })

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should accept valid account number', async () => {
      const user = userEvent.setup()

      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const nameInput = screen.getByLabelText(/account name/i)
      const numberInput = screen.getByLabelText(/account number/i)

      await user.type(nameInput, 'Test Account')
      await user.type(numberInput, '1000-10')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled()
      })

      expect(screen.queryByText(/can only contain numbers and dashes/i)).not.toBeInTheDocument()
    })

    it('should validate parent account type matches', async () => {
      const user = userEvent.setup()

      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          parentAccounts={mockParentAccounts}
        />
      )

      const typeSelect = screen.getByLabelText(/account type/i)

      // When asset type is selected, only asset parents should be available
      await user.selectOptions(typeSelect, 'asset')

      // acc-1 (Assets) should be available
      expect(screen.getByRole('option', { name: /1000 - Assets/i })).toBeInTheDocument()

      // Change to liability type
      await user.selectOptions(typeSelect, 'liability')

      // Now acc-2 (Liabilities) should be available
      expect(screen.getByRole('option', { name: /2000 - Liabilities/i })).toBeInTheDocument()

      // acc-1 (Assets) should no longer be available (form filters by type)
      expect(screen.queryByRole('option', { name: /1000 - Assets/i })).not.toBeInTheDocument()
    })
  })

  describe('form submission', () => {
    it('should submit valid form data', async () => {
      const user = userEvent.setup()

      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const nameInput = screen.getByLabelText(/account name/i)
      const numberInput = screen.getByLabelText(/account number/i)
      const typeSelect = screen.getByLabelText(/account type/i)
      const descriptionInput = screen.getByLabelText(/description/i)

      await user.type(nameInput, 'New Account')
      await user.type(numberInput, '5000')
      await user.selectOptions(typeSelect, 'expense')
      await user.type(descriptionInput, 'Test description')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled()
      })

      const submittedData: AccountFormData = mockOnSubmit.mock.calls[0]![0]
      expect(submittedData.name).toBe('New Account')
      expect(submittedData.accountNumber).toBe('5000')
      expect(submittedData.type).toBe('expense')
      expect(submittedData.description).toBe('Test description')
      expect(submittedData.isActive).toBe(true)
    })

    it('should submit with parent account', async () => {
      const user = userEvent.setup()

      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          parentAccounts={mockParentAccounts}
        />
      )

      const nameInput = screen.getByLabelText(/account name/i)
      const typeSelect = screen.getByLabelText(/account type/i)
      const parentSelect = screen.getByLabelText(/parent account/i)

      await user.type(nameInput, 'Sub Account')
      await user.selectOptions(typeSelect, 'asset')
      await user.selectOptions(parentSelect, 'acc-1')

      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled()
      })

      const submittedData: AccountFormData = mockOnSubmit.mock.calls[0]![0]
      expect(submittedData.parentAccountId).toBe('acc-1')
    })

    it('should submit inactive account', async () => {
      const user = userEvent.setup()

      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const nameInput = screen.getByLabelText(/account name/i)
      const activeCheckbox = screen.getByLabelText(/active/i)

      await user.type(nameInput, 'Inactive Account')
      await user.click(activeCheckbox)

      const submitButton = screen.getByRole('button', { name: /create account/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled()
      })

      const submittedData: AccountFormData = mockOnSubmit.mock.calls[0]![0]
      expect(submittedData.isActive).toBe(false)
    })

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalled()
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should disable form during submission', () => {
      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isSubmitting={true}
        />
      )

      const nameInput = screen.getByLabelText(/account name/i)
      // Use queryByRole to find the submit button more reliably
      const buttons = screen.getAllByRole('button')
      const submitButton = buttons.find((btn: any) => btn.textContent?.includes('Account'))
      const cancelButton = screen.getByRole('button', { name: /cancel/i })

      expect(nameInput).toBeDisabled()
      expect(submitButton).toBeDisabled()
      expect(cancelButton).toBeDisabled()
    })
  })

  describe('parent account filtering', () => {
    it('should filter parent accounts by type', async () => {
      const user = userEvent.setup()

      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          parentAccounts={mockParentAccounts}
        />
      )

      const typeSelect = screen.getByLabelText(/account type/i)
      await user.selectOptions(typeSelect, 'asset')

      const parentSelect = screen.getByLabelText(/parent account/i) as HTMLSelectElement
      const options = Array.from(parentSelect.options).map((o: any) => o.textContent)

      // Should only show asset parent, not liability parent
      expect(options.some((o: any) => o?.includes('Assets'))).toBe(true)
      expect(options.some((o: any) => o?.includes('Liabilities'))).toBe(false)
    })

    it('should disable type select in edit mode', () => {
      render(
        <AccountForm
          account={mockAccount}
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          parentAccounts={mockParentAccounts}
        />
      )

      // Cannot change type in edit mode
      const typeSelect = screen.getByLabelText(/account type/i)
      expect(typeSelect).toBeDisabled()
    })

    it('should not allow account to be its own parent', () => {
      render(
        <AccountForm
          account={mockAccount}
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          parentAccounts={[...mockParentAccounts, mockAccount]}
        />
      )

      const parentSelect = screen.getByLabelText(/parent account/i) as HTMLSelectElement
      const options = Array.from(parentSelect.options).map((o: any) => o.value)

      expect(options.includes(mockAccount.id)).toBe(false)
    })
  })

  describe('accessibility', () => {
    it('should have no accessibility violations in create mode', async () => {
      const { container } = render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations in edit mode', async () => {
      const { container } = render(
        <AccountForm
          account={mockAccount}
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          parentAccounts={mockParentAccounts}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper labels for all inputs', () => {
      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          parentAccounts={mockParentAccounts}
        />
      )

      expect(screen.getByLabelText(/account name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/account number/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/account type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/parent account/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/active/i)).toBeInTheDocument()
    })

    it('should have helper text for inputs', () => {
      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText(/descriptive name for this account/i)).toBeInTheDocument()
      expect(screen.getByText(/used for organizing and reporting/i)).toBeInTheDocument()
      expect(screen.getByText(/choose the category/i)).toBeInTheDocument()
    })
  })

  describe('account type options', () => {
    it('should show all account types with descriptions', async () => {
      render(
        <AccountForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const typeSelect = screen.getByLabelText(/account type/i) as HTMLSelectElement

      const options = Array.from(typeSelect.options).map((o: any) => o.textContent)

      expect(options.some((o: any) => o?.includes('Asset'))).toBe(true)
      expect(options.some((o: any) => o?.includes('Liability'))).toBe(true)
      expect(options.some((o: any) => o?.includes('Equity'))).toBe(true)
      expect(options.some((o: any) => o?.includes('Income'))).toBe(true)
      expect(options.some((o: any) => o?.includes('Expense'))).toBe(true)
      expect(options.some((o: any) => o?.includes('Cost of Goods Sold'))).toBe(true)
      expect(options.some((o: any) => o?.includes('Other Income'))).toBe(true)
      expect(options.some((o: any) => o?.includes('Other Expense'))).toBe(true)
    })
  })
})
