/**
 * User Activity Dashboard Component
 *
 * Admin interface to view and analyze user activity logs.
 * Tracks all user actions including CRUD operations, exports, and settings changes.
 *
 * Requirements:
 * - S7-2: User Activity Logging
 * - Admin role access only
 * - WCAG 2.1 AA compliant
 * - Steadiness communication style
 */

import { useState, useEffect, useCallback } from 'react'
import type { AuditLog, AuditAction, AuditEntityType } from '../../types/database.types'
import { db } from '../../db'
import { useAuth } from '../../contexts/AuthContext'
import {
  queryUserActivity,
  getUserActivityStats,
  getRecentUserActivities,
} from '../../services/userActivity'
import { getAuditActionDisplay, getEntityTypeDisplay } from '../../db/schema/audit.schema'
import { Button } from '../core/Button'
import { Input } from '../forms/Input'
import { Select } from '../forms/Select'
import { Loading } from '../feedback/Loading'
import { ErrorMessage } from '../feedback/ErrorMessage'
import styles from './UserActivityDashboard.module.css'

interface ActivityFilters {
  userId?: string
  action?: AuditAction | 'ALL'
  entityType?: AuditEntityType | 'ALL'
  dateFrom?: string
  dateTo?: string
  searchQuery?: string
}

interface PaginationState {
  currentPage: number
  pageSize: number
  totalRecords: number
}

export function UserActivityDashboard() {
  const { role, companyId: userCompanyId } = useAuth()
  const [activities, setActivities] = useState<AuditLog[]>([])
  const [displayActivities, setDisplayActivities] = useState<AuditLog[]>([])
  const [filters, setFilters] = useState<ActivityFilters>({
    userId: '',
    action: 'ALL',
    entityType: 'ALL',
    dateFrom: '',
    dateTo: '',
    searchQuery: '',
  })
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: 50,
    totalRecords: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null)

  // Admin role check
  if (role !== 'admin') {
    return (
      <div className={styles.accessDenied} role="alert">
        <h2>Access Restricted</h2>
        <p>
          This area is only available to administrators. If you need to review user activity,
          please contact your system administrator.
        </p>
      </div>
    )
  }

  // Load user activities
  const loadActivities = useCallback(async () => {
    if (!userCompanyId) {
      setError('Company information is required to view user activity.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Build filter object
      const queryFilters: any = {}

      if (filters.userId?.trim()) {
        queryFilters.userId = filters.userId.trim()
      }

      if (filters.action && filters.action !== 'ALL') {
        queryFilters.action = filters.action
      }

      if (filters.entityType && filters.entityType !== 'ALL') {
        queryFilters.entityType = filters.entityType
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

      // Query user activities
      const activityLogs = await queryUserActivity(userCompanyId, db, queryFilters)

      setActivities(activityLogs)
      setPagination(prev => ({
        ...prev,
        totalRecords: activityLogs.length,
        currentPage: 1, // Reset to first page on new query
      }))

      // Get activity stats
      const timeRangeMs = 7 * 24 * 60 * 60 * 1000 // 7 days
      const activityStats = await getUserActivityStats(
        userCompanyId,
        filters.userId?.trim() || undefined,
        db,
        timeRangeMs
      )
      setStats(activityStats)
    } catch (err) {
      console.error('Failed to load user activities:', err)
      setError('We encountered an issue loading the activity logs. Please try again in a moment.')
    } finally {
      setIsLoading(false)
    }
  }, [userCompanyId, filters])

  // Load activities on mount and when filters change
  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  // Apply search and pagination
  useEffect(() => {
    let filtered = [...activities]

    // Apply search query
    if (filters.searchQuery?.trim()) {
      const query = filters.searchQuery.toLowerCase().trim()
      filtered = filtered.filter(activity => {
        const entityId = activity.entity_id.toLowerCase()
        const entityType = activity.entity_type.toLowerCase()
        const action = activity.action.toLowerCase()
        const userId = activity.user_id.toLowerCase()

        return (
          entityId.includes(query) ||
          entityType.includes(query) ||
          action.includes(query) ||
          userId.includes(query)
        )
      })
    }

    // Update pagination total
    setPagination(prev => ({
      ...prev,
      totalRecords: filtered.length,
    }))

    // Apply pagination
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize
    const endIndex = startIndex + pagination.pageSize
    const paginated = filtered.slice(startIndex, endIndex)

    setDisplayActivities(paginated)
  }, [activities, filters.searchQuery, pagination.currentPage, pagination.pageSize])

  // Handle filter changes
  const handleFilterChange = (key: keyof ActivityFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }))
  }

  // Toggle activity details
  const toggleActivityDetails = (activityId: string) => {
    setExpandedActivity(prev => (prev === activityId ? null : activityId))
  }

  // Export activities to CSV
  const exportToCSV = () => {
    const headers = ['Timestamp', 'User ID', 'Action', 'Entity Type', 'Entity ID', 'Changed Fields']
    const rows = activities.map(activity => [
      new Date(activity.timestamp).toLocaleString(),
      activity.user_id,
      getAuditActionDisplay(activity.action),
      getEntityTypeDisplay(activity.entity_type),
      activity.entity_id,
      activity.changed_fields.join(', '),
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `user-activity-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className={styles.container}>
        <Loading message="Getting user activity ready for you..." />
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div className={styles.container}>
        <ErrorMessage message={error} />
        <Button onClick={loadActivities} className={styles.retryButton}>
          Try Again
        </Button>
      </div>
    )
  }

  const totalPages = Math.ceil(pagination.totalRecords / pagination.pageSize)

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>User Activity Dashboard</h1>
        <p>Track and review all user actions across your company.</p>
      </header>

      {/* Statistics Section */}
      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <h3>Total Activities</h3>
            <p className={styles.statValue}>{stats.totalActivities}</p>
            <span className={styles.statLabel}>Last 7 days</span>
          </div>
          <div className={styles.statCard}>
            <h3>Creates</h3>
            <p className={styles.statValue}>{stats.creates}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Updates</h3>
            <p className={styles.statValue}>{stats.updates}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Deletes</h3>
            <p className={styles.statValue}>{stats.deletes}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Exports</h3>
            <p className={styles.statValue}>{stats.exports}</p>
          </div>
          <div className={styles.statCard}>
            <h3>Settings Changes</h3>
            <p className={styles.statValue}>{stats.settingsChanges}</p>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className={styles.filters}>
        <div className={styles.filterRow}>
          <Input
            label="User ID"
            value={filters.userId || ''}
            onChange={e => handleFilterChange('userId', e.target.value)}
            placeholder="Filter by user ID"
            className={styles.filterInput}
          />
          <Input
            label="Search"
            value={filters.searchQuery || ''}
            onChange={e => handleFilterChange('searchQuery', e.target.value)}
            placeholder="Search activities..."
            className={styles.filterInput}
          />
        </div>
        <div className={styles.filterRow}>
          <Select
            label="Action"
            value={filters.action || 'ALL'}
            onChange={e => handleFilterChange('action', e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="EXPORT">Export</option>
            <option value="SETTINGS_CHANGE">Settings Change</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
          </Select>
          <Select
            label="Entity Type"
            value={filters.entityType || 'ALL'}
            onChange={e => handleFilterChange('entityType', e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">All Types</option>
            <option value="ACCOUNT">Account</option>
            <option value="TRANSACTION">Transaction</option>
            <option value="CONTACT">Contact</option>
            <option value="PRODUCT">Product</option>
            <option value="INVOICE">Invoice</option>
            <option value="VENDOR">Vendor</option>
            <option value="SETTINGS">Settings</option>
            <option value="USER">User</option>
          </Select>
        </div>
        <div className={styles.filterRow}>
          <Input
            type="date"
            label="From Date"
            value={filters.dateFrom || ''}
            onChange={e => handleFilterChange('dateFrom', e.target.value)}
            className={styles.filterInput}
          />
          <Input
            type="date"
            label="To Date"
            value={filters.dateTo || ''}
            onChange={e => handleFilterChange('dateTo', e.target.value)}
            className={styles.filterInput}
          />
          <Button onClick={exportToCSV} className={styles.exportButton}>
            Export to CSV
          </Button>
        </div>
      </div>

      {/* Activities List */}
      <div className={styles.activitiesList}>
        <div className={styles.listHeader}>
          <h2>Activity Log</h2>
          <span className={styles.recordCount}>
            Showing {displayActivities.length} of {pagination.totalRecords} activities
          </span>
        </div>

        {displayActivities.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No activities found matching your filters.</p>
            <p>Try adjusting your search criteria or date range.</p>
          </div>
        ) : (
          <div className={styles.activityTable}>
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User ID</th>
                  <th>Action</th>
                  <th>Entity Type</th>
                  <th>Entity ID</th>
                  <th>Changed Fields</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {displayActivities.map(activity => (
                  <>
                    <tr key={activity.id} className={styles.activityRow}>
                      <td>{formatTimestamp(activity.timestamp)}</td>
                      <td className={styles.userId}>{activity.user_id.substring(0, 8)}...</td>
                      <td>
                        <span className={`${styles.actionBadge} ${styles[activity.action.toLowerCase()]}`}>
                          {getAuditActionDisplay(activity.action)}
                        </span>
                      </td>
                      <td>{getEntityTypeDisplay(activity.entity_type)}</td>
                      <td className={styles.entityId}>{activity.entity_id.substring(0, 12)}...</td>
                      <td>
                        {activity.changed_fields.length > 0
                          ? activity.changed_fields.slice(0, 3).join(', ')
                          : '-'}
                        {activity.changed_fields.length > 3 && ` +${activity.changed_fields.length - 3} more`}
                      </td>
                      <td>
                        <Button
                          onClick={() => toggleActivityDetails(activity.id || '')}
                          variant="ghost"
                          size="sm"
                          aria-label={`${expandedActivity === activity.id ? 'Hide' : 'Show'} details for this activity`}
                        >
                          {expandedActivity === activity.id ? 'Hide' : 'Show'} Details
                        </Button>
                      </td>
                    </tr>
                    {expandedActivity === activity.id && (
                      <tr className={styles.detailsRow}>
                        <td colSpan={7}>
                          <div className={styles.activityDetails}>
                            <div className={styles.detailsSection}>
                              <h4>Full Information</h4>
                              <dl>
                                <dt>Activity ID:</dt>
                                <dd>{activity.id}</dd>
                                <dt>User ID:</dt>
                                <dd>{activity.user_id}</dd>
                                <dt>Entity ID:</dt>
                                <dd>{activity.entity_id}</dd>
                                <dt>Device ID:</dt>
                                <dd>{activity.device_id || 'Unknown'}</dd>
                                <dt>User Agent:</dt>
                                <dd>{activity.user_agent || 'Unknown'}</dd>
                                <dt>Timestamp:</dt>
                                <dd>{new Date(activity.timestamp).toISOString()}</dd>
                              </dl>
                            </div>
                            {activity.changed_fields.length > 0 && (
                              <div className={styles.detailsSection}>
                                <h4>Changed Fields</h4>
                                <ul>
                                  {activity.changed_fields.map(field => (
                                    <li key={field}>{field}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {(activity.before_value || activity.after_value) && (
                              <div className={styles.detailsSection}>
                                <h4>Values</h4>
                                {activity.before_value && (
                                  <div>
                                    <strong>Before:</strong>
                                    <pre>{activity.before_value}</pre>
                                  </div>
                                )}
                                {activity.after_value && (
                                  <div>
                                    <strong>After:</strong>
                                    <pre>{activity.after_value}</pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <Button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              aria-label="Go to previous page"
            >
              Previous
            </Button>
            <span className={styles.pageInfo}>
              Page {pagination.currentPage} of {totalPages}
            </span>
            <Button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage >= totalPages}
              aria-label="Go to next page"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
