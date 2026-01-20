import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { createMentionsService } from '../../services/mentions.service'
import styles from './MentionBadge.module.css'

export interface MentionBadgeProps {
  /**
   * User ID to show mentions for
   */
  userId: string
  /**
   * Company ID
   */
  companyId: string
  /**
   * Device ID for CRDT operations
   */
  deviceId: string
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
   * Visual variant
   */
  variant?: 'inline' | 'floating'
  /**
   * Show zero count (default: hide badge when 0)
   */
  showZero?: boolean
}

/**
 * MentionBadge component displays unread @mention count
 *
 * Features:
 * - Real-time count updates via polling
 * - Keyboard accessible (Enter/Space activation)
 * - Screen reader announcements with aria-live
 * - WCAG 2.1 AA compliant (color contrast, focus indicators)
 * - Hides automatically when count is 0 (unless showZero=true)
 * - Touch-friendly minimum size (44x44px)
 * - Steadiness communication style
 *
 * @example
 * ```tsx
 * <MentionBadge
 *   userId="user-123"
 *   companyId="company-123"
 *   deviceId="device-456"
 *   onClick={handleOpenMentionsList}
 * />
 * ```
 */
export function MentionBadge({
  userId,
  companyId,
  deviceId,
  onClick,
  className,
  size = 'md',
  variant = 'inline',
  showZero = false,
}: MentionBadgeProps) {
  const [mentionCount, setMentionCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Load unread mention count
  useEffect(() => {
    let isMounted = true

    async function loadMentionCount() {
      try {
        const mentionsService = createMentionsService(companyId, deviceId)
        const count = await mentionsService.getUnreadMentionCount(userId)

        if (isMounted) {
          setMentionCount(count)
          setIsLoading(false)
          setError(null)
        }
      } catch (err) {
        console.error('Failed to load mention count:', err)
        if (isMounted) {
          setError('Failed to load mentions')
          setIsLoading(false)
        }
      }
    }

    loadMentionCount()

    // Poll for updates every 30 seconds
    const interval = setInterval(loadMentionCount, 30000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [userId, companyId, deviceId])

  // Don't render if no mentions and not showing zero
  if (mentionCount === 0 && !isLoading && !showZero) {
    return null
  }

  const handleClick = () => {
    if (onClick && mentionCount > 0) {
      onClick()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick && mentionCount > 0) {
      e.preventDefault()
      onClick()
    }
  }

  const ariaLabel = mentionCount === 1
    ? '1 unread mention. Click to view details.'
    : `${mentionCount} unread mentions. Click to view details.`

  return (
    <div
      className={clsx(
        styles.badge,
        styles[size],
        styles[variant],
        onClick && mentionCount > 0 && styles.clickable,
        isLoading && styles.loading,
        error && styles.error,
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : 'status'}
      tabIndex={onClick && mentionCount > 0 ? 0 : undefined}
      aria-label={ariaLabel}
      aria-live="polite"
      aria-atomic="true"
    >
      {isLoading ? (
        <span className={styles.spinner} aria-hidden="true">
          <span className={styles.spinnerCircle} />
        </span>
      ) : error ? (
        <>
          <svg
            className={styles.icon}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span className={styles.errorText}>Error</span>
        </>
      ) : (
        <>
          <svg
            className={styles.icon}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
          <span className={styles.count}>{mentionCount}</span>
          <span className={styles.srOnly}>
            {mentionCount === 1
              ? 'You have 1 unread mention'
              : `You have ${mentionCount} unread mentions`}
          </span>
        </>
      )}
    </div>
  )
}
