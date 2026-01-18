# On-Call Schedule & Procedures

## Overview

This document defines the on-call rotation schedule, responsibilities, and escalation procedures for Graceful Books infrastructure.

**Last Updated:** 2026-01-18
**Review Frequency:** Monthly
**Owner:** DevOps Team

---

## On-Call Rotation

### Schedule Structure

- **Primary On-Call:** First responder for all alerts
- **Secondary On-Call:** Backup if primary doesn't respond in 10 minutes
- **Rotation Period:** 1 week (Monday 9:00 AM - Monday 9:00 AM UTC)
- **Handoff Time:** Monday 9:00 AM UTC (allows weekend recovery)

### Current Rotation

| Week Starting | Primary | Secondary |
|---------------|---------|-----------|
| 2026-01-20 | Engineer A | Engineer B |
| 2026-01-27 | Engineer B | Engineer C |
| 2026-02-03 | Engineer C | Engineer A |
| 2026-02-10 | Engineer A | Engineer B |

*Note: This is a placeholder rotation. Update with actual team members.*

### On-Call Coverage Hours

**Production Environment:**
- **Critical Alerts:** 24/7 coverage (all severity: critical)
- **High Priority Alerts:** Business hours + extended (6 AM - 11 PM UTC)
- **Medium/Low Alerts:** Business hours only (9 AM - 6 PM UTC)

**Staging Environment:**
- **All Alerts:** Business hours only (9 AM - 6 PM UTC)

---

## Responsibilities

### Primary On-Call Engineer

**During On-Call Week:**

1. **Alert Response:**
   - Acknowledge critical alerts within 5 minutes
   - Acknowledge high-priority alerts within 15 minutes
   - Begin investigation immediately after acknowledgment

2. **Communication:**
   - Update incident Slack channel with status every 30 minutes during active incidents
   - Notify secondary on-call if help is needed
   - Escalate to engineering lead if incident severity increases

3. **Documentation:**
   - Document all actions taken in incident log
   - Create post-incident report within 24 hours of resolution
   - Update runbooks if new procedures are discovered

4. **Availability:**
   - Respond to PagerDuty notifications
   - Have laptop and reliable internet access
   - Be available for video calls if needed

5. **Handoff:**
   - Brief next on-call engineer during Monday handoff meeting
   - Share any ongoing issues or concerns
   - Transfer any open tickets

### Secondary On-Call Engineer

**During On-Call Week:**

1. **Backup Coverage:**
   - Be available if primary doesn't respond
   - Respond within 10 minutes if primary timeout occurs

2. **Support:**
   - Assist primary if requested
   - Take over if primary becomes unavailable

3. **Preparation:**
   - Review runbooks and recent incidents
   - Ensure PagerDuty notifications are working

---

## Alert Severity Levels

### Critical (Severity 1)

**Definition:** Complete service outage or data loss affecting all users

**Examples:**
- Sync relay down in all regions
- Database completely unavailable
- Frontend application returning 500 errors for all users
- Security breach detected

**Response Time:** 5 minutes
**Response Required:** Immediate action, 24/7
**Escalation:** Automatic to secondary after 10 minutes

**Actions:**
1. Acknowledge alert in PagerDuty
2. Post in #incidents Slack channel
3. Begin investigation immediately
4. Page secondary if help needed
5. Update status page
6. Notify leadership if outage > 15 minutes

### High (Severity 2)

**Definition:** Significant degradation affecting subset of users or critical feature

**Examples:**
- Sync relay down in one region
- Database performance degraded (> 500ms queries)
- Error rate > 5%
- Failed backup job

**Response Time:** 15 minutes
**Response Required:** During business hours + extended (6 AM - 11 PM UTC)
**Escalation:** To secondary after 30 minutes

**Actions:**
1. Acknowledge alert in PagerDuty
2. Post in #engineering Slack channel
3. Investigate within 30 minutes
4. Update ticket with findings
5. Notify secondary if help needed

### Medium (Severity 3)

**Definition:** Minor degradation, workaround available, or potential future issue

**Examples:**
- Slow response time in one endpoint
- Cache hit rate low
- Queue depth building up
- SSL certificate expiring in 30 days

**Response Time:** 4 hours
**Response Required:** Business hours only (9 AM - 6 PM UTC)
**Escalation:** Email to engineering after 4 hours

**Actions:**
1. Acknowledge alert
2. Investigate when available
3. Create ticket if needed
4. Document findings

### Low (Severity 4)

**Definition:** Minor issue, no user impact, informational

**Examples:**
- Performance slightly degraded
- Non-critical service warning
- Scheduled maintenance reminder

**Response Time:** 24 hours
**Response Required:** Business hours only
**Escalation:** None

**Actions:**
1. Review when convenient
2. Create ticket if action needed
3. Document if useful for future

---

## Escalation Paths

### Standard Escalation

```
Alert Triggered
       ↓
Primary On-Call (0 min)
       ↓ (no response in 10 min)
Secondary On-Call (10 min)
       ↓ (no resolution in 30 min)
Engineering Lead (30 min)
       ↓ (no resolution in 60 min)
CTO / Leadership (60 min)
```

### Critical Issue Fast Track

```
Critical Alert
       ↓
Primary + Secondary Paged Simultaneously
       ↓
Engineering Lead Notified (5 min)
       ↓
Leadership Notified (15 min if unresolved)
```

---

## On-Call Tools

### Required Access

Before your on-call week, ensure you have:

- [ ] PagerDuty app installed and configured
- [ ] Slack notifications enabled
- [ ] Access to Cloudflare dashboard
- [ ] Access to Turso database
- [ ] Access to GitHub (for rollbacks)
- [ ] Access to monitoring dashboards
- [ ] VPN configured (if applicable)
- [ ] Emergency contact list saved

### Communication Channels

| Channel | Purpose | Urgency |
|---------|---------|---------|
| PagerDuty | Critical alerts | Immediate |
| #incidents | Active incident updates | Immediate |
| #engineering | Non-critical issues | Normal |
| Email | Low priority, documentation | Low |

---

## Common On-Call Scenarios

### Scenario 1: Complete Service Outage

**Symptoms:** All regions down, users unable to access application

**Immediate Actions:**
1. Acknowledge alert (< 5 min)
2. Post in #incidents: "Investigating complete outage"
3. Check Cloudflare status page
4. Check Turso database status
5. Review recent deployments
6. If recent deployment, initiate rollback
7. Update #incidents every 5 minutes

**Escalation:** Page secondary immediately, notify leadership at 10 minutes

### Scenario 2: Performance Degradation

**Symptoms:** Response time elevated, error rate increasing

**Immediate Actions:**
1. Acknowledge alert (< 15 min)
2. Check metrics dashboard for affected endpoints
3. Check database query performance
4. Check queue depths
5. Review error logs in Sentry
6. If database issue, check connection pool
7. If specific endpoint, check recent code changes

**Escalation:** Page secondary at 30 minutes if not improving

### Scenario 3: Database Connection Issues

**Symptoms:** Database errors, connection timeouts

**Immediate Actions:**
1. Check Turso dashboard for status
2. Check connection pool utilization
3. Check for long-running queries
4. Check replica lag
5. Test database connectivity from worker
6. Review recent database migrations

**Escalation:** Critical if affecting all users, page secondary

### Scenario 4: Rate Limiting Spike

**Symptoms:** High rate limit hits, possible attack

**Immediate Actions:**
1. Review rate limit logs
2. Identify source IPs
3. Check WAF logs
4. If attack, enable stricter rate limits
5. Block malicious IPs in Cloudflare
6. Monitor for continued activity

**Escalation:** If DDoS, notify security team

---

## Handoff Procedures

### Weekly Handoff Meeting

**When:** Monday 9:00 AM UTC
**Duration:** 30 minutes
**Attendees:** Outgoing primary, incoming primary, incoming secondary

**Agenda:**
1. Review incidents from past week (10 min)
2. Share ongoing issues or concerns (10 min)
3. Transfer open tickets (5 min)
4. Questions from incoming on-call (5 min)

**Preparation (Outgoing):**
- [ ] Prepare incident summary
- [ ] List any ongoing issues
- [ ] Transfer ticket ownership
- [ ] Update documentation if needed

**Preparation (Incoming):**
- [ ] Review runbooks
- [ ] Test PagerDuty notifications
- [ ] Review recent incidents
- [ ] Ensure all access is working

---

## On-Call Compensation

### Time Off in Lieu (TOIL)

- **Weekend On-Call:** 0.5 days TOIL per weekend
- **Major Incident (> 2 hours):** 0.5 days TOIL
- **Critical Incident (> 4 hours):** 1 day TOIL

### Guidelines

- TOIL must be used within 3 months
- Schedule TOIL time with team lead
- Document TOIL hours in HR system

---

## On-Call Best Practices

### Before Your On-Call Week

1. **Test Everything:**
   - [ ] PagerDuty notifications working
   - [ ] Can access all systems
   - [ ] Runbooks are up to date
   - [ ] Emergency contacts saved

2. **Review Recent History:**
   - [ ] Read last week's incidents
   - [ ] Check for recurring issues
   - [ ] Review recent deployments

3. **Prepare Your Environment:**
   - [ ] Laptop charged and ready
   - [ ] Reliable internet access
   - [ ] Quiet workspace available

### During Your On-Call Week

1. **Stay Alert:**
   - Keep phone volume on
   - Check PagerDuty regularly
   - Monitor Slack channels

2. **Communicate Clearly:**
   - Update incident channels frequently
   - Be honest about unknowns
   - Ask for help when needed

3. **Document Everything:**
   - What you tried
   - What worked
   - What didn't work

4. **Know Your Limits:**
   - Escalate if stuck
   - Ask for help early
   - Take breaks during long incidents

### After Your On-Call Week

1. **Complete Documentation:**
   - [ ] All incident reports submitted
   - [ ] Runbooks updated
   - [ ] Tickets resolved or transferred

2. **Share Learnings:**
   - [ ] Brief team on major issues
   - [ ] Suggest improvements
   - [ ] Update documentation

3. **Take Care:**
   - Use TOIL if earned
   - Debrief if stressful week
   - Provide feedback on process

---

## Emergency Contacts

### Internal Escalation

| Role | Name | Phone | PagerDuty |
|------|------|-------|-----------|
| Engineering Lead | TBD | +1-XXX-XXX-XXXX | Yes |
| CTO | TBD | +1-XXX-XXX-XXXX | Yes |
| DevOps Lead | TBD | +1-XXX-XXX-XXXX | Yes |

### External Vendors

| Vendor | Purpose | Contact | Portal |
|--------|---------|---------|--------|
| Cloudflare | CDN/Workers | [Support](https://support.cloudflare.com) | cloudflare.com |
| Turso | Database | [Discord](https://discord.gg/turso) | turso.tech |
| Sentry | Error Tracking | [Support](https://sentry.io/support) | sentry.io |

### Critical Services Status Pages

- **Cloudflare:** https://www.cloudflarestatus.com
- **Turso:** https://status.turso.tech
- **GitHub:** https://www.githubstatus.com

---

## Review & Updates

### Monthly Review

**First Monday of each month:**
- Review on-call statistics (response times, incident counts)
- Review alert fatigue (false positives, ignored alerts)
- Update thresholds if needed
- Update this document if procedures changed

### Quarterly Review

**First month of each quarter:**
- Review on-call rotation fairness
- Survey team for feedback
- Review compensation structure
- Update runbooks
- Test disaster recovery procedures

---

## Appendix: On-Call Checklist

### Pre-Week Checklist

```
[ ] PagerDuty app installed and tested
[ ] Slack notifications enabled
[ ] All system access verified
[ ] Runbooks reviewed
[ ] Recent incidents read
[ ] Laptop prepared
[ ] Emergency contacts saved
[ ] Calendar cleared of conflicts
[ ] Secondary on-call briefed
```

### Post-Incident Checklist

```
[ ] Incident acknowledged in PagerDuty
[ ] #incidents channel updated
[ ] Issue investigated and resolved
[ ] Post-incident report written
[ ] Runbooks updated if needed
[ ] Related tickets created/updated
[ ] Team debriefed
[ ] TOIL hours logged (if applicable)
```

### End-of-Week Checklist

```
[ ] All incidents documented
[ ] Open tickets transferred
[ ] Handoff meeting scheduled
[ ] Learnings shared with team
[ ] Documentation updated
[ ] TOIL hours submitted
[ ] Feedback provided on process
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-18
**Next Review:** 2026-02-18
**Owner:** DevOps Team
