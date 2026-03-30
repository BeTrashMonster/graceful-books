/**
 * HMAC Integrity Verification for Backup Files
 *
 * Implements HMAC-SHA256 integrity verification for encrypted backup files
 * per ROADMAP_BACKUP_AND_SYNC.md Task 1.6.
 *
 * Key Features:
 * - HMAC-SHA256 generation for backup bundles
 * - Constant-time comparison to prevent timing attacks
 * - Password-based HMAC key derivation using Argon2id
 * - Tamper detection for all backup fields (metadata, data, keys)
 * - Permission level locked in HMAC (prevents privilege escalation)
 *
 * Security Principles:
 * - HMAC includes ALL fields: metadata + encryptedData + encryptedKeys
 * - Permission level is part of HMAC (prevents privilege escalation attacks)
 * - Constant-time comparison prevents timing attacks
 * - Separate HMAC salt stored in backup (not the same as encryption salt)
 * - HMAC key derived from user password using Argon2id
 *
 * Requirements:
 * - ROADMAP_BACKUP_AND_SYNC.md Task 1.6
 * - OWASP A08: Data Integrity Failures (compliance)
 *
 * @module services/backup/IntegrityVerification
 */

import { deriveMasterKey } from '../../crypto/keyDerivation';
import { constantTimeEqual } from '../../utils/crypto/constantTime';
import { logger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../utils/errors';

const integrityLogger = logger.child('IntegrityVerification');

/**
 * Secure backup bundle structure (per ROADMAP_BACKUP_AND_SYNC.md)
 */
export interface SecureBackupBundle {
  version: string; // "1.0"
  metadata: {
    companyId: string;
    userId: string;
    permissions: 'Admin' | 'Manager' | 'Bookkeeper' | 'View-Only';
    timestamp: number;
    keyRotationEpoch: number;
  };
  encryptedData: {
    transactions: string;
    accounts: string;
    reports: string;
    preferences: string;
  };
  encryptedKeys: {
    derivedKey: string;
    salt: string;
    iterations: number;
  };
  integrity: {
    hmac: string;
    hmacSalt: string;
  };
}

/**
 * HMAC generation result
 */
export interface HMACGenerationResult {
  success: boolean;
  hmac?: string;
  error?: string;
}

/**
 * Backup integrity verification result
 */
export interface IntegrityVerificationResult {
  success: boolean;
  valid?: boolean;
  error?: string;
  details?: {
    hmacMatch: boolean;
    expectedHmac: string;
    actualHmac: string;
  };
}

/**
 * Derive HMAC key from user password using Argon2id
 *
 * Uses Argon2id key derivation function (same as backup encryption) with
 * a separate salt dedicated to HMAC operations. This ensures that even if
 * the encryption key is compromised, the HMAC key remains independent.
 *
 * Security Note: HMAC salt is stored in plaintext in the backup file, which
 * is acceptable because Argon2id is designed to be resistant to attacks even
 * with known salts.
 *
 * @param userPassword - User's password
 * @param hmacSalt - Salt for HMAC key derivation (base64 encoded string)
 * @returns Promise resolving to HMAC CryptoKey
 *
 * @example
 * ```typescript
 * const hmacKey = await deriveHmacKey('user-password', 'base64-salt');
 * ```
 */
export async function deriveHmacKey(
  userPassword: string,
  hmacSalt: string
): Promise<CryptoKey> {
  try {
    integrityLogger.debug('Deriving HMAC key from password');

    // Validate inputs
    if (!userPassword || userPassword.trim().length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Password cannot be empty for HMAC key derivation'
      );
    }

    if (!hmacSalt || hmacSalt.trim().length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'HMAC salt cannot be empty'
      );
    }

    // Decode HMAC salt from base64
    const saltBytes = base64ToUint8Array(hmacSalt);

    // Derive master key using Argon2id
    // Using same parameters as backup encryption for consistency
    const keyResult = await deriveMasterKey(userPassword, saltBytes, {
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
      keyLength: 32, // 256 bits
    });

    if (!keyResult.success || !keyResult.data) {
      throw new AppError(
        ErrorCode.ENCRYPTION_ERROR,
        keyResult.error || 'Failed to derive HMAC key from password'
      );
    }

    // Import derived key material as HMAC key
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      keyResult.data.keyMaterial as BufferSource,
      {
        name: 'HMAC',
        hash: 'SHA-256',
      },
      false, // Not extractable
      ['sign', 'verify']
    );

    integrityLogger.debug('HMAC key derived successfully');

    return hmacKey;
  } catch (error) {
    integrityLogger.error('Failed to derive HMAC key', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      ErrorCode.ENCRYPTION_ERROR,
      error instanceof Error
        ? `Failed to derive HMAC key: ${error.message}`
        : 'Failed to derive HMAC key'
    );
  }
}

/**
 * Generate HMAC-SHA256 for backup bundle
 *
 * Creates an HMAC signature over ALL fields in the backup bundle to ensure
 * integrity. The HMAC includes:
 * - All metadata fields (including permissions - CRITICAL for security)
 * - All encrypted data fields
 * - All encrypted key fields
 *
 * Field Order (MUST be consistent):
 * 1. version
 * 2. companyId
 * 3. userId
 * 4. permissions (CRITICAL: locks permission level in HMAC)
 * 5. timestamp
 * 6. keyRotationEpoch
 * 7. encryptedData (full object)
 * 8. encryptedKeys (full object)
 *
 * Security Note: Including permissions in HMAC prevents privilege escalation
 * attacks where an attacker might try to modify a backup to grant themselves
 * higher privileges.
 *
 * @param metadata - Backup metadata
 * @param encryptedData - Encrypted data object
 * @param encryptedKeys - Encrypted keys object
 * @param hmacKey - HMAC key (derived from password)
 * @returns Promise resolving to base64-encoded HMAC string
 *
 * @example
 * ```typescript
 * const hmac = await generateBackupHMAC(
 *   metadata,
 *   encryptedData,
 *   encryptedKeys,
 *   hmacKey
 * );
 * ```
 */
export async function generateBackupHMAC(
  metadata: SecureBackupBundle['metadata'],
  encryptedData: SecureBackupBundle['encryptedData'],
  encryptedKeys: SecureBackupBundle['encryptedKeys'],
  hmacKey: CryptoKey
): Promise<string> {
  try {
    integrityLogger.debug('Generating backup HMAC');

    // Serialize fields in strict order for HMAC calculation
    // This order MUST be maintained for verification to succeed
    const hmacInput = JSON.stringify({
      version: '1.0',
      companyId: metadata.companyId,
      userId: metadata.userId,
      permissions: metadata.permissions, // CRITICAL: Permission level locked in HMAC
      timestamp: metadata.timestamp,
      keyRotationEpoch: metadata.keyRotationEpoch,
      encryptedData, // Full encrypted data object
      encryptedKeys, // Full encrypted keys object
    });

    integrityLogger.debug('HMAC input length', { bytes: hmacInput.length });

    // Convert to bytes
    const encoder = new TextEncoder();
    const inputBytes = encoder.encode(hmacInput);

    // Generate HMAC using Web Crypto API
    const hmacBuffer = await crypto.subtle.sign(
      'HMAC',
      hmacKey,
      inputBytes
    );

    // Convert to base64 for storage
    const hmacBytes = new Uint8Array(hmacBuffer);
    const hmacBase64 = uint8ArrayToBase64(hmacBytes);

    integrityLogger.info('Backup HMAC generated successfully', {
      hmacLength: hmacBase64.length,
    });

    return hmacBase64;
  } catch (error) {
    integrityLogger.error('Failed to generate backup HMAC', error);
    throw new AppError(
      ErrorCode.ENCRYPTION_ERROR,
      error instanceof Error
        ? `Failed to generate backup HMAC: ${error.message}`
        : 'Failed to generate backup HMAC'
    );
  }
}

/**
 * Verify backup integrity using HMAC
 *
 * Verifies that a backup bundle has not been tampered with by:
 * 1. Deriving the HMAC key from the user's password
 * 2. Recalculating the HMAC over all fields
 * 3. Comparing the calculated HMAC with the stored HMAC using constant-time comparison
 *
 * This function detects:
 * - Modifications to metadata (companyId, userId, permissions, timestamp, epoch)
 * - Modifications to encrypted data
 * - Modifications to encrypted keys
 * - Privilege escalation attempts (permission level changes)
 *
 * Security Note: Uses constant-time comparison to prevent timing attacks that
 * could leak information about the HMAC value.
 *
 * @param backupBundle - Complete backup bundle to verify
 * @param userPassword - User's password for HMAC key derivation
 * @returns Promise resolving to verification result
 *
 * @example
 * ```typescript
 * const result = await verifyBackupIntegrity(backupBundle, 'user-password');
 * if (result.success && result.valid) {
 *   console.log('Backup integrity verified');
 * } else {
 *   console.error('Backup has been tampered with!');
 * }
 * ```
 */
export async function verifyBackupIntegrity(
  backupBundle: SecureBackupBundle,
  userPassword: string
): Promise<IntegrityVerificationResult> {
  try {
    integrityLogger.info('Verifying backup integrity');

    // Validate inputs
    if (!backupBundle || !backupBundle.integrity || !backupBundle.integrity.hmac) {
      return {
        success: false,
        error: 'Backup bundle is missing HMAC integrity information',
      };
    }

    if (!userPassword || userPassword.trim().length === 0) {
      return {
        success: false,
        error: 'Password is required for integrity verification',
      };
    }

    // Derive HMAC key from password
    const hmacKey = await deriveHmacKey(
      userPassword,
      backupBundle.integrity.hmacSalt
    );

    // Recalculate HMAC over all fields
    const calculatedHmac = await generateBackupHMAC(
      backupBundle.metadata,
      backupBundle.encryptedData,
      backupBundle.encryptedKeys,
      hmacKey
    );

    // Get stored HMAC from backup
    const storedHmac = backupBundle.integrity.hmac;

    // Constant-time comparison to prevent timing attacks
    const hmacMatch = constantTimeCompare(calculatedHmac, storedHmac);

    if (!hmacMatch) {
      integrityLogger.warn('Backup integrity verification FAILED - HMAC mismatch', {
        companyId: backupBundle.metadata.companyId,
        userId: backupBundle.metadata.userId,
        timestamp: new Date(backupBundle.metadata.timestamp).toISOString(),
      });

      return {
        success: true,
        valid: false,
        details: {
          hmacMatch: false,
          expectedHmac: storedHmac.substring(0, 16) + '...',
          actualHmac: calculatedHmac.substring(0, 16) + '...',
        },
      };
    }

    integrityLogger.info('Backup integrity verification PASSED', {
      companyId: backupBundle.metadata.companyId,
      userId: backupBundle.metadata.userId,
      timestamp: new Date(backupBundle.metadata.timestamp).toISOString(),
    });

    return {
      success: true,
      valid: true,
      details: {
        hmacMatch: true,
        expectedHmac: storedHmac.substring(0, 16) + '...',
        actualHmac: calculatedHmac.substring(0, 16) + '...',
      },
    };
  } catch (error) {
    integrityLogger.error('Backup integrity verification failed with error', error);
    return {
      success: false,
      error: error instanceof Error
        ? `Integrity verification failed: ${error.message}`
        : 'Integrity verification failed',
    };
  }
}

/**
 * Constant-time string comparison (wrapper around utility)
 *
 * Uses the existing constantTimeEqual utility from utils/crypto/constantTime.ts
 * to prevent timing attacks during HMAC comparison.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns True if strings are equal, false otherwise
 */
export function constantTimeCompare(a: string, b: string): boolean {
  return constantTimeEqual(a, b);
}

/**
 * Generate a random HMAC salt
 *
 * Creates a cryptographically secure random salt for HMAC key derivation.
 * The salt is 32 bytes (256 bits) for maximum security.
 *
 * @returns Base64-encoded HMAC salt
 *
 * @example
 * ```typescript
 * const hmacSalt = generateHmacSalt();
 * // "base64-encoded-32-byte-salt"
 * ```
 */
export function generateHmacSalt(): string {
  const salt = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(salt);
  return uint8ArrayToBase64(salt);
}

/**
 * Create a complete secure backup bundle with HMAC
 *
 * Helper function that creates a complete SecureBackupBundle with proper
 * HMAC integrity verification. This is the recommended way to create backups.
 *
 * @param metadata - Backup metadata
 * @param encryptedData - Encrypted data object
 * @param encryptedKeys - Encrypted keys object
 * @param userPassword - User's password for HMAC generation
 * @returns Promise resolving to complete backup bundle
 *
 * @example
 * ```typescript
 * const bundle = await createSecureBackupBundle(
 *   metadata,
 *   encryptedData,
 *   encryptedKeys,
 *   'user-password'
 * );
 * ```
 */
export async function createSecureBackupBundle(
  metadata: SecureBackupBundle['metadata'],
  encryptedData: SecureBackupBundle['encryptedData'],
  encryptedKeys: SecureBackupBundle['encryptedKeys'],
  userPassword: string
): Promise<SecureBackupBundle> {
  try {
    integrityLogger.info('Creating secure backup bundle with HMAC');

    // Generate HMAC salt
    const hmacSalt = generateHmacSalt();

    // Derive HMAC key
    const hmacKey = await deriveHmacKey(userPassword, hmacSalt);

    // Generate HMAC
    const hmac = await generateBackupHMAC(
      metadata,
      encryptedData,
      encryptedKeys,
      hmacKey
    );

    // Assemble complete bundle
    const bundle: SecureBackupBundle = {
      version: '1.0',
      metadata,
      encryptedData,
      encryptedKeys,
      integrity: {
        hmac,
        hmacSalt,
      },
    };

    integrityLogger.info('Secure backup bundle created successfully', {
      companyId: metadata.companyId,
      userId: metadata.userId,
      permissions: metadata.permissions,
    });

    return bundle;
  } catch (error) {
    integrityLogger.error('Failed to create secure backup bundle', error);
    throw new AppError(
      ErrorCode.ENCRYPTION_ERROR,
      error instanceof Error
        ? `Failed to create secure backup bundle: ${error.message}`
        : 'Failed to create secure backup bundle'
    );
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(buffer: Uint8Array): string {
  const binaryString = Array.from(buffer)
    .map((byte) => String.fromCharCode(byte))
    .join('');
  return btoa(binaryString);
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
