/**
 * Activity Feed UI Components
 *
 * Complete set of components for IC1b: Activity Feed UI
 * Integrates with Group I backend services (CommentsService, MentionsService)
 *
 * Components:
 * - ActivityFeed: Displays recent comments chronologically with filtering
 * - CommentComposer: Text input with @mention autocomplete
 * - CommentThread: Nested comment display with reply support
 * - MentionDropdown: Autocomplete dropdown for @mentions
 * - MentionBadge: Unread mention count indicator
 *
 * All components are WCAG 2.1 AA compliant with:
 * - Keyboard navigation
 * - Screen reader support
 * - Color contrast ≥ 4.5:1
 * - Focus indicators
 * - Steadiness communication style
 */

export { ActivityFeed, type ActivityFeedProps } from './ActivityFeed'
export { CommentComposer, type CommentComposerProps } from './CommentComposer'
export { CommentThread, type CommentThreadProps } from './CommentThread'
export { MentionDropdown, type MentionDropdownProps, type MentionUser } from './MentionDropdown'
export { MentionBadge, type MentionBadgeProps } from './MentionBadge'
