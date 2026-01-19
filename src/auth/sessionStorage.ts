/**
 * Session Storage Module
 *
 * Handles "remember this device" functionality with device tokens,
 * device fingerprinting, and secure token management.
 *
 * Security: Device tokens and fingerprints are stored encrypted using
 * SecureLocalStorage to prevent exposure through browser localStorage inspection.
 */

import type { DeviceToken, AuthConfig } from './types';
import { DEFAULT_AUTH_CONFIG } from './types';
import { getSecureStorage } from '../utils/secureStorage';

/**
 * Storage key prefix for device tokens (secure storage)
 */
const DEVICE_TOKEN_KEY_PREFIX = 'device-token';

/**
 * Storage key for device fingerprint (secure storage)
 */
const DEVICE_FINGERPRINT_KEY = 'device-fingerprint';

/**
 * Legacy storage key prefix for device tokens (for migration)
 */
const LEGACY_DEVICE_TOKEN_KEY_PREFIX = 'graceful-books-device-token-';

/**
 * Legacy storage key for device fingerprint (for migration)
 */
const LEGACY_DEVICE_FINGERPRINT_KEY = 'graceful-books-device-fingerprint';

/**
 * Generate a device fingerprint for the "Remember this device" convenience feature.
 *
 * ## Purpose
 * This function creates a semi-unique identifier for the current device/browser
 * combination. Its primary purpose is to REDUCE LOGIN FRICTION for returning users
 * by allowing them to skip full passphrase entry on recognized devices.
 *
 * ## IMPORTANT SECURITY LIMITATIONS
 *
 * **This is a CONVENIENCE feature, NOT a security feature.**
 *
 * Device fingerprinting has significant limitations that users and developers
 * should understand:
 *
 * 1. **Fingerprints can be spoofed**: A malicious actor with access to the
 *    fingerprint hash (e.g., from stolen localStorage) can potentially replay
 *    it. The fingerprint itself does not authenticate the user.
 *
 * 2. **Browser characteristics are not unique**: Many users share identical
 *    fingerprints due to common browser/OS/screen configurations.
 *
 * 3. **Fingerprints change over time**: Browser updates, OS changes, or even
 *    installing new fonts can alter the fingerprint, requiring re-authentication.
 *
 * 4. **Privacy tools interfere**: Users with privacy extensions or strict browser
 *    settings may have blocked fingerprinting features (canvas, etc.), resulting
 *    in degraded accuracy.
 *
 * 5. **Not tamper-proof**: Unlike server-side session validation, client-side
 *    fingerprints can be modified by anyone with JavaScript access to the page.
 *
 * ## Data Collected
 *
 * The fingerprint combines the following browser/system attributes:
 * - User agent string (browser, version, OS)
 * - Browser language preference
 * - Screen dimensions (width, height, color depth)
 * - Timezone offset
 * - Canvas rendering characteristics (lightweight)
 *
 * These are hashed together using SHA-256 to produce a consistent identifier.
 * No personal data or hardware identifiers are collected.
 *
 * ## Security Model
 *
 * The device fingerprint works as ONE FACTOR in a multi-layered approach:
 *
 * 1. Primary authentication: Passphrase (zero-knowledge proof)
 * 2. Secondary factor: Device token (stored encrypted, time-limited)
 * 3. Tertiary check: Device fingerprint (convenience validation)
 *
 * For sensitive operations (password change, data export, payment info),
 * additional verification should always be required regardless of device
 * recognition status.
 *
 * ## Recommendations
 *
 * - For high-security scenarios, implement MFA (TOTP, WebAuthn)
 * - Device tokens should have reasonable expiration (default: 30 days)
 * - Consider requiring re-authentication for sensitive operations
 * - Educate users that "Remember this device" is for convenience, not security
 *
 * @returns Promise<string> - SHA-256 hash of combined device characteristics
 *
 * @example
 * ```typescript
 * const fingerprint = await generateDeviceFingerprint();
 * // Returns: "a1b2c3d4e5f6..." (64-character hex string)
 * ```
 *
 * @see getDeviceFingerprintDisclaimer - User-facing explanation of limitations
 * @see createDeviceToken - Creates token associated with this fingerprint
 */
export async function generateDeviceFingerprint(): Promise<string> {
  const components: string[] = [];

  // ============================================================
  // DATA COLLECTION SECTION
  // Each component contributes to the fingerprint uniqueness.
  // None of these are truly unique identifiers on their own.
  // ============================================================

  // Browser and platform info
  // Note: User agent can be easily spoofed via browser settings or extensions
  components.push(navigator.userAgent);

  // Language preference - common value, provides limited entropy
  components.push(navigator.language);

  // Screen characteristics - shared by many users with same monitor/resolution
  components.push(String(screen.width));
  components.push(String(screen.height));
  components.push(String(screen.colorDepth));

  // Timezone - provides some geographic hint, easily spoofed
  components.push(String(new Date().getTimezoneOffset()));

  // Canvas fingerprint (lightweight version)
  // This technique renders text/graphics and captures the output.
  // Different GPUs/drivers/fonts produce slightly different results.
  // LIMITATION: Privacy-focused browsers may block or normalize canvas output.
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('GracefulBooks', 2, 15);
      components.push(canvas.toDataURL());
    }
  } catch (e) {
    // Canvas fingerprinting may be blocked by privacy tools
    // Fall back to a placeholder - reduces fingerprint uniqueness
    components.push('canvas-blocked');
  }

  // ============================================================
  // HASHING SECTION
  // Combine all components and hash for consistent output format.
  // SHA-256 is used for consistency, not security (fingerprint
  // is not a secret).
  // ============================================================
  const combined = components.join('|');
  const fingerprint = await hashString(combined);

  return fingerprint;
}

/**
 * Returns a user-facing disclaimer about device fingerprinting limitations.
 *
 * Use this text in UI components, help tooltips, or documentation to ensure
 * users understand that "Remember this device" is a convenience feature and
 * does not provide strong security guarantees.
 *
 * @returns string - User-friendly explanation of fingerprinting limitations
 *
 * @example
 * ```tsx
 * <HelpTooltip>
 *   {getDeviceFingerprintDisclaimer()}
 * </HelpTooltip>
 * ```
 */
export function getDeviceFingerprintDisclaimer(): string {
  return (
    'Device recognition is a convenience feature to reduce login friction. ' +
    'It does not replace strong authentication. For sensitive operations, ' +
    'additional verification may be required.'
  );
}

/**
 * Get or create device fingerprint
 *
 * Returns cached fingerprint if available, otherwise generates new one.
 * Fingerprint is stored encrypted to prevent exposure through browser inspection.
 *
 * @returns Device fingerprint
 */
export async function getDeviceFingerprint(): Promise<string> {
  const secureStorage = getSecureStorage();

  // Ensure secure storage is initialized
  if (!secureStorage.isInitialized()) {
    await secureStorage.initialize();
  }

  // Try to get cached fingerprint from secure storage
  const cached = await secureStorage.getItem(DEVICE_FINGERPRINT_KEY);
  if (cached) {
    return cached;
  }

  // Check for legacy unencrypted fingerprint and migrate
  const legacyCached = localStorage.getItem(LEGACY_DEVICE_FINGERPRINT_KEY);
  if (legacyCached) {
    await secureStorage.migrateFromUnencrypted(
      LEGACY_DEVICE_FINGERPRINT_KEY,
      DEVICE_FINGERPRINT_KEY
    );
    return legacyCached;
  }

  // Generate new fingerprint
  const fingerprint = await generateDeviceFingerprint();
  await secureStorage.setItem(DEVICE_FINGERPRINT_KEY, fingerprint);
  return fingerprint;
}

/**
 * Store device token securely
 *
 * Saves device token encrypted to localStorage for "remember this device" feature.
 * This protects sensitive device tokens from browser localStorage inspection.
 *
 * @param deviceToken - Device token to store
 */
export async function storeDeviceToken(deviceToken: DeviceToken): Promise<void> {
  const secureStorage = getSecureStorage();
  const key = `${DEVICE_TOKEN_KEY_PREFIX}-${deviceToken.companyId}`;

  // Ensure secure storage is initialized
  if (!secureStorage.isInitialized()) {
    await secureStorage.initialize();
  }

  await secureStorage.setItem(key, JSON.stringify(deviceToken));
}

/**
 * Get device token for company
 *
 * Retrieves stored device token from secure storage if available and valid.
 * Handles migration of legacy unencrypted tokens automatically.
 *
 * @param companyId - Company identifier
 * @returns Device token or null if not found/invalid
 */
export async function getDeviceToken(
  companyId: string
): Promise<DeviceToken | null> {
  try {
    const secureStorage = getSecureStorage();
    const key = `${DEVICE_TOKEN_KEY_PREFIX}-${companyId}`;
    const legacyKey = `${LEGACY_DEVICE_TOKEN_KEY_PREFIX}${companyId}`;

    // Ensure secure storage is initialized
    if (!secureStorage.isInitialized()) {
      await secureStorage.initialize();
    }

    // Try to get from secure storage first
    let stored = await secureStorage.getItem(key);

    // Check for legacy unencrypted token and migrate
    if (!stored) {
      const legacyStored = localStorage.getItem(legacyKey);
      if (legacyStored) {
        await secureStorage.migrateFromUnencrypted(legacyKey, key);
        stored = legacyStored;
      }
    }

    if (!stored) return null;

    const token = JSON.parse(stored) as DeviceToken;

    // Check if token is expired
    if (token.expiresAt < Date.now()) {
      await revokeDeviceToken(companyId);
      return null;
    }

    // Check if token is active
    if (!token.isActive) {
      return null;
    }

    // Verify device fingerprint matches
    const currentFingerprint = await getDeviceFingerprint();
    if (token.fingerprint !== currentFingerprint) {
      // Fingerprint mismatch - potential security issue
      console.warn('Device fingerprint mismatch');
      await revokeDeviceToken(companyId);
      return null;
    }

    return token;
  } catch (error) {
    console.error('Error getting device token:', error);
    return null;
  }
}

/**
 * Create a new device token
 *
 * Generates and stores a device token for "remember this device".
 *
 * @param userId - User identifier
 * @param companyId - Company identifier
 * @param config - Authentication configuration
 * @returns New device token
 */
export async function createDeviceToken(
  userId: string,
  companyId: string,
  config: AuthConfig = DEFAULT_AUTH_CONFIG
): Promise<DeviceToken> {
  const fingerprint = await getDeviceFingerprint();
  const now = Date.now();

  // Generate random token ID
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const tokenId = Array.from(tokenBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const deviceToken: DeviceToken = {
    tokenId,
    userId,
    companyId,
    fingerprint,
    createdAt: now,
    expiresAt: now + config.deviceTokenExpirationMs,
    isActive: true,
  };

  await storeDeviceToken(deviceToken);
  return deviceToken;
}

/**
 * Revoke device token
 *
 * Removes device token from both secure and legacy storage,
 * requiring full passphrase login.
 *
 * @param companyId - Company identifier
 */
export async function revokeDeviceToken(companyId: string): Promise<void> {
  const secureStorage = getSecureStorage();
  const key = `${DEVICE_TOKEN_KEY_PREFIX}-${companyId}`;
  const legacyKey = `${LEGACY_DEVICE_TOKEN_KEY_PREFIX}${companyId}`;

  // Remove from secure storage
  await secureStorage.removeItem(key);

  // Also remove from legacy storage if present
  localStorage.removeItem(legacyKey);
}

/**
 * Revoke all device tokens for user
 *
 * Called when passphrase is changed or on security events.
 * Clears both secure and legacy storage tokens.
 */
export async function revokeAllDeviceTokens(): Promise<void> {
  const secureStorage = getSecureStorage();

  // Get all secure storage keys and remove device tokens
  const secureKeys = secureStorage.getKeys();
  for (const key of secureKeys) {
    if (key.startsWith(DEVICE_TOKEN_KEY_PREFIX)) {
      await secureStorage.removeItem(key);
    }
  }

  // Also remove any legacy device token keys
  const legacyKeys = Object.keys(localStorage);
  legacyKeys.forEach((key) => {
    if (key.startsWith(LEGACY_DEVICE_TOKEN_KEY_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * Check if device is remembered
 *
 * @param companyId - Company identifier
 * @returns True if device has valid token
 */
export async function isDeviceRemembered(companyId: string): Promise<boolean> {
  const token = await getDeviceToken(companyId);
  return token !== null;
}

/**
 * Update device token activity
 *
 * Extends token expiration on activity (optional feature).
 *
 * @param companyId - Company identifier
 * @param config - Authentication configuration
 */
export async function updateDeviceTokenActivity(
  companyId: string,
  config: AuthConfig = DEFAULT_AUTH_CONFIG
): Promise<void> {
  const token = await getDeviceToken(companyId);
  if (!token) return;

  // Extend expiration
  const now = Date.now();
  token.expiresAt = now + config.deviceTokenExpirationMs;

  await storeDeviceToken(token);
}

/**
 * Hash a string using SHA-256
 *
 * @param input - String to hash
 * @returns Hex-encoded hash
 */
async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Store session data in sessionStorage
 *
 * SessionStorage is cleared when tab closes, providing temporary
 * storage for session tokens.
 *
 * @param key - Storage key
 * @param value - Value to store
 */
export function storeSessionData(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch (error) {
    console.error('Error storing session data:', error);
  }
}

/**
 * Get session data from sessionStorage
 *
 * @param key - Storage key
 * @returns Stored value or null
 */
export function getSessionData(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch (error) {
    console.error('Error getting session data:', error);
    return null;
  }
}

/**
 * Remove session data from sessionStorage
 *
 * @param key - Storage key
 */
export function removeSessionData(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing session data:', error);
  }
}

/**
 * Clear all session data
 *
 * Called on logout to ensure no session data remains.
 */
export function clearAllSessionData(): void {
  try {
    sessionStorage.clear();
  } catch (error) {
    console.error('Error clearing session data:', error);
  }
}

/**
 * Store session token in storage
 *
 * Uses sessionStorage for automatic cleanup on tab close.
 * Falls back to memory if sessionStorage is unavailable.
 *
 * @param token - Session token
 * @param companyId - Company identifier
 */
export function storeSessionToken(token: string, companyId: string): void {
  storeSessionData(`session-token-${companyId}`, token);
}

/**
 * Get session token from storage
 *
 * @param companyId - Company identifier
 * @returns Session token or null
 */
export function getSessionToken(companyId: string): string | null {
  return getSessionData(`session-token-${companyId}`);
}

/**
 * Remove session token from storage
 *
 * @param companyId - Company identifier
 */
export function removeSessionToken(companyId: string): void {
  removeSessionData(`session-token-${companyId}`);
}

/**
 * Set up beforeunload handler for session cleanup
 *
 * Ensures session data is cleared when tab closes
 * (unless device is remembered).
 *
 * @param companyId - Company identifier
 * @param onBeforeUnload - Callback function
 */
export function setupBeforeUnloadHandler(
  companyId: string,
  onBeforeUnload?: () => void
): void {
  window.addEventListener('beforeunload', async () => {
    // Check if device is remembered
    const remembered = await isDeviceRemembered(companyId);

    if (!remembered) {
      // Clear session data if device is not remembered
      clearAllSessionData();
    }

    // Call custom callback
    if (onBeforeUnload) {
      onBeforeUnload();
    }
  });
}

/**
 * Encrypt device hint for storage
 *
 * Creates an encrypted hint that allows faster login on remembered devices.
 * The hint might contain partial passphrase hash or other verification data.
 *
 * @param hint - Hint data to encrypt
 * @param masterKey - Master encryption key
 * @returns Encrypted hint
 */
export async function encryptDeviceHint(
  hint: string,
  masterKey: Uint8Array
): Promise<string> {
  const encoder = new TextEncoder();
  const hintBytes = encoder.encode(hint);

  // Generate IV
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  // Import key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    masterKey as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    cryptoKey,
    hintBytes
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Base64 encode
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt device hint
 *
 * @param encryptedHint - Encrypted hint
 * @param masterKey - Master encryption key
 * @returns Decrypted hint or null if decryption fails
 */
export async function decryptDeviceHint(
  encryptedHint: string,
  masterKey: Uint8Array
): Promise<string | null> {
  try {
    // Base64 decode
    const combined = Uint8Array.from(atob(encryptedHint), (c) => c.charCodeAt(0));

    // Split IV and ciphertext
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    // Import key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      masterKey as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, tagLength: 128 },
      cryptoKey,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Error decrypting device hint:', error);
    return null;
  }
}
