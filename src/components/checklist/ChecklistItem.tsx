/**
 * ChecklistItem Component
 *
 * Per CHECK-002: Individual checklist item with interactive checkbox,
 * snooze functionality, "not applicable" option, and feature linking.
 *
 * Features:
 * - Satisfying checkbox animation on check
 * - Keyboard navigation (Space to check, Enter to open)
 * - ARIA labels for screen readers
 * - Action menu for snooze/not applicable
 * - Link to relevant features
 * - Recurrence badge display
 */

import { useState, useCallback, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import { format } from 'date-fns'
import type { ChecklistItem as ChecklistItemType } from '../../types/checklist.types'
import { Button } from '../core/Button'
import styles from './ChecklistItem.module.css'

export interface ChecklistItemProps {
  /**
   * Checklist item data
   */
  item: ChecklistItemType
  /**
   * Callback when item is completed
   */
  onComplete: (itemId: string) => void
  /**
   * Callback when item is uncompleted
   */
  onUncomplete: (itemId: string) => void
  /**
   * Callback when item is snoozed
   */
  onSnooze: (itemId: string) => void
  /**
   * Callback when item is marked not applicable
   */
  onMarkNotApplicable: (itemId: string) => void
  /**
   * Callback when custom item is deleted
   */
  onDelete?: (itemId: string) => void
  /**
   * Callback when feature link is clicked
   */
  onFeatureLinkClick?: (link: string) => void
  /**
   * Whether animations are enabled
   */
  enableAnimations?: boolean
}

/**
 * Individual checklist item with checkbox and actions
 */
export const ChecklistItem = ({
  item,
  onComplete,
  onUncomplete,
  onSnooze,
  onMarkNotApplicable,
  onDelete,
  onFeatureLinkClick,
  enableAnimations = true,
}: ChecklistItemProps) => {
  const [showActions, setShowActions] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  const isCompleted = item.status === 'completed'
  const isSnoozed = item.status === 'snoozed'
  const isNotApplicable = item.status === 'not-applicable'
  const isActive = item.status === 'active'

  // Handle checkbox toggle
  const handleToggle = useCallback(() => {
    if (isCompleted) {
      onUncomplete(item.id)
    } else if (isActive || isSnoozed) {
      // Trigger animation before completing
      if (enableAnimations) {
        setIsAnimating(true)
        setTimeout(() => {
          onComplete(item.id)
          setIsAnimating(false)
        }, 300)
      } else {
        onComplete(item.id)
      }
    }
  }, [item.id, isCompleted, isActive, isSnoozed, onComplete, onUncomplete, enableAnimations])

  // Handle keyboard interaction
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Space to toggle checkbox
      if (e.key === ' ' && !isNotApplicable) {
        e.preventDefault()
        handleToggle()
      }
      // Enter to show actions menu
      if (e.key === 'Enter') {
        e.preventDefault()
        setShowActions(!showActions)
      }
    },
    [handleToggle, showActions, isNotApplicable],
  )

  // Handle feature link click
  const handleFeatureLinkClick = useCallback(() => {
    if (item.featureLink && onFeatureLinkClick) {
      onFeatureLinkClick(item.featureLink)
    }
  }, [item.featureLink, onFeatureLinkClick])

  // Format due date
  const formatDueDate = (date: Date | null) => {
    if (!date) return null
    return format(date, 'MMM d, yyyy')
  }

  // Get recurrence badge text
  const getRecurrenceBadge = () => {
    if (item.recurrence === 'once') return null
    return item.recurrence.charAt(0).toUpperCase() + item.recurrence.slice(1)
  }

  // Get priority indicator
  const getPriorityClass = () => {
    switch (item.priority) {
      case 'high':
        return styles.priorityHigh
      case 'medium':
        return styles.priorityMedium
      case 'low':
        return styles.priorityLow
      default:
        return ''
    }
  }

  return (
    <div
      className={clsx(
        styles.checklistItem,
        isCompleted && styles.completed,
        isSnoozed && styles.snoozed,
        isNotApplicable && styles.notApplicable,
        isAnimating && styles.animating,
      )}
      role="article"
      aria-label={`Checklist item: ${item.title}`}
    >
      <div className={styles.itemMain}>
        {/* Checkbox */}
        {!isNotApplicable && (
          <button
            type="button"
            className={clsx(
              styles.checkbox,
              isCompleted && styles.checkboxCompleted,
              getPriorityClass(),
            )}
            onClick={handleToggle}
            onKeyDown={handleKeyDown}
            role="checkbox"
            aria-checked={isCompleted}
            aria-label={isCompleted ? `Uncheck ${item.title}` : `Check ${item.title}`}
            tabIndex={0}
          >
            <span className={styles.checkboxBox}>
              {isCompleted && (
                <svg
                  className={styles.checkIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
          </button>
        )}

        {/* Content */}
        <div className={styles.itemContent}>
          <div className={styles.itemHeader}>
            <h3 className={styles.itemTitle}>{item.title}</h3>
            <div className={styles.badges}>
              {getRecurrenceBadge() && (
                <span className={styles.badge} aria-label={`Recurrence: ${item.recurrence}`}>
                  {getRecurrenceBadge()}
                </span>
              )}
              {item.isCustom && (
                <span
                  className={clsx(styles.badge, styles.badgeCustom)}
                  aria-label="Custom item"
                >
                  Custom
                </span>
              )}
              {isSnoozed && item.snoozedUntil && (
                <span
                  className={clsx(styles.badge, styles.badgeSnoozed)}
                  aria-label={`Snoozed until ${formatDueDate(item.snoozedUntil)}`}
                >
                  Snoozed until {formatDueDate(item.snoozedUntil)}
                </span>
              )}
            </div>
          </div>

          <p className={styles.itemDescription}>{item.description}</p>

          {/* Due date for recurring items */}
          {item.nextDueDate && (
            <p className={styles.dueDate} aria-label={`Due date: ${formatDueDate(item.nextDueDate)}`}>
              Due: {formatDueDate(item.nextDueDate)}
            </p>
          )}

          {/* Feature link */}
          {item.featureLink && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFeatureLinkClick}
              className={styles.featureLink}
              aria-label={`Go to ${item.title} feature`}
            >
              Go to feature →
            </Button>
          )}

          {/* Not applicable reason */}
          {isNotApplicable && item.notApplicableReason && (
            <p className={styles.notApplicableReason} role="note">
              Not applicable: {item.notApplicableReason}
            </p>
          )}
        </div>

        {/* Actions menu */}
        <div className={styles.itemActions}>
          <button
            type="button"
            className={styles.actionsToggle}
            onClick={() => setShowActions(!showActions)}
            aria-label="Show actions menu"
            aria-expanded={showActions}
            aria-haspopup="menu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="12" cy="6" r="2" fill="currentColor" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <circle cx="12" cy="18" r="2" fill="currentColor" />
            </svg>
          </button>

          {showActions && (
            <div className={styles.actionsMenu} role="menu">
              {!isCompleted && !isSnoozed && (
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => {
                    onSnooze(item.id)
                    setShowActions(false)
                  }}
                  role="menuitem"
                >
                  Snooze
                </button>
              )}

              {!isNotApplicable && (
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => {
                    onMarkNotApplicable(item.id)
                    setShowActions(false)
                  }}
                  role="menuitem"
                >
                  Not applicable
                </button>
              )}

              {item.isCustom && onDelete && (
                <button
                  type="button"
                  className={clsx(styles.actionButton, styles.actionButtonDanger)}
                  onClick={() => {
                    onDelete(item.id)
                    setShowActions(false)
                  }}
                  role="menuitem"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

ChecklistItem.displayName = 'ChecklistItem'
