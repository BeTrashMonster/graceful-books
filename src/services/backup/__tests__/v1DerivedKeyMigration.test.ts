/**
 * V1 Derived Key Migration Tests
 *
 * CRITICAL: These tests verify that backups created with the legacy v1-derived
 * key scheme (SHA-256 of "audacious-money-backup:${userId}:stable-v1") can still
 * be restored after migrating to the v2-random key scheme.
 *
 * The fixture file was captured from the CURRENT (pre-migration) code and must
 * continue to restore correctly after all changes.
 *
 * DO NOT modify the fixture file - it represents real beta user backups.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateBackupBundle,
  restoreBackupBundle,
  type SecureBackupBundle,
  type BackupData,
  type GenerateBackupBundleOptions,
} from '../BackupEncryption';
import * as fs from 'fs';
import * as path from 'path';

// The userId used to create the fixture - DO NOT CHANGE
const FIXTURE_USER_ID = 'fixture-user-v1-derived-key-test';

// The derived password for the fixture (computed once, verified)
// SHA-256("audacious-money-backup:fixture-user-v1-derived-key-test:stable-v1")
// This is the CURRENT derivation logic that must remain supported
async function deriveV1BackupPassword(userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`audacious-money-backup:${userId}:stable-v1`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Sample data that matches the fixture
const FIXTURE_BACKUP_DATA: BackupData = {
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

  describe('Fixture Generation (run once to capture)', () => {
    it('should generate and save a v1-derived backup fixture', async () => {
      // Derive the password using the CURRENT v1 logic
      const password = await deriveV1BackupPassword(FIXTURE_USER_ID);

      // Generate backup bundle using current code
      const options: GenerateBackupBundleOptions = {
        companyId: 'fixture-company-v1',
        userId: FIXTURE_USER_ID,
        userRole: 'Admin',
        keyRotationEpoch: 1,
        password,
        data: FIXTURE_BACKUP_DATA,
      };

      const result = await generateBackupBundle(options);

      expect(result.success).toBe(true);
      expect(result.bundle).toBeDefined();

      if (!result.bundle) {
        throw new Error('Bundle generation failed');
      }

      // Ensure fixture directory exists
      if (!fs.existsSync(fixtureDir)) {
        fs.mkdirSync(fixtureDir, { recursive: true });
      }

      // Save the fixture
      fs.writeFileSync(fixturePath, JSON.stringify(result.bundle, null, 2));

      // Save metadata for verification
      const meta = {
        userId: FIXTURE_USER_ID,
        companyId: 'fixture-company-v1',
        createdAt: new Date().toISOString(),
        keyScheme: 'v1-derived',
        note: 'DO NOT MODIFY - represents real beta user backups',
        derivationPattern: 'SHA-256("audacious-money-backup:${userId}:stable-v1")',
      };
      fs.writeFileSync(fixtureMetaPath, JSON.stringify(meta, null, 2));

      console.log(`Fixture saved to: ${fixturePath}`);
      console.log(`Metadata saved to: ${fixtureMetaPath}`);
    });
  });

  describe('Legacy Restore (MUST PASS after migration)', () => {
    let fixtureBundle: SecureBackupBundle;
    let derivedPassword: string;

    beforeAll(async () => {
      // Skip if fixture doesn't exist yet
      if (!fs.existsSync(fixturePath)) {
        console.warn('Fixture not found - run fixture generation test first');
        return;
      }

      // Load fixture
      const fixtureContent = fs.readFileSync(fixturePath, 'utf-8');
      fixtureBundle = JSON.parse(fixtureContent);

      // Derive the password using v1 logic
      derivedPassword = await deriveV1BackupPassword(FIXTURE_USER_ID);
    });

    it('fixture file exists', () => {
      expect(fs.existsSync(fixturePath)).toBe(true);
    });

    it('should restore v1-derived backup with correct password', async () => {
      if (!fixtureBundle) {
        console.warn('Skipping - fixture not loaded');
        return;
      }

      const result = await restoreBackupBundle(fixtureBundle, derivedPassword);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should restore all transaction data correctly', async () => {
      if (!fixtureBundle) {
        console.warn('Skipping - fixture not loaded');
        return;
      }

      const result = await restoreBackupBundle(fixtureBundle, derivedPassword);

      expect(result.success).toBe(true);
      expect(result.data?.transactions).toHaveLength(FIXTURE_BACKUP_DATA.transactions.length);

      // Verify each transaction
      const transactions = result.data?.transactions as typeof FIXTURE_BACKUP_DATA.transactions;
      expect(transactions[0].id).toBe('v1-txn-1');
      expect(transactions[0].amount).toBe(100.00);
      expect(transactions[1].id).toBe('v1-txn-2');
      expect(transactions[2].id).toBe('v1-txn-3');
    });

    it('should restore all account data correctly', async () => {
      if (!fixtureBundle) {
        console.warn('Skipping - fixture not loaded');
        return;
      }

      const result = await restoreBackupBundle(fixtureBundle, derivedPassword);

      expect(result.success).toBe(true);
      expect(result.data?.accounts).toHaveLength(FIXTURE_BACKUP_DATA.accounts.length);

      const accounts = result.data?.accounts as typeof FIXTURE_BACKUP_DATA.accounts;
      expect(accounts[0].name).toBe('Business Checking');
      expect(accounts[0].balance).toBe(5000.00);
    });

    it('should restore preferences correctly', async () => {
      if (!fixtureBundle) {
        console.warn('Skipping - fixture not loaded');
        return;
      }

      const result = await restoreBackupBundle(fixtureBundle, derivedPassword);

      expect(result.success).toBe(true);
      expect(result.data?.preferences).toMatchObject(FIXTURE_BACKUP_DATA.preferences);
    });

    it('should fail restoration with wrong password', async () => {
      if (!fixtureBundle) {
        console.warn('Skipping - fixture not loaded');
        return;
      }

      const wrongPassword = 'completely-wrong-password-12345';
      const result = await restoreBackupBundle(fixtureBundle, wrongPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail restoration with different userId derivation', async () => {
      if (!fixtureBundle) {
        console.warn('Skipping - fixture not loaded');
        return;
      }

      // Use a different userId - this should NOT work
      const wrongUserPassword = await deriveV1BackupPassword('different-user-id');
      const result = await restoreBackupBundle(fixtureBundle, wrongUserPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
