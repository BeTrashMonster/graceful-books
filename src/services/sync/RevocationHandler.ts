/**
 * Revocation Handler Service
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 6, Task 6.4:
 * Handles detection and UX for revoked user access.
 *
 * Detection Flow:
 * 1. User attempts to sync
 * 2. Sync relay checks client epoch vs. current epoch
 * 3. Epoch mismatch detected → access revoked
 * 4. Show clear, respectful notification
 * 5. Disable sync, allow read-only local access
 *
 * UX Principle:
 * "Respectful communication, clear next steps"
 *
 * Never blame the user. Always provide:
 * - Clear explanation of what happened
 * - What they can still do (read-only local data)
 * - What they cannot do (no sync)
 * - Next steps (contact admin)
 *
 * Joy Engineering: "Dignity in every interaction 🤝"
 */

import { verifyKeyRotationEpoch, _getCurrentEpoch } from '../backup/KeyRotationService'

/**
 * Revocation status
 */
export interface RevocationStatus {
  /** Whether user is revoked */
  isRevoked: boolean

  /** Current epoch on server */
  currentEpoch: number

  /** Client epoch */
  clientEpoch: number

  /** Epoch difference (how many rotations behind) */
  epochDifference: number

  /** Human-readable message */
  message: string

  /** When revocation was detected */
  detectedAt: Date
}

/**
 * Revocation check result
 */
export interface RevocationCheckResult {
  /** Whether check was successful */
  success: boolean

  /** Revocation status (if check succeeded) */
  status?: RevocationStatus

  /** Error message (if check failed) */
  error?: string
}

/**
 * User capabilities after revocation
 */
export interface RevokedUserCapabilities {
  /** Can view local data */
  canViewLocalData: boolean

  /** Can sync with server */
  canSync: boolean

  /** Can create new transactions */
  canCreateTransactions: boolean

  /** Can modify existing transactions */
  canModifyTransactions: boolean

  /** Can export data */
  canExport: boolean

  /** Can access historical backups */
  canAccessHistoricalBackups: boolean
}

/**
 * Check if user has been revoked by comparing epochs
 *
 * This is called during sync operations to detect if a user's
 * access has been revoked through key rotation.
 *
 * @param companyId - Company ID
 * @param clientEpoch - Client's current epoch
 * @returns Check result with revocation status
 *
 * @example
 * ```typescript
 * const result = await checkRevocationStatus('company-123', 5)
 *
 * if (result.success && result.status?.isRevoked) {
 *   // Show revocation notification
 *   showRevocationMessage(result.status.message)
 *   disableSync()
 * }
 * ```
 */
export async function checkRevocationStatus(
  companyId: string,
  clientEpoch: number
): Promise<RevocationCheckResult> {
  try {
    // Verify epoch
    const verifyResult = await verifyKeyRotationEpoch(companyId, clientEpoch)

    if (!verifyResult.success) {
      return {
        success: false,
        error: verifyResult.error?.message || 'Failed to verify epoch',
      }
    }

    const verification = verifyResult.data!
    const isRevoked = !verification.valid
    const epochDifference = verification.currentEpoch - verification.clientEpoch

    let message: string
    if (isRevoked) {
      if (epochDifference === 1) {
        message = 'Your access has been revoked. The encryption keys have been rotated once.'
      } else {
        message = `Your access has been revoked. The encryption keys have been rotated ${epochDifference} times.`
      }
    } else {
      message = 'Your access is active and up to date.'
    }

    const status: RevocationStatus = {
      isRevoked,
      currentEpoch: verification.currentEpoch,
      clientEpoch: verification.clientEpoch,
      epochDifference,
      message,
      detectedAt: new Date(),
    }

    return {
      success: true,
      status,
    }
  } catch (error) {
    console.error('Failed to check revocation status:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get capabilities for a revoked user
 *
 * Defines what a revoked user can and cannot do.
 *
 * @returns User capabilities
 */
export function getRevokedUserCapabilities(): RevokedUserCapabilities {
  return {
    // Can still view their local data
    canViewLocalData: true,

    // Cannot sync with server
    canSync: false,

    // Cannot create new transactions (they're revoked)
    canCreateTransactions: false,

    // Cannot modify existing transactions
    canModifyTransactions: false,

    // Can export their local data
    canExport: true,

    // Can access historical backups they received
    canAccessHistoricalBackups: true,
  }
}

/**
 * Format revocation message for user
 *
 * Creates a clear, respectful message explaining the situation
 * and what the user can do next.
 *
 * @param status - Revocation status
 * @param adminEmail - Admin contact email (optional)
 * @returns User-friendly message
 */
export function formatRevocationMessage(
  status: RevocationStatus,
  adminEmail?: string
): string {
  if (!status.isRevoked) {
    return 'Your access is active.'
  }

  const parts: string[] = []

  // Main message
  parts.push('Your access to this company account has been revoked.')
  parts.push('')

  // What happened
  parts.push('What this means:')
  parts.push('• You can no longer sync data with the company')
  parts.push('• You cannot create or modify transactions')
  parts.push('• Your local data remains accessible (read-only)')
  parts.push('')

  // What you can do
  parts.push('What you can do:')
  parts.push('• View all your local data')
  parts.push('• Export your local data for your records')
  parts.push('• Access any historical backups you received')
  parts.push('')

  // Next steps
  parts.push('Next steps:')
  if (adminEmail) {
    parts.push(`• Contact your administrator at ${adminEmail} to restore access`)
  } else {
    parts.push('• Contact your company administrator to restore access')
  }
  parts.push('• Your historical contributions remain with the company')

  return parts.join('\n')
}

/**
 * Format short revocation notice for UI banners
 *
 * @param adminEmail - Admin contact email (optional)
 * @returns Short message for banner/notification
 */
export function formatShortRevocationNotice(adminEmail?: string): string {
  const contactInfo = adminEmail ? ` Contact ${adminEmail} to restore access.` : ' Contact your administrator to restore access.'
  return `Your access has been revoked. You can view local data but cannot sync.${contactInfo}`
}

/**
 * Check if sync should be blocked for revoked user
 *
 * Simple helper to determine if sync operations should be prevented.
 *
 * @param status - Revocation status
 * @returns Whether sync should be blocked
 */
export function shouldBlockSync(status: RevocationStatus): boolean {
  return status.isRevoked
}

/**
 * Check if user can perform action
 *
 * @param action - Action to check
 * @param capabilities - User capabilities
 * @returns Whether action is allowed
 */
export function canPerformAction(
  action: keyof RevokedUserCapabilities,
  capabilities: RevokedUserCapabilities
): boolean {
  return capabilities[action]
}

/**
 * Get suggested actions for revoked user
 *
 * Provides helpful next steps.
 *
 * @param adminEmail - Admin contact email (optional)
 * @returns Array of suggested actions
 */
export function getSuggestedActions(adminEmail?: string): string[] {
  const actions: string[] = []

  if (adminEmail) {
    actions.push(`Email your administrator at ${adminEmail}`)
  } else {
    actions.push('Contact your company administrator')
  }

  actions.push('Export your local data for your records')
  actions.push('Review any historical backups you received')
  actions.push('Access your local data (read-only mode)')

  return actions
}

/**
 * Record revocation detection in local storage
 *
 * Stores when revocation was first detected so we don't
 * keep showing the notification on every page load.
 *
 * @param companyId - Company ID
 * @param status - Revocation status
 */
export function recordRevocationDetection(
  companyId: string,
  status: RevocationStatus
): void {
  try {
    const key = `revocation_detected_${companyId}`
    const data = {
      detectedAt: status.detectedAt.toISOString(),
      currentEpoch: status.currentEpoch,
      clientEpoch: status.clientEpoch,
      epochDifference: status.epochDifference,
    }

    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.warn('Failed to record revocation detection:', error)
  }
}

/**
 * Check if revocation has been acknowledged
 *
 * @param companyId - Company ID
 * @returns Whether user has already been notified
 */
export function hasAcknowledgedRevocation(companyId: string): boolean {
  try {
    const key = `revocation_detected_${companyId}`
    return localStorage.getItem(key) !== null
  } catch (error) {
    return false
  }
}

/**
 * Clear revocation acknowledgement
 *
 * Useful for testing or if user regains access.
 *
 * @param companyId - Company ID
 */
export function clearRevocationAcknowledgement(companyId: string): void {
  try {
    const key = `revocation_detected_${companyId}`
    localStorage.removeItem(key)
  } catch (error) {
    console.warn('Failed to clear revocation acknowledgement:', error)
  }
}
