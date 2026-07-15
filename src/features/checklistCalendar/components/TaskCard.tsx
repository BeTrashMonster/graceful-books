/**
 * TaskCard Component
 *
 * Displays a task with its metadata, priority, assignee, and completion status.
 * Used in both calendar day views and task lists.
 *
 * Requirements:
 * - CK-C3: TaskCard component
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { useCallback } from 'react';
import clsx from 'clsx';
import type { AdminTask, AdminChecklist, TaskPriority } from '../../../db/schema/checklistCalendar.schema';
import styles from './TaskCard.module.css';

// =============================================================================
// TYPES
// =============================================================================

export interface TaskCardProps {
  /**
   * The task to display
   */
  task: AdminTask;

  /**
   * The checklist this task belongs to
   */
  checklist: AdminChecklist;

  /**
   * Whether the task is completed
   */
  isComplete?: boolean;

  /**
   * Number of sub-tasks
   */
  subTaskCount?: number;

  /**
   * Number of completed sub-tasks
   */
  completedSubTaskCount?: number;

  /**
   * Number of comments on this task
   */
  commentCount?: number;

  /**
   * Callback when the task is clicked
   */
  onClick?: () => void;

  /**
   * Callback when completion is toggled
   */
  onToggleComplete?: () => void;

  /**
   * Callback when feature link is clicked
   */
  onFeatureLinkClick?: (path: string) => void;

  /**
   * Whether to show description preview
   */
  showDescription?: boolean;

  /**
   * Whether to use compact layout
   */
  compact?: boolean;

  /**
   * Custom priority colors
   */
  priorityColors?: {
    high: string;
    medium: string;
    low: string;
  };

  /**
   * Additional CSS class name
   */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: '',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TaskCard({
  task,
  checklist,
  isComplete = false,
  subTaskCount = 0,
  completedSubTaskCount = 0,
  commentCount = 0,
  onClick,
  onToggleComplete,
  onFeatureLinkClick,
  showDescription = false,
  compact = false,
  priorityColors,
  className,
}: TaskCardProps) {
  // Handle checkbox click without bubbling
  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent | React.ChangeEvent) => {
      e.stopPropagation();
      onToggleComplete?.();
    },
    [onToggleComplete]
  );

  // Handle feature link click
  const handleFeatureLinkClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (task.feature_link) {
        onFeatureLinkClick?.(task.feature_link);
      }
    },
    [task.feature_link, onFeatureLinkClick]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.();
      }
    },
    [onClick]
  );

  // Get priority color styles
  const getPriorityStyle = useCallback(
    (priority: TaskPriority) => {
      if (!priorityColors || priority === 'none') return {};
      const color = priorityColors[priority];
      if (!color) return {};
      return {
        backgroundColor: `${color}20`,
        color: color,
      };
    },
    [priorityColors]
  );

  // Get description preview
  const descriptionPreview = showDescription && task.description
    ? stripHtml(task.description)
    : null;

  return (
    <div
      className={clsx(
        styles.taskCard,
        isComplete && styles.completed,
        compact && styles.compact,
        className
      )}
      style={{ '--checklist-color': checklist.color } as React.CSSProperties}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${task.title}${isComplete ? ', completed' : ''}`}
    >
      {/* Checkbox */}
      <div className={styles.checkboxArea}>
        <label
          className={clsx(styles.checkbox, isComplete && styles.checked)}
          onClick={handleCheckboxClick}
        >
          <input
            type="checkbox"
            className={styles.checkboxInput}
            checked={isComplete}
            onChange={handleCheckboxClick}
            aria-label={`Mark "${task.title}" as ${isComplete ? 'incomplete' : 'complete'}`}
          />
        </label>
      </div>

      {/* Content */}
      <div className={styles.content}>
        <h3 className={styles.taskTitle}>{task.title}</h3>

        {/* Metadata */}
        <div className={styles.metadata}>
          {/* Checklist badge */}
          <span
            className={clsx(styles.badge, styles.checklistBadge)}
            style={{
              '--checklist-color': checklist.color,
              '--checklist-color-light': `${checklist.color}15`,
            } as React.CSSProperties}
          >
            {checklist.name}
          </span>

          {/* Priority badge */}
          {task.priority !== 'none' && (
            <span
              className={clsx(
                styles.badge,
                styles.priorityBadge,
                styles[task.priority]
              )}
              style={getPriorityStyle(task.priority)}
            >
              {PRIORITY_LABELS[task.priority]}
            </span>
          )}

          {/* Assignee */}
          {task.assignee_name && (
            <span className={styles.assignee}>
              <span className={styles.assigneeAvatar}>
                {getInitials(task.assignee_name)}
              </span>
              {task.assignee_name}
            </span>
          )}

          {/* Sub-tasks indicator */}
          {subTaskCount > 0 && (
            <span className={styles.subTasksIndicator}>
              <span className={styles.subTasksIcon} aria-hidden="true">
                ☐
              </span>
              {completedSubTaskCount}/{subTaskCount}
            </span>
          )}

          {/* Comment count */}
          {commentCount > 0 && (
            <span className={styles.commentCount}>
              <span aria-hidden="true">💬</span>
              {commentCount}
            </span>
          )}

          {/* Feature link */}
          {task.feature_link && (
            <button
              type="button"
              className={styles.featureLink}
              onClick={handleFeatureLinkClick}
              aria-label={`Go to ${task.feature_link_label || 'feature'}`}
            >
              <span aria-hidden="true">→</span>
              {task.feature_link_label || 'Open'}
            </button>
          )}
        </div>

        {/* Description preview */}
        {descriptionPreview && (
          <p className={styles.descriptionPreview}>{descriptionPreview}</p>
        )}
      </div>

      {/* Actions (shown on hover) */}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionButton}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          aria-label="View task details"
        >
          ⋮
        </button>
      </div>
    </div>
  );
}

TaskCard.displayName = 'TaskCard';
