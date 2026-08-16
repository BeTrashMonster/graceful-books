/**
 * CustomerInsights Component
 *
 * Displays transaction insights for customers, similar to Vendor Intel.
 * Shows revenue patterns, invoice status, and transaction details.
 *
 * Features:
 * - Master-detail customer list with revenue overview
 * - Invoice history per customer with overdue tracking
 * - Current vs Overdue breakdown
 * - Date range filtering
 * - Overdue filter
 * - Export capabilities
 * - WCAG 2.1 AA accessible
 */

import { type FC, useState, useMemo, useEffect, useRef } from 'react'
import { Select, type SelectOption } from '../forms/Select'
import { Button } from '../core/Button'
import type { Contact } from '../../types'
import styles from './CustomerInsights.module.css'

type OverdueFilter = 'all' | 'current' | 'overdue'

export interface CustomerInsightsProps {
  /**
   * Current company ID
   */
  companyId: string
  /**
   * List of customers
   */
  customers: Contact[]
  /**
   * Callback to edit a customer
   */
  onEditCustomer?: (customer: Contact) => void
  /**
   * Callback to create a new customer
   */
  onCreateCustomer?: () => void
  /**
   * Loading state
   */
  isLoading?: boolean
}

// Types for customer insights data
interface CustomerRevenueSummary {
  customerId: string
  customerName: string
  totalRevenue: number
  currentAmount: number
  overdueAmount: number
  transactionCount: number
  lastTransactionDate: Date | null
}

interface ProductServiceBreakdown {
  id: string
  name: string
  type: 'product' | 'service'
  totalRevenue: number
  transactionCount: number
  percentageOfTotal: number
}

type TransactionType = 'invoice' | 'invoice-payment' | 'billable-expense' | 'reimbursable-expense'

interface TransactionDetail {
  id: string
  customerId: string
  date: Date
  dueDate: Date
  reference: string
  description: string
  amount: number
  amountPaid: number
  amountDue: number
  status: 'current' | 'overdue' | 'paid'
  daysLate: number
  productService: string
  type: TransactionType
}

type TransactionSortField = 'date' | 'dueDate' | 'reference' | 'description' | 'type' | 'status' | 'amount'
type SortDirection = 'asc' | 'desc'

/**
 * Format transaction type for display
 */
function formatTransactionType(type: TransactionType): string {
  switch (type) {
    case 'invoice':
      return 'Invoice'
    case 'invoice-payment':
      return 'Payment'
    case 'billable-expense':
      return 'Billable Expense'
    case 'reimbursable-expense':
      return 'Reimbursable'
  }
}

// Products/Services with placeholder data
const PRODUCTS_SERVICES = [
  { id: 'consulting', name: 'Consulting Services', type: 'service' as const },
  { id: 'development', name: 'Development', type: 'service' as const },
  { id: 'design', name: 'Design Services', type: 'service' as const },
  { id: 'support', name: 'Support Package', type: 'product' as const },
  { id: 'license', name: 'Software License', type: 'product' as const },
]

type DateRangeFilter = '3mo' | '6mo' | '12mo' | 'ytd' | 'this-year' | 'last-year' | 'custom' | 'all'

/**
 * Format currency amount
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const day = date.getUTCDate()
  const year = date.getUTCFullYear()
  return `${month} ${day}, ${year}`
}

/**
 * Get date string (YYYY-MM-DD) from Date object - timezone safe
 */
function toDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get today's date string (YYYY-MM-DD)
 */
function getTodayString(): string {
  return toDateString(new Date())
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000
  return Math.round((date2.getTime() - date1.getTime()) / oneDay)
}

/**
 * Get date range based on filter
 */
function getDateRange(filter: DateRangeFilter): { start: string | null; end: string | null } {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const day = today.getDate()

  switch (filter) {
    case '3mo': {
      const start = new Date(year, month - 3, day)
      return { start: toDateString(start), end: getTodayString() }
    }
    case '6mo': {
      const start = new Date(year, month - 6, day)
      return { start: toDateString(start), end: getTodayString() }
    }
    case '12mo': {
      const start = new Date(year - 1, month, day)
      return { start: toDateString(start), end: getTodayString() }
    }
    case 'ytd': {
      return { start: `${year}-01-01`, end: getTodayString() }
    }
    case 'this-year': {
      return { start: `${year}-01-01`, end: `${year}-12-31` }
    }
    case 'last-year': {
      return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` }
    }
    case 'custom':
      return { start: null, end: null }
    case 'all':
      return { start: null, end: null }
  }
}

/**
 * Check if a date falls within a range
 */
function isDateInRange(dateStr: string, start: string | null, end: string | null): boolean {
  if (start && dateStr < start) return false
  if (end && dateStr > end) return false
  return true
}

/**
 * CustomerInsights Component
 */
export const CustomerInsights: FC<CustomerInsightsProps> = ({
  companyId,
  customers,
  onEditCustomer,
  onCreateCustomer,
  isLoading = false,
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRangeFilter>('12mo')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Product/Service filter state (multi-select)
  const [selectedProductsServices, setSelectedProductsServices] = useState<string[]>([])
  const [isProductServiceDropdownOpen, setIsProductServiceDropdownOpen] = useState(false)
  const productServiceDropdownRef = useRef<HTMLDivElement>(null)

  // Overdue filter state
  const [overdueFilter, setOverdueFilter] = useState<OverdueFilter>('all')

  // Custom date range state
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  // Transaction table sorting state
  const [txnSortField, setTxnSortField] = useState<TransactionSortField>('date')
  const [txnSortDirection, setTxnSortDirection] = useState<SortDirection>('desc')

  // Track if we've done initial auto-selection
  const hasAutoSelected = useRef(false)

  // Get the active date range
  const activeDateRange = useMemo(() => {
    if (dateRange === 'custom') {
      return {
        start: customStartDate || null,
        end: customEndDate || null,
      }
    }
    return getDateRange(dateRange)
  }, [dateRange, customStartDate, customEndDate])

  // Generate ALL transactions for ALL customers upfront (mock data)
  const allTransactions: TransactionDetail[] = useMemo(() => {
    const types: TransactionType[] = ['invoice', 'invoice-payment', 'billable-expense', 'reimbursable-expense']
    const descriptions = [
      'Monthly retainer',
      'Project milestone',
      'Consulting engagement',
      'Software license',
      'Support services',
      'Design work',
      'Development sprint',
      'Training session',
    ]

    const transactions: TransactionDetail[] = []
    const today = new Date()

    customers.forEach((customer, customerIndex) => {
      const txnCount = 10 + Math.floor(Math.random() * 40)

      for (let i = 0; i < txnCount; i++) {
        const amount = Math.random() * 10000 + 500
        const daysAgo = Math.floor(Math.random() * 730)
        const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
        const dueDaysAfter = 30 + Math.floor(Math.random() * 30)
        const dueDate = new Date(date.getTime() + dueDaysAfter * 24 * 60 * 60 * 1000)

        const type = types[Math.floor(Math.random() * types.length)]!
        const isPaid = type === 'invoice-payment' || Math.random() > 0.3
        const amountPaid = isPaid ? amount : Math.random() > 0.5 ? amount * Math.random() : 0
        const amountDue = amount - amountPaid

        let status: 'current' | 'overdue' | 'paid' = 'current'
        let daysLate = 0

        if (amountDue <= 0) {
          status = 'paid'
        } else if (dueDate < today) {
          status = 'overdue'
          daysLate = daysBetween(dueDate, today)
        }

        const productService = PRODUCTS_SERVICES[Math.floor(Math.random() * PRODUCTS_SERVICES.length)]!

        transactions.push({
          id: `txn-${customerIndex}-${i}`,
          customerId: customer.id,
          date,
          dueDate,
          reference: `INV-${String(2000 + customerIndex * 100 + i).padStart(4, '0')}`,
          description: descriptions[Math.floor(Math.random() * descriptions.length)]!,
          amount,
          amountPaid,
          amountDue,
          status,
          daysLate,
          productService: productService.name,
          type,
        })
      }
    })

    return transactions.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [customers])

  // Filter ALL transactions by date range
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((txn) => {
      const txnDateStr = toDateString(txn.date)
      return isDateInRange(txnDateStr, activeDateRange.start, activeDateRange.end)
    })
  }, [allTransactions, activeDateRange])

  // Calculate customer summaries from FILTERED transactions
  const customerSummaries: CustomerRevenueSummary[] = useMemo(() => {
    return customers.map((customer) => {
      const customerTxns = filteredTransactions.filter((t) => t.customerId === customer.id)
      const totalRevenue = customerTxns
        .filter((t) => t.type === 'invoice' || t.type === 'billable-expense' || t.type === 'reimbursable-expense')
        .reduce((sum, t) => sum + t.amount, 0)
      const currentAmount = customerTxns
        .filter((t) => t.status === 'current')
        .reduce((sum, t) => sum + t.amountDue, 0)
      const overdueAmount = customerTxns
        .filter((t) => t.status === 'overdue')
        .reduce((sum, t) => sum + t.amountDue, 0)
      const lastTxn = customerTxns[0]

      return {
        customerId: customer.id,
        customerName: customer.name,
        totalRevenue,
        currentAmount,
        overdueAmount,
        transactionCount: customerTxns.length,
        lastTransactionDate: lastTxn?.date || null,
      }
    })
  }, [customers, filteredTransactions])

  // Close product/service dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productServiceDropdownRef.current && !productServiceDropdownRef.current.contains(event.target as Node)) {
        setIsProductServiceDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Get unique products/services from all transactions for filter dropdown
  const availableProductsServices = useMemo(() => {
    const psSet = new Set<string>()
    filteredTransactions.forEach((txn) => {
      psSet.add(txn.productService)
    })
    return Array.from(psSet).sort()
  }, [filteredTransactions])

  // Toggle product/service selection
  const toggleProductService = (ps: string) => {
    setSelectedProductsServices((prev) =>
      prev.includes(ps)
        ? prev.filter((p) => p !== ps)
        : [...prev, ps]
    )
  }

  // Filter and sort customers
  const sortedCustomers = useMemo(() => {
    let filtered = [...customerSummaries]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((c) => c.customerName.toLowerCase().includes(query))
    }

    // Apply overdue filter
    if (overdueFilter === 'overdue') {
      filtered = filtered.filter((c) => c.overdueAmount > 0)
    } else if (overdueFilter === 'current') {
      filtered = filtered.filter((c) => c.overdueAmount === 0)
    }

    // Apply product/service filter
    if (selectedProductsServices.length > 0) {
      filtered = filtered.filter((c) => {
        const customerTxns = filteredTransactions.filter((t) => t.customerId === c.customerId)
        return customerTxns.some((txn) => selectedProductsServices.includes(txn.productService))
      })
    }

    // Always sort by highest revenue
    return filtered.sort((a, b) => b.totalRevenue - a.totalRevenue)
  }, [customerSummaries, searchQuery, overdueFilter, selectedProductsServices, filteredTransactions])

  // Auto-select top customer on initial load
  useEffect(() => {
    if (!hasAutoSelected.current && sortedCustomers.length > 0 && !selectedCustomerId) {
      const topCustomer = sortedCustomers[0]
      if (topCustomer && topCustomer.totalRevenue > 0) {
        setSelectedCustomerId(topCustomer.customerId)
        hasAutoSelected.current = true
      }
    }
  }, [sortedCustomers, selectedCustomerId])

  // Get transactions for selected customer (already filtered by date)
  const selectedCustomerTransactions = useMemo(() => {
    if (!selectedCustomerId) return []
    let txns = filteredTransactions.filter((t) => t.customerId === selectedCustomerId)

    // Apply overdue filter to transactions
    if (overdueFilter === 'overdue') {
      txns = txns.filter((t) => t.status === 'overdue')
    } else if (overdueFilter === 'current') {
      txns = txns.filter((t) => t.status === 'current' || t.status === 'paid')
    }

    // Apply product/service filter
    if (selectedProductsServices.length > 0) {
      txns = txns.filter((t) => selectedProductsServices.includes(t.productService))
    }

    return txns
  }, [filteredTransactions, selectedCustomerId, overdueFilter, selectedProductsServices])

  // Sort selected customer transactions
  const sortedCustomerTransactions = useMemo(() => {
    const sorted = [...selectedCustomerTransactions]
    const direction = txnSortDirection === 'asc' ? 1 : -1

    sorted.sort((a, b) => {
      switch (txnSortField) {
        case 'date':
          return direction * (a.date.getTime() - b.date.getTime())
        case 'dueDate':
          return direction * (a.dueDate.getTime() - b.dueDate.getTime())
        case 'reference':
          return direction * a.reference.localeCompare(b.reference)
        case 'description':
          return direction * a.description.localeCompare(b.description)
        case 'type':
          return direction * a.type.localeCompare(b.type)
        case 'status':
          return direction * a.status.localeCompare(b.status)
        case 'amount':
          return direction * (a.amount - b.amount)
        default:
          return 0
      }
    })

    return sorted
  }, [selectedCustomerTransactions, txnSortField, txnSortDirection])

  // Handle column header click for sorting
  const handleColumnSort = (field: TransactionSortField) => {
    if (txnSortField === field) {
      setTxnSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setTxnSortField(field)
      setTxnSortDirection(field === 'date' || field === 'dueDate' || field === 'amount' ? 'desc' : 'asc')
    }
  }

  // Export customer transactions to CSV
  const exportCustomerTransactionsCSV = () => {
    if (!selectedCustomer || sortedCustomerTransactions.length === 0) return

    const headers = ['Date', 'Due Date', 'Type', 'Reference', 'Description', 'Amount', 'Amount Due', 'Status', 'Days Late']
    const rows = sortedCustomerTransactions.map((txn) => [
      toDateString(txn.date),
      toDateString(txn.dueDate),
      formatTransactionType(txn.type),
      txn.reference,
      `"${txn.description.replace(/"/g, '""')}"`,
      txn.amount.toFixed(2),
      txn.amountDue.toFixed(2),
      txn.status,
      txn.daysLate.toString(),
    ])

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedCustomer.customerName.replace(/[^a-z0-9]/gi, '_')}_transactions.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Calculate product/service breakdown from FILTERED transactions for selected customer
  const productServiceBreakdown: ProductServiceBreakdown[] = useMemo(() => {
    if (selectedCustomerTransactions.length === 0) return []

    const psTotals = new Map<string, { revenue: number; count: number; type: 'product' | 'service' }>()

    selectedCustomerTransactions.forEach((txn) => {
      if (txn.type === 'invoice' || txn.type === 'billable-expense' || txn.type === 'reimbursable-expense') {
        const existing = psTotals.get(txn.productService) || { revenue: 0, count: 0, type: 'service' as const }
        const psInfo = PRODUCTS_SERVICES.find((ps) => ps.name === txn.productService)
        psTotals.set(txn.productService, {
          revenue: existing.revenue + txn.amount,
          count: existing.count + 1,
          type: psInfo?.type || 'service',
        })
      }
    })

    const totalRevenue = Array.from(psTotals.values()).reduce((sum, ps) => sum + ps.revenue, 0)

    return Array.from(psTotals.entries())
      .map(([name, data], index) => ({
        id: `ps-${index}`,
        name,
        type: data.type,
        totalRevenue: data.revenue,
        transactionCount: data.count,
        percentageOfTotal: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
  }, [selectedCustomerTransactions])

  // Get selected customer summary
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null
    return customerSummaries.find((c) => c.customerId === selectedCustomerId) || null
  }, [customerSummaries, selectedCustomerId])

  // Get full customer object for editing
  const selectedCustomerFull = useMemo(() => {
    if (!selectedCustomerId) return null
    return customers.find((c) => c.id === selectedCustomerId) || null
  }, [customers, selectedCustomerId])

  // Handle edit customer click
  const handleEditCustomerClick = () => {
    if (selectedCustomerFull && onEditCustomer) {
      onEditCustomer(selectedCustomerFull)
    }
  }

  // Filter transactions by selected product/services (for overview stats)
  const productServiceFilteredTransactions = useMemo(() => {
    if (selectedProductsServices.length === 0) {
      return filteredTransactions
    }
    return filteredTransactions.filter((txn) =>
      selectedProductsServices.includes(txn.productService)
    )
  }, [filteredTransactions, selectedProductsServices])

  // Calculate aggregate stats (respects filters)
  const aggregateStats = useMemo(() => {
    // Apply overdue filter to transactions for stats
    let statsTransactions = productServiceFilteredTransactions
    if (overdueFilter === 'overdue') {
      statsTransactions = statsTransactions.filter((t) => t.status === 'overdue')
    } else if (overdueFilter === 'current') {
      statsTransactions = statsTransactions.filter((t) => t.status === 'current' || t.status === 'paid')
    }

    const totalRevenue = statsTransactions
      .filter((t) => t.type === 'invoice' || t.type === 'billable-expense' || t.type === 'reimbursable-expense')
      .reduce((sum, t) => sum + t.amount, 0)

    const currentAmount = statsTransactions
      .filter((t) => t.status === 'current')
      .reduce((sum, t) => sum + t.amountDue, 0)

    const overdueAmount = statsTransactions
      .filter((t) => t.status === 'overdue')
      .reduce((sum, t) => sum + t.amountDue, 0)

    const topCustomer = sortedCustomers.find((c) => c.totalRevenue > 0)

    // Determine filter labels
    const isFiltered = selectedProductsServices.length > 0 || overdueFilter !== 'all'
    let filterLabel = ''
    if (selectedProductsServices.length === 1) {
      filterLabel = selectedProductsServices[0]!
    } else if (selectedProductsServices.length > 1) {
      filterLabel = `${selectedProductsServices.length} Products/Services`
    }
    if (overdueFilter === 'overdue') {
      filterLabel = filterLabel ? `${filterLabel} (Overdue)` : 'Overdue Only'
    } else if (overdueFilter === 'current') {
      filterLabel = filterLabel ? `${filterLabel} (Current)` : 'Current Only'
    }

    // Calculate top product/service across all filtered transactions
    const psRevenueTotals = new Map<string, number>()
    statsTransactions.forEach((txn) => {
      if (txn.type === 'invoice' || txn.type === 'billable-expense' || txn.type === 'reimbursable-expense') {
        const existing = psRevenueTotals.get(txn.productService) || 0
        psRevenueTotals.set(txn.productService, existing + txn.amount)
      }
    })

    let topProductService = 'N/A'
    let topProductServiceRevenue = 0
    psRevenueTotals.forEach((revenue, name) => {
      if (revenue > topProductServiceRevenue) {
        topProductServiceRevenue = revenue
        topProductService = name
      }
    })

    return {
      totalRevenue,
      currentAmount,
      overdueAmount,
      topCustomerName: topCustomer?.customerName || 'N/A',
      topCustomerRevenue: topCustomer?.totalRevenue || 0,
      topProductService,
      topProductServiceRevenue,
      isFiltered,
      filterLabel,
    }
  }, [productServiceFilteredTransactions, sortedCustomers, selectedProductsServices, overdueFilter])

  const dateRangeOptions: SelectOption[] = [
    { value: '3mo', label: 'Last 3 Months' },
    { value: '6mo', label: 'Last 6 Months' },
    { value: '12mo', label: 'Last 12 Months' },
    { value: 'ytd', label: 'Year to Date' },
    { value: 'this-year', label: 'This Year' },
    { value: 'last-year', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' },
    { value: 'all', label: 'All Time' },
  ]

  const overdueOptions: SelectOption[] = [
    { value: 'all', label: 'All Status' },
    { value: 'current', label: 'Current' },
    { value: 'overdue', label: 'Overdue' },
  ]

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.filters}>
          {/* Search Bar */}
          <div className={styles.filterItem}>
            <div className={styles.searchWrapper}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customers..."
                className={styles.searchInput}
                aria-label="Search customers"
              />
              {searchQuery && (
                <button
                  className={styles.searchClear}
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>
          {/* Date Range */}
          <div className={styles.filterItem}>
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}
              options={dateRangeOptions}
              aria-label="Filter by date range"
              className={styles.filterSelect}
            />
          </div>
          {dateRange === 'custom' && (
            <>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className={styles.dateInput}
                aria-label="Start date"
              />
              <span className={styles.dateSeparator}>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className={styles.dateInput}
                aria-label="End date"
              />
            </>
          )}
          {/* Product/Service Multi-Select Dropdown */}
          <div className={styles.filterItem}>
            <div className={styles.multiSelectWrapper} ref={productServiceDropdownRef}>
              <button
                className={styles.multiSelectTrigger}
                onClick={() => setIsProductServiceDropdownOpen(!isProductServiceDropdownOpen)}
                aria-expanded={isProductServiceDropdownOpen}
                aria-haspopup="listbox"
              >
                <span className={styles.multiSelectLabel}>
                  {selectedProductsServices.length === 0
                    ? 'Products/Services'
                    : `${selectedProductsServices.length} selected`}
                </span>
                <span className={styles.multiSelectArrow}>▼</span>
              </button>
              {isProductServiceDropdownOpen && (
                <div
                  className={styles.multiSelectDropdown}
                  role="listbox"
                  onClick={(e) => e.stopPropagation()}
                >
                  {availableProductsServices.map((ps) => (
                    <label
                      key={ps}
                      className={styles.multiSelectOption}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedProductsServices.includes(ps)}
                        onChange={(e) => {
                          e.stopPropagation()
                          toggleProductService(ps)
                        }}
                      />
                      <span>{ps}</span>
                    </label>
                  ))}
                  {selectedProductsServices.length > 0 && (
                    <button
                      className={styles.multiSelectClear}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedProductsServices([])
                      }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Overdue Filter */}
          <div className={styles.filterItem}>
            <Select
              value={overdueFilter}
              onChange={(e) => setOverdueFilter(e.target.value as OverdueFilter)}
              options={overdueOptions}
              aria-label="Filter by payment status"
              className={styles.filterSelect}
            />
          </div>
        </div>
        <div className={styles.actions}>
          <Button variant="outline" size="sm">
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Row - Overview + Selected Customer Header */}
      <div className={styles.summaryRow}>
        {/* Overview Box (left) - Purple theme */}
        <div className={styles.overviewBox}>
          <div className={styles.overviewMain}>
            <span className={styles.overviewLabel}>
              {aggregateStats.isFiltered ? (
                <>Revenue for: <span className={styles.filterIndicator}>{aggregateStats.filterLabel}</span></>
              ) : (
                'Total Revenue'
              )}
            </span>
            <span className={styles.overviewValue}>{formatCurrency(aggregateStats.totalRevenue)}</span>
          </div>
          <div className={styles.overviewStatRow}>
            <div className={styles.overviewStatItem}>
              <span className={styles.overviewStatLabel}>Current</span>
              <span className={styles.overviewStatValue}>{formatCurrency(aggregateStats.currentAmount)}</span>
            </div>
            <div className={`${styles.overviewStatItem} ${aggregateStats.overdueAmount > 0 ? styles.overdueHighlight : ''}`}>
              <span className={styles.overviewStatLabel}>Overdue</span>
              <span className={styles.overviewStatValue}>{formatCurrency(aggregateStats.overdueAmount)}</span>
            </div>
          </div>
          <div className={styles.overviewTopRow}>
            <div className={styles.overviewTopCustomer}>
              <span className={styles.overviewStatLabel}>
                {aggregateStats.isFiltered ? 'Top Customer (Filtered)' : 'Top Customer'}
              </span>
              <span className={styles.overviewTopCustomerName}>{aggregateStats.topCustomerName}</span>
              <span className={styles.overviewTopCustomerRevenue}>{formatCurrency(aggregateStats.topCustomerRevenue)}</span>
            </div>
            <div className={styles.overviewTopProductService}>
              <span className={styles.overviewStatLabel}>
                {aggregateStats.isFiltered ? 'Top Product/Service (Filtered)' : 'Top Product/Service'}
              </span>
              <span className={styles.overviewTopProductServiceName}>{aggregateStats.topProductService}</span>
              <span className={styles.overviewTopProductServiceRevenue}>{formatCurrency(aggregateStats.topProductServiceRevenue)}</span>
            </div>
          </div>
        </div>

        {/* Selected Customer Header (right) - Gold theme */}
        <div className={styles.selectedCustomerBox}>
          {selectedCustomer && selectedCustomerFull ? (
            <>
              <div className={styles.selectedCustomerTop}>
                <div className={styles.selectedCustomerLeft}>
                  <h3 className={styles.selectedCustomerName}>{selectedCustomer.customerName}</h3>
                  {onEditCustomer && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleEditCustomerClick}
                    >
                      Edit Customer
                    </Button>
                  )}
                </div>
                <div className={styles.selectedCustomerStats}>
                  <div className={styles.selectedCustomerStat}>
                    <span className={styles.selectedCustomerStatLabel}>Total Revenue</span>
                    <span className={styles.selectedCustomerStatValue}>{formatCurrency(selectedCustomer.totalRevenue)}</span>
                  </div>
                  <div className={styles.selectedCustomerStat}>
                    <span className={styles.selectedCustomerStatLabel}>Current</span>
                    <span className={styles.selectedCustomerStatValueCurrent}>{formatCurrency(selectedCustomer.currentAmount)}</span>
                  </div>
                  <div className={styles.selectedCustomerStat}>
                    <span className={styles.selectedCustomerStatLabel}>Overdue</span>
                    <span className={`${styles.selectedCustomerStatValue} ${selectedCustomer.overdueAmount > 0 ? styles.overdueText : ''}`}>
                      {formatCurrency(selectedCustomer.overdueAmount)}
                    </span>
                  </div>
                </div>
              </div>
              {/* Contact Details */}
              <div className={styles.selectedCustomerContactDetails}>
                {selectedCustomerFull.email && (
                  <div className={styles.contactDetailItem}>
                    <span className={styles.contactDetailLabel}>Email</span>
                    <span className={styles.contactDetailValue}>{selectedCustomerFull.email}</span>
                  </div>
                )}
                {selectedCustomerFull.phone && (
                  <div className={styles.contactDetailItem}>
                    <span className={styles.contactDetailLabel}>Phone</span>
                    <span className={styles.contactDetailValue}>{selectedCustomerFull.phone}</span>
                  </div>
                )}
                {selectedCustomerFull.address && (
                  <div className={styles.contactDetailItem}>
                    <span className={styles.contactDetailLabel}>Address</span>
                    <span className={styles.contactDetailValue}>{selectedCustomerFull.address}</span>
                  </div>
                )}
                {selectedCustomerFull.notes && (
                  <div className={styles.contactDetailItem}>
                    <span className={styles.contactDetailLabel}>Notes</span>
                    <span className={styles.contactDetailValue}>{selectedCustomerFull.notes}</span>
                  </div>
                )}
                {!selectedCustomerFull.email && !selectedCustomerFull.phone && !selectedCustomerFull.address && !selectedCustomerFull.notes && (
                  <div className={styles.noContactDetails}>No contact details on file</div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.selectedCustomerEmpty}>
              <span>Select a customer to view details</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Customer List */}
        <div className={styles.customerList}>
          <div className={styles.customerListHeader}>
            <h3 className={styles.sectionTitle}>Customers ({sortedCustomers.length})</h3>
            {onCreateCustomer && (
              <Button variant="primary" size="sm" onClick={onCreateCustomer}>
                Add Customer
              </Button>
            )}
          </div>
          <div className={styles.customerListContent}>
            {sortedCustomers.map((customer) => (
              <button
                key={customer.customerId}
                className={`${styles.customerItem} ${selectedCustomerId === customer.customerId ? styles.customerItemSelected : ''} ${customer.overdueAmount > 0 ? styles.customerItemOverdue : ''}`}
                onClick={() => setSelectedCustomerId(customer.customerId)}
                aria-pressed={selectedCustomerId === customer.customerId}
              >
                <div className={styles.customerInfo}>
                  <span className={styles.customerName}>
                    {customer.customerName}
                    {customer.overdueAmount > 0 && (
                      <span className={styles.overdueBadge}>Overdue</span>
                    )}
                  </span>
                  <span className={styles.customerMeta}>
                    {customer.transactionCount} transactions
                  </span>
                </div>
                <div className={styles.customerRevenue}>
                  <span className={styles.revenueAmount}>{formatCurrency(customer.totalRevenue)}</span>
                  {customer.overdueAmount > 0 && (
                    <span className={styles.overdueAmount}>{formatCurrency(customer.overdueAmount)} overdue</span>
                  )}
                </div>
              </button>
            ))}
            {sortedCustomers.length === 0 && (
              <div className={styles.emptyState}>
                {searchQuery ? 'No customers match your search' : 'No customers found'}
              </div>
            )}
          </div>
        </div>

        {/* Customer Details */}
        <div className={styles.customerDetails}>
          {selectedCustomer ? (
            <>
              {/* Product/Service Breakdown */}
              <div className={styles.section}>
                <div className={styles.breakdownList}>
                  {productServiceBreakdown.map((ps) => (
                    <div key={ps.id} className={styles.breakdownItem}>
                      <div className={styles.breakdownHeader}>
                        <span className={styles.breakdownBadge} data-type={ps.type}>
                          {ps.type === 'product' ? 'Product' : 'Service'}
                        </span>
                        <span className={styles.breakdownName}>{ps.name}</span>
                        <span className={styles.breakdownPercent}>{ps.percentageOfTotal.toFixed(0)}%</span>
                      </div>
                      <div className={styles.breakdownBar}>
                        <div
                          className={styles.breakdownBarFill}
                          style={{ width: `${ps.percentageOfTotal}%` }}
                          data-type={ps.type}
                        />
                      </div>
                      <div className={styles.breakdownStats}>
                        <span>{formatCurrency(ps.totalRevenue)}</span>
                        <span>{ps.transactionCount} transactions</span>
                      </div>
                    </div>
                  ))}
                  {productServiceBreakdown.length === 0 && (
                    <div className={styles.emptyState}>
                      No transactions in this date range
                    </div>
                  )}
                </div>
              </div>

              {/* Transaction History */}
              <div className={styles.section}>
                <div className={styles.transactionSectionHeader}>
                  <h4 className={styles.sectionTitle}>
                    Transactions ({sortedCustomerTransactions.length})
                  </h4>
                  {sortedCustomerTransactions.length > 0 && (
                    <Button variant="outline" size="sm" onClick={exportCustomerTransactionsCSV}>
                      Export Customer CSV
                    </Button>
                  )}
                </div>
                {sortedCustomerTransactions.length > 0 ? (
                  <div className={styles.transactionList}>
                    <div className={styles.transactionHeader}>
                      <button
                        className={`${styles.sortableHeader} ${txnSortField === 'date' ? styles.sortActive : ''}`}
                        onClick={() => handleColumnSort('date')}
                      >
                        Date {txnSortField === 'date' && (txnSortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                      <button
                        className={`${styles.sortableHeader} ${txnSortField === 'type' ? styles.sortActive : ''}`}
                        onClick={() => handleColumnSort('type')}
                      >
                        Type {txnSortField === 'type' && (txnSortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                      <button
                        className={`${styles.sortableHeader} ${txnSortField === 'reference' ? styles.sortActive : ''}`}
                        onClick={() => handleColumnSort('reference')}
                      >
                        Reference {txnSortField === 'reference' && (txnSortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                      <button
                        className={`${styles.sortableHeader} ${txnSortField === 'description' ? styles.sortActive : ''}`}
                        onClick={() => handleColumnSort('description')}
                      >
                        Description {txnSortField === 'description' && (txnSortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                      <button
                        className={`${styles.sortableHeader} ${txnSortField === 'status' ? styles.sortActive : ''}`}
                        onClick={() => handleColumnSort('status')}
                      >
                        Status {txnSortField === 'status' && (txnSortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                      <button
                        className={`${styles.sortableHeader} ${txnSortField === 'amount' ? styles.sortActive : ''}`}
                        onClick={() => handleColumnSort('amount')}
                      >
                        Amount {txnSortField === 'amount' && (txnSortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </div>
                    {sortedCustomerTransactions.slice(0, 10).map((txn) => (
                      <div key={txn.id} className={`${styles.transactionRow} ${txn.status === 'overdue' ? styles.transactionOverdue : ''}`}>
                        <span>{formatDate(txn.date)}</span>
                        <span className={styles.transactionType}>{formatTransactionType(txn.type)}</span>
                        <span className={styles.transactionRef}>{txn.reference}</span>
                        <span className={styles.transactionDesc}>{txn.description}</span>
                        <span className={styles.transactionStatus} data-status={txn.status}>
                          {txn.status === 'overdue' ? (
                            <span className={styles.overdueStatus}>
                              {txn.daysLate} days late
                            </span>
                          ) : txn.status === 'paid' ? (
                            'Paid'
                          ) : (
                            'Current'
                          )}
                        </span>
                        <span className={styles.transactionAmount}>
                          {formatCurrency(txn.amount)}
                          {txn.amountDue > 0 && txn.status !== 'paid' && (
                            <span className={styles.amountDue}>({formatCurrency(txn.amountDue)} due)</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    No transactions found for the selected filters
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.selectPrompt}>
              <div className={styles.selectPromptIcon}>📊</div>
              <h3>Select a customer to view insights</h3>
              <p>Click on a customer from the list to see their revenue breakdown and transaction history</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
