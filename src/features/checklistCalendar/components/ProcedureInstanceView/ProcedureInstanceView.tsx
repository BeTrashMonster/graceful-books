/**
 * ProcedureInstanceView Component
 *
 * Full view of a procedure instance with:
 * - Header showing progress
 * - Task list with completion states
 * - Ability to mark tasks complete/incomplete
 * - Notes on completions
 * - Comments support (uses existing comment system)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import clsx from 'clsx';
import type { AdminTask, ProcedureTaskCompletion, TaskPriority, AdminTaskComment } from '../../../../db/schema/checklistCalendar.schema';
import {
  getProcedureInstanceWithTasks,
  completeProcedureTask,
  uncompleteProcedureTask,
  completeProcedureInstance,
  cancelProcedureInstance,
  refreshProcedureTaskCount,
  type ProcedureInstanceWithTasks,
} from '../../services/ProcedureService';
import { createTask, updateTask } from '../../services/TaskService';
import {
  getCommentsForTask,
  createComment,
  deleteComment,
  getCommentCount,
} from '../../services/CommentService';
import styles from './ProcedureInstanceView.module.css';

// =============================================================================
// TYPES
// =============================================================================

export interface ProcedureInstanceViewProps {
  instanceId: string;
  userId: string;
  userName: string;
  onBack: () => void;
  onUpdated: () => void;
}

type ViewMode = 'all' | 'remaining';

// =============================================================================
// COMPONENT
// =============================================================================

export function ProcedureInstanceView({
  instanceId,
  userId,
  userName,
  onBack,
  onUpdated,
}: ProcedureInstanceViewProps) {
  const [instance, setInstance] = useState<ProcedureInstanceWithTasks | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('remaining');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const viewModeRef = useRef<ViewMode>(viewMode);

  // Comments state - show comments panel when task is expanded
  const [expandedCommentsTaskId, setExpandedCommentsTaskId] = useState<string | null>(null);
  const [taskComments, setTaskComments] = useState<AdminTaskComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  // Task editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');

  // Calendar scheduling state
  const [schedulingTaskId, setSchedulingTaskId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');

  // Load instance data
  const loadInstance = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getProcedureInstanceWithTasks(instanceId);
      if (result.success) {
        setInstance(result.data);
      } else {
        setError(result.error?.message || 'Failed to load procedure');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  // Keep ref in sync with state
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // Check if a task is completed
  const isTaskCompleted = useCallback((taskId: string): ProcedureTaskCompletion | undefined => {
    return instance?.completions.find((c) => c.task_id === taskId);
  }, [instance?.completions]);

  // Toggle task completion
  const handleToggleTask = async (task: AdminTask) => {
    if (!instance) return;

    const completion = isTaskCompleted(task.id);
    const currentViewMode = viewModeRef.current;

    try {
      if (completion) {
        // Uncomplete the task
        await uncompleteProcedureTask(instanceId, task.id);
      } else {
        // Complete the task
        await completeProcedureTask(instanceId, task.id, userId, userName, null);
      }
      await loadInstance();
      // Preserve view mode after reload
      setViewMode(currentViewMode);
      onUpdated();
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  // Load comment counts for all tasks
  const loadCommentCounts = useCallback(async (tasks: AdminTask[]) => {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      const result = await getCommentCount(task.id);
      if (result.success) {
        counts[task.id] = result.data;
      }
    }
    setCommentCounts(counts);
  }, []);

  // Load comment counts when instance is loaded
  useEffect(() => {
    if (instance?.tasks) {
      loadCommentCounts(instance.tasks);
    }
  }, [instance?.tasks, loadCommentCounts]);

  // Load comments for a specific task
  const loadCommentsForTask = async (taskId: string) => {
    setIsLoadingComments(true);
    try {
      const result = await getCommentsForTask(taskId);
      if (result.success) {
        setTaskComments(result.data);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setIsLoadingComments(false);
    }
  };

  // Toggle comments panel for a task
  const handleToggleComments = async (taskId: string) => {
    if (expandedCommentsTaskId === taskId) {
      // Close the panel
      setExpandedCommentsTaskId(null);
      setTaskComments([]);
      setNewCommentText('');
    } else {
      // Open and load comments
      setExpandedCommentsTaskId(taskId);
      await loadCommentsForTask(taskId);
    }
  };

  // Add a new comment
  const handleAddComment = async (taskId: string) => {
    if (!newCommentText.trim() || !instance) return;

    try {
      // Generate initials from user name (with safety checks)
      const initials = userName
        ? userName
            .split(' ')
            .filter((n) => n.length > 0)
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'U'
        : 'U';

      const result = await createComment({
        taskId,
        authorId: userId,
        authorName: userName || 'User',
        authorInitials: initials,
        content: newCommentText.trim(),
      });

      if (result.success) {
        // Refresh comments and counts
        await loadCommentsForTask(taskId);
        setCommentCounts((prev) => ({
          ...prev,
          [taskId]: (prev[taskId] || 0) + 1,
        }));
        setNewCommentText('');
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  // Delete a comment
  const handleDeleteComment = async (commentId: string, taskId: string) => {
    try {
      const result = await deleteComment(commentId, userId);
      if (result.success) {
        // Refresh comments and counts
        await loadCommentsForTask(taskId);
        setCommentCounts((prev) => ({
          ...prev,
          [taskId]: Math.max(0, (prev[taskId] || 0) - 1),
        }));
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  // Start editing a task
  const handleStartEdit = (task: AdminTask) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
  };

  // Save task edits
  const handleSaveEdit = async (taskId: string) => {
    try {
      await updateTask(taskId, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        priority: editPriority,
        userId,
      });
      await loadInstance();
      setEditingTaskId(null);
      onUpdated();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  // Schedule task on calendar
  const handleScheduleTask = async (task: AdminTask) => {
    if (!scheduleDate) return;

    try {
      // Parse date string as local date (not UTC) to avoid timezone shift
      // HTML date input gives "YYYY-MM-DD" format
      const parts = scheduleDate.split('-').map(Number);
      const year = parts[0] ?? new Date().getFullYear();
      const month = parts[1] ?? 1;
      const day = parts[2] ?? 1;
      const localDate = new Date(year, month - 1, day, 12, 0, 0); // noon to avoid DST issues

      await updateTask(task.id, {
        scheduledDate: localDate,
        userId,
      });
      await loadInstance();
      setSchedulingTaskId(null);
      setScheduleDate('');
      onUpdated();
    } catch (err) {
      console.error('Failed to schedule task:', err);
    }
  };

  // Add a new task to the procedure
  const handleAddTask = async () => {
    if (!instance || !newTaskTitle.trim()) return;

    try {
      await createTask({
        checklistId: instance.checklist_id,
        companyId: instance.company_id,
        userId,
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
      });
      // Refresh the task count on the procedure instance
      await refreshProcedureTaskCount(instanceId);
      await loadInstance();
      setNewTaskTitle('');
      setNewTaskPriority('medium');
      setShowAddTask(false);
      onUpdated();
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  };

  // Mark entire procedure as complete
  const handleMarkComplete = async () => {
    if (!instance) return;

    try {
      await completeProcedureInstance(instanceId, userId);
      await loadInstance();
      onUpdated();
    } catch (err) {
      console.error('Failed to complete procedure:', err);
    }
  };

  // Cancel procedure
  const handleCancel = async () => {
    if (!instance) return;

    if (!confirm('Are you sure you want to cancel this procedure? This cannot be undone.')) {
      return;
    }

    try {
      await cancelProcedureInstance(instanceId, userId);
      await loadInstance();
      onUpdated();
    } catch (err) {
      console.error('Failed to cancel procedure:', err);
    }
  };

  // Filter tasks based on view mode
  const filteredTasks = instance?.tasks.filter((task) => {
    if (viewMode === 'remaining') {
      return !isTaskCompleted(task.id);
    }
    return true;
  }) || [];

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading procedure...</div>
      </div>
    );
  }

  // Error state
  if (error || !instance) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>{error || 'Procedure not found'}</p>
          <button type="button" onClick={onBack} className={styles.backButton}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const progressPercent = instance.total_tasks > 0
    ? Math.round((instance.completed_tasks / instance.total_tasks) * 100)
    : 0;

  const isComplete = instance.status === 'completed';
  const isCancelled = instance.status === 'cancelled';
  const isInProgress = instance.status === 'in_progress';
  const allTasksComplete = instance.completed_tasks === instance.total_tasks;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button type="button" onClick={onBack} className={styles.backLink}>
          ← Back to Procedures
        </button>

        <div className={styles.headerMain}>
          <div className={styles.headerInfo}>
            <h1 className={styles.instanceName}>{instance.name}</h1>
            <p className={styles.templateName}>
              {instance.checklist.name}
              <span className={styles.headerMeta}>
                · Started {formatDate(instance.started_at)} by {instance.started_by_name}
              </span>
            </p>
          </div>

          {isInProgress && (
            <div className={styles.headerActions}>
              {allTasksComplete && (
                <button
                  type="button"
                  onClick={handleMarkComplete}
                  className={styles.completeButton}
                >
                  Mark Complete
                </button>
              )}
              <button
                type="button"
                onClick={handleCancel}
                className={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className={styles.progressSection}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className={styles.progressText}>
            {progressPercent}% · {instance.completed_tasks} of {instance.total_tasks} complete
          </span>
        </div>

        {/* Status badge for completed/cancelled */}
        {(isComplete || isCancelled) && (
          <div className={clsx(
            styles.statusBadge,
            isComplete && styles.statusComplete,
            isCancelled && styles.statusCancelled
          )}>
            {isComplete ? 'Completed' : 'Cancelled'} {formatDate(instance.completed_at || instance.updated_at)}
          </div>
        )}
      </div>

      {/* Toolbar: View toggle + Add task */}
      <div className={styles.toolbar}>
        <div className={styles.viewToggle}>
          <button
            type="button"
            className={clsx(styles.toggleButton, viewMode === 'all' && styles.active)}
            onClick={() => setViewMode('all')}
          >
            All ({instance.total_tasks})
          </button>
          <button
            type="button"
            className={clsx(styles.toggleButton, viewMode === 'remaining' && styles.active)}
            onClick={() => setViewMode('remaining')}
          >
            Remaining ({instance.total_tasks - instance.completed_tasks})
          </button>
        </div>

        {isInProgress && (
          <button
            type="button"
            className={styles.addTaskButton}
            onClick={() => setShowAddTask(!showAddTask)}
          >
            + Add Task
          </button>
        )}
      </div>

      {/* Add task form */}
      {showAddTask && (
        <div className={styles.addTaskForm}>
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="New task title..."
            className={styles.addTaskInput}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
          />
          <select
            value={newTaskPriority}
            onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
            className={styles.prioritySelect}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="none">None</option>
          </select>
          <button
            type="button"
            onClick={handleAddTask}
            className={styles.addTaskSubmit}
            disabled={!newTaskTitle.trim()}
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => { setShowAddTask(false); setNewTaskTitle(''); }}
            className={styles.addTaskCancel}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Task list */}
      <div className={styles.taskList}>
        {filteredTasks.length === 0 ? (
          <div className={styles.emptyTasks}>
            {viewMode === 'remaining' ? 'All tasks completed!' : 'No tasks in this procedure.'}
          </div>
        ) : (
          filteredTasks.map((task, index) => {
            const completion = isTaskCompleted(task.id);

            return (
              <div
                key={task.id}
                className={clsx(
                  styles.taskCard,
                  completion && styles.taskCompleted,
                  !isInProgress && styles.taskReadonly
                )}
              >
                <div className={styles.taskMain}>
                  {/* Checkbox */}
                  <button
                    type="button"
                    className={clsx(styles.checkbox, completion && styles.checked)}
                    onClick={() => isInProgress && handleToggleTask(task)}
                    disabled={!isInProgress}
                    aria-label={completion ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {completion ? '✓' : index + 1}
                  </button>

                  {/* Task content */}
                  <div className={styles.taskContent}>
                    <span className={clsx(styles.taskTitle, completion && styles.completedTitle)}>
                      {task.title}
                    </span>
                    {task.priority !== 'none' && (
                      <span className={clsx(styles.priorityBadge, styles[task.priority])}>
                        {task.priority}
                      </span>
                    )}
                    {/* Comment count indicator */}
                    {(commentCounts[task.id] || 0) > 0 && (
                      <span className={styles.commentCountBadge}>
                        💬 {commentCounts[task.id]}
                      </span>
                    )}
                  </div>

                  {/* Action buttons on the right */}
                  <div className={styles.taskActions}>
                    <button
                      type="button"
                      className={clsx(
                        styles.actionButton,
                        expandedCommentsTaskId === task.id && styles.actionButtonActive
                      )}
                      onClick={() => handleToggleComments(task.id)}
                      title={expandedCommentsTaskId === task.id ? 'Hide comments' : 'View/add comments'}
                    >
                      <span className={styles.actionIcon}>💬</span>
                    </button>
                    {isInProgress && (
                      <>
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => handleStartEdit(task)}
                          title="Edit task"
                        >
                          <span className={styles.actionIcon}>✏️</span>
                        </button>
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => { setSchedulingTaskId(task.id); setScheduleDate(''); }}
                          title="Add to calendar"
                        >
                          <span className={styles.actionIcon}>📅</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Edit task form */}
                {editingTaskId === task.id && (
                  <div className={styles.editTaskForm}>
                    <div className={styles.editField}>
                      <label className={styles.editLabel}>Title</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className={styles.editInput}
                        autoFocus
                      />
                    </div>
                    <div className={styles.editField}>
                      <label className={styles.editLabel}>Description</label>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className={styles.editTextarea}
                        rows={3}
                        placeholder="Add a description..."
                      />
                    </div>
                    <div className={styles.editField}>
                      <label className={styles.editLabel}>Priority</label>
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                        className={styles.editSelect}
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                    <div className={styles.editActions}>
                      <button
                        type="button"
                        onClick={() => setEditingTaskId(null)}
                        className={styles.editCancelButton}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(task.id)}
                        className={styles.editSaveButton}
                        disabled={!editTitle.trim()}
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}

                {/* Calendar scheduling form */}
                {schedulingTaskId === task.id && (
                  <div className={styles.scheduleForm}>
                    <div className={styles.scheduleHeader}>
                      <span className={styles.scheduleTitle}>Schedule this task</span>
                    </div>
                    <div className={styles.scheduleField}>
                      <label className={styles.scheduleLabel}>Select date:</label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className={styles.scheduleDateInput}
                        min={new Date().toISOString().split('T')[0]}
                        autoFocus
                      />
                    </div>
                    {task.scheduled_date && (
                      <p className={styles.currentSchedule}>
                        Currently scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
                      </p>
                    )}
                    <div className={styles.scheduleActions}>
                      <button
                        type="button"
                        onClick={() => { setSchedulingTaskId(null); setScheduleDate(''); }}
                        className={styles.scheduleCancelButton}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleScheduleTask(task)}
                        className={styles.scheduleSubmitButton}
                        disabled={!scheduleDate}
                      >
                        Add to Calendar
                      </button>
                    </div>
                  </div>
                )}

                {/* Comments panel - shown when expanded */}
                {expandedCommentsTaskId === task.id && (
                  <div className={styles.commentsPanel}>
                    <div className={styles.commentsPanelHeader}>
                      <span className={styles.commentsPanelTitle}>
                        💬 Comments {taskComments.length > 0 && `(${taskComments.length})`}
                      </span>
                      <button
                        type="button"
                        className={styles.closeCommentsButton}
                        onClick={() => handleToggleComments(task.id)}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Comments list */}
                    <div className={styles.commentsList}>
                      {isLoadingComments ? (
                        <p className={styles.commentsLoading}>Loading comments...</p>
                      ) : taskComments.length === 0 ? (
                        <p className={styles.noComments}>No comments yet. Be the first to add one!</p>
                      ) : (
                        taskComments.map((comment) => (
                          <div key={comment.id} className={styles.commentItem}>
                            <div className={styles.commentHeader}>
                              <span className={styles.commentAuthorInitials}>
                                {comment.author_initials || (comment.author_name ? comment.author_name.slice(0, 2).toUpperCase() : '??')}
                              </span>
                              <span className={styles.commentAuthorName}>{comment.author_name || 'Unknown'}</span>
                              <span className={styles.commentTime}>
                                {formatDate(comment.created_at)}
                              </span>
                              {comment.author_id === userId && (
                                <button
                                  type="button"
                                  className={styles.deleteCommentButton}
                                  onClick={() => handleDeleteComment(comment.id, task.id)}
                                  title="Delete comment"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                            <div className={styles.commentContent}>
                              {comment.content}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add comment form */}
                    <div className={styles.addCommentForm}>
                      <textarea
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        placeholder="Add a comment..."
                        className={styles.commentTextarea}
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment(task.id);
                          }
                        }}
                      />
                      <div className={styles.addCommentActions}>
                        <span className={styles.postingAs}>Posting as {userName}</span>
                        <button
                          type="button"
                          onClick={() => handleAddComment(task.id)}
                          className={styles.postCommentButton}
                          disabled={!newCommentText.trim()}
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Completion info - for readonly/completed procedures */}
                {!isInProgress && completion && (
                  <div className={styles.readonlyCompletion}>
                    <span className={styles.completionMeta}>
                      ✓ {formatDate(completion.completed_at)} by {completion.completed_by_name}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (days === 1) {
    return 'yesterday';
  }
  if (days < 7) {
    return `${days} days ago`;
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

ProcedureInstanceView.displayName = 'ProcedureInstanceView';
