/**
 * Data Retention Policy Types
 *
 * Defines types for configurable data retention and secure deletion.
 * Implements S7-5: Data Retention Policies from Security Hardening Roadmap.
 *
 * Requirements:
 * - S7-5: Configurable retention periods for deleted records
 * - 7-year retention requirement for accounting records (legal compliance)
 * - Secure deletion with data overwrite
 * - Auto-purge functionality
 */

import type { BaseEntity } from './database.types';

/**
 * Entity types that support retention policies
 */
export type RetentionEntityType =
  | 'ACCOUNT'
  | 'TRANSACTION'
  | 'CONTACT'
  | 'PRODUCT'
  | 'INVOICE'
  | 'BILL'
  | 'RECEIPT'
  | 'RECONCILIATION'
  | 'CATEGORY'
  | 'TAG'
  | 'AUDIT_LOG'
  | 'ALL'; // Default policy applies to all entities

/**
 * Retention policy configuration
 * Determines how long soft-deleted records are kept before secure deletion
 */
export interface RetentionPolicy extends BaseEntity {
  company_id: string; // UUID - Company this policy belongs to
  entity_type: RetentionEntityType; // Which entities this policy applies to
  retention_days: number; // Number of days to retain soft-deleted records
  is_active: boolean; // Whether this policy is currently enforced
  enforce_minimum: boolean; // Whether to enforce 7-year minimum for financial records
  description: string | null; // Optional description of the policy
  created_by: string; // User ID who created the policy
  last_modified_by: string; // User ID who last modified the policy
}

/**
 * Deletion log entry
 * Tracks secure deletion operations for audit purposes
 */
export interface DeletionLog extends BaseEntity {
  company_id: string; // UUID - Company this deletion belongs to
  entity_type: RetentionEntityType; // Type of entity that was deleted
  entity_id: string; // UUID of the deleted entity
  deletion_method: DeletionMethod; // How the data was deleted
  deleted_by: string; // User ID who initiated the deletion (or 'SYSTEM' for auto-purge)
  soft_deleted_at: number; // When the entity was soft-deleted
  hard_deleted_at: number; // When the entity was permanently deleted
  retention_policy_id: string | null; // UUID - Policy that triggered the deletion
  reason: string | null; // Optional reason for deletion
  metadata: Record<string, unknown> | null; // Additional metadata about the deletion
}

/**
 * Deletion methods
 */
export enum DeletionMethod {
  SOFT_DELETE = 'SOFT_DELETE', // Mark as deleted (deletedAt timestamp)
  SECURE_DELETE = 'SECURE_DELETE', // Overwrite with random data then delete
  AUTO_PURGE = 'AUTO_PURGE', // Automatic purge based on retention policy
}

/**
 * Retention statistics for dashboard/reporting
 */
export interface RetentionStatistics {
  company_id: string;
  total_soft_deleted: number; // Total soft-deleted records
  eligible_for_purge: number; // Records that can be purged now
  protected_by_law: number; // Financial records protected by 7-year rule
  days_until_next_purge: number; // Days until next record becomes eligible
  by_entity_type: Record<RetentionEntityType, {
    soft_deleted: number;
    eligible_for_purge: number;
    protected: number;
  }>;
  last_purge_at: number | null; // When auto-purge last ran
  next_purge_at: number | null; // When auto-purge will run next
}

/**
 * Purge result for a single entity
 */
export interface PurgeResult {
  entity_id: string;
  entity_type: RetentionEntityType;
  success: boolean;
  error: string | null;
  deletion_method: DeletionMethod;
}

/**
 * Batch purge result
 */
export interface BatchPurgeResult {
  company_id: string;
  started_at: number;
  completed_at: number;
  total_processed: number;
  total_purged: number;
  total_protected: number; // Records protected by 7-year rule
  total_failed: number;
  results: PurgeResult[];
  errors: Array<{
    entity_id: string;
    entity_type: RetentionEntityType;
    error: string;
  }>;
}

/**
 * Retention policy defaults
 */
export const DEFAULT_RETENTION_DAYS = 90; // 90 days default
export const LEGAL_MINIMUM_RETENTION_DAYS = 2557; // 7 years in days (365.25 * 7)
export const FINANCIAL_ENTITY_TYPES: RetentionEntityType[] = [
  'ACCOUNT',
  'TRANSACTION',
  'INVOICE',
  'BILL',
  'RECEIPT',
  'RECONCILIATION',
  'AUDIT_LOG',
];

/**
 * Check if entity type requires 7-year retention
 */
export function requiresLegalRetention(entityType: RetentionEntityType): boolean {
  return FINANCIAL_ENTITY_TYPES.includes(entityType);
}

/**
 * Calculate effective retention period
 * Returns the longer of: configured retention or legal minimum (for financial records)
 */
export function calculateEffectiveRetention(
  entityType: RetentionEntityType,
  configuredDays: number,
  enforceMinimum: boolean = true
): number {
  if (!enforceMinimum) {
    return configuredDays;
  }

  if (requiresLegalRetention(entityType)) {
    return Math.max(configuredDays, LEGAL_MINIMUM_RETENTION_DAYS);
  }

  return configuredDays;
}

/**
 * Check if a soft-deleted record is eligible for purge
 */
export function isEligibleForPurge(
  deletedAt: number | null,
  entityType: RetentionEntityType,
  retentionDays: number,
  enforceMinimum: boolean = true
): boolean {
  if (!deletedAt) {
    return false; // Not soft-deleted
  }

  const effectiveRetention = calculateEffectiveRetention(
    entityType,
    retentionDays,
    enforceMinimum
  );

  const retentionPeriodMs = effectiveRetention * 24 * 60 * 60 * 1000;
  const age = Date.now() - deletedAt;

  return age >= retentionPeriodMs;
}

/**
 * Auto-purge configuration
 * Determines when and how auto-purge runs
 */
export interface AutoPurgeConfig {
  enabled: boolean; // Whether auto-purge is enabled
  schedule_cron: string; // Cron expression for scheduling (e.g., "0 2 * * *" for 2am daily)
  batch_size: number; // Maximum records to purge in one batch
  dry_run: boolean; // If true, don't actually delete, just log what would be deleted
  notify_admin: boolean; // Whether to notify admin after purge
}

/**
 * Default auto-purge configuration
 */
export const DEFAULT_AUTO_PURGE_CONFIG: AutoPurgeConfig = {
  enabled: false, // Disabled by default for safety
  schedule_cron: '0 2 * * *', // 2am daily
  batch_size: 100, // Process 100 records at a time
  dry_run: false,
  notify_admin: true,
};
