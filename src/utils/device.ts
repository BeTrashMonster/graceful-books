/**
 * Device ID Utilities
 *
 * Centralized device identification for CRDT operations and sync.
 * All modules should use these functions instead of implementing their own.
 */

import { nanoid } from 'nanoid'

/**
 * Storage key for device ID - must be consistent across all modules
 */
const DEVICE_ID_STORAGE_KEY = 'graceful_books_device_id'

/**
 * Generate a unique device ID
 *
 * Uses cryptographic randomness combined with timestamp for uniqueness.
 *
 * @returns Unique device identifier string
 */
export function generateDeviceId(): string {
  const randomBytes = new Uint8Array(16)
  crypto.getRandomValues(randomBytes)

  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const timestamp = Date.now().toString(36)
  const combined = `${randomHex}-${timestamp}`

  return btoa(combined).substring(0, 32).replace(/[^a-zA-Z0-9]/g, '')
}

/**
 * Get or create device ID from localStorage
 *
 * Returns existing device ID if available, otherwise generates
 * and stores a new one. This ensures consistent device identification
 * across sessions and page reloads.
 *
 * @returns Device identifier string
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    // Server-side or test environment - generate temporary ID
    return generateDeviceId()
  }

  let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY)

  if (!deviceId) {
    deviceId = generateDeviceId()
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId)
  }

  return deviceId
}

/**
 * Clear device ID (for testing or logout scenarios)
 *
 * Use with caution - changing device ID affects CRDT sync.
 */
export function clearDeviceId(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(DEVICE_ID_STORAGE_KEY)
  }
}

/**
 * Generate a unique entity ID
 *
 * Wrapper around nanoid for consistent ID generation.
 *
 * @param size - Length of ID (default: 21)
 * @returns Unique ID string
 */
export function generateId(size?: number): string {
  return nanoid(size)
}
