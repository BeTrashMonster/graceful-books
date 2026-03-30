/**
 * Backup Preferences Schema
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 2:
 * Stores user preferences for local filesystem backups including:
 * - Backup location (directory handle reference)
 * - Automatic backup settings
 * - Backup frequency preferences
 * - Last backup timestamp
 *
 * Features:
 * - Per-user backup configuration
 * - File System Access API handle storage
 * - Backup schedule preferences
 * - Integration with Phase 2, Task 2.1 (FileSystemBackup service)
 */

/**
 * Backup preferences entity
 * Stores configuration for local filesystem backups per user
 */
export interface BackupPreference {
  id: string
  user_id: string
  company_id: string

  // Backup location
  backup_directory_path: string | null // Display path (e.g., "Documents/AudaciousBackups")
  backup_directory_handle_key: string | null // IndexedDB key where FileSystemDirectoryHandle is stored

  // Backup settings
  auto_backup_enabled: boolean // Whether automatic backups are enabled
  backup_on_change: boolean // Backup when data changes (debounced)
  backup_on_idle: boolean // Backup when user is idle
  backup_on_close: boolean // Backup when app closes
  daily_backup_enabled: boolean // Daily scheduled backup

  // Backup metadata
  last_backup_at: number | null // Unix timestamp of last successful backup
  last_backup_size: number | null // Size of last backup in bytes
  backup_count: number // Total number of backups created
  last_backup_error: string | null // Last error message, if any

  // User preferences
  show_backup_notifications: boolean // Show success/error notifications
  backup_retention_days: number // How many days to keep backups (default: 30)

  // Timestamps
  created_at: number
  updated_at: number
}

/**
 * Dexie schema for backup preferences
 * Indexes: user_id, company_id, [user_id+company_id] for lookups
 */
export const backupPreferencesSchema =
  'id, user_id, company_id, [user_id+company_id], updated_at, last_backup_at'

/**
 * Create default backup preference for a user
 *
 * @param userId - User ID
 * @param companyId - Company ID
 * @returns Default backup preference object
 */
export function createDefaultBackupPreference(
  userId: string,
  companyId: string
): Omit<BackupPreference, 'id'> {
  const now = Date.now()
  return {
    user_id: userId,
    company_id: companyId,

    // Backup location - null until user chooses
    backup_directory_path: null,
    backup_directory_handle_key: null,

    // Backup settings - recommended defaults
    auto_backup_enabled: true, // Enable by default once location is set
    backup_on_change: true, // Backup when data changes (debounced)
    backup_on_idle: true, // Backup when user is idle
    backup_on_close: true, // Backup when app closes
    daily_backup_enabled: true, // Daily scheduled backup

    // Backup metadata
    last_backup_at: null,
    last_backup_size: null,
    backup_count: 0,
    last_backup_error: null,

    // User preferences
    show_backup_notifications: true, // Show success/error notifications
    backup_retention_days: 30, // Keep 30 days of daily backups

    // Timestamps
    created_at: now,
    updated_at: now,
  }
}

/**
 * Backup status summary for UI display
 */
export interface BackupStatus {
  isConfigured: boolean // Has user chosen a backup location?
  isEnabled: boolean // Are automatic backups enabled?
  lastBackupAt: Date | null // Last successful backup timestamp
  lastBackupSize: number | null // Last backup size in bytes
  backupCount: number // Total backups created
  lastError: string | null // Last error message
  directoryPath: string | null // Display path for user
}

/**
 * Get backup status from preferences
 *
 * @param preference - Backup preference object
 * @returns User-friendly backup status
 */
export function getBackupStatus(preference: BackupPreference | null): BackupStatus {
  if (!preference) {
    return {
      isConfigured: false,
      isEnabled: false,
      lastBackupAt: null,
      lastBackupSize: null,
      backupCount: 0,
      lastError: null,
      directoryPath: null,
    }
  }

  return {
    isConfigured: preference.backup_directory_handle_key !== null,
    isEnabled: preference.auto_backup_enabled,
    lastBackupAt: preference.last_backup_at ? new Date(preference.last_backup_at) : null,
    lastBackupSize: preference.last_backup_size,
    backupCount: preference.backup_count,
    lastError: preference.last_backup_error,
    directoryPath: preference.backup_directory_path,
  }
}

/**
 * Format backup size for display
 *
 * @param bytes - Size in bytes
 * @returns Formatted size string (e.g., "1.5 MB")
 */
export function formatBackupSize(bytes: number | null): string {
  if (bytes === null) return 'Unknown'

  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Format last backup time for display
 * Uses Steadiness communication style (patient, reassuring)
 *
 * @param date - Last backup date
 * @returns User-friendly time string
 */
export function formatLastBackupTime(date: Date | null): string {
  if (!date) return 'Never'

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? '' : 's'} ago`

  return date.toLocaleDateString()
}
