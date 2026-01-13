/**
 * Local-First Data Store
 *
 * Main entry point for the Graceful Books data store.
 * Provides offline-first IndexedDB storage with:
 * - Dexie.js database (all operations work offline)
 * - CRDT support for conflict-free multi-device sync
 * - Encryption integration points
 * - Double-entry accounting validation
 * - Audit logging
 * - Batch operations
 *
 * @module store
 */

// =============================================================================
// Database
// =============================================================================

import { db as dbInstance } from './database'
export { db, GracefulBooksDB } from './database'
export type { DBTransaction } from './database'

// Use the imported instance internally
const db = dbInstance

// =============================================================================
// Types
// =============================================================================

export type {
  // CRDT Types
  VersionVector,
  CRDTEntity,
  ConflictStrategy,

  // Entity Types
  AccountEntity,
  TransactionEntity,
  ContactEntity,
  ProductEntity,
  UserEntity,
  AuditLogEntity,
  CompanyEntity,

  // Schema
  GracefulBooksSchema,
  IndexDefinitions,

  // Query Filters
  AccountFilter,
  TransactionFilter,
  ContactFilter,
  ProductFilter,
  AuditLogFilter,

  // Results
  DatabaseResult,
  DatabaseError,
  DatabaseErrorCode,
  BatchResult,
  MergeResult,
  ConflictInfo,

  // Encryption
  EncryptedFields,
  EncryptionService,
  EncryptionContext,
} from './types'

// =============================================================================
// Accounts
// =============================================================================

export {
  createAccount,
  getAccount,
  updateAccount,
  deleteAccount,
  queryAccounts,
  getAccountsHierarchy,
  batchCreateAccounts,
} from './accounts'

// =============================================================================
// Transactions
// =============================================================================

export {
  createTransaction,
  getTransaction,
  updateTransaction,
  postTransaction,
  voidTransaction,
  deleteTransaction,
  queryTransactions,
  getAccountTransactions,
  batchCreateTransactions,
} from './transactions'

// =============================================================================
// Contacts
// =============================================================================

export {
  createContact,
  getContact,
  updateContact,
  deleteContact,
  queryContacts,
  getCustomers,
  getVendors,
  get1099Vendors,
  batchCreateContacts,
} from './contacts'

// =============================================================================
// Products
// =============================================================================

export {
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
  queryProducts,
  getProducts,
  getServices,
  getProductBySKU,
  batchCreateProducts,
} from './products'

export type { Product } from './products'

// =============================================================================
// Users
// =============================================================================

export {
  createUser,
  getUser,
  getUserByEmail,
  updateUser,
  updateUserPassword,
  updateLastLogin,
  deleteUser,
  getCompanyUsers,
} from './users'

// =============================================================================
// Audit Logs
// =============================================================================

export {
  createAuditLog,
  getAuditLog,
  queryAuditLogs,
  getEntityAuditHistory,
  getRecentAuditLogs,
  getUserAuditLogs,
  getAuditLogsByAction,
  getAuditStats,
  logCreate,
  logUpdate,
  logDelete,
  logVoid,
} from './auditLogs'

// =============================================================================
// CRDT Operations
// =============================================================================

export {
  compareVersionVectors,
  mergeVersionVectors,
  detectConflicts,
  resolveLastWriteWins,
  mergeEntities,
  batchMergeEntities,
  hasLocalChanges,
  getDeviceVersion,
  createInitialVersionVector,
  isTombstoned,
  filterOldTombstones,
  mergeField,
  calculateSyncPriority,
  sortBySyncPriority,
} from './crdt'

// =============================================================================
// Batch Operations
// =============================================================================

export {
  executeTransaction,
  batchInsertAccounts,
  batchInsertTransactions,
  batchInsertContacts,
  batchInsertProducts,
  syncAccounts,
  syncTransactions,
  syncContacts,
  bulkDelete,
  bulkUpdate,
  exportCompanyData,
  importCompanyData,
} from './batch'

export type { BatchOptions } from './batch'

// =============================================================================
// Checklist Items
// =============================================================================

export {
  generateChecklist,
  getChecklistItems,
  getChecklistItem,
  updateChecklistItem,
  markComplete,
  snoozeItem,
  markNotApplicable,
  deleteChecklistItem,
  getChecklistStats,
} from './checklistItems'

// =============================================================================
// Reconciliations
// =============================================================================

export {
  createReconciliation,
  updateReconciliationMatches,
  completeReconciliation,
  getReconciliation,
  getReconciliationsByAccount,
  hasCompletedReconciliation,
  deleteReconciliation,
} from './reconciliations'

export type { ReconciliationEntity } from './types'

// =============================================================================
// Bills
// =============================================================================

export {
  createBill,
  getBill,
  updateBill,
  postBill,
  markBillPaid,
  voidBill,
  deleteBill,
  getBills,
  getVendorBills,
  getBillLineItems,
  getUpcomingBills,
  getOverdueBills,
} from './bills'

export type { Bill, BillLineItem, BillStatus } from '../db/schema/bills.schema'

// =============================================================================
// Utilities
// =============================================================================

/**
 * Initialize the database
 * Call this once at application startup
 */
export async function initializeDatabase(): Promise<void> {
  // Database is automatically initialized when imported
  // This function is here for explicit initialization if needed
  await db.open()
}

/**
 * Check if database is ready
 */
export function isDatabaseReady(): boolean {
  return db.isOpen()
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  return db.getStats()
}

/**
 * Clear all data (use with caution!)
 */
export async function clearAllData(): Promise<void> {
  await db.clearAllData()
}

/**
 * Clear data for a specific company
 */
export async function clearCompanyData(companyId: string): Promise<void> {
  await db.clearCompanyData(companyId)
}

/**
 * Export all data (for backup)
 */
export async function exportAllData() {
  return db.exportAllData()
}

/**
 * Import data (for restore)
 */
export async function importData(data: Parameters<typeof db.importData>[0]) {
  return db.importData(data)
}

// =============================================================================
// Version
// =============================================================================

export const STORE_VERSION = '1.0.0'
export const SCHEMA_VERSION = 1

// =============================================================================
// Default Export
// =============================================================================

export default {
  db,
  version: STORE_VERSION,
  schemaVersion: SCHEMA_VERSION,
}
