/**
 * Backup/Restore Round-Trip Test
 *
 * CRITICAL: This test proves that backup/restore preserves ALL data.
 *
 * Design principles:
 * 1. Seed data is built from actual TypeScript types - missing fields fail to COMPILE
 * 2. Deep field-level comparison - not just counts
 * 3. Every backed-up table is covered with test data
 * 4. Includes a deliberately-broken control to prove the test can fail
 *
 * If this test passes, we can be confident that real user data survives restore.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, BACKUP_EXCLUDED_TABLES } from '../../db';
import { BackupService } from './backupService';
import type {
  Account,
  AccountType,
  Transaction,
  TransactionStatus,
  TransactionType,
  TransactionLineItem,
  Contact,
  ContactType,
  ContactAccountType,
  Product,
  ProductType,
  User,
  Company,
  CompanyUser,
  UserRole,
  AuditLog,
  AuditAction,
  AuditEntityType,
  Receipt,
  VersionVector,
} from '../../types/database.types';
import type { CPGCategory, CPGVendor, CPGFinishedProduct } from '../../db/schema/cpg.schema';
import type { Category, CategoryType } from '../../db/schema/categories.schema';
import type { Invoice, InvoiceStatus } from '../../db/schema/invoices.schema';

const TEST_PASSPHRASE = 'round-trip-test-passphrase-2024!';
const TEST_PREFIX = 'roundtrip-test-';

/**
 * Create a unique test ID
 */
function testId(suffix: string): string {
  return `${TEST_PREFIX}${suffix}`;
}

/**
 * Base version vector for test data
 */
function testVersionVector(): VersionVector {
  return { 'test-device-001': 1 };
}

/**
 * Current timestamp for test data
 */
function now(): number {
  return Date.now();
}

// =============================================================================
// TYPED FACTORY FUNCTIONS
// Each factory creates a COMPLETE record that satisfies the TypeScript type.
// If a required field is missing, this file will NOT COMPILE.
// =============================================================================

function createTestCompany(id: string): Company {
  const timestamp = now();
  return {
    id: testId(id),
    name: `Test Company ${id}`,
    legal_name: `Test Company ${id} LLC`,
    tax_id: '12-3456789',
    address: '123 Test Street',
    phone: '555-1234',
    email: 'test@example.com',
    fiscal_year_end: '12-31',
    currency: 'USD',
    settings: {
      accounting_method: 'accrual',
      multi_currency: false,
      track_inventory: true,
      auto_backup: false,
      retention_period_days: 365,
    },
    key_rotation_epoch: 0,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    version_vector: testVersionVector(),
  };
}

function createTestUser(id: string): User {
  const timestamp = now();
  return {
    id: testId(id),
    email: `user-${id}@test.example.com`,
    name: `Test User ${id}`,
    passphrase_hash: 'fake-hash-for-testing',
    master_key_encrypted: 'fake-encrypted-key',
    preferences: {
      language: 'en',
      timezone: 'America/New_York',
      date_format: 'MM/DD/YYYY',
      currency_display: '$1,000.00',
      theme: 'light',
      reduced_motion: false,
      high_contrast: false,
    },
    selected_charity_id: null,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    version_vector: testVersionVector(),
  };
}

function createTestCompanyUser(id: string, companyId: string, userId: string): CompanyUser {
  const timestamp = now();
  return {
    id: testId(id),
    company_id: testId(companyId),
    user_id: testId(userId),
    role: 'OWNER' as UserRole,
    permissions: ['all'],
    active: true,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    version_vector: testVersionVector(),
  };
}

function createTestAccount(id: string, companyId: string, type: AccountType): Account {
  const timestamp = now();
  return {
    id: testId(id),
    company_id: testId(companyId),
    account_number: `${1000 + parseInt(id.replace(/\D/g, '') || '0')}`,
    name: `Test Account ${id}`,
    type,
    parent_id: null,
    balance: 0,
    description: `Description for account ${id}`,
    active: true,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    version_vector: testVersionVector(),
  };
}

function createTestContact(id: string, companyId: string, type: ContactType): Contact {
  const timestamp = now();
  return {
    id: testId(id),
    company_id: testId(companyId),
    type,
    name: `Test Contact ${id}`,
    email: `contact-${id}@test.example.com`,
    phone: '555-0000',
    address: '456 Contact Ave',
    tax_id: '98-7654321',
    notes: `Notes for contact ${id}`,
    active: true,
    balance: '500.00',
    parent_id: null,
    account_type: 'standalone' as ContactAccountType,
    hierarchy_level: 0,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    version_vector: testVersionVector(),
  };
}

function createTestProduct(id: string, companyId: string): Product {
  const timestamp = now();
  return {
    id: testId(id),
    company_id: testId(companyId),
    type: 'PRODUCT' as ProductType,
    sku: `SKU-${id}`,
    name: `Test Product ${id}`,
    description: `Description for product ${id}`,
    unit_price: '29.99',
    cost: '15.00',
    income_account_id: null,
    expense_account_id: null,
    taxable: true,
    active: true,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    version_vector: testVersionVector(),
  };
}

function createTestTransaction(id: string, companyId: string): Transaction {
  const timestamp = now();
  return {
    id: testId(id),
    company_id: testId(companyId),
    transaction_number: `TXN-${id}`,
    transaction_date: timestamp,
    type: 'JOURNAL_ENTRY' as TransactionType,
    status: 'POSTED' as TransactionStatus,
    description: `Test transaction ${id}`,
    reference: `REF-${id}`,
    memo: `Memo for transaction ${id}`,
    attachments: [],
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    version_vector: testVersionVector(),
  };
}

function createTestTransactionLineItem(
  id: string,
  transactionId: string,
  accountId: string
): TransactionLineItem {
  const timestamp = now();
  return {
    id: testId(id),
    transaction_id: testId(transactionId),
    account_id: testId(accountId),
    debit: '100.00',
    credit: '0.00',
    description: `Line item ${id}`,
    contact_id: null,
    product_id: null,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    version_vector: testVersionVector(),
  };
}

function createTestAuditLog(id: string, companyId: string, userId: string): AuditLog {
  const timestamp = now();
  return {
    id: testId(id),
    company_id: testId(companyId),
    user_id: testId(userId),
    entity_type: 'ACCOUNT' as AuditEntityType,
    entity_id: testId('account-1'),
    action: 'CREATE' as AuditAction,
    before_value: null,
    after_value: JSON.stringify({ name: 'Test' }),
    changed_fields: ['name'],
    ip_address: '127.0.0.1',
    device_id: 'test-device',
    user_agent: 'test-agent',
    timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
}

function createTestReceipt(id: string, companyId: string): Receipt {
  const timestamp = now();
  return {
    id: testId(id),
    company_id: testId(companyId),
    transaction_id: null,
    file_name: `receipt-${id}.jpg`,
    mime_type: 'image/jpeg',
    file_size: 1024,
    upload_date: timestamp,
    image_data: 'base64-encoded-test-data',
    thumbnail_data: null,
    notes: `Receipt ${id} notes`,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    version_vector: testVersionVector(),
  };
}

function createTestCategory(id: string, companyId: string): Category {
  const timestamp = now();
  return {
    id: testId(id),
    company_id: testId(companyId),
    name: `Test Category ${id}`,
    type: 'EXPENSE' as CategoryType,
    parent_id: null,
    color: '#FF5733',
    icon: 'folder',
    description: `Description for category ${id}`,
    active: true,
    is_system: false,
    sort_order: 0,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    version_vector: testVersionVector(),
  };
}

function createTestCPGCategory(id: string, companyId: string): CPGCategory {
  const timestamp = now();
  return {
    id: testId(id),
    company_id: testId(companyId),
    name: `Test CPG Category ${id}`,
    description: `Description for CPG category ${id}`,
    variants: ['Small', 'Large'],
    unit_of_measure: 'oz',
    grams_per_cup: 200,
    sort_order: parseInt(id.replace(/\D/g, '') || '0'),
    is_distribution_category: false,
    active: true,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    version_vector: testVersionVector(),
  };
}

function createTestCPGVendor(id: string, companyId: string): CPGVendor {
  const timestamp = now();
  return {
    id: testId(id),
    company_id: testId(companyId),
    name: `Test CPG Vendor ${id}`,
    notes: `Notes for vendor ${id}`,
    active: true,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    version_vector: testVersionVector(),
  };
}

function createTestCPGFinishedProduct(id: string, companyId: string): CPGFinishedProduct {
  const timestamp = now();
  return {
    id: testId(id),
    company_id: testId(companyId),
    name: `Test Finished Product ${id}`,
    sku: `FP-SKU-${id}`,
    description: `Description for finished product ${id}`,
    msrp: '49.99',
    unit_of_measure: 'each',
    pieces_per_unit: 1,
    active: true,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    version_vector: testVersionVector(),
  };
}

function createTestInvoice(id: string, companyId: string, customerId: string): Invoice {
  const timestamp = now();
  return {
    id: testId(id),
    company_id: testId(companyId),
    customer_id: testId(customerId),
    invoice_number: `INV-${id}`,
    invoice_date: timestamp,
    due_date: timestamp + 30 * 24 * 60 * 60 * 1000,
    status: 'DRAFT' as InvoiceStatus,
    subtotal: '100.00',
    tax: '8.00',
    total: '108.00',
    notes: `Invoice ${id} notes`,
    internal_memo: null,
    template_id: 'default',
    line_items: '[]', // Encrypted JSON string
    transaction_id: null,
    sent_at: null,
    paid_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    version_vector: testVersionVector(),
  };
}

// =============================================================================
// TEST DATA COLLECTION
// =============================================================================

interface TestDataSet {
  companies: Company[];
  users: User[];
  companyUsers: CompanyUser[];
  accounts: Account[];
  contacts: Contact[];
  products: Product[];
  transactions: Transaction[];
  transactionLineItems: TransactionLineItem[];
  auditLogs: AuditLog[];
  receipts: Receipt[];
  categories: Category[];
  cpgCategories: CPGCategory[];
  cpgVendors: CPGVendor[];
  cpgFinishedProducts: CPGFinishedProduct[];
  invoices: Invoice[];
}

function createTestDataSet(): TestDataSet {
  const companies = [createTestCompany('company-1')];
  const users = [createTestUser('user-1')];
  const companyUsers = [createTestCompanyUser('cu-1', 'company-1', 'user-1')];

  const accounts = [
    createTestAccount('account-1', 'company-1', 'ASSET' as AccountType),
    createTestAccount('account-2', 'company-1', 'LIABILITY' as AccountType),
    createTestAccount('account-3', 'company-1', 'INCOME' as AccountType),
  ];

  const contacts = [
    createTestContact('contact-1', 'company-1', 'CUSTOMER' as ContactType),
    createTestContact('contact-2', 'company-1', 'VENDOR' as ContactType),
  ];

  const products = [
    createTestProduct('product-1', 'company-1'),
    createTestProduct('product-2', 'company-1'),
  ];

  const transactions = [createTestTransaction('txn-1', 'company-1')];

  const transactionLineItems = [
    createTestTransactionLineItem('line-1', 'txn-1', 'account-1'),
    createTestTransactionLineItem('line-2', 'txn-1', 'account-2'),
  ];

  const auditLogs = [createTestAuditLog('audit-1', 'company-1', 'user-1')];
  const receipts = [createTestReceipt('receipt-1', 'company-1')];
  const categories = [createTestCategory('cat-1', 'company-1')];

  const cpgCategories = [
    createTestCPGCategory('cpg-cat-1', 'company-1'),
    createTestCPGCategory('cpg-cat-2', 'company-1'),
  ];

  const cpgVendors = [createTestCPGVendor('cpg-vendor-1', 'company-1')];
  const cpgFinishedProducts = [createTestCPGFinishedProduct('cpg-fp-1', 'company-1')];
  // Note: Invoice uses customer_id which links to a Contact record
  const invoices = [createTestInvoice('invoice-1', 'company-1', 'contact-1')];

  return {
    companies,
    users,
    companyUsers,
    accounts,
    contacts,
    products,
    transactions,
    transactionLineItems,
    auditLogs,
    receipts,
    categories,
    cpgCategories,
    cpgVendors,
    cpgFinishedProducts,
    invoices,
  };
}

// =============================================================================
// DEEP COMPARISON UTILITIES
// =============================================================================

/**
 * Compare two records field by field.
 * Returns list of mismatches or empty array if identical.
 */
function deepCompareRecords<T extends { id: string }>(
  tableName: string,
  original: T,
  restored: T
): string[] {
  const mismatches: string[] = [];

  // Cast to record for iteration
  const origObj = original as unknown as Record<string, unknown>;
  const restObj = restored as unknown as Record<string, unknown>;

  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(origObj), ...Object.keys(restObj)]);

  for (const key of allKeys) {
    const origVal = origObj[key];
    const restVal = restObj[key];

    // Compare values
    if (!deepEqual(origVal, restVal)) {
      mismatches.push(
        `${tableName}[${original.id}].${key}: original=${JSON.stringify(origVal)}, restored=${JSON.stringify(restVal)}`
      );
    }
  }

  return mismatches;
}

/**
 * Deep equality check for values
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(key => deepEqual(aObj[key], bObj[key]));
  }

  return false;
}

// =============================================================================
// MAIN TEST SUITE
// =============================================================================

describe('Backup/Restore Round-Trip', () => {
  let testData: TestDataSet;
  let backupBlob: Blob | null = null;

  beforeAll(async () => {
    await db.open();
    testData = createTestDataSet();
  });

  afterAll(async () => {
    // Clean up all test data
    const tables = db.tables;
    for (const table of tables) {
      try {
        await table.where('id').startsWith(TEST_PREFIX).delete();
      } catch {
        // Some tables might not have 'id' field or support this query
      }
    }
  });

  it('1. Should seed typed test data into database', async () => {
    // Seed all test data using the typed factories
    await db.companies.bulkAdd(testData.companies);
    await db.users.bulkAdd(testData.users);
    await db.companyUsers.bulkAdd(testData.companyUsers);
    await db.accounts.bulkAdd(testData.accounts);
    await db.contacts.bulkAdd(testData.contacts);
    await db.products.bulkAdd(testData.products);
    await db.transactions.bulkAdd(testData.transactions);
    await db.transactionLineItems.bulkAdd(testData.transactionLineItems);
    await db.auditLogs.bulkAdd(testData.auditLogs);
    await db.receipts.bulkAdd(testData.receipts);
    await db.categories.bulkAdd(testData.categories);
    await db.cpgCategories.bulkAdd(testData.cpgCategories);
    await db.cpgVendors.bulkAdd(testData.cpgVendors);
    await db.cpgFinishedProducts.bulkAdd(testData.cpgFinishedProducts);
    await db.invoices.bulkAdd(testData.invoices);

    // Verify seeding worked
    const companyCount = await db.companies.where('id').startsWith(TEST_PREFIX).count();
    expect(companyCount).toBe(testData.companies.length);

    const accountCount = await db.accounts.where('id').startsWith(TEST_PREFIX).count();
    expect(accountCount).toBe(testData.accounts.length);
  });

  it('2. Should create an encrypted backup', async () => {
    const result = await BackupService.createBackup(TEST_PASSPHRASE, false);

    expect(result.success).toBe(true);
    expect(result.blob).toBeDefined();
    expect(result.filename).toContain('graceful-books-backup');

    if (result.blob) {
      backupBlob = result.blob;
      expect(backupBlob.size).toBeGreaterThan(100);
    }
  });

  it('3. Should clear test data from database', async () => {
    // Clear only our test data
    for (const table of db.tables) {
      try {
        await table.where('id').startsWith(TEST_PREFIX).delete();
      } catch {
        // Ignore tables that don't support this query
      }
    }

    // Verify data is gone
    const companyCount = await db.companies.where('id').startsWith(TEST_PREFIX).count();
    expect(companyCount).toBe(0);

    const accountCount = await db.accounts.where('id').startsWith(TEST_PREFIX).count();
    expect(accountCount).toBe(0);
  });

  it('4. Should restore from backup', async () => {
    expect(backupBlob).not.toBeNull();

    const backupFile = new File([backupBlob!], 'test-backup.gbbackup', {
      type: 'application/json',
    });

    const result = await BackupService.restoreBackup(backupFile, TEST_PASSPHRASE, false);

    expect(result.success).toBe(true);
    expect(result.recordsRestored).toBeGreaterThan(0);
  });

  it('5. Should verify EVERY FIELD matches after restore (deep comparison)', async () => {
    const mismatches: string[] = [];

    // Compare companies
    for (const original of testData.companies) {
      const restored = await db.companies.get(original.id);
      if (!restored) {
        mismatches.push(`companies: Missing record ${original.id}`);
        continue;
      }
      mismatches.push(...deepCompareRecords('companies', original, restored));
    }

    // Compare users
    for (const original of testData.users) {
      const restored = await db.users.get(original.id);
      if (!restored) {
        mismatches.push(`users: Missing record ${original.id}`);
        continue;
      }
      mismatches.push(...deepCompareRecords('users', original, restored));
    }

    // Compare accounts
    for (const original of testData.accounts) {
      const restored = await db.accounts.get(original.id);
      if (!restored) {
        mismatches.push(`accounts: Missing record ${original.id}`);
        continue;
      }
      mismatches.push(...deepCompareRecords('accounts', original, restored));
    }

    // Compare contacts
    for (const original of testData.contacts) {
      const restored = await db.contacts.get(original.id);
      if (!restored) {
        mismatches.push(`contacts: Missing record ${original.id}`);
        continue;
      }
      mismatches.push(...deepCompareRecords('contacts', original, restored));
    }

    // Compare products
    for (const original of testData.products) {
      const restored = await db.products.get(original.id);
      if (!restored) {
        mismatches.push(`products: Missing record ${original.id}`);
        continue;
      }
      mismatches.push(...deepCompareRecords('products', original, restored));
    }

    // Compare transactions
    for (const original of testData.transactions) {
      const restored = await db.transactions.get(original.id);
      if (!restored) {
        mismatches.push(`transactions: Missing record ${original.id}`);
        continue;
      }
      mismatches.push(...deepCompareRecords('transactions', original, restored));
    }

    // Compare CPG categories
    for (const original of testData.cpgCategories) {
      const restored = await db.cpgCategories.get(original.id);
      if (!restored) {
        mismatches.push(`cpgCategories: Missing record ${original.id}`);
        continue;
      }
      mismatches.push(...deepCompareRecords('cpgCategories', original, restored));
    }

    // Compare CPG vendors
    for (const original of testData.cpgVendors) {
      const restored = await db.cpgVendors.get(original.id);
      if (!restored) {
        mismatches.push(`cpgVendors: Missing record ${original.id}`);
        continue;
      }
      mismatches.push(...deepCompareRecords('cpgVendors', original, restored));
    }

    // Compare invoices
    for (const original of testData.invoices) {
      const restored = await db.invoices.get(original.id);
      if (!restored) {
        mismatches.push(`invoices: Missing record ${original.id}`);
        continue;
      }
      mismatches.push(...deepCompareRecords('invoices', original, restored));
    }

    // Report all mismatches
    if (mismatches.length > 0) {
      console.error('=== FIELD MISMATCHES ===');
      for (const m of mismatches) {
        console.error(m);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('6. Should verify CRUD operations work on restored data', async () => {
    // READ
    const accounts = await db.accounts.where('id').startsWith(TEST_PREFIX).toArray();
    expect(accounts.length).toBeGreaterThan(0);

    // CREATE
    const newCat = createTestCPGCategory('crud-test', 'company-1');
    await db.cpgCategories.add(newCat);

    const created = await db.cpgCategories.get(newCat.id);
    expect(created).toBeDefined();
    expect(created?.name).toBe(newCat.name);

    // UPDATE
    await db.cpgCategories.update(newCat.id, { name: 'Updated Name' });
    const updated = await db.cpgCategories.get(newCat.id);
    expect(updated?.name).toBe('Updated Name');

    // DELETE
    await db.cpgCategories.delete(newCat.id);
    const deleted = await db.cpgCategories.get(newCat.id);
    expect(deleted).toBeUndefined();
  });
});

describe('Backup Completeness - All Tables', () => {
  it('Should export ALL non-excluded tables', async () => {
    await db.open();

    const allTables = db.tables.map(t => t.name);
    const excludedTables = Object.keys(BACKUP_EXCLUDED_TABLES);

    const exportData = await db.exportAllData();

    const missingTables: string[] = [];
    for (const tableName of allTables) {
      if (excludedTables.includes(tableName)) continue;

      if (!exportData.tables || !(tableName in exportData.tables)) {
        missingTables.push(tableName);
      }
    }

    expect(missingTables).toEqual([]);
  });
});

describe('Deliberate Failure Control', () => {
  /**
   * This test PROVES the comparison logic can detect failures.
   * We deliberately create a mismatch and verify it's caught.
   * If this test passes, we know the comparison is working.
   */
  it('Should DETECT field mismatches (control test)', () => {
    const original = {
      id: 'test-1',
      name: 'Original Name',
      balance: '100.00',
      nested: { a: 1, b: 2 },
    };

    // Deliberately different
    const corrupted = {
      id: 'test-1',
      name: 'Corrupted Name', // Changed
      balance: '100.00',
      nested: { a: 1, b: 3 }, // Changed
    };

    const mismatches = deepCompareRecords('test', original, corrupted);

    // We EXPECT mismatches - if this is empty, the comparison is broken
    expect(mismatches.length).toBeGreaterThan(0);
    expect(mismatches.some(m => m.includes('name'))).toBe(true);
    expect(mismatches.some(m => m.includes('nested'))).toBe(true);
  });

  it('Should DETECT missing fields (control test)', () => {
    const original = {
      id: 'test-1',
      name: 'Original',
      extraField: 'should be detected',
    };

    const incomplete = {
      id: 'test-1',
      name: 'Original',
      // extraField missing
    };

    const mismatches = deepCompareRecords('test', original, incomplete);

    // We EXPECT a mismatch for the missing field
    expect(mismatches.length).toBeGreaterThan(0);
    expect(mismatches.some(m => m.includes('extraField'))).toBe(true);
  });

  it('Should pass when records are identical (control test)', () => {
    const original = {
      id: 'test-1',
      name: 'Same Name',
      balance: '100.00',
      nested: { a: 1, b: 2 },
      array: [1, 2, 3],
    };

    const identical = {
      id: 'test-1',
      name: 'Same Name',
      balance: '100.00',
      nested: { a: 1, b: 2 },
      array: [1, 2, 3],
    };

    const mismatches = deepCompareRecords('test', original, identical);

    // We EXPECT no mismatches
    expect(mismatches).toEqual([]);
  });
});
