/**
 * Sync Security Service
 *
 * Provides security validation for CRDT sync operations:
 * - Permission validation for operations
 * - Anomaly detection for suspicious patterns
 * - Contagion prevention (quarantine for new devices, bulk operations)
 * - Revoked user rejection
 *
 * @security Phase 2.4 - Sync Relay Validation
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

import { checkPermission, type Resource, type Action } from '../../utils/rbac';
import type { UserRole } from '../../types/database.types';

/**
 * Sync operation types
 */
export enum SyncOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  BULK_UPDATE = 'bulk_update',
  BULK_DELETE = 'bulk_delete',
}

/**
 * Sync operation context
 */
export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  resource: Resource;
  resourceId: string;
  author: string;
  authorRole: UserRole;
  deviceId: string;
  timestamp: string;
  payload?: unknown;
  affectedCount?: number;
}

/**
 * Device trust status
 */
export interface DeviceTrust {
  deviceId: string;
  userId: string;
  firstSeen: string;
  lastSeen: string;
  operationCount: number;
  trustLevel: 'new' | 'provisional' | 'trusted';
  quarantined: boolean;
  quarantineReason?: string;
}

/**
 * Anomaly detection result
 */
export interface AnomalyResult {
  isAnomalous: boolean;
  score: number;
  reasons: string[];
  requiresReview: boolean;
  blocked: boolean;
}

/**
 * Validation result for sync operations
 */
export interface SyncValidationResult {
  allowed: boolean;
  reason?: string;
  requiresApproval: boolean;
  anomaly?: AnomalyResult;
  quarantined: boolean;
}

/**
 * Configuration for sync security
 */
export interface SyncSecurityConfig {
  newDeviceQuarantinePeriod: number; // hours
  bulkOperationThreshold: number; // operations that count as "bulk"
  anomalyScoreThreshold: number; // 0-1, operations above this require review
  maxOperationsPerMinute: number;
  maxOperationsPerHour: number;
  requireApprovalForBulk: boolean;
}

const DEFAULT_CONFIG: SyncSecurityConfig = {
  newDeviceQuarantinePeriod: 24, // 24 hours
  bulkOperationThreshold: 10, // 10+ is bulk
  anomalyScoreThreshold: 0.7,
  maxOperationsPerMinute: 60,
  maxOperationsPerHour: 1000,
  requireApprovalForBulk: true,
};

/**
 * In-memory store for device trust (in production, use persistent storage)
 */
const deviceTrustStore = new Map<string, DeviceTrust>();

/**
 * In-memory store for operation history (in production, use persistent storage)
 */
const operationHistory = new Map<string, SyncOperation[]>();

/**
 * Revoked users set (in production, sync with auth service)
 */
const revokedUsers = new Set<string>();

/**
 * Pending approvals for bulk operations
 */
const pendingApprovals = new Map<string, SyncOperation[]>();

/**
 * Register a device for trust tracking
 */
export function registerDevice(
  deviceId: string,
  userId: string
): DeviceTrust {
  const existing = deviceTrustStore.get(deviceId);
  if (existing) {
    existing.lastSeen = new Date().toISOString();
    existing.operationCount++;
    return existing;
  }

  const trust: DeviceTrust = {
    deviceId,
    userId,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    operationCount: 0,
    trustLevel: 'new',
    quarantined: true, // New devices start quarantined
    quarantineReason: 'New device - awaiting verification',
  };

  deviceTrustStore.set(deviceId, trust);
  return trust;
}

/**
 * Update device trust level based on behavior
 */
export function updateDeviceTrust(deviceId: string): void {
  const trust = deviceTrustStore.get(deviceId);
  if (!trust) return;

  const hoursSinceFirstSeen =
    (Date.now() - new Date(trust.firstSeen).getTime()) / (1000 * 60 * 60);

  // Progress through trust levels
  if (trust.trustLevel === 'new' && hoursSinceFirstSeen >= 24 && trust.operationCount >= 10) {
    trust.trustLevel = 'provisional';
    trust.quarantined = false;
    trust.quarantineReason = undefined;
  } else if (trust.trustLevel === 'provisional' && hoursSinceFirstSeen >= 168 && trust.operationCount >= 100) {
    // 1 week + 100 operations = trusted
    trust.trustLevel = 'trusted';
  }
}

/**
 * Check if a device is quarantined
 */
export function isDeviceQuarantined(deviceId: string): boolean {
  const trust = deviceTrustStore.get(deviceId);
  return trust?.quarantined ?? true; // Unknown devices are quarantined
}

/**
 * Quarantine a device manually
 */
export function quarantineDevice(deviceId: string, reason: string): void {
  const trust = deviceTrustStore.get(deviceId);
  if (trust) {
    trust.quarantined = true;
    trust.quarantineReason = reason;
  }
}

/**
 * Release a device from quarantine
 */
export function releaseFromQuarantine(deviceId: string): void {
  const trust = deviceTrustStore.get(deviceId);
  if (trust) {
    trust.quarantined = false;
    trust.quarantineReason = undefined;
  }
}

/**
 * Revoke a user (blocks all their sync operations)
 */
export function revokeUser(userId: string): void {
  revokedUsers.add(userId);
}

/**
 * Reinstate a revoked user
 */
export function reinstateUser(userId: string): void {
  revokedUsers.delete(userId);
}

/**
 * Check if a user is revoked
 */
export function isUserRevoked(userId: string): boolean {
  return revokedUsers.has(userId);
}

/**
 * Record an operation for anomaly detection
 */
function recordOperation(operation: SyncOperation): void {
  const key = `${operation.author}:${operation.deviceId}`;
  const ops = operationHistory.get(key) || [];

  // Keep last 1000 operations
  ops.push(operation);
  if (ops.length > 1000) {
    ops.shift();
  }

  operationHistory.set(key, ops);
}

/**
 * Get operation velocity (operations per minute)
 */
function getOperationVelocity(
  userId: string,
  deviceId: string,
  windowMinutes: number = 1
): number {
  const key = `${userId}:${deviceId}`;
  const ops = operationHistory.get(key) || [];

  const cutoff = Date.now() - windowMinutes * 60 * 1000;
  const recentOps = ops.filter((op) => new Date(op.timestamp).getTime() > cutoff);

  return recentOps.length / windowMinutes;
}

/**
 * Detect anomalies in sync operations
 */
export function detectAnomalies(
  operation: SyncOperation,
  config: SyncSecurityConfig = DEFAULT_CONFIG
): AnomalyResult {
  const reasons: string[] = [];
  let score = 0;

  // Check velocity
  const opsPerMinute = getOperationVelocity(operation.author, operation.deviceId, 1);
  const opsPerHour = getOperationVelocity(operation.author, operation.deviceId, 60);

  if (opsPerMinute > config.maxOperationsPerMinute) {
    reasons.push(`High velocity: ${opsPerMinute.toFixed(1)} ops/min (limit: ${config.maxOperationsPerMinute})`);
    score += 0.3;
  }

  if (opsPerHour > config.maxOperationsPerHour) {
    reasons.push(`High hourly rate: ${opsPerHour.toFixed(1)} ops/hour (limit: ${config.maxOperationsPerHour})`);
    score += 0.3;
  }

  // Check for bulk operations
  if (operation.affectedCount && operation.affectedCount >= config.bulkOperationThreshold) {
    reasons.push(`Bulk operation: ${operation.affectedCount} records affected`);
    score += 0.4;
  }

  // Check for destructive operations from new devices
  const trust = deviceTrustStore.get(operation.deviceId);
  if (trust?.trustLevel === 'new' && operation.type === SyncOperationType.DELETE) {
    reasons.push('Delete operation from new device');
    score += 0.5;
  }

  // Check for unusual time patterns (e.g., operations during off hours)
  const hour = new Date(operation.timestamp).getHours();
  if (hour >= 2 && hour <= 5) {
    reasons.push('Operation during unusual hours (2-5 AM)');
    score += 0.1;
  }

  // Cap score at 1.0
  score = Math.min(1.0, score);

  return {
    isAnomalous: score > 0,
    score,
    reasons,
    requiresReview: score >= config.anomalyScoreThreshold,
    blocked: score >= 0.9, // Only auto-block at very high scores
  };
}

/**
 * Validate a sync operation
 * Main entry point for sync security validation
 */
export function validateSyncOperation(
  operation: SyncOperation,
  config: SyncSecurityConfig = DEFAULT_CONFIG
): SyncValidationResult {
  // Check if user is revoked
  if (isUserRevoked(operation.author)) {
    return {
      allowed: false,
      reason: 'User access has been revoked',
      requiresApproval: false,
      quarantined: false,
    };
  }

  // Register/update device trust
  const trust = registerDevice(operation.deviceId, operation.author);
  updateDeviceTrust(operation.deviceId);

  // Check device quarantine
  if (trust.quarantined && operation.type !== SyncOperationType.CREATE) {
    // Allow creates from quarantined devices but flag for review
    return {
      allowed: false,
      reason: trust.quarantineReason || 'Device is quarantined',
      requiresApproval: true,
      quarantined: true,
    };
  }

  // Check RBAC permissions
  const action = mapOperationTypeToAction(operation.type);
  const allowed = checkPermission(
    { role: operation.authorRole },
    action,
    operation.resource
  );

  if (!allowed) {
    return {
      allowed: false,
      reason: `Role '${operation.authorRole}' lacks permission '${operation.resource}:${action}'`,
      requiresApproval: false,
      quarantined: trust.quarantined,
    };
  }

  // Check for anomalies
  const anomaly = detectAnomalies(operation, config);

  if (anomaly.blocked) {
    quarantineDevice(operation.deviceId, 'Blocked due to anomalous behavior');
    return {
      allowed: false,
      reason: 'Operation blocked due to suspicious activity',
      requiresApproval: false,
      anomaly,
      quarantined: true,
    };
  }

  // Check if bulk operation requires approval
  const isBulk =
    operation.affectedCount !== undefined &&
    operation.affectedCount >= config.bulkOperationThreshold;

  if (isBulk && config.requireApprovalForBulk) {
    // Add to pending approvals
    const pending = pendingApprovals.get(operation.author) || [];
    pending.push(operation);
    pendingApprovals.set(operation.author, pending);

    return {
      allowed: false,
      reason: `Bulk operation (${operation.affectedCount} records) requires admin approval`,
      requiresApproval: true,
      anomaly,
      quarantined: trust.quarantined,
    };
  }

  // Record successful operation
  recordOperation(operation);

  return {
    allowed: true,
    requiresApproval: anomaly.requiresReview,
    anomaly,
    quarantined: false,
  };
}

/**
 * Map sync operation type to RBAC action
 */
function mapOperationTypeToAction(type: SyncOperationType): Action {
  switch (type) {
    case SyncOperationType.CREATE:
      return 'create';
    case SyncOperationType.UPDATE:
    case SyncOperationType.BULK_UPDATE:
      return 'update';
    case SyncOperationType.DELETE:
    case SyncOperationType.BULK_DELETE:
      return 'delete';
    default:
      return 'read';
  }
}

/**
 * Approve a pending bulk operation
 */
export function approvePendingOperation(
  operationId: string,
  approver: string
): boolean {
  for (const [userId, ops] of pendingApprovals.entries()) {
    const index = ops.findIndex((op) => op.id === operationId);
    if (index !== -1) {
      const op = ops[index];
      ops.splice(index, 1);
      if (ops.length === 0) {
        pendingApprovals.delete(userId);
      }

      // Record the approved operation
      recordOperation(op);
      console.log(`Operation ${operationId} approved by ${approver}`);
      return true;
    }
  }
  return false;
}

/**
 * Reject a pending bulk operation
 */
export function rejectPendingOperation(
  operationId: string,
  rejector: string,
  reason: string
): boolean {
  for (const [userId, ops] of pendingApprovals.entries()) {
    const index = ops.findIndex((op) => op.id === operationId);
    if (index !== -1) {
      ops.splice(index, 1);
      if (ops.length === 0) {
        pendingApprovals.delete(userId);
      }
      console.log(`Operation ${operationId} rejected by ${rejector}: ${reason}`);
      return true;
    }
  }
  return false;
}

/**
 * Get pending approvals for a user or all users
 */
export function getPendingApprovals(userId?: string): SyncOperation[] {
  if (userId) {
    return pendingApprovals.get(userId) || [];
  }

  const allPending: SyncOperation[] = [];
  for (const ops of pendingApprovals.values()) {
    allPending.push(...ops);
  }
  return allPending;
}

/**
 * Get device trust info
 */
export function getDeviceTrust(deviceId: string): DeviceTrust | undefined {
  return deviceTrustStore.get(deviceId);
}

/**
 * Clear all stores (for testing)
 */
export function clearStores(): void {
  deviceTrustStore.clear();
  operationHistory.clear();
  revokedUsers.clear();
  pendingApprovals.clear();
}

export default {
  validateSyncOperation,
  registerDevice,
  quarantineDevice,
  releaseFromQuarantine,
  revokeUser,
  reinstateUser,
  isUserRevoked,
  isDeviceQuarantined,
  detectAnomalies,
  approvePendingOperation,
  rejectPendingOperation,
  getPendingApprovals,
  getDeviceTrust,
  clearStores,
  SyncOperationType,
};
