/**
 * BillPaidForm Component
 *
 * Comprehensive bill payment form that:
 * - Shows open bills filtered by vendor and amount
 * - Shows recent expenses to link (avoid double entry)
 * - Allows multi-select with partial payment amounts
 * - Captures payment date and account used
 * - Creates bill-payment transactions
 */

import { useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import type { JournalEntry, Account, TransactionType } from '../../types'
import type { Vendor } from '../../types/vendor.types'
import { Input } from '../forms/Input'
import { Select } from '../forms/Select'
import { useNewLineItem } from '../../hooks/useTransactions'
import styles from './BillPaidForm.module.css'

export interface BillPaidFormProps {
  /** All transactions to search through */
  transactions: JournalEntry[]
  /** Available accounts */
  accounts: Account[]
  /** Available vendors */
  vendors: Vendor[]
  /** Company ID */
  companyId: string
  /** User ID */
  userId: string
  /** Callback when payment is saved */
  onSave: (transactions: JournalEntry[]) => void
  /** Callback to cancel */
  onCancel: () => void
  /** Loading state */
  isLoading?: boolean
  /** Error message */
  error?: string
}

interface SelectableBill {
  id: string
  transaction: JournalEntry
  vendor: Vendor | null
  amount: number
  amountPaid: number
  amountDue: number
  date: Date
  reference: string
  memo: string
  isExpense: boolean // true if this is an expense (potential duplicate)
  selected: boolean
  paymentAmount: string // Amount being paid this time
}

/**
 * Calculate total amount from transaction lines
 */
function getTotalAmount(transaction: JournalEntry): number {
  return transaction.lines.reduce((sum, line) => sum + (line.debit || 0), 0)
}

/**
 * Get reference display for a transaction
 */
function getReferenceDisplay(txn: JournalEntry): string {
  if (txn.reference && txn.reference !== 'OPENING') {
    return txn.reference
  }
  return ''
}

export function BillPaidForm({
  transactions,
  accounts,
  vendors,
  companyId,
  userId,
  onSave,
  onCancel,
  isLoading = false,
  error,
}: BillPaidFormProps) {
  // Payment details state
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [paymentAccountId, setPaymentAccountId] = useState<string>('')
  const [referenceNumber, setReferenceNumber] = useState<string>('')
  const [memo, setMemo] = useState<string>('')

  // Discrepancy state
  const [discrepancies, setDiscrepancies] = useState<Array<{ categoryId: string; amount: string }>>([])

  // Track selected expense IDs separately so they persist when toggle is off
  const [persistedExpenseSelections, setPersistedExpenseSelections] = useState<Set<string>>(new Set())

  // Filter state
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(new Set())
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState<boolean>(false)
  const [amountSearch, setAmountSearch] = useState<string>('')
  const [showExpenses, setShowExpenses] = useState<boolean>(false)

  // Selected bills state
  const [selectedBills, setSelectedBills] = useState<Map<string, string>>(new Map())

  // Create vendor lookup map
  const vendorMap = useMemo(() => {
    const map = new Map<string, Vendor>()
    vendors.forEach(v => map.set(v.id, v))
    return map
  }, [vendors])

  // Get payment accounts (bank accounts and credit cards)
  const paymentAccounts = useMemo(() => {
    return accounts.filter(acc => {
      if (!acc.isActive) return false
      const nameLower = acc.name.toLowerCase()
      // Bank accounts
      if (acc.type === 'asset' &&
          (nameLower.includes('checking') ||
           nameLower.includes('savings') ||
           nameLower.includes('cash') ||
           nameLower.includes('bank'))) {
        return true
      }
      // Credit cards
      if (acc.type === 'liability' &&
          (nameLower.includes('credit') ||
           nameLower.includes('visa') ||
           nameLower.includes('mastercard') ||
           nameLower.includes('amex'))) {
        return true
      }
      return false
    })
  }, [accounts])

  // Get Accounts Payable account
  const accountsPayable = useMemo(() => {
    return accounts.find(acc =>
      acc.type === 'liability' &&
      (acc.name.toLowerCase().includes('accounts payable') ||
       acc.name.toLowerCase().includes('a/p'))
    )
  }, [accounts])

  // Get open bills and recent expenses
  const selectableBills = useMemo((): SelectableBill[] => {
    const bills: SelectableBill[] = []

    // Find bills (transactions with type 'bill')
    const billTransactions = transactions.filter(txn =>
      txn.transactionType === 'bill' &&
      txn.status === 'posted'
    )

    // Find bill payments to calculate what's already paid
    const billPayments = transactions.filter(txn =>
      txn.transactionType === 'bill-payment' &&
      txn.status === 'posted'
    )

    // Calculate paid amounts for each bill
    const paidAmounts = new Map<string, number>()
    billPayments.forEach(payment => {
      if (payment.linkedTransactionId) {
        const current = paidAmounts.get(payment.linkedTransactionId) || 0
        const paymentAmount = getTotalAmount(payment)
        paidAmounts.set(payment.linkedTransactionId, current + paymentAmount)
      }
    })

    // Add bills
    billTransactions.forEach(txn => {
      const amount = getTotalAmount(txn)
      const amountPaid = paidAmounts.get(txn.id) || 0
      const amountDue = amount - amountPaid

      // Only show bills with remaining balance
      if (amountDue > 0.01) {
        bills.push({
          id: txn.id,
          transaction: txn,
          vendor: txn.vendorId ? vendorMap.get(txn.vendorId) || null : null,
          amount,
          amountPaid,
          amountDue,
          date: new Date(txn.date),
          reference: getReferenceDisplay(txn),
          memo: txn.memo || '',
          isExpense: false,
          selected: selectedBills.has(txn.id),
          paymentAmount: selectedBills.get(txn.id) || '',
        })
      }
    })

    // Add recent expenses (last 90 days) that might be duplicates
    // OR if amount search is provided, search all time
    // OR if expense is already selected, keep showing it
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const hasAmountSearch = amountSearch.trim() !== ''

    const recentExpenses = transactions.filter(txn => {
      if (txn.transactionType !== 'expense' && txn.transactionType !== 'check') return false
      if (txn.status !== 'posted') return false

      // Always include if already selected (persisted selection)
      if (selectedBills.has(txn.id)) return true

      // Only include others if showExpenses is on
      if (!showExpenses) return false

      // If amount search, include all time; otherwise limit to 90 days
      if (hasAmountSearch) return true
      return new Date(txn.date) >= ninetyDaysAgo
    })

    recentExpenses.forEach(txn => {
      const amount = getTotalAmount(txn)
      bills.push({
        id: txn.id,
        transaction: txn,
        vendor: txn.vendorId ? vendorMap.get(txn.vendorId) || null : null,
        amount,
        amountPaid: 0,
        amountDue: amount,
        date: new Date(txn.date),
        reference: getReferenceDisplay(txn),
        memo: txn.memo || '',
        isExpense: true,
        selected: selectedBills.has(txn.id),
        paymentAmount: selectedBills.get(txn.id) || '',
      })
    })

    // Apply filters
    let filtered = bills

    // Vendor filter (multi-select)
    if (selectedVendorIds.size > 0) {
      filtered = filtered.filter(bill =>
        bill.vendor?.id && selectedVendorIds.has(bill.vendor.id)
      )
    }

    // Amount search
    if (amountSearch.trim()) {
      const searchAmount = parseFloat(amountSearch)
      if (!isNaN(searchAmount)) {
        // Match amounts within $1 tolerance
        filtered = filtered.filter(bill =>
          Math.abs(bill.amountDue - searchAmount) < 1 ||
          Math.abs(bill.amount - searchAmount) < 1
        )
      }
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => b.date.getTime() - a.date.getTime())

    return filtered
  }, [transactions, vendors, vendorMap, selectedVendorIds, amountSearch, showExpenses, selectedBills])

  // Get vendors that have open bills
  const vendorsWithBills = useMemo(() => {
    const vendorIds = new Set<string>()
    transactions.forEach(txn => {
      if (txn.transactionType === 'bill' && txn.vendorId) {
        vendorIds.add(txn.vendorId)
      }
    })
    return vendors.filter(v => vendorIds.has(v.id))
  }, [transactions, vendors])

  // Toggle bill selection
  const toggleBillSelection = useCallback((billId: string, amountDue: number) => {
    setSelectedBills(prev => {
      const newMap = new Map(prev)
      if (newMap.has(billId)) {
        newMap.delete(billId)
      } else {
        newMap.set(billId, amountDue.toFixed(2))
      }
      return newMap
    })
  }, [])

  // Update payment amount for a bill
  const updatePaymentAmount = useCallback((billId: string, amount: string) => {
    setSelectedBills(prev => {
      const newMap = new Map(prev)
      newMap.set(billId, amount)
      return newMap
    })
  }, [])

  // Select all visible bills
  const selectAll = useCallback(() => {
    setSelectedBills(prev => {
      const newMap = new Map(prev)
      selectableBills.forEach(bill => {
        if (!newMap.has(bill.id)) {
          newMap.set(bill.id, bill.amountDue.toFixed(2))
        }
      })
      return newMap
    })
  }, [selectableBills])

  // Clear all selections
  const clearAll = useCallback(() => {
    setSelectedBills(new Map())
  }, [])

  // Calculate total from selected items
  const totalFromItems = useMemo(() => {
    let total = 0
    selectedBills.forEach((amount) => {
      total += parseFloat(amount) || 0
    })
    return total
  }, [selectedBills])

  // Calculate total discrepancies
  const totalDiscrepancy = useMemo(() => {
    return discrepancies.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
  }, [discrepancies])

  // Payment amount from input
  const paymentAmountNum = parseFloat(paymentAmount) || 0

  // Calculate difference (what's left to allocate)
  const difference = paymentAmountNum - totalFromItems - totalDiscrepancy

  // Check if balanced (within 1 cent tolerance)
  const isBalanced = Math.abs(difference) < 0.01

  // Get all selectable accounts for discrepancy allocation
  // Includes all expense accounts plus Bank Fees and Merchant Fees if they exist
  const availableCategories = useMemo(() => {
    return accounts.filter(acc => {
      if (!acc.isActive) return false
      // Include all expense-type accounts
      if (acc.type === 'expense' || acc.type === 'cost-of-goods-sold' || acc.type === 'other-expense') {
        return true
      }
      // Include Bank Fees and Merchant Fees regardless of type
      const nameLower = acc.name.toLowerCase()
      if (nameLower.includes('bank fee') || nameLower.includes('merchant fee')) {
        return true
      }
      // Include all other account types for flexibility
      return true
    }).sort((a, b) => {
      // Sort with expense accounts first, then by name
      const aIsExpense = a.type === 'expense' || a.type === 'cost-of-goods-sold' || a.type === 'other-expense'
      const bIsExpense = b.type === 'expense' || b.type === 'cost-of-goods-sold' || b.type === 'other-expense'
      if (aIsExpense && !bIsExpense) return -1
      if (!aIsExpense && bIsExpense) return 1
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [accounts])

  // Add a discrepancy line
  const addDiscrepancy = useCallback(() => {
    const defaultCategory = availableCategories[0]?.id || ''
    setDiscrepancies(prev => [...prev, { categoryId: defaultCategory, amount: difference.toFixed(2) }])
  }, [availableCategories, difference])

  // Update a discrepancy
  const updateDiscrepancy = useCallback((index: number, field: 'categoryId' | 'amount', value: string) => {
    setDiscrepancies(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d))
  }, [])

  // Remove a discrepancy
  const removeDiscrepancy = useCallback((index: number) => {
    setDiscrepancies(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  // Handle save - creates ONE payment transaction covering all selected bills
  const handleSave = useCallback(() => {
    if (selectedBills.size === 0 || !paymentAccountId || !isBalanced) return

    // Parse payment date
    const [year, month, day] = paymentDate.split('-').map(Number)
    const parsedDate = new Date(year, month - 1, day, 12, 0, 0)

    // Build journal entry lines
    const lines = []

    // For each selected bill, debit Accounts Payable
    const vendorNames: string[] = []
    const linkedBillIds: string[] = []

    selectedBills.forEach((amountStr, billId) => {
      const amount = parseFloat(amountStr) || 0
      if (amount <= 0) return

      const bill = selectableBills.find(b => b.id === billId)
      if (!bill) return

      if (bill.vendor?.name && !vendorNames.includes(bill.vendor.name)) {
        vendorNames.push(bill.vendor.name)
      }

      if (!bill.isExpense) {
        linkedBillIds.push(billId)
      }

      // Debit Accounts Payable (reduce liability)
      if (accountsPayable) {
        lines.push({
          ...useNewLineItem(),
          accountId: accountsPayable.id,
          debit: amount,
          credit: 0,
          memo: bill.reference ? `Payment for ${bill.reference}` : (bill.memo || 'Bill payment'),
        })
      }
    })

    // Add discrepancy lines
    discrepancies.forEach(disc => {
      const amount = parseFloat(disc.amount) || 0
      if (amount === 0 || !disc.categoryId) return

      lines.push({
        ...useNewLineItem(),
        accountId: disc.categoryId,
        debit: amount > 0 ? amount : 0,
        credit: amount < 0 ? Math.abs(amount) : 0,
        memo: 'Payment discrepancy adjustment',
      })
    })

    // Credit payment account for total payment amount
    lines.push({
      ...useNewLineItem(),
      accountId: paymentAccountId,
      debit: 0,
      credit: paymentAmountNum,
      memo: memo || 'Bill payment',
    })

    // Create single payment transaction
    const paymentTransaction: JournalEntry = {
      id: crypto.randomUUID(),
      companyId,
      date: parsedDate,
      reference: referenceNumber || undefined,
      memo: memo || `Payment${vendorNames.length > 0 ? ` - ${vendorNames.join(', ')}` : ''}`,
      status: 'posted',
      lines,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      transactionType: 'bill-payment',
      vendorId: selectableBills.find(b => selectedBills.has(b.id))?.vendor?.id,
      linkedTransactionId: linkedBillIds.length === 1 ? linkedBillIds[0] : undefined,
    }

    onSave([paymentTransaction])
  }, [selectedBills, paymentAccountId, paymentDate, paymentAmountNum, referenceNumber, memo, selectableBills, accountsPayable, discrepancies, companyId, userId, onSave, isBalanced])

  // Validation - must be balanced and have required fields
  const canSave = selectedBills.size > 0 && paymentAccountId && paymentAmountNum > 0 && isBalanced

  return (
    <div className={styles.container}>
      {/* Error Message */}
      {error && (
        <div className={styles.error}>
          <strong className={styles.errorTitle}>Error:</strong> {error}
        </div>
      )}

      {/* Payment Details Section */}
      <div className={styles.paymentDetails}>
        <h3 className={styles.sectionTitle}>Payment Details</h3>
        <div className={styles.paymentFieldsRow1}>
          <div className={styles.field}>
            <label className={styles.label}>Payment Date</label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Amount Paid</label>
            <div className={styles.amountInputWrapper}>
              <span className={styles.currencyPrefix}>$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                disabled={isLoading}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Paid From</label>
            <Select
              value={paymentAccountId}
              onChange={(e) => setPaymentAccountId(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Select account...' },
                ...paymentAccounts.map(acc => ({
                  value: acc.id,
                  label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                })),
              ]}
            />
          </div>
        </div>
        <div className={styles.paymentFieldsRow2}>
          <div className={styles.field}>
            <label className={styles.label}>Reference # (optional)</label>
            <Input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Check #, confirmation, etc."
              disabled={isLoading}
            />
          </div>
          <div className={styles.fieldWide}>
            <label className={styles.label}>Memo (optional)</label>
            <Input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Payment memo..."
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className={styles.filters}>
        <div className={styles.filterGroupVendors}>
          <label className={styles.filterLabel}>Vendors</label>
          <div className={styles.multiSelectDropdown}>
            <button
              type="button"
              className={styles.dropdownTrigger}
              onClick={() => setVendorDropdownOpen(!vendorDropdownOpen)}
              disabled={isLoading || vendorsWithBills.length === 0}
            >
              <span className={styles.dropdownTriggerText}>
                {selectedVendorIds.size === 0
                  ? 'All vendors'
                  : selectedVendorIds.size === 1
                    ? vendorsWithBills.find(v => selectedVendorIds.has(v.id))?.name || '1 selected'
                    : `${selectedVendorIds.size} selected`}
              </span>
              <span className={`${styles.dropdownArrow} ${vendorDropdownOpen ? styles.open : ''}`}>
                &#9662;
              </span>
            </button>
            {vendorDropdownOpen && (
              <div className={styles.dropdownPanel}>
                {vendorsWithBills.length === 0 ? (
                  <span className={styles.noVendors}>No vendors with open bills</span>
                ) : (
                  <>
                    <div className={styles.dropdownActions}>
                      <button
                        type="button"
                        onClick={() => setSelectedVendorIds(new Set(vendorsWithBills.map(v => v.id)))}
                        className={styles.dropdownActionBtn}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedVendorIds(new Set())}
                        className={styles.dropdownActionBtn}
                      >
                        Clear
                      </button>
                    </div>
                    <div className={styles.dropdownList}>
                      {vendorsWithBills.map(v => (
                        <label key={v.id} className={styles.dropdownCheckbox}>
                          <input
                            type="checkbox"
                            checked={selectedVendorIds.has(v.id)}
                            onChange={(e) => {
                              setSelectedVendorIds(prev => {
                                const newSet = new Set(prev)
                                if (e.target.checked) {
                                  newSet.add(v.id)
                                } else {
                                  newSet.delete(v.id)
                                }
                                return newSet
                              })
                            }}
                            disabled={isLoading}
                          />
                          {v.name}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className={styles.filterGroupRight}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Search Amount</label>
            <Input
              type="number"
              step="0.01"
              value={amountSearch}
              onChange={(e) => setAmountSearch(e.target.value)}
              placeholder="Search by amount..."
              disabled={isLoading}
            />
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showExpenses}
                onChange={(e) => setShowExpenses(e.target.checked)}
                disabled={isLoading}
                className={styles.brandCheckbox}
              />
              <span className={styles.checkboxText}>
                Include Expenses
                <span className={styles.checkboxSubtext}>(avoid duplicates)</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Selection Actions */}
      <div className={styles.selectionActions}>
        <button
          type="button"
          onClick={selectAll}
          className={styles.selectAllButton}
          disabled={isLoading}
        >
          Select All Visible
        </button>
        <button
          type="button"
          onClick={clearAll}
          className={styles.clearAllButton}
          disabled={isLoading || selectedBills.size === 0}
        >
          Clear Selection
        </button>
        <div className={styles.selectionCount}>
          {selectedBills.size} selected
        </div>
      </div>

      {/* Bills List */}
      <div className={styles.billsList}>
        {selectableBills.length === 0 ? (
          <div className={styles.emptyState}>
            No open bills found matching your filters
          </div>
        ) : (
          selectableBills.map(bill => (
            <div
              key={bill.id}
              className={`${styles.billItem} ${bill.selected ? styles.selected : ''} ${bill.isExpense ? styles.expenseItem : ''}`}
            >
              <div className={styles.billCheckbox}>
                <input
                  type="checkbox"
                  checked={bill.selected}
                  onChange={() => toggleBillSelection(bill.id, bill.amountDue)}
                  disabled={isLoading}
                />
              </div>
              <div className={styles.billInfo}>
                <div className={styles.billHeader}>
                  <span className={styles.billVendor}>
                    {bill.vendor?.name || 'Unknown Vendor'}
                  </span>
                  <span className={`${styles.billType} ${bill.isExpense ? styles.expenseType : styles.billTypeTag}`}>
                    {bill.isExpense ? 'Expense' : 'Bill'}
                  </span>
                </div>
                <div className={styles.billDetails}>
                  <span className={styles.billDate}>
                    {format(bill.date, 'MMM d, yyyy')}
                  </span>
                  {bill.reference && (
                    <span className={styles.billReference}>
                      Ref: {bill.reference}
                    </span>
                  )}
                  {bill.memo && (
                    <span className={styles.billMemo}>
                      {bill.memo}
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.billAmounts}>
                <div className={styles.amountRow}>
                  <span className={styles.amountLabel}>Total:</span>
                  <span className={styles.amountValue}>{formatCurrency(bill.amount)}</span>
                </div>
                {bill.amountPaid > 0 && (
                  <div className={styles.amountRow}>
                    <span className={styles.amountLabel}>Paid:</span>
                    <span className={styles.amountPaid}>{formatCurrency(bill.amountPaid)}</span>
                  </div>
                )}
                <div className={styles.amountRow}>
                  <span className={styles.amountLabel}>Due:</span>
                  <span className={styles.amountDue}>{formatCurrency(bill.amountDue)}</span>
                </div>
              </div>
              {bill.selected && (
                <div className={styles.paymentAmountField}>
                  <label className={styles.paymentAmountLabel}>Pay:</label>
                  <div className={styles.paymentAmountInput}>
                    <span className={styles.currencySymbol}>$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={bill.amountDue}
                      value={bill.paymentAmount}
                      onChange={(e) => updatePaymentAmount(bill.id, e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Discrepancies Section */}
      {discrepancies.length > 0 && (
        <div className={styles.discrepanciesSection}>
          <div className={styles.discrepancyHeader}>
            <h4 className={styles.discrepancyTitle}>Discrepancies</h4>
            <button
              type="button"
              onClick={addDiscrepancy}
              className={styles.addAnotherDiscrepancy}
              disabled={isLoading}
            >
              + Add Line
            </button>
          </div>
          {discrepancies.map((disc, index) => (
            <div key={index} className={styles.discrepancyRow}>
              <Select
                value={disc.categoryId}
                onChange={(e) => updateDiscrepancy(index, 'categoryId', e.target.value)}
                disabled={isLoading}
                options={[
                  { value: '', label: 'Select account...' },
                  ...availableCategories.map(acc => ({
                    value: acc.id,
                    label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                  })),
                ]}
              />
              <div className={styles.discrepancyAmount}>
                <span className={styles.currencyPrefix}>$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={disc.amount}
                  onChange={(e) => updateDiscrepancy(index, 'amount', e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <button
                type="button"
                onClick={() => removeDiscrepancy(index)}
                className={styles.removeDiscrepancyButton}
                disabled={isLoading}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Total and Actions */}
      <div className={styles.footer}>
        <div className={styles.totalSection}>
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Total Payment:</span>
            <span className={styles.totalAmount}>{formatCurrency(paymentAmountNum)}</span>
          </div>
          {!isBalanced && (
            <div className={styles.differenceRow}>
              <span className={styles.differenceLabel}>Difference:</span>
              <span className={`${styles.differenceAmount} ${difference > 0 ? styles.positive : styles.negative}`}>
                {difference > 0 ? '+' : ''}{formatCurrency(difference)}
              </span>
              <button
                type="button"
                onClick={addDiscrepancy}
                className={styles.addDiscrepancyButton}
                disabled={isLoading || availableCategories.length === 0}
              >
                + Add Discrepancy
              </button>
            </div>
          )}
          {!isBalanced && paymentAmountNum > 0 && (
            <div className={styles.balanceWarning}>
              Amounts must balance before recording payment
            </div>
          )}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={onCancel}
            className={styles.cancelButton}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={styles.saveButton}
            disabled={!canSave || isLoading}
          >
            {isLoading ? 'Saving...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
