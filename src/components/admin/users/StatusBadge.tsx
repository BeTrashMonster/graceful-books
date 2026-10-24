/**
 * StatusBadge Component
 *
 * Displays user status as a colored badge.
 * Uses brand autumn color palette for professional appearance.
 */

import styles from './StatusBadge.module.css';

export interface StatusBadgeProps {
  label: string;
  variant: 'success' | 'warning' | 'error' | 'info' | 'purple';
  details?: string;
  size?: 'small' | 'medium';
}

export function StatusBadge({ label, variant, details, size = 'medium' }: StatusBadgeProps) {
  return (
    <span
      className={`${styles.badge} ${styles[variant]} ${styles[size]}`}
      title={details}
      role="status"
    >
      {label}
    </span>
  );
}

export interface WorkshopBadgeProps {
  cohortName: string;
  shortName: string;
}

export function WorkshopBadge({ shortName, cohortName }: WorkshopBadgeProps) {
  return (
    <span
      className={`${styles.badge} ${styles.workshop} ${styles.medium}`}
      title={cohortName}
      role="status"
    >
      {shortName}
    </span>
  );
}

export interface TagBadgeProps {
  tag: string;
  onRemove?: () => void;
}

export function TagBadge({ tag, onRemove }: TagBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles.tag} ${styles.small}`}>
      {tag}
      {onRemove && (
        <button
          type="button"
          className={styles.removeButton}
          onClick={onRemove}
          aria-label={`Remove tag ${tag}`}
        >
          &times;
        </button>
      )}
    </span>
  );
}
