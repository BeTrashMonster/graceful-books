/**
 * DatePicker Component
 *
 * Calendar-based date picker with year dropdown and month navigation.
 * Supports easy 2-digit year selection by defaulting to 2000s.
 */

import { useState, useRef, useEffect } from 'react';
import styles from './DatePicker.module.css';

interface DatePickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({ value, onChange, placeholder = 'Select date...', className }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth()); // 0-11
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value (use local timezone, not UTC)
  const parseLocalDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // 0-indexed
    const day = parseInt(parts[2]);
    return new Date(year, month, day);
  };

  const selectedDate = value ? parseLocalDate(value) : null;

  // Initialize view to selected date or current date
  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }, [value]);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Format display value
  const displayValue = selectedDate
    ? `${String(selectedDate.getMonth() + 1).padStart(2, '0')}/${String(selectedDate.getDate()).padStart(2, '0')}/${selectedDate.getFullYear()}`
    : '';

  // Generate year options (2020 to current year + 10)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2020 + 11 }, (_, i) => 2020 + i);

  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Generate calendar days
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay(); // 0 = Sunday
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  // Create calendar grid
  const calendarDays: (number | null)[] = [];

  // Add empty slots for days before month starts
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  // Add days of month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const handleDayClick = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      viewMonth === today.getMonth() &&
      viewYear === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      day === selectedDate.getDate() &&
      viewMonth === selectedDate.getMonth() &&
      viewYear === selectedDate.getFullYear()
    );
  };

  return (
    <div ref={containerRef} className={`${styles.container} ${className || ''}`}>
      <input
        type="text"
        value={displayValue}
        onClick={() => setIsOpen(!isOpen)}
        placeholder={placeholder}
        readOnly
        className={styles.input}
      />

      {isOpen && (
        <div className={styles.dropdown}>
          {/* Header with year and month controls */}
          <div className={styles.header}>
            <button
              type="button"
              onClick={handlePrevMonth}
              className={styles.navButton}
              aria-label="Previous month"
            >
              ‹
            </button>

            <div className={styles.headerCenter}>
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value))}
                className={styles.monthSelect}
              >
                {monthNames.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value))}
                className={styles.yearSelect}
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className={styles.navButton}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          {/* Weekday headers */}
          <div className={styles.weekdays}>
            <div>Su</div>
            <div>Mo</div>
            <div>Tu</div>
            <div>We</div>
            <div>Th</div>
            <div>Fr</div>
            <div>Sa</div>
          </div>

          {/* Calendar grid */}
          <div className={styles.calendar}>
            {calendarDays.map((day, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => day && handleDayClick(day)}
                disabled={!day}
                className={`
                  ${styles.day}
                  ${!day ? styles.dayEmpty : ''}
                  ${day && isToday(day) ? styles.dayToday : ''}
                  ${day && isSelected(day) ? styles.daySelected : ''}
                `}
              >
                {day || ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
