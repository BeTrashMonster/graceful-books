/**
 * TransactionDetailEdit Component
 *
 * Edit form for transaction details.
 * Supports editing date, reference, memo, and line items.
 * Includes reconciliation warnings for balance sheet accounts.
 */

import { type FC, useState, useMemo, useCallback } from 'react'
import type { JournalEntry, JournalEntryLine, Account } from '../../types'
import { formatCurrency } from '../../utils/formatting'
import { Button } from '../core/Button'
import { Input } from '../forms/Input'
import { Select } from '../forms/Select'
import styles from './TransactionDetailEdit.module.css'

/**
 * Balance sheet account types that trigger warnings when reconciled
 */
const BALANCE_SHEET_TYPES: Account['type'][] = ['asset', 'liability', 'equity']

export interface TransactionDetailEditProps {
  /**
   * Transaction to edit
   */
  transaction: JournalEntry
  /**
   * All accounts for selection
   */
  accounts: Account[]
  /**
   * Called when save is requested
   */
  onSave: (updates: Partial<JournalEntry>) => Promise<void>
  /**
   * Called when cancel is requested
   */
  onCancel: () => void
  /**
   * Whether save is in progress
   */
  isLoading?: boolean
  /**
   * Error message to display
   */
  error?: string
}

/**
 * Check if an account is a balance sheet account
 */
function isBalanceSheetAccount(account: Account | undefined): boolean {
  return account ? BALANCE_SHEET_TYPES.includes(account.type) : false
}

export const TransactionDetailEdit: FC<TransactionDetailEditProps> = ({
  transaction,
  accounts,
  onSave,
  onCancel,
  isLoading = false,
  error,
}) => {
  // Edit state
  const [date, setDate] = useState(() => {
    const d = new Date(transaction.date)
    return d.toISOString().split('T')[0]
  })
  const [reference, setReference] = useState(transaction.reference || '')
  const [memo, setMemo] = useState(transaction.memo || '')
  const [lines, setLines] = useState<JournalEntryLine[]>(transaction.lines)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Account lookup
  const accountMap = useMemo(() => {
    return new Map(accounts.map(a => [a.id, a]))
  }, [accounts])

  const getAccount = (accountId: string): Account | undefined => {
    return accountMap.get(accountId)
  }

  // Account options for select
  const accountOptions = useMemo(() => {
    return accounts
      .filter(a => a.isActive)
      .map(a => ({
        value: a.id,
        label: a.accountNumber ? `${a.accountNumber} - ${a.name}` : a.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [accounts])

  // Calculate balance
  const balance = useMemo(() => {
    const totals = lines.reduce(
      (acc, line) => ({
        debit: acc.debit + (line.debit || 0),
        credit: acc.credit + (line.credit || 0),
      }),
      { debit: 0, credit: 0 }
    )
    return {
      ...totals,
      isBalanced: totals.debit === totals.credit,
      difference: Math.abs(totals.debit - totals.credit),
    }
  }, [lines])

  // Handle account change with reconciliation warning
  const handleAccountChange = useCallback((lineId: string, newAccountId: string) => {
    const line = lines.find(l => l.id === lineId)
    if (!line) return

    const oldAccount = getAccount(line.accountId)

    // Check if this is a locked balance sheet account
    if (line.isLocked && isBalanceSheetAccount(oldAccount)) {
      const confirmed = window.confirm(
        'This account was part of a completed reconciliation. ' +
        'Changing it may affect your reconciliation records. Continue?'
      )
      if (!confirmed) return
    }

    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, accountId: newAccountId } : l
    ))
  }, [lines, getAccount])

  // Handle debit change
  const handleDebitChange = useCallback((lineId: string, value: string) => {
    const numValue = Math.round(parseFloat(value || '0') * 100)
    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, debit: numValue, credit: numValue > 0 ? 0 : l.credit } : l
    ))
  }, [])

  // Handle credit change
  const handleCreditChange = useCallback((lineId: string, value: string) => {
    const numValue = Math.round(parseFloat(value || '0') * 100)
    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, credit: numValue, debit: numValue > 0 ? 0 : l.debit } : l
    ))
  }, [])

  // Handle line memo change
  const handleLineMemoChange = useCallback((lineId: string, value: string) => {
    setLines(prev => prev.map(l =>
      l.id === lineId ? { ...l, memo: value } : l
    ))
  }, [])

  // Handle save
  const handleSave = useCallback(async () => {
    setValidationError(null)

    // Validate balance
    if (!balance.isBalanced) {
      setValidationError(`Transaction is not balanced. Difference: ${formatCurrency(balance.difference)}`)
      return
    }

    // Validate date
    if (!date) {
      setValidationError('Date is required')
      return
    }

    // Validate lines
    if (lines.length < 2) {
      setValidationError('Transaction must have at least two line items')
      return
    }

    const hasEmptyAccount = lines.some(l => !l.accountId)
    if (hasEmptyAccount) {
      setValidationError('All lines must have an account selected')
      return
    }

    try {
      await onSave({
        date: new Date(date),
        reference: reference || undefined,
        memo: memo || undefined,
        lines,
      })
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to save')
    }
  }, [date, reference, memo, lines, balance, onSave])

  return (
    <div className={styles.container}>
      {/* Error display */}
      {(error || validationError) && (
        <div className={styles.error}>
          {error || validationError}
        </div>
      )}

      {/* Basic fields */}
      <div className={styles.fields}>
        <Input
          type="date"
          label="Date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        <Input
          type="text"
          label="Reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Check #, Invoice #, etc."
        />

        <Input
          type="text"
          label="Memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Description of transaction"
        />
      </div>

      {/* Line items */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Line Items</h3>

        <div className={styles.linesTable}>
          <div className={styles.linesHeader}>
            <span className={styles.accountHeader}>Account</span>
            <span className={styles.amountHeader}>Debit</span>
            <span className={styles.amountHeader}>Credit</span>
            <span className={styles.memoHeader}>Memo</span>
            <span className={styles.lockHeader}></span>
          </div>

          {lines.map((line) => {
            const account = getAccount(line.accountId)
            const isLocked = line.isLocked && isBalanceSheetAccount(account)

            return (
              <div key={line.id} className={styles.lineRow}>
                <div className={styles.accountCell}>
                  <Select
                    value={line.accountId}
                    onChange={(e) => handleAccountChange(line.id, e.target.value)}
                    options={accountOptions}
                    placeholder="Select account..."
                  />
                </div>
                <div className={styles.amountCell}>
                  <Input
                    type="number"
                    value={line.debit > 0 ? (line.debit / 100).toFixed(2) : ''}
                    onChange={(e) => handleDebitChange(line.id, e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className={styles.amountCell}>
                  <Input
                    type="number"
                    value={line.credit > 0 ? (line.credit / 100).toFixed(2) : ''}
                    onChange={(e) => handleCreditChange(line.id, e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className={styles.memoCell}>
                  <Input
                    type="text"
                    value={line.memo || ''}
                    onChange={(e) => handleLineMemoChange(line.id, e.target.value)}
                    placeholder="Line memo..."
                  />
                </div>
                <div className={styles.lockCell}>
                  {isLocked && (
                    <span className={styles.lockIndicator} title="Reconciled account">
                      <svg
                        className={styles.lockIcon}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Balance indicator */}
        <div className={`${styles.balanceIndicator} ${balance.isBalanced ? styles.balanced : styles.unbalanced}`}>
          <span>Debits: {formatCurrency(balance.debit)}</span>
          <span>Credits: {formatCurrency(balance.credit)}</span>
          {!balance.isBalanced && (
            <span className={styles.difference}>
              Difference: {formatCurrency(balance.difference)}
            </span>
          )}
          {balance.isBalanced && (
            <span className={styles.balancedText}>Balanced</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isLoading || !balance.isBalanced}
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
