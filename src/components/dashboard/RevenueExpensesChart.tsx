/**
 * Revenue vs Expenses Chart
 *
 * Displays a visual comparison of revenue and expenses over time.
 * Uses a bar chart for clear side-by-side comparison.
 *
 * Requirements:
 * - F1: Dashboard - Full Featured [MVP]
 * - Revenue vs expenses chart provides clear visual comparison
 */

import { useMemo } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import styles from './RevenueExpensesChart.module.css';

export interface RevenueExpensesData {
  date: string; // ISO date string or Unix timestamp
  revenue: number;
  expenses: number;
}

export interface RevenueExpensesChartProps {
  data: RevenueExpensesData[];
  isLoading?: boolean;
  period?: string; // e.g., "Last 6 Months"
  className?: string;
}

/**
 * Format currency for display
 */
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format date for x-axis
 */
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

/**
 * Format number for y-axis (abbreviated)
 */
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(0)}K`;
  }
  return `$${num.toFixed(0)}`;
};

/**
 * Calculate summary statistics and trend
 */
const calculateSummary = (data: RevenueExpensesData[]) => {
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const totalExpenses = data.reduce((sum, item) => sum + item.expenses, 0);
  const netProfit = totalRevenue - totalExpenses;
  const avgRevenue = data.length > 0 ? totalRevenue / data.length : 0;
  const avgExpenses = data.length > 0 ? totalExpenses / data.length : 0;

  // Calculate trend (compare first and last revenue)
  let trend: 'growing' | 'declining' | 'stable' = 'stable';
  if (data.length >= 2) {
    const firstRevenue = data[0]!.revenue;
    const lastRevenue = data[data.length - 1]!.revenue;
    if (lastRevenue > firstRevenue * 1.05) {
      trend = 'growing';
    } else if (lastRevenue < firstRevenue * 0.95) {
      trend = 'declining';
    }
  }

  // Check if all data is zero
  const isAllZero = totalRevenue === 0 && totalExpenses === 0;

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    avgRevenue,
    avgExpenses,
    isProfitable: netProfit >= 0,
    trend,
    isAllZero,
  };
};

export function RevenueExpensesChart({
  data,
  isLoading = false,
  period = 'Last 6 Months',
  className,
}: RevenueExpensesChartProps) {
  const summary = useMemo(() => calculateSummary(data), [data]);

  if (isLoading) {
    return (
      <div className={`${styles.widget} ${className || ''}`} aria-label="Revenue vs Expenses Chart">
        <div className={styles.loadingState} role="status" aria-live="polite">
          <div className={styles.loadingSkeleton} />
          <p className={styles.loadingText}>Loading chart...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`${styles.widget} ${className || ''}`} aria-label="Revenue vs Expenses Chart">
        <div className={styles.header}>
          <h2 className={styles.title}>Revenue vs Expenses</h2>
          <span className={styles.period}>{period}</span>
        </div>
        <div className={styles.emptyState}>
          <p>No data available for this period.</p>
          <p className={styles.emptyStateHint}>
            Once you start recording transactions, you'll see a comparison of your revenue and expenses here.
          </p>
        </div>
      </div>
    );
  }

  // Special case: all zero data
  if (summary.isAllZero) {
    return (
      <div className={`${styles.widget} ${className || ''}`} aria-label="Revenue vs Expenses Chart">
        <div className={styles.header}>
          <h2 className={styles.title}>Revenue vs Expenses</h2>
          <span className={styles.period}>{period}</span>
        </div>
        <div className={styles.emptyState}>
          <p>No revenue or expenses recorded for this period.</p>
          <p className={styles.emptyStateHint}>
            Start recording your business transactions to see them visualized here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.widget} ${className || ''}`} aria-label="Revenue vs Expenses Chart">
      <div className={styles.header}>
        <h2 className={styles.title}>Revenue vs Expenses</h2>
        <span className={styles.period}>{period}</span>
      </div>

      {/* Status indicators */}
      <div className={styles.statusSection}>
        {summary.isProfitable ? (
          <span className={styles.statusBadge}>Profitable</span>
        ) : (
          <span className={styles.statusBadge}>Expenses exceed revenue</span>
        )}
        {summary.trend === 'growing' && (
          <span className={styles.trendBadge}>Growing</span>
        )}
        {summary.trend === 'declining' && (
          <span className={styles.trendBadge}>Declining</span>
        )}
      </div>

      <div className={styles.summarySection}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Revenue</span>
          <span className={`${styles.summaryValue} ${styles.revenue}`}>
            {formatCurrency(summary.totalRevenue)}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Expenses</span>
          <span className={`${styles.summaryValue} ${styles.expenses}`}>
            {formatCurrency(summary.totalExpenses)}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Net {summary.isProfitable ? 'Profit' : 'Loss'}</span>
          <span className={`${styles.summaryValue} ${summary.isProfitable ? styles.profit : styles.loss}`}>
            {formatCurrency(Math.abs(summary.netProfit))}
          </span>
        </div>
      </div>

      <div className={styles.chartSection} aria-label="Revenue and expenses comparison chart">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" aria-hidden="true" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
              tickFormatter={formatDate}
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
              tickFormatter={formatNumber}
              width={60}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name === 'revenue' ? 'Revenue' : 'Expenses',
              ] as any}
              labelFormatter={(label) => formatDate(label)}
              contentStyle={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--border-radius-md)',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
              formatter={(value: string) => (value === 'revenue' ? 'Revenue' : 'Expenses')}
            />
            <Bar
              dataKey="revenue"
              fill="var(--color-success)"
              radius={[4, 4, 0, 0]}
              name="revenue"
            />
            <Bar
              dataKey="expenses"
              fill="var(--color-warning)"
              radius={[4, 4, 0, 0]}
              name="expenses"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.insightSection}>
        <p className={styles.insight}>
          {summary.isProfitable ? (
            <>
              Great job! Your revenue exceeded expenses by {formatCurrency(summary.netProfit)} over this period.
            </>
          ) : (
            <>
              Your expenses exceeded revenue by {formatCurrency(Math.abs(summary.netProfit))} over this period.
              Let's work on finding ways to increase revenue or reduce expenses.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
