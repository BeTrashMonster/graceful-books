/**
 * Encryption Module
 *
 * Implements AES-256-GCM encryption/decryption per ARCH-001.
 * Provides authenticated encryption with zero-knowledge architecture.
 *
 * Encryption Algorithm (per spec):
 * - Algorithm: AES-256-GCM (Galois/Counter Mode)
 * - Key Size: 256 bits
 * - IV/Nonce: 96 bits, randomly generated per encryption operation
 * - Authentication Tag: 128 bits
 *
 * Uses:
 * - @noble/ciphers for encryption (primary)
 * - Web Crypto API as fallback
 *
 * Security Fix M-4: Rate limiting on batch encryption operations
 * - Prevents client-side DoS through repeated expensive operations
 * - Batch encryption: 10 operations per minute
 * - Re-encryption: 5 operations per minute
 */

import type {
  EncryptedData,
  SerializedEncryptedData,
  MasterKey,
  DerivedKey,
  CryptoResult,
} from './types';

import {
  rateLimiter,
  CRYPTO_RATE_LIMITS,
  type RateLimitResult,
} from '../utils/rateLimiter';

import {
  sanitizeError,
  logSecurityError,
  isDevMode,
} from '../utils/errorSanitizer';

/**
 * AES-256-GCM algorithm identifier
 */
const ALGORITHM = 'AES-256-GCM';

/**
 * Standard IV/nonce length for GCM mode (96 bits = 12 bytes)
 */
const IV_LENGTH = 12;

/**
 * Authentication tag length for GCM mode (128 bits = 16 bytes)
 */
const AUTH_TAG_LENGTH = 16;

/**
 * Generate a cryptographically secure random IV/nonce
 *
 * Per ARCH-001: IV/nonce is 96 bits, randomly generated per encryption operation.
 *
 * @returns Random IV as Uint8Array
 */
function generateIV(): Uint8Array {
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);
  return iv;
}

/**
 * Encrypt data using AES-256-GCM
 *
 * Per ARCH-001: All data encrypted before storage using AES-256-GCM.
 * Provides both confidentiality and authentication.
 *
 * @param plaintext - Data to encrypt (string or Uint8Array)
 * @param key - Master or derived key to use for encryption
 * @returns Promise resolving to encrypted data or error
 *
 * @example
 * ```typescript
 * const result = await encrypt('sensitive data', masterKey);
 * if (result.success && result.data) {
 *   const encrypted = result.data;
 *   console.log('Encrypted at:', new Date(encrypted.encryptedAt));
 * }
 * ```
 */
export async function encrypt(
  plaintext: string | Uint8Array,
  key: MasterKey | DerivedKey
): Promise<CryptoResult<EncryptedData>> {
  try {
    // Convert plaintext to Uint8Array if needed
    const plaintextBytes = typeof plaintext === 'string'
      ? new TextEncoder().encode(plaintext)
      : plaintext;

    // Generate random IV for this operation
    const iv = generateIV();

    // Perform encryption using Web Crypto API
    const { ciphertext, authTag } = await encryptWithWebCrypto(
      plaintextBytes,
      key.keyMaterial,
      iv
    );

    // Create encrypted data envelope
    const encryptedData: EncryptedData = {
      ciphertext,
      iv,
      authTag,
      keyId: key.id,
      algorithm: ALGORITHM,
      encryptedAt: Date.now(),
    };

    return {
      success: true,
      data: encryptedData,
    };
  } catch (error) {
    // Log securely and sanitize for user display
    logSecurityError(error as Error, 'crypto.encrypt');
    const sanitized = sanitizeError(error as Error, 'crypto');

    return {
      success: false,
      error: sanitized.userMessage,
      errorCode: 'UNKNOWN_ERROR',
      // Include original error only in development
      ...(isDevMode() && { debugInfo: (error as Error).message }),
    };
  }
}

/**
 * Decrypt data using AES-256-GCM
 *
 * Per ARCH-001: Decrypts data encrypted with AES-256-GCM.
 * Verifies authentication tag to ensure data integrity.
 *
 * @param encryptedData - Encrypted data envelope
 * @param key - Master or derived key to use for decryption
 * @returns Promise resolving to plaintext or error
 *
 * @example
 * ```typescript
 * const result = await decrypt(encryptedData, masterKey);
 * if (result.success && result.data) {
 *   console.log('Decrypted:', result.data);
 * }
 * ```
 */
export async function decrypt(
  encryptedData: EncryptedData,
  key: MasterKey | DerivedKey
): Promise<CryptoResult<string>> {
  try {
    // Verify key ID matches
    if (encryptedData.keyId !== key.id) {
      return {
        success: false,
        error: 'Key ID mismatch - wrong key for this encrypted data',
        errorCode: 'INVALID_KEY',
      };
    }

    // Verify algorithm
    if (encryptedData.algorithm !== ALGORITHM) {
      return {
        success: false,
        error: `Unsupported algorithm: ${encryptedData.algorithm}`,
        errorCode: 'UNKNOWN_ERROR',
      };
    }

    // Check if key has expired
    if (key.expiresAt && Date.now() > key.expiresAt) {
      return {
        success: false,
        error: 'Encryption key has expired',
        errorCode: 'KEY_EXPIRED',
      };
    }

    // Perform decryption using Web Crypto API
    const plaintextBytes = await decryptWithWebCrypto(
      encryptedData.ciphertext,
      key.keyMaterial,
      encryptedData.iv,
      encryptedData.authTag
    );

    // Convert to string
    const plaintext = new TextDecoder().decode(plaintextBytes);

    return {
      success: true,
      data: plaintext,
    };
  } catch (error) {
    // Log securely and sanitize for user display
    logSecurityError(error as Error, 'crypto.decrypt');
    const sanitized = sanitizeError(error as Error, 'crypto');

    return {
      success: false,
      error: sanitized.userMessage,
      errorCode: 'UNKNOWN_ERROR',
      // Include original error only in development
      ...(isDevMode() && { debugInfo: (error as Error).message }),
    };
  }
}

/**
 * Decrypt to bytes instead of string
 *
 * Useful when the encrypted data is binary (e.g., images, files).
 *
 * @param encryptedData - Encrypted data envelope
 * @param key - Master or derived key to use for decryption
 * @returns Promise resolving to plaintext bytes or error
 */
export async function decryptToBytes(
  encryptedData: EncryptedData,
  key: MasterKey | DerivedKey
): Promise<CryptoResult<Uint8Array>> {
  try {
    // Verify key ID matches
    if (encryptedData.keyId !== key.id) {
      return {
        success: false,
        error: 'Key ID mismatch - wrong key for this encrypted data',
        errorCode: 'INVALID_KEY',
      };
    }

    // Perform decryption
    const plaintextBytes = await decryptWithWebCrypto(
      encryptedData.ciphertext,
      key.keyMaterial,
      encryptedData.iv,
      encryptedData.authTag
    );

    return {
      success: true,
      data: plaintextBytes,
    };
  } catch (error) {
    // Log securely and sanitize for user display
    logSecurityError(error as Error, 'crypto.decryptToBytes');
    const sanitized = sanitizeError(error as Error, 'crypto');

    return {
      success: false,
      error: sanitized.userMessage,
      errorCode: 'UNKNOWN_ERROR',
      // Include original error only in development
      ...(isDevMode() && { debugInfo: (error as Error).message }),
    };
  }
}

/**
 * Encrypt using Web Crypto API
 *
 * Performs AES-256-GCM encryption using the browser's native crypto library.
 *
 * @param plaintext - Data to encrypt
 * @param keyMaterial - 256-bit encryption key
 * @param iv - Initialization vector
 * @returns Promise resolving to ciphertext and auth tag
 */
async function encryptWithWebCrypto(
  plaintext: Uint8Array,
  keyMaterial: Uint8Array,
  iv: Uint8Array
): Promise<{ ciphertext: Uint8Array; authTag: Uint8Array }> {
  // Import key material
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Encrypt data
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: AUTH_TAG_LENGTH * 8, // 128 bits
    },
    cryptoKey,
    plaintext as BufferSource
  );

  // Web Crypto API returns ciphertext + auth tag concatenated
  const encrypted = new Uint8Array(encryptedBuffer);
  const ciphertext = encrypted.slice(0, encrypted.length - AUTH_TAG_LENGTH);
  const authTag = encrypted.slice(encrypted.length - AUTH_TAG_LENGTH);

  return { ciphertext, authTag };
}

/**
 * Decrypt using Web Crypto API
 *
 * Performs AES-256-GCM decryption using the browser's native crypto library.
 *
 * @param ciphertext - Encrypted data
 * @param keyMaterial - 256-bit encryption key
 * @param iv - Initialization vector
 * @param authTag - Authentication tag
 * @returns Promise resolving to plaintext
 */
async function decryptWithWebCrypto(
  ciphertext: Uint8Array,
  keyMaterial: Uint8Array,
  iv: Uint8Array,
  authTag: Uint8Array
): Promise<Uint8Array> {
  // Import key material
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Web Crypto API expects ciphertext + auth tag concatenated
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  // Decrypt data
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: AUTH_TAG_LENGTH * 8, // 128 bits
    },
    cryptoKey,
    combined as BufferSource
  );

  return new Uint8Array(decryptedBuffer);
}

/**
 * Serialize encrypted data for storage/transmission
 *
 * Converts binary EncryptedData to JSON-serializable format using base64.
 *
 * @param encryptedData - Encrypted data to serialize
 * @returns Serialized encrypted data
 *
 * @example
 * ```typescript
 * const encrypted = await encrypt('data', key);
 * if (encrypted.success && encrypted.data) {
 *   const serialized = serializeEncryptedData(encrypted.data);
 *   const json = JSON.stringify(serialized);
 *   // Send over network or save to database
 * }
 * ```
 */
export function serializeEncryptedData(
  encryptedData: EncryptedData
): SerializedEncryptedData {
  return {
    ciphertext: bytesToBase64(encryptedData.ciphertext),
    iv: bytesToBase64(encryptedData.iv),
    authTag: bytesToBase64(encryptedData.authTag),
    keyId: encryptedData.keyId,
    algorithm: encryptedData.algorithm,
    encryptedAt: encryptedData.encryptedAt,
  };
}

/**
 * Deserialize encrypted data from storage/transmission
 *
 * Converts JSON-serializable format back to binary EncryptedData.
 *
 * @param serialized - Serialized encrypted data
 * @returns Encrypted data
 *
 * @example
 * ```typescript
 * const json = await fetchFromDatabase();
 * const serialized = JSON.parse(json);
 * const encrypted = deserializeEncryptedData(serialized);
 * const result = await decrypt(encrypted, key);
 * ```
 */
export function deserializeEncryptedData(
  serialized: SerializedEncryptedData
): EncryptedData {
  return {
    ciphertext: base64ToBytes(serialized.ciphertext),
    iv: base64ToBytes(serialized.iv),
    authTag: base64ToBytes(serialized.authTag),
    keyId: serialized.keyId,
    algorithm: serialized.algorithm,
    encryptedAt: serialized.encryptedAt,
  };
}

/**
 * Convert bytes to base64 string
 *
 * @param bytes - Bytes to convert
 * @returns Base64-encoded string
 */
function bytesToBase64(bytes: Uint8Array): string {
  // Use browser's native btoa for base64 encoding
  const binaryString = Array.from(bytes)
    .map(byte => String.fromCharCode(byte))
    .join('');
  return btoa(binaryString);
}

/**
 * Convert base64 string to bytes
 *
 * @param base64 - Base64-encoded string
 * @returns Decoded bytes
 */
function base64ToBytes(base64: string): Uint8Array {
  // Use browser's native atob for base64 decoding
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypt a JavaScript object
 *
 * Convenience function for encrypting objects by JSON-serializing first.
 *
 * @param obj - Object to encrypt
 * @param key - Encryption key
 * @returns Promise resolving to encrypted data or error
 *
 * @example
 * ```typescript
 * const transaction = { amount: 1000, description: 'Payment' };
 * const result = await encryptObject(transaction, masterKey);
 * ```
 */
export async function encryptObject<T>(
  obj: T,
  key: MasterKey | DerivedKey
): Promise<CryptoResult<EncryptedData>> {
  try {
    const json = JSON.stringify(obj);
    return encrypt(json, key);
  } catch (error) {
    // Log securely and sanitize for user display
    logSecurityError(error as Error, 'crypto.encryptObject');
    const sanitized = sanitizeError(error as Error, 'crypto');

    return {
      success: false,
      error: sanitized.userMessage,
      errorCode: 'UNKNOWN_ERROR',
      ...(isDevMode() && { debugInfo: (error as Error).message }),
    };
  }
}

/**
 * Decrypt to a JavaScript object
 *
 * Convenience function for decrypting objects by JSON-parsing after decryption.
 *
 * @param encryptedData - Encrypted data
 * @param key - Decryption key
 * @returns Promise resolving to decrypted object or error
 *
 * @example
 * ```typescript
 * const result = await decryptObject<Transaction>(encrypted, masterKey);
 * if (result.success && result.data) {
 *   console.log('Amount:', result.data.amount);
 * }
 * ```
 */
export async function decryptObject<T>(
  encryptedData: EncryptedData,
  key: MasterKey | DerivedKey
): Promise<CryptoResult<T>> {
  try {
    const decryptResult = await decrypt(encryptedData, key);

    if (!decryptResult.success || !decryptResult.data) {
      return {
        success: false,
        error: decryptResult.error,
        errorCode: decryptResult.errorCode,
      };
    }

    const obj = JSON.parse(decryptResult.data);
    return {
      success: true,
      data: obj,
    };
  } catch (error) {
    // Log securely and sanitize for user display
    logSecurityError(error as Error, 'crypto.decryptObject');
    const sanitized = sanitizeError(error as Error, 'crypto');

    return {
      success: false,
      error: sanitized.userMessage,
      errorCode: 'UNKNOWN_ERROR',
      ...(isDevMode() && { debugInfo: (error as Error).message }),
    };
  }
}

/**
 * Re-encrypt data with a new key
 *
 * Used during key rotation. Decrypts with old key and encrypts with new key.
 *
 * Security Fix M-4: Rate limited to 5 operations per minute to prevent
 * client-side DoS during key rotation operations.
 *
 * @param encryptedData - Data encrypted with old key
 * @param oldKey - Old encryption key
 * @param newKey - New encryption key
 * @param options - Optional configuration including rate limiting bypass
 * @returns Promise resolving to re-encrypted data or error
 *
 * @example
 * ```typescript
 * // During key rotation
 * const result = await reencrypt(oldEncrypted, oldMasterKey, newMasterKey);
 * if (result.success && result.data) {
 *   await saveToDatabase(result.data);
 * }
 * ```
 */
export async function reencrypt(
  encryptedData: EncryptedData,
  oldKey: MasterKey | DerivedKey,
  newKey: MasterKey | DerivedKey,
  options?: { skipRateLimit?: boolean }
): Promise<CryptoResult<EncryptedData>> {
  try {
    // Check rate limit (unless explicitly skipped)
    if (!options?.skipRateLimit) {
      const rateLimitResult = await rateLimiter.check(
        'reencrypt',
        CRYPTO_RATE_LIMITS.reencrypt
      );

      if (!rateLimitResult.allowed) {
        const waitSeconds = Math.ceil((rateLimitResult.waitTimeMs || 0) / 1000);
        return {
          success: false,
          error: `Rate limit exceeded. Please wait ${waitSeconds} second${waitSeconds !== 1 ? 's' : ''} before trying again.`,
          errorCode: 'UNKNOWN_ERROR',
        };
      }
    }

    // Decrypt with old key
    const decryptResult = await decryptToBytes(encryptedData, oldKey);

    if (!decryptResult.success || !decryptResult.data) {
      return {
        success: false,
        error: decryptResult.error,
        errorCode: decryptResult.errorCode,
      };
    }

    // Encrypt with new key
    return encrypt(decryptResult.data, newKey);
  } catch (error) {
    // Log securely and sanitize for user display
    logSecurityError(error as Error, 'crypto.reencrypt');
    const sanitized = sanitizeError(error as Error, 'crypto');

    return {
      success: false,
      error: sanitized.userMessage,
      errorCode: 'UNKNOWN_ERROR',
      ...(isDevMode() && { debugInfo: (error as Error).message }),
    };
  }
}

/**
 * Batch encrypt multiple values
 *
 * Encrypts multiple values in parallel for better performance.
 *
 * Security Fix M-4: Rate limited to 10 operations per minute to prevent
 * client-side DoS through repeated batch encryption calls.
 *
 * @param values - Array of values to encrypt
 * @param key - Encryption key
 * @param options - Optional configuration including rate limiting bypass
 * @returns Promise resolving to array of encrypted data results
 *
 * @example
 * ```typescript
 * const transactions = ['tx1', 'tx2', 'tx3'];
 * const results = await batchEncrypt(transactions, masterKey);
 * const allSucceeded = results.every(r => r.success);
 * ```
 */
export async function batchEncrypt(
  values: (string | Uint8Array)[],
  key: MasterKey | DerivedKey,
  options?: { skipRateLimit?: boolean }
): Promise<CryptoResult<EncryptedData>[]> {
  // Check rate limit (unless explicitly skipped)
  if (!options?.skipRateLimit) {
    const rateLimitResult = await rateLimiter.check(
      'batchEncrypt',
      CRYPTO_RATE_LIMITS.batchEncrypt
    );

    if (!rateLimitResult.allowed) {
      const waitSeconds = Math.ceil((rateLimitResult.waitTimeMs || 0) / 1000);
      // Return an array of errors matching the input length
      return values.map(() => ({
        success: false,
        error: `Rate limit exceeded. Please wait ${waitSeconds} second${waitSeconds !== 1 ? 's' : ''} before trying again.`,
        errorCode: 'UNKNOWN_ERROR' as const,
      }));
    }
  }

  return Promise.all(values.map(value => encrypt(value, key)));
}

/**
 * Batch decrypt multiple values
 *
 * Decrypts multiple values in parallel for better performance.
 *
 * @param encryptedValues - Array of encrypted data
 * @param key - Decryption key
 * @returns Promise resolving to array of decrypted results
 *
 * @example
 * ```typescript
 * const results = await batchDecrypt(encryptedTransactions, masterKey);
 * const decrypted = results
 *   .filter(r => r.success && r.data)
 *   .map(r => r.data);
 * ```
 */
export async function batchDecrypt(
  encryptedValues: EncryptedData[],
  key: MasterKey | DerivedKey
): Promise<CryptoResult<string>[]> {
  return Promise.all(encryptedValues.map(value => decrypt(value, key)));
}

/**
 * Verify encrypted data integrity
 *
 * Attempts to decrypt data to verify it hasn't been tampered with.
 * Does not return the plaintext, only success/failure.
 *
 * @param encryptedData - Encrypted data to verify
 * @param key - Decryption key
 * @returns Promise resolving to true if data is valid
 *
 * @example
 * ```typescript
 * const isValid = await verifyIntegrity(encryptedData, masterKey);
 * if (!isValid) {
 *   console.error('Data has been tampered with!');
 * }
 * ```
 */
export async function verifyIntegrity(
  encryptedData: EncryptedData,
  key: MasterKey | DerivedKey
): Promise<boolean> {
  const result = await decrypt(encryptedData, key);
  return result.success;
}

/**
 * Get current rate limit status for batch encryption
 *
 * Useful for displaying quota information in the UI before
 * attempting a batch encryption operation.
 *
 * @returns Current quota status
 */
export function getBatchEncryptRateLimitStatus(): {
  remaining: number;
  maxOperations: number;
  resetsAt: number | null;
} {
  return rateLimiter.getQuotaStatus('batchEncrypt', CRYPTO_RATE_LIMITS.batchEncrypt);
}

/**
 * Get current rate limit status for re-encryption operations
 *
 * Useful for displaying quota information in the UI before
 * attempting a key rotation operation.
 *
 * @returns Current quota status
 */
export function getReencryptRateLimitStatus(): {
  remaining: number;
  maxOperations: number;
  resetsAt: number | null;
} {
  return rateLimiter.getQuotaStatus('reencrypt', CRYPTO_RATE_LIMITS.reencrypt);
}

// Re-export rate limit utilities for convenience
export { RateLimitError } from '../utils/rateLimiter';
export type { RateLimitResult };
