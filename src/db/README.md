# TreasureChest Database

The local-first database for Graceful Books, implementing zero-knowledge architecture with CRDT-compatible schema design for offline-first multi-device sync.

## Overview

TreasureChest is built on Dexie.js (IndexedDB wrapper) and provides:

- **Local-first storage**: All data stored locally in the browser
- **Offline-first**: Works without internet connection
- **CRDT support**: Conflict-free replicated data types for multi-device sync
- **Zero-knowledge ready**: Schema designed for field-level encryption
- **Audit trail**: Immutable audit logs for all financial changes

## Database Schema

### Core Entities

- **Accounts**: Chart of accounts with hierarchical structure
- **Transactions**: Journal entries with line items (double-entry accounting)
- **Contacts**: Customers and vendors
- **Products**: Product and service catalog
- **Users**: User profiles and preferences
- **Companies**: Company settings and configuration
- **Audit Logs**: Immutable audit trail

### Supporting Entities

- **Company Users**: User-company associations with roles
- **Sessions**: User authentication sessions
- **Devices**: Device registration for multi-device sync

## Usage

### Initialize Database

```typescript
import { initializeDatabase, db } from './db';

// Initialize on app startup
await initializeDatabase();
```

### Basic CRUD Operations

```typescript
import { db, createDefaultAccount } from './db';
import { v4 as uuidv4 } from 'uuid';

// Create
const account = {
  id: uuidv4(),
  ...createDefaultAccount(companyId, 'Cash', 'ASSET', deviceId),
};
await db.accounts.add(account);

// Read
const accounts = await db.accounts
  .where('company_id')
  .equals(companyId)
  .toArray();

// Update
await db.accounts.update(accountId, { name: 'Cash - Primary' });

// Soft Delete
await db.softDelete(db.accounts, accountId);

// Restore
await db.restore(db.accounts, accountId);

// Hard Delete (rarely used)
await db.accounts.delete(accountId);
```

### Query Active Records

```typescript
// Get all active accounts
const activeAccounts = await db.getActive(db.accounts);

// Filter active accounts by type
const activeAssets = await db.accounts
  .where('[company_id+type]')
  .equals([companyId, 'ASSET'])
  .filter(account => account.deleted_at === null)
  .toArray();
```

### Pagination

```typescript
const result = await db.paginate(
  db.accounts.where('company_id').equals(companyId),
  1, // page
  50  // pageSize
);

console.log(result.data); // Current page data
console.log(result.totalPages); // Total pages
```

### Batch Operations

```typescript
// Batch insert
await db.batchInsert(db.accounts, accountsArray);

// Batch update
await db.batchUpdate(db.accounts, accountsArray);
```

### Transactions

```typescript
await db.transaction('rw', [db.accounts, db.transactions], async () => {
  await db.accounts.add(account);
  await db.transactions.add(transaction);
});
```

## CRDT Support

### Version Vectors

Every entity has a `version_vector` field that tracks causality:

```typescript
{
  version_vector: {
    'device-1': 5,
    'device-2': 3,
  }
}
```

### Conflict Resolution

```typescript
import { resolveConflict, mergeEntities } from './db';

// Resolve conflict between local and remote versions
const winner = resolveConflict(localAccount, remoteAccount);
const merged = mergeEntities(winner, remoteAccount);

// Update database with merged entity
await db.accounts.put(merged);
```

### Detect Conflicts

```typescript
import { detectConflicts, resolveAllConflicts } from './db';

// Detect conflicts in entity list
const conflicts = detectConflicts(entities);

// Resolve all conflicts automatically
const resolved = resolveAllConflicts(entities);
```

### Device ID

```typescript
import { getDeviceId } from './db';

// Get or create device ID
const deviceId = getDeviceId();
```

## Schema Design Patterns

### CRDT-Compatible Fields

All entities include:

- `created_at`: Creation timestamp (ms)
- `updated_at`: Last update timestamp (ms) - used for Last-Write-Wins
- `deleted_at`: Deletion timestamp (ms) - null if not deleted (tombstone)
- `version_vector`: Causality tracking for conflict resolution

### Soft Deletes

Use `deleted_at` for soft deletes:

```typescript
// Soft delete
await db.accounts.update(id, { deleted_at: Date.now() });

// Query excludes soft-deleted by default
const active = await db.accounts
  .filter(a => a.deleted_at === null)
  .toArray();
```

### Encryption Markers

Schema comments indicate which fields should be encrypted:

- `// ENCRYPTED` - Field will be encrypted
- No marker - Field is plaintext (for querying)

Example:

```typescript
{
  name: string; // ENCRYPTED
  type: AccountType; // Plaintext for querying
}
```

## Standard Queries

### Accounts

```typescript
// Get all accounts for a company
const accounts = await db.accounts
  .where('company_id')
  .equals(companyId)
  .filter(a => a.deleted_at === null)
  .toArray();

// Get accounts by type
const assets = await db.accounts
  .where('[company_id+type]')
  .equals([companyId, 'ASSET'])
  .filter(a => a.deleted_at === null)
  .toArray();

// Get active accounts
const active = await db.accounts
  .where('[company_id+active]')
  .equals([companyId, true])
  .filter(a => a.deleted_at === null)
  .toArray();
```

### Transactions

```typescript
// Get transactions by status
const posted = await db.transactions
  .where('[company_id+status]')
  .equals([companyId, 'POSTED'])
  .filter(t => t.deleted_at === null)
  .toArray();

// Get transaction line items
const lineItems = await db.transactionLineItems
  .where('transaction_id')
  .equals(transactionId)
  .filter(li => li.deleted_at === null)
  .toArray();
```

### Audit Logs

```typescript
// Get audit logs for date range
const logs = await db.auditLogs
  .where('[company_id+timestamp]')
  .between([companyId, startTime], [companyId, endTime])
  .toArray();

// Get entity history
const history = await db.auditLogs
  .where('[entity_type+entity_id]')
  .equals(['ACCOUNT', accountId])
  .sortBy('timestamp');
```

## Maintenance

### Cleanup Expired Sessions

```typescript
// Clean up on startup
const cleaned = await db.cleanupExpiredSessions();
console.log(`Cleaned ${cleaned} expired sessions`);
```

### Cleanup Old Audit Logs

```typescript
// Clean up based on retention policy (e.g., 7 years)
const retentionDays = 2555; // ~7 years
const cleaned = await db.cleanupOldAuditLogs(retentionDays);
console.log(`Cleaned ${cleaned} old audit logs`);
```

### Backup and Restore

```typescript
// Export all data
const backup = await db.exportAllData();
const json = JSON.stringify(backup);
// Save to file or cloud storage

// Import data
const backup = JSON.parse(json);
await db.importAllData(backup);
```

### Database Statistics

```typescript
const stats = await db.getStatistics();
console.log(stats);
// {
//   accounts: 150,
//   transactions: 1200,
//   contacts: 45,
//   products: 30,
//   companies: 2,
//   auditLogs: 5000,
//   estimatedSizeBytes: 2048000
// }
```

## Best Practices

### 1. Always Use Transactions for Multi-Table Updates

```typescript
// Good
await db.transaction('rw', [db.transactions, db.transactionLineItems], async () => {
  await db.transactions.add(transaction);
  await db.transactionLineItems.bulkAdd(lineItems);
});

// Bad
await db.transactions.add(transaction);
await db.transactionLineItems.bulkAdd(lineItems); // Could fail, leaving orphans
```

### 2. Filter Soft Deletes in Queries

```typescript
// Good
const accounts = await db.accounts
  .where('company_id')
  .equals(companyId)
  .filter(a => a.deleted_at === null)
  .toArray();

// Bad (includes deleted records)
const accounts = await db.accounts
  .where('company_id')
  .equals(companyId)
  .toArray();
```

### 3. Update Version Vectors on Changes

```typescript
import { incrementVersionVector, getDeviceId } from './db';

const deviceId = getDeviceId();
const updated = {
  ...entity,
  updated_at: Date.now(),
  version_vector: incrementVersionVector(entity.version_vector, deviceId),
};
```

### 4. Validate Before Persisting

```typescript
import { validateAccount } from './db';

const errors = validateAccount(account);
if (errors.length > 0) {
  throw new Error(`Validation failed: ${errors.join(', ')}`);
}

await db.accounts.add(account);
```

### 5. Use Indexes for Performance

```typescript
// Good (uses compound index)
const accounts = await db.accounts
  .where('[company_id+type]')
  .equals([companyId, 'ASSET'])
  .toArray();

// Bad (full table scan)
const accounts = await db.accounts
  .filter(a => a.company_id === companyId && a.type === 'ASSET')
  .toArray();
```

## Testing

Example test setup:

```typescript
import { db, initializeDatabase, deleteDatabase } from './db';

beforeEach(async () => {
  await deleteDatabase();
  await initializeDatabase();
});

afterEach(async () => {
  await deleteDatabase();
});

test('creates account', async () => {
  const account = { /* ... */ };
  await db.accounts.add(account);

  const result = await db.accounts.get(account.id);
  expect(result).toEqual(account);
});
```

## Migration Strategy

When schema changes are needed:

```typescript
this.version(2).stores({
  accounts: '...updated schema...',
  // Add new tables
  newTable: 'id, field1, field2',
}).upgrade(async (trans) => {
  // Perform data migration
  const accounts = await trans.table('accounts').toArray();
  // Update data structure
  await trans.table('accounts').bulkPut(updatedAccounts);
});
```

## Joy Opportunity

When working on this database, remember: you're not just managing data, you're "organizing the treasure" for entrepreneurs who trust us with their financial records. Every query, every index, every backup matters.
