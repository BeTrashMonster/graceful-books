/**
 * Error Sanitizer Module
 *
 * Security Fix L-1: Sanitizes error messages to prevent information disclosure.
 *
 * In production, error messages are user-friendly and follow the Steadiness
 * communication style. Internal details are logged securely for debugging.
 *
 * In development, full error details are available for debugging.
 */

import { logger } from './logger';

/**
 * Security error codes for debugging without exposing implementation details
 *
 * These codes allow support teams to identify issues while keeping
 * internal implementation details private.
 */
export enum SecurityErrorCode {
  // Authentication errors (ERR_AUTH_xxx)
  AUTH_FAILED = 'ERR_AUTH_001',
  AUTH_LOCKED = 'ERR_AUTH_002',
  AUTH_SESSION_EXPIRED = 'ERR_AUTH_003',
  AUTH_SESSION_INVALID = 'ERR_AUTH_004',
  AUTH_RATE_LIMITED = 'ERR_AUTH_005',

  // Cryptographic errors (ERR_CRYPTO_xxx)
  CRYPTO_FAILED = 'ERR_CRYPTO_001',
  CRYPTO_KEY_MISMATCH = 'ERR_CRYPTO_002',
  CRYPTO_KEY_EXPIRED = 'ERR_CRYPTO_003',
  CRYPTO_ALGORITHM_UNSUPPORTED = 'ERR_CRYPTO_004',
  CRYPTO_DECRYPTION_FAILED = 'ERR_CRYPTO_005',

  // Storage errors (ERR_STORAGE_xxx)
  STORAGE_FAILED = 'ERR_STORAGE_001',
  STORAGE_NOT_FOUND = 'ERR_STORAGE_002',
  STORAGE_QUOTA_EXCEEDED = 'ERR_STORAGE_003',

  // Network errors (ERR_NETWORK_xxx)
  NETWORK_FAILED = 'ERR_NETWORK_001',
  NETWORK_TIMEOUT = 'ERR_NETWORK_002',
  NETWORK_OFFLINE = 'ERR_NETWORK_003',

  // Validation errors (ERR_VALIDATION_xxx)
  VALIDATION_FAILED = 'ERR_VALIDATION_001',
  VALIDATION_REQUIRED = 'ERR_VALIDATION_002',
  VALIDATION_FORMAT = 'ERR_VALIDATION_003',

  // General errors (ERR_GENERAL_xxx)
  UNKNOWN = 'ERR_GENERAL_001',
  INTERNAL = 'ERR_GENERAL_002',
}

/**
 * User-friendly messages for each security error code
 *
 * These messages follow the Steadiness communication style:
 * - Patient and supportive
 * - Clear about what happened
 * - Reassuring about next steps
 * - No technical jargon
 */
const USER_FRIENDLY_MESSAGES: Record<SecurityErrorCode, string> = {
  // Authentication
  [SecurityErrorCode.AUTH_FAILED]:
    "We couldn't sign you in. Please double-check your passphrase and try again.",
  [SecurityErrorCode.AUTH_LOCKED]:
    'Your account is temporarily locked for your protection. Please wait a few minutes before trying again.',
  [SecurityErrorCode.AUTH_SESSION_EXPIRED]:
    'Your session has ended. Please sign in again to continue.',
  [SecurityErrorCode.AUTH_SESSION_INVALID]:
    "Something went wrong with your session. Let's get you signed in again.",
  [SecurityErrorCode.AUTH_RATE_LIMITED]:
    "We've noticed a few attempts. For your security, please wait a moment before trying again.",

  // Cryptographic
  [SecurityErrorCode.CRYPTO_FAILED]:
    "We couldn't secure your data properly. Please try again.",
  [SecurityErrorCode.CRYPTO_KEY_MISMATCH]:
    "We couldn't access your data. Please try signing in again.",
  [SecurityErrorCode.CRYPTO_KEY_EXPIRED]:
    'Your security key has expired. Please sign in again to get a fresh key.',
  [SecurityErrorCode.CRYPTO_ALGORITHM_UNSUPPORTED]:
    'Your data uses an older format. Please contact support for assistance.',
  [SecurityErrorCode.CRYPTO_DECRYPTION_FAILED]:
    "We couldn't read your data. Please check your passphrase and try again.",

  // Storage
  [SecurityErrorCode.STORAGE_FAILED]:
    "We couldn't save your changes. Please try again.",
  [SecurityErrorCode.STORAGE_NOT_FOUND]:
    "We couldn't find what you're looking for. It may have been moved.",
  [SecurityErrorCode.STORAGE_QUOTA_EXCEEDED]:
    "Your device's storage is full. Please free up some space and try again.",

  // Network
  [SecurityErrorCode.NETWORK_FAILED]:
    "We're having trouble connecting. Please check your internet connection.",
  [SecurityErrorCode.NETWORK_TIMEOUT]:
    'The request took too long. Please try again when your connection is better.',
  [SecurityErrorCode.NETWORK_OFFLINE]:
    "You're working offline. Your changes will sync when you're back online.",

  // Validation
  [SecurityErrorCode.VALIDATION_FAILED]:
    "Something doesn't look quite right. Please check your entry and try again.",
  [SecurityErrorCode.VALIDATION_REQUIRED]:
    'We need this information to continue. Take your time filling it out.',
  [SecurityErrorCode.VALIDATION_FORMAT]:
    "That doesn't look quite right. Please check the format and try again.",

  // General
  [SecurityErrorCode.UNKNOWN]:
    'Something unexpected happened. Please try again.',
  [SecurityErrorCode.INTERNAL]:
    "Something went wrong on our end. We're looking into it.",
};

/**
 * Patterns to detect and redact from error messages
 *
 * These patterns match common sensitive information that might
 * appear in error messages.
 */
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // File paths
  { pattern: /\/[\w/.-]+\.\w+/g, replacement: '[path]' },
  { pattern: /[A-Z]:\\[\w\\.-]+/g, replacement: '[path]' },
  // Stack traces
  { pattern: /at\s+[\w.<>]+\s+\([^)]+\)/g, replacement: '' },
  { pattern: /^\s*at\s+.+$/gm, replacement: '' },
  // Memory addresses
  { pattern: /0x[0-9a-fA-F]+/g, replacement: '[addr]' },
  // Database details
  { pattern: /table\s+["'`]?\w+["'`]?/gi, replacement: 'table [table]' },
  { pattern: /column\s+["'`]?\w+["'`]?/gi, replacement: 'column [column]' },
  // Key/token values
  { pattern: /key[:\s]+[A-Za-z0-9+/=]+/gi, replacement: 'key [redacted]' },
  { pattern: /token[:\s]+[A-Za-z0-9._-]+/gi, replacement: 'token [redacted]' },
  // IV/nonce values
  { pattern: /iv[:\s]+[A-Za-z0-9+/=]+/gi, replacement: 'iv [redacted]' },
  // Salt values
  { pattern: /salt[:\s]+[A-Za-z0-9+/=]+/gi, replacement: 'salt [redacted]' },
];

/**
 * Sanitized error result
 */
export interface SanitizedError {
  /** User-friendly message safe to display */
  userMessage: string;
  /** Error code for debugging */
  errorCode: SecurityErrorCode;
  /** Detailed information for secure logging only */
  logDetails: string;
}

/**
 * Check if we're in development mode
 *
 * Uses Vite's import.meta.env.DEV or falls back to checking NODE_ENV.
 *
 * @returns True if in development mode
 */
export function isDevMode(): boolean {
  // Check Vite's environment variable
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV !== undefined) {
    return import.meta.env.DEV;
  }

  // Fallback to NODE_ENV check
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    return process.env.NODE_ENV === 'development';
  }

  // Default to production (safer)
  return false;
}

/**
 * Redact sensitive information from an error message
 *
 * @param message - The message to redact
 * @returns Message with sensitive information removed
 */
function redactSensitiveInfo(message: string): string {
  let redacted = message;

  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }

  // Clean up extra whitespace from removed content
  redacted = redacted.replace(/\n\s*\n/g, '\n').trim();

  return redacted;
}

/**
 * Map error to appropriate security error code
 *
 * Analyzes the error to determine the most appropriate error code
 * without exposing implementation details.
 *
 * @param error - The error to analyze
 * @param context - Optional context hint
 * @returns Appropriate security error code
 */
function mapErrorToCode(error: Error, context?: string): SecurityErrorCode {
  const message = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();

  // Context-based mapping
  if (context) {
    const ctx = context.toLowerCase();

    if (ctx.includes('auth') || ctx.includes('login')) {
      if (message.includes('locked') || message.includes('too many')) {
        return SecurityErrorCode.AUTH_LOCKED;
      }
      if (message.includes('expired')) {
        return SecurityErrorCode.AUTH_SESSION_EXPIRED;
      }
      if (message.includes('invalid') || message.includes('session')) {
        return SecurityErrorCode.AUTH_SESSION_INVALID;
      }
      if (message.includes('rate') || message.includes('limit')) {
        return SecurityErrorCode.AUTH_RATE_LIMITED;
      }
      return SecurityErrorCode.AUTH_FAILED;
    }

    if (ctx.includes('crypto') || ctx.includes('encrypt') || ctx.includes('decrypt')) {
      if (message.includes('key') && message.includes('mismatch')) {
        return SecurityErrorCode.CRYPTO_KEY_MISMATCH;
      }
      if (message.includes('expired')) {
        return SecurityErrorCode.CRYPTO_KEY_EXPIRED;
      }
      if (message.includes('algorithm') || message.includes('unsupported')) {
        return SecurityErrorCode.CRYPTO_ALGORITHM_UNSUPPORTED;
      }
      if (message.includes('decrypt')) {
        return SecurityErrorCode.CRYPTO_DECRYPTION_FAILED;
      }
      return SecurityErrorCode.CRYPTO_FAILED;
    }

    if (ctx.includes('storage') || ctx.includes('database') || ctx.includes('db')) {
      if (message.includes('not found') || message.includes('missing')) {
        return SecurityErrorCode.STORAGE_NOT_FOUND;
      }
      if (message.includes('quota') || message.includes('full')) {
        return SecurityErrorCode.STORAGE_QUOTA_EXCEEDED;
      }
      return SecurityErrorCode.STORAGE_FAILED;
    }

    if (ctx.includes('network') || ctx.includes('sync') || ctx.includes('fetch')) {
      if (message.includes('timeout')) {
        return SecurityErrorCode.NETWORK_TIMEOUT;
      }
      if (message.includes('offline')) {
        return SecurityErrorCode.NETWORK_OFFLINE;
      }
      return SecurityErrorCode.NETWORK_FAILED;
    }

    if (ctx.includes('valid')) {
      if (message.includes('required') || message.includes('missing')) {
        return SecurityErrorCode.VALIDATION_REQUIRED;
      }
      if (message.includes('format')) {
        return SecurityErrorCode.VALIDATION_FORMAT;
      }
      return SecurityErrorCode.VALIDATION_FAILED;
    }
  }

  // Message-based mapping (fallback)
  if (message.includes('passphrase') || message.includes('password') || message.includes('login')) {
    return SecurityErrorCode.AUTH_FAILED;
  }

  if (message.includes('decrypt') || message.includes('encrypt') || message.includes('crypto')) {
    return SecurityErrorCode.CRYPTO_FAILED;
  }

  if (message.includes('network') || message.includes('fetch') || errorName === 'typeerror') {
    return SecurityErrorCode.NETWORK_FAILED;
  }

  if (message.includes('storage') || message.includes('database')) {
    return SecurityErrorCode.STORAGE_FAILED;
  }

  if (message.includes('validation') || message.includes('invalid')) {
    return SecurityErrorCode.VALIDATION_FAILED;
  }

  return SecurityErrorCode.UNKNOWN;
}

/**
 * Sanitize an error for safe user display
 *
 * Converts internal error details to a user-friendly message while
 * preserving full details for secure logging.
 *
 * @param error - The error to sanitize
 * @param context - Optional context for better error mapping
 * @returns Sanitized error with user message and log details
 *
 * @example
 * ```typescript
 * try {
 *   await decryptData(data, key);
 * } catch (error) {
 *   const sanitized = sanitizeError(error as Error, 'crypto');
 *   showUserMessage(sanitized.userMessage);
 *   logSecurityError(error as Error, 'crypto');
 * }
 * ```
 */
export function sanitizeError(error: Error, context?: string): SanitizedError {
  const errorCode = mapErrorToCode(error, context);
  const userMessage = USER_FRIENDLY_MESSAGES[errorCode];

  // Create detailed log message for debugging
  const logDetails = [
    `Error: ${error.name}`,
    `Message: ${redactSensitiveInfo(error.message)}`,
    `Code: ${errorCode}`,
    context ? `Context: ${context}` : '',
    error.stack ? `Stack: ${redactSensitiveInfo(error.stack)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    userMessage,
    errorCode,
    logDetails,
  };
}

/**
 * Log a security error securely
 *
 * In development mode, logs full error details.
 * In production mode, logs only the error code and redacted message.
 *
 * @param error - The error to log
 * @param context - Context for the error (e.g., 'auth', 'crypto')
 */
export function logSecurityError(error: Error, context: string): void {
  const securityLogger = logger.child('Security');
  const sanitized = sanitizeError(error, context);

  if (isDevMode()) {
    // Full details in development
    securityLogger.error(
      `[${sanitized.errorCode}] ${context}: ${error.message}`,
      {
        name: error.name,
        message: error.message,
        stack: error.stack,
        context,
      }
    );
  } else {
    // Sanitized details in production
    securityLogger.error(
      `[${sanitized.errorCode}] ${context}: ${sanitized.userMessage}`,
      { errorCode: sanitized.errorCode }
    );
  }
}

/**
 * Create a sanitized error response for API/UI consumption
 *
 * Returns appropriate level of detail based on environment.
 *
 * @param error - The error to create response for
 * @param context - Context for error mapping
 * @returns Error response object
 */
export function createErrorResponse(
  error: Error,
  context?: string
): {
  success: false;
  error: string;
  errorCode: string;
  details?: string;
} {
  const sanitized = sanitizeError(error, context);

  const response: {
    success: false;
    error: string;
    errorCode: string;
    details?: string;
  } = {
    success: false,
    error: sanitized.userMessage,
    errorCode: sanitized.errorCode,
  };

  // Include full details only in development
  if (isDevMode()) {
    response.details = error.message;
  }

  return response;
}

/**
 * Wrap an async function with error sanitization
 *
 * Automatically catches errors and returns sanitized responses.
 *
 * @param fn - Async function to wrap
 * @param context - Context for error mapping
 * @returns Wrapped function
 *
 * @example
 * ```typescript
 * const safeDecrypt = withErrorSanitization(
 *   async (data: EncryptedData) => decrypt(data, key),
 *   'crypto'
 * );
 *
 * const result = await safeDecrypt(encryptedData);
 * if (!result.success) {
 *   showUserMessage(result.error);
 * }
 * ```
 */
export function withErrorSanitization<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  context: string
): (...args: TArgs) => Promise<
  | { success: true; data: TResult }
  | { success: false; error: string; errorCode: string }
> {
  return async (...args: TArgs) => {
    try {
      const result = await fn(...args);
      return { success: true, data: result };
    } catch (error) {
      logSecurityError(error as Error, context);
      const sanitized = sanitizeError(error as Error, context);
      return {
        success: false,
        error: sanitized.userMessage,
        errorCode: sanitized.errorCode,
      };
    }
  };
}

/**
 * Get user-friendly message for a security error code
 *
 * @param errorCode - The security error code
 * @returns User-friendly message
 */
export function getUserMessage(errorCode: SecurityErrorCode): string {
  return USER_FRIENDLY_MESSAGES[errorCode] || USER_FRIENDLY_MESSAGES[SecurityErrorCode.UNKNOWN];
}
