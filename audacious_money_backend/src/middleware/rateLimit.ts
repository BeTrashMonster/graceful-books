/**
 * Rate limiting middleware
 *
 * Prevents abuse by limiting the number of requests from a single IP
 */

import { Context, Next } from 'hono';
import { ErrorCodes, ErrorMessages, tooManyRequests } from '../utils/responses.js';

interface RateLimitConfig {
  max: number; // Maximum requests
  window: number; // Window in seconds
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// For production, consider using Redis
const store = new Map<string, RateLimitEntry>();

/**
 * Rate limiter middleware factory
 *
 * @param config - Rate limit configuration
 * @returns Middleware function
 */
export function rateLimiter(config: RateLimitConfig) {
  const { max, window } = config;
  const windowMs = window * 1000; // Convert to milliseconds

  return async (c: Context, next: Next) => {
    const key = getClientKey(c);
    const now = Date.now();

    // Clean up expired entries periodically
    cleanupExpiredEntries(now);

    // Get or create rate limit entry
    let entry = store.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired entry
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      store.set(key, entry);
    } else {
      // Increment count
      entry.count += 1;
    }

    // Calculate remaining requests
    const remaining = Math.max(0, max - entry.count);
    const resetTime = Math.ceil((entry.resetTime - now) / 1000);

    // Set rate limit headers
    c.header('X-RateLimit-Limit', max.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', resetTime.toString());

    // Check if limit exceeded
    if (entry.count > max) {
      return tooManyRequests(
        c,
        ErrorCodes.RATE_LIMITED,
        `${ErrorMessages.RATE_LIMITED} Limit: ${max} requests per ${window} seconds.`
      );
    }

    await next();
  };
}

/**
 * Get client identifier for rate limiting
 * Uses IP address as the key
 */
function getClientKey(c: Context): string {
  // Try to get real IP from proxy headers
  const forwardedFor = c.req.header('x-forwarded-for');
  const realIp = c.req.header('x-real-ip');
  const cfConnectingIp = c.req.header('cf-connecting-ip'); // Cloudflare

  const ip = cfConnectingIp || realIp || forwardedFor?.split(',')[0] || 'unknown';

  return `ratelimit:${ip}`;
}

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(now: number): void {
  // Only cleanup every 60 seconds to avoid performance impact
  const lastCleanup = (cleanupExpiredEntries as any).lastCleanup || 0;
  if (now - lastCleanup < 60000) {
    return;
  }

  (cleanupExpiredEntries as any).lastCleanup = now;

  for (const [key, entry] of store.entries()) {
    if (entry.resetTime < now) {
      store.delete(key);
    }
  }
}

/**
 * Clear all rate limit data (useful for testing)
 */
export function clearRateLimitStore(): void {
  store.clear();
}
