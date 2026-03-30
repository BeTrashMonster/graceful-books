/**
 * Revocation Handler Service Tests
 *
 * Tests for revoked user detection and UX.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  checkRevocationStatus,
  getRevokedUserCapabilities,
  formatRevocationMessage,
  formatShortRevocationNotice,
  shouldBlockSync,
  canPerformAction,
  getSuggestedActions,
  recordRevocationDetection,
  hasAcknowledgedRevocation,
  clearRevocationAcknowledgement,
  type RevocationStatus,
} from './RevocationHandler'
import * as KeyRotationService from '../backup/KeyRotationService'

// Mock KeyRotationService
vi.mock('../backup/KeyRotationService', () => ({
  verifyKeyRotationEpoch: vi.fn(),
  getCurrentEpoch: vi.fn(),
}))

describe('RevocationHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('checkRevocationStatus', () => {
    it('should detect revocation when epochs mismatch', async () => {
      vi.mocked(KeyRotationService.verifyKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: {
          valid: false,
          currentEpoch: 5,
          clientEpoch: 3,
          message: 'Epoch mismatch',
        },
      })

      const result = await checkRevocationStatus('company-1', 3)

      expect(result.success).toBe(true)
      expect(result.status?.isRevoked).toBe(true)
      expect(result.status?.currentEpoch).toBe(5)
      expect(result.status?.clientEpoch).toBe(3)
      expect(result.status?.epochDifference).toBe(2)
    })

    it('should not detect revocation when epochs match', async () => {
      vi.mocked(KeyRotationService.verifyKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: {
          valid: true,
          currentEpoch: 5,
          clientEpoch: 5,
          message: 'Epoch verification successful',
        },
      })

      const result = await checkRevocationStatus('company-1', 5)

      expect(result.success).toBe(true)
      expect(result.status?.isRevoked).toBe(false)
      expect(result.status?.currentEpoch).toBe(5)
      expect(result.status?.clientEpoch).toBe(5)
      expect(result.status?.epochDifference).toBe(0)
    })

    it('should include appropriate message for single rotation', async () => {
      vi.mocked(KeyRotationService.verifyKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: {
          valid: false,
          currentEpoch: 2,
          clientEpoch: 1,
          message: 'Epoch mismatch',
        },
      })

      const result = await checkRevocationStatus('company-1', 1)

      expect(result.success).toBe(true)
      expect(result.status?.message).toContain('rotated once')
    })

    it('should include appropriate message for multiple rotations', async () => {
      vi.mocked(KeyRotationService.verifyKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: {
          valid: false,
          currentEpoch: 5,
          clientEpoch: 2,
          message: 'Epoch mismatch',
        },
      })

      const result = await checkRevocationStatus('company-1', 2)

      expect(result.success).toBe(true)
      expect(result.status?.message).toContain('rotated 3 times')
    })

    it('should handle verification errors', async () => {
      vi.mocked(KeyRotationService.verifyKeyRotationEpoch).mockResolvedValue({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to verify epoch',
        },
      })

      const result = await checkRevocationStatus('company-1', 3)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to verify epoch')
    })

    it('should include detection timestamp', async () => {
      vi.mocked(KeyRotationService.verifyKeyRotationEpoch).mockResolvedValue({
        success: true,
        data: {
          valid: false,
          currentEpoch: 5,
          clientEpoch: 3,
          message: 'Epoch mismatch',
        },
      })

      const beforeCheck = new Date()
      const result = await checkRevocationStatus('company-1', 3)
      const afterCheck = new Date()

      expect(result.success).toBe(true)
      expect(result.status?.detectedAt).toBeInstanceOf(Date)
      expect(result.status!.detectedAt.getTime()).toBeGreaterThanOrEqual(
        beforeCheck.getTime()
      )
      expect(result.status!.detectedAt.getTime()).toBeLessThanOrEqual(
        afterCheck.getTime()
      )
    })
  })

  describe('getRevokedUserCapabilities', () => {
    it('should return correct capabilities for revoked user', () => {
      const capabilities = getRevokedUserCapabilities()

      expect(capabilities.canViewLocalData).toBe(true)
      expect(capabilities.canSync).toBe(false)
      expect(capabilities.canCreateTransactions).toBe(false)
      expect(capabilities.canModifyTransactions).toBe(false)
      expect(capabilities.canExport).toBe(true)
      expect(capabilities.canAccessHistoricalBackups).toBe(true)
    })
  })

  describe('formatRevocationMessage', () => {
    const mockStatus: RevocationStatus = {
      isRevoked: true,
      currentEpoch: 5,
      clientEpoch: 3,
      epochDifference: 2,
      message: 'Revoked',
      detectedAt: new Date(),
    }

    it('should format full revocation message', () => {
      const message = formatRevocationMessage(mockStatus)

      expect(message).toContain('access to this company account has been revoked')
      expect(message).toContain('What this means:')
      expect(message).toContain('What you can do:')
      expect(message).toContain('Next steps:')
    })

    it('should include admin email if provided', () => {
      const message = formatRevocationMessage(mockStatus, 'admin@company.com')

      expect(message).toContain('admin@company.com')
    })

    it('should not include admin email if not provided', () => {
      const message = formatRevocationMessage(mockStatus)

      expect(message).not.toContain('@')
      expect(message).toContain('company administrator')
    })

    it('should explain what user cannot do', () => {
      const message = formatRevocationMessage(mockStatus)

      expect(message).toContain('no longer sync')
      expect(message).toContain('cannot create or modify')
    })

    it('should explain what user can still do', () => {
      const message = formatRevocationMessage(mockStatus)

      expect(message).toContain('View all your local data')
      expect(message).toContain('Export your local data')
      expect(message).toContain('historical backups')
    })

    it('should return simple message for active user', () => {
      const activeStatus: RevocationStatus = {
        ...mockStatus,
        isRevoked: false,
      }

      const message = formatRevocationMessage(activeStatus)

      expect(message).toBe('Your access is active.')
    })
  })

  describe('formatShortRevocationNotice', () => {
    it('should format short notice with admin email', () => {
      const notice = formatShortRevocationNotice('admin@company.com')

      expect(notice).toContain('access has been revoked')
      expect(notice).toContain('view local data')
      expect(notice).toContain('admin@company.com')
    })

    it('should format short notice without admin email', () => {
      const notice = formatShortRevocationNotice()

      expect(notice).toContain('access has been revoked')
      expect(notice).toContain('administrator')
      expect(notice).not.toContain('@')
    })
  })

  describe('shouldBlockSync', () => {
    it('should block sync for revoked user', () => {
      const revokedStatus: RevocationStatus = {
        isRevoked: true,
        currentEpoch: 5,
        clientEpoch: 3,
        epochDifference: 2,
        message: 'Revoked',
        detectedAt: new Date(),
      }

      expect(shouldBlockSync(revokedStatus)).toBe(true)
    })

    it('should not block sync for active user', () => {
      const activeStatus: RevocationStatus = {
        isRevoked: false,
        currentEpoch: 5,
        clientEpoch: 5,
        epochDifference: 0,
        message: 'Active',
        detectedAt: new Date(),
      }

      expect(shouldBlockSync(activeStatus)).toBe(false)
    })
  })

  describe('canPerformAction', () => {
    const capabilities = getRevokedUserCapabilities()

    it('should allow viewing local data', () => {
      expect(canPerformAction('canViewLocalData', capabilities)).toBe(true)
    })

    it('should not allow sync', () => {
      expect(canPerformAction('canSync', capabilities)).toBe(false)
    })

    it('should not allow creating transactions', () => {
      expect(canPerformAction('canCreateTransactions', capabilities)).toBe(false)
    })

    it('should not allow modifying transactions', () => {
      expect(canPerformAction('canModifyTransactions', capabilities)).toBe(false)
    })

    it('should allow export', () => {
      expect(canPerformAction('canExport', capabilities)).toBe(true)
    })

    it('should allow accessing historical backups', () => {
      expect(canPerformAction('canAccessHistoricalBackups', capabilities)).toBe(
        true
      )
    })
  })

  describe('getSuggestedActions', () => {
    it('should return suggested actions with admin email', () => {
      const actions = getSuggestedActions('admin@company.com')

      expect(actions.length).toBeGreaterThan(0)
      expect(actions[0]).toContain('admin@company.com')
      expect(actions.some((a) => a.includes('Export'))).toBe(true)
      expect(actions.some((a) => a.includes('historical backups'))).toBe(true)
    })

    it('should return suggested actions without admin email', () => {
      const actions = getSuggestedActions()

      expect(actions.length).toBeGreaterThan(0)
      expect(actions[0]).toContain('administrator')
      expect(actions[0]).not.toContain('@')
    })
  })

  describe('revocation acknowledgement', () => {
    const mockStatus: RevocationStatus = {
      isRevoked: true,
      currentEpoch: 5,
      clientEpoch: 3,
      epochDifference: 2,
      message: 'Revoked',
      detectedAt: new Date(),
    }

    it('should record revocation detection', () => {
      recordRevocationDetection('company-1', mockStatus)

      expect(hasAcknowledgedRevocation('company-1')).toBe(true)
    })

    it('should return false for unacknowledged revocation', () => {
      expect(hasAcknowledgedRevocation('company-1')).toBe(false)
    })

    it('should clear revocation acknowledgement', () => {
      recordRevocationDetection('company-1', mockStatus)
      expect(hasAcknowledgedRevocation('company-1')).toBe(true)

      clearRevocationAcknowledgement('company-1')
      expect(hasAcknowledgedRevocation('company-1')).toBe(false)
    })

    it('should store revocation details', () => {
      recordRevocationDetection('company-1', mockStatus)

      const key = 'revocation_detected_company-1'
      const stored = localStorage.getItem(key)
      expect(stored).not.toBeNull()

      const data = JSON.parse(stored!)
      expect(data.currentEpoch).toBe(5)
      expect(data.clientEpoch).toBe(3)
      expect(data.epochDifference).toBe(2)
    })

    it('should be scoped to company', () => {
      recordRevocationDetection('company-1', mockStatus)

      expect(hasAcknowledgedRevocation('company-1')).toBe(true)
      expect(hasAcknowledgedRevocation('company-2')).toBe(false)
    })
  })
})
