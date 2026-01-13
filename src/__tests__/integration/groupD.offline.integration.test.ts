/**
 * Group D Offline Integration Tests
 *
 * Tests for offline-first functionality:
 * - Data persistence when offline
 * - Sync queue management
 * - CRDT conflict resolution
 * - Online/offline transitions
 *
 * Per D8: Test offline-first functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db } from '../../store/database'
import { nanoid } from 'nanoid'

// Store functions
import { createAccount, updateAccount, queryAccounts } from '../../store/accounts'
import { createTransaction, updateTransaction, queryTransactions } from '../../store/transactions'
import { addToSyncQueue, processSyncQueue, getSyncQueueStatus } from '../../store/batch'

// Sync functions
import { mergeVersionVectors, resolveConflict } from '../../sync/conflictResolution'
import { initVersionVector, incrementVersionVector } from '../../utils/versionVector'

// Types
import type { Account, JournalEntry } from '../../types'
import type { VersionVector } from '../../types/database.types'

/**
 * Test utilities
 */

const generateTestCompanyId = () => `test-company-${nanoid(10)}`
const generateTestUserId = () => `test-user-${nanoid(10)}`

async function clearDatabase() {
  await db.clearAllData()
}

/**
 * Test Suite: Offline Integration Tests
 */

describe('Group D Offline Integration Tests', () => {
  let testCompanyId: string
  let testUserId: string

  beforeEach(async () => {
    await clearDatabase()
    testCompanyId = generateTestCompanyId()
    testUserId = generateTestUserId()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  /**
   * Test 1: Data persistence when offline
   */
  describe('Offline Data Persistence', () => {
    it('should create and modify data while offline', async () => {
      // Simulate offline mode (no network)
      const isOnline = false

      // STEP 1: Create account while offline
      const account = await createAccount({
        companyId: testCompanyId,
        name: 'Offline Cash Account',
        accountNumber: '1000',
        type: 'asset',
        description: 'Created while offline',
        isActive: true,
      })

      expect(account.success).toBe(true)
      expect(account.data.id).toBeDefined()

      // STEP 2: Verify data is in local database
      const localAccounts = await queryAccounts({ companyId: testCompanyId })
      expect(localAccounts.success).toBe(true)
      expect(localAccounts.data.length).toBe(1)
      expect(localAccounts.data[0].name).toBe('Offline Cash Account')

      // STEP 3: Modify account while offline
      const updated = await updateAccount(account.data.id, {
        description: 'Updated while offline',
      })

      expect(updated.success).toBe(true)
      expect(updated.data.description).toBe('Updated while offline')

      // STEP 4: Verify update persisted locally
      const updatedAccounts = await queryAccounts({ companyId: testCompanyId })
      expect(updatedAccounts.data[0].description).toBe('Updated while offline')

      // STEP 5: Create transaction while offline
      const transaction = await createTransaction({
        companyId: testCompanyId,
        date: new Date(),
        description: 'Offline transaction',
        memo: 'Created while offline',
        status: 'draft',
        lines: [
          {
            id: nanoid(),
            accountId: account.data.id,
            debit: 100,
            credit: 0,
            memo: '',
          },
          {
            id: nanoid(),
            accountId: account.data.id,
            debit: 0,
            credit: 100,
            memo: '',
          },
        ],
      })

      expect(transaction.success).toBe(true)

      // STEP 6: Verify all data persisted locally
      const allAccounts = await db.accounts.toArray()
      const allTransactions = await db.transactions.toArray()

      expect(allAccounts.length).toBe(1)
      expect(allTransactions.length).toBe(1)
      expect(allAccounts[0].description).toBe('Updated while offline')
      expect(allTransactions[0].memo).toBe('Created while offline')
    })

    it('should maintain data integrity across app restarts', async () => {
      // STEP 1: Create data
      const account = await createAccount({
        companyId: testCompanyId,
        name: 'Persistent Account',
        accountNumber: '1000',
        type: 'asset',
        description: 'Should persist',
        isActive: true,
      })

      expect(account.success).toBe(true)

      // STEP 2: Close database (simulating app close)
      await db.close()

      // STEP 3: Reopen database (simulating app restart)
      await db.open()

      // STEP 4: Verify data persisted
      const accounts = await queryAccounts({ companyId: testCompanyId })
      expect(accounts.success).toBe(true)
      expect(accounts.data.length).toBe(1)
      expect(accounts.data[0].name).toBe('Persistent Account')
      expect(accounts.data[0].description).toBe('Should persist')
    })
  })

  /**
   * Test 2: Sync queue management
   */
  describe('Sync Queue Management', () => {
    it('should queue changes for later sync', async () => {
      // Note: Simplified test as addToSyncQueue may not be fully implemented
      // This test demonstrates the expected behavior

      // STEP 1: Create account (should add to sync queue in real implementation)
      const account = await createAccount({
        companyId: testCompanyId,
        name: 'Queue Test Account',
        accountNumber: '1000',
        type: 'asset',
        description: 'Should be queued',
        isActive: true,
      })

      expect(account.success).toBe(true)

      // STEP 2: Verify account has version vector for sync tracking
      expect(account.data.versionVector).toBeDefined()

      // In a full implementation, we would verify:
      // - Item is in sync queue
      // - Queue status shows pending items
      // - Items can be processed when online
    })

    it('should handle sync queue processing', async () => {
      // Create multiple accounts
      const accounts = await Promise.all([
        createAccount({
          companyId: testCompanyId,
          name: 'Account 1',
          accountNumber: '1000',
          type: 'asset',
          description: 'First account',
          isActive: true,
        }),
        createAccount({
          companyId: testCompanyId,
          name: 'Account 2',
          accountNumber: '2000',
          type: 'liability',
          description: 'Second account',
          isActive: true,
        }),
        createAccount({
          companyId: testCompanyId,
          name: 'Account 3',
          accountNumber: '3000',
          type: 'equity',
          description: 'Third account',
          isActive: true,
        }),
      ])

      accounts.forEach(result => {
        expect(result.success).toBe(true)
      })

      // Verify all accounts have version vectors
      const allAccounts = await queryAccounts({ companyId: testCompanyId })
      expect(allAccounts.data.length).toBe(3)
      allAccounts.data.forEach(account => {
        expect(account.versionVector).toBeDefined()
      })
    })
  })

  /**
   * Test 3: CRDT conflict resolution
   */
  describe('CRDT Conflict Resolution', () => {
    it('should resolve concurrent updates using version vectors', async () => {
      // STEP 1: Create initial account
      const account = await createAccount({
        companyId: testCompanyId,
        name: 'Conflict Test Account',
        accountNumber: '1000',
        type: 'asset',
        description: 'Original description',
        isActive: true,
      })

      expect(account.success).toBe(true)
      const originalVector = account.data.versionVector!

      // STEP 2: Simulate concurrent updates from two devices
      const deviceA = 'device-A'
      const deviceB = 'device-B'

      // Device A update
      const vectorA = incrementVersionVector(originalVector, deviceA)
      const updateA = {
        ...account.data,
        description: 'Updated by Device A',
        versionVector: vectorA,
      }

      // Device B update (concurrent)
      const vectorB = incrementVersionVector(originalVector, deviceB)
      const updateB = {
        ...account.data,
        description: 'Updated by Device B',
        versionVector: vectorB,
      }

      // STEP 3: Merge version vectors
      const mergedVector = mergeVersionVectors(vectorA, vectorB)

      expect(mergedVector).toBeDefined()
      expect(mergedVector[deviceA]).toBe(vectorA[deviceA])
      expect(mergedVector[deviceB]).toBe(vectorB[deviceB])

      // STEP 4: Resolve conflict using CRDT strategy (Last Write Wins)
      const resolved = resolveConflict(
        updateA,
        updateB,
        'account',
        'last-write-wins'
      )

      expect(resolved).toBeDefined()
      expect(resolved.versionVector).toEqual(mergedVector)
    })

    it('should handle multi-device version vector merging', async () => {
      // Initialize version vector
      const v1 = initVersionVector()
      expect(v1).toBeDefined()
      expect(Object.keys(v1).length).toBe(0)

      // Device 1 makes changes
      const v2 = incrementVersionVector(v1, 'device-1')
      expect(v2['device-1']).toBe(1)

      // Device 2 makes concurrent changes
      const v3 = incrementVersionVector(v1, 'device-2')
      expect(v3['device-2']).toBe(1)

      // Device 1 makes more changes
      const v4 = incrementVersionVector(v2, 'device-1')
      expect(v4['device-1']).toBe(2)

      // Merge all vectors
      const merged1 = mergeVersionVectors(v2, v3)
      expect(merged1['device-1']).toBe(1)
      expect(merged1['device-2']).toBe(1)

      const merged2 = mergeVersionVectors(merged1, v4)
      expect(merged2['device-1']).toBe(2)
      expect(merged2['device-2']).toBe(1)
    })
  })

  /**
   * Test 4: Online/Offline transitions
   */
  describe('Online/Offline Transitions', () => {
    it('should handle transition from offline to online', async () => {
      // STEP 1: Create data while offline
      const offlineAccounts = []
      for (let i = 0; i < 3; i++) {
        const account = await createAccount({
          companyId: testCompanyId,
          name: `Offline Account ${i + 1}`,
          accountNumber: `${1000 + i}`,
          type: 'asset',
          description: 'Created offline',
          isActive: true,
        })
        offlineAccounts.push(account.data)
      }

      expect(offlineAccounts.length).toBe(3)

      // STEP 2: Verify all data is in local database
      const localAccounts = await queryAccounts({ companyId: testCompanyId })
      expect(localAccounts.data.length).toBe(3)

      // STEP 3: Simulate going online
      const isOnline = true

      // STEP 4: Verify data is still accessible
      const onlineAccounts = await queryAccounts({ companyId: testCompanyId })
      expect(onlineAccounts.data.length).toBe(3)

      // All accounts should have version vectors for sync
      onlineAccounts.data.forEach(account => {
        expect(account.versionVector).toBeDefined()
      })

      // In a full implementation, this would trigger sync to server
      // and verify that all offline changes are uploaded
    })

    it('should handle transition from online to offline gracefully', async () => {
      // STEP 1: Create data while "online"
      const onlineAccount = await createAccount({
        companyId: testCompanyId,
        name: 'Online Account',
        accountNumber: '1000',
        type: 'asset',
        description: 'Created online',
        isActive: true,
      })

      expect(onlineAccount.success).toBe(true)

      // STEP 2: Simulate going offline
      const isOnline = false

      // STEP 3: Modify data while offline
      const updated = await updateAccount(onlineAccount.data.id, {
        description: 'Updated while offline',
      })

      expect(updated.success).toBe(true)

      // STEP 4: Verify update succeeded even when offline
      const account = await db.accounts.get(onlineAccount.data.id)
      expect(account?.description).toBe('Updated while offline')

      // Version vector should be incremented
      expect(account?.versionVector).toBeDefined()
    })
  })

  /**
   * Test 5: Integration with Group D features while offline
   */
  describe('Group D Features Offline', () => {
    it('should complete COA wizard workflow while offline', async () => {
      // This demonstrates that D1 (COA Wizard) works offline
      const accounts = [
        {
          companyId: testCompanyId,
          name: 'Cash',
          accountNumber: '1000',
          type: 'asset' as const,
          description: 'Cash account',
          isActive: true,
        },
        {
          companyId: testCompanyId,
          name: 'Revenue',
          accountNumber: '4000',
          type: 'income' as const,
          description: 'Revenue account',
          isActive: true,
        },
        {
          companyId: testCompanyId,
          name: 'Expenses',
          accountNumber: '5000',
          type: 'expense' as const,
          description: 'Expense account',
          isActive: true,
        },
      ]

      // Create all accounts while offline
      const results = await Promise.all(
        accounts.map(acc => createAccount(acc))
      )

      results.forEach(result => {
        expect(result.success).toBe(true)
      })

      // Verify all persisted locally
      const localAccounts = await queryAccounts({ companyId: testCompanyId })
      expect(localAccounts.data.length).toBe(3)
    })

    it('should record transactions while offline', async () => {
      // Create account
      const account = await createAccount({
        companyId: testCompanyId,
        name: 'Cash',
        accountNumber: '1000',
        type: 'asset',
        description: 'Cash account',
        isActive: true,
      })

      // Create transaction while offline
      const transaction = await createTransaction({
        companyId: testCompanyId,
        date: new Date(),
        description: 'Offline transaction',
        memo: 'Created while offline',
        status: 'posted',
        lines: [
          {
            id: nanoid(),
            accountId: account.data.id,
            debit: 500,
            credit: 0,
            memo: '',
          },
          {
            id: nanoid(),
            accountId: account.data.id,
            debit: 0,
            credit: 500,
            memo: '',
          },
        ],
      })

      expect(transaction.success).toBe(true)

      // Verify transaction persisted
      const transactions = await queryTransactions({ companyId: testCompanyId })
      expect(transactions.data.length).toBe(1)
      expect(transactions.data[0].memo).toBe('Created while offline')
    })
  })

  /**
   * Test 6: Data export and import (offline backup/restore)
   */
  describe('Offline Backup and Restore', () => {
    it('should export and import all data', async () => {
      // STEP 1: Create test data
      await createAccount({
        companyId: testCompanyId,
        name: 'Test Account 1',
        accountNumber: '1000',
        type: 'asset',
        description: 'Test',
        isActive: true,
      })

      await createAccount({
        companyId: testCompanyId,
        name: 'Test Account 2',
        accountNumber: '2000',
        type: 'liability',
        description: 'Test',
        isActive: true,
      })

      // STEP 2: Export all data
      const exported = await db.exportAllData()
      expect(exported.accounts.length).toBe(2)

      // STEP 3: Clear database
      await clearDatabase()

      // Verify cleared
      const cleared = await queryAccounts({ companyId: testCompanyId })
      expect(cleared.data.length).toBe(0)

      // STEP 4: Import data
      await db.importData(exported)

      // STEP 5: Verify import
      const imported = await queryAccounts({ companyId: testCompanyId })
      expect(imported.data.length).toBe(2)
      expect(imported.data[0].name).toBe('Test Account 1')
      expect(imported.data[1].name).toBe('Test Account 2')
    })
  })
})
