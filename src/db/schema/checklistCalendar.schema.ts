/**
 * Checklist Calendar Schema Definition
 *
 * Defines the structure for the calendar-centric task management system.
 * This replaces the old flat checklist structure with a hierarchical,
 * calendar-driven approach supporting custom recurrence patterns.
 *
 * Requirements:
 * - CHECK-001: Personalized Checklist System
 * - CHECK-002: Checklist Interface
 * - ARCH-004: CRDT-Compatible Schema Design
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md for full specification
 */

import type { BaseEntity, VersionVector } from '../../types/database.types';

// =============================================================================
// ENUMS & TYPES
// =============================================================================

/**
 * Recurrence type for checklists
 */
export type ChecklistRecurrenceType =
  | 'daily' // Every day
  | 'weekly' // Specific day(s) of week
  | 'monthly' // Specific day of month
  | 'quarterly' // Specific point in quarter
  | 'annual' // Specific date each year
  | 'custom' // Custom interval (every N days/weeks/months)
  | 'one-time'; // Non-recurring, specific date

/**
 * Task priority levels
 */
export type TaskPriority = 'high' | 'medium' | 'low' | 'none';

/**
 * Period type for completion tracking
 */
export type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Custom interval unit
 */
export type CustomIntervalUnit = 'days' | 'weeks' | 'months';

/**
 * Task view mode
 */
export type TaskViewMode = 'all' | 'incomplete';

// =============================================================================
// ENTITY: AdminChecklist
// =============================================================================

/**
 * A checklist is a named collection of related tasks with a shared recurrence pattern.
 * Called "AdminChecklist" to avoid conflicts with old ChecklistItem.
 */
export interface AdminChecklist extends BaseEntity {
  company_id: string; // FK to company

  // Identity
  name: string; // ENCRYPTED - e.g., "Daily Bookkeeping", "Monthly Close"
  description: string | null; // ENCRYPTED - Optional description
  color: string; // Hex color for calendar display (user-editable)
  icon: string | null; // Optional icon identifier

  // Recurrence type determines when tasks appear
  recurrence_type: ChecklistRecurrenceType;

  // For weekly: which day(s) of the week (0=Sunday, 1=Monday, ..., 6=Saturday)
  weekly_days: number[] | null;

  // For monthly: which day of month
  monthly_day: number | null; // 1-31, or -1 for "last day"
  monthly_week: number | null; // 1-4 or -1 for "last" (for "first Monday" etc.)
  monthly_day_of_week: number | null; // 0-6 for "first Monday" etc.

  // For quarterly: which month in quarter (1, 2, or 3) + day rules
  quarterly_month: number | null; // 1, 2, or 3
  quarterly_day: number | null; // Day within that month

  // Flexible month selection (for quarterly with prep/follow-up months)
  // Array of months (1-12) when this checklist should run
  // If set, overrides quarterly_month for more flexible scheduling
  recurrence_months: number[] | null;

  // For annual: which month (1-12) + day rules
  annual_month: number | null; // 1-12
  annual_day: number | null; // Day within that month

  // For custom intervals (e.g., every 14 days, every 2 weeks)
  custom_interval_value: number | null; // The number (e.g., 14, 2, 3)
  custom_interval_unit: CustomIntervalUnit | null; // The unit
  custom_start_date: number | null; // Unix timestamp - when to start counting from

  // Source tracking
  is_template: boolean; // Is this a system template?
  is_from_assessment: boolean; // Created from accountant assessment?
  assessment_id: string | null; // FK to assessment if applicable
  template_id: string | null; // FK to source template if copied

  // Status
  is_archived: boolean;
  order: number; // Display ordering

  // Weekend settings
  exclude_weekends: boolean; // If true, don't show on Saturday/Sunday

  // Effective date - checklists only show from this date forward
  effective_from: number | null; // Unix timestamp, null means from creation date

  // CRDT
  version_vector: VersionVector;
}

/**
 * Dexie.js schema definition for AdminChecklists table
 */
export const adminChecklistsSchema =
  'id, company_id, recurrence_type, is_archived, order, updated_at, deleted_at';

// =============================================================================
// ENTITY: AdminTask
// =============================================================================

/**
 * A task is an individual item within a checklist, optionally with sub-tasks.
 */
export interface AdminTask extends BaseEntity {
  checklist_id: string; // FK to AdminChecklist
  parent_task_id: string | null; // FK to parent AdminTask (for sub-tasks)
  company_id: string; // FK to company (denormalized for indexing)

  // Content
  title: string; // ENCRYPTED - Short task name
  description: string; // ENCRYPTED - Rich text SOP/instructions (HTML)
  description_format: 'html' | 'markdown';

  // Priority (visual indicator)
  priority: TaskPriority;

  // Assignment
  assignee_id: string | null; // FK to user
  assignee_name: string | null; // Denormalized for display

  // Feature linking
  feature_link: string | null; // Route path, e.g., "/reports/profit-loss"
  feature_link_label: string | null; // Display text for link button

  // Ordering
  order: number; // Within parent or checklist

  // One-time task specific date (Unix timestamp)
  scheduled_date: number | null;

  // Task-level recurrence overrides (null means inherit from checklist)
  days_of_week: number[] | null; // 0=Sunday through 6=Saturday
  exclude_weekends: boolean | null; // Override checklist's exclude_weekends

  // Status
  is_archived: boolean;

  // Edit tracking
  created_by: string; // userId
  updated_by: string | null; // userId of last editor

  // CRDT
  version_vector: VersionVector;
}

/**
 * Dexie.js schema definition for AdminTasks table
 */
export const adminTasksSchema =
  'id, checklist_id, parent_task_id, company_id, assignee_id, priority, order, is_archived, updated_at, deleted_at';

// =============================================================================
// ENTITY: AdminTaskCompletion
// =============================================================================

/**
 * Tracks completion of recurring tasks per period.
 * Separate from the task itself to track multiple completions over time.
 */
export interface AdminTaskCompletion extends BaseEntity {
  task_id: string; // FK to AdminTask
  company_id: string; // FK to company (for indexing)

  // Which period was completed
  period_type: PeriodType;
  period_value: string; // ISO format: "2024-01-15", "2024-W02", "2024-01", "2024-Q1", "2024"

  // Completion details
  completed_at: number; // Unix timestamp
  completed_by: string; // userId
  completed_by_name: string; // Denormalized for display

  // Optional notes on this completion
  notes: string | null; // ENCRYPTED
}

/**
 * Dexie.js schema definition for AdminTaskCompletions table
 */
export const adminTaskCompletionsSchema =
  'id, task_id, company_id, [period_type+period_value], [task_id+period_type+period_value], completed_at, updated_at, deleted_at';

// =============================================================================
// ENTITY: AdminTaskComment
// =============================================================================

/**
 * Discussion thread on a task.
 */
export interface AdminTaskComment extends BaseEntity {
  task_id: string; // FK to AdminTask

  // Author
  author_id: string; // userId
  author_name: string; // Denormalized for display
  author_initials: string; // For avatar

  // Content
  content: string; // ENCRYPTED - Rich text (HTML)
  content_format: 'html' | 'markdown';

  // Edit tracking
  is_edited: boolean;
  edited_at: number | null;
}

/**
 * Dexie.js schema definition for AdminTaskComments table
 */
export const adminTaskCommentsSchema =
  'id, task_id, author_id, created_at, updated_at, deleted_at';

// =============================================================================
// ENTITY: UserChecklistPreferences
// =============================================================================

/**
 * User preferences for the checklist calendar system.
 */
export interface UserChecklistPreferences extends BaseEntity {
  user_id: string; // FK to user
  company_id: string; // FK to company (preferences can vary by company)

  // View mode
  view_mode: TaskViewMode; // 'all' or 'incomplete'

  // Calendar display
  default_calendar_view: 'month' | 'week' | 'agenda';
  week_starts_on: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday, 1=Monday, etc.

  // Priority colors (user-customizable)
  priority_color_high: string; // Default: '#EF4444' (red)
  priority_color_medium: string; // Default: '#F97316' (orange)
  priority_color_low: string; // Default: '#8B5CF6' (purple - brand color)

  // Notifications (future)
  email_reminders: boolean;
  reminder_time: string | null; // "09:00" format
}

/**
 * Dexie.js schema definition for UserChecklistPreferences table
 */
export const userChecklistPreferencesSchema =
  'id, user_id, company_id, [user_id+company_id], updated_at, deleted_at';

// =============================================================================
// ENTITY: ChecklistWizardProgress
// =============================================================================

/**
 * Stores wizard progress for resume functionality.
 */
export interface ChecklistWizardProgress extends BaseEntity {
  user_id: string;
  company_id: string;

  // Current step
  current_step: number;

  // Wizard state (JSON serialized)
  wizard_state: string; // JSON - WizardState object

  // Status
  is_completed: boolean;
  completed_at: number | null;
}

/**
 * Dexie.js schema definition for ChecklistWizardProgress table
 */
export const checklistWizardProgressSchema =
  'id, user_id, company_id, [user_id+company_id], is_completed, updated_at, deleted_at';

// =============================================================================
// DEFAULT VALUES
// =============================================================================

/**
 * Default priority colors (Graceful Books branding)
 */
export const DEFAULT_PRIORITY_COLORS = {
  high: '#EF4444', // Red
  medium: '#F97316', // Orange
  low: '#8B5CF6', // Purple (brand color)
};

/**
 * Default checklist colors palette
 */
export const CHECKLIST_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Gray', value: '#6B7280' },
];

/**
 * Create default AdminChecklist
 */
export const createDefaultAdminChecklist = (
  companyId: string,
  name: string,
  recurrenceType: ChecklistRecurrenceType,
  deviceId: string
): Partial<AdminChecklist> => {
  const now = Date.now();

  return {
    company_id: companyId,
    name,
    description: null,
    color: CHECKLIST_COLORS[0].value, // Default to blue
    icon: null,
    recurrence_type: recurrenceType,
    weekly_days: null,
    monthly_day: null,
    monthly_week: null,
    monthly_day_of_week: null,
    quarterly_month: null,
    quarterly_day: null,
    recurrence_months: null,
    annual_month: null,
    annual_day: null,
    custom_interval_value: null,
    custom_interval_unit: null,
    custom_start_date: null,
    is_template: false,
    is_from_assessment: false,
    assessment_id: null,
    template_id: null,
    is_archived: false,
    order: 0,
    exclude_weekends: false,
    effective_from: now, // Default to creation time
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: { [deviceId]: 1 },
  };
};

/**
 * Create default AdminTask
 */
export const createDefaultAdminTask = (
  checklistId: string,
  companyId: string,
  title: string,
  userId: string,
  deviceId: string
): Partial<AdminTask> => {
  const now = Date.now();

  return {
    checklist_id: checklistId,
    parent_task_id: null,
    company_id: companyId,
    title,
    description: '',
    description_format: 'html',
    priority: 'none',
    assignee_id: null,
    assignee_name: null,
    feature_link: null,
    feature_link_label: null,
    order: 0,
    scheduled_date: null,
    days_of_week: null,
    exclude_weekends: null,
    is_archived: false,
    created_by: userId,
    updated_by: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    version_vector: { [deviceId]: 1 },
  };
};

/**
 * Create default UserChecklistPreferences
 */
export const createDefaultUserChecklistPreferences = (
  userId: string,
  companyId: string,
  deviceId: string
): Partial<UserChecklistPreferences> => {
  const now = Date.now();

  return {
    user_id: userId,
    company_id: companyId,
    view_mode: 'incomplete', // Default to showing only incomplete tasks
    default_calendar_view: 'month',
    week_starts_on: 0, // Sunday
    priority_color_high: DEFAULT_PRIORITY_COLORS.high,
    priority_color_medium: DEFAULT_PRIORITY_COLORS.medium,
    priority_color_low: DEFAULT_PRIORITY_COLORS.low,
    email_reminders: false,
    reminder_time: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
};

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate AdminChecklist
 */
export const validateAdminChecklist = (
  checklist: Partial<AdminChecklist>
): string[] => {
  const errors: string[] = [];

  if (!checklist.company_id) {
    errors.push('company_id is required');
  }

  if (!checklist.name || checklist.name.trim() === '') {
    errors.push('name is required');
  }

  if (!checklist.recurrence_type) {
    errors.push('recurrence_type is required');
  }

  // Validate recurrence-specific fields
  if (checklist.recurrence_type === 'weekly' && !checklist.weekly_days?.length) {
    errors.push('weekly_days is required for weekly recurrence');
  }

  if (checklist.recurrence_type === 'custom') {
    if (!checklist.custom_interval_value || checklist.custom_interval_value < 1) {
      errors.push('custom_interval_value must be at least 1');
    }
    if (!checklist.custom_interval_unit) {
      errors.push('custom_interval_unit is required for custom recurrence');
    }
  }

  return errors;
};

/**
 * Validate AdminTask
 */
export const validateAdminTask = (task: Partial<AdminTask>): string[] => {
  const errors: string[] = [];

  if (!task.checklist_id) {
    errors.push('checklist_id is required');
  }

  if (!task.company_id) {
    errors.push('company_id is required');
  }

  if (!task.title || task.title.trim() === '') {
    errors.push('title is required');
  }

  // Validate days_of_week if provided
  if (task.days_of_week !== null && task.days_of_week !== undefined) {
    if (task.days_of_week.length > 0) {
      const invalidDays = task.days_of_week.filter((d) => d < 0 || d > 6);
      if (invalidDays.length > 0) {
        errors.push('days_of_week must contain values 0-6');
      }
    }
  }

  return errors;
};

// =============================================================================
// TABLE NAMES
// =============================================================================

export const ADMIN_CHECKLISTS_TABLE = 'adminChecklists';
export const ADMIN_TASKS_TABLE = 'adminTasks';
export const ADMIN_TASK_COMPLETIONS_TABLE = 'adminTaskCompletions';
export const ADMIN_TASK_COMMENTS_TABLE = 'adminTaskComments';
export const USER_CHECKLIST_PREFERENCES_TABLE = 'userChecklistPreferences';
export const CHECKLIST_WIZARD_PROGRESS_TABLE = 'checklistWizardProgress';
