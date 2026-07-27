/**
 * Account Register Component
 *
 * Shows all transactions for a specific account with running balance.
 * Features:
 * - Transaction list filtered by account
 * - Running balance calculation
 * - PDF export (print-friendly)
 * - CSV export
 * - Date range filtering
 */

import { type FC, useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../core/Button'
import { Input } from '../forms/Input'
import { useTransactions, type TransactionFilter } from '../../hooks/useTransactions'
import { TransactionDetailDrawer } from '../transactions/TransactionDetailDrawer'
import type { Account } from '../../types'
import { formatCurrency, formatDate } from '../../utils/formatting'
import styles from './AccountRegister.module.css'

export interface AccountRegisterProps {
  /**
   * Account to show register for
   */
  account: Account

  /**
   * Company ID
   */
  companyId: string

  /**
   * Child accounts for roll-up view (parent accounts only)
   */
  childAccounts?: Account[]
}

interface RegisterLine {
  date: Date
  transactionId: string
  reference?: string
  memo?: string
  debit: number
  credit: number
  balance: number
  isReconciled?: boolean
}

/**
 * Account Register Component
 */
export const AccountRegister: FC<AccountRegisterProps> = ({
  account,
  companyId,
  childAccounts = [],
}) => {
  const navigate = useNavigate()
  const { transactions, isLoading, loadTransactions } = useTransactions()

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [selectedRunningBalance, setSelectedRunningBalance] = useState<number | undefined>(undefined)

  // Determine if this is a parent account (has children)
  const isParentAccount = childAccounts.length > 0

  // Build set of account IDs to include in register
  const accountIdsToInclude = useMemo(() => {
    if (isParentAccount) {
      // For parent accounts, include all child account IDs
      return new Set(childAccounts.map(child => child.id))
    }
    // For regular accounts, just this account
    return new Set([account.id])
  }, [account.id, childAccounts, isParentAccount])

  // Load transactions for this account (or all accounts for roll-up)
  useEffect(() => {
    const filter: TransactionFilter = {
      companyId,
      // Don't filter by status here - we'll filter in the component to include both posted and reconciled
    }

    // For parent accounts, don't filter by accountId - we'll filter in the component
    if (!isParentAccount) {
      filter.accountId = account.id
    }

    if (fromDate) {
      filter.fromDate = new Date(fromDate)
    }

    if (toDate) {
      filter.toDate = new Date(toDate)
    }

    loadTransactions(filter)
  }, [companyId, account.id, fromDate, toDate, loadTransactions, isParentAccount])

  // Build register lines with running balance
  // Only include posted and reconciled transactions (not draft or void)
  const registerLines = useMemo(() => {
    const lines: RegisterLine[] = []
    let runningBalance = 0

    // Filter to only include posted and reconciled transactions
    const filtered = transactions.filter(t => t.status === 'posted' || t.status === 'reconciled')

    // Sort transactions by date
    const sorted = [...filtered].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    sorted.forEach((transaction) => {
      // Find lines for any of the accounts we're tracking
      const matchingLines = transaction.lines.filter(l => accountIdsToInclude.has(l.accountId))
      if (matchingLines.length === 0) return

      // Opening Balance transactions are stored in cents, others in dollars
      const isOpeningBalance = transaction.reference === 'OPENING'
      const divisor = isOpeningBalance ? 100 : 1

      // Sum up debits and credits from all matching lines
      let totalDebit = 0
      let totalCredit = 0
      const memos: string[] = []

      matchingLines.forEach(line => {
        totalDebit += line.debit / divisor
        totalCredit += line.credit / divisor
        if (line.memo) memos.push(line.memo)
      })

      // Update running balance based on account type
      // Assets and Expenses increase with debits
      // Liabilities, Equity, and Income increase with credits
      if (['asset', 'expense', 'cost-of-goods-sold', 'other-expense'].includes(account.type)) {
        runningBalance += totalDebit - totalCredit
      } else {
        runningBalance += totalCredit - totalDebit
      }

      lines.push({
        date: new Date(transaction.date),
        transactionId: transaction.id,
        reference: transaction.reference,
        memo: memos.length > 0 ? memos.join('; ') : transaction.memo,
        debit: totalDebit,
        credit: totalCredit,
        balance: runningBalance,
        isReconciled: transaction.status === 'reconciled',
      })
    })

    return lines
  }, [transactions, account, accountIdsToInclude])

  const handlePrint = () => {
    window.print()
  }

  const handleRowClick = useCallback((transactionId: string, balance: number) => {
    setSelectedTransactionId(transactionId)
    setSelectedRunningBalance(balance)
  }, [])

  const handleDrawerClose = useCallback(() => {
    setSelectedTransactionId(null)
    setSelectedRunningBalance(undefined)
  }, [])

  const handleTransactionChanged = useCallback(() => {
    // Reload transactions after update/void/delete
    const filter: TransactionFilter = { companyId }
    if (!isParentAccount) {
      filter.accountId = account.id
    }
    if (fromDate) {
      filter.fromDate = new Date(fromDate)
    }
    if (toDate) {
      filter.toDate = new Date(toDate)
    }
    loadTransactions(filter)
    handleDrawerClose()
  }, [companyId, account.id, fromDate, toDate, loadTransactions, isParentAccount, handleDrawerClose])

  // Determine column labels based on GAAP rules
  const getColumnLabels = () => {
    // Normal debit balance accounts: Assets and Expenses
    const isDebitNormal = [
      'asset',
      'expense',
      'cost-of-goods-sold',
      'other-expense',
    ].includes(account.type)

    if (isDebitNormal) {
      return {
        debitLabel: 'Increase',
        creditLabel: 'Decrease',
      }
    }

    // Normal credit balance accounts: Liabilities, Equity, and Revenue
    return {
      debitLabel: 'Decrease',
      creditLabel: 'Increase',
    }
  }

  const { debitLabel, creditLabel } = getColumnLabels()

  const handleExportCSV = () => {
    const headers = ['Date', 'Reference', 'Memo', debitLabel, creditLabel, 'Balance']
    const rows = registerLines.map(line => [
      formatDate(line.date),
      line.reference || '',
      line.memo || '',
      line.debit ? line.debit.toFixed(2) : '',
      line.credit ? line.credit.toFixed(2) : '',
      line.balance.toFixed(2),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${account.accountNumber || account.name.replace(/\s+/g, '_')}_register.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.registerPage}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/chart-of-accounts')}
            className={styles.backButton}
          >
            ← Back to Chart of Accounts
          </Button>
          <div className={styles.accountInfo}>
            <h1 className={styles.accountName}>
              {account.accountNumber && (
                <span className={styles.accountNumber}>{account.accountNumber}</span>
              )}
              {account.name}
              {isParentAccount && (
                <span className={styles.rollupBadge}>Roll-up View</span>
              )}
            </h1>
            <p className={styles.accountType}>{account.type}</p>
            {isParentAccount && (
              <p className={styles.childAccountsList}>
                Includes: {childAccounts.map(c => c.name).join(', ')}
              </p>
            )}
            {account.description && (
              <p className={styles.accountDescription}>{account.description}</p>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            variant="outline"
            onClick={handlePrint}
            className="print-hidden"
          >
            📄 Export PDF
          </Button>
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="print-hidden"
          >
            📊 Export CSV
          </Button>
        </div>
      </div>

      <div className={`${styles.filters} print-hidden`}>
        <Input
          type="date"
          label="From Date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <Input
          type="date"
          label="To Date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        {(fromDate || toDate) && (
          <Button
            variant="ghost"
            onClick={() => {
              setFromDate('')
              setToDate('')
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className={styles.loading}>Loading transactions...</div>
      ) : registerLines.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No transactions found for this account</p>
          {(fromDate || toDate) && <p>Try adjusting your date filters</p>}
        </div>
      ) : (
        <div className={styles.registerTable}>
          <table>
            <thead>
              <tr>
                <th className={styles.statusColumn}></th>
                <th>Date</th>
                <th>Reference</th>
                <th>Memo</th>
                <th className={styles.amountColumn}>{debitLabel}</th>
                <th className={styles.amountColumn}>{creditLabel}</th>
                <th className={styles.amountColumn}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {registerLines.map((line, index) => (
                <tr
                  key={`${line.transactionId}-${index}`}
                  onClick={() => handleRowClick(line.transactionId, line.balance)}
                  className={styles.clickableRow}
                  style={{ cursor: 'pointer' }}
                >
                  <td className={styles.statusColumn}>
                    {line.isReconciled && (
                      <span className={styles.reconciledIndicator} title="Reconciled">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-label="Reconciled"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    )}
                  </td>
                  <td>{formatDate(line.date)}</td>
                  <td>{line.reference || '—'}</td>
                  <td>{line.memo || '—'}</td>
                  <td className={styles.amountColumn}>
                    {line.debit ? formatCurrency(line.debit) : '—'}
                  </td>
                  <td className={styles.amountColumn}>
                    {line.credit ? formatCurrency(line.credit) : '—'}
                  </td>
                  <td className={`${styles.amountColumn} ${styles.balanceCell}`}>
                    {formatCurrency(line.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.totalRow}>
                <td className={styles.statusColumn}></td>
                <td colSpan={3}>Current Balance</td>
                <td className={styles.amountColumn}>
                  {formatCurrency(
                    registerLines.reduce((sum, line) => sum + line.debit, 0)
                  )}
                </td>
                <td className={styles.amountColumn}>
                  {formatCurrency(
                    registerLines.reduce((sum, line) => sum + line.credit, 0)
                  )}
                </td>
                <td className={`${styles.amountColumn} ${styles.balanceCell}`}>
                  {formatCurrency(registerLines[registerLines.length - 1]?.balance || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Transaction Detail Drawer */}
      <TransactionDetailDrawer
        isOpen={!!selectedTransactionId}
        onClose={handleDrawerClose}
        transactionId={selectedTransactionId || ''}
        companyId={companyId}
        runningBalance={selectedRunningBalance}
        onTransactionUpdated={handleTransactionChanged}
        onTransactionVoided={handleTransactionChanged}
        onTransactionDeleted={handleTransactionChanged}
      />
    </div>
  )
}
