/**
 * Error Codes and Types
 *
 * Centralized error handling with specific codes for different error categories.
 * These codes allow programmatic error handling and user-friendly messages.
 */

/**
 * Error categories
 */
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  DATABASE = 'DATABASE',
  ENCRYPTION = 'ENCRYPTION',
  NETWORK = 'NETWORK',
  BUSINESS = 'BUSINESS',
  SYSTEM = 'SYSTEM',
}

/**
 * Specific error codes
 */
export enum ErrorCode {
  // Validation errors (400-level)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_VALUE = 'INVALID_VALUE',
  VALUE_OUT_OF_RANGE = 'VALUE_OUT_OF_RANGE',
  DUPLICATE_VALUE = 'DUPLICATE_VALUE',

  // Authentication errors
  INVALID_PASSPHRASE = 'INVALID_PASSPHRASE',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_INVALID = 'SESSION_INVALID',
  RATE_LIMITED = 'RATE_LIMITED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',

  // Authorization errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INSUFFICIENT_ROLE = 'INSUFFICIENT_ROLE',
  RESOURCE_ACCESS_DENIED = 'RESOURCE_ACCESS_DENIED',

  // Database errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  REFERENTIAL_INTEGRITY = 'REFERENTIAL_INTEGRITY',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // Encryption errors
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  KEY_DERIVATION_FAILED = 'KEY_DERIVATION_FAILED',
  INVALID_KEY = 'INVALID_KEY',

  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  SYNC_FAILED = 'SYNC_FAILED',
  OFFLINE = 'OFFLINE',

  // Business logic errors
  UNBALANCED_TRANSACTION = 'UNBALANCED_TRANSACTION',
  INVALID_TRANSACTION_STATE = 'INVALID_TRANSACTION_STATE',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  RECONCILIATION_MISMATCH = 'RECONCILIATION_MISMATCH',
  IMMUTABLE_RECORD = 'IMMUTABLE_RECORD',

  // System errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}

/**
 * Error result structure used by all operations
 */
export interface ErrorResult {
  code: ErrorCode
  message: string
  category: ErrorCategory
  details?: unknown
  field?: string
}

/**
 * Operation result that can be success or error
 */
export interface OperationResult<T> {
  success: boolean
  data?: T
  error?: ErrorResult
}

/**
 * Create a successful result
 */
export function success<T>(data: T): OperationResult<T> {
  return { success: true, data }
}

/**
 * Create an error result
 */
export function error<T>(
  code: ErrorCode,
  message: string,
  details?: unknown,
  field?: string
): OperationResult<T> {
  return {
    success: false,
    error: {
      code,
      message,
      category: getErrorCategory(code),
      details,
      field,
    },
  }
}

/**
 * Get error category from error code
 */
function getErrorCategory(code: ErrorCode): ErrorCategory {
  if (code.startsWith('VALIDATION') || code === 'REQUIRED_FIELD_MISSING' ||
      code === 'INVALID_FORMAT' || code === 'INVALID_VALUE' ||
      code === 'VALUE_OUT_OF_RANGE' || code === 'DUPLICATE_VALUE') {
    return ErrorCategory.VALIDATION
  }

  if (code === 'INVALID_PASSPHRASE' || code === 'SESSION_EXPIRED' ||
      code === 'SESSION_INVALID' || code === 'RATE_LIMITED' ||
      code === 'ACCOUNT_LOCKED') {
    return ErrorCategory.AUTHENTICATION
  }

  if (code === 'PERMISSION_DENIED' || code === 'INSUFFICIENT_ROLE' ||
      code === 'RESOURCE_ACCESS_DENIED') {
    return ErrorCategory.AUTHORIZATION
  }

  if (code === 'NOT_FOUND' || code === 'ALREADY_EXISTS' ||
      code === 'CONSTRAINT_VIOLATION' || code === 'REFERENTIAL_INTEGRITY' ||
      code === 'TRANSACTION_FAILED' || code === 'DATABASE_ERROR') {
    return ErrorCategory.DATABASE
  }

  if (code === 'ENCRYPTION_ERROR' || code === 'DECRYPTION_FAILED' ||
      code === 'KEY_DERIVATION_FAILED' || code === 'INVALID_KEY') {
    return ErrorCategory.ENCRYPTION
  }

  if (code === 'NETWORK_ERROR' || code === 'TIMEOUT' ||
      code === 'SYNC_FAILED' || code === 'OFFLINE') {
    return ErrorCategory.NETWORK
  }

  if (code === 'UNBALANCED_TRANSACTION' || code === 'INVALID_TRANSACTION_STATE' ||
      code === 'ACCOUNT_INACTIVE' || code === 'INSUFFICIENT_BALANCE' ||
      code === 'RECONCILIATION_MISMATCH' || code === 'IMMUTABLE_RECORD') {
    return ErrorCategory.BUSINESS
  }

  return ErrorCategory.SYSTEM
}

/**
 * Get user-friendly message for error (Steadiness communication style)
 */
export function getUserFriendlyMessage(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    // Validation
    [ErrorCode.VALIDATION_ERROR]: "Something doesn't look quite right. Please check your entry and try again.",
    [ErrorCode.REQUIRED_FIELD_MISSING]: "We need this information to continue. Take your time filling it out.",
    [ErrorCode.INVALID_FORMAT]: "That doesn't look quite right. Please check the format and try again.",
    [ErrorCode.INVALID_VALUE]: "That value doesn't seem right. Could you double-check it?",
    [ErrorCode.VALUE_OUT_OF_RANGE]: "That number is outside the expected range. Please adjust it.",
    [ErrorCode.DUPLICATE_VALUE]: "This already exists. Would you like to use a different value?",

    // Authentication
    [ErrorCode.INVALID_PASSPHRASE]: "That passphrase doesn't match what we have. Please double-check and try again.",
    [ErrorCode.SESSION_EXPIRED]: "Your session has ended for security. Please sign in again.",
    [ErrorCode.SESSION_INVALID]: "Something went wrong with your session. Please sign in again.",
    [ErrorCode.RATE_LIMITED]: "We've noticed a few attempts. For your security, please wait a moment.",
    [ErrorCode.ACCOUNT_LOCKED]: "Your account is temporarily locked for security. Please wait or contact support.",

    // Authorization
    [ErrorCode.PERMISSION_DENIED]: "You don't have permission for this action. Contact your admin if needed.",
    [ErrorCode.INSUFFICIENT_ROLE]: "This feature requires a different role. Contact your admin if needed.",
    [ErrorCode.RESOURCE_ACCESS_DENIED]: "You don't have access to this item. Contact your admin if needed.",

    // Database
    [ErrorCode.NOT_FOUND]: "We couldn't find what you're looking for. It may have been moved or deleted.",
    [ErrorCode.ALREADY_EXISTS]: "This already exists. Would you like to update the existing one instead?",
    [ErrorCode.CONSTRAINT_VIOLATION]: "This change would create a conflict. Please review and try again.",
    [ErrorCode.REFERENTIAL_INTEGRITY]: "This is connected to other records. Please update those first.",
    [ErrorCode.TRANSACTION_FAILED]: "We couldn't complete that change. Please try again.",
    [ErrorCode.DATABASE_ERROR]: "We're having trouble accessing your data. Please try again.",

    // Encryption
    [ErrorCode.ENCRYPTION_ERROR]: "We couldn't secure your data properly. Please try again.",
    [ErrorCode.DECRYPTION_FAILED]: "We couldn't read your data. Please check your passphrase.",
    [ErrorCode.KEY_DERIVATION_FAILED]: "We had trouble with your security key. Please try again.",
    [ErrorCode.INVALID_KEY]: "Your security key doesn't seem right. Please sign out and back in.",

    // Network
    [ErrorCode.NETWORK_ERROR]: "We're having trouble connecting. Please check your internet.",
    [ErrorCode.TIMEOUT]: "That took too long. Please try again when the connection is better.",
    [ErrorCode.SYNC_FAILED]: "We couldn't sync your data. Don't worry - your work is saved locally.",
    [ErrorCode.OFFLINE]: "You're working offline. Your changes will sync when you're back online.",

    // Business
    [ErrorCode.UNBALANCED_TRANSACTION]: "Debits and credits must be equal. Please check your amounts.",
    [ErrorCode.INVALID_TRANSACTION_STATE]: "This transaction can't be modified in its current state.",
    [ErrorCode.ACCOUNT_INACTIVE]: "This account is inactive. Please choose a different account.",
    [ErrorCode.INSUFFICIENT_BALANCE]: "There aren't enough funds for this transaction.",
    [ErrorCode.RECONCILIATION_MISMATCH]: "The amounts don't match. Please review the differences.",
    [ErrorCode.IMMUTABLE_RECORD]: "This record can't be changed after posting. You can void it instead.",

    // System
    [ErrorCode.UNKNOWN_ERROR]: "Something unexpected happened. Please try again.",
    [ErrorCode.INTERNAL_ERROR]: "Something went wrong on our end. We're looking into it.",
    [ErrorCode.NOT_IMPLEMENTED]: "This feature isn't available yet. It's coming soon!",
    [ErrorCode.CONFIGURATION_ERROR]: "There's a configuration issue. Please contact support.",
  }

  return messages[code] || messages[ErrorCode.UNKNOWN_ERROR]
}

/**
 * Check if an error is recoverable
 */
export function isRecoverableError(code: ErrorCode): boolean {
  const nonRecoverable = [
    ErrorCode.ACCOUNT_LOCKED,
    ErrorCode.INVALID_KEY,
    ErrorCode.IMMUTABLE_RECORD,
    ErrorCode.INTERNAL_ERROR,
    ErrorCode.CONFIGURATION_ERROR,
  ]

  return !nonRecoverable.includes(code)
}

/**
 * Application error class
 */
export class AppError extends Error {
  code: ErrorCode
  category: ErrorCategory
  details?: unknown
  field?: string

  constructor(code: ErrorCode, message?: string, details?: unknown, field?: string) {
    super(message || getUserFriendlyMessage(code))
    this.name = 'AppError'
    this.code = code
    this.category = getErrorCategory(code)
    this.details = details
    this.field = field
  }

  toErrorResult(): ErrorResult {
    return {
      code: this.code,
      message: this.message,
      category: this.category,
      details: this.details,
      field: this.field,
    }
  }
}
