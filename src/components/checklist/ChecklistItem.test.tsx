/**
 * ChecklistItem Component Tests
 *
 * Tests for interactive checklist item with accessibility,
 * keyboard navigation, and user interactions.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChecklistItem } from './ChecklistItem'
import type { ChecklistItem as ChecklistItemType } from '../../types/checklist.types'

// Mock item data
const createMockItem = (overrides?: Partial<ChecklistItemType>): ChecklistItemType => ({
  id: 'item-1',
  categoryId: 'cat-1',
  title: 'Test Item',
  description: 'Test description',
  explanationLevel: 'brief',
  status: 'active',
  completedAt: null,
  snoozedUntil: null,
  snoozedReason: null,
  notApplicableReason: null,
  featureLink: null,
  helpArticle: null,
  isCustom: false,
  isReordered: false,
  customOrder: null,
  recurrence: 'once',
  priority: 'medium',
  lastDueDate: null,
  nextDueDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('ChecklistItem', () => {
  // Basic rendering tests
  describe('Rendering', () => {
    it('renders item title and description', () => {
      const item = createMockItem()
      render(
        <ChecklistItem
          item={item}
          onComplete={vi.fn()}
          onUncomplete={vi.fn()}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
        />,
      )

      expect(screen.getByText('Test Item')).toBeInTheDocument()
      expect(screen.getByText('Test description')).toBeInTheDocument()
    })

    it('renders checkbox for active items', () => {
      const item = createMockItem({ status: 'active' })
      render(
        <ChecklistItem
          item={item}
          onComplete={vi.fn()}
          onUncomplete={vi.fn()}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
        />,
      )

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).toHaveAttribute('aria-checked', 'false')
    })

    it('renders checked checkbox for completed items', () => {
      const item = createMockItem({ status: 'completed', completedAt: new Date() })
      render(
        <ChecklistItem
          item={item}
          onComplete={vi.fn()}
          onUncomplete={vi.fn()}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
        />,
      )

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toHaveAttribute('aria-checked', 'true')
    })

    it('renders recurrence badge for recurring items', () => {
      const item = createMockItem({ recurrence: 'weekly' })
      render(
        <ChecklistItem
          item={item}
          onComplete={vi.fn()}
          onUncomplete={vi.fn()}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
        />,
      )

      expect(screen.getByText('Weekly')).toBeInTheDocument()
    })

    it('renders custom badge for custom items', () => {
      const item = createMockItem({ isCustom: true })
      render(
        <ChecklistItem
          item={item}
          onComplete={vi.fn()}
          onUncomplete={vi.fn()}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
        />,
      )

      expect(screen.getByText('Custom')).toBeInTheDocument()
    })

    it('renders feature link button when featureLink is provided', () => {
      const item = createMockItem({ featureLink: '/test-feature' })
      render(
        <ChecklistItem
          item={item}
          onComplete={vi.fn()}
          onUncomplete={vi.fn()}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
        />,
      )

      expect(screen.getByText('Go to feature →')).toBeInTheDocument()
    })

    it('renders snoozed badge when item is snoozed', () => {
      const snoozedUntil = new Date('2026-02-01')
      const item = createMockItem({ status: 'snoozed', snoozedUntil })
      render(
        <ChecklistItem
          item={item}
          onComplete={vi.fn()}
          onUncomplete={vi.fn()}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
        />,
      )

      expect(screen.getByText(/Snoozed until/)).toBeInTheDocument()
    })

    it('renders not applicable reason when item is not applicable', () => {
      const item = createMockItem({
        status: 'not-applicable',
        notApplicableReason: 'Test reason',
      })
      render(
        <ChecklistItem
          item={item}
          onComplete={vi.fn()}
          onUncomplete={vi.fn()}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
        />,
      )

      expect(screen.getByText(/Not applicable: Test reason/)).toBeInTheDocument()
    })
  })

  // Interaction tests
  describe('Interactions', () => {
    it('calls onComplete when checkbox is clicked', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()
      const item = createMockItem({ status: 'active' })

      render(
        <ChecklistItem
          item={item}
          onComplete={onComplete}
          onUncomplete={vi.fn()}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          enableAnimations={false}
        />,
      )

      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)

      expect(onComplete).toHaveBeenCalledWith('item-1')
    })

    it('calls onUncomplete when completed checkbox is clicked', async () => {
      const user = userEvent.setup()
      const onUncomplete = vi.fn()
      const item = createMockItem({ status: 'completed', completedAt: new Date() })

      render(
        <ChecklistItem
          item={item}
          onComplete={vi.fn()}
          onUncomplete={onUncomplete}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
        />,
      )

      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)

      expect(onUncomplete).toHaveBeenCalledWith('item-1')
    })

    it('calls onFeatureLinkClick when feature link is clicked', async () => {
      const user = userEvent.setup()
      const onFeatureLinkClick = vi.fn()
      const item = createMockItem({ featureLink: '/test-feature' })

      render(
        <ChecklistItem
          item={item}
          onComplete={vi.fn()}
          onUncomplete={vi.fn()}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          onFeatureLinkClick={onFeatureLinkClick}
        />,
      )

      const link = screen.getByText('Go to feature →')
      await user.click(link)

      expect(onFeatureLinkClick).toHaveBeenCalledWith('/test-feature')
    })

    it('opens actions menu when actions button is clicked', async () => {
      const user = userEvent.setup()
      const item = createMockItem()

      render(
        <ChecklistItem
          item={item}
          onComplete={vi.fn()}
          onUncomplete={vi.fn()}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
        />,
      )

      const actionsButton = screen.getByLabelText('Show actions menu')
      await user.click(actionsButton)

      expect(screen.getByRole('menu')).toBeInTheDocument()
      expect(screen.getByText('Snooze')).toBeInTheDocument()
      expect(screen.getByText('Not applicable')).toBeInTheDocument()
    })

    it('calls onSnooze when snooze menu item is clicked', async () => {
      const user = userEvent.setup()
      const onSnooze = vi.fn()
      const item = createMockItem()

      render(
        <ChecklistItem
          item={item}
          onComplete={vi.fn()}
          onUncomplete={vi.fn()}
          onSnooze={onSnooze}
          onMarkNotApplicable={vi.fn()}
        />,
      )

      const actionsButton = screen.getByLabelText('Show actions menu')
      await user.click(actionsButton)

      const snoozeButton = screen.getByText('Snooze')
      await user.click(snoozeButton)

      expect(onSnooze).toHaveBeenCalledWith('item-1')
    })

    it('calls onDelete when delete menu item is clicked for custom items', async () => {
      const user = userEvent.setup()
      const onDelete = vi.fn()
      const item = createMockItem({ isCustom: true })

      render(
        <ChecklistItem
          item={item}
          onComplete={vi.fn()}
          onUncomplete={vi.fn()}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          onDelete={onDelete}
        />,
      )

      const actionsButton = screen.getByLabelText('Show actions menu')
      await user.click(actionsButton)

      const deleteButton = screen.getByText('Delete')
      await user.click(deleteButton)

      expect(onDelete).toHaveBeenCalledWith('item-1')
    })
  })

  // Keyboard navigation tests
  describe('Keyboard Navigation', () => {
    it('toggles checkbox with Space key', async () => {
      const user = userEvent.setup()
      const onComplete = vi.fn()
      const item = createMockItem({ status: 'active' })

      render(
        <ChecklistItem
          item={item}
          onComplete={onComplete}
          onUncomplete={vi.fn()}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          enableAnimations={false}
        />,
      )

      const checkbox = screen.getByRole('checkbox')
      checkbox.focus()
      await user.keyboard(' ')

      expect(onComplete).toHaveBeenCalledWith('item-1')
    })

    it('toggles actions menu with Enter key', async () => {
      const user = userEvent.setup()
      const item = createMockItem()

      render(
        <ChecklistItem
          item={item}
          onComplete={vi.fn()}
          onUncomplete={vi.fn()}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
        />,
      )

      const checkbox = screen.getByRole('checkbox')
      checkbox.focus()
      await user.keyboard('{Enter}')

      expect(screen.getByRole('menu')).toBeInTheDocument()
    })
  })

  // Accessibility tests
  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      const item = createMockItem()
      render(
        <ChecklistItem
          item={item}
          onComplete={vi.fn()}
          onUncomplete={vi.fn()}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
        />,
      )

      expect(screen.getByRole('article')).toHaveAttribute(
        'aria-label',
        'Checklist item: Test Item',
      )
      expect(screen.getByRole('checkbox')).toHaveAttribute(
        'aria-label',
        'Check Test Item',
      )
    })

    it('has proper role for actions menu', async () => {
      const user = userEvent.setup()
      const item = createMockItem()

      render(
        <ChecklistItem
          item={item}
          onComplete={vi.fn()}
          onUncomplete={vi.fn()}
          onSnooze={vi.fn()}
          onMarkNotApplicable={vi.fn()}
        />,
      )

      const actionsButton = screen.getByLabelText('Show actions menu')
      expect(actionsButton).toHaveAttribute('aria-haspopup', 'menu')
      expect(actionsButton).toHaveAttribute('aria-expanded', 'false')

      await user.click(actionsButton)

      expect(actionsButton).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })
  })
})
