/**
 * DuplicateAlert Component
 *
 * Alerts users about potential duplicate transactions with comparison view.
 * Helps prevent accidental duplicate entries.
 *
 * Requirements:
 * - I3: UX Efficiency Shortcuts [Nice]
 * - WCAG 2.1 AA compliant
 * - Easy dismissal of false positives
 */

import clsx from 'clsx';
import { format } from 'date-fns';
import type { DuplicateCandidate } from '../../services/duplicateDetection.service';
import styles from './DuplicateAlert.module.css';

export interface DuplicateAlertProps {
  /**
   * Duplicate candidate to display
   */
  duplicate: DuplicateCandidate;

  /**
   * Callback when user confirms it's a duplicate and cancels entry
   */
  onConfirmDuplicate: () => void;

  /**
   * Callback when user dismisses the alert (not a duplicate)
   */
  onDismiss: () => void;

  /**
   * Callback to view/compare the existing entry
   */
  onViewExisting?: () => void;

  /**
   * Additional class name
   */
  className?: string;
}

/**
 * DuplicateAlert Component
 *
 * Non-intrusive alert showing potential duplicate with comparison.
 */
export function DuplicateAlert({
  duplicate,
  onConfirmDuplicate,
  onDismiss,
  onViewExisting,
  className = '',
}: DuplicateAlertProps) {
  const getConfidenceBadgeColor = (level: 'high' | 'medium' | 'low') => {
    const colors = {
      high: styles.confidenceHigh,
      medium: styles.confidenceMedium,
      low: styles.confidenceLow,
    };
    return colors[level];
  };

  const getConfidenceMessage = () => {
    const messages = {
      high: 'This is very likely a duplicate.',
      medium: 'This might be a duplicate.',
      low: 'This could be similar to an existing entry.',
    };
    return messages[duplicate.confidence_level];
  };

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), 'MMM d, yyyy');
  };

  const daysAgoText = duplicate.days_apart === 0
    ? 'today'
    : duplicate.days_apart === 1
    ? 'yesterday'
    : `${duplicate.days_apart} days ago`;

  return (
    <div
      className={clsx(styles.container, className)}
      role="alert"
      aria-live="polite"
    >
      <div className={styles.header}>
        <div className={styles.iconWrapper}>
          <span className={styles.icon} aria-hidden="true">
            ⚠️
          </span>
        </div>
        <div className={styles.titleSection}>
          <h3 className={styles.title}>Possible Duplicate Entry</h3>
          <p className={styles.message}>{getConfidenceMessage()}</p>
        </div>
        <span
          className={clsx(styles.confidenceBadge, getConfidenceBadgeColor(duplicate.confidence_level))}
          aria-label={`Confidence: ${duplicate.confidence_level}`}
        >
          {duplicate.confidence_level}
        </span>
      </div>

      <div className={styles.comparison}>
        <div className={styles.comparisonSection}>
          <span className={styles.comparisonLabel}>Similar entry from {daysAgoText}:</span>
          <div className={styles.comparisonDetails}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Description:</span>
              <span className={styles.detailValue}>{duplicate.description || 'N/A'}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Amount:</span>
              <span className={styles.detailValue}>{duplicate.amount}</span>
            </div>
            {duplicate.vendor_customer && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Vendor/Customer:</span>
                <span className={styles.detailValue}>{duplicate.vendor_customer}</span>
              </div>
            )}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Date:</span>
              <span className={styles.detailValue}>{formatDate(duplicate.date)}</span>
            </div>
          </div>
        </div>

        <div className={styles.similarityMeter}>
          <span className={styles.similarityLabel}>
            Similarity: {Math.round(duplicate.similarity_score * 100)}%
          </span>
          <div className={styles.similarityBar} role="progressbar" aria-valuenow={Math.round(duplicate.similarity_score * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div
              className={styles.similarityFill}
              style={{ width: `${duplicate.similarity_score * 100}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        {onViewExisting && (
          <button
            type="button"
            onClick={onViewExisting}
            className={styles.secondaryButton}
            aria-label="View existing entry"
          >
            View Existing
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className={styles.secondaryButton}
          aria-label="This is not a duplicate, continue with entry"
        >
          Not a Duplicate
        </button>
        <button
          type="button"
          onClick={onConfirmDuplicate}
          className={styles.primaryButton}
          aria-label="This is a duplicate, cancel entry"
        >
          Yes, It's a Duplicate
        </button>
      </div>
    </div>
  );
}
