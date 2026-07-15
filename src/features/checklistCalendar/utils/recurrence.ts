/**
 * Recurrence Calculation Utilities
 *
 * Functions to determine which tasks appear on which dates based on
 * checklist recurrence patterns. Supports daily, weekly, monthly,
 * quarterly, annual, and custom interval recurrence.
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md for full specification
 */

import type {
  AdminChecklist,
  ChecklistRecurrenceType,
  PeriodType,
} from '../../../db/schema/checklistCalendar.schema';

// =============================================================================
// DATE HELPERS
// =============================================================================

/**
 * Get start of day (midnight) for a date
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the last day of the month for a given date
 */
export function getLastDayOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Check if a year is a leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Get the ISO week number for a date
 * Returns format: "YYYY-Www" (e.g., "2024-W02")
 */
export function getISOWeek(date: Date): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Get the quarter for a date (1-4)
 */
export function getQuarter(date: Date): number {
  return Math.ceil((date.getMonth() + 1) / 3);
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// =============================================================================
// PERIOD VALUE FORMATTING
// =============================================================================

/**
 * Get the period value for a date based on period type
 * Used for completion tracking
 */
export function getPeriodValue(date: Date, periodType: PeriodType): string {
  switch (periodType) {
    case 'day':
      return formatDateISO(date);

    case 'week':
      return getISOWeek(date);

    case 'month':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    case 'quarter':
      return `${date.getFullYear()}-Q${getQuarter(date)}`;

    case 'year':
      return String(date.getFullYear());
  }
}

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the period type for a checklist recurrence type
 */
export function getPeriodTypeForRecurrence(
  recurrenceType: ChecklistRecurrenceType
): PeriodType {
  switch (recurrenceType) {
    case 'daily':
      return 'day';
    case 'weekly':
      return 'week';
    case 'monthly':
      return 'month';
    case 'quarterly':
      return 'quarter';
    case 'annual':
      return 'year';
    case 'custom':
      return 'day'; // Custom intervals track by day
    case 'one-time':
      return 'day';
  }
}

// =============================================================================
// RECURRENCE CHECKING
// =============================================================================

/**
 * Check if a checklist is due on a specific date
 */
export function isChecklistDueOnDate(
  checklist: AdminChecklist,
  date: Date
): boolean {
  if (checklist.is_archived) {
    return false;
  }

  // Check effective_from - only show from this date forward
  if (checklist.effective_from) {
    const effectiveDate = startOfDay(new Date(checklist.effective_from));
    const targetDate = startOfDay(date);
    if (targetDate < effectiveDate) {
      return false;
    }
  }

  // Check exclude_weekends - don't show on Saturday (6) or Sunday (0)
  if (checklist.exclude_weekends) {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
  }

  switch (checklist.recurrence_type) {
    case 'daily':
      return true;

    case 'weekly':
      return isWeeklyDue(checklist, date);

    case 'monthly':
      return isMonthlyDue(checklist, date);

    case 'quarterly':
      return isQuarterlyDue(checklist, date);

    case 'annual':
      return isAnnualDue(checklist, date);

    case 'custom':
      return isCustomIntervalDue(checklist, date);

    case 'one-time':
      // One-time tasks are handled at the task level, not checklist level
      return false;

    default:
      return false;
  }
}

/**
 * Check if a weekly checklist is due on a date
 */
export function isWeeklyDue(checklist: AdminChecklist, date: Date): boolean {
  if (!checklist.weekly_days || checklist.weekly_days.length === 0) {
    return false;
  }
  return checklist.weekly_days.includes(date.getDay());
}

/**
 * Check if a monthly checklist is due on a date
 */
export function isMonthlyDue(checklist: AdminChecklist, date: Date): boolean {
  const { monthly_day, monthly_week, monthly_day_of_week } = checklist;

  // Option 1: Specific day of month (1-31)
  if (monthly_day !== null && monthly_day > 0) {
    // Handle case where specified day exceeds month length
    // (e.g., Feb 30 -> use last day of Feb)
    const lastDay = getLastDayOfMonth(date);
    const targetDay = Math.min(monthly_day, lastDay);
    return date.getDate() === targetDay;
  }

  // Option 2: Last day of month (-1)
  if (monthly_day === -1) {
    const lastDay = getLastDayOfMonth(date);
    return date.getDate() === lastDay;
  }

  // Option 3: Nth weekday (e.g., "first Monday", "third Friday")
  if (monthly_week !== null && monthly_day_of_week !== null) {
    return isNthWeekdayOfMonth(date, monthly_week, monthly_day_of_week);
  }

  return false;
}

/**
 * Check if a date is the Nth weekday of the month
 * @param n - 1-4 for first through fourth, -1 for last
 * @param dayOfWeek - 0-6 (0=Sunday)
 */
export function isNthWeekdayOfMonth(
  date: Date,
  n: number,
  dayOfWeek: number
): boolean {
  // First check if it's the right day of week
  if (date.getDay() !== dayOfWeek) {
    return false;
  }

  const dayOfMonth = date.getDate();

  // Last occurrence of this weekday
  if (n === -1) {
    const lastDay = getLastDayOfMonth(date);
    const daysUntilEnd = lastDay - dayOfMonth;
    return daysUntilEnd < 7;
  }

  // Nth occurrence (1-4)
  const weekOfMonth = Math.ceil(dayOfMonth / 7);
  return weekOfMonth === n;
}

/**
 * Check if a quarterly checklist is due on a date
 */
export function isQuarterlyDue(checklist: AdminChecklist, date: Date): boolean {
  const { quarterly_month, quarterly_day } = checklist;

  if (quarterly_month === null || quarterly_day === null) {
    return false;
  }

  const month = date.getMonth() + 1; // 1-12
  const monthInQuarter = ((month - 1) % 3) + 1; // 1, 2, or 3

  // Check if this is the right month in the quarter
  if (monthInQuarter !== quarterly_month) {
    return false;
  }

  // Handle last day (-1)
  if (quarterly_day === -1) {
    return date.getDate() === getLastDayOfMonth(date);
  }

  // Handle specific day (with overflow protection)
  const lastDay = getLastDayOfMonth(date);
  const targetDay = Math.min(quarterly_day, lastDay);
  return date.getDate() === targetDay;
}

/**
 * Check if an annual checklist is due on a date
 */
export function isAnnualDue(checklist: AdminChecklist, date: Date): boolean {
  const { annual_month, annual_day } = checklist;

  if (annual_month === null || annual_day === null) {
    return false;
  }

  const month = date.getMonth() + 1; // 1-12
  if (month !== annual_month) {
    return false;
  }

  // Handle last day (-1)
  if (annual_day === -1) {
    return date.getDate() === getLastDayOfMonth(date);
  }

  // Handle Feb 29 for non-leap years
  if (annual_month === 2 && annual_day === 29 && !isLeapYear(date.getFullYear())) {
    // Feb 29 in non-leap year: use Feb 28
    return date.getDate() === 28;
  }

  // Handle specific day (with overflow protection)
  const lastDay = getLastDayOfMonth(date);
  const targetDay = Math.min(annual_day, lastDay);
  return date.getDate() === targetDay;
}

/**
 * Check if a custom interval checklist is due on a date
 * Supports: every N days, every N weeks, every N months
 */
export function isCustomIntervalDue(
  checklist: AdminChecklist,
  date: Date
): boolean {
  const {
    custom_interval_value,
    custom_interval_unit,
    custom_start_date,
  } = checklist;

  if (
    !custom_interval_value ||
    !custom_interval_unit ||
    !custom_start_date
  ) {
    return false;
  }

  const start = startOfDay(new Date(custom_start_date));
  const target = startOfDay(date);

  // Don't show before start date
  if (target < start) {
    return false;
  }

  switch (custom_interval_unit) {
    case 'days': {
      const daysDiff = Math.floor(
        (target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysDiff % custom_interval_value === 0;
    }

    case 'weeks': {
      const daysDiff = Math.floor(
        (target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      const weeksDiff = Math.floor(daysDiff / 7);
      // Check if this is the same day of week as start AND correct week interval
      const sameDayOfWeek = target.getDay() === start.getDay();
      return sameDayOfWeek && weeksDiff % custom_interval_value === 0;
    }

    case 'months': {
      // Check if same day of month (or last day if original was last day)
      const startDay = start.getDate();
      const targetDay = target.getDate();
      const isLastDayStart = startDay === getLastDayOfMonth(start);
      const isLastDayTarget = targetDay === getLastDayOfMonth(target);

      const sameDayOfMonth = isLastDayStart
        ? isLastDayTarget
        : startDay === targetDay ||
          // Handle case where target month has fewer days
          (startDay > targetDay && targetDay === getLastDayOfMonth(target));

      if (!sameDayOfMonth) {
        return false;
      }

      // Calculate months difference
      const monthsDiff =
        (target.getFullYear() - start.getFullYear()) * 12 +
        (target.getMonth() - start.getMonth());

      return monthsDiff >= 0 && monthsDiff % custom_interval_value === 0;
    }

    default:
      return false;
  }
}

// =============================================================================
// DATE RANGE QUERIES
// =============================================================================

/**
 * Get all dates in a month
 */
export function getDatesInMonth(year: number, month: number): Date[] {
  const dates: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  for (let day = 1; day <= lastDay.getDate(); day++) {
    dates.push(new Date(year, month, day));
  }

  return dates;
}

/**
 * Get all dates in a range (inclusive)
 */
export function getDatesInRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = startOfDay(new Date(startDate));
  const end = startOfDay(new Date(endDate));

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Get the dates a checklist is due within a date range
 */
export function getChecklistDueDates(
  checklist: AdminChecklist,
  startDate: Date,
  endDate: Date
): Date[] {
  const allDates = getDatesInRange(startDate, endDate);
  return allDates.filter((date) => isChecklistDueOnDate(checklist, date));
}

// =============================================================================
// HUMAN-READABLE DESCRIPTIONS
// =============================================================================

/**
 * Get a human-readable description of a checklist's recurrence
 */
export function getRecurrenceDescription(checklist: AdminChecklist): string {
  switch (checklist.recurrence_type) {
    case 'daily':
      return 'Every day';

    case 'weekly':
      if (!checklist.weekly_days || checklist.weekly_days.length === 0) {
        return 'Weekly';
      }
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const days = checklist.weekly_days
        .sort((a, b) => a - b)
        .map((d) => dayNames[d]);
      if (days.length === 1) {
        return `Every ${dayNames[checklist.weekly_days[0]]}`;
      }
      return `Every ${days.join(', ')}`;

    case 'monthly':
      if (checklist.monthly_day === -1) {
        return 'Last day of each month';
      }
      if (checklist.monthly_day) {
        return `${getOrdinal(checklist.monthly_day)} of each month`;
      }
      if (
        checklist.monthly_week !== null &&
        checklist.monthly_day_of_week !== null
      ) {
        const weekNames = ['first', 'second', 'third', 'fourth', 'last'];
        const dayNames = [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ];
        const weekName =
          checklist.monthly_week === -1
            ? 'last'
            : weekNames[checklist.monthly_week - 1];
        return `${weekName.charAt(0).toUpperCase() + weekName.slice(1)} ${dayNames[checklist.monthly_day_of_week]} of each month`;
      }
      return 'Monthly';

    case 'quarterly':
      if (checklist.quarterly_month && checklist.quarterly_day) {
        const monthNames = ['first', 'second', 'third'];
        const monthName = monthNames[checklist.quarterly_month - 1];
        const day =
          checklist.quarterly_day === -1
            ? 'last day'
            : getOrdinal(checklist.quarterly_day);
        return `${day} of ${monthName} month each quarter`;
      }
      return 'Quarterly';

    case 'annual':
      if (checklist.annual_month && checklist.annual_day) {
        const monthNames = [
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
        const day =
          checklist.annual_day === -1
            ? 'Last day'
            : getOrdinal(checklist.annual_day);
        return `${day} of ${monthNames[checklist.annual_month - 1]}`;
      }
      return 'Annually';

    case 'custom':
      if (checklist.custom_interval_value && checklist.custom_interval_unit) {
        const unit =
          checklist.custom_interval_value === 1
            ? checklist.custom_interval_unit.slice(0, -1) // Remove 's' for singular
            : checklist.custom_interval_unit;
        return `Every ${checklist.custom_interval_value} ${unit}`;
      }
      return 'Custom interval';

    case 'one-time':
      return 'One-time';

    default:
      return 'Unknown';
  }
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
