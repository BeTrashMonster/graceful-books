/**
 * Backup Completeness Test
 *
 * CRITICAL: This test verifies that exportAllData actually captures ALL data
 * from the database. It seeds every table with test data and verifies the
 * export contains the correct count for each table.
 *
 * This catches bugs where:
 * - A table is missed in the export
 * - A table's data is partially exported
 * - The count in the export doesn't match the actual data
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, BACKUP_EXCLUDED_TABLES } from './database';
import type { DatabaseExport } from './database';

describe('Backup Completeness', () => {
  // Track what we seed so we can verify counts
  const seededCounts: Record<string, number> = {};

  beforeAll(async () => {
    // Open the database
    await db.open();
  });

  afterAll(async () => {
    // Clean up seeded test data
    for (const tableName of Object.keys(seededCounts)) {
      try {
        const table = db.table(tableName);
        // Delete records we created (those with id starting with 'test-backup-')
        await table.where('id').startsWith('test-backup-').delete();
      } catch {
        // Table might not have 'id' field or might use different key
      }
    }
  });

  it('should export every non-excluded table with correct counts', async () => {
    const allTableNames = db.tables.map((t) => t.name);
    const excludedTableNames = Object.keys(BACKUP_EXCLUDED_TABLES);

    // Seed each non-excluded table with at least one record
    for (const tableName of allTableNames) {
      if (excludedTableNames.includes(tableName)) {
        continue; // Skip excluded tables
      }

      try {
        const table = db.table(tableName);

        // Create a minimal test record
        // We use a unique ID prefix so we can clean up later
        const testRecord = createTestRecord(tableName);
        if (testRecord) {
          await table.add(testRecord);
          seededCounts[tableName] = 1;
        }
      } catch (err) {
        // Some tables may have constraints that prevent simple inserts
        // That's OK - we'll still verify they appear in the export
        console.warn(`Could not seed table ${tableName}:`, err);
      }
    }

    // Run the export
    const exportData = await db.exportAllData();

    // Verify every non-excluded table appears in the export
    const missingTables: string[] = [];
    const emptyTables: string[] = [];
    const countMismatches: { table: string; expected: number; actual: number }[] = [];

    for (const tableName of allTableNames) {
      if (excludedTableNames.includes(tableName)) {
        // Excluded tables should NOT be in the export
        if (exportData.tables && exportData.tables[tableName]) {
          console.warn(`Excluded table ${tableName} appears in export (unexpected)`);
        }
        continue;
      }

      // Check if table exists in export
      if (!exportData.tables || !exportData.tables[tableName]) {
        missingTables.push(tableName);
        continue;
      }

      const exportedData = exportData.tables[tableName];
      if (!Array.isArray(exportedData)) {
        missingTables.push(`${tableName} (not an array)`);
        continue;
      }

      // Get actual count from database
      const actualCount = await db.table(tableName).count();
      const exportedCount = exportedData.length;

      if (exportedCount !== actualCount) {
        countMismatches.push({
          table: tableName,
          expected: actualCount,
          actual: exportedCount,
        });
      }
    }

    // Report failures
    if (missingTables.length > 0) {
      console.error('Missing tables in export:', missingTables);
    }
    if (countMismatches.length > 0) {
      console.error('Count mismatches:', countMismatches);
    }

    expect(missingTables, `Tables missing from export: ${missingTables.join(', ')}`).toEqual([]);
    expect(countMismatches, `Count mismatches in export`).toEqual([]);
  });

  it('should include CPG tables specifically', async () => {
    // These are the tables the user specifically mentioned needing
    const criticalCpgTables = [
      'cpgCategories',
      'cpgInvoices',        // Raw material purchases
      'cpgVendors',
      'cpgFinishedProducts',
      'cpgRecipes',
      'cpgEvents',          // Events
      'cpgDistributors',    // Distribution data
      'cpgDistributionCalculations',
      'cpgSalesPromos',
      'cpgProductLinks',
      'cpgSettings',
      'cpgLaborRoles',
      'cpgProductLabors',
      'cpgUnitConversions',
    ];

    const exportData = await db.exportAllData();

    const missingCpgTables: string[] = [];
    for (const tableName of criticalCpgTables) {
      // Check if table exists in database
      const tableExists = db.tables.some((t) => t.name === tableName);
      if (!tableExists) {
        continue; // Table doesn't exist in schema, skip
      }

      // Check if it's in the export
      if (!exportData.tables || !exportData.tables[tableName]) {
        missingCpgTables.push(tableName);
      }
    }

    expect(
      missingCpgTables,
      `Critical CPG tables missing from export: ${missingCpgTables.join(', ')}`
    ).toEqual([]);
  });

  it('should verify export totalRecords matches sum of all tables', async () => {
    const exportData = await db.exportAllData();

    if (!exportData.tables) {
      throw new Error('Export has no tables property');
    }

    let calculatedTotal = 0;
    for (const tableName of Object.keys(exportData.tables)) {
      const tableData = exportData.tables[tableName];
      if (Array.isArray(tableData)) {
        calculatedTotal += tableData.length;
      }
    }

    expect(exportData.totalRecords).toBe(calculatedTotal);
  });
});

/**
 * Create a minimal test record for a given table.
 * Returns null if we don't know how to create a record for this table.
 */
function createTestRecord(tableName: string): Record<string, unknown> | null {
  const timestamp = Date.now();
  const baseRecord = {
    id: `test-backup-${tableName}-${timestamp}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // Table-specific records with required fields
  switch (tableName) {
    case 'accounts':
      return {
        ...baseRecord,
        name: 'Test Account',
        type: 'asset',
        code: '9999',
        companyId: 'test-company',
        isActive: true,
        balance: 0,
      };
    case 'transactions':
      return {
        ...baseRecord,
        date: new Date().toISOString().split('T')[0],
        description: 'Test Transaction',
        companyId: 'test-company',
        status: 'draft',
        type: 'expense',
      };
    case 'contacts':
      return {
        ...baseRecord,
        name: 'Test Contact',
        type: 'customer',
        companyId: 'test-company',
        isActive: true,
      };
    case 'products':
      return {
        ...baseRecord,
        name: 'Test Product',
        companyId: 'test-company',
        isActive: true,
      };
    case 'companies':
      return {
        ...baseRecord,
        name: 'Test Company',
      };
    case 'users':
      return {
        ...baseRecord,
        email: `test-${timestamp}@example.com`,
        role: 'user',
      };
    case 'cpgCategories':
      return {
        ...baseRecord,
        name: 'Test CPG Category',
        type: 'raw_material',
        companyId: 'test-company',
      };
    case 'cpgVendors':
      return {
        ...baseRecord,
        name: 'Test CPG Vendor',
        companyId: 'test-company',
      };
    case 'cpgInvoices':
      return {
        ...baseRecord,
        vendorId: 'test-vendor',
        date: new Date().toISOString().split('T')[0],
        companyId: 'test-company',
        total: 0,
        status: 'draft',
      };
    case 'cpgFinishedProducts':
      return {
        ...baseRecord,
        name: 'Test Finished Product',
        companyId: 'test-company',
      };
    case 'cpgRecipes':
      return {
        ...baseRecord,
        name: 'Test Recipe',
        productId: 'test-product',
        companyId: 'test-company',
      };
    case 'cpgEvents':
      return {
        ...baseRecord,
        name: 'Test Event',
        date: new Date().toISOString().split('T')[0],
        companyId: 'test-company',
      };
    case 'cpgDistributors':
      return {
        ...baseRecord,
        name: 'Test Distributor',
        companyId: 'test-company',
      };
    case 'cpgDistributionCalculations':
      return {
        ...baseRecord,
        distributorId: 'test-distributor',
        companyId: 'test-company',
      };
    default:
      // For unknown tables, try a generic record
      return baseRecord;
  }
}

/**
 * Live database comparison - run this to check actual data
 */
describe('Live Database Export Check', () => {
  it('should report counts for all tables in current database', async () => {
    await db.open();

    const allTableNames = db.tables.map((t) => t.name);
    const excludedTableNames = Object.keys(BACKUP_EXCLUDED_TABLES);

    // Get current counts from database
    const dbCounts: Record<string, number> = {};
    for (const tableName of allTableNames) {
      try {
        const count = await db.table(tableName).count();
        dbCounts[tableName] = count;
      } catch {
        dbCounts[tableName] = -1; // Error counting
      }
    }

    // Run export
    const exportData = await db.exportAllData();

    // Compare
    const report: {
      table: string;
      dbCount: number;
      exportCount: number;
      status: 'OK' | 'MISMATCH' | 'MISSING' | 'EXCLUDED';
    }[] = [];

    for (const tableName of allTableNames) {
      const dbCount = dbCounts[tableName];

      if (excludedTableNames.includes(tableName)) {
        report.push({
          table: tableName,
          dbCount,
          exportCount: 0,
          status: 'EXCLUDED',
        });
        continue;
      }

      const exportCount = exportData.tables?.[tableName]?.length ?? -1;

      if (exportCount === -1) {
        report.push({
          table: tableName,
          dbCount,
          exportCount: 0,
          status: 'MISSING',
        });
      } else if (exportCount !== dbCount) {
        report.push({
          table: tableName,
          dbCount,
          exportCount,
          status: 'MISMATCH',
        });
      } else {
        report.push({
          table: tableName,
          dbCount,
          exportCount,
          status: 'OK',
        });
      }
    }

    // Output report
    console.log('\n=== BACKUP EXPORT COMPLETENESS REPORT ===\n');

    // Group by status
    const missing = report.filter((r) => r.status === 'MISSING');
    const mismatches = report.filter((r) => r.status === 'MISMATCH');
    const excluded = report.filter((r) => r.status === 'EXCLUDED');
    const ok = report.filter((r) => r.status === 'OK');

    if (missing.length > 0) {
      console.log('MISSING FROM EXPORT:');
      for (const r of missing) {
        console.log(`  - ${r.table}: ${r.dbCount} records in DB, NOT in export`);
      }
      console.log('');
    }

    if (mismatches.length > 0) {
      console.log('COUNT MISMATCHES:');
      for (const r of mismatches) {
        console.log(`  - ${r.table}: DB=${r.dbCount}, Export=${r.exportCount}`);
      }
      console.log('');
    }

    console.log(`EXCLUDED (intentionally): ${excluded.length} tables`);
    console.log(`OK: ${ok.length} tables`);
    console.log(`Total tables: ${report.length}`);
    console.log('');

    // CPG-specific report
    const cpgTables = report.filter((r) => r.table.startsWith('cpg'));
    console.log('=== CPG TABLES ===');
    for (const r of cpgTables) {
      const statusIcon = r.status === 'OK' ? '✓' : r.status === 'EXCLUDED' ? '-' : '✗';
      console.log(`  ${statusIcon} ${r.table}: DB=${r.dbCount}, Export=${r.exportCount} [${r.status}]`);
    }
    console.log('');

    // Totals
    const totalDbRecords = Object.values(dbCounts).reduce((a, b) => a + (b > 0 ? b : 0), 0);
    const totalExportRecords = exportData.totalRecords ?? 0;
    console.log(`Total DB records: ${totalDbRecords}`);
    console.log(`Total Export records: ${totalExportRecords}`);
    console.log('');

    // Assert no missing or mismatched tables
    expect(missing, 'Tables missing from export').toEqual([]);
    expect(mismatches, 'Tables with count mismatches').toEqual([]);
  });
});
