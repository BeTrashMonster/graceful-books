/**
 * DayPicker Component
 *
 * A reusable day-of-week selector for task recurrence customization.
 * Shows 7 day buttons (Sun-Sat) that can be toggled on/off.
 *
 * @see Roadmaps/ROADMAP_CHECKLIST_CALENDAR.md
 */

import { useCallback } from 'react';
import clsx from 'clsx';
import styles from './DayPicker.module.css';

export interface DayPickerProps {
  /** Currently selected days (0=Sunday, 6=Saturday) */
  selectedDays: number[];

  /** Callback when selection changes */
  onChange: (days: number[]) => void;

  /** Whether using inherited values (show different styling) */
  isInherited?: boolean;

  /** Days inherited from parent checklist (for visual reference) */
  inheritedDays?: number[];

  /** Whether the picker is disabled */
  disabled?: boolean;

  /** Compact mode for inline display */
  compact?: boolean;

  /** Hide quick action buttons */
  hideQuickActions?: boolean;

  /** Additional CSS class */
  className?: string;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function DayPicker({
  selectedDays,
  onChange,
  isInherited = false,
  inheritedDays = [],
  disabled = false,
  compact = false,
  hideQuickActions = false,
  className,
}: DayPickerProps) {
  const handleDayToggle = useCallback(
    (day: number) => {
      if (disabled) return;

      const newDays = selectedDays.includes(day)
        ? selectedDays.filter((d) => d !== day)
        : [...selectedDays, day].sort((a, b) => a - b);

      onChange(newDays);
    },
    [selectedDays, onChange, disabled]
  );

  const handleSelectAll = useCallback(() => {
    onChange([0, 1, 2, 3, 4, 5, 6]);
  }, [onChange]);

  const handleSelectWeekdays = useCallback(() => {
    onChange([1, 2, 3, 4, 5]);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange([]);
  }, [onChange]);

  return (
    <div
      className={clsx(styles.dayPicker, compact && styles.compact, className)}
    >
      <div className={styles.dayButtons}>
        {DAY_LABELS.map((label, index) => {
          const isSelected = selectedDays.includes(index);
          const isInheritedDay = inheritedDays.includes(index);
          const isWeekend = index === 0 || index === 6;

          return (
            <button
              key={index}
              type="button"
              className={clsx(
                styles.dayButton,
                isSelected && styles.selected,
                isInherited && isInheritedDay && styles.inherited,
                isWeekend && styles.weekend,
                disabled && styles.disabled
              )}
              onClick={() => handleDayToggle(index)}
              disabled={disabled}
              aria-label={DAY_NAMES[index]}
              aria-pressed={isSelected}
              title={DAY_NAMES[index]}
            >
              {label}
            </button>
          );
        })}
      </div>

      {!compact && !hideQuickActions && !disabled && (
        <div className={styles.quickActions}>
          <button
            type="button"
            className={styles.quickButton}
            onClick={handleSelectWeekdays}
          >
            Weekdays
          </button>
          <button
            type="button"
            className={styles.quickButton}
            onClick={handleSelectAll}
          >
            All
          </button>
          <button
            type="button"
            className={styles.quickButton}
            onClick={handleClear}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

DayPicker.displayName = 'DayPicker';
