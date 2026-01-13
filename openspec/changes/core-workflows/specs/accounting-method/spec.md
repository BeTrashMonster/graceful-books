# Cash vs. Accrual Accounting Method - Capability Specification

**Capability ID:** `accounting-method`
**Related Roadmap Items:** F8
**SPEC Reference:** ACCT-010
**Status:** In Development

## Overview

The Accounting Method toggle enables users to switch between cash basis and accrual basis accounting, with all reports automatically adjusting to the selected method. Educational content helps users understand the differences and choose the right method.

## ADDED Requirements


### Functional Requirements

#### FR-1: Method Selection
**Priority:** Critical

**ADDED Requirements:**

The system SHALL support method selection:

**Method Options:**
- Cash Basis: Income when received, expenses when paid
- Accrual Basis: Income when earned, expenses when incurred

**Selection Interface:**
- Clear explanation of each method
- Visual comparison examples
- Current method prominently displayed
- Method indicator on all reports

**Educational Content:**
- When to use cash basis
- When to use accrual basis
- Tax implications overview
- Recommendation to consult CPA

**Acceptance Criteria:**
- [ ] Method selection works
- [ ] Explanations clear and accurate
- [ ] Current method always visible
- [ ] Educational content helpful

---

#### FR-2: Switching Methods
**Priority:** Critical

**ADDED Requirements:**

The system SHALL handle method switching:

**Switching Process:**
- Warning about implications
- Confirm dialog with clear messaging
- No data loss
- Historical reports available in both methods

**Warnings:**
- "Switching methods affects how reports calculate..."
- "Consult your accountant before switching"
- "You can switch back anytime"
- Impact preview (how reports will change)

**Acceptance Criteria:**
- [ ] Warnings clear and appropriate
- [ ] No data loss on switch
- [ ] Switch completes successfully
- [ ] Reports recalculate correctly

---

#### FR-3: Report Behavior
**Priority:** Critical

**ADDED Requirements:**

All reports SHALL adjust to selected method:

**Cash Basis Reports:**
- Revenue = cash received
- Expenses = cash paid
- Ignores unpaid invoices
- Ignores unpaid bills

**Accrual Basis Reports:**
- Revenue = invoices issued
- Expenses = bills received
- Includes unpaid invoices (A/R)
- Includes unpaid bills (A/P)

**Report Indicators:**
- Method clearly stated on every report
- Option to view in "other" method
- Comparison between methods
- Historical access in both methods

**Acceptance Criteria:**
- [ ] Reports accurate for both methods
- [ ] Method indicator on all reports
- [ ] Comparison view works
- [ ] Historical data accessible

---

#### FR-4: Guidance and Education
**Priority:** High

**ADDED Requirements:**

The system SHALL provide method guidance:

**Business Type Guidance:**
- Inventory businesses → Accrual recommended
- Service businesses → Either method OK
- Large businesses → Accrual required
- Context-aware recommendations

**Tax Implications:**
- IRS allows both (with restrictions)
- Consistency important
- Election process explained
- CPA consultation recommended

**Examples:**
- Side-by-side comparison
- Same data, both methods
- Visual differences highlighted
- Plain English explanations

**Acceptance Criteria:**
- [ ] Guidance appropriate for business type
- [ ] Tax implications clear
- [ ] Examples helpful
- [ ] Recommendations actionable

---

### Non-Functional Requirements

#### NFR-1: Performance
**Priority:** High

**ADDED Requirements:**
- Report recalculation <3 seconds
- Method switch completes instantly
- No performance degradation
- Support both methods simultaneously

#### NFR-2: GAAP Compliance
**Priority:** Critical

**ADDED Requirements:**
- Both methods GAAP-compliant
- Proper revenue recognition (accrual)
- Proper expense matching (accrual)
- Cash method simplicity maintained

---

## Success Metrics
- 80%+ users understand their method
- <5% method switches per month (indicates stable choice)
- >4.5 guidance helpfulness rating
- Zero GAAP compliance issues
