/**
 * TransactionDetailDrawer Component
 *
 * Main orchestration component for viewing/editing transaction details.
 * Opens in a drawer sliding from the right.
 */

import { type FC, useState, useEffect, useMemo, useCallback } from 'react'
import { Drawer } from '../modals/Drawer'
import { TransactionDetailView } from './TransactionDetailView'
import { TransactionDetailEdit } from './TransactionDetailEdit'
import { useTransactions } from '../../hooks/useTransactions'
import { useAccounts } from '../../hooks/useAccounts'
import { useVendors } from '../../hooks/useVendors'
import { useCustomers } from '../../hooks/useCustomers'
import type { JournalEntry, Account } from '../../types'
import styles from './TransactionDetailDrawer.module.css'

/**
 * Balance sheet account types for reconciliation warnings
 */
const BALANCE_SHEET_TYPES: Account['type'][] = ['asset', 'liability', 'equity']

export interface TransactionDetailDrawerProps {
  /**
   * Whether the drawer is open
   */
  isOpen: boolean
  /**
   * Called when drawer should close
   */
  onClose: () => void
  /**
   * ID of the transaction to display
   */
  transactionId: string
  /**
   * Company ID for data queries
   */
  companyId: string
  /**
   * Called when transaction is updated
   */
  onTransactionUpdated?: (transaction: JournalEntry) => void
  /**
   * Called when transaction is voided
   */
  onTransactionVoided?: (transaction: JournalEntry) => void
  /**
   * Called when transaction is deleted
   */
  onTransactionDeleted?: (transactionId: string) => void
  /**
   * Running balance at this transaction (optional, passed from register)
   */
  runningBalance?: number
}

export const TransactionDetailDrawer: FC<TransactionDetailDrawerProps> = ({
  isOpen,
  onClose,
  transactionId,
  companyId,
  onTransactionUpdated,
  onTransactionVoided,
  onTransactionDeleted,
  runningBalance,
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionInProgress, setActionInProgress] = useState(false)

  // Load transaction
  const {
    currentTransaction,
    loadTransaction,
    updateExistingTransaction,
    voidTransaction,
    removeTransaction,
  } = useTransactions()

  // Load related data
  const { accounts } = useAccounts({ companyId })
  const { vendors } = useVendors({ companyId })
  const { customers } = useCustomers({ companyId })

  // Load transaction when drawer opens
  useEffect(() => {
    if (isOpen && transactionId) {
      setIsLoading(true)
      setError(null)
      setMode('view')
      loadTransaction(transactionId, companyId)
        .then(() => setIsLoading(false))
        .catch((err) => {
          setError(err.message || 'Failed to load transaction')
          setIsLoading(false)
        })
    }
  }, [isOpen, transactionId, companyId, loadTransaction])

  // Get vendor/customer name
  const vendorName = useMemo(() => {
    if (!currentTransaction?.vendorId) return undefined
    const vendor = vendors.find(v => v.id === currentTransaction.vendorId)
    return vendor?.name
  }, [currentTransaction?.vendorId, vendors])

  const customerName = useMemo(() => {
    if (!currentTransaction?.customerId) return undefined
    const customer = customers.find(c => c.id === currentTransaction.customerId)
    return customer?.name
  }, [currentTransaction?.customerId, customers])

  // Check if has reconciled balance sheet lines
  const hasReconciledBalanceSheetLines = useMemo(() => {
    if (!currentTransaction) return false
    if (currentTransaction.status !== 'reconciled') return false
    return currentTransaction.lines.some(line => {
      if (!line.isLocked) return false
      const account = accounts.find(a => a.id === line.accountId)
      return account && BALANCE_SHEET_TYPES.includes(account.type)
    })
  }, [currentTransaction, accounts])

  // Handle edit
  const handleEdit = useCallback(() => {
    setMode('edit')
  }, [])

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setMode('view')
  }, [])

  // Handle save
  const handleSave = useCallback(async (updates: Partial<JournalEntry>) => {
    if (!currentTransaction) return

    setActionInProgress(true)
    try {
      const result = await updateExistingTransaction(currentTransaction.id, updates)
      if (result) {
        setMode('view')
        onTransactionUpdated?.(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction')
    } finally {
      setActionInProgress(false)
    }
  }, [currentTransaction, updateExistingTransaction, onTransactionUpdated])

  // Handle void
  const handleVoid = useCallback(async () => {
    if (!currentTransaction) return

    const confirmed = window.confirm(
      'Are you sure you want to void this transaction? This action cannot be undone.'
    )
    if (!confirmed) return

    setActionInProgress(true)
    try {
      const success = await voidTransaction(currentTransaction.id)
      if (success) {
        onTransactionVoided?.(currentTransaction)
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to void transaction')
    } finally {
      setActionInProgress(false)
    }
  }, [currentTransaction, voidTransaction, onTransactionVoided, onClose])

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!currentTransaction) return

    // Different confirmation based on reconciliation status
    let message = 'Are you sure you want to delete this transaction? This cannot be undone.'
    if (hasReconciledBalanceSheetLines) {
      message = 'This transaction contains reconciled accounts. ' +
        'Deleting it will affect your reconciliation records. ' +
        'Are you sure you want to delete?'
    }

    const confirmed = window.confirm(message)
    if (!confirmed) return

    setActionInProgress(true)
    try {
      const success = await removeTransaction(currentTransaction.id)
      if (success) {
        onTransactionDeleted?.(currentTransaction.id)
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete transaction')
    } finally {
      setActionInProgress(false)
    }
  }, [currentTransaction, hasReconciledBalanceSheetLines, removeTransaction, onTransactionDeleted, onClose])

  // Handle toggle lock
  const handleToggleLock = useCallback(async (lineId: string) => {
    if (!currentTransaction) return

    // Find the line
    const line = currentTransaction.lines.find(l => l.id === lineId)
    if (!line) return

    // Check if it's a balance sheet account
    const account = accounts.find(a => a.id === line.accountId)
    const isBalanceSheet = account && BALANCE_SHEET_TYPES.includes(account.type)

    // Warn if toggling a reconciled balance sheet account
    if (line.isLocked && isBalanceSheet) {
      const confirmed = window.confirm(
        'This account was part of a completed reconciliation. ' +
        'Unlocking it may affect your reconciliation records. Continue?'
      )
      if (!confirmed) return
    }

    // Toggle the lock
    const updatedLines = currentTransaction.lines.map(l =>
      l.id === lineId ? { ...l, isLocked: !l.isLocked } : l
    )

    try {
      await updateExistingTransaction(currentTransaction.id, { lines: updatedLines })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lock status')
    }
  }, [currentTransaction, accounts, updateExistingTransaction])

  // Drawer title
  const drawerTitle = useMemo(() => {
    if (mode === 'edit') return 'Edit Transaction'
    return 'Transaction Details'
  }, [mode])

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={drawerTitle}
      position="right"
      size="lg"
      closeOnBackdropClick={!actionInProgress}
      closeOnEscape={!actionInProgress}
    >
      <div className={styles.content}>
        {isLoading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Loading transaction...</span>
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className={styles.dismissError}
            >
              Dismiss
            </button>
          </div>
        )}

        {!isLoading && !error && currentTransaction && mode === 'view' && (
          <TransactionDetailView
            transaction={currentTransaction}
            accounts={accounts}
            vendorName={vendorName}
            customerName={customerName}
            runningBalance={runningBalance}
            onEdit={handleEdit}
            onVoid={handleVoid}
            onDelete={handleDelete}
            onToggleLock={handleToggleLock}
            actionsDisabled={actionInProgress}
          />
        )}

        {!isLoading && !error && currentTransaction && mode === 'edit' && (
          <TransactionDetailEdit
            transaction={currentTransaction}
            accounts={accounts}
            onSave={handleSave}
            onCancel={handleCancelEdit}
            isLoading={actionInProgress}
            error={error || undefined}
          />
        )}
      </div>
    </Drawer>
  )
}
