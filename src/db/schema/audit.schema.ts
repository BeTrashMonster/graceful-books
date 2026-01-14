/**
 * Audit Log Schema Definition
 *
 * Defines the structure for immutable audit logs of all financial changes.
 * Supports compliance, forensic analysis, and change tracking.
 *
 * Requirements:
 * - ACCT-011: Audit Log Schema
 * - Immutable audit trail
 * - Before/after value tracking
 */

import type {
  AuditLog,
  AuditAction,
  AuditEntityType,
} from '../../types/database.types';

/**
 * Dexie.js schema definition for AuditLogs table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying audit logs by company
 * - user_id: For querying logs by user
 * - entity_type: For querying by entity type
 * - entity_id: For querying all changes to a specific entity
 * - action: For querying by action type
 * - [company_id+timestamp]: Compound index for time-range queries
 * - [company_id+entity_type]: Compound index for entity-filtered queries
 * - [entity_type+entity_id]: Compound index for entity history
 * - timestamp: For time-based queries and cleanup
 *
 * Note: Audit logs do NOT have updated_at or version_vector as they are immutable
 */
export const auditLogsSchema = 'id, company_id, user_id, entity_type, entity_id, action, [company_id+timestamp], [company_id+entity_type], [entity_type+entity_id], timestamp';

/**
 * Table name constant
 */
export const AUDIT_LOGS_TABLE = 'audit_logs';

/**
 * Create new AuditLog entry
 * Note: Audit logs are immutable - no updates allowed
 */
export const createAuditLog = (
  companyId: string,
  userId: string,
  entityType: AuditEntityType,
  entityId: string,
  action: AuditAction,
  beforeValue: any | null,
  afterValue: any | null,
  changedFields: string[]
): Partial<AuditLog> => {
  const now = Date.now();

  return {
    company_id: companyId,
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    before_value: beforeValue ? JSON.stringify(beforeValue) : null,
    after_value: afterValue ? JSON.stringify(afterValue) : null,
    changed_fields: changedFields,
    ip_address: null, // Will be filled in by audit service
    device_id: null, // Will be filled in by audit service
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    timestamp: now,
    created_at: now,
    updated_at: now, // Same as created_at for audit logs
    deleted_at: null, // Audit logs are never deleted, only retained per policy
  };
};

/**
 * Calculate changed fields between two objects
 */
export const calculateChangedFields = (
  before: any,
  after: any
): string[] => {
  const changedFields: string[] = [];

  if (!before || !after) {
    return changedFields;
  }

  // Get all unique keys from both objects
  const allKeys = new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ]);

  for (const key of allKeys) {
    // Skip certain fields that we don't want to track
    if (shouldSkipField(key)) {
      continue;
    }

    const beforeValue = before[key];
    const afterValue = after[key];

    // Deep comparison for objects and arrays
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changedFields.push(key);
    }
  }

  return changedFields;
};

/**
 * Fields to skip in change tracking
 */
const shouldSkipField = (fieldName: string): boolean => {
  const skipFields = [
    'updated_at',
    'version_vector',
    'deleted_at', // Track deletions via action type
  ];

  return skipFields.includes(fieldName);
};

/**
 * Query helper: Get audit logs for a company
 */
export interface GetAuditLogsQuery {
  company_id: string;
  user_id?: string;
  entity_type?: AuditEntityType;
  entity_id?: string;
  action?: AuditAction;
  date_from?: number;
  date_to?: number;
  limit?: number;
  offset?: number;
}

/**
 * Audit log summary for reporting
 */
export interface AuditLogSummary {
  total_count: number;
  by_action: Record<AuditAction, number>;
  by_entity_type: Record<AuditEntityType, number>;
  by_user: Record<string, number>;
  date_range: {
    earliest: number;
    latest: number;
  };
}

/**
 * Audit trail for a specific entity
 * Shows complete history of changes
 */
export interface EntityAuditTrail {
  entity_type: AuditEntityType;
  entity_id: string;
  history: AuditLog[];
  created_by: string;
  created_at: number;
  last_modified_by: string;
  last_modified_at: number;
  modification_count: number;
}

/**
 * Helper: Get action display name
 */
export const getAuditActionDisplay = (action: AuditAction): string => {
  const displays: Record<AuditAction, string> = {
    CREATE: 'Created',
    UPDATE: 'Updated',
    DELETE: 'Deleted',
    RESTORE: 'Restored',
    LOGIN: 'Logged in',
    LOGOUT: 'Logged out',
    EXPORT: 'Exported',
    IMPORT: 'Imported',
  };
  return displays[action];
};

/**
 * Helper: Get entity type display name
 */
export const getEntityTypeDisplay = (entityType: AuditEntityType): string => {
  const displays: Record<AuditEntityType, string> = {
    ACCOUNT: 'Account',
    TRANSACTION: 'Transaction',
    CONTACT: 'Contact',
    PRODUCT: 'Product',
    USER: 'User',
    COMPANY: 'Company',
    SESSION: 'Session',
    RECONCILIATION_PATTERN: 'Reconciliation Pattern',
    RECONCILIATION_RECORD: 'Reconciliation Record',
    RECONCILIATION_STREAK: 'Reconciliation Streak',
  };
  return displays[entityType];
};

/**
 * Helper: Format audit log entry for display
 */
export interface FormattedAuditLog {
  timestamp: string;
  action: string;
  entity: string;
  user: string;
  changes: string;
  details: string | null;
}

export const formatAuditLog = (
  log: AuditLog,
  userName: string = 'Unknown User'
): FormattedAuditLog => {
  const timestamp = new Date(log.timestamp).toLocaleString();
  const action = getAuditActionDisplay(log.action);
  const entity = `${getEntityTypeDisplay(log.entity_type)} (${log.entity_id.substring(0, 8)}...)`;

  let changes = '';
  if (log.changed_fields.length > 0) {
    changes = log.changed_fields.join(', ');
  }

  let details = null;
  if (log.before_value || log.after_value) {
    details = formatBeforeAfterChanges(log);
  }

  return {
    timestamp,
    action,
    entity,
    user: userName,
    changes,
    details,
  };
};

/**
 * Helper: Format before/after changes for display
 */
const formatBeforeAfterChanges = (log: AuditLog): string => {
  const changes: string[] = [];

  if (!log.before_value && log.after_value) {
    // Creation
    return 'Entity created';
  }

  if (log.before_value && !log.after_value) {
    // Deletion
    return 'Entity deleted';
  }

  if (log.before_value && log.after_value) {
    try {
      const before = JSON.parse(log.before_value);
      const after = JSON.parse(log.after_value);

      for (const field of log.changed_fields) {
        const beforeVal = before[field];
        const afterVal = after[field];
        changes.push(`${field}: ${beforeVal} → ${afterVal}`);
      }

      return changes.join('; ');
    } catch (error) {
      return 'Changes recorded';
    }
  }

  return '';
};

/**
 * Compliance: Get audit logs for date range
 * Used for compliance reporting and forensic analysis
 */
export interface ComplianceAuditQuery {
  company_id: string;
  start_date: number;
  end_date: number;
  entity_types?: AuditEntityType[];
  include_system_actions?: boolean; // Include LOGIN, LOGOUT, etc.
}

/**
 * Helper: Check if audit log should be retained
 * Based on company retention policy
 */
export const shouldRetainAuditLog = (
  log: AuditLog,
  retentionPeriodDays: number
): boolean => {
  const retentionPeriodMs = retentionPeriodDays * 24 * 60 * 60 * 1000;
  const age = Date.now() - log.timestamp;
  return age < retentionPeriodMs;
};

/**
 * Helper: Anonymize audit log for privacy
 * Used when sharing audit logs or for long-term archival
 */
export const anonymizeAuditLog = (log: AuditLog): AuditLog => {
  return {
    ...log,
    user_id: '[REDACTED]',
    ip_address: null,
    device_id: null,
    user_agent: null,
    before_value: log.before_value ? '[REDACTED]' : null,
    after_value: log.after_value ? '[REDACTED]' : null,
  };
};

/**
 * Audit statistics for dashboard
 */
export interface AuditStatistics {
  total_changes_today: number;
  total_changes_this_week: number;
  total_changes_this_month: number;
  most_active_user: string;
  most_modified_entity_type: AuditEntityType;
  recent_changes: AuditLog[];
}

/**
 * Helper: Validate audit log completeness
 */
export const validateAuditLog = (log: Partial<AuditLog>): string[] => {
  const errors: string[] = [];

  if (!log.company_id) {
    errors.push('company_id is required');
  }

  if (!log.user_id) {
    errors.push('user_id is required');
  }

  if (!log.entity_type) {
    errors.push('entity_type is required');
  }

  if (!log.entity_id) {
    errors.push('entity_id is required');
  }

  if (!log.action) {
    errors.push('action is required');
  }

  if (!log.timestamp) {
    errors.push('timestamp is required');
  }

  // Ensure changed_fields is provided for UPDATE actions
  if (log.action === 'UPDATE' && (!log.changed_fields || log.changed_fields.length === 0)) {
    errors.push('changed_fields is required for UPDATE actions');
  }

  return errors;
};
