/**
 * Conflict History and Notification Store
 *
 * Dexie store for tracking conflict history, notifications, and resolution audit trail.
 *
 * Requirements:
 * - ARCH-004: CRDT conflict resolution
 * - Group I, Item I1: Conflict history tracking and notifications
 */

import { db } from '../db/database';
import { nanoid } from 'nanoid';
import { logger } from '../utils/logger';
import type {
  DetectedConflict,
  ConflictResolution,
  ConflictHistoryEntry,
  ConflictNotification,
  CRDTEntity,
} from '../types/crdt.types';

// ============================================================================
// Conflict History Operations
// ============================================================================

/**
 * Save conflict to history
 */
export async function saveConflictHistory<T extends CRDTEntity>(
  conflict: DetectedConflict<T>,
  resolution: ConflictResolution<T> | null = null
): Promise<void> {
  const historyEntry: ConflictHistoryEntry = {
    id: nanoid(),
    conflictId: conflict.id,
    entityType: conflict.entityType,
    entityId: conflict.entityId,
    conflictType: conflict.conflictType,
    severity: conflict.severity,
    detectedAt: conflict.detectedAt,
    resolvedAt: resolution ? resolution.resolvedAt : null,
    resolution,
    localSnapshot: JSON.stringify(conflict.localVersion),
    remoteSnapshot: JSON.stringify(conflict.remoteVersion),
    resolvedSnapshot: resolution ? JSON.stringify(resolution.resolvedEntity) : null,
    userViewed: false,
    userDismissed: false,
  };

  try {
    await db.table('conflict_history').add(historyEntry);

    logger.info('Conflict history saved', {
      conflictId: conflict.id,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
    });
  } catch (error) {
    logger.error('Failed to save conflict history', {
      conflictId: conflict.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Update conflict resolution in history
 */
export async function updateConflictResolution<T extends CRDTEntity>(
  conflictId: string,
  resolution: ConflictResolution<T>
): Promise<void> {
  try {
    await db.table('conflict_history').where('conflictId').equals(conflictId).modify({
      resolvedAt: resolution.resolvedAt,
      resolution,
      resolvedSnapshot: JSON.stringify(resolution.resolvedEntity),
    });

    logger.info('Conflict resolution updated in history', {
      conflictId,
    });
  } catch (error) {
    logger.error('Failed to update conflict resolution', {
      conflictId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get conflict history for entity
 */
export async function getConflictHistoryForEntity(
  entityType: string,
  entityId: string
): Promise<ConflictHistoryEntry[]> {
  return db
    .table('conflict_history')
    .where('[entityType+entityId]')
    .equals([entityType, entityId])
    .reverse()
    .sortBy('detectedAt');
}

/**
 * Get all unresolved conflicts
 */
export async function getUnresolvedConflicts(): Promise<ConflictHistoryEntry[]> {
  return db
    .table('conflict_history')
    .where('resolvedAt')
    .equals(null)
    .reverse()
    .sortBy('detectedAt');
}

/**
 * Get conflict history by ID
 */
export async function getConflictHistoryById(
  conflictId: string
): Promise<ConflictHistoryEntry | undefined> {
  return db.table('conflict_history').where('conflictId').equals(conflictId).first();
}

/**
 * Mark conflict as viewed by user
 */
export async function markConflictViewed(conflictId: string): Promise<void> {
  await db.table('conflict_history').where('conflictId').equals(conflictId).modify({
    userViewed: true,
  });
}

/**
 * Mark conflict as dismissed by user
 */
export async function markConflictDismissed(conflictId: string): Promise<void> {
  await db.table('conflict_history').where('conflictId').equals(conflictId).modify({
    userDismissed: true,
  });
}

/**
 * Delete old conflict history (cleanup)
 */
export async function deleteOldConflictHistory(
  retentionDays: number = 90
): Promise<number> {
  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  const deleted = await db
    .table('conflict_history')
    .where('detectedAt')
    .below(cutoffTime)
    .delete();

  logger.info('Old conflict history deleted', {
    deleted,
    retentionDays,
  });

  return deleted;
}

// ============================================================================
// Conflict Notifications
// ============================================================================

/**
 * Create conflict notification
 */
export async function createConflictNotification<T extends CRDTEntity>(
  conflict: DetectedConflict<T>
): Promise<ConflictNotification> {
  // Generate user-friendly entity description
  const entityDescription = generateEntityDescription(conflict);

  // Generate Steadiness-style message
  const message = generateConflictMessage(conflict, entityDescription);

  const notification: ConflictNotification = {
    id: nanoid(),
    conflictId: conflict.id,
    entityType: conflict.entityType,
    entityId: conflict.entityId,
    entityDescription,
    severity: conflict.severity,
    message,
    detectedAt: conflict.detectedAt,
    read: false,
    dismissed: false,
    requiresAction: conflict.severity === ('critical' as const),
  };

  try {
    await db.table('conflict_notifications').add(notification);

    logger.info('Conflict notification created', {
      notificationId: notification.id,
      conflictId: conflict.id,
      severity: conflict.severity,
    });

    return notification;
  } catch (error) {
    logger.error('Failed to create conflict notification', {
      conflictId: conflict.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Generate entity description for notification
 */
function generateEntityDescription<T extends CRDTEntity>(
  conflict: DetectedConflict<T>
): string {
  const { entityType, localVersion } = conflict;

  // Extract meaningful identifiers based on entity type
  switch (entityType) {
    case 'Transaction': {
      const txn = localVersion as Record<string, unknown>;
      return `Transaction ${txn.transaction_number || txn.id}`;
    }

    case 'Account': {
      const account = localVersion as Record<string, unknown>;
      return `Account: ${account.name || account.id}`;
    }

    case 'Contact': {
      const contact = localVersion as Record<string, unknown>;
      return `Contact: ${contact.name || contact.id}`;
    }

    case 'Product': {
      const product = localVersion as Record<string, unknown>;
      return `Product: ${product.name || product.id}`;
    }

    case 'Invoice': {
      const invoice = localVersion as Record<string, unknown>;
      return `Invoice ${invoice.invoice_number || invoice.id}`;
    }

    default:
      return `${entityType} ${conflict.entityId.substring(0, 8)}`;
  }
}

/**
 * Generate Steadiness-style conflict message
 */
function generateConflictMessage<T extends CRDTEntity>(
  conflict: DetectedConflict<T>,
  entityDescription: string
): string {
  const { severity, conflictType } = conflict;

  // Base message using Steadiness communication style
  let message = `Heads up: ${entityDescription} was updated in two places at once. `;

  if (severity === ('critical' as const)) {
    message += "We'd like your help choosing which version to keep.";
  } else if (severity === ('high' as const)) {
    message += "We've combined the changes, but you might want to review them.";
  } else {
    message += "We've automatically merged the changes for you.";
  }

  // Add context based on conflict type
  if (conflictType === ('delete_update' as const)) {
    message += ' One version was deleted while the other was updated.';
  }

  return message;
}

/**
 * Get unread conflict notifications
 */
export async function getUnreadConflictNotifications(): Promise<ConflictNotification[]> {
  return db
    .table('conflict_notifications')
    .where('read')
    .equals(0) // Dexie boolean index
    .and(n => !n.dismissed)
    .reverse()
    .sortBy('detectedAt');
}

/**
 * Get all conflict notifications
 */
export async function getAllConflictNotifications(
  limit: number = 50
): Promise<ConflictNotification[]> {
  return db
    .table('conflict_notifications')
    .orderBy('detectedAt')
    .reverse()
    .limit(limit)
    .toArray();
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  await db
    .table('conflict_notifications')
    .where('id')
    .equals(notificationId)
    .modify({
      read: true,
    });
}

/**
 * Dismiss notification
 */
export async function dismissNotification(notificationId: string): Promise<void> {
  await db
    .table('conflict_notifications')
    .where('id')
    .equals(notificationId)
    .modify({
      dismissed: true,
    });
}

/**
 * Delete old notifications (cleanup)
 */
export async function deleteOldNotifications(retentionDays: number = 30): Promise<number> {
  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  const deleted = await db
    .table('conflict_notifications')
    .where('detectedAt')
    .below(cutoffTime)
    .and(n => n.read && n.dismissed)
    .delete();

  logger.info('Old notifications deleted', {
    deleted,
    retentionDays,
  });

  return deleted;
}

// ============================================================================
// Statistics & Reporting
// ============================================================================

/**
 * Get conflict statistics
 */
export async function getConflictStatistics(
  startDate?: number,
  endDate?: number
): Promise<{
  total: number;
  resolved: number;
  unresolved: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  avgResolutionTimeMs: number;
}> {
  let query = db.table('conflict_history');

  if (startDate) {
    query = query.where('detectedAt').aboveOrEqual(startDate);
  }

  if (endDate) {
    query = query.where('detectedAt').belowOrEqual(endDate);
  }

  const conflicts = await query.toArray();

  const total = conflicts.length;
  const resolved = conflicts.filter(c => c.resolvedAt !== null).length;
  const unresolved = total - resolved;

  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  for (const conflict of conflicts) {
    byType[conflict.conflictType] = (byType[conflict.conflictType] || 0) + 1;
    bySeverity[conflict.severity] = (bySeverity[conflict.severity] || 0) + 1;
  }

  const resolutionTimes = conflicts
    .filter(c => c.resolvedAt !== null)
    .map(c => c.resolvedAt! - c.detectedAt);

  const avgResolutionTimeMs =
    resolutionTimes.length > 0
      ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
      : 0;

  return {
    total,
    resolved,
    unresolved,
    byType,
    bySeverity,
    avgResolutionTimeMs,
  };
}
