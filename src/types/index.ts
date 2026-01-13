/**
 * Core Type Definitions for Graceful Books
 *
 * This file contains the foundational TypeScript types used throughout
 * the application, based on the SPEC.md requirements.
 */

// =============================================================================
// User & Authentication Types
// =============================================================================

/**
 * User role determines permissions and encryption key access
 */
export type UserRole = 'admin' | 'manager' | 'bookkeeper' | 'view-only'

/**
 * Business phase determines feature visibility and checklist content
 */
export type BusinessPhase = 'stabilize' | 'organize' | 'build' | 'grow'

/**
 * User profile stored locally (encrypted)
 */
export interface UserProfile {
  id: string
  companyId: string
  email: string
  name: string
  role: UserRole
  phase: BusinessPhase
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// Accounting Types
// =============================================================================

/**
 * Account types as per GAAP
 */
export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'income'
  | 'expense'
  | 'cost-of-goods-sold'
  | 'other-income'
  | 'other-expense'

/**
 * Account sub-types for more granular categorization
 */
export type AccountSubType =
  | 'current-asset'
  | 'fixed-asset'
  | 'other-asset'
  | 'current-liability'
  | 'long-term-liability'

/**
 * Chart of Accounts - Individual Account
 */
export interface Account {
  id: string
  companyId: string
  name: string
  accountNumber?: string
  type: AccountType
  subType?: AccountSubType
  parentAccountId?: string
  description?: string
  isActive: boolean
  balance: number
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

/**
 * Transaction status
 */
export type TransactionStatus = 'draft' | 'posted' | 'void' | 'reconciled'

/**
 * Journal Entry (base transaction type)
 */
export interface JournalEntry {
  id: string
  companyId: string
  date: Date
  reference?: string
  memo?: string
  status: TransactionStatus
  lines: JournalEntryLine[]
  attachments?: string[]
  createdBy: string
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

/**
 * Individual line item in a journal entry
 */
export interface JournalEntryLine {
  id: string
  accountId: string
  debit: number
  credit: number
  memo?: string
  classId?: string
  categoryId?: string
  tags?: string[]
}

/**
 * Accounting method
 */
export type AccountingMethod = 'cash' | 'accrual'

// =============================================================================
// Contact Types (Customers & Vendors)
// =============================================================================

export type ContactType = 'customer' | 'vendor' | 'both'

/**
 * Account type for hierarchical contacts
 * - standalone: Independent contact with no parent or children
 * - parent: Parent account that can have multiple child accounts
 * - child: Child account associated with a parent account
 */
export type ContactHierarchyType = 'standalone' | 'parent' | 'child'

export interface Contact {
  id: string
  companyId: string
  type: ContactType
  name: string
  email?: string
  phone?: string
  address?: Address
  taxId?: string
  is1099Eligible?: boolean
  notes?: string
  isActive: boolean
  // Hierarchical relationship fields (G3)
  parentId?: string | null
  accountType?: ContactHierarchyType
  hierarchyLevel?: number
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

export interface Address {
  line1: string
  line2?: string
  city: string
  state: string
  postalCode: string
  country: string
}

// =============================================================================
// Invoice & Bill Types
// =============================================================================

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'void'

/**
 * Consolidation type for invoices
 * - individual: Standard invoice for a single account
 * - consolidated: Combined invoice for parent account with multiple sub-accounts
 */
export type InvoiceConsolidationType = 'individual' | 'consolidated'

/**
 * Display mode for consolidated invoices
 * - itemized: Shows all line items for each sub-account
 * - totaled: Shows only subtotals per sub-account
 * - hybrid: Shows totals with expandable detail
 */
export type ConsolidatedDisplayMode = 'itemized' | 'totaled' | 'hybrid'

export interface Invoice {
  id: string
  companyId: string
  customerId: string
  invoiceNumber: string
  date: Date
  dueDate: Date
  status: InvoiceStatus
  lineItems: InvoiceLineItem[]
  subtotal: number
  taxAmount: number
  total: number
  amountPaid: number
  amountDue: number
  notes?: string
  terms?: string
  templateId?: string
  // Consolidated invoice fields
  consolidationType: InvoiceConsolidationType
  parentAccountId?: string | null
  displayMode?: ConsolidatedDisplayMode
  sections?: InvoiceSubAccountSection[]
  createdAt: Date
  updatedAt: Date
  sentAt?: Date
  paidAt?: Date
  deletedAt?: Date
}

export interface InvoiceLineItem {
  id: string
  description: string
  quantity: number
  rate: number
  amount: number
  accountId: string
  taxable: boolean
  classId?: string
  categoryId?: string
  tags?: string[]
}

/**
 * Sub-account section for consolidated invoices
 * Groups line items and calculations by sub-account
 */
export interface InvoiceSubAccountSection {
  subaccountId: string
  subaccountName: string
  lineItems: InvoiceLineItem[]
  subtotal: number
  taxAmount: number
  total: number
}

// =============================================================================
// Receipt Types
// =============================================================================

/**
 * Supported receipt file types
 */
export type ReceiptMimeType = 'image/jpeg' | 'image/png' | 'image/heic' | 'application/pdf'

/**
 * Receipt entity for storing uploaded receipt images
 */
export interface Receipt {
  id: string
  companyId: string
  transactionId?: string
  fileName: string
  mimeType: ReceiptMimeType
  fileSize: number
  uploadDate: Date
  imageData: string
  thumbnailData?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

// =============================================================================
// Database Types
// =============================================================================

/**
 * Sync status for offline-first architecture
 */
export type SyncStatus = 'synced' | 'pending' | 'error'

/**
 * Base interface for all database entities
 */
export interface BaseEntity {
  id: string
  companyId: string
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
  syncStatus?: SyncStatus
  version?: number
}

// =============================================================================
// Encryption Types
// =============================================================================

export interface EncryptedPayload {
  iv: string
  data: string
  authTag: string
}

export interface MasterKey {
  salt: string
  iterations: number
  keyHash: string
}

// =============================================================================
// Authentication & Session Types
// =============================================================================

/**
 * Session information for authenticated users
 */
export interface Session {
  sessionId: string
  userId: string
  companyId: string
  token: string
  expiresAt: Date
  issuedAt: Date
  deviceId?: string
}

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean
  session: Session | null
  user: UserProfile | null
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string
  passphrase: string
  companyId: string
  rememberDevice?: boolean
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Generic result type for operations that may fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number
  pageSize: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// =============================================================================
// Re-export reconciliation types
// =============================================================================

export * from './reconciliation.types'
