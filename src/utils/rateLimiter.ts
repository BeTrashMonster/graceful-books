/**
 * Rate Limiter for Security-Critical Operations
 *
 * Implements sliding window rate limiting to prevent:
 * - Client-side DoS attacks through expensive encryption operations
 * - Brute force attacks on login
 * - Data scraping through excessive queries
 * - Resource exhaustion through batch operations
 *
 * Security Fixes:
 * - M-4: Rate Limiting on Encryption Operations
 * - S5-3: Rate Limiting Enhancement (login, data access, batch queries, CPG calculations)
 */

import type { logRateLimitExceeded, RateLimitExceededDetails, SecurityLogDatabase } from './securityLogger'

/**
 * Configuration for rate limiting an operation
 */
export interface RateLimitConfig {
  /** Maximum number of operations allowed in the time window */
  maxOperations: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the operation is allowed */
  allowed: boolean;
  /** Time in milliseconds to wait before retrying (if not allowed) */
  waitTimeMs?: number;
  /** Number of remaining operations in the current window */
  remaining?: number;
  /** Timestamp when the window resets */
  resetsAt?: number;
}

/**
 * Rate limit error thrown when operation is blocked
 */
export class RateLimitError extends Error {
  /** Time to wait before retrying */
  readonly waitTimeMs: number;
  /** Operation that was rate limited */
  readonly operationKey: string;

  constructor(operationKey: string, waitTimeMs: number) {
    const seconds = Math.ceil(waitTimeMs / 1000);
    const message = `Rate limit exceeded for ${operationKey}. Please wait ${seconds} second${seconds !== 1 ? 's' : ''} before trying again.`;
    super(message);
    this.name = 'RateLimitError';
    this.waitTimeMs = waitTimeMs;
    this.operationKey = operationKey;
  }
}

/**
 * Pre-configured rate limits for crypto operations
 */
export const CRYPTO_RATE_LIMITS = {
  /** Key derivation: 5 operations per minute (computationally expensive) */
  keyDerivation: {
    maxOperations: 5,
    windowMs: 60 * 1000, // 1 minute
  } as RateLimitConfig,

  /** Batch encryption: 10 operations per minute */
  batchEncrypt: {
    maxOperations: 10,
    windowMs: 60 * 1000, // 1 minute
  } as RateLimitConfig,

  /** File encryption: 20 operations per minute */
  fileEncrypt: {
    maxOperations: 20,
    windowMs: 60 * 1000, // 1 minute
  } as RateLimitConfig,

  /** Re-encryption (key rotation): 5 operations per minute */
  reencrypt: {
    maxOperations: 5,
    windowMs: 60 * 1000, // 1 minute
  } as RateLimitConfig,
} as const;

/**
 * Pre-configured rate limits for security operations (S5-3)
 */
export const SECURITY_RATE_LIMITS = {
  /** Login attempts: 5 per minute per user (prevent brute force) */
  login: {
    maxOperations: 5,
    windowMs: 60 * 1000, // 1 minute
  } as RateLimitConfig,

  /** Data access operations: 100 per minute per user (prevent data scraping) */
  dataAccess: {
    maxOperations: 100,
    windowMs: 60 * 1000, // 1 minute
  } as RateLimitConfig,

  /** Batch queries: 10 per minute per user (prevent resource exhaustion) */
  batchQuery: {
    maxOperations: 10,
    windowMs: 60 * 1000, // 1 minute
  } as RateLimitConfig,

  /** CPG calculations: 50 per hour per user (prevent computational abuse) */
  cpgCalculation: {
    maxOperations: 50,
    windowMs: 60 * 60 * 1000, // 1 hour
  } as RateLimitConfig,

  /** Data exports: 10 per hour per user (S7-3: prevent bulk data scraping via export) */
  dataExport: {
    maxOperations: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
  } as RateLimitConfig,
} as const;

/**
 * Sliding window rate limiter
 *
 * Uses a sliding window algorithm to track operation timestamps and
 * enforce rate limits. Includes automatic cleanup of expired entries.
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter();
 *
 * const result = await limiter.check('keyDerivation', CRYPTO_RATE_LIMITS.keyDerivation);
 * if (!result.allowed) {
 *   console.log(`Wait ${result.waitTimeMs}ms before retrying`);
 * }
 * ```
 */
export class RateLimiter {
  /** Map of operation keys to arrays of timestamps */
  private operations: Map<string, number[]> = new Map();

  /** Interval ID for periodic cleanup */
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  /** Cleanup interval in milliseconds (default: 5 minutes) */
  private readonly cleanupIntervalMs: number;

  /** Whether the rate limiter is enabled */
  private enabled: boolean = true;

  /**
   * Create a new rate limiter
   *
   * @param cleanupIntervalMs - How often to clean up expired entries (default: 5 minutes)
   */
  constructor(cleanupIntervalMs: number = 5 * 60 * 1000) {
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.startCleanupInterval();
  }

  /**
   * Check if an operation is allowed and record it
   *
   * Uses a sliding window algorithm to determine if the operation
   * should be allowed based on recent activity.
   *
   * @param operationKey - Unique identifier for the operation type
   * @param config - Rate limit configuration
   * @param userId - Optional user ID for user-specific rate limiting
   * @returns Promise resolving to rate limit result
   *
   * @example
   * ```typescript
   * const result = await limiter.check('keyDerivation', {
   *   maxOperations: 5,
   *   windowMs: 60000
   * });
   *
   * if (result.allowed) {
   *   await deriveMasterKey(passphrase);
   * } else {
   *   showError(`Please wait ${result.waitTimeMs}ms`);
   * }
   *
   * // User-specific rate limiting
   * const loginResult = await limiter.check('login', SECURITY_RATE_LIMITS.login, 'user-123');
   * ```
   */
  async check(operationKey: string, config: RateLimitConfig, userId?: string): Promise<RateLimitResult> {
    // If rate limiting is disabled, always allow
    if (!this.enabled) {
      return { allowed: true, remaining: config.maxOperations };
    }

    // Create a composite key if userId is provided
    const key = userId ? `${operationKey}:${userId}` : operationKey;

    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get existing timestamps for this operation
    let timestamps = this.operations.get(key) || [];

    // Filter out timestamps outside the current window (sliding window)
    timestamps = timestamps.filter((ts) => ts > windowStart);

    // Check if we're at the limit
    if (timestamps.length >= config.maxOperations) {
      // Find the oldest timestamp in the window
      const oldestTimestamp = Math.min(...timestamps);
      const waitTimeMs = oldestTimestamp + config.windowMs - now;

      return {
        allowed: false,
        waitTimeMs: Math.max(0, waitTimeMs),
        remaining: 0,
        resetsAt: oldestTimestamp + config.windowMs,
      };
    }

    // Record this operation
    timestamps.push(now);
    this.operations.set(key, timestamps);

    return {
      allowed: true,
      remaining: config.maxOperations - timestamps.length,
      resetsAt: timestamps[0]! + config.windowMs,
    };
  }

  /**
   * Check rate limit and throw if exceeded
   *
   * Convenience method that throws a RateLimitError if the operation
   * is not allowed, making it easy to use with try/catch.
   *
   * @param operationKey - Unique identifier for the operation type
   * @param config - Rate limit configuration
   * @param userId - Optional user ID for user-specific rate limiting
   * @throws RateLimitError if rate limit is exceeded
   *
   * @example
   * ```typescript
   * try {
   *   await limiter.checkOrThrow('keyDerivation', CRYPTO_RATE_LIMITS.keyDerivation);
   *   await deriveMasterKey(passphrase);
   * } catch (error) {
   *   if (error instanceof RateLimitError) {
   *     showMessage(`Please wait ${error.waitTimeMs}ms`);
   *   }
   * }
   * ```
   */
  async checkOrThrow(operationKey: string, config: RateLimitConfig, userId?: string): Promise<void> {
    const result = await this.check(operationKey, config, userId);
    if (!result.allowed) {
      throw new RateLimitError(operationKey, result.waitTimeMs || 0);
    }
  }

  /**
   * Check rate limit with security logging integration
   *
   * This method checks the rate limit and logs violations to the security audit log.
   * Integrates with S5-2 Security Event Logging.
   *
   * @param operationKey - Unique identifier for the operation type
   * @param config - Rate limit configuration
   * @param options - Options for security logging
   * @returns Promise resolving to rate limit result
   *
   * @example
   * ```typescript
   * const result = await limiter.checkWithLogging(
   *   'login',
   *   SECURITY_RATE_LIMITS.login,
   *   {
   *     userId: 'user-123',
   *     db: database,
   *     logRateLimitExceeded,
   *     endpoint: '/api/auth/login'
   *   }
   * );
   *
   * if (!result.allowed) {
   *   return { error: 'Too many login attempts. Please wait before trying again.' };
   * }
   * ```
   */
  async checkWithLogging(
    operationKey: string,
    config: RateLimitConfig,
    options: {
      userId?: string;
      db?: SecurityLogDatabase;
      logRateLimitExceeded?: typeof logRateLimitExceeded;
      endpoint?: string;
    }
  ): Promise<RateLimitResult> {
    const result = await this.check(operationKey, config, options.userId);

    // Log rate limit violation if exceeded and logging is configured
    if (!result.allowed && options.db && options.logRateLimitExceeded) {
      const details: RateLimitExceededDetails = {
        endpoint: options.endpoint,
        limit: config.maxOperations,
        windowSeconds: Math.floor(config.windowMs / 1000),
        attemptCount: config.maxOperations + 1, // They exceeded by at least 1
      };

      // Log asynchronously - don't block the rate limit check
      options.logRateLimitExceeded(details, options.db).catch((error) => {
        // Ignore logging errors - they shouldn't prevent rate limiting from working
        console.error('Failed to log rate limit violation:', error);
      });
    }

    return result;
  }

  /**
   * Check rate limit with security logging and throw if exceeded
   *
   * Combines checkWithLogging and checkOrThrow for convenience.
   *
   * @param operationKey - Unique identifier for the operation type
   * @param config - Rate limit configuration
   * @param options - Options for security logging
   * @throws RateLimitError if rate limit is exceeded
   *
   * @example
   * ```typescript
   * try {
   *   await limiter.checkWithLoggingOrThrow(
   *     'login',
   *     SECURITY_RATE_LIMITS.login,
   *     {
   *       userId: email,
   *       db: database,
   *       logRateLimitExceeded,
   *       endpoint: '/api/auth/login'
   *     }
   *   );
   *   // Proceed with login
   * } catch (error) {
   *   if (error instanceof RateLimitError) {
   *     return { error: 'Too many attempts. Please wait.' };
   *   }
   * }
   * ```
   */
  async checkWithLoggingOrThrow(
    operationKey: string,
    config: RateLimitConfig,
    options: {
      userId?: string;
      db?: SecurityLogDatabase;
      logRateLimitExceeded?: typeof logRateLimitExceeded;
      endpoint?: string;
    }
  ): Promise<void> {
    const result = await this.checkWithLogging(operationKey, config, options);
    if (!result.allowed) {
      throw new RateLimitError(operationKey, result.waitTimeMs || 0);
    }
  }

  /**
   * Get the current quota status for an operation
   *
   * Useful for displaying remaining quota in the UI without
   * recording a new operation.
   *
   * @param operationKey - Unique identifier for the operation type
   * @param config - Rate limit configuration
   * @param userId - Optional user ID for user-specific rate limiting
   * @returns Current quota status
   *
   * @example
   * ```typescript
   * const status = limiter.getQuotaStatus('keyDerivation', CRYPTO_RATE_LIMITS.keyDerivation);
   * console.log(`${status.remaining} of ${status.maxOperations} operations remaining`);
   * ```
   */
  getQuotaStatus(
    operationKey: string,
    config: RateLimitConfig,
    userId?: string
  ): {
    remaining: number;
    maxOperations: number;
    resetsAt: number | null;
  } {
    if (!this.enabled) {
      return {
        remaining: config.maxOperations,
        maxOperations: config.maxOperations,
        resetsAt: null,
      };
    }

    // Create a composite key if userId is provided
    const key = userId ? `${operationKey}:${userId}` : operationKey;

    const now = Date.now();
    const windowStart = now - config.windowMs;

    let timestamps = this.operations.get(key) || [];
    timestamps = timestamps.filter((ts) => ts > windowStart);

    const remaining = Math.max(0, config.maxOperations - timestamps.length);
    const resetsAt = timestamps.length > 0 ? timestamps[0]! + config.windowMs : null;

    return {
      remaining,
      maxOperations: config.maxOperations,
      resetsAt,
    };
  }

  /**
   * Clear all recorded operations
   *
   * Useful for testing or when user state is reset.
   */
  clear(): void {
    this.operations.clear();
  }

  /**
   * Clear operations for a specific key
   *
   * @param operationKey - The operation key to clear
   */
  clearKey(operationKey: string): void {
    this.operations.delete(operationKey);
  }

  /**
   * Enable or disable rate limiting
   *
   * Useful for testing or development environments.
   *
   * @param enabled - Whether rate limiting should be enabled
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if rate limiting is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Clean up and destroy the rate limiter
   *
   * Stops the cleanup interval and clears all data.
   * Call this when the rate limiter is no longer needed.
   */
  destroy(): void {
    this.stopCleanupInterval();
    this.clear();
  }

  /**
   * Start the periodic cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupIntervalId === null) {
      this.cleanupIntervalId = setInterval(() => {
        this.cleanupExpiredEntries();
      }, this.cleanupIntervalMs);
    }
  }

  /**
   * Stop the periodic cleanup interval
   */
  private stopCleanupInterval(): void {
    if (this.cleanupIntervalId !== null) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  /**
   * Remove expired entries from all operations
   *
   * This is called periodically to prevent memory leaks from
   * accumulating old timestamps.
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();

    // Find the maximum window size across all known configs
    // Default to 1 minute if no specific configs are known
    const maxWindowMs = 60 * 1000;

    const oldestAllowed = now - maxWindowMs;

    // Convert entries to array to avoid iteration issues
    const entries = Array.from(this.operations.entries());
    for (const [key, timestamps] of entries) {
      const validTimestamps = timestamps.filter((ts) => ts > oldestAllowed);

      if (validTimestamps.length === 0) {
        this.operations.delete(key);
      } else if (validTimestamps.length < timestamps.length) {
        this.operations.set(key, validTimestamps);
      }
    }
  }
}

/**
 * Singleton rate limiter instance for global use
 *
 * Pre-configured for crypto operations with automatic cleanup.
 */
export const rateLimiter = new RateLimiter();

/**
 * Create a rate-limited wrapper for a function
 *
 * Returns a new function that checks rate limits before executing.
 * Throws RateLimitError if the rate limit is exceeded.
 *
 * @param fn - The function to wrap
 * @param operationKey - Unique identifier for rate limiting
 * @param config - Rate limit configuration
 * @param limiter - Rate limiter instance (defaults to singleton)
 * @returns Rate-limited version of the function
 *
 * @example
 * ```typescript
 * const rateLimitedDerive = withRateLimit(
 *   deriveMasterKey,
 *   'keyDerivation',
 *   CRYPTO_RATE_LIMITS.keyDerivation
 * );
 *
 * try {
 *   const result = await rateLimitedDerive(passphrase);
 * } catch (error) {
 *   if (error instanceof RateLimitError) {
 *     // Handle rate limit
 *   }
 * }
 * ```
 */
export function withRateLimit<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  operationKey: string,
  config: RateLimitConfig,
  limiter: RateLimiter = rateLimiter
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    await limiter.checkOrThrow(operationKey, config);
    return fn(...args);
  };
}

/**
 * Format wait time for user-friendly display
 *
 * @param waitTimeMs - Wait time in milliseconds
 * @returns Human-readable wait time string
 *
 * @example
 * ```typescript
 * formatWaitTime(5000);  // "5 seconds"
 * formatWaitTime(90000); // "1 minute and 30 seconds"
 * formatWaitTime(500);   // "less than a second"
 * ```
 */
export function formatWaitTime(waitTimeMs: number): string {
  if (waitTimeMs < 1000) {
    return 'less than a second';
  }

  const seconds = Math.ceil(waitTimeMs / 1000);

  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  return `${minutes} minute${minutes !== 1 ? 's' : ''} and ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
}
