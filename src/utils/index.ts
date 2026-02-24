/**
 * Utilities Index
 *
 * Central export point for all utility functions.
 */

// Device identification
export {
  generateDeviceId,
  getDeviceId,
  clearDeviceId,
  generateId,
} from './device'

// Encoding utilities
export {
  bytesToBase64,
  base64ToBytes,
  bytesToBase64Url,
  base64UrlToBytes,
  stringToBase64,
  base64ToString,
  bufferToHex,
  hexToBytes,
} from './encoding'

// Version vector utilities
export {
  type VersionVector,
  initVersionVector,
  incrementVersionVector,
  mergeVersionVectors,
  compareVersionVectors,
} from './versionVector'

// Money utilities
export {
  toCents,
  fromCents,
  addMoney,
  subtractMoney,
  multiplyMoney,
  formatMoney,
  isBalanced,
  ZERO_CENTS,
} from './money'

// Logging
export { logger, LogLevel } from './logger'

// Error handling
export {
  ErrorCategory,
  ErrorCode,
  type ErrorResult,
  type OperationResult,
  success,
  error,
  getUserFriendlyMessage,
  isRecoverableError,
  AppError,
} from './errors'

// Secure storage
export {
  SecureLocalStorage,
  getSecureStorage,
  initializeSecureStorage,
} from './secureStorage'

// Rate limiting
export {
  RateLimiter,
  RateLimitError,
  rateLimiter,
  CRYPTO_RATE_LIMITS,
  withRateLimit,
  formatWaitTime,
  type RateLimitConfig,
  type RateLimitResult,
} from './rateLimiter'

// HTML sanitization (XSS prevention)
export {
  sanitizeHtml,
  sanitizeHtmlStrict,
  sanitizeUrl,
  sanitizeEmailHtml,
} from './sanitize'

// Security event logging
export {
  logSecurityEvent,
  logFailedLogin,
  logAuthorizationFailure,
  logRateLimitExceeded,
  logSuspiciousActivity,
  logAccountLockout,
  querySecurityEvents,
  getSecurityEventStats,
  SecurityEventType,
  type SecurityEvent,
  type FailedLoginDetails,
  type AuthorizationFailureDetails,
  type RateLimitExceededDetails,
  type SuspiciousActivityDetails,
  type AccountLockoutDetails,
  type SecurityEventDetails,
} from './securityLogger'
