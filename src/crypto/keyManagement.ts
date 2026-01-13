/**
 * Key Management Module
 *
 * Implements hierarchical key management per ARCH-002.
 * Manages master keys, derived keys for different permission levels,
 * and key rotation capabilities.
 *
 * Key Hierarchy (per spec):
 * ```
 * Master Key (derived from passphrase)
 *   ├── Data Encryption Key (for financial data)
 *   ├── Admin Key (full access)
 *   ├── Manager Key (edit access)
 *   ├── User Key (basic access)
 *   ├── Consultant Key (view-only)
 *   └── Accountant Key (view + export)
 * ```
 */

import type {
  MasterKey,
  DerivedKey,
  PermissionLevel,
  EncryptionContext,
  KeyRotationRequest,
  KeyRotationResult,
  KeyStorageMetadata,
  CryptoResult,
} from './types';
import { encrypt, reencrypt } from './encryption';
import { clearMasterKey, clearSensitiveData } from './keyDerivation';

/**
 * Permission level hierarchy (ordered from most to least privileged)
 */
const PERMISSION_HIERARCHY: PermissionLevel[] = [
  'admin',
  'manager',
  'accountant',
  'user',
  'consultant',
];

/**
 * Default key expiration time (90 days)
 * Kept for potential future use
 */
// const _DEFAULT_KEY_EXPIRATION_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Derive a key for a specific permission level
 *
 * Per ARCH-002: Derived keys are generated for different permission levels
 * and encrypted with the user's password.
 *
 * Uses HKDF (HMAC-based Key Derivation Function) to derive keys from
 * the master key with permission-level-specific info strings.
 *
 * @param masterKey - Master key to derive from
 * @param permissionLevel - Permission level for derived key
 * @param expiresAt - Optional expiration timestamp
 * @returns Promise resolving to derived key or error
 *
 * @example
 * ```typescript
 * const result = await deriveKey(masterKey, 'manager');
 * if (result.success && result.data) {
 *   const managerKey = result.data;
 *   console.log('Manager key ID:', managerKey.id);
 * }
 * ```
 */
export async function deriveKey(
  masterKey: MasterKey,
  permissionLevel: PermissionLevel,
  expiresAt?: number
): Promise<CryptoResult<DerivedKey>> {
  try {
    // Import master key material
    const importedKey = await crypto.subtle.importKey(
      'raw',
      masterKey.keyMaterial as BufferSource,
      'HKDF',
      false,
      ['deriveBits']
    );

    // Derive key using HKDF with permission-level-specific info
    const info = new TextEncoder().encode(`graceful-books-${permissionLevel}`);
    const salt = new Uint8Array(32); // All zeros for deterministic derivation
    crypto.getRandomValues(salt);

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt,
        info,
      },
      importedKey,
      256 // 256 bits
    );

    const keyMaterial = new Uint8Array(derivedBits);

    // Generate unique key ID
    const keyId = await generateDerivedKeyId(masterKey.id, permissionLevel, salt);

    // Create derived key object
    const derivedKey: DerivedKey = {
      id: keyId,
      masterKeyId: masterKey.id,
      permissionLevel,
      keyMaterial,
      createdAt: Date.now(),
      expiresAt,
    };

    return {
      success: true,
      data: derivedKey,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Key derivation failed',
      errorCode: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Generate a unique ID for a derived key
 *
 * @param masterKeyId - Master key ID
 * @param permissionLevel - Permission level
 * @param salt - Derivation salt
 * @returns Promise resolving to key ID
 */
async function generateDerivedKeyId(
  masterKeyId: string,
  permissionLevel: PermissionLevel,
  salt: Uint8Array
): Promise<string> {
  const data = `${masterKeyId}-${permissionLevel}-${Array.from(salt).join(',')}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derive all permission-level keys from master key
 *
 * Creates a complete set of derived keys for all permission levels.
 *
 * @param masterKey - Master key to derive from
 * @param expiresAt - Optional expiration timestamp for all keys
 * @returns Promise resolving to map of permission levels to derived keys
 *
 * @example
 * ```typescript
 * const keysResult = await deriveAllKeys(masterKey);
 * if (keysResult.success && keysResult.data) {
 *   const managerKey = keysResult.data.get('manager');
 * }
 * ```
 */
export async function deriveAllKeys(
  masterKey: MasterKey,
  expiresAt?: number
): Promise<CryptoResult<Map<PermissionLevel, DerivedKey>>> {
  try {
    const derivedKeys = new Map<PermissionLevel, DerivedKey>();

    // Derive keys for all permission levels in parallel
    const results = await Promise.all(
      PERMISSION_HIERARCHY.map(level => deriveKey(masterKey, level, expiresAt))
    );

    // Check for errors
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result) {
        return {
          success: false,
          error: 'Failed to derive key - result is undefined',
          errorCode: 'INVALID_KEY',
        };
      }
      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to derive key',
          errorCode: result.errorCode,
        };
      }
      derivedKeys.set(PERMISSION_HIERARCHY[i] as PermissionLevel, result.data);
    }

    return {
      success: true,
      data: derivedKeys,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to derive all keys',
      errorCode: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Create an encryption context for a session
 *
 * Per ARCH-001: Session keys are in memory only, cleared on logout.
 *
 * @param masterKey - Master key for the session
 * @param sessionId - Unique session identifier
 * @returns Promise resolving to encryption context or error
 *
 * @example
 * ```typescript
 * const contextResult = await createEncryptionContext(masterKey, 'session-123');
 * if (contextResult.success && contextResult.data) {
 *   // Use context for encrypting/decrypting during session
 * }
 * ```
 */
export async function createEncryptionContext(
  masterKey: MasterKey,
  sessionId: string
): Promise<CryptoResult<EncryptionContext>> {
  try {
    // Derive all permission-level keys
    const keysResult = await deriveAllKeys(masterKey);

    if (!keysResult.success || !keysResult.data) {
      return {
        success: false,
        error: keysResult.error,
        errorCode: keysResult.errorCode,
      };
    }

    const context: EncryptionContext = {
      masterKey,
      derivedKeys: keysResult.data,
      sessionId,
      sessionStartedAt: Date.now(),
    };

    return {
      success: true,
      data: context,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create encryption context',
      errorCode: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Clear an encryption context from memory
 *
 * Per ARCH-001: Session keys must be cleared on logout.
 * Securely overwrites all sensitive key material.
 *
 * @param context - Encryption context to clear
 *
 * @example
 * ```typescript
 * // On logout
 * clearEncryptionContext(currentContext);
 * ```
 */
export function clearEncryptionContext(context: EncryptionContext): void {
  // Clear master key
  clearMasterKey(context.masterKey);

  // Clear all derived keys
  for (const [_, derivedKey] of context.derivedKeys) {
    clearSensitiveData(derivedKey.keyMaterial);
  }

  // Clear the map
  context.derivedKeys.clear();
}

/**
 * Get appropriate key for permission level
 *
 * Returns the correct key based on user's permission level.
 * If user has higher permissions, they can use lower-level keys too.
 *
 * @param context - Encryption context
 * @param permissionLevel - Required permission level
 * @returns Derived key for the permission level or error
 *
 * @example
 * ```typescript
 * const keyResult = getKeyForPermission(context, 'manager');
 * if (keyResult.success && keyResult.data) {
 *   const encrypted = await encrypt(data, keyResult.data);
 * }
 * ```
 */
export function getKeyForPermission(
  context: EncryptionContext,
  permissionLevel: PermissionLevel
): CryptoResult<DerivedKey> {
  const key = context.derivedKeys.get(permissionLevel);

  if (!key) {
    return {
      success: false,
      error: `No key found for permission level: ${permissionLevel}`,
      errorCode: 'INVALID_KEY',
    };
  }

  // Check if key has expired
  if (key.expiresAt && Date.now() > key.expiresAt) {
    return {
      success: false,
      error: 'Key has expired - rotation required',
      errorCode: 'KEY_EXPIRED',
    };
  }

  return {
    success: true,
    data: key,
  };
}

/**
 * Check if user has permission to access data
 *
 * Verifies if user's permission level is sufficient to access
 * data encrypted with a specific permission level.
 *
 * @param userPermission - User's permission level
 * @param requiredPermission - Required permission level
 * @returns True if user has sufficient permissions
 *
 * @example
 * ```typescript
 * if (hasPermission('admin', 'manager')) {
 *   // Admin can access manager-level data
 * }
 * ```
 */
export function hasPermission(
  userPermission: PermissionLevel,
  requiredPermission: PermissionLevel
): boolean {
  const userIndex = PERMISSION_HIERARCHY.indexOf(userPermission);
  const requiredIndex = PERMISSION_HIERARCHY.indexOf(requiredPermission);

  // Lower index = higher permission
  return userIndex <= requiredIndex;
}

/**
 * Rotate master key and re-derive all keys
 *
 * Per ARCH-002: Key rotation completes within 60 seconds for active sessions.
 * Used to revoke access or for scheduled rotation.
 *
 * @param oldContext - Current encryption context
 * @param newMasterKey - New master key (derived from new passphrase)
 * @param request - Key rotation request details
 * @returns Promise resolving to rotation result or error
 *
 * @example
 * ```typescript
 * // Rotate keys to revoke user access
 * const rotationResult = await rotateKeys(currentContext, newMasterKey, {
 *   oldMasterKeyId: currentContext.masterKey.id,
 *   reason: 'user_revocation',
 *   revokedUserId: 'user-123',
 *   initiatedAt: Date.now(),
 * });
 * ```
 */
export async function rotateKeys(
  oldContext: EncryptionContext,
  newMasterKey: MasterKey,
  request: KeyRotationRequest
): Promise<CryptoResult<KeyRotationResult>> {
  const startTime = Date.now();

  try {
    // Verify old master key ID matches
    if (request.oldMasterKeyId !== oldContext.masterKey.id) {
      return {
        success: false,
        error: 'Old master key ID mismatch',
        errorCode: 'INVALID_KEY',
      };
    }

    // Derive new keys from new master key
    const newKeysResult = await deriveAllKeys(newMasterKey);

    if (!newKeysResult.success || !newKeysResult.data) {
      return {
        success: false,
        error: newKeysResult.error,
        errorCode: newKeysResult.errorCode,
      };
    }

    const newDerivedKeys = newKeysResult.data;
    const newDerivedKeyIds = Array.from(newDerivedKeys.values()).map(k => k.id);

    // Calculate duration
    const completedAt = Date.now();
    const durationMs = completedAt - startTime;

    // Verify rotation completed within 60 seconds
    if (durationMs > 60000) {
      console.warn(`Key rotation took ${durationMs}ms, exceeding 60s target`);
    }

    const result: KeyRotationResult = {
      newMasterKeyId: newMasterKey.id,
      newDerivedKeyIds,
      completedAt,
      durationMs,
    };

    // Clear old context (revoke access)
    clearEncryptionContext(oldContext);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Key rotation failed',
      errorCode: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Re-encrypt data with new keys after rotation
 *
 * Re-encrypts all data with new keys. Should be done in batches
 * to avoid blocking.
 *
 * @param oldContext - Old encryption context
 * @param newContext - New encryption context (after rotation)
 * @param encryptedData - Array of data to re-encrypt
 * @param permissionLevel - Permission level of the data
 * @returns Promise resolving to re-encrypted data
 *
 * @example
 * ```typescript
 * const reencrypted = await reencryptData(
 *   oldContext,
 *   newContext,
 *   allTransactions,
 *   'manager'
 * );
 * ```
 */
export async function reencryptData(
  oldContext: EncryptionContext,
  newContext: EncryptionContext,
  encryptedData: any[],
  permissionLevel: PermissionLevel
): Promise<CryptoResult<any[]>> {
  try {
    // Get old and new keys
    const oldKeyResult = getKeyForPermission(oldContext, permissionLevel);
    const newKeyResult = getKeyForPermission(newContext, permissionLevel);

    if (!oldKeyResult.success || !oldKeyResult.data) {
      return {
        success: false,
        error: oldKeyResult.error,
        errorCode: oldKeyResult.errorCode,
      };
    }

    if (!newKeyResult.success || !newKeyResult.data) {
      return {
        success: false,
        error: newKeyResult.error,
        errorCode: newKeyResult.errorCode,
      };
    }

    // Re-encrypt all data
    const reencrypted = await Promise.all(
      encryptedData.map(data => reencrypt(data, oldKeyResult.data!, newKeyResult.data!))
    );

    // Check for errors
    const failed = reencrypted.filter(r => !r.success);
    if (failed.length > 0) {
      return {
        success: false,
        error: `Failed to re-encrypt ${failed.length} items`,
        errorCode: 'UNKNOWN_ERROR',
      };
    }

    const reencryptedData = reencrypted
      .filter(r => r.success && r.data)
      .map(r => r.data);

    return {
      success: true,
      data: reencryptedData,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Re-encryption failed',
      errorCode: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Store encrypted key metadata in IndexedDB
 *
 * Per ARCH-001: Keys are stored encrypted in IndexedDB.
 * This function stores the metadata only; the actual encryption
 * of key material should be done with a user-specific password.
 *
 * @param key - Master or derived key to store
 * @param encryptedKeyMaterial - Key material encrypted with user password
 * @returns Key storage metadata
 *
 * @example
 * ```typescript
 * // Encrypt key material with user password
 * const encrypted = await encrypt(
 *   masterKey.keyMaterial,
 *   passwordDerivedKey
 * );
 * const metadata = createKeyStorageMetadata(masterKey, encrypted);
 * await saveToIndexedDB(metadata);
 * ```
 */
export function createKeyStorageMetadata(
  key: MasterKey | DerivedKey,
  encryptedKeyMaterial: string
): KeyStorageMetadata {
  const keyType = 'keyMaterial' in key && 'derivationParams' in key ? 'master' : 'derived';
  const permissionLevel = keyType === 'derived' ? (key as DerivedKey).permissionLevel : undefined;

  return {
    keyId: key.id,
    keyType,
    permissionLevel,
    encryptedKeyMaterial,
    createdAt: key.createdAt,
    expiresAt: key.expiresAt,
    isActive: true,
  };
}

/**
 * Check if any keys need rotation
 *
 * Checks if keys are expired or approaching expiration.
 *
 * @param context - Encryption context to check
 * @param warningThresholdMs - Warn if expiring within this time (default 7 days)
 * @returns Rotation recommendation
 *
 * @example
 * ```typescript
 * const check = checkKeyRotationNeeded(context);
 * if (check.needsRotation) {
 *   console.warn('Keys need rotation:', check.reason);
 * }
 * ```
 */
export function checkKeyRotationNeeded(
  context: EncryptionContext,
  warningThresholdMs: number = 7 * 24 * 60 * 60 * 1000 // 7 days
): {
  needsRotation: boolean;
  reason?: string;
  urgency: 'none' | 'warning' | 'urgent' | 'critical';
} {
  const now = Date.now();

  // Check master key expiration
  if (context.masterKey.expiresAt) {
    if (now > context.masterKey.expiresAt) {
      return {
        needsRotation: true,
        reason: 'Master key has expired',
        urgency: 'critical',
      };
    }

    const timeToExpiry = context.masterKey.expiresAt - now;
    if (timeToExpiry < warningThresholdMs) {
      return {
        needsRotation: true,
        reason: `Master key expires soon (${Math.floor(timeToExpiry / (24 * 60 * 60 * 1000))} days)`,
        urgency: timeToExpiry < 24 * 60 * 60 * 1000 ? 'urgent' : 'warning',
      };
    }
  }

  // Check derived keys
  for (const [level, key] of context.derivedKeys) {
    if (key.expiresAt && now > key.expiresAt) {
      return {
        needsRotation: true,
        reason: `${level} key has expired`,
        urgency: 'critical',
      };
    }
  }

  return {
    needsRotation: false,
    urgency: 'none',
  };
}

/**
 * Export keys for backup (encrypted)
 *
 * Exports encryption context keys in an encrypted format for backup.
 * The backup is encrypted with a backup passphrase.
 *
 * @param context - Encryption context to backup
 * @param backupKey - Key derived from backup passphrase
 * @returns Promise resolving to encrypted backup
 *
 * @example
 * ```typescript
 * const backupKeyResult = await deriveMasterKey(backupPassphrase);
 * if (backupKeyResult.success && backupKeyResult.data) {
 *   const backup = await exportKeysForBackup(context, backupKeyResult.data);
 *   await saveBackup(backup);
 * }
 * ```
 */
export async function exportKeysForBackup(
  context: EncryptionContext,
  backupKey: MasterKey
): Promise<CryptoResult<string>> {
  try {
    const exportData = {
      masterKeyId: context.masterKey.id,
      sessionId: context.sessionId,
      derivedKeyIds: Array.from(context.derivedKeys.keys()),
      exportedAt: Date.now(),
    };

    const encryptResult = await encrypt(JSON.stringify(exportData), backupKey);

    if (!encryptResult.success || !encryptResult.data) {
      return {
        success: false,
        error: encryptResult.error,
        errorCode: encryptResult.errorCode,
      };
    }

    // Serialize for storage
    const serialized = JSON.stringify(encryptResult.data);

    return {
      success: true,
      data: serialized,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Key export failed',
      errorCode: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Get permission hierarchy
 *
 * Returns the permission levels in order from most to least privileged.
 *
 * @returns Permission hierarchy array
 */
export function getPermissionHierarchy(): PermissionLevel[] {
  return [...PERMISSION_HIERARCHY];
}
