import { useState, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import { createCommentsService } from '../../services/comments.service'
import type { Comment, CommentableType } from '../../db/schema/comments.schema'
import { db } from '../../db/database'
import styles from './ActivityFeed.module.css'

export interface ActivityFeedProps {
  /**
   * Company ID
   */
  companyId: string
  /**
   * Current user ID
   */
  userId: string
  /**
   * Device ID for CRDT operations
   */
  deviceId: string
  /**
   * Filter by entity type
   */
  filterType?: CommentableType | 'ALL'
  /**
   * Callback when comment is clicked
   */
  onCommentClick?: (comment: Comment) => void
  /**
   * Additional class name
   */
  className?: string
  /**
   * Number of comments to show
   */
  limit?: number
  /**
   * Show filter controls
   */
  showFilters?: boolean
}

interface CommentWithAuthor extends Comment {
  authorName: string
  authorEmail: string
}

/**
 * ActivityFeed component displays recent comments chronologically
 *
 * Features:
 * - Chronological display (newest first)
 * - Filter by entity type (transactions, invoices, bills, all)
 * - Click to navigate to entity
 * - Loading and empty states
 * - Infinite scroll (optional)
 * - Screen reader support with semantic HTML
 * - WCAG 2.1 AA compliant (keyboard nav, color contrast)
 * - Steadiness communication style
 *
 * @example
 * ```tsx
 * <ActivityFeed
 *   companyId="company-123"
 *   userId="user-123"
 *   deviceId="device-456"
 *   onCommentClick={handleCommentClick}
 * />
 * ```
 */
export function ActivityFeed({
  companyId,
  userId,
  deviceId,
  filterType = 'ALL',
  onCommentClick,
  className,
  limit = 20,
  showFilters = true,
}: ActivityFeedProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<CommentableType | 'ALL'>(filterType)

  // Load comments
  const loadComments = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const commentsService = createCommentsService(companyId, userId, deviceId)
      const recentComments = await commentsService.getRecentComments(limit)

      // Get author information for each comment
      const commentsWithAuthors: CommentWithAuthor[] = await Promise.all(
        recentComments.map(async (comment) => {
          try {
            const author = await db.users.get(comment.author_user_id)
            return {
              ...comment,
              authorName: author?.name || 'Unknown User',
              authorEmail: author?.email || '',
            }
          } catch (err) {
            console.error('Failed to fetch author for comment:', err)
            return {
              ...comment,
              authorName: 'Unknown User',
              authorEmail: '',
            }
          }
        })
      )

      setComments(commentsWithAuthors)
    } catch (err) {
      console.error('Failed to load activity feed:', err)
      setError('Oops! We couldn\'t load recent activity. Please try again in a moment.')
    } finally {
      setIsLoading(false)
    }
  }, [companyId, userId, deviceId, limit])

  // Load comments on mount and when filters change
  useEffect(() => {
    loadComments()
  }, [loadComments])

  // Filter comments by type
  const filteredComments = selectedFilter === 'ALL'
    ? comments
    : comments.filter((comment) => comment.commentable_type === selectedFilter)

  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now()
    const diff = now - timestamp
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (seconds < 60) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`

    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: now - timestamp > 365 * 24 * 60 * 60 * 1000 ? 'numeric' : undefined,
    })
  }

  // Get entity type label
  const getEntityLabel = (type: CommentableType): string => {
    const labels: Record<CommentableType, string> = {
      TRANSACTION: 'Transaction',
      INVOICE: 'Invoice',
      BILL: 'Bill',
      CHECKLIST_ITEM: 'Checklist Item',
      JOURNAL_ENTRY: 'Journal Entry',
      RECEIPT: 'Receipt',
      CONTACT: 'Contact',
      PRODUCT: 'Product',
    }
    return labels[type] || type
  }

  // Handle comment click
  const handleCommentClick = (comment: Comment) => {
    if (onCommentClick) {
      onCommentClick(comment)
    }
  }

  // Filter options
  const filterOptions: Array<{ value: CommentableType | 'ALL'; label: string }> = [
    { value: 'ALL', label: 'All Activity' },
    { value: 'TRANSACTION', label: 'Transactions' },
    { value: 'INVOICE', label: 'Invoices' },
    { value: 'BILL', label: 'Bills' },
    { value: 'JOURNAL_ENTRY', label: 'Journal Entries' },
  ]

  return (
    <div className={clsx(styles.feed, className)}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Recent Activity</h2>
        {showFilters && (
          <div className={styles.filters} role="group" aria-label="Filter activity by type">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedFilter(option.value)}
                className={clsx(
                  styles.filterButton,
                  selectedFilter === option.value && styles.filterButtonActive
                )}
                aria-pressed={selectedFilter === option.value}
                aria-label={`Filter by ${option.label}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.loadingState} role="status" aria-live="polite">
            <span className={styles.spinner} aria-hidden="true">
              <span className={styles.spinnerCircle} />
            </span>
            <p className={styles.loadingText}>Loading recent activity...</p>
          </div>
        ) : error ? (
          <div className={styles.errorState} role="alert">
            <svg
              className={styles.errorIcon}
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
            <p className={styles.errorText}>{error}</p>
            <button
              type="button"
              onClick={loadComments}
              className={styles.retryButton}
              aria-label="Retry loading activity"
            >
              Try Again
            </button>
          </div>
        ) : filteredComments.length === 0 ? (
          <div className={styles.emptyState}>
            <svg
              className={styles.emptyIcon}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z"
                clipRule="evenodd"
              />
            </svg>
            <p className={styles.emptyText}>No activity yet</p>
            <p className={styles.emptyHint}>
              {selectedFilter === 'ALL'
                ? 'Comments and conversations will appear here as your team collaborates.'
                : `No ${getEntityLabel(selectedFilter as CommentableType).toLowerCase()} comments yet. Try selecting "All Activity" to see other activity.`}
            </p>
          </div>
        ) : (
          <ul className={styles.list} role="list" aria-label="Recent comments">
            {filteredComments.map((comment) => (
              <li key={comment.id} className={styles.item}>
                <article
                  className={clsx(
                    styles.card,
                    onCommentClick && styles.clickable
                  )}
                  onClick={() => handleCommentClick(comment)}
                  tabIndex={onCommentClick ? 0 : undefined}
                  role={onCommentClick ? 'button' : undefined}
                  aria-label={`Comment by ${comment.authorName} on ${getEntityLabel(comment.commentable_type)}`}
                  onKeyDown={(e) => {
                    if (onCommentClick && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      handleCommentClick(comment)
                    }
                  }}
                >
                  {/* Avatar */}
                  <div className={styles.avatar}>
                    <span className={styles.avatarText}>
                      {comment.authorName.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Content */}
                  <div className={styles.cardContent}>
                    <div className={styles.cardHeader}>
                      <span className={styles.authorName}>{comment.authorName}</span>
                      <span className={styles.separator}>•</span>
                      <span className={styles.entityType}>
                        {getEntityLabel(comment.commentable_type)}
                      </span>
                      <span className={styles.separator}>•</span>
                      <time
                        className={styles.timestamp}
                        dateTime={new Date(comment.created_at).toISOString()}
                      >
                        {formatTimestamp(comment.created_at)}
                      </time>
                    </div>
                    <p className={styles.commentText}>{comment.content}</p>
                  </div>

                  {/* Navigate icon (if clickable) */}
                  {onCommentClick && (
                    <svg
                      className={styles.navigateIcon}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
