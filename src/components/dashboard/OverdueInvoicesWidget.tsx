/**
 * Overdue Invoices Widget
 *
 * Highlights overdue invoices with actionable follow-up links.
 * Shows count, total amount, and quick actions to follow up with customers.
 *
 * Requirements:
 * - F1: Dashboard - Full Featured [MVP]
 * - Overdue invoices highlighted with actionable follow-up links
 */

import { Link } from 'react-router-dom';
import styles from './OverdueInvoicesWidget.module.css';

export interface OverdueInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  total: number;
  due_date: number; // Unix timestamp
  days_overdue: number;
}

export interface OverdueInvoicesWidgetProps {
  invoices: OverdueInvoice[];
  isLoading?: boolean;
  onFollowUp?: (invoiceId: string) => void;
  className?: string;
}

/**
 * Format currency
 */
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

/**
 * Format date
 */
const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Get urgency class based on days overdue
 */
const getUrgencyClass = (daysOverdue: number): string => {
  if (daysOverdue >= 60) return 'critical';
  if (daysOverdue >= 30) return 'urgent';
  if (daysOverdue >= 15) return 'medium';
  return 'low';
};

export function OverdueInvoicesWidget({
  invoices,
  isLoading = false,
  onFollowUp,
  className,
}: OverdueInvoicesWidgetProps) {
  // Sort invoices by days overdue (most overdue first)
  const sortedInvoices = [...invoices].sort((a, b) => b.days_overdue - a.days_overdue);

  const totalOverdue = sortedInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const criticalCount = sortedInvoices.filter((inv) => inv.days_overdue >= 60).length;

  if (isLoading) {
    return (
      <div className={`${styles.widget} ${className || ''}`} aria-label="Overdue Invoices Widget">
        <div className={styles.loadingState} role="status" aria-live="polite">
          <div className={styles.loadingSkeleton} />
          <p className={styles.loadingText}>Loading overdue invoices...</p>
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className={`${styles.widget} ${className || ''}`} aria-label="Overdue Invoices Widget">
        <div className={styles.header}>
          <h2 className={styles.title} role="heading">Overdue Invoices</h2>
          <span className={styles.badge} aria-label="No overdue invoices">
            0
          </span>
        </div>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon} aria-hidden="true">✓</span>
          <p className={styles.emptyMessage}>No overdue invoices</p>
          <p className={styles.emptyHint}>great job staying on top of your receivables!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.widget} ${className || ''}`} aria-label="Overdue Invoices Widget">
      <div className={styles.header}>
        <h2 className={styles.title} role="heading">
          <span aria-hidden="true">⚠️</span> Overdue Invoices
        </h2>
        <span className={`${styles.badge} ${styles.warning}`} aria-label={`${sortedInvoices.length} overdue invoices`}>
          {sortedInvoices.length}
        </span>
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryItem} aria-label="Total overdue amount">
          <span className={styles.summaryLabel}>Total Overdue</span>
          <span className={styles.summaryValue} data-testid="total-overdue-amount">{formatCurrency(totalOverdue)}</span>
        </div>
        {criticalCount > 0 && (
          <div className={`${styles.summaryItem} ${styles.critical}`}>
            <span className={styles.summaryLabel}>Critical (60+ days)</span>
            <span className={styles.summaryValue}>{criticalCount}</span>
          </div>
        )}
      </div>

      <div className={styles.invoiceList} role="list">
        {sortedInvoices.slice(0, 5).map((invoice) => {
          const urgencyClass = getUrgencyClass(invoice.days_overdue);
          return (
            <div
              key={invoice.id}
              className={`${styles.invoiceItem} ${styles[urgencyClass]} ${urgencyClass}`}
              role="listitem"
            >
            <div className={styles.invoiceInfo}>
              <div className={styles.invoiceHeader}>
                <Link to={`/invoices/${invoice.id}`} className={styles.invoiceNumber}>
                  {invoice.invoice_number}
                </Link>
                <span className={styles.daysOverdue}>
                  {invoice.days_overdue} {invoice.days_overdue === 1 ? 'day' : 'days'} overdue
                </span>
              </div>
              <p className={styles.customerName}>{invoice.customer_name}</p>
              <div className={styles.invoiceDetails}>
                <span className={styles.amount} data-testid={`invoice-amount-${invoice.id}`}>{formatCurrency(invoice.total)}</span>
                <span className={styles.dueDate}>Due: {formatDate(invoice.due_date)}</span>
              </div>
            </div>
            {onFollowUp ? (
              <button
                className={styles.followUpButton}
                onClick={() => onFollowUp(invoice.id)}
                aria-label={`Follow up on invoice ${invoice.invoice_number}`}
              >
                Follow Up
              </button>
            ) : (
              <Link
                to={`/invoices/${invoice.id}`}
                className={styles.followUpButton}
                role="button"
                aria-label={`Follow up on invoice ${invoice.invoice_number}`}
              >
                Follow Up
              </Link>
            )}
          </div>
          );
        })}
      </div>

      {sortedInvoices.length > 5 && (
        <div className={styles.footer}>
          <Link to="/invoices?filter=overdue" className={styles.viewAllLink}>
            {sortedInvoices.length - 5} more
          </Link>
        </div>
      )}

      <div className={styles.actionButtons}>
        <Link to="/invoices?filter=overdue" className={styles.actionButton}>
          View All
        </Link>
        <Link to="/reports/ar-aging" className={styles.actionButton}>
          A/R Aging Report
        </Link>
      </div>
    </div>
  );
}
