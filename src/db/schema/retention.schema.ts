/**
 * Retention Policy Schema Definition
 *
 * Defines database schema for data retention policies and deletion logs.
 * Implements S7-5: Data Retention Policies from Security Hardening Roadmap.
 *
 * Requirements:
 * - Store retention policy configurations per company
 * - Track secure deletion operations
 * - Support auto-purge functionality
 */

import type {
  RetentionPolicy,
  DeletionLog,
  RetentionEntityType,
  DeletionMethod,
} from '../../types/retention.types';

/**
 * Dexie.js schema definition for retention_policies table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying policies by company
 * - entity_type: For querying policies by entity type
 * - [company_id+entity_type]: Compound index for finding specific policy
 * - [company_id+is_active]: For querying active policies
 * - updated_at: For tracking policy changes
 */
export const retentionPoliciesSchema =
  'id, company_id, entity_type, [company_id+entity_type], [company_id+is_active], updated_at, deleted_at';

/**
 * Dexie.js schema definition for deletion_logs table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying deletion logs by company
 * - entity_type: For querying by entity type
 * - entity_id: For querying deletions of a specific entity
 * - deleted_by: For querying deletions by user
 * - [company_id+entity_type]: Compound index for entity-filtered queries
 * - [company_id+hard_deleted_at]: For time-range queries
 * - hard_deleted_at: For chronological queries
 */
export const deletionLogsSchema =
  'id, company_id, entity_type, entity_id, deleted_by, [company_id+entity_type], [company_id+hard_deleted_at], hard_deleted_at';

/**
 * Table name constants
 */
export const RETENTION_POLICIES_TABLE = 'retention_policies';
export const DELETION_LOGS_TABLE = 'deletion_logs';

/**
 * Create new RetentionPolicy entry
 */
export const createRetentionPolicy = (
  companyId: string,
  userId: string,
  entityType: RetentionEntityType,
  retentionDays: number,
  enforceMinimum: boolean = true,
  description: string | null = null
): Partial<RetentionPolicy> => {
  const now = Date.now();

  return {
    company_id: companyId,
    entity_type: entityType,
    retention_days: retentionDays,
    is_active: true,
    enforce_minimum: enforceMinimum,
    description,
    created_by: userId,
    last_modified_by: userId,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
};

/**
 * Create new DeletionLog entry
 */
export const createDeletionLog = (
  companyId: string,
  entityType: RetentionEntityType,
  entityId: string,
  deletionMethod: DeletionMethod,
  deletedBy: string,
  softDeletedAt: number,
  retentionPolicyId: string | null = null,
  reason: string | null = null,
  metadata: Record<string, unknown> | null = null
): Partial<DeletionLog> => {
  const now = Date.now();

  return {
    company_id: companyId,
    entity_type: entityType,
    entity_id: entityId,
    deletion_method: deletionMethod,
    deleted_by: deletedBy,
    soft_deleted_at: softDeletedAt,
    hard_deleted_at: now,
    retention_policy_id: retentionPolicyId,
    reason,
    metadata,
    created_at: now,
    updated_at: now,
    deleted_at: null, // Deletion logs themselves are never deleted
  };
};

/**
 * Query helper: Get retention policies for a company
 */
export interface GetRetentionPoliciesQuery {
  company_id: string;
  entity_type?: RetentionEntityType;
  is_active?: boolean;
}

/**
 * Query helper: Get deletion logs for a company
 */
export interface GetDeletionLogsQuery {
  company_id: string;
  entity_type?: RetentionEntityType;
  entity_id?: string;
  deleted_by?: string;
  date_from?: number;
  date_to?: number;
  limit?: number;
  offset?: number;
}

/**
 * Helper: Get default retention policy
 * Used when no specific policy exists for an entity type
 */
export const DEFAULT_RETENTION_POLICY: Partial<RetentionPolicy> = {
  entity_type: 'ALL',
  retention_days: 90, // 90 days default
  is_active: true,
  enforce_minimum: true, // Always enforce 7-year rule by default
  description: 'Default retention policy for all entities',
};

/**
 * Helper: Validate retention policy
 */
export const validateRetentionPolicy = (
  policy: Partial<RetentionPolicy>
): string[] => {
  const errors: string[] = [];

  if (!policy.company_id) {
    errors.push('company_id is required');
  }

  if (!policy.entity_type) {
    errors.push('entity_type is required');
  }

  if (policy.retention_days === undefined || policy.retention_days === null) {
    errors.push('retention_days is required');
  } else if (policy.retention_days < 1) {
    errors.push('retention_days must be at least 1 day');
  } else if (policy.retention_days > 36500) {
    // 100 years max
    errors.push('retention_days cannot exceed 36500 days (100 years)');
  }

  if (!policy.created_by) {
    errors.push('created_by is required');
  }

  return errors;
};

/**
 * Helper: Validate deletion log
 */
export const validateDeletionLog = (log: Partial<DeletionLog>): string[] => {
  const errors: string[] = [];

  if (!log.company_id) {
    errors.push('company_id is required');
  }

  if (!log.entity_type) {
    errors.push('entity_type is required');
  }

  if (!log.entity_id) {
    errors.push('entity_id is required');
  }

  if (!log.deletion_method) {
    errors.push('deletion_method is required');
  }

  if (!log.deleted_by) {
    errors.push('deleted_by is required');
  }

  if (!log.soft_deleted_at) {
    errors.push('soft_deleted_at is required');
  }

  if (!log.hard_deleted_at) {
    errors.push('hard_deleted_at is required');
  }

  return errors;
};

/**
 * Helper: Format retention period for display
 */
export const formatRetentionPeriod = (days: number): string => {
  if (days < 30) {
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? '' : 's'}`;
  }

  const years = Math.floor(days / 365);
  const remainingDays = days % 365;

  if (remainingDays === 0) {
    return `${years} year${years === 1 ? '' : 's'}`;
  }

  const remainingMonths = Math.floor(remainingDays / 30);
  if (remainingMonths > 0) {
    return `${years} year${years === 1 ? '' : 's'}, ${remainingMonths} month${remainingMonths === 1 ? '' : 's'}`;
  }

  return `${years} year${years === 1 ? '' : 's'}, ${remainingDays} day${remainingDays === 1 ? '' : 's'}`;
};

/**
 * Helper: Get entity type display name
 */
export const getEntityTypeDisplay = (entityType: RetentionEntityType): string => {
  const displays: Record<RetentionEntityType, string> = {
    ACCOUNT: 'Accounts',
    TRANSACTION: 'Transactions',
    CONTACT: 'Contacts',
    PRODUCT: 'Products',
    INVOICE: 'Invoices',
    BILL: 'Bills',
    RECEIPT: 'Receipts',
    RECONCILIATION: 'Reconciliations',
    CATEGORY: 'Categories',
    TAG: 'Tags',
    AUDIT_LOG: 'Audit Logs',
    ALL: 'All Records',
  };
  return displays[entityType];
};
