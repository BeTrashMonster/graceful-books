/**
 * Key Derivation Module
 *
 * Implements Argon2id-based key derivation from passphrases per ARCH-002.
 * Uses argon2-browser for client-side key derivation with appropriate
 * parameters for security and performance.
 *
 * Key Derivation Function Parameters (per spec):
 * - Algorithm: Argon2id
 * - Memory: 64 MB minimum
 * - Iterations: 3 minimum (adjusted based on device performance)
 * - Parallelism: 4 threads
 * - Output: 256-bit key
 */

import type {
  KeyDerivationParams,
  MasterKey,
  CryptoResult,
} from './types';

/**
 * Default Argon2id parameters per ARCH-002 specification
 */
const DEFAULT_ARGON2_PARAMS = {
  memoryCost: 65536, // 64 MB in KB
  timeCost: 3, // 3 iterations minimum
  parallelism: 4, // 4 threads
  keyLength: 32, // 256 bits = 32 bytes
  hashLength: 32, // Output hash length
  type: 2, // Argon2id
};

/**
 * Minimum security parameters
 */
const MIN_PARAMS = {
  memoryCost: 65536, // 64 MB minimum
  timeCost: 3, // 3 iterations minimum
  parallelism: 1, // At least 1 thread
  keyLength: 32, // Must be 256 bits
};

/**
 * Generate a cryptographically secure random salt
 *
 * @param length - Length of salt in bytes (default 16 = 128 bits)
 * @returns Random salt as Uint8Array
 *
 * @example
 * ```typescript
 * const salt = generateSalt();
 * // Uint8Array(16) [...]
 * ```
 */
export function generateSalt(length: number = 16): Uint8Array {
  const salt = new Uint8Array(length);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Derive a master key from a passphrase using Argon2id
 *
 * Per ARCH-002: Master key is derived using Argon2id with appropriate
 * salt and iteration parameters. The key derivation uses:
 * - Memory: 64 MB minimum
 * - Iterations: 3 minimum
 * - Parallelism: 4 threads
 * - Output: 256-bit key
 *
 * @param passphrase - User's passphrase (must meet strength requirements)
 * @param salt - Optional salt (generated if not provided)
 * @param params - Optional custom derivation parameters
 * @returns Promise resolving to master key or error
 *
 * @example
 * ```typescript
 * const result = await deriveMasterKey('my-strong-passphrase-here');
 * if (result.success && result.data) {
 *   const masterKey = result.data;
 *   console.log('Master key ID:', masterKey.id);
 * }
 * ```
 */
export async function deriveMasterKey(
  passphrase: string,
  salt?: Uint8Array,
  params?: Partial<KeyDerivationParams>
): Promise<CryptoResult<MasterKey>> {
  try {
    // Validate passphrase
    if (!passphrase || passphrase.length === 0) {
      return {
        success: false,
        error: 'Passphrase cannot be empty',
        errorCode: 'WEAK_PASSPHRASE',
      };
    }

    // Generate salt if not provided
    const derivationSalt = salt || generateSalt(16);

    // Build derivation parameters with defaults
    const derivationParams: KeyDerivationParams = {
      memoryCost: params?.memoryCost || DEFAULT_ARGON2_PARAMS.memoryCost,
      timeCost: params?.timeCost || DEFAULT_ARGON2_PARAMS.timeCost,
      parallelism: params?.parallelism || DEFAULT_ARGON2_PARAMS.parallelism,
      salt: derivationSalt,
      keyLength: params?.keyLength || DEFAULT_ARGON2_PARAMS.keyLength,
    };

    // Validate parameters meet minimum security requirements
    if (derivationParams.memoryCost < MIN_PARAMS.memoryCost) {
      return {
        success: false,
        error: `Memory cost must be at least ${MIN_PARAMS.memoryCost} KB`,
        errorCode: 'INVALID_KEY',
      };
    }

    if (derivationParams.timeCost < MIN_PARAMS.timeCost) {
      return {
        success: false,
        error: `Time cost must be at least ${MIN_PARAMS.timeCost} iterations`,
        errorCode: 'INVALID_KEY',
      };
    }

    if (derivationParams.keyLength !== MIN_PARAMS.keyLength) {
      return {
        success: false,
        error: `Key length must be exactly ${MIN_PARAMS.keyLength} bytes (256 bits)`,
        errorCode: 'INVALID_KEY',
      };
    }

    // Perform key derivation using argon2-browser
    const keyMaterial = await deriveKeyWithArgon2(passphrase, derivationParams);

    // Generate unique key ID
    const keyId = await generateKeyId(keyMaterial);

    // Create master key object
    const masterKey: MasterKey = {
      id: keyId,
      keyMaterial,
      derivationParams,
      createdAt: Date.now(),
    };

    return {
      success: true,
      data: masterKey,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during key derivation',
      errorCode: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Derive key using Argon2id algorithm
 *
 * Uses argon2-browser library for client-side key derivation.
 * Falls back to Web Crypto API PBKDF2 if Argon2 is unavailable.
 *
 * @param passphrase - User's passphrase
 * @param params - Derivation parameters
 * @returns Promise resolving to derived key material
 */
async function deriveKeyWithArgon2(
  passphrase: string,
  params: KeyDerivationParams
): Promise<Uint8Array> {
  // Try to use argon2-browser if available
  if (typeof window !== 'undefined' && (window as any).argon2) {
    const argon2 = (window as any).argon2;

    const result = await argon2.hash({
      pass: passphrase,
      salt: params.salt,
      time: params.timeCost,
      mem: params.memoryCost,
      parallelism: params.parallelism,
      hashLen: params.keyLength,
      type: argon2.ArgonType.Argon2id,
    });

    return result.hash;
  }

  // Fallback to Web Crypto API PBKDF2
  // Note: This is less secure than Argon2id but provides compatibility
  console.warn('Argon2 not available, falling back to PBKDF2 (less secure)');
  return deriveKeyWithPBKDF2(passphrase, params);
}

/**
 * Fallback key derivation using PBKDF2
 *
 * Used when Argon2 is not available. Less resistant to GPU/ASIC attacks
 * than Argon2id, but still provides reasonable security.
 *
 * @param passphrase - User's passphrase
 * @param params - Derivation parameters
 * @returns Promise resolving to derived key material
 */
async function deriveKeyWithPBKDF2(
  passphrase: string,
  params: KeyDerivationParams
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const passphraseBuffer = encoder.encode(passphrase);

  // Import passphrase as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passphraseBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // Derive key using PBKDF2
  // Increase iterations to compensate for PBKDF2 being weaker than Argon2
  const iterations = params.timeCost * 100000; // Scale up iterations

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: params.salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    params.keyLength * 8 // bits
  );

  return new Uint8Array(derivedBits);
}

/**
 * Generate a unique identifier for a key
 *
 * Creates a SHA-256 hash of the key material and returns it as a
 * hexadecimal string. This provides a collision-resistant identifier
 * without exposing the key material itself.
 *
 * @param keyMaterial - The key material to generate ID from
 * @returns Promise resolving to hex-encoded key ID
 */
async function generateKeyId(keyMaterial: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyMaterial as BufferSource);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Re-derive a master key from passphrase and known parameters
 *
 * Used to restore a master key from a passphrase when the user logs in.
 * The salt and derivation parameters must be stored separately (not secret).
 *
 * @param passphrase - User's passphrase
 * @param derivationParams - Previously used derivation parameters
 * @returns Promise resolving to master key or error
 *
 * @example
 * ```typescript
 * // User logging in
 * const storedParams = await getStoredDerivationParams(userId);
 * const result = await rederiveMasterKey(passphrase, storedParams);
 * if (result.success && result.data) {
 *   // Authenticate user
 * }
 * ```
 */
export async function rederiveMasterKey(
  passphrase: string,
  derivationParams: KeyDerivationParams
): Promise<CryptoResult<MasterKey>> {
  return deriveMasterKey(passphrase, derivationParams.salt, derivationParams);
}

/**
 * Verify a passphrase against a known master key
 *
 * Re-derives the master key from the passphrase and compares the key IDs.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param passphrase - Passphrase to verify
 * @param knownMasterKey - The known master key to verify against
 * @returns Promise resolving to true if passphrase matches
 *
 * @example
 * ```typescript
 * const isValid = await verifyPassphrase(userInput, storedMasterKey);
 * if (isValid) {
 *   // Grant access
 * }
 * ```
 */
export async function verifyPassphrase(
  passphrase: string,
  knownMasterKey: MasterKey
): Promise<boolean> {
  try {
    const result = await rederiveMasterKey(passphrase, knownMasterKey.derivationParams);

    if (!result.success || !result.data) {
      return false;
    }

    // Constant-time comparison of key IDs
    return constantTimeEqual(result.data.id, knownMasterKey.id);
  } catch {
    return false;
  }
}

/**
 * Constant-time string comparison
 *
 * Prevents timing attacks by ensuring comparison takes the same time
 * regardless of where strings differ.
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Adjust derivation parameters based on device performance
 *
 * Performs a benchmark to determine optimal parameters for the current
 * device while maintaining minimum security requirements.
 *
 * @param targetTime - Target derivation time in milliseconds (default 500ms)
 * @returns Promise resolving to optimized parameters
 *
 * @example
 * ```typescript
 * const optimizedParams = await benchmarkAndAdjustParams(500);
 * const result = await deriveMasterKey(passphrase, undefined, optimizedParams);
 * ```
 */
export async function benchmarkAndAdjustParams(
  targetTime: number = 500
): Promise<Partial<KeyDerivationParams>> {
  const testPassphrase = 'benchmark-test-passphrase';
  const testSalt = generateSalt();

  // Start with minimum parameters
  let params: Partial<KeyDerivationParams> = {
    memoryCost: MIN_PARAMS.memoryCost,
    timeCost: MIN_PARAMS.timeCost,
    parallelism: DEFAULT_ARGON2_PARAMS.parallelism,
  };

  try {
    const startTime = performance.now();
    await deriveMasterKey(testPassphrase, testSalt, params);
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Adjust time cost if we're under target
    if (duration < targetTime && params.timeCost) {
      const scaleFactor = Math.floor(targetTime / duration);
      params.timeCost = Math.max(MIN_PARAMS.timeCost, params.timeCost * scaleFactor);
    }

    return params;
  } catch {
    // If benchmark fails, return minimum safe parameters
    return params;
  }
}

/**
 * Clear sensitive data from memory
 *
 * Overwrites key material with zeros to prevent memory dumps from
 * exposing sensitive data. Per ARCH-001: Memory cleared after
 * cryptographic operations.
 *
 * @param data - Sensitive data to clear
 *
 * @example
 * ```typescript
 * const key = new Uint8Array([1, 2, 3, 4]);
 * clearSensitiveData(key);
 * // key is now Uint8Array([0, 0, 0, 0])
 * ```
 */
export function clearSensitiveData(data: Uint8Array): void {
  if (data && data.length > 0) {
    data.fill(0);
  }
}

/**
 * Clear a master key from memory
 *
 * Securely clears all sensitive data from a master key object.
 *
 * @param masterKey - Master key to clear
 *
 * @example
 * ```typescript
 * // On logout
 * clearMasterKey(currentMasterKey);
 * ```
 */
export function clearMasterKey(masterKey: MasterKey): void {
  clearSensitiveData(masterKey.keyMaterial);
  clearSensitiveData(masterKey.derivationParams.salt);
}
