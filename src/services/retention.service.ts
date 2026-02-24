/**
 * Data Retention Policy Service
 *
 * Implements S7-5: Data Retention Policies from Security Hardening Roadmap.
 * Provides configurable data retention and secure deletion functionality.
 *
 * Features:
 * - Configurable retention periods per entity type
 * - Auto-purge of old soft-deleted records
 * - Secure deletion with data overwrite
 * - 7-year retention enforcement for financial records
 * - Audit trail for all deletions
 *
 * Requirements:
 * - S7-5: Data Retention Policies
 * - Legal compliance: 7-year retention for accounting records
 * - Zero-knowledge architecture: Secure overwrite of sensitive data
 */

import { nanoid } from 'nanoid';
import type {
  RetentionPolicy,
  DeletionLog,
  RetentionEntityType,
  DeletionMethod,
  RetentionStatistics,
  PurgeResult,
  BatchPurgeResult,
  AutoPurgeConfig,
} from '../types/retention.types';
import {
  DEFAULT_RETENTION_DAYS,
  LEGAL_MINIMUM_RETENTION_DAYS,
  FINANCIAL_ENTITY_TYPES,
  requiresLegalRetention,
  calculateEffectiveRetention,
  isEligibleForPurge,
  DEFAULT_AUTO_PURGE_CONFIG,
} from '../types/retention.types';
import {
  createRetentionPolicy,
  createDeletionLog,
  validateRetentionPolicy,
  validateDeletionLog,
  DEFAULT_RETENTION_POLICY,
} from '../db/schema/retention.schema';
import { logger } from '../utils/logger';
import { validateCompanyId } from '../utils/authorization';
import type { AppError } from '../utils/errors';
import { db } from '../store/database';

const retentionLogger = logger.child('Retention');

/**
 * Get all retention policies for a company
 */
export async function getRetentionPolicies(
  companyId: string
): Promise<RetentionPolicy[]> {
  validateCompanyId(companyId);

  try {
    const policies = await db.retention_policies
      .where('[company_id+is_active]')
      .equals([companyId, true])
      .and((policy) => !policy.deleted_at)
      .toArray();

    retentionLogger.debug('Retrieved retention policies', {
      companyId,
      count: policies.length,
    });

    return policies;
  } catch (error) {
    retentionLogger.error('Failed to get retention policies', {
      companyId,
      error,
    });
    throw error;
  }
}

/**
 * Get retention policy for a specific entity type
 * Falls back to 'ALL' policy if no specific policy exists
 */
export async function getRetentionPolicy(
  companyId: string,
  entityType: RetentionEntityType
): Promise<RetentionPolicy | null> {
  validateCompanyId(companyId);

  try {
    // Try to find specific policy for this entity type
    const specificPolicy = await db.retention_policies
      .where('[company_id+entity_type]')
      .equals([companyId, entityType])
      .and((policy) => policy.is_active && !policy.deleted_at)
      .first();

    if (specificPolicy) {
      return specificPolicy;
    }

    // Fall back to 'ALL' policy
    const defaultPolicy = await db.retention_policies
      .where('[company_id+entity_type]')
      .equals([companyId, 'ALL'])
      .and((policy) => policy.is_active && !policy.deleted_at)
      .first();

    return defaultPolicy || null;
  } catch (error) {
    retentionLogger.error('Failed to get retention policy', {
      companyId,
      entityType,
      error,
    });
    throw error;
  }
}

/**
 * Create or update a retention policy
 */
export async function upsertRetentionPolicy(
  companyId: string,
  userId: string,
  entityType: RetentionEntityType,
  retentionDays: number,
  enforceMinimum: boolean = true,
  description: string | null = null
): Promise<RetentionPolicy> {
  validateCompanyId(companyId);

  const policy = createRetentionPolicy(
    companyId,
    userId,
    entityType,
    retentionDays,
    enforceMinimum,
    description
  );

  // Validate policy
  const errors = validateRetentionPolicy(policy);
  if (errors.length > 0) {
    const error = new Error(`Invalid retention policy: ${errors.join(', ')}`);
    retentionLogger.error('Retention policy validation failed', {
      companyId,
      entityType,
      errors,
    });
    throw error;
  }

  try {
    // Check if policy already exists
    const existing = await db.retention_policies
      .where('[company_id+entity_type]')
      .equals([companyId, entityType])
      .and((p) => !p.deleted_at)
      .first();

    if (existing) {
      // Update existing policy
      const updated: RetentionPolicy = {
        ...existing,
        retention_days: retentionDays,
        enforce_minimum: enforceMinimum,
        description,
        last_modified_by: userId,
        updated_at: Date.now(),
      };

      await db.retention_policies.put(updated);
      retentionLogger.info('Updated retention policy', {
        companyId,
        entityType,
        retentionDays,
      });

      return updated;
    } else {
      // Create new policy
      const newPolicy: RetentionPolicy = {
        id: nanoid(),
        ...policy,
      } as RetentionPolicy;

      await db.retention_policies.add(newPolicy);
      retentionLogger.info('Created retention policy', {
        companyId,
        entityType,
        retentionDays,
      });

      return newPolicy;
    }
  } catch (error) {
    retentionLogger.error('Failed to upsert retention policy', {
      companyId,
      entityType,
      error,
    });
    throw error;
  }
}

/**
 * Delete a retention policy (soft delete)
 */
export async function deleteRetentionPolicy(
  policyId: string,
  companyId: string
): Promise<void> {
  validateCompanyId(companyId);

  try {
    const policy = await db.retention_policies.get(policyId);

    if (!policy) {
      throw new Error('Retention policy not found');
    }

    if (policy.company_id !== companyId) {
      throw new Error('Unauthorized: Policy does not belong to this company');
    }

    // Soft delete
    await db.retention_policies.update(policyId, {
      deleted_at: Date.now(),
      updated_at: Date.now(),
    });

    retentionLogger.info('Deleted retention policy', { policyId, companyId });
  } catch (error) {
    retentionLogger.error('Failed to delete retention policy', {
      policyId,
      companyId,
      error,
    });
    throw error;
  }
}

/**
 * Get retention statistics for a company
 */
export async function getRetentionStatistics(
  companyId: string
): Promise<RetentionStatistics> {
  validateCompanyId(companyId);

  try {
    const policies = await getRetentionPolicies(companyId);
    const tables = [
      { name: 'accounts', type: 'ACCOUNT' as RetentionEntityType },
      { name: 'transactions', type: 'TRANSACTION' as RetentionEntityType },
      { name: 'contacts', type: 'CONTACT' as RetentionEntityType },
      { name: 'products', type: 'PRODUCT' as RetentionEntityType },
      { name: 'invoices', type: 'INVOICE' as RetentionEntityType },
      { name: 'bills', type: 'BILL' as RetentionEntityType },
      { name: 'receipts', type: 'RECEIPT' as RetentionEntityType },
    ];

    const stats: RetentionStatistics = {
      company_id: companyId,
      total_soft_deleted: 0,
      eligible_for_purge: 0,
      protected_by_law: 0,
      days_until_next_purge: Infinity,
      by_entity_type: {} as any,
      last_purge_at: null,
      next_purge_at: null,
    };

    for (const table of tables) {
      const policy = await getRetentionPolicy(companyId, table.type);
      const retentionDays = policy?.retention_days || DEFAULT_RETENTION_DAYS;
      const enforceMinimum = policy?.enforce_minimum !== false;

      // Get soft-deleted records
      const dbTable = (db as any)[table.name];
      const softDeleted = await dbTable
        .where(table.field)
        .equals(companyId)
        .and((record: any) => record.deletedAt !== null && record.deletedAt !== undefined)
        .toArray();

      let eligible = 0;
      let protectedCount = 0;

      for (const record of softDeleted) {
        const canPurge = isEligibleForPurge(
          record.deletedAt,
          table.type,
          retentionDays,
          enforceMinimum
        );

        if (canPurge) {
          eligible++;
        } else if (requiresLegalRetention(table.type)) {
          // Check if protected by 7-year rule
          const effectiveRetention = calculateEffectiveRetention(
            table.type,
            retentionDays,
            enforceMinimum
          );
          if (effectiveRetention === LEGAL_MINIMUM_RETENTION_DAYS) {
            protectedCount++;
          }
        }

        // Calculate days until this record becomes eligible
        if (!canPurge) {
          const effectiveRetention = calculateEffectiveRetention(
            table.type,
            retentionDays,
            enforceMinimum
          );
          const age = Date.now() - record.deletedAt;
          const daysUntilEligible = Math.ceil(
            (effectiveRetention * 24 * 60 * 60 * 1000 - age) / (24 * 60 * 60 * 1000)
          );
          stats.days_until_next_purge = Math.min(
            stats.days_until_next_purge,
            daysUntilEligible
          );
        }
      }

      stats.total_soft_deleted += softDeleted.length;
      stats.eligible_for_purge += eligible;
      stats.protected_by_law += protectedCount;

      stats.by_entity_type[table.type] = {
        soft_deleted: softDeleted.length,
        eligible_for_purge: eligible,
        protected: protectedCount,
      };
    }

    // Get last purge time from deletion logs
    const lastPurge = await db.deletion_logs
      .where('[company_id+hard_deleted_at]')
      .between([companyId, 0], [companyId, Date.now()])
      .reverse()
      .first();

    if (lastPurge) {
      stats.last_purge_at = lastPurge.hard_deleted_at;
    }

    retentionLogger.debug('Generated retention statistics', {
      companyId,
      stats,
    });

    return stats;
  } catch (error) {
    retentionLogger.error('Failed to get retention statistics', {
      companyId,
      error,
    });
    throw error;
  }
}

/**
 * Securely overwrite data before deletion
 * Replaces sensitive fields with random data to prevent recovery
 */
function secureOverwrite(record: any): any {
  const overwritten = { ...record };

  // List of sensitive fields to overwrite
  const sensitiveFields = [
    'name',
    'description',
    'memo',
    'reference',
    'email',
    'phone',
    'address',
    'balance',
    'amount',
    'debit',
    'credit',
    'attachments',
    'before_value',
    'after_value',
  ];

  for (const field of sensitiveFields) {
    if (field in overwritten) {
      // Overwrite with random data of similar length
      if (typeof overwritten[field] === 'string') {
        const length = overwritten[field].length;
        overwritten[field] = Array(length)
          .fill(0)
          .map(() => Math.random().toString(36).charAt(2))
          .join('');
      } else if (typeof overwritten[field] === 'number') {
        overwritten[field] = Math.floor(Math.random() * 1000000);
      } else if (Array.isArray(overwritten[field])) {
        overwritten[field] = [];
      }
    }
  }

  return overwritten;
}

/**
 * Purge a single soft-deleted record
 */
export async function purgeRecord(
  companyId: string,
  entityType: RetentionEntityType,
  entityId: string,
  deletionMethod: DeletionMethod = DeletionMethod.SECURE_DELETE,
  deletedBy: string = 'SYSTEM',
  reason: string | null = null
): Promise<PurgeResult> {
  validateCompanyId(companyId);

  try {
    // Determine which table to purge from
    const tableMap: Record<string, string> = {
      ACCOUNT: 'accounts',
      TRANSACTION: 'transactions',
      CONTACT: 'contacts',
      PRODUCT: 'products',
      INVOICE: 'invoices',
      BILL: 'bills',
      RECEIPT: 'receipts',
      RECONCILIATION: 'reconciliations',
      CATEGORY: 'categories',
      TAG: 'tags',
    };

    const tableName = tableMap[entityType];
    if (!tableName) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    const dbTable = (db as any)[tableName];
    const record = await dbTable.get(entityId);

    if (!record) {
      return {
        entity_id: entityId,
        entity_type: entityType,
        success: false,
        error: 'Record not found',
        deletion_method: deletionMethod,
      };
    }

    // Handle both companyId and company_id field names
    const recordCompanyId = record.companyId || record.company_id;
    if (recordCompanyId !== companyId) {
      return {
        entity_id: entityId,
        entity_type: entityType,
        success: false,
        error: 'Unauthorized: Record does not belong to this company',
        deletion_method: deletionMethod,
      };
    }

    // Handle both deletedAt and deleted_at field names
    const recordDeletedAt = record.deletedAt || record.deleted_at;
    if (!recordDeletedAt) {
      return {
        entity_id: entityId,
        entity_type: entityType,
        success: false,
        error: 'Record is not soft-deleted',
        deletion_method: deletionMethod,
      };
    }

    // Get retention policy
    const policy = await getRetentionPolicy(companyId, entityType);
    const retentionDays = policy?.retention_days || DEFAULT_RETENTION_DAYS;
    const enforceMinimum = policy?.enforce_minimum !== false;

    // Check if eligible for purge
    if (
      !isEligibleForPurge(recordDeletedAt, entityType, retentionDays, enforceMinimum)
    ) {
      const effectiveRetention = calculateEffectiveRetention(
        entityType,
        retentionDays,
        enforceMinimum
      );
      return {
        entity_id: entityId,
        entity_type: entityType,
        success: false,
        error: `Record not eligible for purge (retention period: ${effectiveRetention} days)`,
        deletion_method: deletionMethod,
      };
    }

    // Perform secure deletion if requested
    if (deletionMethod === DeletionMethod.SECURE_DELETE) {
      // Overwrite with random data first
      const overwritten = secureOverwrite(record);
      await dbTable.put(overwritten);

      // Small delay to ensure write completes
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Delete the record
    await dbTable.delete(entityId);

    // Log the deletion
    const deletionLog = createDeletionLog(
      companyId,
      entityType,
      entityId,
      deletionMethod,
      deletedBy,
      recordDeletedAt,
      policy?.id || null,
      reason,
      {
        original_deleted_at: recordDeletedAt,
        purge_triggered_by: deletedBy,
      }
    );

    const logEntry: DeletionLog = {
      id: nanoid(),
      ...deletionLog,
    } as DeletionLog;

    await db.deletion_logs.add(logEntry);

    retentionLogger.info('Purged record', {
      companyId,
      entityType,
      entityId,
      deletionMethod,
    });

    return {
      entity_id: entityId,
      entity_type: entityType,
      success: true,
      error: null,
      deletion_method: deletionMethod,
    };
  } catch (error: any) {
    retentionLogger.error('Failed to purge record', {
      companyId,
      entityType,
      entityId,
      error,
    });

    return {
      entity_id: entityId,
      entity_type: entityType,
      success: false,
      error: error.message || 'Unknown error',
      deletion_method: deletionMethod,
    };
  }
}

/**
 * Auto-purge all eligible soft-deleted records for a company
 */
export async function autoPurgeCompany(
  companyId: string,
  config: AutoPurgeConfig = DEFAULT_AUTO_PURGE_CONFIG
): Promise<BatchPurgeResult> {
  validateCompanyId(companyId);

  const result: BatchPurgeResult = {
    company_id: companyId,
    started_at: Date.now(),
    completed_at: 0,
    total_processed: 0,
    total_purged: 0,
    total_protected: 0,
    total_failed: 0,
    results: [],
    errors: [],
  };

  retentionLogger.info('Starting auto-purge', {
    companyId,
    dryRun: config.dry_run,
    batchSize: config.batch_size,
  });

  try {
    const tables = [
      { name: 'accounts', type: 'ACCOUNT' as RetentionEntityType, field: 'companyId' },
      { name: 'transactions', type: 'TRANSACTION' as RetentionEntityType, field: 'companyId' },
      { name: 'contacts', type: 'CONTACT' as RetentionEntityType, field: 'companyId' },
      { name: 'products', type: 'PRODUCT' as RetentionEntityType, field: 'companyId' },
      { name: 'invoices', type: 'INVOICE' as RetentionEntityType, field: 'company_id' },
      { name: 'bills', type: 'BILL' as RetentionEntityType, field: 'company_id' },
      { name: 'receipts', type: 'RECEIPT' as RetentionEntityType, field: 'companyId' },
      { name: 'reconciliations', type: 'RECONCILIATION' as RetentionEntityType, field: 'companyId' },
      { name: 'categories', type: 'CATEGORY' as RetentionEntityType, field: 'company_id' },
      { name: 'tags', type: 'TAG' as RetentionEntityType, field: 'company_id' },
    ];

    for (const table of tables) {
      const policy = await getRetentionPolicy(companyId, table.type);
      const retentionDays = policy?.retention_days || DEFAULT_RETENTION_DAYS;
      const enforceMinimum = policy?.enforce_minimum !== false;

      // Get soft-deleted records
      const dbTable = (db as any)[table.name];
      const softDeleted = await dbTable
        .where(table.field)
        .equals(companyId)
        .and((record: any) => record.deletedAt !== null && record.deletedAt !== undefined)
        .limit(config.batch_size)
        .toArray();

      for (const record of softDeleted) {
        result.total_processed++;

        const eligible = isEligibleForPurge(
          record.deletedAt,
          table.type,
          retentionDays,
          enforceMinimum
        );

        if (!eligible) {
          // Check if protected by 7-year rule
          const effectiveRetention = calculateEffectiveRetention(
            table.type,
            retentionDays,
            enforceMinimum
          );
          if (
            requiresLegalRetention(table.type) &&
            effectiveRetention === LEGAL_MINIMUM_RETENTION_DAYS
          ) {
            result.total_protected++;
          }
          continue;
        }

        if (config.dry_run) {
          retentionLogger.debug('Dry run: Would purge record', {
            entityType: table.type,
            entityId: record.id,
          });
          result.total_purged++;
          continue;
        }

        // Purge the record
        const purgeResult = await purgeRecord(
          companyId,
          table.type,
          record.id,
          'AUTO_PURGE' as DeletionMethod,
          'SYSTEM',
          'Auto-purge by retention policy'
        );

        result.results.push(purgeResult);

        if (purgeResult.success) {
          result.total_purged++;
        } else {
          result.total_failed++;
          result.errors.push({
            entity_id: record.id,
            entity_type: table.type,
            error: purgeResult.error || 'Unknown error',
          });
        }
      }
    }

    result.completed_at = Date.now();

    retentionLogger.info('Auto-purge completed', {
      companyId,
      processed: result.total_processed,
      purged: result.total_purged,
      protected: result.total_protected,
      failed: result.total_failed,
      duration: result.completed_at - result.started_at,
    });

    return result;
  } catch (error) {
    retentionLogger.error('Auto-purge failed', { companyId, error });
    result.completed_at = Date.now();
    throw error;
  }
}

/**
 * Get deletion logs for a company
 */
export async function getDeletionLogs(
  companyId: string,
  options: {
    entityType?: RetentionEntityType;
    entityId?: string;
    deletedBy?: string;
    dateFrom?: number;
    dateTo?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<DeletionLog[]> {
  validateCompanyId(companyId);

  try {
    let query = db.deletion_logs.where('company_id').equals(companyId);

    if (options.entityType) {
      query = db.deletion_logs
        .where('[company_id+entity_type]')
        .equals([companyId, options.entityType]);
    }

    let logs = await query.toArray();

    // Apply filters
    if (options.entityId) {
      logs = logs.filter((log) => log.entity_id === options.entityId);
    }

    if (options.deletedBy) {
      logs = logs.filter((log) => log.deleted_by === options.deletedBy);
    }

    if (options.dateFrom) {
      logs = logs.filter((log) => log.hard_deleted_at >= options.dateFrom!);
    }

    if (options.dateTo) {
      logs = logs.filter((log) => log.hard_deleted_at <= options.dateTo!);
    }

    // Sort by deletion time (newest first)
    logs.sort((a, b) => b.hard_deleted_at - a.hard_deleted_at);

    // Apply pagination
    if (options.offset) {
      logs = logs.slice(options.offset);
    }

    if (options.limit) {
      logs = logs.slice(0, options.limit);
    }

    retentionLogger.debug('Retrieved deletion logs', {
      companyId,
      count: logs.length,
      options,
    });

    return logs;
  } catch (error) {
    retentionLogger.error('Failed to get deletion logs', { companyId, error });
    throw error;
  }
}
