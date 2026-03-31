# Automated Backup Testing

## Overview

Automated backup testing ensures that backups are restorable BEFORE you need them in an emergency. This system runs weekly tests that create a backup, restore it, validate the data, and alert admins if anything fails.

## Why This Matters

**"Backups you haven't tested are just hopes and dreams."**

- Silent backup corruption can go undetected for months
- Restoration failures in production are catastrophic
- You MUST verify backups work BEFORE you need them in an emergency
- This system catches issues proactively

## Features

✅ **Scheduled Weekly Tests** - Automatically runs every 7 days (configurable)
✅ **Complete Cycle Testing** - Backup → Restore → Validate → Report
✅ **Admin Alerts** - Email notifications on failure (optionally on success)
✅ **Audit Logging** - All tests logged for compliance
✅ **Isolated Testing** - Tests run in sandbox to avoid affecting production data
✅ **Automatic Cleanup** - Removes test artifacts after completion
✅ **Timeout Protection** - Tests won't hang indefinitely

## Quick Start

### 1. Run a One-Time Test

```typescript
import { runAutomatedBackupTest } from './services/backup/AutomatedBackupTesting'

const result = await runAutomatedBackupTest({
  companyId: 'company-123',
  userId: 'SYSTEM',
  notifyOnSuccess: false, // Only alert on failure
})

if (result.success) {
  console.log(`✓ Backup test passed in ${result.durationMs}ms`)
  console.log(`  - Tested ${result.backupMetadata?.totalRecords} records`)
  console.log(`  - ${result.validationResult?.samplesChecked} samples validated`)
} else {
  console.error(`✗ Backup test FAILED: ${result.errors.join(', ')}`)
}
```

### 2. Schedule Recurring Tests

```typescript
import { scheduleAutomatedBackupTests } from './services/backup/AutomatedBackupTesting'

// Schedule weekly tests
const intervalId = scheduleAutomatedBackupTests({
  companyId: 'company-123',
  userId: 'SYSTEM',
  intervalMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  notifyOnSuccess: false,
  cleanupAfterTest: true,
})

// Later, to cancel:
clearInterval(intervalId)
```

### 3. View Test History

```typescript
import { getBackupTestHistory } from './services/backup/AutomatedBackupTesting'

const history = await getBackupTestHistory('company-123', 10)

history.forEach((test) => {
  console.log(`Test ${test.id}:`, test.metadata.success ? '✓ PASS' : '✗ FAIL')
})
```

## Test Process

The automated test executes these phases:

### Phase 1: Backup
- Creates a complete backup of all company data
- Includes transactions, accounts, contacts, invoices, bills
- Marks as test backup (won't interfere with production backups)

### Phase 2: Restoration
- Attempts to restore the backup in isolated environment
- Verifies all data can be extracted
- Does NOT overwrite production data (isolated mode)

### Phase 3: Validation
- Sample-based integrity checks
- Compares restored data against original
- Verifies amounts, descriptions, relationships

### Phase 4: Cleanup
- Removes temporary backup files
- Cleans up test artifacts
- Frees allocated resources

### Phase 5: Reporting
- Logs results to audit trail
- Sends admin notifications (if configured)
- Records metrics for monitoring

## Configuration Options

```typescript
interface BackupTestConfig {
  companyId: string                // Company to test
  userId: string                   // User performing test (usually 'SYSTEM')
  intervalMs?: number              // Test frequency (default: 7 days)
  isolated?: boolean               // Run in sandbox (default: true)
  timeoutMs?: number               // Max test duration (default: 10 minutes)
  notifyOnSuccess?: boolean        // Email on success (default: false)
  cleanupAfterTest?: boolean       // Remove artifacts (default: true)
}
```

## Admin Notifications

### Success Email (if enabled)
```
✅ Backup Test Passed

Test Details:
- Company: Acme Corp
- Duration: 3.2s
- Records Tested: 1,245
- Samples Validated: 15

✓ Your backups are working correctly.
```

### Failure Email (always sent)
```
🚨 CRITICAL: Backup Test Failed

Test Details:
- Company: Acme Corp
- Failed Phase: restoration
- Errors:
  • Restoration failed: database error
  • Connection timeout

IMMEDIATE ACTIONS REQUIRED:
1. Investigate the error messages
2. Check backup storage availability
3. Verify database connectivity
4. Fix the underlying problem
5. Run another test to verify

⚠️ Critical: Backups are your last line of defense.
A failed test means you may not be able to recover
data in an emergency.
```

## Monitoring & Alerts

### Check Last Test Status

```typescript
const history = await getBackupTestHistory('company-123', 1)
const lastTest = history[0]

if (!lastTest.metadata.success) {
  console.error('Last backup test FAILED!')
  console.error('Errors:', lastTest.metadata.errors)
  console.error('Phase:', lastTest.metadata.phase)
}
```

### Integration with Monitoring Systems

```typescript
// Export metrics to monitoring service
const result = await runAutomatedBackupTest(config)

metrics.record('backup_test_duration_ms', result.durationMs)
metrics.record('backup_test_success', result.success ? 1 : 0)
metrics.record('backup_test_records_tested', result.backupMetadata?.totalRecords || 0)

if (!result.success) {
  alerts.critical('Backup test failed', {
    company: config.companyId,
    phase: result.phase,
    errors: result.errors,
  })
}
```

## Production Deployment

### Recommended Setup

1. **Schedule Weekly Tests** - Run every Sunday at 2am
2. **Notify on Failure Only** - Reduce email noise
3. **Always Clean Up** - Don't leave test artifacts
4. **Set Reasonable Timeout** - 10 minutes for most databases
5. **Use Isolated Mode** - Never risk production data

```typescript
// In your app initialization
scheduleAutomatedBackupTests({
  companyId: currentUser.companyId,
  userId: 'SYSTEM',
  intervalMs: 7 * 24 * 60 * 60 * 1000, // Weekly
  isolated: true,
  timeoutMs: 10 * 60 * 1000, // 10 minutes
  notifyOnSuccess: false, // Only alert on failure
  cleanupAfterTest: true,
})
```

### Multi-Company Support

```typescript
// Test all companies weekly
const companies = await db.companies.toArray()

for (const company of companies) {
  scheduleAutomatedBackupTests({
    companyId: company.id,
    userId: 'SYSTEM',
  })
}
```

## Troubleshooting

### Test Times Out
- Increase `timeoutMs` configuration
- Check database performance
- Consider reducing sample size for validation

### Restoration Fails
- Verify backup storage is accessible
- Check database permissions
- Review backup encryption keys

### Validation Fails
- Check for data corruption in source database
- Verify backup integrity HMAC
- Review validation sample selection

### No Admin Notifications
- Verify Postmark API configuration
- Check admin users exist and have email addresses
- Review email service logs

## Security Considerations

- Tests run in **isolated mode** by default (no production data risk)
- All test activities logged to **audit trail**
- Admin-only access to test results
- Backups encrypted with same security as production
- Test artifacts cleaned up automatically

## Performance Impact

- **Backup Phase**: ~1-5 seconds (depends on data size)
- **Restoration Phase**: ~1-3 seconds (isolated mode)
- **Validation Phase**: ~0.5-1 second (sample-based)
- **Total Duration**: Usually < 10 seconds
- **Database Load**: Minimal (read-only operations)
- **Storage Impact**: None (cleanup removes artifacts)

## Compliance & Audit

All backup tests are logged to the audit trail with:
- Test ID (unique identifier)
- Timestamp (when test ran)
- Duration (how long it took)
- Result (pass/fail)
- Records tested (data volume)
- Phase (where failure occurred, if applicable)
- Errors (detailed failure reasons)

Access audit logs:
```typescript
const logs = await db.auditLogs
  .where('[company_id+action]')
  .between(
    [companyId, 'BACKUP_TEST_COMPLETED'],
    [companyId, 'BACKUP_TEST_FAILED']
  )
  .toArray()
```

## Best Practices

✅ **DO**: Run tests weekly
✅ **DO**: Alert admins on failure
✅ **DO**: Review test history monthly
✅ **DO**: Use isolated mode
✅ **DO**: Clean up test artifacts

❌ **DON'T**: Skip testing to "save time"
❌ **DON'T**: Disable notifications
❌ **DON'T**: Run tests in production mode
❌ **DON'T**: Ignore test failures
❌ **DON'T**: Set timeout too low

## Support

For issues or questions about automated backup testing:
1. Check the audit logs for detailed error messages
2. Review the test result object for phase and error details
3. Verify Postmark configuration for notification issues
4. Check database connectivity and permissions

---

**Remember**: The best time to discover your backups don't work is during a test, not during an emergency. Keep testing enabled!
