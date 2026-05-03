/**
 * AuditLogViewer Component
 *
 * Admin interface to view and analyze security audit logs.
 * Provides filtering, export, and real-time updates.
 *
 * Requirements:
 * - S5-7: Admin Audit Log Viewer
 * - Admin role access only
 * - WCAG 2.1 AA compliant
 * - Steadiness communication style
 */

import { useState, useEffect, useCallback } from 'react'
import type { AuditLog, AuditAction, AuditEntityType } from '../../types/database.types'
import { db } from '../../db'
import { useAuth } from '../../contexts/AuthContext'
import { querySecurityEvents, getSecurityEventStats, SecurityEventType } from '../../utils/securityLogger'
import {
  getFilteredAuditLogs,
  getBackupSyncAuditLogs,
  exportAuditLogsToCSV,
  downloadCSV,
  formatAuditLogSummary,
  getActionDisplayName,
  getActionBadgeColor,
  verifyAuditChainIntegrity,
  formatVerificationResult,
  BackupAuditEventType,
} from '../../services/audit/AuditChainService'
import { Button } from '../core/Button'
import { Input } from '../forms/Input'
import { Select } from '../forms/Select'
import { Loading } from '../feedback/Loading'
import { ErrorMessage } from '../feedback/ErrorMessage'
import styles from './AuditLogViewer.module.css'

interface AuditLogFilters {
  eventType?: SecurityEventType | BackupAuditEventType | 'ALL' | 'BACKUP_SYNC_ONLY'
  userId?: string
  dateFrom?: string
  dateTo?: string
  companyId?: string
}

interface PaginationState {
  currentPage: number
  pageSize: number
  totalRecords: number
}

export function AuditLogViewer() {
  const { role, companyId: userCompanyId } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [allLogs, setAllLogs] = useState<AuditLog[]>([])
  const [filters, setFilters] = useState<AuditLogFilters>({
    eventType: 'ALL',
    userId: '',
    dateFrom: '',
    dateTo: '',
    companyId: userCompanyId || '',
  })
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: 50,
    totalRecords: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [exportSummary, setExportSummary] = useState<string | null>(null)
  const [verificationResult, setVerificationResult] = useState<any>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  // Admin role check
  if (role !== 'admin') {
    return (
      <div className={styles.accessDenied} role="alert">
        <h2>Access Restricted</h2>
        <p>This area is only available to administrators. If you need access to audit logs, please contact your system administrator.</p>
      </div>
    )
  }

  // Load audit logs
  const loadLogs = useCallback(async () => {
    if (!filters.companyId) {
      setError('Please select a company to view audit logs.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Build filter object for querySecurityEvents
      const queryFilters: any = {}

      if (filters.eventType && filters.eventType !== 'ALL') {
        queryFilters.eventType = filters.eventType
      }

      if (filters.userId?.trim()) {
        queryFilters.userId = filters.userId.trim()
      }

      if (filters.dateFrom) {
        queryFilters.dateFrom = new Date(filters.dateFrom).getTime()
      }

      if (filters.dateTo) {
        // Set to end of day
        const dateTo = new Date(filters.dateTo)
        dateTo.setHours(23, 59, 59, 999)
        queryFilters.dateTo = dateTo.getTime()
      }

      // Query security events
      const securityLogs = await querySecurityEvents(filters.companyId, db, queryFilters)

      // Also get all audit logs for the company (non-security events)
      let allAuditLogs = await db.auditLogs
        .where('company_id')
        .equals(filters.companyId)
        .toArray()

      // Filter by date range if specified
      if (queryFilters.dateFrom || queryFilters.dateTo) {
        const from = queryFilters.dateFrom || 0
        const to = queryFilters.dateTo || Date.now()
        allAuditLogs = allAuditLogs.filter(log => log.timestamp >= from && log.timestamp <= to)
      }

      // Filter by userId if specified
      if (queryFilters.userId) {
        allAuditLogs = allAuditLogs.filter(log => log.user_id === queryFilters.userId)
      }

      // Combine security and non-security logs
      const combinedLogs = [...securityLogs, ...allAuditLogs]

      // Remove duplicates (security logs are also in auditLogs)
      const uniqueLogs = combinedLogs.reduce((acc, log) => {
        if (!acc.find(l => l.id === log.id)) {
          acc.push(log)
        }
        return acc
      }, [] as AuditLog[])

      // Sort by timestamp (newest first)
      uniqueLogs.sort((a, b) => b.timestamp - a.timestamp)

      setAllLogs(uniqueLogs)
      setPagination(prev => ({
        ...prev,
        totalRecords: uniqueLogs.length,
        currentPage: 1, // Reset to first page on new query
      }))

      // Get security stats
      const securityStats = await getSecurityEventStats(filters.companyId, db)
      setStats(securityStats)

    } catch (err) {
      console.error('Error loading audit logs:', err)
      setError('We encountered an issue loading the audit logs. Please try again in a moment.')
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  // Update paginated logs when allLogs or pagination changes
  useEffect(() => {
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize
    const endIndex = startIndex + pagination.pageSize
    setLogs(allLogs.slice(startIndex, endIndex))
  }, [allLogs, pagination.currentPage, pagination.pageSize])

  // Load logs on mount and when filters change
  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      loadLogs()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, loadLogs])

  // Verify audit chain integrity
  const handleVerifyIntegrity = async () => {
    if (!filters.companyId) {
      setError('Please select a company to verify audit chain.')
      return
    }

    setIsVerifying(true)
    setVerificationResult(null)
    setError(null)

    try {
      const result = await verifyAuditChainIntegrity(filters.companyId)
      setVerificationResult(result)

      if (!result.success) {
        setError(`Verification failed: ${result.error}`)
      }
    } catch (err) {
      console.error('Error verifying audit chain:', err)
      setError('We encountered an issue verifying the audit chain. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  // Export to CSV using AuditChainService
  const handleExportCSV = async () => {
    if (allLogs.length === 0) {
      setError('No logs to export. Try adjusting your filters.')
      return
    }

    try {
      // Convert logs to match AuditLogEntity format
      const logsToExport = allLogs.map(log => ({
        id: log.id,
        companyId: log.company_id,
        userId: log.user_id,
        deviceId: log.device_id || '',
        action: log.action,
        entityType: log.entity_type,
        entityId: log.entity_id,
        timestamp: new Date(log.timestamp),
        changedFields: log.changed_fields || [],
        metadata: {},
      }))

      // Generate CSV
      const csv = exportAuditLogsToCSV(logsToExport as any)

      // Download CSV
      const filename = `audit-logs-${filters.companyId}-${new Date().toISOString().split('T')[0]}.csv`
      downloadCSV(csv, filename)

      // Show export summary
      const summary = `Successfully exported ${logsToExport.length} audit log${logsToExport.length === 1 ? '' : 's'} to ${filename}`
      setExportSummary(summary)
      setTimeout(() => setExportSummary(null), 5000)

      setError(null)
    } catch (err) {
      console.error('Error exporting CSV:', err)
      setError('We had trouble creating the export file. Please try again.')
    }
  }

  // Handle filter changes
  const handleFilterChange = (field: keyof AuditLogFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({
      ...prev,
      currentPage: newPage,
    }))
  }

  // Handle page size change
  const handlePageSizeChange = (newSize: number) => {
    setPagination(prev => ({
      ...prev,
      pageSize: newSize,
      currentPage: 1, // Reset to first page
    }))
  }

  // Format timestamp for display
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  // Format event details for display
  const formatEventDetails = (log: AuditLog) => {
    try {
      if (log.after_value) {
        const parsed = JSON.parse(log.after_value)
        return JSON.stringify(parsed, null, 2)
      }
      return 'No details available'
    } catch {
      return log.after_value || 'No details available'
    }
  }

  const totalPages = Math.ceil(pagination.totalRecords / pagination.pageSize)

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Security Audit Log Viewer</h1>
        <p className={styles.subtitle}>
          View and analyze security events and audit logs for your organization.
          All logs are immutable and retained for compliance purposes.
        </p>
      </header>

      {/* Statistics Dashboard */}
      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.totalEvents}</div>
            <div className={styles.statLabel}>Total Events (24h)</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.failedLogins}</div>
            <div className={styles.statLabel}>Failed Logins</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.authorizationFailures}</div>
            <div className={styles.statLabel}>Authorization Failures</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.suspiciousActivity}</div>
            <div className={styles.statLabel}>Suspicious Activity</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterRow}>
          <div className={styles.filterGroup}>
            <label htmlFor="companyId">Company ID</label>
            <Input
              id="companyId"
              type="text"
              value={filters.companyId || ''}
              onChange={(e) => handleFilterChange('companyId', e.target.value)}
              placeholder="Enter company ID"
            />
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="eventType">Event Type</label>
            <Select
              id="eventType"
              value={filters.eventType || 'ALL'}
              onChange={(e) => handleFilterChange('eventType', e.target.value)}
            >
              <option value="ALL">All Events</option>
              <option value="BACKUP_SYNC_ONLY">Backup & Sync Only</option>
              <optgroup label="Security Events">
                <option value={SecurityEventType.FAILED_LOGIN}>Failed Login</option>
                <option value={SecurityEventType.AUTHORIZATION_FAILURE}>Authorization Failure</option>
                <option value={SecurityEventType.RATE_LIMIT_EXCEEDED}>Rate Limit Exceeded</option>
                <option value={SecurityEventType.SUSPICIOUS_ACTIVITY}>Suspicious Activity</option>
                <option value={SecurityEventType.ACCOUNT_LOCKOUT}>Account Lockout</option>
              </optgroup>
              <optgroup label="Backup & Sync Events">
                <option value={BackupAuditEventType.BACKUP_CREATED}>Backup Created</option>
                <option value={BackupAuditEventType.BACKUP_RESTORED}>Backup Restored</option>
                <option value={BackupAuditEventType.BACKUP_DELETED}>Backup Deleted</option>
                <option value={BackupAuditEventType.BACKUP_SCHEDULED}>Backup Scheduled</option>
                <option value={BackupAuditEventType.BACKUP_FAILED}>Backup Failed</option>
                <option value={BackupAuditEventType.KEY_ROTATED}>Key Rotated</option>
                <option value={BackupAuditEventType.USER_REVOKED}>User Revoked</option>
                <option value={BackupAuditEventType.SYNC_STARTED}>Sync Started</option>
                <option value={BackupAuditEventType.SYNC_COMPLETED}>Sync Completed</option>
                <option value={BackupAuditEventType.SYNC_FAILED}>Sync Failed</option>
              </optgroup>
            </Select>
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="userId">User ID</label>
            <Input
              id="userId"
              type="text"
              value={filters.userId || ''}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
              placeholder="Filter by user ID"
            />
          </div>
        </div>

        <div className={styles.filterRow}>
          <div className={styles.filterGroup}>
            <label htmlFor="dateFrom">Date From</label>
            <Input
              id="dateFrom"
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="dateTo">Date To</label>
            <Input
              id="dateTo"
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>

          <div className={styles.filterActions}>
            <Button onClick={loadLogs} variant="primary">
              Apply Filters
            </Button>
            <Button
              onClick={() => {
                setFilters({
                  eventType: 'ALL',
                  userId: '',
                  dateFrom: '',
                  dateTo: '',
                  companyId: userCompanyId || '',
                })
              }}
              variant="secondary"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <Button onClick={handleExportCSV} variant="secondary" disabled={allLogs.length === 0}>
          Export to CSV
        </Button>

        <Button
          onClick={handleVerifyIntegrity}
          variant="secondary"
          disabled={allLogs.length === 0 || isVerifying}
          title="Verify HMAC chain integrity"
        >
          {isVerifying ? 'Verifying...' : 'Verify Integrity'}
        </Button>

        <label className={styles.autoRefreshToggle}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            aria-label="Auto-refresh logs every 30 seconds"
          />
          <span>Auto-refresh (30s)</span>
        </label>

        <div className={styles.resultsCount}>
          Showing {logs.length} of {pagination.totalRecords} logs
        </div>
      </div>

      {/* Export summary */}
      {exportSummary && (
        <div className={styles.successMessage} role="status">
          {exportSummary}
        </div>
      )}

      {/* Verification result */}
      {verificationResult && (
        <div
          className={
            verificationResult.valid
              ? styles.verificationSuccess
              : styles.verificationWarning
          }
          role="status"
        >
          <div className={styles.verificationHeader}>
            <strong>Chain Integrity Verification</strong>
            <button
              type="button"
              onClick={() => setVerificationResult(null)}
              className={styles.dismissButton}
              aria-label="Dismiss verification result"
            >
              ✕
            </button>
          </div>
          <pre className={styles.verificationContent}>
            {formatVerificationResult(verificationResult)}
          </pre>
        </div>
      )}

      {/* Error message */}
      {error && (
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      )}

      {/* Loading state */}
      {isLoading && <Loading message="Loading audit logs..." />}

      {/* Logs table */}
      {!isLoading && logs.length === 0 && (
        <div className={styles.emptyState}>
          <p>No audit logs found for the selected filters.</p>
          <p>Try adjusting your date range or removing some filters to see more results.</p>
        </div>
      )}

      {!isLoading && logs.length > 0 && (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table} role="table">
              <thead>
                <tr>
                  <th scope="col">Date/Time</th>
                  <th scope="col">Event Type</th>
                  <th scope="col">User ID</th>
                  <th scope="col">Entity Type</th>
                  <th scope="col">Entity ID</th>
                  <th scope="col">Action</th>
                  <th scope="col">IP Address</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatTimestamp(log.timestamp)}</td>
                    <td>
                      <span className={styles.eventTypeBadge} data-event-type={log.entity_type}>
                        {log.entity_type}
                      </span>
                    </td>
                    <td className={styles.monospace}>{log.user_id}</td>
                    <td>{log.entity_type}</td>
                    <td className={styles.monospace}>{log.entity_id.substring(0, 8)}...</td>
                    <td>
                      <span className={styles.actionBadge} data-action={log.action}>
                        {log.action}
                      </span>
                    </td>
                    <td className={styles.monospace}>{log.ip_address || 'N/A'}</td>
                    <td>
                      <details className={styles.details}>
                        <summary>View Details</summary>
                        <pre className={styles.detailsContent}>
                          {formatEventDetails(log)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className={styles.pagination}>
            <div className={styles.paginationInfo}>
              Page {pagination.currentPage} of {totalPages}
            </div>

            <div className={styles.paginationControls}>
              <Button
                onClick={() => handlePageChange(1)}
                disabled={pagination.currentPage === 1}
                variant="secondary"
                aria-label="Go to first page"
              >
                First
              </Button>
              <Button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                variant="secondary"
                aria-label="Go to previous page"
              >
                Previous
              </Button>
              <Button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === totalPages}
                variant="secondary"
                aria-label="Go to next page"
              >
                Next
              </Button>
              <Button
                onClick={() => handlePageChange(totalPages)}
                disabled={pagination.currentPage === totalPages}
                variant="secondary"
                aria-label="Go to last page"
              >
                Last
              </Button>
            </div>

            <div className={styles.pageSizeSelector}>
              <label htmlFor="pageSize">Rows per page:</label>
              <Select
                id="pageSize"
                value={pagination.pageSize.toString()}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </Select>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
