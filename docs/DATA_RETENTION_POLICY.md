# Data Retention Policy Documentation

**Implementation:** S7-5 - Data Retention Policies
**Status:** ✅ COMPLETED
**Date:** 2026-02-23

## Overview

Graceful Books implements a comprehensive data retention policy system that allows administrators to configure how long deleted records are retained before permanent deletion. The system automatically enforces the 7-year legal retention requirement for financial records as mandated by federal accounting regulations.

## Key Features

### 1. Configurable Retention Periods
- Administrators can set retention periods per entity type
- Default retention: 90 days for all entities
- Minimum: 1 day, Maximum: 100 years (36,500 days)
- Retention periods can be customized for specific entity types

### 2. 7-Year Legal Retention Enforcement
- **Automatically enforced** for financial records
- Required by federal law for accounting records
- Applies to: Accounts, Transactions, Invoices, Bills, Receipts, Reconciliations, Audit Logs
- Cannot be bypassed by default (unless explicitly disabled by admin)

### 3. Auto-Purge Functionality
- Scheduled automatic purging of eligible records
- Configurable schedule (default: 2am daily)
- Batch processing to avoid performance impact
- Dry-run mode for testing
- Admin notifications after purge completion

### 4. Secure Deletion
- **Data overwrite** before deletion to prevent recovery
- Sensitive fields replaced with random data
- Compliant with zero-knowledge security architecture
- Three deletion methods:
  - `SOFT_DELETE`: Mark as deleted (deletedAt timestamp)
  - `SECURE_DELETE`: Overwrite then delete
  - `AUTO_PURGE`: Automatic scheduled deletion

### 5. Audit Trail
- Complete deletion log for all purged records
- Tracks: Entity type, deletion method, deleted by, reason
- Immutable audit records
- Queryable by company, entity type, date range

## Architecture

### Database Schema

#### Retention Policies Table
```typescript
interface RetentionPolicy {
  id: string;
  company_id: string;
  entity_type: RetentionEntityType;
  retention_days: number;
  is_active: boolean;
  enforce_minimum: boolean;
  description: string | null;
  created_by: string;
  last_modified_by: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}
```

#### Deletion Logs Table
```typescript
interface DeletionLog {
  id: string;
  company_id: string;
  entity_type: RetentionEntityType;
  entity_id: string;
  deletion_method: DeletionMethod;
  deleted_by: string;
  soft_deleted_at: number;
  hard_deleted_at: number;
  retention_policy_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}
```

### Entity Types

```typescript
type RetentionEntityType =
  | 'ALL'          // Default policy
  | 'ACCOUNT'      // ⚖️ Financial - 7 years
  | 'TRANSACTION'  // ⚖️ Financial - 7 years
  | 'CONTACT'      // Not financial
  | 'PRODUCT'      // Not financial
  | 'INVOICE'      // ⚖️ Financial - 7 years
  | 'BILL'         // ⚖️ Financial - 7 years
  | 'RECEIPT'      // ⚖️ Financial - 7 years
  | 'RECONCILIATION' // ⚖️ Financial - 7 years
  | 'CATEGORY'     // Not financial
  | 'TAG'          // Not financial
  | 'AUDIT_LOG';   // ⚖️ Financial - 7 years
```

### Service API

#### Get Retention Policies
```typescript
getRetentionPolicies(companyId: string): Promise<RetentionPolicy[]>
```

#### Get Policy for Entity Type
```typescript
getRetentionPolicy(
  companyId: string,
  entityType: RetentionEntityType
): Promise<RetentionPolicy | null>
```
Falls back to 'ALL' policy if no specific policy exists.

#### Create/Update Policy
```typescript
upsertRetentionPolicy(
  companyId: string,
  userId: string,
  entityType: RetentionEntityType,
  retentionDays: number,
  enforceMinimum: boolean = true,
  description: string | null = null
): Promise<RetentionPolicy>
```

#### Delete Policy
```typescript
deleteRetentionPolicy(
  policyId: string,
  companyId: string
): Promise<void>
```

#### Get Statistics
```typescript
getRetentionStatistics(
  companyId: string
): Promise<RetentionStatistics>
```

Returns:
- Total soft-deleted records
- Records eligible for purge
- Records protected by 7-year rule
- Days until next record eligible
- Breakdown by entity type

#### Purge Single Record
```typescript
purgeRecord(
  companyId: string,
  entityType: RetentionEntityType,
  entityId: string,
  deletionMethod: DeletionMethod = DeletionMethod.SECURE_DELETE,
  deletedBy: string = 'SYSTEM',
  reason: string | null = null
): Promise<PurgeResult>
```

#### Auto-Purge Company
```typescript
autoPurgeCompany(
  companyId: string,
  config: AutoPurgeConfig = DEFAULT_AUTO_PURGE_CONFIG
): Promise<BatchPurgeResult>
```

#### Get Deletion Logs
```typescript
getDeletionLogs(
  companyId: string,
  options?: {
    entityType?: RetentionEntityType;
    entityId?: string;
    deletedBy?: string;
    dateFrom?: number;
    dateTo?: number;
    limit?: number;
    offset?: number;
  }
): Promise<DeletionLog[]>
```

## Admin UI

### Location
`src/components/admin/RetentionPolicySettings.tsx`

### Features
- View retention statistics dashboard
- Configure retention policies per entity type
- Visual indicators for 7-year enforcement
- Preview purge (dry run)
- Execute manual purge
- View deletion audit log

### Access Control
- **Role Required:** Admin only
- Non-admin users see "Access Denied" message

### Visual Indicators
- 💼 Financial record badge
- ⚖️ Extended by 7-year rule badge
- Color-coded status badges
- Real-time statistics

## Legal Compliance

### Federal Requirements

**IRS Guidelines:**
- Employment tax records: **4 years**
- Income tax records: **7 years** (statute of limitations)
- Business expense records: **7 years**

**Generally Accepted Accounting Principles (GAAP):**
- Financial statements: **7 years**
- General ledger: **Permanent** (but 7 years minimum)
- Accounts payable/receivable: **7 years**

**Sarbanes-Oxley Act (if applicable):**
- Audit workpapers: **7 years**
- Financial records: **7 years**

### Implementation in Graceful Books

Our implementation uses **7 years (2,557 days)** as the minimum retention period for all financial records:
- Accounts
- Transactions
- Invoices
- Bills
- Receipts
- Reconciliations
- Audit Logs

This ensures compliance with the strictest federal requirements.

### Disable Enforcement (Not Recommended)

Administrators can disable the 7-year enforcement by setting `enforce_minimum: false` when creating a policy. **This is strongly discouraged** as it may result in non-compliance with federal regulations.

## Usage Examples

### Example 1: Configure Default Policy

```typescript
// Set 90-day retention for all non-financial records
await upsertRetentionPolicy(
  companyId,
  userId,
  'ALL',
  90,
  true,
  'Default retention policy for all entities'
);
```

### Example 2: Configure Specific Entity Policy

```typescript
// Set 30-day retention for contacts (non-financial)
await upsertRetentionPolicy(
  companyId,
  userId,
  'CONTACT',
  30,
  true,
  'Short retention for customer contacts'
);
```

### Example 3: Manual Purge with Dry Run

```typescript
// Preview what would be purged
const result = await autoPurgeCompany(companyId, {
  enabled: true,
  schedule_cron: '0 2 * * *',
  batch_size: 100,
  dry_run: true, // Don't actually delete
  notify_admin: false,
});

console.log(`Would purge ${result.total_purged} records`);
console.log(`Protected: ${result.total_protected} records`);
```

### Example 4: Execute Real Purge

```typescript
// Actually purge eligible records
const result = await autoPurgeCompany(companyId, {
  enabled: true,
  schedule_cron: '0 2 * * *',
  batch_size: 100,
  dry_run: false,
  notify_admin: true,
});

console.log(`Purged ${result.total_purged} records`);
console.log(`Failed: ${result.total_failed} records`);
```

### Example 5: Query Deletion Logs

```typescript
// Get recent deletions
const logs = await getDeletionLogs(companyId, {
  limit: 50,
  dateFrom: Date.now() - 30 * 24 * 60 * 60 * 1000, // Last 30 days
});

for (const log of logs) {
  console.log(
    `${log.entity_type} ${log.entity_id} deleted by ${log.deleted_by}`
  );
}
```

## Testing

### Test Coverage

Comprehensive test suite in `src/services/retention.service.test.ts`:

1. **Type Helper Tests**
   - `requiresLegalRetention()` correctly identifies financial entities
   - `calculateEffectiveRetention()` enforces 7-year minimum
   - `isEligibleForPurge()` respects retention periods

2. **Policy Management Tests**
   - Create, read, update, delete policies
   - Policy fallback to 'ALL' type
   - Validation of retention days

3. **Purge Functionality Tests**
   - Purge eligible non-financial records
   - Protect financial records before 7 years
   - Respect `enforce_minimum` flag
   - Dry run mode
   - Batch purge with statistics

4. **Audit Trail Tests**
   - Deletion logs created
   - Filter by entity type, date range
   - Immutable audit records

### Manual Testing Checklist

- [ ] Create retention policy for non-financial entity (30 days)
- [ ] Create retention policy for financial entity (30 days)
- [ ] Verify effective retention shows 7 years for financial
- [ ] Soft delete a non-financial record (contact)
- [ ] Wait or manually set deletedAt to 90 days ago
- [ ] Run purge - verify non-financial record deleted
- [ ] Soft delete a financial record (account)
- [ ] Set deletedAt to 90 days ago
- [ ] Run purge - verify financial record NOT deleted (protected)
- [ ] Set deletedAt to 8 years ago
- [ ] Run purge - verify financial record now deleted
- [ ] Check deletion logs - verify entries created
- [ ] Try dry run - verify no actual deletion occurs
- [ ] Test with enforce_minimum = false - verify financial can be purged

## Security Considerations

### Secure Deletion
When `SECURE_DELETE` method is used:
1. Sensitive fields identified
2. Fields overwritten with random data
3. Record written back to database
4. Small delay to ensure write completes
5. Record permanently deleted
6. Deletion logged

### Fields Overwritten
```typescript
const sensitiveFields = [
  'name',
  'description',
  'memo',
  'reference',
  'email',
  'phone',
  'address',
  'balance',
  'amount',
  'debit',
  'credit',
  'attachments',
  'before_value',
  'after_value',
];
```

### Authorization
- All service functions validate `companyId`
- Records can only be purged by their owning company
- Admin-only access to configuration UI
- Deletion logs track who initiated deletion

## Configuration

### Auto-Purge Schedule

Default configuration:
```typescript
const DEFAULT_AUTO_PURGE_CONFIG: AutoPurgeConfig = {
  enabled: false,        // Disabled by default for safety
  schedule_cron: '0 2 * * *', // 2am daily
  batch_size: 100,       // Process 100 records at a time
  dry_run: false,
  notify_admin: true,
};
```

### Recommended Settings

**For most companies:**
- Default retention: 90 days for non-financial records
- Always enforce 7-year minimum: `enforce_minimum: true`
- Enable auto-purge after initial testing
- Run purge during low-traffic hours (2-4am)

**For high-compliance industries:**
- Default retention: 10 years for all records
- Never disable 7-year enforcement
- Longer retention for audit logs (permanent)
- More frequent purge schedule (daily)

**For privacy-conscious organizations:**
- Shorter retention for customer data: 30 days
- Minimum legal retention for financial records: 7 years
- Immediate secure deletion when eligible
- Regular purge schedule (daily)

## Troubleshooting

### Records Not Being Purged

**Check:**
1. Is record soft-deleted? (`deletedAt` not null)
2. Is retention period expired?
3. For financial records, is 7-year period expired?
4. Is `enforce_minimum` set to true?
5. Is auto-purge enabled?
6. Check deletion logs for errors

### Financial Records Purged Too Early

**This should not happen** if `enforce_minimum` is true.

**Investigate:**
1. Check retention policy: `enforce_minimum` flag
2. Review deletion logs for who authorized
3. Verify entity type classification
4. Check for unauthorized policy changes

### Performance Issues During Purge

**Solutions:**
1. Reduce `batch_size` in auto-purge config
2. Run purge during off-peak hours
3. Increase schedule frequency (spread load)
4. Consider manual purge for large backlogs

## Future Enhancements

Potential improvements for future versions:

1. **Export Before Purge**
   - Automatically export records before deletion
   - Encrypted archive for compliance

2. **Custom Retention Rules**
   - Per-customer retention periods
   - Tag-based retention policies
   - Amount-threshold rules (high-value transactions kept longer)

3. **Restore from Archive**
   - Ability to restore from encrypted exports
   - Time-limited restore capability

4. **Advanced Reporting**
   - Retention compliance reports
   - Purge forecasting
   - Storage savings analysis

5. **Multi-Jurisdiction Support**
   - Configure retention by region
   - GDPR "right to be forgotten" compliance
   - Automatic region detection

## References

- **IRS Publication 583:** Starting a Business and Keeping Records
- **26 CFR § 1.6001-1:** Notice or regulations requiring records
- **Sarbanes-Oxley Act § 802:** Criminal Penalties for Altering Documents
- **AICPA Guidelines:** Record Retention Requirements

## Support

For questions about data retention policies:
- Review this documentation
- Check test suite for examples
- Contact compliance team for legal guidance
- Review audit logs for deletion history

---

**Document Version:** 1.0
**Last Updated:** 2026-02-23
**Next Review:** 2027-02-23
