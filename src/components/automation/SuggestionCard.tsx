/**
 * Suggestion Card Component
 *
 * Displays automation suggestions (categorization, recurring, anomaly) with
 * confidence indicators and user action options.
 *
 * Requirements:
 * - J2: Smart Automation Assistant
 * - WCAG 2.1 AA compliance
 * - Keyboard accessible (Tab, Enter, E for edit)
 * - Screen reader support
 * - Confidence indicators with icons + text (not just color)
 * - "Why?" button to show reasoning
 * - One-click accept or edit
 */

import { useState } from 'react'
import clsx from 'clsx'
import { Card, CardBody, CardFooter } from '../ui/Card'
import { Button } from '../core/Button'
import type {
  CategorizationSuggestion,
  RecurringTransactionMatch,
  TransactionAnomaly,
  AutomationSuggestion,
} from '../../types/automation.types'
import styles from './SuggestionCard.module.css'

export interface SuggestionCardProps {
  suggestion: AutomationSuggestion
  onAccept: () => void
  onEdit: () => void
  onDismiss: () => void
  className?: string
}

/**
 * Suggestion Card Component
 *
 * Displays automation suggestions with confidence indicators and actions.
 *
 * WCAG Compliance:
 * - Keyboard navigation: Tab to navigate, Enter to accept, E to edit
 * - Screen reader: Announces suggestion type, confidence, and reasoning
 * - Color + icons: Not relying on color alone for confidence
 * - Focus indicators: Visible focus states on all interactive elements
 *
 * @example
 * ```tsx
 * <SuggestionCard
 *   suggestion={{
 *     type: 'categorization',
 *     data: categorizationSuggestion
 *   }}
 *   onAccept={handleAccept}
 *   onEdit={handleEdit}
 *   onDismiss={handleDismiss}
 * />
 * ```
 */
export function SuggestionCard({
  suggestion,
  onAccept,
  onEdit,
  onDismiss,
  className,
}: SuggestionCardProps) {
  const [showReasoning, setShowReasoning] = useState(false)

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'e' || e.key === 'E') {
      e.preventDefault()
      onEdit()
    }
  }

  return (
    <Card
      variant="bordered"
      padding="md"
      className={clsx(styles.suggestionCard, className)}
      onKeyDown={handleKeyDown}
      role="article"
      aria-labelledby={`suggestion-${getSuggestionId(suggestion)}`}
    >
      <CardBody>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span className={styles.icon} aria-hidden="true">
              {getIcon(suggestion)}
            </span>
            <h3
              id={`suggestion-${getSuggestionId(suggestion)}`}
              className={styles.title}
            >
              {getTitle(suggestion)}
            </h3>
            <ConfidenceBadge
              level={getConfidenceLevel(suggestion)}
              confidence={getConfidence(suggestion)}
            />
          </div>
        </div>

        <p className={styles.description}>{getDescription(suggestion)}</p>

        {suggestion.type === 'categorization' && (
          <div className={styles.categorySuggestion}>
            <strong className={styles.label}>Suggested category:</strong>
            <span className={styles.value}>
              {suggestion.data.suggestedCategoryName}
            </span>
          </div>
        )}

        {suggestion.type === 'recurring' && (
          <div className={styles.recurringDetails}>
            <div className={styles.detailRow}>
              <strong className={styles.label}>Frequency:</strong>
              <span className={styles.value}>
                {formatFrequency(suggestion.data.frequency)}
              </span>
            </div>
            <div className={styles.detailRow}>
              <strong className={styles.label}>Average amount:</strong>
              <span className={styles.value}>${suggestion.data.averageAmount}</span>
            </div>
            {suggestion.data.nextExpectedDate && (
              <div className={styles.detailRow}>
                <strong className={styles.label}>Next expected:</strong>
                <span className={styles.value}>
                  {new Date(suggestion.data.nextExpectedDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        )}

        {suggestion.type === 'anomaly' && (
          <div className={styles.anomalyDetails}>
            <div className={styles.anomalyType}>
              <span
                className={clsx(
                  styles.severityBadge,
                  styles[`severity-${suggestion.data.severity}`]
                )}
              >
                {suggestion.data.severity.charAt(0).toUpperCase() +
                  suggestion.data.severity.slice(1)}{' '}
                severity
              </span>
            </div>
            <p className={styles.explanation}>{suggestion.data.explanation}</p>
            {suggestion.data.suggestedAction && (
              <p className={styles.suggestedAction}>
                <strong>Suggested action:</strong> {suggestion.data.suggestedAction}
              </p>
            )}
          </div>
        )}

        {showReasoning && (
          <div
            className={styles.reasoning}
            role="region"
            aria-label="Suggestion reasoning"
          >
            <p>{getReasoning(suggestion)}</p>
          </div>
        )}
      </CardBody>

      <CardFooter>
        <div className={styles.actions}>
          <div className={styles.leftActions}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReasoning(!showReasoning)}
              aria-expanded={showReasoning}
              aria-controls={`reasoning-${getSuggestionId(suggestion)}`}
            >
              {showReasoning ? 'Hide' : 'Why?'}
            </Button>
          </div>
          <div className={styles.rightActions}>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              aria-label="Edit suggestion"
              aria-keyshortcuts="E"
            >
              Edit
            </Button>
            <Button variant="primary" size="sm" onClick={onAccept}>
              Accept
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}

/**
 * Confidence Badge Component
 */
interface ConfidenceBadgeProps {
  level: 'high' | 'medium' | 'low'
  confidence: number
}

function ConfidenceBadge({ level, confidence }: ConfidenceBadgeProps) {
  const icons = {
    high: '●', // Green dot
    medium: '●', // Yellow dot
    low: '●', // Gray dot
  }

  const labels = {
    high: 'High confidence',
    medium: 'Medium confidence',
    low: 'Low confidence',
  }

  return (
    <div
      className={clsx(styles.confidenceBadge, styles[`confidence-${level}`])}
      role="status"
      aria-label={`${labels[level]}: ${Math.round(confidence * 100)}%`}
    >
      <span className={styles.confidenceIcon} aria-hidden="true">
        {icons[level]}
      </span>
      <span className={styles.confidenceText}>{labels[level]}</span>
      <span className={styles.confidencePercentage} aria-hidden="true">
        {Math.round(confidence * 100)}%
      </span>
    </div>
  )
}

/**
 * Helper functions
 */

function getSuggestionId(suggestion: AutomationSuggestion): string {
  switch (suggestion.type) {
    case 'categorization':
      return suggestion.data.transactionId
    case 'recurring':
      return suggestion.data.transactionId
    case 'anomaly':
      return suggestion.data.transactionId
  }
}

function getIcon(suggestion: AutomationSuggestion): string {
  switch (suggestion.type) {
    case 'categorization':
      return '🏷️'
    case 'recurring':
      return '🔄'
    case 'anomaly':
      return '⚠️'
  }
}

function getTitle(suggestion: AutomationSuggestion): string {
  switch (suggestion.type) {
    case 'categorization':
      return 'Category suggestion'
    case 'recurring':
      return 'Recurring transaction detected'
    case 'anomaly':
      return suggestion.data.description
  }
}

function getDescription(suggestion: AutomationSuggestion): string {
  switch (suggestion.type) {
    case 'categorization':
      return `We think this transaction should be categorized as "${suggestion.data.suggestedCategoryName}".`
    case 'recurring':
      return `This looks like a ${formatFrequency(suggestion.data.frequency).toLowerCase()} recurring transaction. Would you like to create a recurring template?`
    case 'anomaly':
      return suggestion.data.explanation
  }
}

function getConfidenceLevel(suggestion: AutomationSuggestion): 'high' | 'medium' | 'low' {
  switch (suggestion.type) {
    case 'categorization':
      return suggestion.data.confidenceLevel
    case 'recurring':
      return suggestion.data.confidenceLevel
    case 'anomaly':
      return suggestion.data.confidenceLevel
  }
}

function getConfidence(suggestion: AutomationSuggestion): number {
  switch (suggestion.type) {
    case 'categorization':
      return suggestion.data.confidence
    case 'recurring':
      return suggestion.data.confidence
    case 'anomaly':
      return suggestion.data.confidence
  }
}

function getReasoning(suggestion: AutomationSuggestion): string {
  switch (suggestion.type) {
    case 'categorization':
      return suggestion.data.reasoning
    case 'recurring':
      return `Based on ${suggestion.data.matchCount} similar transactions. ${suggestion.data.amountVariance < 0.05 ? 'Amount is very consistent.' : 'Amount varies slightly.'}`
    case 'anomaly':
      return suggestion.data.explanation
  }
}

function formatFrequency(
  frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly'
): string {
  const labels = {
    weekly: 'Weekly',
    'bi-weekly': 'Every 2 weeks',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
  }
  return labels[frequency]
}
