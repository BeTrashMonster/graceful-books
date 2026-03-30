/**
 * Backup Audit Log Schema Definition
 *
 * Implements blockchain-style chaining for immutable audit trail of backup and sync operations.
 * Each event is cryptographically linked to the previous event to ensure tamper-proof history.
 *
 * Requirements:
 * - ROADMAP_BACKUP_AND_SYNC.md - Task 1.4: Immutable Audit Trail
 * - OWASP A08 (Data Integrity Failures) compliance
 * - 7-year retention policy (GAAP compliance)
 *
 * Security Features:
 * - SHA-256 hashing for event integrity
 * - Blockchain-style chaining (previousEventHash)
 * - Immutable records (no updates/deletes)
 * - Tamper detection via chain verification
 */

/**
 * Backup audit event types
 */
export type BackupAuditEventType =
  | 'BACKUP_CREATED'
  | 'BACKUP_RESTORED'
  | 'BACKUP_DELETED'
  | 'KEY_ROTATED'
  | 'SYNC_STARTED'
  | 'SYNC_COMPLETED'
  | 'SYNC_FAILED'
  | 'ENCRYPTION_KEY_CHANGED';

/**
 * Backup audit event interface
 *
 * This represents a single event in the blockchain-style audit chain.
 * Each event is cryptographically linked to the previous event.
 */
export interface BackupAuditEvent {
  id: string; // UUID
  timestamp: number; // Unix timestamp in milliseconds
  eventType: BackupAuditEventType;
  userId: string; // User who triggered the event
  companyId: string; // Company this event belongs to
  metadata: BackupAuditMetadata;
  previousEventHash: string; // SHA-256 hash of previous event (or 'GENESIS' for first event)
  eventHash: string; // SHA-256 hash of this event
  created_at: number; // Immutable timestamp
  updated_at: number; // Same as created_at (never updated)
  deleted_at: number | null; // Always null (never deleted, only expired after 7 years)
}

/**
 * Metadata for backup audit events
 */
export interface BackupAuditMetadata {
  backupId?: string; // ID of backup file (for BACKUP_* events)
  ipAddress: string; // IP address of client (if available)
  userAgent: string; // Browser user agent
  deviceId: string; // Device that triggered event
  success: boolean; // Whether operation succeeded
  errorMessage?: string; // Error message if success=false
  backupSize?: number; // Size of backup in bytes
  recordCount?: number; // Number of records in backup
  encryptionMethod?: string; // Encryption algorithm used
  keyId?: string; // ID of encryption key used
  syncServerId?: string; // ID of sync server (for sync events)
  duration?: number; // Operation duration in milliseconds
}

/**
 * Dexie.js schema definition for BackupAuditLogs table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - company_id: For querying logs by company
 * - user_id: For querying logs by user
 * - eventType: For querying by event type
 * - [company_id+timestamp]: Compound index for time-range queries
 * - [company_id+eventType]: Compound index for event-filtered queries
 * - timestamp: For time-based queries and retention policy cleanup
 * - previousEventHash: For chain verification
 *
 * Note: These logs are IMMUTABLE - no updates or deletes allowed
 */
export const backupAuditLogsSchema =
  'id, company_id, user_id, eventType, [company_id+timestamp], [company_id+eventType], timestamp, previousEventHash';

/**
 * Table name constant
 */
export const BACKUP_AUDIT_LOGS_TABLE = 'backup_audit_logs';

/**
 * Query helper: Get backup audit logs for a company
 */
export interface GetBackupAuditLogsQuery {
  company_id: string;
  user_id?: string;
  eventType?: BackupAuditEventType;
  date_from?: number;
  date_to?: number;
  limit?: number;
  offset?: number;
}

/**
 * Backup audit log summary for reporting
 */
export interface BackupAuditLogSummary {
  total_count: number;
  by_event_type: Record<BackupAuditEventType, number>;
  by_user: Record<string, number>;
  date_range: {
    earliest: number;
    latest: number;
  };
  chain_integrity: {
    verified: boolean;
    last_verified_at: number;
    total_events: number;
    broken_links?: number;
  };
}

/**
 * Chain verification result
 */
export interface ChainVerificationResult {
  valid: boolean;
  totalEvents: number;
  verifiedEvents: number;
  errors: ChainVerificationError[];
  genesisHash: string | null;
  lastEventHash: string | null;
}

/**
 * Chain verification error
 */
export interface ChainVerificationError {
  eventId: string;
  timestamp: number;
  errorType: 'HASH_MISMATCH' | 'BROKEN_CHAIN' | 'MISSING_PREVIOUS' | 'INVALID_GENESIS';
  details: string;
  expectedHash?: string;
  actualHash?: string;
}

/**
 * Audit filters for querying
 */
export interface AuditFilters {
  userId?: string;
  eventType?: BackupAuditEventType;
  dateFrom?: number;
  dateTo?: number;
  success?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Helper: Get event type display name
 */
export const getBackupEventTypeDisplay = (eventType: BackupAuditEventType): string => {
  const displays: Record<BackupAuditEventType, string> = {
    BACKUP_CREATED: 'Backup Created',
    BACKUP_RESTORED: 'Backup Restored',
    BACKUP_DELETED: 'Backup Deleted',
    KEY_ROTATED: 'Encryption Key Rotated',
    SYNC_STARTED: 'Sync Started',
    SYNC_COMPLETED: 'Sync Completed',
    SYNC_FAILED: 'Sync Failed',
    ENCRYPTION_KEY_CHANGED: 'Encryption Key Changed',
  };
  return displays[eventType];
};

/**
 * Helper: Format backup audit log entry for display
 */
export interface FormattedBackupAuditLog {
  timestamp: string;
  eventType: string;
  user: string;
  status: string;
  details: string;
  chainPosition: number;
}

export const formatBackupAuditLog = (
  log: BackupAuditEvent,
  userName: string = 'Unknown User',
  position: number = 0
): FormattedBackupAuditLog => {
  const timestamp = new Date(log.timestamp).toLocaleString();
  const eventType = getBackupEventTypeDisplay(log.eventType);
  const status = log.metadata.success ? 'Success' : 'Failed';

  let details = '';
  if (log.metadata.backupId) {
    details += `Backup ID: ${log.metadata.backupId.substring(0, 8)}...`;
  }
  if (log.metadata.backupSize) {
    details += ` Size: ${(log.metadata.backupSize / 1024 / 1024).toFixed(2)} MB`;
  }
  if (log.metadata.recordCount) {
    details += ` Records: ${log.metadata.recordCount}`;
  }
  if (log.metadata.errorMessage) {
    details += ` Error: ${log.metadata.errorMessage}`;
  }
  if (log.metadata.duration) {
    details += ` Duration: ${log.metadata.duration}ms`;
  }

  return {
    timestamp,
    eventType,
    user: userName,
    status,
    details: details.trim() || 'No additional details',
    chainPosition: position,
  };
};

/**
 * Helper: Check if audit log should be retained
 * Based on 7-year retention policy (GAAP compliance)
 */
export const shouldRetainBackupAuditLog = (log: BackupAuditEvent): boolean => {
  const SEVEN_YEARS_MS = 7 * 365.25 * 24 * 60 * 60 * 1000; // Account for leap years
  const age = Date.now() - log.timestamp;
  return age < SEVEN_YEARS_MS;
};

/**
 * Helper: Validate backup audit log completeness
 */
export const validateBackupAuditLog = (log: Partial<BackupAuditEvent>): string[] => {
  const errors: string[] = [];

  if (!log.id) {
    errors.push('id is required');
  }

  if (!log.company_id) {
    errors.push('company_id is required');
  }

  if (!log.user_id) {
    errors.push('user_id is required');
  }

  if (!log.eventType) {
    errors.push('eventType is required');
  }

  if (!log.timestamp) {
    errors.push('timestamp is required');
  }

  if (!log.metadata) {
    errors.push('metadata is required');
  } else {
    if (typeof log.metadata.success !== 'boolean') {
      errors.push('metadata.success is required and must be a boolean');
    }
    if (!log.metadata.ipAddress) {
      errors.push('metadata.ipAddress is required');
    }
    if (!log.metadata.userAgent) {
      errors.push('metadata.userAgent is required');
    }
    if (!log.metadata.deviceId) {
      errors.push('metadata.deviceId is required');
    }
  }

  if (!log.previousEventHash) {
    errors.push('previousEventHash is required');
  }

  if (!log.eventHash) {
    errors.push('eventHash is required');
  }

  return errors;
};

/**
 * Constants
 */
export const GENESIS_HASH = 'GENESIS';
export const SEVEN_YEARS_DAYS = 2557; // 7 * 365.25 days
