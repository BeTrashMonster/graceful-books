/**
 * Session Security Module Exports
 *
 * Barrel export file for session security functionality.
 *
 * Task: S5-6: Session Security Hardening
 */

// Type exports
export type {
  SessionMetadata,
  SessionFingerprint,
  SessionValidationResult,
  SessionRotationRequest,
  SessionRotationResult,
  DeviceSessionInfo,
  ForceLogoutOptions,
  ForceLogoutResult,
  SessionExpirationConfig,
  SessionSecurityEventType,
  SessionSecurityEvent,
} from './sessionSecurity.types';

export { DEFAULT_SESSION_EXPIRATION_CONFIG } from './sessionSecurity.types';

// Function exports
export {
  generateSessionFingerprint,
  hashFingerprint,
  createSecureSession,
  validateSessionWithFingerprint,
  rotateSession,
  forceLogout,
  shouldRenewSession,
  updateSessionActivity,
  cleanupExpiredSessions,
  addSecurityEventListener,
  removeSecurityEventListener,
  getSessionValidationMessage,
} from './sessionSecurity';
