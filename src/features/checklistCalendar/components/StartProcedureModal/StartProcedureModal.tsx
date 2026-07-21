/**
 * StartProcedureModal Component
 *
 * Modal for starting a new procedure instance with task selection.
 * Allows users to:
 * - Provide a label for the instance (e.g., person's name, company name)
 * - Select which tasks to include in this instance
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { AdminChecklist, AdminTask } from '../../../../db/schema/checklistCalendar.schema';
import { startProcedure, getProcedureTemplateTasks } from '../../services/ProcedureService';
import styles from './StartProcedureModal.module.css';

// =============================================================================
// TYPES
// =============================================================================

export interface StartProcedureModalProps {
  template: AdminChecklist;
  companyId: string;
  userId: string;
  userName: string;
  onClose: () => void;
  onStarted: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function StartProcedureModal({
  template,
  companyId,
  userId,
  userName,
  onClose,
  onStarted,
}: StartProcedureModalProps) {
  const [instanceName, setInstanceName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Task selection state
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Load tasks on mount
  useEffect(() => {
    async function loadTasks() {
      setLoadingTasks(true);
      const result = await getProcedureTemplateTasks(template.id);
      if (result.success) {
        setTasks(result.data);
        // Select all tasks by default
        setSelectedTaskIds(new Set(result.data.map((t) => t.id)));
      }
      setLoadingTasks(false);
    }
    loadTasks();
  }, [template.id]);

  // Focus input on mount
  useEffect(() => {
    if (!loadingTasks) {
      inputRef.current?.focus();
    }
  }, [loadingTasks]);

  // Toggle task selection
  const handleToggleTask = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  // Select all tasks
  const handleSelectAll = useCallback(() => {
    setSelectedTaskIds(new Set(tasks.map((t) => t.id)));
  }, [tasks]);

  // Deselect all tasks
  const handleDeselectAll = useCallback(() => {
    setSelectedTaskIds(new Set());
  }, []);

  // Handle submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedName = instanceName.trim();
      if (!trimmedName) {
        setError('Please provide a label for this procedure');
        return;
      }

      if (selectedTaskIds.size === 0) {
        setError('Please select at least one task');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const result = await startProcedure({
          checklistId: template.id,
          companyId,
          name: trimmedName,
          userId,
          userName,
          selectedTaskIds: Array.from(selectedTaskIds),
        });

        if (result.success) {
          onStarted();
        } else {
          setError(result.error?.message || 'Failed to start procedure');
        }
      } catch (err) {
        setError('An unexpected error occurred');
      } finally {
        setIsSubmitting(false);
      }
    },
    [instanceName, template.id, companyId, userId, userName, selectedTaskIds, onStarted]
  );

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const allSelected = selectedTaskIds.size === tasks.length && tasks.length > 0;
  const noneSelected = selectedTaskIds.size === 0;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-procedure-title"
      >
        <h2 id="start-procedure-title" className={styles.title}>
          Start: {template.name}
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Instance Name */}
          <div className={styles.field}>
            <label htmlFor="instance-name" className={styles.label}>
              Label this procedure
            </label>
            <input
              ref={inputRef}
              id="instance-name"
              type="text"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              placeholder="ex: Sally Sue, Light Corp, Project Teamwork"
              className={styles.input}
              disabled={isSubmitting || loadingTasks}
              autoComplete="off"
            />
            <p className={styles.hint}>This helps you track multiple procedures at once</p>
          </div>

          {/* Task Selection */}
          <div className={styles.taskSection}>
            <div className={styles.taskHeader}>
              <span className={styles.taskLabel}>
                Select tasks ({selectedTaskIds.size} of {tasks.length})
              </span>
              <div className={styles.taskActions}>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className={styles.textButton}
                  disabled={allSelected || loadingTasks}
                >
                  All
                </button>
                <span className={styles.separator}>|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className={styles.textButton}
                  disabled={noneSelected || loadingTasks}
                >
                  None
                </button>
              </div>
            </div>

            {loadingTasks ? (
              <div className={styles.loading}>Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className={styles.noTasks}>No tasks in this procedure</div>
            ) : (
              <div className={styles.taskList}>
                {tasks.map((task) => (
                  <label key={task.id} className={styles.taskItem}>
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.has(task.id)}
                      onChange={() => handleToggleTask(task.id)}
                      className={styles.taskCheckbox}
                      disabled={isSubmitting}
                    />
                    <span className={styles.taskTitle}>{task.title}</span>
                    {task.priority !== 'none' && (
                      <span
                        className={`${styles.priorityDot} ${styles[`priority${task.priority.charAt(0).toUpperCase()}${task.priority.slice(1)}`]}`}
                      />
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting || !instanceName.trim() || selectedTaskIds.size === 0}
            >
              {isSubmitting ? 'Starting...' : 'Start Procedure'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

StartProcedureModal.displayName = 'StartProcedureModal';
