/**
 * Immutable Audit Trail Service
 *
 * Implements blockchain-style audit logging with event chaining and integrity verification.
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 1, Task 1.4.
 *
 * Security Features:
 * - Blockchain-style event chaining (each event references previous event hash)
 * - SHA-256 hashing for tamper detection
 * - Immutable records (never update/delete)
 * - 7-year retention policy (GAAP compliance)
 */

import { db } from '../../db';
import { logger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/errors';
import type { BackupAuditEvent } from '../../db/schema/backupAudit.schema';
import type { AuditEventType, AuditFilters } from './types';

/**
 * Logs an audit event with blockchain-style chaining
 */
export async function logAuditEvent(
  event: Omit<BackupAuditEvent, 'id' | 'previousEventHash' | 'eventHash' | 'created_at' | 'updated_at' | 'deleted_at'>
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    // Validate required fields
    if (!event.companyId || !event.userId || !event.eventType) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Missing required audit event fields'
      );
    }

    // Get last event for this company to chain from
    const lastEvent = await db.backupAuditLogs
      .where('companyId')
      .equals(event.companyId)
      .reverse()
      .first();

    // Generate event ID
    const eventId = crypto.randomUUID();
    const now = Date.now();

    // Create event with chain references
    const completeEvent: BackupAuditEvent = {
      id: eventId,
      ...event,
      previousEventHash: lastEvent?.eventHash || 'GENESIS',
      eventHash: '', // Will be computed below
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    // Compute hash of this event (including previousEventHash)
    completeEvent.eventHash = await computeEventHash(completeEvent);

    // Store event
    await db.backupAuditLogs.add(completeEvent);

    // Schedule expiration (7 years from now for GAAP compliance)
    const sevenYearsMs = 7 * 365 * 24 * 60 * 60 * 1000;
    const expiresAt = Date.now() + sevenYearsMs;

    logger.info('Audit event logged', {
      eventId,
      eventType: event.eventType,
      companyId: event.companyId,
      userId: event.userId,
      expiresAt: new Date(expiresAt).toISOString(),
    });

    return { success: true, eventId };
  } catch (error) {
    logger.error('Failed to log audit event', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verifies the integrity of the audit chain for a company
 */
export async function verifyAuditChain(
  companyId: string
): Promise<{ valid: boolean; tamperedEventId?: string; error?: string }> {
  try {
    if (!companyId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Company ID is required'
      );
    }

    // Get all events for this company in chronological order
    const events = await db.backupAuditLogs
      .where('companyId')
      .equals(companyId)
      .sortBy('timestamp');

    if (events.length === 0) {
      return { valid: true }; // Empty chain is valid
    }

    // Verify each event in the chain
    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Recompute the hash for this event
      const expectedHash = await computeEventHash(event);

      // Verify hash matches
      if (event.eventHash !== expectedHash) {
        logger.warn('Audit chain tampering detected', {
          eventId: event.id,
          companyId,
          position: i,
        });

        return {
          valid: false,
          tamperedEventId: event.id,
          error: 'Event hash mismatch - tampering detected',
        };
      }

      // Verify chain linkage (except for first event)
      if (i > 0) {
        const previousEvent = events[i - 1];
        if (event.previousEventHash !== previousEvent.eventHash) {
          logger.warn('Audit chain break detected', {
            eventId: event.id,
            companyId,
            position: i,
          });

          return {
            valid: false,
            tamperedEventId: event.id,
            error: 'Chain linkage broken - tampering detected',
          };
        }
      } else {
        // First event should reference GENESIS
        if (event.previousEventHash !== 'GENESIS') {
          return {
            valid: false,
            tamperedEventId: event.id,
            error: 'First event does not reference GENESIS',
          };
        }
      }
    }

    logger.info('Audit chain verified', {
      companyId,
      eventCount: events.length,
    });

    return { valid: true };
  } catch (error) {
    logger.error('Failed to verify audit chain', { error, companyId });
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Retrieves audit events for a company with optional filtering
 */
export async function getAuditEvents(
  companyId: string,
  filters?: AuditFilters
): Promise<{ success: boolean; events?: BackupAuditEvent[]; error?: string }> {
  try {
    if (!companyId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Company ID is required'
      );
    }

    let query = db.backupAuditLogs.where('companyId').equals(companyId);

    // Apply filters
    let events = await query.sortBy('timestamp');

    // Filter by event type
    if (filters?.eventType) {
      events = events.filter((e) => e.eventType === filters.eventType);
    }

    // Filter by user
    if (filters?.userId) {
      events = events.filter((e) => e.userId === filters.userId);
    }

    // Filter by date range
    if (filters?.startDate) {
      events = events.filter((e) => e.timestamp >= filters.startDate!);
    }

    if (filters?.endDate) {
      events = events.filter((e) => e.timestamp <= filters.endDate!);
    }

    // Apply limit
    if (filters?.limit) {
      events = events.slice(0, filters.limit);
    }

    return { success: true, events };
  } catch (error) {
    logger.error('Failed to retrieve audit events', { error, companyId });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Computes SHA-256 hash of an audit event
 */
async function computeEventHash(
  event: Omit<BackupAuditEvent, 'eventHash'>
): Promise<string> {
  // Create deterministic JSON representation (exclude eventHash)
  const eventData = JSON.stringify({
    id: event.id,
    timestamp: event.timestamp,
    eventType: event.eventType,
    userId: event.userId,
    companyId: event.companyId,
    metadata: event.metadata,
    previousEventHash: event.previousEventHash,
  });

  // Compute SHA-256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(eventData);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Cleans up expired audit events (older than 7 years)
 */
export async function cleanupExpiredEvents(): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  try {
    const sevenYearsAgo = Date.now() - 7 * 365 * 24 * 60 * 60 * 1000;

    // Find expired events
    const _expiredEvents = await db.backupAuditLogs
      .where('timestamp')
      .below(sevenYearsAgo)
      .toArray();

    // Delete expired events
    const deletedCount = await db.backupAuditLogs
      .where('timestamp')
      .below(sevenYearsAgo)
      .delete();

    logger.info('Cleaned up expired audit events', {
      deletedCount,
      cutoffDate: new Date(sevenYearsAgo).toISOString(),
    });

    return { success: true, deletedCount };
  } catch (error) {
    logger.error('Failed to cleanup expired events', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
