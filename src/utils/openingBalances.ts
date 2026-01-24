/**
 * Opening Balance Journal Entry Generation
 *
 * Creates GAAP-compliant opening balance journal entries.
 * - Equipment (assets): Splits to member capital accounts based on ownership
 * - Loans (liabilities): Offsets to member distribution accounts based on ownership
 */

import { nanoid } from 'nanoid'
import type { EntityConfiguration, Account, JournalEntry, JournalEntryLine } from '../types'

export interface OpeningBalanceItem {
  accountId: string
  accountName: string
  amount: number // Amount in cents
  date: Date
  type: 'equipment' | 'credit-card' | 'loan'
}

/**
 * Create opening balance journal entries
 *
 * For assets (equipment): Debit Asset, Credit Member Capital (split by %)
 * For liabilities (loans): Debit Member Distributions (split by %), Credit Liability
 *
 * @param items - Opening balance items with account IDs
 * @param entityConfig - Entity configuration with ownership info
 * @param memberCapitalAccounts - The created member capital/distribution account objects
 * @param companyId - Company ID
 * @returns Array of journal entries to create
 */
export function generateOpeningBalanceJournalEntries(
  items: OpeningBalanceItem[],
  entityConfig: EntityConfiguration,
  memberCapitalAccounts: Account[],
  companyId: string
): Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>[] {
  const entries: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>[] = []

  items.forEach((item) => {
    const lines: JournalEntryLine[] = []

    if (item.type === 'equipment') {
      // Asset: Debit Equipment, Credit Member Capital (split)
      lines.push({
        id: nanoid(),
        accountId: item.accountId,
        debit: item.amount,
        credit: 0,
        memo: `Opening balance - ${item.accountName}`,
      })

      // Credit each member's capital account based on ownership percentage
      entityConfig.owners.forEach((owner) => {
        const memberCapitalAccount = memberCapitalAccounts.find(
          (acc) => acc.name.includes(owner.name) && acc.name.includes('Capital') && !acc.name.includes('Distributions')
        )

        if (memberCapitalAccount) {
          const ownerAmount = Math.round(item.amount * (owner.ownershipPercentage / 100))
          lines.push({
            id: nanoid(),
            accountId: memberCapitalAccount.id,
            debit: 0,
            credit: ownerAmount,
            memo: `Opening balance equity - ${item.accountName}`,
          })
        }
      })
    } else if (item.type === 'credit-card' || item.type === 'loan') {
      // Liability: Debit Member Distributions (split), Credit Liability

      // Debit each member's distribution account based on ownership percentage
      entityConfig.owners.forEach((owner) => {
        const memberDistributionAccount = memberCapitalAccounts.find(
          (acc) => acc.name.includes(owner.name) && acc.name.includes('Distributions')
        )

        if (memberDistributionAccount) {
          const ownerAmount = Math.round(item.amount * (owner.ownershipPercentage / 100))
          lines.push({
            id: nanoid(),
            accountId: memberDistributionAccount.id,
            debit: ownerAmount,
            credit: 0,
            memo: `Opening balance draw - ${item.accountName}`,
          })
        }
      })

      // Credit the liability account
      lines.push({
        id: nanoid(),
        accountId: item.accountId,
        debit: 0,
        credit: item.amount,
        memo: `Opening balance - ${item.accountName}`,
      })
    }

    // Create the journal entry
    const memoPrefix = item.type === 'equipment' ? 'Opening balance - Equipment' :
                       item.type === 'loan' ? 'Opening balance - Loan' :
                       'Opening balance - Liability'

    entries.push({
      companyId,
      date: item.date,
      reference: 'OPENING',
      memo: `${memoPrefix}: ${item.accountName}`,
      status: 'posted',
      lines,
      createdBy: 'system', // TODO: Use actual user ID when auth is implemented
    })
  })

  return entries
}

/**
 * Parse dollar amount string to cents
 * Handles formats like: "$3,500.00", "3500", "$3,500"
 */
export function parseDollarsToCents(dollarString: string): number {
  // Remove $, commas, and whitespace
  const cleaned = dollarString.replace(/[$,\s]/g, '')
  const dollars = parseFloat(cleaned)

  if (isNaN(dollars)) {
    return 0
  }

  return Math.round(dollars * 100)
}
