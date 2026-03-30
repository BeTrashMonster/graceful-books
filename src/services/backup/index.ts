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

export {
  generateBackupFilename,
  parseBackupFilename,
  isValidBackupFilename,
  isMidnightBackup,
  getDateKey,
  createBackupMetadata,
  analyzeBackupRetention,
  getBackupStatistics,
  formatBytes,
  validateRetentionPolicy,
  classifyBackupType,
  DEFAULT_RETENTION_POLICY,
  BACKUP_FILENAME_PREFIX,
  BACKUP_FILENAME_EXTENSION,
  BACKUP_FILENAME_REGEX,
  BackupFileType,
} from './BackupVersioning';
export type {
  BackupFileMetadata,
  RetentionPolicy,
  CleanupResult,
} from './BackupVersioning';

export {
  restoreFromLocalBackup,
  readBackupFile,
  validateBundleStructure,
  isDatabaseEmpty,
  autoDetectBackups,
  getRestorationErrorMessage,
  formatBackupInfo,
  formatFileSize,
  isRestorationSupported,
  RestorationStage,
} from './BackupRestoration';
export type {
  RestorationProgress,
  RestoreFromBackupOptions,
  RestorationResult,
  BackupDetectionResult,
  BackupInfo,
  DatabaseEmptyCheckResult,
} from './BackupRestoration';

export {
  BackupFallback,
  detectBackupCapabilities,
  createManualBackupDownload,
  restoreFromManualUpload,
  getUnsupportedBrowserNotification,
  getBrowserRecommendationMessage,
  isAutomaticBackupSupported,
  validateBackupFile,
  getFriendlyBackupErrorMessage,
} from './BackupFallback';
export type {
  BrowserCapabilities,
  BackupMethod,
  BackupCapabilityResult,
  ManualDownloadOptions,
  ManualUploadOptions,
  UnsupportedBrowserNotification,
} from './BackupFallback';

export {
  BackupScheduler,
  BackupTriggerType,
  createBackupScheduler,
  getTimeUntilNextDailyBackup,
  formatTimeDuration,
} from './BackupScheduler';
export type {
  BackupSchedulerConfig,
  BackupResult as SchedulerBackupResult,
} from './BackupScheduler';

export {
  RestorationTokenService,
  restorationTokenService,
  generateRestorationUrl,
  parseRestorationUrl,
  isValidRestorationUrl,
} from './RestorationTokenService';
export type {
  GenerateTokenResult,
  ValidateTokenResult,
  UseTokenResult,
} from './RestorationTokenService';

export {
  S3BackupUploadService,
  createS3BackupUploadService,
} from './S3BackupUpload';
export type {
  UploadBackupOptions,
  UploadBackupResult,
  UploadProgress,
} from './S3BackupUpload';
