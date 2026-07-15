/**
 * ChecklistManager Component
 *
 * Manages checklists and tasks outside of the setup wizard.
 * Allows CRUD operations on checklists and tasks.
 *
 * Requirements:
 * - CK-H1: ChecklistManager page
 * - CK-H2: Checklist CRUD UI
 * - CK-H3: Task CRUD outside wizard
 * - CK-H4: Checklist archiving
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { useState, useCallback, useEffect } from 'react';
import clsx from 'clsx';
import type {
  AdminChecklist,
  AdminTask,
  ChecklistRecurrenceType,
  TaskPriority,
} from '../../../../db/schema/checklistCalendar.schema';
import { CHECKLIST_COLORS } from '../../../../db/schema/checklistCalendar.schema';
import {
  getChecklists,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  archiveChecklist,
  unarchiveChecklist,
  getTasksForChecklist,
  createTask,
  updateTask,
  deleteTask as deleteTaskService,
} from '../../services';
import styles from './ChecklistManager.module.css';

// =============================================================================
// TYPES
// =============================================================================

export interface ChecklistManagerProps {
  /**
   * Whether the manager is open
   */
  isOpen: boolean;

  /**
   * Callback when the manager is closed
   */
  onClose: () => void;

  /**
   * Callback when changes are made (to refresh calendar)
   */
  onRefresh?: () => void;

  /**
   * Additional CSS class name
   */
  className?: string;
}

interface ChecklistWithTasks extends AdminChecklist {
  tasks: AdminTask[];
  isExpanded: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RECURRENCE_OPTIONS: Array<{ value: ChecklistRecurrenceType; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'none', label: 'None' },
];

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface ChecklistFormProps {
  checklist?: AdminChecklist;
  onSave: (data: Partial<AdminChecklist>) => void;
  onCancel: () => void;
}

function ChecklistForm({ checklist, onSave, onCancel }: ChecklistFormProps) {
  const [name, setName] = useState(checklist?.name || '');
  const [description, setDescription] = useState(checklist?.description || '');
  const [color, setColor] = useState(checklist?.color || CHECKLIST_COLORS[0].value);
  const [recurrence, setRecurrence] = useState<ChecklistRecurrenceType>(
    checklist?.recurrence_type || 'weekly'
  );
  const [excludeWeekends, setExcludeWeekends] = useState(
    checklist?.exclude_weekends ?? false
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      recurrence_type: recurrence,
      exclude_weekends: excludeWeekends,
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label className={styles.label}>Name</label>
        <input
          type="text"
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Checklist name"
          required
          autoFocus
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Description (optional)</label>
        <textarea
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description"
          rows={2}
        />
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Color</label>
          <div className={styles.colorPicker}>
            {CHECKLIST_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={clsx(styles.colorOption, color === c.value && styles.selected)}
                style={{ backgroundColor: c.value }}
                onClick={() => setColor(c.value)}
                aria-label={`Select color ${c.name}`}
              />
            ))}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Recurrence</label>
          <select
            className={styles.select}
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as ChecklistRecurrenceType)}
          >
            {RECURRENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.weekendCheckbox}>
          <input
            type="checkbox"
            checked={excludeWeekends}
            onChange={(e) => setExcludeWeekends(e.target.checked)}
          />
          <span>Exclude weekends (Saturday & Sunday)</span>
        </label>
      </div>

      <div className={styles.formActions}>
        <button type="button" className={styles.cancelButton} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={styles.saveButton} disabled={!name.trim()}>
          {checklist ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

interface TaskFormProps {
  task?: AdminTask;
  onSave: (data: Partial<AdminTask>) => void;
  onCancel: () => void;
}

function TaskForm({ task, onSave, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
    });
  };

  return (
    <form className={styles.taskForm} onSubmit={handleSubmit}>
      <input
        type="text"
        className={styles.taskInput}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        required
        autoFocus
      />

      <select
        className={styles.taskPrioritySelect}
        value={priority}
        onChange={(e) => setPriority(e.target.value as TaskPriority)}
      >
        {PRIORITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div className={styles.taskFormActions}>
        <button type="button" className={styles.taskCancelButton} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={styles.taskSaveButton} disabled={!title.trim()}>
          {task ? 'Update' : 'Add'}
        </button>
      </div>
    </form>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const COMPANY_ID = 'demo-company';
const USER_ID = 'demo-user';

export function ChecklistManager({
  isOpen,
  onClose,
  onRefresh,
  className,
}: ChecklistManagerProps) {
  const [checklists, setChecklists] = useState<ChecklistWithTasks[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<AdminChecklist | null>(null);
  const [isCreatingChecklist, setIsCreatingChecklist] = useState(false);
  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<{ checklistId: string; task: AdminTask } | null>(null);

  // Confirmation modal state
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'checklist' | 'task';
    id: string;
    name: string;
  } | null>(null);

  // Load checklists
  const loadChecklists = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getChecklists(COMPANY_ID, { includeArchived: showArchived });
      if (result.success === false) {
        setError(result.error.message);
        return;
      }

      // Load tasks for each checklist
      const checklistsWithTasks: ChecklistWithTasks[] = await Promise.all(
        result.data.map(async (checklist) => {
          const tasksResult = await getTasksForChecklist(checklist.id);
          return {
            ...checklist,
            tasks: tasksResult.success ? tasksResult.data : [],
            isExpanded: false,
          };
        })
      );

      setChecklists(checklistsWithTasks);
    } catch {
      setError('Failed to load checklists');
    } finally {
      setIsLoading(false);
    }
  }, [showArchived]);

  // Initial load
  useEffect(() => {
    if (isOpen) {
      loadChecklists();
    }
  }, [isOpen, loadChecklists]);

  // Toggle checklist expansion
  const toggleExpand = useCallback((checklistId: string) => {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId ? { ...c, isExpanded: !c.isExpanded } : c
      )
    );
  }, []);

  // Create checklist
  const handleCreateChecklist = useCallback(
    async (data: Partial<AdminChecklist>) => {
      try {
        const result = await createChecklist({
          companyId: COMPANY_ID,
          name: data.name!,
          description: data.description,
          color: data.color,
          recurrenceType: data.recurrence_type || 'weekly',
          excludeWeekends: data.exclude_weekends,
        });

        if (result.success) {
          setIsCreatingChecklist(false);
          loadChecklists();
          onRefresh?.();
        }
      } catch {
        setError('Failed to create checklist');
      }
    },
    [loadChecklists, onRefresh]
  );

  // Update checklist
  const handleUpdateChecklist = useCallback(
    async (data: Partial<AdminChecklist>) => {
      if (!editingChecklist) return;

      try {
        // Map snake_case form data to camelCase service input
        const result = await updateChecklist(editingChecklist.id, {
          name: data.name,
          description: data.description,
          color: data.color,
          recurrenceType: data.recurrence_type,
          excludeWeekends: data.exclude_weekends,
        });

        if (result.success) {
          setEditingChecklist(null);
          loadChecklists();
          onRefresh?.();
        }
      } catch {
        setError('Failed to update checklist');
      }
    },
    [editingChecklist, loadChecklists, onRefresh]
  );

  // Request checklist deletion (shows confirmation modal)
  const requestDeleteChecklist = useCallback((checklist: ChecklistWithTasks) => {
    setConfirmDelete({
      type: 'checklist',
      id: checklist.id,
      name: checklist.name,
    });
  }, []);

  // Delete checklist (after confirmation)
  const handleDeleteChecklist = useCallback(
    async (checklistId: string) => {
      try {
        const result = await deleteChecklist(checklistId);

        if (result.success) {
          loadChecklists();
          onRefresh?.();
        }
      } catch {
        setError('Failed to delete checklist');
      } finally {
        setConfirmDelete(null);
      }
    },
    [loadChecklists, onRefresh]
  );

  // Archive/unarchive checklist
  const handleToggleArchive = useCallback(
    async (checklist: AdminChecklist) => {
      try {
        const result = checklist.is_archived
          ? await unarchiveChecklist(checklist.id)
          : await archiveChecklist(checklist.id);

        if (result.success) {
          loadChecklists();
          onRefresh?.();
        }
      } catch {
        setError('Failed to archive/unarchive checklist');
      }
    },
    [loadChecklists, onRefresh]
  );

  // Create task
  const handleCreateTask = useCallback(
    async (checklistId: string, data: Partial<AdminTask>) => {
      try {
        const result = await createTask({
          checklistId,
          companyId: COMPANY_ID,
          userId: USER_ID,
          title: data.title!,
          description: data.description,
          priority: data.priority,
        });

        if (result.success) {
          setAddingTaskTo(null);
          loadChecklists();
          onRefresh?.();
        }
      } catch {
        setError('Failed to create task');
      }
    },
    [loadChecklists, onRefresh]
  );

  // Update task
  const handleUpdateTask = useCallback(
    async (data: Partial<AdminTask>) => {
      if (!editingTask) return;

      try {
        const result = await updateTask(editingTask.task.id, data);

        if (result.success) {
          setEditingTask(null);
          loadChecklists();
          onRefresh?.();
        }
      } catch {
        setError('Failed to update task');
      }
    },
    [editingTask, loadChecklists, onRefresh]
  );

  // Request task deletion (shows confirmation modal)
  const requestDeleteTask = useCallback((task: AdminTask) => {
    setConfirmDelete({
      type: 'task',
      id: task.id,
      name: task.title,
    });
  }, []);

  // Delete task (after confirmation)
  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      try {
        const result = await deleteTaskService(taskId);

        if (result.success) {
          loadChecklists();
          onRefresh?.();
        }
      } catch {
        setError('Failed to delete task');
      } finally {
        setConfirmDelete(null);
      }
    },
    [loadChecklists, onRefresh]
  );

  // Handle confirmation
  const handleConfirmDelete = useCallback(() => {
    if (!confirmDelete) return;

    if (confirmDelete.type === 'checklist') {
      handleDeleteChecklist(confirmDelete.id);
    } else {
      handleDeleteTask(confirmDelete.id);
    }
  }, [confirmDelete, handleDeleteChecklist, handleDeleteTask]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checklist-manager-title"
    >
      <div className={clsx(styles.manager, className)}>
        {/* Header */}
        <div className={styles.header}>
          <h2 id="checklist-manager-title" className={styles.title}>
            Manage Checklists
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => setIsCreatingChecklist(true)}
          >
            + New Checklist
          </button>

          <label className={styles.archiveToggle}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className={styles.error} role="alert">
            {error}
            <button type="button" onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* Confirmation Modal */}
        {confirmDelete && (
          <div className={styles.confirmOverlay}>
            <div className={styles.confirmModal}>
              <h3 className={styles.confirmTitle}>
                Delete {confirmDelete.type === 'checklist' ? 'Checklist' : 'Task'}?
              </h3>
              <p className={styles.confirmMessage}>
                {confirmDelete.type === 'checklist' ? (
                  <>
                    Are you sure you want to delete <strong>"{confirmDelete.name}"</strong> and all its tasks?
                    This action cannot be undone.
                  </>
                ) : (
                  <>
                    Are you sure you want to delete the task <strong>"{confirmDelete.name}"</strong>?
                    This action cannot be undone.
                  </>
                )}
              </p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setConfirmDelete(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={handleConfirmDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loading}>Loading...</div>
          ) : checklists.length === 0 ? (
            <div className={styles.empty}>
              <p>No checklists yet. Create one to get started!</p>
            </div>
          ) : (
            <div className={styles.checklistList}>
              {/* Create checklist form */}
              {isCreatingChecklist && (
                <div className={styles.checklistCard}>
                  <ChecklistForm
                    onSave={handleCreateChecklist}
                    onCancel={() => setIsCreatingChecklist(false)}
                  />
                </div>
              )}

              {/* Checklists */}
              {checklists.map((checklist) => (
                <div
                  key={checklist.id}
                  className={clsx(
                    styles.checklistCard,
                    checklist.is_archived && styles.archived
                  )}
                  style={{ '--checklist-color': checklist.color } as React.CSSProperties}
                >
                  {editingChecklist?.id === checklist.id ? (
                    <ChecklistForm
                      checklist={checklist}
                      onSave={handleUpdateChecklist}
                      onCancel={() => setEditingChecklist(null)}
                    />
                  ) : (
                    <>
                      {/* Checklist header */}
                      <div className={styles.checklistHeader}>
                        <button
                          type="button"
                          className={styles.expandButton}
                          onClick={() => toggleExpand(checklist.id)}
                          aria-expanded={checklist.isExpanded}
                        >
                          {checklist.isExpanded ? '▼' : '▶'}
                        </button>

                        <div className={styles.checklistInfo}>
                          <span className={styles.checklistName}>{checklist.name}</span>
                          <span className={styles.checklistMeta}>
                            {checklist.recurrence_type} · {checklist.tasks.length} tasks
                            {checklist.exclude_weekends && ' · weekdays only'}
                          </span>
                        </div>

                        <div className={styles.checklistActions}>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => setEditingChecklist(checklist)}
                            aria-label="Edit checklist"
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => handleToggleArchive(checklist)}
                            aria-label={checklist.is_archived ? 'Unarchive' : 'Archive'}
                            title={checklist.is_archived ? 'Restore' : 'Archive'}
                          >
                            {checklist.is_archived ? '↩' : '📦'}
                          </button>
                          <button
                            type="button"
                            className={clsx(styles.iconButton, styles.danger)}
                            onClick={() => requestDeleteChecklist(checklist)}
                            aria-label="Delete checklist"
                            title="Delete"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Tasks */}
                      {checklist.isExpanded && (
                        <div className={styles.tasksList}>
                          {checklist.tasks.map((task) => (
                            <div key={task.id} className={styles.taskItem}>
                              {editingTask?.task.id === task.id ? (
                                <TaskForm
                                  task={task}
                                  onSave={handleUpdateTask}
                                  onCancel={() => setEditingTask(null)}
                                />
                              ) : (
                                <>
                                  <span className={styles.taskTitle}>{task.title}</span>
                                  {task.priority !== 'none' && (
                                    <span
                                      className={clsx(
                                        styles.priorityBadge,
                                        styles[task.priority]
                                      )}
                                    >
                                      {task.priority}
                                    </span>
                                  )}
                                  <div className={styles.taskActions}>
                                    <button
                                      type="button"
                                      className={styles.smallButton}
                                      onClick={() =>
                                        setEditingTask({ checklistId: checklist.id, task })
                                      }
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className={clsx(styles.smallButton, styles.danger)}
                                      onClick={() => requestDeleteTask(task)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}

                          {/* Add task */}
                          {addingTaskTo === checklist.id ? (
                            <TaskForm
                              onSave={(data) => handleCreateTask(checklist.id, data)}
                              onCancel={() => setAddingTaskTo(null)}
                            />
                          ) : (
                            <button
                              type="button"
                              className={styles.addTaskButton}
                              onClick={() => setAddingTaskTo(checklist.id)}
                            >
                              + Add Task
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button type="button" className={styles.doneButton} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

ChecklistManager.displayName = 'ChecklistManager';
