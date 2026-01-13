# Consolidated Invoice Service - Integration Guide

## Quick Start Integration

This guide helps developers integrate the consolidated invoice service into the Graceful Books application.

## File Locations

```
src/
├── types/
│   └── index.ts                                    # Extended Invoice types
└── services/
    ├── consolidatedInvoiceService.ts               # Core service (19KB)
    ├── consolidatedInvoiceService.test.ts          # Test suite (22KB)
    └── consolidatedInvoiceService.example.ts       # Usage examples (18KB)

docs/
├── CONSOLIDATED_INVOICES.md                        # Full documentation (12KB)
└── CONSOLIDATED_INVOICES_INTEGRATION.md            # This file
```

## Type Extensions

The following types have been added to `src/types/index.ts`:

### New Types
```typescript
export type InvoiceConsolidationType = 'individual' | 'consolidated'
export type ConsolidatedDisplayMode = 'itemized' | 'totaled' | 'hybrid'
export interface InvoiceSubAccountSection { ... }
```

### Extended Invoice Interface
```typescript
export interface Invoice {
  // ... existing fields ...

  // NEW: Consolidated invoice fields
  consolidationType: InvoiceConsolidationType
  parentAccountId?: string | null
  displayMode?: ConsolidatedDisplayMode
  sections?: InvoiceSubAccountSection[]
}
```

## Database Schema Migration

You will need to update the database schema to support the new fields:

### SQLite Migration

```sql
-- Add new columns to invoices table
ALTER TABLE invoices ADD COLUMN consolidation_type TEXT NOT NULL DEFAULT 'individual';
ALTER TABLE invoices ADD COLUMN parent_account_id TEXT;
ALTER TABLE invoices ADD COLUMN display_mode TEXT;

-- Create index for parent account lookups
CREATE INDEX idx_invoices_parent_account ON invoices(parent_account_id);

-- Create consolidated invoice sections table
CREATE TABLE invoice_sections (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  subaccount_id TEXT NOT NULL,
  subaccount_name TEXT NOT NULL,
  subtotal REAL NOT NULL,
  tax_amount REAL NOT NULL,
  total REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE INDEX idx_invoice_sections_invoice ON invoice_sections(invoice_id);
CREATE INDEX idx_invoice_sections_subaccount ON invoice_sections(subaccount_id);

-- Link line items to sections
ALTER TABLE invoice_line_items ADD COLUMN section_id TEXT;
CREATE INDEX idx_line_items_section ON invoice_line_items(section_id);
```

### IndexedDB Schema Update

```typescript
// In your IndexedDB setup
const db = await openDB('graceful-books', 2, {
  upgrade(db, oldVersion, newVersion, transaction) {
    if (oldVersion < 2) {
      // Update invoices store
      const invoiceStore = transaction.objectStore('invoices')

      // Add indexes for new fields
      invoiceStore.createIndex('by-consolidation-type', 'consolidationType')
      invoiceStore.createIndex('by-parent-account', 'parentAccountId')

      // Create invoice sections store
      const sectionStore = db.createObjectStore('invoice-sections', {
        keyPath: 'id',
      })
      sectionStore.createIndex('by-invoice', 'invoiceId')
      sectionStore.createIndex('by-subaccount', 'subaccountId')
    }
  },
})
```

## Contact Type Extension

The service expects contacts to support a `parentContactId` field for hierarchy:

```typescript
// Extend the Contact interface
export interface Contact {
  // ... existing fields ...
  parentContactId?: string  // NEW: For hierarchical relationships
}
```

### Database Migration for Contacts

```sql
-- Add parent relationship to contacts
ALTER TABLE contacts ADD COLUMN parent_contact_id TEXT;
CREATE INDEX idx_contacts_parent ON contacts(parent_contact_id);
```

## Service Integration

### 1. Import the Service

```typescript
import {
  createConsolidatedInvoice,
  validateSubAccounts,
  calculateSubtotals,
  updateConsolidatedInvoice,
  renderConsolidatedInvoiceText,
  type ConsolidatedInvoiceInput,
} from '@/services/consolidatedInvoiceService'
```

### 2. Implement Required Dependencies

The service requires two injected functions:

#### A. Contact Retrieval Function

```typescript
// In your contact service
async function getContactById(id: string): Promise<Contact | null> {
  // Your implementation
  return await db.contacts.get(id)
}
```

#### B. Invoice Number Generator

```typescript
// In your invoice service
async function generateInvoiceNumber(): Promise<string> {
  const lastInvoice = await db.invoices
    .orderBy('invoiceNumber')
    .reverse()
    .first()

  if (!lastInvoice) {
    return 'INV-000001'
  }

  const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[1])
  return `INV-${String(lastNumber + 1).padStart(6, '0')}`
}
```

### 3. Create UI Components

#### Invoice Type Selector

```typescript
// InvoiceTypeSelector.tsx
export function InvoiceTypeSelector({
  value,
  onChange
}: {
  value: InvoiceConsolidationType
  onChange: (type: InvoiceConsolidationType) => void
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as InvoiceConsolidationType)}>
      <option value="individual">Individual Invoice</option>
      <option value="consolidated">Consolidated Invoice</option>
    </select>
  )
}
```

#### Sub-Account Selector

```typescript
// SubAccountSelector.tsx
export function SubAccountSelector({
  parentAccountId,
  selectedSubAccounts,
  onSelectionChange,
}: {
  parentAccountId: string
  selectedSubAccounts: string[]
  onSelectionChange: (ids: string[]) => void
}) {
  const [subAccounts, setSubAccounts] = useState<Contact[]>([])

  useEffect(() => {
    // Load sub-accounts for parent
    loadSubAccounts(parentAccountId).then(setSubAccounts)
  }, [parentAccountId])

  return (
    <MultiSelect
      options={subAccounts.map(sa => ({
        value: sa.id,
        label: sa.name
      }))}
      value={selectedSubAccounts}
      onChange={onSelectionChange}
    />
  )
}
```

#### Display Mode Selector

```typescript
// DisplayModeSelector.tsx
export function DisplayModeSelector({
  value,
  onChange,
}: {
  value: ConsolidatedDisplayMode
  onChange: (mode: ConsolidatedDisplayMode) => void
}) {
  return (
    <RadioGroup value={value} onChange={onChange}>
      <Radio value="itemized">
        <strong>Itemized</strong> - Show all line items
      </Radio>
      <Radio value="totaled">
        <strong>Totaled</strong> - Show only subtotals
      </Radio>
      <Radio value="hybrid">
        <strong>Hybrid</strong> - Totals with expandable detail
      </Radio>
    </RadioGroup>
  )
}
```

### 4. Create Invoice Form

```typescript
// ConsolidatedInvoiceForm.tsx
export function ConsolidatedInvoiceForm() {
  const [parentAccountId, setParentAccountId] = useState('')
  const [subAccountItems, setSubAccountItems] = useState(new Map())
  const [displayMode, setDisplayMode] = useState<ConsolidatedDisplayMode>('itemized')
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const handleValidate = async () => {
    const result = await validateSubAccounts(
      parentAccountId,
      Array.from(subAccountItems.keys()),
      getContactById
    )

    if (!result.isValid) {
      setValidationErrors(result.errors)
      return false
    }

    setValidationErrors([])
    return true
  }

  const handleSubmit = async () => {
    if (!await handleValidate()) {
      return
    }

    const input: ConsolidatedInvoiceInput = {
      parentAccountId,
      companyId: currentCompany.id,
      date: new Date(),
      dueDate: addDays(new Date(), 30),
      displayMode,
      subAccountItems,
      taxRate: 0.08,
      notes: formData.notes,
      terms: formData.terms,
    }

    const result = await createConsolidatedInvoice(
      input,
      getContactById,
      generateInvoiceNumber
    )

    if (result.success) {
      // Save to database
      await saveInvoice(result.data)
      // Navigate to invoice detail
      navigate(`/invoices/${result.data.id}`)
    } else {
      showError(result.error.message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  )
}
```

### 5. Invoice Display Component

```typescript
// ConsolidatedInvoiceView.tsx
export function ConsolidatedInvoiceView({ invoice }: { invoice: Invoice }) {
  if (invoice.consolidationType !== 'consolidated') {
    return <StandardInvoiceView invoice={invoice} />
  }

  return (
    <div className="consolidated-invoice">
      <InvoiceHeader invoice={invoice} />

      <div className="sections">
        {invoice.sections?.map((section) => (
          <InvoiceSection
            key={section.subaccountId}
            section={section}
            displayMode={invoice.displayMode}
          />
        ))}
      </div>

      <InvoiceTotals
        subtotal={invoice.subtotal}
        taxAmount={invoice.taxAmount}
        total={invoice.total}
      />
    </div>
  )
}

function InvoiceSection({
  section,
  displayMode
}: {
  section: InvoiceSubAccountSection
  displayMode?: ConsolidatedDisplayMode
}) {
  const [expanded, setExpanded] = useState(displayMode === 'itemized')

  return (
    <div className="invoice-section">
      <h3>{section.subaccountName}</h3>

      {(displayMode === 'itemized' || (displayMode === 'hybrid' && expanded)) && (
        <table className="line-items">
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {section.lineItems.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>${item.rate.toFixed(2)}</td>
                <td>${item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {displayMode === 'hybrid' && (
        <button onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Hide' : 'Show'} Details
        </button>
      )}

      <div className="section-totals">
        <div>Subtotal: ${section.subtotal.toFixed(2)}</div>
        {section.taxAmount > 0 && (
          <div>Tax: ${section.taxAmount.toFixed(2)}</div>
        )}
        <div><strong>Total: ${section.total.toFixed(2)}</strong></div>
      </div>
    </div>
  )
}
```

## API Integration

If you have a backend API, add these endpoints:

### REST API Endpoints

```typescript
// POST /api/invoices/consolidated
router.post('/invoices/consolidated', async (req, res) => {
  const input: ConsolidatedInvoiceInput = req.body

  const result = await createConsolidatedInvoice(
    input,
    getContactById,
    generateInvoiceNumber
  )

  if (result.success) {
    await saveInvoiceToDB(result.data)
    res.json(result.data)
  } else {
    res.status(400).json({ error: result.error.message })
  }
})

// PUT /api/invoices/consolidated/:id
router.put('/invoices/consolidated/:id', async (req, res) => {
  const invoice = await getInvoiceById(req.params.id)
  const updates = req.body.updates

  const result = await updateConsolidatedInvoice(
    invoice,
    updates,
    req.body.taxRate,
    getContactById
  )

  if (result.success) {
    await updateInvoiceInDB(result.data)
    res.json(result.data)
  } else {
    res.status(400).json({ error: result.error.message })
  }
})

// POST /api/invoices/:id/validate
router.post('/invoices/:id/validate', async (req, res) => {
  const { parentAccountId, subAccountIds } = req.body

  const result = await validateSubAccounts(
    parentAccountId,
    subAccountIds,
    getContactById
  )

  res.json(result)
})
```

## Testing Integration

Add to your test suite:

```typescript
import { describe, it, expect } from 'vitest'
import { createConsolidatedInvoice } from '@/services/consolidatedInvoiceService'

describe('Consolidated Invoice Integration', () => {
  it('should create consolidated invoice through full stack', async () => {
    // Setup test data
    const parent = await createTestContact({ type: 'customer' })
    const sub1 = await createTestContact({ parentContactId: parent.id })
    const sub2 = await createTestContact({ parentContactId: parent.id })

    // Create invoice
    const input = {
      parentAccountId: parent.id,
      companyId: 'test-company',
      date: new Date(),
      dueDate: new Date(),
      displayMode: 'itemized' as const,
      subAccountItems: new Map([
        [sub1.id, [createTestLineItem()]],
        [sub2.id, [createTestLineItem()]],
      ]),
    }

    const result = await createConsolidatedInvoice(
      input,
      getContactById,
      generateInvoiceNumber
    )

    expect(result.success).toBe(true)

    // Verify in database
    const saved = await db.invoices.get(result.data.id)
    expect(saved.consolidationType).toBe('consolidated')
  })
})
```

## Performance Considerations

### Optimization Tips

1. **Batch Contact Lookups**: Cache contacts during validation
   ```typescript
   const contactCache = new Map<string, Contact>()
   const getCachedContact = async (id: string) => {
     if (contactCache.has(id)) return contactCache.get(id)!
     const contact = await getContactById(id)
     if (contact) contactCache.set(id, contact)
     return contact
   }
   ```

2. **Lazy Load Sections**: For large invoices, load sections on demand
   ```typescript
   const [visibleSections, setVisibleSections] = useState([0, 1, 2])
   ```

3. **Debounce Calculations**: When editing, debounce recalculations
   ```typescript
   const debouncedCalculate = useMemo(
     () => debounce(calculateSubtotals, 500),
     []
   )
   ```

## Troubleshooting

### Common Issues

1. **"Sub-account validation failed"**
   - Ensure Contact type has `parentContactId` field
   - Check that parent-child relationships are set correctly

2. **"Invoice is not a consolidated invoice"**
   - Verify `consolidationType` is set to 'consolidated'
   - Check that `sections` array is present

3. **Calculation mismatches**
   - Ensure line item amounts are calculated (quantity × rate)
   - Verify tax rate is in decimal form (0.08, not 8)

## Roadmap Integration

This feature aligns with the following roadmap items:

- **Group E**: Invoice Management
  - E1: Invoice Generation
  - E2: Multi-line Invoice Support
  - E3: Invoice Templates

- **Future Enhancement**: Multi-entity support
  - Will extend to support cross-company consolidation

## Documentation References

- Full documentation: `docs/CONSOLIDATED_INVOICES.md`
- Usage examples: `src/services/consolidatedInvoiceService.example.ts`
- Test suite: `src/services/consolidatedInvoiceService.test.ts`
- Main spec: `SPEC.md`

## Support Checklist

Before considering integration complete:

- [ ] Database schema updated
- [ ] Contact type extended with `parentContactId`
- [ ] Invoice type recognizes new fields
- [ ] UI components created
- [ ] Form validation implemented
- [ ] Display components render correctly
- [ ] Tests passing
- [ ] Documentation reviewed
- [ ] API endpoints added (if applicable)
- [ ] Performance tested with realistic data

## Questions?

Review the example file for complete working code:
```
src/services/consolidatedInvoiceService.example.ts
```

Run the examples:
```bash
npm run example:consolidated-invoices
```

Run the tests:
```bash
npm test consolidatedInvoiceService
```
