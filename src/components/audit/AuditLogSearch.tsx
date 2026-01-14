/**
 * Audit Log Search Component
 *
 * Advanced search interface for audit logs with filtering and export.
 * Part of E7: Audit Log - Extended [MVP]
 *
 * Features:
 * - Full-text search
 * - Advanced filters (date range, users, entity types, actions)
 * - Export to CSV and PDF
 * - Real-time search results
 * - Steadiness communication style
 * - WCAG 2.1 AA accessible
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  AuditLogSearchOptions,
  AuditLogSearchResult,
  AuditLogExportFormat,
} from '../../services/auditLogExtended';
import {
  searchAuditLogs,
  exportAuditLogsToCSV,
  exportAuditLogsToPDF,
} from '../../services/auditLogExtended';
import {
  AuditLog,
  AuditAction,
  AuditEntityType,
} from '../../types/database.types';

interface AuditLogSearchProps {
  companyId: string;
  companyName?: string;
  onLogSelect?: (log: AuditLog) => void;
}

const ACTION_OPTIONS: AuditAction[] = [
  AuditAction.CREATE,
  AuditAction.UPDATE,
  AuditAction.DELETE,
  AuditAction.RESTORE,
  AuditAction.LOGIN,
  AuditAction.LOGOUT,
  AuditAction.EXPORT,
  AuditAction.IMPORT,
];

const ENTITY_TYPE_OPTIONS: AuditEntityType[] = [
  AuditEntityType.ACCOUNT,
  AuditEntityType.TRANSACTION,
  AuditEntityType.CONTACT,
  AuditEntityType.PRODUCT,
  AuditEntityType.USER,
  AuditEntityType.COMPANY,
  AuditEntityType.SESSION,
];

export function AuditLogSearch({
  companyId,
  companyName = 'Company',
  onLogSelect,
}: AuditLogSearchProps): JSX.Element {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedActions, setSelectedActions] = useState<Set<AuditAction>>(
    new Set()
  );
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<
    Set<AuditEntityType>
  >(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Results state
  const [results, setResults] = useState<AuditLogSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Perform search
  const performSearch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const options: AuditLogSearchOptions = {
        companyId,
        searchQuery: searchQuery.trim() || undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        actions:
          selectedActions.size > 0
            ? Array.from(selectedActions)
            : undefined,
        entityTypes:
          selectedEntityTypes.size > 0
            ? Array.from(selectedEntityTypes)
            : undefined,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        sortBy: 'timestamp',
        sortOrder: 'desc',
      };

      const result = await searchAuditLogs(options);
      setResults(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to search audit logs'
      );
    } finally {
      setLoading(false);
    }
  }, [
    companyId,
    searchQuery,
    dateFrom,
    dateTo,
    selectedActions,
    selectedEntityTypes,
    currentPage,
    pageSize,
  ]);

  // Auto-search on changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [performSearch]);

  // Handle export
  const handleExport = async (format: AuditLogExportFormat) => {
    try {
      setExporting(true);

      const options: AuditLogSearchOptions = {
        companyId,
        searchQuery: searchQuery.trim() || undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        actions:
          selectedActions.size > 0
            ? Array.from(selectedActions)
            : undefined,
        entityTypes:
          selectedEntityTypes.size > 0
            ? Array.from(selectedEntityTypes)
            : undefined,
      };

      let exportResult;
      if (format === 'csv') {
        exportResult = await exportAuditLogsToCSV(options);
      } else {
        exportResult = await exportAuditLogsToPDF(options, companyName);
      }

      // Download the file
      const blob = new Blob([exportResult.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exportResult.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to export audit logs'
      );
    } finally {
      setExporting(false);
    }
  };

  // Toggle action filter
  const toggleAction = (action: AuditAction) => {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(action)) {
        next.delete(action);
      } else {
        next.add(action);
      }
      return next;
    });
    setCurrentPage(1);
  };

  // Toggle entity type filter
  const toggleEntityType = (entityType: AuditEntityType) => {
    setSelectedEntityTypes((prev) => {
      const next = new Set(prev);
      if (next.has(entityType)) {
        next.delete(entityType);
      } else {
        next.add(entityType);
      }
      return next;
    });
    setCurrentPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setSelectedActions(new Set());
    setSelectedEntityTypes(new Set());
    setCurrentPage(1);
  };

  const totalPages = results ? Math.ceil(results.total / pageSize) : 0;

  return (
    <div className="audit-log-search">
      {/* Search header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Audit Log Search
        </h2>
        <p className="text-gray-600 mt-1">
          Find any change, anytime. Your complete financial history at your
          fingertips.
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <label htmlFor="search-input" className="sr-only">
          Search audit logs
        </label>
        <div className="relative">
          <input
            id="search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search audit logs..."
            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="Search audit logs"
          />
          <svg
            className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Filter and export controls */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          aria-expanded={showFilters}
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span>Filters</span>
          {(selectedActions.size > 0 || selectedEntityTypes.size > 0) && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {selectedActions.size + selectedEntityTypes.size}
            </span>
          )}
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting || !results || results.total === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting || !results || results.total === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Advanced filters (collapsible) */}
      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  aria-label="Date from"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  aria-label="Date to"
                />
              </div>
            </div>

            {/* Actions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Actions
              </label>
              <div className="space-y-1">
                {ACTION_OPTIONS.map((action) => (
                  <label
                    key={action}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedActions.has(action)}
                      onChange={() => toggleAction(action)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{action}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Entity types */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entity Types
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {ENTITY_TYPE_OPTIONS.map((entityType) => (
                  <label
                    key={entityType}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEntityTypes.has(entityType)}
                      onChange={() => toggleEntityType(entityType)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{entityType}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Clear filters */}
          {(searchQuery ||
            dateFrom ||
            dateTo ||
            selectedActions.size > 0 ||
            selectedEntityTypes.size > 0) && (
            <div className="mt-4">
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Searching...</span>
        </div>
      )}

      {/* Results */}
      {!loading && results && (
        <>
          {/* Results header */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Found {results.total} {results.total === 1 ? 'result' : 'results'}{' '}
              in {results.executionTimeMs.toFixed(0)}ms
            </p>
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Results list */}
          {results.logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No audit logs match your search criteria.</p>
              <p className="text-sm mt-2">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-pointer"
                  onClick={() => onLogSelect?.(log)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onLogSelect?.(log);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {log.action}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          {log.entity_type}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">
                        Entity ID: {log.entity_id.substring(0, 12)}...
                      </p>
                      {log.changed_fields.length > 0 && (
                        <p className="text-sm text-gray-500 mt-1">
                          Changed fields: {log.changed_fields.join(', ')}
                        </p>
                      )}
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
