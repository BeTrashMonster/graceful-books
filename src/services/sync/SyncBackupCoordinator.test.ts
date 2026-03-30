/**
 * Sync/Backup Coordinator Tests
 *
 * Comprehensive tests for operation coordination and priority management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  SyncBackupCoordinator,
  createSyncBackupCoordinator,
  OperationType,
  OperationStatus,
  DEFAULT_COORDINATOR_CONFIG,
  type CoordinatorConfig,
} from './SyncBackupCoordinator'

describe('SyncBackupCoordinator', () => {
  let coordinator: SyncBackupCoordinator

  beforeEach(() => {
    coordinator = new SyncBackupCoordinator()
  })

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const stats = coordinator.getStatistics()

      expect(stats.activeSyncCount).toBe(0)
      expect(stats.activeBackupCount).toBe(0)
      expect(stats.pendingSyncCount).toBe(0)
      expect(stats.pendingBackupCount).toBe(0)
      expect(stats.totalCompleted).toBe(0)
      expect(stats.totalFailed).toBe(0)
    })

    it('should initialize with custom config', () => {
      const customConfig: Partial<CoordinatorConfig> = {
        maxConcurrentSync: 5,
        maxConcurrentBackup: 2,
      }

      const customCoordinator = new SyncBackupCoordinator(customConfig)
      expect(customCoordinator).toBeDefined()
    })
  })

  describe('requestSync', () => {
    it('should create sync operation', () => {
      const opId = coordinator.requestSync()

      expect(opId).toBeDefined()
      expect(opId).toMatch(/^op-/)

      const operation = coordinator.getOperation(opId!)
      expect(operation).toBeDefined()
      expect(operation!.type).toBe(OperationType.SYNC)
      expect(operation!.status).toBe(OperationStatus.PENDING)
    })

    it('should reject when max concurrent sync reached', () => {
      // Start first sync
      const op1 = coordinator.requestSync()
      expect(op1).toBeDefined()
      coordinator.startOperation(op1!)

      // Try to start second sync (should be rejected since max is 1)
      const op2 = coordinator.requestSync()
      expect(op2).toBeNull()
    })

    it('should allow sync after previous completes', () => {
      // Start and complete first sync
      const op1 = coordinator.requestSync()!
      coordinator.startOperation(op1)
      coordinator.completeOperation(op1)

      // Second sync should be allowed
      const op2 = coordinator.requestSync()
      expect(op2).toBeDefined()
    })

    it('should pause running backup when sync starts', () => {
      // Start backup
      const backupOp = coordinator.requestBackup()!
      coordinator.startOperation(backupOp)

      const backupBefore = coordinator.getOperation(backupOp)
      expect(backupBefore!.status).toBe(OperationStatus.RUNNING)

      // Request sync (should pause backup)
      const syncOp = coordinator.requestSync()!

      const backupAfter = coordinator.getOperation(backupOp)
      expect(backupAfter!.status).toBe(OperationStatus.PAUSED)
    })

    it('should not pause backup when pauseBackupOnSync is false', () => {
      coordinator = new SyncBackupCoordinator({ pauseBackupOnSync: false })

      // Start backup
      const backupOp = coordinator.requestBackup()!
      coordinator.startOperation(backupOp)

      // Request sync
      coordinator.requestSync()

      const backup = coordinator.getOperation(backupOp)
      expect(backup!.status).toBe(OperationStatus.RUNNING) // Still running
    })
  })

  describe('requestBackup', () => {
    it('should create backup operation', () => {
      const opId = coordinator.requestBackup()

      expect(opId).toBeDefined()

      const operation = coordinator.getOperation(opId!)
      expect(operation).toBeDefined()
      expect(operation!.type).toBe(OperationType.BACKUP)
      expect(operation!.status).toBe(OperationStatus.PENDING)
    })

    it('should reject when backup is already running', () => {
      // Start first backup
      const op1 = coordinator.requestBackup()!
      coordinator.startOperation(op1)

      // Try to start second backup (should be rejected)
      const op2 = coordinator.requestBackup()
      expect(op2).toBeNull()
    })

    it('should defer when sync is active', () => {
      // Start sync
      const syncOp = coordinator.requestSync()!
      coordinator.startOperation(syncOp)

      // Try to start backup (should be deferred)
      const backupOp = coordinator.requestBackup()
      expect(backupOp).toBeNull()
    })

    it('should allow backup when sync is not active', () => {
      coordinator = new SyncBackupCoordinator({ deferBackupWhenSyncActive: false })

      // Start sync
      const syncOp = coordinator.requestSync()!
      coordinator.startOperation(syncOp)

      // Backup should still be allowed
      const backupOp = coordinator.requestBackup()
      expect(backupOp).toBeDefined()
    })

    it('should enforce minimum backup interval', () => {
      // Complete first backup
      const op1 = coordinator.requestBackup()!
      coordinator.startOperation(op1)
      coordinator.completeOperation(op1)

      // Immediately try second backup (should be rejected)
      const op2 = coordinator.requestBackup()
      expect(op2).toBeNull()
    })

    it('should allow backup after interval passes', async () => {
      coordinator = new SyncBackupCoordinator({ minBackupInterval: 100 })

      // Complete first backup
      const op1 = coordinator.requestBackup()!
      coordinator.startOperation(op1)
      coordinator.completeOperation(op1)

      // Wait for interval
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Second backup should be allowed
      const op2 = coordinator.requestBackup()
      expect(op2).toBeDefined()
    })
  })

  describe('operation lifecycle', () => {
    it('should transition from PENDING to RUNNING', () => {
      const opId = coordinator.requestSync()!

      const before = coordinator.getOperation(opId)
      expect(before!.status).toBe(OperationStatus.PENDING)

      const started = coordinator.startOperation(opId)
      expect(started).toBe(true)

      const after = coordinator.getOperation(opId)
      expect(after!.status).toBe(OperationStatus.RUNNING)
      expect(after!.startedAt).toBeDefined()
    })

    it('should not start already running operation', () => {
      const opId = coordinator.requestSync()!
      coordinator.startOperation(opId)

      const result = coordinator.startOperation(opId)
      expect(result).toBe(false)
    })

    it('should return false for non-existent operation', () => {
      const result = coordinator.startOperation('non-existent')
      expect(result).toBe(false)
    })

    it('should complete operation', () => {
      const opId = coordinator.requestSync()!
      coordinator.startOperation(opId)
      coordinator.completeOperation(opId)

      const operation = coordinator.getOperation(opId)
      expect(operation!.status).toBe(OperationStatus.COMPLETED)
      expect(operation!.completedAt).toBeDefined()
      expect(operation!.progress).toBe(100)
    })

    it('should fail operation with error', () => {
      const opId = coordinator.requestSync()!
      coordinator.startOperation(opId)
      coordinator.failOperation(opId, 'Test error')

      const operation = coordinator.getOperation(opId)
      expect(operation!.status).toBe(OperationStatus.FAILED)
      expect(operation!.error).toBe('Test error')
      expect(operation!.completedAt).toBeDefined()
    })

    it('should cancel operation', () => {
      const opId = coordinator.requestSync()!
      coordinator.cancelOperation(opId)

      const operation = coordinator.getOperation(opId)
      expect(operation!.status).toBe(OperationStatus.CANCELLED)
      expect(operation!.completedAt).toBeDefined()
    })
  })

  describe('progress tracking', () => {
    it('should update operation progress', () => {
      const opId = coordinator.requestSync()!
      coordinator.startOperation(opId)

      coordinator.updateProgress(opId, 50)

      const operation = coordinator.getOperation(opId)
      expect(operation!.progress).toBe(50)
    })

    it('should clamp progress to 0-100', () => {
      const opId = coordinator.requestSync()!

      coordinator.updateProgress(opId, -10)
      expect(coordinator.getOperation(opId)!.progress).toBe(0)

      coordinator.updateProgress(opId, 150)
      expect(coordinator.getOperation(opId)!.progress).toBe(100)
    })

    it('should ignore progress update for non-existent operation', () => {
      coordinator.updateProgress('non-existent', 50)
      // Should not throw
    })
  })

  describe('pausing and resuming', () => {
    it('should resume backup when sync completes', () => {
      // Start backup
      const backupOp = coordinator.requestBackup()!
      coordinator.startOperation(backupOp)

      // Start sync (pauses backup)
      const syncOp = coordinator.requestSync()!
      coordinator.startOperation(syncOp)

      expect(coordinator.getOperation(backupOp)!.status).toBe(OperationStatus.PAUSED)

      // Complete sync (resumes backup)
      coordinator.completeOperation(syncOp)

      expect(coordinator.getOperation(backupOp)!.status).toBe(OperationStatus.RUNNING)
    })

    it('should not resume if another sync is still active', () => {
      coordinator = new SyncBackupCoordinator({ maxConcurrentSync: 2 })

      // Start backup
      const backupOp = coordinator.requestBackup()!
      coordinator.startOperation(backupOp)

      // Start two syncs
      const sync1 = coordinator.requestSync()!
      const sync2 = coordinator.requestSync()!
      coordinator.startOperation(sync1)
      coordinator.startOperation(sync2)

      expect(coordinator.getOperation(backupOp)!.status).toBe(OperationStatus.PAUSED)

      // Complete first sync
      coordinator.completeOperation(sync1)

      // Backup should still be paused (sync2 still running)
      expect(coordinator.getOperation(backupOp)!.status).toBe(OperationStatus.PAUSED)

      // Complete second sync
      coordinator.completeOperation(sync2)

      // Now backup should resume
      expect(coordinator.getOperation(backupOp)!.status).toBe(OperationStatus.RUNNING)
    })
  })

  describe('getOperationsByType', () => {
    it('should return operations by type', () => {
      const sync1 = coordinator.requestSync()!
      const sync2 = coordinator.requestSync()!
      const backup1 = coordinator.requestBackup()!

      coordinator.startOperation(sync1)

      const syncOps = coordinator.getOperationsByType(OperationType.SYNC)
      const backupOps = coordinator.getOperationsByType(OperationType.BACKUP)

      expect(syncOps.length).toBe(2)
      expect(backupOps.length).toBe(1)
    })

    it('should return empty array for no operations', () => {
      const ops = coordinator.getOperationsByType(OperationType.SYNC)
      expect(ops).toEqual([])
    })
  })

  describe('statistics', () => {
    it('should count active operations', () => {
      const sync1 = coordinator.requestSync()!
      const backup1 = coordinator.requestBackup()!

      coordinator.startOperation(sync1)
      coordinator.startOperation(backup1)

      const stats = coordinator.getStatistics()
      expect(stats.activeSyncCount).toBe(1)
      expect(stats.activeBackupCount).toBe(1)
    })

    it('should count pending operations', () => {
      coordinator.requestSync()
      coordinator.requestBackup()

      const stats = coordinator.getStatistics()
      expect(stats.pendingSyncCount).toBe(1)
      expect(stats.pendingBackupCount).toBe(1)
    })

    it('should count completed operations', () => {
      const op1 = coordinator.requestSync()!
      const op2 = coordinator.requestBackup()!

      coordinator.startOperation(op1)
      coordinator.startOperation(op2)
      coordinator.completeOperation(op1)
      coordinator.completeOperation(op2)

      const stats = coordinator.getStatistics()
      expect(stats.totalCompleted).toBe(2)
    })

    it('should count failed operations', () => {
      const op1 = coordinator.requestSync()!
      coordinator.startOperation(op1)
      coordinator.failOperation(op1, 'Test error')

      const stats = coordinator.getStatistics()
      expect(stats.totalFailed).toBe(1)
    })

    it('should track last backup time', () => {
      const backupOp = coordinator.requestBackup()!
      coordinator.startOperation(backupOp)
      coordinator.completeOperation(backupOp)

      const stats = coordinator.getStatistics()
      expect(stats.lastBackupAt).toBeDefined()
      expect(stats.lastBackupAt).toBeGreaterThan(0)
    })
  })

  describe('canStartBackup', () => {
    it('should return true when conditions are met', () => {
      expect(coordinator.canStartBackup()).toBe(true)
    })

    it('should return false when backup is already running', () => {
      const backupOp = coordinator.requestBackup()!
      coordinator.startOperation(backupOp)

      expect(coordinator.canStartBackup()).toBe(false)
    })

    it('should return false when sync is active', () => {
      const syncOp = coordinator.requestSync()!
      coordinator.startOperation(syncOp)

      expect(coordinator.canStartBackup()).toBe(false)
    })

    it('should return false when within minimum interval', () => {
      const backupOp = coordinator.requestBackup()!
      coordinator.startOperation(backupOp)
      coordinator.completeOperation(backupOp)

      expect(coordinator.canStartBackup()).toBe(false)
    })

    it('should return true when interval has passed', async () => {
      coordinator = new SyncBackupCoordinator({ minBackupInterval: 50 })

      const backupOp = coordinator.requestBackup()!
      coordinator.startOperation(backupOp)
      coordinator.completeOperation(backupOp)

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(coordinator.canStartBackup()).toBe(true)
    })
  })

  describe('canStartSync', () => {
    it('should return true when conditions are met', () => {
      expect(coordinator.canStartSync()).toBe(true)
    })

    it('should return false when max concurrent sync reached', () => {
      const syncOp = coordinator.requestSync()!
      coordinator.startOperation(syncOp)

      expect(coordinator.canStartSync()).toBe(false)
    })

    it('should return true after sync completes', () => {
      const syncOp = coordinator.requestSync()!
      coordinator.startOperation(syncOp)
      coordinator.completeOperation(syncOp)

      expect(coordinator.canStartSync()).toBe(true)
    })
  })

  describe('cleanup', () => {
    it('should remove completed operations', () => {
      const op1 = coordinator.requestSync()!
      coordinator.startOperation(op1)
      coordinator.completeOperation(op1)

      coordinator.cleanup()

      expect(coordinator.getOperation(op1)).toBeUndefined()
    })

    it('should remove failed operations', () => {
      const op1 = coordinator.requestSync()!
      coordinator.startOperation(op1)
      coordinator.failOperation(op1, 'Error')

      coordinator.cleanup()

      expect(coordinator.getOperation(op1)).toBeUndefined()
    })

    it('should remove cancelled operations', () => {
      const op1 = coordinator.requestSync()!
      coordinator.cancelOperation(op1)

      coordinator.cleanup()

      expect(coordinator.getOperation(op1)).toBeUndefined()
    })

    it('should not remove active operations', () => {
      const op1 = coordinator.requestSync()!
      coordinator.startOperation(op1)

      coordinator.cleanup()

      expect(coordinator.getOperation(op1)).toBeDefined()
    })

    it('should remove operations older than threshold', async () => {
      const op1 = coordinator.requestSync()!
      coordinator.startOperation(op1)
      coordinator.completeOperation(op1)

      await new Promise((resolve) => setTimeout(resolve, 100))

      coordinator.cleanup(50) // Remove older than 50ms

      expect(coordinator.getOperation(op1)).toBeUndefined()
    })

    it('should keep recent operations', () => {
      const op1 = coordinator.requestSync()!
      coordinator.startOperation(op1)
      coordinator.completeOperation(op1)

      coordinator.cleanup(10000) // Remove older than 10 seconds

      expect(coordinator.getOperation(op1)).toBeDefined()
    })
  })

  describe('createSyncBackupCoordinator factory', () => {
    it('should create coordinator instance', () => {
      const instance = createSyncBackupCoordinator()
      expect(instance).toBeInstanceOf(SyncBackupCoordinator)
    })

    it('should accept config', () => {
      const instance = createSyncBackupCoordinator({ maxConcurrentSync: 3 })
      expect(instance).toBeInstanceOf(SyncBackupCoordinator)
    })
  })

  describe('integration scenarios', () => {
    it('should handle sync during backup', () => {
      // Start backup
      const backupOp = coordinator.requestBackup()!
      coordinator.startOperation(backupOp)
      coordinator.updateProgress(backupOp, 50)

      expect(coordinator.getOperation(backupOp)!.progress).toBe(50)

      // Sync request arrives (should pause backup)
      const syncOp = coordinator.requestSync()!
      coordinator.startOperation(syncOp)

      expect(coordinator.getOperation(backupOp)!.status).toBe(OperationStatus.PAUSED)
      expect(coordinator.getOperation(syncOp)!.status).toBe(OperationStatus.RUNNING)

      // Complete sync (should resume backup)
      coordinator.completeOperation(syncOp)

      expect(coordinator.getOperation(backupOp)!.status).toBe(OperationStatus.RUNNING)
      expect(coordinator.getOperation(backupOp)!.progress).toBe(50) // Preserved
    })

    it('should handle multiple sync operations', () => {
      coordinator = new SyncBackupCoordinator({ maxConcurrentSync: 3 })

      // Start 3 syncs
      const sync1 = coordinator.requestSync()!
      const sync2 = coordinator.requestSync()!
      const sync3 = coordinator.requestSync()!

      coordinator.startOperation(sync1)
      coordinator.startOperation(sync2)
      coordinator.startOperation(sync3)

      // 4th should be rejected
      const sync4 = coordinator.requestSync()
      expect(sync4).toBeNull()

      // Complete one
      coordinator.completeOperation(sync1)

      // Now 4th can be requested
      const sync5 = coordinator.requestSync()
      expect(sync5).toBeDefined()
    })

    it('should handle backup retry after sync interference', async () => {
      coordinator = new SyncBackupCoordinator({ minBackupInterval: 50 })

      // Try backup while sync is running
      const syncOp = coordinator.requestSync()!
      coordinator.startOperation(syncOp)

      const backup1 = coordinator.requestBackup()
      expect(backup1).toBeNull() // Deferred

      // Complete sync
      coordinator.completeOperation(syncOp)

      // Wait for interval
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Now backup can proceed
      const backup2 = coordinator.requestBackup()
      expect(backup2).toBeDefined()
    })
  })
})
