# CPG BOM System Testing Checklist

**Purpose:** Comprehensive manual testing checklist for Thursday demo preparation

**Last Updated:** 2026-01-25

**Target:** Complete BOM system with Categories → Products → Recipes → Invoices → CPU flow

---

## Pre-Demo Setup

### Environment Preparation

- [ ] Clear browser cache and IndexedDB
- [ ] Verify dev server is running (`npm run dev`)
- [ ] Open browser DevTools console (check for errors)
- [ ] Verify network tab shows no failed requests
- [ ] Set viewport to 1920x1080 for demo
- [ ] Disable browser extensions that might interfere
- [ ] Have backup browser ready (Chrome + Firefox)

### Demo Data Loading

- [ ] Run demo data seed script
- [ ] Verify all categories created (4 total)
- [ ] Verify all products created (2 total)
- [ ] Verify all recipes created (8 lines total)
- [ ] Verify all invoices created (5 total)
- [ ] Check CPU calculations match expected values
  - [ ] Oil (bulk): $0.42/oz
  - [ ] Bottle (1oz): $0.50/each
  - [ ] Bottle (5oz): $0.60/each
  - [ ] Box (1oz): $0.25/each
  - [ ] Box (5oz): $0.36/each
  - [ ] Label: $0.10/each
  - [ ] 1oz Body Oil: $1.27
  - [ ] 5oz Body Oil: $3.16

---

## 1. Fresh User Onboarding Path

### Getting Started Card

- [ ] Card is visible on CPG dashboard
- [ ] All 4 steps are displayed
- [ ] Step 1: "Add First Category" is clickable
- [ ] Step 2: "Add First Product" is grayed out initially
- [ ] Step 3: "Create First Recipe" is grayed out initially
- [ ] Step 4: "Add First Invoice" is grayed out initially
- [ ] Progress indicators show correctly (0/4 complete)

### Step 1: Add First Category

- [ ] Click "Add First Category" opens modal
- [ ] Modal has X-only close (backdrop click disabled)
- [ ] Category name field is focused automatically
- [ ] Unit of measure dropdown has options (oz, ml, each, lb, g)
- [ ] Variants section is optional
- [ ] Can add multiple variants
- [ ] Save button is enabled when name + unit filled
- [ ] After save, modal closes
- [ ] Category appears in categories list
- [ ] Step 1 shows checkmark
- [ ] Step 2 becomes clickable

### Step 2: Add First Product

- [ ] Click "Add First Product" opens modal
- [ ] Product name field is required
- [ ] SKU field is optional
- [ ] MSRP field is optional but validates currency format
- [ ] Unit of measure defaults to "each"
- [ ] Pieces per unit defaults to 1
- [ ] Save button enabled when required fields filled
- [ ] After save, product appears in products list
- [ ] Step 2 shows checkmark
- [ ] Step 3 becomes clickable

### Step 3: Create First Recipe

- [ ] Click "Create First Recipe" opens recipe builder
- [ ] Shows product name at top
- [ ] "Add Component" button is visible
- [ ] Click "Add Component" shows form
- [ ] Category dropdown populated with categories
- [ ] Variant dropdown shows variants (if category has them)
- [ ] Quantity field validates positive numbers
- [ ] Can add multiple components
- [ ] Each component shows in list with quantity + unit
- [ ] Estimated CPU shows "Awaiting cost data" if no invoice
- [ ] Save button saves recipe
- [ ] Step 3 shows checkmark
- [ ] Step 4 becomes clickable

### Step 4: Add First Invoice

- [ ] Click "Add First Invoice" opens invoice modal
- [ ] Invoice date defaults to today
- [ ] Vendor name is optional
- [ ] Invoice total field is required
- [ ] Line items section visible
- [ ] Category dropdown populated
- [ ] Variant dropdown shows variants (if applicable)
- [ ] Units purchased is required (positive number)
- [ ] Unit price is required (positive currency)
- [ ] Units received auto-fills from units purchased
- [ ] Can add multiple line items
- [ ] Running balance shows: Total - Line Items = Remaining
- [ ] Save button disabled if balance doesn't match
- [ ] After save, invoice appears in invoices list
- [ ] Step 4 shows checkmark
- [ ] All steps complete (4/4)

---

## 2. CRUD Operations Testing

### Categories

#### Create
- [ ] Can create category with just name + unit
- [ ] Can create category with variants
- [ ] Cannot create duplicate name (error shown)
- [ ] Cannot save with empty name (validation error)
- [ ] Variants array can be empty/null
- [ ] Sort order is auto-assigned

#### Read
- [ ] Categories list shows all categories
- [ ] Active filter works
- [ ] Search/filter by name works
- [ ] Sorting works (by name, by sort order)
- [ ] Category details show all fields

#### Update
- [ ] Can edit category name
- [ ] Can edit unit of measure
- [ ] Can add/remove variants
- [ ] Can change sort order
- [ ] Can toggle active status
- [ ] Changes save correctly
- [ ] Updated_at timestamp updates

#### Delete
- [ ] Can delete category NOT used in recipes
- [ ] Cannot delete category used in recipes (error shown)
- [ ] Soft delete works (deleted_at set, active = false)
- [ ] Deleted categories don't show in dropdowns
- [ ] Deleted categories don't show in lists (unless filter = show deleted)

### Finished Products

#### Create
- [ ] Can create with just name
- [ ] Can create with SKU
- [ ] Can create with MSRP
- [ ] SKU must be unique (validation)
- [ ] MSRP validates currency format
- [ ] Name must be unique (validation)
- [ ] Unit of measure required
- [ ] Pieces per unit defaults to 1

#### Read
- [ ] Products list shows all products
- [ ] Shows SKU and MSRP
- [ ] Shows current CPU (if recipe + invoices exist)
- [ ] Click product opens details

#### Update
- [ ] Can edit all fields
- [ ] SKU uniqueness validated on update
- [ ] Name uniqueness validated on update
- [ ] MSRP format validated

#### Delete
- [ ] Can delete product without recipes
- [ ] Cannot delete product with recipes (error shown)
- [ ] Soft delete works

### Recipes

#### Create
- [ ] Can add component to recipe
- [ ] Category dropdown shows active categories
- [ ] Variant dropdown shows category variants
- [ ] Quantity validates positive number
- [ ] Cannot add duplicate category+variant (error shown)
- [ ] Can add multiple components
- [ ] Recipe must have at least 1 component

#### Read
- [ ] Recipe shows all components
- [ ] Shows quantity + unit for each
- [ ] Shows estimated CPU breakdown
- [ ] Shows total estimated CPU

#### Update
- [ ] Can change quantity
- [ ] Can add new components
- [ ] Can remove components
- [ ] CPU recalculates on changes

#### Delete
- [ ] Can remove individual components
- [ ] Can delete entire recipe
- [ ] Soft delete works

### Invoices

#### Create
- [ ] Can create with date + total
- [ ] Vendor name optional
- [ ] Invoice number optional
- [ ] Line items required
- [ ] Line items must balance to total (±$0.01 tolerance)
- [ ] Running balance shows correctly
- [ ] Category dropdown populated
- [ ] Variant dropdown shows variants
- [ ] Units purchased validates positive
- [ ] Unit price validates positive
- [ ] Units received auto-fills
- [ ] Can override units received
- [ ] Description field per line item (optional)
- [ ] Additional costs section (optional)
- [ ] Total calculated correctly
- [ ] CPUs calculated after save

#### Read
- [ ] Invoices list shows all invoices
- [ ] Shows date, vendor, total
- [ ] Click invoice shows details
- [ ] Shows line items breakdown
- [ ] Shows calculated CPUs

#### Update
- [ ] Can edit all fields
- [ ] Balance validation still enforced
- [ ] CPUs recalculate on changes

#### Delete
- [ ] Can delete invoice
- [ ] Soft delete works
- [ ] CPU recalculates for affected products

---

## 3. Validation Scenarios

### Category Validation

- [ ] Empty name shows error
- [ ] Duplicate name shows error
- [ ] Empty unit of measure shows error
- [ ] Invalid variant names rejected (if applicable)

### Product Validation

- [ ] Empty name shows error
- [ ] Duplicate name shows error
- [ ] Duplicate SKU shows error (if provided)
- [ ] Invalid MSRP format shows error
- [ ] Negative MSRP shows error
- [ ] Pieces per unit must be integer >= 1

### Recipe Validation

- [ ] Empty category shows error
- [ ] Quantity <= 0 shows error
- [ ] Non-numeric quantity shows error
- [ ] Duplicate category+variant shows error
- [ ] Recipe with 0 components cannot save

### Invoice Validation

- [ ] Empty date shows error
- [ ] Empty total shows error
- [ ] Negative total shows error
- [ ] Line items not balancing shows error
- [ ] Shows remaining amount clearly
- [ ] Empty category in line item shows error
- [ ] Negative units purchased shows error
- [ ] Negative unit price shows error
- [ ] Zero units purchased shows error
- [ ] Zero unit price shows error

---

## 4. Missing Data Handling

### Incomplete CPU Scenarios

- [ ] Product with recipe but no invoices shows "Incomplete"
- [ ] Warning icon visible
- [ ] Click breakdown shows "Awaiting cost data"
- [ ] Lists missing components
- [ ] Shows which categories need invoices
- [ ] After adding invoice, CPU updates to complete
- [ ] No longer shows warning icon

### Graceful Degradation

- [ ] Missing category in recipe shows "Unknown Category"
- [ ] Deleted category shows warning in recipe
- [ ] Missing invoice data doesn't crash UI
- [ ] Shows helpful messages instead of errors
- [ ] User can fix issues without data loss

---

## 5. CPU Calculation Accuracy

### Raw Material CPU

- [ ] Latest purchase price method works
- [ ] Invoice with single line item calculates correctly
- [ ] Invoice with multiple line items calculates correctly
- [ ] Additional costs allocated proportionally
- [ ] Variant matching is case-insensitive
- [ ] Variant matching ignores spaces/hyphens ("1oz" = "1 oz" = "1-oz")
- [ ] Units received different from units purchased handled correctly

### Finished Product CPU

- [ ] Single component recipe calculates correctly
- [ ] Multi-component recipe calculates correctly
- [ ] Breakdown shows each component cost
- [ ] Breakdown shows subtotal per component
- [ ] Total CPU sums all components
- [ ] Updates when recipe changes
- [ ] Updates when invoice prices change

### Edge Cases

- [ ] Recipe with fractional quantities (1.5 oz)
- [ ] Very large quantities (1000+ units)
- [ ] Very small prices ($0.001)
- [ ] Rounding handled correctly (2 decimal places)
- [ ] Zero cost components (free samples)

---

## 6. Visual/UX Polish

### Layout & Spacing

- [ ] No overlapping elements
- [ ] Consistent padding/margins
- [ ] Proper alignment (left/right/center)
- [ ] Focus indicators not cut off
- [ ] Tooltips fully visible
- [ ] Modals centered on screen
- [ ] Cards have consistent styling

### Typography

- [ ] Font sizes appropriate
- [ ] Headers clearly distinguished
- [ ] No text overflow/truncation
- [ ] Labels clearly associated with inputs
- [ ] Error messages visible and clear

### Colors & Icons

- [ ] Color contrast meets WCAG AA
- [ ] Icons are intuitive
- [ ] Success states use green
- [ ] Error states use red
- [ ] Warning states use yellow/orange
- [ ] Disabled states are obvious
- [ ] Active/selected states clear

### Animations & Transitions

- [ ] Modal open/close smooth
- [ ] Dropdown animations smooth
- [ ] No janky transitions
- [ ] Loading states show appropriately
- [ ] Skeleton screens if loading takes >1s

### Feedback & Micro-interactions

- [ ] Button hover states visible
- [ ] Click feedback (button press effect)
- [ ] Success messages show after saves
- [ ] Error messages clear and helpful
- [ ] Progress indicators accurate
- [ ] Confetti on major milestones (optional)

---

## 7. Responsive Design

### Mobile (375px - iPhone SE)

- [ ] Navigation accessible
- [ ] Modals don't overflow screen
- [ ] Forms stack vertically
- [ ] Buttons full-width
- [ ] Touch targets >= 44px
- [ ] No horizontal scroll
- [ ] Tables stack or scroll horizontally
- [ ] Text readable without zooming

### Tablet (768px - iPad)

- [ ] 2-column layouts where appropriate
- [ ] Modals sized appropriately
- [ ] Touch-friendly interactions
- [ ] No horizontal scroll

### Desktop (1920px+)

- [ ] Content centered or max-width applied
- [ ] Multi-column layouts used effectively
- [ ] Sidebars/navigation accessible
- [ ] No excessive white space

---

## 8. Accessibility (WCAG 2.1 AA)

### Keyboard Navigation

- [ ] Tab order logical
- [ ] All interactive elements focusable
- [ ] Focus indicators visible
- [ ] Enter/Space activate buttons
- [ ] Escape closes modals
- [ ] Arrow keys navigate lists (if applicable)
- [ ] No keyboard traps

### Screen Reader Support

- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] ARIA labels on icons
- [ ] ARIA live regions for dynamic content
- [ ] Headings hierarchy correct (h1 → h2 → h3)
- [ ] Landmarks used (main, nav, aside)
- [ ] Error messages announced

### Color & Contrast

- [ ] Text contrast >= 4.5:1
- [ ] Large text contrast >= 3:1
- [ ] UI component contrast >= 3:1
- [ ] Focus indicators >= 3:1
- [ ] Information not conveyed by color alone

---

## 9. Error Handling Paths

### Network Errors

- [ ] Offline mode shows message
- [ ] Failed save retries or queues
- [ ] Sync errors shown clearly
- [ ] User can retry failed operations

### Data Errors

- [ ] Corrupt data doesn't crash app
- [ ] Missing required fields caught before save
- [ ] Invalid JSON handled gracefully
- [ ] Database errors logged and shown to user

### User Errors

- [ ] Validation errors clear and helpful
- [ ] Multiple errors shown at once
- [ ] Errors positioned near fields
- [ ] Errors accessible to screen readers

---

## 10. Performance Checks

### Page Load Times

- [ ] CPG dashboard loads in <2s
- [ ] Categories list loads in <1s
- [ ] Products list loads in <1s
- [ ] Invoices list loads in <2s
- [ ] CPU Tracker loads in <2s

### Operation Times

- [ ] Category save <500ms
- [ ] Product save <500ms
- [ ] Recipe save <500ms
- [ ] Invoice save <1s
- [ ] CPU calculation <500ms
- [ ] Search/filter <200ms

### Large Data Sets

- [ ] 100+ categories perform well
- [ ] 100+ products perform well
- [ ] 1000+ invoices perform well
- [ ] Pagination works if needed
- [ ] Virtual scrolling for long lists

---

## 11. Data Integrity Checks

### Referential Integrity

- [ ] Cannot delete category used in recipe
- [ ] Cannot delete product with recipes
- [ ] Deleting recipe doesn't orphan components
- [ ] Deleting invoice recalculates CPUs
- [ ] Soft deletes preserve history

### Consistency

- [ ] CPU calculations consistent across views
- [ ] Same data shows same way everywhere
- [ ] Timestamps accurate
- [ ] Version vectors increment correctly
- [ ] No data duplication

---

## 12. Demo Flow Rehearsal

### Opening (2 min)

- [ ] Explain problem: "How much does it cost to make my product?"
- [ ] Show traditional approach (spreadsheets, manual tracking)
- [ ] Introduce BOM system solution

### Categories Setup (3 min)

- [ ] Add Oil category (bulk, oz)
- [ ] Add Bottle category (1oz, 5oz variants)
- [ ] Add Box category (1oz, 5oz variants)
- [ ] Add Label category (no variants)
- [ ] Explain variants concept

### Products Setup (2 min)

- [ ] Add 1oz Body Oil (SKU: BO-1OZ, MSRP: $10.00)
- [ ] Add 5oz Body Oil (SKU: BO-5OZ, MSRP: $25.00)
- [ ] Explain product metadata

### Recipes Creation (5 min)

- [ ] Build 1oz Body Oil recipe (4 components)
- [ ] Show estimated CPU (incomplete)
- [ ] Build 5oz Body Oil recipe (4 components)
- [ ] Explain BOM concept

### Invoices Entry (5 min)

- [ ] Enter oil invoice ($504 for 1200 oz)
- [ ] Show CPU calculation ($0.42/oz)
- [ ] Enter bottle invoices (1oz and 5oz)
- [ ] Enter box invoice (multi-line)
- [ ] Enter label invoice
- [ ] Show running balance validation

### CPU Display (3 min)

- [ ] Navigate to CPU Tracker
- [ ] Show 1oz Body Oil CPU ($1.27)
- [ ] Expand breakdown
- [ ] Show 5oz Body Oil CPU ($3.16)
- [ ] Discuss margin analysis vs MSRP

### Q&A Buffer (5 min)

- [ ] Answer questions
- [ ] Show additional features if time
- [ ] Discuss future enhancements

---

## 13. Fallback Plans

### If Something Breaks

- [ ] Have backup demo data ready
- [ ] Know how to quickly reset database
- [ ] Have screenshots of expected results
- [ ] Can explain verbally if UI fails
- [ ] Have backup browser open

### Common Issues & Fixes

**Modal won't close:**
- Refresh page
- Press Escape
- Use X button only

**CPU not calculating:**
- Check invoice saved correctly
- Verify recipe has all components
- Check variant matching (normalized)

**Validation blocking save:**
- Review error messages
- Check all required fields
- Verify balance matches total

**Data not showing:**
- Check active/deleted filters
- Refresh page
- Check console for errors

---

## 14. Post-Demo Checklist

### Immediate (within 1 hour)

- [ ] Document all bugs found
- [ ] Note all feature requests
- [ ] Save demo data for future use
- [ ] Note what went well
- [ ] Note what needs improvement

### Follow-up (within 24 hours)

- [ ] Create GitHub issues for bugs
- [ ] Prioritize bug fixes
- [ ] Update documentation based on feedback
- [ ] Share demo recording (if recorded)
- [ ] Send thank-you to attendees

---

## 15. Known Issues (Document Before Demo)

**Current Bugs:**
- [List any known bugs that won't be fixed before demo]
- [Explain workarounds if applicable]

**Limitations:**
- [List any missing features that might be asked about]
- [Explain when they'll be implemented]

**Performance:**
- [Note any slow operations]
- [Explain optimization plans]

---

## Sign-Off

**Tester Name:** ________________

**Date Tested:** ________________

**Demo Ready?** Yes / No

**Critical Issues:** ________________

**Notes:** ________________

---

## Quick Reference - Expected Values

```
Raw Material CPUs:
- Oil (bulk): $0.42/oz
- Bottle (1oz): $0.50/each
- Bottle (5oz): $0.60/each
- Box (1oz): $0.25/each
- Box (5oz): $0.36/each
- Label: $0.10/each

Finished Product CPUs:
- 1oz Body Oil: $1.27
  - Oil: 1 oz × $0.42 = $0.42
  - Bottle: 1 × $0.50 = $0.50
  - Box: 1 × $0.25 = $0.25
  - Label: 1 × $0.10 = $0.10
  - TOTAL: $1.27

- 5oz Body Oil: $3.16
  - Oil: 5 oz × $0.42 = $2.10
  - Bottle: 1 × $0.60 = $0.60
  - Box: 1 × $0.36 = $0.36
  - Label: 1 × $0.10 = $0.10
  - TOTAL: $3.16

Margins (CPU vs MSRP):
- 1oz Body Oil: ($10.00 - $1.27) / $10.00 = 87.3% margin
- 5oz Body Oil: ($25.00 - $3.16) / $25.00 = 87.4% margin
```

---

**End of Checklist**
