/**
 * Unit Tests for Recurrence Calculation Utilities
 *
 * Tests all recurrence patterns:
 * - Daily (every day)
 * - Weekly (specific days of week)
 * - Monthly (specific day or Nth weekday)
 * - Quarterly (specific point in quarter)
 * - Annual (specific date each year)
 * - Custom intervals (every N days/weeks/months)
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { describe, it, expect } from 'vitest';
import type { AdminChecklist } from '../../../db/schema/checklistCalendar.schema';
import {
  startOfDay,
  getLastDayOfMonth,
  isLeapYear,
  getISOWeek,
  getQuarter,
  isSameDay,
  getPeriodValue,
  formatDateISO,
  getPeriodTypeForRecurrence,
  isChecklistDueOnDate,
  isWeeklyDue,
  isMonthlyDue,
  isNthWeekdayOfMonth,
  isQuarterlyDue,
  isAnnualDue,
  isCustomIntervalDue,
  getDatesInMonth,
  getDatesInRange,
  getChecklistDueDates,
  getRecurrenceDescription,
} from './recurrence';

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Create a minimal checklist for testing
 */
function createTestChecklist(
  overrides: Partial<AdminChecklist> = {}
): AdminChecklist {
  return {
    id: 'test-checklist-1',
    company_id: 'test-company-1',
    name: 'Test Checklist',
    description: null,
    color: '#3B82F6',
    icon: null,
    recurrence_type: 'daily',
    weekly_days: null,
    monthly_day: null,
    monthly_week: null,
    monthly_day_of_week: null,
    quarterly_month: null,
    quarterly_day: null,
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
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    version_vector: { device1: 1 },
    ...overrides,
  };
}

// =============================================================================
// DATE HELPERS TESTS
// =============================================================================

describe('Date Helpers', () => {
  describe('startOfDay', () => {
    it('should set time to midnight', () => {
      const date = new Date(2024, 5, 15, 14, 30, 45, 123);
      const result = startOfDay(date);

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should preserve the date', () => {
      const date = new Date(2024, 5, 15, 14, 30, 45);
      const result = startOfDay(date);

      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(15);
    });

    it('should not mutate original date', () => {
      const date = new Date(2024, 5, 15, 14, 30, 45);
      startOfDay(date);

      expect(date.getHours()).toBe(14);
    });
  });

  describe('getLastDayOfMonth', () => {
    it('should return 31 for January', () => {
      expect(getLastDayOfMonth(new Date(2024, 0, 15))).toBe(31);
    });

    it('should return 28 for February in non-leap year', () => {
      expect(getLastDayOfMonth(new Date(2023, 1, 15))).toBe(28);
    });

    it('should return 29 for February in leap year', () => {
      expect(getLastDayOfMonth(new Date(2024, 1, 15))).toBe(29);
    });

    it('should return 30 for April', () => {
      expect(getLastDayOfMonth(new Date(2024, 3, 15))).toBe(30);
    });

    it('should return 31 for December', () => {
      expect(getLastDayOfMonth(new Date(2024, 11, 15))).toBe(31);
    });
  });

  describe('isLeapYear', () => {
    it('should return true for years divisible by 4', () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2020)).toBe(true);
    });

    it('should return false for years divisible by 100 but not 400', () => {
      expect(isLeapYear(1900)).toBe(false);
      expect(isLeapYear(2100)).toBe(false);
    });

    it('should return true for years divisible by 400', () => {
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(1600)).toBe(true);
    });

    it('should return false for normal non-leap years', () => {
      expect(isLeapYear(2023)).toBe(false);
      expect(isLeapYear(2025)).toBe(false);
    });
  });

  describe('getISOWeek', () => {
    it('should return correct ISO week format', () => {
      // January 1, 2024 is in week 1
      expect(getISOWeek(new Date(2024, 0, 1))).toBe('2024-W01');
    });

    it('should handle week 52/53 correctly', () => {
      // December 31, 2024 is in week 1 of 2025
      const result = getISOWeek(new Date(2024, 11, 31));
      expect(result).toBe('2025-W01');
    });

    it('should pad week numbers', () => {
      expect(getISOWeek(new Date(2024, 0, 8))).toBe('2024-W02');
    });
  });

  describe('getQuarter', () => {
    it('should return 1 for Jan-Mar', () => {
      expect(getQuarter(new Date(2024, 0, 15))).toBe(1);
      expect(getQuarter(new Date(2024, 1, 15))).toBe(1);
      expect(getQuarter(new Date(2024, 2, 15))).toBe(1);
    });

    it('should return 2 for Apr-Jun', () => {
      expect(getQuarter(new Date(2024, 3, 15))).toBe(2);
      expect(getQuarter(new Date(2024, 4, 15))).toBe(2);
      expect(getQuarter(new Date(2024, 5, 15))).toBe(2);
    });

    it('should return 3 for Jul-Sep', () => {
      expect(getQuarter(new Date(2024, 6, 15))).toBe(3);
      expect(getQuarter(new Date(2024, 7, 15))).toBe(3);
      expect(getQuarter(new Date(2024, 8, 15))).toBe(3);
    });

    it('should return 4 for Oct-Dec', () => {
      expect(getQuarter(new Date(2024, 9, 15))).toBe(4);
      expect(getQuarter(new Date(2024, 10, 15))).toBe(4);
      expect(getQuarter(new Date(2024, 11, 15))).toBe(4);
    });
  });

  describe('isSameDay', () => {
    it('should return true for same day', () => {
      const date1 = new Date(2024, 5, 15, 10, 30);
      const date2 = new Date(2024, 5, 15, 18, 45);
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('should return false for different days', () => {
      const date1 = new Date(2024, 5, 15);
      const date2 = new Date(2024, 5, 16);
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('should return false for different months', () => {
      const date1 = new Date(2024, 5, 15);
      const date2 = new Date(2024, 6, 15);
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('should return false for different years', () => {
      const date1 = new Date(2024, 5, 15);
      const date2 = new Date(2025, 5, 15);
      expect(isSameDay(date1, date2)).toBe(false);
    });
  });
});

// =============================================================================
// PERIOD VALUE FORMATTING TESTS
// =============================================================================

describe('Period Value Formatting', () => {
  describe('formatDateISO', () => {
    it('should format date as YYYY-MM-DD', () => {
      expect(formatDateISO(new Date(2024, 5, 15))).toBe('2024-06-15');
    });

    it('should pad single digit months and days', () => {
      expect(formatDateISO(new Date(2024, 0, 5))).toBe('2024-01-05');
    });
  });

  describe('getPeriodValue', () => {
    const testDate = new Date(2024, 5, 15); // June 15, 2024

    it('should return ISO date for day period', () => {
      expect(getPeriodValue(testDate, 'day')).toBe('2024-06-15');
    });

    it('should return ISO week for week period', () => {
      const result = getPeriodValue(testDate, 'week');
      expect(result).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('should return YYYY-MM for month period', () => {
      expect(getPeriodValue(testDate, 'month')).toBe('2024-06');
    });

    it('should return YYYY-QN for quarter period', () => {
      expect(getPeriodValue(testDate, 'quarter')).toBe('2024-Q2');
    });

    it('should return YYYY for year period', () => {
      expect(getPeriodValue(testDate, 'year')).toBe('2024');
    });
  });

  describe('getPeriodTypeForRecurrence', () => {
    it('should return day for daily', () => {
      expect(getPeriodTypeForRecurrence('daily')).toBe('day');
    });

    it('should return week for weekly', () => {
      expect(getPeriodTypeForRecurrence('weekly')).toBe('week');
    });

    it('should return month for monthly', () => {
      expect(getPeriodTypeForRecurrence('monthly')).toBe('month');
    });

    it('should return quarter for quarterly', () => {
      expect(getPeriodTypeForRecurrence('quarterly')).toBe('quarter');
    });

    it('should return year for annual', () => {
      expect(getPeriodTypeForRecurrence('annual')).toBe('year');
    });

    it('should return day for custom', () => {
      expect(getPeriodTypeForRecurrence('custom')).toBe('day');
    });

    it('should return day for one-time', () => {
      expect(getPeriodTypeForRecurrence('one-time')).toBe('day');
    });
  });
});

// =============================================================================
// RECURRENCE CHECKING TESTS
// =============================================================================

describe('Recurrence Checking', () => {
  describe('isChecklistDueOnDate - Daily', () => {
    it('should return true for any date with daily recurrence', () => {
      const checklist = createTestChecklist({ recurrence_type: 'daily' });

      expect(isChecklistDueOnDate(checklist, new Date(2024, 5, 15))).toBe(true);
      expect(isChecklistDueOnDate(checklist, new Date(2024, 11, 25))).toBe(true);
      expect(isChecklistDueOnDate(checklist, new Date(2025, 0, 1))).toBe(true);
    });

    it('should return false for archived checklists', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'daily',
        is_archived: true,
      });

      expect(isChecklistDueOnDate(checklist, new Date(2024, 5, 15))).toBe(false);
    });
  });

  describe('isWeeklyDue', () => {
    it('should return true when day matches weekly_days', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'weekly',
        weekly_days: [1, 3, 5], // Monday, Wednesday, Friday
      });

      // Monday
      expect(isWeeklyDue(checklist, new Date(2024, 5, 17))).toBe(true);
      // Wednesday
      expect(isWeeklyDue(checklist, new Date(2024, 5, 19))).toBe(true);
      // Friday
      expect(isWeeklyDue(checklist, new Date(2024, 5, 21))).toBe(true);
    });

    it('should return false when day does not match', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'weekly',
        weekly_days: [1, 3, 5], // Monday, Wednesday, Friday
      });

      // Tuesday
      expect(isWeeklyDue(checklist, new Date(2024, 5, 18))).toBe(false);
      // Saturday
      expect(isWeeklyDue(checklist, new Date(2024, 5, 22))).toBe(false);
    });

    it('should return false when weekly_days is empty', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'weekly',
        weekly_days: [],
      });

      expect(isWeeklyDue(checklist, new Date(2024, 5, 17))).toBe(false);
    });

    it('should return false when weekly_days is null', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'weekly',
        weekly_days: null,
      });

      expect(isWeeklyDue(checklist, new Date(2024, 5, 17))).toBe(false);
    });
  });

  describe('isMonthlyDue', () => {
    it('should return true for specific day of month', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'monthly',
        monthly_day: 15,
      });

      expect(isMonthlyDue(checklist, new Date(2024, 5, 15))).toBe(true);
      expect(isMonthlyDue(checklist, new Date(2024, 6, 15))).toBe(true);
    });

    it('should return false for other days', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'monthly',
        monthly_day: 15,
      });

      expect(isMonthlyDue(checklist, new Date(2024, 5, 14))).toBe(false);
      expect(isMonthlyDue(checklist, new Date(2024, 5, 16))).toBe(false);
    });

    it('should handle last day of month (-1)', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'monthly',
        monthly_day: -1,
      });

      // Last day of June (30 days)
      expect(isMonthlyDue(checklist, new Date(2024, 5, 30))).toBe(true);
      expect(isMonthlyDue(checklist, new Date(2024, 5, 29))).toBe(false);

      // Last day of July (31 days)
      expect(isMonthlyDue(checklist, new Date(2024, 6, 31))).toBe(true);
    });

    it('should handle day overflow (e.g., Feb 30)', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'monthly',
        monthly_day: 30,
      });

      // February 2024 has 29 days (leap year)
      expect(isMonthlyDue(checklist, new Date(2024, 1, 29))).toBe(true);

      // February 2023 has 28 days
      expect(isMonthlyDue(checklist, new Date(2023, 1, 28))).toBe(true);
    });
  });

  describe('isNthWeekdayOfMonth', () => {
    it('should identify first Monday of month', () => {
      // June 2024: First Monday is June 3
      expect(isNthWeekdayOfMonth(new Date(2024, 5, 3), 1, 1)).toBe(true);
      expect(isNthWeekdayOfMonth(new Date(2024, 5, 10), 1, 1)).toBe(false);
    });

    it('should identify second Wednesday of month', () => {
      // June 2024: Second Wednesday is June 12
      expect(isNthWeekdayOfMonth(new Date(2024, 5, 12), 2, 3)).toBe(true);
    });

    it('should identify third Friday of month', () => {
      // June 2024: Third Friday is June 21
      expect(isNthWeekdayOfMonth(new Date(2024, 5, 21), 3, 5)).toBe(true);
    });

    it('should identify fourth Sunday of month', () => {
      // June 2024: Fourth Sunday is June 23
      expect(isNthWeekdayOfMonth(new Date(2024, 5, 23), 4, 0)).toBe(true);
    });

    it('should identify last weekday of month', () => {
      // June 2024: Last Friday is June 28
      expect(isNthWeekdayOfMonth(new Date(2024, 5, 28), -1, 5)).toBe(true);
      expect(isNthWeekdayOfMonth(new Date(2024, 5, 21), -1, 5)).toBe(false);
    });

    it('should return false for wrong day of week', () => {
      // June 3, 2024 is Monday, not Tuesday
      expect(isNthWeekdayOfMonth(new Date(2024, 5, 3), 1, 2)).toBe(false);
    });
  });

  describe('isMonthlyDue with Nth weekday', () => {
    it('should work with first Monday', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'monthly',
        monthly_week: 1,
        monthly_day_of_week: 1, // Monday
      });

      // June 2024: First Monday is June 3
      expect(isMonthlyDue(checklist, new Date(2024, 5, 3))).toBe(true);
      expect(isMonthlyDue(checklist, new Date(2024, 5, 10))).toBe(false);
    });

    it('should work with last Friday', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'monthly',
        monthly_week: -1,
        monthly_day_of_week: 5, // Friday
      });

      // June 2024: Last Friday is June 28
      expect(isMonthlyDue(checklist, new Date(2024, 5, 28))).toBe(true);
    });
  });

  describe('isQuarterlyDue', () => {
    it('should work with first month of quarter', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'quarterly',
        quarterly_month: 1, // First month of quarter
        quarterly_day: 15,
      });

      // Jan, Apr, Jul, Oct are first months of quarters
      expect(isQuarterlyDue(checklist, new Date(2024, 0, 15))).toBe(true); // Jan 15
      expect(isQuarterlyDue(checklist, new Date(2024, 3, 15))).toBe(true); // Apr 15
      expect(isQuarterlyDue(checklist, new Date(2024, 6, 15))).toBe(true); // Jul 15
      expect(isQuarterlyDue(checklist, new Date(2024, 9, 15))).toBe(true); // Oct 15
    });

    it('should return false for wrong month in quarter', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'quarterly',
        quarterly_month: 1,
        quarterly_day: 15,
      });

      // Feb is second month of Q1
      expect(isQuarterlyDue(checklist, new Date(2024, 1, 15))).toBe(false);
    });

    it('should work with second month of quarter', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'quarterly',
        quarterly_month: 2, // Second month of quarter
        quarterly_day: 10,
      });

      // Feb, May, Aug, Nov are second months
      expect(isQuarterlyDue(checklist, new Date(2024, 1, 10))).toBe(true); // Feb 10
      expect(isQuarterlyDue(checklist, new Date(2024, 4, 10))).toBe(true); // May 10
    });

    it('should work with third month of quarter', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'quarterly',
        quarterly_month: 3, // Third month of quarter
        quarterly_day: 20,
      });

      // Mar, Jun, Sep, Dec are third months
      expect(isQuarterlyDue(checklist, new Date(2024, 2, 20))).toBe(true); // Mar 20
      expect(isQuarterlyDue(checklist, new Date(2024, 5, 20))).toBe(true); // Jun 20
    });

    it('should handle last day of month', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'quarterly',
        quarterly_month: 1,
        quarterly_day: -1,
      });

      expect(isQuarterlyDue(checklist, new Date(2024, 0, 31))).toBe(true); // Jan 31
      expect(isQuarterlyDue(checklist, new Date(2024, 3, 30))).toBe(true); // Apr 30
    });

    it('should handle day overflow', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'quarterly',
        quarterly_month: 1,
        quarterly_day: 31,
      });

      // April only has 30 days
      expect(isQuarterlyDue(checklist, new Date(2024, 3, 30))).toBe(true);
    });
  });

  describe('isAnnualDue', () => {
    it('should return true for matching date', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'annual',
        annual_month: 6, // June
        annual_day: 15,
      });

      expect(isAnnualDue(checklist, new Date(2024, 5, 15))).toBe(true);
      expect(isAnnualDue(checklist, new Date(2025, 5, 15))).toBe(true);
    });

    it('should return false for wrong month', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'annual',
        annual_month: 6,
        annual_day: 15,
      });

      expect(isAnnualDue(checklist, new Date(2024, 6, 15))).toBe(false); // July
    });

    it('should return false for wrong day', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'annual',
        annual_month: 6,
        annual_day: 15,
      });

      expect(isAnnualDue(checklist, new Date(2024, 5, 14))).toBe(false);
    });

    it('should handle last day of month', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'annual',
        annual_month: 2, // February
        annual_day: -1,
      });

      expect(isAnnualDue(checklist, new Date(2024, 1, 29))).toBe(true); // Leap year
      expect(isAnnualDue(checklist, new Date(2023, 1, 28))).toBe(true); // Non-leap year
    });

    it('should handle Feb 29 in non-leap years', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'annual',
        annual_month: 2, // February
        annual_day: 29,
      });

      // In leap year, Feb 29 works
      expect(isAnnualDue(checklist, new Date(2024, 1, 29))).toBe(true);

      // In non-leap year, fall back to Feb 28
      expect(isAnnualDue(checklist, new Date(2023, 1, 28))).toBe(true);
    });
  });

  describe('isCustomIntervalDue - Days', () => {
    it('should work for every N days', () => {
      const startDate = new Date(2024, 5, 1); // June 1, 2024
      const checklist = createTestChecklist({
        recurrence_type: 'custom',
        custom_interval_value: 3,
        custom_interval_unit: 'days',
        custom_start_date: startDate.getTime(),
      });

      // Day 0: June 1 (start) - should be due
      expect(isCustomIntervalDue(checklist, new Date(2024, 5, 1))).toBe(true);
      // Day 1: June 2 - not due
      expect(isCustomIntervalDue(checklist, new Date(2024, 5, 2))).toBe(false);
      // Day 2: June 3 - not due
      expect(isCustomIntervalDue(checklist, new Date(2024, 5, 3))).toBe(false);
      // Day 3: June 4 - due
      expect(isCustomIntervalDue(checklist, new Date(2024, 5, 4))).toBe(true);
      // Day 6: June 7 - due
      expect(isCustomIntervalDue(checklist, new Date(2024, 5, 7))).toBe(true);
    });

    it('should return false before start date', () => {
      const startDate = new Date(2024, 5, 15);
      const checklist = createTestChecklist({
        recurrence_type: 'custom',
        custom_interval_value: 2,
        custom_interval_unit: 'days',
        custom_start_date: startDate.getTime(),
      });

      expect(isCustomIntervalDue(checklist, new Date(2024, 5, 14))).toBe(false);
    });
  });

  describe('isCustomIntervalDue - Weeks', () => {
    it('should work for every N weeks', () => {
      const startDate = new Date(2024, 5, 3); // Monday, June 3, 2024
      const checklist = createTestChecklist({
        recurrence_type: 'custom',
        custom_interval_value: 2,
        custom_interval_unit: 'weeks',
        custom_start_date: startDate.getTime(),
      });

      // Week 0: June 3 - due (start)
      expect(isCustomIntervalDue(checklist, new Date(2024, 5, 3))).toBe(true);
      // Week 1: June 10 - not due (wrong week)
      expect(isCustomIntervalDue(checklist, new Date(2024, 5, 10))).toBe(false);
      // Week 2: June 17 - due
      expect(isCustomIntervalDue(checklist, new Date(2024, 5, 17))).toBe(true);
      // Week 4: July 1 - due
      expect(isCustomIntervalDue(checklist, new Date(2024, 6, 1))).toBe(true);
    });

    it('should require same day of week', () => {
      const startDate = new Date(2024, 5, 3); // Monday
      const checklist = createTestChecklist({
        recurrence_type: 'custom',
        custom_interval_value: 2,
        custom_interval_unit: 'weeks',
        custom_start_date: startDate.getTime(),
      });

      // June 18 is Tuesday, not Monday
      expect(isCustomIntervalDue(checklist, new Date(2024, 5, 18))).toBe(false);
    });
  });

  describe('isCustomIntervalDue - Months', () => {
    it('should work for every N months', () => {
      const startDate = new Date(2024, 0, 15); // January 15, 2024
      const checklist = createTestChecklist({
        recurrence_type: 'custom',
        custom_interval_value: 3,
        custom_interval_unit: 'months',
        custom_start_date: startDate.getTime(),
      });

      // Month 0: Jan 15 - due
      expect(isCustomIntervalDue(checklist, new Date(2024, 0, 15))).toBe(true);
      // Month 1: Feb 15 - not due
      expect(isCustomIntervalDue(checklist, new Date(2024, 1, 15))).toBe(false);
      // Month 3: Apr 15 - due
      expect(isCustomIntervalDue(checklist, new Date(2024, 3, 15))).toBe(true);
      // Month 6: Jul 15 - due
      expect(isCustomIntervalDue(checklist, new Date(2024, 6, 15))).toBe(true);
    });

    it('should handle last day of month', () => {
      const startDate = new Date(2024, 0, 31); // January 31, 2024
      const checklist = createTestChecklist({
        recurrence_type: 'custom',
        custom_interval_value: 1,
        custom_interval_unit: 'months',
        custom_start_date: startDate.getTime(),
      });

      // Jan 31 - due
      expect(isCustomIntervalDue(checklist, new Date(2024, 0, 31))).toBe(true);
      // Feb 29 (last day in leap year) - due
      expect(isCustomIntervalDue(checklist, new Date(2024, 1, 29))).toBe(true);
      // Mar 31 - due
      expect(isCustomIntervalDue(checklist, new Date(2024, 2, 31))).toBe(true);
      // Apr 30 - due (last day of April)
      expect(isCustomIntervalDue(checklist, new Date(2024, 3, 30))).toBe(true);
    });

    it('should handle day overflow', () => {
      const startDate = new Date(2024, 0, 30); // January 30, 2024
      const checklist = createTestChecklist({
        recurrence_type: 'custom',
        custom_interval_value: 1,
        custom_interval_unit: 'months',
        custom_start_date: startDate.getTime(),
      });

      // Feb only has 29 days in 2024, so Feb 29 should be due
      expect(isCustomIntervalDue(checklist, new Date(2024, 1, 29))).toBe(true);
    });
  });

  describe('isChecklistDueOnDate - one-time', () => {
    it('should return false for one-time recurrence (handled at task level)', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'one-time',
      });

      expect(isChecklistDueOnDate(checklist, new Date(2024, 5, 15))).toBe(false);
    });
  });
});

// =============================================================================
// DATE RANGE QUERIES TESTS
// =============================================================================

describe('Date Range Queries', () => {
  describe('getDatesInMonth', () => {
    it('should return all dates in a month', () => {
      const dates = getDatesInMonth(2024, 5); // June 2024

      expect(dates.length).toBe(30);
      expect(dates[0].getDate()).toBe(1);
      expect(dates[29].getDate()).toBe(30);
    });

    it('should handle February in leap year', () => {
      const dates = getDatesInMonth(2024, 1); // February 2024
      expect(dates.length).toBe(29);
    });

    it('should handle February in non-leap year', () => {
      const dates = getDatesInMonth(2023, 1); // February 2023
      expect(dates.length).toBe(28);
    });
  });

  describe('getDatesInRange', () => {
    it('should return all dates in range (inclusive)', () => {
      const start = new Date(2024, 5, 10);
      const end = new Date(2024, 5, 15);
      const dates = getDatesInRange(start, end);

      expect(dates.length).toBe(6);
      expect(dates[0].getDate()).toBe(10);
      expect(dates[5].getDate()).toBe(15);
    });

    it('should work across months', () => {
      const start = new Date(2024, 5, 28);
      const end = new Date(2024, 6, 3);
      const dates = getDatesInRange(start, end);

      expect(dates.length).toBe(6);
    });

    it('should return single date for same start and end', () => {
      const date = new Date(2024, 5, 15);
      const dates = getDatesInRange(date, date);

      expect(dates.length).toBe(1);
    });
  });

  describe('getChecklistDueDates', () => {
    it('should return due dates for weekly checklist', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'weekly',
        weekly_days: [1, 5], // Monday, Friday
      });

      const start = new Date(2024, 5, 1); // June 2024
      const end = new Date(2024, 5, 30);
      const dueDates = getChecklistDueDates(checklist, start, end);

      // June 2024: Mondays are 3, 10, 17, 24; Fridays are 7, 14, 21, 28
      expect(dueDates.length).toBe(8);
    });

    it('should return all dates for daily checklist', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'daily',
      });

      const start = new Date(2024, 5, 1);
      const end = new Date(2024, 5, 10);
      const dueDates = getChecklistDueDates(checklist, start, end);

      expect(dueDates.length).toBe(10);
    });
  });
});

// =============================================================================
// HUMAN-READABLE DESCRIPTIONS TESTS
// =============================================================================

describe('Human-Readable Descriptions', () => {
  describe('getRecurrenceDescription', () => {
    it('should describe daily', () => {
      const checklist = createTestChecklist({ recurrence_type: 'daily' });
      expect(getRecurrenceDescription(checklist)).toBe('Every day');
    });

    it('should describe weekly with single day', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'weekly',
        weekly_days: [1], // Monday
      });
      expect(getRecurrenceDescription(checklist)).toBe('Every Mon');
    });

    it('should describe weekly with multiple days', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'weekly',
        weekly_days: [1, 3, 5], // Mon, Wed, Fri
      });
      expect(getRecurrenceDescription(checklist)).toBe('Every Mon, Wed, Fri');
    });

    it('should describe monthly with specific day', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'monthly',
        monthly_day: 15,
      });
      expect(getRecurrenceDescription(checklist)).toBe('15th of each month');
    });

    it('should describe monthly with last day', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'monthly',
        monthly_day: -1,
      });
      expect(getRecurrenceDescription(checklist)).toBe('Last day of each month');
    });

    it('should describe monthly with Nth weekday', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'monthly',
        monthly_week: 1,
        monthly_day_of_week: 1, // First Monday
      });
      expect(getRecurrenceDescription(checklist)).toBe(
        'First Monday of each month'
      );
    });

    it('should describe quarterly', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'quarterly',
        quarterly_month: 1,
        quarterly_day: 15,
      });
      expect(getRecurrenceDescription(checklist)).toBe(
        '15th of first month each quarter'
      );
    });

    it('should describe annual', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'annual',
        annual_month: 6, // June
        annual_day: 15,
      });
      expect(getRecurrenceDescription(checklist)).toBe('15th of June');
    });

    it('should describe custom interval (days)', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'custom',
        custom_interval_value: 14,
        custom_interval_unit: 'days',
      });
      expect(getRecurrenceDescription(checklist)).toBe('Every 14 days');
    });

    it('should describe custom interval (singular)', () => {
      const checklist = createTestChecklist({
        recurrence_type: 'custom',
        custom_interval_value: 1,
        custom_interval_unit: 'weeks',
      });
      expect(getRecurrenceDescription(checklist)).toBe('Every 1 week');
    });

    it('should describe one-time', () => {
      const checklist = createTestChecklist({ recurrence_type: 'one-time' });
      expect(getRecurrenceDescription(checklist)).toBe('One-time');
    });
  });
});
