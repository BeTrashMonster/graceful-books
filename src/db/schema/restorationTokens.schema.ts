/**
 * Restoration Token Schema
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 3, Task 3.1:
 * Manages secure one-time restoration tokens for email backup recovery.
 *
 * Security Requirements:
 * - Tokens stored as SHA-256 hashes (not plaintext)
 * - One-time use enforcement (used boolean)
 * - 7-day expiration
 * - IDOR protection through secure token generation
 * - Rate limiting support via metadata
 * - Audit trail integration
 *
 * Features:
 * - Cryptographically secure token generation (UUIDs)
 * - Token hash storage for security
 * - Expiration tracking
 * - Usage tracking (timestamp, IP, user agent)
 * - Company and user association
 * - Backup reference tracking
 */

/**
 * Restoration token entity
 * Stores hashed tokens for secure email backup restoration
 */
export interface RestorationToken {
  id: string // Primary key (UUID)
  user_id: string // User who can use this token
  company_id: string // Company data this token restores
  backup_id: string // Reference to the backup this token unlocks

  // Token security
  token_hash: string // SHA-256 hash of the actual token (never store plaintext)
  salt: string // Salt used for token hashing (additional security layer)

  // Expiration and usage
  expires_at: number // Unix timestamp (7 days from creation)
  used: boolean // One-time use flag
  used_at: number | null // Timestamp when token was used

  // Security metadata (for audit trail and rate limiting)
  ip_address: string | null // IP address of token request
  user_agent: string | null // User agent of token request
  used_ip_address: string | null // IP address when token was used
  used_user_agent: string | null // User agent when token was used

  // Rate limiting support
  access_attempts: number // Number of failed access attempts
  last_attempt_at: number | null // Last attempt timestamp (for rate limiting)

  // Timestamps
  created_at: number
  updated_at: number
}

/**
 * Dexie schema for restoration tokens
 * Indexes: user_id, company_id, backup_id, expires_at, used, [user_id+used]
 */
export const restorationTokensSchema =
  'id, user_id, company_id, backup_id, expires_at, used, [user_id+used], [company_id+used], created_at, updated_at'

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean
  reason?: 'expired' | 'used' | 'not_found' | 'invalid_hash' | 'rate_limited'
  token?: RestorationToken
  remainingTime?: number // Milliseconds until expiration (if valid)
}

/**
 * Token generation options
 */
export interface CreateRestorationTokenOptions {
  userId: string
  companyId: string
  backupId: string
  ipAddress?: string
  userAgent?: string
  expirationDays?: number // Default: 7 days
}

/**
 * Token statistics for admin monitoring
 */
export interface TokenStatistics {
  totalCreated: number
  totalUsed: number
  totalExpired: number
  totalActive: number // Not used, not expired
  averageUsageTime: number // Average time from creation to usage (ms)
}

/**
 * Default expiration time for restoration tokens (7 days in milliseconds)
 */
export const DEFAULT_TOKEN_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Maximum allowed access attempts before rate limiting
 */
export const MAX_ACCESS_ATTEMPTS = 5

/**
 * Rate limit window (1 hour in milliseconds)
 */
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

/**
 * Create a new restoration token entity (without the actual token string)
 * The actual token generation and hashing happens in RestorationTokenService
 *
 * @param options - Token creation options
 * @param tokenHash - SHA-256 hash of the generated token
 * @param salt - Salt used for hashing
 * @returns Restoration token entity ready for database storage
 */
export function createRestorationToken(
  options: CreateRestorationTokenOptions,
  tokenHash: string,
  salt: string
): Omit<RestorationToken, 'id'> {
  const now = Date.now()
  const expirationMs = (options.expirationDays ?? 7) * 24 * 60 * 60 * 1000

  return {
    user_id: options.userId,
    company_id: options.companyId,
    backup_id: options.backupId,
    token_hash: tokenHash,
    salt,
    expires_at: now + expirationMs,
    used: false,
    used_at: null,
    ip_address: options.ipAddress ?? null,
    user_agent: options.userAgent ?? null,
    used_ip_address: null,
    used_user_agent: null,
    access_attempts: 0,
    last_attempt_at: null,
    created_at: now,
    updated_at: now,
  }
}

/**
 * Check if a restoration token is expired
 *
 * @param token - Restoration token to check
 * @returns True if expired, false otherwise
 */
export function isTokenExpired(token: RestorationToken): boolean {
  return Date.now() >= token.expires_at
}

/**
 * Check if a restoration token is still valid
 * Valid = not used, not expired, not rate limited
 *
 * @param token - Restoration token to check
 * @returns Validation result with reason if invalid
 */
export function validateTokenState(token: RestorationToken): TokenValidationResult {
  const now = Date.now()

  // Check if already used
  if (token.used) {
    return {
      valid: false,
      reason: 'used',
      token,
    }
  }

  // Check if expired
  if (isTokenExpired(token)) {
    return {
      valid: false,
      reason: 'expired',
      token,
    }
  }

  // Check if rate limited
  if (token.access_attempts >= MAX_ACCESS_ATTEMPTS) {
    // Check if we're still within the rate limit window
    if (
      token.last_attempt_at &&
      now - token.last_attempt_at < RATE_LIMIT_WINDOW_MS
    ) {
      return {
        valid: false,
        reason: 'rate_limited',
        token,
      }
    }
    // Rate limit window expired, token is valid again
  }

  // Token is valid
  return {
    valid: true,
    token,
    remainingTime: token.expires_at - now,
  }
}

/**
 * Mark a restoration token as used
 *
 * @param token - Restoration token to mark as used
 * @param ipAddress - IP address of the user who used the token
 * @param userAgent - User agent of the user who used the token
 * @returns Updated restoration token
 */
export function markTokenAsUsed(
  token: RestorationToken,
  ipAddress?: string,
  userAgent?: string
): RestorationToken {
  const now = Date.now()

  return {
    ...token,
    used: true,
    used_at: now,
    used_ip_address: ipAddress ?? null,
    used_user_agent: userAgent ?? null,
    updated_at: now,
  }
}

/**
 * Increment access attempt counter for rate limiting
 *
 * @param token - Restoration token
 * @returns Updated restoration token with incremented attempt counter
 */
export function incrementAccessAttempt(token: RestorationToken): RestorationToken {
  const now = Date.now()

  // Reset attempts if outside rate limit window
  if (
    token.last_attempt_at &&
    now - token.last_attempt_at >= RATE_LIMIT_WINDOW_MS
  ) {
    return {
      ...token,
      access_attempts: 1,
      last_attempt_at: now,
      updated_at: now,
    }
  }

  return {
    ...token,
    access_attempts: token.access_attempts + 1,
    last_attempt_at: now,
    updated_at: now,
  }
}

/**
 * Get user-friendly error message for token validation failure
 * Uses Steadiness communication style (patient, never blame user)
 *
 * @param result - Token validation result
 * @returns User-friendly error message
 */
export function getTokenErrorMessage(result: TokenValidationResult): string {
  switch (result.reason) {
    case 'expired':
      return "This restoration link has expired. Restoration links work for 7 days. Would you like to request a new one?"
    case 'used':
      return "This restoration link has already been used. Each link works only once for security. Need help? Contact support."
    case 'not_found':
      return "We couldn't find that restoration link. Double-check the link from your email and try again."
    case 'invalid_hash':
      return "This restoration link doesn't look right. Make sure you're using the complete link from your email."
    case 'rate_limited':
      return "Too many attempts. For security, please wait an hour before trying again. Need help? Contact support."
    default:
      return "Something unexpected happened. Please try again, or contact support if this continues."
  }
}

/**
 * Format remaining time for user display
 *
 * @param milliseconds - Remaining time in milliseconds
 * @returns User-friendly time string
 */
export function formatRemainingTime(milliseconds: number): string {
  const hours = Math.floor(milliseconds / (60 * 60 * 1000))
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'}`
  }
  if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }
  return 'less than an hour'
}

/**
 * Calculate token statistics for admin dashboard
 *
 * @param tokens - All restoration tokens
 * @returns Token statistics
 */
export function calculateTokenStatistics(
  tokens: RestorationToken[]
): TokenStatistics {
  const now = Date.now()

  const totalCreated = tokens.length
  const totalUsed = tokens.filter((t) => t.used).length
  const totalExpired = tokens.filter((t) => !t.used && isTokenExpired(t)).length
  const totalActive = tokens.filter(
    (t) => !t.used && !isTokenExpired(t)
  ).length

  // Calculate average usage time (creation to usage)
  const usedTokens = tokens.filter((t) => t.used && t.used_at)
  const averageUsageTime =
    usedTokens.length > 0
      ? usedTokens.reduce((sum, t) => sum + (t.used_at! - t.created_at), 0) /
        usedTokens.length
      : 0

  return {
    totalCreated,
    totalUsed,
    totalExpired,
    totalActive,
    averageUsageTime,
  }
}

/**
 * Clean up expired tokens (for periodic maintenance)
 * Returns IDs of tokens that should be deleted
 *
 * @param tokens - All restoration tokens
 * @param retentionDays - How many days to keep expired/used tokens for audit (default: 30)
 * @returns Array of token IDs to delete
 */
export function getExpiredTokensForCleanup(
  tokens: RestorationToken[],
  retentionDays: number = 30
): string[] {
  const now = Date.now()
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000

  return tokens
    .filter((token) => {
      // Keep if not expired and not used (active tokens)
      if (!token.used && !isTokenExpired(token)) {
        return false
      }

      // Check if expired/used token is past retention period
      const ageMs = now - token.created_at
      return ageMs > retentionMs
    })
    .map((token) => token.id)
}
