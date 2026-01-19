/**
 * CRDT Conflict Resolution Type Definitions
 *
 * Type definitions for production-ready CRDT conflict resolution system.
 * Supports entity-specific merge strategies, conflict tracking, and manual resolution.
 *
 * Requirements:
 * - ARCH-004: CRDT conflict resolution
 * - Group I, Item I1: CRDT Conflict Resolution [MVP for multi-user]
 */

import type { BaseEntity, VersionVector } from './database.types';

// ============================================================================
// Core CRDT Types
// ============================================================================

/**
 * Entity with CRDT support
 */
export interface CRDTEntity extends BaseEntity {
  version_vector: VersionVector;
  lastModifiedBy?: string; // Device or user ID that last modified
  lastModifiedAt?: number; // Timestamp of last modification
}

/**
 * Conflict type classification
 */
export enum ConflictType {
  CONCURRENT_UPDATE = 'concurrent_update', // Both sides updated same entity
  DELETE_UPDATE = 'delete_update', // One side deleted, other updated
  FIELD_CONFLICT = 'field_conflict', // Specific field(s) have conflicting values
  STRUCTURAL_CONFLICT = 'structural_conflict', // Entity structure incompatible
}

/**
 * Conflict severity level
 */
export enum ConflictSeverity {
  LOW = 'low', // Automatically resolvable, low impact
  MEDIUM = 'medium', // Automatically resolvable, moderate impact
  HIGH = 'high', // Requires review, significant impact
  CRITICAL = 'critical', // Requires manual resolution, data integrity risk
}

/**
 * Resolution strategy
 */
export enum ResolutionStrategy {
  AUTO_LWW = 'auto_lww', // Automatic Last-Write-Wins
  AUTO_MERGE = 'auto_merge', // Automatic field-level merge
  MANUAL = 'manual', // Requires manual resolution
  LOCAL_WINS = 'local_wins', // Always prefer local
  REMOTE_WINS = 'remote_wins', // Always prefer remote
}

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Detected conflict between two entity versions
 */
export interface DetectedConflict<T extends CRDTEntity = CRDTEntity> {
  id: string; // Conflict ID for tracking
  entityType: string; // Type of entity in conflict
  entityId: string; // ID of conflicting entity
  conflictType: ConflictType;
  severity: ConflictSeverity;
  localVersion: T;
  remoteVersion: T;
  conflictingFields: string[]; // List of fields with conflicts
  detectedAt: number; // Timestamp when conflict was detected
  deviceId: string; // Device that detected the conflict
}

/**
 * Field-level conflict information
 */
export interface FieldConflict {
  fieldName: string;
  localValue: unknown;
  remoteValue: unknown;
  canAutoResolve: boolean;
  suggestedResolution?: unknown;
}

// ============================================================================
// Conflict Resolution
// ============================================================================

/**
 * Conflict resolution result
 */
export interface ConflictResolution<T extends CRDTEntity = CRDTEntity> {
  conflictId: string;
  resolvedEntity: T;
  strategy: ResolutionStrategy;
  winner: 'local' | 'remote' | 'merged' | 'manual';
  mergedFields: string[]; // Fields that were merged
  resolvedAt: number;
  resolvedBy?: string; // User ID if manually resolved
  resolutionNotes?: string; // Optional notes about resolution
}

/**
 * Batch conflict resolution result
 */
export interface BatchResolutionResult<T extends CRDTEntity = CRDTEntity> {
  totalConflicts: number;
  resolved: ConflictResolution<T>[];
  unresolved: DetectedConflict<T>[];
  stats: {
    autoResolved: number;
    manuallyResolved: number;
    localWins: number;
    remoteWins: number;
    merged: number;
  };
}

// ============================================================================
// Conflict History & Tracking
// ============================================================================

/**
 * Conflict history entry for audit trail
 */
export interface ConflictHistoryEntry {
  id: string;
  conflictId: string;
  entityType: string;
  entityId: string;
  conflictType: ConflictType;
  severity: ConflictSeverity;
  detectedAt: number;
  resolvedAt: number | null;
  resolution: ConflictResolution | null;
  localSnapshot: string; // JSON snapshot of local version
  remoteSnapshot: string; // JSON snapshot of remote version
  resolvedSnapshot: string | null; // JSON snapshot of resolved version
  userViewed: boolean; // Whether user has viewed this conflict
  userDismissed: boolean; // Whether user dismissed notification
}

/**
 * Conflict notification for UI display
 */
export interface ConflictNotification {
  id: string;
  conflictId: string;
  entityType: string;
  entityId: string;
  entityDescription: string; // Human-readable description (e.g., "Invoice #1234")
  severity: ConflictSeverity;
  message: string; // User-friendly message (Steadiness tone)
  detectedAt: number;
  read: boolean;
  dismissed: boolean;
  requiresAction: boolean; // Whether manual resolution needed
}

// ============================================================================
// Manual Resolution
// ============================================================================

/**
 * Manual resolution decision
 */
export interface ManualResolutionDecision {
  conflictId: string;
  resolvedBy: string; // User ID
  strategy: 'keep_local' | 'keep_remote' | 'custom_merge';
  customMerge?: Record<string, unknown>; // Field-level merge decisions
  notes?: string; // User notes about decision
}

/**
 * Manual resolution context for UI
 */
export interface ManualResolutionContext<T extends CRDTEntity = CRDTEntity> {
  conflict: DetectedConflict<T>;
  fieldConflicts: FieldConflict[];
  suggestions: ResolutionSuggestion[];
  history: ConflictHistoryEntry[]; // Previous conflicts for this entity
}

/**
 * Resolution suggestion for manual conflicts
 */
export interface ResolutionSuggestion {
  fieldName: string;
  suggestedValue: unknown;
  reasoning: string; // Plain English explanation
  confidence: number; // 0-1, how confident we are in suggestion
}

// ============================================================================
// Entity-Specific Merge Strategies
// ============================================================================

/**
 * Merge strategy configuration for entity type
 */
export interface EntityMergeStrategy {
  entityType: string;
  defaultStrategy: ResolutionStrategy;
  fieldStrategies: Record<string, FieldMergeStrategy>;
  customMerger?: <T extends CRDTEntity>(local: T, remote: T) => T;
}

/**
 * Field-level merge strategy
 */
export interface FieldMergeStrategy {
  strategy: 'lww' | 'max' | 'min' | 'concat' | 'union' | 'custom';
  resolver?: (localValue: unknown, remoteValue: unknown) => unknown;
  priority?: number; // Higher priority wins in ties
}

// ============================================================================
// Performance & Metrics
// ============================================================================

/**
 * Conflict resolution performance metrics
 */
export interface ConflictMetrics {
  totalConflictsDetected: number;
  totalConflictsResolved: number;
  averageResolutionTimeMs: number;
  conflictsByType: Record<ConflictType, number>;
  conflictsBySeverity: Record<ConflictSeverity, number>;
  autoResolveSuccessRate: number;
  manualResolutionRate: number;
  dataLossIncidents: number; // Should always be 0
}

/**
 * Sync operation with conflict information
 */
export interface SyncOperation {
  id: string;
  startedAt: number;
  completedAt: number | null;
  deviceId: string;
  entitiesSynced: number;
  conflictsDetected: number;
  conflictsResolved: number;
  status: 'in_progress' | 'completed' | 'failed';
  error?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * CRDT system configuration
 */
export interface CRDTConfig {
  enableAutoResolution: boolean;
  autoResolutionStrategy: ResolutionStrategy;
  conflictHistoryRetentionDays: number;
  maxConflictBatchSize: number;
  notifyOnConflict: boolean;
  notifyOnAutoResolve: boolean;
  performanceMode: 'accuracy' | 'speed'; // Trade-off preference
}

/**
 * Default CRDT configuration
 */
export const DEFAULT_CRDT_CONFIG: CRDTConfig = {
  enableAutoResolution: true,
  autoResolutionStrategy: ResolutionStrategy.AUTO_MERGE,
  conflictHistoryRetentionDays: 90,
  maxConflictBatchSize: 100,
  notifyOnConflict: true,
  notifyOnAutoResolve: false, // Don't spam for auto-resolved conflicts
  performanceMode: 'accuracy',
};
