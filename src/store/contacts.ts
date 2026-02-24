/**
 * Contacts Data Access Layer
 *
 * Provides CRUD operations for customers and vendors with:
 * - Encryption/decryption integration points
 * - CRDT version vector management
 * - Soft delete with tombstone markers
 * - Query builders for common operations
 */

import { nanoid } from 'nanoid'
import { db } from './database'
import type {
  ContactEntity,
  ContactFilter,
  DatabaseResult,
  DatabaseError,
  EncryptionContext,
  VersionVector,
  BatchResult,
} from './types'
import type { Contact, ContactType } from '../types'
import { requireCompanyOwnership, validateCompanyId } from '../utils/authorization'

/**
 * Generate current device ID (stored in localStorage)
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId')
  if (!deviceId) {
    deviceId = nanoid()
    localStorage.setItem('deviceId', deviceId)
  }
  return deviceId
}

/**
 * Initialize version vector for a new entity
 */
function initVersionVector(): VersionVector {
  const deviceId = getDeviceId()
  return { [deviceId]: 1 }
}

/**
 * Increment version vector for an update
 */
function incrementVersionVector(current: VersionVector): VersionVector {
  const deviceId = getDeviceId()
  return {
    ...current,
    [deviceId]: (current[deviceId] || 0) + 1,
  }
}

/**
 * Convert Contact to ContactEntity (adds CRDT fields)
 */
function toContactEntity(
  contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
    id?: string
    createdAt?: Date
    updatedAt?: Date
  }
): ContactEntity {
  const now = new Date()
  const deviceId = getDeviceId()

  return {
    id: contact.id || nanoid(),
    companyId: contact.companyId,
    type: contact.type,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    address: contact.address,
    taxId: contact.taxId,
    is1099Eligible: contact.is1099Eligible,
    notes: contact.notes,
    isActive: contact.isActive,
    createdAt: contact.createdAt || now,
    updatedAt: now,
    deletedAt: undefined,
    versionVector: initVersionVector(),
    lastModifiedBy: deviceId,
    lastModifiedAt: now,
    _encrypted: {
      name: true,
      email: true,
      phone: true,
      address: true,
      taxId: true,
      notes: true,
    },
  }
}

/**
 * Convert ContactEntity to Contact (removes CRDT fields)
 */
function fromContactEntity(entity: ContactEntity): Contact {
  return {
    id: entity.id,
    companyId: entity.companyId,
    type: entity.type,
    name: entity.name,
    email: entity.email,
    phone: entity.phone,
    address: entity.address,
    taxId: entity.taxId,
    is1099Eligible: entity.is1099Eligible,
    notes: entity.notes,
    isActive: entity.isActive,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt,
  }
}

/**
 * Create a new contact
 */
export async function createContact(
  contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  context?: EncryptionContext
): Promise<DatabaseResult<Contact>> {
  try {
    // Validate contact type
    const validTypes: ContactType[] = ['customer', 'vendor', 'both']
    if (!validTypes.includes(contact.type)) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid contact type: ${contact.type}`,
        },
      }
    }

    // Validate email format if provided
    if (contact.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(contact.email)) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email format',
          },
        }
      }
    }

    // Create entity with CRDT fields
    let entity = toContactEntity(contact)

    // Keep original entity for return value
    const originalEntity = { ...entity }

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context
      entity = {
        ...entity,
        name: await encryptionService.encrypt(entity.name),
        email: entity.email
          ? await encryptionService.encrypt(entity.email)
          : undefined,
        phone: entity.phone
          ? await encryptionService.encrypt(entity.phone)
          : undefined,
        address: entity.address
          ? await encryptionService.encrypt(typeof entity.address === 'string' ? entity.address : JSON.stringify(entity.address))
          : undefined,
        taxId: entity.taxId
          ? await encryptionService.encrypt(entity.taxId)
          : undefined,
        notes: entity.notes
          ? await encryptionService.encrypt(entity.notes)
          : undefined,
        _encrypted: {
          name: true,
          email: !!entity.email,
          phone: !!entity.phone,
          address: !!entity.address,
          taxId: !!entity.taxId,
          notes: !!entity.notes,
        },
      } as any
    }

    // Store in database
    await db.contacts.add(entity)

    // Return original unencrypted contact
    const result = fromContactEntity(originalEntity)
    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Get contact by ID
 *
 * SECURITY: Requires companyId for authorization to prevent IDOR attacks
 */
export async function getContact(
  id: string,
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Contact>> {
  try {
    // SECURITY: Validate companyId is provided
    const companyIdError = validateCompanyId(companyId)
    if (companyIdError) {
      return { success: false, error: companyIdError }
    }

    const entity = await db.contacts.get(id)

    // SECURITY: Verify resource ownership before allowing access
    const authCheck = requireCompanyOwnership(entity, companyId)
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const authorizedEntity = authCheck.resource

    // Check if soft deleted
    if (authorizedEntity.deletedAt) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Contact has been deleted: ${id}`,
        },
      }
    }

    // Decrypt if service provided
    let result = authorizedEntity
    if (context?.encryptionService) {
      const { encryptionService } = context
      result = {
        ...authorizedEntity,
        name: await encryptionService.decrypt(authorizedEntity.name),
        email: authorizedEntity.email
          ? await encryptionService.decrypt(authorizedEntity.email)
          : undefined,
        phone: authorizedEntity.phone
          ? await encryptionService.decrypt(authorizedEntity.phone)
          : undefined,
        address: authorizedEntity.address
          ? JSON.parse(
              await encryptionService.decrypt(JSON.stringify(authorizedEntity.address))
            )
          : undefined,
        taxId: authorizedEntity.taxId
          ? await encryptionService.decrypt(authorizedEntity.taxId)
          : undefined,
        notes: authorizedEntity.notes
          ? await encryptionService.decrypt(authorizedEntity.notes)
          : undefined,
      }
    }

    return { success: true, data: fromContactEntity(result) }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Update an existing contact
 *
 * SECURITY: Requires companyId for authorization to prevent IDOR attacks
 */
export async function updateContact(
  id: string,
  companyId: string,
  updates: Partial<Omit<Contact, 'id' | 'companyId' | 'createdAt'>>,
  context?: EncryptionContext
): Promise<DatabaseResult<Contact>> {
  try {
    // SECURITY: Validate companyId is provided
    const companyIdError = validateCompanyId(companyId)
    if (companyIdError) {
      return { success: false, error: companyIdError }
    }

    const existing = await db.contacts.get(id)

    // SECURITY: Verify resource ownership before allowing access
    const authCheck = requireCompanyOwnership(existing, companyId)
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const authorizedEntity = authCheck.resource

    if (authorizedEntity.deletedAt) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Contact has been deleted: ${id}`,
        },
      }
    }

    // Validate email format if provided
    if (updates.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(updates.email)) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email format',
          },
        }
      }
    }

    // Prepare updated entity
    const now = new Date()
    const deviceId = getDeviceId()

    const updated: ContactEntity = {
      ...authorizedEntity,
      ...updates,
      id, // Ensure ID doesn't change
      companyId: authorizedEntity.companyId, // Ensure companyId doesn't change
      createdAt: authorizedEntity.createdAt, // Preserve creation date
      updatedAt: now,
      versionVector: incrementVersionVector(authorizedEntity.versionVector),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
    }

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context
      if (updates.name) {
        updated.name = await encryptionService.encrypt(updates.name)
      }
      if (updates.email !== undefined) {
        updated.email = updates.email
          ? await encryptionService.encrypt(updates.email)
          : undefined
      }
      if (updates.phone !== undefined) {
        updated.phone = updates.phone
          ? await encryptionService.encrypt(updates.phone)
          : undefined
      }
      if (updates.address !== undefined) {
        updated.address = updates.address
          ? JSON.parse(
              await encryptionService.encrypt(JSON.stringify(updates.address))
            )
          : undefined
      }
      if (updates.taxId !== undefined) {
        updated.taxId = updates.taxId
          ? await encryptionService.encrypt(updates.taxId)
          : undefined
      }
      if (updates.notes !== undefined) {
        updated.notes = updates.notes
          ? await encryptionService.encrypt(updates.notes)
          : undefined
      }
    }

    // Update in database
    await db.contacts.put(updated)

    // Decrypt for return
    let result = updated
    if (context?.encryptionService) {
      const { encryptionService } = context
      result = {
        ...updated,
        name: await encryptionService.decrypt(updated.name),
        email: updated.email
          ? await encryptionService.decrypt(updated.email)
          : undefined,
        phone: updated.phone
          ? await encryptionService.decrypt(updated.phone)
          : undefined,
        address: updated.address
          ? JSON.parse(
              await encryptionService.decrypt(JSON.stringify(updated.address))
            )
          : undefined,
        taxId: updated.taxId
          ? await encryptionService.decrypt(updated.taxId)
          : undefined,
        notes: updated.notes
          ? await encryptionService.decrypt(updated.notes)
          : undefined,
      }
    }

    return { success: true, data: fromContactEntity(result) }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Delete a contact (soft delete with tombstone)
 *
 * SECURITY: Requires companyId for authorization to prevent IDOR attacks
 */
export async function deleteContact(
  id: string,
  companyId: string
): Promise<DatabaseResult<void>> {
  try {
    // SECURITY: Validate companyId is provided
    const companyIdError = validateCompanyId(companyId)
    if (companyIdError) {
      return { success: false, error: companyIdError }
    }

    const existing = await db.contacts.get(id)

    // SECURITY: Verify resource ownership before allowing access
    const authCheck = requireCompanyOwnership(existing, companyId)
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const authorizedEntity = authCheck.resource

    if (authorizedEntity.deletedAt) {
      return { success: true, data: undefined } // Already deleted
    }

    // Soft delete with tombstone marker
    const now = new Date()
    const deviceId = getDeviceId()

    await db.contacts.update(id, {
      deletedAt: now,
      versionVector: incrementVersionVector(authorizedEntity.versionVector),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
    })

    return { success: true, data: undefined }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Query contacts with filters
 *
 * SECURITY: Requires companyId as mandatory parameter to prevent unauthorized cross-company access
 */
export async function queryContacts(
  companyId: string,
  filter?: Omit<ContactFilter, 'companyId'>,
  context?: EncryptionContext
): Promise<DatabaseResult<Contact[]>> {
  try {
    // SECURITY: Validate companyId is provided
    const companyIdError = validateCompanyId(companyId)
    if (companyIdError) {
      return { success: false, error: companyIdError }
    }

    let query = db.contacts.toCollection()

    // SECURITY: Always filter by companyId first (required)
    if (filter?.type) {
      query = db.contacts
        .where('[companyId+type]')
        .equals([companyId, filter.type])
    } else if (filter?.isActive !== undefined) {
      query = db.contacts
        .where('[companyId+isActive]')
        .equals([companyId, filter.isActive] as any)
    } else {
      query = db.contacts.where('companyId').equals(companyId)
    }

    // Filter out deleted unless explicitly requested
    if (!filter?.includeDeleted) {
      query = query.and((contact) => !contact.deletedAt)
    }

    const entities = await query.toArray()

    // Decrypt if service provided
    let results = entities
    if (context?.encryptionService) {
      const { encryptionService } = context
      results = await Promise.all(
        entities.map(async (entity) => ({
          ...entity,
          name: await encryptionService.decrypt(entity.name),
          email: entity.email
            ? await encryptionService.decrypt(entity.email)
            : undefined,
          phone: entity.phone
            ? await encryptionService.decrypt(entity.phone)
            : undefined,
          address: entity.address
            ? JSON.parse(
                await encryptionService.decrypt(JSON.stringify(entity.address))
              )
            : undefined,
          taxId: entity.taxId
            ? await encryptionService.decrypt(entity.taxId)
            : undefined,
          notes: entity.notes
            ? await encryptionService.decrypt(entity.notes)
            : undefined,
        }))
      )
    }

    return {
      success: true,
      data: results.map(fromContactEntity),
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Get all customers for a company
 */
export async function getCustomers(
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Contact[]>> {
  return queryContacts(
    companyId,
    { type: 'customer', isActive: true },
    context
  )
}

/**
 * Get all vendors for a company
 */
export async function getVendors(
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Contact[]>> {
  return queryContacts(
    companyId,
    { type: 'vendor', isActive: true },
    context
  )
}

/**
 * Get 1099-eligible vendors for a company
 */
export async function get1099Vendors(
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Contact[]>> {
  const result = await queryContacts(
    companyId,
    { type: 'vendor', isActive: true },
    context
  )

  if (!result.success) {
    return result
  }

  const eligible = result.data.filter((contact) => contact.is1099Eligible)
  return { success: true, data: eligible }
}

/**
 * Batch create contacts
 *
 * SECURITY: Validates all contacts have same companyId to prevent bulk unauthorized writes
 */
export async function batchCreateContacts(
  companyId: string,
  contacts: Array<Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>,
  context?: EncryptionContext
): Promise<BatchResult<Contact>> {
  const successful: Contact[] = []
  const failed: Array<{ item: Contact; error: DatabaseError }> = []

  // SECURITY: Validate companyId is provided
  const companyIdError = validateCompanyId(companyId)
  if (companyIdError) {
    // Return all items as failed with validation error
    return {
      successful: [],
      failed: contacts.map((contact) => ({
        item: {
          ...contact,
          id: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        error: companyIdError,
      })),
    }
  }

  // SECURITY: Verify all contacts have correct companyId before processing
  const invalidItems = contacts.filter((contact) => contact.companyId !== companyId)
  if (invalidItems.length > 0) {
    const mismatchError: DatabaseError = {
      code: 'VALIDATION_ERROR',
      message: `Company ID mismatch detected in batch operation. All items must belong to company: ${companyId}`,
    }
    // Return all items as failed - reject entire batch
    return {
      successful: [],
      failed: contacts.map((contact) => ({
        item: {
          ...contact,
          id: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        error: mismatchError,
      })),
    }
  }

  // All items validated - proceed with batch creation
  for (const contact of contacts) {
    const result = await createContact(contact, context)
    if (result.success) {
      successful.push(result.data)
    } else {
      const errorInfo = 'error' in result ? result.error : { code: 'UNKNOWN_ERROR' as const, message: 'Unknown error' }
      failed.push({
        item: {
          ...contact,
          id: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        error: errorInfo,
      })
    }
  }

  return { successful, failed }
}
