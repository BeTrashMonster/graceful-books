/**
 * Sync Protocol
 *
 * Defines the protocol for syncing encrypted data with relay servers.
 * Handles payload encryption, compression, and message format.
 *
 * Requirements:
 * - ARCH-003: Sync infrastructure
 * - ARCH-001: Zero-knowledge encryption
 * - B6: Sync Relay Client
 */

import type { VersionVector } from '../types/database.types';
import type { SyncEntityType, SyncOperationType } from './syncQueue';

/**
 * Sync message types
 */
export enum SyncMessageType {
  PUSH = 'PUSH', // Push local changes to remote
  PULL = 'PULL', // Pull remote changes
  ACK = 'ACK', // Acknowledge received changes
  ERROR = 'ERROR', // Error response
}

/**
 * Sync protocol version
 */
export const SYNC_PROTOCOL_VERSION = '1.0.0';

/**
 * Push request - send local changes to remote
 */
export interface SyncPushRequest {
  protocol_version: string;
  device_id: string;
  timestamp: number;
  changes: SyncChange[];
}

/**
 * A single change to sync
 */
export interface SyncChange {
  id: string; // Queue item ID
  entity_type: SyncEntityType;
  entity_id: string;
  operation: SyncOperationType;
  encrypted_payload: string; // Encrypted entity data (Base64)
  version_vector: VersionVector;
  timestamp: number;
  device_id?: string; // Optional device ID for filtering
}

/**
 * Push response from server
 */
export interface SyncPushResponse {
  protocol_version: string;
  success: boolean;
  accepted: string[]; // IDs of accepted changes
  rejected: Array<{
    id: string;
    reason: string;
  }>;
  timestamp: number;
}

/**
 * Pull request - request remote changes
 */
export interface SyncPullRequest {
  protocol_version: string;
  device_id: string;
  since_timestamp: number; // Get changes since this timestamp
  sync_vector: VersionVector; // Current sync state
}

/**
 * Pull response from server
 */
export interface SyncPullResponse {
  protocol_version: string;
  changes: SyncChange[];
  has_more: boolean;
  timestamp: number;
}

/**
 * Acknowledgment message
 */
export interface SyncAckMessage {
  protocol_version: string;
  device_id: string;
  acknowledged_ids: string[];
  timestamp: number;
}

/**
 * Error message
 */
export interface SyncErrorMessage {
  protocol_version: string;
  error_code: string;
  error_message: string;
  timestamp: number;
}

/**
 * Sync conflict information
 */
export interface SyncConflict {
  entity_type: SyncEntityType;
  entity_id: string;
  local_version: VersionVector;
  remote_version: VersionVector;
  conflict_type: 'concurrent' | 'divergent';
}

/**
 * Create a push request
 */
export function createPushRequest(
  deviceId: string,
  changes: SyncChange[]
): SyncPushRequest {
  return {
    protocol_version: SYNC_PROTOCOL_VERSION,
    device_id: deviceId,
    timestamp: Date.now(),
    changes,
  };
}

/**
 * Create a pull request
 */
export function createPullRequest(
  deviceId: string,
  sinceTimestamp: number,
  syncVector: VersionVector
): SyncPullRequest {
  return {
    protocol_version: SYNC_PROTOCOL_VERSION,
    device_id: deviceId,
    since_timestamp: sinceTimestamp,
    sync_vector: syncVector,
  };
}

/**
 * Create an acknowledgment message
 */
export function createAckMessage(
  deviceId: string,
  acknowledgedIds: string[]
): SyncAckMessage {
  return {
    protocol_version: SYNC_PROTOCOL_VERSION,
    device_id: deviceId,
    acknowledged_ids: acknowledgedIds,
    timestamp: Date.now(),
  };
}

/**
 * Create an error message
 */
export function createErrorMessage(
  errorCode: string,
  errorMessage: string
): SyncErrorMessage {
  return {
    protocol_version: SYNC_PROTOCOL_VERSION,
    error_code: errorCode,
    error_message: errorMessage,
    timestamp: Date.now(),
  };
}

/**
 * Validate sync protocol version
 */
export function isCompatibleVersion(version: string): boolean {
  // For now, only support exact version match
  // In future, could support version ranges
  return version === SYNC_PROTOCOL_VERSION;
}

/**
 * Validate push request
 */
export function validatePushRequest(request: any): request is SyncPushRequest {
  if (!request || typeof request !== 'object') return false;
  if (!isCompatibleVersion(request.protocol_version)) return false;
  if (typeof request.device_id !== 'string') return false;
  if (typeof request.timestamp !== 'number') return false;
  if (!Array.isArray(request.changes)) return false;

  // Validate each change
  for (const change of request.changes) {
    if (!validateSyncChange(change)) return false;
  }

  return true;
}

/**
 * Validate sync change
 */
export function validateSyncChange(change: any): change is SyncChange {
  if (!change || typeof change !== 'object') return false;
  if (typeof change.id !== 'string') return false;
  if (typeof change.entity_type !== 'string') return false;
  if (typeof change.entity_id !== 'string') return false;
  if (typeof change.operation !== 'string') return false;
  if (typeof change.encrypted_payload !== 'string') return false;
  if (typeof change.version_vector !== 'object') return false;
  if (typeof change.timestamp !== 'number') return false;
  return true;
}

/**
 * Validate pull request
 */
export function validatePullRequest(request: any): request is SyncPullRequest {
  if (!request || typeof request !== 'object') return false;
  if (!isCompatibleVersion(request.protocol_version)) return false;
  if (typeof request.device_id !== 'string') return false;
  if (typeof request.since_timestamp !== 'number') return false;
  if (typeof request.sync_vector !== 'object') return false;
  return true;
}

/**
 * Validate push response
 */
export function validatePushResponse(response: any): response is SyncPushResponse {
  if (!response || typeof response !== 'object') return false;
  if (!isCompatibleVersion(response.protocol_version)) return false;
  if (typeof response.success !== 'boolean') return false;
  if (!Array.isArray(response.accepted)) return false;
  if (!Array.isArray(response.rejected)) return false;
  if (typeof response.timestamp !== 'number') return false;
  return true;
}

/**
 * Validate pull response
 */
export function validatePullResponse(response: any): response is SyncPullResponse {
  if (!response || typeof response !== 'object') return false;
  if (!isCompatibleVersion(response.protocol_version)) return false;
  if (!Array.isArray(response.changes)) return false;
  if (typeof response.has_more !== 'boolean') return false;
  if (typeof response.timestamp !== 'number') return false;

  // Validate each change
  for (const change of response.changes) {
    if (!validateSyncChange(change)) return false;
  }

  return true;
}

/**
 * Calculate payload size in bytes
 */
export function calculatePayloadSize(payload: string): number {
  // Base64 encoded string - approximate bytes
  return Math.ceil((payload.length * 3) / 4);
}

/**
 * Check if payload exceeds size limit
 */
export function isPayloadTooLarge(payload: string, maxSizeBytes: number = 1024 * 1024): boolean {
  return calculatePayloadSize(payload) > maxSizeBytes;
}

/**
 * Split large changes into batches
 */
export function batchChanges(
  changes: SyncChange[],
  maxBatchSize: number = 10,
  maxPayloadSize: number = 1024 * 1024
): SyncChange[][] {
  const batches: SyncChange[][] = [];
  let currentBatch: SyncChange[] = [];
  let currentBatchSize = 0;

  for (const change of changes) {
    const changeSize = calculatePayloadSize(change.encrypted_payload);

    // If single change is too large, skip it (should be handled separately)
    if (changeSize > maxPayloadSize) {
      console.warn(`Change ${change.id} exceeds max payload size, skipping`);
      continue;
    }

    // If adding this change would exceed limits, start new batch
    if (
      currentBatch.length >= maxBatchSize ||
      currentBatchSize + changeSize > maxPayloadSize
    ) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }
      currentBatch = [];
      currentBatchSize = 0;
    }

    currentBatch.push(change);
    currentBatchSize += changeSize;
  }

  // Add final batch
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Detect conflicts between local and remote changes
 */
export function detectConflicts(
  localChanges: SyncChange[],
  remoteChanges: SyncChange[]
): SyncConflict[] {
  const conflicts: SyncConflict[] = [];
  const remoteByEntity = new Map<string, SyncChange>();

  // Index remote changes by entity
  for (const change of remoteChanges) {
    const key = `${change.entity_type}:${change.entity_id}`;
    remoteByEntity.set(key, change);
  }

  // Check for conflicts
  for (const localChange of localChanges) {
    const key = `${localChange.entity_type}:${localChange.entity_id}`;
    const remoteChange = remoteByEntity.get(key);

    if (remoteChange) {
      // Check if version vectors indicate conflict
      const conflictType = determineConflictType(
        localChange.version_vector,
        remoteChange.version_vector
      );

      if (conflictType) {
        conflicts.push({
          entity_type: localChange.entity_type,
          entity_id: localChange.entity_id,
          local_version: localChange.version_vector,
          remote_version: remoteChange.version_vector,
          conflict_type: conflictType,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Determine conflict type from version vectors
 */
function determineConflictType(
  local: VersionVector,
  remote: VersionVector
): 'concurrent' | 'divergent' | null {
  const allDevices = new Set([...Object.keys(local), ...Object.keys(remote)]);
  let localAhead = false;
  let remoteAhead = false;

  for (const deviceId of allDevices) {
    const localClock = local[deviceId] || 0;
    const remoteClock = remote[deviceId] || 0;

    if (localClock > remoteClock) {
      localAhead = true;
    } else if (remoteClock > localClock) {
      remoteAhead = true;
    }
  }

  if (localAhead && remoteAhead) {
    return 'concurrent';
  } else if (localAhead || remoteAhead) {
    // One is ahead of the other, not a conflict
    return null;
  } else {
    // Equal, not a conflict
    return null;
  }
}
