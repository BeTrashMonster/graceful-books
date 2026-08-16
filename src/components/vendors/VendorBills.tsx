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
 * - Create new bills
 * - WCAG 2.1 AA accessible
 *
 * Per E6: Bill Entry & Management
 */

import { type FC, useState, useEffect, useMemo } from 'react'
import { Input } from '../forms/Input'
import { Select, type SelectOption } from '../forms/Select'
import { Button } from '../core/Button'
import { getBills } from '../../store/bills'
import type { Bill, BillStatus } from '../../db/schema/bills.schema'
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
  const [bills, setBills] = useState<Bill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

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
          <Button variant="primary" onClick={() => {
            // TODO: Open create bill modal
            alert('Create bill functionality coming soon')
          }}>
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
    </div>
  )
}
