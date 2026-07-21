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

import { type FC, useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../core/Button'
import { Input } from '../forms/Input'
import { useTransactions, type TransactionFilter } from '../../hooks/useTransactions'
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
      status: 'posted',
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
  const registerLines = useMemo(() => {
    const lines: RegisterLine[] = []
    let runningBalance = 0

    // Sort transactions by date
    const sorted = [...transactions].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    sorted.forEach((transaction) => {
      // Find lines for any of the accounts we're tracking
      const matchingLines = transaction.lines.filter(l => accountIdsToInclude.has(l.accountId))
      if (matchingLines.length === 0) return

      // Sum up debits and credits from all matching lines
      let totalDebit = 0
      let totalCredit = 0
      const memos: string[] = []

      matchingLines.forEach(line => {
        totalDebit += line.debit
        totalCredit += line.credit
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
      })
    })

    return lines
  }, [transactions, account, accountIdsToInclude])

  const handlePrint = () => {
    window.print()
  }

  const handleRowClick = (transactionId: string) => {
    // TODO: Navigate to transaction detail when that feature is implemented
    // navigate(`/transactions/${transactionId}`)
    console.log('Transaction clicked:', transactionId)
    alert('Transaction detail view coming soon!')
  }

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
      line.debit ? (line.debit / 100).toFixed(2) : '',
      line.credit ? (line.credit / 100).toFixed(2) : '',
      (line.balance / 100).toFixed(2),
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
                  onClick={() => handleRowClick(line.transactionId)}
                  className={styles.clickableRow}
                  style={{ cursor: 'pointer' }}
                >
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
    </div>
  )
}
