/**
 * Post-Restoration Verification Service
 *
 * Per ROADMAP_BACKUP_AND_SYNC.md Phase 5, Task 5.7:
 * Verifies data integrity after restoration.
 *
 * Checks:
 * - All tables populated
 * - Data counts match expectations
 * - Derived key works
 * - Transactions load correctly
 * - Relationships are intact
 */

import { db } from '../../store/database'

/**
 * Verification result
 */
export interface VerificationResult {
  /** Whether verification passed */
  success: boolean

  /** Summary of what was restored */
  summary: {
    users: number
    companies: number
    transactions: number
    accounts: number
    contacts: number
    invoices: number
    bills: number
  }

  /** Any warnings found during verification */
  warnings: string[]

  /** Any errors found during verification */
  errors: string[]

  /** Overall health score (0-100) */
  healthScore: number
}

/**
 * Verification options
 */
export interface VerificationOptions {
  /** Minimum expected transaction count */
  minTransactions?: number

  /** Whether to verify derived key functionality */
  verifyEncryption?: boolean

  /** Whether to perform deep relationship checks */
  deepCheck?: boolean
}

/**
 * Verifies restored data integrity
 *
 * @param options - Verification options
 * @returns Verification result with summary and any issues found
 *
 * @example
 * ```typescript
 * const result = await verifyRestoredData()
 *
 * if (result.success) {
 *   console.log('Restored:', result.summary)
 * } else {
 *   console.error('Errors:', result.errors)
 * }
 * ```
 */
export async function verifyRestoredData(
  options: VerificationOptions = {}
): Promise<VerificationResult> {
  const { minTransactions = 0, verifyEncryption = true, deepCheck = false } = options

  const warnings: string[] = []
  const errors: string[] = []
  let healthScore = 100

  try {
    // Get database statistics
    const stats = await db.getStats()

    // Check if any data was restored
    if (
      stats.users === 0 &&
      stats.companies === 0 &&
      stats.transactions === 0 &&
      stats.accounts === 0
    ) {
      errors.push('No data was restored. Database is empty.')
      healthScore = 0
      return {
        success: false,
        summary: stats,
        warnings,
        errors,
        healthScore,
      }
    }

    // Verify minimum data requirements
    if (stats.companies === 0) {
      errors.push('No companies found. At least one company is required.')
      healthScore -= 30
    }

    if (stats.users === 0) {
      warnings.push('No users found. You may need to create a user account.')
      healthScore -= 10
    }

    if (stats.accounts === 0) {
      warnings.push('No accounts found. Chart of accounts may need to be set up.')
      healthScore -= 5
    }

    if (stats.transactions < minTransactions) {
      warnings.push(
        `Only ${stats.transactions} transactions restored (expected at least ${minTransactions}).`
      )
      healthScore -= 5
    }

    // Verify relationships
    if (deepCheck) {
      await verifyRelationships(warnings, errors)
    }

    // Verify encryption key works
    if (verifyEncryption && stats.companies > 0) {
      try {
        // Try to read a company (this will use the derived key)
        const companies = await db.companies.limit(1).toArray()
        if (companies.length === 0) {
          errors.push('Unable to read company data. Encryption key may be invalid.')
          healthScore -= 25
        }
      } catch (error) {
        errors.push('Error reading encrypted data. Derived key verification failed.')
        healthScore -= 25
      }
    }

    // Verify no orphaned records
    if (deepCheck) {
      await verifyNoOrphans(warnings, errors)
    }

    // Calculate final health score
    healthScore = Math.max(0, Math.min(100, healthScore))

    // Determine success
    const success = errors.length === 0 && healthScore >= 70

    return {
      success,
      summary: stats,
      warnings,
      errors,
      healthScore,
    }
  } catch (error) {
    errors.push(
      `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )

    return {
      success: false,
      summary: {
        users: 0,
        companies: 0,
        transactions: 0,
        accounts: 0,
        contacts: 0,
        auditLogs: 0,
      },
      warnings,
      errors,
      healthScore: 0,
    }
  }
}

/**
 * Verifies relationships between entities
 */
async function verifyRelationships(warnings: string[], errors: string[]): Promise<void> {
  try {
    // Check transactions have valid accounts
    const transactions = await db.transactions.limit(10).toArray()
    for (const txn of transactions) {
      if (txn.lineItems) {
        for (const lineItem of txn.lineItems) {
          if (lineItem.accountId) {
            const account = await db.accounts.get(lineItem.accountId)
            if (!account) {
              warnings.push(
                `Transaction ${txn.id} references non-existent account ${lineItem.accountId}`
              )
            }
          }
        }
      }
    }

    // Check contacts have valid companies
    const contacts = await db.contacts.limit(10).toArray()
    for (const contact of contacts) {
      if (contact.companyId) {
        const company = await db.companies.get(contact.companyId)
        if (!company) {
          warnings.push(`Contact ${contact.id} references non-existent company ${contact.companyId}`)
        }
      }
    }
  } catch (error) {
    errors.push(`Relationship verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Verifies no orphaned records exist
 */
async function verifyNoOrphans(warnings: string[], errors: string[]): Promise<void> {
  try {
    // Check for accounts without companies
    const orphanedAccounts = await db.accounts.where('companyId').equals('').count()
    if (orphanedAccounts > 0) {
      warnings.push(`Found ${orphanedAccounts} accounts without a company`)
    }

    // Check for transactions without companies
    const orphanedTransactions = await db.transactions.where('companyId').equals('').count()
    if (orphanedTransactions > 0) {
      warnings.push(`Found ${orphanedTransactions} transactions without a company`)
    }
  } catch (error) {
    errors.push(`Orphan check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Formats verification summary for display
 *
 * @param result - Verification result
 * @returns Human-readable summary string
 */
export function formatVerificationSummary(result: VerificationResult): string {
  const { summary } = result
  const parts: string[] = []

  if (summary.users > 0) {
    parts.push(`${summary.users} user${summary.users === 1 ? '' : 's'}`)
  }

  if (summary.companies > 0) {
    parts.push(`${summary.companies} company${summary.companies === 1 ? '' : 'ies'}`)
  }

  if (summary.accounts > 0) {
    parts.push(`${summary.accounts} account${summary.accounts === 1 ? '' : 's'}`)
  }

  if (summary.transactions > 0) {
    parts.push(`${summary.transactions} transaction${summary.transactions === 1 ? '' : 's'}`)
  }

  if (summary.contacts > 0) {
    parts.push(`${summary.contacts} contact${summary.contacts === 1 ? '' : 's'}`)
  }

  if (summary.invoices > 0) {
    parts.push(`${summary.invoices} invoice${summary.invoices === 1 ? '' : 's'}`)
  }

  if (summary.bills > 0) {
    parts.push(`${summary.bills} bill${summary.bills === 1 ? '' : 's'}`)
  }

  if (parts.length === 0) {
    return 'No data restored'
  }

  return `Restored: ${parts.join(', ')}`
}

/**
 * Gets health status badge info based on health score
 *
 * @param healthScore - Health score (0-100)
 * @returns Badge info with color and label
 */
export function getHealthBadge(healthScore: number): {
  color: 'success' | 'warning' | 'danger'
  label: string
} {
  if (healthScore >= 90) {
    return { color: 'success', label: 'Excellent' }
  } else if (healthScore >= 70) {
    return { color: 'success', label: 'Good' }
  } else if (healthScore >= 50) {
    return { color: 'warning', label: 'Fair' }
  } else {
    return { color: 'danger', label: 'Poor' }
  }
}
