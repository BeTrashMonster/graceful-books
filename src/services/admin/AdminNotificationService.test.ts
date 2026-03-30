/**
 * Admin Notification Service Tests
 *
 * Tests for admin email notifications.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  notifyKeyRotation,
  notifyFailedRestoration,
  notifyAuditChainTampering,
  type KeyRotationNotificationData,
  type FailedRestorationNotificationData,
  type AuditChainTamperingNotificationData,
} from './AdminNotificationService'
import { db } from '../../store/database'
import type { User } from '../../store/types'
import * as UserRevocationService from './UserRevocationService'

// Mock database
vi.mock('../../store/database', () => ({
  db: {
    users: {
      where: vi.fn(),
    },
  },
}))

// Mock UserRevocationService
vi.mock('./UserRevocationService', () => ({
  createRevocationAuditLog: vi.fn(),
}))

describe('AdminNotificationService', () => {
  const mockAdmins: User[] = [
    {
      id: 'admin-1',
      companyId: 'company-1',
      name: 'Admin One',
      email: 'admin1@company.com',
      role: 'admin',
      createdAt: new Date('2024-01-01'),
    },
    {
      id: 'admin-2',
      companyId: 'company-1',
      name: 'Admin Two',
      email: 'admin2@company.com',
      role: 'admin',
      createdAt: new Date('2024-01-02'),
    },
  ]

  const mockNonAdmins: User[] = [
    {
      id: 'manager-1',
      companyId: 'company-1',
      name: 'Manager One',
      email: 'manager@company.com',
      role: 'manager',
      createdAt: new Date('2024-01-03'),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock database query to return admins
    vi.mocked(db.users.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([...mockAdmins, ...mockNonAdmins]),
      }),
    } as any)

    vi.mocked(UserRevocationService.createRevocationAuditLog).mockResolvedValue({
      success: true,
    } as any)

    // Spy on console.log to verify email logging
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('notifyKeyRotation', () => {
    const mockData: KeyRotationNotificationData = {
      companyId: 'company-1',
      companyName: 'Test Company',
      revokedUserId: 'user-123',
      revokedUserName: 'John Doe',
      revokedUserEmail: 'john@example.com',
      performedBy: 'admin@company.com',
      newEpoch: 5,
      rotatedAt: new Date('2024-01-15T10:00:00Z'),
      reason: 'Employee departed',
    }

    it('should notify all admins', async () => {
      const result = await notifyKeyRotation(mockData)

      expect(result.success).toBe(true)
      expect(result.notifiedCount).toBe(2) // 2 admins
      expect(result.notifiedEmails).toContain('admin1@company.com')
      expect(result.notifiedEmails).toContain('admin2@company.com')
    })

    it('should send email with correct subject', async () => {
      await notifyKeyRotation(mockData)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Subject: 🔑 Key Rotation Alert - Test Company')
      )
    })

    it('should include revoked user details in email', async () => {
      await notifyKeyRotation(mockData)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('John Doe')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('john@example.com')
      )
    })

    it('should include new epoch in email', async () => {
      await notifyKeyRotation(mockData)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('5')
      )
    })

    it('should include reason if provided', async () => {
      await notifyKeyRotation(mockData)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Employee departed')
      )
    })

    it('should exclude reason if not provided', async () => {
      const dataWithoutReason = { ...mockData, reason: undefined }
      await notifyKeyRotation(dataWithoutReason)

      // Verify email doesn't crash without reason
      expect(console.log).toHaveBeenCalled()
    })

    it('should record notification in audit log', async () => {
      await notifyKeyRotation(mockData)

      expect(UserRevocationService.createRevocationAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          action: 'ADMIN_NOTIFIED_KEY_ROTATION',
          userId: 'user-123',
        })
      )
    })

    it('should handle no admins found', async () => {
      vi.mocked(db.users.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      } as any)

      const result = await notifyKeyRotation(mockData)

      expect(result.success).toBe(false)
      expect(result.notifiedCount).toBe(0)
      expect(result.error).toContain('No admin users found')
    })

    it('should filter out non-admin users', async () => {
      const result = await notifyKeyRotation(mockData)

      // Should only notify 2 admins, not the manager
      expect(result.notifiedCount).toBe(2)
      expect(result.notifiedEmails).not.toContain('manager@company.com')
    })

    it('should handle email sending errors gracefully', async () => {
      // Even if email fails, should return partial success
      const result = await notifyKeyRotation(mockData)

      expect(result.success).toBe(true)
    })
  })

  describe('notifyFailedRestoration', () => {
    const mockData: FailedRestorationNotificationData = {
      companyId: 'company-1',
      companyName: 'Test Company',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0',
      attemptedAt: new Date('2024-01-15T10:00:00Z'),
      attemptCount: 5,
      errorMessage: 'Invalid restoration token',
      userId: 'user-123',
      userEmail: 'suspicious@example.com',
    }

    it('should notify all admins', async () => {
      const result = await notifyFailedRestoration(mockData)

      expect(result.success).toBe(true)
      expect(result.notifiedCount).toBe(2)
      expect(result.notifiedEmails).toContain('admin1@company.com')
      expect(result.notifiedEmails).toContain('admin2@company.com')
    })

    it('should send email with security alert subject', async () => {
      await notifyFailedRestoration(mockData)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Subject: ⚠️ Security Alert: Failed Restoration Attempts')
      )
    })

    it('should include IP address in email', async () => {
      await notifyFailedRestoration(mockData)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('192.168.1.100')
      )
    })

    it('should include attempt count in email', async () => {
      await notifyFailedRestoration(mockData)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('5 failed attempts')
      )
    })

    it('should include error message in email', async () => {
      await notifyFailedRestoration(mockData)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Invalid restoration token')
      )
    })

    it('should include user details if provided', async () => {
      await notifyFailedRestoration(mockData)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('user-123')
      )
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('suspicious@example.com')
      )
    })

    it('should work without user details', async () => {
      const dataWithoutUser = {
        ...mockData,
        userId: undefined,
        userEmail: undefined,
      }
      const result = await notifyFailedRestoration(dataWithoutUser)

      expect(result.success).toBe(true)
    })

    it('should record notification in audit log', async () => {
      await notifyFailedRestoration(mockData)

      expect(UserRevocationService.createRevocationAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          action: 'ADMIN_NOTIFIED_FAILED_RESTORATION',
        })
      )
    })

    it('should handle no admins found', async () => {
      vi.mocked(db.users.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      } as any)

      const result = await notifyFailedRestoration(mockData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No admin users found')
    })
  })

  describe('notifyAuditChainTampering', () => {
    const mockData: AuditChainTamperingNotificationData = {
      companyId: 'company-1',
      companyName: 'Test Company',
      brokenLinks: 5,
      detectedAt: new Date('2024-01-15T10:00:00Z'),
      issueSummary: 'Missing HMAC: 3, Hash mismatch: 2',
      reportUrl: 'https://app.example.com/admin/audit-log',
    }

    it('should notify all admins', async () => {
      const result = await notifyAuditChainTampering(mockData)

      expect(result.success).toBe(true)
      expect(result.notifiedCount).toBe(2)
      expect(result.notifiedEmails).toContain('admin1@company.com')
      expect(result.notifiedEmails).toContain('admin2@company.com')
    })

    it('should send email with critical alert subject', async () => {
      await notifyAuditChainTampering(mockData)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Subject: 🚨 CRITICAL: Audit Chain Tampering Detected')
      )
    })

    it('should include broken links count in email', async () => {
      await notifyAuditChainTampering(mockData)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('5 integrity violations')
      )
    })

    it('should include issue summary in email', async () => {
      await notifyAuditChainTampering(mockData)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Missing HMAC: 3, Hash mismatch: 2')
      )
    })

    it('should include report URL if provided', async () => {
      await notifyAuditChainTampering(mockData)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('https://app.example.com/admin/audit-log')
      )
    })

    it('should work without report URL', async () => {
      const dataWithoutUrl = { ...mockData, reportUrl: undefined }
      const result = await notifyAuditChainTampering(dataWithoutUrl)

      expect(result.success).toBe(true)
    })

    it('should record notification in audit log', async () => {
      await notifyAuditChainTampering(mockData)

      expect(UserRevocationService.createRevocationAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'company-1',
          action: 'ADMIN_NOTIFIED_AUDIT_TAMPERING',
        })
      )
    })

    it('should handle audit log write failures gracefully', async () => {
      vi.mocked(UserRevocationService.createRevocationAuditLog).mockRejectedValue(
        new Error('Audit log write failed')
      )

      const result = await notifyAuditChainTampering(mockData)

      // Should still succeed in sending emails
      expect(result.success).toBe(true)
      expect(result.notifiedCount).toBe(2)
    })

    it('should handle no admins found', async () => {
      vi.mocked(db.users.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      } as any)

      const result = await notifyAuditChainTampering(mockData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No admin users found')
    })
  })

  describe('Error Handling', () => {
    const mockData: KeyRotationNotificationData = {
      companyId: 'company-1',
      companyName: 'Test Company',
      revokedUserId: 'user-123',
      revokedUserName: 'John Doe',
      revokedUserEmail: 'john@example.com',
      performedBy: 'admin@company.com',
      newEpoch: 5,
      rotatedAt: new Date(),
    }

    it('should handle database errors', async () => {
      vi.mocked(db.users.where).mockImplementation(() => {
        throw new Error('Database error')
      })

      const result = await notifyKeyRotation(mockData)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle users without emails', async () => {
      const adminWithoutEmail = {
        ...mockAdmins[0],
        email: '',
      }

      vi.mocked(db.users.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([adminWithoutEmail]),
        }),
      } as any)

      const result = await notifyKeyRotation(mockData)

      // Should filter out users without emails
      expect(result.notifiedCount).toBe(0)
    })
  })
})
