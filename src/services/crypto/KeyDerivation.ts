/**
 * Key Derivation Service for Backup & Sync Architecture
 *
 * Implements password-based key derivation (PBKDF) using Argon2id for secure
 * backup bundle encryption. This is specifically designed for the backup/restore
 * flow where users need to derive encryption keys from passwords.
 *
 * Key Derivation Parameters (per ROADMAP_BACKUP_AND_SYNC.md):
 * - Algorithm: Argon2id (hybrid mode - resistant to side-channel and GPU attacks)
 * - Memory: 65536 KB (64 MB)
 * - Iterations (time cost): 3
 * - Parallelism: 4 threads
 * - Salt length: 32 bytes (256 bits)
 * - Key length: 32 bytes (256 bits)
 *
 * Security Features:
 * - Memory-hard KDF (resistant to brute force attacks)
 * - Unique salt per backup (prevents rainbow table attacks)
 * - PBKDF2 fallback for older browsers and test environments
 * - Constant-time comparisons (prevents timing attacks)
 * - Performance target: <1 second on modern devices
 *
 * @module services/crypto/KeyDerivation
 */

/**
 * Key derivation configuration
 */
export interface KeyDerivationConfig {
  algorithm: 'argon2id' | 'pbkdf2';
  iterations: number;
  memory?: number; // Argon2 only (in KB)
  parallelism?: number; // Argon2 only
  saltLength: number; // in bytes
  keyLength: number; // in bytes
}

/**
 * Result of key derivation operation
 */
export interface DerivedKeyResult {
  key: Uint8Array;
  salt: Uint8Array;
  algorithm: 'argon2id' | 'pbkdf2';
  config: KeyDerivationConfig;
  derivationTimeMs: number;
}

/**
 * Default Argon2id configuration per specification
 */
const DEFAULT_ARGON2_CONFIG: KeyDerivationConfig = {
  algorithm: 'argon2id',
  iterations: 3, // time cost
  memory: 65536, // 64 MB in KB
  parallelism: 4,
  saltLength: 32, // 256 bits
  keyLength: 32, // 256 bits
};

/**
 * Default PBKDF2 configuration (fallback)
 * Uses 310,000 iterations per OWASP recommendation (2023)
 */
const DEFAULT_PBKDF2_CONFIG: KeyDerivationConfig = {
  algorithm: 'pbkdf2',
  iterations: 310000,
  saltLength: 32,
  keyLength: 32,
};

/**
 * Lazily load argon2-browser only when needed and in browser environment
 */
let argon2Promise: Promise<any> | null = null;

async function getArgon2(): Promise<any> {
  // Only load in browser environment
  if (typeof window === 'undefined') {
    return null;
  }

  if (!argon2Promise) {
    argon2Promise = import('argon2-browser')
      .then((module) => module.default || module)
      .catch(() => null);
  }

  return argon2Promise;
}

/**
 * Generate a cryptographically secure random salt
 *
 * Uses crypto.getRandomValues() which provides cryptographically strong
 * random values suitable for security-sensitive operations.
 *
 * @param length - Length of salt in bytes (default: 32 bytes = 256 bits)
 * @returns Cryptographically secure random salt
 *
 * @example
 * ```typescript
 * const salt = generateSalt(32);
 * console.log(salt.length); // 32
 * ```
 */
export function generateSalt(length: number = 32): Uint8Array {
  const salt = new Uint8Array(length);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Detect the best available key derivation algorithm
 *
 * Tests for Argon2id support and falls back to PBKDF2 if unavailable.
 * Argon2id is preferred as it's memory-hard and resistant to GPU attacks.
 *
 * In Node.js test environments, always returns 'pbkdf2' to avoid WASM issues.
 *
 * @returns 'argon2id' if supported and in browser, 'pbkdf2' otherwise
 *
 * @example
 * ```typescript
 * const algorithm = detectBestAlgorithm();
 * console.log(`Using ${algorithm} for key derivation`);
 * ```
 */
export function detectBestAlgorithm(): 'argon2id' | 'pbkdf2' {
  // In Node.js (test environment), always use PBKDF2
  if (typeof window === 'undefined') {
    return 'pbkdf2';
  }

  // In browser, prefer Argon2id if available (will be loaded on first use)
  return 'argon2id';
}

/**
 * Derive an encryption key from a password using Argon2id or PBKDF2
 *
 * This is the main entry point for password-based key derivation. It automatically
 * selects the best available algorithm and derives a cryptographically strong key.
 *
 * Security considerations:
 * - Never log the password or derived key
 * - Always generate a unique salt (never reuse salts)
 * - Use the same salt + password to re-derive the same key (for decryption)
 * - Target derivation time: <1 second on modern devices
 *
 * @param password - User's password (should be strong)
 * @param salt - Salt for key derivation (generated if not provided)
 * @param config - Optional custom configuration (uses defaults if not provided)
 * @returns Promise resolving to derived key result
 * @throws Error if password is empty or key derivation fails
 *
 * @example
 * ```typescript
 * // Derive a key for encryption
 * const result = await derivePasswordKey('my-secure-password');
 * console.log(`Key derived in ${result.derivationTimeMs}ms`);
 * console.log(`Algorithm: ${result.algorithm}`);
 *
 * // Later, re-derive the same key for decryption
 * const sameKey = await derivePasswordKey('my-secure-password', result.salt);
 * // sameKey.key will match result.key
 * ```
 */
export async function derivePasswordKey(
  password: string,
  salt?: Uint8Array,
  config?: Partial<KeyDerivationConfig>
): Promise<DerivedKeyResult> {
  const startTime = performance.now();

  // Validate password
  if (!password || password.length === 0) {
    throw new Error('Password cannot be empty');
  }

  // Detect best algorithm if not specified
  const algorithm = config?.algorithm || detectBestAlgorithm();

  // Select configuration based on algorithm
  const baseConfig = algorithm === 'argon2id'
    ? DEFAULT_ARGON2_CONFIG
    : DEFAULT_PBKDF2_CONFIG;

  const finalConfig: KeyDerivationConfig = {
    ...baseConfig,
    ...config,
    algorithm,
  };

  // Validate configuration parameters
  if (finalConfig.keyLength <= 0) {
    throw new Error('Key length must be greater than 0');
  }

  if (finalConfig.saltLength <= 0) {
    throw new Error('Salt length must be greater than 0');
  }

  if (finalConfig.iterations <= 0) {
    throw new Error('Iterations must be greater than 0');
  }

  // Generate salt if not provided
  const derivationSalt = salt || generateSalt(finalConfig.saltLength);

  // Validate salt length
  if (derivationSalt.length !== finalConfig.saltLength) {
    throw new Error(
      `Salt length mismatch: expected ${finalConfig.saltLength} bytes, got ${derivationSalt.length} bytes`
    );
  }

  // Derive key using selected algorithm
  let key: Uint8Array;
  let actualAlgorithm = algorithm;

  if (algorithm === 'argon2id') {
    try {
      key = await deriveWithArgon2id(password, derivationSalt, finalConfig);
    } catch (error) {
      // Fall back to PBKDF2 if Argon2id fails
      console.warn('Argon2id not available, using PBKDF2 fallback');
      key = await deriveWithPBKDF2(password, derivationSalt, {
        ...finalConfig,
        iterations: DEFAULT_PBKDF2_CONFIG.iterations,
      });
      actualAlgorithm = 'pbkdf2';
    }
  } else {
    key = await deriveWithPBKDF2(password, derivationSalt, finalConfig);
  }

  const endTime = performance.now();
  const derivationTimeMs = Math.round(endTime - startTime);

  return {
    key,
    salt: derivationSalt,
    algorithm: actualAlgorithm,
    config: { ...finalConfig, algorithm: actualAlgorithm },
    derivationTimeMs,
  };
}

/**
 * Derive key using Argon2id algorithm
 *
 * Argon2id is the winner of the Password Hashing Competition (2015) and
 * provides strong resistance against both side-channel and GPU attacks.
 *
 * @param password - User's password
 * @param salt - Cryptographic salt
 * @param config - Derivation configuration
 * @returns Promise resolving to derived key
 * @throws Error if Argon2 derivation fails or is not available
 */
async function deriveWithArgon2id(
  password: string,
  salt: Uint8Array,
  config: KeyDerivationConfig
): Promise<Uint8Array> {
  const argon2 = await getArgon2();

  if (!argon2 || typeof argon2.hash !== 'function') {
    throw new Error('Argon2id not available');
  }

  try {
    const result = await argon2.hash({
      pass: password,
      salt: salt,
      time: config.iterations, // time cost
      mem: config.memory || 65536, // memory cost in KB
      parallelism: config.parallelism || 4,
      hashLen: config.keyLength,
      type: argon2.ArgonType.Argon2id, // Hybrid mode
    });

    return result.hash;
  } catch (error) {
    throw new Error(
      `Argon2id key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Derive key using PBKDF2 algorithm (fallback)
 *
 * PBKDF2 is available in all modern browsers via Web Crypto API.
 * While less resistant to GPU attacks than Argon2id, it's still
 * secure with a high iteration count (310,000 iterations per OWASP).
 *
 * @param password - User's password
 * @param salt - Cryptographic salt
 * @param config - Derivation configuration
 * @returns Promise resolving to derived key
 * @throws Error if PBKDF2 derivation fails
 */
async function deriveWithPBKDF2(
  password: string,
  salt: Uint8Array,
  config: KeyDerivationConfig
): Promise<Uint8Array> {
  try {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    // Derive bits using PBKDF2
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: config.iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      config.keyLength * 8 // bits
    );

    return new Uint8Array(derivedBits);
  } catch (error) {
    throw new Error(
      `PBKDF2 key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Re-derive a key from password and known parameters
 *
 * Used during backup restoration when you have the original salt and
 * configuration. This will produce the same key as the original derivation
 * if the password is correct.
 *
 * @param password - User's password
 * @param salt - Original salt used for derivation
 * @param config - Original derivation configuration
 * @returns Promise resolving to derived key result
 *
 * @example
 * ```typescript
 * // Original key derivation
 * const original = await derivePasswordKey('my-password');
 *
 * // Save salt and config for later
 * const savedSalt = original.salt;
 * const savedConfig = original.config;
 *
 * // Later: re-derive the same key
 * const rederived = await rederiveKey('my-password', savedSalt, savedConfig);
 *
 * // Keys will match if password is correct
 * console.log(arraysEqual(original.key, rederived.key)); // true
 * ```
 */
export async function rederiveKey(
  password: string,
  salt: Uint8Array,
  config: KeyDerivationConfig
): Promise<DerivedKeyResult> {
  return derivePasswordKey(password, salt, config);
}

/**
 * Verify a password by comparing derived keys using constant-time comparison
 *
 * This prevents timing attacks by ensuring comparison time is independent
 * of the number of matching bytes.
 *
 * @param password - Password to verify
 * @param expectedKey - Expected derived key
 * @param salt - Salt used for derivation
 * @param config - Derivation configuration
 * @returns Promise resolving to true if password matches
 *
 * @example
 * ```typescript
 * // During backup creation
 * const original = await derivePasswordKey('correct-password');
 *
 * // Later: verify user's password
 * const isValid = await verifyPassword(
 *   'user-input',
 *   original.key,
 *   original.salt,
 *   original.config
 * );
 *
 * if (isValid) {
 *   console.log('Password is correct');
 * } else {
 *   console.log('Password is incorrect');
 * }
 * ```
 */
export async function verifyPassword(
  password: string,
  expectedKey: Uint8Array,
  salt: Uint8Array,
  config: KeyDerivationConfig
): Promise<boolean> {
  try {
    const result = await rederiveKey(password, salt, config);
    return constantTimeEqual(result.key, expectedKey);
  } catch {
    return false;
  }
}

/**
 * Constant-time comparison of two byte arrays
 *
 * Prevents timing attacks by ensuring comparison time is independent
 * of where the first difference occurs.
 *
 * @param a - First array
 * @param b - Second array
 * @returns true if arrays are equal, false otherwise
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

/**
 * Clear sensitive data from memory
 *
 * Overwrites the array with zeros to prevent memory dumps from
 * exposing sensitive cryptographic material.
 *
 * @param data - Sensitive data to clear
 *
 * @example
 * ```typescript
 * const key = await derivePasswordKey('password');
 *
 * // Use the key...
 *
 * // Clear from memory when done
 * clearSensitiveData(key.key);
 * clearSensitiveData(key.salt);
 * ```
 */
export function clearSensitiveData(data: Uint8Array): void {
  if (data && data.length > 0) {
    data.fill(0);
  }
}

/**
 * Get performance benchmark for current device
 *
 * Performs a test derivation to measure performance and help users
 * understand expected wait times.
 *
 * @param algorithm - Algorithm to benchmark (defaults to best available)
 * @returns Promise resolving to benchmark result
 *
 * @example
 * ```typescript
 * const benchmark = await benchmarkPerformance();
 * console.log(`Key derivation takes ~${benchmark.derivationTimeMs}ms on this device`);
 *
 * if (benchmark.derivationTimeMs > 2000) {
 *   console.warn('Key derivation is slow on this device');
 * }
 * ```
 */
export async function benchmarkPerformance(
  algorithm?: 'argon2id' | 'pbkdf2'
): Promise<DerivedKeyResult> {
  const testPassword = 'benchmark-test-password-12345';
  const testSalt = generateSalt(32);

  const config: Partial<KeyDerivationConfig> = {
    algorithm: algorithm || detectBestAlgorithm(),
  };

  return derivePasswordKey(testPassword, testSalt, config);
}

// Types are already exported at declaration, no need to re-export
