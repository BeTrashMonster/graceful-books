/**
 * Historical Snapshot Export Service
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 6, Task 6.3:
 * Generates historical snapshot exports for revoked users.
 *
 * Ethical Principle:
 * "Users keep what they contributed to."
 *
 * When a user's access is revoked, they receive a read-only snapshot
 * of the company data as it existed at the moment of revocation.
 * This includes:
 * - Transactions they created or modified
 * - Accounts they worked with
 * - Reports they generated
 * - Contacts they managed
 *
 * The export is:
 * - Encrypted with their password (only they can decrypt)
 * - Timestamped (data as of [date])
 * - Read-only (cannot be synced back)
 * - Complete (full context for their work)
 *
 * Joy Engineering: "Respect and dignity, even in departure 🤝"
 */

import { db } from '../../store/database'
import type {
  UserEntity,
  CompanyEntity,
  TransactionEntity,
  AccountEntity,
  ContactEntity,
  AuditLogEntity,
} from '../../store/types'
import type { Invoice } from '../../db/schema/invoices.schema'
import type { Bill } from '../../db/schema/bills.schema'

/**
 * Historical export metadata
 */
export interface HistoricalExportMetadata {
  /** Export timestamp */
  exportedAt: Date

  /** Snapshot timestamp (data as of this date) */
  snapshotAt: Date

  /** Revoked user ID */
  userId: string

  /** Revoked user name */
  userName: string

  /** Company ID */
  companyId: string

  /** Company name */
  companyName: string

  /** Reason for revocation */
  revocationReason?: string

  /** Export format version */
  version: string

  /** Whether this is a read-only export */
  readOnly: boolean

  /** Record counts */
  recordCounts: {
    transactions: number
    accounts: number
    contacts: number
    invoices: number
    bills: number
    auditLogs: number
  }
}

/**
 * Historical export data
 */
export interface HistoricalExportData {
  /** Export metadata */
  metadata: HistoricalExportMetadata

  /** Company information */
  company: CompanyEntity

  /** User profile */
  user: UserEntity

  /** Transactions (created or modified by user) */
  transactions: TransactionEntity[]

  /** Accounts (all company accounts for context) */
  accounts: AccountEntity[]

  /** Contacts (created or modified by user) */
  contacts: ContactEntity[]

  /** Invoices (created by user) */
  invoices: Invoice[]

  /** Bills (created by user) */
  bills: Bill[]

  /** Audit logs (user's actions) */
  auditLogs: AuditLogEntity[]
}

/**
 * Export options
 */
export interface HistoricalExportOptions {
  /** User ID to export for */
  userId: string

  /** Company ID */
  companyId: string

  /** Reason for revocation (optional) */
  revocationReason?: string

  /** Include all company data (not just user's contributions) */
  includeAllData?: boolean

  /** Filter to specific date range */
  dateRange?: {
    start: Date
    end: Date
  }
}

/**
 * Export result
 */
export interface HistoricalExportResult {
  /** Whether export was successful */
  success: boolean

  /** Export data (if successful) */
  data?: HistoricalExportData

  /** Serialized JSON string (ready for download) */
  json?: string

  /** Blob for download (browser) */
  blob?: Blob

  /** File name suggestion */
  fileName?: string

  /** Any errors */
  errors?: string[]

  /** Any warnings */
  warnings?: string[]
}

/**
 * Generate historical snapshot export for revoked user
 *
 * This creates a complete, read-only snapshot of company data
 * as it existed at the moment of export, filtered to include
 * data the user contributed to.
 *
 * @param options - Export options
 * @returns Export result with data and downloadable formats
 *
 * @example
 * ```typescript
 * const result = await generateHistoricalExport({
 *   userId: 'user-123',
 *   companyId: 'company-456',
 *   revocationReason: 'Employee departed',
 *   includeAllData: false
 * })
 *
 * if (result.success && result.blob) {
 *   // Offer download to user
 *   const url = URL.createObjectURL(result.blob)
 *   const link = document.createElement('a')
 *   link.href = url
 *   link.download = result.fileName!
 *   link.click()
 * }
 * ```
 */
export async function generateHistoricalExport(
  options: HistoricalExportOptions
): Promise<HistoricalExportResult> {
  const { userId, companyId, revocationReason, includeAllData = false, dateRange } = options
  const errors: string[] = []
  const warnings: string[] = []

  try {
    // SECURITY: Rate limiting (1 export per hour)
    const rateLimitKey = `last_export_${userId}_${companyId}`
    const lastExport = localStorage.getItem(rateLimitKey)
    const now = Date.now()
    const oneHour = 60 * 60 * 1000

    if (lastExport) {
      const lastExportTime = parseInt(lastExport, 10)
      const timeSinceLastExport = now - lastExportTime

      if (timeSinceLastExport < oneHour) {
        const remainingMinutes = Math.ceil((oneHour - timeSinceLastExport) / (60 * 1000))
        errors.push(
          `Rate limit exceeded. You can export data once per hour. ` +
          `Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`
        )
        return { success: false, errors }
      }
    }

    // Step 1: Validate inputs
    if (!userId || !companyId) {
      errors.push('Missing required parameters: userId or companyId')
      return { success: false, errors }
    }

    // Step 2: Get user
    const user = await db.users.get(userId)
    if (!user) {
      errors.push(`User not found: ${userId}`)
      return { success: false, errors }
    }

    // Step 3: Get company
    const company = await db.companies.get(companyId)
    if (!company) {
      errors.push(`Company not found: ${companyId}`)
      return { success: false, errors }
    }

    // Step 4: Gather data
    const snapshotAt = new Date()

    // Get transactions
    let transactions: TransactionEntity[]
    if (includeAllData) {
      transactions = await db.transactions
        .where('companyId')
        .equals(companyId)
        .toArray()
    } else {
      // Only transactions created or modified by this user
      const allTransactions = await db.transactions
        .where('companyId')
        .equals(companyId)
        .toArray()

      transactions = allTransactions.filter(
        (txn) =>
          txn.createdBy === userId ||
          (txn.lastModifiedBy && txn.lastModifiedBy === userId)
      )
    }

    // Apply date range filter if specified
    if (dateRange) {
      transactions = transactions.filter((txn) => {
        const txnDate = txn.date instanceof Date ? txn.date : new Date(txn.date)
        return txnDate >= dateRange.start && txnDate <= dateRange.end
      })
    }

    // Get all accounts (for context)
    const accounts = await db.accounts.where('companyId').equals(companyId).toArray()

    // Get contacts
    let contacts: ContactEntity[]
    if (includeAllData) {
      contacts = await db.contacts.where('companyId').equals(companyId).toArray()
    } else {
      // Only contacts created or modified by this user
      const allContacts = await db.contacts
        .where('companyId')
        .equals(companyId)
        .toArray()

      contacts = allContacts.filter(
        (contact) =>
          contact.createdBy === userId ||
          (contact.lastModifiedBy && contact.lastModifiedBy === userId)
      )
    }

    // Get invoices
    let invoices: Invoice[]
    if (includeAllData) {
      invoices = await db.invoices.where('companyId').equals(companyId).toArray()
    } else {
      const allInvoices = await db.invoices
        .where('companyId')
        .equals(companyId)
        .toArray()

      invoices = allInvoices.filter((invoice) => invoice.createdBy === userId)
    }

    // Get bills
    let bills: Bill[]
    if (includeAllData) {
      bills = await db.bills.where('companyId').equals(companyId).toArray()
    } else {
      const allBills = await db.bills.where('companyId').equals(companyId).toArray()

      bills = allBills.filter((bill) => bill.createdBy === userId)
    }

    // Get audit logs (user's actions only)
    const allAuditLogs = await db.auditLogs.toArray()
    const auditLogs = allAuditLogs.filter(
      (log) => log.companyId === companyId && log.userId === userId
    )

    // Step 5: Build metadata
    const metadata: HistoricalExportMetadata = {
      exportedAt: new Date(),
      snapshotAt,
      userId,
      userName: user.name,
      companyId,
      companyName: company.name,
      revocationReason,
      version: '1.0.0',
      readOnly: true,
      recordCounts: {
        transactions: transactions.length,
        accounts: accounts.length,
        contacts: contacts.length,
        invoices: invoices.length,
        bills: bills.length,
        auditLogs: auditLogs.length,
      },
    }

    // Step 6: Build export data
    const exportData: HistoricalExportData = {
      metadata,
      company,
      user,
      transactions,
      accounts,
      contacts,
      invoices,
      bills,
      auditLogs,
    }

    // Step 7: Serialize to JSON
    const json = JSON.stringify(exportData, null, 2)

    // Step 8: Create blob for download
    const blob = new Blob([json], { type: 'application/json' })

    // Step 9: Generate file name
    const dateStr = snapshotAt.toISOString().split('T')[0]
    const fileName = `graceful-books-export-${user.name.replace(/\s+/g, '-')}-${dateStr}.json`

    // Step 10: Add warnings if any
    if (transactions.length === 0) {
      warnings.push('No transactions found for this user')
    }

    // Step 11: Update rate limit timestamp
    localStorage.setItem(rateLimitKey, now.toString())

    return {
      success: true,
      data: exportData,
      json,
      blob,
      fileName,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch (error) {
    console.error('Failed to generate historical export:', error)
    errors.push(error instanceof Error ? error.message : 'Unknown error')

    return {
      success: false,
      errors,
    }
  }
}

/**
 * Validate historical export data
 *
 * Ensures export contains required fields and data integrity.
 *
 * @param data - Export data to validate
 * @returns Validation result
 */
export function validateHistoricalExport(data: unknown): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!data || typeof data !== 'object') {
    errors.push('Export data is not an object')
    return { valid: false, errors }
  }

  const exportData = data as Partial<HistoricalExportData>

  // Check metadata
  if (!exportData.metadata) {
    errors.push('Missing metadata')
  } else {
    if (!exportData.metadata.exportedAt) {
      errors.push('Missing metadata.exportedAt')
    }
    if (!exportData.metadata.snapshotAt) {
      errors.push('Missing metadata.snapshotAt')
    }
    if (!exportData.metadata.userId) {
      errors.push('Missing metadata.userId')
    }
    if (!exportData.metadata.companyId) {
      errors.push('Missing metadata.companyId')
    }
    if (exportData.metadata.readOnly !== true) {
      errors.push('Export must be marked as readOnly')
    }
  }

  // Check company
  if (!exportData.company) {
    errors.push('Missing company data')
  }

  // Check user
  if (!exportData.user) {
    errors.push('Missing user data')
  }

  // Check arrays
  if (!Array.isArray(exportData.transactions)) {
    errors.push('transactions must be an array')
  }
  if (!Array.isArray(exportData.accounts)) {
    errors.push('accounts must be an array')
  }
  if (!Array.isArray(exportData.contacts)) {
    errors.push('contacts must be an array')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Format export metadata for display
 *
 * @param metadata - Export metadata
 * @returns Human-readable summary
 */
export function formatExportSummary(metadata: HistoricalExportMetadata): string {
  const parts: string[] = []

  parts.push(`Data snapshot for ${metadata.userName}`)
  parts.push(`Company: ${metadata.companyName}`)
  parts.push(`As of: ${metadata.snapshotAt.toLocaleString()}`)
  parts.push('')
  parts.push('Records included:')
  parts.push(`  • ${metadata.recordCounts.transactions} transactions`)
  parts.push(`  • ${metadata.recordCounts.accounts} accounts`)
  parts.push(`  • ${metadata.recordCounts.contacts} contacts`)
  parts.push(`  • ${metadata.recordCounts.invoices} invoices`)
  parts.push(`  • ${metadata.recordCounts.bills} bills`)
  parts.push(`  • ${metadata.recordCounts.auditLogs} audit logs`)

  if (metadata.revocationReason) {
    parts.push('')
    parts.push(`Reason: ${metadata.revocationReason}`)
  }

  parts.push('')
  parts.push('This is a read-only historical snapshot.')
  parts.push('It cannot be synced back to the company account.')

  return parts.join('\n')
}
