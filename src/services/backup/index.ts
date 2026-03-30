/**
 * Backup Module Exports
 *
 * Central export point for encrypted backup functionality
 */

export { BackupService } from './backupService';
export type {
  EncryptedBackup,
  BackupResult,
  RestoreResult,
  BackupValidationResult,
} from './backupService';

export { RoleFilterService } from './RoleFilterService';
export type {
  UserRole,
  DataType,
  FilteredBackupData,
} from './RoleFilterService';

export {
  incrementKeyRotationEpoch,
  getCurrentEpoch,
  verifyKeyRotationEpoch,
  initializeKeyRotationEpoch,
} from './KeyRotationService';
export type {
  EpochVerificationResult,
} from './KeyRotationService';

export {
  deriveHmacKey,
  generateBackupHMAC,
  verifyBackupIntegrity,
  constantTimeCompare,
  generateHmacSalt,
  createSecureBackupBundle,
} from './IntegrityVerification';
export type {
  SecureBackupBundle,
  HMACGenerationResult,
  IntegrityVerificationResult,
} from './IntegrityVerification';
