# Tax Preparation Mode - Capability Specification

**Capability ID:** `tax-prep-mode`
**Related Roadmap Items:** J8
**SPEC Reference:** TAX-001
**Status:** Planned (Phase 5)

## Overview

Tax Preparation Mode provides a guided workflow for tax season with document checklists, missing information detection, tax-ready report bundles, and accountant export packages.

## ADDED Requirements


### Functional Requirements

#### FR-1: Tax Prep Workflow and Checklist
**Priority:** High

**ADDED Requirements:**
- "Start Tax Prep" activation (seasonal)
- Documents checklist (1099s, W-2s, receipts, mileage log, bank statements)
- Missing information identification (uncategorized transactions, unreconciled accounts)
- Progress tracker (% ready for taxes)

**Acceptance Criteria:**
- [ ] Workflow activates correctly
- [ ] Checklist comprehensive
- [ ] Missing info detected accurately
- [ ] Progress tracker updates

---

#### FR-2: Report Bundle and Accountant Export
**Priority:** Critical

**ADDED Requirements:**
- Tax-ready report bundle (P&L, Balance Sheet, 1099 summary, etc.) in ZIP
- Accountant export (QBO, IIF, CSV formats)
- Deduction suggestions (educational, not tax advice)
- Export completeness <30 seconds

**Acceptance Criteria:**
- [ ] Bundle includes all reports
- [ ] Export formats valid
- [ ] Deduction suggestions helpful
- [ ] Export completes quickly

---

## Success Metrics
- 40%+ users use tax prep mode
- >95% export completeness
- 30% reduction in tax prep time
