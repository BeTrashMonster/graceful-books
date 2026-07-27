/**
 * Simple Transaction Form
 *
 * Beginner-friendly transaction entry that hides double-entry accounting complexity.
 * Compact layout with fields side-by-side for efficient data entry.
 */

import { useState, useMemo } from 'react'
import type { JournalEntry, Account } from '../../types'
import { Input } from '../forms/Input'
import { Select } from '../forms/Select'
import { useNewLineItem } from '../../hooks/useTransactions'
import styles from './SimpleTransactionForm.module.css'

export interface SimpleTransactionFormProps {
  transaction: JournalEntry
  accounts: Account[]
  onChange: (transaction: JournalEntry) => void
  onSave: (transaction: JournalEntry) => void
  onCancel: () => void
  isLoading?: boolean
  error?: string
  /** Pre-select a transaction type when opening the form */
  defaultTransactionType?: TransactionType
}

type TransactionType = 'spent' | 'received' | 'transfer' | 'paid-credit' | ''

export function SimpleTransactionForm({
  transaction,
  accounts,
  onChange,
  onSave,
  onCancel,
  isLoading = false,
  error,
  defaultTransactionType = '',
}: SimpleTransactionFormProps) {
  const [transactionType, setTransactionType] = useState<TransactionType>(defaultTransactionType)
  const [amount, setAmount] = useState<string>('')
  const [fromAccount, setFromAccount] = useState<string>('')
  const [toAccount, setToAccount] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [description, setDescription] = useState<string>(transaction.memo || '')
  const [date, setDate] = useState<string>(
    transaction.date.toISOString().split('T')[0] || ''
  )

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
  const isSelectable = (acc: Account) => !parentAccountIds.has(acc.id)

  // Categorize accounts for easier selection (excluding parent accounts)
  const bankAccounts = useMemo(
    () =>
      accounts.filter(
        (acc) =>
          isSelectable(acc) &&
          acc.type === 'asset' &&
          (acc.name.toLowerCase().includes('checking') ||
            acc.name.toLowerCase().includes('savings') ||
            acc.name.toLowerCase().includes('cash'))
      ),
    [accounts, parentAccountIds]
  )

  const expenseAccounts = useMemo(
    () =>
      accounts.filter(
        (acc) =>
          isSelectable(acc) &&
          (acc.type === 'expense' ||
            acc.type === 'cost-of-goods-sold' ||
            acc.type === 'other-expense')
      ),
    [accounts, parentAccountIds]
  )

  const incomeAccounts = useMemo(
    () =>
      accounts.filter(
        (acc) =>
          isSelectable(acc) &&
          (acc.type === 'income' || acc.type === 'other-income')
      ),
    [accounts, parentAccountIds]
  )

  const creditCardAccounts = useMemo(
    () =>
      accounts.filter(
        (acc) =>
          isSelectable(acc) &&
          acc.type === 'liability' &&
          acc.name.toLowerCase().includes('credit')
      ),
    [accounts, parentAccountIds]
  )

  const handleTransactionTypeChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const type = e.target.value as TransactionType
    setTransactionType(type)
    // Reset dependent fields
    setFromAccount('')
    setToAccount('')
    setCategory('')
  }

  const handleSave = () => {
    // Convert simple form data into double-entry journal entry
    const amountNum = parseFloat(amount) || 0
    if (amountNum === 0) return

    const lines = []

    switch (transactionType) {
      case 'spent':
        // Spent money: DR Expense, CR Bank Account
        if (!category || !fromAccount) return
        lines.push({
          ...useNewLineItem(),
          accountId: category, // Expense account (debit)
          debit: amountNum,
          credit: 0,
          memo: description,
        })
        lines.push({
          ...useNewLineItem(),
          accountId: fromAccount, // Bank account (credit)
          debit: 0,
          credit: amountNum,
          memo: description,
        })
        break

      case 'received':
        // Received money: DR Bank Account, CR Income
        if (!category || !toAccount) return
        lines.push({
          ...useNewLineItem(),
          accountId: toAccount, // Bank account (debit)
          debit: amountNum,
          credit: 0,
          memo: description,
        })
        lines.push({
          ...useNewLineItem(),
          accountId: category, // Income account (credit)
          debit: 0,
          credit: amountNum,
          memo: description,
        })
        break

      case 'transfer':
        // Transfer: DR To Account, CR From Account
        if (!fromAccount || !toAccount) return
        lines.push({
          ...useNewLineItem(),
          accountId: toAccount, // To account (debit)
          debit: amountNum,
          credit: 0,
          memo: description,
        })
        lines.push({
          ...useNewLineItem(),
          accountId: fromAccount, // From account (credit)
          debit: 0,
          credit: amountNum,
          memo: description,
        })
        break

      case 'paid-credit':
        // Paid credit card: DR Credit Card (liability), CR Bank Account
        if (!category || !fromAccount) return
        lines.push({
          ...useNewLineItem(),
          accountId: category, // Credit card account (debit - reduces liability)
          debit: amountNum,
          credit: 0,
          memo: description,
        })
        lines.push({
          ...useNewLineItem(),
          accountId: fromAccount, // Bank account (credit)
          debit: 0,
          credit: amountNum,
          memo: description,
        })
        break

      default:
        return
    }

    // Parse date correctly to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number)
    const parsedDate = new Date(year, month - 1, day, 12, 0, 0) // noon local time

    // Build the transaction with the generated lines - set status to 'posted' so it appears in registers
    const updatedTransaction: JournalEntry = {
      ...transaction,
      status: 'posted',
      date: parsedDate,
      memo: description,
      lines,
    }

    onChange(updatedTransaction)
    // Pass transaction directly to avoid race condition with React state
    onSave(updatedTransaction)
  }

  const canSave = transactionType && amount && parseFloat(amount) > 0

  // Determine which fields to show based on transaction type
  const showTypeSelector = !defaultTransactionType

  return (
    <div className={styles.simpleForm}>
      {/* Error Message */}
      {error && (
        <div className={styles.error}>
          <strong className={styles.errorTitle}>Please fix the following:</strong>
          <ul className={styles.errorList}>
            {error.split(', ').map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Transaction Type (only if not pre-selected) */}
      {showTypeSelector && (
        <div className={styles.fieldGrid} style={{ marginBottom: '1rem' }}>
          <div className={styles.field}>
            <label htmlFor="type" className={styles.label}>
              Transaction Type
            </label>
            <Select
              id="type"
              value={transactionType}
              onChange={handleTransactionTypeChange}
              disabled={isLoading}
              options={[
                { value: '', label: 'Choose one...' },
                { value: 'spent', label: 'I spent money' },
                { value: 'received', label: 'I received money' },
                { value: 'transfer', label: 'Transfer between accounts' },
                { value: 'paid-credit', label: 'Credit card payment' },
              ]}
            />
          </div>
        </div>
      )}

      {/* Spent Money Fields */}
      {transactionType === 'spent' && (
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label htmlFor="date" className={styles.label}>
              Date
            </label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="amount" className={styles.label}>
              Amount
            </label>
            <div className={styles.amountInput}>
              <span className={styles.currencySymbol}>$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="from-account" className={styles.label}>
              Paid From
            </label>
            <Select
              id="from-account"
              value={fromAccount}
              onChange={(e) => setFromAccount(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Select account...' },
                ...bankAccounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                })),
              ]}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="category" className={styles.label}>
              Category
            </label>
            <Select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Select category...' },
                ...expenseAccounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                })),
              ]}
            />
          </div>

          <div className={`${styles.field} ${styles.fieldFullWidth}`}>
            <label htmlFor="description" className={styles.label}>
              Description (optional)
            </label>
            <Input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this for?"
              disabled={isLoading}
            />
          </div>
        </div>
      )}

      {/* Received Money Fields */}
      {transactionType === 'received' && (
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label htmlFor="date" className={styles.label}>
              Date
            </label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="amount" className={styles.label}>
              Amount
            </label>
            <div className={styles.amountInput}>
              <span className={styles.currencySymbol}>$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="to-account" className={styles.label}>
              Deposited To
            </label>
            <Select
              id="to-account"
              value={toAccount}
              onChange={(e) => setToAccount(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Select account...' },
                ...bankAccounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                })),
              ]}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="category" className={styles.label}>
              Income Source
            </label>
            <Select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Select source...' },
                ...incomeAccounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                })),
              ]}
            />
          </div>

          <div className={`${styles.field} ${styles.fieldFullWidth}`}>
            <label htmlFor="description" className={styles.label}>
              Description (optional)
            </label>
            <Input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this for?"
              disabled={isLoading}
            />
          </div>
        </div>
      )}

      {/* Transfer Fields */}
      {transactionType === 'transfer' && (
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label htmlFor="date" className={styles.label}>
              Date
            </label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="amount" className={styles.label}>
              Amount
            </label>
            <div className={styles.amountInput}>
              <span className={styles.currencySymbol}>$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="from-account" className={styles.label}>
              From Account
            </label>
            <Select
              id="from-account"
              value={fromAccount}
              onChange={(e) => setFromAccount(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Select account...' },
                ...bankAccounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                })),
              ]}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="to-account" className={styles.label}>
              To Account
            </label>
            <Select
              id="to-account"
              value={toAccount}
              onChange={(e) => setToAccount(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Select account...' },
                ...bankAccounts
                  .filter((acc) => acc.id !== fromAccount)
                  .map((acc) => ({
                    value: acc.id,
                    label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                  })),
              ]}
            />
          </div>

          <div className={`${styles.field} ${styles.fieldFullWidth}`}>
            <label htmlFor="description" className={styles.label}>
              Description (optional)
            </label>
            <Input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this for?"
              disabled={isLoading}
            />
          </div>
        </div>
      )}

      {/* Pay Credit Card Fields */}
      {transactionType === 'paid-credit' && (
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label htmlFor="date" className={styles.label}>
              Date
            </label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="amount" className={styles.label}>
              Payment Amount
            </label>
            <div className={styles.amountInput}>
              <span className={styles.currencySymbol}>$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="from-account" className={styles.label}>
              Paid From
            </label>
            <Select
              id="from-account"
              value={fromAccount}
              onChange={(e) => setFromAccount(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Select account...' },
                ...bankAccounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                })),
              ]}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="category" className={styles.label}>
              Credit Card
            </label>
            <Select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Select card...' },
                ...creditCardAccounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                })),
              ]}
            />
          </div>

          <div className={`${styles.field} ${styles.fieldFullWidth}`}>
            <label htmlFor="description" className={styles.label}>
              Description (optional)
            </label>
            <Input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Payment reference or notes"
              disabled={isLoading}
            />
          </div>
        </div>
      )}

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
    </div>
  )
}
