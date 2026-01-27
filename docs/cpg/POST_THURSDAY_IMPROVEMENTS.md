# Post-Thursday Demo Improvements

Items to implement after the Thursday demo is complete.

## High Priority Features

### 1. Multi-Variant Cost Splitting
**Problem:** When you buy something that goes into multiple variants (like stickers for all bottle sizes), you need to either:
- Create a separate "Stickers" category, OR
- Split one invoice line across multiple variants

**Example:**
- Buy a roll of 600 stickers for $250.01
- Need to allocate to: 1oz bottle, 5oz bottle, 10oz bottle

**Solution:** Add ability to select multiple variants in invoice entry and split cost evenly or manually.

**Status:** Deferred - complex UI changes needed

---

### 2. Vendor Management System
**Problem:** Invoice "Vendor Name" is currently just a text field. Need reusable vendor records.

**What's Needed:**
- Vendor CRUD (Create, Read, Update, Delete)
- Vendor details:
  - Name (required)
  - Contact person
  - Email
  - Phone
  - Payment terms
  - Notes
- Searchable dropdown when creating invoice (like category selection)
- Filter invoices by vendor
- View all invoices from a specific vendor

**Similar To:** CategoryManager, DistributorManager components

**Benefits:**
- Consistency (no "ABC Co" vs "ABC Company" typos)
- Quick vendor selection from dropdown
- Track purchasing patterns by vendor
- Vendor contact info always available

**Status:** Deferred - implement after Thursday demo

---

### 3. Archived Items Visibility & Management
**Problem:** When items are archived, it's not always clear where they went or how to view them.

**What's Needed:**
- Consistent "Show Archived" toggle across ALL components that support archiving:
  - Categories (CategoryManager) - ✅ Already has checkbox, but needs debugging
  - Finished Products (FinishedProductManager)
  - Recipes (RecipeBuilder)
  - Distributors (DistributorManager)
  - Invoices (CPUTracker) - ✅ Already implemented
- Debug why archived categories not showing up when checkbox is checked
- Visual indicators for archived items (grayed out, "ARCHIVED" badge)
- Ability to unarchive items when needed
- Consider unified archive management page showing all archived items across all types

**User Story:**
"I archived a category but when I checked 'Show Archived' it didn't appear. I need to debug this and ensure archive visibility works consistently everywhere."

**Status:** Deferred - needs investigation and consistent implementation post-Thursday

---

## UI/UX Polish

### 3. Blue Focus Indicator Refinement
**Status:** COMPLETED ✅
- Removed bleeding box-shadow
- Clean border-only focus state

### 4. Tooltip Flickering
**Status:** COMPLETED ✅
- Added pointer-events: none
- Debouncing for stability

---

## Notes
- Keep this file updated as new items come up
- Move items to COMPLETED when done
- Date completed items for reference
