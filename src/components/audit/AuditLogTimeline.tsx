/**
 * Audit Log Timeline Component
 *
 * Visual timeline view for audit logs with grouping and filtering.
 * Part of E7: Audit Log - Extended [MVP]
 *
 * Features:
 * - Visual timeline with date grouping
 * - Expandable entries to show details
 * - Action and entity type badges
 * - Responsive and accessible design
 * - Steadiness communication style
 */

import { useState, useEffect } from 'react';
import type {
  AuditLogTimeline,
  AuditLogTimelineEntry,
} from '../../services/auditLogExtended';
import { generateAuditLogTimeline } from '../../services/auditLogExtended';
import type { AuditAction, AuditEntityType } from '../../types/database.types';

interface AuditLogTimelineProps {
  companyId: string;
  dateFrom: Date;
  dateTo: Date;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  onEntryClick?: (entry: AuditLogTimelineEntry) => void;
}

/**
 * Get color for action badge
 */
function getActionColor(action: AuditAction): string {
  const colors: Record<AuditAction, string> = {
    CREATE: 'bg-green-100 text-green-800',
    UPDATE: 'bg-blue-100 text-blue-800',
    DELETE: 'bg-red-100 text-red-800',
    RESTORE: 'bg-purple-100 text-purple-800',
    LOGIN: 'bg-gray-100 text-gray-800',
    LOGOUT: 'bg-gray-100 text-gray-800',
    EXPORT: 'bg-yellow-100 text-yellow-800',
    IMPORT: 'bg-orange-100 text-orange-800',
  };
  return colors[action] || 'bg-gray-100 text-gray-800';
}

/**
 * Get color for entity type badge
 */
function getEntityTypeColor(entityType: AuditEntityType): string {
  const colors: Record<AuditEntityType, string> = {
    ACCOUNT: 'bg-indigo-100 text-indigo-800',
    TRANSACTION: 'bg-blue-100 text-blue-800',
    CONTACT: 'bg-purple-100 text-purple-800',
    PRODUCT: 'bg-pink-100 text-pink-800',
    USER: 'bg-green-100 text-green-800',
    COMPANY: 'bg-yellow-100 text-yellow-800',
    SESSION: 'bg-gray-100 text-gray-800',
    RECONCILIATION_PATTERN: 'bg-teal-100 text-teal-800',
    RECONCILIATION_RECORD: 'bg-cyan-100 text-cyan-800',
    RECONCILIATION_STREAK: 'bg-emerald-100 text-emerald-800',
  };
  return colors[entityType] || 'bg-gray-100 text-gray-800';
}

/**
 * Format action name for display
 */
function formatAction(action: AuditAction): string {
  const names: Record<AuditAction, string> = {
    CREATE: 'Created',
    UPDATE: 'Updated',
    DELETE: 'Deleted',
    RESTORE: 'Restored',
    LOGIN: 'Logged In',
    LOGOUT: 'Logged Out',
    EXPORT: 'Exported',
    IMPORT: 'Imported',
  };
  return names[action] || action;
}

/**
 * Format entity type for display
 */
function formatEntityType(entityType: AuditEntityType): string {
  const names: Record<AuditEntityType, string> = {
    ACCOUNT: 'Account',
    TRANSACTION: 'Transaction',
    CONTACT: 'Contact',
    PRODUCT: 'Product',
    USER: 'User',
    COMPANY: 'Company',
    SESSION: 'Session',
    RECONCILIATION_PATTERN: 'Reconciliation Pattern',
    RECONCILIATION_RECORD: 'Reconciliation Record',
    RECONCILIATION_STREAK: 'Reconciliation Streak',
  };
  return names[entityType] || entityType;
}

export function AuditLogTimeline({
  companyId,
  dateFrom,
  dateTo,
  groupBy = 'day',
  onEntryClick,
}: AuditLogTimelineProps): JSX.Element {
  const [timeline, setTimeline] = useState<AuditLogTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    let mounted = true;

    async function loadTimeline() {
      try {
        setLoading(true);
        setError(null);

        const result = await generateAuditLogTimeline(
          companyId,
          dateFrom,
          dateTo,
          groupBy
        );

        if (mounted) {
          setTimeline(result);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load timeline'
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadTimeline();

    return () => {
      mounted = false;
    };
  }, [companyId, dateFrom, dateTo, groupBy]);

  const toggleEntry = (date: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-gray-600">Loading timeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-medium">
          Oops! Something unexpected happened
        </h3>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!timeline || timeline.entries.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No audit log entries found for this date range.</p>
        <p className="text-sm mt-2">
          Try adjusting your date range or filters.
        </p>
      </div>
    );
  }

  return (
    <div className="audit-log-timeline">
      {/* Timeline header */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Audit Log Timeline
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {timeline.totalLogs} events from{' '}
              {timeline.dateRange.from.toLocaleDateString()} to{' '}
              {timeline.dateRange.to.toLocaleDateString()}
            </p>
          </div>
          <div className="text-sm text-gray-500">
            {timeline.executionTimeMs.toFixed(0)}ms
          </div>
        </div>
      </div>

      {/* Timeline entries */}
      <div className="space-y-4">
        {timeline.entries.map((entry) => {
          const isExpanded = expandedEntries.has(entry.date);

          return (
            <div
              key={entry.date}
              className="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors"
            >
              {/* Entry header */}
              <button
                onClick={() => toggleEntry(entry.date)}
                className="w-full p-4 bg-white hover:bg-gray-50 transition-colors text-left"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Timeline marker */}
                    <div className="flex-shrink-0 w-3 h-3 bg-blue-600 rounded-full" />

                    {/* Date */}
                    <div>
                      <h4 className="text-base font-medium text-gray-900">
                        {entry.date}
                      </h4>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {entry.count} {entry.count === 1 ? 'event' : 'events'}
                      </p>
                    </div>
                  </div>

                  {/* Summary badges */}
                  <div className="flex items-center space-x-2">
                    {/* Action summary */}
                    <div className="flex flex-wrap gap-1">
                      {entry.actions.slice(0, 3).map(({ action, count }) => (
                        <span
                          key={action}
                          className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getActionColor(action)}`}
                        >
                          {formatAction(action)} ({count})
                        </span>
                      ))}
                      {entry.actions.length > 3 && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          +{entry.actions.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Expand icon */}
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Entry details (expandable) */}
              {isExpanded && (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  {/* Entity type breakdown */}
                  <div className="mb-4">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">
                      By Entity Type
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {entry.entityTypes.map(({ type, count }) => (
                        <span
                          key={type}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getEntityTypeColor(type)}`}
                        >
                          {formatEntityType(type)}: {count}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Recent logs from this period */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">
                      Recent Activity
                    </h5>
                    <div className="space-y-2">
                      {entry.logs.slice(0, 10).map((log) => (
                        <div
                          key={log.id}
                          className="p-2 bg-white rounded border border-gray-200 text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getActionColor(log.action)}`}
                              >
                                {formatAction(log.action)}
                              </span>
                              <span className="text-gray-600">
                                {formatEntityType(log.entity_type)}
                              </span>
                              <span className="text-gray-400 text-xs">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            {onEntryClick && (
                              <button
                                onClick={() => onEntryClick(entry)}
                                className="text-blue-600 hover:text-blue-800 text-xs"
                              >
                                View Details
                              </button>
                            )}
                          </div>
                          {log.changed_fields.length > 0 && (
                            <div className="mt-1 text-xs text-gray-500">
                              Changed: {log.changed_fields.join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                      {entry.logs.length > 10 && (
                        <p className="text-xs text-gray-500 text-center">
                          +{entry.logs.length - 10} more events
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
