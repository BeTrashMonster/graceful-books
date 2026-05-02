/**
 * Secure Data Export Service Tests
 *
 * S7-3: Secure Data Export - Test coverage
 *
 * Tests all security controls for data export:
 * - Authentication requirements
 * - Rate limiting
 * - Warning acknowledgment
 * - Activity logging
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  secureDataExport,
  getExportQuotaStatus,
  canUserExport,
  EXPORT_SECURITY_WARNINGS,
} from './secureDataExport.service'
import type { SecureExportRequest } from './secureDataExport.service'
import type { CSVExportConfig, CSVExportResult } from '../types/csv.types'
import { AppError } from '../utils/errors'

// Mock dependencies
vi.mock('../db/database', () => ({
  getDatabase: vi.fn(() => ({
    audit_logs: {
      add: vi.fn(async () => 'audit-log-123'),
    },
  })),
}))

vi.mock('../auth/session', () => ({
  getActiveSession: vi.fn(() => ({
    userId: 'user-123',
    companyId: 'company-abc',
    token: 'session-token',
  })),
}))

vi.mock('../utils/securityLogger', () => ({
  logDataExport: vi.fn(async () => 'audit-log-123'),
}))

vi.mock('../utils/rateLimiter', () => {
  const actualRateLimiter = {
    check: vi.fn(async () => ({
      allowed: true,
      remaining: 9,
      resetsAt: Date.now() + 3600000,
    })),
    checkWithLogging: vi.fn(async () => ({
      allowed: true,
      remaining: 9,
      resetsAt: Date.now() + 3600000,
    })),
    getQuotaStatus: vi.fn(() => ({
      remaining: 9,
      maxOperations: 10,
      resetsAt: Date.now() + 3600000,
    })),
  }

  return {
    rateLimiter: actualRateLimiter,
    RateLimitError: class RateLimitError extends Error {
      constructor(public operationKey: string, public waitTimeMs: number) {
        super(`Rate limit exceeded for ${operationKey}`)
        this.name = 'RateLimitError'
      }
    },
    SECURITY_RATE_LIMITS: {
      dataExport: {
        maxOperations: 10,
        windowMs: 3600000,
      },
    },
  }
})

describe('secureDataExport', () => {
  let mockExportFunction: vi.Mock

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock export function
    mockExportFunction = vi.fn(async (_config: CSVExportConfig): Promise<CSVExportResult> => ({
      success: true,
      filename: 'test_export.csv',
      csvContent: 'header1,header2\nvalue1,value2',
      rowCount: 1,
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const { getActiveSession } = await import('../auth/session')
      vi.mocked(getActiveSession).mockReturnValueOnce(null)

      const request: SecureExportRequest = {
        entityType: 'transactions',
        warningAcknowledged: true,
      }

      await expect(secureDataExport(request, mockExportFunction)).rejects.toThrow(AppError)
      await expect(secureDataExport(request, mockExportFunction)).rejects.toThrow(
        /authentication required/i
      )
    })

    it('should reject session without userId', async () => {
      const { getActiveSession } = await import('../auth/session')
      vi.mocked(getActiveSession).mockReturnValueOnce({
        userId: '',
        companyId: 'company-abc',
        token: 'token',
      } as any)

      const request: SecureExportRequest = {
        entityType: 'transactions',
        warningAcknowledged: true,
      }

      await expect(secureDataExport(request, mockExportFunction)).rejects.toThrow(AppError)
    })

    it('should reject session without companyId', async () => {
      const { getActiveSession } = await import('../auth/session')
      vi.mocked(getActiveSession).mockReturnValueOnce({
        userId: 'user-123',
        companyId: '',
        token: 'token',
      } as any)

      const request: SecureExportRequest = {
        entityType: 'transactions',
        warningAcknowledged: true,
      }

      await expect(secureDataExport(request, mockExportFunction)).rejects.toThrow(AppError)
    })
  })

  describe('Warning Acknowledgment', () => {
    it('should require warning acknowledgment', async () => {
      const request: SecureExportRequest = {
        entityType: 'transactions',
        warningAcknowledged: false,
      }

      await expect(secureDataExport(request, mockExportFunction)).rejects.toThrow(AppError)
      await expect(secureDataExport(request, mockExportFunction)).rejects.toThrow(
        /security warning not acknowledged/i
      )
    })

    it('should succeed when warning is acknowledged', async () => {
      const request: SecureExportRequest = {
        entityType: 'transactions',
        warningAcknowledged: true,
      }

      const result = await secureDataExport(request, mockExportFunction)

      expect(result.success).toBe(true)
      expect(mockExportFunction).toHaveBeenCalled()
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const { rateLimiter } = await import('../utils/rateLimiter')
      // Mock rate limiter to reject the request
      vi.mocked(rateLimiter.checkWithLogging).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetsAt: Date.now() + 3600000,
        waitTimeMs: 3600000,
      })

      const request: SecureExportRequest = {
        entityType: 'transactions',
        warningAcknowledged: true,
      }

      // Should throw RateLimitError when rate limit exceeded
      await expect(
        secureDataExport(request, mockExportFunction)
      ).rejects.toThrow('Rate limit exceeded')
    })

    it('should include rate limit info in result', async () => {
      const { rateLimiter } = await import('../utils/rateLimiter')
      const mockResetsAt = Date.now() + 3600000
      vi.mocked(rateLimiter.checkWithLogging).mockResolvedValueOnce({
        allowed: true,
        remaining: 5,
        resetsAt: mockResetsAt,
      })

      const request: SecureExportRequest = {
        entityType: 'transactions',
        warningAcknowledged: true,
      }

      const result = await secureDataExport(request, mockExportFunction)

      expect(result.rateLimit).toBeDefined()
      expect(result.rateLimit?.remaining).toBeGreaterThanOrEqual(0)
      expect(result.rateLimit?.resetsAt).toBeGreaterThan(Date.now())
    })

    it('should allow export when quota available', async () => {
      const { rateLimiter } = await import('../utils/rateLimiter')
      vi.mocked(rateLimiter.checkWithLogging).mockResolvedValueOnce({
        allowed: true,
        remaining: 9,
        resetsAt: Date.now() + 3600000,
      })

      const request: SecureExportRequest = {
        entityType: 'transactions',
        warningAcknowledged: true,
      }

      const result = await secureDataExport(request, mockExportFunction)

      expect(result.success).toBe(true)
      expect(mockExportFunction).toHaveBeenCalled()
    })
  })

  describe('Activity Logging', () => {
    it('should log successful exports', async () => {
      const { logDataExport } = await import('../utils/securityLogger')

      const request: SecureExportRequest = {
        entityType: 'transactions',
        warningAcknowledged: true,
      }

      const result = await secureDataExport(request, mockExportFunction)

      expect(result.success).toBe(true)
      expect(logDataExport).toHaveBeenCalledWith(
        'user-123',
        'company-abc',
        expect.objectContaining({
          entityType: 'transactions',
          exportFormat: 'csv',
          recordCount: 1,
          warningAcknowledged: true,
        }),
        expect.any(Object)
      )
    })

    it('should include audit log ID in result', async () => {
      const request: SecureExportRequest = {
        entityType: 'transactions',
        warningAcknowledged: true,
      }

      const result = await secureDataExport(request, mockExportFunction)

      expect(result.auditLogId).toBe('audit-log-123')
    })

    it('should continue export even if logging fails', async () => {
      const { logDataExport } = await import('../utils/securityLogger')
      vi.mocked(logDataExport).mockRejectedValueOnce(new Error('Logging failed'))

      const request: SecureExportRequest = {
        entityType: 'transactions',
        warningAcknowledged: true,
      }

      const result = await secureDataExport(request, mockExportFunction)

      expect(result.success).toBe(true)
      expect(result.auditLogId).toBeNull()
    })
  })

  describe('Export Execution', () => {
    it('should pass correct config to export function', async () => {
      const request: SecureExportRequest = {
        entityType: 'invoices',
        dateRange: 'last30',
        selectedFields: ['Invoice Number', 'Customer', 'Amount'],
        includeHeaders: true,
        warningAcknowledged: true,
      }

      await secureDataExport(request, mockExportFunction)

      expect(mockExportFunction).toHaveBeenCalledWith({
        entityType: 'invoices',
        dateRange: 'last30',
        selectedFields: ['Invoice Number', 'Customer', 'Amount'],
        includeHeaders: true,
        customStartDate: undefined,
        customEndDate: undefined,
        encoding: undefined,
      })
    })

    it('should return export result with security metadata', async () => {
      const request: SecureExportRequest = {
        entityType: 'transactions',
        warningAcknowledged: true,
      }

      const result = await secureDataExport(request, mockExportFunction)

      expect(result.success).toBe(true)
      expect(result.filename).toBe('test_export.csv')
      expect(result.csvContent).toBe('header1,header2\nvalue1,value2')
      expect(result.rowCount).toBe(1)
      expect(result.securityWarning).toBe(EXPORT_SECURITY_WARNINGS.unencrypted)
      expect(result.rateLimit).toBeDefined()
      expect(result.auditLogId).toBeDefined()
    })

    it('should handle export failures', async () => {
      mockExportFunction.mockResolvedValueOnce({
        success: false,
        filename: '',
        csvContent: '',
        rowCount: 0,
        error: 'Export failed',
      })

      const request: SecureExportRequest = {
        entityType: 'transactions',
        warningAcknowledged: true,
      }

      const result = await secureDataExport(request, mockExportFunction)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Export failed')
      expect(result.securityWarning).toBe(EXPORT_SECURITY_WARNINGS.unencrypted)
    })
  })

  describe('Security Warnings', () => {
    it('should include security warning in result', async () => {
      const request: SecureExportRequest = {
        entityType: 'transactions',
        warningAcknowledged: true,
      }

      const result = await secureDataExport(request, mockExportFunction)

      expect(result.securityWarning).toBe(EXPORT_SECURITY_WARNINGS.unencrypted)
    })

    it('should have correct warning message', () => {
      expect(EXPORT_SECURITY_WARNINGS.unencrypted).toContain('not encrypted')
      expect(EXPORT_SECURITY_WARNINGS.unencrypted).toContain('secure location')
    })
  })
})

describe('getExportQuotaStatus', () => {
  it('should return quota information', () => {
    const quota = getExportQuotaStatus('user-123')

    expect(quota.remaining).toBeGreaterThanOrEqual(0)
    expect(quota.maxOperations).toBeDefined()
    expect(quota.resetsAt).toBeDefined()
  })
})

describe('canUserExport', () => {
  it('should return true when quota available', () => {
    expect(canUserExport('user-123')).toBe(true)
  })

  it('should return false when quota exhausted', async () => {
    const { rateLimiter } = await import('../utils/rateLimiter')
    vi.mocked(rateLimiter.getQuotaStatus).mockReturnValueOnce({
      remaining: 0,
      maxOperations: 10,
      resetsAt: Date.now() + 3600000,
    })

    expect(canUserExport('user-123')).toBe(false)
  })
})
