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
 * Generate a device fingerprint
 *
 * Creates a unique identifier for the device based on browser
 * and system characteristics. This is NOT foolproof but provides
 * a reasonable device identification for convenience features.
 *
 * @returns Device fingerprint string
 */
export async function generateDeviceFingerprint(): Promise<string> {
  const components: string[] = [];

  // Browser and platform info
  components.push(navigator.userAgent);
  components.push(navigator.language);
  components.push(String(screen.width));
  components.push(String(screen.height));
  components.push(String(screen.colorDepth));
  components.push(String(new Date().getTimezoneOffset()));

  // Canvas fingerprint (lightweight version)
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
    // Canvas fingerprinting may be blocked
    components.push('canvas-blocked');
  }

  // Combine and hash
  const combined = components.join('|');
  const fingerprint = await hashString(combined);

  return fingerprint;
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
