/**
 * Accounts Data Access Layer
 *
 * Provides CRUD operations for the Chart of Accounts with:
 * - Encryption/decryption integration points
 * - CRDT version vector management
 * - Soft delete with tombstone markers
 * - Query builders for common operations
 */

import { nanoid } from 'nanoid'
import { db } from './database'
import type {
  AccountEntity,
  AccountFilter,
  DatabaseResult,
  DatabaseError,
  EncryptionContext,
  VersionVector,
  BatchResult,
} from './types'
import type { Account, AccountType } from '../types'

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
 * Convert Account to AccountEntity (adds CRDT fields)
 */
function toAccountEntity(
  account: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
    id?: string
    createdAt?: Date
    updatedAt?: Date
  }
): AccountEntity {
  const now = new Date()
  const deviceId = getDeviceId()

  return {
    id: account.id || nanoid(),
    companyId: account.companyId,
    name: account.name,
    accountNumber: account.accountNumber,
    type: account.type,
    subType: account.subType,
    parentAccountId: account.parentAccountId,
    description: account.description,
    isActive: account.isActive,
    balance: account.balance,
    createdAt: account.createdAt || now,
    updatedAt: now,
    deletedAt: undefined,
    versionVector: initVersionVector(),
    lastModifiedBy: deviceId,
    lastModifiedAt: now,
    _encrypted: {
      name: true,
      balance: true,
      description: true,
    },
  }
}

/**
 * Convert AccountEntity to Account (removes CRDT fields)
 */
function fromAccountEntity(entity: AccountEntity): Account {
  return {
    id: entity.id,
    companyId: entity.companyId,
    name: entity.name,
    accountNumber: entity.accountNumber,
    type: entity.type,
    subType: entity.subType,
    parentAccountId: entity.parentAccountId,
    description: entity.description,
    isActive: entity.isActive,
    balance: entity.balance,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt,
  }
}

/**
 * Create a new account
 */
export async function createAccount(
  account: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'balance'>,
  context?: EncryptionContext
): Promise<DatabaseResult<Account>> {
  try {
    // Validate account type
    const validTypes: AccountType[] = [
      'asset',
      'liability',
      'equity',
      'income',
      'expense',
      'cost-of-goods-sold',
      'other-income',
      'other-expense',
    ]

    if (!validTypes.includes(account.type)) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid account type: ${account.type}`,
        },
      }
    }

    // Validate parent account type matches if sub-account
    if (account.parentAccountId) {
      const parent = await db.accounts.get(account.parentAccountId)
      if (!parent) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parent account not found',
          },
        }
      }
      if (parent.type !== account.type) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Sub-account type must match parent account type',
          },
        }
      }
    }

    // Create entity with CRDT fields
    let entity = toAccountEntity({
      ...account,
      balance: 0, // Initial balance is always 0
    })

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context
      entity = {
        ...entity,
        name: await encryptionService.encrypt(entity.name),
        description: entity.description
          ? await encryptionService.encrypt(entity.description)
          : undefined,
        balance: 0, // Balance encrypted as 0 initially
      }
    }

    // Store in database
    await db.accounts.add(entity)

    // Return decrypted account
    const result = fromAccountEntity(entity)
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
 * Get account by ID
 */
export async function getAccount(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Account>> {
  try {
    const entity = await db.accounts.get(id)

    if (!entity) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Account not found: ${id}`,
        },
      }
    }

    // Check if soft deleted
    if (entity.deletedAt) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Account has been deleted: ${id}`,
        },
      }
    }

    // Decrypt if service provided
    let result = entity
    if (context?.encryptionService) {
      const { encryptionService } = context
      result = {
        ...entity,
        name: await encryptionService.decrypt(entity.name),
        description: entity.description
          ? await encryptionService.decrypt(entity.description)
          : undefined,
      }
    }

    return { success: true, data: fromAccountEntity(result) }
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
 * Update an existing account
 */
export async function updateAccount(
  id: string,
  updates: Partial<Omit<Account, 'id' | 'companyId' | 'createdAt'>>,
  context?: EncryptionContext
): Promise<DatabaseResult<Account>> {
  try {
    const existing = await db.accounts.get(id)

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Account not found: ${id}`,
        },
      }
    }

    if (existing.deletedAt) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Account has been deleted: ${id}`,
        },
      }
    }

    // Validate type change (if changing type)
    if (updates.type && updates.type !== existing.type) {
      // Check if account has children
      const children = await db.accounts
        .where('parentAccountId')
        .equals(id)
        .and((acc) => !acc.deletedAt)
        .count()

      if (children > 0) {
        return {
          success: false,
          error: {
            code: 'CONSTRAINT_VIOLATION',
            message: 'Cannot change account type when sub-accounts exist',
          },
        }
      }
    }

    // Prepare updated entity
    const now = new Date()
    const deviceId = getDeviceId()

    const updated: AccountEntity = {
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
      if (updates.name) {
        updated.name = await encryptionService.encrypt(updates.name)
      }
      if (updates.description !== undefined) {
        updated.description = updates.description
          ? await encryptionService.encrypt(updates.description)
          : undefined
      }
      if (updates.balance !== undefined) {
        updated.balance = updates.balance // Balance encryption handled separately
      }
    }

    // Update in database
    await db.accounts.put(updated)

    // Decrypt for return
    let result = updated
    if (context?.encryptionService) {
      const { encryptionService } = context
      result = {
        ...updated,
        name: await encryptionService.decrypt(updated.name),
        description: updated.description
          ? await encryptionService.decrypt(updated.description)
          : undefined,
      }
    }

    return { success: true, data: fromAccountEntity(result) }
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
 * Delete an account (soft delete with tombstone)
 */
export async function deleteAccount(
  id: string
): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.accounts.get(id)

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Account not found: ${id}`,
        },
      }
    }

    if (existing.deletedAt) {
      return { success: true, data: undefined } // Already deleted
    }

    // Check for sub-accounts
    const children = await db.accounts
      .where('parentAccountId')
      .equals(id)
      .and((acc) => !acc.deletedAt)
      .count()

    if (children > 0) {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Cannot delete account with active sub-accounts',
        },
      }
    }

    // Check for transactions
    const transactionCount = await db.transactions
      .filter((txn) => {
        return (
          !txn.deletedAt &&
          txn.lines.some((line) => line.accountId === id)
        )
      })
      .count()

    if (transactionCount > 0) {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Cannot delete account with existing transactions',
        },
      }
    }

    // Soft delete with tombstone marker
    const now = new Date()
    const deviceId = getDeviceId()

    await db.accounts.update(id, {
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
 * Query accounts with filters
 */
export async function queryAccounts(
  filter: AccountFilter,
  context?: EncryptionContext
): Promise<DatabaseResult<Account[]>> {
  try {
    let query = db.accounts.toCollection()

    // Apply primary index filter first (companyId or companyId+type)
    if (filter.type && filter.companyId) {
      // Use compound index for companyId+type
      query = db.accounts
        .where('[companyId+type]')
        .equals([filter.companyId, filter.type])
    } else if (filter.companyId) {
      // Use single companyId index
      query = db.accounts.where('companyId').equals(filter.companyId)
    }

    // Chain additional filters using .and() - avoid boolean compound indexes
    if (filter.isActive !== undefined) {
      query = query.and((acc) => acc.isActive === filter.isActive)
    }

    if (filter.parentAccountId !== undefined) {
      query = query.and((acc) => acc.parentAccountId === filter.parentAccountId)
    }

    // Filter out deleted unless explicitly requested
    if (!filter.includeDeleted) {
      query = query.and((acc) => !acc.deletedAt)
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
          description: entity.description
            ? await encryptionService.decrypt(entity.description)
            : undefined,
        }))
      )
    }

    return {
      success: true,
      data: results.map(fromAccountEntity),
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
 * Get all accounts for a company (hierarchical structure)
 */
export async function getAccountsHierarchy(
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Account[]>> {
  const result = await queryAccounts(
    { companyId, includeDeleted: false },
    context
  )

  if (!result.success) {
    return result
  }

  // Sort by type and account number
  const sorted = result.data.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type)
    }
    if (a.accountNumber && b.accountNumber) {
      return a.accountNumber.localeCompare(b.accountNumber)
    }
    return a.name.localeCompare(b.name)
  })

  return { success: true, data: sorted }
}

/**
 * Batch create accounts
 */
export async function batchCreateAccounts(
  accounts: Array<Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'balance'>>,
  context?: EncryptionContext
): Promise<BatchResult<Account>> {
  const successful: Account[] = []
  const failed: Array<{ item: Account; error: DatabaseError }> = []

  for (const account of accounts) {
    const result = await createAccount(account, context)
    if (result.success) {
      successful.push(result.data)
    } else {
      failed.push({
        item: { ...account, id: '', createdAt: new Date(), updatedAt: new Date(), balance: 0 },
        error: result.error,
      })
    }
  }

  return { successful, failed }
}
