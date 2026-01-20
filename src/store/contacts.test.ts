/**
 * Contacts Store Unit Tests
 *
 * Tests for vendor management data layer including:
 * - CRUD operations
 * - Data encryption/decryption
 * - Validation
 * - Query filtering
 * - Error handling
 *
 * Per D5: Vendor Management - Basic [MVP]
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  createContact,
  getContact,
  updateContact,
  deleteContact,
  queryContacts,
  batchCreateContacts,
} from './contacts'
import { db } from './database'
import type { Contact, ContactType } from '../types'
import type { EncryptionContext } from './types'

// Mock the database
vi.mock('./database', () => ({
  db: {
    contacts: {
      add: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
      update: vi.fn(),
      where: vi.fn(),
      toArray: vi.fn(),
      toCollection: vi.fn(),
      bulkAdd: vi.fn(),
    },
  },
}))

// Mock localStorage for deviceId
const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

// Mock encryption service
const mockEncryptionService = {
  encrypt: vi.fn((data: string) => {
    try {
      // Handle JSON stringified data
      JSON.parse(data)
      return Promise.resolve(`encrypted_${data}`)
    } catch {
      return Promise.resolve(`encrypted_${data}`)
    }
  }),
  decrypt: vi.fn((data: string) => {
    const decrypted = data.replace('encrypted_', '')
    try {
      JSON.parse(decrypted)
      return Promise.resolve(decrypted)
    } catch {
      return Promise.resolve(decrypted)
    }
  }),
  encryptField: vi.fn(<T>(field: T) => {
    const serialized = JSON.stringify(field)
    return Promise.resolve(`encrypted_${serialized}`)
  }),
  decryptField: vi.fn(<T>(encrypted: string) => {
    const decrypted = encrypted.replace('encrypted_', '')
    return Promise.resolve(JSON.parse(decrypted) as T)
  }),
}

describe('Contacts Store - Vendor Management', () => {
  const mockCompanyId = 'test-company-123'

  const createMockVendor = (overrides?: Partial<Contact>): Omit<Contact, 'id' | 'createdAt' | 'updatedAt'> => ({
    companyId: mockCompanyId,
    type: 'vendor',
    name: 'Test Vendor',
    email: 'vendor@example.com',
    phone: '555-1234',
    address: {
      line1: '123 Main St',
      city: 'Test City',
      state: 'TS',
      postalCode: '12345',
      country: 'US',
    },
    taxId: '12-3456789',
    is1099Eligible: true,
    notes: 'Test notes',
    isActive: true,
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.clear()
    mockLocalStorage.setItem('deviceId', 'test-device-123')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Create Contact', () => {
    it('should create a vendor without encryption', async () => {
      const vendor = createMockVendor()

      vi.mocked(db.contacts.add).mockResolvedValue('vendor-123')

      const result = await createContact(vendor)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Test Vendor')
        expect(result.data.type).toBe('vendor')
        expect(result.data.email).toBe('vendor@example.com')
      }

      expect(db.contacts.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Vendor',
          email: 'vendor@example.com',
          type: 'vendor',
          isActive: true,
        })
      )
    })

    it('should create a vendor with encryption', async () => {
      const vendor = createMockVendor()
      const context: EncryptionContext = {
        encryptionService: mockEncryptionService as any,
      }

      vi.mocked(db.contacts.add).mockImplementation((entity: any) => {
        // Verify encrypted values were stored
        expect(entity.name).toBe('encrypted_Test Vendor')
        return Promise.resolve('vendor-123')
      })

      const result = await createContact(vendor, context)

      expect(result.success).toBe(true)
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('Test Vendor')
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('vendor@example.com')
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('555-1234')
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('12-3456789')

      // Verify the returned data is the original (not encrypted)
      if (result.success) {
        expect(result.data.name).toBe('Test Vendor')
      }
    })

    it('should encrypt vendor address as JSON', async () => {
      const vendor = createMockVendor()
      const context: EncryptionContext = {
        encryptionService: mockEncryptionService as any,
      }

      vi.mocked(db.contacts.add).mockResolvedValue('vendor-123')

      await createContact(vendor, context)

      const addressJson = JSON.stringify(vendor.address)
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(addressJson)
    })

    it('should validate contact type', async () => {
      const vendor = createMockVendor({ type: 'invalid' as ContactType })

      const result = await createContact(vendor)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('Invalid contact type')
      }
    })

    it('should validate email format', async () => {
      const vendor = createMockVendor({ email: 'invalid-email' })

      const result = await createContact(vendor)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toContain('Invalid email format')
      }
    })

    it('should handle missing optional fields', async () => {
      const vendor = createMockVendor({
        email: undefined,
        phone: undefined,
        address: undefined,
        taxId: undefined,
        notes: undefined,
      })

      vi.mocked(db.contacts.add).mockResolvedValue('vendor-123')

      const result = await createContact(vendor)

      expect(result.success).toBe(true)
      expect(db.contacts.add).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Vendor',
          email: undefined,
          phone: undefined,
          address: undefined,
          taxId: undefined,
          notes: undefined,
        })
      )
    })

    it('should initialize version vector for new contacts', async () => {
      const vendor = createMockVendor()

      vi.mocked(db.contacts.add).mockResolvedValue('vendor-123')

      await createContact(vendor)

      expect(db.contacts.add).toHaveBeenCalledWith(
        expect.objectContaining({
          versionVector: { 'test-device-123': 1 },
          lastModifiedBy: 'test-device-123',
        })
      )
    })

    it('should mark encrypted fields in metadata', async () => {
      const vendor = createMockVendor()
      const context: EncryptionContext = {
        encryptionService: mockEncryptionService as any,
      }

      vi.mocked(db.contacts.add).mockImplementation((entity: any) => {
        // Verify encrypted metadata
        expect(entity._encrypted).toEqual({
          name: true,
          email: true,
          phone: true,
          address: true,
          taxId: true,
          notes: true,
        })
        return Promise.resolve('vendor-123')
      })

      await createContact(vendor, context)

      expect(db.contacts.add).toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      const vendor = createMockVendor()

      vi.mocked(db.contacts.add).mockRejectedValue(new Error('Database error'))

      const result = await createContact(vendor)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('UNKNOWN_ERROR')
        expect(result.error.message).toBe('Database error')
      }
    })
  })

  describe('Get Contact', () => {
    it('should retrieve a vendor by ID', async () => {
      const mockEntity = {
        id: 'vendor-123',
        companyId: mockCompanyId,
        type: 'vendor' as const,
        name: 'Test Vendor',
        email: 'vendor@example.com',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        versionVector: { 'test-device-123': 1 },
        lastModifiedBy: 'test-device-123',
        lastModifiedAt: new Date(),
        _encrypted: {},
      }

      vi.mocked(db.contacts.get).mockResolvedValue(mockEntity)

      const result = await getContact('vendor-123')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('vendor-123')
        expect(result.data.name).toBe('Test Vendor')
      }
    })

    it('should return error when vendor not found', async () => {
      vi.mocked(db.contacts.get).mockResolvedValue(undefined)

      const result = await getContact('non-existent-id')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })

    it('should decrypt vendor data when encryption context provided', async () => {
      const mockEntity = {
        id: 'vendor-123',
        companyId: mockCompanyId,
        type: 'vendor' as const,
        name: 'encrypted_Test Vendor',
        email: 'encrypted_vendor@example.com',
        phone: 'encrypted_555-1234',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        versionVector: { 'test-device-123': 1 },
        lastModifiedBy: 'test-device-123',
        lastModifiedAt: new Date(),
        _encrypted: {
          name: true,
          email: true,
          phone: true,
        },
      }

      vi.mocked(db.contacts.get).mockResolvedValue(mockEntity)

      const context: EncryptionContext = {
        encryptionService: mockEncryptionService as any,
      }

      const result = await getContact('vendor-123', context)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted_Test Vendor')
        expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted_vendor@example.com')
        expect(result.data.name).toBe('Test Vendor')
        expect(result.data.email).toBe('vendor@example.com')
      }
    })
  })

  describe('Update Contact', () => {
    it('should update vendor fields', async () => {
      const existingEntity = {
        id: 'vendor-123',
        companyId: mockCompanyId,
        type: 'vendor' as const,
        name: 'Old Name',
        email: 'old@example.com',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        versionVector: { 'test-device-123': 1 },
        lastModifiedBy: 'test-device-123',
        lastModifiedAt: new Date(),
        _encrypted: {},
      }

      vi.mocked(db.contacts.get).mockResolvedValue(existingEntity)
      vi.mocked(db.contacts.put).mockResolvedValue('vendor-123')

      const result = await updateContact('vendor-123', {
        name: 'New Name',
        email: 'new@example.com',
      })

      expect(result.success).toBe(true)
      expect(db.contacts.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'vendor-123',
          name: 'New Name',
          email: 'new@example.com',
          versionVector: { 'test-device-123': 2 }, // Incremented
        })
      )
    })

    it('should encrypt updated fields', async () => {
      const existingEntity = {
        id: 'vendor-123',
        companyId: mockCompanyId,
        type: 'vendor' as const,
        name: 'Old Name',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        versionVector: { 'test-device-123': 1 },
        lastModifiedBy: 'test-device-123',
        lastModifiedAt: new Date(),
        _encrypted: { name: true },
      }

      vi.mocked(db.contacts.get).mockResolvedValue(existingEntity)
      vi.mocked(db.contacts.put).mockResolvedValue('vendor-123')

      const context: EncryptionContext = {
        encryptionService: mockEncryptionService as any,
      }

      await updateContact('vendor-123', { name: 'New Name' }, context)

      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('New Name')
      expect(db.contacts.put).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'encrypted_New Name',
        })
      )
    })

    it('should return error when vendor not found', async () => {
      vi.mocked(db.contacts.get).mockResolvedValue(undefined)

      const result = await updateContact('non-existent-id', { name: 'New Name' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })

    it('should increment version vector on update', async () => {
      const existingEntity = {
        id: 'vendor-123',
        companyId: mockCompanyId,
        type: 'vendor' as const,
        name: 'Test Vendor',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        versionVector: { 'device-1': 5, 'device-2': 3 },
        lastModifiedBy: 'device-1',
        lastModifiedAt: new Date(),
        _encrypted: {},
      }

      vi.mocked(db.contacts.get).mockResolvedValue(existingEntity)
      vi.mocked(db.contacts.put).mockResolvedValue('vendor-123')

      await updateContact('vendor-123', { name: 'Updated Name' })

      expect(db.contacts.put).toHaveBeenCalledWith(
        expect.objectContaining({
          versionVector: {
            'device-1': 5,
            'device-2': 3,
            'test-device-123': 1, // New device adds entry
          },
        })
      )
    })
  })

  describe('Delete Contact (Soft Delete)', () => {
    it('should soft delete a vendor', async () => {
      const existingEntity = {
        id: 'vendor-123',
        companyId: mockCompanyId,
        type: 'vendor' as const,
        name: 'Test Vendor',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        versionVector: { 'test-device-123': 1 },
        lastModifiedBy: 'test-device-123',
        lastModifiedAt: new Date(),
        _encrypted: {},
      }

      vi.mocked(db.contacts.get).mockResolvedValue(existingEntity)
      vi.mocked(db.contacts.update).mockResolvedValue(1)

      const result = await deleteContact('vendor-123')

      expect(result.success).toBe(true)
      expect(db.contacts.update).toHaveBeenCalledWith(
        'vendor-123',
        expect.objectContaining({
          deletedAt: expect.any(Date),
        })
      )
    })

    it('should return error when vendor not found', async () => {
      vi.mocked(db.contacts.get).mockResolvedValue(undefined)

      const result = await deleteContact('non-existent-id')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('Query Contacts', () => {
    it('should query vendors by company ID', async () => {
      const mockEntities = [
        {
          id: 'vendor-1',
          companyId: mockCompanyId,
          type: 'vendor' as const,
          name: 'Vendor 1',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          versionVector: {},
          lastModifiedBy: 'test-device-123',
          lastModifiedAt: new Date(),
          _encrypted: {},
        },
        {
          id: 'vendor-2',
          companyId: mockCompanyId,
          type: 'vendor' as const,
          name: 'Vendor 2',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          versionVector: {},
          lastModifiedBy: 'test-device-123',
          lastModifiedAt: new Date(),
          _encrypted: {},
        },
      ]

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          and: vi.fn().mockReturnThis(),
          toArray: vi.fn().mockResolvedValue(mockEntities),
        }),
      }

      vi.mocked(db.contacts.where).mockReturnValue(mockWhere as any)

      const result = await queryContacts({ companyId: mockCompanyId, type: 'vendor' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect((result as any).data).toHaveLength(2)
        expect(result.data[0].name).toBe('Vendor 1')
      }
    })

    it('should filter by active status', async () => {
      const mockEntities = [
        {
          id: 'vendor-1',
          companyId: mockCompanyId,
          type: 'vendor' as const,
          name: 'Active Vendor',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          versionVector: {},
          lastModifiedBy: 'test-device-123',
          lastModifiedAt: new Date(),
          _encrypted: {},
        },
      ]

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          and: vi.fn().mockReturnThis(),
          toArray: vi.fn().mockResolvedValue(mockEntities),
        }),
      }

      vi.mocked(db.contacts.where).mockReturnValue(mockWhere as any)

      const result = await queryContacts({
        companyId: mockCompanyId,
        type: 'vendor',
        isActive: true,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect((result as any).data).toHaveLength(1)
        expect(result.data[0].isActive).toBe(true)
      }
    })

    it('should exclude deleted contacts by default', async () => {
      const mockEntities = [
        {
          id: 'vendor-1',
          companyId: mockCompanyId,
          type: 'vendor' as const,
          name: 'Active Vendor',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: undefined,
          versionVector: {},
          lastModifiedBy: 'test-device-123',
          lastModifiedAt: new Date(),
          _encrypted: {},
        },
      ]

      const mockWhere = {
        equals: vi.fn().mockReturnValue({
          and: vi.fn().mockReturnThis(),
          toArray: vi.fn().mockResolvedValue(mockEntities),
        }),
      }

      vi.mocked(db.contacts.where).mockReturnValue(mockWhere as any)

      const result = await queryContacts({
        companyId: mockCompanyId,
        type: 'vendor',
        includeDeleted: false,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.every((c) => !c.deletedAt)).toBe(true)
      }
    })
  })

  describe('Batch Create Contacts', () => {
    it('should batch create multiple vendors', async () => {
      const vendors = [
        createMockVendor({ name: 'Vendor 1' }),
        createMockVendor({ name: 'Vendor 2' }),
        createMockVendor({ name: 'Vendor 3' }),
      ]

      vi.mocked(db.contacts.add).mockResolvedValue('vendor-id')

      const result = await batchCreateContacts(vendors)

      expect(result.successful).toHaveLength(3)
      expect(result.failed).toHaveLength(0)
      expect(db.contacts.add).toHaveBeenCalledTimes(3)
    })

    it('should batch create with encryption', async () => {
      const vendors = [
        createMockVendor({ name: 'Vendor 1' }),
        createMockVendor({ name: 'Vendor 2' }),
      ]

      const context: EncryptionContext = {
        encryptionService: mockEncryptionService as any,
      }

      vi.mocked(db.contacts.add).mockResolvedValue('vendor-id')

      const result = await batchCreateContacts(vendors, context)

      expect(result.successful).toHaveLength(2)
      expect(mockEncryptionService.encrypt).toHaveBeenCalled()
      expect(db.contacts.add).toHaveBeenCalledTimes(2)
    })

    it('should handle partial failures gracefully', async () => {
      const vendors = [
        createMockVendor({ name: 'Valid Vendor' }),
        createMockVendor({ type: 'invalid' as ContactType, name: 'Invalid Vendor' }),
        createMockVendor({ email: 'invalid-email', name: 'Bad Email Vendor' }),
      ]

      vi.mocked(db.contacts.bulkAdd).mockResolvedValue('1')

      const result = await batchCreateContacts(vendors)

      expect(result.successful.length).toBeGreaterThan(0)
      expect(result.failed.length).toBeGreaterThan(0)
      expect(result.failed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
          }),
        ])
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle vendor with all contact types (both)', async () => {
      const contact = createMockVendor({ type: 'both' })

      vi.mocked(db.contacts.add).mockResolvedValue('contact-123')

      const result = await createContact(contact)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.type).toBe('both')
      }
    })

    it('should handle 1099 eligible vendors', async () => {
      const vendor = createMockVendor({ is1099Eligible: true })

      vi.mocked(db.contacts.add).mockResolvedValue('vendor-123')

      const result = await createContact(vendor)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.is1099Eligible).toBe(true)
      }
    })

    it('should handle vendors with special characters in name', async () => {
      const vendor = createMockVendor({ name: "O'Reilly & Sons, Inc." })

      vi.mocked(db.contacts.add).mockResolvedValue('vendor-123')

      const result = await createContact(vendor)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe("O'Reilly & Sons, Inc.")
      }
    })

    it('should handle very long vendor names', async () => {
      const longName = 'A'.repeat(500)
      const vendor = createMockVendor({ name: longName })

      vi.mocked(db.contacts.add).mockResolvedValue('vendor-123')

      const result = await createContact(vendor)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe(longName)
      }
    })

    it('should handle international addresses', async () => {
      const vendor = createMockVendor({
        address: {
          line1: '1-2-3 Shibuya',
          city: 'Tokyo',
          state: 'Tokyo',
          postalCode: '150-0002',
          country: 'JP',
        },
      })

      vi.mocked(db.contacts.add).mockResolvedValue('vendor-123')

      const result = await createContact(vendor)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.address?.country).toBe('JP')
      }
    })

    it('should handle vendors with null optional fields', async () => {
      const vendor = createMockVendor({
        email: undefined,
        phone: undefined,
        address: undefined,
        taxId: undefined,
        notes: undefined,
        is1099Eligible: false,
      })

      vi.mocked(db.contacts.add).mockResolvedValue('vendor-123')

      const result = await createContact(vendor)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBeUndefined()
        expect(result.data.phone).toBeUndefined()
        expect(result.data.taxId).toBeUndefined()
      }
    })
  })
})
