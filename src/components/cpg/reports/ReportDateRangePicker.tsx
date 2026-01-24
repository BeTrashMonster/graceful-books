/**
 * Report Date Range Picker Component
 *
 * Provides date range selection for CPG reports with presets and custom ranges.
 * Common to all CPG report pages.
 */

import { useState } from 'react';
import styles from './ReportDateRangePicker.module.css';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label?: string;
}

interface ReportDateRangePickerProps {
  selectedRange: DateRange;
  onRangeChange: (range: DateRange) => void;
  label?: string;
}

type DateRangePreset = 'last-30-days' | 'last-90-days' | 'ytd' | 'last-year' | 'custom';

export const ReportDateRangePicker = ({
  selectedRange,
  onRangeChange,
  label = 'Date Range',
}: ReportDateRangePickerProps) => {
  const [activePreset, setActivePreset] = useState<DateRangePreset>('last-30-days');
  const [isCustom, setIsCustom] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(formatDateForInput(selectedRange.startDate));
  const [customEndDate, setCustomEndDate] = useState(formatDateForInput(selectedRange.endDate));

  const handlePresetClick = (preset: DateRangePreset) => {
    setActivePreset(preset);
    setIsCustom(false);

    const range = getPresetRange(preset);
    onRangeChange(range);
  };

  const handleCustomToggle = () => {
    setIsCustom(true);
    setActivePreset('custom');
    setCustomStartDate(formatDateForInput(selectedRange.startDate));
    setCustomEndDate(formatDateForInput(selectedRange.endDate));
  };

  const handleCustomStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomStartDate(value);

    if (value) {
      const startDate = new Date(value);
      startDate.setHours(0, 0, 0, 0);
      const endDate = customEndDate ? new Date(customEndDate) : new Date();
      endDate.setHours(23, 59, 59, 999);

      onRangeChange({
        startDate,
        endDate,
        label: 'Custom Range',
      });
    }
  };

  const handleCustomEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomEndDate(value);

    if (value) {
      const startDate = customStartDate ? new Date(customStartDate) : new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(value);
      endDate.setHours(23, 59, 59, 999);

      onRangeChange({
        startDate,
        endDate,
        label: 'Custom Range',
      });
    }
  };

  return (
    <div className={styles.container}>
      <label className={styles.label}>{label}</label>

      <div className={styles.content}>
        {/* Preset Buttons */}
        <div className={styles.presets}>
          <button
            type="button"
            onClick={() => handlePresetClick('last-30-days')}
            className={`${styles.presetButton} ${activePreset === 'last-30-days' && !isCustom ? styles.active : ''}`}
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => handlePresetClick('last-90-days')}
            className={`${styles.presetButton} ${activePreset === 'last-90-days' && !isCustom ? styles.active : ''}`}
          >
            Last 90 Days
          </button>
          <button
            type="button"
            onClick={() => handlePresetClick('ytd')}
            className={`${styles.presetButton} ${activePreset === 'ytd' && !isCustom ? styles.active : ''}`}
          >
            Year to Date
          </button>
          <button
            type="button"
            onClick={() => handlePresetClick('last-year')}
            className={`${styles.presetButton} ${activePreset === 'last-year' && !isCustom ? styles.active : ''}`}
          >
            Last Year
          </button>
          <button
            type="button"
            onClick={handleCustomToggle}
            className={`${styles.presetButton} ${isCustom ? styles.active : ''}`}
          >
            Custom
          </button>
        </div>

        {/* Custom Date Inputs */}
        {isCustom && (
          <div className={styles.customInputs}>
            <div className={styles.inputGroup}>
              <label htmlFor="start-date" className={styles.inputLabel}>
                Start Date
              </label>
              <input
                id="start-date"
                type="date"
                value={customStartDate}
                onChange={handleCustomStartChange}
                className={styles.dateInput}
                max={customEndDate || formatDateForInput(new Date())}
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="end-date" className={styles.inputLabel}>
                End Date
              </label>
              <input
                id="end-date"
                type="date"
                value={customEndDate}
                onChange={handleCustomEndChange}
                className={styles.dateInput}
                min={customStartDate}
                max={formatDateForInput(new Date())}
              />
            </div>
          </div>
        )}

        {/* Selected Range Display */}
        <div className={styles.selectedDisplay}>
          <span className={styles.selectedLabel}>Selected:</span>
          <span className={styles.selectedValue}>
            {formatDateForDisplay(selectedRange.startDate)} - {formatDateForDisplay(selectedRange.endDate)}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Get preset date range
 */
function getPresetRange(preset: DateRangePreset): DateRange {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  let startDate: Date;
  let label: string;

  switch (preset) {
    case 'last-30-days':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      label = 'Last 30 Days';
      break;

    case 'last-90-days':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 90);
      startDate.setHours(0, 0, 0, 0);
      label = 'Last 90 Days';
      break;

    case 'ytd':
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      label = 'Year to Date';
      break;

    case 'last-year':
      startDate = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      return {
        startDate,
        endDate: lastYearEnd,
        label: 'Last Year',
      };

    default:
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      label = 'Last 30 Days';
  }

  return {
    startDate,
    endDate: now,
    label,
  };
}

/**
 * Format date for input[type="date"]
 */
function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date for display
 */
function formatDateForDisplay(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
