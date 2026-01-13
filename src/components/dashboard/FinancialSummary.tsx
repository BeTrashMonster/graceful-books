/**
 * FinancialSummary Component
 *
 * Displays a monthly financial summary with key metrics
 */

import { formatCurrency } from '@/utils/metricsCalculation';
import styles from './FinancialSummary.module.css';

export interface FinancialSummaryProps {
  revenue: string;
  expenses: string;
  netProfit: string;
  isProfitable: boolean;
  period?: string;
  isLoading?: boolean;
  className?: string;
}

export function FinancialSummary({
  revenue,
  expenses,
  netProfit,
  isProfitable,
  period = 'This Month',
  isLoading = false,
  className = '',
}: FinancialSummaryProps) {
  if (isLoading) {
    return (
      <div className={`${styles.container} ${className}`} role="status" aria-live="polite">
        <div className={styles.header}>
          <span className={styles.skeleton} style={{ width: '40%', height: '1.25rem' }} />
        </div>
        <div className={styles.metrics}>
          {[...Array(3)].map((_, index) => (
            <div key={index} className={styles.metric}>
              <span className={styles.skeleton} style={{ width: '50%', height: '0.875rem' }} />
              <span className={styles.skeleton} style={{ width: '70%', height: '1.5rem' }} />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading financial summary...</span>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <h2 className={styles.title}>{period}</h2>
      </div>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.label}>Revenue</span>
          <span className={`${styles.value} ${styles.revenue}`} aria-label={`Revenue: ${formatCurrency(revenue)}`}>
            {formatCurrency(revenue)}
          </span>
        </div>

        <div className={styles.metric}>
          <span className={styles.label}>Expenses</span>
          <span className={`${styles.value} ${styles.expenses}`} aria-label={`Expenses: ${formatCurrency(expenses)}`}>
            {formatCurrency(expenses)}
          </span>
        </div>

        <div className={styles.divider} role="separator" />

        <div className={styles.metric}>
          <span className={styles.label}>Net {isProfitable ? 'Profit' : 'Loss'}</span>
          <span
            className={`${styles.value} ${styles.netProfit} ${isProfitable ? styles.positive : styles.negative}`}
            aria-label={`Net ${isProfitable ? 'Profit' : 'Loss'}: ${formatCurrency(netProfit)}`}
          >
            {formatCurrency(netProfit)}
          </span>
        </div>
      </div>

      {isProfitable && (
        <div className={styles.message} role="status">
          <span className={styles.messageIcon} aria-hidden="true">✓</span>
          <span className={styles.messageText}>Great work! You're profitable this period.</span>
        </div>
      )}

      {!isProfitable && parseFloat(netProfit) < 0 && (
        <div className={`${styles.message} ${styles.warning}`} role="status">
          <span className={styles.messageIcon} aria-hidden="true">!</span>
          <span className={styles.messageText}>
            Expenses exceed revenue. Review your spending or increase income.
          </span>
        </div>
      )}
    </div>
  );
}
