/**
 * Restoration Token Service Tests
 *
 * Comprehensive tests for token generation, validation, and management
 * per Phase 3, Task 3.1 (Chunk 3B).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '../../store/database'
import {
  RestorationTokenService,
  restorationTokenService,
  generateRestorationUrl,
  parseRestorationUrl,
  isValidRestorationUrl,
  type GenerateTokenResult,
  type ValidateTokenResult,
  type UseTokenResult,
} from './RestorationTokenService'
import type { RestorationToken } from '../../db/schema/restorationTokens.schema'

describe('RestorationTokenService', () => {
  let service: RestorationTokenService

  beforeEach(async () => {
    service = new RestorationTokenService()
    // Clear restoration tokens before each test
    await db.restorationTokens.clear()
  })

  afterEach(async () => {
    // Cleanup after each test
    await db.restorationTokens.clear()
  })

  describe('generateToken', () => {
    it('should generate a valid restoration token', async () => {
      const result = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      expect(result.success).toBe(true)
      expect(result.token).toBeDefined()
      expect(result.tokenId).toBeDefined()
      expect(result.expiresAt).toBeGreaterThan(Date.now())
      expect(result.error).toBeUndefined()

      // Verify token is 32 characters (256 bits)
      expect(result.token?.length).toBe(32)
    })

    it('should store token hash in database (not plaintext)', async () => {
      const result = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      const storedToken = await db.restorationTokens.get(result.tokenId!)

      expect(storedToken).toBeDefined()
      expect(storedToken!.token_hash).toBeDefined()
      expect(storedToken!.token_hash).not.toBe(result.token) // Not plaintext
      expect(storedToken!.salt).toBeDefined()

      // Hash should be 64 characters (SHA-256 hex)
      expect(storedToken!.token_hash.length).toBe(64)
    })

    it('should set correct metadata', async () => {
      const result = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      })

      const storedToken = await db.restorationTokens.get(result.tokenId!)

      expect(storedToken!.user_id).toBe('user-123')
      expect(storedToken!.company_id).toBe('company-456')
      expect(storedToken!.backup_id).toBe('backup-789')
      expect(storedToken!.ip_address).toBe('192.168.1.1')
      expect(storedToken!.user_agent).toBe('Mozilla/5.0')
      expect(storedToken!.used).toBe(false)
      expect(storedToken!.access_attempts).toBe(0)
    })

    it('should set expiration to 7 days by default', async () => {
      const beforeGeneration = Date.now()
      const result = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
      const expectedExpiration = beforeGeneration + sevenDaysMs

      expect(result.expiresAt).toBeGreaterThan(expectedExpiration - 1000)
      expect(result.expiresAt).toBeLessThan(expectedExpiration + 1000)
    })

    it('should use custom expiration days', async () => {
      const result = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
        expirationDays: 3,
      })

      const storedToken = await db.restorationTokens.get(result.tokenId!)
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000
      const expectedExpiration = Date.now() + threeDaysMs

      expect(storedToken!.expires_at).toBeGreaterThan(expectedExpiration - 1000)
      expect(storedToken!.expires_at).toBeLessThan(expectedExpiration + 1000)
    })

    it('should generate unique tokens', async () => {
      const result1 = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      const result2 = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      expect(result1.token).not.toBe(result2.token)
      expect(result1.tokenId).not.toBe(result2.tokenId)
    })
  })

  describe('validateToken', () => {
    it('should validate a correct token', async () => {
      // Generate token
      const generateResult = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      // Validate token
      const validateResult = await service.validateToken(
        generateResult.token!,
        generateResult.tokenId
      )

      expect(validateResult.valid).toBe(true)
      expect(validateResult.tokenEntity).toBeDefined()
      expect(validateResult.remainingTime).toBeGreaterThan(0)
      expect(validateResult.error).toBeUndefined()
    })

    it('should reject incorrect token', async () => {
      // Generate token
      const generateResult = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      // Validate with wrong token
      const validateResult = await service.validateToken(
        'wrong-token-12345678901234567890',
        generateResult.tokenId
      )

      expect(validateResult.valid).toBe(false)
      expect(validateResult.reason).toBe('invalid_hash')
    })

    it('should reject non-existent token', async () => {
      const validateResult = await service.validateToken(
        'some-token-123456789012345678901',
        'non-existent-id'
      )

      expect(validateResult.valid).toBe(false)
      expect(validateResult.reason).toBe('not_found')
    })

    it('should reject expired token', async () => {
      // Generate token
      const generateResult = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      // Manually expire the token
      const token = await db.restorationTokens.get(generateResult.tokenId!)
      await db.restorationTokens.update(generateResult.tokenId!, {
        expires_at: Date.now() - 1000, // Expired 1 second ago
      })

      // Validate expired token
      const validateResult = await service.validateToken(
        generateResult.token!,
        generateResult.tokenId
      )

      expect(validateResult.valid).toBe(false)
      expect(validateResult.reason).toBe('expired')
    })

    it('should reject used token', async () => {
      // Generate and use token
      const generateResult = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      await service.useToken(generateResult.tokenId!)

      // Validate used token
      const validateResult = await service.validateToken(
        generateResult.token!,
        generateResult.tokenId
      )

      expect(validateResult.valid).toBe(false)
      expect(validateResult.reason).toBe('used')
    })

    it('should increment access attempts on invalid hash', async () => {
      // Generate token
      const generateResult = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      // Try with wrong token
      await service.validateToken(
        'wrong-token-12345678901234567890',
        generateResult.tokenId
      )

      // Check access attempts incremented
      const token = await db.restorationTokens.get(generateResult.tokenId!)
      expect(token!.access_attempts).toBe(1)
    })

    it('should reject rate-limited token', async () => {
      // Generate token
      const generateResult = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      // Manually set to rate-limited state (5+ attempts)
      await db.restorationTokens.update(generateResult.tokenId!, {
        access_attempts: 5,
        last_attempt_at: Date.now() - 1000, // Recent attempt
      })

      // Validate rate-limited token
      const validateResult = await service.validateToken(
        generateResult.token!,
        generateResult.tokenId
      )

      expect(validateResult.valid).toBe(false)
      expect(validateResult.reason).toBe('rate_limited')
    })
  })

  describe('useToken', () => {
    it('should mark token as used', async () => {
      // Generate token
      const generateResult = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      // Use token
      const useResult = await service.useToken(
        generateResult.tokenId!,
        '10.0.0.1',
        'Chrome'
      )

      expect(useResult.success).toBe(true)
      expect(useResult.tokenEntity!.used).toBe(true)
      expect(useResult.tokenEntity!.used_at).toBeGreaterThan(0)
      expect(useResult.tokenEntity!.used_ip_address).toBe('10.0.0.1')
      expect(useResult.tokenEntity!.used_user_agent).toBe('Chrome')
    })

    it('should prevent using token twice', async () => {
      // Generate token
      const generateResult = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      // Use token first time
      const firstUse = await service.useToken(generateResult.tokenId!)
      expect(firstUse.success).toBe(true)

      // Try to use again
      const secondUse = await service.useToken(generateResult.tokenId!)
      expect(secondUse.success).toBe(false)
      expect(secondUse.error).toBe('Token already used')
    })

    it('should handle non-existent token', async () => {
      const useResult = await service.useToken('non-existent-id')

      expect(useResult.success).toBe(false)
      expect(useResult.error).toBe('Token not found')
    })

    it('should work without optional metadata', async () => {
      const generateResult = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      const useResult = await service.useToken(generateResult.tokenId!)

      expect(useResult.success).toBe(true)
      expect(useResult.tokenEntity!.used_ip_address).toBe(null)
      expect(useResult.tokenEntity!.used_user_agent).toBe(null)
    })
  })

  describe('getToken', () => {
    it('should retrieve token by ID', async () => {
      const generateResult = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      const token = await service.getToken(generateResult.tokenId!)

      expect(token).toBeDefined()
      expect(token!.id).toBe(generateResult.tokenId)
      expect(token!.user_id).toBe('user-123')
    })

    it('should return undefined for non-existent token', async () => {
      const token = await service.getToken('non-existent-id')
      expect(token).toBeUndefined()
    })
  })

  describe('getTokensForUser', () => {
    it('should retrieve all tokens for a user', async () => {
      await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-1',
      })

      await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-2',
      })

      await service.generateToken({
        userId: 'user-999', // Different user
        companyId: 'company-456',
        backupId: 'backup-3',
      })

      const tokens = await service.getTokensForUser('user-123')

      expect(tokens).toHaveLength(2)
      expect(tokens.every((t) => t.user_id === 'user-123')).toBe(true)
    })

    it('should return empty array for user with no tokens', async () => {
      const tokens = await service.getTokensForUser('user-999')
      expect(tokens).toEqual([])
    })
  })

  describe('getTokensForCompany', () => {
    it('should retrieve all tokens for a company', async () => {
      await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-1',
      })

      await service.generateToken({
        userId: 'user-789',
        companyId: 'company-456',
        backupId: 'backup-2',
      })

      await service.generateToken({
        userId: 'user-123',
        companyId: 'company-999', // Different company
        backupId: 'backup-3',
      })

      const tokens = await service.getTokensForCompany('company-456')

      expect(tokens).toHaveLength(2)
      expect(tokens.every((t) => t.company_id === 'company-456')).toBe(true)
    })

    it('should return empty array for company with no tokens', async () => {
      const tokens = await service.getTokensForCompany('company-999')
      expect(tokens).toEqual([])
    })
  })

  describe('deleteExpiredTokens', () => {
    it('should not delete active tokens', async () => {
      await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      const deletedCount = await service.deleteExpiredTokens(30)

      expect(deletedCount).toBe(0)

      const tokens = await db.restorationTokens.toArray()
      expect(tokens).toHaveLength(1)
    })

    it('should not delete recently expired tokens within retention', async () => {
      const generateResult = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      // Expire token but keep it recent
      await db.restorationTokens.update(generateResult.tokenId!, {
        created_at: Date.now() - (10 * 24 * 60 * 60 * 1000), // 10 days old
        expires_at: Date.now() - 1000, // Just expired
      })

      const deletedCount = await service.deleteExpiredTokens(30)

      expect(deletedCount).toBe(0)
    })

    it('should delete old expired tokens past retention', async () => {
      const generateResult = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      // Make token old and expired
      await db.restorationTokens.update(generateResult.tokenId!, {
        created_at: Date.now() - (40 * 24 * 60 * 60 * 1000), // 40 days old
        expires_at: Date.now() - (30 * 24 * 60 * 60 * 1000), // Expired 30 days ago
      })

      const deletedCount = await service.deleteExpiredTokens(30)

      expect(deletedCount).toBe(1)

      const tokens = await db.restorationTokens.toArray()
      expect(tokens).toHaveLength(0)
    })

    it('should delete old used tokens past retention', async () => {
      const generateResult = await service.generateToken({
        userId: 'user-123',
        companyId: 'company-456',
        backupId: 'backup-789',
      })

      // Use token and make it old
      await service.useToken(generateResult.tokenId!)
      await db.restorationTokens.update(generateResult.tokenId!, {
        created_at: Date.now() - (40 * 24 * 60 * 60 * 1000), // 40 days old
      })

      const deletedCount = await service.deleteExpiredTokens(30)

      expect(deletedCount).toBe(1)
    })
  })

  describe('Singleton instance', () => {
    it('should provide a singleton instance', () => {
      expect(restorationTokenService).toBeInstanceOf(RestorationTokenService)
    })
  })
})

describe('URL Helper Functions', () => {
  describe('generateRestorationUrl', () => {
    it('should generate valid restoration URL', () => {
      const url = generateRestorationUrl(
        'abc123xyz',
        'token-id-456',
        'https://example.com'
      )

      expect(url).toContain('https://example.com/restore')
      expect(url).toContain('token=abc123xyz')
      expect(url).toContain('id=token-id-456')
    })

    it('should URL-encode special characters', () => {
      const url = generateRestorationUrl(
        'token+with/special=chars',
        'id-123',
        'https://example.com'
      )

      expect(url).toContain('token=token%2Bwith%2Fspecial%3Dchars')
    })
  })

  describe('parseRestorationUrl', () => {
    it('should parse valid restoration URL', () => {
      const url = 'https://example.com/restore?token=abc123xyz&id=token-id-456'
      const parsed = parseRestorationUrl(url)

      expect(parsed).not.toBe(null)
      expect(parsed!.token).toBe('abc123xyz')
      expect(parsed!.tokenId).toBe('token-id-456')
    })

    it('should URL-decode special characters', () => {
      const url = 'https://example.com/restore?token=token%2Bwith%2Fspecial%3Dchars&id=id-123'
      const parsed = parseRestorationUrl(url)

      expect(parsed!.token).toBe('token+with/special=chars')
    })

    it('should return null for URL without token', () => {
      const url = 'https://example.com/restore?id=token-id-456'
      const parsed = parseRestorationUrl(url)

      expect(parsed).toBe(null)
    })

    it('should return null for URL without id', () => {
      const url = 'https://example.com/restore?token=abc123xyz'
      const parsed = parseRestorationUrl(url)

      expect(parsed).toBe(null)
    })

    it('should return null for invalid URL', () => {
      const parsed = parseRestorationUrl('not a valid url')

      expect(parsed).toBe(null)
    })
  })

  describe('isValidRestorationUrl', () => {
    it('should return true for valid URL', () => {
      const url = 'https://example.com/restore?token=abc123xyz&id=token-id-456'
      expect(isValidRestorationUrl(url)).toBe(true)
    })

    it('should return false for invalid URL', () => {
      expect(isValidRestorationUrl('not a url')).toBe(false)
      expect(isValidRestorationUrl('https://example.com/restore')).toBe(false)
      expect(isValidRestorationUrl('https://example.com/restore?token=abc')).toBe(false)
    })
  })
})
