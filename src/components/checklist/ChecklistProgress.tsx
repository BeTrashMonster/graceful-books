/**
 * ChecklistProgress Component
 *
 * Per CHECK-002: Visual progress bars by category with smooth animations
 * and completion percentages.
 *
 * Features:
 * - Animated progress bars
 * - Category breakdown
 * - Overall completion percentage
 * - Accessible progress indicators
 * - Reduced motion support
 */

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import type { ChecklistProgress as ChecklistProgressType } from '../../types/checklist.types'
import styles from './ChecklistProgress.module.css'

export interface ChecklistProgressProps {
  /**
   * Progress data
   */
  progress: ChecklistProgressType
  /**
   * Whether to show category breakdown
   */
  showCategoryBreakdown?: boolean
  /**
   * Whether to enable animations
   */
  enableAnimations?: boolean
  /**
   * Additional class name
   */
  className?: string
}

/**
 * Progress visualization component
 */
export const ChecklistProgress = ({
  progress,
  showCategoryBreakdown = true,
  enableAnimations = true,
  className,
}: ChecklistProgressProps) => {
  const [animatedPercent, setAnimatedPercent] = useState(0)

  // Animate progress on mount/update
  useEffect(() => {
    if (!enableAnimations) {
      setAnimatedPercent(progress.overall.percentComplete)
      return
    }

    // Animate from current to target
    const target = progress.overall.percentComplete
    const duration = 1000 // 1 second
    const steps = 60
    const increment = target / steps
    let current = 0

    const interval = setInterval(() => {
      current += increment
      if (current >= target) {
        setAnimatedPercent(target)
        clearInterval(interval)
      } else {
        setAnimatedPercent(Math.round(current))
      }
    }, duration / steps)

    return () => clearInterval(interval)
  }, [progress.overall.percentComplete, enableAnimations])

  // Get color based on progress
  const getProgressColor = (percent: number) => {
    if (percent >= 75) return 'success'
    if (percent >= 50) return 'primary'
    if (percent >= 25) return 'warning'
    return 'info'
  }

  // Format percentage
  const formatPercent = (percent: number) => {
    return Math.round(percent)
  }

  return (
    <div className={clsx(styles.progressContainer, className)} role="region" aria-label="Checklist progress">
      {/* Overall Progress */}
      <div className={styles.overallProgress}>
        <div className={styles.progressHeader}>
          <h3 className={styles.progressTitle}>Overall Progress</h3>
          <span className={styles.progressPercent} aria-live="polite">
            {formatPercent(animatedPercent)}%
          </span>
        </div>

        <div className={styles.progressStats}>
          <span className={styles.statText}>
            {progress.overall.completedItems} of {progress.overall.totalItems} completed
          </span>
        </div>

        <div
          className={styles.progressBar}
          role="progressbar"
          aria-valuenow={animatedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Overall progress: ${formatPercent(animatedPercent)} percent complete`}
        >
          <div
            className={clsx(
              styles.progressBarFill,
              styles[getProgressColor(animatedPercent)],
              enableAnimations && styles.animated,
            )}
            style={{ width: `${animatedPercent}%` }}
          />
        </div>

        {/* Encouraging message */}
        {progress.overall.percentComplete >= 0 && (
          <p className={styles.encouragement} role="status" aria-live="polite">
            {getEncouragingMessage(progress.overall.percentComplete)}
          </p>
        )}
      </div>

      {/* Category Breakdown */}
      {showCategoryBreakdown && Object.keys(progress.byCategory).length > 0 && (
        <div className={styles.categoryBreakdown}>
          <h4 className={styles.breakdownTitle}>By Category</h4>
          <div className={styles.categoryList}>
            {Object.entries(progress.byCategory).map(([categoryId, category]) => (
              <CategoryProgressBar
                key={categoryId}
                category={category}
                enableAnimations={enableAnimations}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Completions */}
      {progress.recentCompletions.length > 0 && (
        <div className={styles.recentCompletions}>
          <h4 className={styles.recentTitle}>Recently Completed</h4>
          <ul className={styles.recentList}>
            {progress.recentCompletions.slice(0, 3).map((completion) => (
              <li key={completion.item.id} className={styles.recentItem}>
                <span className={styles.recentCheckmark} aria-hidden="true">
                  ✓
                </span>
                <span className={styles.recentItemName}>{completion.item.title}</span>
                <span className={styles.recentCategory}>in {completion.categoryName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

ChecklistProgress.displayName = 'ChecklistProgress'

// =============================================================================
// Category Progress Bar Component
// =============================================================================

interface CategoryProgressBarProps {
  category: ChecklistProgressType['byCategory'][string]
  enableAnimations: boolean
}

const CategoryProgressBar = ({ category, enableAnimations }: CategoryProgressBarProps) => {
  const [animatedPercent, setAnimatedPercent] = useState(0)

  useEffect(() => {
    if (!enableAnimations) {
      setAnimatedPercent(category.percentComplete)
      return
    }

    const target = category.percentComplete
    const duration = 800
    const steps = 40
    const increment = target / steps
    let current = 0

    const interval = setInterval(() => {
      current += increment
      if (current >= target) {
        setAnimatedPercent(target)
        clearInterval(interval)
      } else {
        setAnimatedPercent(Math.round(current))
      }
    }, duration / steps)

    return () => clearInterval(interval)
  }, [category.percentComplete, enableAnimations])

  // Get trend icon
  const getTrendIcon = () => {
    switch (category.trend) {
      case 'improving':
        return '↗'
      case 'declining':
        return '↘'
      case 'stable':
      default:
        return '→'
    }
  }

  // Get trend color
  const getTrendColor = () => {
    switch (category.trend) {
      case 'improving':
        return styles.trendImproving
      case 'declining':
        return styles.trendDeclining
      case 'stable':
      default:
        return styles.trendStable
    }
  }

  return (
    <div className={styles.categoryProgress}>
      <div className={styles.categoryHeader}>
        <span className={styles.categoryName}>{category.name}</span>
        <div className={styles.categoryStats}>
          <span
            className={clsx(styles.trendIcon, getTrendColor())}
            aria-label={`Trend: ${category.trend}`}
          >
            {getTrendIcon()}
          </span>
          <span className={styles.categoryPercent}>
            {Math.round(animatedPercent)}%
          </span>
        </div>
      </div>

      <div
        className={styles.categoryBar}
        role="progressbar"
        aria-valuenow={animatedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${category.name}: ${Math.round(animatedPercent)} percent complete`}
      >
        <div
          className={clsx(
            styles.categoryBarFill,
            enableAnimations && styles.animated,
          )}
          style={{ width: `${animatedPercent}%` }}
        />
      </div>

      <div className={styles.categoryInfo}>
        <span className={styles.categoryCount}>
          {category.completedItems} / {category.totalItems} items
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get encouraging message based on progress
 * Per Steadiness communication: Patient, supportive, not rushed
 */
function getEncouragingMessage(percent: number): string {
  if (percent === 0) {
    return "Ready to get started? Check off your first task!"
  }
  if (percent < 10) {
    return "Great start! Every journey begins with a single step."
  }
  if (percent < 25) {
    return "You're building momentum. Keep going!"
  }
  if (percent < 50) {
    return "Look at you go! You're making real progress."
  }
  if (percent < 75) {
    return "More than halfway there! Your financial foundation is taking shape."
  }
  if (percent < 100) {
    return "Almost there! You're doing amazing work."
  }
  return "Foundation complete! You're ready to build."
}
