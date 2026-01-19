/**
 * Portal Tokens Schema Definition
 *
 * Defines the structure for customer portal access tokens.
 * These tokens enable secure, time-limited access to invoices
 * without requiring customer authentication.
 *
 * Requirements:
 * - H4: Client Portal
 * - 64-character cryptographically secure tokens
 * - 90-day token expiration
 * - ARCH-004: CRDT-Compatible Schema Design
 */

import type { VersionVector } from '../../types/database.types';

/**
 * Portal token entity
 */
export interface PortalToken {
  id: string; // UUID
  company_id: string; // Company UUID
  invoice_id: string; // Invoice UUID
  token: string; // 64-character cryptographically secure token
  email: string; // Customer email (for verification)
  created_at: number; // Unix timestamp
  expires_at: number; // Unix timestamp (90 days from creation)
  last_accessed_at: number | null; // Unix timestamp of last access
  access_count: number; // Number of times accessed
  revoked_at: number | null; // Unix timestamp if manually revoked
  updated_at: number; // Unix timestamp
  deleted_at: number | null; // Tombstone marker for soft deletes
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Dexie.js schema definition for PortalTokens table
 *
 * Indexes:
 * - id: Primary key (UUID)
 * - token: For quick token lookup
 * - company_id: For querying tokens by company
 * - invoice_id: For querying tokens by invoice
 * - [company_id+invoice_id]: Compound index for invoice token queries
 * - expires_at: For cleanup of expired tokens
 * - updated_at: For CRDT conflict resolution (Last-Write-Wins)
 */
export const portalTokensSchema =
  'id, token, company_id, invoice_id, [company_id+invoice_id], expires_at, updated_at, deleted_at';

/**
 * Table name constant
 */
export const PORTAL_TOKENS_TABLE = 'portalTokens';

/**
 * Token expiration duration (90 days in milliseconds)
 */
export const TOKEN_EXPIRATION_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Token length (64 characters)
 */
export const TOKEN_LENGTH = 64;

/**
 * Default values for new PortalToken
 */
export const createDefaultPortalToken = (
  companyId: string,
  invoiceId: string,
  email: string,
  token: string,
  deviceId: string
): Partial<PortalToken> => {
  const now = Date.now();
  const expiresAt = now + TOKEN_EXPIRATION_MS;

  return {
    company_id: companyId,
    invoice_id: invoiceId,
    token,
    email,
    created_at: now,
    expires_at: expiresAt,
    last_accessed_at: null,
    access_count: 0,
    revoked_at: null,
    updated_at: now,
    deleted_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };
};

/**
 * Validation: Ensure portal token has valid fields
 */
export const validatePortalToken = (token: Partial<PortalToken>): string[] => {
  const errors: string[] = [];

  if (!token.company_id) {
    errors.push('company_id is required');
  }

  if (!token.invoice_id) {
    errors.push('invoice_id is required');
  }

  if (!token.token || token.token.length !== TOKEN_LENGTH) {
    errors.push(`token must be exactly ${TOKEN_LENGTH} characters`);
  }

  if (!token.email || token.email.trim() === '') {
    errors.push('email is required');
  }

  if (!token.expires_at) {
    errors.push('expires_at is required');
  }

  if (token.expires_at && token.created_at && token.expires_at <= token.created_at) {
    errors.push('expires_at must be after created_at');
  }

  return errors;
};

/**
 * Helper: Check if token is expired
 */
export const isTokenExpired = (token: PortalToken): boolean => {
  const now = Date.now();
  return token.expires_at < now;
};

/**
 * Helper: Check if token is revoked
 */
export const isTokenRevoked = (token: PortalToken): boolean => {
  return token.revoked_at !== null;
};

/**
 * Helper: Check if token is valid (not expired, not revoked, not deleted)
 */
export const isTokenValid = (token: PortalToken): boolean => {
  return (
    !isTokenExpired(token) &&
    !isTokenRevoked(token) &&
    token.deleted_at === null
  );
};

/**
 * Helper: Get days until expiration (negative if expired)
 */
export const getDaysUntilExpiration = (token: PortalToken): number => {
  const now = Date.now();
  const diff = token.expires_at - now;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  return days;
};
