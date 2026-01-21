/**
 * Cash Position Widget
 *
 * Displays current cash position with trend visualization and encouraging context.
 * Shows cash balance, trend over time, and months of expenses covered.
 *
 * Requirements:
 * - F1: Dashboard - Full Featured [MVP]
 * - Delight Detail: "You have 3.2 months of expenses covered. That's solid!"
 */

import { useMemo } from 'react';
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import styles from './CashPositionWidget.module.css';

export interface CashPositionData {
  currentBalance: number;
  monthlyExpenses: number;
  trend: Array<{
    date: string;
    balance: number;
  }>;
}

export interface CashPositionWidgetProps {
  data: CashPositionData;
  isLoading?: boolean;
  className?: string;
}

/**
 * Calculate months of expenses covered
 */
const calculateMonthsCovered = (balance: number, monthlyExpenses: number): number => {
  if (monthlyExpenses === 0) return 0;
  return balance / monthlyExpenses;
};

/**
 * Get encouraging message based on months covered
 */
const getEncouragingMessage = (monthsCovered: number, monthlyExpenses: number): string => {
  if (monthlyExpenses === 0) {
    return "No monthly expenses recorded yet.";
  }

  if (monthsCovered === 0) {
    return "building up your cash position";
  }

  if (monthsCovered < 1) {
    return "building momentum";
  }

  if (monthsCovered < 2) {
    return "good start";
  }

  if (monthsCovered < 3) {
    return "getting stronger";
  }

  if (monthsCovered < 6) {
    return "solid";
  }

  return "excellent position";
};

/**
 * Get trend direction
 */
const getTrendDirection = (trend: Array<{ date: string; balance: number }>): 'up' | 'down' | 'flat' => {
  if (trend.length < 2) return 'flat';

  const first = trend[0]!.balance;
  const last = trend[trend.length - 1]!.balance;
  const difference = last - first;

  // Consider change less than 5% as flat
  const percentChange = Math.abs(difference / first) * 100;

  if (percentChange < 5) return 'flat';
  if (difference > 0) return 'up';
  return 'down';
};

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
 * Format number for display
 */
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toFixed(0);
};

export function CashPositionWidget({ data, isLoading = false, className }: CashPositionWidgetProps) {
  const monthsCovered = useMemo(
    () => calculateMonthsCovered(data.currentBalance, data.monthlyExpenses),
    [data.currentBalance, data.monthlyExpenses]
  );

  const encouragingMessage = useMemo(
    () => getEncouragingMessage(monthsCovered, data.monthlyExpenses),
    [monthsCovered, data.monthlyExpenses]
  );

  const trendDirection = useMemo(
    () => getTrendDirection(data.trend),
    [data.trend]
  );

  if (isLoading) {
    return (
      <div className={`${styles.widget} ${className || ''}`} aria-label="Cash Position Widget">
        <div className={styles.loadingState} role="status" aria-live="polite">
          <div className={styles.loadingSkeleton} />
          <p className={styles.loadingText}>Loading cash position...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.widget} ${className || ''}`} aria-label="Cash Position Widget">
      <div className={styles.header}>
        <h2 className={styles.title}>Cash Position</h2>
        <span className={`${styles.trendIndicator} ${styles[trendDirection]}`} aria-label={`Trend: ${trendDirection}`} aria-hidden="true">
          {trendDirection === 'up' && '📈'}
          {trendDirection === 'down' && '📉'}
          {trendDirection === 'flat' && '➡️'}
        </span>
      </div>

      <div className={styles.content}>
        <div className={styles.balanceSection}>
          <p className={styles.balanceLabel} aria-label="Current cash balance">Current Balance</p>
          <p className={styles.balance} aria-label={`Current balance: ${formatCurrency(data.currentBalance)}`}>
            {formatCurrency(data.currentBalance)}
          </p>
        </div>

        {data.trend.length > 0 && (
          <div className={styles.chartSection} aria-label="Cash position trend chart">
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={data.trend} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatNumber}
                  width={50}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value) as any}
                  labelFormatter={(label) => {
                    const date = new Date(label);
                    return date.toLocaleDateString();
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className={styles.metricsSection}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Monthly Expenses</span>
            <span className={styles.metricValue}>{formatCurrency(data.monthlyExpenses)}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Months Covered</span>
            <span className={styles.metricValue} data-testid="months-covered">{monthsCovered.toFixed(1)} months</span>
          </div>
        </div>

        <p className={styles.encouragement} role="status" aria-label="Encouragement message">
          {encouragingMessage}
        </p>
      </div>
    </div>
  );
}
