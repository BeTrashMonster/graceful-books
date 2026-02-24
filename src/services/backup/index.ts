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
