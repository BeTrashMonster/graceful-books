/**
 * Conflict History and Notification Schema
 *
 * Dexie schemas for conflict resolution tracking.
 *
 * Requirements:
 * - ARCH-004: CRDT conflict resolution
 * - Group I, Item I1: Conflict history and notifications
 */

/**
 * Conflict History Schema
 *
 * Indexes:
 * - id (primary key)
 * - conflictId (for lookups)
 * - [entityType+entityId] (compound index for entity lookups)
 * - detectedAt (for time-based queries)
 * - resolvedAt (for finding unresolved conflicts)
 */
export const conflictHistorySchema =
  'id, conflictId, [entityType+entityId], entityType, entityId, detectedAt, resolvedAt, severity';

/**
 * Conflict Notifications Schema
 *
 * Indexes:
 * - id (primary key)
 * - conflictId (for linking to history)
 * - read (for finding unread notifications)
 * - dismissed (for filtering)
 * - detectedAt (for sorting)
 * - severity (for filtering by urgency)
 */
export const conflictNotificationsSchema =
  'id, conflictId, read, dismissed, detectedAt, severity, requiresAction';
