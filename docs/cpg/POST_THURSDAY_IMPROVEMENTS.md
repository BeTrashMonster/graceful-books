# Post-Thursday Demo Improvements

Items to implement after the Thursday demo is complete.

## High Priority Features

### 1. Hierarchical Categories & UX Improvements for Granularity
**THE BIG ONE:** Users find the current granularity overwhelming and tedious.

**Core Problem:**
- Accounting needs: Weighted average cost for each distinct raw material (Bottle Labels 1oz, Bottle Labels 5oz, Box Labels)
- User mental model: Simple groupings like "Branding" or "Labels" without subdividing
- Current system: Forces users to create TONS of categories (tedious, confusing)
- **User quote:** "UGH - users are not going to like, appreciate or understand how granular this needs to be"

**Real-World Example That Exposed This:**
- User had invoice with "Branding/Marketing" that included:
  - $2.24 for bottle printing
  - $0.82 for box printing
- System wanted to average them (wrong!)
- User realized they need separate categories but hated the complexity

**THE SOLUTION: Parent/Child Hierarchical Categories**
*(NOTE: User suggested this early on and I dismissed it - they were RIGHT!)*

**How It Would Work:**

**Parent Categories** (what users see and think about):
- Branding
- Packaging
- Ingredients
- Shipping

**Child Categories** (what accounting tracks):
- Branding
  → Bottle Labels (1oz)
  → Bottle Labels (5oz)
  → Box Labels
  → Stickers
  → Screen Printing
- Packaging
  → Bottles (1oz)
  → Bottles (5oz)
  → Lids (1oz)
  → Lids (5oz)
  → Boxes

**User Experience Improvements:**

1. **Invoice Entry:**
   - Select parent "Branding" → Dropdown shows recent/relevant children
   - Quick-add templates: "Standard Bottle Costs" adds Body + Lid + Label in one click
   - Vendor memory: System remembers "Label Co" usually means Bottle Labels + Shipping

2. **Recipe Builder:**
   - Collapsible groups: "Branding ▼" expands to show all branding items
   - Visual grouping with indentation
   - Compact view vs. detailed view toggle

3. **CPU Display:**
   - Toggle between grouped view ("Branding: $3.06 total") and detailed view (show each sub-item)
   - Summary totals by parent category
   - Progressive disclosure of complexity

**Additional Features to Consider:**

4. **Multi-Category Line Split:**
   - One invoice line, allocate across multiple categories/variants
   - Example: Sticker roll $250 → 40% Bottle Labels (1oz), 30% Bottle Labels (5oz), 30% Box Labels
   - Percentage or dollar-based splitting

5. **Smart Categorization:**
   - ML/pattern recognition learns vendor → category patterns
   - Auto-suggests based on description, vendor, amount
   - User confirms or corrects

**Implementation Phases:**

**Phase 1 (Foundation):**
- Add parent/child relationship to category schema
- Update CategoryManager UI for hierarchy
- Invoice entry shows parent, expands to children
- Recipe builder shows collapsible groups

**Phase 2 (Templates & Shortcuts):**
- Quick-entry templates ("Standard Bottle Assembly")
- Vendor memory (learns patterns)
- Recent items shown first in dropdowns

**Phase 3 (Advanced):**
- Multi-category split for edge cases
- Grouped vs. detailed view toggle
- Smart suggestions

**Workaround for Thursday Demo:**
Use naming conventions that group alphabetically:
- "Branding: Bottle Labels"
- "Branding: Box Labels"
- "Branding: Stickers"

**Design Principle:**
"Keep accounting accuracy, improve UX. You can't recover lost precision, but UX can always be improved!"

**Status:** Deferred - HIGHEST PRIORITY for post-Thursday
**User Impact:** Critical for adoption - current granularity is a deal-breaker

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

### 4. Blue Focus Indicator Refinement
**Status:** COMPLETED ✅
- Removed bleeding box-shadow
- Clean border-only focus state

### 5. Tooltip Flickering
**Status:** COMPLETED ✅
- Added pointer-events: none
- Debouncing for stability

---

## Notes
- Keep this file updated as new items come up
- Move items to COMPLETED when done
- Date completed items for reference
