/**
 * Backup Diff Tests
 *
 * Test 1: ID diff - verifies computeMissingRecords correctly identifies
 * records in current DB that are not in the backup.
 *
 * Break-then-fix verification performed during development.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  extractBackupIds,
  formatRecordForDisplay,
  getTableDisplayName,
  computeMissingRecords,
  TABLES_TO_DIFF,
  MAX_SHOWN_PER_TABLE,
} from './backupDiff';
import type { DatabaseExport } from '../../db';
import { db } from '../../db';

describe('backupDiff', () => {
  describe('extractBackupIds', () => {
    it('extracts IDs from v3 tables format', () => {
      const backup: DatabaseExport = {
        version: 3,
        timestamp: Date.now(),
        tables: {
          cpgInvoices: [
            { id: 'inv-1', invoice_number: 'INV-001' },
            { id: 'inv-2', invoice_number: 'INV-002' },
          ],
          products: [
            { id: 'prod-1', name: 'Product A' },
          ],
        },
      };

      const result = extractBackupIds(backup);

      expect(result.cpgInvoices).toBeDefined();
      expect(result.cpgInvoices.has('inv-1')).toBe(true);
      expect(result.cpgInvoices.has('inv-2')).toBe(true);
      expect(result.products).toBeDefined();
      expect(result.products.has('prod-1')).toBe(true);
    });

    it('extracts IDs from v1/v2 data format', () => {
      const backup: DatabaseExport = {
        version: 2,
        timestamp: Date.now(),
        data: {
          cpgVendors: [
            { id: 'vendor-1', name: 'Vendor A' },
            { id: 'vendor-2', name: 'Vendor B' },
          ],
        },
      };

      const result = extractBackupIds(backup);

      expect(result.cpgVendors).toBeDefined();
      expect(result.cpgVendors.has('vendor-1')).toBe(true);
      expect(result.cpgVendors.has('vendor-2')).toBe(true);
    });

    it('returns empty set for missing tables', () => {
      const backup: DatabaseExport = {
        version: 3,
        timestamp: Date.now(),
        tables: {},
      };

      const result = extractBackupIds(backup);

      expect(result.cpgInvoices).toBeUndefined();
    });
  });

  describe('formatRecordForDisplay', () => {
    it('formats invoice with all fields', () => {
      const invoice = {
        id: 'inv-1',
        invoice_number: 'INV-2024-001',
        vendor_name: 'Acme Corp',
        total: 1234.56,
        invoice_date: new Date('2024-03-15').getTime(),
      };

      const result = formatRecordForDisplay('cpgInvoices', invoice);

      expect(result).toContain('INV-2024-001');
      expect(result).toContain('Acme Corp');
      expect(result).toContain('$1,234.56');
      expect(result).toContain('Mar');
    });

    it('formats product with name', () => {
      const product = { id: 'prod-1', name: 'Organic Honey' };
      const result = formatRecordForDisplay('products', product);
      expect(result).toBe('Organic Honey');
    });

    it('formats vendor with name', () => {
      const vendor = { id: 'v-1', name: 'Local Farms' };
      const result = formatRecordForDisplay('cpgVendors', vendor);
      expect(result).toBe('Local Farms');
    });

    it('formats account with number and name', () => {
      const account = { id: 'acc-1', accountNumber: '1000', name: 'Cash' };
      const result = formatRecordForDisplay('accounts', account);
      expect(result).toBe('1000 — Cash');
    });

    it('formats transaction with date, description, and amount', () => {
      const tx = {
        id: 'tx-1',
        date: new Date('2024-06-20').getTime(),
        description: 'Office supplies',
        amount: -150.00,
      };
      const result = formatRecordForDisplay('transactions', tx);
      expect(result).toContain('Jun');
      expect(result).toContain('Office supplies');
      expect(result).toContain('$150');
    });

    it('uses fallback for unknown table types', () => {
      const record = { id: 'x-1', name: 'Custom Record' };
      const result = formatRecordForDisplay('customTable', record);
      expect(result).toBe('Custom Record');
    });
  });

  describe('getTableDisplayName', () => {
    it('returns friendly names for known tables', () => {
      expect(getTableDisplayName('cpgInvoices')).toBe('Invoices');
      expect(getTableDisplayName('products')).toBe('Products');
      expect(getTableDisplayName('cpgFinishedProducts')).toBe('Finished Products');
      expect(getTableDisplayName('cpgCategories')).toBe('Categories');
      expect(getTableDisplayName('cpgVendors')).toBe('Vendors');
      expect(getTableDisplayName('cpgRecipes')).toBe('Recipes');
      expect(getTableDisplayName('contacts')).toBe('Contacts');
      expect(getTableDisplayName('accounts')).toBe('Accounts');
      expect(getTableDisplayName('transactions')).toBe('Transactions');
    });

    it('converts camelCase for unknown tables', () => {
      expect(getTableDisplayName('customDataTable')).toBe('custom Data Table');
    });
  });

  describe('computeMissingRecords', () => {
    beforeEach(async () => {
      // Ensure database is open and clear before each test
      await db.open();
      // Clear all diffable tables
      for (const tableName of TABLES_TO_DIFF) {
        try {
          await db.table(tableName).clear();
        } catch {
          // Table might not exist
        }
      }
    });

    afterEach(async () => {
      // Clean up after each test
      for (const tableName of TABLES_TO_DIFF) {
        try {
          await db.table(tableName).clear();
        } catch {
          // Table might not exist
        }
      }
    });

    it('identifies records in current DB but not in backup', async () => {
      // Add records to current database
      await db.table('cpgVendors').bulkAdd([
        { id: 'v-1', name: 'Vendor One' },
        { id: 'v-2', name: 'Vendor Two' },
        { id: 'v-3', name: 'Vendor Three' },
      ]);

      // Backup only has v-1
      const backup: DatabaseExport = {
        version: 3,
        timestamp: Date.now(),
        tables: {
          cpgVendors: [{ id: 'v-1', name: 'Vendor One' }],
        },
      };

      const result = await computeMissingRecords(backup);

      // v-2 and v-3 should be missing
      expect(result.totalMissing).toBe(2);
      expect(result.byTable.cpgVendors).toBeDefined();
      expect(result.byTable.cpgVendors.total).toBe(2);
      expect(result.byTable.cpgVendors.shown).toHaveLength(2);

      const shownNames = result.byTable.cpgVendors.shown.map(r => r.displayText);
      expect(shownNames).toContain('Vendor Two');
      expect(shownNames).toContain('Vendor Three');
    });

    it('does NOT list records in backup but not in current DB', async () => {
      // Current DB has only v-1
      await db.table('cpgVendors').add({ id: 'v-1', name: 'Vendor One' });

      // Backup has v-1 AND v-2
      const backup: DatabaseExport = {
        version: 3,
        timestamp: Date.now(),
        tables: {
          cpgVendors: [
            { id: 'v-1', name: 'Vendor One' },
            { id: 'v-2', name: 'Vendor Two' }, // Extra in backup
          ],
        },
      };

      const result = await computeMissingRecords(backup);

      // Nothing missing - v-2 is extra in backup, but we only report
      // what's in current DB that would be LOST
      expect(result.totalMissing).toBe(0);
      expect(result.byTable.cpgVendors).toBeUndefined();
    });

    it('does NOT list records that exist in both DB and backup (same ID)', async () => {
      // Same record in both
      await db.table('cpgCategories').add({ id: 'cat-1', name: 'Category One' });

      const backup: DatabaseExport = {
        version: 3,
        timestamp: Date.now(),
        tables: {
          cpgCategories: [{ id: 'cat-1', name: 'Category One' }],
        },
      };

      const result = await computeMissingRecords(backup);

      expect(result.totalMissing).toBe(0);
      expect(result.byTable.cpgCategories).toBeUndefined();
    });

    it('handles empty backup table vs populated current table', async () => {
      // Current DB has records
      await db.table('products').bulkAdd([
        { id: 'p-1', name: 'Product A' },
        { id: 'p-2', name: 'Product B' },
      ]);

      // Backup has empty products table
      const backup: DatabaseExport = {
        version: 3,
        timestamp: Date.now(),
        tables: {
          products: [], // Empty
        },
      };

      const result = await computeMissingRecords(backup);

      expect(result.totalMissing).toBe(2);
      expect(result.byTable.products.total).toBe(2);
    });

    it('limits shown records to MAX_SHOWN_PER_TABLE (5) and shows "(and N more)"', async () => {
      // Add 8 records (more than MAX_SHOWN_PER_TABLE=5)
      const vendors = Array.from({ length: 8 }, (_, i) => ({
        id: `v-${i + 1}`,
        name: `Vendor ${i + 1}`,
      }));
      await db.table('cpgVendors').bulkAdd(vendors);

      // Empty backup
      const backup: DatabaseExport = {
        version: 3,
        timestamp: Date.now(),
        tables: {
          cpgVendors: [],
        },
      };

      const result = await computeMissingRecords(backup);

      expect(result.totalMissing).toBe(8);
      expect(result.byTable.cpgVendors.total).toBe(8);
      // Only 5 shown
      expect(result.byTable.cpgVendors.shown).toHaveLength(MAX_SHOWN_PER_TABLE);
      // Total includes all 8
      expect(result.byTable.cpgVendors.total).toBe(8);
      // The "(and N more)" text is rendered by the UI, but we verify
      // the data supports it: total > shown.length
      expect(result.byTable.cpgVendors.total - result.byTable.cpgVendors.shown.length).toBe(3);
    });

    it('filters by companyId when provided', async () => {
      // Add records for two companies
      await db.table('contacts').bulkAdd([
        { id: 'c-1', name: 'Contact A', company_id: 'company-1' },
        { id: 'c-2', name: 'Contact B', company_id: 'company-1' },
        { id: 'c-3', name: 'Contact C', company_id: 'company-2' },
      ]);

      // Backup has c-1 only
      const backup: DatabaseExport = {
        version: 3,
        timestamp: Date.now(),
        tables: {
          contacts: [{ id: 'c-1', name: 'Contact A', company_id: 'company-1' }],
        },
      };

      // Filter by company-1 only
      const result = await computeMissingRecords(backup, 'company-1');

      // Only c-2 is missing from company-1 (c-3 is company-2, ignored)
      expect(result.totalMissing).toBe(1);
      expect(result.byTable.contacts.shown[0].displayText).toBe('Contact B');
    });

    it('handles multiple tables with missing records', async () => {
      // Add records to multiple tables
      await db.table('cpgVendors').add({ id: 'v-1', name: 'Vendor X' });
      await db.table('cpgCategories').add({ id: 'cat-1', name: 'Category Y' });
      await db.table('products').add({ id: 'p-1', name: 'Product Z' });

      // Empty backup
      const backup: DatabaseExport = {
        version: 3,
        timestamp: Date.now(),
        tables: {},
      };

      const result = await computeMissingRecords(backup);

      expect(result.totalMissing).toBe(3);
      expect(Object.keys(result.byTable)).toHaveLength(3);
      expect(result.byTable.cpgVendors.shown[0].displayText).toBe('Vendor X');
      expect(result.byTable.cpgCategories.shown[0].displayText).toBe('Category Y');
      expect(result.byTable.products.shown[0].displayText).toBe('Product Z');
    });
  });
});
