# Impact Share Feature - Implementation Roadmap

## Overview

Impact Share is a feature that allows CPG entrepreneurs to model, plan, and implement social/environmental impact pricing into their product costs. This empowers mission-driven businesses to give back confidently by seeing exactly how impact pricing affects their margins and profitability.

**Route:** `/cpg/impact-share`

**Core Philosophy:**
- Give users tools and flexibility, not prescriptions
- Show the numbers, let them decide
- Eyes wide open decision-making
- Support values-aligned business growth

---

## Feature Goals

1. **Enable Impact Modeling:** Allow users to create scenarios testing different impact pricing methods
2. **Provide Clarity:** Show exactly how impact pricing affects margins and profitability
3. **Support Flexibility:** Let users choose which products get impact pricing
4. **Facilitate Comparison:** Enable side-by-side scenario analysis
5. **Integrate Seamlessly:** Include Impact Share in all cost calculation tools when activated
6. **Plan for Growth:** Build foundation for future impact reporting and tracking

---

## User Journey

### Discovery & Creation
1. User navigates to Impact Share page
2. Creates new scenario in Scenario Builder (Tab 1)
3. Chooses impact method (4 options available)
4. Selects which products to apply impact pricing to
5. Reviews immediate calculations showing margin impact
6. Saves scenario or activates immediately

### Comparison & Planning
1. User compares multiple saved/active scenarios (Tab 2)
2. Reviews side-by-side impact on margins for each product
3. Makes informed decision about which approach fits their mission

### Management & Activation
1. User views all scenarios in data table (Tab 3)
2. Can activate/deactivate scenarios with toggle
3. Can edit saved scenarios (opens Tab 1 with pre-filled data)
4. Can permanently delete scenarios
5. Can filter to view inactive scenarios

### Integration
1. When scenario is activated, Impact Share appears as optional toggle in all cost calculation tools
2. User can choose to include/exclude Impact Share in specific analyses
3. Impact Share shows as separate line item (like Promo/Distribution)
4. Affects margin calculations but does NOT change Base CPU

---

## Implementation Phases

### Phase 1: Database & Schema

#### 1.1 Create Database Table
**File:** `src/db/schema/cpg.schema.ts`

Add new interface and table:
```typescript
export interface CPGImpactScenario {
  id: string;
  company_id: string;
  scenario_name: string;
  method_type: 'fixed_amount' | 'percent_retail' | 'percent_cpu' | 'percent_profit';
  amount: string; // Dollar amount (used if method_type = 'fixed_amount')
  percentage: string; // Percentage value (used for percent-based methods)
  selected_product_ids: string[]; // Array of CPGFinishedProduct IDs
  status: 'active' | 'saved' | 'inactive';
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  device_id: string;
  active: boolean;
  version_vector: Record<string, number>;
}
```

#### 1.2 Add Table to Database
**File:** `src/db/index.ts`

Add table definition:
```typescript
cpgImpactScenarios: '++id, company_id, [company_id+active], status, created_at'
```

#### 1.3 Add Validation Function
**File:** `src/db/schema/cpg.schema.ts`

```typescript
export function validateCPGImpactScenario(scenario: Partial<CPGImpactScenario>): string[] {
  const errors: string[] = [];

  if (!scenario.scenario_name || scenario.scenario_name.trim() === '') {
    errors.push('Scenario name is required');
  }

  if (!scenario.method_type) {
    errors.push('Method type is required');
  }

  if (scenario.method_type === 'fixed_amount' && !scenario.amount) {
    errors.push('Amount is required for fixed amount method');
  }

  if (scenario.method_type !== 'fixed_amount' && !scenario.percentage) {
    errors.push('Percentage is required for percentage-based methods');
  }

  if (!scenario.selected_product_ids || scenario.selected_product_ids.length === 0) {
    errors.push('At least one product must be selected');
  }

  return errors;
}
```

#### 1.4 Add Default Creator
**File:** `src/db/schema/cpg.schema.ts`

```typescript
export function createDefaultCPGImpactScenario(
  companyId: string,
  scenarioName: string,
  deviceId: string
): Omit<CPGImpactScenario, 'id'> {
  return {
    company_id: companyId,
    scenario_name: scenarioName,
    method_type: 'fixed_amount',
    amount: '0',
    percentage: '0',
    selected_product_ids: [],
    status: 'saved',
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
    device_id: deviceId,
    active: true,
    version_vector: {},
  };
}
```

---

### Phase 2: Impact Share Service

#### 2.1 Create Service File
**File:** `src/services/cpg/impactShare.service.ts`

Service handles:
- Creating scenarios
- Updating scenarios
- Activating/deactivating scenarios
- Calculating impact per product based on method
- Comparing multiple scenarios
- Soft delete (inactive) vs hard delete

#### 2.2 Core Methods

```typescript
export class ImpactShareService {
  constructor(private db: TreasureChestDB) {}

  // Create new scenario
  async createScenario(params: CreateScenarioParams, deviceId: string): Promise<CPGImpactScenario>

  // Update existing scenario
  async updateScenario(scenarioId: string, updates: Partial<CPGImpactScenario>, deviceId: string): Promise<void>

  // Activate scenario (sets status to 'active')
  async activateScenario(scenarioId: string, deviceId: string): Promise<void>

  // Deactivate scenario (sets status to 'inactive')
  async deactivateScenario(scenarioId: string, deviceId: string): Promise<void>

  // Mark scenario as saved (from active)
  async saveScenario(scenarioId: string, deviceId: string): Promise<void>

  // Hard delete (permanent)
  async deleteScenario(scenarioId: string): Promise<void>

  // Calculate impact amount for a specific product
  async calculateImpactForProduct(
    scenarioId: string,
    productId: string
  ): Promise<{
    impactAmount: string;
    method: string;
    baseValue: string; // What the percentage was based on
  }>

  // Get active scenario for company
  async getActiveScenario(companyId: string): Promise<CPGImpactScenario | null>

  // Get all scenarios for company (excluding deleted)
  async getAllScenarios(companyId: string, includeInactive: boolean): Promise<CPGImpactScenario[]>

  // Compare multiple scenarios
  async compareScenarios(
    scenarioIds: string[],
    productIds: string[]
  ): Promise<ComparisonResult>
}
```

#### 2.3 Calculation Logic

For each method type, calculate impact per product:

**Fixed Amount:**
```typescript
impactAmount = scenario.amount
```

**Percent of Retail:**
```typescript
impactAmount = product.msrp * (scenario.percentage / 100)
```

**Percent of Base CPU:**
```typescript
baseCPU = await cpuCalculatorService.getFinishedProductCPUBreakdown(productId)
impactAmount = baseCPU.cpu * (scenario.percentage / 100)
```

**Percent of Gross Profit:**
```typescript
baseCPU = await cpuCalculatorService.getFinishedProductCPUBreakdown(productId)
grossProfit = product.msrp - baseCPU.cpu
impactAmount = grossProfit * (scenario.percentage / 100)
```

---

### Phase 3: Impact Share Page UI

#### 3.1 Create Main Page Component
**File:** `src/pages/cpg/ImpactShare.tsx`

Structure:
```tsx
export default function ImpactShare() {
  const [activeTab, setActiveTab] = useState<'builder' | 'compare' | 'manage'>('builder');

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Impact Share</h1>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button>Scenario Builder</button>
        <button>Compare Scenarios</button>
        <button>Manage Scenarios</button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'builder' && <ScenarioBuilderTab />}
        {activeTab === 'compare' && <CompareScenariosTab />}
        {activeTab === 'manage' && <ManageScenariosTab />}
      </div>
    </div>
  );
}
```

**File:** `src/pages/cpg/ImpactShare.module.css`

Apply Audacious design system:
- Purple (#4b006e) headers
- Gold (#D4AF37) accents
- Green (#E5F6DF) backgrounds for inputs
- Consistent with existing CPG pages

---

#### 3.2 Tab 1: Scenario Builder
**File:** `src/pages/cpg/tabs/impactShare/ScenarioBuilderTab.tsx`

**Features:**
- Scenario name input (required)
- Method selector (radio buttons for 4 options)
- Amount/percentage input (conditional based on method)
- Product multi-selector (checkboxes, searchable)
- Real-time calculation preview for each selected product
- Shows: Retail - (Base CPU + Impact Share) = Margin (%)
- Action buttons: Save Scenario, Activate, Compare (Compare only appears after Save/Activate)

**Calculation Display:**
```tsx
<div className={styles.calculationPreview}>
  <h3>Impact Preview</h3>
  {selectedProducts.map(product => (
    <div key={product.id} className={styles.productCalc}>
      <h4>{product.name}</h4>
      <div className={styles.calcRow}>
        <span>Retail: ${product.msrp}</span>
        <span>- (Base CPU: ${baseCPU} + Impact Share: ${impactAmount})</span>
        <span>= Margin: ${margin} ({marginPercent}%)</span>
      </div>
    </div>
  ))}
</div>
```

**Editing Mode:**
When user clicks "Edit" from Manage Scenarios tab, this component receives scenario ID via URL parameter, loads data, and pre-populates form.

---

#### 3.3 Tab 2: Compare Scenarios
**File:** `src/pages/cpg/tabs/impactShare/CompareScenariosTab.tsx`

**Features:**
- Up to 3 scenario selectors (dropdowns)
- Options include both Active and Saved scenarios
- Side-by-side comparison table
- Shows for each product:
  - Method used
  - Base CPU
  - Impact Share amount
  - Total CPU (Base + Impact)
  - Margin amount and percentage

**Layout:**
```tsx
<div className={styles.comparisonContainer}>
  <div className={styles.scenarioSelectors}>
    <select>Scenario A</select>
    <select>Scenario B</select>
    <select>Scenario C</select>
  </div>

  <div className={styles.comparisonTable}>
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Scenario A</th>
          <th>Scenario B</th>
          <th>Scenario C</th>
        </tr>
      </thead>
      <tbody>
        {/* Product comparison rows */}
      </tbody>
    </table>
  </div>
</div>
```

**Empty State:**
If user hasn't saved/activated any scenarios, show message: "No scenarios to compare. Create and save scenarios in the Scenario Builder tab."

---

#### 3.4 Tab 3: Manage Scenarios
**File:** `src/pages/cpg/tabs/impactShare/ManageScenariosTab.tsx`

**Features:**
- Data table showing all Active and Saved scenarios
- Filter button to show/hide Inactive scenarios
- Columns: Name | Method | Products | Added CPU | Status | Actions
- Actions menu (⋮): Edit, Activate/Deactivate, Delete
- Active status shows with green badge
- Saved status shows with blue badge
- Inactive status shows with gray badge (only when filter enabled)

**Table Structure:**
```tsx
<div className={styles.tableContainer}>
  <div className={styles.tableHeader}>
    <h2>Saved & Active Scenarios</h2>
    <button onClick={toggleInactive}>
      {showInactive ? 'Hide' : 'Show'} Inactive Scenarios
    </button>
  </div>

  <table className={styles.scenariosTable}>
    <thead>
      <tr>
        <th>Name</th>
        <th>Method</th>
        <th>Products</th>
        <th>Added CPU</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {scenarios.map(scenario => (
        <tr key={scenario.id}>
          <td>{scenario.scenario_name}</td>
          <td>{formatMethod(scenario)}</td>
          <td>{scenario.selected_product_ids.length} products</td>
          <td>{calculateAverageCPU(scenario)}</td>
          <td><StatusBadge status={scenario.status} /></td>
          <td><ActionsMenu scenario={scenario} /></td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

**Actions Menu:**
- Edit: Navigate to Scenario Builder with `?edit={scenarioId}`
- Activate: Set status to 'active'
- Deactivate: Set status to 'inactive'
- Delete: Confirm dialog → permanent delete

**Added CPU Column:**
Shows average or range of impact amounts across selected products. Example: "$0.50/unit" or "$0.30-$1.20/unit"

---

### Phase 4: Integration Points

All integration points follow the same pattern:
1. Check if user has any active Impact Share scenarios
2. If yes, show checkbox/toggle to include Impact Share
3. When toggled on, add Impact Share as separate line item in calculations
4. Impact Share affects margin but NOT Base CPU

---

#### 4.1 Strategy Planning - What-If Calculator
**File:** `src/pages/cpg/tabs/scenario/WhatIfCalculatorTab.tsx`

**Location:** Top filter row (Option A)
```tsx
<div className={styles.filterRow}>
  <select>Distributor</select>
  <select>Retail Strategy</select>
  <label>
    <input type="checkbox" />
    Include Impact Share
  </label>
</div>
```

**Calculation Display:**
```tsx
Base CPU: $4.50
+ Impact Share: $0.50
+ Distribution: $1.20
─────────────────
Total CPU: $6.20
```

**Logic:**
- Only show checkbox if active scenario exists
- When checked, fetch impact amount for product from ImpactShareService
- Add to total CPU calculation
- Show as separate line in breakdown

---

#### 4.2 Strategy Planning - Cost a New Idea
**File:** `src/pages/cpg/tabs/scenario/WhatIfCalculatorTab.tsx` (same component)

**Location:** Same filter row approach
**Why Include:** Users modeling new products need all costs for viability analysis

**Logic:**
- Show checkbox if active scenario exists
- When checked, user can select which saved scenario's methodology to apply
- Or use the currently active scenario by default
- Calculate hypothetical impact based on entered retail price/CPU

---

#### 4.3 CPU Tracker - Product Costs Tab
**File:** `src/pages/cpg/tabs/CostIntelligenceTab.tsx`

**Location:** Left-aligned, same line as Grid/Table toggle
```tsx
<div className={styles.viewControls}>
  <label className={styles.impactToggle}>
    <input type="checkbox" />
    Include Impact Share
  </label>
  <div className={styles.viewButtons}>
    <button>Grid View</button>
    <button>Table View</button>
  </div>
</div>
```

**Display:**
When toggled on, show Impact Share in product cost cards/rows:
```tsx
Base CPU: $4.50
+ Impact Share: $0.50
─────────────────
Total with Impact: $5.00
```

---

#### 4.4 CPU Tracker - Scenario Builder
**File:** `src/pages/cpg/tabs/CostIntelligenceTab.tsx`

**Location:** With product selector (Option A)
```tsx
<div className={styles.scenarioControls}>
  <select>Product</select>
  <label>
    <input type="checkbox" />
    Include Impact Share
  </label>
</div>
```

**Display:**
Add Impact Share to cost breakdown when toggled on

---

#### 4.5 CPU Tracker - CPU Trends
**File:** `src/pages/cpg/tabs/CostIntelligenceTab.tsx`

**Location:** Filter row with date range (Option A)
```tsx
<div className={styles.trendsFilters}>
  <select>Date Range</select>
  <label>
    <input type="checkbox" />
    Include Impact Share
  </label>
</div>
```

**Display:**
When toggled:
- Add Impact Share line to chart
- Show in legend
- Include in total CPU trend line

**Note:** May need visual adjustment depending on how trends render

---

#### 4.6 Events Decision Tool
**File:** `src/pages/cpg/tabs/EventDecisionToolTab.tsx`

**Location:** Add checkbox in analysis section
**Why Include:** Events affect margins, so Impact Share should be factored in

**Calculation:**
```tsx
Base CPU: $4.50
+ Impact Share: $0.50
+ Event Cost: $2.00
─────────────────
Total CPU: $7.00
```

Affects margin calculations and break-even analysis

---

#### 4.7 Promo Decision Tool
**File:** `src/pages/cpg/SalesPromoDecisionTool.tsx`

**Location:** Add checkbox in calculator section
**Why Include:** Promos reduce revenue, so seeing impact with Impact Share is critical

**Calculation:**
```tsx
Base CPU: $4.50
+ Impact Share: $0.50
+ Promo Cost: $1.50
─────────────────
Total CPU: $6.50
```

Affects margin quality and recommendation

---

#### 4.8 Distribution Cost Analyzer
**File:** `src/pages/cpg/DistributionCostAnalyzer.tsx`

**Location:** Add checkbox in cost breakdown section

**Calculation:**
```tsx
Base CPU: $4.50
+ Impact Share: $0.50
+ Distribution: $1.20
─────────────────
Total CPU: $6.20
```

---

### Phase 5: Helper Functions & Utilities

#### 5.1 Format Method Display
**File:** `src/utils/cpg/impactShare.utils.ts`

```typescript
export function formatImpactMethod(scenario: CPGImpactScenario): string {
  switch (scenario.method_type) {
    case 'fixed_amount':
      return `$${scenario.amount}/unit`;
    case 'percent_retail':
      return `${scenario.percentage}% of retail`;
    case 'percent_cpu':
      return `${scenario.percentage}% of base CPU`;
    case 'percent_profit':
      return `${scenario.percentage}% of gross profit`;
    default:
      return 'Unknown method';
  }
}
```

#### 5.2 Calculate Average Impact CPU
**File:** `src/utils/cpg/impactShare.utils.ts`

```typescript
export async function calculateAverageImpactCPU(
  scenario: CPGImpactScenario,
  service: ImpactShareService
): Promise<string> {
  const impacts = await Promise.all(
    scenario.selected_product_ids.map(productId =>
      service.calculateImpactForProduct(scenario.id, productId)
    )
  );

  const amounts = impacts.map(i => parseFloat(i.impactAmount));
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);

  if (min === max) {
    return `$${min.toFixed(2)}/unit`;
  }

  return `$${min.toFixed(2)}-$${max.toFixed(2)}/unit`;
}
```

---

### Phase 6: Navigation & Routes

#### 6.1 Add Route
**File:** `src/App.tsx` or routing configuration

Add route:
```tsx
<Route path="/cpg/impact-share" element={<ImpactShare />} />
```

#### 6.2 Add to CPG Sidebar
**File:** `src/components/cpg/CPGSidebar.tsx` (or wherever sidebar is defined)

Add menu item:
```tsx
<NavLink to="/cpg/impact-share">
  💚 Impact Share
</NavLink>
```

Position: After Distribution, before Events (or wherever makes sense in menu hierarchy)

---

### Phase 7: Testing & Validation

#### 7.1 Unit Tests
- Test each calculation method
- Test scenario CRUD operations
- Test status transitions (active/saved/inactive)
- Test validation rules

#### 7.2 Integration Tests
- Test Impact Share appearing in all integration points
- Test toggling on/off
- Test calculations with Impact Share included
- Test margin quality adjustments

#### 7.3 User Flow Tests
1. Create scenario → Save → Compare → Activate
2. Edit existing scenario → Update calculations
3. Deactivate scenario → Verify it disappears from integration points
4. Delete scenario → Confirm permanent removal
5. Multiple products with different Impact Share amounts

---

## Technical Considerations

### Database Indexing
```typescript
// Queries we'll run frequently:
- Get all scenarios for company
- Get active scenario for company
- Get scenarios by status

// Indexes needed:
cpgImpactScenarios: '++id, company_id, [company_id+active], [company_id+status], status, created_at'
```

### Performance Optimization
- Cache active scenario per company in React Context
- Debounce calculation previews in Scenario Builder
- Lazy load scenario comparisons (only calculate when Compare tab opened)
- Memoize impact calculations for products

### Error Handling
- Handle missing products (deleted after scenario created)
- Handle missing MSRP (required for retail percentage method)
- Handle zero or negative values
- Graceful degradation if Impact Share service fails

---

## UI/UX Details

### Design System Compliance
All Impact Share components use Audacious design system:
- **Purple (#4b006e):** Headers, primary actions
- **Gold (#D4AF37):** Borders, accents, active states
- **Green (#E5F6DF):** Input backgrounds
- **Status badges:**
  - Active: Green background (#dcfce7), dark green text (#166534)
  - Saved: Blue background (#dbeafe), dark blue text (#1e40af)
  - Inactive: Gray background (#f3f4f6), dark gray text (#4b5563)

### Responsive Behavior
- Scenario Builder: Stack form fields on mobile
- Compare Scenarios: Horizontal scroll for 3-column comparison on mobile
- Manage Scenarios: Stack table rows as cards on mobile

### Loading States
- Show spinner when loading scenarios
- Show skeleton loaders for calculation previews
- Show "Calculating..." during comparison generation

### Empty States
- Scenario Builder: First-time user guidance
- Compare Scenarios: "No scenarios to compare" message
- Manage Scenarios: "No scenarios yet. Create one in Scenario Builder."

### Confirmation Dialogs
- Delete scenario: "Are you sure? This action cannot be undone."
- Deactivate active scenario: "This will remove Impact Share from all calculations. Continue?"
- Activate when another is active: "Only one scenario can be active. This will deactivate [Name]."

---

## Calculation Examples

### Example 1: Fixed Amount
```
Scenario: "Artisan Line Mission"
Method: Fixed Amount - $0.50 per unit
Products: Lavender Soap Bar

Product Details:
- Retail: $10.00
- Base CPU: $4.50

Calculation:
Retail: $10.00
- (Base CPU: $4.50 + Impact Share: $0.50)
= Margin: $5.00 (50%)
```

### Example 2: Percent of Retail
```
Scenario: "Holiday Give-Back"
Method: 5% of Retail Price
Products: Rose Face Cream

Product Details:
- Retail: $20.00
- Base CPU: $12.00

Calculation:
Impact Share = $20.00 × 0.05 = $1.00

Retail: $20.00
- (Base CPU: $12.00 + Impact Share: $1.00)
= Margin: $7.00 (35%)
```

### Example 3: Percent of Base CPU
```
Scenario: "Cost-Plus Impact"
Method: 10% of Base CPU
Products: Body Lotion

Product Details:
- Retail: $15.00
- Base CPU: $6.00

Calculation:
Impact Share = $6.00 × 0.10 = $0.60

Retail: $15.00
- (Base CPU: $6.00 + Impact Share: $0.60)
= Margin: $8.40 (56%)
```

### Example 4: Percent of Gross Profit
```
Scenario: "Profit Sharing"
Method: 10% of Gross Profit
Products: Hand Cream

Product Details:
- Retail: $12.00
- Base CPU: $5.00

Calculation:
Gross Profit = $12.00 - $5.00 = $7.00
Impact Share = $7.00 × 0.10 = $0.70

Retail: $12.00
- (Base CPU: $5.00 + Impact Share: $0.70)
= Margin: $6.30 (52.5%)
```

---

## Future Expansion Considerations

### Phase 2 Features (Not in Initial Build)
1. **Impact Reporting:**
   - Track total impact dollars contributed over time
   - Show impact metrics dashboard
   - Export impact reports for B-Corp or charity partners

2. **Recipient Tracking:**
   - Link Impact Share to specific organizations
   - Track where dollars are going
   - Generate donation receipts

3. **Automated Adjustments:**
   - Scheduled scenario changes (phased rollout)
   - Seasonal impact pricing
   - Goal-based adjustments

4. **Customer-Facing:**
   - Show Impact Share on receipts
   - Marketing materials generation
   - "Your purchase contributed $X" messaging

5. **Advanced Analytics:**
   - Impact Share trends over time
   - Correlation with sales volume
   - Customer response analysis

### Database Extensibility
Current schema supports future expansion:
- Add `recipient_organization` field
- Add `goal_amount` and `goal_deadline` fields
- Add `customer_visible` boolean
- Add `auto_adjust_schedule` object

---

## Key Implementation Notes

### Critical Rules
1. **Impact Share NEVER changes Base CPU** - always a separate line item
2. **Only one scenario can be active for a single product at a time** - activating new one deactivates current
3. **Inactive scenarios remain in database** - can be reactivated
4. **Deleted scenarios are permanently removed** - no soft delete
5. **Integration toggles only appear if active scenario exists** - no clutter for non-users

### Naming Consistency
Use "Impact Share" everywhere:
- In UI labels
- In code comments
- In database fields (use snake_case: `impact_share_amount`)
- In user-facing documentation

### Accessibility
- All toggles must be keyboard accessible
- Screen reader labels for all interactive elements
- ARIA labels for status badges
- Focus management in modals and dialogs

---

## Success Criteria

Impact Share feature is considered complete when:
1. ✅ Users can create scenarios with all 4 method types
2. ✅ Users can save, activate, deactivate, and delete scenarios
3. ✅ Users can compare up to 3 scenarios side-by-side
4. ✅ Users can manage scenarios in data table with all actions working
5. ✅ Impact Share appears as toggle in all 8 integration points
6. ✅ Calculations are accurate for all method types
7. ✅ Impact Share shows as separate line item (not part of Base CPU)
8. ✅ Margin calculations correctly include Impact Share
9. ✅ UI matches Audacious design system
10. ✅ All empty states, loading states, and error states are handled
11. ✅ Mobile responsive design works correctly
12. ✅ No console errors or warnings
13. ✅ Database operations are efficient (proper indexing)
14. ✅ User can navigate entire flow without confusion

---

## Files to Create/Modify

### New Files
- `src/db/schema/cpg.schema.ts` (additions)
- `src/services/cpg/impactShare.service.ts`
- `src/pages/cpg/ImpactShare.tsx`
- `src/pages/cpg/ImpactShare.module.css`
- `src/pages/cpg/tabs/impactShare/ScenarioBuilderTab.tsx`
- `src/pages/cpg/tabs/impactShare/ScenarioBuilderTab.module.css`
- `src/pages/cpg/tabs/impactShare/CompareScenariosTab.tsx`
- `src/pages/cpg/tabs/impactShare/CompareScenariosTab.module.css`
- `src/pages/cpg/tabs/impactShare/ManageScenariosTab.tsx`
- `src/pages/cpg/tabs/impactShare/ManageScenariosTab.module.css`
- `src/utils/cpg/impactShare.utils.ts`

### Modified Files
- `src/db/index.ts` (add table)
- `src/App.tsx` (add route)
- `src/components/cpg/CPGSidebar.tsx` (add menu item)
- `src/pages/cpg/tabs/scenario/WhatIfCalculatorTab.tsx` (add toggle)
- `src/pages/cpg/tabs/CostIntelligenceTab.tsx` (add toggles in 3 places)
- `src/pages/cpg/tabs/EventDecisionToolTab.tsx` (add toggle)
- `src/pages/cpg/SalesPromoDecisionTool.tsx` (add toggle)
- `src/pages/cpg/DistributionCostAnalyzer.tsx` (add toggle)

---

## Questions for Future Consideration

1. Should Impact Share scenarios have expiration dates?
2. Should users be able to schedule scenario activation (e.g., "activate on Jan 1")?
3. Should there be scenario templates (e.g., "1% for the Planet", "B-Corp Standard")?
4. Should comparison view support more than 3 scenarios?
5. Should there be a "suggested" Impact Share amount based on industry benchmarks?
6. Should users be able to share scenarios with other users (collaboration)?

---

## End of Roadmap

This roadmap provides comprehensive guidance for implementing the Impact Share feature. All technical details, user experience flows, and integration points are defined. Implementation can proceed without timelines, focusing on quality and completeness at each phase.

**Feature Owner:** CPG Module
**Priority:** High (mission-driven entrepreneurs need this)
**Dependencies:** CPG CPU Calculator, Strategy Planning, CPG Dashboard
**Status:** Ready for Implementation 🚀
