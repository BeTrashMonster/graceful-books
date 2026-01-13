# Advanced Inventory - Capability Specification

**Capability ID:** `inventory-advanced`
**Related Roadmap Items:** H6
**SPEC Reference:** ACCT-007 (extends basic inventory)
**Status:** Planned (Phase 4)

## Overview

Advanced Inventory extends basic inventory tracking (G3) with multiple valuation methods (FIFO, LIFO, weighted average), precise COGS calculation, stock take functionality, and comprehensive inventory adjustments with audit trails. This provides product businesses with professional-grade inventory management and accurate profitability analysis.

## ADDED Requirements


### Functional Requirements

#### FR-1: Valuation Method Selection
**Priority:** High

**ADDED Requirements:**

The system SHALL support multiple inventory valuation methods:

**Supported Methods:**
- FIFO (First In, First Out): Sell oldest inventory first
- LIFO (Last In, First Out): Sell newest inventory first
- Weighted Average: Average cost of all units on hand

**Method Selection:**
- Choose method per product
- Global default method (applied to new products)
- Method displayed on product record
- Method change warning (impacts COGS and taxes)
- Historical method tracking (audit trail)

**Method Change Handling:**
- Warning modal explaining impact
- Confirmation required
- Effective date for change
- Recalculate inventory value on change
- Audit log of method changes

**Acceptance Criteria:**
- [ ] All three methods selectable
- [ ] Method saves per product
- [ ] Method change warns user
- [ ] Historical methods tracked
- [ ] Recalculation on change works

---

#### FR-2: FIFO Calculation
**Priority:** High

**ADDED Requirements:**

The system SHALL implement FIFO costing:

**FIFO Logic:**
- Track individual purchase lots (date, quantity, cost per unit)
- Sell from oldest lot first
- Deplete lots in chronological order
- COGS = cost of units from oldest lot(s)
- Maintain lot balance after each sale

**Lot Tracking:**
- Lot identifier (purchase date + sequence)
- Lot quantity remaining
- Lot cost per unit
- Lot depletion history
- Cross-reference to purchase transaction

**COGS Calculation:**
- Identify oldest lot(s) with available quantity
- Calculate COGS from lot costs
- Deplete lot(s) by sale quantity
- If sale > lot quantity, move to next oldest lot
- Accurate COGS per sale transaction

**Lot Reporting:**
- Lot detail report (all lots on hand)
- Lot depletion history
- Aging by lot (oldest to newest)
- Visualization of lot flow

**Acceptance Criteria:**
- [ ] Lots tracked correctly
- [ ] COGS calculated from oldest lots
- [ ] Lot depletion accurate
- [ ] Multi-lot sales handled correctly
- [ ] Lot reports display correctly

---

#### FR-3: LIFO Calculation
**Priority:** High

**ADDED Requirements:**

The system SHALL implement LIFO costing:

**LIFO Logic:**
- Track purchase layers (date, quantity, cost per unit)
- Sell from newest layer first
- Deplete layers in reverse chronological order
- COGS = cost of units from newest layer(s)
- Maintain layer balance after each sale

**Layer Tracking:**
- Layer identifier (purchase date + sequence)
- Layer quantity remaining
- Layer cost per unit
- Layer depletion history
- Cross-reference to purchase transaction

**COGS Calculation:**
- Identify newest layer(s) with available quantity
- Calculate COGS from layer costs
- Deplete layer(s) by sale quantity
- If sale > layer quantity, move to next newest layer
- Accurate COGS per sale transaction

**Layer Reporting:**
- Layer detail report (all layers on hand)
- Layer depletion history
- Layer aging (newest to oldest)
- Visualization of layer flow

**Acceptance Criteria:**
- [ ] Layers tracked correctly
- [ ] COGS calculated from newest layers
- [ ] Layer depletion accurate
- [ ] Multi-layer sales handled correctly
- [ ] Layer reports display correctly

---

#### FR-4: Weighted Average Calculation
**Priority:** High

**ADDED Requirements:**

The system SHALL implement weighted average costing:

**Weighted Average Logic:**
- Calculate average cost per unit on hand
- Update average on each purchase
- COGS = average cost × quantity sold
- Simpler than FIFO/LIFO (no lot/layer tracking)
- Smooths cost fluctuations

**Average Cost Calculation:**
- Average = (Total Cost of Inventory) / (Total Quantity)
- Recalculate average on each purchase:
  - New Average = ((Old Qty × Old Avg) + (Purchase Qty × Purchase Cost)) / (Old Qty + Purchase Qty)
- Use current average for COGS on sale
- Store average cost history for audit

**COGS Calculation:**
- COGS = Current Average Cost × Quantity Sold
- Update average cost after purchase
- Simple, consistent calculation
- No lot/layer complexity

**Average Cost Reporting:**
- Current average cost per product
- Average cost history
- Cost trend over time
- Comparison to purchase costs

**Acceptance Criteria:**
- [ ] Average calculated correctly
- [ ] Average updates on purchase
- [ ] COGS accurate
- [ ] Cost history tracked
- [ ] Reports display correctly

---

#### FR-5: Inventory Valuation Reports
**Priority:** High

**ADDED Requirements:**

The system SHALL provide inventory valuation reports:

**Valuation Report Features:**
- Total inventory value by method
- Per-product valuation
- Method comparison (FIFO vs. LIFO vs. Weighted Avg side-by-side)
- Valuation trend over time
- Impact of method choice visualization

**Report Sections:**
- Product name and SKU
- Quantity on hand
- Cost per unit (by method)
- Total value (by method)
- Method used
- Valuation date

**Method Comparison Report:**
- Show all three methods for same inventory
- Highlight differences
- Tax impact estimation
- Profitability impact
- Educational notes about method choice

**Acceptance Criteria:**
- [ ] Valuation report accurate
- [ ] Method comparison displays
- [ ] Per-product detail available
- [ ] Trend visualization works
- [ ] Export functionality works

---

#### FR-6: Stock Take Functionality
**Priority:** Medium

**ADDED Requirements:**

The system SHALL support physical stock take:

**Stock Take Features:**
- Create stock take session
- Enter physical counts per product
- Compare physical to system counts
- Generate variance report
- Create adjustment transactions
- Approval workflow for adjustments (if enabled)

**Stock Take Workflow:**
- Start stock take (locks inventory for period)
- Enter physical counts (mobile-friendly)
- Calculate variances (physical - system)
- Review variances (highlight large discrepancies)
- Approve adjustments (create adjustment transactions)
- Complete stock take (unlock inventory)

**Variance Report:**
- Product name and SKU
- System quantity
- Physical count
- Variance (+ or -)
- Variance value (cost × variance)
- Variance percentage
- Red highlight for large variances (>5% or >$100)

**Acceptance Criteria:**
- [ ] Stock take session creation works
- [ ] Physical counts entry smooth
- [ ] Variance calculation accurate
- [ ] Adjustment generation correct
- [ ] Approval workflow integrates
- [ ] Report displays clearly

---

#### FR-7: Inventory Adjustments with Audit Trail
**Priority:** High

**ADDED Requirements:**

The system SHALL track inventory adjustments:

**Adjustment Features:**
- Manual inventory adjustments
- Adjustment reason required (dropdown + notes)
- Before/after quantities
- Adjustment value impact
- User and timestamp
- Cannot be deleted (immutable)

**Adjustment Reasons:**
- Stock take variance
- Damage/spoilage
- Theft/loss
- Found inventory
- Inventory transfer (future)
- Correction/error

**Adjustment Audit Trail:**
- All adjustments logged
- User who made adjustment
- Timestamp (date/time)
- Reason and notes
- Before/after quantities
- Value impact on COGS
- Immutable record

**Adjustment Reporting:**
- Adjustment history per product
- Adjustment summary (by reason)
- Adjustment value impact
- User adjustment activity
- Export adjustment log

**Acceptance Criteria:**
- [ ] Adjustments require reason
- [ ] Audit trail captures all details
- [ ] Adjustments cannot be deleted
- [ ] Reports display correctly
- [ ] Value impact calculated

---

### Non-Functional Requirements

#### NFR-1: Accuracy
**Priority:** Critical

**ADDED Requirements:**
- COGS calculation must be mathematically correct for each method
- Zero rounding errors in valuation
- Lot/layer tracking accurate
- Weighted average calculation precise
- Audit trail complete and immutable

#### NFR-2: Performance
**Priority:** High

**ADDED Requirements:**
- COGS calculation <1 second for any method
- Valuation report generation <5 seconds
- Supports 10,000+ SKUs
- Stock take entry responsive (mobile)
- Method comparison report <10 seconds

#### NFR-3: Usability
**Priority:** High

**ADDED Requirements:**
- Method selection clear with descriptions
- FIFO/LIFO/Weighted Average explained in plain English
- Lot/layer tracking transparent (users see the math)
- Stock take workflow simple (step-by-step)
- Adjustment reasons easy to select

---

## Technical Notes

**Extends Basic Inventory (G3):**
- Adds METHOD field to PRODUCTS table
- Adds INVENTORY_LOTS table (FIFO)
- Adds INVENTORY_LAYERS table (LIFO)
- Adds AVERAGE_COST_HISTORY table (Weighted Avg)
- Extends INVENTORY_TRANSACTIONS with lot/layer references

**COGS Posting:**
- Automatic COGS posting on sale (invoice, sale transaction)
- COGS journal entry: Debit COGS Expense, Credit Inventory Asset
- COGS detail on transaction (which lots/layers used)

---

## Success Metrics
- 50%+ of product businesses use advanced inventory
- 40%+ choose FIFO method
- 30%+ choose Weighted Average
- 10%+ choose LIFO
- Zero COGS calculation errors
- >4.5 ease-of-use rating
- 90%+ stock take completion rate
- 60% improvement in inventory accuracy
