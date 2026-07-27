/**
 * TransactionLineItemsTable Component
 *
 * Displays transaction line items in a table format.
 * Shows account name, debit, credit, memo, and reconciliation status.
 */

import { type FC, useMemo } from 'react'
import clsx from 'clsx'
import type { JournalEntryLine, Account } from '../../types'
import { formatCurrency } from '../../utils/formatting'
import styles from './TransactionLineItemsTable.module.css'

/**
 * Balance sheet account types that can be reconciled
 */
const BALANCE_SHEET_TYPES: Account['type'][] = ['asset', 'liability', 'equity']

export interface TransactionLineItemsTableProps {
  /**
   * Line items to display
   */
  lines: JournalEntryLine[]
  /**
   * All accounts for name lookup
   */
  accounts: Account[]
  /**
   * Display mode
   */
  mode?: 'view' | 'edit'
  /**
   * Whether the transaction is reconciled (for determining lock display)
   */
  isReconciled?: boolean
  /**
   * Callback when lines change (edit mode only)
   */
  onChange?: (lines: JournalEntryLine[]) => void
  /**
   * Callback when a line's lock state is toggled
   */
  onToggleLock?: (lineId: string) => void
  /**
   * Additional class name
   */
  className?: string
}

/**
 * Check if an account is a balance sheet account
 */
function isBalanceSheetAccount(account: Account | undefined): boolean {
  return account ? BALANCE_SHEET_TYPES.includes(account.type) : false
}

/**
 * TransactionLineItemsTable displays line items with account info and reconciliation status
 */
export const TransactionLineItemsTable: FC<TransactionLineItemsTableProps> = ({
  lines,
  accounts,
  mode: _mode = 'view',
  isReconciled = false,
  onChange: _onChange,
  onToggleLock,
  className,
}) => {
  // Create account lookup map
  const accountMap = useMemo(() => {
    return new Map(accounts.map(a => [a.id, a]))
  }, [accounts])

  // Get account by ID
  const getAccount = (accountId: string): Account | undefined => {
    return accountMap.get(accountId)
  }

  // Get account display name
  const getAccountName = (accountId: string): string => {
    const account = getAccount(accountId)
    if (!account) return 'Unknown Account'
    return account.accountNumber
      ? `${account.accountNumber} - ${account.name}`
      : account.name
  }

  // Check if a line should show lock icon
  const shouldShowLock = (line: JournalEntryLine): boolean => {
    if (!line.isLocked) return false
    const account = getAccount(line.accountId)
    return isBalanceSheetAccount(account)
  }

  // Calculate totals
  const totals = useMemo(() => {
    return lines.reduce(
      (acc, line) => ({
        debit: acc.debit + (line.debit || 0),
        credit: acc.credit + (line.credit || 0),
      }),
      { debit: 0, credit: 0 }
    )
  }, [lines])

  // Check if balanced
  const isBalanced = totals.debit === totals.credit

  return (
    <div className={clsx(styles.tableWrapper, className)}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.accountColumn}>Account</th>
            <th className={styles.amountColumn}>Debit</th>
            <th className={styles.amountColumn}>Credit</th>
            <th className={styles.memoColumn}>Memo</th>
            {(isReconciled || lines.some(l => l.isLocked)) && (
              <th className={styles.lockColumn} aria-label="Reconciliation status">
                <span className={styles.srOnly}>Lock Status</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const account = getAccount(line.accountId)
            const showLock = shouldShowLock(line)
            const isBalanceSheet = isBalanceSheetAccount(account)

            return (
              <tr key={line.id} className={styles.row}>
                <td className={styles.accountColumn}>
                  <span className={styles.accountName}>
                    {getAccountName(line.accountId)}
                  </span>
                  {account && (
                    <span className={styles.accountType}>
                      {account.type}
                    </span>
                  )}
                </td>
                <td className={styles.amountColumn}>
                  {line.debit > 0 ? formatCurrency(line.debit) : ''}
                </td>
                <td className={styles.amountColumn}>
                  {line.credit > 0 ? formatCurrency(line.credit) : ''}
                </td>
                <td className={styles.memoColumn}>
                  {line.memo || ''}
                </td>
                {(isReconciled || lines.some(l => l.isLocked)) && (
                  <td className={styles.lockColumn}>
                    {showLock && (
                      <button
                        type="button"
                        className={styles.lockButton}
                        onClick={() => onToggleLock?.(line.id)}
                        title="This line is locked for reconciliation"
                        aria-label={`${isBalanceSheet ? 'Balance sheet account' : 'Account'} is locked for reconciliation`}
                      >
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
                      </button>
                    )}
                    {!showLock && line.isLocked && !isBalanceSheet && (
                      <span className={styles.unlockedIndicator} title="Non-balance sheet account (editable)">
                        -
                      </span>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className={styles.totalRow}>
            <td className={styles.accountColumn}>
              <strong>Total</strong>
              {!isBalanced && (
                <span className={styles.unbalancedWarning}>
                  (Unbalanced)
                </span>
              )}
            </td>
            <td className={styles.amountColumn}>
              <strong>{formatCurrency(totals.debit)}</strong>
            </td>
            <td className={styles.amountColumn}>
              <strong>{formatCurrency(totals.credit)}</strong>
            </td>
            <td className={styles.memoColumn}></td>
            {(isReconciled || lines.some(l => l.isLocked)) && (
              <td className={styles.lockColumn}></td>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
