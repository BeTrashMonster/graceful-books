/**
 * Device Detection Service
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 5, Task 5.1:
 * Detects whether this is a new device or an existing user returning.
 *
 * Detection logic:
 * - Checks if IndexedDB is empty (no users, companies, or transactions)
 * - Determines if user needs restoration flow or onboarding flow
 * - Provides device identification for multi-device sync
 */

import { db } from '../../store/database'
import { v4 as uuidv4 } from 'uuid'

/**
 * Device status result
 */
export interface DeviceStatus {
  /** True if this appears to be a new device with no data */
  isNewDevice: boolean

  /** True if data exists (user has been here before) */
  hasExistingData: boolean

  /** True if local backups might exist (File System Access API available) */
  canCheckLocalBackups: boolean

  /** Counts of major entities to help with decision making */
  dataCounts: {
    users: number
    companies: number
    transactions: number
    accounts: number
  }

  /** Unique device identifier (generated once, persisted) */
  deviceId: string

  /** Timestamp when detection was performed */
  detectedAt: number
}

/**
 * Device detection options
 */
export interface DeviceDetectionOptions {
  /** Minimum transaction count to consider "has existing data" (default: 1) */
  minTransactionThreshold?: number

  /** Whether to check for File System Access API support (default: true) */
  checkFileSystemAccess?: boolean
}

/**
 * Detects whether this is a new device or an existing user returning
 *
 * @param options - Detection options
 * @returns Device status with data counts and recommendations
 *
 * @example
 * ```typescript
 * const status = await detectDeviceStatus()
 *
 * if (status.isNewDevice) {
 *   // Show restoration options OR onboarding
 *   if (await hasLocalBackups()) {
 *     showRestorationFlow()
 *   } else {
 *     showOnboarding()
 *   }
 * } else {
 *   // Continue to dashboard
 *   showDashboard()
 * }
 * ```
 */
export async function detectDeviceStatus(
  options: DeviceDetectionOptions = {}
): Promise<DeviceStatus> {
  const {
    minTransactionThreshold = 1,
    checkFileSystemAccess = true,
  } = options

  try {
    // Get database statistics
    const stats = await db.getStats()

    // Determine if device has existing data
    const hasExistingData =
      stats.users > 0 ||
      stats.companies > 0 ||
      stats.transactions >= minTransactionThreshold

    const isNewDevice = !hasExistingData

    // Check File System Access API support
    const canCheckLocalBackups = checkFileSystemAccess && 'showDirectoryPicker' in window

    // Get or create device ID
    const deviceId = await getOrCreateDeviceId()

    return {
      isNewDevice,
      hasExistingData,
      canCheckLocalBackups,
      dataCounts: {
        users: stats.users,
        companies: stats.companies,
        transactions: stats.transactions,
        accounts: stats.accounts,
      },
      deviceId,
      detectedAt: Date.now(),
    }
  } catch (error) {
    // If database access fails, assume new device
    console.error('Device detection failed:', error)

    return {
      isNewDevice: true,
      hasExistingData: false,
      canCheckLocalBackups: false,
      dataCounts: {
        users: 0,
        companies: 0,
        transactions: 0,
        accounts: 0,
      },
      deviceId: await getOrCreateDeviceId(),
      detectedAt: Date.now(),
    }
  }
}

/**
 * Gets or creates a persistent device identifier
 *
 * Device ID is stored in localStorage and used for:
 * - Multi-device sync coordination
 * - Device-specific backup preferences
 * - Analytics and telemetry (if enabled)
 *
 * @returns Device identifier (UUID)
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const storageKey = 'graceful_books_device_id'

  try {
    // Try to get existing device ID from localStorage
    let deviceId = localStorage.getItem(storageKey)

    if (!deviceId) {
      // Generate new device ID
      deviceId = uuidv4()

      // Persist to localStorage
      localStorage.setItem(storageKey, deviceId)
    }

    return deviceId
  } catch (error) {
    // If localStorage is unavailable, generate ephemeral ID
    console.warn('Could not persist device ID, using ephemeral ID:', error)
    return uuidv4()
  }
}

/**
 * Checks if local backups exist in the user's chosen backup folder
 *
 * Requires File System Access API and user permission.
 *
 * @returns True if local backups are found, false otherwise
 */
export async function hasLocalBackups(): Promise<boolean> {
  // Check if File System Access API is available
  if (!('showDirectoryPicker' in window)) {
    return false
  }

  try {
    // Get backup folder handle from IndexedDB (stored during setup)
    const backupPrefs = await db.backupPreferences.toArray()

    if (backupPrefs.length === 0) {
      return false
    }

    // Check if any preference has a folder handle stored
    // Note: Folder handle verification requires user gesture, so we return true
    // if preferences exist. Actual file checking happens during restoration flow.
    return backupPrefs.some(pref => pref.localBackupEnabled)
  } catch (error) {
    console.error('Error checking for local backups:', error)
    return false
  }
}

/**
 * Gets device information for display and diagnostics
 *
 * @returns Device information object
 */
export function getDeviceInfo(): {
  userAgent: string
  platform: string
  language: string
  screenResolution: string
  timezone: string
  supportsFileSystemAccess: boolean
  supportsIndexedDB: boolean
  supportsWebCrypto: boolean
} {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    supportsFileSystemAccess: 'showDirectoryPicker' in window,
    supportsIndexedDB: 'indexedDB' in window,
    supportsWebCrypto: 'crypto' in window && 'subtle' in crypto,
  }
}

/**
 * Determines the recommended flow based on device status
 *
 * @param status - Device status from detectDeviceStatus()
 * @returns Recommended flow: 'onboarding' | 'restoration' | 'dashboard'
 */
export function getRecommendedFlow(status: DeviceStatus): 'onboarding' | 'restoration' | 'dashboard' {
  if (status.hasExistingData) {
    // Has data - go straight to dashboard
    return 'dashboard'
  }

  // New device - need to determine if restoration or onboarding
  // If local backups *might* exist, offer restoration first
  if (status.canCheckLocalBackups) {
    return 'restoration'
  }

  // No way to check for backups - go to onboarding
  return 'onboarding'
}

/**
 * Clears device identification (useful for testing or privacy)
 */
export function clearDeviceId(): void {
  const storageKey = 'graceful_books_device_id'
  try {
    localStorage.removeItem(storageKey)
  } catch (error) {
    console.warn('Could not clear device ID:', error)
  }
}
