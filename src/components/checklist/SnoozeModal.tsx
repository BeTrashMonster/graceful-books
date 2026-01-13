/**
 * SnoozeModal Component
 *
 * Per CHECK-002: Snooze functionality with date picker and optional reason.
 *
 * Features:
 * - Date picker for snooze until date
 * - Optional reason text input
 * - Quick snooze options (1 week, 2 weeks, 1 month)
 * - Keyboard accessible
 * - ARIA compliant
 */

import { useState, useCallback, type FormEvent } from 'react'
import { format, addDays, addWeeks, addMonths } from 'date-fns'
import { Modal } from '../modals/Modal'
import { Button } from '../core/Button'
import styles from './SnoozeModal.module.css'

export interface SnoozeModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean
  /**
   * Item title being snoozed
   */
  itemTitle: string
  /**
   * Callback when snooze is confirmed
   */
  onConfirm: (until: Date, reason?: string) => void
  /**
   * Callback when modal is closed
   */
  onClose: () => void
}

/**
 * Modal for snoozing checklist items with date selection
 */
export const SnoozeModal = ({ isOpen, itemTitle, onConfirm, onClose }: SnoozeModalProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Quick snooze options
  const quickOptions = [
    { label: '1 week', date: addWeeks(new Date(), 1) },
    { label: '2 weeks', date: addWeeks(new Date(), 2) },
    { label: '1 month', date: addMonths(new Date(), 1) },
  ]

  // Handle quick option selection
  const handleQuickSelect = useCallback((date: Date) => {
    setSelectedDate(date)
  }, [])

  // Handle custom date input
  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value) {
      setSelectedDate(new Date(value))
    }
  }, [])

  // Handle form submission
  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()

      if (!selectedDate) return

      setIsSubmitting(true)

      try {
        onConfirm(selectedDate, reason || undefined)
        // Reset form
        setSelectedDate(null)
        setReason('')
      } finally {
        setIsSubmitting(false)
      }
    },
    [selectedDate, reason, onConfirm],
  )

  // Handle close
  const handleClose = useCallback(() => {
    setSelectedDate(null)
    setReason('')
    onClose()
  }, [onClose])

  // Format date for input
  const formatDateForInput = (date: Date | null) => {
    if (!date) return ''
    return format(date, 'yyyy-MM-dd')
  }

  // Get minimum date (tomorrow)
  const getMinDate = () => {
    return format(addDays(new Date(), 1), 'yyyy-MM-dd')
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Snooze Item"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!selectedDate || isSubmitting}
            loading={isSubmitting}
          >
            Snooze
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className={styles.snoozeForm}>
        {/* Item being snoozed */}
        <div className={styles.itemInfo}>
          <p className={styles.itemLabel}>Snoozing:</p>
          <p className={styles.itemTitle}>{itemTitle}</p>
        </div>

        {/* Quick options */}
        <div className={styles.quickOptions}>
          <label className={styles.label}>Quick snooze</label>
          <div className={styles.quickButtons}>
            {quickOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                className={styles.quickButton}
                onClick={() => handleQuickSelect(option.date)}
                aria-pressed={
                  !!(selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(option.date, 'yyyy-MM-dd'))
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date picker */}
        <div className={styles.dateField}>
          <label htmlFor="snooze-date" className={styles.label}>
            Or choose a specific date
          </label>
          <input
            type="date"
            id="snooze-date"
            className={styles.dateInput}
            value={formatDateForInput(selectedDate)}
            onChange={handleDateChange}
            min={getMinDate()}
            aria-label="Snooze until date"
          />
          {selectedDate && (
            <p className={styles.dateHelp} role="status">
              Item will return on {format(selectedDate, 'MMMM d, yyyy')}
            </p>
          )}
        </div>

        {/* Optional reason */}
        <div className={styles.reasonField}>
          <label htmlFor="snooze-reason" className={styles.label}>
            Why are you snoozing this? <span className={styles.optional}>(optional)</span>
          </label>
          <textarea
            id="snooze-reason"
            className={styles.reasonInput}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Waiting for more information, Not ready yet..."
            rows={3}
            aria-label="Snooze reason"
          />
          <p className={styles.fieldHelp}>
            This helps you remember why you snoozed the item when it comes back.
          </p>
        </div>

        {/* Guidance message */}
        <div className={styles.guidance}>
          <p className={styles.guidanceText}>
            No worries! Sometimes we need more time. This item will come back when you're ready.
          </p>
        </div>
      </form>
    </Modal>
  )
}

SnoozeModal.displayName = 'SnoozeModal'
