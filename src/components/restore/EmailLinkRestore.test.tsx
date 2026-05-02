/**
 * Email Link Restore Tests
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 5, Task 5.3:
 * Comprehensive tests for email link restoration flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmailLinkRestore } from './EmailLinkRestore'

describe('EmailLinkRestore', () => {
  const mockOnSuccess = vi.fn()
  const mockOnBack = vi.fn()

  const mockRestorationService = {
    validateRestorationLink: vi.fn(),
    restoreFromEmailLink: vi.fn(),
  }

  beforeEach(() => {
    mockOnSuccess.mockClear()
    mockOnBack.mockClear()
    mockRestorationService.validateRestorationLink.mockClear()
    mockRestorationService.restoreFromEmailLink.mockClear()

    // Default to successful validation and restoration
    mockRestorationService.validateRestorationLink.mockResolvedValue({ valid: true })
    mockRestorationService.restoreFromEmailLink.mockResolvedValue(undefined)

    // Clear timers
    vi.clearAllTimers()
  })

  describe('Link Input Step', () => {
    it('should render link input form', () => {
      render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      expect(screen.getByRole('heading', { name: /paste your restoration link/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/restoration link/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
    })

    it('should allow user to input restoration link', async () => {
      const user = userEvent.setup()

      render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const input = screen.getByLabelText(/restoration link/i)
      const testLink = 'https://app.gracefulbooks.com/restore?token=abc123&backup=xyz789'

      await user.type(input, testLink)

      expect(input).toHaveValue(testLink)
    })

    it('should call onBack when back button clicked', async () => {
      const user = userEvent.setup()

      render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const backButton = screen.getByRole('button', { name: /back/i })
      await user.click(backButton)

      expect(mockOnBack).toHaveBeenCalledTimes(1)
    })

    it('should disable continue button when link is empty', () => {
      render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const continueButton = screen.getByRole('button', { name: /continue/i })
      expect(continueButton).toBeDisabled()
    })

    it('should enable continue button when link is entered', async () => {
      const user = userEvent.setup()

      render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const input = screen.getByLabelText(/restoration link/i)
      await user.type(input, 'https://app.gracefulbooks.com/restore?token=abc&backup=xyz')

      const continueButton = screen.getByRole('button', { name: /continue/i })
      expect(continueButton).not.toBeDisabled()
    })

    it('should show error for invalid link format', async () => {
      const user = userEvent.setup()

      render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const input = screen.getByLabelText(/restoration link/i)
      await user.type(input, 'not-a-valid-url')

      const continueButton = screen.getByRole('button', { name: /continue/i })
      await user.click(continueButton)

      expect(await screen.findByRole('alert')).toHaveTextContent(/invalid restoration link/i)
    })

    it('should show error for link missing token parameter', async () => {
      const user = userEvent.setup()

      render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const input = screen.getByLabelText(/restoration link/i)
      await user.type(input, 'https://app.gracefulbooks.com/restore?backup=xyz')

      const continueButton = screen.getByRole('button', { name: /continue/i })
      await user.click(continueButton)

      expect(await screen.findByRole('alert')).toHaveTextContent(/invalid restoration link/i)
    })

    it('should show error for link missing backup parameter', async () => {
      const user = userEvent.setup()

      render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const input = screen.getByLabelText(/restoration link/i)
      await user.type(input, 'https://app.gracefulbooks.com/restore?token=abc')

      const continueButton = screen.getByRole('button', { name: /continue/i })
      await user.click(continueButton)

      expect(await screen.findByRole('alert')).toHaveTextContent(/invalid restoration link/i)
    })

    it('should validate link with restoration service', async () => {
      const user = userEvent.setup()

      render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const input = screen.getByLabelText(/restoration link/i)
      const testLink = 'https://app.gracefulbooks.com/restore?token=abc123&backup=xyz789'
      await user.type(input, testLink)

      const continueButton = screen.getByRole('button', { name: /continue/i })
      await user.click(continueButton)

      await waitFor(() => {
        expect(mockRestorationService.validateRestorationLink).toHaveBeenCalledWith(testLink)
      })
    })

    it('should show error when validation fails', async () => {
      const user = userEvent.setup()

      mockRestorationService.validateRestorationLink.mockResolvedValue({
        valid: false,
        error: 'Link expired',
      })

      render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const input = screen.getByLabelText(/restoration link/i)
      await user.type(input, 'https://app.gracefulbooks.com/restore?token=abc&backup=xyz')

      const continueButton = screen.getByRole('button', { name: /continue/i })
      await user.click(continueButton)

      expect(await screen.findByRole('alert')).toHaveTextContent(/link expired/i)
    })

    it('should proceed to password step after successful validation', async () => {
      const user = userEvent.setup()

      render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const input = screen.getByLabelText(/restoration link/i)
      await user.type(input, 'https://app.gracefulbooks.com/restore?token=abc&backup=xyz')

      const continueButton = screen.getByRole('button', { name: /continue/i })
      await user.click(continueButton)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /enter your password/i })).toBeInTheDocument()
      })
    })
  })

  describe('Password Input Step', () => {
    beforeEach(async () => {
      // Fast-forward to password step
      const user = userEvent.setup()

      const { rerender: _rerender } = render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const input = screen.getByLabelText(/restoration link/i)
      await user.type(input, 'https://app.gracefulbooks.com/restore?token=abc&backup=xyz')

      const continueButton = screen.getByRole('button', { name: /continue/i })
      await user.click(continueButton)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /enter your password/i })).toBeInTheDocument()
      })
    })

    it('should render password input form', () => {
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /restore my data/i })).toBeInTheDocument()
    })

    it('should allow user to input password', async () => {
      const user = userEvent.setup()

      const passwordInput = screen.getByLabelText(/^password$/i)
      await user.type(passwordInput, 'test-password-123')

      expect(passwordInput).toHaveValue('test-password-123')
    })

    it('should go back to link step when back button clicked', async () => {
      const user = userEvent.setup()

      const backButton = screen.getByRole('button', { name: /back/i })
      await user.click(backButton)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /paste your restoration link/i })).toBeInTheDocument()
      })
    })

    it('should disable restore button when password is empty', () => {
      const restoreButton = screen.getByRole('button', { name: /restore my data/i })
      expect(restoreButton).toBeDisabled()
    })

    it('should enable restore button when password is entered', async () => {
      const user = userEvent.setup()

      const passwordInput = screen.getByLabelText(/^password$/i)
      await user.type(passwordInput, 'test-password')

      const restoreButton = screen.getByRole('button', { name: /restore my data/i })
      expect(restoreButton).not.toBeDisabled()
    })

    it('should call restoration service with link and password', async () => {
      const user = userEvent.setup()

      const passwordInput = screen.getByLabelText(/^password$/i)
      await user.type(passwordInput, 'test-password-123')

      const restoreButton = screen.getByRole('button', { name: /restore my data/i })
      await user.click(restoreButton)

      await waitFor(() => {
        expect(mockRestorationService.restoreFromEmailLink).toHaveBeenCalledWith(
          'https://app.gracefulbooks.com/restore?token=abc&backup=xyz',
          'test-password-123'
        )
      })
    })

    it('should show loading state during restoration', async () => {
      const user = userEvent.setup()

      mockRestorationService.restoreFromEmailLink.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      )

      const passwordInput = screen.getByLabelText(/^password$/i)
      await user.type(passwordInput, 'test-password')

      const restoreButton = screen.getByRole('button', { name: /restore my data/i })
      await user.click(restoreButton)

      await waitFor(() => {
        expect(screen.getByText(/restoring your data/i)).toBeInTheDocument()
      })
    })

    it('should show success after successful restoration', async () => {
      const user = userEvent.setup()
      vi.useFakeTimers()

      const passwordInput = screen.getByLabelText(/^password$/i)
      await user.type(passwordInput, 'test-password')

      const restoreButton = screen.getByRole('button', { name: /restore my data/i })
      await user.click(restoreButton)

      await waitFor(() => {
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument()
      })

      vi.useRealTimers()
    })

    it('should call onSuccess after success celebration', async () => {
      const user = userEvent.setup()
      vi.useFakeTimers()

      const passwordInput = screen.getByLabelText(/^password$/i)
      await user.type(passwordInput, 'test-password')

      const restoreButton = screen.getByRole('button', { name: /restore my data/i })
      await user.click(restoreButton)

      await waitFor(() => {
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument()
      })

      // Fast-forward celebration timeout
      vi.advanceTimersByTime(3000)

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1)
      })

      vi.useRealTimers()
    })

    it('should show error on restoration failure', async () => {
      const user = userEvent.setup()

      mockRestorationService.restoreFromEmailLink.mockRejectedValue(
        new Error('Incorrect password')
      )

      const passwordInput = screen.getByLabelText(/^password$/i)
      await user.type(passwordInput, 'wrong-password')

      const restoreButton = screen.getByRole('button', { name: /restore my data/i })
      await user.click(restoreButton)

      await waitFor(() => {
        expect(screen.getByText(/restoration failed/i)).toBeInTheDocument()
        expect(screen.getByText(/incorrect password/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error State', () => {
    it('should allow retry after error', async () => {
      const user = userEvent.setup()

      mockRestorationService.restoreFromEmailLink
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined)

      // Navigate to password step
      const { rerender: _rerender } = render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const linkInput = screen.getByLabelText(/restoration link/i)
      await user.type(linkInput, 'https://app.gracefulbooks.com/restore?token=abc&backup=xyz')

      const continueButton = screen.getByRole('button', { name: /continue/i })
      await user.click(continueButton)

      await waitFor(() => {
        expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
      })

      // Enter password and fail
      const passwordInput = screen.getByLabelText(/^password$/i)
      await user.type(passwordInput, 'test-password')

      const restoreButton = screen.getByRole('button', { name: /restore my data/i })
      await user.click(restoreButton)

      await waitFor(() => {
        expect(screen.getByText(/restoration failed/i)).toBeInTheDocument()
      })

      // Retry
      const retryButton = screen.getByRole('button', { name: /try again/i })
      await user.click(retryButton)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /enter your password/i })).toBeInTheDocument()
      })
    })

    it('should allow going back to select another method', async () => {
      const user = userEvent.setup()

      mockRestorationService.restoreFromEmailLink.mockRejectedValue(
        new Error('Backup corrupted')
      )

      // Navigate through to error state
      const { rerender: _rerender } = render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const linkInput = screen.getByLabelText(/restoration link/i)
      await user.type(linkInput, 'https://app.gracefulbooks.com/restore?token=abc&backup=xyz')
      await user.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() => {
        expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
      })

      const passwordInput = screen.getByLabelText(/^password$/i)
      await user.type(passwordInput, 'test-password')
      await user.click(screen.getByRole('button', { name: /restore my data/i }))

      await waitFor(() => {
        expect(screen.getByText(/restoration failed/i)).toBeInTheDocument()
      })

      // Go back
      const backButton = screen.getByRole('button', { name: /try another method/i })
      await user.click(backButton)

      expect(mockOnBack).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const input = screen.getByLabelText(/restoration link/i)
      expect(input).toHaveAttribute('id', 'restoration-link')
    })

    it('should mark invalid input with aria-invalid', async () => {
      const user = userEvent.setup()

      render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const input = screen.getByLabelText(/restoration link/i)
      await user.type(input, 'invalid-url')
      await user.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-invalid', 'true')
      })
    })

    it('should associate error with input via aria-describedby', async () => {
      const user = userEvent.setup()

      render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const input = screen.getByLabelText(/restoration link/i)
      await user.type(input, 'invalid-url')
      await user.click(screen.getByRole('button', { name: /continue/i }))

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-describedby', 'link-error')
        expect(screen.getByRole('alert')).toHaveAttribute('id', 'link-error')
      })
    })

    it('should focus first input on mount', () => {
      render(
        <EmailLinkRestore
          onSuccess={mockOnSuccess}
          onBack={mockOnBack}
          restorationService={mockRestorationService}
        />
      )

      const input = screen.getByLabelText(/restoration link/i)
      expect(input).toHaveAttribute('autoFocus')
    })
  })
})
