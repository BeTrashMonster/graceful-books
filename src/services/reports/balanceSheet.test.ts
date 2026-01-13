/**
 * Balance Sheet Calculation Service Tests
 *
 * Tests for balance sheet generation, account balance calculation,
 * and balance equation validation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Decimal from 'decimal.js'
import { db } from '../../store/database'
import { createAccount } from '../../store/accounts'
import { createTransaction } from '../../store/transactions'
import {
  generateBalanceSheet,
  calculateAccountBalance,
  getBalanceSheetEducation,
} from './balanceSheet'
import type { Account, JournalEntry } from '../../types'

describe('Balance Sheet Calculation Service', () => {
  const testCompanyId = 'test-company-001'
  const testUserId = 'test-user-001'

  beforeEach(async () => {
    await db.clearAllData()
  })

  afterEach(async () => {
    await db.clearAllData()
  })

  describe('calculateAccountBalance', () => {
    it('should calculate zero balance for account with no transactions', async () => {
      const account = await createTestAccount('Cash', 'asset', testCompanyId)
      const balance = await calculateAccountBalance(
        account.id,
        new Date(),
        testCompanyId
      )

      expect(balance.toNumber()).toBe(0)
    })

    it('should calculate correct balance for asset account with debits and credits', async () => {
      const cashAccount = await createTestAccount('Cash', 'asset', testCompanyId)
      const revenueAccount = await createTestAccount('Revenue', 'income', testCompanyId)

      // Create transaction: Debit Cash $1000, Credit Revenue $1000
      await createTransaction({
        companyId: testCompanyId,
        date: new Date('2024-01-15'),
        reference: 'INV-001',
        memo: 'Test sale',
        status: 'posted',
        lines: [
          {
            accountId: cashAccount.id,
            debit: 1000,
            credit: 0,
            memo: 'Cash received',
          },
          {
            accountId: revenueAccount.id,
            debit: 0,
            credit: 1000,
            memo: 'Revenue earned',
          },
        ],
        attachments: [],
        createdBy: testUserId,
      })

      const balance = await calculateAccountBalance(
        cashAccount.id,
        new Date('2024-12-31'),
        testCompanyId
      )

      expect(balance.toNumber()).toBe(1000)
    })

    it('should calculate correct balance for liability account', async () => {
      const cashAccount = await createTestAccount('Cash', 'asset', testCompanyId)
      const loanAccount = await createTestAccount(
        'Bank Loan',
        'liability',
        testCompanyId
      )

      // Create transaction: Debit Cash $5000, Credit Loan $5000
      await createTransaction({
        companyId: testCompanyId,
        date: new Date('2024-01-15'),
        reference: 'LOAN-001',
        memo: 'Bank loan',
        status: 'posted',
        lines: [
          {
            accountId: cashAccount.id,
            debit: 5000,
            credit: 0,
            memo: 'Cash received',
          },
          {
            accountId: loanAccount.id,
            debit: 0,
            credit: 5000,
            memo: 'Loan payable',
          },
        ],
        attachments: [],
        createdBy: testUserId,
      })

      const loanBalance = await calculateAccountBalance(
        loanAccount.id,
        new Date('2024-12-31'),
        testCompanyId
      )

      expect(loanBalance.toNumber()).toBe(5000)
    })

    it('should only include transactions up to as-of date', async () => {
      const cashAccount = await createTestAccount('Cash', 'asset', testCompanyId)
      const revenueAccount = await createTestAccount('Revenue', 'income', testCompanyId)

      // Transaction 1: January 15
      await createTransaction({
        companyId: testCompanyId,
        date: new Date('2024-01-15'),
        reference: 'INV-001',
        memo: 'January sale',
        status: 'posted',
        lines: [
          {
            accountId: cashAccount.id,
            debit: 1000,
            credit: 0,
            memo: 'Cash received',
          },
          {
            accountId: revenueAccount.id,
            debit: 0,
            credit: 1000,
            memo: 'Revenue earned',
          },
        ],
        attachments: [],
        createdBy: testUserId,
      })

      // Transaction 2: February 15
      await createTransaction({
        companyId: testCompanyId,
        date: new Date('2024-02-15'),
        reference: 'INV-002',
        memo: 'February sale',
        status: 'posted',
        lines: [
          {
            accountId: cashAccount.id,
            debit: 2000,
            credit: 0,
            memo: 'Cash received',
          },
          {
            accountId: revenueAccount.id,
            debit: 0,
            credit: 2000,
            memo: 'Revenue earned',
          },
        ],
        attachments: [],
        createdBy: testUserId,
      })

      // Check balance as of January 31
      const balanceJan = await calculateAccountBalance(
        cashAccount.id,
        new Date('2024-01-31'),
        testCompanyId
      )

      expect(balanceJan.toNumber()).toBe(1000)

      // Check balance as of February 28
      const balanceFeb = await calculateAccountBalance(
        cashAccount.id,
        new Date('2024-02-28'),
        testCompanyId
      )

      expect(balanceFeb.toNumber()).toBe(3000)
    })
  })

  describe('generateBalanceSheet', () => {
    it('should generate empty balance sheet with no accounts', async () => {
      const result = await generateBalanceSheet({
        companyId: testCompanyId,
        asOfDate: new Date('2024-12-31'),
      })

      if (!result.success) {
        console.error('generateBalanceSheet failed:', result.error)
      }

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.assets.lines).toHaveLength(0)
      expect(result.data!.liabilities.lines).toHaveLength(0)
      expect(result.data!.equity.lines).toHaveLength(0)
      expect(result.data!.isBalanced).toBe(true)
    })

    it('should generate balanced balance sheet with transactions', async () => {
      // Create accounts
      const cashAccount = await createTestAccount('Cash', 'asset', testCompanyId)
      const arAccount = await createTestAccount(
        'Accounts Receivable',
        'asset',
        testCompanyId
      )
      const loanAccount = await createTestAccount(
        'Bank Loan',
        'liability',
        testCompanyId
      )
      const equityAccount = await createTestAccount(
        "Owner's Equity",
        'equity',
        testCompanyId
      )
      const revenueAccount = await createTestAccount('Revenue', 'income', testCompanyId)

      // Create transactions
      // 1. Owner investment: Debit Cash $10,000, Credit Equity $10,000
      await createTransaction({
        companyId: testCompanyId,
        date: new Date('2024-01-01'),
        reference: 'EQUITY-001',
        memo: 'Initial investment',
        status: 'posted',
        lines: [
          { accountId: cashAccount.id, debit: 10000, credit: 0, memo: 'Cash' },
          { accountId: equityAccount.id, debit: 0, credit: 10000, memo: 'Investment' },
        ],
        attachments: [],
        createdBy: testUserId,
      })

      // 2. Bank loan: Debit Cash $5,000, Credit Loan $5,000
      await createTransaction({
        companyId: testCompanyId,
        date: new Date('2024-01-15'),
        reference: 'LOAN-001',
        memo: 'Bank loan',
        status: 'posted',
        lines: [
          { accountId: cashAccount.id, debit: 5000, credit: 0, memo: 'Cash' },
          { accountId: loanAccount.id, debit: 0, credit: 5000, memo: 'Loan' },
        ],
        attachments: [],
        createdBy: testUserId,
      })

      // 3. Sale on account: Debit AR $3,000, Credit Revenue $3,000
      await createTransaction({
        companyId: testCompanyId,
        date: new Date('2024-02-01'),
        reference: 'INV-001',
        memo: 'Sale on account',
        status: 'posted',
        lines: [
          { accountId: arAccount.id, debit: 3000, credit: 0, memo: 'AR' },
          { accountId: revenueAccount.id, debit: 0, credit: 3000, memo: 'Revenue' },
        ],
        attachments: [],
        createdBy: testUserId,
      })

      const result = await generateBalanceSheet({
        companyId: testCompanyId,
        asOfDate: new Date('2024-12-31'),
        includeZeroBalances: false,
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      const data = result.data!

      // Check that we have accounts in each section
      expect(data.assets.lines.length).toBeGreaterThan(0)
      expect(data.liabilities.lines.length).toBeGreaterThan(0)
      expect(data.equity.lines.length).toBeGreaterThan(0)

      // Note: Revenue account affects equity through retained earnings
      // The actual calculation would need to close revenue to retained earnings
      // For this test, we verify the fundamental equation

      // Assets should equal Liabilities + Equity
      expect(data.isBalanced).toBe(true)
      expect(Math.abs(data.balanceDifference)).toBeLessThan(0.01)
    })

    it('should exclude zero-balance accounts when requested', async () => {
      const cashAccount = await createTestAccount('Cash', 'asset', testCompanyId)
      const arAccount = await createTestAccount(
        'Accounts Receivable',
        'asset',
        testCompanyId
      )
      const equityAccount = await createTestAccount(
        "Owner's Equity",
        'equity',
        testCompanyId
      )

      // Only create transaction for cash, leaving AR at zero
      await createTransaction({
        companyId: testCompanyId,
        date: new Date('2024-01-01'),
        reference: 'EQUITY-001',
        memo: 'Initial investment',
        status: 'posted',
        lines: [
          { accountId: cashAccount.id, debit: 10000, credit: 0, memo: 'Cash' },
          { accountId: equityAccount.id, debit: 0, credit: 10000, memo: 'Investment' },
        ],
        attachments: [],
        createdBy: testUserId,
      })

      const result = await generateBalanceSheet({
        companyId: testCompanyId,
        asOfDate: new Date('2024-12-31'),
        includeZeroBalances: false,
      })

      expect(result.success).toBe(true)

      // AR should not be included
      const arLine = result.data!.assets.lines.find(
        (line) => line.accountId === arAccount.id
      )
      expect(arLine).toBeUndefined()

      // Cash should be included
      const cashLine = result.data!.assets.lines.find(
        (line) => line.accountId === cashAccount.id
      )
      expect(cashLine).toBeDefined()
      expect(cashLine!.balance).toBe(10000)
    })

    it('should include zero-balance accounts when requested', async () => {
      const cashAccount = await createTestAccount('Cash', 'asset', testCompanyId)
      const arAccount = await createTestAccount(
        'Accounts Receivable',
        'asset',
        testCompanyId
      )
      const equityAccount = await createTestAccount(
        "Owner's Equity",
        'equity',
        testCompanyId
      )

      await createTransaction({
        companyId: testCompanyId,
        date: new Date('2024-01-01'),
        reference: 'EQUITY-001',
        memo: 'Initial investment',
        status: 'posted',
        lines: [
          { accountId: cashAccount.id, debit: 10000, credit: 0, memo: 'Cash' },
          { accountId: equityAccount.id, debit: 0, credit: 10000, memo: 'Investment' },
        ],
        attachments: [],
        createdBy: testUserId,
      })

      const result = await generateBalanceSheet({
        companyId: testCompanyId,
        asOfDate: new Date('2024-12-31'),
        includeZeroBalances: true,
      })

      expect(result.success).toBe(true)

      // AR should be included even with zero balance
      const arLine = result.data!.assets.lines.find(
        (line) => line.accountId === arAccount.id
      )
      expect(arLine).toBeDefined()
      expect(arLine!.balance).toBe(0)
    })

    it('should handle hierarchical accounts correctly', async () => {
      const bankAccount = await createTestAccount('Bank Accounts', 'asset', testCompanyId)
      const checkingAccount = await createTestAccount(
        'Checking',
        'asset',
        testCompanyId,
        bankAccount.id
      )
      const savingsAccount = await createTestAccount(
        'Savings',
        'asset',
        testCompanyId,
        bankAccount.id
      )
      const equityAccount = await createTestAccount(
        "Owner's Equity",
        'equity',
        testCompanyId
      )

      // Add money to both sub-accounts
      await createTransaction({
        companyId: testCompanyId,
        date: new Date('2024-01-01'),
        reference: 'EQUITY-001',
        memo: 'Initial investment',
        status: 'posted',
        lines: [
          { accountId: checkingAccount.id, debit: 5000, credit: 0, memo: 'Checking' },
          { accountId: savingsAccount.id, debit: 3000, credit: 0, memo: 'Savings' },
          { accountId: equityAccount.id, debit: 0, credit: 8000, memo: 'Investment' },
        ],
        attachments: [],
        createdBy: testUserId,
      })

      const result = await generateBalanceSheet({
        companyId: testCompanyId,
        asOfDate: new Date('2024-12-31'),
        includeZeroBalances: false,
      })

      expect(result.success).toBe(true)

      // Should have parent and sub-accounts
      const parentLine = result.data!.assets.lines.find(
        (line) => line.accountId === bankAccount.id
      )
      expect(parentLine).toBeDefined()
      expect(parentLine!.level).toBe(0)

      const checkingLine = result.data!.assets.lines.find(
        (line) => line.accountId === checkingAccount.id
      )
      expect(checkingLine).toBeDefined()
      expect(checkingLine!.level).toBe(1)
      expect(checkingLine!.isSubAccount).toBe(true)
    })
  })

  describe('getBalanceSheetEducation', () => {
    it('should return educational content', () => {
      const education = getBalanceSheetEducation()

      expect(education).toBeDefined()
      expect(education.overview).toBeDefined()
      expect(education.assets).toBeDefined()
      expect(education.liabilities).toBeDefined()
      expect(education.equity).toBeDefined()
      expect(education.balancingEquation).toBeDefined()

      expect(education.overview.title).toBeTruthy()
      expect(education.overview.longDescription).toBeTruthy()
      expect(education.overview.whyItMatters).toBeTruthy()

      expect(education.balancingEquation.examples).toBeDefined()
      expect(education.balancingEquation.examples!.length).toBeGreaterThan(0)
    })
  })
})

/**
 * Helper: Create test account
 */
async function createTestAccount(
  name: string,
  type: Account['type'],
  companyId: string,
  parentAccountId?: string
): Promise<Account> {
  const result = await createAccount({
    companyId,
    name,
    accountNumber: undefined,
    type,
    subType: undefined,
    parentAccountId,
    description: undefined,
    isActive: true,
  })

  if (!result.success) {
    throw new Error(`Failed to create test account: ${result.error?.message}`)
  }

  return result.data
}
