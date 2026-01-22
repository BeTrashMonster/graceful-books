/**
 * Simple Transaction Form
 *
 * Beginner-friendly transaction entry that hides double-entry accounting complexity.
 * "So simple a 9th grader could do it" while handling all GAAP behind the scenes.
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
  onSave: () => void
  onCancel: () => void
  isLoading?: boolean
  error?: string
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
}: SimpleTransactionFormProps) {
  const [transactionType, setTransactionType] = useState<TransactionType>('')
  const [amount, setAmount] = useState<string>('')
  const [fromAccount, setFromAccount] = useState<string>('')
  const [toAccount, setToAccount] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [description, setDescription] = useState<string>(transaction.memo || '')
  const [date, setDate] = useState<string>(
    transaction.date.toISOString().split('T')[0] || ''
  )

  // Categorize accounts for easier selection
  const bankAccounts = useMemo(
    () =>
      accounts.filter(
        (acc) =>
          acc.type === 'asset' &&
          (acc.name.toLowerCase().includes('checking') ||
            acc.name.toLowerCase().includes('savings') ||
            acc.name.toLowerCase().includes('cash'))
      ),
    [accounts]
  )

  const expenseAccounts = useMemo(
    () =>
      accounts.filter(
        (acc) =>
          acc.type === 'expense' ||
          acc.type === 'cost-of-goods-sold' ||
          acc.type === 'other-expense'
      ),
    [accounts]
  )

  const incomeAccounts = useMemo(
    () =>
      accounts.filter(
        (acc) => acc.type === 'income' || acc.type === 'other-income'
      ),
    [accounts]
  )

  const creditCardAccounts = useMemo(
    () =>
      accounts.filter(
        (acc) =>
          acc.type === 'liability' &&
          acc.name.toLowerCase().includes('credit')
      ),
    [accounts]
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

    // Update the transaction with the generated lines
    onChange({
      ...transaction,
      date: new Date(date),
      memo: description,
      lines,
    })

    // Trigger save
    onSave()
  }

  const canSave = transactionType && amount && parseFloat(amount) > 0

  return (
    <div className={styles.simpleForm}>
      <div className={styles.header}>
        <h2 className={styles.title}>Add a Transaction</h2>
        <p className={styles.subtitle}>
          We'll handle the accounting magic behind the scenes!
        </p>
      </div>

      {/* Date */}
      <div className={styles.field}>
        <label htmlFor="date" className={styles.label}>
          When did this happen?
        </label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={isLoading}
        />
      </div>

      {/* Transaction Type */}
      <div className={styles.field}>
        <label htmlFor="type" className={styles.label}>
          What happened?
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
            { value: 'transfer', label: 'I moved money between accounts' },
            { value: 'paid-credit', label: 'I paid my credit card' },
          ]}
        />
      </div>

      {/* Amount */}
      {transactionType && (
        <div className={styles.field}>
          <label htmlFor="amount" className={styles.label}>
            How much?
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
      )}

      {/* Spent Money Fields */}
      {transactionType === 'spent' && (
        <>
          <div className={styles.field}>
            <label htmlFor="from-account" className={styles.label}>
              From which account?
            </label>
            <Select
              id="from-account"
              value={fromAccount}
              onChange={(e) => setFromAccount(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Choose account...' },
                ...bankAccounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                })),
              ]}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="category" className={styles.label}>
              What did you spend it on?
            </label>
            <Select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Choose category...' },
                ...expenseAccounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                })),
              ]}
            />
            <p className={styles.helpText}>
              This helps you track where your money goes
            </p>
          </div>
        </>
      )}

      {/* Received Money Fields */}
      {transactionType === 'received' && (
        <>
          <div className={styles.field}>
            <label htmlFor="to-account" className={styles.label}>
              Into which account?
            </label>
            <Select
              id="to-account"
              value={toAccount}
              onChange={(e) => setToAccount(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Choose account...' },
                ...bankAccounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                })),
              ]}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="category" className={styles.label}>
              Where did it come from?
            </label>
            <Select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Choose category...' },
                ...incomeAccounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                })),
              ]}
            />
            <p className={styles.helpText}>
              This helps you track your revenue streams
            </p>
          </div>
        </>
      )}

      {/* Transfer Fields */}
      {transactionType === 'transfer' && (
        <>
          <div className={styles.field}>
            <label htmlFor="from-account" className={styles.label}>
              From which account?
            </label>
            <Select
              id="from-account"
              value={fromAccount}
              onChange={(e) => setFromAccount(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Choose account...' },
                ...bankAccounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                })),
              ]}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="to-account" className={styles.label}>
              To which account?
            </label>
            <Select
              id="to-account"
              value={toAccount}
              onChange={(e) => setToAccount(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Choose account...' },
                ...bankAccounts
                  .filter((acc) => acc.id !== fromAccount)
                  .map((acc) => ({
                    value: acc.id,
                    label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                  })),
              ]}
            />
          </div>
        </>
      )}

      {/* Paid Credit Card Fields */}
      {transactionType === 'paid-credit' && (
        <>
          <div className={styles.field}>
            <label htmlFor="from-account" className={styles.label}>
              From which bank account?
            </label>
            <Select
              id="from-account"
              value={fromAccount}
              onChange={(e) => setFromAccount(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Choose account...' },
                ...bankAccounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                })),
              ]}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="category" className={styles.label}>
              Which credit card did you pay?
            </label>
            <Select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isLoading}
              options={[
                { value: '', label: 'Choose card...' },
                ...creditCardAccounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.accountNumber ? acc.accountNumber + ' - ' : ''}${acc.name}`,
                })),
              ]}
            />
          </div>
        </>
      )}

      {/* Description */}
      {transactionType && (
        <div className={styles.field}>
          <label htmlFor="description" className={styles.label}>
            Any notes? (optional)
          </label>
          <Input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Office supplies for project"
            disabled={isLoading}
          />
          <p className={styles.helpText}>
            This helps you remember what the transaction was for
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className={styles.error}>
          <strong>Oops!</strong> {error}
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
          {isLoading ? 'Saving...' : 'Save Transaction'}
        </button>
      </div>

      {/* Educational Note */}
      <div className={styles.educationalNote}>
        <p>
          <strong>Behind the scenes:</strong> We're recording this using
          double-entry accounting, which keeps your books balanced and
          accurate. You don't need to worry about debits and credits - we've
          got you covered!
        </p>
      </div>
    </div>
  )
}
