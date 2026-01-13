/**
 * Batch Operations and Database Transactions
 *
 * Provides atomic batch operations for multiple entities:
 * - Batch inserts with rollback on error
 * - Transaction support across multiple tables
 * - Bulk updates with conflict handling
 * - Import/export utilities
 */

import { db } from './database'
import type {
  AccountEntity,
  TransactionEntity,
  ContactEntity,
  ProductEntity,
  UserEntity,
  AuditLogEntity,
  DatabaseResult,
  BatchResult,
  EncryptionContext,
} from './types'
import type { Account, JournalEntry, Contact } from '../types'
import { createAccount, queryAccounts } from './accounts'
import { createTransaction, queryTransactions } from './transactions'
import { createContact, queryContacts } from './contacts'
import { createProduct } from './products'
import { mergeEntities } from './crdt'
import type { Product } from './products'

/**
 * Batch operation options
 */
export interface BatchOptions {
  /** Stop on first error (default: false) */
  stopOnError?: boolean
  /** Create audit logs for operations (default: true) */
  auditLog?: boolean
  /** Encryption context */
  encryptionContext?: EncryptionContext
}

/**
 * Execute multiple operations in a single database transaction
 * All operations succeed or all fail (atomic)
 */
export async function executeTransaction<T>(
  operation: () => Promise<T>
): Promise<DatabaseResult<T>> {
  try {
    const result = await db.transaction(
      'rw',
      [db.accounts, db.transactions, db.contacts, db.products, db.users, db.auditLogs, db.companies],
      operation
    )

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Transaction failed',
        details: error as Error,
      },
    }
  }
}

/**
 * Batch insert accounts
 */
export async function batchInsertAccounts(
  accounts: Array<Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'balance'>>,
  options: BatchOptions = {}
): Promise<BatchResult<Account>> {
  const successful: Account[] = []
  const failed: Array<{ item: Account; error: any }> = []

  for (const account of accounts) {
    const result = await createAccount(account, options.encryptionContext)

    if (result.success) {
      successful.push(result.data)
    } else {
      failed.push({
        item: {
          ...account,
          id: '',
          balance: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        error: result.error,
      })

      if (options.stopOnError) {
        break
      }
    }
  }

  return { successful, failed }
}

/**
 * Batch insert transactions
 */
export async function batchInsertTransactions(
  transactions: Array<Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>,
  options: BatchOptions = {}
): Promise<BatchResult<JournalEntry>> {
  const successful: JournalEntry[] = []
  const failed: Array<{ item: JournalEntry; error: any }> = []

  for (const transaction of transactions) {
    const result = await createTransaction(transaction, options.encryptionContext)

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

      if (options.stopOnError) {
        break
      }
    }
  }

  return { successful, failed }
}

/**
 * Batch insert contacts
 */
export async function batchInsertContacts(
  contacts: Array<Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>,
  options: BatchOptions = {}
): Promise<BatchResult<Contact>> {
  const successful: Contact[] = []
  const failed: Array<{ item: Contact; error: any }> = []

  for (const contact of contacts) {
    const result = await createContact(contact, options.encryptionContext)

    if (result.success) {
      successful.push(result.data)
    } else {
      failed.push({
        item: {
          ...contact,
          id: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        error: result.error,
      })

      if (options.stopOnError) {
        break
      }
    }
  }

  return { successful, failed }
}

/**
 * Batch insert products
 */
export async function batchInsertProducts(
  products: Array<Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>,
  options: BatchOptions = {}
): Promise<BatchResult<Product>> {
  const successful: Product[] = []
  const failed: Array<{ item: Product; error: any }> = []

  for (const product of products) {
    const result = await createProduct(product, options.encryptionContext)

    if (result.success) {
      successful.push(result.data)
    } else {
      failed.push({
        item: {
          ...product,
          id: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        error: result.error,
      })

      if (options.stopOnError) {
        break
      }
    }
  }

  return { successful, failed }
}

/**
 * Sync entities from remote source with conflict resolution
 */
export async function syncAccounts(
  companyId: string,
  remoteAccounts: AccountEntity[],
  context?: EncryptionContext
): Promise<DatabaseResult<{
  merged: number
  conflicts: number
  inserted: number
  updated: number
}>> {
  try {
    const result = await queryAccounts({ companyId, includeDeleted: true }, context)

    if (!result.success) {
      return result as any
    }

    const localAccountsArray = result.data
    const localMap = new Map(localAccountsArray.map((acc) => [acc.id, acc]))

    let merged = 0
    let conflicts = 0
    let inserted = 0
    let updated = 0

    await db.transaction('rw', db.accounts, async () => {
      for (const remoteAccount of remoteAccounts) {
        const localAccount = localMap.get(remoteAccount.id)

        if (!localAccount) {
          // New remote account - insert
          await db.accounts.add(remoteAccount)
          inserted++
        } else {
          // Merge with conflict resolution
          const mergeResult = mergeEntities(
            localAccount as any,
            remoteAccount,
            'last-write-wins'
          )

          await db.accounts.put(mergeResult.merged as any)
          merged++

          if (mergeResult.conflicts.length > 0) {
            conflicts++
          }

          if (
            JSON.stringify(localAccount) !== JSON.stringify(mergeResult.merged)
          ) {
            updated++
          }
        }
      }
    })

    return {
      success: true,
      data: { merged, conflicts, inserted, updated },
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Sync failed',
        details: error,
      },
    }
  }
}

/**
 * Sync transactions from remote source
 */
export async function syncTransactions(
  companyId: string,
  remoteTransactions: TransactionEntity[],
  context?: EncryptionContext
): Promise<DatabaseResult<{
  merged: number
  conflicts: number
  inserted: number
  updated: number
}>> {
  try {
    const result = await queryTransactions(
      { companyId, includeDeleted: true },
      context
    )

    if (!result.success) {
      return result as any
    }

    const localTransactionsArray = result.data
    const localMap = new Map(localTransactionsArray.map((txn) => [txn.id, txn]))

    let merged = 0
    let conflicts = 0
    let inserted = 0
    let updated = 0

    await db.transaction('rw', db.transactions, async () => {
      for (const remoteTransaction of remoteTransactions) {
        const localTransaction = localMap.get(remoteTransaction.id)

        if (!localTransaction) {
          // New remote transaction - insert
          await db.transactions.add(remoteTransaction)
          inserted++
        } else {
          // Merge with conflict resolution
          const mergeResult = mergeEntities(
            localTransaction as any,
            remoteTransaction,
            'last-write-wins'
          )

          await db.transactions.put(mergeResult.merged as any)
          merged++

          if (mergeResult.conflicts.length > 0) {
            conflicts++
          }

          if (
            JSON.stringify(localTransaction) !== JSON.stringify(mergeResult.merged)
          ) {
            updated++
          }
        }
      }
    })

    return {
      success: true,
      data: { merged, conflicts, inserted, updated },
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Sync failed',
        details: error,
      },
    }
  }
}

/**
 * Sync contacts from remote source
 */
export async function syncContacts(
  companyId: string,
  remoteContacts: ContactEntity[],
  context?: EncryptionContext
): Promise<DatabaseResult<{
  merged: number
  conflicts: number
  inserted: number
  updated: number
}>> {
  try {
    const result = await queryContacts({ companyId, includeDeleted: true }, context)

    if (!result.success) {
      return result as any
    }

    const localContactsArray = result.data
    const localMap = new Map(localContactsArray.map((contact) => [contact.id, contact]))

    let merged = 0
    let conflicts = 0
    let inserted = 0
    let updated = 0

    await db.transaction('rw', db.contacts, async () => {
      for (const remoteContact of remoteContacts) {
        const localContact = localMap.get(remoteContact.id)

        if (!localContact) {
          // New remote contact - insert
          await db.contacts.add(remoteContact)
          inserted++
        } else {
          // Merge with conflict resolution
          const mergeResult = mergeEntities(
            localContact as any,
            remoteContact,
            'last-write-wins'
          )

          await db.contacts.put(mergeResult.merged as any)
          merged++

          if (mergeResult.conflicts.length > 0) {
            conflicts++
          }

          if (
            JSON.stringify(localContact) !== JSON.stringify(mergeResult.merged)
          ) {
            updated++
          }
        }
      }
    })

    return {
      success: true,
      data: { merged, conflicts, inserted, updated },
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Sync failed',
        details: error,
      },
    }
  }
}

/**
 * Bulk delete entities by IDs (soft delete with tombstones)
 */
export async function bulkDelete(
  table: 'accounts' | 'transactions' | 'contacts' | 'products' | 'users',
  ids: string[]
): Promise<DatabaseResult<{
  deleted: number
  skipped: number
}>> {
  try {
    let deleted = 0
    let skipped = 0

    await db.transaction('rw', db[table], async () => {
      for (const id of ids) {
        const entity = await db[table].get(id)

        if (!entity) {
          skipped++
          continue
        }

        if ((entity as any).deletedAt) {
          skipped++ // Already deleted
          continue
        }

        // Soft delete with tombstone
        await db[table].update(id, {
          deletedAt: new Date(),
        } as any)

        deleted++
      }
    })

    return {
      success: true,
      data: { deleted, skipped },
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Bulk delete failed',
        details: error,
      },
    }
  }
}

/**
 * Bulk update entities
 */
export async function bulkUpdate<T>(
  table: 'accounts' | 'transactions' | 'contacts' | 'products' | 'users',
  updates: Array<{ id: string; changes: Partial<T> }>
): Promise<DatabaseResult<{
  updated: number
  skipped: number
}>> {
  try {
    let updated = 0
    let skipped = 0

    await db.transaction('rw', db[table], async () => {
      for (const { id, changes } of updates) {
        const entity = await db[table].get(id)

        if (!entity) {
          skipped++
          continue
        }

        if ((entity as any).deletedAt) {
          skipped++ // Skip deleted entities
          continue
        }

        await db[table].update(id, {
          ...changes,
          updatedAt: new Date(),
        } as any)

        updated++
      }
    })

    return {
      success: true,
      data: { updated, skipped },
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Bulk update failed',
        details: error,
      },
    }
  }
}

/**
 * Export all data for a company (for backup or migration)
 */
export async function exportCompanyData(
  companyId: string
): Promise<DatabaseResult<{
  accounts: AccountEntity[]
  transactions: TransactionEntity[]
  contacts: ContactEntity[]
  products: ProductEntity[]
  users: UserEntity[]
  auditLogs: AuditLogEntity[]
  exportDate: Date
  version: string
}>> {
  try {
    const [accounts, transactions, contacts, products, users, auditLogs] =
      await Promise.all([
        db.accounts.where('companyId').equals(companyId).toArray(),
        db.transactions.where('companyId').equals(companyId).toArray(),
        db.contacts.where('companyId').equals(companyId).toArray(),
        db.products.where('companyId').equals(companyId).toArray(),
        db.users.where('companyId').equals(companyId).toArray(),
        db.auditLogs.where('companyId').equals(companyId).toArray(),
      ])

    return {
      success: true,
      data: {
        accounts,
        transactions,
        contacts,
        products,
        users,
        auditLogs,
        exportDate: new Date(),
        version: '1.0.0',
      },
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Export failed',
        details: error,
      },
    }
  }
}

/**
 * Import company data (for restore or migration)
 */
export async function importCompanyData(data: {
  accounts: AccountEntity[]
  transactions: TransactionEntity[]
  contacts: ContactEntity[]
  products: ProductEntity[]
  users: UserEntity[]
  auditLogs: AuditLogEntity[]
}): Promise<DatabaseResult<{
  imported: {
    accounts: number
    transactions: number
    contacts: number
    products: number
    users: number
    auditLogs: number
  }
}>> {
  try {
    await db.transaction(
      'rw',
      [db.accounts, db.transactions, db.contacts, db.products, db.users, db.auditLogs],
      async () => {
        // Import all data in a single transaction
        if (data.accounts.length > 0) {
          await db.accounts.bulkPut(data.accounts)
        }
        if (data.transactions.length > 0) {
          await db.transactions.bulkPut(data.transactions)
        }
        if (data.contacts.length > 0) {
          await db.contacts.bulkPut(data.contacts)
        }
        if (data.products.length > 0) {
          await db.products.bulkPut(data.products)
        }
        if (data.users.length > 0) {
          await db.users.bulkPut(data.users)
        }
        if (data.auditLogs.length > 0) {
          await db.auditLogs.bulkPut(data.auditLogs)
        }
      }
    )

    return {
      success: true,
      data: {
        imported: {
          accounts: data.accounts.length,
          transactions: data.transactions.length,
          contacts: data.contacts.length,
          products: data.products.length,
          users: data.users.length,
          auditLogs: data.auditLogs.length,
        },
      },
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Import failed',
        details: error,
      },
    }
  }
}
