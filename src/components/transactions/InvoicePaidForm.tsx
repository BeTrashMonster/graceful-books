/**
 * InvoicePaidForm Component
 *
 * Comprehensive invoice payment form that:
 * - Shows open invoices filtered by customer and amount
 * - Shows recent deposits to link (avoid double entry)
 * - Allows multi-select with partial payment amounts
 * - Captures payment date and account received into
 * - Creates invoice-payment transactions
 */

import { useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import type { JournalEntry, Account, TransactionType, Contact } from '../../types'
import { Input } from '../forms/Input'
import { Select } from '../forms/Select'
import { useNewLineItem } from '../../hooks/useTransactions'
import styles from './InvoicePaidForm.module.css'

export interface InvoicePaidFormProps {
  /** All transactions to search through */
  transactions: JournalEntry[]
  /** Available accounts */
  accounts: Account[]
  /** Available customers */
  customers: Contact[]
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

interface SelectableInvoice {
  id: string
  transaction: JournalEntry
  customer: Contact | null
  amount: number
  amountPaid: number
  amountDue: number
  date: Date
  reference: string
  memo: string
  isDeposit: boolean // true if this is a deposit (potential duplicate)
  selected: boolean
  paymentAmount: string // Amount being received this time
}

/**
 * Calculate total amount from transaction lines
 */
function getTotalAmount(transaction: JournalEntry): number {
  return transaction.lines.reduce((sum, line) => sum + (line.credit || 0), 0)
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

export function InvoicePaidForm({
  transactions,
  accounts,
  customers,
  companyId,
  userId,
  onSave,
  onCancel,
  isLoading = false,
  error,
}: InvoicePaidFormProps) {
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

  // Filter state
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set())
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState<boolean>(false)
  const [amountSearch, setAmountSearch] = useState<string>('')
  const [showDeposits, setShowDeposits] = useState<boolean>(false)

  // Selected invoices state
  const [selectedInvoices, setSelectedInvoices] = useState<Map<string, string>>(new Map())

  // Create customer lookup map
  const customerMap = useMemo(() => {
    const map = new Map<string, Contact>()
    customers.forEach(c => map.set(c.id, c))
    return map
  }, [customers])

  // Get deposit accounts (bank accounts)
  const depositAccounts = useMemo(() => {
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
      return false
    })
  }, [accounts])

  // Get Accounts Receivable account
  const accountsReceivable = useMemo(() => {
    return accounts.find(acc =>
      acc.type === 'asset' &&
      (acc.name.toLowerCase().includes('accounts receivable') ||
       acc.name.toLowerCase().includes('a/r'))
    )
  }, [accounts])

  // Get open invoices and recent deposits
  const selectableInvoices = useMemo((): SelectableInvoice[] => {
    const invoices: SelectableInvoice[] = []

    // Find invoices (transactions with type 'invoice')
    const invoiceTransactions = transactions.filter(txn =>
      txn.transactionType === 'invoice' &&
      txn.status === 'posted'
    )

    // Find invoice payments to calculate what's already paid
    const invoicePayments = transactions.filter(txn =>
      txn.transactionType === 'invoice-payment' &&
      txn.status === 'posted'
    )

    // Calculate paid amounts for each invoice
    const paidAmounts = new Map<string, number>()
    invoicePayments.forEach(payment => {
      if (payment.linkedTransactionId) {
        const current = paidAmounts.get(payment.linkedTransactionId) || 0
        const paymentAmount = getTotalAmount(payment)
        paidAmounts.set(payment.linkedTransactionId, current + paymentAmount)
      }
    })

    // Add invoices
    invoiceTransactions.forEach(txn => {
      const amount = getTotalAmount(txn)
      const amountPaid = paidAmounts.get(txn.id) || 0
      const amountDue = amount - amountPaid

      // Only show invoices with remaining balance
      if (amountDue > 0.01) {
        invoices.push({
          id: txn.id,
          transaction: txn,
          customer: txn.customerId ? customerMap.get(txn.customerId) || null : null,
          amount,
          amountPaid,
          amountDue,
          date: new Date(txn.date),
          reference: getReferenceDisplay(txn),
          memo: txn.memo || '',
          isDeposit: false,
          selected: selectedInvoices.has(txn.id),
          paymentAmount: selectedInvoices.get(txn.id) || '',
        })
      }
    })

    // Add recent deposits (last 90 days) that might be duplicates
    // OR if amount search is provided, search all time
    // OR if deposit is already selected, keep showing it
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const hasAmountSearch = amountSearch.trim() !== ''

    const recentDeposits = transactions.filter(txn => {
      if (txn.transactionType !== 'deposit' && txn.transactionType !== 'income') return false
      if (txn.status !== 'posted') return false

      // Always include if already selected
      if (selectedInvoices.has(txn.id)) return true

      // Only include others if showDeposits is on
      if (!showDeposits) return false

      // If amount search, include all time; otherwise limit to 90 days
      if (hasAmountSearch) return true
      return new Date(txn.date) >= ninetyDaysAgo
    })

    recentDeposits.forEach(txn => {
      const amount = getTotalAmount(txn)
      invoices.push({
        id: txn.id,
        transaction: txn,
        customer: txn.customerId ? customerMap.get(txn.customerId) || null : null,
        amount,
        amountPaid: 0,
        amountDue: amount,
        date: new Date(txn.date),
        reference: getReferenceDisplay(txn),
        memo: txn.memo || '',
        isDeposit: true,
        selected: selectedInvoices.has(txn.id),
        paymentAmount: selectedInvoices.get(txn.id) || '',
      })
    })

    // Apply filters
    let filtered = invoices

    // Customer filter (multi-select)
    if (selectedCustomerIds.size > 0) {
      filtered = filtered.filter(invoice =>
        invoice.customer?.id && selectedCustomerIds.has(invoice.customer.id)
      )
    }

    // Amount search
    if (amountSearch.trim()) {
      const searchAmount = parseFloat(amountSearch)
      if (!isNaN(searchAmount)) {
        // Match amounts within $1 tolerance
        filtered = filtered.filter(invoice =>
          Math.abs(invoice.amountDue - searchAmount) < 1 ||
          Math.abs(invoice.amount - searchAmount) < 1
        )
      }
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => b.date.getTime() - a.date.getTime())

    return filtered
  }, [transactions, customers, customerMap, amountSearch, showDeposits, selectedInvoices, selectedCustomerIds])

  // Get customers that have open invoices
  const customersWithInvoices = useMemo(() => {
    const customerIds = new Set<string>()
    transactions.forEach(txn => {
      if (txn.transactionType === 'invoice' && txn.customerId) {
        customerIds.add(txn.customerId)
      }
    })
    return customers.filter(c => customerIds.has(c.id))
  }, [transactions, customers])

  // Toggle invoice selection
  const toggleInvoiceSelection = useCallback((invoiceId: string, amountDue: number) => {
    setSelectedInvoices(prev => {
      const newMap = new Map(prev)
      if (newMap.has(invoiceId)) {
        newMap.delete(invoiceId)
      } else {
        newMap.set(invoiceId, amountDue.toFixed(2))
      }
      return newMap
    })
  }, [])

  // Update payment amount for an invoice
  const updatePaymentAmount = useCallback((invoiceId: string, amount: string) => {
    setSelectedInvoices(prev => {
      const newMap = new Map(prev)
      newMap.set(invoiceId, amount)
      return newMap
    })
  }, [])

  // Select all visible invoices
  const selectAll = useCallback(() => {
    setSelectedInvoices(prev => {
      const newMap = new Map(prev)
      selectableInvoices.forEach(invoice => {
        if (!newMap.has(invoice.id)) {
          newMap.set(invoice.id, invoice.amountDue.toFixed(2))
        }
      })
      return newMap
    })
  }, [selectableInvoices])

  // Clear all selections
  const clearAll = useCallback(() => {
    setSelectedInvoices(new Map())
  }, [])

  // Calculate total from selected items
  const totalFromItems = useMemo(() => {
    let total = 0
    selectedInvoices.forEach((amount) => {
      total += parseFloat(amount) || 0
    })
    return total
  }, [selectedInvoices])

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
  const availableCategories = useMemo(() => {
    return accounts.filter(acc => {
      if (!acc.isActive) return false
      // Include all income-type accounts
      if (acc.type === 'income' || acc.type === 'other-income') {
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
      // Sort with income accounts first, then by name
      const aIsIncome = a.type === 'income' || a.type === 'other-income'
      const bIsIncome = b.type === 'income' || b.type === 'other-income'
      if (aIsIncome && !bIsIncome) return -1
      if (!aIsIncome && bIsIncome) return 1
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

  // Handle save - creates ONE payment transaction covering all selected invoices
  const handleSave = useCallback(() => {
    if (selectedInvoices.size === 0 || !paymentAccountId || !isBalanced) return

    // Parse payment date
    const [year, month, day] = paymentDate.split('-').map(Number)
    const parsedDate = new Date(year, month - 1, day, 12, 0, 0)

    // Build journal entry lines
    const lines = []

    // For each selected invoice, credit Accounts Receivable
    const customerNames: string[] = []
    const linkedInvoiceIds: string[] = []

    selectedInvoices.forEach((amountStr, invoiceId) => {
      const amount = parseFloat(amountStr) || 0
      if (amount <= 0) return

      const invoice = selectableInvoices.find(i => i.id === invoiceId)
      if (!invoice) return

      if (invoice.customer?.name && !customerNames.includes(invoice.customer.name)) {
        customerNames.push(invoice.customer.name)
      }

      if (!invoice.isDeposit) {
        linkedInvoiceIds.push(invoiceId)
      }

      // Credit Accounts Receivable (reduce asset)
      if (accountsReceivable) {
        lines.push({
          ...useNewLineItem(),
          accountId: accountsReceivable.id,
          debit: 0,
          credit: amount,
          memo: invoice.reference ? `Payment for ${invoice.reference}` : (invoice.memo || 'Invoice payment'),
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
        debit: amount < 0 ? Math.abs(amount) : 0,
        credit: amount > 0 ? amount : 0,
        memo: 'Payment discrepancy adjustment',
      })
    })

    // Debit bank account for total payment received
    lines.push({
      ...useNewLineItem(),
      accountId: paymentAccountId,
      debit: paymentAmountNum,
      credit: 0,
      memo: memo || 'Invoice payment received',
    })

    // Create single payment transaction
    const paymentTransaction: JournalEntry = {
      id: crypto.randomUUID(),
      companyId,
      date: parsedDate,
      reference: referenceNumber || undefined,
      memo: memo || `Payment received${customerNames.length > 0 ? ` from ${customerNames.join(', ')}` : ''}`,
      status: 'posted',
      lines,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      transactionType: 'invoice-payment',
      customerId: selectableInvoices.find(i => selectedInvoices.has(i.id))?.customer?.id,
      linkedTransactionId: linkedInvoiceIds.length === 1 ? linkedInvoiceIds[0] : undefined,
    }

    onSave([paymentTransaction])
  }, [selectedInvoices, paymentAccountId, paymentDate, paymentAmountNum, referenceNumber, memo, selectableInvoices, accountsReceivable, discrepancies, companyId, userId, onSave, isBalanced])

  // Validation - must be balanced and have required fields
  const canSave = selectedInvoices.size > 0 && paymentAccountId && paymentAmountNum > 0 && isBalanced

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
            <label className={styles.label}>Amount Received</label>
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
            <label className={styles.label}>Deposit To</label>
            <Select
              value={paymentAccountId}
              onChange={(e) => setPaymentAccountId(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Select account...' },
                ...depositAccounts.map(acc => ({
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
        <div className={styles.filterGroupCustomers}>
          <label className={styles.filterLabel}>Customers</label>
          <div className={styles.multiSelectDropdown}>
            <button
              type="button"
              className={styles.dropdownTrigger}
              onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)}
              disabled={isLoading || customersWithInvoices.length === 0}
            >
              <span className={styles.dropdownTriggerText}>
                {selectedCustomerIds.size === 0
                  ? 'All customers'
                  : selectedCustomerIds.size === 1
                    ? customersWithInvoices.find(c => selectedCustomerIds.has(c.id))?.name || '1 selected'
                    : `${selectedCustomerIds.size} selected`}
              </span>
              <span className={`${styles.dropdownArrow} ${customerDropdownOpen ? styles.open : ''}`}>
                &#9662;
              </span>
            </button>
            {customerDropdownOpen && (
              <div className={styles.dropdownPanel}>
                {customersWithInvoices.length === 0 ? (
                  <span className={styles.noCustomers}>No customers with open invoices</span>
                ) : (
                  <>
                    <div className={styles.dropdownActions}>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerIds(new Set(customersWithInvoices.map(c => c.id)))}
                        className={styles.dropdownActionBtn}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerIds(new Set())}
                        className={styles.dropdownActionBtn}
                      >
                        Clear
                      </button>
                    </div>
                    <div className={styles.dropdownList}>
                      {customersWithInvoices.map(c => (
                        <label key={c.id} className={styles.dropdownCheckbox}>
                          <input
                            type="checkbox"
                            checked={selectedCustomerIds.has(c.id)}
                            onChange={(e) => {
                              setSelectedCustomerIds(prev => {
                                const newSet = new Set(prev)
                                if (e.target.checked) {
                                  newSet.add(c.id)
                                } else {
                                  newSet.delete(c.id)
                                }
                                return newSet
                              })
                            }}
                            disabled={isLoading}
                          />
                          {c.name}
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
                checked={showDeposits}
                onChange={(e) => setShowDeposits(e.target.checked)}
                disabled={isLoading}
                className={styles.brandCheckbox}
              />
              <span className={styles.checkboxText}>
                Include Deposits
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
          disabled={isLoading || selectedInvoices.size === 0}
        >
          Clear Selection
        </button>
        <div className={styles.selectionCount}>
          {selectedInvoices.size} selected
        </div>
      </div>

      {/* Invoices List */}
      <div className={styles.invoicesList}>
        {selectableInvoices.length === 0 ? (
          <div className={styles.emptyState}>
            No open invoices found matching your filters
          </div>
        ) : (
          selectableInvoices.map(invoice => (
            <div
              key={invoice.id}
              className={`${styles.invoiceItem} ${invoice.selected ? styles.selected : ''} ${invoice.isDeposit ? styles.depositItem : ''}`}
            >
              <div className={styles.invoiceCheckbox}>
                <input
                  type="checkbox"
                  checked={invoice.selected}
                  onChange={() => toggleInvoiceSelection(invoice.id, invoice.amountDue)}
                  disabled={isLoading}
                />
              </div>
              <div className={styles.invoiceInfo}>
                <div className={styles.invoiceHeader}>
                  <span className={styles.invoiceCustomer}>
                    {invoice.customer?.name || 'Unknown Customer'}
                  </span>
                  <span className={`${styles.invoiceType} ${invoice.isDeposit ? styles.depositType : styles.invoiceTypeTag}`}>
                    {invoice.isDeposit ? 'Deposit' : 'Invoice'}
                  </span>
                </div>
                <div className={styles.invoiceDetails}>
                  <span className={styles.invoiceDate}>
                    {format(invoice.date, 'MMM d, yyyy')}
                  </span>
                  {invoice.reference && (
                    <span className={styles.invoiceReference}>
                      Ref: {invoice.reference}
                    </span>
                  )}
                  {invoice.memo && (
                    <span className={styles.invoiceMemo}>
                      {invoice.memo}
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.invoiceAmounts}>
                <div className={styles.amountRow}>
                  <span className={styles.amountLabel}>Total:</span>
                  <span className={styles.amountValue}>{formatCurrency(invoice.amount)}</span>
                </div>
                {invoice.amountPaid > 0 && (
                  <div className={styles.amountRow}>
                    <span className={styles.amountLabel}>Paid:</span>
                    <span className={styles.amountPaid}>{formatCurrency(invoice.amountPaid)}</span>
                  </div>
                )}
                <div className={styles.amountRow}>
                  <span className={styles.amountLabel}>Due:</span>
                  <span className={styles.amountDue}>{formatCurrency(invoice.amountDue)}</span>
                </div>
              </div>
              {invoice.selected && (
                <div className={styles.paymentAmountField}>
                  <label className={styles.paymentAmountLabel}>Receive:</label>
                  <div className={styles.paymentAmountInput}>
                    <span className={styles.currencySymbol}>$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={invoice.amountDue}
                      value={invoice.paymentAmount}
                      onChange={(e) => updatePaymentAmount(invoice.id, e.target.value)}
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
            <span className={styles.totalLabel}>Total Received:</span>
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
