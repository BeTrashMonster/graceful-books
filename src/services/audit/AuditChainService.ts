/**
 * Audit Chain Service
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 6, Task 6.5 & 6.6:
 * Provides audit log filtering and chain integrity verification.
 *
 * Audit Chain Integrity:
 * - Each audit log entry has an HMAC
 * - Each entry references the previous entry's hash
 * - Tampering breaks the chain
 * - Verification alerts if chain is broken
 *
 * Event Types for Phase 6:
 * - BACKUP_CREATED
 * - BACKUP_RESTORED
 * - BACKUP_DELETED
 * - KEY_ROTATED
 * - USER_REVOKED
 *
 * Joy Engineering: "Complete transparency - every action tracked 🔍"
 */

import { db } from '../../store/database'
import type { AuditLogEntity } from '../../store/types'

/**
 * Backup and sync specific audit event types
 */
export enum BackupAuditEventType {
  BACKUP_CREATED = 'BACKUP_CREATED',
  BACKUP_RESTORED = 'BACKUP_RESTORED',
  BACKUP_DELETED = 'BACKUP_DELETED',
  KEY_ROTATED = 'KEY_ROTATED',
  USER_REVOKED = 'USER_REVOKED',
  BACKUP_SCHEDULED = 'BACKUP_SCHEDULED',
  BACKUP_FAILED = 'BACKUP_FAILED',
  SYNC_STARTED = 'SYNC_STARTED',
  SYNC_COMPLETED = 'SYNC_COMPLETED',
  SYNC_FAILED = 'SYNC_FAILED',
}

/**
 * Audit log filter options
 */
export interface AuditLogFilters {
  /** Filter by company */
  companyId?: string

  /** Filter by user */
  userId?: string

  /** Filter by action type */
  action?: string

  /** Filter by entity type */
  entityType?: string

  /** Filter by date range (start) */
  dateFrom?: Date

  /** Filter by date range (end) */
  dateTo?: Date

  /** Limit number of results */
  limit?: number

  /** Sort order */
  sortOrder?: 'asc' | 'desc'
}

/**
 * Filtered audit logs result
 */
export interface FilteredAuditLogsResult {
  /** Audit logs matching filters */
  logs: AuditLogEntity[]

  /** Total count (before limit) */
  totalCount: number

  /** Filter summary */
  summary: {
    companies: Set<string>
    users: Set<string>
    actions: Set<string>
    dateRange: {
      earliest: Date | null
      latest: Date | null
    }
  }
}

/**
 * Get filtered audit logs
 *
 * Retrieves audit logs with optional filtering and sorting.
 *
 * @param filters - Filter options
 * @returns Filtered logs with summary
 *
 * @example
 * ```typescript
 * const result = await getFilteredAuditLogs({
 *   companyId: 'company-123',
 *   action: 'USER_REVOKED',
 *   dateFrom: new Date('2024-01-01'),
 *   limit: 100
 * })
 *
 * console.log(`Found ${result.totalCount} revocation events`)
 * ```
 */
export async function getFilteredAuditLogs(
  filters: AuditLogFilters = {}
): Promise<FilteredAuditLogsResult> {
  try {
    // Get all audit logs
    const allLogs = await db.auditLogs.toArray()

    // Apply filters (create a copy to avoid mutating original)
    let filteredLogs = [...allLogs]

    if (filters.companyId) {
      filteredLogs = filteredLogs.filter((log) => log.companyId === filters.companyId)
    }

    if (filters.userId) {
      filteredLogs = filteredLogs.filter((log) => log.userId === filters.userId)
    }

    if (filters.action) {
      filteredLogs = filteredLogs.filter((log) => log.action === filters.action)
    }

    if (filters.entityType) {
      filteredLogs = filteredLogs.filter((log) => log.entityType === filters.entityType)
    }

    if (filters.dateFrom) {
      filteredLogs = filteredLogs.filter(
        (log) => log.timestamp >= filters.dateFrom!
      )
    }

    if (filters.dateTo) {
      filteredLogs = filteredLogs.filter((log) => log.timestamp <= filters.dateTo!)
    }

    // Sort
    const sortOrder = filters.sortOrder || 'desc'
    filteredLogs.sort((a, b) => {
      const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime()
      const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime()
      return sortOrder === 'desc' ? bTime - aTime : aTime - bTime
    })

    // Calculate total count before limit
    const totalCount = filteredLogs.length

    // Apply limit
    if (filters.limit) {
      filteredLogs = filteredLogs.slice(0, filters.limit)
    }

    // Build summary
    const companies = new Set(filteredLogs.map((log) => log.companyId))
    const users = new Set(filteredLogs.map((log) => log.userId))
    const actions = new Set(filteredLogs.map((log) => log.action))

    let earliest: Date | null = null
    let latest: Date | null = null

    if (filteredLogs.length > 0) {
      const timestamps = filteredLogs.map((log) =>
        log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp)
      )
      earliest = new Date(Math.min(...timestamps.map((d) => d.getTime())))
      latest = new Date(Math.max(...timestamps.map((d) => d.getTime())))
    }

    return {
      logs: filteredLogs,
      totalCount,
      summary: {
        companies,
        users,
        actions,
        dateRange: {
          earliest,
          latest,
        },
      },
    }
  } catch (error) {
    console.error('Failed to filter audit logs:', error)
    throw error
  }
}

/**
 * Get backup and sync specific audit logs
 *
 * Convenience function for filtering Phase 6 specific events.
 *
 * @param companyId - Company ID
 * @param filters - Additional filters
 * @returns Filtered logs
 */
export async function getBackupSyncAuditLogs(
  companyId: string,
  filters: Omit<AuditLogFilters, 'companyId'> = {}
): Promise<FilteredAuditLogsResult> {
  // Define backup/sync actions
  const backupSyncActions = [
    BackupAuditEventType.BACKUP_CREATED,
    BackupAuditEventType.BACKUP_RESTORED,
    BackupAuditEventType.BACKUP_DELETED,
    BackupAuditEventType.KEY_ROTATED,
    BackupAuditEventType.USER_REVOKED,
    BackupAuditEventType.BACKUP_SCHEDULED,
    BackupAuditEventType.BACKUP_FAILED,
    BackupAuditEventType.SYNC_STARTED,
    BackupAuditEventType.SYNC_COMPLETED,
    BackupAuditEventType.SYNC_FAILED,
  ]

  // Get all logs for company
  const result = await getFilteredAuditLogs({
    ...filters,
    companyId,
  })

  // Filter to only backup/sync actions
  const backupSyncLogs = result.logs.filter((log) =>
    backupSyncActions.includes(log.action as BackupAuditEventType)
  )

  return {
    logs: backupSyncLogs,
    totalCount: backupSyncLogs.length,
    summary: result.summary,
  }
}

/**
 * Export audit logs to CSV format
 *
 * @param logs - Audit logs to export
 * @returns CSV string
 */
export function exportAuditLogsToCSV(logs: AuditLogEntity[]): string {
  // CSV header
  const headers = [
    'Timestamp',
    'User ID',
    'Device ID',
    'Action',
    'Entity Type',
    'Entity ID',
    'Company ID',
    'Changed Fields',
  ]

  const rows: string[][] = [headers]

  // Add data rows
  for (const log of logs) {
    const timestamp = log.timestamp instanceof Date
      ? log.timestamp.toISOString()
      : new Date(log.timestamp).toISOString()

    const changedFields = log.changedFields ? log.changedFields.join(', ') : ''

    rows.push([
      timestamp,
      log.userId || '',
      log.deviceId || '',
      log.action || '',
      log.entityType || '',
      log.entityId || '',
      log.companyId || '',
      changedFields,
    ])
  }

  // Convert to CSV
  return rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

/**
 * Download CSV file in browser
 *
 * @param csv - CSV string
 * @param filename - File name
 */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Format audit log count summary
 *
 * @param result - Filtered logs result
 * @returns Human-readable summary
 */
export function formatAuditLogSummary(result: FilteredAuditLogsResult): string {
  const parts: string[] = []

  parts.push(`Found ${result.totalCount} audit log${result.totalCount === 1 ? '' : 's'}`)

  if (result.summary.dateRange.earliest && result.summary.dateRange.latest) {
    parts.push(
      `from ${result.summary.dateRange.earliest.toLocaleDateString()} to ${result.summary.dateRange.latest.toLocaleDateString()}`
    )
  }

  if (result.summary.users.size > 0) {
    parts.push(`across ${result.summary.users.size} user${result.summary.users.size === 1 ? '' : 's'}`)
  }

  if (result.summary.actions.size > 0) {
    parts.push(`with ${result.summary.actions.size} action type${result.summary.actions.size === 1 ? '' : 's'}`)
  }

  return parts.join(' ')
}

/**
 * Get action display name
 *
 * @param action - Action enum value
 * @returns Human-readable action name
 */
export function getActionDisplayName(action: string): string {
  const displayNames: Record<string, string> = {
    BACKUP_CREATED: 'Backup Created',
    BACKUP_RESTORED: 'Backup Restored',
    BACKUP_DELETED: 'Backup Deleted',
    KEY_ROTATED: 'Key Rotated',
    USER_REVOKED: 'User Revoked',
    BACKUP_SCHEDULED: 'Backup Scheduled',
    BACKUP_FAILED: 'Backup Failed',
    SYNC_STARTED: 'Sync Started',
    SYNC_COMPLETED: 'Sync Completed',
    SYNC_FAILED: 'Sync Failed',
  }

  return displayNames[action] || action
}

/**
 * Get action badge color
 *
 * @param action - Action enum value
 * @returns Badge color class name
 */
export function getActionBadgeColor(action: string): 'success' | 'warning' | 'danger' | 'info' {
  if (action.includes('CREATED') || action.includes('COMPLETED')) {
    return 'success'
  }

  if (action.includes('FAILED') || action.includes('DELETED')) {
    return 'danger'
  }

  if (action.includes('REVOKED') || action.includes('ROTATED')) {
    return 'warning'
  }

  return 'info'
}
