# Journal Entries - Full - Capability Specification

**Capability ID:** `journal-entries`
**Related Roadmap Items:** F7
**SPEC Reference:** ACCT-005
**Status:** In Development

## Overview

Full journal entry capability enables manual adjustments, corrections, and complex accounting transactions. This is the "power user" feature that gives complete control over the books while maintaining educational support for non-accountants.

## ADDED Requirements


### Functional Requirements

#### FR-1: Multi-Line Journal Entries
**Priority:** Critical

**ADDED Requirements:**

The system SHALL support multi-line journal entries:

**Entry Structure:**
- Unlimited debit/credit lines
- Must balance before saving (enforced)
- Running balance display
- Visual balance indicator

**Line Details:**
- Account selection (with search)
- Debit or credit amount
- Memo/description per line
- Class/category/tags assignment
- Attachment support

**Balance Enforcement:**
- Real-time balance calculation
- Visual indicator (green when balanced)
- Cannot save if unbalanced
- Clear error message if imbalanced

**Acceptance Criteria:**
- [ ] Unlimited lines supported
- [ ] Balance enforcement works
- [ ] Running total accurate
- [ ] Cannot save unbalanced entry

---

#### FR-2: Entry Templates
**Priority:** High

**ADDED Requirements:**

The system SHALL provide entry templates:

**Built-In Templates:**
- Depreciation
- Prepaid expenses amortization
- Accrued expenses
- Deferred revenue recognition
- Bad debt write-off
- Inventory adjustments
- Owner draw/contribution

**Custom Templates:**
- Save frequently used entries as templates
- Template library per company
- Share templates across team
- Import/export templates

**Template Features:**
- Pre-filled accounts
- Variable amounts (user fills in)
- Instructions/notes
- Educational context

**Acceptance Criteria:**
- [ ] All built-in templates functional
- [ ] Custom template save/load works
- [ ] Templates save time
- [ ] Instructions clear

---

#### FR-3: Educational Support
**Priority:** High

**ADDED Requirements:**

The system SHALL provide learning resources:

**Educational Elements:**
- "Why would I need this?" context
- Debits and credits explained simply
- Common journal entry examples
- Balance verification guidance
- Video tutorials

**Plain English:**
- Avoid jargon where possible
- Explain technical terms
- Visual aids for concepts
- Real-world examples

**Safeguards:**
- Warning for unusual amounts
- "Are you sure?" for large adjustments
- Audit trail emphasis
- Recommendation to consult accountant for complex entries

**Acceptance Criteria:**
- [ ] Educational content accessible
- [ ] Plain English explanations clear
- [ ] Warnings appear appropriately
- [ ] User confidence increased

---

### Non-Functional Requirements

#### NFR-1: Audit Trail
**Priority:** Critical

**ADDED Requirements:**
- All journal entries logged to audit trail
- Cannot be deleted (void only)
- Before/after values tracked
- User and timestamp recorded

#### NFR-2: Approval Workflow
**Priority:** Medium

**ADDED Requirements:**
- Optional approval for journal entries
- Manager approval configurable
- Approval history tracked
- Notifications for pending approvals

---

## Success Metrics
- 30%+ of users create journal entries
- 50%+ use templates
- >4.0 ease-of-use rating
- Zero unbalanced entries saved
