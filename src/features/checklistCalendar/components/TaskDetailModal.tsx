/**
 * TaskDetailModal Component
 *
 * Modal for viewing and editing task details including:
 * - Task title and description (SOP)
 * - Sub-tasks management
 * - Comments/discussion
 * - Feature link configuration
 * - Priority and assignee
 *
 * Requirements:
 * - CK-D1: Task Detail Modal
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import clsx from 'clsx';
import type {
  AdminTask,
  AdminChecklist,
  TaskPriority,
} from '../../../db/schema/checklistCalendar.schema';
import type { CommentWithMeta, TaskWithSubTasks } from '../services';
import styles from './TaskDetailModal.module.css';

// =============================================================================
// TYPES
// =============================================================================

export interface TaskDetailModalProps {
  /**
   * The task to display/edit
   */
  task: TaskWithSubTasks;

  /**
   * The checklist this task belongs to
   */
  checklist: AdminChecklist;

  /**
   * Whether the task is completed for the current date
   */
  isComplete?: boolean;

  /**
   * Comments on this task
   */
  comments?: CommentWithMeta[];

  /**
   * Whether the modal is open
   */
  isOpen: boolean;

  /**
   * Current user ID for comment authorship
   */
  currentUserId?: string;

  /**
   * Current user name for comment authorship
   */
  currentUserName?: string;

  /**
   * Callback when the modal should close
   */
  onClose: () => void;

  /**
   * Callback when task title is updated
   */
  onUpdateTitle?: (title: string) => void;

  /**
   * Callback when task description is updated
   */
  onUpdateDescription?: (description: string) => void;

  /**
   * Callback when task priority is updated
   */
  onUpdatePriority?: (priority: TaskPriority) => void;

  /**
   * Callback when task assignee is updated
   */
  onUpdateAssignee?: (assigneeId: string | null, assigneeName: string | null) => void;

  /**
   * Callback when feature link is updated
   */
  onUpdateFeatureLink?: (link: string | null, label: string | null) => void;

  /**
   * Callback when completion is toggled
   */
  onToggleComplete?: () => void;

  /**
   * Callback when a sub-task is added
   */
  onAddSubTask?: (title: string) => void;

  /**
   * Callback when a sub-task is toggled
   */
  onToggleSubTask?: (subTaskId: string) => void;

  /**
   * Callback when a sub-task is deleted
   */
  onDeleteSubTask?: (subTaskId: string) => void;

  /**
   * Callback when a comment is added
   */
  onAddComment?: (content: string) => void;

  /**
   * Callback when a comment is deleted
   */
  onDeleteComment?: (commentId: string) => void;

  /**
   * Callback when feature link is clicked
   */
  onFeatureLinkClick?: (path: string) => void;

  /**
   * Callback when task is deleted
   */
  onDelete?: () => void;

  /**
   * Available team members for assignment
   */
  teamMembers?: Array<{ id: string; name: string }>;

  /**
   * Custom priority colors
   */
  priorityColors?: {
    high: string;
    medium: string;
    low: string;
  };

  /**
   * Whether to show delete option
   */
  canDelete?: boolean;

  /**
   * Additional CSS class name
   */
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: 'high', label: 'High Priority' },
  { value: 'medium', label: 'Medium Priority' },
  { value: 'low', label: 'Low Priority' },
  { value: 'none', label: 'No Priority' },
];

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface SubTaskItemProps {
  subTask: AdminTask;
  isComplete: boolean;
  onToggle?: () => void;
  onDelete?: () => void;
}

function SubTaskItem({ subTask, isComplete, onToggle, onDelete }: SubTaskItemProps) {
  return (
    <div className={clsx(styles.subTaskItem, isComplete && styles.completed)}>
      <label className={styles.subTaskCheckbox}>
        <input
          type="checkbox"
          checked={isComplete}
          onChange={onToggle}
          aria-label={`Mark "${subTask.title}" as ${isComplete ? 'incomplete' : 'complete'}`}
        />
        <span className={styles.checkmark} />
      </label>
      <span className={styles.subTaskTitle}>{subTask.title}</span>
      {onDelete && (
        <button
          type="button"
          className={styles.deleteButton}
          onClick={onDelete}
          aria-label={`Delete sub-task "${subTask.title}"`}
        >
          ×
        </button>
      )}
    </div>
  );
}

interface CommentItemProps {
  comment: CommentWithMeta;
  currentUserId?: string;
  onDelete?: () => void;
}

function CommentItem({ comment, currentUserId, onDelete }: CommentItemProps) {
  const canDelete = currentUserId === comment.created_by;
  const createdAt = new Date(comment.created_at);

  return (
    <div className={styles.commentItem}>
      <div className={styles.commentHeader}>
        <span className={styles.commentAvatar}>
          {getInitials(comment.created_by_name || 'User')}
        </span>
        <div className={styles.commentMeta}>
          <span className={styles.commentAuthor}>
            {comment.created_by_name || 'Unknown User'}
          </span>
          <span className={styles.commentDate}>
            {formatDate(createdAt)} at {formatTime(createdAt)}
          </span>
        </div>
        {canDelete && onDelete && (
          <button
            type="button"
            className={styles.deleteButton}
            onClick={onDelete}
            aria-label="Delete comment"
          >
            ×
          </button>
        )}
      </div>
      <div className={styles.commentContent}>{comment.content}</div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TaskDetailModal({
  task,
  checklist,
  isComplete = false,
  comments = [],
  isOpen,
  currentUserId,
  currentUserName,
  onClose,
  onUpdateTitle,
  onUpdateDescription,
  onUpdatePriority,
  onUpdateAssignee,
  onUpdateFeatureLink,
  onToggleComplete,
  onAddSubTask,
  onToggleSubTask,
  onDeleteSubTask,
  onAddComment,
  onDeleteComment,
  onFeatureLinkClick,
  onDelete,
  teamMembers = [],
  priorityColors,
  canDelete = false,
  className,
}: TaskDetailModalProps) {
  // Local state for editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.task.title);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState(task.task.description || '');
  const [newSubTask, setNewSubTask] = useState('');
  const [newComment, setNewComment] = useState('');
  const [isEditingFeatureLink, setIsEditingFeatureLink] = useState(false);
  const [editFeatureLink, setEditFeatureLink] = useState(task.task.feature_link || '');
  const [editFeatureLinkLabel, setEditFeatureLinkLabel] = useState(
    task.task.feature_link_label || ''
  );

  // Reset local state when task changes
  useEffect(() => {
    setEditTitle(task.task.title);
    setEditDescription(task.task.description || '');
    setEditFeatureLink(task.task.feature_link || '');
    setEditFeatureLinkLabel(task.task.feature_link_label || '');
  }, [task]);

  // Get priority style
  const getPriorityStyle = useCallback(
    (priority: TaskPriority) => {
      if (!priorityColors || priority === 'none') return {};
      const color = priorityColors[priority];
      if (!color) return {};
      return {
        backgroundColor: `${color}20`,
        color: color,
        borderColor: color,
      };
    },
    [priorityColors]
  );

  // Handle title save
  const handleTitleSave = useCallback(() => {
    if (editTitle.trim() && editTitle !== task.task.title) {
      onUpdateTitle?.(editTitle.trim());
    }
    setIsEditingTitle(false);
  }, [editTitle, task.task.title, onUpdateTitle]);

  // Handle description save
  const handleDescriptionSave = useCallback(() => {
    if (editDescription !== task.task.description) {
      onUpdateDescription?.(editDescription);
    }
    setIsEditingDescription(false);
  }, [editDescription, task.task.description, onUpdateDescription]);

  // Handle feature link save
  const handleFeatureLinkSave = useCallback(() => {
    const link = editFeatureLink.trim() || null;
    const label = editFeatureLinkLabel.trim() || null;
    onUpdateFeatureLink?.(link, label);
    setIsEditingFeatureLink(false);
  }, [editFeatureLink, editFeatureLinkLabel, onUpdateFeatureLink]);

  // Handle add sub-task
  const handleAddSubTask = useCallback(() => {
    if (newSubTask.trim()) {
      onAddSubTask?.(newSubTask.trim());
      setNewSubTask('');
    }
  }, [newSubTask, onAddSubTask]);

  // Handle add comment
  const handleAddComment = useCallback(() => {
    if (newComment.trim()) {
      onAddComment?.(newComment.trim());
      setNewComment('');
    }
  }, [newComment, onAddComment]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // Calculate sub-task progress
  const subTaskProgress = useMemo(() => {
    if (task.subTasks.length === 0) return null;
    const completed = task.subTasks.filter((st) => st.is_archived).length;
    return {
      completed,
      total: task.subTasks.length,
      percent: Math.round((completed / task.subTasks.length) * 100),
    };
  }, [task.subTasks]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-detail-title"
    >
      <div
        className={clsx(styles.modal, className)}
        onClick={(e) => e.stopPropagation()}
        style={{ '--checklist-color': checklist.color } as React.CSSProperties}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span
              className={styles.checklistBadge}
              style={{
                backgroundColor: `${checklist.color}15`,
                color: checklist.color,
              }}
            >
              {checklist.name}
            </span>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Title Section */}
          <div className={styles.titleSection}>
            <label
              className={clsx(styles.mainCheckbox, isComplete && styles.checked)}
              onClick={onToggleComplete}
            >
              <input
                type="checkbox"
                checked={isComplete}
                onChange={() => {}}
                aria-label={`Mark task as ${isComplete ? 'incomplete' : 'complete'}`}
              />
              <span className={styles.checkmark}>✓</span>
            </label>

            {isEditingTitle ? (
              <input
                type="text"
                className={styles.titleInput}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave();
                  if (e.key === 'Escape') {
                    setEditTitle(task.task.title);
                    setIsEditingTitle(false);
                  }
                }}
                autoFocus
              />
            ) : (
              <h2
                id="task-detail-title"
                className={clsx(styles.title, isComplete && styles.completed)}
                onClick={() => onUpdateTitle && setIsEditingTitle(true)}
              >
                {task.task.title}
              </h2>
            )}
          </div>

          {/* Metadata Row */}
          <div className={styles.metadataRow}>
            {/* Priority */}
            <div className={styles.metadataItem}>
              <label className={styles.metadataLabel}>Priority</label>
              <select
                className={clsx(styles.prioritySelect, styles[task.task.priority])}
                value={task.task.priority}
                onChange={(e) => onUpdatePriority?.(e.target.value as TaskPriority)}
                style={getPriorityStyle(task.task.priority)}
                disabled={!onUpdatePriority}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            {teamMembers.length > 0 && (
              <div className={styles.metadataItem}>
                <label className={styles.metadataLabel}>Assigned to</label>
                <select
                  className={styles.assigneeSelect}
                  value={task.task.assignee_id || ''}
                  onChange={(e) => {
                    const member = teamMembers.find((m) => m.id === e.target.value);
                    onUpdateAssignee?.(
                      member?.id || null,
                      member?.name || null
                    );
                  }}
                  disabled={!onUpdateAssignee}
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Current assignee display when no team members */}
            {teamMembers.length === 0 && task.task.assignee_name && (
              <div className={styles.metadataItem}>
                <label className={styles.metadataLabel}>Assigned to</label>
                <div className={styles.assigneeDisplay}>
                  <span className={styles.assigneeAvatar}>
                    {getInitials(task.task.assignee_name)}
                  </span>
                  {task.task.assignee_name}
                </div>
              </div>
            )}
          </div>

          {/* Description/SOP Section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Description / SOP</h3>
              {onUpdateDescription && !isEditingDescription && (
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={() => setIsEditingDescription(true)}
                >
                  Edit
                </button>
              )}
            </div>
            {isEditingDescription ? (
              <div className={styles.descriptionEditor}>
                <textarea
                  className={styles.descriptionTextarea}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Add standard operating procedure, notes, or instructions..."
                  rows={6}
                  autoFocus
                />
                <div className={styles.editorActions}>
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={() => {
                      setEditDescription(task.task.description || '');
                      setIsEditingDescription(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={handleDescriptionSave}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={clsx(
                  styles.descriptionContent,
                  !task.task.description && styles.empty
                )}
                onClick={() => onUpdateDescription && setIsEditingDescription(true)}
              >
                {task.task.description || 'No description. Click to add SOP or notes.'}
              </div>
            )}
          </div>

          {/* Feature Link Section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Feature Link</h3>
              {onUpdateFeatureLink && !isEditingFeatureLink && (
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={() => setIsEditingFeatureLink(true)}
                >
                  {task.task.feature_link ? 'Edit' : 'Add'}
                </button>
              )}
            </div>
            {isEditingFeatureLink ? (
              <div className={styles.featureLinkEditor}>
                <input
                  type="text"
                  className={styles.input}
                  value={editFeatureLink}
                  onChange={(e) => setEditFeatureLink(e.target.value)}
                  placeholder="/path/to/feature"
                />
                <input
                  type="text"
                  className={styles.input}
                  value={editFeatureLinkLabel}
                  onChange={(e) => setEditFeatureLinkLabel(e.target.value)}
                  placeholder="Button label (optional)"
                />
                <div className={styles.editorActions}>
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={() => {
                      setEditFeatureLink(task.task.feature_link || '');
                      setEditFeatureLinkLabel(task.task.feature_link_label || '');
                      setIsEditingFeatureLink(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={handleFeatureLinkSave}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : task.task.feature_link ? (
              <button
                type="button"
                className={styles.featureLinkButton}
                onClick={() => onFeatureLinkClick?.(task.task.feature_link!)}
              >
                <span className={styles.linkIcon}>→</span>
                {task.task.feature_link_label || 'Go to feature'}
              </button>
            ) : (
              <div className={styles.emptyState}>
                No feature link configured
              </div>
            )}
          </div>

          {/* Sub-tasks Section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                Sub-tasks
                {subTaskProgress && (
                  <span className={styles.progressBadge}>
                    {subTaskProgress.completed}/{subTaskProgress.total}
                  </span>
                )}
              </h3>
            </div>

            {/* Sub-task progress bar */}
            {subTaskProgress && (
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${subTaskProgress.percent}%` }}
                />
              </div>
            )}

            {/* Sub-tasks list */}
            <div className={styles.subTasksList}>
              {task.subTasks.map((subTask) => (
                <SubTaskItem
                  key={subTask.id}
                  subTask={subTask}
                  isComplete={subTask.is_archived}
                  onToggle={() => onToggleSubTask?.(subTask.id)}
                  onDelete={onDeleteSubTask ? () => onDeleteSubTask(subTask.id) : undefined}
                />
              ))}
            </div>

            {/* Add sub-task input */}
            {onAddSubTask && (
              <div className={styles.addSubTask}>
                <input
                  type="text"
                  className={styles.input}
                  value={newSubTask}
                  onChange={(e) => setNewSubTask(e.target.value)}
                  placeholder="Add a sub-task..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddSubTask();
                  }}
                />
                <button
                  type="button"
                  className={styles.addButton}
                  onClick={handleAddSubTask}
                  disabled={!newSubTask.trim()}
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                Comments
                {comments.length > 0 && (
                  <span className={styles.countBadge}>{comments.length}</span>
                )}
              </h3>
            </div>

            {/* Comments list */}
            <div className={styles.commentsList}>
              {comments.length === 0 ? (
                <div className={styles.emptyState}>
                  No comments yet. Start a discussion!
                </div>
              ) : (
                comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    currentUserId={currentUserId}
                    onDelete={
                      onDeleteComment
                        ? () => onDeleteComment(comment.id)
                        : undefined
                    }
                  />
                ))
              )}
            </div>

            {/* Add comment input */}
            {onAddComment && (
              <div className={styles.addComment}>
                <textarea
                  className={styles.commentTextarea}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  rows={2}
                />
                <div className={styles.commentActions}>
                  {currentUserName && (
                    <span className={styles.postingAs}>
                      Posting as {currentUserName}
                    </span>
                  )}
                  <button
                    type="button"
                    className={styles.postButton}
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                  >
                    Post
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {canDelete && onDelete && (
              <button
                type="button"
                className={styles.deleteTaskButton}
                onClick={onDelete}
              >
                Delete Task
              </button>
            )}
          </div>
          <button type="button" className={styles.doneButton} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

TaskDetailModal.displayName = 'TaskDetailModal';
