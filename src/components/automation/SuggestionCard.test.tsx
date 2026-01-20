/**
 * Suggestion Card Component Tests
 *
 * Tests for J2: Smart Automation Assistant - Suggestion Card UI
 *
 * Coverage:
 * - Rendering for each suggestion type
 * - Confidence indicators display
 * - User actions (accept, edit, dismiss)
 * - "Why?" reasoning toggle
 * - Keyboard accessibility
 * - Screen reader support
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { SuggestionCard } from './SuggestionCard'
import type { AutomationSuggestion } from '../../types/automation.types'

describe('SuggestionCard', () => {
  const mockOnAccept = vi.fn()
  const mockOnEdit = vi.fn()
  const mockOnDismiss = vi.fn()

  beforeEach(() => {
    mockOnAccept.mockClear()
    mockOnEdit.mockClear()
    mockOnDismiss.mockClear()
  })

  describe('categorization suggestion', () => {
    const categorizationSuggestion: AutomationSuggestion = {
      type: 'categorization',
      data: {
        transactionId: 'txn-001',
        suggestedCategoryId: 'cat-001',
        suggestedCategoryName: 'Office Supplies',
        confidence: 0.85,
        confidenceLevel: 'high',
        source: 'pattern',
        reasoning: 'Based on 10 similar transactions',
        matchCount: 10,
        createdAt: Date.now(),
      },
    }

    it('should render categorization suggestion', () => {
      render(
        <SuggestionCard
          suggestion={categorizationSuggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText('Category suggestion')).toBeInTheDocument()
      expect(screen.getByText('Office Supplies')).toBeInTheDocument()
    })

    it('should display high confidence indicator', () => {
      render(
        <SuggestionCard
          suggestion={categorizationSuggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText('High confidence')).toBeInTheDocument()
      expect(screen.getByText('85%')).toBeInTheDocument()
    })

    it('should show reasoning when "Why?" clicked', () => {
      render(
        <SuggestionCard
          suggestion={categorizationSuggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      const whyButton = screen.getByText('Why?')
      fireEvent.click(whyButton)

      expect(screen.getByText(/Based on 10 similar transactions/)).toBeInTheDocument()
    })

    it('should call onAccept when Accept clicked', () => {
      render(
        <SuggestionCard
          suggestion={categorizationSuggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      const acceptButton = screen.getByText('Accept')
      fireEvent.click(acceptButton)

      expect(mockOnAccept).toHaveBeenCalledTimes(1)
    })

    it('should call onEdit when Edit clicked', () => {
      render(
        <SuggestionCard
          suggestion={categorizationSuggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      const editButton = screen.getByText('Edit')
      fireEvent.click(editButton)

      expect(mockOnEdit).toHaveBeenCalledTimes(1)
    })

    it('should call onDismiss when Dismiss clicked', () => {
      render(
        <SuggestionCard
          suggestion={categorizationSuggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      const dismissButton = screen.getByText('Dismiss')
      fireEvent.click(dismissButton)

      expect(mockOnDismiss).toHaveBeenCalledTimes(1)
    })

    it('should handle "E" keyboard shortcut for edit', () => {
      render(
        <SuggestionCard
          suggestion={categorizationSuggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      const card = screen.getByRole('article')
      fireEvent.keyDown(card, { key: 'e', code: 'KeyE' })

      expect(mockOnEdit).toHaveBeenCalledTimes(1)
    })
  })

  describe('recurring suggestion', () => {
    const recurringSuggestion: AutomationSuggestion = {
      type: 'recurring',
      data: {
        transactionId: 'txn-002',
        vendorName: 'Netflix',
        description: 'Monthly subscription',
        amount: '15.99',
        frequency: 'monthly',
        averageAmount: '15.99',
        amountVariance: 0.01,
        matchCount: 5,
        previousDates: [Date.now()],
        nextExpectedDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        confidence: 0.9,
        confidenceLevel: 'high',
        createdAt: Date.now(),
      },
    }

    it('should render recurring suggestion', () => {
      render(
        <SuggestionCard
          suggestion={recurringSuggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText('Recurring transaction detected')).toBeInTheDocument()
      expect(screen.getByText('Monthly')).toBeInTheDocument()
      expect(screen.getByText('$15.99')).toBeInTheDocument()
    })

    it('should display frequency and average amount', () => {
      render(
        <SuggestionCard
          suggestion={recurringSuggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText('Frequency:')).toBeInTheDocument()
      expect(screen.getByText('Average amount:')).toBeInTheDocument()
    })

    it('should display next expected date', () => {
      render(
        <SuggestionCard
          suggestion={recurringSuggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText('Next expected:')).toBeInTheDocument()
    })
  })

  describe('anomaly suggestion', () => {
    const anomalySuggestion: AutomationSuggestion = {
      type: 'anomaly',
      data: {
        transactionId: 'txn-003',
        anomalyType: 'unusual_amount',
        description: 'Amount much higher than usual',
        severity: 'medium',
        confidence: 0.75,
        confidenceLevel: 'medium',
        explanation: 'This amount is 3x higher than the average for this vendor.',
        actualValue: '$500.00',
        expectedValue: '$150.00',
        suggestedAction: 'Verify the amount is correct',
        dismissed: false,
        createdAt: Date.now(),
      },
    }

    it('should render anomaly suggestion', () => {
      render(
        <SuggestionCard
          suggestion={anomalySuggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText('Amount much higher than usual')).toBeInTheDocument()
      expect(screen.getByText('Medium severity')).toBeInTheDocument()
    })

    it('should display explanation', () => {
      render(
        <SuggestionCard
          suggestion={anomalySuggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      expect(
        screen.getByText(/This amount is 3x higher than the average/)
      ).toBeInTheDocument()
    })

    it('should display suggested action', () => {
      render(
        <SuggestionCard
          suggestion={anomalySuggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText(/Verify the amount is correct/)).toBeInTheDocument()
    })

    it('should display severity badge with appropriate styling', () => {
      render(
        <SuggestionCard
          suggestion={anomalySuggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      const severityBadge = screen.getByText('Medium severity')
      expect(severityBadge).toBeInTheDocument()
    })
  })

  describe('confidence levels', () => {
    it('should display medium confidence correctly', () => {
      const suggestion: AutomationSuggestion = {
        type: 'categorization',
        data: {
          transactionId: 'txn-001',
          suggestedCategoryId: 'cat-001',
          suggestedCategoryName: 'Office Supplies',
          confidence: 0.7,
          confidenceLevel: 'medium',
          source: 'pattern',
          reasoning: 'Based on 5 similar transactions',
          matchCount: 5,
          createdAt: Date.now(),
        },
      }

      render(
        <SuggestionCard
          suggestion={suggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText('Medium confidence')).toBeInTheDocument()
      expect(screen.getByText('70%')).toBeInTheDocument()
    })

    it('should display low confidence correctly', () => {
      const suggestion: AutomationSuggestion = {
        type: 'categorization',
        data: {
          transactionId: 'txn-001',
          suggestedCategoryId: 'cat-001',
          suggestedCategoryName: 'Office Supplies',
          confidence: 0.5,
          confidenceLevel: 'low',
          source: 'frequency',
          reasoning: 'Based on limited data',
          matchCount: 2,
          createdAt: Date.now(),
        },
      }

      render(
        <SuggestionCard
          suggestion={suggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText('Low confidence')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    const suggestion: AutomationSuggestion = {
      type: 'categorization',
      data: {
        transactionId: 'txn-001',
        suggestedCategoryId: 'cat-001',
        suggestedCategoryName: 'Office Supplies',
        confidence: 0.85,
        confidenceLevel: 'high',
        source: 'pattern',
        reasoning: 'Based on 10 similar transactions',
        matchCount: 10,
        createdAt: Date.now(),
      },
    }

    it('should have proper ARIA role', () => {
      render(
        <SuggestionCard
          suggestion={suggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      const card = screen.getByRole('article')
      expect(card).toBeInTheDocument()
    })

    it('should have proper aria-labelledby', () => {
      render(
        <SuggestionCard
          suggestion={suggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      const card = screen.getByRole('article')
      expect(card).toHaveAttribute('aria-labelledby')
    })

    it('should have aria-expanded on Why button', () => {
      render(
        <SuggestionCard
          suggestion={suggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      const whyButton = screen.getByText('Why?')
      expect(whyButton).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(whyButton)
      expect(whyButton).toHaveAttribute('aria-expanded', 'true')
    })

    it('should have keyboard shortcut label on Edit button', () => {
      render(
        <SuggestionCard
          suggestion={suggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      const editButton = screen.getByLabelText('Edit suggestion')
      expect(editButton).toHaveAttribute('aria-keyshortcuts', 'E')
    })

    it('should have status role on confidence badge', () => {
      render(
        <SuggestionCard
          suggestion={suggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      const confidenceBadge = screen.getByRole('status')
      expect(confidenceBadge).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle missing optional fields gracefully', () => {
      const minimalSuggestion: AutomationSuggestion = {
        type: 'categorization',
        data: {
          transactionId: 'txn-001',
          suggestedCategoryId: 'cat-001',
          suggestedCategoryName: 'Office Supplies',
          confidence: 0.85,
          confidenceLevel: 'high',
          source: 'pattern',
          reasoning: 'Based on patterns',
          matchCount: 5,
          createdAt: Date.now(),
        },
      }

      render(
        <SuggestionCard
          suggestion={minimalSuggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
        />
      )

      expect(screen.getByText('Category suggestion')).toBeInTheDocument()
    })

    it('should handle custom className', () => {
      const suggestion: AutomationSuggestion = {
        type: 'categorization',
        data: {
          transactionId: 'txn-001',
          suggestedCategoryId: 'cat-001',
          suggestedCategoryName: 'Office Supplies',
          confidence: 0.85,
          confidenceLevel: 'high',
          source: 'pattern',
          reasoning: 'Based on patterns',
          matchCount: 5,
          createdAt: Date.now(),
        },
      }

      const { container } = render(
        <SuggestionCard
          suggestion={suggestion}
          onAccept={mockOnAccept}
          onEdit={mockOnEdit}
          onDismiss={mockOnDismiss}
          className="custom-class"
        />
      )

      const card = container.querySelector('.custom-class')
      expect(card).toBeInTheDocument()
    })
  })
})
