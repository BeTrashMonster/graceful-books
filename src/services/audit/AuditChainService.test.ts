/**
 * Audit Chain Service Tests
 *
 * Tests for audit log filtering, export, and display helpers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getFilteredAuditLogs,
  getBackupSyncAuditLogs,
  exportAuditLogsToCSV,
  formatAuditLogSummary,
  getActionDisplayName,
  getActionBadgeColor,
  verifyAuditChainIntegrity,
  formatVerificationResult,
  getVerificationBadgeColor,
  BackupAuditEventType,
  type AuditLogFilters,
  type FilteredAuditLogsResult,
  type ChainVerificationResult,
} from './AuditChainService'
import { db } from '../../store/database'
import type { AuditLogEntity } from '../../store/types'

// Mock database
vi.mock('../../store/database', () => ({
  db: {
    auditLogs: {
      toArray: vi.fn(),
    },
  },
}))

describe('AuditChainService', () => {
  // Sample audit logs for testing
  const mockLogs: AuditLogEntity[] = [
    {
      id: 'audit-1',
      companyId: 'company-1',
      userId: 'user-1',
      deviceId: 'device-1',
      action: BackupAuditEventType.BACKUP_CREATED,
      entityType: 'backup',
      entityId: 'backup-1',
      timestamp: new Date('2024-01-15T10:00:00Z'),
      changedFields: ['backupData', 'metadata'],
      metadata: { size: 1024 },
    },
    {
      id: 'audit-2',
      companyId: 'company-1',
      userId: 'user-2',
      deviceId: 'device-2',
      action: BackupAuditEventType.KEY_ROTATED,
      entityType: 'key',
      entityId: 'key-1',
      timestamp: new Date('2024-01-16T11:00:00Z'),
      changedFields: ['epoch'],
      metadata: { oldEpoch: 1, newEpoch: 2 },
    },
    {
      id: 'audit-3',
      companyId: 'company-1',
      userId: 'user-1',
      deviceId: 'device-1',
      action: BackupAuditEventType.USER_REVOKED,
      entityType: 'user',
      entityId: 'user-3',
      timestamp: new Date('2024-01-17T12:00:00Z'),
      changedFields: ['deletedAt'],
      metadata: { revokedUserId: 'user-3' },
    },
    {
      id: 'audit-4',
      companyId: 'company-2',
      userId: 'user-4',
      deviceId: 'device-3',
      action: BackupAuditEventType.BACKUP_RESTORED,
      entityType: 'backup',
      entityId: 'backup-2',
      timestamp: new Date('2024-01-18T13:00:00Z'),
      changedFields: ['restoredData'],
      metadata: { backupVersion: 1 },
    },
    {
      id: 'audit-5',
      companyId: 'company-1',
      userId: 'user-1',
      deviceId: 'device-1',
      action: BackupAuditEventType.SYNC_COMPLETED,
      entityType: 'sync',
      entityId: 'sync-1',
      timestamp: new Date('2024-01-19T14:00:00Z'),
      changedFields: ['syncedRecords'],
      metadata: { recordCount: 10 },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.auditLogs.toArray).mockResolvedValue(mockLogs)
  })

  describe('getFilteredAuditLogs', () => {
    it('should return all logs when no filters provided', async () => {
      const result = await getFilteredAuditLogs({})

      expect(result.logs).toHaveLength(5)
      expect(result.totalCount).toBe(5)
    })

    it('should filter by company ID', async () => {
      const result = await getFilteredAuditLogs({
        companyId: 'company-1',
      })

      expect(result.logs).toHaveLength(4)
      expect(result.logs.every((log) => log.companyId === 'company-1')).toBe(true)
    })

    it('should filter by user ID', async () => {
      const result = await getFilteredAuditLogs({
        userId: 'user-1',
      })

      expect(result.logs).toHaveLength(3)
      expect(result.logs.every((log) => log.userId === 'user-1')).toBe(true)
    })

    it('should filter by action type', async () => {
      const result = await getFilteredAuditLogs({
        action: BackupAuditEventType.BACKUP_CREATED,
      })

      expect(result.logs).toHaveLength(1)
      expect(result.logs[0].action).toBe(BackupAuditEventType.BACKUP_CREATED)
    })

    it('should filter by entity type', async () => {
      const result = await getFilteredAuditLogs({
        entityType: 'backup',
      })

      expect(result.logs).toHaveLength(2)
      expect(result.logs.every((log) => log.entityType === 'backup')).toBe(true)
    })

    it('should filter by date range (from)', async () => {
      const result = await getFilteredAuditLogs({
        dateFrom: new Date('2024-01-17T00:00:00Z'),
      })

      expect(result.logs).toHaveLength(3)
      expect(
        result.logs.every(
          (log) => log.timestamp >= new Date('2024-01-17T00:00:00Z')
        )
      ).toBe(true)
    })

    it('should filter by date range (to)', async () => {
      const result = await getFilteredAuditLogs({
        dateTo: new Date('2024-01-16T23:59:59Z'),
      })

      expect(result.logs).toHaveLength(2)
      expect(
        result.logs.every(
          (log) => log.timestamp <= new Date('2024-01-16T23:59:59Z')
        )
      ).toBe(true)
    })

    it('should filter by date range (from and to)', async () => {
      const result = await getFilteredAuditLogs({
        dateFrom: new Date('2024-01-16T00:00:00Z'),
        dateTo: new Date('2024-01-17T23:59:59Z'),
      })

      expect(result.logs).toHaveLength(2)
      expect(result.logs[0].action).toBe(BackupAuditEventType.USER_REVOKED)
      expect(result.logs[1].action).toBe(BackupAuditEventType.KEY_ROTATED)
    })

    it('should combine multiple filters', async () => {
      const result = await getFilteredAuditLogs({
        companyId: 'company-1',
        userId: 'user-1',
        dateFrom: new Date('2024-01-17T00:00:00Z'),
      })

      expect(result.logs).toHaveLength(2)
      expect(result.logs.every((log) => log.companyId === 'company-1')).toBe(true)
      expect(result.logs.every((log) => log.userId === 'user-1')).toBe(true)
    })

    it('should sort logs in descending order by default', async () => {
      const result = await getFilteredAuditLogs({})

      expect(result.logs[0].timestamp.getTime()).toBeGreaterThan(
        result.logs[1].timestamp.getTime()
      )
      expect(result.logs[1].timestamp.getTime()).toBeGreaterThan(
        result.logs[2].timestamp.getTime()
      )
    })

    it('should sort logs in ascending order when specified', async () => {
      const result = await getFilteredAuditLogs({
        sortOrder: 'asc',
      })

      expect(result.logs[0].timestamp.getTime()).toBeLessThan(
        result.logs[1].timestamp.getTime()
      )
      expect(result.logs[1].timestamp.getTime()).toBeLessThan(
        result.logs[2].timestamp.getTime()
      )
    })

    it('should apply limit', async () => {
      const result = await getFilteredAuditLogs({
        limit: 2,
      })

      expect(result.logs).toHaveLength(2)
      expect(result.totalCount).toBe(5) // Total before limit
    })

    it('should build summary statistics', async () => {
      const result = await getFilteredAuditLogs({
        companyId: 'company-1',
      })

      expect(result.summary.companies.size).toBe(1)
      expect(result.summary.companies.has('company-1')).toBe(true)
      expect(result.summary.users.size).toBe(2)
      expect(result.summary.users.has('user-1')).toBe(true)
      expect(result.summary.users.has('user-2')).toBe(true)
      expect(result.summary.actions.size).toBe(4)
      expect(result.summary.dateRange.earliest).toBeInstanceOf(Date)
      expect(result.summary.dateRange.latest).toBeInstanceOf(Date)
    })

    it('should handle empty results', async () => {
      vi.mocked(db.auditLogs.toArray).mockResolvedValue([])

      const result = await getFilteredAuditLogs({})

      expect(result.logs).toHaveLength(0)
      expect(result.totalCount).toBe(0)
      expect(result.summary.companies.size).toBe(0)
      expect(result.summary.dateRange.earliest).toBeNull()
      expect(result.summary.dateRange.latest).toBeNull()
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(db.auditLogs.toArray).mockRejectedValue(
        new Error('Database error')
      )

      await expect(getFilteredAuditLogs({})).rejects.toThrow('Database error')
    })
  })

  describe('getBackupSyncAuditLogs', () => {
    it('should filter to backup/sync specific actions', async () => {
      const result = await getBackupSyncAuditLogs('company-1')

      expect(result.logs).toHaveLength(4)
      expect(
        result.logs.every((log) =>
          Object.values(BackupAuditEventType).includes(
            log.action as BackupAuditEventType
          )
        )
      ).toBe(true)
    })

    it('should filter by company ID', async () => {
      const result = await getBackupSyncAuditLogs('company-1')

      expect(result.logs.every((log) => log.companyId === 'company-1')).toBe(true)
    })

    it('should accept additional filters', async () => {
      const result = await getBackupSyncAuditLogs('company-1', {
        userId: 'user-1',
      })

      expect(result.logs.every((log) => log.userId === 'user-1')).toBe(true)
      expect(result.logs.every((log) => log.companyId === 'company-1')).toBe(true)
    })

    it('should exclude non-backup/sync actions', async () => {
      // Add a non-backup/sync action
      const allLogs = [
        ...mockLogs,
        {
          id: 'audit-6',
          companyId: 'company-1',
          userId: 'user-1',
          deviceId: 'device-1',
          action: 'TRANSACTION_CREATED',
          entityType: 'transaction',
          entityId: 'txn-1',
          timestamp: new Date('2024-01-20T15:00:00Z'),
          changedFields: ['amount'],
          metadata: {},
        } as AuditLogEntity,
      ]

      vi.mocked(db.auditLogs.toArray).mockResolvedValue(allLogs)

      const result = await getBackupSyncAuditLogs('company-1')

      expect(
        result.logs.every((log) => log.action !== 'TRANSACTION_CREATED')
      ).toBe(true)
    })
  })

  describe('exportAuditLogsToCSV', () => {
    it('should export logs to CSV format', () => {
      const csv = exportAuditLogsToCSV(mockLogs.slice(0, 2))

      // Check header (CSV wraps fields in quotes)
      expect(csv).toContain('"Timestamp","User ID","Device ID","Action"')

      // Check data rows
      expect(csv).toContain('user-1')
      expect(csv).toContain('device-1')
      expect(csv).toContain('BACKUP_CREATED')
    })

    it('should escape quotes in CSV', () => {
      const logsWithQuotes: AuditLogEntity[] = [
        {
          id: 'audit-1',
          companyId: 'company-1',
          userId: 'user-1',
          deviceId: 'device-1',
          action: 'TEST_ACTION',
          entityType: 'test',
          entityId: 'test-1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          changedFields: ['field with "quotes"'],
          metadata: {},
        },
      ]

      const csv = exportAuditLogsToCSV(logsWithQuotes)

      // Quotes should be escaped as ""
      expect(csv).toContain('""')
    })

    it('should handle empty arrays', () => {
      const csv = exportAuditLogsToCSV([])

      // Should only have header
      const lines = csv.split('\n')
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain('Timestamp')
    })

    it('should format timestamps as ISO strings', () => {
      const csv = exportAuditLogsToCSV(mockLogs.slice(0, 1))

      // First log (index 0) is most recent due to sort order
      expect(csv).toContain('2024-01-15T10:00:00.000Z')
    })

    it('should include changed fields', () => {
      // Use specific log that we know has the expected fields
      const logsWithFields = mockLogs.filter(
        (log) => log.action === BackupAuditEventType.BACKUP_CREATED
      )
      const csv = exportAuditLogsToCSV(logsWithFields)

      expect(csv).toContain('backupData, metadata')
    })
  })

  describe('formatAuditLogSummary', () => {
    it('should format summary with all information', () => {
      const result: FilteredAuditLogsResult = {
        logs: mockLogs,
        totalCount: 5,
        summary: {
          companies: new Set(['company-1', 'company-2']),
          users: new Set(['user-1', 'user-2', 'user-4']),
          actions: new Set([
            BackupAuditEventType.BACKUP_CREATED,
            BackupAuditEventType.KEY_ROTATED,
          ]),
          dateRange: {
            earliest: new Date('2024-01-15T10:00:00Z'),
            latest: new Date('2024-01-19T14:00:00Z'),
          },
        },
      }

      const summary = formatAuditLogSummary(result)

      expect(summary).toContain('Found 5 audit logs')
      expect(summary).toContain('from 1/15/2024 to 1/19/2024')
      expect(summary).toContain('across 3 users')
      expect(summary).toContain('with 2 action types')
    })

    it('should handle singular count', () => {
      const result: FilteredAuditLogsResult = {
        logs: mockLogs.slice(0, 1),
        totalCount: 1,
        summary: {
          companies: new Set(['company-1']),
          users: new Set(['user-1']),
          actions: new Set([BackupAuditEventType.BACKUP_CREATED]),
          dateRange: {
            earliest: new Date('2024-01-15T10:00:00Z'),
            latest: new Date('2024-01-15T10:00:00Z'),
          },
        },
      }

      const summary = formatAuditLogSummary(result)

      expect(summary).toContain('Found 1 audit log')
      expect(summary).toContain('across 1 user')
      expect(summary).toContain('with 1 action type')
    })

    it('should handle empty date range', () => {
      const result: FilteredAuditLogsResult = {
        logs: [],
        totalCount: 0,
        summary: {
          companies: new Set(),
          users: new Set(),
          actions: new Set(),
          dateRange: {
            earliest: null,
            latest: null,
          },
        },
      }

      const summary = formatAuditLogSummary(result)

      expect(summary).toContain('Found 0 audit logs')
      expect(summary).not.toContain('from')
    })
  })

  describe('getActionDisplayName', () => {
    it('should return display names for backup actions', () => {
      expect(getActionDisplayName(BackupAuditEventType.BACKUP_CREATED)).toBe(
        'Backup Created'
      )
      expect(getActionDisplayName(BackupAuditEventType.BACKUP_RESTORED)).toBe(
        'Backup Restored'
      )
      expect(getActionDisplayName(BackupAuditEventType.BACKUP_DELETED)).toBe(
        'Backup Deleted'
      )
    })

    it('should return display names for key actions', () => {
      expect(getActionDisplayName(BackupAuditEventType.KEY_ROTATED)).toBe(
        'Key Rotated'
      )
      expect(getActionDisplayName(BackupAuditEventType.USER_REVOKED)).toBe(
        'User Revoked'
      )
    })

    it('should return display names for sync actions', () => {
      expect(getActionDisplayName(BackupAuditEventType.SYNC_STARTED)).toBe(
        'Sync Started'
      )
      expect(getActionDisplayName(BackupAuditEventType.SYNC_COMPLETED)).toBe(
        'Sync Completed'
      )
      expect(getActionDisplayName(BackupAuditEventType.SYNC_FAILED)).toBe(
        'Sync Failed'
      )
    })

    it('should return original action if not in map', () => {
      expect(getActionDisplayName('UNKNOWN_ACTION')).toBe('UNKNOWN_ACTION')
    })
  })

  describe('getActionBadgeColor', () => {
    it('should return success for completed/created actions', () => {
      expect(getActionBadgeColor(BackupAuditEventType.BACKUP_CREATED)).toBe(
        'success'
      )
      expect(getActionBadgeColor(BackupAuditEventType.SYNC_COMPLETED)).toBe(
        'success'
      )
    })

    it('should return danger for failed/deleted actions', () => {
      expect(getActionBadgeColor(BackupAuditEventType.BACKUP_FAILED)).toBe(
        'danger'
      )
      expect(getActionBadgeColor(BackupAuditEventType.BACKUP_DELETED)).toBe(
        'danger'
      )
      expect(getActionBadgeColor(BackupAuditEventType.SYNC_FAILED)).toBe(
        'danger'
      )
    })

    it('should return warning for revoked/rotated actions', () => {
      expect(getActionBadgeColor(BackupAuditEventType.KEY_ROTATED)).toBe(
        'warning'
      )
      expect(getActionBadgeColor(BackupAuditEventType.USER_REVOKED)).toBe(
        'warning'
      )
    })

    it('should return info for other actions', () => {
      expect(getActionBadgeColor(BackupAuditEventType.BACKUP_SCHEDULED)).toBe(
        'info'
      )
      expect(getActionBadgeColor('UNKNOWN_ACTION')).toBe('info')
    })
  })

  describe('verifyAuditChainIntegrity', () => {
    it('should verify intact chain with valid HMAC and hashes', async () => {
      const chainLogs: AuditLogEntity[] = [
        {
          id: 'audit-1',
          companyId: 'company-1',
          userId: 'user-1',
          deviceId: 'device-1',
          action: BackupAuditEventType.BACKUP_CREATED,
          entityType: 'backup',
          entityId: 'backup-1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          changedFields: [],
          metadata: {
            hmac: 'hash-1',
            previousHash: null,
          },
        },
        {
          id: 'audit-2',
          companyId: 'company-1',
          userId: 'user-1',
          deviceId: 'device-1',
          action: BackupAuditEventType.KEY_ROTATED,
          entityType: 'key',
          entityId: 'key-1',
          timestamp: new Date('2024-01-16T10:00:00Z'),
          changedFields: [],
          metadata: {
            hmac: 'hash-2',
            previousHash: 'hash-1',
          },
        },
        {
          id: 'audit-3',
          companyId: 'company-1',
          userId: 'user-1',
          deviceId: 'device-1',
          action: BackupAuditEventType.USER_REVOKED,
          entityType: 'user',
          entityId: 'user-3',
          timestamp: new Date('2024-01-17T10:00:00Z'),
          changedFields: [],
          metadata: {
            hmac: 'hash-3',
            previousHash: 'hash-2',
          },
        },
      ]

      vi.mocked(db.auditLogs.toArray).mockResolvedValue(chainLogs)

      const result = await verifyAuditChainIntegrity('company-1')

      expect(result.success).toBe(true)
      expect(result.valid).toBe(true)
      expect(result.totalLogs).toBe(3)
      expect(result.brokenLinks).toBe(0)
      expect(result.brokenLinkDetails).toHaveLength(0)
    })

    it('should detect missing HMAC', async () => {
      const chainLogs: AuditLogEntity[] = [
        {
          id: 'audit-1',
          companyId: 'company-1',
          userId: 'user-1',
          deviceId: 'device-1',
          action: BackupAuditEventType.BACKUP_CREATED,
          entityType: 'backup',
          entityId: 'backup-1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          changedFields: [],
          metadata: {}, // Missing HMAC
        },
      ]

      vi.mocked(db.auditLogs.toArray).mockResolvedValue(chainLogs)

      const result = await verifyAuditChainIntegrity('company-1')

      expect(result.success).toBe(true)
      expect(result.valid).toBe(false)
      expect(result.brokenLinks).toBe(1)
      expect(result.brokenLinkDetails[0].issue).toBe('missing_hmac')
      expect(result.brokenLinkDetails[0].description).toContain('missing HMAC')
    })

    it('should detect missing previous hash', async () => {
      const chainLogs: AuditLogEntity[] = [
        {
          id: 'audit-1',
          companyId: 'company-1',
          userId: 'user-1',
          deviceId: 'device-1',
          action: BackupAuditEventType.BACKUP_CREATED,
          entityType: 'backup',
          entityId: 'backup-1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          changedFields: [],
          metadata: {
            hmac: 'hash-1',
            previousHash: null,
          },
        },
        {
          id: 'audit-2',
          companyId: 'company-1',
          userId: 'user-1',
          deviceId: 'device-1',
          action: BackupAuditEventType.KEY_ROTATED,
          entityType: 'key',
          entityId: 'key-1',
          timestamp: new Date('2024-01-16T10:00:00Z'),
          changedFields: [],
          metadata: {
            hmac: 'hash-2',
            // Missing previousHash
          },
        },
      ]

      vi.mocked(db.auditLogs.toArray).mockResolvedValue(chainLogs)

      const result = await verifyAuditChainIntegrity('company-1')

      expect(result.success).toBe(true)
      expect(result.valid).toBe(false)
      expect(result.brokenLinks).toBe(1)
      expect(result.brokenLinkDetails[0].issue).toBe('missing_previous_hash')
      expect(result.brokenLinkDetails[0].description).toContain('missing previousHash')
    })

    it('should detect hash mismatch', async () => {
      const chainLogs: AuditLogEntity[] = [
        {
          id: 'audit-1',
          companyId: 'company-1',
          userId: 'user-1',
          deviceId: 'device-1',
          action: BackupAuditEventType.BACKUP_CREATED,
          entityType: 'backup',
          entityId: 'backup-1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          changedFields: [],
          metadata: {
            hmac: 'hash-1',
            previousHash: null,
          },
        },
        {
          id: 'audit-2',
          companyId: 'company-1',
          userId: 'user-1',
          deviceId: 'device-1',
          action: BackupAuditEventType.KEY_ROTATED,
          entityType: 'key',
          entityId: 'key-1',
          timestamp: new Date('2024-01-16T10:00:00Z'),
          changedFields: [],
          metadata: {
            hmac: 'hash-2',
            previousHash: 'WRONG-HASH', // Hash mismatch
          },
        },
      ]

      vi.mocked(db.auditLogs.toArray).mockResolvedValue(chainLogs)

      const result = await verifyAuditChainIntegrity('company-1')

      expect(result.success).toBe(true)
      expect(result.valid).toBe(false)
      expect(result.brokenLinks).toBe(1)
      expect(result.brokenLinkDetails[0].issue).toBe('hash_mismatch')
      expect(result.brokenLinkDetails[0].expected).toBe('hash-1')
      expect(result.brokenLinkDetails[0].actual).toBe('WRONG-HASH')
    })

    it('should detect invalid first log with non-null previous hash', async () => {
      const chainLogs: AuditLogEntity[] = [
        {
          id: 'audit-1',
          companyId: 'company-1',
          userId: 'user-1',
          deviceId: 'device-1',
          action: BackupAuditEventType.BACKUP_CREATED,
          entityType: 'backup',
          entityId: 'backup-1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          changedFields: [],
          metadata: {
            hmac: 'hash-1',
            previousHash: 'should-be-null', // First log should have null
          },
        },
      ]

      vi.mocked(db.auditLogs.toArray).mockResolvedValue(chainLogs)

      const result = await verifyAuditChainIntegrity('company-1')

      expect(result.success).toBe(true)
      expect(result.valid).toBe(false)
      expect(result.brokenLinks).toBe(1)
      expect(result.brokenLinkDetails[0].issue).toBe('hash_mismatch')
      expect(result.brokenLinkDetails[0].description).toContain('should have null')
    })

    it('should handle empty audit log', async () => {
      vi.mocked(db.auditLogs.toArray).mockResolvedValue([])

      const result = await verifyAuditChainIntegrity('company-1')

      expect(result.success).toBe(true)
      expect(result.valid).toBe(true)
      expect(result.totalLogs).toBe(0)
      expect(result.brokenLinks).toBe(0)
    })

    it('should filter by company ID', async () => {
      const chainLogs: AuditLogEntity[] = [
        {
          id: 'audit-1',
          companyId: 'company-1',
          userId: 'user-1',
          deviceId: 'device-1',
          action: BackupAuditEventType.BACKUP_CREATED,
          entityType: 'backup',
          entityId: 'backup-1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          changedFields: [],
          metadata: {
            hmac: 'hash-1',
            previousHash: null,
          },
        },
        {
          id: 'audit-2',
          companyId: 'company-2', // Different company
          userId: 'user-2',
          deviceId: 'device-2',
          action: BackupAuditEventType.KEY_ROTATED,
          entityType: 'key',
          entityId: 'key-1',
          timestamp: new Date('2024-01-16T10:00:00Z'),
          changedFields: [],
          metadata: {
            hmac: 'hash-2',
            previousHash: null,
          },
        },
      ]

      vi.mocked(db.auditLogs.toArray).mockResolvedValue(chainLogs)

      const result = await verifyAuditChainIntegrity('company-1')

      expect(result.success).toBe(true)
      expect(result.totalLogs).toBe(1) // Only company-1 logs
    })

    it('should handle verification errors', async () => {
      vi.mocked(db.auditLogs.toArray).mockRejectedValue(new Error('Database error'))

      const result = await verifyAuditChainIntegrity('company-1')

      expect(result.success).toBe(false)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Database error')
    })

    it('should detect multiple issues in chain', async () => {
      const chainLogs: AuditLogEntity[] = [
        {
          id: 'audit-1',
          companyId: 'company-1',
          userId: 'user-1',
          deviceId: 'device-1',
          action: BackupAuditEventType.BACKUP_CREATED,
          entityType: 'backup',
          entityId: 'backup-1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          changedFields: [],
          metadata: {}, // Missing HMAC
        },
        {
          id: 'audit-2',
          companyId: 'company-1',
          userId: 'user-1',
          deviceId: 'device-1',
          action: BackupAuditEventType.KEY_ROTATED,
          entityType: 'key',
          entityId: 'key-1',
          timestamp: new Date('2024-01-16T10:00:00Z'),
          changedFields: [],
          metadata: {
            hmac: 'hash-2',
            // Missing previousHash
          },
        },
      ]

      vi.mocked(db.auditLogs.toArray).mockResolvedValue(chainLogs)

      const result = await verifyAuditChainIntegrity('company-1')

      expect(result.success).toBe(true)
      expect(result.valid).toBe(false)
      expect(result.brokenLinks).toBe(2)
      expect(result.brokenLinkDetails).toHaveLength(2)
    })
  })

  describe('formatVerificationResult', () => {
    it('should format valid chain result', () => {
      const result: ChainVerificationResult = {
        success: true,
        valid: true,
        totalLogs: 10,
        brokenLinks: 0,
        brokenLinkDetails: [],
        verifiedAt: new Date(),
      }

      const formatted = formatVerificationResult(result)

      expect(formatted).toContain('✓')
      expect(formatted).toContain('10 logs')
      expect(formatted).toContain('intact')
    })

    it('should format invalid chain result', () => {
      const result: ChainVerificationResult = {
        success: true,
        valid: false,
        totalLogs: 10,
        brokenLinks: 2,
        brokenLinkDetails: [
          {
            logId: 'audit-1',
            timestamp: new Date('2024-01-15T10:00:00Z'),
            action: 'BACKUP_CREATED',
            issue: 'missing_hmac',
            description: 'Log is missing HMAC',
          },
          {
            logId: 'audit-2',
            timestamp: new Date('2024-01-16T10:00:00Z'),
            action: 'KEY_ROTATED',
            issue: 'hash_mismatch',
            description: 'Hash does not match',
            expected: 'hash-1',
            actual: 'hash-2',
          },
        ],
        verifiedAt: new Date(),
      }

      const formatted = formatVerificationResult(result)

      expect(formatted).toContain('⚠')
      expect(formatted).toContain('2 broken links')
      expect(formatted).toContain('MISSING HMAC')
      expect(formatted).toContain('HASH MISMATCH')
    })

    it('should format empty log result', () => {
      const result: ChainVerificationResult = {
        success: true,
        valid: true,
        totalLogs: 0,
        brokenLinks: 0,
        brokenLinkDetails: [],
        verifiedAt: new Date(),
      }

      const formatted = formatVerificationResult(result)

      expect(formatted).toContain('No audit logs')
    })

    it('should format verification error', () => {
      const result: ChainVerificationResult = {
        success: false,
        valid: false,
        totalLogs: 0,
        brokenLinks: 0,
        brokenLinkDetails: [],
        verifiedAt: new Date(),
        error: 'Database connection failed',
      }

      const formatted = formatVerificationResult(result)

      expect(formatted).toContain('Verification failed')
      expect(formatted).toContain('Database connection failed')
    })
  })

  describe('getVerificationBadgeColor', () => {
    it('should return success for valid chain', () => {
      const result: ChainVerificationResult = {
        success: true,
        valid: true,
        totalLogs: 10,
        brokenLinks: 0,
        brokenLinkDetails: [],
        verifiedAt: new Date(),
      }

      expect(getVerificationBadgeColor(result)).toBe('success')
    })

    it('should return warning for invalid chain', () => {
      const result: ChainVerificationResult = {
        success: true,
        valid: false,
        totalLogs: 10,
        brokenLinks: 1,
        brokenLinkDetails: [],
        verifiedAt: new Date(),
      }

      expect(getVerificationBadgeColor(result)).toBe('warning')
    })

    it('should return danger for verification error', () => {
      const result: ChainVerificationResult = {
        success: false,
        valid: false,
        totalLogs: 0,
        brokenLinks: 0,
        brokenLinkDetails: [],
        verifiedAt: new Date(),
        error: 'Error',
      }

      expect(getVerificationBadgeColor(result)).toBe('danger')
    })
  })
})
