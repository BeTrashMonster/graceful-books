/**
 * Email Backup Panel Component Tests
 *
 * Tests for email backup settings UI including toggle, schedule configuration,
 * and save functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EmailBackupPanel } from './EmailBackupPanel'
import type { EmailScheduleConfig } from '../../services/backup/EmailSchedulingService'

describe('EmailBackupPanel', () => {
  const mockProps = {
    userId: 'user-123',
    userEmail: 'user@example.com',
    onSave: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render panel with title', () => {
      render(<EmailBackupPanel {...mockProps} />)

      expect(screen.getByText(/Email Backup Links/i)).toBeInTheDocument()
    })

    it('should render subtitle with explanation', () => {
      render(<EmailBackupPanel {...mockProps} />)

      expect(
        screen.getByText(/Get a secure link to restore your backup/i)
      ).toBeInTheDocument()
    })

    it('should render enable/disable toggle', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const toggle = screen.getByRole('checkbox')
      expect(toggle).toBeInTheDocument()
    })

    it('should show user email address', () => {
      render(<EmailBackupPanel {...mockProps} />)

      // Email is shown by default when enabled
      expect(screen.getByText(mockProps.userEmail)).toBeInTheDocument()
    })
  })

  describe('enable/disable toggle', () => {
    it('should start enabled by default', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const toggle = screen.getByRole('checkbox') as HTMLInputElement
      expect(toggle.checked).toBe(true)
    })

    it('should toggle enabled state', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const toggle = screen.getByRole('checkbox') as HTMLInputElement

      // Start enabled
      expect(toggle.checked).toBe(true)

      // Disable
      fireEvent.click(toggle)
      expect(toggle.checked).toBe(false)

      // Re-enable
      fireEvent.click(toggle)
      expect(toggle.checked).toBe(true)
    })

    it('should show configuration when enabled', () => {
      render(<EmailBackupPanel {...mockProps} />)

      expect(screen.getByText(/Schedule/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Day of Week/i)).toBeInTheDocument()
    })

    it('should hide configuration when disabled', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const toggle = screen.getByRole('checkbox')
      fireEvent.click(toggle) // Disable

      expect(screen.queryByText(/Schedule/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/Day of Week/i)).not.toBeInTheDocument()
    })

    it('should show save button after toggle change', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const toggle = screen.getByRole('checkbox')
      fireEvent.click(toggle)

      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument()
    })
  })

  describe('schedule configuration', () => {
    it('should render day of week selector', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const daySelect = screen.getByLabelText(/Day of Week/i)
      expect(daySelect).toBeInTheDocument()
    })

    it('should render all days of week', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const daySelect = screen.getByLabelText(/Day of Week/i) as HTMLSelectElement
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

      days.forEach((day) => {
        expect(screen.getByRole('option', { name: day })).toBeInTheDocument()
      })
    })

    it('should change day of week', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const daySelect = screen.getByLabelText(/Day of Week/i) as HTMLSelectElement

      fireEvent.change(daySelect, { target: { value: '5' } }) // Friday
      expect(daySelect.value).toBe('5')
    })

    it('should render hour selector', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const hourSelect = screen.getByLabelText(/Hour/i)
      expect(hourSelect).toBeInTheDocument()
    })

    it('should render all 24 hours', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const hourSelect = screen.getByLabelText(/Hour/i) as HTMLSelectElement
      const options = hourSelect.querySelectorAll('option')

      expect(options).toHaveLength(24)
    })

    it('should change hour', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const hourSelect = screen.getByLabelText(/Hour/i) as HTMLSelectElement

      fireEvent.change(hourSelect, { target: { value: '14' } }) // 2 PM
      expect(hourSelect.value).toBe('14')
    })

    it('should render minute selector', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const minuteSelect = screen.getByLabelText(/Minute/i)
      expect(minuteSelect).toBeInTheDocument()
    })

    it('should have 15-minute intervals', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const minuteSelect = screen.getByLabelText(/Minute/i)

      expect(screen.getByRole('option', { name: ':00' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: ':15' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: ':30' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: ':45' })).toBeInTheDocument()
    })

    it('should change minute', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const minuteSelect = screen.getByLabelText(/Minute/i) as HTMLSelectElement

      fireEvent.change(minuteSelect, { target: { value: '30' } })
      expect(minuteSelect.value).toBe('30')
    })

    it('should render timezone selector', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const timezoneSelect = screen.getByLabelText(/Timezone/i)
      expect(timezoneSelect).toBeInTheDocument()
    })

    it('should include common US timezones', () => {
      render(<EmailBackupPanel {...mockProps} />)

      expect(screen.getByRole('option', { name: /Eastern Time/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /Central Time/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /Mountain Time/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /Pacific Time/i })).toBeInTheDocument()
    })

    it('should change timezone', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const timezoneSelect = screen.getByLabelText(/Timezone/i) as HTMLSelectElement

      fireEvent.change(timezoneSelect, { target: { value: 'America/Los_Angeles' } })
      expect(timezoneSelect.value).toBe('America/Los_Angeles')
    })
  })

  describe('schedule preview', () => {
    it('should show schedule preview when enabled', () => {
      render(<EmailBackupPanel {...mockProps} />)

      expect(screen.getByText(/Every Sunday/i)).toBeInTheDocument()
    })

    it('should update preview when schedule changes', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const daySelect = screen.getByLabelText(/Day of Week/i)
      fireEvent.change(daySelect, { target: { value: '5' } }) // Friday

      expect(screen.getByText(/Every Friday/i)).toBeInTheDocument()
    })

    it('should show next scheduled email time', () => {
      render(<EmailBackupPanel {...mockProps} />)

      expect(screen.getByText(/Next email:/i)).toBeInTheDocument()
    })

    it('should format time in 12-hour format', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const preview = screen.getByText(/Every Sunday/i)
      expect(preview.textContent).toMatch(/AM|PM/)
    })
  })

  describe('security information', () => {
    it('should show security section when enabled', () => {
      render(<EmailBackupPanel {...mockProps} />)

      expect(screen.getByText(/Security & Privacy/i)).toBeInTheDocument()
    })

    it('should explain encryption', () => {
      render(<EmailBackupPanel {...mockProps} />)

      expect(screen.getByText(/encrypted before being stored/i)).toBeInTheDocument()
    })

    it('should explain link expiration', () => {
      render(<EmailBackupPanel {...mockProps} />)

      expect(screen.getByText(/expire after 7 days/i)).toBeInTheDocument()
    })

    it('should explain one-time use', () => {
      render(<EmailBackupPanel {...mockProps} />)

      expect(screen.getByText(/can only be used once/i)).toBeInTheDocument()
    })

    it('should explain zero-knowledge', () => {
      render(<EmailBackupPanel {...mockProps} />)

      expect(screen.getByText(/never have access to your unencrypted data/i)).toBeInTheDocument()
    })
  })

  describe('save functionality', () => {
    it('should show save button only when changes made', () => {
      render(<EmailBackupPanel {...mockProps} />)

      // No changes yet
      expect(screen.queryByRole('button', { name: /Save Changes/i })).not.toBeInTheDocument()

      // Make a change
      const daySelect = screen.getByLabelText(/Day of Week/i)
      fireEvent.change(daySelect, { target: { value: '5' } })

      // Save button appears
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument()
    })

    it('should call onSave when save button clicked', async () => {
      render(<EmailBackupPanel {...mockProps} />)

      // Make a change
      const daySelect = screen.getByLabelText(/Day of Week/i)
      fireEvent.change(daySelect, { target: { value: '5' } })

      // Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockProps.onSave).toHaveBeenCalled()
      })
    })

    it('should pass updated config to onSave', async () => {
      render(<EmailBackupPanel {...mockProps} />)

      // Make changes
      fireEvent.change(screen.getByLabelText(/Day of Week/i), { target: { value: '5' } })
      fireEvent.change(screen.getByLabelText(/Hour/i), { target: { value: '14' } })
      fireEvent.change(screen.getByLabelText(/Minute/i), { target: { value: '30' } })

      // Save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockProps.onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            dayOfWeek: 5,
            hour: 14,
            minute: 30,
          })
        )
      })
    })

    it('should show saving state', async () => {
      render(<EmailBackupPanel {...mockProps} />)

      // Make a change
      const daySelect = screen.getByLabelText(/Day of Week/i)
      fireEvent.change(daySelect, { target: { value: '5' } })

      // Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      fireEvent.click(saveButton)

      // Should show saving state
      expect(screen.getByRole('button', { name: /Saving.../i })).toBeInTheDocument()
    })

    it('should show success message after save', async () => {
      render(<EmailBackupPanel {...mockProps} />)

      // Make a change and save
      fireEvent.change(screen.getByLabelText(/Day of Week/i), { target: { value: '5' } })
      fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))

      await waitFor(
        () => {
          expect(screen.getByText(/Settings saved successfully/i)).toBeInTheDocument()
        },
        { timeout: 2000 }
      )
    })

    it('should hide save button after successful save', async () => {
      render(<EmailBackupPanel {...mockProps} />)

      // Make a change and save
      fireEvent.change(screen.getByLabelText(/Day of Week/i), { target: { value: '5' } })
      fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Save Changes/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('Steadiness communication', () => {
    it('should use patient language', () => {
      render(<EmailBackupPanel {...mockProps} />)

      expect(screen.getByText(/Take your time with this/i)).toBeInTheDocument()
    })

    it('should reassure about flexibility', () => {
      render(<EmailBackupPanel {...mockProps} />)

      expect(screen.getByText(/change these settings later/i)).toBeInTheDocument()
    })

    it('should use encouraging tone', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const toggle = screen.getByRole('checkbox')
      fireEvent.click(toggle) // Disable

      expect(screen.getByText(/When enabled/i)).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have accessible labels for all inputs', () => {
      render(<EmailBackupPanel {...mockProps} />)

      expect(screen.getByLabelText(/Day of Week/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Hour/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Minute/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Timezone/i)).toBeInTheDocument()
    })

    it('should have accessible toggle', () => {
      render(<EmailBackupPanel {...mockProps} />)

      const toggle = screen.getByRole('checkbox')
      expect(toggle).toHaveAttribute('type', 'checkbox')
    })

    it('should have accessible button', () => {
      render(<EmailBackupPanel {...mockProps} />)

      // Make a change to show button
      fireEvent.change(screen.getByLabelText(/Day of Week/i), { target: { value: '5' } })

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      expect(saveButton).toHaveAttribute('type', 'button')
    })
  })
})
