# Runway Calculator - Capability Specification

**Capability ID:** `runway-calculator`
**Related Roadmap Items:** J6
**SPEC Reference:** RUNWAY-001
**Status:** Planned (Phase 5)

## Overview

Runway Calculator tracks business survival time (cash ÷ burn rate), emergency fund recommendations, threshold alerts, and scenario modeling to extend runway.

## ADDED Requirements


### Functional Requirements

#### FR-1: Runway Calculation and Alerts
**Priority:** Critical

**ADDED Requirements:**
- Runway (months) = Current Cash ÷ Monthly Burn Rate
- Color coding (green >6mo, yellow 3-6mo, red <3mo)
- Alerts when runway <3 months, <1 month (critical)
- Emergency fund recommendations (3-6 months expenses)

**Acceptance Criteria:**
- [ ] Runway calculates correctly
- [ ] Alerts trigger on thresholds
- [ ] Emergency fund target accurate

---

#### FR-2: Scenario Modeling for Runway Extension
**Priority:** Medium

**ADDED Requirements:**
- Model expense reduction impact
- Model funding raise impact
- Model revenue drop impact
- Visual runway timeline

**Acceptance Criteria:**
- [ ] Scenarios recalculate runway
- [ ] Timeline visualization clear
- [ ] Recommendations actionable

---

## Success Metrics
- 30%+ startups monitor runway
- >90% calculation accuracy
- 50% find runway alerts helpful
