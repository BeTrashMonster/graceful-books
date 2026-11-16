/**
 * FloatingCardsPortal Component
 *
 * Renders all open floating transaction cards at the app level.
 * This allows cards to persist across page navigation.
 * Edit uses the global TransactionEditModal via context.
 */

import { type FC, useCallback, useEffect, useState } from 'react'
import { useFloatingCards } from '../../contexts/FloatingCardsContext'
import { useTransactionEdit } from '../../contexts/TransactionEditContext'
import { TransactionFloatingCard } from './TransactionFloatingCard'
import { Modal } from '../modals/Modal'
import { Button } from '../core/Button'
import { useTransactions } from '../../hooks/useTransactions'
import { useAccounts } from '../../hooks/useAccounts'
import { useVendors } from '../../hooks/useVendors'
import { useCustomers } from '../../hooks/useCustomers'
import type { Account } from '../../types'

/**
 * Balance sheet account types for reconciliation warnings
 */
const BALANCE_SHEET_TYPES: Account['type'][] = ['asset', 'liability', 'equity']

/**
 * Individual card wrapper that handles its own data loading and state
 */
interface CardWrapperProps {
  transactionId: string
  companyId: string
  runningBalance?: number
  cardIndex: number
  onClose: () => void
  onTransactionChanged: () => void
}

const CardWrapper: FC<CardWrapperProps> = ({
  transactionId,
  companyId,
  runningBalance,
  cardIndex,
  onClose,
  onTransactionChanged,
}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [_error, setError] = useState<string | null>(null) // Error state for actions
  const [actionInProgress, setActionInProgress] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showVoidConfirm, setShowVoidConfirm] = useState(false)

  const { openEdit, setOnSaveCallback } = useTransactionEdit()
  const { isStarred, toggleStar } = useFloatingCards()

  // Star state for this transaction
  const transactionIsStarred = isStarred(transactionId)
  const handleToggleStar = useCallback(() => {
    toggleStar(transactionId)
  }, [toggleStar, transactionId])

  const {
    currentTransaction,
    loadTransaction,
    voidTransaction,
    removeTransaction,
    error: hookError,
  } = useTransactions()

  const { accounts } = useAccounts({ companyId })
  const { vendors } = useVendors({ companyId })
  const { customers } = useCustomers({ companyId })

  // Load transaction on mount
  useEffect(() => {
    setIsLoading(true)
    setError(null)
    loadTransaction(transactionId, companyId)
      .then(() => setIsLoading(false))
      .catch((err) => {
        setError(err.message || 'Failed to load transaction')
        setIsLoading(false)
      })
  }, [transactionId, companyId, loadTransaction])

  // Get vendor/customer names
  const vendorName = currentTransaction?.vendorId
    ? vendors.find(v => v.id === currentTransaction.vendorId)?.name
    : undefined

  const customerName = currentTransaction?.customerId
    ? customers.find(c => c.id === currentTransaction.customerId)?.name
    : undefined

  // Check if has reconciled balance sheet lines
  const hasReconciledBalanceSheetLines = currentTransaction?.status === 'reconciled'
    && currentTransaction.lines.some(line => {
      if (!line.isLocked) return false
      const account = accounts.find(a => a.id === line.accountId)
      return account && BALANCE_SHEET_TYPES.includes(account.type)
    })

  // Handle Edit - open the global edit modal
  const handleEdit = useCallback(() => {
    if (!currentTransaction) return
    // Set up callback to refresh data after save
    setOnSaveCallback(onTransactionChanged)
    // Open the edit modal with the transaction
    openEdit(currentTransaction, companyId)
  }, [currentTransaction, companyId, openEdit, setOnSaveCallback, onTransactionChanged])

  const handleVoid = useCallback(() => setShowVoidConfirm(true), [])

  const confirmVoid = useCallback(async () => {
    if (!currentTransaction) return
    setShowVoidConfirm(false)
    setActionInProgress(true)
    try {
      const success = await voidTransaction(currentTransaction.id, companyId)
      if (success) {
        onTransactionChanged()
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to void transaction')
    } finally {
      setActionInProgress(false)
    }
  }, [currentTransaction, companyId, voidTransaction, onTransactionChanged, onClose])

  const handleDelete = useCallback(() => setShowDeleteConfirm(true), [])

  const confirmDelete = useCallback(async () => {
    if (!currentTransaction) return
    setShowDeleteConfirm(false)
    setActionInProgress(true)
    try {
      const success = await removeTransaction(currentTransaction.id, companyId)
      if (success) {
        onTransactionChanged()
        onClose()
      } else {
        setError(hookError || 'Failed to delete transaction')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete transaction')
    } finally {
      setActionInProgress(false)
    }
  }, [currentTransaction, companyId, removeTransaction, onTransactionChanged, onClose, hookError])

  return (
    <>
      <TransactionFloatingCard
        isOpen={!isLoading}
        onClose={onClose}
        transaction={currentTransaction}
        accounts={accounts}
        vendorName={vendorName}
        customerName={customerName}
        runningBalance={runningBalance}
        onEdit={handleEdit}
        onVoid={handleVoid}
        onDelete={handleDelete}
        actionsDisabled={actionInProgress}
        cardIndex={cardIndex}
        isStarred={transactionIsStarred}
        onToggleStar={handleToggleStar}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Transaction"
        size="sm"
        headerStyle={{
          background: 'linear-gradient(135deg, #742a2a 0%, #9b2c2c 100%)',
          color: 'white',
        }}
        footer={
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={actionInProgress}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={actionInProgress}>
              {actionInProgress ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        }
      >
        <div style={{ padding: '0.5rem 0' }}>
          {hasReconciledBalanceSheetLines ? (
            <>
              <p style={{ marginBottom: '1rem', fontWeight: 500 }}>
                This transaction contains reconciled accounts.
              </p>
              <p style={{ color: '#6b7280' }}>
                Deleting it will affect your reconciliation records.
              </p>
            </>
          ) : (
            <p>Are you sure? This action cannot be undone.</p>
          )}
        </div>
      </Modal>

      {/* Void Confirmation Modal */}
      <Modal
        isOpen={showVoidConfirm}
        onClose={() => setShowVoidConfirm(false)}
        title="Void Transaction"
        size="sm"
        headerStyle={{
          background: 'linear-gradient(135deg, #92400e 0%, #b45309 100%)',
          color: 'white',
        }}
        footer={
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setShowVoidConfirm(false)} disabled={actionInProgress}>
              Cancel
            </Button>
            <Button variant="gold" onClick={confirmVoid} disabled={actionInProgress}>
              {actionInProgress ? 'Voiding...' : 'Void'}
            </Button>
          </div>
        }
      >
        <div style={{ padding: '0.5rem 0' }}>
          <p>This will create a reversing entry and cannot be undone.</p>
        </div>
      </Modal>
    </>
  )
}

/**
 * Portal component that renders all open floating cards
 */
export const FloatingCardsPortal: FC = () => {
  const { openCards, closeCard, getCardIndex, notifyTransactionChanged } = useFloatingCards()

  const handleTransactionChanged = useCallback((transactionId: string) => {
    notifyTransactionChanged(transactionId)
  }, [notifyTransactionChanged])

  // Convert map to array for rendering
  const cardsArray = Array.from(openCards.entries())

  if (cardsArray.length === 0) return null

  return (
    <>
      {cardsArray.map(([transactionId, card]) => (
        <CardWrapper
          key={transactionId}
          transactionId={transactionId}
          companyId={card.companyId}
          runningBalance={card.runningBalance}
          cardIndex={getCardIndex(transactionId)}
          onClose={() => closeCard(transactionId)}
          onTransactionChanged={() => handleTransactionChanged(transactionId)}
        />
      ))}
    </>
  )
}
