/**
 * useTransactions Hook Tests
 *
 * Tests for transaction management hook
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTransactions, useNewTransaction, useNewLineItem } from './useTransactions'
import type { JournalEntry } from '../types'

// Mock the store functions
vi.mock('../store/transactions', () => ({
  createTransaction: vi.fn(),
  getTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  queryTransactions: vi.fn(),
  postTransaction: vi.fn(),
  voidTransaction: vi.fn(),
}))

import {
  createTransaction,
  getTransaction,
  updateTransaction,
  deleteTransaction,
  queryTransactions,
  postTransaction as postTransactionAPI,
  voidTransaction as voidTransactionAPI,
} from '../store/transactions'

describe('useTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useTransactions())

      expect(result.current.transactions).toEqual([])
      expect(result.current.currentTransaction).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('loadTransactions', () => {
    it('should load transactions successfully', async () => {
      const mockTransactions: JournalEntry[] = [
        {
          id: '1',
          companyId: 'comp-1',
          date: new Date(),
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

      vi.mocked(queryTransactions).mockResolvedValue({
        success: true,
        data: mockTransactions,
      })

      const { result } = renderHook(() => useTransactions())

      await act(async () => {
        await result.current.loadTransactions({ companyId: 'comp-1' })
      })

      expect(result.current.transactions).toEqual(mockTransactions)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle load error', async () => {
      vi.mocked(queryTransactions).mockResolvedValue({
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'Database error',
        },
      })

      const { result } = renderHook(() => useTransactions())

      await act(async () => {
        await result.current.loadTransactions({ companyId: 'comp-1' })
      })

      expect(result.current.transactions).toEqual([])
      expect(result.current.error).toBe('Database error')
    })
  })

  describe('loadTransaction', () => {
    it('should load a single transaction', async () => {
      const mockTransaction: JournalEntry = {
        id: '1',
        companyId: 'comp-1',
        date: new Date(),
        status: 'draft',
        lines: [
          { id: 'l1', accountId: 'acc-1', debit: 100, credit: 0 },
          { id: 'l2', accountId: 'acc-2', debit: 0, credit: 100 },
        ],
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(getTransaction).mockResolvedValue({
        success: true,
        data: mockTransaction,
      })

      const { result } = renderHook(() => useTransactions())

      await act(async () => {
        await result.current.loadTransaction('1')
      })

      expect(result.current.currentTransaction).toEqual(mockTransaction)
      expect(result.current.error).toBeNull()
    })

    it('should handle transaction not found', async () => {
      vi.mocked(getTransaction).mockResolvedValue({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Transaction not found',
        },
      })

      const { result } = renderHook(() => useTransactions())

      await act(async () => {
        await result.current.loadTransaction('999')
      })

      expect(result.current.currentTransaction).toBeNull()
      expect(result.current.error).toBe('Transaction not found')
    })
  })

  describe('createNewTransaction', () => {
    it('should create a valid transaction', async () => {
      const newTransaction = {
        companyId: 'comp-1',
        date: new Date(),
        status: 'draft' as const,
        lines: [
          { id: 'l1', accountId: 'acc-1', debit: 100, credit: 0 },
          { id: 'l2', accountId: 'acc-2', debit: 0, credit: 100 },
        ],
        createdBy: 'user-1',
      }

      const mockCreated: JournalEntry = {
        ...newTransaction,
        id: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(createTransaction).mockResolvedValue({
        success: true,
        data: mockCreated,
      })

      const { result } = renderHook(() => useTransactions())

      let created: JournalEntry | null = null
      await act(async () => {
        created = await result.current.createNewTransaction(newTransaction)
      })

      expect(created).toEqual(mockCreated)
      expect(result.current.currentTransaction).toEqual(mockCreated)
      expect(result.current.error).toBeNull()
    })

    it('should reject unbalanced transaction', async () => {
      const invalidTransaction = {
        companyId: 'comp-1',
        date: new Date(),
        status: 'draft' as const,
        lines: [
          { id: 'l1', accountId: 'acc-1', debit: 100, credit: 0 },
          { id: 'l2', accountId: 'acc-2', debit: 0, credit: 75 }, // Unbalanced
        ],
        createdBy: 'user-1',
      }

      const { result } = renderHook(() => useTransactions())

      let created: JournalEntry | null = null
      await act(async () => {
        created = await result.current.createNewTransaction(invalidTransaction)
      })

      expect(created).toBeNull()
      expect(result.current.error).toBeTruthy()
      expect(result.current.error).toContain('not balanced')
    })

    it('should reject transaction with invalid line items', async () => {
      const invalidTransaction = {
        companyId: 'comp-1',
        date: new Date(),
        status: 'draft' as const,
        lines: [
          { id: 'l1', accountId: '', debit: 100, credit: 0 }, // No account
        ],
        createdBy: 'user-1',
      }

      const { result } = renderHook(() => useTransactions())

      let created: JournalEntry | null = null
      await act(async () => {
        created = await result.current.createNewTransaction(invalidTransaction)
      })

      expect(created).toBeNull()
      expect(result.current.error).toBeTruthy()
    })
  })

  describe('updateExistingTransaction', () => {
    it('should update a transaction', async () => {
      const updates = {
        memo: 'Updated memo',
      }

      const mockUpdated: JournalEntry = {
        id: '1',
        companyId: 'comp-1',
        date: new Date(),
        status: 'draft',
        memo: 'Updated memo',
        lines: [
          { id: 'l1', accountId: 'acc-1', debit: 100, credit: 0 },
          { id: 'l2', accountId: 'acc-2', debit: 0, credit: 100 },
        ],
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(updateTransaction).mockResolvedValue({
        success: true,
        data: mockUpdated,
      })

      const { result } = renderHook(() => useTransactions())

      let updated: JournalEntry | null = null
      await act(async () => {
        updated = await result.current.updateExistingTransaction('1', updates)
      })

      expect(updated).toEqual(mockUpdated)
      expect(result.current.currentTransaction).toEqual(mockUpdated)
    })

    it('should validate line updates', async () => {
      const updates = {
        lines: [
          { id: 'l1', accountId: 'acc-1', debit: 100, credit: 0 },
          { id: 'l2', accountId: 'acc-2', debit: 0, credit: 75 }, // Unbalanced
        ],
      }

      const { result } = renderHook(() => useTransactions())

      let updated: JournalEntry | null = null
      await act(async () => {
        updated = await result.current.updateExistingTransaction('1', updates)
      })

      expect(updated).toBeNull()
      expect(result.current.error).toBeTruthy()
      expect(result.current.error).toContain('not balanced')
    })
  })

  describe('removeTransaction', () => {
    it('should delete a transaction', async () => {
      vi.mocked(deleteTransaction).mockResolvedValue({
        success: true,
        data: undefined,
      })

      const { result } = renderHook(() => useTransactions())

      let success = false
      await act(async () => {
        success = await result.current.removeTransaction('1')
      })

      expect(success).toBe(true)
      expect(result.current.error).toBeNull()
    })

    it('should clear current transaction if deleted', async () => {
      const mockTransaction: JournalEntry = {
        id: '1',
        companyId: 'comp-1',
        date: new Date(),
        status: 'draft',
        lines: [],
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(deleteTransaction).mockResolvedValue({
        success: true,
        data: undefined,
      })

      const { result } = renderHook(() => useTransactions())

      act(() => {
        result.current.setCurrentTransaction(mockTransaction)
      })

      expect(result.current.currentTransaction).toEqual(mockTransaction)

      await act(async () => {
        await result.current.removeTransaction('1')
      })

      expect(result.current.currentTransaction).toBeNull()
    })
  })

  describe('postTransaction', () => {
    it('should post a transaction', async () => {
      const mockPosted: JournalEntry = {
        id: '1',
        companyId: 'comp-1',
        date: new Date(),
        status: 'posted',
        lines: [
          { id: 'l1', accountId: 'acc-1', debit: 100, credit: 0 },
          { id: 'l2', accountId: 'acc-2', debit: 0, credit: 100 },
        ],
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(postTransactionAPI).mockResolvedValue({
        success: true,
        data: mockPosted,
      })

      const { result } = renderHook(() => useTransactions())

      let success = false
      await act(async () => {
        success = await result.current.postTransaction('1')
      })

      expect(success).toBe(true)
      expect(result.current.currentTransaction?.status).toBe('posted')
    })
  })

  describe('voidTransaction', () => {
    it('should void a transaction', async () => {
      const mockVoided: JournalEntry = {
        id: '1',
        companyId: 'comp-1',
        date: new Date(),
        status: 'void',
        lines: [
          { id: 'l1', accountId: 'acc-1', debit: 100, credit: 0 },
          { id: 'l2', accountId: 'acc-2', debit: 0, credit: 100 },
        ],
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(voidTransactionAPI).mockResolvedValue({
        success: true,
        data: mockVoided,
      })

      const { result } = renderHook(() => useTransactions())

      let success = false
      await act(async () => {
        success = await result.current.voidTransaction('1')
      })

      expect(success).toBe(true)
      expect(result.current.currentTransaction?.status).toBe('void')
    })
  })

  describe('validateCurrentTransaction', () => {
    it('should validate current transaction', () => {
      const { result } = renderHook(() => useTransactions())

      act(() => {
        result.current.setCurrentTransaction({
          id: '1',
          companyId: 'comp-1',
          date: new Date(),
          status: 'draft',
          lines: [
            { id: 'l1', accountId: 'acc-1', debit: 100, credit: 0 },
            { id: 'l2', accountId: 'acc-2', debit: 0, credit: 100 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      })

      const validation = result.current.validateCurrentTransaction()

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should handle no current transaction', () => {
      const { result } = renderHook(() => useTransactions())

      const validation = result.current.validateCurrentTransaction()

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('No transaction to validate')
    })
  })

  describe('getBalance', () => {
    it('should calculate balance of current transaction', () => {
      const { result } = renderHook(() => useTransactions())

      act(() => {
        result.current.setCurrentTransaction({
          id: '1',
          companyId: 'comp-1',
          date: new Date(),
          status: 'draft',
          lines: [
            { id: 'l1', accountId: 'acc-1', debit: 150, credit: 0 },
            { id: 'l2', accountId: 'acc-2', debit: 0, credit: 100 },
          ],
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      })

      const balance = result.current.getBalance()

      expect(balance.totalDebits).toBe(150)
      expect(balance.totalCredits).toBe(100)
      expect(balance.difference).toBe(50)
      expect(balance.isBalanced).toBe(false)
    })

    it('should return zero for no current transaction', () => {
      const { result } = renderHook(() => useTransactions())

      const balance = result.current.getBalance()

      expect(balance.totalDebits).toBe(0)
      expect(balance.totalCredits).toBe(0)
      expect(balance.isBalanced).toBe(true)
    })
  })

  describe('clearError', () => {
    it('should clear error state', async () => {
      vi.mocked(getTransaction).mockResolvedValue({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Not found',
        },
      })

      const { result } = renderHook(() => useTransactions())

      await act(async () => {
        await result.current.loadTransaction('999')
      })

      expect(result.current.error).toBe('Not found')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })
})

describe('useNewTransaction', () => {
  it('should create a new blank transaction', () => {
    const { result } = renderHook(() =>
      useNewTransaction('comp-1', 'user-1')
    )

    expect(result.current.id).toBeDefined()
    expect(result.current.companyId).toBe('comp-1')
    expect(result.current.createdBy).toBe('user-1')
    expect(result.current.status).toBe('draft')
    expect(result.current.lines).toEqual([])
  })
})

describe('useNewLineItem', () => {
  it('should create a new blank line item', () => {
    const { result } = renderHook(() => useNewLineItem())

    expect(result.current.id).toBeDefined()
    expect(result.current.accountId).toBe('')
    expect(result.current.debit).toBe(0)
    expect(result.current.credit).toBe(0)
  })
})
