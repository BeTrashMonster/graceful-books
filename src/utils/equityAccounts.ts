/**
 * Equity Account Generation Utilities
 *
 * Generates appropriate equity accounts based on entity type.
 * Ensures GAAP compliance and proper tax reporting structure.
 *
 * IMPORTANT: C-Corp and S-Corp use ONLY Retained Earnings.
 * Common Stock is NOT supported - this software targets small businesses
 * that would not have issued stock.
 */

import type { EntityType, Owner, Account, AccountType } from '../types'

/**
 * Equity account template for generation
 */
interface EquityAccountTemplate {
  name: string
  accountNumber: string
  description: string
  type: AccountType
}

/**
 * Generate equity accounts based on entity type and ownership structure
 *
 * @param entityType - Legal structure of the business
 * @param owners - List of owners/members/partners with ownership percentages
 * @param companyId - Company identifier
 * @returns Array of equity account templates ready for creation
 */
export function generateEquityAccounts(
  entityType: EntityType,
  owners: Owner[],
  companyId: string
): Omit<Account, 'id' | 'balance' | 'createdAt' | 'updatedAt' | 'deletedAt'>[] {
  const accounts: Omit<Account, 'id' | 'balance' | 'createdAt' | 'updatedAt' | 'deletedAt'>[] = []
  let accountNumber = 3000

  switch (entityType) {
    case 'sole-proprietorship':
      // Sole proprietorship uses Owner's Capital and Owner's Draw
      accounts.push({
        companyId,
        name: "Owner's Capital",
        accountNumber: String(accountNumber),
        type: 'equity',
        description: 'Capital invested by the owner',
        isActive: true,
      })
      accountNumber += 100

      accounts.push({
        companyId,
        name: "Owner's Draw",
        accountNumber: String(accountNumber),
        type: 'equity',
        description: 'Money withdrawn by owner for personal use',
        isActive: true,
      })
      accountNumber += 100
      break

    case 'single-member-llc':
      // Single-member LLC uses Member's Capital and Member's Draw
      accounts.push({
        companyId,
        name: "Member's Capital",
        accountNumber: String(accountNumber),
        type: 'equity',
        description: 'Capital invested by the member',
        isActive: true,
      })
      accountNumber += 100

      accounts.push({
        companyId,
        name: "Member's Draw",
        accountNumber: String(accountNumber),
        type: 'equity',
        description: 'Money withdrawn by member for personal use',
        isActive: true,
      })
      accountNumber += 100
      break

    case 'multi-member-llc':
    case 'partnership':
      // Multi-member LLC and Partnership use individual capital accounts for each member/partner
      const capitalLabel = entityType === 'multi-member-llc' ? 'Member' : 'Partner'

      owners.forEach((owner, index) => {
        accounts.push({
          companyId,
          name: `${owner.name} - ${capitalLabel} Capital`,
          accountNumber: String(accountNumber),
          type: 'equity',
          description: `${capitalLabel} capital account for ${owner.name} (${owner.ownershipPercentage}% ownership)`,
          isActive: true,
        })
        accountNumber += 10 // Use increments of 10 to allow for future additions
      })

      // Add distributions account
      accountNumber = 3100
      owners.forEach((owner, index) => {
        accounts.push({
          companyId,
          name: `${owner.name} - ${capitalLabel} Distributions`,
          accountNumber: String(accountNumber),
          type: 'equity',
          description: `Distributions to ${owner.name}`,
          isActive: true,
        })
        accountNumber += 10
      })
      break

    case 'c-corp':
    case 's-corp':
      // C-Corp and S-Corp use ONLY Retained Earnings
      // NO Common Stock - this software targets small businesses without stock issuance
      accounts.push({
        companyId,
        name: 'Retained Earnings',
        accountNumber: '3900',
        type: 'equity',
        description: 'Accumulated earnings retained in the corporation',
        isActive: true,
      })
      break
  }

  // All entity types get Retained Earnings (unless already added for corps)
  if (entityType !== 'c-corp' && entityType !== 's-corp') {
    accounts.push({
      companyId,
      name: 'Retained Earnings',
      accountNumber: '3900',
      type: 'equity',
      description: 'Accumulated profits retained in the business',
      isActive: true,
    })
  }

  return accounts
}

/**
 * Get equity account labels for display based on entity type
 */
export function getEquityAccountLabels(entityType: EntityType): {
  capitalLabel: string
  distributionLabel: string
  hasIndividualAccounts: boolean
} {
  switch (entityType) {
    case 'sole-proprietorship':
      return {
        capitalLabel: "Owner's Capital",
        distributionLabel: "Owner's Draw",
        hasIndividualAccounts: false,
      }

    case 'single-member-llc':
      return {
        capitalLabel: "Member's Capital",
        distributionLabel: "Member's Draw",
        hasIndividualAccounts: false,
      }

    case 'multi-member-llc':
      return {
        capitalLabel: "Member Capital",
        distributionLabel: "Member Distributions",
        hasIndividualAccounts: true,
      }

    case 'partnership':
      return {
        capitalLabel: "Partner Capital",
        distributionLabel: "Partner Distributions",
        hasIndividualAccounts: true,
      }

    case 'c-corp':
    case 's-corp':
      return {
        capitalLabel: "Retained Earnings",
        distributionLabel: "Dividends/Distributions",
        hasIndividualAccounts: false,
      }
  }
}

/**
 * Validate ownership percentages sum to 100%
 */
export function validateOwnership(owners: Owner[]): { valid: boolean; error?: string } {
  if (owners.length === 0) {
    return { valid: false, error: 'At least one owner is required' }
  }

  const totalPercentage = owners.reduce((sum, owner) => sum + owner.ownershipPercentage, 0)

  if (Math.abs(totalPercentage - 100) > 0.01) {
    return {
      valid: false,
      error: `Ownership percentages must sum to 100% (currently ${totalPercentage.toFixed(2)}%)`
    }
  }

  return { valid: true }
}

/**
 * Split an opening balance amount across owners based on ownership percentage
 */
export function splitOpeningBalance(
  totalAmount: number,
  owners: Owner[]
): Map<string, number> {
  const splits = new Map<string, number>()

  owners.forEach(owner => {
    const ownerAmount = Math.round(totalAmount * (owner.ownershipPercentage / 100))
    splits.set(owner.id, ownerAmount)
  })

  return splits
}
