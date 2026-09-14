/**
 * Backup Export Coverage Test
 *
 * CRITICAL: This test ensures that every database table is either:
 * 1. Exported in backups, OR
 * 2. Explicitly excluded in BACKUP_EXCLUDED_TABLES with a documented reason
 *
 * If this test fails, a new table was added without deciding whether it should
 * be included in backups. This prevents silent data loss from incomplete backups.
 *
 * To fix a failing test:
 * 1. If the table should be backed up: No action needed, it's automatically included
 * 2. If the table should NOT be backed up: Add it to BACKUP_EXCLUDED_TABLES with a reason
 */

import { describe, it, expect } from 'vitest';
import { db, BACKUP_EXCLUDED_TABLES } from './database';

describe('Backup Export Coverage', () => {
  it('every table must be exported OR explicitly excluded', () => {
    // Get all table names from the database schema
    const allTableNames = db.tables.map((t) => t.name);

    // Get the list of excluded tables
    const excludedTableNames = Object.keys(BACKUP_EXCLUDED_TABLES);

    // Every table should either be NOT excluded (will be exported)
    // OR should be in the excluded list with a reason
    const uncoveredTables: string[] = [];

    for (const tableName of allTableNames) {
      const isExcluded = BACKUP_EXCLUDED_TABLES[tableName] !== undefined;
      // If it's not excluded, it will be exported - that's fine
      // If it IS excluded, verify it has a non-empty reason
      if (isExcluded) {
        const reason = BACKUP_EXCLUDED_TABLES[tableName];
        if (!reason || reason.trim().length === 0) {
          uncoveredTables.push(`${tableName} (excluded but no reason provided)`);
        }
      }
      // Non-excluded tables are automatically exported by exportAllData()
    }

    // This should always pass unless someone adds a table to BACKUP_EXCLUDED_TABLES
    // without a reason
    expect(uncoveredTables).toEqual([]);
  });

  it('BACKUP_EXCLUDED_TABLES should only contain tables that exist', () => {
    const allTableNames = new Set(db.tables.map((t) => t.name));
    const excludedTableNames = Object.keys(BACKUP_EXCLUDED_TABLES);

    const phantomExclusions: string[] = [];

    for (const excludedName of excludedTableNames) {
      if (!allTableNames.has(excludedName)) {
        phantomExclusions.push(excludedName);
      }
    }

    // If this fails, BACKUP_EXCLUDED_TABLES contains tables that no longer exist
    // Clean up the stale entries
    expect(
      phantomExclusions,
      `BACKUP_EXCLUDED_TABLES contains non-existent tables: ${phantomExclusions.join(', ')}`
    ).toEqual([]);
  });

  it('exportAllData should export all non-excluded tables', async () => {
    // Get the list of tables that would be exported
    const exportedTableNames = db.getExportedTableNames();
    const excludedTableNames = Object.keys(BACKUP_EXCLUDED_TABLES);
    const allTableNames = db.getAllTableNames();

    // Every table should be in exactly one of these sets
    for (const tableName of allTableNames) {
      const isExported = exportedTableNames.includes(tableName);
      const isExcluded = excludedTableNames.includes(tableName);

      // Table should be in exactly one category
      expect(
        isExported !== isExcluded,
        `Table "${tableName}" should be either exported OR excluded, not both or neither`
      ).toBe(true);
    }

    // Verify counts add up
    expect(exportedTableNames.length + excludedTableNames.length).toBe(allTableNames.length);
  });

  it('excluded tables should have meaningful reasons', () => {
    const exclusions = db.getExcludedTablesWithReasons();

    for (const [tableName, reason] of Object.entries(exclusions)) {
      // Reason should be at least 10 characters to be meaningful
      expect(
        reason.length,
        `Exclusion reason for "${tableName}" is too short: "${reason}"`
      ).toBeGreaterThanOrEqual(10);

      // Reason should explain WHY the table is excluded
      const hasExplanation =
        reason.includes(':') || // Common format: "Category: explanation"
        reason.includes('because') ||
        reason.includes('would') ||
        reason.includes('can be') ||
        reason.includes('not') ||
        reason.includes('external') ||
        reason.includes('ephemeral') ||
        reason.includes('transient');

      expect(
        hasExplanation,
        `Exclusion reason for "${tableName}" should explain why: "${reason}"`
      ).toBe(true);
    }
  });

  it('should report accurate table counts', () => {
    const allTables = db.getAllTableNames();
    const exportedTables = db.getExportedTableNames();
    const excludedTables = Object.keys(BACKUP_EXCLUDED_TABLES);

    // Log for visibility in test output
    console.log(`Total tables: ${allTables.length}`);
    console.log(`Exported tables: ${exportedTables.length}`);
    console.log(`Excluded tables: ${excludedTables.length}`);

    // Sanity checks
    expect(allTables.length).toBeGreaterThan(0);
    expect(exportedTables.length).toBeGreaterThan(0);
    expect(excludedTables.length).toBeGreaterThan(0);

    // Verify no overlap
    const overlap = exportedTables.filter((t) => excludedTables.includes(t));
    expect(overlap, `These tables appear in both exported and excluded: ${overlap.join(', ')}`).toEqual([]);
  });
});
