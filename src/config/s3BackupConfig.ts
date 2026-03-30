/**
 * S3 Backup Storage Configuration
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 3, Task 3.2 (Chunk 3C):
 * Configuration and validation for AWS S3 backup storage.
 *
 * This module provides:
 * - TypeScript interfaces for S3 configuration
 * - Environment variable parsing and validation
 * - Configuration validation utilities
 * - Secure defaults
 *
 * Usage:
 * ```typescript
 * import { getS3BackupConfig, validateS3Config } from './config/s3BackupConfig';
 *
 * const config = getS3BackupConfig();
 * const validation = validateS3Config(config);
 *
 * if (!validation.valid) {
 *   console.error('Invalid S3 configuration:', validation.errors);
 * }
 * ```
 */

/**
 * S3 Backup Configuration Interface
 */
export interface S3BackupConfig {
  // AWS Configuration
  region: string
  bucket: string
  kmsKeyId?: string

  // AWS Credentials (prefer IAM roles in production)
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string

  // Backup Settings
  retentionDays: number
  maxSizeMB: number
  enableCompression: boolean
  filePrefix: string

  // Security Settings
  enforceSSL: boolean
  enforceEncryption: boolean
  auditLoggingEnabled: boolean

  // Performance Settings
  uploadPartSizeMB: number
  uploadConcurrency: number
  downloadPartSizeMB: number
  requestTimeoutSeconds: number

  // Monitoring
  cloudWatchLogGroup?: string
  cloudWatchLogStream?: string
  cloudWatchMetricsEnabled: boolean
  snsAlertsTopicArn?: string

  // Development
  debug: boolean
  debugS3Operations: boolean
  useLocalStack: boolean
  localStackEndpoint?: string

  // Cost Optimization
  intelligentTiering: boolean
  transferAcceleration: boolean
}

/**
 * Configuration validation result
 */
export interface S3ConfigValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Default S3 backup configuration
 */
export const DEFAULT_S3_BACKUP_CONFIG: S3BackupConfig = {
  region: 'us-east-1',
  bucket: '',
  retentionDays: 7,
  maxSizeMB: 100,
  enableCompression: true,
  filePrefix: 'backup',
  enforceSSL: true,
  enforceEncryption: true,
  auditLoggingEnabled: true,
  uploadPartSizeMB: 5,
  uploadConcurrency: 4,
  downloadPartSizeMB: 5,
  requestTimeoutSeconds: 60,
  cloudWatchMetricsEnabled: true,
  debug: false,
  debugS3Operations: false,
  useLocalStack: false,
  intelligentTiering: false,
  transferAcceleration: false,
}

/**
 * Get S3 backup configuration from environment variables
 *
 * Reads configuration from process.env and applies defaults.
 * In browser environment, returns default config (backend-only feature).
 *
 * @returns S3 backup configuration
 */
export function getS3BackupConfig(): S3BackupConfig {
  // Check if running in browser (return defaults, backend-only feature)
  if (typeof process === 'undefined' || !process.env) {
    return { ...DEFAULT_S3_BACKUP_CONFIG }
  }

  const env = process.env

  return {
    // AWS Configuration
    region: env.AWS_REGION || DEFAULT_S3_BACKUP_CONFIG.region,
    bucket: env.AWS_S3_BACKUP_BUCKET || DEFAULT_S3_BACKUP_CONFIG.bucket,
    kmsKeyId: env.AWS_S3_BACKUP_KMS_KEY_ID,

    // AWS Credentials
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,

    // Backup Settings
    retentionDays: parseInt(env.BACKUP_RETENTION_DAYS || '7', 10),
    maxSizeMB: parseInt(env.BACKUP_MAX_SIZE_MB || '100', 10),
    enableCompression: env.BACKUP_ENABLE_COMPRESSION !== 'false',
    filePrefix: env.BACKUP_FILE_PREFIX || DEFAULT_S3_BACKUP_CONFIG.filePrefix,

    // Security Settings
    enforceSSL: env.S3_ENFORCE_SSL !== 'false',
    enforceEncryption: env.S3_ENFORCE_ENCRYPTION !== 'false',
    auditLoggingEnabled: env.BACKUP_AUDIT_LOGGING_ENABLED !== 'false',

    // Performance Settings
    uploadPartSizeMB: parseInt(env.S3_UPLOAD_PART_SIZE_MB || '5', 10),
    uploadConcurrency: parseInt(env.S3_UPLOAD_CONCURRENCY || '4', 10),
    downloadPartSizeMB: parseInt(env.S3_DOWNLOAD_PART_SIZE_MB || '5', 10),
    requestTimeoutSeconds: parseInt(env.S3_REQUEST_TIMEOUT_SECONDS || '60', 10),

    // Monitoring
    cloudWatchLogGroup: env.CLOUDWATCH_LOG_GROUP,
    cloudWatchLogStream: env.CLOUDWATCH_LOG_STREAM,
    cloudWatchMetricsEnabled: env.CLOUDWATCH_METRICS_ENABLED !== 'false',
    snsAlertsTopicArn: env.SNS_BACKUP_ALERTS_TOPIC_ARN,

    // Development
    debug: env.DEBUG_BACKUP_SERVICE === 'true',
    debugS3Operations: env.DEBUG_S3_OPERATIONS === 'true',
    useLocalStack: env.USE_LOCALSTACK === 'true',
    localStackEndpoint: env.LOCALSTACK_S3_ENDPOINT,

    // Cost Optimization
    intelligentTiering: env.S3_INTELLIGENT_TIERING === 'true',
    transferAcceleration: env.S3_TRANSFER_ACCELERATION === 'true',
  }
}

/**
 * Validate S3 backup configuration
 *
 * Checks for required fields, valid values, and security best practices.
 *
 * @param config - S3 backup configuration to validate
 * @returns Validation result with errors and warnings
 */
export function validateS3Config(config: S3BackupConfig): S3ConfigValidation {
  const errors: string[] = []
  const warnings: string[] = []

  // Required fields
  if (!config.region) {
    errors.push('AWS region is required')
  }

  if (!config.bucket) {
    errors.push('S3 bucket name is required')
  }

  // Bucket naming validation
  if (config.bucket) {
    if (config.bucket.length < 3 || config.bucket.length > 63) {
      errors.push('S3 bucket name must be between 3 and 63 characters')
    }

    if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(config.bucket)) {
      errors.push(
        'S3 bucket name must start and end with lowercase letter or number, and contain only lowercase letters, numbers, hyphens, and dots'
      )
    }

    if (config.bucket.includes('..')) {
      errors.push('S3 bucket name cannot contain consecutive dots')
    }

    if (/^\d+\.\d+\.\d+\.\d+$/.test(config.bucket)) {
      errors.push('S3 bucket name cannot be formatted as an IP address')
    }
  }

  // Credentials validation
  if (!config.useLocalStack && !config.accessKeyId && !config.secretAccessKey) {
    warnings.push(
      'No AWS credentials provided. Ensure IAM role is configured in production.'
    )
  }

  if (config.accessKeyId && !config.secretAccessKey) {
    errors.push('AWS secret access key is required when access key ID is provided')
  }

  if (!config.accessKeyId && config.secretAccessKey) {
    errors.push('AWS access key ID is required when secret access key is provided')
  }

  // Security settings
  if (!config.enforceSSL) {
    warnings.push(
      'SSL enforcement is disabled. This is insecure and not recommended for production.'
    )
  }

  if (!config.enforceEncryption) {
    warnings.push(
      'Encryption enforcement is disabled. This is insecure and not recommended for production.'
    )
  }

  if (!config.kmsKeyId && config.enforceEncryption) {
    warnings.push(
      'KMS key ID not provided. Server-side encryption will use default S3 encryption.'
    )
  }

  if (!config.auditLoggingEnabled) {
    warnings.push(
      'Audit logging is disabled. Enable for production environments to track all backup operations.'
    )
  }

  // Numeric value ranges
  if (config.retentionDays < 1 || config.retentionDays > 365) {
    errors.push('Retention days must be between 1 and 365')
  }

  if (config.maxSizeMB < 1 || config.maxSizeMB > 5000) {
    errors.push('Max backup size must be between 1 MB and 5000 MB')
  }

  if (config.uploadPartSizeMB < 5 || config.uploadPartSizeMB > 100) {
    warnings.push('Upload part size should be between 5 MB and 100 MB for optimal performance')
  }

  if (config.uploadConcurrency < 1 || config.uploadConcurrency > 10) {
    warnings.push('Upload concurrency should be between 1 and 10 for optimal performance')
  }

  if (config.requestTimeoutSeconds < 10 || config.requestTimeoutSeconds > 600) {
    warnings.push('Request timeout should be between 10 and 600 seconds')
  }

  // LocalStack configuration
  if (config.useLocalStack && !config.localStackEndpoint) {
    errors.push('LocalStack endpoint is required when useLocalStack is enabled')
  }

  if (config.useLocalStack && config.localStackEndpoint) {
    try {
      new URL(config.localStackEndpoint)
    } catch {
      errors.push('LocalStack endpoint must be a valid URL')
    }
  }

  // CloudWatch configuration
  if (config.cloudWatchMetricsEnabled && !config.cloudWatchLogGroup) {
    warnings.push(
      'CloudWatch metrics enabled but no log group specified. Metrics may not be collected.'
    )
  }

  // Cost optimization warnings
  if (config.transferAcceleration) {
    warnings.push(
      'S3 Transfer Acceleration is enabled. This adds cost but improves upload/download speed.'
    )
  }

  if (config.retentionDays > 30) {
    warnings.push(
      `Retention period is ${config.retentionDays} days. Consider shorter retention to reduce storage costs.`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Get user-friendly error message for S3 configuration issues
 *
 * @param validation - Validation result
 * @returns Formatted error message
 */
export function getS3ConfigErrorMessage(validation: S3ConfigValidation): string {
  if (validation.valid) {
    if (validation.warnings.length > 0) {
      return `Configuration valid with ${validation.warnings.length} warning(s):\n${validation.warnings.map((w) => `- ${w}`).join('\n')}`
    }
    return 'Configuration is valid'
  }

  let message = `S3 configuration has ${validation.errors.length} error(s):\n`
  message += validation.errors.map((e) => `- ${e}`).join('\n')

  if (validation.warnings.length > 0) {
    message += `\n\nWarnings:\n${validation.warnings.map((w) => `- ${w}`).join('\n')}`
  }

  return message
}

/**
 * Check if running in production environment
 *
 * @returns True if NODE_ENV is production
 */
export function isProduction(): boolean {
  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'production'
}

/**
 * Check if S3 backup is properly configured for production
 *
 * More strict validation for production environments.
 *
 * @param config - S3 backup configuration
 * @returns True if production-ready
 */
export function isProductionReady(config: S3BackupConfig): boolean {
  const validation = validateS3Config(config)

  if (!validation.valid) {
    return false
  }

  // Production requirements
  const productionChecks = [
    config.enforceSSL,
    config.enforceEncryption,
    config.auditLoggingEnabled,
    config.kmsKeyId !== undefined,
    config.cloudWatchMetricsEnabled,
    !config.debug,
    !config.useLocalStack,
    config.retentionDays <= 30, // Cost optimization
  ]

  return productionChecks.every((check) => check)
}

/**
 * Log configuration status
 *
 * Logs configuration details for debugging (sanitizes sensitive info).
 *
 * @param config - S3 backup configuration
 */
export function logConfigStatus(config: S3BackupConfig): void {
  const validation = validateS3Config(config)

  console.log('[S3BackupConfig] Configuration Status:')
  console.log(`  Valid: ${validation.valid ? '✓' : '✗'}`)
  console.log(`  Region: ${config.region}`)
  console.log(`  Bucket: ${config.bucket}`)
  console.log(`  KMS Key: ${config.kmsKeyId ? 'Configured' : 'Not configured'}`)
  console.log(`  Credentials: ${config.accessKeyId ? 'Access Key' : 'IAM Role'}`)
  console.log(`  SSL Enforced: ${config.enforceSSL ? '✓' : '✗'}`)
  console.log(`  Encryption Enforced: ${config.enforceEncryption ? '✓' : '✗'}`)
  console.log(`  Audit Logging: ${config.auditLoggingEnabled ? '✓' : '✗'}`)
  console.log(`  Retention Days: ${config.retentionDays}`)
  console.log(`  LocalStack: ${config.useLocalStack ? 'Enabled' : 'Disabled'}`)

  if (validation.errors.length > 0) {
    console.error(`[S3BackupConfig] Errors (${validation.errors.length}):`)
    validation.errors.forEach((error) => console.error(`  - ${error}`))
  }

  if (validation.warnings.length > 0) {
    console.warn(`[S3BackupConfig] Warnings (${validation.warnings.length}):`)
    validation.warnings.forEach((warning) => console.warn(`  - ${warning}`))
  }

  if (isProduction() && !isProductionReady(config)) {
    console.error('[S3BackupConfig] ⚠️  Configuration is NOT production-ready!')
  }
}
