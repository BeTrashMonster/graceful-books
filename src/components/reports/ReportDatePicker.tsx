/**
 * Report Date Picker Component
 *
 * Provides date selection for balance sheet "as-of" date.
 * Includes preset options and custom date selection.
 */

import { useState } from 'react'
import './ReportDatePicker.css'

interface ReportDatePickerProps {
  selectedDate: Date
  onDateChange: (date: Date) => void
  label?: string
  presets?: DatePreset[]
}

interface DatePreset {
  label: string
  date: Date
}

const DEFAULT_PRESETS: DatePreset[] = [
  { label: 'Today', date: new Date() },
  { label: 'End of Last Month', date: getEndOfLastMonth() },
  { label: 'End of Last Quarter', date: getEndOfLastQuarter() },
  { label: 'End of Last Year', date: getEndOfLastYear() },
]

export const ReportDatePicker = ({
  selectedDate,
  onDateChange,
  label = 'As of Date',
  presets = DEFAULT_PRESETS,
}: ReportDatePickerProps) => {
  const [isCustom, setIsCustom] = useState(false)
  const [customDateValue, setCustomDateValue] = useState(formatDateForInput(selectedDate))

  const handlePresetClick = (preset: DatePreset) => {
    setIsCustom(false)
    onDateChange(preset.date)
  }

  const handleCustomToggle = () => {
    setIsCustom(!isCustom)
    if (!isCustom) {
      setCustomDateValue(formatDateForInput(selectedDate))
    }
  }

  const handleCustomDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCustomDateValue(value)

    if (value) {
      const date = new Date(value)
      // Set to end of day
      date.setHours(23, 59, 59, 999)
      onDateChange(date)
    }
  }

  return (
    <div className="report-date-picker">
      <label className="date-picker-label">{label}</label>

      <div className="date-picker-content">
        {/* Preset Buttons */}
        <div className="date-presets">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className={`preset-button ${!isCustom && isSameDate(selectedDate, preset.date) ? 'active' : ''}`}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleCustomToggle}
            className={`preset-button ${isCustom ? 'active' : ''}`}
          >
            Custom Date
          </button>
        </div>

        {/* Custom Date Input */}
        {isCustom && (
          <div className="custom-date-input">
            <input
              type="date"
              value={customDateValue}
              onChange={handleCustomDateChange}
              className="date-input"
              max={formatDateForInput(new Date())}
            />
          </div>
        )}

        {/* Selected Date Display */}
        <div className="selected-date-display">
          <span className="selected-date-label">Selected:</span>
          <span className="selected-date-value">{formatDateForDisplay(selectedDate)}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Helper: Get end of last month
 */
function getEndOfLastMonth(): Date {
  const date = new Date()
  date.setDate(0) // Go to last day of previous month
  date.setHours(23, 59, 59, 999)
  return date
}

/**
 * Helper: Get end of last quarter
 */
function getEndOfLastQuarter(): Date {
  const date = new Date()
  const currentQuarter = Math.floor(date.getMonth() / 3)
  const lastQuarterEndMonth = currentQuarter * 3 - 1

  if (lastQuarterEndMonth < 0) {
    // Last quarter was in previous year
    date.setFullYear(date.getFullYear() - 1)
    date.setMonth(11) // December
  } else {
    date.setMonth(lastQuarterEndMonth)
  }

  date.setDate(new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate())
  date.setHours(23, 59, 59, 999)
  return date
}

/**
 * Helper: Get end of last year
 */
function getEndOfLastYear(): Date {
  const date = new Date()
  date.setFullYear(date.getFullYear() - 1)
  date.setMonth(11) // December
  date.setDate(31)
  date.setHours(23, 59, 59, 999)
  return date
}

/**
 * Format date for input[type="date"]
 */
function formatDateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format date for display
 */
function formatDateForDisplay(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

/**
 * Check if two dates are on the same day
 */
function isSameDate(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}
