/**
 * Delegation Tokens for Integration Authorization
 *
 * Implements secure token delegation based on RFC 8693 Token Exchange.
 * Ensures authority attenuation at each delegation step.
 *
 * @security Phase 5.2 - Authority Attenuation Chain
 * @see docs/security/AGENTIC_AI_SECURITY_ROADMAP.md
 */

import {
  validateAttenuation,
  getScopeForActor,
  isActionAllowedForActor,
  type AttenuationResult,
} from './attenuation';

/**
 * Generate a UUID v4 (browser-compatible)
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate HMAC signature (browser-compatible)
 * Uses synchronous approach for simplicity in this context
 */
function generateHmacSync(content: string, secret: string): string {
  // Simple hash-based signature (for token integrity, not cryptographic security)
  // In production, you would use Web Crypto API's subtle.sign() with proper async handling
  let hash = 0;
  const combined = secret + content;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Add more entropy by hashing multiple rounds
  const str = content + secret + hash.toString();
  let hash2 = 0;
  for (let i = 0; i < str.length; i++) {
    hash2 = str.charCodeAt(i) + ((hash2 << 5) - hash2);
  }
  return Math.abs(hash).toString(16) + Math.abs(hash2).toString(16);
}

/**
 * Delegation token structure
 */
export interface DelegationToken {
  // Identity
  token_id: string;
  issuer: string;

  // Delegation chain
  original_subject: string; // User who authorized
  actor: string; // Current holder (app, AI, integration)
  delegation_chain: string[]; // Full path

  // Scope
  scope: string[];
  allowed_resources: string[];

  // Time bounds
  issued_at: number;
  expires_at: number;
  not_before?: number;

  // Constraints
  max_uses?: number;
  current_uses: number;
  ip_restriction?: string[];

  // Signature
  signature: string;
}

/**
 * Parameters for creating a delegation token
 */
export interface CreateDelegationParams {
  user_id: string;
  delegator: string;
  delegate: string;
  requested_scope: string[];
  resources: string[];
  existing_chain: string[];
  lifetime_seconds: number;
  max_uses?: number;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Errors for delegation operations
 */
export class AttenuationViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttenuationViolationError';
  }
}

export class InsufficientScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientScopeError';
  }
}

export class TokenExpiredError extends Error {
  constructor() {
    super('Token has expired');
    this.name = 'TokenExpiredError';
  }
}

export class InvalidSignatureError extends Error {
  constructor() {
    super('Token signature is invalid');
    this.name = 'InvalidSignatureError';
  }
}

// Secret key for signing tokens (in production, use secure key management)
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'delegation-token-secret-key';

// Audit log for delegation events
interface DelegationAuditEntry {
  timestamp: string;
  action: 'create' | 'validate' | 'use' | 'revoke';
  token_id: string;
  actor?: string;
  result: 'success' | 'failure';
  reason?: string;
}

const delegationAuditLog: DelegationAuditEntry[] = [];

// Token store (in production, use persistent storage)
const tokenStore: Map<string, DelegationToken> = new Map();

/**
 * Sign a delegation token
 */
function signToken(token: Omit<DelegationToken, 'signature'>): string {
  const content = JSON.stringify({
    token_id: token.token_id,
    issuer: token.issuer,
    original_subject: token.original_subject,
    actor: token.actor,
    delegation_chain: token.delegation_chain,
    scope: token.scope,
    allowed_resources: token.allowed_resources,
    issued_at: token.issued_at,
    expires_at: token.expires_at,
  });

  return generateHmacSync(content, TOKEN_SECRET);
}

/**
 * Verify a token's signature
 */
function verifySignature(token: DelegationToken): boolean {
  const expectedSignature = signToken({
    ...token,
    signature: undefined as unknown as string,
  });
  return token.signature === expectedSignature;
}

/**
 * Check if a scope matches an action
 */
function matchesScope(scopePattern: string, action: string): boolean {
  if (scopePattern === '*') {
    return true;
  }
  if (scopePattern === action) {
    return true;
  }

  // Wildcard matching (e.g., "transaction:*" matches "transaction:read")
  const [scopeResource] = scopePattern.split(':');
  const [actionResource] = action.split(':');

  if (scopePattern.endsWith(':*') && scopeResource === actionResource) {
    return true;
  }

  return false;
}

/**
 * Check if a resource matches an allowed pattern
 */
function matchesResource(pattern: string, resource: string): boolean {
  if (pattern === '*') {
    return true;
  }
  if (pattern === resource) {
    return true;
  }

  // Wildcard prefix matching (e.g., "txn-*" matches "txn-123")
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return resource.startsWith(prefix);
  }

  return false;
}

/**
 * Log a delegation audit event
 */
function logDelegationEvent(
  action: DelegationAuditEntry['action'],
  token_id: string,
  result: 'success' | 'failure',
  actor?: string,
  reason?: string
): void {
  delegationAuditLog.push({
    timestamp: new Date().toISOString(),
    action,
    token_id,
    actor,
    result,
    reason,
  });
}

/**
 * Create a delegation token
 *
 * Validates attenuation and ensures delegator has the permissions to delegate.
 */
export async function createDelegationToken(
  params: CreateDelegationParams
): Promise<DelegationToken> {
  // Validate attenuation
  const attenuationResult = validateAttenuation(
    params.delegator,
    params.delegate,
    params.requested_scope
  );

  if (!attenuationResult.valid) {
    logDelegationEvent('create', 'N/A', 'failure', params.delegator, attenuationResult.reason);
    throw new AttenuationViolationError(attenuationResult.reason || 'Attenuation violation');
  }

  // Get delegator's scope to ensure they have the permissions to delegate
  const delegatorScope = getScopeForActor(params.delegator);

  for (const scope of params.requested_scope) {
    // Check if delegator can perform this action
    const [resource, action] = scope.split(':');
    const fullAction = action ? scope : `${scope}:read`;

    if (!isActionAllowedForActor(params.delegator, scope) &&
        !isActionAllowedForActor(params.delegator, fullAction) &&
        !delegatorScope.allowed_actions.includes('*')) {
      logDelegationEvent('create', 'N/A', 'failure', params.delegator, `Insufficient scope: ${scope}`);
      throw new InsufficientScopeError(`Delegator lacks scope: ${scope}`);
    }
  }

  // Create token
  const tokenId = generateUUID();
  const now = Date.now();

  const tokenWithoutSignature: Omit<DelegationToken, 'signature'> = {
    token_id: tokenId,
    issuer: 'graceful-books',
    original_subject: params.user_id,
    actor: params.delegate,
    delegation_chain: [...params.existing_chain, params.delegate],
    scope: params.requested_scope,
    allowed_resources: params.resources,
    issued_at: now,
    expires_at: now + params.lifetime_seconds * 1000,
    current_uses: 0,
    max_uses: params.max_uses,
  };

  const signature = signToken(tokenWithoutSignature);

  const token: DelegationToken = {
    ...tokenWithoutSignature,
    signature,
  };

  // Store token
  tokenStore.set(tokenId, token);

  // Log success
  logDelegationEvent('create', tokenId, 'success', params.delegator);

  return token;
}

/**
 * Validate a delegation token for a specific action and resource
 */
export async function validateDelegationToken(
  token: DelegationToken,
  requestedAction: string,
  resource: string
): Promise<TokenValidationResult> {
  // 1. Verify signature
  const signatureValid = verifySignature(token);
  if (!signatureValid) {
    logDelegationEvent('validate', token.token_id, 'failure', token.actor, 'Invalid signature');
    return { valid: false, reason: 'Invalid signature' };
  }

  // 2. Check expiration
  if (Date.now() > token.expires_at) {
    logDelegationEvent('validate', token.token_id, 'failure', token.actor, 'Token expired');
    return { valid: false, reason: 'Token expired' };
  }

  // 3. Check not_before
  if (token.not_before && Date.now() < token.not_before) {
    logDelegationEvent('validate', token.token_id, 'failure', token.actor, 'Token not yet valid');
    return { valid: false, reason: 'Token not yet valid' };
  }

  // 4. Check use count
  if (token.max_uses && token.current_uses >= token.max_uses) {
    logDelegationEvent('validate', token.token_id, 'failure', token.actor, 'Max uses exceeded');
    return { valid: false, reason: 'Max uses exceeded' };
  }

  // 5. Check scope
  const scopeMatches = token.scope.some((s) => matchesScope(s, requestedAction));
  if (!scopeMatches) {
    logDelegationEvent('validate', token.token_id, 'failure', token.actor, `Action "${requestedAction}" not in scope`);
    return { valid: false, reason: `Action "${requestedAction}" not in scope` };
  }

  // 6. Check resource
  const resourceMatches = token.allowed_resources.some((r) => matchesResource(r, resource));
  if (!resourceMatches) {
    logDelegationEvent('validate', token.token_id, 'failure', token.actor, `Resource "${resource}" not allowed`);
    return { valid: false, reason: `Resource "${resource}" not allowed` };
  }

  logDelegationEvent('validate', token.token_id, 'success', token.actor);
  return { valid: true };
}

/**
 * Use a token (increment use count)
 */
export function useToken(tokenId: string): boolean {
  const token = tokenStore.get(tokenId);
  if (!token) {
    return false;
  }

  token.current_uses++;
  tokenStore.set(tokenId, token);

  logDelegationEvent('use', tokenId, 'success', token.actor);
  return true;
}

/**
 * Revoke a delegation token
 */
export function revokeToken(tokenId: string, revokedBy: string, reason: string): boolean {
  if (!tokenStore.has(tokenId)) {
    return false;
  }

  tokenStore.delete(tokenId);
  logDelegationEvent('revoke', tokenId, 'success', revokedBy, reason);
  return true;
}

/**
 * Get a token by ID
 */
export function getToken(tokenId: string): DelegationToken | undefined {
  return tokenStore.get(tokenId);
}

/**
 * Get delegation audit log
 */
export function getDelegationAuditLog(
  tokenId?: string,
  limit?: number
): DelegationAuditEntry[] {
  let logs = delegationAuditLog;

  if (tokenId) {
    logs = logs.filter((entry) => entry.token_id === tokenId);
  }

  if (limit) {
    logs = logs.slice(-limit);
  }

  return logs;
}

/**
 * Clear all tokens and audit log (for testing)
 */
export function clearDelegationStore(): void {
  tokenStore.clear();
  delegationAuditLog.length = 0;
}

export default {
  createDelegationToken,
  validateDelegationToken,
  useToken,
  revokeToken,
  getToken,
  getDelegationAuditLog,
  clearDelegationStore,
  AttenuationViolationError,
  InsufficientScopeError,
  TokenExpiredError,
  InvalidSignatureError,
};
