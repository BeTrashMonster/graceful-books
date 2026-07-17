/**
 * useCalendar Hook
 *
 * Manages calendar state and operations for the Admin Calendar page.
 *
 * Requirements:
 * - CK-E1: Calendar state management
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { CalendarMonthData, TaskWithSubTasks, CommentWithMeta } from '../services';
import type { AdminChecklist, AdminTask, TaskViewMode } from '../../../db/schema/checklistCalendar.schema';

/**
 * Selected task with nested structure for UI consistency
 */
interface SelectedTaskData {
  task: AdminTask;
  subTasks: AdminTask[];
}
import {
  getCalendarMonth,
  getTaskWithSubTasks,
  getCommentsForTask,
  markTaskComplete,
  markTaskIncomplete,
  toggleTaskCompletion,
  getOrCreatePreferences,
  updatePreferences,
  getChecklists,
  updateTask,
  createSubTask,
  deleteTask as deleteTaskService,
  archiveTask,
  createComment,
  deleteComment,
} from '../services';

// =============================================================================
// TYPES
// =============================================================================

export interface UseCalendarOptions {
  /**
   * Company ID for data queries
   */
  companyId?: string;

  /**
   * User ID for preferences
   */
  userId?: string;

  /**
   * Initial month to display
   */
  initialDate?: Date;

  /**
   * Day of week to start on (0 = Sunday, 1 = Monday)
   */
  weekStartsOn?: 0 | 1;
}

export interface UseCalendarReturn {
  // State
  currentDate: Date;
  selectedDate: Date | null;
  calendarData: CalendarMonthData | null;
  checklists: AdminChecklist[];
  selectedTask: SelectedTaskData | null;
  selectedTaskChecklist: AdminChecklist | null;
  taskComments: CommentWithMeta[];
  viewMode: TaskViewMode;
  isLoading: boolean;
  isTaskModalOpen: boolean;
  error: string | null;

  // Navigation
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToToday: () => void;
  goToDate: (date: Date) => void;

  // Selection
  selectDate: (date: Date) => void;
  selectTask: (taskId: string, date: Date) => void;
  closeTaskModal: () => void;

  // Task operations
  toggleTaskComplete: (taskId: string, date: Date) => Promise<void>;
  updateTaskTitle: (title: string) => Promise<void>;
  updateTaskDescription: (description: string) => Promise<void>;
  updateTaskPriority: (priority: 'high' | 'medium' | 'low' | 'none') => Promise<void>;
  updateTaskFeatureLink: (link: string | null, label: string | null) => Promise<void>;
  updateTaskDaysOfWeek: (daysOfWeek: number[] | null) => Promise<void>;
  addSubTask: (title: string) => Promise<void>;
  toggleSubTask: (subTaskId: string) => Promise<void>;
  deleteSubTask: (subTaskId: string) => Promise<void>;
  deleteTask: () => Promise<void>;

  // Comments
  addComment: (content: string) => Promise<void>;
  removeComment: (commentId: string) => Promise<void>;

  // View mode
  setViewMode: (mode: TaskViewMode) => Promise<void>;
  toggleViewMode: () => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
}

// =============================================================================
// HOOK
// =============================================================================

export function useCalendar(options: UseCalendarOptions = {}): UseCalendarReturn {
  const { companyId = 'demo-company', userId, initialDate = new Date(), weekStartsOn = 0 } = options;

  // State - default selectedDate to today
  const [currentDate, setCurrentDate] = useState<Date>(initialDate);
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [calendarData, setCalendarData] = useState<CalendarMonthData | null>(null);
  const [checklists, setChecklists] = useState<AdminChecklist[]>([]);
  const [selectedTask, setSelectedTask] = useState<SelectedTaskData | null>(null);
  const [selectedTaskChecklist, setSelectedTaskChecklist] = useState<AdminChecklist | null>(null);
  const [taskComments, setTaskComments] = useState<CommentWithMeta[]>([]);
  const [viewMode, setViewModeState] = useState<TaskViewMode>('incomplete');
  const [isLoading, setIsLoading] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load calendar data
  const loadCalendarData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getCalendarMonth(
        companyId,
        currentDate.getFullYear(),
        currentDate.getMonth(),
        { showCompleted: viewMode === 'all' }
      );

      if (result.success) {
        setCalendarData(result.data);
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError('Failed to load calendar data');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, currentDate, viewMode]);

  // Load checklists
  const loadChecklists = useCallback(async () => {
    try {
      const result = await getChecklists(companyId);
      if (result.success) {
        setChecklists(result.data);
      }
    } catch {
      // Silently fail - checklists are optional
    }
  }, [companyId]);

  // Load preferences
  const loadPreferences = useCallback(async () => {
    if (!userId) return;

    try {
      const result = await getOrCreatePreferences(userId);
      if (result.success) {
        setViewModeState(result.data.view_mode);
      }
    } catch {
      // Use default preferences
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    loadPreferences();
    loadChecklists();
  }, [loadPreferences, loadChecklists]);

  // Load calendar when date or view mode changes
  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Navigation
  const goToPreviousMonth = useCallback(() => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const goToDate = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  // Selection
  const selectDate = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const selectTask = useCallback(
    async (taskId: string, date: Date) => {
      setSelectedDate(date);

      try {
        const taskResult = await getTaskWithSubTasks(taskId);
        if (taskResult.success === false) {
          setError(taskResult.error.message);
          return;
        }

        // Transform to expected structure: { task: AdminTask, subTasks: AdminTask[] }
        const { subTasks, ...taskData } = taskResult.data;
        setSelectedTask({ task: taskData, subTasks });

        // Find the checklist for this task
        const checklist = checklists.find(
          (c) => c.id === taskData.checklist_id
        );
        setSelectedTaskChecklist(checklist || null);

        // Load comments
        const commentsResult = await getCommentsForTask(taskId);
        if (commentsResult.success) {
          setTaskComments(commentsResult.data);
        }

        setIsTaskModalOpen(true);
      } catch {
        setError('Failed to load task details');
      }
    },
    [checklists]
  );

  const closeTaskModal = useCallback(() => {
    setIsTaskModalOpen(false);
    setSelectedTask(null);
    setSelectedTaskChecklist(null);
    setTaskComments([]);
  }, []);

  // Task operations
  const toggleTaskComplete = useCallback(
    async (taskId: string, date: Date) => {
      try {
        // Normalize the date to midnight
        const normalizedDate = new Date(date);
        normalizedDate.setHours(0, 0, 0, 0);

        const result = await toggleTaskCompletion({
          taskId,
          companyId,
          userId: userId || 'demo-user',
          userName: 'User',
          date: normalizedDate,
        });

        if (!result.success) {
          console.error('Toggle completion failed:', result.error);
          setError(result.error?.message || 'Failed to toggle task completion');
          return;
        }

        // Reload calendar data to reflect the change
        await loadCalendarData();
        await loadChecklists();
      } catch (err) {
        console.error('Toggle completion error:', err);
        setError('Failed to toggle task completion');
      }
    },
    [companyId, userId, loadCalendarData, loadChecklists]
  );

  const updateTaskTitle = useCallback(
    async (title: string) => {
      if (!selectedTask) return;

      try {
        const result = await updateTask(selectedTask.task.id, { title });
        if (result.success) {
          setSelectedTask((prev) =>
            prev ? { ...prev, task: { ...prev.task, title } } : null
          );
          await loadCalendarData();
        }
      } catch {
        setError('Failed to update task title');
      }
    },
    [selectedTask, loadCalendarData]
  );

  const updateTaskDescription = useCallback(
    async (description: string) => {
      if (!selectedTask) return;

      try {
        const result = await updateTask(selectedTask.task.id, { description });
        if (result.success) {
          setSelectedTask((prev) =>
            prev ? { ...prev, task: { ...prev.task, description } } : null
          );
        }
      } catch {
        setError('Failed to update task description');
      }
    },
    [selectedTask]
  );

  const updateTaskPriority = useCallback(
    async (priority: 'high' | 'medium' | 'low' | 'none') => {
      if (!selectedTask) return;

      try {
        const result = await updateTask(selectedTask.task.id, { priority });
        if (result.success) {
          setSelectedTask((prev) =>
            prev ? { ...prev, task: { ...prev.task, priority } } : null
          );
          await loadCalendarData();
        }
      } catch {
        setError('Failed to update task priority');
      }
    },
    [selectedTask, loadCalendarData]
  );

  const updateTaskFeatureLink = useCallback(
    async (link: string | null, label: string | null) => {
      if (!selectedTask) return;

      try {
        const result = await updateTask(selectedTask.task.id, {
          feature_link: link || undefined,
          feature_link_label: label || undefined,
        });
        if (result.success) {
          setSelectedTask((prev) =>
            prev
              ? {
                  ...prev,
                  task: {
                    ...prev.task,
                    feature_link: link,
                    feature_link_label: label,
                  },
                }
              : null
          );
        }
      } catch {
        setError('Failed to update feature link');
      }
    },
    [selectedTask]
  );

  const updateTaskDaysOfWeek = useCallback(
    async (daysOfWeek: number[] | null) => {
      if (!selectedTask) return;

      try {
        const result = await updateTask(selectedTask.task.id, {
          daysOfWeek,
          userId: userId || 'demo-user',
        });
        if (result.success) {
          setSelectedTask((prev) =>
            prev
              ? {
                  ...prev,
                  task: {
                    ...prev.task,
                    days_of_week: daysOfWeek,
                  },
                }
              : null
          );
          // Refresh the calendar to reflect the change
          await loadCalendarData();
        }
      } catch {
        setError('Failed to update task days');
      }
    },
    [selectedTask, userId, loadCalendarData]
  );

  const addSubTask = useCallback(
    async (title: string) => {
      if (!selectedTask) return;

      try {
        const result = await createSubTask(selectedTask.task.id, {
          title,
          userId: userId || 'demo-user',
        });
        if (result.success) {
          setSelectedTask((prev) =>
            prev
              ? { ...prev, subTasks: [...prev.subTasks, result.data] }
              : null
          );
        }
      } catch {
        setError('Failed to add sub-task');
      }
    },
    [selectedTask, userId]
  );

  const toggleSubTask = useCallback(
    async (subTaskId: string) => {
      if (!selectedTask) return;

      const subTask = selectedTask.subTasks.find((st) => st.id === subTaskId);
      if (!subTask) return;

      try {
        if (subTask.is_archived) {
          // Unarchive = mark as incomplete
          const result = await updateTask(subTaskId, { is_archived: false });
          if (result.success) {
            setSelectedTask((prev) =>
              prev
                ? {
                    ...prev,
                    subTasks: prev.subTasks.map((st) =>
                      st.id === subTaskId ? { ...st, is_archived: false } : st
                    ),
                  }
                : null
            );
          }
        } else {
          // Archive = mark as complete
          const result = await archiveTask(subTaskId);
          if (result.success) {
            setSelectedTask((prev) =>
              prev
                ? {
                    ...prev,
                    subTasks: prev.subTasks.map((st) =>
                      st.id === subTaskId ? { ...st, is_archived: true } : st
                    ),
                  }
                : null
            );
          }
        }
      } catch {
        setError('Failed to toggle sub-task');
      }
    },
    [selectedTask]
  );

  const deleteSubTask = useCallback(
    async (subTaskId: string) => {
      if (!selectedTask) return;

      try {
        const result = await deleteTaskService(subTaskId);
        if (result.success) {
          setSelectedTask((prev) =>
            prev
              ? {
                  ...prev,
                  subTasks: prev.subTasks.filter((st) => st.id !== subTaskId),
                }
              : null
          );
        }
      } catch {
        setError('Failed to delete sub-task');
      }
    },
    [selectedTask]
  );

  const deleteTaskHandler = useCallback(async () => {
    if (!selectedTask) return;

    try {
      const result = await deleteTaskService(selectedTask.task.id);
      if (result.success) {
        closeTaskModal();
        await loadCalendarData();
      }
    } catch {
      setError('Failed to delete task');
    }
  }, [selectedTask, closeTaskModal, loadCalendarData]);

  // Comments
  const addComment = useCallback(
    async (content: string) => {
      if (!selectedTask || !userId) return;

      try {
        const result = await createComment({
          taskId: selectedTask.task.id,
          content,
          createdBy: userId,
          createdByName: 'User',
        });
        if (result.success) {
          setTaskComments((prev) => [...prev, result.data]);
        }
      } catch {
        setError('Failed to add comment');
      }
    },
    [selectedTask, userId]
  );

  const removeComment = useCallback(
    async (commentId: string) => {
      if (!userId) return;

      try {
        const result = await deleteComment(commentId, userId);
        if (result.success) {
          setTaskComments((prev) => prev.filter((c) => c.id !== commentId));
        }
      } catch {
        setError('Failed to delete comment');
      }
    },
    [userId]
  );

  // View mode
  const setViewMode = useCallback(
    async (mode: TaskViewMode) => {
      setViewModeState(mode);

      if (userId) {
        try {
          await updatePreferences(userId, { view_mode: mode });
        } catch {
          // Ignore - preferences are optional
        }
      }
    },
    [userId]
  );

  const toggleViewModeHandler = useCallback(async () => {
    const newMode = viewMode === 'all' ? 'incomplete' : 'all';
    await setViewMode(newMode);
  }, [viewMode, setViewMode]);

  // Refresh
  const refresh = useCallback(async () => {
    await loadCalendarData();
    await loadChecklists();
  }, [loadCalendarData, loadChecklists]);

  return {
    // State
    currentDate,
    selectedDate,
    calendarData,
    checklists,
    selectedTask,
    selectedTaskChecklist,
    taskComments,
    viewMode,
    isLoading,
    isTaskModalOpen,
    error,

    // Navigation
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    goToDate,

    // Selection
    selectDate,
    selectTask,
    closeTaskModal,

    // Task operations
    toggleTaskComplete,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskPriority,
    updateTaskFeatureLink,
    updateTaskDaysOfWeek,
    addSubTask,
    toggleSubTask,
    deleteSubTask,
    deleteTask: deleteTaskHandler,

    // Comments
    addComment,
    removeComment,

    // View mode
    setViewMode,
    toggleViewMode: toggleViewModeHandler,

    // Refresh
    refresh,
  };
}
