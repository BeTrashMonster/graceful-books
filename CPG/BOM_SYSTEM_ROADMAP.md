# Bill of Materials (BOM) System Roadmap

**Goal:** Transform CPG module from simple cost tracking to proper Bill of Materials system that tracks how raw materials flow into finished products.

**Timeline:** Complete by Thursday morning for demo
**Estimated Effort:** 4.5-5.5 hours focused work (updated after business analyst review)

---

## ⚠️ Critical Implementation Requirements (From Business Analyst Review)

**These issues were identified in the business analyst review and MUST be addressed for the Thursday demo:**

### 1. Unit Conversion Support
**Problem:** Finished products may be sold in different units than raw materials are purchased in.
- Example: Buy 1200 oz bulk oil, sell products by "bottle" or "case"
- **Solution:** Add `pieces_per_unit` field to finished products
  ```typescript
  pieces_per_unit: number; // How many individual items in one unit
  // Example: 1 case = 12 bottles → pieces_per_unit: 12
  ```

### 2. Variant Matching Normalization
**Problem:** Variant strings need consistent matching ("1oz" vs "1 oz" vs "1-oz")
- **Solution:** Add normalization function:
  ```typescript
  function normalizeVariant(variant: string): string {
    return variant.toLowerCase().replace(/[\s\-_]/g, '');
  }
  ```
- Use normalized values for all variant matching in CPU calculations
- Display original user-entered values in UI

### 3. Missing Raw Material Cost Handling
**Problem:** If recipe includes a raw material without invoice history, CPU shows $0.00 (misleading)
- **Solution:** Implement graceful degradation:
  - Show "Awaiting cost data" instead of $0.00
  - Display warning icon: ⚠️ "Missing cost for: Oil (1oz)"
  - CPU breakdown shows "Incomplete - Missing X components"
  - Prevent finalizing costs until all components have data

### 4. Recipe Quantity Validation
**Problem:** Recipe quantities can be negative, zero, or non-numeric
- **Solution:** Add strict validation:
  ```typescript
  // In recipe form validation
  if (!quantity || parseFloat(quantity) <= 0) {
    errors.quantity = 'Quantity must be greater than 0';
  }
  if (isNaN(parseFloat(quantity))) {
    errors.quantity = 'Quantity must be a valid number';
  }
  ```

### 5. Referential Integrity Checks
**Problem:** User can delete categories that are used in recipes, breaking CPU calculations
- **Solution:** Add deletion safeguards:
  ```typescript
  // Before deleting category
  const recipesUsingCategory = await db.cpgRecipes
    .where('category_id')
    .equals(categoryId)
    .count();

  if (recipesUsingCategory > 0) {
    throw new Error(
      `Cannot delete ${categoryName}. It's used in ${recipesUsingCategory} recipe(s). ` +
      `Please remove it from recipes first.`
    );
  }
  ```
- Same check for finished products (prevent deletion if has recipes)

### 6. CPU Calculation Method Documentation
**Problem:** Not clear how CPU is calculated when multiple invoices exist for same raw material
- **Decision:** Use **Latest Purchase Price** method for demo
  - Simplest to implement and understand
  - Reflects current market pricing
  - Document for user: "CPU based on most recent invoice"
- **Future Enhancement:** Weighted average across all invoices
  ```typescript
  // Phase 1: Latest Purchase (Thursday demo)
  const latestInvoice = invoices
    .filter(inv => /* matches category/variant */)
    .sort((a, b) => b.invoice_date - a.invoice_date)[0];

  // Phase 2: Weighted Average (post-demo)
  const weightedAvg = calculateWeightedAverage(invoices);
  ```

### 7. Additional Validations Required

**Finished Product Validation:**
- SKU must be unique within company (if provided)
- MSRP must be valid currency (if provided)
- Name cannot be empty or duplicate

**Recipe Validation:**
- Cannot add same category+variant twice to same recipe
- Must have at least 1 component to save
- Quantity must use category's unit of measure

**Invoice Line Item Validation:**
- Line items must sum to invoice total (±$0.01 tolerance for rounding)
- Cannot have empty category
- Unit price must be > 0

---

## Parallel Agent Orchestration Strategy

**Implementation approach:** Use multiple specialized agents working in parallel to maximize efficiency.

### Agent Assignment Groups

**Group A (Parallel - No Dependencies):**
1. **Schema Agent:** Create finished products + recipes schemas with validation
2. **Invoice UI Agent:** Refactor invoice entry (description field, total validation, balance checking)
3. **Bug Fix Agent:** Fix immediate UI bugs (duplicate dropdown, tooltip cutoff, alignment)

**Group B (Parallel - Depends on Group A schemas):**
4. **Finished Products UI Agent:** Build Finished Product Manager component with CRUD
5. **Recipe Builder UI Agent:** Build Recipe Builder component with validation
6. **CPU Calculator Agent:** Rewrite CPU calculator service with error handling

**Group C (Parallel - Depends on Group B):**
7. **CPU Display Agent:** Update CPU display to show finished products with breakdowns
8. **Getting Started Agent:** Update onboarding flow with new product/recipe steps
9. **Integration Testing Agent:** End-to-end testing with demo data

### Coordination Points
- **Checkpoint 1 (after Group A):** Verify schemas, run migrations, confirm all agents can proceed
- **Checkpoint 2 (after Group B):** Test basic CRUD operations, verify calculations work
- **Checkpoint 3 (after Group C):** Full demo run-through, polish, bug fixes

### Success Criteria for Each Agent
- All agents must follow "X-only close" modal pattern (closeOnBackdropClick={false})
- All agents must use consistent authentication pattern (companyId, deviceId destructuring)
- All agents must include proper error handling and validation
- All agents must update global state with CustomEvent dispatch on data changes

---

## Current System (What We Have)

**Invoice Entry:**
- User enters invoices with cost attribution to categories (Oil, Bottle, Box)
- Each category can have variants (8oz, 16oz, etc.)
- System calculates "CPU" per category/variant
- **PROBLEM:** Doesn't track how these raw materials combine into finished products

**Example of Current Confusion:**
- User buys 1200 oz bulk oil for $500
- System calculates: Oil CPU = $0.42/oz
- But user sells "1oz Body Oil" and "5oz Body Oil" products
- System can't calculate: "What does it cost to make 1 bottle of 1oz Body Oil?"

---

## New System (What We Need)

**Three-Level Hierarchy:**

1. **Raw Materials** (Categories + Variants)
   - Oil (1200 oz bulk purchase)
   - Bottles (1oz size, 5oz size)
   - Boxes (1oz size, 5oz size)
   - Labels (each)

2. **Recipes/BOM** (How raw materials combine)
   - "1oz Body Oil" = 1oz Oil + 1 Bottle (1oz) + 1 Box (1oz) + 1 Label
   - "5oz Body Oil" = 5oz Oil + 1 Bottle (5oz) + 1 Box (5oz) + 1 Label

3. **Finished Products** (What you sell)
   - 1oz Body Oil (SKU: BO-1OZ, MSRP: $10.00)
   - 5oz Body Oil (SKU: BO-5OZ, MSRP: $25.00)

**CPU Calculation Flow:**
```
Raw Material Invoice → Category/Variant CPU → Recipe → Finished Product CPU
```

**Example:**
- Oil invoice: 1200 oz @ $500 = $0.42/oz
- Bottle invoice: 100 bottles (1oz) @ $50 = $0.50/each
- Box invoice: 100 boxes (1oz) @ $25 = $0.25/each
- Label invoice: 500 labels @ $50 = $0.10/each

**Finished Product CPU:**
- 1oz Body Oil = (1 × $0.42) + (1 × $0.50) + (1 × $0.25) + (1 × $0.10) = **$1.27**
- 5oz Body Oil = (5 × $0.42) + (1 × $0.55) + (1 × $0.30) + (1 × $0.10) = **$3.05**

---

## Phase 1: Data Foundation (30-45 min)

### 1.1 Finished Products Schema

**New Table: `cpg_finished_products`**

```typescript
interface CPGFinishedProduct extends BaseEntity {
  id: string;
  company_id: string;
  name: string; // "1oz Body Oil"
  description: string | null;
  sku: string | null; // "BO-1OZ"
  msrp: string | null; // "10.00"
  unit_of_measure: string; // "each", "case", "dozen", etc.
  pieces_per_unit: number; // How many individual items in one unit (default: 1)
                           // Example: "case" with pieces_per_unit: 12 = 12 bottles per case
  active: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}
```

**Indexes:**
- Primary: id
- Queries: company_id, [company_id+active], sku

**Validation Requirements (from Business Analyst):**
- `name` required, cannot be empty, must be unique within company
- `sku` optional, but if provided must be unique within company
- `msrp` optional, but if provided must be valid currency format
- `unit_of_measure` required, default "each"
- `pieces_per_unit` required, must be integer ≥ 1, default 1

### 1.2 Recipe/BOM Schema

**New Table: `cpg_recipes`**

```typescript
interface CPGRecipe extends BaseEntity {
  id: string;
  company_id: string;
  finished_product_id: string; // Links to cpg_finished_products

  // Raw material component
  category_id: string; // Links to cpg_categories
  variant: string | null; // Specific variant (e.g., "1oz")

  // Quantity needed
  quantity: string; // "1.00" for 1oz oil, "1" for 1 bottle

  // Metadata
  notes: string | null;
  active: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}
```

**Indexes:**
- Primary: id
- Queries: finished_product_id, category_id, [company_id+finished_product_id]

**Business Rules:**
- One finished product can have multiple recipe lines (multi-component BOM)
- Each recipe line specifies ONE raw material component
- Quantity is in the raw material's unit of measure

**Validation Requirements (from Business Analyst):**
- `quantity` must be > 0 (no negative or zero quantities)
- `quantity` must be valid numeric string
- Cannot have duplicate category_id + variant combination within same recipe
- Recipe must have at least 1 component to be valid
- Referential integrity: Cannot delete category if used in any recipe
- Referential integrity: Cannot delete finished product if has recipes

### 1.3 Add Units of Measure to Categories

**Update: `cpg_categories`**

Add field:
```typescript
unit_of_measure: string; // "oz", "each", "lb", "ml", "g", etc.
```

**Default units:**
- Ingredients (Oil, Sauce, etc.) → "oz" or "ml"
- Packaging (Bottles, Boxes) → "each"
- Labels → "each"

**Why:** Need to know "1oz of Oil" vs "1 Bottle" for proper recipe calculations

---

## Phase 2: UI Components (1-1.5 hours)

### 2.1 Finished Products Manager

**New Component: `FinishedProductManager.tsx`**

**Location:** Accessible from:
- CPG Dashboard card: "My Products"
- Action bar: "Add Product" button
- Getting Started: Step 1.5 (between Categories and Invoices)

**Features:**
- List all finished products (grid/table view)
- Add new finished product
  - Name, SKU, MSRP
  - Unit of measure
- Edit/Delete products
- Click product → opens Recipe Builder

**Wireframe:**
```
┌─────────────────────────────────────┐
│ My Finished Products                │
├─────────────────────────────────────┤
│ [+ Add Product]                     │
│                                     │
│ ┌──────────────────┐ ┌─────────────┐│
│ │ 1oz Body Oil     │ │ 5oz Body Oil││
│ │ SKU: BO-1OZ      │ │ SKU: BO-5OZ ││
│ │ MSRP: $10.00     │ │ MSRP: $25.00││
│ │ CPU: $1.27       │ │ CPU: $3.05  ││
│ │ [Edit Recipe]    │ │ [Edit Recipe]││
│ └──────────────────┘ └─────────────┘│
└─────────────────────────────────────┘
```

### 2.2 Recipe Builder

**New Component: `RecipeBuilder.tsx`**

**Opens when:** User clicks "Edit Recipe" on a finished product

**Features:**
- List all components in the recipe
- Add component:
  - Select category (Oil, Bottle, Box, Label)
  - Select variant (1oz, 5oz, etc.) if applicable
  - Enter quantity needed
- Remove component
- Show estimated CPU based on current raw material costs
- Save recipe

**Wireframe:**
```
┌─────────────────────────────────────────┐
│ Recipe: 1oz Body Oil                    │
├─────────────────────────────────────────┤
│ Component          Qty      Cost/Unit   │
│ ─────────────────────────────────────── │
│ Oil (bulk)         1 oz     $0.42       │
│ Bottle (1oz)       1 each   $0.50       │
│ Box (1oz)          1 each   $0.25       │
│ Label              1 each   $0.10       │
│                                          │
│ [+ Add Component]                        │
│                                          │
│ ────────────────────────────────────────│
│ Total CPU: $1.27                         │
│                                          │
│ [Cancel]                        [Save]   │
└─────────────────────────────────────────┘
```

**Validation:**
- Must have at least 1 component
- Quantity must be > 0
- Cannot duplicate same category+variant in recipe

---

## Phase 3: Refactor Invoice & CPU (1-1.5 hours)

### 3.1 Invoice Entry Overhaul

**Update: `AddInvoiceModal.tsx` and `InvoiceEntryForm.tsx`**

**Changes:**

1. **Add Invoice-Level Total**
   - New field at top: "Total Invoice Amount: $______"
   - Validates: Sum of line items must equal total
   - Shows running balance: "Remaining: $XX.XX"

2. **Add Description to Line Items**
   - New field per line: "Description" (optional)
   - Example: "Bulk lavender oil from ABC Supplier"
   - Helps user remember what each line item was

3. **Clarify "Raw Materials Only"**
   - Update header text: "Enter raw material purchases"
   - Helper text: "Track ingredients and packaging you buy to make your products"
   - Remove confusing "CPU Preview" that shows per-variant costs

4. **Enhanced Line Item Structure**
   ```
   Line 1:
   [Description: ________________] (optional)
   [Category: Oil ▼] [Variant: bulk ▼]
   [Units Purchased: ____] [Unit Price: $____]
   [Units Received: ____] (auto-fills from Units Purchased)

   Subtotal: $XXX.XX
   [Remove Line]
   ```

5. **Auto-fill Units Received**
   - Fix bug: Currently only auto-fills first line
   - Should auto-fill for ALL lines when Units Purchased changes

**Validation (Updated with Business Analyst Requirements):**
- Line items must balance to invoice total (±$0.01 tolerance for rounding)
- Show clear error: "Line items ($450.00) don't match invoice total ($500.00). Remaining: $50.00"
- Cannot have empty category selection
- Unit price must be > 0
- Units purchased must be > 0
- Show running balance as user adds line items:
  ```
  Invoice Total: $500.00
  Line Items: $450.00
  Remaining: $50.00 (needs allocation)
  ```

### 3.2 CPU Calculator Service Rewrite

**Update: `cpuCalculator.service.ts`**

**New Methods:**

1. **`calculateRawMaterialCPU()`** (existing, but clarify name)
   - Calculates cost per unit for raw materials (categories/variants)
   - Based on invoice history
   - Example: Oil → $0.42/oz

2. **`calculateFinishedProductCPU(finishedProductId)`** (NEW)
   - Gets recipe for finished product
   - Gets current CPU for each component
   - Multiplies quantity × component CPU
   - Sums all components
   - Returns: Total CPU for finished product

3. **`getFinishedProductCPUBreakdown(finishedProductId)`** (NEW)
   - Same as above but returns detailed breakdown
   - Shows: Each component, quantity, unit cost, subtotal
   - For display in UI

**Calculation Method (from Business Analyst):**
- Use **Latest Purchase Price** for raw materials
- If no invoice exists for a component, return null/error state (not $0)
- Variant matching uses normalized strings (strip spaces, hyphens, lowercase)

**Example Logic:**
```typescript
async calculateFinishedProductCPU(productId: string): Promise<{
  cpu: string | null;
  breakdown: Array<{
    categoryName: string;
    variant: string | null;
    quantity: string;
    unitCost: string | null;
    subtotal: string | null;
    hasCostData: boolean;
  }>;
  isComplete: boolean;
}> {
  // Get recipe
  const recipe = await db.cpgRecipes
    .where('finished_product_id')
    .equals(productId)
    .toArray();

  if (recipe.length === 0) {
    return { cpu: null, breakdown: [], isComplete: false };
  }

  let totalCPU = 0;
  let isComplete = true;
  const breakdown = [];

  for (const component of recipe) {
    // Get category name for display
    const category = await db.cpgCategories.get(component.category_id);

    // Get current CPU for this raw material (latest purchase price)
    const rawCPU = await this.calculateRawMaterialCPU(
      component.category_id,
      component.variant
    );

    // Check if cost data exists
    const hasCostData = rawCPU !== null;
    if (!hasCostData) {
      isComplete = false;
    }

    // Calculate subtotal
    const subtotal = hasCostData
      ? (parseFloat(rawCPU) * parseFloat(component.quantity)).toFixed(2)
      : null;

    if (hasCostData) {
      totalCPU += parseFloat(subtotal!);
    }

    breakdown.push({
      categoryName: category?.name || 'Unknown',
      variant: component.variant,
      quantity: component.quantity,
      unitCost: rawCPU,
      subtotal,
      hasCostData,
    });
  }

  return {
    cpu: isComplete ? totalCPU.toFixed(2) : null,
    breakdown,
    isComplete,
  };
}

// Helper: Normalize variant strings for matching
function normalizeVariant(variant: string | null): string | null {
  if (!variant) return null;
  return variant.toLowerCase().replace(/[\s\-_]/g, '');
}
```

### 3.3 CPU Display Updates

**Update: `CPUDisplay.tsx`**

**Changes:**

**BEFORE (Raw Material CPU):**
```
Current Cost Per Unit

Oil (8oz): $3.36/each
Oil (16oz): $6.40/each
Bottle (Small): $0.50/each
```

**AFTER (Finished Product CPU):**
```
Product Manufacturing Costs

1oz Body Oil (BO-1OZ)
  Total CPU: $1.27
  [Show Breakdown ▼]

  Breakdown:
  - Oil (1 oz): $0.42
  - Bottle (1oz): $0.50
  - Box (1oz): $0.25
  - Label (1 each): $0.10

5oz Body Oil (BO-5OZ)
  Total CPU: Incomplete ⚠️
  [Show Breakdown ▼]

  Breakdown:
  - Oil (5 oz): $2.10
  - Bottle (5oz): Awaiting cost data ⚠️
  - Box (5oz): $0.36
  - Label (1 each): $0.10

  Missing cost data for: Bottle (5oz)
  Enter an invoice for this raw material to complete CPU calculation.
```

**Features (Updated with Error Handling):**
- Show finished product name + SKU
- Total CPU prominently displayed (or "Incomplete" if missing data)
- Warning icons for missing cost data
- Expandable breakdown showing component costs
- Clear messaging about what data is missing
- Color coding for margin quality (based on MSRP vs CPU)
- "Awaiting cost data" instead of $0.00 for missing components

---

## Phase 4: Bug Fixes & Polish (30 min)

### 4.1 Immediate Bugs

**From user feedback:**

1. ✅ "Select category" appears twice in dropdown
   - **Fix:** Remove duplicate option element

2. ✅ Tooltip cuts off, can't read full text
   - **Fix:** Adjust tooltip max-width and positioning
   - **Also:** Review tooltip content for clarity

3. ✅ Focus indicator misaligned on Unit Price field
   - **Fix:** CSS alignment for focus state

4. ✅ Units Received only auto-fills first line item
   - **Fix:** Apply auto-fill logic to all line items in array

### 4.2 Getting Started Card Updates

**Update flow:**
```
1. ✓ Add Categories (Ingredients, Packaging, Labels)
2. ✓ Add Your Products (NEW - What you sell)
3. ✓ Define Recipes (NEW - How products are made)
4. ⃞ Add Distributors (optional)
5. ⃞ Enter First Invoice (Raw materials)
```

**Why:** Users need to define products + recipes BEFORE entering invoices, so CPU calculations work correctly

### 4.3 Navigation Updates

**CPG Dashboard Cards:**
- Add new card: "My Products" (links to Finished Product Manager)
- Update "CPU Tracker" description: "Track manufacturing costs for your products"

**Action Bar Context:**
- Dashboard: Show "Add Product" button
- My Products page: Show "Add Product" button
- CPU Tracker: Show "Add Invoice" button

---

## Data Migration & Demo Setup

### Demo Data to Create

**Categories (Raw Materials):**
1. Oil - bulk (unit: oz)
2. Bottle - 1oz, 5oz variants (unit: each)
3. Box - 1oz, 5oz variants (unit: each)
4. Label (unit: each)

**Finished Products:**
1. 1oz Body Oil (SKU: BO-1OZ, MSRP: $10.00)
2. 5oz Body Oil (SKU: BO-5OZ, MSRP: $25.00)

**Recipes:**
- 1oz Body Oil: 1oz Oil + 1 Bottle(1oz) + 1 Box(1oz) + 1 Label
- 5oz Body Oil: 5oz Oil + 1 Bottle(5oz) + 1 Box(5oz) + 1 Label

**Sample Invoices:**
1. Bulk Oil: 1200 oz @ $500
2. Bottles (1oz): 100 @ $50
3. Bottles (5oz): 50 @ $30
4. Boxes (1oz): 100 @ $25
5. Boxes (5oz): 50 @ $18
6. Labels: 500 @ $50

**Expected CPUs:**
- Oil: $0.42/oz
- Bottle (1oz): $0.50/each
- Bottle (5oz): $0.60/each
- Box (1oz): $0.25/each
- Box (5oz): $0.36/each
- Label: $0.10/each

**Expected Finished Product CPUs:**
- 1oz Body Oil: $1.27
- 5oz Body Oil: $3.16

---

## Success Criteria

**For Thursday Demo, system must:**

✅ **User can define finished products**
- Name, SKU, MSRP entered
- Products displayed in "My Products" section

✅ **User can build recipes**
- Select raw material categories/variants
- Specify quantities
- See estimated CPU

✅ **Invoice entry tracks raw materials**
- Clear it's for raw materials only
- Description field per line item
- Invoice total with balance validation
- Units received auto-fills correctly

✅ **CPU display shows finished product costs**
- Prominent display of total CPU
- Breakdown shows component costs
- Clear what it costs to make each product

✅ **Demo flow is intuitive**
- Getting Started guides user through: Categories → Products → Recipes → Invoices
- No confusion about what to enter where
- Math makes sense to user

✅ **All modals are X-only close**
- No accidental data loss from backdrop clicks

---

## Open Questions for Business Analyst Review

1. **Unit of Measure Handling:**
   - Should users be able to define custom units? (gallons, liters, etc.)
   - Or stick with predefined list? (oz, ml, each, lb, g)
   - How do we handle conversions? (1 lb = 16 oz)

2. **Recipe Versioning:**
   - If user changes a recipe, should we track history?
   - Or just update in place?
   - Impact on historical CPU calculations?

3. **Multi-Step Manufacturing:**
   - What if user has intermediate products?
   - Example: "Body Oil Base" (oil + fragrance) → then bottled
   - Do we need sub-assemblies or keep it single-level BOM?

4. **Waste/Yield Factors:**
   - Real manufacturing has waste (spillage, testing, etc.)
   - Should recipes include yield percentage?
   - Example: Recipe calls for 1.1 oz oil to yield 1 oz product (10% waste)

5. **Invoice Entry UX:**
   - Should we support "Quick Add" from vendor catalog?
   - Or always manual entry?
   - How important is vendor profile management?

6. **CPU Display Priority:**
   - Show finished products by default?
   - Or let user toggle between finished products vs raw materials?
   - Both views useful for different purposes?

7. **Scalability:**
   - How many finished products will typical user have? (10? 100? 1000?)
   - How many components per recipe? (5? 20?)
   - Affects UI design (grid vs table, pagination, etc.)

---

## Dependencies & Risks

**Dependencies:**
- Existing database schema (cpg_categories, cpg_invoices) - ✅ Working
- CPU calculator service - ✅ Exists, needs enhancement
- Modal components - ✅ Working
- Getting Started card - ✅ Working

**Risks:**

1. **Time Constraint (HIGH)**
   - 4.5 hour estimate is aggressive
   - Mitigation: Prioritize ruthlessly, cut scope if needed
   - Core demo path: Add product → Build recipe → Enter invoice → See CPU

2. **Data Migration (MEDIUM)**
   - Existing demo data won't have products/recipes
   - Mitigation: Auto-migrate or provide setup wizard

3. **Calculation Complexity (MEDIUM)**
   - Multi-level calculations can have edge cases
   - Mitigation: Test with diverse scenarios
   - Handle missing data gracefully (show "N/A" not errors)

4. **User Confusion (MEDIUM)**
   - Concept of BOM might be new to some users
   - Mitigation: Clear language, good examples, helper text
   - Video tutorial for complex parts

---

## Future Enhancements (Post-Thursday)

**Not for demo, but on roadmap:**

1. **Vendor Management**
   - Vendor profiles with contact info
   - Purchase order tracking
   - Preferred vendor per raw material

2. **Batch/Lot Tracking**
   - Track which raw material batch went into which finished product batch
   - Useful for recalls, quality issues

3. **Inventory Management**
   - Track on-hand quantities of raw materials
   - Alert when running low
   - Link to finished product assembly

4. **Cost Analysis Tools**
   - CPU trends over time
   - Identify cost drivers
   - Scenario planning ("What if oil prices go up 20%?")

5. **Calculator in Number Fields**
   - Allow basic math: "100 + 50" → 150
   - Useful for complex calculations

6. **Multi-Currency Support**
   - Buy raw materials in different currencies
   - Convert to base currency for CPU

7. **Manufacturing Orders**
   - Record when you make batches of finished products
   - Deduct raw materials from inventory
   - Track actual vs standard costs

---

## Timeline Breakdown (Updated with Business Analyst Requirements)

**Hour 1: Data Foundation + Validation**
- 0:00-0:25: Create finished products schema (with pieces_per_unit)
- 0:25-0:40: Create recipes schema
- 0:40-0:50: Add units to categories schema
- 0:50-1:00: Add validation functions and referential integrity checks

**Hour 2: Finished Products UI + Validation**
- 1:00-1:40: Build Finished Product Manager component
- 1:40-2:00: Add SKU uniqueness validation, MSRP format validation

**Hour 3: Recipe Builder UI + Validation**
- 2:00-2:50: Build Recipe Builder component with quantity validation
- 2:50-3:00: Add duplicate component prevention

**Hour 4: Invoice Refactor + Balance Validation**
- 3:00-3:40: Refactor invoice entry (description, total, running balance)
- 3:40-3:50: Fix auto-fill units received for all lines
- 3:50-4:00: Add invoice balance validation (±$0.01 tolerance)

**Hour 5: CPU Calculator + Error Handling**
- 4:00-4:20: Implement latest purchase price method
- 4:20-4:35: Add variant normalization for matching
- 4:35-4:50: Add missing cost data handling
- 4:50-5:00: Test CPU calculations with various scenarios

**Hour 5.5: Display Updates + Polish**
- 5:00-5:20: Update CPU display with "Awaiting cost data" states
- 5:20-5:30: Update Getting Started card flow
- 5:30-5:45: End-to-end testing with demo data
- 5:45-6:00: Fix remaining UI bugs (alignment, tooltips, duplicates)

**Total: ~5.5-6 hours** (increased due to validation requirements)

---

## Notes

- This roadmap assumes clean implementation with minimal debugging
- Buffer time built in for testing
- Can adjust scope if running behind schedule
- Core demo path prioritized over edge cases
