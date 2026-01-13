/**
 * MetricCard Component
 *
 * Displays a single financial metric with optional trend indicator
 */

import { ReactNode } from 'react';
import styles from './MetricCard.module.css';

export interface MetricCardProps {
  title: string;
  value: string;
  trend?: {
    value: string;
    isPositive: boolean;
    label: string;
  };
  icon?: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  isLoading?: boolean;
  className?: string;
}

export function MetricCard({
  title,
  value,
  trend,
  icon,
  variant = 'default',
  isLoading = false,
  className = '',
}: MetricCardProps) {
  if (isLoading) {
    return (
      <div className={`${styles.metricCard} ${styles.loading} ${className}`} role="status" aria-live="polite">
        <div className={styles.header}>
          <span className={styles.skeleton} style={{ width: '60%', height: '1rem' }} />
        </div>
        <div className={styles.value}>
          <span className={styles.skeleton} style={{ width: '80%', height: '2rem' }} />
        </div>
        <span className="sr-only">Loading metric...</span>
      </div>
    );
  }

  return (
    <div className={`${styles.metricCard} ${styles[variant]} ${className}`} role="region" aria-label={title}>
      <div className={styles.header}>
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        <h3 className={styles.title}>{title}</h3>
      </div>

      <div className={styles.content}>
        <p className={styles.value} aria-label={`${title} value`}>
          {value}
        </p>

        {trend && (
          <div
            className={`${styles.trend} ${trend.isPositive ? styles.trendUp : styles.trendDown}`}
            aria-label={`${trend.label}: ${trend.value}`}
          >
            <span className={styles.trendIcon} aria-hidden="true">
              {trend.isPositive ? '↑' : '↓'}
            </span>
            <span className={styles.trendValue}>{trend.value}</span>
            <span className={styles.trendLabel}>{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
