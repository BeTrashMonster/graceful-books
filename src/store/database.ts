/**
 * Dexie Database Configuration
 *
 * This module sets up the IndexedDB database using Dexie.js with:
 * - All entity tables (accounts, transactions, contacts, products, users, audit logs, companies)
 * - Indexes for performance optimization
 * - Schema versioning
 * - CRDT support for offline-first architecture
 */

import Dexie, { type Table } from 'dexie'
import type {
  AccountEntity,
  TransactionEntity,
  ContactEntity,
  ProductEntity,
  UserEntity,
  AuditLogEntity,
  CompanyEntity,
  ReceiptEntity,
  ReconciliationEntity,
} from './types'
import type { Category } from '../db/schema/categories.schema'
import type { Tag, EntityTag } from '../db/schema/tags.schema'
import type { Invoice } from '../db/schema/invoices.schema'
import type { RecurringInvoice, GeneratedInvoice } from '../db/schema/recurringInvoices.schema'
import type { Bill } from '../db/schema/bills.schema'
import type { AssessmentResultEntity, AssessmentSessionEntity } from '../db/schema/assessmentResults.schema'
import type { ChecklistItem } from '../db/schema/checklistItems.schema'
import type { TutorialProgress } from '../types/tutorial.types'
import type { ReconciliationPattern, ReconciliationStreak } from '../types/reconciliation.types'
import { reconciliationPatternsSchema } from '../db/schema/reconciliationPatterns.schema'
import { reconciliationStreaksSchema } from '../db/schema/reconciliationStreaks.schema'

/**
 * GracefulBooksDB - Main database class extending Dexie
 *
 * Implements the local-first data store with IndexedDB as the primary storage.
 * All operations work offline by default. Sync capabilities are handled separately.
 */
export class GracefulBooksDB extends Dexie {
  // Table declarations
  accounts!: Table<AccountEntity, string>
  transactions!: Table<TransactionEntity, string>
  contacts!: Table<ContactEntity, string>
  products!: Table<ProductEntity, string>
  users!: Table<UserEntity, string>
  auditLogs!: Table<AuditLogEntity, string>
  companies!: Table<CompanyEntity, string>
  // discProfiles table removed - not needed (Steadiness communication style for all users)
  categories!: Table<Category, string>
  tags!: Table<Tag, string>
  entity_tags!: Table<EntityTag, string>
  invoices!: Table<Invoice, string>
  recurringInvoices!: Table<RecurringInvoice, string>
  generatedInvoices!: Table<GeneratedInvoice, string>
  bills!: Table<Bill, string>
  assessmentResults!: Table<AssessmentResultEntity, string>
  assessmentSessions!: Table<AssessmentSessionEntity, string>
  checklistItems!: Table<ChecklistItem, string>
  receipts!: Table<ReceiptEntity, string>
  tutorialProgress!: Table<TutorialProgress, string>
  reconciliations!: Table<ReconciliationEntity, string>
  reconciliation_patterns!: Table<ReconciliationPattern, string>
  reconciliation_streaks!: Table<ReconciliationStreak, [string, string]>

  constructor() {
    super('GracefulBooksDB')

    // Schema version 1 - Initial schema
    this.version(1).stores({
      // Accounts table
      // Primary index: id
      // Compound indexes for common queries
      accounts: `
        id,
        companyId,
        type,
        isActive,
        parentAccountId,
        [companyId+type],
        [companyId+isActive],
        [companyId+type+isActive],
        lastModifiedAt,
        deletedAt
      `,

      // Transactions table
      // Indexes for querying by company, status, date range, and account
      transactions: `
        id,
        companyId,
        status,
        date,
        [companyId+status],
        [companyId+date],
        [companyId+status+date],
        createdBy,
        lastModifiedAt,
        deletedAt
      `,

      // Contacts table
      // Indexes for querying by company, type, and active status
      contacts: `
        id,
        companyId,
        type,
        isActive,
        [companyId+type],
        [companyId+isActive],
        [companyId+type+isActive],
        lastModifiedAt,
        deletedAt
      `,

      // Products table
      // Indexes for querying by company, type, and active status
      products: `
        id,
        companyId,
        type,
        isActive,
        sku,
        [companyId+type],
        [companyId+isActive],
        [companyId+type+isActive],
        lastModifiedAt,
        deletedAt
      `,

      // Users table
      // Indexes for authentication and company access
      users: `
        id,
        companyId,
        email,
        [companyId+email],
        lastLoginAt,
        lastModifiedAt,
        deletedAt
      `,

      // Audit logs table
      // Indexes for querying by company, entity, user, and time range
      // Note: Audit logs are immutable and never deleted
      auditLogs: `
        id,
        company_id,
        entity_type,
        entity_id,
        user_id,
        timestamp,
        action,
        [company_id+timestamp],
        [company_id+entity_type],
        [company_id+entity_id],
        [company_id+user_id],
        [company_id+entity_type+entity_id],
        [entity_type+entity_id]
      `,

      // Companies table
      companies: `
        id,
        lastModifiedAt,
        deletedAt
      `,

      // DISC Profiles table removed - not needed (Steadiness communication style for all users)

      // Categories table
      // Indexes for querying by company, type, and hierarchical structure
      categories: `
        id,
        company_id,
        name,
        type,
        [company_id+type],
        [company_id+active],
        parent_id,
        updated_at,
        deleted_at
      `,

      // Tags table
      // Indexes for querying by company and usage count
      tags: `
        id,
        company_id,
        [company_id+usage_count],
        updated_at,
        deleted_at
      `,

      // Entity Tags table (many-to-many relationship)
      // Indexes for querying tags by entity and entities by tag
      entity_tags: `
        id,
        tag_id,
        entity_id,
        [entity_type+entity_id],
        [tag_id+entity_type],
        company_id,
        updated_at,
        deleted_at
      `,

      // Invoices table
      // Indexes for querying by company, customer, status, and date range
      invoices: `
        id,
        company_id,
        customer_id,
        status,
        [company_id+status],
        [company_id+customer_id],
        invoice_number,
        invoice_date,
        due_date,
        updated_at,
        deleted_at
      `,

      // Recurring Invoices table
      // Indexes for querying by company, customer, status, and next generation date
      recurringInvoices: `
        id,
        company_id,
        customer_id,
        status,
        [company_id+status],
        [company_id+customer_id],
        next_generation_date,
        updated_at,
        deleted_at
      `,

      // Generated Invoices table
      // Indexes for querying by recurring invoice and invoice
      generatedInvoices: `
        id,
        recurring_invoice_id,
        invoice_id,
        [recurring_invoice_id+generation_date],
        generation_date
      `,

      // Bills table
      // Indexes for querying by company, vendor, status, and date range
      bills: `
        id,
        company_id,
        vendor_id,
        status,
        [company_id+status],
        [company_id+vendor_id],
        bill_number,
        bill_date,
        due_date,
        updated_at,
        deleted_at
      `,

      // Assessment Results table
      // Indexes for querying by user and completion date
      assessmentResults: `
        id,
        user_id,
        completed_at,
        updated_at,
        deleted_at
      `,

      // Assessment Sessions table (in-progress assessments)
      // Indexes for querying by user and last update time
      assessmentSessions: `
        id,
        user_id,
        last_updated_at,
        updated_at,
        deleted_at
      `,

      // Checklist Items table
      // Indexes for querying by user, phase, category, and completion status
      checklistItems: `
        id,
        user_id,
        [user_id+phase],
        [user_id+category],
        [user_id+completed],
        completed_at,
        updated_at,
        deleted_at
      `,

      // Receipts table
      // Indexes for querying by company, transaction link, and upload date
      receipts: `
        id,
        companyId,
        transactionId,
        uploadDate,
        [companyId+uploadDate],
        [companyId+transactionId],
        lastModifiedAt,
        deletedAt
      `,

      // Tutorial Progress table
      // Indexes for querying by user, tutorial, and status
      tutorialProgress: `
        id,
        user_id,
        tutorial_id,
        status,
        [user_id+tutorial_id],
        [user_id+status],
        completed_at,
        updated_at,
        deleted_at
      `,

      // Reconciliations table
      // Indexes for querying by company, account, status, and date range
      reconciliations: `
        id,
        companyId,
        accountId,
        status,
        [companyId+accountId],
        [companyId+status],
        [companyId+accountId+status],
        statementPeriodEnd,
        completedAt,
        lastModifiedAt,
        deletedAt
      `,
    })

    // Schema version 2 - Add reconciliation patterns and streaks tables
    this.version(2).stores({
      // Reconciliation Patterns table
      // Indexes for querying by company, vendor name, and last matched date
      reconciliation_patterns: reconciliationPatternsSchema,

      // Reconciliation Streaks table
      // Indexes for querying by company+account (compound key), status, and due date
      reconciliation_streaks: reconciliationStreaksSchema,
    })

    // Version 3: Fix auditLogs and categories indexes to use snake_case field names
    this.version(3).stores({
      // Update auditLogs to use snake_case field names (matching actual data structure)
      auditLogs: `
        id,
        company_id,
        entity_type,
        entity_id,
        user_id,
        timestamp,
        action,
        [company_id+timestamp],
        [company_id+entity_type],
        [company_id+entity_id],
        [company_id+user_id],
        [company_id+entity_type+entity_id],
        [entity_type+entity_id]
      `,

      // Add name index to categories table
      categories: `
        id,
        company_id,
        name,
        type,
        [company_id+type],
        [company_id+active],
        parent_id,
        updated_at,
        deleted_at
      `,
    })
  }

  /**
   * Clear all data (useful for logout or testing)
   */
  async clearAllData(): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      for (const table of this.tables) {
        await table.clear()
      }
    })
  }

  /**
   * Clear data for a specific company (useful for company deletion)
   */
  async clearCompanyData(companyId: string): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      await this.accounts.where('companyId').equals(companyId).delete()
      await this.transactions.where('companyId').equals(companyId).delete()
      await this.contacts.where('companyId').equals(companyId).delete()
      await this.products.where('companyId').equals(companyId).delete()
      await this.users.where('companyId').equals(companyId).delete()
      await this.auditLogs.where('companyId').equals(companyId).delete()
      await this.companies.where('id').equals(companyId).delete()
    })
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    accounts: number
    transactions: number
    contacts: number
    products: number
    users: number
    auditLogs: number
    companies: number
    totalSize?: number
  }> {
    const [
      accountsCount,
      transactionsCount,
      contactsCount,
      productsCount,
      usersCount,
      auditLogsCount,
      companiesCount,
    ] = await Promise.all([
      this.accounts.count(),
      this.transactions.count(),
      this.contacts.count(),
      this.products.count(),
      this.users.count(),
      this.auditLogs.count(),
      this.companies.count(),
    ])

    // Get database size estimate (if available)
    let totalSize: number | undefined
    if ('estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      totalSize = estimate.usage
    }

    return {
      accounts: accountsCount,
      transactions: transactionsCount,
      contacts: contactsCount,
      products: productsCount,
      users: usersCount,
      auditLogs: auditLogsCount,
      companies: companiesCount,
      totalSize,
    }
  }

  /**
   * Export all data (for backup or sync)
   */
  async exportAllData(): Promise<{
    accounts: AccountEntity[]
    transactions: TransactionEntity[]
    contacts: ContactEntity[]
    products: ProductEntity[]
    users: UserEntity[]
    auditLogs: AuditLogEntity[]
    companies: CompanyEntity[]
  }> {
    const [
      accounts,
      transactions,
      contacts,
      products,
      users,
      auditLogs,
      companies,
    ] = await Promise.all([
      this.accounts.toArray(),
      this.transactions.toArray(),
      this.contacts.toArray(),
      this.products.toArray(),
      this.users.toArray(),
      this.auditLogs.toArray(),
      this.companies.toArray(),
    ])

    return {
      accounts,
      transactions,
      contacts,
      products,
      users,
      auditLogs,
      companies,
    }
  }

  /**
   * Import data (for restore or initial sync)
   */
  async importData(data: {
    accounts?: AccountEntity[]
    transactions?: TransactionEntity[]
    contacts?: ContactEntity[]
    products?: ProductEntity[]
    users?: UserEntity[]
    auditLogs?: AuditLogEntity[]
    companies?: CompanyEntity[]
  }): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      if (data.accounts) {
        await this.accounts.bulkPut(data.accounts)
      }
      if (data.transactions) {
        await this.transactions.bulkPut(data.transactions)
      }
      if (data.contacts) {
        await this.contacts.bulkPut(data.contacts)
      }
      if (data.products) {
        await this.products.bulkPut(data.products)
      }
      if (data.users) {
        await this.users.bulkPut(data.users)
      }
      if (data.auditLogs) {
        await this.auditLogs.bulkPut(data.auditLogs)
      }
      if (data.companies) {
        await this.companies.bulkPut(data.companies)
      }
    })
  }
}

/**
 * Singleton database instance
 * Use this instance throughout the application
 */
export const db = new GracefulBooksDB()

/**
 * Type helper for database transactions
 */
export type DBTransaction = typeof db extends Dexie
  ? Parameters<(typeof db)['transaction']>[2]
  : never
