/**
 * ParentAccountSelector Component Tests
 *
 * Tests the ParentAccountSelector component including:
 * - Progressive disclosure behavior
 * - Parent selection validation
 * - Circular reference prevention
 * - Depth limit enforcement
 * - Accessibility compliance
 * - Error handling
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ParentAccountSelector } from './ParentAccountSelector'
import { db } from '../../db/database'
import { useLiveQuery } from 'dexie-react-hooks'
import { HierarchyValidator } from '../../validators/hierarchyValidator'
import { HierarchyService } from '../../services/hierarchyService'
import type { Contact } from '../../types/database.types'
import { ContactAccountType, ContactType } from '../../types/database.types'

// Mock the database
vi.mock('../../db/database', () => ({
  db: {
    contacts: {
      where: vi.fn(),
      get: vi.fn(),
    },
  },
}))

// Mock Dexie React hooks
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}))

// Mock the validators and services
vi.mock('../../validators/hierarchyValidator')
vi.mock('../../services/hierarchyService')

describe('ParentAccountSelector', () => {
  const companyId = 'company-123'
  const currentContactId = 'contact-current'

  const mockContacts: Contact[] = [
    {
      id: 'contact-1',
      company_id: companyId,
      type: ContactType.CUSTOMER,
      name: 'Parent Company',
      email: null,
      phone: null,
      address: null,
      tax_id: null,
      notes: null,
      active: true,
      balance: '0.00',
      version_vector: {},
      parent_id: null,
      account_type: ContactAccountType.PARENT,
      hierarchy_level: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    },
    {
      id: 'contact-2',
      company_id: companyId,
      type: ContactType.CUSTOMER,
      name: 'Standalone Company',
      email: null,
      phone: null,
      address: null,
      tax_id: null,
      notes: null,
      active: true,
      balance: '0.00',
      version_vector: {},
      parent_id: null,
      account_type: ContactAccountType.STANDALONE,
      hierarchy_level: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    },
    {
      id: 'contact-3',
      company_id: companyId,
      type: ContactType.CUSTOMER,
      name: 'Child Company',
      email: null,
      phone: null,
      address: null,
      tax_id: null,
      notes: null,
      active: true,
      balance: '0.00',
      version_vector: {},
      parent_id: 'contact-1',
      account_type: ContactAccountType.CHILD,
      hierarchy_level: 1,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    },
    {
      id: currentContactId,
      company_id: companyId,
      type: ContactType.CUSTOMER,
      name: 'Current Contact',
      email: null,
      phone: null,
      address: null,
      tax_id: null,
      notes: null,
      active: true,
      balance: '0.00',
      version_vector: {},
      parent_id: null,
      account_type: ContactAccountType.STANDALONE,
      hierarchy_level: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
    },
  ]

  const defaultProps = {
    value: null,
    onChange: vi.fn(),
    currentContactId,
    companyId,
  }

  beforeEach(() => {
    // Mock database queries
    const mockWhere = {
      equals: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue(mockContacts),
    }
    ;(db.contacts.where as any).mockReturnValue(mockWhere)

    // Mock useLiveQuery to return mock data synchronously
    // The component calls useLiveQuery twice: once for contacts, once for descendants
    ;(useLiveQuery as any).mockImplementation((queryFn: any, deps: any, defaultValue: any) => {
      // First call is for contacts list
      if (queryFn.toString().includes('db.contacts')) {
        return mockContacts
      }
      // Second call is for descendants
      return []
    })

    // Mock HierarchyService
    ;(HierarchyService.getDescendants as any) = vi.fn().mockResolvedValue([])

    // Mock HierarchyValidator
    ;(HierarchyValidator.validateParentAssignment as any) = vi
      .fn()
      .mockResolvedValue({ valid: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Progressive Disclosure', () => {
    it('should render collapsed by default', () => {
      render(<ParentAccountSelector {...defaultProps} />)

      const toggleButton = screen.getByRole('button', {
        name: /advanced: parent account/i,
      })
      expect(toggleButton).toBeInTheDocument()
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false')

      // Selector should not be visible
      expect(screen.queryByLabelText(/parent account selection/i)).not.toBeInTheDocument()
    })

    it('should expand when toggle button is clicked', async () => {
      const user = userEvent.setup()
      render(<ParentAccountSelector {...defaultProps} />)

      const toggleButton = screen.getByRole('button', {
        name: /advanced: parent account/i,
      })

      await user.click(toggleButton)

      await waitFor(() => {
        expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByLabelText(/parent account selection/i)).toBeInTheDocument()
      })
    })

    it('should collapse when toggle button is clicked again', async () => {
      const user = userEvent.setup()
      render(<ParentAccountSelector {...defaultProps} defaultExpanded />)

      const toggleButton = screen.getByRole('button', {
        name: /advanced: parent account/i,
      })

      await user.click(toggleButton)

      await waitFor(() => {
        expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
        expect(screen.queryByLabelText(/parent account selection/i)).not.toBeInTheDocument()
      })
    })

    it('should show hint when parent is assigned', () => {
      render(<ParentAccountSelector {...defaultProps} value="contact-1" />)

      expect(screen.getByText(/parent assigned/i)).toBeInTheDocument()
    })

    it('should show optional hint when no parent assigned', () => {
      render(<ParentAccountSelector {...defaultProps} />)

      expect(screen.getByText(/optional/i)).toBeInTheDocument()
    })
  })

  describe('Parent Selection', () => {
    it('should display all valid parent options', async () => {
      render(<ParentAccountSelector {...defaultProps} defaultExpanded />)

      const select = await screen.findByRole('combobox', { name: /parent account/i })

      await waitFor(() => {
        const options = within(select).getAllByRole('option')
        // Should have "None" option plus valid contacts (excluding current)
        expect(options.length).toBeGreaterThan(1)
      })
    })

    it('should exclude current contact from options', async () => {
      render(<ParentAccountSelector {...defaultProps} defaultExpanded />)

      const select = await screen.findByRole('combobox', { name: /parent account/i })

      await waitFor(() => {
        const options = within(select).getAllByRole('option')
        const currentOption = options.find(
          opt => (opt as HTMLOptionElement).value === currentContactId
        )
        expect(currentOption).toBeUndefined()
      })
    })

    it('should exclude descendants from options', async () => {
      const descendantId = 'contact-descendant'
      ;(HierarchyService.getDescendants as any) = vi.fn().mockResolvedValue([
        { id: descendantId, name: 'Descendant' },
      ])

      render(<ParentAccountSelector {...defaultProps} defaultExpanded />)

      const select = await screen.findByRole('combobox', { name: /parent account/i })

      await waitFor(() => {
        const options = within(select).getAllByRole('option')
        const descendantOption = options.find(
          opt => (opt as HTMLOptionElement).value === descendantId
        )
        expect(descendantOption).toBeUndefined()
      })
    })

    it('should exclude additional IDs from excludeIds prop', async () => {
      const excludeId = 'contact-2'
      render(
        <ParentAccountSelector
          {...defaultProps}
          excludeIds={[excludeId]}
          defaultExpanded
        />
      )

      const select = await screen.findByRole('combobox', { name: /parent account/i })

      await waitFor(() => {
        const options = within(select).getAllByRole('option')
        const excludedOption = options.find(
          opt => (opt as HTMLOptionElement).value === excludeId
        )
        expect(excludedOption).toBeUndefined()
      })
    })

    it('should call onChange when selection changes', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()

      render(
        <ParentAccountSelector
          {...defaultProps}
          onChange={onChange}
          defaultExpanded
        />
      )

      const select = await screen.findByRole('combobox', { name: /parent account/i })

      await user.selectOptions(select, 'contact-1')

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith('contact-1')
      })
    })

    it('should call onChange with null when "None" is selected', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()

      render(
        <ParentAccountSelector
          {...defaultProps}
          onChange={onChange}
          value="contact-1"
          defaultExpanded
        />
      )

      const select = await screen.findByRole('combobox', { name: /parent account/i })

      await user.selectOptions(select, '')

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(null)
      })
    })
  })

  describe('Validation', () => {
    it('should validate selection when value changes', async () => {
      const { rerender } = render(
        <ParentAccountSelector {...defaultProps} defaultExpanded />
      )

      rerender(
        <ParentAccountSelector
          {...defaultProps}
          value="contact-1"
          defaultExpanded
        />
      )

      await waitFor(() => {
        expect(HierarchyValidator.validateParentAssignment).toHaveBeenCalledWith(
          currentContactId,
          'contact-1'
        )
      })
    })

    it('should display validation error', async () => {
      const errorMessage = 'This would create a circular reference.'
      ;(HierarchyValidator.validateParentAssignment as any) = vi
        .fn()
        .mockResolvedValue({ valid: false, error: errorMessage })

      render(
        <ParentAccountSelector
          {...defaultProps}
          value="contact-1"
          defaultExpanded
        />
      )

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('should prevent invalid selection', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      ;(HierarchyValidator.validateParentAssignment as any) = vi
        .fn()
        .mockResolvedValue({ valid: false, error: 'Invalid' })

      render(
        <ParentAccountSelector
          {...defaultProps}
          onChange={onChange}
          defaultExpanded
        />
      )

      const select = await screen.findByRole('combobox', { name: /parent account/i })

      await user.selectOptions(select, 'contact-1')

      // onChange should not be called if validation fails
      await waitFor(() => {
        expect(onChange).not.toHaveBeenCalled()
      })
    })

    it('should show validating message during validation', async () => {
      const user = userEvent.setup()
      ;(HierarchyValidator.validateParentAssignment as any) = vi
        .fn()
        .mockImplementation(
          () =>
            new Promise(resolve =>
              setTimeout(() => resolve({ valid: true }), 100)
            )
        )

      render(<ParentAccountSelector {...defaultProps} defaultExpanded />)

      const select = await screen.findByRole('combobox', { name: /parent account/i })

      await user.selectOptions(select, 'contact-1')

      expect(screen.getByText(/validating selection/i)).toBeInTheDocument()
    })
  })

  describe('Visual Hierarchy Indicators', () => {
    it('should display hierarchy legend', async () => {
      render(<ParentAccountSelector {...defaultProps} defaultExpanded />)

      await waitFor(() => {
        expect(screen.getByText(/account types:/i)).toBeInTheDocument()
        expect(screen.getByText(/standalone.*independent/i)).toBeInTheDocument()
        expect(screen.getByText(/parent.*sub-accounts/i)).toBeInTheDocument()
        expect(screen.getByText(/child.*sub-account/i)).toBeInTheDocument()
      })
    })

    it('should display maximum depth information', async () => {
      render(<ParentAccountSelector {...defaultProps} defaultExpanded />)

      await waitFor(() => {
        expect(screen.getByText(/maximum hierarchy depth: 3 levels/i)).toBeInTheDocument()
      })
    })
  })

  describe('Visibility Control', () => {
    it('should not render if user has only one contact', async () => {
      // Mock only one contact (the current one)
      const mockWhere = {
        equals: vi.fn().mockReturnThis(),
        filter: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([mockContacts[3]]), // Only current contact
      }
      ;(db.contacts.where as any).mockReturnValue(mockWhere)

      const { container } = render(<ParentAccountSelector {...defaultProps} />)

      await waitFor(() => {
        expect(container.firstChild).toBeNull()
      })
    })

    it('should render if user has multiple contacts', async () => {
      render(<ParentAccountSelector {...defaultProps} />)

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /advanced: parent account/i })
        ).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes when collapsed', () => {
      render(<ParentAccountSelector {...defaultProps} />)

      const toggle = screen.getByRole('button', {
        name: /advanced: parent account/i,
      })

      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(toggle).toHaveAttribute('aria-controls', 'parent-account-selector')
    })

    it('should have proper ARIA attributes when expanded', async () => {
      render(<ParentAccountSelector {...defaultProps} defaultExpanded />)

      const toggle = screen.getByRole('button', {
        name: /advanced: parent account/i,
      })

      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(toggle).toHaveAttribute(
        'aria-controls',
        'parent-account-selector-content'
      )
    })

    it('should have accessible region for selector content', async () => {
      render(<ParentAccountSelector {...defaultProps} defaultExpanded />)

      const region = screen.getByRole('region', {
        name: /parent account selection/i,
      })

      expect(region).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<ParentAccountSelector {...defaultProps} />)

      const toggle = screen.getByRole('button', {
        name: /advanced: parent account/i,
      })

      // Focus the button
      toggle.focus()
      expect(toggle).toHaveFocus()

      // Press Enter to expand
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(toggle).toHaveAttribute('aria-expanded', 'true')
      })
    })

    it('should disable controls when disabled prop is true', async () => {
      render(<ParentAccountSelector {...defaultProps} disabled defaultExpanded />)

      const toggle = screen.getByRole('button', {
        name: /advanced: parent account/i,
      })
      const select = await screen.findByLabelText(/parent account/i)

      expect(toggle).toBeDisabled()
      expect(select).toBeDisabled()
    })
  })

  describe('Error Handling', () => {
    it('should display external error prop', async () => {
      const errorMessage = 'External error message'
      render(
        <ParentAccountSelector
          {...defaultProps}
          error={errorMessage}
          defaultExpanded
        />
      )

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('should handle validation errors gracefully', async () => {
      (HierarchyValidator.validateParentAssignment as any) = vi
        .fn()
        .mockRejectedValue(new Error('Validation failed'))

      render(
        <ParentAccountSelector
          {...defaultProps}
          value="contact-1"
          defaultExpanded
        />
      )

      await waitFor(() => {
        expect(
          screen.getByText(/unable to validate parent selection/i)
        ).toBeInTheDocument()
      })
    })

    it('should handle service errors gracefully', async () => {
      (HierarchyService.getDescendants as any) = vi
        .fn()
        .mockRejectedValue(new Error('Service error'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<ParentAccountSelector {...defaultProps} defaultExpanded />)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error fetching descendants:',
          expect.any(Error)
        )
      })

      consoleSpy.mockRestore()
    })
  })
})
