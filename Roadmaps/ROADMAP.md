# Graceful Books Implementation Roadmap

**Your Journey from Foundation to Flight**

---

```
                              THE GRACEFUL BOOKS JOURNEY

                                        * * *
                                       *     *
                                      * STARS *     <- "Reaching for the Stars"
                                       *     *         (Visionary Features)
                                        * * *
                                          |
                                          |
                                    ,~~~~~~~~~~~.
                                   /   WINGS     \   <- "Spreading Your Wings"
                                  /   (Advanced)  \     (Power Features)
                                 '~~~~~~~~~~~~~~~~~'
                                          |
                                          |
                                   .~~~~~~~~~~~~.
                                  /   RHYTHM     \   <- "Finding Your Rhythm"
                                 /  (Daily Use)   \     (Core Workflows)
                                '~~~~~~~~~~~~~~~~~~'
                                          |
                                          |
                                  .~~~~~~~~~~~~~~.
                                 /  FIRST STEPS   \  <- "First Steps"
                                /   (Onboarding)   \    (Welcome & Setup)
                               '~~~~~~~~~~~~~~~~~~~~'
                                          |
                                          |
                              .~~~~~~~~~~~~~~~~~~~~~.
                             /      FOUNDATION       \ <- "The Foundation"
                            /   (Infrastructure)      \    (Build it Solid)
                           '~~~~~~~~~~~~~~~~~~~~~~~~~~~'
                                        |||
                                     ___|||___
                                    |  START  |
                                    |  HERE!  |
                                    -----------

   Legend:  [MVP] = Must have for launch    [JOY] = Delight opportunity
            (Nice) = Enhancement            {Dep} = Dependency marker
```

---

## OpenSpec Integration

This roadmap has been converted to **OpenSpec format** for better organization and agent-friendly development. Each phase and group now has a corresponding OpenSpec change in the `openspec/changes/` directory.

**Mapping of Roadmap Phases to OpenSpec Changes:**

- Phase 1 Group A → `foundation-infrastructure`
- Phase 1 Group B → `basic-features`
- Phase 1 Group C → `onboarding-and-setup`
- Phase 2 Group D → `guided-setup-experiences`
- Phase 2 Group E → `daily-workflows`
- Phase 3 Group F → `core-workflows`
- Phase 3 Group G → `advanced-accounting`
- Phase 4 Group H → `team-collaboration`
- Phase 4 Group I → `advanced-sync`
- Phase 5 Group J → `moonshot-features`

**Working with OpenSpec Changes:**

- **View all changes:** `openspec list`
- **See change details:** `openspec show <change-name>`
- **Validate a change:** `openspec validate <change-name>`
- **Apply changes (implement):** Use `/openspec:apply <change-name>` or ask AI to implement
- **Archive when complete:** `openspec archive <change-name>`

**Current Status:**

- `foundation-infrastructure`: ⚠️ Needs normative language fixes (add SHALL/MUST)
- All other changes: ⚠️ Spec files need restructuring into proper Requirement/Scenario format (see `OPENSPEC_CONVERSION_SUMMARY.md` for details)

**OpenSpec File Structure:**

Each change includes three types of files:
- `proposal.md` - Detailed proposal, rationale, and impact analysis
- `tasks.md` - Specific implementation tasks with dependencies and testing requirements
- `specs/*/spec.md` - Technical specifications with requirements and acceptance scenarios

---

## Current Progress

**✅ Completed Work:** Groups A-H complete - [View Archive](archive/)

**Completion Summary:**
- **Phase 1** ✅ Foundation complete (Groups A-C)
- **Phase 2** ✅ First Steps complete (Groups D-E)
- **Phase 3** ✅ Finding Your Rhythm complete (Groups F-G)
- **Phase 4** ✅ Spreading Your Wings - Group H complete (96.7% test pass rate, all features production-ready)

**Phase 4: Spreading Your Wings** ⏳ IN PROGRESS
- **Group I - Soaring High:** 📋 Next up (CRDT sync, activity feeds, advanced collaboration)

**Phase 5: Reaching for the Stars**
- **Group J - Moonshots:** 📋 Planned (3D visualization, AI insights, forecasting)

---

## Archived Groups

All completed groups (A-H) have been archived. See detailed completion reports in `Roadmaps/archive/`:

- **Groups A-C:** Foundation, Basic Features, Onboarding
- **Group D:** `archive/GROUP_D_FINAL_STATUS.md` - Guided setup experiences
- **Group E:** `archive/GROUP_E_FINAL_COMPLETION_REPORT.md` - Daily workflows
- **Group F:** `archive/GROUP_F_FINAL_COMPLETION_REPORT.md` - Core workflows
- **Group G:** `archive/GROUP_G_FINAL_COMPLETION_REPORT.md` - Advanced accounting
- **Group H:** `archive/GROUP_H_FINAL_COMPLETION_REPORT.md` - Enterprise features & infrastructure

**Total Delivered:** 50+ features, 100+ services, 3000+ tests, complete production infrastructure

---

## How to Read This Roadmap

This roadmap is designed for **agent-based development systems** and human developers alike.

**Group Structure:**
- **Groups A-D:** ✅ COMPLETE - [View Archive](complete/)
- **Group E** requires Group D - ⏳ NEXT UP
- **Group F** requires Group E
- **Group G** requires Group F
- And so on...

**Testing Gates:**
- **You CANNOT proceed to the next group until ALL tests in the current group pass**
- Each group must have comprehensive unit, integration, and E2E tests
- The final task in every group is: "Run npm test and ensure all tests pass"
- No exceptions - testing is mandatory, not optional

**Within each group**, items are ordered from:
1. Quickest wins / highest value (top)
2. Most complex / lower immediate value (bottom)

**Every item includes:**
- What it is
- What must exist first
- How it can bring joy to users
- Which spec requirement it fulfills

**OpenSpec Integration:**
- Items now have corresponding OpenSpec change folders in `openspec/changes/<change-name>/`
- Each change includes:
  - `proposal.md` - Detailed proposal and rationale
  - `tasks.md` - Specific implementation tasks
  - `specs/*/spec.md` - Technical specifications
- Reference these files for detailed implementation guidance

---

## Quick Start Guide

**Starting Work on a Change:**

1. **Identify Your Starting Point**
   - Groups A-D are ✅ COMPLETE - see complete/ folder for details
   - Begin with Phase 2, Group E (daily-workflows)
   - All items within Group E can be worked on simultaneously
   - Move to next group ONLY when current group is complete AND all tests pass

2. **Review the Change**
   ```bash
   # List all available changes
   openspec list

   # View details for a specific change
   openspec show foundation-infrastructure

   # Validate before starting work
   openspec validate foundation-infrastructure
   ```

3. **Understand the Work**
   - Read `proposal.md` to understand WHY this change is needed
   - Review `tasks.md` to see WHAT needs to be implemented
   - Study `specs/*/spec.md` files for technical requirements
   - Check dependencies listed in tasks.md

4. **Expected Workflow**
   ```
   Read proposal.md → Review tasks.md → Study specs → Implement → Test → Validate
   ```

5. **Implementation Process**
   - Start with the first task in `tasks.md`
   - Implement according to specifications in `specs/*/spec.md`
   - Write tests as specified in each task
   - Ensure acceptance criteria are met
   - Run `openspec validate <change-name>` to verify

6. **Completion Requirements (MANDATORY)**
   - All tasks marked complete
   - **ALL TESTS PASSING** - Run `npm test` and verify 100% pass rate
   - All acceptance criteria met
   - Unit tests written for all functions/components
   - Integration tests written for all feature interactions
   - E2E tests written for all user workflows
   - Test coverage meets minimum thresholds (see DEFINITION_OF_DONE.md)
   - Documentation complete
   - Code reviewed and approved
   - Run `openspec archive <change-name>` when done

   **⚠️ TESTING GATE: You cannot proceed to the next group until all tests pass!**

**Where to Find Help:**

- **OpenSpec Documentation**: See `openspec/project.md` for project context and conventions
- **Conversion Status**: Check `OPENSPEC_CONVERSION_SUMMARY.md` for known issues and fixes needed
- **Roadmap Gaps**: Review `ROADMAP_GAPS.md` for missing elements and improvement opportunities
- **Main Specification**: Reference the main `SPEC.md` for comprehensive requirements
- **Task Questions**: Each task in `tasks.md` includes implementation details and testing requirements

**Common Questions:**

- **Which change to start with?** Now `daily-workflows` (Group E) - Groups A-D are complete
- **Can I work on multiple tasks?** Yes, within the same Group (e.g., all of Group D in parallel)
- **What if specs are incomplete?** See `ROADMAP_GAPS.md` - some specs need formatting fixes
- **How do I know it's done?** Check the "Success Criteria" section in each `tasks.md`

---

---

# PHASE 1-3 COMPLETE

**Groups A through H have been completed and archived.**

See `Roadmaps/archive/` for detailed completion reports:
- GROUP_A-C: Foundation, Basic Features, Onboarding
- GROUP_D_FINAL_STATUS.md: Guided setup experiences
- GROUP_E_FINAL_COMPLETION_REPORT.md: Daily workflows
- GROUP_F_FINAL_COMPLETION_REPORT.md: Core workflows
- GROUP_G_FINAL_COMPLETION_REPORT.md: Advanced accounting
- GROUP_H_FINAL_COMPLETION_REPORT.md: Enterprise features & infrastructure

**Stats:** 50+ features delivered, 100+ services, 3000+ tests, 96.7% pass rate

---

## Group I - Soaring High (Requires Group H + ALL Group H Tests Passing)

### I1. CRDT Conflict Resolution [MVP for multi-user]
**What:** Handle simultaneous edits without data loss.

**OpenSpec Resources:**
- Change: `openspec/changes/advanced-sync/`
- Proposal: `openspec/changes/advanced-sync/proposal.md`
- Tasks: `openspec/changes/advanced-sync/tasks.md`
- Specs: `openspec/changes/advanced-sync/specs/*/spec.md`

**Status & Ownership:**
- Status: Not Started
- Priority: High
- Owner: TBD

**Acceptance Criteria:**
- [ ] CRDT data structures implemented for all core entity types
- [ ] Merge algorithm handles concurrent edits without data loss
- [ ] Conflict notifications are surfaced to users with clear explanation
- [ ] Conflict history is viewable and auditable
- [ ] Manual resolution interface is available for complex conflicts
- [ ] System maintains consistency across all clients
- [ ] Performance remains acceptable with large datasets

**Test Strategy:**
- Unit tests for CRDT merge operations
- Concurrent edit simulation testing
- Integration tests for multi-client scenarios
- Conflict resolution UI testing
- Performance testing with high conflict rates
- Edge case testing for rare conflict scenarios

**Risks & Mitigation:**
- Risk: CRDT complexity may introduce subtle bugs
  - Mitigation: Use proven CRDT libraries, extensive testing, code review
- Risk: Some conflicts may be unresolvable automatically
  - Mitigation: Manual resolution interface, clear user guidance
- Risk: Performance degradation with conflict-heavy usage
  - Mitigation: Optimize CRDT operations, implement conflict rate monitoring

**External Dependencies:**
- Libraries: yjs, automerge
- Infrastructure: None

**Dependencies:** {H1, B6}

**Joy Opportunity:** "Two people edited this at once, and we kept both changes. No drama."

**Delight Detail:** Conflict notification is calm: "Heads up: this record was updated by both you and [User]. We merged the changes."

**Includes:**
- CRDT implementation per data type
- Merge algorithm
- Conflict notification
- Conflict history view
- Manual resolution for complex cases

**Spec Reference:** ARCH-004

---

### I2. Activity Feed & Communication [Nice]
**What:** Intentional team communication via @mentions, comments, and messaging - integrated with checklists.

**OpenSpec Resources:**
- Change: `openspec/changes/advanced-sync/`
- Proposal: `openspec/changes/advanced-sync/proposal.md`
- Tasks: `openspec/changes/advanced-sync/tasks.md`
- Specs: `openspec/changes/advanced-sync/specs/*/spec.md`

**Status & Ownership:**
- Status: Not Started
- Priority: Medium
- Owner: TBD

**Acceptance Criteria:**
- [ ] Users can @mention team members on any transaction, invoice, bill, or record
- [ ] @mentions create notifications and optional checklist items
- [ ] Comment threads remain attached to their contextual records
- [ ] Direct messaging for quick questions about specific work
- [ ] Checklist integration: comments on checklist items create threaded conversations
- [ ] All communication respects role-based permissions
- [ ] NO automatic activity feed of audit log actions (intentional communication only)
- [ ] Users can reply to comments and build conversation threads
- [ ] Notification preferences allow granular control
- [ ] Comment search allows finding past discussions

**Test Strategy:**
- Unit tests for @mention parsing and routing
- Integration tests for comment → checklist integration
- E2E tests for complete @mention → notification → response workflow
- Permission boundary testing (who can see what)
- Notification delivery testing across channels
- Thread integrity testing for conversation ordering

**Risks & Mitigation:**
- Risk: @mention spam could become overwhelming
  - Mitigation: Notification preferences, digest mode, "mute conversation" option
- Risk: Comments may clutter transaction views
  - Mitigation: Collapsible comment threads, "hide comments" toggle
- Risk: Important communication lost in noise
  - Mitigation: Checklist integration ensures actionable items aren't missed
- Risk: Privacy leaks through comment visibility
  - Mitigation: Role-based filtering, comprehensive permission testing

**External Dependencies:**
- Libraries: mentions, date-fns
- Infrastructure: None

**Dependencies:** {H1, H3, B2, C2}

**Joy Opportunity:** "Ask questions right where they matter. No more endless email threads."

**Delight Detail:** @mention creates notification: "Marcus mentioned you in [Expense #1234]" with context preview and one-click navigation.

**Includes:**
- @mention functionality on all records
- Comment threads on transactions/invoices/bills
- Direct messaging contextual to work
- Checklist integration (comments on checklist items)
- Notification routing and preferences
- Comment search and history
- Threaded conversations

**Integration Spec:** How @mentions + comments + checklists work together:
1. User @mentions teammate in expense comment: "Hey @Sarah, is this really office supplies?"
2. Sarah gets notification with context
3. System optionally creates checklist item: "Review expense #1234 flagged by Marcus"
4. Sarah replies in comment thread
5. Conversation stays attached to expense for full context
6. Checklist item marks complete when resolved

**Spec Reference:** FUTURE-002

---

### I3. UX Efficiency Shortcuts [Nice]
**What:** Quick access to recent work, search history, and duplicate detection helpers.

**OpenSpec Resources:**
- Change: `openspec/changes/ux-efficiency/`
- Proposal: `openspec/changes/ux-efficiency/proposal.md`
- Tasks: `openspec/changes/ux-efficiency/tasks.md`
- Specs: `openspec/changes/ux-efficiency/specs/*/spec.md`

**Status & Ownership:**
- Status: Not Started
- Priority: Medium
- Owner: TBD

**Acceptance Criteria:**
- [ ] Search bar shows last 10 searches/views when focused
- [ ] Expense entry form has "Recent entries" button showing last 20 expenses
- [ ] Duplicate detection suggests similar recent transactions during entry
- [ ] "Resume where you left off" widget on dashboard shows last 5 edited records
- [ ] Quick access menu shows recently viewed transactions/invoices/bills
- [ ] Recent activity is persisted per-user and syncs across devices
- [ ] Users can clear their recent history
- [ ] Recent items respect role-based permissions

**Test Strategy:**
- Unit tests for recent activity tracking logic
- Integration tests for cross-device sync of recent history
- E2E tests for complete user workflows (search → recent → quick access)
- Duplicate detection accuracy testing
- Performance testing with large recent history datasets
- Permission boundary testing

**Risks & Mitigation:**
- Risk: Recent history may expose sensitive data
  - Mitigation: Respect permissions, allow clearing history, encrypt synced data
- Risk: Duplicate detection false positives may annoy users
  - Mitigation: Smart similarity threshold, easy dismiss, "don't show again" option
- Risk: Performance degradation with large history
  - Mitigation: Limit history size, efficient indexing, lazy loading

**External Dependencies:**
- Libraries: fuse.js (fuzzy search for duplicates), date-fns
- Infrastructure: None

**Dependencies:** {B2, C7, E6}

**Joy Opportunity:** "We remember so you don't have to. Pick up right where you left off."

**Delight Detail:** Duplicate detection shows: "This looks similar to [Expense from 3 days ago]. Same one?" with one-click comparison.

**Includes:**
- Search history (last 10 searches)
- Recent entries helper (last 20 by type)
- Duplicate detection on entry
- "Resume where you left off" dashboard widget
- Quick access to recently viewed records
- Per-user history persistence
- Clear history option

**Spec Reference:** UX-001 (new)

### I4. Multi-Currency - Full (Nice)
**What:** Complete multi-currency with automatic rates and gain/loss.

**OpenSpec Resources:**
- Change: `openspec/changes/advanced-sync/`
- Proposal: `openspec/changes/advanced-sync/proposal.md`
- Tasks: `openspec/changes/advanced-sync/tasks.md`
- Specs: `openspec/changes/advanced-sync/specs/*/spec.md`

**Status & Ownership:**
- Status: Not Started
- Priority: Low
- Owner: TBD

**Acceptance Criteria:**
- [ ] Exchange rates update automatically from reliable API source
- [ ] Realized gain/loss calculated correctly on foreign currency payments
- [ ] Unrealized gain/loss reported accurately for open balances
- [ ] Currency revaluation process handles all outstanding balances
- [ ] Aging reports display amounts in both original and home currency
- [ ] Manual rate override capability is available
- [ ] Historical rate accuracy is maintained

**Test Strategy:**
- Unit tests for gain/loss calculation algorithms
- Integration tests for automatic rate updates
- E2E tests for complete foreign currency transaction lifecycle
- Comparison testing against known accounting scenarios
- Edge case testing for extreme exchange rate fluctuations

**Risks & Mitigation:**
- Risk: Exchange rate API outages prevent updates
  - Mitigation: Fallback to manual entry, cache recent rates, multiple API sources
- Risk: Complex gain/loss calculations may have errors
  - Mitigation: Extensive test coverage, CPA review of algorithms
- Risk: Users confused by unrealized vs. realized gain/loss
  - Mitigation: Educational tooltips, clear report labels, examples

**External Dependencies:**
- Libraries: decimal.js
- Services: Exchange Rates API
- Infrastructure: None

**Dependencies:** {H5}

**Joy Opportunity:** "Exchange rates update automatically. Gain and loss tracked perfectly."

**Includes:**
- Automatic exchange rate updates
- Realized gain/loss on payments
- Unrealized gain/loss reporting
- Currency revaluation
- Multi-currency aging reports

**Spec Reference:** CURR-001

---

### I5. Barter/Trade Transactions (Nice)
**What:** Record barter exchanges properly.

**OpenSpec Resources:**
- Change: `openspec/changes/advanced-sync/`
- Proposal: `openspec/changes/advanced-sync/proposal.md`
- Tasks: `openspec/changes/advanced-sync/tasks.md`
- Specs: `openspec/changes/advanced-sync/specs/*/spec.md`

**Status & Ownership:**
- Status: Not Started
- Priority: Low
- Owner: TBD

**Acceptance Criteria:**
- [ ] Dedicated barter transaction type is available
- [ ] Users can enter fair market value for both sides of exchange
- [ ] System automatically creates offsetting journal entries
- [ ] Barter income and expense are tracked separately in reports
- [ ] 1099-B guidance is provided with educational content
- [ ] Barter transactions are clearly labeled in all views
- [ ] Tax implications are explained in plain language

**Test Strategy:**
- Unit tests for barter entry creation and offsetting
- Integration tests for reporting accuracy
- E2E tests for complete barter transaction workflow
- Tax calculation verification
- Educational content review

**Risks & Mitigation:**
- Risk: Users may not understand fair market value concept
  - Mitigation: Educational tooltips, examples, valuation guidance
- Risk: Incorrect tax treatment of barter income
  - Mitigation: CPA review of feature, clear disclaimers, educational content
- Risk: Limited user need for this feature
  - Mitigation: Mark as "Nice to have", prioritize based on user feedback

**External Dependencies:**
- Libraries: decimal.js
- Infrastructure: None

**Dependencies:** {F7, B2}

**Joy Opportunity:** "Traded services? We've got you covered. Barter is real income (and the IRS agrees)."

**Delight Detail:** Educational explainer about barter tax implications included.

**Includes:**
- Barter transaction type
- Fair market value entry
- Automatic offsetting entries
- Barter income/expense tracking
- 1099-B guidance

**Spec Reference:** BARTER-001

---

### I6. Scheduled Report Delivery (Nice)
**What:** Receive reports automatically by email.

**OpenSpec Resources:**
- Change: `openspec/changes/advanced-sync/`
- Proposal: `openspec/changes/advanced-sync/proposal.md`
- Tasks: `openspec/changes/advanced-sync/tasks.md`
- Specs: `openspec/changes/advanced-sync/specs/*/spec.md`

**Status & Ownership:**
- Status: Not Started
- Priority: Low
- Owner: TBD

**Acceptance Criteria:**
- [ ] Users can configure schedules for any saved report
- [ ] Email delivery occurs reliably at scheduled times
- [ ] Multiple recipients can be specified per schedule
- [ ] Delivery history is viewable and includes success/failure status
- [ ] Schedule pausing and deletion is supported
- [ ] Time zone handling is correct for all users
- [ ] Report attachments are properly formatted (PDF/Excel)

**Test Strategy:**
- Unit tests for schedule parsing and next-run calculation
- Integration tests for email delivery
- E2E tests for complete scheduling workflow
- Time zone testing across multiple regions
- Failure recovery testing

**Risks & Mitigation:**
- Risk: Email delivery failures go unnoticed
  - Mitigation: Delivery status tracking, retry logic, user notifications
- Risk: Scheduled reports may contain stale data
  - Mitigation: Real-time report generation, clear timestamp on reports
- Risk: Time zone confusion leads to unexpected delivery times
  - Mitigation: Clear time zone indicators, preview of next delivery time

**External Dependencies:**
- Libraries: node-cron, nodemailer
- Infrastructure: SMTP

**Dependencies:** {G1, D3}

**Joy Opportunity:** "P&L delivered to your inbox every Monday. Automatic financial awareness."

**Includes:**
- Schedule configuration per report
- Email delivery
- Multiple recipients
- Delivery history

**Spec Reference:** ACCT-009

---

### I7. Load Testing Infrastructure [MVP] [INFRASTRUCTURE]
**What:** Load testing suite for sync relay and real-time features.

**Dependencies:** {H8, I1}

**Joy Opportunity:** "Know your limits before your users find them. Load testing reveals bottlenecks."

**Status & Ownership:**
- Status: Not Started
- Priority: High (Infrastructure)
- Owner: Unassigned
- Last Updated: 2026-01-11

**Acceptance Criteria:**
- [ ] Load test suite created for sync relay
- [ ] Concurrent user simulation (100, 500, 1000 users)
- [ ] Performance baseline established
- [ ] Automated load tests run before major releases
- [ ] CRDT sync tested under concurrent modification
- [ ] Response time degradation tracked
- [ ] Breaking point identified and documented
- [ ] Load test results stored historically
- [ ] Alerts if performance regresses

**Test Strategy:**
- Run load tests against staging environment
- Compare results against baseline
- Identify bottlenecks and optimize

**Includes:**
- Load test scripts (k6, Artillery, or similar)
- Concurrent user scenarios
- Performance baseline documentation
- CI integration for release testing

**Spec Reference:** INFRA-013 (new)

---

### I8. Observability Stack [MVP] [INFRASTRUCTURE]
**What:** Distributed tracing, log aggregation, and metrics dashboards.

**Dependencies:** {H11}

**Joy Opportunity:** "See everything, understand everything. Observability turns mystery into clarity."

**Status & Ownership:**
- Status: Not Started
- Priority: High (Infrastructure)
- Owner: Unassigned
- Last Updated: 2026-01-11

**Acceptance Criteria:**
- [ ] Distributed tracing implemented (trace sync operations across clients)
- [ ] Log aggregation configured (structured JSON logging)
- [ ] Metrics dashboards created (Grafana or similar)
- [ ] CRDT conflict rate tracked as metric
- [ ] Sync latency tracked per client
- [ ] Log search and filtering available
- [ ] Log retention policy defined
- [ ] Correlation IDs link logs across services
- [ ] Custom dashboards for business metrics

**Test Strategy:**
- Verify traces span full sync operation
- Test log search finds relevant entries
- Verify metrics dashboards update in real-time

**Includes:**
- Distributed tracing setup
- Log aggregation configuration
- Metrics collection
- Dashboard creation
- Log retention policies

**Spec Reference:** INFRA-014 (new)

---

### I9. Write Comprehensive Tests for Group I Features [MVP] [MANDATORY]
**What:** Write complete test suites for all Group I features before proceeding to Group J.

**Dependencies:** {I1, I2, I3, I4, I5, I6, I7, I8}

**⚠️ TESTING GATE:** This task is MANDATORY. You CANNOT proceed to Group J until ALL Group I tests pass.

**Includes:**
- Unit tests for all Group I components and functions
- Integration tests for all Group I feature interactions
- E2E tests for all Group I user workflows
- Performance tests per DEFINITION_OF_DONE.md requirements

**Status & Ownership:**
**Status:** Not Started
**Owner:** Unassigned
**Last Updated:** 2026-01-10

**Acceptance Criteria:**
- [ ] Unit tests written for CRDT Conflict Resolution (I1)
- [ ] Unit tests written for Activity Feed (I2)
- [ ] Unit tests written for Comments on Transactions (I3)
- [ ] Unit tests written for Multi-Currency - Full (I4)
- [ ] Unit tests written for Barter/Trade Transactions (I5)
- [ ] Unit tests written for Scheduled Report Delivery (I6)
- [ ] Integration tests verify interactions between all Group I features
- [ ] E2E tests cover complete conflict resolution and collaboration workflows
- [ ] Performance tests verify all Group I features meet requirements
- [ ] Test coverage meets minimum thresholds
- [ ] All tests pass with 100% success rate

**Test Strategy:**
- **Unit Tests:** CRDT merge logic, conflict detection, currency exchange calculations
- **Integration Tests:** Activity feed integration, comment synchronization
- **E2E Tests:** Complete multi-user conflict scenario, barter transaction workflow
- **Performance Tests:** Conflict resolution speed, report delivery reliability

**External Dependencies:**
- **Libraries:** vitest, @testing-library/react, playwright


---

### I10. Run All Tests and Verify 100% Pass Rate [MVP] [MANDATORY]
**What:** Run the complete test suite and verify ALL tests pass before moving to Group J.

**Dependencies:** {I9}

**⚠️ CRITICAL GATE:** Group J work CANNOT begin until this task is complete.

**Includes:**
- Run `npm test` and verify 100% pass rate
- Review test coverage reports
- Fix any failing tests
- Document test results

**Status & Ownership:**
**Status:** Not Started
**Owner:** Unassigned
**Last Updated:** 2026-01-10

**Acceptance Criteria:**
- [ ] Command `npm test` runs successfully with 0 failures
- [ ] All unit tests pass (100% pass rate)
- [ ] All integration tests pass (100% pass rate)
- [ ] All E2E tests pass (100% pass rate)
- [ ] All performance tests pass (100% pass rate)
- [ ] Test coverage meets minimum requirements
- [ ] Test results documented and reviewed

**Success Criteria:**
✅ **ALL TESTS PASSING** = Ready to proceed to Group J
❌ **ANY TESTS FAILING** = Must fix before proceeding


---

---

# Phase 5: Reaching for the Stars

*"Dream big. These features push the boundaries of what accounting software can be."*

---

## Infrastructure Capstone - Foundation for Group J

*"Build the bridge. These infrastructure pieces unlock the moonshots."*

**Purpose:** Complete remaining Group I UI components, build critical infrastructure for Group J features (billing, admin panel, email service), and synchronize documentation with the evolved roadmap vision.

**Status:** Not Started
**Dependencies:** Group I core features complete (I1-I8 backends done)
**Blocks:** Group J cannot begin until this section is 100% complete

---

### IC-0. Group I Backend Validation [GATE] [MANDATORY]
**What:** Verify that Group I backend implementations (I1 CRDT, I2 Activity Feed) are 100% complete and operational before beginning Infrastructure Capstone work.

**User Story:** As a project manager, I need to confirm all Group I backends are functional so that IC1 (UI components) can build on a solid foundation without blockers.

**Status & Ownership:**
- Status: Not Started
- Priority: BLOCKER (IC1 cannot start until this passes)
- Owner: TBD
- Last Updated: 2026-01-19

**Design Philosophy:**

IC1 builds UI components on top of I1 (CRDT) and I2 (Activity Feed) backend services. If these backends are incomplete or have failing tests, IC1 development will be blocked or require rework. This validation gate ensures the foundation is solid before UI work begins.

**What Needs Validation:**

**I1 (CRDT Conflict Resolution) Backend:**
- ConflictResolutionService implemented and operational
- CRDT merge algorithms working (LWW, manual merge, auto-merge)
- Conflict detection triggers on concurrent edits
- Conflict storage schema complete (conflicts table, resolution history)
- All I1 backend tests passing (100% pass rate)

**I2 (Activity Feed & Communication) Backend:**
- CommentsService implemented and operational
- Mentions service working (@username detection, notification trigger)
- Activity feed event tracking (transaction created, invoice sent, etc.)
- Notification schema complete (notifications table, preferences)
- All I2 backend tests passing (100% pass rate)

**Acceptance Criteria:**

**I1 CRDT Backend Validation:**
- [ ] Run all I1 unit tests: `npm test -- src/services/conflictResolution.service.test.ts`
- [ ] Verify 100% pass rate (0 failures)
- [ ] Manually test conflict creation (edit same transaction on 2 devices)
- [ ] Verify conflict appears in conflicts table
- [ ] Verify merge strategies execute without errors (LWW, manual, auto)
- [ ] Check conflicts table schema matches I1 spec
- [ ] Verify conflict resolution updates entity and logs resolution

**I2 Activity Feed Backend Validation:**
- [ ] Run all I2 unit tests: `npm test -- src/services/comments.service.test.ts src/services/mentions.service.test.ts`
- [ ] Verify 100% pass rate (0 failures)
- [ ] Manually test comment creation on transaction
- [ ] Verify comment appears in comments table
- [ ] Test @mention detection (comment with "@username")
- [ ] Verify notification created for mentioned user
- [ ] Check comments/notifications schema matches I2 spec

**Integration Validation:**
- [ ] I1 + I2 integration: Comment on conflicted transaction (should work)
- [ ] Verify no console errors in browser when using CRDT/comments features
- [ ] Verify services can be imported: `import { ConflictResolutionService } from '@/services/conflictResolution.service'`

**Documentation Validation:**
- [ ] I1 backend code includes JSDoc comments for all public methods
- [ ] I2 backend code includes JSDoc comments for all public methods
- [ ] README or implementation summary exists for I1 (found: Roadmaps/archive/I1_CRDT_IMPLEMENTATION_SUMMARY.md)
- [ ] README or implementation summary exists for I2 (found: Roadmaps/archive/I2_ACTIVITY_FEED_IMPLEMENTATION_SUMMARY.md)

**Gate Pass Criteria:**
- **ALL I1 backend tests passing (100%)**
- **ALL I2 backend tests passing (100%)**
- **Manual smoke tests successful (conflict creation, comment creation, @mention)**
- **No blocking bugs or missing schema tables**

**If Gate Fails:**
- Do NOT proceed to IC1
- Create bug tickets for failing tests
- Fix all I1/I2 backend issues
- Re-run IC-0 validation
- Only proceed when 100% pass rate achieved

**Test Strategy:**
- Automated: Run vitest test suites for conflictResolution.service and comments/mentions services
- Manual: Open app, create conflict on 2 devices, verify conflict appears
- Manual: Add comment with @mention, verify notification appears
- Integration: Test cross-feature scenarios (comment on conflicted transaction)

**Expected Duration:** 30 minutes - 2 hours (depending on issues found)

**Risks & Mitigation:**
- Risk: I1/I2 backends incomplete (tests failing)
  - Mitigation: Fix all failing tests before proceeding to IC1
- Risk: Schema tables missing (app crashes when accessing CRDT/comments)
  - Mitigation: Run migrations, verify tables exist in IndexedDB
- Risk: Services not exported correctly (import errors)
  - Mitigation: Fix export statements, verify imports work

**Joy Opportunity:** "Group I backend is rock solid! We're ready to build the UI on this strong foundation."

**Delight Detail:**
- When all tests pass: "100% pass rate! Your backend is production-ready. Let's build the UI!"
- When gate passes: Confetti animation "IC-0 validated! Infrastructure Capstone cleared for takeoff 🚀"

**Includes:**
- I1 backend test execution and validation
- I2 backend test execution and validation
- Manual smoke testing for CRDT and comments
- Integration testing across I1 + I2
- Documentation completeness check
- Gate pass/fail decision

**Spec Reference:** IC-000 (new)

---

### IC1. Complete Group I UI Components [MVP] [MANDATORY]
**What:** Finish the user-facing interfaces for I1 (CRDT) and I2 (Activity Feed) so Group J features can build on top of them.

**Status & Ownership:**
- Status: Not Started
- Priority: Critical (Blocks J7 Advisor Portal)
- Owner: TBD
- Last Updated: 2026-01-19

**Design Philosophy:**

Groups I1 and I2 have complete backend infrastructure (services, schemas, CRDT support) but are missing the UI layer. Group J features - especially J7 (Advisor Portal) - depend on these interfaces for collaboration and conflict resolution.

**What Needs Building:**

**I1 (CRDT) UI Components:**
- Conflict notification badge (shows unresolved conflicts count)
- Conflict resolution modal (side-by-side diff view, merge strategy selection)
- Conflict history drawer (90-day audit trail)
- Steadiness-style messaging ("We found 2 versions of this transaction. Which should we keep?")

**I2 (Activity Feed) UI Components:**
- Comment thread component (nested replies, threading support)
- Notification bell (unread count, priority indicators)
- Mention input (@username autocomplete with fuzzy search)
- Notification preferences panel (per-type opt-in/out, digest settings)
- Activity feed widget (recent comments, @mentions, updates)

**Acceptance Criteria:**

- [ ] ConflictNotificationBadge component created and integrated into header
- [ ] ConflictResolutionModal component displays side-by-side entity diff
- [ ] Merge strategy selection UI (Auto/Manual radio, Apply/Discard buttons)
- [ ] Conflict history accessible via "View All Conflicts" link
- [ ] CommentThread component renders nested replies with indentation
- [ ] Comment CRUD operations (create, edit, delete) work in UI
- [ ] NotificationBell component shows unread count
- [ ] Notification panel displays grouped notifications by priority
- [ ] MentionInput autocompletes @username with fuzzy search
- [ ] Notification preferences UI allows per-type opt-in/out
- [ ] Activity feed widget displays recent activity (last 20 items)
- [ ] All components follow Steadiness communication style
- [ ] All components are WCAG 2.1 AA compliant
- [ ] Components integrate with existing CRDT/comment services
- [ ] E2E tests written for conflict resolution workflow
- [ ] E2E tests written for comment thread workflow
- [ ] E2E tests written for @mention workflow

**Test Strategy:**
- Unit tests for each component (rendering, interactions, edge cases)
- Integration tests with backend services (ConflictResolutionService, CommentsService)
- E2E tests for complete workflows (user resolves conflict, user comments on transaction)
- Accessibility testing (keyboard navigation, screen reader compatibility)

**Risks & Mitigation:**
- Risk: Complex state management for nested comment threads
  - Mitigation: Use recursive rendering, React Context for thread state
- Risk: Real-time updates may cause UI flickering
  - Mitigation: Optimistic updates with Dexie liveQuery, debounced refresh
- Risk: Accessibility challenges with nested UI
  - Mitigation: Proper ARIA labels, keyboard navigation testing, focus management

**External Dependencies:**
- Libraries: @tiptap/react (rich text editor for comments), fuse.js (mention autocomplete)
- Infrastructure: None

**Dependencies:** {I1, I2}

**Joy Opportunity:** "Your teammate commented on that transaction. Click to see what they said - collaboration feels natural."

**Delight Detail:**
- First @mention: Gentle tooltip "Type @ to mention a teammate"
- First comment: Celebration "Great collaboration! Comments help keep everyone aligned."
- Conflict auto-resolved: "We automatically merged these changes - no action needed!"
- When user manually resolves first conflict: "Nice choice! You're getting the hang of this."

**Includes:**
- ConflictNotificationBadge component
- ConflictResolutionModal component (side-by-side diff, merge strategy UI)
- ConflictHistory drawer component
- CommentThread component (nested replies, threading)
- Comment CRUD UI (create, edit, delete)
- NotificationBell component (unread count, priority indicators)
- Notification panel (grouped by priority)
- MentionInput component (@username autocomplete with fuzzy search)
- Notification preferences panel (per-type opt-in/out, digest settings)
- Activity feed widget (recent 20 items)
- Steadiness communication style throughout
- WCAG 2.1 AA compliance
- Integration with I1/I2 backend services
- E2E tests for all workflows

**Spec Reference:** IC-001 (new)

---

### IC2. Billing Infrastructure - Stripe Integration [MVP] [INFRASTRUCTURE]
**What:** Build the subscription billing system for J7 (Advisor Portal) advisor plans with client-based pricing tiers.

**Status & Ownership:**
- Status: Not Started
- Priority: Critical (Blocks J7 Advisor Portal)
- Owner: TBD
- Last Updated: 2026-01-19

**Design Philosophy:**

J7 (Advisor Portal) introduces a **revenue stream** through advisor subscriptions. Advisors pay based on client count ($50 per 50 clients) and user count ($2.50/user after 5). This requires robust billing infrastructure that handles:
- Tier-based pricing (client count → price)
- Usage-based billing (additional users)
- Automatic billing adjustments (when clients added/removed)
- Client billing transfer (when client joins advisor's plan, client stops paying)
- Charity contribution ($5/month included in all plans)

**What Needs Building:**

**Stripe Integration:**
- Stripe account setup and API key configuration
- Product/Price creation in Stripe for advisor plans
- Subscription creation and management
- Payment method collection and storage
- Invoice generation and payment processing
- Webhook handling (subscription updates, payment success/failure)

**Billing Calculation Engine:**
- Client count → pricing tier calculation (0-3 = $0, 4-50 = $50, 51-100 = $100, etc.)
- User count → user charge calculation (0-5 = $0, 6+ = $2.50 each)
- Charity contribution addition ($5/month to all paid plans)
- Total monthly cost calculation and display

**Client Billing Transfer:**
- When advisor adds client: Stop client's individual billing, start on advisor's plan
- When advisor removes client: Prompt client (pay individually $40/month or archive)
- Automatic proration for mid-month changes

**Subscription Management:**
- Plan upgrade/downgrade (tier changes when client count crosses thresholds)
- Automatic billing adjustment when clients added/removed
- Cancel subscription workflow
- Reactivate subscription workflow
- Billing history and invoice access

**Acceptance Criteria:**

- [ ] Stripe API integrated with secure key storage (environment variables)
- [ ] Stripe Products created: Starter (free), Professional (tiered), Enterprise (custom)
- [ ] Stripe Prices created: Client blocks ($50/50), Additional users ($2.50 each), Charity ($5)
- [ ] Subscription creation API endpoint (creates Stripe subscription for advisor)
- [ ] Payment method collection UI (Stripe Elements for card entry)
- [ ] Payment method storage (Stripe PaymentMethod attached to Customer)
- [ ] Billing calculation service: clientCount + userCount → monthly total
- [ ] Tier logic: 0-3 clients = $0, 4-50 = $50, 51-100 = $100, 101-150 = $150, etc.
- [ ] User overage logic: 0-5 users = $0, 6+ = $2.50 × (userCount - 5)
- [ ] Charity contribution: Add $5 to all paid plans
- [ ] Client billing transfer: When advisor adds client, client's individual subscription canceled
- [ ] Client billing transfer: When advisor removes client, client prompted (pay $40/month or archive)
- [ ] Automatic proration for mid-month client additions/removals
- [ ] Subscription update API endpoint (handles tier changes, user count changes)
- [ ] Plan upgrade workflow (client count crosses threshold → automatic tier change)
- [ ] Plan downgrade workflow (client count decreases → tier downgrade, credit applied)
- [ ] Cancel subscription workflow (advisor cancels → all clients prompted)
- [ ] Reactivate subscription workflow (advisor can restart after cancellation)
- [ ] Billing history UI (list of past invoices with download links)
- [ ] Invoice access (Stripe-hosted invoice page)
- [ ] Webhook endpoint created and secured (signature verification)
- [ ] Webhook handling: `customer.subscription.updated` (sync subscription status)
- [ ] Webhook handling: `invoice.payment_succeeded` (confirm payment)
- [ ] Webhook handling: `invoice.payment_failed` (notify advisor, retry logic)
- [ ] Webhook handling: `customer.subscription.deleted` (handle cancellation)
- [ ] Error handling for Stripe API failures (network issues, invalid cards, etc.)
- [ ] Test mode configuration for development (Stripe test keys)
- [ ] Production mode configuration with live keys
- [ ] Comprehensive test suite (unit tests for calculation logic, integration tests with Stripe test mode)

**Test Strategy:**
- Unit tests for billing calculation logic (client count scenarios, user count scenarios)
- Integration tests with Stripe test mode (create subscription, update subscription, cancel)
- Webhook simulation tests (trigger each webhook type, verify handling)
- E2E tests for complete billing workflows (advisor signs up → adds client → billing adjusts → advisor removes client → client prompted)
- Error scenario testing (payment failure, network timeout, invalid card)

**Risks & Mitigation:**
- Risk: Stripe API changes may break integration
  - Mitigation: Pin Stripe SDK version, monitor API changelog, test in sandbox before production
- Risk: Complex pricing logic may have edge case bugs
  - Mitigation: Comprehensive unit tests, manual QA of all tier transitions, soft launch with monitoring
- Risk: Webhook delivery may fail or be delayed
  - Mitigation: Retry logic, idempotency keys, webhook event log for auditing
- Risk: Client billing transfer may create orphaned subscriptions
  - Mitigation: Automatic cleanup job, billing audit dashboard, transaction logs
- Risk: PCI compliance requirements for handling payments
  - Mitigation: Use Stripe Elements (no card data touches our servers), Stripe handles PCI compliance

**External Dependencies:**
- Services: Stripe API (subscription management, payment processing)
- Libraries: stripe (official Node.js SDK)
- Infrastructure: Webhook endpoint (publicly accessible URL for Stripe callbacks)

**Dependencies:** {H1 (Multi-user for advisor team members)}

**Joy Opportunity:** "Your first client just joined your plan! Billing is automatic - focus on serving your clients, not managing subscriptions."

**Delight Detail:**
- First subscription: "Welcome to Graceful Books Advisor Program! Your first 3 clients are free."
- Client count milestone: "You just hit 50 clients! You're making a real impact."
- Automatic tier upgrade: "Good news: We adjusted your plan as you grew. New rate: $100/month for up to 100 clients."
- Payment success: "Payment received - thank you! Your subscription is active through [date]."
- When advisor adds 4th client: "You've outgrown the free tier! Your plan is now $50/month for up to 50 clients."

**Includes:**
- Stripe API integration
- Stripe Products and Prices configuration
- Subscription creation and management APIs
- Payment method collection UI (Stripe Elements)
- Billing calculation service (tier logic, user overage, charity)
- Client billing transfer automation
- Automatic proration for mid-month changes
- Subscription update APIs (tier changes, user count)
- Plan upgrade/downgrade workflows
- Cancel and reactivate subscription workflows
- Billing history UI
- Invoice access (Stripe-hosted)
- Webhook endpoint with signature verification
- Webhook handlers (subscription updated, payment succeeded/failed, subscription deleted)
- Error handling for Stripe API failures
- Test mode and production mode configuration
- Comprehensive test suite

**Spec Reference:** IC-002 (new)

---

### IC2.5. Charity Payment Distribution System [MVP] [INFRASTRUCTURE]
**What:** Process and distribute the $5/month charity contributions from user subscriptions to selected charities.

**User Story:** As the platform admin, I need a system to track charity contributions and send payments to charities so that user contributions actually reach their selected charities.

**Status & Ownership:**
- Status: Not Started
- Priority: High (Required for revenue integrity)
- Owner: Platform Admin
- Last Updated: 2026-01-19

**Design Philosophy:**

Every Graceful Books subscription includes a $5/month contribution to the user's selected charity. This contribution must actually reach the charity for the business model to maintain integrity. This task defines the process for tracking and distributing charity payments.

**What Needs Building:**

**Charity Contribution Tracking:**
- Database view/query: Total contributions per charity per month
- Monthly contribution report (charity name, EIN, total amount, contributor count)
- Historical contribution tracking (lifetime contributions per charity)

**Payment Distribution Process:**
- Admin-initiated payment distribution (manual process, not automated)
- Monthly distribution workflow (generate report → review → send payments)
- Payment method: ACH/check/wire transfer (determined by charity preference)
- Payment tracking (date sent, amount, payment method, charity confirmation)

**Reporting:**
- Monthly contribution summary for admin (how much to distribute to which charities)
- Annual contribution summary for users (tax receipt: "You contributed $60 to [Charity Name] in 2026")
- Charity impact dashboard (total contributions per charity, growth over time)

**Acceptance Criteria:**

**Contribution Tracking:**
- [ ] Database query: Calculate total $5 contributions per charity per month
- [ ] Monthly contribution report generated (charity name, EIN, total amount, # of contributors)
- [ ] Historical contribution tracking stored (date, charity_id, total_amount, contributor_count)
- [ ] Contribution audit trail (which users contributed to which charity each month)

**Payment Distribution Workflow:**
- [ ] Admin dashboard: Monthly distribution task appears (1st of each month)
- [ ] Contribution report downloadable as CSV (charity name, EIN, total, count, payment address)
- [ ] Admin marks payment as "Sent" (date, amount, method: ACH/check/wire)
- [ ] Payment confirmation tracking (charity confirms receipt → status: "Confirmed")
- [ ] Unpaid contributions flagged (if payment not marked sent within 15 days)

**User Annual Summary:**
- [ ] Annual contribution summary generated for each user (total $5 × months active)
- [ ] User can download annual contribution receipt (for potential tax deduction)
- [ ] Receipt includes: User name, charity name, EIN, total contributed, year

**Charity Impact Dashboard:**
- [ ] Admin dashboard shows total contributions per charity (lifetime)
- [ ] Monthly growth chart (contributions over time)
- [ ] Top charities by contributor count
- [ ] Average contribution per charity per month

**Security & Integrity:**
- [ ] Contribution amounts cannot be manually edited (calculated from subscription data only)
- [ ] Payment audit log (who sent payment, when, to which charity)
- [ ] Contribution reconciliation: Total paid out matches total collected

**Simplicity Note:**
- **NO automated charity payouts** - Admin reviews monthly report and sends payments manually
- **NO Stripe Connect integration** - Simple ACH/check distribution
- Rationale: Low transaction volume (dozens of charities, not thousands), manual review ensures quality

**Test Strategy:**
- Unit tests for contribution calculation (verify $5 × active_users = total)
- Integration tests for report generation (verify CSV contains correct data)
- Manual QA of payment workflow (admin marks as sent, status updates correctly)

**Risks & Mitigation:**
- Risk: Admin forgets to distribute payments monthly
  - Mitigation: Automated reminder email ("Distribution due: $X to Y charities")
- Risk: Charity payment address changes (payment sent to wrong account)
  - Mitigation: Charity profile includes payment details, admin verifies before sending
- Risk: User disputes charity contribution (didn't receive credit)
  - Mitigation: User can download annual receipt, audit trail proves contribution

**External Dependencies:**
- Bank: ACH transfer capability for charity payments
- Accounting system: Track charity payments as expenses

**Dependencies:** {IC2 (Billing), IC3 (Charity Management)}

**Joy Opportunity:** "This month, Graceful Books users contributed $5,000 to 15 charities. You're part of something bigger."

**Delight Detail:**
- Monthly admin notification: "Time to distribute $X to charities - you're changing lives!"
- Annual user summary: "Your $60 helped [Charity Name] provide [impact metric] in 2026. Thank you."
- Charity milestone: "[Charity Name] just received their 100th month of contributions from Graceful Books!"

**Includes:**
- Monthly contribution calculation (per charity, per user)
- Monthly distribution report (CSV export with charity name, EIN, total, payment address)
- Admin payment tracking (mark as sent, payment method, confirmation status)
- User annual contribution receipt (downloadable PDF)
- Charity impact dashboard (lifetime contributions, monthly growth chart)
- Payment audit log (who sent, when, to whom)
- Contribution reconciliation (verify totals match)
- Automated admin reminder (monthly distribution task)

**Spec Reference:** IC-002.5 (new)

---

### IC3. Admin Panel - Charity Management [MVP] [INFRASTRUCTURE]
**What:** Platform admin interface for curating the list of approved charities that users and advisors can select for their $5/month contribution.

**Status & Ownership:**
- Status: Not Started
- Priority: High (Required for J7 Advisor Portal)
- Owner: TBD
- Last Updated: 2026-01-19

**Design Philosophy:**

Graceful Books includes a $5/month charitable contribution in every subscription ($40 individual, $50 advisor plans). Users and advisors select from a **curated list of verified charities** maintained by the platform admin (you).

This ensures:
- Charitable contributions go to legitimate organizations
- Quality control over charity selection
- Platform can verify 501(c)(3) status and financial transparency
- Users trust that their $5 is going to a real charity

**What Needs Building:**

**Admin Role & Permissions:**
- Admin user role (platform owner only)
- Admin-only routes and navigation
- Permission checks on admin endpoints

**Charity Management Interface:**
- Charity list view (table with name, category, status)
- Add new charity form (name, EIN, website, description, category)
- Edit charity form (update details)
- Remove charity (soft delete - mark inactive)
- Charity verification workflow (pending → verified) - **5-Step Process Below**

**Charity Verification Process (5 Steps):**

When admin adds a new charity, it goes through a manual verification workflow:

**Step 1: Initial Submission**
- Admin fills out "Add Charity" form with: Name, EIN, Website, Description, Category
- Status automatically set to "Pending"
- Charity appears in admin list with "Pending Verification" badge

**Step 2: EIN Format Validation (Automated)**
- System validates EIN format (XX-XXXXXXX, 9 digits with hyphen)
- Invalid EIN → Form error: "Please enter a valid EIN (format: 12-3456789)"
- Valid EIN → Proceeds to Step 3

**Step 3: IRS 501(c)(3) Status Verification (Manual)**
- Admin opens IRS Tax Exempt Organization Search: https://apps.irs.gov/app/eos/
- Search for organization by EIN or name
- Verify organization appears in IRS database with 501(c)(3) status
- Verify organization is "Active" (not revoked)
- Copy deductibility status code (e.g., "PC - Public Charity")
- Admin adds verification note: "Verified via IRS EOS on [date]. Status: Active PC."

**Step 4: Website & Mission Verification (Manual)**
- Admin visits charity's website (URL from form)
- Verify website is legitimate (HTTPS, professional design, contact info, recent updates)
- Verify mission statement matches form description
- Check for financial transparency (annual reports, 990 forms published)
- Red flags: No HTTPS, no contact info, outdated content, suspicious donation requests
- Admin adds note: "Website verified [date]. Mission aligns. Transparency: Good."

**Step 5: Final Approval**
- Admin clicks "Verify Charity" button in charity detail view
- Confirmation modal: "Are you sure you want to verify [Charity Name]? Users will be able to select this charity."
- Admin confirms → Status changes from "Pending" to "Verified"
- Charity now appears in user/advisor charity selection dropdown
- Audit log entry: "Admin [email] verified [Charity Name] on [date]"

**Rejection Workflow:**
- If verification fails (fake EIN, suspicious website, mission mismatch), admin clicks "Reject"
- Status changes to "Rejected"
- Rejected charities do not appear in user dropdowns
- Admin can add rejection reason note for future reference

**Charity Data Model:**
- Name, EIN (Tax ID), website URL, logo URL
- Description (mission statement)
- Category (Education, Environment, Health, Poverty, Animals, Arts, etc.)
- Status (Pending, Verified, Inactive)
- Created date, updated date
- Created by (admin user ID)

**User/Advisor Charity Selection:**
- Dropdown showing only "Verified" charities
- Grouped by category
- Search functionality
- Display charity logo and description on hover/click

**Acceptance Criteria:**

- [ ] Admin role created in user schema (role: 'admin')
- [ ] Admin permission checks on charity management endpoints
- [ ] Admin-only navigation section (visible only to admin users)
- [ ] Charity schema created (name, EIN, website, logo, description, category, status, timestamps)
- [ ] Charity CRUD endpoints (create, read, update, soft delete)
- [ ] Charity list view UI (table with sorting, filtering by category/status)
- [ ] Add charity form (all fields, validation for EIN format, URL format)
- [ ] Edit charity form (update existing charity details)
- [ ] Remove charity action (soft delete → status: 'Inactive')
- [ ] Charity verification workflow (status: Pending → Verified requires admin approval)
- [ ] Charity search functionality (by name, EIN, category)
- [ ] User charity selection dropdown (shows only Verified charities)
- [ ] Charity dropdown grouped by category
- [ ] Charity logo display in dropdown (icon or thumbnail)
- [ ] Charity description tooltip/popover on hover
- [ ] Default charity preselected (e.g., "Graceful Books Community Fund")
- [ ] Audit logging for admin actions (who added/edited/removed which charity, when)
- [ ] Admin dashboard showing charity statistics (total verified, pending, inactive)
- [ ] Seed script for initial charity list (10-15 well-known charities across categories)

**Test Strategy:**
- Unit tests for charity CRUD operations
- Integration tests for admin permission checks (non-admin cannot access)
- E2E tests for complete charity management workflow (admin adds → verifies → user selects)
- Security testing (verify non-admin users blocked from endpoints)

**Risks & Mitigation:**
- Risk: Unauthorized access to admin panel
  - Mitigation: Role-based access control, permission checks on all endpoints, audit logging
- Risk: Fake charities added by compromised admin account
  - Mitigation: Manual EIN verification process, audit trail, owner-only admin role (no delegation)
- Risk: Users confused by charity selection
  - Mitigation: Clear categories, descriptions, default selection, search functionality

**External Dependencies:**
- Libraries: None
- Infrastructure: Admin-only route protection

**Dependencies:** {A4 (User schema for admin role)}

**Joy Opportunity:** "You've selected [Charity Name] to receive your $5/month. Every month, you're making a difference."

**Delight Detail:**
- When user selects charity for first time: "Thank you for choosing [Charity Name]. Your $5/month helps them [mission statement snippet]."
- Annual summary: "This year, you contributed $60 to [Charity Name]. You're part of their story."
- Charity milestone: "[Charity Name] just reached $10,000 in contributions from Graceful Books users!"
- Charity update: "[Charity Name] shared an update: [impact story snippet]"

**Includes:**
- Admin user role and permissions
- Admin-only navigation and routes
- Charity schema (name, EIN, website, logo, description, category, status)
- Charity CRUD endpoints (create, read, update, soft delete)
- Charity list view UI (table, sorting, filtering)
- Add/edit charity forms
- Charity verification workflow (pending → verified)
- Charity search functionality
- User charity selection dropdown (grouped by category, logo display, description tooltip)
- Default charity preselection
- Audit logging for admin actions
- Admin dashboard with charity statistics
- Seed script for initial charity list (10-15 charities)

**Spec Reference:** IC-003 (new)

---

### IC4. Email Service Integration [MVP] [INFRASTRUCTURE]
**What:** Production-grade email delivery system for transactional emails (advisor invitations, notifications, tax season access grants).

**Status & Ownership:**
- Status: Not Started
- Priority: High (Required for J7, J8)
- Owner: TBD
- Last Updated: 2026-01-19

**Design Philosophy:**

Group J features (especially J7 Advisor Portal and J8 Tax Prep Mode) require email delivery for:
- **J7:** Advisor invitations, client billing transfer notifications, advisor removal notifications, scenario push-to-client emails
- **J8:** Tax season access grant notifications, tax prep completion emails

Currently, the notification schema supports email, but there's no actual email delivery service integrated. This task builds production-ready email infrastructure.

**What Needs Building:**

**Email Service Provider Selection:**
- Choose provider (recommendation: SendGrid, Postmark, or AWS SES)
- Set up account and API keys
- Configure sender domain and DNS records (SPF, DKIM, DMARC)
- Verify domain ownership

**Email Template System:**
- HTML email templates with responsive design
- Plain text fallbacks for accessibility
- Template variables for dynamic content
- Branded header/footer with Graceful Books logo

**Email Delivery Service:**
- Service wrapper around provider API
- Queue system for async delivery
- Retry logic (3 attempts with exponential backoff)
- Delivery status tracking (queued, sent, delivered, bounced, failed)
- Unsubscribe handling (per-email-type preferences)

**Required Email Templates:**
1. Advisor invitation (J7)
2. Client billing transfer notification (J7)
3. Advisor removed client notification (J7)
4. Scenario pushed to client (J3 + J7)
5. Tax season access granted (J8)
6. Tax prep completion summary (J8)
7. Welcome email (onboarding)
8. Password reset
9. Email verification

**Email Template Content (Detailed Specifications):**

**SECURITY NOTE:** Per security expert recommendation, all emails must be **notification-only** with NO financial data in email body. Users must log in to view details.

**Template 1: Advisor Invitation (J7)**
- **Subject:** `{{advisorName}} invited you to connect your Graceful Books account`
- **Body:**
  ```
  Hi {{clientFirstName}},

  {{advisorName}} ({{advisorFirm}}) has invited you to connect your Graceful Books account to their advisor portal.

  This will allow {{advisorName}} to:
  - View your financial reports (read-only access)
  - Help you with bookkeeping and tax preparation
  - Your billing will transfer to their plan (no charge to you)

  You remain in control: You can revoke access at any time.

  [View Invitation & Accept] {{invitationUrl}}

  Questions? Email us at support@gracefulbooks.com

  - The Graceful Books Team
  ```
- **CTA Button:** "View Invitation & Accept" → Links to invitation acceptance page (user must log in)
- **Variables:** `{{clientFirstName}}`, `{{advisorName}}`, `{{advisorFirm}}`, `{{invitationUrl}}`

**Template 2: Client Billing Transfer Notification (J7)**
- **Subject:** `Your Graceful Books billing has been transferred to {{advisorName}}`
- **Body:**
  ```
  Hi {{clientFirstName}},

  Good news: {{advisorName}} is now covering your Graceful Books subscription.

  What changed:
  - Your individual billing ($40/month) has been paused
  - {{advisorName}} now pays for your account as part of their advisor plan
  - You keep full access to all your data and features
  - You can still invite team members and manage your books

  No action needed. Everything continues as normal.

  [View Account Details] {{accountUrl}}

  Questions? Email {{advisorEmail}} or support@gracefulbooks.com

  - The Graceful Books Team
  ```
- **CTA Button:** "View Account Details" → Links to account settings (no financial data in email)
- **Variables:** `{{clientFirstName}}`, `{{advisorName}}`, `{{accountUrl}}`, `{{advisorEmail}}`

**Template 3: Advisor Removed Client Notification (J7)**
- **Subject:** `Your Graceful Books billing has been transferred back to you`
- **Body:**
  ```
  Hi {{clientFirstName}},

  {{advisorName}} has transferred billing for your Graceful Books account back to you.

  What happens next:
  1. Log in to choose your billing option:
     - Pay individually ($40/month) to keep full access
     - Archive your account (free, read-only access)

  2. You have 14 days to decide (grace period - no charge)

  Your data is safe: All your financial records remain secure and accessible.

  [Choose Billing Option] {{billingChoiceUrl}}

  Questions? Email support@gracefulbooks.com

  - The Graceful Books Team
  ```
- **CTA Button:** "Choose Billing Option" → Links to billing choice page (must log in)
- **Variables:** `{{clientFirstName}}`, `{{advisorName}}`, `{{billingChoiceUrl}}`

**Template 4: Scenario Pushed to Client (J3 + J7)**
- **Subject:** `{{advisorName}} shared a financial scenario with you`
- **Body:**
  ```
  Hi {{clientFirstName}},

  {{advisorName}} has shared a financial scenario analysis with you in Graceful Books.

  Scenario: "{{scenarioName}}"

  {{advisorName}} added a note:
  "{{advisorNote}}"

  [View Scenario] {{scenarioUrl}}

  This scenario shows projected financials based on assumptions. Log in to see the full analysis.

  - The Graceful Books Team
  ```
- **CTA Button:** "View Scenario" → Links to scenario page (must log in to see numbers)
- **Variables:** `{{clientFirstName}}`, `{{advisorName}}`, `{{scenarioName}}`, `{{advisorNote}}`, `{{scenarioUrl}}`

**Template 5: Tax Season Access Granted (J8)**
- **Subject:** `{{advisorName}} granted you access to Tax Prep Mode`
- **Body:**
  ```
  Hi {{clientFirstName}},

  {{advisorName}} has granted you access to Tax Prep Mode for tax year {{taxYear}}.

  You can now:
  - Generate tax reports (P&L, Balance Sheet, Transaction Summary)
  - Download your tax document checklist
  - Export your data package for your tax preparer

  Access ends: {{accessExpiresDate}}

  [Open Tax Prep Mode] {{taxPrepUrl}}

  Questions about tax prep? Contact {{advisorEmail}}

  - The Graceful Books Team
  ```
- **CTA Button:** "Open Tax Prep Mode" → Links to Tax Prep Mode (must log in)
- **Variables:** `{{clientFirstName}}`, `{{advisorName}}`, `{{taxYear}}`, `{{accessExpiresDate}}`, `{{taxPrepUrl}}`, `{{advisorEmail}}`

**Template 6: Tax Prep Completion Summary (J8)**
- **Subject:** `Your {{taxYear}} tax prep package is ready`
- **Body:**
  ```
  Hi {{firstName}},

  Great work! Your tax preparation package for {{taxYear}} is ready to download.

  What's included:
  - Income reports (complete transaction history)
  - Expense reports (categorized by tax category)
  - Deduction checklist (your completed review)
  - Export package (ZIP file with all data)

  [Download Tax Package] {{downloadUrl}}

  Next step: Share this package with your tax preparer or accountant.

  Need help? Email support@gracefulbooks.com

  - The Graceful Books Team
  ```
- **CTA Button:** "Download Tax Package" → Links to download page (must log in)
- **Variables:** `{{firstName}}`, `{{taxYear}}`, `{{downloadUrl}}`

**Template 7: Welcome Email (Onboarding)**
- **Subject:** `Welcome to Graceful Books, {{firstName}}!`
- **Body:**
  ```
  Hi {{firstName}},

  Welcome to Graceful Books - accounting software that feels like a friend, not a chore.

  You're in control: Your financial data is encrypted with zero-knowledge architecture. We can't see your data, even if we wanted to.

  What's next:
  1. Complete your business profile
  2. Connect your bank (or upload transactions manually)
  3. Start recording income and expenses

  Need help? We've got you:
  - Guided tutorials (built into the app)
  - Video walkthroughs (gracefulbooks.com/help)
  - Support team (support@gracefulbooks.com)

  [Get Started] {{dashboardUrl}}

  P.S. - Your $5/month supports {{charityName}}. You're already making a difference.

  - The Graceful Books Team
  ```
- **CTA Button:** "Get Started" → Links to dashboard
- **Variables:** `{{firstName}}`, `{{dashboardUrl}}`, `{{charityName}}`

**Template 8: Password Reset**
- **Subject:** `Reset your Graceful Books password`
- **Body:**
  ```
  Hi {{firstName}},

  We received a request to reset your Graceful Books password.

  [Reset Password] {{resetUrl}}

  This link expires in 1 hour.

  Didn't request a reset? Ignore this email - your password is still secure.

  Security tip: Never share your password or master passphrase with anyone (including Graceful Books support).

  Questions? Email security@gracefulbooks.com

  - The Graceful Books Team
  ```
- **CTA Button:** "Reset Password" → Links to password reset page
- **Variables:** `{{firstName}}`, `{{resetUrl}}`
- **No unsubscribe link** (critical security email)

**Template 9: Email Verification**
- **Subject:** `Verify your email address for Graceful Books`
- **Body:**
  ```
  Hi {{firstName}},

  Welcome to Graceful Books! Let's verify your email address to secure your account.

  [Verify Email Address] {{verificationUrl}}

  This link expires in 24 hours.

  Why verify?
  - Protect your account from unauthorized access
  - Enable password reset if you ever need it
  - Receive important account notifications

  Didn't create an account? Email security@gracefulbooks.com immediately.

  - The Graceful Books Team
  ```
- **CTA Button:** "Verify Email Address" → Links to verification page
- **Variables:** `{{firstName}}`, `{{verificationUrl}}`
- **No unsubscribe link** (critical account security email)

**Template Design Guidelines:**
- **Header:** Graceful Books logo (centered), brand colors (calming blue/green)
- **Footer:** Links to Help Center, Contact Support, Privacy Policy, Terms of Service
- **Typography:** Sans-serif font (Arial, Helvetica), 16px body text, 24px headings
- **Responsive:** Mobile-friendly (single column layout, large tap targets for buttons)
- **Accessibility:** Plain text fallback, sufficient color contrast, alt text for images
- **CTA Buttons:** Primary color (#4A90E2), white text, min 44px height (touch target size)

**Acceptance Criteria:**

- [ ] Email service provider selected and account created
- [ ] Sender domain configured (e.g., noreply@gracefulbooks.com)
- [ ] DNS records configured (SPF, DKIM, DMARC) and verified
- [ ] Email service wrapper created (EmailService class)
- [ ] Email delivery queue implemented (async, non-blocking)
- [ ] Retry logic implemented (3 attempts with exponential backoff: 1min, 5min, 15min)
- [ ] Delivery status tracking (queued, sent, delivered, bounced, failed)
- [ ] Webhook handling for delivery events (provider callbacks for status updates)
- [ ] HTML email template system created (Handlebars or similar)
- [ ] Plain text fallback generation (strip HTML, preserve links)
- [ ] Responsive email template design (works on mobile, desktop, all email clients)
- [ ] Branded header/footer with Graceful Books logo and colors
- [ ] Template variable interpolation ({{firstName}}, {{actionUrl}}, etc.)
- [ ] Advisor invitation email template created
- [ ] Client billing transfer notification template created
- [ ] Advisor removed client notification template created
- [ ] Scenario pushed to client template created (J3)
- [ ] Tax season access granted template created (J8)
- [ ] Tax prep completion template created (J8)
- [ ] Welcome email template created
- [ ] Password reset email template created
- [ ] Email verification template created
- [ ] Unsubscribe handling (per-email-type preferences stored in user preferences)
- [ ] Unsubscribe link in all transactional emails (except critical: password reset, billing)
- [ ] Email preview functionality (test send to admin email)
- [ ] Rate limiting (respect provider limits, throttle if needed)
- [ ] Error handling (network failures, API errors, invalid recipients)
- [ ] Logging (all email sends logged with recipient, template, status)
- [ ] Test mode configuration (capture emails in log instead of sending, for development)
- [ ] Production mode configuration (actual delivery)
- [ ] Integration with notification system (NotificationsService triggers email delivery)

**Test Strategy:**
- Unit tests for email service wrapper (delivery, retry logic, status tracking)
- Integration tests with provider test/sandbox mode (send test email, verify delivery)
- Template rendering tests (variable interpolation, HTML/plain text generation)
- E2E tests for complete email workflows (user triggers action → email sent → delivery confirmed)
- Deliverability testing (spam score check, inbox placement)

**Risks & Mitigation:**
- Risk: Emails marked as spam
  - Mitigation: Proper domain authentication (SPF, DKIM, DMARC), sender reputation monitoring, avoid spam triggers
- Risk: Provider API failures
  - Mitigation: Retry logic, fallback provider option, graceful degradation (log error, alert admin)
- Risk: Email deliverability issues (bounces, invalid addresses)
  - Mitigation: Email validation before sending, handle bounces, update user records
- Risk: Template rendering bugs (broken links, missing variables)
  - Mitigation: Template tests, preview functionality, variable validation

**External Dependencies:**
- Services: Email provider API (SendGrid/Postmark/AWS SES)
- Libraries: Provider SDK (e.g., @sendgrid/mail, postmark, @aws-sdk/client-ses)
- Infrastructure: DNS configuration for sender domain, webhook endpoint for delivery events

**Dependencies:** {None - can be built independently}

**Joy Opportunity:** "Your accountant just accepted your invitation! Check your email for next steps."

**Delight Detail:**
- First email sent: "Email on the way! Check your inbox (and spam folder, just in case)."
- Email delivered: "Email delivered to [recipient] successfully."
- Advisor invitation accepted: "Great news! [Advisor Name] accepted your invitation. They can now see your books."
- Tax prep completion: Subject line: "✓ Your 2025 Tax Package is Ready!" (emoji in subject for delight)

**Includes:**
- Email service provider setup (account, API keys, domain configuration)
- DNS records configuration (SPF, DKIM, DMARC)
- Email delivery service wrapper (EmailService class)
- Async delivery queue
- Retry logic (3 attempts, exponential backoff)
- Delivery status tracking
- Webhook handling for delivery events
- HTML email template system
- Plain text fallback generation
- Responsive email template design
- Branded header/footer
- Template variable interpolation
- 9 email templates (advisor invitation, billing transfer, advisor removal, scenario push, tax access, tax completion, welcome, password reset, email verification)
- Unsubscribe handling and per-type preferences
- Email preview functionality
- Rate limiting
- Error handling and logging
- Test mode and production mode configuration
- Integration with NotificationsService

**Spec Reference:** IC-004 (new)

---

### IC5. OpenSpec Documentation Synchronization [MVP] [MANDATORY]
**What:** Update all OpenSpec specification files to match the evolved Group J roadmap vision, ensuring agents implement the CORRECT features.

**Status & Ownership:**
- Status: Not Started
- Priority: Critical (Blocks agent deployment for Group J)
- Owner: TBD
- Last Updated: 2026-01-19

**Design Philosophy:**

During the Group J reimagining process, we made **fundamental changes** to the moonshot features:
- J1: 3D → 2D widget
- J2: AI insights → Smart automation assistant (research-driven pivot)
- J4: Health score → Key metrics reports (removed gamification)
- J6: Simple calculator → Comprehensive runway tool (75+ criteria)
- J7: Basic portal → Full billing model (pricing tiers, team management)
- J9: API integrations → CSV import/export (architecture shift)
- Removed: J10-J13 (mobile app, public API, related infrastructure)

The OpenSpec files still describe the OLD features. If agents read these specs, they will implement the WRONG things, wasting time and creating rework.

**This task ensures documentation matches reality BEFORE agents start building.**

**What Needs Updating:**

**Proposal File:**
- `openspec/changes/moonshot-features/proposal.md`
  - Rewrite to match current ROADMAP.md Group J (J1-J12)
  - Remove references to removed features (old J10-J13)
  - Add new features (J10 CSV Testing, J11/J12 testing gates)
  - Update feature descriptions to match evolved vision

**Spec Files (Rewrite Required):**
- `openspec/changes/moonshot-features/specs/VIZ-001/spec.md` → Update for 2D Financial Flow Widget
- `openspec/changes/moonshot-features/specs/AI-001/spec.md` → Update for Smart Automation Assistant
- `openspec/changes/moonshot-features/specs/HEALTH-001/spec.md` → Rename/update to METRICS-001 (Key Metrics Reports)
- `openspec/changes/moonshot-features/specs/RUNWAY-001/spec.md` → Update for expanded Emergency Fund & Runway Calculator
- `openspec/changes/moonshot-features/specs/MENTOR-001/spec.md` → Update for Advisor Portal with billing model
- `openspec/changes/moonshot-features/specs/TAX-001/spec.md` → Update for Tax Time Preparation Mode
- `openspec/changes/moonshot-features/specs/INTEG-001/spec.md` → Replace with CSV-001 (CSV Import/Export)

**Spec Files (Remove):**
- `openspec/changes/moonshot-features/specs/MOBILE-001/` → DELETE (feature removed)
- `openspec/changes/moonshot-features/specs/FUTURE-001/` → DELETE (public API removed)

**New Spec Files (Create):**
- `openspec/changes/moonshot-features/specs/CSV-001/spec.md` → CSV Import/Export
- `openspec/changes/moonshot-features/specs/SCENARIO-001/spec.md` → What-If Scenario Planner (if doesn't exist)
- `openspec/changes/moonshot-features/specs/GOALS-001/spec.md` → Goal Setting & Tracking (if doesn't exist)

**Tasks File:**
- `openspec/changes/moonshot-features/tasks.md` → Update to match current J1-J12 task list

**Acceptance Criteria:**

- [ ] proposal.md rewritten to match current Group J (J1-J12)
- [ ] proposal.md describes evolved feature vision (2D widget, smart automation, etc.)
- [ ] proposal.md removes all references to removed features
- [ ] VIZ-001 spec updated for 2D Financial Flow Widget (not 3D)
- [ ] VIZ-001 includes: 2D canvas, animation queue, node-based visualization, ecosystem toggle
- [ ] AI-001 spec updated for Smart Automation Assistant (not generic insights)
- [ ] AI-001 includes: smart categorization, reconciliation matching, anomaly flagging, 100% local processing
- [ ] HEALTH-001 renamed to METRICS-001 and rewritten for Key Metrics Reports
- [ ] METRICS-001 removes: 0-100 score, gamification, unsolicited recommendations
- [ ] METRICS-001 includes: liquidity/profitability/efficiency/leverage reports, accountant-controlled sharing
- [ ] RUNWAY-001 spec updated for expanded scope (75+ acceptance criteria)
- [ ] RUNWAY-001 includes: revenue flexibility, dual-slider interface, net burn calculation, date range selector
- [ ] MENTOR-001 spec updated for Advisor Portal with billing model
- [ ] MENTOR-001 includes: pricing tiers (Starter/Professional/Enterprise), team management, client lifecycle, charity selection
- [ ] TAX-001 spec updated for Tax Time Preparation Mode
- [ ] TAX-001 includes: 6-step workflow, business structure selection, calm tone, J7 integration
- [ ] INTEG-001 spec deleted and replaced with CSV-001
- [ ] CSV-001 spec created with: client-side processing, smart detection, templates, duplicate detection, zero-knowledge compatibility
- [ ] MOBILE-001 spec directory deleted (feature removed)
- [ ] FUTURE-001 spec deleted (public API removed)
- [ ] SCENARIO-001 spec created (if missing)
- [ ] GOALS-001 spec created (if missing)
- [ ] tasks.md updated to match current J1-J12 task structure
- [ ] All spec files follow consistent format (What, Why, Design Philosophy, Acceptance Criteria, etc.)
- [ ] All spec files reference correct dependencies
- [ ] All spec files include zero-knowledge architecture compatibility notes where relevant
- [ ] Git commit created: "docs: Synchronize OpenSpec files with evolved Group J roadmap vision"

**Test Strategy:**
- Manual review of all updated spec files
- Cross-reference with ROADMAP.md Group J section (lines 782-3516)
- Verify no references to removed features remain
- Verify all new features have corresponding specs

**Risks & Mitigation:**
- Risk: Specs may drift out of sync again during implementation
  - Mitigation: Make spec updates part of Definition of Done for each feature
- Risk: Agents may still find cached old specs
  - Mitigation: Clear .claude cache after updates, verify agents read updated files
- Risk: Incomplete specs may confuse agents
  - Mitigation: Follow consistent spec format, include all acceptance criteria from ROADMAP.md

**External Dependencies:**
- None

**Dependencies:** {None - pure documentation task}

**Joy Opportunity:** "Documentation in sync = agents build the right thing the first time. No wasted effort, no rework."

**Includes:**
- proposal.md rewrite
- VIZ-001, AI-001, METRICS-001 (renamed), RUNWAY-001, MENTOR-001, TAX-001 spec updates
- CSV-001 spec creation (replacement for INTEG-001)
- SCENARIO-001, GOALS-001 spec creation (if missing)
- MOBILE-001, FUTURE-001 spec deletion
- tasks.md update
- Git commit with clear message

**Spec Reference:** IC-005 (new)

---

### IC6. Infrastructure Capstone - Final Validation [MVP] [MANDATORY]
**What:** Verify ALL Infrastructure Capstone tasks complete, Group I UI components functional, billing/admin/email systems operational, and OpenSpec files synchronized.

**Status & Ownership:**
- Status: Not Started
- Priority: Critical (Final gate before Group J)
- Owner: TBD
- Last Updated: 2026-01-19

**Dependencies:** {IC1, IC2, IC3, IC4, IC5}

**⚠️ CRITICAL GATE:** Group J CANNOT BEGIN until this validation passes.

**Validation Checklist:**

**IC1 (Group I UI Components):**
- [ ] ConflictNotificationBadge visible in header, shows unresolved count
- [ ] Click badge → ConflictResolutionModal opens with side-by-side diff
- [ ] Conflict resolution works (user selects merge strategy, applies)
- [ ] CommentThread renders on transaction detail page
- [ ] User can create comment, comment saves and displays
- [ ] @mention autocomplete works (type @ → dropdown with users)
- [ ] NotificationBell shows unread count
- [ ] Click bell → notification panel opens with recent activity
- [ ] E2E test passes: "User resolves CRDT conflict"
- [ ] E2E test passes: "User comments on transaction with @mention"

**IC2 (Billing Infrastructure):**
- [ ] Stripe integration configured (test mode)
- [ ] Create test advisor subscription: 4 clients, 8 users → Total $57.50
- [ ] Add 47th client → Automatic tier upgrade to $100
- [ ] Remove client → Automatic proration and tier downgrade
- [ ] Client billing transfer works (client subscription canceled when added to advisor)
- [ ] Webhook handling verified (test webhook delivery)
- [ ] Billing history UI displays past invoices

**IC3 (Admin Panel):**
- [ ] Login as admin → Admin navigation section visible
- [ ] Navigate to Charity Management → List view displays
- [ ] Add new charity → Form validates, charity added with "Pending" status
- [ ] Verify charity → Status changes to "Verified"
- [ ] Login as regular user → Charity dropdown shows only "Verified" charities
- [ ] Select charity → Charity saved to user preferences

**IC4 (Email Service):**
- [ ] Send test email: Advisor invitation → Email delivers successfully
- [ ] Send test email: Client billing transfer → Email delivers with correct variables
- [ ] Send test email: Tax season access granted → Email delivers
- [ ] Check spam score → Passing (< 5.0)
- [ ] Verify delivery status tracking → Status updates in database

**IC5 (OpenSpec Sync):**
- [ ] Read `openspec/changes/moonshot-features/proposal.md` → Matches current Group J
- [ ] Read `VIZ-001/spec.md` → Describes 2D widget (not 3D)
- [ ] Read `AI-001/spec.md` → Describes Smart Automation Assistant
- [ ] Read `CSV-001/spec.md` → Describes CSV Import/Export (not API integrations)
- [ ] Search for `MOBILE-001` → Not found (removed)
- [ ] Search for `FUTURE-001` → Not found (removed)

**Performance Validation:**
- [ ] Page load time < 2 seconds (measured with Lighthouse, average of 3 runs)
- [ ] IC1 conflict resolution modal opens < 500ms (from click to visible)
- [ ] IC2 billing calculation completes < 1 second (for 100 clients, 10 users)
- [ ] IC4 email queuing completes < 100ms (email added to queue immediately)
- [ ] Dashboard with all IC features renders < 3 seconds (cold load)
- [ ] No memory leaks detected (Chrome DevTools Memory Profiler, 10-minute session)
- [ ] All API endpoints respond < 1 second (95th percentile)

**Security Validation:**
- [ ] IC2 Stripe webhook signature validation working (test with invalid signature → rejected)
- [ ] IC3 admin endpoints return 403 for non-admin users (test with regular user token)
- [ ] IC3 CSRF protection enabled on all admin forms (verify CSRF token required)
- [ ] IC4 email templates sanitize user input (test with `<script>alert('XSS')</script>` in advisor name → escaped)
- [ ] IC2 billing data NOT logged in plaintext (check server logs for absence of card numbers, amounts)
- [ ] Session timeout works (idle 30 minutes → auto-logout)
- [ ] Rate limiting active on auth endpoints (10 failed logins → temporary block)
- [ ] Penetration test: Non-admin cannot access charity management (manual verification)

**Accessibility Validation (WCAG 2.1 AA):**
- [ ] IC1 conflict resolution modal keyboard navigable (Tab through all elements, Esc to close)
- [ ] IC1 screen reader announces conflict notifications ("3 unresolved conflicts" spoken by NVDA)
- [ ] IC3 admin panel passes WAVE accessibility checker (0 errors, 0 contrast errors)
- [ ] IC4 email templates have sufficient color contrast (buttons meet 4.5:1 ratio minimum)
- [ ] All form inputs have visible labels (not just placeholders)
- [ ] Focus indicators visible on all interactive elements (keyboard navigation shows blue outline)
- [ ] Error messages associated with form fields via aria-describedby

**Integration Validation:**
- [ ] End-to-end: Create subscription (IC2) → Calculates charity (IC2.5) → Sends confirmation email (IC4)
- [ ] End-to-end: Admin verifies charity (IC3) → User sees in dropdown → User selects → Contribution tracked (IC2.5)
- [ ] End-to-end: User comments with @mention (IC1) → Notification created (I2) → Email sent (IC4)
- [ ] IC1 + I1: Conflict resolution UI integrates with ConflictResolutionService (backend)
- [ ] IC2 + H1: Advisor subscription includes team member billing (multi-user feature)
- [ ] IC4 + IC2: Billing emails send correctly when subscription created (Stripe webhook → email trigger)

**Cross-Browser Validation:**
- [ ] IC1 UI components render correctly in Chrome (latest)
- [ ] IC1 UI components render correctly in Firefox (latest)
- [ ] IC1 UI components render correctly in Safari (latest)
- [ ] IC1 UI components render correctly in Edge (latest)
- [ ] IC2 Stripe checkout flow works in all major browsers (card input, submission)
- [ ] IC3 admin panel functional on tablet devices (iPad, 1024x768 resolution)
- [ ] IC4 email templates render correctly in Gmail, Outlook, Apple Mail (test send to all 3)
- [ ] Mobile responsive: Dashboard with IC features usable on iPhone SE (375px width)

**Success Criteria:**
✅ **ALL CHECKS PASSING** = Green light for Group J
❌ **ANY CHECK FAILING** = Block Group J until fixed

**This is the bridge to the moonshots. Cross it carefully.**

**Spec Reference:** IC-006 (new)

---

## Group J - Moonshots (Requires Infrastructure Capstone Complete)

### J1. Financial Flow Widget (Nice)
**What:** A 2D animated node-based visualization showing real-time money flow, accessible as a compact widget or full-screen experience.

**OpenSpec Resources:**
- Change: `openspec/changes/moonshot-features/`
- Proposal: `openspec/changes/moonshot-features/proposal.md`
- Tasks: `openspec/changes/moonshot-features/tasks.md`
- Specs: `openspec/changes/moonshot-features/specs/*/spec.md`

**Status & Ownership:**
- Status: Not Started
- Priority: Medium (Signature Feature)
- Owner: TBD

**Core Concept:**
The Financial Flow Widget lives in the upper-right corner of the application as an always-visible compact visualization. Users can click to expand it to full-screen for deeper exploration. It displays the user's financial ecosystem as interconnected nodes, with animated flows showing money movement in real-time.

**Primary Nodes (6 Categories):**
- **Assets** - What the business owns (Cash, AR, Inventory, Equipment)
- **Liabilities** - What the business owes (AP, Loans, Credit Cards)
- **Equity** - Owner's stake (Capital, Retained Earnings, Draws)
- **Revenue** - Money earned from sales and services
- **COGS** - Cost of Goods Sold (direct costs of products sold)
- **Expenses** - Operating costs (rent, payroll, utilities, etc.)

**Node Behavior:**
- Node SIZE indicates balance amount (bigger node = more money in that category)
- Hover reveals a breakout popover showing sub-accounts with clickable navigation
- Sub-nodes accessible when expanded: Cash, AR, AP, Inventory, etc.
- Layout reflects the accounting equation: Assets = Liabilities + Equity

**Animated Flows:**
Transactions trigger animated flows between nodes showing money movement:
| Transaction Type | Flow Direction |
|-----------------|----------------|
| Cash sale | Revenue → Cash |
| Invoice created | Revenue → AR |
| Customer payment | AR → Cash |
| Bill entered | Expenses → AP |
| Bill paid | Cash → AP |
| Buy inventory (cash) | Cash → Inventory |
| Buy inventory (credit) | AP → Inventory |
| Sell inventory | Inventory → COGS |
| Take out loan | Liabilities → Cash |
| Pay down debt | Cash → Liabilities |
| Owner investment | Equity → Cash |
| Owner draw | Cash → Equity (outward) |
| **Barter transaction** | **Revenue ↔ Expenses** (bidirectional) |

**Barter/Trade Transaction Support (I5 Integration):**
- **Conditional display**: Barter transactions only appear if user has active barter transactions in their books
- **If no barter activity**: Barter flows are hidden (dormant feature)
- **User toggle**: Settings panel includes "Show Barter Transactions" checkbox (default: auto, shows if active)
- **Visual representation**: Bidirectional arrow (↔) with "Trade" label
- **Example**: Trade $500 of services for $500 of products → Revenue ↔ Expenses flow with matching amounts
- **Color differentiation**: Barter flows use distinct color (e.g., orange) to distinguish from cash/accrual
- **Use case**: Landlords collecting rent in cash only can toggle barter OFF for cleaner visualization

**Visual Differentiation:**
- **Solid lines**: Actual cash movement
- **Dashed lines**: Accrual entries (invoices, bills - promises not yet cash)
- **Color-coded health indicators**: Green (healthy), Yellow (caution), Red (concern)
- Context matters: Big Revenue = good, Big Expenses = potentially concerning

**Ecosystem Toggle:**
Two-mode toggle allowing users to choose their view:
1. **Active Only** (default): Shows only the nodes/features they're currently using
2. **Full Ecosystem**: Reveals all possible nodes including inactive features (budgeting, barter accounting, debt management, product cost accounting, etc.)

Inactive nodes appear as "locked doors with windows" - visible, inviting, with a subtle shimmer or unlock icon. Not grayed-out or broken-looking, but aspirational opportunities.

**Date Range:**
- Default: Last 365 days
- Options: Last 30 days, Last 90 days, Year-to-date, Last year, All time, Custom range
- Custom range allows specific start/end date selection

**Widget States:**
1. **Compact** (default): Small widget in upper-right, shows primary nodes with proportional sizing
2. **Expanded**: Full-screen mode with larger nodes, visible sub-nodes, detailed hover states
3. **Time-lapse**: Animated playback of a period's transactions flowing through the system

**Color Customization:**
- Default palette: Purple, Gold, and Green (sophisticated, abundant, trustworthy)
- Users can customize any color via hex color picker
- Color assignments: Primary nodes, flow lines, health indicators, background
- Presets available: Default, High Contrast, Monochrome, Custom

**Acceptance Criteria:**
- [ ] Widget renders in upper-right corner without blocking primary content
- [ ] Click expands widget to full-screen mode smoothly
- [ ] Six primary nodes display with sizes proportional to balances
- [ ] Hover on any node reveals breakout popover with sub-accounts
- [ ] Clicking sub-account in popover navigates to that section
- [ ] Transactions trigger animated flows between appropriate nodes
- [ ] Animation queue prevents visual chaos from rapid transactions
- [ ] Solid vs dashed lines differentiate cash from accrual entries
- [ ] Toggle switches between "Active Only" and "Full Ecosystem" views
- [ ] Inactive feature nodes appear inviting with unlock affordance
- [ ] Date range selector defaults to Last 365 days with all options working
- [ ] Custom date range picker functions correctly
- [ ] Color customization panel accessible with hex picker
- [ ] Custom colors persist in user preferences
- [ ] Layout visually reflects accounting equation (Assets = Liabilities + Equity)
- [ ] Health indicators (color coding) accurately reflect financial status
- [ ] Screen reader descriptions provide full accessibility
- [ ] Performance remains smooth with 10K+ transactions
- [ ] Time-lapse mode animates historical transactions smoothly
- [ ] **Barter transactions display as bidirectional arrows (↔) with "Trade" label**
- [ ] **Barter flows only appear if user has active barter transactions (I5 integration)**
- [ ] **If no barter activity, barter flows are hidden (dormant)**
- [ ] **Settings panel includes "Show Barter Transactions" toggle (default: auto)**
- [ ] **Barter flows use distinct color (e.g., orange) to differentiate from cash/accrual**
- [ ] **User can manually toggle barter display ON/OFF regardless of activity**

**Test Strategy:**
- Unit tests for flow direction logic (all transaction types mapped correctly)
- Visual regression testing for node sizing calculations
- Animation performance testing with large transaction volumes (10K+)
- Accessibility testing with screen readers (NVDA, VoiceOver)
- Usability testing with non-accountant entrepreneurs
- Color contrast validation for all palette options
- Date range calculation accuracy testing
- Integration testing with real transaction data

**Risks & Mitigation:**
- Risk: Animation performance degrades with high transaction volume
  - Mitigation: Implement animation queue with batching, requestAnimationFrame optimization, Web Workers for calculations
- Risk: Users misinterpret "bigger = better" for all nodes
  - Mitigation: Clear health indicator colors, contextual tooltips explaining what healthy looks like
- Risk: Inactive feature nodes create FOMO or feel incomplete
  - Mitigation: Design as "coming attractions" not "missing features", warm inviting visual treatment
- Risk: Flow directions confuse users unfamiliar with double-entry accounting
  - Mitigation: Optional "explain this flow" tooltips, link to educational content
- Risk: Color customization creates accessibility issues
  - Mitigation: Warn when contrast ratios fall below WCAG thresholds, suggest alternatives

**External Dependencies:**
- Libraries: d3.js (force-directed graph), framer-motion (animations)
- No WebGL required (pure SVG/Canvas 2D)

**Dependencies:** {F4, D6, D7}

**Joy Opportunity:** "Watch your business breathe. See money flow through your company like a living ecosystem - every sale, every payment, every investment moving in real-time."

**Delight Detail:**
- Time-lapse mode: Watch a year of finances unfold as a beautiful choreographed flow
- First expansion celebration: Subtle confetti when user first goes full-screen
- Milestone animations: Special effects when Revenue node crosses thresholds
- "Breathing" idle animation: Nodes gently pulse when no transactions are flowing

**Includes:**
- Compact widget component
- Full-screen expansion mode
- Six primary nodes with sub-node expansion
- Animated transaction flows
- Solid/dashed line differentiation
- Health indicator system
- Ecosystem toggle (Active/Full)
- Date range selector with custom option
- Color customization panel with hex picker
- Time-lapse playback mode
- Accessibility descriptions
- Educational tooltips

**Spec Reference:** VIZ-001

---

### J2. Smart Automation Assistant (Nice)
**What:** AI that does tedious work for users, not AI that tells users what to think.

**OpenSpec Resources:**
- Change: `openspec/changes/moonshot-features/`
- Proposal: `openspec/changes/moonshot-features/proposal.md`
- Tasks: `openspec/changes/moonshot-features/tasks.md`
- Specs: `openspec/changes/moonshot-features/specs/*/spec.md`

**Status & Ownership:**
- Status: Not Started
- Priority: Medium (Signature Feature)
- Owner: TBD

**Design Philosophy:**
Research shows users value AI that removes tedious work, not AI that pushes opinions. G2 Research found chatbot-style "insights" score lowest among AI features (4.78/7), while auto-categorization, expense management, and pattern recognition score highest (5.2-5.46/7). Alert fatigue research shows a 30% drop in user attention for each repeated notification.

This feature focuses on: **"AI works for me"** not **"AI tells me what to think"**

**Core Features:**

1. **Smart Categorization** (Does Work For Them)
   - Learns from user's categorization patterns over time
   - Auto-suggests categories for new transactions based on vendor, amount, description
   - Improves accuracy the more the user corrects it
   - Never overrides user decisions - suggestions only

2. **Intelligent Reconciliation Matching** (Does Work For Them)
   - Goes beyond exact-amount matching to find probable matches
   - Considers timing patterns, vendor history, partial payments
   - Surfaces "likely matches" for user confirmation
   - Learns from user accept/reject behavior

3. **Anomaly Flagging** (Catches What They'd Miss)
   - Quietly flags transactions that don't fit established patterns
   - Subtle visual indicator (not alarming notifications)
   - Examples: Duplicate payments, unusual amounts for a vendor, transactions outside normal timing
   - User can dismiss flags; system learns from dismissals
   - NO unsolicited commentary on whether anomalies are "good" or "bad"

4. **Cash Flow Projection** (User-Initiated Tool)
   - Available when user asks for it, not pushed
   - Projects future cash position based on:
     - Recurring transactions (detected patterns)
     - Outstanding invoices and bills
     - Historical seasonality
   - Shows confidence ranges, not false precision
   - User controls assumptions and can adjust

5. **Vendor & Customer Pattern Memory** (Invisible Efficiency)
   - Remembers typical amounts, categories, and timing per vendor/customer
   - Pre-fills forms based on history
   - Detects when a vendor's typical invoice amount changes significantly
   - Learns payment timing patterns for cash flow accuracy

**What This Feature Does NOT Include:**
- ~~Natural language "insights" pushed to users~~ (cut - lowest user satisfaction)
- ~~Proactive trend commentary~~ (cut - becomes noise)
- ~~"Your expenses are up!" notifications~~ (cut - judgmental, creates anxiety)
- ~~AI-generated advice or recommendations~~ (cut - users don't trust it for financial decisions)
- ~~Chatbot interface~~ (cut - scores lowest in research)

**User Control Principles:**
- All AI features can be disabled individually or entirely
- AI never takes action without user confirmation
- User corrections always override AI suggestions
- No data leaves the device for AI processing (local-first)
- Clear indication when AI is making a suggestion vs. showing raw data

**Acceptance Criteria:**
- [ ] Smart categorization suggests categories with 80%+ accuracy after 100 transactions
- [ ] Reconciliation matching surfaces probable matches beyond exact amounts
- [ ] Anomaly flags appear as subtle visual indicators, not notifications
- [ ] Anomaly detection has <10% false positive rate after learning period
- [ ] Cash flow projection available on-demand (not pushed)
- [ ] Cash flow shows confidence ranges for all projections
- [ ] Vendor/customer patterns pre-fill forms accurately
- [ ] All AI features can be individually disabled in settings
- [ ] AI corrections improve model accuracy (learning loop verified)
- [ ] Zero data transmitted externally for AI processing
- [ ] Performance remains fast (<200ms for suggestions)

**Test Strategy:**
- Categorization accuracy testing with diverse transaction sets
- Reconciliation matching precision/recall measurement
- False positive rate monitoring for anomaly detection
- User acceptance testing: do users find suggestions helpful or annoying?
- Learning loop validation: does accuracy improve over time?
- Privacy verification: confirm no external data transmission
- Performance benchmarking with large datasets

**Risks & Mitigation:**
- Risk: Suggestions become annoying despite best intentions
  - Mitigation: Subtle presentation, easy dismissal, respect for user overrides, granular disable options
- Risk: Users don't trust AI with financial data
  - Mitigation: 100% local processing, transparent about what AI does, user always in control
- Risk: AI suggestions are wrong and create more work
  - Mitigation: High confidence thresholds, clear "suggestion" vs "fact" distinction, easy correction flow
- Risk: Learning loop creates filter bubble (only sees what it expects)
  - Mitigation: Periodic pattern refresh, anomaly detection specifically looks for unexpected

**External Dependencies:**
- Libraries: tensorflow.js (local inference only)
- Services: None (all processing local)
- Infrastructure: None

**Dependencies:** {F1, F4, G1}

**Joy Opportunity:** "The tedious parts of bookkeeping just... disappear. You categorize a few transactions, and the system learns. You reconcile a few matches, and it gets smarter. The AI works quietly in the background so you can focus on your business."

**Delight Detail:**
- Satisfaction of watching accuracy improve over time
- "Learning progress" indicator shows AI getting smarter from your input
- Rare, genuine catches: "Heads up - this looks like a duplicate payment to [Vendor]" (only when confidence is high)

**Includes:**
- Smart transaction categorization (learns from user)
- Intelligent reconciliation matching (probable matches)
- Subtle anomaly flagging (no alarms, no judgment)
- On-demand cash flow projection (user-initiated)
- Vendor/customer pattern memory (invisible efficiency)
- Per-feature disable toggles
- Local-only processing (zero external data transmission)

**Spec Reference:** AI-001 (revised)

---

### J3. Building the Dream Scenarios (Nice)
**What:** Professional-grade scenario modeling tool that pulls live book data, allows accountants to model complex what-if decisions, and delivers interactive results to clients.

**OpenSpec Resources:**
- Change: `openspec/changes/moonshot-features/`
- Proposal: `openspec/changes/moonshot-features/proposal.md`
- Tasks: `openspec/changes/moonshot-features/tasks.md`
- Specs: `openspec/changes/moonshot-features/specs/*/spec.md`

**Status & Ownership:**
- Status: Not Started
- Priority: Medium (Professional Feature)
- Owner: TBD

**Design Philosophy:**
This is an accountant-level tool designed for professionals who regularly field "what if" questions from clients. Instead of exporting to spreadsheets, building manual models, and emailing PDFs back, accountants can model scenarios directly in the software with live book data and push interactive results to clients.

**Not gatekept:** Any user can access this feature if they want it, but it's designed at professional knowledge level and lives in its own dedicated section.

**Core Concept:**

```
┌─────────────────────────────────────────────────────────────┐
│  BUILDING THE DREAM SCENARIOS                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Current Books (Baseline)     →    Adjustments    →    Projected Result
│  ─────────────────────────         ────────────        ─────────────────
│  • P&L snapshot                    • Template or       • Updated P&L
│  • Balance Sheet                     freeform changes  • Updated Balance Sheet
│  • Cash position                   • Accounting-aware  • Cash flow impact
│  • Payroll data                    • Layerable         • Key metrics delta
│  • Invoicing/AR                                             │
│  • Products/Services                                        │
│  • Vendors/AP                                               │
│                                                             │
│  [Refresh Baseline]           [Add Adjustment]      [Push to Client]
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**How It Works:**

1. **Pull Baseline from Books**
   - Snapshot of current financials (P&L, Balance Sheet, Cash)
   - Operational data (Payroll, Invoicing/AR, Products/Services, Vendors/AP)
   - Baseline is refresh-able - can update with latest actuals anytime
   - Clear timestamp showing when baseline was captured

2. **Build Adjustments (Templates + Freeform)**

   **Scenario Templates** (common what-if questions):
   - Reclassify Employee to Owner
   - Add New Employee
   - Remove Employee/Position
   - Change Compensation
   - Add Recurring Expense
   - Remove Recurring Expense
   - Change Pricing/Revenue
   - Take on Debt/Loan
   - Pay Off Debt
   - Major Equipment Purchase
   - Lease vs. Buy Analysis
   - Add New Revenue Stream

   **Freeform Adjustments:**
   - Direct line-item modifications (like a spreadsheet)
   - Reference actual accounts from chart of accounts
   - Create formulas that calculate based on other values
   - Full flexibility for edge cases templates don't cover

3. **Accounting-Aware Impact Calculation**
   - System understands double-entry relationships
   - "Reclassify Employee to Owner" automatically:
     - Removes salary from Expenses
     - Removes employer payroll tax obligations
     - Adds owner distribution line in Equity
     - Recalculates profit impact
     - Shows estimated tax liability change
     - Adjusts cash flow timing
   - Downstream impacts calculated automatically

4. **Interactive Results View**
   - Side-by-side: Current | Adjustment | Projected
   - Visual indicators for positive/negative changes
   - Key metrics summary (profit change, cash impact, tax estimate)
   - Drill-down into any line item
   - Notes/annotations on specific items (accountant can explain)

5. **Push to Client Workflow**
   - Accountant marks scenario as "Ready for Client"
   - Customizable email notification composed in-app
   - Email includes accountant's notes, context, recommendations
   - Client receives notification with link to interactive view
   - Client can explore the scenario (read-only or with permitted adjustments)
   - Client can leave questions/comments for follow-up

**The Worksheet Interface:**
- Familiar grid layout for accountants (Excel-like comfort)
- Columns: Account | Current | Adjustment | Projected | Notes
- Formulas supported (reference other cells, book accounts)
- Color coding: increases (green), decreases (red), neutral (gray)
- Expandable sections by account category
- Print/export option for those who need paper

**Client Experience:**
- Receives email: "Your scenario is ready to review"
- Opens dedicated view in their Graceful Books account
- Sees clean, understandable presentation of the scenario
- Can toggle between summary view and detailed view
- Can read accountant's notes explaining the changes
- Can leave comments/questions
- Cannot modify the accountant's work (view + comment only, unless granted edit access)

**Acceptance Criteria:**
- [ ] Baseline pulls accurate snapshot from current books
- [ ] Baseline can be refreshed with latest book data
- [ ] At least 10 scenario templates available at launch
- [ ] Freeform adjustments allow direct line-item modification
- [ ] Freeform supports formulas referencing accounts and cells
- [ ] Template adjustments calculate downstream impacts automatically
- [ ] Side-by-side view shows Current | Adjustment | Projected clearly
- [ ] Notes can be added to any line item or section
- [ ] Push-to-client sends customizable email notification
- [ ] Client receives interactive view (not just PDF)
- [ ] Client can leave comments on the scenario
- [ ] Scenarios are saved and can be revisited/edited
- [ ] Multiple scenarios can exist for one client
- [ ] Print/export produces clean professional output
- [ ] All calculations maintain accounting equation balance

**Test Strategy:**
- Unit tests for adjustment calculation engine
- Unit tests for each scenario template's downstream impacts
- Integration tests: baseline pull accuracy matches live books
- Integration tests: push-to-client email delivery and link
- E2E tests: full workflow from baseline to client view
- Calculation validation against manual spreadsheet models
- Usability testing with professional accountants
- Client comprehension testing for interactive view

**Risks & Mitigation:**
- Risk: Complex feature may be difficult to build and maintain
  - Mitigation: Start with 5 core templates, expand based on usage data
- Risk: Accountants may still prefer their spreadsheets
  - Mitigation: Make import/export easy, don't force workflow change, prove value
- Risk: Calculation errors could damage accountant-client trust
  - Mitigation: Extensive testing, show work/formulas, allow manual override
- Risk: Client may be overwhelmed by detailed financial view
  - Mitigation: Default to summary view, detailed view optional, accountant notes provide context

**External Dependencies:**
- Libraries: decimal.js (precise calculations), handsontable or similar (grid interface)
- Infrastructure: Email service for notifications

**Dependencies:** {F4, H1, J7}

**Joy Opportunity:** "Your client asks 'What if I moved Sarah from employee to owner?' Instead of spending an hour in Excel, you model it in minutes with their actual numbers, add your notes, and push them an interactive view. They see exactly what changes and why. That's the kind of service that builds loyalty."

**Delight Detail:**
- Scenario names can be personalized: "Sarah's Ownership Transition" or "The Big Expansion"
- Client sees a polished, professional deliverable - reflects well on the accountant
- Accountant can save favorite templates for quick reuse
- "Last refreshed" indicator so everyone knows how current the baseline is

**Includes:**
- Dedicated "Building the Dream Scenarios" section
- Baseline snapshot from live books (refresh-able)
- Scenario template library (10+ common what-ifs)
- Freeform adjustment worksheet (Excel-like)
- Accounting-aware downstream impact calculation
- Side-by-side comparison view
- Notes/annotations system
- Push-to-client workflow
- Customizable client notification email
- Interactive client view with comments
- Print/export functionality
- Scenario history and versioning

**Spec Reference:** SCENARIO-001 (revised)

**Spec Reference:** AI-002 (from Ideas)

---

### J4. Key Financial Metrics Reports (Nice)
**What:** Professional reporting tool for accountants to pull meaningful financial metrics, analyze trends, and prepare for client communication.

**OpenSpec Resources:**
- Change: `openspec/changes/moonshot-features/`
- Proposal: `openspec/changes/moonshot-features/proposal.md`
- Tasks: `openspec/changes/moonshot-features/tasks.md`
- Specs: `openspec/changes/moonshot-features/specs/*/spec.md`

**Status & Ownership:**
- Status: Not Started
- Priority: Medium (Professional Feature)
- Owner: TBD

**Design Philosophy:**
Most business owners don't care about financial ratios and metrics - they care about "is my business doing okay?" and "what should I do?" The translation from metrics to meaning is the accountant's job. This tool helps accountants prepare for those conversations by giving them the data they need in a clear, professional format.

**Not a score.** Not gamified. Not pushed to users. Just useful data for professionals who know how to interpret it.

**Core Metrics Reports:**

1. **Liquidity Report**
   - Current Ratio (Current Assets / Current Liabilities)
   - Quick Ratio (Liquid Assets / Current Liabilities)
   - Working Capital
   - Cash Runway (months of operating expenses covered)
   - Trend over time (monthly/quarterly)

2. **Profitability Report**
   - Gross Profit Margin
   - Net Profit Margin
   - Operating Margin
   - Revenue per Employee (if payroll data available)
   - **Barter Revenue (if active)**: Fair market value of barter transactions included in revenue
   - **Barter Toggle**: User can include/exclude barter from revenue calculations
   - Trend over time

3. **Efficiency Report**
   - Accounts Receivable Turnover
   - Days Sales Outstanding (DSO)
   - Accounts Payable Turnover
   - Inventory Turnover (if applicable)
   - Trend over time

4. **Leverage Report**
   - Debt-to-Equity Ratio
   - Debt-to-Assets Ratio
   - Interest Coverage Ratio
   - Trend over time

5. **Summary Dashboard** (Accountant View)
   - All key metrics on one page
   - Traffic light indicators (green/yellow/red) for quick scanning
   - Trend arrows (improving/stable/declining)
   - Customizable date range

**Report Features:**

- **Period Comparison:** This quarter vs. last quarter, YoY, custom ranges
- **Trend Visualization:** Simple charts showing metric movement over time
- **Explanations Toggle:** Each metric has a plain-English explanation (helps accountant explain to client)
- **Notes Field:** Accountant can add their interpretation/context before sharing
- **Industry Context (Optional):** When available, show typical ranges for the industry (accountant decides whether to include)
- **Export Options:** PDF, Excel, or shareable link

**Sharing with Clients:**

- Accountant decides if/when to share with client
- Can share full report or selected metrics only
- Accountant's notes included to provide context
- Client sees a clean, understandable presentation
- No "score" or judgment language - just "here are your numbers"

**What This Feature Does NOT Include:**
- ~~0-100 health score~~ (reductive and judgmental)
- ~~"Your score went up!" celebrations~~ (patronizing)
- ~~Unsolicited recommendations~~ (noise)
- ~~Auto-push to business owners~~ (they don't want it)
- ~~Gamification of any kind~~ (this is professional tooling)

**Acceptance Criteria:**
- [ ] Liquidity report calculates all metrics accurately
- [ ] Profitability report calculates all metrics accurately
- [ ] Efficiency report calculates all metrics accurately
- [ ] Leverage report calculates all metrics accurately
- [ ] Summary dashboard displays all key metrics on one view
- [ ] Trend visualization shows metric changes over time
- [ ] Period comparison allows flexible date range selection
- [ ] Plain-English explanations available for each metric
- [ ] Accountant can add notes before sharing
- [ ] Sharing with client works (link or PDF)
- [ ] Client view is clean and understandable
- [ ] Export to PDF and Excel functions correctly
- [ ] Industry benchmarks display when available and selected
- [ ] **Barter revenue included in profitability calculations (when toggle ON)**
- [ ] **Barter transactions marked with trade icon (↔) in revenue breakdown**
- [ ] **Barter toggle only appears if user has active barter transactions (I5 integration)**
- [ ] **If no barter activity, toggle is hidden (dormant feature)**
- [ ] **User can exclude barter from revenue metrics via toggle (default: included)**
- [ ] **Revenue breakdown clearly separates cash revenue, accrual revenue, and barter revenue**

**Test Strategy:**
- Unit tests for each metric calculation (verify against manual calculation)
- Integration tests for data pull accuracy from books
- E2E tests for report generation and sharing workflow
- Validation against accounting standards for ratio calculations
- Usability testing with professional accountants
- Client comprehension testing for shared reports

**Risks & Mitigation:**
- Risk: Metric calculations may differ from accountant's preferred method
  - Mitigation: Document calculation methodology, allow custom formulas in future
- Risk: Industry benchmarks may not be relevant or accurate
  - Mitigation: Make benchmarks optional, clearly source them, let accountant decide
- Risk: Accountants may already have preferred tools for this
  - Mitigation: Focus on integration with the books (no manual data entry), easy export

**External Dependencies:**
- Libraries: chart.js or similar (trend visualization)
- Infrastructure: None

**Dependencies:** {F4, D6, D7, F5, F6}

**Joy Opportunity:** "Walking into a client meeting prepared. You've got the numbers, you've got the trends, you've added your notes. The conversation is about their business, not fumbling through spreadsheets."

**Delight Detail:**
- One-click report generation (no configuration required for standard reports)
- "Last generated" timestamp so accountant knows if data is fresh
- Accountant can save report preferences per client
- Print-optimized layout for those who like paper in meetings

**Includes:**
- Liquidity metrics report
- Profitability metrics report
- Efficiency metrics report
- Leverage metrics report
- Summary dashboard (all metrics, one view)
- Period comparison
- Trend visualization
- Plain-English metric explanations
- Accountant notes field
- Optional industry benchmarks
- Client sharing (link or PDF)
- Export (PDF, Excel)

**Spec Reference:** METRICS-001 (revised from HEALTH-001)

---

### J5. Financial Goals (Nice)
**What:** Simple, personal goal tracking for business owners who want to set targets and watch their progress - no spreadsheets required.

**OpenSpec Resources:**
- Change: `openspec/changes/moonshot-features/`
- Proposal: `openspec/changes/moonshot-features/proposal.md`
- Tasks: `openspec/changes/moonshot-features/tasks.md`
- Specs: `openspec/changes/moonshot-features/specs/*/spec.md`

**Status & Ownership:**
- Status: Not Started
- Priority: Medium (User Feature)
- Owner: TBD

**Design Philosophy:**
This is an **inactive feature** users can activate when they're ready. Part of the vision: all financial aspects of running a business in one place, flexible and customizable, no more endless confusing spreadsheets.

Goals are self-set, self-directed, and private. The system tracks quietly and celebrates when you hit them. No judgment, no pressure, no excessive notifications - just a simple way to aim for something and see your progress.

**Finances deserve more joy.** Confetti stays.

**Core Concept:**

Simple goal cards that show:
```
┌─────────────────────────────────────────┐
│  🎯 Q1 Revenue Target                   │
│                                         │
│  Target: $50,000                        │
│  Current: $37,250                       │
│  ████████████░░░░░░░░  74.5%           │
│                                         │
│  $12,750 to go · 47 days remaining     │
└─────────────────────────────────────────┘
```

**Goal Types:**
- **Revenue Target** - Hit a revenue number by a date
- **Profit Target** - Reach a profit margin or amount
- **Expense Budget** - Keep expenses under a limit
- **Savings Target** - Build up cash reserves to a target
- **Debt Payoff** - Pay down a debt by a date
- **Custom Goal** - Any metric they want to track

**How It Works:**

1. **Set a Goal**
   - Choose type or create custom
   - Set target amount
   - Set timeframe (monthly, quarterly, annual, or custom end date)
   - Optional: add a personal note about why this goal matters

2. **Watch Progress**
   - Progress bar fills as they get closer
   - Current vs. target always visible
   - "X to go" and "Y days remaining" for context
   - Updates automatically from their books (no manual entry)

3. **Hit the Goal**
   - 🎉 Confetti celebration
   - Goal moves to "Achieved" section
   - Option to set a new goal or increase the target

**Notification Philosophy:**
- **NO milestone spam** (no 25%, 50%, 75% notifications)
- **ONE notification**: When you hit your goal (celebration!)
- **Optional gentle reminder**: If enabled, a single "30 days left on your Q1 goal" nudge
- Users control all notifications in settings

**What This Feature Does NOT Include:**
- ~~Notifications at every milestone~~ (noise)
- ~~AI-suggested goals~~ (patronizing)
- ~~Comparisons to other users~~ (judgmental)
- ~~Pressure tactics~~ ("You're falling behind!")
- ~~Complex goal hierarchies~~ (keep it simple)

**Goal Dashboard:**
- Active goals displayed as simple cards
- Achieved goals in a separate "wins" section
- Archive for past goals (history preserved)
- Clean, motivating, not overwhelming

**Acceptance Criteria:**
- [ ] Users can create goals for revenue, profit, expenses, savings, debt, and custom metrics
- [ ] Progress bar updates automatically from book data
- [ ] Target, current, percentage, and "to go" amounts display clearly
- [ ] Timeframe countdown shows days remaining
- [ ] Goal achievement triggers confetti celebration
- [ ] Achieved goals move to "wins" section
- [ ] Goal history is preserved and viewable
- [ ] Notifications are limited to achievement (and optional reminder)
- [ ] Users can edit or delete goals at any time
- [ ] Feature is inactive by default, user activates when ready
- [ ] Custom goals allow tracking any numeric metric

**Test Strategy:**
- Unit tests for progress calculation from book data
- Integration tests for automatic progress updates
- E2E tests for complete goal lifecycle (create → track → achieve)
- Confetti animation testing
- Notification delivery testing (achievement only)
- User comprehension testing

**Risks & Mitigation:**
- Risk: Users may set unrealistic goals and feel bad
  - Mitigation: No judgment when goals aren't met, easy to adjust, celebrate progress not just completion
- Risk: Goal tracking adds pressure instead of motivation
  - Mitigation: Optional feature, calm presentation, no nagging, user fully in control
- Risk: Progress calculation may not match user's mental model
  - Mitigation: Show calculation transparently, allow manual adjustment if needed

**External Dependencies:**
- Libraries: canvas-confetti
- Infrastructure: None

**Dependencies:** {F4, C4}

**Joy Opportunity:** "You set a goal. You worked toward it. You hit it. Confetti explodes. That's it - that's the feature. Simple, satisfying, yours."

**CONFETTI MOMENT:** Goal achievement = full confetti celebration. 🎉

**Delight Detail:**
- "Wins" section becomes a visual record of what you've accomplished
- Goal cards are designed to feel motivating, not stressful
- Option to add a personal note: "This one's for the new equipment fund"
- Confetti colors can match your color preferences from J1

**Includes:**
- Goal creation (revenue, profit, expense budget, savings, debt payoff, custom)
- Progress visualization (bar, percentage, "to go" amount)
- Timeframe tracking (days remaining)
- Achievement celebration (confetti)
- Goal history / "Wins" section
- Minimal notifications (achievement only + optional reminder)
- Inactive by default (user activates)

**Spec Reference:** GOAL-001 (revised)

---

### J6. Emergency Fund & Runway Calculator (Nice)
**What:** Know how long your business can survive - not to scare you, but to help you plan.

**OpenSpec Resources:**
- Change: `openspec/changes/moonshot-features/`
- Proposal: `openspec/changes/moonshot-features/proposal.md`
- Tasks: `openspec/changes/moonshot-features/tasks.md`
- Specs: `openspec/changes/moonshot-features/specs/*/spec.md`

**Status & Ownership:**
- Status: Not Started
- Priority: Medium (Moonshot)
- Owner: TBD

**Design Philosophy:**
"How long can my business survive if revenue stops?" is one of the most anxiety-inducing questions an entrepreneur faces. Traditional financial tools either ignore this entirely or present it in terrifying terms ("You're running out of money!").

This feature reframes runway from a scary countdown into **actionable planning information**. It's not about fear - it's about knowing your position so you can make confident decisions.

**Inactive by default.** Users activate this when they're ready to think about it. No unsolicited "your runway is shrinking!" notifications. Just a calm, clear tool available when they need it.

**Core Concept:**

The Runway Dashboard shows three key numbers in a clean, visual format:

```
┌─────────────────────────────────────────────────────────┐
│  YOUR RUNWAY                                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Current Cash: $42,300                                  │
│  Monthly Burn: $8,200                                   │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  │     5.2 months of runway                       │    │
│  │                                                 │    │
│  │     ████████████████░░░░░░░░░░░░  5.2 / 12    │    │
│  │                                                 │    │
│  │     Based on last 90 days average burn rate    │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  [Adjust Assumptions]  [Explore Scenarios]              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**How Runway is Calculated:**

**Three calculation methods** (user can choose or compare):

1. **Simple Average** (default)
   - Average monthly expenses over last 90 days
   - Easiest to understand
   - Good for stable businesses

2. **Trend-Adjusted**
   - Accounts for increasing or decreasing burn rate trends
   - Better for growing/scaling businesses
   - Shows: "Your burn is increasing 8% per month"

3. **Seasonal**
   - Factors in seasonal patterns if detected
   - Useful for businesses with predictable cycles
   - Requires 12+ months of history

**System automatically suggests the most appropriate method based on business patterns.**

**Transparency is key:** Users can see exactly how the number is calculated, click to view the underlying transactions, and adjust assumptions.

**Understanding Your Net Burn:**

Runway isn't just about expenses - it's about the gap between what comes in and what goes out.

```
┌─────────────────────────────────────────────────────────┐
│  YOUR CASH FLOW PICTURE                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Showing averages from: [Last 365 days ▼]              │
│  (Options: Last 30 days, Last 90 days, Last 365 days,  │
│   Year-to-date, Last year, All time, Custom range)      │
│                                                          │
│  Monthly Revenue (avg):        $12,400                  │
│  Monthly Expenses (avg):       $8,200                   │
│  ─────────────────────────────────────                  │
│  Net Burn:                     +$4,200 (positive!)      │
│                                                          │
│  ✓ You're cash-flow positive - runway is extending     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

Or for a business burning cash:

```
┌─────────────────────────────────────────────────────────┐
│  YOUR CASH FLOW PICTURE                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Showing averages from: [Last 365 days ▼]              │
│                                                          │
│  Monthly Revenue (avg):        $6,100                   │
│  Monthly Expenses (avg):       $8,200                   │
│  ─────────────────────────────────────────────────────  │
│  Net Burn:                     -$2,100 (burning)        │
│                                                          │
│  Current Cash: $42,300                                  │
│  Runway at current burn: ~20 months                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Revenue Flexibility is Critical:**

Just like with expenses, users need to model revenue changes:

**Revenue Breakdown:**
- See which clients/customers contribute what percentage
- See which products/services drive revenue
- Identify concentration risk ("80% from one client")
- Spot trends (growing, stable, declining)

**Quick Revenue Visibility:**
```
┌─────────────────────────────────────────────────────────┐
│  REVENUE SOURCES                                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Acme Corp retainer          $4,000/mo    32%          │
│  Widget sales                $3,200/mo    26%          │
│  Consulting projects         $2,800/mo    23%          │
│  Other clients               $2,400/mo    19%          │
│                                                          │
│  ⚠️  High concentration: One client = 32% of revenue    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Emergency Fund Recommendations:**

Instead of one-size-fits-all advice, recommendations are **contextualized to business type and risk profile**:

```
┌─────────────────────────────────────────────────────────┐
│  RECOMMENDED RUNWAY TARGET                               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  For service businesses with recurring revenue:         │
│  → 3-6 months (lower risk)                              │
│                                                          │
│  Your current runway: 5.2 months ✓                      │
│  You're in a healthy range.                             │
│                                                          │
│  Want to sleep even better? Here's how to reach 6:     │
│  • Reduce monthly burn by $1,200, OR                    │
│  • Add $7,400 to cash reserves                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Business type recommendations:**
- Service businesses (recurring revenue): 3-6 months
- Product businesses (inventory risk): 6-9 months
- Seasonal businesses: 9-12 months
- High-growth startups: 12-18 months
- Bootstrapped solopreneurs: 6-12 months

Users can override these if their situation is different. No judgment, just guidance.

**Scenario Modeling (Revenue + Expenses):**

"What if" scenarios cover **both sides** of the equation:

**Revenue Scenarios:**
- "What if I lost my biggest client?" (automatic - detects top client)
- "What if I stopped carrying [Product Line]?"
- "What if I landed a new $X/month retainer?"
- "What if I raised prices by 10%?"
- "What if seasonal revenue drops by 30% next quarter?"
- "What if this project ends and isn't renewed?"

**Expense Scenarios:**
- "What if I cut this recurring expense?"
- "What if I hired a part-time assistant?"
- "What if I delayed this large purchase?"
- "What if I reduced my owner's draw temporarily?"
- "What if rent increases by $500/month?"

**Combined Scenarios:**
- "Lose a client AND cut related expenses"
- "New revenue stream AND needed new tool"
- "Raise prices AND invest in marketing"

Each scenario shows the **net burn impact** and resulting **runway change**:

```
┌─────────────────────────────────────────────────────────┐
│  SCENARIO: Lost Acme Corp Retainer                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Current Net Burn:    +$4,200/month (positive)         │
│  After losing client: -$200/month (burning)            │
│                                                          │
│  Current Runway:      Extending indefinitely ✓          │
│  New Runway:          ~211 months (17.6 years)         │
│                                                          │
│  This would hurt, but you'd have time to replace them.  │
│                                                          │
│  [Add expense cuts to explore mitigation]               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Interactive Dual-Slider Interface:**

Side-by-side sliders for revenue and expenses - drag either to see impact:

```
┌─────────────────────────────────────────────────────────┐
│  EXPLORE YOUR RUNWAY                                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Monthly Revenue:                                        │
│  ◄──────●────────────► $12,400                          │
│          $0        $20,000                               │
│                                                          │
│  Monthly Expenses:                                       │
│  ◄──────────●────────► $8,200                           │
│          $0        $20,000                               │
│  ─────────────────────────────────                      │
│  Net Burn:  +$4,200/mo                                  │
│  Runway:    Extending ✓                                 │
│                                                          │
│  Try it: What if revenue dropped to $10k?               │
│  → Drag the revenue slider left and watch runway change │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Smart Scenario Buttons:**
Based on actual book data, system suggests relevant scenarios:

- "Your biggest client is Acme Corp ($4k/mo). Model losing them?"
- "Widget sales = 26% of revenue. Model discontinuing?"
- "Your top expense is rent ($2,400/mo). Model moving?"

One click applies that scenario. Instantly see the runway impact.

**Alerts & Notifications:**

**User-configured thresholds only.** The system never decides when to alert you.

Setup example:
```
Notify me when runway falls below: [3] months
How: [ ] Email  [✓] In-app  [ ] Both
Frequency: Once when threshold is crossed (not repeatedly)
```

**Alert tone is calm and helpful:**
- ✓ "Heads up: Your runway is now at 2.8 months. Would you like to explore some scenarios?"
- ✗ "WARNING: You're running out of money!"

**What This Feature Does NOT Include:**

- ~~Unsolicited "your runway is shrinking" notifications~~ (anxiety-inducing, noise)
- ~~Default alerts~~ (user must explicitly opt in)
- ~~Comparison to other businesses~~ (not helpful, potentially discouraging)
- ~~Pressure tactics~~ ("You should have 12 months!")
- ~~Automatic negative framing~~ ("Only 3 months left!")
- ~~Complex financial modeling~~ (keep it accessible)

**Visual Representation:**

Two visualization options:

1. **Runway Bar** (default)
   - Simple progress bar showing months of runway
   - Reference line at user's target (e.g., 6 months)
   - Color coding: Green (above target), Yellow (near target), Red (below threshold)

2. **Runway Timeline**
   - Calendar view showing projected cash depletion
   - Marks the date cash reaches zero based on current burn
   - Shows major upcoming expenses and expected revenue
   - Visual "what if" overlay when exploring scenarios

**Both show confidence ranges** - not false precision:
- "5-6 months" instead of "5.2 months" if volatility is high
- Explanation: "Your expenses vary quite a bit month to month, so this is an estimate range."

**Educational Content:**

Throughout the feature, plain-English explanations:

- **Burn rate:** "How much cash your business uses each month"
- **Runway:** "How long your business can operate at current spending before running out of cash"
- **Emergency fund:** "Cash reserves set aside to cover slow months or unexpected expenses"
- **Net burn:** "Revenue minus expenses - positive means you're building cash, negative means you're using it"

**Why this matters:** Tooltip explaining why runway awareness helps make better decisions about hiring, investing, pricing, etc.

**Acceptance Criteria:**

- [ ] Runway calculation uses three methods: Simple Average, Trend-Adjusted, Seasonal
- [ ] System suggests most appropriate calculation method based on business patterns
- [ ] Calculation methodology is fully transparent with "show me how" breakdown
- [ ] Users can click through to see underlying transactions
- [ ] Users can adjust calculation assumptions (date range, included accounts)
- [ ] Cash Flow Picture includes date range selector with options: Last 30 days, Last 90 days, Last 365 days (default), Year-to-date, Last year, All time, Custom range
- [ ] Date range selection updates both revenue and expense averages
- [ ] Monthly revenue calculation uses same three methods as expenses (Simple, Trend-Adjusted, Seasonal)
- [ ] Revenue breakdown shows top clients/customers by contribution percentage
- [ ] Revenue breakdown shows top products/services by contribution percentage
- [ ] Concentration risk warning displays when any client >25% or product >40% of revenue
- [ ] Revenue trend indicator shows growing/stable/declining with percentage
- [ ] Emergency fund recommendations are personalized to business type
- [ ] Users can override recommended runway target
- [ ] Business type selection available with common recommendations
- [ ] Scenario templates include both revenue and expense changes
- [ ] Revenue-specific scenarios auto-populate from actual book data (top client, top product)
- [ ] Combined scenarios allow modeling revenue + expense changes together
- [ ] Scenario modeling allows "what if" exploration with immediate runway impact
- [ ] Quick scenario templates available (new contract, expense reduction, client loss, etc.)
- [ ] Interactive dual-sliders adjust revenue/expenses and update runway in real-time
- [ ] Net burn calculation is transparent: Revenue - Expenses = Net Burn
- [ ] Positive net burn (cash flow positive) is celebrated appropriately
- [ ] Runway calculation handles both positive and negative net burn correctly
- [ ] Revenue volatility is factored into confidence ranges
- [ ] Users can exclude one-time revenue windfalls from projections
- [ ] Recurring vs. project revenue can be analyzed separately
- [ ] Threshold alerts are user-configured only (opt-in, never automatic)
- [ ] Alert tone is calm and helpful, never alarmist
- [ ] Alerts trigger only once when crossing threshold (not repeatedly)
- [ ] Runway bar visualization shows current vs. target clearly
- [ ] Runway timeline view displays projected depletion date and major cash events
- [ ] Confidence ranges shown when expense/revenue volatility is high
- [ ] Color coding (green/yellow/red) respects user-defined thresholds
- [ ] Plain-English explanations available for all financial terms
- [ ] Educational content explains why runway awareness matters
- [ ] Feature is inactive by default, user activates when ready
- [ ] Smart scenario buttons suggest relevant scenarios from actual book data
- [ ] All calculations maintain decimal precision
- [ ] Performance remains fast (<500ms for scenario updates)

**Test Strategy:**
- Unit tests for all three runway calculation methods
- Unit tests for net burn calculation (revenue - expenses)
- Validation against known business scenarios (volatile, stable, seasonal, cash-positive, cash-negative)
- Scenario modeling accuracy testing (slider changes produce correct projections)
- Revenue breakdown accuracy testing (client/product contribution percentages)
- Concentration risk detection testing
- Date range selection accuracy (verify averages match selected period)
- E2E tests for complete workflow (activate → configure → set threshold → receive alert)
- E2E tests for revenue and expense scenario modeling
- Calculation transparency testing (verify breakdown matches actual calculation)
- User comprehension testing with non-financial entrepreneurs
- Anxiety assessment (does this feature reduce or increase stress?)
- Confidence range accuracy validation
- Dual-slider interaction testing

**Risks & Mitigation:**
- Risk: Runway calculations may cause anxiety despite best intentions
  - Mitigation: Inactive by default, calm presentation, focus on actionable scenarios, educational framing
- Risk: Volatile expenses or revenue make projections unreliable
  - Mitigation: Multiple calculation methods, confidence ranges, trend smoothing, transparent assumptions, date range flexibility
- Risk: Users may not understand burn rate, net burn, or runway concepts
  - Mitigation: Plain English everywhere, visual explanations, examples, "why this matters" context
- Risk: False precision creates false confidence or unnecessary alarm
  - Mitigation: Show confidence ranges when appropriate, explain volatility, conservative estimates
- Risk: Seasonal businesses may get inaccurate projections
  - Mitigation: Seasonal calculation method, ability to exclude outlier months, manual override options, date range selection
- Risk: Revenue concentration warnings may discourage users
  - Mitigation: Frame as "awareness" not "problem", educational context about diversification benefits

**External Dependencies:**
- Libraries: decimal.js (precise calculations), date-fns (date handling), chart.js (timeline view)
- Infrastructure: None

**Dependencies:** {F4}

**Joy Opportunity:** "5.2 months of runway. That number means you can confidently invest in that new tool, take on that big project, or weather a slow season. Knowledge is power."

**Delight Detail:**
- First time user activates feature, gentle intro: "Let's figure out your runway together. This won't take long."
- Scenario modeling is satisfying - drag a slider, watch runway extend
- Reaching runway target triggers subtle celebration: "You hit your 6-month runway goal! 🎉"
- "Peace of Mind" indicator when above target for 3+ months straight
- Export option: "Share with advisor" button creates clean PDF summary
- Revenue concentration insight feels helpful, not alarming: "Acme Corp is 32% of your revenue - worth being aware of"

**Includes:**
- Three runway calculation methods (Simple, Trend-Adjusted, Seasonal)
- Automatic method suggestion based on business patterns
- Calculation transparency with full breakdown
- Click-through to underlying transactions
- Adjustable assumptions interface
- Cash Flow Picture with date range selector (Last 30/90/365 days, YTD, Last year, All time, Custom)
- Net burn calculation (Revenue - Expenses)
- Monthly revenue and expense averages from selected date range
- Revenue breakdown by client/customer
- Revenue breakdown by product/service
- Concentration risk warnings
- Revenue and expense trend indicators
- Business-type personalized emergency fund recommendations
- Recommended runway target by business type
- Override option for custom targets
- Revenue scenario modeling (client loss, product discontinuation, price changes)
- Expense scenario modeling (cost cuts, new hires, investments)
- Combined scenario modeling
- Interactive dual-slider "what if" tool
- Real-time runway impact display
- Smart scenario suggestions from actual book data
- User-configured threshold alerts (opt-in only)
- Calm, helpful alert messaging
- Once-per-threshold alert delivery
- Runway bar visualization
- Runway timeline view with cash events
- Confidence ranges for volatile data
- Color coding based on user thresholds
- Plain-English term explanations
- Educational "why this matters" content
- Inactive by default (user activation)
- Export/share functionality

**Spec Reference:** RUNWAY-001 (revised)

---

### J7. Mentor/Advisor Portal (Nice)
**What:** A professional workspace for the business owner + trusted advisor relationship - designed for accountants, CPAs, fractional CFOs, and bookkeepers who serve multiple clients.

**OpenSpec Resources:**
- Change: `openspec/changes/moonshot-features/`
- Proposal: `openspec/changes/moonshot-features/proposal.md`

**J7 Detailed Documentation:**
- **View-Key Cryptographic Specification:** `docs/J7_VIEW_KEY_CRYPTOGRAPHIC_SPECIFICATION.md` (15 sections, complete security architecture, external audit required before production)
- **Advisor Onboarding UX Flow:** `docs/J7_ADVISOR_ONBOARDING_UX_FLOW.md` (6-screen wizard with 20 years UX expertise, conversion funnel tracking)
- **Advisor-Client Data Model:** `docs/J7_ADVISOR_CLIENT_DATA_MODEL.md` (3 new tables with anonymous client IDs, Option B architecture, zero-knowledge compatible)
- Tasks: `openspec/changes/moonshot-features/tasks.md`
- Specs: `openspec/changes/moonshot-features/specs/*/spec.md`

**Status & Ownership:**
- Status: Not Started
- Priority: Low (Moonshot)
- Owner: TBD

**Design Philosophy:**

This is fundamentally different from H1 (Multi-user team collaboration). H1 is for **employees and internal team members** who work for ONE business. J7 is for **external advisors** who work WITH multiple businesses in a professional service capacity.

The relationship is:
- **Service-based** (advisor provides expertise to client)
- **Multi-client** (advisors manage many businesses, not just one)
- **Permission-controlled** (client decides what advisor can see)
- **Consultative** (advisor guides, suggests, asks questions - doesn't necessarily edit)

**Key differentiator:** Advisors get a **multi-client dashboard** where they can see all their client businesses in one place, switch between them, and manage their advisory relationships at scale.

**Zero-knowledge compatible:** Client grants access by sharing encrypted view-keys for specific data scopes (read-only books, specific reports, document folder, etc.). Advisor never gets the master key.

**The Pricing Model (Critical Feature):**

This is where Graceful Books becomes **advisor-friendly** and creates a powerful distribution channel:

**For Advisors (Accountants, CPAs, Fractional CFOs, Bookkeepers):**
- **Free advisor account** - no charge to create and manage
- **3 included client accounts** - use for your own firm, demo purposes, or gift to clients
- **5 included users** - for your team members (additional users $2.50/user/month)
- **$50 per 50 clients** after the first 3 (that's $1/client/month)
- **Assign users to clients** - control which team members see which client books
- Advisor pays one consolidated bill for all their clients and users

**For Clients under an Advisor's Plan:**
- **No charge to the client** - as long as they're under their advisor's plan
- Client gets full Graceful Books access
- Client can invite their team (using existing H1 multi-user features)
- If client leaves advisor or advisor removes them, client can opt to pay directly ($40/month individual plan, which includes $5 to charity)

**Why This Matters:**

1. **Advisors control the platform choice** - if an accountant tells their 50 clients "we're using Graceful Books," those clients will use it
2. **Advisor consolidation** - all client books in one place, one login, consistent interface
3. **Client acquisition** - advisors become a distribution channel (50 clients = 50 potential users)
4. **Stickiness** - client stays because their accountant is already set up in the system
5. **Scalability** - advisor economics work ($50 for 50 clients vs. client-by-client billing)

**Advisor Plan Tiers:**

```
┌─────────────────────────────────────────────────────────┐
│  ADVISOR PLAN PRICING                                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Starter (Free)                                          │
│  • 3 client accounts included                           │
│  • 5 user accounts included                             │
│  • Full multi-client dashboard                          │
│  • All collaboration features                           │
│  • Assign users to client books                         │
│                                                          │
│  Professional ($50 per 50 clients)                      │
│  • $50 per 50 clients after first 3 (includes $5 to    │
│    your selected charity)                               │
│  • $2.50/user/month after first 5                       │
│  • Billed monthly in blocks of 50 clients              │
│  • Example: 75 clients, 8 users = $100 + $7.50         │
│    = $107.50/month total                                │
│                                                          │
│  Enterprise (Custom pricing for 500+ clients)           │
│  • Volume discounts available                           │
│  • Dedicated support                                    │
│  • Custom onboarding for large firms                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Client Billing When Not Under Advisor:**
- Individual client: $40/month (includes $5 to charity selected from available options)
- Client can choose to pay directly instead of being under advisor plan
- Advisor can "release" a client from their plan at any time

**Charity Selection:**
- Platform admin (Graceful Books owner) maintains curated list of available charities
- Users and advisors select from this approved list
- Platform admin has full control over adding, updating, or removing charity options
- Ensures charitable contributions go to verified, reputable organizations

**Multi-Currency Support (Technical Note):**
- **Platform billing is USD only**: All advisor and client subscriptions are billed in US dollars through Stripe
- **Client books support multi-currency**: Clients can use H5 Multi-Currency features to track transactions in any currency (EUR, GBP, JPY, etc.)
- **Advisor sees client's base currency**: When viewing client books, advisor sees transactions in whatever currency the client chose as their base
- **Billing remains USD**: Regardless of client's operating currency, subscription fees are always in USD
- **Example**: A Canadian client operating in CAD pays $40 USD/month subscription, tracks transactions in CAD within their books

**Core Concept:**

**From the Business Owner's Perspective:**

Invite your accountant, CPA, fractional CFO, or bookkeeper to see your books and collaborate:

```
┌─────────────────────────────────────────────────────────┐
│  ADVISORS & COLLABORATORS                                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Jessica Martinez, CPA                                  │
│  jessica@martinezaccounting.com                         │
│  Access: View-Only Books + Reports + Documents         │
│  Since: Jan 2024                                        │
│  💰 Billing: Under advisor's plan (no charge to you)    │
│  [Edit Access] [Revoke Access] [Message]               │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  [+ Invite New Advisor]                                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**From the Advisor's Perspective:**

Multi-client dashboard showing all businesses they advise (alphabetized):

```
┌─────────────────────────────────────────────────────────┐
│  MY CLIENTS                                              │
│  Plan: Professional (72 clients) • $100/month           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  🔵 Acme Consulting LLC        [Open]                   │
│      Last viewed: 2 hours ago                           │
│      Unread comments: 2                                 │
│                                                          │
│  🟡 Sarah's Design Studio      [Open]                   │
│      Last viewed: 3 days ago                            │
│      Unread comments: 5 (needs attention)               │
│                                                          │
│  🟢 Widget Makers Inc          [Open]                   │
│      Last viewed: Yesterday                             │
│      Unread comments: 0                                 │
│                                                          │
│  [... 69 more clients ...]                              │
│                                                          │
│  Sorted: [A-Z (default)]  Filter: [All Clients ▼]      │
│  Search: [____________________]                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Invitation & Access Flow:**

1. **Client Initiates**
   - Business owner clicks "Invite Advisor"
   - Enters advisor's email and optional personal message
   - Selects access level (see below)
   - Option: "I want to be under my advisor's billing plan" (default: yes)
   - System sends invitation email

2. **Advisor Accepts**
   - Advisor receives email with invitation link
   - If new to Graceful Books: Creates advisor account (free - chooses plan based on client count)
   - If existing user: Invitation appears in their advisor portal
   - Advisor accepts, client is added to their plan
   - If over 3 clients, advisor is prompted to upgrade to Professional plan

3. **Access is Active**
   - Advisor can now view client's books within their multi-client dashboard
   - Client billing shifts to advisor's plan (client no longer charged individually)
   - Client can adjust permissions, revoke access, or communicate anytime
   - All advisor activity is logged in client's audit trail

**Access Levels (Client's Choice):**

**Granular permission control** - client chooses exactly what advisor can see:

**Pre-set Access Packages:**

1. **View-Only Observer**
   - Can see: Financial reports (P&L, Balance Sheet, Cash Flow)
   - Cannot see: Individual transactions, client/vendor details, bank accounts
   - Use case: Board member, investor, business coach who needs high-level view

2. **Full View Access**
   - Can see: Everything in the books (transactions, reports, contacts, documents)
   - Cannot do: Edit, delete, create new records
   - Use case: CPA reviewing for taxes, fractional CFO advising on strategy

3. **Collaborative Partner**
   - Can see: Everything
   - Can do: Create/edit transactions, categorize, reconcile, generate reports
   - Cannot do: Delete records, modify chart of accounts structure, manage users
   - Use case: Bookkeeping service, accounting firm handling monthly close

4. **Tax Season Package** (Seasonal)
   - Can see: All transaction detail, reports, tax-relevant documents
   - Can do: Request missing info, leave notes, export for tax software
   - Auto-expires: After specified date (e.g., April 30)
   - Use case: Tax preparer needs access just for filing season

5. **Custom Access**
   - Client picks exactly what the advisor can see/do
   - Checkbox interface for each permission type
   - Use case: Unique advisory relationships

**Permission Granularity:**

Can view:
- [ ] Financial reports only
- [ ] Transaction detail
- [ ] Client/customer information
- [ ] Vendor/supplier information
- [ ] Bank account information
- [ ] Documents & receipts
- [ ] Comments and notes
- [ ] Budget/forecast data
- [ ] Payroll information (if applicable)

Can do:
- [ ] Leave comments and questions
- [ ] Create transactions
- [ ] Edit transactions
- [ ] Categorize/tag transactions
- [ ] Upload documents
- [ ] Reconcile accounts
- [ ] Generate reports
- [ ] Export data

**Advisor Team Management:**

**For accounting firms with multiple staff members:**

Advisors can invite team members to their account and assign them to specific clients:

```
┌─────────────────────────────────────────────────────────┐
│  TEAM MEMBERS                                            │
│  Users: 8 (5 included + 3 @ $2.50 = $7.50/month)       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Sarah Chen, Senior Accountant                          │
│  sarah@yourfirm.com                                     │
│  Assigned to: 24 clients                                │
│  [Edit Assignments] [Remove]                            │
│                                                          │
│  Marcus Rodriguez, Bookkeeper                           │
│  marcus@yourfirm.com                                    │
│  Assigned to: 15 clients                                │
│  [Edit Assignments] [Remove]                            │
│                                                          │
│  [+ Invite Team Member]                                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Team Member Assignment:**
- Advisor (account owner) sees all clients
- Team members see only clients they're assigned to
- Advisor controls which team member sees which client books
- Useful for: Senior accountant handles some clients, bookkeeper handles others
- Each team member gets their own multi-client dashboard filtered to their assignments

**Client Lifecycle Management:**

Advisor can manage client status and billing:

```
┌─────────────────────────────────────────────────────────┐
│  Acme Consulting LLC                                     │
│  Under your plan since: Jan 2024                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Current status: Active                                 │
│                                                          │
│  Your current cost: $107.50/month (75 clients, 8 users)│
│  Cost per client: ~$1.34/client                         │
│                                                          │
│  [Remove from Active Dashboard]                         │
│  • Client will be asked if they want to:               │
│    - Pay individually ($40/month) and keep access      │
│    - Archive their account                             │
│  • Your new cost: $107.50/month (74 clients, 8 users)  │
│  • Cost per client: ~$1.35/client                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**When advisor removes a client:**
1. Client receives notification: "Your accountant has transferred billing back to you."
2. Client is prompted to choose:
   - **Pay individually** ($40/month) - maintains full access, continues using Graceful Books
   - **Archive account** - stops using Graceful Books, data remains accessible in read-only mode
3. Advisor's client count decreases by 1, billing adjusts automatically
4. Client no longer appears in advisor's active dashboard
5. Advisor can optionally add a note: "Client relationship ended" or "Client moved to another firm"

**Use cases for client removal:**
- Client relationship ends (client switches accountants)
- Client goes out of business
- Client wants to manage their own books independently
- Advisor restructuring their practice and reducing client load

**Advisor Multi-Client Dashboard Features:**

**For advisors managing 5, 10, 50+ client businesses:**

1. **Client Switcher**
   - Alphabetized list (A-Z default sort)
   - Search by client name for quick access
   - Color-coded dots for unread activity
   - Filter options: All Clients, Needs Attention, Recently Active, Inactive
   - Team members see only their assigned clients in this list

2. **Cross-Client Overview** (Advisor's Home)
   - Summary cards for each client showing key metrics
   - Alerts: "Client has unreconciled transactions"
   - Task list: "3 clients need quarterly review"
   - Calendar: Upcoming deadlines across all clients

3. **Client-Specific Workspace**
   - When advisor opens a client, they see that client's books
   - Clear header showing which client they're viewing
   - All navigation works within that client's context
   - **"Back to My Dashboard"** button always visible in top nav
   - **Client dropdown** in header to quickly switch to any other client without going back to dashboard

4. **Notes & Work Papers**
   - Advisor can keep private notes about each client (client can't see)
   - Work papers for tax season, audit prep, advisory projects
   - Attach files relevant to their work
   - Organize by client and project

5. **Communication Hub**
   - See all comments/questions across all clients in one feed
   - Filter by client, urgency, unanswered
   - Respond directly from dashboard
   - Mark as resolved

**Collaboration Features:**

**Advisor → Client Communication:**

Advisor can leave comments on:
- Specific transactions ("Is this business or personal?")
- Reports ("Your margins are shrinking - let's talk")
- Overall books ("Ready to review your Q4 numbers?")

Client gets notification, can respond, creates a conversation thread.

**Document Exchange:**

- Client can share specific documents with advisor (receipts, contracts, tax forms)
- Advisor can request documents ("Need your W-9 form")
- Shared folder per advisor (client controls what goes in)
- All encrypted, all logged

**Advisory Notes:**

Advisor can leave guidance notes:
- "Consider adjusting estimated tax payments"
- "This expense should be reclassified"
- "Great month! Revenue up 15%"

Notes can be:
- **Suggestions** (advisor recommends, client decides)
- **Questions** (advisor asks, client answers)
- **FYI** (advisor informs, no action needed)

Client sees these in their notification center and can respond or take action.

**Future Enhancement (Not in Initial Build):**

**DISC-Based Client Communication Assessment**
- Brief client survey assessing DISC communication style
- Results help advisor understand how to best communicate with each client
- Communication preferences stored per client
- Advisor sees: "This client prefers: Direct, data-driven communication (D)"
- Helps advisors tailor their approach to each client's preferences

*This will be added in a future iteration, not part of J7 initial launch.*

**What This Feature Does NOT Include:**

- ~~Advisors editing client books without permission~~ (permission-based always)
- ~~Advisors seeing all client data by default~~ (client grants access explicitly)
- ~~Free-for-all messaging~~ (communication is contextual to records/reports)
- ~~Advisor billing through the platform~~ (out of scope - advisors bill clients however they want for their services)
- ~~Advisor directory/marketplace~~ (not a matchmaking service, just collaboration tool)

**Advisor Onboarding:**

When an advisor accepts their first client invitation:

1. **Welcome to Advisor Mode**
   - Brief tour of multi-client dashboard
   - Explain how access works (client controls, you view/advise)
   - Show where to find each client's books
   - Explain billing: Free for 3 clients, $50/50 thereafter

2. **Choose Your Plan**
   - Starter (Free): Up to 3 clients
   - Professional ($50/50 clients): 4+ clients
   - Can upgrade/downgrade anytime as client count changes

3. **Profile Setup**
   - Professional info: Firm name, credentials (CPA, CFP, etc.), website
   - This displays to clients when they view advisor details
   - Optional: Upload professional photo, bio

4. **Notification Preferences**
   - How often to be notified about client activity
   - Digest mode: Daily summary vs. real-time alerts
   - Per-client preferences if managing many

**Client Experience Benefits:**

- **No more emailing spreadsheets back and forth**
- **Advisor sees live, current data** (no "send me an updated P&L")
- **Collaboration happens in context** (questions on the actual transaction, not in email)
- **Control what they see** (privacy maintained, selective sharing)
- **Easy to revoke** (advisor relationship ends? One click removes access)
- **Potentially free** (if under advisor's plan, no charge to client)

**Advisor Experience Benefits:**

- **All clients in one place** (no juggling multiple logins or file systems)
- **Always current data** (no waiting for client to export/email)
- **Contextual communication** (ask about a transaction right there)
- **Professional presentation** (looks good to clients)
- **Scales economically** ($50 for 50 clients vs. per-client SaaS fees)
- **Consolidation of tools** (one platform for all clients instead of scattered systems)

**Zero-Knowledge Architecture Compatibility:**

How this works with encryption:

1. **Client grants access** by generating a **view-key** for the advisor
2. **View-key** is scoped to the permissions selected (e.g., "read transactions + reports")
3. **Advisor receives view-key**, stored encrypted with their password
4. **Advisor can decrypt and view** only what the view-key permits
5. **Client revokes access** by invalidating the view-key
6. **Advisor's copy** of the view-key becomes useless, access lost instantly

Advisor never gets the client's master key. They can't see more than granted. Client maintains full sovereignty.

**Acceptance Criteria:**

- [ ] Business owners can invite advisors via email with personal message
- [ ] Invitation system handles both new and existing Graceful Books users
- [ ] Advisors receive invitation email with clear call-to-action
- [ ] Advisor account creation is free (Starter plan: 3 clients included)
- [ ] Advisor plan selection available: Starter (free, 3 clients, 5 users), Professional ($50/50 clients + $2.50/user), Enterprise (custom)
- [ ] Advisor can invite team members as users (5 included, $2.50 each additional)
- [ ] Advisor can assign specific users to specific client books
- [ ] User permissions are granular (which clients each user can access)
- [ ] Users see only the clients they're assigned to in their dashboard
- [ ] Client billing automatically shifts to advisor's plan when accepted
- [ ] Client sees "Under advisor's plan (no charge to you)" indicator
- [ ] Advisor dashboard shows current client count, user count, and monthly cost
- [ ] Billing blocks correctly: 1-3 clients = $0, 4-50 = $50, 51-100 = $100, etc.
- [ ] User billing calculates correctly: 1-5 users = $0, 6+ = $2.50 per additional user
- [ ] Client can opt out of advisor plan and pay individually ($40/month)
- [ ] Advisor can remove client from active dashboard at any time
- [ ] When advisor removes client, client receives notification about billing transfer
- [ ] Client is prompted to choose: pay individually ($40/month) or archive account
- [ ] Advisor's client count and billing automatically decrease when client is removed
- [ ] Removed client no longer appears in advisor's active dashboard
- [ ] Advisor can optionally add note when removing client (reason for removal)
- [ ] Pre-set access packages available: View-Only Observer, Full View, Collaborative Partner, Tax Season, Custom
- [ ] Granular permission controls allow client to select specific view/edit capabilities
- [ ] Tax Season package includes auto-expiration date
- [ ] Access can be modified or revoked by client at any time
- [ ] Advisor sees multi-client dashboard listing all their client businesses
- [ ] Client list is alphabetized by default (A-Z)
- [ ] Search functionality in client list for advisors with many clients
- [ ] Cross-client overview shows summary of all client statuses and alerts
- [ ] Unread comment/activity indicators display per client with color coding
- [ ] Client-specific workspace shows "Back to My Dashboard" button in top nav
- [ ] Client dropdown in header allows quick switching to any other client
- [ ] Advisor can leave comments on transactions, reports, and overall books
- [ ] Client receives notifications when advisor leaves comments
- [ ] Conversation threads maintain context with original record
- [ ] Advisor can maintain private notes per client (client cannot see)
- [ ] Document sharing folder per advisor with client-controlled contents
- [ ] Advisor can request specific documents from client
- [ ] Advisory notes can be tagged as Suggestion, Question, or FYI
- [ ] Advisor profile displays professional credentials and firm info to clients
- [ ] Advisor notification preferences are configurable (real-time vs. digest)
- [ ] Per-client notification settings available for advisors with many clients
- [ ] All advisor activity logged in client's audit trail
- [ ] View-key architecture maintains zero-knowledge encryption
- [ ] Access revocation invalidates advisor's view-key immediately
- [ ] Client can view advisor's last access time and activity summary
- [ ] Filter options available: All Clients, Needs Attention, Recently Active, Inactive
- [ ] Communication hub aggregates all client comments/questions in one feed
- [ ] Platform admin can manage curated list of available charities
- [ ] Users and advisors select charity from admin-approved list
- [ ] Platform admin can add, update, or remove charity options at any time
- [ ] Charity selection dropdown shows only admin-approved organizations

**Test Strategy:**
- Unit tests for permission scoping logic
- Unit tests for view-key generation and revocation
- Unit tests for billing calculation (client count to price tiers, user count to user charges)
- Unit tests for team member assignment logic
- Integration tests for invitation flow (new user and existing user paths)
- Integration tests for team member invitation and assignment
- Integration tests for billing shifts (client to advisor plan and back)
- Integration tests for document sharing and encryption
- E2E tests for complete advisor onboarding and client access workflow
- E2E tests for team member assignment and filtered dashboard views
- E2E tests for multi-client dashboard navigation and switching
- E2E tests for plan upgrades as client count and user count increase
- E2E tests for advisor removing client and billing transfer back to client
- E2E tests for client choice flow (pay individually vs. archive)
- Security testing for permission boundaries (verify advisor can't exceed granted access)
- Security testing for team member isolation (verify team members only see assigned clients)
- Access revocation testing (confirm immediate loss of access)
- Comment and communication threading testing
- Cross-client data isolation testing (ensure no data leakage between clients)
- Cross-team-member data isolation testing (ensure team members can't see unassigned clients)
- Audit trail accuracy testing
- Performance testing with advisors managing 50+ clients
- Performance testing with advisors managing 200+ clients
- Performance testing with 10+ team members across 200+ clients
- Billing accuracy testing across all tier thresholds (clients and users)

**Risks & Mitigation:**
- Risk: Privacy concerns about third-party access to financial data
  - Mitigation: Client-controlled permissions, clear access logs, easy revocation, zero-knowledge view-keys, transparent activity tracking
- Risk: Advisor confusion with multi-client interface
  - Mitigation: Clear client context indicators, dedicated onboarding tour, "Back to My Dashboard" always visible, client switcher in header, alphabetical sorting by default
- Risk: Complex permission model may lead to access errors
  - Mitigation: Pre-set packages for common cases, clear permission descriptions, test mode to verify access, extensive boundary testing
- Risk: Billing complexity may confuse advisors
  - Mitigation: Clear pricing display, real-time client count, automatic tier calculation, transparent monthly cost preview
- Risk: Clients may not understand "under advisor plan" concept
  - Mitigation: Clear messaging: "No charge to you - your advisor covers the cost", FAQ, educational content
- Risk: Advisors may be reluctant to pay for clients
  - Mitigation: Economics work in advisor's favor ($1/client vs. $20 if client paid directly), consolidation value, professional presentation
- Risk: Limited advisor adoption if feature is too complex
  - Mitigation: Free for first 3 clients (no barrier to entry), simple onboarding, professional presentation, multi-client efficiency benefits
- Risk: View-key architecture complexity may have bugs
  - Mitigation: Extensive security testing, cryptography expert review, staged rollout, comprehensive test coverage

**External Dependencies:**
- Libraries: None (uses existing encryption infrastructure)
- Infrastructure: Billing system integration (Stripe for advisor subscriptions)

**Dependencies:** {H1, I2}

**Joy Opportunity:** "Your accountant texts you: 'Just reviewed your books - everything looks great! Nice work this quarter.' And you didn't have to export a single spreadsheet."

**Delight Detail:**
- First advisor invitation: Gentle walkthrough explaining what advisor will/won't see
- Advisor dashboard feels professional and efficient - advisors will appreciate the consolidation
- When client is added to advisor's plan, client sees: "✓ Now under Jessica's plan - no charge to you!"
- Advisor billing is transparent: "72 clients • $100/month (saves you $1,340 vs. individual plans)"
- Client sees "Last reviewed by Jessica Martinez 2 hours ago" - reassuring that advisor is engaged
- Alphabetized client list makes finding specific clients instant for large practices

**Includes:**
- Advisor invitation system via email
- Access level selection (pre-set packages + custom)
- Granular permission controls (view/edit per data type)
- Tax Season access with auto-expiration
- Advisor plan tiers (Starter free/3 clients/5 users, Professional $50/50 clients + $2.50/user, Enterprise custom)
- Team member invitation and management (5 users included, $2.50 each additional)
- Team member assignment to specific client books
- Filtered multi-client dashboard per team member (shows only assigned clients)
- Client billing shift to advisor plan
- Client opt-out to individual billing
- Advisor can remove client from active dashboard
- Client notification and choice (pay individually or archive)
- Automatic billing adjustment when client removed
- Optional note/reason when removing client
- Multi-client dashboard for advisors (alphabetized)
- Client search functionality
- Cross-client overview with alerts and tasks
- Client-specific workspace navigation
- "Back to My Dashboard" top nav button
- Client dropdown switcher in header
- Filter options (All, Needs Attention, Recently Active, Inactive)
- Advisor private notes per client
- Work papers and file attachment
- Contextual comments on transactions and reports
- Document sharing folder per advisor
- Document request functionality
- Advisory notes (Suggestion/Question/FYI tagging)
- Client-advisor conversation threading
- Advisor professional profile display
- Notification preferences (real-time/digest, per-client)
- Activity logging in client audit trail
- Zero-knowledge view-key access architecture
- Instant access revocation
- Last access time display for client
- Communication hub across all clients
- Color-coded unread activity indicators
- Billing dashboard for advisors showing client count and cost
- Platform admin charity list management
- User/advisor charity selection from approved list

**Spec Reference:** MENTOR-001 (revised)

---

### J8. Tax Time Preparation Mode (Nice)
**What:** A calm, guided workflow that helps entrepreneurs gather everything their tax preparer needs - no panic, no guessing, just a clear checklist.

**OpenSpec Resources:**
- Change: `openspec/changes/moonshot-features/`
- Proposal: `openspec/changes/moonshot-features/proposal.md`
- Tasks: `openspec/changes/moonshot-features/tasks.md`
- Specs: `openspec/changes/moonshot-features/specs/*/spec.md`

**Status & Ownership:**
- Status: Not Started
- Priority: Medium (Moonshot)
- Owner: TBD

**Design Philosophy:**

Tax season is already stressful. This feature doesn't try to replace a tax professional - instead, it helps entrepreneurs **show up to tax season prepared**.

Whether they do their own taxes, use TurboTax, or work with a CPA, this workflow ensures they have:
1. All required documents organized and ready
2. Complete financial reports for the year
3. A tidy export package they can hand to their tax preparer
4. Confidence that they didn't forget anything

**Not tax advice.** Not a tax filing tool. Just **organized preparation**.

**Inactive by default.** Users activate Tax Prep Mode when they're ready (usually January-March). It stays active until they mark it complete or April 30 passes.

**Core Concept:**

A dedicated Tax Prep Dashboard that activates for the specific tax year:

```
┌─────────────────────────────────────────────────────────┐
│  TAX PREP MODE: 2025 Tax Year                           │
│  Progress: ████████████████░░░░░░░░  73% Complete      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ✅ Financial Reports                                   │
│  ✅ Income Documentation                                │
│  🔄 Expense Documentation (in progress)                │
│  ⏸  Deduction Checklist (not started)                  │
│  ⏸  Export Package (ready when you are)                │
│                                                          │
│  [View Full Checklist]  [Share with Accountant]        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**How It Works:**

**Step 1: Activate Tax Prep Mode**

User clicks "Prepare for Taxes" (available in dashboard from January onward):

```
┌─────────────────────────────────────────────────────────┐
│  GET READY FOR TAX SEASON                                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Which tax year are you preparing?                      │
│  ○ 2025 (most recent)                                   │
│  ○ 2024 (prior year)                                    │
│  ○ Other: [____]                                        │
│                                                          │
│  What's your business structure?                        │
│  ○ Sole Proprietor / LLC (Schedule C)                  │
│  ○ Partnership                                          │
│  ○ S-Corporation                                        │
│  ○ C-Corporation                                        │
│                                                          │
│  Are you working with a tax professional?               │
│  ○ Yes - I'll send them an export package              │
│  ○ No - I'm doing my own taxes                         │
│                                                          │
│  [Start Tax Prep]                                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

System creates a customized checklist based on business structure.

**Step 2: Financial Reports Section**

```
┌─────────────────────────────────────────────────────────┐
│  ✅ FINANCIAL REPORTS                                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  These are auto-generated from your books:              │
│                                                          │
│  ✓ Profit & Loss Statement (2025)                      │
│  ✓ Balance Sheet (as of Dec 31, 2025)                  │
│  ✓ Cash Flow Statement (2025)                          │
│                                                          │
│  [Preview Reports]  [Download All]                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Why this is needed:** Your tax preparer (or tax software) needs these to calculate business income and deductions.

**Step 3: Income Documentation**

```
┌─────────────────────────────────────────────────────────┐
│  ✅ INCOME DOCUMENTATION                                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ✓ 1099-NEC forms (3 uploaded)                         │
│    • Client A: $24,000                                  │
│    • Client B: $18,500                                  │
│    • Client C: $12,000                                  │
│                                                          │
│  ✓ 1099-K (payment processor): $8,400                  │
│                                                          │
│  ⚠️  Your total 1099 income: $62,900                   │
│      Your total revenue recorded: $68,200               │
│      Difference: $5,300                                 │
│                                                          │
│  This is common (you may have other clients who didn't  │
│  issue 1099s). Just be aware of the difference.         │
│                                                          │
│  [Upload Document]  [Mark Section Complete]             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

System helps reconcile 1099 income against recorded revenue - common source of confusion.

**Step 4: Expense Documentation**

```
┌─────────────────────────────────────────────────────────┐
│  🔄 EXPENSE DOCUMENTATION                                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Major expense categories for your review:              │
│                                                          │
│  ✓ Office Supplies: $2,340 (12 receipts)              │
│  ✓ Software & Subscriptions: $4,200 (8 receipts)      │
│  🔄 Travel: $3,800 (7 receipts, 2 missing)             │
│  ⏸  Meals & Entertainment: $1,200 (needs review)       │
│                                                          │
│  [Review by Category]                                   │
│                                                          │
│  Missing receipts?                                      │
│  • Create a summary note for your records              │
│  • IRS accepts "lost receipt" explanation if          │
│    transaction is clearly documented in books          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

Helps identify gaps in documentation without causing panic.

**Step 5: Deduction Checklist**

```
┌─────────────────────────────────────────────────────────┐
│  ⏸  DEDUCTION CHECKLIST                                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Common deductions for [Sole Proprietor]:              │
│                                                          │
│  ✓ Home office (recorded: $3,600)                      │
│  ✓ Vehicle mileage (recorded: 2,400 miles)            │
│  ✓ Health insurance premiums (self-employed)           │
│  ✓ Retirement contributions (SEP-IRA)                  │
│  ⏸  Equipment purchases over $2,500 (depreciation)     │
│                                                          │
│  [Educational Guide: What qualifies?]                   │
│                                                          │
│  ⚠️  We're not telling you what to deduct - we're just │
│      showing common categories to review with your CPA. │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

Educational, not prescriptive. Helps ensure they talk to their CPA about all applicable deductions.

**Step 6: Export Package**

```
┌─────────────────────────────────────────────────────────┐
│  📦 EXPORT PACKAGE                                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Ready to send to your tax preparer:                    │
│                                                          │
│  Package includes:                                       │
│  • Profit & Loss Statement (PDF)                       │
│  • Balance Sheet (PDF)                                  │
│  • Cash Flow Statement (PDF)                           │
│  • Transaction detail export (CSV)                      │
│  • All income documents (1099s)                         │
│  • Receipt summary by category                          │
│  • QuickBooks export (QBO file) - optional             │
│                                                          │
│  [Download ZIP]  [Email to Accountant]                 │
│                                                          │
│  Or: Share via Advisor Portal (J7)                     │
│  If your accountant uses Graceful Books, just grant    │
│  them "Tax Season" access - no files to send!          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

Clean, professional package ready to hand off.

**Progress Tracking:**

Visual progress bar shows completion:
- Financial Reports: Auto-generated (instant ✓)
- Income Documentation: User uploads 1099s
- Expense Documentation: User reviews and confirms
- Deduction Checklist: User reviews categories
- Export Package: Available when previous steps complete

**Integration with J7 (Advisor Portal):**

If user has invited their accountant via J7:
- User can grant "Tax Season" access (auto-expires April 30)
- Accountant sees same Tax Prep Dashboard
- Accountant can request missing documents directly
- No need to email files back and forth

**What This Feature Does NOT Include:**

- ~~Tax calculation~~ (not a tax software)
- ~~Tax filing~~ (not TurboTax/H&R Block)
- ~~Tax advice~~ (no "you should deduct X" recommendations)
- ~~Tax strategy~~ (that's for CPAs)
- ~~E-filing~~ (out of scope)
- ~~Tax form generation~~ (1040, Schedule C, etc. - use tax software for this)

**This is purely about preparation and organization.**

**Educational Content Throughout:**

Every section has "Why this matters" tooltips:

- **1099 reconciliation:** "The IRS gets copies of your 1099s. If your tax return shows different income, they'll ask questions. We help you reconcile so there are no surprises."
- **Receipt documentation:** "You don't need to submit receipts with your tax return, but you need to keep them for 7 years in case of audit."
- **Home office deduction:** "If you use part of your home exclusively for business, you may qualify. Talk to your CPA about calculating this correctly."

**Calm, reassuring tone everywhere:**
- ✓ "Great! This section is complete."
- ⚠️ "Heads up: You might want to review this with your CPA."
- 🔄 "In progress - you're doing great."

**Acceptance Criteria:**

- [ ] Tax prep mode can be activated for specific tax year
- [ ] Business structure selection customizes checklist (Sole Prop, Partnership, S-Corp, C-Corp)
- [ ] User can specify if working with tax professional or doing own taxes
- [ ] Financial reports auto-generate for selected tax year
- [ ] Financial reports include: P&L, Balance Sheet, Cash Flow
- [ ] Income documentation section allows 1099 upload
- [ ] System reconciles 1099 income against recorded revenue with clear explanation of differences
- [ ] Expense documentation displays major categories with receipt counts
- [ ] Missing receipt identification helps user address gaps
- [ ] Deduction checklist shows common deductions for business structure
- [ ] Educational content explains each deduction category without giving advice
- [ ] Clear disclaimers: "Review with your CPA" messaging throughout
- [ ] Progress indicator shows completion percentage across all sections
- [ ] Export package includes all necessary reports (PDF)
- [ ] Export package includes transaction detail (CSV)
- [ ] Export package includes QuickBooks export (QBO) as optional
- [ ] Export package can be downloaded as ZIP
- [ ] Export package can be emailed to accountant
- [ ] Integration with J7 Advisor Portal allows "Tax Season" access grant
- [ ] Advisor with Tax Season access sees same Tax Prep Dashboard
- [ ] Tax Season access auto-expires after specified date (e.g., April 30)
- [ ] Educational tooltips explain "why this matters" for each section
- [ ] Tone is calm and reassuring, not alarmist
- [ ] Missing documents don't block progress, just flagged for review
- [ ] User can mark sections complete manually
- [ ] Tax Prep Mode deactivates after completion or tax deadline passes

**Test Strategy:**
- Unit tests for 1099 reconciliation logic
- Unit tests for completeness checking algorithms (per business structure)
- Integration tests for report bundle generation
- Integration tests for export package creation (ZIP, email)
- Integration tests with J7 Advisor Portal (Tax Season access grant)
- E2E tests for complete tax prep workflow (all business structures)
- E2E tests for advisor collaboration via Tax Season access
- Export format validation (CSV, PDF, QBO)
- CPA review of feature completeness and educational content accuracy
- User comprehension testing (do users understand what's needed?)
- Anxiety assessment (does this reduce or increase stress?)

**Risks & Mitigation:**
- Risk: Tax advice could create legal liability
  - Mitigation: Educational disclaimers everywhere, "consult a tax professional" messaging, no specific deduction recommendations, CPA review of all content
- Risk: Jurisdiction-specific requirements may be missed
  - Mitigation: Focus on federal requirements common across all states, note that state requirements vary, recommend consulting local CPA
- Risk: Overwhelming complexity for users
  - Mitigation: Progressive disclosure, wizard-based workflow, calm tone, help at every step, can't get "stuck"
- Risk: Annual feature may not justify development cost
  - Mitigation: Reusable checklist system, retention value (users stay for tax season), marketing opportunity, CPA referral channel
- Risk: Users may expect tax filing capability
  - Mitigation: Clear messaging upfront: "This prepares you for taxes, it doesn't file them", integration path to tax software via exports
- Risk: Educational content may become outdated with tax law changes
  - Mitigation: Annual review cycle, clearly dated content, focus on timeless concepts not specific numbers

**External Dependencies:**
- Libraries: pdfmake (PDF generation), jszip (ZIP creation)
- Infrastructure: Email service (optional - for sending export package)

**Dependencies:** {D6, D7, G9, G6, J7}

**Joy Opportunity:** "Tax season doesn't have to be chaos. Check off each section, watch the progress bar fill, and know you're ready. Your accountant will be impressed."

**Delight Detail:**
- First activation: Gentle welcome: "Let's get organized for tax season. We'll take it step by step - no rush."
- Progress bar turns green as sections complete: satisfying visual progress
- When 100% complete: "🎉 You're ready for tax season! Everything is organized and ready to go."
- Export package generates with user's business name: "Acme Consulting - 2025 Tax Package.zip" (professional)
- If working with advisor via J7: One-click "Grant Tax Season Access" button (so easy)
- Checklist items turn green with satisfying animation when marked complete

**Includes:**
- Tax prep workflow activation for specific tax year
- Business structure selection (Sole Prop, Partnership, S-Corp, C-Corp)
- Work-with-CPA vs. DIY indicator
- Auto-generated financial reports (P&L, Balance Sheet, Cash Flow)
- Income documentation section with 1099 upload
- 1099 vs. revenue reconciliation with explanation
- Expense documentation review by category
- Missing receipt identification and guidance
- Deduction checklist customized by business structure
- Educational content for each deduction category
- Clear "review with CPA" disclaimers throughout
- Progress indicator (percentage complete)
- Export package generation (PDF + CSV + QBO)
- ZIP download of complete package
- Email to accountant functionality
- Integration with J7 Advisor Portal
- "Tax Season" access grant for advisors
- Auto-expiration of Tax Season access
- Educational tooltips ("why this matters")
- Calm, reassuring tone throughout
- Manual section completion option
- Auto-deactivation after tax deadline

**Spec Reference:** TAX-001 (revised)

---

### J9. CSV Import/Export (Nice)
**What:** Import transactions from anywhere that exports CSV (Stripe, Square, PayPal, your bank) and export your books for backups or external analysis - all while maintaining zero-knowledge encryption.

**OpenSpec Resources:**
- Change: `openspec/changes/moonshot-features/`
- Proposal: `openspec/changes/moonshot-features/proposal.md`
- Tasks: `openspec/changes/moonshot-features/tasks.md`
- Specs: `openspec/changes/moonshot-features/specs/*/spec.md`

**Status & Ownership:**
- Status: Not Started
- Priority: Medium (Moonshot)
- Owner: TBD

**Design Philosophy:**

Full API integrations are powerful but architecturally complex, especially with zero-knowledge encryption. CSV import/export provides **90% of the value with 10% of the complexity**.

Almost every service exports CSV: Stripe, Square, PayPal, banks, other accounting software. Most entrepreneurs already download these CSVs to review them. Instead of manually re-entering each transaction, **just upload the CSV and map the columns**.

**Core benefits:**
- Works with ANY service that exports CSV (not limited to what we integrate)
- Maintains zero-knowledge architecture (processing happens client-side)
- Works offline (import locally, sync encrypted data later)
- User controls timing (import when ready, not forced real-time)
- No OAuth complexity, no webhook infrastructure, no background jobs

**Not as sexy as "automatic integrations," but way more practical for MVP.**

**Core Concept:**

Two main workflows:

**1. CSV Import** - Bring transactions in
**2. CSV Export** - Take transactions out

Both are dead simple, both happen client-side.

---

**CSV Import Workflow:**

**Step 1: Upload CSV**

```
┌─────────────────────────────────────────────────────────┐
│  IMPORT TRANSACTIONS FROM CSV                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Upload your CSV file:                                  │
│                                                          │
│  [Drop CSV file here or click to browse]               │
│                                                          │
│  Common sources:                                        │
│  • Stripe (export from Dashboard → Payments)           │
│  • Square (export from Transactions)                   │
│  • PayPal (export from Activity)                       │
│  • Your bank (download transaction history)            │
│  • Other accounting software                           │
│                                                          │
│  Or use a template:                                     │
│  [Stripe Template] [Square Template] [Bank Template]   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

User uploads CSV. System parses it client-side.

**Step 2: Map Columns**

System detects columns, asks user to map them:

```
┌─────────────────────────────────────────────────────────┐
│  MAP YOUR CSV COLUMNS                                    │
│  We found 8 columns in your CSV. Map them to your books:│
├─────────────────────────────────────────────────────────┤
│                                                          │
│  CSV Column              →  Graceful Books Field        │
│  ─────────────────────────────────────────────────────  │
│  "Created"               →  [Date ▼]                    │
│  "Amount"                →  [Amount ▼]                  │
│  "Description"           →  [Description/Memo ▼]        │
│  "Customer Email"        →  [Skip ▼]                    │
│  "Fee"                   →  [Fee ▼]                     │
│  "Net"                   →  [Skip ▼]                    │
│  "Status"                →  [Skip ▼]                    │
│  "Currency"              →  [Currency ▼]                │
│                                                          │
│  ✓ Smart detection applied (Stripe format recognized)   │
│                                                          │
│  Account Mapping:                                       │
│  Revenue goes to: [Sales Revenue ▼]                    │
│  Fees go to: [Payment Processing Fees ▼]               │
│                                                          │
│  [Preview Import] [Save as Template]                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Smart detection:**
- Recognizes common CSV formats (Stripe, Square, PayPal)
- Auto-suggests mappings based on column names
- User can override any mapping
- Can save mapping as template for future imports

**Step 3: Preview & Validate**

Before importing, show preview:

```
┌─────────────────────────────────────────────────────────┐
│  PREVIEW IMPORT                                          │
│  Ready to import 47 transactions                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ✓ Jan 15, 2026  $125.00  Customer payment             │
│    → Sales Revenue                                      │
│                                                          │
│  ✓ Jan 15, 2026  ($3.90)  Stripe fee                   │
│    → Payment Processing Fees                            │
│                                                          │
│  ✓ Jan 16, 2026  $450.00  Customer payment             │
│    → Sales Revenue                                      │
│                                                          │
│  ⚠️  Jan 17, 2026  $0.00  Invalid amount (skipped)     │
│                                                          │
│  [... 43 more transactions ...]                         │
│                                                          │
│  Summary:                                               │
│  • 46 valid transactions will be imported              │
│  • 1 row has errors (will be skipped)                  │
│  • Total revenue: $8,450                                │
│  • Total fees: $287                                     │
│                                                          │
│  ⚠️  Duplicate check: 3 transactions may be duplicates  │
│      (already exist in your books)                      │
│      [Review Duplicates] [Skip Duplicates] [Import All] │
│                                                          │
│  [Import Transactions] [Cancel]                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Validation:**
- Check for required fields (date, amount)
- Detect invalid data (missing dates, non-numeric amounts)
- Duplicate detection (compare against existing transactions by date + amount)
- Show summary before committing

**Step 4: Import Complete**

```
┌─────────────────────────────────────────────────────────┐
│  ✓ IMPORT COMPLETE                                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Successfully imported 46 transactions                  │
│  Skipped: 1 (errors), 3 (duplicates)                   │
│                                                          │
│  What happened:                                         │
│  • 46 new transactions added to your books             │
│  • All encrypted and synced                            │
│  • Tagged as "Imported from CSV"                       │
│                                                          │
│  [View Imported Transactions] [Done]                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

**CSV Export Workflow:**

Export transactions as CSV for backups, analysis, or migration:

```
┌─────────────────────────────────────────────────────────┐
│  EXPORT TRANSACTIONS TO CSV                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Date Range:                                            │
│  From: [Jan 1, 2026]  To: [Jan 31, 2026]               │
│                                                          │
│  What to export:                                        │
│  [✓] All transactions                                   │
│  [ ] Income only                                        │
│  [ ] Expenses only                                      │
│  [ ] Specific accounts: [Select accounts...]           │
│                                                          │
│  Include:                                               │
│  [✓] Transaction details (date, amount, memo)          │
│  [✓] Account information                                │
│  [✓] Categories/tags                                    │
│  [✓] Attachments (as separate ZIP)                     │
│                                                          │
│  Format:                                                │
│  [Standard CSV ▼]                                       │
│  (Options: Standard CSV, Excel-friendly, QuickBooks)    │
│                                                          │
│  [Generate Export]                                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

Export generates CSV client-side, downloads to user's device.

**Export formats:**
- **Standard CSV:** Universal format, works anywhere
- **Excel-friendly:** UTF-8 with BOM, formatted for Excel
- **QuickBooks format:** Columns mapped to QuickBooks import format

---

**Template Library:**

Save column mappings as templates for reuse:

```
┌─────────────────────────────────────────────────────────┐
│  IMPORT TEMPLATES                                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Your Templates:                                        │
│                                                          │
│  📄 Stripe Payments                                     │
│     Last used: Jan 15, 2026                             │
│     Maps: Date, Amount, Description, Fee                │
│     [Use Template] [Edit] [Delete]                      │
│                                                          │
│  📄 Chase Business Checking                             │
│     Last used: Jan 1, 2026                              │
│     Maps: Date, Amount, Description, Balance            │
│     [Use Template] [Edit] [Delete]                      │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  Built-in Templates:                                    │
│                                                          │
│  📄 Stripe (Standard Export)                            │
│  📄 Square (Transaction History)                        │
│  📄 PayPal (Activity Download)                          │
│  📄 Generic Bank Statement                              │
│                                                          │
│  [+ Create New Template]                                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

Templates remember:
- Column mappings
- Account assignments
- Skip rules
- Date format preferences

**Duplicate Detection:**

Smart duplicate checking:

```
┌─────────────────────────────────────────────────────────┐
│  POSSIBLE DUPLICATES DETECTED                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  We found 3 transactions that might already exist:      │
│                                                          │
│  CSV Import              Existing Transaction           │
│  ─────────────────────────────────────────────────────  │
│  Jan 15: $125.00        Jan 15: $125.00                │
│  Customer payment       Sales Revenue                   │
│  [✓ Skip] [Import]      [View]                          │
│                                                          │
│  Jan 16: $450.00        Jan 16: $450.00                │
│  Customer payment       Sales Revenue                   │
│  [✓ Skip] [Import]      [View]                          │
│                                                          │
│  Jan 17: $89.00         Jan 17: $89.00                 │
│  Office supplies        Expenses: Office                │
│  [ Skip] [✓ Import]     [View] (Different memo)        │
│                                                          │
│  [Skip All Duplicates] [Import All] [Review Each]      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

Matches on:
- Same date
- Same amount
- Similar description (fuzzy matching)

User decides: skip or import anyway.

**What This Feature Does NOT Include:**

- ~~Automatic sync~~ (user manually downloads CSV and imports)
- ~~Real-time updates~~ (import happens when user wants)
- ~~Two-way sync~~ (import only, can't push data back to Stripe/Square)
- ~~API connections~~ (no OAuth, no webhooks)
- ~~Complex transformations~~ (simple column mapping only)

**Zero-Knowledge Compatible:**

All CSV processing happens **client-side**:
1. User uploads CSV
2. Browser parses CSV (JavaScript)
3. User maps columns (in browser)
4. Transactions created and encrypted (in browser)
5. Encrypted transactions sync to server

Server never sees CSV contents. Server never sees unencrypted transactions.

**Acceptance Criteria:**

- [ ] CSV file upload supports drag-and-drop and file picker
- [ ] CSV parser handles common formats (comma, semicolon, tab-delimited)
- [ ] CSV parser handles quoted fields with commas
- [ ] CSV parser handles UTF-8 and common encodings
- [ ] Column mapping interface shows all detected columns
- [ ] Column mapping provides dropdowns for field types (Date, Amount, Description, etc.)
- [ ] Smart detection recognizes Stripe CSV format
- [ ] Smart detection recognizes Square CSV format
- [ ] Smart detection recognizes PayPal CSV format
- [ ] Smart detection recognizes common bank statement formats
- [ ] User can manually override any column mapping
- [ ] Account mapping allows selection of revenue and expense accounts
- [ ] User can save column mapping as template
- [ ] Template library shows user-created and built-in templates
- [ ] Preview shows first 10 transactions before import
- [ ] Preview shows total transaction count and summary totals
- [ ] Validation checks for required fields (date, amount)
- [ ] Validation detects invalid dates and shows errors
- [ ] Validation detects non-numeric amounts and shows errors
- [ ] Duplicate detection compares against existing transactions
- [ ] Duplicate detection matches on date + amount + fuzzy description
- [ ] User can review duplicates and choose to skip or import
- [ ] Import creates transactions tagged "Imported from CSV"
- [ ] Import happens entirely client-side (no CSV sent to server)
- [ ] Imported transactions are encrypted before sync
- [ ] CSV export allows date range selection
- [ ] CSV export allows filtering by transaction type or account
- [ ] CSV export includes transaction details (date, amount, memo, account)
- [ ] CSV export supports multiple formats (Standard, Excel-friendly, QuickBooks)
- [ ] CSV export includes attachments as separate ZIP (optional)
- [ ] CSV export generates file client-side
- [ ] Error messages are clear and actionable
- [ ] Progress indicator shows during large imports (500+ transactions)
- [ ] User can cancel import mid-process

**Test Strategy:**
- Unit tests for CSV parser (various formats, encodings, edge cases)
- Unit tests for column mapping logic
- Unit tests for smart detection (Stripe, Square, PayPal formats)
- Unit tests for duplicate detection algorithm
- Unit tests for validation rules
- Integration tests for complete import workflow
- Integration tests for complete export workflow
- E2E tests with real CSV files from Stripe, Square, PayPal
- E2E tests with malformed CSVs (missing columns, bad data)
- Performance testing with large CSVs (10,000+ rows)
- Client-side encryption verification (ensure CSV never sent unencrypted)
- Template save/load testing
- Duplicate detection accuracy testing

**Risks & Mitigation:**
- Risk: CSV format variations may break parser
  - Mitigation: Support common delimiters, test with real-world CSVs, provide manual override
- Risk: Users may import same CSV multiple times creating duplicates
  - Mitigation: Duplicate detection, clear warnings, "last import date" tracking
- Risk: Large CSV files may freeze browser
  - Mitigation: Streaming parser, progress indicators, batch processing, 10K row limit with warning
- Risk: Users may not understand column mapping
  - Mitigation: Smart detection auto-fills most mappings, built-in templates, preview before import
- Risk: Date format ambiguity (MM/DD/YYYY vs DD/MM/YYYY)
  - Mitigation: Auto-detect from CSV, allow manual override, show preview to catch errors
- Risk: Currency conversion if CSV contains multiple currencies
  - Mitigation: Out of scope for MVP - show error if multiple currencies detected, require user to filter CSV first

**External Dependencies:**
- Libraries: papaparse (CSV parsing), date-fns (date parsing), fuse.js (fuzzy matching for duplicates)
- Infrastructure: None (all client-side)

**Dependencies:** {A1, B2}

**Joy Opportunity:** "Upload your Stripe CSV. Watch 200 transactions import in seconds. No more manual entry for an entire month."

**Delight Detail:**
- First import celebration: "✓ 187 transactions imported! Saved you ~3 hours of manual entry."
- Progress bar for large imports with satisfying animation
- Smart detection: "Looks like a Stripe export! We've mapped the columns for you - check if it looks right."
- Duplicate prevention: "Good news: These 5 transactions are already in your books. We'll skip them."
- Export generates filename with business name and date range: "Acme Consulting - Jan 2026 Transactions.csv"

**Includes:**
- CSV file upload (drag-and-drop + file picker)
- CSV parser (handles common formats and encodings)
- Column mapping interface with smart detection
- Account mapping for revenue/expenses
- Template library (user-created + built-in)
- Built-in templates (Stripe, Square, PayPal, generic bank)
- Preview with validation
- Duplicate detection and review
- Import execution (client-side)
- Transaction tagging ("Imported from CSV")
- CSV export with date range filtering
- CSV export with account filtering
- Multiple export formats (Standard, Excel-friendly, QuickBooks)
- Attachment export (separate ZIP)
- Error handling and validation
- Progress indicators for large imports
- Template save/load functionality

**Spec Reference:** CSV-001 (new)

---

### J10. CSV Import/Export Testing Environment [MVP] [INFRASTRUCTURE]
**What:** Sample CSV files and test data for validating CSV import/export functionality from major payment processors and banks.

**Dependencies:** {J9}

**Joy Opportunity:** "Test CSV imports without touching real financial data. Sample files make testing safe and thorough."

**Status & Ownership:**
- Status: Not Started
- Priority: Medium (Infrastructure)
- Owner: Unassigned
- Last Updated: 2026-01-19

**Design Philosophy:**

CSV Import/Export (J9) needs thorough testing with real-world CSV formats from Stripe, Square, PayPal, and various banks. Instead of testing against production data or live API sandboxes, we maintain a library of **sample CSV files** that represent actual export formats.

This allows:
- Safe testing without real financial data
- Consistent test results (not dependent on external services)
- Coverage of edge cases (malformed data, special characters, etc.)
- Validation of smart detection and column mapping

**Acceptance Criteria:**

- [ ] Sample CSV library created with files from major services
- [ ] Stripe sample CSV (standard payment export format)
- [ ] Square sample CSV (transaction history format)
- [ ] PayPal sample CSV (activity download format)
- [ ] Generic bank statement CSV samples (3-5 different bank formats)
- [ ] QuickBooks export format sample
- [ ] Edge case CSV samples (malformed data, special characters, multiple currencies)
- [ ] Sample CSVs include realistic transaction data (dates, amounts, descriptions)
- [ ] Sample CSVs anonymized (no real customer/business data)
- [ ] Import templates validated against sample CSVs
- [ ] Smart detection tested against all sample formats
- [ ] Duplicate detection tested with intentionally duplicated samples
- [ ] Large CSV sample (1000+ rows) for performance testing
- [ ] Multi-currency CSV sample for error handling testing
- [ ] Test documentation explains how to use sample files
- [ ] Sample files version-controlled and maintained

**Test Strategy:**
- Import each sample CSV and verify correct parsing
- Verify smart detection correctly identifies each format
- Test column mapping validation with sample files
- Performance test with large sample CSV
- Edge case testing with malformed samples
- Duplicate detection accuracy with duplicate samples

**Includes:**
- Sample CSV library (Stripe, Square, PayPal, banks)
- Edge case sample files
- Large performance test sample
- Test documentation
- Import template validation suite

**Spec Reference:** INFRA-017 (revised)

---

### J11. Write Comprehensive Tests for Group J Features [MVP] [MANDATORY]
**What:** Write complete test suites for all Group J features.

**Dependencies:** {J1, J2, J3, J4, J5, J6, J7, J8, J9, J10}

**⚠️ TESTING GATE:** This task is MANDATORY. All Group J features must be tested before release.

**Includes:**
- Unit tests for all Group J components and functions
- Integration tests for all Group J feature interactions
- E2E tests for all Group J user workflows
- Performance tests per DEFINITION_OF_DONE.md requirements

**Status & Ownership:**
**Status:** Not Started
**Owner:** Unassigned
**Last Updated:** 2026-01-19

**Acceptance Criteria:**
- [ ] Unit tests written for Financial Flow Widget (J1)
- [ ] Unit tests written for Smart Automation Assistant (J2)
- [ ] Unit tests written for What-If Scenario Planner (J3)
- [ ] Unit tests written for Financial Health Score (J4)
- [ ] Unit tests written for Goal Setting & Tracking (J5)
- [ ] Unit tests written for Emergency Fund & Runway Calculator (J6)
- [ ] Unit tests written for Mentor/Advisor Portal (J7)
- [ ] Unit tests written for Tax Time Preparation Mode (J8)
- [ ] Unit tests written for CSV Import/Export (J9)
- [ ] Integration tests verify interactions between all Group J features
- [ ] E2E tests cover complete advanced workflows
- [ ] Performance tests verify all Group J features meet requirements
- [ ] Test coverage meets minimum thresholds
- [ ] All tests pass with 100% success rate

**Test Strategy:**
- **Unit Tests:** Widget rendering, AI prediction accuracy, scenario calculation logic, health score algorithms, runway calculations, CSV parsing
- **Integration Tests:** Advisor portal multi-client workflows, tax prep + advisor collaboration, CSV import with duplicate detection
- **E2E Tests:** Complete goal tracking workflow, tax preparation flow, advisor onboarding and client management, CSV import end-to-end
- **Performance Tests:** Widget rendering performance, AI response time, large CSV import (10K+ rows), advisor dashboard with 100+ clients

**External Dependencies:**
- **Libraries:** vitest, @testing-library/react, playwright


---

### J12. Run All Tests and Verify 100% Pass Rate [MVP] [MANDATORY]
**What:** Run the complete test suite and verify ALL tests pass before release.

**Dependencies:** {J11}

**⚠️ CRITICAL GATE:** Product CANNOT be released until this task is complete.

**Includes:**
- Run `npm test` and verify 100% pass rate
- Review test coverage reports
- Fix any failing tests
- Document test results
- Final quality assurance review

**Status & Ownership:**
**Status:** Not Started
**Owner:** Unassigned
**Last Updated:** 2026-01-19

**Acceptance Criteria:**
- [ ] Command `npm test` runs successfully with 0 failures
- [ ] All unit tests pass (100% pass rate) across ALL groups (A-J)
- [ ] All integration tests pass (100% pass rate) across ALL groups (A-J)
- [ ] All E2E tests pass (100% pass rate) across ALL groups (A-J)
- [ ] All performance tests pass (100% pass rate) across ALL groups (A-J)
- [ ] Test coverage meets minimum requirements across entire codebase
- [ ] Test results documented and reviewed
- [ ] Full regression testing completed
- [ ] All quality gates passed

**Success Criteria:**
✅ **ALL TESTS PASSING** = Ready for release
❌ **ANY TESTS FAILING** = Cannot release until fixed

**This is the final quality gate before release. No exceptions.**


---

---

# Bonus: Easter Eggs & Hidden Delights

*"These are the surprises that make users smile and tell their friends."*

### Easter Egg Ideas (Implement When Time Allows)

1. **The Konami Code** - Entering the Konami code anywhere triggers a brief celebration animation with the message "You found a secret! We appreciate the curious ones."

2. **Transaction #1000** - When a user enters their 1000th transaction, a special message: "Transaction ONE THOUSAND! If bookkeeping were a video game, you'd be beating it."

3. **Midnight Bookkeeper** - If reconciling after midnight: "Burning the midnight oil? Your dedication is impressive. (But also, go to bed!)"

4. **April 15th Greeting** - On tax day (US): "Happy Tax Day! We hope your books are as ready as your tax preparer is caffeinated."

5. **Anniversary Badge** - On the user's signup anniversary: "Happy Graceful Books anniversary! Another year of financial clarity."

6. **Zero Balance Celebration** - If A/R hits zero: "Everyone's paid up! This calls for celebration."

7. **The Perfect Reconciliation** - If a reconciliation matches perfectly on first try: "PERFECT MATCH! The accounting gods smile upon you today."

8. **Seasonal Themes** - Subtle seasonal touches (falling leaves in autumn, gentle snowflakes in winter) that can be toggled off.

---

# Appendix: Spec Reference Quick Index

| Code | Description | Roadmap Items |
|------|-------------|---------------|
| ARCH-001 | Zero-knowledge encryption | A2 |
| ARCH-002 | Key management | A2, H1, H2 |
| ARCH-003 | Sync infrastructure | A3, B6, H8, H9 |
| ARCH-004 | Conflict resolution | I1 |
| ONB-001 | Assessment framework | C1, C2 |
| ONB-002 | Assessment structure | C1, C2 |
| ONB-003 | Phase determination | C1 |
| ONB-004 | Steadiness communication | B4, B5, B7 |
| PFD-001 | Feature revelation | C5 |
| PFD-002 | Phase-based interface | B2, B3, C5, F1 |
| ACCT-001 | Chart of accounts | A1, B1, D1 |
| ACCT-002 | Invoicing & clients | C6, C7, E3, E4, H4 |
| ACCT-003 | Bills & expenses | C8, D5, E5, E6, G5, G6, G7 |
| ACCT-004 | Bank reconciliation | D2, E1 |
| ACCT-005 | Journal entries | B2, F7 |
| ACCT-006 | Products/services | G2 |
| ACCT-007 | Inventory | G3, H6 |
| ACCT-008 | Sales tax | G4 |
| ACCT-009 | Reporting | D6, D7, F4, F5, F6, G1, I6 |
| ACCT-010 | Cash vs. accrual | F8 |
| ACCT-011 | Audit log | A1, B8, E7 |
| CLASS-001 | Classification & tagging | F2, F3 |
| CHECK-001 | Checklist generation | C3, C4 |
| CHECK-002 | Checklist interface | C4 |
| NOTIF-001 | Weekly email | D3 |
| CURR-001 | Multi-currency | H5, I4 |
| BARTER-001 | Barter transactions | I5 |
| VIZ-001 | 3D visualization | J1 |
| LIAB-001 | Interest prompt | H7 |
| FUTURE-001 | API architecture | J11 |
| FUTURE-002 | Team collaboration | H1, H3, I2, I3 |
| TECH-001 | Performance | B9 |
| TECH-002 | Platform support | A6 |
| TECH-003 | Accessibility | A5 |

---

*"Remember: every big journey is just a series of small steps. You've got this. And so do your users."*

**Now go build something graceful.**
