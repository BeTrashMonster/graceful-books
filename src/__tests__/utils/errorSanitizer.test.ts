/**
 * Error Sanitizer Tests
 *
 * Tests for the error sanitization module (Security Fix L-1).
 * Verifies that error messages are properly sanitized to prevent
 * information disclosure while maintaining debugging capability.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sanitizeError,
  logSecurityError,
  isDevMode,
  SecurityErrorCode,
  createErrorResponse,
  withErrorSanitization,
  getUserMessage,
} from '../../utils/errorSanitizer';

// Mock the logger module
vi.mock('../../utils/logger', () => ({
  logger: {
    child: () => ({
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

describe('SecurityErrorCode', () => {
  it('should have authentication error codes', () => {
    expect(SecurityErrorCode.AUTH_FAILED).toBe('ERR_AUTH_001');
    expect(SecurityErrorCode.AUTH_LOCKED).toBe('ERR_AUTH_002');
    expect(SecurityErrorCode.AUTH_SESSION_EXPIRED).toBe('ERR_AUTH_003');
    expect(SecurityErrorCode.AUTH_SESSION_INVALID).toBe('ERR_AUTH_004');
    expect(SecurityErrorCode.AUTH_RATE_LIMITED).toBe('ERR_AUTH_005');
  });

  it('should have cryptographic error codes', () => {
    expect(SecurityErrorCode.CRYPTO_FAILED).toBe('ERR_CRYPTO_001');
    expect(SecurityErrorCode.CRYPTO_KEY_MISMATCH).toBe('ERR_CRYPTO_002');
    expect(SecurityErrorCode.CRYPTO_KEY_EXPIRED).toBe('ERR_CRYPTO_003');
    expect(SecurityErrorCode.CRYPTO_ALGORITHM_UNSUPPORTED).toBe('ERR_CRYPTO_004');
    expect(SecurityErrorCode.CRYPTO_DECRYPTION_FAILED).toBe('ERR_CRYPTO_005');
  });

  it('should have storage error codes', () => {
    expect(SecurityErrorCode.STORAGE_FAILED).toBe('ERR_STORAGE_001');
    expect(SecurityErrorCode.STORAGE_NOT_FOUND).toBe('ERR_STORAGE_002');
    expect(SecurityErrorCode.STORAGE_QUOTA_EXCEEDED).toBe('ERR_STORAGE_003');
  });

  it('should have network error codes', () => {
    expect(SecurityErrorCode.NETWORK_FAILED).toBe('ERR_NETWORK_001');
    expect(SecurityErrorCode.NETWORK_TIMEOUT).toBe('ERR_NETWORK_002');
    expect(SecurityErrorCode.NETWORK_OFFLINE).toBe('ERR_NETWORK_003');
  });

  it('should have validation error codes', () => {
    expect(SecurityErrorCode.VALIDATION_FAILED).toBe('ERR_VALIDATION_001');
    expect(SecurityErrorCode.VALIDATION_REQUIRED).toBe('ERR_VALIDATION_002');
    expect(SecurityErrorCode.VALIDATION_FORMAT).toBe('ERR_VALIDATION_003');
  });

  it('should have general error codes', () => {
    expect(SecurityErrorCode.UNKNOWN).toBe('ERR_GENERAL_001');
    expect(SecurityErrorCode.INTERNAL).toBe('ERR_GENERAL_002');
  });
});

describe('sanitizeError', () => {
  describe('authentication errors', () => {
    it('should sanitize auth errors with user-friendly messages', () => {
      const error = new Error('Login failed: passphrase hash mismatch at byte 15');
      const result = sanitizeError(error, 'auth.login');

      expect(result.errorCode).toBe(SecurityErrorCode.AUTH_FAILED);
      expect(result.userMessage).toContain("couldn't sign you in");
      expect(result.userMessage).not.toContain('hash');
      expect(result.userMessage).not.toContain('byte');
    });

    it('should detect rate limiting errors', () => {
      const error = new Error('Rate limit exceeded: 5 attempts in 60 seconds');
      const result = sanitizeError(error, 'auth');

      expect(result.errorCode).toBe(SecurityErrorCode.AUTH_RATE_LIMITED);
      expect(result.userMessage).toContain('wait a moment');
    });

    it('should detect locked account errors', () => {
      const error = new Error('Account locked after too many failed attempts');
      const result = sanitizeError(error, 'auth');

      expect(result.errorCode).toBe(SecurityErrorCode.AUTH_LOCKED);
      expect(result.userMessage).toContain('temporarily locked');
    });

    it('should detect session expired errors', () => {
      const error = new Error('Session token expired at 2024-01-15T10:30:00Z');
      const result = sanitizeError(error, 'auth');

      expect(result.errorCode).toBe(SecurityErrorCode.AUTH_SESSION_EXPIRED);
      expect(result.userMessage).toContain('session has ended');
    });
  });

  describe('crypto errors', () => {
    it('should sanitize decryption errors', () => {
      const error = new Error('Decryption failed: invalid authentication tag');
      const result = sanitizeError(error, 'crypto');

      expect(result.errorCode).toBe(SecurityErrorCode.CRYPTO_DECRYPTION_FAILED);
      expect(result.userMessage).toContain("couldn't read your data");
      expect(result.userMessage).not.toContain('authentication tag');
    });

    it('should detect key mismatch errors', () => {
      const error = new Error('Key ID mismatch - wrong key for this encrypted data');
      const result = sanitizeError(error, 'crypto');

      expect(result.errorCode).toBe(SecurityErrorCode.CRYPTO_KEY_MISMATCH);
      expect(result.userMessage).toContain("couldn't access your data");
    });

    it('should detect key expiration errors', () => {
      const error = new Error('Encryption key has expired');
      const result = sanitizeError(error, 'crypto');

      expect(result.errorCode).toBe(SecurityErrorCode.CRYPTO_KEY_EXPIRED);
      expect(result.userMessage).toContain('expired');
    });

    it('should detect unsupported algorithm errors', () => {
      const error = new Error('Unsupported algorithm: AES-128-CBC');
      const result = sanitizeError(error, 'crypto');

      expect(result.errorCode).toBe(SecurityErrorCode.CRYPTO_ALGORITHM_UNSUPPORTED);
      expect(result.userMessage).toContain('older format');
    });
  });

  describe('storage errors', () => {
    it('should sanitize storage errors', () => {
      const error = new Error('Failed to write to IndexedDB: QuotaExceededError');
      const result = sanitizeError(error, 'storage');

      expect(result.errorCode).toBe(SecurityErrorCode.STORAGE_QUOTA_EXCEEDED);
      expect(result.userMessage).toContain('storage is full');
    });

    it('should detect not found errors', () => {
      const error = new Error('Record not found in table users');
      const result = sanitizeError(error, 'storage');

      expect(result.errorCode).toBe(SecurityErrorCode.STORAGE_NOT_FOUND);
      expect(result.userMessage).toContain("couldn't find");
    });
  });

  describe('network errors', () => {
    it('should sanitize network errors', () => {
      const error = new Error('Network request failed: ERR_CONNECTION_REFUSED');
      const result = sanitizeError(error, 'network');

      expect(result.errorCode).toBe(SecurityErrorCode.NETWORK_FAILED);
      expect(result.userMessage).toContain('trouble connecting');
      expect(result.userMessage).not.toContain('ERR_CONNECTION_REFUSED');
    });

    it('should detect timeout errors', () => {
      const error = new Error('Request timeout after 30000ms');
      const result = sanitizeError(error, 'network');

      expect(result.errorCode).toBe(SecurityErrorCode.NETWORK_TIMEOUT);
      expect(result.userMessage).toContain('took too long');
    });

    it('should detect offline errors', () => {
      const error = new Error('Browser is offline');
      const result = sanitizeError(error, 'network');

      expect(result.errorCode).toBe(SecurityErrorCode.NETWORK_OFFLINE);
      expect(result.userMessage).toContain('offline');
    });
  });

  describe('validation errors', () => {
    it('should sanitize validation errors', () => {
      const error = new Error('Validation failed: field "email" must be a valid email address');
      const result = sanitizeError(error, 'validation');

      expect(result.errorCode).toBe(SecurityErrorCode.VALIDATION_FAILED);
      expect(result.userMessage).toContain("doesn't look quite right");
    });

    it('should detect required field errors', () => {
      const error = new Error('Required field missing: companyId');
      const result = sanitizeError(error, 'validation');

      expect(result.errorCode).toBe(SecurityErrorCode.VALIDATION_REQUIRED);
      expect(result.userMessage).toContain('need this information');
    });

    it('should detect format errors', () => {
      const error = new Error('Invalid format for date field');
      const result = sanitizeError(error, 'validation');

      expect(result.errorCode).toBe(SecurityErrorCode.VALIDATION_FORMAT);
      expect(result.userMessage).toContain('check the format');
    });
  });

  describe('log details', () => {
    it('should include error details in logDetails', () => {
      const error = new Error('Internal error at /app/src/crypto/encryption.ts:45');
      error.stack = 'Error: Internal error\n    at encrypt (/app/src/crypto/encryption.ts:45:10)';
      const result = sanitizeError(error, 'crypto');

      expect(result.logDetails).toContain('Error:');
      expect(result.logDetails).toContain('Code: ERR_CRYPTO_001');
      expect(result.logDetails).toContain('Context: crypto');
    });

    it('should redact file paths in logDetails', () => {
      const error = new Error('Error at /home/user/app/secrets/key.pem');
      const result = sanitizeError(error, 'crypto');

      expect(result.logDetails).not.toContain('/home/user/app/secrets/key.pem');
      expect(result.logDetails).toContain('[path]');
    });

    it('should redact Windows file paths', () => {
      const error = new Error('Error at C:\\Users\\Admin\\secrets\\key.pem');
      const result = sanitizeError(error, 'storage');

      expect(result.logDetails).not.toContain('C:\\Users\\Admin\\secrets\\key.pem');
      expect(result.logDetails).toContain('[path]');
    });

    it('should redact key values', () => {
      const error = new Error('Invalid key: abc123def456');
      const result = sanitizeError(error, 'crypto');

      expect(result.logDetails).not.toContain('abc123def456');
      expect(result.logDetails).toContain('[redacted]');
    });
  });

  describe('user message quality', () => {
    it('should use Steadiness communication style', () => {
      const error = new Error('Decryption failed');
      const result = sanitizeError(error, 'crypto');

      // Should be supportive and non-blaming
      expect(result.userMessage).not.toContain('invalid');
      expect(result.userMessage).not.toContain('error');
      expect(result.userMessage).not.toContain('failed');

      // Should provide clear guidance
      expect(result.userMessage.length).toBeGreaterThan(20);
    });

    it('should not expose technical details in user message', () => {
      const technicalError = new Error(
        'AES-GCM decryption failed: authentication tag mismatch at position 128'
      );
      const result = sanitizeError(technicalError, 'crypto');

      expect(result.userMessage).not.toContain('AES');
      expect(result.userMessage).not.toContain('GCM');
      expect(result.userMessage).not.toContain('authentication tag');
      expect(result.userMessage).not.toContain('position');
      expect(result.userMessage).not.toContain('128');
    });
  });
});

describe('logSecurityError', () => {
  it('should not throw when logging errors', () => {
    const error = new Error('Test error');

    expect(() => {
      logSecurityError(error, 'test');
    }).not.toThrow();
  });

  it('should handle errors without stack traces', () => {
    const error = new Error('Test error');
    delete error.stack;

    expect(() => {
      logSecurityError(error, 'test');
    }).not.toThrow();
  });
});

describe('isDevMode', () => {
  it('should return a boolean', () => {
    const result = isDevMode();
    expect(typeof result).toBe('boolean');
  });
});

describe('createErrorResponse', () => {
  it('should create a standardized error response', () => {
    const error = new Error('Authentication failed');
    const response = createErrorResponse(error, 'auth');

    expect(response.success).toBe(false);
    expect(response.error).toBeTruthy();
    expect(response.errorCode).toBeTruthy();
    expect(typeof response.error).toBe('string');
  });

  it('should use user-friendly message', () => {
    const error = new Error('Decryption failed: invalid tag');
    const response = createErrorResponse(error, 'crypto');

    expect(response.error).not.toContain('invalid tag');
    expect(response.error.length).toBeGreaterThan(10);
  });
});

describe('withErrorSanitization', () => {
  it('should wrap successful async functions', async () => {
    const successFn = async (x: number) => x * 2;
    const wrapped = withErrorSanitization(successFn, 'test');

    const result = await wrapped(5);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(10);
    }
  });

  it('should sanitize errors from wrapped functions', async () => {
    const failingFn = async () => {
      throw new Error('Decryption failed: internal error at line 42');
    };
    const wrapped = withErrorSanitization(failingFn, 'crypto');

    const result = await wrapped();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).not.toContain('line 42');
      expect(result.errorCode).toBeTruthy();
    }
  });

  it('should preserve function arguments', async () => {
    const addFn = async (a: number, b: number) => a + b;
    const wrapped = withErrorSanitization(addFn, 'test');

    const result = await wrapped(3, 4);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(7);
    }
  });
});

describe('getUserMessage', () => {
  it('should return message for known error codes', () => {
    const message = getUserMessage(SecurityErrorCode.AUTH_FAILED);

    expect(message).toBeTruthy();
    expect(message.length).toBeGreaterThan(10);
  });

  it('should return unknown error message for invalid codes', () => {
    // Force an invalid code to test fallback
    const message = getUserMessage('INVALID_CODE' as SecurityErrorCode);

    expect(message).toBeTruthy();
    expect(message).toContain('unexpected');
  });

  it('should have unique messages for each error code', () => {
    const messages = new Set<string>();

    Object.values(SecurityErrorCode).forEach((code) => {
      const message = getUserMessage(code);
      messages.add(message);
    });

    // Each error code should have a unique message
    expect(messages.size).toBe(Object.values(SecurityErrorCode).length);
  });
});

describe('error mapping scenarios', () => {
  it('should map generic crypto errors correctly', () => {
    const error = new Error('crypto operation failed');
    const result = sanitizeError(error);

    // Without context, should still detect crypto-related errors
    expect(result.errorCode).toBe(SecurityErrorCode.CRYPTO_FAILED);
  });

  it('should map generic network errors correctly', () => {
    const error = new Error('fetch request failed');
    const result = sanitizeError(error);

    expect(result.errorCode).toBe(SecurityErrorCode.NETWORK_FAILED);
  });

  it('should map TypeError to network error', () => {
    const error = new TypeError('Failed to fetch');
    const result = sanitizeError(error);

    expect(result.errorCode).toBe(SecurityErrorCode.NETWORK_FAILED);
  });

  it('should default to unknown for unrecognized errors', () => {
    const error = new Error('Something completely unexpected');
    const result = sanitizeError(error);

    expect(result.errorCode).toBe(SecurityErrorCode.UNKNOWN);
    expect(result.userMessage).toContain('unexpected');
  });
});

describe('sensitive information redaction', () => {
  it('should redact token values', () => {
    const error = new Error('Invalid token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0');
    const result = sanitizeError(error, 'auth');

    expect(result.logDetails).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(result.logDetails).toContain('[redacted]');
  });

  it('should redact IV values', () => {
    const error = new Error('Invalid iv: AAAAAAAAAAAAAAAA');
    const result = sanitizeError(error, 'crypto');

    expect(result.logDetails).not.toContain('AAAAAAAAAAAAAAAA');
    expect(result.logDetails).toContain('[redacted]');
  });

  it('should redact salt values', () => {
    const error = new Error('Invalid salt: randomsaltvalue123');
    const result = sanitizeError(error, 'crypto');

    expect(result.logDetails).not.toContain('randomsaltvalue123');
    expect(result.logDetails).toContain('[redacted]');
  });

  it('should redact memory addresses', () => {
    const error = new Error('Segfault at 0x7fff5fbff8c8');
    const result = sanitizeError(error, 'internal');

    expect(result.logDetails).not.toContain('0x7fff5fbff8c8');
    expect(result.logDetails).toContain('[addr]');
  });

  it('should redact table names', () => {
    const error = new Error('Constraint violation in table user_credentials');
    const result = sanitizeError(error, 'database');

    expect(result.logDetails).not.toContain('user_credentials');
    expect(result.logDetails).toContain('[table]');
  });

  it('should redact column names', () => {
    const error = new Error('Invalid value in column password_hash');
    const result = sanitizeError(error, 'database');

    expect(result.logDetails).not.toContain('password_hash');
    expect(result.logDetails).toContain('[column]');
  });
});
