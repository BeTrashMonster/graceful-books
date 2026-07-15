/**
 * CalendarMonth Component
 *
 * Displays a month view calendar with tasks for each day.
 * Features month navigation, today highlighting, and progress tracking.
 *
 * Requirements:
 * - CK-C1: CalendarMonth component
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import clsx from 'clsx';
import type { CalendarMonth as CalendarMonthData } from '../services/CalendarService';
import { CalendarDay } from './CalendarDay';
import styles from './CalendarMonth.module.css';

// =============================================================================
// TYPES
// =============================================================================

export interface CalendarMonthProps {
  /**
   * Calendar data for the month
   */
  data?: CalendarMonthData;

  /**
   * Whether the calendar is loading
   */
  isLoading?: boolean;

  /**
   * Current selected date
   */
  selectedDate?: Date;

  /**
   * Callback when a date is selected
   */
  onDateSelect?: (date: Date) => void;

  /**
   * Callback when navigating to previous month
   */
  onPreviousMonth?: () => void;

  /**
   * Callback when navigating to next month
   */
  onNextMonth?: () => void;

  /**
   * Callback when navigating to today
   */
  onToday?: () => void;

  /**
   * Callback when a task is clicked
   */
  onTaskClick?: (taskId: string, date: Date) => void;

  /**
   * Callback when a task completion is toggled
   */
  onTaskToggle?: (taskId: string, date: Date) => void;

  /**
   * Which day the week starts on (0=Sunday, 1=Monday, etc.)
   */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;

  /**
   * Whether to show the summary bar
   */
  showSummary?: boolean;

  /**
   * Additional CSS class name
   */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// =============================================================================
// COMPONENT
// =============================================================================

export function CalendarMonth({
  data,
  isLoading = false,
  selectedDate,
  onDateSelect,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onTaskClick,
  onTaskToggle,
  weekStartsOn = 0,
  showSummary = true,
  className,
}: CalendarMonthProps) {
  // All useState hooks must come first
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');

  // All useRef hooks
  const gridRef = useRef<HTMLDivElement>(null);

  // Get ordered weekday labels based on week start
  const orderedWeekdays = useMemo(() => {
    const days = [...WEEKDAY_LABELS];
    const start = days.splice(0, weekStartsOn);
    return [...days, ...start];
  }, [weekStartsOn]);

  // Get calendar grid with leading/trailing days from adjacent months
  const calendarGrid = useMemo(() => {
    if (!data?.days || data.days.length === 0) {
      return [];
    }

    const firstDay = data.days[0];
    const firstDayOfWeek = firstDay.date.getDay();

    // Calculate days to prepend from previous month
    let daysToPreprend = (firstDayOfWeek - weekStartsOn + 7) % 7;

    // Calculate days to append to complete the last week
    const totalDays = daysToPreprend + data.days.length;
    const weeksNeeded = Math.ceil(totalDays / 7);
    const totalCells = weeksNeeded * 7;
    const daysToAppend = totalCells - totalDays;

    // Create placeholder days for previous month
    const prevMonthDays = [];
    if (daysToPreprend > 0) {
      const prevMonth = new Date(data.year, data.month, 0);
      const prevMonthLastDay = prevMonth.getDate();
      for (let i = daysToPreprend - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        prevMonthDays.push({
          date: new Date(prevMonth.getFullYear(), prevMonth.getMonth(), day),
          dateString: '',
          isToday: false,
          isCurrentMonth: false,
          tasks: [],
          totalTasks: 0,
          completedTasks: 0,
          percentComplete: 100,
          hasHighPriority: false,
          hasMediumPriority: false,
        });
      }
    }

    // Create placeholder days for next month
    const nextMonthDays = [];
    if (daysToAppend > 0) {
      const nextMonth = new Date(data.year, data.month + 1, 1);
      for (let i = 0; i < daysToAppend; i++) {
        nextMonthDays.push({
          date: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), i + 1),
          dateString: '',
          isToday: false,
          isCurrentMonth: false,
          tasks: [],
          totalTasks: 0,
          completedTasks: 0,
          percentComplete: 100,
          hasHighPriority: false,
          hasMediumPriority: false,
        });
      }
    }

    return [...prevMonthDays, ...data.days, ...nextMonthDays];
  }, [data, weekStartsOn]);

  // Handle date selection
  const handleDateClick = useCallback(
    (date: Date) => {
      onDateSelect?.(date);
    },
    [onDateSelect]
  );

  // Check if a date is selected
  const isDateSelected = useCallback(
    (date: Date) => {
      if (!selectedDate) return false;
      return (
        date.getFullYear() === selectedDate.getFullYear() &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getDate() === selectedDate.getDate()
      );
    },
    [selectedDate]
  );

  // Find the index of today or first day of current month for initial focus
  const getInitialFocusIndex = useCallback(() => {
    const todayIndex = calendarGrid.findIndex((day) => day.isToday);
    if (todayIndex >= 0) return todayIndex;
    return calendarGrid.findIndex((day) => day.isCurrentMonth);
  }, [calendarGrid]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (calendarGrid.length === 0) return;

      const currentIndex = focusedIndex ?? getInitialFocusIndex();
      let newIndex = currentIndex;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          newIndex = Math.max(0, currentIndex - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          newIndex = Math.min(calendarGrid.length - 1, currentIndex + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          newIndex = Math.max(0, currentIndex - 7);
          break;
        case 'ArrowDown':
          e.preventDefault();
          newIndex = Math.min(calendarGrid.length - 1, currentIndex + 7);
          break;
        case 'Home':
          e.preventDefault();
          // Go to first day of current month
          newIndex = calendarGrid.findIndex((day) => day.isCurrentMonth);
          break;
        case 'End':
          e.preventDefault();
          // Go to last day of current month
          for (let i = calendarGrid.length - 1; i >= 0; i--) {
            if (calendarGrid[i].isCurrentMonth) {
              newIndex = i;
              break;
            }
          }
          break;
        case 'PageUp':
          e.preventDefault();
          onPreviousMonth?.();
          return;
        case 'PageDown':
          e.preventDefault();
          onNextMonth?.();
          return;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (currentIndex >= 0 && currentIndex < calendarGrid.length) {
            handleDateClick(calendarGrid[currentIndex].date);
          }
          return;
        default:
          return;
      }

      setFocusedIndex(newIndex);

      // Announce the focused day for screen readers
      const focusedDay = calendarGrid[newIndex];
      if (focusedDay) {
        const dateStr = focusedDay.date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });
        const taskInfo = focusedDay.totalTasks > 0
          ? `${focusedDay.completedTasks} of ${focusedDay.totalTasks} tasks completed`
          : 'No tasks';
        const todayInfo = focusedDay.isToday ? ', today' : '';
        setAnnouncement(`${dateStr}${todayInfo}. ${taskInfo}`);
      }
    },
    [calendarGrid, focusedIndex, getInitialFocusIndex, onPreviousMonth, onNextMonth, handleDateClick]
  );

  // Reset focus when month changes
  useEffect(() => {
    setFocusedIndex(null);
  }, [data?.month, data?.year]);

  return (
    <div className={clsx(styles.calendarContainer, className)}>
      {/* Screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={styles.srOnly}
      >
        {announcement}
      </div>

      {/* Header with month title and navigation */}
      <header className={styles.calendarHeader}>
        <h2 className={styles.monthTitle}>
          {data?.monthName ?? 'Loading...'} {data?.year ?? ''}
        </h2>

        <div className={styles.navigationButtons}>
          <button
            type="button"
            className={styles.navButton}
            onClick={onPreviousMonth}
            disabled={isLoading}
            aria-label="Previous month"
          >
            ←
          </button>

          <button
            type="button"
            className={clsx(styles.navButton, styles.todayButton)}
            onClick={onToday}
            disabled={isLoading}
          >
            Today
          </button>

          <button
            type="button"
            className={styles.navButton}
            onClick={onNextMonth}
            disabled={isLoading}
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </header>

      {/* Weekday headers */}
      <div className={styles.weekdayHeader} role="row">
        {orderedWeekdays.map((day) => (
          <div key={day} className={styles.weekday} role="columnheader">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        ref={gridRef}
        className={styles.calendarGrid}
        role="grid"
        aria-label={`${data?.monthName ?? ''} ${data?.year ?? ''}`}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {calendarGrid.map((day, index) => (
          <CalendarDay
            key={day.dateString || `placeholder-${index}`}
            day={day}
            isSelected={isDateSelected(day.date)}
            isFocused={focusedIndex === index}
            onClick={() => handleDateClick(day.date)}
            onTaskClick={onTaskClick}
            onTaskToggle={onTaskToggle}
          />
        ))}
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className={styles.loadingOverlay} aria-busy="true">
          <div className={styles.spinner} aria-label="Loading calendar" />
        </div>
      )}

      {/* Summary bar */}
      {showSummary && data && (
        <div className={styles.summaryBar}>
          <span className={styles.summaryText}>
            {data.completedTasks} of {data.totalTasks} tasks completed this month
          </span>

          <div className={styles.summaryProgress}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${data.percentComplete}%` }}
                role="progressbar"
                aria-valuenow={data.percentComplete}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <span className={styles.progressText}>{data.percentComplete}%</span>
          </div>
        </div>
      )}

      {/* Empty state when no data */}
      {!isLoading && !data && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">
            📅
          </div>
          <h3 className={styles.emptyTitle}>No calendar data</h3>
          <p className={styles.emptyDescription}>
            Your calendar will appear here once you create some checklists.
          </p>
        </div>
      )}
    </div>
  );
}

CalendarMonth.displayName = 'CalendarMonth';
