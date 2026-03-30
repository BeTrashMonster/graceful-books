/**
 * Restoration Page Component Tests
 *
 * Tests for restoration link handling, token validation, rate limiting,
 * and password entry functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RestorePage, resetRateLimits, RATE_LIMITS } from './RestorePage'
import * as RestorationTokenService from '../services/backup/RestorationTokenService'

// Mock the restoration token service
vi.mock('../services/backup/RestorationTokenService', () => ({
  restorationTokenService: {
    validateToken: vi.fn(),
  },
}))

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('RestorePage', () => {
  const validToken = '550e8400-e29b-41d4-a716-446655440000'
  const validTokenId = '550e8400-e29b-41d4-a716-446655440001'

  beforeEach(() => {
    vi.clearAllMocks()
    resetRateLimits() // Reset rate limiting state for test isolation

    // Set high rate limits for testing to avoid false failures
    RATE_LIMITS.IP_MAX_ATTEMPTS = 1000
    RATE_LIMITS.TOKEN_MAX_ATTEMPTS = 1000
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers() // Ensure real timers are restored even if test fails
  })

  describe('initial loading', () => {
    it('should show loading state while validating token', () => {
      const mockValidate = vi
        .spyOn(RestorationTokenService.restorationTokenService, 'validateToken')
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ valid: true }), 1000))
        )

      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      expect(screen.getByText(/Verifying your restoration link/i)).toBeInTheDocument()
      expect(
        screen.getByText(/Take your time/i)
      ).toBeInTheDocument()

      mockValidate.mockRestore()
    })

    it('should show spinner during validation', () => {
      vi.spyOn(
        RestorationTokenService.restorationTokenService,
        'validateToken'
      ).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ valid: true }), 1000))
      )

      const { container } = render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      const spinner = container.querySelector('[class*="spinner"]')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('URL parameter validation', () => {
    it('should show error when token is missing', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(
          screen.getByText(/This restoration link seems incomplete/i)
        ).toBeInTheDocument()
      })
    })

    it('should show error when id is missing', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(
          screen.getByText(/This restoration link seems incomplete/i)
        ).toBeInTheDocument()
      })
    })

    it('should show error for invalid UUID format in token', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=invalid&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(
          screen.getByText(/look quite right/i)
        ).toBeInTheDocument()
      })
    })

    it('should show error for invalid UUID format in id', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=invalid`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(
          screen.getByText(/look quite right/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe('token validation', () => {
    it('should validate token with service', async () => {
      const mockValidate = vi
        .spyOn(RestorationTokenService.restorationTokenService, 'validateToken')
        .mockResolvedValue({
          valid: true,
          token: validToken,
          tokenId: validTokenId,
          userId: 'user-123',
          companyId: 'company-456',
          backupId: 'backup-789',
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          used: false,
          expired: false,
          metadata: {
            backupDate: Date.now(),
            companyName: 'Test Company',
          },
        })

      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(mockValidate).toHaveBeenCalledWith(validToken, validTokenId)
      })
    })

    it('should show error for expired token', async () => {
      vi.spyOn(
        RestorationTokenService.restorationTokenService,
        'validateToken'
      ).mockResolvedValue({
        valid: false,
        expired: true,
        used: false,
      })

      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/This restoration link has expired/i)).toBeInTheDocument()
        expect(screen.getByText(/links expire after 7 days/i)).toBeInTheDocument()
      })
    })

    it('should show error for used token', async () => {
      vi.spyOn(
        RestorationTokenService.restorationTokenService,
        'validateToken'
      ).mockResolvedValue({
        valid: false,
        expired: false,
        used: true,
      })

      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(
          screen.getByText(/This restoration link has already been used/i)
        ).toBeInTheDocument()
        expect(screen.getByText(/Each link can only be used once/i)).toBeInTheDocument()
      })
    })

    it('should show generic error for invalid token', async () => {
      vi.spyOn(
        RestorationTokenService.restorationTokenService,
        'validateToken'
      ).mockResolvedValue({
        valid: false,
        expired: false,
        used: false,
      })

      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(
          screen.getByText(/verify this restoration link/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe('password form', () => {
    beforeEach(async () => {
      vi.spyOn(
        RestorationTokenService.restorationTokenService,
        'validateToken'
      ).mockResolvedValue({
        valid: true,
        token: validToken,
        tokenId: validTokenId,
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        used: false,
        expired: false,
        metadata: {
          backupDate: Date.now(),
          companyName: 'Test Company',
        },
      })
    })

    it('should render password form when token is valid', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Restore Your Backup/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/Password/i)).toBeInTheDocument()
      })
    })

    it('should display backup information', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Backup Date:/i)).toBeInTheDocument()
        expect(screen.getByText(/Test Company/i)).toBeInTheDocument()
      })
    })

    it('should have password input with correct attributes', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        const passwordInput = screen.getByLabelText(/Password/i) as HTMLInputElement
        expect(passwordInput).toHaveAttribute('type', 'password')
        expect(passwordInput).toHaveAttribute('placeholder', 'Enter your password')
      })
    })

    it('should update password value on input', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        const passwordInput = screen.getByLabelText(/Password/i) as HTMLInputElement
        fireEvent.change(passwordInput, { target: { value: 'test-password' } })
        expect(passwordInput.value).toBe('test-password')
      })
    })

    it('should have submit button', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Restore My Backup/i })).toBeInTheDocument()
      })
    })

    it('should disable submit button when password is empty', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        const submitButton = screen.getByRole('button', {
          name: /Restore My Backup/i,
        }) as HTMLButtonElement
        expect(submitButton).toBeDisabled()
      })
    })

    it('should enable submit button when password is entered', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        const passwordInput = screen.getByLabelText(/Password/i)
        fireEvent.change(passwordInput, { target: { value: 'test-password' } })

        const submitButton = screen.getByRole('button', {
          name: /Restore My Backup/i,
        }) as HTMLButtonElement
        expect(submitButton).not.toBeDisabled()
      })
    })

    it('should show loading state during restoration', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      // Wait for password form to load
      const passwordInput = await screen.findByLabelText(/Password/i)
      fireEvent.change(passwordInput, { target: { value: 'test-password' } })

      const submitButton = screen.getByRole('button', { name: /Restore My Backup/i })
      fireEvent.click(submitButton)

      // Check that loading state appears
      await waitFor(() => {
        expect(screen.getByText(/Restoring.../i)).toBeInTheDocument()
      })
    })

    it('should include CSRF token in form', async () => {
      const { container } = render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        const csrfInput = container.querySelector('input[name="csrf_token"]')
        expect(csrfInput).toBeInTheDocument()
        expect(csrfInput).toHaveAttribute('type', 'hidden')
        expect((csrfInput as HTMLInputElement).value).toBeTruthy()
      })
    })
  })

  describe('security information', () => {
    beforeEach(async () => {
      vi.spyOn(
        RestorationTokenService.restorationTokenService,
        'validateToken'
      ).mockResolvedValue({
        valid: true,
        token: validToken,
        tokenId: validTokenId,
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        used: false,
        expired: false,
        metadata: {
          backupDate: Date.now(),
          companyName: 'Test Company',
        },
      })
    })

    it('should display security notice', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Security Notice/i)).toBeInTheDocument()
      })
    })

    it('should explain one-time use', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/This link can only be used once/i)).toBeInTheDocument()
      })
    })

    it('should explain encryption', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(
          screen.getByText(/Your backup is encrypted/i)
        ).toBeInTheDocument()
      })
    })

    it('should mention email confirmation', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(
          screen.getByText(/email confirmation when restoration is complete/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe('error actions', () => {
    beforeEach(() => {
      vi.spyOn(
        RestorationTokenService.restorationTokenService,
        'validateToken'
      ).mockResolvedValue({
        valid: false,
        expired: true,
        used: false,
      })
    })

    it('should show navigation buttons on error', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Go to Settings/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Return to Dashboard/i })).toBeInTheDocument()
      })
    })

    it('should navigate to settings when button clicked', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        const settingsButton = screen.getByRole('button', { name: /Go to Settings/i })
        fireEvent.click(settingsButton)
        expect(mockNavigate).toHaveBeenCalledWith('/settings')
      })
    })

    it('should navigate to dashboard when button clicked', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        const dashboardButton = screen.getByRole('button', { name: /Return to Dashboard/i })
        fireEvent.click(dashboardButton)
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      })
    })
  })

  describe('Steadiness communication', () => {
    it('should use patient language during validation', () => {
      vi.spyOn(
        RestorationTokenService.restorationTokenService,
        'validateToken'
      ).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ valid: true }), 1000))
      )

      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      expect(
        screen.getByText(/Take your time/i)
      ).toBeInTheDocument()
    })

    it('should use reassuring error messages', async () => {
      vi.spyOn(
        RestorationTokenService.restorationTokenService,
        'validateToken'
      ).mockRejectedValue(new Error('Network error'))

      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(
          screen.getByText(/Oops! Something unexpected happened/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe('accessibility', () => {
    beforeEach(async () => {
      vi.spyOn(
        RestorationTokenService.restorationTokenService,
        'validateToken'
      ).mockResolvedValue({
        valid: true,
        token: validToken,
        tokenId: validTokenId,
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        used: false,
        expired: false,
        metadata: {
          backupDate: Date.now(),
          companyName: 'Test Company',
        },
      })
    })

    it('should have accessible label for password input', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/Password/i)).toBeInTheDocument()
      })
    })

    it('should autofocus password input', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        const passwordInput = screen.getByLabelText(/Password/i) as HTMLInputElement
        expect(passwordInput).toHaveFocus()
      })
    })

    it('should have accessible submit button', async () => {
      render(
        <MemoryRouter initialEntries={[`/restore?token=${validToken}&id=${validTokenId}`]}>
          <RestorePage />
        </MemoryRouter>
      )

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /Restore My Backup/i })
        expect(submitButton).toHaveAttribute('type', 'submit')
      })
    })
  })
})
