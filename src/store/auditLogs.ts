/**
 * Audit Logs Data Access Layer
 *
 * Provides operations for audit logging with:
 * - Immutable audit trail (no updates or deletes)
 * - Encryption/decryption integration points
 * - Query builders for audit history
 * - Automatic logging hooks
 */

import { nanoid } from 'nanoid'
import { db } from './database'
import type {
  AuditLogEntity,
  AuditLogFilter,
  DatabaseResult,
  EncryptionContext,
} from './types'

/**
 * Generate current device ID (stored in localStorage)
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId')
  if (!deviceId) {
    deviceId = nanoid()
    localStorage.setItem('deviceId', deviceId)
  }
  return deviceId
}

/**
 * Create an audit log entry
 * Note: Audit logs are immutable - they cannot be updated or deleted
 */
export async function createAuditLog(
  log: Omit<AuditLogEntity, 'id' | 'timestamp' | 'deviceId' | '_encrypted'> & {
    deviceId?: string
  },
  context?: EncryptionContext
): Promise<DatabaseResult<AuditLogEntity>> {
  try {
    const deviceId = log.deviceId || getDeviceId()

    // Create audit log entity
    let entity: AuditLogEntity = {
      id: nanoid(),
      companyId: log.companyId,
      timestamp: new Date(),
      userId: log.userId,
      deviceId,
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      beforeValues: log.beforeValues,
      afterValues: log.afterValues,
      changedFields: log.changedFields,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      _encrypted: {
        beforeValues: true,
        afterValues: true,
      },
    }

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context
      entity = {
        ...entity,
        beforeValues: entity.beforeValues
          ? await encryptionService.encrypt(entity.beforeValues)
          : undefined,
        afterValues: entity.afterValues
          ? await encryptionService.encrypt(entity.afterValues)
          : undefined,
      }
    }

    // Store in database (immutable - add only, no put)
    await db.auditLogs.add(entity)

    return { success: true, data: entity }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Get audit log by ID
 */
export async function getAuditLog(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<AuditLogEntity>> {
  try {
    const entity = await db.auditLogs.get(id)

    if (!entity) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Audit log not found: ${id}`,
        },
      }
    }

    // Decrypt if service provided
    let result = entity
    if (context?.encryptionService) {
      const { encryptionService } = context
      result = {
        ...entity,
        beforeValues: entity.beforeValues
          ? await encryptionService.decrypt(entity.beforeValues)
          : undefined,
        afterValues: entity.afterValues
          ? await encryptionService.decrypt(entity.afterValues)
          : undefined,
      }
    }

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(
  filter: AuditLogFilter,
  context?: EncryptionContext
): Promise<DatabaseResult<AuditLogEntity[]>> {
  try {
    let query = db.auditLogs.toCollection()

    // Apply filters
    if (filter.companyId) {
      query = db.auditLogs.where('companyId').equals(filter.companyId)
    }

    if (filter.entityType && filter.companyId) {
      query = db.auditLogs
        .where('[companyId+entityType]')
        .equals([filter.companyId, filter.entityType])
    }

    if (filter.entityId && filter.companyId) {
      query = db.auditLogs
        .where('[companyId+entityId]')
        .equals([filter.companyId, filter.entityId])
    }

    if (filter.userId && filter.companyId) {
      query = db.auditLogs
        .where('[companyId+userId]')
        .equals([filter.companyId, filter.userId])
    }

    if (filter.fromDate && filter.toDate && filter.companyId) {
      query = db.auditLogs
        .where('[companyId+timestamp]')
        .between(
          [filter.companyId, filter.fromDate],
          [filter.companyId, filter.toDate]
        )
    }

    if (filter.action) {
      query = query.and((log) => log.action === filter.action)
    }

    // Order by timestamp descending (most recent first)
    const entities = await query.reverse().sortBy('timestamp')

    // Decrypt if service provided
    let results = entities
    if (context?.encryptionService) {
      const { encryptionService } = context
      results = await Promise.all(
        entities.map(async (entity) => ({
          ...entity,
          beforeValues: entity.beforeValues
            ? await encryptionService.decrypt(entity.beforeValues)
            : undefined,
          afterValues: entity.afterValues
            ? await encryptionService.decrypt(entity.afterValues)
            : undefined,
        }))
      )
    }

    return { success: true, data: results }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Get audit history for a specific entity
 */
export async function getEntityAuditHistory(
  entityType: AuditLogEntity['entityType'],
  entityId: string,
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<AuditLogEntity[]>> {
  return queryAuditLogs(
    { companyId, entityType, entityId },
    context
  )
}

/**
 * Get recent audit logs for a company
 */
export async function getRecentAuditLogs(
  companyId: string,
  limit: number = 50,
  context?: EncryptionContext
): Promise<DatabaseResult<AuditLogEntity[]>> {
  try {
    const entities = await db.auditLogs
      .where('companyId')
      .equals(companyId)
      .reverse()
      .sortBy('timestamp')

    const limited = entities.slice(0, limit)

    // Decrypt if service provided
    let results = limited
    if (context?.encryptionService) {
      const { encryptionService } = context
      results = await Promise.all(
        limited.map(async (entity) => ({
          ...entity,
          beforeValues: entity.beforeValues
            ? await encryptionService.decrypt(entity.beforeValues)
            : undefined,
          afterValues: entity.afterValues
            ? await encryptionService.decrypt(entity.afterValues)
            : undefined,
        }))
      )
    }

    return { success: true, data: results }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(
  companyId: string,
  userId: string,
  fromDate?: Date,
  toDate?: Date,
  context?: EncryptionContext
): Promise<DatabaseResult<AuditLogEntity[]>> {
  return queryAuditLogs(
    { companyId, userId, fromDate, toDate },
    context
  )
}

/**
 * Get audit logs for a specific action type
 */
export async function getAuditLogsByAction(
  companyId: string,
  action: AuditLogEntity['action'],
  fromDate?: Date,
  toDate?: Date,
  context?: EncryptionContext
): Promise<DatabaseResult<AuditLogEntity[]>> {
  return queryAuditLogs(
    { companyId, action, fromDate, toDate },
    context
  )
}

/**
 * Helper function to log entity creation
 */
export async function logCreate(
  companyId: string,
  userId: string,
  entityType: AuditLogEntity['entityType'],
  entityId: string,
  afterValues: Record<string, unknown>,
  context?: EncryptionContext
): Promise<DatabaseResult<AuditLogEntity>> {
  return createAuditLog(
    {
      companyId,
      userId,
      entityType,
      entityId,
      action: 'create',
      afterValues: JSON.stringify(afterValues),
      userAgent: navigator.userAgent,
    },
    context
  )
}

/**
 * Helper function to log entity update
 */
export async function logUpdate(
  companyId: string,
  userId: string,
  entityType: AuditLogEntity['entityType'],
  entityId: string,
  beforeValues: Record<string, unknown>,
  afterValues: Record<string, unknown>,
  changedFields: string[],
  context?: EncryptionContext
): Promise<DatabaseResult<AuditLogEntity>> {
  return createAuditLog(
    {
      companyId,
      userId,
      entityType,
      entityId,
      action: 'update',
      beforeValues: JSON.stringify(beforeValues),
      afterValues: JSON.stringify(afterValues),
      changedFields,
      userAgent: navigator.userAgent,
    },
    context
  )
}

/**
 * Helper function to log entity deletion
 */
export async function logDelete(
  companyId: string,
  userId: string,
  entityType: AuditLogEntity['entityType'],
  entityId: string,
  beforeValues: Record<string, unknown>,
  context?: EncryptionContext
): Promise<DatabaseResult<AuditLogEntity>> {
  return createAuditLog(
    {
      companyId,
      userId,
      entityType,
      entityId,
      action: 'delete',
      beforeValues: JSON.stringify(beforeValues),
      userAgent: navigator.userAgent,
    },
    context
  )
}

/**
 * Helper function to log transaction void
 */
export async function logVoid(
  companyId: string,
  userId: string,
  entityId: string,
  beforeValues: Record<string, unknown>,
  context?: EncryptionContext
): Promise<DatabaseResult<AuditLogEntity>> {
  return createAuditLog(
    {
      companyId,
      userId,
      entityType: 'transaction',
      entityId,
      action: 'void',
      beforeValues: JSON.stringify(beforeValues),
      userAgent: navigator.userAgent,
    },
    context
  )
}

/**
 * Get audit statistics for a company
 */
export async function getAuditStats(
  companyId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<DatabaseResult<{
  total: number
  byAction: Record<AuditLogEntity['action'], number>
  byEntityType: Record<AuditLogEntity['entityType'], number>
  byUser: Record<string, number>
}>> {
  try {
    let query = db.auditLogs.where('companyId').equals(companyId)

    if (fromDate && toDate) {
      query = query.and((log) => log.timestamp >= fromDate && log.timestamp <= toDate)
    }

    const logs = await query.toArray()

    const stats = {
      total: logs.length,
      byAction: {} as Record<AuditLogEntity['action'], number>,
      byEntityType: {} as Record<AuditLogEntity['entityType'], number>,
      byUser: {} as Record<string, number>,
    }

    for (const log of logs) {
      // Count by action
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1

      // Count by entity type
      stats.byEntityType[log.entityType] = (stats.byEntityType[log.entityType] || 0) + 1

      // Count by user
      stats.byUser[log.userId] = (stats.byUser[log.userId] || 0) + 1
    }

    return { success: true, data: stats }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}
