/**
 * Transaction Edit Context
 *
 * PURPOSE:
 * Provides global state for editing transactions. This allows the edit modal
 * to be opened from anywhere in the app (floating cards, registers, etc.)
 * using the same user-friendly forms as transaction creation.
 *
 * @module contexts/TransactionEditContext
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode
} from 'react'
import type { JournalEntry, TransactionType } from '../types'

// =============================================================================
// TYPES
// =============================================================================

interface TransactionEditContextValue {
  /** Transaction being edited (null if not editing) */
  editingTransaction: JournalEntry | null

  /** Company ID for the transaction */
  editingCompanyId: string | null

  /** Open the edit modal for a transaction */
  openEdit: (transaction: JournalEntry, companyId: string) => void

  /** Close the edit modal */
  closeEdit: () => void

  /** Whether edit modal is open */
  isEditOpen: boolean

  /** Callback to refresh data after save */
  onSaveCallback: (() => void) | null

  /** Set callback for after save */
  setOnSaveCallback: (callback: (() => void) | null) => void
}

// =============================================================================
// CONTEXT
// =============================================================================

const TransactionEditContext = createContext<TransactionEditContextValue | undefined>(undefined)

// =============================================================================
// PROVIDER
// =============================================================================

interface TransactionEditProviderProps {
  children: ReactNode
}

export function TransactionEditProvider({ children }: TransactionEditProviderProps) {
  const [editingTransaction, setEditingTransaction] = useState<JournalEntry | null>(null)
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)
  const [onSaveCallback, setOnSaveCallbackState] = useState<(() => void) | null>(null)

  const openEdit = useCallback((transaction: JournalEntry, companyId: string) => {
    setEditingTransaction(transaction)
    setEditingCompanyId(companyId)
  }, [])

  const closeEdit = useCallback(() => {
    setEditingTransaction(null)
    setEditingCompanyId(null)
    setOnSaveCallbackState(null)
  }, [])

  const setOnSaveCallback = useCallback((callback: (() => void) | null) => {
    setOnSaveCallbackState(() => callback)
  }, [])

  const isEditOpen = editingTransaction !== null

  const value = useMemo<TransactionEditContextValue>(() => ({
    editingTransaction,
    editingCompanyId,
    openEdit,
    closeEdit,
    isEditOpen,
    onSaveCallback,
    setOnSaveCallback,
  }), [
    editingTransaction,
    editingCompanyId,
    openEdit,
    closeEdit,
    isEditOpen,
    onSaveCallback,
    setOnSaveCallback,
  ])

  return (
    <TransactionEditContext.Provider value={value}>
      {children}
    </TransactionEditContext.Provider>
  )
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to access transaction edit context
 */
export function useTransactionEdit(): TransactionEditContextValue {
  const context = useContext(TransactionEditContext)
  if (context === undefined) {
    throw new Error('useTransactionEdit must be used within a TransactionEditProvider')
  }
  return context
}

/**
 * Get the appropriate form type for a transaction
 */
export function getFormTypeForTransaction(transaction: JournalEntry): 'expense' | 'simple' {
  const expenseTypes: TransactionType[] = ['expense', 'check', 'bill']
  if (transaction.transactionType && expenseTypes.includes(transaction.transactionType)) {
    return 'expense'
  }
  return 'simple'
}
