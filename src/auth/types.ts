/**
 * Authentication Types
 *
 * Type definitions for authentication and session management.
 * Implements passphrase-based authentication, session tokens,
 * and remember device functionality per authentication spec.
 */

/**
 * Session token payload structure
 *
 * Contains user and session information encoded in the token.
 * Used for JWT or signed session tokens.
 */
export interface SessionTokenPayload {
  /** Unique session identifier */
  sessionId: string;
  /** User identifier */
  userId: string;
  /** Company identifier */
  companyId: string;
  /** User role for permissions */
  role: string;
  /** Timestamp when token was issued (Unix timestamp) */
  issuedAt: number;
  /** Timestamp when token expires (Unix timestamp) */
  expiresAt: number;
  /** IP address or device identifier (optional) */
  deviceId?: string;
}

/**
 * Session state stored in memory during active session
 *
 * Contains all active session information including encryption keys.
 * This is cleared on logout or timeout.
 */
export interface SessionState {
  /** Session identifier */
  sessionId: string;
  /** User identifier */
  userId: string;
  /** Company identifier */
  companyId: string;
  /** User role */
  role: string;
  /** Master encryption key (in memory only) */
  masterKey: Uint8Array;
  /** Session token string */
  token: string;
  /** When session started */
  startedAt: number;
  /** When session expires */
  expiresAt: number;
  /** Last activity timestamp for idle timeout */
  lastActivityAt: number;
  /** Device token if "remember device" is enabled */
  deviceToken?: string;
  /** Auto-renewal timer ID */
  renewalTimerId?: number;
  /** Idle timeout timer ID */
  idleTimerId?: number;
}

/**
 * Device token for "remember this device" functionality
 *
 * Long-lived token stored in localStorage to identify trusted devices.
 */
export interface DeviceToken {
  /** Unique device token identifier */
  tokenId: string;
  /** User identifier this token belongs to */
  userId: string;
  /** Company identifier */
  companyId: string;
  /** Device fingerprint (browser/OS info) */
  fingerprint: string;
  /** When token was created */
  createdAt: number;
  /** When token expires (default 30 days) */
  expiresAt: number;
  /** Whether token is still active */
  isActive: boolean;
  /** Encrypted session hint (for quicker login) */
  encryptedHint?: string;
}

/**
 * Login request parameters
 */
export interface LoginRequest {
  /** User's passphrase (never transmitted) */
  passphrase: string;
  /** Company identifier */
  companyId: string;
  /** User email or identifier */
  userIdentifier: string;
  /** Whether to remember this device */
  rememberDevice?: boolean;
  /** Device fingerprint */
  deviceFingerprint?: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  /** Whether login was successful */
  success: boolean;
  /** Session token if successful */
  token?: string;
  /** Device token if "remember device" was selected */
  deviceToken?: string;
  /** Session expiry timestamp */
  expiresAt?: number;
  /** Error message if failed */
  error?: string;
  /** Error code for programmatic handling */
  errorCode?: 'INVALID_PASSPHRASE' | 'ACCOUNT_LOCKED' | 'RATE_LIMITED' | 'UNKNOWN_ERROR';
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  /** Whether token is valid */
  isValid: boolean;
  /** Decoded payload if valid */
  payload?: SessionTokenPayload;
  /** Error message if invalid */
  error?: string;
  /** Error code */
  errorCode?: 'EXPIRED' | 'INVALID_SIGNATURE' | 'MALFORMED' | 'REVOKED';
}

/**
 * Session renewal result
 */
export interface SessionRenewalResult {
  /** Whether renewal was successful */
  success: boolean;
  /** New session token if successful */
  newToken?: string;
  /** New expiry timestamp */
  expiresAt?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Logout options
 */
export interface LogoutOptions {
  /** Whether to also forget the device */
  forgetDevice?: boolean;
  /** Whether to revoke all sessions (not just current) */
  revokeAllSessions?: boolean;
  /** Reason for logout (for audit trail) */
  reason?: 'user_initiated' | 'timeout' | 'security' | 'tab_close';
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** Session token expiration in milliseconds (default: 30 minutes) */
  sessionExpirationMs: number;
  /** Idle timeout in milliseconds (default: 15 minutes) */
  idleTimeoutMs: number;
  /** Device token expiration in milliseconds (default: 30 days) */
  deviceTokenExpirationMs: number;
  /** How long before expiry to auto-renew token (default: 5 minutes) */
  renewalThresholdMs: number;
  /** Maximum failed login attempts before rate limiting */
  maxFailedAttempts: number;
  /** Rate limit lockout duration in milliseconds */
  rateLimitDurationMs: number;
  /** Whether to use httpOnly cookies for tokens (preferred) */
  useHttpOnlyCookies: boolean;
  /** Whether to enable device fingerprinting */
  enableDeviceFingerprinting: boolean;
}

/**
 * Default authentication configuration
 */
export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  sessionExpirationMs: 30 * 60 * 1000, // 30 minutes
  idleTimeoutMs: 15 * 60 * 1000, // 15 minutes
  deviceTokenExpirationMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  renewalThresholdMs: 5 * 60 * 1000, // 5 minutes
  maxFailedAttempts: 5,
  rateLimitDurationMs: 15 * 60 * 1000, // 15 minutes
  useHttpOnlyCookies: false, // Not available in client-side only app
  enableDeviceFingerprinting: true,
};

/**
 * Failed login attempt tracking
 */
export interface FailedLoginAttempt {
  /** User identifier or IP */
  identifier: string;
  /** Number of failed attempts */
  count: number;
  /** Timestamp of first failed attempt */
  firstAttemptAt: number;
  /** Timestamp of last failed attempt */
  lastAttemptAt: number;
  /** When the rate limit expires */
  lockedUntil?: number;
}

/**
 * Session event for logging/monitoring
 */
export interface SessionEvent {
  /** Event type */
  type: 'login' | 'logout' | 'renewal' | 'timeout' | 'validation_failed';
  /** Session identifier */
  sessionId?: string;
  /** User identifier */
  userId?: string;
  /** Timestamp of event */
  timestamp: number;
  /** Additional event details */
  details?: Record<string, unknown>;
}

/**
 * Test data for passphrase validation
 *
 * When a user creates an account, we encrypt a known test value
 * to validate future login attempts.
 */
export interface PassphraseTestData {
  /** Company identifier */
  companyId: string;
  /** Encrypted test value */
  encryptedTest: string;
  /** IV used for encryption */
  iv: string;
  /** Auth tag for GCM */
  authTag: string;
  /** Salt used for key derivation */
  salt: string;
  /** Argon2id parameters used */
  kdfParams: {
    memoryCost: number;
    timeCost: number;
    parallelism: number;
  };
}
