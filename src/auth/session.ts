/**
 * Session Management Module
 *
 * Handles session token generation, validation, renewal, and lifecycle.
 * Implements secure session management per authentication spec.
 */

import type {
  SessionTokenPayload,
  SessionState,
  TokenValidationResult,
  SessionRenewalResult,
  AuthConfig,
  SessionEvent,
} from './types';
import { DEFAULT_AUTH_CONFIG } from './types';
import { constantTimeEqual } from '../utils/crypto/constantTime';

/**
 * Active session state (in-memory only)
 * Cleared on logout, timeout, or tab close
 */
let activeSession: SessionState | null = null;

/**
 * Session event listeners
 */
const eventListeners: ((event: SessionEvent) => void)[] = [];

/**
 * Generate a cryptographically secure session token
 *
 * Uses Web Crypto API to generate a secure random token.
 * Format: base64url-encoded random bytes + payload signature
 *
 * @param payload - Session token payload
 * @param config - Authentication configuration
 * @returns Session token string
 */
export async function generateSessionToken(
  payload: SessionTokenPayload,
  _config: AuthConfig = DEFAULT_AUTH_CONFIG
): Promise<string> {
  // Generate random token ID (256 bits)
  const tokenIdBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenIdBytes);
  const tokenId = base64UrlEncode(tokenIdBytes);

  // Create payload JSON
  const payloadJson = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const payloadB64 = base64UrlEncode(payloadBytes);

  // Generate HMAC signature using Web Crypto API
  // In a real implementation, this would use a secret key from secure storage
  // For zero-knowledge architecture, we use the master key (in memory)
  const signature = await generateHmacSignature(payloadB64);

  // Format: tokenId.payload.signature
  return `${tokenId}.${payloadB64}.${signature}`;
}

/**
 * Validate a session token
 *
 * Checks token format, signature, and expiration.
 *
 * @param token - Session token to validate
 * @param config - Authentication configuration
 * @returns Validation result with decoded payload if valid
 */
export async function validateSessionToken(
  token: string,
  _config: AuthConfig = DEFAULT_AUTH_CONFIG
): Promise<TokenValidationResult> {
  try {
    // Parse token parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      return {
        isValid: false,
        error: 'Malformed token',
        errorCode: 'MALFORMED',
      };
    }

    const [_tokenId, payloadB64, signature] = parts;

    // Verify signature using constant-time comparison to prevent timing attacks
    const expectedSignature = await generateHmacSignature(payloadB64 || '');
    if (!constantTimeEqual(signature || '', expectedSignature)) {
      emitSessionEvent({
        type: 'validation_failed',
        timestamp: Date.now(),
        details: { reason: 'Invalid signature' },
      });
      return {
        isValid: false,
        error: 'Invalid token signature',
        errorCode: 'INVALID_SIGNATURE',
      };
    }

    // Decode payload
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64 || ''));
    const payload = JSON.parse(payloadJson) as SessionTokenPayload;

    // Check expiration
    const now = Date.now();
    if (payload.expiresAt < now) {
      return {
        isValid: false,
        error: 'Token expired',
        errorCode: 'EXPIRED',
      };
    }

    // Token is valid
    return {
      isValid: true,
      payload,
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'MALFORMED',
    };
  }
}

/**
 * Create a new session
 *
 * Initializes session state and sets up auto-renewal and idle timeout.
 *
 * @param payload - Session token payload
 * @param masterKey - Master encryption key (stored in memory only)
 * @param config - Authentication configuration
 * @returns Session state
 */
export async function createSession(
  payload: SessionTokenPayload,
  masterKey: Uint8Array,
  config: AuthConfig = DEFAULT_AUTH_CONFIG
): Promise<SessionState> {
  // Generate session token
  const token = await generateSessionToken(payload, config);

  const now = Date.now();

  // Create session state
  const session: SessionState = {
    sessionId: payload.sessionId,
    userId: payload.userId,
    companyId: payload.companyId,
    role: payload.role,
    masterKey: new Uint8Array(masterKey), // Copy to avoid reference issues
    token,
    startedAt: now,
    expiresAt: payload.expiresAt,
    lastActivityAt: now,
  };

  // Store as active session
  activeSession = session;

  // Set up auto-renewal timer
  const renewalDelay = Math.max(
    0,
    payload.expiresAt - now - config.renewalThresholdMs
  );
  if (renewalDelay > 0) {
    session.renewalTimerId = window.setTimeout(() => {
      renewSession(config);
    }, renewalDelay);
  }

  // Set up idle timeout timer
  session.idleTimerId = window.setTimeout(() => {
    handleIdleTimeout();
  }, config.idleTimeoutMs);

  // Emit login event
  emitSessionEvent({
    type: 'login',
    sessionId: session.sessionId,
    userId: session.userId,
    timestamp: now,
  });

  return session;
}

/**
 * Get current active session
 *
 * @returns Current session state or null if no active session
 */
export function getActiveSession(): SessionState | null {
  return activeSession;
}

/**
 * Update session activity
 *
 * Resets idle timeout when user performs an action.
 * Should be called on user interactions.
 *
 * @param config - Authentication configuration
 */
export function updateSessionActivity(
  config: AuthConfig = DEFAULT_AUTH_CONFIG
): void {
  if (!activeSession) return;

  activeSession.lastActivityAt = Date.now();

  // Reset idle timeout
  if (activeSession.idleTimerId) {
    clearTimeout(activeSession.idleTimerId);
  }
  activeSession.idleTimerId = window.setTimeout(() => {
    handleIdleTimeout();
  }, config.idleTimeoutMs);
}

/**
 * Renew session token before expiration
 *
 * Generates a new token with extended expiration and updates session.
 *
 * @param config - Authentication configuration
 * @returns Renewal result with new token
 */
export async function renewSession(
  config: AuthConfig = DEFAULT_AUTH_CONFIG
): Promise<SessionRenewalResult> {
  if (!activeSession) {
    return {
      success: false,
      error: 'No active session',
    };
  }

  try {
    const now = Date.now();
    const newExpiresAt = now + config.sessionExpirationMs;

    // Create new payload with extended expiration
    const newPayload: SessionTokenPayload = {
      sessionId: activeSession.sessionId,
      userId: activeSession.userId,
      companyId: activeSession.companyId,
      role: activeSession.role,
      issuedAt: now,
      expiresAt: newExpiresAt,
      deviceId: activeSession.deviceToken,
    };

    // Generate new token
    const newToken = await generateSessionToken(newPayload, config);

    // Update session state
    activeSession.token = newToken;
    activeSession.expiresAt = newExpiresAt;
    activeSession.lastActivityAt = now;

    // Clear old renewal timer
    if (activeSession.renewalTimerId) {
      clearTimeout(activeSession.renewalTimerId);
    }

    // Set up new renewal timer
    const renewalDelay = Math.max(
      0,
      newExpiresAt - now - config.renewalThresholdMs
    );
    if (renewalDelay > 0) {
      activeSession.renewalTimerId = window.setTimeout(() => {
        renewSession(config);
      }, renewalDelay);
    }

    // Emit renewal event
    emitSessionEvent({
      type: 'renewal',
      sessionId: activeSession.sessionId,
      userId: activeSession.userId,
      timestamp: now,
    });

    return {
      success: true,
      newToken,
      expiresAt: newExpiresAt,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Clear session state
 *
 * Removes session from memory and clears timers.
 * Called on logout, timeout, or tab close.
 *
 * @param reason - Reason for clearing session
 */
export function clearSession(
  reason: 'logout' | 'timeout' | 'security' | 'tab_close' = 'logout'
): void {
  if (!activeSession) return;

  const sessionId = activeSession.sessionId;
  const userId = activeSession.userId;

  // Clear timers
  if (activeSession.renewalTimerId) {
    clearTimeout(activeSession.renewalTimerId);
  }
  if (activeSession.idleTimerId) {
    clearTimeout(activeSession.idleTimerId);
  }

  // Zero out master key in memory (security measure)
  if (activeSession.masterKey) {
    activeSession.masterKey.fill(0);
  }

  // Clear session reference
  activeSession = null;

  // Emit logout/timeout event
  emitSessionEvent({
    type: reason === 'timeout' ? 'timeout' : 'logout',
    sessionId,
    userId,
    timestamp: Date.now(),
    details: { reason },
  });
}

/**
 * Handle idle timeout
 *
 * Called when user has been inactive for configured duration.
 */
function handleIdleTimeout(): void {
  clearSession('timeout');
  // In a real app, this would show a timeout notification to the user
}

/**
 * Generate HMAC signature for token
 *
 * Uses Web Crypto API with SHA-256 for signing.
 * In production, this would use a server-side secret or the master key.
 *
 * @param data - Data to sign
 * @returns Base64url-encoded signature
 */
async function generateHmacSignature(data: string): Promise<string> {
  // For zero-knowledge architecture, we derive a signing key from the master key
  // In this implementation, we use a deterministic key from session data
  // In production, consider using a dedicated signing key

  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);

  // Use a deterministic key derived from session
  // In production, use the master key or a dedicated signing key
  const keyMaterial = activeSession?.masterKey || new Uint8Array(32);

  // Import key for HMAC
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Generate signature
  const signature = await crypto.subtle.sign('HMAC', key, dataBytes);

  return base64UrlEncode(new Uint8Array(signature));
}

/**
 * Base64url encode (URL-safe base64 without padding)
 *
 * @param bytes - Bytes to encode
 * @returns Base64url-encoded string
 */
function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64url decode
 *
 * @param str - Base64url-encoded string
 * @returns Decoded bytes
 */
function base64UrlDecode(str: string): Uint8Array {
  // Add padding if needed
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }

  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a unique session ID
 *
 * @returns Unique session identifier
 */
export function generateSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Add session event listener
 *
 * @param listener - Event listener function
 */
export function addSessionEventListener(
  listener: (event: SessionEvent) => void
): void {
  eventListeners.push(listener);
}

/**
 * Remove session event listener
 *
 * @param listener - Event listener function to remove
 */
export function removeSessionEventListener(
  listener: (event: SessionEvent) => void
): void {
  const index = eventListeners.indexOf(listener);
  if (index !== -1) {
    eventListeners.splice(index, 1);
  }
}

/**
 * Emit session event to all listeners
 *
 * @param event - Session event
 */
function emitSessionEvent(event: SessionEvent): void {
  eventListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.error('Error in session event listener:', error);
    }
  });
}

/**
 * Check if session is valid and active
 *
 * @returns True if there is an active valid session
 */
export function hasActiveSession(): boolean {
  if (!activeSession) return false;

  const now = Date.now();
  return activeSession.expiresAt > now;
}

/**
 * Get time until session expires
 *
 * @returns Milliseconds until expiration, or 0 if no active session
 */
export function getTimeUntilExpiration(): number {
  if (!activeSession) return 0;

  const now = Date.now();
  return Math.max(0, activeSession.expiresAt - now);
}

/**
 * Get time since last activity
 *
 * @returns Milliseconds since last activity, or 0 if no active session
 */
export function getTimeSinceLastActivity(): number {
  if (!activeSession) return 0;

  const now = Date.now();
  return now - activeSession.lastActivityAt;
}
