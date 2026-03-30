/**
 * Restore Success Page Component Tests
 *
 * Tests for the restoration success celebration page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RestoreSuccessPage } from './RestoreSuccessPage'

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('RestoreSuccessPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('content display', () => {
    it('should render success message', () => {
      render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      expect(screen.getByText(/Welcome Back!/i)).toBeInTheDocument()
      expect(
        screen.getByText(/Your backup has been restored successfully/i)
      ).toBeInTheDocument()
    })

    it('should display checkmark icon', () => {
      render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      const checkmark = screen.getByText('✓')
      expect(checkmark).toBeInTheDocument()
    })

    it('should show what was restored section', () => {
      render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      expect(screen.getByText(/What We Restored/i)).toBeInTheDocument()
      expect(screen.getByText(/Your chart of accounts/i)).toBeInTheDocument()
      expect(screen.getByText(/All transactions and journal entries/i)).toBeInTheDocument()
      expect(screen.getByText(/Customer and vendor contacts/i)).toBeInTheDocument()
      expect(screen.getByText(/Invoices and bills/i)).toBeInTheDocument()
      expect(screen.getByText(/All settings and preferences/i)).toBeInTheDocument()
    })

    it('should show next steps section', () => {
      render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      expect(screen.getByText(/What's Next\?/i)).toBeInTheDocument()
      expect(screen.getByText(/Take your time getting reacquainted/i)).toBeInTheDocument()
    })

    it('should display security notice', () => {
      render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      expect(
        screen.getByText(/the restoration link has been deactivated/i)
      ).toBeInTheDocument()
    })
  })

  describe('navigation', () => {
    it('should have dashboard button', () => {
      render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      const dashboardButton = screen.getByRole('button', { name: /Go to Dashboard/i })
      expect(dashboardButton).toBeInTheDocument()
    })

    it('should navigate to dashboard when button clicked', () => {
      render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      const dashboardButton = screen.getByRole('button', { name: /Go to Dashboard/i })
      fireEvent.click(dashboardButton)

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })

    it('should have button with correct type attribute', () => {
      render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      const dashboardButton = screen.getByRole('button', { name: /Go to Dashboard/i })
      expect(dashboardButton).toHaveAttribute('type', 'button')
    })
  })

  describe('Steadiness communication', () => {
    it('should use reassuring language', () => {
      render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      // Patient, supportive messaging
      expect(screen.getByText(/Take your time/i)).toBeInTheDocument()
      expect(screen.getByText(/safe and secure/i)).toBeInTheDocument()
    })

    it('should use celebration tone', () => {
      render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      expect(screen.getByText(/Welcome Back!/i)).toBeInTheDocument()
      expect(screen.getByText(/successfully/i)).toBeInTheDocument()
    })

    it('should not pressure user', () => {
      render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      // Should say "take your time" not "get started now"
      expect(screen.getByText(/Take your time/i)).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toHaveTextContent(/Welcome Back!/i)

      const h2Elements = screen.getAllByRole('heading', { level: 2 })
      expect(h2Elements).toHaveLength(2) // "What We Restored" and "What's Next?"
    })

    it('should have accessible button', () => {
      render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      const button = screen.getByRole('button', { name: /Go to Dashboard/i })
      expect(button).toBeInTheDocument()
    })

    it('should have list with proper semantic markup', () => {
      render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      const list = screen.getByRole('list')
      expect(list).toBeInTheDocument()

      const listItems = screen.getAllByRole('listitem')
      expect(listItems.length).toBeGreaterThan(0)
    })
  })

  describe('styling', () => {
    it('should apply page styles', () => {
      const { container } = render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      const page = container.querySelector('[class*="page"]')
      expect(page).toBeInTheDocument()
    })

    it('should apply success card styles', () => {
      const { container } = render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      const successCard = container.querySelector('[class*="successCard"]')
      expect(successCard).toBeInTheDocument()
    })

    it('should apply checkmark styles for animation', () => {
      const { container } = render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      const checkmark = container.querySelector('[class*="checkmark"]')
      expect(checkmark).toBeInTheDocument()
    })
  })

  describe('security messaging', () => {
    it('should include security icon in notice', () => {
      render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      const securityText = screen.getByText(/🔒/i)
      expect(securityText).toBeInTheDocument()
    })

    it('should explain link deactivation', () => {
      render(
        <MemoryRouter>
          <RestoreSuccessPage />
        </MemoryRouter>
      )

      expect(screen.getByText(/has been deactivated/i)).toBeInTheDocument()
      expect(screen.getByText(/cannot be used again/i)).toBeInTheDocument()
    })
  })
})
