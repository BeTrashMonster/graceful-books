/**
 * Tests for CustomerForm Component
 *
 * Tests form validation, submission, and accessibility
 * Per ACCT-002: Customer Management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { CustomerForm, type CustomerFormData } from './CustomerForm'
import type { Contact } from '../../types'

expect.extend(toHaveNoViolations)

describe('CustomerForm Component', () => {
  const mockCompanyId = 'company-123'

  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()

  const mockCustomer: Contact = {
    id: 'cust-1',
    companyId: mockCompanyId,
    type: 'customer',
    name: 'Acme Corporation',
    email: 'contact@acme.com',
    phone: '(555) 123-4567',
    address: {
      line1: '123 Main St',
      line2: 'Suite 100',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'US',
    },
    notes: 'Important customer',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render create mode by default', () => {
      render(
        <CustomerForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText("Let's add your customer!")).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add customer/i })).toBeInTheDocument()
    })

    it('should render edit mode when customer is provided', () => {
      render(
        <CustomerForm
          customer={mockCustomer}
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('Edit Customer')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    })

    it('should render all form fields', () => {
      render(
        <CustomerForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByLabelText(/customer name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/add mailing address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/active/i)).toBeInTheDocument()
    })

    it('should populate fields in edit mode', () => {
      render(
        <CustomerForm
          customer={mockCustomer}
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByDisplayValue('Acme Corporation')).toBeInTheDocument()
      expect(screen.getByDisplayValue('contact@acme.com')).toBeInTheDocument()
      expect(screen.getByDisplayValue('(555) 123-4567')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Important customer')).toBeInTheDocument()
    })

    it('should show address fields when address is provided', () => {
      render(
        <CustomerForm
          customer={mockCustomer}
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Suite 100')).toBeInTheDocument()
      expect(screen.getByDisplayValue('New York')).toBeInTheDocument()
      expect(screen.getByDisplayValue('NY')).toBeInTheDocument()
      expect(screen.getByDisplayValue('10001')).toBeInTheDocument()
    })
  })

  describe('validation', () => {
    it('should require customer name', async () => {
      const user = userEvent.setup()

      render(
        <CustomerForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const submitButton = screen.getByRole('button', { name: /add customer/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/we'll need a name for this customer/i)).toBeInTheDocument()
      })

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should validate email format', async () => {
      const user = userEvent.setup()

      render(
        <CustomerForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const nameInput = screen.getByLabelText(/customer name/i)
      const emailInput = screen.getByLabelText(/email address/i)

      await user.type(nameInput, 'Test Customer')
      await user.type(emailInput, 'invalid-email')

      const submitButton = screen.getByRole('button', { name: /add customer/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/that email doesn't look quite right/i)).toBeInTheDocument()
      })

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should accept valid email format', async () => {
      const user = userEvent.setup()

      render(
        <CustomerForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const nameInput = screen.getByLabelText(/customer name/i)
      const emailInput = screen.getByLabelText(/email address/i)

      await user.type(nameInput, 'Test Customer')
      await user.type(emailInput, 'valid@example.com')

      const submitButton = screen.getByRole('button', { name: /add customer/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled()
      })

      expect(screen.queryByText(/that email doesn't look quite right/i)).not.toBeInTheDocument()
    })

    it('should validate phone format', async () => {
      const user = userEvent.setup()

      render(
        <CustomerForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const nameInput = screen.getByLabelText(/customer name/i)
      const phoneInput = screen.getByLabelText(/phone number/i)

      await user.type(nameInput, 'Test Customer')
      await user.type(phoneInput, '123')

      const submitButton = screen.getByRole('button', { name: /add customer/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid phone number/i)).toBeInTheDocument()
      })

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should accept valid phone format', async () => {
      const user = userEvent.setup()

      render(
        <CustomerForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const nameInput = screen.getByLabelText(/customer name/i)
      const phoneInput = screen.getByLabelText(/phone number/i)

      await user.type(nameInput, 'Test Customer')
      await user.type(phoneInput, '(555) 123-4567')

      const submitButton = screen.getByRole('button', { name: /add customer/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled()
      })

      expect(screen.queryByText(/please enter a valid phone number/i)).not.toBeInTheDocument()
    })
  })

  describe('address section', () => {
    it('should show address fields when checkbox is checked', async () => {
      const user = userEvent.setup()

      render(
        <CustomerForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const addressCheckbox = screen.getByLabelText(/add mailing address/i)
      await user.click(addressCheckbox)

      expect(screen.getByLabelText(/street address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/address line 2/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/city/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/state/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/postal code/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/country/i)).toBeInTheDocument()
    })

    it('should hide address fields when checkbox is unchecked', async () => {
      const user = userEvent.setup()

      render(
        <CustomerForm
          customer={mockCustomer}
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const addressCheckbox = screen.getByLabelText(/add mailing address/i)
      await user.click(addressCheckbox)

      expect(screen.queryByLabelText(/street address/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/city/i)).not.toBeInTheDocument()
    })
  })

  describe('form submission', () => {
    it('should submit valid form data', async () => {
      const user = userEvent.setup()

      render(
        <CustomerForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const nameInput = screen.getByLabelText(/customer name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const phoneInput = screen.getByLabelText(/phone number/i)
      const notesInput = screen.getByLabelText(/notes/i)

      await user.type(nameInput, 'New Customer')
      await user.type(emailInput, 'new@example.com')
      await user.type(phoneInput, '5551234567')
      await user.type(notesInput, 'Test notes')

      const submitButton = screen.getByRole('button', { name: /add customer/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled()
      })

      const submittedData: CustomerFormData = mockOnSubmit.mock.calls[0]![0]
      expect(submittedData.name).toBe('New Customer')
      expect(submittedData.email).toBe('new@example.com')
      expect(submittedData.phone).toBe('5551234567')
      expect(submittedData.notes).toBe('Test notes')
      expect(submittedData.isActive).toBe(true)
    })

    it('should submit with address data', async () => {
      const user = userEvent.setup()

      render(
        <CustomerForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const nameInput = screen.getByLabelText(/customer name/i)
      const addressCheckbox = screen.getByLabelText(/add mailing address/i)

      await user.type(nameInput, 'New Customer')
      await user.click(addressCheckbox)

      const addressInput = screen.getByLabelText(/street address/i)
      const cityInput = screen.getByLabelText(/city/i)
      const stateInput = screen.getByLabelText(/state/i)
      const postalInput = screen.getByLabelText(/postal code/i)
      const countryInput = screen.getByLabelText(/country/i)

      await user.type(addressInput, '456 Oak Ave')
      await user.type(cityInput, 'Boston')
      await user.clear(stateInput)
      await user.type(stateInput, 'MA')
      await user.clear(postalInput)
      await user.type(postalInput, '02101')
      await user.clear(countryInput)
      await user.type(countryInput, 'US')

      const submitButton = screen.getByRole('button', { name: /add customer/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled()
      })

      const submittedData: CustomerFormData = mockOnSubmit.mock.calls[0]![0]
      expect(submittedData.address?.line1).toBe('456 Oak Ave')
      expect(submittedData.address?.city).toBe('Boston')
      expect(submittedData.address?.state).toBe('MA')
      expect(submittedData.address?.postalCode).toBe('02101')
      expect(submittedData.address?.country).toBe('US')
    })

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <CustomerForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalled()
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should disable form during submission', () => {
      render(
        <CustomerForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isSubmitting={true}
        />
      )

      const nameInput = screen.getByLabelText(/customer name/i)
      const buttons = screen.getAllByRole('button')
      const cancelButton = screen.getByRole('button', { name: /cancel/i })

      expect(nameInput).toBeDisabled()
      expect(cancelButton).toBeDisabled()
      buttons.forEach((button: any) => {
        expect(button).toBeDisabled()
      })
    })
  })

  describe('accessibility', () => {
    it('should have no accessibility violations in create mode', async () => {
      const { container } = render(
        <CustomerForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations in edit mode', async () => {
      const { container } = render(
        <CustomerForm
          customer={mockCustomer}
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper labels for all inputs', () => {
      render(
        <CustomerForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByLabelText(/customer name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/active/i)).toBeInTheDocument()
    })

    it('should have helper text for inputs', () => {
      render(
        <CustomerForm
          companyId={mockCompanyId}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText(/the business or person's name/i)).toBeInTheDocument()
      expect(screen.getByText(/for sending invoices and updates/i)).toBeInTheDocument()
      expect(screen.getByText(/for quick contact/i)).toBeInTheDocument()
    })
  })
})
