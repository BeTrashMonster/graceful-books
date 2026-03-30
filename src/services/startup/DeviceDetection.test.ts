/**
 * Device Detection Service Tests
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 5, Task 5.1:
 * Comprehensive tests for device detection logic.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  detectDeviceStatus,
  getOrCreateDeviceId,
  hasLocalBackups,
  getDeviceInfo,
  getRecommendedFlow,
  clearDeviceId,
  type DeviceStatus,
} from './DeviceDetection'
import { db } from '../../store/database'

describe('DeviceDetection', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.clearAllData()

    // Clear localStorage
    clearDeviceId()

    // Mock window.showDirectoryPicker
    Object.defineProperty(window, 'showDirectoryPicker', {
      value: vi.fn(),
      configurable: true,
      writable: true,
    })

    // Mock navigator.storage
    Object.defineProperty(navigator, 'storage', {
      value: {
        estimate: vi.fn().mockResolvedValue({ usage: 1000, quota: 10000000 }),
      },
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    // Clean up mocks
    delete (window as any).showDirectoryPicker
  })

  describe('detectDeviceStatus', () => {
    it('should detect new device when database is empty', async () => {
      const status = await detectDeviceStatus()

      expect(status.isNewDevice).toBe(true)
      expect(status.hasExistingData).toBe(false)
      expect(status.dataCounts.users).toBe(0)
      expect(status.dataCounts.companies).toBe(0)
      expect(status.dataCounts.transactions).toBe(0)
      expect(status.dataCounts.accounts).toBe(0)
      expect(status.deviceId).toBeTruthy()
      expect(status.detectedAt).toBeGreaterThan(0)
    })

    it('should detect existing device when users exist', async () => {
      // Add a user to database
      await db.users.add({
        id: 'user-1',
        companyId: 'company-1',
        email: 'test@example.com',
        passwordHash: 'hash',
        createdAt: Date.now(),
        lastModifiedAt: Date.now(),
      } as any)

      const status = await detectDeviceStatus()

      expect(status.isNewDevice).toBe(false)
      expect(status.hasExistingData).toBe(true)
      expect(status.dataCounts.users).toBe(1)
    })

    it('should detect existing device when companies exist', async () => {
      // Add a company to database
      await db.companies.add({
        id: 'company-1',
        name: 'Test Company',
        createdAt: Date.now(),
        lastModifiedAt: Date.now(),
      } as any)

      const status = await detectDeviceStatus()

      expect(status.isNewDevice).toBe(false)
      expect(status.hasExistingData).toBe(true)
      expect(status.dataCounts.companies).toBe(1)
    })

    it('should detect existing device when transactions exist', async () => {
      // Add a transaction to database
      await db.transactions.add({
        id: 'txn-1',
        companyId: 'company-1',
        date: Date.now(),
        status: 'posted',
        createdAt: Date.now(),
        lastModifiedAt: Date.now(),
      } as any)

      const status = await detectDeviceStatus()

      expect(status.isNewDevice).toBe(false)
      expect(status.hasExistingData).toBe(true)
      expect(status.dataCounts.transactions).toBe(1)
    })

    it('should respect minimum transaction threshold', async () => {
      // Add a company but no transactions
      await db.companies.add({
        id: 'company-1',
        name: 'Test Company',
        createdAt: Date.now(),
        lastModifiedAt: Date.now(),
      } as any)

      const status = await detectDeviceStatus({
        minTransactionThreshold: 5,
      })

      // Has company, so hasExistingData should be true
      expect(status.hasExistingData).toBe(true)
      expect(status.isNewDevice).toBe(false)
    })

    it('should handle database errors gracefully', async () => {
      // Mock database to throw error
      vi.spyOn(db, 'getStats').mockRejectedValueOnce(new Error('DB error'))

      const status = await detectDeviceStatus()

      // Should default to new device on error
      expect(status.isNewDevice).toBe(true)
      expect(status.hasExistingData).toBe(false)
    })

    it('should check File System Access API availability', async () => {
      const status = await detectDeviceStatus()

      expect(status.canCheckLocalBackups).toBe(true) // Mocked in beforeEach
    })

    it('should skip File System Access check when disabled', async () => {
      const status = await detectDeviceStatus({
        checkFileSystemAccess: false,
      })

      expect(status.canCheckLocalBackups).toBe(false)
    })

    it('should return same device ID on multiple calls', async () => {
      const status1 = await detectDeviceStatus()
      const status2 = await detectDeviceStatus()

      expect(status1.deviceId).toBe(status2.deviceId)
    })
  })

  describe('getOrCreateDeviceId', () => {
    it('should create a new device ID if none exists', async () => {
      const deviceId = await getOrCreateDeviceId()

      expect(deviceId).toBeTruthy()
      expect(typeof deviceId).toBe('string')
      expect(deviceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })

    it('should return existing device ID on subsequent calls', async () => {
      const id1 = await getOrCreateDeviceId()
      const id2 = await getOrCreateDeviceId()

      expect(id1).toBe(id2)
    })

    it('should persist device ID to localStorage', async () => {
      const deviceId = await getOrCreateDeviceId()
      const stored = localStorage.getItem('graceful_books_device_id')

      expect(stored).toBe(deviceId)
    })

    it('should handle localStorage errors gracefully', async () => {
      // Mock localStorage to throw error
      vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
        throw new Error('localStorage unavailable')
      })

      const deviceId = await getOrCreateDeviceId()

      // Should still return a valid ID (ephemeral)
      expect(deviceId).toBeTruthy()
    })
  })

  describe('hasLocalBackups', () => {
    it('should return false when File System Access API unavailable', async () => {
      // Remove the mock to simulate API unavailability
      delete (window as any).showDirectoryPicker

      const result = await hasLocalBackups()

      expect(result).toBe(false)

      // Restore the mock for other tests
      Object.defineProperty(window, 'showDirectoryPicker', {
        value: vi.fn(),
        configurable: true,
        writable: true,
      })
    })

    it('should return false when no backup preferences exist', async () => {
      const result = await hasLocalBackups()

      expect(result).toBe(false)
    })

    it('should return true when local backups are enabled', async () => {
      // Add backup preference
      await db.backupPreferences.add({
        id: 'pref-1',
        userId: 'user-1',
        companyId: 'company-1',
        localBackupEnabled: true,
        lastBackupAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any)

      const result = await hasLocalBackups()

      expect(result).toBe(true)
    })

    it('should return false when local backups are disabled', async () => {
      // Add backup preference with local backups disabled
      await db.backupPreferences.add({
        id: 'pref-1',
        userId: 'user-1',
        companyId: 'company-1',
        localBackupEnabled: false,
        lastBackupAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any)

      const result = await hasLocalBackups()

      expect(result).toBe(false)
    })

    it('should handle database errors gracefully', async () => {
      // Mock database to throw error
      vi.spyOn(db.backupPreferences, 'toArray').mockRejectedValueOnce(new Error('DB error'))

      const result = await hasLocalBackups()

      expect(result).toBe(false)
    })
  })

  describe('getDeviceInfo', () => {
    it('should return device information', () => {
      const info = getDeviceInfo()

      expect(info).toHaveProperty('userAgent')
      expect(info).toHaveProperty('platform')
      expect(info).toHaveProperty('language')
      expect(info).toHaveProperty('screenResolution')
      expect(info).toHaveProperty('timezone')
      expect(info).toHaveProperty('supportsFileSystemAccess')
      expect(info).toHaveProperty('supportsIndexedDB')
      expect(info).toHaveProperty('supportsWebCrypto')
    })

    it('should detect File System Access API support', () => {
      const info = getDeviceInfo()

      expect(info.supportsFileSystemAccess).toBe(true) // Mocked in beforeEach
    })

    it('should detect IndexedDB support', () => {
      const info = getDeviceInfo()

      expect(info.supportsIndexedDB).toBe(true)
    })

    it('should detect Web Crypto API support', () => {
      const info = getDeviceInfo()

      expect(info.supportsWebCrypto).toBe(true)
    })
  })

  describe('getRecommendedFlow', () => {
    it('should recommend dashboard when data exists', () => {
      const status: DeviceStatus = {
        isNewDevice: false,
        hasExistingData: true,
        canCheckLocalBackups: true,
        dataCounts: {
          users: 1,
          companies: 1,
          transactions: 10,
          accounts: 5,
        },
        deviceId: 'device-1',
        detectedAt: Date.now(),
      }

      const flow = getRecommendedFlow(status)

      expect(flow).toBe('dashboard')
    })

    it('should recommend restoration when new device with File System Access', () => {
      const status: DeviceStatus = {
        isNewDevice: true,
        hasExistingData: false,
        canCheckLocalBackups: true,
        dataCounts: {
          users: 0,
          companies: 0,
          transactions: 0,
          accounts: 0,
        },
        deviceId: 'device-1',
        detectedAt: Date.now(),
      }

      const flow = getRecommendedFlow(status)

      expect(flow).toBe('restoration')
    })

    it('should recommend onboarding when new device without File System Access', () => {
      const status: DeviceStatus = {
        isNewDevice: true,
        hasExistingData: false,
        canCheckLocalBackups: false,
        dataCounts: {
          users: 0,
          companies: 0,
          transactions: 0,
          accounts: 0,
        },
        deviceId: 'device-1',
        detectedAt: Date.now(),
      }

      const flow = getRecommendedFlow(status)

      expect(flow).toBe('onboarding')
    })
  })

  describe('clearDeviceId', () => {
    it('should clear device ID from localStorage', async () => {
      // Create device ID
      await getOrCreateDeviceId()
      expect(localStorage.getItem('graceful_books_device_id')).toBeTruthy()

      // Clear it
      clearDeviceId()

      expect(localStorage.getItem('graceful_books_device_id')).toBeNull()
    })

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw error
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
        throw new Error('localStorage unavailable')
      })

      // Should not throw
      expect(() => clearDeviceId()).not.toThrow()
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complete new device scenario', async () => {
      const status = await detectDeviceStatus()
      const flow = getRecommendedFlow(status)
      const info = getDeviceInfo()

      expect(status.isNewDevice).toBe(true)
      expect(flow).toBe('restoration')
      expect(info.supportsIndexedDB).toBe(true)
    })

    it('should handle existing user scenario', async () => {
      // Add some data
      await db.users.add({
        id: 'user-1',
        companyId: 'company-1',
        email: 'test@example.com',
        passwordHash: 'hash',
        createdAt: Date.now(),
        lastModifiedAt: Date.now(),
      } as any)

      await db.transactions.add({
        id: 'txn-1',
        companyId: 'company-1',
        date: Date.now(),
        status: 'posted',
        createdAt: Date.now(),
        lastModifiedAt: Date.now(),
      } as any)

      const status = await detectDeviceStatus()
      const flow = getRecommendedFlow(status)

      expect(status.isNewDevice).toBe(false)
      expect(status.hasExistingData).toBe(true)
      expect(status.dataCounts.users).toBe(1)
      expect(status.dataCounts.transactions).toBe(1)
      expect(flow).toBe('dashboard')
    })

    it('should handle restoration with local backups', async () => {
      // Add backup preference
      await db.backupPreferences.add({
        id: 'pref-1',
        userId: 'user-1',
        companyId: 'company-1',
        localBackupEnabled: true,
        lastBackupAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any)

      const status = await detectDeviceStatus()
      const hasBackups = await hasLocalBackups()
      const flow = getRecommendedFlow(status)

      expect(status.isNewDevice).toBe(true) // No actual data
      expect(hasBackups).toBe(true) // But backups exist
      expect(flow).toBe('restoration')
    })
  })
})
