/**
 * TransactionList Component Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TransactionList } from './TransactionList'
import type { JournalEntry } from '../../types'

describe('TransactionList', () => {
  const mockTransactions: JournalEntry[] = [
    {
      id: '1',
      companyId: 'comp-1',
      date: new Date('2026-01-10'),
      reference: 'INV-001',
      memo: 'Test transaction',
      status: 'posted',
      lines: [
        { id: 'l1', accountId: 'acc-1', debit: 100, credit: 0 },
        { id: 'l2', accountId: 'acc-2', debit: 0, credit: 100 },
      ],
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  it('should render transaction list', () => {
    const onSelect = vi.fn()

    render(<TransactionList transactions={mockTransactions} onSelect={onSelect} />)

    expect(screen.getByText('INV-001')).toBeInTheDocument()
    expect(screen.getByText('Test transaction')).toBeInTheDocument()
  })

  it('should call onSelect when transaction is clicked', () => {
    const onSelect = vi.fn()

    render(<TransactionList transactions={mockTransactions} onSelect={onSelect} />)

    const row = screen.getByText('INV-001').closest('tr')
    fireEvent.click(row!)

    expect(onSelect).toHaveBeenCalledWith(mockTransactions[0])
  })

  it('should show empty state when no transactions', () => {
    const onSelect = vi.fn()

    render(<TransactionList transactions={[]} onSelect={onSelect} />)

    expect(screen.getByText('No transactions yet')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    const onSelect = vi.fn()

    render(<TransactionList transactions={[]} onSelect={onSelect} isLoading={true} />)

    expect(screen.getByText('Loading transactions...')).toBeInTheDocument()
  })
})
