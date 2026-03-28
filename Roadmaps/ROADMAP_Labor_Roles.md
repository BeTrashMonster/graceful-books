# Labor + Roles Feature - Implementation Roadmap

## Overview

Labor + Roles is a comprehensive labor cost tracking system that allows CPG entrepreneurs to accurately calculate labor costs per unit and integrate them into their CPU (Cost Per Unit) calculations. This empowers users to see the complete picture of their production costs, including both materials and labor.

**Route:** `/cpg/labor-roles`

**Core Philosophy:**
- Flexibility over prescription - let users define their own roles and methods
- Batch OR per-unit entry - match their real production workflow
- Quick-add flow - reduce friction when assigning labor
- Complete visibility - labor costs integrate everywhere CPU appears
- User empowerment - provide tools to see data their way

---

## Feature Goals

1. **Enable Labor Tracking:** Allow users to define labor roles with hourly or salary-based compensation
2. **Flexible Entry:** Support both per-batch and per-unit labor hour entry
3. **Accurate Calculation:** Convert salaries to hourly rates and calculate labor CPU automatically
4. **Seamless Integration:** Include labor costs in CPU breakdowns across all analysis tools
5. **Complete Reporting:** Provide labor-specific reports and analysis
6. **Quick Workflow:** Enable on-the-fly role creation without context switching

---

## User Journey

### Setup & Role Management
1. User navigates to "Labor + Roles" tab in sidebar
2. Sees list of existing labor roles (or empty state)
3. Clicks "+ Add Labor Role" (purple button)
4. Fills out role details:
   - Role name (e.g., "Production Lead" or "Sarah (Packaging)")
   - Compensation type: Hourly OR Salary
   - If Hourly: enters hourly rate
   - If Salary: enters amount and selects pay period (Yearly/Monthly/Bi-Weekly/Weekly)
   - Sees auto-calculated hourly equivalent for salary
   - Sees disclaimer about buffering in taxes/benefits
5. Saves role
6. Role appears in list with calculated hourly rate

### Product Labor Assignment
1. User goes to "My Products" page
2. Clicks on a product to view/edit
3. Sees new "Labor Costs" section
4. Clicks "+ Assign Labor Role"
5. Modal opens with:
   - Dropdown to select existing role OR "+ Create New Role" at bottom
   - Entry method tabs: "Per Batch" (default) | "Per Unit"
   - If Per Batch: enters hours for batch + batch size, sees auto-calculated hours/unit
   - If Per Unit: enters hours per single unit
6. Saves assignment
7. Labor cost per unit auto-calculates and appears in product's total CPU

### Quick Add Flow (No Context Switching)
1. While assigning labor to a product, user clicks "+ Create New Role" in dropdown
2. Role creation modal opens inline
3. User creates role (same form as above)
4. After saving, new role is immediately selected in assignment dropdown
5. User continues assigning hours without leaving product page

### CPU Integration & Analysis
1. Labor costs now appear in all CPU breakdowns:
   - My Products page
   - CPU Tracker
   - What-If Calculator
   - Promo Analysis
   - Events Analysis
   - Distribution reports
2. CPU breakdown shows expandable labor section with role-by-role detail
3. All margin calculations include labor costs automatically

### Labor Reporting
1. User navigates to Reports
2. New "Labor Analysis" section shows:
   - Labor Cost by Product
   - Labor Cost by Role
   - Labor vs. Ingredients Ratio
   - Labor Cost Trends (if applicable)

---

## Implementation Phases

### Phase 1: Foundation (Database + Labor Management UI)
**Goal:** Enable users to create and manage labor roles, assign to products, and store data. No tool integration yet.

**Confidence Level:** 90% ✅

#### 1.1 Create Database Schema
**File:** `src/db/schema/cpg.schema.ts`

Add two new interfaces:

```typescript
/**
 * CPG Labor Role
 * Represents a labor role/position with associated compensation
 */
export interface CPGLaborRole {
  id: string;
  company_id: string;
  device_id: string;

  // Role Details
  role_name: string; // "Production Lead", "Line Worker", "Sarah (Packaging)"
  compensation_type: 'hourly' | 'salary';

  // Hourly roles
  hourly_rate: string | null; // Dollar amount per hour (null if salary)

  // Salary roles
  salary_amount: string | null; // Dollar amount (null if hourly)
  salary_period: 'yearly' | 'monthly' | 'biweekly' | 'weekly' | null; // null if hourly
  hourly_equivalent: string; // Calculated hourly rate (auto-calculated for salary, same as hourly_rate for hourly)

  // Metadata
  notes: string | null; // Optional internal notes
  products_using_count: number; // Cached count of products using this role

  // Standard fields
  active: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}

/**
 * CPG Product Labor Assignment
 * Junction table linking products to labor roles with hour specifications
 */
export interface CPGProductLabor {
  id: string;
  company_id: string;
  device_id: string;

  // Relationships
  product_id: string; // FK to CPGFinishedProduct
  labor_role_id: string; // FK to CPGLaborRole

  // Labor Hours Entry
  entry_method: 'per_batch' | 'per_unit';

  // Per Batch Entry
  hours_per_batch: string | null; // Total hours for one batch (null if per_unit)
  batch_size: string | null; // Number of units in batch (null if per_unit)

  // Per Unit Entry
  hours_per_unit: string; // Calculated if per_batch, directly entered if per_unit

  // Calculated Cost
  labor_cost_per_unit: string; // hours_per_unit × hourly_equivalent

  // Standard fields
  active: boolean;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  version_vector: Record<string, number>;
}
```

Add validation functions:

```typescript
export function validateCPGLaborRole(role: Partial<CPGLaborRole>): string[] {
  const errors: string[] = [];

  if (!role.role_name || role.role_name.trim() === '') {
    errors.push('Role name is required');
  }

  if (!role.compensation_type) {
    errors.push('Compensation type is required');
  }

  if (role.compensation_type === 'hourly') {
    if (!role.hourly_rate || parseFloat(role.hourly_rate) <= 0) {
      errors.push('Hourly rate must be greater than 0');
    }
  }

  if (role.compensation_type === 'salary') {
    if (!role.salary_amount || parseFloat(role.salary_amount) <= 0) {
      errors.push('Salary amount must be greater than 0');
    }
    if (!role.salary_period) {
      errors.push('Salary period is required');
    }
  }

  return errors;
}

export function validateCPGProductLabor(assignment: Partial<CPGProductLabor>): string[] {
  const errors: string[] = [];

  if (!assignment.product_id) {
    errors.push('Product ID is required');
  }

  if (!assignment.labor_role_id) {
    errors.push('Labor role is required');
  }

  if (!assignment.entry_method) {
    errors.push('Entry method is required');
  }

  if (assignment.entry_method === 'per_batch') {
    if (!assignment.hours_per_batch || parseFloat(assignment.hours_per_batch) <= 0) {
      errors.push('Hours per batch must be greater than 0');
    }
    if (!assignment.batch_size || parseFloat(assignment.batch_size) <= 0) {
      errors.push('Batch size must be greater than 0');
    }
  }

  if (assignment.entry_method === 'per_unit') {
    if (!assignment.hours_per_unit || parseFloat(assignment.hours_per_unit) <= 0) {
      errors.push('Hours per unit must be greater than 0');
    }
  }

  return errors;
}

/**
 * Calculate hourly equivalent from salary
 */
export function calculateHourlyEquivalent(
  salaryAmount: string,
  salaryPeriod: 'yearly' | 'monthly' | 'biweekly' | 'weekly'
): string {
  const amount = parseFloat(salaryAmount);

  const divisors = {
    yearly: 2080, // 40 hours/week × 52 weeks
    monthly: 173.33, // 2080 / 12
    biweekly: 80, // 40 hours × 2 weeks
    weekly: 40, // 40 hours/week
  };

  const hourlyRate = amount / divisors[salaryPeriod];
  return hourlyRate.toFixed(2);
}

/**
 * Calculate labor cost per unit
 */
export function calculateLaborCostPerUnit(
  hoursPerUnit: string,
  hourlyRate: string
): string {
  const hours = parseFloat(hoursPerUnit);
  const rate = parseFloat(hourlyRate);
  const cost = hours * rate;
  return cost.toFixed(2);
}
```

**Acceptance Criteria:**
- ✅ TypeScript interfaces compile without errors
- ✅ Validation functions catch all required fields
- ✅ Salary conversion formulas are mathematically correct
- ✅ Labor cost calculation formula is correct

#### 1.2 Add Tables to Database
**File:** `src/db/database.ts`

Add table definitions to Dexie schema:

```typescript
cpgLaborRoles: '++id, company_id, [company_id+active], role_name, created_at',
cpgProductLabor: '++id, company_id, [company_id+product_id], [company_id+labor_role_id], [company_id+active], created_at',
```

Update database version number and migration.

**Acceptance Criteria:**
- ✅ Database migration runs successfully
- ✅ Tables created with correct indexes
- ✅ No errors in browser console on database init

#### 1.3 Create Labor Role Service
**File:** `src/services/cpg/laborRole.service.ts`

```typescript
import { db } from '../../db/database';
import { v4 as uuidv4 } from 'uuid';
import type { CPGLaborRole, CPGProductLabor } from '../../db/schema/cpg.schema';
import {
  validateCPGLaborRole,
  validateCPGProductLabor,
  calculateHourlyEquivalent,
  calculateLaborCostPerUnit,
} from '../../db/schema/cpg.schema';

export class LaborRoleService {
  // Methods for managing labor roles
  // Methods for managing product labor assignments
  // Methods for calculating labor costs
}
```

Implement full CRUD operations for both tables.

**Acceptance Criteria:**
- ✅ Can create labor roles (hourly and salary)
- ✅ Can update labor roles
- ✅ Can soft-delete labor roles
- ✅ Can retrieve labor roles for a company
- ✅ Can assign labor to products
- ✅ Can update labor assignments
- ✅ Can remove labor assignments
- ✅ Calculations are accurate

#### 1.4 Create Labor + Roles Page UI
**File:** `src/pages/cpg/LaborRoles.tsx`
**File:** `src/pages/cpg/LaborRoles.module.css`

**Layout:**
- Header with title "Labor + Roles"
- Purple "+ Add Labor Role" button
- Table showing existing roles:
  - Role Name
  - Type (Hourly/Salary badge)
  - Rate ($/hr with tooltip for salary showing original amount)
  - # Products Using
  - Actions (Edit/Archive buttons in gold)
- Empty state if no roles exist

**Styling:**
- Royal purple (#4b006e) for primary buttons and headers
- Gold (#D4AF37) borders on cards
- Gold gradient for special action buttons
- Follow CPGSettings.module.css patterns

**Acceptance Criteria:**
- ✅ Page renders without errors
- ✅ Table displays all active labor roles
- ✅ Empty state shows helpful message
- ✅ Purple button stands out
- ✅ Responsive design works on mobile
- ✅ WCAG 2.1 AA compliant

#### 1.5 Create Add/Edit Labor Role Modal
**File:** `src/components/cpg/modals/LaborRoleModal.tsx`
**File:** `src/components/cpg/modals/LaborRoleModal.module.css`

**Form Fields:**
- Role Name (text input)
- Compensation Type (toggle: Hourly | Salary)
- **If Hourly:**
  - Hourly Rate ($ input)
  - Disclaimer text
- **If Salary:**
  - Salary Amount ($ input)
  - Pay Period (dropdown: Yearly, Monthly, Bi-Weekly, Weekly)
  - Auto-calculated display: "≈ $XX.XX per hour" (live update)
  - Disclaimer text
- Notes (optional textarea)
- Actions: Cancel (outline) | Save (purple)

**Disclaimer Text:**
"Labor does not include employer taxes, insurance, or other applicable fees. Consult with your accountant for total employment costs."

**Acceptance Criteria:**
- ✅ Modal opens and closes properly
- ✅ Toggle between hourly and salary works
- ✅ Salary auto-calculates hourly equivalent in real-time
- ✅ All pay periods calculate correctly
- ✅ Validation shows errors before submit
- ✅ Success saves and updates table
- ✅ Purple save button matches brand
- ✅ Disclaimer is clearly visible

#### 1.6 Add Labor Section to Product Page
**File:** `src/pages/cpg/FinishedProducts.tsx` (or wherever product details are shown)

Add new "Labor Costs" section:
- Heading: "Labor Costs"
- List of assigned labor roles showing:
  - Role name
  - Hours (with method badge: "Per Batch" or "Per Unit")
  - Labor cost per unit
  - Edit/Remove actions
- "+ Assign Labor Role" button (purple)
- Total labor cost per unit at bottom

**Acceptance Criteria:**
- ✅ Section appears on product detail view
- ✅ Shows all assigned labor roles
- ✅ Displays costs correctly
- ✅ Edit and remove work properly
- ✅ Totals sum correctly

#### 1.7 Create Labor Assignment Modal
**File:** `src/components/cpg/modals/LaborAssignmentModal.tsx`

**Form Fields:**
- **Select Role** (dropdown)
  - Lists all active labor roles
  - "+ Create New Role" option at bottom (triggers quick-add)
- **Entry Method** (tabs): "Per Batch" | "Per Unit"
  - **Per Batch Tab:**
    - Hours for this batch: ___ (number input)
    - Batch produces ___ units (number input)
    - Auto-display: "= 0.XX hours per unit"
  - **Per Unit Tab:**
    - Hours per single unit: ___ (number input)
- Auto-calculated preview: "Labor cost: $X.XX per unit"
- Actions: Cancel | Save (purple)

**Quick-Add Flow:**
- Clicking "+ Create New Role" in dropdown opens LaborRoleModal inline
- After saving new role, it's auto-selected and user returns to assignment modal
- No page navigation, seamless flow

**Acceptance Criteria:**
- ✅ Dropdown shows all roles
- ✅ "+ Create New Role" triggers quick-add
- ✅ Quick-add returns to assignment without losing context
- ✅ Per Batch tab auto-calculates hours/unit
- ✅ Per Unit tab accepts direct input
- ✅ Preview shows accurate labor cost
- ✅ Saves correctly to database
- ✅ Product labor list updates immediately

#### 1.8 Add Labor + Roles to Navigation
**File:** `src/components/layouts/CPGLayout.tsx`

Add new navigation item in sidebar:
```tsx
<Link
  to="/cpg/labor-roles"
  className={isActive('/cpg/labor-roles') ? styles.active : ''}
>
  ⚙️ Labor + Roles
</Link>
```

Add route:
**File:** `src/routes/index.tsx`

```tsx
const LaborRoles = lazy(() => import('../pages/cpg/LaborRoles'))

// In routes:
<Route path="/cpg/labor-roles" element={<LaborRoles />} />
```

**Acceptance Criteria:**
- ✅ Navigation item appears in sidebar
- ✅ Active state highlights correctly
- ✅ Route works and loads page
- ✅ Lazy loading works properly

---

### Phase 2: CPU Integration (Critical)
**Goal:** Update CPU calculator to include labor costs. Show labor in CPU breakdowns everywhere.

**Confidence Level:** 85% ✅

#### 2.1 Update CPU Calculator Service
**File:** `src/services/cpg/cpuCalculator.service.ts`

Update `getFinishedProductCPUBreakdown` to include labor:

```typescript
interface CPUBreakdown {
  cpu: string;
  ingredientsCPU: string;
  laborCPU: string; // NEW
  laborBreakdown: Array<{ // NEW
    roleName: string;
    hourlyRate: string;
    hoursPerUnit: string;
    costPerUnit: string;
  }>;
  totalCPU: string; // ingredients + labor
}
```

Load labor assignments for product and calculate labor CPU.

**Acceptance Criteria:**
- ✅ CPU calculation includes labor costs
- ✅ Labor breakdown provides role-by-role detail
- ✅ Totals are mathematically correct
- ✅ Works for products with no labor (labor = $0)
- ✅ No performance degradation

#### 2.2 Update CPU Display Components
**Files to update:**
- `src/pages/cpg/FinishedProducts.tsx` - product CPU display
- `src/pages/cpg/CPUTracker.tsx` - CPU tracker page

Update CPU breakdown display to show:
```
Ingredients:        $2.50
Labor:             $1.16 ↓ (expandable)
  - Production Lead ($28/hr × 0.01 hrs):  $0.28
  - Line Worker ($18/hr × 0.05 hrs):      $0.90
  - QC ($25/hr × 0.008 hrs):              $0.20
─────────────────
Total CPU:         $3.66
```

**Acceptance Criteria:**
- ✅ Labor appears as separate line in CPU breakdown
- ✅ Expandable section shows role-by-role detail
- ✅ Totals match calculation service
- ✅ Design matches existing breakdown style
- ✅ Gold borders and purple accents per brand

---

### Phase 3: Analysis Tool Integration (One at a time)
**Goal:** Integrate labor costs into What-If Calculator, Promo Analysis, Events Analysis, Distribution reports.

**Confidence Level:** 80% per tool ⚠️

**Approach:** Update one tool at a time, test thoroughly, move to next.

#### 3.1 Update What-If Calculator
**File:** `src/pages/cpg/tabs/scenario/WhatIfCalculatorTab.tsx`

**Changes:**
- Load product labor data when products are selected
- Include labor CPU in calculations
- Show labor in results breakdown
- Labor costs should affect margins and profitability

**Acceptance Criteria:**
- ✅ Products load with labor costs
- ✅ Labor appears in results
- ✅ Margin calculations include labor
- ✅ No breaking changes to existing functionality

#### 3.2 Update Promo Analysis
**File:** `src/pages/cpg/SalesPromoDecisionTool.tsx`

**Changes:**
- Load labor costs for promo products
- Include labor in "WITH Promo" vs "WITHOUT Promo" calculations
- Show labor in impact summary
- Labor affects margin quality ratings

**Acceptance Criteria:**
- ✅ Labor loads for promo products
- ✅ Comparison cards show labor
- ✅ Margin calculations include labor
- ✅ Recommendation logic includes labor

#### 3.3 Update Events Analysis
**File:** `src/pages/cpg/tabs/EventDecisionToolTab.tsx`

**Changes:**
- Load labor costs for event products
- Include product labor in total event costs
- Show labor breakdown in event impact summary
- Labor affects break-even calculations

**Acceptance Criteria:**
- ✅ Labor loads for event products
- ✅ Total costs include labor
- ✅ Break-even accounts for labor
- ✅ Impact summary shows labor

#### 3.4 Update Distribution Reports
**Files:** Various distribution-related reports

**Changes:**
- Include labor in distribution cost reports where relevant
- Show labor + distribution as combined "Total Cost to Market"

**Acceptance Criteria:**
- ✅ Labor appears in distribution reports
- ✅ Totals are accurate
- ✅ No breaking changes

---

### Phase 4: Labor Reporting (Nice-to-Have)
**Goal:** Provide dedicated labor analysis and reporting.

**Confidence Level:** 75% ⚠️

#### 4.1 Create Labor Reports Page
**File:** `src/pages/cpg/reports/LaborReports.tsx`

**Report Sections:**

**A. Labor Cost by Product**
- Table showing all products with labor costs
- Columns: Product, Total Labor CPU, # of Roles, % of Total CPU
- Sortable columns
- Export to CSV

**B. Labor Cost by Role**
- Table showing all roles
- Columns: Role Name, Hourly Rate, # Products, Total Hours/Month, Total Cost/Month
- Identifies most utilized roles
- Sortable columns

**C. Labor vs. Ingredients Ratio**
- Chart or table showing labor as % of total CPU per product
- Identifies if labor or materials is bigger cost driver
- Helps optimize pricing strategy

**D. Labor Cost Trends** (Optional, if we track history)
- Show how labor costs change over time
- Useful if user updates rates frequently

**Acceptance Criteria:**
- ✅ All reports display accurate data
- ✅ Sorting works on all columns
- ✅ Export to CSV works
- ✅ Charts are readable and helpful
- ✅ Purple and gold styling throughout

#### 4.2 Add Labor Reports to Navigation
**File:** `src/pages/cpg/Reports.tsx` or navigation

Add "Labor Analysis" section to reports page.

**Acceptance Criteria:**
- ✅ Navigation works
- ✅ Reports load properly
- ✅ Matches overall reports design

---

## Testing Checklist (Per Phase)

### Phase 1 Testing
- [ ] Create hourly labor role - saves and displays correctly
- [ ] Create salary labor role (yearly) - converts to hourly correctly
- [ ] Create salary labor role (monthly) - converts to hourly correctly
- [ ] Create salary labor role (bi-weekly) - converts to hourly correctly
- [ ] Create salary labor role (weekly) - converts to hourly correctly
- [ ] Edit labor role - updates correctly
- [ ] Archive labor role - soft-deletes and hides from list
- [ ] Assign labor to product (per batch) - calculates hours/unit correctly
- [ ] Assign labor to product (per unit) - saves directly
- [ ] Quick-add new role from assignment modal - returns to assignment seamlessly
- [ ] Remove labor assignment - deletes and updates product total
- [ ] Multiple roles on one product - totals correctly
- [ ] Navigation to Labor + Roles page works
- [ ] Empty state shows correctly
- [ ] All buttons are purple or gold per brand guidelines
- [ ] Mobile responsive design works
- [ ] WCAG 2.1 AA compliance verified

### Phase 2 Testing
- [ ] CPU breakdown includes labor
- [ ] Labor breakdown expands to show roles
- [ ] Totals match manual calculation
- [ ] Products with no labor show $0 labor
- [ ] CPU Tracker displays labor correctly
- [ ] My Products page shows labor in CPU

### Phase 3 Testing (Per Tool)
- [ ] What-If Calculator includes labor
- [ ] Promo Analysis includes labor
- [ ] Events Analysis includes labor
- [ ] Distribution reports include labor (if applicable)
- [ ] No breaking changes to existing tool functionality
- [ ] Margin calculations are accurate

### Phase 4 Testing
- [ ] Labor by Product report is accurate
- [ ] Labor by Role report is accurate
- [ ] Labor vs. Ingredients ratio is accurate
- [ ] Export to CSV works
- [ ] Charts render correctly

---

## Dependencies & Prerequisites

### Required Before Starting
- [x] Database (Dexie) is set up and working
- [x] CPG module structure exists
- [x] Finished products table exists
- [x] CPU calculator service exists
- [x] Component library available (Button, Modal, etc.)
- [x] Styling guidelines documented

### External Libraries (if needed)
- `uuid` or `nanoid` - for generating IDs (already in use)
- No new dependencies expected

---

## Rollback Plan

### Phase 1 Rollback
If Phase 1 has critical bugs:
1. Revert database migration (remove tables)
2. Revert route addition
3. Revert navigation addition
4. Remove new files
5. Git revert commit

**Impact:** No impact on existing functionality since Phase 1 is isolated.

### Phase 2 Rollback
If CPU integration breaks:
1. Revert CPU calculator service changes
2. Revert display component changes
3. Labor data remains in database but isn't displayed
4. Git revert commit

**Impact:** Minimal - labor data is preserved, just not shown in CPU.

### Phase 3 Rollback
If a specific tool breaks:
1. Revert changes to that specific tool only
2. Other tools continue to work
3. Git revert specific commits

**Impact:** Isolated to one tool, others unaffected.

### Phase 4 Rollback
If reports have issues:
1. Revert reports page
2. Remove from navigation
3. Core labor functionality still works

**Impact:** None on core features.

---

## Success Metrics

### Phase 1 Success
- [ ] Users can create and manage labor roles
- [ ] Users can assign labor to products
- [ ] Labor costs calculate correctly
- [ ] Quick-add flow works smoothly
- [ ] Zero bugs in core functionality
- [ ] Design matches brand guidelines

### Phase 2 Success
- [ ] Labor appears in all CPU displays
- [ ] Calculations are accurate
- [ ] Performance is acceptable
- [ ] No regressions in existing features

### Phase 3 Success
- [ ] Each tool integrates labor successfully
- [ ] No breaking changes
- [ ] Users can analyze labor impact in scenarios

### Phase 4 Success
- [ ] Labor reports provide valuable insights
- [ ] Users can export data
- [ ] Reports help optimize costs

---

## Known Limitations & Future Enhancements

### Current Scope Limitations
- Users must manually buffer taxes/benefits into rates (not auto-calculated)
- No time-tracking or actual vs. planned hours
- No integration with payroll systems
- No labor scheduling or shift management
- No historical tracking of rate changes

### Future Enhancement Ideas
- Labor efficiency tracking (actual vs. planned hours)
- Integration with time-tracking tools
- Auto-calculation of employer taxes (by state)
- Labor scheduling and capacity planning
- Team member management (vs. generic roles)
- Labor variance reporting (planned vs. actual)

---

## Communication & Collaboration

### Progress Updates
- [ ] Phase 1 started - notify user
- [ ] Phase 1 complete - demo and get feedback
- [ ] Phase 2 started - notify user
- [ ] Phase 2 complete - demo and get feedback
- [ ] Phase 3 started (per tool) - notify user
- [ ] Phase 3 complete (per tool) - demo and get feedback
- [ ] Phase 4 started - notify user
- [ ] Phase 4 complete - demo and get feedback

### Review Points
After each phase:
1. Demo the new functionality
2. Get user feedback
3. Make adjustments if needed
4. Check off phase in this roadmap
5. Get approval to proceed to next phase

### Questions to Resolve During Implementation
- TBD: Where exactly should labor reports live in navigation?
- TBD: Should archived roles still appear in reports?
- TBD: How should we handle deleting a role that's assigned to products?
- TBD: Should we show warnings if labor cost seems unusually high/low?

---

## Current Status

**Phase:** Not Started
**Last Updated:** March 27, 2026
**Next Action:** Review roadmap with user, get approval to start Phase 1

---

## Completion Checklist

### Phase 1: Foundation ⬜
- [ ] Database schema created
- [ ] Tables added to Dexie
- [ ] Service layer implemented
- [ ] Labor + Roles page UI built
- [ ] Add/Edit modal created
- [ ] Product labor assignment UI added
- [ ] Assignment modal with quick-add built
- [ ] Navigation updated
- [ ] All Phase 1 tests passing
- [ ] User demo completed
- [ ] User approval received

### Phase 2: CPU Integration ⬜
- [ ] CPU calculator service updated
- [ ] CPU displays updated
- [ ] All Phase 2 tests passing
- [ ] User demo completed
- [ ] User approval received

### Phase 3: Analysis Tools ⬜
- [ ] What-If Calculator updated
- [ ] Promo Analysis updated
- [ ] Events Analysis updated
- [ ] Distribution reports updated
- [ ] All Phase 3 tests passing
- [ ] User demo completed
- [ ] User approval received

### Phase 4: Reporting ⬜
- [ ] Labor reports page created
- [ ] Navigation updated
- [ ] All Phase 4 tests passing
- [ ] User demo completed
- [ ] User approval received

---

## Notes & Decisions Log

_This section will be updated as we make decisions during implementation._

**Decision Log:**
- 2026-03-27: Chose phased approach to reduce risk
- 2026-03-27: Decided on "Labor + Roles" for navigation naming
- 2026-03-27: Agreed to support both per-batch and per-unit entry
- 2026-03-27: Chose to put labor assignment on My Products page (Option 1)
- 2026-03-27: Decided quick-add flow is better UX than forced setup

**Open Questions:**
- None yet

---

## Architecture Diagrams

### Data Flow: Labor Cost Calculation
```
1. User creates Labor Role
   → Stores in cpgLaborRoles table
   → If salary, auto-calculates hourly equivalent

2. User assigns Labor to Product
   → Stores in cpgProductLabor table
   → If per-batch, calculates hours/unit
   → Calculates labor cost/unit (hours × rate)

3. CPU Calculator Service
   → Loads product's cpgProductLabor records
   → Sums all labor costs
   → Returns labor CPU + breakdown

4. Display Components
   → Fetch CPU breakdown
   → Show labor as expandable line item
   → Include in margin calculations
```

### Component Hierarchy
```
LaborRoles (Page)
├── LaborRoleModal (Create/Edit)
└── LaborRoleTable
    └── LaborRoleRow (each role)

FinishedProducts (Page)
└── ProductDetails
    └── LaborCostsSection
        ├── LaborAssignmentModal
        │   └── LaborRoleModal (quick-add)
        └── AssignedLaborList
            └── AssignedLaborRow (each assignment)
```

---

**END OF ROADMAP**

_This is a living document. Update as we progress through implementation._
