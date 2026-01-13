/**
 * VendorList Component Tests
 *
 * Tests for vendor list display, search, and filter functionality.
 *
 * Per D5: Vendor Management - Basic [MVP]
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VendorList, type VendorListProps } from './VendorList'
import type { Vendor } from '../../types/vendor.types'

// Mock VendorCard component
vi.mock('./VendorCard', () => ({
  VendorCard: ({ vendor, onEdit, onDelete }: any) => (
    <div data-testid={`vendor-card-${vendor.id}`}>
      <h3>{vendor.name}</h3>
      <button onClick={() => onEdit?.(vendor)} data-testid={`edit-${vendor.id}`}>
        Edit
      </button>
      <button onClick={() => onDelete?.(vendor)} data-testid={`delete-${vendor.id}`}>
        Delete
      </button>
    </div>
  ),
}))

// Mock HierarchyIndicator component
vi.mock('../contacts/HierarchyIndicator', () => ({
  HierarchyIndicator: ({ contact }: any) => (
    <div data-testid={`hierarchy-${contact.id}`}>Hierarchy</div>
  ),
}))

// Mock Select component
vi.mock('../forms/Select', () => ({
  Select: ({ value, onChange, options, ...props }: any) => (
    <select value={value} onChange={onChange} {...props}>
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}))

describe('VendorList', () => {
  const mockOnEdit = vi.fn()
  const mockOnDelete = vi.fn()
  const mockOnCreate = vi.fn()

  const createMockVendor = (overrides?: Partial<Vendor>): Vendor => ({
    id: 'vendor-123',
    companyId: 'company-123',
    type: 'vendor',
    name: 'Test Vendor',
    email: 'test@example.com',
    phone: '555-1234',
    isActive: true,
    is1099Eligible: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  const defaultProps: VendorListProps = {
    vendors: [],
    onEdit: mockOnEdit,
    onDelete: mockOnDelete,
    onCreate: mockOnCreate,
    isLoading: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Empty State', () => {
    it('should display empty state when no vendors', () => {
      render(<VendorList {...defaultProps} />)

      expect(screen.getByText(/keeping track of who you pay/i)).toBeInTheDocument()
      expect(screen.getByText(/no judgment - just clarity/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add vendor/i })).toBeInTheDocument()
    })

    it('should call onCreate when clicking add vendor in empty state', async () => {
      const user = userEvent.setup()
      render(<VendorList {...defaultProps} />)

      // Click the "Add Vendor" button in empty state
      const buttons = screen.getAllByRole('button', { name: /add vendor/i })
      await user.click(buttons[0])

      expect(mockOnCreate).toHaveBeenCalledTimes(1)
    })
  })

  describe('Vendor Display', () => {
    it('should display list of vendors', () => {
      const vendors = [
        createMockVendor({ id: 'v1', name: 'Vendor One' }),
        createMockVendor({ id: 'v2', name: 'Vendor Two' }),
        createMockVendor({ id: 'v3', name: 'Vendor Three' }),
      ]

      render(<VendorList {...defaultProps} vendors={vendors} />)

      expect(screen.getByText('Vendor One')).toBeInTheDocument()
      expect(screen.getByText('Vendor Two')).toBeInTheDocument()
      expect(screen.getByText('Vendor Three')).toBeInTheDocument()
    })

    it('should show vendor count', () => {
      const vendors = [
        createMockVendor({ id: 'v1' }),
        createMockVendor({ id: 'v2' }),
      ]

      render(<VendorList {...defaultProps} vendors={vendors} />)

      expect(screen.getByText('2 vendors')).toBeInTheDocument()
    })

    it('should show singular form for one vendor', () => {
      const vendors = [createMockVendor()]

      render(<VendorList {...defaultProps} vendors={vendors} />)

      expect(screen.getByText('1 vendor')).toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    const vendors = [
      createMockVendor({ id: 'v1', name: 'Acme Corporation', email: 'contact@acme.com' }),
      createMockVendor({ id: 'v2', name: 'Best Supplies', email: 'info@best.com' }),
      createMockVendor({ id: 'v3', name: 'Creative Design', phone: '555-9999' }),
    ]

    it('should filter vendors by name', async () => {
      const user = userEvent.setup()
      render(<VendorList {...defaultProps} vendors={vendors} />)

      const searchInput = screen.getByPlaceholderText(/search vendors/i)
      await user.type(searchInput, 'Acme')

      expect(screen.getByText('Acme Corporation')).toBeInTheDocument()
      expect(screen.queryByText('Best Supplies')).not.toBeInTheDocument()
      expect(screen.queryByText('Creative Design')).not.toBeInTheDocument()
    })

    it('should filter vendors by email', async () => {
      const user = userEvent.setup()
      render(<VendorList {...defaultProps} vendors={vendors} />)

      const searchInput = screen.getByPlaceholderText(/search vendors/i)
      await user.type(searchInput, 'contact@acme')

      expect(screen.getByText('Acme Corporation')).toBeInTheDocument()
      expect(screen.queryByText('Best Supplies')).not.toBeInTheDocument()
    })

    it('should filter vendors by phone', async () => {
      const user = userEvent.setup()
      render(<VendorList {...defaultProps} vendors={vendors} />)

      const searchInput = screen.getByPlaceholderText(/search vendors/i)
      await user.type(searchInput, '555-9999')

      expect(screen.getByText('Creative Design')).toBeInTheDocument()
      expect(screen.queryByText('Acme Corporation')).not.toBeInTheDocument()
    })

    it('should show message when no search results', async () => {
      const user = userEvent.setup()
      render(<VendorList {...defaultProps} vendors={vendors} />)

      const searchInput = screen.getByPlaceholderText(/search vendors/i)
      await user.type(searchInput, 'NonexistentVendor')

      expect(screen.getByText(/no vendors found/i)).toBeInTheDocument()
      expect(screen.getByText(/try adjusting your search/i)).toBeInTheDocument()
    })
  })

  describe('Filter Functionality', () => {
    const vendors = [
      createMockVendor({ id: 'v1', name: 'Active Vendor', isActive: true, is1099Eligible: false }),
      createMockVendor({ id: 'v2', name: 'Inactive Vendor', isActive: false, is1099Eligible: false }),
      createMockVendor({ id: 'v3', name: '1099 Vendor', isActive: true, is1099Eligible: true }),
    ]

    it('should filter by active status', async () => {
      const user = userEvent.setup()
      render(<VendorList {...defaultProps} vendors={vendors} />)

      const statusFilter = screen.getByLabelText(/filter by status/i)
      await user.selectOptions(statusFilter, 'active')

      expect(screen.getByText('Active Vendor')).toBeInTheDocument()
      expect(screen.getByText('1099 Vendor')).toBeInTheDocument()
      expect(screen.queryByText('Inactive Vendor')).not.toBeInTheDocument()
    })

    it('should filter by inactive status', async () => {
      const user = userEvent.setup()
      render(<VendorList {...defaultProps} vendors={vendors} />)

      const statusFilter = screen.getByLabelText(/filter by status/i)
      await user.selectOptions(statusFilter, 'inactive')

      expect(screen.getByText('Inactive Vendor')).toBeInTheDocument()
      expect(screen.queryByText('Active Vendor')).not.toBeInTheDocument()
    })

    it('should filter by 1099 eligibility', async () => {
      const user = userEvent.setup()
      render(<VendorList {...defaultProps} vendors={vendors} />)

      const eligibilityFilter = screen.getByLabelText(/filter by 1099 eligibility/i)
      await user.selectOptions(eligibilityFilter, 'eligible')

      expect(screen.getByText('1099 Vendor')).toBeInTheDocument()
      expect(screen.queryByText('Active Vendor')).not.toBeInTheDocument()
      expect(screen.queryByText('Inactive Vendor')).not.toBeInTheDocument()
    })
  })

  describe('Sort Functionality', () => {
    const vendors = [
      createMockVendor({ id: 'v1', name: 'Zebra Company', email: 'a@example.com', createdAt: new Date('2024-01-01') }),
      createMockVendor({ id: 'v2', name: 'Alpha Company', email: 'z@example.com', createdAt: new Date('2024-01-03') }),
      createMockVendor({ id: 'v3', name: 'Beta Company', email: 'b@example.com', createdAt: new Date('2024-01-02') }),
    ]

    it('should sort by name by default', () => {
      render(<VendorList {...defaultProps} vendors={vendors} />)

      const vendorCards = screen.getAllByText(/company/i)
      expect(vendorCards[0]).toHaveTextContent('Alpha Company')
      expect(vendorCards[1]).toHaveTextContent('Beta Company')
      expect(vendorCards[2]).toHaveTextContent('Zebra Company')
    })

    it('should sort by recently added', async () => {
      const user = userEvent.setup()
      render(<VendorList {...defaultProps} vendors={vendors} />)

      const sortSelect = screen.getByLabelText(/sort by/i)
      await user.selectOptions(sortSelect, 'recent')

      const vendorCards = screen.getAllByText(/company/i)
      expect(vendorCards[0]).toHaveTextContent('Alpha Company') // Most recent
    })
  })

  describe('Actions', () => {
    it('should call onCreate when Add Vendor button is clicked', async () => {
      const user = userEvent.setup()
      const vendors = [createMockVendor()]

      render(<VendorList {...defaultProps} vendors={vendors} />)

      await user.click(screen.getByRole('button', { name: /add vendor/i }))

      expect(mockOnCreate).toHaveBeenCalledTimes(1)
    })

    it('should call onEdit when edit button is clicked', async () => {
      const user = userEvent.setup()
      const vendor = createMockVendor()

      render(<VendorList {...defaultProps} vendors={[vendor]} />)

      await user.click(screen.getByTestId(`edit-${vendor.id}`))

      expect(mockOnEdit).toHaveBeenCalledWith(vendor)
    })

    it('should call onDelete when delete button is clicked', async () => {
      const user = userEvent.setup()
      const vendor = createMockVendor()

      render(<VendorList {...defaultProps} vendors={[vendor]} />)

      await user.click(screen.getByTestId(`delete-${vendor.id}`))

      expect(mockOnDelete).toHaveBeenCalledWith(vendor)
    })
  })

  describe('Milestone Celebrations', () => {
    it('should show celebration for first vendor', () => {
      render(<VendorList {...defaultProps} vendors={[]} vendorCount={1} />)

      expect(screen.getByText(/your first vendor/i)).toBeInTheDocument()
    })

    it('should show celebration for 10 vendors', () => {
      const vendors = Array.from({ length: 10 }, (_, i) =>
        createMockVendor({ id: `v${i}`, name: `Vendor ${i}` })
      )

      render(<VendorList {...defaultProps} vendors={vendors} vendorCount={10} />)

      expect(screen.getByText(/10 vendors!/i)).toBeInTheDocument()
    })

    it('should not show celebration when vendorCount is not provided', () => {
      const vendors = [createMockVendor()]

      render(<VendorList {...defaultProps} vendors={vendors} />)

      expect(screen.queryByText(/your first vendor/i)).not.toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('should show loading message when loading', () => {
      render(<VendorList {...defaultProps} isLoading={true} />)

      expect(screen.getByText(/getting everything ready for you/i)).toBeInTheDocument()
    })

    it('should not show vendor list when loading', () => {
      const vendors = [createMockVendor({ name: 'Should Not Show' })]

      render(<VendorList {...defaultProps} vendors={vendors} isLoading={true} />)

      expect(screen.queryByText('Should Not Show')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have accessible search input', () => {
      render(<VendorList {...defaultProps} vendors={[createMockVendor()]} />)

      const searchInput = screen.getByLabelText(/search vendors/i)
      expect(searchInput).toHaveAccessibleName()
    })

    it('should have accessible filter controls', () => {
      render(<VendorList {...defaultProps} vendors={[createMockVendor()]} />)

      expect(screen.getByLabelText(/filter by status/i)).toHaveAccessibleName()
      expect(screen.getByLabelText(/filter by 1099 eligibility/i)).toHaveAccessibleName()
      expect(screen.getByLabelText(/sort by/i)).toHaveAccessibleName()
    })

    it('should announce results count to screen readers', () => {
      const vendors = [createMockVendor(), createMockVendor({ id: 'v2' })]

      render(<VendorList {...defaultProps} vendors={vendors} />)

      const resultsCount = screen.getByText('2 vendors')
      expect(resultsCount).toHaveAttribute('aria-live', 'polite')
    })

    it('should announce celebrations to screen readers', () => {
      render(<VendorList {...defaultProps} vendors={[]} vendorCount={1} />)

      const celebration = screen.getByRole('status')
      expect(celebration).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('Steadiness Communication Style', () => {
    it('should use patient and supportive language in empty state', () => {
      render(<VendorList {...defaultProps} vendors={[]} />)

      expect(screen.getByText(/keeping track of who you pay/i)).toBeInTheDocument()
      expect(screen.getByText(/no judgment - just clarity/i)).toBeInTheDocument()
    })

    it('should use encouraging celebration messages', () => {
      render(<VendorList {...defaultProps} vendors={[]} vendorCount={10} />)

      expect(screen.getByText(/your network is expanding/i)).toBeInTheDocument()
    })

    it('should use friendly loading message', () => {
      render(<VendorList {...defaultProps} isLoading={true} />)

      expect(screen.getByText(/getting everything ready for you/i)).toBeInTheDocument()
    })
  })
})
