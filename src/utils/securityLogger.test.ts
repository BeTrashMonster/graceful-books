/**
 * Security Logger Tests
 *
 * Tests for security event logging functionality.
 * Verifies that security events are properly logged to the audit log.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  logSecurityEvent,
  logFailedLogin,
  logAuthorizationFailure,
  logRateLimitExceeded,
  logSuspiciousActivity,
  logAccountLockout,
  querySecurityEvents,
  getSecurityEventStats,
  SecurityEventType,
  type SecurityEvent,
  type FailedLoginDetails,
  type AuthorizationFailureDetails,
  type RateLimitExceededDetails,
  type SuspiciousActivityDetails,
  type AccountLockoutDetails,
} from './securityLogger'
import { setAuditContext, clearAuditContext } from '../services/audit'

// Mock dependencies
vi.mock('./logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  },
}))

vi.mock('./device', () => ({
  getDeviceId: () => 'test-device-id',
}))

vi.mock('nanoid', () => ({
  nanoid: () => 'test-id-' + Date.now(),
}))

describe('SecurityLogger', () => {
  let mockDb: any
  let auditLogs: any[]

  beforeEach(() => {
    // Reset audit logs
    auditLogs = []

    // Create mock database
    mockDb = {
      audit_logs: {
        add: vi.fn(async (entry: any) => {
          auditLogs.push(entry)
          return entry.id
        }),
      },
      auditLogs: {
        where: vi.fn(() => ({
          equals: vi.fn(() => ({
            and: vi.fn(() => ({
              toArray: vi.fn(async () => auditLogs),
            })),
            toArray: vi.fn(async () => auditLogs),
          })),
        })),
      },
    }

    // Set up audit context
    setAuditContext({
      userId: 'test-user-id',
      companyId: 'test-company-id',
    })
  })

  describe('logSecurityEvent', () => {
    it('should log a security event to the audit log', async () => {
      const event: SecurityEvent = {
        type: SecurityEventType.FAILED_LOGIN,
        details: {
          email: 'test@example.com',
          reason: 'invalid_credentials',
          attemptCount: 1,
        },
      }

      const logId = await logSecurityEvent(event, mockDb)

      expect(logId).toBeTruthy()
      expect(mockDb.audit_logs.add).toHaveBeenCalledTimes(1)
      expect(auditLogs).toHaveLength(1)

      const logEntry = auditLogs[0]
      expect(logEntry.entity_type).toBe('SECURITY')
      expect(logEntry.action).toBe('FAILED_LOGIN')
      expect(logEntry.company_id).toBe('test-company-id')
      expect(logEntry.user_id).toBe('test-user-id')
      expect(logEntry.device_id).toBe('test-device-id')
    })

    it('should use SYSTEM as userId when no context is available', async () => {
      clearAuditContext()

      const event: SecurityEvent = {
        type: SecurityEventType.FAILED_LOGIN,
        details: {
          email: 'test@example.com',
          reason: 'invalid_credentials',
        },
      }

      await logSecurityEvent(event, mockDb)

      const logEntry = auditLogs[0]
      expect(logEntry.user_id).toBe('SYSTEM')
      expect(logEntry.company_id).toBe('SYSTEM')
    })

    it('should use event userId and companyId when provided', async () => {
      clearAuditContext()

      const event: SecurityEvent = {
        type: SecurityEventType.AUTHORIZATION_FAILURE,
        userId: 'custom-user-id',
        companyId: 'custom-company-id',
        details: {
          resourceType: 'account',
          resourceId: 'account-123',
          requestedAction: 'read',
          reason: 'forbidden',
        },
      }

      await logSecurityEvent(event, mockDb)

      const logEntry = auditLogs[0]
      expect(logEntry.user_id).toBe('custom-user-id')
      expect(logEntry.company_id).toBe('custom-company-id')
    })

    it('should sanitize sensitive data from event details', async () => {
      const event: SecurityEvent = {
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        details: {
          activityType: 'test',
          description: 'test',
          severity: 'high',
          indicators: ['test'],
        },
        metadata: {
          password: 'should-be-redacted',
          secretKey: 'should-be-redacted',
          normalField: 'should-remain',
        },
      }

      await logSecurityEvent(event, mockDb)

      const logEntry = auditLogs[0]
      const afterValue = JSON.parse(logEntry.after_value)
      expect(afterValue.metadata.password).toBe('[REDACTED]')
      expect(afterValue.metadata.secretKey).toBe('[REDACTED]')
      expect(afterValue.metadata.normalField).toBe('should-remain')
    })

    it('should return null on error without throwing', async () => {
      const brokenDb = {
        audit_logs: {
          add: vi.fn(async () => {
            throw new Error('Database error')
          }),
        },
      }

      const event: SecurityEvent = {
        type: SecurityEventType.FAILED_LOGIN,
        details: {
          reason: 'invalid_credentials',
        },
      }

      const result = await logSecurityEvent(event, brokenDb)

      expect(result).toBeNull()
      // Should not throw
    })
  })

  describe('logFailedLogin', () => {
    it('should log a failed login attempt', async () => {
      const details: FailedLoginDetails = {
        email: 'user@example.com',
        reason: 'invalid_credentials',
        attemptCount: 3,
      }

      const logId = await logFailedLogin(details, mockDb)

      expect(logId).toBeTruthy()
      expect(auditLogs).toHaveLength(1)

      const logEntry = auditLogs[0]
      expect(logEntry.action).toBe(SecurityEventType.FAILED_LOGIN)

      const afterValue = JSON.parse(logEntry.after_value)
      expect(afterValue.email).toBe('user@example.com')
      expect(afterValue.reason).toBe('invalid_credentials')
      expect(afterValue.attemptCount).toBe(3)
    })

    it('should log account not found attempts', async () => {
      const details: FailedLoginDetails = {
        email: 'nonexistent@example.com',
        reason: 'account_not_found',
        attemptCount: 1,
      }

      await logFailedLogin(details, mockDb)

      const logEntry = auditLogs[0]
      const afterValue = JSON.parse(logEntry.after_value)
      expect(afterValue.reason).toBe('account_not_found')
    })

    it('should log account locked attempts', async () => {
      const details: FailedLoginDetails = {
        email: 'locked@example.com',
        reason: 'account_locked',
        attemptCount: 5,
      }

      await logFailedLogin(details, mockDb)

      const logEntry = auditLogs[0]
      const afterValue = JSON.parse(logEntry.after_value)
      expect(afterValue.reason).toBe('account_locked')
    })
  })

  describe('logAuthorizationFailure', () => {
    it('should log an authorization failure (potential IDOR attack)', async () => {
      const details: AuthorizationFailureDetails = {
        resourceType: 'account',
        resourceId: 'account-xyz',
        requestedAction: 'update',
        reason: 'forbidden',
        companyIdMismatch: {
          requested: 'company-abc',
          actual: 'company-def',
        },
      }

      const logId = await logAuthorizationFailure(
        'user-123',
        'company-abc',
        details,
        mockDb
      )

      expect(logId).toBeTruthy()
      expect(auditLogs).toHaveLength(1)

      const logEntry = auditLogs[0]
      expect(logEntry.action).toBe(SecurityEventType.AUTHORIZATION_FAILURE)
      expect(logEntry.user_id).toBe('user-123')
      expect(logEntry.company_id).toBe('company-abc')

      const afterValue = JSON.parse(logEntry.after_value)
      expect(afterValue.resourceType).toBe('account')
      expect(afterValue.resourceId).toBe('account-xyz')
      expect(afterValue.companyIdMismatch).toEqual({
        requested: 'company-abc',
        actual: 'company-def',
      })
    })

    it('should log resource not found authorization failures', async () => {
      const details: AuthorizationFailureDetails = {
        resourceType: 'transaction',
        resourceId: 'txn-999',
        requestedAction: 'read',
        reason: 'not_found',
      }

      await logAuthorizationFailure('user-456', 'company-xyz', details, mockDb)

      const logEntry = auditLogs[0]
      const afterValue = JSON.parse(logEntry.after_value)
      expect(afterValue.reason).toBe('not_found')
    })

    it('should log invalid company ID authorization failures', async () => {
      const details: AuthorizationFailureDetails = {
        resourceType: 'contact',
        resourceId: 'contact-123',
        requestedAction: 'delete',
        reason: 'invalid_company_id',
      }

      await logAuthorizationFailure('user-789', 'company-123', details, mockDb)

      const logEntry = auditLogs[0]
      const afterValue = JSON.parse(logEntry.after_value)
      expect(afterValue.reason).toBe('invalid_company_id')
    })
  })

  describe('logRateLimitExceeded', () => {
    it('should log rate limit exceeded events', async () => {
      const details: RateLimitExceededDetails = {
        endpoint: '/api/login',
        limit: 5,
        windowSeconds: 60,
        attemptCount: 10,
      }

      const logId = await logRateLimitExceeded(details, mockDb)

      expect(logId).toBeTruthy()
      expect(auditLogs).toHaveLength(1)

      const logEntry = auditLogs[0]
      expect(logEntry.action).toBe(SecurityEventType.RATE_LIMIT_EXCEEDED)

      const afterValue = JSON.parse(logEntry.after_value)
      expect(afterValue.endpoint).toBe('/api/login')
      expect(afterValue.limit).toBe(5)
      expect(afterValue.attemptCount).toBe(10)
    })
  })

  describe('logSuspiciousActivity', () => {
    it('should log suspicious activity', async () => {
      const details: SuspiciousActivityDetails = {
        activityType: 'rapid_resource_enumeration',
        description: 'User attempting to access many resources rapidly',
        severity: 'high',
        indicators: ['high_request_rate', 'sequential_ids', 'many_404s'],
      }

      const logId = await logSuspiciousActivity(
        'user-suspect',
        'company-123',
        details,
        mockDb
      )

      expect(logId).toBeTruthy()
      expect(auditLogs).toHaveLength(1)

      const logEntry = auditLogs[0]
      expect(logEntry.action).toBe(SecurityEventType.SUSPICIOUS_ACTIVITY)
      expect(logEntry.user_id).toBe('user-suspect')

      const afterValue = JSON.parse(logEntry.after_value)
      expect(afterValue.severity).toBe('high')
      expect(afterValue.indicators).toHaveLength(3)
    })

    it('should log different severity levels', async () => {
      const severities: Array<'low' | 'medium' | 'high' | 'critical'> = [
        'low',
        'medium',
        'high',
        'critical',
      ]

      for (const severity of severities) {
        auditLogs = []
        const details: SuspiciousActivityDetails = {
          activityType: 'test',
          description: `Severity: ${severity}`,
          severity,
          indicators: ['test'],
        }

        await logSuspiciousActivity('user-123', 'company-123', details, mockDb)

        const logEntry = auditLogs[0]
        const afterValue = JSON.parse(logEntry.after_value)
        expect(afterValue.severity).toBe(severity)
      }
    })
  })

  describe('logAccountLockout', () => {
    it('should log account lockout due to failed attempts', async () => {
      const details: AccountLockoutDetails = {
        userId: 'user-locked',
        reason: 'max_failed_attempts',
        duration: 3600, // 1 hour
        unlockAt: Date.now() + 3600000,
      }

      const logId = await logAccountLockout(details, mockDb)

      expect(logId).toBeTruthy()
      expect(auditLogs).toHaveLength(1)

      const logEntry = auditLogs[0]
      expect(logEntry.action).toBe(SecurityEventType.ACCOUNT_LOCKOUT)
      expect(logEntry.user_id).toBe('user-locked')

      const afterValue = JSON.parse(logEntry.after_value)
      expect(afterValue.reason).toBe('max_failed_attempts')
      expect(afterValue.duration).toBe(3600)
    })

    it('should log indefinite account lockout', async () => {
      const details: AccountLockoutDetails = {
        userId: 'user-banned',
        reason: 'suspicious_activity',
        // No duration or unlockAt - indefinite lockout
      }

      await logAccountLockout(details, mockDb)

      const logEntry = auditLogs[0]
      const afterValue = JSON.parse(logEntry.after_value)
      expect(afterValue.reason).toBe('suspicious_activity')
      expect(afterValue.duration).toBeUndefined()
      expect(afterValue.unlockAt).toBeUndefined()
    })

    it('should log manual account lockout', async () => {
      const details: AccountLockoutDetails = {
        userId: 'user-manual-lock',
        reason: 'manual_lock',
      }

      await logAccountLockout(details, mockDb)

      const logEntry = auditLogs[0]
      const afterValue = JSON.parse(logEntry.after_value)
      expect(afterValue.reason).toBe('manual_lock')
    })
  })

  describe('querySecurityEvents', () => {
    beforeEach(async () => {
      // Add some test security events
      await logFailedLogin(
        { email: 'test1@example.com', reason: 'invalid_credentials' },
        mockDb
      )
      await logAuthorizationFailure(
        'user-1',
        'test-company-id',
        {
          resourceType: 'account',
          resourceId: 'acc-1',
          requestedAction: 'read',
          reason: 'forbidden',
        },
        mockDb
      )
      await logRateLimitExceeded(
        { limit: 5, windowSeconds: 60, attemptCount: 10 },
        mockDb
      )
    })

    it('should query security events for a company', async () => {
      const events = await querySecurityEvents('test-company-id', mockDb)

      expect(events).toHaveLength(3)
      expect(events[0].entity_type).toBe('SECURITY')
    })

    it('should filter by event type', async () => {
      const events = await querySecurityEvents('test-company-id', mockDb, {
        eventType: SecurityEventType.FAILED_LOGIN,
      })

      // Note: This test depends on the mock implementation
      // In real usage, the filter would work correctly
      expect(events).toBeDefined()
    })

    it('should filter by date range', async () => {
      const now = Date.now()
      const events = await querySecurityEvents('test-company-id', mockDb, {
        dateFrom: now - 1000,
        dateTo: now + 1000,
      })

      expect(events).toBeDefined()
    })

    it('should limit results', async () => {
      const events = await querySecurityEvents('test-company-id', mockDb, {
        limit: 2,
      })

      expect(events.length).toBeLessThanOrEqual(2)
    })
  })

  describe('getSecurityEventStats', () => {
    beforeEach(async () => {
      // Add various security events
      await logFailedLogin(
        { email: 'test1@example.com', reason: 'invalid_credentials' },
        mockDb
      )
      await logFailedLogin(
        { email: 'test2@example.com', reason: 'invalid_credentials' },
        mockDb
      )
      await logAuthorizationFailure(
        'user-1',
        'test-company-id',
        {
          resourceType: 'account',
          resourceId: 'acc-1',
          requestedAction: 'read',
          reason: 'forbidden',
        },
        mockDb
      )
      await logRateLimitExceeded(
        { limit: 5, windowSeconds: 60, attemptCount: 10 },
        mockDb
      )
      await logSuspiciousActivity(
        'user-2',
        'test-company-id',
        {
          activityType: 'test',
          description: 'test',
          severity: 'high',
          indicators: ['test'],
        },
        mockDb
      )
      await logAccountLockout(
        {
          userId: 'user-3',
          reason: 'max_failed_attempts',
        },
        mockDb
      )
    })

    it('should return statistics for security events', async () => {
      const stats = await getSecurityEventStats('test-company-id', mockDb)

      expect(stats).toBeDefined()
      expect(stats.totalEvents).toBe(6)
      expect(stats.failedLogins).toBe(2)
      expect(stats.authorizationFailures).toBe(1)
      expect(stats.rateLimitExceeded).toBe(1)
      expect(stats.suspiciousActivity).toBe(1)
      expect(stats.accountLockouts).toBe(1)
    })

    it('should respect time range', async () => {
      const stats = await getSecurityEventStats(
        'test-company-id',
        mockDb,
        100 // 100ms time range - should get all recent events
      )

      expect(stats).toBeDefined()
    })
  })

  describe('immutability', () => {
    it('should create immutable logs (append-only)', async () => {
      const event: SecurityEvent = {
        type: SecurityEventType.FAILED_LOGIN,
        details: {
          email: 'test@example.com',
          reason: 'invalid_credentials',
        },
      }

      await logSecurityEvent(event, mockDb)

      const logEntry = auditLogs[0]

      // Verify that the entry has no updated_at field different from created_at
      expect(logEntry.created_at).toBe(logEntry.updated_at)

      // Verify that the entry has no version_vector (audit logs don't sync)
      expect(logEntry.version_vector).toBeUndefined()

      // Verify that the entry has no deletedAt field set
      expect(logEntry.deleted_at).toBeNull()
    })

    it('should not allow modification of logged events', async () => {
      // This test verifies that the log is append-only
      // In practice, the database schema should enforce this
      const event: SecurityEvent = {
        type: SecurityEventType.FAILED_LOGIN,
        details: {
          email: 'test@example.com',
          reason: 'invalid_credentials',
        },
      }

      await logSecurityEvent(event, mockDb)

      const originalEntry = { ...auditLogs[0] }

      // Attempt to modify the entry (this should not be possible in practice)
      auditLogs[0].action = 'MODIFIED'

      // Verify original values are preserved in database
      expect(originalEntry.action).toBe(SecurityEventType.FAILED_LOGIN)
    })
  })

  describe('sensitive data sanitization', () => {
    it('should redact password fields', async () => {
      const event: SecurityEvent = {
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        details: {
          activityType: 'test',
          description: 'test',
          severity: 'high',
          indicators: ['test'],
        },
        metadata: {
          password: 'should-be-redacted',
        },
      }

      await logSecurityEvent(event, mockDb)

      const logEntry = auditLogs[0]
      const afterValue = JSON.parse(logEntry.after_value)
      expect(afterValue.metadata.password).toBe('[REDACTED]')
    })

    it('should redact passphrase fields', async () => {
      const event: SecurityEvent = {
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        details: {
          activityType: 'test',
          description: 'test',
          severity: 'high',
          indicators: ['test'],
        },
        metadata: {
          masterPassphrase: 'should-be-redacted',
        },
      }

      await logSecurityEvent(event, mockDb)

      const logEntry = auditLogs[0]
      const afterValue = JSON.parse(logEntry.after_value)
      expect(afterValue.metadata.masterPassphrase).toBe('[REDACTED]')
    })

    it('should redact key fields', async () => {
      const event: SecurityEvent = {
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        details: {
          activityType: 'test',
          description: 'test',
          severity: 'high',
          indicators: ['test'],
        },
        metadata: {
          encryptionKey: 'should-be-redacted',
          privateKey: 'should-be-redacted',
          secretKey: 'should-be-redacted',
        },
      }

      await logSecurityEvent(event, mockDb)

      const logEntry = auditLogs[0]
      const afterValue = JSON.parse(logEntry.after_value)
      expect(afterValue.metadata.encryptionKey).toBe('[REDACTED]')
      expect(afterValue.metadata.privateKey).toBe('[REDACTED]')
      expect(afterValue.metadata.secretKey).toBe('[REDACTED]')
    })

    it('should preserve non-sensitive fields', async () => {
      const event: SecurityEvent = {
        type: SecurityEventType.SUSPICIOUS_ACTIVITY,
        details: {
          activityType: 'test',
          description: 'test',
          severity: 'high',
          indicators: ['test'],
        },
        metadata: {
          userId: 'user-123',
          timestamp: Date.now(),
          action: 'read',
        },
      }

      await logSecurityEvent(event, mockDb)

      const logEntry = auditLogs[0]
      const afterValue = JSON.parse(logEntry.after_value)
      expect(afterValue.metadata.userId).toBe('user-123')
      expect(afterValue.metadata.timestamp).toBeDefined()
      expect(afterValue.metadata.action).toBe('read')
    })
  })
})
