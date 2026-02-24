/**
 * User Activity Logging Service
 *
 * Provides comprehensive logging for all user actions including CRUD operations,
 * data exports, settings changes, and data views. This service extends the audit
 * service to provide detailed user activity tracking for compliance and security.
 *
 * Requirements:
 * - S7-2: User Activity Logging
 * - Log all CRUD operations with userId
 * - Log data exports and settings changes
 * - Immutable audit trail for user activities
 * - Never log sensitive field values (passwords, encryption keys)
 *
 * SECURITY: This service automatically sanitizes sensitive data before logging
 */

import { nanoid } from 'nanoid'
import type { AuditAction, AuditEntityType, AuditLog } from '../types/database.types'
import { createAuditLog, calculateChangedFields } from '../db/schema/audit.schema'
import { getDeviceId } from '../utils/device'
import { logger } from '../utils/logger'
import { getAuditContext } from './audit'

const activityLogger = logger.child('UserActivity')

/**
 * Database interface for user activity logging
 */
export interface UserActivityDatabase {
  auditLogs: {
    add: (entry: any) => Promise<string>
    where: (index: string) => any
  }
}

/**
 * User activity event details
 */
export interface UserActivityDetails {
  action: string
  entityType: AuditEntityType
  entityId: string
  changes?: Record<string, { before: unknown; after: unknown }>
  metadata?: Record<string, unknown>
}

/**
 * Settings change details
 */
export interface SettingsChangeDetails {
  settingKey: string
  oldValue: unknown
  newValue: unknown
  category?: string
}

/**
 * Data export details
 */
export interface DataExportDetails {
  entityType: AuditEntityType
  format: string
  recordCount: number
  dateRange?: {
    from: number
    to: number
  }
  filters?: Record<string, unknown>
}

/**
 * List of sensitive field names that should never be logged
 */
const SENSITIVE_FIELDS = [
  'password',
  'passphrase',
  'key',
  'secret',
  'token',
  'privateKey',
  'encryptionKey',
  'masterKey',
  'salt',
  'apiKey',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'ssn',
  'socialSecurityNumber',
  'creditCard',
  'cardNumber',
  'cvv',
  'pin',
]

/**
 * Recursively sanitize an object by redacting sensitive fields
 *
 * SECURITY: This function ensures passwords, keys, and other sensitive data
 * are never written to the audit log.
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item))
  }

  const sanitized: any = {}
  for (const key in obj) {
    // Check if field name contains sensitive keywords
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof obj[key] === 'object') {
      sanitized[key] = sanitizeObject(obj[key])
    } else {
      sanitized[key] = obj[key]
    }
  }

  return sanitized
}

/**
 * Log a CRUD operation (Create, Read, Update, Delete)
 *
 * @param action - The action being performed
 * @param entityType - Type of entity being modified
 * @param entityId - ID of the entity
 * @param beforeValue - State before change (for UPDATE and DELETE)
 * @param afterValue - State after change (for CREATE and UPDATE)
 * @param db - Database instance
 * @returns ID of the created audit log entry
 *
 * @example
 * ```typescript
 * // Log a create operation
 * await logUserActivity(
 *   'CREATE',
 *   'TRANSACTION',
 *   'txn-123',
 *   null,
 *   newTransaction,
 *   db
 * )
 *
 * // Log an update operation
 * await logUserActivity(
 *   'UPDATE',
 *   'ACCOUNT',
 *   'acc-456',
 *   oldAccount,
 *   updatedAccount,
 *   db
 * )
 * ```
 */
export async function logUserActivity(
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  beforeValue: unknown | null,
  afterValue: unknown | null,
  db: UserActivityDatabase
): Promise<string | null> {
  try {
    // Get audit context (userId and companyId)
    const context = getAuditContext()
    if (!context) {
      activityLogger.warn('No audit context - skipping user activity log', {
        action,
        entityType,
        entityId,
      })
      return null
    }

    // Sanitize values to ensure no sensitive data is logged
    const sanitizedBefore = beforeValue ? sanitizeObject(beforeValue) : null
    const sanitizedAfter = afterValue ? sanitizeObject(afterValue) : null

    // Calculate changed fields
    const changedFields = calculateChangedFields(sanitizedBefore, sanitizedAfter)

    // Create audit log entry
    const entry = createAuditLog(
      context.companyId,
      context.userId,
      entityType,
      entityId,
      action,
      sanitizedBefore,
      sanitizedAfter,
      changedFields
    )

    // Add activity-specific metadata
    entry.id = nanoid()
    entry.device_id = getDeviceId()
    entry.ip_address = null // Not available in client-side app
    entry.user_agent = typeof navigator !== 'undefined' ? navigator.userAgent : null

    // Store the audit log
    const id = await db.auditLogs.add(entry)

    activityLogger.info('User activity logged', {
      id,
      action,
      entityType,
      entityId,
      userId: context.userId,
      changedFields: changedFields.length,
    })

    return id
  } catch (error) {
    activityLogger.error('Failed to log user activity', {
      action,
      entityType,
      entityId,
      error,
    })
    // Don't throw - activity logging should not break the main operation
    return null
  }
}

/**
 * Log a settings change
 *
 * @param settingKey - The setting that was changed
 * @param oldValue - Previous value
 * @param newValue - New value
 * @param category - Optional category for the setting
 * @param db - Database instance
 * @returns ID of the created audit log entry
 *
 * @example
 * ```typescript
 * await logSettingsChange(
 *   'theme',
 *   'light',
 *   'dark',
 *   'appearance',
 *   db
 * )
 * ```
 */
export async function logSettingsChange(
  settingKey: string,
  oldValue: unknown,
  newValue: unknown,
  category: string | undefined,
  db: UserActivityDatabase
): Promise<string | null> {
  try {
    const context = getAuditContext()
    if (!context) {
      activityLogger.warn('No audit context - skipping settings change log')
      return null
    }

    // Sanitize values
    const sanitizedOld = sanitizeObject({ [settingKey]: oldValue })
    const sanitizedNew = sanitizeObject({ [settingKey]: newValue })

    const details: SettingsChangeDetails = {
      settingKey,
      oldValue: sanitizedOld[settingKey],
      newValue: sanitizedNew[settingKey],
      category,
    }

    const entry = createAuditLog(
      context.companyId,
      context.userId,
      'SETTINGS' as AuditEntityType,
      settingKey,
      'SETTINGS_CHANGE' as AuditAction,
      sanitizedOld,
      sanitizedNew,
      [settingKey]
    )

    entry.id = nanoid()
    entry.device_id = getDeviceId()
    entry.ip_address = null
    entry.user_agent = typeof navigator !== 'undefined' ? navigator.userAgent : null

    const id = await db.auditLogs.add(entry)

    activityLogger.info('Settings change logged', {
      id,
      settingKey,
      category,
      userId: context.userId,
    })

    return id
  } catch (error) {
    activityLogger.error('Failed to log settings change', { settingKey, error })
    return null
  }
}

/**
 * Log a data export
 *
 * @param details - Export details
 * @param db - Database instance
 * @returns ID of the created audit log entry
 *
 * @example
 * ```typescript
 * await logDataExport({
 *   entityType: 'TRANSACTION',
 *   format: 'CSV',
 *   recordCount: 150,
 *   dateRange: {
 *     from: startDate.getTime(),
 *     to: endDate.getTime()
 *   }
 * }, db)
 * ```
 */
export async function logDataExport(
  details: DataExportDetails,
  db: UserActivityDatabase
): Promise<string | null> {
  try {
    const context = getAuditContext()
    if (!context) {
      activityLogger.warn('No audit context - skipping data export log')
      return null
    }

    // Sanitize any filters that might contain sensitive data
    const sanitizedDetails = {
      ...details,
      filters: details.filters ? sanitizeObject(details.filters) : undefined,
    }

    const entry = createAuditLog(
      context.companyId,
      context.userId,
      details.entityType,
      `export-${nanoid()}`,
      'EXPORT' as AuditAction,
      null,
      sanitizedDetails,
      []
    )

    entry.id = nanoid()
    entry.device_id = getDeviceId()
    entry.ip_address = null
    entry.user_agent = typeof navigator !== 'undefined' ? navigator.userAgent : null

    const id = await db.auditLogs.add(entry)

    activityLogger.info('Data export logged', {
      id,
      entityType: details.entityType,
      format: details.format,
      recordCount: details.recordCount,
      userId: context.userId,
    })

    return id
  } catch (error) {
    activityLogger.error('Failed to log data export', { details, error })
    return null
  }
}

/**
 * Query user activity logs
 *
 * @param companyId - Company ID to query
 * @param db - Database instance
 * @param filters - Optional filters
 * @returns Array of user activity audit logs
 */
export async function queryUserActivity(
  companyId: string,
  db: UserActivityDatabase,
  filters?: {
    userId?: string
    action?: AuditAction
    entityType?: AuditEntityType
    dateFrom?: number
    dateTo?: number
    limit?: number
    offset?: number
  }
): Promise<AuditLog[]> {
  try {
    let query = db.auditLogs.where('[company_id+timestamp]').between(
      [companyId, filters?.dateFrom || 0],
      [companyId, filters?.dateTo || Date.now()]
    )

    let results = await query.toArray()

    // Apply filters
    if (filters?.userId) {
      results = results.filter((log: AuditLog) => log.user_id === filters.userId)
    }

    if (filters?.action) {
      results = results.filter((log: AuditLog) => log.action === filters.action)
    }

    if (filters?.entityType) {
      results = results.filter((log: AuditLog) => log.entity_type === filters.entityType)
    }

    // Sort by timestamp descending (newest first)
    results.sort((a: AuditLog, b: AuditLog) => b.timestamp - a.timestamp)

    // Apply pagination
    if (filters?.offset) {
      results = results.slice(filters.offset)
    }

    if (filters?.limit) {
      results = results.slice(0, filters.limit)
    }

    return results
  } catch (error) {
    activityLogger.error('Failed to query user activity', { companyId, filters, error })
    return []
  }
}

/**
 * Get user activity statistics
 *
 * @param companyId - Company ID to query
 * @param userId - Optional user ID to filter by
 * @param db - Database instance
 * @param timeRangeMs - Time range in milliseconds (default: 24 hours)
 * @returns User activity statistics
 */
export async function getUserActivityStats(
  companyId: string,
  userId: string | undefined,
  db: UserActivityDatabase,
  timeRangeMs: number = 24 * 60 * 60 * 1000
): Promise<{
  totalActivities: number
  creates: number
  updates: number
  deletes: number
  exports: number
  settingsChanges: number
  byEntityType: Record<string, number>
  byHour: Record<number, number>
}> {
  const now = Date.now()
  const dateFrom = now - timeRangeMs

  const activities = await queryUserActivity(companyId, db, {
    userId,
    dateFrom,
    dateTo: now,
  })

  const stats = {
    totalActivities: activities.length,
    creates: 0,
    updates: 0,
    deletes: 0,
    exports: 0,
    settingsChanges: 0,
    byEntityType: {} as Record<string, number>,
    byHour: {} as Record<number, number>,
  }

  for (const activity of activities) {
    // Count by action
    if (activity.action === 'CREATE') stats.creates++
    if (activity.action === 'UPDATE') stats.updates++
    if (activity.action === 'DELETE') stats.deletes++
    if (activity.action === 'EXPORT') stats.exports++
    if (activity.action === 'SETTINGS_CHANGE') stats.settingsChanges++

    // Count by entity type
    const entityType = activity.entity_type
    stats.byEntityType[entityType] = (stats.byEntityType[entityType] || 0) + 1

    // Count by hour
    const hour = new Date(activity.timestamp).getHours()
    stats.byHour[hour] = (stats.byHour[hour] || 0) + 1
  }

  return stats
}

/**
 * Get recent user activities
 *
 * @param companyId - Company ID to query
 * @param userId - Optional user ID to filter by
 * @param db - Database instance
 * @param limit - Maximum number of activities to return
 * @returns Recent user activities
 */
export async function getRecentUserActivities(
  companyId: string,
  userId: string | undefined,
  db: UserActivityDatabase,
  limit: number = 50
): Promise<AuditLog[]> {
  return queryUserActivity(companyId, db, {
    userId,
    limit,
  })
}

/**
 * Get user activity summary for a specific user
 *
 * @param companyId - Company ID to query
 * @param userId - User ID to get summary for
 * @param db - Database instance
 * @param timeRangeMs - Time range in milliseconds (default: 7 days)
 * @returns User activity summary
 */
export async function getUserActivitySummary(
  companyId: string,
  userId: string,
  db: UserActivityDatabase,
  timeRangeMs: number = 7 * 24 * 60 * 60 * 1000
): Promise<{
  userId: string
  totalActivities: number
  timeRange: { from: number; to: number }
  stats: Awaited<ReturnType<typeof getUserActivityStats>>
  recentActivities: AuditLog[]
}> {
  const now = Date.now()
  const from = now - timeRangeMs

  const stats = await getUserActivityStats(companyId, userId, db, timeRangeMs)
  const recentActivities = await getRecentUserActivities(companyId, userId, db, 10)

  return {
    userId,
    totalActivities: stats.totalActivities,
    timeRange: { from, to: now },
    stats,
    recentActivities,
  }
}
