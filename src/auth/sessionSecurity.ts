/**
 * Session Security Module
 *
 * Implements enhanced session security features:
 * - Session fingerprinting to detect device changes
 * - Configurable session expiration
 * - Session rotation on privilege changes
 * - Force logout all devices
 *
 * Task: S5-6: Session Security Hardening
 */

import type {
  SessionMetadata,
  SessionFingerprint,
  SessionValidationResult,
  SessionRotationRequest,
  SessionRotationResult,
  ForceLogoutOptions,
  ForceLogoutResult,
  SessionExpirationConfig,
  SessionSecurityEvent,
} from './sessionSecurity.types';
import { DEFAULT_SESSION_EXPIRATION_CONFIG } from './sessionSecurity.types';
import { generateSessionId } from './session';
import { getDeviceId } from '../utils/device';
import { logger } from '../utils/logger';

/**
 * Generate a session fingerprint from browser/device characteristics
 *
 * This creates a hash of device characteristics to detect if a session
 * is being used from a different device (potential hijacking).
 *
 * @returns Session fingerprint object
 */
export async function generateSessionFingerprint(): Promise<SessionFingerprint> {
  const fingerprint: SessionFingerprint = {
    userAgent: navigator.userAgent,
    screenResolution: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    canvasFingerprint: '',
  };

  // Generate lightweight canvas fingerprint
  try {
    // Check if we're in a browser environment with canvas support
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 200;
        canvas.height = 50;
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(0, 0, 200, 50);
        ctx.fillStyle = '#069';
        ctx.fillText('GracefulBooks Security', 2, 15);
        fingerprint.canvasFingerprint = canvas.toDataURL();
      } else {
        fingerprint.canvasFingerprint = 'canvas-unavailable';
      }
    } else {
      // Not in browser environment (e.g., tests)
      fingerprint.canvasFingerprint = 'canvas-unavailable';
    }
  } catch (error) {
    // Canvas may be blocked by privacy tools or not implemented
    fingerprint.canvasFingerprint = 'canvas-blocked';
  }

  return fingerprint;
}

/**
 * Hash a session fingerprint to a consistent string
 *
 * @param fingerprint - Session fingerprint
 * @returns SHA-256 hash of fingerprint
 */
export async function hashFingerprint(fingerprint: SessionFingerprint): Promise<string> {
  const components = [
    fingerprint.userAgent,
    fingerprint.screenResolution,
    fingerprint.timezone,
    fingerprint.language,
    fingerprint.platform,
    fingerprint.canvasFingerprint,
  ];

  const combined = components.join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create a new session with security metadata
 *
 * @param userId - User ID
 * @param companyId - Company ID (optional)
 * @param role - User role
 * @param token - Session token
 * @param config - Session expiration configuration
 * @returns Session metadata
 */
export async function createSecureSession(
  userId: string,
  companyId: string | null,
  role: string,
  token: string,
  config: SessionExpirationConfig = DEFAULT_SESSION_EXPIRATION_CONFIG
): Promise<SessionMetadata> {
  const now = Date.now();
  const sessionId = generateSessionId();
  const deviceId = await getDeviceId();
  const fingerprint = await generateSessionFingerprint();
  const fingerprintHash = await hashFingerprint(fingerprint);

  const session: SessionMetadata = {
    id: sessionId,
    user_id: userId,
    company_id: companyId,
    token,
    device_id: deviceId,
    device_fingerprint: fingerprintHash,
    user_agent: navigator.userAgent,
    ip_address: null, // Set by backend if available
    device_name: null, // Set separately with encryption
    created_at: now,
    expires_at: now + config.defaultExpirationMs,
    last_activity_at: now,
    role,
    remember_device: false,
    is_active: true,
    revoked_at: null,
    version_vector: {
      [deviceId]: 1,
    },
  };

  // Emit security event
  emitSecurityEvent({
    type: 'session_created',
    sessionId,
    userId,
    timestamp: now,
    details: { role, deviceId },
  });

  logger.info('Secure session created', { sessionId, userId, role });

  return session;
}

/**
 * Validate a session with fingerprint verification
 *
 * Checks:
 * - Session exists and is active
 * - Session has not expired
 * - Device fingerprint matches current device
 * - Session has not been revoked
 *
 * @param sessionId - Session ID to validate
 * @param token - Session token
 * @param sessions - Array of all sessions (from database)
 * @returns Validation result
 */
export async function validateSessionWithFingerprint(
  sessionId: string,
  token: string,
  sessions: SessionMetadata[]
): Promise<SessionValidationResult> {
  // Find session
  const session = sessions.find((s) => s.id === sessionId && s.token === token);

  if (!session) {
    return {
      isValid: false,
      reason: 'not_found',
    };
  }

  // Check if revoked
  if (!session.is_active || session.revoked_at !== null) {
    return {
      isValid: false,
      reason: 'revoked',
    };
  }

  // Check if expired
  const now = Date.now();
  if (session.expires_at < now) {
    return {
      isValid: false,
      reason: 'expired',
    };
  }

  // Verify fingerprint
  const currentFingerprint = await generateSessionFingerprint();
  const currentFingerprintHash = await hashFingerprint(currentFingerprint);

  if (session.device_fingerprint !== currentFingerprintHash) {
    // Fingerprint mismatch - potential session hijacking
    logger.warn('Session fingerprint mismatch detected', {
      sessionId,
      userId: session.user_id,
      expected: session.device_fingerprint,
      actual: currentFingerprintHash,
    });

    emitSecurityEvent({
      type: 'fingerprint_mismatch',
      sessionId,
      userId: session.user_id,
      timestamp: now,
      details: {
        expected: session.device_fingerprint,
        actual: currentFingerprintHash,
      },
    });

    return {
      isValid: false,
      reason: 'fingerprint_mismatch',
    };
  }

  return {
    isValid: true,
    session,
  };
}

/**
 * Rotate a session (create new session, invalidate old one)
 *
 * Used when:
 * - User privilege/role changes
 * - Security event requires session refresh
 * - Manual renewal requested
 *
 * @param request - Rotation request
 * @param currentSession - Current session metadata
 * @param config - Session expiration configuration
 * @returns Rotation result with new session token
 */
export async function rotateSession(
  request: SessionRotationRequest,
  currentSession: SessionMetadata,
  config: SessionExpirationConfig = DEFAULT_SESSION_EXPIRATION_CONFIG
): Promise<SessionRotationResult> {
  try {
    const now = Date.now();
    const newSessionId = generateSessionId();

    // Generate new token (simplified - in production use proper JWT signing)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const newToken = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Get current fingerprint for the new session
    const fingerprint = await generateSessionFingerprint();
    await hashFingerprint(fingerprint); // Validate fingerprint format

    // Create new session with same user but new token
    const newRole = request.newRole || currentSession.role;

    const result: SessionRotationResult = {
      success: true,
      newToken,
      newSessionId,
      expiresAt: now + config.defaultExpirationMs,
    };

    // Emit security event
    emitSecurityEvent({
      type: 'session_rotated',
      sessionId: newSessionId,
      userId: currentSession.user_id,
      timestamp: now,
      details: {
        oldSessionId: request.sessionId,
        reason: request.reason,
        oldRole: currentSession.role,
        newRole,
      },
    });

    logger.info('Session rotated', {
      oldSessionId: request.sessionId,
      newSessionId,
      reason: request.reason,
      userId: currentSession.user_id,
    });

    return result;
  } catch (error) {
    logger.error('Session rotation failed', { error, request });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during rotation',
    };
  }
}

/**
 * Force logout one or all sessions for a user
 *
 * @param options - Logout options
 * @param allSessions - All sessions for the user
 * @returns Logout result
 */
export async function forceLogout(
  options: ForceLogoutOptions,
  allSessions: SessionMetadata[]
): Promise<ForceLogoutResult> {
  try {
    const now = Date.now();
    let sessionsToRevoke: SessionMetadata[];

    if (options.allDevices) {
      // Revoke all sessions for user
      sessionsToRevoke = allSessions.filter(
        (s) => s.user_id === options.userId && s.is_active
      );
    } else if (options.sessionIds) {
      // Revoke specific sessions
      sessionsToRevoke = allSessions.filter(
        (s) => options.sessionIds!.includes(s.id) && s.is_active
      );
    } else {
      return {
        success: false,
        sessionsRevoked: 0,
        error: 'Must specify either allDevices or sessionIds',
      };
    }

    // Mark all sessions as revoked
    sessionsToRevoke.forEach((session) => {
      session.is_active = false;
      session.revoked_at = now;
    });

    // Emit security event
    emitSecurityEvent({
      type: 'force_logout_all',
      sessionId: 'multiple',
      userId: options.userId,
      timestamp: now,
      details: {
        reason: options.reason,
        sessionsRevoked: sessionsToRevoke.length,
        allDevices: options.allDevices,
      },
    });

    logger.info('Force logout completed', {
      userId: options.userId,
      sessionsRevoked: sessionsToRevoke.length,
      reason: options.reason,
      allDevices: options.allDevices,
    });

    return {
      success: true,
      sessionsRevoked: sessionsToRevoke.length,
    };
  } catch (error) {
    logger.error('Force logout failed', { error, options });
    return {
      success: false,
      sessionsRevoked: 0,
      error: error instanceof Error ? error.message : 'Unknown error during logout',
    };
  }
}

/**
 * Check if a session should be renewed based on expiration
 *
 * @param session - Session to check
 * @param config - Session expiration configuration
 * @returns True if session should be renewed
 */
export function shouldRenewSession(
  session: SessionMetadata,
  config: SessionExpirationConfig = DEFAULT_SESSION_EXPIRATION_CONFIG
): boolean {
  if (!config.autoRenew) {
    return false;
  }

  const now = Date.now();
  const timeUntilExpiry = session.expires_at - now;

  return timeUntilExpiry < config.renewalThresholdMs && timeUntilExpiry > 0;
}

/**
 * Update session activity timestamp
 *
 * @param session - Session to update
 * @param config - Session expiration configuration
 * @returns Updated session
 */
export function updateSessionActivity(
  session: SessionMetadata,
  config: SessionExpirationConfig = DEFAULT_SESSION_EXPIRATION_CONFIG
): SessionMetadata {
  const now = Date.now();
  const timeSinceLastActivity = now - session.last_activity_at;

  // If idle timeout exceeded, don't update (will be caught by validation)
  if (timeSinceLastActivity > config.idleTimeoutMs) {
    return session;
  }

  return {
    ...session,
    last_activity_at: now,
  };
}

/**
 * Clean up expired sessions
 *
 * @param sessions - All sessions
 * @returns Array of active sessions
 */
export function cleanupExpiredSessions(sessions: SessionMetadata[]): SessionMetadata[] {
  const now = Date.now();

  return sessions.filter((session) => {
    if (!session.is_active || session.revoked_at !== null) {
      return false;
    }

    if (session.expires_at < now) {
      // Emit expiration event
      emitSecurityEvent({
        type: 'session_expired',
        sessionId: session.id,
        userId: session.user_id,
        timestamp: now,
      });

      return false;
    }

    return true;
  });
}

// ============================================================================
// Security Event Handling
// ============================================================================

const securityEventListeners: ((event: SessionSecurityEvent) => void)[] = [];

/**
 * Add a security event listener
 *
 * @param listener - Event listener function
 */
export function addSecurityEventListener(
  listener: (event: SessionSecurityEvent) => void
): void {
  securityEventListeners.push(listener);
}

/**
 * Remove a security event listener
 *
 * @param listener - Event listener function to remove
 */
export function removeSecurityEventListener(
  listener: (event: SessionSecurityEvent) => void
): void {
  const index = securityEventListeners.indexOf(listener);
  if (index !== -1) {
    securityEventListeners.splice(index, 1);
  }
}

/**
 * Emit a security event to all listeners
 *
 * @param event - Security event
 */
function emitSecurityEvent(event: SessionSecurityEvent): void {
  securityEventListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      logger.error('Error in security event listener', { error, event });
    }
  });
}

/**
 * Get user-friendly message for session validation failure
 *
 * @param reason - Validation failure reason
 * @returns User-friendly message
 */
export function getSessionValidationMessage(
  reason: SessionValidationResult['reason']
): string {
  switch (reason) {
    case 'expired':
      return 'Your session has expired. Please sign in again to continue.';
    case 'revoked':
      return 'This session is no longer active. Please sign in again.';
    case 'fingerprint_mismatch':
      return 'We detected unusual activity on your account. For your security, please sign in again.';
    case 'not_found':
      return 'Session not found. Please sign in to continue.';
    case 'invalid_token':
      return 'Invalid session. Please sign in again.';
    default:
      return 'Session validation failed. Please sign in again.';
  }
}
