/**
 * Security middleware for Audacious Money backend
 *
 * Provides security headers, CORS configuration, and request ID generation
 */

import { Context, Next } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import crypto from 'crypto';

/**
 * Security headers middleware
 * Applies helmet-style security headers to all responses
 */
export function securityHeadersMiddleware() {
  return secureHeaders({
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    xXssProtection: '1; mode=block',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    referrerPolicy: 'strict-origin-when-cross-origin',
  });
}

/**
 * CORS middleware configuration
 * Only allows requests from configured origins
 */
export function corsMiddleware() {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

  if (allowedOrigins.length === 0) {
    console.warn('[Security] No ALLOWED_ORIGINS configured. CORS will reject all cross-origin requests.');
  }

  return cors({
    origin: (origin) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return null;

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return origin;
      }

      // Reject all other origins
      return null;
    },
    credentials: true,
    maxAge: 600, // 10 minutes
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  });
}

/**
 * Request ID middleware
 * Generates unique request ID for tracing and logging
 */
export async function requestIdMiddleware(c: Context, next: Next) {
  const requestId = c.req.header('X-Request-ID') || generateRequestId();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  await next();
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return crypto.randomBytes(16).toString('hex');
}
