/**
 * TransactionForm Component Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TransactionForm } from './TransactionForm'
import type { JournalEntry, Account } from '../../types'

describe('TransactionForm', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-1',
      companyId: 'comp-1',
      name: 'Cash',
      type: 'asset',
      isActive: true,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const mockTransaction: JournalEntry = {
    id: '1',
    companyId: 'comp-1',
    date: new Date('2026-01-10'),
    status: 'draft',
    lines: [],
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('should render form fields', () => {
    const onChange = vi.fn()
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
      <TransactionForm
        transaction={mockTransaction}
        accounts={mockAccounts}
        onChange={onChange}
        onSave={onSave}
        onCancel={onCancel}
      />
    )

    expect(screen.getByLabelText(/date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/reference/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/memo/i)).toBeInTheDocument()
  })

  it('should allow adding line items', () => {
    const onChange = vi.fn()
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
      <TransactionForm
        transaction={mockTransaction}
        accounts={mockAccounts}
        onChange={onChange}
        onSave={onSave}
        onCancel={onCancel}
      />
    )

    const addButton = screen.getByText('+ Add Line')
    fireEvent.click(addButton)

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountId: '',
            debit: 0,
            credit: 0,
          }),
        ]),
      })
    )
  })

  it('should call onSave when save button is clicked', () => {
    const onChange = vi.fn()
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
      <TransactionForm
        transaction={mockTransaction}
        accounts={mockAccounts}
        onChange={onChange}
        onSave={onSave}
        onCancel={onCancel}
      />
    )

    const saveButton = screen.getByText('Save Transaction')
    fireEvent.click(saveButton)

    expect(onSave).toHaveBeenCalled()
  })

  it('should disable editing for posted transactions', () => {
    const onChange = vi.fn()
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
      <TransactionForm
        transaction={{ ...mockTransaction, status: 'posted' }}
        accounts={mockAccounts}
        onChange={onChange}
        onSave={onSave}
        onCancel={onCancel}
      />
    )

    expect(screen.queryByText('+ Add Line')).not.toBeInTheDocument()
    expect(screen.queryByText('Save Transaction')).not.toBeInTheDocument()
  })
})
