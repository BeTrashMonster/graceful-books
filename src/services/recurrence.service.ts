/**
 * Recurrence Rule Service
 *
 * Service for generating recurrence schedules using the rrule library.
 * Handles date calculations for recurring transactions.
 *
 * Requirements:
 * - E2: Recurring Transactions [MVP]
 * - Support weekly, bi-weekly, monthly, quarterly, and annually frequencies
 * - Handle edge cases (leap years, month-end dates, etc.)
 */

import { RRule, Frequency } from 'rrule';
import { addDays, startOfDay, endOfDay } from 'date-fns';
import type {
  RecurrenceRule,
  RecurrenceFrequency,
  RecurrencePreview,
} from '../types/recurring.types';

/**
 * Convert our RecurrenceFrequency to rrule Frequency
 */
function toRRuleFrequency(frequency: RecurrenceFrequency): Frequency {
  switch (frequency) {
    case 'WEEKLY':
    case 'BI_WEEKLY':
      return RRule.WEEKLY;
    case 'MONTHLY':
      return RRule.MONTHLY;
    case 'QUARTERLY':
      // Quarterly is every 3 months
      return RRule.MONTHLY;
    case 'ANNUALLY':
      return RRule.YEARLY;
    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}

/**
 * Get interval for rrule based on our frequency
 */
function getInterval(frequency: RecurrenceFrequency, interval: number): number {
  switch (frequency) {
    case 'WEEKLY':
      return interval;
    case 'BI_WEEKLY':
      return interval * 2;
    case 'MONTHLY':
      return interval;
    case 'QUARTERLY':
      return interval * 3;
    case 'ANNUALLY':
      return interval;
    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}

/**
 * Create an RRule object from our RecurrenceRule
 */
export function createRRule(rule: RecurrenceRule): RRule {
  const frequency = toRRuleFrequency(rule.frequency);
  const interval = getInterval(rule.frequency, rule.interval);
  const dtstart = new Date(rule.startDate);

  const rruleOptions: any = {
    freq: frequency,
    interval,
    dtstart,
  };

  // Handle end conditions
  if (rule.endType === 'ON_DATE' && rule.endDate) {
    rruleOptions.until = new Date(rule.endDate);
  } else if (rule.endType === 'AFTER_COUNT' && rule.occurrenceCount) {
    rruleOptions.count = rule.occurrenceCount;
  }
  // If NEVER, don't set until or count

  // Handle day of week for weekly/bi-weekly
  if (
    (rule.frequency === 'WEEKLY' || rule.frequency === 'BI_WEEKLY') &&
    rule.dayOfWeek !== undefined
  ) {
    rruleOptions.byweekday = [rule.dayOfWeek];
  }

  // Handle day of month for monthly/quarterly/annually
  if (
    (rule.frequency === 'MONTHLY' ||
      rule.frequency === 'QUARTERLY' ||
      rule.frequency === 'ANNUALLY') &&
    rule.dayOfMonth !== undefined
  ) {
    rruleOptions.bymonthday = rule.dayOfMonth;
  }

  // Handle month for annually
  if (rule.frequency === 'ANNUALLY' && rule.monthOfYear !== undefined) {
    rruleOptions.bymonth = rule.monthOfYear;
  }

  return new RRule(rruleOptions);
}

/**
 * Calculate the next occurrence after a given date
 */
export function getNextOccurrence(rule: RecurrenceRule, after: Date = new Date()): Date | null {
  try {
    const rrule = createRRule(rule);
    const next = rrule.after(after, false); // false = exclusive (don't include 'after' date)

    if (!next) {
      return null;
    }

    // Check if we've exceeded the end date
    if (rule.endType === 'ON_DATE' && rule.endDate && next.getTime() > rule.endDate) {
      return null;
    }

    return next;
  } catch (error) {
    console.error('Error calculating next occurrence:', error);
    return null;
  }
}

/**
 * Calculate all occurrences between two dates
 */
export function getOccurrencesBetween(
  rule: RecurrenceRule,
  startDate: Date,
  endDate: Date
): Date[] {
  try {
    const rrule = createRRule(rule);
    const occurrences = rrule.between(startDate, endDate, true); // true = inclusive
    return occurrences;
  } catch (error) {
    console.error('Error calculating occurrences:', error);
    return [];
  }
}

/**
 * Get a preview of upcoming occurrences
 */
export function getRecurrencePreview(
  rule: RecurrenceRule,
  count: number = 10,
  fromDate?: Date
): RecurrencePreview {
  try {
    const rrule = createRRule(rule);
    const start = fromDate || new Date(rule.startDate);

    // Get occurrences after the start date
    const occurrences = rrule.after(start, true) ? rrule.all() : [];

    // Filter to only those after fromDate (or startDate)
    const filtered = occurrences.filter((d) => d.getTime() >= start.getTime());

    // Take only the requested count
    const preview = filtered.slice(0, count);
    const hasMore = filtered.length > count;

    return {
      dates: preview.map((d) => d.getTime()),
      count: preview.length,
      hasMore,
    };
  } catch (error) {
    console.error('Error generating recurrence preview:', error);
    return {
      dates: [],
      count: 0,
      hasMore: false,
    };
  }
}

/**
 * Get all occurrences up to a maximum count
 */
export function getAllOccurrences(rule: RecurrenceRule, maxCount: number = 1000): Date[] {
  try {
    const rrule = createRRule(rule);

    // For NEVER ending rules, limit the count
    if (rule.endType === 'NEVER') {
      const limitedRule = new RRule({
        ...rrule.origOptions,
        count: maxCount,
      });
      return limitedRule.all();
    }

    return rrule.all();
  } catch (error) {
    console.error('Error getting all occurrences:', error);
    return [];
  }
}

/**
 * Get the total number of occurrences (if finite)
 */
export function getTotalOccurrenceCount(rule: RecurrenceRule): number | null {
  try {
    // If explicitly set to a count, return it
    if (rule.endType === 'AFTER_COUNT' && rule.occurrenceCount) {
      return rule.occurrenceCount;
    }

    // If NEVER, return null (infinite)
    if (rule.endType === 'NEVER') {
      return null;
    }

    // If ON_DATE, calculate all occurrences
    if (rule.endType === 'ON_DATE' && rule.endDate) {
      const rrule = createRRule(rule);
      const all = rrule.all();
      return all.length;
    }

    return null;
  } catch (error) {
    console.error('Error calculating total occurrence count:', error);
    return null;
  }
}

/**
 * Check if a recurrence has ended
 */
export function hasRecurrenceEnded(rule: RecurrenceRule, currentDate: Date = new Date()): boolean {
  if (rule.endType === 'NEVER') {
    return false;
  }

  if (rule.endType === 'ON_DATE' && rule.endDate) {
    return currentDate.getTime() > rule.endDate;
  }

  // For AFTER_COUNT, we need to check if we've generated all occurrences
  // This should be tracked separately in the recurring transaction record
  return false;
}

/**
 * Get a human-readable description of the recurrence rule
 */
export function getRecurrenceDescription(rule: RecurrenceRule): string {
  const rrule = createRRule(rule);
  return rrule.toText();
}

/**
 * Validate that a recurrence rule will generate valid dates
 */
export function validateRecurrenceRule(rule: RecurrenceRule): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    // Try to create the rrule
    const rrule = createRRule(rule);

    // Try to get the first occurrence
    const first = rrule.all()?.[0];
    if (!first) {
      errors.push('Recurrence rule generates no occurrences');
    }

    // Check for valid start date
    if (rule.startDate < 0) {
      errors.push('Start date must be valid');
    }

    // Validate end date if ON_DATE
    if (rule.endType === 'ON_DATE') {
      if (!rule.endDate) {
        errors.push('End date is required when end type is ON_DATE');
      } else if (rule.endDate <= rule.startDate) {
        errors.push('End date must be after start date');
      }
    }

    // Validate occurrence count if AFTER_COUNT
    if (rule.endType === 'AFTER_COUNT') {
      if (!rule.occurrenceCount || rule.occurrenceCount < 1) {
        errors.push('Occurrence count must be at least 1');
      }
    }
  } catch (error) {
    errors.push(`Invalid recurrence rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get occurrences that should be created (between last created and now)
 */
export function getDueOccurrences(
  rule: RecurrenceRule,
  lastCreated: number | null,
  currentTime: number = Date.now()
): Date[] {
  const startDate = lastCreated ? new Date(lastCreated + 1) : new Date(rule.startDate);
  const endDate = new Date(currentTime);

  return getOccurrencesBetween(rule, startDate, endDate);
}

/**
 * Calculate the next occurrence time in milliseconds
 */
export function calculateNextOccurrence(
  rule: RecurrenceRule,
  lastCreated: number | null
): number | null {
  const after = lastCreated ? new Date(lastCreated) : new Date(rule.startDate - 1);
  const next = getNextOccurrence(rule, after);
  return next ? next.getTime() : null;
}
