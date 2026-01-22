/**
 * Portal Service
 *
 * Provides customer portal functionality including:
 * - Cryptographically secure token generation
 * - Token validation and expiration
 * - Rate limiting per IP address
 * - Invoice access via portal links
 *
 * Requirements:
 * - H4: Client Portal
 * - 64-character cryptographically secure tokens
 * - 90-day token expiration
 * - Rate limiting (100 requests/hour per IP)
 */

import { nanoid } from 'nanoid';
import { db } from '../db/database';
import type { DatabaseResult } from '../store/types';
import type { PortalToken } from '../db/schema/portalTokens.schema';
import type { Invoice } from '../db/schema/invoices.schema';
import {
  createDefaultPortalToken,
  validatePortalToken,
  isTokenValid,
  TOKEN_LENGTH,
} from '../db/schema/portalTokens.schema';
import { getDeviceId } from '../utils/device';
import { incrementVersionVector } from '../db/crdt';
import { ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';

const portalLogger = logger.child('PortalService');

/**
 * Rate limit tracking
 * In production, this should be moved to Redis or similar
 */
interface RateLimitEntry {
  ip: string;
  requests: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 100;

/**
 * Generate a cryptographically secure 64-character token
 * Uses the Web Crypto API for secure random generation
 */
async function generateSecureToken(): Promise<string> {
  // Use crypto.getRandomValues for cryptographically secure randomness
  const array = new Uint8Array(32); // 32 bytes = 256 bits
  crypto.getRandomValues(array);

  // Convert to base64 and remove padding/special chars to get URL-safe token
  const base64 = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Ensure exactly 64 characters by adding nanoid if needed
  if (base64.length >= TOKEN_LENGTH) {
    return base64.substring(0, TOKEN_LENGTH);
  }

  // Pad with nanoid to reach 64 characters
  const padding = nanoid(TOKEN_LENGTH - base64.length);
  return base64 + padding;
}

/**
 * Check rate limit for an IP address
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  // Clean up old entries
  if (entry && now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.delete(ip);
  }

  const currentEntry = rateLimitStore.get(ip);

  if (!currentEntry) {
    // First request in this window
    rateLimitStore.set(ip, {
      ip,
      requests: 1,
      windowStart: now,
    });
    return true;
  }

  // Check if within limit
  if (currentEntry.requests >= RATE_LIMIT_MAX_REQUESTS) {
    portalLogger.warn('Rate limit exceeded', { ip, requests: currentEntry.requests });
    return false;
  }

  // Increment request count
  currentEntry.requests += 1;
  rateLimitStore.set(ip, currentEntry);
  return true;
}

/**
 * Record a portal access (rate limit already checked in validateToken)
 */
function recordAccess(ip: string): void {
  // Rate limit already checked, just track the access
  // The checkRateLimit call in validateToken handles both checking and incrementing
}

/**
 * Create a portal token for an invoice
 */
export async function createPortalToken(
  companyId: string,
  invoiceId: string,
  email: string
): Promise<DatabaseResult<PortalToken>> {
  try {
    // Verify invoice exists
    const invoice = await db.invoices.get(invoiceId);
    if (!invoice) {
      return {
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: `Invoice not found: ${invoiceId}`,
        },
      };
    }

    if (invoice.company_id !== companyId) {
      return {
        success: false,
        error: {
          code: ErrorCode.PERMISSION_DENIED,
          message: 'Invoice does not belong to this company',
        },
      };
    }

    // Check if a valid token already exists for this invoice
    const existingTokens = await db.portalTokens
      .where('[company_id+invoice_id]')
      .equals([companyId, invoiceId])
      .and((t) => !t.deleted_at && !t.revoked_at)
      .toArray();

    for (const existing of existingTokens) {
      if (isTokenValid(existing) && existing.email === email) {
        portalLogger.info('Reusing existing valid portal token', {
          tokenId: existing.id,
          invoiceId,
        });
        return { success: true, data: existing };
      }
    }

    // Generate new token
    const token = await generateSecureToken();
    const deviceId = getDeviceId();

    const portalToken: PortalToken = {
      id: nanoid(),
      ...createDefaultPortalToken(companyId, invoiceId, email, token, deviceId),
    } as any;

    // Validate
    const errors = validatePortalToken(portalToken);
    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Portal token validation failed: ${errors.join(', ')}`,
        },
      };
    }

    // Store in database
    await db.portalTokens.add(portalToken);

    portalLogger.info('Created portal token', {
      tokenId: portalToken.id,
      invoiceId,
      email,
    });

    return { success: true, data: portalToken };
  } catch (error) {
    portalLogger.error('Failed to create portal token', { error });
    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Validate a portal token and return the associated invoice
 */
export async function validateToken(
  token: string,
  ipAddress: string
): Promise<DatabaseResult<{ token: PortalToken; invoice: Invoice }>> {
  try {
    // Check rate limit
    if (!checkRateLimit(ipAddress)) {
      return {
        success: false,
        error: {
          code: ErrorCode.RATE_LIMITED,
          message: "We've noticed a few attempts. For your security, please wait a moment.",
        },
      };
    }

    // Find token
    const portalToken = await db.portalTokens.where('token').equals(token).first();

    if (!portalToken) {
      portalLogger.warn('Token not found', { token: token.substring(0, 8) + '...' });
      return {
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Invalid or expired portal link. Please request a new one.',
        },
      };
    }

    // Check if token is valid
    if (!isTokenValid(portalToken)) {
      portalLogger.warn('Token is invalid', {
        tokenId: portalToken.id,
        expired: portalToken.expires_at < Date.now(),
        revoked: !!portalToken.revoked_at,
        deleted: !!portalToken.deleted_at,
      });
      return {
        success: false,
        error: {
          code: ErrorCode.SESSION_INVALID,
          message: 'This portal link has expired or been revoked. Please request a new one.',
        },
      };
    }

    // Get associated invoice
    const invoice = await db.invoices.get(portalToken.invoice_id);
    if (!invoice) {
      portalLogger.error('Invoice not found for valid token', {
        tokenId: portalToken.id,
        invoiceId: portalToken.invoice_id,
      });
      return {
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Invoice not found',
        },
      };
    }

    // Update access tracking
    const now = Date.now();
    const deviceId = getDeviceId();

    await db.portalTokens.update(portalToken.id, {
      last_accessed_at: now,
      access_count: portalToken.access_count + 1,
      updated_at: now,
      version_vector: incrementVersionVector(portalToken.version_vector, deviceId),
    });

    recordAccess(ipAddress);

    portalLogger.info('Token validated successfully', {
      tokenId: portalToken.id,
      invoiceId: invoice.id,
      accessCount: portalToken.access_count + 1,
    });

    return {
      success: true,
      data: {
        token: { ...portalToken, last_accessed_at: now, access_count: portalToken.access_count + 1 },
        invoice,
      },
    };
  } catch (error) {
    portalLogger.error('Failed to validate token', { error });
    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Revoke a portal token
 */
export async function revokeToken(tokenId: string): Promise<DatabaseResult<void>> {
  try {
    const token = await db.portalTokens.get(tokenId);

    if (!token) {
      return {
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: `Token not found: ${tokenId}`,
        },
      };
    }

    if (token.revoked_at) {
      return { success: true, data: undefined };
    }

    const now = Date.now();
    const deviceId = getDeviceId();

    await db.portalTokens.update(tokenId, {
      revoked_at: now,
      updated_at: now,
      version_vector: incrementVersionVector(token.version_vector, deviceId),
    });

    portalLogger.info('Revoked portal token', { tokenId });

    return { success: true, data: undefined };
  } catch (error) {
    portalLogger.error('Failed to revoke token', { error });
    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Get all portal tokens for an invoice
 */
export async function getInvoicePortalTokens(
  companyId: string,
  invoiceId: string
): Promise<DatabaseResult<PortalToken[]>> {
  try {
    const tokens = await db.portalTokens
      .where('[company_id+invoice_id]')
      .equals([companyId, invoiceId])
      .and((t) => !t.deleted_at)
      .toArray();

    return { success: true, data: tokens };
  } catch (error) {
    portalLogger.error('Failed to get invoice portal tokens', { error });
    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Clean up expired tokens
 * Should be run periodically (e.g., daily)
 */
export async function cleanupExpiredTokens(): Promise<DatabaseResult<number>> {
  try {
    const now = Date.now();
    const expiredTokens = await db.portalTokens
      .where('expires_at')
      .below(now)
      .and((t) => !t.deleted_at)
      .toArray();

    const deviceId = getDeviceId();

    for (const token of expiredTokens) {
      await db.portalTokens.update(token.id, {
        deleted_at: now,
        updated_at: now,
        version_vector: incrementVersionVector(token.version_vector, deviceId),
      });
    }

    portalLogger.info('Cleaned up expired tokens', { count: expiredTokens.length });

    return { success: true, data: expiredTokens.length };
  } catch (error) {
    portalLogger.error('Failed to clean up expired tokens', { error });
    return {
      success: false,
      error: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    };
  }
}

/**
 * Generate a full portal URL for a token
 */
export function generatePortalUrl(token: string, baseUrl?: string): string {
  const base = baseUrl || window.location.origin;
  return `${base}/portal/${token}`;
}

/**
 * Get rate limit status for an IP
 */
export function getRateLimitStatus(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const entry = rateLimitStore.get(ip);
  const now = Date.now();

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  return {
    allowed: entry.requests < RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.requests),
    resetAt: entry.windowStart + RATE_LIMIT_WINDOW_MS,
  };
}
