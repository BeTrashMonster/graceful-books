# Vendor Management - Capability Specification

**Capability ID:** `vendor-management`
**Related Roadmap Items:** D5
**SPEC Reference:** ACCT-003
**Status:** In Development

## Overview

Vendor Management provides basic capabilities to create, store, and manage vendor records. This foundation enables expense tracking, bill management, and future features like 1099 generation and accounts payable aging reports.

## ADDED Requirements

### Functional Requirements

#### FR-1: Vendor Creation
**Priority:** Critical

Users SHALL be able to create vendor records with:

**Required Fields:**
- Vendor name (2-255 characters)

**Optional Fields:**
- Contact person name
- Email address (validated format)
- Phone number (flexible format, international supported)
- Address (structured: street, city, state, ZIP, country)
- Tax ID / EIN (for 1099 tracking)
- Website URL
- Payment terms (e.g., "Net 30", "Due on receipt")
- Default expense category
- Notes (free text, 1000 characters max)

**Acceptance Criteria:**
- [ ] Vendor name required and validated
- [ ] Email validation prevents invalid addresses
- [ ] Phone accepts various formats (US and international)
- [ ] Address autocomplete integrated (if API available)
- [ ] Tax ID masked for privacy
- [ ] All fields encrypted at rest

#### FR-2: Vendor List View
**Priority:** Critical

The vendor list SHALL provide:

**Display:**
- Vendor name (primary)
- Contact information preview
- Total spent (lifetime and YTD)
- Last transaction date
- Active/inactive status indicator
- Quick actions: Edit, View Details, Delete

**Sorting Options:**
- Alphabetical (A-Z, Z-A)
- Most recent activity
- Highest spending (lifetime or YTD)

**Filtering:**
- Active vs. inactive vendors
- Vendors with Tax ID (1099-eligible)
- By default expense category
- Search by name (fuzzy search)

**Pagination:**
- 25 vendors per page (configurable: 25/50/100)
- Total count displayed
- Jump to page functionality

**Acceptance Criteria:**
- [ ] List loads in < 1 second for 500 vendors
- [ ] Search returns results in < 300ms
- [ ] Sorting updates instantly
- [ ] Responsive design (mobile/tablet/desktop)

#### FR-3: Vendor Details View
**Priority:** High

Vendor detail page SHALL display:

**Overview Section:**
- Full contact information
- Payment terms
- Default expense category
- Notes
- Created date and last modified

**Activity Summary:**
- Total spent (lifetime)
- Total spent (YTD)
- Total spent (last 30 days)
- Number of transactions
- Average transaction amount

**Recent Transactions:**
- Last 10 transactions
- Date, amount, category, description
- Link to view full transaction
- "View All Transactions" button

**Upcoming Bills (if applicable):**
- Bills due in next 30 days
- Due date, amount, status

**Documents:**
- Attached W-9 (for 1099 tracking)
- Vendor agreements
- Upload/download functionality

**Acceptance Criteria:**
- [ ] All contact information displayed clearly
- [ ] Spending summaries accurate to the penny
- [ ] Recent transactions load quickly (< 500ms)
- [ ] Document upload supports PDF, images, Word docs
- [ ] Mobile-responsive layout

#### FR-4: Vendor Editing & Deletion
**Priority:** High

Users SHALL be able to:

**Edit:**
- Update any vendor field
- Change active/inactive status
- Version history tracked (audit log)

**Delete:**
- Soft delete (mark as inactive)
- Cannot hard delete if linked to transactions
- Warning shown: "This vendor has X transactions. Deleting will hide them but preserve history."
- Confirmation required

**Restore:**
- Reactivate inactive vendors
- Restore button on inactive vendor list

**Acceptance Criteria:**
- [ ] Edits save immediately
- [ ] Audit log captures all changes
- [ ] Deletion confirmation prevents accidents
- [ ] Soft delete preserves transaction history
- [ ] Restore functionality works reliably

#### FR-5: Vendor Integration with Expenses
**Priority:** Critical

Vendor records SHALL integrate with:

**Transaction Entry:**
- Vendor dropdown on expense entry
- Auto-populate default category when vendor selected
- Autocomplete vendor name (fuzzy search)
- "Create new vendor" inline option

**Bills:**
- Link bill to vendor
- Track bills owed to each vendor
- Vendor appears on bill entry form

**Reporting:**
- Expenses by vendor report
- Vendor spending summary
- 1099 tracking (future, foundation laid)

**Acceptance Criteria:**
- [ ] Vendor selection in expense entry works smoothly
- [ ] Default category applied automatically
- [ ] Autocomplete suggests vendors after 2 characters
- [ ] Inline vendor creation doesn't disrupt workflow

### Non-Functional Requirements

#### NFR-1: Performance
- Vendor list loads in < 1 second for 1000 vendors
- Search results in < 300ms
- Vendor creation saves in < 500ms
- Autocomplete suggestions in < 200ms

#### NFR-2: Data Privacy
- All vendor data encrypted at rest
- Tax ID/EIN never transmitted unencrypted
- Masked display of sensitive fields
- GDPR-compliant data deletion

#### NFR-3: Scalability
- Supports 5000+ vendors per company without degradation
- Pagination prevents memory issues
- Indexed searches for performance

## Design Considerations

### User Experience

**Vendor Creation Flow:**
```
[Expense Entry Page]
    → [Select Vendor Dropdown]
    → [Type vendor name]
    → [Not found? "Create New Vendor"]
    → [Inline Quick-Create Form]
    → [Name + Category]
    → [Save & Continue]
    → [Expense entry resumes with vendor selected]

OR

[Vendors Page]
    → [+ New Vendor Button]
    → [Full Vendor Form]
    → [All fields available]
    → [Save]
    → [Celebration: "Your first vendor! Keeping track helps you understand where your money goes."]
```

**Joy Opportunities:**
- First vendor created: "Your first vendor! Keeping track of who you pay helps you understand where your money goes. No judgment - just clarity."
- Milestone: "10 vendors! Your supplier network is growing."
- Spending insight: "You've spent $2,400 with [Vendor] this year. That's your #1 expense partner."
- Clean data: "All your vendors have email addresses. That's organized!"

**DISC Adaptations:**
- **D:** Quick-create inline form, minimal required fields
- **I:** Friendly labels: "Who are you paying?"
- **S:** Step-by-step creation wizard option
- **C:** All fields available, organized sections

### Technical Architecture


**Components:**
```typescript
// New vendor management components
VendorList.tsx              // Main vendor list view
VendorListItem.tsx          // Individual vendor row
VendorDetail.tsx            // Vendor detail page
VendorForm.tsx              // Create/edit vendor form
VendorQuickCreate.tsx       // Inline quick-create modal
VendorSearch.tsx            // Search and autocomplete
VendorSpendingSummary.tsx   // Spending analytics widget
```

**Data Model (uses CONTACTS table):**
```typescript
interface Vendor {
  id: string;
  company_id: string;
  type: 'VENDOR' | 'BOTH'; // BOTH = customer and vendor
  name: string; // encrypted
  contact_person?: string; // encrypted
  email?: string; // encrypted
  phone?: string; // encrypted
  address?: {
    street: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  }; // encrypted
  tax_id?: string; // encrypted, for 1099
  website?: string;
  payment_terms?: string; // plaintext
  default_expense_category?: string; // account_id
  notes?: string; // encrypted
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date; // soft delete
}
```

**Vendor Spending Calculation:**
```typescript
async function getVendorSpending(vendorId: string, period: 'lifetime' | 'ytd' | 'last30') {
  // Query TRANSACTIONS and TRANSACTION_LINES
  // WHERE linked vendor = vendorId
  // AND transaction type = BILL_PAYMENT or EXPENSE
  // AND date within period
  // SUM(amount)

  return {
    total: number;
    transactionCount: number;
    averageAmount: number;
    lastTransactionDate: Date;
  };
}
```

**Autocomplete Implementation:**
```typescript
// Fuzzy search for vendor names
function searchVendors(query: string): Vendor[] {
  // 1. Exact match first
  // 2. Starts with query
  // 3. Contains query (fuzzy)
  // Limit to 10 results
  // Return sorted by relevance
}
```

## Testing Strategy

### Unit Tests
- Vendor creation validation
- Vendor update logic
- Soft delete and restore
- Spending calculation accuracy
- Search algorithm (fuzzy matching)

### Integration Tests
- Create vendor end-to-end
- Link vendor to expense transaction
- Vendor spending reports
- Vendor deletion with transaction history
- Autocomplete in transaction entry

### User Acceptance Tests
- Create vendor via full form
- Create vendor inline during expense entry
- Edit vendor information
- Delete and restore vendor
- Search and filter vendor list
- View vendor spending summary

## Open Questions

1. **1099 Threshold:** Should we auto-flag vendors approaching 1099 threshold ($600)?
   - **Decision Needed By:** Product Manager + Accountant Consultant
   - **Impact:** Medium - affects future 1099 feature

2. **Duplicate Detection:** Should we warn users about potential duplicate vendors?
   - **Decision Needed By:** UX Designer + Product Manager
   - **Impact:** Medium - affects data quality

3. **Bulk Import:** Should we support CSV import of vendor list?
   - **Decision Needed By:** Product Manager
   - **Impact:** Low - migration feature, nice-to-have

4. **Vendor Categories:** Should vendors have custom categories/tags?
   - **Decision Needed By:** Product Manager
   - **Impact:** Low - future enhancement

## Success Metrics

- **Adoption Rate:** 80%+ of expense transactions linked to vendors
- **Data Quality:** 70%+ of vendors have email addresses
- **Usage:** Average user has 15-20 active vendors
- **Inline Creation:** 60%+ of vendors created inline during expense entry
- **Time Savings:** Vendor autocomplete reduces expense entry time by 30%
- **1099 Readiness:** 90%+ of 1099-eligible vendors have Tax ID recorded

## Related Documentation

- SPEC.md § ACCT-003 (Bills & Expense Management)
- SPEC.md § ARCH-005-TABLE-CONTACTS (Database schema)
- ROADMAP.md Group D (D5), Group G (G7 - 1099 tracking)
- Transaction entry components
- Reporting engine for vendor spending analysis
