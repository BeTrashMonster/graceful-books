/**
 * TransactionSummary Component Tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransactionSummary } from './TransactionSummary'
import type { JournalEntryLine } from '../../types'

describe('TransactionSummary', () => {
  it('should show balanced transaction', () => {
    const lines: JournalEntryLine[] = [
      { id: '1', accountId: 'acc-1', debit: 100, credit: 0 },
      { id: '2', accountId: 'acc-2', debit: 0, credit: 100 },
    ]

    render(<TransactionSummary lines={lines} />)

    expect(screen.getByText('Transaction is balanced')).toBeInTheDocument()
    expect(screen.getByText('Total Debits')).toBeInTheDocument()
    expect(screen.getByText('Total Credits')).toBeInTheDocument()
  })

  it('should show unbalanced transaction', () => {
    const lines: JournalEntryLine[] = [
      { id: '1', accountId: 'acc-1', debit: 100, credit: 0 },
      { id: '2', accountId: 'acc-2', debit: 0, credit: 75 },
    ]

    render(<TransactionSummary lines={lines} />)

    expect(screen.getByText('Transaction is not balanced')).toBeInTheDocument()
  })

  it('should show validation errors', () => {
    const lines: JournalEntryLine[] = [
      { id: '1', accountId: '', debit: 100, credit: 0 },
    ]

    render(<TransactionSummary lines={lines} showValidation={true} />)

    expect(screen.getByText('Validation Errors')).toBeInTheDocument()
  })

  it('should not show validation when showValidation is false', () => {
    const lines: JournalEntryLine[] = [
      { id: '1', accountId: '', debit: 100, credit: 0 },
    ]

    render(<TransactionSummary lines={lines} showValidation={false} />)

    expect(screen.queryByText('Validation Errors')).not.toBeInTheDocument()
  })
})
