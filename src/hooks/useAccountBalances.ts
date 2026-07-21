/**
 * useAccountBalances Hook
 *
 * Calculates account balances for a given date range.
 * Uses the same calculation logic as P&L and Balance Sheet reports.
 */

import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Decimal from 'decimal.js'
import { db } from '../store/database'
import { useAuth } from '../contexts/AuthContext'
import type { Account, AccountType } from '../types'
import type { DateRange } from '../utils/dateRanges'

/**
 * Check if account is an Income Statement account
 */
function isIncomeStatementAccount(accountType: AccountType): boolean {
  return (
    accountType === 'income' ||
    accountType === 'other-income' ||
    accountType === 'expense' ||
    accountType === 'cost-of-goods-sold' ||
    accountType === 'other-expense'
  )
}

/**
 * Check if account is the Retained Earnings account
 * Retained Earnings is auto-generated with name "Retained Earnings" and account number "3900"
 */
function isRetainedEarningsAccount(account: Account): boolean {
  return (
    account.type === 'equity' &&
    (account.name === 'Retained Earnings' || account.accountNumber === '3900')
  )
}

/**
 * Hook to calculate account balances for a date range
 */
export function useAccountBalances(
  accounts: Account[],
  dateRange: DateRange
): Map<string, number> {
  const { companyId } = useAuth()

  // Get ALL posted/reconciled transactions for the company
  const transactions = useLiveQuery(
    async () => {
      if (!companyId) return []

      const txns = await db.transactions
        .where('companyId')
        .equals(companyId)
        .toArray()

      // Filter to posted/reconciled and not deleted
      return txns.filter(txn =>
        !txn.deletedAt &&
        (txn.status === 'posted' || txn.status === 'reconciled')
      )
    },
    [companyId],
    []
  )

  // Calculate balances
  const balances = useMemo(() => {
    const balanceMap = new Map<string, number>()

    // Debug: log transaction count
    console.log('[useAccountBalances] Transactions found:', transactions?.length || 0)
    console.log('[useAccountBalances] Date range:', dateRange.startDate, 'to', dateRange.endDate)

    // Log transaction details
    if (transactions && transactions.length > 0) {
      transactions.forEach((txn, i) => {
        console.log(`[useAccountBalances] Txn ${i}:`, {
          date: txn.date,
          status: txn.status,
          lines: txn.lines.map(l => ({ accountId: l.accountId, debit: l.debit, credit: l.credit }))
        })
      })
    }

    // Log income statement accounts we're looking for
    const incomeStatementAccounts = accounts.filter(a => isIncomeStatementAccount(a.type))
    console.log('[useAccountBalances] Income Statement accounts:', incomeStatementAccounts.map(a => ({ id: a.id, name: a.name, type: a.type })))

    // First, calculate Retained Earnings if that account exists
    // Retained Earnings = Cumulative Net Income from inception through end date
    // Net Income = Total Revenue - Total Expenses
    const retainedEarningsAccount = accounts.find(isRetainedEarningsAccount)
    let retainedEarningsBalance = new Decimal(0)

    if (retainedEarningsAccount && transactions && transactions.length > 0) {
      // Calculate cumulative net income from ALL transactions up to end date
      const endTime = dateRange.endDate.getTime()

      for (const transaction of transactions) {
        const txnDate = transaction.date instanceof Date
          ? transaction.date
          : new Date(transaction.date)
        const txnTime = txnDate.getTime()

        // Include all transactions from beginning of time up to end date
        if (txnTime <= endTime) {
          for (const line of transaction.lines) {
            // Find the account for this line
            const lineAccount = accounts.find(a => a.id === line.accountId)
            if (!lineAccount) continue

            const debit = new Decimal(line.debit || 0)
            const credit = new Decimal(line.credit || 0)

            // Revenue increases Retained Earnings (credits are positive for income)
            if (lineAccount.type === 'income' || lineAccount.type === 'other-income') {
              retainedEarningsBalance = retainedEarningsBalance.plus(credit).minus(debit)
            }
            // Expenses decrease Retained Earnings (debits are positive for expenses)
            else if (
              lineAccount.type === 'expense' ||
              lineAccount.type === 'cost-of-goods-sold' ||
              lineAccount.type === 'other-expense'
            ) {
              retainedEarningsBalance = retainedEarningsBalance.minus(debit).plus(credit)
            }
          }
        }
      }
    }

    accounts.forEach((account) => {
      if (isRetainedEarningsAccount(account)) {
        // Retained Earnings: Use the calculated cumulative net income
        // Transaction amounts are stored in cents, convert to dollars
        balanceMap.set(account.id, retainedEarningsBalance.dividedBy(100).toNumber())
      } else if (isIncomeStatementAccount(account.type)) {
        // Income Statement accounts: Calculate from transactions in the period
        let balance = new Decimal(0)

        if (transactions && transactions.length > 0) {
          for (const transaction of transactions) {
            // Handle date comparison - transaction.date could be Date or string
            const txnDate = transaction.date instanceof Date
              ? transaction.date
              : new Date(transaction.date)

            // Check if transaction is within the date range
            const startTime = dateRange.startDate.getTime()
            const endTime = dateRange.endDate.getTime()
            const txnTime = txnDate.getTime()

            if (txnTime >= startTime && txnTime <= endTime) {
              for (const line of transaction.lines) {
                if (line.accountId === account.id) {
                  const debit = new Decimal(line.debit || 0)
                  const credit = new Decimal(line.credit || 0)

                  // For Income: credits increase (positive)
                  // For Expenses/COGS: debits increase (positive)
                  if (account.type === 'income' || account.type === 'other-income') {
                    balance = balance.plus(credit).minus(debit)
                  } else {
                    // expense, cost-of-goods-sold, other-expense
                    balance = balance.plus(debit).minus(credit)
                  }
                }
              }
            }
          }
        }

        // Transaction amounts are stored in cents, convert to dollars for display
        balanceMap.set(account.id, balance.dividedBy(100).toNumber())
      } else {
        // Balance Sheet accounts: Use existing account.balance
        balanceMap.set(account.id, account.balance)
      }
    })

    return balanceMap
  }, [accounts, transactions, dateRange.startDate, dateRange.endDate])

  return balances
}
