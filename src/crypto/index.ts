/**
 * Graceful Books Encryption Layer
 *
 * Zero-knowledge encryption architecture implementing ARCH-001 and ARCH-002.
 *
 * This module provides:
 * - AES-256-GCM encryption/decryption
 * - Argon2id key derivation from passphrases
 * - Hierarchical key management
 * - Passphrase strength validation
 *
 * @example Basic Usage
 * ```typescript
 * import {
 *   deriveMasterKey,
 *   createEncryptionContext,
 *   encrypt,
 *   decrypt,
 *   validatePassphrase,
 * } from '@/crypto';
 *
 * // 1. Validate passphrase
 * const validation = validatePassphrase('correct horse battery staple');
 * if (!validation.isValid) {
 *   console.error(validation.errorMessage);
 *   return;
 * }
 *
 * // 2. Derive master key from passphrase
 * const masterKeyResult = await deriveMasterKey('correct horse battery staple');
 * if (!masterKeyResult.success || !masterKeyResult.data) {
 *   console.error(masterKeyResult.error);
 *   return;
 * }
 *
 * // 3. Create encryption context
 * const contextResult = await createEncryptionContext(
 *   masterKeyResult.data,
 *   'session-123'
 * );
 * if (!contextResult.success || !contextResult.data) {
 *   console.error(contextResult.error);
 *   return;
 * }
 *
 * // 4. Encrypt data
 * const encryptResult = await encrypt(
 *   'sensitive financial data',
 *   contextResult.data.masterKey
 * );
 * if (!encryptResult.success || !encryptResult.data) {
 *   console.error(encryptResult.error);
 *   return;
 * }
 *
 * // 5. Decrypt data
 * const decryptResult = await decrypt(
 *   encryptResult.data,
 *   contextResult.data.masterKey
 * );
 * if (decryptResult.success && decryptResult.data) {
 *   console.log('Decrypted:', decryptResult.data);
 * }
 * ```
 *
 * @module crypto
 */

// Export all types
export type {
  // Permission and key types
  PermissionLevel,
  MasterKey,
  DerivedKey,
  EncryptedData,
  SerializedEncryptedData,

  // Key management types
  KeyDerivationParams,
  EncryptionContext,
  KeyRotationRequest,
  KeyRotationResult,
  KeyStorageMetadata,

  // Validation types
  PassphraseValidationResult,

  // Result type
  CryptoResult,
} from './types';

// Export encryption functions
export {
  encrypt,
  decrypt,
  decryptToBytes,
  encryptObject,
  decryptObject,
  reencrypt,
  batchEncrypt,
  batchDecrypt,
  verifyIntegrity,
  serializeEncryptedData,
  deserializeEncryptedData,
} from './encryption';

// Export key derivation functions
export {
  deriveMasterKey,
  rederiveMasterKey,
  verifyPassphrase,
  generateSalt,
  benchmarkAndAdjustParams,
  clearSensitiveData,
  clearMasterKey,
} from './keyDerivation';

// Export key management functions
export {
  deriveKey,
  deriveAllKeys,
  createEncryptionContext,
  clearEncryptionContext,
  getKeyForPermission,
  hasPermission,
  rotateKeys,
  reencryptData,
  createKeyStorageMetadata,
  checkKeyRotationNeeded,
  exportKeysForBackup,
  getPermissionHierarchy,
} from './keyManagement';

// Export passphrase validation functions
export {
  validatePassphrase,
  validatePassphraseDetailed,
  calculateEntropy,
  isWordBased,
  getStrengthFeedback,
  estimateCrackTime,
  detectWeakPatterns,
  generatePassphraseSuggestion,
} from './passphraseValidation';

// Export encryption service interface and factory
export type { IEncryptionService } from './service';
export {
  createEncryptionService,
  NoOpEncryptionService,
  type EncryptionContext as EncryptionServiceContext,
} from './service';
