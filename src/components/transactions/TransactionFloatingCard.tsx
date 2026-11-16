/**
 * TransactionFloatingCard Component
 *
 * A draggable floating card that shows transaction details in a user-friendly way.
 * Shows three clear sections:
 * 1. Money Account - Bank, credit card, cash (where money physically moves)
 * 2. Holding Accounts - A/P, A/R, Undeposited Funds (pending/linked items)
 * 3. Categories - What the transaction is for (expense/income)
 */

import { type FC, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { JournalEntry, Account, TransactionType } from '../../types'
import { formatDate } from '../../utils/formatting'
import { formatMoney } from '../../utils/money'
import { Button } from '../core/Button'
import { TransactionStatusBadge } from './TransactionStatusBadge'
import { TransactionTypeBadge } from './TransactionTypeBadge'
import styles from './TransactionFloatingCard.module.css'

/**
 * Transaction types that show vendor
 */
const VENDOR_TYPES: TransactionType[] = ['expense', 'check', 'bill', 'bill-payment']

/**
 * Transaction types that show customer
 */
const CUSTOMER_TYPES: TransactionType[] = ['income', 'deposit', 'invoice', 'invoice-payment']

/**
 * Holding/middleman account patterns
 */
const HOLDING_PATTERNS = ['accounts payable', 'accounts receivable', 'undeposited funds', 'a/p', 'a/r']

/**
 * Money account patterns (banks, credit cards, cash)
 */
const MONEY_ACCOUNT_PATTERNS = ['checking', 'savings', 'bank', 'credit card', 'cash', 'petty cash', 'paypal', 'venmo', 'stripe']

/**
 * Make memo text user-friendly
 */
function friendlyMemo(memo: string | undefined): string | undefined {
  if (!memo) return undefined

  const lower = memo.toLowerCase()

  if (lower.includes('discrepancy') && lower.includes('adjustment')) {
    return 'Difference applied here'
  }
  if (lower.includes('payment discrepancy')) {
    return 'Remaining balance'
  }

  return memo
}

/**
 * Check if account is a holding/middleman account (A/P, A/R, Undeposited)
 */
function isHoldingAccount(account: Account): boolean {
  const nameLower = account.name.toLowerCase()
  return HOLDING_PATTERNS.some(p => nameLower.includes(p))
}

/**
 * Check if account is a money account (bank, credit card, cash)
 */
function isMoneyAccount(account: Account): boolean {
  // Assets that aren't holding accounts are usually money accounts
  if (account.type === 'asset') {
    const nameLower = account.name.toLowerCase()
    // Check if it matches money patterns
    if (MONEY_ACCOUNT_PATTERNS.some(p => nameLower.includes(p))) {
      return true
    }
    // Also include if it has a 4-digit suffix (like account number) - common for bank accounts
    if (/\d{4}$/.test(account.name)) {
      return true
    }
    // If it's an asset but not a holding account, likely a money account
    return !isHoldingAccount(account)
  }
  // Credit cards are liabilities but still money accounts
  if (account.type === 'liability') {
    const nameLower = account.name.toLowerCase()
    return nameLower.includes('credit card') || nameLower.includes('credit-card') || /\d{4}$/.test(account.name)
  }
  return false
}

/**
 * Get holding account type for display
 */
function getHoldingType(account: Account): 'ap' | 'ar' | 'undeposited' | null {
  const nameLower = account.name.toLowerCase()
  if (nameLower.includes('accounts payable') || nameLower.includes('a/p')) return 'ap'
  if (nameLower.includes('accounts receivable') || nameLower.includes('a/r')) return 'ar'
  if (nameLower.includes('undeposited')) return 'undeposited'
  return null
}

export interface TransactionFloatingCardProps {
  isOpen: boolean
  onClose: () => void
  transaction: JournalEntry | null
  accounts: Account[]
  vendorName?: string
  customerName?: string
  runningBalance?: number
  onEdit?: () => void
  onVoid?: () => void
  onDelete?: () => void
  actionsDisabled?: boolean
  /** Index for staggering multiple open cards */
  cardIndex?: number
  /** Whether transaction is starred */
  isStarred?: boolean
  /** Toggle star on transaction */
  onToggleStar?: () => void
}

export const TransactionFloatingCard: FC<TransactionFloatingCardProps> = ({
  isOpen,
  onClose,
  transaction,
  accounts,
  vendorName,
  customerName,
  runningBalance,
  onEdit,
  onVoid,
  onDelete,
  actionsDisabled = false,
  cardIndex = 0,
  isStarred = false,
  onToggleStar,
}) => {
  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Reset position when opening, stagger based on cardIndex
  useEffect(() => {
    if (isOpen) {
      // Stagger cards horizontally
      setPosition({ x: cardIndex * 30, y: cardIndex * 20 })
    }
  }, [isOpen, cardIndex])

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return

    setIsDragging(true)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    }
    e.preventDefault()
  }, [position])

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return

      const deltaX = e.clientX - dragRef.current.startX
      const deltaY = e.clientY - dragRef.current.startY

      setPosition({
        x: dragRef.current.startPosX + deltaX,
        y: dragRef.current.startPosY + deltaY,
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Account lookup
  const accountMap = useMemo(() => {
    return new Map(accounts.map(a => [a.id, a]))
  }, [accounts])

  // Separate line items into three clear sections:
  // 1. Money accounts (bank, credit card, cash)
  // 2. Holding accounts (A/P, A/R, Undeposited)
  // 3. Categories (expense/income accounts)
  const { moneyAccounts, holdingAccounts, categories, totalAmount } = useMemo(() => {
    if (!transaction) return { moneyAccounts: [], holdingAccounts: [], categories: [], totalAmount: 0 }

    interface LineInfo {
      account: Account
      amount: number
      memo?: string
      holdingType?: 'ap' | 'ar' | 'undeposited'
    }

    const money: LineInfo[] = []
    const holding: LineInfo[] = []
    const cats: LineInfo[] = []
    let total = 0

    transaction.lines.forEach(line => {
      const account = accountMap.get(line.accountId)
      if (!account) return

      const amount = line.debit || line.credit || 0
      total += line.debit || 0

      const info: LineInfo = {
        account,
        amount,
        memo: friendlyMemo(line.memo),
      }

      // Check if it's a holding account first
      const holdingType = getHoldingType(account)
      if (holdingType) {
        holding.push({ ...info, holdingType })
      } else if (isMoneyAccount(account)) {
        money.push(info)
      } else {
        // Everything else is a category (expense/income/etc)
        cats.push(info)
      }
    })

    return { moneyAccounts: money, holdingAccounts: holding, categories: cats, totalAmount: total }
  }, [transaction, accountMap])

  if (!isOpen || !transaction) return null

  const showVendor = transaction.transactionType && VENDOR_TYPES.includes(transaction.transactionType)
  const showCustomer = transaction.transactionType && CUSTOMER_TYPES.includes(transaction.transactionType)
  const isVoided = transaction.status === 'void'
  const canVoid = transaction.status === 'posted'
  const canEdit = !isVoided

  // Get user-friendly labels based on transaction type
  const getMoneyLabel = () => {
    switch (transaction.transactionType) {
      case 'expense':
      case 'check':
      case 'bill-payment':
        return 'Paid From'
      case 'income':
      case 'deposit':
      case 'invoice-payment':
        return 'Deposited To'
      case 'transfer':
        return 'From Account'
      case 'credit-card-payment':
      case 'liability-payment':
        return 'Paid From'
      default:
        return 'Account'
    }
  }

  const getHoldingLabel = () => {
    // For holding accounts, label based on type
    if (holdingAccounts.length === 0) return ''

    const holdingType = holdingAccounts[0]?.holdingType
    switch (transaction.transactionType) {
      case 'bill':
        return 'Creates Obligation'
      case 'bill-payment':
        return 'Pays Off Bills'
      case 'invoice':
        return 'Awaiting Payment'
      case 'invoice-payment':
        return 'From Invoices'
      default:
        if (holdingType === 'ap') return 'Accounts Payable'
        if (holdingType === 'ar') return 'Accounts Receivable'
        if (holdingType === 'undeposited') return 'Pending Deposit'
        return 'Pending'
    }
  }

  const getCategoryLabel = () => {
    switch (transaction.transactionType) {
      case 'expense':
      case 'check':
      case 'bill':
      case 'bill-payment':
        return 'For'
      case 'income':
      case 'deposit':
      case 'invoice':
      case 'invoice-payment':
        return 'From'
      default:
        return 'Category'
    }
  }

  // Get detail text for holding accounts
  const getHoldingDetail = (holdingType?: 'ap' | 'ar' | 'undeposited') => {
    if (!holdingType) return null

    switch (holdingType) {
      case 'ap':
        if (transaction.linkedTransactionId) {
          return `Bill #${transaction.reference || transaction.linkedTransactionId.slice(0, 8)}`
        }
        return transaction.transactionType === 'bill' ? 'Bill pending payment' : 'From bill'
      case 'ar':
        if (transaction.linkedTransactionId) {
          return `Invoice #${transaction.reference || transaction.linkedTransactionId.slice(0, 8)}`
        }
        return transaction.transactionType === 'invoice' ? 'Invoice pending payment' : 'From invoice'
      case 'undeposited':
        return 'Awaiting deposit'
      default:
        return null
    }
  }

  // Determine visual order - money first for payments, holding first for bills/invoices
  const showMoneyFirst = ['expense', 'check', 'bill-payment', 'income', 'deposit', 'invoice-payment', 'transfer'].includes(transaction.transactionType || '')
  const hasMoneyAccounts = moneyAccounts.length > 0
  const hasHoldingAccounts = holdingAccounts.length > 0
  const hasCategories = categories.length > 0

  const card = (
    <div className={styles.overlay}>
      <div
        ref={cardRef}
        className={styles.card}
        style={{
          transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)`,
          cursor: isDragging ? 'grabbing' : 'grab',
          zIndex: 1000 + cardIndex,
        }}
        onMouseDown={handleDragStart}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.badges}>
              {transaction.transactionType && (
                <TransactionTypeBadge type={transaction.transactionType} />
              )}
              <TransactionStatusBadge status={transaction.status} />
            </div>
          </div>
          <div className={styles.headerActions}>
            {onToggleStar && (
              <button
                type="button"
                className={`${styles.starButton} ${isStarred ? styles.starred : ''}`}
                onClick={onToggleStar}
                title={isStarred ? 'Remove highlight' : 'Highlight this transaction'}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill={isStarred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
            )}
            <button type="button" className={styles.closeButton} onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Voided warning */}
        {isVoided && (
          <div className={styles.voidedBanner}>
            This transaction has been voided
          </div>
        )}

        {/* Content */}
        <div className={styles.content}>
          {/* Left: Details */}
          <div className={styles.detailsColumn}>
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
              <div className={`${styles.detailRow} ${styles.memoRow}`}>
                <span className={styles.detailLabel}>Memo</span>
                <span className={styles.memoValue}>
                  {transaction.memo}
                </span>
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
          </div>

          {/* Right: Line Items + Balances */}
          <div className={styles.lineItemsColumn}>
            {/* Balance Summary */}
            <div className={styles.balanceSummary}>
              {runningBalance !== undefined && (
                <div className={styles.balanceRow}>
                  <span className={styles.balanceLabel}>Account Balance</span>
                  <span className={styles.balanceValue}>{formatMoney(runningBalance)}</span>
                </div>
              )}
              <div className={styles.balanceRow}>
                <span className={styles.balanceLabel}>Transaction Total</span>
                <span className={styles.totalValue}>{formatMoney(totalAmount)}</span>
              </div>
            </div>

            {/* Money Accounts - Bank/Credit Card (shown first for payments) */}
            {showMoneyFirst && hasMoneyAccounts && (
              <div className={`${styles.lineSection} ${styles.moneySection}`}>
                <div className={styles.lineSectionLabel}>
                  <span className={styles.sectionIcon}>
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                      <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                    </svg>
                  </span>
                  {getMoneyLabel()}
                </div>
                {moneyAccounts.map((item, idx) => (
                  <div key={idx} className={styles.lineItem}>
                    <div className={styles.lineAccountWrapper}>
                      <span className={styles.lineAccount}>
                        {item.account.accountNumber && `${item.account.accountNumber} - `}
                        {item.account.name}
                      </span>
                    </div>
                    <span className={styles.lineAmount}>{formatMoney(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Holding Accounts - A/P, A/R, Undeposited */}
            {hasHoldingAccounts && (
              <div className={`${styles.lineSection} ${styles.holdingSection}`}>
                <div className={styles.lineSectionLabel}>
                  <span className={styles.sectionIcon}>
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clipRule="evenodd" />
                    </svg>
                  </span>
                  {getHoldingLabel()}
                </div>
                {holdingAccounts.map((item, idx) => {
                  const detail = getHoldingDetail(item.holdingType)
                  return (
                    <div key={idx} className={styles.lineItem}>
                      <div className={styles.lineAccountWrapper}>
                        <span className={styles.lineAccount}>
                          {item.account.accountNumber && `${item.account.accountNumber} - `}
                          {item.account.name}
                        </span>
                        {detail && (
                          <span className={styles.linkedRef}>{detail}</span>
                        )}
                      </div>
                      <span className={styles.lineAmount}>{formatMoney(item.amount)}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Money Accounts - shown after holding for bills/invoices */}
            {!showMoneyFirst && hasMoneyAccounts && (
              <div className={`${styles.lineSection} ${styles.moneySection}`}>
                <div className={styles.lineSectionLabel}>
                  <span className={styles.sectionIcon}>
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                      <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                    </svg>
                  </span>
                  {getMoneyLabel()}
                </div>
                {moneyAccounts.map((item, idx) => (
                  <div key={idx} className={styles.lineItem}>
                    <div className={styles.lineAccountWrapper}>
                      <span className={styles.lineAccount}>
                        {item.account.accountNumber && `${item.account.accountNumber} - `}
                        {item.account.name}
                      </span>
                    </div>
                    <span className={styles.lineAmount}>{formatMoney(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Flow Arrow - visual connection between sections */}
            {(hasMoneyAccounts || hasHoldingAccounts) && hasCategories && (
              <div className={styles.flowArrow}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a1 1 0 01-.707-.293l-5-5a1 1 0 011.414-1.414L9 14.586V3a1 1 0 112 0v11.586l3.293-3.293a1 1 0 011.414 1.414l-5 5A1 1 0 0110 18z" clipRule="evenodd" />
                </svg>
              </div>
            )}

            {/* Categories - What it's for */}
            {hasCategories && (
              <div className={`${styles.lineSection} ${styles.categorySection}`}>
                <div className={styles.lineSectionLabel}>
                  <span className={styles.sectionIcon}>
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </span>
                  {getCategoryLabel()}
                </div>
                {categories.map((item, idx) => (
                  <div key={idx} className={styles.lineItem}>
                    <div className={styles.lineAccountWrapper}>
                      <span className={styles.lineAccount}>
                        {item.account.accountNumber && `${item.account.accountNumber} - `}
                        {item.account.name}
                      </span>
                      {item.memo && (
                        <span className={styles.lineMemo}>{item.memo}</span>
                      )}
                    </div>
                    <span className={styles.lineAmount}>{formatMoney(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {onEdit && canEdit && (
            <Button variant="outline" size="sm" onClick={onEdit} disabled={actionsDisabled}>
              Edit
            </Button>
          )}
          {onVoid && canVoid && (
            <Button variant="outline" size="sm" onClick={onVoid} disabled={actionsDisabled} className={styles.voidButton}>
              Void
            </Button>
          )}
          {onDelete && (
            <Button variant="outline" size="sm" onClick={onDelete} disabled={actionsDisabled} className={styles.deleteButton}>
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(card, document.body)
}
