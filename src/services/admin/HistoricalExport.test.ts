/**
 * Historical Snapshot Export Service Tests
 *
 * Tests for ethical user data export during revocation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  generateHistoricalExport,
  validateHistoricalExport,
  formatExportSummary,
} from './HistoricalExport'
import { db } from '../../store/database'
import type {
  UserEntity,
  CompanyEntity,
  TransactionEntity,
  AccountEntity,
  ContactEntity,
  AuditLogEntity,
} from '../../store/types'

const mockCompany: CompanyEntity = {
  id: 'company-1',
  name: 'Test Company Inc',
  legalEntityType: 'llc',
  fiscalYearEnd: { month: 12, day: 31 },
  currency: 'USD',
  timezone: 'America/New_York',
  key_rotation_epoch: 0,
  created_at: Date.now(),
  updated_at: Date.now(),
  deviceId: 'device-1',
  versionVector: {},
  lastModifiedAt: Date.now(),
}

const mockRevokedUser: UserEntity = {
  id: 'revoked-user',
  companyId: 'company-1',
  email: 'revoked@test.com',
  name: 'Revoked User',
  role: 'bookkeeper',
  phase: 'stabilize',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  _encrypted: { email: false, name: false },
  deviceId: 'device-1',
  versionVector: {},
  lastModifiedAt: Date.now(),
}

const mockOtherUser: UserEntity = {
  id: 'other-user',
  companyId: 'company-1',
  email: 'other@test.com',
  name: 'Other User',
  role: 'manager',
  phase: 'organize',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  _encrypted: { email: false, name: false },
  deviceId: 'device-1',
  versionVector: {},
  lastModifiedAt: Date.now(),
}

const mockTransactions: TransactionEntity[] = [
  {
    id: 'txn-1',
    companyId: 'company-1',
    description: 'Transaction by revoked user',
    date: new Date('2024-01-15'),
    amount: 100,
    status: 'pending',
    createdBy: 'revoked-user',
    lastModifiedAt: Date.now(),
    deviceId: 'device-1',
    versionVector: {},
  },
  {
    id: 'txn-2',
    companyId: 'company-1',
    description: 'Transaction by other user',
    date: new Date('2024-01-16'),
    amount: 200,
    status: 'pending',
    createdBy: 'other-user',
    lastModifiedAt: Date.now(),
    deviceId: 'device-1',
    versionVector: {},
  },
  {
    id: 'txn-3',
    companyId: 'company-1',
    description: 'Transaction modified by revoked user',
    date: new Date('2024-01-17'),
    amount: 300,
    status: 'pending',
    createdBy: 'other-user',
    lastModifiedBy: 'revoked-user',
    lastModifiedAt: Date.now(),
    deviceId: 'device-1',
    versionVector: {},
  },
]

const mockAccounts: AccountEntity[] = [
  {
    id: 'account-1',
    companyId: 'company-1',
    name: 'Test Account',
    type: 'asset',
    code: '1000',
    isActive: true,
    balance: 1000,
    createdBy: 'revoked-user',
    lastModifiedAt: Date.now(),
    deviceId: 'device-1',
    versionVector: {},
  },
]

const mockContacts: ContactEntity[] = [
  {
    id: 'contact-1',
    companyId: 'company-1',
    name: 'Test Contact',
    type: 'customer',
    isActive: true,
    createdBy: 'revoked-user',
    lastModifiedAt: Date.now(),
    deviceId: 'device-1',
    versionVector: {},
  },
]

describe('HistoricalExport', () => {
  beforeEach(async () => {
    // Clear database
    await db.users.clear()
    await db.companies.clear()
    await db.transactions.clear()
    await db.accounts.clear()
    await db.contacts.clear()
    await db.invoices.clear()
    await db.bills.clear()
    await db.auditLogs.clear()

    // Add test data
    await db.companies.add(mockCompany)
    await db.users.bulkAdd([mockRevokedUser, mockOtherUser])
    await db.transactions.bulkAdd(mockTransactions)
    await db.accounts.bulkAdd(mockAccounts)
    await db.contacts.bulkAdd(mockContacts)
  })

  afterEach(async () => {
    await db.users.clear()
    await db.companies.clear()
    await db.transactions.clear()
    await db.accounts.clear()
    await db.contacts.clear()
    await db.invoices.clear()
    await db.bills.clear()
    await db.auditLogs.clear()
  })

  describe('generateHistoricalExport', () => {
    it('should successfully generate export for user', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'company-1',
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.json).toBeDefined()
      expect(result.blob).toBeDefined()
      expect(result.fileName).toBeDefined()
    })

    it('should include correct metadata', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'company-1',
        revocationReason: 'Employee departed',
      })

      expect(result.success).toBe(true)
      expect(result.data!.metadata).toBeDefined()
      expect(result.data!.metadata.userId).toBe('revoked-user')
      expect(result.data!.metadata.userName).toBe('Revoked User')
      expect(result.data!.metadata.companyId).toBe('company-1')
      expect(result.data!.metadata.companyName).toBe('Test Company Inc')
      expect(result.data!.metadata.revocationReason).toBe('Employee departed')
      expect(result.data!.metadata.readOnly).toBe(true)
      expect(result.data!.metadata.version).toBe('1.0.0')
    })

    it('should include company and user data', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'company-1',
      })

      expect(result.success).toBe(true)
      expect(result.data!.company).toEqual(mockCompany)
      expect(result.data!.user).toEqual(mockRevokedUser)
    })

    it('should filter transactions to user contributions only', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'company-1',
        includeAllData: false,
      })

      expect(result.success).toBe(true)
      expect(result.data!.transactions.length).toBe(2) // txn-1 (created) + txn-3 (modified)

      const txnIds = result.data!.transactions.map((t) => t.id)
      expect(txnIds).toContain('txn-1')
      expect(txnIds).toContain('txn-3')
      expect(txnIds).not.toContain('txn-2') // Created by other user
    })

    it('should include all accounts for context', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'company-1',
      })

      expect(result.success).toBe(true)
      expect(result.data!.accounts.length).toBe(mockAccounts.length)
    })

    it('should filter contacts to user contributions', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'company-1',
        includeAllData: false,
      })

      expect(result.success).toBe(true)
      expect(result.data!.contacts.length).toBe(1)
      expect(result.data!.contacts[0].createdBy).toBe('revoked-user')
    })

    it('should include all data when includeAllData is true', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'company-1',
        includeAllData: true,
      })

      expect(result.success).toBe(true)
      expect(result.data!.transactions.length).toBe(mockTransactions.length)
      expect(result.data!.contacts.length).toBe(mockContacts.length)
    })

    it('should filter by date range', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'company-1',
        includeAllData: true,
        dateRange: {
          start: new Date('2024-01-15'),
          end: new Date('2024-01-16'),
        },
      })

      expect(result.success).toBe(true)
      // Should only include txn-1 and txn-2 (within range)
      expect(result.data!.transactions.length).toBe(2)

      const txnIds = result.data!.transactions.map((t) => t.id)
      expect(txnIds).toContain('txn-1')
      expect(txnIds).toContain('txn-2')
      expect(txnIds).not.toContain('txn-3') // Outside range
    })

    it('should generate valid JSON string', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'company-1',
      })

      expect(result.success).toBe(true)
      expect(result.json).toBeDefined()

      // Should be parseable
      const parsed = JSON.parse(result.json!)
      expect(parsed.metadata).toBeDefined()
      expect(parsed.company).toBeDefined()
      expect(parsed.user).toBeDefined()
    })

    it('should generate downloadable blob', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'company-1',
      })

      expect(result.success).toBe(true)
      expect(result.blob).toBeDefined()
      expect(result.blob!.type).toBe('application/json')
      expect(result.blob!.size).toBeGreaterThan(0)
    })

    it('should generate descriptive file name', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'company-1',
      })

      expect(result.success).toBe(true)
      expect(result.fileName).toBeDefined()
      expect(result.fileName).toContain('graceful-books-export')
      expect(result.fileName).toContain('Revoked-User')
      expect(result.fileName).toMatch(/\.json$/)
    })

    it('should include record counts in metadata', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'company-1',
        includeAllData: false,
      })

      expect(result.success).toBe(true)
      expect(result.data!.metadata.recordCounts).toBeDefined()
      expect(result.data!.metadata.recordCounts.transactions).toBe(2)
      expect(result.data!.metadata.recordCounts.accounts).toBe(1)
      expect(result.data!.metadata.recordCounts.contacts).toBe(1)
    })

    it('should return error if user not found', async () => {
      const result = await generateHistoricalExport({
        userId: 'nonexistent-user',
        companyId: 'company-1',
      })

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0]).toContain('User not found')
    })

    it('should return error if company not found', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'nonexistent-company',
      })

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0]).toContain('Company not found')
    })

    it('should validate required parameters', async () => {
      const result = await generateHistoricalExport({
        userId: '',
        companyId: 'company-1',
      })

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors![0]).toContain('Missing required parameters')
    })

    it('should include warning if no transactions found', async () => {
      // Create user with no transactions
      const newUser: UserEntity = {
        id: 'new-user',
        companyId: 'company-1',
        email: 'new@test.com',
        name: 'New User',
        role: 'view-only',
        phase: 'stabilize',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        _encrypted: { email: false, name: false },
        deviceId: 'device-1',
        versionVector: {},
        lastModifiedAt: Date.now(),
      }
      await db.users.add(newUser)

      const result = await generateHistoricalExport({
        userId: 'new-user',
        companyId: 'company-1',
      })

      expect(result.success).toBe(true)
      expect(result.warnings).toBeDefined()
      expect(result.warnings![0]).toContain('No transactions found')
    })
  })

  describe('validateHistoricalExport', () => {
    it('should validate correct export data', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'company-1',
      })

      const validation = validateHistoricalExport(result.data!)

      expect(validation.valid).toBe(true)
      expect(validation.errors.length).toBe(0)
    })

    it('should reject non-object data', () => {
      const validation = validateHistoricalExport('not an object')

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Export data is not an object')
    })

    it('should require metadata', () => {
      const invalidData = {
        company: mockCompany,
        user: mockRevokedUser,
      }

      const validation = validateHistoricalExport(invalidData)

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Missing metadata')
    })

    it('should require metadata fields', () => {
      const invalidData = {
        metadata: {
          exportedAt: new Date(),
          // Missing other required fields
        },
        company: mockCompany,
        user: mockRevokedUser,
      }

      const validation = validateHistoricalExport(invalidData)

      expect(validation.valid).toBe(false)
      expect(validation.errors.some((e) => e.includes('metadata'))).toBe(true)
    })

    it('should require readOnly flag to be true', () => {
      const invalidData = {
        metadata: {
          exportedAt: new Date(),
          snapshotAt: new Date(),
          userId: 'user-1',
          companyId: 'company-1',
          userName: 'Test',
          companyName: 'Test Co',
          version: '1.0.0',
          readOnly: false, // Invalid!
          recordCounts: {
            transactions: 0,
            accounts: 0,
            contacts: 0,
            invoices: 0,
            bills: 0,
            auditLogs: 0,
          },
        },
        company: mockCompany,
        user: mockRevokedUser,
        transactions: [],
        accounts: [],
        contacts: [],
      }

      const validation = validateHistoricalExport(invalidData)

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Export must be marked as readOnly')
    })

    it('should require company data', () => {
      const invalidData = {
        metadata: {
          exportedAt: new Date(),
          snapshotAt: new Date(),
          userId: 'user-1',
          companyId: 'company-1',
          userName: 'Test',
          companyName: 'Test Co',
          version: '1.0.0',
          readOnly: true,
          recordCounts: {
            transactions: 0,
            accounts: 0,
            contacts: 0,
            invoices: 0,
            bills: 0,
            auditLogs: 0,
          },
        },
        user: mockRevokedUser,
      }

      const validation = validateHistoricalExport(invalidData)

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Missing company data')
    })

    it('should require array fields to be arrays', () => {
      const invalidData = {
        metadata: {
          exportedAt: new Date(),
          snapshotAt: new Date(),
          userId: 'user-1',
          companyId: 'company-1',
          userName: 'Test',
          companyName: 'Test Co',
          version: '1.0.0',
          readOnly: true,
          recordCounts: {
            transactions: 0,
            accounts: 0,
            contacts: 0,
            invoices: 0,
            bills: 0,
            auditLogs: 0,
          },
        },
        company: mockCompany,
        user: mockRevokedUser,
        transactions: 'not an array',
        accounts: 'not an array',
        contacts: 'not an array',
      }

      const validation = validateHistoricalExport(invalidData)

      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('transactions must be an array')
      expect(validation.errors).toContain('accounts must be an array')
      expect(validation.errors).toContain('contacts must be an array')
    })
  })

  describe('formatExportSummary', () => {
    it('should format export summary with all details', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'company-1',
        revocationReason: 'Employee departed',
      })

      const summary = formatExportSummary(result.data!.metadata)

      expect(summary).toContain('Data snapshot for Revoked User')
      expect(summary).toContain('Company: Test Company Inc')
      expect(summary).toContain('As of:')
      expect(summary).toContain('transactions')
      expect(summary).toContain('accounts')
      expect(summary).toContain('contacts')
      expect(summary).toContain('Reason: Employee departed')
      expect(summary).toContain('read-only historical snapshot')
      expect(summary).toContain('cannot be synced back')
    })

    it('should format summary without reason if not provided', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'company-1',
      })

      const summary = formatExportSummary(result.data!.metadata)

      expect(summary).not.toContain('Reason:')
      expect(summary).toContain('read-only historical snapshot')
    })

    it('should show record counts', async () => {
      const result = await generateHistoricalExport({
        userId: 'revoked-user',
        companyId: 'company-1',
        includeAllData: false,
      })

      const summary = formatExportSummary(result.data!.metadata)

      expect(summary).toContain('2 transactions') // User created 2
      expect(summary).toContain('1 accounts')
      expect(summary).toContain('1 contacts')
    })
  })
})
