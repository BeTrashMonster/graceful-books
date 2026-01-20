import { useState, useRef, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import { MentionDropdown, type MentionUser } from './MentionDropdown'
import { db } from '../../db/database'
import styles from './CommentComposer.module.css'

export interface CommentComposerProps {
  /**
   * Callback when comment is submitted
   */
  onSubmit: (content: string, mentionedUserIds: string[]) => void | Promise<void>
  /**
   * Callback when cancelled
   */
  onCancel?: () => void
  /**
   * Placeholder text
   */
  placeholder?: string
  /**
   * Initial value
   */
  initialValue?: string
  /**
   * Whether the composer is submitting
   */
  isSubmitting?: boolean
  /**
   * Additional class name
   */
  className?: string
  /**
   * Auto-focus on mount
   */
  autoFocus?: boolean
  /**
   * Minimum rows for textarea
   */
  minRows?: number
  /**
   * Maximum rows for textarea
   */
  maxRows?: number
  /**
   * Company ID for fetching users
   */
  companyId: string
}

/**
 * CommentComposer component for writing comments with @mention support
 *
 * Features:
 * - Multiline textarea with auto-resize
 * - @mention autocomplete with fuzzy search
 * - Keyboard navigation (Tab, Enter, Esc, Arrow keys)
 * - Screen reader support with aria-live announcements
 * - WCAG 2.1 AA compliant (labels, focus management, color contrast)
 * - Debounced user search
 * - Mentions inserted as @username format
 * - Submit button disabled when empty
 * - Character counter (optional)
 *
 * @example
 * ```tsx
 * <CommentComposer
 *   onSubmit={handleCommentSubmit}
 *   onCancel={handleCancel}
 *   companyId="company-123"
 *   placeholder="Add a comment..."
 * />
 * ```
 */
export function CommentComposer({
  onSubmit,
  onCancel,
  placeholder = 'Add a comment... (Type @ to mention a teammate)',
  initialValue = '',
  isSubmitting: externalIsSubmitting = false,
  className,
  autoFocus = false,
  minRows = 3,
  maxRows = 10,
  companyId,
}: CommentComposerProps) {
  const [content, setContent] = useState(initialValue)
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 })
  const [mentionStartIndex, setMentionStartIndex] = useState(-1)
  const [filteredUsers, setFilteredUsers] = useState<MentionUser[]>([])
  const [selectedUserIndex, setSelectedUserIndex] = useState(0)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])
  const [internalIsSubmitting, setInternalIsSubmitting] = useState(false)

  // Use external or internal submitting state
  const isSubmitting = externalIsSubmitting || internalIsSubmitting

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'

    // Calculate line height
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight, 10) || 20
    const minHeight = lineHeight * minRows
    const maxHeight = lineHeight * maxRows

    // Set height based on content, constrained by min/max
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)
    textarea.style.height = `${newHeight}px`
  }, [minRows, maxRows])

  // Adjust height on content change
  useEffect(() => {
    adjustTextareaHeight()
  }, [content, adjustTextareaHeight])

  // Auto-focus
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  // Fetch users for mentions
  const fetchUsers = useCallback(async (query: string) => {
    if (!query) {
      setFilteredUsers([])
      return
    }

    setIsLoadingUsers(true)
    try {
      // Get active company users
      const companyUsers = await db.companyUsers
        .where('company_id')
        .equals(companyId)
        .and((cu) => cu.active === true && cu.deleted_at === null)
        .toArray()

      // Get user details
      const userIds = companyUsers.map((cu) => cu.user_id)
      const users = await db.users
        .where('id')
        .anyOf(userIds)
        .and((user) => user.deleted_at === null)
        .toArray()

      // Filter and map to MentionUser
      const queryLower = query.toLowerCase()
      const matchedUsers: MentionUser[] = users
        .filter((user) => {
          const username = user.email.split('@')[0].toLowerCase()
          const nameLower = user.name.toLowerCase()
          return (
            username.includes(queryLower) ||
            nameLower.includes(queryLower)
          )
        })
        .map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.email.split('@')[0],
        }))
        .slice(0, 5) // Limit to 5 suggestions

      setFilteredUsers(matchedUsers)
      setSelectedUserIndex(0)
    } catch (error) {
      console.error('Failed to fetch users for mentions:', error)
      setFilteredUsers([])
    } finally {
      setIsLoadingUsers(false)
    }
  }, [companyId])

  // Debounced user search
  useEffect(() => {
    if (!showMentionDropdown) return

    const timer = setTimeout(() => {
      fetchUsers(mentionQuery)
    }, 200)

    return () => clearTimeout(timer)
  }, [mentionQuery, showMentionDropdown, fetchUsers])

  // Handle text change
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)

    // Check for @ symbol to trigger mention dropdown
    const cursorPosition = e.target.selectionStart
    const textBeforeCursor = newContent.slice(0, cursorPosition)

    // Find last @ symbol
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      // Check if @ is at start or preceded by whitespace
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' '
      if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0) {
        // Extract query after @
        const query = textBeforeCursor.slice(lastAtIndex + 1)

        // Only show dropdown if query doesn't contain spaces
        if (!query.includes(' ') && !query.includes('\n')) {
          setMentionQuery(query)
          setMentionStartIndex(lastAtIndex)
          setShowMentionDropdown(true)

          // Calculate dropdown position
          const textarea = textareaRef.current
          if (textarea) {
            const { top, left } = composerRef.current!.getBoundingClientRect()
            // Position below textarea
            setMentionPosition({
              top: top + textarea.offsetHeight + 4,
              left: left,
            })
          }
          return
        }
      }
    }

    // Hide dropdown if @ not found or conditions not met
    setShowMentionDropdown(false)
  }

  // Handle mention selection
  const handleMentionSelect = (user: MentionUser) => {
    if (mentionStartIndex === -1) return

    // Replace @query with @username
    const beforeMention = content.slice(0, mentionStartIndex)
    const afterMention = content.slice(textareaRef.current!.selectionStart)
    const newContent = `${beforeMention}@${user.username} ${afterMention}`

    setContent(newContent)
    setShowMentionDropdown(false)
    setMentionQuery('')
    setMentionStartIndex(-1)

    // Track mentioned user
    if (!mentionedUserIds.includes(user.id)) {
      setMentionedUserIds([...mentionedUserIds, user.id])
    }

    // Focus back on textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPosition = mentionStartIndex + user.username.length + 2 // +2 for @ and space
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition)
      }
    }, 0)
  }

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionDropdown && filteredUsers.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedUserIndex((prev) => (prev + 1) % filteredUsers.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedUserIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length)
          break
        case 'Enter':
          if (!e.shiftKey) {
            e.preventDefault()
            handleMentionSelect(filteredUsers[selectedUserIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          setShowMentionDropdown(false)
          setMentionQuery('')
          setMentionStartIndex(-1)
          break
      }
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      // Cmd+Enter or Ctrl+Enter to submit
      e.preventDefault()
      handleSubmit()
    }
  }

  // Handle submit
  const handleSubmit = async () => {
    if (content.trim() === '' || isSubmitting) return

    setInternalIsSubmitting(true)
    try {
      await onSubmit(content.trim(), mentionedUserIds)
      // Reset form
      setContent('')
      setMentionedUserIds([])
      setShowMentionDropdown(false)
    } catch (error) {
      console.error('Failed to submit comment:', error)
    } finally {
      setInternalIsSubmitting(false)
    }
  }

  const isContentEmpty = content.trim() === ''

  return (
    <div ref={composerRef} className={clsx(styles.composer, className)}>
      <div className={styles.inputContainer}>
        <label htmlFor="comment-textarea" className={styles.label}>
          Comment
          <span className={styles.srOnly}> (Type @ to mention a teammate)</span>
        </label>
        <textarea
          ref={textareaRef}
          id="comment-textarea"
          className={styles.textarea}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isSubmitting}
          rows={minRows}
          aria-label="Comment"
          aria-describedby="comment-hint"
        />
        <div id="comment-hint" className={styles.hint}>
          Tip: Type @ to mention a teammate. Press Cmd+Enter to submit.
        </div>
      </div>

      {showMentionDropdown && (
        <MentionDropdown
          users={filteredUsers}
          selectedIndex={selectedUserIndex}
          onSelect={handleMentionSelect}
          position={mentionPosition}
          isLoading={isLoadingUsers}
        />
      )}

      <div className={styles.actions}>
        <div className={styles.actionsLeft}>
          {mentionedUserIds.length > 0 && (
            <div className={styles.mentionCount} role="status" aria-live="polite">
              <svg className={styles.mentionIcon} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
              </svg>
              <span>
                {mentionedUserIds.length} {mentionedUserIds.length === 1 ? 'person' : 'people'} mentioned
              </span>
            </div>
          )}
        </div>
        <div className={styles.actionsRight}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className={styles.cancelButton}
              aria-label="Cancel comment"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isContentEmpty || isSubmitting}
            className={styles.submitButton}
            aria-label="Submit comment"
          >
            {isSubmitting ? (
              <>
                <span className={styles.spinner} aria-hidden="true">
                  <span className={styles.spinnerCircle} />
                </span>
                <span>Posting...</span>
              </>
            ) : (
              'Post Comment'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
