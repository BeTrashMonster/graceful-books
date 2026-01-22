/**
 * useRevenueExpensesData Hook
 *
 * Fetches revenue and expenses data over time for chart visualization.
 */

import { useState, useEffect } from 'react';
import type { RevenueExpensesData } from '../components/dashboard/RevenueExpensesChart';
import { db } from '../db/database';

export function useRevenueExpensesData(companyId: string, months = 6): {
  data: RevenueExpensesData[];
  isLoading: boolean;
  error: Error | null;
} {
  const [data, setData] = useState<RevenueExpensesData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchRevenueExpensesData() {
      try {
        setIsLoading(true);
        setError(null);

        // Get income and expense accounts
        const accounts = await db.accounts
          .where('company_id')
          .equals(companyId)
          .toArray();

        const incomeAccountIds = accounts
          .filter(acc => acc.type === 'INCOME' || acc.type === 'OTHER_INCOME')
          .map(acc => acc.id);

        const expenseAccountIds = accounts
          .filter(
            acc =>
              acc.type === 'EXPENSE' ||
              acc.type === 'OTHER_EXPENSE' ||
              acc.type === 'COGS'
          )
          .map(acc => acc.id);

        // Calculate data for each month
        const monthlyData: RevenueExpensesData[] = [];
        const today = new Date();

        for (let i = months - 1; i >= 0; i--) {
          const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const monthStart = monthDate.getTime();
          const monthEnd = new Date(
            monthDate.getFullYear(),
            monthDate.getMonth() + 1,
            0,
            23,
            59,
            59,
            999
          ).getTime();

          // Get transactions for this month
          const monthTransactions = await db.transactions
            .where('company_id')
            .equals(companyId)
            .and(txn =>
              (txn.date ?? 0) >= monthStart &&
              (txn.date ?? 0) <= monthEnd &&
              txn.status === 'POSTED'
            )
            .toArray();

          let revenue = 0;
          let expenses = 0;

          // Calculate revenue and expenses from line items
          for (const txn of monthTransactions) {
            const lineItems = await db.transactionLineItems
              .where('transaction_id')
              .equals(txn.id)
              .toArray();

            for (const item of lineItems) {
              const creditAmount = parseFloat(item.credit_amount_cents || '0') / 100;
              const debitAmount = parseFloat(item.debit_amount_cents || '0') / 100;

              if (incomeAccountIds.includes(item.account_id)) {
                // Income accounts increase with credits
                revenue += creditAmount;
              }

              if (expenseAccountIds.includes(item.account_id)) {
                // Expense accounts increase with debits
                expenses += debitAmount;
              }
            }
          }

          monthlyData.push({
            date: monthDate.toISOString().split('T')[0] || '',
            revenue,
            expenses,
          });
        }

        if (mounted) {
          setData(monthlyData);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch revenue/expenses data'));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    if (companyId) {
      fetchRevenueExpensesData();
    } else {
      setIsLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [companyId, months]);

  return { data, isLoading, error };
}
