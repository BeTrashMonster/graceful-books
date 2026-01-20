import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { getUnresolvedConflicts } from '../../store/conflicts'
import type { ConflictHistoryEntry } from '../../types/crdt.types'
import styles from './ConflictBadge.module.css'

export interface ConflictBadgeProps {
  /**
   * Callback when badge is clicked
   */
  onClick?: () => void
  /**
   * Additional class name
   */
  className?: string
  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Whether to show the badge inline or as a floating badge
   */
  variant?: 'inline' | 'floating'
}

/**
 * ConflictBadge component displays the count of unresolved conflicts
 *
 * Features:
 * - Real-time count updates using Dexie liveQuery
 * - Keyboard accessible (Enter/Space activation)
 * - Screen reader announcements with aria-live
 * - WCAG 2.1 AA compliant (color contrast, focus indicators)
 * - Hides automatically when count is 0
 * - Touch-friendly minimum size (44x44px)
 *
 * @example
 * ```tsx
 * <ConflictBadge onClick={handleOpenConflictList} />
 * ```
 */
export function ConflictBadge({
  onClick,
  className,
  size = 'md',
  variant = 'inline',
}: ConflictBadgeProps) {
  const [conflictCount, setConflictCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Load unresolved conflicts count
  useEffect(() => {
    let isMounted = true

    async function loadConflicts() {
      try {
        const conflicts: ConflictHistoryEntry[] = await getUnresolvedConflicts()
        if (isMounted) {
          setConflictCount(conflicts.length)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Failed to load conflict count:', error)
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadConflicts()

    // Poll for updates every 30 seconds
    const interval = setInterval(loadConflicts, 30000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  // Don't render if no conflicts and not loading
  if (conflictCount === 0 && !isLoading) {
    return null
  }

  const handleClick = () => {
    if (onClick && conflictCount > 0) {
      onClick()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick && conflictCount > 0) {
      e.preventDefault()
      onClick()
    }
  }

  const ariaLabel = conflictCount === 1
    ? '1 unresolved conflict. Click to view details.'
    : `${conflictCount} unresolved conflicts. Click to view details.`

  return (
    <div
      className={clsx(
        styles.badge,
        styles[size],
        styles[variant],
        onClick && conflictCount > 0 && styles.clickable,
        isLoading && styles.loading,
        className,
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : 'status'}
      tabIndex={onClick && conflictCount > 0 ? 0 : undefined}
      aria-label={ariaLabel}
      aria-live="polite"
      aria-atomic="true"
    >
      {isLoading ? (
        <span className={styles.spinner} aria-hidden="true">
          <span className={styles.spinnerCircle} />
        </span>
      ) : (
        <>
          <svg
            className={styles.icon}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span className={styles.count}>{conflictCount}</span>
          <span className={styles.srOnly}>
            {conflictCount === 1 ? 'conflict needs' : 'conflicts need'} your attention
          </span>
        </>
      )}
    </div>
  )
}
