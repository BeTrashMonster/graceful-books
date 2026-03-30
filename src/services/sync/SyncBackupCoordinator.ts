/**
 * Sync/Backup Coordination Service
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 4, Task 4.7 (Chunk 4G):
 * Coordinates sync and backup operations to prevent conflicts and ensure
 * efficient resource usage.
 *
 * Features:
 * - Priority-based operation scheduling (sync > backup)
 * - Conflict prevention between concurrent operations
 * - Resource throttling to prevent overwhelming the system
 * - Automatic queue management
 * - Operation state tracking
 *
 * Architecture:
 * - Sync operations have higher priority (real-time user experience)
 * - Backup operations are deferred when sync is active
 * - Only one backup can run at a time
 * - Sync operations can run concurrently (per connection)
 * - Resource limits prevent system overload
 *
 * Design Principles:
 * - User-facing sync takes precedence over background backup
 * - Backup operations are patient (will wait for sync to finish)
 * - System remains responsive during operations
 */

/**
 * Operation type
 */
export enum OperationType {
  SYNC = 'SYNC',
  BACKUP = 'BACKUP',
}

/**
 * Operation priority (lower number = higher priority)
 */
export enum OperationPriority {
  SYNC = 1,
  BACKUP = 2,
}

/**
 * Operation status
 */
export enum OperationStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Operation metadata
 */
export interface Operation {
  /** Unique operation ID */
  id: string
  /** Operation type */
  type: OperationType
  /** Operation priority */
  priority: OperationPriority
  /** Current status */
  status: OperationStatus
  /** When operation was queued */
  queuedAt: number
  /** When operation started */
  startedAt?: number
  /** When operation completed */
  completedAt?: number
  /** Operation progress (0-100) */
  progress: number
  /** Error if failed */
  error?: string
}

/**
 * Coordinator configuration
 */
export interface CoordinatorConfig {
  /** Maximum concurrent sync operations */
  maxConcurrentSync: number
  /** Maximum concurrent backup operations */
  maxConcurrentBackup: number
  /** Minimum time between backups (milliseconds) */
  minBackupInterval: number
  /** Whether to pause backup when sync starts */
  pauseBackupOnSync: boolean
  /** Whether to defer backup when sync is active */
  deferBackupWhenSyncActive: boolean
}

/**
 * Default coordinator configuration
 */
export const DEFAULT_COORDINATOR_CONFIG: CoordinatorConfig = {
  maxConcurrentSync: 1, // One sync connection at a time
  maxConcurrentBackup: 1, // One backup at a time
  minBackupInterval: 60000, // 1 minute between backups
  pauseBackupOnSync: true, // Pause backup if sync starts
  deferBackupWhenSyncActive: true, // Don't start backup while syncing
}

/**
 * Coordinator statistics
 */
export interface CoordinatorStats {
  /** Active sync operations */
  activeSyncCount: number
  /** Active backup operations */
  activeBackupCount: number
  /** Pending sync operations */
  pendingSyncCount: number
  /** Pending backup operations */
  pendingBackupCount: number
  /** Last backup time */
  lastBackupAt?: number
  /** Total operations completed */
  totalCompleted: number
  /** Total operations failed */
  totalFailed: number
}

/**
 * Sync/Backup Coordinator
 *
 * Manages coordination between sync and backup operations to prevent
 * conflicts and ensure efficient resource usage.
 */
export class SyncBackupCoordinator {
  private config: CoordinatorConfig
  private operations: Map<string, Operation> = new Map()
  private lastBackupAt?: number
  private nextOperationId = 1

  constructor(config: Partial<CoordinatorConfig> = {}) {
    this.config = { ...DEFAULT_COORDINATOR_CONFIG, ...config }
  }

  /**
   * Request to start a sync operation
   *
   * Sync operations have higher priority and will be scheduled immediately
   * if resources are available.
   *
   * @returns Operation ID if scheduled, null if rejected
   */
  requestSync(): string | null {
    // Check if we've hit max concurrent sync limit
    const activeSyncCount = this.getActiveOperationCount(OperationType.SYNC)
    if (activeSyncCount >= this.config.maxConcurrentSync) {
      return null // Reject - too many concurrent syncs
    }

    // Create sync operation
    const operation: Operation = {
      id: this.generateOperationId(),
      type: OperationType.SYNC,
      priority: OperationPriority.SYNC,
      status: OperationStatus.PENDING,
      queuedAt: Date.now(),
      progress: 0,
    }

    this.operations.set(operation.id, operation)

    // If configured, pause any running backups
    if (this.config.pauseBackupOnSync) {
      this.pauseBackupOperations()
    }

    return operation.id
  }

  /**
   * Request to start a backup operation
   *
   * Backup operations have lower priority and will be deferred if sync
   * operations are active.
   *
   * @returns Operation ID if scheduled, null if rejected/deferred
   */
  requestBackup(): string | null {
    // Check if we've hit max concurrent backup limit
    const activeBackupCount = this.getActiveOperationCount(OperationType.BACKUP)
    if (activeBackupCount >= this.config.maxConcurrentBackup) {
      return null // Reject - backup already running
    }

    // Check minimum backup interval
    if (this.lastBackupAt) {
      const timeSinceLastBackup = Date.now() - this.lastBackupAt
      if (timeSinceLastBackup < this.config.minBackupInterval) {
        return null // Reject - too soon since last backup
      }
    }

    // Check if sync is active and we should defer
    if (this.config.deferBackupWhenSyncActive) {
      const activeSyncCount = this.getActiveOperationCount(OperationType.SYNC)
      if (activeSyncCount > 0) {
        return null // Defer - sync is active
      }
    }

    // Create backup operation
    const operation: Operation = {
      id: this.generateOperationId(),
      type: OperationType.BACKUP,
      priority: OperationPriority.BACKUP,
      status: OperationStatus.PENDING,
      queuedAt: Date.now(),
      progress: 0,
    }

    this.operations.set(operation.id, operation)
    return operation.id
  }

  /**
   * Start an operation
   *
   * Transitions operation from PENDING to RUNNING.
   *
   * @param operationId - Operation ID
   * @returns True if started, false if operation not found or already started
   */
  startOperation(operationId: string): boolean {
    const operation = this.operations.get(operationId)
    if (!operation) {
      return false
    }

    if (operation.status !== OperationStatus.PENDING) {
      return false
    }

    operation.status = OperationStatus.RUNNING
    operation.startedAt = Date.now()
    return true
  }

  /**
   * Update operation progress
   *
   * @param operationId - Operation ID
   * @param progress - Progress (0-100)
   */
  updateProgress(operationId: string, progress: number): void {
    const operation = this.operations.get(operationId)
    if (!operation) {
      return
    }

    operation.progress = Math.max(0, Math.min(100, progress))
  }

  /**
   * Complete an operation
   *
   * Marks operation as completed and performs cleanup.
   *
   * @param operationId - Operation ID
   */
  completeOperation(operationId: string): void {
    const operation = this.operations.get(operationId)
    if (!operation) {
      return
    }

    operation.status = OperationStatus.COMPLETED
    operation.completedAt = Date.now()
    operation.progress = 100

    // Track last backup time
    if (operation.type === OperationType.BACKUP) {
      this.lastBackupAt = Date.now()
    }

    // If this was a sync operation, resume any paused backups
    if (operation.type === OperationType.SYNC && this.config.pauseBackupOnSync) {
      const activeSyncCount = this.getActiveOperationCount(OperationType.SYNC)
      if (activeSyncCount === 0) {
        this.resumeBackupOperations()
      }
    }
  }

  /**
   * Fail an operation
   *
   * Marks operation as failed with error message.
   *
   * @param operationId - Operation ID
   * @param error - Error message
   */
  failOperation(operationId: string, error: string): void {
    const operation = this.operations.get(operationId)
    if (!operation) {
      return
    }

    operation.status = OperationStatus.FAILED
    operation.completedAt = Date.now()
    operation.error = error
  }

  /**
   * Cancel an operation
   *
   * Marks operation as cancelled.
   *
   * @param operationId - Operation ID
   */
  cancelOperation(operationId: string): void {
    const operation = this.operations.get(operationId)
    if (!operation) {
      return
    }

    operation.status = OperationStatus.CANCELLED
    operation.completedAt = Date.now()
  }

  /**
   * Get operation by ID
   *
   * @param operationId - Operation ID
   * @returns Operation or undefined if not found
   */
  getOperation(operationId: string): Operation | undefined {
    return this.operations.get(operationId)
  }

  /**
   * Get all operations of a specific type
   *
   * @param type - Operation type
   * @returns Array of operations
   */
  getOperationsByType(type: OperationType): Operation[] {
    const operations: Operation[] = []
    for (const operation of this.operations.values()) {
      if (operation.type === type) {
        operations.push(operation)
      }
    }
    return operations
  }

  /**
   * Get count of active operations by type
   *
   * @param type - Operation type
   * @returns Count of active operations
   */
  private getActiveOperationCount(type: OperationType): number {
    let count = 0
    for (const operation of this.operations.values()) {
      if (operation.type === type && operation.status === OperationStatus.RUNNING) {
        count++
      }
    }
    return count
  }

  /**
   * Pause all running backup operations
   *
   * @private
   */
  private pauseBackupOperations(): void {
    for (const operation of this.operations.values()) {
      if (
        operation.type === OperationType.BACKUP &&
        operation.status === OperationStatus.RUNNING
      ) {
        operation.status = OperationStatus.PAUSED
      }
    }
  }

  /**
   * Resume all paused backup operations
   *
   * @private
   */
  private resumeBackupOperations(): void {
    for (const operation of this.operations.values()) {
      if (
        operation.type === OperationType.BACKUP &&
        operation.status === OperationStatus.PAUSED
      ) {
        operation.status = OperationStatus.RUNNING
      }
    }
  }

  /**
   * Get coordinator statistics
   *
   * @returns Coordinator statistics
   */
  getStatistics(): CoordinatorStats {
    let activeSyncCount = 0
    let activeBackupCount = 0
    let pendingSyncCount = 0
    let pendingBackupCount = 0
    let totalCompleted = 0
    let totalFailed = 0

    for (const operation of this.operations.values()) {
      if (operation.status === OperationStatus.RUNNING) {
        if (operation.type === OperationType.SYNC) {
          activeSyncCount++
        } else {
          activeBackupCount++
        }
      }

      if (operation.status === OperationStatus.PENDING) {
        if (operation.type === OperationType.SYNC) {
          pendingSyncCount++
        } else {
          pendingBackupCount++
        }
      }

      if (operation.status === OperationStatus.COMPLETED) {
        totalCompleted++
      }

      if (operation.status === OperationStatus.FAILED) {
        totalFailed++
      }
    }

    return {
      activeSyncCount,
      activeBackupCount,
      pendingSyncCount,
      pendingBackupCount,
      lastBackupAt: this.lastBackupAt,
      totalCompleted,
      totalFailed,
    }
  }

  /**
   * Check if backup can start now
   *
   * Evaluates all constraints to determine if a backup operation
   * can be started immediately.
   *
   * @returns True if backup can start, false otherwise
   */
  canStartBackup(): boolean {
    // Check concurrent backup limit
    const activeBackupCount = this.getActiveOperationCount(OperationType.BACKUP)
    if (activeBackupCount >= this.config.maxConcurrentBackup) {
      return false
    }

    // Check minimum backup interval
    if (this.lastBackupAt) {
      const timeSinceLastBackup = Date.now() - this.lastBackupAt
      if (timeSinceLastBackup < this.config.minBackupInterval) {
        return false
      }
    }

    // Check if sync is active and we should defer
    if (this.config.deferBackupWhenSyncActive) {
      const activeSyncCount = this.getActiveOperationCount(OperationType.SYNC)
      if (activeSyncCount > 0) {
        return false
      }
    }

    return true
  }

  /**
   * Check if sync can start now
   *
   * @returns True if sync can start, false otherwise
   */
  canStartSync(): boolean {
    const activeSyncCount = this.getActiveOperationCount(OperationType.SYNC)
    return activeSyncCount < this.config.maxConcurrentSync
  }

  /**
   * Clean up completed operations
   *
   * Removes operations that have been completed/failed/cancelled.
   *
   * @param olderThanMs - Remove operations older than this (optional)
   */
  cleanup(olderThanMs?: number): void {
    const now = Date.now()
    const idsToRemove: string[] = []

    for (const [id, operation] of this.operations.entries()) {
      const isTerminal =
        operation.status === OperationStatus.COMPLETED ||
        operation.status === OperationStatus.FAILED ||
        operation.status === OperationStatus.CANCELLED

      if (isTerminal) {
        if (olderThanMs && operation.completedAt) {
          if (now - operation.completedAt > olderThanMs) {
            idsToRemove.push(id)
          }
        } else if (!olderThanMs) {
          idsToRemove.push(id)
        }
      }
    }

    for (const id of idsToRemove) {
      this.operations.delete(id)
    }
  }

  /**
   * Generate unique operation ID
   *
   * @private
   */
  private generateOperationId(): string {
    return `op-${this.nextOperationId++}`
  }
}

/**
 * Create coordinator instance
 *
 * @param config - Configuration (optional)
 * @returns Coordinator instance
 */
export function createSyncBackupCoordinator(
  config?: Partial<CoordinatorConfig>
): SyncBackupCoordinator {
  return new SyncBackupCoordinator(config)
}
