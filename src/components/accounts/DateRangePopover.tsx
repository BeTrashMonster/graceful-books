/**
 * DateRangePopover Component
 *
 * A popover for selecting a custom date range.
 * Used with the "Display Amounts For" dropdown.
 */

import { type FC, useState, useRef, useEffect } from 'react'
import { Button } from '../core/Button'
import { Input } from '../forms/Input'
import styles from './DateRangePopover.module.css'

export interface DateRangePopoverProps {
  isOpen: boolean
  onClose: () => void
  onApply: (startDate: Date, endDate: Date) => void
  initialStartDate?: Date
  initialEndDate?: Date
  anchorRef: React.RefObject<HTMLElement>
}

/**
 * Format date as YYYY-MM-DD for input
 */
function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * DateRangePopover Component
 */
export const DateRangePopover: FC<DateRangePopoverProps> = ({
  isOpen,
  onClose,
  onApply,
  initialStartDate,
  initialEndDate,
  anchorRef,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [startDate, setStartDate] = useState(
    initialStartDate ? formatDateForInput(initialStartDate) : ''
  )
  const [endDate, setEndDate] = useState(
    initialEndDate ? formatDateForInput(initialEndDate) : ''
  )
  const [error, setError] = useState<string | null>(null)

  // Reset values when popover opens
  useEffect(() => {
    if (isOpen) {
      setStartDate(initialStartDate ? formatDateForInput(initialStartDate) : '')
      setEndDate(initialEndDate ? formatDateForInput(initialEndDate) : '')
      setError(null)
    }
  }, [isOpen, initialStartDate, initialEndDate])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, anchorRef])

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const handleApply = () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates')
      return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    // Set end date to end of day
    end.setHours(23, 59, 59, 999)

    if (start > end) {
      setError('Start date must be before end date')
      return
    }

    setError(null)
    onApply(start, end)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className={styles.popover} ref={popoverRef}>
      <div className={styles.header}>
        <h4 className={styles.title}>Custom Date Range</h4>
      </div>

      <div className={styles.content}>
        <div className={styles.field}>
          <label className={styles.label}>Start Date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            fullWidth
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>End Date</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            fullWidth
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}
      </div>

      <div className={styles.actions}>
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={handleApply}>
          Apply
        </Button>
      </div>
    </div>
  )
}
