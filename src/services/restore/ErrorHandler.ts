/**
 * Restoration Error Handler Service
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 5, Task 5.8:
 * Handles all types of restoration errors with helpful messaging.
 *
 * Error Types:
 * - Corrupt backup files
 * - Wrong password
 * - Network failures
 * - Epoch mismatch (revoked user)
 * - Invalid file format
 * - Server errors
 *
 * UX Principle: Never blame user, always offer help
 */

/**
 * Error types that can occur during restoration
 */
export enum RestoreErrorType {
  // File-related errors
  INVALID_FILE_FORMAT = 'INVALID_FILE_FORMAT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_CORRUPTED = 'FILE_CORRUPTED',

  // Authentication errors
  WRONG_PASSWORD = 'WRONG_PASSWORD',
  USER_REVOKED = 'USER_REVOKED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',

  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  SERVER_ERROR = 'SERVER_ERROR',

  // Link errors
  INVALID_LINK = 'INVALID_LINK',
  LINK_EXPIRED = 'LINK_EXPIRED',
  LINK_ALREADY_USED = 'LINK_ALREADY_USED',

  // Data errors
  INCOMPATIBLE_VERSION = 'INCOMPATIBLE_VERSION',
  DATA_VALIDATION_FAILED = 'DATA_VALIDATION_FAILED',
  INSUFFICIENT_STORAGE = 'INSUFFICIENT_STORAGE',

  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Restoration error details
 */
export interface RestoreError {
  /** Error type */
  type: RestoreErrorType

  /** User-friendly error message */
  message: string

  /** Technical details (for support) */
  technicalDetails?: string

  /** Suggested recovery actions */
  suggestions: string[]

  /** Whether the user can retry */
  canRetry: boolean

  /** Whether the user should try a different method */
  shouldTryDifferentMethod: boolean
}

/**
 * Creates a user-friendly restoration error
 *
 * @param type - Error type
 * @param technicalDetails - Optional technical details
 * @returns Restoration error with helpful messaging
 */
export function createRestoreError(
  type: RestoreErrorType,
  technicalDetails?: string
): RestoreError {
  switch (type) {
    case RestoreErrorType.INVALID_FILE_FORMAT:
      return {
        type,
        message: 'This doesn't look like a valid backup file.',
        technicalDetails,
        suggestions: [
          'Make sure you're selecting a file with .encrypted, .backup, or .json extension',
          'Check that the file hasn't been modified or corrupted',
          'Try downloading a fresh backup from your email',
        ],
        canRetry: true,
        shouldTryDifferentMethod: true,
      }

    case RestoreErrorType.FILE_TOO_LARGE:
      return {
        type,
        message: 'This backup file is too large to restore.',
        technicalDetails,
        suggestions: [
          'Maximum file size is 500MB',
          'Try restoring from an email link instead',
          'Contact support if you need help with large backups',
        ],
        canRetry: false,
        shouldTryDifferentMethod: true,
      }

    case RestoreErrorType.FILE_CORRUPTED:
      return {
        type,
        message: 'This backup file appears to be corrupted.',
        technicalDetails,
        suggestions: [
          'Try a different backup file if you have one',
          'Check if you can restore from an email link instead',
          'The file may have been damaged during download',
        ],
        canRetry: false,
        shouldTryDifferentMethod: true,
      }

    case RestoreErrorType.WRONG_PASSWORD:
      return {
        type,
        message: 'That password didn't work. Want to try again?',
        technicalDetails,
        suggestions: [
          'Double-check your password for typos',
          'Make sure Caps Lock is off',
          'Use the password you normally use to log into Graceful Books',
        ],
        canRetry: true,
        shouldTryDifferentMethod: false,
      }

    case RestoreErrorType.USER_REVOKED:
      return {
        type,
        message: 'Your access has been revoked.',
        technicalDetails,
        suggestions: [
          'Contact your company administrator to restore access',
          'You can still view historical backups on this device',
          'Your local data remains accessible',
        ],
        canRetry: false,
        shouldTryDifferentMethod: false,
      }

    case RestoreErrorType.AUTHENTICATION_FAILED:
      return {
        type,
        message: 'We couldn't verify your credentials.',
        technicalDetails,
        suggestions: [
          'Check that your email and password are correct',
          'Make sure your account is still active',
          'Try resetting your password if needed',
        ],
        canRetry: true,
        shouldTryDifferentMethod: false,
      }

    case RestoreErrorType.NETWORK_ERROR:
      return {
        type,
        message: 'Unable to connect. Please check your internet connection.',
        technicalDetails,
        suggestions: [
          'Make sure you're connected to the internet',
          'Try refreshing the page',
          'Check if other websites are loading',
          'Try again in a few moments',
        ],
        canRetry: true,
        shouldTryDifferentMethod: false,
      }

    case RestoreErrorType.CONNECTION_TIMEOUT:
      return {
        type,
        message: 'The connection timed out. Let's try that again.',
        technicalDetails,
        suggestions: [
          'Your internet connection may be slow',
          'Try again when you have a better connection',
          'Consider using file upload if you have a local backup',
        ],
        canRetry: true,
        shouldTryDifferentMethod: true,
      }

    case RestoreErrorType.SERVER_ERROR:
      return {
        type,
        message: 'Something went wrong on our end. We're looking into it.',
        technicalDetails,
        suggestions: [
          'Try again in a few minutes',
          'Check our status page for any known issues',
          'Contact support if the problem persists',
        ],
        canRetry: true,
        shouldTryDifferentMethod: false,
      }

    case RestoreErrorType.INVALID_LINK:
      return {
        type,
        message: 'This restoration link doesn't look right.',
        technicalDetails,
        suggestions: [
          'Make sure you copied the entire link from your email',
          'Check that the link hasn't been split across multiple lines',
          'Try clicking the link directly from your email instead',
        ],
        canRetry: true,
        shouldTryDifferentMethod: false,
      }

    case RestoreErrorType.LINK_EXPIRED:
      return {
        type,
        message: 'This restoration link has expired.',
        technicalDetails,
        suggestions: [
          'Restoration links expire after 7 days for security',
          'Request a new backup email from your settings',
          'Try restoring from a local backup file if you have one',
        ],
        canRetry: false,
        shouldTryDifferentMethod: true,
      }

    case RestoreErrorType.LINK_ALREADY_USED:
      return {
        type,
        message: 'This restoration link has already been used.',
        technicalDetails,
        suggestions: [
          'Each link can only be used once for security',
          'Request a new backup email if you need to restore again',
          'Try restoring from a local backup file instead',
        ],
        canRetry: false,
        shouldTryDifferentMethod: true,
      }

    case RestoreErrorType.INCOMPATIBLE_VERSION:
      return {
        type,
        message: 'This backup was created with a different version.',
        technicalDetails,
        suggestions: [
          'This backup may be from a newer or older version',
          'Contact support for help migrating your data',
          'Check if there's an app update available',
        ],
        canRetry: false,
        shouldTryDifferentMethod: false,
      }

    case RestoreErrorType.DATA_VALIDATION_FAILED:
      return {
        type,
        message: 'Some data in this backup doesn't look right.',
        technicalDetails,
        suggestions: [
          'The backup file may be corrupted',
          'Try a different backup file if you have one',
          'Contact support with the technical details below',
        ],
        canRetry: false,
        shouldTryDifferentMethod: true,
      }

    case RestoreErrorType.INSUFFICIENT_STORAGE:
      return {
        type,
        message: 'Not enough storage space to restore your data.',
        technicalDetails,
        suggestions: [
          'Free up some space in your browser',
          'Clear old data from other websites',
          'Try using a different browser with more available space',
        ],
        canRetry: true,
        shouldTryDifferentMethod: false,
      }

    case RestoreErrorType.UNKNOWN_ERROR:
    default:
      return {
        type: RestoreErrorType.UNKNOWN_ERROR,
        message: 'Something unexpected happened. Let's try that again.',
        technicalDetails,
        suggestions: [
          'Try refreshing the page and starting over',
          'Make sure your browser is up to date',
          'Contact support if the problem continues',
        ],
        canRetry: true,
        shouldTryDifferentMethod: true,
      }
  }
}

/**
 * Determines error type from exception
 *
 * @param error - Error object
 * @returns Error type enum
 */
export function determineErrorType(error: unknown): RestoreErrorType {
  if (!(error instanceof Error)) {
    return RestoreErrorType.UNKNOWN_ERROR
  }

  const message = error.message.toLowerCase()

  // Check for specific error patterns
  if (message.includes('password') || message.includes('incorrect')) {
    return RestoreErrorType.WRONG_PASSWORD
  }

  if (message.includes('revoked') || message.includes('epoch')) {
    return RestoreErrorType.USER_REVOKED
  }

  if (message.includes('network') || message.includes('fetch')) {
    return RestoreErrorType.NETWORK_ERROR
  }

  if (message.includes('timeout')) {
    return RestoreErrorType.CONNECTION_TIMEOUT
  }

  if (message.includes('expired')) {
    return RestoreErrorType.LINK_EXPIRED
  }

  if (message.includes('already used') || message.includes('used once')) {
    return RestoreErrorType.LINK_ALREADY_USED
  }

  if (message.includes('invalid link') || message.includes('malformed')) {
    return RestoreErrorType.INVALID_LINK
  }

  if (message.includes('corrupted') || message.includes('invalid backup')) {
    return RestoreErrorType.FILE_CORRUPTED
  }

  if (message.includes('too large') || message.includes('size limit')) {
    return RestoreErrorType.FILE_TOO_LARGE
  }

  if (message.includes('format') || message.includes('extension')) {
    return RestoreErrorType.INVALID_FILE_FORMAT
  }

  if (message.includes('version') || message.includes('compatible')) {
    return RestoreErrorType.INCOMPATIBLE_VERSION
  }

  if (message.includes('storage') || message.includes('quota')) {
    return RestoreErrorType.INSUFFICIENT_STORAGE
  }

  if (message.includes('authentication') || message.includes('credentials')) {
    return RestoreErrorType.AUTHENTICATION_FAILED
  }

  if (message.includes('validation')) {
    return RestoreErrorType.DATA_VALIDATION_FAILED
  }

  if (message.includes('server') || message.includes('500') || message.includes('503')) {
    return RestoreErrorType.SERVER_ERROR
  }

  return RestoreErrorType.UNKNOWN_ERROR
}

/**
 * Handles a restoration error
 *
 * @param error - Error object
 * @returns Restoration error with helpful messaging
 *
 * @example
 * ```typescript
 * try {
 *   await restoreFromFile(file, password)
 * } catch (error) {
 *   const restoreError = handleRestoreError(error)
 *   console.error(restoreError.message)
 *   console.log('Suggestions:', restoreError.suggestions)
 * }
 * ```
 */
export function handleRestoreError(error: unknown): RestoreError {
  const errorType = determineErrorType(error)
  const technicalDetails = error instanceof Error ? error.message : String(error)

  return createRestoreError(errorType, technicalDetails)
}
