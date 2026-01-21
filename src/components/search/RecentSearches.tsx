/**
 * RecentSearches Component
 *
 * Displays recent search history in a dropdown when search field is focused.
 * Shows last 10 searches with one-click access.
 *
 * Requirements:
 * - I3: UX Efficiency Shortcuts [Nice]
 * - WCAG 2.1 AA compliant
 * - Keyboard navigation support
 */

import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { getRelativeTimeString, getEntityTypeIcon } from '../../db/schema/recentActivity.schema';
import type { RecentSearchEntry } from '../../types/recentActivity.types';
import styles from './RecentSearches.module.css';

export interface RecentSearchesProps {
  /**
   * Recent search entries to display
   */
  searches: RecentSearchEntry[];

  /**
   * Whether to show the recent searches dropdown
   */
  isOpen: boolean;

  /**
   * Callback when a search is selected
   */
  onSelectSearch: (query: string) => void;

  /**
   * Callback to close the dropdown
   */
  onClose: () => void;

  /**
   * Callback to clear all history
   */
  onClearHistory?: () => void;

  /**
   * Whether searches are loading
   */
  isLoading?: boolean;

  /**
   * Additional class name
   */
  className?: string;
}

/**
 * RecentSearches Component
 *
 * Accessible dropdown showing recent search history.
 * Supports keyboard navigation and screen readers.
 */
export function RecentSearches({
  searches,
  isOpen,
  onSelectSearch,
  onClose,
  onClearHistory,
  isLoading = false,
  className = '',
}: RecentSearchesProps) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => (prev < searches.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && searches[focusedIndex]) {
            onSelectSearch(searches[focusedIndex].query);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, searches, focusedIndex, onSelectSearch, onClose]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[focusedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className={clsx(styles.container, className)}
      role="region"
      aria-label="Recent searches"
    >
      <div className={styles.header}>
        <h3 className={styles.title}>Recent Searches</h3>
        {onClearHistory && searches.length > 0 && (
          <button
            onClick={onClearHistory}
            className={styles.clearButton}
            type="button"
            aria-label="Clear search history"
          >
            Clear All
          </button>
        )}
      </div>

      {isLoading ? (
        <div className={styles.loading} role="status" aria-live="polite">
          <div className={styles.loadingSpinner} aria-hidden="true" />
          <span className="sr-only">Loading recent searches...</span>
        </div>
      ) : searches.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>No recent searches</p>
          <p className={styles.emptySubtext}>
            Your search history will appear here for quick access.
          </p>
        </div>
      ) : (
        <ul
          ref={listRef}
          className={styles.list}
          role="listbox"
          aria-label="Recent search history"
        >
          {searches.map((search, index) => (
            <li
              key={search.id}
              role="option"
              aria-selected={index === focusedIndex}
              className={clsx(styles.item, {
                [styles.focused as string]: index === focusedIndex,
              })}
            >
              <button
                type="button"
                className={styles.itemButton}
                onClick={() => onSelectSearch(search.query)}
                onMouseEnter={() => setFocusedIndex(index)}
                aria-label={`Search for "${search.query}"`}
              >
                <span className={styles.icon} aria-hidden="true">
                  {getEntityTypeIcon(search.entity_type)}
                </span>
                <div className={styles.itemContent}>
                  <span className={styles.query}>{search.query}</span>
                  <span className={styles.meta}>
                    {getRelativeTimeString(search.timestamp)}
                    {search.result_count !== undefined && (
                      <> • {search.result_count} {search.result_count === 1 ? 'result' : 'results'}</>
                    )}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.footer}>
        <span className={styles.footerText}>
          Press <kbd>↑</kbd> <kbd>↓</kbd> to navigate, <kbd>Enter</kbd> to select, <kbd>Esc</kbd> to close
        </span>
      </div>
    </div>
  );
}
