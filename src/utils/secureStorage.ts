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
   * @returns Promise resolving to success result
   *
   * @example
   * ```typescript
   * await storage.setItem('auth-token', sensitiveToken)
   * ```
   */
  public async setItem(key: string, value: string): Promise<StorageResult<void>> {
    if (!this.initialized || !this.deviceKey) {
      return {
        success: false,
        error: 'Secure storage not initialized. Please try again in a moment.',
      }
    }

    try {
      const encrypted = await this.encryptValue(value, this.deviceKey)
      const serialized = JSON.stringify(encrypted)
      const prefixedKey = this.getPrefixedKey(key)

      localStorage.setItem(prefixedKey, serialized)

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: `Unable to save securely: ${message}`,
      }
    }
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
  }

  /**
   * Clear all secure storage entries
   *
   * Only removes keys with the 'secure:' prefix.
   */
  public async clear(): Promise<void> {
    const keys = Object.keys(localStorage)
    keys.forEach((key) => {
      if (key.startsWith(SECURE_KEY_PREFIX)) {
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
