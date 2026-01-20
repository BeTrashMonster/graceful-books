/**
 * Automation History Component
 *
 * Displays history of automation suggestions and user responses.
 *
 * Requirements:
 * - J2: User can view past suggestions and corrections
 * - Show accepted, rejected, and corrected suggestions
 * - Filter by automation type
 * - Display accuracy improvement over time
 * - WCAG 2.1 AA compliance
 */

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Card, CardHeader, CardBody } from '../ui/Card'
import { Button } from '../core/Button'
import type {
  AutomationHistoryEntry,
  AutomationType,
  AutomationAccuracyMetrics,
} from '../../types/automation.types'
import styles from './AutomationHistory.module.css'

export interface AutomationHistoryProps {
  history: AutomationHistoryEntry[]
  metrics?: AutomationAccuracyMetrics[]
  onLoadMore?: () => void
  hasMore?: boolean
  loading?: boolean
}

/**
 * Automation History Component
 *
 * Shows users their automation history with filtering and accuracy metrics.
 *
 * WCAG Compliance:
 * - Table structure for screen readers
 * - Status indicators with icons + text
 * - Keyboard navigation for filters
 * - Clear labels for all controls
 *
 * @example
 * ```tsx
 * <AutomationHistory
 *   history={historyEntries}
 *   metrics={accuracyMetrics}
 *   onLoadMore={loadMoreHistory}
 *   hasMore={true}
 * />
 * ```
 */
export function AutomationHistory({
  history,
  metrics,
  onLoadMore,
  hasMore = false,
  loading = false,
}: AutomationHistoryProps) {
  const [filterType, setFilterType] = useState<AutomationType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'accepted' | 'rejected' | 'corrected'
  >('all')

  // Filter history based on selected filters
  const filteredHistory = useMemo(() => {
    return history.filter((entry) => {
      if (filterType !== 'all' && entry.automationType !== filterType) {
        return false
      }

      if (filterStatus !== 'all') {
        if (!entry.userResponse) {
          return false // No response yet
        }

        if (filterStatus === 'accepted' && !entry.userResponse.accepted) {
          return false
        }
        if (filterStatus === 'rejected' && entry.userResponse.dismissed) {
          return false
        }
        if (
          filterStatus === 'corrected' &&
          !entry.userResponse.correctedCategoryId
        ) {
          return false
        }
      }

      return true
    })
  }, [history, filterType, filterStatus])

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = history.length
    const withResponse = history.filter((e) => e.userResponse).length
    const accepted = history.filter((e) => e.userResponse?.accepted).length
    const corrected = history.filter((e) => e.userResponse?.correctedCategoryId).length

    return {
      total,
      withResponse,
      accepted,
      corrected,
      accuracyRate: withResponse > 0 ? (accepted / withResponse) * 100 : 0,
    }
  }, [history])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Automation History</h2>
        <p className={styles.subtitle}>
          Review past suggestions and see how accuracy improves over time.
        </p>
      </div>

      {/* Accuracy Metrics */}
      {metrics && metrics.length > 0 && (
        <Card variant="bordered" padding="lg" className={styles.metricsCard}>
          <CardHeader>
            <h3 className={styles.metricsTitle}>Accuracy Over Time</h3>
          </CardHeader>
          <CardBody>
            <div className={styles.metricsGrid}>
              <div className={styles.metricItem}>
                <span className={styles.metricValue}>{stats.total}</span>
                <span className={styles.metricLabel}>Total suggestions</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricValue}>{stats.accepted}</span>
                <span className={styles.metricLabel}>Accepted</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricValue}>{stats.corrected}</span>
                <span className={styles.metricLabel}>Corrected</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricValue}>
                  {stats.accuracyRate.toFixed(0)}%
                </span>
                <span className={styles.metricLabel}>Accuracy rate</span>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label htmlFor="filter-type" className={styles.filterLabel}>
            Automation type:
          </label>
          <select
            id="filter-type"
            className={styles.filterSelect}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as AutomationType | 'all')}
          >
            <option value="all">All types</option>
            <option value="categorization">Categorization</option>
            <option value="recurring">Recurring detection</option>
            <option value="anomaly">Anomaly detection</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="filter-status" className={styles.filterLabel}>
            Status:
          </label>
          <select
            id="filter-status"
            className={styles.filterSelect}
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(
                e.target.value as 'all' | 'accepted' | 'rejected' | 'corrected'
              )
            }
          >
            <option value="all">All statuses</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="corrected">Corrected</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className={styles.tableContainer}>
        {filteredHistory.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>
              {history.length === 0
                ? "You don't have any automation history yet. Suggestions will appear here as the system learns from your transactions."
                : 'No suggestions match your current filters.'}
            </p>
          </div>
        ) : (
          <table className={styles.table} role="table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Type</th>
                <th scope="col">Transaction</th>
                <th scope="col">Suggestion</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((entry) => (
                <tr key={entry.id}>
                  <td data-label="Date">
                    {format(new Date(entry.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td data-label="Type">
                    <span className={styles.typeChip}>
                      {getTypeIcon(entry.automationType)}{' '}
                      {getTypeLabel(entry.automationType)}
                    </span>
                  </td>
                  <td data-label="Transaction">
                    <div className={styles.transactionInfo}>
                      <span className={styles.transactionDescription}>
                        {entry.transactionDescription}
                      </span>
                      <span className={styles.transactionAmount}>
                        ${entry.transactionAmount}
                      </span>
                    </div>
                  </td>
                  <td data-label="Suggestion">
                    {getSuggestionSummary(entry)}
                  </td>
                  <td data-label="Status">
                    {entry.userResponse ? (
                      <span
                        className={clsx(
                          styles.statusBadge,
                          entry.userResponse.accepted && styles.statusAccepted,
                          entry.userResponse.dismissed && styles.statusRejected,
                          entry.userResponse.correctedCategoryId &&
                            styles.statusCorrected
                        )}
                      >
                        {getStatusIcon(entry.userResponse)}{' '}
                        {getStatusLabel(entry.userResponse)}
                      </span>
                    ) : (
                      <span className={styles.statusPending}>Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className={styles.loadMore}>
          <Button
            variant="outline"
            onClick={onLoadMore}
            loading={loading}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Helper functions
 */

function getTypeIcon(type: AutomationType): string {
  const icons = {
    categorization: '🏷️',
    recurring: '🔄',
    anomaly: '⚠️',
  }
  return icons[type]
}

function getTypeLabel(type: AutomationType): string {
  const labels = {
    categorization: 'Categorization',
    recurring: 'Recurring',
    anomaly: 'Anomaly',
  }
  return labels[type]
}

function getSuggestionSummary(entry: AutomationHistoryEntry): string {
  if (entry.automationType === 'categorization') {
    const data = entry.suggestionData as any
    return data.suggestedCategoryName || 'Category suggestion'
  }
  if (entry.automationType === 'recurring') {
    const data = entry.suggestionData as any
    return `${data.frequency} recurring`
  }
  if (entry.automationType === 'anomaly') {
    const data = entry.suggestionData as any
    return data.description || 'Anomaly detected'
  }
  return '-'
}

function getStatusIcon(response: any): string {
  if (response.accepted) return '✓'
  if (response.dismissed) return '✗'
  if (response.correctedCategoryId) return '✎'
  return ''
}

function getStatusLabel(response: any): string {
  if (response.accepted) return 'Accepted'
  if (response.dismissed) return 'Rejected'
  if (response.correctedCategoryId) return 'Corrected'
  return 'Pending'
}

// Helper for clsx (simple implementation)
function clsx(...args: any[]): string {
  return args.filter(Boolean).join(' ')
}
