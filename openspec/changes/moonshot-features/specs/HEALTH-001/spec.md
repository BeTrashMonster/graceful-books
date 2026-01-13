# Financial Health Score - Capability Specification

**Capability ID:** `financial-health-score`
**Related Roadmap Items:** J4
**SPEC Reference:** HEALTH-001
**Status:** Planned (Phase 5)

## Overview

Financial Health Score provides a simple 0-100 score representing overall business health through weighted aggregation of liquidity, profitability, leverage, efficiency, and growth metrics.

## ADDED Requirements


### Functional Requirements

#### FR-1: Score Calculation
**Priority:** Critical

**ADDED Requirements:**
- Liquidity (30%): Current Ratio, Quick Ratio, Cash
- Profitability (25%): Profit Margin, Revenue Growth
- Leverage (20%): Debt-to-Equity, Debt Service Coverage
- Efficiency (15%): A/R Days, A/P Days, Inventory Turnover
- Growth (10%): Revenue Growth, Customer Growth
- Weighted average = 0-100 score

**Acceptance Criteria:**
- [ ] Score calculation accurate
- [ ] Components weighted correctly
- [ ] Score updates on financial changes

---

#### FR-2: Component Breakdown and Recommendations
**Priority:** High

**ADDED Requirements:**
- Show each component score
- Explain calculations
- Highlight strengths and weaknesses
- Specific improvement recommendations
- Prioritize recommendations (high impact)

**Acceptance Criteria:**
- [ ] Breakdown displays correctly
- [ ] Recommendations actionable
- [ ] Prioritization logical

---

### Non-Functional Requirements

#### NFR-1: Performance
- Score calculation <1 second
- Trend chart <2 seconds
- Real-time updates on data change

---

## Success Metrics
- 50%+ users track health score
- >90% score accuracy
- >4.5 usefulness rating
