# Security Incident Response Plan

**Version:** 1.0.0
**Last Updated:** 2026-01-18
**Build:** Phase 4 Security - Incident Response Documentation

---

## Purpose

This document outlines comprehensive procedures for responding to security incidents affecting Graceful Books. As a zero-knowledge accounting platform, security is foundational to our promise of user data sovereignty. This plan ensures a calm, methodical, and effective response when security events occur.

> "When security incidents happen, preparation turns uncertainty into action. Take a breath. We have a plan."

**Important:** For general operational incidents (outages, performance issues), see the [incident-response directory](./incident-response/). This document focuses specifically on **security incidents**.

---

## Quick Reference

**If you're responding to a security incident right now:**

1. **Breathe** - Panicking makes things worse
2. **Assess** - Is this actually a security incident? See [Classification](#incident-classification)
3. **Alert** - Post to #security-incidents (private channel)
4. **Preserve** - Capture evidence before making changes
5. **Contain** - Stop active threats from spreading
6. **Follow** - Use the appropriate [Response Playbook](#specific-scenarios)
7. **Escalate** - When in doubt, escalate up

**Emergency Contacts:**
- Security Team Lead: See internal contacts
- CTO (for service-down decisions): See internal contacts
- Legal Counsel (for breach notifications): See internal contacts

---

## Table of Contents

1. [Incident Classification](#incident-classification)
2. [Response Team](#response-team)
3. [Incident Response Phases](#incident-response-phases)
4. [Communication Plan](#communication-plan)
5. [Specific Scenarios](#specific-scenarios)
6. [Zero-Knowledge Architecture Considerations](#zero-knowledge-architecture-considerations)
7. [Tools and Resources](#tools-and-resources)
8. [Training and Drills](#training-and-drills)
9. [Legal and Compliance](#legal-and-compliance)
10. [References](#references)

---

## Incident Classification

Security incidents are classified by severity to ensure appropriate response and resource allocation.

### Severity Levels

| Level | Name | Description | Response Time | Examples |
|-------|------|-------------|---------------|----------|
| **P0** | Critical | Active data breach, system compromise, encryption breach | Immediate (<1 hour) | Encryption keys exposed, active data exfiltration, zero-knowledge breach, malware in production |
| **P1** | High | Vulnerability actively exploited, credential compromise | <4 hours | Successful unauthorized access, credentials leaked, brute force attack succeeding, API keys exposed |
| **P2** | Medium | Vulnerability discovered (not exploited), suspicious activity | <24 hours | Unpatched critical CVE, unusual access patterns, failed attack attempts, security misconfiguration |
| **P3** | Low | Minor security issue, informational finding | <7 days | Low-severity CVE, security best practice gap, penetration test finding (minor) |

### Decision Matrix: Is This a Security Incident?

```
Is user data potentially exposed?
├─ YES → Is our zero-knowledge encryption intact?
│        ├─ NO (encryption breached) → P0 CRITICAL - All hands
│        └─ YES (encrypted data only) → P1 HIGH - but user data safe
└─ NO ↓

Are credentials/keys potentially compromised?
├─ YES → P0 or P1 depending on scope
└─ NO ↓

Is there unauthorized system access?
├─ YES → P0 or P1 depending on scope
└─ NO ↓

Is there a known vulnerability being exploited?
├─ YES → P1 HIGH
└─ NO ↓

Is there a known vulnerability NOT being exploited?
├─ YES → P2 MEDIUM
└─ NO ↓

Is this a minor security finding or best practice gap?
└─ YES → P3 LOW
```

### Classification Guidelines

**Elevate severity if:**
- User financial data potentially affected (even encrypted)
- Media attention likely
- Regulatory notification may be required
- Multiple systems affected
- Attack is ongoing

**Lower severity if:**
- Issue contained to staging/development
- No user data involved
- Isolated to single component with no spread
- Workaround exists

---

## Response Team

### Incident Response Roles

| Role | Responsibilities | Who |
|------|------------------|-----|
| **Incident Commander (IC)** | Overall coordination, decision-making, escalation | Primary on-call engineer or security lead |
| **Security Lead** | Technical security analysis, containment strategy | Security team member |
| **Communications Lead** | Internal/external communications, stakeholder updates | Engineering manager or designated comms |
| **Forensics Lead** | Evidence preservation, root cause analysis | Senior engineer with security background |
| **Legal Liaison** | Compliance guidance, notification requirements | CTO or designated legal contact |
| **Executive Sponsor** | High-level decisions, resource allocation | CTO or CEO |

### Escalation Matrix

| Severity | Who to Alert | Response Expectation |
|----------|--------------|----------------------|
| **P0** | Security team, CTO, CEO, Legal | All available personnel, war room, 24/7 until resolved |
| **P1** | Security team, Engineering lead | Immediate response from available engineers |
| **P2** | Security team | Next business day, tracked to resolution |
| **P3** | Security team | Backlog prioritization, scheduled fix |

### On-Call Security Coverage

Security incidents can occur at any time. Our on-call rotation ensures 24/7 coverage:

- Primary on-call: First responder for all security alerts
- Secondary on-call: Backup if primary unavailable
- Security lead: Escalation point for P0/P1 incidents

See [ONCALL_AND_ESCALATION.md](./incident-response/ONCALL_AND_ESCALATION.md) for rotation schedule and contacts.

---

## Incident Response Phases

Our incident response follows the NIST Incident Response Framework, adapted for Graceful Books' architecture.

### Phase 1: Detection and Identification

**Goal:** Confirm the incident and assess initial scope.

**Detection Sources:**
- Automated security scanning (npm audit, secret detection)
- Cloudflare security alerts (WAF, DDoS)
- User reports of suspicious activity
- Security researcher disclosures
- Internal team observations
- Third-party notifications
- Log analysis anomalies

**Initial Assessment Checklist:**

```markdown
## Detection Checklist

### Confirm Incident
- [ ] Verify alert is not false positive
- [ ] Reproduce or confirm the issue
- [ ] Determine if incident is ongoing or past

### Initial Scope Assessment
- [ ] Which systems are affected?
- [ ] Is user data potentially exposed?
- [ ] Is zero-knowledge encryption intact?
- [ ] How long has this been occurring?
- [ ] What is the attack vector (if known)?

### Classification
- [ ] Assign initial severity (P0/P1/P2/P3)
- [ ] Identify incident type (data breach, credential compromise, etc.)
- [ ] Determine if escalation needed

### Alert
- [ ] Post to #security-incidents with initial assessment
- [ ] Notify required personnel per escalation matrix
- [ ] Open incident tracking document
```

**Tools for Detection:**

```bash
# Check for unusual access patterns
wrangler tail --env production | grep -E "(auth|login|token)"

# Review recent deployments
gh run list --limit 10

# Check database for suspicious activity
turso db shell graceful-books-sync --execute "
  SELECT * FROM audit_log
  WHERE timestamp > datetime('now', '-1 hour')
  ORDER BY timestamp DESC
  LIMIT 100;
"

# Check for secret exposure
npm run security:secrets
```

---

### Phase 2: Containment

**Goal:** Stop the incident from spreading and limit damage.

#### Short-Term Containment (Immediate)

**Priority:** Stop the bleeding while preserving evidence.

```markdown
## Immediate Containment Checklist

### Evidence Preservation (FIRST!)
- [ ] Export current logs before changes
- [ ] Screenshot dashboards and alerts
- [ ] Capture database state if needed
- [ ] Document current system state

### Stop Active Threats
- [ ] Block attacking IPs (Cloudflare WAF)
- [ ] Disable compromised accounts
- [ ] Rotate exposed credentials
- [ ] Enable enhanced rate limiting

### Isolate Affected Systems
- [ ] Disable affected features (if possible)
- [ ] Consider rollback to known-good state
- [ ] Block suspicious traffic patterns
```

**Containment Actions by Incident Type:**

| Incident Type | Immediate Containment |
|---------------|----------------------|
| **Data breach** | Isolate affected data, disable sync, assess exposure |
| **Credential compromise** | Rotate credentials, force logout, enable MFA |
| **Active attack** | Block attacker IP/range, enable "Under Attack" mode |
| **Malware** | Isolate affected systems, disable deployments |
| **Insider threat** | Revoke access, preserve audit logs |

**Evidence Preservation Commands:**

```bash
# Export Worker logs
cd C:/Users/Admin/graceful_books/relay
wrangler tail --env production --format=json > security-incident-$(date +%Y%m%d-%H%M%S).log &
TAIL_PID=$!

# Snapshot database
turso db shell graceful-books-sync --execute ".dump" > db-snapshot-$(date +%Y%m%d-%H%M%S).sql

# Export GitHub Actions logs
gh run list --limit 20 > github-actions-$(date +%Y%m%d-%H%M%S).log

# Export Cloudflare logs
# Dashboard > Workers > Analytics > Export
```

#### Long-Term Containment

**Priority:** Stabilize systems while investigation continues.

- Implement additional monitoring
- Deploy temporary fixes
- Restrict access to affected areas
- Enable enhanced logging
- Prepare for eradication phase

---

### Phase 3: Eradication

**Goal:** Remove the threat and address root cause.

#### Root Cause Analysis

```markdown
## Root Cause Analysis Checklist

### Identify Attack Vector
- [ ] How did attacker gain access?
- [ ] What vulnerability was exploited?
- [ ] When did the attack begin?
- [ ] What was the attacker's objective?

### Assess Impact
- [ ] What data was accessed/modified/exfiltrated?
- [ ] Which systems were compromised?
- [ ] Are there backdoors or persistence mechanisms?
- [ ] Is the attacker still present?

### Document Findings
- [ ] Create detailed timeline
- [ ] Capture technical evidence
- [ ] Document all findings
```

**Use the 5 Whys technique:**

```
Why did the breach occur?
  → Because API credentials were exposed
Why were credentials exposed?
  → Because they were committed to the repository
Why were they committed?
  → Because secret scanning wasn't blocking the commit
Why wasn't scanning blocking?
  → Because the pattern wasn't in our detection rules
Why wasn't the pattern included?
  → Because we don't have a process for updating patterns

Root Cause: Missing process for maintaining secret detection patterns
```

#### Removal Actions

```bash
# Rotate all affected secrets
cd relay
wrangler secret put NEW_SECRET_NAME --env production

# Rotate database tokens
NEW_DB_TOKEN=$(turso db tokens create graceful-books-sync)
echo "$NEW_DB_TOKEN" | wrangler secret put TURSO_AUTH_TOKEN --env production

# Force password resets for affected users
# (via admin panel or database)

# Remove malicious code/configurations
# Deploy clean version

# Verify removal
npm run test
npm run build
```

---

### Phase 4: Recovery

**Goal:** Restore systems to normal operation.

#### Recovery Checklist

```markdown
## Recovery Checklist

### Pre-Recovery Verification
- [ ] Threat completely eradicated
- [ ] All secrets rotated
- [ ] Affected systems patched
- [ ] Monitoring in place

### System Restoration
- [ ] Restore from known-good backup (if needed)
- [ ] Deploy patched version
- [ ] Re-enable disabled features
- [ ] Verify all health checks passing

### Validation Testing
- [ ] Run full test suite
- [ ] Verify security controls working
- [ ] Test user workflows
- [ ] Confirm encryption functioning

### Monitoring
- [ ] Enhanced monitoring for 48+ hours
- [ ] Watch for recurrence indicators
- [ ] Track for related anomalies
```

#### Recovery Verification Commands

```bash
# Verify all health checks
curl https://sync.gracefulbooks.com/health | jq
for region in us eu ap; do
  curl https://sync-$region.gracefulbooks.com/health | jq
done

# Run security tests
npm run test:security

# Verify error rate normal
curl -s https://sync.gracefulbooks.com/metrics/sla | jq '.error_rate'

# Full smoke test
npm run test:smoke:production
```

---

### Phase 5: Post-Incident Activities

**Goal:** Learn from the incident and prevent recurrence.

#### Immediate Post-Incident (Within 24 hours)

- [ ] Declare incident officially resolved
- [ ] Send final communications (internal and external)
- [ ] Complete incident log
- [ ] Schedule post-mortem meeting
- [ ] Thank responders

#### Post-Mortem (Within 48 hours)

Conduct a blameless post-mortem to learn from the incident.

**Post-Mortem Agenda:**
1. Incident summary (5 min)
2. Timeline review (20 min)
3. Root cause analysis (15 min)
4. What went well (5 min)
5. What could improve (10 min)
6. Action items (10 min)

See [POST_MORTEM_PROCESS.md](./incident-response/POST_MORTEM_PROCESS.md) for detailed process.

#### Incident Report Template

```markdown
# Security Incident Report: [INCIDENT-ID]

**Date:** [DATE]
**Severity:** [P0/P1/P2/P3]
**Type:** [Data breach / Credential compromise / etc.]
**Status:** Resolved

## Executive Summary
[2-3 sentence summary]

## Timeline (UTC)
| Time | Event |
|------|-------|
| HH:MM | Incident began |
| HH:MM | Detected |
| HH:MM | Containment started |
| HH:MM | Threat eradicated |
| HH:MM | Recovery complete |

**Total Duration:** [X] hours

## Impact Assessment
- Users affected: [Number]
- Data exposed: [Description]
- Systems compromised: [List]
- Encryption status: Intact / Compromised

## Root Cause
[Detailed explanation]

## Response Actions
1. [Action taken]
2. [Action taken]
3. [Action taken]

## Lessons Learned
- [Lesson 1]
- [Lesson 2]

## Prevention Measures
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Action] | @owner | [DATE] | Open |

## Appendix
- [Link to logs]
- [Link to evidence]
- [Link to post-mortem]
```

---

## Communication Plan

Clear, timely communication is essential during security incidents.

### Communication Principles

1. **Honest** - Don't minimize or exaggerate
2. **Timely** - Communicate early, even with incomplete information
3. **Clear** - Use plain language, avoid jargon
4. **Empathetic** - Acknowledge impact and concern
5. **Actionable** - Tell people what to do

### Internal Communication

#### Initial Alert (Immediately)

**Channel:** #security-incidents (private)

```
[SECURITY] P[0/1/2/3] - [Brief Description]

Severity: P[X]
Detected: [TIME]
Type: [data breach / credential compromise / etc.]
Status: Investigating

Initial Assessment:
[What we know so far]

On-call: @[YOUR_NAME]
Next update: [TIME]

DO NOT discuss outside #security-incidents until cleared.
```

#### Updates (Per Severity SLA)

| Severity | Update Frequency |
|----------|------------------|
| P0 | Every 30 minutes |
| P1 | Every 2 hours |
| P2 | Daily |
| P3 | As needed |

#### Resolution Notice

```
[RESOLVED] P[X] - [Brief Description]

Duration: [X] hours ([START] to [END])

Summary:
[What happened and how it was resolved]

Impact:
- Users affected: [Number]
- Data exposure: [None / Description]

Next Steps:
- Post-mortem: [DATE/TIME]
- User notification: [Yes/No - status]
- Prevention measures: [In progress]

Thank you to: @[responders]
```

### External Communication

**Important:** External communication requires approval.

| Approval Required | Approver |
|-------------------|----------|
| Status page update | IC or Engineering Lead |
| User email | CTO + Legal |
| Press statement | CEO + Legal |
| Regulatory notification | CEO + Legal |

#### Status Page Update (If Service Impacted)

```
Security Investigation

We're investigating a security matter and have taken precautionary measures.
Your data security is our top priority.

Updates will be provided as information becomes available.

Started: [TIME UTC]
```

#### User Notification (When Required)

See [COMMUNICATION_TEMPLATES.md](./incident-response/COMMUNICATION_TEMPLATES.md) for security incident email templates.

**User notification required when:**
- Personal data exposed
- Encryption potentially compromised
- Account credentials affected
- Legal/regulatory requirement

**Notification must include:**
- What happened (clear, honest)
- What data was involved
- What we're doing about it
- What users should do
- How to contact us

### Public Disclosure Guidelines

For significant security incidents, prepare for public disclosure:

1. **Coordinate timing** with fix deployment
2. **Draft advisory** with technical details
3. **Legal review** before publication
4. **Notify affected parties** before public disclosure
5. **Publish** to security advisories and blog
6. **Monitor** for questions and follow-up

---

## Specific Scenarios

### Scenario 1: Data Breach

**Description:** Unauthorized access to user data or encrypted data exfiltration.

**Severity:** P0 (Critical)

**Immediate Actions:**

```markdown
## Data Breach Response

### Immediate (< 15 minutes)
- [ ] Alert security team via #security-incidents
- [ ] Assess: Is data encrypted or plaintext?
- [ ] Preserve all logs and evidence
- [ ] Identify affected data scope

### Containment (< 1 hour)
- [ ] Block exfiltration path
- [ ] Disable affected APIs/endpoints
- [ ] Isolate compromised systems
- [ ] Begin forensic capture

### Assessment
- [ ] What data was accessed?
- [ ] Is encryption intact?
- [ ] How many users affected?
- [ ] What was the access method?
- [ ] Is attacker still present?

### Notification (if required)
- [ ] Legal team consulted
- [ ] Regulatory timeline determined (72h GDPR)
- [ ] User notification drafted
- [ ] Notification sent within required timeframe
```

**Zero-Knowledge Consideration:** If only encrypted data was accessed and encryption keys remain secure, user financial data remains protected. However, metadata may still be exposed.

---

### Scenario 2: Credential Compromise

**Description:** API keys, secrets, or user credentials exposed or stolen.

**Severity:** P0 (if encryption keys) / P1 (other credentials)

**Immediate Actions:**

```markdown
## Credential Compromise Response

### Immediate (< 5 minutes)
- [ ] Identify which credentials exposed
- [ ] Assess impact scope
- [ ] Begin rotation immediately

### Rotation Procedure
- [ ] Revoke compromised credentials
- [ ] Generate new credentials
- [ ] Deploy to all environments
- [ ] Verify old credentials no longer work
- [ ] Update all dependent systems

### For User Credentials
- [ ] Force logout affected users
- [ ] Reset passwords
- [ ] Notify affected users
- [ ] Enable/require MFA

### For System Credentials
- [ ] Rotate all related secrets
- [ ] Check for unauthorized usage
- [ ] Review access logs
- [ ] Update key management procedures
```

**Rotation Commands:**

```bash
cd relay

# Rotate session secret
NEW_SESSION=$(openssl rand -base64 32)
echo "$NEW_SESSION" | wrangler secret put SESSION_SECRET --env production

# Rotate database token
NEW_DB_TOKEN=$(turso db tokens create graceful-books-sync)
echo "$NEW_DB_TOKEN" | wrangler secret put TURSO_AUTH_TOKEN --env production

# Verify rotation
wrangler secret list --env production
```

---

### Scenario 3: DDoS Attack

**Description:** Distributed denial of service attack overwhelming our infrastructure.

**Severity:** P1 (High)

**Immediate Actions:**

```markdown
## DDoS Response

### Immediate (< 5 minutes)
- [ ] Verify it's DDoS, not legitimate traffic spike
- [ ] Alert team
- [ ] Enable Cloudflare "Under Attack" mode

### Cloudflare Mitigations
- [ ] Enable DDoS protection (Dashboard > Security > DDoS)
- [ ] Set challenge mode for suspicious traffic
- [ ] Create WAF rules for attack patterns
- [ ] Enable rate limiting
- [ ] Block attacking IP ranges

### Monitoring
- [ ] Track attack traffic patterns
- [ ] Monitor for application-level attacks
- [ ] Watch for pivots to other attack types
- [ ] Keep logs for analysis

### Communication
- [ ] Update status page if user-facing impact
- [ ] Internal updates per SLA
- [ ] Consider external statement if prolonged
```

**Cloudflare Commands:**

```bash
# Check current traffic
curl -s https://sync.gracefulbooks.com/metrics/sla | jq

# Monitor for attack patterns
wrangler tail --env production | grep -i "attack\|inject\|flood"
```

---

### Scenario 4: Malware Infection

**Description:** Malicious code introduced into codebase or infrastructure.

**Severity:** P0 (Critical)

**Immediate Actions:**

```markdown
## Malware Response

### Immediate (< 5 minutes)
- [ ] Identify affected systems/components
- [ ] Isolate affected systems
- [ ] Halt all deployments
- [ ] Alert security team

### Containment
- [ ] Stop malware spread
- [ ] Disable affected Workers/Pages
- [ ] Preserve infected artifacts for analysis
- [ ] Block C2 communications (if identified)

### Investigation
- [ ] How was malware introduced?
- [ ] What is the malware doing?
- [ ] What data has it accessed?
- [ ] Are there persistence mechanisms?
- [ ] Is supply chain compromised?

### Eradication
- [ ] Identify clean state (commit hash)
- [ ] Rebuild from clean state
- [ ] Scan all dependencies
- [ ] Deploy clean version
- [ ] Verify no remnants

### Prevention
- [ ] Review how malware entered
- [ ] Enhance CI/CD security checks
- [ ] Update dependency policies
- [ ] Improve code review process
```

---

### Scenario 5: Insider Threat

**Description:** Malicious or negligent actions by authorized personnel.

**Severity:** P0 or P1 (depending on actions)

**Immediate Actions:**

```markdown
## Insider Threat Response

### Immediate (< 15 minutes)
- [ ] Assess threat type (malicious vs. negligent)
- [ ] Preserve audit logs
- [ ] DO NOT alert the individual (if malicious)
- [ ] Contact HR/Legal immediately

### Access Control
- [ ] Revoke access (coordinate with HR/Legal first)
- [ ] Rotate credentials they had access to
- [ ] Review all their recent activity
- [ ] Disable their accounts

### Investigation
- [ ] What actions did they take?
- [ ] What data did they access?
- [ ] Did they exfiltrate data?
- [ ] Are there accomplices?
- [ ] What was their motivation?

### Evidence Preservation
- [ ] Capture all audit logs
- [ ] Preserve email/chat records (via HR/Legal)
- [ ] Document all findings
- [ ] Maintain chain of custody

### Legal Considerations
- [ ] Consult legal counsel
- [ ] Consider law enforcement
- [ ] Document for potential litigation
- [ ] Protect company rights
```

**Important:** Insider threat investigations are sensitive. Coordinate with HR and Legal before taking action.

---

### Scenario 6: Zero-Knowledge Encryption Breach

**Description:** Encryption keys exposed or encryption bypassed.

**Severity:** P0 (CRITICAL - Highest Priority)

This is the worst-case scenario for Graceful Books.

**Immediate Actions:**

```markdown
## Encryption Breach Response

### IMMEDIATE (< 5 minutes) - ALL HANDS
- [ ] STOP all sync operations immediately
- [ ] Page all security personnel
- [ ] Notify CTO and CEO
- [ ] Begin forensic capture

### Containment
- [ ] Disable Workers (stop all sync)
- [ ] Block all API access
- [ ] Preserve current state
- [ ] Isolate affected components

### Assessment (CRITICAL)
- [ ] Which encryption keys compromised?
- [ ] How many users potentially affected?
- [ ] What encrypted data was accessible?
- [ ] Is attacker still present?
- [ ] Can decryption be performed with leaked keys?

### Key Rotation Protocol
- [ ] Initiate emergency key rotation (H2 procedures)
- [ ] Notify all affected users IMMEDIATELY
- [ ] Users must re-encrypt with new keys
- [ ] Old encrypted data may be compromised

### Legal/Regulatory (URGENT)
- [ ] Notify legal counsel immediately
- [ ] Assess notification requirements
- [ ] GDPR: 72-hour notification deadline
- [ ] Prepare user notification
- [ ] Consider regulatory filing

### Communication
- [ ] This WILL require user notification
- [ ] Prepare full transparency statement
- [ ] Legal review of all communications
- [ ] CEO approval required
```

**This scenario requires full disclosure to affected users, as the core promise of zero-knowledge encryption has been compromised.**

---

## Zero-Knowledge Architecture Considerations

Graceful Books' zero-knowledge architecture significantly impacts incident response.

### What Zero-Knowledge Means for Security Incidents

| Aspect | Impact |
|--------|--------|
| **Server-side data breach** | User financial data remains encrypted; metadata may be exposed |
| **Client-side compromise** | User's local data exposed for that device only |
| **Encryption key exposure** | Critical - user data at risk; immediate notification required |
| **Sync relay breach** | Only encrypted deltas exposed; encryption intact |
| **Database breach** | Encrypted data only; limited exposure if keys secure |

### Architecture-Specific Considerations

**Advantages:**
- Server breaches have limited impact (data encrypted)
- No single point of failure for user data
- Users can continue working offline during incidents
- Encrypted data at rest means less regulatory exposure

**Challenges:**
- Cannot "fix" compromised user data server-side
- Key rotation requires user action
- Cannot access user data to assess breach impact
- Users must be notified to take protective action

### Key Rotation Protocol

If encryption keys are compromised:

1. **Notify affected users immediately**
2. **Users must generate new encryption keys**
3. **Users must re-encrypt their data**
4. **Old encrypted data should be considered compromised**

See [H2_KEY_ROTATION_IMPLEMENTATION.md](./H2_KEY_ROTATION_IMPLEMENTATION.md) for detailed procedures.

---

## Tools and Resources

### Security Tools

| Tool | Purpose | Access |
|------|---------|--------|
| **Cloudflare Dashboard** | WAF, DDoS, traffic analysis | https://dash.cloudflare.com |
| **Wrangler CLI** | Worker logs, deployment | `wrangler` command |
| **Turso CLI** | Database access, backup | `turso` command |
| **GitHub** | Code, audit logs, Actions | https://github.com |
| **npm audit** | Dependency vulnerabilities | `npm audit` command |
| **Secret scanner** | Credential detection | CI/CD pipeline |

### Quick Commands

```bash
# Export logs for forensics
wrangler tail --env production --format=json > incident-logs.json &

# Database snapshot
turso db shell graceful-books-sync --execute ".dump" > db-snapshot.sql

# Check for exposed secrets
npm run security:secrets

# Security audit
npm audit

# Health checks
curl https://sync.gracefulbooks.com/health | jq

# Recent deployments
gh run list --limit 10
```

### External Resources

- [OWASP Incident Response Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Incident_Response_Cheat_Sheet.html)
- [NIST SP 800-61 Rev. 2](https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final) - Computer Security Incident Handling Guide
- [GDPR Breach Notification](https://gdpr-info.eu/art-33-gdpr/)
- [Cloudflare Security](https://www.cloudflare.com/security/)

### Evidence Storage

Incident evidence should be stored securely:

- **Location:** Secure, access-controlled storage
- **Retention:** 7 years minimum (legal requirement)
- **Chain of custody:** Document all access
- **Encryption:** Evidence should be encrypted at rest

---

## Training and Drills

Regular training ensures the team is prepared for security incidents.

### Training Requirements

| Audience | Training | Frequency |
|----------|----------|-----------|
| All engineers | Security awareness | Annually |
| On-call engineers | Incident response procedures | Quarterly |
| Security team | Advanced incident response | Quarterly |
| Leadership | Executive decision-making in crises | Annually |

### Security Drill Schedule

| Frequency | Type | Focus |
|-----------|------|-------|
| **Monthly** | Tabletop | Single scenario discussion |
| **Quarterly** | Simulated | Multi-component security scenario |
| **Annually** | Full exercise | Complete security incident simulation |

### Recommended Drill Scenarios

1. **Credential exposure** - Secret committed to repo
2. **Brute force attack** - Simulated authentication attack
3. **Data exfiltration** - Detecting and responding to data theft
4. **Zero-day vulnerability** - Responding to new CVE
5. **Encryption key compromise** - Worst-case scenario response

See [INCIDENT_DRILLS.md](./incident-response/INCIDENT_DRILLS.md) for detailed drill procedures.

### Team Readiness Checklist

Before on-call shifts, verify:

- [ ] Access to all tools (Cloudflare, Wrangler, Turso, GitHub)
- [ ] Understanding of incident response procedures
- [ ] Knowledge of escalation paths
- [ ] Ability to execute containment actions
- [ ] Familiarity with communication templates

---

## Legal and Compliance

### Breach Notification Requirements

| Regulation | Requirement | Timeline |
|------------|-------------|----------|
| **GDPR** (EU) | Notify supervisory authority | 72 hours |
| **GDPR** (EU) | Notify users if high risk | Without undue delay |
| **CCPA** (California) | Notify affected residents | Without unreasonable delay |
| **Other US States** | Varies by state | Check specific requirements |

### Notification Checklist

```markdown
## Legal Notification Checklist

### Documentation (gather first)
- [ ] Date/time breach occurred
- [ ] Date/time breach discovered
- [ ] Types of data involved
- [ ] Number of users affected
- [ ] Containment measures taken
- [ ] Remediation plan

### Legal Consultation
- [ ] Contact legal counsel
- [ ] Determine applicable regulations
- [ ] Identify notification requirements
- [ ] Draft notification language
- [ ] Legal review of communications

### Notifications
- [ ] Regulatory authority (if required)
- [ ] Affected users (if required)
- [ ] Law enforcement (if criminal activity)
- [ ] Insurance carrier (if cyber insurance)
```

### Document Retention

Incident documentation must be retained:

- **Duration:** 7 years minimum
- **Contents:** Logs, communications, decisions, evidence
- **Protection:** Encrypted, access-controlled
- **Audit:** Access logged

---

## References

### Internal Documentation

- [SECURITY.md](../SECURITY.md) - Security policy and vulnerability reporting
- [incident-response/](./incident-response/) - Detailed runbooks and procedures
- [DEPLOYMENT_SECURITY.md](./DEPLOYMENT_SECURITY.md) - Security configuration
- [SECURITY_SCANNING.md](./SECURITY_SCANNING.md) - CI/CD security scanning
- [H2_KEY_ROTATION_IMPLEMENTATION.md](./H2_KEY_ROTATION_IMPLEMENTATION.md) - Key rotation procedures

### Runbooks

- [01-complete-outage.md](./incident-response/runbooks/01-complete-outage.md)
- [05-authentication-failures.md](./incident-response/runbooks/05-authentication-failures.md)
- [09-security-incident.md](./incident-response/runbooks/09-security-incident.md)

### External Standards

- NIST SP 800-61 Rev. 2 - Computer Security Incident Handling Guide
- OWASP Incident Response Guidelines
- CIS Controls for Incident Response
- GDPR Article 33 & 34 - Breach Notification

---

## Appendix A: Security Incident Log Template

```markdown
# Security Incident Log: SEC-[YYYY-MM-DD]-[NUMBER]

## Metadata
- **Reported:** [DATE TIME UTC]
- **Reporter:** [Name/Source]
- **Severity:** P[0/1/2/3]
- **Type:** [data breach / credential compromise / attack / etc.]
- **Status:** [Active / Contained / Resolved]

## Timeline (UTC)

| Time | Event | Actor |
|------|-------|-------|
| HH:MM | [Event] | [Who] |

## Impact Assessment
- Users potentially affected:
- Data potentially exposed:
- Systems affected:
- Encryption status:

## Actions Taken
1. [Action]
2. [Action]

## Current Status
[Description]

## Next Steps
- [ ] [Action]
- [ ] [Action]

## Attachments
- [Link to logs]
- [Link to screenshots]
```

---

## Appendix B: Quick Reference Card

```
SECURITY INCIDENT QUICK REFERENCE
==================================

1. BREATHE
   Take a moment. Panic helps no one.

2. CLASSIFY
   P0 = Active breach, encryption compromise
   P1 = Vulnerability exploited, credentials leaked
   P2 = Vulnerability found, suspicious activity
   P3 = Minor security issue

3. ALERT
   Post to #security-incidents
   Follow escalation matrix

4. PRESERVE
   Capture evidence BEFORE making changes
   Logs, screenshots, database state

5. CONTAIN
   Stop the bleeding
   Block attackers, rotate credentials

6. INVESTIGATE
   What happened? How? Why?
   Document everything

7. ERADICATE
   Remove the threat
   Patch vulnerabilities

8. RECOVER
   Restore normal operations
   Monitor for recurrence

9. LEARN
   Post-mortem within 48 hours
   Implement improvements

10. COMMUNICATE
    Internal: Per update SLA
    External: With approval only

REMEMBER:
- User data safety is priority #1
- Zero-knowledge = limited server-side exposure
- Encryption breach = mandatory user notification
- Document EVERYTHING
- Ask for help when needed
```

---

**Document Owner:** Security Team
**Review Cycle:** Quarterly
**Last Review:** 2026-01-18
**Next Review:** 2026-04-18

---

*"Security incidents are not if, but when. Our preparation, not our luck, determines the outcome."*
