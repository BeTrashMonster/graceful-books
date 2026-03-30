/**
 * Audit Event Types
 */

export type AuditEventType =
  | 'BACKUP_CREATED'
  | 'BACKUP_RESTORED'
  | 'BACKUP_DELETED'
  | 'KEY_ROTATED'
  | 'USER_REVOKED'
  | 'USER_ADDED'
  | 'PERMISSION_CHANGED';

export interface AuditFilters {
  eventType?: AuditEventType;
  userId?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
}
