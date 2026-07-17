/**
 * ScheduleSelector Component
 *
 * A reusable component for configuring checklist recurrence schedules.
 * Adapts its UI based on the recurrence type (weekly, monthly, quarterly, annual).
 */

import { useCallback } from 'react';
import type { ChecklistRecurrenceType } from '../../../../db/schema/checklistCalendar.schema';
import { DayPicker } from '../DayPicker';
import styles from './ScheduleSelector.module.css';

// =============================================================================
// TYPES
// =============================================================================

export interface ScheduleConfig {
  // Daily
  dailyDays: number[]; // Which days of week (0-6), empty = all days

  // Weekly
  weeklyDays: number[];
  isEveryOtherWeek: boolean;
  biweeklyStartDate: string; // ISO date string for when biweekly starts

  // Monthly
  monthlyScheduleType: 'day' | 'weekday';
  monthlyDay: number; // 1-31 or -1 for last
  monthlyWeek: number; // 1-4 or -1 for last
  monthlyDayOfWeek: number; // 0-6

  // Quarterly - flexible month selection
  quarterlyMonths: number[]; // Array of months (1-12)
  quarterlyDay: number; // 1-31 or -1

  // Annual
  annualMonth: number; // 1-12
  annualDay: number; // 1-31 or -1
}

export interface ScheduleSelectorProps {
  /**
   * The recurrence type to show UI for
   */
  recurrenceType: ChecklistRecurrenceType;

  /**
   * Current schedule configuration
   */
  config: ScheduleConfig;

  /**
   * Callback when configuration changes
   */
  onChange: (config: Partial<ScheduleConfig>) => void;

  /**
   * Whether the selector is disabled
   */
  disabled?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEK_NAMES = [
  { value: 1, label: '1st' },
  { value: 2, label: '2nd' },
  { value: 3, label: '3rd' },
  { value: 4, label: '4th' },
  { value: -1, label: 'Last' },
];

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];


// =============================================================================
// COMPONENT
// =============================================================================

export function ScheduleSelector({
  recurrenceType,
  config,
  onChange,
  disabled = false,
}: ScheduleSelectorProps) {
  // Handler for daily days change
  const handleDailyDaysChange = useCallback((days: number[]) => {
    onChange({ dailyDays: days });
  }, [onChange]);

  // Handler for weekly days change
  const handleWeeklyDaysChange = useCallback((days: number[]) => {
    onChange({ weeklyDays: days });
  }, [onChange]);

  // Handler for every other week toggle
  const handleEveryOtherWeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ isEveryOtherWeek: e.target.checked });
  }, [onChange]);

  // Handler for biweekly start date change
  const handleBiweeklyStartDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ biweeklyStartDate: e.target.value });
  }, [onChange]);

  // Handler for monthly schedule type change
  const handleMonthlyTypeChange = useCallback((type: 'day' | 'weekday') => {
    onChange({ monthlyScheduleType: type });
  }, [onChange]);

  // Handler for monthly day change
  const handleMonthlyDayChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ monthlyDay: parseInt(e.target.value, 10) });
  }, [onChange]);

  // Handler for monthly week change
  const handleMonthlyWeekChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ monthlyWeek: parseInt(e.target.value, 10) });
  }, [onChange]);

  // Handler for monthly day of week change
  const handleMonthlyDayOfWeekChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ monthlyDayOfWeek: parseInt(e.target.value, 10) });
  }, [onChange]);

  // Handler for quarterly month toggle
  const handleQuarterlyMonthToggle = useCallback((month: number) => {
    const currentMonths = config.quarterlyMonths || [];
    const newMonths = currentMonths.includes(month)
      ? currentMonths.filter(m => m !== month)
      : [...currentMonths, month].sort((a, b) => a - b);
    onChange({ quarterlyMonths: newMonths });
  }, [config.quarterlyMonths, onChange]);

  // Handler for quarterly day change
  const handleQuarterlyDayChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ quarterlyDay: parseInt(e.target.value, 10) });
  }, [onChange]);

  // Handler for annual month change
  const handleAnnualMonthChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ annualMonth: parseInt(e.target.value, 10) });
  }, [onChange]);

  // Handler for annual day change
  const handleAnnualDayChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ annualDay: parseInt(e.target.value, 10) });
  }, [onChange]);

  // Generate day options (1-31 + Last)
  const dayOptions = [
    ...Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) })),
    { value: -1, label: 'Last day' },
  ];

  // Check if a month is selected for quarterly
  const isMonthSelected = (month: number) => {
    return (config.quarterlyMonths || []).includes(month);
  };

  // =============================================================================
  // RENDER BY RECURRENCE TYPE
  // =============================================================================

  if (recurrenceType === 'daily') {
    // Daily with day selection - allows excluding specific days
    const dailyDays = config.dailyDays || [0, 1, 2, 3, 4, 5, 6]; // Default to all days
    return (
      <div className={styles.scheduleSelector}>
        <label className={styles.label}>Which days?</label>
        <DayPicker
          selectedDays={dailyDays}
          onChange={handleDailyDaysChange}
          disabled={disabled}
          compact
          hideQuickActions
        />
        <p className={styles.hint}>Select the days this checklist should appear</p>
      </div>
    );
  }

  if (recurrenceType === 'weekly') {
    // Get today's date for default start
    const today = new Date().toISOString().split('T')[0];

    return (
      <div className={styles.scheduleSelector}>
        <label className={styles.label}>Schedule on:</label>
        <DayPicker
          selectedDays={config.weeklyDays}
          onChange={handleWeeklyDaysChange}
          disabled={disabled}
          compact
          hideQuickActions
        />
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={config.isEveryOtherWeek}
            onChange={handleEveryOtherWeekChange}
            disabled={disabled}
          />
          <span>Every other week</span>
        </label>
        {config.isEveryOtherWeek && (
          <div className={styles.startDateRow}>
            <label className={styles.startDateLabel}>
              Starting from:
              <input
                type="date"
                value={config.biweeklyStartDate || today}
                onChange={handleBiweeklyStartDateChange}
                disabled={disabled}
                className={styles.dateInput}
              />
            </label>
            <p className={styles.hint}>Tasks will appear on this week, then every other week</p>
          </div>
        )}
      </div>
    );
  }

  if (recurrenceType === 'monthly') {
    return (
      <div className={styles.scheduleSelector}>
        <label className={styles.label}>Schedule on:</label>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="monthlyType"
              checked={config.monthlyScheduleType === 'day'}
              onChange={() => handleMonthlyTypeChange('day')}
              disabled={disabled}
            />
            <span>Day</span>
            <select
              value={config.monthlyDay}
              onChange={handleMonthlyDayChange}
              disabled={disabled || config.monthlyScheduleType !== 'day'}
              className={styles.inlineSelect}
            >
              {dayOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <span>of month</span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="monthlyType"
              checked={config.monthlyScheduleType === 'weekday'}
              onChange={() => handleMonthlyTypeChange('weekday')}
              disabled={disabled}
            />
            <span>The</span>
            <select
              value={config.monthlyWeek}
              onChange={handleMonthlyWeekChange}
              disabled={disabled || config.monthlyScheduleType !== 'weekday'}
              className={styles.inlineSelect}
            >
              {WEEK_NAMES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={config.monthlyDayOfWeek}
              onChange={handleMonthlyDayOfWeekChange}
              disabled={disabled || config.monthlyScheduleType !== 'weekday'}
              className={styles.inlineSelect}
            >
              {DAY_NAMES.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    );
  }

  if (recurrenceType === 'quarterly') {
    return (
      <div className={styles.scheduleSelector}>
        <label className={styles.label}>Which months?</label>
        <div className={styles.monthGrid}>
          {/* Row 1: Jan-Jun */}
          <div className={styles.monthRow}>
            {[1, 2, 3, 4, 5, 6].map((month) => (
              <button
                key={month}
                type="button"
                className={`${styles.monthButton} ${isMonthSelected(month) ? styles.selected : ''}`}
                onClick={() => handleQuarterlyMonthToggle(month)}
                disabled={disabled}
                title={MONTH_NAMES_FULL[month - 1]}
              >
                {MONTH_NAMES[month - 1]}
              </button>
            ))}
          </div>
          {/* Row 2: Jul-Dec */}
          <div className={styles.monthRow}>
            {[7, 8, 9, 10, 11, 12].map((month) => (
              <button
                key={month}
                type="button"
                className={`${styles.monthButton} ${isMonthSelected(month) ? styles.selected : ''}`}
                onClick={() => handleQuarterlyMonthToggle(month)}
                disabled={disabled}
                title={MONTH_NAMES_FULL[month - 1]}
              >
                {MONTH_NAMES[month - 1]}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.selectRow}>
          <span>On day</span>
          <select
            value={config.quarterlyDay}
            onChange={handleQuarterlyDayChange}
            disabled={disabled}
            className={styles.select}
          >
            {dayOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span>of selected months</span>
        </div>
      </div>
    );
  }

  if (recurrenceType === 'annual') {
    return (
      <div className={styles.scheduleSelector}>
        <label className={styles.label}>Schedule on:</label>
        <div className={styles.selectRow}>
          <select
            value={config.annualMonth}
            onChange={handleAnnualMonthChange}
            disabled={disabled}
            className={styles.select}
          >
            {MONTH_NAMES_FULL.map((name, i) => (
              <option key={i} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={config.annualDay}
            onChange={handleAnnualDayChange}
            disabled={disabled}
            className={styles.select}
          >
            {dayOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  // For custom or one-time, no additional UI
  return null;
}

ScheduleSelector.displayName = 'ScheduleSelector';
