# Invoice Naming Confusion - Analysis & Fix Proposal

## The Problem

Your app has TWO tables both called "invoices" but they serve completely different purposes:

### 1. `invoices` table (Regular Invoices)
**Purpose:** Sales invoices you send TO customers
**Money Flow:** Money coming INTO your business
**Example:** "Customer owes you $500 for consulting services"

**Structure:**
- `customer_id` - Who owes you money
- `status` - DRAFT, SENT, PAID, OVERDUE
- `sent_at` - When you sent it to the customer
- Line items for services/products sold
- Creates Accounts Receivable (money owed to you)

**Where it's used:**
- Invoices page (`src/pages/Invoices.tsx`)
- Traditional accounting invoicing workflow

---

### 2. `cpgInvoices` table (Vendor Bills / Purchase Invoices)
**Purpose:** Bills you receive FROM vendors that you paid
**Money Flow:** Money going OUT of your business
**Example:** "You paid $200 to vendor for olive oil bottles"

**Structure:**
- `vendor_name` - Who you paid
- `cost_attribution` - Breakdown of material costs by category
- `calculated_cpus` - Cost Per Unit calculations
- `total_paid` - How much you paid them
- All invoices are already "paid" (historical cost tracking)

**Where it's used:**
- CPU Tracker (`src/components/cpg/modals/AddInvoiceModal.tsx`)
- CPG cost analysis and product costing
- Material purchase tracking

---

## Why This Is Confusing

**In accounting terminology:**
- **Invoice** = Document you send to GET PAID (outgoing, accounts receivable)
- **Bill** = Document you receive and PAY (incoming, accounts payable)

**Your app uses "invoice" for both**, which is causing confusion:
- Users add a "CPG invoice" (really a vendor bill)
- They expect to see it on the "Invoices" page
- But the Invoices page only shows sales invoices
- The CPG invoices are hidden unless you dig into product costs

---

## The Fix (Proposed)

### Option 1: Rename cpgInvoices to "Bills" or "Vendor Invoices"
**Pros:**
- Clearer accounting terminology
- Users understand the difference immediately
- Follows industry standards (QuickBooks, Xero, etc.)

**Cons:**
- Requires database migration
- Need to update all UI references
- May break existing integrations

**Implementation:**
```typescript
// Rename table
cpgInvoices → bills
// or
cpgInvoices → vendorInvoices
// or
cpgInvoices → purchaseInvoices
```

### Option 2: Create Unified Invoice View (Current Quick Fix)
**What we did:**
- Load BOTH tables on Invoices page
- Transform CPG invoices to display alongside regular invoices
- Mark CPG invoices visually as "Purchase" type

**Pros:**
- No database changes needed
- Works immediately
- Shows all invoice activity in one place

**Cons:**
- Still confusing to have two different types
- Data models are incompatible (can't edit CPG invoices as regular invoices)
- Mixing apples and oranges

### Option 3: Separate Pages (Recommended Long-Term)
**Create two distinct pages:**
1. **Sales Invoices** page - For invoices you send to customers
2. **Vendor Bills** page - For bills you receive from vendors (CPG)

**Pros:**
- Crystal clear separation
- Each page optimized for its purpose
- Follows accounting best practices
- No data model confusion

**Cons:**
- More navigation complexity
- Two places to manage "invoices"
- Need to update navigation UI

---

## Recommended Action Plan

**Immediate (Already Done):**
- ✅ Show CPG invoices on Invoices page (unified view)
- ✅ Add clear labeling to distinguish types
- ✅ Fix console errors blocking display

**Short-Term (1-2 weeks):**
1. Rename "Add Invoice" button in CPU Tracker to "Add Vendor Bill"
2. Update all CPG UI text: "Invoice" → "Vendor Bill"
3. Add type indicator column on Invoices page ("Sales" vs "Purchase")
4. Add filter to toggle between Sales/Purchase/All

**Long-Term (Future Enhancement):**
1. Create separate "Bills" or "Purchases" page for CPG invoices
2. Rename `cpgInvoices` table to `bills` or `vendorInvoices`
3. Update all references throughout codebase
4. Add proper bookkeeping integration:
   - Sales Invoices → Accounts Receivable
   - Vendor Bills → Accounts Payable

---

## Current State (After Today's Fixes)

**What works now:**
- CPG invoices (vendor bills) ARE being saved correctly ✅
- They appear in CPU Tracker product cost breakdowns ✅
- They now ALSO appear on the Invoices page ✅
- Auto-refresh when adding new CPG invoices ✅

**What's still confusing:**
- Both types called "invoices" ❌
- User might try to "send" a CPG invoice to a customer ❌
- Mixing purchase and sales data in one view ❌

---

## User Action Required

**To see your invoices NOW:**

1. **Hard refresh** your browser (Ctrl+Shift+R)
2. **Navigate to the "Invoices" page** from the main menu
   - NOT the CPU Tracker
   - Look for "Invoices" in the main navigation sidebar
3. You should see all your CPG invoices listed there

**The console log you should see:**
```
📊 Loaded invoices: {
  regularInvoices: 0,
  cpgInvoices: 3,  // Your vendor bills
  total: 3
}
```

If you don't see this log, you're not on the Invoices page yet.

---

## Technical Details

**Files involved:**
- `src/pages/Invoices.tsx` - Main invoices display page
- `src/components/cpg/modals/AddInvoiceModal.tsx` - CPG invoice creation
- `src/db/schema/invoices.schema.ts` - Sales invoice structure
- `src/db/schema/cpg.schema.ts` - CPG invoice (vendor bill) structure
- `src/store/database.ts` - Database table definitions

**Tables:**
- `invoices` - Sales invoices (customer-facing)
- `cpgInvoices` - Vendor bills (supplier purchases)

---

## Next Steps

Would you like me to:

1. **Rename all "CPG Invoice" UI text to "Vendor Bill"** for clarity?
2. **Create a separate "Bills" page** for CPG invoices?
3. **Add a type indicator** to distinguish sales vs purchase invoices?
4. **Keep current unified view** and just improve labeling?

Let me know your preference and I'll implement it!

---

**Created:** 2024 (During invoice visibility debugging)
**Status:** Immediate fix deployed, long-term naming fix pending user decision
