/**
 * Transactions Page Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Transactions from './Transactions'

// Mock the hooks
vi.mock('../hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: [],
    currentTransaction: null,
    isLoading: false,
    error: null,
    loadTransactions: vi.fn(),
    createNewTransaction: vi.fn(),
    updateExistingTransaction: vi.fn(),
    removeTransaction: vi.fn(),
    setCurrentTransaction: vi.fn(),
    clearError: vi.fn(),
  }),
  useNewTransaction: () => ({
    id: 'new-1',
    companyId: 'comp-1',
    date: new Date(),
    status: 'draft' as const,
    lines: [],
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  useNewLineItem: () => ({
    id: 'line-1',
    accountId: '',
    debit: 0,
    credit: 0,
  }),
}))

describe('Transactions Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render page title', () => {
    render(
      <BrowserRouter>
        <Transactions />
      </BrowserRouter>
    )

    expect(screen.getByText('Transactions')).toBeInTheDocument()
  })

  it('should show new transaction button', () => {
    render(
      <BrowserRouter>
        <Transactions />
      </BrowserRouter>
    )

    expect(screen.getByText('+ New Transaction')).toBeInTheDocument()
  })

  it('should show transaction count', () => {
    render(
      <BrowserRouter>
        <Transactions />
      </BrowserRouter>
    )

    expect(screen.getByText(/0 transactions/i)).toBeInTheDocument()
  })
})
