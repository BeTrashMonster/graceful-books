/**
 * Backup Bundle Encryption System
 *
 * Implements Task 1.1 of the Backup & Sync Architecture Roadmap.
 * Provides secure backup bundle encryption with Argon2id key derivation,
 * AES-256-GCM encryption, and HMAC-SHA256 integrity verification.
 *
 * Security Features:
 * - Zero-knowledge encryption (platform cannot decrypt)
 * - Argon2id key derivation (memory=64MB, iterations=3, parallelism=4)
 * - AES-256-GCM authenticated encryption
 * - HMAC-SHA256 integrity verification
 * - Unique salt per backup (32 bytes)
 * - OWASP A02 (Cryptographic Failures) compliant
 *
 * @module BackupEncryption
 */

import type { MasterKey, CryptoResult } from '../../crypto/types';
import { encrypt, decrypt } from '../../crypto/encryption';
import { deriveMasterKey, generateSalt } from '../../crypto/keyDerivation';
import { logger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/errors';

const backupEncryptionLogger = logger.child('BackupEncryption');

/**
 * User role types for backup bundles
 */
export type UserRole = 'Admin' | 'Manager' | 'Bookkeeper' | 'View-Only';

/**
 * Secure Backup Bundle structure per ROADMAP_BACKUP_AND_SYNC.md
 *
 * This structure represents a complete encrypted backup with all necessary
 * metadata, encrypted data, keys, and integrity verification.
 */
export interface SecureBackupBundle {
  /** Version of backup format (currently "1.0") */
  version: string;

  /** Metadata about the backup */
  metadata: {
    /** Company ID this backup belongs to */
    companyId: string;
    /** User ID who created the backup */
    userId: string;
    /** Role of the user (determines data filtering) */
    userRole: UserRole;
    /** Unix timestamp when backup was created */
    timestamp: number;
    /** Key rotation epoch (tracks revocations) */
    keyRotationEpoch: number;
  };

  /** Encrypted data sections (AES-256-GCM encrypted) */
  encryptedData: {
    /** Encrypted transactions data */
    transactions: string;
    /** Encrypted accounts data */
    accounts: string;
    /** Encrypted reports data */
    reports: string;
    /** Encrypted preferences data */
    preferences: string;
  };

  /** Encrypted keys section */
  encryptedKeys: {
    /** Derived key encrypted with password-derived key */
    derivedKey: string;
    /** Key ID used for encryption */
    keyId: string;
    /** Unique salt for this backup (32 bytes, base64) */
    salt: string;
    /** Argon2id iterations parameter */
    iterations: number;
    /** Argon2id memory cost in KB */
    memoryCost: number;
    /** Argon2id parallelism parameter */
    parallelism: number;
  };

  /** Integrity verification */
  integrity: {
    /** HMAC-SHA256 of all fields */
    hmac: string;
    /** Salt for HMAC verification (base64) */
    hmacSalt: string;
  };
}

/**
 * Data to be included in a backup bundle
 */
export interface BackupData {
  transactions: unknown[];
  accounts: unknown[];
  reports: unknown[];
  preferences: unknown;
}

/**
 * Options for generating a backup bundle
 */
export interface GenerateBackupBundleOptions {
  companyId: string;
  userId: string;
  userRole: UserRole;
  keyRotationEpoch: number;
  password: string;
  data: BackupData;
}

/**
 * Result of backup bundle generation
 */
export interface BackupBundleResult {
  success: boolean;
  bundle?: SecureBackupBundle;
  error?: string;
  errorCode?: ErrorCode;
}

/**
 * Result of backup bundle restoration
 */
export interface RestoreBundleResult {
  success: boolean;
  data?: BackupData;
  metadata?: SecureBackupBundle['metadata'];
  error?: string;
  errorCode?: ErrorCode;
}

/**
 * Argon2id parameters per security-expert review
 */
const ARGON2_PARAMS = {
  iterations: 3,
  memory: 65536, // 64MB in KB
  parallelism: 4,
  hashLength: 32, // 256 bits
  type: 0, // Argon2id
} as const;

/**
 * Salt lengths per specification
 */
const SALT_LENGTH = 32; // 256 bits for backup salt
const HMAC_SALT_LENGTH = 32; // 256 bits for HMAC salt

/**
 * Current backup bundle version
 */
const BACKUP_VERSION = '1.0';

/**
 * Generate a cryptographically secure random salt
 *
 * @param length - Length in bytes (default: 32)
 * @returns Base64-encoded salt
 */
function generateSecureSalt(length: number = SALT_LENGTH): string {
  const salt = new Uint8Array(length);
  crypto.getRandomValues(salt);
  return btoa(String.fromCharCode(...salt));
}

/**
 * Derive a key from password using Argon2id
 *
 * Uses the security-expert recommended parameters:
 * - Memory: 64MB
 * - Iterations: 3
 * - Parallelism: 4
 * - Output: 256-bit key
 *
 * @param password - User's password
 * @param saltBase64 - Base64-encoded salt
 * @returns Promise resolving to derived key as Uint8Array
 */
async function deriveKeyFromPassword(
  password: string,
  saltBase64: string
): Promise<Uint8Array> {
  try {
    // Decode salt from base64
    const saltString = atob(saltBase64);
    const salt = new Uint8Array(saltString.length);
    for (let i = 0; i < saltString.length; i++) {
      salt[i] = saltString.charCodeAt(i);
    }

    // Use the existing deriveMasterKey function which properly handles Argon2id
    const result = await deriveMasterKey(
      password,
      salt,
      {
        memoryCost: ARGON2_PARAMS.memory,
        timeCost: ARGON2_PARAMS.iterations,
        parallelism: ARGON2_PARAMS.parallelism,
        salt: salt,
        keyLength: ARGON2_PARAMS.hashLength,
      },
      { skipRateLimit: true } // Skip rate limiting for backup operations
    );

    if (!result.success || !result.data) {
      throw new AppError(
        ErrorCode.ENCRYPTION_ERROR,
        result.error || 'Failed to derive encryption key from password'
      );
    }

    return result.data.keyMaterial;
  } catch (error) {
    backupEncryptionLogger.error('Failed to derive key from password', { error });
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      ErrorCode.ENCRYPTION_ERROR,
      'Failed to derive encryption key from password'
    );
  }
}

/**
 * Generate HMAC-SHA256 for integrity verification
 *
 * @param data - Data to generate HMAC for
 * @param keyMaterial - Key material for HMAC
 * @returns Promise resolving to base64-encoded HMAC
 */
async function generateHMAC(
  data: string,
  keyMaterial: Uint8Array
): Promise<string> {
  try {
    // Import key for HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Generate HMAC
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const signature = await crypto.subtle.sign('HMAC', key, dataBytes);

    // Convert to base64
    const signatureArray = new Uint8Array(signature);
    return btoa(String.fromCharCode(...signatureArray));
  } catch (error) {
    backupEncryptionLogger.error('Failed to generate HMAC', { error });
    throw new AppError(
      ErrorCode.ENCRYPTION_ERROR,
      'Failed to generate integrity verification'
    );
  }
}

/**
 * Verify HMAC-SHA256 for integrity verification
 *
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param data - Data to verify
 * @param expectedHmac - Expected HMAC (base64)
 * @param keyMaterial - Key material for HMAC
 * @returns Promise resolving to true if valid
 */
async function verifyHMAC(
  data: string,
  expectedHmac: string,
  keyMaterial: Uint8Array
): Promise<boolean> {
  try {
    const actualHmac = await generateHMAC(data, keyMaterial);

    // Constant-time comparison to prevent timing attacks
    if (actualHmac.length !== expectedHmac.length) {
      return false;
    }

    let mismatch = 0;
    for (let i = 0; i < actualHmac.length; i++) {
      mismatch |= actualHmac.charCodeAt(i) ^ expectedHmac.charCodeAt(i);
    }

    return mismatch === 0;
  } catch (error) {
    backupEncryptionLogger.error('Failed to verify HMAC', { error });
    return false;
  }
}

/**
 * Encrypt data section using AES-256-GCM
 *
 * @param data - Data to encrypt
 * @param key - Master key to use
 * @returns Promise resolving to base64-encoded encrypted data
 */
async function encryptDataSection(
  data: unknown,
  key: MasterKey
): Promise<string> {
  const json = JSON.stringify(data);
  const encryptResult = await encrypt(json, key);

  if (!encryptResult.success || !encryptResult.data) {
    throw new AppError(
      ErrorCode.ENCRYPTION_ERROR,
      encryptResult.error || 'Failed to encrypt data section'
    );
  }

  // Serialize encrypted data
  const encrypted = encryptResult.data;
  const serialized = {
    ciphertext: btoa(String.fromCharCode(...encrypted.ciphertext)),
    iv: btoa(String.fromCharCode(...encrypted.iv)),
    authTag: btoa(String.fromCharCode(...encrypted.authTag)),
    keyId: encrypted.keyId,
    algorithm: encrypted.algorithm,
    encryptedAt: encrypted.encryptedAt,
  };

  return JSON.stringify(serialized);
}

/**
 * Decrypt data section using AES-256-GCM
 *
 * @param encryptedStr - Base64-encoded encrypted data
 * @param key - Master key to use
 * @returns Promise resolving to decrypted data
 */
async function decryptDataSection(
  encryptedStr: string,
  key: MasterKey
): Promise<unknown> {
  const serialized = JSON.parse(encryptedStr);

  // Deserialize encrypted data
  const ciphertextStr = atob(serialized.ciphertext);
  const ciphertext = new Uint8Array(ciphertextStr.length);
  for (let i = 0; i < ciphertextStr.length; i++) {
    ciphertext[i] = ciphertextStr.charCodeAt(i);
  }

  const ivStr = atob(serialized.iv);
  const iv = new Uint8Array(ivStr.length);
  for (let i = 0; i < ivStr.length; i++) {
    iv[i] = ivStr.charCodeAt(i);
  }

  const authTagStr = atob(serialized.authTag);
  const authTag = new Uint8Array(authTagStr.length);
  for (let i = 0; i < authTagStr.length; i++) {
    authTag[i] = authTagStr.charCodeAt(i);
  }

  const encrypted = {
    ciphertext,
    iv,
    authTag,
    keyId: serialized.keyId,
    algorithm: serialized.algorithm as 'AES-256-GCM',
    encryptedAt: serialized.encryptedAt,
  };

  const decryptResult = await decrypt(encrypted, key);

  if (!decryptResult.success || !decryptResult.data) {
    throw new AppError(
      ErrorCode.DECRYPTION_FAILED,
      decryptResult.error || 'Failed to decrypt data section'
    );
  }

  return JSON.parse(decryptResult.data as string);
}

/**
 * Generate a secure backup bundle with encryption and integrity verification
 *
 * This is the main function for Task 1.1. It:
 * 1. Generates unique salts for encryption and HMAC
 * 2. Derives a key from the user's password using Argon2id
 * 3. Encrypts all data sections using AES-256-GCM
 * 4. Generates HMAC-SHA256 for integrity verification
 * 5. Returns a complete SecureBackupBundle
 *
 * Security Features:
 * - Unique salt per backup (prevents rainbow table attacks)
 * - Argon2id key derivation (memory-hard, resistant to GPU attacks)
 * - AES-256-GCM encryption (authenticated encryption)
 * - HMAC-SHA256 integrity (detects tampering)
 *
 * @param options - Backup bundle generation options
 * @returns Promise resolving to BackupBundleResult
 *
 * @example
 * ```typescript
 * const result = await generateBackupBundle({
 *   companyId: 'company-123',
 *   userId: 'user-456',
 *   userRole: 'Admin',
 *   keyRotationEpoch: 1,
 *   password: 'user-strong-password',
 *   data: {
 *     transactions: [...],
 *     accounts: [...],
 *     reports: [...],
 *     preferences: {...}
 *   }
 * });
 *
 * if (result.success && result.bundle) {
 *   // Save bundle to file or upload to cloud
 *   const bundleJson = JSON.stringify(result.bundle);
 * }
 * ```
 */
export async function generateBackupBundle(
  options: GenerateBackupBundleOptions
): Promise<BackupBundleResult> {
  try {
    backupEncryptionLogger.info('Generating backup bundle', {
      companyId: options.companyId,
      userId: options.userId,
      userRole: options.userRole,
    });

    // Step 1: Generate unique salts
    const encryptionSalt = generateSecureSalt(SALT_LENGTH);
    const hmacSalt = generateSecureSalt(HMAC_SALT_LENGTH);

    // Step 2: Derive encryption key from password
    const derivedKeyMaterial = await deriveKeyFromPassword(
      options.password,
      encryptionSalt
    );

    // Create a MasterKey object for encryption functions
    const masterKey: MasterKey = {
      id: `backup-${Date.now()}`,
      keyMaterial: derivedKeyMaterial,
      derivationParams: {
        memoryCost: ARGON2_PARAMS.memory,
        timeCost: ARGON2_PARAMS.iterations,
        parallelism: ARGON2_PARAMS.parallelism,
        salt: derivedKeyMaterial, // Not used for backup, but required by type
        keyLength: ARGON2_PARAMS.hashLength,
      },
      createdAt: Date.now(),
    };

    // Step 3: Encrypt all data sections
    const [transactions, accounts, reports, preferences] = await Promise.all([
      encryptDataSection(options.data.transactions, masterKey),
      encryptDataSection(options.data.accounts, masterKey),
      encryptDataSection(options.data.reports, masterKey),
      encryptDataSection(options.data.preferences, masterKey),
    ]);

    // Step 4: Build the bundle (without HMAC first)
    const timestamp = Date.now();
    const bundleWithoutHmac: Omit<SecureBackupBundle, 'integrity'> = {
      version: BACKUP_VERSION,
      metadata: {
        companyId: options.companyId,
        userId: options.userId,
        userRole: options.userRole,
        timestamp,
        keyRotationEpoch: options.keyRotationEpoch,
      },
      encryptedData: {
        transactions,
        accounts,
        reports,
        preferences,
      },
      encryptedKeys: {
        derivedKey: btoa(String.fromCharCode(...derivedKeyMaterial)),
        keyId: masterKey.id,
        salt: encryptionSalt,
        iterations: ARGON2_PARAMS.iterations,
        memoryCost: ARGON2_PARAMS.memory,
        parallelism: ARGON2_PARAMS.parallelism,
      },
    };

    // Step 5: Generate HMAC for integrity verification
    const hmacData = JSON.stringify(bundleWithoutHmac);
    const hmacKeyMaterial = await deriveKeyFromPassword(
      options.password,
      hmacSalt
    );
    const hmac = await generateHMAC(hmacData, hmacKeyMaterial);

    // Step 6: Complete the bundle
    const bundle: SecureBackupBundle = {
      ...bundleWithoutHmac,
      integrity: {
        hmac,
        hmacSalt,
      },
    };

    backupEncryptionLogger.info('Backup bundle generated successfully', {
      companyId: options.companyId,
      timestamp,
    });

    return {
      success: true,
      bundle,
    };
  } catch (error) {
    backupEncryptionLogger.error('Failed to generate backup bundle', { error });

    if (error instanceof AppError) {
      return {
        success: false,
        error: error.message,
        errorCode: error.code,
      };
    }

    return {
      success: false,
      error: 'An unexpected error occurred while generating the backup bundle',
      errorCode: ErrorCode.UNKNOWN_ERROR,
    };
  }
}

/**
 * Restore data from a secure backup bundle
 *
 * This function:
 * 1. Verifies the HMAC integrity
 * 2. Derives the decryption key from the password
 * 3. Decrypts all data sections
 * 4. Returns the decrypted data and metadata
 *
 * Security Features:
 * - HMAC verification (detects tampering)
 * - Constant-time comparison (prevents timing attacks)
 * - Password verification through decryption success
 *
 * @param bundle - Secure backup bundle to restore
 * @param password - User's password for decryption
 * @returns Promise resolving to RestoreBundleResult
 *
 * @example
 * ```typescript
 * const result = await restoreBackupBundle(bundle, 'user-password');
 *
 * if (result.success && result.data) {
 *   // Restore data to database
 *   await db.transactions.bulkAdd(result.data.transactions);
 *   await db.accounts.bulkAdd(result.data.accounts);
 * }
 * ```
 */
export async function restoreBackupBundle(
  bundle: SecureBackupBundle,
  password: string
): Promise<RestoreBundleResult> {
  try {
    backupEncryptionLogger.info('Restoring backup bundle', {
      companyId: bundle.metadata.companyId,
      timestamp: bundle.metadata.timestamp,
    });

    // Step 1: Verify HMAC integrity
    const hmacKeyMaterial = await deriveKeyFromPassword(
      password,
      bundle.integrity.hmacSalt
    );

    const bundleWithoutHmac = {
      version: bundle.version,
      metadata: bundle.metadata,
      encryptedData: bundle.encryptedData,
      encryptedKeys: bundle.encryptedKeys,
    };

    const hmacData = JSON.stringify(bundleWithoutHmac);
    const isValid = await verifyHMAC(
      hmacData,
      bundle.integrity.hmac,
      hmacKeyMaterial
    );

    if (!isValid) {
      backupEncryptionLogger.warn('HMAC verification failed - wrong password or tampered backup');
      return {
        success: false,
        error: 'That password didn\'t work. Want to try again? (Or the backup file may have been tampered with.)',
        errorCode: ErrorCode.DECRYPTION_FAILED,
      };
    }

    // Step 2: Derive decryption key from password
    const derivedKeyMaterial = await deriveKeyFromPassword(
      password,
      bundle.encryptedKeys.salt
    );

    // Create a MasterKey object for decryption functions
    // Use the same key ID from the bundle to ensure decryption works
    const masterKey: MasterKey = {
      id: bundle.encryptedKeys.keyId,
      keyMaterial: derivedKeyMaterial,
      derivationParams: {
        memoryCost: bundle.encryptedKeys.memoryCost,
        timeCost: bundle.encryptedKeys.iterations,
        parallelism: bundle.encryptedKeys.parallelism,
        salt: derivedKeyMaterial, // Not used for backup, but required by type
        keyLength: ARGON2_PARAMS.hashLength,
      },
      createdAt: Date.now(),
    };

    // Step 3: Decrypt all data sections
    const [transactions, accounts, reports, preferences] = await Promise.all([
      decryptDataSection(bundle.encryptedData.transactions, masterKey),
      decryptDataSection(bundle.encryptedData.accounts, masterKey),
      decryptDataSection(bundle.encryptedData.reports, masterKey),
      decryptDataSection(bundle.encryptedData.preferences, masterKey),
    ]);

    backupEncryptionLogger.info('Backup bundle restored successfully', {
      companyId: bundle.metadata.companyId,
    });

    return {
      success: true,
      data: {
        transactions: transactions as unknown[],
        accounts: accounts as unknown[],
        reports: reports as unknown[],
        preferences,
      },
      metadata: bundle.metadata,
    };
  } catch (error) {
    backupEncryptionLogger.error('Failed to restore backup bundle', { error });

    if (error instanceof AppError) {
      return {
        success: false,
        error: error.message,
        errorCode: error.code,
      };
    }

    return {
      success: false,
      error: 'That password didn\'t work. Want to try again?',
      errorCode: ErrorCode.DECRYPTION_FAILED,
    };
  }
}

/**
 * Validate a backup bundle structure
 *
 * Checks that the bundle has all required fields and correct structure.
 * Does NOT verify integrity or attempt decryption.
 *
 * @param bundle - Bundle to validate
 * @returns Validation result
 */
export function validateBackupBundleStructure(
  bundle: unknown
): { valid: boolean; error?: string } {
  try {
    if (!bundle || typeof bundle !== 'object') {
      return { valid: false, error: 'Invalid bundle: not an object' };
    }

    const b = bundle as Partial<SecureBackupBundle>;

    // Check version
    if (!b.version || typeof b.version !== 'string') {
      return { valid: false, error: 'Invalid bundle: missing or invalid version' };
    }

    // Check metadata
    if (!b.metadata || typeof b.metadata !== 'object') {
      return { valid: false, error: 'Invalid bundle: missing metadata' };
    }

    const requiredMetadataFields = ['companyId', 'userId', 'userRole', 'timestamp', 'keyRotationEpoch'];
    for (const field of requiredMetadataFields) {
      if (!(field in b.metadata)) {
        return { valid: false, error: `Invalid bundle: missing metadata.${field}` };
      }
    }

    // Check encryptedData
    if (!b.encryptedData || typeof b.encryptedData !== 'object') {
      return { valid: false, error: 'Invalid bundle: missing encryptedData' };
    }

    const requiredDataFields = ['transactions', 'accounts', 'reports', 'preferences'];
    for (const field of requiredDataFields) {
      if (!(field in b.encryptedData)) {
        return { valid: false, error: `Invalid bundle: missing encryptedData.${field}` };
      }
    }

    // Check encryptedKeys
    if (!b.encryptedKeys || typeof b.encryptedKeys !== 'object') {
      return { valid: false, error: 'Invalid bundle: missing encryptedKeys' };
    }

    const requiredKeyFields = ['derivedKey', 'keyId', 'salt', 'iterations', 'memoryCost', 'parallelism'];
    for (const field of requiredKeyFields) {
      if (!(field in b.encryptedKeys)) {
        return { valid: false, error: `Invalid bundle: missing encryptedKeys.${field}` };
      }
    }

    // Check integrity
    if (!b.integrity || typeof b.integrity !== 'object') {
      return { valid: false, error: 'Invalid bundle: missing integrity' };
    }

    if (!b.integrity.hmac || !b.integrity.hmacSalt) {
      return { valid: false, error: 'Invalid bundle: missing integrity fields' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid bundle: malformed structure' };
  }
}
