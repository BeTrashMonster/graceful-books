/**
 * ResumeWidget Component
 *
 * "Resume where you left off" widget showing last 5 edited records.
 * Helps users quickly return to work in progress.
 *
 * Requirements:
 * - I3: UX Efficiency Shortcuts [Nice]
 * - WCAG 2.1 AA compliant
 * - Shows completion status for drafts
 */

import clsx from 'clsx';
import { getRelativeTimeString, getEntityTypeIcon, getEntityTypeDisplayName } from '../../db/schema/recentActivity.schema';
import type { RecentEditEntry } from '../../types/recentActivity.types';
import styles from './ResumeWidget.module.css';

export interface ResumeWidgetProps {
  /**
   * Recently edited items
   */
  recentEdits: RecentEditEntry[];

  /**
   * Callback when an item is clicked
   */
  onItemClick: (entityType: string, entityId: string) => void;

  /**
   * Whether edits are loading
   */
  isLoading?: boolean;

  /**
   * Additional class name
   */
  className?: string;
}

/**
 * ResumeWidget Component
 *
 * Displays recently edited items with visual progress indicators.
 */
export function ResumeWidget({
  recentEdits,
  onItemClick,
  isLoading = false,
  className = '',
}: ResumeWidgetProps) {
  if (isLoading) {
    return (
      <div className={clsx(styles.container, className)} role="status" aria-live="polite">
        <div className={styles.header}>
          <h2 className={styles.title}>Resume Where You Left Off</h2>
        </div>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner} aria-hidden="true" />
          <span className="sr-only">Loading recent work...</span>
        </div>
      </div>
    );
  }

  if (recentEdits.length === 0) {
    return (
      <div className={clsx(styles.container, className)}>
        <div className={styles.header}>
          <h2 className={styles.title}>Resume Where You Left Off</h2>
        </div>
        <div className={styles.empty}>
          <div className={styles.emptyIcon} aria-hidden="true">
            📝
          </div>
          <p className={styles.emptyText}>No recent work</p>
          <p className={styles.emptySubtext}>
            Items you're working on will appear here for quick access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(styles.container, className)}>
      <div className={styles.header}>
        <h2 className={styles.title}>Resume Where You Left Off</h2>
        <span className={styles.subtitle}>We remember so you don't have to</span>
      </div>

      <ul className={styles.list} aria-label="Recently edited items">
        {recentEdits.map((edit) => (
          <li key={edit.id} className={styles.item}>
            <button
              type="button"
              className={styles.itemButton}
              onClick={() => onItemClick(edit.entity_type, edit.entity_id)}
              aria-label={`Continue editing ${edit.label}`}
            >
              <div className={styles.iconWrapper}>
                <span className={styles.icon} aria-hidden="true">
                  {getEntityTypeIcon(edit.entity_type)}
                </span>
                {edit.is_draft && (
                  <span className={styles.draftBadge} aria-label="Draft">
                    Draft
                  </span>
                )}
              </div>

              <div className={styles.itemContent}>
                <div className={styles.labelRow}>
                  <span className={styles.label}>{edit.label}</span>
                  <span className={styles.entityType}>
                    {getEntityTypeDisplayName(edit.entity_type)}
                  </span>
                </div>
                <span className={styles.timestamp}>
                  {getRelativeTimeString(edit.timestamp)}
                </span>

                {edit.completion_percentage !== undefined && (
                  <div className={styles.progressBar} role="progressbar" aria-valuenow={edit.completion_percentage} aria-valuemin={0} aria-valuemax={100}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${edit.completion_percentage}%` }}
                      aria-hidden="true"
                    />
                    <span className="sr-only">{edit.completion_percentage}% complete</span>
                  </div>
                )}
              </div>

              <span className={styles.arrow} aria-hidden="true">
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
