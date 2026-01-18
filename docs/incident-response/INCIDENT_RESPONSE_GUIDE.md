# Incident Response Guide

**Build:** H12 - Incident Response Documentation [MVP]
**Last Updated:** 2026-01-18

## Overview

This is the primary guide for responding to production incidents at Graceful Books. It provides a comprehensive framework for detecting, responding to, and learning from incidents.

**When things go wrong, a clear playbook turns panic into process.**

## Quick Start

### If You're Responding to an Incident Right Now

1. **Don't panic** - Take a breath
2. **Assess severity** - [Severity Levels](./SEVERITY_LEVELS.md)
3. **Alert team** - Post in #incidents-critical (P0) or #incidents (P1/P2)
4. **Find the runbook** - [Runbooks](./runbooks/)
5. **Follow the steps** - Don't improvise
6. **Communicate** - Use [templates](./COMMUNICATION_TEMPLATES.md)
7. **Escalate if needed** - [Escalation paths](./ONCALL_AND_ESCALATION.md)

### If You Need to Rollback

Go directly to [Rollback Procedures](./ROLLBACK_PROCEDURES.md) - don't delay.

---

## Table of Contents

1. [Incident Response Framework](#incident-response-framework)
2. [Detection](#detection)
3. [Response](#response)
4. [Recovery](#recovery)
5. [Post-Incident](#post-incident)
6. [Roles and Responsibilities](#roles-and-responsibilities)
7. [Communication](#communication)
8. [Tools and Access](#tools-and-access)
9. [Best Practices](#best-practices)
10. [References](#references)

---

## Incident Response Framework

### The 5 Phases

```
Detection → Response → Recovery → Post-Incident → Prevention
    ↓          ↓          ↓            ↓             ↓
 Identify   Contain   Restore    Learn & Doc    Improve
    ↓          ↓          ↓            ↓             ↓
Severity   Runbook    Verify    Post-Mortem    Action Items
```

### Phase 1: Detection

**Goal:** Identify and categorize the incident as quickly as possible.

**Activities:**
- Monitor alerts and notifications
- Verify the issue is real (not false positive)
- Assess severity using [Severity Levels](./SEVERITY_LEVELS.md)
- Gather initial information

**Outputs:**
- Confirmed incident
- Severity assigned (P0/P1/P2/P3)
- Initial understanding of impact

### Phase 2: Response

**Goal:** Stop the bleeding and contain the damage.

**Activities:**
- Alert appropriate team members
- Follow relevant [runbook](./runbooks/)
- Contain the issue (rollback, disable feature, etc.)
- Preserve evidence for investigation
- Communicate to stakeholders

**Outputs:**
- Incident contained (not worsening)
- Team mobilized
- Initial communication sent

### Phase 3: Recovery

**Goal:** Restore service to normal operation.

**Activities:**
- Execute fix or rollback
- Verify service health
- Monitor for recurrence
- Update communications
- Gradually restore traffic if applicable

**Outputs:**
- Service restored
- Health checks passing
- Users notified
- Monitoring in place

### Phase 4: Post-Incident

**Goal:** Learn from the incident and document.

**Activities:**
- Complete incident log
- Schedule post-mortem (P0/P1)
- Write post-mortem document
- Identify action items
- Communicate learnings

**Outputs:**
- Incident fully documented
- Post-mortem completed
- Action items created
- Team debriefed

### Phase 5: Prevention

**Goal:** Prevent recurrence and improve response.

**Activities:**
- Implement fixes
- Update runbooks
- Improve monitoring
- Add tests
- Close action items

**Outputs:**
- Systems improved
- Documentation updated
- Team trained
- Confidence restored

---

## Detection

### How We Detect Incidents

**Automated Monitoring:**
- Cloudflare Analytics (error rates, latency)
- Health check failures
- SLA metrics degradation
- Database performance alerts
- Security scanning alerts

**Manual Detection:**
- User reports
- Team member discovery
- Support ticket influx
- Social media mentions
- Partner notifications

### When You Detect an Incident

```bash
# 1. Verify it's real
curl https://sync.gracefulbooks.com/health | jq
curl https://gracefulbooks.com

# 2. Check error rate
curl -s https://sync.gracefulbooks.com/metrics/sla | jq '.error_rate'

# 3. Check logs
cd C:/Users/Admin/graceful_books/relay
wrangler tail --env production | head -50

# 4. Assess severity (see Severity Levels doc)

# 5. Alert team (see Communication Templates)
```

### Detection Metrics

**Target metrics:**
- Time to detect: <5 minutes (automated), <15 minutes (manual)
- False positive rate: <10%
- Detection coverage: 100% of P0/P1 scenarios

---

## Response

### Initial Response Checklist

**First 5 Minutes:**

- [ ] Verify incident is real
- [ ] Assign severity (P0/P1/P2/P3)
- [ ] Post to Slack (#incidents-critical for P0, #incidents for others)
- [ ] Open incident tracking document
- [ ] Start taking notes with timestamps

**Template for Slack Alert:**
```
🚨 [P0/P1/P2/P3] INCIDENT: [Brief Description]

Severity: [P0/P1/P2/P3]
Started: [TIME]
Impact: [What users experience]
Status: [Investigating/Fixing/Monitoring]

On-call: @[YOUR_NAME]
Next update: [TIME]
```

### Response Actions by Severity

#### P0 - Critical (All Hands)

**Response Time:** < 5 minutes

1. **Alert:** Page all hands, post in #incidents-critical with @channel
2. **Escalate:** Notify CTO, CEO, Product Owner immediately
3. **Status Page:** Update within 5 minutes
4. **War Room:** Establish incident command in #incidents-critical
5. **Updates:** Every 15 minutes
6. **Focus:** All other work stops, service restoration only

#### P1 - High (Major Impact)

**Response Time:** < 15 minutes

1. **Alert:** Post in #incidents, page primary and secondary on-call
2. **Escalate:** Notify team lead and product owner
3. **Status Page:** Update within 15 minutes
4. **Coordination:** Use #incidents channel
5. **Updates:** Every 30 minutes
6. **Focus:** Prioritize over non-critical work

#### P2 - Medium (Partial Impact)

**Response Time:** < 1 hour

1. **Alert:** Post in #incidents, notify on-call (no page)
2. **Escalate:** If needed for expertise
3. **Status Page:** If user-facing
4. **Updates:** Every 2 hours or at milestones
5. **Focus:** During business hours, doesn't block other work

#### P3 - Low (Minor Impact)

**Response Time:** Next business day

1. **Create ticket:** GitHub issue or backlog
2. **Triage:** In next planning meeting
3. **No immediate alerts:** Unless user reported

### Finding the Right Runbook

Use this decision tree:

```
What's broken?
├─ Everything? → [Complete Outage](./runbooks/01-complete-outage.md)
├─ Authentication? → [Auth Failures](./runbooks/05-authentication-failures.md)
├─ One region? → [Sync Region Down](./runbooks/02-sync-region-down.md)
├─ Database? → [Database Issues](./runbooks/03-database-issues.md)
├─ Deployment? → [Deployment Failed](./runbooks/08-deployment-failed.md)
├─ Security? → [Security Incident](./runbooks/09-security-incident.md)
└─ Not sure? → Start with symptoms, check [Runbooks README](./runbooks/README.md)
```

### Response Principles

**DO:**
- ✅ Communicate early and often
- ✅ Follow runbooks (don't improvise)
- ✅ Document actions as you go
- ✅ Escalate when uncertain
- ✅ Focus on service restoration first
- ✅ Preserve evidence (logs, metrics)
- ✅ Consider rollback early
- ✅ Ask for help

**DON'T:**
- ❌ Panic or rush
- ❌ Make permanent fixes during incident (rollback, then fix)
- ❌ Go silent (update regularly)
- ❌ Blame people
- ❌ Try heroics without team
- ❌ Skip documentation
- ❌ Ignore escalation paths

---

## Recovery

### Verification Checklist

Before declaring incident resolved:

- [ ] All health checks passing
  ```bash
  ./scripts/health-check-all.sh
  ```

- [ ] Error rate normal (<1%)
  ```bash
  curl -s https://sync.gracefulbooks.com/metrics/sla | jq '.error_rate'
  ```

- [ ] Response time normal (p95 <500ms)
  ```bash
  curl -s https://sync.gracefulbooks.com/metrics/sla | jq '.response_time_p95'
  ```

- [ ] All regions healthy
  ```bash
  for region in us eu ap; do
    curl https://sync-$region.gracefulbooks.com/health | jq
  done
  ```

- [ ] Smoke tests passing
  ```bash
  npm run test:smoke:production
  ```

- [ ] No unusual logs
  ```bash
  wrangler tail --env production | head -100
  ```

- [ ] Monitoring stable for 15+ minutes

### Gradual Recovery

For major incidents, consider gradual recovery:

1. **Verify in staging first** (if applicable)
2. **Deploy to one region** (canary)
3. **Monitor for 15 minutes**
4. **Deploy to remaining regions**
5. **Monitor for 30 minutes**
6. **Declare fully recovered**

### Monitoring After Recovery

**First hour:**
- Check metrics every 15 minutes
- Watch for error spikes
- Monitor user reports

**First 24 hours:**
- Check metrics hourly
- Daily team check-in
- Be ready to rollback if recurrence

### Recovery Communication

**Internal:**
```
✅ RESOLVED: [Brief description]

Duration: [X] minutes ([START] to [END])
Impact: [Summary]
Resolution: [What fixed it]

Monitoring: Next [X] hours
Post-mortem: [Scheduled for DATE/TIME]

Thank you: @[names of responders]
```

**Status Page:**
```
Service Restored

All systems operational. Issue has been resolved.

Duration: [X] minutes
Impact: [Brief description]

We're monitoring closely. Full incident report will be available within 48 hours.
```

**User Email (if appropriate):**
Use [Communication Templates](./COMMUNICATION_TEMPLATES.md)

---

## Post-Incident

### Immediate Actions (Within 1 hour)

- [ ] Update status page to "Operational"
- [ ] Send final internal communication
- [ ] Send user communication (if needed)
- [ ] Complete incident log
- [ ] Schedule post-mortem (P0/P1 required)
- [ ] Thank team members
- [ ] Hand off monitoring to next shift

### Post-Mortem Process

**Required for:**
- All P0 incidents
- All P1 incidents
- Security incidents (any severity)
- Data loss (any severity)

**Timeline:**
- Schedule within 24 hours
- Hold meeting within 48 hours
- Publish document within 1 week

**Process:**
See [Post-Mortem Process](./POST_MORTEM_PROCESS.md)

### Incident Log Template

```markdown
# Incident Log: [DATE] - [Brief Description]

**Incident ID:** INC-[YYYY-MM-DD]-[NUMBER]
**Severity:** P0/P1/P2/P3
**Status:** Resolved
**Owner:** @[on-call engineer]

## Summary
[2-3 sentence summary]

## Timeline (UTC)

| Time | Event |
|------|-------|
| [TIME] | Incident began |
| [TIME] | Detected |
| [TIME] | Response started |
| [TIME] | [Key action] |
| [TIME] | Resolved |

**Duration:** [X] minutes

## Impact
- Users affected: [Number/%]
- Services impacted: [List]
- Data loss: None / [Description]

## Root Cause
[Brief explanation or "See post-mortem"]

## Resolution
[What fixed it]

## Actions Taken
1. [Action 1]
2. [Action 2]
3. [Action 3]

## Follow-up
- Post-mortem: [Link or scheduled date]
- Action items: [Link to tickets]
```

---

## Roles and Responsibilities

### Incident Commander (On-Call Engineer)

**Responsibilities:**
- Overall incident coordination
- Declare severity
- Execute runbooks
- Coordinate team response
- Make rollback decisions
- Communicate to stakeholders
- Document incident

**Authority:**
- Rollback without approval
- Page additional engineers
- Escalate to leadership
- Make service decisions

### Supporting Engineers

**Responsibilities:**
- Execute tasks assigned by IC
- Provide expertise
- Assist with investigation
- Pair on fixes
- Take over communication if IC hands-on

### Engineering Manager

**Responsibilities:**
- Resource coordination
- Escalation point
- External communication
- Post-mortem scheduling
- Team support

### Product Owner

**Responsibilities:**
- User impact assessment
- Communication approval
- Priority decisions
- Business impact evaluation

### CTO/CEO

**Responsibilities:**
- Executive decisions
- Major communication approval
- Legal/compliance coordination
- Press relations (if needed)

See [On-Call and Escalation](./ONCALL_AND_ESCALATION.md) for detailed role definitions.

---

## Communication

### Communication Principles

1. **Transparency** - Be honest about what we know and don't know
2. **Timeliness** - Communicate early, update regularly
3. **Clarity** - Plain English, avoid jargon
4. **Empathy** - Acknowledge user impact
5. **Consistency** - Same message across channels

### Communication Channels

**Internal:**
- Slack #incidents-critical (P0)
- Slack #incidents (P1/P2)
- Team email (follow-up)

**External:**
- Status page (all user-facing incidents)
- Email (P0, significant P1, security)
- Social media (if posted about incident)
- Support team (all incidents)

### Communication Cadence

| Severity | Initial | Updates | Resolution |
|----------|---------|---------|------------|
| **P0** | <5 min | Every 15 min | Immediately + follow-up email |
| **P1** | <15 min | Every 30 min | Immediately |
| **P2** | <1 hour | Every 2 hours | When resolved |
| **P3** | Next day | As needed | When resolved |

### Templates

All communication templates available at:
[Communication Templates](./COMMUNICATION_TEMPLATES.md)

---

## Tools and Access

### Required Tools

**Development:**
- Git
- Node.js and npm
- Wrangler CLI
- Turso CLI

**Monitoring:**
- Cloudflare Dashboard
- Sentry (error tracking)
- curl and jq (testing)

**Communication:**
- Slack
- Email access
- Status page access

### Required Access

**Production Systems:**
- [ ] GitHub repository (write access)
- [ ] Cloudflare account (admin)
- [ ] Turso account (admin)
- [ ] Wrangler authenticated (`wrangler whoami`)
- [ ] Turso CLI authenticated (`turso auth`)

**Communication:**
- [ ] Slack workspace
- [ ] #incidents channel
- [ ] #incidents-critical channel
- [ ] Status page editor access

### Access Verification

Run before your on-call shift:

```bash
# Verify GitHub access
gh auth status

# Verify Wrangler access
wrangler whoami

# Verify Turso access
turso auth show

# Test health check access
curl https://sync.gracefulbooks.com/health | jq

# Test rollback script
ls -l ./scripts/rollback.sh
```

### Emergency Access

If tools aren't working:

1. **Cloudflare Dashboard:** https://dash.cloudflare.com
2. **GitHub Web:** https://github.com
3. **Turso Dashboard:** https://turso.tech
4. **Backup Laptop:** [If primary device fails]
5. **Team Member:** Ask someone to perform actions

---

## Best Practices

### Before Incidents

**Preparation:**
- Read all runbooks
- Test tools and access
- Know escalation paths
- Understand architecture
- Practice in drills

**Documentation:**
- Keep runbooks updated
- Document changes
- Share learnings
- Cross-train team

### During Incidents

**Stay Calm:**
- Take a breath
- Follow the process
- Don't panic
- Ask for help

**Communicate:**
- Update often
- Be transparent
- Use templates
- Keep team informed

**Document:**
- Timestamp everything
- Record commands run
- Note observations
- Save logs

### After Incidents

**Complete Process:**
- Verify resolution
- Update documentation
- Hold post-mortem
- Complete action items

**Support Team:**
- Thank responders
- Check on well-being
- Share learnings
- Celebrate improvements

### Cultural Best Practices

**Blameless:**
- Focus on systems, not people
- Learn from mistakes
- Assume good intent
- Psychological safety

**Continuous Improvement:**
- Every incident is learning
- Update runbooks
- Improve monitoring
- Prevent recurrence

---

## Metrics and Goals

### Incident Metrics

Track and review monthly:

**Response Metrics:**
- Mean Time To Detect (MTTD): Target <5 min
- Mean Time To Respond (MTTR): Target <15 min (P0), <30 min (P1)
- Mean Time To Resolve: Varies by severity

**Quality Metrics:**
- Post-mortem completion: 100% for P0/P1
- Action item completion: >80%
- Recurrence rate: <10%

**Volume Metrics:**
- Incidents per week: Trending down
- P0/P1 ratio: Minimal P0s
- User-reported vs. detected: Mostly detected

### Improvement Goals

**Short-term (Next Quarter):**
- Reduce MTTD by 20%
- Improve runbook coverage to 95%
- Complete all quarterly drills
- Achieve 100% post-mortem completion

**Long-term (Next Year):**
- Reduce incident frequency by 50%
- Achieve 99.9% uptime SLA
- Automate common responses
- Improve team confidence (survey)

---

## References

### Documentation

- [Severity Levels](./SEVERITY_LEVELS.md) - P0/P1/P2/P3 definitions
- [Runbooks](./runbooks/) - Step-by-step incident procedures
- [Rollback Procedures](./ROLLBACK_PROCEDURES.md) - How to rollback deployments
- [Communication Templates](./COMMUNICATION_TEMPLATES.md) - Ready-to-use messages
- [Post-Mortem Process](./POST_MORTEM_PROCESS.md) - Blameless learning
- [On-Call & Escalation](./ONCALL_AND_ESCALATION.md) - Rotation and contacts
- [RTO/RPO Definitions](./RTO_RPO_DEFINITIONS.md) - Recovery objectives
- [Incident Drills](./INCIDENT_DRILLS.md) - Testing procedures

### Infrastructure Documentation

- [Deployment Runbook](../DEPLOYMENT_RUNBOOK.md)
- [Infrastructure README](../../infrastructure/README.md)
- [Performance Monitoring](../PERFORMANCE_MONITORING.md)

### External Resources

- [Google SRE Book](https://sre.google/sre-book/table-of-contents/)
- [Atlassian Incident Management](https://www.atlassian.com/incident-management)
- [PagerDuty Incident Response](https://response.pagerduty.com/)

---

## Quick Reference Card

```
INCIDENT RESPONSE QUICK REFERENCE
==================================

1. DON'T PANIC
   Take a breath. You've got this.

2. ASSESS SEVERITY
   P0 = Complete outage
   P1 = Major feature broken
   P2 = Minor issue
   P3 = Cosmetic

3. ALERT TEAM
   P0: #incidents-critical @channel
   P1: #incidents, page on-call
   P2: #incidents
   P3: GitHub issue

4. FIND RUNBOOK
   docs/incident-response/runbooks/

5. FOLLOW STEPS
   Don't improvise. Trust the process.

6. COMMUNICATE
   Use templates. Update regularly.

7. ROLLBACK IF NEEDED
   ./scripts/rollback.sh [component] production

8. ESCALATE IF STUCK
   See ONCALL_AND_ESCALATION.md

9. VERIFY RECOVERY
   Health checks, metrics, smoke tests

10. DOCUMENT & LEARN
    Post-mortem for P0/P1

REMEMBER:
- Service restoration first
- Ask for help early
- Document everything
- Learn and improve
```

---

## Appendix: Common Commands

```bash
# Health checks
curl https://sync.gracefulbooks.com/health | jq
for region in us eu ap; do curl https://sync-$region.gracefulbooks.com/health | jq; done

# Check metrics
curl -s https://sync.gracefulbooks.com/metrics/sla | jq

# View logs
cd relay && wrangler tail --env production

# Rollback
./scripts/rollback.sh workers production
./scripts/rollback.sh pages production

# List deployments
cd relay && wrangler deployments list --env production

# Test database
turso db shell graceful-books-sync --execute "SELECT 1"

# GitHub Actions
gh run list --limit 5
gh run view [run-id] --log
```

---

**Last Updated:** 2026-01-18
**Version:** 1.0.0

**REMEMBER:**

> "When things go wrong, a clear playbook turns panic into process."

You are prepared. You have runbooks. You have a team. You can handle this.

**Questions?** Slack: #incidents

**Feedback?** This is a living document. Help us improve it.
