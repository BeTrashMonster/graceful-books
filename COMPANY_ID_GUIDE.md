# Company ID Management Guide

## Critical: Understanding Company ID Flow

### How Company ID Works

The `companyId` used throughout the application comes from the **user's ID**, not a separate company field:

```typescript
// src/contexts/AuthContext.tsx (line 51)
companyId: userId, // Use user ID as company ID for data isolation
```

This means:
- **Session storage** contains `user.id` (e.g., `demo-user-cpg`)
- **AuthContext** uses this as `companyId`
- **All database queries** filter by this `companyId`

### The Bug That Was Fixed

**Problem:** Demo utilities and scripts were using hardcoded company IDs that didn't match the session:

```typescript
// ❌ OLD - WRONG
const companyId = 'cpg-demo'; // Hardcoded wrong ID
```

**Result:** Data created with `cpg-demo`, but session queries for `demo-user-cpg` → blank pages

**Solution:** Always get company ID from session:

```typescript
// ✅ NEW - CORRECT
const session = sessionStorage.getItem('graceful_books_session');
const parsed = JSON.parse(session);
const companyId = parsed.user.id; // Always use this!
```

## Rules for Developers

### Rule #1: Never Hardcode Company IDs

**❌ Never do this:**
```typescript
const companyId = 'cpg-demo';
const companyId = 'demo-company-id';
await db.cpgEvents.add({ company_id: 'some-hardcoded-id', ...});
```

**✅ Always do this:**
```typescript
import { useAuth } from './contexts/AuthContext';

const { companyId } = useAuth();
await db.cpgEvents.add({ company_id: companyId, ...});
```

### Rule #2: Use Demo Config for Test Scripts

For console utilities and demo scripts:

```typescript
import { DEMO_CONFIG } from '../config/demoConfig';

// Get from session FIRST, fallback to config
let companyId = DEMO_CONFIG.COMPANY_ID;

try {
  const session = sessionStorage.getItem('graceful_books_session');
  if (session) {
    const parsed = JSON.parse(session);
    companyId = parsed.user?.id || companyId;
  }
} catch (err) {
  console.warn('Using fallback company ID');
}
```

### Rule #3: Check for Legacy IDs

When working with existing data, check for legacy company IDs:

```typescript
import { LEGACY_DEMO_IDS } from '../config/demoConfig';

// Migration example
for (const legacyId of LEGACY_DEMO_IDS) {
  const oldData = await db.cpgEvents
    .where('company_id')
    .equals(legacyId)
    .toArray();

  if (oldData.length > 0) {
    console.warn(`Found ${oldData.length} records with legacy ID: ${legacyId}`);
    // Migrate to current company ID
  }
}
```

## For Real Users (Not Demo)

**This bug does not affect real users** because:

1. Real users have a **single, stable user.id** from the API
2. Their session never changes company ID mid-session
3. All their data is created with their consistent user.id

**However**, this could theoretically happen if:
- Multiple tabs somehow overwrite each other's sessions (we listen for storage events to prevent this)
- User switches accounts without fully logging out
- Session corruption occurs

## Prevention Checklist

Before creating/modifying code that touches company_id:

- [ ] Am I using `useAuth()` to get `companyId`?
- [ ] Am I passing `companyId` from props/context instead of hardcoding?
- [ ] If this is a demo script, am I using `DEMO_CONFIG` or reading from session?
- [ ] Have I tested with a fresh session to ensure data persists?

## Testing for Company ID Issues

Run this in browser console to verify data consistency:

```javascript
// Check what company ID the session is using
const session = JSON.parse(sessionStorage.getItem('graceful_books_session'));
console.log('Session company ID:', session.user.id);

// Check what company IDs exist in your data
const db = await new Promise(resolve => {
  const request = indexedDB.open('TreasureChest');
  request.onsuccess = () => resolve(request.result);
});

const tx = db.transaction(['cpgEvents', 'cpgDistributors', 'cpgSalesPromos'], 'readonly');

for (const tableName of ['cpgEvents', 'cpgDistributors', 'cpgSalesPromos']) {
  const store = tx.objectStore(tableName);
  const all = await new Promise(resolve => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });

  const uniqueCompanyIds = [...new Set(all.map(r => r.company_id))];
  console.log(`${tableName}: ${uniqueCompanyIds.join(', ')}`);
}
```

If you see multiple different company IDs, you have the bug!

## Migration Script

If you discover data under wrong company IDs, use this script:

```javascript
const CORRECT_COMPANY_ID = 'your-actual-company-id'; // Get from session
const WRONG_COMPANY_IDS = ['cpg-demo', 'old-company-id'];

const db = await new Promise(resolve => {
  const request = indexedDB.open('TreasureChest');
  request.onsuccess = () => resolve(request.result);
});

const tables = ['cpgEvents', 'cpgSalesPromos', 'cpgDistributors', 'cpgDistributionCalculations'];

for (const table of tables) {
  const tx = db.transaction(table, 'readwrite');
  const store = tx.objectStore(table);

  const all = await new Promise(resolve => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });

  for (const record of all) {
    if (WRONG_COMPANY_IDS.includes(record.company_id)) {
      record.company_id = CORRECT_COMPANY_ID;
      store.put(record);
      console.log(`Migrated ${table} record:`, record.id);
    }
  }

  await tx.complete;
}

console.log('✅ Migration complete!');
```

## Summary

**TL;DR:**
- ✅ Always use `companyId` from `useAuth()` hook
- ✅ Never hardcode company IDs in production code
- ✅ Test scripts should read from session first, then DEMO_CONFIG
- ✅ Run consistency checks if pages show "no data" unexpectedly
