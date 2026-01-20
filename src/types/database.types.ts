/**
 * Database Type Definitions for Graceful Books
 *
 * This file contains TypeScript types for all database entities.
 * These types support the local-first, zero-knowledge architecture with CRDT compatibility.
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Base fields present in all entities for CRDT support
 */
export interface BaseEntity {
  id: string; // UUID v4
  created_at: number; // Unix timestamp in milliseconds
  updated_at: number; // Unix timestamp in milliseconds - used for Last-Write-Wins conflict resolution
  deleted_at: number | null; // Tombstone marker for soft deletes - null if not deleted
}

/**
 * Version vector for CRDT conflict resolution
 * Maps device ID to logical clock value
 */
export type VersionVector = Record<string, number>;

// ============================================================================
// Account Types
// ============================================================================

/**
 * Account types following standard accounting categories
 */
export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  COGS = 'COGS', // Cost of Goods Sold
  OTHER_INCOME = 'OTHER_INCOME',
  OTHER_EXPENSE = 'OTHER_EXPENSE',
}

/**
 * Chart of Accounts - Core accounting entity
 * Supports hierarchical structure with parent/child relationships
 */
export interface Account extends BaseEntity {
  company_id: string; // UUID - links to Company
  account_number: string | null; // Optional account number (e.g., "1000", "4500")
  name: string; // ENCRYPTED - Account name (e.g., "Cash", "Sales Revenue")
  type: AccountType; // Plaintext for querying
  parent_id: string | null; // UUID - For sub-accounts (must match parent type)
  balance: string; // ENCRYPTED - Stored as string to preserve decimal precision (DECIMAL(15,2))
  description: string | null; // ENCRYPTED - Optional description
  active: boolean; // Whether the account is currently active
  version_vector: VersionVector; // For CRDT conflict resolution
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Transaction status
 */
export enum TransactionStatus {
  DRAFT = 'DRAFT', // Not yet posted
  POSTED = 'POSTED', // Posted to ledger
  VOID = 'VOID', // Voided transaction
  RECONCILED = 'RECONCILED', // Reconciled with bank statement
}

/**
 * Transaction type for categorization
 */
export enum TransactionType {
  JOURNAL_ENTRY = 'JOURNAL_ENTRY',
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
  EXPENSE = 'EXPENSE',
  BILL = 'BILL',
  CREDIT_NOTE = 'CREDIT_NOTE',
  ADJUSTMENT = 'ADJUSTMENT',
  BARTER = 'BARTER', // I5: Barter/Trade Transactions
}

/**
 * Transaction (Journal Entry Header)
 * Each transaction contains multiple line items that must balance
 */
export interface Transaction extends BaseEntity {
  company_id: string; // UUID - links to Company
  transaction_number: string; // ENCRYPTED - Sequential number (e.g., "JE-0001")
  transaction_date: number; // Unix timestamp - Date of transaction
  type: TransactionType; // Plaintext for querying
  status: TransactionStatus; // Plaintext for querying
  description: string | null; // ENCRYPTED - Transaction description
  reference: string | null; // ENCRYPTED - External reference (e.g., invoice number)
  memo: string | null; // ENCRYPTED - Internal memo
  attachments: string[]; // ENCRYPTED - Array of attachment IDs/URLs
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Transaction Line Item
 * Individual debit or credit entries within a transaction
 * The sum of all debits must equal the sum of all credits for a transaction
 */
export interface TransactionLineItem extends BaseEntity {
  transaction_id: string; // UUID - links to Transaction
  account_id: string; // UUID - links to Account
  debit: string; // ENCRYPTED - Debit amount as string (DECIMAL(15,2))
  credit: string; // ENCRYPTED - Credit amount as string (DECIMAL(15,2))
  description: string | null; // ENCRYPTED - Line item description
  contact_id: string | null; // UUID - Optional link to Contact
  product_id: string | null; // UUID - Optional link to Product
  version_vector: VersionVector; // For CRDT conflict resolution
}

// ============================================================================
// Contact Types
// ============================================================================

/**
 * Contact type - can be customer, vendor, or both
 */
export enum ContactType {
  CUSTOMER = 'CUSTOMER',
  VENDOR = 'VENDOR',
  BOTH = 'BOTH', // Can be both customer and vendor
}

/**
 * Contact account hierarchy type for multi-location businesses
 * G3: Hierarchical Contacts Infrastructure
 */
export enum ContactAccountType {
  STANDALONE = 'standalone', // Default - no hierarchy
  PARENT = 'parent', // Parent account with sub-accounts
  CHILD = 'child', // Sub-account under a parent
}

/**
 * Contact entity for customers and vendors
 */
export interface Contact extends BaseEntity {
  company_id: string; // UUID - links to Company
  type: ContactType; // Plaintext for querying
  name: string; // ENCRYPTED - Contact name
  email: string | null; // ENCRYPTED - Email address
  phone: string | null; // ENCRYPTED - Phone number
  address: string | null; // ENCRYPTED - Full address
  tax_id: string | null; // ENCRYPTED - Tax ID / VAT number
  notes: string | null; // ENCRYPTED - Internal notes
  active: boolean; // Whether the contact is currently active
  balance: string; // ENCRYPTED - Current balance (DECIMAL(15,2))
  version_vector: VersionVector; // For CRDT conflict resolution

  // G3: Hierarchical Contacts Infrastructure fields
  parent_id: string | null; // UUID - links to parent Contact (null for standalone/parent)
  account_type: ContactAccountType; // Hierarchy type
  hierarchy_level: number; // Depth in hierarchy (0 = standalone/root, max 3)
}

// ============================================================================
// Product Types
// ============================================================================

/**
 * Product type - physical product or service
 */
export enum ProductType {
  PRODUCT = 'PRODUCT', // Physical product
  SERVICE = 'SERVICE', // Service
}

/**
 * Product/Service catalog
 */
export interface Product extends BaseEntity {
  company_id: string; // UUID - links to Company
  type: ProductType; // Plaintext for querying
  sku: string | null; // ENCRYPTED - Stock Keeping Unit
  name: string; // ENCRYPTED - Product/service name
  description: string | null; // ENCRYPTED - Description
  unit_price: string; // ENCRYPTED - Default unit price (DECIMAL(15,2))
  cost: string | null; // ENCRYPTED - Cost of product (DECIMAL(15,2))
  income_account_id: string | null; // UUID - Default income account
  expense_account_id: string | null; // UUID - Default expense account
  taxable: boolean; // Whether the product is taxable
  active: boolean; // Whether the product is currently active
  version_vector: VersionVector; // For CRDT conflict resolution
}

// ============================================================================
// Receipt Types
// ============================================================================

/**
 * Receipt MIME types
 */
export type ReceiptMimeType = 'image/jpeg' | 'image/png' | 'image/heic' | 'application/pdf'

/**
 * Receipt entity for storing uploaded receipt images
 */
export interface Receipt extends BaseEntity {
  company_id: string; // UUID - links to Company
  transaction_id: string | null; // UUID - Optional link to Transaction
  file_name: string; // Original file name
  mime_type: ReceiptMimeType; // File MIME type
  file_size: number; // File size in bytes
  upload_date: number; // Unix timestamp when uploaded
  image_data: string; // ENCRYPTED - Base64 encoded image data
  thumbnail_data: string | null; // ENCRYPTED - Base64 encoded thumbnail
  notes: string | null; // ENCRYPTED - User notes about the receipt
  version_vector: VersionVector; // For CRDT conflict resolution
}

// ============================================================================
// User Types
// ============================================================================

/**
 * User role within a company
 */
export enum UserRole {
  OWNER = 'OWNER', // Company owner - full access
  ADMIN = 'ADMIN', // Administrator - full access except billing
  ACCOUNTANT = 'ACCOUNTANT', // Full accounting access
  BOOKKEEPER = 'BOOKKEEPER', // Can create/edit transactions
  VIEWER = 'VIEWER', // Read-only access
}

/**
 * User profile
 */
export interface User extends BaseEntity {
  email: string; // ENCRYPTED - User email (used for login)
  name: string; // ENCRYPTED - User full name
  passphrase_hash: string; // Argon2id hash of passphrase (NOT ENCRYPTED)
  master_key_encrypted: string; // Encrypted master key (encrypted with passphrase-derived key)
  preferences: UserPreferences; // ENCRYPTED - User preferences
  selected_charity_id: string | null; // UUID - Selected charity for monthly donation
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * User preferences
 */
export interface UserPreferences {
  language: string; // ISO 639-1 code (e.g., "en", "es")
  timezone: string; // IANA timezone (e.g., "America/New_York")
  date_format: string; // Date format preference (e.g., "MM/DD/YYYY")
  currency_display: string; // Currency display format (e.g., "$1,000.00")
  theme: 'light' | 'dark' | 'auto'; // Theme preference
  reduced_motion: boolean; // Accessibility - reduced motion preference
  high_contrast: boolean; // Accessibility - high contrast mode
}

/**
 * Company-User association
 * Links users to companies with role-based access
 */
export interface CompanyUser extends BaseEntity {
  company_id: string; // UUID - links to Company
  user_id: string; // UUID - links to User
  role: UserRole; // User's role in this company
  permissions: string[]; // Granular permissions array
  active: boolean; // Whether the user access is active
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Company entity
 */
export interface Company extends BaseEntity {
  name: string; // ENCRYPTED - Company name
  legal_name: string | null; // ENCRYPTED - Legal business name
  tax_id: string | null; // ENCRYPTED - Tax ID / EIN
  address: string | null; // ENCRYPTED - Company address
  phone: string | null; // ENCRYPTED - Phone number
  email: string | null; // ENCRYPTED - Company email
  fiscal_year_end: string | null; // Fiscal year end (MM-DD format)
  currency: string; // ISO 4217 currency code (e.g., "USD")
  settings: CompanySettings; // ENCRYPTED - Company settings
  version_vector: VersionVector; // For CRDT conflict resolution
}

/**
 * Company settings
 */
export interface CompanySettings {
  accounting_method: 'accrual' | 'cash'; // Accounting method
  multi_currency: boolean; // Enable multi-currency support
  track_inventory: boolean; // Enable inventory tracking
  auto_backup: boolean; // Enable automatic backups
  retention_period_days: number; // Audit log retention period
}

// ============================================================================
// Audit Log Types
// ============================================================================

/**
 * Audit action types
 */
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  RESTORE = 'RESTORE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
}

/**
 * Entity types that can be audited
 */
export enum AuditEntityType {
  ACCOUNT = 'ACCOUNT',
  TRANSACTION = 'TRANSACTION',
  CONTACT = 'CONTACT',
  PRODUCT = 'PRODUCT',
  USER = 'USER',
  COMPANY = 'COMPANY',
  SESSION = 'SESSION',
  RECONCILIATION_PATTERN = 'RECONCILIATION_PATTERN',
  RECONCILIATION_RECORD = 'RECONCILIATION_RECORD',
  RECONCILIATION_STREAK = 'RECONCILIATION_STREAK',
}

/**
 * Audit log entry
 * Immutable record of all changes to financial data
 */
export interface AuditLog extends BaseEntity {
  company_id: string; // UUID - links to Company
  user_id: string; // UUID - User who performed the action
  entity_type: AuditEntityType; // Type of entity affected
  entity_id: string; // UUID of affected entity
  action: AuditAction; // Action performed
  before_value: string | null; // ENCRYPTED - JSON snapshot before change
  after_value: string | null; // ENCRYPTED - JSON snapshot after change
  changed_fields: string[]; // Array of field names that changed
  ip_address: string | null; // IP address of request
  device_id: string | null; // Device identifier
  user_agent: string | null; // Browser user agent
  timestamp: number; // Unix timestamp in milliseconds (UTC)
  // Note: Audit logs do NOT have version_vector as they are immutable
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * User session for authentication
 */
export interface Session extends BaseEntity {
  user_id: string; // UUID - links to User
  company_id: string | null; // UUID - Currently selected company
  token: string; // Session token (JWT or similar)
  device_id: string; // Device identifier for "remember device"
  device_name: string | null; // ENCRYPTED - Friendly device name
  ip_address: string | null; // IP address of session
  user_agent: string | null; // Browser user agent
  expires_at: number; // Unix timestamp when session expires
  last_activity_at: number; // Unix timestamp of last activity
  remember_device: boolean; // Whether to remember this device
  // Note: Sessions use created_at/updated_at/deleted_at from BaseEntity
  version_vector: VersionVector; // For CRDT conflict resolution
}

// ============================================================================
// Device Types (for multi-device sync)
// ============================================================================

/**
 * Device registration for multi-device sync
 */
export interface Device extends BaseEntity {
  user_id: string; // UUID - links to User
  device_id: string; // Unique device identifier
  device_name: string; // ENCRYPTED - Friendly device name
  device_type: 'browser' | 'desktop' | 'mobile'; // Device type
  last_sync_at: number | null; // Unix timestamp of last successful sync
  sync_vector: VersionVector; // Sync state for this device
  trusted: boolean; // Whether device is trusted
  version_vector: VersionVector; // For CRDT conflict resolution
}

// ============================================================================
// Charity Types
// ============================================================================

/**
 * Charity category types
 */
export enum CharityCategory {
  EDUCATION = 'EDUCATION',
  ENVIRONMENT = 'ENVIRONMENT',
  HEALTH = 'HEALTH',
  POVERTY = 'POVERTY',
  ANIMAL_WELFARE = 'ANIMAL_WELFARE',
  HUMAN_RIGHTS = 'HUMAN_RIGHTS',
  DISASTER_RELIEF = 'DISASTER_RELIEF',
  ARTS_CULTURE = 'ARTS_CULTURE',
  COMMUNITY = 'COMMUNITY',
  OTHER = 'OTHER',
}

/**
 * Charity verification status
 */
export enum CharityStatus {
  PENDING = 'PENDING', // Awaiting verification
  VERIFIED = 'VERIFIED', // Verified and available for selection
  REJECTED = 'REJECTED', // Rejected during verification
  INACTIVE = 'INACTIVE', // Previously verified but now inactive
}

/**
 * Charity entity
 * Represents charitable organizations users can support
 */
export interface Charity {
  id: string; // UUID
  name: string; // Charity name (e.g., "Khan Academy", "GiveDirectly")
  ein: string; // EIN/Tax ID (format: XX-XXXXXXX)
  description: string; // 1-2 sentence description
  category: CharityCategory; // Charity category
  website: string; // Charity website URL
  logo: string | null; // Logo URL or icon identifier
  payment_address: string | null; // Payment address for ACH/check/wire (ENCRYPTED)
  status: CharityStatus; // Verification status
  verification_notes: string | null; // Admin notes during verification process
  rejection_reason: string | null; // Reason for rejection (if status is REJECTED)
  created_by: string | null; // Admin user ID who created the charity
  created_at: number; // Unix timestamp
  updated_at: number; // Unix timestamp
  active: boolean; // Whether the charity is currently available for selection (deprecated - use status instead)
}

// ============================================================================
// All types and enums are exported inline above
// ============================================================================

/**
 * Re-exports from other type files for convenience
 */
export type { JournalEntry } from './journalEntry.types'
