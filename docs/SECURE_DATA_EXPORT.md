# Secure Data Export (S7-3)

## Overview

The Secure Data Export feature implements comprehensive security controls for data exports in Graceful Books. This ensures that when users export their financial data, appropriate safeguards are in place to prevent abuse and maintain audit trails.

## Security Controls

### 1. Authentication Verification

All export operations require a valid authenticated session:

- User must be signed in with active session
- Session must contain valid `userId` and `companyId`
- Unauthenticated requests are rejected with clear error messages

### 2. Rate Limiting

Exports are rate-limited to prevent bulk data scraping:

- **Limit:** 10 exports per hour per user
- **Window:** 1 hour rolling window
- **Enforcement:** Sliding window algorithm tracks export attempts
- **Logging:** Rate limit violations are logged to audit trail

### 3. Security Warning & Acknowledgment

Users must acknowledge security warnings before exporting:

- Clear warning that exported data is NOT encrypted
- Guidance on secure handling of exported files
- Checkbox acknowledgment required to enable export
- Export button disabled until warning is acknowledged

### 4. Activity Logging

All export operations are logged to the immutable audit trail:

- Who performed the export (userId, companyId)
- What data was exported (entity type, record count)
- When the export occurred (timestamp)
- Export configuration (date range, selected fields)
- Whether security warning was acknowledged
- File size of export

## Usage

### Basic Export Flow

```typescript
import { secureCSVExporterService } from './services/csv/secureCSVExporter.service'
import { ExportWarningModal } from './components/modals/ExportWarningModal'
import { useState } from 'react'

function ExportButton() {
  const [showWarning, setShowWarning] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await secureCSVExporterService.exportToCSV({
        entityType: 'transactions',
        dateRange: 'last30',
        includeHeaders: true,
        warningAcknowledged: true, // Set by modal
      })

      if (result.success) {
        secureCSVExporterService.downloadCSV(result.filename, result.csvContent)
        alert(`Exported ${result.rowCount} records successfully!`)
        setShowWarning(false)
      } else {
        alert(`Export failed: ${result.error}`)
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        alert(`Too many exports. Please wait ${error.waitTimeMs / 1000} seconds.`)
      } else if (error instanceof AppError) {
        alert(error.message)
      } else {
        alert('Export failed. Please try again.')
      }
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <button onClick={() => setShowWarning(true)}>
        Export Transactions
      </button>

      <ExportWarningModal
        isOpen={showWarning}
        onConfirm={handleExport}
        onCancel={() => setShowWarning(false)}
        entityType="transactions"
        recordCount={150}
        isExporting={isExporting}
      />
    </>
  )
}
```

### Checking Export Quota

Before showing the export option, check if user has quota available:

```typescript
import { getActiveSession } from './auth/session'
import { secureCSVExporterService } from './services/csv/secureCSVExporter.service'

function ExportMenu() {
  const session = getActiveSession()
  const quota = secureCSVExporterService.getQuotaStatus(session.userId)

  return (
    <div>
      <button
        onClick={handleExport}
        disabled={quota.remaining === 0}
      >
        Export Data
      </button>
      {quota.remaining === 0 && (
        <p>
          Export quota exceeded. Resets at {new Date(quota.resetsAt).toLocaleString()}
        </p>
      )}
      {quota.remaining > 0 && (
        <p>{quota.remaining} exports remaining</p>
      )}
    </div>
  )
}
```

### Advanced Export Configuration

```typescript
import { secureCSVExporterService } from './services/csv/secureCSVExporter.service'

// Export with custom date range
const result = await secureCSVExporterService.exportToCSV({
  entityType: 'invoices',
  dateRange: 'custom',
  customStartDate: new Date('2026-01-01'),
  customEndDate: new Date('2026-01-31'),
  includeHeaders: true,
  warningAcknowledged: true,
})

// Export with selected fields only
const result = await secureCSVExporterService.exportToCSV({
  entityType: 'contacts',
  selectedFields: ['Name', 'Email', 'Phone'],
  includeHeaders: true,
  warningAcknowledged: true,
})
```

## Security Architecture

### Data Flow

```
User clicks Export
     ↓
ExportWarningModal shown
     ↓
User acknowledges warning
     ↓
secureDataExport() called
     ↓
1. Validate Authentication ← Check session
     ↓
2. Check Warning Acknowledgment ← Required
     ↓
3. Check Rate Limit ← 10/hour per user
     ↓
4. Perform Export ← Call CSV exporter
     ↓
5. Log to Audit Trail ← Record export details
     ↓
6. Return Result ← With security metadata
     ↓
Browser downloads file (UNENCRYPTED)
```

### Rate Limiting Strategy

The rate limiter uses a **sliding window algorithm** to track exports:

- Each export attempt is timestamped
- Timestamps older than the window (1 hour) are discarded
- Current count is compared against limit (10)
- If exceeded, wait time is calculated and error is thrown

**Configuration:**

```typescript
export const SECURITY_RATE_LIMITS = {
  dataExport: {
    maxOperations: 10,        // 10 exports
    windowMs: 60 * 60 * 1000, // per hour
  }
}
```

### Audit Trail Structure

Export events are logged with type `DATA_EXPORT`:

```typescript
{
  type: 'DATA_EXPORT',
  userId: 'user-123',
  companyId: 'company-abc',
  timestamp: 1708713600000,
  details: {
    entityType: 'transactions',
    exportFormat: 'csv',
    recordCount: 150,
    dateRange: {
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-01-31T23:59:59.999Z'
    },
    includeFields: ['Date', 'Description', 'Amount'],
    exportSize: 45000,
    warningAcknowledged: true
  }
}
```

## Security Warnings

### Primary Warning (Shown in Modal)

> **Important: Exported data is not encrypted**
>
> Once you download this file, it will contain your financial data in plain text. For your security, please:
>
> - Store the file in a secure location on your device
> - Delete the file when you no longer need it
> - Never share the file over unsecured channels (email, messaging apps)
> - Consider encrypting the file yourself if storing long-term

### Rate Limit Warning

When export quota is exhausted:

> You have **0 exports** remaining. Your export quota will reset in **45 minutes**.

## Error Handling

### Authentication Errors

```typescript
try {
  await secureDataExport(request, exportFn)
} catch (error) {
  if (error.code === 'AUTHENTICATION_REQUIRED') {
    // User not signed in
    redirectToLogin()
  }
}
```

### Rate Limit Errors

```typescript
try {
  await secureDataExport(request, exportFn)
} catch (error) {
  if (error instanceof RateLimitError) {
    const minutes = Math.ceil(error.waitTimeMs / 60000)
    alert(`Too many exports. Please wait ${minutes} minutes.`)
  }
}
```

### Warning Not Acknowledged

```typescript
try {
  await secureDataExport(request, exportFn)
} catch (error) {
  if (error.code === 'SECURITY_WARNING_NOT_ACKNOWLEDGED') {
    // Show warning modal again
    setShowWarning(true)
  }
}
```

## Testing

### Running Tests

```bash
# Run all secure export tests
npm test secureDataExport

# Run modal tests
npm test ExportWarningModal

# Run with coverage
npm test -- --coverage secureDataExport
```

### Test Coverage

**Service Tests (`secureDataExport.service.test.ts`):**
- ✅ Authentication requirements
- ✅ Warning acknowledgment enforcement
- ✅ Rate limiting enforcement
- ✅ Activity logging
- ✅ Export execution
- ✅ Error handling

**Component Tests (`ExportWarningModal.test.tsx`):**
- ✅ Warning display
- ✅ Checkbox acknowledgment
- ✅ Rate limit information
- ✅ Button states (enabled/disabled)
- ✅ Exporting state
- ✅ Accessibility (ARIA labels, keyboard navigation)

### Manual Testing Checklist

1. **Authentication Test:**
   - [ ] Sign out and attempt export → Should show auth error
   - [ ] Sign in and attempt export → Should proceed

2. **Warning Test:**
   - [ ] Attempt export without checking box → Export button disabled
   - [ ] Check acknowledgment box → Export button enabled
   - [ ] Cancel and reopen modal → Checkbox reset

3. **Rate Limit Test:**
   - [ ] Export 10 times rapidly → 10th succeeds
   - [ ] Attempt 11th export → Rate limit error
   - [ ] Wait 1 hour → Can export again

4. **Logging Test:**
   - [ ] Export data → Check audit log for DATA_EXPORT entry
   - [ ] Verify log contains userId, companyId, record count
   - [ ] Verify warningAcknowledged is true

## API Reference

### `secureDataExport(request, exportFunction)`

Main function for secure exports.

**Parameters:**
- `request: SecureExportRequest` - Export configuration with security context
- `exportFunction: (config) => Promise<CSVExportResult>` - Function to perform export

**Returns:** `Promise<SecureExportResult>`

**Throws:**
- `AppError` - Authentication or warning acknowledgment failure
- `RateLimitError` - Rate limit exceeded

### `getExportQuotaStatus(userId)`

Get current export quota for a user.

**Parameters:**
- `userId: string` - User ID to check

**Returns:**
```typescript
{
  remaining: number,      // Exports remaining in current window
  maxExports: number,     // Maximum exports per window
  resetsAt: number | null // Timestamp when quota resets
}
```

### `canUserExport(userId)`

Check if user can export (has quota available).

**Parameters:**
- `userId: string` - User ID to check

**Returns:** `boolean` - True if exports remaining > 0

## Configuration

### Rate Limits

Modify rate limits in `src/utils/rateLimiter.ts`:

```typescript
export const SECURITY_RATE_LIMITS = {
  dataExport: {
    maxOperations: 10,        // Change to 20 for more exports
    windowMs: 60 * 60 * 1000, // Change to 30 * 60 * 1000 for 30 min window
  }
}
```

### Warning Messages

Customize warnings in `src/services/secureDataExport.service.ts`:

```typescript
export const EXPORT_SECURITY_WARNINGS = {
  unencrypted: `Your custom warning message here...`,
  sensitiveData: `Additional warning for sensitive exports...`,
}
```

## Zero-Knowledge Architecture Compliance

The Secure Data Export feature maintains zero-knowledge architecture:

1. **No server-side export:** All exports happen client-side
2. **No relay storage:** Export files never touch the sync relay
3. **Encrypted data only:** Server only sees encrypted data, never plaintext
4. **Client-side logging:** Audit logs are encrypted before storage
5. **User responsibility:** Clear warnings that exported files are user's responsibility

## Future Enhancements

Potential improvements for future versions:

1. **Export encryption:** Optionally encrypt exports with user's passphrase
2. **Password-protected exports:** Add password protection to CSV files
3. **Expiring exports:** Auto-delete export files after X days
4. **Export templates:** Save common export configurations
5. **Scheduled exports:** Automatically export data on schedule
6. **Export notifications:** Email/notify when scheduled export completes

## Support & Troubleshooting

### Common Issues

**Q: Why can't I export more data?**
A: You've reached your hourly export limit (10 per hour). This prevents abuse and protects your data. Wait for your quota to reset.

**Q: Is my exported data encrypted?**
A: No. Exported CSV/JSON files are plain text. You must handle them securely and consider encrypting them yourself if storing long-term.

**Q: Why do I need to acknowledge the warning?**
A: To ensure you understand the security implications. Exported data is no longer protected by zero-knowledge encryption.

**Q: Can I increase my export limit?**
A: The limit is set for security. If you need more exports, contact support to discuss your use case.

## Compliance

This feature satisfies the following security requirements:

- **S7-3:** Secure Data Export [COMPLETED]
  - ✅ Authentication check before export
  - ✅ Activity logging (who, what, when)
  - ✅ Rate limiting (prevent bulk scraping)
  - ✅ User security warnings
  - ✅ Audit trail for all exports

## Related Documentation

- [Security Hardening Roadmap](../Roadmaps/SECURITY_HARDENING_ROADMAP.md) - Overall security strategy
- [Agent Review Checklist](../Roadmaps/AGENT_REVIEW_CHECKLIST.md) - Code quality standards
- [Rate Limiter](../src/utils/rateLimiter.ts) - Rate limiting implementation
- [Security Logger](../src/utils/securityLogger.ts) - Security event logging
- [CSV Exporter](../src/services/csv/csvExporter.service.ts) - Base export functionality
