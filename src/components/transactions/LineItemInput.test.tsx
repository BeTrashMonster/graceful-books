/**
 * LineItemInput Component Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LineItemInput, LineItemHeader } from './LineItemInput'
import type { JournalEntryLine, Account } from '../../types'

describe('LineItemInput', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      companyId: 'comp-1',
      name: 'Cash',
      accountNumber: '1000',
      type: 'asset',
      isActive: true,
      balance: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'acc-2',
      companyId: 'comp-1',
      name: 'Revenue',
      type: 'income',
      isActive: true,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'acc-3',
      companyId: 'comp-1',
      name: 'Inactive Account',
      type: 'expense',
      isActive: false,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const mockLineItem: JournalEntryLine = {
    id: 'line-1',
    accountId: 'acc-1',
    debit: 100,
    credit: 0,
  }

  it('should render line item input fields', () => {
    const onChange = vi.fn()

    render(
      <LineItemInput
        lineItem={mockLineItem}
        accounts={mockAccounts}
        onChange={onChange}
      />
    )

    expect(screen.getByLabelText('Account')).toBeInTheDocument()
    expect(screen.getByLabelText('Debit')).toBeInTheDocument()
    expect(screen.getByLabelText('Credit')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
  })

  it('should show only active accounts in dropdown', () => {
    const onChange = vi.fn()

    render(
      <LineItemInput
        lineItem={mockLineItem}
        accounts={mockAccounts}
        onChange={onChange}
      />
    )

    const select = screen.getByLabelText('Account') as HTMLSelectElement
    const options = Array.from(select.options).map((opt: any) => opt.textContent)

    expect(options).toContain('1000 - Cash')
    expect(options).toContain('Revenue')
    expect(options).not.toContain('Inactive Account')
  })

  it('should call onChange when account is changed', () => {
    const onChange = vi.fn()

    render(
      <LineItemInput
        lineItem={mockLineItem}
        accounts={mockAccounts}
        onChange={onChange}
      />
    )

    const select = screen.getByLabelText('Account')
    fireEvent.change(select, { target: { value: 'acc-2' } })

    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall.accountId).toBe('acc-2')
  })

  it('should call onChange when debit is changed', () => {
    const onChange = vi.fn()

    render(
      <LineItemInput
        lineItem={mockLineItem}
        accounts={mockAccounts}
        onChange={onChange}
      />
    )

    const debitInput = screen.getByLabelText('Debit')
    fireEvent.change(debitInput, { target: { value: '150' } })

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        debit: 150,
        credit: 0,
      })
    )
  })

  it('should clear credit when debit is entered', () => {
    const onChange = vi.fn()
    const lineWithCredit: JournalEntryLine = {
      ...mockLineItem,
      debit: 0,
      credit: 50,
    }

    render(
      <LineItemInput
        lineItem={lineWithCredit}
        accounts={mockAccounts}
        onChange={onChange}
      />
    )

    const debitInput = screen.getByLabelText('Debit')
    fireEvent.change(debitInput, { target: { value: '100' } })

    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall.debit).toBe(100)
    expect(lastCall.credit).toBe(0)
  })

  it('should clear debit when credit is entered', () => {
    const onChange = vi.fn()

    render(
      <LineItemInput
        lineItem={mockLineItem}
        accounts={mockAccounts}
        onChange={onChange}
      />
    )

    const creditInput = screen.getByLabelText('Credit')
    fireEvent.change(creditInput, { target: { value: '75' } })

    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall.debit).toBe(0)
    expect(lastCall.credit).toBe(75)
  })

  it('should call onChange when memo is changed', () => {
    const onChange = vi.fn()

    render(
      <LineItemInput
        lineItem={mockLineItem}
        accounts={mockAccounts}
        onChange={onChange}
      />
    )

    const memoInput = screen.getByLabelText('Description')
    fireEvent.change(memoInput, { target: { value: 'Test memo' } })

    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall.memo).toBe('Test memo')
  })

  it('should call onRemove when remove button is clicked', () => {
    const onChange = vi.fn()
    const onRemove = vi.fn()

    render(
      <LineItemInput
        lineItem={mockLineItem}
        accounts={mockAccounts}
        onChange={onChange}
        onRemove={onRemove}
      />
    )

    const removeButton = screen.getByLabelText('Remove line item')
    fireEvent.click(removeButton)

    expect(onRemove).toHaveBeenCalled()
  })

  it('should not show remove button when showRemove is false', () => {
    const onChange = vi.fn()

    render(
      <LineItemInput
        lineItem={mockLineItem}
        accounts={mockAccounts}
        onChange={onChange}
        showRemove={false}
      />
    )

    expect(screen.queryByLabelText('Remove line item')).not.toBeInTheDocument()
  })

  it('should disable inputs when disabled prop is true', () => {
    const onChange = vi.fn()

    render(
      <LineItemInput
        lineItem={mockLineItem}
        accounts={mockAccounts}
        onChange={onChange}
        disabled={true}
      />
    )

    expect(screen.getByLabelText('Account')).toBeDisabled()
    expect(screen.getByLabelText('Debit')).toBeDisabled()
    expect(screen.getByLabelText('Credit')).toBeDisabled()
    expect(screen.getByLabelText('Description')).toBeDisabled()
  })

  it('should show error message when error prop is provided', () => {
    const onChange = vi.fn()

    render(
      <LineItemInput
        lineItem={mockLineItem}
        accounts={mockAccounts}
        onChange={onChange}
        error="Account is required"
      />
    )

    expect(screen.getByText('Account is required')).toBeInTheDocument()
  })

  it('should call onChange when value changes', () => {
    const onChange = vi.fn()

    render(
      <LineItemInput
        lineItem={{ ...mockLineItem, debit: 0 }}
        accounts={mockAccounts}
        onChange={onChange}
      />
    )

    const debitInput = screen.getByLabelText('Debit')
    fireEvent.change(debitInput, { target: { value: '100.5' } })

    expect(onChange).toHaveBeenCalled()
  })

  it('should show account type below account selection', () => {
    const onChange = vi.fn()

    render(
      <LineItemInput
        lineItem={mockLineItem}
        accounts={mockAccounts}
        onChange={onChange}
      />
    )

    expect(screen.getByText('asset')).toBeInTheDocument()
  })
})

describe('LineItemHeader', () => {
  it('should render column headers', () => {
    render(<LineItemHeader />)

    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Debit')).toBeInTheDocument()
    expect(screen.getByText('Credit')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
  })

  it('should adjust layout when showRemove is false', () => {
    const { container } = render(<LineItemHeader showRemove={false} />)

    const header = container.firstChild as HTMLElement
    expect(header.style.gridTemplateColumns).not.toContain('auto')
  })
})
