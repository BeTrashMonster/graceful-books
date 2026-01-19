/**
 * Authentication Module
 *
 * Barrel export file for authentication functionality.
 * Provides passphrase-based authentication, session management,
 * device token management, and secure logout.
 */

// Type exports
export type {
  SessionTokenPayload,
  SessionState,
  DeviceToken,
  LoginRequest,
  LoginResponse,
  TokenValidationResult,
  SessionRenewalResult,
  LogoutOptions,
  AuthConfig,
  FailedLoginAttempt,
  SessionEvent,
  PassphraseTestData,
} from './types';

export { DEFAULT_AUTH_CONFIG } from './types';

// Session management
export {
  generateSessionToken,
  validateSessionToken,
  createSession,
  getActiveSession,
  updateSessionActivity,
  renewSession,
  clearSession,
  generateSessionId,
  addSessionEventListener,
  removeSessionEventListener,
  hasActiveSession,
  getTimeUntilExpiration,
  getTimeSinceLastActivity,
} from './session';

// Login and authentication
export {
  login,
  createPassphraseTestData,
  storePassphraseTestData,
  validatePassphraseStrength,
} from './login';

// Session storage and device tokens
export {
  generateDeviceFingerprint,
  getDeviceFingerprint,
  getDeviceFingerprintDisclaimer,
  storeDeviceToken,
  getDeviceToken,
  createDeviceToken,
  revokeDeviceToken,
  revokeAllDeviceTokens,
  isDeviceRemembered,
  updateDeviceTokenActivity,
  storeSessionData,
  getSessionData,
  removeSessionData,
  clearAllSessionData,
  storeSessionToken,
  getSessionToken,
  removeSessionToken,
  setupBeforeUnloadHandler,
  encryptDeviceHint,
  decryptDeviceHint,
} from './sessionStorage';

// Logout and cleanup
export {
  logout,
  onLogout,
  offLogout,
  emergencyLogout,
  setupLogoutHandlers,
  clearDataOnLogout,
  validateLogout,
  getLogoutMessage,
  scheduleLogout,
  cancelScheduledLogout,
  logoutWithConfirmation,
  zeroMemory,
  clearAllBrowserStorage,
} from './logout';
