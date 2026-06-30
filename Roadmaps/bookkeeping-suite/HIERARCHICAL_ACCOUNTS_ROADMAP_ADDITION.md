# New Roadmap Items: Hierarchical Accounts & Consolidated Invoicing

**To be inserted in:** Group G - Growing Stronger (after G2)

---

## G3. Hierarchical Contacts Infrastructure (Nice)

**What:** Add parent/child relationships to customer and vendor accounts for managing multi-location businesses.

**OpenSpec Resources:**
- Change: `openspec/changes/hierarchical-accounts/`
- Proposal: `openspec/changes/hierarchical-accounts/proposal.md`
- Tasks: `openspec/changes/hierarchical-accounts/tasks.md`
- Validation: `openspec validate hierarchical-accounts`

**Status & Ownership:**
- Status: Not Started
- Priority: Medium (Nice - Power Feature)
- Owner: Unassigned
- Category: Data Model Enhancement

**Context:**
This enhances existing customer (C6) and vendor (D5) management WITHOUT breaking current functionality. All existing contacts remain "standalone" accounts. This is a progressive enhancement for businesses with complex account structures (e.g., selling to chains, franchises, or multi-location businesses).

**What This Enables:**
- Track parent companies with multiple sub-locations
- Group all sub-accounts under their parent
- View consolidated totals/reporting at the parent level
- Keep everything organized "in one spot"

**Example Use Case:**
- Parent Account: "Walmart Corporate"
- Sub-Accounts: "Walmart Store #123", "Walmart Store #456", "Walmart Distribution Center"
- Benefit: Invoice individual stores, track/report at corporate level

**Schema Changes (Non-Breaking):**
```sql
ALTER TABLE contacts ADD COLUMN parent_id UUID NULL REFERENCES contacts(id);
ALTER TABLE contacts ADD COLUMN account_type VARCHAR(20) DEFAULT 'standalone';
ALTER TABLE contacts ADD COLUMN hierarchy_level INTEGER DEFAULT 0;
CREATE INDEX idx_contacts_parent_id ON contacts(parent_id);
```

**Migration Strategy:**
- All existing contacts default to: `parent_id = NULL`, `account_type = 'standalone'`
- Zero data migration needed
- Backwards compatible - existing functionality unchanged

**Dependencies:** {C6, D5}
- C6: Client/Customer Management - Basic (COMPLETE)
- D5: Vendor Management - Basic (COMPLETE)

**Joy Opportunity:** "Your business is growing! Now you can track all those locations in one organized place."

**Delight Detail:** When viewing a parent account, show a visual tree/hierarchy with expandable sub-accounts. Show consolidated totals with a breakdown option.

**Includes:**
- Parent account selector in contact creation/edit UI
- Hierarchical list view with expand/collapse
- "View all sub-accounts" functionality
- Filter reports by parent or show hierarchy
- Account type indicator (standalone/parent/child)
- Validation: prevent circular references
- Validation: limit nesting depth (e.g., max 3 levels)

**Acceptance Criteria:**
- [ ] Can assign parent account when creating/editing customer
- [ ] Can assign parent account when creating/editing vendor
- [ ] Parent account dropdown shows only valid parents (no circular refs)
- [ ] Contact list view shows hierarchy with visual indicators
- [ ] Can expand/collapse parent accounts to show sub-accounts
- [ ] Reports can filter by parent account
- [ ] Reports can show hierarchy breakdown
- [ ] Sub-account count shown on parent account
- [ ] Can convert standalone to parent/child at any time
- [ ] Deleting parent account prompts: orphan children or block deletion
- [ ] All hierarchy data encrypted with user data
- [ ] Performance tested with 1000+ contacts including hierarchies

**Test Strategy:**
- **Unit Tests:**
  - Parent/child relationship validation
  - Circular reference prevention
  - Hierarchy depth limits
  - Account type transitions
- **Integration Tests:**
  - Contact CRUD with hierarchy
  - Report aggregation by parent
  - Filtering by hierarchy level
- **E2E Tests:**
  - Create parent and sub-accounts workflow
  - Navigate hierarchy in contact list
  - View consolidated parent account details
- **Performance Tests:**
  - Query performance with deep hierarchies
  - List rendering with 100+ parent accounts
  - Report generation with hierarchy filters
- **Data Integrity Tests:**
  - Migration of existing contacts (should remain standalone)
  - Preventing orphaned accounts
  - Handling deleted parent accounts

**Risks & Mitigation:**
- Risk: Users may create confusing hierarchies
  - Mitigation: Limit nesting depth, clear visual indicators, "flatten hierarchy" option
- Risk: Queries may slow down with deep hierarchies
  - Mitigation: Indexed parent_id, recursive CTE optimization, pagination
- Risk: Deleting parent accounts creates orphans
  - Mitigation: Warning dialog with options (orphan children or prevent deletion)
- Risk: Circular references could break system
  - Mitigation: Validation prevents parent_id pointing to self or descendants

**External Dependencies:**
- Libraries: None (uses existing Dexie.js)
- Infrastructure: None

**Backwards Compatibility:**
- ✅ All existing contacts continue working as standalone
- ✅ No UI changes required for users who don't use hierarchies
- ✅ All existing queries/reports work unchanged
- ✅ Optional feature - only visible when first parent/child is created

**Spec Reference:** ACCT-012 (new)

---

## G4. Consolidated Invoice Creation (Nice)

**What:** Create invoices that consolidate multiple sub-accounts under a parent account, with options to itemize or total each location's order.

**OpenSpec Resources:**
- Change: `openspec/changes/hierarchical-accounts/`
- Proposal: `openspec/changes/hierarchical-accounts/proposal.md`
- Tasks: `openspec/changes/hierarchical-accounts/tasks.md`
- Validation: `openspec validate hierarchical-accounts`

**Status & Ownership:**
- Status: Not Started
- Priority: Medium (Nice - Power Feature)
- Owner: Unassigned
- Category: Invoicing Enhancement

**Context:**
Builds on G3 (Hierarchical Contacts) to enable consolidated billing. Businesses can invoice either individual locations OR send one invoice to corporate that breaks down all locations' orders.

**What This Enables:**
Two invoicing modes:

**Mode A: Invoice Individual Sub-Account (existing)**
- Invoice to: Store #123
- Shows: $500 of items ordered by Store #123
- Use case: Each location pays separately

**Mode B: Invoice Parent Account with Breakdown (new)**
- Invoice to: New Seasons Corporate (parent)
- Shows breakdown:
  - Store #123: $500
  - Store #456: $300
  - **Total: $800**
- Display options:
  - **Itemized**: Show each sub-account's line items separately (detailed)
  - **Totaled**: Show just subtotals per sub-account (summary)
  - **Hybrid**: Section per sub-account with their items
- Use case: Corporate does consolidated billing for all locations

**Example Invoice Layout (Itemized Mode):**
```
Invoice to: New Seasons Corporate
Invoice Date: 2026-01-15

Store #123 Orders:
  - Widget A × 10    $250
  - Widget B × 5     $250
  Subtotal: $500

Store #456 Orders:
  - Widget A × 6     $150
  - Widget C × 3     $150
  Subtotal: $300

TOTAL: $800
```

**Schema Changes:**
```sql
ALTER TABLE invoices ADD COLUMN consolidation_type VARCHAR(20) DEFAULT 'individual';
ALTER TABLE invoices ADD COLUMN parent_account_id UUID NULL REFERENCES contacts(id);

CREATE TABLE invoice_subaccount_sections (
  id UUID PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id),
  subaccount_id UUID REFERENCES contacts(id),
  section_order INTEGER,
  subtotal DECIMAL(15,2),
  created_at TIMESTAMP
);

CREATE INDEX idx_invoice_subaccount_sections_invoice ON invoice_subaccount_sections(invoice_id);
```

**Dependencies:** {G3, C7}
- G3: Hierarchical Contacts Infrastructure (NEW)
- C7: Invoice Creation - Basic (COMPLETE)

**Joy Opportunity:** "One invoice, multiple locations. Your corporate clients will love the clarity, and you'll love the organization."

**Delight Detail:**
- Invoice preview shows "This is what [Corporate Name] will see" with the breakdown
- Option to save consolidation preferences per parent account
- Quick-create: "Invoice all pending orders for [Parent]"

**Includes:**
- Consolidated invoice creation workflow
- Sub-account selection for consolidated invoices
- Display mode selector (itemized/totaled/hybrid)
- Section headers with sub-account names
- Subtotals per sub-account
- Grand total across all sub-accounts
- PDF templates for consolidated invoices
- Email subject/body adaptation for consolidated invoices
- Parent account billing preferences (default display mode)

**Acceptance Criteria:**
- [ ] Can create consolidated invoice selecting parent account
- [ ] Can select which sub-accounts to include in consolidated invoice
- [ ] Can choose display mode: itemized, totaled, or hybrid
- [ ] Invoice PDF shows clear sections per sub-account
- [ ] Subtotals calculated correctly per sub-account
- [ ] Grand total calculated correctly across all sub-accounts
- [ ] Can save default consolidation preferences per parent
- [ ] Invoice list distinguishes consolidated vs. individual invoices
- [ ] Can "explode" consolidated invoice into individual invoices if needed
- [ ] Payments can be allocated to parent or split across sub-accounts
- [ ] A/R aging report shows consolidated balances option
- [ ] All consolidated invoice data encrypted
- [ ] Performance tested with invoices containing 10+ sub-accounts

**Test Strategy:**
- **Unit Tests:**
  - Subtotal calculations per sub-account
  - Grand total calculations
  - Display mode rendering logic
  - Allocation of payments
- **Integration Tests:**
  - Consolidated invoice creation workflow
  - PDF generation for all display modes
  - A/R reporting with consolidated invoices
  - Payment allocation across sub-accounts
- **E2E Tests:**
  - Create consolidated invoice for parent with 3 sub-accounts
  - Switch between display modes in preview
  - Send consolidated invoice via email
  - Record payment against consolidated invoice
- **Accuracy Tests:**
  - Verify subtotals match line item totals
  - Verify grand total matches sum of subtotals
  - Verify payment allocation totals match payment amount

**Risks & Mitigation:**
- Risk: Consolidated invoices may be confusing to implement
  - Mitigation: Clear wireframes/mockups, iterative review, preview before send
- Risk: Payment allocation across sub-accounts adds complexity
  - Mitigation: Default to parent-level payment, optional split, clear UI
- Risk: PDF generation may fail with many sub-accounts
  - Mitigation: Pagination for large invoices, tested up to 20 sub-accounts
- Risk: Users may want to edit consolidated invoice after creation
  - Mitigation: Support editing, clear indication of which sub-account each line belongs to

**External Dependencies:**
- Libraries: pdfmake (already in use for invoices)
- Infrastructure: None

**Backwards Compatibility:**
- ✅ All existing individual invoices continue working unchanged
- ✅ Invoice creation defaults to individual mode
- ✅ Consolidated mode only available when parent accounts exist
- ✅ Optional feature - only visible when hierarchies are in use

**UI/UX Considerations:**
- Add "Billing Type" toggle: Individual / Consolidated
- When "Consolidated" selected: show parent selector + sub-account checkboxes
- Display mode selector: Radio buttons with visual preview icons
- Preview button shows draft PDF before finalizing
- Save preferences: "Always use [mode] for [Parent Name]"

**Spec Reference:** ACCT-012 (continued)

---

## Renumbering Note

After insertion, existing items will be renumbered:
- Current G3 (Basic Inventory Tracking) → becomes G5
- Current G4 (Sales Tax - Basic) → becomes G6
- Current G5 (Receipt OCR Processing) → becomes G7
- And so on...

---

## Integration Points

**With Existing Features:**
- C6 (Customer Management): Extended with hierarchy UI
- D5 (Vendor Management): Extended with hierarchy UI
- C7 (Invoice Creation): Extended with consolidation option
- F5 (A/R Aging Report): Extended with consolidation view option
- F6 (A/P Aging Report): Extended with consolidation view option

**New Spec Requirements Needed:**
- ACCT-012: Hierarchical Account Management
- ACCT-012.1: Parent/Child Contact Relationships
- ACCT-012.2: Consolidated Invoice Generation
- ACCT-012.3: Hierarchical Reporting

---
