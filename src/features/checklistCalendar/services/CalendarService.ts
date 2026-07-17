/**
 * Calendar Service
 *
 * Handles calendar-centric queries - getting tasks due on specific dates,
 * building calendar views, and aggregating task data by date.
 *
 * Requirements:
 * - CK-B5: CalendarService
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { db } from '../../../db/database';
import type { DatabaseResult } from '../../../store/types';
import type {
  AdminChecklist,
  AdminTask,
  AdminTaskCompletion,
  TaskPriority,
} from '../../../db/schema/checklistCalendar.schema';
import { logger } from '../../../utils/logger';
import {
  isChecklistDueOnDate,
  isTaskDueOnDate,
  getDatesInRange,
  getDatesInMonth,
  formatDateISO,
  getPeriodValue,
  getPeriodTypeForRecurrence,
  isSameDay,
} from '../utils/recurrence';

const calendarLogger = logger.child('CalendarService');

// =============================================================================
// TYPES
// =============================================================================

/**
 * A task with its completion status for a specific date
 */
export interface CalendarTask {
  task: AdminTask;
  checklist: AdminChecklist;
  isComplete: boolean;
  completion?: AdminTaskCompletion;
  subTasks: CalendarTask[];
}

/**
 * Tasks grouped by date
 */
export interface CalendarDay {
  date: Date;
  dateString: string; // YYYY-MM-DD format
  isToday: boolean;
  isCurrentMonth: boolean;
  tasks: CalendarTask[];
  totalTasks: number;
  completedTasks: number;
  percentComplete: number;
  hasHighPriority: boolean;
  hasMediumPriority: boolean;
}

/**
 * A full month of calendar data
 */
export interface CalendarMonth {
  year: number;
  month: number; // 0-11
  monthName: string;
  days: CalendarDay[];
  totalTasks: number;
  completedTasks: number;
  percentComplete: number;
}

/**
 * Options for getting calendar data
 */
export interface GetCalendarOptions {
  includeArchived?: boolean;
  filterByPriority?: TaskPriority[];
  filterByAssignee?: string;
  filterByChecklist?: string[];
  showCompleted?: boolean; // false = hide completed tasks
}

/**
 * Agenda view item - a single task on a specific date
 */
export interface AgendaItem {
  date: Date;
  dateString: string;
  task: AdminTask;
  checklist: AdminChecklist;
  isComplete: boolean;
  isOverdue: boolean;
}

// =============================================================================
// MONTH NAMES
// =============================================================================

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// =============================================================================
// CORE CALENDAR QUERIES
// =============================================================================

/**
 * Get all tasks due on a specific date
 */
export async function getTasksForDate(
  companyId: string,
  date: Date,
  options: GetCalendarOptions = {}
): Promise<DatabaseResult<CalendarTask[]>> {
  try {
    const {
      includeArchived = false,
      filterByPriority,
      filterByAssignee,
      filterByChecklist,
      showCompleted = true,
    } = options;

    // Get all active checklists
    let checklists = await db.adminChecklists
      .where('company_id')
      .equals(companyId)
      .filter((c) => !c.deleted_at && (includeArchived || !c.is_archived))
      .toArray();

    // Filter by checklist IDs if specified
    if (filterByChecklist && filterByChecklist.length > 0) {
      const checklistSet = new Set(filterByChecklist);
      checklists = checklists.filter((c) => checklistSet.has(c.id));
    }

    // Filter checklists that might have tasks due on this date
    // For daily/weekly checklists, we include them if they pass basic checks
    // (not archived, effective_from ok) and let task-level filtering handle day selection
    const dueChecklists = checklists.filter((c) => {
      // For daily/weekly, use permissive check - individual tasks may have different days
      if (c.recurrence_type === 'daily' || c.recurrence_type === 'weekly') {
        // Check effective_from
        if (c.effective_from) {
          const effectiveDate = new Date(c.effective_from);
          effectiveDate.setHours(0, 0, 0, 0);
          const targetDate = new Date(date);
          targetDate.setHours(0, 0, 0, 0);
          if (targetDate < effectiveDate) {
            return false;
          }
        }
        return true; // Task-level isTaskDueOnDate will handle day filtering
      }
      // For other recurrence types, use standard checklist-level check
      return isChecklistDueOnDate(c, date);
    });

    // Get tasks for due checklists
    const calendarTasks: CalendarTask[] = [];

    for (const checklist of dueChecklists) {
      // Get top-level tasks
      let tasks = await db.adminTasks
        .where('checklist_id')
        .equals(checklist.id)
        .filter(
          (t) =>
            !t.deleted_at &&
            (includeArchived || !t.is_archived) &&
            t.parent_task_id === null
        )
        .toArray();

      // Apply filters
      if (filterByPriority && filterByPriority.length > 0) {
        const prioritySet = new Set(filterByPriority);
        tasks = tasks.filter((t) => prioritySet.has(t.priority));
      }

      if (filterByAssignee) {
        tasks = tasks.filter((t) => t.assignee_id === filterByAssignee);
      }

      // Sort by order
      tasks.sort((a, b) => a.order - b.order);

      // Get completion status and sub-tasks
      for (const task of tasks) {
        // Check if this task is due on this date (handles task-level day overrides)
        if (!isTaskDueOnDate(task, checklist, date)) {
          continue;
        }
        const periodType = getPeriodTypeForRecurrence(checklist.recurrence_type);
        const periodValue = getPeriodValue(date, periodType);

        const completion = await db.adminTaskCompletions
          .where('[task_id+period_type+period_value]')
          .equals([task.id, periodType, periodValue])
          .filter((c) => !c.deleted_at)
          .first();

        const isComplete = !!completion;

        // Skip completed tasks if not showing them
        if (!showCompleted && isComplete) {
          continue;
        }

        // Get sub-tasks
        const subTaskEntities = await db.adminTasks
          .where('parent_task_id')
          .equals(task.id)
          .filter((t) => !t.deleted_at && (includeArchived || !t.is_archived))
          .sortBy('order');

        const subTasks: CalendarTask[] = [];
        for (const subTask of subTaskEntities) {
          // Check if this sub-task is due on this date
          if (!isTaskDueOnDate(subTask, checklist, date)) {
            continue;
          }

          const subCompletion = await db.adminTaskCompletions
            .where('[task_id+period_type+period_value]')
            .equals([subTask.id, periodType, periodValue])
            .filter((c) => !c.deleted_at)
            .first();

          const subIsComplete = !!subCompletion;

          if (!showCompleted && subIsComplete) {
            continue;
          }

          subTasks.push({
            task: subTask,
            checklist,
            isComplete: subIsComplete,
            completion: subCompletion,
            subTasks: [], // No nested sub-tasks
          });
        }

        calendarTasks.push({
          task,
          checklist,
          isComplete,
          completion,
          subTasks,
        });
      }
    }

    // Also check for one-time tasks scheduled for this date
    const scheduledDate = date.setHours(0, 0, 0, 0);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);

    const oneTimeTasks = await db.adminTasks
      .where('company_id')
      .equals(companyId)
      .filter(
        (t) =>
          !t.deleted_at &&
          (includeArchived || !t.is_archived) &&
          t.scheduled_date !== null &&
          t.scheduled_date >= scheduledDate &&
          t.scheduled_date < nextDay.getTime()
      )
      .toArray();

    for (const task of oneTimeTasks) {
      const checklist = await db.adminChecklists.get(task.checklist_id);
      if (!checklist || checklist.deleted_at || checklist.recurrence_type !== 'one-time') {
        continue;
      }

      // Apply filters
      if (filterByPriority && filterByPriority.length > 0) {
        if (!filterByPriority.includes(task.priority)) {
          continue;
        }
      }

      if (filterByAssignee && task.assignee_id !== filterByAssignee) {
        continue;
      }

      if (filterByChecklist && filterByChecklist.length > 0) {
        if (!filterByChecklist.includes(checklist.id)) {
          continue;
        }
      }

      // Check completion
      const periodType = 'day';
      const periodValue = formatDateISO(date);

      const completion = await db.adminTaskCompletions
        .where('[task_id+period_type+period_value]')
        .equals([task.id, periodType, periodValue])
        .filter((c) => !c.deleted_at)
        .first();

      const isComplete = !!completion;

      if (!showCompleted && isComplete) {
        continue;
      }

      calendarTasks.push({
        task,
        checklist,
        isComplete,
        completion,
        subTasks: [],
      });
    }

    return {
      success: true,
      data: calendarTasks,
    };
  } catch (error) {
    calendarLogger.error('Failed to get tasks for date', {
      error,
      companyId,
      date,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Build a CalendarDay object
 */
async function buildCalendarDay(
  companyId: string,
  date: Date,
  currentMonth: number,
  today: Date,
  options: GetCalendarOptions
): Promise<CalendarDay> {
  // Always get ALL tasks first for accurate metrics
  const allTasksResult = await getTasksForDate(companyId, date, { ...options, showCompleted: true });
  const allTasks = allTasksResult.success ? allTasksResult.data ?? [] : [];

  // Calculate metrics from ALL tasks INCLUDING subtasks
  let totalTasks = 0;
  let completedTasks = 0;
  for (const task of allTasks) {
    totalTasks += 1;
    if (task.isComplete) completedTasks += 1;
    // Count subtasks too
    for (const subTask of task.subTasks) {
      totalTasks += 1;
      if (subTask.isComplete) completedTasks += 1;
    }
  }
  const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;

  const hasHighPriority = allTasks.some((t) => t.task.priority === 'high');
  const hasMediumPriority = allTasks.some((t) => t.task.priority === 'medium');

  // For display, filter tasks based on showCompleted option
  // But keep subtasks with their parent tasks for proper display
  let displayTasks = allTasks;
  if (options.showCompleted === false) {
    displayTasks = allTasks
      .filter((t) => !t.isComplete || t.subTasks.some((st) => !st.isComplete))
      .map((t) => ({
        ...t,
        subTasks: t.subTasks.filter((st) => !st.isComplete),
      }));
  }

  return {
    date,
    dateString: formatDateISO(date),
    isToday: isSameDay(date, today),
    isCurrentMonth: date.getMonth() === currentMonth,
    tasks: displayTasks,
    totalTasks,
    completedTasks,
    percentComplete,
    hasHighPriority,
    hasMediumPriority,
  };
}

/**
 * Get calendar data for a full month
 */
export async function getCalendarMonth(
  companyId: string,
  year: number,
  month: number,
  options: GetCalendarOptions = {}
): Promise<DatabaseResult<CalendarMonth>> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dates = getDatesInMonth(year, month);
    const days: CalendarDay[] = [];

    let totalTasks = 0;
    let completedTasks = 0;

    for (const date of dates) {
      const day = await buildCalendarDay(companyId, date, month, today, options);
      days.push(day);
      totalTasks += day.totalTasks;
      completedTasks += day.completedTasks;
    }

    const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;

    return {
      success: true,
      data: {
        year,
        month,
        monthName: MONTH_NAMES[month],
        days,
        totalTasks,
        completedTasks,
        percentComplete,
      },
    };
  } catch (error) {
    calendarLogger.error('Failed to get calendar month', {
      error,
      companyId,
      year,
      month,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Get calendar data for a week
 */
export async function getCalendarWeek(
  companyId: string,
  startDate: Date,
  options: GetCalendarOptions = {}
): Promise<DatabaseResult<CalendarDay[]>> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const dates = getDatesInRange(startDate, endDate);
    const days: CalendarDay[] = [];

    for (const date of dates) {
      const day = await buildCalendarDay(
        companyId,
        date,
        startDate.getMonth(),
        today,
        options
      );
      days.push(day);
    }

    return {
      success: true,
      data: days,
    };
  } catch (error) {
    calendarLogger.error('Failed to get calendar week', {
      error,
      companyId,
      startDate,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Get agenda view data (list of upcoming tasks)
 */
export async function getAgendaView(
  companyId: string,
  startDate: Date,
  daysAhead = 14,
  options: GetCalendarOptions = {}
): Promise<DatabaseResult<AgendaItem[]>> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysAhead - 1);

    const dates = getDatesInRange(startDate, endDate);
    const agendaItems: AgendaItem[] = [];

    for (const date of dates) {
      const result = await getTasksForDate(companyId, date, options);
      const tasks = result.success ? result.data ?? [] : [];

      for (const calendarTask of tasks) {
        const isOverdue = date < today && !calendarTask.isComplete;

        agendaItems.push({
          date,
          dateString: formatDateISO(date),
          task: calendarTask.task,
          checklist: calendarTask.checklist,
          isComplete: calendarTask.isComplete,
          isOverdue,
        });

        // Add sub-tasks as separate agenda items
        for (const subTask of calendarTask.subTasks) {
          agendaItems.push({
            date,
            dateString: formatDateISO(date),
            task: subTask.task,
            checklist: subTask.checklist,
            isComplete: subTask.isComplete,
            isOverdue: date < today && !subTask.isComplete,
          });
        }
      }
    }

    return {
      success: true,
      data: agendaItems,
    };
  } catch (error) {
    calendarLogger.error('Failed to get agenda view', {
      error,
      companyId,
      startDate,
      daysAhead,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// =============================================================================
// OVERDUE TASKS
// =============================================================================

/**
 * Get overdue tasks (incomplete tasks from past dates)
 */
export async function getOverdueTasks(
  companyId: string,
  lookbackDays = 30,
  options: GetCalendarOptions = {}
): Promise<DatabaseResult<AgendaItem[]>> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - lookbackDays);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dates = getDatesInRange(startDate, yesterday);
    const overdueItems: AgendaItem[] = [];

    // Only show incomplete tasks
    const overdueOptions = { ...options, showCompleted: false };

    for (const date of dates) {
      const result = await getTasksForDate(companyId, date, overdueOptions);
      const tasks = result.success ? result.data ?? [] : [];

      for (const calendarTask of tasks) {
        if (!calendarTask.isComplete) {
          overdueItems.push({
            date,
            dateString: formatDateISO(date),
            task: calendarTask.task,
            checklist: calendarTask.checklist,
            isComplete: false,
            isOverdue: true,
          });
        }
      }
    }

    // Sort by date descending (most recent first)
    overdueItems.sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      success: true,
      data: overdueItems,
    };
  } catch (error) {
    calendarLogger.error('Failed to get overdue tasks', {
      error,
      companyId,
      lookbackDays,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get completion statistics for a date range
 */
export async function getCompletionStatsForRange(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<DatabaseResult<{
  totalTasks: number;
  completedTasks: number;
  percentComplete: number;
  byDay: Array<{ date: string; total: number; completed: number; percent: number }>;
}>> {
  try {
    const dates = getDatesInRange(startDate, endDate);
    const byDay: Array<{ date: string; total: number; completed: number; percent: number }> = [];

    let totalTasks = 0;
    let completedTasks = 0;

    for (const date of dates) {
      const result = await getTasksForDate(companyId, date);
      const tasks = result.success ? result.data ?? [] : [];

      const dayTotal = tasks.length;
      const dayCompleted = tasks.filter((t) => t.isComplete).length;
      const dayPercent = dayTotal > 0 ? Math.round((dayCompleted / dayTotal) * 100) : 100;

      totalTasks += dayTotal;
      completedTasks += dayCompleted;

      byDay.push({
        date: formatDateISO(date),
        total: dayTotal,
        completed: dayCompleted,
        percent: dayPercent,
      });
    }

    const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;

    return {
      success: true,
      data: {
        totalTasks,
        completedTasks,
        percentComplete,
        byDay,
      },
    };
  } catch (error) {
    calendarLogger.error('Failed to get completion stats', {
      error,
      companyId,
      startDate,
      endDate,
    });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Get today's task summary
 */
export async function getTodaySummary(
  companyId: string
): Promise<DatabaseResult<{
  totalTasks: number;
  completedTasks: number;
  percentComplete: number;
  highPriorityIncomplete: number;
  overdueCount: number;
}>> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await getTasksForDate(companyId, today);
    const tasks = result.success ? result.data ?? [] : [];

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.isComplete).length;
    const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
    const highPriorityIncomplete = tasks.filter(
      (t) => !t.isComplete && t.task.priority === 'high'
    ).length;

    // Get overdue count
    const overdueResult = await getOverdueTasks(companyId, 7);
    const overdueCount = overdueResult.success ? overdueResult.data?.length ?? 0 : 0;

    return {
      success: true,
      data: {
        totalTasks,
        completedTasks,
        percentComplete,
        highPriorityIncomplete,
        overdueCount,
      },
    };
  } catch (error) {
    calendarLogger.error('Failed to get today summary', { error, companyId });
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
