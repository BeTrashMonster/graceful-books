/**
 * VendorCard Component Tests
 *
 * Tests for individual vendor card display and interactions.
 *
 * Per D5: Vendor Management - Basic [MVP]
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VendorCard, type VendorCardProps } from './VendorCard'
import type { Vendor } from '../../types/vendor.types'

describe('VendorCard', () => {
  const mockOnEdit = vi.fn()
  const mockOnDelete = vi.fn()
  const mockOnClick = vi.fn()

  const createMockVendor = (overrides?: Partial<Vendor>): Vendor => ({
    id: 'vendor-123',
    companyId: 'company-123',
    type: 'vendor',
    name: 'Test Vendor',
    email: 'test@example.com',
    phone: '555-1234',
    address: {
      line1: '123 Main St',
      line2: 'Suite 100',
      city: 'Test City',
      state: 'TS',
      postalCode: '12345',
      country: 'US',
    },
    taxId: '12-3456789',
    is1099Eligible: true,
    notes: 'Test notes about this vendor',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  const defaultProps: VendorCardProps = {
    vendor: createMockVendor(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Vendor Information Display', () => {
    it('should display vendor name', () => {
      render(<VendorCard {...defaultProps} />)

      expect(screen.getByText('Test Vendor')).toBeInTheDocument()
    })

    it('should display email with mailto link', () => {
      render(<VendorCard {...defaultProps} />)

      const emailLink = screen.getByRole('link', { name: /test@example\.com/i })
      expect(emailLink).toHaveAttribute('href', 'mailto:test@example.com')
    })

    it('should display phone with tel link', () => {
      render(<VendorCard {...defaultProps} />)

      const phoneLink = screen.getByRole('link', { name: /555-1234/i })
      expect(phoneLink).toHaveAttribute('href', 'tel:555-1234')
    })

    it('should display formatted address in default variant', () => {
      render(<VendorCard {...defaultProps} variant="default" />)

      expect(screen.getByText(/123 Main St/i)).toBeInTheDocument()
    })

    it('should display tax ID in default variant', () => {
      render(<VendorCard {...defaultProps} variant="default" />)

      expect(screen.getByText(/tax id: 12-3456789/i)).toBeInTheDocument()
    })

    it('should display notes in default variant', () => {
      render(<VendorCard {...defaultProps} variant="default" />)

      expect(screen.getByText(/test notes about this vendor/i)).toBeInTheDocument()
    })

    it('should hide address in compact variant', () => {
      render(<VendorCard {...defaultProps} variant="compact" />)

      expect(screen.queryByText(/123 Main St/i)).not.toBeInTheDocument()
    })

    it('should hide tax ID in compact variant', () => {
      render(<VendorCard {...defaultProps} variant="compact" />)

      expect(screen.queryByText(/tax id/i)).not.toBeInTheDocument()
    })

    it('should hide notes in compact variant', () => {
      render(<VendorCard {...defaultProps} variant="compact" />)

      expect(screen.queryByText(/test notes/i)).not.toBeInTheDocument()
    })
  })

  describe('Status Badges', () => {
    it('should show inactive badge when vendor is inactive', () => {
      const inactiveVendor = createMockVendor({ isActive: false })

      render(<VendorCard {...defaultProps} vendor={inactiveVendor} />)

      expect(screen.getByText('Inactive')).toBeInTheDocument()
      expect(screen.getByLabelText(/inactive vendor/i)).toBeInTheDocument()
    })

    it('should not show inactive badge when vendor is active', () => {
      const activeVendor = createMockVendor({ isActive: true })

      render(<VendorCard {...defaultProps} vendor={activeVendor} />)

      expect(screen.queryByText('Inactive')).not.toBeInTheDocument()
    })

    it('should show 1099 badge when vendor is 1099 eligible', () => {
      render(<VendorCard {...defaultProps} />)

      expect(screen.getByText('1099')).toBeInTheDocument()
      expect(screen.getByLabelText(/1099 eligible vendor/i)).toBeInTheDocument()
    })

    it('should not show 1099 badge when vendor is not eligible', () => {
      const nonEligibleVendor = createMockVendor({ is1099Eligible: false })

      render(<VendorCard {...defaultProps} vendor={nonEligibleVendor} />)

      expect(screen.queryByText('1099')).not.toBeInTheDocument()
    })
  })

  describe('Action Buttons', () => {
    it('should show action buttons when showActions is true', () => {
      render(
        <VendorCard
          {...defaultProps}
          showActions={true}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      )

      expect(screen.getByRole('button', { name: /edit test vendor/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete test vendor/i })).toBeInTheDocument()
    })

    it('should not show action buttons when showActions is false', () => {
      render(<VendorCard {...defaultProps} showActions={false} />)

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    })

    it('should call onEdit when edit button is clicked', async () => {
      const user = userEvent.setup()
      const vendor = createMockVendor()

      render(
        <VendorCard
          {...defaultProps}
          vendor={vendor}
          showActions={true}
          onEdit={mockOnEdit}
        />
      )

      await user.click(screen.getByRole('button', { name: /edit/i }))

      expect(mockOnEdit).toHaveBeenCalledWith(vendor)
    })

    it('should call onDelete when delete button is clicked', async () => {
      const user = userEvent.setup()
      const vendor = createMockVendor()

      render(
        <VendorCard
          {...defaultProps}
          vendor={vendor}
          showActions={true}
          onDelete={mockOnDelete}
        />
      )

      await user.click(screen.getByRole('button', { name: /delete/i }))

      expect(mockOnDelete).toHaveBeenCalledWith(vendor)
    })

    it('should not propagate click event when action buttons are clicked', async () => {
      const user = userEvent.setup()

      render(
        <VendorCard
          {...defaultProps}
          showActions={true}
          onEdit={mockOnEdit}
          onClick={mockOnClick}
        />
      )

      await user.click(screen.getByRole('button', { name: /edit/i }))

      expect(mockOnEdit).toHaveBeenCalledTimes(1)
      expect(mockOnClick).not.toHaveBeenCalled()
    })
  })

  describe('Click Behavior', () => {
    it('should call onClick when card is clicked', async () => {
      const user = userEvent.setup()
      const vendor = createMockVendor()

      render(<VendorCard {...defaultProps} vendor={vendor} onClick={mockOnClick} />)

      const card = screen.getByRole('button', { name: /vendor: test vendor/i })
      await user.click(card)

      expect(mockOnClick).toHaveBeenCalledWith(vendor)
    })

    it('should be keyboard accessible when clickable', async () => {
      const user = userEvent.setup()
      const vendor = createMockVendor()

      render(<VendorCard {...defaultProps} vendor={vendor} onClick={mockOnClick} />)

      const card = screen.getByRole('button', { name: /vendor: test vendor/i })

      // Test Enter key
      card.focus()
      await user.keyboard('{Enter}')
      expect(mockOnClick).toHaveBeenCalledTimes(1)

      // Test Space key
      card.focus()
      await user.keyboard(' ')
      expect(mockOnClick).toHaveBeenCalledTimes(2)
    })

    it('should not be interactive when onClick is not provided', () => {
      render(<VendorCard {...defaultProps} />)

      expect(screen.queryByRole('button', { name: /vendor:/i })).not.toBeInTheDocument()
    })
  })

  describe('Optional Fields', () => {
    it('should handle missing email gracefully', () => {
      const vendorWithoutEmail = createMockVendor({ email: undefined })

      render(<VendorCard {...defaultProps} vendor={vendorWithoutEmail} />)

      expect(screen.queryByRole('link', { name: /mailto/i })).not.toBeInTheDocument()
    })

    it('should handle missing phone gracefully', () => {
      const vendorWithoutPhone = createMockVendor({ phone: undefined })

      render(<VendorCard {...defaultProps} vendor={vendorWithoutPhone} />)

      expect(screen.queryByRole('link', { name: /tel/i })).not.toBeInTheDocument()
    })

    it('should handle missing address gracefully', () => {
      const vendorWithoutAddress = createMockVendor({ address: undefined })

      render(<VendorCard {...defaultProps} vendor={vendorWithoutAddress} />)

      expect(screen.queryByText(/main st/i)).not.toBeInTheDocument()
    })

    it('should handle missing tax ID gracefully', () => {
      const vendorWithoutTaxId = createMockVendor({ taxId: undefined })

      render(<VendorCard {...defaultProps} vendor={vendorWithoutTaxId} />)

      expect(screen.queryByText(/tax id/i)).not.toBeInTheDocument()
    })

    it('should handle missing notes gracefully', () => {
      const vendorWithoutNotes = createMockVendor({ notes: undefined })

      render(<VendorCard {...defaultProps} vendor={vendorWithoutNotes} />)

      expect(screen.queryByText(/notes:/i)).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have accessible label for vendor', () => {
      render(<VendorCard {...defaultProps} onClick={mockOnClick} />)

      const card = screen.getByRole('button', { name: /vendor: test vendor/i })
      expect(card).toHaveAccessibleName()
    })

    it('should have accessible labels for contact icons', () => {
      render(<VendorCard {...defaultProps} />)

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
    })

    it('should have accessible labels for badges', () => {
      const inactiveVendor = createMockVendor({ isActive: false, is1099Eligible: true })

      render(<VendorCard {...defaultProps} vendor={inactiveVendor} />)

      expect(screen.getByLabelText(/inactive vendor/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/1099 eligible vendor/i)).toBeInTheDocument()
    })

    it('should have proper tabindex when clickable', () => {
      render(<VendorCard {...defaultProps} onClick={mockOnClick} />)

      const card = screen.getByRole('button')
      expect(card).toHaveAttribute('tabIndex', '0')
    })

    it('should not have tabindex when not clickable', () => {
      render(<VendorCard {...defaultProps} />)

      const cardElement = screen.getByText('Test Vendor').closest('div')
      expect(cardElement).not.toHaveAttribute('tabIndex')
    })

    it('should hide decorative icons from screen readers', () => {
      render(<VendorCard {...defaultProps} />)

      const icons = document.querySelectorAll('[aria-hidden="true"]')
      expect(icons.length).toBeGreaterThan(0)
    })
  })

  describe('Visual Variants', () => {
    it('should apply default variant class', () => {
      const { container } = render(<VendorCard {...defaultProps} variant="default" />)

      const card = container.firstChild
      expect(card).toHaveClass('default')
    })

    it('should apply compact variant class', () => {
      const { container } = render(<VendorCard {...defaultProps} variant="compact" />)

      const card = container.firstChild
      expect(card).toHaveClass('compact')
    })

    it('should apply inactive class when vendor is inactive', () => {
      const inactiveVendor = createMockVendor({ isActive: false })
      const { container } = render(<VendorCard {...defaultProps} vendor={inactiveVendor} />)

      const card = container.firstChild
      expect(card).toHaveClass('inactive')
    })

    it('should apply clickable class when onClick is provided', () => {
      const { container } = render(<VendorCard {...defaultProps} onClick={mockOnClick} />)

      const card = container.firstChild
      expect(card).toHaveClass('clickable')
    })

    it('should apply custom className', () => {
      const { container } = render(<VendorCard {...defaultProps} className="custom-class" />)

      const card = container.firstChild
      expect(card).toHaveClass('custom-class')
    })
  })

  describe('Address Formatting', () => {
    it('should format complete address', () => {
      render(<VendorCard {...defaultProps} variant="default" />)

      expect(screen.getByText(/123 Main St, Suite 100, Test City, TS 12345/i)).toBeInTheDocument()
    })

    it('should format address without line 2', () => {
      const vendorWithoutLine2 = createMockVendor({
        address: {
          line1: '456 Oak Ave',
          city: 'Another City',
          state: 'CA',
          postalCode: '98765',
          country: 'US',
        },
      })

      render(<VendorCard {...defaultProps} vendor={vendorWithoutLine2} variant="default" />)

      expect(screen.getByText(/456 Oak Ave, Another City, CA 98765/i)).toBeInTheDocument()
    })
  })
})
