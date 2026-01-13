/**
 * Users Data Access Layer
 *
 * Provides CRUD operations for user profiles with:
 * - Encryption/decryption integration points
 * - Password hashing support (Argon2)
 * - CRDT version vector management
 * - Soft delete with tombstone markers
 */

import { nanoid } from 'nanoid'
import { db } from './database'
import type {
  UserEntity,
  DatabaseResult,
  EncryptionContext,
  VersionVector,
} from './types'
import type { UserProfile } from '../types'

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
 * Convert UserProfile to UserEntity (adds CRDT fields)
 */
function toUserEntity(
  user: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string
    createdAt?: Date
    updatedAt?: Date
    passwordHash?: string
    salt?: string
    encryptedMasterKey?: string
  }
): UserEntity {
  const now = new Date()
  const deviceId = getDeviceId()

  return {
    id: user.id || nanoid(),
    companyId: user.companyId,
    email: user.email,
    name: user.name,
    role: user.role,
    phase: user.phase,
    createdAt: user.createdAt || now,
    updatedAt: now,
    deletedAt: undefined,
    versionVector: initVersionVector(),
    lastModifiedBy: deviceId,
    lastModifiedAt: now,
    passwordHash: user.passwordHash,
    salt: user.salt,
    encryptedMasterKey: user.encryptedMasterKey,
    lastLoginAt: undefined,
    _encrypted: {
      email: true,
      name: true,
    },
  }
}

/**
 * Convert UserEntity to UserProfile (removes CRDT and auth fields)
 */
function fromUserEntity(entity: UserEntity): UserProfile {
  return {
    id: entity.id,
    companyId: entity.companyId,
    email: entity.email,
    name: entity.name,
    role: entity.role,
    phase: entity.phase,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  }
}

/**
 * Create a new user
 */
export async function createUser(
  user: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> & {
    passwordHash?: string
    salt?: string
    encryptedMasterKey?: string
  },
  context?: EncryptionContext
): Promise<DatabaseResult<UserProfile>> {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(user.email)) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format',
        },
      }
    }

    // Check for duplicate email in the same company
    const existing = await db.users
      .where('[companyId+email]')
      .equals([user.companyId, user.email])
      .and((u) => !u.deletedAt)
      .first()

    if (existing) {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Email already exists in this company',
        },
      }
    }

    // Create entity with CRDT fields
    let entity = toUserEntity(user)

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context
      entity = {
        ...entity,
        email: await encryptionService.encrypt(entity.email),
        name: await encryptionService.encrypt(entity.name),
      }
    }

    // Store in database
    await db.users.add(entity)

    // Return decrypted user
    const result = fromUserEntity(entity)
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
 * Get user by ID
 */
export async function getUser(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<UserProfile>> {
  try {
    const entity = await db.users.get(id)

    if (!entity) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `User not found: ${id}`,
        },
      }
    }

    // Check if soft deleted
    if (entity.deletedAt) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `User has been deleted: ${id}`,
        },
      }
    }

    // Decrypt if service provided
    let result = entity
    if (context?.encryptionService) {
      const { encryptionService } = context
      result = {
        ...entity,
        email: await encryptionService.decrypt(entity.email),
        name: await encryptionService.decrypt(entity.name),
      }
    }

    return { success: true, data: fromUserEntity(result) }
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
 * Get user by email (for authentication)
 */
export async function getUserByEmail(
  companyId: string,
  email: string,
  context?: EncryptionContext
): Promise<DatabaseResult<UserProfile & { passwordHash?: string; salt?: string; encryptedMasterKey?: string }>> {
  try {
    // Note: This requires email to be in plaintext or searchable encrypted format
    // For production, consider using a hash-based lookup
    const entities = await db.users
      .where('companyId')
      .equals(companyId)
      .and((u) => !u.deletedAt)
      .toArray()

    let found: UserEntity | undefined

    if (context?.encryptionService) {
      // Decrypt each email to find match
      const { encryptionService } = context
      for (const entity of entities) {
        const decryptedEmail = await encryptionService.decrypt(entity.email)
        if (decryptedEmail === email) {
          found = entity
          break
        }
      }
    } else {
      // Direct match if not encrypted
      found = entities.find((u) => u.email === email)
    }

    if (!found) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found with this email',
        },
      }
    }

    // Decrypt if service provided
    let result = found
    if (context?.encryptionService) {
      const { encryptionService } = context
      result = {
        ...found,
        email: await encryptionService.decrypt(found.email),
        name: await encryptionService.decrypt(found.name),
      }
    }

    return {
      success: true,
      data: {
        ...fromUserEntity(result),
        passwordHash: result.passwordHash,
        salt: result.salt,
        encryptedMasterKey: result.encryptedMasterKey,
      },
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
 * Update an existing user
 */
export async function updateUser(
  id: string,
  updates: Partial<Omit<UserProfile, 'id' | 'companyId' | 'createdAt'>>,
  context?: EncryptionContext
): Promise<DatabaseResult<UserProfile>> {
  try {
    const existing = await db.users.get(id)

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `User not found: ${id}`,
        },
      }
    }

    if (existing.deletedAt) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `User has been deleted: ${id}`,
        },
      }
    }

    // Validate email format if updating email
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

      // Check for duplicate email if changing
      if (updates.email !== existing.email) {
        const duplicate = await db.users
          .where('[companyId+email]')
          .equals([existing.companyId, updates.email])
          .and((u) => u.id !== id && !u.deletedAt)
          .first()

        if (duplicate) {
          return {
            success: false,
            error: {
              code: 'CONSTRAINT_VIOLATION',
              message: 'Email already exists in this company',
            },
          }
        }
      }
    }

    // Prepare updated entity
    const now = new Date()
    const deviceId = getDeviceId()

    const updated: UserEntity = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      companyId: existing.companyId, // Ensure companyId doesn't change
      createdAt: existing.createdAt, // Preserve creation date
      updatedAt: now,
      versionVector: incrementVersionVector(existing.versionVector),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
    }

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context
      if (updates.email) {
        updated.email = await encryptionService.encrypt(updates.email)
      }
      if (updates.name) {
        updated.name = await encryptionService.encrypt(updates.name)
      }
    }

    // Update in database
    await db.users.put(updated)

    // Decrypt for return
    let result = updated
    if (context?.encryptionService) {
      const { encryptionService } = context
      result = {
        ...updated,
        email: await encryptionService.decrypt(updated.email),
        name: await encryptionService.decrypt(updated.name),
      }
    }

    return { success: true, data: fromUserEntity(result) }
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
 * Update user password hash and salt
 */
export async function updateUserPassword(
  id: string,
  passwordHash: string,
  salt: string,
  encryptedMasterKey?: string
): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.users.get(id)

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `User not found: ${id}`,
        },
      }
    }

    if (existing.deletedAt) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `User has been deleted: ${id}`,
        },
      }
    }

    const now = new Date()
    const deviceId = getDeviceId()

    await db.users.update(id, {
      passwordHash,
      salt,
      encryptedMasterKey,
      updatedAt: now,
      versionVector: incrementVersionVector(existing.versionVector),
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
 * Update last login timestamp
 */
export async function updateLastLogin(id: string): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.users.get(id)

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `User not found: ${id}`,
        },
      }
    }

    await db.users.update(id, {
      lastLoginAt: new Date(),
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
 * Delete a user (soft delete with tombstone)
 */
export async function deleteUser(
  id: string
): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.users.get(id)

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `User not found: ${id}`,
        },
      }
    }

    if (existing.deletedAt) {
      return { success: true, data: undefined } // Already deleted
    }

    // Check if this is the last admin user in the company
    const adminCount = await db.users
      .where('companyId')
      .equals(existing.companyId)
      .and((u) => u.role === 'admin' && !u.deletedAt)
      .count()

    if (existing.role === 'admin' && adminCount <= 1) {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Cannot delete the last admin user',
        },
      }
    }

    // Soft delete with tombstone marker
    const now = new Date()
    const deviceId = getDeviceId()

    await db.users.update(id, {
      deletedAt: now,
      versionVector: incrementVersionVector(existing.versionVector),
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
 * Get all users for a company
 */
export async function getCompanyUsers(
  companyId: string,
  includeDeleted: boolean = false,
  context?: EncryptionContext
): Promise<DatabaseResult<UserProfile[]>> {
  try {
    let query = db.users.where('companyId').equals(companyId)

    if (!includeDeleted) {
      query = query.and((u) => !u.deletedAt)
    }

    const entities = await query.toArray()

    // Decrypt if service provided
    let results = entities
    if (context?.encryptionService) {
      const { encryptionService } = context
      results = await Promise.all(
        entities.map(async (entity) => ({
          ...entity,
          email: await encryptionService.decrypt(entity.email),
          name: await encryptionService.decrypt(entity.name),
        }))
      )
    }

    return {
      success: true,
      data: results.map(fromUserEntity),
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
