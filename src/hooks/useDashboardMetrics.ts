/**
 * Dashboard Metrics Hook
 *
 * Custom hook to calculate and provide dashboard financial metrics
 * from the local database using Dexie React hooks.
 */

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import {
  calculateFinancialMetrics,
  getStartOfMonth,
  getEndOfMonth,
  type FinancialMetrics,
  type TransactionWithLineItems,
  type AccountInfo,
} from '@/utils/metricsCalculation';

/**
 * Dashboard metrics result
 */
export interface DashboardMetrics extends FinancialMetrics {
  isLoading: boolean;
  error: Error | null;
  transactionCount: number;
}

/**
 * Hook options
 */
export interface UseDashboardMetricsOptions {
  companyId: string;
  startDate?: number;
  endDate?: number;
}

/**
 * Custom hook to get dashboard metrics
 *
 * @param options - Hook options including company ID and date range
 * @returns Dashboard metrics including revenue, expenses, and profit
 */
export function useDashboardMetrics(options: UseDashboardMetricsOptions): DashboardMetrics {
  const { companyId, startDate = getStartOfMonth(), endDate = getEndOfMonth() } = options;

  // Load accounts for the company
  const accounts = useLiveQuery(
    async () => {
      const accountsList = await db.accounts
        .where('company_id')
        .equals(companyId)
        .and((account) => account.deleted_at === null)
        .toArray();

      return new Map<string, AccountInfo>(
        accountsList.map((account) => [
          account.id,
          { id: account.id, type: account.type },
        ])
      );
    },
    [companyId],
    new Map()
  );

  // Load transactions with line items for the date range
  const transactions = useLiveQuery(
    async () => {
      const txns = await db.transactions
        .where('company_id')
        .equals(companyId)
        .and(
          (txn) =>
            txn.transaction_date >= startDate &&
            txn.transaction_date <= endDate &&
            txn.deleted_at === null
        )
        .toArray();

      // Load line items for each transaction
      const transactionsWithLineItems: TransactionWithLineItems[] = await Promise.all(
        txns.map(async (txn) => {
          const lineItems = await db.transactionLineItems
            .where('transaction_id')
            .equals(txn.id)
            .toArray();

          return {
            ...txn,
            lineItems,
          };
        })
      );

      return transactionsWithLineItems;
    },
    [companyId, startDate, endDate],
    []
  );

  // Calculate metrics
  const metrics = useMemo(() => {
    // Check if data is still loading
    const isLoading = accounts === undefined || transactions === undefined;

    if (isLoading) {
      return {
        revenue: '0.00',
        expenses: '0.00',
        netProfit: '0.00',
        isProfitable: false,
        isLoading: true,
        error: null,
        transactionCount: 0,
      };
    }

    try {
      const financialMetrics = calculateFinancialMetrics(
        transactions,
        accounts,
        startDate,
        endDate
      );

      // Count only posted transactions
      const transactionCount = transactions.filter((txn) => txn.status === 'POSTED').length;

      return {
        ...financialMetrics,
        isLoading: false,
        error: null,
        transactionCount,
      };
    } catch (error) {
      return {
        revenue: '0.00',
        expenses: '0.00',
        netProfit: '0.00',
        isProfitable: false,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
        transactionCount: 0,
      };
    }
  }, [accounts, transactions, startDate, endDate]);

  return metrics;
}

/**
 * Hook to get recent transactions
 */
export interface RecentTransaction {
  id: string;
  date: number;
  description: string;
  amount: string;
  type: string;
}

export function useRecentTransactions(
  companyId: string,
  limit: number = 10
): {
  transactions: RecentTransaction[];
  isLoading: boolean;
} {
  const transactions = useLiveQuery(
    async () => {
      const txns = await db.transactions
        .where('company_id')
        .equals(companyId)
        .and((txn) => txn.deleted_at === null && txn.status === 'POSTED')
        .reverse()
        .sortBy('transaction_date');

      // Get the most recent transactions
      const recent = txns.slice(0, limit);

      // Load line items to calculate amount
      const withAmounts: RecentTransaction[] = await Promise.all(
        recent.map(async (txn) => {
          const lineItems = await db.transactionLineItems
            .where('transaction_id')
            .equals(txn.id)
            .toArray();

          // Calculate total debit amount (simplified)
          const totalDebit = lineItems.reduce(
            (sum, item) => sum + parseFloat(item.debit),
            0
          );

          return {
            id: txn.id,
            date: txn.transaction_date,
            description: txn.description || 'No description',
            amount: totalDebit.toFixed(2),
            type: txn.type,
          };
        })
      );

      return withAmounts;
    },
    [companyId, limit],
    []
  );

  return {
    transactions: transactions ?? [],
    isLoading: transactions === undefined,
  };
}
