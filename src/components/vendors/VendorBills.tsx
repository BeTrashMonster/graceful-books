/**
 * VendorBills Component
 *
 * Displays bills and bill payments from transactions.
 * Part of the Vendors page tabbed interface.
 *
 * Features:
 * - List bills from vendors with status indicators
 * - Filter by status (Posted, Paid, Overdue, Void)
 * - Search by reference or description
 * - Shows bill payments and their links
 * - WCAG 2.1 AA accessible
 *
 * Per E6: Bill Entry & Management
 */

import { type FC, useState, useEffect, useMemo, useCallback } from 'react'
import { Input } from '../forms/Input'
import { Select, type SelectOption } from '../forms/Select'
import { Button } from '../core/Button'
import { Modal } from '../modals/Modal'
import { ExpenseForm } from '../transactions/ExpenseForm'
import { BillPaidForm } from '../transactions/BillPaidForm'
import { useTransactions, useNewTransaction } from '../../hooks/useTransactions'
import { useAccounts } from '../../hooks/useAccounts'
import { useVendors } from '../../hooks/useVendors'
import { useAuth } from '../../contexts/AuthContext'
import { useFloatingCards } from '../../contexts/FloatingCardsContext'
import type { JournalEntry } from '../../types'
import { formatMoney } from '../../utils/money'
import styles from './VendorBills.module.css'

export interface VendorBillsProps {
  /**
   * Current company ID
   */
  companyId: string

  /**
   * Optional vendor ID to filter bills
   */
  vendorId?: string
}

type BillStatusFilter = 'all' | 'unpaid' | 'paid' | 'overdue' | 'voided'

type BillSortColumn = 'date' | 'vendor' | 'ref' | 'description' | 'amount' | 'status'
type SortDirection = 'asc' | 'desc'

type BillsViewMode = 'outstanding' | 'all'

/**
 * Format date
 */
function formatDate(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Check if a bill is overdue (due date is BEFORE today, not equal to today)
 */
function isBillOverdue(bill: JournalEntry): boolean {
  if (bill.status === 'reconciled') return false // Paid
  if (bill.status === 'void') return false // Voided
  if (!bill.dueDate) return false
  const dueDate = bill.dueDate instanceof Date ? bill.dueDate : new Date(bill.dueDate)
  // Compare dates only (not time) - overdue means due date is strictly before today
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDateStart = new Date(dueDate)
  dueDateStart.setHours(0, 0, 0, 0)
  return dueDateStart < today
}

/**
 * Get bill status for display
 */
function getBillStatus(bill: JournalEntry): string {
  if (bill.status === 'void') return 'Voided'
  if (bill.status === 'reconciled') return 'Paid'
  if (isBillOverdue(bill)) return 'Overdue'
  return 'Unpaid'
}

/**
 * Get status class for styling
 */
function getStatusClass(status: string): string {
  switch (status) {
    case 'Paid':
      return styles.statusPaid
    case 'Overdue':
      return styles.statusOverdue
    case 'Voided':
      return styles.statusVoid
    default:
      return styles.statusDue
  }
}

/**
 * VendorBills Component
 */
export const VendorBills: FC<VendorBillsProps> = ({
  companyId,
  vendorId,
}) => {
  const { userIdentifier } = useAuth()
  const activeUserId = userIdentifier || 'demo-user'

  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<BillStatusFilter>('all')
  const [viewMode, setViewMode] = useState<BillsViewMode>('outstanding')

  // Sort state for bills
  const [billsSortColumn, setBillsSortColumn] = useState<BillSortColumn>('date')
  const [billsSortDirection, setBillsSortDirection] = useState<SortDirection>('desc')

  // Sort state for payments
  const [paymentsSortColumn, setPaymentsSortColumn] = useState<BillSortColumn>('date')
  const [paymentsSortDirection, setPaymentsSortDirection] = useState<SortDirection>('desc')

  // Modal state for creating bills/payments
  const [showBillModal, setShowBillModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [currentTransaction, setCurrentTransaction] = useState<JournalEntry | null>(null)

  // Expanded payment IDs to show linked bills
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set())

  // Hooks
  const { transactions, isLoading, loadTransactions, createNewTransaction } = useTransactions()
  const { accounts, isLoading: accountsLoading } = useAccounts({
    companyId,
    isActive: true,
  })
  const { vendors } = useVendors({ companyId })
  const { toggleCard, isCardOpen, isStarred, toggleStar, subscribeToChanges } = useFloatingCards()

  // Load transactions on mount
  useEffect(() => {
    loadTransactions({ companyId })
  }, [loadTransactions, companyId])

  // Subscribe to floating card changes to refresh
  useEffect(() => {
    const unsubscribe = subscribeToChanges(async () => {
      await loadTransactions({ companyId })
    })
    return unsubscribe
  }, [subscribeToChanges, loadTransactions, companyId])

  // Build vendor lookup map
  const vendorMap = useMemo(() => {
    const map = new Map<string, string>()
    vendors.forEach((v) => map.set(v.id, v.name))
    return map
  }, [vendors])

  // Filter transactions to only bills and bill-payments
  const billTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      // Filter by transaction type
      if (txn.transactionType !== 'bill' && txn.transactionType !== 'bill-payment') {
        return false
      }
      // Filter by vendor if specified
      if (vendorId && txn.vendorId !== vendorId) {
        return false
      }
      return true
    })
  }, [transactions, vendorId])

  // Separate bills and payments
  const bills = useMemo(() => {
    return billTransactions.filter((txn) => txn.transactionType === 'bill')
  }, [billTransactions])

  const payments = useMemo(() => {
    return billTransactions.filter((txn) => txn.transactionType === 'bill-payment')
  }, [billTransactions])

  // Helper to get sortable value from a bill
  const getSortValue = useCallback((bill: JournalEntry, column: BillSortColumn): string | number => {
    switch (column) {
      case 'date':
        return bill.date instanceof Date ? bill.date.getTime() : new Date(bill.date).getTime()
      case 'vendor':
        return vendorMap.get(bill.vendorId || '')?.toLowerCase() || ''
      case 'ref':
        return bill.reference?.toLowerCase() || ''
      case 'description':
        return (bill.description || bill.memo || '').toLowerCase()
      case 'amount':
        return bill.lines.reduce((sum, l) => sum + (l.debit || 0), 0)
      case 'status':
        return getBillStatus(bill)
      default:
        return 0
    }
  }, [vendorMap])

  // Filter and search bills
  const filteredBills = useMemo(() => {
    let filtered = [...bills]

    // View mode filter - outstanding only shows unpaid/overdue
    if (viewMode === 'outstanding') {
      filtered = filtered.filter((bill) => {
        const status = getBillStatus(bill)
        return status === 'Unpaid' || status === 'Overdue'
      })
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (bill) =>
          bill.reference?.toLowerCase().includes(term) ||
          bill.description?.toLowerCase().includes(term) ||
          bill.memo?.toLowerCase().includes(term) ||
          vendorMap.get(bill.vendorId || '')?.toLowerCase().includes(term)
      )
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter((bill) => {
        const status = getBillStatus(bill)
        switch (filterStatus) {
          case 'unpaid':
            return status === 'Unpaid'
          case 'paid':
            return status === 'Paid'
          case 'overdue':
            return status === 'Overdue'
          case 'voided':
            return status === 'Voided'
          default:
            return true
        }
      })
    }

    // Sort by selected column
    filtered.sort((a, b) => {
      const aVal = getSortValue(a, billsSortColumn)
      const bVal = getSortValue(b, billsSortColumn)

      let comparison = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      return billsSortDirection === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [bills, searchTerm, filterStatus, vendorMap, billsSortColumn, billsSortDirection, getSortValue, viewMode])

  // Build a map of linked bill IDs per payment
  const linkedBillsMap = useMemo(() => {
    const map = new Map<string, JournalEntry[]>()
    payments.forEach((payment) => {
      // Check if payment has linkedBillIds or similar
      const linkedIds = payment.linkedBillIds || payment.linkedTransactionIds || []
      if (linkedIds.length > 0) {
        const linkedBills = bills.filter((bill) => linkedIds.includes(bill.id))
        if (linkedBills.length > 0) {
          map.set(payment.id, linkedBills)
        }
      }
    })
    return map
  }, [payments, bills])

  // Filter and search payments
  const filteredPayments = useMemo(() => {
    let filtered = [...payments]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (payment) =>
          payment.reference?.toLowerCase().includes(term) ||
          payment.description?.toLowerCase().includes(term) ||
          payment.memo?.toLowerCase().includes(term) ||
          vendorMap.get(payment.vendorId || '')?.toLowerCase().includes(term)
      )
    }

    // Sort by selected column
    filtered.sort((a, b) => {
      const aVal = getSortValue(a, paymentsSortColumn)
      const bVal = getSortValue(b, paymentsSortColumn)

      let comparison = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      return paymentsSortDirection === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [payments, searchTerm, vendorMap, paymentsSortColumn, paymentsSortDirection, getSortValue])

  const statusOptions: SelectOption[] = [
    { value: 'all', label: 'All Status' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'voided', label: 'Voided' },
  ]

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = bills.length
    const unpaid = bills.filter((b) => getBillStatus(b) === 'Unpaid' || getBillStatus(b) === 'Overdue')
    const unpaidAmount = unpaid.reduce((sum, b) => {
      const amount = b.lines.reduce((s, l) => s + (l.debit || 0), 0)
      return sum + amount
    }, 0)
    const overdue = bills.filter((b) => getBillStatus(b) === 'Overdue')
    const overdueAmount = overdue.reduce((sum, b) => {
      const amount = b.lines.reduce((s, l) => s + (l.debit || 0), 0)
      return sum + amount
    }, 0)

    return {
      total,
      unpaid: unpaid.length,
      unpaidAmount,
      overdue: overdue.length,
      overdueAmount,
      payments: payments.length,
    }
  }, [bills, payments])

  // Handler to open the new bill modal
  const handleNewBill = () => {
    const newTransaction = useNewTransaction(companyId, activeUserId)
    setCurrentTransaction(newTransaction)
    setShowBillModal(true)
  }

  // Handler to open the bill payment modal
  const handleNewBillPayment = () => {
    setShowPaymentModal(true)
  }

  // Toggle expanded state for a payment
  const togglePaymentExpanded = useCallback((paymentId: string) => {
    setExpandedPayments((prev) => {
      const next = new Set(prev)
      if (next.has(paymentId)) {
        next.delete(paymentId)
      } else {
        next.add(paymentId)
      }
      return next
    })
  }, [])

  // Handler for transaction changes in the form
  const handleTransactionChange = (transaction: JournalEntry) => {
    setCurrentTransaction(transaction)
  }

  // Handler to save the bill
  const handleSaveBill = async (transaction: JournalEntry) => {
    try {
      const result = await createNewTransaction(transaction)
      if (result) {
        setShowBillModal(false)
        setCurrentTransaction(null)
        // Refresh transactions
        await loadTransactions({ companyId })
      }
    } catch (error) {
      console.error('Failed to save bill:', error)
    }
  }

  // Handler to save bill payments from BillPaidForm
  const handleSaveBillPayments = async (paymentTransactions: JournalEntry[]) => {
    try {
      for (const transaction of paymentTransactions) {
        await createNewTransaction(transaction)
      }
      setShowPaymentModal(false)
      // Refresh transactions
      await loadTransactions({ companyId })
    } catch (error) {
      console.error('Failed to save bill payment:', error)
    }
  }

  // Handler to cancel/close the modal
  const handleCancelBill = () => {
    setShowBillModal(false)
    setCurrentTransaction(null)
  }

  // Handler to cancel/close the payment modal
  const handleCancelPayment = () => {
    setShowPaymentModal(false)
    setCurrentTransaction(null)
  }

  // Open transaction in floating card
  const handleTransactionClick = useCallback((txnId: string) => {
    toggleCard({ transactionId: txnId, companyId })
  }, [toggleCard, companyId])

  // Handle sort toggle for bills
  const handleBillsSort = useCallback((column: BillSortColumn) => {
    if (billsSortColumn === column) {
      setBillsSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setBillsSortColumn(column)
      setBillsSortDirection('asc')
    }
  }, [billsSortColumn])

  // Handle sort toggle for payments
  const handlePaymentsSort = useCallback((column: BillSortColumn) => {
    if (paymentsSortColumn === column) {
      setPaymentsSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setPaymentsSortColumn(column)
      setPaymentsSortDirection('asc')
    }
  }, [paymentsSortColumn])

  // Sort indicator component
  const SortIndicator: FC<{ column: BillSortColumn; currentColumn: BillSortColumn; direction: SortDirection }> =
    ({ column, currentColumn, direction }) => {
      if (column !== currentColumn) {
        return <span className={styles.sortIndicator}>&#8597;</span>
      }
      return (
        <span className={styles.sortIndicatorActive}>
          {direction === 'asc' ? '▲' : '▼'}
        </span>
      )
    }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading bills...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Summary Cards */}
      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total Bills</span>
          <span className={styles.summaryValue}>{stats.total}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Outstanding</span>
          <span className={styles.summaryValue}>
            {formatMoney(stats.unpaidAmount)}
          </span>
          <span className={styles.summarySubtext}>
            {stats.unpaid} {stats.unpaid === 1 ? 'bill' : 'bills'}
          </span>
        </div>
        {stats.overdue > 0 && (
          <div className={`${styles.summaryCard} ${styles.summaryCardWarning}`}>
            <span className={styles.summaryLabel}>Overdue</span>
            <span className={styles.summaryValue}>
              {formatMoney(stats.overdueAmount)}
            </span>
            <span className={styles.summarySubtext}>
              {stats.overdue} {stats.overdue === 1 ? 'bill' : 'bills'}
            </span>
          </div>
        )}
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Payments</span>
          <span className={styles.summaryValue}>{stats.payments}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBar}>
          <Input
            type="search"
            placeholder="Search bills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            fullWidth
            aria-label="Search bills"
          />
        </div>

        <div className={styles.filters}>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as BillStatusFilter)}
            options={statusOptions}
            aria-label="Filter by status"
          />
        </div>

        {/* View Toggle */}
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === 'outstanding' ? styles.viewToggleBtnActive : ''}`}
            onClick={() => setViewMode('outstanding')}
            aria-pressed={viewMode === 'outstanding'}
          >
            Outstanding
          </button>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === 'all' ? styles.viewToggleBtnActive : ''}`}
            onClick={() => setViewMode('all')}
            aria-pressed={viewMode === 'all'}
          >
            All Bills
          </button>
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" onClick={handleNewBillPayment}>
            Pay Bills
          </Button>
          <Button variant="primary" onClick={handleNewBill}>
            New Bill
          </Button>
        </div>
      </div>

      {/* Results Count */}
      <div className={styles.results}>
        <p className={styles.resultsCount} aria-live="polite">
          {filteredBills.length} {filteredBills.length === 1 ? 'bill' : 'bills'}
          {filteredPayments.length > 0 && ` and ${filteredPayments.length} ${filteredPayments.length === 1 ? 'payment' : 'payments'}`}
        </p>
      </div>

      {/* Two Column Layout: Bills on left, Payments on right */}
      <div className={styles.twoColumnLayout}>
        {/* Bills Column */}
        <div className={styles.column}>
          <h3 className={styles.sectionTitle}>Bills</h3>
          {filteredBills.length === 0 ? (
            <div className={styles.emptyState}>
              {bills.length === 0 ? (
                <>
                  <h4 className={styles.emptyTitle}>No bills yet</h4>
                  <p className={styles.emptyDescription}>
                    Bills from your vendors will appear here.
                  </p>
                </>
              ) : (
                <>
                  <p className={styles.emptyTitle}>No bills match your search</p>
                  <p className={styles.emptyDescription}>
                    Try adjusting your search or filters
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className={styles.billsList}>
              <div className={styles.compactHeader}>
                <button className={styles.sortableHeader} onClick={() => handleBillsSort('date')}>
                  Date <SortIndicator column="date" currentColumn={billsSortColumn} direction={billsSortDirection} />
                </button>
                <button className={styles.sortableHeader} onClick={() => handleBillsSort('vendor')}>
                  Vendor <SortIndicator column="vendor" currentColumn={billsSortColumn} direction={billsSortDirection} />
                </button>
                <button className={styles.sortableHeader} onClick={() => handleBillsSort('ref')}>
                  Ref <SortIndicator column="ref" currentColumn={billsSortColumn} direction={billsSortDirection} />
                </button>
                <button className={styles.sortableHeader} onClick={() => handleBillsSort('description')}>
                  Description <SortIndicator column="description" currentColumn={billsSortColumn} direction={billsSortDirection} />
                </button>
                <button className={styles.sortableHeader} onClick={() => handleBillsSort('amount')}>
                  Amount <SortIndicator column="amount" currentColumn={billsSortColumn} direction={billsSortDirection} />
                </button>
                <button className={styles.sortableHeader} onClick={() => handleBillsSort('status')}>
                  Status <SortIndicator column="status" currentColumn={billsSortColumn} direction={billsSortDirection} />
                </button>
              </div>

              {filteredBills.map((bill) => {
                const isOpen = isCardOpen(bill.id)
                const starred = isStarred(bill.id)
                const status = getBillStatus(bill)
                const isVoided = bill.status === 'void'
                const amount = bill.lines.reduce((sum, l) => sum + (l.debit || 0), 0)

                return (
                  <div
                    key={bill.id}
                    className={styles.compactRow}
                    onClick={() => handleTransactionClick(bill.id)}
                    style={{
                      cursor: 'pointer',
                      ...(starred && !isOpen && !isVoided && {
                        backgroundColor: '#fef9e7',
                        boxShadow: 'inset 3px 0 0 #d97706',
                      }),
                      ...(isOpen && {
                        backgroundColor: '#ecfdf5',
                        boxShadow: 'inset 3px 0 0 #0f766e',
                      }),
                      ...(isVoided && {
                        opacity: 0.6,
                        textDecoration: 'line-through',
                        backgroundColor: isOpen ? '#ecfdf5' : starred ? '#fef9e7' : '#f9fafb',
                      }),
                    }}
                  >
                    <span className={styles.cellDate}>{formatDate(bill.date)}</span>
                    <span className={styles.cellVendor}>{vendorMap.get(bill.vendorId || '') || 'Unknown'}</span>
                    <span className={styles.cellRef}>{bill.reference || '-'}</span>
                    <span className={styles.cellDescription}>{bill.description || bill.memo || '-'}</span>
                    <span className={styles.cellAmount}>{formatMoney(amount)}</span>
                    <span className={styles.cellStatusWrapper}>
                      {isVoided ? (
                        <span className={styles.voidBadge} title="Voided">VOID</span>
                      ) : (
                        <span className={`${styles.cellStatus} ${getStatusClass(status)}`}>
                          {status}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleStar(bill.id)
                        }}
                        style={{
                          padding: '0.25rem',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: starred ? '#d97706' : '#d1d5db',
                        }}
                        title={starred ? 'Remove highlight' : 'Highlight'}
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Payments Column */}
        <div className={styles.column}>
          <h3 className={styles.sectionTitle}>Bill Payments</h3>
          {filteredPayments.length === 0 ? (
            <div className={styles.emptyState}>
              <h4 className={styles.emptyTitle}>No payments yet</h4>
              <p className={styles.emptyDescription}>
                Payments to vendors will appear here.
              </p>
            </div>
          ) : (
            <div className={styles.billsList}>
              <div className={styles.paymentsHeader}>
                <span></span>
                <button className={styles.sortableHeader} onClick={() => handlePaymentsSort('date')}>
                  Date <SortIndicator column="date" currentColumn={paymentsSortColumn} direction={paymentsSortDirection} />
                </button>
                <button className={styles.sortableHeader} onClick={() => handlePaymentsSort('vendor')}>
                  Vendor <SortIndicator column="vendor" currentColumn={paymentsSortColumn} direction={paymentsSortDirection} />
                </button>
                <button className={styles.sortableHeader} onClick={() => handlePaymentsSort('ref')}>
                  Ref <SortIndicator column="ref" currentColumn={paymentsSortColumn} direction={paymentsSortDirection} />
                </button>
                <button className={styles.sortableHeader} onClick={() => handlePaymentsSort('description')}>
                  Description <SortIndicator column="description" currentColumn={paymentsSortColumn} direction={paymentsSortDirection} />
                </button>
                <button className={styles.sortableHeader} onClick={() => handlePaymentsSort('amount')}>
                  Amount <SortIndicator column="amount" currentColumn={paymentsSortColumn} direction={paymentsSortDirection} />
                </button>
                <span></span>
              </div>

              {filteredPayments.map((payment) => {
                const isOpen = isCardOpen(payment.id)
                const starred = isStarred(payment.id)
                const isVoided = payment.status === 'void'
                const amount = payment.lines.reduce((sum, l) => sum + (l.debit || 0), 0)
                const linkedBills = linkedBillsMap.get(payment.id) || []
                const hasLinkedBills = linkedBills.length > 0
                const isExpanded = expandedPayments.has(payment.id)

                return (
                  <div key={payment.id}>
                    <div
                      className={styles.paymentRow}
                      onClick={() => handleTransactionClick(payment.id)}
                      style={{
                        cursor: 'pointer',
                        ...(starred && !isOpen && !isVoided && {
                          backgroundColor: '#fef9e7',
                          boxShadow: 'inset 3px 0 0 #d97706',
                        }),
                        ...(isOpen && {
                          backgroundColor: '#ecfdf5',
                          boxShadow: 'inset 3px 0 0 #0f766e',
                        }),
                        ...(isVoided && {
                          opacity: 0.6,
                          textDecoration: 'line-through',
                          backgroundColor: isOpen ? '#ecfdf5' : starred ? '#fef9e7' : '#f9fafb',
                        }),
                      }}
                    >
                      {/* Expand/collapse toggle for linked bills */}
                      {hasLinkedBills ? (
                        <button
                          className={styles.expandBtn}
                          onClick={(e) => {
                            e.stopPropagation()
                            togglePaymentExpanded(payment.id)
                          }}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Collapse linked bills' : 'Expand linked bills'}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      ) : (
                        <span className={styles.expandPlaceholder}></span>
                      )}
                      <span className={styles.cellDate}>{formatDate(payment.date)}</span>
                      <span className={styles.cellVendor}>{vendorMap.get(payment.vendorId || '') || 'Unknown'}</span>
                      <span className={styles.cellRef}>{payment.reference || '-'}</span>
                      <span className={styles.cellDescription}>{payment.description || payment.memo || '-'}</span>
                      <span className={styles.cellAmount}>{formatMoney(amount)}</span>
                      <span className={styles.cellStatusWrapper}>
                        {isVoided && (
                          <span className={styles.voidBadge} title="Voided">VOID</span>
                        )}
                        {hasLinkedBills && !isVoided && (
                          <span className={styles.linkedBadge} title={`${linkedBills.length} linked bill${linkedBills.length > 1 ? 's' : ''}`}>
                            {linkedBills.length}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleStar(payment.id)
                          }}
                          style={{
                            padding: '0.25rem',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: starred ? '#d97706' : '#d1d5db',
                          }}
                          title={starred ? 'Remove highlight' : 'Highlight'}
                        >
                          <svg width="14" height="14" viewBox="0 0 20 20" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </button>
                      </span>
                    </div>

                    {/* Expanded linked bills */}
                    {isExpanded && linkedBills.length > 0 && (
                      <div className={styles.linkedBillsContainer}>
                        {linkedBills.map((bill) => {
                          const billIsOpen = isCardOpen(bill.id)
                          const billAmount = bill.lines.reduce((sum, l) => sum + (l.debit || 0), 0)
                          return (
                            <div
                              key={bill.id}
                              className={styles.linkedBillRow}
                              onClick={() => handleTransactionClick(bill.id)}
                              style={{
                                cursor: 'pointer',
                                ...(billIsOpen && {
                                  backgroundColor: '#ecfdf5',
                                }),
                              }}
                            >
                              <span className={styles.linkedBillIcon}>└</span>
                              <span className={styles.cellDate}>{formatDate(bill.date)}</span>
                              <span className={styles.cellRef}>{bill.reference || '-'}</span>
                              <span className={styles.cellDescription}>{bill.description || bill.memo || '-'}</span>
                              <span className={styles.cellAmount}>{formatMoney(billAmount)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* New Bill Modal */}
      {showBillModal && currentTransaction && (
        <Modal
          isOpen={showBillModal}
          onClose={handleCancelBill}
          title="New Bill"
          size="lg"
          closeOnBackdropClick={false}
          headerStyle={{
            background: 'linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)',
            color: 'white',
          }}
        >
          <ExpenseForm
            transaction={currentTransaction}
            accounts={accounts}
            companyId={companyId}
            onChange={handleTransactionChange}
            onSave={handleSaveBill}
            onCancel={handleCancelBill}
            isLoading={accountsLoading}
            defaultExpenseType="bill"
          />
        </Modal>
      )}

      {/* New Bill Payment Modal */}
      {showPaymentModal && (
        <Modal
          isOpen={showPaymentModal}
          onClose={handleCancelPayment}
          title="Pay Bills"
          size="xl"
          closeOnBackdropClick={false}
          headerStyle={{
            background: 'linear-gradient(135deg, #1a4731 0%, #276749 100%)',
            color: 'white',
          }}
        >
          <BillPaidForm
            transactions={transactions}
            accounts={accounts}
            vendors={vendors}
            companyId={companyId}
            userId={activeUserId}
            onSave={handleSaveBillPayments}
            onCancel={handleCancelPayment}
            isLoading={accountsLoading}
          />
        </Modal>
      )}
    </div>
  )
}
