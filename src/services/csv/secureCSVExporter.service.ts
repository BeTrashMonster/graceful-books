/**
 * Secure CSV Exporter Service
 *
 * S7-3: Secure Data Export - Enhanced CSV exporter with security controls
 *
 * This service wraps the standard CSV exporter with security features:
 * - Authentication verification
 * - Rate limiting
 * - Activity logging
 * - Security warnings
 *
 * Use this service instead of csvExporterService directly when exporting
 * user data to ensure all security controls are applied.
 */

import type { CSVExportConfig, CSVExportResult } from '../../types/csv.types'
import type { SecureExportRequest, SecureExportResult } from '../secureDataExport.service'
import { csvExporterService } from './csvExporter.service'
import { secureDataExport, getExportQuotaStatus } from '../secureDataExport.service'
import { logger } from '../../utils/logger'

const secureExportLogger = logger.child('SecureCSVExport')

/**
 * Secure CSV Exporter Service
 *
 * Provides secure CSV export functionality with all S7-3 security controls.
 */
export class SecureCSVExporterService {
  /**
   * Export data to CSV with security controls
   *
   * This method applies all security controls before exporting:
   * 1. Authentication check
   * 2. Rate limiting
   * 3. Warning acknowledgment requirement
   * 4. Activity logging
   *
   * @param request - Secure export request with warning acknowledgment
   * @returns Secure export result with security metadata
   *
   * @throws {AppError} If authentication fails or warning not acknowledged
   * @throws {RateLimitError} If export rate limit exceeded
   *
   * @example
   * ```typescript
   * const service = new SecureCSVExporterService()
   *
   * try {
   *   const result = await service.exportToCSV({
   *     entityType: 'transactions',
   *     dateRange: 'last30',
   *     warningAcknowledged: true,
   *     includeHeaders: true
   *   })
   *
   *   if (result.success) {
   *     service.downloadCSV(result.filename, result.csvContent)
   *   }
   * } catch (error) {
   *   if (error instanceof RateLimitError) {
   *     alert(`Too many exports. Please wait ${error.waitTimeMs}ms`)
   *   }
   * }
   * ```
   */
  async exportToCSV(request: SecureExportRequest): Promise<SecureExportResult> {
    secureExportLogger.info('Initiating secure CSV export', {
      entityType: request.entityType,
      dateRange: request.dateRange,
      warningAcknowledged: request.warningAcknowledged,
    })

    // Use the secure export wrapper to apply all security controls
    const result = await secureDataExport(request, async (config: CSVExportConfig) => {
      return await csvExporterService.exportToCSV(config)
    })

    secureExportLogger.info('Secure CSV export completed', {
      success: result.success,
      rowCount: result.rowCount,
      auditLogId: result.auditLogId,
    })

    return result
  }

  /**
   * Download CSV file to user's device
   *
   * Creates a browser download for the CSV content.
   * This is a pass-through to the underlying CSV exporter service.
   *
   * @param filename - Name of the file to download
   * @param csvContent - CSV content string
   */
  downloadCSV(filename: string, csvContent: string): void {
    csvExporterService.downloadCSV(filename, csvContent)
  }

  /**
   * Get available fields for an entity type
   *
   * Pass-through to the underlying CSV exporter service.
   *
   * @param entityType - Entity type to get fields for
   * @returns Array of available field names
   */
  getAvailableFields(entityType: string): string[] {
    return csvExporterService.getAvailableFields(entityType as any)
  }

  /**
   * Get export quota status for current user
   *
   * Useful for displaying quota information before showing the export modal.
   *
   * @param userId - User ID to check quota for
   * @returns Quota status
   *
   * @example
   * ```typescript
   * const service = new SecureCSVExporterService()
   * const quota = service.getQuotaStatus('user-123')
   *
   * if (quota.remaining === 0) {
   *   alert('Export quota exceeded. Quota resets at ' + new Date(quota.resetsAt))
   * }
   * ```
   */
  getQuotaStatus(userId: string): {
    remaining: number
    maxExports: number
    resetsAt: number | null
  } {
    return getExportQuotaStatus(userId)
  }
}

/**
 * Singleton instance for global use
 */
export const secureCSVExporterService = new SecureCSVExporterService()
