# Moonshot Features (Phase 5 - Group J: Reaching for the Stars)

## Why This Change

This change introduces visionary features that push the boundaries of accounting software. After establishing advanced collaboration and sync capabilities in Group I, and completing the Infrastructure Capstone (IC0-IC6), businesses are ready for next-generation features: 2D financial visualization, smart automation assistant, scenario planning, key financial metrics reports, goal tracking, emergency fund & runway calculator, advisor portal with billing, tax preparation workflows, and CSV import/export.

**Dependencies:** Requires Infrastructure Capstone completion
- IC0: Group I Backend Validation (GATE - must pass before IC1)
- IC1: Complete Group I UI Components (CRDT, Activity Feed)
- IC2: Billing Infrastructure (Stripe integration, tiered pricing)
- IC3: Admin Panel & Charity Management
- IC4: Email Service Infrastructure
- IC5: OpenSpec Documentation Synchronization
- IC6: Infrastructure Capstone Final Validation (GATE - must pass before Group J)

**Also Requires Group I:**
- CRDT Conflict Resolution (I1)
- Activity Feed (I2)
- Comments on Transactions (I3)
- Multi-Currency - Full (I4)
- Barter/Trade Transactions (I5)
- Scheduled Report Delivery (I6)

**Target Users:**
- Visual learners wanting 2D financial visualization (not 3D - accessibility focus)
- Busy entrepreneurs wanting AI that does work for them (not AI that pushes opinions)
- Accountants/advisors needing professional scenario modeling tools
- Business owners tracking key financial metrics with accountant guidance
- Goal-oriented entrepreneurs tracking financial objectives
- Startups and bootstrappers monitoring runway and emergency funds
- Businesses collaborating with advisors/accountants (billing model enabled by IC2)
- Tax-compliant businesses wanting calm, guided tax prep workflows
- Users needing CSV import/export (no external API integrations)
- Developers and power users requiring testing infrastructure

**Success Metrics:**
- 25%+ of users enable 2D financial flow widget
- 35%+ of users benefit from smart automation assistant (categorization, reconciliation matching)
- 15%+ of accountants use scenario planner tool
- 10%+ of accountants share key metrics reports with clients
- 30%+ of users set financial goals
- 20%+ of startups/bootstrappers monitor runway calculator
- 10%+ of users invite advisors (J7 portal with billing via IC2)
- 30%+ of users use tax prep mode during tax season
- 40%+ of users import/export via CSV
- 100% test coverage for Group J features (J11/J12 gates)

**Research-Driven Design Decisions:**
- J1: 3D → 2D widget (accessibility concerns, performance, complexity vs. benefit)
- J2: AI insights → Smart automation assistant (G2 Research: auto-categorization scores 5.2-5.46/7, chatbot insights score 4.78/7)
- J4: Health score → Key metrics reports (reductive scores are judgmental, professionals need raw data)
- J6: Simple calculator → Comprehensive runway tool (75+ criteria, dual-slider interface for revenue + expenses)
- J7: Basic portal → Full billing model (pricing tiers, team management enabled by IC2)
- J9: API integrations → CSV import/export (architecture shift, zero-knowledge compatibility)
- Removed: J10-J13 (mobile app, public API) - scope reduction, focus on core web experience

## Roadmap Reference

**Phase:** Phase 5: Reaching for the Stars (Moonshots)
**Group:** Group J - Moonshot Features
**Roadmap Items:** J1-J12 (Financial Flow Widget, Smart Automation Assistant, Scenario Planner, Key Metrics Reports, Goal Setting & Tracking, Emergency Fund & Runway Calculator, Advisor Portal, Tax Time Preparation Mode, CSV Import/Export, CSV Testing Environment, Comprehensive Tests for Group J, Run All Tests and Verify 100% Pass Rate)
**Roadmap Location:** [Roadmaps/ROADMAP.md - Phase 5, Group J](../../Roadmaps/ROADMAP.md#group-j---moonshots-requires-infrastructure-capstone-complete)
**Priority:** Nice-to-have (J1-J9), MVP/Mandatory (J10-J12 testing infrastructure)

## What Changes

This proposal introduces twelve moonshot items (9 features + 3 testing/quality gates):

### Feature Items (J1-J9):

**J1. Financial Flow Widget** (Nice)
- **2D animated node-based visualization** (not 3D)
- 6 primary nodes (Assets, Liabilities, Equity, Revenue, COGS, Expenses)
- Animated transaction flows showing money movement
- Compact widget (upper-right corner) with full-screen expansion
- Ecosystem toggle (Active Only vs. Full Ecosystem view)
- Date range selector (Last 365 days default, custom range option)
- Color customization (hex picker, presets)
- Time-lapse playback mode
- Barter transaction support (I5 integration, bidirectional arrows)
- Solid vs. dashed lines (cash vs. accrual differentiation)
- Health indicators (color-coded financial status)
- Accessibility descriptions (screen reader compatible)
- **No 3D, No WebGL** - Pure SVG/Canvas 2D for performance and accessibility

**J2. Smart Automation Assistant** (Nice)
- **AI that does tedious work, not AI that pushes opinions**
- Smart categorization (learns from user patterns)
- Intelligent reconciliation matching (probable matches beyond exact amounts)
- Subtle anomaly flagging (no alarms, no judgment)
- On-demand cash flow projection (user-initiated, not pushed)
- Vendor/customer pattern memory (invisible efficiency)
- Per-feature disable toggles (user control)
- **100% local processing** (zero external data transmission)
- **No chatbot interface, no proactive insights, no unsolicited recommendations**

**J3. Building the Dream Scenarios** (Nice)
- **Professional-grade scenario modeling tool for accountants**
- Pull live book data as baseline (P&L, Balance Sheet, Cash, operational data)
- Scenario templates (reclassify employee to owner, add/remove employee, change pricing, etc.)
- Freeform adjustments (spreadsheet-like flexibility)
- Accounting-aware impact calculation (double-entry relationships understood)
- Interactive results view (side-by-side: Current | Adjustment | Projected)
- Push to client workflow (accountant-composed email, interactive link)
- Notes/annotations (accountant explains context)
- Client can explore (read-only or permitted adjustments)
- **Not gatekept** - any user can access, but designed for professional knowledge level

**J4. Key Financial Metrics Reports** (Nice)
- **Professional reporting tool for accountants** (not a score)
- 4 core reports: Liquidity, Profitability, Efficiency, Leverage
- Summary dashboard (all key metrics on one page)
- Trend visualization (metric movement over time)
- Period comparison (this quarter vs. last quarter, YoY, custom)
- Plain-English explanations (helps accountant explain to client)
- Notes field (accountant adds interpretation/context)
- Accountant-controlled sharing (decides if/when to share)
- Export options (PDF, Excel, shareable link)
- Barter revenue support (I5 integration, toggle to include/exclude)
- **No 0-100 score, no gamification, no unsolicited recommendations**

**J5. Financial Goals** (Nice)
- Set and track financial goals
- Goal types (revenue, profit, expense reduction, savings, debt reduction, A/R reduction)
- Target amount and timeframe
- Progress visualization (progress bar, chart)
- Milestone notifications (celebrate achievements)
- Goal history and achievement tracking
- Connect goals to checklist items
- **Not gamified** - supportive progress tracking, not competitive scoring

**J6. Emergency Fund & Runway Calculator** (Nice)
- **Comprehensive runway calculator** (not simple calculator)
- 3 calculation methods (Simple Average, Trend-Adjusted, Seasonal)
- Net burn calculation (revenue - expenses)
- **Dual-slider interface** (adjust both revenue and expenses)
- Revenue breakdown (see which clients/products drive revenue)
- Expense flexibility modeling
- Scenario modeling (revenue + expense scenarios combined)
- Emergency fund recommendations (contextualized to business type)
- Date range selector (Last 30/90/365 days, YTD, custom)
- **Inactive by default** - user activates when ready
- **No unsolicited notifications** - calm, actionable planning information
- **75+ acceptance criteria** (expanded scope from original concept)

**J7. Mentor/Advisor Portal** (Nice)
- **Full billing model** (enabled by IC2 Billing Infrastructure)
- **Pricing tiers:**
  - Starter: $15/month (up to 5 clients, up to 3 users per client)
  - Professional: $100/month (up to 50 clients, up to 10 users per client)
  - Enterprise: $300/month (unlimited clients, unlimited users)
- Advisor dashboard (client list, team management)
- Client lifecycle (invite, manage, remove)
- Permission levels (View-Only, Bookkeeper, Manager, Admin)
- Client portal access (advisor-granted permissions)
- Charity selection (advisor selects charity for monthly contribution - IC3)
- Billing transfer (client subscription canceled when added to advisor - IC2)
- Team management (add/remove team members with role assignments)
- Integration with IC4 (email notifications for invitations, billing changes)

**J8. Tax Time Preparation Mode** (Nice)
- **Calm, guided tax preparation workflow**
- 6-step process (Business Structure → Income → Expenses → Deductions → Review → Export)
- Business structure selection (Sole Proprietor, Partnership, S-Corp, C-Corp, LLC)
- No jargon - plain English throughout
- Steadiness communication style (patient, supportive, step-by-step)
- Integration with J7 (advisor access to tax dashboard)
- Email notifications via IC4 (tax season access granted, tax prep completion)
- Export tax package (formatted for accountant or tax software)
- **Not automated tax filing** - preparation and organization tool

**J9. CSV Import/Export** (Nice)
- **Client-side processing** (zero-knowledge compatible)
- Smart column detection (auto-map CSV columns to fields)
- Import templates (QuickBooks, Xero, FreshBooks, generic)
- Duplicate detection (warn before importing duplicates)
- Preview before import (review data before committing)
- Validation (required fields, data types, relationships)
- Error handling (invalid data, missing references)
- Export customization (select entities, date ranges, columns)
- Export formats (CSV, Excel)
- **No external API integrations** (architecture shift from original concept)

### Testing & Quality Gates (J10-J12):

**J10. CSV Import/Export Testing Environment** [MVP] [INFRASTRUCTURE]
- Dedicated testing infrastructure for J9 CSV features
- Test fixtures (sample CSV files for all import templates)
- Edge case testing (malformed CSVs, encoding issues, large files)
- Performance testing (10K+ row imports)
- Validation testing (duplicate detection accuracy)

**J11. Write Comprehensive Tests for Group J Features** [MVP] [MANDATORY]
- Unit tests for all J1-J9 components and services
- Integration tests for cross-feature workflows
- E2E tests for complete user journeys
- Accessibility testing (WCAG 2.1 AA compliance)
- Performance testing (page load, operation speed)
- **Target: 100% test coverage for Group J**

**J12. Run All Tests and Verify 100% Pass Rate** [MVP] [MANDATORY]
- Execute all Group J test suites
- Verify 100% pass rate (0 failures)
- Performance validation (meet targets from ROADMAP)
- Security validation (input sanitization, XSS prevention)
- Accessibility validation (screen reader compatibility)
- **GATE: Group J cannot be marked complete until this passes**

## Impact Analysis

**Positive Impacts:**
- Completes Graceful Books vision with moonshot features
- Provides visual, interactive financial understanding (J1 widget)
- Reduces tedious bookkeeping work with smart automation (J2)
- Enables professional accountant-client collaboration (J3, J4, J7)
- Helps entrepreneurs plan and track goals (J5, J6)
- Simplifies tax season stress (J8)
- Allows data portability and migration (J9)
- Ensures quality with comprehensive testing (J10-J12)
- Differentiates Graceful Books from competitors with unique features

**Risks:**
- J1: Animation performance degrades with high transaction volume
  - Mitigation: Animation queue with batching, requestAnimationFrame optimization, Web Workers
- J2: AI suggestions become annoying or inaccurate
  - Mitigation: Subtle presentation, easy dismissal, high confidence thresholds, granular disable options
- J3: Complex scenario modeling confuses non-accountant users
  - Mitigation: Clear labeling as professional tool, templates simplify common scenarios
- J4: Metrics misinterpreted by business owners without accountant context
  - Mitigation: Accountant-controlled sharing only, notes field for context
- J6: Runway calculator creates anxiety instead of confidence
  - Mitigation: Inactive by default, calm tone, actionable information not fear-based
- J7: Billing model complexity confuses advisors
  - Mitigation: Clear pricing tiers, automatic tier upgrades, proration handled transparently
- J8: Tax prep workflow oversimplifies complex tax situations
  - Mitigation: Clear disclaimer, preparation tool not tax advice, export to professional
- J9: CSV import creates duplicate data or corrupts books
  - Mitigation: Duplicate detection, preview before import, validation warnings
- J10-J12: Testing infrastructure slows down development
  - Mitigation: Tests written alongside features, automated CI/CD pipeline

**Technical Debt:**
- None - Group J is additive, no refactoring of existing features required

**Migration Concerns:**
- None - all features are opt-in and do not affect existing data

## Files Changed

### New Files
- `src/components/visualization/FinancialFlowWidget.tsx` (J1)
- `src/services/smartAutomation.service.ts` (J2)
- `src/components/scenarios/ScenarioPlanner.tsx` (J3)
- `src/components/metrics/KeyMetricsReports.tsx` (J4)
- `src/components/goals/GoalTracker.tsx` (J5)
- `src/components/runway/RunwayCalculator.tsx` (J6)
- `src/components/advisor/AdvisorPortal.tsx` (J7 - uses IC2 billing)
- `src/components/tax/TaxPrepMode.tsx` (J8 - uses IC4 email)
- `src/services/csvImport.service.ts` (J9)
- `src/services/csvExport.service.ts` (J9)
- `tests/csv/` (J10 - CSV testing fixtures and infrastructure)
- `e2e/groupJ/` (J11 - E2E tests for all J1-J9 features)
- `openspec/changes/moonshot-features/specs/CSV-001/spec.md` (new)
- `openspec/changes/moonshot-features/specs/SCENARIO-001/spec.md` (new)
- `openspec/changes/moonshot-features/specs/METRICS-001/spec.md` (renamed from HEALTH-001)

### Modified Files
- `openspec/changes/moonshot-features/proposal.md` (this file - rewritten)
- `openspec/changes/moonshot-features/tasks.md` (updated to match J1-J12)
- `openspec/changes/moonshot-features/specs/VIZ-001/spec.md` (updated for 2D widget)
- `openspec/changes/moonshot-features/specs/AI-001/spec.md` (updated for smart automation)
- `openspec/changes/moonshot-features/specs/RUNWAY-001/spec.md` (updated for expanded scope)
- `openspec/changes/moonshot-features/specs/MENTOR-001/spec.md` (updated for billing model)
- `openspec/changes/moonshot-features/specs/TAX-001/spec.md` (updated for J8 workflow)
- `openspec/changes/moonshot-features/specs/GOAL-001/spec.md` (verified/updated for J5)

### Deleted Files
- `openspec/changes/moonshot-features/specs/MOBILE-001/` (feature removed from roadmap)
- `openspec/changes/moonshot-features/specs/FUTURE-001/` (public API removed from roadmap)
- `openspec/changes/moonshot-features/specs/INTEG-001/` (replaced by CSV-001)
- `openspec/changes/moonshot-features/specs/HEALTH-001/` (renamed to METRICS-001)

## Testing Strategy

### J1 (Financial Flow Widget)
- Unit tests: Flow direction logic, node sizing calculations, animation queue
- Visual regression testing: Node positioning, color schemes
- Performance testing: 10K+ transactions, animation smoothness
- Accessibility testing: Screen reader descriptions, keyboard navigation

### J2 (Smart Automation Assistant)
- Unit tests: Categorization accuracy, reconciliation matching, anomaly detection
- Machine learning validation: Accuracy improves over time (learning loop)
- Privacy verification: Zero external data transmission
- Performance testing: Suggestion generation <200ms

### J3 (Building the Dream Scenarios)
- Unit tests: Scenario calculations, double-entry impacts, baseline refresh
- Integration tests: Live book data pull, client push workflow
- E2E tests: Accountant creates scenario → pushes to client → client views

### J4 (Key Financial Metrics Reports)
- Unit tests: Metric calculations (liquidity, profitability, efficiency, leverage)
- Integration tests: Report generation, period comparison, export (PDF, Excel)
- Accuracy validation: Cross-reference with manual calculations

### J5 (Financial Goals)
- Unit tests: Goal calculations, progress tracking, milestone detection
- Integration tests: Goal creation, update, achievement
- E2E tests: User sets goal → tracks progress → achieves goal

### J6 (Emergency Fund & Runway Calculator)
- Unit tests: Runway calculations (3 methods), net burn calculation, scenario modeling
- Accuracy validation: Cross-reference with manual calculations
- E2E tests: User activates runway calculator → models scenarios → adjusts assumptions

### J7 (Mentor/Advisor Portal)
- Unit tests: Billing calculations (tiered pricing), client lifecycle management
- Integration tests: IC2 billing integration, IC4 email notifications
- E2E tests: Advisor invites client → client accepts → billing transfer → advisor manages team
- Security testing: Permission levels, RBAC enforcement

### J8 (Tax Time Preparation Mode)
- Unit tests: Business structure logic, income/expense categorization
- Integration tests: IC4 email notifications, J7 advisor access
- E2E tests: User completes 6-step workflow → exports tax package

### J9 (CSV Import/Export)
- Unit tests: CSV parsing, column detection, duplicate detection, validation
- Integration tests: Import workflow, export customization
- E2E tests: User imports CSV → reviews preview → confirms import
- Performance testing: 10K+ row imports (J10 infrastructure)
- Edge case testing: Malformed CSVs, encoding issues (J10 infrastructure)

### J10-J12 (Testing Infrastructure & Quality Gates)
- J10: CSV test fixtures, performance testing, edge case testing
- J11: Comprehensive test writing (unit, integration, E2E, accessibility, performance)
- J12: Test execution, validation, gate pass/fail decision

## Rollout Plan

### Phase 1: Infrastructure Capstone (Pre-Requisite)
- Complete IC0-IC6 (must pass IC6 validation gate before Group J begins)
- Verify IC2 billing infrastructure operational (required for J7)
- Verify IC4 email service operational (required for J3, J7, J8)

### Phase 2: J1-J3 (Visual & Professional Tools) - 3-4 weeks
- J1: Build Financial Flow Widget (2D visualization, animation system)
- J2: Build Smart Automation Assistant (categorization, reconciliation, anomaly detection)
- J3: Build Scenario Planner (accountant tool, live book data, client push)
- Parallel work: All three can be developed simultaneously by different devs

### Phase 3: J4-J6 (Metrics & Planning Tools) - 3-4 weeks
- J4: Build Key Metrics Reports (4 core reports, accountant-controlled sharing)
- J5: Build Goal Tracker (goal types, progress tracking, milestone notifications)
- J6: Build Runway Calculator (3 methods, dual-slider, scenario modeling)
- Parallel work: All three can be developed simultaneously by different devs

### Phase 4: J7-J9 (Collaboration & Data Tools) - 3-4 weeks
- J7: Build Advisor Portal (billing model via IC2, team management, client lifecycle)
- J8: Build Tax Prep Mode (6-step workflow, J7 integration, IC4 email notifications)
- J9: Build CSV Import/Export (client-side processing, smart detection, templates)
- Parallel work: J7 and J8 depend on IC2/IC4, J9 can be developed independently

### Phase 5: J10-J12 (Testing & Quality Assurance) - 2-3 weeks
- J10: Build CSV testing infrastructure (fixtures, edge cases, performance tests)
- J11: Write comprehensive tests for J1-J9 (unit, integration, E2E, accessibility, performance)
- J12: Run all tests, validate, fix issues, re-test until 100% pass rate
- **GATE: Group J cannot be marked complete until J12 passes**

### Phase 6: Production Deployment - 1 week
- Deploy J1-J9 to production
- Monitor for issues
- Announce Group J completion
- Celebrate moonshot achievement!

**Total Estimated Timeline:** 12-16 weeks for complete Group J (assuming IC0-IC6 complete)

## Success Criteria

**J1: Financial Flow Widget**
- [ ] Widget renders in upper-right corner
- [ ] Six primary nodes display with proportional sizing
- [ ] Animated transaction flows between nodes
- [ ] Ecosystem toggle (Active Only / Full Ecosystem)
- [ ] Date range selector functional
- [ ] Color customization panel accessible
- [ ] Time-lapse mode plays smoothly
- [ ] Barter transactions display as bidirectional arrows (I5 integration)
- [ ] Accessibility compliant (screen reader, keyboard navigation)
- [ ] Performance: Smooth with 10K+ transactions

**J2: Smart Automation Assistant**
- [ ] Smart categorization accuracy 80%+ after 100 transactions
- [ ] Reconciliation matching surfaces probable matches
- [ ] Anomaly flagging <10% false positive rate
- [ ] Cash flow projection available on-demand
- [ ] Vendor/customer patterns pre-fill forms
- [ ] All AI features individually disable-able
- [ ] Zero external data transmission verified
- [ ] Performance: Suggestions <200ms

**J3: Building the Dream Scenarios**
- [ ] Baseline pulls live book data (P&L, Balance Sheet, Cash)
- [ ] Scenario templates available and functional
- [ ] Freeform adjustments work (spreadsheet-like)
- [ ] Accounting-aware impact calculation
- [ ] Interactive results view (side-by-side comparison)
- [ ] Push to client workflow functional (IC4 email integration)
- [ ] Client can explore scenario (read-only or permitted)

**J4: Key Financial Metrics Reports**
- [ ] 4 core reports generate accurately (Liquidity, Profitability, Efficiency, Leverage)
- [ ] Summary dashboard displays all key metrics
- [ ] Trend visualization shows metric movement
- [ ] Period comparison allows flexible date ranges
- [ ] Plain-English explanations available
- [ ] Accountant can add notes before sharing
- [ ] Export to PDF and Excel functional
- [ ] Barter revenue included in profitability (I5 integration)

**J5: Financial Goals**
- [ ] Goal creation supports all types (revenue, profit, expense, savings, debt, A/R)
- [ ] Progress tracking updates in real-time
- [ ] Progress visualization displays correctly
- [ ] Milestone notifications trigger
- [ ] Goal history accessible
- [ ] Connect goals to checklist items

**J6: Emergency Fund & Runway Calculator**
- [ ] 3 calculation methods available (Simple, Trend-Adjusted, Seasonal)
- [ ] Net burn calculation accurate (revenue - expenses)
- [ ] Dual-slider interface functional (adjust revenue and expenses)
- [ ] Revenue breakdown displays
- [ ] Scenario modeling works (revenue + expense scenarios)
- [ ] Emergency fund recommendations contextualized
- [ ] Date range selector functional
- [ ] Inactive by default (user activates)

**J7: Mentor/Advisor Portal**
- [ ] Pricing tiers functional (Starter/Professional/Enterprise via IC2)
- [ ] Advisor dashboard displays client list
- [ ] Client lifecycle management (invite, manage, remove)
- [ ] Permission levels enforced (View-Only, Bookkeeper, Manager, Admin)
- [ ] Client portal access controlled by advisor
- [ ] Charity selection functional (IC3 integration)
- [ ] Billing transfer works (client subscription canceled - IC2)
- [ ] Team management functional (add/remove with roles)
- [ ] Email notifications sent (IC4 integration)

**J8: Tax Time Preparation Mode**
- [ ] 6-step workflow functional
- [ ] Business structure selection available
- [ ] No jargon - plain English throughout
- [ ] Steadiness communication style consistent
- [ ] J7 integration (advisor access to tax dashboard)
- [ ] Email notifications sent (IC4 integration)
- [ ] Export tax package functional

**J9: CSV Import/Export**
- [ ] Client-side processing verified (zero-knowledge compatible)
- [ ] Smart column detection works
- [ ] Import templates available (QuickBooks, Xero, FreshBooks, generic)
- [ ] Duplicate detection warns before import
- [ ] Preview before import functional
- [ ] Validation catches errors (required fields, data types)
- [ ] Error handling displays clearly
- [ ] Export customization functional (entities, date ranges, columns)
- [ ] Export formats work (CSV, Excel)

**J10: CSV Import/Export Testing Environment**
- [ ] Test fixtures created (sample CSVs for all templates)
- [ ] Edge case tests written (malformed CSVs, encoding issues)
- [ ] Performance tests written (10K+ row imports)
- [ ] Validation tests written (duplicate detection accuracy)

**J11: Write Comprehensive Tests for Group J Features**
- [ ] Unit tests written for all J1-J9 components and services
- [ ] Integration tests written for cross-feature workflows
- [ ] E2E tests written for complete user journeys
- [ ] Accessibility tests written (WCAG 2.1 AA compliance)
- [ ] Performance tests written (page load, operation speed)
- [ ] Test coverage 100% for Group J

**J12: Run All Tests and Verify 100% Pass Rate**
- [ ] All Group J test suites executed
- [ ] 100% pass rate achieved (0 failures)
- [ ] Performance targets met (from ROADMAP)
- [ ] Security validation passed (input sanitization, XSS prevention)
- [ ] Accessibility validation passed (screen reader compatibility)
- [ ] **GATE PASSED: Group J marked complete**

## Questions & Assumptions

**Questions:**
- Should J1 widget be dismissible/collapsible, or always visible?
- Should J2 AI features require opt-in, or be enabled by default with opt-out?
- Should J3 scenario templates be expandable by users, or fixed set?
- Should J4 metrics reports include industry benchmarks (if data available)?
- Should J7 advisor portal allow sub-advisors (advisor invites another advisor)?
- Should J8 tax prep mode integrate with external tax software APIs, or export only?
- Should J9 CSV import support multi-entity imports (import for multiple books at once)?

**Assumptions:**
- Infrastructure Capstone (IC0-IC6) is 100% complete before Group J begins
- IC2 billing infrastructure is operational and tested
- IC4 email service is operational and tested
- Group I backends (I1, I2) are 100% complete and tested
- Barter/Trade Transactions (I5) is complete for J1/J4 integration
- J7 advisor portal uses IC2 billing model (Starter/Professional/Enterprise tiers)
- J3, J7, J8 use IC4 email service for notifications
- J9 CSV import/export is client-side only (no external APIs)
- J10-J12 testing infrastructure ensures 100% quality before Group J completion
- All Group J features are opt-in (user activates when ready)

## Related Changes

**Depends On:**
- Infrastructure Capstone (IC0-IC6) - MANDATORY prerequisite
- Group I (I1-I6) - Backend and UI complete

**Enables:**
- Complete Graceful Books feature set (all phases complete)
- Differentiation from competitors with unique moonshot features
- Professional accountant-client collaboration (J3, J4, J7)
- Revenue generation via J7 advisor portal billing model

**Blocks:**
- None - Group J is the final group in the roadmap
