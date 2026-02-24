/**
 * Secure Data Export Service
 *
 * Implements S7-3: Secure Data Export with security controls:
 * - Authentication check before export
 * - Activity logging for all exports
 * - Rate limiting to prevent bulk data scraping
 * - User warnings about data security
 * - Audit trail of export operations
 *
 * SECURITY: Exported data is NOT encrypted after download.
 * Users must be warned that exported files should be handled securely.
 */

import type { CSVExportConfig, CSVExportResult } from '../types/csv.types'
import type { DataExportDetails, SecurityLogDatabase } from '../utils/securityLogger'
import { logDataExport, logRateLimitExceeded } from '../utils/securityLogger'
import { rateLimiter, SECURITY_RATE_LIMITS, RateLimitError } from '../utils/rateLimiter'
import { getDatabase } from '../db/database'
import { getActiveSession } from '../auth/session'
import { logger } from '../utils/logger'
import { AppError } from '../utils/errors'

const exportLogger = logger.child('SecureExport')

/**
 * Export request with security context
 */
export interface SecureExportRequest extends CSVExportConfig {
  /** Whether user acknowledged security warning */
  warningAcknowledged: boolean
  /** User ID performing the export (from session) */
  userId?: string
  /** Company ID (from session) */
  companyId?: string
}

/**
 * Export result with security metadata
 */
export interface SecureExportResult extends CSVExportResult {
  /** Security warning message shown to user */
  securityWarning?: string
  /** Rate limit information */
  rateLimit?: {
    remaining: number
    resetsAt: number
  }
  /** Audit log entry ID */
  auditLogId?: string | null
}

/**
 * Security warning messages for data exports
 */
export const EXPORT_SECURITY_WARNINGS = {
  unencrypted: `Important: Exported data is not encrypted.

Once you download this file, it will contain your financial data in plain text. Please:

• Store the file in a secure location
• Delete the file when no longer needed
• Never share the file over unsecured channels
• Consider encrypting the file yourself if storing long-term

Do you want to continue with the export?`,

  sensitiveData: `This export contains sensitive financial information.

The exported file will include transaction details, account information, and other confidential data that should be protected.

Make sure you handle this file securely and only share it with trusted parties if necessary.`,
}

/**
 * Validate that user is authenticated before allowing export
 *
 * @returns Authentication validation result
 */
function validateAuthentication(): {
  isValid: boolean
  userId?: string
  companyId?: string
  error?: string
} {
  try {
    const session = getActiveSession()

    if (!session) {
      return {
        isValid: false,
        error: 'You need to be signed in to export data. Please sign in and try again.',
      }
    }

    if (!session.userId || !session.companyId) {
      return {
        isValid: false,
        error: 'Session is missing required information. Please sign out and sign in again.',
      }
    }

    return {
      isValid: true,
      userId: session.userId,
      companyId: session.companyId,
    }
  } catch (error) {
    exportLogger.error('Authentication validation failed', { error })
    return {
      isValid: false,
      error: 'We encountered an issue verifying your identity. Please try again.',
    }
  }
}

/**
 * Check rate limit for data exports
 *
 * Prevents users from exporting data too frequently to mitigate
 * bulk data scraping attempts.
 *
 * @param userId - User ID to check rate limit for
 * @param db - Database instance for logging violations
 * @returns Rate limit check result
 */
async function checkExportRateLimit(
  userId: string,
  db: SecurityLogDatabase
): Promise<{
  allowed: boolean
  remaining?: number
  resetsAt?: number
  waitTimeMs?: number
}> {
  try {
    const result = await rateLimiter.checkWithLogging(
      'dataExport',
      SECURITY_RATE_LIMITS.dataExport,
      {
        userId,
        db,
        logRateLimitExceeded,
        endpoint: 'data-export',
      }
    )

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetsAt: result.resetsAt,
      waitTimeMs: result.waitTimeMs,
    }
  } catch (error) {
    exportLogger.error('Rate limit check failed', { userId, error })
    // If rate limiting fails, allow the operation but log the error
    return { allowed: true }
  }
}

/**
 * Log export operation to audit trail
 *
 * Records who exported what data, when, and whether they acknowledged
 * the security warning.
 *
 * @param userId - User performing export
 * @param companyId - Company ID
 * @param config - Export configuration
 * @param result - Export result
 * @param db - Database instance
 * @returns Audit log entry ID
 */
async function logExportOperation(
  userId: string,
  companyId: string,
  config: SecureExportRequest,
  result: CSVExportResult,
  db: SecurityLogDatabase
): Promise<string | null> {
  try {
    const details: DataExportDetails = {
      entityType: config.entityType,
      exportFormat: 'csv',
      recordCount: result.rowCount,
      dateRange: config.dateRange
        ? {
            start: config.customStartDate?.toISOString() || 'N/A',
            end: config.customEndDate?.toISOString() || 'N/A',
          }
        : undefined,
      includeFields: config.selectedFields,
      exportSize: result.csvContent.length,
      warningAcknowledged: config.warningAcknowledged,
    }

    const auditLogId = await logDataExport(userId, companyId, details, db)

    exportLogger.info('Export operation logged', {
      userId,
      companyId,
      entityType: config.entityType,
      recordCount: result.rowCount,
      auditLogId,
    })

    return auditLogId
  } catch (error) {
    exportLogger.error('Failed to log export operation', {
      userId,
      companyId,
      error,
    })
    // Don't fail the export if logging fails
    return null
  }
}

/**
 * Perform secure data export with all security controls
 *
 * This is the main entry point for secure data exports. It:
 * 1. Validates user authentication
 * 2. Checks rate limits
 * 3. Requires security warning acknowledgment
 * 4. Performs the export
 * 5. Logs the export operation
 *
 * @param request - Export request with security context
 * @param exportFunction - Function to perform the actual export
 * @returns Secure export result
 *
 * @throws {AppError} If authentication fails
 * @throws {RateLimitError} If rate limit is exceeded
 * @throws {AppError} If security warning not acknowledged
 *
 * @example
 * ```typescript
 * import { secureDataExport } from './services/secureDataExport.service'
 * import { csvExporterService } from './services/csv/csvExporter.service'
 *
 * try {
 *   const result = await secureDataExport(
 *     {
 *       entityType: 'transactions',
 *       dateRange: 'last30',
 *       warningAcknowledged: true
 *     },
 *     async (config) => await csvExporterService.exportToCSV(config)
 *   )
 *
 *   if (result.success) {
 *     csvExporterService.downloadCSV(result.filename, result.csvContent)
 *   }
 * } catch (error) {
 *   if (error instanceof RateLimitError) {
 *     alert(`Too many exports. Please wait ${error.waitTimeMs}ms`)
 *   }
 * }
 * ```
 */
export async function secureDataExport(
  request: SecureExportRequest,
  exportFunction: (config: CSVExportConfig) => Promise<CSVExportResult>
): Promise<SecureExportResult> {
  // Step 1: Validate authentication
  const authCheck = validateAuthentication()
  if (!authCheck.isValid) {
    throw new AppError(
      'AUTHENTICATION_REQUIRED',
      authCheck.error || 'Authentication required for data export'
    )
  }

  const userId = authCheck.userId!
  const companyId = authCheck.companyId!

  // Step 2: Check if security warning was acknowledged
  if (!request.warningAcknowledged) {
    throw new AppError(
      'SECURITY_WARNING_NOT_ACKNOWLEDGED',
      'You must acknowledge the security warning before exporting data. Please review the security notice and confirm to proceed.'
    )
  }

  // Step 3: Get database for logging
  const db = getDatabase() as unknown as SecurityLogDatabase

  // Step 4: Check rate limit
  const rateLimitCheck = await checkExportRateLimit(userId, db)
  if (!rateLimitCheck.allowed) {
    const waitTimeMs = rateLimitCheck.waitTimeMs || 0
    const minutes = Math.ceil(waitTimeMs / (60 * 1000))
    throw new RateLimitError(
      'dataExport',
      waitTimeMs
    )
  }

  // Step 5: Perform the export
  exportLogger.info('Starting secure export', {
    userId,
    companyId,
    entityType: request.entityType,
  })

  const exportResult = await exportFunction({
    entityType: request.entityType,
    dateRange: request.dateRange,
    customStartDate: request.customStartDate,
    customEndDate: request.customEndDate,
    selectedFields: request.selectedFields,
    includeHeaders: request.includeHeaders,
    encoding: request.encoding,
  })

  if (!exportResult.success) {
    exportLogger.warn('Export failed', {
      userId,
      companyId,
      error: exportResult.error,
    })
    return {
      ...exportResult,
      securityWarning: EXPORT_SECURITY_WARNINGS.unencrypted,
    }
  }

  // Step 6: Log the export operation
  const auditLogId = await logExportOperation(
    userId,
    companyId,
    request,
    exportResult,
    db
  )

  exportLogger.info('Secure export completed', {
    userId,
    companyId,
    entityType: request.entityType,
    recordCount: exportResult.rowCount,
    auditLogId,
  })

  // Step 7: Return result with security metadata
  return {
    ...exportResult,
    securityWarning: EXPORT_SECURITY_WARNINGS.unencrypted,
    rateLimit: {
      remaining: rateLimitCheck.remaining || 0,
      resetsAt: rateLimitCheck.resetsAt || Date.now() + SECURITY_RATE_LIMITS.dataExport.windowMs,
    },
    auditLogId,
  }
}

/**
 * Get current export quota status for a user
 *
 * Useful for displaying remaining exports in the UI.
 *
 * @param userId - User ID to check
 * @returns Quota status
 *
 * @example
 * ```typescript
 * const quota = getExportQuotaStatus('user-123')
 * console.log(`${quota.remaining} exports remaining`)
 * console.log(`Resets at ${new Date(quota.resetsAt)}`)
 * ```
 */
export function getExportQuotaStatus(userId: string): {
  remaining: number
  maxExports: number
  resetsAt: number | null
} {
  return rateLimiter.getQuotaStatus(
    'dataExport',
    SECURITY_RATE_LIMITS.dataExport,
    userId
  )
}

/**
 * Check if user can export without actually performing the export
 *
 * Useful for disabling export buttons when quota is exceeded.
 *
 * @param userId - User ID to check
 * @returns Whether user can export
 */
export function canUserExport(userId: string): boolean {
  const quota = getExportQuotaStatus(userId)
  return quota.remaining > 0
}
