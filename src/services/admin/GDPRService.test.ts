/**
 * GDPR Service Tests
 *
 * Tests for GDPR Right to Erasure (Article 17) implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  processGDPRErasureRequest,
  checkErasureEligibility,
  type GDPRErasureRequest,
} from './GDPRService'
import { db } from '../../store/database'
import type { User } from '../../store/types'
import * as RetentionService from '../retention.service'
import * as UserRevocationService from './UserRevocationService'

// Mock database
vi.mock('../../store/database', () => ({
  db: {
    users: {
      get: vi.fn(),
    },
    transactions: {
      get: vi.fn(),
      where: vi.fn(),
      toArray: vi.fn(),
      put: vi.fn(),
    },
    contacts: {
      get: vi.fn(),
      where: vi.fn(),
      toArray: vi.fn(),
      put: vi.fn(),
    },
    invoices: {
      get: vi.fn(),
      where: vi.fn(),
      toArray: vi.fn(),
      put: vi.fn(),
    },
    bills: {
      get: vi.fn(),
      where: vi.fn(),
      toArray: vi.fn(),
      put: vi.fn(),
    },
    receipts: {
      get: vi.fn(),
      where: vi.fn(),
      toArray: vi.fn(),
      put: vi.fn(),
    },
  },
}))

// Mock retention service
vi.mock('../retention.service', () => ({
  purgeRecord: vi.fn(),
  getRetentionPolicy: vi.fn(),
}))

// Mock user revocation service
vi.mock('./UserRevocationService', () => ({
  createRevocationAuditLog: vi.fn(),
}))

// Mock retention types
vi.mock('../../types/retention.types', async () => {
  const actual = await vi.importActual('../../types/retention.types')
  return {
    ...actual,
    LEGAL_MINIMUM_RETENTION_DAYS: 2555, // 7 years
    isEligibleForPurge: vi.fn(),
  }
})

import * as RetentionTypes from '../../types/retention.types'

describe('GDPRService', () => {
  const mockAdminUser: User = {
    id: 'admin-1',
    companyId: 'company-1',
    name: 'Admin User',
    email: 'admin@company.com',
    role: 'admin',
    createdAt: new Date('2024-01-01'),
  }

  const mockTargetUser: User = {
    id: 'user-123',
    companyId: 'company-1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'manager',
    createdAt: new Date('2024-01-01'),
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock users.get
    vi.mocked(db.users.get).mockImplementation(async (id: string) => {
      if (id === 'admin-1') return mockAdminUser
      if (id === 'user-123') return mockTargetUser
      return undefined
    })

    // Mock getRetentionPolicy
    vi.mocked(RetentionService.getRetentionPolicy).mockResolvedValue({
      id: 'policy-1',
      company_id: 'company-1',
      entity_type: 'TRANSACTION',
      retention_days: 365,
      enforce_minimum: true,
      is_active: true,
      created_by: 'admin-1',
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      last_modified_by: null,
      description: null,
    })

    // Mock createRevocationAuditLog
    vi.mocked(UserRevocationService.createRevocationAuditLog).mockResolvedValue({
      success: true,
    } as any)

    // Mock purgeRecord
    vi.mocked(RetentionService.purgeRecord).mockResolvedValue({
      entity_id: 'record-1',
      entity_type: 'TRANSACTION',
      success: true,
      error: null,
      deletion_method: 'SECURE_DELETE',
    })

    // Mock database queries
    const mockWhere = {
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    }

    vi.mocked(db.transactions.where).mockReturnValue(mockWhere as any)
    vi.mocked(db.contacts.where).mockReturnValue(mockWhere as any)
    vi.mocked(db.invoices.where).mockReturnValue(mockWhere as any)
    vi.mocked(db.bills.where).mockReturnValue(mockWhere as any)
    vi.mocked(db.receipts.where).mockReturnValue(mockWhere as any)
  })

  describe('processGDPRErasureRequest', () => {
    it('should require admin role to process erasure request', async () => {
      const nonAdminUser: User = {
        ...mockAdminUser,
        id: 'manager-1',
        role: 'manager',
      }

      vi.mocked(db.users.get).mockImplementation(async (id: string) => {
        if (id === 'manager-1') return nonAdminUser
        if (id === 'user-123') return mockTargetUser
        return undefined
      })

      const request: GDPRErasureRequest = {
        companyId: 'company-1',
        userId: 'user-123',
        userEmail: 'john@example.com',
        requestedBy: 'manager-1', // Non-admin
        reason: 'User requested deletion',
      }

      const result = await processGDPRErasureRequest(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only admins')
    })

    it('should verify user exists', async () => {
      const request: GDPRErasureRequest = {
        companyId: 'company-1',
        userId: 'non-existent-user',
        userEmail: 'fake@example.com',
        requestedBy: 'admin-1',
      }

      const result = await processGDPRErasureRequest(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('User not found')
    })

    it('should delete eligible records', async () => {
      // Mock a soft-deleted transaction that's eligible for purge
      const oldTransaction = {
        id: 'txn-1',
        companyId: 'company-1',
        createdBy: 'user-123',
        deletedAt: Date.now() - 366 * 24 * 60 * 60 * 1000, // 1+ year ago
        amount: 100,
      }

      vi.mocked(db.transactions.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([oldTransaction]),
        }),
      } as any)

      vi.mocked(RetentionTypes.isEligibleForPurge).mockReturnValue(true)

      const request: GDPRErasureRequest = {
        companyId: 'company-1',
        userId: 'user-123',
        userEmail: 'john@example.com',
        requestedBy: 'admin-1',
        reason: 'User requested deletion',
      }

      const result = await processGDPRErasureRequest(request)

      expect(result.success).toBe(true)
      expect(result.recordsDeleted).toBeGreaterThan(0)
      expect(RetentionService.purgeRecord).toHaveBeenCalled()
    })

    it('should anonymize protected records when requested', async () => {
      // Mock a recent soft-deleted transaction (protected by 7-year rule)
      const recentTransaction = {
        id: 'txn-1',
        companyId: 'company-1',
        createdBy: 'user-123',
        deletedAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        amount: 100,
        name: 'John Doe',
        memo: 'Payment from John',
      }

      vi.mocked(db.transactions.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([recentTransaction]),
        }),
      } as any)

      // Mock get/put for anonymization
      vi.mocked(db.transactions.get).mockResolvedValue(recentTransaction as any)
      vi.mocked(db.transactions.put).mockResolvedValue('txn-1')

      vi.mocked(RetentionTypes.isEligibleForPurge).mockReturnValue(false)

      const request: GDPRErasureRequest = {
        companyId: 'company-1',
        userId: 'user-123',
        userEmail: 'john@example.com',
        requestedBy: 'admin-1',
        reason: 'User requested deletion',
        anonymize: true,
      }

      const result = await processGDPRErasureRequest(request)

      expect(result.success).toBe(true)
      expect(result.recordsProtected).toBeGreaterThan(0)
      expect(result.warnings?.some((w) => w.includes('7-year retention'))).toBe(true)
    })

    it('should create audit log for erasure request', async () => {
      const request: GDPRErasureRequest = {
        companyId: 'company-1',
        userId: 'user-123',
        userEmail: 'john@example.com',
        requestedBy: 'admin-1',
        reason: 'User requested deletion',
      }

      await processGDPRErasureRequest(request)

      expect(UserRevocationService.createRevocationAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          action: 'GDPR_ERASURE_REQUEST_PROCESSED',
          userId: 'user-123',
          performedBy: 'admin-1',
        })
      )
    })

    it('should calculate days until full deletion', async () => {
      const recentTransaction = {
        id: 'txn-1',
        companyId: 'company-1',
        createdBy: 'user-123',
        deletedAt: Date.now() - 100 * 24 * 60 * 60 * 1000, // 100 days ago
        amount: 100,
      }

      vi.mocked(db.transactions.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([recentTransaction]),
        }),
      } as any)

      // Mock get/put for anonymization
      vi.mocked(db.transactions.get).mockResolvedValue(recentTransaction as any)
      vi.mocked(db.transactions.put).mockResolvedValue('txn-1')

      vi.mocked(RetentionTypes.isEligibleForPurge).mockReturnValue(false)

      const request: GDPRErasureRequest = {
        companyId: 'company-1',
        userId: 'user-123',
        userEmail: 'john@example.com',
        requestedBy: 'admin-1',
      }

      const result = await processGDPRErasureRequest(request)

      expect(result.daysUntilFullDeletion).not.toBeNull()
      expect(result.daysUntilFullDeletion).toBeGreaterThan(0)
    })

    it('should provide detailed breakdown by entity type', async () => {
      const request: GDPRErasureRequest = {
        companyId: 'company-1',
        userId: 'user-123',
        userEmail: 'john@example.com',
        requestedBy: 'admin-1',
      }

      const result = await processGDPRErasureRequest(request)

      expect(result.details).toBeDefined()
      expect(result.details.length).toBeGreaterThan(0)
      expect(result.details[0]).toHaveProperty('entityType')
      expect(result.details[0]).toHaveProperty('deleted')
      expect(result.details[0]).toHaveProperty('anonymized')
      expect(result.details[0]).toHaveProperty('protected')
    })

    it('should skip non-soft-deleted records', async () => {
      // Mock an active (not soft-deleted) transaction
      const activeTransaction = {
        id: 'txn-1',
        companyId: 'company-1',
        createdBy: 'user-123',
        deletedAt: null, // Not soft-deleted
        amount: 100,
      }

      vi.mocked(db.transactions.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([activeTransaction]),
        }),
      } as any)

      const request: GDPRErasureRequest = {
        companyId: 'company-1',
        userId: 'user-123',
        userEmail: 'john@example.com',
        requestedBy: 'admin-1',
      }

      const result = await processGDPRErasureRequest(request)

      // Should not attempt to delete active records
      expect(RetentionService.purgeRecord).not.toHaveBeenCalled()
      expect(result.details[0].errors.length).toBeGreaterThan(0)
    })
  })

  describe('checkErasureEligibility', () => {
    it('should return true if all records are eligible', async () => {
      vi.mocked(db.transactions.toArray).mockResolvedValue([])
      vi.mocked(db.invoices.toArray).mockResolvedValue([])
      vi.mocked(db.bills.toArray).mockResolvedValue([])

      const result = await checkErasureEligibility('company-1', 'user-123')

      expect(result.canFullyDelete).toBe(true)
      expect(result.daysUntilEligible).toBeNull()
      expect(result.protectedRecords).toBe(0)
    })

    it('should return false if records within 7-year retention', async () => {
      const recentTransaction = {
        id: 'txn-1',
        companyId: 'company-1',
        createdBy: 'user-123',
        deletedAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
      }

      vi.mocked(db.transactions.toArray).mockResolvedValue([recentTransaction])
      vi.mocked(db.invoices.toArray).mockResolvedValue([])
      vi.mocked(db.bills.toArray).mockResolvedValue([])

      const result = await checkErasureEligibility('company-1', 'user-123')

      expect(result.canFullyDelete).toBe(false)
      expect(result.protectedRecords).toBeGreaterThan(0)
      expect(result.daysUntilEligible).toBeGreaterThan(0)
    })

    it('should provide helpful details', async () => {
      const result = await checkErasureEligibility('company-1', 'user-123')

      expect(result.details).toBeDefined()
      expect(result.details.length).toBeGreaterThan(0)
    })
  })

  describe('GDPR Compliance', () => {
    it('should respect 7-year retention for financial records', async () => {
      const financialRecord = {
        id: 'txn-1',
        companyId: 'company-1',
        createdBy: 'user-123',
        deletedAt: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
        amount: 1000,
      }

      vi.mocked(db.transactions.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([financialRecord]),
        }),
      } as any)

      // Mock get/put for anonymization
      vi.mocked(db.transactions.get).mockResolvedValue(financialRecord as any)
      vi.mocked(db.transactions.put).mockResolvedValue('txn-1')

      // Financial records protected for 7 years
      vi.mocked(RetentionTypes.isEligibleForPurge).mockReturnValue(false)

      const request: GDPRErasureRequest = {
        companyId: 'company-1',
        userId: 'user-123',
        userEmail: 'john@example.com',
        requestedBy: 'admin-1',
        anonymize: true,
      }

      const result = await processGDPRErasureRequest(request)

      expect(result.recordsDeleted).toBe(0)
      expect(result.recordsProtected).toBeGreaterThan(0)
      expect(result.warnings?.some((w) => w.includes('7-year'))).toBe(true)
    })

    it('should allow anonymization of protected records', async () => {
      const protectedRecord = {
        id: 'txn-1',
        companyId: 'company-1',
        createdBy: 'user-123',
        deletedAt: Date.now() - 100 * 24 * 60 * 60 * 1000,
        name: 'John Doe',
        email: 'john@example.com',
        amount: 1000,
      }

      vi.mocked(db.transactions.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([protectedRecord]),
        }),
      } as any)

      // Mock get for anonymization
      vi.mocked(db.transactions.get).mockResolvedValue(protectedRecord as any)

      // Mock put for anonymization
      vi.mocked(db.transactions.put).mockResolvedValue('txn-1')

      vi.mocked(RetentionTypes.isEligibleForPurge).mockReturnValue(false)

      const request: GDPRErasureRequest = {
        companyId: 'company-1',
        userId: 'user-123',
        userEmail: 'john@example.com',
        requestedBy: 'admin-1',
        anonymize: true,
      }

      const result = await processGDPRErasureRequest(request)

      expect(result.recordsAnonymized).toBeGreaterThan(0)
      expect(result.warnings?.some((w) => w.includes('anonymized'))).toBe(true)
    })
  })
})
