/**
 * V1 Derived Key Migration Tests
 *
 * CRITICAL: These tests verify that backups created with the legacy v1-derived
 * key scheme (SHA-256 of "audacious-money-backup:${userId}:stable-v1") can still
 * be restored after migrating to the v2-random key scheme.
 *
 * The fixture file was captured ONCE from the pre-migration code using:
 *   scripts/generate-v1-backup-fixture.ts
 *
 * DO NOT REGENERATE THE FIXTURE. It represents legacy beta user backups.
 * If you regenerate after migration, it will use NEW code and stop being
 * a valid legacy test.
 *
 * GAP: This fixture uses a synthetic userId. It proves the v1 derivation
 * scheme works, but not that real beta user files restore. Real backups
 * from actual beta users should also be tested before deployment.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  restoreBackupBundle,
  type SecureBackupBundle,
  type BackupData,
} from '../BackupEncryption';
import * as fs from 'fs';
import * as path from 'path';

// The userId used to create the fixture - DO NOT CHANGE
const FIXTURE_USER_ID = 'fixture-user-v1-derived-key-test';

/**
 * Derive the v1 backup password using the legacy scheme.
 * This is the EXACT logic that SmartAutoBackupService and useDataRecovery use.
 * After migration, this will be moved to legacyBackupKey.ts.
 */
async function deriveV1BackupPassword(userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`audacious-money-backup:${userId}:stable-v1`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Expected data that the fixture should restore to
const EXPECTED_BACKUP_DATA: BackupData = {
  transactions: [
    { id: 'v1-txn-1', amount: 100.00, description: 'Beta user transaction 1', date: '2026-01-15' },
    { id: 'v1-txn-2', amount: 250.50, description: 'Beta user transaction 2', date: '2026-01-16' },
    { id: 'v1-txn-3', amount: 75.25, description: 'Beta user transaction 3', date: '2026-01-17' },
  ],
  accounts: [
    { id: 'v1-acc-1', name: 'Business Checking', balance: 5000.00, type: 'asset' },
    { id: 'v1-acc-2', name: 'Business Savings', balance: 10000.00, type: 'asset' },
    { id: 'v1-acc-3', name: 'Credit Card', balance: -1500.00, type: 'liability' },
  ],
  reports: [
    { id: 'v1-rpt-1', name: 'Q1 2026 Report', generatedAt: '2026-01-20' },
  ],
  preferences: {
    theme: 'light',
    currency: 'USD',
    fiscalYearStart: 'january',
    autoBackupEnabled: true,
  },
};

describe('V1 Derived Key Migration', () => {
  const fixtureDir = path.join(__dirname, '..', '__fixtures__');
  const fixturePath = path.join(fixtureDir, 'v1-derived-backup.json');
  const fixtureMetaPath = path.join(fixtureDir, 'v1-derived-backup.meta.json');

  describe('Legacy Restore (MUST PASS after migration)', () => {
    let fixtureBundle: SecureBackupBundle;
    let derivedPassword: string;
    let fixtureExists: boolean;

    beforeAll(async () => {
      fixtureExists = fs.existsSync(fixturePath);

      if (!fixtureExists) {
        console.error('');
        console.error('═══════════════════════════════════════════════════════════');
        console.error('FATAL: v1-derived backup fixture not found!');
        console.error('');
        console.error('The fixture must exist BEFORE migration. It should have been');
        console.error('generated once using scripts/generate-v1-backup-fixture.ts');
        console.error('and committed as a static file.');
        console.error('');
        console.error('Expected at:', fixturePath);
        console.error('═══════════════════════════════════════════════════════════');
        console.error('');
        return;
      }

      // Load fixture (READ-ONLY - never write)
      const fixtureContent = fs.readFileSync(fixturePath, 'utf-8');
      fixtureBundle = JSON.parse(fixtureContent);

      // Derive the password using v1 logic
      derivedPassword = await deriveV1BackupPassword(FIXTURE_USER_ID);
    });

    it('fixture file exists and is not regenerated', () => {
      expect(fixtureExists).toBe(true);

      // Verify metadata exists and has the warning
      expect(fs.existsSync(fixtureMetaPath)).toBe(true);
      const meta = JSON.parse(fs.readFileSync(fixtureMetaPath, 'utf-8'));
      expect(meta.keyScheme).toBe('v1-derived');
      expect(meta.userId).toBe(FIXTURE_USER_ID);
    });

    it('should restore v1-derived backup with correct password', async () => {
      expect(fixtureExists).toBe(true);

      const result = await restoreBackupBundle(fixtureBundle, derivedPassword);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should restore all transaction data correctly', async () => {
      expect(fixtureExists).toBe(true);

      const result = await restoreBackupBundle(fixtureBundle, derivedPassword);

      expect(result.success).toBe(true);
      expect(result.data?.transactions).toHaveLength(EXPECTED_BACKUP_DATA.transactions.length);

      // Verify each transaction
      const transactions = result.data?.transactions as typeof EXPECTED_BACKUP_DATA.transactions;
      expect(transactions[0].id).toBe('v1-txn-1');
      expect(transactions[0].amount).toBe(100.00);
      expect(transactions[1].id).toBe('v1-txn-2');
      expect(transactions[2].id).toBe('v1-txn-3');
    });

    it('should restore all account data correctly', async () => {
      expect(fixtureExists).toBe(true);

      const result = await restoreBackupBundle(fixtureBundle, derivedPassword);

      expect(result.success).toBe(true);
      expect(result.data?.accounts).toHaveLength(EXPECTED_BACKUP_DATA.accounts.length);

      const accounts = result.data?.accounts as typeof EXPECTED_BACKUP_DATA.accounts;
      expect(accounts[0].name).toBe('Business Checking');
      expect(accounts[0].balance).toBe(5000.00);
    });

    it('should restore preferences correctly', async () => {
      expect(fixtureExists).toBe(true);

      const result = await restoreBackupBundle(fixtureBundle, derivedPassword);

      expect(result.success).toBe(true);
      expect(result.data?.preferences).toMatchObject(EXPECTED_BACKUP_DATA.preferences);
    });

    it('should fail restoration with wrong password', async () => {
      expect(fixtureExists).toBe(true);

      const wrongPassword = 'completely-wrong-password-12345';
      const result = await restoreBackupBundle(fixtureBundle, wrongPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail restoration with different userId derivation', async () => {
      expect(fixtureExists).toBe(true);

      // Use a different userId - this should NOT work
      const wrongUserPassword = await deriveV1BackupPassword('different-user-id');
      const result = await restoreBackupBundle(fixtureBundle, wrongUserPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
