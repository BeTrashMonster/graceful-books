/**
 * ChecklistView Component
 *
 * Per CHECK-002: Main container for checklist with all interactive features.
 *
 * Features:
 * - Category-based organization
 * - Progress tracking
 * - Filtering and search
 * - Item management (complete, snooze, not applicable)
 * - Confetti celebrations on completion
 * - Streak tracking display
 */

import { useState, useCallback, useMemo } from 'react'
import clsx from 'clsx'
import type {
  ChecklistProfile,
  ChecklistCategory,
  ChecklistItem as ChecklistItemType,
  ChecklistViewMode,
  ChecklistCategoryType,
  PriorityLevel,
  ChecklistProgress as ChecklistProgressType,
} from '../../types/checklist.types'
import { ChecklistItem } from './ChecklistItem'
import { ChecklistProgress } from './ChecklistProgress'
import { ChecklistFilters } from './ChecklistFilters'
import { StreakIndicator } from './StreakIndicator'
import { SnoozeModal } from './SnoozeModal'
import { Loading } from '../feedback/Loading'
import { triggerSubtleConfetti } from '../../utils/confetti'
import styles from './ChecklistView.module.css'

export interface ChecklistViewProps {
  /**
   * Checklist profile data
   */
  profile: ChecklistProfile | null
  /**
   * Whether data is loading
   */
  isLoading?: boolean
  /**
   * Callback when item is completed
   */
  onCompleteItem: (itemId: string) => void
  /**
   * Callback when item is uncompleted
   */
  onUncompleteItem: (itemId: string) => void
  /**
   * Callback when item is snoozed
   */
  onSnoozeItem: (itemId: string, until: Date, reason?: string) => void
  /**
   * Callback when item is marked not applicable
   */
  onMarkNotApplicable: (itemId: string, reason: string) => void
  /**
   * Callback when custom item is deleted
   */
  onDeleteCustomItem?: (itemId: string) => void
  /**
   * Callback when feature link is clicked
   */
  onFeatureLinkClick?: (link: string) => void
  /**
   * Whether to enable animations
   */
  enableAnimations?: boolean
}

/**
 * Main checklist view component
 */
export const ChecklistView = ({
  profile,
  isLoading = false,
  onCompleteItem,
  onUncompleteItem,
  onSnoozeItem,
  onMarkNotApplicable,
  onDeleteCustomItem,
  onFeatureLinkClick,
  enableAnimations = true,
}: ChecklistViewProps) => {
  // State
  const [viewMode, setViewMode] = useState<ChecklistViewMode>('active')
  const [categoryFilter, setCategoryFilter] = useState<ChecklistCategoryType | undefined>()
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | undefined>()
  const [searchQuery, setSearchQuery] = useState('')
  const [snoozeModalOpen, setSnoozeModalOpen] = useState(false)
  const [selectedItemForSnooze, setSelectedItemForSnooze] = useState<ChecklistItemType | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Handle item completion with confetti
  const handleCompleteItem = useCallback(
    (itemId: string) => {
      onCompleteItem(itemId)
      if (enableAnimations) {
        triggerSubtleConfetti()
      }
    },
    [onCompleteItem, enableAnimations],
  )

  // Handle snooze modal
  const handleOpenSnoozeModal = useCallback((itemId: string) => {
    const item = profile?.categories
      .flatMap((cat) => cat.items)
      .find((i) => i.id === itemId)
    if (item) {
      setSelectedItemForSnooze(item)
      setSnoozeModalOpen(true)
    }
  }, [profile])

  const handleConfirmSnooze = useCallback(
    (until: Date, reason?: string) => {
      if (selectedItemForSnooze) {
        onSnoozeItem(selectedItemForSnooze.id, until, reason)
      }
      setSnoozeModalOpen(false)
      setSelectedItemForSnooze(null)
    },
    [selectedItemForSnooze, onSnoozeItem],
  )

  // Handle not applicable (TODO: Create modal for confirmation)
  const handleMarkNotApplicable = useCallback(
    (itemId: string) => {
      const reason = prompt('Why is this item not applicable?')
      if (reason) {
        onMarkNotApplicable(itemId, reason)
      }
    },
    [onMarkNotApplicable],
  )

  // Toggle category expansion
  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }, [])

  // Filter items
  const filteredCategories = useMemo(() => {
    if (!profile) return []

    return profile.categories
      .map((category) => {
        const filteredItems = category.items.filter((item) => {
          // View mode filter
          if (viewMode === 'active' && item.status !== 'active') return false
          if (viewMode === 'completed' && item.status !== 'completed') return false
          if (viewMode === 'snoozed' && item.status !== 'snoozed') return false

          // Category filter
          if (categoryFilter && category.type !== categoryFilter) return false

          // Priority filter
          if (priorityFilter && item.priority !== priorityFilter) return false

          // Search filter
          if (searchQuery) {
            const query = searchQuery.toLowerCase()
            return (
              item.title.toLowerCase().includes(query) ||
              item.description.toLowerCase().includes(query)
            )
          }

          return true
        })

        return {
          ...category,
          items: filteredItems,
        }
      })
      .filter((category) => category.items.length > 0)
  }, [profile, viewMode, categoryFilter, priorityFilter, searchQuery])

  // Calculate progress
  const progress = useMemo<ChecklistProgressType | null>(() => {
    if (!profile) return null

    const allItems = profile.categories.flatMap((cat) => cat.items)
    const completedItems = allItems.filter((item) => item.status === 'completed')

    const byCategory: Record<string, ChecklistProgressType['byCategory'][string]> = {}
    profile.categories.forEach((category) => {
      const catCompleted = category.items.filter((item) => item.status === 'completed').length
      byCategory[category.id] = {
        name: category.name,
        totalItems: category.items.length,
        completedItems: catCompleted,
        percentComplete: (catCompleted / category.items.length) * 100,
        trend: 'stable', // TODO: Calculate trend
      }
    })

    return {
      overall: {
        totalItems: allItems.length,
        completedItems: completedItems.length,
        percentComplete: (completedItems.length / allItems.length) * 100,
      },
      byCategory,
      recentCompletions: completedItems
        .slice(-5)
        .reverse()
        .map((item) => ({
          item,
          completedAt: item.completedAt || new Date(),
          categoryName:
            profile.categories.find((cat) => cat.id === item.categoryId)?.name || 'Unknown',
        })),
      upcomingDue: [], // TODO: Calculate upcoming due items
    }
  }, [profile])

  // Calculate counts for filters
  const counts = useMemo(() => {
    if (!profile) return { all: 0, active: 0, completed: 0, snoozed: 0 }

    const allItems = profile.categories.flatMap((cat) => cat.items)
    return {
      all: allItems.length,
      active: allItems.filter((item) => item.status === 'active').length,
      completed: allItems.filter((item) => item.status === 'completed').length,
      snoozed: allItems.filter((item) => item.status === 'snoozed').length,
    }
  }, [profile])

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Loading message="Loading your checklist..." size="lg" centered />
      </div>
    )
  }

  // No profile state
  if (!profile) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>
          No checklist found. Complete your assessment to generate a personalized checklist.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.checklistView}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2 className={styles.title}>Your Checklist</h2>
          <p className={styles.subtitle}>
            Take your time with this. We'll guide you through everything, step by step.
          </p>
        </div>
      </div>

      {/* Filters */}
      <ChecklistFilters
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        counts={counts}
      />

      {/* Content Grid */}
      <div className={styles.contentGrid}>
        {/* Main Content */}
        <div className={styles.mainContent}>
          {/* Categories */}
          {filteredCategories.length === 0 ? (
            <div className={styles.noResults}>
              <p className={styles.noResultsText}>
                No items found matching your filters. Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <div className={styles.categoriesList}>
              {filteredCategories.map((category) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  isExpanded={expandedCategories.has(category.id)}
                  onToggle={() => toggleCategory(category.id)}
                  onCompleteItem={handleCompleteItem}
                  onUncompleteItem={onUncompleteItem}
                  onSnoozeItem={handleOpenSnoozeModal}
                  onMarkNotApplicable={handleMarkNotApplicable}
                  onDeleteCustomItem={onDeleteCustomItem}
                  onFeatureLinkClick={onFeatureLinkClick}
                  enableAnimations={enableAnimations}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          {/* Progress */}
          {progress && (
            <ChecklistProgress
              progress={progress}
              showCategoryBreakdown
              enableAnimations={enableAnimations}
            />
          )}

          {/* Streaks */}
          <StreakIndicator streaks={profile.streaks} showEncouragement />
        </div>
      </div>

      {/* Snooze Modal */}
      <SnoozeModal
        isOpen={snoozeModalOpen}
        itemTitle={selectedItemForSnooze?.title || ''}
        onConfirm={handleConfirmSnooze}
        onClose={() => setSnoozeModalOpen(false)}
      />
    </div>
  )
}

ChecklistView.displayName = 'ChecklistView'

// =============================================================================
// CategorySection Component
// =============================================================================

interface CategorySectionProps {
  category: ChecklistCategory
  isExpanded: boolean
  onToggle: () => void
  onCompleteItem: (itemId: string) => void
  onUncompleteItem: (itemId: string) => void
  onSnoozeItem: (itemId: string) => void
  onMarkNotApplicable: (itemId: string) => void
  onDeleteCustomItem?: (itemId: string) => void
  onFeatureLinkClick?: (link: string) => void
  enableAnimations: boolean
}

const CategorySection = ({
  category,
  isExpanded,
  onToggle,
  onCompleteItem,
  onUncompleteItem,
  onSnoozeItem,
  onMarkNotApplicable,
  onDeleteCustomItem,
  onFeatureLinkClick,
  enableAnimations,
}: CategorySectionProps) => {
  return (
    <div className={styles.categorySection}>
      <button
        type="button"
        className={styles.categoryHeader}
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <div className={styles.categoryTitle}>
          <h3 className={styles.categoryName}>{category.name}</h3>
          <span className={styles.categoryCount}>
            {category.completedItems} / {category.totalItems}
          </span>
        </div>
        <svg
          className={clsx(styles.expandIcon, isExpanded && styles.expandIconOpen)}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {isExpanded && (
        <div className={styles.categoryContent}>
          {category.description && (
            <p className={styles.categoryDescription}>{category.description}</p>
          )}
          <div className={styles.itemsList}>
            {category.items.map((item) => (
              <ChecklistItem
                key={item.id}
                item={item}
                onComplete={onCompleteItem}
                onUncomplete={onUncompleteItem}
                onSnooze={onSnoozeItem}
                onMarkNotApplicable={onMarkNotApplicable}
                onDelete={onDeleteCustomItem}
                onFeatureLinkClick={onFeatureLinkClick}
                enableAnimations={enableAnimations}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
