/**
 * TransactionEditModal Component
 *
 * Global modal for editing transactions using the same user-friendly forms
 * as transaction creation. Supports all transaction types.
 */

import { type FC, useState, useEffect, useCallback } from 'react'
import { Modal } from '../modals/Modal'
import { ExpenseForm } from './ExpenseForm'
import { SimpleTransactionForm } from './SimpleTransactionForm'
import { useTransactionEdit, getFormTypeForTransaction } from '../../contexts/TransactionEditContext'
import { useTransactions } from '../../hooks/useTransactions'
import { useAccounts } from '../../hooks/useAccounts'
import { useFloatingCards } from '../../contexts/FloatingCardsContext'
import type { JournalEntry, TransactionType } from '../../types'

// SimpleTransactionForm uses a different type system
type SimpleFormType = 'spent' | 'received' | 'transfer' | 'paid-credit' | ''

/**
 * Map JournalEntry transaction type to SimpleTransactionForm type
 */
function mapToSimpleFormType(transactionType?: TransactionType): SimpleFormType {
  switch (transactionType) {
    case 'income':
    case 'deposit':
    case 'invoice':
    case 'invoice-payment':
      return 'received'
    case 'transfer':
      return 'transfer'
    case 'credit-card-payment':
    case 'liability-payment':
      return 'paid-credit'
    case 'expense':
    case 'check':
    case 'bill':
    case 'bill-payment':
    default:
      return 'spent'
  }
}

/**
 * Get modal title based on transaction type
 */
function getModalTitle(transactionType?: TransactionType): string {
  switch (transactionType) {
    case 'expense':
      return 'Edit Expense'
    case 'check':
      return 'Edit Check'
    case 'bill':
      return 'Edit Bill'
    case 'bill-payment':
      return 'Edit Bill Payment'
    case 'income':
      return 'Edit Income'
    case 'deposit':
      return 'Edit Deposit'
    case 'invoice':
      return 'Edit Invoice'
    case 'invoice-payment':
      return 'Edit Invoice Payment'
    case 'transfer':
      return 'Edit Transfer'
    case 'credit-card-payment':
      return 'Edit Credit Card Payment'
    case 'liability-payment':
      return 'Edit Liability Payment'
    default:
      return 'Edit Transaction'
  }
}

/**
 * Get header gradient based on transaction type
 */
function getHeaderGradient(transactionType?: TransactionType): string {
  switch (transactionType) {
    case 'expense':
    case 'check':
    case 'bill':
    case 'bill-payment':
      return 'linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)' // Rust
    case 'income':
    case 'deposit':
    case 'invoice':
    case 'invoice-payment':
      return 'linear-gradient(135deg, #1a4731 0%, #276749 100%)' // Forest Green
    case 'transfer':
      return 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)' // Royal Blue
    case 'credit-card-payment':
    case 'liability-payment':
      return 'linear-gradient(135deg, #4b006e 0%, #6b21a8 100%)' // Royal Purple
    default:
      return 'linear-gradient(135deg, #374151 0%, #1f2937 100%)' // Slate
  }
}

export const TransactionEditModal: FC = () => {
  const {
    editingTransaction,
    editingCompanyId,
    isEditOpen,
    closeEdit,
    onSaveCallback,
  } = useTransactionEdit()

  const { closeCard } = useFloatingCards()
  const { updateExistingTransaction, isLoading, error, clearError } = useTransactions()
  const { accounts, isLoading: accountsLoading } = useAccounts({
    companyId: editingCompanyId || '',
    isActive: true,
  })

  // Local state for the transaction being edited
  const [localTransaction, setLocalTransaction] = useState<JournalEntry | null>(null)

  // Sync local state when editing transaction changes
  useEffect(() => {
    if (editingTransaction) {
      setLocalTransaction(editingTransaction)
    }
  }, [editingTransaction])

  const handleChange = useCallback((transaction: JournalEntry) => {
    setLocalTransaction(transaction)
  }, [])

  const handleSave = useCallback(async (transactionToSave?: JournalEntry) => {
    const txn = transactionToSave || localTransaction
    if (!txn || !editingCompanyId) return

    const result = await updateExistingTransaction(txn.id, txn, editingCompanyId)
    if (result) {
      // Close the floating card if it was open
      closeCard(txn.id)

      // Call the save callback to refresh data
      onSaveCallback?.()

      // Close the edit modal
      closeEdit()
    }
  }, [localTransaction, editingCompanyId, updateExistingTransaction, closeCard, onSaveCallback, closeEdit])

  const handleCancel = useCallback(() => {
    clearError()
    closeEdit()
  }, [clearError, closeEdit])

  if (!isEditOpen || !editingTransaction || !localTransaction || !editingCompanyId) {
    return null
  }

  const formType = getFormTypeForTransaction(editingTransaction)
  const title = getModalTitle(editingTransaction.transactionType)
  const gradient = getHeaderGradient(editingTransaction.transactionType)

  return (
    <Modal
      isOpen={isEditOpen}
      onClose={handleCancel}
      title={title}
      size="lg"
      closeOnBackdropClick={false}
      headerStyle={{
        background: gradient,
        color: 'white',
      }}
    >
      {formType === 'expense' ? (
        <ExpenseForm
          transaction={localTransaction}
          accounts={accounts}
          companyId={editingCompanyId}
          onChange={handleChange}
          onSave={handleSave}
          onCancel={handleCancel}
          isLoading={isLoading || accountsLoading}
          error={error || undefined}
          defaultExpenseType={
            (editingTransaction.transactionType as 'expense' | 'check' | 'bill') || 'expense'
          }
        />
      ) : (
        <SimpleTransactionForm
          transaction={localTransaction}
          accounts={accounts}
          onChange={handleChange}
          onSave={handleSave}
          onCancel={handleCancel}
          isLoading={isLoading || accountsLoading}
          error={error || undefined}
          defaultTransactionType={mapToSimpleFormType(editingTransaction.transactionType)}
        />
      )}
    </Modal>
  )
}
