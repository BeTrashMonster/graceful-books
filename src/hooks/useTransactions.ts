/**
 * useTransactions Hook
 *
 * Custom hook for managing transactions with CRUD operations,
 * validation, and state management.
 *
 * Requirements: B2 - Transaction Entry - Basic
 */

import { useState, useCallback } from 'react'
import { nanoid } from 'nanoid'
import type { JournalEntry, JournalEntryLine, TransactionStatus } from '../types'
import { validateTransaction, calculateBalance } from '../utils/transactionValidation'
import {
  createTransaction,
  getTransaction,
  updateTransaction,
  deleteTransaction,
  queryTransactions,
  postTransaction as postTransactionAPI,
  voidTransaction as voidTransactionAPI,
} from '../store/transactions'

/**
 * Filter options for querying transactions
 */
export interface TransactionFilter {
  companyId: string
  status?: TransactionStatus
  fromDate?: Date
  toDate?: Date
  accountId?: string
  includeDeleted?: boolean
}

/**
 * Hook return type
 */
export interface UseTransactionsReturn {
  // State
  transactions: JournalEntry[]
  currentTransaction: JournalEntry | null
  isLoading: boolean
  error: string | null

  // CRUD operations
  loadTransactions: (filter: TransactionFilter) => Promise<void>
  loadTransaction: (id: string) => Promise<void>
  createNewTransaction: (transaction: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>) => Promise<JournalEntry | null>
  updateExistingTransaction: (id: string, updates: Partial<JournalEntry>) => Promise<JournalEntry | null>
  removeTransaction: (id: string) => Promise<boolean>
  postTransaction: (id: string) => Promise<boolean>
  voidTransaction: (id: string) => Promise<boolean>

  // Validation helpers
  validateCurrentTransaction: () => ReturnType<typeof validateTransaction>
  getBalance: () => ReturnType<typeof calculateBalance>

  // State management
  setCurrentTransaction: (transaction: JournalEntry | null) => void
  clearError: () => void
}

/**
 * Custom hook for transaction operations
 */
export function useTransactions(): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<JournalEntry[]>([])
  const [currentTransaction, setCurrentTransaction] = useState<JournalEntry | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Load all transactions with filters
   */
  const loadTransactions = useCallback(async (filter: TransactionFilter) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await queryTransactions(filter)

      if (result.success) {
        setTransactions(result.data)
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Load a single transaction by ID
   */
  const loadTransaction = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await getTransaction(id)

      if (result.success) {
        setCurrentTransaction(result.data)
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transaction')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Create a new transaction
   */
  const createNewTransaction = useCallback(
    async (
      transaction: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
    ): Promise<JournalEntry | null> => {
      setIsLoading(true)
      setError(null)

      try {
        // Validate before creating
        const validation = validateTransaction(transaction.lines)
        if (!validation.isValid) {
          setError(validation.errors.join(', '))
          return null
        }

        const result = await createTransaction(transaction)

        if (result.success) {
          setCurrentTransaction(result.data)
          return result.data
        } else {
          setError(result.error.message)
          return null
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create transaction')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * Update an existing transaction
   */
  const updateExistingTransaction = useCallback(
    async (id: string, updates: Partial<JournalEntry>): Promise<JournalEntry | null> => {
      setIsLoading(true)
      setError(null)

      try {
        // If updating lines, validate them
        if (updates.lines) {
          const validation = validateTransaction(updates.lines)
          if (!validation.isValid) {
            setError(validation.errors.join(', '))
            return null
          }
        }

        const result = await updateTransaction(id, updates)

        if (result.success) {
          setCurrentTransaction(result.data)
          return result.data
        } else {
          setError(result.error.message)
          return null
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update transaction')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * Delete a transaction (soft delete)
   */
  const removeTransaction = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await deleteTransaction(id)

      if (result.success) {
        if (currentTransaction?.id === id) {
          setCurrentTransaction(null)
        }
        return true
      } else {
        setError(result.error.message)
        return false
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete transaction')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [currentTransaction])

  /**
   * Post a transaction (change status from draft to posted)
   */
  const postTransaction = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await postTransactionAPI(id)

      if (result.success) {
        setCurrentTransaction(result.data)
        return true
      } else {
        setError(result.error.message)
        return false
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post transaction')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Void a transaction
   */
  const voidTransaction = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await voidTransactionAPI(id)

      if (result.success) {
        setCurrentTransaction(result.data)
        return true
      } else {
        setError(result.error.message)
        return false
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to void transaction')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Validate the current transaction
   */
  const validateCurrentTransaction = useCallback(() => {
    if (!currentTransaction) {
      return {
        isValid: false,
        errors: ['No transaction to validate'],
        warnings: [],
        totalDebits: 0,
        totalCredits: 0,
        difference: 0,
      }
    }

    return validateTransaction(currentTransaction.lines)
  }, [currentTransaction])

  /**
   * Get balance of current transaction
   */
  const getBalance = useCallback(() => {
    if (!currentTransaction) {
      return {
        totalDebits: 0,
        totalCredits: 0,
        difference: 0,
        isBalanced: true,
      }
    }

    return calculateBalance(currentTransaction.lines)
  }, [currentTransaction])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // State
    transactions,
    currentTransaction,
    isLoading,
    error,

    // CRUD operations
    loadTransactions,
    loadTransaction,
    createNewTransaction,
    updateExistingTransaction,
    removeTransaction,
    postTransaction,
    voidTransaction,

    // Validation helpers
    validateCurrentTransaction,
    getBalance,

    // State management
    setCurrentTransaction,
    clearError,
  }
}

/**
 * Helper hook to create a new blank transaction
 */
export function useNewTransaction(companyId: string, userId: string): JournalEntry {
  return {
    id: nanoid(),
    companyId,
    date: new Date(),
    status: 'draft',
    lines: [],
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/**
 * Helper hook to create a new blank line item
 */
export function useNewLineItem(): JournalEntryLine {
  return {
    id: nanoid(),
    accountId: '',
    debit: 0,
    credit: 0,
  }
}
