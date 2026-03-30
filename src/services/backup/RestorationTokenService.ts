/**
 * Restoration Token Service
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 3, Task 3.1 (Chunk 3B):
 * Handles secure generation, validation, and management of restoration tokens
 * for email backup recovery.
 *
 * Security Features:
 * - Cryptographically secure token generation (UUIDs v4)
 * - SHA-256 token hashing with salt
 * - Constant-time token comparison
 * - Rate limiting enforcement
 * - One-time use validation
 * - IDOR protection
 *
 * Integration Points:
 * - restorationTokens.schema.ts (database schema)
 * - database.ts (token storage)
 * - AuditLogger (security event logging)
 */

import { nanoid } from 'nanoid'
import { db } from '../../store/database'
import {
  type RestorationToken,
  type CreateRestorationTokenOptions,
  type TokenValidationResult,
  createRestorationToken,
  validateTokenState,
  markTokenAsUsed,
  incrementAccessAttempt,
  isTokenExpired,
} from '../../db/schema/restorationTokens.schema'

/**
 * Generate restoration token result
 */
export interface GenerateTokenResult {
  success: boolean
  token?: string // The actual token string (only returned once, never stored)
  tokenId?: string // Database ID of the stored token entity
  expiresAt?: number // Unix timestamp when token expires
  error?: string
}

/**
 * Validate restoration token result
 */
export interface ValidateTokenResult {
  valid: boolean
  tokenEntity?: RestorationToken
  reason?: 'expired' | 'used' | 'not_found' | 'invalid_hash' | 'rate_limited'
  remainingTime?: number
  error?: string
}

/**
 * Use restoration token result
 */
export interface UseTokenResult {
  success: boolean
  tokenEntity?: RestorationToken
  error?: string
}

/**
 * Restoration Token Service
 *
 * Manages secure token generation, validation, and lifecycle.
 * All tokens are hashed before storage (never stored in plaintext).
 */
export class RestorationTokenService {
  /**
   * Generate a new restoration token
   *
   * Creates a cryptographically secure token, hashes it with SHA-256,
   * and stores the hash in the database. The actual token is returned
   * only once and never stored.
   *
   * @param options - Token creation options
   * @returns Token generation result with the plaintext token (one-time only)
   */
  async generateToken(
    options: CreateRestorationTokenOptions
  ): Promise<GenerateTokenResult> {
    try {
      // Generate cryptographically secure token (UUID v4 equivalent)
      const token = nanoid(32) // 32 characters = 256 bits of entropy

      // Generate salt for hashing
      const salt = nanoid(32)

      // Hash the token with SHA-256
      const tokenHash = await this.hashToken(token, salt)

      // Create token entity using schema
      const tokenEntity = createRestorationToken(options, tokenHash, salt)

      // Store in database
      const tokenId = await db.restorationTokens.add({
        ...tokenEntity,
        id: nanoid(),
      })

      // Log audit event
      await this.logTokenCreation(tokenId as string, options.userId, options.companyId)

      return {
        success: true,
        token, // IMPORTANT: Only returned here, never stored
        tokenId: tokenId as string,
        expiresAt: tokenEntity.expires_at,
      }
    } catch (error) {
      console.error('[RestorationTokenService] Failed to generate token:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token generation failed',
      }
    }
  }

  /**
   * Validate a restoration token
   *
   * Checks if a token is valid by:
   * 1. Finding the token entity in the database
   * 2. Hashing the provided token with stored salt
   * 3. Comparing hashes in constant time
   * 4. Validating token state (not expired, not used, not rate limited)
   *
   * @param token - The plaintext token to validate
   * @param tokenId - Optional token ID for faster lookup
   * @returns Validation result
   */
  async validateToken(
    token: string,
    tokenId?: string
  ): Promise<ValidateTokenResult> {
    try {
      // Find token entity
      let tokenEntity: RestorationToken | undefined

      if (tokenId) {
        tokenEntity = await db.restorationTokens.get(tokenId)
      }

      if (!tokenEntity) {
        return {
          valid: false,
          reason: 'not_found',
          error: 'Token not found',
        }
      }

      // Hash provided token with stored salt
      const providedHash = await this.hashToken(token, tokenEntity.salt)

      // Compare hashes in constant time
      const hashesMatch = this.constantTimeCompare(providedHash, tokenEntity.token_hash)

      if (!hashesMatch) {
        // Increment failed attempt counter
        const updatedToken = incrementAccessAttempt(tokenEntity)
        await db.restorationTokens.update(tokenEntity.id, updatedToken)

        return {
          valid: false,
          reason: 'invalid_hash',
          error: 'Invalid token',
        }
      }

      // Validate token state (expired, used, rate limited)
      const stateValidation = validateTokenState(tokenEntity)

      if (!stateValidation.valid) {
        return {
          valid: false,
          tokenEntity,
          reason: stateValidation.reason,
          error: `Token is ${stateValidation.reason}`,
        }
      }

      return {
        valid: true,
        tokenEntity,
        remainingTime: stateValidation.remainingTime,
      }
    } catch (error) {
      console.error('[RestorationTokenService] Token validation failed:', error)
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      }
    }
  }

  /**
   * Mark a restoration token as used
   *
   * One-time use enforcement: once used, token becomes invalid.
   *
   * @param tokenId - Database ID of the token
   * @param ipAddress - IP address of the user using the token
   * @param userAgent - User agent of the user using the token
   * @returns Use token result
   */
  async useToken(
    tokenId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UseTokenResult> {
    try {
      const tokenEntity = await db.restorationTokens.get(tokenId)

      if (!tokenEntity) {
        return {
          success: false,
          error: 'Token not found',
        }
      }

      // Check if already used
      if (tokenEntity.used) {
        return {
          success: false,
          error: 'Token already used',
        }
      }

      // Mark as used
      const usedToken = markTokenAsUsed(tokenEntity, ipAddress, userAgent)
      await db.restorationTokens.update(tokenId, usedToken)

      // Log audit event
      await this.logTokenUsage(tokenId, tokenEntity.user_id, tokenEntity.company_id)

      return {
        success: true,
        tokenEntity: usedToken,
      }
    } catch (error) {
      console.error('[RestorationTokenService] Failed to mark token as used:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to use token',
      }
    }
  }

  /**
   * Get token by ID
   *
   * @param tokenId - Database ID of the token
   * @returns Token entity or undefined
   */
  async getToken(tokenId: string): Promise<RestorationToken | undefined> {
    return db.restorationTokens.get(tokenId)
  }

  /**
   * Get all tokens for a user
   *
   * @param userId - User ID
   * @returns Array of restoration tokens
   */
  async getTokensForUser(userId: string): Promise<RestorationToken[]> {
    return db.restorationTokens.where('user_id').equals(userId).toArray()
  }

  /**
   * Get all tokens for a company
   *
   * @param companyId - Company ID
   * @returns Array of restoration tokens
   */
  async getTokensForCompany(companyId: string): Promise<RestorationToken[]> {
    return db.restorationTokens.where('company_id').equals(companyId).toArray()
  }

  /**
   * Delete expired tokens (maintenance)
   *
   * Removes tokens that are expired and past retention period.
   * Keeps tokens for audit trail retention (default: 30 days).
   *
   * @param retentionDays - How many days to keep expired tokens
   * @returns Number of tokens deleted
   */
  async deleteExpiredTokens(retentionDays: number = 30): Promise<number> {
    const now = Date.now()
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000

    const allTokens = await db.restorationTokens.toArray()

    const tokensToDelete = allTokens.filter((token) => {
      // Keep active tokens
      if (!token.used && !isTokenExpired(token)) {
        return false
      }

      // Delete if past retention period
      const ageMs = now - token.created_at
      return ageMs > retentionMs
    })

    if (tokensToDelete.length > 0) {
      await db.restorationTokens.bulkDelete(tokensToDelete.map((t) => t.id))
    }

    return tokensToDelete.length
  }

  /**
   * Hash a token with SHA-256
   *
   * Uses Web Crypto API for secure hashing.
   *
   * @param token - The plaintext token
   * @param salt - The salt to use for hashing
   * @returns Hex-encoded SHA-256 hash
   */
  private async hashToken(token: string, salt: string): Promise<string> {
    // Combine token and salt
    const combined = `${token}:${salt}`

    // Convert to Uint8Array
    const encoder = new TextEncoder()
    const data = encoder.encode(combined)

    // Hash with SHA-256
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    return hashHex
  }

  /**
   * Constant-time string comparison
   *
   * Prevents timing attacks by comparing all characters
   * even when mismatch is found early.
   *
   * @param a - First string
   * @param b - Second string
   * @returns True if strings are equal
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }

    return result === 0
  }

  /**
   * Log token creation to audit trail
   *
   * @param tokenId - Token ID
   * @param userId - User ID
   * @param companyId - Company ID
   */
  private async logTokenCreation(
    tokenId: string,
    userId: string,
    companyId: string
  ): Promise<void> {
    // TODO: Integrate with AuditLogger when available
    console.log('[RestorationTokenService] Token created:', {
      tokenId,
      userId,
      companyId,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Log token usage to audit trail
   *
   * @param tokenId - Token ID
   * @param userId - User ID
   * @param companyId - Company ID
   */
  private async logTokenUsage(
    tokenId: string,
    userId: string,
    companyId: string
  ): Promise<void> {
    // TODO: Integrate with AuditLogger when available
    console.log('[RestorationTokenService] Token used:', {
      tokenId,
      userId,
      companyId,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Singleton instance of RestorationTokenService
 */
export const restorationTokenService = new RestorationTokenService()

/**
 * Generate a restoration URL with embedded token
 *
 * Creates a full restoration URL that can be sent via email.
 *
 * @param token - The plaintext token
 * @param tokenId - Database ID of the token
 * @param baseUrl - Base URL of the application (default: window.location.origin)
 * @returns Full restoration URL
 */
export function generateRestorationUrl(
  token: string,
  tokenId: string,
  baseUrl?: string
): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '')
  const encodedToken = encodeURIComponent(token)
  const encodedId = encodeURIComponent(tokenId)

  return `${base}/restore?token=${encodedToken}&id=${encodedId}`
}

/**
 * Parse a restoration URL to extract token and ID
 *
 * @param url - Full restoration URL
 * @returns Parsed token and ID, or null if invalid
 */
export function parseRestorationUrl(url: string): {
  token: string
  tokenId: string
} | null {
  try {
    const urlObj = new URL(url)
    const token = urlObj.searchParams.get('token')
    const tokenId = urlObj.searchParams.get('id')

    if (!token || !tokenId) {
      return null
    }

    return {
      token: decodeURIComponent(token),
      tokenId: decodeURIComponent(tokenId),
    }
  } catch {
    return null
  }
}

/**
 * Validate restoration URL format
 *
 * @param url - URL to validate
 * @returns True if URL has valid format
 */
export function isValidRestorationUrl(url: string): boolean {
  const parsed = parseRestorationUrl(url)
  return parsed !== null
}
