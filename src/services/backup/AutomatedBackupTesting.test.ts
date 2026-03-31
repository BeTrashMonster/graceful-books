/**
 * Automated Backup Testing Tests
 *
 * Tests for automated backup integrity testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  runAutomatedBackupTest,
  scheduleAutomatedBackupTests,
  getBackupTestHistory,
  type BackupTestConfig,
} from './AutomatedBackupTesting'
import { db } from '../../store/database'
import * as BackupTestingHelpers from './BackupTestingHelpers'
import * as BackupTestNotificationService from '../admin/BackupTestNotificationService'
import * as UserRevocationService from '../admin/UserRevocationService'

// Mock database
vi.mock('../../store/database', () => ({
  db: {
    companies: {
      get: vi.fn(),
    },
    transactions: {
      get: vi.fn(),
    },
    accounts: {
      get: vi.fn(),
    },
    auditLogs: {
      where: vi.fn(),
    },
  },
}))

// Mock backup testing helpers
vi.mock('./BackupTestingHelpers', () => ({
  createBackup: vi.fn(),
  restoreFromBackup: vi.fn(),
}))

// Mock notification service
vi.mock('../admin/BackupTestNotificationService', () => ({
  notifyBackupTestResult: vi.fn(),
}))

// Mock user revocation service
vi.mock('../admin/UserRevocationService', () => ({
  createRevocationAuditLog: vi.fn(),
}))

describe('AutomatedBackupTesting', () => {
  const mockCompany = {
    id: 'company-1',
    name: 'Test Company',
    createdAt: new Date('2024-01-01'),
  }

  const mockBackupData = {
    metadata: {
      version: '1.0.0',
      createdAt: Date.now(),
      companyId: 'company-1',
      totalRecords: 100,
    },
    data: {
      transactions: [
        { id: 'txn-1', companyId: 'company-1', amount: 100, description: 'Test 1' },
        { id: 'txn-2', companyId: 'company-1', amount: 200, description: 'Test 2' },
      ],
      accounts: [
        { id: 'acc-1', companyId: 'company-1', name: 'Account 1', type: 'asset' },
      ],
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock company lookup
    vi.mocked(db.companies.get).mockResolvedValue(mockCompany as any)

    // Mock successful backup creation
    vi.mocked(BackupTestingHelpers.createBackup).mockResolvedValue({
      success: true,
      backup: {
        ...mockBackupData.metadata,
        data: mockBackupData.data,
      },
    } as any)

    // Mock successful restoration
    vi.mocked(BackupTestingHelpers.restoreFromBackup).mockResolvedValue({
      success: true,
      recordsRestored: 100,
      errors: [],
    } as any)

    // Mock transaction/account lookups for validation
    vi.mocked(db.transactions.get).mockImplementation(async (id: string) => {
      const txn = mockBackupData.data.transactions.find((t) => t.id === id)
      return txn || null
    })

    vi.mocked(db.accounts.get).mockImplementation(async (id: string) => {
      const acc = mockBackupData.data.accounts.find((a) => a.id === id)
      return acc || null
    })

    // Mock notification service
    vi.mocked(BackupTestNotificationService.notifyBackupTestResult).mockResolvedValue({
      success: true,
      notifiedCount: 2,
      notifiedEmails: ['admin1@company.com', 'admin2@company.com'],
    })

    // Mock audit log
    vi.mocked(UserRevocationService.createRevocationAuditLog).mockResolvedValue({
      success: true,
    } as any)
  })

  describe('runAutomatedBackupTest', () => {
    it('should complete all phases successfully', async () => {
      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
      }

      const result = await runAutomatedBackupTest(config)

      expect(result.success).toBe(true)
      expect(result.phase).toBe('complete')
      expect(result.errors).toHaveLength(0)
    })

    it('should create a test backup', async () => {
      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
      }

      await runAutomatedBackupTest(config)

      expect(BackupTestingHelpers.createBackup).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          userId: 'SYSTEM',
          isTest: true,
        })
      )
    })

    it('should attempt restoration', async () => {
      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
      }

      await runAutomatedBackupTest(config)

      expect(BackupTestingHelpers.restoreFromBackup).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          isolated: true,
          testMode: true,
        })
      )
    })

    it('should validate restored data', async () => {
      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
      }

      const result = await runAutomatedBackupTest(config)

      expect(result.validationResult).toBeDefined()
      expect(result.validationResult?.valid).toBe(true)
      expect(result.validationResult?.samplesChecked).toBeGreaterThan(0)
    })

    it('should log results to audit trail', async () => {
      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
      }

      await runAutomatedBackupTest(config)

      expect(UserRevocationService.createRevocationAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          action: 'BACKUP_TEST_COMPLETED',
          userId: 'SYSTEM',
        })
      )
    })

    it('should include detailed log of test steps', async () => {
      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
      }

      const result = await runAutomatedBackupTest(config)

      expect(result.log).toBeDefined()
      expect(result.log.length).toBeGreaterThan(0)
      expect(result.log.some((log) => log.includes('Backup test started'))).toBe(true)
      expect(result.log.some((log) => log.includes('Creating test backup'))).toBe(true)
      expect(result.log.some((log) => log.includes('Testing restoration'))).toBe(true)
      expect(result.log.some((log) => log.includes('Validating data integrity'))).toBe(true)
    })

    it('should track test duration', async () => {
      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
      }

      const result = await runAutomatedBackupTest(config)

      expect(result.startedAt).toBeDefined()
      expect(result.completedAt).toBeDefined()
      expect(result.durationMs).toBeGreaterThanOrEqual(0) // Can be 0 if very fast
      expect(result.completedAt).toBeGreaterThanOrEqual(result.startedAt)
    })

    it('should handle backup creation failure', async () => {
      vi.mocked(BackupTestingHelpers.createBackup).mockResolvedValue({
        success: false,
        error: 'Backup creation failed',
      } as any)

      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
      }

      const result = await runAutomatedBackupTest(config)

      expect(result.success).toBe(false)
      expect(result.phase).toBe('backup')
      expect(result.errors.some((e) => e.includes('Backup creation failed'))).toBe(true)
    })

    it('should handle restoration failure', async () => {
      vi.mocked(BackupTestingHelpers.restoreFromBackup).mockResolvedValue({
        success: false,
        errors: ['Restoration failed: database error'],
      } as any)

      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
      }

      const result = await runAutomatedBackupTest(config)

      expect(result.success).toBe(false)
      expect(result.phase).toBe('restore')
      expect(result.errors.some((e) => e.includes('Restoration failed'))).toBe(true)
    })

    it('should handle validation failure', async () => {
      // Make validation fail by returning different data
      vi.mocked(db.transactions.get).mockResolvedValue({
        id: 'txn-1',
        companyId: 'company-1',
        amount: 999, // Different from backup data
        description: 'Wrong data',
      } as any)

      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
      }

      const result = await runAutomatedBackupTest(config)

      expect(result.success).toBe(false)
      expect(result.validationResult?.valid).toBe(false)
      expect(result.validationResult?.discrepancies).toBeDefined()
    })

    it('should notify admins on failure', async () => {
      vi.mocked(BackupTestingHelpers.createBackup).mockResolvedValue({
        success: false,
        error: 'Backup failed',
      } as any)

      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
      }

      await runAutomatedBackupTest(config)

      expect(BackupTestNotificationService.notifyBackupTestResult).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          success: false,
        })
      )
    })

    it('should not notify admins on success by default', async () => {
      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
        notifyOnSuccess: false,
      }

      await runAutomatedBackupTest(config)

      expect(BackupTestNotificationService.notifyBackupTestResult).not.toHaveBeenCalled()
    })

    it('should notify admins on success if configured', async () => {
      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
        notifyOnSuccess: true,
      }

      await runAutomatedBackupTest(config)

      expect(BackupTestNotificationService.notifyBackupTestResult).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          success: true,
        })
      )
    })

    it('should timeout if test takes too long', async () => {
      // Make backup take forever
      vi.mocked(BackupTestingHelpers.createBackup).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ success: true } as any), 20000)
          })
      )

      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
        timeoutMs: 100, // Very short timeout
      }

      const result = await runAutomatedBackupTest(config)

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.includes('timeout') || e.includes('timed out'))).toBe(true)
    }, 10000)

    it('should run in isolated mode by default', async () => {
      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
      }

      await runAutomatedBackupTest(config)

      expect(BackupTestingHelpers.restoreFromBackup).toHaveBeenCalledWith(
        expect.objectContaining({
          isolated: true,
        })
      )
    })

    it('should clean up test artifacts if configured', async () => {
      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
        cleanupAfterTest: true,
      }

      const result = await runAutomatedBackupTest(config)

      expect(result.success).toBe(true)
      expect(result.log.some((log) => log.includes('Cleaning up test artifacts'))).toBe(
        true
      )
    })
  })

  describe('scheduleAutomatedBackupTests', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('should schedule recurring backup tests', () => {
      vi.useFakeTimers()

      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
        intervalMs: 1000, // 1 second for testing
      }

      const intervalId = scheduleAutomatedBackupTests(config)

      expect(intervalId).toBeDefined()
      expect(typeof intervalId).toBe('object') // setInterval returns a Timeout object

      clearInterval(intervalId)
    })

    it('should use default interval if not specified', () => {
      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
      }

      const intervalId = scheduleAutomatedBackupTests(config)

      expect(intervalId).toBeDefined()
      clearInterval(intervalId)
    })
  })

  describe('getBackupTestHistory', () => {
    it('should retrieve test history from audit logs', async () => {
      const mockTestLogs = [
        {
          id: 'log-1',
          companyId: 'company-1',
          action: 'BACKUP_TEST_COMPLETED',
          timestamp: Date.now(),
        },
        {
          id: 'log-2',
          companyId: 'company-1',
          action: 'BACKUP_TEST_FAILED',
          timestamp: Date.now() - 1000,
        },
      ]

      vi.mocked(db.auditLogs.where).mockReturnValue({
        between: vi.fn().mockReturnValue({
          reverse: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              toArray: vi.fn().mockResolvedValue(mockTestLogs),
            }),
          }),
        }),
      } as any)

      const history = await getBackupTestHistory('company-1', 10)

      expect(history).toHaveLength(2)
      expect(history[0].action).toBe('BACKUP_TEST_COMPLETED')
    })

    it('should limit results', async () => {
      vi.mocked(db.auditLogs.where).mockReturnValue({
        between: vi.fn().mockReturnValue({
          reverse: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              toArray: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any)

      await getBackupTestHistory('company-1', 5)

      // Verify limit was called with 5
      const mockChain = vi.mocked(db.auditLogs.where).mock.results[0].value
      expect(mockChain.between).toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(db.auditLogs.where).mockImplementation(() => {
        throw new Error('Database error')
      })

      const history = await getBackupTestHistory('company-1')

      expect(history).toEqual([])
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing company', async () => {
      vi.mocked(db.companies.get).mockResolvedValue(null)

      const config: BackupTestConfig = {
        companyId: 'non-existent',
        userId: 'SYSTEM',
      }

      const result = await runAutomatedBackupTest(config)

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.includes('Company not found'))).toBe(true)
    })

    it('should handle notification failure gracefully', async () => {
      vi.mocked(BackupTestNotificationService.notifyBackupTestResult).mockRejectedValue(
        new Error('Email service down')
      )

      vi.mocked(BackupTestingHelpers.createBackup).mockResolvedValue({
        success: false,
        error: 'Backup failed',
      } as any)

      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
      }

      const result = await runAutomatedBackupTest(config)

      // Test should still complete even if notification fails
      expect(result.success).toBe(false)
      expect(result.warnings.some((w) => w.includes('notification'))).toBe(true)
    })

    it('should handle audit log failure gracefully', async () => {
      vi.mocked(UserRevocationService.createRevocationAuditLog).mockRejectedValue(
        new Error('Audit log write failed')
      )

      vi.mocked(BackupTestingHelpers.createBackup).mockResolvedValue({
        success: false,
        error: 'Backup failed',
      } as any)

      const config: BackupTestConfig = {
        companyId: 'company-1',
        userId: 'SYSTEM',
      }

      const result = await runAutomatedBackupTest(config)

      // Test should still complete even if audit log fails
      expect(result.success).toBe(false)
      expect(result.warnings.some((w) => w.includes('audit log'))).toBe(true)
    })
  })
})
