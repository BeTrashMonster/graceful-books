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
import { useTransactions } from '../../hooks/useTransactions'
import { useAccounts } from '../../hooks/useAccounts'
import type { Vendor } from '../../types/vendor.types'
import type { JournalEntry } from '../../types'
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
  // Cross-vendor consolidation tracking
  crossVendorPaidAmount: number  // Amount paid to this vendor for OTHER vendors' expenses
  consolidatedOutAmount: number   // Amount of this vendor's expenses consolidated into OTHER vendors' payments
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
  excludeFromBreakdown?: boolean  // True for "Paid Bills" - don't aggregate in category chart
}

interface PaymentDetail {
  id: string
  date: Date
  reference: string
  amount: number
  memo: string
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
  payments: PaymentDetail[]
  isConsolidated: boolean  // True if this transaction is consolidated into a payment
  consolidatedIntoPaymentId?: string
  isLinkedToBills: boolean  // True if this payment pays bills (shows in bill dropdown instead)
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
      return 'Payment'
    case 'check':
      return 'Check'
    case 'journal-entry':
      return 'Journal Entry'
  }
}

/**
 * Get user-friendly status label
 */
function getStatusLabel(status: 'current' | 'overdue' | 'paid'): string {
  switch (status) {
    case 'paid':
      return 'Paid'
    case 'current':
      return 'Due'
    case 'overdue':
      return 'Past Due'
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
  isLoading: _isLoading = false,
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

  // Track expanded transactions (for showing payment details)
  const [expandedTxnIds, setExpandedTxnIds] = useState<Set<string>>(new Set())

  // Track if we've done initial auto-selection
  const hasAutoSelected = useRef(false)

  // Load real transactions from database
  const { transactions: rawTransactions, loadTransactions } = useTransactions()
  const { accounts } = useAccounts({ companyId, isActive: true })

  // Load transactions on mount
  useEffect(() => {
    loadTransactions({ companyId })
  }, [loadTransactions, companyId])

  // DEBUG: Log Check 1234 and related payments
  useEffect(() => {
    const check1234 = rawTransactions.find(t => t.reference === '1234' && t.transactionType === 'check')
    const payment1325 = rawTransactions.find(t => t.reference === '1325' && t.transactionType === 'bill-payment')

    if (check1234 || payment1325) {
      console.log('=== CHECK 1234 & PAYMENT DEBUG ===')
      if (check1234) {
        console.log('CHECK 1234:', {
          id: check1234.id,
          status: check1234.status,
          consolidatedIntoPaymentId: check1234.consolidatedIntoPaymentId,
        })
        // Find the payment it THINKS it's consolidated into
        if (check1234.consolidatedIntoPaymentId) {
          const targetPayment = rawTransactions.find(t => t.id === check1234.consolidatedIntoPaymentId)
          console.log('CHECK POINTS TO:', targetPayment ? {
            ref: targetPayment.reference,
            type: targetPayment.transactionType,
          } : 'NOT FOUND - ID: ' + check1234.consolidatedIntoPaymentId)
        }
      }
      if (payment1325) {
        console.log('PAYMENT 1325:', {
          id: payment1325.id,
          linkedTransactionId: payment1325.linkedTransactionId,
        })
      }
    }
  }, [rawTransactions])

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

  // Build account lookup map for classification names
  const accountMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>()
    accounts.forEach((acc) => {
      // Use account type to determine color
      const typeColors: Record<string, string> = {
        'expense': '#4b006e',
        'cost-of-goods-sold': '#1e3a5f',
        'asset': '#92400e',
        'liability': '#742a2a',
        'equity': '#1a4731',
      }
      map.set(acc.id, {
        name: acc.name,
        color: typeColors[acc.type] || '#6b7280',
      })
    })
    return map
  }, [accounts])

  // Convert real transactions to TransactionDetail format
  // This includes ALL vendor transactions for accurate totals
  const allTransactions: TransactionDetail[] = useMemo(() => {
    const today = new Date()

    // Filter to only vendor-related transactions (those with vendorId)
    // Show: bills, expenses, checks, AND bill-payments
    // Exclude voided transactions AND consolidated transactions - they're shown in the payment breakdown
    const vendorTransactions = rawTransactions.filter(
      (txn) => txn.vendorId &&
        ['expense', 'bill', 'check', 'bill-payment'].includes(txn.transactionType || '') &&
        txn.status !== 'void' &&
        !txn.consolidatedIntoPaymentId  // Don't show separately - shown in payment dropdown
    )

    // Build a map of bill payments by their linked bill ID
    // Handles both single linkedTransactionId and multiple linkedTransactionIds
    const billPaymentsByBillId = new Map<string, JournalEntry[]>()
    rawTransactions
      .filter((txn) => txn.transactionType === 'bill-payment')
      .forEach((payment) => {
        // Handle multiple linked bills
        const linkedIds = payment.linkedTransactionIds ||
          (payment.linkedTransactionId ? [payment.linkedTransactionId] : [])

        linkedIds.forEach((billId) => {
          const existing = billPaymentsByBillId.get(billId) || []
          existing.push(payment)
          billPaymentsByBillId.set(billId, existing)
        })
      })

    return vendorTransactions.map((txn) => {
      const txnType = (txn.transactionType || 'expense') as TransactionType

      // For bill-payments, amount is from credits (money leaving bank)
      // For everything else, amount is from debits
      const totalAmount = txnType === 'bill-payment'
        ? txn.lines.reduce((sum, line) => sum + line.credit, 0)
        : txn.lines.reduce((sum, line) => sum + line.debit, 0)

      // Build classifications from line items
      let classifications: TransactionClassification[] = []

      if (txnType === 'bill-payment') {
        // For bill-payments, show where the money went
        const apAmount = txn.lines
          .filter((line) => line.debit > 0 && accountMap.get(line.accountId)?.name === 'Accounts Payable')
          .reduce((sum, line) => sum + line.debit, 0)

        const expenseLines = txn.lines
          .filter((line) => line.debit > 0 && accountMap.get(line.accountId)?.name !== 'Accounts Payable')

        // Show bills paid portion with clear label (but don't include in category breakdown)
        if (apAmount > 0) {
          classifications.push({
            name: 'Paid Bills',
            color: '#166534', // Green - money going to pay off what you owed
            amount: apAmount,
            excludeFromBreakdown: true, // Bills are already counted as separate transactions
          })
        }

        // Add individual expense categories (extra charges on this payment)
        expenseLines.forEach((line) => {
          const account = accountMap.get(line.accountId)
          classifications.push({
            name: account?.name || 'Other',
            color: account?.color || '#6b7280',
            amount: line.debit,
          })
        })
      } else {
        // For bills, expenses, checks - show expense categories
        classifications = txn.lines
          .filter((line) => line.debit > 0)
          .map((line) => {
            const account = accountMap.get(line.accountId)
            return {
              name: account?.name || 'Uncategorized',
              color: account?.color || '#6b7280',
              amount: line.debit,
            }
          })
          // For bills, filter out Accounts Payable - show the expense categories instead
          .filter((cls) => txnType !== 'bill' || cls.name !== 'Accounts Payable')
      }

      // Determine payment status
      let amountPaid = 0
      let amountDue = totalAmount
      let status: 'current' | 'overdue' | 'paid' = 'paid'
      let daysLate = 0
      const dueDate = txn.dueDate || new Date(txn.date.getTime() + 30 * 24 * 60 * 60 * 1000)
      let paymentDetails: PaymentDetail[] = []

      if (txnType === 'bill') {
        // Check for payments linked to this bill
        const payments = billPaymentsByBillId.get(txn.id) || []
        paymentDetails = payments.map((p) => ({
          id: p.id,
          date: p.date,
          reference: p.reference || '',
          amount: p.lines.reduce((lineSum, line) => lineSum + line.credit, 0),
          memo: p.memo || '',
        }))
        amountPaid = paymentDetails.reduce((sum, pd) => sum + pd.amount, 0)
        amountDue = Math.max(0, totalAmount - amountPaid)

        if (amountDue <= 0) {
          status = 'paid'
        } else if (dueDate > today) {
          status = 'current'
        } else {
          status = 'overdue'
          daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000))
        }
      } else if (txnType === 'bill-payment') {
        // Bill-payments are money out - always "paid"
        amountPaid = totalAmount
        amountDue = 0
        status = 'paid'
      } else {
        // Expenses and checks are direct spending - they're already paid
        amountPaid = totalAmount
        amountDue = 0
        status = 'paid'
      }

      // Check if this payment is linked to bills (will show in bill dropdown)
      const linkedBillIds = txn.linkedTransactionIds ||
        (txn.linkedTransactionId ? [txn.linkedTransactionId] : [])
      const isLinkedToBills = txnType === 'bill-payment' && linkedBillIds.length > 0

      return {
        id: txn.id,
        vendorId: txn.vendorId!,
        date: txn.date,
        dueDate,
        reference: txn.reference || '',
        description: txn.memo || '',
        amount: totalAmount,
        amountPaid,
        amountDue,
        status,
        daysLate,
        classifications,
        type: txnType,
        payments: paymentDetails,
        isConsolidated: !!txn.consolidatedIntoPaymentId,
        consolidatedIntoPaymentId: txn.consolidatedIntoPaymentId,
        isLinkedToBills,
      }
    }).sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [rawTransactions, accountMap])

  // Transactions for display - excludes consolidated items (they show nested under payments)
  const _displayTransactions = useMemo(() => {
    return allTransactions.filter((txn) => !txn.isConsolidated)
  }, [allTransactions])

  // Filter ALL transactions by date range
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((txn) => {
      const txnDateStr = toDateString(txn.date)
      return isDateInRange(txnDateStr, activeDateRange.start, activeDateRange.end)
    })
  }, [allTransactions, activeDateRange])

  // Build lookup for voided transactions (to track cross-vendor consolidations)
  const voidedTransactionMap = useMemo(() => {
    const map = new Map<string, { vendorId: string; amount: number }>()
    rawTransactions
      .filter((txn) => txn.status === 'void' && txn.vendorId)
      .forEach((txn) => {
        const amount = txn.lines.reduce((sum, line) => sum + line.debit, 0)
        map.set(txn.id, { vendorId: txn.vendorId!, amount })
      })
    return map
  }, [rawTransactions])

  // Track cross-vendor consolidation amounts per vendor
  const crossVendorAmounts = useMemo(() => {
    // For each vendor, track:
    // - crossVendorPaidAmount: payments TO this vendor that included OTHER vendors' expenses
    // - consolidatedOutAmount: this vendor's expenses that were voided and consolidated INTO other vendors' payments
    const amounts = new Map<string, { paidForOthers: number; consolidatedOut: number }>()

    // Initialize for all vendors
    vendors.forEach((v) => amounts.set(v.id, { paidForOthers: 0, consolidatedOut: 0 }))

    // Look at all bill-payments with voidTransactionIds
    rawTransactions
      .filter((txn) => txn.transactionType === 'bill-payment' && txn.voidTransactionIds && txn.voidTransactionIds.length > 0)
      .forEach((payment) => {
        const paymentVendorId = payment.vendorId
        if (!paymentVendorId) return

        payment.voidTransactionIds!.forEach((voidedId) => {
          const voidedInfo = voidedTransactionMap.get(voidedId)
          if (!voidedInfo) return

          // If voided expense belonged to a DIFFERENT vendor
          if (voidedInfo.vendorId !== paymentVendorId) {
            // This payment (to paymentVendorId) included an expense from another vendor
            const paymentVendorAmounts = amounts.get(paymentVendorId)
            if (paymentVendorAmounts) {
              paymentVendorAmounts.paidForOthers += voidedInfo.amount
            }

            // The other vendor's expense was consolidated OUT
            const otherVendorAmounts = amounts.get(voidedInfo.vendorId)
            if (otherVendorAmounts) {
              otherVendorAmounts.consolidatedOut += voidedInfo.amount
            }
          }
        })
      })

    return amounts
  }, [rawTransactions, voidedTransactionMap, vendors])

  // Build set of expense account IDs for identifying expense debits in bill-payments
  const expenseAccountIds = useMemo(() => {
    const ids = new Set<string>()
    accounts.forEach((acc) => {
      if (acc.type === 'expense' || acc.type === 'cost-of-goods-sold') {
        ids.add(acc.id)
      }
    })
    return ids
  }, [accounts])

  // Calculate vendor summaries - directly from raw transactions for accuracy
  const vendorSummaries: VendorSpendingSummary[] = useMemo(() => {
    // Get date range for filtering
    const { start, end } = activeDateRange

    return vendors.map((vendor) => {
      // Filter raw transactions for this vendor within date range
      const isInDateRange = (txn: JournalEntry) => {
        const txnDateStr = toDateString(txn.date)
        return isDateInRange(txnDateStr, start, end)
      }

      // ========================================
      // TOTAL EXPENSES: Everything spent under this vendor's name
      // ========================================
      // 1. Bills (ALL - including voided, they represent real expenses)
      // 2. Expenses (ALL - including voided)
      // 3. Checks (ALL - including voided)
      // 4. Expense-account debits from bill-payments (like the $24 added directly)

      // Bills, Expenses, Checks for this vendor
      // Exclude voided expenses/checks - they're captured in bill-payment expense debits
      // Include voided bills - they still represent amounts owed
      const billsExpensesChecks = rawTransactions.filter(
        (txn) => txn.vendorId === vendor.id &&
          ['bill', 'expense', 'check'].includes(txn.transactionType || '') &&
          isInDateRange(txn) &&
          (txn.transactionType === 'bill' || txn.status !== 'void')
      )
      const billExpenseCheckTotal = billsExpensesChecks.reduce(
        (sum, txn) => sum + txn.lines.reduce((ls, l) => ls + l.debit, 0),
        0
      )

      // Bill-payments for this vendor - extract expense-account debits
      // (these are expenses added directly to the payment, like the $24 Software + Subscriptions)
      const billPaymentsForVendor = rawTransactions.filter(
        (txn) => txn.vendorId === vendor.id &&
          txn.transactionType === 'bill-payment' &&
          txn.status !== 'void' &&
          isInDateRange(txn)
      )
      const expenseDebitsInPayments = billPaymentsForVendor.reduce((sum, payment) => {
        // Sum debits to expense accounts (NOT A/P debits - those are bill payments)
        const expenseDebits = payment.lines
          .filter((line) => line.debit > 0 && expenseAccountIds.has(line.accountId))
          .reduce((ls, l) => ls + l.debit, 0)
        return sum + expenseDebits
      }, 0)

      const totalBills = billExpenseCheckTotal + expenseDebitsInPayments

      // ========================================
      // PAID: All money that left accounts for this vendor
      // ========================================
      // 1. Bill-payment credits (money leaving bank)
      // 2. Non-voided expenses (they hit the bank directly)
      // 3. Non-voided checks (they hit the bank directly)
      // Note: Voided expenses are NOT counted - they're included in bill-payments

      const billPaymentCredits = billPaymentsForVendor.reduce(
        (sum, txn) => sum + txn.lines.reduce((ls, l) => ls + l.credit, 0),
        0
      )

      const nonVoidedExpensesAndChecks = rawTransactions.filter(
        (txn) => txn.vendorId === vendor.id &&
          ['expense', 'check'].includes(txn.transactionType || '') &&
          txn.status !== 'void' &&
          !txn.consolidatedIntoPaymentId &&  // Exclude consolidated - already counted in payment
          isInDateRange(txn)
      )
      const directSpendingTotal = nonVoidedExpensesAndChecks.reduce(
        (sum, txn) => sum + txn.lines.reduce((ls, l) => ls + l.credit, 0),
        0
      )

      const paidAmount = billPaymentCredits + directSpendingTotal

      // ========================================
      // STILL OWE: Unpaid portions of bills
      // ========================================
      const bills = billsExpensesChecks.filter(
        (txn) => txn.transactionType === 'bill' && txn.status !== 'void'
      )

      // Track how much has been paid on each bill via A/P debits in payments
      const paidPerBill = new Map<string, number>()
      rawTransactions
        .filter((txn) => txn.transactionType === 'bill-payment' && txn.status !== 'void')
        .forEach((payment) => {
          const linkedIds = payment.linkedTransactionIds ||
            (payment.linkedTransactionId ? [payment.linkedTransactionId] : [])

          // For each linked bill, find the A/P debit amount in this payment
          // This is more accurate than equal distribution
          linkedIds.forEach((billId) => {
            // Find the bill to get its A/P amount
            const bill = rawTransactions.find((t) => t.id === billId)
            if (bill) {
              const billApAmount = bill.lines.reduce((sum, l) => sum + l.debit, 0)
              // Assume the payment covers this bill's full amount (or partial if multiple payments)
              paidPerBill.set(billId, (paidPerBill.get(billId) || 0) + billApAmount)
            }
          })
        })

      let currentAmount = 0
      let overdueAmount = 0
      const today = new Date()

      bills.forEach((bill) => {
        const billAmount = bill.lines.reduce((sum, l) => sum + l.debit, 0)
        const paidOnBill = paidPerBill.get(bill.id) || 0
        const amountDue = Math.max(0, billAmount - paidOnBill)

        if (amountDue > 0) {
          const dueDate = bill.dueDate || new Date(bill.date.getTime() + 30 * 24 * 60 * 60 * 1000)
          if (dueDate > today) {
            currentAmount += amountDue
          } else {
            overdueAmount += amountDue
          }
        }
      })

      const stillOwe = currentAmount + overdueAmount

      // Transaction count (all types for this vendor, excluding voided)
      const allVendorTxns = rawTransactions.filter(
        (txn) => txn.vendorId === vendor.id &&
          txn.status !== 'void' &&
          isInDateRange(txn)
      )
      const lastTxn = allVendorTxns.sort((a, b) => b.date.getTime() - a.date.getTime())[0]

      // Get cross-vendor consolidation amounts
      const crossAmounts = crossVendorAmounts.get(vendor.id) || { paidForOthers: 0, consolidatedOut: 0 }

      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        totalBills,
        paidAmount,
        stillOwe,
        currentAmount,
        overdueAmount,
        transactionCount: allVendorTxns.length,
        lastTransactionDate: lastTxn?.date || null,
        is1099Eligible: vendor.is1099Eligible ?? false,
        crossVendorPaidAmount: crossAmounts.paidForOthers,
        consolidatedOutAmount: crossAmounts.consolidatedOut,
      }
    })
  }, [vendors, rawTransactions, activeDateRange, crossVendorAmounts, expenseAccountIds])

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
  // Shows ALL transactions - payments are expandable to show what they paid
  const selectedVendorTransactions = useMemo(() => {
    if (!selectedVendorId) return []
    return filteredTransactions.filter((t) =>
      t.vendorId === selectedVendorId
    )
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

  // Toggle payment details expansion for a transaction
  const toggleTxnExpanded = (txnId: string) => {
    setExpandedTxnIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(txnId)) {
        newSet.delete(txnId)
      } else {
        newSet.add(txnId)
      }
      return newSet
    })
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
      txn.classifications
        .filter((cls) => !cls.excludeFromBreakdown) // Skip "Paid Bills" - already counted in bill rows
        .forEach((cls) => {
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
                          <span className={styles.contactDetailValue}>
                            {typeof selectedVendorFull.address === 'string'
                              ? selectedVendorFull.address
                              : [
                                  selectedVendorFull.address.line1,
                                  selectedVendorFull.address.line2,
                                  [
                                    selectedVendorFull.address.city,
                                    selectedVendorFull.address.state,
                                    selectedVendorFull.address.postalCode
                                  ].filter(Boolean).join(', ')
                                ].filter(Boolean).join(', ')}
                          </span>
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
                  {/* Cross-vendor consolidation notes */}
                  {(selectedVendor.crossVendorPaidAmount > 0 || selectedVendor.consolidatedOutAmount > 0) && (
                    <div className={styles.consolidationNote}>
                      {selectedVendor.crossVendorPaidAmount > 0 && (
                        <span className={styles.consolidationNoteItem}>
                          Paid includes {formatCurrency(selectedVendor.crossVendorPaidAmount)} for other vendors' expenses
                        </span>
                      )}
                      {selectedVendor.consolidatedOutAmount > 0 && (
                        <span className={styles.consolidationNoteItem}>
                          {formatCurrency(selectedVendor.consolidatedOutAmount)} was paid via another vendor's payment
                        </span>
                      )}
                    </div>
                  )}
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
                        Category {txnSortField === 'classification' && (txnSortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                      <button
                        className={`${styles.sortableHeader} ${txnSortField === 'amount' ? styles.sortActive : ''}`}
                        onClick={() => handleColumnSort('amount')}
                      >
                        Amount {txnSortField === 'amount' && (txnSortDirection === 'asc' ? '↑' : '↓')}
                      </button>
                    </div>
                    {sortedVendorTransactions.slice(0, 10).map((txn) => {
                      const isExpanded = expandedTxnIds.has(txn.id)
                      const isPayment = txn.type === 'bill-payment'

                      // For payments, build the breakdown of what it paid
                      let paymentBreakdownItems: Array<{
                        type: 'bill' | 'expense' | 'consolidated'
                        description: string
                        category: string
                        categoryColor: string
                        amount: number
                        vendorName?: string // For cross-vendor items
                      }> = []

                      if (isPayment) {
                        // Find the raw transaction to get the actual line items
                        const rawPayment = rawTransactions.find((t) => t.id === txn.id)
                        if (rawPayment) {
                          // Get linked bills
                          const linkedBillIds = rawPayment.linkedTransactionIds ||
                            (rawPayment.linkedTransactionId ? [rawPayment.linkedTransactionId] : [])

                          // Get consolidated transactions from payment arrays
                          const consolidatedFromArrays = [
                            ...(rawPayment.voidTransactionIds || []),
                            ...(rawPayment.consolidatedTransactionIds || []),
                          ]

                          // ALSO find any transactions that have consolidatedIntoPaymentId pointing to THIS payment
                          // This catches cases where the check knows it was consolidated but payment wasn't updated
                          const consolidatedByReference = rawTransactions
                            .filter(t => t.consolidatedIntoPaymentId === rawPayment.id)
                            .map(t => t.id)

                          // Combine both sources, removing duplicates
                          const consolidatedIds = [...new Set([...consolidatedFromArrays, ...consolidatedByReference])]

                          // DEBUG: Log for payments 1325 and 1235
                          if (rawPayment.reference === '1325' || rawPayment.reference === '1235') {
                            const totalDebits = rawPayment.lines.reduce((s, l) => s + l.debit, 0)
                            console.log(`=== PAYMENT ${rawPayment.reference} DEBUG ===`, {
                              totalDebits,
                              linkedBillIds,
                              consolidatedIds,
                              lines: rawPayment.lines.filter(l => l.debit > 0).map(l => ({
                                account: accountMap.get(l.accountId)?.name,
                                debit: l.debit,
                                memo: l.memo,
                              })),
                            })
                          }

                          // Track amounts we've accounted for
                          let accountedAPAmount = 0
                          let accountedExpenseAmount = 0

                          // 1. Add all linked bills directly
                          linkedBillIds.forEach((billId) => {
                            const bill = rawTransactions.find((t) => t.id === billId)
                            if (bill) {
                              const billVendor = vendors.find((v) => v.id === bill.vendorId)
                              const isCrossVendor = billVendor && billVendor.id !== txn.vendorId
                              const amount = bill.lines.reduce((s, l) => s + l.debit, 0)
                              accountedAPAmount += amount

                              // Find the expense category from the bill
                              const expenseLine = bill.lines.find((l) => l.debit > 0 && accountMap.get(l.accountId)?.name !== 'Accounts Payable')
                              const expenseAccount = expenseLine ? accountMap.get(expenseLine.accountId) : null

                              paymentBreakdownItems.push({
                                type: 'bill',
                                description: `Bill ${bill.reference || ''}`.trim(),
                                category: expenseAccount?.name || 'Accounts Payable',
                                categoryColor: expenseAccount?.color || '#1e3a5f',
                                amount,
                                vendorName: isCrossVendor ? billVendor?.name : undefined,
                              })
                            }
                          })

                          // 2. Add all consolidated transactions directly (checks, expenses rolled in)
                          consolidatedIds.forEach((consolidatedId) => {
                            const consolidated = rawTransactions.find((t) => t.id === consolidatedId)
                            if (consolidated) {
                              const consolidatedVendor = vendors.find((v) => v.id === consolidated.vendorId)
                              const isCrossVendor = consolidatedVendor && consolidatedVendor.id !== txn.vendorId
                              const amount = consolidated.lines.reduce((s, l) => s + l.debit, 0)

                              // Check if this consolidated item hit A/P or expense
                              const hasAPDebit = consolidated.lines.some(l => l.debit > 0 && accountMap.get(l.accountId)?.name === 'Accounts Payable')
                              if (hasAPDebit) {
                                accountedAPAmount += amount
                              } else {
                                accountedExpenseAmount += amount
                              }

                              // Find the expense category
                              const expenseLine = consolidated.lines.find((l) => l.debit > 0)
                              const expenseAccount = expenseLine ? accountMap.get(expenseLine.accountId) : null

                              // Determine what type of transaction this was
                              const typeLabel = consolidated.transactionType === 'check' ? 'Check' :
                                               consolidated.transactionType === 'expense' ? 'Expense' :
                                               consolidated.transactionType === 'bill' ? 'Bill' : 'Transaction'

                              paymentBreakdownItems.push({
                                type: 'consolidated',
                                description: `${typeLabel} ${consolidated.reference || ''}`.trim(),
                                category: expenseAccount?.name || 'Expense',
                                categoryColor: expenseAccount?.color || '#4b006e',
                                amount,
                                vendorName: isCrossVendor ? consolidatedVendor?.name : undefined,
                              })
                            }
                          })

                          // 3. Check for unaccounted A/P debits (bills not in linkedBillIds)
                          const totalAPDebits = rawPayment.lines
                            .filter(l => l.debit > 0 && accountMap.get(l.accountId)?.name === 'Accounts Payable')
                            .reduce((s, l) => s + l.debit, 0)

                          const unaccountedAP = totalAPDebits - accountedAPAmount
                          if (unaccountedAP > 0.01) {
                            paymentBreakdownItems.push({
                              type: 'bill',
                              description: 'Other bills paid',
                              category: 'Accounts Payable',
                              categoryColor: '#1e3a5f',
                              amount: unaccountedAP,
                            })
                          }

                          // 4. Add expense debits from payment lines (that weren't from consolidated items)
                          const totalExpenseDebits = rawPayment.lines
                            .filter(l => l.debit > 0 && accountMap.get(l.accountId)?.name !== 'Accounts Payable')
                            .reduce((s, l) => s + l.debit, 0)

                          const unaccountedExpense = totalExpenseDebits - accountedExpenseAmount
                          if (unaccountedExpense > 0.01) {
                            // Group by account for cleaner display
                            const expenseByAccount = new Map<string, number>()
                            rawPayment.lines
                              .filter((line) => line.debit > 0 && accountMap.get(line.accountId)?.name !== 'Accounts Payable')
                              .forEach((line) => {
                                const current = expenseByAccount.get(line.accountId) || 0
                                expenseByAccount.set(line.accountId, current + line.debit)
                              })

                            // Only add the unaccounted portion
                            let remainingToAccount = unaccountedExpense
                            expenseByAccount.forEach((amount, accountId) => {
                              if (remainingToAccount > 0.01) {
                                const amountToShow = Math.min(amount, remainingToAccount)
                                remainingToAccount -= amountToShow
                                const account = accountMap.get(accountId)
                                paymentBreakdownItems.push({
                                  type: 'expense',
                                  description: 'Added expense',
                                  category: account?.name || 'Expense',
                                  categoryColor: account?.color || '#4b006e',
                                  amount: amountToShow,
                                })
                              }
                            })
                          }
                        }
                      }

                      const hasBreakdown = isPayment && paymentBreakdownItems.length > 0

                      return (
                        <div key={txn.id} className={styles.transactionRowWrapper}>
                          <div className={`${styles.transactionRow} ${hasBreakdown ? styles.transactionRowExpandable : ''}`}>
                            <span className={styles.transactionDateCell}>
                              {hasBreakdown && (
                                <button
                                  className={`${styles.expandButton} ${isExpanded ? styles.expandButtonOpen : ''}`}
                                  onClick={() => toggleTxnExpanded(txn.id)}
                                  aria-expanded={isExpanded}
                                  aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                                  title={`${paymentBreakdownItems.length} item${paymentBreakdownItems.length !== 1 ? 's' : ''}`}
                                >
                                  <svg
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    width="14"
                                    height="14"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 5l7 7-7 7"
                                    />
                                  </svg>
                                </button>
                              )}
                              {formatDate(txn.date)}
                            </span>
                            <span className={styles.transactionType}>
                              {formatTransactionType(txn.type)}
                              {txn.type === 'bill' && (
                                <span className={`${styles.billStatusBadge} ${styles[`billStatus${txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}`]}`}>
                                  {getStatusLabel(txn.status)}
                                </span>
                              )}
                              {txn.type === 'bill-payment' && (
                                <span className={`${styles.billStatusBadge} ${styles.paymentBadge}`}>
                                  Money Out
                                </span>
                              )}
                              {txn.isConsolidated && (
                                <span className={`${styles.billStatusBadge} ${styles.consolidatedBadge}`} title="Included in a bill payment">
                                  Consolidated
                                </span>
                              )}
                            </span>
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
                                  {txn.type === 'bill-payment'
                                    ? `${cls.name} ${formatCurrency(cls.amount)}`
                                    : cls.name
                                  }
                                </span>
                              ))}
                            </span>
                            <span className={styles.transactionAmount}>
                              {formatCurrency(txn.amount)}
                              {txn.type === 'bill' && txn.amountDue > 0 && (
                                <span className={styles.amountDue}>
                                  {formatCurrency(txn.amountDue)} remaining
                                </span>
                              )}
                            </span>
                          </div>
                          {/* Payment breakdown - shows what this payment covered */}
                          {hasBreakdown && isExpanded && (
                            <div className={styles.paymentDetails}>
                              <div className={styles.paymentDetailsHeader}>
                                <span className={styles.paymentDetailsTitle}>
                                  This payment covered:
                                </span>
                              </div>
                              <div className={styles.paymentList}>
                                {paymentBreakdownItems.map((item, idx) => (
                                  <div key={idx} className={styles.paymentItem}>
                                    <span className={styles.paymentItemType}>
                                      {item.type === 'bill' ? '📋' : item.type === 'consolidated' ? '🔗' : '➕'}
                                    </span>
                                    <span className={styles.paymentItemDesc}>
                                      {item.description}
                                      {item.vendorName && (
                                        <span className={styles.crossVendorTag}>
                                          via {item.vendorName}
                                        </span>
                                      )}
                                    </span>
                                    <span className={styles.paymentBreakdown}>
                                      <span
                                        className={styles.groupTag}
                                        style={{ backgroundColor: item.categoryColor }}
                                      >
                                        {item.category}
                                      </span>
                                    </span>
                                    <span className={styles.paymentAmount}>{formatCurrency(item.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
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
