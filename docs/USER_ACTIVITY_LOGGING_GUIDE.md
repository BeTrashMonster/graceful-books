# User Activity Logging Integration Guide

This guide explains how to integrate user activity logging into your components and services.

## Overview

The User Activity Logging system (S7-2) provides comprehensive tracking of all user actions including CRUD operations, data exports, and settings changes. All activity is logged to an immutable audit trail with automatic sanitization of sensitive data.

## Key Features

- **Automatic Sanitization**: Passwords, keys, tokens, and other sensitive fields are automatically redacted
- **Immutable Audit Trail**: All logs are stored permanently in the `auditLogs` table
- **Admin Dashboard**: Comprehensive UI for viewing and filtering user activities
- **Rich Filtering**: Filter by user, action, entity type, date range, and search terms
- **Statistics**: Real-time statistics on user actions
- **Security First**: Sensitive data never reaches the audit log

## Basic Usage

### 1. Import the Service

```typescript
import {
  logUserActivity,
  logSettingsChange,
  logDataExport,
} from '../services/userActivity'
import { db } from '../db'
```

### 2. Logging CRUD Operations

```typescript
// Log a CREATE operation
await logUserActivity(
  'CREATE',
  'TRANSACTION',
  transaction.id,
  null,
  transaction,
  db
)

// Log an UPDATE operation
await logUserActivity(
  'UPDATE',
  'ACCOUNT',
  account.id,
  originalAccount,
  updatedAccount,
  db
)

// Log a DELETE operation
await logUserActivity(
  'DELETE',
  'PRODUCT',
  product.id,
  product,
  null,
  db
)
```

### 3. Logging Settings Changes

```typescript
await logSettingsChange(
  'theme',
  'light',
  'dark',
  'appearance',
  db
)

await logSettingsChange(
  'notificationsEnabled',
  false,
  true,
  'notifications',
  db
)
```

### 4. Logging Data Exports

```typescript
await logDataExport({
  entityType: 'TRANSACTION',
  format: 'CSV',
  recordCount: 150,
  dateRange: {
    from: startDate.getTime(),
    to: endDate.getTime()
  },
  filters: {
    category: 'Income',
    status: 'posted'
  }
}, db)
```

## Integration Patterns

### Store Integration

When adding user activity logging to store operations:

```typescript
// In src/store/transactions.ts
export async function createTransaction(
  companyId: string,
  transaction: Partial<Transaction>
): Promise<DatabaseResult<Transaction>> {
  // ... existing validation and creation logic ...

  const result = await db.transactions.add(newTransaction)

  // Log the activity
  await logUserActivity(
    'CREATE',
    'TRANSACTION',
    newTransaction.id,
    null,
    newTransaction,
    db
  )

  return { success: true, data: newTransaction }
}
```

### Component Integration

When adding activity logging to components:

```typescript
// In a component
import { logSettingsChange } from '../../services/userActivity'
import { db } from '../../db'

const handleThemeChange = async (newTheme: string) => {
  const oldTheme = settings.theme

  // Update the setting
  await updateSettings({ theme: newTheme })

  // Log the change
  await logSettingsChange(
    'theme',
    oldTheme,
    newTheme,
    'appearance',
    db
  )
}
```

### Data Export Integration

When implementing export functionality:

```typescript
const handleExport = async () => {
  // Perform the export
  const data = await queryTransactions(companyId, filters)
  const csv = convertToCSV(data)

  // Log the export
  await logDataExport({
    entityType: 'TRANSACTION',
    format: 'CSV',
    recordCount: data.length,
    dateRange: filters.dateRange,
    filters: sanitizeFilters(filters)
  }, db)

  // Download the file
  downloadCSV(csv, 'transactions.csv')
}
```

## Querying Activity Logs

### Basic Queries

```typescript
import { queryUserActivity } from '../services/userActivity'

// Get all activities for a company
const activities = await queryUserActivity('company-123', db)

// Filter by user
const userActivities = await queryUserActivity('company-123', db, {
  userId: 'user-456'
})

// Filter by action
const createActions = await queryUserActivity('company-123', db, {
  action: 'CREATE'
})

// Filter by date range
const recentActivities = await queryUserActivity('company-123', db, {
  dateFrom: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
  dateTo: Date.now()
})

// Combine filters with pagination
const filteredActivities = await queryUserActivity('company-123', db, {
  userId: 'user-456',
  action: 'UPDATE',
  entityType: 'ACCOUNT',
  dateFrom: startDate.getTime(),
  dateTo: endDate.getTime(),
  limit: 50,
  offset: 0
})
```

### Activity Statistics

```typescript
import { getUserActivityStats } from '../services/userActivity'

// Get statistics for the last 24 hours
const stats = await getUserActivityStats(
  'company-123',
  undefined, // All users
  db,
  24 * 60 * 60 * 1000
)

console.log(stats.totalActivities)
console.log(stats.creates)
console.log(stats.updates)
console.log(stats.deletes)
console.log(stats.exports)
console.log(stats.settingsChanges)
console.log(stats.byEntityType) // { TRANSACTION: 10, ACCOUNT: 5, ... }
console.log(stats.byHour) // { 14: 3, 15: 7, ... }
```

### Recent Activities

```typescript
import { getRecentUserActivities } from '../services/userActivity'

// Get last 10 activities for a specific user
const recent = await getRecentUserActivities(
  'company-123',
  'user-456',
  db,
  10
)
```

### User Activity Summary

```typescript
import { getUserActivitySummary } from '../services/userActivity'

// Get comprehensive summary for a user (last 7 days)
const summary = await getUserActivitySummary(
  'company-123',
  'user-456',
  db
)

console.log(summary.userId)
console.log(summary.totalActivities)
console.log(summary.timeRange)
console.log(summary.stats)
console.log(summary.recentActivities)
```

## Admin Dashboard

The User Activity Dashboard is available to admin users only.

### Using the Dashboard

1. Navigate to the admin area
2. Access the User Activity Dashboard
3. View real-time activity statistics
4. Filter by user, action, entity type, or date range
5. Search for specific activities
6. Expand activity details for full information
7. Export activity logs to CSV

### Dashboard Features

- **Statistics Cards**: Real-time counts of creates, updates, deletes, exports, and settings changes
- **Multi-dimensional Filtering**: Combine multiple filters to narrow down activities
- **Search**: Free-text search across all activity fields
- **Expandable Details**: Click any activity to see full metadata, changed fields, and before/after values
- **Pagination**: Navigate through large activity sets
- **CSV Export**: Download filtered activities for external analysis

## Security and Privacy

### Automatic Sanitization

The following fields are automatically redacted from logs:

- password, passphrase
- key, secret, token
- privateKey, encryptionKey, masterKey, salt
- apiKey, accessToken, refreshToken, sessionToken
- ssn, socialSecurityNumber
- creditCard, cardNumber, cvv, pin

### Sensitive Data Handling

```typescript
// Original object with sensitive data
const user = {
  username: 'testuser',
  email: 'user@example.com',
  password: 'secret123',
  apiKey: 'sk-12345'
}

// When logged, becomes:
{
  username: 'testuser',
  email: 'user@example.com',
  password: '[REDACTED]',
  apiKey: '[REDACTED]'
}
```

### Nested Object Sanitization

```typescript
// Nested sensitive data is also sanitized
const config = {
  name: 'My Config',
  settings: {
    theme: 'dark',
    security: {
      apiKey: 'secret-key',
      token: 'secret-token'
    }
  }
}

// Becomes:
{
  name: 'My Config',
  settings: {
    theme: 'dark',
    security: {
      apiKey: '[REDACTED]',
      token: '[REDACTED]'
    }
  }
}
```

## Best Practices

### 1. Always Set Audit Context

Before logging activities, ensure the audit context is set:

```typescript
import { setAuditContext } from '../services/audit'

// Set context when user logs in
setAuditContext({
  userId: user.id,
  companyId: company.id,
  sessionId: session.id
})
```

### 2. Log Asynchronously

Activity logging should not block main operations:

```typescript
// Good - fire and forget
logUserActivity('CREATE', 'TRANSACTION', txn.id, null, txn, db)
  .catch(err => console.error('Failed to log activity:', err))

// Also good - await but don't block on failure
try {
  await logUserActivity('CREATE', 'TRANSACTION', txn.id, null, txn, db)
} catch (err) {
  console.error('Failed to log activity:', err)
  // Continue execution - logging failure should not break main flow
}
```

### 3. Don't Log Sensitive Data in Metadata

When passing additional metadata, avoid sensitive information:

```typescript
// Bad
await logDataExport({
  entityType: 'USER',
  format: 'JSON',
  recordCount: 10,
  filters: {
    password: 'should-not-be-here' // Don't do this
  }
}, db)

// Good
await logDataExport({
  entityType: 'USER',
  format: 'JSON',
  recordCount: 10,
  filters: {
    role: 'admin',
    status: 'active'
  }
}, db)
```

### 4. Use Specific Entity Types

Always use the most specific entity type available:

```typescript
// Good
await logUserActivity('CREATE', 'INVOICE', invoice.id, null, invoice, db)
await logUserActivity('UPDATE', 'VENDOR', vendor.id, old, updated, db)

// Avoid generic types when specific ones exist
await logUserActivity('CREATE', 'TRANSACTION', invoice.id, null, invoice, db) // Wrong entity type
```

### 5. Include Meaningful Context

For settings changes, include the category:

```typescript
// Good
await logSettingsChange('emailNotifications', false, true, 'notifications', db)
await logSettingsChange('theme', 'light', 'dark', 'appearance', db)

// Less useful
await logSettingsChange('emailNotifications', false, true, undefined, db)
```

## Troubleshooting

### Activity Not Logged

**Problem**: Activities are not appearing in the dashboard.

**Solutions**:
1. Verify audit context is set: `getAuditContext()` should not be null
2. Check database connection: Ensure `db` is properly initialized
3. Verify user has permission to write to auditLogs table
4. Check browser console for errors

### Sensitive Data Appearing in Logs

**Problem**: Sensitive information is visible in activity logs.

**Solutions**:
1. Add the field name to `SENSITIVE_FIELDS` array in `userActivity.ts`
2. Verify the field name contains common sensitive keywords
3. Check that sanitization is enabled (it should be automatic)
4. Report as a security issue if sanitization is failing

### Performance Issues with Large Activity Logs

**Problem**: Dashboard is slow with many activities.

**Solutions**:
1. Use date range filters to limit results
2. Apply entity type or action filters to narrow scope
3. Increase pagination page size for fewer queries
4. Consider archiving old activity logs (>1 year)
5. Add database indexes if needed (already optimized for common queries)

### Missing Changed Fields

**Problem**: Changed fields are not showing in activity details.

**Solutions**:
1. Ensure both `beforeValue` and `afterValue` are provided for UPDATE actions
2. Verify objects are not identical (no changes detected)
3. Check that skipped fields (updated_at, version_vector) are not the only changes
4. Ensure objects are serializable (no circular references)

## API Reference

See the full API documentation in `src/services/userActivity.ts` for detailed function signatures and parameters.

## Related Documentation

- [RBAC Permission Matrix](./RBAC_PERMISSION_MATRIX.md) - Role-based access control
- [Security Hardening Roadmap](../Roadmaps/SECURITY_HARDENING_ROADMAP.md) - Overall security implementation
- [Agent Review Checklist](../Roadmaps/AGENT_REVIEW_CHECKLIST.md) - Code quality standards
