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
