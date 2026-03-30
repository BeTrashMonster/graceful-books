/**
 * Restoration Options Screen Tests
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 5, Task 5.2:
 * Comprehensive tests for restoration options UI.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RestorationOptionsScreen } from './RestorationOptionsScreen'

describe('RestorationOptionsScreen', () => {
  const mockOnSelectMethod = vi.fn()
  const mockOnSkipRestoration = vi.fn()

  beforeEach(() => {
    mockOnSelectMethod.mockClear()
    mockOnSkipRestoration.mockClear()
  })

  describe('Rendering', () => {
    it('should render welcome message', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
        />
      )

      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
      expect(screen.getByText(/choose your path/i)).toBeInTheDocument()
    })

    it('should render all three restoration options', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
        />
      )

      expect(screen.getByText('Email Backup Link')).toBeInTheDocument()
      expect(screen.getByText('Upload Backup File')).toBeInTheDocument()
      expect(screen.getByText('Connect to Sync Relay')).toBeInTheDocument()
    })

    it('should render descriptive text for each option', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
        />
      )

      expect(screen.getByText(/paste a restoration link/i)).toBeInTheDocument()
      expect(screen.getByText(/choose a backup file/i)).toBeInTheDocument()
      expect(screen.getByText(/sync from your encrypted cloud storage/i)).toBeInTheDocument()
    })

    it('should render skip restoration option', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
        />
      )

      expect(screen.getByText(/start from scratch/i)).toBeInTheDocument()
    })

    it('should show recommended badge on email option by default', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          emailAvailable={true}
        />
      )

      expect(screen.getByText(/recommended/i)).toBeInTheDocument()
    })
  })

  describe('Availability', () => {
    it('should enable all options when all are available', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          emailAvailable={true}
          fileAvailable={true}
          syncAvailable={true}
        />
      )

      const emailButton = screen.getByRole('button', { name: /select email backup link/i })
      const fileButton = screen.getByRole('button', { name: /select upload backup file/i })
      const syncButton = screen.getByRole('button', { name: /select connect to sync relay/i })

      expect(emailButton).not.toBeDisabled()
      expect(fileButton).not.toBeDisabled()
      expect(syncButton).not.toBeDisabled()
    })

    it('should disable email option when unavailable', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          emailAvailable={false}
          fileAvailable={true}
          syncAvailable={true}
        />
      )

      const emailCard = screen.getByText('Email Backup Link').closest('[role="button"]')
      expect(emailCard).toHaveAttribute('aria-disabled', 'true')
      expect(screen.getByText(/not available on this device/i)).toBeInTheDocument()
    })

    it('should disable file option when unavailable', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          emailAvailable={true}
          fileAvailable={false}
          syncAvailable={true}
        />
      )

      const fileCard = screen.getByText('Upload Backup File').closest('[role="button"]')
      expect(fileCard).toHaveAttribute('aria-disabled', 'true')
    })

    it('should disable sync option when unavailable', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          emailAvailable={true}
          fileAvailable={true}
          syncAvailable={false}
        />
      )

      const syncCard = screen.getByText('Connect to Sync Relay').closest('[role="button"]')
      expect(syncCard).toHaveAttribute('aria-disabled', 'true')
    })

    it('should handle all options being unavailable', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          emailAvailable={false}
          fileAvailable={false}
          syncAvailable={false}
        />
      )

      const unavailableMessages = screen.getAllByText(/not available on this device/i)
      expect(unavailableMessages).toHaveLength(3)
    })
  })

  describe('User Interactions', () => {
    it('should call onSelectMethod with "email" when email option is clicked', async () => {
      const user = userEvent.setup()

      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          emailAvailable={true}
        />
      )

      const emailCard = screen.getByText('Email Backup Link').closest('[role="button"]') as HTMLElement
      await user.click(emailCard)

      expect(mockOnSelectMethod).toHaveBeenCalledWith('email')
      expect(mockOnSelectMethod).toHaveBeenCalledTimes(1)
    })

    it('should call onSelectMethod with "file" when file option is clicked', async () => {
      const user = userEvent.setup()

      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          fileAvailable={true}
        />
      )

      const fileCard = screen.getByText('Upload Backup File').closest('[role="button"]') as HTMLElement
      await user.click(fileCard)

      expect(mockOnSelectMethod).toHaveBeenCalledWith('file')
    })

    it('should call onSelectMethod with "sync" when sync option is clicked', async () => {
      const user = userEvent.setup()

      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          syncAvailable={true}
        />
      )

      const syncCard = screen.getByText('Connect to Sync Relay').closest('[role="button"]') as HTMLElement
      await user.click(syncCard)

      expect(mockOnSelectMethod).toHaveBeenCalledWith('sync')
    })

    it('should call onSkipRestoration when skip button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
        />
      )

      const skipButton = screen.getByRole('button', { name: /skip restoration and start fresh/i })
      await user.click(skipButton)

      expect(mockOnSkipRestoration).toHaveBeenCalledTimes(1)
    })

    it('should not call onSelectMethod when unavailable option is clicked', async () => {
      const user = userEvent.setup()

      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          emailAvailable={false}
        />
      )

      const emailCard = screen.getByText('Email Backup Link').closest('[role="button"]') as HTMLElement
      await user.click(emailCard)

      expect(mockOnSelectMethod).not.toHaveBeenCalled()
    })

    it('should handle Enter key on option card', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          emailAvailable={true}
        />
      )

      const emailCard = screen.getByText('Email Backup Link').closest('[role="button"]') as HTMLElement
      fireEvent.keyDown(emailCard, { key: 'Enter' })

      expect(mockOnSelectMethod).toHaveBeenCalledWith('email')
    })

    it('should handle Space key on option card', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          fileAvailable={true}
        />
      )

      const fileCard = screen.getByText('Upload Backup File').closest('[role="button"]') as HTMLElement
      fireEvent.keyDown(fileCard, { key: ' ' })

      expect(mockOnSelectMethod).toHaveBeenCalledWith('file')
    })

    it('should not handle keyboard events on unavailable options', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          syncAvailable={false}
        />
      )

      const syncCard = screen.getByText('Connect to Sync Relay').closest('[role="button"]') as HTMLElement
      fireEvent.keyDown(syncCard, { key: 'Enter' })

      expect(mockOnSelectMethod).not.toHaveBeenCalled()
    })
  })

  describe('Loading State', () => {
    it('should show loading overlay when loading', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          loading={true}
        />
      )

      expect(screen.getByText(/loading restoration/i)).toBeInTheDocument()
    })

    it('should disable all buttons when loading', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          loading={true}
        />
      )

      // Get actual button elements (not card divs with role="button")
      const emailButton = screen.getByRole('button', { name: /select email backup link/i })
      const fileButton = screen.getByRole('button', { name: /select upload backup file/i })
      const syncButton = screen.getByRole('button', { name: /select connect to sync relay/i })
      const skipButton = screen.getByRole('button', { name: /skip restoration and start fresh/i })

      expect(emailButton).toBeDisabled()
      expect(fileButton).toBeDisabled()
      expect(syncButton).toBeDisabled()
      expect(skipButton).toBeDisabled()
    })

    it('should not call onSelectMethod when clicked during loading', async () => {
      const user = userEvent.setup()

      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          loading={true}
          emailAvailable={true}
        />
      )

      const emailCard = screen.getByText('Email Backup Link').closest('[role="button"]') as HTMLElement
      await user.click(emailCard)

      expect(mockOnSelectMethod).not.toHaveBeenCalled()
    })

    it('should not show loading overlay when not loading', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          loading={false}
        />
      )

      expect(screen.queryByText(/loading restoration/i)).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
        />
      )

      expect(screen.getByRole('main')).toHaveAttribute('aria-labelledby', 'restoration-title')
      expect(screen.getByRole('group', { name: /restoration methods/i })).toBeInTheDocument()
    })

    it('should have proper button labels', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
        />
      )

      expect(screen.getByLabelText(/select email backup link/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/select upload backup file/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/select connect to sync relay/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/skip restoration and start fresh/i)).toBeInTheDocument()
    })

    it('should have proper tabindex for available options', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          emailAvailable={true}
          fileAvailable={false}
        />
      )

      const emailCard = screen.getByText('Email Backup Link').closest('[role="button"]') as HTMLElement
      const fileCard = screen.getByText('Upload Backup File').closest('[role="button"]') as HTMLElement

      expect(emailCard).toHaveAttribute('tabindex', '0')
      expect(fileCard).toHaveAttribute('tabindex', '-1')
    })

    it('should have aria-disabled on unavailable options', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          emailAvailable={false}
        />
      )

      const emailCard = screen.getByText('Email Backup Link').closest('[role="button"]') as HTMLElement
      expect(emailCard).toHaveAttribute('aria-disabled', 'true')
    })

    it('should have role="status" on unavailable message', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          emailAvailable={false}
        />
      )

      const unavailableMessage = screen.getByText(/not available on this device/i)
      expect(unavailableMessage).toHaveAttribute('role', 'status')
    })

    it('should have aria-live on loading overlay', () => {
      render(
        <RestorationOptionsScreen
          onSelectMethod={mockOnSelectMethod}
          onSkipRestoration={mockOnSkipRestoration}
          loading={true}
        />
      )

      const loadingOverlay = screen.getByText(/loading restoration/i).closest('[role="status"]') as HTMLElement
      expect(loadingOverlay).toHaveAttribute('aria-live', 'polite')
    })
  })
})
