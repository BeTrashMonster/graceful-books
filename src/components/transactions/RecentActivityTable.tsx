/**
 * RecentActivityTable Component
 *
 * An enhanced activity table for displaying transactions with:
 * - Pagination/show more functionality
 * - Filtering by date range, transaction type, and vendor
 * - Sortable column headers
 * - CSV and PDF export capabilities
 *
 * Requirements: B2 - Transaction Entry - Basic (Enhanced)
 */

import { useState, useMemo, useCallback, type FC } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, subDays, isWithinInterval, parseISO } from 'date-fns'
import type { JournalEntry, TransactionType } from '../../types'
import type { Vendor } from '../../types/vendor.types'
import type { Contact } from '../../types'
import { TransactionTypeBadge } from './TransactionTypeBadge'
import styles from './RecentActivityTable.module.css'

// Transaction type display labels
const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  expense: 'Expense',
  check: 'Check',
  bill: 'Bill',
  'bill-payment': 'Bill Payment',
  income: 'Income',
  deposit: 'Deposit',
  invoice: 'Invoice',
  'invoice-payment': 'Invoice Payment',
  transfer: 'Transfer',
  'credit-card-payment': 'Credit Card Payment',
  'liability-payment': 'Liability Payment',
  'journal-entry': 'Journal Entry',
  'opening-balance': 'Opening Balance',
}

/**
 * Get formatted display label for transaction type
 */
function getTransactionTypeLabel(type: TransactionType | undefined): string {
  if (!type) return 'Transaction'
  return TRANSACTION_TYPE_LABELS[type] || 'Transaction'
}

// Transaction type labels for filter dropdown
const TRANSACTION_TYPE_OPTIONS: { value: TransactionType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'expense', label: 'Expense' },
  { value: 'check', label: 'Check' },
  { value: 'bill', label: 'Bill' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'credit-card-payment', label: 'Credit Card Payment' },
  { value: 'liability-payment', label: 'Liability Payment' },
]

// Date range presets
const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
]

// Sort configuration
type SortField = 'date' | 'type' | 'reference' | 'vendor' | 'amount'
type SortDirection = 'asc' | 'desc'

export interface RecentActivityTableProps {
  /** List of transactions to display */
  transactions: JournalEntry[]
  /** Map of vendor IDs to vendor objects */
  vendors: Vendor[]
  /** Map of customer IDs to customer objects */
  customers: Contact[]
  /** Callback when a transaction is clicked */
  onTransactionClick?: (transaction: JournalEntry) => void
  /** Initial page size */
  initialPageSize?: number
  /** Show filters */
  showFilters?: boolean
  /** Show export buttons */
  showExport?: boolean
  /** Custom title */
  title?: string
}

/**
 * Format currency with full precision
 */
function formatCurrencyFull(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Calculate total amount from transaction lines
 */
function getTotalAmount(transaction: JournalEntry): number {
  const rawAmount = transaction.lines.reduce(
    (sum, line) => sum + (line.debit || line.credit),
    0
  ) / 2

  if (transaction.reference === 'OPENING') {
    return rawAmount / 100
  }
  return rawAmount
}

/**
 * Get the reference number to display (check number, invoice number, etc.)
 */
function getReferenceDisplay(transaction: JournalEntry): string {
  if (transaction.checkNumber) {
    return `Check #${transaction.checkNumber}`
  }
  if (transaction.reference && transaction.reference !== 'OPENING') {
    return transaction.reference
  }
  return '-'
}

/**
 * RecentActivityTable displays a filterable, sortable list of transactions
 */
export const RecentActivityTable: FC<RecentActivityTableProps> = ({
  transactions,
  vendors,
  customers,
  onTransactionClick,
  initialPageSize = 10,
  showFilters = true,
  showExport = true,
  title = 'Recent Activity',
}) => {
  // State for pagination
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [currentPage, setCurrentPage] = useState(1)

  // State for filters
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all')
  const [vendorFilter, setVendorFilter] = useState<string>('all')
  const [dateRangePreset, setDateRangePreset] = useState<string>('all')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  // State for sorting
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Create lookup maps for vendors and customers
  const vendorMap = useMemo(() => {
    const map = new Map<string, Vendor>()
    vendors.forEach(v => map.set(v.id, v))
    return map
  }, [vendors])

  const customerMap = useMemo(() => {
    const map = new Map<string, Contact>()
    customers.forEach(c => map.set(c.id, c))
    return map
  }, [customers])

  // Get contact name (vendor or customer)
  const getContactName = useCallback((transaction: JournalEntry): string => {
    if (transaction.vendorId) {
      const vendor = vendorMap.get(transaction.vendorId)
      return vendor?.name || '-'
    }
    if (transaction.customerId) {
      const customer = customerMap.get(transaction.customerId)
      return customer?.name || '-'
    }
    return '-'
  }, [vendorMap, customerMap])

  // Calculate date range based on preset
  const getDateRange = useCallback((): { start: Date | null; end: Date | null } => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    switch (dateRangePreset) {
      case 'today': {
        const start = new Date(today)
        start.setHours(0, 0, 0, 0)
        return { start, end: today }
      }
      case 'last7':
        return { start: subDays(today, 7), end: today }
      case 'last30':
        return { start: subDays(today, 30), end: today }
      case 'thisMonth':
        return { start: startOfMonth(today), end: endOfMonth(today) }
      case 'lastMonth': {
        const lastMonth = subMonths(today, 1)
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) }
      }
      case 'custom':
        return {
          start: customStartDate ? parseISO(customStartDate) : null,
          end: customEndDate ? parseISO(customEndDate) : null,
        }
      default:
        return { start: null, end: null }
    }
  }, [dateRangePreset, customStartDate, customEndDate])

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let result = [...transactions].filter(txn => txn.reference !== 'OPENING')

    // Apply type filter
    if (typeFilter !== 'all') {
      result = result.filter(txn => txn.transactionType === typeFilter)
    }

    // Apply vendor/customer filter
    if (vendorFilter !== 'all') {
      result = result.filter(txn =>
        txn.vendorId === vendorFilter || txn.customerId === vendorFilter
      )
    }

    // Apply date range filter
    const { start, end } = getDateRange()
    if (start && end) {
      result = result.filter(txn => {
        const txnDate = new Date(txn.date)
        return isWithinInterval(txnDate, { start, end })
      })
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
          break
        case 'type':
          comparison = (a.transactionType || '').localeCompare(b.transactionType || '')
          break
        case 'reference':
          comparison = getReferenceDisplay(a).localeCompare(getReferenceDisplay(b))
          break
        case 'vendor':
          comparison = getContactName(a).localeCompare(getContactName(b))
          break
        case 'amount':
          comparison = getTotalAmount(a) - getTotalAmount(b)
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return result
  }, [transactions, typeFilter, vendorFilter, getDateRange, sortField, sortDirection, getContactName])

  // Paginated transactions
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredTransactions.slice(startIndex, startIndex + pageSize)
  }, [filteredTransactions, currentPage, pageSize])

  // Total pages
  const totalPages = Math.ceil(filteredTransactions.length / pageSize)

  // Handle sort toggle
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'date' ? 'desc' : 'asc')
    }
  }, [sortField])

  // Reset to first page when filters change
  const handleFilterChange = useCallback(() => {
    setCurrentPage(1)
  }, [])

  // Export to CSV
  const exportToCSV = useCallback(() => {
    const headers = ['Date', 'Type', 'Reference', 'Vendor/Customer', 'Memo', 'Amount']
    const rows = filteredTransactions.map(txn => [
      format(new Date(txn.date), 'yyyy-MM-dd'),
      getTransactionTypeLabel(txn.transactionType),
      getReferenceDisplay(txn),
      getContactName(txn),
      txn.memo || '',
      getTotalAmount(txn).toFixed(2),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }, [filteredTransactions, getContactName])

  // Export to PDF (using browser print)
  const exportToPDF = useCallback(() => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Transaction Report - ${format(new Date(), 'MMMM d, yyyy')}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
          h1 { color: #1e3a5f; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          th { background-color: #f9fafb; font-weight: 600; color: #374151; }
          .amount { text-align: right; font-family: monospace; }
          .type-badge {
            display: inline-block;
            padding: 2px 8px;
            background: #f3f4f6;
            border-radius: 4px;
            font-size: 12px;
          }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <h1>Transaction Report</h1>
        <p>Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
        <p>Total Transactions: ${filteredTransactions.length}</p>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Reference</th>
              <th>Vendor/Customer</th>
              <th>Memo</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTransactions.map(txn => `
              <tr>
                <td>${format(new Date(txn.date), 'MMM d, yyyy')}</td>
                <td><span class="type-badge">${getTransactionTypeLabel(txn.transactionType)}</span></td>
                <td>${getReferenceDisplay(txn)}</td>
                <td>${getContactName(txn)}</td>
                <td>${txn.memo || '-'}</td>
                <td class="amount">${formatCurrencyFull(getTotalAmount(txn))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.print()
    }
  }, [filteredTransactions, getContactName])

  // Get unique vendors/customers for filter dropdown
  const contactOptions = useMemo(() => {
    const contactIds = new Set<string>()
    transactions.forEach(txn => {
      if (txn.vendorId) contactIds.add(txn.vendorId)
      if (txn.customerId) contactIds.add(txn.customerId)
    })

    const options: { value: string; label: string }[] = [{ value: 'all', label: 'All Vendors/Customers' }]

    contactIds.forEach(id => {
      const vendor = vendorMap.get(id)
      const customer = customerMap.get(id)
      const name = vendor?.name || customer?.name
      if (name) {
        options.push({ value: id, label: name })
      }
    })

    return options.sort((a, b) => {
      if (a.value === 'all') return -1
      if (b.value === 'all') return 1
      return a.label.localeCompare(b.label)
    })
  }, [transactions, vendorMap, customerMap])

  // Render sort indicator
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <span className={styles.sortIndicator} aria-hidden="true"></span>
    }
    return (
      <span className={styles.sortIndicatorActive} aria-hidden="true">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  if (transactions.length === 0) {
    return null
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {showExport && filteredTransactions.length > 0 && (
          <div className={styles.exportButtons}>
            <button
              type="button"
              className={styles.exportButton}
              onClick={exportToCSV}
              aria-label="Export to CSV"
            >
              Export CSV
            </button>
            <button
              type="button"
              className={styles.exportButton}
              onClick={exportToPDF}
              aria-label="Export to PDF"
            >
              Export PDF
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className={styles.filters}>
          {/* Date Range Filter */}
          <div className={styles.filterGroup}>
            <label htmlFor="dateRange" className={styles.filterLabel}>
              Date Range
            </label>
            <select
              id="dateRange"
              className={styles.filterSelect}
              value={dateRangePreset}
              onChange={(e) => {
                setDateRangePreset(e.target.value)
                handleFilterChange()
              }}
            >
              {DATE_RANGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Custom Date Range Inputs */}
          {dateRangePreset === 'custom' && (
            <>
              <div className={styles.filterGroup}>
                <label htmlFor="startDate" className={styles.filterLabel}>
                  From
                </label>
                <input
                  type="date"
                  id="startDate"
                  className={styles.filterInput}
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value)
                    handleFilterChange()
                  }}
                />
              </div>
              <div className={styles.filterGroup}>
                <label htmlFor="endDate" className={styles.filterLabel}>
                  To
                </label>
                <input
                  type="date"
                  id="endDate"
                  className={styles.filterInput}
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value)
                    handleFilterChange()
                  }}
                />
              </div>
            </>
          )}

          {/* Type Filter */}
          <div className={styles.filterGroup}>
            <label htmlFor="typeFilter" className={styles.filterLabel}>
              Type
            </label>
            <select
              id="typeFilter"
              className={styles.filterSelect}
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as TransactionType | 'all')
                handleFilterChange()
              }}
            >
              {TRANSACTION_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Vendor/Customer Filter */}
          <div className={styles.filterGroup}>
            <label htmlFor="vendorFilter" className={styles.filterLabel}>
              Vendor/Customer
            </label>
            <select
              id="vendorFilter"
              className={styles.filterSelect}
              value={vendorFilter}
              onChange={(e) => {
                setVendorFilter(e.target.value)
                handleFilterChange()
              }}
            >
              {contactOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className={styles.resultsCount}>
        Showing {paginatedTransactions.length} of {filteredTransactions.length} transactions
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  className={styles.sortButton}
                  onClick={() => handleSort('date')}
                  aria-label={`Sort by date ${sortField === 'date' ? (sortDirection === 'asc' ? 'descending' : 'ascending') : 'descending'}`}
                >
                  Date {renderSortIndicator('date')}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className={styles.sortButton}
                  onClick={() => handleSort('type')}
                  aria-label={`Sort by type ${sortField === 'type' ? (sortDirection === 'asc' ? 'descending' : 'ascending') : 'ascending'}`}
                >
                  Type {renderSortIndicator('type')}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className={styles.sortButton}
                  onClick={() => handleSort('reference')}
                  aria-label={`Sort by reference ${sortField === 'reference' ? (sortDirection === 'asc' ? 'descending' : 'ascending') : 'ascending'}`}
                >
                  Reference {renderSortIndicator('reference')}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className={styles.sortButton}
                  onClick={() => handleSort('vendor')}
                  aria-label={`Sort by vendor ${sortField === 'vendor' ? (sortDirection === 'asc' ? 'descending' : 'ascending') : 'ascending'}`}
                >
                  Vendor/Customer {renderSortIndicator('vendor')}
                </button>
              </th>
              <th>Memo</th>
              <th className={styles.amountHeader}>
                <button
                  type="button"
                  className={styles.sortButton}
                  onClick={() => handleSort('amount')}
                  aria-label={`Sort by amount ${sortField === 'amount' ? (sortDirection === 'asc' ? 'descending' : 'ascending') : 'ascending'}`}
                >
                  Amount {renderSortIndicator('amount')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyState}>
                  No transactions match your filters
                </td>
              </tr>
            ) : (
              paginatedTransactions.map((txn) => (
                <tr
                  key={txn.id}
                  className={styles.row}
                  onClick={() => onTransactionClick?.(txn)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onTransactionClick?.(txn)
                    }
                  }}
                  role="button"
                  aria-label={`View transaction from ${format(new Date(txn.date), 'MMMM d, yyyy')}`}
                >
                  <td className={styles.dateCell}>
                    {format(new Date(txn.date), 'MMM d, yyyy')}
                  </td>
                  <td className={styles.typeCell}>
                    {txn.transactionType ? (
                      <TransactionTypeBadge type={txn.transactionType} size="sm" />
                    ) : (
                      <span className={styles.typeBadgeDefault}>Transaction</span>
                    )}
                  </td>
                  <td className={styles.referenceCell}>
                    {getReferenceDisplay(txn)}
                  </td>
                  <td className={styles.vendorCell}>
                    {getContactName(txn)}
                  </td>
                  <td className={styles.memoCell}>
                    {txn.memo || '-'}
                  </td>
                  <td className={styles.amountCell}>
                    {formatCurrencyFull(getTotalAmount(txn))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredTransactions.length > pageSize && (
        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Page {currentPage} of {totalPages}
          </div>
          <div className={styles.paginationControls}>
            <button
              type="button"
              className={styles.paginationButton}
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              aria-label="Go to first page"
            >
              First
            </button>
            <button
              type="button"
              className={styles.paginationButton}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              aria-label="Go to previous page"
            >
              Previous
            </button>
            <button
              type="button"
              className={styles.paginationButton}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              aria-label="Go to next page"
            >
              Next
            </button>
            <button
              type="button"
              className={styles.paginationButton}
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              aria-label="Go to last page"
            >
              Last
            </button>
          </div>
          <div className={styles.pageSizeSelector}>
            <label htmlFor="pageSize" className={styles.pageSizeLabel}>
              Show:
            </label>
            <select
              id="pageSize"
              className={styles.pageSizeSelect}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
