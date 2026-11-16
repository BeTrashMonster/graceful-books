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
import { useVendors } from '../../hooks/useVendors'
import { useFloatingCards } from '../../contexts/FloatingCardsContext'
import type { Account, TransactionType } from '../../types'
import { formatDate } from '../../utils/formatting'
import { formatMoney, fromCents } from '../../utils/money'
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
  transactionType?: TransactionType
  reference?: string
  memo?: string
  vendorName?: string
  debit: number
  credit: number
  balance: number
  isReconciled?: boolean
  isVoided?: boolean
}

/**
 * Get user-friendly label for transaction type
 */
function getTransactionTypeLabel(type?: TransactionType): string {
  if (!type) return 'Journal Entry'

  const labels: Record<TransactionType, string> = {
    'expense': 'Expense',
    'check': 'Check',
    'bill': 'Bill',
    'bill-payment': 'Bill Payment',
    'income': 'Income',
    'deposit': 'Deposit',
    'invoice': 'Invoice',
    'invoice-payment': 'Invoice Payment',
    'transfer': 'Transfer',
    'credit-card-payment': 'CC Payment',
    'liability-payment': 'Liability Payment',
    'journal-entry': 'Journal Entry',
    'opening-balance': 'Opening Balance',
  }

  return labels[type] || type
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
  const { vendors } = useVendors({ companyId })
  const { toggleCard, isCardOpen, subscribeToChanges, isStarred, toggleStar } = useFloatingCards()

  // Build vendor lookup map
  const vendorMap = useMemo(() => {
    return new Map(vendors.map(v => [v.id, v.name]))
  }, [vendors])

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
  // Include posted, reconciled, and voided transactions (not drafts)
  const registerLines = useMemo(() => {
    const lines: RegisterLine[] = []
    let runningBalance = 0

    // Filter to include posted, reconciled, and voided transactions
    const filtered = transactions.filter(t =>
      t.status === 'posted' || t.status === 'reconciled' || t.status === 'void'
    )

    // Sort transactions by date
    const sorted = [...filtered].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    sorted.forEach((transaction) => {
      // Find lines for any of the accounts we're tracking
      const matchingLines = transaction.lines.filter(l => accountIdsToInclude.has(l.accountId))
      if (matchingLines.length === 0) return

      // All amounts are stored in CENTS (integers)
      // Sum up debits and credits from all matching lines
      let totalDebit = 0
      let totalCredit = 0
      const memos: string[] = []

      matchingLines.forEach(line => {
        totalDebit += line.debit
        totalCredit += line.credit
        if (line.memo) memos.push(line.memo)
      })

      const isVoided = transaction.status === 'void'

      // Only update running balance for non-voided transactions
      // Voided transactions don't affect the balance
      if (!isVoided) {
        // Update running balance based on account type
        // Assets and Expenses increase with debits
        // Liabilities, Equity, and Income increase with credits
        if (['asset', 'expense', 'cost-of-goods-sold', 'other-expense'].includes(account.type)) {
          runningBalance += totalDebit - totalCredit
        } else {
          runningBalance += totalCredit - totalDebit
        }
      }

      lines.push({
        date: new Date(transaction.date),
        transactionId: transaction.id,
        transactionType: transaction.transactionType,
        reference: transaction.reference,
        memo: memos.length > 0 ? memos.join('; ') : transaction.memo,
        vendorName: transaction.vendorId ? vendorMap.get(transaction.vendorId) : undefined,
        debit: totalDebit,
        credit: totalCredit,
        balance: runningBalance,
        isReconciled: transaction.status === 'reconciled',
        isVoided,
      })
    })

    return lines
  }, [transactions, account, accountIdsToInclude, vendorMap])

  const handlePrint = () => {
    window.print()
  }

  const handleRowClick = useCallback((transactionId: string, balance: number) => {
    toggleCard({
      transactionId,
      companyId,
      runningBalance: balance,
    })
  }, [toggleCard, companyId])

  // Subscribe to transaction changes from floating cards
  useEffect(() => {
    const unsubscribe = subscribeToChanges(() => {
      // Reload transactions after any card update/void/delete
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
    })
    return unsubscribe
  }, [subscribeToChanges, companyId, account.id, fromDate, toDate, loadTransactions, isParentAccount])

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
    const headers = ['Date', 'Type', 'Vendor', 'Reference', 'Memo', debitLabel, creditLabel, 'Balance']
    const rows = registerLines.map(line => [
      formatDate(line.date),
      getTransactionTypeLabel(line.transactionType),
      line.vendorName || '',
      line.reference || '',
      line.memo || '',
      line.debit ? fromCents(line.debit).toFixed(2) : '',
      line.credit ? fromCents(line.credit).toFixed(2) : '',
      fromCents(line.balance).toFixed(2),
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
                <th>Type</th>
                <th>Vendor</th>
                <th>Reference</th>
                <th>Memo</th>
                <th className={styles.amountColumn}>{debitLabel}</th>
                <th className={styles.amountColumn}>{creditLabel}</th>
                <th className={styles.amountColumn}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {registerLines.map((line, index) => {
                const isOpen = isCardOpen(line.transactionId)
                const starred = isStarred(line.transactionId)
                return (
                <tr
                  key={`${line.transactionId}-${index}`}
                  onClick={() => handleRowClick(line.transactionId, line.balance)}
                  className={styles.clickableRow}
                  style={{
                    cursor: 'pointer',
                    ...(starred && !isOpen && {
                      backgroundColor: '#fef9e7',
                      boxShadow: 'inset 3px 0 0 #d97706',
                    }),
                    ...(isOpen && {
                      backgroundColor: '#ecfdf5',
                      boxShadow: 'inset 3px 0 0 #0f766e',
                    }),
                    ...(line.isVoided && {
                      opacity: 0.6,
                      textDecoration: 'line-through',
                      backgroundColor: isOpen ? '#ecfdf5' : starred ? '#fef9e7' : '#f9fafb',
                    }),
                  }}
                >
                  <td className={styles.statusColumn}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleStar(line.transactionId)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.125rem',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: starred ? '#d97706' : '#d1d5db',
                          transition: 'color 0.15s, transform 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!starred) e.currentTarget.style.color = '#f59e0b'
                          e.currentTarget.style.transform = 'scale(1.2)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = starred ? '#d97706' : '#d1d5db'
                          e.currentTarget.style.transform = 'scale(1)'
                        }}
                        title={starred ? 'Remove highlight' : 'Highlight this transaction'}
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                      {line.isVoided && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            color: '#991b1b',
                            backgroundColor: '#fee2e2',
                            padding: '0.125rem 0.375rem',
                            borderRadius: '0.25rem',
                            textDecoration: 'none',
                          }}
                          title="Voided"
                        >
                          VOID
                        </span>
                      )}
                      {line.isReconciled && !line.isVoided && (
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
                    </div>
                  </td>
                  <td>{formatDate(line.date)}</td>
                  <td className={styles.typeColumn}>{getTransactionTypeLabel(line.transactionType)}</td>
                  <td>{line.vendorName || '—'}</td>
                  <td>{line.reference || '—'}</td>
                  <td>{line.memo || '—'}</td>
                  <td className={styles.amountColumn}>
                    {line.debit ? formatMoney(line.debit) : '—'}
                  </td>
                  <td className={styles.amountColumn}>
                    {line.credit ? formatMoney(line.credit) : '—'}
                  </td>
                  <td className={`${styles.amountColumn} ${styles.balanceCell}`}>
                    {formatMoney(line.balance)}
                  </td>
                </tr>
              )})}
            </tbody>
            <tfoot>
              <tr className={styles.totalRow}>
                <td className={styles.statusColumn}></td>
                <td colSpan={5}>Current Balance</td>
                <td className={styles.amountColumn}>
                  {formatMoney(
                    registerLines.filter(l => !l.isVoided).reduce((sum, line) => sum + line.debit, 0)
                  )}
                </td>
                <td className={styles.amountColumn}>
                  {formatMoney(
                    registerLines.filter(l => !l.isVoided).reduce((sum, line) => sum + line.credit, 0)
                  )}
                </td>
                <td className={`${styles.amountColumn} ${styles.balanceCell}`}>
                  {formatMoney(registerLines[registerLines.length - 1]?.balance || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

    </div>
  )
}
