/**
 * Restoration Token Schema Tests
 *
 * Tests for restoration token schema validation, state management,
 * and helper functions per Phase 3, Task 3.1.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  type RestorationToken,
  type TokenValidationResult,
  type CreateRestorationTokenOptions,
  type TokenStatistics,
  createRestorationToken,
  isTokenExpired,
  validateTokenState,
  markTokenAsUsed,
  incrementAccessAttempt,
  getTokenErrorMessage,
  formatRemainingTime,
  calculateTokenStatistics,
  getExpiredTokensForCleanup,
  DEFAULT_TOKEN_EXPIRATION_MS,
  MAX_ACCESS_ATTEMPTS,
  RATE_LIMIT_WINDOW_MS,
} from './restorationTokens.schema'

describe('RestorationToken Schema', () => {
  let mockTokenHash: string
  let mockSalt: string
  let mockOptions: CreateRestorationTokenOptions

  beforeEach(() => {
    mockTokenHash = 'a'.repeat(64) // SHA-256 hash length
    mockSalt = 'b'.repeat(32)
    mockOptions = {
      userId: 'user-123',
      companyId: 'company-456',
      backupId: 'backup-789',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    }
  })

  describe('createRestorationToken', () => {
    it('should create a valid restoration token with default expiration', () => {
      const token = createRestorationToken(mockOptions, mockTokenHash, mockSalt)

      expect(token.user_id).toBe('user-123')
      expect(token.company_id).toBe('company-456')
      expect(token.backup_id).toBe('backup-789')
      expect(token.token_hash).toBe(mockTokenHash)
      expect(token.salt).toBe(mockSalt)
      expect(token.used).toBe(false)
      expect(token.used_at).toBe(null)
      expect(token.ip_address).toBe('192.168.1.1')
      expect(token.user_agent).toBe('Mozilla/5.0')
      expect(token.access_attempts).toBe(0)
      expect(token.last_attempt_at).toBe(null)

      // Check expiration is approximately 7 days from now
      const expectedExpiration = Date.now() + DEFAULT_TOKEN_EXPIRATION_MS
      expect(token.expires_at).toBeGreaterThan(expectedExpiration - 1000)
      expect(token.expires_at).toBeLessThan(expectedExpiration + 1000)
    })

    it('should create token with custom expiration days', () => {
      const customOptions = { ...mockOptions, expirationDays: 3 }
      const token = createRestorationToken(customOptions, mockTokenHash, mockSalt)

      const expectedExpiration = Date.now() + (3 * 24 * 60 * 60 * 1000)
      expect(token.expires_at).toBeGreaterThan(expectedExpiration - 1000)
      expect(token.expires_at).toBeLessThan(expectedExpiration + 1000)
    })

    it('should handle missing optional fields', () => {
      const minimalOptions: CreateRestorationTokenOptions = {
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      }

      const token = createRestorationToken(minimalOptions, mockTokenHash, mockSalt)

      expect(token.ip_address).toBe(null)
      expect(token.user_agent).toBe(null)
      expect(token.used_ip_address).toBe(null)
      expect(token.used_user_agent).toBe(null)
    })

    it('should set timestamps correctly', () => {
      const beforeCreation = Date.now()
      const token = createRestorationToken(mockOptions, mockTokenHash, mockSalt)
      const afterCreation = Date.now()

      expect(token.created_at).toBeGreaterThanOrEqual(beforeCreation)
      expect(token.created_at).toBeLessThanOrEqual(afterCreation)
      expect(token.updated_at).toBe(token.created_at)
    })
  })

  describe('isTokenExpired', () => {
    it('should return false for non-expired token', () => {
      const token = createRestorationToken(mockOptions, mockTokenHash, mockSalt)
      const fullToken: RestorationToken = { ...token, id: 'token-123' }

      expect(isTokenExpired(fullToken)).toBe(false)
    })

    it('should return true for expired token', () => {
      const token = createRestorationToken(mockOptions, mockTokenHash, mockSalt)
      const expiredToken: RestorationToken = {
        ...token,
        id: 'token-123',
        expires_at: Date.now() - 1000, // Expired 1 second ago
      }

      expect(isTokenExpired(expiredToken)).toBe(true)
    })

    it('should return true for token expiring exactly now', () => {
      const token = createRestorationToken(mockOptions, mockTokenHash, mockSalt)
      const expiringToken: RestorationToken = {
        ...token,
        id: 'token-123',
        expires_at: Date.now(),
      }

      expect(isTokenExpired(expiringToken)).toBe(true)
    })
  })

  describe('validateTokenState', () => {
    let validToken: RestorationToken

    beforeEach(() => {
      const token = createRestorationToken(mockOptions, mockTokenHash, mockSalt)
      validToken = { ...token, id: 'token-123' }
    })

    it('should return valid for fresh unused token', () => {
      const result = validateTokenState(validToken)

      expect(result.valid).toBe(true)
      expect(result.reason).toBeUndefined()
      expect(result.token).toBe(validToken)
      expect(result.remainingTime).toBeGreaterThan(0)
    })

    it('should return invalid for used token', () => {
      const usedToken: RestorationToken = {
        ...validToken,
        used: true,
        used_at: Date.now(),
      }

      const result = validateTokenState(usedToken)

      expect(result.valid).toBe(false)
      expect(result.reason).toBe('used')
      expect(result.token).toBe(usedToken)
    })

    it('should return invalid for expired token', () => {
      const expiredToken: RestorationToken = {
        ...validToken,
        expires_at: Date.now() - 1000,
      }

      const result = validateTokenState(expiredToken)

      expect(result.valid).toBe(false)
      expect(result.reason).toBe('expired')
    })

    it('should return invalid for rate-limited token', () => {
      const rateLimitedToken: RestorationToken = {
        ...validToken,
        access_attempts: MAX_ACCESS_ATTEMPTS,
        last_attempt_at: Date.now() - 1000, // Recent attempt
      }

      const result = validateTokenState(rateLimitedToken)

      expect(result.valid).toBe(false)
      expect(result.reason).toBe('rate_limited')
    })

    it('should reset rate limit after window expires', () => {
      const rateLimitedToken: RestorationToken = {
        ...validToken,
        access_attempts: MAX_ACCESS_ATTEMPTS,
        last_attempt_at: Date.now() - RATE_LIMIT_WINDOW_MS - 1000, // Outside window
      }

      const result = validateTokenState(rateLimitedToken)

      expect(result.valid).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('should calculate remaining time correctly', () => {
      const result = validateTokenState(validToken)

      expect(result.remainingTime).toBeDefined()
      expect(result.remainingTime).toBeGreaterThan(0)
      expect(result.remainingTime).toBeLessThanOrEqual(DEFAULT_TOKEN_EXPIRATION_MS)
    })
  })

  describe('markTokenAsUsed', () => {
    let token: RestorationToken

    beforeEach(() => {
      const baseToken = createRestorationToken(mockOptions, mockTokenHash, mockSalt)
      token = { ...baseToken, id: 'token-123' }
    })

    it('should mark token as used with metadata', () => {
      const usedToken = markTokenAsUsed(token, '10.0.0.1', 'Chrome')

      expect(usedToken.used).toBe(true)
      expect(usedToken.used_at).toBeGreaterThan(0)
      expect(usedToken.used_ip_address).toBe('10.0.0.1')
      expect(usedToken.used_user_agent).toBe('Chrome')
      expect(usedToken.updated_at).toBeGreaterThanOrEqual(token.updated_at)
    })

    it('should mark token as used without optional metadata', () => {
      const usedToken = markTokenAsUsed(token)

      expect(usedToken.used).toBe(true)
      expect(usedToken.used_at).toBeGreaterThan(0)
      expect(usedToken.used_ip_address).toBe(null)
      expect(usedToken.used_user_agent).toBe(null)
    })

    it('should preserve original token data', () => {
      const usedToken = markTokenAsUsed(token, '10.0.0.1', 'Chrome')

      expect(usedToken.id).toBe(token.id)
      expect(usedToken.user_id).toBe(token.user_id)
      expect(usedToken.company_id).toBe(token.company_id)
      expect(usedToken.token_hash).toBe(token.token_hash)
      expect(usedToken.expires_at).toBe(token.expires_at)
    })
  })

  describe('incrementAccessAttempt', () => {
    let token: RestorationToken

    beforeEach(() => {
      const baseToken = createRestorationToken(mockOptions, mockTokenHash, mockSalt)
      token = { ...baseToken, id: 'token-123' }
    })

    it('should increment access attempts', () => {
      const updated1 = incrementAccessAttempt(token)
      expect(updated1.access_attempts).toBe(1)
      expect(updated1.last_attempt_at).toBeGreaterThan(0)

      const updated2 = incrementAccessAttempt(updated1)
      expect(updated2.access_attempts).toBe(2)
    })

    it('should reset attempts after rate limit window', () => {
      const tokenWithOldAttempt: RestorationToken = {
        ...token,
        access_attempts: 3,
        last_attempt_at: Date.now() - RATE_LIMIT_WINDOW_MS - 1000,
      }

      const updated = incrementAccessAttempt(tokenWithOldAttempt)

      expect(updated.access_attempts).toBe(1) // Reset to 1
      expect(updated.last_attempt_at).toBeGreaterThan(tokenWithOldAttempt.last_attempt_at!)
    })

    it('should not reset attempts within rate limit window', () => {
      const tokenWithRecentAttempt: RestorationToken = {
        ...token,
        access_attempts: 3,
        last_attempt_at: Date.now() - 1000, // Recent attempt
      }

      const updated = incrementAccessAttempt(tokenWithRecentAttempt)

      expect(updated.access_attempts).toBe(4) // Incremented
    })

    it('should update timestamp on each attempt', () => {
      const beforeAttempt = Date.now()
      const updated = incrementAccessAttempt(token)
      const afterAttempt = Date.now()

      expect(updated.last_attempt_at).toBeGreaterThanOrEqual(beforeAttempt)
      expect(updated.last_attempt_at).toBeLessThanOrEqual(afterAttempt)
      expect(updated.updated_at).toBeGreaterThanOrEqual(beforeAttempt)
    })
  })

  describe('getTokenErrorMessage', () => {
    it('should return message for expired token', () => {
      const result: TokenValidationResult = {
        valid: false,
        reason: 'expired',
      }

      const message = getTokenErrorMessage(result)

      expect(message).toContain('expired')
      expect(message).toContain('7 days')
      expect(message).not.toContain('your fault') // Steadiness style: never blame
    })

    it('should return message for used token', () => {
      const result: TokenValidationResult = {
        valid: false,
        reason: 'used',
      }

      const message = getTokenErrorMessage(result)

      expect(message).toContain('already been used')
      expect(message).toContain('once')
      expect(message).toContain('security')
    })

    it('should return message for not found token', () => {
      const result: TokenValidationResult = {
        valid: false,
        reason: 'not_found',
      }

      const message = getTokenErrorMessage(result)

      expect(message).toContain("couldn't find")
      expect(message).toContain('email')
    })

    it('should return message for invalid hash', () => {
      const result: TokenValidationResult = {
        valid: false,
        reason: 'invalid_hash',
      }

      const message = getTokenErrorMessage(result)

      expect(message).toContain("doesn't look right")
      expect(message).toContain('complete link')
    })

    it('should return message for rate limited token', () => {
      const result: TokenValidationResult = {
        valid: false,
        reason: 'rate_limited',
      }

      const message = getTokenErrorMessage(result)

      expect(message).toContain('Too many attempts')
      expect(message).toContain('wait')
      expect(message).toContain('security')
    })

    it('should return generic message for unknown reason', () => {
      const result: TokenValidationResult = {
        valid: false,
      }

      const message = getTokenErrorMessage(result)

      expect(message).toContain('unexpected')
      expect(message).toContain('try again')
    })
  })

  describe('formatRemainingTime', () => {
    it('should format days correctly', () => {
      expect(formatRemainingTime(2 * 24 * 60 * 60 * 1000)).toBe('2 days')
      expect(formatRemainingTime(1 * 24 * 60 * 60 * 1000)).toBe('1 day')
    })

    it('should format hours correctly', () => {
      expect(formatRemainingTime(5 * 60 * 60 * 1000)).toBe('5 hours')
      expect(formatRemainingTime(1 * 60 * 60 * 1000)).toBe('1 hour')
    })

    it('should format less than an hour', () => {
      expect(formatRemainingTime(30 * 60 * 1000)).toBe('less than an hour')
      expect(formatRemainingTime(5 * 1000)).toBe('less than an hour')
    })
  })

  describe('calculateTokenStatistics', () => {
    it('should calculate statistics for empty array', () => {
      const stats = calculateTokenStatistics([])

      expect(stats.totalCreated).toBe(0)
      expect(stats.totalUsed).toBe(0)
      expect(stats.totalExpired).toBe(0)
      expect(stats.totalActive).toBe(0)
      expect(stats.averageUsageTime).toBe(0)
    })

    it('should calculate statistics correctly', () => {
      const now = Date.now()
      const tokens: RestorationToken[] = [
        // Active token
        {
          ...createRestorationToken(mockOptions, mockTokenHash, mockSalt),
          id: 'token-1',
        },
        // Used token
        {
          ...createRestorationToken(mockOptions, mockTokenHash, mockSalt),
          id: 'token-2',
          used: true,
          used_at: now - 1000,
        },
        // Expired token
        {
          ...createRestorationToken(mockOptions, mockTokenHash, mockSalt),
          id: 'token-3',
          expires_at: now - 1000,
        },
        // Another used token
        {
          ...createRestorationToken(mockOptions, mockTokenHash, mockSalt),
          id: 'token-4',
          used: true,
          used_at: now - 2000,
          created_at: now - 5000,
        },
      ]

      const stats = calculateTokenStatistics(tokens)

      expect(stats.totalCreated).toBe(4)
      expect(stats.totalUsed).toBe(2)
      expect(stats.totalExpired).toBe(1)
      expect(stats.totalActive).toBe(1)
      expect(stats.averageUsageTime).toBeGreaterThan(0)
    })

    it('should calculate average usage time correctly', () => {
      const now = Date.now()
      const token1 = createRestorationToken(mockOptions, mockTokenHash, mockSalt)
      const token2 = createRestorationToken(mockOptions, mockTokenHash, mockSalt)

      const tokens: RestorationToken[] = [
        {
          ...token1,
          id: 'token-1',
          created_at: now - 10000,
          used: true,
          used_at: now - 5000, // Used after 5000ms
        },
        {
          ...token2,
          id: 'token-2',
          created_at: now - 20000,
          used: true,
          used_at: now - 5000, // Used after 15000ms
        },
      ]

      const stats = calculateTokenStatistics(tokens)

      // Average: (5000 + 15000) / 2 = 10000
      expect(stats.averageUsageTime).toBe(10000)
    })
  })

  describe('getExpiredTokensForCleanup', () => {
    it('should not cleanup active tokens', () => {
      const activeToken: RestorationToken = {
        ...createRestorationToken(mockOptions, mockTokenHash, mockSalt),
        id: 'token-1',
      }

      const toDelete = getExpiredTokensForCleanup([activeToken])

      expect(toDelete).toEqual([])
    })

    it('should not cleanup recently expired tokens within retention', () => {
      const now = Date.now()
      const recentlyExpiredToken: RestorationToken = {
        ...createRestorationToken(mockOptions, mockTokenHash, mockSalt),
        id: 'token-1',
        created_at: now - (10 * 24 * 60 * 60 * 1000), // 10 days old
        expires_at: now - 1000, // Just expired
      }

      const toDelete = getExpiredTokensForCleanup([recentlyExpiredToken], 30)

      expect(toDelete).toEqual([])
    })

    it('should cleanup old expired tokens past retention', () => {
      const now = Date.now()
      const oldExpiredToken: RestorationToken = {
        ...createRestorationToken(mockOptions, mockTokenHash, mockSalt),
        id: 'token-1',
        created_at: now - (40 * 24 * 60 * 60 * 1000), // 40 days old
        expires_at: now - (30 * 24 * 60 * 60 * 1000), // Expired 30 days ago
      }

      const toDelete = getExpiredTokensForCleanup([oldExpiredToken], 30)

      expect(toDelete).toContain('token-1')
    })

    it('should cleanup old used tokens past retention', () => {
      const now = Date.now()
      const oldUsedToken: RestorationToken = {
        ...createRestorationToken(mockOptions, mockTokenHash, mockSalt),
        id: 'token-1',
        created_at: now - (40 * 24 * 60 * 60 * 1000), // 40 days old
        used: true,
        used_at: now - (35 * 24 * 60 * 60 * 1000),
      }

      const toDelete = getExpiredTokensForCleanup([oldUsedToken], 30)

      expect(toDelete).toContain('token-1')
    })

    it('should handle mixed token array', () => {
      const now = Date.now()
      const tokens: RestorationToken[] = [
        // Active - don't delete
        {
          ...createRestorationToken(mockOptions, mockTokenHash, mockSalt),
          id: 'token-active',
        },
        // Old expired - delete
        {
          ...createRestorationToken(mockOptions, mockTokenHash, mockSalt),
          id: 'token-old-expired',
          created_at: now - (40 * 24 * 60 * 60 * 1000),
          expires_at: now - 1000,
        },
        // Old used - delete
        {
          ...createRestorationToken(mockOptions, mockTokenHash, mockSalt),
          id: 'token-old-used',
          created_at: now - (40 * 24 * 60 * 60 * 1000),
          used: true,
          used_at: now - (35 * 24 * 60 * 60 * 1000),
        },
        // Recent expired - don't delete
        {
          ...createRestorationToken(mockOptions, mockTokenHash, mockSalt),
          id: 'token-recent-expired',
          created_at: now - (10 * 24 * 60 * 60 * 1000),
          expires_at: now - 1000,
        },
      ]

      const toDelete = getExpiredTokensForCleanup(tokens, 30)

      expect(toDelete).toHaveLength(2)
      expect(toDelete).toContain('token-old-expired')
      expect(toDelete).toContain('token-old-used')
      expect(toDelete).not.toContain('token-active')
      expect(toDelete).not.toContain('token-recent-expired')
    })
  })
})
