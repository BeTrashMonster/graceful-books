/**
 * VendorInsights Component
 *
 * Displays transaction insights for vendors, similar to CPG Vendor Intel.
 * Shows spending patterns, group breakdowns, and transaction details.
 *
 * Features:
 * - Master-detail vendor list with spending overview
 * - Transaction history per vendor
 * - Group (category) breakdown
 * - Date range filtering
 * - Export capabilities
 * - WCAG 2.1 AA accessible
 */

import { type FC, useState, useMemo, useEffect, useRef } from 'react'
import { Select, type SelectOption } from '../forms/Select'
import { Button } from '../core/Button'
import type { Vendor } from '../../types/vendor.types'
import styles from './VendorInsights.module.css'

type Vendor1099Filter = 'all' | '1099-only' | 'non-1099'
type OverdueFilter = 'all' | 'current' | 'overdue'

export interface VendorInsightsProps {
  /**
   * Current company ID
   */
  companyId: string
  /**
   * List of vendors
   */
  vendors: Vendor[]
  /**
   * Callback to edit a vendor
   */
  onEditVendor?: (vendor: Vendor) => void
  /**
   * Callback to create a new vendor
   */
  onCreateVendor?: () => void
  /**
   * Loading state
   */
  isLoading?: boolean
}

// Types for vendor insights data
interface VendorSpendingSummary {
  vendorId: string
  vendorName: string
  totalBills: number
  paidAmount: number
  stillOwe: number
  currentAmount: number
  overdueAmount: number
  transactionCount: number
  lastTransactionDate: Date | null
  is1099Eligible: boolean
}

interface GroupBreakdown {
  groupId: string
  groupName: string
  groupColor: string
  totalSpend: number
  transactionCount: number
  percentageOfTotal: number
}

type TransactionType = 'expense' | 'bill' | 'bill-payment' | 'check' | 'journal-entry'

interface TransactionClassification {
  name: string
  color: string
  amount: number
}

interface TransactionDetail {
  id: string
  vendorId: string
  date: Date
  dueDate: Date
  reference: string
  description: string
  amount: number
  amountPaid: number
  amountDue: number
  status: 'current' | 'overdue' | 'paid'
  daysLate: number
  classifications: TransactionClassification[]
  type: TransactionType
}

type TransactionSortField = 'date' | 'reference' | 'description' | 'type' | 'classification' | 'amount'
type SortDirection = 'asc' | 'desc'

/**
 * Format transaction type for display
 */
function formatTransactionType(type: TransactionType): string {
  switch (type) {
    case 'expense':
      return 'Expense'
    case 'bill':
      return 'Bill'
    case 'bill-payment':
      return 'Bill Payment'
    case 'check':
      return 'Check'
    case 'journal-entry':
      return 'Journal Entry'
  }
}

// Classification groups with colors
const CLASSIFICATION_GROUPS = [
  { id: 'operating', name: 'Operating Expenses', color: '#4b006e' },
  { id: 'marketing', name: 'Marketing', color: '#1e3a5f' },
  { id: 'office', name: 'Office Supplies', color: '#92400e' },
  { id: 'professional', name: 'Professional Services', color: '#742a2a' },
  { id: 'utilities', name: 'Utilities', color: '#1a4731' },
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
  // Use UTC methods to avoid timezone shifts
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
 * Get date range based on filter - returns [startDate, endDate] as YYYY-MM-DD strings
 * Returns null for dates that should not be bounded
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
      // January 1st of current year through today
      return { start: `${year}-01-01`, end: getTodayString() }
    }
    case 'this-year': {
      // January 1st through December 31st of current year
      return { start: `${year}-01-01`, end: `${year}-12-31` }
    }
    case 'last-year': {
      // January 1st through December 31st of last year
      return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` }
    }
    case 'custom':
      // Custom handled by separate state
      return { start: null, end: null }
    case 'all':
      return { start: null, end: null }
  }
}

/**
 * Check if a date falls within a range (inclusive) - simple string comparison
 */
function isDateInRange(dateStr: string, start: string | null, end: string | null): boolean {
  if (start && dateStr < start) return false
  if (end && dateStr > end) return false
  return true
}

/**
 * VendorInsights Component
 */
export const VendorInsights: FC<VendorInsightsProps> = ({
  companyId,
  vendors,
  onEditVendor,
  onCreateVendor,
  isLoading = false,
}) => {
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRangeFilter>('12mo')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Classification filter state (multi-select)
  const [selectedClassifications, setSelectedClassifications] = useState<string[]>([])
  const [isClassificationDropdownOpen, setIsClassificationDropdownOpen] = useState(false)
  const classificationDropdownRef = useRef<HTMLDivElement>(null)

  // 1099 filter state
  const [vendor1099Filter, setVendor1099Filter] = useState<Vendor1099Filter>('all')

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

  // Get the active date range (either from preset or custom)
  const activeDateRange = useMemo(() => {
    if (dateRange === 'custom') {
      return {
        start: customStartDate || null,
        end: customEndDate || null,
      }
    }
    return getDateRange(dateRange)
  }, [dateRange, customStartDate, customEndDate])

  // Generate ALL transactions for ALL vendors upfront (mock data - will be replaced with real data)
  const allTransactions: TransactionDetail[] = useMemo(() => {
    const types: TransactionType[] = ['expense', 'bill', 'bill-payment', 'check', 'journal-entry']
    const descriptions = [
      'Monthly service fee',
      'Product delivery',
      'Consulting services',
      'Equipment purchase',
      'Subscription renewal',
      'Maintenance contract',
      'Supply order',
      'Project payment',
    ]

    const transactions: TransactionDetail[] = []
    const today = new Date()

    // Generate 10-50 transactions per vendor, spread across 2 years
    vendors.forEach((vendor, vendorIndex) => {
      const txnCount = 10 + Math.floor(Math.random() * 40)

      for (let i = 0; i < txnCount; i++) {
        const totalAmount = Math.random() * 5000 + 100

        // Randomly decide how many classifications (1-3, weighted toward 1)
        const classificationCount = Math.random() < 0.6 ? 1 : Math.random() < 0.7 ? 2 : 3
        const classifications: TransactionClassification[] = []

        // Pick random unique groups
        const shuffledGroups = [...CLASSIFICATION_GROUPS].sort(() => Math.random() - 0.5)
        let remainingAmount = totalAmount

        for (let c = 0; c < classificationCount; c++) {
          const group = shuffledGroups[c]!
          const isLast = c === classificationCount - 1
          const amount = isLast ? remainingAmount : Math.random() * remainingAmount * 0.6 + remainingAmount * 0.1
          remainingAmount -= amount

          classifications.push({
            name: group.name,
            color: group.color,
            amount: isLast ? remainingAmount + amount : amount,
          })
        }

        // Generate transaction date (within last 2 years)
        const txnDate = new Date(Date.now() - Math.random() * 730 * 24 * 60 * 60 * 1000)

        // Due date is 30 days after transaction date (for bills)
        const dueDate = new Date(txnDate.getTime() + 30 * 24 * 60 * 60 * 1000)

        // Determine payment status
        // Bills can be paid, current, or overdue
        // Other types are always "paid"
        const txnType = types[Math.floor(Math.random() * types.length)]!
        let amountPaid = totalAmount
        let amountDue = 0
        let status: 'current' | 'overdue' | 'paid' = 'paid'
        let daysLate = 0

        if (txnType === 'bill') {
          // 60% paid, 25% current (not yet due), 15% overdue
          const paymentRoll = Math.random()
          if (paymentRoll < 0.60) {
            // Paid
            status = 'paid'
            amountPaid = totalAmount
            amountDue = 0
          } else if (paymentRoll < 0.85) {
            // Current (due date is in the future or within last 30 days but not overdue)
            // Make sure due date is in the future for "current" status
            const currentDueDate = new Date(today.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000)
            Object.assign(dueDate, currentDueDate)
            status = 'current'
            amountPaid = Math.random() < 0.3 ? totalAmount * Math.random() * 0.5 : 0
            amountDue = totalAmount - amountPaid
          } else {
            // Overdue (due date is in the past)
            const overdueDays = Math.floor(Math.random() * 90) + 1 // 1-90 days overdue
            const overdueDueDate = new Date(today.getTime() - overdueDays * 24 * 60 * 60 * 1000)
            Object.assign(dueDate, overdueDueDate)
            status = 'overdue'
            amountPaid = Math.random() < 0.2 ? totalAmount * Math.random() * 0.3 : 0
            amountDue = totalAmount - amountPaid
            daysLate = overdueDays
          }
        }

        transactions.push({
          id: `txn-${vendorIndex}-${i}`,
          vendorId: vendor.id,
          date: txnDate,
          dueDate,
          reference: `INV-${String(1000 + vendorIndex * 100 + i).padStart(4, '0')}`,
          description: descriptions[Math.floor(Math.random() * descriptions.length)]!,
          amount: totalAmount,
          amountPaid,
          amountDue,
          status,
          daysLate,
          classifications,
          type: txnType,
        })
      }
    })

    return transactions.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [vendors])

  // Filter ALL transactions by date range
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((txn) => {
      const txnDateStr = toDateString(txn.date)
      return isDateInRange(txnDateStr, activeDateRange.start, activeDateRange.end)
    })
  }, [allTransactions, activeDateRange])

  // Calculate vendor summaries from FILTERED transactions
  const vendorSummaries: VendorSpendingSummary[] = useMemo(() => {
    return vendors.map((vendor) => {
      const vendorTxns = filteredTransactions.filter((t) => t.vendorId === vendor.id)
      const totalBills = vendorTxns.reduce((sum, t) => sum + t.amount, 0)
      const paidAmount = vendorTxns.reduce((sum, t) => sum + t.amountPaid, 0)
      const currentAmount = vendorTxns
        .filter((t) => t.status === 'current')
        .reduce((sum, t) => sum + t.amountDue, 0)
      const overdueAmount = vendorTxns
        .filter((t) => t.status === 'overdue')
        .reduce((sum, t) => sum + t.amountDue, 0)
      const stillOwe = currentAmount + overdueAmount
      const lastTxn = vendorTxns[0] // Already sorted by date desc

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        totalBills,
        paidAmount,
        stillOwe,
        currentAmount,
        overdueAmount,
        transactionCount: vendorTxns.length,
        lastTransactionDate: lastTxn?.date || null,
        is1099Eligible: vendor.is1099Eligible ?? false,
      }
    })
  }, [vendors, filteredTransactions])

  // Close classification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (classificationDropdownRef.current && !classificationDropdownRef.current.contains(event.target as Node)) {
        setIsClassificationDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Get transactions for selected vendor (already filtered by date)
  const selectedVendorTransactions = useMemo(() => {
    if (!selectedVendorId) return []
    return filteredTransactions.filter((t) => t.vendorId === selectedVendorId)
  }, [filteredTransactions, selectedVendorId])

  // Sort selected vendor transactions
  const sortedVendorTransactions = useMemo(() => {
    const sorted = [...selectedVendorTransactions]
    const direction = txnSortDirection === 'asc' ? 1 : -1

    sorted.sort((a, b) => {
      switch (txnSortField) {
        case 'date':
          return direction * (a.date.getTime() - b.date.getTime())
        case 'reference':
          return direction * a.reference.localeCompare(b.reference)
        case 'description':
          return direction * a.description.localeCompare(b.description)
        case 'type':
          return direction * a.type.localeCompare(b.type)
        case 'classification':
          const aFirst = a.classifications[0]?.name || ''
          const bFirst = b.classifications[0]?.name || ''
          return direction * aFirst.localeCompare(bFirst)
        case 'amount':
          return direction * (a.amount - b.amount)
        default:
          return 0
      }
    })

    return sorted
  }, [selectedVendorTransactions, txnSortField, txnSortDirection])

  // Handle column header click for sorting
  const handleColumnSort = (field: TransactionSortField) => {
    if (txnSortField === field) {
      // Toggle direction if same field
      setTxnSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      // New field, default to descending for date/amount, ascending for others
      setTxnSortField(field)
      setTxnSortDirection(field === 'date' || field === 'amount' ? 'desc' : 'asc')
    }
  }

  // Export vendor transactions to CSV
  const exportVendorTransactionsCSV = () => {
    if (!selectedVendor || sortedVendorTransactions.length === 0) return

    const headers = ['Date', 'Type', 'Reference', 'Description', 'Classifications', 'Amount']
    const rows = sortedVendorTransactions.map((txn) => [
      toDateString(txn.date),
      formatTransactionType(txn.type),
      txn.reference,
      `"${txn.description.replace(/"/g, '""')}"`,
      `"${txn.classifications.map((c) => `${c.name} (${formatCurrency(c.amount)})`).join('; ')}"`,
      txn.amount.toFixed(2),
    ])

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedVendor.vendorName.replace(/[^a-z0-9]/gi, '_')}_transactions.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Calculate classification breakdown from FILTERED transactions for selected vendor
  const classificationBreakdown: GroupBreakdown[] = useMemo(() => {
    if (selectedVendorTransactions.length === 0) return []

    // Group by classification, summing the amounts from each classification entry
    const groupTotals = new Map<string, { spend: number; count: number; color: string }>()

    selectedVendorTransactions.forEach((txn) => {
      txn.classifications.forEach((cls) => {
        const existing = groupTotals.get(cls.name) || { spend: 0, count: 0, color: cls.color }
        groupTotals.set(cls.name, {
          spend: existing.spend + cls.amount,
          count: existing.count + 1,
          color: cls.color,
        })
      })
    })

    const totalSpend = Array.from(groupTotals.values()).reduce((sum, g) => sum + g.spend, 0)

    // Convert to array and calculate percentages
    return Array.from(groupTotals.entries())
      .map(([name, data], index) => ({
        groupId: `group-${index}`,
        groupName: name,
        groupColor: data.color,
        totalSpend: data.spend,
        transactionCount: data.count,
        percentageOfTotal: totalSpend > 0 ? (data.spend / totalSpend) * 100 : 0,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
  }, [selectedVendorTransactions])

  // Get selected vendor summary
  const selectedVendor = useMemo(() => {
    if (!selectedVendorId) return null
    return vendorSummaries.find((v) => v.vendorId === selectedVendorId) || null
  }, [vendorSummaries, selectedVendorId])

  // Get full vendor object for editing
  const selectedVendorFull = useMemo(() => {
    if (!selectedVendorId) return null
    return vendors.find((v) => v.id === selectedVendorId) || null
  }, [vendors, selectedVendorId])

  // Handle edit vendor click
  const handleEditVendorClick = () => {
    if (selectedVendorFull && onEditVendor) {
      onEditVendor(selectedVendorFull)
    }
  }

  // Get unique classifications from all transactions for filter dropdown
  const availableClassifications = useMemo(() => {
    const classSet = new Set<string>()
    filteredTransactions.forEach((txn) => {
      txn.classifications.forEach((cls) => classSet.add(cls.name))
    })
    return Array.from(classSet).sort()
  }, [filteredTransactions])

  // Toggle classification selection
  const toggleClassification = (classification: string) => {
    setSelectedClassifications((prev) =>
      prev.includes(classification)
        ? prev.filter((c) => c !== classification)
        : [...prev, classification]
    )
  }

  // Filter and sort vendors (always sorted by highest spend)
  const sortedVendors = useMemo(() => {
    let filtered = [...vendorSummaries]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((v) => v.vendorName.toLowerCase().includes(query))
    }

    // Apply 1099 filter
    if (vendor1099Filter === '1099-only') {
      filtered = filtered.filter((v) => v.is1099Eligible)
    } else if (vendor1099Filter === 'non-1099') {
      filtered = filtered.filter((v) => !v.is1099Eligible)
    }

    // Apply classification filter - show vendors with transactions in selected classifications
    if (selectedClassifications.length > 0) {
      filtered = filtered.filter((v) => {
        const vendorTxns = filteredTransactions.filter((t) => t.vendorId === v.vendorId)
        return vendorTxns.some((txn) =>
          txn.classifications.some((cls) => selectedClassifications.includes(cls.name))
        )
      })
    }

    // Apply overdue filter
    if (overdueFilter === 'current') {
      filtered = filtered.filter((v) => v.currentAmount > 0)
    } else if (overdueFilter === 'overdue') {
      filtered = filtered.filter((v) => v.overdueAmount > 0)
    }

    // Always sort by highest total bills
    return filtered.sort((a, b) => b.totalBills - a.totalBills)
  }, [vendorSummaries, searchQuery, vendor1099Filter, selectedClassifications, filteredTransactions, overdueFilter])

  // Auto-select top vendor on initial load
  useEffect(() => {
    if (!hasAutoSelected.current && sortedVendors.length > 0 && !selectedVendorId) {
      const topVendor = sortedVendors[0]
      if (topVendor && topVendor.totalBills > 0) {
        setSelectedVendorId(topVendor.vendorId)
        hasAutoSelected.current = true
      }
    }
  }, [sortedVendors, selectedVendorId])

  // Filter transactions by selected classifications (for overview stats)
  const classificationFilteredTransactions = useMemo(() => {
    if (selectedClassifications.length === 0) {
      return filteredTransactions
    }
    return filteredTransactions.filter((txn) =>
      txn.classifications.some((cls) => selectedClassifications.includes(cls.name))
    )
  }, [filteredTransactions, selectedClassifications])

  // Calculate aggregate stats (respects classification filter)
  const aggregateStats = useMemo(() => {
    // Calculate totals from classification-filtered transactions
    const totalBills = classificationFilteredTransactions.reduce((sum, txn) => {
      if (selectedClassifications.length === 0) {
        return sum + txn.amount
      }
      // Only count the portion attributed to selected classifications
      const relevantAmount = txn.classifications
        .filter((cls) => selectedClassifications.includes(cls.name))
        .reduce((clsSum, cls) => clsSum + cls.amount, 0)
      return sum + relevantAmount
    }, 0)

    const paidAmount = classificationFilteredTransactions.reduce((sum, txn) => sum + txn.amountPaid, 0)
    const currentAmount = classificationFilteredTransactions
      .filter((t) => t.status === 'current')
      .reduce((sum, t) => sum + t.amountDue, 0)
    const overdueAmount = classificationFilteredTransactions
      .filter((t) => t.status === 'overdue')
      .reduce((sum, t) => sum + t.amountDue, 0)
    const stillOwe = currentAmount + overdueAmount

    // Find top vendor from filtered list
    const topVendor = sortedVendors.find((v) => v.totalBills > 0)

    // Calculate biggest classification across filtered transactions
    const classificationTotals = new Map<string, { spend: number; color: string }>()
    classificationFilteredTransactions.forEach((txn) => {
      txn.classifications.forEach((cls) => {
        // If filtering by classification, only count selected ones
        if (selectedClassifications.length > 0 && !selectedClassifications.includes(cls.name)) {
          return
        }
        const existing = classificationTotals.get(cls.name) || { spend: 0, color: cls.color }
        classificationTotals.set(cls.name, {
          spend: existing.spend + cls.amount,
          color: cls.color,
        })
      })
    })

    let biggestClassificationName = 'N/A'
    let biggestClassificationSpend = 0
    let biggestClassificationColor = '#6b7280'

    classificationTotals.forEach((data, name) => {
      if (data.spend > biggestClassificationSpend) {
        biggestClassificationName = name
        biggestClassificationSpend = data.spend
        biggestClassificationColor = data.color
      }
    })

    // Determine what label to show for the overview
    const isFiltered = selectedClassifications.length > 0
    const filterLabel = isFiltered
      ? selectedClassifications.length === 1
        ? selectedClassifications[0]
        : `${selectedClassifications.length} Classifications`
      : null

    return {
      totalBills,
      paidAmount,
      stillOwe,
      currentAmount,
      overdueAmount,
      topVendorName: topVendor?.vendorName || 'N/A',
      topVendorBills: topVendor?.totalBills || 0,
      biggestClassificationName,
      biggestClassificationSpend,
      biggestClassificationColor,
      isFiltered,
      filterLabel,
    }
  }, [classificationFilteredTransactions, sortedVendors, selectedClassifications])

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

  const vendor1099Options: SelectOption[] = [
    { value: 'all', label: '1099 Status' },
    { value: '1099-only', label: '1099 Only' },
    { value: 'non-1099', label: 'Non-1099' },
  ]

  const overdueFilterOptions: SelectOption[] = [
    { value: 'all', label: 'Payment Status' },
    { value: 'current', label: 'Current Only' },
    { value: 'overdue', label: 'Overdue Only' },
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
                placeholder="Search vendors..."
                className={styles.searchInput}
                aria-label="Search vendors"
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
          {/* Classification Multi-Select Dropdown */}
          <div className={styles.filterItem}>
            <div className={styles.multiSelectWrapper} ref={classificationDropdownRef}>
              <button
                className={styles.multiSelectTrigger}
                onClick={() => setIsClassificationDropdownOpen(!isClassificationDropdownOpen)}
                aria-expanded={isClassificationDropdownOpen}
                aria-haspopup="listbox"
              >
                <span className={styles.multiSelectLabel}>
                  {selectedClassifications.length === 0
                    ? 'Classification'
                    : `${selectedClassifications.length} selected`}
                </span>
                <span className={styles.multiSelectArrow}>▼</span>
              </button>
              {isClassificationDropdownOpen && (
                <div
                  className={styles.multiSelectDropdown}
                  role="listbox"
                  onClick={(e) => e.stopPropagation()}
                >
                  {availableClassifications.map((classification) => (
                    <label
                      key={classification}
                      className={styles.multiSelectOption}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedClassifications.includes(classification)}
                        onChange={(e) => {
                          e.stopPropagation()
                          toggleClassification(classification)
                        }}
                      />
                      <span
                        className={styles.classificationColorDot}
                        style={{
                          backgroundColor: CLASSIFICATION_GROUPS.find((g) => g.name === classification)?.color || '#6b7280',
                        }}
                      />
                      <span>{classification}</span>
                    </label>
                  ))}
                  {selectedClassifications.length > 0 && (
                    <button
                      className={styles.multiSelectClear}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedClassifications([])
                      }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* 1099 Filter */}
          <div className={styles.filterItem}>
            <Select
              value={vendor1099Filter}
              onChange={(e) => setVendor1099Filter(e.target.value as Vendor1099Filter)}
              options={vendor1099Options}
              aria-label="Filter by 1099 status"
              className={styles.filterSelect}
            />
          </div>
          {/* Overdue Filter */}
          <div className={styles.filterItem}>
            <Select
              value={overdueFilter}
              onChange={(e) => setOverdueFilter(e.target.value as OverdueFilter)}
              options={overdueFilterOptions}
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

      {/* Summary Row - Overview + Selected Vendor Header */}
      <div className={styles.summaryRow}>
        {/* Overview Box (left) */}
        <div className={styles.overviewBox}>
          <div className={styles.overviewMain}>
            <span className={styles.overviewLabel}>
              {aggregateStats.isFiltered ? (
                <>Expenses for: <span className={styles.filterIndicator}>{aggregateStats.filterLabel}</span></>
              ) : (
                'Total Expenses'
              )}
            </span>
            <span className={styles.overviewValue}>{formatCurrency(aggregateStats.totalBills)}</span>
          </div>
          <div className={styles.overviewStatRow}>
            <div className={styles.overviewStatItem}>
              <span className={styles.overviewStatLabel}>Paid</span>
              <span className={styles.overviewStatValuePaid}>{formatCurrency(aggregateStats.paidAmount)}</span>
            </div>
            <div className={`${styles.overviewStatItem} ${aggregateStats.stillOwe > 0 ? styles.oweHighlight : ''}`}>
              <span className={styles.overviewStatLabel}>Still Owe</span>
              <span className={styles.overviewStatValueOwe}>{formatCurrency(aggregateStats.stillOwe)}</span>
            </div>
          </div>
          <div className={styles.overviewStatRow}>
            <div className={styles.overviewStatItem}>
              <span className={styles.overviewStatLabel}>
                {aggregateStats.isFiltered ? 'Top Vendor (Filtered)' : 'Top Vendor'}
              </span>
              <span className={styles.overviewStatName}>{aggregateStats.topVendorName}</span>
              <span className={styles.overviewStatSpend}>{formatCurrency(aggregateStats.topVendorBills)}</span>
            </div>
            <div className={styles.overviewStatItem}>
              <span className={styles.overviewStatLabel}>
                {aggregateStats.isFiltered ? 'Selected Classification' : 'Biggest Classification'}
              </span>
              <span className={styles.overviewStatName}>
                <span
                  className={styles.classificationDot}
                  style={{ backgroundColor: aggregateStats.biggestClassificationColor }}
                />
                {aggregateStats.biggestClassificationName}
              </span>
              <span className={styles.overviewStatSpend}>{formatCurrency(aggregateStats.biggestClassificationSpend)}</span>
            </div>
          </div>
        </div>

        {/* Selected Vendor Header (right) */}
        <div className={styles.selectedVendorBox}>
          {selectedVendor && selectedVendorFull ? (
            <>
              <div className={styles.selectedVendorTop}>
                <div className={styles.selectedVendorLeft}>
                  <div className={styles.selectedVendorNameRow}>
                    <h3 className={styles.selectedVendorName}>{selectedVendor.vendorName}</h3>
                    {selectedVendor.is1099Eligible && (
                      <span className={styles.selected1099Badge}>1099</span>
                    )}
                  </div>
                  {onEditVendor && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleEditVendorClick}
                    >
                      Edit Vendor
                    </Button>
                  )}
                </div>
              </div>
              {/* Bottom section: Contact Details (left) + Billing Stats (right) */}
              <div className={styles.selectedVendorBottom}>
                {/* Contact Details - Bottom Left */}
                <div className={styles.selectedVendorContact}>
                  {(selectedVendorFull.email || selectedVendorFull.phone || selectedVendorFull.address) ? (
                    <>
                      {selectedVendorFull.email && (
                        <div className={styles.contactDetailCompact}>
                          <span className={styles.contactDetailLabel}>Email</span>
                          <span className={styles.contactDetailValue}>{selectedVendorFull.email}</span>
                        </div>
                      )}
                      {selectedVendorFull.phone && (
                        <div className={styles.contactDetailCompact}>
                          <span className={styles.contactDetailLabel}>Phone</span>
                          <span className={styles.contactDetailValue}>{selectedVendorFull.phone}</span>
                        </div>
                      )}
                      {selectedVendorFull.address && (
                        <div className={styles.contactDetailCompact}>
                          <span className={styles.contactDetailLabel}>Address</span>
                          <span className={styles.contactDetailValue}>{selectedVendorFull.address}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={styles.noContactDetails}>No contact details</div>
                  )}
                </div>
                {/* Billing Stats - Right Half */}
                <div className={styles.selectedVendorBilling}>
                  <div className={styles.billingMain}>
                    <div className={styles.billingStat}>
                      <span className={styles.billingLabel}>Total Expenses</span>
                      <span className={styles.billingValueLarge}>{formatCurrency(selectedVendor.totalBills)}</span>
                    </div>
                  </div>
                  <div className={styles.billingRow}>
                    <div className={styles.billingStat}>
                      <span className={styles.billingLabel}>Paid</span>
                      <span className={styles.billingValuePaid}>{formatCurrency(selectedVendor.paidAmount)}</span>
                    </div>
                    <div className={styles.billingStat}>
                      <span className={styles.billingLabel}>Still Owe</span>
                      <span className={styles.billingValueOwe}>{formatCurrency(selectedVendor.stillOwe)}</span>
                    </div>
                  </div>
                  <div className={styles.billingBreakdown}>
                    <div className={styles.billingSmall}>
                      <span className={styles.billingLabelSmall}>Current</span>
                      <span className={styles.billingValueSmall}>{formatCurrency(selectedVendor.currentAmount)}</span>
                    </div>
                    <div className={`${styles.billingSmall} ${selectedVendor.overdueAmount > 0 ? styles.overdueHighlight : ''}`}>
                      <span className={styles.billingLabelSmall}>Overdue</span>
                      <span className={styles.billingValueSmall}>{formatCurrency(selectedVendor.overdueAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.selectedVendorEmpty}>
              <span>Select a vendor to view details</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Vendor List */}
        <div className={styles.vendorList}>
          <div className={styles.vendorListHeader}>
            <h3 className={styles.sectionTitle}>Vendors ({vendors.length})</h3>
            {onCreateVendor && (
              <Button variant="primary" size="sm" onClick={onCreateVendor}>
                Add Vendor
              </Button>
            )}
          </div>
          <div className={styles.vendorListContent}>
            {sortedVendors.map((vendor) => (
              <button
                key={vendor.vendorId}
                className={`${styles.vendorItem} ${selectedVendorId === vendor.vendorId ? styles.vendorItemSelected : ''} ${vendor.is1099Eligible ? styles.vendorItem1099 : ''} ${vendor.overdueAmount > 0 ? styles.vendorItemOverdue : ''}`}
                onClick={() => setSelectedVendorId(vendor.vendorId)}
                aria-pressed={selectedVendorId === vendor.vendorId}
              >
                <div className={styles.vendorInfo}>
                  <span className={styles.vendorName}>
                    {vendor.vendorName}
                    {vendor.is1099Eligible && (
                      <span className={styles.vendor1099Badge} title="1099 Eligible">1099</span>
                    )}
                    {vendor.overdueAmount > 0 && (
                      <span className={styles.overdueBadge} title="Has overdue bills">OVERDUE</span>
                    )}
                  </span>
                  <span className={styles.vendorMeta}>
                    {vendor.transactionCount} transactions
                  </span>
                </div>
                <div className={styles.vendorSpend}>
                  <span className={styles.spendAmount}>{formatCurrency(vendor.totalBills)}</span>
                  {vendor.overdueAmount > 0 && (
                    <span className={styles.overdueAmount}>{formatCurrency(vendor.overdueAmount)} overdue</span>
                  )}
                </div>
              </button>
            ))}
            {sortedVendors.length === 0 && (
              <div className={styles.emptyState}>
                {searchQuery ? 'No vendors match your search' : 'No vendors found'}
              </div>
            )}
          </div>
        </div>

        {/* Vendor Details */}
        <div className={styles.vendorDetails}>
          {selectedVendor ? (
            <>
              {/* Classification Breakdown */}
              <div className={styles.section}>
                <div className={styles.groupList}>
                  {classificationBreakdown.map((group) => (
                    <div key={group.groupId} className={styles.groupItem}>
                      <div className={styles.groupHeader}>
                        <span
                          className={styles.groupColor}
                          style={{ backgroundColor: group.groupColor }}
                        />
                        <span className={styles.groupName}>{group.groupName}</span>
                        <span className={styles.groupPercent}>{group.percentageOfTotal.toFixed(0)}%</span>
                      </div>
                      <div className={styles.groupBar}>
                        <div
                          className={styles.groupBarFill}
                          style={{
                            width: `${group.percentageOfTotal}%`,
                            backgroundColor: group.groupColor,
                          }}
                        />
                      </div>
                      <div className={styles.groupStats}>
                        <span>{formatCurrency(group.totalSpend)}</span>
                        <span>{group.transactionCount} transactions</span>
                      </div>
                    </div>
                  ))}
                  {classificationBreakdown.length === 0 && (
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
                    Transactions ({sortedVendorTransactions.length})
                  </h4>
                  {sortedVendorTransactions.length > 0 && (
                    <Button variant="outline" size="sm" onClick={exportVendorTransactionsCSV}>
                      Export Vendor CSV
                    </Button>
                  )}
                </div>
                {sortedVendorTransactions.length > 0 ? (
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
                        className={`${styles.sortableHeader} ${txnSortField === 'classification' ? styles.sortActive : ''}`}
                        onClick={() => handleColumnSort('classification')}
                      >
                        Classification {txnSortField === 'classification' && (txnSortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                      <button
                        className={`${styles.sortableHeader} ${txnSortField === 'amount' ? styles.sortActive : ''}`}
                        onClick={() => handleColumnSort('amount')}
                      >
                        Amount {txnSortField === 'amount' && (txnSortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </div>
                    {sortedVendorTransactions.slice(0, 10).map((txn) => (
                      <div key={txn.id} className={styles.transactionRow}>
                        <span>{formatDate(txn.date)}</span>
                        <span className={styles.transactionType}>{formatTransactionType(txn.type)}</span>
                        <span className={styles.transactionRef}>{txn.reference}</span>
                        <span className={styles.transactionDesc}>{txn.description}</span>
                        <span className={styles.classificationTags}>
                          {txn.classifications.map((cls, idx) => (
                            <span
                              key={idx}
                              className={styles.groupTag}
                              style={{ backgroundColor: cls.color }}
                              title={`${cls.name}: ${formatCurrency(cls.amount)}`}
                            >
                              {cls.name}
                            </span>
                          ))}
                        </span>
                        <span className={styles.transactionAmount}>{formatCurrency(txn.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    No transactions found for the selected date range
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.selectPrompt}>
              <div className={styles.selectPromptIcon}>📊</div>
              <h3>Select a vendor to view insights</h3>
              <p>Click on a vendor from the list to see their spending breakdown and transaction history</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
