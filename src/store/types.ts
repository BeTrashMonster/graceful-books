/**
 * Database Schema Types for Local-First Data Store
 *
 * These types extend the core application types with database-specific fields
 * including CRDT support (version vectors, tombstones) for offline-first sync.
 */

import type {
  Account,
  Contact,
  JournalEntry,
  UserProfile,
  AccountType,
  ContactType,
  TransactionStatus,
} from '../types'

// =============================================================================
// CRDT Types
// =============================================================================

/**
 * Version vector for CRDT conflict resolution
 * Tracks the version of each device/replica that has modified this record
 */
export interface VersionVector {
  [deviceId: string]: number
}

/**
 * Base interface for all CRDT-enabled entities
 * Includes version tracking and tombstone markers
 */
export interface CRDTEntity {
  /** Version vector tracking changes from each device */
  versionVector: VersionVector
  /** Device ID that made the last modification */
  lastModifiedBy: string
  /** Timestamp of last modification (for last-write-wins) */
  lastModifiedAt: Date
  /** Tombstone marker - soft delete timestamp */
  deletedAt?: Date
}

/**
 * Conflict resolution strategy
 */
export type ConflictStrategy = 'last-write-wins' | 'manual' | 'merge'

// =============================================================================
// Database Entity Types
// =============================================================================

/**
 * Account entity with encryption markers and CRDT support
 * Extends the base Account type with database-specific fields
 */
export interface AccountEntity extends Omit<Account, 'deletedAt'>, CRDTEntity {
  /** Original unencrypted fields for reference (not stored) */
  _encrypted: {
    name: boolean
    balance: boolean
    description: boolean
  }
}

/**
 * Transaction entity with CRDT support
 * Transactions are immutable once posted, but can be voided
 */
export interface TransactionEntity extends Omit<JournalEntry, 'deletedAt'>, CRDTEntity {
  /** Hash of line items for validation */
  linesHash?: string
  /** Indicates if debits equal credits */
  isBalanced: boolean
  /** Original unencrypted fields marker */
  _encrypted: {
    memo: boolean
    lines: boolean
  }
}

/**
 * Contact entity with CRDT support
 */
export interface ContactEntity extends Omit<Contact, 'deletedAt'>, CRDTEntity {
  /** Original unencrypted fields marker */
  _encrypted: {
    name: boolean
    email: boolean
    phone: boolean
    address: boolean
    taxId: boolean
    notes: boolean
  }
}

/**
 * Product/Service entity
 */
export interface ProductEntity extends CRDTEntity {
  id: string
  companyId: string
  name: string
  description?: string
  type: 'product' | 'service'
  sku?: string
  price: number
  cost?: number
  incomeAccountId: string
  expenseAccountId?: string
  taxable: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  /** Original unencrypted fields marker */
  _encrypted: {
    name: boolean
    description: boolean
    price: boolean
    cost: boolean
  }
}

/**
 * Receipt entity with CRDT support
 */
export interface ReceiptEntity extends Omit<import('../types').Receipt, 'deletedAt'>, CRDTEntity {
  /** Original unencrypted fields marker */
  _encrypted: {
    imageData: boolean
    thumbnailData: boolean
    notes: boolean
  }
}

/**
 * User entity with CRDT support
 */
export interface UserEntity extends Omit<UserProfile, 'deletedAt'>, CRDTEntity {
  /** Password hash (Argon2) */
  passwordHash?: string
  /** Master key derivation salt */
  salt?: string
  /** Encrypted master key */
  encryptedMasterKey?: string
  /** Last login timestamp */
  lastLoginAt?: Date
  /** Original unencrypted fields marker */
  _encrypted: {
    email: boolean
    name: boolean
  }
}

/**
 * Audit log entry - immutable record of all changes
 */
export interface AuditLogEntity {
  id: string
  companyId: string
  /** Timestamp (UTC) */
  timestamp: Date
  /** User who made the change */
  userId: string
  /** Device identifier */
  deviceId: string
  /** Entity type affected */
  entityType: 'account' | 'transaction' | 'contact' | 'product' | 'user'
  /** Entity ID */
  entityId: string
  /** Action performed */
  action: 'create' | 'update' | 'delete' | 'void'
  /** Before values (encrypted) */
  beforeValues?: string
  /** After values (encrypted) */
  afterValues?: string
  /** Fields that changed */
  changedFields?: string[]
  /** IP address (if available) */
  ipAddress?: string
  /** User agent */
  userAgent?: string
  /** Encrypted with company key */
  _encrypted: {
    beforeValues: boolean
    afterValues: boolean
  }
}

/**
 * Company settings entity
 */
export interface CompanyEntity extends CRDTEntity {
  id: string
  name: string
  /** Legal business name */
  legalName?: string
  /** Tax ID / EIN */
  taxId?: string
  /** Business address */
  address?: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  /** Fiscal year end (MM-DD) */
  fiscalYearEnd?: string
  /** Accounting method */
  accountingMethod: 'cash' | 'accrual'
  /** Base currency */
  currency: string
  /** Company logo URL */
  logoUrl?: string
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
  lastModifiedBy: string
  lastModifiedAt: Date
  versionVector: VersionVector
  _encrypted: {
    name: boolean
    legalName: boolean
    taxId: boolean
    address: boolean
  }
}

// =============================================================================
// Database Schema Definition Types
// =============================================================================

/**
 * Complete database schema for Dexie
 */
export interface GracefulBooksSchema {
  accounts: AccountEntity
  transactions: TransactionEntity
  contacts: ContactEntity
  products: ProductEntity
  users: UserEntity
  auditLogs: AuditLogEntity
  companies: CompanyEntity
}

/**
 * Index definitions for each table
 */
export interface IndexDefinitions {
  accounts: string
  transactions: string
  contacts: string
  products: string
  users: string
  auditLogs: string
  companies: string
}

// =============================================================================
// Query Types
// =============================================================================

/**
 * Query filter for accounts
 */
export interface AccountFilter {
  companyId?: string
  type?: AccountType
  isActive?: boolean
  parentAccountId?: string
  includeDeleted?: boolean
}

/**
 * Query filter for transactions
 */
export interface TransactionFilter {
  companyId?: string
  status?: TransactionStatus
  fromDate?: Date
  toDate?: Date
  accountId?: string
  includeDeleted?: boolean
}

/**
 * Query filter for contacts
 */
export interface ContactFilter {
  companyId?: string
  type?: ContactType
  isActive?: boolean
  includeDeleted?: boolean
}

/**
 * Query filter for products
 */
export interface ProductFilter {
  companyId?: string
  type?: 'product' | 'service'
  isActive?: boolean
  includeDeleted?: boolean
}

/**
 * Query filter for audit logs
 */
export interface AuditLogFilter {
  companyId?: string
  entityType?: AuditLogEntity['entityType']
  entityId?: string
  userId?: string
  fromDate?: Date
  toDate?: Date
  action?: AuditLogEntity['action']
}

// =============================================================================
// Operation Result Types
// =============================================================================

/**
 * Result of a database operation
 */
export type DatabaseResult<T> =
  | { success: true; data: T }
  | { success: false; error: DatabaseError }

/**
 * Database error types
 */
export interface DatabaseError {
  code: DatabaseErrorCode
  message: string
  details?: unknown
}

export type DatabaseErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONSTRAINT_VIOLATION'
  | 'ENCRYPTION_ERROR'
  | 'CONFLICT_ERROR'
  | 'UNBALANCED_TRANSACTION'
  | 'UNKNOWN_ERROR'

/**
 * Batch operation result
 */
export interface BatchResult<T> {
  successful: T[]
  failed: Array<{
    item: T
    error: DatabaseError
  }>
}

/**
 * Merge result for CRDT operations
 */
export interface MergeResult<T> {
  merged: T
  conflicts: ConflictInfo[]
}

/**
 * Conflict information
 */
export interface ConflictInfo {
  field: string
  localValue: unknown
  remoteValue: unknown
  resolvedValue: unknown
  strategy: ConflictStrategy
}

// =============================================================================
// Encryption Integration Types
// =============================================================================

/**
 * Fields that should be encrypted before storage
 */
export type EncryptedFields<T> = {
  [K in keyof T]?: boolean
}

/**
 * Encryption service interface (integration point)
 */
export interface EncryptionService {
  encrypt(data: string): Promise<string>
  decrypt(data: string): Promise<string>
  encryptField<T>(field: T): Promise<string>
  decryptField<T>(encrypted: string): Promise<T>
}

/**
 * Encryption context for operations
 */
export interface EncryptionContext {
  companyId: string
  userId: string
  encryptionService?: EncryptionService
}

// =============================================================================
// Reconciliation Entity
// =============================================================================

/**
 * Reconciliation entity with CRDT support
 */
export interface ReconciliationEntity extends CRDTEntity {
  id: string
  companyId: string
  accountId: string
  statementPeriodStart: Date
  statementPeriodEnd: Date
  openingBalance: number // cents
  closingBalance: number // cents
  status: 'DRAFT' | 'COMPLETED' | 'ABANDONED'
  statementData: string // ENCRYPTED - JSON of ParsedStatement
  matchedTransactions: string // ENCRYPTED - JSON array of transaction IDs
  unmatchedStatementItems: string // ENCRYPTED - JSON array of StatementTransaction IDs
  unmatchedSystemItems: string // ENCRYPTED - JSON array of system transaction IDs
  discrepancy: number // cents
  isFirstReconciliation: boolean
  completedAt?: Date
  notes?: string // ENCRYPTED
  createdAt: Date
  updatedAt: Date
  /** Original unencrypted fields marker */
  _encrypted: {
    statementData: boolean
    matchedTransactions: boolean
    unmatchedStatementItems: boolean
    unmatchedSystemItems: boolean
    notes: boolean
  }
}
