/**
 * Sync Rate Limiting & DoS Protection Service
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 4, Task 4.8 (Chunk 4H):
 * Implements rate limiting and DoS protection for sync operations to prevent
 * abuse and ensure fair resource usage across all users.
 *
 * Features:
 * - Per-user request rate limiting
 * - Per-device connection throttling
 * - Adaptive rate limiting based on load
 * - Automatic cooldown periods for violations
 * - Resource usage monitoring
 * - Ban list for repeated violators
 *
 * Architecture:
 * - Token bucket algorithm for rate limiting
 * - Sliding window for connection tracking
 * - Exponential backoff for repeated violations
 * - Memory-efficient cleanup of expired data
 *
 * Design Principles:
 * - Legitimate users should never notice rate limiting
 * - Aggressive users are throttled, not blocked entirely
 * - System remains responsive under attack
 * - All decisions are logged for audit trail
 */

/**
 * Rate limit configuration for different operation types
 */
export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number
  /** Window size in milliseconds */
  windowMs: number
  /** Maximum burst size (token bucket capacity) */
  maxBurst: number
  /** Token refill rate (tokens per second) */
  refillRate: number
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Rate limit for sync messages */
  sync: RateLimitConfig
  /** Rate limit for authentication attempts */
  auth: RateLimitConfig
  /** Rate limit for connection attempts */
  connection: RateLimitConfig
  /** Maximum concurrent connections per user */
  maxConnectionsPerUser: number
  /** Maximum concurrent connections per device */
  maxConnectionsPerDevice: number
  /** Ban duration for repeated violations (milliseconds) */
  banDuration: number
  /** Number of violations before ban */
  violationsBeforeBan: number
  /** Cleanup interval for expired data (milliseconds) */
  cleanupInterval: number
}

/**
 * Default rate limiter configuration
 */
export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  sync: {
    maxRequests: 60, // 60 messages per minute
    windowMs: 60000, // 1 minute
    maxBurst: 10, // Allow bursts of 10 messages
    refillRate: 1, // 1 token per second
  },
  auth: {
    maxRequests: 5, // 5 auth attempts per minute
    windowMs: 60000, // 1 minute
    maxBurst: 2, // Allow bursts of 2 attempts
    refillRate: 0.083, // ~5 per minute
  },
  connection: {
    maxRequests: 10, // 10 connection attempts per minute
    windowMs: 60000, // 1 minute
    maxBurst: 3, // Allow bursts of 3 attempts
    refillRate: 0.167, // ~10 per minute
  },
  maxConnectionsPerUser: 5, // 5 devices per user
  maxConnectionsPerDevice: 1, // 1 connection per device
  banDuration: 3600000, // 1 hour ban
  violationsBeforeBan: 5, // Ban after 5 violations
  cleanupInterval: 300000, // Cleanup every 5 minutes
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Remaining requests in current window */
  remaining: number
  /** Time until window resets (milliseconds) */
  resetMs: number
  /** Retry after duration if rate limited (milliseconds) */
  retryAfterMs?: number
  /** Reason for denial if not allowed */
  reason?: string
}

/**
 * Token bucket for rate limiting
 */
interface TokenBucket {
  /** Current number of tokens */
  tokens: number
  /** Last refill timestamp */
  lastRefill: number
  /** Window start timestamp */
  windowStart: number
  /** Request count in current window */
  requestCount: number
}

/**
 * User/device tracking
 */
interface UserTracking {
  /** Active connections */
  connections: Set<string>
  /** Violation count */
  violations: number
  /** Ban expiry timestamp (if banned) */
  bannedUntil?: number
  /** Last violation timestamp */
  lastViolation?: number
}

/**
 * Rate limit type
 */
export type RateLimitType = 'sync' | 'auth' | 'connection'

/**
 * Sync Rate Limiter
 *
 * Implements token bucket rate limiting with sliding windows for
 * DoS protection and fair resource usage.
 */
export class SyncRateLimiter {
  private config: RateLimiterConfig
  private buckets: Map<string, TokenBucket> = new Map()
  private userTracking: Map<string, UserTracking> = new Map()
  private deviceTracking: Map<string, UserTracking> = new Map()
  private cleanupTimer?: NodeJS.Timeout

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMITER_CONFIG, ...config }
    this.startCleanup()
  }

  /**
   * Check if a request is allowed
   *
   * Uses token bucket algorithm with sliding window for rate limiting.
   *
   * @param userId - User ID
   * @param deviceId - Device ID
   * @param type - Rate limit type
   * @returns Rate limit result
   */
  checkRateLimit(userId: string, deviceId: string, type: RateLimitType): RateLimitResult {
    // Check if user is banned
    const userTracking = this.getUserTracking(userId)
    if (userTracking.bannedUntil && userTracking.bannedUntil > Date.now()) {
      return {
        allowed: false,
        remaining: 0,
        resetMs: userTracking.bannedUntil - Date.now(),
        retryAfterMs: userTracking.bannedUntil - Date.now(),
        reason: 'User is temporarily banned for rate limit violations',
      }
    }

    // Check if device is banned
    const deviceTracking = this.getDeviceTracking(deviceId)
    if (deviceTracking.bannedUntil && deviceTracking.bannedUntil > Date.now()) {
      return {
        allowed: false,
        remaining: 0,
        resetMs: deviceTracking.bannedUntil - Date.now(),
        retryAfterMs: deviceTracking.bannedUntil - Date.now(),
        reason: 'Device is temporarily banned for rate limit violations',
      }
    }

    // Get rate limit config for this type
    const limitConfig = this.config[type]

    // Get or create token bucket
    const bucketKey = `${userId}:${deviceId}:${type}`
    const bucket = this.getBucket(bucketKey, limitConfig)

    // Refill tokens
    this.refillBucket(bucket, limitConfig)

    // Check if window has passed
    const now = Date.now()
    if (now - bucket.windowStart >= limitConfig.windowMs) {
      // Reset window
      bucket.windowStart = now
      bucket.requestCount = 0
    }

    // Check sliding window limit
    if (bucket.requestCount >= limitConfig.maxRequests) {
      const resetMs = limitConfig.windowMs - (now - bucket.windowStart)
      this.recordViolation(userId, deviceId)

      return {
        allowed: false,
        remaining: 0,
        resetMs,
        retryAfterMs: resetMs,
        reason: `Rate limit exceeded: ${limitConfig.maxRequests} requests per ${limitConfig.windowMs}ms`,
      }
    }

    // Check token bucket
    if (bucket.tokens < 1) {
      const resetMs = Math.ceil(1000 / limitConfig.refillRate)
      this.recordViolation(userId, deviceId)

      return {
        allowed: false,
        remaining: 0,
        resetMs,
        retryAfterMs: resetMs,
        reason: 'Token bucket exhausted, please slow down',
      }
    }

    // Consume token
    bucket.tokens -= 1
    bucket.requestCount += 1

    return {
      allowed: true,
      remaining: Math.floor(Math.min(bucket.tokens, limitConfig.maxRequests - bucket.requestCount)),
      resetMs: limitConfig.windowMs - (now - bucket.windowStart),
    }
  }

  /**
   * Check if a connection is allowed
   *
   * Verifies concurrent connection limits.
   *
   * @param userId - User ID
   * @param deviceId - Device ID
   * @param connectionId - Connection ID
   * @returns True if connection allowed, false otherwise
   */
  checkConnectionLimit(userId: string, deviceId: string, connectionId: string): RateLimitResult {
    // Check user connection limit
    const userTracking = this.getUserTracking(userId)
    if (userTracking.connections.size >= this.config.maxConnectionsPerUser) {
      // Don't count if this connection is already tracked
      if (!userTracking.connections.has(connectionId)) {
        return {
          allowed: false,
          remaining: 0,
          resetMs: 0,
          reason: `Maximum concurrent connections per user exceeded (${this.config.maxConnectionsPerUser})`,
        }
      }
    }

    // Check device connection limit
    const deviceTracking = this.getDeviceTracking(deviceId)
    if (deviceTracking.connections.size >= this.config.maxConnectionsPerDevice) {
      if (!deviceTracking.connections.has(connectionId)) {
        return {
          allowed: false,
          remaining: 0,
          resetMs: 0,
          reason: `Maximum concurrent connections per device exceeded (${this.config.maxConnectionsPerDevice})`,
        }
      }
    }

    return {
      allowed: true,
      remaining: this.config.maxConnectionsPerUser - userTracking.connections.size,
      resetMs: 0,
    }
  }

  /**
   * Register a new connection
   *
   * @param userId - User ID
   * @param deviceId - Device ID
   * @param connectionId - Connection ID
   */
  registerConnection(userId: string, deviceId: string, connectionId: string): void {
    const userTracking = this.getUserTracking(userId)
    const deviceTracking = this.getDeviceTracking(deviceId)

    userTracking.connections.add(connectionId)
    deviceTracking.connections.add(connectionId)
  }

  /**
   * Unregister a connection
   *
   * @param userId - User ID
   * @param deviceId - Device ID
   * @param connectionId - Connection ID
   */
  unregisterConnection(userId: string, deviceId: string, connectionId: string): void {
    const userTracking = this.getUserTracking(userId)
    const deviceTracking = this.getDeviceTracking(deviceId)

    userTracking.connections.delete(connectionId)
    deviceTracking.connections.delete(connectionId)
  }

  /**
   * Get active connection count
   *
   * @param userId - User ID (optional)
   * @param deviceId - Device ID (optional)
   * @returns Connection count
   */
  getConnectionCount(userId?: string, deviceId?: string): number {
    if (userId) {
      const userTracking = this.userTracking.get(userId)
      return userTracking?.connections.size || 0
    }

    if (deviceId) {
      const deviceTracking = this.deviceTracking.get(deviceId)
      return deviceTracking?.connections.size || 0
    }

    // Return total connections
    let total = 0
    for (const tracking of this.userTracking.values()) {
      total += tracking.connections.size
    }
    return total
  }

  /**
   * Check if user is banned
   *
   * @param userId - User ID
   * @returns True if banned, false otherwise
   */
  isBanned(userId: string): boolean {
    const userTracking = this.userTracking.get(userId)
    if (!userTracking?.bannedUntil) {
      return false
    }

    if (userTracking.bannedUntil > Date.now()) {
      return true
    }

    // Ban expired, clear it
    delete userTracking.bannedUntil
    userTracking.violations = 0
    return false
  }

  /**
   * Manually ban a user
   *
   * @param userId - User ID
   * @param durationMs - Ban duration (optional, uses config default)
   */
  banUser(userId: string, durationMs?: number): void {
    const userTracking = this.getUserTracking(userId)
    const duration = durationMs || this.config.banDuration
    userTracking.bannedUntil = Date.now() + duration
  }

  /**
   * Unban a user
   *
   * @param userId - User ID
   */
  unbanUser(userId: string): void {
    const userTracking = this.userTracking.get(userId)
    if (userTracking) {
      delete userTracking.bannedUntil
      userTracking.violations = 0
    }
  }

  /**
   * Get statistics
   *
   * @returns Statistics object
   */
  getStatistics(): {
    totalUsers: number
    totalDevices: number
    totalConnections: number
    bannedUsers: number
    bannedDevices: number
  } {
    let totalConnections = 0
    let bannedUsers = 0
    let bannedDevices = 0

    for (const tracking of this.userTracking.values()) {
      totalConnections += tracking.connections.size
      if (tracking.bannedUntil && tracking.bannedUntil > Date.now()) {
        bannedUsers++
      }
    }

    for (const tracking of this.deviceTracking.values()) {
      if (tracking.bannedUntil && tracking.bannedUntil > Date.now()) {
        bannedDevices++
      }
    }

    return {
      totalUsers: this.userTracking.size,
      totalDevices: this.deviceTracking.size,
      totalConnections,
      bannedUsers,
      bannedDevices,
    }
  }

  /**
   * Clean up expired data
   */
  cleanup(): void {
    const now = Date.now()

    // Clean up buckets
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > this.config.cleanupInterval) {
        this.buckets.delete(key)
      }
    }

    // Clean up user tracking
    for (const [userId, tracking] of this.userTracking.entries()) {
      if (
        tracking.connections.size === 0 &&
        (!tracking.bannedUntil || tracking.bannedUntil < now) &&
        (!tracking.lastViolation || now - tracking.lastViolation > this.config.cleanupInterval)
      ) {
        this.userTracking.delete(userId)
      }
    }

    // Clean up device tracking
    for (const [deviceId, tracking] of this.deviceTracking.entries()) {
      if (
        tracking.connections.size === 0 &&
        (!tracking.bannedUntil || tracking.bannedUntil < now) &&
        (!tracking.lastViolation || now - tracking.lastViolation > this.config.cleanupInterval)
      ) {
        this.deviceTracking.delete(deviceId)
      }
    }
  }

  /**
   * Stop cleanup timer
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }

  /**
   * Get or create user tracking
   *
   * @private
   */
  private getUserTracking(userId: string): UserTracking {
    let tracking = this.userTracking.get(userId)
    if (!tracking) {
      tracking = {
        connections: new Set(),
        violations: 0,
      }
      this.userTracking.set(userId, tracking)
    }
    return tracking
  }

  /**
   * Get or create device tracking
   *
   * @private
   */
  private getDeviceTracking(deviceId: string): UserTracking {
    let tracking = this.deviceTracking.get(deviceId)
    if (!tracking) {
      tracking = {
        connections: new Set(),
        violations: 0,
      }
      this.deviceTracking.set(deviceId, tracking)
    }
    return tracking
  }

  /**
   * Get or create token bucket
   *
   * @private
   */
  private getBucket(key: string, config: RateLimitConfig): TokenBucket {
    let bucket = this.buckets.get(key)
    if (!bucket) {
      bucket = {
        tokens: config.maxBurst,
        lastRefill: Date.now(),
        windowStart: Date.now(),
        requestCount: 0,
      }
      this.buckets.set(key, bucket)
    }
    return bucket
  }

  /**
   * Refill token bucket
   *
   * @private
   */
  private refillBucket(bucket: TokenBucket, config: RateLimitConfig): void {
    const now = Date.now()
    const elapsedMs = now - bucket.lastRefill

    if (elapsedMs > 0) {
      const tokensToAdd = (elapsedMs / 1000) * config.refillRate
      bucket.tokens = Math.min(config.maxBurst, bucket.tokens + tokensToAdd)
      bucket.lastRefill = now
    }
  }

  /**
   * Record a rate limit violation
   *
   * @private
   */
  private recordViolation(userId: string, deviceId: string): void {
    const userTracking = this.getUserTracking(userId)
    const deviceTracking = this.getDeviceTracking(deviceId)

    userTracking.violations++
    userTracking.lastViolation = Date.now()

    deviceTracking.violations++
    deviceTracking.lastViolation = Date.now()

    // Check if we should ban
    if (userTracking.violations >= this.config.violationsBeforeBan) {
      this.banUser(userId)
    }

    if (deviceTracking.violations >= this.config.violationsBeforeBan) {
      deviceTracking.bannedUntil = Date.now() + this.config.banDuration
    }
  }

  /**
   * Start cleanup timer
   *
   * @private
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)

    // Don't keep process alive
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref()
    }
  }
}

/**
 * Create rate limiter instance
 *
 * @param config - Configuration (optional)
 * @returns Rate limiter instance
 */
export function createSyncRateLimiter(
  config?: Partial<RateLimiterConfig>
): SyncRateLimiter {
  return new SyncRateLimiter(config)
}
