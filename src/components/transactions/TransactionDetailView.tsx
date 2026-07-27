/**
 * TransactionDetailView Component
 *
 * Read-only view of transaction details including:
 * - Header with type and status badges
 * - Transaction details (date, reference, memo, vendor/customer)
 * - Line items table with reconciliation indicators
 * - Running balance
 * - Discreet audit trail (collapsible)
 * - Action buttons (Edit, Void, Delete)
 */

import { type FC, useState, useMemo } from 'react'
import type { JournalEntry, Account, TransactionType } from '../../types'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatting'
import { Button } from '../core/Button'
import { TransactionStatusBadge } from './TransactionStatusBadge'
import { TransactionTypeBadge } from './TransactionTypeBadge'
import { TransactionLineItemsTable } from './TransactionLineItemsTable'
import styles from './TransactionDetailView.module.css'

/**
 * Transaction types that show vendor
 */
const VENDOR_TYPES: TransactionType[] = ['expense', 'check', 'bill', 'bill-payment']

/**
 * Transaction types that show customer
 */
const CUSTOMER_TYPES: TransactionType[] = ['income', 'deposit', 'invoice', 'invoice-payment']

/**
 * Balance sheet account types
 */
const BALANCE_SHEET_TYPES: Account['type'][] = ['asset', 'liability', 'equity']

export interface TransactionDetailViewProps {
  /**
   * Transaction to display
   */
  transaction: JournalEntry
  /**
   * All accounts for name lookup
   */
  accounts: Account[]
  /**
   * Vendor name (if applicable)
   */
  vendorName?: string
  /**
   * Customer name (if applicable)
   */
  customerName?: string
  /**
   * Running balance at this transaction (optional)
   */
  runningBalance?: number
  /**
   * Called when Edit button is clicked
   */
  onEdit?: () => void
  /**
   * Called when Void button is clicked
   */
  onVoid?: () => void
  /**
   * Called when Delete button is clicked
   */
  onDelete?: () => void
  /**
   * Called when a line's lock state is toggled
   */
  onToggleLock?: (lineId: string) => void
  /**
   * Whether actions are disabled (e.g., during loading)
   */
  actionsDisabled?: boolean
}

export const TransactionDetailView: FC<TransactionDetailViewProps> = ({
  transaction,
  accounts,
  vendorName,
  customerName,
  runningBalance,
  onEdit,
  onVoid,
  onDelete,
  onToggleLock,
  actionsDisabled = false,
}) => {
  const [showAuditDetails, setShowAuditDetails] = useState(false)

  // Determine what context info to show
  const showVendor = transaction.transactionType && VENDOR_TYPES.includes(transaction.transactionType)
  const showCustomer = transaction.transactionType && CUSTOMER_TYPES.includes(transaction.transactionType)

  // Check action availability
  const isVoided = transaction.status === 'void'
  const isReconciled = transaction.status === 'reconciled'
  const canVoid = transaction.status === 'posted'
  const canEdit = !isVoided

  // Calculate total amount
  const totalAmount = useMemo(() => {
    return transaction.lines.reduce((sum, line) => sum + (line.debit || 0), 0)
  }, [transaction.lines])

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.badges}>
          {transaction.transactionType && (
            <TransactionTypeBadge type={transaction.transactionType} />
          )}
          <TransactionStatusBadge status={transaction.status} />
        </div>
        <div className={styles.amount}>
          {formatCurrency(totalAmount)}
        </div>
      </div>

      {/* Details Grid */}
      <div className={styles.details}>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Date</span>
          <span className={styles.detailValue}>{formatDate(transaction.date)}</span>
        </div>

        {transaction.reference && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Reference</span>
            <span className={styles.detailValue}>{transaction.reference}</span>
          </div>
        )}

        {transaction.memo && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Memo</span>
            <span className={styles.detailValue}>{transaction.memo}</span>
          </div>
        )}

        {showVendor && vendorName && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Vendor</span>
            <span className={styles.detailValue}>{vendorName}</span>
          </div>
        )}

        {showCustomer && customerName && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Customer</span>
            <span className={styles.detailValue}>{customerName}</span>
          </div>
        )}

        {runningBalance !== undefined && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Running Balance</span>
            <span className={styles.detailValue}>
              <strong>{formatCurrency(runningBalance)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Line Items</h3>
        <TransactionLineItemsTable
          lines={transaction.lines}
          accounts={accounts}
          mode="view"
          isReconciled={isReconciled}
          onToggleLock={onToggleLock}
        />
      </div>

      {/* Discreet Audit Trail */}
      <div className={styles.auditSection}>
        <button
          type="button"
          className={styles.auditToggle}
          onClick={() => setShowAuditDetails(!showAuditDetails)}
          aria-expanded={showAuditDetails}
        >
          {showAuditDetails ? 'Hide details' : 'View details'}
          <svg
            className={`${styles.chevron} ${showAuditDetails ? styles.chevronUp : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {showAuditDetails && (
          <div className={styles.auditDetails}>
            <div className={styles.auditRow}>
              <span className={styles.auditLabel}>Created</span>
              <span className={styles.auditValue}>
                {formatDateTime(transaction.createdAt)}
                {transaction.createdBy && ` by ${transaction.createdBy}`}
              </span>
            </div>
            <div className={styles.auditRow}>
              <span className={styles.auditLabel}>Last Updated</span>
              <span className={styles.auditValue}>
                {formatDateTime(transaction.updatedAt)}
              </span>
            </div>
            <div className={styles.auditRow}>
              <span className={styles.auditLabel}>ID</span>
              <span className={styles.auditValue}>
                <code className={styles.idCode}>{transaction.id}</code>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {!isVoided && (
        <div className={styles.actions}>
          {onEdit && canEdit && (
            <Button
              variant="outline"
              onClick={onEdit}
              disabled={actionsDisabled}
            >
              Edit
            </Button>
          )}

          {onVoid && canVoid && (
            <Button
              variant="outline"
              onClick={onVoid}
              disabled={actionsDisabled}
              className={styles.voidButton}
            >
              Void
            </Button>
          )}

          {onDelete && (
            <Button
              variant="outline"
              onClick={onDelete}
              disabled={actionsDisabled}
              className={styles.deleteButton}
            >
              Delete
            </Button>
          )}
        </div>
      )}

      {/* Voided message */}
      {isVoided && (
        <div className={styles.voidedMessage}>
          This transaction has been voided and cannot be modified.
        </div>
      )}
    </div>
  )
}
