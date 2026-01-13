/**
 * HierarchyIndicator Component Tests
 *
 * Tests for the HierarchyIndicator component
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HierarchyIndicator } from './HierarchyIndicator'
import type { Contact } from '../../types/database.types'
import { ContactAccountType, ContactType } from '../../types/database.types'

/**
 * Create mock contact with hierarchy fields
 */
function createMockContact(
  overrides: Partial<Contact> = {}
): Contact {
  return {
    id: 'contact-1',
    company_id: 'company-1',
    type: ContactType.CUSTOMER,
    name: 'Test Contact',
    email: null,
    phone: null,
    address: null,
    tax_id: null,
    notes: null,
    active: true,
    balance: '0.00',
    parent_id: null,
    account_type: ContactAccountType.STANDALONE,
    hierarchy_level: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    version_vector: { 'device-1': 1 },
    ...overrides,
  }
}

describe('HierarchyIndicator', () => {
  describe('Standalone Account', () => {
    it('renders nothing in compact view for standalone account', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.STANDALONE,
        hierarchy_level: 0,
      })

      const { container } = render(
        <HierarchyIndicator contact={contact} view="compact" />
      )

      expect(container.firstChild).toBeNull()
    })

    it('renders standalone indicator in expanded view', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.STANDALONE,
        hierarchy_level: 0,
      })

      render(<HierarchyIndicator contact={contact} view="expanded" />)

      expect(screen.getByText('Standalone Account')).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Hierarchy information: Standalone Account'
      )
    })
  })

  describe('Parent Account', () => {
    it('renders parent indicator with sub-account count in compact view', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 0,
      })

      render(
        <HierarchyIndicator
          contact={contact}
          view="compact"
          subAccountCount={3}
        />
      )

      expect(screen.getByText('Parent Account')).toBeInTheDocument()
      expect(screen.getByText('3 sub-accounts')).toBeInTheDocument()
    })

    it('renders parent indicator with singular sub-account text when count is 1', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 0,
      })

      render(
        <HierarchyIndicator
          contact={contact}
          view="expanded"
          subAccountCount={1}
        />
      )

      expect(screen.getByText('1 sub-account')).toBeInTheDocument()
    })

    it('does not render sub-account count when count is 0', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 0,
      })

      render(
        <HierarchyIndicator
          contact={contact}
          view="expanded"
          subAccountCount={0}
        />
      )

      expect(screen.queryByText(/sub-account/)).not.toBeInTheDocument()
    })

    it('renders level badge in expanded view', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 0,
      })

      render(
        <HierarchyIndicator
          contact={contact}
          view="expanded"
          subAccountCount={2}
        />
      )

      expect(screen.getByText('Parent Account')).toBeInTheDocument()
      expect(screen.getByText('2 sub-accounts')).toBeInTheDocument()
      // Level 0 shows "Top Level" instead of numeric level
      expect(screen.queryByText('Level 0')).not.toBeInTheDocument()
    })
  })

  describe('Child Account', () => {
    it('renders child indicator in compact view', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.CHILD,
        parent_id: 'parent-1',
        hierarchy_level: 1,
      })

      render(<HierarchyIndicator contact={contact} view="compact" />)

      expect(screen.getByText('Sub-Account')).toBeInTheDocument()
    })

    it('renders breadcrumb to parent in expanded view', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.CHILD,
        parent_id: 'parent-1',
        hierarchy_level: 1,
      })

      render(
        <HierarchyIndicator
          contact={contact}
          view="expanded"
          parentName="Parent Company"
        />
      )

      expect(screen.getByText('Sub-Account')).toBeInTheDocument()
      expect(screen.getByText('Level 1')).toBeInTheDocument()
      expect(screen.getByText('Parent Company')).toBeInTheDocument()
    })

    it('renders clickable parent link when onNavigateToParent is provided', async () => {
      const user = userEvent.setup()
      const onNavigateToParent = vi.fn()
      const contact = createMockContact({
        account_type: ContactAccountType.CHILD,
        parent_id: 'parent-1',
        hierarchy_level: 1,
      })

      render(
        <HierarchyIndicator
          contact={contact}
          view="expanded"
          parentName="Parent Company"
          onNavigateToParent={onNavigateToParent}
        />
      )

      const parentLink = screen.getByRole('button', {
        name: 'Navigate to parent account: Parent Company',
      })
      expect(parentLink).toBeInTheDocument()

      await user.click(parentLink)
      expect(onNavigateToParent).toHaveBeenCalledWith('parent-1')
      expect(onNavigateToParent).toHaveBeenCalledTimes(1)
    })

    it('renders non-clickable parent text when onNavigateToParent is not provided', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.CHILD,
        parent_id: 'parent-1',
        hierarchy_level: 1,
      })

      render(
        <HierarchyIndicator
          contact={contact}
          view="expanded"
          parentName="Parent Company"
        />
      )

      expect(screen.getByText('Parent Company')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', {
          name: /Navigate to parent account/,
        })
      ).not.toBeInTheDocument()
    })

    it('shows default parent text when parentName is not provided', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.CHILD,
        parent_id: 'parent-1',
        hierarchy_level: 1,
      })

      render(<HierarchyIndicator contact={contact} view="expanded" />)

      expect(screen.getByText('Parent Account')).toBeInTheDocument()
    })
  })

  describe('Hierarchy Levels', () => {
    it('renders correct level badge for Level 1', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.CHILD,
        hierarchy_level: 1,
      })

      render(<HierarchyIndicator contact={contact} view="expanded" />)

      expect(screen.getByText('Level 1')).toBeInTheDocument()
      expect(screen.getByLabelText('Hierarchy depth: Level 1')).toBeInTheDocument()
    })

    it('renders correct level badge for Level 2', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.CHILD,
        hierarchy_level: 2,
      })

      render(<HierarchyIndicator contact={contact} view="expanded" />)

      expect(screen.getByText('Level 2')).toBeInTheDocument()
    })

    it('renders correct level badge for Level 3', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.CHILD,
        hierarchy_level: 3,
      })

      render(<HierarchyIndicator contact={contact} view="expanded" />)

      expect(screen.getByText('Level 3')).toBeInTheDocument()
    })

    it('does not render level badge for level 0', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.STANDALONE,
        hierarchy_level: 0,
      })

      render(<HierarchyIndicator contact={contact} view="expanded" />)

      expect(screen.queryByText(/Level/)).not.toBeInTheDocument()
    })

    it('does not render level badge in compact view', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.CHILD,
        hierarchy_level: 2,
      })

      render(<HierarchyIndicator contact={contact} view="compact" />)

      expect(screen.queryByText('Level 2')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.PARENT,
        hierarchy_level: 0,
      })

      render(
        <HierarchyIndicator
          contact={contact}
          view="expanded"
          subAccountCount={5}
        />
      )

      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Hierarchy information: Parent Account'
      )
    })

    it('supports keyboard navigation for parent link', async () => {
      const user = userEvent.setup()
      const onNavigateToParent = vi.fn()
      const contact = createMockContact({
        account_type: ContactAccountType.CHILD,
        parent_id: 'parent-1',
        hierarchy_level: 1,
      })

      render(
        <HierarchyIndicator
          contact={contact}
          view="expanded"
          parentName="Parent Company"
          onNavigateToParent={onNavigateToParent}
        />
      )

      const parentLink = screen.getByRole('button', {
        name: 'Navigate to parent account: Parent Company',
      })

      parentLink.focus()
      expect(parentLink).toHaveFocus()

      await user.keyboard('{Enter}')
      expect(onNavigateToParent).toHaveBeenCalledWith('parent-1')
    })
  })

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      const contact = createMockContact({
        account_type: ContactAccountType.PARENT,
      })

      const { container } = render(
        <HierarchyIndicator
          contact={contact}
          view="expanded"
          className="custom-class"
        />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })
})
