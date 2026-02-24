/**
 * Session Security Types
 *
 * Enhanced types for session security hardening including
 * session fingerprinting, device management, and rotation.
 *
 * Task: S5-6: Session Security Hardening
 */

import type { VersionVector } from '../types/database.types';

/**
 * Session metadata stored in database for security tracking
 */
export interface SessionMetadata {
  /** Session ID */
  id: string;
  /** User ID who owns this session */
  user_id: string;
  /** Company ID (if selected) */
  company_id: string | null;
  /** Session token */
  token: string;
  /** Device ID */
  device_id: string;
  /** Device fingerprint hash for validation */
  device_fingerprint: string;
  /** User agent string */
  user_agent: string | null;
  /** IP address (if available) */
  ip_address: string | null;
  /** Device name (encrypted) */
  device_name: string | null;
  /** When session was created */
  created_at: number;
  /** When session expires */
  expires_at: number;
  /** Last activity timestamp */
  last_activity_at: number;
  /** User role at session creation */
  role: string;
  /** Whether device is remembered */
  remember_device: boolean;
  /** Whether session is active */
  is_active: boolean;
  /** When session was revoked (null if active) */
  revoked_at: number | null;
  /** Version vector for CRDT */
  version_vector: VersionVector;
}

/**
 * Session fingerprint components
 */
export interface SessionFingerprint {
  /** User agent string */
  userAgent: string;
  /** Screen resolution */
  screenResolution: string;
  /** Timezone offset */
  timezone: string;
  /** Browser language */
  language: string;
  /** Platform */
  platform: string;
  /** Canvas fingerprint */
  canvasFingerprint: string;
}

/**
 * Session validation result with fingerprint check
 */
export interface SessionValidationResult {
  /** Whether session is valid */
  isValid: boolean;
  /** Reason for invalidity if false */
  reason?: 'expired' | 'revoked' | 'fingerprint_mismatch' | 'not_found' | 'invalid_token';
  /** Session metadata if valid */
  session?: SessionMetadata;
}

/**
 * Session rotation request
 */
export interface SessionRotationRequest {
  /** Current session ID */
  sessionId: string;
  /** Reason for rotation */
  reason: 'privilege_change' | 'security_event' | 'manual_renewal';
  /** New role (if privilege changed) */
  newRole?: string;
}

/**
 * Session rotation result
 */
export interface SessionRotationResult {
  /** Whether rotation was successful */
  success: boolean;
  /** New session token if successful */
  newToken?: string;
  /** New session ID */
  newSessionId?: string;
  /** New expiration timestamp */
  expiresAt?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Device session info for management UI
 */
export interface DeviceSessionInfo {
  /** Session ID */
  sessionId: string;
  /** Device ID */
  deviceId: string;
  /** Device name (decrypted for display) */
  deviceName: string;
  /** Device type */
  deviceType: 'browser' | 'desktop' | 'mobile';
  /** User agent string */
  userAgent: string | null;
  /** IP address */
  ipAddress: string | null;
  /** When session was created */
  createdAt: number;
  /** When session expires */
  expiresAt: number;
  /** Last activity timestamp */
  lastActivityAt: number;
  /** Whether this is the current session */
  isCurrent: boolean;
  /** Location (derived from IP if available) */
  location?: string;
}

/**
 * Force logout options
 */
export interface ForceLogoutOptions {
  /** User ID to logout */
  userId: string;
  /** Whether to logout all devices */
  allDevices: boolean;
  /** Specific session IDs to logout (if not all) */
  sessionIds?: string[];
  /** Reason for logout */
  reason: 'user_initiated' | 'security_event' | 'password_change' | 'admin_action';
}

/**
 * Force logout result
 */
export interface ForceLogoutResult {
  /** Whether operation was successful */
  success: boolean;
  /** Number of sessions revoked */
  sessionsRevoked: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Session expiration configuration
 */
export interface SessionExpirationConfig {
  /** Default session expiration in milliseconds (default: 24 hours) */
  defaultExpirationMs: number;
  /** Idle timeout in milliseconds (default: 30 minutes) */
  idleTimeoutMs: number;
  /** Remember device expiration in milliseconds (default: 30 days) */
  rememberDeviceExpirationMs: number;
  /** Whether to auto-renew sessions */
  autoRenew: boolean;
  /** How long before expiry to renew (default: 1 hour) */
  renewalThresholdMs: number;
}

/**
 * Default session expiration configuration
 */
export const DEFAULT_SESSION_EXPIRATION_CONFIG: SessionExpirationConfig = {
  defaultExpirationMs: 24 * 60 * 60 * 1000, // 24 hours
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
  rememberDeviceExpirationMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  autoRenew: true,
  renewalThresholdMs: 60 * 60 * 1000, // 1 hour
};

/**
 * Session security event types
 */
export type SessionSecurityEventType =
  | 'session_created'
  | 'session_renewed'
  | 'session_rotated'
  | 'session_expired'
  | 'session_revoked'
  | 'fingerprint_mismatch'
  | 'privilege_changed'
  | 'force_logout_all';

/**
 * Session security event
 */
export interface SessionSecurityEvent {
  /** Event type */
  type: SessionSecurityEventType;
  /** Session ID involved */
  sessionId: string;
  /** User ID */
  userId: string;
  /** Timestamp of event */
  timestamp: number;
  /** Additional details */
  details?: Record<string, unknown>;
}
