# Audit Log Viewer - Administrator Guide

## Overview

The Audit Log Viewer is an administrative interface for viewing, filtering, and exporting security audit logs in Graceful Books. It provides comprehensive visibility into security events and user actions across your organization.

## Access Requirements

- **Role Required:** Administrator (Admin)
- **Location:** `src/components/admin/AuditLogViewer.tsx`
- **Access Control:** Automatically enforced - non-admin users will see an access denied message

## Features

### 1. Security Statistics Dashboard

View real-time security metrics for the past 24 hours:

- **Total Events:** Count of all security events
- **Failed Logins:** Failed authentication attempts
- **Authorization Failures:** Attempted unauthorized access (potential IDOR attacks)
- **Suspicious Activity:** Flagged suspicious behavior
- **Account Lockouts:** Accounts locked due to security violations

### 2. Advanced Filtering

Filter audit logs by multiple criteria:

- **Company ID:** View logs for a specific company
- **Event Type:** Filter by security event type
  - All Events
  - Failed Login
  - Authorization Failure
  - Rate Limit Exceeded
  - Suspicious Activity
  - Account Lockout
- **User ID:** Filter by specific user
- **Date Range:** From/To date filters

### 3. Pagination

Handle large log datasets efficiently:

- Configurable page sizes: 25, 50, 100, or 200 rows per page
- Navigation: First, Previous, Next, Last page buttons
- Page indicator showing current position
- Results counter showing visible/total logs

### 4. CSV Export

Export filtered logs for external analysis:

- Includes all filtered logs (not just current page)
- Properly escaped CSV format
- Filename: `audit-logs-{companyId}-{date}.csv`
- Contains: Timestamp, Date/Time, Company ID, User ID, Entity Type, Entity ID, Action, IP Address, Device ID, User Agent, Changed Fields

### 5. Real-Time Updates

Stay current with security events:

- Auto-refresh every 30 seconds (toggleable)
- Checkbox to enable/disable auto-refresh
- Manual refresh via "Apply Filters" button

### 6. Event Details

View detailed information for each log entry:

- Expandable details section (click "View Details")
- Formatted JSON display of event data
- Includes event-specific metadata
- Security data automatically redacted (passwords, keys, etc.)

## Usage Guide

### Viewing Logs

1. Navigate to the Audit Log Viewer (admin panel)
2. Enter a Company ID to view logs
3. Click "Apply Filters" to load logs
4. Scroll through the paginated results

### Filtering Logs

1. Select filters from the filter panel:
   - Choose an event type from dropdown
   - Enter a User ID (optional)
   - Set date range (optional)
2. Click "Apply Filters" to apply
3. Click "Clear Filters" to reset all filters

### Exporting Logs

1. Apply desired filters
2. Click "Export to CSV" button
3. CSV file downloads automatically
4. Open in spreadsheet software for analysis

### Investigating Security Incidents

1. Check Security Statistics for anomalies
2. Filter by event type (e.g., "Failed Login")
3. Review timestamp patterns for suspicious activity
4. Expand event details for forensic information
5. Export relevant logs for documentation

## Security Considerations

### Data Protection

- Audit logs are **immutable** - cannot be modified or deleted
- Sensitive data is **automatically redacted** from logs
- Passwords, keys, and secrets never appear in logs
- IP addresses and device IDs captured for forensic analysis

### Access Control

- Only administrators can access the Audit Log Viewer
- Non-admin users receive clear access denied message
- All audit log queries logged for accountability

### Compliance

- Audit logs retained per compliance requirements (7 years)
- All financial and security events tracked
- Full forensic trail for security investigations
- GDPR/SOC2 compliant audit trail

## Accessibility Features

The Audit Log Viewer is WCAG 2.1 AA compliant:

- **Keyboard Navigation:** All controls accessible via keyboard
- **Screen Reader Support:** Proper ARIA labels and roles
- **Focus Indicators:** Clear visual focus states
- **Color Contrast:** 4.5:1 minimum text contrast
- **Reduced Motion:** Respects `prefers-reduced-motion`
- **High Contrast Mode:** Enhanced visibility in high contrast

## Event Type Reference

### Security Events

| Event Type | Description | Investigation Priority |
|------------|-------------|----------------------|
| FAILED_LOGIN | Failed authentication attempt | High if repeated |
| AUTHORIZATION_FAILURE | Unauthorized access attempt (IDOR) | Critical |
| RATE_LIMIT_EXCEEDED | Too many requests in time window | Medium |
| SUSPICIOUS_ACTIVITY | Flagged behavior pattern | High |
| ACCOUNT_LOCKOUT | Account locked due to violations | Medium |

### Standard Events

| Event Type | Description |
|------------|-------------|
| CREATE | New entity created |
| UPDATE | Entity modified |
| DELETE | Entity deleted (soft delete) |
| RESTORE | Deleted entity restored |
| LOGIN | Successful login |
| LOGOUT | User logout |
| EXPORT | Data exported |
| IMPORT | Data imported |

## Troubleshooting

### No Logs Displayed

**Problem:** "No audit logs found" message appears

**Solutions:**
- Verify Company ID is correct
- Check date range isn't too narrow
- Try removing filters one at a time
- Ensure company has generated audit logs

### Export Button Disabled

**Problem:** Cannot click "Export to CSV"

**Solutions:**
- Apply filters first to load logs
- Verify at least one log exists for current filters
- Check browser allows file downloads

### Auto-Refresh Not Working

**Problem:** Logs not updating every 30 seconds

**Solutions:**
- Verify auto-refresh checkbox is enabled
- Check browser console for errors
- Manual refresh via "Apply Filters" button

### Performance Issues

**Problem:** Slow loading with large log sets

**Solutions:**
- Use date range filters to narrow results
- Reduce page size to 25 or 50 rows
- Filter by specific event type or user
- Export and analyze offline for very large datasets

## Technical Details

### Component Architecture

```
AuditLogViewer.tsx
├── Access Control Check (admin only)
├── Statistics Dashboard
├── Filter Panel
│   ├── Company ID input
│   ├── Event Type dropdown
│   ├── User ID input
│   └── Date Range inputs
├── Actions Bar
│   ├── Export CSV button
│   ├── Auto-refresh toggle
│   └── Results counter
├── Logs Table
│   ├── Sortable headers
│   ├── Color-coded badges
│   └── Expandable details
└── Pagination Controls
```

### Data Flow

1. User applies filters
2. Component queries `querySecurityEvents()` from `securityLogger.ts`
3. Results combined with general audit logs from database
4. Duplicates removed (security logs are subset of audit logs)
5. Results sorted by timestamp (newest first)
6. Pagination applied
7. Table rendered with current page

### Performance Optimizations

- Pagination prevents rendering thousands of rows
- Filters applied at database level (indexed queries)
- CSV export streams data (no memory buildup)
- Auto-refresh debounced to prevent rapid queries
- Details expanded on-demand (not pre-rendered)

## Best Practices

### Regular Monitoring

- Review statistics dashboard daily
- Investigate spikes in failed logins
- Monitor authorization failures closely
- Export weekly reports for compliance

### Incident Response

1. Filter by event type (e.g., AUTHORIZATION_FAILURE)
2. Identify affected users and timeframe
3. Export logs for documentation
4. Review IP addresses for patterns
5. Escalate to security team if needed

### Compliance Audits

1. Export all logs for audit period
2. Use date range filters for specific periods
3. Filter by user for individual audit trails
4. Maintain exported CSVs per retention policy

## Related Documentation

- [Security Hardening Roadmap](../Roadmaps/SECURITY_HARDENING_ROADMAP.md)
- [Security Event Logging (S5-2)](../src/utils/securityLogger.ts)
- [Authorization Guide](../src/utils/authorization.ts)
- [Agent Review Checklist](../Roadmaps/AGENT_REVIEW_CHECKLIST.md)

## Support

For technical support or questions about the Audit Log Viewer:

1. Review this documentation
2. Check console for error messages
3. Verify admin role assignment
4. Contact system administrator

---

**Last Updated:** 2026-02-23
**Component Version:** 1.0.0
**Status:** Production Ready
