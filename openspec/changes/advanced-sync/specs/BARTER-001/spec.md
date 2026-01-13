# Barter/Trade Transactions - Capability Specification

**Capability ID:** `barter-transactions`
**Related Roadmap Items:** I5
**SPEC Reference:** BARTER-001
**Status:** Planned (Phase 4 - Group I)

## Overview

Barter/Trade Transactions enable proper accounting for non-cash exchanges of goods or services. This capability ensures accurate recording of barter income and expenses, compliance with tax regulations (1099-B in US), and education about barter taxation.

## ADDED Requirements


### Functional Requirements

#### FR-1: Barter Transaction Type
**Priority:** High

**ADDED Requirements:**

The system SHALL support barter transaction type:

**Transaction Creation:**
- Special transaction type: "Barter/Trade"
- Two-sided entry (both income and expense)
- Fair market value (FMV) required for both sides
- Description of goods/services exchanged
- Parties involved (customer/vendor, optional)
- Date of exchange

**Barter Indicator:**
- Clear "Barter" label on transaction
- Icon or badge on transaction list
- Filter transactions by barter type
- Barter transactions highlighted in reports

**Acceptance Criteria:**
- [ ] Barter transaction type creates correctly
- [ ] Both income and expense recorded
- [ ] FMV required fields enforced
- [ ] Barter indicator displays
- [ ] Filter by barter works

---

#### FR-2: Fair Market Value Entry
**Priority:** Critical

**ADDED Requirements:**

The system SHALL require fair market value:

**FMV Fields:**
- FMV of service/goods received (what you got)
- FMV of service/goods provided (what you gave)
- Category/account for received item (expense account)
- Category/account for provided item (income account)
- Notes field for valuation explanation

**FMV Validation:**
- Both FMVs required (cannot be $0)
- Warning if FMVs differ significantly (>10%)
- Suggestion: "In a fair barter, both sides should have equal value"
- Educational tooltip about FMV determination
- Examples of FMV sources (market rates, comparable sales)

**FMV Educational Content:**
- "Fair Market Value is what someone would pay in a normal sale"
- "Use market rates, your standard pricing, or comparable sales"
- "Document your FMV reasoning for tax purposes"
- Link to IRS guidance on FMV

**Acceptance Criteria:**
- [ ] FMV fields required
- [ ] Validation warnings display
- [ ] Educational content accessible
- [ ] FMV values save correctly
- [ ] Notes field captures reasoning

---

#### FR-3: Automatic Offsetting Entries
**Priority:** Critical

**ADDED Requirements:**

The system SHALL generate offsetting journal entries:

**Double-Entry Structure:**
- Debit: Expense account (service/goods received) - FMV received
- Credit: Income account (service/goods provided) - FMV provided
- Both at fair market value
- No cash movement (neither debit nor credit cash)
- Balanced entry (debits = credits)

**Entry Generation:**
- Automatic journal entry creation on save
- Preview before posting
- Edit capability before posting
- Link to barter transaction metadata
- Audit trail of barter entries

**Entry Display:**
- Show both sides clearly
- Label as "Barter Income" and "Barter Expense"
- FMV amounts displayed
- Exchange description in memo
- Link to original barter transaction

**Acceptance Criteria:**
- [ ] Offsetting entries generate correctly
- [ ] Debits equal credits
- [ ] No cash accounts involved
- [ ] Preview displays correctly
- [ ] Audit trail maintained

---

#### FR-4: Barter Income/Expense Tracking
**Priority:** High

**ADDED Requirements:**

The system SHALL track barter separately:

**Barter Tracking:**
- Barter income tracked separately from cash income
- Barter expenses tracked separately from cash expenses
- Year-to-date barter totals
- Barter activity by category
- Barter activity by party (customer/vendor)

**Barter Reports:**
- Barter Activity Report (new)
  - All barter transactions
  - Total barter income
  - Total barter expenses
  - Net barter activity
  - Group by category, party, date
- Include barter in standard reports (P&L, etc.)
- Filter option: "Include/Exclude Barter"

**Tax Reporting:**
- Barter income included in taxable income
- Barter expenses included in deductible expenses (if qualified)
- 1099-B tracking (if barter exchange involved)
- Year-end barter summary for tax prep

**Acceptance Criteria:**
- [ ] Barter tracked separately
- [ ] Barter Activity Report displays
- [ ] Year-to-date totals accurate
- [ ] Standard reports include barter
- [ ] Tax reporting includes barter

---

#### FR-5: 1099-B Guidance and Compliance
**Priority:** Medium

**ADDED Requirements:**

The system SHALL provide 1099-B guidance:

**1099-B Requirements (US):**
- Barter exchanges >$1 require 1099-B reporting
- If barter exchange (middleman) involved
- Parties to exchange must be identified
- FMV must be reported
- Due by January 31 (following year)

**1099-B Features:**
- Identify barter exchange transactions (flag)
- Track FMV for 1099-B reporting
- 1099-B summary report
- List all barter exchanges >$1
- Export for tax software or accountant

**Educational Content:**
- "What is a 1099-B?"
- "Do I need to issue a 1099-B?"
- "What's a barter exchange?" (vs. direct barter)
- Link to IRS Publication 525 (Taxable and Nontaxable Income)
- Link to IRS Form 1099-B instructions

**Acceptance Criteria:**
- [ ] 1099-B transactions flagged
- [ ] FMV tracked for reporting
- [ ] 1099-B summary report available
- [ ] Educational content accessible
- [ ] Export functionality works

---

### Non-Functional Requirements

#### NFR-1: Accuracy
**Priority:** Critical

**ADDED Requirements:**
- Double-entry must balance (debits = credits)
- FMV values validated (cannot be $0)
- No cash accounts involved
- Barter income and expense tracked correctly
- 1099-B reporting accurate

#### NFR-2: Education
**Priority:** High

**ADDED Requirements:**
- Plain English explanations
- Examples of barter scenarios
- FMV determination guidance
- Tax implications clearly explained
- Links to authoritative sources (IRS)

#### NFR-3: Compliance
**Priority:** High

**ADDED Requirements:**
- Barter income treated as taxable (US rules)
- 1099-B guidance accurate and up-to-date
- FMV documentation captured (notes field)
- Audit trail for all barter transactions
- Export for tax preparation

---

## Use Cases

**Use Case 1: Service Exchange**
- Graphic designer trades logo design for accounting services
- Designer enters barter transaction:
  - Received: Accounting services (FMV $500) → Expense: Professional Services
  - Provided: Logo design (FMV $500) → Income: Design Services
- System creates offsetting entry (Debit Professional Services, Credit Design Services)
- Both income and expense recorded, no cash involved

**Use Case 2: Goods Exchange**
- Bakery trades bread for plumbing repair
- Bakery enters barter transaction:
  - Received: Plumbing repair (FMV $200) → Expense: Repairs & Maintenance
  - Provided: Bread (FMV $200) → Income: Sales
- System creates entry, barter income is taxable

**Use Case 3: Unequal Exchange**
- User enters barter with FMVs: Received $500, Provided $400
- System warns: "FMVs differ by 25%. In a fair barter, both sides should be equal value."
- User adjusts or provides explanation in notes

---

## Success Metrics
- 15%+ of businesses record barter transactions
- Zero barter double-entry errors
- >4.0 ease-of-use rating
- 90%+ barter transactions include FMV notes
- 80% reduction in barter accounting errors
- 70%+ users find educational content helpful
