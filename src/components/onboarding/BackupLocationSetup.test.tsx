/**
 * Tests for BackupLocationSetup Component
 *
 * Tests cover:
 * - Browser support detection
 * - Folder picker interaction
 * - Skip flow with warning
 * - Success state display
 * - Error handling
 * - Accessibility compliance
 * - User-friendly messaging (Steadiness style)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BackupLocationSetup } from './BackupLocationSetup'

describe('BackupLocationSetup', () => {
  let originalShowDirectoryPicker: any

  beforeEach(() => {
    // Store original value
    originalShowDirectoryPicker = (window as any).showDirectoryPicker
  })

  afterEach(() => {
    // Restore original value
    if (originalShowDirectoryPicker === undefined) {
      delete (window as any).showDirectoryPicker
    } else {
      ;(window as any).showDirectoryPicker = originalShowDirectoryPicker
    }
  })

  describe('Browser Support Detection', () => {
    it('should show unsupported browser message when File System Access API not available', () => {
      // Remove API support
      delete (window as any).showDirectoryPicker

      render(<BackupLocationSetup isOnboarding={true} />)

      expect(screen.getByText('Automatic Backups Not Available')).toBeInTheDocument()
      expect(
        screen.getByText(/Your browser doesn't support automatic local backups yet/i)
      ).toBeInTheDocument()
      expect(screen.getByText(/Google Chrome/i)).toBeInTheDocument()
      expect(screen.getByText(/Microsoft Edge/i)).toBeInTheDocument()
    })

    it('should show folder picker UI when File System Access API is available', () => {
      // Add API support
      ;(window as any).showDirectoryPicker = vi.fn()

      render(<BackupLocationSetup isOnboarding={true} />)

      expect(screen.getByText(/Let's Keep Your Data Safe/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Choose Backup Location/i })).toBeInTheDocument()
    })

    it('should show "Continue Setup" button in unsupported browser', () => {
      delete (window as any).showDirectoryPicker

      const onSkip = vi.fn()
      render(<BackupLocationSetup isOnboarding={true} onSkip={onSkip} />)

      const continueButton = screen.getByRole('button', { name: /Continue Setup/i })
      expect(continueButton).toBeInTheDocument()
    })
  })

  describe('Folder Selection Flow', () => {
    beforeEach(() => {
      // Mock File System Access API
      ;(window as any).showDirectoryPicker = vi.fn()
    })

    it('should render initial state with proper messaging', () => {
      render(<BackupLocationSetup isOnboarding={true} />)

      // Check for patient, supportive messaging (Steadiness style)
      expect(screen.getByText(/Let's Keep Your Data Safe/i)).toBeInTheDocument()
      expect(
        screen.getByText(/happens behind the scenes - you won't have to think about it again/i)
      ).toBeInTheDocument()

      // Check for "Why do I need this?" educational content
      expect(screen.getByText(/Why do I need this?/i)).toBeInTheDocument()

      // Check for features display
      expect(screen.getByText(/Bank-level encryption/i)).toBeInTheDocument()
      expect(screen.getByText(/Automatic and invisible/i)).toBeInTheDocument()
      expect(screen.getByText(/You're always in control/i)).toBeInTheDocument()
    })

    it('should call onComplete with directory path when folder is chosen', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()

      // Mock successful folder selection
      const mockHandle = { name: 'AudaciousBackups' }
      ;(window as any).showDirectoryPicker = vi.fn().mockResolvedValue(mockHandle)

      render(<BackupLocationSetup isOnboarding={true} onComplete={onComplete} />)

      const chooseButton = screen.getByRole('button', { name: /Choose Backup Location/i })
      await user.click(chooseButton)

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith('AudaciousBackups')
      })
    })

    it('should show success state after folder is selected', async () => {
      const user = userEvent.setup()

      const mockHandle = { name: 'MyBackups' }
      ;(window as any).showDirectoryPicker = vi.fn().mockResolvedValue(mockHandle)

      render(<BackupLocationSetup isOnboarding={true} />)

      const chooseButton = screen.getByRole('button', { name: /Choose Backup Location/i })
      await user.click(chooseButton)

      await waitFor(() => {
        expect(screen.getByText(/All Set!/i)).toBeInTheDocument()
        expect(screen.getByText(/Backups saving to:/i)).toBeInTheDocument()
        expect(screen.getByText('MyBackups')).toBeInTheDocument()
      })

      // Check for reassuring messaging
      expect(
        screen.getByText(/save automatically in the background/i)
      ).toBeInTheDocument()
    })

    it('should show loading state while folder picker is open', async () => {
      const user = userEvent.setup()

      // Mock slow picker response
      ;(window as any).showDirectoryPicker = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ name: 'Test' }), 100))
      )

      render(<BackupLocationSetup isOnboarding={true} />)

      const chooseButton = screen.getByRole('button', { name: /Choose Backup Location/i })
      await user.click(chooseButton)

      // Button should show loading state
      expect(chooseButton).toHaveAttribute('aria-busy', 'true')
      expect(chooseButton).toBeDisabled()
    })

    it('should handle user cancellation gracefully', async () => {
      const user = userEvent.setup()

      // Mock user cancelling the picker (AbortError)
      const abortError = new Error('User cancelled')
      abortError.name = 'AbortError'
      ;(window as any).showDirectoryPicker = vi.fn().mockRejectedValue(abortError)

      render(<BackupLocationSetup isOnboarding={true} />)

      const chooseButton = screen.getByRole('button', { name: /Choose Backup Location/i })
      await user.click(chooseButton)

      // Should return to normal state without error message
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Choose Backup Location/i })).toBeEnabled()
      })
    })

    it('should show error message for permission denied', async () => {
      const user = userEvent.setup()

      // Mock permission denied error
      const permissionError = new Error('Permission denied')
      permissionError.name = 'NotAllowedError'
      ;(window as any).showDirectoryPicker = vi.fn().mockRejectedValue(permissionError)

      render(<BackupLocationSetup isOnboarding={true} />)

      const chooseButton = screen.getByRole('button', { name: /Choose Backup Location/i })
      await user.click(chooseButton)

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert')
        expect(errorMessage).toBeInTheDocument()
        expect(errorMessage).toHaveTextContent(
          /couldn't access that folder.*try again/i
        )
      })
    })
  })

  describe('Skip Flow', () => {
    beforeEach(() => {
      ;(window as any).showDirectoryPicker = vi.fn()
    })

    it('should show skip warning when "I\'ll do this later" is clicked', async () => {
      const user = userEvent.setup()

      render(<BackupLocationSetup isOnboarding={true} />)

      const skipButton = screen.getByRole('button', { name: /I'll do this later/i })
      await user.click(skipButton)

      expect(screen.getByText(/Are you sure?/i)).toBeInTheDocument()
      expect(
        screen.getByText(/Without automatic backups, you could lose your financial data/i)
      ).toBeInTheDocument()
    })

    it('should show "Go Back" and "Skip Anyway" buttons in warning state', async () => {
      const user = userEvent.setup()

      render(<BackupLocationSetup isOnboarding={true} />)

      const skipButton = screen.getByRole('button', { name: /I'll do this later/i })
      await user.click(skipButton)

      expect(screen.getByRole('button', { name: /Go Back/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Skip Anyway/i })).toBeInTheDocument()
    })

    it('should return to main UI when "Go Back" is clicked', async () => {
      const user = userEvent.setup()

      render(<BackupLocationSetup isOnboarding={true} />)

      // Show warning
      const skipButton = screen.getByRole('button', { name: /I'll do this later/i })
      await user.click(skipButton)

      // Go back
      const goBackButton = screen.getByRole('button', { name: /Go Back/i })
      await user.click(goBackButton)

      // Should be back to main UI
      expect(screen.getByText(/Let's Keep Your Data Safe/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Choose Backup Location/i })).toBeInTheDocument()
    })

    it('should call onSkip when "Skip Anyway" is clicked', async () => {
      const user = userEvent.setup()
      const onSkip = vi.fn()

      render(<BackupLocationSetup isOnboarding={true} onSkip={onSkip} />)

      // Show warning
      const skipButton = screen.getByRole('button', { name: /I'll do this later/i })
      await user.click(skipButton)

      // Skip anyway
      const skipAnywayButton = screen.getByRole('button', { name: /Skip Anyway/i })
      await user.click(skipAnywayButton)

      expect(onSkip).toHaveBeenCalled()
    })

    it('should not show skip button when not in onboarding mode', () => {
      ;(window as any).showDirectoryPicker = vi.fn()

      render(<BackupLocationSetup isOnboarding={false} />)

      expect(screen.queryByRole('button', { name: /I'll do this later/i })).not.toBeInTheDocument()
    })
  })

  describe('Success State', () => {
    beforeEach(() => {
      ;(window as any).showDirectoryPicker = vi.fn()
    })

    it('should display initial path when provided', () => {
      render(
        <BackupLocationSetup
          isOnboarding={true}
          initialPath="Documents/MyBackups"
        />
      )

      expect(screen.getByText(/All Set!/i)).toBeInTheDocument()
      expect(screen.getByText('Documents/MyBackups')).toBeInTheDocument()
    })

    it('should show continue button in onboarding mode', async () => {
      const user = userEvent.setup()

      const mockHandle = { name: 'Backups' }
      ;(window as any).showDirectoryPicker = vi.fn().mockResolvedValue(mockHandle)

      render(<BackupLocationSetup isOnboarding={true} />)

      const chooseButton = screen.getByRole('button', { name: /Choose Backup Location/i })
      await user.click(chooseButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument()
      })
    })

    it('should not show continue button when not in onboarding mode', async () => {
      const user = userEvent.setup()

      const mockHandle = { name: 'Backups' }
      ;(window as any).showDirectoryPicker = vi.fn().mockResolvedValue(mockHandle)

      render(<BackupLocationSetup isOnboarding={false} />)

      const chooseButton = screen.getByRole('button', { name: /Choose Backup Location/i })
      await user.click(chooseButton)

      await waitFor(() => {
        expect(screen.getByText(/All Set!/i)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Continue/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    beforeEach(() => {
      ;(window as any).showDirectoryPicker = vi.fn()
    })

    it('should have proper ARIA labels for icons', () => {
      render(<BackupLocationSetup isOnboarding={true} />)

      const icons = screen.getAllByLabelText('', { hidden: true })
      icons.forEach(icon => {
        expect(icon).toHaveAttribute('aria-hidden', 'true')
      })
    })

    it('should have role="alert" for error messages', async () => {
      const user = userEvent.setup()

      const error = new Error('Test error')
      error.name = 'UnknownError'
      ;(window as any).showDirectoryPicker = vi.fn().mockRejectedValue(error)

      render(<BackupLocationSetup isOnboarding={true} />)

      const chooseButton = screen.getByRole('button', { name: /Choose Backup Location/i })
      await user.click(chooseButton)

      await waitFor(() => {
        const errorBox = screen.getByRole('alert')
        expect(errorBox).toHaveAttribute('aria-live', 'polite')
      })
    })

    it('should have role="status" for success path display', async () => {
      const user = userEvent.setup()

      const mockHandle = { name: 'Test' }
      ;(window as any).showDirectoryPicker = vi.fn().mockResolvedValue(mockHandle)

      render(<BackupLocationSetup isOnboarding={true} />)

      const chooseButton = screen.getByRole('button', { name: /Choose Backup Location/i })
      await user.click(chooseButton)

      await waitFor(() => {
        const pathDisplay = screen.getByRole('status')
        expect(pathDisplay).toHaveAttribute('aria-live', 'polite')
      })
    })

    it('should have proper button states during loading', async () => {
      const user = userEvent.setup()

      ;(window as any).showDirectoryPicker = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ name: 'Test' }), 100))
      )

      render(<BackupLocationSetup isOnboarding={true} />)

      const chooseButton = screen.getByRole('button', { name: /Choose Backup Location/i })
      await user.click(chooseButton)

      expect(chooseButton).toBeDisabled()
      expect(chooseButton).toHaveAttribute('aria-busy', 'true')

      const skipButton = screen.queryByRole('button', { name: /I'll do this later/i })
      if (skipButton) {
        expect(skipButton).toBeDisabled()
      }
    })
  })

  describe('Messaging (Steadiness Style)', () => {
    beforeEach(() => {
      ;(window as any).showDirectoryPicker = vi.fn()
    })

    it('should use patient, supportive language', () => {
      render(<BackupLocationSetup isOnboarding={true} />)

      // Patient messaging
      expect(screen.getByText(/Take your time/i, { exact: false })).toBeTruthy()
      expect(screen.getByText(/won't have to think about it again/i)).toBeInTheDocument()

      // Reassuring messaging
      expect(screen.getByText(/your data is always safe/i, { exact: false })).toBeTruthy()
      expect(screen.getByText(/You're always in control/i)).toBeInTheDocument()
    })

    it('should not blame user in error messages', async () => {
      const user = userEvent.setup()

      const error = new Error('Permission denied')
      error.name = 'NotAllowedError'
      ;(window as any).showDirectoryPicker = vi.fn().mockRejectedValue(error)

      render(<BackupLocationSetup isOnboarding={true} />)

      const chooseButton = screen.getByRole('button', { name: /Choose Backup Location/i })
      await user.click(chooseButton)

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert')
        // Error message should be helpful, not blaming
        expect(errorMessage.textContent).toMatch(/couldn't access.*try again/i)
        expect(errorMessage.textContent).not.toMatch(/invalid|failed|wrong/i)
      })
    })

    it('should emphasize user control and data sovereignty', () => {
      render(<BackupLocationSetup isOnboarding={true} />)

      expect(screen.getByText(/your data, your control/i, { exact: false })).toBeTruthy()
      expect(screen.getByText(/you can see the backup files right on your computer/i, {
        exact: false
      })).toBeTruthy()
    })
  })
})
