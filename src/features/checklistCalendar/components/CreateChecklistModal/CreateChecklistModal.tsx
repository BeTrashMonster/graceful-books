/**
 * CreateChecklistModal Component
 *
 * Modal for creating a new custom checklist with full scheduling options.
 * Allows users to create their own checklists beyond the wizard templates.
 */

import { useState, useCallback } from 'react';
import clsx from 'clsx';
import type { ChecklistRecurrenceType, TaskPriority } from '../../../../db/schema/checklistCalendar.schema';
import { CHECKLIST_COLORS } from '../../../../db/schema/checklistCalendar.schema';
import { ScheduleSelector } from '../ScheduleSelector';
import type { ScheduleConfig } from '../ScheduleSelector';
import { createChecklist, createTask } from '../../services';
import styles from './CreateChecklistModal.module.css';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface TaskInput {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RECURRENCE_OPTIONS: Array<{ value: ChecklistRecurrenceType; label: string; description: string }> = [
  { value: 'daily', label: 'Daily', description: 'Tasks repeat every day' },
  { value: 'weekly', label: 'Weekly', description: 'Tasks repeat on specific days of the week' },
  { value: 'monthly', label: 'Monthly', description: 'Tasks repeat on a specific day each month' },
  { value: 'quarterly', label: 'Quarterly', description: 'Tasks repeat in specific months' },
  { value: 'annual', label: 'Annual', description: 'Tasks repeat once a year' },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'none', label: 'None' },
];

const COMPANY_ID = 'demo-company';
const USER_ID = 'demo-user';

// =============================================================================
// COMPONENT
// =============================================================================

export function CreateChecklistModal({
  isOpen,
  onClose,
  onCreated,
}: CreateChecklistModalProps) {
  // Step state
  const [step, setStep] = useState<1 | 2>(1);

  // Checklist details
  const [name, setName] = useState('');
  const [color, setColor] = useState(CHECKLIST_COLORS[0].value);
  const [recurrence, setRecurrence] = useState<ChecklistRecurrenceType>('weekly');
  const [excludeWeekends, setExcludeWeekends] = useState(false);

  // Schedule configuration
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    dailyDays: [0, 1, 2, 3, 4, 5, 6], // Default to all days
    weeklyDays: [5], // Default to Friday
    isEveryOtherWeek: false,
    biweeklyStartDate: new Date().toISOString().split('T')[0],
    monthlyScheduleType: 'day',
    monthlyDay: 15,
    monthlyWeek: 1,
    monthlyDayOfWeek: 1,
    quarterlyMonths: [3, 6, 9, 12],
    quarterlyDay: -1,
    annualMonth: 12,
    annualDay: 31,
  });

  // Tasks
  const [tasks, setTasks] = useState<TaskInput[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');

  // Loading/error state
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handlers
  const handleScheduleChange = useCallback((update: Partial<ScheduleConfig>) => {
    setScheduleConfig((prev) => ({ ...prev, ...update }));
  }, []);

  const handleAddTask = useCallback(() => {
    if (!newTaskTitle.trim()) return;

    setTasks((prev) => [
      ...prev,
      {
        id: `task-${Date.now()}`,
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim(),
        priority: newTaskPriority,
      },
    ]);
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskPriority('medium');
  }, [newTaskTitle, newTaskDescription, newTaskPriority]);

  const handleRemoveTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTask();
    }
  }, [handleAddTask]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      setError('Please enter a checklist name');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Build schedule fields based on recurrence type
      const scheduleFields: Record<string, unknown> = {};
      let actualRecurrence = recurrence;

      switch (recurrence) {
        case 'daily':
          // For daily, use weeklyDays field to store which days to show
          scheduleFields.weeklyDays = scheduleConfig.dailyDays;
          break;
        case 'weekly':
          if (scheduleConfig.isEveryOtherWeek) {
            // Convert to custom interval for biweekly
            actualRecurrence = 'custom';
            scheduleFields.customIntervalValue = 2;
            scheduleFields.customIntervalUnit = 'weeks';
            // Use the selected start date
            const startDate = new Date(scheduleConfig.biweeklyStartDate);
            scheduleFields.customStartDate = startDate.getTime();
            scheduleFields.weeklyDays = scheduleConfig.weeklyDays;
          } else {
            scheduleFields.weeklyDays = scheduleConfig.weeklyDays;
          }
          break;
        case 'monthly':
          if (scheduleConfig.monthlyScheduleType === 'day') {
            scheduleFields.monthlyDay = scheduleConfig.monthlyDay;
          } else {
            scheduleFields.monthlyWeek = scheduleConfig.monthlyWeek;
            scheduleFields.monthlyDayOfWeek = scheduleConfig.monthlyDayOfWeek;
          }
          break;
        case 'quarterly':
          scheduleFields.recurrenceMonths = scheduleConfig.quarterlyMonths;
          scheduleFields.quarterlyDay = scheduleConfig.quarterlyDay;
          break;
        case 'annual':
          scheduleFields.annualMonth = scheduleConfig.annualMonth;
          scheduleFields.annualDay = scheduleConfig.annualDay;
          break;
      }

      // Create the checklist
      const checklistResult = await createChecklist({
        companyId: COMPANY_ID,
        name: name.trim(),
        color,
        recurrenceType: actualRecurrence,
        excludeWeekends,
        ...scheduleFields,
      });

      if (!checklistResult.success) {
        setError(checklistResult.error.message);
        setIsCreating(false);
        return;
      }

      // Create tasks
      for (const task of tasks) {
        await createTask({
          checklistId: checklistResult.data.id,
          companyId: COMPANY_ID,
          userId: USER_ID,
          title: task.title,
          description: task.description || undefined,
          priority: task.priority,
        });
      }

      // Reset and close
      resetForm();
      onCreated();
      onClose();
    } catch (err) {
      setError('Failed to create checklist. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }, [name, color, recurrence, excludeWeekends, scheduleConfig, tasks, onCreated, onClose]);

  const resetForm = useCallback(() => {
    setStep(1);
    setName('');
    setColor(CHECKLIST_COLORS[0].value);
    setRecurrence('weekly');
    setExcludeWeekends(false);
    setScheduleConfig({
      dailyDays: [0, 1, 2, 3, 4, 5, 6],
      weeklyDays: [5],
      isEveryOtherWeek: false,
      biweeklyStartDate: new Date().toISOString().split('T')[0],
      monthlyScheduleType: 'day',
      monthlyDay: 15,
      monthlyWeek: 1,
      monthlyDayOfWeek: 1,
      quarterlyMonths: [3, 6, 9, 12],
      quarterlyDay: -1,
      annualMonth: 12,
      annualDay: 31,
    });
    setTasks([]);
    setNewTaskTitle('');
    setNewTaskDescription('');
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // Show exclude weekends for monthly/quarterly/annual only
  const showExcludeWeekends = recurrence === 'monthly' || recurrence === 'quarterly' || recurrence === 'annual';

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Create New Checklist</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Step indicators */}
        <div className={styles.steps}>
          <button
            type="button"
            className={clsx(styles.step, step === 1 && styles.active)}
            onClick={() => setStep(1)}
          >
            1. Details
          </button>
          <button
            type="button"
            className={clsx(styles.step, step === 2 && styles.active)}
            onClick={() => name.trim() && setStep(2)}
            disabled={!name.trim()}
          >
            2. Tasks
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className={styles.error} role="alert">
            {error}
            <button type="button" onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* Content */}
        <div className={styles.content}>
          {step === 1 ? (
            <>
              {/* Name */}
              <div className={styles.field}>
                <label className={styles.label}>Checklist Name *</label>
                <input
                  type="text"
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Payroll Tasks, Client Onboarding"
                  autoFocus
                />
              </div>

              {/* Color */}
              <div className={styles.field}>
                <label className={styles.label}>Color</label>
                <div className={styles.colorPicker}>
                  {CHECKLIST_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      className={clsx(styles.colorOption, color === c.value && styles.selected)}
                      style={{ backgroundColor: c.value }}
                      onClick={() => setColor(c.value)}
                      aria-label={`Select ${c.name}`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Recurrence */}
              <div className={styles.field}>
                <label className={styles.label}>Recurrence</label>
                <div className={styles.recurrenceOptions}>
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={clsx(
                        styles.recurrenceOption,
                        recurrence === opt.value && styles.selected
                      )}
                    >
                      <input
                        type="radio"
                        name="recurrence"
                        value={opt.value}
                        checked={recurrence === opt.value}
                        onChange={() => setRecurrence(opt.value)}
                      />
                      <div className={styles.recurrenceContent}>
                        <span className={styles.recurrenceLabel}>{opt.label}</span>
                        <span className={styles.recurrenceDesc}>{opt.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Schedule Selector - always show */}
              <div className={styles.field}>
                <ScheduleSelector
                  recurrenceType={recurrence}
                  config={scheduleConfig}
                  onChange={handleScheduleChange}
                />
              </div>

              {/* Exclude Weekends - only for monthly/quarterly/annual */}
              {showExcludeWeekends && (
                <div className={styles.field}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={excludeWeekends}
                      onChange={(e) => setExcludeWeekends(e.target.checked)}
                    />
                    <span>Exclude Sat/Sun (tasks shift to Monday)</span>
                  </label>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Task list */}
              <div className={styles.taskSection}>
                <p className={styles.taskHint}>
                  Add tasks to your checklist. You can always add more later.
                </p>

                {/* Add task form */}
                <div className={styles.addTaskFormExpanded}>
                  <div className={styles.taskFormRow}>
                    <input
                      type="text"
                      className={styles.taskInput}
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Task title *"
                    />
                    <select
                      className={styles.prioritySelect}
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                    >
                      {PRIORITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    className={styles.taskDescriptionInput}
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Description (optional) - explain what needs to be done"
                    rows={2}
                  />
                  <button
                    type="button"
                    className={styles.addTaskButton}
                    onClick={handleAddTask}
                    disabled={!newTaskTitle.trim()}
                  >
                    Add Task
                  </button>
                </div>

                {/* Task list */}
                {tasks.length > 0 ? (
                  <div className={styles.taskList}>
                    {tasks.map((task, index) => (
                      <div key={task.id} className={styles.taskItem}>
                        <span className={styles.taskNumber}>{index + 1}.</span>
                        <div className={styles.taskDetails}>
                          <span className={styles.taskTitle}>{task.title}</span>
                          {task.description && (
                            <span className={styles.taskDescription}>{task.description}</span>
                          )}
                        </div>
                        {task.priority !== 'none' && (
                          <span className={clsx(styles.priorityBadge, styles[task.priority])}>
                            {task.priority}
                          </span>
                        )}
                        <button
                          type="button"
                          className={styles.removeTaskButton}
                          onClick={() => handleRemoveTask(task.id)}
                          aria-label="Remove task"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.noTasks}>
                    <p>No tasks added yet. Add at least one task to get started!</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {step === 1 ? (
            <>
              <button type="button" className={styles.cancelButton} onClick={handleClose}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.nextButton}
                onClick={() => setStep(2)}
                disabled={!name.trim()}
              >
                Next: Add Tasks
              </button>
            </>
          ) : (
            <>
              <button type="button" className={styles.backButton} onClick={() => setStep(1)}>
                Back
              </button>
              <button
                type="button"
                className={styles.createButton}
                onClick={handleCreate}
                disabled={isCreating || tasks.length === 0}
              >
                {isCreating ? 'Creating...' : `Create Checklist (${tasks.length} tasks)`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

CreateChecklistModal.displayName = 'CreateChecklistModal';
