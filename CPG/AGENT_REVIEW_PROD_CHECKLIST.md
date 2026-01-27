# Agent Review Checklist - CPG Product Module
**Ensure Quality & Consistency for CPG Cost Analysis Features**

Every agent working on the CPG (Consumer Packaged Goods) Module MUST complete this checklist before marking work as complete.

---

## 🎯 Pre-Implementation Checklist

### Documentation Review
- [ ] Read `Roadmaps/CPG_MODULE_ROADMAP.md` (complete acceptance criteria for assigned group)
- [ ] Review user's proprietary spreadsheet analysis (CPU, Distribution Cost, Sales Promo tabs)
- [ ] Read `CLAUDE.md` → Update: Brand is **Audacious Money** (not Graceful Books)
- [ ] Read `src/db/schema/cpg.schema.ts` (understand data structures)
- [ ] Review pricing model:
  - Standalone: $5/SKU, max $50/month
  - Integrated: $40/month flat (all features)

### CPG-Specific Requirements Understanding
- [ ] Understand **flexible variants** (not hardcoded Small/Large)
  - Users define: ["8oz", "16oz", "32oz"] OR ["Small", "Large"] OR null (no variants)
- [ ] Understand **line-by-line invoice entry** integration
  - One entry serves BOTH accounting and CPG tracking
  - Clean, seamless, not clunky or overwhelming
- [ ] Understand **user-controlled cost attribution**
  - User allocates costs during invoice entry, not post-facto
- [ ] Understand **calculation formulas**:
  - CPU: `(Cost for Category + User-Allocated Additional Costs) / Units Received`
  - Distribution Cost Per Unit: `Total Fees / (Pallets × Units Per Pallet)`
  - Total CPU: `Base CPU + Distribution Cost Per Unit`
  - Profit Margin: `((Price - Total CPU) / Price) × 100`
- [ ] Understand **color-coded margin thresholds** (user-configurable):
  - Poor (Red): < 50%
  - Good (Yellow): 50-60%
  - Better (Light Green): 60-70%
  - Best (Dark Green): 70%+

### Dependencies Check
- [ ] Database schema version 19 migrated (CPG tables exist)
- [ ] Decimal.js available for financial precision (avoid rounding errors)
- [ ] Product/SKU system exists (for pricing: $5/SKU calculation)
- [ ] Invoice entry system exists (for integrated mode)
- [ ] Financial statement structure exists (for standalone P&L/Balance Sheet entry)

---

## 💻 Implementation Checklist

### Code Quality (CPG-Specific)
- [ ] **Financial precision:** Use `Decimal.js` for ALL calculations (never native JavaScript floats)
- [ ] **Variant flexibility:** No hardcoded "Small" or "Large" - support any user-defined variants
- [ ] **Attribution keys:** Use `generateCategoryKey(categoryName, variant)` for consistent keys
- [ ] **Schema compliance:** Match interfaces in `cpg.schema.ts` exactly
- [ ] **Error handling:** Clear messages for invalid inputs (negative costs, zero quantities, etc.)
- [ ] **Validation:** Prevent impossible scenarios (e.g., units received > units purchased without explanation)

### CPG Calculation Accuracy
- [ ] **CPU calculations verified:**
  - Cost attribution sums correctly
  - Additional costs allocated per user instructions
  - Units reconciliation handled (purchased vs. received discrepancies)
  - Calculated CPUs stored per variant in `calculated_cpus` Record
- [ ] **Distribution cost calculations verified:**
  - Multi-layered fees sum correctly
  - Checkbox selections apply correct fees
  - Pallet multipliers work correctly
  - Zone-based pricing accurate
  - Distribution cost per unit = Total fees / (Pallets × Units per pallet)
  - Total CPU = Base CPU + Distribution cost per unit
- [ ] **Sales promo calculations verified:**
  - Sales promo cost = Retail price × Producer payback %
  - CPU w/ promo = Base CPU + Sales promo cost
  - Margins calculated correctly (with vs. without promo)
  - Recommendation logic correct (participate/decline/neutral)
  - Total promo cost = Sum across all variants

### Margin Quality Color Coding
- [ ] **Default thresholds implemented:**
  - Poor (Red): margin < 50%
  - Good (Yellow): margin 50-60%
  - Better (Light Green): margin 60-70%
  - Best (Dark Green): margin >= 70%
- [ ] **Thresholds configurable:** User can adjust percentages
- [ ] **Visual consistency:** Same colors used across all features
- [ ] **Accessibility:** Color not sole indicator (use icons/labels too)

### Standalone vs. Integrated Mode
- [ ] **Standalone mode:**
  - P&L entry/upload UI exists
  - Balance Sheet entry/upload UI exists
  - SKU count tracked for pricing ($5/SKU)
  - No dependency on accounting data
  - CSV export available
- [ ] **Integrated mode:**
  - Invoice entry creates BOTH accounting transaction and CPG cost tracking
  - Products auto-populate from existing SKUs
  - Financial data auto-populated
  - COGS syncs to financial statements
  - No duplicate data entry required

### User Experience (CPG-Specific)
- [ ] **Clean & seamless:** Invoice entry not clunky or overwhelming
- [ ] **Progressive disclosure:** Advanced features hidden until needed
- [ ] **Smart defaults:** Pre-fill where possible (last distributor, typical margins)
- [ ] **Inline help:** Tooltips explain CPG terminology (CPU, trade spend, etc.)
- [ ] **Visual feedback:** Real-time calculation updates as user types
- [ ] **Clear labels:** Plain English ("Cost Per Unit" not just "CPU")

### Steadiness Communication Style (Audacious Money Brand)
- [ ] Patient, supportive messaging ("You're tracking costs like a pro!")
- [ ] Clear expectations ("Here's how this affects your margins...")
- [ ] Never blame users ("Oops! Let's check those numbers" not "Invalid cost allocation")
- [ ] Step-by-step guidance (wizards for complex workflows)
- [ ] Reassuring tone throughout

### Security (Financial Data)
- [ ] **Cost data encrypted:** All CPG invoices encrypted client-side
- [ ] **Distributor data encrypted:** Fee structures encrypted
- [ ] **No proprietary data leakage:** User's specific categories/costs never logged
- [ ] **Input sanitization:** Prevent injection attacks in custom fee names
- [ ] **Authorization:** Verify user owns company before accessing CPG data

---

## 🧪 Testing Checklist

### Calculation Accuracy Tests
- [ ] **CPU Calculator:**
  - Test with single category, no variants
  - Test with single category, multiple variants (2-5 variants)
  - Test with multiple categories, mixed variants
  - Test cost attribution (percentages sum to 100%)
  - Test additional costs allocation (50/50, proportional, manual)
  - Test reconciliation (purchased ≠ received)
  - Test edge cases:
    - Zero additional costs
    - Fractional units (2.5 units purchased)
    - Very large numbers (1,000,000 units)
    - Very small numbers (0.01 unit cost)
  - Verify rounding: All results to 2 decimal places (currency)
  - Verify Decimal.js used (no float precision errors)

- [ ] **Distribution Cost Calculator:**
  - Test with all fees unchecked (should = 0)
  - Test with single fee checked
  - Test with multiple fees checked
  - Test floor space calculation (full day, half day, multiple days)
  - Test zone-based pricing (zone 1 vs. zone 2)
  - Test custom fees (1-5 custom fees)
  - Test pallet multiplier (0.5 pallets, 1 pallet, 10 pallets)
  - Test distribution cost per unit = Total / (Pallets × Units per pallet)
  - Test profit margin calculation for each variant
  - Test margin quality assignment (poor/good/better/best)
  - Test MSRP calculation (various markup percentages)

- [ ] **Sales Promo Analyzer:**
  - Test with 0% producer payback (should = base CPU)
  - Test with various payback % (5%, 10%, 25%, 50%)
  - Test with various store sale % (10%, 20%, 30%, 50%)
  - Test margin comparison (with vs. without promo)
  - Test recommendation logic:
    - Margin >= 50% → Participate
    - Margin < 40% → Decline
    - Margin 40-50% → Neutral
  - Test total promo cost across multiple variants
  - Test edge case: 100% producer payback (entire discount)

### Variant Flexibility Tests
- [ ] Test with 0 variants (single product, no sizes)
- [ ] Test with 1 variant only
- [ ] Test with 2 variants (e.g., Small, Large)
- [ ] Test with 3+ variants (e.g., 8oz, 16oz, 32oz, 64oz)
- [ ] Test variant names with numbers ("8oz", "16oz")
- [ ] Test variant names with letters ("Small", "Large", "XL")
- [ ] Test variant names with special chars ("1/2 gallon", "Size-M")
- [ ] Verify user can add/remove variants dynamically
- [ ] Verify calculations update when variants change

### User Workflow Tests
- [ ] **End-to-End: CPU Tracking**
  1. User creates categories (Oil, Bottle, Box)
  2. User defines variants for each category
  3. User enters invoice line-by-line
  4. User allocates costs to categories
  5. User enters additional costs
  6. System calculates CPU per variant
  7. User views historical CPU changes
  8. ✅ CPU displayed correctly, history tracked

- [ ] **End-to-End: Distribution Cost Analysis**
  1. User creates distributor profile
  2. User enters fee structure
  3. User runs distribution calculation
  4. User selects which fees apply (checkboxes)
  5. User enters pallet/unit parameters
  6. System calculates total CPU
  7. System shows color-coded margins
  8. User saves scenario for comparison
  9. ✅ Margins accurate, colors correct

- [ ] **End-to-End: Sales Promo Decision**
  1. User enters promo details (retailer, dates)
  2. User enters store sale % and producer payback %
  3. User enters retail prices per variant
  4. User enters units available per variant
  5. System calculates CPU w/ promo
  6. System shows side-by-side comparison
  7. System provides recommendation
  8. User approves or declines participation
  9. ✅ Recommendation sound, comparison clear

### Integration Tests
- [ ] **Invoice entry integration (Integrated Mode):**
  - Invoice creates accounting transaction
  - Invoice creates CPG cost tracking entry
  - Product SKUs populated from accounting system
  - COGS updates in financial statements
  - Single data entry (no duplication)

- [ ] **SKU pricing integration (Standalone Mode):**
  - User creates product SKU
  - SKU count increments
  - Pricing updates ($5/SKU, max $50)
  - User can delete SKU
  - SKU count decrements
  - Pricing updates accordingly

### Manual Testing
- [ ] Feature works in dev environment (no errors)
- [ ] Calculations match Excel spreadsheet results (spot-check 3-5 scenarios)
- [ ] Form validation provides helpful messages
- [ ] Loading states show during calculations
- [ ] Error states display when invalid input
- [ ] Success messages encourage user
- [ ] Mobile responsive (320px, 768px, 1920px widths)
- [ ] Keyboard navigation works (Tab, Enter, Space, Esc)
- [ ] Screen reader announces labels and results

### Test Execution
- [ ] All tests passing locally: `npm test`
- [ ] No new TypeScript errors: `npm run typecheck`
- [ ] No new ESLint errors: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Coverage >= 80% (aim for 90%+)

---

## 📝 Documentation Checklist

### Code Documentation
- [ ] **JSDoc comments for all calculator functions:**
  - Explain formula used
  - Document parameter units (e.g., "quantity: string in decimal format")
  - Document return value structure
  - Provide example usage
- [ ] **Inline comments for complex calculations:**
  - Cost attribution logic
  - Margin quality determination
  - Recommendation algorithm
- [ ] **Type definitions documented:**
  - All CPG interfaces have description comments
  - Variant structures explained

### Formula Documentation
- [ ] **CPU formula documented in code:**
  ```typescript
  /**
   * Calculate Cost Per Unit (CPU)
   * Formula: (Cost for Category + User-Allocated Additional Costs) / Units Received
   * @param costForCategory - Direct cost attributed to this category
   * @param additionalCosts - Shipping, printing, etc. allocated by user
   * @param unitsReceived - Actual units received (for reconciliation)
   * @returns CPU as string with 2 decimal places
   */
  ```

- [ ] **Distribution cost formula documented**
- [ ] **Sales promo formula documented**
- [ ] **Margin calculation formula documented**

### User-Facing Documentation
- [ ] **CPG Module User Guide:**
  - What is CPU tracking and why it matters
  - How to enter invoices with cost attribution
  - How to analyze distribution costs
  - How to evaluate trade spend opportunities
  - Standalone vs. Integrated mode explained
- [ ] **Formula explanations for users:**
  - Plain English explanation of calculations
  - Examples with real numbers
  - Visual diagrams (flowcharts, before/after)

### Implementation Summary
- [ ] **CPG_IMPLEMENTATION_SUMMARY.md created:**
  - What was built (overview of CPG module)
  - Files created/modified (with line counts)
  - Calculation formulas implemented
  - Variant flexibility demonstrated
  - Test results (passing count, coverage %)
  - Integration points (invoice entry, financial statements)
  - Known limitations (if any)
  - Next steps (reporting, analytics, advanced features)

---

## ✅ Acceptance Criteria Verification

### Roadmap Criteria (CPG_MODULE_ROADMAP.md)
- [ ] Find assigned group in roadmap (A, B, C, D, E)
- [ ] Review all acceptance criteria for group
- [ ] Verify EACH criterion met:
  - [ ] Group A: Database schemas created and migrated
  - [ ] Group B: Calculator services implemented with accurate formulas
  - [ ] Group C: Core UI components clean and seamless
  - [ ] Group D: Integration with Audacious Money accounting
  - [ ] Group E: Advanced analytics and scenario planning
- [ ] Check off completed criteria in roadmap
- [ ] If ANY criteria cannot be met, document why and propose solution

### User Requirements Validation
- [ ] Flexible variants (not hardcoded) - ✅ Implemented
- [ ] Line-by-line invoice entry - ✅ Integrated with bookkeeping
- [ ] User-controlled attribution - ✅ During entry, not post-facto
- [ ] Clean & seamless UX - ✅ Not clunky or overwhelming
- [ ] Color-coded margins - ✅ User-configurable thresholds
- [ ] Standalone P&L/Balance Sheet entry - ✅ Available
- [ ] Pricing model - ✅ $5/SKU (max $50) standalone, $40/month integrated

---

## 🎨 UI/UX Checklist (CPG Features)

### Design Consistency
- [ ] Matches Audacious Money design patterns
- [ ] Uses existing color palette and typography
- [ ] Form layouts consistent with other features
- [ ] Button styles match (primary, secondary, danger)
- [ ] Loading states use existing spinners/skeletons
- [ ] Error states use existing alert components

### CPG-Specific UI Elements
- [ ] **Category/Variant entry:**
  - Clear labels ("Category Name", "Variants: e.g., 8oz, 16oz")
  - Add/remove buttons for variants
  - Visual feedback when variant added
- [ ] **Invoice line-by-line entry:**
  - Table format for multiple lines
  - Dropdowns for category selection
  - Dropdowns for variant selection (filtered by category)
  - Real-time cost attribution updates
  - Running total displayed
- [ ] **Distribution calculator:**
  - Checkbox layout clear and scannable
  - Fee descriptions visible (tooltips if needed)
  - Pallet/unit inputs adjacent to calculations
  - Results section visually distinct
  - Color-coded margins prominent
- [ ] **Sales promo analyzer:**
  - Side-by-side comparison layout
  - "With Promo" vs. "Without Promo" columns clear
  - Recommendation badge prominent
  - Decision buttons clear CTAs

### Mobile Responsiveness (CPG)
- [ ] Invoice entry table scrollable on mobile
- [ ] Checkboxes touch-friendly (44x44px minimum)
- [ ] Forms stack vertically on narrow screens
- [ ] Results legible without horizontal scroll
- [ ] Color-coded margins visible on small screens

### Micro-Celebrations (CPG Joy Opportunities)
- [ ] First invoice entered: "Great start! You're tracking costs like a pro! 🎉"
- [ ] First distributor created: "Nice! Now you can compare distribution costs."
- [ ] Profitable promo found: "This promo looks great! 70%+ margin! 💚"
- [ ] Unprofitable promo avoided: "Good catch! This promo would hurt your margins."
- [ ] CPU improved: "Your costs are trending down! Keep it up!"

---

## 🔗 Integration Checklist

### Database Integration
- [ ] CPG tables exist in version 19 schema
- [ ] Indexes on `company_id` for query performance
- [ ] Compound indexes on `[company_id+active]` for active records
- [ ] CRDT fields (`version_vector`, `updated_at`) present
- [ ] Soft deletes implemented (`deleted_at` field)
- [ ] Hooks update timestamps automatically

### Service Integration
- [ ] CPU Calculator service:
  - Imports Decimal.js for precision
  - Uses `db.cpgInvoices`, `db.cpgCategories` correctly
  - Returns `DatabaseResult<T>` format
  - Handles errors gracefully
  - Logs important operations
- [ ] Distribution Cost Calculator service:
  - Uses `db.cpgDistributors`, `db.cpgDistributionCalculations`
  - Calculates fees accurately
  - Determines margin quality correctly
  - Saves scenarios for comparison
- [ ] Sales Promo Analyzer service:
  - Uses `db.cpgSalesPromos`
  - Calculates promo costs accurately
  - Provides sound recommendations
  - Compares with/without promo margins

### Component Integration
- [ ] CPU Tracker page:
  - Fetches categories from store
  - Updates invoices via service
  - Displays historical timeline
  - Handles loading/error states
- [ ] Distribution Cost Analyzer page:
  - Fetches distributors from store
  - Runs calculations via service
  - Displays color-coded results
  - Saves scenarios
- [ ] Sales Promo Decision Tool page:
  - Fetches promo data from store
  - Runs analysis via service
  - Displays recommendation
  - Allows approve/decline actions

### Financial Statement Integration (Integrated Mode)
- [ ] Invoice entry creates accounting transaction
- [ ] COGS updates in P&L
- [ ] Inventory costs update in Balance Sheet
- [ ] Audit trail created for CPG transactions
- [ ] Reports include CPG data

---

## 🚀 Pre-Completion Checklist

### CPG-Specific Verification
- [ ] **Calculation accuracy verified:**
  - Spot-checked against user's Excel spreadsheet
  - Tested with edge cases (zero costs, fractional units, large numbers)
  - Decimal.js prevents rounding errors
- [ ] **Variant flexibility verified:**
  - Works with 0, 1, 2, 3, 5+ variants
  - Variant names flexible (numbers, letters, special chars)
  - Calculations update when variants change
- [ ] **User attribution verified:**
  - User allocates costs during invoice entry
  - Attribution clear and intuitive
  - No confusing post-entry allocation steps
- [ ] **Color coding verified:**
  - Margins colored correctly (poor/good/better/best)
  - Thresholds configurable by user
  - Accessible (color not sole indicator)
- [ ] **Standalone mode verified:**
  - P&L/Balance Sheet entry works
  - No dependency on accounting data
  - SKU pricing calculated correctly ($5/SKU, max $50)
- [ ] **Integrated mode verified:**
  - Invoice entry serves both systems
  - No duplicate data entry
  - COGS syncs to financial statements

### Final Verification
- [ ] Feature works end-to-end (user can complete full workflow)
- [ ] No console errors or warnings
- [ ] No TypeScript errors
- [ ] All tests passing (100%)
- [ ] Code reviewed by self (read every line)
- [ ] Documentation complete and accurate
- [ ] Roadmap acceptance criteria checked off

### Git Commit
- [ ] Stage only relevant files (no proprietary spreadsheet data)
- [ ] Commit message follows convention:
  - Format: `feat(cpg): description` or `fix(cpg): description`
  - Examples:
    - `feat(cpg): add CPU calculator with flexible variants`
    - `feat(cpg): add distribution cost analyzer with color-coded margins`
    - `feat(cpg): add sales promo decision tool with recommendations`
  - Include "Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
- [ ] Commit includes all necessary files (code + tests + docs)
- [ ] No proprietary user data committed (use generic examples only)

### Handoff
- [ ] `CPG_IMPLEMENTATION_SUMMARY.md` created
- [ ] Known limitations documented (if any)
- [ ] Next steps outlined (reporting, analytics, advanced scenarios)
- [ ] Demo script prepared (if Thursday demo)

---

## 🔴 Blockers & Escalation (CPG-Specific)

### When to Ask for Help
- [ ] Formula unclear → Ask user: "Should additional costs split 50/50 or proportional by volume?"
- [ ] Calculation doesn't match spreadsheet → Show discrepancy, ask for clarification
- [ ] Variant flexibility limitation → Document limitation, propose workaround
- [ ] Integration blocker → Flag dependency, propose alternative approach

### How to Report CPG Blockers
1. Describe what you're implementing (CPG feature, calculation)
2. Describe what's blocking you (formula ambiguity, missing data, integration issue)
3. Show your work (calculation steps, expected vs. actual results)
4. Propose solution or ask specific question

Example:
> "I'm implementing the Distribution Cost Calculator (Group B2). The spreadsheet shows 'Warehouse Cost: $406.00' but I can only account for $381 ($25 warehouse services + $25 pallet build + $81 pallet cost + $100 floor space full day + $100 truck transfer zone 1 + $50 floor space half day = $381). Am I missing a fee, or is this a multi-day calculation? Should I add a 'miscellaneous fees' field?"

---

## ✨ CPG Quality Standards Summary

**Every CPG feature MUST meet ALL of these:**
1. ✅ All acceptance criteria from `CPG_MODULE_ROADMAP.md` completed
2. ✅ All tests passing (100%), coverage >= 80%
3. ✅ Calculation accuracy verified (matches spreadsheet, uses Decimal.js)
4. ✅ Variant flexibility working (0 to 5+ variants, any naming convention)
5. ✅ Clean & seamless UX (not clunky, intuitive attribution flow)
6. ✅ Color-coded margins accurate (poor/good/better/best, user-configurable)
7. ✅ Standalone mode functional (P&L/Balance Sheet entry, SKU pricing)
8. ✅ Integrated mode seamless (invoice entry serves both systems)
9. ✅ Documentation complete (formulas explained, user guide, implementation summary)
10. ✅ Audacious Money branding (not Graceful Books)

**If ANY of these are not met, work is NOT complete.**

---

## 📋 Checklist Template for CPG Agent Use

Copy this to your CPG implementation summary document:

```markdown
## CPG Agent Review Checklist Status

### Pre-Implementation
- [x] CPG roadmap reviewed
- [x] Spreadsheet analysis complete
- [x] Flexible variants understood
- [x] Formulas verified
- [x] Dependencies checked

### Implementation
- [x] Decimal.js used for all calculations
- [x] Variant flexibility implemented (no hardcoded Small/Large)
- [x] User-controlled attribution during entry
- [x] Clean & seamless UX (not clunky)
- [x] Color-coded margins (user-configurable thresholds)
- [x] Standalone mode (P&L/Balance Sheet entry)
- [x] Integrated mode (single invoice entry)

### Calculation Accuracy
- [x] CPU formula verified (XX test cases passing)
- [x] Distribution cost formula verified (XX test cases passing)
- [x] Sales promo formula verified (XX test cases passing)
- [x] Margin calculations accurate (XX test cases passing)
- [x] Spot-checked against Excel spreadsheet (X scenarios matched)

### Testing
- [x] Unit tests written (coverage: XX%)
- [x] Variant flexibility tested (0, 1, 2, 5+ variants)
- [x] Edge cases tested (zero costs, fractional units, large numbers)
- [x] Integration tests complete (invoice entry, SKU pricing)
- [x] All tests passing (XXX/XXX)
- [x] Manual testing complete
- [x] Mobile responsive tested

### Documentation
- [x] Formulas documented in code (JSDoc)
- [x] User guide created (CPG module usage)
- [x] Implementation summary created
- [x] Plain English formula explanations

### Acceptance Criteria
- [x] All roadmap criteria met (Group X: XX/XX)
- [x] User requirements validated
- [x] Flexible variants working
- [x] Line-by-line entry integrated
- [x] Color-coded margins accurate

### Integration
- [x] Database integration complete (version 19)
- [x] Service integration complete (calculators working)
- [x] Component integration complete (UI functional)
- [x] Financial statement integration (if integrated mode)

### Pre-Completion
- [x] Feature works end-to-end
- [x] Calculations match spreadsheet
- [x] No console errors
- [x] Git commit prepared
- [x] Handoff documentation complete
```

---

**Remember:** Calculation accuracy is paramount. A single rounding error can cost users thousands of dollars. Use Decimal.js religiously.

**CPG Motto:** "Clean entry, accurate calculations, confident decisions."

**Last Updated:** 2026-01-23
