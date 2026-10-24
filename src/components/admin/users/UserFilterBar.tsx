/**
 * UserFilterBar Component
 *
 * Filter bar for user list with search, dropdown filters, and toggle buttons.
 * Supports: search, product, workshop, status, isBeta, needsAttention, tag
 */

import { useState, useEffect } from 'react';
import styles from './UserFilterBar.module.css';

export interface UserFilters {
  search: string;
  product: string;
  workshop: string;
  status: string;
  isBeta: boolean;
  needsAttention: boolean;
  emailSuppressed: boolean;
  tag: string;
}

export interface FilterOptions {
  products: Array<{ slug: string; name: string }>;
  workshops: Array<{ id: string; name: string }>;
  tags: Array<{ tag: string; userCount: number }>;
}

interface UserFilterBarProps {
  filters: UserFilters;
  options: FilterOptions;
  onFilterChange: (filters: UserFilters) => void;
  isLoading?: boolean;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'trial', label: 'Trial' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'payment', label: 'Payment Issue' },
];

export function UserFilterBar({
  filters,
  options,
  onFilterChange,
  isLoading = false,
}: UserFilterBarProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.search) {
        onFilterChange({ ...filters, search: localSearch });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, filters, onFilterChange]);

  const handleChange = (key: keyof UserFilters, value: string | boolean) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    setLocalSearch('');
    onFilterChange({
      search: '',
      product: '',
      workshop: '',
      status: '',
      isBeta: false,
      needsAttention: false,
      emailSuppressed: false,
      tag: '',
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.product ||
    filters.workshop ||
    filters.status ||
    filters.isBeta ||
    filters.needsAttention ||
    filters.emailSuppressed ||
    filters.tag;

  return (
    <div className={styles.container}>
      {/* Search */}
      <div className={styles.searchRow}>
        <label htmlFor="user-search" className={styles.visuallyHidden}>
          Search users
        </label>
        <input
          id="user-search"
          type="search"
          className={styles.searchInput}
          placeholder="Search by name, email, or support key..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          disabled={isLoading}
        />
      </div>

      {/* Filter row */}
      <div className={styles.filterRow}>
        {/* Product dropdown */}
        <div className={styles.filterGroup}>
          <label htmlFor="filter-product" className={styles.visuallyHidden}>
            Filter by product
          </label>
          <select
            id="filter-product"
            className={styles.select}
            value={filters.product}
            onChange={(e) => handleChange('product', e.target.value)}
            disabled={isLoading}
          >
            <option value="">All Products</option>
            {options.products.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Workshop dropdown */}
        <div className={styles.filterGroup}>
          <label htmlFor="filter-workshop" className={styles.visuallyHidden}>
            Filter by workshop
          </label>
          <select
            id="filter-workshop"
            className={styles.select}
            value={filters.workshop}
            onChange={(e) => handleChange('workshop', e.target.value)}
            disabled={isLoading}
          >
            <option value="">All Workshops</option>
            <option value="any">Any Workshop</option>
            {options.workshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status dropdown */}
        <div className={styles.filterGroup}>
          <label htmlFor="filter-status" className={styles.visuallyHidden}>
            Filter by status
          </label>
          <select
            id="filter-status"
            className={styles.select}
            value={filters.status}
            onChange={(e) => handleChange('status', e.target.value)}
            disabled={isLoading}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tag dropdown */}
        {options.tags.length > 0 && (
          <div className={styles.filterGroup}>
            <label htmlFor="filter-tag" className={styles.visuallyHidden}>
              Filter by tag
            </label>
            <select
              id="filter-tag"
              className={styles.select}
              value={filters.tag}
              onChange={(e) => handleChange('tag', e.target.value)}
              disabled={isLoading}
            >
              <option value="">All Tags</option>
              {options.tags.map((t) => (
                <option key={t.tag} value={t.tag}>
                  {t.tag} ({t.userCount})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Toggle buttons */}
        <div className={styles.toggleGroup}>
          <button
            type="button"
            className={`${styles.toggleButton} ${filters.isBeta ? styles.active : ''}`}
            onClick={() => handleChange('isBeta', !filters.isBeta)}
            disabled={isLoading}
            aria-pressed={filters.isBeta}
          >
            Beta
          </button>
          <button
            type="button"
            className={`${styles.toggleButton} ${styles.attention} ${filters.needsAttention ? styles.active : ''}`}
            onClick={() => handleChange('needsAttention', !filters.needsAttention)}
            disabled={isLoading}
            aria-pressed={filters.needsAttention}
          >
            Needs Attention
          </button>
          <button
            type="button"
            className={`${styles.toggleButton} ${filters.emailSuppressed ? styles.active : ''}`}
            onClick={() => handleChange('emailSuppressed', !filters.emailSuppressed)}
            disabled={isLoading}
            aria-pressed={filters.emailSuppressed}
          >
            Email Issues
          </button>
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={clearFilters}
            disabled={isLoading}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
