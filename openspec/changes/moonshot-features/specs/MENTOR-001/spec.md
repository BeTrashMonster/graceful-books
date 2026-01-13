# Mentor/Advisor Portal - Capability Specification

**Capability ID:** `mentor-portal`
**Related Roadmap Items:** J7
**SPEC Reference:** MENTOR-001
**Status:** Planned (Phase 5)

## Overview

Mentor/Advisor Portal enables accountants and advisors to access client books securely with time-limited, scope-limited access, document sharing, and collaborative feedback.

## ADDED Requirements


### Functional Requirements

#### FR-1: Advisor Invitation and Access Control
**Priority:** High

**ADDED Requirements:**
- Invite advisors via email (special Advisor role)
- Time-limited access (90 days, renewable)
- Scope-limited access (specific accounts/periods)
- Access revocation (instant)
- Audit log of advisor activity

**Acceptance Criteria:**
- [ ] Advisor invitations work
- [ ] Access expires correctly
- [ ] Revocation instant
- [ ] Audit trail complete

---

#### FR-2: Document Sharing and Collaboration
**Priority:** Medium

**ADDED Requirements:**
- Secure document upload/download (encrypted)
- Advisor comments on transactions
- Owner-advisor communication
- Comment threading and resolution
- Advisor dashboard (multi-client view)

**Acceptance Criteria:**
- [ ] Document encryption verified
- [ ] Comments thread correctly
- [ ] Multi-client switching works

---

## Success Metrics
- 15%+ users invite advisors
- >90% security audit pass
- >4.0 advisor satisfaction rating
