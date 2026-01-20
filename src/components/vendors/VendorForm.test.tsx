/**
 * VendorForm Component Tests
 *
 * Tests for vendor form functionality with validation and submission.
 *
 * Per D5: Vendor Management - Basic [MVP]
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VendorForm, type VendorFormProps } from './VendorForm'
import type { Vendor } from '../../types/vendor.types'

// Mock database
vi.mock('../../db/database', () => ({
  db: {
    contacts: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          filter: vi.fn(() => ({
            count: vi.fn().mockResolvedValue(0),
          })),
        })),
      })),
      get: vi.fn(),
    },
  },
}))

// Mock HierarchyValidator
vi.mock('../../validators/hierarchyValidator', () => ({
  HierarchyValidator: {
    validateParentAssignment: vi.fn().mockResolvedValue({ valid: true }),
  },
}))

// Mock ParentAccountSelector
vi.mock('../contacts/ParentAccountSelector', () => ({
  ParentAccountSelector: ({ value: _value, onChange, disabled }: any) => (
    <div data-testid="parent-account-selector">
      <button
        onClick={() => onChange('parent-123')}
        disabled={disabled}
        data-testid="select-parent-button"
      >
        Select Parent
      </button>
    </div>
  ),
}))

describe('VendorForm', () => {
  const mockCompanyId = 'company-123'
  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()

  const defaultProps: VendorFormProps = {
    companyId: mockCompanyId,
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel,
  }

  const mockVendor: Vendor = {
    id: 'vendor-123',
    companyId: mockCompanyId,
    type: 'vendor',
    name: 'Existing Vendor',
    email: 'existing@example.com',
    phone: '555-123-4567', // Fixed: must have at least 10 digits
    address: {
      line1: '123 Main St',
      city: 'Test City',
      state: 'TS',
      postalCode: '12345',
      country: 'US',
    },
    taxId: '12-3456789',
    is1099Eligible: true,
    notes: 'Test notes',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Create Mode', () => {
    it('should render form in create mode', () => {
      render(<VendorForm {...defaultProps} />)

      expect(screen.getByText("Let's add your vendor!")).toBeInTheDocument()
      expect(screen.getByText(/keeping track of who you pay/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add vendor/i })).toBeInTheDocument()
    })

    it('should have all required fields', () => {
      render(<VendorForm {...defaultProps} />)

      expect(screen.getByLabelText(/vendor name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/tax id/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/1099 eligible/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/active/i)).toBeInTheDocument()
    })

    it('should submit valid vendor data', async () => {
      const user = userEvent.setup()
      render(<VendorForm {...defaultProps} />)

      // Fill in required fields
      await user.type(screen.getByLabelText(/vendor name/i), 'New Vendor')

      // Submit form
      await user.click(screen.getByRole('button', { name: /add vendor/i }))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Vendor',
            isActive: true,
          })
        )
      })
    })

    it('should validate required name field', async () => {
      const user = userEvent.setup()
      render(<VendorForm {...defaultProps} />)

      // Try to submit without name
      await user.click(screen.getByRole('button', { name: /add vendor/i }))

      await waitFor(() => {
        expect(screen.getByText(/we'll need a name/i)).toBeInTheDocument()
      })

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should validate email format', async () => {
      const user = userEvent.setup()
      render(<VendorForm {...defaultProps} />)

      await user.type(screen.getByLabelText(/vendor name/i), 'Test Vendor')
      await user.type(screen.getByLabelText(/email address/i), 'invalid-email')

      await user.click(screen.getByRole('button', { name: /add vendor/i }))

      await waitFor(() => {
        expect(screen.getByText(/that email doesn't look quite right/i)).toBeInTheDocument()
      })

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should validate phone format', async () => {
      const user = userEvent.setup()
      render(<VendorForm {...defaultProps} />)

      await user.type(screen.getByLabelText(/vendor name/i), 'Test Vendor')
      await user.type(screen.getByLabelText(/phone number/i), '123')

      await user.click(screen.getByRole('button', { name: /add vendor/i }))

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid phone number/i)).toBeInTheDocument()
      })

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(<VendorForm {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('Edit Mode', () => {
    it('should render form in edit mode with existing data', () => {
      render(<VendorForm {...defaultProps} vendor={mockVendor} />)

      expect(screen.getByText('Edit Vendor')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Existing Vendor')).toBeInTheDocument()
      expect(screen.getByDisplayValue('existing@example.com')).toBeInTheDocument()
      expect(screen.getByDisplayValue('555-123-4567')).toBeInTheDocument()
      expect(screen.getByDisplayValue('12-3456789')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Test notes')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    })

    it('should show address fields when vendor has address', () => {
      render(<VendorForm {...defaultProps} vendor={mockVendor} />)

      expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Test City')).toBeInTheDocument()
      expect(screen.getByDisplayValue('TS')).toBeInTheDocument()
      expect(screen.getByDisplayValue('12345')).toBeInTheDocument()
    })

    it('should update vendor data on submit', async () => {
      const user = userEvent.setup()
      render(<VendorForm {...defaultProps} vendor={mockVendor} />)

      // Change name
      const nameInput = screen.getByLabelText(/vendor name/i)
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Vendor')

      // Submit form
      await user.click(screen.getByText(/save changes/i))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled()
      })
    })

    it('should show 1099 eligible as checked when true', () => {
      render(<VendorForm {...defaultProps} vendor={mockVendor} />)

      const checkbox = screen.getByLabelText(/1099 eligible/i)
      expect(checkbox).toBeChecked()
    })
  })

  describe('Address Section', () => {
    it('should show address fields when checkbox is checked', async () => {
      const user = userEvent.setup()
      render(<VendorForm {...defaultProps} />)

      // Address fields should not be visible initially
      expect(screen.queryByLabelText(/street address/i)).not.toBeInTheDocument()

      // Check the "Add mailing address" checkbox
      await user.click(screen.getByLabelText(/add mailing address/i))

      // Address fields should now be visible
      expect(screen.getByLabelText(/street address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/city/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/state/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/postal code/i)).toBeInTheDocument()
    })

    it('should validate address fields when shown', async () => {
      const user = userEvent.setup()
      render(<VendorForm {...defaultProps} />)

      await user.type(screen.getByLabelText(/vendor name/i), 'Test Vendor')
      await user.click(screen.getByLabelText(/add mailing address/i))

      // Fill only one address field
      await user.type(screen.getByLabelText(/street address/i), '123 Main St')

      // Submit form
      await user.click(screen.getByRole('button', { name: /add vendor/i }))

      // Should show validation errors for missing address fields
      await waitFor(() => {
        expect(screen.getByText(/city is required/i)).toBeInTheDocument()
        expect(screen.getByText(/state is required/i)).toBeInTheDocument()
        expect(screen.getByText(/postal code is required/i)).toBeInTheDocument()
      })

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
  })

  describe('Duplicate Warning', () => {
    it('should display duplicate warning when provided', () => {
      const duplicateWarning = 'We found a similar vendor: "Test Vendor". Is this the same one?'

      render(<VendorForm {...defaultProps} duplicateWarning={duplicateWarning} />)

      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(duplicateWarning)).toBeInTheDocument()
    })

    it('should not display warning when not provided', () => {
      render(<VendorForm {...defaultProps} />)

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('should disable form fields when submitting', () => {
      render(<VendorForm {...defaultProps} isSubmitting={true} />)

      expect(screen.getByLabelText(/vendor name/i)).toBeDisabled()
      expect(screen.getByLabelText(/email address/i)).toBeDisabled()
      expect(screen.getByLabelText(/phone number/i)).toBeDisabled()
      expect(screen.getByText(/add vendor/i).closest('button')).toBeDisabled()
      expect(screen.getByText(/cancel/i).closest('button')).toBeDisabled()
    })

    it('should show loading state on submit button', () => {
      render(<VendorForm {...defaultProps} isSubmitting={true} />)

      const submitButton = screen.getByText(/add vendor/i).closest('button')
      expect(submitButton).toHaveAttribute('aria-busy', 'true')
    })
  })

  describe('Accessibility', () => {
    it('should have proper form structure', () => {
      const { container } = render(<VendorForm {...defaultProps} />)

      const form = container.querySelector('form')
      expect(form).toHaveAttribute('novalidate')
    })

    it('should have accessible labels for all inputs', () => {
      render(<VendorForm {...defaultProps} />)

      // All inputs should have accessible labels
      const nameInput = screen.getByLabelText(/vendor name/i)
      expect(nameInput).toBeInTheDocument()
      expect(nameInput).toHaveAccessibleName()

      const emailInput = screen.getByLabelText(/email address/i)
      expect(emailInput).toHaveAccessibleName()

      const phoneInput = screen.getByLabelText(/phone number/i)
      expect(phoneInput).toHaveAccessibleName()
    })

    it('should link error messages to inputs with aria-describedby', async () => {
      const user = userEvent.setup()
      render(<VendorForm {...defaultProps} />)

      // Try to submit without required fields
      await user.click(screen.getByText(/add vendor/i))

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/vendor name/i)
        screen.getByText(/we'll need a name/i) // Assert error message exists

        expect(nameInput).toHaveAccessibleDescription()
      })
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<VendorForm {...defaultProps} />)

      // Tab through form fields
      await user.tab()
      expect(screen.getByLabelText(/vendor name/i)).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText(/email address/i)).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText(/phone number/i)).toHaveFocus()
    })
  })

  describe('Steadiness Communication Style', () => {
    it('should use patient and supportive error messages', async () => {
      const user = userEvent.setup()
      render(<VendorForm {...defaultProps} />)

      // Trigger validation errors
      await user.click(screen.getByRole('button', { name: /add vendor/i }))

      await waitFor(() => {
        // Should use friendly, non-technical language
        expect(screen.getByText(/we'll need a name/i)).toBeInTheDocument()
      })
    })

    it('should use encouraging form descriptions', () => {
      render(<VendorForm {...defaultProps} />)

      expect(screen.getByText(/keeping track of who you pay/i)).toBeInTheDocument()
      expect(screen.getByText(/helps you understand where your money goes/i)).toBeInTheDocument()
    })

    it('should have helpful field descriptions', () => {
      render(<VendorForm {...defaultProps} />)

      expect(screen.getByText(/the business or person's name/i)).toBeInTheDocument()
      expect(screen.getByText(/optional: for communication and records/i)).toBeInTheDocument()
      expect(screen.getByText(/optional: for quick contact/i)).toBeInTheDocument()
    })
  })
})
