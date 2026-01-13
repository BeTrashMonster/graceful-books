# Local-First Data Store

A comprehensive local-first data store implementation for Graceful Books using IndexedDB and Dexie.js.

## Overview

This data store implements the A3: Local-First Data Store specification from the OpenSpec. It provides:

- **Offline-First Architecture**: All operations work offline by default using IndexedDB
- **CRDT Support**: Conflict-free Replicated Data Types for multi-device sync
- **Encryption Integration**: Integration points for field-level encryption
- **Double-Entry Accounting**: Transaction validation ensuring debits = credits
- **Audit Logging**: Immutable audit trail for all data changes
- **Batch Operations**: Efficient bulk operations with transaction support

## Architecture

### Database Layer (`database.ts`)

The main database class extending Dexie.js with:

- 7 tables: accounts, transactions, contacts, products, users, auditLogs, companies
- Compound indexes for optimized queries
- Schema versioning for future migrations
- Utility methods for stats, export/import

### Data Access Layers

Each entity type has a dedicated data access module:

- **`accounts.ts`**: Chart of Accounts with hierarchical support
- **`transactions.ts`**: Journal entries with balance validation
- **`contacts.ts`**: Customers and vendors
- **`products.ts`**: Products and services with SKU management
- **`users.ts`**: User profiles with authentication support
- **`auditLogs.ts`**: Immutable audit trail

### CRDT Operations (`crdt.ts`)

Implements conflict-free replicated data types:

- Version vector comparison
- Last-write-wins merge strategy
- Tombstone handling for soft deletes
- Conflict detection and resolution
- Sync priority calculation

### Batch Operations (`batch.ts`)

Provides efficient bulk operations:

- Atomic transactions across multiple tables
- Batch inserts with rollback on error
- Sync operations with conflict resolution
- Import/export for backup and migration

## Usage Examples

### Initialize Database

```typescript
import { initializeDatabase, db } from './store'

// Initialize at app startup
await initializeDatabase()
```

### Create Entities

```typescript
import { createAccount, createTransaction } from './store'

// Create an account
const result = await createAccount({
  companyId: 'company-123',
  name: 'Cash',
  type: 'asset',
  isActive: true,
})

if (result.success) {
  console.log('Account created:', result.data)
} else {
  console.error('Error:', result.error)
}

// Create a transaction
const txnResult = await createTransaction({
  companyId: 'company-123',
  date: new Date(),
  status: 'draft',
  createdBy: 'user-123',
  lines: [
    { id: 'line-1', accountId: 'acc-1', debit: 100, credit: 0 },
    { id: 'line-2', accountId: 'acc-2', debit: 0, credit: 100 },
  ],
})
```

### Query Entities

```typescript
import { queryAccounts, queryTransactions } from './store'

// Query active accounts
const accounts = await queryAccounts({
  companyId: 'company-123',
  type: 'asset',
  isActive: true,
})

// Query transactions by date range
const transactions = await queryTransactions({
  companyId: 'company-123',
  fromDate: new Date('2024-01-01'),
  toDate: new Date('2024-12-31'),
})
```

### Update Entities

```typescript
import { updateAccount, updateTransaction } from './store'

// Update an account
await updateAccount('account-id', {
  name: 'Updated Name',
  isActive: false,
})

// Update a transaction (only drafts can be updated)
await updateTransaction('transaction-id', {
  memo: 'Updated memo',
})
```

### Soft Delete

```typescript
import { deleteAccount, voidTransaction } from './store'

// Soft delete an account (tombstone marker)
await deleteAccount('account-id')

// Void a posted transaction (instead of deleting)
await voidTransaction('transaction-id')
```

### Encryption Integration

```typescript
import { createAccount, type EncryptionContext } from './store'

const encryptionContext: EncryptionContext = {
  companyId: 'company-123',
  userId: 'user-123',
  encryptionService: {
    encrypt: async (data) => {
      // Your encryption logic
      return encryptedData
    },
    decrypt: async (data) => {
      // Your decryption logic
      return decryptedData
    },
    encryptField: async (field) => {
      return await encrypt(JSON.stringify(field))
    },
    decryptField: async (encrypted) => {
      return JSON.parse(await decrypt(encrypted))
    },
  },
}

// Create with encryption
await createAccount(
  {
    companyId: 'company-123',
    name: 'Sensitive Account',
    type: 'asset',
    isActive: true,
  },
  encryptionContext
)
```

### Batch Operations

```typescript
import { batchInsertAccounts, executeTransaction } from './store'

// Batch insert accounts
const result = await batchInsertAccounts([
  { companyId: 'company-123', name: 'Account 1', type: 'asset', isActive: true },
  { companyId: 'company-123', name: 'Account 2', type: 'liability', isActive: true },
])

console.log('Successful:', result.successful.length)
console.log('Failed:', result.failed.length)

// Execute atomic transaction
await executeTransaction(async () => {
  await createAccount(/* ... */)
  await createContact(/* ... */)
  // All succeed or all fail
})
```

### CRDT Sync Operations

```typescript
import { syncAccounts, mergeEntities } from './store'

// Sync accounts from remote
const syncResult = await syncAccounts(
  'company-123',
  remoteAccounts, // AccountEntity[]
  encryptionContext
)

console.log('Merged:', syncResult.data.merged)
console.log('Conflicts:', syncResult.data.conflicts)
console.log('Inserted:', syncResult.data.inserted)
console.log('Updated:', syncResult.data.updated)

// Manual merge
const mergeResult = mergeEntities(localEntity, remoteEntity, 'last-write-wins')

if (mergeResult.conflicts.length > 0) {
  console.log('Conflicts detected:', mergeResult.conflicts)
}
```

### Audit Logging

```typescript
import { logCreate, logUpdate, queryAuditLogs } from './store'

// Log entity creation
await logCreate(
  'company-123',
  'user-123',
  'account',
  'account-id',
  { name: 'Cash', type: 'asset' }
)

// Log entity update
await logUpdate(
  'company-123',
  'user-123',
  'account',
  'account-id',
  { name: 'Cash' },
  { name: 'Checking Account' },
  ['name']
)

// Query audit logs
const logs = await queryAuditLogs({
  companyId: 'company-123',
  entityType: 'account',
  fromDate: new Date('2024-01-01'),
})
```

### Export/Import

```typescript
import { exportCompanyData, importCompanyData } from './store'

// Export all company data
const exportResult = await exportCompanyData('company-123')

if (exportResult.success) {
  const backup = JSON.stringify(exportResult.data)
  // Save backup to file or remote storage
}

// Import data
const importResult = await importCompanyData({
  accounts: [...],
  transactions: [...],
  contacts: [...],
  products: [...],
  users: [...],
  auditLogs: [...],
})

console.log('Imported:', importResult.data.imported)
```

## Database Schema

### Accounts Table

```typescript
{
  id: string
  companyId: string
  name: string (encrypted)
  accountNumber?: string
  type: AccountType
  parentAccountId?: string
  balance: number (encrypted)
  description?: string (encrypted)
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
  versionVector: VersionVector
  lastModifiedBy: string
  lastModifiedAt: Date
}
```

### Transactions Table

```typescript
{
  id: string
  companyId: string
  date: Date
  reference?: string
  memo?: string (encrypted)
  status: TransactionStatus
  lines: JournalEntryLine[] (encrypted)
  isBalanced: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
  versionVector: VersionVector
  lastModifiedBy: string
  lastModifiedAt: Date
}
```

### Indexes

The database includes optimized compound indexes:

- `accounts`: `[companyId+type]`, `[companyId+isActive]`, `[companyId+type+isActive]`
- `transactions`: `[companyId+status]`, `[companyId+date]`, `[companyId+status+date]`
- `contacts`: `[companyId+type]`, `[companyId+isActive]`
- `products`: `[companyId+type]`, `[companyId+isActive]`, `sku`
- `users`: `[companyId+email]`
- `auditLogs`: `[companyId+timestamp]`, `[companyId+entityType+entityId]`

## CRDT Implementation

### Version Vectors

Each entity maintains a version vector that tracks modifications from each device:

```typescript
versionVector: {
  'device-1': 3,
  'device-2': 1,
  'device-3': 2
}
```

### Conflict Resolution

When two devices modify the same entity:

1. **No Conflict**: If one version vector dominates, use that version
2. **Concurrent Changes**: If both have independent changes, apply conflict resolution
3. **Last-Write-Wins**: Use timestamp to determine winner
4. **Tombstones**: Deletions are propagated as tombstone markers

### Soft Deletes

All deletions are soft deletes with tombstone markers:

```typescript
{
  deletedAt: Date // Tombstone marker
}
```

This ensures:
- Deletion propagates across devices
- Audit trail is preserved
- Data recovery is possible

## Best Practices

### 1. Always Check Results

```typescript
const result = await createAccount(/* ... */)
if (!result.success) {
  // Handle error
  console.error(result.error)
}
```

### 2. Use Transactions for Multi-Step Operations

```typescript
await executeTransaction(async () => {
  await createAccount(/* ... */)
  await createTransaction(/* ... */)
})
```

### 3. Validate Before Creating Transactions

```typescript
// Ensure debits = credits
const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0)
const totalCredits = lines.reduce((sum, line) => sum + line.credit, 0)

if (Math.abs(totalDebits - totalCredits) >= 0.01) {
  throw new Error('Transaction is not balanced')
}
```

### 4. Use Encryption Context for Sensitive Data

```typescript
await createAccount(accountData, encryptionContext)
```

### 5. Handle Conflicts in Sync Operations

```typescript
const syncResult = await syncAccounts(companyId, remoteAccounts)

if (syncResult.success && syncResult.data.conflicts > 0) {
  // Notify user or log conflicts
  console.warn('Conflicts detected during sync')
}
```

## Performance Considerations

1. **Use Compound Indexes**: Queries are optimized when using indexed fields
2. **Batch Operations**: Use batch functions for multiple inserts
3. **Limit Query Results**: Use pagination for large datasets
4. **Avoid Deep Nesting**: Keep JSON objects shallow for better performance
5. **Regular Cleanup**: Remove old tombstones periodically

## Future Enhancements

- Remote sync protocol implementation
- Conflict resolution UI
- Advanced query builders
- Real-time collaboration
- Offline queue management
- Background sync workers

## Testing

Run tests with:

```bash
npm test
```

Key test areas:
- CRUD operations
- Transaction validation
- CRDT merge operations
- Encryption round-trips
- Batch operations
- Index performance

## License

Proprietary - Graceful Books
