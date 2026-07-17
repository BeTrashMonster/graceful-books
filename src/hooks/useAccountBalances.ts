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

    accounts.forEach((account) => {
      if (isIncomeStatementAccount(account.type)) {
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

        balanceMap.set(account.id, balance.toNumber())
      } else {
        // Balance Sheet accounts: Use existing account.balance
        balanceMap.set(account.id, account.balance)
      }
    })

    return balanceMap
  }, [accounts, transactions, dateRange.startDate, dateRange.endDate])

  return balances
}
