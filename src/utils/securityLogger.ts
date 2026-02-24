/**
 * Security Event Logging
 *
 * Provides comprehensive logging for security-related events.
 * Logs are immutable and stored in the audit log for compliance and forensic analysis.
 *
 * Requirements:
 * - S5-2: Security Event Logging
 * - Immutable audit trail for security events
 * - Integration with existing audit log infrastructure
 *
 * SECURITY: Never log sensitive data (passwords, encryption keys, passphrases)
 */

import { nanoid } from 'nanoid'
import type { AuditAction, AuditEntityType } from '../types/database.types'
import { createAuditLog } from '../db/schema/audit.schema'
import { getDeviceId } from './device'
import { logger } from './logger'
import { getAuditContext } from '../services/audit'

const securityLogger = logger.child('Security')

/**
 * Security event types
 * These map to AuditAction enum values
 */
export enum SecurityEventType {
  FAILED_LOGIN = 'FAILED_LOGIN',
  AUTHORIZATION_FAILURE = 'AUTHORIZATION_FAILURE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  ACCOUNT_LOCKOUT = 'ACCOUNT_LOCKOUT',
  DATA_EXPORT = 'DATA_EXPORT',
}

/**
 * Security event details for different event types
 */
export interface FailedLoginDetails {
  username?: string
  email?: string
  reason: 'invalid_credentials' | 'account_locked' | 'account_not_found' | 'other'
  attemptCount?: number
}

export interface AuthorizationFailureDetails {
  resourceType: string
  resourceId: string
  requestedAction: string
  reason: 'not_found' | 'forbidden' | 'invalid_company_id'
  companyIdMismatch?: {
    requested: string
    actual: string
  }
}

export interface RateLimitExceededDetails {
  endpoint?: string
  limit: number
  windowSeconds: number
  attemptCount: number
}

export interface SuspiciousActivityDetails {
  activityType: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  indicators: string[]
}

export interface AccountLockoutDetails {
  userId: string
  reason: 'max_failed_attempts' | 'suspicious_activity' | 'manual_lock'
  duration?: number // Duration in seconds, null for indefinite
  unlockAt?: number // Unix timestamp when account will unlock
}

export interface DataExportDetails {
  entityType: string
  exportFormat: 'csv' | 'json' | 'pdf' | 'other'
  recordCount: number
  dateRange?: {
    start: string
    end: string
  }
  includeFields?: string[]
  exportSize?: number // Size in bytes
  warningAcknowledged: boolean
}

/**
 * Union type for all security event details
 */
export type SecurityEventDetails =
  | FailedLoginDetails
  | AuthorizationFailureDetails
  | RateLimitExceededDetails
  | SuspiciousActivityDetails
  | AccountLockoutDetails
  | DataExportDetails

/**
 * Security event to be logged
 */
export interface SecurityEvent {
  type: SecurityEventType
  userId?: string // Optional - may not be available for failed login attempts
  companyId?: string // Optional - may not be available for failed login attempts
  details: SecurityEventDetails
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

/**
 * Database interface for security logging
 * This matches the structure expected by the audit service
 */
export interface SecurityLogDatabase {
  auditLogs: {
    add: (entry: any) => Promise<string>
  }
}

/**
 * Log a security event to the immutable audit log
 *
 * @param event - Security event to log
 * @param db - Database instance
 * @returns ID of the created audit log entry, or null if logging failed
 *
 * @example
 * ```typescript
 * // Log a failed login attempt
 * await logSecurityEvent({
 *   type: SecurityEventType.FAILED_LOGIN,
 *   details: {
 *     email: 'user@example.com',
 *     reason: 'invalid_credentials',
 *     attemptCount: 3
 *   }
 * }, db)
 *
 * // Log an authorization failure (IDOR attempt)
 * await logSecurityEvent({
 *   type: SecurityEventType.AUTHORIZATION_FAILURE,
 *   userId: 'user-123',
 *   companyId: 'company-abc',
 *   details: {
 *     resourceType: 'account',
 *     resourceId: 'account-xyz',
 *     requestedAction: 'read',
 *     reason: 'forbidden',
 *     companyIdMismatch: {
 *       requested: 'company-abc',
 *       actual: 'company-def'
 *     }
 *   }
 * }, db)
 * ```
 */
export async function logSecurityEvent(
  event: SecurityEvent,
  db: SecurityLogDatabase
): Promise<string | null> {
  try {
    // Get audit context if available (for userId and companyId)
    const context = getAuditContext()

    // Use context if available, otherwise use event values
    const userId = event.userId || context?.userId || 'SYSTEM'
    const companyId = event.companyId || context?.companyId || 'SYSTEM'

    // Sanitize details to ensure no sensitive data is logged
    const sanitizedDetails = sanitizeSecurityEventDetails(event.details)

    // Create audit log entry
    const entry = createAuditLog(
      companyId,
      userId,
      'SECURITY' as AuditEntityType,
      nanoid(), // Generate a unique entity ID for this security event
      event.type as unknown as AuditAction,
      null, // Security events don't have before values
      sanitizedDetails, // Store event details in after_value
      [] // No changed fields for security events
    )

    // Add security-specific metadata
    entry.id = nanoid()
    entry.device_id = getDeviceId()
    entry.ip_address = event.ipAddress || null
    entry.user_agent = event.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : null)

    // Store additional metadata if provided (also sanitize it)
    if (event.metadata) {
      const sanitizedMetadata = JSON.parse(JSON.stringify(event.metadata))
      sanitizeObject(sanitizedMetadata)
      entry.after_value = JSON.stringify({
        ...sanitizedDetails,
        metadata: sanitizedMetadata
      })
    }

    // Store the audit log
    const id = await db.auditLogs.add(entry)

    securityLogger.info('Security event logged', {
      type: event.type,
      userId,
      companyId,
      id
    })

    return id
  } catch (error) {
    securityLogger.error('Failed to log security event', {
      type: event.type,
      error
    })
    // Don't throw - security logging should not break the main operation
    return null
  }
}

/**
 * List of sensitive field names to redact from logs
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
  'salt'
]

/**
 * Recursively sanitize an object by redacting sensitive fields
 *
 * SECURITY: This function ensures passwords, keys, and other sensitive data
 * are never written to the audit log.
 */
function sanitizeObject(obj: any): void {
  if (typeof obj !== 'object' || obj === null) {
    return
  }

  for (const key in obj) {
    // Check if field name contains sensitive keywords
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      obj[key] = '[REDACTED]'
    } else if (typeof obj[key] === 'object') {
      sanitizeObject(obj[key])
    }
  }
}

/**
 * Sanitize security event details to ensure no sensitive data is logged
 *
 * SECURITY: This function ensures passwords, keys, and other sensitive data
 * are never written to the audit log.
 */
function sanitizeSecurityEventDetails(details: SecurityEventDetails): SecurityEventDetails {
  // Create a deep copy to avoid modifying the original
  const sanitized = JSON.parse(JSON.stringify(details))
  sanitizeObject(sanitized)
  return sanitized
}

/**
 * Helper: Log a failed login attempt
 *
 * @param details - Failed login details
 * @param db - Database instance
 * @returns ID of the created audit log entry
 */
export async function logFailedLogin(
  details: FailedLoginDetails,
  db: SecurityLogDatabase
): Promise<string | null> {
  return logSecurityEvent(
    {
      type: SecurityEventType.FAILED_LOGIN,
      details,
    },
    db
  )
}

/**
 * Helper: Log an authorization failure (potential IDOR attack)
 *
 * @param userId - User who attempted the action
 * @param companyId - Company ID of the user
 * @param details - Authorization failure details
 * @param db - Database instance
 * @returns ID of the created audit log entry
 */
export async function logAuthorizationFailure(
  userId: string,
  companyId: string,
  details: AuthorizationFailureDetails,
  db: SecurityLogDatabase
): Promise<string | null> {
  return logSecurityEvent(
    {
      type: SecurityEventType.AUTHORIZATION_FAILURE,
      userId,
      companyId,
      details,
    },
    db
  )
}

/**
 * Helper: Log a rate limit exceeded event
 *
 * @param details - Rate limit details
 * @param db - Database instance
 * @returns ID of the created audit log entry
 */
export async function logRateLimitExceeded(
  details: RateLimitExceededDetails,
  db: SecurityLogDatabase
): Promise<string | null> {
  return logSecurityEvent(
    {
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      details,
    },
    db
  )
}

/**
 * Helper: Log suspicious activity
 *
 * @param userId - User associated with the activity
 * @param companyId - Company ID of the user
 * @param details - Suspicious activity details
 * @param db - Database instance
 * @returns ID of the created audit log entry
 */
export async function logSuspiciousActivity(
  userId: string,
  companyId: string,
  details: SuspiciousActivityDetails,
  db: SecurityLogDatabase
): Promise<string | null> {
  return logSecurityEvent(
    {
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      userId,
      companyId,
      details,
    },
    db
  )
}

/**
 * Helper: Log an account lockout
 *
 * @param details - Account lockout details
 * @param db - Database instance
 * @returns ID of the created audit log entry
 */
export async function logAccountLockout(
  details: AccountLockoutDetails,
  db: SecurityLogDatabase
): Promise<string | null> {
  return logSecurityEvent(
    {
      type: SecurityEventType.ACCOUNT_LOCKOUT,
      userId: details.userId,
      details,
    },
    db
  )
}

/**
 * Helper: Log a data export event (S7-3: Secure Data Export)
 *
 * Logs when a user exports data, including what data was exported
 * and whether security warnings were acknowledged.
 *
 * @param userId - User performing the export
 * @param companyId - Company ID of the user
 * @param details - Data export details
 * @param db - Database instance
 * @returns ID of the created audit log entry
 *
 * @example
 * ```typescript
 * await logDataExport('user-123', 'company-abc', {
 *   entityType: 'transactions',
 *   exportFormat: 'csv',
 *   recordCount: 150,
 *   dateRange: { start: '2026-01-01', end: '2026-01-31' },
 *   exportSize: 45000,
 *   warningAcknowledged: true
 * }, db)
 * ```
 */
export async function logDataExport(
  userId: string,
  companyId: string,
  details: DataExportDetails,
  db: SecurityLogDatabase
): Promise<string | null> {
  return logSecurityEvent(
    {
      type: SecurityEventType.DATA_EXPORT,
      userId,
      companyId,
      details,
    },
    db
  )
}

/**
 * Query security events from the audit log
 *
 * @param companyId - Company ID to query
 * @param db - Database instance with Dexie table
 * @param filters - Optional filters
 * @returns Array of security event audit logs
 */
export async function querySecurityEvents(
  companyId: string,
  db: { auditLogs: any },
  filters?: {
    eventType?: SecurityEventType
    userId?: string
    dateFrom?: number
    dateTo?: number
    limit?: number
  }
): Promise<any[]> {
  try {
    let query = db.auditLogs
      .where('[company_id+entity_type]')
      .equals([companyId, 'SECURITY'])

    if (filters?.dateFrom || filters?.dateTo) {
      const from = filters.dateFrom || 0
      const to = filters.dateTo || Date.now()
      query = query.and((log: any) => log.timestamp >= from && log.timestamp <= to)
    }

    if (filters?.eventType) {
      query = query.and((log: any) => log.action === filters.eventType)
    }

    if (filters?.userId) {
      query = query.and((log: any) => log.user_id === filters.userId)
    }

    let results = await query.toArray()

    if (filters?.limit) {
      results = results.slice(0, filters.limit)
    }

    return results
  } catch (error) {
    securityLogger.error('Failed to query security events', { companyId, error })
    return []
  }
}

/**
 * Get security event statistics for a company
 *
 * @param companyId - Company ID to query
 * @param db - Database instance with Dexie table
 * @param timeRangeMs - Time range in milliseconds (default: 24 hours)
 * @returns Security event statistics
 */
export async function getSecurityEventStats(
  companyId: string,
  db: { auditLogs: any },
  timeRangeMs: number = 24 * 60 * 60 * 1000
): Promise<{
  totalEvents: number
  failedLogins: number
  authorizationFailures: number
  rateLimitExceeded: number
  suspiciousActivity: number
  accountLockouts: number
}> {
  const now = Date.now()
  const dateFrom = now - timeRangeMs

  const events = await querySecurityEvents(companyId, db, { dateFrom })

  return {
    totalEvents: events.length,
    failedLogins: events.filter(e => e.action === SecurityEventType.FAILED_LOGIN).length,
    authorizationFailures: events.filter(e => e.action === SecurityEventType.AUTHORIZATION_FAILURE).length,
    rateLimitExceeded: events.filter(e => e.action === SecurityEventType.RATE_LIMIT_EXCEEDED).length,
    suspiciousActivity: events.filter(e => e.action === SecurityEventType.SUSPICIOUS_ACTIVITY).length,
    accountLockouts: events.filter(e => e.action === SecurityEventType.ACCOUNT_LOCKOUT).length,
  }
}
