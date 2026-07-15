# Checklist Calendar System Roadmap

**A Calendar-Centric Task & SOP Management System**

---

## Overview

The Checklist Calendar System transforms traditional static checklists into a dynamic, calendar-driven workflow tool. Instead of viewing tasks as disconnected items, users see their bookkeeping responsibilities laid out across a calendar where each day displays the tasks due that day.

**Core Philosophy:**
- Tasks live on the calendar, not in isolated lists
- Every task can become an SOP (Standard Operating Procedure) with rich documentation
- Recurring tasks automatically appear on their scheduled days
- Comments enable team discussion and accountability
- A setup wizard makes initial configuration approachable
- **No restrictions** - users define their own schedules (admin day on Tuesday? First of month instead of last? Every 14 days? All supported)
- **User sovereignty** - we provide a framework they mold to fit their needs

**Two Entry Paths:**
1. **Self-service:** User customizes the default bookkeeping template via wizard
2. **Accountant-assisted:** Accountant sends pre-configured assessment that generates checklists

Both paths result in the same calendar-driven experience.

---

## Dependencies

### Required Before Starting

| Dependency | Status | Location |
|------------|--------|----------|
| Dexie.js database layer | ✅ Complete | `src/db/` |
| Authentication system | ✅ Complete | `src/features/auth/` |
| Modal/Dialog components | ✅ Complete | `src/components/feedback/` |
| Form components | ✅ Complete | `src/components/forms/` |
| Company context | ✅ Complete | `src/contexts/CompanyContext` |

### Required During Implementation

| Dependency | Notes |
|------------|-------|
| Rich text editor | New component needed for SOP editing |
| Calendar grid component | New component for month view |
| Feature registry | List of linkable app pages |

---

## Data Model

### Entity: `Checklist`

A checklist is a named collection of related tasks with a shared recurrence pattern.

```typescript
interface Checklist {
  id: string;                          // UUID
  companyId: string;                   // FK to company

  // Identity
  name: string;                        // e.g., "Daily Bookkeeping", "Monthly Close"
  description: string | null;          // Optional description
  color: string;                       // Color for calendar display (user-editable, has default)
  icon: string | null;                 // Optional icon identifier

  // Recurrence type determines when tasks appear
  recurrenceType: ChecklistRecurrenceType;

  // For weekly: which day(s) of the week
  weeklyDays: number[] | null;         // 0=Sunday, 1=Monday, ..., 6=Saturday

  // For monthly: which day of month (1-31, or special values)
  monthlyDay: number | null;           // 1-31, or -1 for "last day"
  monthlyWeek: number | null;          // 1-4 for "first Monday", etc.
  monthlyDayOfWeek: number | null;     // 0-6 for "first Monday", etc.

  // For quarterly: which month in quarter (1, 2, or 3) + day rules
  quarterlyMonth: number | null;       // 1, 2, or 3
  quarterlyDay: number | null;         // Day within that month

  // For annual: which month (1-12) + day rules
  annualMonth: number | null;          // 1-12
  annualDay: number | null;            // Day within that month

  // For custom intervals (e.g., every 14 days, every 2 weeks)
  customIntervalValue: number | null;  // The number (e.g., 14, 2, 3)
  customIntervalUnit: 'days' | 'weeks' | 'months' | null; // The unit
  customStartDate: Date | null;        // When to start counting from

  // Source tracking
  isTemplate: boolean;                 // Is this a system template?
  isFromAssessment: boolean;           // Created from accountant assessment?
  assessmentId: string | null;         // FK to assessment if applicable
  templateId: string | null;           // FK to source template if copied

  // Status
  isArchived: boolean;
  order: number;                       // Display ordering

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;                   // userId
}

type ChecklistRecurrenceType =
  | 'daily'           // Every day
  | 'weekly'          // Specific day(s) of week
  | 'monthly'         // Specific day of month
  | 'quarterly'       // Specific point in quarter
  | 'annual'          // Specific date each year
  | 'custom'          // Custom interval (every N days, every N weeks, etc.)
  | 'one-time';       // Non-recurring, specific date
```

### Entity: `Task`

A task is an individual item within a checklist, optionally with sub-tasks.

```typescript
interface Task {
  id: string;                          // UUID
  checklistId: string;                 // FK to checklist
  parentTaskId: string | null;         // FK to parent task (for sub-tasks)

  // Content
  title: string;                       // Short task name
  description: string;                 // Rich text SOP/instructions (HTML or Markdown)
  descriptionFormat: 'html' | 'markdown';

  // Priority (visual indicator on calendar and lists)
  priority: TaskPriority;              // User-settable priority level

  // Assignment (who is responsible)
  assigneeId: string | null;           // FK to user - who should complete this
  assigneeName: string | null;         // Denormalized for display

  // Feature linking
  featureLink: string | null;          // Route path, e.g., "/reports/profit-loss"
  featureLinkLabel: string | null;     // Display text for link button

  // Ordering
  order: number;                       // Within parent or checklist

  // One-time task specific date (when checklist is 'one-time')
  scheduledDate: Date | null;

  // Status
  isArchived: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;                   // userId
  updatedBy: string | null;            // userId of last editor
}

type TaskPriority = 'high' | 'medium' | 'low' | 'none';

// Priority visual indicators (DEFAULT colors - user can customize):
// - high:   Red dot/badge, appears first in lists
// - medium: Yellow/orange dot/badge
// - low:    Purple dot/badge (Graceful Books brand color)
// - none:   No indicator (default)
//
// Users can customize these colors in Settings > Preferences
```

### Entity: `TaskCompletion`

Tracks completion of recurring tasks per period.

```typescript
interface TaskCompletion {
  id: string;                          // UUID
  taskId: string;                      // FK to task
  companyId: string;                   // FK to company (for indexing)

  // Which period was completed
  periodType: PeriodType;
  periodValue: string;                 // ISO format: "2024-01-15", "2024-W02", "2024-01", "2024-Q1", "2024"

  // Completion details
  completedAt: Date;
  completedBy: string;                 // userId
  completedByName: string;             // Denormalized for display

  // Optional notes on this completion
  notes: string | null;
}

type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year';
```

### Entity: `TaskComment`

Discussion thread on a task.

```typescript
interface TaskComment {
  id: string;                          // UUID
  taskId: string;                      // FK to task

  // Author
  authorId: string;                    // userId
  authorName: string;                  // Denormalized for display
  authorInitials: string;              // For avatar

  // Content
  content: string;                     // Rich text (HTML or Markdown)
  contentFormat: 'html' | 'markdown';

  // Edit tracking
  isEdited: boolean;
  editedAt: Date | null;

  // Timestamps
  createdAt: Date;
}
```

### Entity: `ChecklistTemplate`

Pre-defined templates that can be customized.

```typescript
interface ChecklistTemplate {
  id: string;                          // Identifier like "default-bookkeeping"
  name: string;                        // "Standard Bookkeeping Template"
  description: string;
  version: string;                     // "1.0.0"

  // Template content
  checklists: ChecklistTemplateItem[];
}

interface ChecklistTemplateItem {
  name: string;
  description: string;
  recurrenceType: ChecklistRecurrenceType;
  recurrenceConfig: object;            // Type-specific config
  tasks: TaskTemplateItem[];
}

interface TaskTemplateItem {
  title: string;
  description: string;
  featureLink: string | null;
  featureLinkLabel: string | null;
  subTasks: TaskTemplateItem[];
}
```

### Database Schema (Dexie.js)

```typescript
// In src/db/schema.ts

db.version(X).stores({
  checklists: '++id, companyId, recurrenceType, isArchived, order',
  tasks: '++id, checklistId, parentTaskId, order, isArchived',
  taskCompletions: '++id, taskId, companyId, [periodType+periodValue], completedAt',
  taskComments: '++id, taskId, createdAt',
});
```

**Index Rationale:**
- `checklists`: Query by company, filter by type
- `tasks`: Query by checklist, get sub-tasks by parent
- `taskCompletions`: Query by task+period for completion status, by company for calendar view
- `taskComments`: Query by task, order by creation

---

## Recurrence Calculation

### Core Function: `getTasksDueOnDate(date: Date): Task[]`

This function determines which tasks appear on a given calendar date.

```typescript
function getTasksDueOnDate(
  date: Date,
  checklists: Checklist[],
  tasks: Task[]
): Task[] {
  const dueTasks: Task[] = [];

  for (const checklist of checklists) {
    if (checklist.isArchived) continue;

    if (isChecklistDueOnDate(checklist, date)) {
      // Get all non-archived root tasks (parentTaskId is null)
      const checklistTasks = tasks.filter(
        t => t.checklistId === checklist.id &&
             !t.isArchived &&
             t.parentTaskId === null
      );
      dueTasks.push(...checklistTasks);
    }
  }

  return dueTasks;
}

function isChecklistDueOnDate(checklist: Checklist, date: Date): boolean {
  switch (checklist.recurrenceType) {
    case 'daily':
      return true; // Every day

    case 'weekly':
      return checklist.weeklyDays?.includes(date.getDay()) ?? false;

    case 'monthly':
      return isMonthlyDue(checklist, date);

    case 'quarterly':
      return isQuarterlyDue(checklist, date);

    case 'annual':
      return isAnnualDue(checklist, date);

    case 'custom':
      return isCustomIntervalDue(checklist, date);

    case 'one-time':
      // Check each task's scheduledDate
      return false; // Handled at task level

    default:
      return false;
  }
}
```

### Monthly Recurrence Logic

```typescript
function isMonthlyDue(checklist: Checklist, date: Date): boolean {
  const { monthlyDay, monthlyWeek, monthlyDayOfWeek } = checklist;

  // Option 1: Specific day of month (1-31)
  if (monthlyDay !== null && monthlyDay > 0) {
    return date.getDate() === monthlyDay;
  }

  // Option 2: Last day of month
  if (monthlyDay === -1) {
    const lastDay = getLastDayOfMonth(date);
    return date.getDate() === lastDay;
  }

  // Option 3: Nth weekday (e.g., "first Monday", "third Friday")
  if (monthlyWeek !== null && monthlyDayOfWeek !== null) {
    return isNthWeekdayOfMonth(date, monthlyWeek, monthlyDayOfWeek);
  }

  return false;
}

function getLastDayOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function isNthWeekdayOfMonth(
  date: Date,
  n: number,           // 1-4 for first through fourth, -1 for last
  dayOfWeek: number    // 0-6
): boolean {
  if (date.getDay() !== dayOfWeek) return false;

  const dayOfMonth = date.getDate();

  if (n === -1) {
    // Last occurrence of this weekday
    const lastDay = getLastDayOfMonth(date);
    const daysUntilEnd = lastDay - dayOfMonth;
    return daysUntilEnd < 7;
  }

  // Nth occurrence
  const weekOfMonth = Math.ceil(dayOfMonth / 7);
  return weekOfMonth === n;
}
```

### Quarterly Recurrence Logic

```typescript
function isQuarterlyDue(checklist: Checklist, date: Date): boolean {
  const { quarterlyMonth, quarterlyDay } = checklist;
  if (quarterlyMonth === null || quarterlyDay === null) return false;

  const month = date.getMonth() + 1; // 1-12
  const quarter = Math.ceil(month / 3);
  const monthInQuarter = ((month - 1) % 3) + 1; // 1, 2, or 3

  if (monthInQuarter !== quarterlyMonth) return false;

  // Handle last day
  if (quarterlyDay === -1) {
    return date.getDate() === getLastDayOfMonth(date);
  }

  return date.getDate() === quarterlyDay;
}
```

### Annual Recurrence Logic

```typescript
function isAnnualDue(checklist: Checklist, date: Date): boolean {
  const { annualMonth, annualDay } = checklist;
  if (annualMonth === null || annualDay === null) return false;

  const month = date.getMonth() + 1; // 1-12
  if (month !== annualMonth) return false;

  // Handle last day
  if (annualDay === -1) {
    return date.getDate() === getLastDayOfMonth(date);
  }

  return date.getDate() === annualDay;
}
```

### Custom Interval Recurrence Logic

Supports user-defined intervals like "every 14 days", "every 2 weeks", "every 3 months".

```typescript
function isCustomIntervalDue(checklist: Checklist, date: Date): boolean {
  const { customIntervalValue, customIntervalUnit, customStartDate } = checklist;

  if (!customIntervalValue || !customIntervalUnit || !customStartDate) {
    return false;
  }

  const start = startOfDay(customStartDate);
  const target = startOfDay(date);

  // Don't show before start date
  if (target < start) return false;

  switch (customIntervalUnit) {
    case 'days': {
      const daysDiff = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff % customIntervalValue === 0;
    }

    case 'weeks': {
      const daysDiff = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const weeksDiff = Math.floor(daysDiff / 7);
      // Check if this is the same day of week as start AND correct week interval
      const sameDayOfWeek = target.getDay() === start.getDay();
      return sameDayOfWeek && (weeksDiff % customIntervalValue === 0);
    }

    case 'months': {
      // Check if same day of month (or last day if original was last day)
      const startDay = start.getDate();
      const targetDay = target.getDate();
      const isLastDayStart = startDay === getLastDayOfMonth(start);
      const isLastDayTarget = targetDay === getLastDayOfMonth(target);

      const sameDayOfMonth = isLastDayStart ? isLastDayTarget : (startDay === targetDay);
      if (!sameDayOfMonth) return false;

      // Calculate months difference
      const monthsDiff =
        (target.getFullYear() - start.getFullYear()) * 12 +
        (target.getMonth() - start.getMonth());

      return monthsDiff >= 0 && monthsDiff % customIntervalValue === 0;
    }

    default:
      return false;
  }
}

// Helper
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
```

**Custom Interval Examples:**
- Every 14 days: `{ customIntervalValue: 14, customIntervalUnit: 'days', customStartDate: Date }`
- Every 2 weeks: `{ customIntervalValue: 2, customIntervalUnit: 'weeks', customStartDate: Date }`
- Every 3 months: `{ customIntervalValue: 3, customIntervalUnit: 'months', customStartDate: Date }`
- Bi-weekly (every other week): `{ customIntervalValue: 2, customIntervalUnit: 'weeks', customStartDate: Date }`

### Period Value Formatting

```typescript
function getPeriodValue(date: Date, periodType: PeriodType): string {
  switch (periodType) {
    case 'day':
      return date.toISOString().split('T')[0]; // "2024-01-15"

    case 'week':
      return getISOWeek(date); // "2024-W02"

    case 'month':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // "2024-01"

    case 'quarter':
      const q = Math.ceil((date.getMonth() + 1) / 3);
      return `${date.getFullYear()}-Q${q}`; // "2024-Q1"

    case 'year':
      return String(date.getFullYear()); // "2024"
  }
}

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
```

---

## Edge Cases & Solutions

### Date Edge Cases

| Edge Case | Solution |
|-----------|----------|
| **Leap year (Feb 29)** | Tasks set for Feb 29 only appear in leap years. Alert user during setup that this date is rare. |
| **Month day overflow (Feb 30, Apr 31)** | If `monthlyDay` exceeds month length, task appears on last day of that month instead. |
| **Timezone handling** | All dates stored and compared in user's local timezone. Use `startOfDay()` for comparisons. |
| **DST transitions** | Use date-only comparisons (no time component) to avoid DST edge cases. |

### Data Integrity Edge Cases

| Edge Case | Solution |
|-----------|----------|
| **Task deleted with completion history** | Soft delete (`isArchived = true`). Completions remain for historical reporting. Hard delete only if no completions exist. |
| **Checklist deleted with tasks** | Cascade soft delete to all tasks. Completions preserved. |
| **Sub-task orphaned (parent deleted)** | On parent delete, either cascade delete sub-tasks or promote them to root level (user choice via confirmation dialog). |
| **Template modified after user customized** | User's checklists are independent copies. Template changes don't affect existing user data. Offer "re-sync with template" option. |

### Multi-User Edge Cases

| Edge Case | Solution |
|-----------|----------|
| **Same task completed by two users** | First completion wins. Second attempt shows "Already completed by [Name]" with option to add note. |
| **User completes task, another uncompletes** | Track `completedBy` and `uncompletedBy`. Show in activity log. |
| **Comment edited/deleted by different user** | Only author can edit/delete their own comments. Show edit history. |
| **Concurrent edits to task SOP** | Last write wins, but show "Modified by [Name] at [Time]" warning before overwriting. |

### UI Edge Cases

| Edge Case | Solution |
|-----------|----------|
| **Day with many tasks (10+)** | Show first 5 with "+N more" indicator. Click to expand. |
| **Long task titles** | Truncate with ellipsis in calendar view. Full title in detail view. |
| **No tasks for entire month** | Show encouraging message: "No scheduled tasks this month. Looking good!" |
| **Calendar navigation to far past/future** | Allow navigation but show "No data" for months before system start or far future. |

---

## User Preferences & View Modes

### View Mode Toggle

Users can switch between viewing all tasks or only incomplete tasks. This preference is persisted per user.

```typescript
type TaskViewMode = 'all' | 'incomplete';

interface UserChecklistPreferences {
  // View mode
  viewMode: TaskViewMode;              // 'all' shows complete + incomplete, 'incomplete' hides completed

  // Why this matters:
  // - Some users want satisfaction of seeing completed items checked off (viewMode: 'all')
  // - Others prefer a clean slate and want completed items removed (viewMode: 'incomplete')

  // Calendar display
  defaultCalendarView: 'month' | 'week' | 'agenda';
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // 0=Sunday, 1=Monday, etc.

  // Priority colors (user-customizable)
  priorityColors: {
    high: string;                      // Default: '#EF4444' (red)
    medium: string;                    // Default: '#F97316' (orange)
    low: string;                       // Default: '#8B5CF6' (purple - brand color)
  };

  // Notifications (future)
  emailReminders: boolean;
  reminderTime: string;                // "09:00" format
}
```

**UI Placement:**
- Toggle appears in calendar header toolbar: `[All ▼] [Incomplete ○]` or similar
- Same toggle appears in day detail panel and checklist list views
- Preference syncs across all views

### Checklist Color Editing

Users can customize the color of each checklist for visual organization.

```typescript
// Default color palette (user can also enter custom hex)
const CHECKLIST_COLORS = [
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
```

**Where colors appear:**
- Calendar day cells: Task cards have colored left border or background tint
- Day detail panel: Tasks grouped by checklist with colored headers
- Checklist manager: Color picker in checklist edit form

**How to edit:**
1. Go to Checklist Manager
2. Click Edit on any checklist
3. Click color swatch to open color picker
4. Select from palette or enter custom hex

### Priority Levels

Tasks can be assigned a priority level for visual prominence.

| Priority | Default Visual | Behavior |
|----------|----------------|----------|
| **High** | 🔴 Red dot | Appears first in day lists, prominent in calendar |
| **Medium** | 🟡 Yellow/Orange dot | Normal sorting |
| **Low** | 🟣 Purple dot (brand color) | Normal sorting |
| **None** | No indicator | Default, normal sorting |

**User-Customizable Priority Colors:**

Users can change the default priority colors to match their preferences or workflow.

```typescript
interface PriorityColorPreferences {
  high: string;    // Default: '#EF4444' (red)
  medium: string;  // Default: '#F97316' (orange)
  low: string;     // Default: '#8B5CF6' (purple - Graceful Books brand)
}
```

**Where to customize:** Settings > Preferences > Priority Colors

**Sorting behavior:**
- Within a day, high priority tasks sort to top
- Within a checklist, order is: High → Medium → Low → None → then by custom order

### Task Assignment

Tasks can be assigned to specific team members (for multi-user companies).

```typescript
interface TaskAssignment {
  assigneeId: string;          // FK to user
  assigneeName: string;        // Denormalized for display
  assignedAt: Date;
  assignedBy: string;          // userId who made assignment
}
```

**UI Elements:**
- Assignee picker: Dropdown of team members with avatars
- Calendar display: Shows "@John" or user initials
- Filter option: "Show only my tasks" toggle

**Permissions:**
- Admins/Managers can assign to anyone
- Users can assign to themselves
- Assigned tasks appear in assignee's calendar

---

## UI Components

### Page: `ChecklistCalendarPage`

Main calendar view showing the current month with tasks.

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [< Prev]  January 2024  [Next >]   [Today]   [All ▼] [Incomplete ○]  [+]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Sun    │   Mon   │   Tue   │   Wed   │   Thu   │   Fri   │   Sat          │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────────────┤
│         │    1    │    2    │    3    │    4    │    5    │    6           │
│         │ 🔴○Task1│ 🟡○Task1│ ○ Task1 │ ○ Task1 │ ○ Task1 │ ○ Task1        │
│         │ ○ Task2 │ ○ Task2 │ ○ Task2 │ ○ Task2 │ ● Task2 │                │
│         │ +3 more │  @John  │         │         │         │                │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────────────┤
│    7    │    8    │    9    │   10    │   11    │   12    │   13           │
│ ○ Week  │ 🔴○Task1│ ○ Task1 │ ○ Task1 │ ○ Task1 │ ○ Task1 │ ○ Task1        │
│  Tasks  │ ○ Task2 │ ○ Task2 │ ○ Task2 │ ○ Task2 │ ○ Task2 │                │
│         │         │         │         │         │         │                │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────────────┘

Legend:
  ○ = incomplete   ● = complete
  🔴 = high priority   🟡 = medium priority   🟣 = low priority (purple)
  [colored background] = checklist color (user-editable)
  @Name = assigned to user

  Note: Priority colors are user-customizable in Settings
```

**Features:**
- Month navigation (prev/next, jump to today)
- **View toggle: All Tasks / Incomplete Only** - user preference persisted
  - "All" shows both complete (●) and incomplete (○) tasks
  - "Incomplete" hides completed tasks (for users who want clean view)
- Click day to expand day detail panel
- Click task to open task detail modal
- Visual indicators for completion status
- **Priority indicators** (colored dots: red=high, yellow=medium, blue=low)
- **Assignee display** (shows @Name when task is assigned)
- **Checklist color coding** (background/border color, user-editable per checklist)
- Responsive: collapses to agenda view on mobile

**Props:**
```typescript
interface ChecklistCalendarPageProps {
  // None - fetches own data
}
```

### Component: `CalendarMonth`

Renders the month grid.

**Props:**
```typescript
interface CalendarMonthProps {
  year: number;
  month: number; // 0-11
  tasks: Map<string, TaskWithCompletion[]>; // date string -> tasks
  onDayClick: (date: Date) => void;
  onTaskClick: (task: Task) => void;
  onTaskComplete: (taskId: string, date: Date) => void;
  selectedDate: Date | null;
}
```

### Component: `CalendarDay`

Individual day cell.

**Props:**
```typescript
interface CalendarDayProps {
  date: Date;
  isToday: boolean;
  isSelected: boolean;
  isCurrentMonth: boolean;
  tasks: TaskWithCompletion[];
  maxTasksVisible: number; // default 3
  onDayClick: () => void;
  onTaskClick: (task: Task) => void;
  onTaskComplete: (taskId: string) => void;
}
```

### Component: `DayDetailPanel`

Slide-out panel showing all tasks for selected day.

**Layout:**
```
┌─────────────────────────────────────────┐
│  Friday, January 5, 2024          [X]  │
├─────────────────────────────────────────┤
│  DAILY TASKS (3)                        │
│  ┌─────────────────────────────────────┐│
│  │ ○ Check bank account activity   [>] ││
│  │ ○ Check credit card activity    [>] ││
│  │ ● Reconcile cash on hand        [>] ││
│  └─────────────────────────────────────┘│
│                                         │
│  WEEKLY TASKS (2)                       │
│  ┌─────────────────────────────────────┐│
│  │ ○ Send customer invoices        [>] ││
│  │ ○ Review aged receivables       [>] ││
│  └─────────────────────────────────────┘│
│                                         │
│  [+ Add Custom Task]                    │
└─────────────────────────────────────────┘
```

**Props:**
```typescript
interface DayDetailPanelProps {
  date: Date;
  isOpen: boolean;
  onClose: () => void;
  tasks: TaskWithCompletion[];
  groupedByChecklist: Map<Checklist, TaskWithCompletion[]>;
  onTaskClick: (task: Task) => void;
  onTaskComplete: (taskId: string) => void;
  onTaskUncomplete: (taskId: string) => void;
  onAddTask: () => void;
}
```

### Component: `TaskCard`

Compact task display for calendar and panels.

**Props:**
```typescript
interface TaskCardProps {
  task: Task;
  isComplete: boolean;
  completedBy?: string;
  checklistColor?: string;           // User-editable checklist color
  priority: TaskPriority;            // Shows colored dot indicator
  assignee?: {                       // Shows @Name badge
    id: string;
    name: string;
    initials: string;
  };
  variant: 'calendar' | 'panel' | 'list';
  onComplete: () => void;
  onUncomplete: () => void;
  onClick: () => void;
}
```

**Visual Indicators:**
- Priority dot: 🔴 high (red), 🟡 medium (orange), 🟣 low (purple), none
  - Colors are user-customizable in Settings
- Assignee: Shows "@John" or avatar with initials
- Checklist color: Background tint or left border color (user-editable per checklist)
- Completion: ○ incomplete, ● complete (with strikethrough option)

### Component: `TaskDetailModal`

Full task view with SOP editor, comments, and sub-tasks.

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Check bank account activity                              [X]  │
│  Daily • Daily Bookkeeping                                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─ DESCRIPTION / SOP ─────────────────────────────────────────┐│
│  │                                                             ││
│  │  [Rich text editor]                                         ││
│  │                                                             ││
│  │  1. Log into online banking                                 ││
│  │  2. Review all transactions since last check               ││
│  │  3. Note any suspicious activity                           ││
│  │  4. Update cash position in dashboard                      ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─ SUB-TASKS ─────────────────────────────────────────────────┐│
│  │  ○ Check main checking account                              ││
│  │  ○ Check savings account                                    ││
│  │  ○ Check credit card transactions                           ││
│  │  [+ Add sub-task]                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─ FEATURE LINK ──────────────────────────────────────────────┐│
│  │  [Dashboard ▼]  →  [Go to Dashboard]                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─ COMMENTS (3) ──────────────────────────────────────────────┐│
│  │  ┌───────────────────────────────────────────────────────┐  ││
│  │  │ JD  John Doe • Jan 5, 2024 at 9:30 AM                │  ││
│  │  │     Found suspicious charge - investigating          │  ││
│  │  └───────────────────────────────────────────────────────┘  ││
│  │  [Add comment...]                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─ COMPLETION HISTORY ────────────────────────────────────────┐│
│  │  ● Jan 5 - Completed by John Doe at 10:15 AM               ││
│  │  ● Jan 4 - Completed by Jane Smith at 9:45 AM              ││
│  │  ● Jan 3 - Completed by John Doe at 10:30 AM               ││
│  │  [Show more...]                                             ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  [Delete Task]                      [Cancel]  [Save Changes]   │
└─────────────────────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Task>) => void;
  onDelete: () => void;
  subTasks: Task[];
  onAddSubTask: (title: string) => void;
  onUpdateSubTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteSubTask: (taskId: string) => void;
  comments: TaskComment[];
  onAddComment: (content: string) => void;
  onEditComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  completionHistory: TaskCompletion[];
  featureOptions: FeatureOption[];
}

interface FeatureOption {
  value: string;  // Route path
  label: string;  // Display name
}
```

### Component: `RichTextEditor`

Rich text editing for SOP descriptions and comments.

**Features:**
- Bold, italic, underline
- Bullet lists, numbered lists
- Headings (H1, H2, H3)
- Links
- Code blocks
- Undo/redo
- Keyboard shortcuts

**Props:**
```typescript
interface RichTextEditorProps {
  value: string;
  format: 'html' | 'markdown';
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  readOnly?: boolean;
  toolbarVariant?: 'full' | 'minimal';
}
```

**Implementation Notes:**
- Consider using TipTap, Slate, or Lexical as the underlying editor
- Must support collaborative editing hints (show when another user is editing)
- Must sanitize HTML output to prevent XSS

### Component: `FeatureLinkPicker`

Dropdown to select app page for linking.

**Props:**
```typescript
interface FeatureLinkPickerProps {
  value: string | null;
  onChange: (value: string | null, label: string | null) => void;
}
```

**Feature Registry:**
```typescript
const LINKABLE_FEATURES: FeatureOption[] = [
  { value: '/dashboard', label: 'Dashboard' },
  { value: '/transactions', label: 'Transactions' },
  { value: '/reconciliation', label: 'Bank Reconciliation' },
  { value: '/invoices', label: 'Invoices' },
  { value: '/invoices/create', label: 'Create Invoice' },
  { value: '/bills', label: 'Bills' },
  { value: '/reports/profit-loss', label: 'Profit & Loss Report' },
  { value: '/reports/balance-sheet', label: 'Balance Sheet' },
  { value: '/reports/cash-flow', label: 'Cash Flow Statement' },
  { value: '/reports/ar-aging', label: 'A/R Aging Report' },
  { value: '/reports/ap-aging', label: 'A/P Aging Report' },
  { value: '/chart-of-accounts', label: 'Chart of Accounts' },
  { value: '/clients', label: 'Clients' },
  { value: '/vendors', label: 'Vendors' },
  { value: '/payroll', label: 'Payroll' },
  { value: '/inventory', label: 'Inventory' },
  { value: '/sales-tax', label: 'Sales Tax' },
  { value: '/settings', label: 'Settings' },
];
```

### Component: `TaskComments`

Discussion thread for a task.

**Props:**
```typescript
interface TaskCommentsProps {
  comments: TaskComment[];
  currentUserId: string;
  onAddComment: (content: string) => void;
  onEditComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
}
```

### Component: `SubTaskList`

Manages sub-tasks within a task.

**Props:**
```typescript
interface SubTaskListProps {
  subTasks: Task[];
  onAdd: (title: string) => void;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
  onReorder: (taskIds: string[]) => void;
  onTaskClick: (task: Task) => void;
}
```

---

## Setup Wizard

### Wizard: `ChecklistSetupWizard`

Step-by-step customization of the default template.

**Flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1 of 8                                      [Skip Setup] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│              Welcome to Your Admin Calendar                     │
│                                                                 │
│  We'll help you set up a personalized task calendar so that    │
│  you can customize it to fit how you actually work.            │
│                                                                 │
│  Here's what we'll set up together:                            │
│                                                                 │
│    ✓ Daily tasks - quick daily checks                          │
│    ✓ Weekly tasks - pick your admin day                        │
│    ✓ Monthly tasks - beginning, middle, or end of month        │
│    ✓ Quarterly tasks - quarterly reporting                     │
│    ✓ Annual tasks - year-end close & tax prep                  │
│    ✓ Custom intervals - every 14 days, bi-weekly, whatever     │
│                                                                 │
│  You can always add, remove, or modify tasks later.            │
│  This is YOUR calendar - we're just here to help you build it. │
│                                                                 │
│                                        [Let's Get Started →]   │
└─────────────────────────────────────────────────────────────────┘
```

**Steps:**

1. **Welcome** - Introduction and overview
2. **Daily Tasks** - Select/deselect daily tasks, add custom ones
3. **Weekly Tasks** - Select/deselect tasks, **choose YOUR admin day** (Tuesday? Friday? Multiple days?)
4. **Monthly Tasks** - Select/deselect, **choose YOUR timing** (1st of month? 15th? Last day? Beginning of following month?)
5. **Quarterly Tasks** - Select/deselect, **configure YOUR schedule** (middle of quarter? End? Beginning of next?)
6. **Annual December Tasks** - Year-end close tasks, **pick your dates**
7. **Annual January Tasks** - Prior year tax tasks, **pick your dates**
8. **Custom Intervals** (optional) - Add any recurring tasks with custom timing (every 14 days, bi-weekly, etc.)
9. **Review & Confirm** - Summary of all selections

**Key Principle:** We provide professional best-practice suggestions as defaults, but the user defines WHEN things happen. Their admin day might be Tuesday, not Friday. They might do month-end on the 5th of the following month, not the last day. We support whatever works for them.

**Task Selection UI (Steps 2-7):**

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 2 of 8: Daily Tasks                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  These tasks will appear on your calendar every day.           │
│  Uncheck any that don't apply to your business.                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ☑ Check bank account activity                               ││
│  │   Review transactions in all business bank accounts         ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ☑ Check credit card activity                                ││
│  │   Review recent credit card charges                         ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ☐ Reconcile cash on hand                                    ││
│  │   Count cash and compare to records (if cash business)      ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ☑ Review mail and email for payments/bills                  ││
│  │   Check for incoming payments and new bills                 ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ☐ Deposit checks or cash                                    ││
│  │   Make bank deposits if you received payments               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [+ Add Custom Daily Task]                                      │
│                                                                 │
│  [← Back]                                          [Continue →] │
└─────────────────────────────────────────────────────────────────┘
```

**Review Step:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 8 of 8: Review Your Setup                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Here's what we'll add to your calendar:                       │
│                                                                 │
│  DAILY (4 tasks)                              [Edit]           │
│  • Check bank account activity                                  │
│  • Check credit card activity                                   │
│  • Review mail/email for payments                               │
│  • Deposit checks or cash                                       │
│                                                                 │
│  WEEKLY (5 tasks) - Every Friday              [Edit]           │
│  • Send customer invoices                                       │
│  • Record customer payments                                     │
│  • Pay supplier invoices                                        │
│  • Review aged receivables                                      │
│  • File receipts                                                │
│                                                                 │
│  MONTHLY (8 tasks) - Last day of month        [Edit]           │
│  • Reconcile bank accounts                                      │
│  • Review Profit & Loss                                         │
│  • ... and 6 more                                               │
│                                                                 │
│  QUARTERLY (10 tasks)                         [Edit]           │
│  ANNUAL - DECEMBER (12 tasks)                 [Edit]           │
│  ANNUAL - JANUARY (8 tasks)                   [Edit]           │
│                                                                 │
│  [← Back]                              [Complete Setup →]       │
└─────────────────────────────────────────────────────────────────┘
```

**Wizard State:**

```typescript
interface WizardState {
  currentStep: number;

  // Daily - every day
  dailyTasks: WizardTaskSelection[];

  // Weekly - user picks their admin day(s)
  weeklyTasks: WizardTaskSelection[];
  weeklyDays: number[];                // User's choice: [2] for Tuesday, [1,5] for Mon+Fri, etc.

  // Monthly - user picks when in the month
  monthlyTasks: WizardTaskSelection[];
  monthlyTiming: MonthlyTimingConfig;  // Flexible timing

  // Quarterly
  quarterlyTasks: WizardTaskSelection[];
  quarterlyConfig: QuarterlyConfig;

  // Annual
  annualDecemberTasks: WizardTaskSelection[];
  decemberDay: number;                 // Which day in December
  annualJanuaryTasks: WizardTaskSelection[];
  januaryDay: number;                  // Which day in January

  // Custom interval tasks
  customIntervalTasks: CustomIntervalTask[];

  // One-off custom tasks
  customTasks: CustomTaskInput[];
}

interface MonthlyTimingConfig {
  type: 'specific-day' | 'last-day' | 'first-weekday' | 'beginning-of-next';
  day?: number;                        // 1-31 if type is 'specific-day'
  weekday?: number;                    // 0-6 if type is 'first-weekday' (e.g., first Monday)
  daysIntoNextMonth?: number;          // 1-10 if type is 'beginning-of-next' (e.g., 5th of next month)
}

interface QuarterlyConfig {
  type: 'end-of-quarter' | 'beginning-of-next' | 'mid-quarter' | 'specific';
  month?: 1 | 2 | 3;                   // Which month in quarter (1=first, 2=second, 3=third)
  day?: number;                        // Which day in that month
}

interface WizardTaskSelection {
  templateTaskId: string;
  isSelected: boolean;
  customTitle?: string;                // If user modified the title
  priority?: TaskPriority;             // User can set priority during wizard
}

interface CustomIntervalTask {
  title: string;
  description: string;
  intervalValue: number;               // e.g., 14
  intervalUnit: 'days' | 'weeks' | 'months';  // e.g., 'days' for "every 14 days"
  startDate: Date;                     // When to start counting
  priority?: TaskPriority;
}

interface CustomTaskInput {
  category: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual-december' | 'annual-january';
  title: string;
  description: string;
  priority?: TaskPriority;
}
```

**Wizard Persistence:**
- Save wizard state to local storage on each step
- Resume from last step if user navigates away
- Clear state on completion or explicit "Start Over"

---

## Service Layer

### `ChecklistService`

```typescript
interface ChecklistService {
  // ═══════════════════════════════════════════════════════════════
  // CHECKLIST CRUD
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create a new checklist
   * @throws {ValidationError} if name is empty or recurrence config invalid
   */
  createChecklist(input: CreateChecklistInput): Promise<Checklist>;

  /**
   * Update an existing checklist
   * @throws {NotFoundError} if checklist doesn't exist
   * @throws {ValidationError} if updates invalid
   */
  updateChecklist(id: string, input: UpdateChecklistInput): Promise<Checklist>;

  /**
   * Soft delete a checklist and all its tasks
   * Preserves completion history
   */
  archiveChecklist(id: string): Promise<void>;

  /**
   * Permanently delete a checklist
   * Only allowed if no completion history exists
   * @throws {ConstraintError} if completions exist
   */
  deleteChecklist(id: string): Promise<void>;

  /**
   * Get all checklists for current company
   */
  getChecklists(options?: GetChecklistsOptions): Promise<Checklist[]>;

  /**
   * Get a single checklist by ID
   * @throws {NotFoundError} if not found
   */
  getChecklist(id: string): Promise<Checklist>;

  // ═══════════════════════════════════════════════════════════════
  // TASK CRUD
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create a new task within a checklist
   */
  createTask(checklistId: string, input: CreateTaskInput): Promise<Task>;

  /**
   * Create a sub-task under an existing task
   */
  createSubTask(parentTaskId: string, input: CreateTaskInput): Promise<Task>;

  /**
   * Update a task
   */
  updateTask(id: string, input: UpdateTaskInput): Promise<Task>;

  /**
   * Soft delete a task
   * Sub-task handling determined by options
   */
  archiveTask(id: string, options?: ArchiveTaskOptions): Promise<void>;

  /**
   * Permanently delete a task (only if no completions)
   */
  deleteTask(id: string): Promise<void>;

  /**
   * Get all tasks for a checklist
   */
  getTasksForChecklist(checklistId: string): Promise<Task[]>;

  /**
   * Get sub-tasks for a parent task
   */
  getSubTasks(parentTaskId: string): Promise<Task[]>;

  /**
   * Reorder tasks within a checklist or parent
   */
  reorderTasks(taskIds: string[]): Promise<void>;

  // ═══════════════════════════════════════════════════════════════
  // CALENDAR QUERIES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get all tasks due on a specific date
   * Includes completion status for that date's period
   */
  getTasksForDate(date: Date): Promise<TaskWithCompletion[]>;

  /**
   * Get tasks for a date range (for calendar month view)
   * Returns map of date string -> tasks
   */
  getTasksForDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, TaskWithCompletion[]>>;

  /**
   * Get tasks due this week
   */
  getTasksDueThisWeek(): Promise<TaskWithCompletion[]>;

  /**
   * Get overdue tasks (incomplete from past periods)
   */
  getOverdueTasks(): Promise<TaskWithCompletion[]>;

  // ═══════════════════════════════════════════════════════════════
  // COMPLETION TRACKING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Mark a task as complete for a specific period
   * @throws {AlreadyCompletedError} if already completed by another user
   */
  completeTask(
    taskId: string,
    date: Date,
    notes?: string
  ): Promise<TaskCompletion>;

  /**
   * Remove completion for a task/period
   */
  uncompleteTask(taskId: string, date: Date): Promise<void>;

  /**
   * Get completion status for a task on a date
   */
  getCompletionStatus(taskId: string, date: Date): Promise<TaskCompletion | null>;

  /**
   * Get completion history for a task
   */
  getCompletionHistory(
    taskId: string,
    options?: HistoryOptions
  ): Promise<TaskCompletion[]>;

  /**
   * Get all completions for a date (across all tasks)
   */
  getCompletionsForDate(date: Date): Promise<TaskCompletion[]>;

  // ═══════════════════════════════════════════════════════════════
  // COMMENTS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Add a comment to a task
   */
  addComment(taskId: string, content: string): Promise<TaskComment>;

  /**
   * Edit a comment (only by author)
   * @throws {ForbiddenError} if not the author
   */
  editComment(commentId: string, content: string): Promise<TaskComment>;

  /**
   * Delete a comment (only by author)
   * @throws {ForbiddenError} if not the author
   */
  deleteComment(commentId: string): Promise<void>;

  /**
   * Get comments for a task
   */
  getComments(taskId: string): Promise<TaskComment[]>;

  // ═══════════════════════════════════════════════════════════════
  // TEMPLATES & WIZARD
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get the default bookkeeping template
   */
  getDefaultTemplate(): ChecklistTemplate;

  /**
   * Apply a template with customizations
   * Creates all checklists and tasks
   */
  applyTemplate(
    template: ChecklistTemplate,
    customizations: TemplateCustomizations
  ): Promise<Checklist[]>;

  /**
   * Save wizard progress (for resume)
   */
  saveWizardProgress(state: WizardState): Promise<void>;

  /**
   * Get saved wizard progress
   */
  getWizardProgress(): Promise<WizardState | null>;

  /**
   * Clear wizard progress
   */
  clearWizardProgress(): Promise<void>;

  /**
   * Complete wizard and create all checklists
   */
  completeWizard(finalState: WizardState): Promise<Checklist[]>;

  /**
   * Check if user has completed initial setup
   */
  hasCompletedSetup(): Promise<boolean>;
}

// ═══════════════════════════════════════════════════════════════
// INPUT/OUTPUT TYPES
// ═══════════════════════════════════════════════════════════════

interface CreateChecklistInput {
  name: string;
  description?: string;
  color?: string;
  recurrenceType: ChecklistRecurrenceType;
  weeklyDays?: number[];
  monthlyDay?: number;
  monthlyWeek?: number;
  monthlyDayOfWeek?: number;
  quarterlyMonth?: number;
  quarterlyDay?: number;
  annualMonth?: number;
  annualDay?: number;
}

interface UpdateChecklistInput {
  name?: string;
  description?: string;
  color?: string;
  order?: number;

  // Recurrence can be fully edited anytime
  // Users should be able to change their admin day, month timing, etc.
  recurrenceType?: ChecklistRecurrenceType;
  weeklyDays?: number[];
  monthlyDay?: number;
  monthlyWeek?: number;
  monthlyDayOfWeek?: number;
  quarterlyMonth?: number;
  quarterlyDay?: number;
  annualMonth?: number;
  annualDay?: number;
  customIntervalValue?: number;
  customIntervalUnit?: 'days' | 'weeks' | 'months';
  customStartDate?: Date;

  // Note: Changing recurrence does NOT affect past completions
  // Past completions remain in history; new recurrence affects future only
}

interface CreateTaskInput {
  title: string;
  description?: string;
  featureLink?: string;
  featureLinkLabel?: string;
  scheduledDate?: Date;              // For one-time tasks
  priority?: TaskPriority;           // Defaults to 'none'
  assigneeId?: string;               // Optional initial assignee
  assigneeName?: string;
}

interface UpdateTaskInput {
  title?: string;
  description?: string;
  featureLink?: string | null;
  featureLinkLabel?: string | null;
  order?: number;
  priority?: TaskPriority;
  assigneeId?: string | null;
  assigneeName?: string | null;
}

interface ArchiveTaskOptions {
  subTaskHandling: 'cascade' | 'promote' | 'orphan';
}

interface GetChecklistsOptions {
  includeArchived?: boolean;
  recurrenceType?: ChecklistRecurrenceType;
}

interface HistoryOptions {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

interface TaskWithCompletion extends Task {
  completion: TaskCompletion | null;
  subTasks: TaskWithCompletion[];
  checklist: Checklist;
}

interface TemplateCustomizations {
  dailyTasks: { templateId: string; selected: boolean; customTitle?: string }[];
  weeklyTasks: { templateId: string; selected: boolean; customTitle?: string }[];
  weeklyDay: number;
  monthlyTasks: { templateId: string; selected: boolean; customTitle?: string }[];
  monthlyDay: number;
  quarterlyTasks: { templateId: string; selected: boolean; customTitle?: string }[];
  annualDecemberTasks: { templateId: string; selected: boolean; customTitle?: string }[];
  annualJanuaryTasks: { templateId: string; selected: boolean; customTitle?: string }[];
  customTasks: CustomTaskInput[];
}
```

---

## Default Template

The default bookkeeping template based on professional best practices.

**Important:** This template provides **suggested defaults** that users customize during the wizard:
- Weekly tasks default to Friday, but user picks their actual admin day
- Monthly tasks default to last day of month, but user picks their timing
- Quarterly tasks default to 15th of first month after quarter, but user configures
- Annual tasks default to mid-December and mid-January, but user picks dates
- Users can add custom interval tasks (every 14 days, bi-weekly, etc.)

**The user is never locked into our defaults.** The template is a starting point they mold to fit their workflow.

```typescript
const DEFAULT_BOOKKEEPING_TEMPLATE: ChecklistTemplate = {
  id: 'default-bookkeeping-v1',
  name: 'Standard Bookkeeping Template',
  description: 'Professional bookkeeping task schedule for small businesses',
  version: '1.0.0',

  checklists: [
    // ═══════════════════════════════════════════════════════════════
    // DAILY TASKS
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'Daily Bookkeeping',
      description: 'Quick daily checks to stay on top of your finances',
      recurrenceType: 'daily',
      recurrenceConfig: {},
      tasks: [
        {
          title: 'Check bank account activity',
          description: 'Log into online banking and review all transactions since your last check. Look for any unexpected charges or deposits.',
          featureLink: '/dashboard',
          featureLinkLabel: 'Dashboard',
          subTasks: []
        },
        {
          title: 'Check credit card activity',
          description: 'Review recent credit card charges for accuracy and to catch any fraudulent activity early.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Reconcile cash on hand',
          description: 'If you handle cash, count your cash drawer or petty cash and compare to your records.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Open mail for payments and bills',
          description: 'Sort through physical mail for checks, invoices, and bills.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Check email for payments and bills',
          description: 'Review email for payment notifications, digital invoices, and financial correspondence.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Deposit checks or cash payments',
          description: 'Make bank deposits for any payments received.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        }
      ]
    },

    // ═══════════════════════════════════════════════════════════════
    // WEEKLY TASKS
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'Weekly Bookkeeping',
      description: 'End-of-week tasks to keep your books current',
      recurrenceType: 'weekly',
      recurrenceConfig: { weeklyDays: [5] }, // Friday
      tasks: [
        {
          title: 'Prepare and send customer invoices',
          description: 'Create and send invoices for all completed work or delivered products this week.',
          featureLink: '/invoices/create',
          featureLinkLabel: 'Create Invoice',
          subTasks: []
        },
        {
          title: 'Record customer invoices and receipts',
          description: 'Enter all invoices and payment receipts into your accounting system.',
          featureLink: '/transactions',
          featureLinkLabel: 'Transactions',
          subTasks: []
        },
        {
          title: 'Pay supplier invoices',
          description: 'Review and pay any supplier invoices that are due.',
          featureLink: '/bills',
          featureLinkLabel: 'Bills',
          subTasks: []
        },
        {
          title: 'Record supplier invoices and payments',
          description: 'Enter supplier invoices and record payments made.',
          featureLink: '/transactions',
          featureLinkLabel: 'Transactions',
          subTasks: []
        },
        {
          title: 'Review aged receivables',
          description: 'Check which customer invoices are overdue and follow up.',
          featureLink: '/reports/ar-aging',
          featureLinkLabel: 'A/R Aging Report',
          subTasks: []
        },
        {
          title: 'File receipts and invoices',
          description: 'Organize and file all physical and digital receipts and invoices.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Categorize transactions from bank feed',
          description: 'Review and categorize any uncategorized transactions.',
          featureLink: '/transactions',
          featureLinkLabel: 'Transactions',
          subTasks: []
        },
        {
          title: 'Verify all daily tasks are caught up',
          description: 'Make sure all daily tasks from this week have been completed.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        }
      ]
    },

    // ═══════════════════════════════════════════════════════════════
    // MONTHLY TASKS
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'Monthly Close',
      description: 'Month-end closing tasks for accurate financial records',
      recurrenceType: 'monthly',
      recurrenceConfig: { monthlyDay: -1 }, // Last day of month
      tasks: [
        {
          title: 'Back up accounting software data',
          description: 'Create a backup of your accounting data before month-end close.',
          featureLink: '/settings',
          featureLinkLabel: 'Settings',
          subTasks: []
        },
        {
          title: 'Reconcile all bank accounts',
          description: 'Match your book balance to your bank statement for each account.',
          featureLink: '/reconciliation',
          featureLinkLabel: 'Reconciliation',
          subTasks: []
        },
        {
          title: 'Process and review payroll',
          description: 'Run payroll and verify all amounts are correct.',
          featureLink: '/payroll',
          featureLinkLabel: 'Payroll',
          subTasks: []
        },
        {
          title: 'Review Profit and Loss Statement',
          description: 'Analyze your income and expenses for the month.',
          featureLink: '/reports/profit-loss',
          featureLinkLabel: 'Profit & Loss',
          subTasks: []
        },
        {
          title: 'Review Balance Sheet',
          description: 'Verify your assets, liabilities, and equity are accurate.',
          featureLink: '/reports/balance-sheet',
          featureLinkLabel: 'Balance Sheet',
          subTasks: []
        },
        {
          title: 'Break out interest on lines of credit or loans',
          description: 'Separate interest charges from principal payments.',
          featureLink: '/transactions',
          featureLinkLabel: 'Transactions',
          subTasks: []
        },
        {
          title: 'Review aged receivables report',
          description: 'Analyze outstanding customer invoices by age.',
          featureLink: '/reports/ar-aging',
          featureLinkLabel: 'A/R Aging',
          subTasks: []
        },
        {
          title: 'Move money to savings account',
          description: 'Transfer profit or reserves to savings as planned.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Follow up on unpaid invoices',
          description: 'Send reminders for overdue customer invoices.',
          featureLink: '/invoices',
          featureLinkLabel: 'Invoices',
          subTasks: []
        },
        {
          title: 'Verify all weekly tasks are caught up',
          description: 'Ensure all weekly tasks from this month are complete.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        }
      ]
    },

    // ═══════════════════════════════════════════════════════════════
    // QUARTERLY TASKS
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'Quarterly Review',
      description: 'Quarterly compliance and review tasks',
      recurrenceType: 'quarterly',
      recurrenceConfig: { quarterlyMonth: 1, quarterlyDay: 15 }, // 15th of first month after quarter end
      tasks: [
        {
          title: 'Payroll Reporting',
          description: 'Complete quarterly payroll tax filings.',
          featureLink: '/payroll',
          featureLinkLabel: 'Payroll',
          subTasks: [
            { title: 'File federal payroll taxes', description: 'Submit Form 941 or applicable federal form.', featureLink: null, featureLinkLabel: null, subTasks: [] },
            { title: 'File state payroll taxes', description: 'Submit state payroll tax returns.', featureLink: null, featureLinkLabel: null, subTasks: [] },
            { title: 'Make any required payments', description: 'Pay any taxes due with filings.', featureLink: null, featureLinkLabel: null, subTasks: [] },
            { title: 'Keep copies for your records', description: 'Save copies of all filings.', featureLink: null, featureLinkLabel: null, subTasks: [] }
          ]
        },
        {
          title: 'Sales Tax Reporting',
          description: 'Complete quarterly sales tax filings if applicable.',
          featureLink: '/sales-tax',
          featureLinkLabel: 'Sales Tax',
          subTasks: [
            { title: 'File state sales tax return', description: 'Submit sales tax return.', featureLink: null, featureLinkLabel: null, subTasks: [] },
            { title: 'Make any required payments', description: 'Pay sales tax due.', featureLink: null, featureLinkLabel: null, subTasks: [] },
            { title: 'Keep copies for your records', description: 'Save copies of filings.', featureLink: null, featureLinkLabel: null, subTasks: [] }
          ]
        },
        {
          title: 'Balance payroll reporting to your books',
          description: 'Verify payroll reports match your accounting records.',
          featureLink: '/reports/profit-loss',
          featureLinkLabel: 'Profit & Loss',
          subTasks: []
        },
        {
          title: 'Balance sales tax reporting to the books',
          description: 'Verify sales tax reports match your sales records.',
          featureLink: '/reports/profit-loss',
          featureLinkLabel: 'Profit & Loss',
          subTasks: []
        },
        {
          title: 'Review inventory',
          description: 'Count inventory and adjust records if needed.',
          featureLink: '/inventory',
          featureLinkLabel: 'Inventory',
          subTasks: []
        },
        {
          title: 'Review financials and send to investors',
          description: 'Prepare and distribute quarterly financial reports.',
          featureLink: '/reports/profit-loss',
          featureLinkLabel: 'Profit & Loss',
          subTasks: []
        },
        {
          title: 'Review prior quarter goals to actuals',
          description: 'Compare actual results to goals set last quarter.',
          featureLink: '/dashboard',
          featureLinkLabel: 'Dashboard',
          subTasks: []
        },
        {
          title: 'Set up next quarter goals',
          description: 'Define financial goals for the coming quarter.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Record your mileage',
          description: 'Log business mileage for tax deductions.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Pay estimated tax payments',
          description: 'Make quarterly estimated tax payments if required.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Verify all monthly tasks are caught up',
          description: 'Ensure all monthly tasks from this quarter are complete.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        }
      ]
    },

    // ═══════════════════════════════════════════════════════════════
    // ANNUAL - DECEMBER (YEAR-END CLOSE)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'Year-End Close (December)',
      description: 'Year-end closing tasks to complete in December',
      recurrenceType: 'annual',
      recurrenceConfig: { annualMonth: 12, annualDay: 15 }, // December 15
      tasks: [
        {
          title: 'Review financial reports for whole year',
          description: 'Analyze full-year Profit & Loss and Balance Sheet.',
          featureLink: '/reports/profit-loss',
          featureLinkLabel: 'Profit & Loss',
          subTasks: []
        },
        {
          title: 'Check for outstanding bills and invoices',
          description: 'Identify any unpaid bills or uncollected invoices.',
          featureLink: '/reports/ar-aging',
          featureLinkLabel: 'A/R Aging',
          subTasks: []
        },
        {
          title: 'Write off any bad debt',
          description: 'Write off uncollectible accounts receivable.',
          featureLink: '/transactions',
          featureLinkLabel: 'Transactions',
          subTasks: []
        },
        {
          title: 'Review each line of your Profit and Loss',
          description: 'Verify all income and expense categories are accurate.',
          featureLink: '/reports/profit-loss',
          featureLinkLabel: 'Profit & Loss',
          subTasks: []
        },
        {
          title: 'Review each line of your Balance Sheet',
          description: 'Verify all asset, liability, and equity accounts.',
          featureLink: '/reports/balance-sheet',
          featureLinkLabel: 'Balance Sheet',
          subTasks: []
        },
        {
          title: 'Reconcile all accounts',
          description: 'Ensure all accounts are reconciled through year-end.',
          featureLink: '/reconciliation',
          featureLinkLabel: 'Reconciliation',
          subTasks: []
        },
        {
          title: 'Prepare year-end bonuses and gifts',
          description: 'Calculate and prepare employee bonuses.',
          featureLink: '/payroll',
          featureLinkLabel: 'Payroll',
          subTasks: []
        },
        {
          title: 'Verify employee data',
          description: 'Confirm addresses and tax information for W-2s.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Verify contract labor data',
          description: 'Confirm information for 1099 recipients.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Take inventory and verify it matches the books',
          description: 'Physical inventory count and adjustment.',
          featureLink: '/inventory',
          featureLinkLabel: 'Inventory',
          subTasks: []
        },
        {
          title: 'Prepare budget for new year',
          description: 'Create financial budget for the coming year.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Reassess your salary, profit, tax savings, and expenses',
          description: 'Review compensation and tax planning strategies.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Make year-end purchases',
          description: 'Complete any planned capital purchases before year-end.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Contact CPA with any remaining issues or questions',
          description: 'Discuss year-end concerns with your accountant.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        }
      ]
    },

    // ═══════════════════════════════════════════════════════════════
    // ANNUAL - JANUARY (TAX PREP)
    // ═══════════════════════════════════════════════════════════════
    {
      name: 'Prior Year Tax Prep (January)',
      description: 'Tax preparation tasks to complete in January for the prior year',
      recurrenceType: 'annual',
      recurrenceConfig: { annualMonth: 1, annualDay: 15 }, // January 15
      tasks: [
        {
          title: 'Complete all W-2s and W-3',
          description: 'Prepare and distribute W-2s to employees.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: [
            { title: 'File federal W-2s/W-3', description: 'Submit to Social Security Administration.', featureLink: null, featureLinkLabel: null, subTasks: [] },
            { title: 'File state copies', description: 'Submit to state tax agency.', featureLink: null, featureLinkLabel: null, subTasks: [] },
            { title: 'Keep copies for your records', description: 'Save copies of all W-2s.', featureLink: null, featureLinkLabel: null, subTasks: [] }
          ]
        },
        {
          title: 'Complete all 1099s and 1098s',
          description: 'Prepare and distribute 1099s to contractors.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: [
            { title: 'File federal 1099s/1098s', description: 'Submit to IRS.', featureLink: null, featureLinkLabel: null, subTasks: [] },
            { title: 'File state copies', description: 'Submit to state if required.', featureLink: null, featureLinkLabel: null, subTasks: [] },
            { title: 'Keep copies for your records', description: 'Save copies of all forms.', featureLink: null, featureLinkLabel: null, subTasks: [] }
          ]
        },
        {
          title: 'Gather all relevant tax documents',
          description: 'Collect all documents needed for tax preparation.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Update changes in your unemployment insurance rate',
          description: 'Record new unemployment tax rates for the year.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Verify any tax documents received with your records',
          description: 'Match received 1099s and other forms to your records.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Contact CPA with completed books',
          description: 'Send finalized books to your accountant for tax preparation.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        },
        {
          title: 'Review and file taxes',
          description: 'Review tax returns prepared by CPA and file.',
          featureLink: null,
          featureLinkLabel: null,
          subTasks: []
        }
      ]
    }
  ]
};
```

---

## Testing Requirements

### Unit Tests

**Recurrence Calculation Tests:**
```
- Daily recurrence appears every day
- Weekly recurrence appears only on specified days
- Weekly with multiple days appears on each day
- Monthly specific date appears on that date
- Monthly last day appears on last day (28/29/30/31 depending on month)
- Monthly Nth weekday calculates correctly (first Monday, third Friday, etc.)
- Monthly "beginning of next month" calculates correctly
- Quarterly calculates correct month in quarter
- Annual appears on correct date each year
- One-time appears only on scheduled date
- Custom interval: every 14 days calculates correctly
- Custom interval: every 2 weeks lands on same day of week
- Custom interval: every 3 months handles varying month lengths
- Custom interval: respects start date (doesn't appear before)
- Handles leap year February 29 correctly
- Handles month overflow (Feb 30 → Feb 28/29)
- Recurrence change doesn't affect past completions
```

**Priority & Assignment Tests:**
```
- Task created with default priority 'none'
- Task priority can be set to high/medium/low
- Task can be assigned to user
- Assigned task appears in assignee's filtered view
- Priority sorting: high → medium → low → none
- Unassigning task (null assignee) works correctly
```

**View Mode Tests:**
```
- View mode 'all' shows complete and incomplete tasks
- View mode 'incomplete' hides completed tasks
- View mode persists across page reloads
- View mode applies to calendar and day detail panel
- Switching view mode updates display immediately
```

**Color Customization Tests:**
```
- Checklist created with default color
- Checklist color can be updated
- Color appears on task cards in calendar
- Custom hex colors supported
- Invalid color values rejected
- Priority colors use defaults (red/orange/purple) initially
- Priority colors can be customized per user
- Custom priority colors persist across sessions
- Custom priority colors apply to all views (calendar, panel, modal)
```

**Completion Tracking Tests:**
```
- Completion creates record with correct period value
- Day period value formats as YYYY-MM-DD
- Week period value formats as YYYY-Www
- Month period value formats as YYYY-MM
- Quarter period value formats as YYYY-Qq
- Year period value formats as YYYY
- Uncomplete removes completion record
- Cannot complete already-completed task (by another user)
- Completion history returns in descending order
```

**Sub-task Tests:**
```
- Create sub-task links to parent
- Get sub-tasks returns only direct children
- Delete parent with cascade deletes sub-tasks
- Delete parent with promote moves sub-tasks to root
- Reorder sub-tasks updates order correctly
- Sub-tasks inherit checklist from parent
```

**Comment Tests:**
```
- Create comment adds to task
- Edit comment updates content and sets isEdited
- Only author can edit their comment
- Only author can delete their comment
- Comments sorted by creation date ascending
```

### Integration Tests

```
- Full wizard flow creates all checklists and tasks
- Calendar query returns correct tasks for date range
- Completing all tasks for a period marks period complete
- Archiving checklist archives all tasks
- Template application with customizations works correctly
- Wizard progress saves and restores correctly
```

### E2E Tests

```
- User completes wizard and sees calendar with tasks
- User navigates calendar months
- User clicks day and sees day detail panel
- User completes task and sees completion indicator
- User opens task detail and edits SOP
- User adds comment to task
- User creates custom task
- User creates sub-task
- User uses feature link to navigate
- User archives a checklist
```

### Accessibility Tests

```
- Calendar navigable by keyboard (arrow keys, tab)
- Day cells have proper ARIA labels
- Task completion announces to screen reader
- Modal focus management correct
- Rich text editor accessible
- Color contrast meets WCAG AA
- Reduced motion preference respected
```

### Performance Tests

```
- Calendar month renders in < 200ms with 50 tasks/day
- Task completion responds in < 100ms
- Date range query for month completes in < 500ms
- Wizard step transition < 100ms
- Rich text editor loads in < 300ms
```

---

## Implementation Groups

### Group CK-A: Data Layer Foundation
**Prerequisites:** Dexie.js database, authentication

| Task | Description | Dependencies |
|------|-------------|--------------|
| CK-A1 | Create Checklist entity and Dexie schema (with custom interval fields) | Database setup |
| CK-A2 | Create Task entity and Dexie schema (with priority, assignee) | CK-A1 |
| CK-A3 | Create TaskCompletion entity and Dexie schema | CK-A1, CK-A2 |
| CK-A4 | Create TaskComment entity and Dexie schema | CK-A2 |
| CK-A5 | Create UserChecklistPreferences entity (view mode, etc.) | CK-A1 |
| CK-A6 | Implement standard recurrence calculation utilities | None |
| CK-A7 | Implement custom interval recurrence calculation (every N days/weeks/months) | CK-A6 |
| CK-A8 | Implement period value formatting utilities | None |
| CK-A9 | Write unit tests for all data utilities | CK-A6, CK-A7, CK-A8 |

### Group CK-B: Service Layer
**Prerequisites:** CK-A complete

| Task | Description | Dependencies |
|------|-------------|--------------|
| CK-B1 | Implement ChecklistService CRUD (including color, recurrence editing) | CK-A1 |
| CK-B2 | Implement TaskService CRUD (including priority, assignee) | CK-A2 |
| CK-B3 | Implement sub-task management | CK-B2 |
| CK-B4 | Implement calendar query methods (with view mode filtering) | CK-A6, CK-A7, CK-B1, CK-B2 |
| CK-B5 | Implement completion tracking | CK-A3 |
| CK-B6 | Implement comment management | CK-A4 |
| CK-B7 | Implement user preferences service (view mode persistence) | CK-A5 |
| CK-B8 | Implement task assignment and filtering by assignee | CK-B2 |
| CK-B9 | Implement priority-based sorting | CK-B2 |
| CK-B10 | Write integration tests for all services | CK-B1 through CK-B9 |

### Group CK-C: Core UI Components
**Prerequisites:** CK-B complete, design system components

| Task | Description | Dependencies |
|------|-------------|--------------|
| CK-C1 | Create CalendarMonth component | Design system |
| CK-C2 | Create CalendarDay component | CK-C1 |
| CK-C3 | Create TaskCard component (with priority indicator, assignee badge) | Design system |
| CK-C4 | Create DayDetailPanel component | CK-C2, CK-C3 |
| CK-C5 | Create RichTextEditor component | Design system |
| CK-C6 | Create FeatureLinkPicker component | Feature registry |
| CK-C7 | Create SubTaskList component | CK-C3 |
| CK-C8 | Create TaskComments component | CK-C5 |
| CK-C9 | Create PriorityPicker component (with customizable colors) | Design system |
| CK-C10 | Create AssigneePicker component | Design system, user list |
| CK-C11 | Create ViewModeToggle component (all/incomplete) | Design system |
| CK-C12 | Create ChecklistColorPicker component | Design system |
| CK-C13 | Create CustomIntervalPicker component (every N days/weeks/months) | Design system |
| CK-C14 | Write component tests | CK-C1 through CK-C13 |

### Group CK-D: Task Detail Modal
**Prerequisites:** CK-C complete

| Task | Description | Dependencies |
|------|-------------|--------------|
| CK-D1 | Create TaskDetailModal layout | CK-C components |
| CK-D2 | Integrate SOP editor (RichTextEditor) | CK-C5 |
| CK-D3 | Integrate sub-task management | CK-C7 |
| CK-D4 | Integrate comments | CK-C8 |
| CK-D5 | Integrate feature linking | CK-C6 |
| CK-D6 | Implement completion history display | CK-B5 |
| CK-D7 | Implement save/delete actions | CK-B2 |
| CK-D8 | Write modal integration tests | CK-D1 through CK-D7 |

### Group CK-E: Calendar Page
**Prerequisites:** CK-D complete

| Task | Description | Dependencies |
|------|-------------|--------------|
| CK-E1 | Create ChecklistCalendarPage layout | CK-C1, CK-C4 |
| CK-E2 | Implement month navigation | CK-E1 |
| CK-E3 | Integrate task data loading | CK-B4 |
| CK-E4 | Implement day selection and panel | CK-C4 |
| CK-E5 | Implement task completion from calendar | CK-B5 |
| CK-E6 | Integrate TaskDetailModal | CK-D1 |
| CK-E7 | Add "today" navigation and highlighting | CK-E1 |
| CK-E8 | Implement empty states | CK-E1 |
| CK-E9 | Write E2E tests for calendar | CK-E1 through CK-E8 |

### Group CK-F: Setup Wizard
**Prerequisites:** CK-E complete

| Task | Description | Dependencies |
|------|-------------|--------------|
| CK-F1 | Create default bookkeeping template | None |
| CK-F2 | Create WizardStep base component | Design system |
| CK-F3 | Create Welcome step ("Admin Calendar") | CK-F2 |
| CK-F4 | Create TaskSelectionStep (reusable for each category) | CK-F2 |
| CK-F5 | Create WeeklyDayPicker (user chooses their admin day) | CK-F4 |
| CK-F6 | Create MonthlyTimingPicker (1st, 15th, last day, beginning of next, etc.) | CK-F4 |
| CK-F7 | Create QuarterlyTimingPicker | CK-F4 |
| CK-F8 | Create AnnualDatePicker (for Dec/Jan tasks) | CK-F4 |
| CK-F9 | Create CustomIntervalStep (every N days/weeks/months) | CK-F2, CK-C13 |
| CK-F10 | Create Review step (summary of all timing choices) | CK-F2 |
| CK-F11 | Implement wizard state management | CK-F2 |
| CK-F12 | Implement wizard progress persistence | CK-F11 |
| CK-F13 | Implement template application on completion | CK-F1, CK-B1 |
| CK-F14 | Add celebration on wizard completion | CK-F13 |
| CK-F15 | Write wizard E2E tests | CK-F3 through CK-F14 |

### Group CK-G: Polish & Edge Cases
**Prerequisites:** CK-F complete

| Task | Description | Dependencies |
|------|-------------|--------------|
| CK-G1 | Implement keyboard navigation for calendar | CK-E1 |
| CK-G2 | Add screen reader announcements | CK-E1 |
| CK-G3 | Implement reduced motion support | All UI components |
| CK-G4 | Handle date edge cases (leap year, month overflow) | CK-A5 |
| CK-G5 | Handle concurrent completion conflicts | CK-B5 |
| CK-G6 | Implement mobile responsive design | CK-E1 |
| CK-G7 | Performance optimization for large task counts | CK-E3 |
| CK-G8 | Write accessibility tests | CK-G1, CK-G2 |
| CK-G9 | Write performance tests | CK-G7 |

### Group CK-H: Checklist Management
**Prerequisites:** CK-G complete

| Task | Description | Dependencies |
|------|-------------|--------------|
| CK-H1 | Create ChecklistManager page | CK-B1 |
| CK-H2 | Implement checklist CRUD UI | CK-H1 |
| CK-H3 | Implement task CRUD outside wizard | CK-H2 |
| CK-H4 | Implement checklist archiving | CK-H2 |
| CK-H5 | Implement "re-sync with template" option | CK-F1 |
| CK-H6 | Write management E2E tests | CK-H1 through CK-H5 |

---

## Migration Notes

### From Existing Checklist Implementation

The current implementation at `src/features/checklist/` and `src/components/checklist/` will be replaced. Migration steps:

1. **Preserve existing code** in `src/features/checklist-legacy/` during transition
2. **Create new implementation** in `src/features/checklist-calendar/`
3. **No data migration needed** - current implementation uses mock data
4. **Update routes** to point to new calendar page
5. **Remove legacy code** after new implementation is stable

### Assessment Integration (Future)

When accountant assessment flow is built:

1. Assessment results generate `TemplateCustomizations`
2. Call `checklistService.applyTemplate()` with customizations
3. Skip wizard if assessment provides complete configuration
4. Allow user to run wizard later to modify

---

## Appendix: Feature Link Registry

Complete list of linkable features for FeatureLinkPicker:

```typescript
const FEATURE_REGISTRY: FeatureOption[] = [
  // Dashboard
  { value: '/dashboard', label: 'Dashboard', category: 'Overview' },

  // Transactions
  { value: '/transactions', label: 'Transactions', category: 'Daily' },
  { value: '/transactions/import', label: 'Import Transactions', category: 'Daily' },

  // Banking
  { value: '/reconciliation', label: 'Bank Reconciliation', category: 'Banking' },
  { value: '/bank-accounts', label: 'Bank Accounts', category: 'Banking' },

  // Invoicing
  { value: '/invoices', label: 'Invoices', category: 'Sales' },
  { value: '/invoices/create', label: 'Create Invoice', category: 'Sales' },
  { value: '/clients', label: 'Clients', category: 'Sales' },

  // Bills
  { value: '/bills', label: 'Bills', category: 'Expenses' },
  { value: '/bills/create', label: 'Create Bill', category: 'Expenses' },
  { value: '/vendors', label: 'Vendors', category: 'Expenses' },

  // Reports
  { value: '/reports/profit-loss', label: 'Profit & Loss', category: 'Reports' },
  { value: '/reports/balance-sheet', label: 'Balance Sheet', category: 'Reports' },
  { value: '/reports/cash-flow', label: 'Cash Flow Statement', category: 'Reports' },
  { value: '/reports/ar-aging', label: 'A/R Aging Report', category: 'Reports' },
  { value: '/reports/ap-aging', label: 'A/P Aging Report', category: 'Reports' },
  { value: '/reports/trial-balance', label: 'Trial Balance', category: 'Reports' },

  // Accounting
  { value: '/chart-of-accounts', label: 'Chart of Accounts', category: 'Accounting' },
  { value: '/journal-entries', label: 'Journal Entries', category: 'Accounting' },

  // Payroll
  { value: '/payroll', label: 'Payroll', category: 'Payroll' },
  { value: '/payroll/run', label: 'Run Payroll', category: 'Payroll' },
  { value: '/employees', label: 'Employees', category: 'Payroll' },

  // Inventory
  { value: '/inventory', label: 'Inventory', category: 'Inventory' },
  { value: '/products', label: 'Products & Services', category: 'Inventory' },

  // Tax
  { value: '/sales-tax', label: 'Sales Tax', category: 'Tax' },

  // Settings
  { value: '/settings', label: 'Settings', category: 'Settings' },
  { value: '/settings/company', label: 'Company Settings', category: 'Settings' },
];
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024 | Initial specification |
| 1.1.0 | 2024 | Added: Priority levels, task assignment, view mode toggle (all/incomplete), custom recurrence intervals (every N days/weeks/months), user-editable checklist colors, flexible timing throughout wizard, emphasized user sovereignty |

---

*This specification replaces the previous checklist spec at `openspec/changes/onboarding-and-setup/specs/checklist/spec.md`*
