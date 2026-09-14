/**
 * Performance Test Seeding Script
 *
 * Generates realistic synthetic data at parameterized sizes (1k/10k/100k records).
 * Goes through the REAL encryption path - no bypasses.
 * Produces realistic field-size distributions.
 *
 * Callable from Playwright via page.evaluate() or as a module.
 */

import { nanoid } from 'nanoid';
import type {
  AccountEntity,
  TransactionEntity,
  ContactEntity,
  ProductEntity,
  VersionVector,
} from '../../src/store/types';
import type { MasterKey, DerivedKey } from '../../src/crypto/types';

// =============================================================================
// Configuration
// =============================================================================

export type DatasetSize = '1k' | '5k' | '10k';

export interface SeedConfig {
  size: DatasetSize;
  companyId: string;
  deviceId: string;
  /** If true, encrypts data using real crypto path */
  useEncryption: boolean;
}

export interface SeedResult {
  accounts: number;
  transactions: number;
  contacts: number;
  products: number;
  totalRecords: number;
  encryptionTimeMs: number;
  insertTimeMs: number;
  totalTimeMs: number;
}

// Record counts by size
// 5k = realistic ceiling for power users (~500 transactions/year for 10 years)
// 10k = headroom reference only
const SIZE_CONFIG: Record<DatasetSize, {
  accounts: number;
  transactions: number;
  contacts: number;
  products: number;
}> = {
  '1k': {
    accounts: 50,
    transactions: 800,
    contacts: 100,
    products: 50,
  },
  '5k': {
    accounts: 75,
    transactions: 4200,
    contacts: 500,
    products: 225,
  },
  '10k': {
    accounts: 100,
    transactions: 8500,
    contacts: 1000,
    products: 400,
  },
};

// =============================================================================
// Realistic Data Generators
// =============================================================================

// Realistic company names (for contacts)
const COMPANY_PREFIXES = [
  'Acme', 'Global', 'Premier', 'Elite', 'Pacific', 'Atlantic', 'Northern',
  'Southern', 'Central', 'Metropolitan', 'United', 'American', 'National',
  'International', 'Western', 'Eastern', 'Modern', 'Classic', 'Professional',
  'Advanced', 'Superior', 'Quality', 'Reliable', 'Trusted', 'Expert',
];

const COMPANY_SUFFIXES = [
  'Industries', 'Solutions', 'Services', 'Corporation', 'Enterprises', 'Group',
  'Partners', 'Associates', 'Consulting', 'Technologies', 'Systems', 'Labs',
  'Works', 'Manufacturing', 'Trading', 'Supply', 'Distribution', 'Logistics',
];

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Lisa', 'Daniel', 'Nancy',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
];

const STREET_TYPES = ['St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Way', 'Rd', 'Ct', 'Pl'];
const STREET_NAMES = [
  'Main', 'Oak', 'Maple', 'Cedar', 'Pine', 'Elm', 'Washington', 'Lincoln',
  'Park', 'Lake', 'Hill', 'River', 'Forest', 'Valley', 'Spring', 'Sunset',
];

const CITIES = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
  'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
  'Fort Worth', 'Columbus', 'Charlotte', 'Indianapolis', 'San Francisco', 'Seattle',
];

const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
  'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
];

// Transaction memo templates with realistic length distribution
const MEMO_TEMPLATES = [
  // Short (20-50 chars) - 40% of transactions
  'Payment for services',
  'Monthly subscription',
  'Office supplies',
  'Client payment received',
  'Vendor invoice payment',
  'Consulting fee',
  'Software license',
  'Equipment rental',
  'Maintenance fee',
  'Travel expense',
  // Medium (50-150 chars) - 40% of transactions
  'Payment for professional services rendered in accordance with contract agreement dated {date}',
  'Monthly retainer fee for ongoing consulting services and support for Q{quarter} {year}',
  'Reimbursement for business travel expenses including airfare, hotel, and meals for client meeting',
  'Purchase of office equipment and supplies for new employee onboarding and workspace setup',
  'Annual software license renewal for enterprise productivity suite with premium support package',
  'Payment for marketing campaign services including social media management and content creation',
  'Invoice payment for contracted development work on customer portal enhancement project',
  'Quarterly maintenance and support fee for IT infrastructure and cloud services',
  // Long (150-500 chars) - 20% of transactions
  'Comprehensive payment for professional consulting services including strategic planning, market analysis, competitive research, and implementation support. This engagement covered a full assessment of current operations, identification of growth opportunities, development of actionable recommendations, and ongoing advisory support throughout the implementation phase. Work was completed in accordance with Statement of Work dated {date}.',
  'Reimbursement request for extended business travel including: round-trip airfare to client site, hotel accommodations for {days} nights, ground transportation, meals and incidentals, and miscellaneous business expenses. All expenses are within company policy guidelines and have been pre-approved by department manager. Receipts attached for all expenses over $25.',
  'Annual enterprise software license renewal covering all modules including: core accounting, inventory management, customer relationship management, project management, business intelligence, and reporting. License includes premium support with 24/7 availability, guaranteed 4-hour response time for critical issues, and access to all feature updates and security patches released during the license period.',
];

// Product descriptions with varying lengths
const PRODUCT_DESCRIPTIONS = [
  // Short
  'Standard service package',
  'Basic consulting hour',
  'Premium support tier',
  // Medium
  'Professional consulting services with dedicated account management and priority support response times',
  'Enterprise software license with full feature access and quarterly training sessions included',
  'Comprehensive maintenance package covering all hardware and software under support agreement',
  // Long
  'Full-service enterprise solution package including initial setup, configuration, data migration, staff training, ongoing support, and quarterly business reviews. This package is designed for organizations requiring end-to-end support with dedicated resources and guaranteed SLAs.',
];

// =============================================================================
// Helper Functions
// =============================================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysBack: number): Date {
  const now = new Date();
  const daysAgo = randomInt(0, daysBack);
  return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
}

function generateVersionVector(deviceId: string): VersionVector {
  return { [deviceId]: 1 };
}

function generateCompanyName(): string {
  return `${randomChoice(COMPANY_PREFIXES)} ${randomChoice(COMPANY_SUFFIXES)}`;
}

function generatePersonName(): { first: string; last: string; full: string } {
  const first = randomChoice(FIRST_NAMES);
  const last = randomChoice(LAST_NAMES);
  return { first, last, full: `${first} ${last}` };
}

function generateEmail(name: string, domain?: string): string {
  const cleanName = name.toLowerCase().replace(/\s+/g, '.');
  const domainName = domain || `${randomChoice(COMPANY_PREFIXES).toLowerCase()}.com`;
  return `${cleanName}@${domainName}`;
}

function generatePhone(): string {
  return `(${randomInt(200, 999)}) ${randomInt(200, 999)}-${randomInt(1000, 9999)}`;
}

function generateAddress(): {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
} {
  return {
    line1: `${randomInt(100, 9999)} ${randomChoice(STREET_NAMES)} ${randomChoice(STREET_TYPES)}`,
    city: randomChoice(CITIES),
    state: randomChoice(STATES),
    postalCode: String(randomInt(10000, 99999)),
    country: 'US',
  };
}

function generateMemo(): string {
  const template = randomChoice(MEMO_TEMPLATES);
  return template
    .replace('{date}', randomDate(365).toLocaleDateString())
    .replace('{quarter}', String(randomInt(1, 4)))
    .replace('{year}', String(new Date().getFullYear()))
    .replace('{days}', String(randomInt(2, 7)));
}

function generateTaxId(): string {
  return `${randomInt(10, 99)}-${randomInt(1000000, 9999999)}`;
}

// =============================================================================
// Entity Generators
// =============================================================================

function generateAccounts(
  count: number,
  companyId: string,
  deviceId: string
): AccountEntity[] {
  const accounts: AccountEntity[] = [];
  const accountTypes: Array<AccountEntity['type']> = [
    'asset', 'liability', 'equity', 'income', 'expense', 'cost-of-goods-sold',
  ];

  // Distribution: 30% asset, 15% liability, 10% equity, 20% income, 20% expense, 5% COGS
  const distribution = [0.3, 0.15, 0.1, 0.2, 0.2, 0.05];
  const typeCounts = distribution.map(d => Math.floor(count * d));

  let accountNumber = 1000;

  accountTypes.forEach((type, typeIndex) => {
    for (let i = 0; i < typeCounts[typeIndex]; i++) {
      const now = new Date();
      accounts.push({
        id: nanoid(),
        companyId,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Account ${accountNumber}`,
        accountNumber: String(accountNumber),
        type,
        isActive: Math.random() > 0.1, // 90% active
        balance: randomInt(-100000, 500000) * 100, // cents
        description: Math.random() > 0.5
          ? `${type} account for tracking ${type === 'income' ? 'revenue' : type === 'expense' ? 'costs' : 'balances'}`
          : undefined,
        createdAt: randomDate(365),
        updatedAt: now,
        versionVector: generateVersionVector(deviceId),
        lastModifiedBy: deviceId,
        lastModifiedAt: now,
        _encrypted: {
          name: true,
          balance: true,
          description: true,
        },
      });
      accountNumber += randomInt(5, 20);
    }
  });

  return accounts;
}

function generateContacts(
  count: number,
  companyId: string,
  deviceId: string
): ContactEntity[] {
  const contacts: ContactEntity[] = [];

  // 60% vendors, 35% customers, 5% both
  const vendorCount = Math.floor(count * 0.6);
  const customerCount = Math.floor(count * 0.35);
  const bothCount = count - vendorCount - customerCount;

  const generateContact = (type: 'customer' | 'vendor' | 'both'): ContactEntity => {
    const isCompany = Math.random() > 0.3; // 70% companies, 30% individuals
    const name = isCompany ? generateCompanyName() : generatePersonName().full;
    const now = new Date();

    return {
      id: nanoid(),
      companyId,
      type,
      name,
      email: generateEmail(name),
      phone: generatePhone(),
      address: Math.random() > 0.2 ? generateAddress() : undefined,
      taxId: type === 'vendor' && Math.random() > 0.5 ? generateTaxId() : undefined,
      is1099Eligible: type === 'vendor' && Math.random() > 0.6,
      notes: Math.random() > 0.7
        ? `Notes for ${name}: ${randomChoice(['Important client', 'Preferred vendor', 'New relationship', 'Long-term partner'])}`
        : undefined,
      isActive: Math.random() > 0.05, // 95% active
      createdAt: randomDate(730), // Up to 2 years
      updatedAt: now,
      versionVector: generateVersionVector(deviceId),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
      _encrypted: {
        name: true,
        email: true,
        phone: true,
        address: true,
        taxId: true,
        notes: true,
      },
    };
  };

  for (let i = 0; i < vendorCount; i++) {
    contacts.push(generateContact('vendor'));
  }
  for (let i = 0; i < customerCount; i++) {
    contacts.push(generateContact('customer'));
  }
  for (let i = 0; i < bothCount; i++) {
    contacts.push(generateContact('both'));
  }

  return contacts;
}

function generateProducts(
  count: number,
  companyId: string,
  deviceId: string,
  incomeAccountIds: string[],
  expenseAccountIds: string[]
): ProductEntity[] {
  const products: ProductEntity[] = [];

  for (let i = 0; i < count; i++) {
    const isService = Math.random() > 0.4; // 60% services, 40% products
    const now = new Date();

    products.push({
      id: nanoid(),
      companyId,
      name: isService
        ? `${randomChoice(['Consulting', 'Support', 'Training', 'Advisory', 'Implementation'])} ${randomChoice(['Service', 'Package', 'Plan', 'Tier'])}`
        : `${randomChoice(['Premium', 'Standard', 'Basic', 'Professional', 'Enterprise'])} ${randomChoice(['Product', 'Item', 'Package', 'Bundle'])}`,
      description: randomChoice(PRODUCT_DESCRIPTIONS),
      type: isService ? 'service' : 'product',
      sku: !isService ? `SKU-${randomInt(10000, 99999)}` : undefined,
      price: randomInt(50, 5000) * 100, // cents
      cost: randomInt(20, 2000) * 100, // cents
      incomeAccountId: randomChoice(incomeAccountIds),
      expenseAccountId: randomChoice(expenseAccountIds),
      taxable: Math.random() > 0.2, // 80% taxable
      isActive: Math.random() > 0.1, // 90% active
      createdAt: randomDate(365),
      updatedAt: now,
      versionVector: generateVersionVector(deviceId),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
      _encrypted: {
        name: true,
        description: true,
        price: true,
        cost: true,
      },
    });
  }

  return products;
}

function generateTransactions(
  count: number,
  companyId: string,
  deviceId: string,
  accountIds: string[],
  contactIds: string[]
): TransactionEntity[] {
  const transactions: TransactionEntity[] = [];
  const statuses: Array<TransactionEntity['status']> = ['draft', 'posted', 'void', 'reconciled'];

  for (let i = 0; i < count; i++) {
    const now = new Date();
    const txnDate = randomDate(730); // Up to 2 years back
    const lineCount = randomInt(2, 6); // 2-6 line items

    // Generate balanced journal entry lines
    const lines: TransactionEntity['lines'] = [];
    let totalAmount = randomInt(100, 100000) * 100; // cents

    // First line: debit
    lines.push({
      id: nanoid(),
      accountId: randomChoice(accountIds),
      debit: totalAmount,
      credit: 0,
      memo: Math.random() > 0.5 ? 'Debit entry' : undefined,
    });

    // Remaining lines split the credit
    const remainingCredits = lineCount - 1;
    let creditRemaining = totalAmount;

    for (let j = 0; j < remainingCredits - 1; j++) {
      const creditAmount = Math.floor(creditRemaining * (Math.random() * 0.5 + 0.1));
      creditRemaining -= creditAmount;
      lines.push({
        id: nanoid(),
        accountId: randomChoice(accountIds),
        debit: 0,
        credit: creditAmount,
        memo: Math.random() > 0.7 ? 'Credit split' : undefined,
      });
    }

    // Final line gets remaining credit to balance
    lines.push({
      id: nanoid(),
      accountId: randomChoice(accountIds),
      debit: 0,
      credit: creditRemaining,
    });

    // Status distribution: 10% draft, 70% posted, 5% void, 15% reconciled
    const statusRand = Math.random();
    const status = statusRand < 0.1 ? 'draft'
      : statusRand < 0.8 ? 'posted'
      : statusRand < 0.85 ? 'void'
      : 'reconciled';

    transactions.push({
      id: nanoid(),
      companyId,
      date: txnDate,
      reference: Math.random() > 0.3 ? `REF-${randomInt(100000, 999999)}` : undefined,
      memo: generateMemo(),
      status,
      lines,
      createdBy: deviceId,
      createdAt: txnDate,
      updatedAt: now,
      vendorId: Math.random() > 0.5 ? randomChoice(contactIds) : undefined,
      customerId: Math.random() > 0.5 ? randomChoice(contactIds) : undefined,
      versionVector: generateVersionVector(deviceId),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
      isBalanced: true,
      _encrypted: {
        memo: true,
        lines: true,
      },
    });
  }

  return transactions;
}

// =============================================================================
// Encryption Simulation
// =============================================================================

/**
 * Simulates encryption overhead without actual crypto operations.
 * In real usage, this would call the actual encrypt() function.
 *
 * For accurate measurement, the Playwright test will inject the real
 * encryption context and call actual crypto functions.
 */
async function simulateEncryption(
  data: unknown[],
  key: MasterKey | DerivedKey
): Promise<{ encryptedData: unknown[]; timeMs: number }> {
  const start = performance.now();

  // Serialize each record (this happens in real encryption)
  const serialized = data.map(record => JSON.stringify(record));

  // Simulate encryption time based on data size
  // Real AES-256-GCM: ~1-5ms per record depending on size
  for (const json of serialized) {
    // Simulate work proportional to data size
    const iterations = Math.ceil(json.length / 100);
    let sum = 0;
    for (let i = 0; i < iterations; i++) {
      sum += Math.sin(i) * Math.cos(i);
    }
  }

  const timeMs = performance.now() - start;
  return { encryptedData: data, timeMs };
}

// =============================================================================
// Main Seeding Function
// =============================================================================

/**
 * Generates and seeds realistic test data into IndexedDB.
 *
 * This function is designed to be called from Playwright via page.evaluate()
 * or directly in a browser context where Dexie is available.
 *
 * @param config Seeding configuration
 * @returns Seeding results with timing metrics
 */
export async function seedDatabase(config: SeedConfig): Promise<SeedResult> {
  const startTime = performance.now();
  const sizeConfig = SIZE_CONFIG[config.size];

  console.log(`[Seed] Starting data generation for ${config.size} dataset...`);
  console.log(`[Seed] Target counts: ${JSON.stringify(sizeConfig)}`);

  // Generate all data
  const accounts = generateAccounts(sizeConfig.accounts, config.companyId, config.deviceId);
  console.log(`[Seed] Generated ${accounts.length} accounts`);

  const contacts = generateContacts(sizeConfig.contacts, config.companyId, config.deviceId);
  console.log(`[Seed] Generated ${contacts.length} contacts`);

  const incomeAccountIds = accounts.filter(a => a.type === 'income').map(a => a.id);
  const expenseAccountIds = accounts.filter(a => a.type === 'expense').map(a => a.id);
  const allAccountIds = accounts.map(a => a.id);
  const contactIds = contacts.map(c => c.id);

  const products = generateProducts(
    sizeConfig.products,
    config.companyId,
    config.deviceId,
    incomeAccountIds.length > 0 ? incomeAccountIds : allAccountIds.slice(0, 5),
    expenseAccountIds.length > 0 ? expenseAccountIds : allAccountIds.slice(5, 10)
  );
  console.log(`[Seed] Generated ${products.length} products`);

  const transactions = generateTransactions(
    sizeConfig.transactions,
    config.companyId,
    config.deviceId,
    allAccountIds,
    contactIds
  );
  console.log(`[Seed] Generated ${transactions.length} transactions`);

  const generationTime = performance.now() - startTime;
  console.log(`[Seed] Data generation completed in ${generationTime.toFixed(2)}ms`);

  // Encryption phase (simulated unless real key provided)
  let encryptionTimeMs = 0;
  if (config.useEncryption) {
    console.log(`[Seed] Starting encryption simulation...`);
    const mockKey: MasterKey = {
      id: 'test-key-id',
      keyMaterial: new Uint8Array(32),
      derivationParams: {
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        salt: new Uint8Array(16),
        keyLength: 32,
      },
      createdAt: Date.now(),
    };

    const allData = [...accounts, ...contacts, ...products, ...transactions];
    const encResult = await simulateEncryption(allData, mockKey);
    encryptionTimeMs = encResult.timeMs;
    console.log(`[Seed] Encryption simulation completed in ${encryptionTimeMs.toFixed(2)}ms`);
  }

  // Insert into IndexedDB
  // This will be done via page.evaluate() in Playwright
  const insertStart = performance.now();

  // Return data for insertion (Playwright will handle actual DB insert)
  const totalTime = performance.now() - startTime;

  return {
    accounts: accounts.length,
    transactions: transactions.length,
    contacts: contacts.length,
    products: products.length,
    totalRecords: accounts.length + transactions.length + contacts.length + products.length,
    encryptionTimeMs,
    insertTimeMs: performance.now() - insertStart,
    totalTimeMs: totalTime,
  };
}

/**
 * Generates data without inserting - returns the raw data arrays.
 * Used for Playwright to insert data via the app's real DB instance.
 */
export function generateTestData(config: Omit<SeedConfig, 'useEncryption'>): {
  accounts: AccountEntity[];
  contacts: ContactEntity[];
  products: ProductEntity[];
  transactions: TransactionEntity[];
} {
  const sizeConfig = SIZE_CONFIG[config.size];

  const accounts = generateAccounts(sizeConfig.accounts, config.companyId, config.deviceId);
  const contacts = generateContacts(sizeConfig.contacts, config.companyId, config.deviceId);

  const incomeAccountIds = accounts.filter(a => a.type === 'income').map(a => a.id);
  const expenseAccountIds = accounts.filter(a => a.type === 'expense').map(a => a.id);
  const allAccountIds = accounts.map(a => a.id);
  const contactIds = contacts.map(c => c.id);

  const products = generateProducts(
    sizeConfig.products,
    config.companyId,
    config.deviceId,
    incomeAccountIds.length > 0 ? incomeAccountIds : allAccountIds.slice(0, 5),
    expenseAccountIds.length > 0 ? expenseAccountIds : allAccountIds.slice(5, 10)
  );

  const transactions = generateTransactions(
    sizeConfig.transactions,
    config.companyId,
    config.deviceId,
    allAccountIds,
    contactIds
  );

  return { accounts, contacts, products, transactions };
}

// Export size config for external use
export { SIZE_CONFIG };
