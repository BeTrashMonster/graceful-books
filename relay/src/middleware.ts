/**
 * Middleware for sync relay
 *
 * Requirements:
 * - Rate limiting
 * - Request validation
 * - SLA tracking
 * - Security headers
 */

import type { Context, Next } from 'hono';
import type { Env, ErrorCode, ErrorResponse, RateLimitInfo } from './types';
import { recordSLAMetric } from './database';

/**
 * Get client IP address
 */
function getClientIP(c: Context): string {
  return (
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For') ||
    'unknown'
  );
}

/**
 * Get region from Cloudflare
 */
function getRegion(c: Context): string {
  return c.req.header('CF-Ray')?.split('-')[1] || 'unknown';
}

/**
 * Rate limiting middleware
 */
export async function rateLimiter(c: Context<{ Bindings: Env }>, next: Next) {
  const env = c.env;
  const clientIP = getClientIP(c);
  const maxRequests = parseInt(env.MAX_REQUESTS_PER_MINUTE || '60', 10);
  const windowMs = 60 * 1000; // 1 minute

  try {
    // Get current rate limit info from KV
    const key = `rate_limit:${clientIP}`;
    const stored = await env.RATE_LIMIT.get(key);

    let rateLimitInfo: RateLimitInfo;

    if (stored) {
      rateLimitInfo = JSON.parse(stored);

      // Check if window has expired
      if (Date.now() - rateLimitInfo.window_start > windowMs) {
        // Reset window
        rateLimitInfo = {
          requests: 1,
          window_start: Date.now(),
          limit: maxRequests,
          remaining: maxRequests - 1,
          reset_at: Date.now() + windowMs,
        };
      } else {
        // Increment request count
        rateLimitInfo.requests++;
        rateLimitInfo.remaining = Math.max(0, maxRequests - rateLimitInfo.requests);
      }
    } else {
      // First request in window
      rateLimitInfo = {
        requests: 1,
        window_start: Date.now(),
        limit: maxRequests,
        remaining: maxRequests - 1,
        reset_at: Date.now() + windowMs,
      };
    }

    // Store updated rate limit info
    await env.RATE_LIMIT.put(key, JSON.stringify(rateLimitInfo), {
      expirationTtl: 120, // 2 minutes
    });

    // Add rate limit headers
    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
    c.header('X-RateLimit-Reset', rateLimitInfo.reset_at.toString());

    // Check if rate limit exceeded
    if (rateLimitInfo.requests > maxRequests) {
      const error: ErrorResponse = {
        error: {
          code: 'RATE_LIMIT_EXCEEDED' as ErrorCode,
          message: 'Rate limit exceeded. Please try again later.',
          details: {
            limit: maxRequests,
            reset_at: rateLimitInfo.reset_at,
          },
        },
        timestamp: Date.now(),
      };
      return c.json(error, 429);
    }

    await next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    // Continue on error - don't break the request
    await next();
  }
}

/**
 * Request size validator
 */
export async function validateRequestSize(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  const env = c.env;
  const maxSizeMB = parseInt(env.MAX_PAYLOAD_SIZE_MB || '10', 10);
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const contentLength = parseInt(c.req.header('Content-Length') || '0', 10);

  if (contentLength > maxSizeBytes) {
    const error: ErrorResponse = {
      error: {
        code: 'PAYLOAD_TOO_LARGE' as ErrorCode,
        message: `Request payload too large. Maximum size: ${maxSizeMB}MB`,
        details: {
          max_size_bytes: maxSizeBytes,
          actual_size_bytes: contentLength,
        },
      },
      timestamp: Date.now(),
    };
    return c.json(error, 413);
  }

  await next();
}

/**
 * CORS middleware
 */
export async function cors(c: Context, next: Next) {
  // Set CORS headers
  c.header('Access-Control-Allow-Origin', '*'); // TODO: Restrict in production
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Max-Age', '86400');

  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }

  await next();
}

/**
 * Security headers middleware
 */
export async function securityHeaders(c: Context, next: Next) {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'no-referrer');
  c.header(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  await next();
}

/**
 * SLA tracking middleware
 */
export async function slaTracking(c: Context<{ Bindings: Env }>, next: Next) {
  const startTime = Date.now();
  const env = c.env;
  const region = getRegion(c);

  await next();

  const responseTime = Date.now() - startTime;
  const success = c.res.status >= 200 && c.res.status < 400;

  // Record metric asynchronously (don't block response)
  c.executionCtx.waitUntil(
    recordSLAMetric(
      env,
      c.req.path,
      c.req.method,
      c.res.status,
      responseTime,
      region,
      success
    )
  );

  // Add response time header
  c.header('X-Response-Time', `${responseTime}ms`);
}

/**
 * Error handler middleware
 */
export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    console.error('Request error:', error);

    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR' as ErrorCode,
        message: 'An internal error occurred',
        details:
          c.env.ENVIRONMENT === 'development'
            ? {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
              }
            : undefined,
      },
      timestamp: Date.now(),
    };

    return c.json(errorResponse, 500);
  }
}

/**
 * Request logger middleware
 */
export async function requestLogger(c: Context, next: Next) {
  const startTime = Date.now();
  const { method, path } = c.req;

  await next();

  const duration = Date.now() - startTime;
  const { status } = c.res;

  console.log(`${method} ${path} ${status} ${duration}ms`);
}

/**
 * Protocol version validator
 */
export async function validateProtocol(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  const body = await c.req.json();
  const SYNC_PROTOCOL_VERSION = '1.0.0';

  if (
    body.protocol_version &&
    body.protocol_version !== SYNC_PROTOCOL_VERSION
  ) {
    const error: ErrorResponse = {
      error: {
        code: 'PROTOCOL_MISMATCH' as ErrorCode,
        message: 'Protocol version mismatch',
        details: {
          server_version: SYNC_PROTOCOL_VERSION,
          client_version: body.protocol_version,
        },
      },
      timestamp: Date.now(),
    };
    return c.json(error, 400);
  }

  // Restore body for route handlers
  c.req.bodyCache.json = body;

  await next();
}
