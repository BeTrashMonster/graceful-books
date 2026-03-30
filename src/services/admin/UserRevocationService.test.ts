/**
 * User Revocation Service Tests
 *
 * Tests for complete user revocation with key rotation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  revokeUserAccess,
  verifyRevocationSecurity,
  getRevocationHistory,
} from './UserRevocationService'
import { db } from '../../store/database'
import type { UserEntity, CompanyEntity, AuditLogEntity } from '../../store/types'
import * as KeyRotationService from '../backup/KeyRotationService'

// Mock the KeyRotationService
vi.mock('../backup/KeyRotationService', () => ({
  incrementKeyRotationEpoch: vi.fn(),
}))

const mockCompany: CompanyEntity = {
  id: 'company-1',
  name: 'Test Company',
  legalEntityType: 'llc',
  fiscalYearEnd: { month: 12, day: 31 },
  currency: 'USD',
  timezone: 'America/New_York',
  key_rotation_epoch: 0,
  created_at: Date.now(),
  updated_at: Date.now(),
  deviceId: 'device-1',
  versionVector: {},
  lastModifiedAt: Date.now(),
}

const mockAdminUser: UserEntity = {
  id: 'admin-1',
  companyId: 'company-1',
  email: 'admin@test.com',
  name: 'Admin User',
  role: 'admin',
  phase: 'organize',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  _encrypted: { email: false, name: false },
  deviceId: 'device-1',
  versionVector: {},
  lastModifiedAt: Date.now(),
}

const mockUserToRevoke: UserEntity = {
  id: 'user-to-revoke',
  companyId: 'company-1',
  email: 'revoke@test.com',
  name: 'User To Revoke',
  role: 'bookkeeper',
  phase: 'stabilize',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  _encrypted: { email: false, name: false },
  deviceId: 'device-1',
  versionVector: {},
  lastModifiedAt: Date.now(),
}

const mockRemainingUser: UserEntity = {
  id: 'remaining-user',
  companyId: 'company-1',
  email: 'remaining@test.com',
  name: 'Remaining User',
  role: 'manager',
  phase: 'organize',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  _encrypted: { email: false, name: false },
  deviceId: 'device-1',
  versionVector: {},
  lastModifiedAt: Date.now(),
}

describe('UserRevocationService', () => {
  beforeEach(async () => {
    // Clear database
    await db.users.clear()
    await db.companies.clear()
    await db.auditLogs.clear()
    await db.transactions.clear()
    await db.accounts.clear()
    await db.contacts.clear()
    await db.invoices.clear()
    await db.bills.clear()

    // Add test data
    await db.companies.add(mockCompany)
    await db.users.bulkAdd([mockAdminUser, mockUserToRevoke, mockRemainingUser])

    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await db.users.clear()
    await db.companies.clear()
    await db.auditLogs.clear()
  })

  describe('revokeUserAccess', () => {
    it('should successfully revoke user access', async () => {
      // Mock epoch increment
      vi.mocked(KeyRotationService.incrementKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: 1,
      })

      const result = await revokeUserAccess({
        userId: 'user-to-revoke',
        companyId: 'company-1',
        adminUserId: 'admin-1',
        generateExport: false,
      })

      expect(result.success).toBe(true)
      expect(result.userId).toBe('user-to-revoke')
      expect(result.newEpoch).toBe(1)
      expect(result.reencryptedRecords).toBeGreaterThanOrEqual(0)
      expect(result.notifiedUsers).toBe(2) // Admin + remaining user
    })

    it('should mark user as deleted (soft delete)', async () => {
      vi.mocked(KeyRotationService.incrementKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: 1,
      })

      await revokeUserAccess({
        userId: 'user-to-revoke',
        companyId: 'company-1',
        adminUserId: 'admin-1',
      })

      const revokedUser = await db.users.get('user-to-revoke')
      expect(revokedUser).toBeDefined()
      expect(revokedUser!.deletedAt).toBeDefined()
      expect(revokedUser!.deletedAt).toBeGreaterThan(0)
    })

    it('should increment key rotation epoch', async () => {
      vi.mocked(KeyRotationService.incrementKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: 5,
      })

      await revokeUserAccess({
        userId: 'user-to-revoke',
        companyId: 'company-1',
        adminUserId: 'admin-1',
      })

      expect(KeyRotationService.incrementKeyRotationEpoch).toHaveBeenCalledWith('company-1')
    })

    it('should create audit log entry', async () => {
      vi.mocked(KeyRotationService.incrementKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: 1,
      })

      await revokeUserAccess({
        userId: 'user-to-revoke',
        companyId: 'company-1',
        adminUserId: 'admin-1',
        reason: 'Employee departed',
      })

      const auditLogs = await db.auditLogs.toArray()
      expect(auditLogs.length).toBe(1)

      const log = auditLogs[0]
      expect(log.action).toBe('USER_REVOKED')
      expect(log.userId).toBe('admin-1')
      expect(log.entityId).toBe('user-to-revoke')
      expect(log.entityType).toBe('user')
    })

    it('should return error if user not found', async () => {
      const result = await revokeUserAccess({
        userId: 'nonexistent-user',
        companyId: 'company-1',
        adminUserId: 'admin-1',
      })

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0]).toContain('User not found')
    })

    it('should return warning if user already revoked', async () => {
      // First revocation
      vi.mocked(KeyRotationService.incrementKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: 1,
      })

      await revokeUserAccess({
        userId: 'user-to-revoke',
        companyId: 'company-1',
        adminUserId: 'admin-1',
      })

      // Attempt second revocation
      const result = await revokeUserAccess({
        userId: 'user-to-revoke',
        companyId: 'company-1',
        adminUserId: 'admin-1',
      })

      expect(result.success).toBe(false)
      expect(result.warnings).toBeDefined()
      expect(result.warnings![0]).toContain('already revoked')
    })

    it('should validate required parameters', async () => {
      const result = await revokeUserAccess({
        userId: '',
        companyId: 'company-1',
        adminUserId: 'admin-1',
      })

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0]).toContain('Missing required parameters')
    })

    it('should handle epoch increment failure', async () => {
      vi.mocked(KeyRotationService.incrementKeyRotationEpoch).mockResolvedValue({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to increment epoch',
        },
      })

      const result = await revokeUserAccess({
        userId: 'user-to-revoke',
        companyId: 'company-1',
        adminUserId: 'admin-1',
      })

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0]).toContain('Failed to increment epoch')
    })

    it('should count records for re-encryption', async () => {
      vi.mocked(KeyRotationService.incrementKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: 1,
      })

      // Add some test records
      await db.transactions.bulkAdd([
        {
          id: 'txn-1',
          companyId: 'company-1',
          description: 'Test Transaction',
          date: new Date(),
          amount: 100,
          status: 'pending',
          createdBy: 'user-1',
          lastModifiedAt: Date.now(),
          deviceId: 'device-1',
          versionVector: {},
        },
        {
          id: 'txn-2',
          companyId: 'company-1',
          description: 'Test Transaction 2',
          date: new Date(),
          amount: 200,
          status: 'pending',
          createdBy: 'user-1',
          lastModifiedAt: Date.now(),
          deviceId: 'device-1',
          versionVector: {},
        },
      ])

      const result = await revokeUserAccess({
        userId: 'user-to-revoke',
        companyId: 'company-1',
        adminUserId: 'admin-1',
      })

      expect(result.reencryptedRecords).toBeGreaterThanOrEqual(2)
    })

    it('should include revocation reason in audit log', async () => {
      vi.mocked(KeyRotationService.incrementKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: 1,
      })

      await revokeUserAccess({
        userId: 'user-to-revoke',
        companyId: 'company-1',
        adminUserId: 'admin-1',
        reason: 'Security concern',
      })

      const auditLogs = await db.auditLogs.toArray()
      const log = auditLogs[0]
      const afterValues = JSON.parse(log.afterValues!)
      expect(afterValues.reason).toBe('Security concern')
    })

    it('should track export generation request', async () => {
      vi.mocked(KeyRotationService.incrementKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: 1,
      })

      await revokeUserAccess({
        userId: 'user-to-revoke',
        companyId: 'company-1',
        adminUserId: 'admin-1',
        generateExport: true,
      })

      const auditLogs = await db.auditLogs.toArray()
      const log = auditLogs[0]
      const afterValues = JSON.parse(log.afterValues!)
      expect(afterValues.exportGenerated).toBe(true)
    })
  })

  describe('verifyRevocationSecurity', () => {
    it('should return false for revoked user', async () => {
      // Revoke user
      await db.users.update('user-to-revoke', {
        deletedAt: Date.now(),
      })

      const result = await verifyRevocationSecurity('user-to-revoke', 'company-1')

      expect(result.canAccessData).toBe(false)
      expect(result.reason).toContain('revoked')
    })

    it('should return true for active user', async () => {
      const result = await verifyRevocationSecurity('remaining-user', 'company-1')

      expect(result.canAccessData).toBe(true)
      expect(result.reason).toContain('granted')
    })

    it('should return false for nonexistent user', async () => {
      const result = await verifyRevocationSecurity('nonexistent', 'company-1')

      expect(result.canAccessData).toBe(false)
      expect(result.reason).toContain('not found')
    })

    it('should return false for user with deletedAt set', async () => {
      await db.users.update('user-to-revoke', {
        deletedAt: Date.now(),
      })

      const result = await verifyRevocationSecurity('user-to-revoke', 'company-1')

      expect(result.canAccessData).toBe(false)
      expect(result.reason).toBe('User is revoked (soft deleted)')
    })
  })

  describe('getRevocationHistory', () => {
    it('should return all revocation events for company', async () => {
      vi.mocked(KeyRotationService.incrementKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: 1,
      })

      // Revoke first user
      await revokeUserAccess({
        userId: 'user-to-revoke',
        companyId: 'company-1',
        adminUserId: 'admin-1',
      })

      // Add another user and revoke them
      const anotherUser: UserEntity = {
        id: 'another-user',
        companyId: 'company-1',
        email: 'another@test.com',
        name: 'Another User',
        role: 'bookkeeper',
        phase: 'stabilize',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        _encrypted: { email: false, name: false },
        deviceId: 'device-1',
        versionVector: {},
        lastModifiedAt: Date.now(),
      }
      await db.users.add(anotherUser)

      vi.mocked(KeyRotationService.incrementKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: 2,
      })

      await revokeUserAccess({
        userId: 'another-user',
        companyId: 'company-1',
        adminUserId: 'admin-1',
      })

      const history = await getRevocationHistory('company-1')

      expect(history.length).toBe(2)
      expect(history[0].action).toBe('USER_REVOKED')
      expect(history[1].action).toBe('USER_REVOKED')
    })

    it('should return empty array for company with no revocations', async () => {
      const history = await getRevocationHistory('company-1')
      expect(history.length).toBe(0)
    })

    it('should return revocations in reverse chronological order', async () => {
      vi.mocked(KeyRotationService.incrementKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: 1,
      })

      // First revocation
      await revokeUserAccess({
        userId: 'user-to-revoke',
        companyId: 'company-1',
        adminUserId: 'admin-1',
      })

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Second revocation
      const anotherUser: UserEntity = {
        id: 'another-user',
        companyId: 'company-1',
        email: 'another@test.com',
        name: 'Another User',
        role: 'bookkeeper',
        phase: 'stabilize',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        _encrypted: { email: false, name: false },
        deviceId: 'device-1',
        versionVector: {},
        lastModifiedAt: Date.now(),
      }
      await db.users.add(anotherUser)

      vi.mocked(KeyRotationService.incrementKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: 2,
      })

      await revokeUserAccess({
        userId: 'another-user',
        companyId: 'company-1',
        adminUserId: 'admin-1',
      })

      const history = await getRevocationHistory('company-1')

      expect(history.length).toBe(2)
      // Most recent first
      expect(history[0].entityId).toBe('another-user')
      expect(history[1].entityId).toBe('user-to-revoke')
    })

    it('should only return USER_REVOKED events', async () => {
      vi.mocked(KeyRotationService.incrementKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: 1,
      })

      // Add a revocation
      await revokeUserAccess({
        userId: 'user-to-revoke',
        companyId: 'company-1',
        adminUserId: 'admin-1',
      })

      // Add a different type of audit log
      await db.auditLogs.add({
        id: 'audit-other',
        companyId: 'company-1',
        timestamp: new Date(),
        userId: 'admin-1',
        deviceId: 'device-1',
        entityType: 'transaction',
        entityId: 'txn-1',
        action: 'TRANSACTION_CREATED',
        _encrypted: { beforeValues: false, afterValues: false },
      })

      const history = await getRevocationHistory('company-1')

      expect(history.length).toBe(1)
      expect(history[0].action).toBe('USER_REVOKED')
    })
  })
})
