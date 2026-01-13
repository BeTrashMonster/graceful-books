# Roadmap Gaps Analysis

**Date:** 2026-01-10
**Roadmap Version:** Updated with OpenSpec Integration
**Analysis Scope:** Alignment with OpenSpec best practices and workflow standards

---

## Executive Summary

This document identifies gaps between the current Graceful Books roadmap and OpenSpec best practices. The roadmap has been successfully converted to OpenSpec format with 10 changes created, but several alignment issues remain that need to be addressed for optimal agent-based development.

**Status Overview:**
- ✅ Roadmap structure and phasing: Excellent
- ✅ OpenSpec change mapping: Complete
- ⚠️ Spec file formatting: Needs fixes (65 files)
- ❌ Metadata tracking: Missing
- ❌ Cross-linking: Incomplete
- ❌ Acceptance criteria: Inconsistent
- ❌ Risk/dependency documentation: Missing

---

## Part 1: Formatting Issues Fixed

### 1.1 OpenSpec Terminology Corrections ✅

**Issue:** The original roadmap incorrectly referenced OpenSpec files with uppercase extensions.

**Fixed:**
- Changed references from `PROPOSAL.md` → `proposal.md`
- Changed references from `TASKS.md` → `tasks.md`
- Changed references from `SPEC.md` → `specs/*/spec.md`
- Added clarification that each change has multiple spec files in `specs/` subdirectory

**Impact:** High - Prevents confusion when navigating OpenSpec structure

---

### 1.2 Quick Start Guide Added ✅

**Issue:** No clear entry point for developers starting work on the roadmap.

**Added:**
- "Quick Start Guide" section after "How to Read This Roadmap"
- Step-by-step workflow: Review → Understand → Implement → Validate
- Command examples for OpenSpec CLI usage
- Clear explanation of expected workflow
- "Where to Find Help" subsection with resource links
- "Common Questions" FAQ

**Impact:** High - Reduces onboarding friction for new developers and agents

---

### 1.3 Consistent Heading Structure ✅

**Issue:** Heading levels were already consistent, but OpenSpec integration section needed better organization.

**Improved:**
- Added "OpenSpec File Structure" subsection
- Updated "Current Status" to reflect actual validation state
- Clarified the three-file structure (proposal.md, tasks.md, specs/*/spec.md)

**Impact:** Medium - Improves scanability and navigation

---

### 1.4 Accurate OpenSpec References ✅

**Issue:** Some references to OpenSpec structure were incomplete or unclear.

**Fixed:**
- Clarified that specs are in `specs/*/spec.md` format (subdirectories per capability)
- Updated validation status to match `OPENSPEC_CONVERSION_SUMMARY.md`
- Added reference to gaps document (ROADMAP_GAPS.md)
- Corrected file naming conventions throughout

**Impact:** Medium - Ensures accurate navigation of OpenSpec structure

---

### 1.5 Minor Content Fixes ✅

**Fixed:**
- Changed E7 title from "Audit Log - Basic" to "Audit Log - Extended" (accurate description)
- Updated E7 description to reflect extended search/filter capabilities
- Updated Appendix table to include E7 under ACCT-011 references

**Impact:** Low - Improves accuracy and consistency

---

## Part 2: Missing OpenSpec Metadata

### 2.1 Dates and Timestamps ❌

**Gap:** Roadmap items lack temporal metadata for tracking and planning.

**Missing Elements:**
- Created date per roadmap item
- Target start date
- Target completion date
- Last updated timestamp
- Date of last status change

**Recommendation:**
Add metadata block to each roadmap item:
```yaml
**Metadata:**
- Created: 2026-01-10
- Target Start: TBD (after Group A complete)
- Target Completion: TBD
- Last Updated: 2026-01-10
- Status: Not Started
```

**Priority:** High
**Effort:** Medium - Can be automated with script

**Example Implementation:**
```markdown
### B1. Chart of Accounts - Basic CRUD [MVP]
**Metadata:**
- ID: B1
- Created: 2026-01-10
- Status: Not Started
- Target Phase: Phase 1, Group B
- Estimated Effort: 2 weeks
- Last Updated: 2026-01-10

**What:** Create, read, update, and manage accounts.
...
```

---

### 2.2 Ownership and Assignment ❌

**Gap:** No indication of who owns or is assigned to each item.

**Missing Elements:**
- Owner/assignee field
- Team assignment
- Reviewer assignment
- Domain expert assignment

**Recommendation:**
Add ownership metadata:
```yaml
**Ownership:**
- Lead: Unassigned
- Team: Core Platform
- Reviewer: TBD
- Domain Expert: TBD
```

**Priority:** High
**Effort:** Low - Template update

---

### 2.3 Status Tracking ❌

**Gap:** No standardized status field per roadmap item (only one item marked [DONE]).

**Missing Elements:**
- Current status (Not Started, In Progress, In Review, Complete, Blocked, Deferred)
- Status history
- Blocking issues reference
- Progress percentage

**Recommendation:**
Add status block to each item:
```yaml
**Status:** Not Started
**Progress:** 0%
**Blockers:** None
**Status History:**
- 2026-01-10: Created
```

**Priority:** High
**Effort:** Medium

---

### 2.4 Effort Estimation ❌

**Gap:** No time or effort estimates for planning purposes.

**Missing Elements:**
- Story points or T-shirt sizing
- Estimated hours/days/weeks
- Complexity rating
- Required skill sets

**Recommendation:**
Add estimation metadata:
```yaml
**Estimation:**
- Complexity: Medium
- Estimated Effort: 2 weeks
- Required Skills: React, TypeScript, Database Design
- Prerequisites: None
```

**Priority:** Medium
**Effort:** High - Requires domain expertise

---

## Part 3: Missing Links Between Roadmap and OpenSpec

### 3.1 Direct Links to OpenSpec Changes ❌

**Gap:** Roadmap mentions OpenSpec changes exist but doesn't link directly to them.

**Missing Elements:**
- Direct file path links to proposal.md
- Direct file path links to tasks.md
- Direct file path links to relevant spec.md files
- Link to validation status

**Recommendation:**
Add "OpenSpec Resources" section to each roadmap item:
```markdown
**OpenSpec Resources:**
- Change: `openspec/changes/basic-features/`
- Proposal: [proposal.md](../openspec/changes/basic-features/proposal.md)
- Tasks: [tasks.md](../openspec/changes/basic-features/tasks.md)
- Specs:
  - [chart-of-accounts/spec.md](../openspec/changes/basic-features/specs/chart-of-accounts/spec.md)
- Validation: Run `openspec validate basic-features`
```

**Priority:** High
**Effort:** Medium - Can be scripted based on roadmap-to-change mapping

---

### 3.2 Bidirectional Traceability ❌

**Gap:** Can't easily trace from OpenSpec change back to roadmap item.

**Missing Elements:**
- Roadmap reference in proposal.md files
- Roadmap item ID in OpenSpec changes
- Phase/Group reference in OpenSpec metadata

**Recommendation:**
Add to each proposal.md:
```yaml
**Roadmap Reference:**
- Phase: Phase 1 - The Foundation
- Group: B - The Frame
- Items: B1, B2, B3, B4, B5, B6, B7, B8, B9
- Priority: MVP
```

**Priority:** Medium
**Effort:** Medium

---

### 3.3 Dependency Visualization ❌

**Gap:** Dependencies are listed as text but not visualized or machine-readable.

**Missing Elements:**
- Dependency graph
- Dependency validation
- Circular dependency detection
- Critical path analysis

**Recommendation:**
Create dependency map file:
```yaml
# dependencies.yaml
items:
  B1:
    depends_on: [A1, A3, A5, A6]
    blocks: [B2, C6, D1]
  B2:
    depends_on: [A1, A3, B1]
    blocks: [B3, C7, E2, F7]
```

Add tooling to:
- Validate dependencies
- Generate dependency graphs
- Identify critical path

**Priority:** Medium
**Effort:** High - Requires tooling development

---

## Part 4: Missing Acceptance Criteria & Definition of Done

### 4.1 Inconsistent Acceptance Criteria ❌

**Gap:** Some items have "Success Criteria" in tasks.md, but not consistently in the roadmap.

**Missing Elements:**
- Clear, testable acceptance criteria per roadmap item
- User acceptance criteria
- Technical acceptance criteria
- Performance criteria

**Current State:**
- Foundation Infrastructure (tasks.md): Has success criteria checklist ✅
- Other changes: Missing or inconsistent ⚠️
- Roadmap items: No acceptance criteria ❌

**Recommendation:**
Add to each roadmap item:
```markdown
**Acceptance Criteria:**
- [ ] User can create a new account with name and type
- [ ] Account appears in chart of accounts list immediately
- [ ] Account can be edited and changes persist
- [ ] Account can be marked inactive (not deleted)
- [ ] Plain English descriptions shown for all account types
- [ ] All CRUD operations complete in <200ms
- [ ] All accessibility tests pass (WCAG 2.1 AA)
- [ ] Unit test coverage >80%
```

**Priority:** High
**Effort:** High - Requires detailed analysis per item

---

### 4.2 Missing Definition of Done ❌

**Gap:** No project-wide "Definition of Done" checklist.

**Missing Elements:**
- Code complete criteria
- Testing requirements
- Documentation requirements
- Review requirements
- Deployment requirements

**Recommendation:**
Create DEFINITION_OF_DONE.md:
```markdown
# Definition of Done

A roadmap item is considered "Done" when ALL of the following are true:

## Code Complete
- [ ] All acceptance criteria met
- [ ] Code reviewed and approved by 2+ reviewers
- [ ] No known bugs or critical issues
- [ ] Code follows project style guide
- [ ] All linter warnings resolved

## Testing
- [ ] Unit tests written and passing (>80% coverage)
- [ ] Integration tests written and passing
- [ ] Accessibility tests passing (WCAG 2.1 AA)
- [ ] Cross-browser testing complete
- [ ] Mobile device testing complete (if applicable)
- [ ] Performance tests passing

## Documentation
- [ ] Code comments for complex logic
- [ ] API documentation complete (if applicable)
- [ ] User-facing documentation updated
- [ ] OpenSpec spec.md reflects implementation
- [ ] Changelog updated

## Quality Assurance
- [ ] Security review complete (if handling sensitive data)
- [ ] Privacy review complete (if handling user data)
- [ ] Encryption review complete (for financial data)
- [ ] Load testing complete (if applicable)

## Deployment
- [ ] Deployed to staging environment
- [ ] Smoke tests passing in staging
- [ ] Product owner acceptance
- [ ] Ready for production deployment
```

**Priority:** High
**Effort:** Medium

---

### 4.3 Missing Test Strategy per Item ❌

**Gap:** Testing mentioned in tasks.md but not formalized in roadmap.

**Missing Elements:**
- Unit test requirements
- Integration test requirements
- E2E test requirements
- Performance test requirements
- Security test requirements

**Recommendation:**
Add test strategy section to each roadmap item:
```markdown
**Testing Requirements:**
- Unit Tests:
  - Account creation with valid data
  - Account creation with invalid data
  - Account update operations
  - Account deletion/inactivation
  - Account hierarchy validation
- Integration Tests:
  - Account CRUD with database
  - Account CRUD with encryption
  - Account CRUD with audit logging
- E2E Tests:
  - Create account workflow
  - Edit account workflow
- Performance Tests:
  - Load 1000 accounts in <500ms
  - Create account in <200ms
```

**Priority:** Medium
**Effort:** High

---

## Part 5: Missing Risk & Dependency Information

### 5.1 Risk Assessment Missing ❌

**Gap:** No risk analysis per roadmap item.

**Missing Elements:**
- Technical risks
- Business risks
- Security risks
- Performance risks
- Risk mitigation strategies

**Recommendation:**
Add risk section to each roadmap item:
```markdown
**Risks:**
- **Technical Risk (Medium):** Complex hierarchical account structure may impact query performance
  - *Mitigation:* Implement indexed queries and caching strategy from day one
- **Security Risk (High):** Account data must be encrypted at rest
  - *Mitigation:* Leverage encryption layer (A2) and audit all access
- **UX Risk (Low):** Account types may confuse non-accounting users
  - *Mitigation:* Plain English descriptions and contextual help
```

**Priority:** Medium
**Effort:** High - Requires risk analysis expertise

---

### 5.2 External Dependencies Not Documented ❌

**Gap:** Internal dependencies tracked ({A1, A3, etc.}) but external dependencies not mentioned.

**Missing Elements:**
- Third-party library dependencies
- API dependencies
- Infrastructure dependencies
- Service dependencies

**Recommendation:**
Add external dependencies section:
```markdown
**External Dependencies:**
- Libraries:
  - Dexie.js (IndexedDB wrapper)
  - argon2-browser (encryption)
- Services:
  - None (local-first)
- Infrastructure:
  - Browser with IndexedDB support
  - Browser with Web Crypto API
```

**Priority:** Low
**Effort:** Medium

---

### 5.3 Dependency Change Impact Not Tracked ❌

**Gap:** If a dependency changes, no way to track downstream impact.

**Missing Elements:**
- "Blocks" relationship (inverse of "depends on")
- Dependency change notification
- Impact analysis

**Recommendation:**
Add to dependency tracking:
```yaml
**Dependencies:**
- Depends On: {A1, A3, A5, A6}
- Blocks: {B2, C6, D1}  # Items that depend on this one
- Optional Dependencies: None
- Conditional Dependencies: None
```

**Priority:** Medium
**Effort:** Medium

---

## Part 6: OpenSpec Spec File Validation Issues

### 6.1 Foundation Infrastructure - Normative Language ⚠️

**Gap:** 5 spec files missing SHALL/MUST keywords in requirements.

**Affected Files:**
- `foundation-infrastructure/specs/app-shell/spec.md`
- `foundation-infrastructure/specs/authentication/spec.md`
- `foundation-infrastructure/specs/data-storage/spec.md`
- `foundation-infrastructure/specs/encryption/spec.md`
- `foundation-infrastructure/specs/ui-foundation/spec.md`

**Fix Required:**
Change from:
```markdown
### Requirement: Application Layout Structure
The system implements a consistent layout structure...
```

To:
```markdown
### Requirement: Application Layout Structure
The system SHALL implement a consistent layout structure...
```

**Priority:** High (blocks validation)
**Effort:** Low (search and replace)

**Estimated Files:** 5
**Estimated Requirements:** ~20-30

---

### 6.2 All Other Changes - Missing Requirement Blocks ⚠️

**Gap:** 60 spec files have `## ADDED Requirements` headers but no `### Requirement:` blocks.

**Affected Changes:**
- basic-features (7 files)
- onboarding-and-setup (6 files)
- guided-setup-experiences (6 files)
- daily-workflows (7 files)
- core-workflows (5 files)
- advanced-accounting (6 files)
- team-collaboration (7 files)
- advanced-sync (5 files)
- moonshot-features (11 files)

**Fix Required:**
Restructure from:
```markdown
## ADDED Requirements

**Functional Requirements**

1. Create Account...
2. Edit Account...
```

To:
```markdown
## ADDED Requirements

### Requirement: Account Management
The system SHALL provide functionality to create, edit, and manage accounts.

**ID:** ACCT-001-001
**Priority:** Critical

#### Scenario: Create Account
**GIVEN** a user has access to the chart of accounts
**WHEN** they create a new account with valid data
**THEN** the account is saved to the database
**AND** the account appears in the chart of accounts list
**AND** an audit log entry is created

#### Scenario: Edit Account
**GIVEN** an existing account
**WHEN** the user edits the account details
**THEN** changes are saved
**AND** an audit log entry records the change
```

**Priority:** High (blocks validation)
**Effort:** High (manual restructuring required)

**Estimated Files:** 60
**Estimated Work:** 40-60 hours (varies by complexity)

---

## Part 7: Additional Improvement Opportunities

### 7.1 Roadmap Versioning ❌

**Gap:** No version tracking for the roadmap itself.

**Recommendation:**
- Add version number to roadmap
- Maintain CHANGELOG.md for roadmap changes
- Tag roadmap versions in git

**Priority:** Low
**Effort:** Low

---

### 7.2 Progress Tracking Dashboard ❌

**Gap:** No way to visualize overall roadmap progress.

**Recommendation:**
- Create progress dashboard (Markdown or HTML)
- Track completion percentage per phase/group
- Visualize dependencies and blockers
- Show burndown/burnup charts

**Priority:** Low
**Effort:** High

---

### 7.3 Automated Validation ❌

**Gap:** No automated validation that roadmap and OpenSpec stay in sync.

**Recommendation:**
- Create validation script
- Check that all roadmap items have OpenSpec changes
- Check that all OpenSpec changes reference roadmap
- Validate dependency consistency
- Run in CI/CD pipeline

**Priority:** Medium
**Effort:** High

---

### 7.4 Migration Path Documentation ❌

**Gap:** No guidance on migrating from one phase to another.

**Recommendation:**
Create migration guides:
- Data migration requirements
- Feature flag management
- Rollback procedures
- User migration/upgrade path

**Priority:** Low
**Effort:** Medium

---

## Part 8: Priority Matrix

### High Priority (Must Fix)

| Gap | Priority | Effort | Impact | Timeline |
|-----|----------|--------|--------|----------|
| Spec file formatting (foundation-infrastructure) | High | Low | High | 1 day |
| Spec file restructuring (60 files) | High | High | High | 2-3 weeks |
| Status tracking metadata | High | Medium | High | 1 week |
| Dates and timestamps | High | Medium | High | 1 week |
| Acceptance criteria | High | High | High | 2-3 weeks |
| Definition of Done | High | Medium | High | 2 days |
| Direct OpenSpec links | High | Medium | Medium | 1 week |

### Medium Priority (Should Fix)

| Gap | Priority | Effort | Impact | Timeline |
|-----|----------|--------|--------|----------|
| Ownership tracking | Medium | Low | Medium | 2 days |
| Effort estimation | Medium | High | Medium | 2 weeks |
| Bidirectional traceability | Medium | Medium | Medium | 1 week |
| Dependency visualization | Medium | High | Medium | 2 weeks |
| Test strategy per item | Medium | High | Medium | 2 weeks |
| Risk assessment | Medium | High | Medium | 2 weeks |
| Dependency impact tracking | Medium | Medium | Medium | 1 week |
| Automated validation | Medium | High | High | 2 weeks |

### Low Priority (Nice to Have)

| Gap | Priority | Effort | Impact | Timeline |
|-----|----------|--------|--------|----------|
| External dependencies | Low | Medium | Low | 1 week |
| Roadmap versioning | Low | Low | Low | 1 day |
| Progress dashboard | Low | High | Medium | 2 weeks |
| Migration path docs | Low | Medium | Low | 1 week |

---

## Part 9: Recommended Implementation Sequence

### Phase 1: Critical Fixes (Week 1-2)
1. Fix normative language in foundation-infrastructure specs (1 day)
2. Add Definition of Done document (2 days)
3. Add status tracking to all roadmap items (3 days)
4. Add dates/timestamps to all roadmap items (2 days)
5. Add direct OpenSpec links to all roadmap items (2 days)

### Phase 2: Spec Restructuring (Week 3-5)
1. Restructure basic-features specs (1 week)
2. Restructure onboarding-and-setup specs (1 week)
3. Restructure guided-setup-experiences specs (1 week)
4. Template for remaining specs (ongoing)

### Phase 3: Enhanced Metadata (Week 6-7)
1. Add ownership metadata (2 days)
2. Add effort estimates (requires SME input) (1 week)
3. Add bidirectional traceability (3 days)

### Phase 4: Quality & Validation (Week 8-9)
1. Add acceptance criteria to all items (1 week)
2. Add test strategies (1 week)
3. Create automated validation script (3 days)

### Phase 5: Advanced Features (Week 10+)
1. Risk assessment per item (2 weeks)
2. Dependency visualization tooling (2 weeks)
3. Progress dashboard (2 weeks)
4. Remaining improvements (ongoing)

---

## Part 10: Quick Wins

These can be implemented immediately with minimal effort:

1. **Add status field** to each roadmap item (1 day)
   - Status: Not Started | In Progress | In Review | Complete | Blocked | Deferred

2. **Add created date** to each item (1 hour)
   - Created: 2026-01-10

3. **Add OpenSpec change reference** (2 hours)
   - OpenSpec Change: `foundation-infrastructure`

4. **Fix normative language** in foundation-infrastructure (4 hours)
   - Add SHALL/MUST to requirement descriptions

5. **Create Definition of Done** (4 hours)
   - Single document, project-wide

6. **Add direct links** to OpenSpec files (1 day)
   - Proposal, tasks, specs links per item

---

## Part 11: Long-Term Recommendations

### 11.1 Roadmap as Living Document

**Recommendation:** Treat roadmap as a living, continuously updated document.

**Practices:**
- Weekly roadmap review meetings
- Update status and blockers in real-time
- Archive completed items to separate document
- Maintain "Upcoming Changes" section
- Regular retrospectives on roadmap accuracy

### 11.2 Integration with Project Management Tools

**Recommendation:** Consider integration with PM tools while maintaining OpenSpec as source of truth.

**Options:**
- GitHub Projects integration
- Linear/Jira integration (if used)
- Custom dashboard pulling from OpenSpec metadata
- Automated status updates from OpenSpec validation

### 11.3 Community Contribution Guidelines

**Recommendation:** If open-sourcing, create contribution guidelines that reference roadmap.

**Include:**
- How to propose new roadmap items
- How to claim roadmap items for implementation
- How to update roadmap status
- How to link PRs to roadmap items

---

## Conclusion

The Graceful Books roadmap is well-structured and has been successfully converted to OpenSpec format. However, significant gaps remain in metadata tracking, cross-linking, acceptance criteria, and spec file formatting.

**Top 3 Priorities:**
1. Fix spec file formatting to pass OpenSpec validation (High Priority, Low/High Effort)
2. Add status tracking and temporal metadata (High Priority, Medium Effort)
3. Define and apply acceptance criteria consistently (High Priority, High Effort)

**Estimated Total Effort:** 10-12 weeks for complete alignment

**Recommended Approach:** Incremental improvement, starting with critical fixes and high-impact quick wins, then tackling larger restructuring efforts in parallel with development work.

---

**Document Version:** 1.0
**Last Updated:** 2026-01-10
**Next Review:** After Phase 1 fixes complete
