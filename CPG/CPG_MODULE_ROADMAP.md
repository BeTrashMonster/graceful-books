# CPG Module Roadmap

**Target Demo Date:** Thursday, January 30, 2026

## Executive Summary

The CPG (Consumer Packaged Goods) Module is a specialized cost analysis and distribution planning tool for CPG businesses. It enables users to:

1. **Track True Cost Per Unit (CPU)** with flexible cost attribution across user-defined categories and product variants
2. **Analyze Distribution Costs** with multi-layered fee structures across different distributors
3. **Evaluate Trade Spend** (sales promos) to make data-driven participation decisions
4. **Model Profitability** across distribution channels with color-coded margin indicators

**Deployment Model:**
- **Integrated:** Full integration with Audacious Money accounting software ($40/month flat - all features included)
- **Standalone:** Manual financial data entry + CPG analysis ($5/SKU, capped at $50/month)

---

## Phase 1: Foundation (THURSDAY DEMO - MUST HAVE)

### Group A: Data Layer ✅ COMPLETED
**Status:** Schema and database integration complete

**Deliverables:**
- ✅ CPG Category schema (user-defined categories like Oil, Bottle, Box)
- ✅ CPG Invoice schema (flexible cost attribution with reconciliation)
- ✅ CPG Distributor schema (profiles with multi-layered fee structures)
- ✅ CPG Distribution Calculation schema (saved scenarios)
- ✅ CPG Sales Promo schema (trade spend analysis)
- ✅ Database version 19 migration

**Technical Notes:**
- CRDT-compatible for multi-device sync
- Soft delete with tombstone markers
- Version vectors for conflict resolution
- Decimal.js for financial precision

---

### Group B: Calculator Services 🚧 IN PROGRESS
**Priority:** CRITICAL for Thursday demo

#### B1: CPU Calculator Service
**File:** `src/services/cpg/cpuCalculator.service.ts`

**Requirements:**
```typescript
interface CPUCalculatorService {
  // Invoice Management
  createInvoice(params: CreateInvoiceParams): Promise<CPGInvoice>
  updateInvoice(id: string, updates: Partial<CPGInvoice>): Promise<CPGInvoice>
  deleteInvoice(id: string): Promise<void>

  // CPU Calculation
  calculateCPU(invoiceId: string): Promise<CPUCalculationResult>
  recalculateAllCPUs(companyId: string): Promise<CPUHistorySnapshot>

  // Historical Tracking
  getCPUHistory(companyId: string, categoryId?: string): Promise<CPUHistory[]>
  getCPUTrend(companyId: string, startDate: number, endDate: number): Promise<CPUTrend>
}

interface CPUCalculationResult {
  invoiceId: string
  categories: {
    categoryId: string
    categoryName: string
    variant: 'small' | 'large' | 'none'
    unitsPurchased: string
    unitsReceived: string
    unitPrice: string
    costAttributed: string // Portion of additional costs attributed
    trueUnitCost: string // Final CPU
  }[]
  totalPaid: string
  additionalCosts: Record<string, string>
  allocationMethod: '50/50' | 'proportional' | 'manual'
}
```

**Business Logic:**
1. **Line-by-Line Invoice Entry:** Each invoice line item can be attributed to CPG categories
2. **Flexible Product Variants:** Users define their own variants (e.g., "8oz", "16oz", "32oz" OR "Small", "Large" OR no variants)
3. **Cost Attribution:** User allocates costs at invoice entry - where they dictate splits
4. **Reconciliation:** Handle discrepancies between units purchased vs. received
5. **Additional Costs:** Shipping, printing, embossing, foil - user allocates during entry
6. **Integration with Bookkeeping:** Invoice entry serves BOTH accounting and CPG tracking (enter once, use everywhere)
7. **Historical Tracking:** Every invoice updates CPU, but maintains history

**Key Principle:** Clean, seamless entry - not clunky or overwhelming. User attributes costs when entering invoice, no complex post-entry allocation.

**Formula:**
```
True Unit Cost = (Cost for Category + User-Allocated Additional Costs) / Units Received
```

---

#### B2: Distribution Cost Calculator Service
**File:** `src/services/cpg/distributionCostCalculator.service.ts`

**Requirements:**
```typescript
interface DistributionCostCalculatorService {
  // Distributor Management
  createDistributor(params: CreateDistributorParams): Promise<CPGDistributor>
  updateDistributor(id: string, updates: Partial<CPGDistributor>): Promise<CPGDistributor>

  // Distribution Calculations
  calculateDistributionCost(params: DistributionCalcParams): Promise<DistributionCostResult>
  saveCalculation(result: DistributionCostResult, name?: string): Promise<CPGDistributionCalculation>

  // Scenario Comparison
  compareDistributors(params: CompareDistributorsParams): Promise<DistributorComparison>
}

interface DistributionCalcParams {
  distributorId: string
  numPallets: string
  unitsPerPallet: string
  pricePerUnitSmall: string
  pricePerUnitLarge?: string
  baseCPUSmall: string
  baseCPULarge?: string
  appliedFees: {
    palletCost: boolean
    warehouseServices: boolean
    palletBuild: boolean
    floorSpace: 'none' | 'full_day' | 'half_day'
    floorSpaceDays?: string
    truckTransferZone: 'none' | 'zone1' | 'zone2'
    customFees?: string[]
  }
  msrpMarkupPercentage?: string
}

interface DistributionCostResult {
  totalDistributionCost: string
  distributionCostPerUnit: string
  totalCPUSmall: string // Base CPU + Distribution cost per unit
  totalCPULarge?: string
  netProfitMarginSmall: string // (Price - Total CPU) / Price * 100
  netProfitMarginLarge?: string
  msrpSmall?: string
  msrpLarge?: string
  marginQuality: 'poor' | 'good' | 'better' | 'best' // Color coding
  feeBreakdown: {
    feeName: string
    feeAmount: string
  }[]
}
```

**Business Logic:**
1. **Multi-Layered Fees:** Pallet cost, warehouse services, pallet build, floor space, truck transfer, custom fees
2. **Pallet Calculations:** Total cost = (fee × num pallets) + zone fees
3. **Per-Unit Distribution Cost:** Total distribution cost / (pallets × units per pallet)
4. **Total CPU:** Base CPU (from invoices) + Distribution cost per unit
5. **Profit Margin:** (Price - Total CPU) / Price × 100
6. **Color Coding:**
   - Poor (Red): < 50%
   - Good (Yellow): 50-60%
   - Better (Light Green): 60-70%
   - Best (Dark Green): 70%+
7. **MSRP Markup:** Retail price = Wholesale price × (1 + markup %)

**Formula:**
```
Distribution Cost Per Unit = Total Distribution Fees / (Num Pallets × Units Per Pallet)
Total CPU = Base CPU + Distribution Cost Per Unit
Net Profit Margin = ((Price - Total CPU) / Price) × 100
```

---

#### B3: Sales Promo Analyzer Service
**File:** `src/services/cpg/salesPromoAnalyzer.service.ts`

**Requirements:**
```typescript
interface SalesPromoAnalyzerService {
  // Promo Management
  createPromo(params: CreatePromoParams): Promise<CPGSalesPromo>
  updatePromo(id: string, updates: Partial<CPGSalesPromo>): Promise<CPGSalesPromo>

  // Promo Analysis
  analyzePromo(params: PromoAnalysisParams): Promise<PromoAnalysisResult>
  comparePromoVsNoPromo(promoId: string): Promise<PromoComparison>

  // Recommendations
  getRecommendation(promoId: string): Promise<'participate' | 'decline' | 'neutral'>
}

interface PromoAnalysisParams {
  retailerName: string
  storeSalePercentage: string // e.g., "20" for 20% off
  producerPaybackPercentage: string // e.g., "10" for 10% cost-share
  retailPriceSmall: string
  retailPriceLarge?: string
  unitsAvailableSmall: string
  unitsAvailableLarge?: string
  baseCPUSmall: string
  baseCPULarge?: string
}

interface PromoAnalysisResult {
  salesPromoCostPerUnitSmall: string // Retail price × producer payback %
  salesPromoCostPerUnitLarge?: string
  cpuWithPromoSmall: string // Base CPU + Sales promo cost
  cpuWithPromoLarge?: string
  netProfitMarginWithPromoSmall: string
  netProfitMarginWithPromoLarge?: string
  netProfitMarginWithoutPromoSmall: string
  netProfitMarginWithoutPromoLarge?: string
  totalPromoCost: string // Total producer contribution
  marginDifference: string // Impact on margin
  recommendation: 'participate' | 'decline' | 'neutral'
  recommendationReason: string
}
```

**Business Logic:**
1. **Sales Promo Cost Per Unit:** Retail Price × Producer Payback %
2. **CPU with Promo:** Base CPU + Sales Promo Cost Per Unit
3. **Margin Comparison:** With promo vs. without promo
4. **Total Promo Cost:** (Sales Promo Cost Per Unit × Units Available)
5. **Recommendation Logic:**
   - **Participate:** Margin with promo >= 50% (still profitable)
   - **Decline:** Margin with promo < 40% (too costly)
   - **Neutral:** Margin 40-50% (borderline - user decides)

**Formula:**
```
Sales Promo Cost Per Unit = Retail Price × (Producer Payback % / 100)
CPU w/ Promo = Base CPU + Sales Promo Cost Per Unit
Profit Margin w/ Promo = ((Retail Price - CPU w/ Promo) / Retail Price) × 100
Total Promo Cost = Sales Promo Cost Per Unit × Units Available
```

---

### Group C: Core UI Components
**Priority:** CRITICAL for Thursday demo

#### C1: CPU Tracker Page
**File:** `src/pages/cpg/CPUTracker.tsx`

**Requirements:**
- **Invoice Entry Form:**
  - Date picker for invoice date
  - Vendor name input
  - Category selection (multi-select with variants)
  - For each category:
    - Units purchased
    - Unit price
    - Units received (for reconciliation)
  - Additional costs entry (shipping, printing, embossing, foil)
  - Notes field

- **CPU Display:**
  - Current CPU for Small variant
  - Current CPU for Large variant
  - Last updated date

- **Historical Timeline:**
  - Visual timeline showing CPU changes over time
  - Click to expand invoice details
  - Color-coded by category

- **Category Management:**
  - Add/edit custom categories
  - Toggle Small/Large variants
  - Set default categories (Oil, Bottle, Box, Impact)

**User Flow:**
1. User enters invoice details
2. Allocates costs to categories
3. Enters additional costs (split automatically or manually)
4. Saves invoice
5. CPU auto-updates and shows in timeline
6. User can view historical CPU trends

---

#### C2: Distribution Cost Analyzer Page
**File:** `src/pages/cpg/DistributionCostAnalyzer.tsx`

**Requirements:**
- **Distributor Selection:**
  - Dropdown to select distributor
  - "Add New Distributor" button

- **Distributor Profile Form:**
  - Name, description, contact info
  - Fee structure entry:
    - Pallet cost ($)
    - Warehouse services ($)
    - Pallet build ($)
    - Floor space - full day ($)
    - Floor space - half day ($)
    - Truck transfer - Zone 1 ($)
    - Truck transfer - Zone 2 ($)
    - Custom fees (name + amount)

- **Distribution Calculator:**
  - Number of pallets (input)
  - Units per pallet (input)
  - Price per unit - Small (input)
  - Price per unit - Large (input, optional)
  - Base CPU - Small (auto-populate from latest invoice)
  - Base CPU - Large (auto-populate, optional)
  - **Fee Selection (checkboxes):**
    - ☐ Pallet cost
    - ☐ Warehouse services
    - ☐ Pallet build
    - ☐ Floor space: [ None | Full Day | Half Day ] + Days: [__]
    - ☐ Truck transfer: [ None | Zone 1 | Zone 2 ]
    - ☐ Custom fees (multi-select)
  - MSRP markup % (input, optional)

- **Results Display:**
  - Total distribution cost (bold)
  - Distribution cost per unit
  - Total CPU - Small (Base + Distribution)
  - Total CPU - Large (if applicable)
  - **Net Profit Margin - Small (COLOR-CODED):**
    - Red (< 50%): Poor
    - Yellow (50-60%): Good
    - Light Green (60-70%): Better
    - Dark Green (70%+): Best
  - Net Profit Margin - Large (if applicable)
  - MSRP - Small (if markup entered)
  - MSRP - Large (if markup entered)
  - Fee breakdown table

- **Save Scenario:**
  - "Save Calculation" button
  - Name this scenario (optional)
  - View saved scenarios

---

#### C3: Sales Promo Decision Tool Page
**File:** `src/pages/cpg/SalesPromoDecisionTool.tsx`

**Requirements:**
- **Promo Details Form:**
  - Promo name
  - Retailer name
  - Promo start/end dates
  - Store sale % (e.g., 20% off)
  - Producer payback % (e.g., 10% cost-share)
  - Retail price - Small
  - Retail price - Large (optional)
  - Units available - Small
  - Units available - Large (optional)
  - Base CPU - Small (auto-populate)
  - Base CPU - Large (auto-populate, optional)

- **Analysis Display:**
  - **Side-by-Side Comparison:**
    - Column 1: WITHOUT Promo
      - CPU: [value]
      - Margin: [value%]
    - Column 2: WITH Promo
      - CPU w/ Promo: [value]
      - Sales Promo Cost/Unit: [value]
      - Margin w/ Promo: [value%]
  - **Impact Summary:**
    - Margin difference: [+/- X%]
    - Total promo cost: [$X,XXX]
    - Total units: [X,XXX]

- **Recommendation Badge:**
  - 🟢 **PARTICIPATE** (Margin >= 50%)
  - 🔴 **DECLINE** (Margin < 40%)
  - 🟡 **BORDERLINE** (Margin 40-50%)
  - Reason explanation below badge

- **Decision Actions:**
  - "Approve Participation" button
  - "Decline Participation" button
  - "Save for Later" button
  - Notes field

---

## Phase 2: Enhanced Features (POST-DEMO)

### Group D: Integration with Graceful Books
**Priority:** HIGH (needed for full product launch)

#### D1: Financial Statement Integration
- Auto-populate COGS from CPG invoices
- Link CPG products to accounting products
- Sync inventory costs
- Generate journal entries from CPG transactions

#### D2: Reporting Integration
- CPG-specific P&L view
- Gross margin by product/category report
- Distribution cost analysis report
- Trade spend summary report

---

### Group E: Advanced Analytics (FUTURE)
**Priority:** MEDIUM

#### E1: Scenario Planning
- Compare multiple distributor scenarios side-by-side
- "What-if" calculator for pricing changes
- Break-even analysis for new SKUs
- SKU rationalization recommendations

#### E2: Historical Analytics
- CPU trend analysis over time
- Seasonal cost pattern detection
- Distributor cost comparison over time
- Trade spend ROI analysis

---

## Standalone vs. Integrated Mode

### Standalone Mode
**For users who ONLY need CPG calculator:**
- **Manual Financial Data Entry:**
  - Enter P&L line items with totals OR upload P&L report
  - Enter Balance Sheet line items OR upload Balance Sheet
  - Enter invoices line-by-line for CPG cost tracking
- **No bookkeeping software integration**
- **CPG-specific features:** Distribution cost analysis, sales promo analyzer, CPU tracking
- **Pricing:** $5 per SKU/product, capped at $50/month maximum

**Note:** Historical invoice CSV import NOT supported (too many missing details)

### Integrated Mode
**For users with full Audacious Money accounting software:**
- **Seamless Invoice Entry:** One invoice entry serves both accounting and CPG tracking
- **Auto-populate from accounting data:** Products, vendors, existing financial data
- **COGS syncs automatically** to financial statements
- **Inventory integration** with existing inventory tracking
- **Full reporting suite** with CPG-enhanced reports
- **Pricing:** $40/month flat - ALL features included, no upsells

---

## Data Import/Entry Workflow

### For Standalone Users:
1. **Welcome Screen:**
   - "I'm using Audacious Money" → Full integration
   - "I only need CPG calculator" → Standalone mode

2. **Standalone Setup:**
   - **Financial Data Entry:**
     - Enter P&L: Revenue, COGS, Expenses (line-by-line with totals)
     - Enter Balance Sheet: Assets, Liabilities, Equity (line-by-line with totals)
     - OR Upload P&L/Balance Sheet reports (if upload feature built)
   - **CPG Setup:**
     - Create product SKUs (this determines pricing: $5/SKU)
     - Define product variants (e.g., "8oz", "16oz" OR "Small", "Large" OR none)
     - Create cost categories (Oil, Bottle, Box, etc.)
     - Set up distributors with fee structures

3. **Ongoing Use:**
   - Enter invoices line-by-line with cost attribution
   - Run distribution calculations
   - Analyze trade spend
   - Export results

### For Integrated Users:
1. **Automatic Setup:**
   - Uses existing company/product data from Audacious Money
   - Existing SKUs automatically available for CPG tracking
   - Links CPG categories to accounting categories

2. **Ongoing Use:**
   - **Single invoice entry** creates accounting transaction AND CPG cost tracking
   - COGS auto-updates in financial statements
   - Reports include CPG data
   - No duplicate data entry - seamless integration

---

## Thursday Demo Checklist

### Must-Have (MVP):
- [x] Database schemas created
- [ ] CPU Calculator service (core logic)
- [ ] Distribution Cost Calculator service (core logic)
- [ ] Sales Promo Analyzer service (core logic)
- [ ] CPU Tracker UI (basic invoice entry + current CPU display)
- [ ] Distribution Cost Analyzer UI (calculator + color-coded results)
- [ ] Sales Promo Decision UI (analysis + recommendation)
- [ ] Seed data for demo (2-3 sample invoices, 2 distributors, 1 promo)

### Nice-to-Have (if time permits):
- [ ] Historical CPU timeline visualization
- [ ] Saved scenarios list
- [ ] CSV export
- [ ] Print-friendly views

### Demo Script:
1. **Intro (2 min):** Problem statement - CPG businesses struggle with true cost visibility
2. **CPU Tracker (5 min):** Enter invoice, show cost attribution, display updated CPU
3. **Distribution Cost Analyzer (7 min):**
   - Create distributor profile
   - Run calculation with fee selection
   - Show color-coded margin
   - Calculate MSRP
4. **Sales Promo Decision Tool (6 min):**
   - Enter promo details
   - Show side-by-side comparison
   - Display recommendation
   - Explain decision logic

**Total:** ~20 minutes

---

## Technical Dependencies

### Required Libraries:
- ✅ Dexie.js (database)
- ✅ Decimal.js (financial precision)
- ✅ nanoid (ID generation)
- ✅ React 18+
- ✅ TypeScript

### New Dependencies (if needed):
- [ ] Recharts (for CPU trend visualization)
- [ ] React Hook Form (for complex forms)
- [ ] Date-fns (for date manipulation)

---

## Success Metrics

### Thursday Demo Success Criteria:
1. ✅ Successfully enter an invoice with cost attribution
2. ✅ CPU calculates correctly with additional costs allocated
3. ✅ Distribution cost calculator shows accurate results
4. ✅ Profit margin color-coding works (poor/good/better/best)
5. ✅ Sales promo analysis provides clear recommendation
6. ✅ Demo flows smoothly without crashes

### Post-Demo Success Criteria:
1. Users can complete full CPU workflow independently
2. Distribution calculations match Excel spreadsheet results
3. Sales promo recommendations are actionable
4. Standalone mode works without accounting data
5. Integrated mode syncs with financial statements

---

## Risk Assessment

### High Risk:
- **Complex calculations:** CPU attribution logic is nuanced
  - **Mitigation:** Extensive testing with user's real data

- **UI complexity:** Many inputs, need to stay intuitive
  - **Mitigation:** Iterative design, user testing

### Medium Risk:
- **Time constraint:** Thursday deadline is aggressive
  - **Mitigation:** Focus on MVP, defer nice-to-haves

- **Integration complexity:** Standalone vs. integrated modes
  - **Mitigation:** Build standalone first, add integration later

### Low Risk:
- **Technical feasibility:** All features are achievable
- **Database schema:** Well-designed and flexible

---

## Next Steps (Immediate)

1. **Complete Calculator Services (Group B)**
   - CPU Calculator service
   - Distribution Cost Calculator service
   - Sales Promo Analyzer service

2. **Build Core UI (Group C)**
   - CPU Tracker page with line-by-line invoice entry
   - Distribution Cost Analyzer page
   - Sales Promo Decision Tool page

3. **Testing & Polish**
   - Test with generic example data
   - Fix edge cases
   - Polish UI/UX for seamless experience

4. **Demo Preparation**
   - Prepare demo script
   - User will enter their own examples during demo (no pre-populated data)

---

## Key Design Principles (Per User Feedback)

✅ **User-Defined Variants:** Not hardcoded "Small/Large" - users define their own (e.g., "8oz", "16oz", "32oz")
✅ **Line-by-Line Invoice Entry:** Integrated with bookkeeping - enter once, use everywhere
✅ **User-Controlled Attribution:** User allocates costs during invoice entry, not post-facto
✅ **Clean & Seamless:** Not clunky or overwhelming
✅ **No Historical CSV Import:** Too many missing details from historical data
✅ **User-Configurable Thresholds:** Default margins (Poor <50%, Good 50-60%, Better 60-70%, Best 70%+) but user can adjust
✅ **Brand:** Audacious Money (not Graceful Books)
✅ **Pricing:**
  - Standalone: $5/SKU, max $50/month
  - Integrated: $40/month flat (all features, no upsells)

---

## Clarifications Applied

1. ✅ **Small/Large → User-Defined Variants:** Categories support any number of user-defined variants
2. ✅ **Invoice Entry Integration:** Line-by-line entry works for both bookkeeping and CPG tracking
3. ✅ **Standalone Financial Entry:** P&L and Balance Sheet entry/upload required
4. ✅ **Pricing Updated:** $5/SKU (max $50) standalone, $40/month integrated
5. ✅ **Brand Name:** Audacious Money throughout
6. ✅ **No CSV Import:** Removed from roadmap
7. ✅ **No Timeframes:** Removed all estimated hours/days
8. ✅ **No Real Data in Demo:** User will enter examples themselves
9. ✅ **Color Thresholds:** Default shown, but user-configurable

---

**Roadmap Approved by:** _______________________
**Date:** _______________________
