/**
 * CalendarDay Component
 *
 * Displays a single day in the calendar grid with tasks.
 * Shows task previews, completion status, and priority indicators.
 *
 * Requirements:
 * - CK-C2: CalendarDay component
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { useCallback, useMemo } from 'react';
import clsx from 'clsx';
import type { CalendarDay as CalendarDayData } from '../services/CalendarService';
import styles from './CalendarDay.module.css';

// =============================================================================
// TYPES
// =============================================================================

export interface CalendarDayProps {
  /**
   * Calendar day data
   */
  day: CalendarDayData;

  /**
   * Whether this day is selected
   */
  isSelected?: boolean;

  /**
   * Whether this day is focused via keyboard navigation
   */
  isFocused?: boolean;

  /**
   * Callback when the day is clicked
   */
  onClick?: () => void;

  /**
   * Callback when a task is clicked
   */
  onTaskClick?: (taskId: string, date: Date) => void;

  /**
   * Callback when a task completion is toggled
   */
  onTaskToggle?: (taskId: string, date: Date) => void;

  /**
   * Maximum number of tasks to show before "more" indicator
   */
  maxVisibleTasks?: number;

  /**
   * Additional CSS class name
   */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MAX_VISIBLE_TASKS = 3;

// =============================================================================
// COMPONENT
// =============================================================================

export function CalendarDay({
  day,
  isSelected = false,
  isFocused = false,
  onClick,
  onTaskClick,
  onTaskToggle,
  maxVisibleTasks = DEFAULT_MAX_VISIBLE_TASKS,
  className,
}: CalendarDayProps) {
  const {
    date,
    isToday,
    isCurrentMonth,
    tasks,
    totalTasks,
    completedTasks,
    percentComplete,
    hasHighPriority,
    hasMediumPriority,
  } = day;

  // Get visible tasks and count of hidden tasks
  const { visibleTasks, hiddenCount } = useMemo(() => {
    const visible = tasks.slice(0, maxVisibleTasks);
    const hidden = Math.max(0, tasks.length - maxVisibleTasks);
    return { visibleTasks: visible, hiddenCount: hidden };
  }, [tasks, maxVisibleTasks]);

  // Handle task click without bubbling to day click
  const handleTaskClick = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      e.stopPropagation();
      onTaskClick?.(taskId, date);
    },
    [onTaskClick, date]
  );

  // Handle task toggle without bubbling
  const handleTaskToggle = useCallback(
    (e: React.MouseEvent | React.ChangeEvent, taskId: string) => {
      e.stopPropagation();
      onTaskToggle?.(taskId, date);
    },
    [onTaskToggle, date]
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

  return (
    <div
      className={clsx(
        styles.dayCell,
        !isCurrentMonth && styles.otherMonth,
        isToday && styles.today,
        isSelected && styles.selected,
        isFocused && styles.focused,
        className
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="gridcell"
      tabIndex={isCurrentMonth ? 0 : -1}
      aria-label={`${date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })}${isToday ? ', today' : ''}. ${totalTasks} tasks, ${completedTasks} completed.`}
      aria-selected={isSelected}
    >
      {/* Date header */}
      <div className={styles.dateHeader}>
        <span className={styles.dateNumber}>{date.getDate()}</span>

        {/* Priority indicators */}
        {(hasHighPriority || hasMediumPriority) && (
          <div className={styles.priorityIndicators} aria-hidden="true">
            {hasHighPriority && (
              <span className={clsx(styles.priorityDot, styles.high)} />
            )}
            {hasMediumPriority && (
              <span className={clsx(styles.priorityDot, styles.medium)} />
            )}
          </div>
        )}
      </div>

      {/* Tasks list */}
      {totalTasks > 0 ? (
        <div className={styles.tasksContainer}>
          {visibleTasks.map((calendarTask) => (
            <div
              key={calendarTask.task.id}
              className={clsx(
                styles.taskPreview,
                calendarTask.isComplete && styles.completed
              )}
              style={
                {
                  '--checklist-color': calendarTask.checklist.color,
                } as React.CSSProperties
              }
              onClick={(e) => handleTaskClick(e, calendarTask.task.id)}
              role="button"
              tabIndex={-1}
            >
              <input
                type="checkbox"
                className={styles.taskCheckbox}
                checked={calendarTask.isComplete}
                onChange={(e) => handleTaskToggle(e, calendarTask.task.id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Mark "${calendarTask.task.title}" as ${calendarTask.isComplete ? 'incomplete' : 'complete'}`}
              />
              <span className={styles.taskTitle}>{calendarTask.task.title}</span>
            </div>
          ))}

          {hiddenCount > 0 && (
            <div className={styles.moreTasksIndicator}>
              +{hiddenCount} more
            </div>
          )}
        </div>
      ) : (
        isCurrentMonth && (
          <div className={styles.emptyDay} aria-hidden="true">
            {/* Empty day - could add "+" icon for adding tasks */}
          </div>
        )
      )}

      {/* Completion badge for days with tasks */}
      {totalTasks > 0 && isCurrentMonth && (
        <div
          className={clsx(
            styles.completionBadge,
            percentComplete < 100 && styles.incomplete
          )}
        >
          {percentComplete === 100 ? '✓' : `${completedTasks}/${totalTasks}`}
        </div>
      )}
    </div>
  );
}

CalendarDay.displayName = 'CalendarDay';
