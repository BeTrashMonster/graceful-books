import { useState, useMemo } from 'react'
import clsx from 'clsx'
import type { Receipt } from '../../types'
import { Button } from '../core/Button'
import { Modal } from '../modals/Modal'
import { Input } from '../forms/Input'
import styles from './ReceiptLinkModal.module.css'

export interface Transaction {
  id: string
  date: Date
  reference?: string
  memo?: string
  totalAmount: number
}

export interface ReceiptLinkModalProps {
  /**
   * Receipt to link
   */
  receipt: Receipt | null
  /**
   * Available transactions
   */
  transactions: Transaction[]
  /**
   * Whether the modal is open
   */
  isOpen: boolean
  /**
   * Callback when modal should close
   */
  onClose: () => void
  /**
   * Callback when transaction is selected
   */
  onLink: (transactionId: string) => void
  /**
   * Callback when unlink is clicked
   */
  onUnlink?: () => void
  /**
   * Whether linking is in progress
   */
  isLoading?: boolean
}

/**
 * Receipt Link Modal Component
 *
 * Features:
 * - Search transactions by date/amount/reference
 * - Suggest likely matches based on date proximity
 * - Allow manual selection
 * - Unlink option for linked receipts
 * - Accessibility compliant
 *
 * @example
 * ```tsx
 * <ReceiptLinkModal
 *   receipt={receipt}
 *   transactions={transactions}
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   onLink={handleLink}
 *   onUnlink={handleUnlink}
 * />
 * ```
 */
export const ReceiptLinkModal = ({
  receipt,
  transactions,
  isOpen,
  onClose,
  onLink,
  onUnlink,
  isLoading = false,
}: ReceiptLinkModalProps) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let filtered = transactions

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (txn) =>
          txn.reference?.toLowerCase().includes(term) ||
          txn.memo?.toLowerCase().includes(term) ||
          txn.totalAmount.toString().includes(term)
      )
    }

    // Sort by date proximity to receipt upload date if no search
    if (!searchTerm && receipt) {
      const receiptDate = new Date(receipt.uploadDate).getTime()
      filtered = [...filtered].sort((a, b) => {
        const aDiff = Math.abs(new Date(a.date).getTime() - receiptDate)
        const bDiff = Math.abs(new Date(b.date).getTime() - receiptDate)
        return aDiff - bDiff
      })
    } else {
      // Sort by date descending
      filtered = [...filtered].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
    }

    return filtered
  }, [transactions, searchTerm, receipt])

  const handleLink = () => {
    if (selectedId) {
      onLink(selectedId)
      setSelectedId(null)
      setSearchTerm('')
    }
  }

  const handleUnlink = () => {
    if (onUnlink) {
      onUnlink()
      setSelectedId(null)
      setSearchTerm('')
    }
  }

  const handleCancel = () => {
    setSelectedId(null)
    setSearchTerm('')
    onClose()
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const getDaysDifference = (date1: Date, date2: Date) => {
    const diff = Math.abs(new Date(date1).getTime() - new Date(date2).getTime())
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }

  if (!receipt) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Link Receipt to Transaction"
      size="lg"
      footer={
        <div className={styles.footer}>
          <Button variant="secondary" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          {receipt.transactionId && onUnlink && (
            <Button
              variant="ghost"
              onClick={handleUnlink}
              disabled={isLoading}
              className={styles.unlinkButton}
            >
              Unlink
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleLink}
            disabled={!selectedId || isLoading}
          >
            {isLoading ? 'Linking...' : 'Link Transaction'}
          </Button>
        </div>
      }
    >
      <div className={styles.content}>
        <div className={styles.receiptInfo}>
          <h3 className={styles.receiptTitle}>{receipt.fileName}</h3>
          <p className={styles.receiptDate}>
            Uploaded: {formatDate(receipt.uploadDate)}
          </p>
        </div>

        <Input
          type="search"
          placeholder="Search transactions by reference, memo, or amount..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
          aria-label="Search transactions"
        />

        {filteredTransactions.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyIcon} aria-hidden="true">
              🔍
            </p>
            <p className={styles.emptyMessage}>
              {searchTerm
                ? 'No transactions match your search.'
                : 'No transactions available.'}
            </p>
          </div>
        ) : (
          <div className={styles.transactionList} role="listbox" aria-label="Transactions">
            {filteredTransactions.map((txn, index) => {
              const isSelected = selectedId === txn.id
              const isLinked = receipt.transactionId === txn.id
              const daysDiff = getDaysDifference(txn.date, receipt.uploadDate)
              const isSuggested = !searchTerm && index < 3 && daysDiff <= 7

              return (
                <button
                  key={txn.id}
                  type="button"
                  className={clsx(
                    styles.transactionItem,
                    isSelected && styles.selected,
                    isLinked && styles.linked
                  )}
                  onClick={() => setSelectedId(txn.id)}
                  role="option"
                  aria-selected={isSelected}
                  disabled={isLoading}
                >
                  <div className={styles.transactionHeader}>
                    <span className={styles.transactionDate}>{formatDate(txn.date)}</span>
                    {isSuggested && (
                      <span className={styles.suggestedBadge}>Suggested</span>
                    )}
                    {isLinked && (
                      <span className={styles.linkedBadge}>Currently Linked</span>
                    )}
                  </div>
                  {txn.reference && (
                    <p className={styles.transactionReference}>{txn.reference}</p>
                  )}
                  {txn.memo && <p className={styles.transactionMemo}>{txn.memo}</p>}
                  <p className={styles.transactionAmount}>{formatAmount(txn.totalAmount)}</p>
                  {isSuggested && (
                    <p className={styles.transactionHint}>
                      Within {daysDiff} {daysDiff === 1 ? 'day' : 'days'} of receipt
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
