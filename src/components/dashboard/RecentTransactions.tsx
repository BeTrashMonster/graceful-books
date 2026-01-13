/**
 * RecentTransactions Component
 *
 * Displays a list of the most recent transactions
 */

import { formatCurrency } from '@/utils/metricsCalculation';
import styles from './RecentTransactions.module.css';

export interface Transaction {
  id: string;
  date: number;
  description: string;
  amount: string;
  type: string;
}

export interface RecentTransactionsProps {
  transactions: Transaction[];
  isLoading?: boolean;
  limit?: number;
  onViewAll?: () => void;
  className?: string;
}

export function RecentTransactions({
  transactions,
  isLoading = false,
  limit = 10,
  onViewAll,
  className = '',
}: RecentTransactionsProps) {
  const displayTransactions = transactions.slice(0, limit);

  if (isLoading) {
    return (
      <div className={`${styles.container} ${className}`} role="status" aria-live="polite">
        <div className={styles.header}>
          <h2 className={styles.title}>Recent Transactions</h2>
        </div>
        <div className={styles.list}>
          {[...Array(3)].map((_, index) => (
            <div key={index} className={`${styles.item} ${styles.loading}`}>
              <div className={styles.itemContent}>
                <span className={styles.skeleton} style={{ width: '60%', height: '1rem' }} />
                <span className={styles.skeleton} style={{ width: '40%', height: '0.875rem' }} />
              </div>
              <span className={styles.skeleton} style={{ width: '5rem', height: '1rem' }} />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading transactions...</span>
      </div>
    );
  }

  if (displayTransactions.length === 0) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.header}>
          <h2 className={styles.title}>Recent Transactions</h2>
        </div>
        <div className={styles.empty}>
          <p className={styles.emptyText}>No transactions yet</p>
          <p className={styles.emptySubtext}>
            Your recent transactions will appear here once you start recording them.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <h2 className={styles.title}>Recent Transactions</h2>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className={styles.viewAllButton}
            aria-label="View all transactions"
          >
            View All
          </button>
        )}
      </div>

      <ul className={styles.list} aria-label="Recent transactions list">
        {displayTransactions.map((transaction) => (
          <li key={transaction.id} className={styles.item}>
            <div className={styles.itemContent}>
              <span className={styles.description}>{transaction.description}</span>
              <span className={styles.meta}>
                {formatDate(transaction.date)} • {formatTransactionType(transaction.type)}
              </span>
            </div>
            <span className={styles.amount} aria-label={`Amount: ${formatCurrency(transaction.amount)}`}>
              {formatCurrency(transaction.amount)}
            </span>
          </li>
        ))}
      </ul>

      {transactions.length > limit && !onViewAll && (
        <p className={styles.moreIndicator}>
          Showing {limit} of {transactions.length} transactions
        </p>
      )}
    </div>
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatTransactionType(type: string): string {
  const typeMap: Record<string, string> = {
    JOURNAL_ENTRY: 'Journal Entry',
    INVOICE: 'Invoice',
    PAYMENT: 'Payment',
    EXPENSE: 'Expense',
    BILL: 'Bill',
    CREDIT_NOTE: 'Credit Note',
    ADJUSTMENT: 'Adjustment',
  };

  return typeMap[type] || type;
}
