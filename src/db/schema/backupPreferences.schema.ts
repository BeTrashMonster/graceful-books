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
 * Passphrase mode for encrypted backups
 * - 'none': Not configured yet (first backup)
 * - 'auto': Random 256-bit key stored in backup folder (authoritative) + IndexedDB (fallback)
 * - 'manual': User-provided passphrase verified via encrypted sentinel
 */
export type PassphraseMode = 'none' | 'auto' | 'manual'

/**
 * Backup preferences entity
 * Stores configuration for local filesystem backups per user
 *
 * SECURITY NOTES:
 * - Manual mode: We NEVER store the passphrase. Instead we store an encrypted sentinel
 *   that we decrypt to verify the passphrase is correct.
 * - Auto mode: The auto_key in IndexedDB is a FALLBACK. The authoritative copy lives
 *   in the backup folder so the key travels with the files it opens.
 */
export interface BackupPreference {
  id: string
  user_id: string
  company_id: string

  // Backup location
  backup_directory_path: string | null // Display path (e.g., "Documents/AudaciousBackups")
  backup_directory_handle_key: string | null // IndexedDB key where FileSystemDirectoryHandle is stored

  // Passphrase/Encryption settings
  passphrase_mode: PassphraseMode // How backups are encrypted

  // Manual mode: Sentinel for passphrase verification (NOT the passphrase itself!)
  // We encrypt a known string with the derived key. On subsequent backups,
  // user enters passphrase, we derive key, try to decrypt sentinel.
  // If decryption succeeds → passphrase is correct.
  sentinel_ciphertext: string | null // Base64-encoded encrypted sentinel
  sentinel_iv: string | null // Base64-encoded IV used for sentinel encryption
  sentinel_salt: string | null // Base64-encoded salt used for key derivation

  // Auto mode: Random 256-bit key (base64-encoded)
  // IMPORTANT: This is a FALLBACK copy. The authoritative copy is in the backup folder.
  auto_key: string | null // Base64-encoded 256-bit random key

  passphrase_configured_at: number | null // When passphrase was first configured

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

    // Passphrase/Encryption settings - not configured initially
    passphrase_mode: 'none',
    sentinel_ciphertext: null,
    sentinel_iv: null,
    sentinel_salt: null,
    auto_key: null,
    passphrase_configured_at: null,

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
 * Generate a random backup key for auto mode
 * Creates a 256-bit (32 byte) cryptographically secure random key, base64-encoded.
 *
 * SECURITY: Uses crypto.getRandomValues for true 256-bit entropy.
 * The base64 encoding is just for storage/display - the underlying key is 32 random bytes.
 */
export function generateAutoBackupKey(): string {
  const keyBytes = new Uint8Array(32) // 256 bits
  crypto.getRandomValues(keyBytes)
  // Convert to base64 for storage (44 chars for 32 bytes)
  return btoa(String.fromCharCode(...keyBytes))
}

/**
 * Generate a short fingerprint of a key for logging.
 * SECURITY: This is a one-way hash - the key cannot be recovered from the fingerprint.
 * Used to verify the same key is being used across different code paths.
 *
 * @param key - The encryption key (base64 or raw string)
 * @returns First 8 characters of SHA-256 hash (e.g., "a1b2c3d4")
 */
export async function getKeyFingerprint(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex.substring(0, 8)
}

/**
 * Known sentinel value that we encrypt with the derived key.
 * On passphrase verification, we decrypt this and check if it matches.
 */
export const SENTINEL_PLAINTEXT = 'GRACEFUL_BOOKS_BACKUP_SENTINEL_V1'

/**
 * Create an encrypted sentinel from a passphrase.
 * Used to verify the passphrase on subsequent backups without storing it.
 *
 * @param passphrase - The user's passphrase
 * @returns Object containing ciphertext, iv, and salt (all base64-encoded)
 */
export async function createPassphraseSentinel(passphrase: string): Promise<{
  ciphertext: string
  iv: string
  salt: string
}> {
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Derive key from passphrase using PBKDF2
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )

  // Encrypt the sentinel
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(SENTINEL_PLAINTEXT)
  )

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
  }
}

/**
 * Verify a passphrase by trying to decrypt the sentinel.
 *
 * @param passphrase - The passphrase to verify
 * @param ciphertext - Base64-encoded ciphertext
 * @param iv - Base64-encoded IV
 * @param salt - Base64-encoded salt
 * @returns True if passphrase is correct, false otherwise
 */
export async function verifyPassphraseSentinel(
  passphrase: string,
  ciphertext: string,
  iv: string,
  salt: string
): Promise<boolean> {
  try {
    // Decode base64
    const ciphertextBytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))
    const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0))
    const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0))

    // Derive key from passphrase
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    )

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    )

    // Try to decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      ciphertextBytes
    )

    // Check if decrypted value matches sentinel
    const decoder = new TextDecoder()
    return decoder.decode(decrypted) === SENTINEL_PLAINTEXT
  } catch {
    // Decryption failed = wrong passphrase
    return false
  }
}

/**
 * Passphrase status for UI display
 */
export interface PassphraseStatus {
  isConfigured: boolean // Has passphrase been set up?
  mode: PassphraseMode // Current mode
  configuredAt: Date | null // When passphrase was configured
  /**
   * True if backup can proceed without user input.
   * - Auto mode: true (key is stored locally + in folder)
   * - Manual mode: ALWAYS false (user must enter passphrase every time)
   */
  canBackupWithoutPrompt: boolean
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
  passphrase: PassphraseStatus // Passphrase configuration status
}

/**
 * Get passphrase status from preferences
 *
 * @param preference - Backup preference object
 * @returns User-friendly passphrase status
 */
export function getPassphraseStatus(preference: BackupPreference | null): PassphraseStatus {
  if (!preference || preference.passphrase_mode === 'none') {
    return {
      isConfigured: false,
      mode: 'none',
      configuredAt: null,
      canBackupWithoutPrompt: false,
    }
  }

  // Auto mode: can backup without prompt if we have the key (from IndexedDB or folder)
  // Manual mode: ALWAYS requires passphrase entry (we only store sentinel, not passphrase)
  const canBackupWithoutPrompt = preference.passphrase_mode === 'auto' && preference.auto_key !== null

  return {
    isConfigured: true,
    mode: preference.passphrase_mode,
    configuredAt: preference.passphrase_configured_at
      ? new Date(preference.passphrase_configured_at)
      : null,
    canBackupWithoutPrompt,
  }
}

/**
 * Check if a passphrase sentinel is configured (manual mode setup complete)
 *
 * @param preference - Backup preference object
 * @returns True if sentinel is configured for passphrase verification
 */
export function hasSentinelConfigured(preference: BackupPreference | null): boolean {
  if (!preference) return false
  return (
    preference.passphrase_mode === 'manual' &&
    preference.sentinel_ciphertext !== null &&
    preference.sentinel_iv !== null &&
    preference.sentinel_salt !== null
  )
}

/**
 * Get the auto-key for creating a backup (auto mode only)
 *
 * @param preference - Backup preference object
 * @returns The auto-key to use for encryption, or null if not in auto mode
 */
export function getAutoBackupKey(preference: BackupPreference | null): string | null {
  if (!preference || preference.passphrase_mode !== 'auto') return null
  return preference.auto_key
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
      passphrase: getPassphraseStatus(null),
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
    passphrase: getPassphraseStatus(preference),
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
