/**
 * ExpenseForm Component
 *
 * Comprehensive expense entry form with:
 * - Expense/Check/Bill type toggle
 * - Vendor selection with typeahead
 * - Multi-line category breakdown
 * - Reference number field
 * - Proper transaction type tagging
 */

import { useState, useMemo, useCallback } from 'react'
import type { JournalEntry, Account, TransactionType } from '../../types'
import type { Vendor } from '../../types/vendor.types'
import { Input } from '../forms/Input'
import { Select } from '../forms/Select'
import { VendorSelect } from '../vendors/VendorSelect'
import { VendorModal } from '../vendors/VendorModal'
import { useNewLineItem } from '../../hooks/useTransactions'
import styles from './ExpenseForm.module.css'

export interface ExpenseFormProps {
  transaction: JournalEntry
  accounts: Account[]
  companyId: string
  onChange: (transaction: JournalEntry) => void
  onSave: () => void
  onCancel: () => void
  isLoading?: boolean
  error?: string
}

type ExpenseType = 'expense' | 'check' | 'bill'

interface CategoryLine {
  id: string
  categoryId: string
  amount: string
  memo: string
}

export function ExpenseForm({
  transaction,
  accounts,
  companyId,
  onChange,
  onSave,
  onCancel,
  isLoading = false,
  error,
}: ExpenseFormProps) {
  // Form state
  const [expenseType, setExpenseType] = useState<ExpenseType>('expense')
  const [date, setDate] = useState<string>(
    transaction.date.toISOString().split('T')[0] || ''
  )
  const [totalAmount, setTotalAmount] = useState<string>('')
  const [paidFromAccount, setPaidFromAccount] = useState<string>('')
  const [vendorId, setVendorId] = useState<string | null>(null)
  const [reference, setReference] = useState<string>('')
  const [checkNumber, setCheckNumber] = useState<string>('')
  const [dueDate, setDueDate] = useState<string>('')
  const [memo, setMemo] = useState<string>(transaction.memo || '')
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [personalAccountRef, setPersonalAccountRef] = useState<string>('')

  // Multi-line categories
  const [categoryLines, setCategoryLines] = useState<CategoryLine[]>([
    { id: crypto.randomUUID(), categoryId: '', amount: '', memo: '' },
  ])

  // Build set of parent account IDs (accounts that have children can't be posted to)
  const parentAccountIds = useMemo(
    () =>
      new Set(
        accounts
          .filter((acc) => acc.parentAccountId)
          .map((acc) => acc.parentAccountId)
      ),
    [accounts]
  )

  // Helper to check if account is selectable (not a parent)
  const isSelectable = useCallback(
    (acc: Account) => !parentAccountIds.has(acc.id),
    [parentAccountIds]
  )

  // Flex accounts (for personal/business fund mixing)
  const flexAccounts = useMemo(
    () =>
      accounts.filter(
        (acc) =>
          isSelectable(acc) &&
          acc.isActive &&
          acc.subType === 'flex-account'
      ),
    [accounts, isSelectable]
  )

  // Payment accounts: Bank accounts and Credit Cards (NOT including flex accounts - those are separate)
  const paymentAccounts = useMemo(
    () =>
      accounts.filter(
        (acc) =>
          isSelectable(acc) &&
          acc.isActive &&
          acc.subType !== 'flex-account' && // Exclude flex accounts
          (
            // Bank accounts (checking, savings, cash)
            (acc.type === 'asset' &&
              (acc.name.toLowerCase().includes('checking') ||
                acc.name.toLowerCase().includes('savings') ||
                acc.name.toLowerCase().includes('cash') ||
                acc.name.toLowerCase().includes('petty'))) ||
            // Credit cards
            (acc.type === 'liability' &&
              acc.name.toLowerCase().includes('credit'))
          )
      ),
    [accounts, isSelectable]
  )

  // Helper to extract owner name from flex account for context-aware labels
  const getFlexAccountOwnerName = (acc: Account): string => {
    // Format is "[Name] - Flex Account (X%)"
    const match = acc.name.match(/^(.+?)\s*-\s*Flex Account/)
    return match ? match[1].trim() : acc.name
  }

  // Check if selected payment account is a flex account
  const selectedPaymentIsFlexAccount = useMemo(
    () => flexAccounts.some((acc) => acc.id === paidFromAccount),
    [flexAccounts, paidFromAccount]
  )

  // Accounts Payable (for bills)
  const accountsPayableAccount = useMemo(
    () =>
      accounts.find(
        (acc) =>
          isSelectable(acc) &&
          acc.type === 'liability' &&
          (acc.name.toLowerCase().includes('accounts payable') ||
            acc.name.toLowerCase().includes('a/p'))
      ),
    [accounts, isSelectable]
  )

  // Expense/category accounts (NOT including flex - those are added separately)
  const expenseAccounts = useMemo(
    () =>
      accounts.filter(
        (acc) =>
          isSelectable(acc) &&
          acc.isActive &&
          acc.subType !== 'flex-account' && // Exclude flex accounts
          (acc.type === 'expense' ||
            acc.type === 'cost-of-goods-sold' ||
            acc.type === 'other-expense')
      ),
    [accounts, isSelectable]
  )

  // Calculate total from category lines
  const calculatedTotal = useMemo(() => {
    return categoryLines.reduce((sum, line) => {
      const amount = parseFloat(line.amount) || 0
      return sum + amount
    }, 0)
  }, [categoryLines])

  // Check if amounts match
  const totalAmountNum = parseFloat(totalAmount) || 0
  const amountsMatch = Math.abs(calculatedTotal - totalAmountNum) < 0.01
  const hasMultipleLines = categoryLines.length > 1

  // Add a new category line
  const addCategoryLine = () => {
    setCategoryLines([
      ...categoryLines,
      { id: crypto.randomUUID(), categoryId: '', amount: '', memo: '' },
    ])
  }

  // Remove a category line
  const removeCategoryLine = (id: string) => {
    if (categoryLines.length > 1) {
      setCategoryLines(categoryLines.filter((line) => line.id !== id))
    }
  }

  // Update a category line
  const updateCategoryLine = (
    id: string,
    field: keyof CategoryLine,
    value: string
  ) => {
    setCategoryLines(
      categoryLines.map((line) =>
        line.id === id ? { ...line, [field]: value } : line
      )
    )
  }

  // Auto-fill remaining amount for single line
  const handleTotalAmountChange = (value: string) => {
    setTotalAmount(value)
    // If single category line, auto-fill the amount
    if (categoryLines.length === 1 && categoryLines[0]) {
      setCategoryLines([{ ...categoryLines[0], amount: value }])
    }
  }

  // Handle vendor selection
  const handleVendorChange = (id: string | null, vendor?: Vendor) => {
    setVendorId(id)
  }

  // Handle vendor created from modal
  const handleVendorCreated = (vendor: Vendor) => {
    setVendorId(vendor.id)
    setShowVendorModal(false)
  }

  // Build and save the transaction
  const handleSave = () => {
    const amountNum = parseFloat(totalAmount) || 0
    if (amountNum === 0) return

    // Validate category lines
    const validLines = categoryLines.filter(
      (line) => line.categoryId && parseFloat(line.amount) > 0
    )
    if (validLines.length === 0) return

    // Determine transaction type for tagging
    let transactionType: TransactionType = 'expense'
    if (expenseType === 'check') transactionType = 'check'
    if (expenseType === 'bill') transactionType = 'bill'

    // Build journal entry lines
    const journalLines = []

    // Add category lines (debits)
    for (const catLine of validLines) {
      journalLines.push({
        ...useNewLineItem(),
        accountId: catLine.categoryId,
        debit: parseFloat(catLine.amount),
        credit: 0,
        memo: catLine.memo || memo,
      })
    }

    // Add payment/payable line (credit)
    if (expenseType === 'bill') {
      // Bill: Credit Accounts Payable
      if (accountsPayableAccount) {
        journalLines.push({
          ...useNewLineItem(),
          accountId: accountsPayableAccount.id,
          debit: 0,
          credit: amountNum,
          memo: memo,
        })
      }
    } else {
      // Expense/Check: Credit payment account
      if (paidFromAccount) {
        journalLines.push({
          ...useNewLineItem(),
          accountId: paidFromAccount,
          debit: 0,
          credit: amountNum,
          memo: memo,
        })
      }
    }

    // Build the transaction
    const updatedTransaction: JournalEntry = {
      ...transaction,
      date: new Date(date),
      reference: expenseType === 'check' ? checkNumber : reference || undefined,
      memo: memo || undefined,
      lines: journalLines,
      transactionType,
      vendorId: vendorId || undefined,
      checkNumber: expenseType === 'check' ? checkNumber : undefined,
      dueDate: expenseType === 'bill' && dueDate ? new Date(dueDate) : undefined,
      personalAccountRef: selectedPaymentIsFlexAccount ? personalAccountRef || undefined : undefined,
    }

    onChange(updatedTransaction)
    onSave()
  }

  // Validation
  const canSave =
    totalAmountNum > 0 &&
    categoryLines.some((line) => line.categoryId && parseFloat(line.amount) > 0) &&
    (expenseType === 'bill' || paidFromAccount) &&
    (!hasMultipleLines || amountsMatch)

  return (
    <div className={styles.form}>
      {/* Error Message */}
      {error && (
        <div className={styles.error}>
          <strong>Oops!</strong> {error}
        </div>
      )}

      {/* Expense Type Toggle */}
      <div className={styles.typeToggle}>
        <button
          type="button"
          onClick={() => setExpenseType('expense')}
          className={`${styles.typeButton} ${expenseType === 'expense' ? styles.active : ''}`}
          disabled={isLoading}
        >
          Expense
        </button>
        <button
          type="button"
          onClick={() => setExpenseType('check')}
          className={`${styles.typeButton} ${expenseType === 'check' ? styles.active : ''}`}
          disabled={isLoading}
        >
          Check
        </button>
        <button
          type="button"
          onClick={() => setExpenseType('bill')}
          className={`${styles.typeButton} ${expenseType === 'bill' ? styles.active : ''}`}
          disabled={isLoading}
        >
          Bill
        </button>
      </div>

      {/* Main Form Grid */}
      <div className={styles.fieldGrid}>
        {/* Row 1: Date, Amount, Vendor */}
        <div className={styles.field}>
          <label className={styles.label}>Date</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Total Amount</label>
          <div className={styles.amountInput}>
            <span className={styles.currencySymbol}>$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={totalAmount}
              onChange={(e) => handleTotalAmountChange(e.target.value)}
              placeholder="0.00"
              disabled={isLoading}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Vendor</label>
          <VendorSelect
            value={vendorId}
            onChange={handleVendorChange}
            onCreateNew={() => setShowVendorModal(true)}
            companyId={companyId}
            placeholder="Search vendors..."
            disabled={isLoading}
          />
        </div>

        {/* Row 2: Payment/Due Date, Reference/Check # */}
        {expenseType !== 'bill' && (
          <>
            <div className={styles.field}>
              <label className={styles.label}>Paid From</label>
              <Select
                value={paidFromAccount}
                onChange={(e) => {
                  setPaidFromAccount(e.target.value)
                  // Clear personal account ref if not selecting a flex account
                  if (!flexAccounts.some((acc) => acc.id === e.target.value)) {
                    setPersonalAccountRef('')
                  }
                }}
                disabled={isLoading}
                options={[
                  { value: '', label: 'Select account...' },
                  // Regular payment accounts
                  ...paymentAccounts.map((acc) => ({
                    value: acc.id,
                    label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                  })),
                  // Flex accounts with "Paid Personally" label
                  ...flexAccounts.map((acc) => ({
                    value: acc.id,
                    label: `${getFlexAccountOwnerName(acc)} - Paid Personally`,
                  })),
                ]}
              />
            </div>

            {/* Personal Account Reference - shown when Paid Personally is selected */}
            {selectedPaymentIsFlexAccount && (
              <div className={styles.field}>
                <label className={styles.label}>Which personal account?</label>
                <Input
                  type="text"
                  value={personalAccountRef}
                  onChange={(e) => setPersonalAccountRef(e.target.value)}
                  placeholder="e.g., Chase Visa ...4532"
                  disabled={isLoading}
                  list="personalAccountSuggestions"
                />
                <datalist id="personalAccountSuggestions">
                  <option value="Personal Visa" />
                  <option value="Personal Mastercard" />
                  <option value="Personal Checking" />
                  <option value="Personal Debit Card" />
                  <option value="Cash" />
                </datalist>
              </div>
            )}
          </>
        )}

        {expenseType === 'bill' && (
          <div className={styles.field}>
            <label className={styles.label}>Due Date</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isLoading}
            />
          </div>
        )}

        {expenseType === 'check' ? (
          <div className={styles.field}>
            <label className={styles.label}>Check #</label>
            <Input
              type="text"
              value={checkNumber}
              onChange={(e) => setCheckNumber(e.target.value)}
              placeholder="Check number"
              disabled={isLoading}
            />
          </div>
        ) : (
          <div className={styles.field}>
            <label className={styles.label}>Reference #</label>
            <Input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Invoice #, PO #, etc."
              disabled={isLoading}
            />
          </div>
        )}
      </div>

      {/* Category Breakdown */}
      <div className={styles.categorySection}>
        <div className={styles.categorySectionHeader}>
          <h4 className={styles.categorySectionTitle}>Category Breakdown</h4>
          {hasMultipleLines && (
            <div className={`${styles.amountStatus} ${amountsMatch ? styles.matches : styles.mismatch}`}>
              {amountsMatch ? (
                <span>Totals match</span>
              ) : (
                <span>
                  Lines: ${calculatedTotal.toFixed(2)} / Total: ${totalAmountNum.toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className={styles.categoryLines}>
          {categoryLines.map((line, index) => (
            <div key={line.id} className={styles.categoryLine}>
              <div className={styles.categoryLineMain}>
                <div className={styles.categorySelect}>
                  <Select
                    value={line.categoryId}
                    onChange={(e) =>
                      updateCategoryLine(line.id, 'categoryId', e.target.value)
                    }
                    disabled={isLoading}
                    options={[
                      { value: '', label: 'Select category...' },
                      // Regular expense accounts
                      ...expenseAccounts.map((acc) => ({
                        value: acc.id,
                        label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                      })),
                      // Flex accounts with "Personal Item" label
                      ...flexAccounts.map((acc) => ({
                        value: acc.id,
                        label: `${getFlexAccountOwnerName(acc)} - Personal Item`,
                      })),
                    ]}
                  />
                </div>
                <div className={styles.categoryAmount}>
                  <div className={styles.amountInput}>
                    <span className={styles.currencySymbol}>$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.amount}
                      onChange={(e) =>
                        updateCategoryLine(line.id, 'amount', e.target.value)
                      }
                      placeholder="0.00"
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className={styles.categoryMemo}>
                  <Input
                    type="text"
                    value={line.memo}
                    onChange={(e) =>
                      updateCategoryLine(line.id, 'memo', e.target.value)
                    }
                    placeholder="Line description"
                    disabled={isLoading}
                  />
                </div>
                {categoryLines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCategoryLine(line.id)}
                    className={styles.removeLineButton}
                    disabled={isLoading}
                    aria-label="Remove line"
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addCategoryLine}
          className={styles.addLineButton}
          disabled={isLoading}
        >
          + Add Category Line
        </button>
      </div>

      {/* Memo */}
      <div className={styles.memoField}>
        <label className={styles.label}>Memo (optional)</label>
        <Input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Overall transaction description"
          disabled={isLoading}
        />
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className={styles.cancelButton}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || isLoading}
          className={styles.saveButton}
        >
          {isLoading ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Vendor Modal */}
      <VendorModal
        isOpen={showVendorModal}
        onClose={() => setShowVendorModal(false)}
        onSave={handleVendorCreated}
        companyId={companyId}
      />
    </div>
  )
}
