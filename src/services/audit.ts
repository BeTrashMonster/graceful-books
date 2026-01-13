/**
 * Audit Service
 *
 * Provides audit logging functionality for all financial data changes.
 * Creates immutable audit trail entries per ACCT-011 requirements.
 *
 * 7-year retention policy for financial records.
 */

import { nanoid } from 'nanoid'
import type { AuditLog, AuditAction, AuditEntityType } from '../types/database.types'
import { createAuditLog, calculateChangedFields } from '../db/schema/audit.schema'
import { getDeviceId } from '../utils/device'
import { logger } from '../utils/logger'

const auditLogger = logger.child('Audit')

/**
 * Current audit context - set during session initialization
 */
interface AuditContext {
  userId: string
  companyId: string
  sessionId?: string
}

let currentContext: AuditContext | null = null

/**
 * Set the current audit context
 * Called when user logs in or session is restored
 */
export function setAuditContext(context: AuditContext): void {
  currentContext = context
  auditLogger.debug('Audit context set', { userId: context.userId, companyId: context.companyId })
}

/**
 * Clear the audit context
 * Called on logout
 */
export function clearAuditContext(): void {
  currentContext = null
  auditLogger.debug('Audit context cleared')
}

/**
 * Get the current audit context
 */
export function getAuditContext(): AuditContext | null {
  return currentContext
}

/**
 * Create an audit log entry
 * This should be called by store operations when data changes
 */
export async function logAudit(
  entityType: AuditEntityType,
  entityId: string,
  action: AuditAction,
  beforeValue: unknown | null,
  afterValue: unknown | null,
  db: { audit_logs: { add: (entry: Partial<AuditLog>) => Promise<string> } }
): Promise<string | null> {
  const context = currentContext

  if (!context) {
    auditLogger.warn('No audit context set - skipping audit log', { entityType, entityId, action })
    return null
  }

  try {
    const changedFields = calculateChangedFields(beforeValue, afterValue)

    const entry = createAuditLog(
      context.companyId,
      context.userId,
      entityType,
      entityId,
      action,
      beforeValue,
      afterValue,
      changedFields
    )

    // Add device and session info
    entry.id = nanoid()
    entry.device_id = getDeviceId()
    entry.ip_address = null // Not available in client-side app

    // Store the audit log
    const id = await db.audit_logs.add(entry)
    auditLogger.debug('Audit log created', { id, entityType, entityId, action })

    return id
  } catch (error) {
    auditLogger.error('Failed to create audit log', { entityType, entityId, action, error })
    // Don't throw - audit logging should not break the main operation
    return null
  }
}

/**
 * Log entity creation
 */
export async function logCreate(
  entityType: AuditEntityType,
  entityId: string,
  entity: unknown,
  db: { audit_logs: { add: (entry: Partial<AuditLog>) => Promise<string> } }
): Promise<string | null> {
  return logAudit(entityType, entityId, 'CREATE' as AuditAction, null, entity, db)
}

/**
 * Log entity update
 */
export async function logUpdate(
  entityType: AuditEntityType,
  entityId: string,
  beforeEntity: unknown,
  afterEntity: unknown,
  db: { audit_logs: { add: (entry: Partial<AuditLog>) => Promise<string> } }
): Promise<string | null> {
  return logAudit(entityType, entityId, 'UPDATE' as AuditAction, beforeEntity, afterEntity, db)
}

/**
 * Log entity deletion (soft delete)
 */
export async function logDelete(
  entityType: AuditEntityType,
  entityId: string,
  entity: unknown,
  db: { audit_logs: { add: (entry: Partial<AuditLog>) => Promise<string> } }
): Promise<string | null> {
  return logAudit(entityType, entityId, 'DELETE' as AuditAction, entity, null, db)
}

/**
 * Log entity restore from deletion
 */
export async function logRestore(
  entityType: AuditEntityType,
  entityId: string,
  entity: unknown,
  db: { audit_logs: { add: (entry: Partial<AuditLog>) => Promise<string> } }
): Promise<string | null> {
  return logAudit(entityType, entityId, 'RESTORE' as AuditAction, null, entity, db)
}

/**
 * Log user login
 */
export async function logLogin(
  userId: string,
  companyId: string,
  db: { audit_logs: { add: (entry: Partial<AuditLog>) => Promise<string> } }
): Promise<string | null> {
  // Temporarily set context for this log
  const savedContext = currentContext
  setAuditContext({ userId, companyId })

  const result = await logAudit(
    'SESSION' as AuditEntityType,
    userId,
    'LOGIN' as AuditAction,
    null,
    { timestamp: Date.now(), deviceId: getDeviceId() },
    db
  )

  // Restore saved context (or keep new one if this is initial login)
  if (savedContext) {
    currentContext = savedContext
  }

  return result
}

/**
 * Log user logout
 */
export async function logLogout(
  db: { audit_logs: { add: (entry: Partial<AuditLog>) => Promise<string> } }
): Promise<string | null> {
  const context = currentContext
  if (!context) return null

  return logAudit(
    'SESSION' as AuditEntityType,
    context.userId,
    'LOGOUT' as AuditAction,
    { timestamp: Date.now(), deviceId: getDeviceId() },
    null,
    db
  )
}

/**
 * Log data export
 */
export async function logExport(
  entityType: AuditEntityType,
  exportDetails: { format: string; count: number; dateRange?: { from: number; to: number } },
  db: { audit_logs: { add: (entry: Partial<AuditLog>) => Promise<string> } }
): Promise<string | null> {
  return logAudit(entityType, 'EXPORT', 'EXPORT' as AuditAction, null, exportDetails, db)
}

/**
 * Log data import
 */
export async function logImport(
  entityType: AuditEntityType,
  importDetails: { format: string; count: number; source?: string },
  db: { audit_logs: { add: (entry: Partial<AuditLog>) => Promise<string> } }
): Promise<string | null> {
  return logAudit(entityType, 'IMPORT', 'IMPORT' as AuditAction, null, importDetails, db)
}

/**
 * Batch log multiple audit entries
 * Useful when importing data or making bulk changes
 */
export async function logBatch(
  entries: Array<{
    entityType: AuditEntityType
    entityId: string
    action: AuditAction
    before: unknown | null
    after: unknown | null
  }>,
  db: { audit_logs: { bulkAdd: (entries: Partial<AuditLog>[]) => Promise<string[]> } }
): Promise<string[]> {
  const context = currentContext

  if (!context) {
    auditLogger.warn('No audit context set - skipping batch audit log')
    return []
  }

  try {
    const logs = entries.map((entry) => {
      const changedFields = calculateChangedFields(entry.before, entry.after)
      const log = createAuditLog(
        context.companyId,
        context.userId,
        entry.entityType,
        entry.entityId,
        entry.action,
        entry.before,
        entry.after,
        changedFields
      )
      log.id = nanoid()
      log.device_id = getDeviceId()
      return log
    })

    const ids = await db.audit_logs.bulkAdd(logs as Partial<AuditLog>[])
    auditLogger.debug('Batch audit logs created', { count: ids.length })
    return ids
  } catch (error) {
    auditLogger.error('Failed to create batch audit logs', error)
    return []
  }
}
