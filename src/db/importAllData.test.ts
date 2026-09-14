/**
 * Integration tests for database importAllData
 *
 * Tests the restore-into-non-empty-database scenario to verify:
 * - Clear + bulkAdd works atomically
 * - Overlapping IDs don't cause duplicate key errors
 * - Final state matches exactly the backup data
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { db, type DatabaseExport } from './index';

describe('db.importAllData', () => {
  // Helper to create a minimal valid DatabaseExport
  function createBackupExport(overrides: Partial<DatabaseExport['data']> = {}): DatabaseExport {
    return {
      version: 1,
      exportedAt: Date.now(),
      data: {
        accounts: [],
        transactions: [],
        transactionLineItems: [],
        contacts: [],
        products: [],
        users: [],
        companies: [],
        companyUsers: [],
        auditLogs: [],
        sessions: [],
        devices: [],
        ...overrides,
      },
    };
  }

  beforeEach(async () => {
    // Clear all tables before each test
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) {
        await table.clear();
      }
    });
  });

  afterEach(async () => {
    // Clean up after each test
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) {
        await table.clear();
      }
    });
  });

  it('should restore backup into empty database', async () => {
    const backup = createBackupExport({
      accounts: [
        {
          id: 'acc-1',
          companyId: 'company-1',
          accountNumber: '1000',
          name: 'Cash',
          type: 'asset',
          normalBalance: 'debit',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          versionVector: { 'device-1': 1 },
        } as any,
      ],
      companies: [
        {
          id: 'company-1',
          name: 'Test Company',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          versionVector: { 'device-1': 1 },
        } as any,
      ],
    });

    await db.importAllData(backup);

    const accounts = await db.accounts.toArray();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe('acc-1');
    expect(accounts[0].name).toBe('Cash');

    const companies = await db.companies.toArray();
    expect(companies).toHaveLength(1);
    expect(companies[0].id).toBe('company-1');
  });

  it('should restore backup into non-empty database with OVERLAPPING IDs', async () => {
    // Seed database with existing data
    const existingAccount = {
      id: 'acc-1', // Same ID as backup - should be replaced
      companyId: 'company-1',
      accountNumber: '1000',
      name: 'OLD Cash Account',
      type: 'asset',
      normalBalance: 'debit',
      isActive: true,
      createdAt: Date.now() - 100000,
      updatedAt: Date.now() - 100000,
      versionVector: { 'device-1': 1 },
    };

    const existingOrphan = {
      id: 'acc-orphan', // NOT in backup - should be removed
      companyId: 'company-1',
      accountNumber: '9999',
      name: 'Orphan Account',
      type: 'asset',
      normalBalance: 'debit',
      isActive: true,
      createdAt: Date.now() - 100000,
      updatedAt: Date.now() - 100000,
      versionVector: { 'device-1': 1 },
    };

    await db.accounts.bulkAdd([existingAccount, existingOrphan] as any[]);
    expect(await db.accounts.count()).toBe(2);

    // Backup contains acc-1 with updated name (overlapping ID)
    const backup = createBackupExport({
      accounts: [
        {
          id: 'acc-1', // Same ID as existing - tests duplicate handling
          companyId: 'company-1',
          accountNumber: '1000',
          name: 'NEW Cash Account', // Different name
          type: 'asset',
          normalBalance: 'debit',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          versionVector: { 'device-1': 2 },
        } as any,
      ],
    });

    // This is the critical test - should NOT throw ConstraintError
    await expect(db.importAllData(backup)).resolves.not.toThrow();

    // Verify final state matches backup exactly
    const accounts = await db.accounts.toArray();
    expect(accounts).toHaveLength(1); // Only 1 account (backup data)
    expect(accounts[0].id).toBe('acc-1');
    expect(accounts[0].name).toBe('NEW Cash Account'); // Updated value
    // Orphan should be gone
  });

  it('should handle restore with multiple tables and overlapping IDs', async () => {
    // Seed multiple tables
    await db.companies.add({
      id: 'company-1',
      name: 'Old Company Name',
      createdAt: Date.now() - 100000,
      updatedAt: Date.now() - 100000,
      versionVector: { 'device-1': 1 },
    } as any);

    await db.accounts.add({
      id: 'acc-1',
      companyId: 'company-1',
      accountNumber: '1000',
      name: 'Old Account',
      type: 'asset',
      normalBalance: 'debit',
      isActive: true,
      createdAt: Date.now() - 100000,
      updatedAt: Date.now() - 100000,
      versionVector: { 'device-1': 1 },
    } as any);

    await db.contacts.add({
      id: 'contact-1',
      companyId: 'company-1',
      name: 'Old Contact',
      type: 'customer',
      createdAt: Date.now() - 100000,
      updatedAt: Date.now() - 100000,
      versionVector: { 'device-1': 1 },
    } as any);

    // Backup with overlapping IDs but different data
    const backup = createBackupExport({
      companies: [
        {
          id: 'company-1', // Same ID
          name: 'New Company Name', // Different data
          createdAt: Date.now(),
          updatedAt: Date.now(),
          versionVector: { 'device-1': 2 },
        } as any,
      ],
      accounts: [
        {
          id: 'acc-1', // Same ID
          companyId: 'company-1',
          accountNumber: '1000',
          name: 'New Account', // Different data
          type: 'asset',
          normalBalance: 'debit',
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          versionVector: { 'device-1': 2 },
        } as any,
      ],
      contacts: [
        {
          id: 'contact-new', // Different ID
          companyId: 'company-1',
          name: 'New Contact',
          type: 'vendor',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          versionVector: { 'device-1': 1 },
        } as any,
      ],
    });

    await expect(db.importAllData(backup)).resolves.not.toThrow();

    // Verify all tables match backup
    const companies = await db.companies.toArray();
    expect(companies).toHaveLength(1);
    expect(companies[0].name).toBe('New Company Name');

    const accounts = await db.accounts.toArray();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('New Account');

    const contacts = await db.contacts.toArray();
    expect(contacts).toHaveLength(1);
    expect(contacts[0].id).toBe('contact-new'); // Old contact-1 is gone
    expect(contacts[0].name).toBe('New Contact');
  });

  it('should be atomic - all or nothing', async () => {
    // Seed some data
    await db.accounts.add({
      id: 'acc-existing',
      companyId: 'company-1',
      accountNumber: '1000',
      name: 'Existing Account',
      type: 'asset',
      normalBalance: 'debit',
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      versionVector: { 'device-1': 1 },
    } as any);

    const originalCount = await db.accounts.count();
    expect(originalCount).toBe(1);

    // Create invalid backup that will fail during bulkAdd
    // (missing required fields or invalid data)
    const invalidBackup: DatabaseExport = {
      version: 1,
      exportedAt: Date.now(),
      data: {
        accounts: [
          { id: 'acc-1', name: 'Valid' } as any,
          null as any, // This should cause an error
        ],
        transactions: [],
        transactionLineItems: [],
        contacts: [],
        products: [],
        users: [],
        companies: [],
        companyUsers: [],
        auditLogs: [],
        sessions: [],
        devices: [],
      },
    };

    // Import should fail
    await expect(db.importAllData(invalidBackup)).rejects.toThrow();

    // Original data should be preserved (transaction rolled back)
    const afterCount = await db.accounts.count();
    expect(afterCount).toBe(1);

    const accounts = await db.accounts.toArray();
    expect(accounts[0].id).toBe('acc-existing');
    expect(accounts[0].name).toBe('Existing Account');
  });
});
