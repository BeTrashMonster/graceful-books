/**
 * Transaction Validation Utilities
 *
 * Validates double-entry bookkeeping rules:
 * - Debits must equal credits
 * - Each transaction must have at least 2 line items
 * - Line items must have valid accounts
 * - Amounts must be positive
 *
 * Requirements: B2 - Transaction Entry - Basic
 */

import type { JournalEntryLine } from '../types'

/**
 * Validation result for a transaction
 */
export interface TransactionValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  totalDebits: number
  totalCredits: number
  difference: number
}

/**
 * Validation result for a line item
 */
export interface LineItemValidationResult {
  isValid: boolean
  errors: string[]
}

/**
 * Tolerance for floating point comparison (1 cent)
 */
const BALANCE_TOLERANCE = 0.01

/**
 * Validate a complete transaction with line items
 */
export function validateTransaction(
  lines: JournalEntryLine[],
  options?: {
    requireMinimumLines?: boolean
    allowUnbalanced?: boolean
  }
): TransactionValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { requireMinimumLines = true, allowUnbalanced = false } = options || {}

  // Check minimum line items
  if (requireMinimumLines && lines.length < 2) {
    errors.push('Transaction must have at least 2 line items')
  }

  // Check for empty transaction
  if (lines.length === 0) {
    errors.push('Transaction must have at least one line item')
    return {
      isValid: false,
      errors,
      warnings,
      totalDebits: 0,
      totalCredits: 0,
      difference: 0,
    }
  }

  // Validate each line item
  const lineErrors: string[] = []
  lines.forEach((line, index) => {
    const lineResult = validateLineItem(line)
    if (!lineResult.isValid) {
      lineErrors.push(
        ...lineResult.errors.map((err) => `Line ${index + 1}: ${err}`)
      )
    }
  })

  errors.push(...lineErrors)

  // Calculate totals
  const { totalDebits, totalCredits, difference, isBalanced } =
    calculateBalance(lines)

  // Check if balanced
  if (!allowUnbalanced && !isBalanced) {
    errors.push(
      `Transaction is not balanced. Debits: $${totalDebits.toFixed(2)}, Credits: $${totalCredits.toFixed(2)}, Difference: $${Math.abs(difference).toFixed(2)}`
    )
  }

  // Check for zero amount transaction
  if (totalDebits === 0 && totalCredits === 0) {
    errors.push('Transaction has no amounts entered')
  }

  // Check for duplicate accounts (warning only)
  const accountIds = lines.map((line) => line.accountId)
  const duplicateAccounts = accountIds.filter(
    (id, index) => accountIds.indexOf(id) !== index
  )
  if (duplicateAccounts.length > 0) {
    warnings.push(
      'Transaction has multiple entries for the same account. This is valid but may need review.'
    )
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalDebits,
    totalCredits,
    difference,
  }
}

/**
 * Validate a single line item
 */
export function validateLineItem(line: JournalEntryLine): LineItemValidationResult {
  const errors: string[] = []

  // Check for account ID
  if (!line.accountId || line.accountId.trim() === '') {
    errors.push('Account is required')
  }

  // Check debit and credit amounts
  const debit = Number(line.debit) || 0
  const credit = Number(line.credit) || 0

  // Must have either debit or credit (but not both)
  if (debit === 0 && credit === 0) {
    errors.push('Amount must be greater than zero')
  }

  if (debit > 0 && credit > 0) {
    errors.push('Cannot have both debit and credit on the same line')
  }

  // Amounts must be positive
  if (debit < 0) {
    errors.push('Debit amount cannot be negative')
  }

  if (credit < 0) {
    errors.push('Credit amount cannot be negative')
  }

  // Check for reasonable amounts (not greater than 1 trillion)
  const MAX_AMOUNT = 1_000_000_000_000
  if (debit > MAX_AMOUNT || credit > MAX_AMOUNT) {
    errors.push('Amount exceeds maximum allowed value')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Calculate the balance of a transaction
 */
export function calculateBalance(lines: JournalEntryLine[]): {
  totalDebits: number
  totalCredits: number
  difference: number
  isBalanced: boolean
} {
  let totalDebits = 0
  let totalCredits = 0

  lines.forEach((line) => {
    totalDebits += Number(line.debit) || 0
    totalCredits += Number(line.credit) || 0
  })

  // Round to 2 decimal places to avoid floating point issues
  totalDebits = Math.round(totalDebits * 100) / 100
  totalCredits = Math.round(totalCredits * 100) / 100

  const difference = totalDebits - totalCredits
  const isBalanced = Math.abs(difference) < BALANCE_TOLERANCE

  return {
    totalDebits,
    totalCredits,
    difference,
    isBalanced,
  }
}

/**
 * Auto-balance a transaction by adding or adjusting the last line item
 * Returns a new array of line items
 */
export function autoBalanceTransaction(
  lines: JournalEntryLine[],
  balancingAccountId: string
): JournalEntryLine[] {
  if (lines.length === 0) {
    return lines
  }

  const { difference, isBalanced } = calculateBalance(lines)

  // Already balanced
  if (isBalanced) {
    return lines
  }

  // Create balancing line item
  const balancingLine: JournalEntryLine = {
    id: `balancing-${Date.now()}`,
    accountId: balancingAccountId,
    debit: difference < 0 ? Math.abs(difference) : 0,
    credit: difference > 0 ? Math.abs(difference) : 0,
    memo: 'Auto-balancing entry',
  }

  return [...lines, balancingLine]
}

/**
 * Check if a transaction can be posted (is valid and balanced)
 */
export function canPostTransaction(lines: JournalEntryLine[]): {
  canPost: boolean
  reason?: string
} {
  const validation = validateTransaction(lines)

  if (!validation.isValid) {
    return {
      canPost: false,
      reason: validation.errors[0] || 'Transaction has validation errors',
    }
  }

  return { canPost: true }
}

/**
 * Suggest common transaction templates
 */
export interface TransactionTemplate {
  name: string
  description: string
  lines: Array<{
    description: string
    isDebit: boolean
    accountTypeHint: string
  }>
}

export const COMMON_TRANSACTION_TEMPLATES: TransactionTemplate[] = [
  {
    name: 'Income - Cash Sale',
    description: 'Record a cash sale or income received',
    lines: [
      {
        description: 'Cash received',
        isDebit: true,
        accountTypeHint: 'ASSET (Cash)',
      },
      {
        description: 'Revenue earned',
        isDebit: false,
        accountTypeHint: 'INCOME',
      },
    ],
  },
  {
    name: 'Expense - Cash Payment',
    description: 'Record a cash expense or payment',
    lines: [
      {
        description: 'Expense incurred',
        isDebit: true,
        accountTypeHint: 'EXPENSE',
      },
      {
        description: 'Cash paid',
        isDebit: false,
        accountTypeHint: 'ASSET (Cash)',
      },
    ],
  },
  {
    name: 'Owner Investment',
    description: 'Record owner cash investment in business',
    lines: [
      {
        description: 'Cash received',
        isDebit: true,
        accountTypeHint: 'ASSET (Cash)',
      },
      {
        description: "Owner's equity increased",
        isDebit: false,
        accountTypeHint: 'EQUITY',
      },
    ],
  },
  {
    name: 'Owner Draw',
    description: 'Record owner withdrawal from business',
    lines: [
      {
        description: "Owner's equity decreased",
        isDebit: true,
        accountTypeHint: 'EQUITY',
      },
      {
        description: 'Cash paid',
        isDebit: false,
        accountTypeHint: 'ASSET (Cash)',
      },
    ],
  },
  {
    name: 'Purchase on Credit',
    description: 'Record a purchase on account (accounts payable)',
    lines: [
      {
        description: 'Expense or asset acquired',
        isDebit: true,
        accountTypeHint: 'EXPENSE or ASSET',
      },
      {
        description: 'Accounts payable increased',
        isDebit: false,
        accountTypeHint: 'LIABILITY (Accounts Payable)',
      },
    ],
  },
  {
    name: 'Pay Bill',
    description: 'Record payment of accounts payable',
    lines: [
      {
        description: 'Accounts payable decreased',
        isDebit: true,
        accountTypeHint: 'LIABILITY (Accounts Payable)',
      },
      {
        description: 'Cash paid',
        isDebit: false,
        accountTypeHint: 'ASSET (Cash)',
      },
    ],
  },
]
