/**
 * ONE-TIME SCRIPT: Generate V1-Derived Backup Fixture
 *
 * DO NOT RUN THIS SCRIPT AGAIN after the initial fixture was created.
 *
 * This script was used ONCE to capture a backup file using the v1-derived
 * key scheme (SHA-256 of "audacious-money-backup:${userId}:stable-v1")
 * BEFORE any migration changes were made.
 *
 * The fixture file is now committed as a static test artifact.
 * Running this script after migration would create a NEW backup that
 * doesn't represent legacy beta user backups.
 *
 * If you need to regenerate for any reason, you must:
 * 1. Checkout the commit BEFORE any migration changes
 * 2. Run this script
 * 3. Return to your working branch
 *
 * Usage (from project root):
 *   npx tsx scripts/generate-v1-backup-fixture.ts
 */

import {
  generateBackupBundle,
  type BackupData,
  type GenerateBackupBundleOptions,
} from '../src/services/backup/BackupEncryption';
import * as fs from 'fs';
import * as path from 'path';

// The userId used to create the fixture - DO NOT CHANGE
const FIXTURE_USER_ID = 'fixture-user-v1-derived-key-test';

async function deriveV1BackupPassword(userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`audacious-money-backup:${userId}:stable-v1`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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

async function main() {
  const fixtureDir = path.join(__dirname, '..', 'src', 'services', 'backup', '__fixtures__');
  const fixturePath = path.join(fixtureDir, 'v1-derived-backup.json');
  const fixtureMetaPath = path.join(fixtureDir, 'v1-derived-backup.meta.json');

  // Safety check - refuse to overwrite existing fixture
  if (fs.existsSync(fixturePath)) {
    console.error('ERROR: Fixture already exists at', fixturePath);
    console.error('This script should only be run ONCE before migration.');
    console.error('If you really need to regenerate, delete the fixture files first.');
    process.exit(1);
  }

  console.log('Generating v1-derived backup fixture...');
  console.log('User ID:', FIXTURE_USER_ID);

  const password = await deriveV1BackupPassword(FIXTURE_USER_ID);
  console.log('Derived password (first 16 chars):', password.substring(0, 16) + '...');

  const options: GenerateBackupBundleOptions = {
    companyId: 'fixture-company-v1',
    userId: FIXTURE_USER_ID,
    userRole: 'Admin',
    keyRotationEpoch: 1,
    password,
    data: FIXTURE_BACKUP_DATA,
  };

  const result = await generateBackupBundle(options);

  if (!result.success || !result.bundle) {
    console.error('ERROR: Bundle generation failed:', result.error);
    process.exit(1);
  }

  // Ensure fixture directory exists
  if (!fs.existsSync(fixtureDir)) {
    fs.mkdirSync(fixtureDir, { recursive: true });
  }

  // Save the fixture
  fs.writeFileSync(fixturePath, JSON.stringify(result.bundle, null, 2));

  // Save metadata
  const meta = {
    userId: FIXTURE_USER_ID,
    companyId: 'fixture-company-v1',
    createdAt: new Date().toISOString(),
    keyScheme: 'v1-derived',
    note: 'DO NOT MODIFY OR REGENERATE - represents legacy beta user backups',
    derivationPattern: 'SHA-256("audacious-money-backup:${userId}:stable-v1")',
    warning: 'This is a SYNTHETIC fixture. Real beta user backups should also be tested.',
  };
  fs.writeFileSync(fixtureMetaPath, JSON.stringify(meta, null, 2));

  console.log('');
  console.log('Fixture saved to:', fixturePath);
  console.log('Metadata saved to:', fixtureMetaPath);
  console.log('');
  console.log('DO NOT run this script again after migration changes.');
}

main().catch(console.error);
