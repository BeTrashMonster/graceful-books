/**
 * RecentEntriesHelper Component
 *
 * Shows "Recent entries" button in forms with last 20 similar entries.
 * Helps users quickly fill forms based on previous entries.
 *
 * Requirements:
 * - I3: UX Efficiency Shortcuts [Nice]
 * - WCAG 2.1 AA compliant
 * - One-click form filling
 */

import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { getRelativeTimeString } from '../../db/schema/recentActivity.schema';
import type { RecentEntrySuggestion } from '../../types/recentActivity.types';
import styles from './RecentEntriesHelper.module.css';

export interface RecentEntriesHelperProps {
  /**
   * Recent entry suggestions
   */
  entries: RecentEntrySuggestion[];

  /**
   * Callback when an entry is selected
   */
  onSelectEntry: (entry: RecentEntrySuggestion) => void;

  /**
   * Whether entries are loading
   */
  isLoading?: boolean;

  /**
   * Label for the button
   */
  buttonLabel?: string;

  /**
   * Additional class name
   */
  className?: string;
}

/**
 * RecentEntriesHelper Component
 *
 * Provides quick access to recent similar entries with preview.
 */
export function RecentEntriesHelper({
  entries,
  onSelectEntry,
  isLoading = false,
  buttonLabel = 'Recent entries',
  className = '',
}: RecentEntriesHelperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleSelect = (entry: RecentEntrySuggestion) => {
    onSelectEntry(entry);
    setIsOpen(false);
  };

  return (
    <div className={clsx(styles.container, className)} ref={dropdownRef}>
      <button
        type="button"
        className={styles.triggerButton}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={entries.length > 0 ? `${buttonLabel} (${entries.length} available)` : buttonLabel}
      >
        <span className={styles.buttonIcon} aria-hidden="true">
          ⏱️
        </span>
        {buttonLabel}
        <span className={styles.buttonCount} aria-hidden="true">
          {entries.length}
        </span>
      </button>

      {isOpen && (
        <div
          className={styles.dropdown}
          role="menu"
          aria-label="Recent entries"
        >
          {isLoading ? (
            <div className={styles.loading} role="status">
              <div className={styles.loadingSpinner} aria-hidden="true" />
              <span>Loading recent entries...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyText}>No recent entries</p>
              <p className={styles.emptySubtext}>
                Start creating entries and they'll appear here for quick reuse.
              </p>
            </div>
          ) : (
            <ul className={styles.list}>
              {entries.map((entry) => (
                <li key={entry.id} className={styles.item} role="none">
                  <button
                    type="button"
                    className={styles.itemButton}
                    onClick={() => handleSelect(entry)}
                    role="menuitem"
                  >
                    <div className={styles.itemHeader}>
                      <span className={styles.itemLabel}>{entry.label}</span>
                      <span className={styles.itemTimestamp}>
                        {getRelativeTimeString(entry.timestamp)}
                      </span>
                    </div>
                    {entry.preview_data && Object.keys(entry.preview_data).length > 0 && (
                      <div className={styles.itemPreview}>
                        {entry.preview_data.description && (
                          <span className={styles.previewItem}>
                            <strong>Description:</strong> {entry.preview_data.description}
                          </span>
                        )}
                        {entry.preview_data.amount && (
                          <span className={styles.previewItem}>
                            <strong>Amount:</strong> {entry.preview_data.amount}
                          </span>
                        )}
                        {entry.preview_data.vendor && (
                          <span className={styles.previewItem}>
                            <strong>Vendor:</strong> {entry.preview_data.vendor}
                          </span>
                        )}
                        {entry.preview_data.category && (
                          <span className={styles.previewItem}>
                            <strong>Category:</strong> {entry.preview_data.category}
                          </span>
                        )}
                        {entry.preview_data.account && (
                          <span className={styles.previewItem}>
                            <strong>Account:</strong> {entry.preview_data.account}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
