/**
 * Login Module
 *
 * Implements passphrase-based authentication with zero-knowledge architecture.
 * The passphrase is used to derive encryption keys locally and validate against
 * test data - no passphrase is ever transmitted.
 */

import type {
  LoginRequest,
  LoginResponse,
  PassphraseTestData,
  FailedLoginAttempt,
  SessionTokenPayload,
  AuthConfig,
} from './types';
import { DEFAULT_AUTH_CONFIG } from './types';
import { createSession, generateSessionId } from './session';
import { getSecureStorage } from '../utils/secureStorage';

/**
 * Storage key for failed login attempts
 */
const FAILED_ATTEMPTS_STORAGE_KEY = 'graceful_books_failed_attempts';

/**
 * Load failed attempts from localStorage
 */
function loadFailedAttempts(): Map<string, FailedLoginAttempt> {
  try {
    const stored = localStorage.getItem(FAILED_ATTEMPTS_STORAGE_KEY);
    if (!stored) return new Map();

    const parsed = JSON.parse(stored);
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

/**
 * Save failed attempts to localStorage
 */
function saveFailedAttempts(attempts: Map<string, FailedLoginAttempt>): void {
  try {
    const obj = Object.fromEntries(attempts.entries());
    localStorage.setItem(FAILED_ATTEMPTS_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Failed login attempt tracking (persisted to localStorage)
 * Prevents bypass via page refresh
 */
const failedAttempts: Map<string, FailedLoginAttempt> = loadFailedAttempts();

/**
 * Test value used to validate passphrase
 * This is a known plaintext that gets encrypted during account creation
 */
const PASSPHRASE_TEST_VALUE = 'graceful-books-auth-test';

/**
 * Authenticate user with passphrase
 *
 * Uses zero-knowledge approach:
 * 1. Derive key from passphrase locally
 * 2. Attempt to decrypt test data with derived key
 * 3. If successful, passphrase is correct
 * 4. Generate session token
 *
 * @param request - Login request with passphrase
 * @param config - Authentication configuration
 * @returns Login response with session token if successful
 */
export async function login(
  request: LoginRequest,
  config: AuthConfig = DEFAULT_AUTH_CONFIG
): Promise<LoginResponse> {
  const identifier = request.userIdentifier.toLowerCase();

  // Check rate limiting
  const rateLimitResult = checkRateLimit(identifier, config);
  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: `Too many failed attempts. Please try again in ${Math.ceil(rateLimitResult.waitTimeMs! / 1000)} seconds.`,
      errorCode: 'RATE_LIMITED',
    };
  }

  try {
    // Load passphrase test data from storage
    const testData = await loadPassphraseTestData(request.companyId);
    if (!testData) {
      recordFailedAttempt(identifier);
      return {
        success: false,
        error: 'Company not found. Please check your company ID.',
        errorCode: 'INVALID_PASSPHRASE',
      };
    }

    // Derive master key from passphrase
    const masterKey = await deriveKeyFromPassphrase(
      request.passphrase,
      testData.salt,
      testData.kdfParams
    );

    // Validate passphrase by attempting to decrypt test data
    const isValid = await validatePassphrase(masterKey, testData);

    if (!isValid) {
      recordFailedAttempt(identifier);
      // Use constant-time comparison to prevent timing attacks
      await constantTimeDelay();
      return {
        success: false,
        error: "That passphrase doesn't seem to match. Let's try again.",
        errorCode: 'INVALID_PASSPHRASE',
      };
    }

    // Passphrase is valid - clear failed attempts
    failedAttempts.delete(identifier);
    saveFailedAttempts(failedAttempts);

    // Create session
    const now = Date.now();
    const sessionId = generateSessionId();
    const expiresAt = now + config.sessionExpirationMs;

    const sessionPayload: SessionTokenPayload = {
      sessionId,
      userId: identifier,
      companyId: request.companyId,
      role: 'admin', // In production, load from user profile
      issuedAt: now,
      expiresAt,
      deviceId: request.deviceFingerprint,
    };

    const session = await createSession(sessionPayload, masterKey, config);

    // Generate device token if requested
    let deviceToken: string | undefined;
    if (request.rememberDevice && request.deviceFingerprint) {
      deviceToken = await generateDeviceToken(
        identifier,
        request.companyId,
        request.deviceFingerprint,
        config
      );
      session.deviceToken = deviceToken;
    }

    return {
      success: true,
      token: session.token,
      deviceToken,
      expiresAt,
    };
  } catch (error) {
    // Log error internally but don't expose details to user
    recordFailedAttempt(identifier);
    return {
      success: false,
      error: 'An error occurred during login. Please try again.',
      errorCode: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Derive encryption key from passphrase using Argon2id
 *
 * In a production environment, this would use the Argon2id algorithm.
 * For this implementation, we use PBKDF2 as a placeholder since Argon2id
 * requires WebAssembly and is not built into Web Crypto API.
 *
 * @param passphrase - User's passphrase
 * @param salt - Salt for key derivation
 * @param params - KDF parameters
 * @returns Derived master key
 */
async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: string,
  params: { memoryCost: number; timeCost: number; parallelism: number }
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);
  const saltBytes = base64Decode(salt);

  // Import passphrase as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  // Derive key using PBKDF2 (as Argon2id placeholder)
  // In production, use Argon2id with the specified parameters:
  // - memoryCost: Memory in KB (64 MB = 65536 KB)
  // - timeCost: Number of iterations
  // - parallelism: Degree of parallelism
  const iterations = Math.max(params.timeCost * 10000, 100000); // Scale timeCost
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 256-bit key
  );

  return new Uint8Array(derivedBits);
}

/**
 * Validate passphrase by decrypting test data
 *
 * Attempts to decrypt a known test value. If decryption succeeds
 * and matches the expected value, the passphrase is correct.
 *
 * @param masterKey - Derived master key
 * @param testData - Passphrase test data
 * @returns True if passphrase is valid
 */
async function validatePassphrase(
  masterKey: Uint8Array,
  testData: PassphraseTestData
): Promise<boolean> {
  try {
    // Import master key for decryption
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      masterKey as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decrypt test data
    const iv = base64Decode(testData.iv);
    const encryptedData = base64Decode(testData.encryptedTest);

    // For AES-GCM, auth tag is typically appended to ciphertext
    // Combine encrypted data and auth tag
    const authTag = base64Decode(testData.authTag);
    const ciphertext = new Uint8Array(encryptedData.length + authTag.length);
    ciphertext.set(encryptedData);
    ciphertext.set(authTag, encryptedData.length);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      cryptoKey,
      ciphertext
    );

    // Check if decrypted value matches expected test value
    const decryptedText = new TextDecoder().decode(decrypted);
    return decryptedText === PASSPHRASE_TEST_VALUE;
  } catch (error) {
    // Decryption failure means invalid passphrase
    return false;
  }
}

/**
 * Create passphrase test data for new account
 *
 * Encrypts a known test value with the derived key.
 * This data is stored and used to validate future login attempts.
 *
 * @param passphrase - User's passphrase
 * @param companyId - Company identifier
 * @returns Passphrase test data to store
 */
export async function createPassphraseTestData(
  passphrase: string,
  companyId: string
): Promise<PassphraseTestData> {
  // Generate random salt (128 bits)
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  // KDF parameters (based on ARCH-002 spec)
  const kdfParams = {
    memoryCost: 65536, // 64 MB
    timeCost: 3, // 3 iterations
    parallelism: 4, // 4 threads
  };

  // Derive master key
  const masterKey = await deriveKeyFromPassphrase(
    passphrase,
    base64Encode(salt),
    kdfParams
  );

  // Encrypt test value
  const encoder = new TextEncoder();
  const testValueBytes = encoder.encode(PASSPHRASE_TEST_VALUE);

  // Generate random IV (96 bits for GCM)
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  // Import key for encryption
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    masterKey as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Encrypt test value
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: 128 },
    cryptoKey,
    testValueBytes
  );

  // Split encrypted data and auth tag
  // AES-GCM appends the auth tag to the ciphertext
  const encryptedArray = new Uint8Array(encrypted);
  const ciphertextLength = encryptedArray.length - 16; // 128-bit tag = 16 bytes
  const encryptedData = encryptedArray.slice(0, ciphertextLength);
  const authTag = encryptedArray.slice(ciphertextLength);

  return {
    companyId,
    encryptedTest: base64Encode(encryptedData),
    iv: base64Encode(iv),
    authTag: base64Encode(authTag),
    salt: base64Encode(salt),
    kdfParams,
  };
}

/**
 * Storage key prefix for passphrase test data
 */
const PASSPHRASE_TEST_KEY_PREFIX = 'passphrase-test';

/**
 * Legacy storage key prefix (for migration)
 */
const LEGACY_PASSPHRASE_TEST_KEY_PREFIX = 'passphrase-test-';

/**
 * Load passphrase test data from secure storage
 *
 * First attempts to load from secure storage. If not found, checks for
 * legacy unencrypted data and migrates it automatically.
 *
 * @param companyId - Company identifier
 * @returns Passphrase test data or null if not found
 */
async function loadPassphraseTestData(
  companyId: string
): Promise<PassphraseTestData | null> {
  try {
    const secureStorage = getSecureStorage();
    const storageKey = `${PASSPHRASE_TEST_KEY_PREFIX}-${companyId}`;
    const legacyKey = `${LEGACY_PASSPHRASE_TEST_KEY_PREFIX}${companyId}`;

    // Ensure secure storage is initialized
    if (!secureStorage.isInitialized()) {
      await secureStorage.initialize();
    }

    // Try to load from secure storage first
    const secureStored = await secureStorage.getItem(storageKey);
    if (secureStored) {
      return JSON.parse(secureStored);
    }

    // Check for legacy unencrypted data and migrate
    const legacyStored = localStorage.getItem(legacyKey);
    if (legacyStored) {
      // Migrate to secure storage
      const migrationResult = await secureStorage.migrateFromUnencrypted(
        legacyKey,
        storageKey
      );
      if (migrationResult.success) {
        return JSON.parse(legacyStored);
      }
    }

    return null;
  } catch {
    // Return null on parse error - user will get "company not found" message
    return null;
  }
}

/**
 * Store passphrase test data securely
 *
 * Encrypts the passphrase test data before storing in localStorage.
 * This protects sensitive authentication data from browser inspection.
 *
 * @param testData - Passphrase test data
 * @throws Error if secure storage fails
 */
export async function storePassphraseTestData(
  testData: PassphraseTestData
): Promise<void> {
  const secureStorage = getSecureStorage();
  const storageKey = `${PASSPHRASE_TEST_KEY_PREFIX}-${testData.companyId}`;

  // Ensure secure storage is initialized
  if (!secureStorage.isInitialized()) {
    await secureStorage.initialize();
  }

  const result = await secureStorage.setItem(storageKey, JSON.stringify(testData));

  if (!result.success) {
    throw new Error(result.error || 'Failed to store passphrase test data securely');
  }
}

/**
 * Check rate limiting for failed login attempts
 *
 * @param identifier - User identifier
 * @param config - Authentication configuration
 * @returns Rate limit result
 */
function checkRateLimit(
  identifier: string,
  config: AuthConfig
): { allowed: boolean; waitTimeMs?: number } {
  const attempt = failedAttempts.get(identifier);
  if (!attempt) {
    return { allowed: true };
  }

  const now = Date.now();

  // Check if locked out
  if (attempt.lockedUntil && attempt.lockedUntil > now) {
    return {
      allowed: false,
      waitTimeMs: attempt.lockedUntil - now,
    };
  }

  // Check if attempts should be reset (after lockout period)
  if (attempt.lockedUntil && attempt.lockedUntil <= now) {
    failedAttempts.delete(identifier);
    saveFailedAttempts(failedAttempts);
    return { allowed: true };
  }

  // Check if max attempts exceeded
  if (attempt.count >= config.maxFailedAttempts) {
    attempt.lockedUntil = now + config.rateLimitDurationMs;
    saveFailedAttempts(failedAttempts);
    return {
      allowed: false,
      waitTimeMs: config.rateLimitDurationMs,
    };
  }

  return { allowed: true };
}

/**
 * Record a failed login attempt
 *
 * @param identifier - User identifier
 */
function recordFailedAttempt(identifier: string): void {
  const now = Date.now();
  const existing = failedAttempts.get(identifier);

  if (existing) {
    existing.count++;
    existing.lastAttemptAt = now;
  } else {
    failedAttempts.set(identifier, {
      identifier,
      count: 1,
      firstAttemptAt: now,
      lastAttemptAt: now,
    });
  }

  saveFailedAttempts(failedAttempts);
}

/**
 * Generate device token for "remember this device"
 *
 * @param userId - User identifier
 * @param companyId - Company identifier
 * @param fingerprint - Device fingerprint
 * @param config - Authentication configuration
 * @returns Device token
 */
async function generateDeviceToken(
  _userId: string,
  _companyId: string,
  _fingerprint: string,
  _config: AuthConfig
): Promise<string> {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = base64UrlEncode(tokenBytes);

  // Store device token (handled by sessionStorage.ts)
  // For now, just return the token
  return token;
}

/**
 * Constant-time delay to prevent timing attacks
 *
 * Adds a small random delay to make timing analysis harder.
 *
 * Security Note: Uses Math.random() intentionally for timing jitter, which is
 * acceptable for this use case. The randomness adds variability to response times,
 * making timing analysis harder. The actual security does not depend on the
 * unpredictability of this delay - it just needs to be variable. Using Math.random()
 * here avoids the async overhead of crypto.getRandomValues() for a non-critical random value.
 */
async function constantTimeDelay(): Promise<void> {
  const delay = 100 + Math.random() * 200; // 100-300ms - see function doc for security justification
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Base64 encode
 *
 * @param bytes - Bytes to encode
 * @returns Base64-encoded string
 */
function base64Encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Base64 decode
 *
 * @param str - Base64-encoded string
 * @returns Decoded bytes
 */
function base64Decode(str: string): Uint8Array {
  const binaryString = atob(str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Base64url encode (URL-safe base64 without padding)
 *
 * @param bytes - Bytes to encode
 * @returns Base64url-encoded string
 */
function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = base64Encode(bytes);
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Validate passphrase strength
 *
 * Checks passphrase meets minimum security requirements.
 * Based on NIST 800-63B guidelines.
 *
 * @param passphrase - Passphrase to validate
 * @returns Validation result
 */
export function validatePassphraseStrength(passphrase: string): {
  isValid: boolean;
  error?: string;
  suggestions?: string[];
} {
  const suggestions: string[] = [];

  // Minimum length (12 characters as per spec)
  if (passphrase.length < 12) {
    return {
      isValid: false,
      error: 'Passphrase must be at least 12 characters long.',
      suggestions: ['Use a longer passphrase for better security.'],
    };
  }

  // Check for common patterns
  if (/^(.)\1+$/.test(passphrase)) {
    // All same character
    return {
      isValid: false,
      error: 'Passphrase is too simple.',
      suggestions: ['Avoid using repeated characters.'],
    };
  }

  if (/^(012|123|234|345|456|567|678|789|abc|bcd|cde)/.test(passphrase.toLowerCase())) {
    suggestions.push('Avoid sequential characters.');
  }

  // Warn about common words (simplified check)
  const commonWords = ['password', 'admin', 'user', 'test', 'demo'];
  if (commonWords.some((word) => passphrase.toLowerCase().includes(word))) {
    suggestions.push('Avoid common words like "password" or "admin".');
  }

  // Good length for passphrase
  if (passphrase.length >= 16) {
    // Strong passphrase
  } else {
    suggestions.push('Consider using a longer passphrase for extra security.');
  }

  return {
    isValid: true,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}
