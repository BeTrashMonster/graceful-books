/**
 * Transaction Validation Tests
 *
 * Comprehensive test coverage for double-entry bookkeeping validation
 */

import { describe, it, expect } from 'vitest'
import {
  validateTransaction,
  validateLineItem,
  calculateBalance,
  autoBalanceTransaction,
  canPostTransaction,
  type TransactionValidationResult,
  type LineItemValidationResult,
} from './transactionValidation'
import type { JournalEntryLine } from '../types'

describe('transactionValidation', () => {
  describe('validateLineItem', () => {
    it('should validate a valid debit line item', () => {
      const line: JournalEntryLine = {
        id: '1',
        accountId: 'acc-1',
        debit: 100,
        credit: 0,
      }

      const result: LineItemValidationResult = validateLineItem(line)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should validate a valid credit line item', () => {
      const line: JournalEntryLine = {
        id: '2',
        accountId: 'acc-2',
        debit: 0,
        credit: 100,
      }

      const result = validateLineItem(line)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject line item without account ID', () => {
      const line: JournalEntryLine = {
        id: '3',
        accountId: '',
        debit: 100,
        credit: 0,
      }

      const result = validateLineItem(line)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Account is required')
    })

    it('should reject line item with zero amounts', () => {
      const line: JournalEntryLine = {
        id: '4',
        accountId: 'acc-1',
        debit: 0,
        credit: 0,
      }

      const result = validateLineItem(line)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Amount must be greater than zero')
    })

    it('should reject line item with both debit and credit', () => {
      const line: JournalEntryLine = {
        id: '5',
        accountId: 'acc-1',
        debit: 50,
        credit: 50,
      }

      const result = validateLineItem(line)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        'Cannot have both debit and credit on the same line'
      )
    })

    it('should reject negative debit amount', () => {
      const line: JournalEntryLine = {
        id: '6',
        accountId: 'acc-1',
        debit: -100,
        credit: 0,
      }

      const result = validateLineItem(line)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Debit amount cannot be negative')
    })

    it('should reject negative credit amount', () => {
      const line: JournalEntryLine = {
        id: '7',
        accountId: 'acc-1',
        debit: 0,
        credit: -100,
      }

      const result = validateLineItem(line)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Credit amount cannot be negative')
    })

    it('should reject excessively large amounts', () => {
      const line: JournalEntryLine = {
        id: '8',
        accountId: 'acc-1',
        debit: 2_000_000_000_000, // 2 trillion
        credit: 0,
      }

      const result = validateLineItem(line)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Amount exceeds maximum allowed value')
    })
  })

  describe('calculateBalance', () => {
    it('should calculate balanced transaction correctly', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 100, credit: 0 },
        { id: '2', accountId: 'acc-2', debit: 0, credit: 100 },
      ]

      const result = calculateBalance(lines)

      expect(result.totalDebits).toBe(100)
      expect(result.totalCredits).toBe(100)
      expect(result.difference).toBe(0)
      expect(result.isBalanced).toBe(true)
    })

    it('should detect unbalanced transaction (debits > credits)', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 150, credit: 0 },
        { id: '2', accountId: 'acc-2', debit: 0, credit: 100 },
      ]

      const result = calculateBalance(lines)

      expect(result.totalDebits).toBe(150)
      expect(result.totalCredits).toBe(100)
      expect(result.difference).toBe(50)
      expect(result.isBalanced).toBe(false)
    })

    it('should detect unbalanced transaction (credits > debits)', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 100, credit: 0 },
        { id: '2', accountId: 'acc-2', debit: 0, credit: 150 },
      ]

      const result = calculateBalance(lines)

      expect(result.totalDebits).toBe(100)
      expect(result.totalCredits).toBe(150)
      expect(result.difference).toBe(-50)
      expect(result.isBalanced).toBe(false)
    })

    it('should handle complex multi-line transaction', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 100, credit: 0 },
        { id: '2', accountId: 'acc-2', debit: 50, credit: 0 },
        { id: '3', accountId: 'acc-3', debit: 0, credit: 75 },
        { id: '4', accountId: 'acc-4', debit: 0, credit: 75 },
      ]

      const result = calculateBalance(lines)

      expect(result.totalDebits).toBe(150)
      expect(result.totalCredits).toBe(150)
      expect(result.difference).toBe(0)
      expect(result.isBalanced).toBe(true)
    })

    it('should handle floating point precision correctly', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 10.01, credit: 0 },
        { id: '2', accountId: 'acc-2', debit: 0, credit: 10.01 },
      ]

      const result = calculateBalance(lines)

      expect(result.isBalanced).toBe(true)
    })

    it('should return zero for empty transaction', () => {
      const lines: JournalEntryLine[] = []

      const result = calculateBalance(lines)

      expect(result.totalDebits).toBe(0)
      expect(result.totalCredits).toBe(0)
      expect(result.difference).toBe(0)
      expect(result.isBalanced).toBe(true)
    })
  })

  describe('validateTransaction', () => {
    it('should validate a balanced transaction with 2+ lines', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 100, credit: 0 },
        { id: '2', accountId: 'acc-2', debit: 0, credit: 100 },
      ]

      const result: TransactionValidationResult = validateTransaction(lines)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.totalDebits).toBe(100)
      expect(result.totalCredits).toBe(100)
      expect(result.difference).toBe(0)
    })

    it('should reject transaction with fewer than 2 lines', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 100, credit: 0 },
      ]

      const result = validateTransaction(lines)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        'Transaction must have at least 2 line items'
      )
    })

    it('should allow single line if requireMinimumLines is false', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 100, credit: 0 },
      ]

      const result = validateTransaction(lines, {
        requireMinimumLines: false,
        allowUnbalanced: true,
      })

      expect(result.isValid).toBe(true)
    })

    it('should reject empty transaction', () => {
      const lines: JournalEntryLine[] = []

      const result = validateTransaction(lines)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        'Transaction must have at least one line item'
      )
    })

    it('should reject unbalanced transaction', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 100, credit: 0 },
        { id: '2', accountId: 'acc-2', debit: 0, credit: 75 },
      ]

      const result = validateTransaction(lines)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('not balanced'))).toBe(true)
    })

    it('should allow unbalanced transaction if allowUnbalanced is true', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 100, credit: 0 },
        { id: '2', accountId: 'acc-2', debit: 0, credit: 75 },
      ]

      const result = validateTransaction(lines, { allowUnbalanced: true })

      expect(result.isValid).toBe(true)
      expect(result.totalDebits).toBe(100)
      expect(result.totalCredits).toBe(75)
    })

    it('should reject transaction with invalid line items', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: '', debit: 100, credit: 0 }, // Invalid: no account
        { id: '2', accountId: 'acc-2', debit: 0, credit: 100 },
      ]

      const result = validateTransaction(lines)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('Account is required'))).toBe(
        true
      )
    })

    it('should include line numbers in error messages', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 100, credit: 0 },
        { id: '2', accountId: '', debit: 0, credit: 100 }, // Invalid
      ]

      const result = validateTransaction(lines)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('Line 2'))).toBe(true)
    })

    it('should reject transaction with all zero amounts', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 0, credit: 0 },
        { id: '2', accountId: 'acc-2', debit: 0, credit: 0 },
      ]

      const result = validateTransaction(lines)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Transaction has no amounts entered')
    })

    it('should warn about duplicate accounts', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 50, credit: 0 },
        { id: '2', accountId: 'acc-1', debit: 50, credit: 0 },
        { id: '3', accountId: 'acc-2', debit: 0, credit: 100 },
      ]

      const result = validateTransaction(lines)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain(
        'Transaction has multiple entries for the same account. This is valid but may need review.'
      )
    })
  })

  describe('autoBalanceTransaction', () => {
    it('should not modify already balanced transaction', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 100, credit: 0 },
        { id: '2', accountId: 'acc-2', debit: 0, credit: 100 },
      ]

      const result = autoBalanceTransaction(lines, 'acc-3')

      expect(result).toHaveLength(2)
      expect(result).toEqual(lines)
    })

    it('should add debit balancing entry when credits > debits', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 100, credit: 0 },
        { id: '2', accountId: 'acc-2', debit: 0, credit: 150 },
      ]

      const result = autoBalanceTransaction(lines, 'acc-3')

      expect(result).toHaveLength(3)
      expect(result[2]?.accountId).toBe('acc-3')
      expect(result[2]?.debit).toBe(50)
      expect(result[2]?.credit).toBe(0)
      expect(result[2]?.memo).toBe('Auto-balancing entry')
    })

    it('should add credit balancing entry when debits > credits', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 150, credit: 0 },
        { id: '2', accountId: 'acc-2', debit: 0, credit: 100 },
      ]

      const result = autoBalanceTransaction(lines, 'acc-3')

      expect(result).toHaveLength(3)
      expect(result[2]?.accountId).toBe('acc-3')
      expect(result[2]?.debit).toBe(0)
      expect(result[2]?.credit).toBe(50)
    })

    it('should handle empty transaction', () => {
      const lines: JournalEntryLine[] = []

      const result = autoBalanceTransaction(lines, 'acc-1')

      expect(result).toHaveLength(0)
    })

    it('should create balanced transaction after auto-balance', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 123.45, credit: 0 },
        { id: '2', accountId: 'acc-2', debit: 0, credit: 67.89 },
      ]

      const balanced = autoBalanceTransaction(lines, 'acc-3')
      const validation = calculateBalance(balanced)

      expect(validation.isBalanced).toBe(true)
    })
  })

  describe('canPostTransaction', () => {
    it('should allow posting valid balanced transaction', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 100, credit: 0 },
        { id: '2', accountId: 'acc-2', debit: 0, credit: 100 },
      ]

      const result = canPostTransaction(lines)

      expect(result.canPost).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('should reject posting unbalanced transaction', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 100, credit: 0 },
        { id: '2', accountId: 'acc-2', debit: 0, credit: 75 },
      ]

      const result = canPostTransaction(lines)

      expect(result.canPost).toBe(false)
      expect(result.reason).toBeDefined()
      expect(result.reason).toContain('not balanced')
    })

    it('should reject posting transaction with invalid lines', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: '', debit: 100, credit: 0 },
        { id: '2', accountId: 'acc-2', debit: 0, credit: 100 },
      ]

      const result = canPostTransaction(lines)

      expect(result.canPost).toBe(false)
      expect(result.reason).toBeDefined()
    })

    it('should reject posting transaction with too few lines', () => {
      const lines: JournalEntryLine[] = [
        { id: '1', accountId: 'acc-1', debit: 100, credit: 0 },
      ]

      const result = canPostTransaction(lines)

      expect(result.canPost).toBe(false)
      expect(result.reason).toContain('at least 2 line items')
    })
  })
})
