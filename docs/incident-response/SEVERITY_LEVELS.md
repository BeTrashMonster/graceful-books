# Incident Severity Levels

**Build:** H12 - Incident Response Documentation [MVP]
**Last Updated:** 2026-01-18

## Overview

This document defines incident severity levels for Graceful Books. Clear severity definitions ensure appropriate response times, escalation paths, and resource allocation.

## Severity Definitions

### P0 - Critical (All Hands)

**Definition:** Complete service outage or critical security breach affecting all users.

**Response Time:** Immediate (< 5 minutes)

**Examples:**
- Application completely unavailable (500/502/503 errors)
- Database corruption or complete data loss
- Zero-knowledge encryption breach (keys exposed)
- All sync regions down simultaneously
- Authentication system completely broken
- Critical security vulnerability being actively exploited
- Data breach with user data exposed

**Response:**
- Page all on-call engineers immediately
- Notify CEO/CTO/Product Owner immediately
- All hands on deck until resolved
- Status page updated within 5 minutes
- Post incident communication sent within 1 hour
- All other work stops

**Communication:**
- Internal: Slack alert to #incidents-critical and @channel
- External: Status page, social media, email to all users
- Update frequency: Every 15 minutes

**Post-Mortem:** Mandatory within 48 hours

---

### P1 - High (Major Impact)

**Definition:** Significant functionality broken or affecting large subset of users.

**Response Time:** < 15 minutes

**Examples:**
- One or more sync regions completely down
- Critical features broken (transactions, invoicing, reconciliation)
- Intermittent authentication failures (>10% error rate)
- Data sync failing for all users
- Payment processing completely broken
- Major performance degradation (>5s page load)
- Encryption/decryption failing for subset of users
- Database performance severely degraded
- Multi-user collaboration completely broken

**Response:**
- Page primary on-call engineer
- Notify team lead and product owner
- Secondary on-call on standby
- Status page updated within 15 minutes
- Users notified within 30 minutes

**Communication:**
- Internal: Slack alert to #incidents
- External: Status page, in-app notification
- Update frequency: Every 30 minutes

**Post-Mortem:** Mandatory within 1 week

---

### P2 - Medium (Partial Impact)

**Definition:** Non-critical functionality broken or affecting small subset of users.

**Response Time:** < 1 hour

**Examples:**
- Single non-critical feature broken (reports, dashboard widgets)
- Performance degradation in specific areas (2-5s page load)
- Non-critical API endpoint failures
- Intermittent sync issues (<10% of users)
- Email notifications not sending
- OCR processing failing
- Export functionality broken
- UI bugs affecting usability but not blocking work
- Non-critical database queries slow
- Monitoring/alerting system issues

**Response:**
- Notify on-call engineer (no page)
- Begin investigation within 1 hour
- Status page updated if user-facing
- Fix during business hours

**Communication:**
- Internal: Slack message to #incidents
- External: Status page only (if user-facing)
- Update frequency: Every 2 hours or at milestone

**Post-Mortem:** Optional (recommended for repeated issues)

---

### P3 - Low (Minor Impact)

**Definition:** Minor issues, cosmetic bugs, or known workarounds exist.

**Response Time:** Next business day

**Examples:**
- Cosmetic UI issues (alignment, colors)
- Spelling/grammar errors
- Non-critical feature improvements
- Performance optimizations (sub-2s page load)
- Documentation errors
- Minor accessibility issues with workarounds
- Non-critical warning messages
- Edge case bugs with simple workarounds
- Internal tooling issues
- Non-urgent technical debt

**Response:**
- Add to backlog
- Fix in next sprint
- No immediate notification needed

**Communication:**
- Internal: GitHub issue or ticket
- External: None (unless user reported)
- Update frequency: On fix deployment

**Post-Mortem:** Not required

---

## Severity Assessment Matrix

Use this matrix to quickly determine severity:

| Impact / Scope | All Users | Most Users (>50%) | Some Users (10-50%) | Few Users (<10%) |
|----------------|-----------|-------------------|---------------------|------------------|
| **Complete Outage** | P0 | P0 | P1 | P1 |
| **Critical Feature Broken** | P0 | P1 | P1 | P2 |
| **Major Feature Broken** | P1 | P1 | P2 | P2 |
| **Minor Feature Broken** | P2 | P2 | P2 | P3 |
| **Cosmetic Issue** | P3 | P3 | P3 | P3 |

## Special Considerations

### Security Issues

Security issues may be elevated regardless of user impact:

- **Data breach or exposure:** Always P0
- **Active exploitation:** Always P0
- **Critical vulnerability (CVSS 9.0+):** P0 or P1
- **High vulnerability (CVSS 7.0-8.9):** P1 or P2
- **Medium vulnerability (CVSS 4.0-6.9):** P2 or P3
- **Low vulnerability (CVSS <4.0):** P3

### Data Integrity Issues

Data integrity issues may be elevated:

- **Data loss or corruption:** Always P0
- **Incorrect financial calculations:** P0 or P1
- **Audit trail compromised:** P0 or P1
- **Sync conflicts causing data loss:** P1
- **Temporary data inconsistency:** P2

### Compliance Issues

Compliance-related issues:

- **GAAP compliance violation:** P1
- **Audit trail failure:** P1
- **Accessibility (WCAG) violation blocking core features:** P2
- **Minor accessibility issues:** P3

## Severity Escalation

An incident's severity can be escalated if:

1. **Duration exceeds expected resolution time:**
   - P3 open >1 week → Consider P2
   - P2 open >24 hours → Consider P1
   - P1 open >4 hours → Consider P0

2. **Impact increases:**
   - More users affected
   - More features impacted
   - Security implications discovered

3. **Business impact increases:**
   - Press coverage
   - Major customer complaints
   - Regulatory concerns

4. **Repeated occurrence:**
   - Same issue multiple times → Escalate severity

## Severity De-escalation

An incident can be de-escalated if:

1. **Workaround found:**
   - Users can continue working
   - Impact significantly reduced

2. **Scope reduced:**
   - Fewer users affected than initially thought
   - Isolated to non-critical feature

3. **Partial fix deployed:**
   - Most functionality restored
   - Only edge cases remaining

**Important:** Document reason for de-escalation in incident notes.

## Response Time SLAs

| Severity | Acknowledgment | First Update | Resolution Target |
|----------|---------------|--------------|-------------------|
| P0 | 5 minutes | 15 minutes | 4 hours |
| P1 | 15 minutes | 30 minutes | 24 hours |
| P2 | 1 hour | 2 hours | 1 week |
| P3 | 1 business day | N/A | Next sprint |

**Note:** Resolution targets are goals, not guarantees. Complex issues may take longer.

## Decision Tree

```
Is the service completely down?
├─ YES → P0
└─ NO ↓

Is there a security breach or data exposure?
├─ YES → P0
└─ NO ↓

Are critical features broken for most users?
├─ YES → P1
└─ NO ↓

Are major features broken or some users affected?
├─ YES → P2
└─ NO ↓

Is it a minor bug or cosmetic issue?
└─ YES → P3
```

## Examples in Context

### Example 1: Sync Region Outage

**Scenario:** US sync region is down, but EU and AP regions are working.

**Severity:** P1 (High)
- Not P0 because service still available via other regions
- P1 because critical functionality impacted for US users
- Automatic failover should minimize impact

**Action:**
- Page on-call engineer
- Monitor automatic failover
- Update status page
- Investigate root cause

### Example 2: Dashboard Widget Not Loading

**Scenario:** Cash flow widget on dashboard shows error for all users.

**Severity:** P2 (Medium)
- Not P1 because dashboard still accessible and other widgets work
- Not P3 because it's user-facing and affects all users
- P2 because it's a visible issue but non-blocking

**Action:**
- Notify on-call engineer
- Fix within business hours
- Update status page

### Example 3: Export Button Wrong Color

**Scenario:** Export button is using wrong shade of blue.

**Severity:** P3 (Low)
- Purely cosmetic
- No functionality impact
- No user complaints

**Action:**
- Create GitHub issue
- Fix in next UI polish sprint

### Example 4: Authentication System Down

**Scenario:** No users can log in. 100% authentication failure rate.

**Severity:** P0 (Critical)
- Complete service outage (users can't access anything)
- Affects all users
- No workaround exists

**Action:**
- Page all on-call engineers
- All hands on deck
- Update status page immediately
- Communicate to all users

### Example 5: Incorrect Tax Calculation

**Scenario:** Sales tax calculated incorrectly for one state.

**Severity:** P1 (High)
- Data integrity issue
- Financial calculations incorrect
- Compliance risk
- Even though limited scope, severity is high due to nature

**Action:**
- Page on-call engineer
- Assess impact (how many users affected)
- Develop fix and data correction plan
- Notify affected users

## Severity Guidelines by Component

### Frontend (Cloudflare Pages)

- **Complete unavailability:** P0
- **Critical pages broken (dashboard, transactions):** P1
- **Non-critical pages broken (reports, settings):** P2
- **UI bugs, styling issues:** P3

### Backend (Workers/Sync Relay)

- **All regions down:** P0
- **One region down:** P1
- **API endpoint failures (critical):** P1
- **API endpoint failures (non-critical):** P2
- **Slow response times (<5s):** P2

### Database (Turso)

- **Database unavailable:** P0
- **Data corruption:** P0
- **One region unavailable:** P1
- **Slow queries affecting UX:** P2
- **Slow background queries:** P3

### Authentication

- **Cannot authenticate:** P0
- **Intermittent auth failures (>10%):** P1
- **Intermittent auth failures (<10%):** P2
- **Session refresh issues:** P2

### Data Sync

- **Sync completely broken:** P0
- **Sync failing for most users:** P1
- **Sync intermittent for some users:** P2
- **Sync delay but eventual consistency:** P3

### Encryption

- **Keys exposed or compromised:** P0
- **Encryption/decryption failing:** P0
- **Slow encryption (>1s):** P2
- **Key rotation issues:** P1

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-18 | 1.0.0 | Initial severity definitions |

---

**Related Documentation:**
- [Incident Response Guide](./INCIDENT_RESPONSE_GUIDE.md)
- [Runbooks](./runbooks/)
- [Communication Templates](./COMMUNICATION_TEMPLATES.md)
- [Post-Mortem Process](./POST_MORTEM_PROCESS.md)

**Questions?** Slack: #incidents
