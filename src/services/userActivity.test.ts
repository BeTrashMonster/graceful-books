/**
 * User Activity Logging Service Tests
 *
 * Tests for S7-2: User Activity Logging
 * Verifies CRUD operations, settings changes, and data exports are logged correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  logUserActivity,
  logSettingsChange,
  logDataExport,
  queryUserActivity,
  getUserActivityStats,
  getRecentUserActivities,
  getUserActivitySummary,
} from './userActivity'
import { setAuditContext, clearAuditContext } from './audit'
import type { AuditLog, AuditAction, AuditEntityType } from '../types/database.types'

// Mock database
const createMockDb = () => {
  const logs: any[] = []

  return {
    auditLogs: {
      add: vi.fn(async (entry: any) => {
        const id = `log-${logs.length + 1}`
        logs.push({ ...entry, id })
        return id
      }),
      where: vi.fn((index: string) => ({
        between: vi.fn(() => ({
          toArray: vi.fn(async () => logs),
        })),
        equals: vi.fn(() => ({
          toArray: vi.fn(async () => logs),
        })),
      })),
      toArray: vi.fn(async () => logs),
    },
    _getLogs: () => logs,
    _clearLogs: () => logs.splice(0, logs.length),
  }
}

describe('User Activity Logging Service', () => {
  let mockDb: any

  beforeEach(() => {
    mockDb = createMockDb()
    clearAuditContext()
  })

  describe('logUserActivity', () => {
    it('should log a CREATE action', async () => {
      // Set audit context
      setAuditContext({
        userId: 'user-123',
        companyId: 'company-abc',
      })

      const newEntity = {
        id: 'txn-456',
        amount: 100.0,
        description: 'Test transaction',
      }

      const id = await logUserActivity(
        'CREATE' as AuditAction,
        'TRANSACTION' as AuditEntityType,
        'txn-456',
        null,
        newEntity,
        mockDb
      )

      expect(id).toBeTruthy()
      expect(mockDb.auditLogs.add).toHaveBeenCalled()

      const logs = mockDb._getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('CREATE')
      expect(logs[0].entity_type).toBe('TRANSACTION')
      expect(logs[0].entity_id).toBe('txn-456')
      expect(logs[0].user_id).toBe('user-123')
      expect(logs[0].company_id).toBe('company-abc')
    })

    it('should log an UPDATE action with changed fields', async () => {
      setAuditContext({
        userId: 'user-123',
        companyId: 'company-abc',
      })

      const beforeEntity = {
        id: 'acc-789',
        name: 'Old Name',
        balance: 1000,
      }

      const afterEntity = {
        id: 'acc-789',
        name: 'New Name',
        balance: 1500,
      }

      const id = await logUserActivity(
        'UPDATE' as AuditAction,
        'ACCOUNT' as AuditEntityType,
        'acc-789',
        beforeEntity,
        afterEntity,
        mockDb
      )

      expect(id).toBeTruthy()

      const logs = mockDb._getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('UPDATE')
      expect(logs[0].changed_fields).toContain('name')
      expect(logs[0].changed_fields).toContain('balance')
    })

    it('should log a DELETE action', async () => {
      setAuditContext({
        userId: 'user-123',
        companyId: 'company-abc',
      })

      const deletedEntity = {
        id: 'prod-999',
        name: 'Deleted Product',
      }

      const id = await logUserActivity(
        'DELETE' as AuditAction,
        'PRODUCT' as AuditEntityType,
        'prod-999',
        deletedEntity,
        null,
        mockDb
      )

      expect(id).toBeTruthy()

      const logs = mockDb._getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('DELETE')
      expect(logs[0].entity_type).toBe('PRODUCT')
    })

    it('should sanitize sensitive fields', async () => {
      setAuditContext({
        userId: 'user-123',
        companyId: 'company-abc',
      })

      const entityWithSensitiveData = {
        id: 'user-456',
        username: 'testuser',
        password: 'secret123',
        apiKey: 'sk-12345',
        email: 'user@example.com',
      }

      await logUserActivity(
        'CREATE' as AuditAction,
        'USER' as AuditEntityType,
        'user-456',
        null,
        entityWithSensitiveData,
        mockDb
      )

      const logs = mockDb._getLogs()
      const loggedValue = JSON.parse(logs[0].after_value)

      expect(loggedValue.username).toBe('testuser')
      expect(loggedValue.email).toBe('user@example.com')
      expect(loggedValue.password).toBe('[REDACTED]')
      expect(loggedValue.apiKey).toBe('[REDACTED]')
    })

    it('should not log when audit context is not set', async () => {
      const id = await logUserActivity(
        'CREATE' as AuditAction,
        'TRANSACTION' as AuditEntityType,
        'txn-123',
        null,
        { amount: 100 },
        mockDb
      )

      expect(id).toBeNull()
      expect(mockDb.auditLogs.add).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      setAuditContext({
        userId: 'user-123',
        companyId: 'company-abc',
      })

      const failingDb = {
        auditLogs: {
          add: vi.fn().mockRejectedValue(new Error('Database error')),
        },
      }

      const id = await logUserActivity(
        'CREATE' as AuditAction,
        'TRANSACTION' as AuditEntityType,
        'txn-123',
        null,
        { amount: 100 },
        failingDb as any
      )

      expect(id).toBeNull()
    })
  })

  describe('logSettingsChange', () => {
    it('should log a settings change', async () => {
      setAuditContext({
        userId: 'user-123',
        companyId: 'company-abc',
      })

      const id = await logSettingsChange('theme', 'light', 'dark', 'appearance', mockDb)

      expect(id).toBeTruthy()

      const logs = mockDb._getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('SETTINGS_CHANGE')
      expect(logs[0].entity_type).toBe('SETTINGS')
      expect(logs[0].entity_id).toBe('theme')
      expect(logs[0].changed_fields).toContain('theme')
    })

    it('should sanitize sensitive settings values', async () => {
      setAuditContext({
        userId: 'user-123',
        companyId: 'company-abc',
      })

      await logSettingsChange('apiKey', 'old-key-123', 'new-key-456', 'security', mockDb)

      const logs = mockDb._getLogs()
      const afterValue = JSON.parse(logs[0].after_value)

      expect(afterValue.apiKey).toBe('[REDACTED]')
    })

    it('should not log when audit context is not set', async () => {
      const id = await logSettingsChange('theme', 'light', 'dark', 'appearance', mockDb)

      expect(id).toBeNull()
      expect(mockDb.auditLogs.add).not.toHaveBeenCalled()
    })
  })

  describe('logDataExport', () => {
    it('should log a data export', async () => {
      setAuditContext({
        userId: 'user-123',
        companyId: 'company-abc',
      })

      const exportDetails = {
        entityType: 'TRANSACTION' as AuditEntityType,
        format: 'CSV',
        recordCount: 150,
        dateRange: {
          from: Date.now() - 30 * 24 * 60 * 60 * 1000,
          to: Date.now(),
        },
      }

      const id = await logDataExport(exportDetails, mockDb)

      expect(id).toBeTruthy()

      const logs = mockDb._getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('EXPORT')
      expect(logs[0].entity_type).toBe('TRANSACTION')

      const afterValue = JSON.parse(logs[0].after_value)
      expect(afterValue.format).toBe('CSV')
      expect(afterValue.recordCount).toBe(150)
    })

    it('should sanitize export filters', async () => {
      setAuditContext({
        userId: 'user-123',
        companyId: 'company-abc',
      })

      const exportDetails = {
        entityType: 'USER' as AuditEntityType,
        format: 'JSON',
        recordCount: 10,
        filters: {
          role: 'admin',
          password: 'should-be-redacted',
        },
      }

      await logDataExport(exportDetails, mockDb)

      const logs = mockDb._getLogs()
      const afterValue = JSON.parse(logs[0].after_value)

      expect(afterValue.filters.role).toBe('admin')
      expect(afterValue.filters.password).toBe('[REDACTED]')
    })

    it('should not log when audit context is not set', async () => {
      const exportDetails = {
        entityType: 'TRANSACTION' as AuditEntityType,
        format: 'CSV',
        recordCount: 100,
      }

      const id = await logDataExport(exportDetails, mockDb)

      expect(id).toBeNull()
      expect(mockDb.auditLogs.add).not.toHaveBeenCalled()
    })
  })

  describe('queryUserActivity', () => {
    beforeEach(async () => {
      setAuditContext({
        userId: 'user-123',
        companyId: 'company-abc',
      })

      // Add multiple activities
      await logUserActivity(
        'CREATE' as AuditAction,
        'TRANSACTION' as AuditEntityType,
        'txn-1',
        null,
        { amount: 100 },
        mockDb
      )
      await logUserActivity(
        'UPDATE' as AuditAction,
        'ACCOUNT' as AuditEntityType,
        'acc-1',
        { balance: 1000 },
        { balance: 1100 },
        mockDb
      )
      await logUserActivity(
        'DELETE' as AuditAction,
        'PRODUCT' as AuditEntityType,
        'prod-1',
        { name: 'Old Product' },
        null,
        mockDb
      )
    })

    it('should query all activities for a company', async () => {
      const activities = await queryUserActivity('company-abc', mockDb)

      expect(activities).toHaveLength(3)
    })

    it('should filter by action', async () => {
      const activities = await queryUserActivity('company-abc', mockDb, {
        action: 'CREATE' as AuditAction,
      })

      expect(activities).toHaveLength(1)
      expect(activities[0].action).toBe('CREATE')
    })

    it('should filter by entity type', async () => {
      const activities = await queryUserActivity('company-abc', mockDb, {
        entityType: 'ACCOUNT' as AuditEntityType,
      })

      expect(activities).toHaveLength(1)
      expect(activities[0].entity_type).toBe('ACCOUNT')
    })

    it('should apply pagination', async () => {
      const activities = await queryUserActivity('company-abc', mockDb, {
        limit: 2,
        offset: 1,
      })

      expect(activities).toHaveLength(2)
    })
  })

  describe('getUserActivityStats', () => {
    beforeEach(async () => {
      setAuditContext({
        userId: 'user-123',
        companyId: 'company-abc',
      })

      // Add various activities
      await logUserActivity('CREATE' as AuditAction, 'TRANSACTION' as AuditEntityType, 'txn-1', null, {}, mockDb)
      await logUserActivity('CREATE' as AuditAction, 'TRANSACTION' as AuditEntityType, 'txn-2', null, {}, mockDb)
      await logUserActivity('UPDATE' as AuditAction, 'ACCOUNT' as AuditEntityType, 'acc-1', {}, {}, mockDb)
      await logUserActivity('DELETE' as AuditAction, 'PRODUCT' as AuditEntityType, 'prod-1', {}, null, mockDb)
      await logDataExport({ entityType: 'TRANSACTION' as AuditEntityType, format: 'CSV', recordCount: 10 }, mockDb)
      await logSettingsChange('theme', 'light', 'dark', 'appearance', mockDb)
    })

    it('should calculate activity statistics', async () => {
      const stats = await getUserActivityStats('company-abc', undefined, mockDb)

      expect(stats.totalActivities).toBe(6)
      expect(stats.creates).toBe(2)
      expect(stats.updates).toBe(1)
      expect(stats.deletes).toBe(1)
      expect(stats.exports).toBe(1)
      expect(stats.settingsChanges).toBe(1)
    })

    it('should group by entity type', async () => {
      const stats = await getUserActivityStats('company-abc', undefined, mockDb)

      expect(stats.byEntityType.TRANSACTION).toBe(3) // 2 creates + 1 export
      expect(stats.byEntityType.ACCOUNT).toBe(1)
      expect(stats.byEntityType.PRODUCT).toBe(1)
      expect(stats.byEntityType.SETTINGS).toBe(1)
    })

    it('should filter by user ID', async () => {
      setAuditContext({
        userId: 'user-456',
        companyId: 'company-abc',
      })

      await logUserActivity('CREATE' as AuditAction, 'INVOICE' as AuditEntityType, 'inv-1', null, {}, mockDb)

      const statsUser123 = await getUserActivityStats('company-abc', 'user-123', mockDb)
      const statsUser456 = await getUserActivityStats('company-abc', 'user-456', mockDb)

      expect(statsUser123.totalActivities).toBe(6)
      expect(statsUser456.totalActivities).toBe(1)
    })
  })

  describe('getRecentUserActivities', () => {
    it('should return recent activities with limit', async () => {
      setAuditContext({
        userId: 'user-123',
        companyId: 'company-abc',
      })

      // Add 10 activities
      for (let i = 0; i < 10; i++) {
        await logUserActivity(
          'CREATE' as AuditAction,
          'TRANSACTION' as AuditEntityType,
          `txn-${i}`,
          null,
          { amount: i * 10 },
          mockDb
        )
      }

      const recent = await getRecentUserActivities('company-abc', undefined, mockDb, 5)

      expect(recent).toHaveLength(5)
    })
  })

  describe('getUserActivitySummary', () => {
    it('should return comprehensive summary for a user', async () => {
      setAuditContext({
        userId: 'user-123',
        companyId: 'company-abc',
      })

      await logUserActivity('CREATE' as AuditAction, 'TRANSACTION' as AuditEntityType, 'txn-1', null, {}, mockDb)
      await logUserActivity('UPDATE' as AuditAction, 'ACCOUNT' as AuditEntityType, 'acc-1', {}, {}, mockDb)
      await logDataExport({ entityType: 'TRANSACTION' as AuditEntityType, format: 'CSV', recordCount: 50 }, mockDb)

      const summary = await getUserActivitySummary('company-abc', 'user-123', mockDb)

      expect(summary.userId).toBe('user-123')
      expect(summary.totalActivities).toBe(3)
      expect(summary.stats.creates).toBe(1)
      expect(summary.stats.updates).toBe(1)
      expect(summary.stats.exports).toBe(1)
      expect(summary.recentActivities).toHaveLength(3)
    })
  })

  describe('Security and Privacy', () => {
    it('should never log password fields', async () => {
      setAuditContext({
        userId: 'user-123',
        companyId: 'company-abc',
      })

      const userEntity = {
        id: 'user-456',
        username: 'testuser',
        password: 'secretpassword123',
        passwordHash: 'hash123',
        email: 'test@example.com',
      }

      await logUserActivity('CREATE' as AuditAction, 'USER' as AuditEntityType, 'user-456', null, userEntity, mockDb)

      const logs = mockDb._getLogs()
      const afterValue = JSON.parse(logs[0].after_value)

      expect(afterValue.password).toBe('[REDACTED]')
      expect(afterValue.passwordHash).toBe('[REDACTED]')
      expect(afterValue.email).toBe('test@example.com')
    })

    it('should never log encryption keys', async () => {
      setAuditContext({
        userId: 'user-123',
        companyId: 'company-abc',
      })

      const companyEntity = {
        id: 'company-abc',
        name: 'Test Company',
        encryptionKey: 'key123',
        masterKey: 'masterkey456',
        apiKey: 'api789',
      }

      await logUserActivity(
        'UPDATE' as AuditAction,
        'COMPANY' as AuditEntityType,
        'company-abc',
        null,
        companyEntity,
        mockDb
      )

      const logs = mockDb._getLogs()
      const afterValue = JSON.parse(logs[0].after_value)

      expect(afterValue.name).toBe('Test Company')
      expect(afterValue.encryptionKey).toBe('[REDACTED]')
      expect(afterValue.masterKey).toBe('[REDACTED]')
      expect(afterValue.apiKey).toBe('[REDACTED]')
    })

    it('should sanitize nested sensitive data', async () => {
      setAuditContext({
        userId: 'user-123',
        companyId: 'company-abc',
      })

      const entityWithNestedSensitiveData = {
        id: 'entity-123',
        name: 'Test Entity',
        config: {
          apiKey: 'secret-key',
          settings: {
            password: 'nested-password',
            theme: 'dark',
          },
        },
      }

      await logUserActivity(
        'CREATE' as AuditAction,
        'COMPANY' as AuditEntityType,
        'entity-123',
        null,
        entityWithNestedSensitiveData,
        mockDb
      )

      const logs = mockDb._getLogs()
      const afterValue = JSON.parse(logs[0].after_value)

      expect(afterValue.config.apiKey).toBe('[REDACTED]')
      expect(afterValue.config.settings.password).toBe('[REDACTED]')
      expect(afterValue.config.settings.theme).toBe('dark')
    })
  })
})
