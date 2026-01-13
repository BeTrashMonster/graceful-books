# Extended Audit Log - Capability Specification

**Capability ID:** `audit-log` (Extended)
**Related Roadmap Items:** E7
**SPEC Reference:** ACCT-011
**Status:** In Development

## Overview

This extends the base audit log (B8) from basic logging to a full audit management system with advanced search, filtering, comparison views, and compliance export capabilities.

## MODIFIED Requirements

### FR-1: Advanced Search and Filtering
**Priority:** High
**Modification Type:** Enhancement

**Previous Capability (B8):**
- Basic logging of all financial changes
- Timestamp and user tracking
- Basic search capability

**New Enhanced Features:**

**Search Capabilities:**
- **Full-text search:** Search in descriptions, before/after values
- **User filter:** Show only actions by specific user
- **Action type filter:** Filter by event type (create, edit, delete, void)
- **Entity filter:** Filter by entity type (transaction, account, invoice, bill)
- **Date range:** Custom date range selection
- **Compound filters:** Combine multiple filters (AND/OR logic)

**Quick Filters:**
- "My Actions" - current user only
- "Last 24 Hours" - recent activity
- "Financial Changes" - transactions, invoices, bills only
- "Permission Changes" - user/role modifications

**Acceptance Criteria:**
- [ ] Search returns results in <1 second for 10,000 entries
- [ ] Filters combine correctly (AND logic)
- [ ] Results paginated (50 per page)
- [ ] Export filtered results available

---

### FR-2: Before/After Value Comparison
**Priority:** High
**Modification Type:** New Addition

**Visual Diff View:**
- Side-by-side comparison of before/after values
- Highlight changed fields in color
- Show field name, old value, new value
- Support for complex objects (JSON diff)

**Comparison Modes:**
- **Inline:** Changed values highlighted in single view
- **Split:** Before and after in separate columns
- **Unified:** Git-style diff format

**Example Display:**
```
Transaction #1234 edited by Sarah Martinez on 2026-01-09 14:23 UTC

Amount:     $450.00 → $475.00
Category:   Office Supplies → Marketing
Memo:       "Monthly subscription" → "Q1 Ad Campaign"
```

**Acceptance Criteria:**
- [ ] Diff calculation accurate for all data types
- [ ] Visual highlighting clear and accessible
- [ ] Supports nested object comparison
- [ ] JSON diff available for complex changes

---

### FR-3: Compliance Export
**Priority:** Critical
**Modification Type:** New Addition

**Export Formats:**
- **CSV:** Machine-readable for analysis
- **PDF:** Professional format for auditors
- **JSON:** Full structured data export

**Export Options:**
- Date range selection
- Filter by user, action, entity
- Include/exclude system actions
- Signed/certified exports (digital signature)

**PDF Export Features:**
- Company header and info
- Export date and user
- Audit log entries in table format
- Signature line for verification
- Page numbers and total page count

**Compliance Requirements:**
- Tamper-evident export (hash signature)
- Timestamp verification
- User certification
- Retention policy documentation

**Acceptance Criteria:**
- [ ] Exports complete in <10 seconds for 1000 entries
- [ ] PDF formatted professionally
- [ ] CSV import-friendly for Excel/analysis tools
- [ ] Digital signature validates integrity

---

### FR-4: Retention Policy Management
**Priority:** High
**Modification Type:** New Addition

**Retention Configuration:**
- Default: 7 years (accounting standard)
- Configurable: 1-99 years
- Cannot be set less than 7 years (compliance)
- Warning if reduction attempted

**Archival Process:**
- Automatic archival after retention period
- Archived logs stored separately
- Read-only access to archives
- Restore from archive capability (admin only)

**Storage Management:**
- Estimate storage used by audit logs
- Alert if storage exceeds threshold
- Compression for archived logs

**Acceptance Criteria:**
- [ ] Archival runs monthly automatically
- [ ] Archived logs accessible but read-only
- [ ] Storage estimates accurate ±5%
- [ ] Cannot delete logs before retention period

---

## ADDED Requirements

### FR-5: Audit Log Dashboard
**Priority:** Medium
**Modification Type:** New Addition

**Dashboard Widgets:**
- Recent activity (last 10 events)
- Activity by user (bar chart)
- Most common actions
- Peak activity times

**Analytics:**
- Actions per day/week/month trend
- User activity heatmap
- Entity modification frequency
- Anomaly detection (unusual activity)

**Acceptance Criteria:**
- [ ] Dashboard loads in <2 seconds
- [ ] Charts responsive and interactive
- [ ] Anomaly detection flags unusual patterns

---

### FR-6: Audit Alerts
**Priority:** Medium
**Modification Type:** New Addition

**Alert Triggers:**
- Large transaction deleted (>$1000)
- Bulk deletions (>10 items at once)
- Permission changes
- Off-hours activity (outside business hours)
- Failed login attempts (>3)

**Alert Actions:**
- Email to admin
- In-app notification
- SMS for critical alerts (optional)
- Webhook for integrations

**Acceptance Criteria:**
- [ ] Alerts trigger within 1 minute
- [ ] False positive rate <5%
- [ ] Alert preferences configurable
- [ ] Alert history viewable

---

## Technical Architecture

**Enhanced Data Model:**
```typescript
interface AuditLogEntry {
  id: string;
  company_id: string;
  timestamp: Date;
  user_id: string;
  user_email: string; // Cached for deleted users
  action: 'create' | 'update' | 'delete' | 'void' | 'restore';
  entity_type: string;
  entity_id: string;
  before_value?: any; // JSON
  after_value?: any; // JSON
  ip_address_hash: string; // Hashed for privacy
  device_info?: string;
  session_id: string;
  change_reason?: string; // Optional user-provided reason
  tags: string[]; // For categorization
}

interface AuditLogExport {
  export_id: string;
  user_id: string;
  export_date: Date;
  filters_applied: any;
  entry_count: number;
  file_url: string;
  signature_hash: string; // Tamper detection
  expires_at: Date;
}
```

**Search Index:**
```sql
CREATE INDEX idx_audit_timestamp ON audit_log (company_id, timestamp DESC);
CREATE INDEX idx_audit_user ON audit_log (company_id, user_id, timestamp DESC);
CREATE INDEX idx_audit_entity ON audit_log (company_id, entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_log (company_id, action, timestamp DESC);
CREATE FULLTEXT INDEX idx_audit_search ON audit_log (before_value, after_value);
```

## Testing Strategy

### Unit Tests
- Search and filter logic
- Diff calculation accuracy
- Export generation
- Retention policy enforcement

### Integration Tests
- End-to-end audit logging
- Export and verify signature
- Search performance with 10,000+ entries
- Archival process

### Compliance Tests
- 7-year retention enforced
- Exports tamper-evident
- All financial changes logged
- User actions traceable

## Success Metrics
- 100% of financial changes logged (zero gaps)
- Search results in <1 second for 99% of queries
- Export success rate >99.9%
- Zero compliance violations in audits
- Admin users access audit log 1x per week average

## Related Documentation
- SPEC.md § ACCT-011 (Audit Log)
- ROADMAP.md Group B (B8), Group E (E7)
- Compliance requirements (GAAP, SOX, GDPR)
- Data retention policies
