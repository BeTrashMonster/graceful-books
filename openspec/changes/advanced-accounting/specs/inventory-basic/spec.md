# Basic Inventory Tracking - Capability Specification

**Capability ID:** `inventory-basic`
**Related Roadmap Items:** G3
**SPEC Reference:** ACCT-007
**Status:** In Development

## Overview

Basic Inventory Tracking enables product businesses to track stock levels, movements, and valuation. This includes quantity on hand, reorder alerts, FIFO/weighted average costing, and automatic COGS calculation on sales.

## ADDED Requirements


### Functional Requirements

#### FR-1: Stock Tracking
**Priority:** Critical

**ADDED Requirements:**

The system SHALL track inventory quantities:

**Quantity Tracking:**
- Quantity on hand per product
- Reserved quantity (on pending invoices)
- Available quantity (on hand - reserved)
- Unit of measure
- Location (single location v1.0)

**Stock Movements:**
- Receive inventory (purchase)
- Sell inventory (invoice)
- Adjust inventory (manual correction)
- Transfer (future multi-location)
- Movement history per product

**Opening Balance:**
- Set initial quantity on hand
- Set initial cost basis
- Opening balance date
- Audit trail

**Acceptance Criteria:**
- [ ] Quantity calculations accurate
- [ ] Movements tracked completely
- [ ] Reserved quantity correct
- [ ] Opening balance sets correctly

---

#### FR-2: Valuation Methods
**Priority:** Critical

**ADDED Requirements:**

The system SHALL support inventory valuation:

**Valuation Methods:**
- FIFO (First In, First Out)
- Weighted Average
- Method selection per company
- Warning when switching methods

**FIFO Calculation:**
- Track purchase batches with cost
- Sell oldest batches first
- Cost layers maintained
- Accurate COGS per sale

**Weighted Average:**
- Calculate average cost per unit
- Update on each purchase
- Apply average cost on sale
- Simpler than FIFO

**Acceptance Criteria:**
- [ ] FIFO calculates correctly
- [ ] Weighted average accurate
- [ ] Method switching warns user
- [ ] Cost basis maintained

---

#### FR-3: Reorder Point Alerts
**Priority:** High

**ADDED Requirements:**

The system SHALL alert on low stock:

**Alert Features:**
- Set reorder point per product
- Low stock threshold
- Alert when quantity <= reorder point
- Dashboard widget display
- Email notifications (optional)

**Alert Management:**
- Dismiss alerts
- Snooze alerts
- Mark as ordered
- Alert history

**Acceptance Criteria:**
- [ ] Alerts trigger correctly
- [ ] Dashboard widget functional
- [ ] Email notifications work
- [ ] Snooze/dismiss functional

---

#### FR-4: COGS Automatic Posting
**Priority:** Critical

**ADDED Requirements:**

The system SHALL automatically calculate and post COGS:

**COGS Posting:**
- Calculate COGS based on valuation method
- Post journal entry on invoice save
- Debit: COGS account
- Credit: Inventory Asset account
- Proper account assignment

**Visibility:**
- COGS per invoice line
- Total COGS per invoice
- Gross profit calculation
- Profitability percentage

**Acceptance Criteria:**
- [ ] COGS calculates correctly
- [ ] Journal entries post automatically
- [ ] Accounts balanced
- [ ] Gross profit accurate

---

#### FR-5: Inventory Reports
**Priority:** High

**ADDED Requirements:**

The system SHALL provide inventory reports:

**Reports:**
- Inventory Valuation Report (total value)
- Stock Movement Report (history)
- Low Stock Report (items below reorder point)
- COGS Report (by product, period)
- Inventory Asset (for balance sheet)

**Report Features:**
- Date range selection
- Product filtering
- Export to PDF/CSV/Excel
- Drill-down to transactions

**Acceptance Criteria:**
- [ ] All reports accurate
- [ ] Valuation matches balance sheet
- [ ] Export works correctly
- [ ] Performance acceptable

---

### Non-Functional Requirements

#### NFR-1: Data Integrity
**Priority:** Critical

**ADDED Requirements:**
- Quantity never negative (validation)
- All movements tracked (audit trail)
- COGS postings reversible (void invoice)
- Cost basis maintained accurately

#### NFR-2: Performance
**Priority:** High

**ADDED Requirements:**
- Quantity calculations real-time
- COGS posting <500ms
- Reports generate in <3 seconds
- Support 1,000+ SKUs

---

## Success Metrics
- 60%+ of product businesses enable inventory
- 80%+ use reorder point alerts
- >4.0 ease-of-use rating
- Zero negative quantity errors
- 100% COGS accuracy
