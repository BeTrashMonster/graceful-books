/**
 * ChecklistFilters Component
 *
 * Per CHECK-002: Filter by category/phase and view modes.
 *
 * Features:
 * - Category type filters
 * - Status filters (active, completed, snoozed)
 * - Priority filters
 * - Search functionality
 * - Accessible filter controls
 */

import { useState, useCallback } from 'react'
import clsx from 'clsx'
import type {
  ChecklistCategoryType,
  ChecklistViewMode,
  PriorityLevel,
} from '../../types/checklist.types'
import styles from './ChecklistFilters.module.css'

export interface ChecklistFiltersProps {
  /**
   * Current view mode
   */
  viewMode: ChecklistViewMode
  /**
   * Callback when view mode changes
   */
  onViewModeChange: (mode: ChecklistViewMode) => void
  /**
   * Current category filter
   */
  categoryFilter?: ChecklistCategoryType
  /**
   * Callback when category filter changes
   */
  onCategoryFilterChange: (category?: ChecklistCategoryType) => void
  /**
   * Current priority filter
   */
  priorityFilter?: PriorityLevel
  /**
   * Callback when priority filter changes
   */
  onPriorityFilterChange: (priority?: PriorityLevel) => void
  /**
   * Current search query
   */
  searchQuery?: string
  /**
   * Callback when search query changes
   */
  onSearchQueryChange: (query: string) => void
  /**
   * Item counts by view mode
   */
  counts?: {
    all: number
    active: number
    completed: number
    snoozed: number
  }
}

/**
 * Filter controls for checklist view
 */
export const ChecklistFilters = ({
  viewMode,
  onViewModeChange,
  categoryFilter,
  onCategoryFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  searchQuery = '',
  onSearchQueryChange,
  counts,
}: ChecklistFiltersProps) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // View mode options
  const viewModes: { value: ChecklistViewMode; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'snoozed', label: 'Snoozed' },
  ]

  // Category options
  const categoryOptions: { value: ChecklistCategoryType; label: string }[] = [
    { value: 'foundation', label: 'Foundation' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'annual', label: 'Annual' },
  ]

  // Priority options
  const priorityOptions: { value: PriorityLevel; label: string }[] = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ]

  // Handle clear all filters
  const handleClearFilters = useCallback(() => {
    onCategoryFilterChange(undefined)
    onPriorityFilterChange(undefined)
    onSearchQueryChange('')
  }, [onCategoryFilterChange, onPriorityFilterChange, onSearchQueryChange])

  // Check if any filters are active
  const hasActiveFilters = categoryFilter || priorityFilter || searchQuery

  return (
    <div className={styles.filtersContainer} role="search" aria-label="Checklist filters">
      {/* View Mode Tabs */}
      <div className={styles.viewModeTabs} role="tablist" aria-label="View mode">
        {viewModes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            role="tab"
            aria-selected={viewMode === mode.value}
            aria-controls="checklist-content"
            className={clsx(styles.viewModeTab, viewMode === mode.value && styles.viewModeTabActive)}
            onClick={() => onViewModeChange(mode.value)}
          >
            <span className={styles.tabLabel}>{mode.label}</span>
            {counts && (
              <span className={styles.tabCount} aria-label={`${counts[mode.value]} items`}>
                {counts[mode.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className={styles.searchBar}>
        <div className={styles.searchInput}>
          <svg
            className={styles.searchIcon}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            className={styles.searchField}
            placeholder="Search checklist items..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            aria-label="Search checklist items"
          />
        </div>

        <button
          type="button"
          className={clsx(styles.advancedToggle, showAdvancedFilters && styles.advancedToggleActive)}
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          aria-expanded={showAdvancedFilters}
          aria-label="Toggle advanced filters"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M3 6h18M8 12h8M11 18h2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Filters
        </button>
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className={styles.advancedFilters} role="group" aria-label="Advanced filters">
          {/* Category Filter */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Category</label>
            <div className={styles.filterButtons}>
              <button
                type="button"
                className={clsx(styles.filterButton, !categoryFilter && styles.filterButtonActive)}
                onClick={() => onCategoryFilterChange(undefined)}
              >
                All
              </button>
              {categoryOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={clsx(
                    styles.filterButton,
                    categoryFilter === option.value && styles.filterButtonActive,
                  )}
                  onClick={() => onCategoryFilterChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Filter */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Priority</label>
            <div className={styles.filterButtons}>
              <button
                type="button"
                className={clsx(styles.filterButton, !priorityFilter && styles.filterButtonActive)}
                onClick={() => onPriorityFilterChange(undefined)}
              >
                All
              </button>
              {priorityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={clsx(
                    styles.filterButton,
                    styles[`priority${option.label}`],
                    priorityFilter === option.value && styles.filterButtonActive,
                  )}
                  onClick={() => onPriorityFilterChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              className={styles.clearFilters}
              onClick={handleClearFilters}
              aria-label="Clear all filters"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}

ChecklistFilters.displayName = 'ChecklistFilters'
