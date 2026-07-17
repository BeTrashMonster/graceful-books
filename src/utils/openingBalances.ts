/**
 * Opening Balance Journal Entry Generation
 *
 * Creates opening balance journal entries using "Ask Future Me" as the offset account.
 * Users can later review and recategorize these entries to the correct accounts.
 */

import { nanoid } from 'nanoid'
import type { Account, JournalEntry, JournalEntryLine } from '../types'

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
 * All opening balances offset to "Ask Future Me" expense account.
 * This allows users to easily review and recategorize later.
 *
 * For assets (equipment): Debit Asset, Credit "Ask Future Me"
 * For liabilities (loans): Debit "Ask Future Me", Credit Liability
 *
 * @param items - Opening balance items with account IDs
 * @param askFutureMeAccount - The "Ask Future Me" offset account
 * @param companyId - Company ID
 * @returns Array of journal entries to create
 */
export function generateOpeningBalanceJournalEntries(
  items: OpeningBalanceItem[],
  askFutureMeAccount: Account,
  companyId: string
): Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>[] {
  const entries: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>[] = []

  items.forEach((item) => {
    const lines: JournalEntryLine[] = []

    if (item.type === 'equipment') {
      // Asset: Debit Equipment, Credit "Ask Future Me"
      lines.push({
        id: nanoid(),
        accountId: item.accountId,
        debit: item.amount,
        credit: 0,
        memo: `Opening balance - ${item.accountName}`,
      })

      lines.push({
        id: nanoid(),
        accountId: askFutureMeAccount.id,
        debit: 0,
        credit: item.amount,
        memo: `Opening balance offset - ${item.accountName}`,
      })
    } else if (item.type === 'credit-card' || item.type === 'loan') {
      // Liability: Debit "Ask Future Me", Credit Liability
      lines.push({
        id: nanoid(),
        accountId: askFutureMeAccount.id,
        debit: item.amount,
        credit: 0,
        memo: `Opening balance offset - ${item.accountName}`,
      })

      lines.push({
        id: nanoid(),
        accountId: item.accountId,
        debit: 0,
        credit: item.amount,
        memo: `Opening balance - ${item.accountName}`,
      })
    }

    // Create the journal entry
    if (lines.length === 2) {
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
        createdBy: 'system',
      })
    }
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
