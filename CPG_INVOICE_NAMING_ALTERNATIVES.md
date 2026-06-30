# CPG Invoice Naming Alternatives

## Current Problem
The CPG system uses "invoices" to refer to bills you receive FROM vendors that you PAID. This is confusing because:
- In accounting, "invoice" means a bill you send TO customers to GET PAID
- Your CPG "invoices" are actually purchase records (bills you received and paid)
- They represent money going OUT, not money coming IN

---

## Naming Alternatives (Ranked by Clarity)

### Option 1: **Vendor Bills** ⭐ RECOMMENDED
**Why it's good:**
- Crystal clear that these are bills FROM vendors
- Uses standard accounting terminology
- Distinguishes from customer invoices

**UI Changes:**
- "Add Invoice" → "Add Vendor Bill"
- "Invoice History" → "Vendor Bill History"
- "Invoices" tab → "Vendor Bills" tab
- Table: "cpgInvoices" → "vendorBills"

**Pros:**
- ✅ Clear accounting terminology
- ✅ Users immediately understand the difference
- ✅ Matches QuickBooks, Xero terminology

**Cons:**
- ❌ Requires database migration
- ❌ Need to update all references

---

### Option 2: **Purchase Orders / POs**
**Why it's good:**
- Common in manufacturing/CPG
- Indicates buying materials
- Professional terminology

**UI Changes:**
- "Add Invoice" → "Add Purchase Order" or "Add PO"
- "Invoice History" → "Purchase Order History"
- "Invoices" tab → "Purchase Orders" tab
- Table: "cpgInvoices" → "purchaseOrders"

**Pros:**
- ✅ Industry-standard terminology
- ✅ Familiar to CPG businesses
- ✅ Clearly different from sales invoices

**Cons:**
- ❌ Technically, a PO is the document you SEND before receiving goods
- ❌ These are actually the bills you RECEIVED after getting goods
- ❌ Might confuse the ordering process vs receipt

---

### Option 3: **Material Purchases**
**Why it's good:**
- Descriptive of what they are
- Less jargon-heavy
- Friendly to non-accountants

**UI Changes:**
- "Add Invoice" → "Add Material Purchase"
- "Invoice History" → "Material Purchases"
- "Invoices" tab → "Material Purchases" tab
- Table: "cpgInvoices" → "materialPurchases"

**Pros:**
- ✅ Easy to understand
- ✅ Less accounting jargon
- ✅ Describes what the user is actually doing

**Cons:**
- ❌ Slightly verbose
- ❌ Doesn't match standard accounting terminology
- ❌ Less professional sounding

---

### Option 4: **Receipts**
**Why it's good:**
- Simple, one word
- Everyone knows what a receipt is
- Indicates proof of purchase

**UI Changes:**
- "Add Invoice" → "Add Receipt"
- "Invoice History" → "Receipt History"
- "Invoices" tab → "Receipts" tab
- Table: "cpgInvoices" → "receipts"

**Pros:**
- ✅ Simple, universally understood
- ✅ Short and concise
- ✅ Friendly terminology

**Cons:**
- ❌ CONFLICT: You already have a "Receipts" page in the bookkeeping suite
- ❌ "Receipt" usually means the paper proof, not the actual transaction record
- ❌ Less professional

---

### Option 5: **Expenses**
**Why it's good:**
- Describes what they are (business expenses)
- Simple terminology
- Category-focused

**UI Changes:**
- "Add Invoice" → "Add Expense"
- "Invoice History" → "Expense History"
- "Invoices" tab → "Expenses" tab
- Table: "cpgInvoices" → "expenses"

**Pros:**
- ✅ Simple and clear
- ✅ Everyone understands "expense"
- ✅ Accurate description

**Cons:**
- ❌ Too generic (all vendor bills are expenses, but not all expenses are vendor bills)
- ❌ Doesn't capture the material/inventory aspect
- ❌ Might get confused with other business expenses

---

### Option 6: **Material Invoices** (Keep "Invoice" but clarify)
**Why it's good:**
- Minimal change from current naming
- Adds clarifying word
- Less database migration needed

**UI Changes:**
- "Add Invoice" → "Add Material Invoice"
- "Invoice History" → "Material Invoice History"
- "Invoices" tab → "Material Invoices" tab
- Table: "cpgInvoices" → "materialInvoices"

**Pros:**
- ✅ Smaller migration effort
- ✅ Still uses familiar "invoice" word
- ✅ "Material" clarifies it's for materials

**Cons:**
- ❌ Still technically incorrect terminology
- ❌ Doesn't solve the core confusion
- ❌ Just kicking the can down the road

---

### Option 7: **Supplier Invoices**
**Why it's good:**
- Mirrors "Vendor Bills" but keeps "Invoice"
- Clear that it's FROM suppliers
- Standard in some industries

**UI Changes:**
- "Add Invoice" → "Add Supplier Invoice"
- "Invoice History" → "Supplier Invoice History"
- "Invoices" tab → "Supplier Invoices" tab
- Table: "cpgInvoices" → "supplierInvoices"

**Pros:**
- ✅ Clarifies direction (from suppliers)
- ✅ Keeps "invoice" terminology
- ✅ Professional sounding

**Cons:**
- ❌ "Supplier" and "Vendor" mean the same thing (might confuse which to use)
- ❌ Still technically incorrect (invoices go TO customers, not FROM suppliers)
- ❌ Doesn't match standard accounting terminology

---

## Comparison Matrix

| Option | Clarity | Accounting Standard | Professional | Migration Effort |
|--------|---------|---------------------|-------------|------------------|
| **Vendor Bills** ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | High |
| Purchase Orders | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | High |
| Material Purchases | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | High |
| Receipts | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | High + Conflict |
| Expenses | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | High |
| Material Invoices | ⭐⭐ | ⭐ | ⭐⭐⭐ | Medium |
| Supplier Invoices | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | High |

---

## Recommendation: **Vendor Bills** ⭐

**Why:**
1. ✅ Matches standard accounting terminology (QuickBooks, Xero, FreshBooks all use "Bills")
2. ✅ Crystal clear that these are bills FROM vendors you PAY
3. ✅ Distinguishes perfectly from customer invoices (which you SEND to get paid)
4. ✅ Professional and industry-standard
5. ✅ Future-proofs for bookkeeping integration (Vendor Bills → Accounts Payable)

**Migration Path:**
1. **Phase 1 (Immediate - UI Only):**
   - Change all UI text: "Invoice" → "Vendor Bill"
   - "Add Invoice" button → "Add Vendor Bill"
   - "Invoices" tab → "Vendor Bills"
   - Keep database table name as-is (`cpgInvoices`)

2. **Phase 2 (Next Sprint - Database):**
   - Create migration to rename `cpgInvoices` → `vendorBills`
   - Update all code references
   - Add database migration script

**Alternative Quick Win:** Just do Phase 1 (UI changes only) and keep the database table name. The UI clarity is the most important part for users.

---

## User-Facing Copy Examples

### Current (Confusing):
- "Add Invoice"
- "Invoice #1234"
- "Invoice from ABC Supplier"
- "Total spent on invoices: $5,000"

### With "Vendor Bills" (Clear):
- "Add Vendor Bill"
- "Bill #1234"
- "Bill from ABC Supplier"
- "Total spent on vendor bills: $5,000"

### With "Material Purchases" (Friendly):
- "Add Material Purchase"
- "Purchase #1234"
- "Purchase from ABC Supplier"
- "Total spent on materials: $5,000"

---

## Implementation Checklist

If we go with **Vendor Bills**:

**UI Changes (No DB Migration Needed):**
- [ ] CPU Tracker tab label: "Invoices" → "Vendor Bills"
- [ ] AddInvoiceModal title: "Add Invoice" → "Add Vendor Bill"
- [ ] RawMaterialsTab header: "Invoice History" → "Vendor Bill History"
- [ ] All buttons: "Add Invoice" → "Add Vendor Bill"
- [ ] Table headers: "Invoice Date" → "Bill Date", "Invoice Number" → "Bill Number"
- [ ] Empty states: "No invoices yet" → "No vendor bills yet"
- [ ] Help text and descriptions
- [ ] Console log messages

**Code Changes (Keep DB table name for now):**
- [ ] Component props: `invoices` → `vendorBills` (or keep as `invoices` for less churn)
- [ ] Variable names in functions (optional, for clarity)
- [ ] Comments and documentation

**Future DB Migration (When ready):**
- [ ] Create migration: `cpgInvoices` → `vendorBills`
- [ ] Update all `db.cpgInvoices` → `db.vendorBills`
- [ ] Update schema types
- [ ] Update indexes and queries

---

## Decision Time

**What do you prefer?**

1. **Vendor Bills** - Standard accounting, clearest
2. **Purchase Orders** - Industry standard, but technically slightly wrong
3. **Material Purchases** - Friendliest, but less professional
4. **Something else?** - Open to other suggestions!

Let me know and I'll implement the renaming immediately (UI changes first, DB migration later if needed).

---

**Created:** 2024 (During invoice naming confusion investigation)
**Status:** Awaiting user decision on preferred terminology
