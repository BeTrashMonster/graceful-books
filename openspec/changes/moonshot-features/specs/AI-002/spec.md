# Scenario Planner - Capability Specification

**Capability ID:** `scenario-planner`
**Related Roadmap Items:** J3
**SPEC Reference:** AI-002
**Status:** Planned (Phase 5)

## Overview

Scenario Planner enables "what-if" modeling by adjusting revenue, expenses, and other variables to see projected impact on financial statements, helping business owners make informed decisions.

## ADDED Requirements


### Functional Requirements

#### FR-1: Scenario Creation and Variable Adjustment
**Priority:** High

**ADDED Requirements:**
- Create named scenarios
- Adjust revenue assumptions (%, fixed amount, new products)
- Adjust expenses (new hires, cost reductions)
- One-time costs (equipment, marketing campaign)
- Loan scenarios (take loan, pay off loan)

**Acceptance Criteria:**
- [ ] Scenarios save correctly
- [ ] Variable adjustments apply accurately
- [ ] Scenarios editable

---

#### FR-2: Projected Impact and Comparison
**Priority:** Critical

**ADDED Requirements:**
- Updated P&L with scenario changes
- Updated Balance Sheet with scenario changes
- Updated Cash Flow with scenario changes
- Side-by-side comparison (current vs. scenario)
- Compare multiple scenarios (A vs. B vs. C)

**Acceptance Criteria:**
- [ ] Projections mathematically correct
- [ ] Comparison displays clearly
- [ ] Key metrics highlighted

---

### Non-Functional Requirements

#### NFR-1: Performance
- Scenario recalculation <2 seconds
- Supports 10+ active scenarios
- Comparison rendering <3 seconds

---

## Success Metrics
- 25%+ users create scenarios
- >4.0 usefulness rating
- Zero calculation errors
