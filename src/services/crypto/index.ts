/**
 * Crypto Services for Backup & Sync Architecture
 *
 * This module provides cryptographic utilities for secure backup
 * bundle creation and restoration.
 *
 * @module services/crypto
 */

export {
  derivePasswordKey,
  generateSalt,
  detectBestAlgorithm,
  rederiveKey,
  verifyPassword,
  clearSensitiveData,
  benchmarkPerformance,
  type KeyDerivationConfig,
  type DerivedKeyResult,
} from './KeyDerivation';
