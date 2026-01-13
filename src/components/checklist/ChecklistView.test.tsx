/**
 * ChecklistView Component Tests
 *
 * Tests for the main checklist container with filtering,
 * item management, and interactions.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChecklistView } from './ChecklistView'
import type { ChecklistProfile } from '../../types/checklist.types'

// Mock the confetti utility
vi.mock('../../utils/confetti', () => ({
  triggerSubtleConfetti: vi.fn(),
}))

// Mock profile data
const createMockProfile = (): ChecklistProfile => {
  const now = new Date()
  return {
    id: 'profile-1',
    userId: 'user-1',
    companyId: 'company-1',
    assessmentProfileId: 'assessment-1',
    phase: 'stabilize',
    businessType: 'service',
    literacyLevel: 'developing',
    categories: [
      {
        id: 'cat-1',
        name: 'Foundation Building',
        description: 'One-time setup tasks',
        type: 'foundation',
        order: 1,
        totalItems: 3,
        completedItems: 1,
        percentComplete: 33,
        items: [
          {
            id: 'item-1',
            categoryId: 'cat-1',
            title: 'Test Item 1',
            description: 'Test description 1',
            explanationLevel: 'brief',
            status: 'completed',
            completedAt: now,
            snoozedUntil: null,
            snoozedReason: null,
            notApplicableReason: null,
            featureLink: null,
            helpArticle: null,
            isCustom: false,
            isReordered: false,
            customOrder: null,
            recurrence: 'once',
            priority: 'high',
            lastDueDate: null,
            nextDueDate: null,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'item-2',
            categoryId: 'cat-1',
            title: 'Test Item 2',
            description: 'Test description 2',
            explanationLevel: 'brief',
            status: 'active',
            completedAt: null,
            snoozedUntil: null,
            snoozedReason: null,
            notApplicableReason: null,
            featureLink: '/test',
            helpArticle: null,
            isCustom: false,
            isReordered: false,
            customOrder: null,
            recurrence: 'once',
            priority: 'medium',
            lastDueDate: null,
            nextDueDate: null,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'item-3',
            categoryId: 'cat-1',
            title: 'Test Item 3',
            description: 'Test description 3',
            explanationLevel: 'brief',
            status: 'snoozed',
            completedAt: null,
            snoozedUntil: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            snoozedReason: 'Test reason',
            notApplicableReason: null,
            featureLink: null,
            helpArticle: null,
            isCustom: false,
            isReordered: false,
            customOrder: null,
            recurrence: 'weekly',
            priority: 'low',
            lastDueDate: null,
            nextDueDate: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    ],
    streaks: {
      weekly: {
        current: 3,
        longest: 5,
        lastCompleted: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        isActiveThisWeek: true,
      },
      monthly: {
        current: 1,
        longest: 1,
        lastCompleted: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        isActiveThisMonth: true,
      },
      encouragement: "You're building real momentum!",
    },
    milestones: [],
    createdAt: now,
    updatedAt: now,
    generatedAt: now,
  }
}

describe('ChecklistView', () => {
  // Rendering tests
  describe('Rendering', () => {
    it('renders loading state', () => {
      render(
        <ChecklistView
          profile={null}
          isLoading={true}
          onCompleteItem={vi.fn()}
          onUncompleteItem={vi.fn()}
          onSnoozeItem={vi.fn()}
          onMarkNotApplicable={vi.fn()}
        />,
      )

      expect(screen.getByText('Loading your checklist...')).toBeInTheDocument()
    })

    it('renders empty state when no profile', () => {
      render(
        <ChecklistView
          profile={null}
          isLoading={false}
          onCompleteItem={vi.fn()}
          onUncompleteItem={vi.fn()}
          onSnoozeItem={vi.fn()}
          onMarkNotApplicable={vi.fn()}
        />,
      )

      expect(
        screen.getByText(/No checklist found. Complete your assessment/),
      ).toBeInTheDocument()
    })

    it('renders checklist with profile data', () => {
      const profile = createMockProfile()
      render(
        <ChecklistView
          profile={profile}
          onCompleteItem={vi.fn()}
          onUncompleteItem={vi.fn()}
          onSnoozeItem={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          enableAnimations={false}
        />,
      )

      expect(screen.getByText('Your Checklist')).toBeInTheDocument()
      // Foundation Building appears multiple times (category name and in recent completions)
      expect(screen.getAllByText('Foundation Building').length).toBeGreaterThan(0)
    })

    it('renders filter tabs with counts', () => {
      const profile = createMockProfile()
      render(
        <ChecklistView
          profile={profile}
          onCompleteItem={vi.fn()}
          onUncompleteItem={vi.fn()}
          onSnoozeItem={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          enableAnimations={false}
        />,
      )

      expect(screen.getByRole('tab', { name: /All/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Active/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Completed/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Snoozed/i })).toBeInTheDocument()
    })

    it('renders progress sidebar', () => {
      const profile = createMockProfile()
      render(
        <ChecklistView
          profile={profile}
          onCompleteItem={vi.fn()}
          onUncompleteItem={vi.fn()}
          onSnoozeItem={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          enableAnimations={false}
        />,
      )

      expect(screen.getByText('Overall Progress')).toBeInTheDocument()
      expect(screen.getByText('Your Streak')).toBeInTheDocument()
    })

    it('renders category sections collapsed by default', async () => {
      const profile = createMockProfile()
      render(
        <ChecklistView
          profile={profile}
          onCompleteItem={vi.fn()}
          onUncompleteItem={vi.fn()}
          onSnoozeItem={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          enableAnimations={false}
        />,
      )

      const categoryButton = screen.getByRole('button', { name: /Foundation Building/ })
      expect(categoryButton).toHaveAttribute('aria-expanded', 'false')

      // Item checkboxes should not be visible initially (though item title may appear in recent completions)
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })
  })

  // Interaction tests
  describe('Interactions', () => {
    it('expands category when clicked', async () => {
      const user = userEvent.setup()
      const profile = createMockProfile()

      render(
        <ChecklistView
          profile={profile}
          onCompleteItem={vi.fn()}
          onUncompleteItem={vi.fn()}
          onSnoozeItem={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          enableAnimations={false}
        />,
      )

      const categoryButton = screen.getByRole('button', { name: /Foundation Building/ })
      await user.click(categoryButton)

      expect(categoryButton).toHaveAttribute('aria-expanded', 'true')
      // Check for checkboxes instead of text that might appear in multiple places
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThan(0)
    })

    it('calls onCompleteItem when item is completed', async () => {
      const user = userEvent.setup()
      const onCompleteItem = vi.fn()
      const profile = createMockProfile()

      render(
        <ChecklistView
          profile={profile}
          onCompleteItem={onCompleteItem}
          onUncompleteItem={vi.fn()}
          onSnoozeItem={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          enableAnimations={false}
        />,
      )

      // Expand category
      const categoryButton = screen.getByRole('button', { name: /Foundation Building/ })
      await user.click(categoryButton)

      // Click checkbox for active item
      const checkboxes = screen.getAllByRole('checkbox')
      const activeCheckbox = checkboxes.find((cb) => cb.getAttribute('aria-checked') === 'false')
      if (activeCheckbox) {
        await user.click(activeCheckbox)
        expect(onCompleteItem).toHaveBeenCalled()
      }
    })

    it('opens snooze modal when snooze is clicked', async () => {
      const user = userEvent.setup()
      const profile = createMockProfile()

      render(
        <ChecklistView
          profile={profile}
          onCompleteItem={vi.fn()}
          onUncompleteItem={vi.fn()}
          onSnoozeItem={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          enableAnimations={false}
        />,
      )

      // Expand category
      const categoryButton = screen.getByRole('button', { name: /Foundation Building/ })
      await user.click(categoryButton)

      // Open actions menu for an item
      const actionsButtons = screen.getAllByLabelText('Show actions menu')
      await user.click(actionsButtons[0]!)

      // Click snooze
      const snoozeButton = screen.getByText('Snooze')
      await user.click(snoozeButton)

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText('Snooze Item')).toBeInTheDocument()
      })
    })

    it('searches for items', async () => {
      const user = userEvent.setup()
      const profile = createMockProfile()

      render(
        <ChecklistView
          profile={profile}
          onCompleteItem={vi.fn()}
          onUncompleteItem={vi.fn()}
          onSnoozeItem={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          enableAnimations={false}
        />,
      )

      const searchInput = screen.getByPlaceholderText('Search checklist items...')
      await user.type(searchInput, 'Test Item 2')

      // Should filter items (need to expand to see)
      const categoryButton = screen.getByRole('button', { name: /Foundation Building/ })
      await user.click(categoryButton)

      expect(screen.getByText('Test Item 2')).toBeInTheDocument()
    })
  })

  // Filtering tests
  describe('Filtering', () => {
    it('filters by view mode - Active', async () => {
      const user = userEvent.setup()
      const profile = createMockProfile()

      render(
        <ChecklistView
          profile={profile}
          onCompleteItem={vi.fn()}
          onUncompleteItem={vi.fn()}
          onSnoozeItem={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          enableAnimations={false}
        />,
      )

      const activeTab = screen.getByRole('tab', { name: /Active/i })
      await user.click(activeTab)

      // Expand category
      const categoryButton = screen.getByRole('button', { name: /Foundation Building/ })
      await user.click(categoryButton)

      // Should only show active items in the list (Test Item 2)
      expect(screen.getByText('Test Item 2')).toBeInTheDocument()
      // Test Item 1 still appears in "Recent Completions" sidebar, so we can't test for its absence
      // Instead, verify that there's only 1 checkbox (for Test Item 2)
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBe(1)
    })

    it('filters by view mode - Completed', async () => {
      const user = userEvent.setup()
      const profile = createMockProfile()

      render(
        <ChecklistView
          profile={profile}
          onCompleteItem={vi.fn()}
          onUncompleteItem={vi.fn()}
          onSnoozeItem={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          enableAnimations={false}
        />,
      )

      const completedTab = screen.getByRole('tab', { name: /Completed/i })
      await user.click(completedTab)

      // Expand category
      const categoryButton = screen.getByRole('button', { name: /Foundation Building/ })
      await user.click(categoryButton)

      // Should only show completed items (Test Item 1 appears in both list and recent completions)
      expect(screen.getAllByText('Test Item 1').length).toBeGreaterThan(0)
      expect(screen.queryByText('Test Item 2')).not.toBeInTheDocument() // Active
    })

    it('shows no results message when no items match filters', async () => {
      const user = userEvent.setup()
      const profile = createMockProfile()

      render(
        <ChecklistView
          profile={profile}
          onCompleteItem={vi.fn()}
          onUncompleteItem={vi.fn()}
          onSnoozeItem={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          enableAnimations={false}
        />,
      )

      // Search for something that doesn't exist
      const searchInput = screen.getByPlaceholderText('Search checklist items...')
      await user.type(searchInput, 'nonexistent item xyz')

      expect(
        screen.getByText(/No items found matching your filters/),
      ).toBeInTheDocument()
    })
  })

  // Accessibility tests
  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      const profile = createMockProfile()
      render(
        <ChecklistView
          profile={profile}
          onCompleteItem={vi.fn()}
          onUncompleteItem={vi.fn()}
          onSnoozeItem={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          enableAnimations={false}
        />,
      )

      expect(screen.getByRole('heading', { level: 2, name: 'Your Checklist' })).toBeInTheDocument()
    })

    it('has searchable region', () => {
      const profile = createMockProfile()
      render(
        <ChecklistView
          profile={profile}
          onCompleteItem={vi.fn()}
          onUncompleteItem={vi.fn()}
          onSnoozeItem={vi.fn()}
          onMarkNotApplicable={vi.fn()}
          enableAnimations={false}
        />,
      )

      expect(screen.getByRole('search', { name: 'Checklist filters' })).toBeInTheDocument()
    })
  })
})
