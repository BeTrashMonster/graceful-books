/**
 * ChecklistProgress Component Tests
 *
 * Tests for progress visualization with category breakdown
 * and encouraging messages.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChecklistProgress } from './ChecklistProgress'
import type { ChecklistProgress as ChecklistProgressType } from '../../types/checklist.types'

// Mock progress data
const createMockProgress = (
  overrides?: Partial<ChecklistProgressType>,
): ChecklistProgressType => ({
  overall: {
    totalItems: 10,
    completedItems: 5,
    percentComplete: 50,
  },
  byCategory: {
    'cat-1': {
      name: 'Foundation',
      totalItems: 5,
      completedItems: 3,
      percentComplete: 60,
      trend: 'improving',
    },
    'cat-2': {
      name: 'Weekly',
      totalItems: 5,
      completedItems: 2,
      percentComplete: 40,
      trend: 'stable',
    },
  },
  recentCompletions: [
    {
      item: {
        id: 'item-1',
        categoryId: 'cat-1',
        title: 'Test Item 1',
        description: 'Test',
        explanationLevel: 'brief',
        status: 'completed',
        completedAt: new Date(),
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
      },
      completedAt: new Date(),
      categoryName: 'Foundation',
    },
  ],
  upcomingDue: [],
  ...overrides,
})

describe('ChecklistProgress', () => {
  // Rendering tests
  describe('Rendering', () => {
    it('renders overall progress section', () => {
      const progress = createMockProgress()
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      expect(screen.getByText('Overall Progress')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.getByText('5 of 10 completed')).toBeInTheDocument()
    })

    it('renders progress bar with correct attributes', () => {
      const progress = createMockProgress()
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      const progressBar = screen.getByRole('progressbar', { name: /Overall progress/ })
      expect(progressBar).toHaveAttribute('aria-valuenow', '50')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    })

    it('renders encouraging message', () => {
      const progress = createMockProgress()
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      expect(
        screen.getByText(/More than halfway there! Your financial foundation is taking shape/),
      ).toBeInTheDocument()
    })

    it('renders category breakdown when enabled', () => {
      const progress = createMockProgress()
      render(
        <ChecklistProgress
          progress={progress}
          showCategoryBreakdown
          enableAnimations={false}
        />,
      )

      expect(screen.getByText('By Category')).toBeInTheDocument()
      expect(screen.getByText('Foundation')).toBeInTheDocument()
      expect(screen.getByText('Weekly')).toBeInTheDocument()
      expect(screen.getByText('3 / 5 items')).toBeInTheDocument()
      expect(screen.getByText('2 / 5 items')).toBeInTheDocument()
    })

    it('does not render category breakdown when disabled', () => {
      const progress = createMockProgress()
      render(
        <ChecklistProgress
          progress={progress}
          showCategoryBreakdown={false}
          enableAnimations={false}
        />,
      )

      expect(screen.queryByText('By Category')).not.toBeInTheDocument()
    })

    it('renders recent completions', () => {
      const progress = createMockProgress()
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      expect(screen.getByText('Recently Completed')).toBeInTheDocument()
      expect(screen.getByText('Test Item 1')).toBeInTheDocument()
      expect(screen.getByText('in Foundation')).toBeInTheDocument()
    })

    it('renders trend icons for categories', () => {
      const progress = createMockProgress()
      render(
        <ChecklistProgress
          progress={progress}
          showCategoryBreakdown
          enableAnimations={false}
        />,
      )

      // Improving trend icon
      const improvingTrend = screen.getByLabelText('Trend: improving')
      expect(improvingTrend).toHaveTextContent('↗')

      // Stable trend icon
      const stableTrend = screen.getByLabelText('Trend: stable')
      expect(stableTrend).toHaveTextContent('→')
    })
  })

  // Encouraging messages tests
  describe('Encouraging Messages', () => {
    it('shows start message for 0% progress', () => {
      const progress = createMockProgress({
        overall: { totalItems: 10, completedItems: 0, percentComplete: 0 },
      })
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      expect(
        screen.getByText("Ready to get started? Check off your first task!"),
      ).toBeInTheDocument()
    })

    it('shows early progress message for <10% progress', () => {
      const progress = createMockProgress({
        overall: { totalItems: 10, completedItems: 1, percentComplete: 5 },
      })
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      expect(
        screen.getByText("Great start! Every journey begins with a single step."),
      ).toBeInTheDocument()
    })

    it('shows momentum message for 10-25% progress', () => {
      const progress = createMockProgress({
        overall: { totalItems: 10, completedItems: 2, percentComplete: 20 },
      })
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      expect(screen.getByText("You're building momentum. Keep going!")).toBeInTheDocument()
    })

    it('shows progress message for 25-50% progress', () => {
      const progress = createMockProgress({
        overall: { totalItems: 10, completedItems: 4, percentComplete: 40 },
      })
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      expect(screen.getByText("Look at you go! You're making real progress.")).toBeInTheDocument()
    })

    it('shows halfway message for 50-75% progress', () => {
      const progress = createMockProgress({
        overall: { totalItems: 10, completedItems: 6, percentComplete: 60 },
      })
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      expect(
        screen.getByText("More than halfway there! Your financial foundation is taking shape."),
      ).toBeInTheDocument()
    })

    it('shows almost done message for 75-100% progress', () => {
      const progress = createMockProgress({
        overall: { totalItems: 10, completedItems: 9, percentComplete: 90 },
      })
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      expect(screen.getByText("Almost there! You're doing amazing work.")).toBeInTheDocument()
    })

    it('shows complete message for 100% progress', () => {
      const progress = createMockProgress({
        overall: { totalItems: 10, completedItems: 10, percentComplete: 100 },
      })
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      expect(screen.getByText("Foundation complete! You're ready to build.")).toBeInTheDocument()
    })
  })

  // Accessibility tests
  describe('Accessibility', () => {
    it('has proper region label', () => {
      const progress = createMockProgress()
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      expect(screen.getByRole('region', { name: 'Checklist progress' })).toBeInTheDocument()
    })

    it('has live region for progress percentage', () => {
      const progress = createMockProgress()
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      const percentage = screen.getByText('50%')
      expect(percentage).toHaveAttribute('aria-live', 'polite')
    })

    it('has live region for encouraging message', () => {
      const progress = createMockProgress()
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      const message = screen.getByText(/More than halfway there/)
      expect(message).toHaveAttribute('aria-live', 'polite')
    })

    it('has proper progressbar labels for categories', () => {
      const progress = createMockProgress()
      render(
        <ChecklistProgress
          progress={progress}
          showCategoryBreakdown
          enableAnimations={false}
        />,
      )

      expect(
        screen.getByRole('progressbar', { name: 'Foundation: 60 percent complete' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('progressbar', { name: 'Weekly: 40 percent complete' }),
      ).toBeInTheDocument()
    })
  })

  // Edge cases
  describe('Edge Cases', () => {
    it('handles zero items gracefully', () => {
      const progress = createMockProgress({
        overall: { totalItems: 0, completedItems: 0, percentComplete: 0 },
        byCategory: {},
        recentCompletions: [],
      })
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      expect(screen.getByText('0 of 0 completed')).toBeInTheDocument()
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('handles empty category breakdown', () => {
      const progress = createMockProgress({
        byCategory: {},
      })
      render(
        <ChecklistProgress
          progress={progress}
          showCategoryBreakdown
          enableAnimations={false}
        />,
      )

      expect(screen.queryByText('By Category')).not.toBeInTheDocument()
    })

    it('handles empty recent completions', () => {
      const progress = createMockProgress({
        recentCompletions: [],
      })
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      expect(screen.queryByText('Recently Completed')).not.toBeInTheDocument()
    })

    it('limits recent completions to 3 items', () => {
      const progress = createMockProgress({
        recentCompletions: [1, 2, 3, 4, 5].map((i) => ({
          item: {
            id: `item-${i}`,
            categoryId: 'cat-1',
            title: `Test Item ${i}`,
            description: 'Test',
            explanationLevel: 'brief' as const,
            status: 'completed' as const,
            completedAt: new Date(),
            snoozedUntil: null,
            snoozedReason: null,
            notApplicableReason: null,
            featureLink: null,
            helpArticle: null,
            isCustom: false,
            isReordered: false,
            customOrder: null,
            recurrence: 'once' as const,
            priority: 'medium' as const,
            lastDueDate: null,
            nextDueDate: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          completedAt: new Date(),
          categoryName: 'Foundation',
        })),
      })
      render(<ChecklistProgress progress={progress} enableAnimations={false} />)

      // Should only show first 3 items
      expect(screen.getByText('Test Item 1')).toBeInTheDocument()
      expect(screen.getByText('Test Item 2')).toBeInTheDocument()
      expect(screen.getByText('Test Item 3')).toBeInTheDocument()
      expect(screen.queryByText('Test Item 4')).not.toBeInTheDocument()
      expect(screen.queryByText('Test Item 5')).not.toBeInTheDocument()
    })
  })
})
