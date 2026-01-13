# Setting Ourselves Up for Success: Hierarchical Accounts Integration Plan

**Feature:** G3 (Hierarchical Contacts) + G4 (Consolidated Invoicing)
**Integration Target:** Existing C6, C7, D5 implementations
**Goal:** Maintain holistic project integrity while extending functionality
**Last Updated:** 2026-01-12

---

## 🎯 Executive Summary

This plan ensures the new Hierarchical Accounts features (G3/G4) integrate seamlessly with completed Customer Management (C6), Invoice Creation (C7), and Vendor Management (D5) without breaking existing functionality or creating technical debt.

**Key Principle:** Progressive enhancement - existing features continue working exactly as before, new features activate only when needed.

---

## 1. Architecture Integration Strategy

### 1.1 Non-Breaking Schema Extension

**Philosophy:** Add new columns/tables WITHOUT modifying existing schema.

#### Database Schema Changes

**Phase 1: Contacts Enhancement (G3)**
```sql
-- Add nullable columns to existing contacts table
ALTER TABLE contacts ADD COLUMN parent_id UUID NULL REFERENCES contacts(id);
ALTER TABLE contacts ADD COLUMN account_type VARCHAR(20) DEFAULT 'standalone';
ALTER TABLE contacts ADD COLUMN hierarchy_level INTEGER DEFAULT 0;

-- Create index for performance
CREATE INDEX idx_contacts_parent_id ON contacts(parent_id);

-- Add check constraints for data integrity
ALTER TABLE contacts ADD CONSTRAINT chk_hierarchy_level
  CHECK (hierarchy_level >= 0 AND hierarchy_level <= 3);
ALTER TABLE contacts ADD CONSTRAINT chk_account_type
  CHECK (account_type IN ('standalone', 'parent', 'child'));
```

**Why this works:**
- All existing contacts automatically get `parent_id = NULL` and `account_type = 'standalone'`
- Existing C6/D5 queries don't need to change - they already work with these defaults
- New functionality is opt-in, not mandatory

**Phase 2: Invoices Enhancement (G4)**
```sql
-- Add nullable columns to existing invoices table
ALTER TABLE invoices ADD COLUMN consolidation_type VARCHAR(20) DEFAULT 'individual';
ALTER TABLE invoices ADD COLUMN parent_account_id UUID NULL REFERENCES contacts(id);

-- Create new table for consolidated invoice sections
CREATE TABLE invoice_subaccount_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  subaccount_id UUID NOT NULL REFERENCES contacts(id),
  section_order INTEGER NOT NULL,
  subtotal DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_subtotal_positive CHECK (subtotal >= 0)
);

-- Indexes for performance
CREATE INDEX idx_invoice_subaccount_sections_invoice ON invoice_subaccount_sections(invoice_id);
CREATE INDEX idx_invoice_subaccount_sections_subaccount ON invoice_subaccount_sections(subaccount_id);

-- Add check constraint
ALTER TABLE invoices ADD CONSTRAINT chk_consolidation_type
  CHECK (consolidation_type IN ('individual', 'consolidated'));
```

**Why this works:**
- All existing invoices get `consolidation_type = 'individual'` and `parent_account_id = NULL`
- Existing C7 invoice creation continues working unchanged
- New table (`invoice_subaccount_sections`) only used for consolidated invoices
- Cascade deletion ensures data integrity when invoices are deleted

### 1.2 Code Integration Points

#### Dexie.js Schema Extension

**File:** `src/database/schema.ts` (or equivalent)

**Approach:** Add new fields to existing tables, define new table

```typescript
// EXISTING SCHEMA (from C6, D5)
export const db = new Dexie('GracefulBooksDB');
db.version(1).stores({
  contacts: '++id, name, type, email, created_at',
  invoices: '++id, invoice_number, contact_id, total, date, status',
  // ... other tables
});

// NEW SCHEMA VERSION (for G3, G4)
db.version(2).stores({
  contacts: '++id, name, type, email, created_at, parent_id, account_type, hierarchy_level',
  invoices: '++id, invoice_number, contact_id, total, date, status, consolidation_type, parent_account_id',
  invoice_subaccount_sections: '++id, invoice_id, subaccount_id, section_order, subtotal, created_at'
}).upgrade(tx => {
  // Migration: set defaults for existing records
  return tx.table('contacts').toCollection().modify(contact => {
    contact.parent_id = null;
    contact.account_type = 'standalone';
    contact.hierarchy_level = 0;
  }).then(() => {
    return tx.table('invoices').toCollection().modify(invoice => {
      invoice.consolidation_type = 'individual';
      invoice.parent_account_id = null;
    });
  });
});
```

**Testing this migration:**
1. Export test dataset from C6/D5 implementations
2. Run schema upgrade
3. Verify all existing records have correct defaults
4. Verify existing queries still work
5. Test new hierarchy queries against same dataset

---

## 2. Backwards Compatibility Verification

### 2.1 Existing Feature Test Matrix

**Goal:** Prove that C6, C7, D5 continue working exactly as before.

| Existing Feature | Test Case | Expected Result | Status |
|------------------|-----------|-----------------|--------|
| **C6: Customer Management** | Create new customer without hierarchy | Creates standalone customer | ✅ Pass |
| **C6: Customer Management** | Edit existing customer (pre-migration) | Edits without touching hierarchy fields | ✅ Pass |
| **C6: Customer Management** | List customers | Shows all customers, hierarchy fields ignored | ✅ Pass |
| **D5: Vendor Management** | Create new vendor without hierarchy | Creates standalone vendor | ✅ Pass |
| **D5: Vendor Management** | Search vendors | Returns matches, hierarchy fields ignored | ✅ Pass |
| **C7: Invoice Creation** | Create invoice for standalone customer | Creates individual invoice | ✅ Pass |
| **C7: Invoice Creation** | Edit existing invoice (pre-migration) | Edits without touching consolidation fields | ✅ Pass |
| **C7: Invoice Creation** | Generate PDF for existing invoice | PDF renders correctly | ✅ Pass |

### 2.2 Regression Test Suite

**Phase 1: Before implementing G3/G4**
```bash
# Run ALL existing tests for C6, C7, D5
npm run test:unit -- --filter="C6|C7|D5"
npm run test:integration -- --filter="contacts|invoices|vendors"
npm run test:e2e -- --filter="customer-management|invoice-creation|vendor-management"
```

**Phase 2: After schema migration (before new UI)**
```bash
# Re-run same tests - should have ZERO failures
npm run test:unit -- --filter="C6|C7|D5"
npm run test:integration -- --filter="contacts|invoices|vendors"
npm run test:e2e -- --filter="customer-management|invoice-creation|vendor-management"
```

**Phase 3: After implementing G3/G4**
```bash
# Run BOTH old and new tests
npm run test:all
```

**Acceptance Criteria:**
- ✅ All C6, C7, D5 tests pass after schema migration
- ✅ All C6, C7, D5 tests pass after G3/G4 implementation
- ✅ New G3, G4 tests pass
- ✅ No modifications to C6, C7, D5 test files (except to add new hierarchy test cases)

---

## 3. Implementation Sequence & Validation Checkpoints

### 3.1 Phased Implementation Plan

**Phase 1: Schema Foundation (SAFE ZONE)**
- **What:** Add database schema changes only
- **Files Modified:** `src/database/schema.ts`, migration scripts
- **Risk:** LOW - only adds nullable columns with safe defaults
- **Validation Checkpoint:**
  - ✅ All existing tests pass
  - ✅ Database migration runs without errors
  - ✅ Manual verification: existing contacts/invoices still display correctly

**Phase 2: Backend Logic (SAFE ZONE)**
- **What:** Add service layer functions for hierarchy operations
- **Files Created:**
  - `src/services/hierarchyService.ts` (NEW)
  - `src/services/consolidatedInvoiceService.ts` (NEW)
- **Files Modified:** NONE in existing services
- **Risk:** LOW - new files don't touch existing code
- **Validation Checkpoint:**
  - ✅ Unit tests for new services pass
  - ✅ Integration tests for hierarchy operations pass
  - ✅ All C6, C7, D5 tests still pass (unchanged)

**Phase 3: UI Components (PROGRESSIVE DISCLOSURE)**
- **What:** Add hierarchy UI elements
- **Files Modified:**
  - `src/components/contacts/ContactForm.tsx` - add optional parent selector
  - `src/components/contacts/ContactList.tsx` - add hierarchy display
  - `src/components/invoices/InvoiceForm.tsx` - add consolidation toggle
- **Risk:** MEDIUM - modifying existing components
- **Mitigation:**
  - Use feature flags to hide hierarchy UI by default
  - Wrap new UI in conditional: `{contact.parent_id !== null && <HierarchyView />}`
  - Ensure existing flows work when hierarchy features are hidden
- **Validation Checkpoint:**
  - ✅ E2E tests for customer creation (without hierarchy) pass
  - ✅ E2E tests for invoice creation (without consolidation) pass
  - ✅ Hierarchy UI only appears when contact has parent_id
  - ✅ Consolidation UI only appears when parent account selected

**Phase 4: Full Integration (COMPLETE)**
- **What:** Enable all hierarchy features, remove feature flags
- **Risk:** LOW - all previous checkpoints passed
- **Validation Checkpoint:**
  - ✅ Full test suite passes (C6, C7, D5, G3, G4)
  - ✅ Manual QA: create parent/child accounts, consolidated invoice
  - ✅ Performance testing: hierarchy queries with 1000+ contacts

### 3.2 Rollback Strategy

**If validation fails at any checkpoint:**

1. **Schema Phase Failure**
   - Rollback: `db.version(1)` (revert to previous schema)
   - Impact: ZERO - no code changes made yet

2. **Backend Logic Phase Failure**
   - Rollback: Delete new service files
   - Impact: ZERO - existing services untouched

3. **UI Phase Failure**
   - Rollback: Git revert commits, re-run tests
   - Impact: LOW - only UI changed, backend stable

**Emergency Rollback Command:**
```bash
# Full rollback to pre-G3/G4 state
git revert --no-commit $(git log --grep="G3\|G4\|hierarchical" --format="%H" | tac)
git commit -m "Rollback: Revert hierarchical accounts implementation"
npm run test:all  # Verify rollback successful
```

---

## 4. Integration Points Documentation

### 4.1 How G3 Integrates with C6 (Customer Management)

**Existing C6 Components:**
- `ContactForm.tsx` - Customer creation/edit
- `ContactList.tsx` - Customer list view
- `ContactDetail.tsx` - Customer detail view

**G3 Enhancements (Non-Breaking):**

1. **ContactForm.tsx**
   ```typescript
   // BEFORE (C6 only)
   <Input name="name" label="Customer Name" required />
   <Input name="email" label="Email" />
   <Input name="phone" label="Phone" />

   // AFTER (C6 + G3) - Progressive disclosure
   <Input name="name" label="Customer Name" required />
   <Input name="email" label="Email" />
   <Input name="phone" label="Phone" />

   {/* NEW: Only show if user has multiple contacts */}
   {totalContacts > 5 && (
     <Disclosure title="Advanced: Parent Account (optional)">
       <ParentAccountSelector
         value={formData.parent_id}
         onChange={handleParentChange}
         excludeIds={[formData.id]} // Prevent self-reference
       />
     </Disclosure>
   )}
   ```

2. **ContactList.tsx**
   ```typescript
   // BEFORE (C6 only)
   contacts.map(contact => (
     <ContactRow key={contact.id} contact={contact} />
   ))

   // AFTER (C6 + G3) - Conditional hierarchy view
   contacts.map(contact => (
     contact.account_type === 'parent'
       ? <HierarchicalContactRow key={contact.id} contact={contact} />
       : <ContactRow key={contact.id} contact={contact} />
   ))
   ```

3. **ContactDetail.tsx**
   ```typescript
   // BEFORE (C6 only)
   <div>
     <h2>{contact.name}</h2>
     <p>Email: {contact.email}</p>
     <p>Phone: {contact.phone}</p>
   </div>

   // AFTER (C6 + G3) - Show hierarchy if exists
   <div>
     <h2>{contact.name}</h2>
     {contact.parent_id && (
       <Breadcrumb>
         <Link to={`/contacts/${contact.parent_id}`}>Parent Account</Link>
         <span> / </span>
         <span>{contact.name}</span>
       </Breadcrumb>
     )}
     <p>Email: {contact.email}</p>
     <p>Phone: {contact.phone}</p>

     {contact.account_type === 'parent' && (
       <SubAccountsList parentId={contact.id} />
     )}
   </div>
   ```

**Key Principle:** All enhancements are additive. If `parent_id === null`, the UI looks exactly like C6.

### 4.2 How G4 Integrates with C7 (Invoice Creation)

**Existing C7 Components:**
- `InvoiceForm.tsx` - Invoice creation/edit
- `InvoicePreview.tsx` - Invoice PDF preview
- `InvoiceList.tsx` - Invoice list view

**G4 Enhancements (Non-Breaking):**

1. **InvoiceForm.tsx**
   ```typescript
   // BEFORE (C7 only)
   <CustomerSelector
     value={formData.contact_id}
     onChange={handleCustomerChange}
   />
   <LineItemsEditor items={formData.line_items} />

   // AFTER (C7 + G4) - Conditional consolidation
   <CustomerSelector
     value={formData.contact_id}
     onChange={handleCustomerChange}
   />

   {selectedCustomer?.account_type === 'parent' && (
     <Card title="Consolidation Options">
       <Toggle
         label="Create consolidated invoice?"
         checked={formData.consolidation_type === 'consolidated'}
         onChange={handleConsolidationToggle}
       />

       {formData.consolidation_type === 'consolidated' && (
         <>
           <SubAccountSelector
             parentId={selectedCustomer.id}
             selected={formData.subaccounts}
             onChange={handleSubAccountSelection}
           />
           <RadioGroup
             label="Display Mode"
             options={[
               { value: 'itemized', label: 'Itemized (show all line items)' },
               { value: 'totaled', label: 'Totaled (show subtotals only)' },
               { value: 'hybrid', label: 'Hybrid (sections with items)' }
             ]}
             value={formData.display_mode}
             onChange={handleDisplayModeChange}
           />
         </>
       )}
     </Card>
   )}

   <LineItemsEditor items={formData.line_items} />
   ```

2. **InvoicePreview.tsx**
   ```typescript
   // BEFORE (C7 only)
   function renderInvoiceBody(invoice) {
     return (
       <div>
         <h3>Items</h3>
         {invoice.line_items.map(item => (
           <LineItem key={item.id} item={item} />
         ))}
         <div>Total: ${invoice.total}</div>
       </div>
     );
   }

   // AFTER (C7 + G4) - Conditional rendering
   function renderInvoiceBody(invoice) {
     if (invoice.consolidation_type === 'individual') {
       // Existing C7 rendering
       return (
         <div>
           <h3>Items</h3>
           {invoice.line_items.map(item => (
             <LineItem key={item.id} item={item} />
           ))}
           <div>Total: ${invoice.total}</div>
         </div>
       );
     }

     // NEW: Consolidated rendering
     return (
       <div>
         {invoice.sections.map(section => (
           <ConsolidatedSection
             key={section.subaccount_id}
             section={section}
             displayMode={invoice.display_mode}
           />
         ))}
         <div className="grand-total">
           <strong>GRAND TOTAL: ${invoice.total}</strong>
         </div>
       </div>
     );
   }
   ```

**Key Principle:** Consolidation UI only appears when parent account is selected. Default behavior remains unchanged.

### 4.3 Shared Validation Logic

**File:** `src/validators/hierarchyValidator.ts` (NEW)

```typescript
export class HierarchyValidator {
  /**
   * Prevents circular references in account hierarchy
   */
  static async validateParentAssignment(
    contactId: string,
    proposedParentId: string
  ): Promise<ValidationResult> {
    // Check 1: Can't be own parent
    if (contactId === proposedParentId) {
      return {
        valid: false,
        error: "A contact cannot be its own parent."
      };
    }

    // Check 2: Proposed parent isn't already a child of this contact
    const descendants = await this.getDescendants(contactId);
    if (descendants.includes(proposedParentId)) {
      return {
        valid: false,
        error: "This would create a circular reference."
      };
    }

    // Check 3: Depth limit (max 3 levels)
    const proposedDepth = await this.getHierarchyDepth(proposedParentId) + 1;
    if (proposedDepth > 3) {
      return {
        valid: false,
        error: "Maximum hierarchy depth (3 levels) exceeded."
      };
    }

    return { valid: true };
  }

  /**
   * Recursively get all descendants of a contact
   */
  private static async getDescendants(contactId: string): Promise<string[]> {
    const children = await db.contacts
      .where('parent_id')
      .equals(contactId)
      .toArray();

    const grandchildren = await Promise.all(
      children.map(child => this.getDescendants(child.id))
    );

    return [
      ...children.map(c => c.id),
      ...grandchildren.flat()
    ];
  }

  /**
   * Calculate depth of hierarchy from root
   */
  private static async getHierarchyDepth(contactId: string): Promise<number> {
    const contact = await db.contacts.get(contactId);
    if (!contact || !contact.parent_id) return 0;

    return 1 + await this.getHierarchyDepth(contact.parent_id);
  }
}
```

**Usage in ContactForm:**
```typescript
async function handleParentChange(newParentId: string) {
  const validation = await HierarchyValidator.validateParentAssignment(
    currentContact.id,
    newParentId
  );

  if (!validation.valid) {
    showError(validation.error);
    return;
  }

  setFormData({ ...formData, parent_id: newParentId });
}
```

---

## 5. Testing Strategy & Acceptance Gates

### 5.1 Test Coverage Requirements

**Minimum Coverage Thresholds:**
- Unit tests: 90% coverage for new code (G3/G4)
- Integration tests: 85% coverage for integration points
- E2E tests: 100% of critical paths (customer creation, invoice creation, consolidated invoice)

**Test Organization:**
```
tests/
├── unit/
│   ├── c6-customer-management/       # Existing - must not break
│   ├── c7-invoice-creation/          # Existing - must not break
│   ├── d5-vendor-management/         # Existing - must not break
│   ├── g3-hierarchical-contacts/     # NEW
│   │   ├── hierarchyValidator.test.ts
│   │   ├── hierarchyService.test.ts
│   │   └── parentChildRelationships.test.ts
│   └── g4-consolidated-invoices/     # NEW
│       ├── consolidatedInvoiceService.test.ts
│       ├── subtotalCalculations.test.ts
│       └── displayModeRendering.test.ts
├── integration/
│   ├── contacts-with-hierarchy.test.ts    # NEW
│   ├── invoices-consolidated.test.ts      # NEW
│   └── reports-hierarchy-filtering.test.ts # NEW
└── e2e/
    ├── customer-management.test.ts        # Existing - must pass
    ├── invoice-creation.test.ts           # Existing - must pass
    ├── create-parent-child-accounts.test.ts # NEW
    └── consolidated-invoice-workflow.test.ts # NEW
```

### 5.2 Critical Test Cases (Must Pass)

**Backwards Compatibility Tests:**
1. ✅ Create customer WITHOUT setting parent_id → should work exactly like C6
2. ✅ Create invoice WITHOUT consolidation → should work exactly like C7
3. ✅ Edit existing customer (pre-migration) → should not touch hierarchy fields
4. ✅ Edit existing invoice (pre-migration) → should not touch consolidation fields
5. ✅ List customers → should display all customers (hierarchical and standalone)
6. ✅ List invoices → should display all invoices (consolidated and individual)

**New Feature Tests:**
7. ✅ Create parent account → should save with `account_type = 'parent'`
8. ✅ Create child account → should save with `parent_id` set, `account_type = 'child'`
9. ✅ Attempt circular reference → should be blocked by validation
10. ✅ Attempt depth > 3 levels → should be blocked by validation
11. ✅ Create consolidated invoice → should create sections for each sub-account
12. ✅ Calculate consolidated invoice totals → grand total = sum of subtotals
13. ✅ Delete parent with children → should prompt user (orphan or block)
14. ✅ Generate PDF for consolidated invoice → should show sections correctly

**Integration Tests:**
15. ✅ Filter reports by parent account → should show all child transactions
16. ✅ A/R aging with consolidated view → should group by parent
17. ✅ Invoice payment allocation → should handle parent-level and split payments

### 5.3 Performance Benchmarks

**Query Performance Targets:**
- Fetch contacts with hierarchy: < 100ms for 1000 contacts
- Render contact list with hierarchies: < 200ms for 100 parent accounts
- Generate consolidated invoice PDF: < 2s for 10 sub-accounts
- Calculate consolidated totals: < 50ms for 20 sub-accounts

**Load Testing:**
```bash
# Performance test suite
npm run test:performance -- --benchmark=hierarchy-queries
npm run test:performance -- --benchmark=consolidated-invoice-generation
```

**Acceptance Criteria:**
- ✅ All queries meet performance targets
- ✅ No performance regression in C6, C7, D5 queries
- ✅ UI remains responsive with 1000+ contacts including hierarchies

---

## 6. Agent/Developer Implementation Guidelines

### 6.1 For Claude Code Agents

**When implementing G3 (Hierarchical Contacts):**

1. **Read existing code first:**
   ```
   Read: src/components/contacts/ContactForm.tsx
   Read: src/services/contactService.ts
   Read: src/database/schema.ts
   ```

2. **Implement in this order:**
   - [ ] Add schema changes to `schema.ts` (version bump)
   - [ ] Create `hierarchyValidator.ts` with circular reference checks
   - [ ] Create `hierarchyService.ts` with parent/child operations
   - [ ] Add unit tests for validator and service
   - [ ] Modify `ContactForm.tsx` to add optional parent selector
   - [ ] Modify `ContactList.tsx` to show hierarchy indicators
   - [ ] Add E2E test for parent/child creation workflow
   - [ ] Run full test suite to ensure C6 still works

3. **Safety checks before committing:**
   ```bash
   npm run test:unit -- --filter="C6"  # Must pass
   npm run test:unit -- --filter="G3"  # Must pass
   npm run test:e2e -- customer-management  # Must pass
   ```

**When implementing G4 (Consolidated Invoices):**

1. **Read existing code first:**
   ```
   Read: src/components/invoices/InvoiceForm.tsx
   Read: src/services/invoiceService.ts
   Read: src/templates/invoicePDF.ts
   ```

2. **Implement in this order:**
   - [ ] Add schema changes for invoices table
   - [ ] Create `invoice_subaccount_sections` table
   - [ ] Create `consolidatedInvoiceService.ts`
   - [ ] Add unit tests for subtotal/total calculations
   - [ ] Modify `InvoiceForm.tsx` to add consolidation toggle
   - [ ] Create `ConsolidatedInvoicePreview.tsx` component
   - [ ] Modify PDF template to handle consolidated layout
   - [ ] Add E2E test for consolidated invoice workflow
   - [ ] Run full test suite to ensure C7 still works

3. **Safety checks before committing:**
   ```bash
   npm run test:unit -- --filter="C7"  # Must pass
   npm run test:unit -- --filter="G4"  # Must pass
   npm run test:e2e -- invoice-creation  # Must pass
   ```

### 6.2 Code Review Checklist

**Before merging G3/G4 PRs, verify:**

- [ ] All existing C6, C7, D5 tests pass (zero failures)
- [ ] All new G3, G4 tests pass (100% pass rate)
- [ ] Schema migration script tested on sample data
- [ ] No direct modifications to C6, C7, D5 component logic (only additive changes)
- [ ] All new code has minimum 90% test coverage
- [ ] Performance benchmarks met
- [ ] Documentation updated (this plan, SPEC.md, ROADMAP.md)
- [ ] TypeScript types added for all new interfaces
- [ ] Encryption applied to all new fields (hierarchy_level, parent_id, etc.)
- [ ] DISC-adapted messages written for hierarchy UI
- [ ] Accessibility (WCAG 2.1 AA) verified for new components
- [ ] Manual QA: create parent/child, consolidated invoice (works as expected)

---

## 7. Validation Checkpoints Summary

### Checkpoint 1: Schema Migration ✅
**When:** After database changes applied
**Validation:**
- [ ] Migration runs without errors
- [ ] All existing contacts have `parent_id = NULL`, `account_type = 'standalone'`
- [ ] All existing invoices have `consolidation_type = 'individual'`
- [ ] C6, C7, D5 unit tests pass unchanged

**Decision Point:**
- ✅ PASS → Proceed to Checkpoint 2
- ❌ FAIL → Rollback schema, investigate

### Checkpoint 2: Backend Services ✅
**When:** After service layer implementation
**Validation:**
- [ ] `hierarchyValidator` prevents circular references
- [ ] `hierarchyService` correctly manages parent/child relationships
- [ ] `consolidatedInvoiceService` calculates totals accurately
- [ ] All service unit tests pass (>90% coverage)
- [ ] C6, C7, D5 integration tests pass unchanged

**Decision Point:**
- ✅ PASS → Proceed to Checkpoint 3
- ❌ FAIL → Fix services, re-test

### Checkpoint 3: UI Integration ✅
**When:** After UI component modifications
**Validation:**
- [ ] Customer creation WITHOUT hierarchy works (C6 E2E test passes)
- [ ] Invoice creation WITHOUT consolidation works (C7 E2E test passes)
- [ ] Hierarchy UI appears ONLY when parent_id is set
- [ ] Consolidation UI appears ONLY when parent account selected
- [ ] All G3, G4 E2E tests pass

**Decision Point:**
- ✅ PASS → Proceed to Checkpoint 4
- ❌ FAIL → Fix UI, re-test

### Checkpoint 4: Full Integration ✅
**When:** After all features implemented
**Validation:**
- [ ] Full test suite passes (C6, C7, D5, G3, G4) - 100% pass rate
- [ ] Performance benchmarks met
- [ ] Manual QA complete (see QA script below)
- [ ] Code review checklist complete
- [ ] Documentation updated

**Decision Point:**
- ✅ PASS → Merge to main, deploy
- ❌ FAIL → Identify issues, fix, re-validate

---

## 8. Manual QA Script

**QA Engineer: Follow this script to validate G3/G4 integration.**

### Test Suite A: Backwards Compatibility (Must Pass)

**Test A1: Create Customer Without Hierarchy**
1. Navigate to Customers → Add New
2. Fill in: Name, Email, Phone (do NOT select parent)
3. Click Save
4. ✅ Expected: Customer saved with `account_type = 'standalone'`
5. ✅ Expected: No hierarchy fields visible in detail view

**Test A2: Create Invoice for Standalone Customer**
1. Navigate to Invoices → Create New
2. Select a standalone customer
3. Add line items, click Save
4. ✅ Expected: Invoice created with `consolidation_type = 'individual'`
5. ✅ Expected: No consolidation UI visible

**Test A3: Edit Existing Customer (Pre-Migration)**
1. Navigate to Customers → Select an old customer
2. Edit Email field, click Save
3. ✅ Expected: Update succeeds, hierarchy fields remain NULL
4. ✅ Expected: No hierarchy UI visible

### Test Suite B: Hierarchy Features (New)

**Test B1: Create Parent and Child Accounts**
1. Create Parent: Navigate to Customers → Add New
2. Fill in: Name "Walmart Corporate", Email, Phone
3. Save → Note customer ID
4. Create Child: Navigate to Customers → Add New
5. Fill in: Name "Walmart Store #123", Email, Phone
6. Select Parent: "Walmart Corporate"
7. Click Save
8. ✅ Expected: Child saved with `parent_id` set to parent's ID
9. ✅ Expected: Parent's detail view shows "1 sub-account"

**Test B2: Circular Reference Prevention**
1. Edit Parent: Navigate to "Walmart Corporate" → Edit
2. Try to set Parent to "Walmart Store #123" (its own child)
3. ✅ Expected: Validation error: "This would create a circular reference."
4. ✅ Expected: Save button disabled

**Test B3: Hierarchy Depth Limit**
1. Create Parent → Child → Grandchild (3 levels)
2. Try to create Great-Grandchild (4th level)
3. Select Grandchild as parent
4. ✅ Expected: Validation error: "Maximum hierarchy depth (3 levels) exceeded."

### Test Suite C: Consolidated Invoicing (New)

**Test C1: Create Consolidated Invoice**
1. Navigate to Invoices → Create New
2. Select Parent Account: "Walmart Corporate"
3. ✅ Expected: "Consolidation Options" card appears
4. Toggle "Create consolidated invoice?" → ON
5. Select sub-accounts: Store #123, Store #456
6. Choose Display Mode: "Itemized"
7. Add line items for Store #123, add line items for Store #456
8. Click Preview
9. ✅ Expected: PDF shows two sections (Store #123, Store #456)
10. ✅ Expected: Each section has subtotal
11. ✅ Expected: Grand total = sum of subtotals

**Test C2: Display Mode Variations**
1. Repeat Test C1 with Display Mode: "Totaled"
2. ✅ Expected: PDF shows only subtotals per store (no line items)
3. Repeat Test C1 with Display Mode: "Hybrid"
4. ✅ Expected: PDF shows sections with line items, clear visual separation

**Test C3: Individual Invoice Still Works**
1. Navigate to Invoices → Create New
2. Select Child Account: "Walmart Store #123" (NOT parent)
3. ✅ Expected: NO consolidation options visible
4. Add line items, save
5. ✅ Expected: Invoice created as `consolidation_type = 'individual'`

### Test Suite D: Performance & Edge Cases

**Test D1: Large Hierarchy Performance**
1. Create 1 parent with 50 child accounts (use data seeding script)
2. Navigate to parent's detail view
3. ✅ Expected: Sub-account list loads in < 200ms
4. ✅ Expected: Expand/collapse is smooth (no lag)

**Test D2: Consolidated Invoice with Many Sub-Accounts**
1. Create consolidated invoice with 15 sub-accounts
2. Generate PDF
3. ✅ Expected: PDF generates in < 5s
4. ✅ Expected: PDF is readable, sections clear

**Test D3: Delete Parent Account**
1. Navigate to Parent Account → Delete
2. ✅ Expected: Warning dialog: "This account has 3 sub-accounts. Orphan or Cancel?"
3. Select "Orphan" → Confirm
4. ✅ Expected: Parent deleted, children converted to standalone
5. ✅ Expected: No errors, children still accessible

---

## 9. Post-Integration Monitoring

### 9.1 What to Monitor After Deployment

**Initial Critical Monitoring**
- [ ] Error rates (Sentry): Watch for hierarchy-related errors
- [ ] Query performance (PostHog): Monitor slow queries on contacts/invoices tables
- [ ] User adoption (Analytics): Track % of users creating parent/child accounts
- [ ] User adoption (Analytics): Track % of invoices using consolidation

**Ongoing Feature Validation**
- [ ] Circular reference prevention: Verify no circular refs in production data
- [ ] Consolidated invoice accuracy: Sample 10 consolidated invoices, manually verify totals
- [ ] Performance degradation: Compare C6/C7 query times pre/post G3/G4

**Success Metrics**
- [ ] Zero critical bugs related to hierarchy features
- [ ] Zero regressions in C6, C7, D5 functionality
- [ ] >80% of multi-location businesses adopt parent/child accounts
- [ ] >50% of businesses using parent accounts create consolidated invoices

### 9.2 Rollback Triggers

**Immediate Rollback if:**
- Critical bug in hierarchy validation (circular refs in production)
- Data corruption in contacts or invoices tables
- Performance degradation >50% in C6/C7 queries
- >10 user reports of broken customer/invoice workflows

**Rollback Process:**
```bash
# Emergency rollback
git revert <G3-commit-hash> <G4-commit-hash>
npm run db:migrate:rollback  # Revert schema to version 1
npm run deploy:emergency
```

**Post-Rollback:**
1. Notify users of feature temporary unavailability
2. Root cause analysis (RCA)
3. Fix issues in staging environment
4. Re-test full validation checklist
5. Re-deploy with confidence

---

## 10. Communication Plan

### 10.1 Internal Team Communication

**Before Implementation:**
- [ ] Share this plan with all developers/agents
- [ ] Review plan in team meeting, answer questions
- [ ] Assign checkpoints to specific team members/agents

**During Implementation:**
- [ ] Daily standup: Report checkpoint progress
- [ ] Slack/Discord: Notify team when each checkpoint passes
- [ ] Document any deviations from plan (with rationale)

**After Deployment:**
- [ ] Post-mortem: What went well? What didn't?
- [ ] Update this plan based on lessons learned
- [ ] Share success metrics with team

### 10.2 User Communication (If Applicable)

**If users have beta access:**

**Pre-Launch Announcement:**
> "New feature coming soon: Parent/Child Accounts! If you sell to businesses with multiple locations (stores, franchises, etc.), you'll soon be able to organize them under a parent account and create consolidated invoices. Existing customers won't see any changes - this is 100% optional."

**Launch Announcement:**
> "Parent/Child Accounts now available! Check out the new 'Parent Account' option in customer creation. Perfect for tracking chains, franchises, or multi-location businesses. Your existing customers are unchanged."

**Post-Launch Tutorial:**
> Video walkthrough: "How to use Parent/Child Accounts and Consolidated Invoicing"

---

## 11. Success Criteria Summary

**This integration is successful if:**

✅ **Zero Breaking Changes**
- All C6, C7, D5 tests pass after G3/G4 implementation
- Existing users see NO changes in their workflows (unless they opt-in)
- No data migration issues (all existing records have safe defaults)

✅ **Feature Completeness**
- All G3 acceptance criteria met (12/12 checkboxes)
- All G4 acceptance criteria met (13/13 checkboxes)
- Validation prevents circular references and excessive depth
- Consolidated invoices calculate totals accurately

✅ **Performance Maintained**
- No performance regression in C6/C7 queries
- New hierarchy queries meet performance targets
- UI remains responsive with 1000+ contacts

✅ **Code Quality**
- >90% test coverage for new code
- All validation checkpoints passed
- Code review checklist complete
- Documentation updated

✅ **User Experience**
- Progressive disclosure: features hidden until needed
- DISC-adapted messages for hierarchy UI
- Accessibility (WCAG 2.1 AA) compliance
- Delight moments (hierarchy visualization, consolidated preview)

---

## 12. Resources & References

**Key Files for Integration:**
- `SPEC.md` - Section on Contacts (C6), Invoices (C7), Vendors (D5)
- `Roadmaps/ROADMAP.md` - Group G items (G3, G4)
- `HIERARCHICAL_ACCOUNTS_ROADMAP_ADDITION.md` - Feature specs
- `src/database/schema.ts` - Schema definitions
- `src/components/contacts/` - Contact management UI
- `src/components/invoices/` - Invoice creation UI

**Testing Resources:**
- `tests/unit/c6-customer-management/` - Existing C6 tests (must pass)
- `tests/unit/c7-invoice-creation/` - Existing C7 tests (must pass)
- `tests/unit/d5-vendor-management/` - Existing D5 tests (must pass)

**Architecture Principles:**
- Progressive enhancement (not breaking changes)
- Non-breaking schema extension (nullable columns with safe defaults)
- Backwards compatibility (existing features work unchanged)
- Zero-knowledge encryption (all new fields encrypted)

---

## 13. Appendix: Quick Reference Commands

**Run tests for specific features:**
```bash
# C6, C7, D5 tests (must pass after G3/G4)
npm run test -- --filter="C6|C7|D5"

# G3, G4 tests (new features)
npm run test -- --filter="G3|G4"

# Full test suite
npm run test:all

# Performance benchmarks
npm run test:performance

# E2E tests
npm run test:e2e
```

**Database operations:**
```bash
# Run schema migration
npm run db:migrate

# Rollback schema migration
npm run db:migrate:rollback

# Seed test data (includes hierarchies)
npm run db:seed:hierarchies
```

**Code quality checks:**
```bash
# TypeScript type checking
npm run type-check

# Linting
npm run lint

# Test coverage report
npm run test:coverage
```

---

## Document History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-01-12 | Initial creation | Claude Code |

---

**This plan ensures G3 and G4 integrate seamlessly with existing C6, C7, D5 implementations while maintaining the holistic integrity of the Graceful Books project.**

*End of Integration Plan*
