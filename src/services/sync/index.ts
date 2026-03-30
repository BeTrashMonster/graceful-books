/**
 * Sync Services
 *
 * Barrel export for real-time sync services
 */

// WebSocket Client
export { SyncClient, createSyncClient } from './SyncClient'
export type { SyncEvent, SyncEventListener } from './SyncClient'

// Message Signing
export { SyncSignature, createSyncSignature } from './SyncSignature'
export type { SignatureResult, VerificationResult } from './SyncSignature'

// Message Queue
export { SyncQueue, createSyncQueue } from './SyncQueue'
export type { QueuedMessage, QueueStatistics } from './SyncQueue'

// CRDT Conflict Resolution
export { SyncCRDT, createSyncCRDT, ConflictStatus } from './SyncCRDT'
export type {
  VersionVector,
  ChangeMetadata,
  VersionedRecord,
  ConflictResolution,
  MergeStrategy,
} from './SyncCRDT'
