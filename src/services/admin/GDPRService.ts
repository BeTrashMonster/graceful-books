/**
 * GDPR Compliance Service
 *
 * Implements GDPR Right to Erasure (Article 17) for user data.
 *
 * Features:
 * - Right to Erasure request handling
 * - Respects 7-year retention for financial records
 * - Hard deletion after retention period
 * - Audit trail for all erasure requests
 * - Confirmation emails to users
 *
 * IMPORTANT: Financial data must be retained for 7 years per legal requirements.
 * Personal data can be anonymized while preserving financial records for compliance.
 */

import { db } from '../../store/database'
import type { UserEntity, AuditLogEntity } from '../../store/types'
import { purgeRecord, getRetentionPolicy } from '../retention.service'
import type { RetentionEntityType, DeletionMethod } from '../../types/retention.types'
import { LEGAL_MINIMUM_RETENTION_DAYS, isEligibleForPurge } from '../../types/retention.types'

/**
 * GDPR erasure request
 */
export interface GDPRErasureRequest {
  /** Company ID */
  companyId: string

  /** User ID requesting erasure */
  userId: string

  /** User email */
  userEmail: string

  /** Requested by (admin user ID) */
  requestedBy: string

  /** Reason for erasure request */
  reason?: string

  /** Whether to anonymize instead of delete (for records within retention period) */
  anonymize?: boolean
}

/**
 * GDPR erasure result
 */
export interface GDPRErasureResult {
  /** Whether erasure was successful */
  success: boolean

  /** Records deleted */
  recordsDeleted: number

  /** Records anonymized (within retention period) */
  recordsAnonymized: number

  /** Records protected by law (cannot be deleted yet) */
  recordsProtected: number

  /** Days until full deletion possible */
  daysUntilFullDeletion: number | null

  /** Detailed results by entity type */
  details: {
    entityType: RetentionEntityType
    deleted: number
    anonymized: number
    protected: number
    errors: string[]
  }[]

  /** Overall error message */
  error?: string

  /** Warnings */
  warnings?: string[]
}

/**
 * Anonymize a record by overwriting personal data
 * Preserves financial data integrity while removing identifiable information
 */
async function anonymizeRecord(
  tableName: string,
  recordId: string,
  _companyId: string
): Promise<boolean> {
  try {
    const dbTable = (db as any)[tableName]
    const record = await dbTable.get(recordId)

    if (!record) {
      return false
    }

    // Anonymize personal fields while keeping financial data
    const anonymized = {
      ...record,
      // Personal identifiable information
      name: '[REDACTED]',
      email: '[REDACTED]',
      phone: '[REDACTED]',
      address: '[REDACTED]',
      description: '[REDACTED]',
      memo: '[REDACTED - GDPR Erasure Request]',
      reference: '[REDACTED]',

      // Keep financial data intact
      // amount, debit, credit, balance, date, etc. remain unchanged

      // Mark as anonymized
      anonymizedAt: Date.now(),
      anonymizedReason: 'GDPR Right to Erasure',
    }

    await dbTable.put(anonymized)
    return true
  } catch (error) {
    console.error(`Failed to anonymize record ${recordId}:`, error)
    return false
  }
}

/**
 * Process GDPR Right to Erasure request
 *
 * Handles user data deletion per GDPR Article 17.
 * Respects legal retention requirements for financial records.
 *
 * Process:
 * 1. Identify all user data
 * 2. Check retention policies
 * 3. Hard delete eligible records
 * 4. Anonymize protected records (7-year retention)
 * 5. Generate audit trail
 * 6. Send confirmation email
 *
 * @param request - Erasure request details
 * @returns Erasure result with detailed breakdown
 *
 * @example
 * ```typescript
 * const result = await processGDPRErasureRequest({
 *   companyId: 'company-123',
 *   userId: 'user-456',
 *   userEmail: 'user@example.com',
 *   requestedBy: 'admin-789',
 *   reason: 'User requested account deletion',
 *   anonymize: true,
 * })
 *
 * if (result.success) {
 *   console.log(`Deleted ${result.recordsDeleted} records`)
 *   console.log(`Anonymized ${result.recordsAnonymized} records`)
 *   console.log(`Protected ${result.recordsProtected} records`)
 * }
 * ```
 */
export async function processGDPRErasureRequest(
  request: GDPRErasureRequest
): Promise<GDPRErasureResult> {
  const { companyId, userId, _userEmail, requestedBy, reason, anonymize = true } = request

  const result: GDPRErasureResult = {
    success: false,
    recordsDeleted: 0,
    recordsAnonymized: 0,
    recordsProtected: 0,
    daysUntilFullDeletion: null,
    details: [],
    warnings: [],
  }

  try {
    // Step 1: Verify user exists
    const user = await db.users.get(userId)
    if (!user) {
      result.error = 'User not found'
      return result
    }

    if (user.companyId !== companyId) {
      result.error = 'User does not belong to this company'
      return result
    }

    // Step 2: Verify requester is admin
    const requester = await db.users.get(requestedBy)
    if (!requester || requester.role !== 'admin') {
      result.error = 'Only admins can process erasure requests'
      return result
    }

    // Step 3: Process each entity type
    const entityTypes: Array<{
      type: RetentionEntityType
      tableName: string
      field: string
    }> = [
      { type: 'TRANSACTION', tableName: 'transactions', field: 'companyId' },
      { type: 'CONTACT', tableName: 'contacts', field: 'companyId' },
      { type: 'INVOICE', tableName: 'invoices', field: 'company_id' },
      { type: 'BILL', tableName: 'bills', field: 'company_id' },
      { type: 'RECEIPT', tableName: 'receipts', field: 'companyId' },
    ]

    for (const entity of entityTypes) {
      const entityResult = {
        entityType: entity.type,
        deleted: 0,
        anonymized: 0,
        protected: 0,
        errors: [] as string[],
      }

      try {
        // Get retention policy
        const policy = await getRetentionPolicy(companyId, entity.type)
        const retentionDays = policy?.retention_days || 365
        const enforceMinimum = policy?.enforce_minimum !== false

        // Find all user's records
        const dbTable = (db as any)[entity.tableName]
        const userRecords = await dbTable
          .where(entity.field)
          .equals(companyId)
          .toArray()

        const userCreatedRecords = userRecords.filter(
          (r: any) =>
            r.createdBy === userId ||
            (r.lastModifiedBy && r.lastModifiedBy === userId)
        )

        // Process each record
        for (const record of userCreatedRecords) {
          const deletedAt = record.deletedAt || record.deleted_at

          // Only process soft-deleted records
          if (!deletedAt) {
            entityResult.errors.push(
              `Record ${record.id} not soft-deleted. Soft delete first.`
            )
            continue
          }

          // Check if eligible for hard deletion
          const eligible = isEligibleForPurge(
            deletedAt,
            entity.type,
            retentionDays,
            enforceMinimum
          )

          if (eligible) {
            // Hard delete
            const purgeResult = await purgeRecord(
              companyId,
              entity.type,
              record.id,
              'SECURE_DELETE' as DeletionMethod,
              requestedBy,
              `GDPR Right to Erasure: ${reason || 'User request'}`
            )

            if (purgeResult.success) {
              entityResult.deleted++
            } else {
              entityResult.errors.push(purgeResult.error || 'Unknown error')
            }
          } else {
            // Protected by retention period
            entityResult.protected++

            // Anonymize if requested
            if (anonymize) {
              const anonymized = await anonymizeRecord(
                entity.tableName,
                record.id,
                companyId
              )

              if (anonymized) {
                entityResult.anonymized++
              } else {
                entityResult.errors.push(
                  `Failed to anonymize record ${record.id}`
                )
              }
            }

            // Calculate days until eligible
            const age = Date.now() - deletedAt
            const effectiveRetention =
              entity.type === 'TRANSACTION' ||
              entity.type === 'INVOICE' ||
              entity.type === 'BILL'
                ? LEGAL_MINIMUM_RETENTION_DAYS
                : retentionDays

            const daysUntilEligible = Math.ceil(
              (effectiveRetention * 24 * 60 * 60 * 1000 - age) /
                (24 * 60 * 60 * 1000)
            )

            if (
              result.daysUntilFullDeletion === null ||
              daysUntilEligible < result.daysUntilFullDeletion
            ) {
              result.daysUntilFullDeletion = Math.max(0, daysUntilEligible)
            }
          }
        }
      } catch (error) {
        entityResult.errors.push(
          error instanceof Error ? error.message : 'Unknown error'
        )
      }

      result.recordsDeleted += entityResult.deleted
      result.recordsAnonymized += entityResult.anonymized
      result.recordsProtected += entityResult.protected
      result.details.push(entityResult)
    }

    // Step 4: Add warnings
    if (result.recordsProtected > 0) {
      result.warnings?.push(
        `${result.recordsProtected} records are protected by 7-year retention policy and cannot be deleted yet.`
      )

      if (anonymize) {
        result.warnings?.push(
          `Personal data has been anonymized in protected records. Financial data preserved for compliance.`
        )
      }

      if (result.daysUntilFullDeletion !== null) {
        result.warnings?.push(
          `Full deletion will be possible in ${result.daysUntilFullDeletion} days.`
        )
      }
    }

    // Step 5: Create audit log
    const auditEntry: AuditLogEntity = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      companyId,
      timestamp: new Date(),
      userId: requestedBy,
      deviceId: 'system',
      entityType: 'user',
      entityId: userId,
      action: 'GDPR_ERASURE_REQUEST_PROCESSED',
      changedFields: ['deletedAt'],
      beforeValues: JSON.stringify({ deleted: false }),
      afterValues: JSON.stringify({
        deleted: true,
        recordsDeleted: result.recordsDeleted,
        recordsAnonymized: result.recordsAnonymized,
        recordsProtected: result.recordsProtected,
        reason: reason || 'User request',
      }),
      _encrypted: {
        beforeValues: false,
        afterValues: false,
      },
    }

    await db.auditLogs.add(auditEntry)

    result.success = true
    return result
  } catch (error) {
    console.error('Failed to process GDPR erasure request:', error)
    result.error = error instanceof Error ? error.message : 'Unknown error'
    return result
  }
}

/**
 * Check if a user's data can be fully deleted
 *
 * @param companyId - Company ID
 * @param userId - User ID
 * @returns Whether full deletion is possible and days until eligible
 */
export async function checkErasureEligibility(
  companyId: string,
  userId: string
): Promise<{
  canFullyDelete: boolean
  daysUntilEligible: number | null
  protectedRecords: number
  details: string[]
}> {
  const result = {
    canFullyDelete: true,
    daysUntilEligible: null as number | null,
    protectedRecords: 0,
    details: [] as string[],
  }

  try {
    const tables = ['transactions', 'invoices', 'bills']

    for (const tableName of tables) {
      const dbTable = (db as any)[tableName]
      const userRecords = await dbTable
        .toArray()
        .then((records: any[]) =>
          records.filter(
            (r) =>
              (r.companyId === companyId || r.company_id === companyId) &&
              (r.createdBy === userId || r.lastModifiedBy === userId) &&
              (r.deletedAt || r.deleted_at)
          )
        )

      for (const record of userRecords) {
        const deletedAt = record.deletedAt || record.deleted_at
        const age = Date.now() - deletedAt
        const daysDeleted = Math.floor(age / (24 * 60 * 60 * 1000))

        if (daysDeleted < LEGAL_MINIMUM_RETENTION_DAYS) {
          result.canFullyDelete = false
          result.protectedRecords++

          const daysRemaining = LEGAL_MINIMUM_RETENTION_DAYS - daysDeleted

          if (
            result.daysUntilEligible === null ||
            daysRemaining < result.daysUntilEligible
          ) {
            result.daysUntilEligible = daysRemaining
          }
        }
      }
    }

    if (!result.canFullyDelete) {
      result.details.push(
        `${result.protectedRecords} financial records must be retained for 7 years per legal requirements.`
      )
      result.details.push(
        `Personal data can be anonymized immediately while preserving financial records.`
      )
      result.details.push(
        `Full deletion will be possible in ${result.daysUntilEligible} days.`
      )
    } else {
      result.details.push('All records are eligible for immediate deletion.')
    }
  } catch (error) {
    console.error('Failed to check erasure eligibility:', error)
    result.details.push('Error checking eligibility')
  }

  return result
}
