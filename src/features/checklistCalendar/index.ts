/**
 * Checklist Calendar Feature
 *
 * Calendar-centric task and SOP management system.
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

// Schema types
export type {
  AdminChecklist,
  AdminTask,
  AdminTaskCompletion,
  AdminTaskComment,
  UserChecklistPreferences,
  ChecklistWizardProgress,
  ChecklistRecurrenceType,
  TaskPriority,
  PeriodType,
  CustomIntervalUnit,
  TaskViewMode,
} from '../../db/schema/checklistCalendar.schema';

// Schema utilities
export {
  DEFAULT_PRIORITY_COLORS,
  CHECKLIST_COLORS,
  createDefaultAdminChecklist,
  createDefaultAdminTask,
  createDefaultUserChecklistPreferences,
  validateAdminChecklist,
  validateAdminTask,
} from '../../db/schema/checklistCalendar.schema';

// Recurrence utilities
export * from './utils/recurrence';

// Services - explicit exports to avoid naming conflicts
export {
  // ChecklistService
  createChecklist,
  getChecklist,
  getChecklists,
  getChecklistsByRecurrenceType,
  updateChecklist,
  reorderChecklists,
  archiveChecklist,
  unarchiveChecklist,
  deleteChecklist,
  duplicateChecklist,
  createFromTemplate,
  // TaskService
  createTask,
  createSubTask,
  getTask,
  getTaskWithSubTasks,
  getTasksForChecklist,
  getSubTasks,
  getTasksForAssignee,
  getTasksByPriority,
  updateTask,
  reorderTasks,
  moveTaskToChecklist,
  convertToSubTask,
  promoteToTopLevel,
  archiveTask,
  unarchiveTask,
  deleteTask,
  // CompletionService
  markTaskComplete,
  markTaskIncomplete,
  toggleTaskCompletion,
  isTaskComplete,
  getCompletionStatusesForDate,
  getCompletionHistory,
  getCompletionsInRange,
  getCompletionsByUser,
  getChecklistCompletionStats,
  getCompletionStreak,
  updateCompletionNotes,
  // CommentService
  createComment,
  getComment,
  getCommentsForTask,
  getCommentCount,
  getRecentComments,
  getCommentsByUser,
  updateComment,
  deleteComment,
  adminDeleteComment,
  getCommentCountsForTasks,
  // CalendarService
  getTasksForDate,
  getCalendarMonth,
  getCalendarWeek,
  getAgendaView,
  getOverdueTasks,
  getCompletionStatsForRange,
  getTodaySummary,
  // PreferencesService
  getOrCreatePreferences,
  getPreferences,
  updatePreferences,
  toggleViewMode,
  setViewMode,
  getPriorityColors,
  updatePriorityColors,
  resetPriorityColors,
  setDefaultCalendarView,
  setWeekStartsOn,
  setEmailReminders,
  deletePreferences,
} from './services';

// Service types - renamed to avoid conflicts with components
export type {
  CreateChecklistInput,
  UpdateChecklistInput,
  GetChecklistsOptions,
  CreateTaskInput,
  UpdateTaskInput,
  TaskWithSubTasks,
  GetTasksOptions,
  MarkCompleteInput,
  TaskCompletionStatus,
  ChecklistCompletionStats,
  CreateCommentInput,
  UpdateCommentInput,
  CommentWithMeta,
  CalendarTask,
  CalendarDay as CalendarDayData,
  CalendarMonth as CalendarMonthData,
  GetCalendarOptions,
  AgendaItem,
  UpdatePreferencesInput,
  PriorityColors,
} from './services';

// Components
export {
  CalendarMonth,
  CalendarDay,
  TaskCard,
  TaskDetailModal,
  SetupWizard,
  ChecklistManager,
} from './components';

export type {
  CalendarMonthProps,
  CalendarDayProps,
  TaskCardProps,
  TaskDetailModalProps,
  SetupWizardProps,
  WizardChecklist,
  WizardTask,
  ChecklistManagerProps,
} from './components';

// Hooks
export { useCalendar } from './hooks';
export type { UseCalendarOptions, UseCalendarReturn } from './hooks';

// Pages
export { AdminCalendarPage } from './pages';
export type { AdminCalendarPageProps } from './pages';
