/**
 * useCashPosition Hook
 *
 * Fetches cash position data including current balance, monthly expenses, and trend.
 */

import { useState, useEffect } from 'react';
import type { CashPositionData } from '../components/dashboard/CashPositionWidget';
import { db } from '../db/database';
import { getStartOfMonth, getEndOfMonth } from '../utils/metricsCalculation';

export function useCashPosition(companyId: string): {
  data: CashPositionData | null;
  isLoading: boolean;
  error: Error | null;
} {
  const [data, setData] = useState<CashPositionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchCashPosition() {
      try {
        setIsLoading(true);
        setError(null);

        // Get all bank accounts (ASSET accounts with subType BANK)
        const accounts = await db.accounts
          .where('company_id')
          .equals(companyId)
          .and(account => account.type === 'ASSET' && account.subType === 'BANK')
          .toArray();

        // Calculate current balance (sum of all bank account balances)
        const currentBalance = accounts.reduce((sum, account) => {
          const balance = parseFloat(account.balanceCents || '0') / 100;
          return sum + balance;
        }, 0);

        // Calculate monthly expenses (average of last 3 months)
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const threeMonthsAgoTimestamp = threeMonthsAgo.getTime();

        const expenseAccounts = await db.accounts
          .where('company_id')
          .equals(companyId)
          .and(account =>
            account.type === 'EXPENSE' ||
            account.type === 'OTHER_EXPENSE' ||
            account.type === 'COGS'
          )
          .toArray();

        const expenseAccountIds = expenseAccounts.map(acc => acc.id);

        // Get transactions for expense accounts in last 3 months
        const transactions = await db.transactions
          .where('company_id')
          .equals(companyId)
          .and(txn =>
            (txn.date ?? 0) >= threeMonthsAgoTimestamp &&
            txn.status === 'POSTED'
          )
          .toArray();

        // Calculate total expenses in last 3 months
        let totalExpenses = 0;
        for (const txn of transactions) {
          const lineItems = await db.transactionLineItems
            .where('transaction_id')
            .equals(txn.id)
            .toArray();

          for (const item of lineItems) {
            if (expenseAccountIds.includes(item.account_id)) {
              // Expenses are debits
              totalExpenses += parseFloat(item.debit_amount_cents || '0') / 100;
            }
          }
        }

        // Average monthly expenses (total / 3 months)
        const monthlyExpenses = totalExpenses / 3;

        // Calculate trend (last 6 months of cash balance)
        const trend: Array<{ date: string; balance: number }> = [];
        const today = new Date();

        for (let i = 5; i >= 0; i--) {
          const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const monthEnd = getEndOfMonth(monthDate);

          // Get transactions up to end of this month
          const monthTransactions = await db.transactions
            .where('company_id')
            .equals(companyId)
            .and(txn =>
              (txn.date ?? 0) <= monthEnd &&
              txn.status === 'POSTED'
            )
            .toArray();

          // Calculate balance at end of month
          let monthBalance = 0;
          for (const txn of monthTransactions) {
            const lineItems = await db.transactionLineItems
              .where('transaction_id')
              .equals(txn.id)
              .toArray();

            for (const item of lineItems) {
              const account = accounts.find(acc => acc.id === item.account_id);
              if (account) {
                // Bank accounts increase with debits, decrease with credits
                const credit = parseFloat(item.credit_amount_cents || '0') / 100;
                const debit = parseFloat(item.debit_amount_cents || '0') / 100;
                monthBalance += debit - credit;
              }
            }
          }

          trend.push({
            date: monthDate.toISOString().split('T')[0] || '',
            balance: monthBalance,
          });
        }

        if (mounted) {
          setData({
            currentBalance,
            monthlyExpenses,
            trend,
          });
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch cash position'));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    if (companyId) {
      fetchCashPosition();
    } else {
      setIsLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [companyId]);

  return { data, isLoading, error };
}
