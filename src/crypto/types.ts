/**
 * Type definitions for the encryption layer
 *
 * Implements zero-knowledge encryption architecture per ARCH-001
 * and hierarchical key management per ARCH-002.
 */

/**
 * Permission levels in the key hierarchy
 *
 * Defines the access levels for derived keys:
 * - admin: Full access to all data and operations
 * - manager: Edit access to financial data
 * - user: Basic access to own transactions
 * - consultant: View-only access
 * - accountant: View and export capabilities
 */
export type PermissionLevel = 'admin' | 'manager' | 'user' | 'consultant' | 'accountant';

/**
 * Key derivation parameters for Argon2id
 *
 * Based on ARCH-002 requirements:
 * - Memory: 64 MB minimum
 * - Iterations: 3 minimum (adjusted based on device performance)
 * - Parallelism: 4 threads
 * - Output: 256-bit key
 */
export interface KeyDerivationParams {
  /** Memory cost in KB (minimum 65536 = 64 MB) */
  memoryCost: number;
  /** Number of iterations (minimum 3) */
  timeCost: number;
  /** Degree of parallelism (default 4) */
  parallelism: number;
  /** Salt for key derivation (128-bit minimum) */
  salt: Uint8Array;
  /** Output key length in bytes (32 = 256 bits) */
  keyLength: number;
}

/**
 * Master encryption key derived from user passphrase
 *
 * Per ARCH-001: The master key is derived using Argon2id and
 * stored encrypted in the local device only. Never transmitted
 * in unencrypted form.
 */
export interface MasterKey {
  /** Unique identifier for this master key */
  id: string;
  /** The actual 256-bit key material */
  keyMaterial: Uint8Array;
  /** Derivation parameters used to generate this key */
  derivationParams: KeyDerivationParams;
  /** Timestamp when key was created */
  createdAt: number;
  /** Optional timestamp when key should be rotated */
  expiresAt?: number;
}

/**
 * Derived key for a specific permission level
 *
 * Per ARCH-002: Derived keys are generated for different permission
 * levels and encrypted with the user's password. Only encrypted
 * derived keys are transmitted.
 */
export interface DerivedKey {
  /** Unique identifier for this derived key */
  id: string;
  /** Reference to the master key this was derived from */
  masterKeyId: string;
  /** Permission level this key grants */
  permissionLevel: PermissionLevel;
  /** The actual key material for this permission level */
  keyMaterial: Uint8Array;
  /** Timestamp when key was created */
  createdAt: number;
  /** Optional timestamp when key should be rotated */
  expiresAt?: number;
}

/**
 * Encrypted data envelope
 *
 * Per ARCH-001: All data is encrypted using AES-256-GCM with:
 * - 96-bit IV/nonce (randomly generated per operation)
 * - 128-bit authentication tag
 * - Encrypted payload
 */
export interface EncryptedData {
  /** The encrypted ciphertext */
  ciphertext: Uint8Array;
  /** Initialization vector (nonce) - 96 bits for GCM */
  iv: Uint8Array;
  /** Authentication tag - 128 bits for GCM */
  authTag: Uint8Array;
  /** ID of the key used for encryption */
  keyId: string;
  /** Algorithm identifier (always 'AES-256-GCM') */
  algorithm: 'AES-256-GCM';
  /** Timestamp when encrypted */
  encryptedAt: number;
}

/**
 * Serialized encrypted data for storage/transmission
 *
 * Base64-encoded version of EncryptedData for JSON serialization
 */
export interface SerializedEncryptedData {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded IV */
  iv: string;
  /** Base64-encoded auth tag */
  authTag: string;
  /** ID of the key used for encryption */
  keyId: string;
  /** Algorithm identifier */
  algorithm: 'AES-256-GCM';
  /** Timestamp when encrypted */
  encryptedAt: number;
}

/**
 * Key rotation request
 *
 * Per ARCH-002: Key rotation is used to revoke access and must
 * complete within 60 seconds for active sessions.
 */
export interface KeyRotationRequest {
  /** ID of the old master key being rotated */
  oldMasterKeyId: string;
  /** Reason for rotation */
  reason: 'scheduled' | 'security_incident' | 'user_revocation';
  /** Optional user ID if rotation is for access revocation */
  revokedUserId?: string;
  /** Timestamp when rotation was initiated */
  initiatedAt: number;
}

/**
 * Key rotation result
 */
export interface KeyRotationResult {
  /** ID of the new master key */
  newMasterKeyId: string;
  /** IDs of new derived keys */
  newDerivedKeyIds: string[];
  /** Timestamp when rotation completed */
  completedAt: number;
  /** Duration in milliseconds (must be < 60000) */
  durationMs: number;
}

/**
 * Passphrase validation result
 *
 * Per TECH-003: Validates passphrase strength based on NIST 800-63B
 */
export interface PassphraseValidationResult {
  /** Whether the passphrase meets minimum requirements */
  isValid: boolean;
  /** Calculated entropy in bits */
  entropy: number;
  /** Number of characters */
  length: number;
  /** Number of words (if passphrase-style) */
  wordCount?: number;
  /** User-friendly error message if invalid */
  errorMessage?: string;
  /** Suggestions for improving passphrase */
  suggestions?: string[];
}

/**
 * Key storage metadata
 *
 * Metadata for keys stored in IndexedDB (keys themselves are encrypted)
 */
export interface KeyStorageMetadata {
  /** Key identifier */
  keyId: string;
  /** Type of key */
  keyType: 'master' | 'derived';
  /** Permission level (for derived keys) */
  permissionLevel?: PermissionLevel;
  /** Encrypted key material (as base64) */
  encryptedKeyMaterial: string;
  /** When key was created */
  createdAt: number;
  /** When key expires */
  expiresAt?: number;
  /** Whether key is currently active */
  isActive: boolean;
}

/**
 * Encryption context for a session
 *
 * Holds active keys in memory during a user session.
 * Per ARCH-001: Session keys are in memory only, cleared on logout.
 */
export interface EncryptionContext {
  /** Active master key */
  masterKey: MasterKey;
  /** Active derived keys by permission level */
  derivedKeys: Map<PermissionLevel, DerivedKey>;
  /** Session identifier */
  sessionId: string;
  /** When session started */
  sessionStartedAt: number;
}

/**
 * Crypto operation result
 *
 * Generic result type for cryptographic operations
 */
export interface CryptoResult<T> {
  /** Whether operation succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Error code for programmatic handling */
  errorCode?: 'INVALID_KEY' | 'DECRYPTION_FAILED' | 'WEAK_PASSPHRASE' | 'KEY_EXPIRED' | 'UNKNOWN_ERROR';
}
