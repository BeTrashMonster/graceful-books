/**
 * VendorBills Component
 *
 * Displays bills associated with vendors.
 * Part of the Vendors page tabbed interface.
 *
 * Features:
 * - List bills from vendors with status indicators
 * - Filter by status (Draft, Due, Overdue, Paid, Void)
 * - Search by bill number or vendor
 * - Create new bills using ExpenseForm with defaultExpenseType='bill'
 * - WCAG 2.1 AA accessible
 *
 * Per E6: Bill Entry & Management
 */

import { type FC, useState, useEffect, useMemo } from 'react'
import { Input } from '../forms/Input'
import { Select, type SelectOption } from '../forms/Select'
import { Button } from '../core/Button'
import { Modal } from '../modals/Modal'
import { ExpenseForm } from '../transactions/ExpenseForm'
import { getBills } from '../../store/bills'
import { deleteTransaction, voidTransaction } from '../../store/transactions'
import { useTransactions, useNewTransaction } from '../../hooks/useTransactions'
import { useAccounts } from '../../hooks/useAccounts'
import { useAuth } from '../../contexts/AuthContext'
import type { Bill, BillStatus } from '../../db/schema/bills.schema'
import type { JournalEntry } from '../../types'
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

/**
 * Format currency amount
 */
function formatAmount(amount: string): string {
  const num = parseFloat(amount)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

/**
 * Format date
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Get status badge class
 */
function getStatusClass(status: BillStatus): string {
  switch (status) {
    case 'DRAFT':
      return styles.statusDraft
    case 'DUE':
      return styles.statusDue
    case 'OVERDUE':
      return styles.statusOverdue
    case 'PAID':
      return styles.statusPaid
    case 'VOID':
      return styles.statusVoid
    default:
      return ''
  }
}

/**
 * Get status display text
 */
function getStatusText(status: BillStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft'
    case 'DUE':
      return 'Due'
    case 'OVERDUE':
      return 'Overdue'
    case 'PAID':
      return 'Paid'
    case 'VOID':
      return 'Void'
    default:
      return status
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

  const [bills, setBills] = useState<Bill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Modal state for creating bills
  const [showBillModal, setShowBillModal] = useState(false)
  const [currentTransaction, setCurrentTransaction] = useState<JournalEntry | null>(null)

  // Cleanup modal state
  const [showCleanupModal, setShowCleanupModal] = useState(false)
  const [orphanedPayments, setOrphanedPayments] = useState<JournalEntry[]>([])
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null)

  // Migration modal state
  const [showMigrationModal, setShowMigrationModal] = useState(false)
  const [migrationItems, setMigrationItems] = useState<Array<{
    payment: JournalEntry
    expensesToConsolidate: JournalEntry[]
    needsAdjustmentOnly?: boolean
  }>>([])
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null)

  // Hooks for the expense form
  const { transactions: allTransactions, loadTransactions, createNewTransaction } = useTransactions()
  const { accounts, isLoading: accountsLoading } = useAccounts({
    companyId,
    isActive: true,
  })

  // Load bills
  useEffect(() => {
    const loadBills = async () => {
      setIsLoading(true)
      try {
        const result = await getBills({
          company_id: companyId,
          vendor_id: vendorId,
        })
        if (result.success) {
          setBills(result.data)
        }
      } catch (error) {
        console.error('Failed to load bills:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadBills()
  }, [companyId, vendorId])

  // Filter and search bills
  const filteredBills = useMemo(() => {
    let filtered = [...bills]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (bill) =>
          bill.bill_number.toLowerCase().includes(term) ||
          bill.notes?.toLowerCase().includes(term)
      )
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter((bill) => bill.status === filterStatus)
    }

    // Sort by date descending
    filtered.sort((a, b) => b.bill_date - a.bill_date)

    return filtered
  }, [bills, searchTerm, filterStatus])

  const statusOptions: SelectOption[] = [
    { value: 'all', label: 'All Status' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'DUE', label: 'Due' },
    { value: 'OVERDUE', label: 'Overdue' },
    { value: 'PAID', label: 'Paid' },
    { value: 'VOID', label: 'Void' },
  ]

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = bills.length
    const outstanding = bills.filter(
      (b) => b.status === 'DUE' || b.status === 'OVERDUE'
    )
    const outstandingAmount = outstanding.reduce(
      (sum, b) => sum + parseFloat(b.total),
      0
    )
    const overdue = bills.filter((b) => b.status === 'OVERDUE')
    const overdueAmount = overdue.reduce(
      (sum, b) => sum + parseFloat(b.total),
      0
    )

    return {
      total,
      outstanding: outstanding.length,
      outstandingAmount,
      overdue: overdue.length,
      overdueAmount,
    }
  }, [bills])

  // Handler to open the new bill modal
  const handleNewBill = () => {
    const newTransaction = useNewTransaction(companyId, activeUserId)
    setCurrentTransaction(newTransaction)
    setShowBillModal(true)
  }

  // Handler for transaction changes in the form
  const handleTransactionChange = (transaction: JournalEntry) => {
    setCurrentTransaction(transaction)
  }

  // Handler to save the bill
  const handleSaveBill = async (transaction: JournalEntry) => {
    try {
      const result = await createNewTransaction(transaction)
      if (result.success) {
        setShowBillModal(false)
        setCurrentTransaction(null)
        // Refresh bills list
        const billsResult = await getBills({
          company_id: companyId,
          vendor_id: vendorId,
        })
        if (billsResult.success) {
          setBills(billsResult.data)
        }
      }
    } catch (error) {
      console.error('Failed to save bill:', error)
    }
  }

  // Handler to cancel/close the modal
  const handleCancelBill = () => {
    setShowBillModal(false)
    setCurrentTransaction(null)
  }

  // Load transactions when component mounts (for cleanup detection)
  useEffect(() => {
    loadTransactions({ companyId })
  }, [loadTransactions, companyId])

  // Find orphaned bill-payments (those without linkedTransactionId or with invalid links)
  const handleFindOrphanedPayments = async () => {
    setCleanupMessage(null)

    // Get all bill-payment transactions
    const billPayments = allTransactions.filter(
      (txn) => txn.transactionType === 'bill-payment'
    )

    // Get all bill transaction IDs
    const billIds = new Set(
      allTransactions
        .filter((txn) => txn.transactionType === 'bill')
        .map((txn) => txn.id)
    )

    // Find orphaned payments:
    // 1. No linkedTransactionId
    // 2. linkedTransactionId points to a non-existent bill
    const orphaned = billPayments.filter((payment) => {
      if (!payment.linkedTransactionId) {
        return true // No link at all
      }
      if (!billIds.has(payment.linkedTransactionId)) {
        return true // Links to non-existent bill
      }
      return false
    })

    setOrphanedPayments(orphaned)
    setShowCleanupModal(true)
  }

  // Delete orphaned payments
  const handleDeleteOrphanedPayments = async () => {
    setIsCleaningUp(true)
    let deletedCount = 0
    let errorCount = 0

    for (const payment of orphanedPayments) {
      try {
        const result = await deleteTransaction(payment.id, companyId)
        if (result.success) {
          deletedCount++
        } else {
          errorCount++
          console.error(`Failed to delete payment ${payment.id}:`, result.error)
        }
      } catch (error) {
        errorCount++
        console.error(`Error deleting payment ${payment.id}:`, error)
      }
    }

    setIsCleaningUp(false)
    setOrphanedPayments([])

    if (errorCount === 0) {
      setCleanupMessage(`Successfully deleted ${deletedCount} orphaned payment(s).`)
    } else {
      setCleanupMessage(`Deleted ${deletedCount} payment(s). ${errorCount} failed.`)
    }

    // Refresh transactions
    loadTransactions({ companyId })
  }

  // Format currency for cleanup modal
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  // Find legacy bill-payments that need adjustment entries
  const handleFindLegacyPayments = async () => {
    setMigrationMessage(null)

    // Get all bill-payments
    const billPayments = allTransactions.filter(
      (txn) => txn.transactionType === 'bill-payment'
    )

    // Get all bills
    const bills = allTransactions.filter(
      (txn) => txn.transactionType === 'bill'
    )
    const billRefs = new Map(bills.map((b) => [b.reference, b]))

    // Get ALL expenses/checks (including already consolidated ones)
    const allExpensesAndChecks = allTransactions.filter(
      (txn) => txn.transactionType === 'expense' || txn.transactionType === 'check'
    )

    const expenseByRef = new Map(
      allExpensesAndChecks.filter((e) => e.reference).map((e) => [e.reference, e])
    )
    const expenseById = new Map(allExpensesAndChecks.map((e) => [e.id, e]))

    // Get existing adjustment entries (to avoid creating duplicates)
    const adjustmentEntries = allTransactions.filter(
      (txn) => txn.transactionType === 'journal' && txn.reference?.startsWith('ADJ-')
    )
    const paymentsWithAdjustments = new Set(
      adjustmentEntries.map((adj) => adj.linkedTransactionId).filter(Boolean)
    )

    const itemsToFix: Array<{
      payment: JournalEntry
      expensesToConsolidate: JournalEntry[]
      needsAdjustmentOnly: boolean
    }> = []

    // For each bill-payment, check if it has consolidated expenses needing adjustment
    billPayments.forEach((payment) => {
      const expensesToConsolidate: JournalEntry[] = []
      let needsAdjustmentOnly = false

      // Check payment line memos for expense references
      payment.lines.forEach((line) => {
        const memoMatch = line.memo?.match(/Payment for (\S+)/)
        if (memoMatch) {
          const ref = memoMatch[1]
          const expense = expenseByRef.get(ref)
          if (expense && !billRefs.has(ref)) {
            if (!expensesToConsolidate.find((e) => e.id === expense.id)) {
              expensesToConsolidate.push(expense)
              // If already consolidated but no adjustment exists, only needs adjustment
              if (expense.consolidatedIntoPaymentId && !paymentsWithAdjustments.has(payment.id)) {
                needsAdjustmentOnly = true
              }
            }
          }
        }
      })

      // Check consolidatedTransactionIds (for payments that already tracked their consolidated items)
      if (payment.consolidatedTransactionIds) {
        payment.consolidatedTransactionIds.forEach((txnId) => {
          const expense = expenseById.get(txnId)
          if (expense && !expensesToConsolidate.find((e) => e.id === expense.id)) {
            expensesToConsolidate.push(expense)
            // If this payment has consolidated items but no adjustment entry yet
            if (!paymentsWithAdjustments.has(payment.id)) {
              needsAdjustmentOnly = true
            }
          }
        })
      }

      // Also find expenses that are already marked as consolidated into THIS payment
      // but might not be in consolidatedTransactionIds
      allExpensesAndChecks.forEach((expense) => {
        if (expense.consolidatedIntoPaymentId === payment.id) {
          if (!expensesToConsolidate.find((e) => e.id === expense.id)) {
            expensesToConsolidate.push(expense)
          }
          // If already consolidated but no adjustment exists
          if (!paymentsWithAdjustments.has(payment.id)) {
            needsAdjustmentOnly = true
          }
        }
      })

      if (expensesToConsolidate.length > 0) {
        // Only add if adjustment is needed (skip if adjustment already exists)
        if (!paymentsWithAdjustments.has(payment.id)) {
          itemsToFix.push({ payment, expensesToConsolidate, needsAdjustmentOnly })
        }
      }
    })

    setMigrationItems(itemsToFix)
    setShowMigrationModal(true)
  }

  // Apply migration - void consolidated expenses to remove them from bank register
  const handleApplyMigration = async () => {
    setIsMigrating(true)
    let voidedCount = 0
    let errorCount = 0

    for (const item of migrationItems) {
      // Void each expense that was consolidated into this payment
      // This removes it from the bank register since the bill payment already covers it
      for (const expense of item.expensesToConsolidate) {
        try {
          const result = await voidTransaction(expense.id, companyId)

          if (result.success) {
            voidedCount++
          } else {
            errorCount++
            console.error(`Failed to void expense ${expense.id}:`, result.error)
          }
        } catch (error) {
          errorCount++
          console.error(`Error voiding expense ${expense.id}:`, error)
        }
      }
    }

    setIsMigrating(false)
    setMigrationItems([])

    if (errorCount === 0) {
      setMigrationMessage(
        `Successfully voided ${voidedCount} transaction(s). ` +
        `These expenses have been removed from your bank register. Refresh the page to see changes.`
      )
    } else {
      setMigrationMessage(
        `Voided ${voidedCount} transaction(s). ${errorCount} failed.`
      )
    }

    // Refresh transactions
    loadTransactions({ companyId })
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
            {formatAmount(stats.outstandingAmount.toFixed(2))}
          </span>
          <span className={styles.summarySubtext}>
            {stats.outstanding} {stats.outstanding === 1 ? 'bill' : 'bills'}
          </span>
        </div>
        {stats.overdue > 0 && (
          <div className={`${styles.summaryCard} ${styles.summaryCardWarning}`}>
            <span className={styles.summaryLabel}>Overdue</span>
            <span className={styles.summaryValue}>
              {formatAmount(stats.overdueAmount.toFixed(2))}
            </span>
            <span className={styles.summarySubtext}>
              {stats.overdue} {stats.overdue === 1 ? 'bill' : 'bills'}
            </span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBar}>
          <Input
            type="search"
            placeholder="Search by bill number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            fullWidth
            aria-label="Search bills"
          />
        </div>

        <div className={styles.filters}>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={statusOptions}
            aria-label="Filter by status"
          />
        </div>

        <div className={styles.actions}>
          <Button variant="outline" size="sm" onClick={handleFindLegacyPayments}>
            Fix Legacy Payments
          </Button>
          <Button variant="outline" size="sm" onClick={handleFindOrphanedPayments}>
            Cleanup Data
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
        </p>
      </div>

      {/* Bills List */}
      {filteredBills.length === 0 ? (
        <div className={styles.emptyState}>
          {bills.length === 0 ? (
            <>
              <div className={styles.emptyIcon} aria-hidden="true">📄</div>
              <h3 className={styles.emptyTitle}>No bills yet</h3>
              <p className={styles.emptyDescription}>
                Bills from your vendors will appear here. Track what you owe and when payments are due.
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
          <div className={styles.billsHeader}>
            <span className={styles.headerBillNumber}>Bill #</span>
            <span className={styles.headerDate}>Date</span>
            <span className={styles.headerDueDate}>Due Date</span>
            <span className={styles.headerAmount}>Amount</span>
            <span className={styles.headerStatus}>Status</span>
            <span className={styles.headerActions}>Actions</span>
          </div>

          {filteredBills.map((bill) => (
            <div key={bill.id} className={styles.billRow}>
              <span className={styles.billNumber}>{bill.bill_number}</span>
              <span className={styles.billDate}>{formatDate(bill.bill_date)}</span>
              <span className={styles.billDueDate}>{formatDate(bill.due_date)}</span>
              <span className={styles.billAmount}>{formatAmount(bill.total)}</span>
              <span className={`${styles.billStatus} ${getStatusClass(bill.status)}`}>
                {getStatusText(bill.status)}
              </span>
              <span className={styles.billActions}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // TODO: Open view/edit modal
                    alert('View bill functionality coming soon')
                  }}
                  aria-label={`View bill ${bill.bill_number}`}
                >
                  View
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}

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

      {/* Cleanup Modal */}
      {showCleanupModal && (
        <Modal
          isOpen={showCleanupModal}
          onClose={() => {
            setShowCleanupModal(false)
            setCleanupMessage(null)
          }}
          title="Cleanup Orphaned Payments"
          size="md"
        >
          <div style={{ padding: '1rem' }}>
            {cleanupMessage ? (
              <>
                <p style={{ color: '#166534', marginBottom: '1rem' }}>{cleanupMessage}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setShowCleanupModal(false)
                      setCleanupMessage(null)
                    }}
                  >
                    Done
                  </Button>
                </div>
              </>
            ) : orphanedPayments.length === 0 ? (
              <>
                <p style={{ color: '#166534', marginBottom: '1rem' }}>
                  No orphaned bill payments found. Your data is clean.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button variant="primary" onClick={() => setShowCleanupModal(false)}>
                    Close
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p style={{ marginBottom: '1rem' }}>
                  Found <strong>{orphanedPayments.length}</strong> orphaned bill payment(s)
                  that are not linked to any bill:
                </p>
                <div style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.375rem',
                  marginBottom: '1rem'
                }}>
                  {orphanedPayments.map((payment) => {
                    const amount = payment.lines.reduce((sum, line) => sum + line.debit, 0)
                    return (
                      <div
                        key={payment.id}
                        style={{
                          padding: '0.75rem 1rem',
                          borderBottom: '1px solid #e5e7eb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {payment.reference || 'No Reference'}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            {payment.date.toLocaleDateString()} - {payment.memo || 'No description'}
                          </div>
                        </div>
                        <div style={{ fontWeight: 600, color: '#b91c1c' }}>
                          {formatCurrency(amount)}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                  These payments are not linked to any bill and may be causing data inconsistencies.
                  Would you like to delete them?
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <Button
                    variant="outline"
                    onClick={() => setShowCleanupModal(false)}
                    disabled={isCleaningUp}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onClick={handleDeleteOrphanedPayments}
                    loading={isCleaningUp}
                    disabled={isCleaningUp}
                  >
                    Delete {orphanedPayments.length} Payment(s)
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Migration Modal - Fix Legacy Payments */}
      {showMigrationModal && (
        <Modal
          isOpen={showMigrationModal}
          onClose={() => {
            setShowMigrationModal(false)
            setMigrationMessage(null)
          }}
          title="Fix Legacy Payments"
          size="lg"
        >
          <div style={{ padding: '1rem' }}>
            {migrationMessage ? (
              <>
                <p style={{ color: '#166534', marginBottom: '1rem' }}>{migrationMessage}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setShowMigrationModal(false)
                      setMigrationMessage(null)
                    }}
                  >
                    Done
                  </Button>
                </div>
              </>
            ) : migrationItems.length === 0 ? (
              <>
                <p style={{ color: '#166534', marginBottom: '1rem' }}>
                  No duplicate transactions found that need to be voided.
                </p>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                  All bill payments appear to be correctly recorded. If you still see duplicates in
                  your bank register, you may need to manually void the duplicate transaction from
                  the Transactions page.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button variant="primary" onClick={() => setShowMigrationModal(false)}>
                    Close
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p style={{ marginBottom: '1rem' }}>
                  Found <strong>{migrationItems.length}</strong> bill payment(s) with duplicate expense/check entries that should be voided:
                </p>
                <div style={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.375rem',
                  marginBottom: '1rem'
                }}>
                  {migrationItems.map((item) => (
                    <div
                      key={item.payment.id}
                      style={{
                        padding: '1rem',
                        borderBottom: '1px solid #e5e7eb',
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                        Payment: {item.payment.reference || item.payment.memo || 'No Reference'}
                        <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: '0.5rem' }}>
                          ({item.payment.date instanceof Date ? item.payment.date.toLocaleDateString() : 'Unknown date'})
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#4b006e', marginBottom: '0.5rem' }}>
                        Expenses/Checks to void (duplicates):
                      </div>
                      {item.expensesToConsolidate.map((expense) => (
                        <div
                          key={expense.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.5rem 0.75rem',
                            background: '#f3f4f6',
                            borderRadius: '0.25rem',
                            marginBottom: '0.25rem',
                            fontSize: '0.875rem'
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 500 }}>
                              {expense.transactionType === 'check' ? 'Check' : 'Expense'}: {expense.reference || 'No Ref'}
                            </span>
                            <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>
                              {expense.memo || ''}
                            </span>
                          </div>
                          <span style={{ fontWeight: 600 }}>
                            {formatCurrency(expense.lines.reduce((sum, l) => sum + l.debit, 0))}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                  This will VOID these expense/check transactions, removing them from your bank register.
                  The bill payment already includes these amounts, so the original entries are duplicates.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <Button
                    variant="outline"
                    onClick={() => setShowMigrationModal(false)}
                    disabled={isMigrating}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    onClick={handleApplyMigration}
                    loading={isMigrating}
                    disabled={isMigrating}
                  >
                    Void {migrationItems.reduce((sum, item) => sum + item.expensesToConsolidate.length, 0)} Transaction(s)
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
