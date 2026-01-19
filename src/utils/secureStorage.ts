/**
 * Secure Local Storage Module
 *
 * Provides encrypted localStorage operations using device-derived keys.
 * This prevents sensitive data from being exposed through browser localStorage inspection.
 *
 * Security features:
 * - Device-specific key derivation using PBKDF2
 * - AES-256-GCM encryption for all stored values
 * - Automatic migration of legacy unencrypted data
 * - Secure key prefix identification
 */

import { bytesToBase64, base64ToBytes, bufferToHex } from './encoding'

/**
 * Prefix for encrypted storage keys to identify them
 */
const SECURE_KEY_PREFIX = 'secure:'

/**
 * Key used to store the device key salt
 */
const DEVICE_SALT_KEY = 'graceful_books_device_salt'

/**
 * Algorithm constants
 */
const ENCRYPTION_ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const PBKDF2_ITERATIONS = 100000

/**
 * Serialized encrypted value format for localStorage
 */
interface SerializedEncryptedValue {
  /** Base64-encoded ciphertext with auth tag appended */
  ct: string
  /** Base64-encoded initialization vector */
  iv: string
  /** Version number for future format changes */
  v: number
}

/**
 * Result type for storage operations
 */
interface StorageResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Extended result type for setItem operations with specific error codes
 */
export interface SetItemResult {
  success: boolean
  error?: 'QUOTA_EXCEEDED' | 'ENCRYPTION_FAILED' | 'NOT_INITIALIZED' | 'UNKNOWN'
  message?: string
}

/**
 * Storage usage statistics
 */
export interface StorageStats {
  /** Bytes used by secure storage entries */
  used: number
  /** Estimated maximum storage available (typically 5-10MB) */
  estimatedMax: number
  /** Percentage of storage used (0-100) */
  percentUsed: number
}

/**
 * Metadata stored with each secure entry for cleanup purposes
 */
interface EntryMetadata {
  /** Timestamp when entry was created/updated */
  timestamp: number
  /** Original key name */
  key: string
}

/**
 * Prefix for entry metadata storage
 */
const METADATA_PREFIX = 'secure_meta:'

/**
 * Default maximum age for cleanup (30 days in milliseconds)
 */
const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Estimated localStorage limit (5MB is most conservative estimate)
 */
const ESTIMATED_STORAGE_LIMIT = 5 * 1024 * 1024

/**
 * Threshold percentage for "nearly full" warning
 */
const NEARLY_FULL_THRESHOLD = 80

/**
 * SecureLocalStorage Class
 *
 * Provides encrypted localStorage operations using a device-derived key.
 * The key is derived from browser fingerprint characteristics using PBKDF2.
 *
 * @example
 * ```typescript
 * const storage = SecureLocalStorage.getInstance()
 * await storage.setItem('secret-key', 'sensitive-value')
 * const value = await storage.getItem('secret-key')
 * ```
 */
export class SecureLocalStorage {
  private static instance: SecureLocalStorage | null = null
  private deviceKey: CryptoKey | null = null
  private initialized: boolean = false
  private initPromise: Promise<void> | null = null

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Get the singleton instance of SecureLocalStorage
   *
   * @returns SecureLocalStorage instance
   */
  public static getInstance(): SecureLocalStorage {
    if (!SecureLocalStorage.instance) {
      SecureLocalStorage.instance = new SecureLocalStorage()
    }
    return SecureLocalStorage.instance
  }

  /**
   * Reset the singleton instance (primarily for testing)
   */
  public static resetInstance(): void {
    SecureLocalStorage.instance = null
  }

  /**
   * Initialize the secure storage with device-derived key
   *
   * Must be called before any storage operations. Derives a device-specific
   * encryption key using browser fingerprint characteristics.
   *
   * @returns Promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    // Prevent concurrent initialization
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this.doInitialize()
    await this.initPromise
    this.initPromise = null
  }

  /**
   * Internal initialization logic
   */
  private async doInitialize(): Promise<void> {
    try {
      const fingerprint = await this.generateBrowserFingerprint()
      const salt = await this.getOrCreateDeviceSalt()
      this.deviceKey = await this.deriveKeyFromFingerprint(fingerprint, salt)
      this.initialized = true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Unable to initialize secure storage: ${message}`)
    }
  }

  /**
   * Check if the storage is initialized
   *
   * @returns True if initialized
   */
  public isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Store an encrypted value in localStorage
   *
   * @param key - Storage key (will be prefixed with 'secure:')
   * @param value - Value to encrypt and store
   * @returns Promise resolving to success result with specific error codes
   *
   * @example
   * ```typescript
   * const result = await storage.setItem('auth-token', sensitiveToken)
   * if (!result.success && result.error === 'QUOTA_EXCEEDED') {
   *   // Handle storage full scenario
   * }
   * ```
   */
  public async setItem(key: string, value: string): Promise<SetItemResult> {
    if (!this.initialized || !this.deviceKey) {
      return {
        success: false,
        error: 'NOT_INITIALIZED',
        message: 'Secure storage not initialized. Please try again in a moment.',
      }
    }

    try {
      const encrypted = await this.encryptValue(value, this.deviceKey)
      const serialized = JSON.stringify(encrypted)
      const prefixedKey = this.getPrefixedKey(key)

      // Try to store the value, handling quota errors
      const storeResult = await this.tryStoreWithQuotaHandling(prefixedKey, serialized, key)
      return storeResult
    } catch (error) {
      // Check if it's an encryption error
      if (error instanceof Error && error.message.includes('encrypt')) {
        return {
          success: false,
          error: 'ENCRYPTION_FAILED',
          message: 'We had trouble securing your data. Please try again.',
        }
      }

      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: 'UNKNOWN',
        message: `Unable to save securely: ${message}`,
      }
    }
  }

  /**
   * Try to store a value, handling quota exceeded errors gracefully
   *
   * @param prefixedKey - The storage key with prefix
   * @param serialized - The serialized value to store
   * @param originalKey - The original key (without prefix) for metadata
   * @returns Promise resolving to SetItemResult
   */
  private async tryStoreWithQuotaHandling(
    prefixedKey: string,
    serialized: string,
    originalKey: string
  ): Promise<SetItemResult> {
    try {
      localStorage.setItem(prefixedKey, serialized)
      // Store metadata for cleanup purposes
      this.storeEntryMetadata(originalKey)
      return { success: true }
    } catch (error) {
      // Check if it's a quota exceeded error
      if (this.isQuotaExceededError(error)) {
        // Try to clean up old entries first
        const cleanedCount = await this.cleanupOldEntries()

        if (cleanedCount > 0) {
          // Retry after cleanup
          try {
            localStorage.setItem(prefixedKey, serialized)
            this.storeEntryMetadata(originalKey)
            return { success: true }
          } catch (retryError) {
            if (this.isQuotaExceededError(retryError)) {
              return {
                success: false,
                error: 'QUOTA_EXCEEDED',
                message:
                  'Your browser storage is full. We cleaned up some old data, but there still is not enough space. ' +
                  'You may need to clear some browser data or use a different browser.',
              }
            }
          }
        }

        return {
          success: false,
          error: 'QUOTA_EXCEEDED',
          message:
            'Your browser storage is full. Please clear some browser data to continue saving. ' +
            'Do not worry - your existing data is safe.',
        }
      }

      // Re-throw if it's not a quota error
      throw error
    }
  }

  /**
   * Check if an error is a quota exceeded error
   *
   * @param error - The error to check
   * @returns True if it's a quota exceeded error
   */
  private isQuotaExceededError(error: unknown): boolean {
    if (error instanceof Error) {
      // Different browsers use different error names/messages
      return (
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        error.message.includes('quota') ||
        error.message.includes('QuotaExceeded') ||
        // Safari specific
        error.name === 'QUOTA_EXCEEDED_ERR'
      )
    }
    return false
  }

  /**
   * Store metadata for an entry (for cleanup tracking)
   *
   * @param key - The original key (without prefix)
   */
  private storeEntryMetadata(key: string): void {
    try {
      const metadata: EntryMetadata = {
        timestamp: Date.now(),
        key: key,
      }
      localStorage.setItem(`${METADATA_PREFIX}${key}`, JSON.stringify(metadata))
    } catch {
      // Metadata storage failure is not critical
    }
  }

  /**
   * Get metadata for an entry
   *
   * @param key - The original key (without prefix)
   * @returns Entry metadata or null if not found
   */
  private getEntryMetadata(key: string): EntryMetadata | null {
    try {
      const metadataStr = localStorage.getItem(`${METADATA_PREFIX}${key}`)
      if (metadataStr) {
        return JSON.parse(metadataStr) as EntryMetadata
      }
    } catch {
      // Parse failure
    }
    return null
  }

  /**
   * Retrieve and decrypt a value from localStorage
   *
   * @param key - Storage key (will be prefixed with 'secure:')
   * @returns Promise resolving to decrypted value or null if not found
   *
   * @example
   * ```typescript
   * const token = await storage.getItem('auth-token')
   * if (token) {
   *   // Use token
   * }
   * ```
   */
  public async getItem(key: string): Promise<string | null> {
    if (!this.initialized || !this.deviceKey) {
      return null
    }

    try {
      const prefixedKey = this.getPrefixedKey(key)
      const serialized = localStorage.getItem(prefixedKey)

      if (!serialized) {
        return null
      }

      const encrypted = JSON.parse(serialized) as SerializedEncryptedValue
      return await this.decryptValue(encrypted, this.deviceKey)
    } catch {
      // Decryption failure or parse error - return null
      return null
    }
  }

  /**
   * Remove an encrypted value from localStorage
   *
   * @param key - Storage key (will be prefixed with 'secure:')
   *
   * @example
   * ```typescript
   * await storage.removeItem('auth-token')
   * ```
   */
  public async removeItem(key: string): Promise<void> {
    const prefixedKey = this.getPrefixedKey(key)
    localStorage.removeItem(prefixedKey)
    // Also remove associated metadata
    localStorage.removeItem(`${METADATA_PREFIX}${key}`)
  }

  /**
   * Clear all secure storage entries
   *
   * Only removes keys with the 'secure:' prefix and associated metadata.
   */
  public async clear(): Promise<void> {
    const keys = Object.keys(localStorage)
    keys.forEach((key) => {
      if (key.startsWith(SECURE_KEY_PREFIX) || key.startsWith(METADATA_PREFIX)) {
        localStorage.removeItem(key)
      }
    })
  }

  /**
   * Migrate unencrypted data to encrypted storage
   *
   * Reads a value from the old key, encrypts it, stores it under the new
   * secure key, and removes the old unencrypted key.
   *
   * @param oldKey - Original unencrypted localStorage key
   * @param newKey - New key for secure storage (without prefix)
   * @returns Promise resolving to success result
   *
   * @example
   * ```typescript
   * // Migrate legacy data
   * await storage.migrateFromUnencrypted('old-token-key', 'device-token')
   * ```
   */
  public async migrateFromUnencrypted(
    oldKey: string,
    newKey: string
  ): Promise<StorageResult<void>> {
    if (!this.initialized || !this.deviceKey) {
      return {
        success: false,
        error: 'Secure storage not initialized. Please try again in a moment.',
      }
    }

    try {
      // Check if old key exists
      const oldValue = localStorage.getItem(oldKey)
      if (!oldValue) {
        // Nothing to migrate
        return { success: true }
      }

      // Check if already migrated (new key exists)
      const prefixedNewKey = this.getPrefixedKey(newKey)
      if (localStorage.getItem(prefixedNewKey)) {
        // Already migrated, just clean up old key
        localStorage.removeItem(oldKey)
        return { success: true }
      }

      // Encrypt and store under new key
      const result = await this.setItem(newKey, oldValue)
      if (!result.success) {
        return result
      }

      // Remove old unencrypted key
      localStorage.removeItem(oldKey)

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: `Migration failed: ${message}`,
      }
    }
  }

  /**
   * Check if a key exists in secure storage
   *
   * @param key - Storage key (without prefix)
   * @returns True if key exists
   */
  public hasKey(key: string): boolean {
    const prefixedKey = this.getPrefixedKey(key)
    return localStorage.getItem(prefixedKey) !== null
  }

  /**
   * Get all secure storage keys (without prefix)
   *
   * @returns Array of key names
   */
  public getKeys(): string[] {
    const keys = Object.keys(localStorage)
    return keys
      .filter((key) => key.startsWith(SECURE_KEY_PREFIX))
      .map((key) => key.slice(SECURE_KEY_PREFIX.length))
  }

  // ============================================================
  // STORAGE QUOTA MANAGEMENT METHODS
  // ============================================================

  /**
   * Get current storage usage statistics
   *
   * Calculates how much space is being used by secure storage entries
   * and estimates the percentage of available storage consumed.
   *
   * @returns Promise resolving to storage statistics
   *
   * @example
   * ```typescript
   * const stats = await storage.getStorageStats()
   * if (stats.percentUsed > 80) {
   *   console.log('Storage is getting full!')
   * }
   * ```
   */
  public async getStorageStats(): Promise<StorageStats> {
    let totalBytes = 0

    // Calculate bytes used by all localStorage entries
    const allKeys = Object.keys(localStorage)
    for (const key of allKeys) {
      const value = localStorage.getItem(key)
      if (value) {
        // Each character in JavaScript strings is 2 bytes (UTF-16)
        // But localStorage typically stores as UTF-8, so we approximate
        totalBytes += key.length * 2 + value.length * 2
      }
    }

    const percentUsed = (totalBytes / ESTIMATED_STORAGE_LIMIT) * 100

    return {
      used: totalBytes,
      estimatedMax: ESTIMATED_STORAGE_LIMIT,
      percentUsed: Math.min(percentUsed, 100), // Cap at 100%
    }
  }

  /**
   * Get storage usage for secure entries only
   *
   * @returns Bytes used by secure storage entries
   */
  public getSecureStorageUsage(): number {
    let totalBytes = 0

    const allKeys = Object.keys(localStorage)
    for (const key of allKeys) {
      if (key.startsWith(SECURE_KEY_PREFIX) || key.startsWith(METADATA_PREFIX)) {
        const value = localStorage.getItem(key)
        if (value) {
          totalBytes += key.length * 2 + value.length * 2
        }
      }
    }

    return totalBytes
  }

  /**
   * Clean up old entries to free storage space
   *
   * Removes entries older than the specified maximum age. This helps
   * prevent storage quota issues by removing stale data.
   *
   * @param maxAge - Maximum age in milliseconds (default: 30 days)
   * @returns Promise resolving to number of entries cleaned up
   *
   * @example
   * ```typescript
   * // Clean entries older than 7 days
   * const cleaned = await storage.cleanupOldEntries(7 * 24 * 60 * 60 * 1000)
   * console.log(`Cleaned up ${cleaned} old entries`)
   * ```
   */
  public async cleanupOldEntries(maxAge: number = DEFAULT_MAX_AGE_MS): Promise<number> {
    const now = Date.now()
    const cutoffTime = now - maxAge
    let cleanedCount = 0

    // Get all secure storage keys
    const secureKeys = this.getKeys()

    for (const key of secureKeys) {
      const metadata = this.getEntryMetadata(key)

      // If we have metadata and it's old, or if there's no metadata and we're being aggressive
      if (metadata && metadata.timestamp < cutoffTime) {
        await this.removeItem(key)
        // Also remove the metadata
        localStorage.removeItem(`${METADATA_PREFIX}${key}`)
        cleanedCount++
      }
    }

    // Also clean up orphaned metadata entries
    const allKeys = Object.keys(localStorage)
    for (const key of allKeys) {
      if (key.startsWith(METADATA_PREFIX)) {
        const originalKey = key.slice(METADATA_PREFIX.length)
        const prefixedKey = this.getPrefixedKey(originalKey)
        // If the secure entry doesn't exist, remove the metadata
        if (!localStorage.getItem(prefixedKey)) {
          localStorage.removeItem(key)
        }
      }
    }

    return cleanedCount
  }

  /**
   * Check if storage is nearly full (above threshold)
   *
   * Returns true if storage usage is above 80% of the estimated limit.
   * This can be used to warn users before they hit the storage limit.
   *
   * @returns Promise resolving to true if storage is nearly full
   *
   * @example
   * ```typescript
   * if (await storage.isNearlyFull()) {
   *   showWarning('Storage is getting full. Consider cleaning up old data.')
   * }
   * ```
   */
  public async isNearlyFull(): Promise<boolean> {
    const stats = await this.getStorageStats()
    return stats.percentUsed >= NEARLY_FULL_THRESHOLD
  }

  /**
   * Get the prefixed key for storage
   *
   * @param key - Original key
   * @returns Key with secure prefix
   */
  private getPrefixedKey(key: string): string {
    return `${SECURE_KEY_PREFIX}${key}`
  }

  /**
   * Generate a browser fingerprint for key derivation
   *
   * Combines various browser characteristics to create a device-specific
   * identifier. This is not intended for tracking, but for deriving a
   * device-specific encryption key.
   *
   * @returns Promise resolving to fingerprint string
   */
  private async generateBrowserFingerprint(): Promise<string> {
    const components: string[] = []

    // Browser characteristics
    if (typeof navigator !== 'undefined') {
      components.push(navigator.userAgent || 'unknown-ua')
      components.push(navigator.language || 'unknown-lang')
      components.push(String(navigator.hardwareConcurrency || 0))
    }

    // Screen characteristics
    if (typeof screen !== 'undefined') {
      components.push(String(screen.width || 0))
      components.push(String(screen.height || 0))
      components.push(String(screen.colorDepth || 0))
      components.push(String(screen.pixelDepth || 0))
    }

    // Timezone
    components.push(String(new Date().getTimezoneOffset()))

    // Canvas fingerprint (lightweight)
    try {
      if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (ctx) {
          canvas.width = 200
          canvas.height = 50
          ctx.textBaseline = 'top'
          ctx.font = '14px Arial'
          ctx.fillStyle = '#f60'
          ctx.fillRect(0, 0, 100, 25)
          ctx.fillStyle = '#069'
          ctx.fillText('GracefulBooks', 2, 15)
          ctx.strokeStyle = 'rgba(102, 204, 0, 0.7)'
          ctx.strokeText('GracefulBooks', 4, 17)
          components.push(canvas.toDataURL())
        }
      }
    } catch {
      // Canvas fingerprinting may be blocked
      components.push('canvas-blocked')
    }

    // Hash all components
    const combined = components.join('|')
    return await this.hashString(combined)
  }

  /**
   * Get or create the device salt for key derivation
   *
   * The salt is stored unencrypted but is randomly generated per device.
   * This ensures the derived key is unique to each device.
   *
   * @returns Promise resolving to salt bytes
   */
  private async getOrCreateDeviceSalt(): Promise<Uint8Array> {
    const existingSalt = localStorage.getItem(DEVICE_SALT_KEY)

    if (existingSalt) {
      return base64ToBytes(existingSalt)
    }

    // Generate new random salt
    const salt = new Uint8Array(32)
    crypto.getRandomValues(salt)

    // Store for future use
    localStorage.setItem(DEVICE_SALT_KEY, bytesToBase64(salt))

    return salt
  }

  /**
   * Derive an encryption key from browser fingerprint
   *
   * Uses PBKDF2 with the fingerprint as the password and device salt.
   *
   * @param fingerprint - Browser fingerprint string
   * @param salt - Device-specific salt
   * @returns Promise resolving to CryptoKey
   */
  private async deriveKeyFromFingerprint(
    fingerprint: string,
    salt: Uint8Array
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const fingerprintBytes = encoder.encode(fingerprint)

    // Import fingerprint as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      fingerprintBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    )

    // Derive AES-GCM key
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    )
  }

  /**
   * Encrypt a value using AES-256-GCM
   *
   * @param value - Plaintext value
   * @param key - Encryption key
   * @returns Promise resolving to serialized encrypted value
   */
  private async encryptValue(
    value: string,
    key: CryptoKey
  ): Promise<SerializedEncryptedValue> {
    const encoder = new TextEncoder()
    const valueBytes = encoder.encode(value)

    // Generate random IV
    const iv = new Uint8Array(IV_LENGTH)
    crypto.getRandomValues(iv)

    // Encrypt
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: ENCRYPTION_ALGORITHM,
        iv: iv,
        tagLength: AUTH_TAG_LENGTH * 8,
      },
      key,
      valueBytes
    )

    // Return serialized format
    return {
      ct: bytesToBase64(new Uint8Array(encryptedBuffer)),
      iv: bytesToBase64(iv),
      v: 1,
    }
  }

  /**
   * Decrypt a value using AES-256-GCM
   *
   * @param encrypted - Serialized encrypted value
   * @param key - Decryption key
   * @returns Promise resolving to plaintext value
   */
  private async decryptValue(
    encrypted: SerializedEncryptedValue,
    key: CryptoKey
  ): Promise<string> {
    // Verify version
    if (encrypted.v !== 1) {
      throw new Error('Unsupported encryption format version')
    }

    const ciphertext = base64ToBytes(encrypted.ct)
    const iv = base64ToBytes(encrypted.iv)

    // Decrypt
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: ENCRYPTION_ALGORITHM,
        iv: iv as BufferSource,
        tagLength: AUTH_TAG_LENGTH * 8,
      },
      key,
      ciphertext as BufferSource
    )

    const decoder = new TextDecoder()
    return decoder.decode(decryptedBuffer)
  }

  /**
   * Hash a string using SHA-256
   *
   * @param input - String to hash
   * @returns Promise resolving to hex-encoded hash
   */
  private async hashString(input: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(input)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    return bufferToHex(hashBuffer)
  }
}

/**
 * Convenience function to get the SecureLocalStorage instance
 *
 * @returns SecureLocalStorage singleton instance
 */
export function getSecureStorage(): SecureLocalStorage {
  return SecureLocalStorage.getInstance()
}

/**
 * Initialize secure storage (call on app startup)
 *
 * @returns Promise that resolves when initialization is complete
 *
 * @example
 * ```typescript
 * // In app initialization
 * await initializeSecureStorage()
 * ```
 */
export async function initializeSecureStorage(): Promise<void> {
  const storage = getSecureStorage()
  await storage.initialize()
}
