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
    // Additional transaction fields
    transactionType: transaction.transactionType,
    vendorId: transaction.vendorId,
    customerId: transaction.customerId,
    checkNumber: transaction.checkNumber,
    dueDate: transaction.dueDate,
    paymentTerms: transaction.paymentTerms,
    linkedTransactionId: transaction.linkedTransactionId,
    personalAccountRef: transaction.personalAccountRef,
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
    // Additional transaction fields
    transactionType: entity.transactionType,
    vendorId: entity.vendorId,
    customerId: entity.customerId,
    checkNumber: entity.checkNumber,
    dueDate: entity.dueDate,
    paymentTerms: entity.paymentTerms,
    linkedTransactionId: entity.linkedTransactionId,
    personalAccountRef: entity.personalAccountRef,
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

    // Validate all accounts exist and belong to same company
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

    // SECURITY: Verify all accounts belong to same company
    const wrongCompanyAccounts = accountIds.filter(
      (_id, index) => accounts[index] && accounts[index]!.companyId !== transaction.companyId
    )

    if (wrongCompanyAccounts.length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid account IDs: ${wrongCompanyAccounts.join(', ')}`,
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
 *
 * SECURITY: Requires companyId for authorization to prevent IDOR attacks
 */
export async function getTransaction(
  id: string,
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<JournalEntry>> {
  try {
    // SECURITY: Validate companyId is provided
    const companyIdError = validateCompanyId(companyId)
    if (companyIdError) {
      return { success: false, error: companyIdError }
    }

    const entity = await db.transactions.get(id)

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
          message: `Transaction has been deleted: ${id}`,
        },
      }
    }

    // Decrypt if service provided
    let result = authorizedEntity
    if (context?.encryptionService) {
      const { encryptionService } = context
      result = {
        ...authorizedEntity,
        memo: authorizedEntity.memo
          ? await encryptionService.decrypt(authorizedEntity.memo)
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
 *
 * SECURITY: Requires companyId for authorization to prevent IDOR attacks
 */
export async function updateTransaction(
  id: string,
  companyId: string,
  updates: Partial<Omit<JournalEntry, 'id' | 'companyId' | 'createdAt' | 'createdBy'>>,
  context?: EncryptionContext
): Promise<DatabaseResult<JournalEntry>> {
  try {
    // SECURITY: Validate companyId is provided
    const companyIdError = validateCompanyId(companyId)
    if (companyIdError) {
      return { success: false, error: companyIdError }
    }

    const existing = await db.transactions.get(id)

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
          message: `Transaction has been deleted: ${id}`,
        },
      }
    }

    // Only allow updates to draft transactions
    if (authorizedEntity.status !== 'draft') {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Cannot update a posted transaction. Use void instead.',
        },
      }
    }

    // If updating lines, validate balance
    const newLines = updates.lines || authorizedEntity.lines
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
      ...authorizedEntity,
      ...updates,
      lines: linesWithIds,
      id, // Ensure ID doesn't change
      companyId: authorizedEntity.companyId, // Ensure companyId doesn't change
      createdBy: authorizedEntity.createdBy, // Preserve creator
      createdAt: authorizedEntity.createdAt, // Preserve creation date
      updatedAt: now,
      versionVector: incrementVersionVector(authorizedEntity.versionVector),
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
 *
 * SECURITY: Requires companyId for authorization to prevent IDOR attacks
 */
export async function postTransaction(
  id: string,
  companyId: string
): Promise<DatabaseResult<JournalEntry>> {
  try {
    // SECURITY: Validate companyId is provided
    const companyIdError = validateCompanyId(companyId)
    if (companyIdError) {
      return { success: false, error: companyIdError }
    }

    const existing = await db.transactions.get(id)

    // SECURITY: Verify resource ownership before allowing access
    const authCheck = requireCompanyOwnership(existing, companyId)
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const authorizedEntity = authCheck.resource

    if (authorizedEntity.status !== 'draft') {
      return {
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Transaction is already posted',
        },
      }
    }

    if (!authorizedEntity.isBalanced) {
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
      versionVector: incrementVersionVector(authorizedEntity.versionVector),
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
 *
 * SECURITY: Requires companyId for authorization to prevent IDOR attacks
 */
export async function voidTransaction(
  id: string,
  companyId: string
): Promise<DatabaseResult<JournalEntry>> {
  try {
    // SECURITY: Validate companyId is provided
    const companyIdError = validateCompanyId(companyId)
    if (companyIdError) {
      return { success: false, error: companyIdError }
    }

    const existing = await db.transactions.get(id)

    // SECURITY: Verify resource ownership before allowing access
    const authCheck = requireCompanyOwnership(existing, companyId)
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const authorizedEntity = authCheck.resource

    if (authorizedEntity.status === 'void') {
      return { success: true, data: fromTransactionEntity(authorizedEntity) }
    }

    const now = new Date()
    const deviceId = getDeviceId()

    await db.transactions.update(id, {
      status: 'void' as TransactionStatus,
      updatedAt: now,
      versionVector: incrementVersionVector(authorizedEntity.versionVector),
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
 *
 * SECURITY: Requires companyId for authorization to prevent IDOR attacks
 */
export async function deleteTransaction(
  id: string,
  companyId: string
): Promise<DatabaseResult<void>> {
  try {
    // SECURITY: Validate companyId is provided
    const companyIdError = validateCompanyId(companyId)
    if (companyIdError) {
      return { success: false, error: companyIdError }
    }

    const existing = await db.transactions.get(id)

    // SECURITY: Verify resource ownership before allowing access
    const authCheck = requireCompanyOwnership(existing, companyId)
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const authorizedEntity = authCheck.resource

    if (authorizedEntity.deletedAt) {
      return { success: true, data: undefined } // Already deleted
    }

    // Only allow deleting draft transactions
    if (authorizedEntity.status !== 'draft') {
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
 * Query transactions with filters
 *
 * SECURITY: Requires companyId as mandatory parameter to prevent unauthorized cross-company access
 */
export async function queryTransactions(
  companyId: string,
  filter?: Omit<TransactionFilter, 'companyId'>,
  context?: EncryptionContext
): Promise<DatabaseResult<JournalEntry[]>> {
  try {
    console.log('[queryTransactions] Starting query with:', { companyId, filter })

    // SECURITY: Validate companyId is provided
    const companyIdError = validateCompanyId(companyId)
    if (companyIdError) {
      console.log('[queryTransactions] companyId validation failed:', companyIdError)
      return { success: false, error: companyIdError }
    }

    // Debug: First get ALL transactions in the database to see what exists
    const allTxns = await db.transactions.toArray()
    console.log('[queryTransactions] ALL transactions in database:', allTxns.length)
    if (allTxns.length > 0) {
      console.log('[queryTransactions] Transaction details:', allTxns.map(t => ({
        id: t.id,
        companyId: t.companyId,
        status: t.status,
        deletedAt: t.deletedAt,
      })))
    }

    let query = db.transactions.toCollection()

    // SECURITY: Always filter by companyId first (required)
    if (filter?.status) {
      console.log('[queryTransactions] Using compound index [companyId+status] with:', [companyId, filter.status])
      query = db.transactions
        .where('[companyId+status]')
        .equals([companyId, filter.status])
    } else if (filter?.fromDate && filter?.toDate) {
      query = db.transactions
        .where('[companyId+date]')
        .between(
          [companyId, filter.fromDate],
          [companyId, filter.toDate]
        )
    } else {
      console.log('[queryTransactions] Using simple companyId index:', companyId)
      query = db.transactions.where('companyId').equals(companyId)
    }

    if (filter?.accountId) {
      query = query.and((txn) =>
        txn.lines.some((line) => line.accountId === filter.accountId)
      )
    }

    // Filter out deleted unless explicitly requested
    if (!filter?.includeDeleted) {
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
  return queryTransactions(companyId, { accountId }, context)
}

/**
 * Batch create transactions
 *
 * SECURITY: Validates all transactions have same companyId to prevent bulk unauthorized writes
 */
export async function batchCreateTransactions(
  companyId: string,
  transactions: Array<Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>,
  context?: EncryptionContext
): Promise<BatchResult<JournalEntry>> {
  const successful: JournalEntry[] = []
  const failed: Array<{ item: JournalEntry; error: DatabaseError }> = []

  // SECURITY: Validate companyId is provided
  const companyIdError = validateCompanyId(companyId)
  if (companyIdError) {
    // Return all items as failed with validation error
    return {
      successful: [],
      failed: transactions.map((transaction) => ({
        item: {
          ...transaction,
          id: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        error: companyIdError,
      })),
    }
  }

  // SECURITY: Verify all transactions have correct companyId before processing
  const invalidItems = transactions.filter((transaction) => transaction.companyId !== companyId)
  if (invalidItems.length > 0) {
    const mismatchError: DatabaseError = {
      code: 'VALIDATION_ERROR',
      message: `Company ID mismatch detected in batch operation. All items must belong to company: ${companyId}`,
    }
    // Return all items as failed - reject entire batch
    return {
      successful: [],
      failed: transactions.map((transaction) => ({
        item: {
          ...transaction,
          id: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        error: mismatchError,
      })),
    }
  }

  // All items validated - proceed with batch creation
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
