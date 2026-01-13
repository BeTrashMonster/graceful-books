/**
 * Transactions Data Access Layer
 *
 * Provides CRUD operations for journal entries with:
 * - Double-entry accounting validation (debits = credits)
 * - Encryption/decryption integration points
 * - CRDT version vector management
 * - Immutability enforcement for posted transactions
 * - Void capability instead of deletion
 */

import { nanoid } from 'nanoid'
import { db } from './database'
import type {
  TransactionEntity,
  TransactionFilter,
  DatabaseResult,
  DatabaseError,
  EncryptionContext,
  VersionVector,
  BatchResult,
} from './types'
import type { JournalEntry, JournalEntryLine, TransactionStatus } from '../types'

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
 * Validate that transaction is balanced (debits = credits)
 */
function validateBalance(lines: JournalEntryLine[]): {
  isBalanced: boolean
  totalDebits: number
  totalCredits: number
} {
  const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0)
  const totalCredits = lines.reduce((sum, line) => sum + line.credit, 0)

  // Allow for small floating point differences (< 0.01)
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01

  return { isBalanced, totalDebits, totalCredits }
}

/**
 * Generate hash of line items for validation
 */
function generateLinesHash(lines: JournalEntryLine[]): string {
  const normalized = lines
    .map((line) => ({
      accountId: line.accountId,
      debit: line.debit.toFixed(2),
      credit: line.credit.toFixed(2),
    }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId))

  return JSON.stringify(normalized)
}

/**
 * Convert JournalEntry to TransactionEntity (adds CRDT fields)
 */
function toTransactionEntity(
  transaction: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
    id?: string
    createdAt?: Date
    updatedAt?: Date
  }
): TransactionEntity {
  const now = new Date()
  const deviceId = getDeviceId()
  const { isBalanced } = validateBalance(transaction.lines)

  return {
    id: transaction.id || nanoid(),
    companyId: transaction.companyId,
    date: transaction.date,
    reference: transaction.reference,
    memo: transaction.memo,
    status: transaction.status,
    lines: transaction.lines,
    attachments: transaction.attachments,
    createdBy: transaction.createdBy,
    createdAt: transaction.createdAt || now,
    updatedAt: now,
    deletedAt: undefined,
    versionVector: initVersionVector(),
    lastModifiedBy: deviceId,
    lastModifiedAt: now,
    linesHash: generateLinesHash(transaction.lines),
    isBalanced,
    _encrypted: {
      memo: true,
      lines: true,
    },
  }
}

/**
 * Convert TransactionEntity to JournalEntry (removes CRDT fields)
 */
function fromTransactionEntity(entity: TransactionEntity): JournalEntry {
  return {
    id: entity.id,
    companyId: entity.companyId,
    date: entity.date,
    reference: entity.reference,
    memo: entity.memo,
    status: entity.status,
    lines: entity.lines,
    attachments: entity.attachments,
    createdBy: entity.createdBy,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt,
  }
}

/**
 * Create a new transaction
 */
export async function createTransaction(
  transaction: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  context?: EncryptionContext
): Promise<DatabaseResult<JournalEntry>> {
  try {
    // Validate that transaction has at least 2 lines
    if (transaction.lines.length < 2) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Transaction must have at least 2 line items',
        },
      }
    }

    // Validate balance
    const { isBalanced, totalDebits, totalCredits } = validateBalance(
      transaction.lines
    )

    if (!isBalanced) {
      return {
        success: false,
        error: {
          code: 'UNBALANCED_TRANSACTION',
          message: `Transaction is not balanced. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}`,
        },
      }
    }

    // Validate all accounts exist
    const accountIds = transaction.lines.map((line) => line.accountId)
    const accounts = await db.accounts.bulkGet(accountIds)

    const missingAccounts = accountIds.filter(
      (_id, index) => !accounts[index] || accounts[index]?.deletedAt
    )

    if (missingAccounts.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid account IDs: ${missingAccounts.join(', ')}`,
        },
      }
    }

    // Ensure line items have IDs
    const linesWithIds = transaction.lines.map((line) => ({
      ...line,
      id: line.id || nanoid(),
    }))

    // Create entity with CRDT fields
    let entity = toTransactionEntity({
      ...transaction,
      lines: linesWithIds,
    })

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context
      entity = {
        ...entity,
        memo: entity.memo
          ? await encryptionService.encrypt(entity.memo)
          : undefined,
        lines: linesWithIds, // Lines array encrypted as JSON
      }
    }

    // Store in database
    await db.transactions.add(entity)

    // Return decrypted transaction
    const result = fromTransactionEntity(entity)
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
 * Get transaction by ID
 */
export async function getTransaction(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<JournalEntry>> {
  try {
    const entity = await db.transactions.get(id)

    if (!entity) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Transaction not found: ${id}`,
        },
      }
    }

    // Check if soft deleted
    if (entity.deletedAt) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Transaction has been deleted: ${id}`,
        },
      }
    }

    // Decrypt if service provided
    let result = entity
    if (context?.encryptionService) {
      const { encryptionService } = context
      result = {
        ...entity,
        memo: entity.memo
          ? await encryptionService.decrypt(entity.memo)
          : undefined,
      }
    }

    return { success: true, data: fromTransactionEntity(result) }
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
 * Update a transaction (only allowed if status is 'draft')
 */
export async function updateTransaction(
  id: string,
  updates: Partial<Omit<JournalEntry, 'id' | 'companyId' | 'createdAt' | 'createdBy'>>,
  context?: EncryptionContext
): Promise<DatabaseResult<JournalEntry>> {
  try {
    const existing = await db.transactions.get(id)

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Transaction not found: ${id}`,
        },
      }
    }

    if (existing.deletedAt) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Transaction has been deleted: ${id}`,
        },
      }
    }

    // Only allow updates to draft transactions
    if (existing.status !== 'draft') {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Cannot update a posted transaction. Use void instead.',
        },
      }
    }

    // If updating lines, validate balance
    const newLines = updates.lines || existing.lines
    const { isBalanced, totalDebits, totalCredits } = validateBalance(newLines)

    if (!isBalanced) {
      return {
        success: false,
        error: {
          code: 'UNBALANCED_TRANSACTION',
          message: `Transaction is not balanced. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}`,
        },
      }
    }

    // Prepare updated entity
    const now = new Date()
    const deviceId = getDeviceId()

    // Ensure line items have IDs
    const linesWithIds = newLines.map((line) => ({
      ...line,
      id: line.id || nanoid(),
    }))

    const updated: TransactionEntity = {
      ...existing,
      ...updates,
      lines: linesWithIds,
      id, // Ensure ID doesn't change
      companyId: existing.companyId, // Ensure companyId doesn't change
      createdBy: existing.createdBy, // Preserve creator
      createdAt: existing.createdAt, // Preserve creation date
      updatedAt: now,
      versionVector: incrementVersionVector(existing.versionVector),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
      linesHash: generateLinesHash(linesWithIds),
      isBalanced,
    }

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context
      if (updates.memo !== undefined) {
        updated.memo = updates.memo
          ? await encryptionService.encrypt(updates.memo)
          : undefined
      }
    }

    // Update in database
    await db.transactions.put(updated)

    // Decrypt for return
    let result = updated
    if (context?.encryptionService) {
      const { encryptionService } = context
      result = {
        ...updated,
        memo: updated.memo
          ? await encryptionService.decrypt(updated.memo)
          : undefined,
      }
    }

    return { success: true, data: fromTransactionEntity(result) }
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
 * Post a transaction (change status from draft to posted)
 */
export async function postTransaction(
  id: string
): Promise<DatabaseResult<JournalEntry>> {
  try {
    const existing = await db.transactions.get(id)

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Transaction not found: ${id}`,
        },
      }
    }

    if (existing.status !== 'draft') {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Transaction is already posted',
        },
      }
    }

    if (!existing.isBalanced) {
      return {
        success: false,
        error: {
          code: 'UNBALANCED_TRANSACTION',
          message: 'Cannot post an unbalanced transaction',
        },
      }
    }

    const now = new Date()
    const deviceId = getDeviceId()

    await db.transactions.update(id, {
      status: 'posted' as TransactionStatus,
      updatedAt: now,
      versionVector: incrementVersionVector(existing.versionVector),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
    })

    const updated = await db.transactions.get(id)
    return { success: true, data: fromTransactionEntity(updated!) }
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
 * Void a transaction (instead of deleting)
 */
export async function voidTransaction(
  id: string
): Promise<DatabaseResult<JournalEntry>> {
  try {
    const existing = await db.transactions.get(id)

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Transaction not found: ${id}`,
        },
      }
    }

    if (existing.status === 'void') {
      return { success: true, data: fromTransactionEntity(existing) }
    }

    const now = new Date()
    const deviceId = getDeviceId()

    await db.transactions.update(id, {
      status: 'void' as TransactionStatus,
      updatedAt: now,
      versionVector: incrementVersionVector(existing.versionVector),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
    })

    const updated = await db.transactions.get(id)
    return { success: true, data: fromTransactionEntity(updated!) }
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
 * Delete a transaction (soft delete with tombstone, only for drafts)
 */
export async function deleteTransaction(
  id: string
): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.transactions.get(id)

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Transaction not found: ${id}`,
        },
      }
    }

    if (existing.deletedAt) {
      return { success: true, data: undefined } // Already deleted
    }

    // Only allow deleting draft transactions
    if (existing.status !== 'draft') {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Cannot delete a posted transaction. Use void instead.',
        },
      }
    }

    // Soft delete with tombstone marker
    const now = new Date()
    const deviceId = getDeviceId()

    await db.transactions.update(id, {
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
 * Query transactions with filters
 */
export async function queryTransactions(
  filter: TransactionFilter,
  context?: EncryptionContext
): Promise<DatabaseResult<JournalEntry[]>> {
  try {
    let query = db.transactions.toCollection()

    // Apply filters
    if (filter.companyId) {
      query = db.transactions.where('companyId').equals(filter.companyId)
    }

    if (filter.status && filter.companyId) {
      query = db.transactions
        .where('[companyId+status]')
        .equals([filter.companyId, filter.status])
    }

    if (filter.fromDate && filter.toDate && filter.companyId) {
      query = db.transactions
        .where('[companyId+date]')
        .between(
          [filter.companyId, filter.fromDate],
          [filter.companyId, filter.toDate]
        )
    }

    if (filter.accountId) {
      query = query.and((txn) =>
        txn.lines.some((line) => line.accountId === filter.accountId)
      )
    }

    // Filter out deleted unless explicitly requested
    if (!filter.includeDeleted) {
      query = query.and((txn) => !txn.deletedAt)
    }

    const entities = await query.toArray()

    // Decrypt if service provided
    let results = entities
    if (context?.encryptionService) {
      const { encryptionService } = context
      results = await Promise.all(
        entities.map(async (entity) => ({
          ...entity,
          memo: entity.memo
            ? await encryptionService.decrypt(entity.memo)
            : undefined,
        }))
      )
    }

    return {
      success: true,
      data: results.map(fromTransactionEntity),
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
 * Get transactions for an account (for ledger/register view)
 */
export async function getAccountTransactions(
  accountId: string,
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<JournalEntry[]>> {
  return queryTransactions({ companyId, accountId }, context)
}

/**
 * Batch create transactions
 */
export async function batchCreateTransactions(
  transactions: Array<Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>,
  context?: EncryptionContext
): Promise<BatchResult<JournalEntry>> {
  const successful: JournalEntry[] = []
  const failed: Array<{ item: JournalEntry; error: DatabaseError }> = []

  for (const transaction of transactions) {
    const result = await createTransaction(transaction, context)
    if (result.success) {
      successful.push(result.data)
    } else {
      failed.push({
        item: {
          ...transaction,
          id: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        error: result.error,
      })
    }
  }

  return { successful, failed }
}
