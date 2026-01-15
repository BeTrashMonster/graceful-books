/**
 * Extended Audit Log Service
 *
 * Provides advanced search, filtering, and export capabilities for audit logs.
 * Implements E7: Audit Log - Extended [MVP] requirements.
 *
 * Features:
 * - Full-text search across audit log entries
 * - Advanced date range filtering
 * - User filtering for specific team members
 * - Entity type filtering
 * - Export to CSV and PDF formats
 * - Visual timeline data preparation
 * - Performance optimized for large datasets (100,000+ entries)
 *
 * Requirements:
 * - E7: Audit Log - Extended [MVP]
 * - All operations must complete in <200ms
 * - Audit logs remain tamper-proof and encrypted
 */

import type {
  AuditAction,
  AuditEntityType,
} from '../types/database.types';
import type { AuditLogEntity } from '../store/types';
import { db } from '../store/database';
import { logger } from '../utils/logger';

const auditExtLogger = logger.child('AuditLogExtended');

/**
 * Advanced search and filter options
 */
export interface AuditLogSearchOptions {
  companyId: string;

  // Full-text search
  searchQuery?: string; // Search across all text fields

  // Date range filtering
  dateFrom?: Date;
  dateTo?: Date;

  // User filtering
  userIds?: string[]; // Filter by specific users

  // Entity filtering
  entityTypes?: AuditEntityType[];
  entityIds?: string[]; // Filter by specific entities

  // Action filtering
  actions?: AuditAction[];

  // Pagination
  limit?: number;
  offset?: number;

  // Sorting
  sortBy?: 'timestamp' | 'user_id' | 'entity_type' | 'action';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Search result with metadata
 */
export interface AuditLogSearchResult {
  logs: AuditLogEntity[];
  total: number;
  hasMore: boolean;
  executionTimeMs: number;
}

/**
 * Timeline entry for visual representation
 */
export interface AuditLogTimelineEntry {
  timestamp: number;
  date: string; // Formatted date for display
  count: number; // Number of events at this time
  actions: {
    action: AuditAction;
    count: number;
  }[];
  entityTypes: {
    type: AuditEntityType;
    count: number;
  }[];
  logs: AuditLogEntity[]; // Actual log entries
}

/**
 * Timeline view with grouped entries
 */
export interface AuditLogTimeline {
  entries: AuditLogTimelineEntry[];
  totalLogs: number;
  dateRange: {
    from: Date;
    to: Date;
  };
  executionTimeMs: number;
}

/**
 * Export format options
 */
export type AuditLogExportFormat = 'csv' | 'pdf';

/**
 * Export result
 */
export interface AuditLogExportResult {
  format: AuditLogExportFormat;
  data: string | Blob;
  filename: string;
  recordCount: number;
  generatedAt: number;
  executionTimeMs: number;
}

/**
 * Advanced search with full-text and filtering
 * Performance optimized for large datasets
 */
export async function searchAuditLogs(
  options: AuditLogSearchOptions
): Promise<AuditLogSearchResult> {
  const startTime = performance.now();

  try {
    auditExtLogger.debug('Starting audit log search', options);

    // Start with base query
    let query = db.auditLogs.where('company_id').equals(options.companyId);

    // Apply date range filter using compound index
    if (options.dateFrom && options.dateTo) {
      const fromMs = options.dateFrom.getTime();
      const toMs = options.dateTo.getTime();

      query = db.auditLogs
        .where('[company_id+timestamp]')
        .between(
          [options.companyId, fromMs],
          [options.companyId, toMs],
          true,
          true
        );
    }

    // Get initial results
    let results = await query.toArray();

    // Apply additional filters
    if (options.userIds && options.userIds.length > 0) {
      const userSet = new Set(options.userIds);
      results = results.filter((log) => userSet.has(log.userId));
    }

    if (options.entityTypes && options.entityTypes.length > 0) {
      const typeSet = new Set(options.entityTypes);
      results = results.filter((log) => typeSet.has(log.entityType as AuditEntityType));
    }

    if (options.entityIds && options.entityIds.length > 0) {
      const entitySet = new Set(options.entityIds);
      results = results.filter((log) => entitySet.has(log.entityId));
    }

    if (options.actions && options.actions.length > 0) {
      const actionSet = new Set(options.actions);
      results = results.filter((log) => actionSet.has(log.action as AuditAction));
    }

    // Apply full-text search
    if (options.searchQuery && options.searchQuery.trim().length > 0) {
      const query = options.searchQuery.toLowerCase().trim();
      results = results.filter((log) => {
        return (
          log.entityType.toLowerCase().includes(query) ||
          log.action.toLowerCase().includes(query) ||
          log.entityId.toLowerCase().includes(query) ||
          (log.changedFields?.some((field: string) =>
            field.toLowerCase().includes(query)
          )) ||
          (log.beforeValues && log.beforeValues.toLowerCase().includes(query)) ||
          (log.afterValues && log.afterValues.toLowerCase().includes(query)) ||
          (log.ipAddress && log.ipAddress.toLowerCase().includes(query)) ||
          (log.userAgent && log.userAgent.toLowerCase().includes(query))
        );
      });
    }

    // Store total before pagination
    const total = results.length;

    // Apply sorting
    const sortBy = options.sortBy || 'timestamp';
    const sortOrder = options.sortOrder || 'desc';

    results.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortBy) {
        case 'timestamp':
          aVal = a.timestamp;
          bVal = b.timestamp;
          break;
        case 'user_id':
          aVal = a.userId;
          bVal = b.userId;
          break;
        case 'entity_type':
          aVal = a.entityType;
          bVal = b.entityType;
          break;
        case 'action':
          aVal = a.action;
          bVal = b.action;
          break;
        default:
          aVal = a.timestamp;
          bVal = b.timestamp;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    const paginatedResults = results.slice(offset, offset + limit);

    const executionTimeMs = performance.now() - startTime;

    auditExtLogger.debug('Audit log search completed', {
      total,
      returned: paginatedResults.length,
      executionTimeMs,
    });

    return {
      logs: paginatedResults,
      total,
      hasMore: offset + limit < total,
      executionTimeMs,
    };
  } catch (error) {
    auditExtLogger.error('Failed to search audit logs', error);
    throw error;
  }
}

/**
 * Get audit logs for a date range with optimal performance
 */
export async function getAuditLogsByDateRange(
  companyId: string,
  dateFrom: Date,
  dateTo: Date,
  limit?: number
): Promise<AuditLogSearchResult> {
  return searchAuditLogs({
    companyId,
    dateFrom,
    dateTo,
    limit,
    sortBy: 'timestamp',
    sortOrder: 'desc',
  });
}

/**
 * Get audit logs for specific users
 */
export async function getAuditLogsByUsers(
  companyId: string,
  userIds: string[],
  dateFrom?: Date,
  dateTo?: Date
): Promise<AuditLogSearchResult> {
  return searchAuditLogs({
    companyId,
    userIds,
    dateFrom,
    dateTo,
    sortBy: 'timestamp',
    sortOrder: 'desc',
  });
}

/**
 * Get audit logs for specific entity types
 */
export async function getAuditLogsByEntityType(
  companyId: string,
  entityTypes: AuditEntityType[],
  dateFrom?: Date,
  dateTo?: Date
): Promise<AuditLogSearchResult> {
  return searchAuditLogs({
    companyId,
    entityTypes,
    dateFrom,
    dateTo,
    sortBy: 'timestamp',
    sortOrder: 'desc',
  });
}

/**
 * Generate timeline view with grouped entries
 * Groups logs by time period for visual display
 */
export async function generateAuditLogTimeline(
  companyId: string,
  dateFrom: Date,
  dateTo: Date,
  groupBy: 'hour' | 'day' | 'week' | 'month' = 'day'
): Promise<AuditLogTimeline> {
  const startTime = performance.now();

  try {
    auditExtLogger.debug('Generating audit log timeline', {
      companyId,
      dateFrom,
      dateTo,
      groupBy,
    });

    // Get all logs in date range
    const searchResult = await getAuditLogsByDateRange(
      companyId,
      dateFrom,
      dateTo,
      undefined // No limit
    );

    // Group logs by time period
    const grouped = new Map<string, AuditLog[]>();

    for (const log of searchResult.logs) {
      const logDate = new Date(log.timestamp);
      let groupKey: string;

      switch (groupBy) {
        case 'hour':
          groupKey = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')} ${String(logDate.getHours()).padStart(2, '0')}:00`;
          break;
        case 'day':
          groupKey = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;
          break;
        case 'week':
          const weekStart = new Date(logDate);
          weekStart.setDate(logDate.getDate() - logDate.getDay());
          groupKey = `${weekStart.getFullYear()}-W${String(getWeekNumber(weekStart)).padStart(2, '0')}`;
          break;
        case 'month':
          groupKey = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          groupKey = logDate.toISOString().split('T')[0]!;
      }

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey)!.push(log);
    }

    // Create timeline entries
    const entries: AuditLogTimelineEntry[] = [];

    for (const [date, logs] of grouped.entries()) {
      // Count actions
      const actionCounts = new Map<AuditAction, number>();
      const entityTypeCounts = new Map<AuditEntityType, number>();

      for (const log of logs) {
        actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
        entityTypeCounts.set(
          log.entity_type,
          (entityTypeCounts.get(log.entity_type) || 0) + 1
        );
      }

      entries.push({
        timestamp: logs[0]!.timestamp,
        date,
        count: logs.length,
        actions: Array.from(actionCounts.entries()).map(([action, count]) => ({
          action,
          count,
        })),
        entityTypes: Array.from(entityTypeCounts.entries()).map(
          ([type, count]) => ({ type, count })
        ),
        logs,
      });
    }

    // Sort entries by timestamp
    entries.sort((a, b) => b.timestamp - a.timestamp);

    const executionTimeMs = performance.now() - startTime;

    auditExtLogger.debug('Timeline generation completed', {
      entryCount: entries.length,
      totalLogs: searchResult.total,
      executionTimeMs,
    });

    return {
      entries,
      totalLogs: searchResult.total,
      dateRange: {
        from: dateFrom,
        to: dateTo,
      },
      executionTimeMs,
    };
  } catch (error) {
    auditExtLogger.error('Failed to generate timeline', error);
    throw error;
  }
}

/**
 * Helper: Get ISO week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Export audit logs to CSV format
 */
export async function exportAuditLogsToCSV(
  options: AuditLogSearchOptions
): Promise<AuditLogExportResult> {
  const startTime = performance.now();

  try {
    auditExtLogger.debug('Starting CSV export', options);

    // Get all matching logs (no pagination for export)
    const searchResult = await searchAuditLogs({
      ...options,
      limit: undefined,
      offset: undefined,
    });

    // Build CSV content
    const headers = [
      'Timestamp',
      'User ID',
      'Action',
      'Entity Type',
      'Entity ID',
      'Changed Fields',
      'IP Address',
      'Device ID',
      'User Agent',
    ];

    const csvLines = [headers.join(',')];

    for (const log of searchResult.logs) {
      const row = [
        new Date(log.timestamp).toISOString(),
        log.user_id,
        log.action,
        log.entity_type,
        log.entity_id,
        `"${log.changed_fields.join(', ')}"`,
        log.ip_address || '',
        log.device_id || '',
        log.user_agent ? `"${log.user_agent.replace(/"/g, '""')}"` : '',
      ];
      csvLines.push(row.join(','));
    }

    const csvContent = csvLines.join('\n');
    const executionTimeMs = performance.now() - startTime;

    auditExtLogger.debug('CSV export completed', {
      recordCount: searchResult.logs.length,
      executionTimeMs,
    });

    return {
      format: 'csv',
      data: csvContent,
      filename: `audit-log-${Date.now()}.csv`,
      recordCount: searchResult.logs.length,
      generatedAt: Date.now(),
      executionTimeMs,
    };
  } catch (error) {
    auditExtLogger.error('Failed to export to CSV', error);
    throw error;
  }
}

/**
 * Export audit logs to PDF format
 * Note: This creates a structured data object that can be rendered to PDF by a PDF library
 */
export async function exportAuditLogsToPDF(
  options: AuditLogSearchOptions,
  companyName: string = 'Company'
): Promise<AuditLogExportResult> {
  const startTime = performance.now();

  try {
    auditExtLogger.debug('Starting PDF export', options);

    // Get all matching logs
    const searchResult = await searchAuditLogs({
      ...options,
      limit: undefined,
      offset: undefined,
    });

    // Create PDF data structure
    const pdfData = {
      title: 'Audit Log Report',
      company: companyName,
      generatedAt: new Date().toISOString(),
      dateRange: {
        from: options.dateFrom?.toISOString() || 'Beginning',
        to: options.dateTo?.toISOString() || 'Now',
      },
      recordCount: searchResult.logs.length,
      logs: searchResult.logs.map((log) => ({
        timestamp: new Date(log.timestamp).toLocaleString(),
        userId: log.user_id,
        action: log.action,
        entityType: log.entity_type,
        entityId: log.entity_id,
        changedFields: log.changed_fields,
        ipAddress: log.ip_address || 'N/A',
        deviceId: log.device_id || 'N/A',
      })),
    };

    const executionTimeMs = performance.now() - startTime;

    auditExtLogger.debug('PDF export data prepared', {
      recordCount: searchResult.logs.length,
      executionTimeMs,
    });

    // Return as JSON string - will be converted to PDF by the UI layer
    return {
      format: 'pdf',
      data: JSON.stringify(pdfData, null, 2),
      filename: `audit-log-${Date.now()}.json`, // PDF library will convert this
      recordCount: searchResult.logs.length,
      generatedAt: Date.now(),
      executionTimeMs,
    };
  } catch (error) {
    auditExtLogger.error('Failed to export to PDF', error);
    throw error;
  }
}

/**
 * Get audit log statistics for dashboard
 */
export interface AuditLogStatistics {
  totalLogs: number;
  dateRange: {
    earliest: Date | null;
    latest: Date | null;
  };
  byAction: Map<AuditAction, number>;
  byEntityType: Map<AuditEntityType, number>;
  byUser: Map<string, number>;
  topUsers: Array<{ userId: string; count: number }>;
  recentActivity: AuditLog[];
  executionTimeMs: number;
}

/**
 * Generate comprehensive statistics
 */
export async function getAuditLogStatistics(
  companyId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<AuditLogStatistics> {
  const startTime = performance.now();

  try {
    auditExtLogger.debug('Generating audit log statistics', {
      companyId,
      dateFrom,
      dateTo,
    });

    const searchResult = await searchAuditLogs({
      companyId,
      dateFrom,
      dateTo,
      limit: undefined,
    });

    const byAction = new Map<AuditAction, number>();
    const byEntityType = new Map<AuditEntityType, number>();
    const byUser = new Map<string, number>();

    let earliest: Date | null = null;
    let latest: Date | null = null;

    for (const log of searchResult.logs) {
      // Count by action
      byAction.set(log.action, (byAction.get(log.action) || 0) + 1);

      // Count by entity type
      byEntityType.set(
        log.entity_type,
        (byEntityType.get(log.entity_type) || 0) + 1
      );

      // Count by user
      byUser.set(log.user_id, (byUser.get(log.user_id) || 0) + 1);

      // Track date range
      const logDate = new Date(log.timestamp);
      if (!earliest || logDate < earliest) earliest = logDate;
      if (!latest || logDate > latest) latest = logDate;
    }

    // Get top users
    const topUsers = Array.from(byUser.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get recent activity (last 50)
    const recentActivity = searchResult.logs.slice(0, 50);

    const executionTimeMs = performance.now() - startTime;

    auditExtLogger.debug('Statistics generation completed', {
      totalLogs: searchResult.total,
      executionTimeMs,
    });

    return {
      totalLogs: searchResult.total,
      dateRange: {
        earliest,
        latest,
      },
      byAction,
      byEntityType,
      byUser,
      topUsers,
      recentActivity,
      executionTimeMs,
    };
  } catch (error) {
    auditExtLogger.error('Failed to generate statistics', error);
    throw error;
  }
}

/**
 * Batch delete old audit logs (for compliance retention policy)
 * WARNING: This is irreversible - use with caution
 */
export async function deleteOldAuditLogs(
  companyId: string,
  retentionDays: number
): Promise<number> {
  const startTime = performance.now();

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffMs = cutoffDate.getTime();

    auditExtLogger.warn('Deleting old audit logs', {
      companyId,
      cutoffDate,
      retentionDays,
    });

    // Find logs to delete
    const logsToDelete = await db.auditLogs
      .where('[company_id+timestamp]')
      .below([companyId, cutoffMs])
      .toArray();

    // Delete in batches for performance
    const batchSize = 1000;
    let deletedCount = 0;

    for (let i = 0; i < logsToDelete.length; i += batchSize) {
      const batch = logsToDelete.slice(i, i + batchSize);
      const ids = batch.map((log) => log.id);
      await db.auditLogs.bulkDelete(ids);
      deletedCount += ids.length;
    }

    const executionTimeMs = performance.now() - startTime;

    auditExtLogger.warn('Old audit logs deleted', {
      deletedCount,
      executionTimeMs,
    });

    return deletedCount;
  } catch (error) {
    auditExtLogger.error('Failed to delete old audit logs', error);
    throw error;
  }
}
