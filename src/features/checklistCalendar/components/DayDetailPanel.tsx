/**
 * DayDetailPanel Component
 *
 * Displays detailed task list for a selected day.
 * Shows all tasks with ability to check them off and view details.
 */

import { useMemo } from 'react';
import clsx from 'clsx';
import type { CalendarDay } from '../services/CalendarService';
import styles from './DayDetailPanel.module.css';

// =============================================================================
// TYPES
// =============================================================================

export interface DayDetailPanelProps {
  /**
   * Selected day data
   */
  day: CalendarDay | null;

  /**
   * Callback when a task is clicked to view details
   */
  onTaskClick?: (taskId: string, date: Date) => void;

  /**
   * Callback when a task completion is toggled
   */
  onTaskToggle?: (taskId: string, date: Date) => void;

  /**
   * Additional CSS class name
   */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DayDetailPanel({
  day,
  onTaskClick,
  onTaskToggle,
  className,
}: DayDetailPanelProps) {
  // Format the date for display
  const formattedDate = useMemo(() => {
    if (!day) return '';
    return day.date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [day]);

  // Group tasks by checklist
  const tasksByChecklist = useMemo(() => {
    if (!day) return [];

    const groups = new Map<string, {
      checklist: typeof day.tasks[0]['checklist'];
      tasks: typeof day.tasks;
    }>();

    for (const task of day.tasks) {
      const checklistId = task.checklist.id;
      if (!groups.has(checklistId)) {
        groups.set(checklistId, {
          checklist: task.checklist,
          tasks: [],
        });
      }
      groups.get(checklistId)!.tasks.push(task);
    }

    return Array.from(groups.values());
  }, [day]);

  if (!day) {
    return (
      <div className={clsx(styles.panel, styles.empty, className)}>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📅</span>
          <p className={styles.emptyText}>Select a day to view tasks</p>
        </div>
      </div>
    );
  }

  const hasNoTasks = day.tasks.length === 0;

  return (
    <div className={clsx(styles.panel, className)}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.dateTitle}>{formattedDate}</h2>
        {day.isToday && <span className={styles.todayBadge}>Today</span>}
      </div>

      {/* Summary */}
      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryNumber}>{day.totalTasks}</span>
          <span className={styles.summaryLabel}>Tasks</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryNumber}>{day.completedTasks}</span>
          <span className={styles.summaryLabel}>Completed</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={clsx(
            styles.summaryNumber,
            day.percentComplete === 100 && styles.complete
          )}>
            {day.percentComplete}%
          </span>
          <span className={styles.summaryLabel}>Progress</span>
        </div>
      </div>

      {/* Progress bar */}
      {day.totalTasks > 0 && (
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${day.percentComplete}%` }}
          />
        </div>
      )}

      {/* Tasks */}
      <div className={styles.tasksContainer}>
        {hasNoTasks ? (
          <div className={styles.noTasks}>
            <p>No tasks scheduled for this day</p>
          </div>
        ) : (
          tasksByChecklist.map(({ checklist, tasks }) => (
            <div
              key={checklist.id}
              className={styles.checklistGroup}
              style={{ '--checklist-color': checklist.color } as React.CSSProperties}
            >
              <div className={styles.checklistHeader}>
                <span
                  className={styles.checklistDot}
                  style={{ backgroundColor: checklist.color }}
                />
                <span className={styles.checklistName}>{checklist.name}</span>
                <span className={styles.checklistCount}>
                  {tasks.reduce((acc, t) => acc + (t.isComplete ? 1 : 0) + t.subTasks.filter(st => st.isComplete).length, 0)}/
                  {tasks.reduce((acc, t) => acc + 1 + t.subTasks.length, 0)}
                </span>
              </div>
              <div className={styles.taskList}>
                {tasks.map((calendarTask) => (
                  <div key={calendarTask.task.id} className={styles.taskGroup}>
                    <div
                      className={clsx(
                        styles.taskItem,
                        calendarTask.isComplete && styles.completed
                      )}
                    >
                      <input
                        type="checkbox"
                        className={styles.taskCheckbox}
                        checked={calendarTask.isComplete}
                        onChange={() => onTaskToggle?.(calendarTask.task.id, day.date)}
                        aria-label={`Mark "${calendarTask.task.title}" as ${calendarTask.isComplete ? 'incomplete' : 'complete'}`}
                      />
                      <div
                        className={styles.taskContent}
                        onClick={() => onTaskClick?.(calendarTask.task.id, day.date)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onTaskClick?.(calendarTask.task.id, day.date);
                          }
                        }}
                      >
                        <span className={styles.taskTitle}>
                          {calendarTask.task.title}
                          {calendarTask.subTasks.length > 0 && (
                            <span className={styles.subTaskCount}>
                              ({calendarTask.subTasks.filter(st => st.isComplete).length}/{calendarTask.subTasks.length})
                            </span>
                          )}
                        </span>
                        {/* Show procedure instance name(s) for procedure tasks */}
                        {calendarTask.procedureInstances && calendarTask.procedureInstances.length > 0 ? (
                          <span className={styles.procedureBadge}>
                            {calendarTask.procedureInstances.map(i => i.name).join(', ')}
                          </span>
                        ) : (
                          /* Show priority badge for non-procedure tasks */
                          calendarTask.task.priority !== 'none' && (
                            <span className={clsx(
                              styles.priorityBadge,
                              styles[calendarTask.task.priority]
                            )}>
                              {calendarTask.task.priority}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                    {/* Subtasks */}
                    {calendarTask.subTasks.length > 0 && (
                      <div className={styles.subTaskList}>
                        {calendarTask.subTasks.map((subTask) => (
                          <div
                            key={subTask.task.id}
                            className={clsx(
                              styles.subTaskItem,
                              subTask.isComplete && styles.completed
                            )}
                          >
                            <input
                              type="checkbox"
                              className={styles.subTaskCheckbox}
                              checked={subTask.isComplete}
                              onChange={() => onTaskToggle?.(subTask.task.id, day.date)}
                              aria-label={`Mark subtask "${subTask.task.title}" as ${subTask.isComplete ? 'incomplete' : 'complete'}`}
                            />
                            <span className={styles.subTaskTitle}>{subTask.task.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

DayDetailPanel.displayName = 'DayDetailPanel';
