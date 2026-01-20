import { useState } from 'react'
import clsx from 'clsx'
import type { Comment } from '../../db/schema/comments.schema'
import { CommentComposer } from './CommentComposer'
import styles from './CommentThread.module.css'

export interface CommentThreadProps {
  /**
   * Comment data
   */
  comment: Comment
  /**
   * Nested replies
   */
  replies?: CommentThreadProps[]
  /**
   * Current nesting depth (0 = top-level)
   */
  depth?: number
  /**
   * Maximum nesting depth to display
   */
  maxDepth?: number
  /**
   * Current user ID
   */
  currentUserId: string
  /**
   * Company ID
   */
  companyId: string
  /**
   * Author name (fetched externally)
   */
  authorName?: string
  /**
   * Callback when reply is submitted
   */
  onReply?: (parentCommentId: string, content: string, mentionedUserIds: string[]) => void | Promise<void>
  /**
   * Callback when comment is edited
   */
  onEdit?: (commentId: string, content: string) => void | Promise<void>
  /**
   * Callback when comment is deleted
   */
  onDelete?: (commentId: string) => void | Promise<void>
  /**
   * Additional class name
   */
  className?: string
}

/**
 * CommentThread component displays a comment with nested replies
 *
 * Features:
 * - Nested reply threading with visual indentation
 * - Reply, edit, delete actions (with permissions)
 * - Relative timestamps ("2 hours ago")
 * - Edited indicator
 * - Deleted comment tombstones
 * - Keyboard accessible (Tab navigation, Enter activation)
 * - Screen reader support with semantic HTML
 * - WCAG 2.1 AA compliant (color contrast, focus indicators)
 * - Steadiness communication style
 *
 * @example
 * ```tsx
 * <CommentThread
 *   comment={commentData}
 *   replies={nestedReplies}
 *   depth={0}
 *   currentUserId="user-123"
 *   companyId="company-123"
 *   onReply={handleReply}
 * />
 * ```
 */
export function CommentThread({
  comment,
  replies = [],
  depth = 0,
  maxDepth = 5,
  currentUserId,
  companyId,
  authorName = 'Unknown User',
  onReply,
  onEdit,
  onDelete,
  className,
}: CommentThreadProps) {
  const [showReplyComposer, setShowReplyComposer] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editContent, setEditContent] = useState(comment.content)

  const isAuthor = comment.author_user_id === currentUserId
  const isDeleted = comment.status === 'DELETED' || comment.deleted_at !== null
  const isEdited = comment.edited_at !== null && comment.status === 'EDITED'
  const canReply = depth < maxDepth && !isDeleted

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

  // Handle reply submit
  const handleReplySubmit = async (content: string, mentionedUserIds: string[]) => {
    if (!onReply) return

    setIsSubmitting(true)
    try {
      await onReply(comment.id, content, mentionedUserIds)
      setShowReplyComposer(false)
    } catch (error) {
      console.error('Failed to submit reply:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle edit submit
  const handleEditSubmit = async () => {
    if (!onEdit || editContent.trim() === comment.content) {
      setIsEditing(false)
      return
    }

    setIsSubmitting(true)
    try {
      await onEdit(comment.id, editContent.trim())
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to edit comment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!onDelete) return

    const confirmed = window.confirm(
      'Are you sure you want to delete this comment? This action cannot be undone.'
    )

    if (!confirmed) return

    setIsSubmitting(true)
    try {
      await onDelete(comment.id)
    } catch (error) {
      console.error('Failed to delete comment:', error)
      setIsSubmitting(false)
    }
  }

  return (
    <article
      className={clsx(
        styles.thread,
        depth > 0 && styles.nested,
        isDeleted && styles.deleted,
        className
      )}
      style={{ '--depth': depth } as React.CSSProperties}
      aria-label={`Comment by ${authorName}`}
    >
      <div className={styles.comment}>
        {/* Avatar */}
        <div className={styles.avatar}>
          <span className={styles.avatarText}>
            {authorName.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Header */}
          <div className={styles.header}>
            <span className={styles.authorName}>{authorName}</span>
            <span className={styles.timestamp}>
              <time dateTime={new Date(comment.created_at).toISOString()}>
                {formatTimestamp(comment.created_at)}
              </time>
            </span>
            {isEdited && (
              <span className={styles.editedBadge} title="This comment has been edited">
                (edited)
              </span>
            )}
          </div>

          {/* Body */}
          <div className={styles.body}>
            {isDeleted ? (
              <p className={styles.deletedText}>
                <em>This comment has been removed</em>
              </p>
            ) : isEditing ? (
              <div className={styles.editForm}>
                <textarea
                  className={styles.editTextarea}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  aria-label="Edit comment"
                />
                <div className={styles.editActions}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false)
                      setEditContent(comment.content)
                    }}
                    disabled={isSubmitting}
                    className={styles.cancelButton}
                    aria-label="Cancel editing"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleEditSubmit}
                    disabled={isSubmitting || editContent.trim() === ''}
                    className={styles.saveButton}
                    aria-label="Save changes"
                  >
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <p className={styles.text}>{comment.content}</p>
            )}
          </div>

          {/* Actions */}
          {!isDeleted && !isEditing && (
            <div className={styles.actions}>
              {canReply && (
                <button
                  type="button"
                  onClick={() => setShowReplyComposer(!showReplyComposer)}
                  className={styles.actionButton}
                  aria-label="Reply to comment"
                  aria-expanded={showReplyComposer}
                >
                  <svg className={styles.actionIcon} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Reply
                </button>
              )}
              {isAuthor && onEdit && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className={styles.actionButton}
                  aria-label="Edit comment"
                >
                  <svg className={styles.actionIcon} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Edit
                </button>
              )}
              {isAuthor && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className={clsx(styles.actionButton, styles.deleteButton)}
                  aria-label="Delete comment"
                >
                  <svg className={styles.actionIcon} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reply composer */}
      {showReplyComposer && canReply && (
        <div className={styles.replyComposer}>
          <CommentComposer
            onSubmit={handleReplySubmit}
            onCancel={() => setShowReplyComposer(false)}
            isSubmitting={isSubmitting}
            companyId={companyId}
            placeholder="Write a reply..."
            minRows={2}
            maxRows={6}
          />
        </div>
      )}

      {/* Nested replies */}
      {replies.length > 0 && (
        <div className={styles.replies} role="list" aria-label="Replies">
          {replies.map((reply) => (
            <div key={reply.comment.id} role="listitem">
              <CommentThread
                {...reply}
                depth={depth + 1}
                maxDepth={maxDepth}
                currentUserId={currentUserId}
                companyId={companyId}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
